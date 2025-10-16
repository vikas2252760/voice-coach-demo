import React, { useEffect, useState } from 'react';
import './SmartPitchModal.css';
import VoiceCoach from './VoiceCoach';

const SmartPitchModal = ({ isOpen, onClose, customer }) => {
  const [activeTab, setActiveTab] = useState('pitch');
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button className="close-modal" onClick={onClose}>✕</button>
        
        {/* Scrollable Modal Body */}
        <div className="modal-body">
          {/* Product Header */}
          <div className="product-header">
            <div className="product-details">
              <h3>Verizon Home Device Protect</h3>
              <div className="device-protect-icon">
                <span className="protection-score">{customer?.protectionScore || 70}</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="tabs">
            <button 
              className={`tab ${activeTab === 'pitch' ? 'active' : ''}`}
              onClick={() => setActiveTab('pitch')}
            >
              Smart pitch
            </button>
            <button 
              className={`tab ${activeTab === 'coach' ? 'active' : ''}`}
              onClick={() => setActiveTab('coach')}
            >
              🎙️ Voice Coach
            </button>
            <button 
              className={`tab ${activeTab === 'coverage' ? 'active' : ''}`}
              onClick={() => setActiveTab('coverage')}
            >
              Coverage details
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'pitch' && (
            <>
              {/* Guidance Section */}
              <div className="guidance-section">
                <h4>Guidance</h4>
                <div className="guidance-content">
                  <span className="guidance-icon">👥</span>
                  <p>{customer?.guidance || "Empathize with busy family life. Focus on simplicity and future-proofing their growing tech needs."}</p>
                </div>
              </div>

              {/* Pitch Section */}
              <div className="pitch-section">
                <h4>Pitch</h4>
                <div className="pitch-points">
                  {(customer?.pitchPoints || [
                    "As your kids grow, VHDP auto-covers new eligible tablets or smart speakers — no need to add them later",
                    "If ADH occurs on your laptop, we'll repair, replace, or reimburse for covered breakdowns",
                    "One plan protects your tablet, laptop, and eligible future tech — no juggling multiple plans"
                  ]).map((point, index) => (
                    <div key={index} className="pitch-point">
                      <span className="point-number">{index + 1}</span>
                      <p>{point}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'coach' && (
            <div className="voice-coach-container">
              <VoiceCoach 
                customer={customer}
                isActive={true}
                onClose={() => setActiveTab('pitch')}
              />
            </div>
          )}

          {activeTab === 'coverage' && (
            <div className="coverage-section">
              <h4>Coverage Details</h4>
              <div className="coverage-content">
                <div className="coverage-item">
                  <h5>📱 Device Coverage</h5>
                  <p>Smartphones, tablets, laptops, smart speakers, and eligible connected devices</p>
                </div>
                <div className="coverage-item">
                  <h5>🛡️ Protection Types</h5>
                  <p>Accidental damage, liquid damage, mechanical breakdown, and theft protection</p>
                </div>
                <div className="coverage-item">
                  <h5>🔧 Service Options</h5>
                  <p>Repair, replacement, or reimbursement based on device and damage type</p>
                </div>
                <div className="coverage-item">
                  <h5>⚡ Response Time</h5>
                  <p>Same-day replacement for eligible devices, 24/7 technical support</p>
                </div>
                <div className="coverage-item">
                  <h5>💰 Cost Structure</h5>
                  <p>Monthly subscription with low deductibles, no hidden fees</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fixed Bottom Action */}
        <div className="enrollment-action">
          <button className="start-enrollment-btn button button-primary">
            Start enrollment
          </button>
        </div>
      </div>
    </div>
  );
};

export default SmartPitchModal;
