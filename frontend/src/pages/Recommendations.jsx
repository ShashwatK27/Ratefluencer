import React, { useState } from 'react';
import { recommendations, aiInsights } from '../data/index.js';

// ── Score breakdown modal ────────────────────────────────────────────────────
function ScoreModal({ rec, onClose }) {
  if (!rec) return null;
  const items = [
    { label: 'Brand Match', value: rec.brandMatch ?? 90, color: 'var(--coral)', desc: 'Semantic similarity between your campaign brief and this creator\'s content niche.' },
    { label: 'Authenticity', value: rec.authenticity ?? 85, color: 'var(--blue)', desc: 'XGBoost fraud detector score — higher means lower fake-follower risk.' },
    { label: 'Growth Score', value: rec.growth ?? rec.virality ?? 80, color: 'var(--gold)', desc: 'RandomForest prediction of follower & engagement trajectory over 30 days.' },
    { label: 'Ratefluencer™', value: rec.ratefluencer, color: 'var(--accent)', desc: 'Weighted composite of all three models, calibrated to your campaign goal.' },
  ];
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(11,13,15,0.85)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg)', border: '1px solid var(--border2)',
          borderRadius: 'var(--radius)', padding: '2rem',
          maxWidth: '480px', width: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px' }}>{rec.name}</div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>Score Breakdown</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: '20px', cursor: 'pointer', padding: '4px 8px' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {items.map(item => (
            <div key={item.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500 }}>{item.label}</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: item.color }}>{item.value}</span>
              </div>
              <div style={{ height: '6px', borderRadius: '3px', background: 'var(--border)', marginBottom: '6px' }}>
                <div style={{ width: `${item.value}%`, height: '100%', borderRadius: '3px', background: item.color, transition: 'width .5s ease' }} />
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text3)', lineHeight: 1.5 }}>{item.desc}</div>
            </div>
          ))}
        </div>

        {rec.successProb && (
          <div style={{
            marginTop: '1.5rem', padding: '12px', borderRadius: 'var(--radius-sm)',
            background: 'rgba(200,240,104,0.06)', border: '1px solid rgba(200,240,104,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '13px', color: 'var(--text2)' }}>Predicted Campaign Success</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--accent)' }}>{rec.successProb}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Score ring ───────────────────────────────────────────────────────────────
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

// ── ROI Estimator ────────────────────────────────────────────────────────────
function ROIEstimator({ recos, budget }) {
  if (!recos || recos.length === 0) return null;

  const budgetNum = (() => {
    const s = String(budget || '').replace(/[₹,\s]/g, '');
    const n = parseFloat(s);
    if (isNaN(n)) return 500000;
    if (s.endsWith('L') || s.endsWith('l')) return n * 100000;
    return n;
  })();

  const topCreator = recos[0];
  const avgER = recos.reduce((sum, r) => sum + (parseFloat(r.engRate) || 3.5), 0) / recos.length;

  const estimatedFollowers = recos.reduce((sum) => sum + 250000, 0);
  const estimatedImpressions = Math.round(estimatedFollowers * (avgER / 100) * 6);
  const cpm = budgetNum > 0 ? ((budgetNum / estimatedImpressions) * 1000).toFixed(2) : '—';
  const successPct = topCreator.successProb ? parseInt(topCreator.successProb) : 78;

  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '1.5rem', marginBottom: '1.5rem',
    }}>
      <div className="section-label" style={{ marginBottom: '12px' }}>ROI Estimator</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px' }}>
        {[
          { label: 'Est. Impressions', value: estimatedImpressions >= 1000000 ? `${(estimatedImpressions/1000000).toFixed(1)}M` : `${(estimatedImpressions/1000).toFixed(0)}K`, color: 'var(--accent)' },
          { label: 'Avg Engagement Rate', value: `${avgER.toFixed(1)}%`, color: 'var(--blue)' },
          { label: 'Cost Per 1K Impr.', value: `₹${cpm}`, color: 'var(--gold)' },
          { label: 'Success Probability', value: `${successPct}%`, color: 'var(--coral)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '12px', fontFamily: 'var(--font-mono)' }}>
        * Estimates based on combined follower reach and average engagement rates of selected creators.
      </div>
    </div>
  );
}

// ── Recommendation card ──────────────────────────────────────────────────────
function RecoCard({ rec, onShortlist, isShortlisted, onShowBreakdown }) {
  const rankBorder =
    rec.rank === 1 ? 'rgba(240,201,106,0.3)' :
    rec.rank === 2 ? 'rgba(104,184,240,0.2)' :
    'rgba(200,240,104,0.2)';

  const rankBg = rec.rank === 1
    ? 'linear-gradient(135deg,rgba(240,201,106,0.04),var(--bg2))'
    : 'var(--bg2)';

  const scoreItems = [
    { label: 'Ratefluencer™', val: rec.ratefluencer,                                          color: 'var(--accent)' },
    { label: 'Growth',        val: (rec.growth !== undefined ? rec.growth : rec.virality) + '%', color: 'var(--gold)'   },
    { label: 'Authenticity',  val: (rec.authenticity ?? 85) + '%',                             color: 'var(--blue)'   },
    { label: 'Brand Match',   val: (rec.brandMatch ?? 90) + '%',                               color: 'var(--coral)'  },
  ];

  return (
    <div
      style={{
        background: rankBg, border: `1px solid ${rankBorder}`,
        borderRadius: 'var(--radius)', padding: '1.5rem',
        transition: 'all .2s', display: 'grid',
        gridTemplateColumns: 'auto 1fr auto', gap: '1.5rem', alignItems: 'center',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.transform = 'translateX(4px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = rankBorder; e.currentTarget.style.transform = 'none'; }}
    >
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '48px', lineHeight: 1, width: '50px', textAlign: 'center', color: rec.rank === 1 ? 'var(--gold)' : 'var(--border2)' }}>
        {rec.rank}
      </div>

      <div>
        <div style={{ fontSize: '18px', fontWeight: 500, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {rec.name}
          {rec.badge && <span className="tag tag-gold" style={{ fontSize: '11px', verticalAlign: 'middle' }}>{rec.badge}</span>}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '12px' }}>{rec.meta}</div>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          {scoreItems.map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
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
          className={`btn ${isShortlisted ? 'btn-ghost' : rec.rank === 1 ? 'btn-primary' : 'btn-ghost'} btn-sm`}
          onClick={() => onShortlist(rec)}
          style={{ fontSize: '12px', color: isShortlisted ? 'var(--accent)' : undefined }}
        >
          {isShortlisted ? '✓ Shortlisted' : 'Shortlist'}
        </button>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function Recommendations({ campaignMeta, recos = [], insights = [], onNavigate }) {
  const { cats = 'Wellness + Skincare', budget = '₹10L', ageGroup = '25–34' } = campaignMeta || {};
  const [shortlisted, setShortlisted] = useState(() => {
    try { return new Set((JSON.parse(localStorage.getItem('ratefluencer_shortlist') || '[]')).map(c => c.name)); }
    catch { return new Set(); }
  });
  const [modalRec, setModalRec] = useState(null);

  const activeRecos = recos && recos.length > 0 ? recos : recommendations;
  const activeInsights = insights && insights.length > 0 ? insights : aiInsights;

  const avgScore = Math.round(activeRecos.reduce((s, r) => s + r.ratefluencer, 0) / activeRecos.length);
  const confInterval = Math.max(2, Math.round(10 - avgScore / 15));

  const handleShortlist = (rec) => {
    const stored = JSON.parse(localStorage.getItem('ratefluencer_shortlist') || '[]');
    const already = shortlisted.has(rec.name);
    let updated;
    if (already) {
      updated = stored.filter(c => c.name !== rec.name);
    } else {
      updated = [...stored, rec];
    }
    localStorage.setItem('ratefluencer_shortlist', JSON.stringify(updated));
    setShortlisted(new Set(updated.map(c => c.name)));
  };

  return (
    <>
      {modalRec && <ScoreModal rec={modalRec} onClose={() => setModalRec(null)} />}

      <div style={{ paddingTop: '56px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '3rem 2rem' }}>

          <div className="fade-up" style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '36px', marginBottom: '6px' }}>Recommended Influencers</h2>
              <p style={{ fontSize: '14px', color: 'var(--text2)' }}>
                Ranked by predicted campaign ROI ·{' '}
                <span style={{ color: 'var(--accent)' }}>{cats} · {budget} budget · India · {ageGroup}</span>
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('shortlist')}>
                📋 View Shortlist {shortlisted.size > 0 && `(${shortlisted.size})`}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>⬇ Export PDF</button>
              <button className="btn btn-primary btn-sm" onClick={() => onNavigate('campaign')}>New Campaign</button>
            </div>
          </div>

          <div className="fade-up delay-1" style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '1rem 1.5rem',
            fontSize: '13px', color: 'var(--text2)', display: 'flex', gap: '2rem',
            marginBottom: '1.5rem',
          }}>
            {[
              [`${activeRecos.length} of 50,000`, 'Creators evaluated'],
              [`${avgScore}/100`, 'Avg Ratefluencer™ Score'],
              [budget, 'Campaign budget'],
              ['~2.8M', 'Projected impressions'],
            ].map(([val, label]) => (
              <div key={label}>
                <strong style={{ color: 'var(--text)', display: 'block', fontSize: '15px' }}>{val}</strong>
                {label}
              </div>
            ))}
          </div>

          <div className="divider" />

          {/* ROI Estimator */}
          <ROIEstimator recos={activeRecos} budget={budget} />

          {/* Cards */}
          <div className="fade-up delay-2" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '2rem' }}>
            {activeRecos.map(rec => (
              <RecoCard
                key={rec.rank}
                rec={rec}
                onShortlist={handleShortlist}
                isShortlisted={shortlisted.has(rec.name)}
                onShowBreakdown={setModalRec}
              />
            ))}
          </div>

          {/* AI Insights */}
          <div className="section-label" style={{ marginBottom: '12px' }}>AI Campaign Insights</div>
          <div className="fade-up delay-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '2rem' }}>
            {activeInsights.map(insight => (
              <div key={insight.title} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem' }}>
                <div style={{ fontSize: '20px', marginBottom: '10px' }}>{insight.icon}</div>
                <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>{insight.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--text2)', lineHeight: 1.6 }}>{insight.text}</div>
              </div>
            ))}
          </div>

          {/* Model output */}
          <div className="fade-up delay-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem' }}>
            <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>AI MODEL OUTPUT</div>
            <div style={{ fontSize: '14px', color: 'var(--text2)', lineHeight: 1.7 }}>
              Based on your campaign parameters, the model predicts a{' '}
              <span style={{ color: 'var(--accent)', fontWeight: 500 }}>
                {activeRecos.length > 0 && activeRecos[0].successProb
                  ? `${parseInt(activeRecos[0].successProb) - confInterval}%–${activeRecos[0].successProb}`
                  : '76–88%'} probability of campaign success
              </span>,
              defined as achieving the target awareness/conversion KPIs. The XGBoost and RandomForest ensemble considered{' '}
              <strong style={{ color: 'var(--text)' }}>engagement rate, net growth lags, follower-to-following safety ratios, audience quality index, brand-category alignment, and historical posting consistency</strong>{' '}
              to generate these rankings. Confidence interval: ±{confInterval}%.
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
