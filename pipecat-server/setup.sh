#!/bin/bash

# Pipecat Voice Coach Server Setup Script
echo "🎯 Setting up Pipecat Voice Coach Server..."

# Create Python virtual environment
echo "📦 Creating Python virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "⬇️ Installing Pipecat and dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file from template if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cp env-template.txt .env
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env file and add your API keys:"
    echo "   - OPENAI_API_KEY=your_openai_key_here"
    echo "   - DEEPGRAM_API_KEY=your_deepgram_key_here"
    echo ""
    echo "📋 Get your API keys from:"
    echo "   - OpenAI: https://platform.openai.com/api-keys"
    echo "   - Deepgram: https://console.deepgram.com/api-keys"
    echo ""
else
    echo "✅ .env file already exists"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Edit .env file with your API keys"
echo "   2. Run: ./start.sh"
echo "   3. Your Voice Coach will be available at ws://localhost:8080"
