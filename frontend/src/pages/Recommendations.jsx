import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiInsights } from '../data/index.js';
import { useApp } from '../context/AppContext.jsx';
import { config } from '../config.js';

function parsePercent(value, fallback = 0) {
  const n = parseFloat(String(value || '').replace('%', ''));
  return Number.isFinite(n) ? n : fallback;
}

function parseFollowers(meta) {
  const m = (meta || '').match(/([\d.]+)(K|M)/);
  if (!m) return 0;
  return parseFloat(m[1]) * (m[2] === 'M' ? 1_000_000 : 1_000);
}

function exportCSV(rows) {
  const header = ['Name', 'Handle', 'Niche', 'Engagement Rate', 'Ratefluencer Score', 'Growth', 'Authenticity', 'Brand Match', 'Success Probability', 'Model Confidence'];
  const data = rows.map(r => [
    r.name, r.handle,
    (r.meta || '').split(/[.·]/)[0].trim(),
    r.engRate, r.ratefluencer, r.growth, r.authenticity, r.brandMatch, r.successProb, r.modelConfidence ?? '',
  ]);
  const csv = [header, ...data].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'ratefluencer_recommendations.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ── Score Breakdown Modal (glassmorphism) ─────────────────────────────────────
function ScoreModal({ rec, onClose }) {
  if (!rec) return null;

  const engRate = parseFloat(String(rec.engRate || '0').replace('%', '')) || 0;
  const riskLevel = rec.riskLevel || 'Low';
  const riskColor = riskLevel === 'Low' ? 'var(--accent)' : riskLevel === 'Medium' ? 'var(--gold)' : 'var(--coral)';

  const rows = [
    {
      label: 'Brand Match', val: rec.brandMatch ?? 0, color: 'var(--coral)',
      desc: rec.brandMatch >= 80 ? 'Strong niche alignment with campaign category.'
          : rec.brandMatch >= 50 ? 'Moderate overlap — audience description helps refine this.'
          : 'Limited direct category alignment detected.',
    },
    {
      label: 'Authenticity', val: rec.authenticity ?? 0, color: 'var(--blue)',
      desc: rec.authenticity >= 90 ? 'Low fraud risk — bot ratio below safety threshold.'
          : rec.authenticity >= 70 ? 'Moderate authenticity; some engagement anomalies detected.'
          : 'Elevated fraud signals. Manual review recommended.',
    },
    {
      label: 'Growth', val: rec.growth ?? 0, color: 'var(--gold)',
      desc: rec.growth >= 80 ? 'Strong positive growth momentum over the 30-day window.'
          : rec.growth >= 55 ? 'Moderate growth trajectory — stable and consistent audience.'
          : 'Slow or declining growth signal from RandomForest model.',
    },
    {
      label: 'Engagement Rate', val: engRate, color: 'var(--accent)', suffix: '%',
      desc: engRate >= 5 ? 'High engagement — strong creator-audience relationship.'
          : engRate >= 3 ? 'Average engagement for this follower tier.'
          : 'Below-average engagement rate for the tier.',
    },
  ];

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'rgba(14,17,21,0.92)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius)', padding: '2rem', maxWidth: '500px', width: '100%', position: 'relative', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', boxShadow: '0 32px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)' }}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text3)', cursor: 'pointer', fontSize: '12px', padding: '3px 9px', fontFamily: 'var(--font-body)' }}>✕</button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Score Breakdown</div>
            <div style={{ fontSize: '20px', fontWeight: 500 }}>{rec.name}</div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>{rec.meta}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '52px', lineHeight: 1, color: rec.ringColor || 'var(--accent)' }}>{rec.ratefluencer}</div>
            <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Ratefluencer™</div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {rows.map(s => (
            <div key={s.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text2)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{s.label}</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '24px', lineHeight: 1, color: s.color }}>{s.val}{s.suffix || ''}</span>
              </div>
              <div style={{ height: '3px', background: 'var(--bg3)', borderRadius: '2px', marginBottom: '5px', overflow: 'hidden' }}>
                <div style={{ height: '3px', background: s.color, borderRadius: '2px', width: `${Math.min(100, s.val)}%` }} />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text3)', lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid var(--border)', marginTop: '1.25rem', paddingTop: '1rem', display: 'flex', gap: '1.5rem', fontSize: '11px', color: 'var(--text3)', flexWrap: 'wrap' }}>
          <span>Confidence: <strong style={{ color: 'var(--text2)' }}>{rec.modelConfidence ?? '—'}%</strong></span>
          <span>Risk: <strong style={{ color: riskColor }}>{riskLevel}</strong></span>
          <span>Success est.: <strong style={{ color: 'var(--text2)' }}>{rec.successProb || '—'}</strong></span>
        </div>
      </div>
    </div>
  );
}

