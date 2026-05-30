import React from 'react';

const LINKS = [
  { id: 'landing',         label: 'Home'      },
  { id: 'dashboard',       label: 'Dashboard' },
  { id: 'campaign',        label: 'Campaign'  },
  { id: 'recommendations', label: 'Results'   },
  { id: 'viralLab',        label: 'Viral Lab' },
  { id: 'aiAgent',         label: 'AI Agent'  },
];

export default function Navbar({ currentPage, onNavigate }) {
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: 'rgba(11,13,15,0.85)', backdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border)',
      padding: '0 2rem', height: '56px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      {/* Logo */}
      <button
        onClick={() => onNavigate('landing')}
        style={{
          fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--text)',
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'none', border: 'none', cursor: 'pointer',
        }}
      >
        <span style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: 'var(--accent)', boxShadow: '0 0 12px var(--accent)',
          display: 'inline-block',
        }} />
        Ratefluencer™
      </button>

      {/* Nav Links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {LINKS.map(link => (
          <button
            key={link.id}
            onClick={() => onNavigate(link.id)}
            style={{
              padding: '6px 14px', fontSize: '13px',
              color: currentPage === link.id ? 'var(--text)' : 'var(--text2)',
              border: 'none',
              background: currentPage === link.id ? 'rgba(255,255,255,0.07)' : 'none',
              cursor: 'pointer', borderRadius: '20px',
              transition: 'all .2s', fontFamily: 'var(--font-body)',
            }}
            onMouseEnter={e => { if (currentPage !== link.id) { e.target.style.color = 'var(--text)'; e.target.style.background = 'rgba(255,255,255,0.05)'; } }}
            onMouseLeave={e => { if (currentPage !== link.id) { e.target.style.color = 'var(--text2)'; e.target.style.background = 'none'; } }}
          >
            {link.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
