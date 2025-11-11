// WebSocket Service for Voice Coach - Clean & Simplified v2.0
class WebSocketService {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.isOfflineMode = false;
    this.messageQueue = [];
    this.heartbeatInterval = null;
    this.eventListeners = {};
    this.serverUrl = 'ws://127.0.0.1:8080';
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 2;
    this.currentSession = null;
    this.lastSentMessage = null;
    this.lastSentTime = 0;
    this.messageCooldown = 3000; // 3 second cooldown to prevent spam
    this.sentMessages = new Set(); // Track sent message IDs
    this.processing = false; // Prevent concurrent processing
    
    // Connection management
    this.connectionId = null;
    this.isConnecting = false; // Prevent multiple connection attempts
    this.sessionStarted = false; // Track if session is active
  }

  // Event emitter methods
  on(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  off(event, callback) {
    if (!this.eventListeners[event]) return;
    this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
  }

  emit(event, data) {
    if (!this.eventListeners[event]) return;
    this.eventListeners[event].forEach(callback => callback(data));
  }

  // Connect to WebSocket server with connection management
  connect(url = null) {
    const targetUrl = url || this.serverUrl;
    
    // Prevent multiple connection attempts
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.CONNECTING)) {
      console.log('🔄 Connection already in progress, skipping...');
      return;
    }
    
    // Don't reconnect if already connected
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('✅ Already connected, skipping...');
      return;
    }
    
    console.log('🔌 Connecting to Voice Coach server...');
    this.isConnecting = true;
    
    // Reset state
    this.cleanup();
    this.isConnected = false;
    this.isOfflineMode = false;
    this.connectionId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    try {
      this.ws = new WebSocket(targetUrl);
      this.setupEventListeners();
      
      // Fallback to demo mode after 8 seconds if no connection
      setTimeout(() => {
        if (!this.isConnected && this.isConnecting) {
          this.isConnecting = false;
          this.switchToOfflineMode();
        }
      }, 8000);
      
    } catch (error) {
      console.error('❌ WebSocket creation failed:', error);
      this.isConnecting = false;
      this.switchToOfflineMode();
    }
  }

  // Setup WebSocket event listeners
  setupEventListeners() {
    this.ws.onopen = () => {
      console.log(`✅ Connected to Voice Coach server (ID: ${this.connectionId})`);
      this.isConnected = true;
      this.isConnecting = false; // Clear connecting flag
      this.reconnectAttempts = 0;
      this.processMessageQueue();
      
      this.emit('connected', {
        timestamp: Date.now(),
        server: 'Voice Coach Server',
        status: 'ready',
        connectionId: this.connectionId,
        model: 'gemini-2.5-flash-native-audio'
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        // Handle plain text messages
        this.handleMessage({ type: 'text', message: event.data });
      }
    };

    this.ws.onclose = (event) => {
      console.log(`🔌 WebSocket connection closed (ID: ${this.connectionId}, Code: ${event.code})`);
      this.cleanup();
      this.isConnected = false;
      this.isConnecting = false; // Clear connecting flag
      this.sessionStarted = false; // Reset session flag
      
      this.emit('disconnected', {
        code: event.code,
        reason: event.reason || 'Connection closed',
        timestamp: Date.now(),
        connectionId: this.connectionId
      });

      // Try reconnection for unexpected closures
      if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), 2000);
      } else if (event.code !== 1000) {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.emit('maxReconnectAttemptsReached', {
            attempts: this.reconnectAttempts,
            timestamp: Date.now()
          });
        }
        console.log('🔄 Switching to demo mode');
        this.switchToOfflineMode();
      }
    };

    this.ws.onerror = (error) => {
      console.log('❌ WebSocket error occurred');
      
      this.emit('error', {
        message: 'WebSocket connection error',
        details: 'Please ensure the Voice Coach server is running',
        timestamp: Date.now()
      });
      
      if (this.reconnectAttempts === 0) {
        this.switchToOfflineMode();
      }
    };
  }

  // Handle incoming messages
  handleMessage(data) {
    // Handle new native audio server message format
    if (data.data) {
      // New format from native audio server
      switch (data.type) {
        case 'connected':
          this.emit('connected', {
            message: data.data.message || 'Connected to Native Audio Voice Coach',
            model: data.data.model,
            audioConfig: data.data.audio_config,
            timestamp: data.timestamp || Date.now()
          });
          break;
          
        case 'textFeedback':
          this.handleNativeAudioFeedback(data.data);
          break;
          
        case 'audioResponse':
          this.handleNativeAudioResponse(data.data);
          break;
          
        case 'error':
          this.emit('error', {
            message: data.data.message,
            severity: data.data.severity || 'error',
            timestamp: data.timestamp || Date.now()
          });
          break;
          
        default:
          console.log('📥 Unknown message type from native audio server:', data.type);
      }
    } else {
      // Legacy format support
      switch (data.type) {
        case 'connected':
          this.emit('textFeedback', {
            message: 'Connected to AI Voice Coach',
            type: 'system',
            timestamp: Date.now()
          });
          break;
          
        case 'textFeedback':
          
          // Clear processing flag when we receive AI response
          if (this.processing && this.waitingForResponse) {
            this.processing = false;
            this.waitingForResponse = false;
            if (this.currentProcessingTimeout) {
              clearTimeout(this.currentProcessingTimeout);
              this.currentProcessingTimeout = null;
            }
          }
          
          const message = data.message || 'Feedback from AI Voice Coach';
          
          // Automatically play audio for AI responses (legacy format)
          if (message && message.trim().length > 0 && data.type !== 'system') {
            console.log('🔊 Auto-playing AI response as audio (legacy)...');
            this.playAudioResponse(message);
          }
          
          this.emit('textFeedback', {
            message: message,
            type: 'ai',
            timestamp: data.timestamp || Date.now(),
            score: data.score || null,
            achievements: data.achievements || [],
            improvements: data.improvements || [],
            progressPercent: data.progressPercent || null,
            sessionResults: data.sessionResults || null,
            hasAudioResponse: true // Force audio response
          });
          break;
          
        case 'audioResponse':
          console.log('🔊 Audio response received from Gemini AI');
          // Don't emit textFeedback here - let the textFeedback message handle display
          // Just handle the audio playback
          this.playAudioResponse(data.message);
          break;
          
        default:
          // Handle any unknown message types with text content  
          if (data.message || typeof data === 'string') {
            this.emit('textFeedback', {
              message: data.message || data,
              type: 'system',
              timestamp: Date.now()
            });
          }
      }
    }
  }

  // Handle native audio feedback
  handleNativeAudioFeedback(data) {
    // Clear processing flag when we receive AI response
    if (this.processing && this.waitingForResponse) {
      this.processing = false;
      this.waitingForResponse = false;
      if (this.currentProcessingTimeout) {
        clearTimeout(this.currentProcessingTimeout);
        this.currentProcessingTimeout = null;
      }
    }
    
    const message = data.message || 'Feedback from Native Audio Voice Coach';
    
    // Automatically play audio for AI responses
    if (message && message.trim().length > 0) {
      console.log('🔊 Auto-playing AI response as audio...');
      this.playAudioResponse(message);
    }
    
    // Emit enhanced feedback with native audio support
    this.emit('textFeedback', {
      message: message,
      type: 'ai',
      timestamp: Date.now(),
      score: data.score || null,
      achievements: data.achievements || [],
      improvements: data.improvements || [],
      progressPercent: data.progressPercent || null,
      sessionResults: data.sessionResults || null,
      model: data.model || 'gemini-2.5-flash-native-audio',
      hasAudioResponse: true, // Force audio response
      processingTime: data.processingTime || null
    });
  }

  // Handle native audio response
  handleNativeAudioResponse(data) {
    console.log('🎵 Native audio response received from Gemini 2.5 Flash');
    
    if (data.audioData) {
      // Play native audio from Gemini
      this.playNativeAudioResponse(data.audioData, data.mimeType);
    } else {
      console.warn('⚠️ Audio response received but no audio data found');
    }
    
    // Emit audio response event
    this.emit('audioResponse', {
      hasAudio: !!data.audioData,
      size: data.size || 0,
      mimeType: data.mimeType || 'audio/pcm',
      sampleRate: data.sampleRate || 24000,
      timestamp: Date.now()
    });
  }

  // Switch to offline/demo mode
  switchToOfflineMode() {
    // Don't switch if we have an active connection
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }
    
    // Only switch to demo mode after multiple failed attempts
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => this.connect(), 2000);
      return;
    }
    
    this.isOfflineMode = true;
    this.isConnected = false;
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    console.log('❌ Unable to connect to real server');
    
    // Emit connection failed instead of fake demo connection
    this.emit('connectionFailed', {
      timestamp: Date.now(),
      message: 'Unable to connect to Voice Coach server'
    });
  }

  // Send message to server
  send(type, payload = {}) {
    // AGGRESSIVE duplicate prevention for voice_data
    if (type === 'voice_data') {
      // Block if already processing
      if (this.processing) {
        return;
      }
      
      const now = Date.now();
      const messageContent = JSON.stringify({type, ...payload});
      
      // Create unique message ID
      const messageId = `${type}_${payload.audioSize || 0}_${payload.timestamp || now}_${payload.transcribedText?.substring(0, 20) || 'no_text'}`;
      
      // Check if we already sent this exact message
      if (this.sentMessages.has(messageId)) {
        return;
      }
      
      // Check cooldown period
      if (this.lastSentMessage === messageContent && (now - this.lastSentTime) < this.messageCooldown) {
        return;
      }
      
      // Mark as processing
      this.processing = true;
      this.lastSentMessage = messageContent;
      this.lastSentTime = now;
      this.sentMessages.add(messageId);
      
      // Clean old message IDs (keep last 10)
      if (this.sentMessages.size > 10) {
        const messages = Array.from(this.sentMessages);
        this.sentMessages.clear();
        messages.slice(-5).forEach(id => this.sentMessages.add(id));
      }
      
      // Clear processing flag after cooldown
      setTimeout(() => {
        this.processing = false;
      }, this.messageCooldown);
    }
    
    // ONLY send to real server - no mock responses
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN && !this.isOfflineMode) {
      const message = { 
        type, 
        timestamp: Date.now(), 
        connectionId: this.connectionId, 
        ...payload 
      };
      
      // Ensure voice_data has transcribedText (no placeholder fallback)
      if (type === 'voice_data' && !message.transcribedText && !payload.text && !payload.transcription) {
        console.warn('⚠️ No transcription provided for voice_data message');
      }
      
      try {
        this.ws.send(JSON.stringify(message));
        
        // Clear processing flag when we receive a response (set up listener)
        if (type === 'voice_data') {
          this.waitingForResponse = true;
        }
      } catch (error) {
        console.error('❌ Send failed:', error);
        this.processing = false; // Clear processing flag on error
        if (this.currentProcessingTimeout) {
          clearTimeout(this.currentProcessingTimeout);
        }
        this.emit('textFeedback', {
          message: 'Connection error - please try again',
          type: 'error',
          timestamp: Date.now()
        });
      }
    } else {
      // No mock responses - only show connection error
      console.log('❌ Not connected to real server');
      this.processing = false; // Clear processing flag
      this.emit('textFeedback', {
        message: 'Not connected to Voice Coach server. Please ensure server is running.',
        type: 'error',
        timestamp: Date.now()
      });
      
      // Only try to reconnect if not already connecting and no recent attempts
      if (!this.isConnecting && (Date.now() - this.lastSentTime) > 5000) {
        console.log('🔄 Attempting single reconnection...');
        this.connect();
      } else {
        console.log('⏳ Skipping reconnect - already connecting or recent attempt');
      }
    }
  }

  // Queue message for retry
  queueMessage(message) {
    this.messageQueue.push(message);
  }

  // Process queued messages
  processMessageQueue() {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('❌ Queued message failed:', error);
        break;
      }
    }
  }

  // Heartbeat removed - not needed for this application

  // NO mock responses - only real server responses
  simulateResponse(type, payload) {
    // Do nothing - no mock responses allowed
  }


  // Disconnect from server
  disconnect() {
    console.log('🔌 Disconnecting from Voice Coach');
    this.cleanup();
    this.isConnected = false;
    
    if (this.ws) {
      this.ws.close(1000, 'Session ended');
      this.ws = null;
    }
    
    this.emit('disconnected', {
      code: 1000,
      reason: 'Session ended',
      timestamp: Date.now()
    });
  }

  // Clean up resources
  cleanup() {
    // No cleanup needed for simplified WebSocket service
  }

  // Play native audio response from Gemini
  playNativeAudioResponse(audioBase64, mimeType = 'audio/pcm;rate=24000') {
    try {
      console.log('🎵 Playing native audio response from Gemini');
      
      // Decode base64 audio
      const audioBytes = atob(audioBase64);
      const audioArray = new Uint8Array(audioBytes.length);
      for (let i = 0; i < audioBytes.length; i++) {
        audioArray[i] = audioBytes.charCodeAt(i);
      }
      
      // Create audio context
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Handle PCM audio from Gemini (24kHz, 16-bit)
      if (mimeType.includes('pcm')) {
        this.playPCMAudio(audioArray, audioContext, 24000);
      } else {
        // Handle other audio formats
        this.playEncodedAudio(audioArray.buffer, audioContext);
      }
      
    } catch (error) {
      console.error('❌ Failed to play native audio response:', error);
      // Fallback to text-to-speech if audio fails
      this.emit('audioError', { error: error.message });
    }
  }

  // Play PCM audio data
  playPCMAudio(audioArray, audioContext, sampleRate = 24000) {
    try {
      // Convert Uint8Array to Float32Array for Web Audio API
      const samples = audioArray.length / 2; // 16-bit = 2 bytes per sample
      const audioBuffer = audioContext.createBuffer(1, samples, sampleRate);
      const channelData = audioBuffer.getChannelData(0);
      
      // Convert 16-bit PCM to float values
      for (let i = 0; i < samples; i++) {
        const sample16 = (audioArray[i * 2 + 1] << 8) | audioArray[i * 2];
        // Convert from signed 16-bit to float (-1.0 to 1.0)
        channelData[i] = sample16 < 32768 ? sample16 / 32768 : (sample16 - 65536) / 32768;
      }
      
      // Create and play audio source
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      
      source.onended = () => {
        this.emit('nativeAudioEnded', { duration: audioBuffer.duration });
      };
      
      source.start();
      this.emit('nativeAudioStarted', { 
        duration: audioBuffer.duration, 
        sampleRate: sampleRate,
        format: 'pcm'
      });
      
      console.log(`🎵 Playing PCM audio: ${audioBuffer.duration.toFixed(2)}s at ${sampleRate}Hz`);
      
    } catch (error) {
      console.error('❌ PCM audio playback error:', error);
      this.emit('audioError', { error: error.message });
    }
  }

  // Play encoded audio data (MP3, WAV, etc.)
  playEncodedAudio(audioBuffer, audioContext) {
    audioContext.decodeAudioData(
      audioBuffer,
      (decodedBuffer) => {
        const source = audioContext.createBufferSource();
        source.buffer = decodedBuffer;
        source.connect(audioContext.destination);
        
        source.onended = () => {
          this.emit('nativeAudioEnded', { duration: decodedBuffer.duration });
        };
        
        source.start();
        this.emit('nativeAudioStarted', { 
          duration: decodedBuffer.duration,
          format: 'encoded'
        });
        
        console.log(`🎵 Playing encoded audio: ${decodedBuffer.duration.toFixed(2)}s`);
      },
      (error) => {
        console.error('❌ Audio decode error:', error);
        this.emit('audioError', { error: error.message });
      }
    );
  }

  // Play audio response using browser TTS (enhanced for voice coach)
  playAudioResponse(text) {
    if ('speechSynthesis' in window) {
      
      // Stop any current speech
      speechSynthesis.cancel();
      
      // Clean the text for better speech
      const cleanText = text
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove markdown bold
        .replace(/\*(.*?)\*/g, '$1') // Remove markdown italic
        .replace(/#{1,6}\s/g, '') // Remove markdown headers
        .replace(/`(.*?)`/g, '$1') // Remove code blocks
        .replace(/\n+/g, '. ') // Replace line breaks with pauses
        .replace(/\s+/g, ' ') // Clean extra spaces
        .trim();
      
      console.log('🎙️ Speaking AI response:', cleanText.substring(0, 100) + '...');
      
      // Wait a moment for cancel to complete
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(cleanText);
        
        // Enhanced voice settings for coaching
        utterance.rate = 0.85; // Slightly slower for clarity
        utterance.pitch = 1.0;
        utterance.volume = 0.9; // Louder for better hearing
        
        // Load voices if not already loaded
        const voices = speechSynthesis.getVoices();
        
        // Select the best voice for coaching (prioritize quality voices)
        const preferredVoice = 
          voices.find(voice => voice.lang.startsWith('en') && voice.name.toLowerCase().includes('enhanced')) ||
          voices.find(voice => voice.lang.startsWith('en') && voice.name.toLowerCase().includes('premium')) ||
          voices.find(voice => voice.lang.startsWith('en') && voice.name.toLowerCase().includes('neural')) ||
          voices.find(voice => voice.lang.startsWith('en') && voice.name.toLowerCase().includes('samantha')) ||
          voices.find(voice => voice.lang.startsWith('en') && voice.name.toLowerCase().includes('alex')) ||
          voices.find(voice => voice.lang.startsWith('en')) || 
          voices[0];
        
        if (preferredVoice) {
          utterance.voice = preferredVoice;
          console.log('🎤 Using voice:', preferredVoice.name);
        }

        utterance.onstart = () => {
          console.log('🔊 Started speaking AI response');
          this.emit('speechStarted', { text: cleanText, voice: preferredVoice?.name });
        };
        
        utterance.onend = () => {
          console.log('✅ Finished speaking AI response');
          this.emit('speechEnded', { text: cleanText });
        };
        
        utterance.onerror = (error) => {
          console.error('❌ Speech synthesis error:', error);
          this.emit('speechError', { error: error });
        };

        speechSynthesis.speak(utterance);
      }, 150);
    } else {
      console.warn('⚠️ Speech synthesis not supported in this browser');
      this.emit('speechError', { error: 'Speech synthesis not supported' });
    }
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      isOfflineMode: this.isOfflineMode,
      queuedMessages: this.messageQueue.length,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// Export singleton instance
const websocketService = new WebSocketService();
export default websocketService;