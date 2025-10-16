import React, { useState, useEffect } from 'react';
import './ConversationHistory.css';
import conversationService from '../services/conversationService';

const ConversationHistory = ({ userId, currentConversationId, onClose, onSelectConversation }) => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    minScore: 0
  });
  const [userStats, setUserStats] = useState(null);
  const [view, setView] = useState('list'); // 'list', 'detail', 'stats'

  useEffect(() => {
    loadConversations();
    loadUserStats();
  }, [userId, searchQuery, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadConversations = () => {
    let userConversations;
    
    if (searchQuery || filters.dateFrom || filters.dateTo || filters.minScore > 0) {
      userConversations = conversationService.searchConversations(userId, searchQuery, {
        dateFrom: filters.dateFrom ? new Date(filters.dateFrom).getTime() : null,
        dateTo: filters.dateTo ? new Date(filters.dateTo).getTime() : null,
        minScore: filters.minScore
      });
    } else {
      userConversations = conversationService.getUserConversations(userId);
    }
    
    setConversations(userConversations);
  };

  const loadUserStats = () => {
    const stats = conversationService.getUserStats(userId);
    setUserStats(stats);
  };

  const handleConversationSelect = (conversation) => {
    setSelectedConversation(conversation);
    setView('detail');
  };

  const handleDeleteConversation = (conversationId, event) => {
    event.stopPropagation();
    
    if (window.confirm('Are you sure you want to delete this conversation?')) {
      conversationService.deleteConversation(conversationId);
      loadConversations();
      loadUserStats();
      
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(null);
        setView('list');
      }
    }
  };

  const handleExportConversation = (conversationId, format) => {
    const exportData = conversationService.exportConversation(conversationId, format);
    if (!exportData) return;

    const conversation = conversationService.getConversation(conversationId);
    const filename = `voice-coach-${conversation.metadata.customerName.replace(/\s+/g, '-')}-${new Date(conversation.createdAt).toISOString().split('T')[0]}.${format}`;
    
    const blob = new Blob([exportData], { 
      type: format === 'json' ? 'application/json' : 'text/plain' 
    });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const clearAllConversations = () => {
    if (window.confirm('Are you sure you want to delete all conversations? This action cannot be undone.')) {
      const deletedCount = conversationService.clearUserConversations(userId);
      alert(`Deleted ${deletedCount} conversations.`);
      loadConversations();
      loadUserStats();
      setSelectedConversation(null);
      setView('list');
    }
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  };

  const getScoreColor = (score) => {
    if (score >= 90) return '#10b981';
    if (score >= 80) return '#f59e0b';
    if (score >= 70) return '#ef4444';
    return '#6b7280';
  };

  return (
    <div className="conversation-history">
      <div className="history-header">
        <div className="header-title">
          <h3>📜 Conversation History</h3>
          <button onClick={onClose} className="close-history-btn">✕</button>
        </div>
        
        <div className="view-tabs">
          <button 
            className={`view-tab ${view === 'list' ? 'active' : ''}`}
            onClick={() => setView('list')}
          >
            📋 List
          </button>
          <button 
            className={`view-tab ${view === 'stats' ? 'active' : ''}`}
            onClick={() => setView('stats')}
          >
            📊 Stats
          </button>
        </div>
      </div>

      {view === 'list' && (
        <>
          {/* Search and Filters */}
          <div className="search-section">
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            
            <div className="filters">
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                className="filter-input"
                title="From date"
              />
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                className="filter-input"
                title="To date"
              />
              <select
                value={filters.minScore}
                onChange={(e) => setFilters({...filters, minScore: parseInt(e.target.value)})}
                className="filter-select"
              >
                <option value={0}>All Scores</option>
                <option value={70}>70+ Score</option>
                <option value={80}>80+ Score</option>
                <option value={90}>90+ Score</option>
              </select>
            </div>
          </div>

          {/* Conversation List */}
          <div className="conversations-list">
            {conversations.length === 0 ? (
              <div className="empty-history">
                <p>📭 No conversations found</p>
                <p>Start practicing to build your conversation history!</p>
              </div>
            ) : (
              conversations.map(conversation => (
                <div 
                  key={conversation.id}
                  className={`conversation-item ${conversation.id === currentConversationId ? 'current' : ''}`}
                  onClick={() => handleConversationSelect(conversation)}
                >
                  <div className="conversation-main">
                    <div className="conversation-header">
                      <h4>{conversation.metadata.customerName}</h4>
                      <span className="conversation-date">
                        {formatDate(conversation.updatedAt)}
                      </span>
                    </div>
                    
                    <p className="conversation-scenario">
                      {conversation.metadata.scenario}
                    </p>
                    
                    <div className="conversation-stats">
                      <span className="stat">
                        💬 {conversation.stats.totalMessages}
                      </span>
                      <span className="stat">
                        ⏱️ {conversationService.formatDuration(conversation.updatedAt - conversation.createdAt)}
                      </span>
                      {conversation.stats.averageScore > 0 && (
                        <span 
                          className="stat score"
                          style={{ color: getScoreColor(conversation.stats.averageScore) }}
                        >
                          📊 {conversation.stats.averageScore}/100
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="conversation-actions">
                    <button
                      onClick={(e) => handleExportConversation(conversation.id, 'text', e)}
                      className="action-btn export"
                      title="Export conversation"
                    >
                      📤
                    </button>
                    <button
                      onClick={(e) => handleDeleteConversation(conversation.id, e)}
                      className="action-btn delete"
                      title="Delete conversation"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {conversations.length > 0 && (
            <div className="history-actions">
              <button onClick={clearAllConversations} className="clear-all-btn">
                🗑️ Clear All History
              </button>
            </div>
          )}
        </>
      )}

      {view === 'detail' && selectedConversation && (
        <div className="conversation-detail">
          <div className="detail-header">
            <button onClick={() => setView('list')} className="back-btn">← Back</button>
            <h4>{selectedConversation.metadata.customerName}</h4>
            <div className="export-options">
              <button 
                onClick={() => handleExportConversation(selectedConversation.id, 'text')}
                className="export-btn"
              >
                📄 Text
              </button>
              <button 
                onClick={() => handleExportConversation(selectedConversation.id, 'json')}
                className="export-btn"
              >
                💾 JSON
              </button>
            </div>
          </div>
          
          <div className="conversation-metadata">
            <div className="metadata-item">
              <span className="label">Scenario:</span>
              <span className="value">{selectedConversation.metadata.scenario}</span>
            </div>
            <div className="metadata-item">
              <span className="label">Started:</span>
              <span className="value">{new Date(selectedConversation.createdAt).toLocaleString()}</span>
            </div>
            <div className="metadata-item">
              <span className="label">Duration:</span>
              <span className="value">
                {conversationService.formatDuration(selectedConversation.updatedAt - selectedConversation.createdAt)}
              </span>
            </div>
            <div className="metadata-item">
              <span className="label">Average Score:</span>
              <span className="value" style={{ color: getScoreColor(selectedConversation.stats.averageScore) }}>
                {selectedConversation.stats.averageScore}/100
              </span>
            </div>
          </div>
          
          <div className="messages-detail">
            {selectedConversation.messages.map(message => (
              <div key={message.id} className={`message-detail ${message.type}`}>
                <div className="message-header">
                  <span className="message-type">
                    {message.type === 'user' ? '👤 You' : message.type === 'ai' ? '🤖 AI Coach' : '⚙️ System'}
                  </span>
                  <span className="message-time">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                  {message.score && (
                    <span className="message-score-detail" style={{ color: getScoreColor(message.score) }}>
                      {message.score}/100
                    </span>
                  )}
                </div>
                <div className="message-content-detail">
                  {message.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'stats' && userStats && (
        <div className="user-stats">
          <h4>📊 Your Practice Statistics</h4>
          
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-number">{userStats.totalConversations}</div>
              <div className="stat-label">Total Sessions</div>
            </div>
            
            <div className="stat-card">
              <div className="stat-number">{userStats.totalMessages}</div>
              <div className="stat-label">Messages Sent</div>
            </div>
            
            <div className="stat-card">
              <div className="stat-number" style={{ color: getScoreColor(userStats.averageScore) }}>
                {userStats.averageScore}/100
              </div>
              <div className="stat-label">Average Score</div>
            </div>
            
            <div className="stat-card">
              <div className="stat-number">{userStats.formattedPracticeTime}</div>
              <div className="stat-label">Practice Time</div>
            </div>
            
            <div className="stat-card">
              <div className={`stat-number ${userStats.improvementTrend >= 0 ? 'positive' : 'negative'}`}>
                {userStats.improvementTrend >= 0 ? '+' : ''}{userStats.improvementTrend}
              </div>
              <div className="stat-label">Improvement Trend</div>
            </div>
          </div>
          
          <div className="achievements">
            <h5>🏆 Achievements</h5>
            <div className="achievement-list">
              {userStats.totalConversations >= 10 && (
                <div className="achievement">🎯 Dedicated Practitioner - 10+ sessions</div>
              )}
              {userStats.averageScore >= 85 && (
                <div className="achievement">⭐ Excellence in Pitching - 85+ average score</div>
              )}
              {userStats.improvementTrend >= 10 && (
                <div className="achievement">📈 Rising Star - Strong improvement trend</div>
              )}
              {userStats.totalPracticeTime >= 3600000 && (
                <div className="achievement">⏰ Time Investment - 1+ hour of practice</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationHistory;
