// Real-time WebSocket service for Pipecat Voice Coach AI communication

class WebSocketService {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3; // Reduced attempts for faster fallback
    this.reconnectDelay = 2000;
    this.messageQueue = [];
    this.eventListeners = new Map();
    this.connectionTimeout = null;
    this.serverUrl = 'ws://localhost:8080'; // Pipecat server URL
    this.heartbeatInterval = null;
    this.isOfflineMode = false;
    this.offlineNotificationSent = false;
    this.currentSession = null;
  }

  // Connect to Voice Coach (Demo Mode)
  connect(url = null) {
    // Reset connection state
    this.isConnected = false;
    this.isOfflineMode = true;
    this.offlineNotificationSent = false;
    
    // Clear any existing connection state
    this.cleanup();
    
    // Simulate immediate connection in demo mode
    setTimeout(() => {
      this.isConnected = true;
      
      this.emit('connected', {
        timestamp: Date.now(),
        server: 'Voice Coach',
        status: 'ready',
        capabilities: ['voice_practice', 'coaching_simulation', 'speech_analysis']
      });
    }, 300);
  }

  // Setup WebSocket event listeners for Pipecat server
  setupEventListeners() {
    this.ws.onopen = () => {
      console.log('🎯 Successfully connected to Pipecat Voice Coach server!');
      
      // Clear connection timeout
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }
      
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Start heartbeat
      this.startHeartbeat();
      
      this.emit('connected', {
        timestamp: Date.now(),
        server: 'Pipecat Voice Coach',
        status: 'ready',
        capabilities: ['real_time_voice', 'ai_coaching', 'speech_analysis']
      });

      // Process any queued messages
      this.processMessageQueue();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('🎤 Pipecat server message:', data);
        this.handlePipecatMessage(data);
      } catch (error) {
        console.error('❌ Error parsing Pipecat message:', error, event.data);
      }
    };

    this.ws.onclose = (event) => {
      console.log('🔴 Pipecat server connection closed:', event.code, event.reason);
      
      this.cleanup();
      this.isConnected = false;
      
      this.emit('disconnected', {
        code: event.code,
        reason: event.reason || 'Pipecat server connection closed',
        timestamp: Date.now(),
        willReconnect: this.reconnectAttempts < this.maxReconnectAttempts
      });

      // Attempt reconnection for non-intentional disconnects
      if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      } else if (event.code !== 1000) {
        console.log('🔄 Switching to offline mode - Pipecat server not available');
        this.switchToOfflineMode();
      }
    };

    this.ws.onerror = (error) => {
      // Only log error on first attempt, then switch to offline mode
      if (this.reconnectAttempts === 0 && !this.isOfflineMode) {
        console.log('🔌 Pipecat server not available, switching to offline mode');
        this.switchToOfflineMode();
      }
    };
  }

  // Handle different types of messages from Pipecat server
  handlePipecatMessage(data) {
    const messageType = data.type;
    
    switch (messageType) {
      case 'connected':
      case 'system':
        this.emit('textFeedback', {
          message: data.message || 'Connected to AI Voice Coach',
          type: 'system',
          timestamp: data.timestamp || Date.now()
        });
        break;
        
      case 'transcription':
        this.emit('transcriptionResult', {
          text: data.text,
          confidence: data.confidence,
          final: data.final,
          timestamp: Date.now()
        });
        break;
        
      case 'ai_response':
      case 'feedback':
      case 'textFeedback':
        this.emit('textFeedback', {
          message: data.message,
          type: 'ai',
          score: data.score,
          analysis: data.analysis,
          improvements: data.improvements,
          strengths: data.strengths,
          timestamp: data.timestamp || Date.now()
        });
        break;
        
      case 'voiceFeedback':
      case 'audio':
        this.emit('voiceFeedback', {
          message: data.message,
          audioUrl: data.audioUrl || data.audio_url,
          timestamp: data.timestamp || Date.now()
        });
        break;
        
      case 'conversationHistory':
        this.emit('conversationHistory', {
          conversation_id: data.conversation_id,
          messages: data.messages,
          timestamp: Date.now()
        });
        break;
        
      case 'pitchAnalysis':
        this.emit('pitchAnalysis', {
          score: data.score,
          improvements: data.improvements,
          strengths: data.strengths,
          analysis: data.analysis,
          timestamp: Date.now()
        });
        break;
        
      case 'error':
        console.error('Pipecat server error:', data.message);
        this.emit('error', {
          message: data.message,
          details: data.details,
          timestamp: Date.now()
        });
        break;
        
      case 'pong':
        console.log('🏓 Heartbeat pong received');
        break;
        
      default:
        console.log('📨 Unknown Pipecat message type:', messageType, data);
        // Try to handle as generic text feedback if it has a message
        if (data.message) {
          this.emit('textFeedback', {
            message: data.message,
            type: 'system',
            timestamp: Date.now()
          });
        }
    }
  }

  // Send message to Voice Coach system (demo mode)
  send(type, payload = {}) {
    this.simulateResponse(type, payload);
  }

  // Queue message for later delivery
  queueMessage(message) {
    this.messageQueue.push(message);
    console.log(`📦 Message queued. Queue size: ${this.messageQueue.length}`);
  }

  // Process queued messages
  processMessageQueue() {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      console.log('📤 Sending queued message:', message);
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('❌ Failed to send queued message:', error);
        // Put it back at the front of the queue
        this.messageQueue.unshift(message);
        break;
      }
    }
  }

  // Start heartbeat to keep connection alive
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
        this.send('ping');
      }
    }, 30000); // Send ping every 30 seconds
  }

  // Schedule reconnection attempt
  scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    
    console.log(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (!this.isConnected) {
        console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        this.connect();
      }
    }, delay);
  }

  // Handle connection errors (not used in demo mode)
  handleConnectionError(message) {
    console.log('🔌 Connection error handled:', message);
    this.cleanup();
  }


  // Simulate intelligent coaching sessions
  simulateResponse(type, payload) {
    const responses = {
      'start_pitch_session': {
        delay: 400,
        response: () => {
          const customer = payload.customer || {};
          const sessionGoals = this.analyzeCustomerNeeds(customer);
          
          // Store session context
          this.currentSession = {
            customer: customer,
            goals: sessionGoals,
            progress: {
              totalInteractions: 0,
              goalsAchieved: 0,
              confidenceScore: 0,
              satisfactionLevel: 0
            },
            startTime: Date.now()
          };

          this.emit('textFeedback', {
            message: `🎯 **Personal Coaching Session Started**\n\n**Customer**: ${customer.name || 'Valued Customer'}\n**Profile**: ${customer.familySize} family, ${customer.techUsage}\n\n**Today's Goals**:\n${sessionGoals.objectives.map(obj => `• ${obj}`).join('\n')}\n\n**Expected Duration**: ${sessionGoals.estimatedTime} minutes\n\n🎤 **Ready to begin!** Start recording your pitch and I'll provide personalized coaching based on ${customer.name}'s specific needs.`,
            type: 'session_start',
            sessionGoals: sessionGoals,
            timestamp: Date.now()
          });
        }
      },
      'voice_data': {
        delay: 600,
        response: () => {
          if (!this.currentSession) {
            this.emit('textFeedback', {
              message: "⚠️ Please start a coaching session first by clicking Connect.",
              type: 'system',
              timestamp: Date.now()
            });
            return;
          }

          // Update session progress
          this.currentSession.progress.totalInteractions++;
          
          // Generate progressive, contextual feedback
          const feedback = this.generateContextualFeedback();
          
          this.emit('textFeedback', {
            ...feedback,
            type: 'ai',
            timestamp: Date.now(),
            sessionProgress: this.currentSession.progress
          });

          // Check if session goals are met
          this.checkSessionCompletion();
        }
      },
      'ping': {
        delay: 100,
        response: () => this.emit('pong', { timestamp: Date.now() })
      }
    };

    const config = responses[type];
    if (config) {
      setTimeout(() => {
        config.response();
      }, config.delay);
    }
  }

  // Analyze customer profile to create personalized coaching goals
  analyzeCustomerNeeds(customer) {
    // Safely handle customer data that might be null/undefined or have different types
    const profile = {
      familySize: String(customer?.familySize || 'Unknown size'),
      techUsage: String(customer?.techUsage || 'Standard usage'),
      name: String(customer?.name || 'Valued Customer')
    };


    // Create customer-specific goals based on profile
    let objectives = [];
    let estimatedTime = 5;
    let focusAreas = [];

    // Analyze family profile - safe string checking
    const familySizeStr = profile.familySize.toLowerCase();
    if (familySizeStr.includes('4') || familySizeStr.includes('large') || familySizeStr.includes('family')) {
      objectives.push("Emphasize family device protection across multiple devices");
      objectives.push("Highlight cost savings for family plans");
      focusAreas.push('family_value', 'cost_efficiency');
      estimatedTime = 7;
    }

    // Analyze tech usage - safe string checking
    const techUsageStr = profile.techUsage.toLowerCase();
    if (techUsageStr.includes('heavy') || techUsageStr.includes('tech-savvy') || techUsageStr.includes('advanced')) {
      objectives.push("Focus on advanced features and technical benefits");
      objectives.push("Address power user concerns about device coverage");
      focusAreas.push('technical_depth', 'advanced_features');
    } else if (techUsageStr.includes('basic') || techUsageStr.includes('simple') || techUsageStr.includes('light')) {
      objectives.push("Explain benefits in simple, clear terms");
      objectives.push("Emphasize ease of use and peace of mind");
      focusAreas.push('simplicity', 'peace_of_mind');
    } else {
      objectives.push("Balance technical details with practical benefits");
      objectives.push("Show value for everyday device protection");
      focusAreas.push('balanced_approach');
    }

    // Add universal goals
    objectives.push(`Build trust and rapport with ${profile.name}`);
    objectives.push("Achieve clear next steps for enrollment");

    return {
      objectives,
      focusAreas,
      estimatedTime,
      profile,
      targetScore: 85,
      requiredInteractions: Math.max(3, Math.min(6, objectives.length))
    };
  }

  // Generate contextual feedback based on session progress
  generateContextualFeedback() {
    const session = this.currentSession;
    
    // Safety check - if no session, create minimal feedback
    if (!session) {
      return {
        message: "🎯 Great practice! Your voice sounds confident and clear.\n\nKeep recording to get more detailed, personalized coaching based on your customer's specific needs.",
        score: 75,
        improvements: ["Start a session by clicking Connect to get personalized coaching"],
        achievements: ["Clear voice delivery", "Good energy level"],
        analysis: "Basic feedback - Connect to start a personalized session"
      };
    }
    
    const progress = session.progress;
    const goals = session.goals;
    const customer = session.customer;

    // Calculate progress scoring
    const baseScore = Math.min(60 + (progress.totalInteractions * 5), 95);
    const variation = Math.floor(Math.random() * 10) - 5; // ±5 variation
    const score = Math.max(65, Math.min(95, baseScore + variation));

    // Update session progress
    progress.confidenceScore = Math.max(progress.confidenceScore, score);
    
    // Determine feedback phase
    let message, improvements, achievements;

    if (progress.totalInteractions === 1) {
      // First interaction - opening assessment
      message = `🎯 **Great start, ${customer.name}!** I can hear the enthusiasm in your voice.\n\n**Initial Assessment**: Your opening shows confidence, but let's tailor this specifically for ${goals.profile.familySize} family needs.\n\n**Next**: Focus on their ${goals.focusAreas[0].replace('_', ' ')} - this is key for ${customer.name}.`;
      
      improvements = [
        `Emphasize ${goals.focusAreas[0].replace('_', ' ')} more prominently`,
        "Use more specific family scenarios they can relate to"
      ];
      
      achievements = ["Strong confident opening", "Good energy and pace"];
      
    } else if (progress.totalInteractions === 2) {
      // Second interaction - building on strengths
      message = `💪 **Building momentum!** You're addressing ${customer.name}'s key concerns effectively.\n\n**Progress Check**: ${Math.round((progress.totalInteractions / goals.requiredInteractions) * 100)}% toward session goals.\n\n**Strength**: Your focus on ${goals.focusAreas[1] || goals.focusAreas[0]} resonates well with their profile.`;
      
      improvements = [
        "Add a specific cost-saving example they can calculate",
        "Include one personal story or relatable scenario"
      ];
      
      achievements = ["Addressing customer-specific needs", "Maintaining good engagement"];
      progress.goalsAchieved++;
      
    } else if (progress.totalInteractions >= 3 && progress.totalInteractions < goals.requiredInteractions) {
      // Middle phase - refinement
      const progressPercent = Math.round((progress.totalInteractions / goals.requiredInteractions) * 100);
      message = `🎨 **Refining your approach!** (${progressPercent}% complete)\n\nYou're successfully connecting with ${customer.name}'s ${goals.profile.familySize} family situation.\n\n**Key Insight**: Your emphasis on ${goals.focusAreas[Math.floor(Math.random() * goals.focusAreas.length)].replace('_', ' ')} is exactly what they need to hear.`;
      
      improvements = [
        "Ask for their specific concerns or questions",
        "Prepare for objection handling - anticipate their hesitations"
      ];
      
      achievements = ["Customer-focused messaging", "Building strong value proposition"];
      progress.goalsAchieved++;
      
    } else {
      // Final phase - completion preparation
      const successRate = Math.min(95, 70 + (progress.goalsAchieved * 5));
      progress.satisfactionLevel = successRate;
      
      message = `🏆 **Excellent work!** You've successfully tailored your pitch for ${customer.name}.\n\n**Customer Satisfaction**: ${successRate}% likely to engage\n**Goals Achieved**: ${progress.goalsAchieved}/${goals.objectives.length}\n\n**Ready for close**: You've built strong value and trust!`;
      
      improvements = ["Perfect! Now ask for their commitment or next steps"];
      achievements = ["Goal-oriented pitch delivered", "Customer needs thoroughly addressed", "Ready for enrollment discussion"];
      progress.goalsAchieved = Math.max(progress.goalsAchieved, goals.objectives.length - 1);
    }

    return {
      message,
      score,
      improvements,
      achievements,
      analysis: `Session ${progress.totalInteractions} of ${goals.requiredInteractions} - Targeting ${goals.profile.familySize} family with ${goals.profile.techUsage}`,
      customerFocus: goals.focusAreas,
      progressPercent: Math.round((progress.totalInteractions / goals.requiredInteractions) * 100)
    };
  }

  // Check if session goals are met and auto-complete if satisfied
  checkSessionCompletion() {
    const session = this.currentSession;
    const progress = session.progress;
    const goals = session.goals;

    // Check completion criteria
    const hasMinimumInteractions = progress.totalInteractions >= goals.requiredInteractions;
    const hasGoodScore = progress.confidenceScore >= goals.targetScore;
    const hasAchievedGoals = progress.goalsAchieved >= Math.floor(goals.objectives.length * 0.8);
    const customerSatisfied = progress.satisfactionLevel >= 80;

    if (hasMinimumInteractions && (hasGoodScore || hasAchievedGoals || customerSatisfied)) {
      // Session completion criteria met
      setTimeout(() => {
        const sessionDuration = Math.round((Date.now() - session.startTime) / 60000);
        
        this.emit('textFeedback', {
          message: `🎉 **Session Complete - Customer Goals Achieved!**\n\n**${session.customer.name} is ready to move forward!**\n\n📊 **Final Results**:\n• Confidence Score: ${progress.confidenceScore}/100\n• Goals Achieved: ${progress.goalsAchieved}/${goals.objectives.length}\n• Customer Satisfaction: ${progress.satisfactionLevel}%\n• Session Duration: ${sessionDuration} minutes\n\n✅ **Recommendation**: Proceed with enrollment discussion!\n\n🔌 **Auto-disconnecting** - Session objectives completed successfully.`,
          type: 'session_complete',
          sessionResults: {
            success: true,
            score: progress.confidenceScore,
            goalsAchieved: progress.goalsAchieved,
            totalGoals: goals.objectives.length,
            satisfaction: progress.satisfactionLevel,
            duration: sessionDuration
          },
          timestamp: Date.now()
        });

        // Auto-disconnect after showing results
        setTimeout(() => {
          this.emit('sessionComplete', {
            autoDisconnect: true,
            reason: 'Goals achieved - customer ready for next steps',
            results: session.progress,
            timestamp: Date.now()
          });
          
          // Reset session
          this.currentSession = null;
        }, 3000);
        
      }, 1000);
    }
  }

  // Disconnect from Voice Coach
  disconnect() {
    this.cleanup();
    
    this.isConnected = false;
    this.isOfflineMode = false;
    this.reconnectAttempts = 0;
    this.messageQueue = [];
    this.currentSession = null;
    
    this.emit('disconnected', { 
      reason: 'Session ended', 
      code: 1000, 
      willReconnect: false,
      timestamp: Date.now()
    });
  }

  // Cleanup resources
  cleanup() {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Event system
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const callbacks = this.eventListeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event callback for ${event}:`, error);
        }
      });
    }
  }

  // Get connection status
  getStatus() {
    return {
      connected: this.isConnected,
      serverUrl: this.serverUrl,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length,
      readyState: this.ws ? this.ws.readyState : WebSocket.CLOSED
    };
  }
}

// Export singleton instance
const websocketService = new WebSocketService();
export default websocketService;