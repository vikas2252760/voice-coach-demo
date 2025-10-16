#!/usr/bin/env python3

"""
Pipecat Voice Coach Server
Based on pipecat-examples/websocket implementation
Provides real-time AI voice coaching through WebSocket communication.
"""

import asyncio
import json
import logging
import os
import sys
import websockets
from datetime import datetime

from pipecat.frames.frames import (
    AudioRawFrame,
    Frame,
    LLMMessagesFrame,
    TextFrame,
    TranscriptionFrame,
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.openai_llm_context import (
    OpenAILLMContext,
    OpenAILLMContextFrame,
)
from pipecat.services.deepgram import DeepgramSTTService, DeepgramTTSService
from pipecat.services.openai import OpenAILLMService
from pipecat.transports.services.helpers.daily_rest import DailyRESTHelper, DailyRoomObject
from pipecat.transports.websocket import WebsocketServerTransport
from pipecat.vad.silero import SileroVADAnalyzer

# Configure logging
logging.basicConfig(format=f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] %(levelname)s %(message)s")
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

class VoiceCoachBot:
    def __init__(self):
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.deepgram_api_key = os.getenv("DEEPGRAM_API_KEY")
        
        if not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY environment variable required")
        if not self.deepgram_api_key:
            raise ValueError("DEEPGRAM_API_KEY environment variable required")

        # Voice Coach system prompt
        self.system_prompt = """You are an expert Voice Coach AI specializing in sales pitch training and communication skills. Your role is to:

1. **Listen Actively**: Analyze the user's voice pitch in real-time
2. **Provide Constructive Feedback**: Give specific, actionable advice on:
   - Tone and confidence level
   - Speaking pace and pauses
   - Content structure and clarity
   - Persuasiveness and engagement
   - Professional presence

3. **Be Encouraging**: Balance criticism with positive reinforcement
4. **Give Practical Tips**: Offer specific techniques for improvement
5. **Score Performance**: Rate pitches on a scale of 1-100 with detailed explanations

**Communication Style:**
- Conversational and supportive
- Specific and actionable
- Professional but friendly
- Focus on 1-2 key improvements per interaction

**Current Context**: The user is practicing sales pitches for Verizon Home Device Protection, targeting families with growing tech needs.

Remember: You're having a real-time conversation. Keep responses concise but valuable, as if coaching someone in person."""

    async def create_pipeline(self, transport):
        """Create the Pipecat pipeline for voice processing"""
        
        # Services
        stt = DeepgramSTTService(
            api_key=self.deepgram_api_key,
            model="nova-2",
            language="en-US",
            interim_results=True
        )
        
        llm = OpenAILLMService(
            api_key=self.openai_api_key,
            model="gpt-4-turbo-preview",
            max_tokens=200,  # Keep responses concise for real-time coaching
            temperature=0.7
        )
        
        tts = DeepgramTTSService(
            api_key=self.deepgram_api_key,
            voice="aura-luna-en",  # Professional, coaching-appropriate voice
        )

        # VAD (Voice Activity Detection)
        vad = SileroVADAnalyzer()

        # Context management
        context = OpenAILLMContext(
            messages=[
                {"role": "system", "content": self.system_prompt}
            ]
        )

        # Create pipeline
        pipeline = Pipeline([
            transport.input(),   # WebSocket input
            stt,                # Speech-to-Text
            context.user(),     # Add user message to context
            llm,                # AI processing
            tts,                # Text-to-Speech
            transport.output(),  # WebSocket output
            context.assistant()  # Add AI response to context
        ])

        return PipelineTask(pipeline, params=PipelineParams(
            allow_interruptions=True,
            enable_metrics=True,
            enable_usage_metrics=True
        ))

class VoiceCoachServer:
    def __init__(self):
        self.bot = VoiceCoachBot()
        self.active_sessions = {}

    async def handle_client(self, websocket, path):
        """Handle individual WebSocket client connections"""
        client_id = f"client_{id(websocket)}"
        logger.info(f"🎤 New Voice Coach session: {client_id}")
        
        try:
            # Create WebSocket transport
            transport = WebsocketServerTransport(websocket)
            
            # Create pipeline task
            task = await self.bot.create_pipeline(transport)
            
            # Store active session
            self.active_sessions[client_id] = {
                'task': task,
                'transport': transport,
                'start_time': datetime.now()
            }

            # Send welcome message
            await self.send_system_message(websocket, {
                'type': 'connected',
                'message': '🎯 Voice Coach connected! Start speaking to begin your pitch practice.',
                'session_id': client_id,
                'timestamp': datetime.now().isoformat()
            })

            # Handle custom messages (like pitch scenarios, feedback requests, etc.)
            async def message_handler():
                async for message in websocket:
                    try:
                        data = json.loads(message)
                        await self.handle_custom_message(websocket, client_id, data)
                    except json.JSONDecodeError:
                        logger.warning(f"Invalid JSON from {client_id}: {message}")
                    except Exception as e:
                        logger.error(f"Error handling message from {client_id}: {e}")

            # Start message handler and pipeline task concurrently
            await asyncio.gather(
                message_handler(),
                task.run(),
                return_exceptions=True
            )

        except websockets.exceptions.ConnectionClosed:
            logger.info(f"🔌 Client {client_id} disconnected")
        except Exception as e:
            logger.error(f"❌ Error in session {client_id}: {e}")
        finally:
            # Cleanup session
            if client_id in self.active_sessions:
                del self.active_sessions[client_id]
            logger.info(f"🧹 Cleaned up session {client_id}")

    async def handle_custom_message(self, websocket, client_id, data):
        """Handle custom message types from the Voice Coach frontend"""
        message_type = data.get('type')
        payload = data.get('payload', {})

        logger.info(f"📨 Received {message_type} from {client_id}")

        if message_type == 'start_pitch_session':
            await self.handle_start_session(websocket, payload)
        elif message_type == 'set_scenario':
            await self.handle_set_scenario(websocket, payload)
        elif message_type == 'request_feedback':
            await self.handle_feedback_request(websocket, payload)
        elif message_type == 'voice_data':
            await self.handle_voice_data(websocket, payload)
        elif message_type == 'ping':
            await self.send_system_message(websocket, {'type': 'pong', 'timestamp': datetime.now().isoformat()})
        else:
            logger.warning(f"Unknown message type: {message_type}")

    async def handle_start_session(self, websocket, payload):
        """Handle session start with context setup"""
        customer = payload.get('customer', {})
        scenario = payload.get('scenario', {})
        
        # Send context to AI
        context_message = f"""
New Voice Coaching Session Started!

Customer Profile:
- Name: {customer.get('name', 'Unknown')}
- Family Size: {customer.get('familySize', 'Not specified')}
- Tech Usage: {customer.get('techUsage', 'Not specified')}

Scenario: {scenario.get('title', 'Current Customer Profile')}
{scenario.get('scenario', 'Focus on customer needs and benefits of device protection.')}

Please provide a brief, encouraging opening to start the practice session.
"""
        
        await self.send_ai_context(websocket, context_message)

    async def handle_set_scenario(self, websocket, payload):
        """Update coaching scenario"""
        scenario = payload.get('scenario', {})
        
        context_message = f"""
Scenario Change:
Title: {scenario.get('title', 'Custom Scenario')}
Description: {scenario.get('scenario', 'General pitch practice')}
Key Tips: {', '.join(scenario.get('coachingTips', []))}

Acknowledge this scenario change and provide a brief coaching tip to get started.
"""
        
        await self.send_ai_context(websocket, context_message)

    async def handle_feedback_request(self, websocket, payload):
        """Provide immediate feedback"""
        context_message = """
The user is requesting immediate feedback on their overall pitch performance so far. 
Please provide:
1. A performance score (1-100)
2. Top 2 strengths observed
3. Top 2 areas for improvement
4. One specific technique to try next

Keep it encouraging but constructive.
"""
        
        await self.send_ai_context(websocket, context_message)

    async def handle_voice_data(self, websocket, payload):
        """Handle voice data for analysis (in addition to pipeline processing)"""
        transcribed_text = payload.get('transcribedText', '')
        audio_size = payload.get('audioSize', 0)
        
        if transcribed_text:
            # Send transcribed text for immediate AI analysis
            context_message = f"""
User just said: "{transcribed_text}"

Provide immediate coaching feedback on:
- Content quality and clarity
- Suggested improvements
- Positive reinforcement
- Score this segment (1-100)

Keep response brief and actionable.
"""
            
            await self.send_ai_context(websocket, context_message)

    async def send_ai_context(self, websocket, message):
        """Send message to AI for processing"""
        # This would be handled by the pipeline
        # For now, we'll send it as a text frame to trigger AI response
        pass

    async def send_system_message(self, websocket, data):
        """Send system message to client"""
        try:
            await websocket.send(json.dumps(data))
        except Exception as e:
            logger.error(f"Failed to send system message: {e}")

    def get_server_stats(self):
        """Get server statistics"""
        return {
            'active_sessions': len(self.active_sessions),
            'total_sessions': len(self.active_sessions),  # This would track historical data
            'uptime': datetime.now().isoformat(),
            'status': 'running'
        }

async def main():
    """Main server entry point"""
    # Validate environment
    required_vars = ['OPENAI_API_KEY', 'DEEPGRAM_API_KEY']
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        logger.error(f"❌ Missing required environment variables: {', '.join(missing_vars)}")
        logger.info("Please set the following environment variables:")
        for var in missing_vars:
            logger.info(f"  export {var}=your_api_key_here")
        sys.exit(1)

    # Server configuration
    host = os.getenv("VOICE_COACH_HOST", "localhost")
    port = int(os.getenv("VOICE_COACH_PORT", "8080"))
    
    # Create server
    server = VoiceCoachServer()
    
    logger.info("🎯 Starting Pipecat Voice Coach Server...")
    logger.info(f"🌐 WebSocket endpoint: ws://{host}:{port}")
    logger.info("🎤 Ready for voice coaching sessions!")
    
    # Start WebSocket server
    async with websockets.serve(
        server.handle_client,
        host,
        port,
        ping_interval=30,
        ping_timeout=10,
        close_timeout=10
    ) as ws_server:
        logger.info(f"✅ Voice Coach Server running on ws://{host}:{port}")
        
        # Keep server running
        try:
            await asyncio.Future()  # Run forever
        except KeyboardInterrupt:
            logger.info("🛑 Server shutdown requested")
        finally:
            logger.info("🧹 Cleaning up server...")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("👋 Voice Coach Server stopped")
    except Exception as e:
        logger.error(f"💥 Server crashed: {e}")
        sys.exit(1)
