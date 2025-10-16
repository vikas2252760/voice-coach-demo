// Conversation history service for Voice Coach
// Handles storing and retrieving chat history with conversation_id and user_id

class ConversationService {
  constructor() {
    this.conversations = new Map();
    this.userConversations = new Map();
    this.initializeFromStorage();
  }

  // Initialize conversations from localStorage
  initializeFromStorage() {
    try {
      const stored = localStorage.getItem('voiceCoachConversations');
      if (stored) {
        const data = JSON.parse(stored);
        this.conversations = new Map(data.conversations || []);
        this.userConversations = new Map(data.userConversations || []);
      }
    } catch (error) {
      console.error('Failed to load conversation history:', error);
      this.conversations = new Map();
      this.userConversations = new Map();
    }
  }

  // Save conversations to localStorage
  saveToStorage() {
    try {
      const data = {
        conversations: Array.from(this.conversations.entries()),
        userConversations: Array.from(this.userConversations.entries()),
        lastUpdated: Date.now()
      };
      localStorage.setItem('voiceCoachConversations', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save conversation history:', error);
    }
  }

  // Create a new conversation
  createConversation(conversationId, userId, metadata = {}) {
    // Check if conversation already exists
    if (this.conversations.has(conversationId)) {
      return this.conversations.get(conversationId);
    }
    
    const conversation = {
      id: conversationId,
      userId: userId,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {
        customerName: metadata.customerName || 'Unknown Customer',
        scenario: metadata.scenario || 'General Practice',
        ...metadata
      },
      stats: {
        totalMessages: 0,
        userMessages: 0,
        aiMessages: 0,
        averageScore: 0,
        sessionDuration: 0
      }
    };

    this.conversations.set(conversationId, conversation);

    // Add to user's conversation list
    if (!this.userConversations.has(userId)) {
      this.userConversations.set(userId, []);
    }
    this.userConversations.get(userId).push(conversationId);

    this.saveToStorage();
    return conversation;
  }

  // Add a message to a conversation
  addMessage(conversationId, message) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const messageWithId = {
      id: `msg_${Date.now()}_${Math.random().toString(36)}`,
      timestamp: Date.now(),
      ...message
    };

    conversation.messages.push(messageWithId);
    conversation.updatedAt = Date.now();

    // Update stats
    conversation.stats.totalMessages++;
    if (message.type === 'user') {
      conversation.stats.userMessages++;
    } else if (message.type === 'ai') {
      conversation.stats.aiMessages++;
      
      // Update average score if message has a score
      if (message.score) {
        const aiMessagesWithScore = conversation.messages.filter(
          m => m.type === 'ai' && m.score
        );
        const totalScore = aiMessagesWithScore.reduce((sum, m) => sum + m.score, 0);
        conversation.stats.averageScore = Math.round(totalScore / aiMessagesWithScore.length);
      }
    }

    this.saveToStorage();
    return messageWithId;
  }

  // Get conversation by ID
  getConversation(conversationId) {
    return this.conversations.get(conversationId);
  }

  // Get all conversations for a user
  getUserConversations(userId) {
    const userConvIds = this.userConversations.get(userId) || [];
    return userConvIds
      .map(id => this.conversations.get(id))
      .filter(conv => conv)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // Get conversation history (messages only)
  getConversationHistory(conversationId) {
    const conversation = this.conversations.get(conversationId);
    return conversation ? conversation.messages : [];
  }

  // Search conversations
  searchConversations(userId, query, filters = {}) {
    const userConversations = this.getUserConversations(userId);
    
    return userConversations.filter(conversation => {
      // Text search in messages
      if (query) {
        const hasMatchingMessage = conversation.messages.some(message =>
          message.content.toLowerCase().includes(query.toLowerCase())
        );
        const hasMatchingCustomer = conversation.metadata.customerName
          .toLowerCase().includes(query.toLowerCase());
        const hasMatchingScenario = conversation.metadata.scenario
          .toLowerCase().includes(query.toLowerCase());
        
        if (!hasMatchingMessage && !hasMatchingCustomer && !hasMatchingScenario) {
          return false;
        }
      }

      // Date filter
      if (filters.dateFrom && conversation.createdAt < filters.dateFrom) {
        return false;
      }
      if (filters.dateTo && conversation.createdAt > filters.dateTo) {
        return false;
      }

      // Score filter
      if (filters.minScore && conversation.stats.averageScore < filters.minScore) {
        return false;
      }

      return true;
    });
  }

  // Get conversation statistics
  getConversationStats(conversationId) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return null;

    const now = Date.now();
    const sessionDuration = now - conversation.createdAt;
    
    return {
      ...conversation.stats,
      sessionDuration,
      formattedDuration: this.formatDuration(sessionDuration),
      messageRate: conversation.stats.totalMessages / (sessionDuration / 60000), // messages per minute
      lastActivity: conversation.updatedAt
    };
  }

