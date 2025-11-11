#!/usr/bin/env python3

"""
Native Audio WebSocket Handler for Voice Coach
Handles real-time audio streaming with Gemini 2.5 Flash Native Audio model
"""

import asyncio
import json
import logging
import base64
import time
from datetime import datetime
from typing import Dict, Any, Optional, Set
import websockets

from gemini_native_audio_service import GeminiNativeAudioService

logger = logging.getLogger(__name__)

class NativeAudioWebSocketHandler:
    """WebSocket handler for native audio streaming and voice coaching"""
    
    def __init__(self):
        self.gemini_service = GeminiNativeAudioService()
        self.gemini_connected = False  # Track Gemini connection state
        self.active_clients: Set[websockets.WebSocketServerProtocol] = set()
        self.client_sessions: Dict[str, Dict[str, Any]] = {}
        self.server_stats = {
            "total_connections": 0,
            "active_sessions": 0,
            "total_audio_messages": 0,
            "total_coaching_responses": 0,
            "start_time": datetime.now(),
            "last_activity": datetime.now()
        }
        logger.info("🎵 Native Audio WebSocket Handler initialized")
    
    async def handle_client(self, websocket: websockets.WebSocketServerProtocol, path: str):
        """Handle individual client connections"""
        client_id = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}_{int(time.time())}"
        logger.info(f"🔌 New client connected: {client_id}")
        
        # Add to active clients
        self.active_clients.add(websocket)
        self.server_stats["total_connections"] += 1
        self.server_stats["active_sessions"] = len(self.active_clients)
        
        # Initialize client session
        self.client_sessions[client_id] = {
            "websocket": websocket,
            "connected_at": datetime.now(),
            "message_count": 0,
            "audio_messages": 0,
            "coaching_responses": 0,
            "last_activity": datetime.now()
        }
        
        try:
            # Connect to Gemini Native Audio API only if not already connected
            if not self.gemini_connected:
                logger.info(f"🔌 Connecting to Gemini API for first client: {client_id}")
                connected = await self.gemini_service.connect()
                if not connected:
                    await self._send_error(websocket, "Failed to connect to Gemini Native Audio API")
                    return
                self.gemini_connected = True
                logger.info("✅ Gemini API connection established and will be reused")
            else:
                logger.info(f"♻️ Reusing existing Gemini connection for client: {client_id}")
            
            # Send connection confirmation
            await self._send_message(websocket, "connected", {
                "status": "connected", 
                "message": "🎵 Connected to Native Audio Voice Coach!",
                "client_id": client_id,
                "model": self.gemini_service.model_name,
                "audio_config": self.gemini_service.get_service_info()["audio_config"]
            })
            
            # Handle messages
            async for message in websocket:
                try:
                    await self._handle_message(websocket, client_id, message)
                except Exception as e:
                    logger.error(f"❌ Error handling message from {client_id}: {e}")
                    await self._send_error(websocket, f"Message processing error: {str(e)}")
                    
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"🔌 Client {client_id} disconnected normally")
        except Exception as e:
            logger.error(f"❌ Client {client_id} error: {e}")
            await self._send_error(websocket, f"Connection error: {str(e)}")
        finally:
            # Cleanup
            await self._cleanup_client(websocket, client_id)
    
    async def _handle_message(self, websocket: websockets.WebSocketServerProtocol, client_id: str, message: str):
        """Handle incoming WebSocket messages"""
        try:
            data = json.loads(message)
            message_type = data.get("type", "unknown")
            
            logger.info(f"📥 Received {message_type} from {client_id}")
            
            # Update session activity
            if client_id in self.client_sessions:
                self.client_sessions[client_id]["last_activity"] = datetime.now()
                self.client_sessions[client_id]["message_count"] += 1
            
            self.server_stats["last_activity"] = datetime.now()
            
            # Route message based on type
            if message_type == "voice_data":
                await self._handle_voice_data(websocket, client_id, data)
            elif message_type == "start_pitch_session":
                await self._handle_session_start(websocket, client_id, data)
            elif message_type == "audio_stream":
                await self._handle_audio_stream(websocket, client_id, data)
            elif message_type == "ping":
                await self._send_message(websocket, "pong", {"timestamp": time.time()})
            else:
                logger.warning(f"⚠️ Unknown message type: {message_type}")
                await self._send_error(websocket, f"Unknown message type: {message_type}")
                
        except json.JSONDecodeError:
            logger.error(f"❌ Invalid JSON from {client_id}")
            await self._send_error(websocket, "Invalid JSON format")
        except Exception as e:
            logger.error(f"❌ Message handling error: {e}")
            await self._send_error(websocket, f"Processing error: {str(e)}")
    
    async def _handle_voice_data(self, websocket: websockets.WebSocketServerProtocol, client_id: str, data: Dict[str, Any]):
        """Handle voice data for coaching analysis"""
        try:
            # Extract voice data
            audio_base64 = data.get("audio")
            transcribed_text = data.get("transcribedText", "").strip()
            customer = data.get("customer", {})
            scenario = data.get("scenario", {})
            
            if not transcribed_text and not audio_base64:
                await self._send_error(websocket, "No audio or transcription provided")
                return
            
            # Update stats
            if client_id in self.client_sessions:
                self.client_sessions[client_id]["audio_messages"] += 1
            self.server_stats["total_audio_messages"] += 1
            
            logger.info(f"🎵 Processing voice data: transcript='{transcribed_text[:50]}...', audio={len(audio_base64) if audio_base64 else 0} chars")
            
            # Send immediate acknowledgment
            await self._send_message(websocket, "processingStarted", {
                "message": "🎵 Analyzing your voice with Native Audio AI...",
                "transcript": transcribed_text
            })
            
            # Build context for AI
            context = {
                "customer": customer,
                "scenario": scenario,
                "client_id": client_id,
                "messageCount": self.client_sessions.get(client_id, {}).get("audio_messages", 0)
            }
            
            # Process with Gemini Native Audio
            if audio_base64:
                # Full audio + text analysis
                response = await self.gemini_service.process_audio_message(
                    audio_base64, transcribed_text, context
                )
            else:
                # Text-only analysis (fallback)
                response = await self.gemini_service.send_text_message(transcribed_text, audio_context=None)
                response = {
                    "message": response.get("text", "Thanks for your message!"),
                    "score": 75,
                    "improvements": ["Continue practicing to improve clarity"],
                    "achievements": ["Message successfully processed"],
                    "hasAudioResponse": response.get("hasAudio", False),
                    "audioResponse": response.get("audioData")
                }
            
            # Handle errors
            if "error" in response:
                logger.error(f"❌ Gemini processing error: {response['error']}")
                await self._send_error(websocket, f"AI processing failed: {response['error']}")
                return
            
            # Update stats
            if client_id in self.client_sessions:
                self.client_sessions[client_id]["coaching_responses"] += 1
            self.server_stats["total_coaching_responses"] += 1
            
            # Send coaching feedback
            feedback_data = {
                "message": response.get("message", "Great work! Keep practicing your pitch."),
                "score": response.get("score", 75),
                "improvements": response.get("improvements", []),
                "achievements": response.get("achievements", []),
                "progressPercent": response.get("progressPercent"),
                "model": response.get("model", self.gemini_service.model_name),
                "processingTime": response.get("processingTime", time.time()),
                "hasAudioResponse": response.get("hasAudioResponse", False)
            }
            
            await self._send_message(websocket, "textFeedback", feedback_data)
            logger.info(f"✅ Sent coaching feedback to {client_id} - Score: {feedback_data['score']}")
            
            # Send audio response if available
            if response.get("hasAudioResponse") and response.get("audioResponse"):
                await self._send_audio_response(websocket, response["audioResponse"])
            
        except Exception as e:
            logger.error(f"❌ Voice data processing error: {e}")
            await self._send_error(websocket, f"Voice processing failed: {str(e)}")
    
    async def _handle_audio_stream(self, websocket: websockets.WebSocketServerProtocol, client_id: str, data: Dict[str, Any]):
        """Handle real-time audio streaming (future enhancement)"""
        try:
            audio_chunk = data.get("chunk")
            is_final = data.get("final", False)
            
            if not audio_chunk:
                return
            
            # Decode and send to Gemini for real-time processing
            audio_bytes = base64.b64decode(audio_chunk)
            response = await self.gemini_service.send_audio_chunk(audio_bytes, is_final)
            
            if "error" in response:
                await self._send_error(websocket, response["error"])
                return
            
            # Send real-time response if available
            if is_final and "text" in response:
                await self._send_message(websocket, "streamResponse", {
                    "text": response["text"],
                    "hasAudio": response.get("hasAudio", False),
                    "final": True
                })
                
        except Exception as e:
            logger.error(f"❌ Audio stream processing error: {e}")
            await self._send_error(websocket, f"Stream processing failed: {str(e)}")
    
    async def _handle_session_start(self, websocket: websockets.WebSocketServerProtocol, client_id: str, data: Dict[str, Any]):
        """Handle session start requests"""
        try:
            customer = data.get("customer", {})
            scenario = data.get("scenario", {})
            
            # Send session started confirmation
            await self._send_message(websocket, "sessionStarted", {
                "message": f"🎵 Native Audio Voice Coach session started!",
                "customer": customer.get("name", "Unknown"),
                "scenario": scenario.get("title", "Voice Coaching"),
                "model": self.gemini_service.model_name,
                "ready": True
            })
            
            logger.info(f"✅ Session started for {client_id}")
            
        except Exception as e:
            logger.error(f"❌ Session start error: {e}")
            await self._send_error(websocket, f"Session start failed: {str(e)}")
    
    async def _send_audio_response(self, websocket: websockets.WebSocketServerProtocol, audio_data: bytes):
        """Send audio response to client"""
        try:
            # Convert audio to base64 for transmission
            audio_base64 = base64.b64encode(audio_data).decode('utf-8')
            
            await self._send_message(websocket, "audioResponse", {
                "audioData": audio_base64,
                "mimeType": "audio/pcm;rate=24000",
                "sampleRate": 24000,
                "channels": 1,
                "size": len(audio_data)
            })
            
            logger.info(f"🔊 Sent audio response: {len(audio_data)} bytes")
            
        except Exception as e:
            logger.error(f"❌ Failed to send audio response: {e}")
    
    async def _send_message(self, websocket: websockets.WebSocketServerProtocol, message_type: str, data: Dict[str, Any]):
        """Send structured message to client"""
        try:
            message = {
                "type": message_type,
                "timestamp": datetime.now().isoformat(),
                "data": data
            }
            
            await websocket.send(json.dumps(message))
            
        except websockets.exceptions.ConnectionClosed:
            logger.debug("Client disconnected during message send")
        except Exception as e:
            logger.error(f"❌ Failed to send message: {e}")
    
    async def _send_error(self, websocket: websockets.WebSocketServerProtocol, error_message: str):
        """Send error message to client"""
        await self._send_message(websocket, "error", {
            "message": error_message,
            "severity": "error"
        })
    
    async def _cleanup_client(self, websocket: websockets.WebSocketServerProtocol, client_id: str):
        """Clean up client connection"""
        try:
            # Remove from active clients
            if websocket in self.active_clients:
                self.active_clients.remove(websocket)
            
            # Remove session data
            if client_id in self.client_sessions:
                session = self.client_sessions[client_id]
                logger.info(f"📊 Client {client_id} session stats: {session['message_count']} messages, {session['audio_messages']} audio")
                del self.client_sessions[client_id]
            
            # Update server stats
            self.server_stats["active_sessions"] = len(self.active_clients)
            
            # Only disconnect Gemini when no more clients are connected
            if len(self.active_clients) == 0 and self.gemini_connected:
                logger.info("🔌 Last client disconnected, closing Gemini connection")
                await self.gemini_service.disconnect()
                self.gemini_connected = False
            elif self.gemini_connected:
                logger.info(f"♻️ Keeping Gemini connection alive for {len(self.active_clients)} remaining clients")
            
            logger.info(f"🧹 Cleaned up client {client_id}")
            
        except Exception as e:
            logger.error(f"❌ Cleanup error: {e}")
    
    def get_server_stats(self) -> Dict[str, Any]:
        """Get comprehensive server statistics"""
        uptime = datetime.now() - self.server_stats["start_time"]
        
        return {
            "active_clients": len(self.active_clients),
            "total_connections": self.server_stats["total_connections"],
            "total_audio_messages": self.server_stats["total_audio_messages"],
            "total_coaching_responses": self.server_stats["total_coaching_responses"],
            "uptime_seconds": int(uptime.total_seconds()),
            "uptime_human": str(uptime),
            "last_activity": self.server_stats["last_activity"].isoformat(),
            "model": self.gemini_service.model_name,
            "service_type": "native_audio"
        }
    
    async def broadcast_message(self, message_type: str, data: Dict[str, Any]):
        """Broadcast message to all connected clients"""
        if not self.active_clients:
            return
        
        message = {
            "type": message_type,
            "timestamp": datetime.now().isoformat(),
            "data": data
        }
        
        # Send to all active clients
        disconnected = []
        for client in self.active_clients:
            try:
                await client.send(json.dumps(message))
            except websockets.exceptions.ConnectionClosed:
                disconnected.append(client)
            except Exception as e:
                logger.error(f"❌ Broadcast error to client: {e}")
                disconnected.append(client)
        
        # Clean up disconnected clients
        for client in disconnected:
            self.active_clients.discard(client)
