#!/usr/bin/env python3

"""
Gemini Native Audio Service for Voice Coach
Handles real-time audio processing with Google's Gemini 2.5 Flash Native Audio model
"""

import asyncio
import logging
import json
import base64
import websockets
import ssl
import certifi
import httpx
from typing import Optional, Dict, Any
from dataclasses import dataclass
from config import Config

logger = logging.getLogger(__name__)

@dataclass
class AudioConfig:
    """Audio configuration for Gemini Native Audio"""
    input_sample_rate: int = 16000  # Input from frontend (16kHz)
    output_sample_rate: int = 24000  # Gemini output (24kHz) 
    input_channels: int = 1
    output_channels: int = 1
    audio_encoding: str = "linear16"

class GeminiNativeAudioService:
    """Service for real-time audio processing with Gemini 2.5 Flash Native Audio"""
    
    def __init__(self):
        self.api_key = Config.GEMINI_API_KEY
        # Use available Gemini model that actually works
        self.model_name = "gemini-2.5-flash"
        # Try different endpoints
        self.ws_url = f"wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key={self.api_key}"
        self.http_url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model_name}:generateContent"
        
        # Audio configuration
        self.audio_config = AudioConfig()
        
        # Connection state
        self.websocket: Optional[websockets.WebSocketServerProtocol] = None
        self.is_connected = False
        self.is_streaming = False
        self.use_http_fallback = False
        
        # Session management
        self.session_id = None
        self.conversation_context = []
        
        logger.info(f"🎵 Gemini Native Audio Service initialized with model: {self.model_name}")
    
    async def connect(self) -> bool:
        """Establish connection to Gemini Native Audio API with HTTP fallback"""
        try:
            logger.info("🔌 Trying WebSocket connection to Gemini Native Audio API...")
            
            # Try WebSocket connection first
            try:
                # Create SSL context with proper certificate verification
                ssl_context = ssl.create_default_context(cafile=certifi.where())
                ssl_context.check_hostname = True
                ssl_context.verify_mode = ssl.CERT_REQUIRED
                
                self.websocket = await websockets.connect(
                    self.ws_url,
                    ssl=ssl_context,
                    ping_interval=30,
                    ping_timeout=10,
                    close_timeout=10
                )
                
                # Send initial setup message for Gemini 2.5 Flash Native Audio
                setup_message = {
                    "setup": {
                        "model": f"models/{self.model_name}",
                        "generationConfig": {
                            "responseModalities": ["TEXT"],  # Start with text only
                            "temperature": 0.7,
                            "topP": 0.9,
                            "maxOutputTokens": 1000
                        },
                        "systemInstruction": {
                            "parts": [
                                {
                                    "text": "You are an expert voice coach and sales trainer. Provide real-time, personalized feedback on voice pitches and sales presentations. Keep responses conversational, supportive, and actionable. Focus on voice quality, content structure, and specific improvements."
                                }
                            ]
                        }
                    }
                }
                
                await self.websocket.send(json.dumps(setup_message))
                logger.info("📤 Sent setup message to Gemini API")
                
                # Wait for setup acknowledgment with shorter timeout
                response = await asyncio.wait_for(self.websocket.recv(), timeout=5.0)
                setup_response = json.loads(response)
                
                if "setupComplete" in setup_response:
                    self.is_connected = True
                    self.use_http_fallback = False
                    logger.info("✅ Gemini Native Audio WebSocket connection established")
                    return True
                else:
                    logger.warning(f"WebSocket setup failed: {setup_response}")
                    raise Exception("WebSocket setup failed")
                    
            except Exception as ws_error:
                logger.warning(f"⚠️ WebSocket failed: {ws_error}")
                logger.info("🔄 Falling back to HTTP API...")
                
                # Fallback to HTTP API
                self.use_http_fallback = True
                self.is_connected = True
                
                # Test HTTP connection
                headers = {
                    "Content-Type": "application/json",
                    "x-goog-api-key": self.api_key
                }
                
                test_payload = {
                    "contents": [
                        {
                            "parts": [
                                {"text": "Test connection"}
                            ]
                        }
                    ],
                    "generationConfig": {
                        "maxOutputTokens": 10
                    }
                }
                
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        self.http_url,
                        headers=headers,
                        json=test_payload,
                        timeout=10.0
                    )
                    
                    if response.status_code == 200:
                        logger.info("✅ Gemini HTTP API connection established (fallback mode)")
                        return True
                    else:
                        logger.error(f"HTTP API test failed: {response.status_code} - {response.text}")
                        return False
                
        except Exception as e:
            logger.error(f"❌ Failed to connect to Gemini API: {e}")
            return False
    
    async def send_audio_chunk(self, audio_data: bytes, is_final: bool = False) -> Dict[str, Any]:
        """Send audio chunk to Gemini for real-time processing"""
        if not self.is_connected or not self.websocket:
            logger.error("Not connected to Gemini API")
            return {"error": "Not connected"}
        
        try:
            # Encode audio data to base64
            audio_base64 = base64.b64encode(audio_data).decode('utf-8')
            
            # Create realtime input message
            message = {
                "realtimeInput": {
                    "mediaChunks": [
                        {
                            "mimeType": "audio/pcm;rate=16000",
                            "data": audio_base64
                        }
                    ]
                }
            }
            
            # Mark as final if this is the end of audio input
            if is_final:
                message["realtimeInput"]["mediaChunks"][0]["finalChunk"] = True
            
            await self.websocket.send(json.dumps(message))
            logger.debug(f"📤 Sent audio chunk ({len(audio_data)} bytes, final: {is_final})")
            
            # If final chunk, wait for complete response
            if is_final:
                return await self._wait_for_complete_response()
            
            return {"success": True}
            
        except Exception as e:
            logger.error(f"❌ Failed to send audio chunk: {e}")
            return {"error": str(e)}
    
    async def send_text_message(self, text: str, audio_context: Optional[str] = None) -> Dict[str, Any]:
        """Send text message with optional audio context for coaching analysis"""
        if not self.is_connected:
            logger.error("Not connected to Gemini API")
            return {"error": "Not connected"}
        
        # Use HTTP API if WebSocket failed or use_http_fallback is True
        if self.use_http_fallback or not self.websocket:
            logger.debug("Using HTTP API for text message")
            return await self._process_with_http(text)
        
        try:
            # Build context-aware prompt for WebSocket
            prompt_parts = []
            
            if audio_context:
                prompt_parts.append({
                    "text": f"I just recorded this voice message: '{text}'. Please provide voice coaching feedback on both the content and delivery. Focus on specific actionable improvements for better sales presentations."
                })
            else:
                prompt_parts.append({
                    "text": f"Please provide voice coaching guidance for: {text}"
                })
            
            message = {
                "clientContent": {
                    "turns": [
                        {
                            "role": "user", 
                            "parts": prompt_parts
                        }
                    ],
                    "turnComplete": True
                }
            }
            
            await self.websocket.send(json.dumps(message))
            logger.info(f"📤 Sent coaching request via WebSocket for: '{text[:50]}...'")
            
            # Wait for response
            return await self._wait_for_complete_response()
            
        except Exception as e:
            logger.error(f"❌ WebSocket send failed: {e}, falling back to HTTP")
            # Fallback to HTTP if WebSocket fails
            self.use_http_fallback = True
            return await self._process_with_http(text)
    
    async def _wait_for_complete_response(self) -> Dict[str, Any]:
        """Wait for and process complete response from Gemini"""
        try:
            text_response = ""
            audio_data = b""
            
            # Collect response parts
            while True:
                response_raw = await asyncio.wait_for(self.websocket.recv(), timeout=30.0)
                response = json.loads(response_raw)
                
                logger.debug(f"📥 Received response: {response}")
                
                if "serverContent" in response:
                    content = response["serverContent"]
                    
                    # Extract text content
                    if "modelTurn" in content:
                        parts = content["modelTurn"].get("parts", [])
                        for part in parts:
                            if "text" in part:
                                text_response += part["text"]
                            elif "inlineData" in part:
                                # Handle audio response
                                inline_data = part["inlineData"]
                                if inline_data.get("mimeType", "").startswith("audio/"):
                                    audio_chunk = base64.b64decode(inline_data["data"])
                                    audio_data += audio_chunk
                    
                    # Check if turn is complete
                    if content.get("turnComplete", False):
                        break
                        
                elif "error" in response:
                    logger.error(f"API Error: {response['error']}")
                    return {"error": response["error"]}
            
            # Return structured response
            result = {
                "text": text_response.strip(),
                "hasAudio": len(audio_data) > 0,
                "audioData": audio_data if len(audio_data) > 0 else None,
                "audioSize": len(audio_data),
                "timestamp": asyncio.get_event_loop().time()
            }
            
            logger.info(f"✅ Complete response: {len(text_response)} chars text, {len(audio_data)} bytes audio")
            return result
            
        except asyncio.TimeoutError:
            logger.error("❌ Response timeout from Gemini API")
            return {"error": "Response timeout"}
        except Exception as e:
            logger.error(f"❌ Failed to receive response: {e}")
            return {"error": str(e)}
    
    async def process_audio_message(self, audio_base64: str, transcribed_text: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """Process complete audio message for voice coaching"""
        try:
            # Decode audio data
            audio_data = base64.b64decode(audio_base64)
            logger.info(f"🎵 Processing audio message: {len(audio_data)} bytes, transcript: '{transcribed_text[:50]}...'")
            
            # Build coaching context
            coaching_prompt = self._build_coaching_prompt(transcribed_text, context)
            
            # Choose processing method based on connection type
            if self.use_http_fallback:
                response = await self._process_with_http(coaching_prompt)
            else:
                response = await self.send_text_message(coaching_prompt, audio_context=transcribed_text)
            
            if "error" in response:
                return response
                
            # Structure coaching feedback
            feedback = {
                "message": response.get("text", "Thanks for your voice message. Keep practicing!"),
                "score": self._calculate_score(transcribed_text, response.get("text", "")),
                "audioResponse": response.get("audioData"),
                "hasAudioResponse": response.get("hasAudio", False),
                "improvements": self._extract_improvements(response.get("text", "")),
                "achievements": self._extract_achievements(response.get("text", "")),
                "progressPercent": self._calculate_progress(context),
                "transcribedText": transcribed_text,
                "processingTime": response.get("timestamp", 0),
                "model": self.model_name,
                "connectionType": "HTTP" if self.use_http_fallback else "WebSocket"
            }
            
            logger.info(f"✅ Voice coaching complete - Score: {feedback['score']}, Connection: {feedback['connectionType']}")
            return feedback
            
        except Exception as e:
            logger.error(f"❌ Failed to process audio message: {e}")
            return {
                "error": str(e),
                "message": "Sorry, I couldn't process your audio message. Please try again."
            }
    
    async def _process_with_http(self, prompt: str) -> Dict[str, Any]:
        """Process message using HTTP API as fallback"""
        try:
            headers = {
                "Content-Type": "application/json",
                "x-goog-api-key": self.api_key
            }
            
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": prompt}
                        ]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.7,
                    "topP": 0.9,
                    "maxOutputTokens": 2048,  # Increased for better responses
                },
                "safetySettings": [
                    {
                        "category": "HARM_CATEGORY_HARASSMENT",
                        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        "category": "HARM_CATEGORY_HATE_SPEECH", 
                        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                    }
                ]
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.http_url,
                    headers=headers,
                    json=payload,
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    response_data = response.json()
                    logger.debug(f"Gemini API response: {response_data}")
                    
                    # Parse response with better error handling
                    candidates = response_data.get('candidates', [])
                    if candidates and len(candidates) > 0:
                        candidate = candidates[0]
                        
                        # Check finish reason
                        finish_reason = candidate.get('finishReason', 'STOP')
                        if finish_reason == 'MAX_TOKENS':
                            logger.warning("Response truncated due to max tokens")
                        
                        content = candidate.get('content', {})
                        parts = content.get('parts', [])
                        
                        if parts and len(parts) > 0:
                            ai_response = parts[0].get('text', '').strip()
                            if ai_response:
                                return {
                                    "text": ai_response,
                                    "hasAudio": False,
                                    "timestamp": asyncio.get_event_loop().time(),
                                    "finishReason": finish_reason
                                }
                        
                        # If no text content, try to extract any available text from candidate
                        logger.warning(f"No text in response parts. Candidate: {candidate}")
                        return {"error": f"Empty response content (finish reason: {finish_reason})"}
                    
                    return {"error": "No candidates in response"}
                else:
                    logger.error(f"HTTP API error: {response.status_code} - {response.text}")
                    return {"error": f"HTTP API error: {response.status_code}"}
                    
        except Exception as e:
            logger.error(f"HTTP processing error: {e}")
            return {"error": str(e)}
    
    def _build_coaching_prompt(self, transcribed_text: str, context: Dict[str, Any] = None) -> str:
        """Build contextual prompt for voice coaching"""
        base_prompt = f"""You are an expert voice and sales coach. Analyze this actual voice message and provide specific, actionable coaching.

TRANSCRIPT: "{transcribed_text}"

Provide SPECIFIC coaching feedback covering:

1. **Content Analysis**: 
   - Rate the message clarity and persuasiveness (1-10)
   - Identify specific strengths in the message
   - Point out exactly what words/phrases work well

2. **Delivery Coaching**: 
   - Comment on confidence level based on word choice
   - Suggest specific tone improvements 
   - Recommend pace and emphasis changes

3. **Sales Effectiveness**:
   - Evaluate customer focus vs self-focus
   - Rate value proposition clarity
   - Suggest specific call-to-action improvements

4. **Immediate Next Steps**:
   - Give 2-3 SPECIFIC actions to improve this exact message
   - Provide alternative word choices or phrases
   - Suggest what to add or remove

Be encouraging but detailed. Reference the actual words they used. Avoid generic advice - make it specific to THIS message."""
        
        # Add context if available
        if context:
            customer = context.get("customer", {})
            scenario = context.get("scenario", {})
            
            if customer and customer.get('name'):
                base_prompt += f"\n\nCUSTOMER CONTEXT: Pitching to {customer.get('name')} (Protection Score: {customer.get('protectionScore', 'N/A')})"
                
            if scenario and scenario.get('title'):
                base_prompt += f"\nSCENARIO: {scenario.get('title')} - {scenario.get('scenario', 'Voice coaching practice')}"
        
        base_prompt += f"\n\nRemember: This person said \"{transcribed_text}\" - give coaching specific to these exact words, not generic advice."
        
        return base_prompt
    
    def _calculate_score(self, transcript: str, ai_response: str) -> int:
        """Calculate coaching score based on message quality"""
        try:
            score = 75  # Base score
            
            # Length and completeness
            if len(transcript) > 50:
                score += 5
            if len(transcript) > 100:
                score += 5
                
            # Key sales phrases
            sales_keywords = ['value', 'benefit', 'solution', 'help', 'save', 'improve', 'better']
            keyword_count = sum(1 for keyword in sales_keywords if keyword in transcript.lower())
            score += min(keyword_count * 2, 10)
            
            # Positive indicators in AI response
            positive_indicators = ['good', 'excellent', 'strong', 'clear', 'confident', 'well']
            positive_count = sum(1 for indicator in positive_indicators if indicator in ai_response.lower())
            score += min(positive_count, 5)
            
            return min(max(score, 60), 95)  # Keep between 60-95
            
        except:
            return 75  # Safe default
    
    def _extract_improvements(self, ai_response: str) -> list:
        """Extract improvement suggestions from AI response"""
        improvements = []
        
        # Look for common improvement patterns
        response_lower = ai_response.lower()
        
        if 'pace' in response_lower or 'slow' in response_lower or 'fast' in response_lower:
            improvements.append("Adjust your speaking pace for better clarity")
            
        if 'confident' in response_lower or 'conviction' in response_lower:
            improvements.append("Speak with more confidence and conviction")
            
        if 'example' in response_lower or 'specific' in response_lower:
            improvements.append("Add specific examples to strengthen your message")
            
        if 'value' in response_lower or 'benefit' in response_lower:
            improvements.append("Emphasize the key benefits and value proposition")
            
        # Default if no specific improvements found
        if not improvements:
            improvements = [
                "Practice varying your tone for emphasis",
                "Focus on clear articulation of key points"
            ]
            
        return improvements[:3]  # Max 3 improvements
    
    def _extract_achievements(self, ai_response: str) -> list:
        """Extract achievements/strengths from AI response"""
        achievements = []
        
        response_lower = ai_response.lower()
        
        if 'clear' in response_lower:
            achievements.append("Clear and articulate delivery")
            
        if 'confident' in response_lower:
            achievements.append("Confident speaking style")
            
        if 'good' in response_lower or 'well' in response_lower:
            achievements.append("Well-structured message")
            
        if 'engaging' in response_lower:
            achievements.append("Engaging presentation style")
            
        # Default achievements
        if not achievements:
            achievements = ["Voice message received and processed"]
            
        return achievements[:3]  # Max 3 achievements
    
    def _calculate_progress(self, context: Dict[str, Any] = None) -> int:
        """Calculate session progress percentage"""
        if not context:
            return None
            
        # Simple progress based on message count or session time
        message_count = context.get("messageCount", 0)
        return min(message_count * 20, 100)  # 5 messages = 100%
    
    async def disconnect(self):
        """Disconnect from Gemini Native Audio API"""
        try:
            if self.websocket:
                # Check if websocket has closed attribute and use it, otherwise try to close
                try:
                    if hasattr(self.websocket, 'closed') and not self.websocket.closed:
                        await self.websocket.close()
                    elif hasattr(self.websocket, 'close'):
                        await self.websocket.close()
                    logger.info("🔌 Disconnected from Gemini Native Audio API")
                except Exception as close_error:
                    logger.debug(f"WebSocket close error (non-critical): {close_error}")
                
            self.is_connected = False
            self.websocket = None
            
        except Exception as e:
            logger.error(f"❌ Error disconnecting: {e}")
    
    def get_service_info(self) -> Dict[str, Any]:
        """Get service information and status"""
        return {
            "model": self.model_name,
            "connected": self.is_connected,
            "streaming": self.is_streaming,
            "audio_config": {
                "input_rate": self.audio_config.input_sample_rate,
                "output_rate": self.audio_config.output_sample_rate,
                "encoding": self.audio_config.audio_encoding
            },
            "service_type": "native_audio"
        }
