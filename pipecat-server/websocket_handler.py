#!/usr/bin/env python3

"""
WebSocket handler for Voice Coach Server
Manages WebSocket connections and message processing
"""

import asyncio
import json
import logging
import websockets
from datetime import datetime
from typing import Dict, Set
from gemini_service import GeminiService

logger = logging.getLogger(__name__)

class WebSocketHandler:
    """Handles WebSocket connections and message routing"""
    
    def __init__(self):
        self.active_sessions: Dict[str, dict] = {}
        self.gemini_service = GeminiService()
        
    def generate_client_id(self, websocket) -> str:
        """Generate unique client ID"""
        return f"client_{id(websocket)}"
    
    async def handle_client(self, websocket, path):
        """Handle new client connection"""
        client_id = self.generate_client_id(websocket)
        
        # Register client
        self.active_sessions[client_id] = {
            'websocket': websocket,
            'connected_at': datetime.now(),
            'message_count': 0
        }
        
        logger.info(f"🎤 New Voice Coach session: {client_id}")
        
        try:
            # Send welcome message
            await self.send_message(websocket, {
                'type': 'connection',
                'message': 'Connected to Voice Coach Server',
                'client_id': client_id,
                'timestamp': datetime.now().isoformat()
            })
            
            # Handle messages
            async for message in websocket:
                await self.handle_message(websocket, client_id, message)
                
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"Client {client_id} disconnected")
        except Exception as e:
            logger.error(f"Error handling client {client_id}: {e}")
        finally:
            await self.cleanup_session(client_id)
    
    async def handle_message(self, websocket, client_id: str, message: str):
        """Process incoming WebSocket message"""
        try:
            data = json.loads(message)
            message_type = data.get('type', 'unknown')
            
            # Update session stats
            if client_id in self.active_sessions:
                self.active_sessions[client_id]['message_count'] += 1
            
            logger.debug(f"📨 Message from {client_id}: {message_type}")
            
            # Route message based on type
            if message_type == 'voice_data':
                await self.handle_voice_data(websocket, client_id, data)
            elif message_type == 'ping':
                await self.handle_ping(websocket, client_id)
            else:
                logger.warning(f"Unknown message type: {message_type}")
                
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON from {client_id}: {message[:100]}")
            await self.send_error(websocket, "Invalid message format")
        except Exception as e:
            logger.error(f"Error processing message from {client_id}: {e}")
            await self.send_error(websocket, "Message processing failed")
    
    async def handle_voice_data(self, websocket, client_id: str, data: dict):
        """Handle voice data and generate AI response"""
        try:
            # Extract transcribed text
            transcribed_text = (
                data.get('transcribedText') or 
                data.get('text') or 
                data.get('transcription') or
                'User provided voice input for coaching analysis'
            ).strip()
            
            logger.info(f"🎙️ Processing audio from {client_id}: {transcribed_text[:50]}...")
            logger.info(f"📝 Received transcription: '{transcribed_text}'")
            
            # Generate AI response
            if transcribed_text:
                ai_response = await self.gemini_service.generate_response(transcribed_text)
                
                # Send text feedback
                await self.send_message(websocket, {
                    'type': 'textFeedback',
                    'message': ai_response,
                    'timestamp': datetime.now().isoformat(),
                    'source': 'ai_coach'
                })
                logger.info(f"✅ Text response sent to {client_id}")
                
                # Send audio response
                await self.send_message(websocket, {
                    'type': 'audioResponse',
                    'message': ai_response,
                    'timestamp': datetime.now().isoformat(),
                    'source': 'ai_coach_audio'
                })
                logger.info(f"🔊 Audio response sent to {client_id}")
                
        except Exception as e:
            logger.error(f"Error processing voice data from {client_id}: {e}")
            await self.send_error(websocket, "Voice processing failed")
    
    async def handle_ping(self, websocket, client_id: str):
        """Handle ping message"""
        await self.send_message(websocket, {
            'type': 'pong',
            'timestamp': datetime.now().isoformat()
        })
        logger.debug(f"🏓 Pong sent to {client_id}")
    
    async def send_message(self, websocket, data: dict):
        """Send message to websocket client"""
        try:
            await websocket.send(json.dumps(data))
        except Exception as e:
            logger.error(f"Failed to send message: {e}")
    
    async def send_error(self, websocket, error_message: str):
        """Send error message to client"""
        await self.send_message(websocket, {
            'type': 'error',
            'message': error_message,
            'timestamp': datetime.now().isoformat()
        })
    
    async def cleanup_session(self, client_id: str):
        """Clean up client session"""
        if client_id in self.active_sessions:
            session_info = self.active_sessions[client_id]
            duration = datetime.now() - session_info['connected_at']
            
            logger.info(f"🧹 Cleaned up session {client_id} "
                       f"(duration: {duration.total_seconds():.1f}s, "
                       f"messages: {session_info['message_count']})")
            
            del self.active_sessions[client_id]
    
    def get_server_stats(self) -> dict:
        """Get server statistics"""
        return {
            'active_sessions': len(self.active_sessions),
            'total_messages': sum(s['message_count'] for s in self.active_sessions.values()),
            'gemini_model': self.gemini_service.get_model_info()
        }
