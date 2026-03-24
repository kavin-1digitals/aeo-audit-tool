import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuditProvider } from './contexts/AuditContext';
import { Home } from './pages/Home';
import AeoReportPage from './pages/AeoReportPage';
import './index.css';

function App() {
  return (
    <AuditProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/report" element={<AeoReportPage />} />
              <Route path="*" element={<Home />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuditProvider>
  );
}

export default App;
