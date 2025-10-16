import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import JobDetailsPage from './components/JobDetailsPage';

function App() {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <div className="App">
        <Routes>
          <Route path="/" element={<Navigate to="/job-details" replace />} />
          <Route path="/job-details" element={<JobDetailsPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
