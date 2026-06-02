import React from 'react';
import { useNavigate } from 'react-router-dom';

const TEAM = [
  {
    name:  'Shashwat',
    role:  'Full-Stack & ML Engineer',
    desc:  'Built the backend ML pipeline — XGBoost authenticity model, RandomForest growth engine, LightGBM viral classifier, and the Flask API layer.',
    avatar:'SK',
    color1:'rgba(200,240,104,0.15)',
    color2:'var(--accent)',
  },
  {
    name:  'Vaidehi Turkar',
    role:  'Frontend & Product Engineer',
    desc:  'Designed and built the entire React frontend — Campaign wizard, Creator Dashboard, AI Agent interface, and the ContentStudio workflow.',
    avatar:'VT',
    color1:'rgba(104,184,240,0.15)',
    color2:'var(--blue)',
  },
];

const MODELS = [
  { name: 'XGBoost Authenticity',   metric: 'ROC-AUC 0.982',  desc: '64K real fake/authentic accounts', color: 'var(--blue)'   },
  { name: 'RandomForest Growth',    metric: 'R² 0.62',         desc: 'YouTube time-series, 16 lag features', color: 'var(--gold)'   },
  { name: 'LightGBM Viral v2',      metric: 'Acc 81.3%',       desc: 'TF-IDF + structural, pre-publish signals', color: 'var(--accent)' },
  { name: 'XGBoost Meta-Learner',   metric: 'R² 0.996',        desc: 'Niche-relative composite score', color: 'var(--coral)'  },
  { name: 'ChromaDB Brand Match',   metric: '1,500 creators',  desc: 'SentenceTransformer + stratified niche index', color: 'var(--purple)' },
  { name: 'RandomForest Trend',     metric: 'F1 0.846',        desc: 'Trained on 234K YouTube analytics rows', color: '#68D4F0'       },
];

const FEATURES = [
  { icon: '🛡️', title: 'Fake Follower Detection',   desc: 'XGBoost classifier detects purchased followers, engagement pods, and bot activity before brands invest.' },
  { icon: '📈', title: 'Growth Prediction',          desc: 'RandomForest regressor forecasts 7-day subscriber momentum using real YouTube time-series lag features.' },
  { icon: '🎯', title: 'AI Brand Matching',          desc: 'ChromaDB + SentenceTransformers semantic search with cross-niche audience overlap scoring.' },
  { icon: '🔥', title: 'Real-Time Trend Discovery',  desc: 'Google Trends + Reddit + YouTube Data API + Live News RSS — 4 real-time sources merged and ML-scored.' },
  { icon: '🤖', title: 'Autonomous AI Agent',        desc: '5-iteration content refinement loop with learned style preferences from upvote history.' },
  { icon: '🎬', title: 'AI Visual Storyboard',       desc: 'Pollinations.ai generates scene-by-scene visual images for reel production — free, instant.' },
  { icon: '📊', title: 'SHAP Explainability',        desc: 'TreeExplainer shows which features drove each authenticity and growth score.' },
  { icon: '🔍', title: 'Content Quality NLP',        desc: 'SentenceTransformer semantic similarity scores content against 150 real viral reference examples.' },
];