  // Get user statistics
  getUserStats(userId) {
    const userConversations = this.getUserConversations(userId);
    
    if (userConversations.length === 0) {
      return {
        totalConversations: 0,
        totalMessages: 0,
        averageScore: 0,
        totalPracticeTime: 0,
        improvementTrend: 0
      };
    }

    const totalMessages = userConversations.reduce((sum, conv) => sum + conv.stats.totalMessages, 0);
    const totalPracticeTime = userConversations.reduce((sum, conv) => 
      sum + (conv.updatedAt - conv.createdAt), 0);
    
    // Calculate average score
    const conversationsWithScores = userConversations.filter(conv => conv.stats.averageScore > 0);
    const averageScore = conversationsWithScores.length > 0
      ? Math.round(conversationsWithScores.reduce((sum, conv) => sum + conv.stats.averageScore, 0) / conversationsWithScores.length)
      : 0;

    // Calculate improvement trend (last 5 vs first 5 conversations)
    let improvementTrend = 0;
    if (conversationsWithScores.length >= 2) {
      const recent = conversationsWithScores.slice(0, Math.min(5, conversationsWithScores.length));
      const older = conversationsWithScores.slice(-Math.min(5, conversationsWithScores.length));
      
      const recentAvg = recent.reduce((sum, conv) => sum + conv.stats.averageScore, 0) / recent.length;
      const olderAvg = older.reduce((sum, conv) => sum + conv.stats.averageScore, 0) / older.length;
      
      improvementTrend = Math.round(recentAvg - olderAvg);
    }

    return {
      totalConversations: userConversations.length,
      totalMessages,
      averageScore,
      totalPracticeTime,
      formattedPracticeTime: this.formatDuration(totalPracticeTime),
      improvementTrend
    };
  }

  // Export conversation data
  exportConversation(conversationId, format = 'json') {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return null;

    const exportData = {
      conversation: conversation,
      exportedAt: Date.now(),
      format: format
    };

    if (format === 'json') {
      return JSON.stringify(exportData, null, 2);
    } else if (format === 'csv') {
      return this.convertToCSV(conversation);
    } else if (format === 'text') {
      return this.convertToText(conversation);
    }

    return exportData;
  }

  // Convert conversation to CSV format
  convertToCSV(conversation) {
    const headers = ['Timestamp', 'Type', 'Content', 'Score'];
    const rows = conversation.messages.map(msg => [
      new Date(msg.timestamp).toLocaleString(),
      msg.type,
      `"${msg.content.replace(/"/g, '""')}"`,
      msg.score || ''
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  // Convert conversation to readable text format
  convertToText(conversation) {
    const header = `Voice Coach Conversation Export
Customer: ${conversation.metadata.customerName}
Scenario: ${conversation.metadata.scenario}
Started: ${new Date(conversation.createdAt).toLocaleString()}
Duration: ${this.formatDuration(conversation.updatedAt - conversation.createdAt)}
Messages: ${conversation.stats.totalMessages}
Average Score: ${conversation.stats.averageScore}/100

--- Conversation ---
`;

    const messages = conversation.messages.map(msg => {
      const timestamp = new Date(msg.timestamp).toLocaleTimeString();
      const score = msg.score ? ` (Score: ${msg.score}/100)` : '';
      const speaker = msg.type === 'user' ? 'You' : msg.type === 'ai' ? 'AI Coach' : 'System';
      
      return `[${timestamp}] ${speaker}${score}: ${msg.content}`;
    }).join('\n\n');

    return header + messages;
  }

  // Format duration in human-readable format
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // Delete a conversation
  deleteConversation(conversationId) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return false;

    // Remove from user's conversation list
    const userId = conversation.userId;
    const userConvIds = this.userConversations.get(userId) || [];
    const updatedIds = userConvIds.filter(id => id !== conversationId);
    this.userConversations.set(userId, updatedIds);

    // Delete the conversation
    this.conversations.delete(conversationId);
    
    this.saveToStorage();
    return true;
  }

  // Clear all conversations for a user
  clearUserConversations(userId) {
    const userConvIds = this.userConversations.get(userId) || [];
    
    // Delete all conversations
    userConvIds.forEach(id => {
      this.conversations.delete(id);
    });

    // Clear user's conversation list
    this.userConversations.set(userId, []);
    
    this.saveToStorage();
    return userConvIds.length;
  }

  // Get recent activity
  getRecentActivity(userId, limit = 10) {
    const userConversations = this.getUserConversations(userId);
    
    const activities = [];
    
    userConversations.forEach(conversation => {
      // Add conversation start
      activities.push({
        type: 'conversation_started',
        timestamp: conversation.createdAt,
        conversationId: conversation.id,
        data: {
          customerName: conversation.metadata.customerName,
          scenario: conversation.metadata.scenario
        }
      });

      // Add significant messages (AI feedback with scores)
      conversation.messages
        .filter(msg => msg.type === 'ai' && msg.score)
        .forEach(msg => {
          activities.push({
            type: 'feedback_received',
            timestamp: msg.timestamp,
            conversationId: conversation.id,
            data: {
              score: msg.score,
              feedback: msg.content.substring(0, 100) + '...'
            }
          });
        });
    });

    return activities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
}

// Singleton instance
const conversationService = new ConversationService();

export default conversationService;
