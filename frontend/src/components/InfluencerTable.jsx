import React from 'react';

const COL = 'minmax(180px,2fr) 90px 90px 75px 95px 80px 120px 64px';

function scoreClass(s) {
  return s >= 85 ? 'score-s' : s >= 75 ? 'score-a' : s >= 65 ? 'score-b' : 'score-c';
}
function tierColor(t) {
  return t === 'S' ? 'tag-green' : t === 'A' ? 'tag-blue' : 'tag-gold';
}

function TableHeader() {
  const cols = ['Influencer', 'Followers', 'Eng. Rate', 'Saves', 'Auth Score', 'Growth', 'Ratefluencer™', 'Tier'];
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: COL,
      padding: '12px 16px', borderBottom: '1px solid var(--border)',
      fontSize: '11px', letterSpacing: '.05em', textTransform: 'uppercase',
      color: 'var(--text3)', fontFamily: 'var(--font-mono)',
      minWidth: '720px',
    }}>
      {cols.map(c => <div key={c} style={{ whiteSpace: 'nowrap' }}>{c}</div>)}
    </div>
  );
}

function TableRow({ influencer, onClick }) {
  const { name, handle, followers, er, auth, growth, score, tier, av, c1, c2, saves_str } = influencer;

  return (
    <div
      onClick={() => onClick(influencer)}
      style={{
        display: 'grid', gridTemplateColumns: COL,
        padding: '14px 16px', borderBottom: '1px solid var(--border)',
        alignItems: 'center', transition: 'background .15s', cursor: 'pointer',
        minWidth: '720px',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
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
      <div style={{ fontSize: '12px', color: 'var(--purple)', fontFamily: 'var(--font-mono)' }}>
        {saves_str || ' - '}
        <span style={{ fontSize: '9px', color: 'var(--text3)', display: 'block', marginTop: '1px' }}>saves</span>
      </div>

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

export default function InfluencerTable({ data, onCreatorClick }) {
  if (!data.length) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text3)', fontSize: '14px' }}>
        No influencers match your filters.
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflowX: 'auto' }}>
      <div style={{ padding: '8px 16px 6px', fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--border)' }}>
        Click any creator to see their virality score ->
      </div>
      <TableHeader />
      {data.map(inf => (
        <TableRow key={inf.id} influencer={inf} onClick={onCreatorClick || (() => {})} />
      ))}
    </div>
  );
}
