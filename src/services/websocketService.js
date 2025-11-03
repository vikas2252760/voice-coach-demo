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
    this.messageCooldown = 2000; // 2 second cooldown between voice messages
    this.sentMessages = new Set(); // Track sent message IDs
    this.processing = false; // Prevent concurrent processing
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

  // Connect to WebSocket server
  connect(url = null) {
    const targetUrl = url || this.serverUrl;
    
    // Reset state
    this.cleanup();
    this.isConnected = false;
    this.isOfflineMode = false;
    
    
    try {
      this.ws = new WebSocket(targetUrl);
      this.setupEventListeners();
      
      // Fallback to demo mode after 5 seconds if no connection
      setTimeout(() => {
        if (!this.isConnected) {
          this.switchToOfflineMode();
        }
      }, 5000);
      
    } catch (error) {
      console.error('❌ WebSocket creation failed:', error);
      this.switchToOfflineMode();
    }
  }

  // Setup WebSocket event listeners
  setupEventListeners() {
    this.ws.onopen = () => {
      console.log('✅ Connected to Voice Coach server');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.processMessageQueue();
      
      this.emit('connected', {
        timestamp: Date.now(),
        server: 'Voice Coach Server',
        status: 'ready'
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
      this.cleanup();
      this.isConnected = false;
      
      this.emit('disconnected', {
        code: event.code,
        reason: event.reason || 'Connection closed',
        timestamp: Date.now()
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
        
        this.emit('textFeedback', {
          message: data.message || 'Feedback from AI Voice Coach',
          type: 'ai',
          timestamp: data.timestamp || Date.now(),
          score: data.score || null,
          achievements: data.achievements || [],
          improvements: data.improvements || [],
          progressPercent: data.progressPercent || null,
          sessionResults: data.sessionResults || null
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
      const message = { type, timestamp: Date.now(), ...payload };
      
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
      
      // Try to reconnect
      this.connect();
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

  // Get connection status
  // Play audio response using browser TTS
  playAudioResponse(text) {
    if ('speechSynthesis' in window) {
      
      // Stop any current speech
      speechSynthesis.cancel();
      
      // Wait a moment for cancel to complete
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 0.8;
        
        // Load voices if not already loaded
        const voices = speechSynthesis.getVoices();
        
        // Select a professional voice
        const preferredVoice = voices.find(voice => 
          voice.lang.startsWith('en') && 
          (voice.name.toLowerCase().includes('female') || voice.name.toLowerCase().includes('samantha'))
        ) || voices.find(voice => voice.lang.startsWith('en')) || voices[0];
        
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        utterance.onstart = () => {
          this.emit('speechStarted', { text: text });
        };
        
        utterance.onend = () => {
          this.emit('speechEnded', { text: text });
        };
        
        utterance.onerror = (error) => {
          console.error('❌ Speech synthesis error:', error);
          this.emit('speechError', { error: error });
        };

        speechSynthesis.speak(utterance);
      }, 100);
    } else {
      console.warn('⚠️ Speech synthesis not supported in this browser');
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