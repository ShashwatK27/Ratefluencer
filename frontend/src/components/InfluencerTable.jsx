import React from 'react';

const COL = '2fr 1fr 1fr 1fr 1fr 1fr 1fr';

function scoreClass(s) {
  return s >= 85 ? 'score-s' : s >= 75 ? 'score-a' : s >= 65 ? 'score-b' : 'score-c';
}
function tierColor(t) {
  return t === 'S' ? 'tag-green' : t === 'A' ? 'tag-blue' : 'tag-gold';
}

function TableHeader() {
  const cols = ['Influencer', 'Followers', 'Eng. Rate', 'Auth Score', 'Growth', 'Ratefluencer™', 'Tier'];
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: COL,
      padding: '12px 16px', borderBottom: '1px solid var(--border)',
      fontSize: '11px', letterSpacing: '.05em', textTransform: 'uppercase',
      color: 'var(--text3)', fontFamily: 'var(--font-mono)',
    }}>
      {cols.map(c => <div key={c}>{c}</div>)}
    </div>
  );
}

function TableRow({ influencer }) {
  const { name, handle, followers, er, auth, growth, score, tier, av, c1, c2 } = influencer;

  return (
    <div
      style={{
        display: 'grid', gridTemplateColumns: COL,
        padding: '14px 16px', borderBottom: '1px solid var(--border)',
        alignItems: 'center', transition: 'background .15s', cursor: 'pointer',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Influencer info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', fontWeight: 600, flexShrink: 0,
          background: c1, color: c2, border: `1px solid ${c2}30`,
        }}>
          {av}
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
            {name}
            {influencer.real && (
              <span style={{ fontSize: '9px', background: 'rgba(200,240,104,0.08)', color: 'var(--accent)', border: '1px solid rgba(200,240,104,0.15)', padding: '1px 5px', borderRadius: '3px', fontFamily: 'var(--font-mono)' }}>
                REAL
              </span>
            )}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text3)', display: 'flex', gap: '6px', alignItems: 'center' }}>
            {handle}
            {influencer.platform && (
              <span style={{ fontSize: '9px', color: influencer.platform === 'TikTok' ? 'var(--blue)' : 'var(--coral)', opacity: .8 }}>
                {influencer.platform}
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ fontSize: '13px', color: 'var(--text2)' }}>{followers}</div>
      <div style={{ fontSize: '13px', color: 'var(--text)' }}>{er}</div>

      <div>
        <span className={`score-pill ${scoreClass(auth)}`}>{auth}</span>
      </div>
      <div>
        <span className="score-pill score-a">{growth}</span>
      </div>
      <div>
        <span className={`score-pill ${scoreClass(score)}`}>{score}</span>
      </div>
      <div>
        <span className={`tag ${tierColor(tier)}`}>{tier}</span>
      </div>
    </div>
  );
}

export default function InfluencerTable({ data }) {
  if (!data.length) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text3)', fontSize: '14px' }}>
        No influencers match your filters.
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--bg2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
    }}>
      <TableHeader />
      {data.map(inf => (
        <TableRow key={inf.id} influencer={inf} />
      ))}
    </div>
  );
}
