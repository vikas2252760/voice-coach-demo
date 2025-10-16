import React, { useState, useEffect, useRef } from 'react';
import './VoiceCoach.css';
import websocketService from '../services/websocketService';
import voiceService from '../services/voiceService';
import pitchingExamples, { getPitchingExample, getRandomPitchingExample } from '../services/pitchingExamples';
import conversationService from '../services/conversationService';
import ConversationHistory from './ConversationHistory';

// Pipecat Voice UI Kit imports
import {
  ControlBar,
  SpinLoader,
  VoiceVisualizer,
  ThemeProvider
} from "@pipecat-ai/voice-ui-kit";
import "@pipecat-ai/voice-ui-kit/styles";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";

const VoiceCoach = ({ customer, isActive, onClose }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [messages, setMessages] = useState([]);
  const [currentExample, setCurrentExample] = useState(null);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [sessionStats, setSessionStats] = useState({
    totalTime: 0,
    messageCount: 0,
    averageScore: 0
  });
  const [conversationId] = useState(`conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [userId] = useState(`user_${Math.random().toString(36).substr(2, 9)}`);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef(null);
  const sessionStartTime = useRef(Date.now());
  const recentMessages = useRef(new Set());

  useEffect(() => {
    if (isActive) {
      initializeVoiceCoach();
    } else {
      cleanup();
    }

    return () => cleanup();
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initializeVoiceCoach = async () => {
    if (isInitialized) return;

    try {
      // Clean up any existing services first (but don't reset state yet)
      voiceService.cleanup();
      websocketService.disconnect();
      
      // Connect to WebSocket
      websocketService.connect();
          websocketService.on('connected', (data) => {
            setIsConnected(true);
            addSystemMessage(`🎯 Connected to Voice Coach!\n\nIntelligent coaching system is ready. Start recording to begin your personalized practice session.`);
          });

          websocketService.on('disconnected', (data) => {
            setIsConnected(false);
            setIsAiTyping(false); // Clear any stuck typing indicators
            
            // Clear any pending timeouts
            if (window.aiTypingTimeout) {
              clearTimeout(window.aiTypingTimeout);
              window.aiTypingTimeout = null;
            }
            if (window.voiceDataTimeout) {
              clearTimeout(window.voiceDataTimeout);
              window.voiceDataTimeout = null;
            }
            
            const reason = data?.reason || 'Connection closed';
            const code = data?.code || 'Unknown';
            const willReconnect = data?.willReconnect || false;
            
            console.log(`Pipecat server disconnected: ${code} - ${reason}`);
            
            if (willReconnect) {
              addSystemMessage(`🔄 Pipecat server disconnected. Attempting to reconnect...\nReason: ${reason}`);
            } else {
              addSystemMessage(`🔌 Disconnected from Pipecat Voice Coach server.\nReason: ${reason}`);
            }
          });

          websocketService.on('textFeedback', (feedback) => {
            setIsAiTyping(false);
            // Clear any pending safety timeouts since we got a response
            if (window.aiTypingTimeout) {
              clearTimeout(window.aiTypingTimeout);
              window.aiTypingTimeout = null;
            }
            if (window.voiceDataTimeout) {
              clearTimeout(window.voiceDataTimeout);
              window.voiceDataTimeout = null;
            }
            
            // Pass through enhanced feedback data
            const extraData = {
              improvements: feedback.improvements || [],
              achievements: feedback.achievements || [],
              progressPercent: feedback.progressPercent || null,
              sessionResults: feedback.sessionResults || null
            };
            
            // Ensure enhanced feedback data is available
            if (extraData.improvements.length === 0 && extraData.achievements.length === 0) {
              extraData.improvements = ["Continue practicing to improve your pitch"];
              extraData.achievements = ["Voice message received and processed"];
            }
            
            addAIMessage(feedback.message, feedback.score, extraData);
          });

      websocketService.on('voiceFeedback', (feedback) => {
        setIsAiTyping(false);
        // Clear any pending safety timeouts since we got a response
        if (window.aiTypingTimeout) {
          clearTimeout(window.aiTypingTimeout);
          window.aiTypingTimeout = null;
        }
        if (window.voiceDataTimeout) {
          clearTimeout(window.voiceDataTimeout);
          window.voiceDataTimeout = null;
        }
        addAIMessage(feedback.message);
        if (feedback.audioUrl) {
          voiceService.playAudio(feedback.audioUrl);
        } else {
          voiceService.speakText(feedback.message);
        }
      });

      websocketService.on('conversationHistory', (history) => {
        // Handle conversation history if needed
      });

      websocketService.on('error', (error) => {
            setIsAiTyping(false); // Clear any stuck typing indicators
            
            // Clear any pending timeouts
            if (window.aiTypingTimeout) {
              clearTimeout(window.aiTypingTimeout);
              window.aiTypingTimeout = null;
            }
            if (window.voiceDataTimeout) {
              clearTimeout(window.voiceDataTimeout);
              window.voiceDataTimeout = null;
            }
            
            const errorMessage = error?.details || error?.message || 'Connection error';
            addSystemMessage(`🚫 Pipecat Server Error: ${errorMessage}`);
            
            // Show setup instructions
            if (errorMessage.includes('timeout') || errorMessage.includes('ensure')) {
              addSystemMessage(`📋 Setup Instructions:\n1. Open terminal in project folder\n2. Run: cd pipecat-server && ./setup.sh\n3. Add API keys to .env file\n4. Run: ./start.sh\n5. Refresh this page`);
            }
          });

          websocketService.on('maxReconnectAttemptsReached', (data) => {
            addSystemMessage(`❌ Could not connect to Pipecat server after ${data.attempts} attempts.\n\n🔧 Please ensure:\n• Pipecat server is running (./start.sh)\n• API keys are configured\n• Port 8080 is available`);
          });

          // Handle intelligent session events
          websocketService.on('sessionComplete', (data) => {
            setIsRecording(false);
            setIsConnected(false);
            setVolumeLevel(0);
            setIsTranscribing(false);
            setIsAiTyping(false);
            
            // Add completion summary
            if (data.results) {
              addSystemMessage(`🏆 **Coaching Session Completed!**\n\n🎯 Goals achieved through intelligent progression\n📊 Final confidence score: ${data.results.confidenceScore || 'N/A'}\n⏱️ Auto-disconnected after successful coaching\n\n✅ Ready to proceed with customer enrollment!`);
            }
          });

      // Set initial example based on current customer
      const example = getRandomPitchingExample();
      setCurrentExample(example);

        // Initialize conversation in service FIRST (before any addMessage calls)
        const createdConversation = conversationService.createConversation(conversationId, userId, {
          customerName: customer?.name || 'Unknown Customer',
          scenario: example?.title || 'Current Customer Profile',
          protectionScore: customer?.protectionScore || 70
        });

      // Initialize voice service
      await voiceService.initialize();
      setupVoiceListeners();

      const stats = voiceService.getRecordingStats();

      if (stats.hasPermission) {
        const speechStatus = stats.speechRecognitionSupported ? '✅ Enabled' : '❌ Not supported';
        addSystemMessage(`✅ Microphone access granted. Audio format: ${stats.supportedMimeType}\n🗣️ Speech-to-Text: ${speechStatus}`);
      } else {
        addSystemMessage("⚠️ Microphone permission not granted. Please allow microphone access.");
      }

      setIsInitialized(true);
      addSystemMessage("🎯 Voice Coach initialized! Select a scenario or start practicing with the current customer profile.");
    } catch (error) {
      console.error('Failed to initialize Voice Coach:', error);
      
      // Ensure conversation exists even if initialization fails
      try {
        const example = getRandomPitchingExample();
        conversationService.createConversation(conversationId, userId, {
          customerName: customer?.name || 'Unknown Customer',
          scenario: example?.title || 'Error Recovery',
          protectionScore: customer?.protectionScore || 70
        });
      } catch (convError) {
        console.warn('Could not create conversation for error message:', convError);
      }
      
      addSystemMessage("⚠️ Microphone access required for voice coaching. Please allow microphone permission and refresh.");
    }
  };

  const setupVoiceListeners = () => {
    voiceService.on('volumeLevel', (level) => {
      setVolumeLevel(level);
    });

    voiceService.on('recordingStarted', () => {
      setIsRecording(true);
      setTranscribedText('');
      addSystemMessage("🎙️ Recording started successfully!");
    });

        voiceService.on('recordingStopped', () => {
          setIsRecording(false);
          setVolumeLevel(0);
          setIsTranscribing(false);
          // Processing message will be shown when audio is actually processed
        });

    voiceService.on('speechRecognitionStarted', () => {
      setIsTranscribing(true);
      addSystemMessage("🗣️ Speech recognition started - speak clearly!");
    });

    voiceService.on('speechRecognitionResult', (result) => {
      setTranscribedText(result.combined);
    });

    voiceService.on('speechRecognitionEnded', (result) => {
      setIsTranscribing(false);
      if (result.success && result.finalText && result.finalText.trim().length > 0) {
        addUserMessage(`💬 You said: "${result.finalText}"`);
        setTranscribedText(result.finalText);
      } else if (!result.success) {
        addSystemMessage("⚠️ No speech detected. Please try speaking louder or closer to the microphone.");
      }
    });

    voiceService.on('speechRecognitionError', (error) => {
      setIsTranscribing(false);
      console.error('Speech recognition error:', error);
      addSystemMessage(`⚠️ Speech recognition error: ${error}. Please try again.`);
    });

        voiceService.on('recordingComplete', async (audioBlob) => {
          if (audioBlob.size === 0) {
            addSystemMessage("⚠️ No audio recorded. Please try speaking louder or check microphone permissions.");
            return;
          }

          try {
            const audioBase64 = await voiceService.blobToBase64(audioBlob);
        
        // Get the final transcribed text
        const finalTranscribedText = transcribedText || voiceService.getTranscribedText().final;
        
            // Show immediate feedback while processing
            const transcriptionPreview = finalTranscribedText ? 
              ` Your message: "${finalTranscribedText.substring(0, 100)}${finalTranscribedText.length > 100 ? '...' : ''}"` : '';
            addSystemMessage(`🔄 Analyzing your pitch...${transcriptionPreview}\n\n⚡ AI coach response incoming!`);

            // Send audio data and transcribed text to AI for analysis
            setIsAiTyping(true);
        
        websocketService.send('voice_data', {
          audio: audioBase64,
          transcribedText: finalTranscribedText,
          customer: customer,
          scenario: currentExample,
          conversation_id: conversationId,
          user_id: userId,
          timestamp: Date.now(),
          audioSize: audioBlob.size,
          mimeType: audioBlob.type,
          hasTranscription: finalTranscribedText.length > 0
        });

          // Safety timeout for voice data analysis
          const voiceDataTimeout = setTimeout(() => {
            setIsAiTyping(false);
          }, 1500); // 1.5 second timeout for voice analysis
        
        // Store timeout ID for cleanup if needed
        window.voiceDataTimeout = voiceDataTimeout;

            // Audio info is now shown in the immediate feedback message above
      } catch (error) {
        console.error('Error processing audio:', error);
        addSystemMessage("⚠️ Failed to process audio. Please try again.");
      }
    });

    voiceService.on('error', (error) => {
      console.error('Voice service error:', error);
      addSystemMessage("⚠️ Voice recording error. Please try again.");
      setIsRecording(false);
      setVolumeLevel(0);
    });
  };

  const startSessionIfNeeded = () => {
    // Always start session when first recording, even if messages exist from connection
    const hasSessionStarted = messages.some(msg => msg.content.includes('Starting practice session'));
    
    if (!hasSessionStarted) {
      const welcomeMessage = currentExample
        ? `🎯 Starting practice session for: "${currentExample.title}"\n\n📋 Scenario: ${currentExample.scenario}\n\n💡 Key coaching tips:\n${currentExample.coachingTips.slice(0, 2).map(tip => `• ${tip}`).join('\n')}`
        : "🎯 Starting practice session with current customer profile.";

      addSystemMessage(welcomeMessage);

      // Start the session in the websocket service
      websocketService.send('start_pitch_session', {
        customer: customer,
        scenario: currentExample,
        conversation_id: conversationId,
        user_id: userId
      });

      sessionStartTime.current = Date.now();
    }
  };

  const toggleRecording = async () => {
    if (!isInitialized) {
      addSystemMessage("⚠️ Voice Coach not initialized. Please allow microphone access.");
      return;
    }

    try {
      if (isRecording) {
        await voiceService.stopRecording();
        setIsRecording(false);
        setVolumeLevel(0);
      } else {
        // Auto-start session if this is the first recording  
        startSessionIfNeeded();

        await voiceService.startRecording();
        setIsRecording(true);
        addSystemMessage("🎙️ Recording started. Speak your pitch!");
      }
    } catch (error) {
      console.error('Recording error:', error);
      addSystemMessage("⚠️ Recording failed. Please check microphone permissions and try again.");
      setIsRecording(false);
    }
  };

  const selectScenario = (scenarioId) => {
    const example = getPitchingExample(scenarioId);
    setCurrentExample(example);
    addSystemMessage(`🎯 Scenario selected: "${example.title}"\n\n📋 ${example.scenario}\n\n🎯 Suggested opening: "${example.suggestedPitch.opening}"`);
  };

      const addMessage = (content, type, score = null, extraData = {}) => {
        // Prevent duplicate messages within 1 second
        const messageKey = `${type}:${content}`;
        if (recentMessages.current.has(messageKey)) {
          return;
        }

        // Add to recent messages and remove after 1 second
        recentMessages.current.add(messageKey);
        setTimeout(() => {
          recentMessages.current.delete(messageKey);
        }, 1000);

        const message = {
          id: Date.now() + Math.random(),
          content,
          type,
          score,
          timestamp: new Date().toLocaleTimeString(),
          improvements: extraData.improvements || [],
          achievements: extraData.achievements || [],
          progressPercent: extraData.progressPercent || null,
          sessionResults: extraData.sessionResults || null
        };


    setMessages(prev => [...prev, message]);

    // Save to conversation service
    // Pre-check: ensure conversation exists before trying to save
    if (!conversationService.getConversation(conversationId)) {
      try {
        conversationService.createConversation(conversationId, userId, {
          customerName: customer?.name || 'Unknown Customer',
          scenario: currentExample?.title || 'Emergency Recovery Session',
          protectionScore: customer?.protectionScore || 70,
          emergencyRecreated: true,
          originalTimestamp: Date.now()
        });
      } catch (recreateError) {
        console.error('Failed to recreate conversation:', recreateError);
      }
    }
    
    try {
      conversationService.addMessage(conversationId, {
        content,
        type,
        score,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Failed to save message:', error);

      // Try to create conversation if it doesn't exist
      if (error.message && error.message.includes('not found')) {
        try {
          conversationService.createConversation(conversationId, userId, {
            customerName: customer?.name || 'Unknown Customer',
            scenario: currentExample?.title || 'Voice Coaching Session',
            protectionScore: customer?.protectionScore || 70,
            recoveredSession: true
          });

          // Retry saving the message
          conversationService.addMessage(conversationId, {
            content,
            type,
            score,
            timestamp: Date.now()
          });
        } catch (retryError) {
          console.error('Failed to recover conversation:', retryError);
        }
      }
    }

    // Update session stats
    if (type === 'ai' && score) {
      setSessionStats(prev => {
        const newCount = prev.messageCount + 1;
        const newAverage = ((prev.averageScore * prev.messageCount) + score) / newCount;
        return {
          ...prev,
          messageCount: newCount,
          averageScore: Math.round(newAverage)
        };
      });
    }
  };

      const addSystemMessage = (content) => addMessage(content, 'system');
      const addUserMessage = (content) => addMessage(content, 'user');
      const addAIMessage = (content, score = null, extraData = {}) => addMessage(content, 'ai', score, extraData);

  const getConversationHistory = () => {
    setShowHistory(true);
  };

  // Handler functions for Connect/Recording buttons
  const handleConnect = async () => {
    if (!isConnected) {
      addSystemMessage("🔄 Connecting to Voice Coach...");
      websocketService.connect();
    } else {
      await toggleRecording();
    }
  };

  const handleDisconnect = async () => {
    // Only stop recording, don't disconnect session
    await toggleRecording();
  };

  const cleanup = () => {
    voiceService.cleanup();
    websocketService.disconnect();
    
    // Clear any pending timeouts
    if (window.aiTypingTimeout) {
      clearTimeout(window.aiTypingTimeout);
      window.aiTypingTimeout = null;
    }
    if (window.voiceDataTimeout) {
      clearTimeout(window.voiceDataTimeout);
      window.voiceDataTimeout = null;
    }
    
    setIsInitialized(false);
    setIsRecording(false);
    setIsConnected(false);
    setVolumeLevel(0);
    setMessages([]);
    setCurrentExample(null);
    setIsAiTyping(false);
    setTranscribedText('');
    setIsTranscribing(false);
    recentMessages.current.clear();
  };

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  if (!isActive) return null;

  if (showHistory) {
    return (
      <ConversationHistory
        userId={userId}
        currentConversationId={conversationId}
        onClose={() => setShowHistory(false)}
        onSelectConversation={(conversation) => {
        // Could implement conversation loading here
        }}
      />
    );
  }

  return (
    <ThemeProvider>
      <div className="voice-coach voice-coach-enhanced">
      <div className="voice-coach-header">
        <h3>🎙️ Conversational Voice Coach</h3>
            <div className="coach-status">
              <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
              <span className="status-text">
                {isConnected ? 'AI Coach Ready' : 'Connecting...'}
              </span>
            </div>
      </div>

      {/* Session Stats */}
      <div className="session-stats">
        <div className="stat">
          <span className="stat-label">Time</span>
          <span className="stat-value">{formatTime(Date.now() - sessionStartTime.current)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Messages</span>
          <span className="stat-value">{sessionStats.messageCount}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Avg Score</span>
          <span className="stat-value">{sessionStats.averageScore || '—'}</span>
        </div>
      </div>

      {/* Scenario Selection */}
      <div className="scenario-section">
        <h4>Practice Scenarios</h4>
        <div className="scenario-buttons">
          <button 
            className={`scenario-btn ${!currentExample ? 'active' : ''}`}
            onClick={() => setCurrentExample(null)}
          >
            Current Customer
          </button>
          {pitchingExamples.slice(0, 5).map(example => (
            <button 
              key={example.id}
              className={`scenario-btn ${currentExample?.id === example.id ? 'active' : ''}`}
              onClick={() => selectScenario(example.id)}
            >
              {example.title}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="empty-chat">
            <p>🎯 Ready to practice your pitch!</p>
            <p>Select a scenario above and start recording to begin your voice coaching session.</p>
          </div>
            ) : (
              messages.map(message => (
                <div key={message.id} className={`message ${message.type}`}>
                  <div className="message-content">
                    {message.content.split('\n').map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                  </div>
                  
                  
                  {/* Enhanced AI Feedback Display */}
                  {message.type === 'ai' && (message.achievements?.length > 0 || message.improvements?.length > 0) && (
                    <div className="feedback-details">
                      {message.achievements?.length > 0 && (
                        <div className="achievements">
                          <strong>✅ Strengths:</strong>
                          <ul>
                            {message.achievements.map((achievement, i) => (
                              <li key={i}>{achievement}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {message.improvements?.length > 0 && (
                        <div className="improvements">
                          <strong>🎯 Next Steps:</strong>
                          <ul>
                            {message.improvements.map((improvement, i) => (
                              <li key={i}>{improvement}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Session Results Summary */}
                  {message.sessionResults && (
                    <div className="session-results">
                      <div className="results-grid">
                        <div className="result-item">
                          <span className="result-label">Success Rate:</span>
                          <span className="result-value">{message.sessionResults.satisfaction}%</span>
                        </div>
                        <div className="result-item">
                          <span className="result-label">Goals:</span>
                          <span className="result-value">{message.sessionResults.goalsAchieved}/{message.sessionResults.totalGoals}</span>
                        </div>
                        <div className="result-item">
                          <span className="result-label">Duration:</span>
                          <span className="result-value">{message.sessionResults.duration}m</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="message-meta">
                    <span className="message-time">{message.timestamp}</span>
                    {message.score && (
                      <span className="message-score">Score: {message.score}/100</span>
                    )}
                    {message.progressPercent && (
                      <span className="progress-indicator">Progress: {message.progressPercent}%</span>
                    )}
                  </div>
                </div>
              ))
            )}
        
            {/* AI Typing Indicator */}
            {isAiTyping && (
              <div className="message ai typing-indicator">
                <div className="message-content">
                  <div className="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <div className="typing-text">
                    🤖 AI Coach analyzing your voice...
                  </div>
                </div>
              </div>
            )}
        
        
        <div ref={messagesEndRef} />
      </div>

      {/* Professional Voice Controls with UI Kit */}
      <div className="voice-controls-container">
        {!isInitialized ? (
          <div className="initialization-loading">
            <SpinLoader />
            <span>Initializing Voice Coach...</span>
          </div>
        ) : (
          <>
            {/* Professional Voice Visualizer */}
            {isRecording && (
              <div className="voice-visualizer-section">
                <VoiceVisualizer 
                  participantType="user"
                  barCount={5}
                  minBarHeight={2}
                  maxBarHeight={14}
                  frequency={volumeLevel}
                />
              </div>
            )}
            
            {/* Live Transcription (Keep existing) */}
            {isTranscribing && (
              <div className={`live-transcription ${transcribedText ? 'active' : ''}`}>
                <div className="transcription-header">🗣️ Live Transcription</div>
                <div className={`transcription-text ${!transcribedText ? 'listening' : ''}`}>
                  {transcribedText ? 
                    transcribedText : 
                    <span style={{fontStyle: 'italic', opacity: 0.8}}>🎤 Start speaking to see your words appear here</span>
                  }
                </div>
                <div className="transcription-hint">
                  Click "Stop Recording" when finished
                </div>
              </div>
            )}
            
            {/* Professional Control Bar */}
            <ControlBar className="voice-coach-controls">
                  {/* Main Action Button */}
                  {!isConnected ? (
                    <button
                      onClick={handleConnect}
                      disabled={!isInitialized}
                      className="primary-action-btn"
                    >
                      🔌 Connect to Voice Coach
                    </button>
                  ) : (
                    <button
                      onClick={isRecording ? handleDisconnect : handleConnect}
                      disabled={!isInitialized}
                      className={`primary-action-btn ${isRecording ? 'recording-active' : 'recording-ready'}`}
                    >
                      {isRecording ? (
                        <>
                          <span className="btn-icon">⏹️</span>
                          <span className="btn-text">Stop & Get Feedback</span>
                        </>
                      ) : (
                        <>
                          <span className="btn-icon">🎤</span>
                          <span className="btn-text">Start Recording</span>
                        </>
                      )}
                    </button>
                  )}
              
              {/* Debug Info */}
              {isRecording && (
                <div className="recording-status-modern">
                  🔴 Volume: {Math.round(volumeLevel * 100)}%
                </div>
              )}
            </ControlBar>
          </>
        )}
      </div>


          {/* Action Buttons */}
          <div className="coach-actions">
            <button onClick={getConversationHistory} className="history-btn">
              📜 View History
            </button>
            
            {/* End Session Button - Only show when connected */}
            {isConnected && (
              <button
                onClick={() => {
                  websocketService.disconnect();
                  setIsConnected(false);
                  setIsRecording(false);
                  addSystemMessage("🔌 Coaching session ended. Great work!");
                }}
                className="end-session-btn"
              >
                🔌 End Session
              </button>
            )}
            
            <button onClick={onClose} className="close-coach-btn">
              ✕ Close Coach
            </button>
          </div>
      </div>
    </ThemeProvider>
  );
};

export default VoiceCoach;