export default function AboutPage() {
  const navigate = useNavigate();

  return (
    <div style={{ paddingTop: '56px', minHeight: '100vh' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '4rem 2rem' }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: '5rem' }}>
          <div className="section-label" style={{ marginBottom: '12px' }}>Ratefluencer AI Hackathon 2026</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '52px', lineHeight: 1.1, marginBottom: '16px' }}>
            The Future of<br />
            <em style={{ color: 'var(--accent)', fontStyle: 'italic' }}>Influencer Intelligence</em>
          </h1>
          <p style={{ fontSize: '18px', color: 'var(--text2)', maxWidth: '600px', margin: '0 auto 2rem', lineHeight: 1.7 }}>
            Ratefluencer is an AI-powered platform that helps brands identify high-performing creators
            and helps creators grow — through real machine learning, not vanity metrics.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => navigate('/campaign')} style={{ padding: '12px 28px', fontSize: '14px' }}>
              Start a Campaign
            </button>
            <button className="btn btn-ghost" onClick={() => navigate('/dashboard')} style={{ padding: '12px 28px', fontSize: '14px' }}>
              Explore Creators
            </button>
          </div>
        </div>

        {/* Vision */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '2.5rem', marginBottom: '3rem' }}>
          <div className="section-label" style={{ marginBottom: '12px' }}>Our Vision</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', marginBottom: '16px' }}>
            Influence should be measurable, not guessable.
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--text2)', lineHeight: 1.8, marginBottom: '16px' }}>
            Every year, brands invest billions in influencer marketing — yet most decisions are still
            based on follower counts and gut feel. Fake followers cost the industry an estimated
            <strong style={{ color: 'var(--text)' }}> $1.3B annually</strong>. Campaigns fail because
            the wrong creators were chosen for the wrong reasons.
          </p>
          <p style={{ fontSize: '15px', color: 'var(--text2)', lineHeight: 1.8 }}>
            Ratefluencer replaces guesswork with machine learning. We train real models on real data,
            detect fraud before it costs money, predict growth before it happens, and match brands to
            creators whose audiences actually care about what they are selling.
          </p>
        </div>

        {/* Problem + Solution */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '3rem' }}>
          <div style={{ background: 'rgba(240,120,104,0.05)', border: '1px solid rgba(240,120,104,0.2)', borderRadius: 'var(--radius)', padding: '2rem' }}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>⚠️</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', marginBottom: '12px', color: 'var(--coral)' }}>The Problem</h3>
            <ul style={{ fontSize: '14px', color: 'var(--text2)', lineHeight: 2, paddingLeft: '16px' }}>
              <li>Follower counts don't predict campaign success</li>
              <li>Fake engagement inflates creator value</li>
              <li>Brand-creator matching is manual and slow</li>
              <li>Trend discovery is subjective and delayed</li>
              <li>No data-backed content virality prediction</li>
            </ul>
          </div>
          <div style={{ background: 'rgba(200,240,104,0.05)', border: '1px solid rgba(200,240,104,0.2)', borderRadius: 'var(--radius)', padding: '2rem' }}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>✦</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', marginBottom: '12px', color: 'var(--accent)' }}>Our Solution</h3>
            <ul style={{ fontSize: '14px', color: 'var(--text2)', lineHeight: 2, paddingLeft: '16px' }}>
              <li>ML-powered Ratefluencer™ Score (0-100)</li>
              <li>XGBoost fraud detection — ROC-AUC 0.982</li>
              <li>Semantic brand matching via ChromaDB + RAG</li>
              <li>4-source real-time trends with ML scoring</li>
              <li>Pre-publish viral prediction from content signals</li>
            </ul>
          </div>
        </div>

        {/* ML Models */}
        <div style={{ marginBottom: '3rem' }}>
          <div className="section-label" style={{ marginBottom: '8px' }}>Under the Hood</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', marginBottom: '20px' }}>
            6 Trained ML Models
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {MODELS.map(m => (
              <div key={m.name} style={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '1.25rem',
                borderLeft: `3px solid ${m.color}`,
              }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: m.color, marginBottom: '4px' }}>
                  {m.metric}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>{m.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text3)', lineHeight: 1.5 }}>{m.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div style={{ marginBottom: '3rem' }}>
          <div className="section-label" style={{ marginBottom: '8px' }}>What We Built</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', marginBottom: '20px' }}>
            Full Ecosystem — Both Tracks
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{
                display: 'flex', gap: '14px', alignItems: 'flex-start',
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '1.25rem',
              }}>
                <div style={{ fontSize: '24px', flexShrink: 0, marginTop: '2px' }}>{f.icon}</div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>{f.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text3)', lineHeight: 1.6 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Data */}
        <div style={{ background: 'linear-gradient(135deg, rgba(200,240,104,0.06), rgba(104,184,240,0.06))', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', padding: '2.5rem', marginBottom: '3rem', textAlign: 'center' }}>
          <div className="section-label" style={{ marginBottom: '16px' }}>By the Numbers</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            {[
              { value: '33,935', label: 'Real Creators' },
              { value: '6',      label: 'ML Models Trained' },
              { value: '28',     label: 'API Endpoints' },
              { value: '38',     label: 'Automated Tests' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '36px', color: 'var(--accent)', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '6px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Team */}
        <div style={{ marginBottom: '3rem' }}>
          <div className="section-label" style={{ marginBottom: '8px' }}>The Team</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {TEAM.map(member => (
              <div key={member.name} style={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '1.75rem',
                display: 'flex', gap: '16px', alignItems: 'flex-start',
              }}>
                <div style={{
                  width: '52px', height: '52px', borderRadius: '50%', flexShrink: 0,
                  background: member.color1, color: member.color2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700,
                  border: `2px solid ${member.color2}40`,
                }}>
                  {member.avatar}
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '3px' }}>{member.name}</div>
                  <div style={{ fontSize: '12px', color: member.color2, fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>{member.role}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text3)', lineHeight: 1.6 }}>{member.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', marginBottom: '12px' }}>
            Ready to find your perfect creator?
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--text2)', marginBottom: '2rem' }}>
            Run a campaign in under 60 seconds — backed by real ML models.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/campaign')}
            style={{ padding: '14px 36px', fontSize: '15px', borderRadius: '100px' }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 12px 40px rgba(200,240,104,0.3)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
          >
            Launch Your Campaign
          </button>
        </div>

      </div>
    </div>
  );
}