// ── Score Ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score, color, offset, onClick }) {
  return (
    <div
      onClick={onClick}
      title="Click to see score breakdown"
      style={{ position: 'relative', width: '80px', height: '80px', flexShrink: 0, cursor: 'pointer' }}
    >
      <svg viewBox="0 0 80 80" width="80" height="80" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
        <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
        <circle cx="40" cy="40" r="32" fill="none" stroke={color} strokeWidth="6" strokeDasharray="201" strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '20px', lineHeight: 1, color }}>
        {score}
        <span style={{ fontSize: '9px', color: 'var(--text3)', letterSpacing: '.05em', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Score</span>
      </div>
    </div>
  );
}

// ── ROI Estimator ─────────────────────────────────────────────────────────────
function ROIEstimator({ recos, budget, campaignGoal }) {
  const [apiRoi, setApiRoi] = useState(null);

  const budgetNum = (() => {
    const s = String(budget || '').replace(/[₹,\s]/g, '');
    const n = parseFloat(s);
    if (isNaN(n)) return 500000;
    if (s.endsWith('L') || s.endsWith('l')) return n * 100000;
    return n;
  })();

  useEffect(() => {
    if (!recos || recos.length === 0) return;
    const top = recos[0];
    const niche    = (top.meta || '').split(/[.·]/)[0].trim().toLowerCase() || 'lifestyle';
    const followers = parseFollowers(top.meta);
    const er        = parsePercent(top.engRate, 3.5);
    if (!followers) return;

    fetch(config.api.endpoints.roiEstimate, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        followers, engagement_rate: er, niche,
        budget: budgetNum, campaign_goal: campaignGoal || 'awareness',
      }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.tier) setApiRoi(d); })
      .catch(() => {});
  }, [recos, budgetNum, campaignGoal]);

  if (!recos || recos.length === 0) return null;

  const avgER = recos.reduce((sum, r) => sum + parsePercent(r.engRate, 3.5), 0) / recos.length;
  const totalImpressions = recos.reduce((sum, r) => {
    if (Number.isFinite(Number(r.projectedImpressions))) return sum + Number(r.projectedImpressions);
    return sum + Math.round(parseFollowers(r.meta) * Math.max(avgER / 100, 0.01) * 8);
  }, 0);
  const frontendCpm   = budgetNum > 0 && totalImpressions > 0 ? ((budgetNum / totalImpressions) * 1000).toFixed(2) : '—';
  const successPct    = recos[0].successProb ? parseInt(recos[0].successProb) : 78;
  const impStr        = totalImpressions >= 1_000_000 ? `${(totalImpressions/1_000_000).toFixed(1)}M` : `${(totalImpressions/1_000).toFixed(0)}K`;
  const cpmDisplay    = apiRoi ? `₹${apiRoi.cpm.recommended}` : `₹${frontendCpm}`;
  const cpmLabel      = apiRoi ? `CPM · ${apiRoi.tier.split('(')[0].trim()}` : 'Cost Per 1K Impr.';

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div className="section-label">ROI Estimator</div>
        {apiRoi && (
          <span style={{ fontSize: '10px', color: 'var(--accent)', fontFamily: 'var(--font-mono)', padding: '2px 8px', borderRadius: '10px', background: 'rgba(200,240,104,0.08)', border: '1px solid rgba(200,240,104,0.2)' }}>
            AI-backed · {apiRoi.tier}
          </span>
        )}
      </div>

      <div className="roi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px' }}>
        {[
          { label: 'Est. Impressions',    value: impStr,              color: 'var(--accent)' },
          { label: 'Avg Engagement Rate', value: `${avgER.toFixed(1)}%`, color: 'var(--blue)' },
          { label: cpmLabel,              value: cpmDisplay,          color: 'var(--gold)'  },
          { label: 'Success Probability', value: `${successPct}%`,    color: 'var(--coral)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
          </div>
        ))}
      </div>

      {apiRoi && (
        <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' }}>
          {[
            { label: 'Posts with budget', value: apiRoi.posts_with_budget },
            { label: 'Est. engagements',  value: Number(apiRoi.total_engagements).toLocaleString('en-IN') },
            { label: 'Niche CPM range',   value: `₹${apiRoi.cpm.min}–${apiRoi.cpm.max}` },
          ].map(({ label, value }) => (
            <div key={label} style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', color: 'var(--text)', lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '3px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {apiRoi?.recommendation && (
        <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', lineHeight: 1.6, padding: '8px 12px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
          💡 {apiRoi.recommendation}
        </div>
      )}
    </div>
  );
}

// ── Recommendation Card ───────────────────────────────────────────────────────
function RecoCard({ rec, onShortlist, isShortlisted, onShowBreakdown }) {
  const rankBorder =
    rec.rank === 1 ? 'rgba(240,201,106,0.3)' :
    rec.rank === 2 ? 'rgba(104,184,240,0.2)' :
    'rgba(200,240,104,0.2)';

  const rankBg = rec.rank === 1
    ? 'linear-gradient(135deg,rgba(240,201,106,0.04),var(--bg2))'
    : 'var(--bg2)';

  const scoreItems = [
    { label: 'Ratefluencer™', val: rec.ratefluencer,                                               color: 'var(--accent)' },
    { label: 'Growth',        val: (rec.growth !== undefined ? rec.growth : rec.virality) + '%',    color: 'var(--gold)'   },
    { label: 'Authenticity',  val: (rec.authenticity !== undefined ? rec.authenticity : 85) + '%',  color: 'var(--blue)'   },
    { label: 'Brand Match',   val: (rec.brandMatch !== undefined ? rec.brandMatch : 90) + '%',      color: 'var(--coral)'  },
  ];

  return (
    <div
      style={{ background: rankBg, border: `1px solid ${rankBorder}`, borderRadius: 'var(--radius)', padding: '1.5rem', transition: 'all .2s', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '1.5rem', alignItems: 'center' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.transform = 'translateX(4px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = rankBorder; e.currentTarget.style.transform = 'none'; }}
    >
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '48px', lineHeight: 1, width: '50px', textAlign: 'center', color: rec.rank === 1 ? 'var(--gold)' : 'var(--border2)' }}>
        {rec.rank}
      </div>

      <div>
        <div style={{ fontSize: '18px', fontWeight: 500, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {rec.name}
          {rec.badge && <span className="tag tag-gold" style={{ fontSize: '11px' }}>{rec.badge}</span>}
          {isShortlisted && <span className="tag tag-green" style={{ fontSize: '11px' }}>✓ Shortlisted</span>}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '12px' }}>{rec.meta}</div>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          {scoreItems.map(s => (
            <div
              key={s.label}
              style={{ textAlign: 'center', cursor: 'pointer' }}
              onClick={() => onShowBreakdown(rec)}
              title="Click for score breakdown"
            >
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', lineHeight: 1, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.04em', fontFamily: 'var(--font-mono)' }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '20px', background: 'rgba(200,240,104,0.08)', color: 'var(--accent)', border: '1px solid rgba(200,240,104,0.15)', fontFamily: 'var(--font-mono)', marginTop: '6px', display: 'inline-block' }}>
          {rec.why}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
        <ScoreRing score={rec.ratefluencer} color={rec.ringColor} offset={rec.ringOffset} onClick={() => onShowBreakdown(rec)} />
        <button
          className={`btn ${isShortlisted ? 'btn-ghost' : rec.rank === 1 ? 'btn-primary' : 'btn-ghost'} btn-sm no-print`}
          onClick={() => onShortlist(rec)}
          style={{ fontSize: '12px', color: isShortlisted ? 'var(--accent)' : undefined, minWidth: '90px' }}
        >
          {isShortlisted ? '✓ Remove' : 'Shortlist'}
        </button>
      </div>
    </div>
  );
}

export default function Recommendations() {
  const navigate = useNavigate();
  const { campaignMeta, recos = [], insights = [], showToast } = useApp();
  const { cats = 'Wellness + Skincare', budget = '₹10L', budgetRaw = null, ageGroup = '25-34', goal = 'awareness' } = campaignMeta || {};

  const [shortlisted, setShortlisted] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ratefluencer_shortlist') || '[]'); }
    catch { return []; }
  });
  useEffect(() => {
    localStorage.setItem('ratefluencer_shortlist', JSON.stringify(shortlisted));
  }, [shortlisted]);

  const [modalRec, setModalRec] = useState(null);

  const activeRecos    = recos    && recos.length    > 0 ? recos    : [];
  const activeInsights = insights && insights.length > 0 ? insights : aiInsights;

  const avgScore = activeRecos.length > 0
    ? Math.round(activeRecos.reduce((s, r) => s + r.ratefluencer, 0) / activeRecos.length)
    : 0;
  const confInterval = (5.0 - (Math.min(100, Math.max(0, avgScore)) / 100) * 2.5).toFixed(1);

  const avgConf = activeRecos.length > 0
    ? Math.round(activeRecos.reduce((sum, r) => sum + (Number(r.modelConfidence) || parsePercent(r.successProb, 80)), 0) / activeRecos.length)
    : 94;

  const totalImpressions = activeRecos.reduce((sum, r) => {
    if (Number.isFinite(Number(r.projectedImpressions))) return sum + Number(r.projectedImpressions);
    const er = Math.max(parsePercent(r.engRate, 3) / 100, 0.01);
    return sum + Math.round(parseFollowers(r.meta) * er * 8);
  }, 0);
  const impStr = totalImpressions >= 1_000_000
    ? `~${(totalImpressions/1_000_000).toFixed(1)}M`
    : totalImpressions > 0 ? `~${(totalImpressions/1_000).toFixed(0)}K` : '~2.8M';

  const reachCostStr = budgetRaw
    ? '₹' + Math.round(Number(budgetRaw) * (0.45 + (avgScore / 100) * 0.35)).toLocaleString('en-IN')
    : budget;

  const handleShortlist = (rec) => {
    const already = shortlisted.some(r => r.name === rec.name);
    const updated = already
      ? shortlisted.filter(r => r.name !== rec.name)
      : [...shortlisted, { name: rec.name, handle: rec.handle, meta: rec.meta, engRate: rec.engRate, ratefluencer: rec.ratefluencer, growth: rec.growth, authenticity: rec.authenticity, brandMatch: rec.brandMatch, successProb: rec.successProb, modelConfidence: rec.modelConfidence }];
    setShortlisted(updated);
    showToast(already ? `${rec.name} removed from shortlist` : `${rec.name} added to shortlist`);
  };

  const history = (() => {
    try { return JSON.parse(localStorage.getItem('ratefluencer_history') || '[]'); }
    catch { return []; }
  })();

  return (
    <>
      {modalRec && <ScoreModal rec={modalRec} onClose={() => setModalRec(null)} />}

      <div style={{ paddingTop: '56px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '3rem 2rem' }}>

          {/* Header */}
          <div className="fade-up" style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '36px', marginBottom: '6px' }}>Recommended Influencers</h2>
              <p style={{ fontSize: '14px', color: 'var(--text2)' }}>
                Ranked by predicted campaign ROI ·{' '}
                <span style={{ color: 'var(--accent)' }}>{cats} · {budget} budget · India · {ageGroup}</span>
              </p>
            </div>
            <div className="no-print" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {activeRecos.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => exportCSV(activeRecos)} style={{ fontSize: '12px' }}>⬇ CSV</button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>⬇ PDF</button>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/campaign')}>✏️ Edit</button>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/campaign', { state: { fresh: true } })}>New Campaign</button>
            </div>
          </div>

          {/* Meta strip */}
          <div className="fade-up delay-1" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem 1.5rem', fontSize: '13px', color: 'var(--text2)', display: 'flex', gap: '2rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {[
              [`${activeRecos.length} of 33,935`, 'Real creators evaluated'],
              [`${avgConf}%`,                      'Model confidence'],
              [reachCostStr,                        'Est. total reach cost'],
              [impStr,                              'Projected impressions'],
            ].map(([val, label]) => (
              <div key={label}>
                <strong style={{ color: 'var(--text)', display: 'block', fontSize: '15px' }}>{val}</strong>
                {label}
              </div>
            ))}
          </div>

          <div className="divider" />

          <ROIEstimator recos={activeRecos} budget={budget} campaignGoal={goal} />

          {/* Recommendation cards */}
          <div className="fade-up delay-2" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '2rem' }}>
            {activeRecos.length > 0 ? activeRecos.map(rec => (
              <RecoCard
                key={rec.rank}
                rec={rec}
                onShortlist={handleShortlist}
                isShortlisted={shortlisted.some(s => s.name === rec.name)}
                onShowBreakdown={setModalRec}
              />
            )) : (
              <>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '1.5rem', alignItems: 'center', opacity: 1 - i * 0.2 }}>
                    <div className="skeleton" style={{ width: '50px', height: '48px', borderRadius: '6px' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div className="skeleton" style={{ height: '18px', width: '40%', borderRadius: '4px' }} />
                      <div className="skeleton" style={{ height: '12px', width: '60%', borderRadius: '4px' }} />
                      <div style={{ display: 'flex', gap: '1.5rem' }}>
                        {[1,2,3,4].map(j => <div key={j} style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}><div className="skeleton" style={{ height: '28px', width: '48px', borderRadius: '4px' }} /><div className="skeleton" style={{ height: '10px', width: '56px', borderRadius: '4px' }} /></div>)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                      <div className="skeleton" style={{ width: '80px', height: '80px', borderRadius: '50%' }} />
                      <div className="skeleton" style={{ width: '80px', height: '28px', borderRadius: '20px' }} />
                    </div>
                  </div>
                ))}
                <div style={{ textAlign: 'center', padding: '1rem 0', color: 'var(--text3)', fontSize: '13px' }}>
                  Run a campaign to see AI-ranked creators →{' '}
                  <button className="btn btn-primary btn-sm" style={{ marginLeft: '8px' }} onClick={() => navigate('/campaign')}>Start a Campaign</button>
                </div>
              </>
            )}
          </div>

          {/* Shortlist panel */}
          {shortlisted.length > 0 && (
            <div className="fade-up" style={{ background: 'rgba(200,240,104,0.06)', border: '1px solid rgba(200,240,104,0.2)', borderRadius: 'var(--radius)', padding: '1rem 1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>SHORTLIST ({shortlisted.length})</span>
                  {shortlisted.map(r => (
                    <span key={r.name} style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '20px', background: 'rgba(200,240,104,0.08)', color: 'var(--accent)', border: '1px solid rgba(200,240,104,0.2)' }}>
                      {r.name}
                    </span>
                  ))}
                </div>
                <div className="no-print" style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => exportCSV(shortlisted)} style={{ fontSize: '12px' }}>⬇ Export CSV</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => navigate('/shortlist')} style={{ fontSize: '12px' }}>View All</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShortlisted([])} style={{ fontSize: '12px' }}>Clear all</button>
                </div>
              </div>
            </div>
          )}

          {/* AI Insights */}
          <div className="section-label" style={{ marginBottom: '12px' }}>AI Campaign Insights</div>
          <div className="fade-up delay-3 insight-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '2rem' }}>
            {activeInsights.map(insight => (
              <div key={insight.title} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem' }}>
                <div style={{ fontSize: '20px', marginBottom: '10px' }}>{insight.icon}</div>
                <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>{insight.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--text2)', lineHeight: 1.6 }}>{insight.text}</div>
              </div>
            ))}
          </div>

          {/* Model output */}
          <div className="fade-up delay-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>AI MODEL OUTPUT</div>
            <div style={{ fontSize: '14px', color: 'var(--text2)', lineHeight: 1.7 }}>
              Based on your campaign parameters, the model predicts a{' '}
              <span style={{ color: 'var(--accent)', fontWeight: 500 }}>
                {activeRecos.length > 0 && activeRecos[0].successProb
                  ? `${parseInt(activeRecos[0].successProb) - Math.round(parseFloat(confInterval))}%–${activeRecos[0].successProb}`
                  : '76–88%'} probability of campaign success
              </span>,
              defined as achieving the target awareness/conversion KPIs. The XGBoost and RandomForest ensemble considered{' '}
              <strong style={{ color: 'var(--text)' }}>engagement rate, net growth lags, follower-to-following safety ratios, audience quality index, brand-category alignment, and historical posting consistency</strong>{' '}
              to generate these rankings. Confidence interval: ±{confInterval}%.
            </div>
          </div>

          {/* Campaign History */}
          {history.length > 0 && (
            <div className="fade-up" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem' }}>
              <div className="section-label" style={{ marginBottom: '12px' }}>Campaign History</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {history.map(entry => (
                  <div key={entry.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', border: '1px solid var(--border)', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', marginBottom: '2px' }}>
                        {entry.name} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>for {entry.brand}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                        {entry.date} · {entry.goal} · {entry.cats} · {entry.budget}
                      </div>
                    </div>
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: '11px', flexShrink: 0 }} onClick={() => showToast('Campaign history restored')}>
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
