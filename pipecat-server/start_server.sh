#!/bin/bash

# Pipecat Voice Coach Server Startup Script
echo "🎯 Starting Pipecat Voice Coach Server..."

# Check if we're in the correct directory
if [ ! -f "voice_coach_server.py" ]; then
    echo "❌ voice_coach_server.py not found. Make sure you're in the pipecat-server directory"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Please run: ./setup_env.sh"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Please copy env-template.txt to .env and configure your API keys"
    echo "📋 Run: cp env-template.txt .env"
    echo "✏️  Then edit .env with your Gemini API key"
    exit 1
fi

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source venv/bin/activate

# Check if Gemini API key is configured
source .env
if [ -z "$GEMINI_API_KEY" ] || [ "$GEMINI_API_KEY" = "your_gemini_api_key_here" ]; then
    echo "❌ GEMINI_API_KEY not configured in .env file"
    echo "📝 Please edit .env and set your Gemini API key from: https://ai.google.dev/"
    exit 1
fi

echo "✅ Configuration validated"
echo "🚀 Starting Voice Coach Server..."
echo "🌐 WebSocket will be available at: ws://localhost:${VOICE_COACH_PORT:-8080}"
echo "🛑 Press Ctrl+C to stop the server"
echo ""

# Start the server
python3 voice_coach_server.py
