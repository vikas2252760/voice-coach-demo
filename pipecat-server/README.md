# 🎯 Pipecat Voice Coach Server

A WebSocket-based voice coaching server powered by Google's Gemini AI for real-time sales pitch training and communication skills development.

## 🚀 Quick Start

### 1. Setup Environment
```bash
./setup_env.sh
```

### 2. Configure API Key
```bash
cp env-template.txt .env
# Edit .env and add your Gemini API key
```

### 3. Start Server
```bash
./start_server.sh
```

The server will be available at `ws://localhost:8080`

## 📁 Directory Structure

```
pipecat-server/
├── voice_coach_server.py    # Main server application
├── config.py               # Configuration management
├── gemini_service.py       # Gemini AI integration
├── websocket_handler.py    # WebSocket connection handling
├── requirements.txt        # Python dependencies
├── setup_env.sh           # Environment setup script
├── start_server.sh        # Server startup script
├── env-template.txt       # Environment variables template
├── tests/                 # Test files and utilities
│   └── simple_websocket_server.py  # Fallback test server
└── venv/                  # Python virtual environment
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GEMINI_API_KEY` | **Required** - Your Gemini API key | - |
| `VOICE_COACH_HOST` | Server host address | `localhost` |
| `VOICE_COACH_PORT` | Server port | `8080` |
| `GEMINI_MODEL` | Gemini model to use | `gemini-1.5-flash` |
| `GEMINI_VOICE` | Voice for TTS | `Puck` |
| `LOG_LEVEL` | Logging level | `INFO` |

### Getting API Keys

1. **Gemini API Key**: Visit [https://ai.google.dev/](https://ai.google.dev/)
   - Sign up/Login to Google AI Studio
   - Create a new API key
   - Copy the key to your `.env` file

## 🎤 Features

- **Real-time Voice Processing**: WebSocket-based communication
- **AI-Powered Coaching**: Gemini AI provides intelligent feedback
- **Quota Management**: Automatic fallback when API limits are reached
- **Enhanced Mock Responses**: Realistic coaching feedback in demo mode
- **Graceful Shutdown**: Clean server termination with Ctrl+C
- **Error Handling**: Robust exception management and logging

## 🛠️ Development

### Manual Setup
```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp env-template.txt .env
# Edit .env with your API keys

# Run server
python3 voice_coach_server.py
```

### Testing
```bash
# Run the simple test server (for development)
python3 tests/simple_websocket_server.py
```

## 📊 API Quota Optimization

The server automatically uses quota-efficient settings:
- Prefers Gemini Flash models (lower cost)
- Limits response length to 150 tokens
- Optimized generation parameters
- Intelligent fallback responses

## 🔧 Troubleshooting

### Common Issues

1. **"ModuleNotFoundError"**
   - Run `./setup_env.sh` to install dependencies

2. **"GEMINI_API_KEY not configured"**
   - Copy `env-template.txt` to `.env`
   - Add your Gemini API key

3. **"Quota exceeded" errors**
   - The server will automatically use mock responses
   - Wait for quota reset or upgrade your Gemini plan

4. **Connection refused**
   - Check if port 8080 is available
   - Modify `VOICE_COACH_PORT` in `.env` if needed

### Logs
Server logs provide detailed information about:
- API usage and quota status
- WebSocket connections
- Error details and fallback usage

## 📝 License

Part of the Voice Coach Demo project.
