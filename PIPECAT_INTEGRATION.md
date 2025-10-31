# 🎯 Pipecat Voice Coach Integration

This project now includes **real-time AI voice coaching** powered by [Pipecat](https://github.com/pipecat-ai/pipecat) - an open-source framework for building voice and multimodal AI applications.

## 🚀 Quick Start

### 1. Setup API Keys

You'll need API keys from this provider:

- **Gemini**: Get your API key at [ai.google.dev](https://ai.google.dev/)

### 2. Start the Pipecat Server

```bash
# Navigate to the pipecat server directory
cd pipecat-server

# Run the setup script (only needed once)
./setup.sh

# Edit the .env file and add your API keys
nano .env

# Start the Pipecat Voice Coach server
./start.sh
```

### 3. Start the React Frontend

```bash
# In the main project directory
npm start
```

## 🎤 How It Works

### Real-Time Voice Communication Pipeline

```
👤 User Speech → 🎙️ WebRTC → 🌐 WebSocket → 🤖 Pipecat Server
                                               ↓
📱 React Frontend ← 🔊 Audio Response ← 🎯 AI Voice Coach
```

### Key Features

1. **🎙️ Direct Audio Processing**: Gemini Live handles audio input and output natively
2. **🤖 AI Processing**: Google Gemini 2.0 Flash for intelligent coaching feedback  
3. **🔊 Natural Voice Response**: Gemini Live's built-in voice synthesis
4. **⚡ Real-Time**: WebSocket bidirectional communication with streamlined pipeline
5. **🎯 Voice Coaching**: Specialized prompts for sales pitch training

## 🔧 Architecture

### Frontend (React)
- **VoiceCoach Component**: UI for voice interaction
- **WebSocket Service**: Real-time communication with Pipecat
- **Voice Service**: Browser audio recording and playback
- **UI Kit Integration**: Professional voice visualizers and controls

### Backend (Pipecat Server)
- **WebSocket Transport**: Handles client connections
- **Gemini Live Pipeline**: Direct audio → Gemini Live → audio response
- **Voice Activity Detection**: Silero VAD for natural conversation flow
- **Simplified Architecture**: Single service handles speech recognition, AI processing, and voice synthesis
- **Context Management**: Maintains coaching conversation state

## 📡 WebSocket API

### Client → Server Messages

```javascript
// Start a coaching session
websocket.send({
  type: 'start_pitch_session',
  payload: {
    customer: customerProfile,
    scenario: pitchingScenario,
    conversation_id: 'conv_123',
    user_id: 'user_456'
  }
});

// Send voice data for analysis
websocket.send({
  type: 'voice_data',
  payload: {
    audio: base64AudioData,
    transcribedText: 'Hello, I want to pitch...',
    customer: customerProfile,
    timestamp: Date.now()
  }
});
```

### Server → Client Messages

```javascript
// AI coaching feedback
{
  type: 'textFeedback',
  message: 'Great confidence! Try slowing down slightly for better impact.',
  score: 85,
  timestamp: 1704067200000
}

// Voice response with audio
{
  type: 'voiceFeedback', 
  message: 'Excellent pitch opening!',
  audioUrl: 'data:audio/wav;base64,...',
  timestamp: 1704067200000
}
```

## 🛠️ Configuration

### Environment Variables

```bash
# Required API Keys
OPENAI_API_KEY=sk-your_openai_api_key_here
DEEPGRAM_API_KEY=your_deepgram_api_key_here

# Optional Server Settings
VOICE_COACH_HOST=localhost
VOICE_COACH_PORT=8080

# Optional AI Configuration
OPENAI_MODEL=gpt-4-turbo-preview
DEEPGRAM_STT_MODEL=nova-2
DEEPGRAM_TTS_VOICE=aura-luna-en
```

### AI Coaching Prompts

The system uses specialized prompts for voice coaching:

- **Real-time feedback** on tone, pace, and confidence
- **Constructive suggestions** for improvement
- **Performance scoring** (1-100 scale)
- **Contextual coaching** based on customer profiles and scenarios

## 🎮 Usage

### In the Voice Coach Interface:

1. **Click "Connect"** → Establishes WebSocket connection to Pipecat server
2. **Start Recording** → Your voice is processed in real-time
3. **Get AI Feedback** → Immediate coaching on your pitch performance
4. **Continue Conversation** → Back-and-forth practice with AI coach
5. **Click "Disconnect"** → Ends the coaching session

### Voice Coaching Flow:

```
🎤 Record Pitch → 🎯 AI Analysis → 📝 Written Feedback + 🔊 Voice Response
      ↓               ↓                    ↓
  WebRTC Audio    Pipecat Pipeline    Real-time Coach
```

## 🚨 Troubleshooting

### "Connection timeout - Please ensure Pipecat server is running"

**Solution**: Make sure the Pipecat server is running:

```bash
cd pipecat-server
./start.sh
```

### "OPENAI_API_KEY not configured"

**Solution**: Add your OpenAI API key to `.env`:

```bash
cd pipecat-server
echo "OPENAI_API_KEY=sk-your_actual_key_here" >> .env
```

### "Failed to connect to Pipecat Voice Coach server"

**Solution**: Check if the server is accessible:

```bash
# Test WebSocket connection
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: test" \
  -H "Sec-WebSocket-Version: 13" \
  http://localhost:8080/
```

### Audio Permission Issues

**Solution**: Ensure microphone access is granted in your browser settings.

## 📚 Learn More

- **Pipecat Framework**: [docs.pipecat.ai](https://docs.pipecat.ai)
- **Pipecat Examples**: [github.com/pipecat-ai/pipecat-examples](https://github.com/pipecat-ai/pipecat-examples)  
- **Voice UI Kit**: [github.com/pipecat-ai/voice-ui-kit](https://github.com/pipecat-ai/voice-ui-kit)
- **OpenAI API**: [platform.openai.com/docs](https://platform.openai.com/docs)
- **Deepgram API**: [developers.deepgram.com](https://developers.deepgram.com)

## 🎯 Next Steps

### Potential Enhancements:

1. **🎭 Multiple AI Coaches**: Different coaching styles and personalities
2. **📊 Advanced Analytics**: Detailed performance metrics and progress tracking
3. **🎨 Custom Scenarios**: User-defined pitching scenarios and contexts
4. **📱 Mobile Integration**: Native mobile app with Pipecat integration
5. **🌍 Multi-language Support**: International coaching in different languages
6. **🔗 CRM Integration**: Connect with Salesforce, HubSpot for real customer data

---

**🎤 Ready to experience AI-powered voice coaching? Start the Pipecat server and begin your practice session!**
