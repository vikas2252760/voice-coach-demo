#!/usr/bin/env python3

"""
Pipecat Voice Coach Server
Refactored for better maintainability and separation of concerns
"""

import asyncio
import logging
import sys
import websockets
from datetime import datetime, timedelta

from config import Config
from websocket_handler import WebSocketHandler

# Configure logging
logging.basicConfig(
    format=f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] %(levelname)s %(message)s",
    level=getattr(logging, Config.LOG_LEVEL)
)
logger = logging.getLogger(__name__)


class VoiceCoachServer:
    """Main Voice Coach Server class"""
    
    def __init__(self):
        # Validate configuration
        Config.validate()
        self.handler = WebSocketHandler()
        self._last_stats_time = datetime.now()
        logger.info("🎯 Voice Coach Server initialized")
    
    async def start_server(self):
        """Start the WebSocket server"""
        try:
            logger.info("🎯 Starting Pipecat Voice Coach Server...")
            logger.info(f"🌐 WebSocket endpoint: ws://{Config.HOST}:{Config.PORT}")
            logger.info("🎤 Ready for voice coaching sessions!")
            
            # Create wrapper function for websocket handler  
            async def websocket_handler(websocket, *args):
                path = args[0] if args else "/"
                await self.handler.handle_client(websocket, path)
            
            # Start WebSocket server
            async with websockets.serve(
                websocket_handler,
                Config.HOST,
                Config.PORT,
                ping_interval=30,
                ping_timeout=10
            ) as server:
                logger.info(f"✅ Voice Coach Server running on ws://{Config.HOST}:{Config.PORT}")
                
                # Keep server running with graceful shutdown support
                try:
                    while True:
                        await asyncio.sleep(60)  # Check every minute
                        
                        # Log stats periodically
                        if datetime.now() - self._last_stats_time > timedelta(minutes=5):
                            self._log_stats()
                            
                except asyncio.CancelledError:
                    logger.info("🛑 Server shutdown requested")
                    return  # Return instead of re-raising
                        
        except Exception as e:
            logger.error(f"❌ Server failed to start: {e}")
            raise
    
    def _log_stats(self):
        """Log server statistics"""
        stats = self.handler.get_server_stats()
        logger.info(f"📊 Server stats: {stats}")
        self._last_stats_time = datetime.now()


async def main():
    """Main function to start the Voice Coach Server"""
    try:
        server = VoiceCoachServer()
        await server.start_server()
    except (KeyboardInterrupt, asyncio.CancelledError):
        logger.info("🛑 Server stopped by user")
        print("\n🎯 Voice Coach Server stopped. Thanks for using Pipecat!")
    except Exception as e:
        logger.error(f"❌ Server failed: {e}")
        print(f"\n❌ Failed to start Voice Coach Server: {e}")
        sys.exit(1)


if __name__ == "__main__":
    print("🎯 Starting Pipecat Voice Coach Server...")
    print("=" * 50)
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        # Final fallback for any KeyboardInterrupt that escapes asyncio.run
        print("\n🎯 Voice Coach Server stopped. Thanks for using Pipecat!")
        sys.exit(0)
    