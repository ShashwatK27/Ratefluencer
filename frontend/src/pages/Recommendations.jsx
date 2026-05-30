import React from 'react';
import { recommendations, aiInsights } from '../data/index.js';

function ScoreRing({ score, color, offset }) {
  return (
    <div style={{ position: 'relative', width: '80px', height: '80px', flexShrink: 0 }}>
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

function RecoCard({ rec, onShortlist }) {
  const rankBorder =
    rec.rank === 1 ? 'rgba(240,201,106,0.3)' :
    rec.rank === 2 ? 'rgba(104,184,240,0.2)' :
    'rgba(200,240,104,0.2)';

  const rankBg = rec.rank === 1
    ? 'linear-gradient(135deg,rgba(240,201,106,0.04),var(--bg2))'
    : 'var(--bg2)';

  const scoreItems = [
    { label: 'Ratefluencer™', val: rec.ratefluencer, color: 'var(--accent)' },
    { label: 'Growth',       val: (rec.growth !== undefined ? rec.growth : rec.virality) + '%',  color: 'var(--gold)'   },
    { label: 'Authenticity',  val: (rec.authenticity !== undefined ? rec.authenticity : 85) + '%', color: 'var(--blue)' },
    { label: 'Brand Match',   val: (rec.brandMatch !== undefined ? rec.brandMatch : 90) + '%', color: 'var(--coral)'  },
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
      {/* Rank number */}
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: '48px', lineHeight: 1,
        width: '50px', textAlign: 'center',
        color: rec.rank === 1 ? 'var(--gold)' : 'var(--border2)',
      }}>
        {rec.rank}
      </div>

      {/* Info */}
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
        <div style={{
          fontSize: '11px', padding: '4px 10px', borderRadius: '20px',
          background: 'rgba(200,240,104,0.08)', color: 'var(--accent)',
          border: '1px solid rgba(200,240,104,0.15)', fontFamily: 'var(--font-mono)',
          marginTop: '6px', display: 'inline-block',
        }}>
          {rec.why}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
        <ScoreRing score={rec.ratefluencer} color={rec.ringColor} offset={rec.ringOffset} />
        <button
          className={`btn ${rec.rank === 1 ? 'btn-primary' : 'btn-ghost'} btn-sm`}
          onClick={() => onShortlist(rec.name)}
          style={{ fontSize: '12px' }}
        >
          Shortlist
        </button>
      </div>
    </div>
  );
}

export default function Recommendations({ campaignMeta, recos = [], insights = [], onNavigate }) {
  const { cats = 'Wellness + Skincare', budget = '₹10L', ageGroup = '25–34' } = campaignMeta || {};

  const handleShortlist = (name) => {
    alert(`✅ ${name} added to shortlist!`);
  };

  const activeRecos = recos && recos.length > 0 ? recos : recommendations;
  const activeInsights = insights && insights.length > 0 ? insights : aiInsights;

  return (
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
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>⬇ Export PDF</button>
            <button className="btn btn-primary btn-sm" onClick={() => onNavigate('campaign')}>New Campaign</button>
          </div>
        </div>

        {/* Meta strip */}
        <div className="fade-up delay-1" style={{
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '1rem 1.5rem',
          fontSize: '13px', color: 'var(--text2)', display: 'flex', gap: '2rem',
          marginBottom: '1.5rem',
        }}>
          {[[`${activeRecos.length} of 50,000`,'Creators evaluated'],['94.1%','Model confidence'],['₹8.4L','Est. total reach cost'],['~2.8M','Projected impressions']].map(([val, label]) => (
            <div key={label}>
              <strong style={{ color: 'var(--text)', display: 'block', fontSize: '15px' }}>{val}</strong>
              {label}
            </div>
          ))}
        </div>

        <div className="divider" />

        {/* Recommendation cards */}
        <div className="fade-up delay-2" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '2rem' }}>
          {activeRecos.map(rec => (
            <RecoCard key={rec.rank} rec={rec} onShortlist={handleShortlist} />
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
              {activeRecos.length > 0 && activeRecos[0].successProb ? `${parseInt(activeRecos[0].successProb) - 8}%–${activeRecos[0].successProb}` : '76–88%'} probability of campaign success
            </span>,
            defined as achieving the target awareness/conversion KPIs. The XGBoost and RandomForest ensemble considered{' '}
            <strong style={{ color: 'var(--text)' }}>engagement rate, net growth lags, follower-to-following safety ratios, audience quality index, brand-category alignment, and historical posting consistency</strong>{' '}
            to generate these rankings. Confidence interval: ±4.2%.
          </div>
        </div>

      </div>
    </div>
  );
}
