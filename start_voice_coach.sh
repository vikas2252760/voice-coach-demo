#!/bin/bash

# Voice Coach Server Startup Script
# Run this from the voice-coach-demo directory

echo "🎵 Starting Native Audio Voice Coach Server..."
echo "============================================="

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIPECAT_DIR="$SCRIPT_DIR/pipecat-server"

# Check if pipecat-server directory exists
if [ ! -d "$PIPECAT_DIR" ]; then
    echo "❌ Error: pipecat-server directory not found"
    echo "💡 Please run this script from the voice-coach-demo directory"
    exit 1
fi

# Navigate to pipecat-server directory
cd "$PIPECAT_DIR" || exit 1

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found"
    echo "💡 Run: cd pipecat-server && ./setup_env.sh"
    exit 1
fi

# Check if server is already running
if pgrep -f "voice_coach_server_native.py" > /dev/null; then
    echo "⚠️ Voice Coach server is already running!"
    echo "🔍 Process: $(pgrep -f voice_coach_server_native.py)"
    echo "🛑 To stop: pkill -f voice_coach_server_native.py"
    exit 0
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️ .env file not found"
    echo "📋 Please add your GEMINI_API_KEY to .env file"
    exit 1
fi

# Load environment variables
source .env

# Check API key
if [ -z "$GEMINI_API_KEY" ]; then
    echo "❌ GEMINI_API_KEY not configured"
    echo "💡 Please add your Gemini API key to .env file"
    exit 1
fi

# Start the server
echo "🚀 Starting Native Audio Voice Coach Server..."
echo "🌐 Server will run on: ws://localhost:8080"
echo "🛑 Press Ctrl+C to stop"
echo ""

python voice_coach_server_native.py
