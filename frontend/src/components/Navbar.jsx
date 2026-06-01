import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const LINKS = [
  { route: '/dashboard',    label: 'Dashboard'     },
  { route: '/viral-lab',    label: 'Viral Lab'      },
  { route: '/ai-agent',     label: 'AI Agent'       },
  { route: '/creator-corner', label: 'Creator Corner' },
];

export default function Navbar() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [scrolled, setScrolled]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
      background: scrolled ? 'rgba(11,13,15,0.92)' : 'rgba(11,13,15,0.7)',
      backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      borderBottom: `1px solid ${scrolled ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.05)'}`,
      padding: '0 2rem', height: '56px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      transition: 'background .3s, border-color .3s',
    }}>
      {/* Logo */}
      <button
        onClick={() => navigate('/')}
        style={{
          fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--text)',
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'none', border: 'none', cursor: 'pointer',
          transition: 'opacity .2s',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '.8'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >
        <span style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: 'var(--accent)',
          boxShadow: '0 0 10px var(--accent), 0 0 20px rgba(200,240,104,0.3)',
          display: 'inline-block', animation: 'pulse 3s infinite',
        }} />
        Ratefluencer™
      </button>

      {/* Desktop Nav */}
      <div className="nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
        {LINKS.map(link => {
          const active = location.pathname === link.route;
          return (
            <button
              key={link.route}
              onClick={() => navigate(link.route)}
              style={{
                padding: '6px 14px', fontSize: '13px',
                color: active ? 'var(--text)' : 'var(--text2)',
                border: 'none',
                background: active ? 'rgba(255,255,255,0.08)' : 'none',
                cursor: 'pointer', borderRadius: '20px',
                transition: 'all .2s', fontFamily: 'var(--font-body)',
                position: 'relative',
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.color = 'var(--text2)'; e.currentTarget.style.background = 'none'; }}}
            >
              {link.label}
              {active && (
                <span style={{
                  position: 'absolute', bottom: '-1px', left: '50%', transform: 'translateX(-50%)',
                  width: '16px', height: '2px', background: 'var(--accent)',
                  borderRadius: '1px', boxShadow: '0 0 6px var(--accent)',
                }} />
              )}
            </button>
          );
        })}
        <button
          className="btn btn-primary btn-sm"
          onClick={() => navigate('/campaign')}
          style={{ marginLeft: '8px', fontSize: '12px' }}
        >
          New Campaign
        </button>
      </div>

      {/* Mobile hamburger */}
      <button
        className="nav-mobile-btn"
        onClick={() => setMobileOpen(o => !o)}
        style={{
          display: 'none', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text)', fontSize: '20px', padding: '4px 8px',
        }}
      >
        {mobileOpen ? '✕' : '☰'}
      </button>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div style={{
          position: 'absolute', top: '56px', left: 0, right: 0,
          background: 'rgba(11,13,15,0.97)', backdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(255,255,255,0.09)',
          padding: '1rem 2rem', display: 'flex', flexDirection: 'column', gap: '4px',
          zIndex: 999,
        }}>
          {LINKS.map(link => {
            const active = location.pathname === link.route;
            return (
              <button
                key={link.route}
                onClick={() => navigate(link.route)}
                style={{
                  padding: '10px 12px', fontSize: '14px',
                  color: active ? 'var(--accent)' : 'var(--text)',
                  border: 'none', background: active ? 'rgba(200,240,104,0.08)' : 'none',
                  cursor: 'pointer', borderRadius: '8px', textAlign: 'left',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {link.label}
              </button>
            );
          })}
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate('/campaign')}
            style={{ marginTop: '8px', justifyContent: 'center' }}
          >
            New Campaign
          </button>
        </div>
      )}
    </nav>
  );
}
