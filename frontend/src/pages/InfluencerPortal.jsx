import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { config } from '../config.js';

const NICHES = ['Fashion', 'Food', 'Travel', 'Family', 'Beauty', 'Fitness', 'Interior', 'Pet', 'Other'];

const TIER_META = {
  Elite:       { color: 'var(--gold)',   bg: 'rgba(240,201,106,0.1)',  border: 'rgba(240,201,106,0.3)',  desc: 'Top 5% of creators. Brands actively seek you out.' },
  Premium:     { color: 'var(--accent)', bg: 'rgba(200,240,104,0.08)', border: 'rgba(200,240,104,0.25)', desc: 'Strong profile. Ready for mid-to-large brand deals.' },
  Established: { color: 'var(--blue)',   bg: 'rgba(104,184,240,0.08)', border: 'rgba(104,184,240,0.25)', desc: 'Solid foundation. Micro-brand partnerships are within reach.' },
  Growing:     { color: 'var(--coral)',  bg: 'rgba(240,120,104,0.08)', border: 'rgba(240,120,104,0.25)', desc: 'Early stage. Focus on consistency and engagement quality.' },
  Emerging:    { color: 'var(--purple)', bg: 'rgba(176,104,240,0.08)', border: 'rgba(176,104,240,0.25)', desc: 'Just getting started. Build your content history first.' },
};

const SCORE_BARS = [
  { key: 'brand_match',  label: 'Brand Match',          color: 'var(--coral)'  },
  { key: 'authenticity', label: 'Authenticity',          color: 'var(--blue)'   },
  { key: 'growth',       label: 'Growth Momentum',       color: 'var(--gold)'   },
  { key: 'engagement',   label: 'Engagement Quality',    color: 'var(--accent)' },
  { key: 'virality',     label: 'Viral Potential (ML)',  color: '#F068B8'       },
  { key: 'consistency',  label: 'Posting Consistency',   color: 'var(--purple)' },
  { key: 'share_rate',   label: 'Share Rate',            color: '#68D4F0'       },
];

function ScoreBar({ label, value, color }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text2)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '22px', lineHeight: 1, color }}>{value}</span>
      </div>
      <div style={{ height: '4px', background: 'var(--bg3)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ height: '4px', background: color, borderRadius: '2px', width: `${Math.min(100, value)}%`, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontSize: '12px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.04em', fontFamily: 'var(--font-mono)' }}>{label}</label>
      {children}
    </div>
  );
}

const FORM_DEFAULT = {
  name: '', handle: '', niche: 'Fashion',
  followers: '', avg_likes: '', avg_comments: '',
  avg_shares: '', posts: '',
};

