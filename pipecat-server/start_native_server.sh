#!/bin/bash

# Start Native Audio Voice Coach Server
# Uses Gemini 2.5 Flash Native Audio model for real-time voice coaching

echo "🎵 Starting Native Audio Voice Coach Server..."
echo "============================================="

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found"
    echo "💡 Run ./setup_env.sh first to create the environment"
    exit 1
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️ .env file not found"
    echo "📋 Creating .env from template..."
    cp env-template.txt .env
    echo "✏️ Please edit .env file and add your GEMINI_API_KEY"
    echo "   Then run this script again"
    exit 1
fi

# Load environment variables
echo "📋 Loading environment variables..."
source .env

# Check API key
if [ -z "$GEMINI_API_KEY" ]; then
    echo "❌ GEMINI_API_KEY not configured in .env file"
    echo "💡 Please add your Gemini API key to .env file"
    echo "   GEMINI_API_KEY=your_api_key_here"
    exit 1
fi

# Install/update dependencies
echo "📦 Installing dependencies..."
pip install -q -r requirements.txt

# Check dependencies
echo "🔍 Checking critical dependencies..."
python -c "
import google.generativeai as genai
import websockets
import librosa
import soundfile
print('✅ All critical dependencies installed')
" 2>/dev/null || {
    echo "❌ Missing dependencies. Installing..."
    pip install google-generativeai websockets librosa soundfile
}

# Create log directory if it doesn't exist
mkdir -p logs

echo ""
echo "🎵 Starting Native Audio Voice Coach Server..."
echo "🤖 Model: gemini-2.5-flash-native-audio-preview-09-2025"
echo "🌐 WebSocket: ws://localhost:8080"
echo "📝 Logs: voice_coach_native.log"
echo ""
echo "🛑 Press Ctrl+C to stop the server"
echo "============================================="

# Start the native audio server
python voice_coach_server_native.py
