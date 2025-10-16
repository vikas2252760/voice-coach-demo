# Voice Coach Demo

A React application featuring an AI-powered Voice Coach for field service technicians to practice and improve their sales pitches. The app includes job details management and an intelligent conversational coaching system.

## Features

- **Job Details Page**: Shows customer appointment information, job steps, and available offers
- **AI Voice Coach**: Interactive coaching system with real-time feedback and voice analysis
- **Smart Pitch Modal**: Integrated coaching overlay with voice recording and AI feedback
- **Conversation History**: Persistent chat history with conversation management
- **Mobile-first Design**: Optimized for mobile viewing with responsive design
- **Voice Recording**: Real-time speech-to-text and voice feedback capabilities
- **Personalized Coaching**: Customer-specific goals and progressive feedback system

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn

### Installation

1. Clone or navigate to the project directory:
   ```bash
   cd ./voice-coach-demo
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Open your browser and navigate to `http://localhost:3000`

## Application Structure

### Pages

1. **Job Details Page** (`/`)
   - Customer information and appointment details
   - Job completion steps with progress tracking
   - Product offers with smart pitch integration
   - Access to AI Voice Coach modal

### Key Components

- `JobDetailsPage.js` - Main appointment and job tracking interface
- `SmartPitchModal.js` - Modal overlay for voice coaching
- `VoiceCoach.js` - Main AI coaching interface with voice recording
- `ConversationHistory.js` - Chat history management
- `conversationService.js` - Persistent conversation storage
- `voiceService.js` - Voice recording and speech synthesis
- `websocketService.js` - AI coaching simulation service
- `pitchingExamples.js` - Pre-defined coaching scenarios

## Usage

1. **Access Voice Coach**: Click "Voice Coach" button on the job details page
2. **Start Coaching Session**: Connect to begin an AI-powered coaching session
3. **Record Your Pitch**: Use voice recording to practice sales pitches
4. **Receive AI Feedback**: Get real-time coaching with scores and suggestions
5. **Review Progress**: View conversation history and track improvement
6. **End Session**: Complete the coaching session when goals are achieved

## Voice Coach Features

- **Real-time Voice Recording**: Browser-based voice capture and analysis
- **Speech-to-Text**: Live transcription of your pitch
- **AI Feedback System**: Intelligent coaching based on customer profiles
- **Progress Tracking**: Session stats and improvement metrics
- **Conversation History**: Persistent storage of coaching sessions
- **Personalized Goals**: Customer-specific coaching objectives

## Technologies Used

- **Frontend**: React 18, React Router DOM, CSS3
- **Voice Processing**: Web Speech API, MediaRecorder API
- **UI Components**: Pipecat Voice UI Kit
- **State Management**: React Hooks (useState, useEffect)
- **Data Persistence**: LocalStorage for conversation history
- **Responsive Design**: Mobile-first CSS with modern gradients and animations

## Optional AI Backend

The app includes a Python-based Pipecat server for real AI coaching (optional):

```bash
# Setup the AI server (requires OpenAI & Deepgram API keys)
npm run setup-pipecat
npm run start-pipecat

# Start both frontend and backend
npm run dev
```

Without the AI server, the app runs in intelligent demo mode with simulated coaching responses.
