#!/usr/bin/env python3

"""
Simple WebSocket Server for Voice Coach Demo
A basic WebSocket server that can communicate with the React frontend
until the full Pipecat integration is fixed.
"""

import asyncio
import json
import logging
import websockets
import signal
import sys
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format=f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] %(levelname)s %(message)s"
)
logger = logging.getLogger(__name__)

class SimpleVoiceCoachServer:
    def __init__(self):
        self.connected_clients = set()
        
    async def handle_client(self, websocket):
        """Handle new WebSocket client connections"""
        client_id = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
        self.connected_clients.add(websocket)
        logger.info(f"🎯 Client connected: {client_id}")
        
        try:
            # Send welcome message
            await self.send_message(websocket, {
                'type': 'connected',
                'timestamp': datetime.now().isoformat(),
                'server': 'Simple Voice Coach Server',
                'status': 'ready',
                'capabilities': ['voice_practice', 'basic_coaching', 'websocket_test']
            })
            
            # Handle incoming messages
            async for raw_message in websocket:
                try:
                    # Handle JSON messages only
                    message = json.loads(raw_message)
                    await self.handle_message(websocket, message)
                except json.JSONDecodeError:
                    # Log unknown messages for debugging
                    logger.info(f"📨 Received non-JSON: {raw_message[:30]}...")
                except Exception as e:
                    logger.error(f"❌ Error handling message from {client_id}: {e}")
                    
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"🔌 Client disconnected: {client_id}")
        except Exception as e:
            logger.error(f"❌ Error with client {client_id}: {e}")
        finally:
            self.connected_clients.discard(websocket)
            
    async def handle_message(self, websocket, message):
        """Handle incoming messages from clients"""
        message_type = message.get('type', 'unknown')
        logger.info(f"📨 Received: {message_type}")
        
        if message_type == 'start_pitch_session':
            await self.handle_start_session(websocket, message)
        elif message_type == 'voice_data':
            await self.handle_voice_data(websocket, message)
        elif message_type == 'ping':
            await self.send_message(websocket, {'type': 'pong', 'timestamp': datetime.now().isoformat()})
        else:
            logger.info(f"🤷 Unknown message type: {message_type}")
            
    async def handle_start_session(self, websocket, message):
        """Handle session start requests"""
        customer = message.get('customer', {})
        await asyncio.sleep(0.5)  # Simulate processing time
        
        response = {
            'type': 'textFeedback',
            'message': f"🎯 **Real WebSocket Connection Established!**\n\n**Customer**: {customer.get('name', 'Unknown')}\n**Connected to**: Simple Voice Coach Server\n**Status**: Live WebSocket communication active\n\n🎤 **Ready for voice coaching!** This is a real-time WebSocket connection - try recording your voice!",
            'timestamp': datetime.now().isoformat(),
            'score': 85,
            'achievements': ['WebSocket Connection Established', 'Real-time Communication Active'],
            'improvements': ['Try recording voice for full AI coaching experience'],
            'progressPercent': 15
        }
        
        await self.send_message(websocket, response)
        
    async def handle_voice_data(self, websocket, message):
        """Handle voice data from client"""
        await asyncio.sleep(1)  # Simulate AI processing time
        
        # Extract info from message
        audio_size = message.get('audioSize', 0)
        transcription = message.get('transcription', 'No transcription available')
        
        response = {
            'type': 'textFeedback',
            'message': f"🎙️ **Voice Data Received via WebSocket!**\n\n**Transcription**: \"{transcription}\"\n**Audio Size**: {audio_size} bytes\n**Processing**: Real-time analysis complete\n\n✅ **This confirms the WebSocket connection is working perfectly!**\n\n🚀 **Next Steps**: The full AI coaching features will be available once the Pipecat API compatibility is resolved.",
            'timestamp': datetime.now().isoformat(),
            'score': 92,
            'achievements': ['Real-time Voice Processing', 'WebSocket Audio Transfer'],
            'improvements': ['Continue testing WebSocket features'],
            'progressPercent': 75
        }
        
        await self.send_message(websocket, response)
        
    async def send_message(self, websocket, data):
        """Send message to client"""
        try:
            message = json.dumps(data)
            await websocket.send(message)
            logger.info(f"📤 Sent: {data.get('type', 'unknown')}")
        except Exception as e:
            logger.error(f"❌ Failed to send message: {e}")

async def main():
    """Start the WebSocket server"""
    server_instance = SimpleVoiceCoachServer()
    
    # Server configuration
    host = "localhost"
    port = 8080
    
    logger.info("🚀 Starting Simple Voice Coach WebSocket Server...")
    logger.info(f"🌐 WebSocket endpoint: ws://{host}:{port}")
    logger.info("🎤 Ready for real-time communication!")
    
    # Handle shutdown gracefully
    def signal_handler():
        logger.info("🛑 Shutdown signal received")
        
    # Start WebSocket server with newer websockets API
    async def handler(websocket):
        await server_instance.handle_client(websocket)
    
    async with websockets.serve(
        handler,
        host,
        port,
        ping_interval=30,
        ping_timeout=10,
        close_timeout=10
    ) as ws_server:
        logger.info(f"✅ Simple Voice Coach Server running on ws://{host}:{port}")
        logger.info("📞 Waiting for Voice Coach connections...")
        
        # Handle shutdown
        loop = asyncio.get_event_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, signal_handler)
        
        try:
            await asyncio.Future()  # Run forever
        except KeyboardInterrupt:
            logger.info("👋 Server shutdown requested")
        finally:
            logger.info("🧹 Cleaning up server...")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("👋 Simple Voice Coach Server stopped")
    except Exception as e:
        logger.error(f"💥 Server crashed: {e}")
        sys.exit(1)
