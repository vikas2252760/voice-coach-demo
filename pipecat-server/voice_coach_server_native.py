#!/usr/bin/env python3

"""
Native Audio Voice Coach Server
Main server using Google's Gemini 2.5 Flash Native Audio model for real-time voice coaching
"""

import asyncio
import logging
import sys
import signal
import websockets
from datetime import datetime, timedelta
from pathlib import Path

from config import Config
from websocket_handler_native import NativeAudioWebSocketHandler

# Configure logging
logging.basicConfig(
    format=f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] %(levelname)s %(message)s",
    level=getattr(logging, Config.LOG_LEVEL),
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("voice_coach_native.log")
    ]
)
logger = logging.getLogger(__name__)

class NativeAudioVoiceCoachServer:
    """Main Native Audio Voice Coach Server class"""
    
    def __init__(self):
        # Validate configuration
        Config.validate()
        self.handler = NativeAudioWebSocketHandler()
        self._server = None
        self._shutdown_event = asyncio.Event()
        self._last_stats_time = datetime.now()
        
        logger.info("🎵 Native Audio Voice Coach Server initialized")
        logger.info(f"🤖 Using model: gemini-2.5-flash-native-audio-preview-09-2025")
    
    async def start_server(self):
        """Start the Native Audio WebSocket server"""
        try:
            logger.info("🚀 Starting Native Audio Voice Coach Server...")
            logger.info(f"🌐 WebSocket endpoint: ws://{Config.HOST}:{Config.PORT}")
            logger.info("🎵 Ready for native audio voice coaching sessions!")
            
            # Setup graceful shutdown handlers
            self._setup_signal_handlers()
            
            # Create WebSocket server handler that accepts any number of arguments
            async def websocket_handler(*args, **kwargs):
                # Handle both old (websocket, path) and new (websocket) signatures
                websocket = args[0] if args else None
                path = args[1] if len(args) > 1 else kwargs.get('path', '/')
                
                if websocket:
                    await self.handler.handle_client(websocket, path)
            
            self._server = await websockets.serve(
                websocket_handler,
                Config.HOST,
                Config.PORT,
                ping_interval=30,
                ping_timeout=10,
                max_size=10**7,  # 10MB for audio data
                compression=None  # Disable compression for audio
            )
            
            logger.info(f"✅ Native Audio Voice Coach Server running on ws://{Config.HOST}:{Config.PORT}")
            
            # Print startup banner
            self._print_startup_banner()
            
            # Main server loop
            try:
                await self._run_server_loop()
            except asyncio.CancelledError:
                logger.info("🛑 Server shutdown requested")
                
        except Exception as e:
            logger.error(f"❌ Server failed to start: {e}")
            raise
        finally:
            await self._cleanup_server()
    
    def _setup_signal_handlers(self):
        """Setup graceful shutdown signal handlers"""
        def signal_handler(signum, frame):
            logger.info(f"🛑 Received signal {signum}, initiating graceful shutdown...")
            self._shutdown_event.set()
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
    
    
    async def _run_server_loop(self):
        """Main server loop with monitoring and stats"""
        stats_interval = 300  # 5 minutes
        health_check_interval = 60  # 1 minute
        
        while not self._shutdown_event.is_set():
            try:
                # Wait for shutdown or timeout
                await asyncio.wait_for(
                    self._shutdown_event.wait(),
                    timeout=health_check_interval
                )
                break  # Shutdown requested
                
            except asyncio.TimeoutError:
                # Regular health check and stats
                await self._perform_health_check()
                
                # Log stats periodically
                if datetime.now() - self._last_stats_time > timedelta(seconds=stats_interval):
                    self._log_server_stats()
                    self._last_stats_time = datetime.now()
    
    async def _perform_health_check(self):
        """Perform server health check"""
        try:
            stats = self.handler.get_server_stats()
            active_clients = stats.get("active_clients", 0)
            
            # Log activity if there are active clients
            if active_clients > 0:
                logger.info(f"💚 Health check: {active_clients} active clients, last activity: {stats.get('last_activity', 'unknown')}")
            
            # Check for stuck connections (no activity for 30+ minutes)
            # This would be implemented based on client session tracking
            
        except Exception as e:
            logger.error(f"❌ Health check error: {e}")
    
    def _log_server_stats(self):
        """Log comprehensive server statistics"""
        try:
            stats = self.handler.get_server_stats()
            
            logger.info("📊 === Native Audio Voice Coach Server Stats ===")
            logger.info(f"   🔌 Active Clients: {stats.get('active_clients', 0)}")
            logger.info(f"   📈 Total Connections: {stats.get('total_connections', 0)}")
            logger.info(f"   🎵 Audio Messages Processed: {stats.get('total_audio_messages', 0)}")
            logger.info(f"   🤖 AI Coaching Responses: {stats.get('total_coaching_responses', 0)}")
            logger.info(f"   ⏱️  Uptime: {stats.get('uptime_human', 'unknown')}")
            logger.info(f"   🔧 Model: {stats.get('model', 'unknown')}")
            logger.info("📊 ============================================")
            
        except Exception as e:
            logger.error(f"❌ Stats logging error: {e}")
    
    def _print_startup_banner(self):
        """Print informative startup banner"""
        banner = f"""
🎵 ========================================
   Native Audio Voice Coach Server
🎵 ========================================

🚀 Server Status: RUNNING
🌐 WebSocket URL: ws://{Config.HOST}:{Config.PORT}
🤖 AI Model: gemini-2.5-flash-native-audio-preview-09-2025
🎧 Audio Support: Real-time Native Audio Processing
📊 Monitoring: Enabled

🎯 Features:
   • Real-time audio processing
   • Voice coaching with AI feedback  
   • Audio responses from AI coach
   • Session management and stats
   • WebSocket-based communication

🔧 Usage:
   1. Connect frontend to ws://{Config.HOST}:{Config.PORT}
   2. Send voice_data messages with audio + transcription
   3. Receive textFeedback with coaching insights
   4. Optional: Receive audioResponse with AI voice

📝 Logs: voice_coach_native.log
🛑 Stop: Ctrl+C for graceful shutdown

🎵 Ready for voice coaching sessions!
========================================
        """
        print(banner)
    
    async def _cleanup_server(self):
        """Clean up server resources"""
        try:
            logger.info("🧹 Cleaning up server resources...")
            
            if self._server:
                self._server.close()
                await self._server.wait_closed()
                logger.info("✅ WebSocket server closed")
            
            # Broadcast shutdown to all clients
            if hasattr(self.handler, 'broadcast_message'):
                try:
                    await self.handler.broadcast_message("serverShutdown", {
                        "message": "🛑 Server shutting down gracefully",
                        "reason": "maintenance",
                        "timestamp": datetime.now().isoformat()
                    })
                except Exception as e:
                    logger.warning(f"⚠️ Failed to broadcast shutdown: {e}")
            
            logger.info("✅ Server cleanup completed")
            
        except Exception as e:
            logger.error(f"❌ Server cleanup error: {e}")