export default function InfluencerPortal() {
  const navigate   = useNavigate();
  const onNavigate = (path) => navigate('/' + path);
  const [form,    setForm]    = useState(FORM_DEFAULT);
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Auto-compute engagement rate from actual counts (shown as hint, not required)
  const computedER = (() => {
    const f = Number(form.followers) || 0;
    const l = Number(form.avg_likes) || 0;
    const c = Number(form.avg_comments) || 0;
    if (!f) return null;
    return ((l + c) / f * 100).toFixed(2);
  })();

  const handleSubmit = async () => {
    if (!form.followers || !form.avg_likes) {
      setError('Followers and Avg Likes per Post are required.'); return;
    }
    setLoading(true); setError(null);
    try {
      const followers    = Number(form.followers);
      const avg_likes    = Number(form.avg_likes)    || 0;
      const avg_comments = Number(form.avg_comments) || 0;
      const avg_shares   = Number(form.avg_shares)   || 0;
      // Derive ER from actual counts -- no manual ER input needed
      const derived_er   = followers > 0 ? (avg_likes + avg_comments) / followers * 100 : 3.0;

      const res = await fetch(config.api.endpoints.influencerProfile, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:            form.name || 'Creator',
          handle:          form.handle,
          niche:           form.niche.toLowerCase(),
          followers,
          avg_likes,
          avg_comments,
          avg_shares,
          posts:           Number(form.posts) || 0,
          // Send derived ER so backend can use it where needed
          engagement_rate: parseFloat(derived_er.toFixed(2)),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scoring failed.');
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const tier = result ? TIER_META[result.tier] || TIER_META.Emerging : null;
  const rf   = result?.ratefluencer_score ?? 0;
  const ringOffset = 201 * (1 - rf / 100);

  return (
    <div style={{ paddingTop: '56px', minHeight: '100vh' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '3rem 2rem' }}>
        <button onClick={() => navigate('/')} className="btn btn-ghost btn-sm" style={{ fontSize: '13px', marginBottom: '1.5rem' }}>← Home</button>

        {/* Header */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div className="section-label" style={{ marginBottom: '8px' }}>For Creators</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '40px', marginBottom: '8px', lineHeight: 1.1 }}>
            Discover your<br /><em style={{ color: 'var(--accent)', fontStyle: 'italic' }}>Ratefluencer™ Score</em>
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--text2)', maxWidth: '520px', lineHeight: 1.7 }}>
            See exactly how brands evaluate your profile. Enter your stats and our AI scores you across 6 signals  -  the same models brands use to shortlist creators.
          </p>
        </div>

        {/* Form */}
        <div className="shine-card" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '2rem', marginBottom: '2rem', overflow: 'hidden' }}>
          <div style={{ fontSize: '13px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '1.5rem' }}>Your Profile</div>
          {/* Row 1: Identity */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <FormField label="Name / Brand">
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Priya Sharma" style={{ fontSize: '13px' }} />
            </FormField>
            <FormField label="Instagram Handle">
              <input value={form.handle} onChange={e => set('handle', e.target.value)} placeholder="@yourhandle" style={{ fontSize: '13px' }} />
            </FormField>
            <FormField label="Primary Niche">
              <select value={form.niche} onChange={e => set('niche', e.target.value)} style={{ fontSize: '13px' }}>
                {NICHES.map(n => <option key={n}>{n}</option>)}
              </select>
            </FormField>
          </div>

          {/* Row 2: Core counts (replaces ER -- actual counts give the model real signals) */}
          <div style={{ padding: '12px 14px', background: 'rgba(200,240,104,0.04)', border: '1px solid rgba(200,240,104,0.15)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
            <div style={{ fontSize: '11px', color: 'var(--accent)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '10px' }}>
              Per-Post Averages * — model scores from actual counts, not engagement rate
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              <FormField label="Followers *">
                <input type="number" value={form.followers} onChange={e => set('followers', e.target.value)} placeholder="e.g. 85000" style={{ fontSize: '13px' }} />
              </FormField>
              <FormField label="Avg Likes / Post *">
                <input type="number" value={form.avg_likes} onChange={e => set('avg_likes', e.target.value)} placeholder="e.g. 3200" style={{ fontSize: '13px' }} />
              </FormField>
              <FormField label="Avg Comments / Post">
                <input type="number" value={form.avg_comments} onChange={e => set('avg_comments', e.target.value)} placeholder="e.g. 140" style={{ fontSize: '13px' }} />
              </FormField>
              <FormField label="Avg Shares / Post">
                <input type="number" value={form.avg_shares} onChange={e => set('avg_shares', e.target.value)} placeholder="e.g. 80" style={{ fontSize: '13px' }} />
              </FormField>
              <FormField label="Total Posts">
                <input type="number" value={form.posts} onChange={e => set('posts', e.target.value)} placeholder="e.g. 320" style={{ fontSize: '13px' }} />
              </FormField>

              {/* Auto-computed ER display */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.04em', fontFamily: 'var(--font-mono)' }}>
                  Computed ER (auto)
                </label>
                <div style={{ height: '38px', display: 'flex', alignItems: 'center', padding: '0 12px', borderRadius: '6px', background: 'var(--bg3)', border: '1px solid var(--border)', fontSize: '15px', fontFamily: 'var(--font-display)', color: computedER ? 'var(--accent)' : 'var(--text3)' }}>
                  {computedER ? `${computedER}%` : '—'}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text3)' }}>
                  (likes + comments) / followers
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div style={{ fontSize: '12px', color: 'var(--coral)', padding: '8px 12px', background: 'rgba(240,120,104,0.08)', borderRadius: '6px', border: '1px solid rgba(240,120,104,0.2)', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading}
            style={{ width: '100%', fontSize: '14px', opacity: loading ? 0.7 : 1, justifyContent: 'center' }}
          >
            {loading ? 'Scoring your profile...' : 'Analyze My Profile ->'}
          </button>
        </div>

        {/* Results */}
        {result && (
          <div className="fade-up">
            {/* Score + Tier card */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>

              {/* Left: Big score */}
              <div style={{ background: tier.bg, border: `1px solid ${tier.border}`, borderRadius: 'var(--radius)', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', textAlign: 'center' }}>
                <div style={{ position: 'relative', width: '120px', height: '120px' }}>
                  <svg viewBox="0 0 120 120" width="120" height="120" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
                    <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                    <circle cx="60" cy="60" r="48" fill="none" stroke={tier.color} strokeWidth="8" strokeDasharray="301" strokeDashoffset={301 * (1 - rf / 100)} strokeLinecap="round" />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '36px', lineHeight: 1, color: tier.color }}>{rf}</span>
                    <span style={{ fontSize: '9px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Score</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: tier.color, marginBottom: '4px' }}>{result.tier}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text2)', lineHeight: 1.5, maxWidth: '200px' }}>{tier.desc}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px', fontSize: '12px', color: 'var(--text3)' }}>
                  <span style={{ fontWeight: 500, color: 'var(--text)' }}>{result.handle}</span>
                  <span>.</span>
                  <span>{result.niche}</span>
                </div>
                {result.computed_er && (
                  <div style={{ padding: '6px 14px', borderRadius: '20px', background: 'rgba(200,240,104,0.08)', border: '1px solid rgba(200,240,104,0.2)', fontSize: '12px', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                    Computed ER: {result.computed_er}%
                  </div>
                )}
              </div>

              {/* Right: Score bars */}
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem' }}>
                <div style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '1.25rem' }}>Score Breakdown</div>
                {SCORE_BARS.map(bar => (
                  <ScoreBar
                    key={bar.key}
                    label={bar.label}
                    value={result.scores[bar.key] ?? 0}
                    color={bar.color}
                  />
                ))}
              </div>
            </div>

            {/* Top matching categories */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '1.25rem' }}>Best Brand Category Matches</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '1rem' }}>
                {result.top_categories.map((cat, i) => (
                  <div key={cat.category} style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', background: i === 0 ? 'rgba(200,240,104,0.06)' : 'var(--bg3)', border: `1px solid ${i === 0 ? 'rgba(200,240,104,0.2)' : 'var(--border)'}`, textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: i === 0 ? 'var(--accent)' : 'var(--text)', marginBottom: '2px' }}>{cat.match}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.04em', fontFamily: 'var(--font-mono)' }}>{cat.category}</div>
                    {i === 0 && <div style={{ fontSize: '10px', color: 'var(--accent)', marginTop: '4px' }}>Best fit</div>}
                  </div>
                ))}
              </div>
              {/* All categories mini list */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {result.all_categories.slice(3).map(cat => (
                  <span key={cat.category} style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', border: '1px solid var(--border)', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                    {cat.category} {cat.match}
                  </span>
                ))}
              </div>
            </div>

            {/* Improvement tips */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '1.25rem' }}>
                {result.improvement_tips[0]?.signal === 'All Clear' ? '✓ Profile Analysis' : 'How to Improve Your Score'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {result.improvement_tips.map((tip, i) => (
                  <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px', borderRadius: 'var(--radius-sm)', background: tip.signal === 'All Clear' ? 'rgba(200,240,104,0.04)' : 'rgba(255,255,255,0.02)', border: `1px solid ${tip.signal === 'All Clear' ? 'rgba(200,240,104,0.15)' : 'var(--border)'}` }}>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: tip.signal === 'All Clear' ? 'var(--accent-dim)' : 'var(--bg3)', color: tip.signal === 'All Clear' ? 'var(--accent)' : 'var(--text3)', fontFamily: 'var(--font-mono)', flexShrink: 0, marginTop: '1px' }}>{tip.signal}</span>
                    <span style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.6 }}>{tip.msg}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-primary" onClick={() => onNavigate('campaign')} style={{ fontSize: '13px' }}>
                Find Matching Campaigns ->
              </button>
              <button className="btn btn-ghost" onClick={() => { setResult(null); setForm(FORM_DEFAULT); }} style={{ fontSize: '13px' }}>
                Re-evaluate
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
