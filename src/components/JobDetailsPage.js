import React, { useState, useEffect } from 'react';
import './JobDetailsPage.css';
import SmartPitchModal from './SmartPitchModal';
import { getCurrentCustomer, getCurrentTime, getJobStepStatus, getNetworkStatus, subscribeToUpdates } from '../services/customerService';

const JobDetailsPage = () => {
  const [isSmartPitchOpen, setIsSmartPitchOpen] = useState(false);
  const [customer, setCustomer] = useState(getCurrentCustomer());
  const [currentTime, setCurrentTime] = useState(getCurrentTime());
  const [jobStatus, setJobStatus] = useState(getJobStepStatus());
  const [networkStatus, setNetworkStatus] = useState(getNetworkStatus());

  useEffect(() => {
    // Update time every minute
    const timeInterval = setInterval(() => {
      setCurrentTime(getCurrentTime());
    }, 60000);

    // Update network status every 10 seconds
    const networkInterval = setInterval(() => {
      setNetworkStatus(getNetworkStatus());
    }, 10000);

    // Update job status every 5 minutes
    const jobInterval = setInterval(() => {
      setJobStatus(getJobStepStatus());
    }, 300000);

    // Subscribe to customer updates
    const unsubscribe = subscribeToUpdates((newCustomer) => {
      setCustomer(newCustomer);
    });

    return () => {
      clearInterval(timeInterval);
      clearInterval(networkInterval);
      clearInterval(jobInterval);
      unsubscribe();
    };
  }, []);

  const handleOpenSmartPitch = () => {
    setIsSmartPitchOpen(true);
  };

  const handleCloseSmartPitch = () => {
    setIsSmartPitchOpen(false);
  };

  return (
    <div className="job-details-page">
      {/* Status Bar */}
      <div className="status-bar">
        <span className="time">{currentTime}</span>
        <div className="status-icons">
          <span className="signal">{networkStatus.signal}</span>
          <span className="wifi">{networkStatus.wifi}</span>
          <span className="battery">{networkStatus.battery}</span>
        </div>
      </div>

      {/* Header */}
      <div className="header">
        <button className="back-btn">←</button>
        <h1 className="customer-name">{customer.name}</h1>
        <button className="menu-btn">⋮</button>
      </div>

      {/* Customer Info */}
      <div className="customer-info">
        <div className="customer-details">
          <h2>{customer.name}</h2>
          <p className="schedule">Scheduled {customer.appointmentTime}</p>
          <div className="service-info">
            <span className="verizon-logo">📱 Verizon</span>
            <span className="service-type">{customer.serviceType}</span>
          </div>
        </div>
        <div className="action-buttons">
          <button className="call-btn">📞</button>
          <button className="message-btn">💬</button>
        </div>
      </div>

      {/* Customer Description */}
      <div className="customer-description">
        <p>Family of {customer.familySize}, {customer.children}, {customer.lifestyle}, {customer.techUsage}</p>
        <div className="description-footer">
          <button onClick={handleOpenSmartPitch} className="generate-pitch-btn">
            ✨ Generate smart pitch
          </button>
          <small className="last-updated">
            Updated: {new Date(customer.lastUpdated).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            })}
          </small>
        </div>
      </div>

      {/* Job Steps */}
      <div className="job-steps">
        <div className="tabs">
          <button className="tab active">Job steps</button>
          <button className="tab">Details</button>
        </div>
        
        <div className="steps-content">
          <h3>Steps</h3>
          <div className="step-list">
            {jobStatus.steps.map((step) => (
              <div key={step.id} className={`step ${step.active ? 'active' : ''} ${step.completed ? 'completed' : ''}`}>
                <span className="step-number">{step.id}</span>
                <span className="step-text">{step.text}</span>
                {step.active && <span className="step-arrow">›</span>}
                {step.completed && <span className="step-check">✓</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Offers */}
      <div className="top-offers">
        <h3>Top offers</h3>
        <div className="offers-grid">
          <div className="offer-card">
            <div className="offer-header">
              <h4>Verizon 5G Home Internet</h4>
              <button className="add-btn">+</button>
            </div>
            <div className="offer-image">📡</div>
          </div>
          <div className="offer-card highlight">
            <div className="offer-header">
              <h4>Verizon Home Device Protect</h4>
              <button className="add-btn">+</button>
            </div>
            <div className="offer-image">
              <div className="device-protect-icon">
                <span className="protection-score">{customer.protectionScore}</span>
              </div>
            </div>
            <div className="smart-pitch-indicator">✨ Smart pitch</div>
          </div>
        </div>
        <button className="view-all-btn button button-secondary">View all offers</button>
      </div>

      {/* Bottom Action */}
      <div className="bottom-action">
        <button className="complete-btn button button-secondary">Complete and close</button>
      </div>

      {/* Smart Pitch Modal */}
      <SmartPitchModal 
        isOpen={isSmartPitchOpen} 
        onClose={handleCloseSmartPitch}
        customer={customer}
      />
    </div>
  );
};

export default JobDetailsPage;