def validate_environment():
    """Validate environment and dependencies"""
    try:
        # Check required environment variables
        if not Config.GEMINI_API_KEY:
            logger.error("❌ GEMINI_API_KEY not configured")
            print("❌ Missing GEMINI_API_KEY environment variable")
            print("📋 Setup instructions:")
            print("   1. Copy env-template.txt to .env")
            print("   2. Add your Gemini API key to .env")
            print("   3. Run: source .env")
            return False
        
        # Check if port is available (basic check)
        import socket
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            result = s.connect_ex((Config.HOST, Config.PORT))
            if result == 0:
                logger.error(f"❌ Port {Config.PORT} is already in use")
                print(f"❌ Port {Config.PORT} is already in use")
                print("💡 Try using a different port or stop the existing service")
                return False
        
        # Check log file permissions
        try:
            log_path = Path("voice_coach_native.log")
            log_path.touch(exist_ok=True)
        except PermissionError:
            logger.warning("⚠️ Cannot create log file, using console only")
        
        logger.info("✅ Environment validation passed")
        return True
        
    except Exception as e:
        logger.error(f"❌ Environment validation failed: {e}")
        return False

async def main():
    """Main function to start the Native Audio Voice Coach Server"""
    print("🎵 Initializing Native Audio Voice Coach Server...")
    print("=" * 60)
    
    # Validate environment first
    if not validate_environment():
        sys.exit(1)
    
    try:
        server = NativeAudioVoiceCoachServer()
        await server.start_server()
        
    except KeyboardInterrupt:
        logger.info("🛑 Server stopped by user (Ctrl+C)")
        print("\n🎵 Voice Coach Server stopped gracefully. Thanks for using Native Audio!")
        
    except Exception as e:
        logger.error(f"❌ Server failed: {e}")
        print(f"\n❌ Failed to start Voice Coach Server: {e}")
        print("\n🔧 Troubleshooting:")
        print("   • Check your .env file has GEMINI_API_KEY")
        print("   • Ensure port 8080 is available")
        print("   • Check logs: voice_coach_native.log")
        print("   • Verify network connectivity")
        sys.exit(1)

if __name__ == "__main__":
    print("🎵 Starting Native Audio Voice Coach Server...")
    
    try:
        # Use asyncio.run with proper error handling
        asyncio.run(main())
        
    except KeyboardInterrupt:
        # Final fallback for any KeyboardInterrupt that escapes asyncio.run
        print("\n🎵 Voice Coach Server stopped. Thanks for using Native Audio!")
        sys.exit(0)
        
    except Exception as e:
        print(f"\n❌ Critical server error: {e}")
        sys.exit(1)
