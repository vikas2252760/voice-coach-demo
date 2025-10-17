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
    
    console.log('🔄 Connecting to Voice Coach server:', targetUrl);
    
    try {
      this.ws = new WebSocket(targetUrl);
      this.setupEventListeners();
      
      // Fallback to demo mode after 3 seconds if no connection
      setTimeout(() => {
        if (!this.isConnected) {
          console.log('⏰ Connection timeout - using demo mode');
          this.switchToOfflineMode();
        }
      }, 3000);
      
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
      console.log('🔌 Connection closed:', event.code);
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
        console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
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
    
    this.isOfflineMode = true;
    this.isConnected = false;
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    console.log('🎭 Voice Coach running in demo mode');
    
    // Simulate successful connection for UI
    setTimeout(() => {
      this.isConnected = true;
      this.emit('connected', {
        timestamp: Date.now(),
        server: 'Voice Coach (Demo)',
        status: 'demo'
      });
    }, 500);
  }

  // Send message to server
  send(type, payload = {}) {
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN && !this.isOfflineMode) {
      // Real WebSocket
      const message = { type, timestamp: Date.now(), ...payload };
      try {
        this.ws.send(JSON.stringify(message));
        console.log('📤 Sent:', type);
      } catch (error) {
        console.error('❌ Send failed:', error);
        this.queueMessage(message);
      }
    } else {
      // Demo mode
      this.simulateResponse(type, payload);
    }
  }

  // Queue message for retry
  queueMessage(message) {
    this.messageQueue.push(message);
    console.log('📦 Message queued for retry');
  }

  // Process queued messages
  processMessageQueue() {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      try {
        this.ws.send(JSON.stringify(message));
        console.log('📤 Queued message sent:', message.type);
      } catch (error) {
        console.error('❌ Queued message failed:', error);
        break;
      }
    }
  }

  // Heartbeat removed - not needed for this application

  // Simulate demo responses
  simulateResponse(type, payload) {
    const responses = {
      start_pitch_session: () => {
        this.currentSession = {
          id: `demo_session_${Date.now()}`,
          startTime: Date.now(),
          customerProfile: payload.customer || {}
        };
        
        setTimeout(() => {
          this.emit('textFeedback', {
            message: "Welcome! I'm your AI Voice Coach. Let's practice your pitch together. Start speaking when you're ready!",
            type: 'ai',
            timestamp: Date.now()
          });
        }, 800);
      },
      
      voice_data: () => {
        setTimeout(() => {
          const feedback = this.generateContextualFeedback();
          
          // Use textFeedback consistently to avoid duplicates
          this.emit('textFeedback', {
            message: feedback.message,
            type: 'ai',
            timestamp: Date.now(),
            score: feedback.score,
            improvements: feedback.areas || [],
            achievements: ['Clear voice delivery'],
            progressPercent: 75
          });
        }, 1200);
      }
    };

    const responseHandler = responses[type];
    if (responseHandler) {
      responseHandler();
    }
  }

  // Generate contextual feedback for demo mode
  generateContextualFeedback() {
    const feedbackOptions = [
      {
        message: "Great energy! Try to slow down slightly and emphasize the key benefits more clearly.",
        score: 85,
        areas: ['pace', 'emphasis']
      },
      {
        message: "Excellent opening! Consider adding a specific example to make your pitch more concrete and memorable.",
        score: 88,
        areas: ['examples', 'memorability']
      },
      {
        message: "Good structure! Your confidence shines through. Try pausing after key points to let them sink in.",
        score: 82,
        areas: ['pacing', 'impact']
      },
      {
        message: "Nice connection with the customer's needs! Your technical explanation could be simplified for better understanding.",
        score: 90,
        areas: ['clarity', 'technical_communication']
      }
    ];

    return feedbackOptions[Math.floor(Math.random() * feedbackOptions.length)];
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