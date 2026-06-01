import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './styles/global.css';

import { AppProvider, useApp } from './context/AppContext.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Navbar from './components/Navbar.jsx';

import LandingPage from './pages/LandingPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Campaign from './pages/Campaign.jsx';
import Recommendations from './pages/Recommendations.jsx';
import ViralLab from './pages/ViralLab.jsx';
import AIAgent from './pages/AIAgent.jsx';
import AuthenticityPage from './pages/AuthenticityPage.jsx';
import GrowthEnginePage from './pages/GrowthEnginePage.jsx';
import BrandMatchPage from './pages/BrandMatchPage.jsx';
import ShortlistPage from './pages/ShortlistPage.jsx';
import PreferencesPage from './pages/PreferencesPage.jsx';
import InsightsPage from './pages/InsightsPage.jsx';
import RealCreatorsPage from './pages/RealCreatorsPage.jsx';
import CreatorProfile from './pages/CreatorProfile.jsx';
import TrendRanking from './pages/TrendRanking.jsx';
import CreatorCorner from './pages/CreatorCorner.jsx';
import ContentStudio from './pages/ContentStudio.jsx';
import InfluencerPortal from './pages/InfluencerPortal.jsx';
import NotFound from './pages/NotFound.jsx';

function ToastContainer() {
  const { toasts } = useApp();
  if (toasts.length === 0) return null;
  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px',
      zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px',
    }}>
      {toasts.map(t => (
        <div key={t.id} className="toast">✓ {t.msg}</div>
      ))}
    </div>
  );
}

function AppRoutes() {
  return (
    <>
      <Navbar />
      <ErrorBoundary>
        <Routes>
          <Route path="/"                 element={<LandingPage />} />
          <Route path="/dashboard"        element={<Dashboard />} />
          <Route path="/campaign"         element={<Campaign />} />
          <Route path="/recommendations"  element={<Recommendations />} />
          <Route path="/viral-lab"        element={<ViralLab />} />
          <Route path="/ai-agent"         element={<AIAgent />} />
          <Route path="/authenticity"     element={<AuthenticityPage />} />
          <Route path="/growth-engine"    element={<GrowthEnginePage />} />
          <Route path="/brand-match"      element={<BrandMatchPage />} />
          <Route path="/shortlist"        element={<ShortlistPage />} />
          <Route path="/preferences"      element={<PreferencesPage />} />
          <Route path="/insights"         element={<InsightsPage />} />
          <Route path="/real-creators"    element={<RealCreatorsPage />} />
          <Route path="/trend-ranking"    element={<TrendRanking />} />
          <Route path="/creator-profile"  element={<CreatorProfile />} />
          <Route path="/creator-corner"    element={<CreatorCorner />} />
          <Route path="/content-studio"   element={<ContentStudio />} />
          <Route path="/influencer-portal" element={<InfluencerPortal />} />
          <Route path="*"                  element={<NotFound />} />
        </Routes>
      </ErrorBoundary>
      <ToastContainer />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  );
}
