#!/bin/bash

# Voice Coach Server Environment Setup Script
# This script helps set up the environment for testing the Pipecat Voice Coach Server

echo "🎯 Voice Coach Server Environment Setup"
echo "======================================="

# Check if we're in the correct directory
if [ ! -f "voice_coach_server.py" ]; then
    echo "❌ Error: Please run this script from the pipecat-server directory"
    echo "   Expected to find voice_coach_server.py in current directory"
    exit 1
fi

echo ""
echo "🔍 Checking Python environment..."

# Check Python version
python_version=$(python3 --version 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ Python found: $python_version"
else
    echo "❌ Python 3 not found. Please install Python 3.8 or higher"
    exit 1
fi

echo ""
echo "📦 Checking virtual environment..."

# Check if virtual environment exists
if [ -d "venv" ]; then
    echo "✅ Virtual environment found"
    
    # Check if it's activated
    if [ -n "$VIRTUAL_ENV" ]; then
        echo "✅ Virtual environment is activated"
    else
        echo "⚠️  Virtual environment exists but not activated"
        echo "   Run: source venv/bin/activate"
    fi
else
    echo "❌ Virtual environment not found"
    echo "   Create one with: python3 -m venv venv"
    echo "   Then activate: source venv/bin/activate"
    exit 1
fi

echo ""
echo "🔑 Checking API Keys..."

# Check for .env file
if [ -f ".env" ]; then
    echo "✅ .env file found"
    
    # Check for required API keys
    if grep -q "GEMINI_API_KEY=" .env; then
        gemini_key=$(grep "GEMINI_API_KEY=" .env | cut -d'=' -f2)
        if [ -n "$gemini_key" ] && [ "$gemini_key" != "your_gemini_api_key_here" ]; then
            echo "✅ GEMINI_API_KEY is set"
        else
            echo "❌ GEMINI_API_KEY is not properly set in .env"
        fi
    else
        echo "❌ GEMINI_API_KEY not found in .env"
    fi
    
else
    echo "❌ .env file not found"
    echo ""
    echo "Creating .env template..."
    
    cat > .env << EOF
# Pipecat Voice Coach Server Environment Variables
# Copy this file to .env and fill in your API keys

# Required: Gemini API Key for Gemini Live audio processing
# Get your API key at: https://ai.google.dev/
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: Server configuration
VOICE_COACH_HOST=localhost
VOICE_COACH_PORT=8080

# Optional: Gemini Model configuration
GEMINI_MODEL=gemini-1.5-flash
GEMINI_VOICE=Puck

# Optional: Logging level
LOG_LEVEL=INFO
EOF
    
    echo "✅ .env template created"
    echo "   Please edit .env and add your actual API keys"
fi

echo ""
echo "📋 Checking Python dependencies..."

# Check if requirements are installed
if pip show pipecat-ai >/dev/null 2>&1; then
    echo "✅ pipecat-ai is installed"
else
    echo "❌ pipecat-ai not installed"
    echo "   Install with: pip install pipecat-ai[google]"
fi

if pip show google-generativeai >/dev/null 2>&1; then
    echo "✅ google-generativeai is installed"
else
    echo "❌ google-generativeai not installed"
    echo "   Install with: pip install google-generativeai"
fi

if pip show websockets >/dev/null 2>&1; then
    echo "✅ websockets is installed"
else
    echo "❌ websockets not installed"
    echo "   Install with: pip install websockets"
fi

if pip show python-dotenv >/dev/null 2>&1; then
    echo "✅ python-dotenv is installed"
else
    echo "❌ python-dotenv not installed"
    echo "   Install with: pip install python-dotenv"
fi

echo ""
echo "🧪 Testing server startup..."

# Test if the server can start (dry run)
echo "Running server validation check..."
if python3 -c "
import sys
sys.path.append('.')
try:
    from voice_coach_server import VoiceCoachServer
    print('✅ voice_coach_server.py imports successfully')
except ImportError as e:
    print(f'❌ Import error: {e}')
    sys.exit(1)
except Exception as e:
    print(f'⚠️  Import warning: {e}')
"; then
    echo "✅ Server script is valid"
else
    echo "❌ Server script has issues"
fi

echo ""
echo "📋 Setup Summary"
echo "================="

# Provide next steps
echo "Next steps to test your Voice Coach Server:"
echo ""
echo "1. 🔑 Set up API Keys:"
echo "   - Edit .env file with your actual API keys"
echo "   - Get Gemini API key from: https://ai.google.dev/"
echo "   - Sign up for free at Google AI Studio"
echo ""
echo "2. 📦 Install dependencies:"
echo "   pip install -r requirements.txt"
echo ""
echo "3. 🚀 Start the server:"
echo "   python3 voice_coach_server.py"
echo ""
echo "4. 🌐 Start the React frontend:"
echo "   cd ../  # Go to project root"
echo "   npm start  # Start React development server"
echo ""
echo "5. 🎤 Test the voice functionality:"
echo "   - Open http://localhost:3000 in your browser"
echo "   - Click on Job Details to access Voice Coach"
echo "   - Use the microphone button to record voice"
echo "   - Get AI-powered coaching feedback"

echo ""
echo "💡 Tips:"
echo "   - Make sure microphone permissions are enabled"
echo "   - Server runs on ws://localhost:8080 by default"
echo "   - Frontend runs on http://localhost:3000"
echo "   - Check server logs for connection issues"
echo "   - Use Chrome/Edge for best audio support"
echo ""
echo "🏗️ Architecture:"
echo "   Frontend (React) ↔ WebSocket ↔ Pipecat Server ↔ Gemini AI"
echo "   Real-time audio processing with GeminiLiveLLMService"

echo ""
echo "🎯 Happy Voice Coaching! 🎤"
