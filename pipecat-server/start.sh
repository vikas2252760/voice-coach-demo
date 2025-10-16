#!/bin/bash

# Pipecat Voice Coach Server Start Script
echo "🎯 Starting Pipecat Voice Coach Server..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Please run ./setup.sh first"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Please copy env-template.txt to .env and configure your API keys"
    exit 1
fi

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source venv/bin/activate

# Check if API keys are configured
source .env
if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "sk-your_openai_api_key_here" ]; then
    echo "❌ OPENAI_API_KEY not configured in .env file"
    exit 1
fi

if [ -z "$DEEPGRAM_API_KEY" ] || [ "$DEEPGRAM_API_KEY" = "your_deepgram_api_key_here" ]; then
    echo "❌ DEEPGRAM_API_KEY not configured in .env file"
    exit 1
fi

echo "✅ Configuration validated"
echo "🚀 Starting Voice Coach Server..."
echo "🌐 WebSocket will be available at: ws://localhost:${VOICE_COACH_PORT:-8080}"
echo "🛑 Press Ctrl+C to stop the server"
echo ""

# Start the server
python voice_coach_server.py
