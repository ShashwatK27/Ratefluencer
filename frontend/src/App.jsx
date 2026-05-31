import React, { useState } from 'react';
import './styles/global.css';
import { config } from './config.js';

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

function Toast({ message, onDone }) {
  React.useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t); }, []);
  return <div className="toast">✓ {message}</div>;
}

export default function App() {
  const [currentPage, setCurrentPage] = useState('landing');
  const [campaignMeta, setCampaignMeta] = useState(null);
  const [recos, setRecos] = useState([]);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); };
  const hideToast = () => setToast(null);

  const navigate = (page) => {
    setCurrentPage(page);
    window.scrollTo(0, 0);
  };

  const handleCampaignSubmit = async (formData) => {
    setLoading(true);
    setError(null);

    const formatBudget = (v) => '₹' + parseInt(v).toLocaleString('en-IN');
    setCampaignMeta({
      cats: formData.selectedCategories.join(', ') || 'General',
      budget: formatBudget(formData.budget),
      budgetRaw: formData.budget,
      ageGroup: formData.ageGroup,
    });

    try {
      const campaignText = `Brand/Product: ${formData.brand || 'General Product'}. Campaign: ${formData.name || 'General Campaign'}. Goal: ${formData.goal}. Target Audience: ${formData.audience || `Audience aged ${formData.ageGroup}`}. Niche category focus: ${formData.selectedCategories.join(', ')}.`;
      
      const response = await fetch(config.api.endpoints.match, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_text: campaignText,
          campaign_goal: formData.goal,
          category_filters: formData.selectedCategories,
          min_authenticity: formData.minAuth,
          tier_filter: formData.tier,
          min_engagement_rate: formData.minEr,
          excluded_brands: formData.excludedBrands,
          top_k: 3
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setRecos(data.recommendations);
      setInsights(data.insights);
      setCurrentPage('recommendations');
    } catch (err) {
      console.error("Failed to fetch matches:", err);
      setError("AI analysis failed. No live recommendations were loaded.");
      setRecos([]);
      setInsights([]);
      setCurrentPage('recommendations');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar currentPage={currentPage} onNavigate={navigate} />

      {currentPage === 'landing' && (
        <LandingPage onNavigate={navigate} />
      )}
      {currentPage === 'dashboard' && (
        <Dashboard currentPage={currentPage} onNavigate={navigate} />
      )}
      {currentPage === 'campaign' && (
        <Campaign onNavigate={navigate} onCampaignSubmit={handleCampaignSubmit} />
      )}
      {currentPage === 'recommendations' && (
        <Recommendations
          campaignMeta={campaignMeta}
          recos={recos}
          insights={insights}
          onNavigate={navigate}
          onToast={showToast}
        />
      )}
      {currentPage === 'viralLab' && (
        <ViralLab onNavigate={navigate} />
      )}
      {currentPage === 'aiAgent' && (
        <AIAgent onNavigate={navigate} />
      )}
      {currentPage === 'authenticity' && (
        <AuthenticityPage currentPage={currentPage} onNavigate={navigate} />
      )}
      {currentPage === 'growthEngine' && (
        <GrowthEnginePage currentPage={currentPage} onNavigate={navigate} />
      )}
      {currentPage === 'brandMatch' && (
        <BrandMatchPage currentPage={currentPage} onNavigate={navigate} />
      )}
      {currentPage === 'shortlist' && (
        <ShortlistPage currentPage={currentPage} onNavigate={navigate} />
      )}
      {currentPage === 'preferences' && (
        <PreferencesPage currentPage={currentPage} onNavigate={navigate} />
      )}
      {currentPage === 'insights' && (
        <InsightsPage currentPage={currentPage} onNavigate={navigate} />
      )}
      {currentPage === 'realCreators' && (
        <RealCreatorsPage currentPage={currentPage} onNavigate={navigate} />
      )}

      {toast && <Toast message={toast} onDone={hideToast} />}

      {loading && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(11, 13, 15, 0.9)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          gap: '1.5rem',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            border: '4px solid rgba(200, 240, 104, 0.1)',
            borderTopColor: 'var(--accent)',
            animation: 'spin 1s linear infinite'
          }} />
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', letterSpacing: '-0.02em', fontWeight: 600 }}>
            Analyzing Creator Ecosystem...
          </div>
          <p style={{ color: 'var(--text2)', fontSize: '14px', maxWidth: '380px', textAlign: 'center', lineHeight: 1.6 }}>
            Our RandomForest growth engines and XGBoost safety models are evaluating 5,000 profiles for authenticity, virality, and category relevance.
          </p>
        </div>
      )}
    </>
  );
}
