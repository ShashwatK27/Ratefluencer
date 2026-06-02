import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const LINKS = [
  { route: '/dashboard',      label: 'Dashboard'     },
  { route: '/viral-lab',      label: 'Viral Lab'      },
  { route: '/ai-agent',       label: 'AI Agent'       },
  { route: '/creator-corner', label: 'Creator Corner' },
  { route: '/about',          label: 'About'          },
];

const ICON_MENUS = [
  {
    id: 'analytics',
    title: 'Analytics',
    items: [
      { route: '/authenticity',  label: 'Authenticity',  desc: 'Fraud detection scores'    },
      { route: '/growth-engine', label: 'Growth Engine', desc: 'Growth predictions'         },
      { route: '/brand-match',   label: 'Brand Match',   desc: 'Semantic matching'          },
      { route: '/insights',      label: 'Real Insights', desc: 'Platform analytics'         },
      { route: '/real-creators', label: 'Real Creators', desc: 'Top 100 global creators'    },
    ],
  },
  {
    id: 'content',
    title: 'Content',
    items: [
      { route: '/content-studio',    label: 'Content Studio',    desc: 'AI reel & post creator'   },
      { route: '/trend-ranking',     label: 'Trend Ranking',     desc: 'Trending topics'           },
      { route: '/influencer-portal', label: 'Influencer Portal', desc: 'Creator profile & scoring' },
    ],
  },
  {
    id: 'account',
    title: 'Account',
    items: [
      { route: '/shortlist',   label: 'Shortlist',   desc: 'Saved creators'    },
      { route: '/preferences', label: 'Preferences', desc: 'Campaign settings' },
    ],
  },
];

function IconMenu({ menu, navigate, location }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isActive = menu.items.some(i => i.route === location.pathname);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          height: '34px', borderRadius: '10px', padding: '0 12px',
          display: 'flex', alignItems: 'center', gap: '6px',
          fontSize: '13px', cursor: 'pointer', transition: 'all .15s',
          border: open || isActive ? '1px solid rgba(200,240,104,0.35)' : '1px solid rgba(255,255,255,0.08)',
          background: open || isActive ? 'rgba(200,240,104,0.1)' : 'rgba(255,255,255,0.04)',
          color: open || isActive ? 'var(--accent)' : 'var(--text2)',
          fontFamily: 'var(--font-body)',
        }}
        onMouseEnter={e => { if (!open && !isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'var(--text)'; }}}
        onMouseLeave={e => { if (!open && !isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'var(--text2)'; }}}
      >
        <span>{menu.title}</span>
        <span style={{ fontSize: '9px', opacity: 0.5, marginLeft: '1px' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          background: 'rgba(14,16,18,0.97)', backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '14px', padding: '8px',
          minWidth: '220px', zIndex: 2000,
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.08em', padding: '4px 10px 8px' }}>
            {menu.title}
          </div>
          {menu.items.map(item => {
            const active = location.pathname === item.route;
            return (
              <button
                key={item.route}
                onClick={() => { navigate(item.route); setOpen(false); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 10px', borderRadius: '8px', cursor: 'pointer',
                  background: active ? 'rgba(200,240,104,0.08)' : 'transparent',
                  border: active ? '1px solid rgba(200,240,104,0.15)' : '1px solid transparent',
                  transition: 'all .12s', textAlign: 'left', fontFamily: 'var(--font-body)',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: active ? 'var(--accent)' : 'var(--text)' }}>{item.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '1px' }}>{item.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)', margin: '0 6px' }} />
        {ICON_MENUS.map(menu => (
          <IconMenu key={menu.id} menu={menu} navigate={navigate} location={location} />
        ))}
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
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '6px 0' }} />
          {ICON_MENUS.map(menu => (
            <div key={menu.id}>
              <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.08em', padding: '8px 12px 4px' }}>
                {menu.title}
              </div>
              {menu.items.map(item => (
                <button
                  key={item.route}
                  onClick={() => navigate(item.route)}
                  style={{
                    width: '100%', padding: '8px 12px', fontSize: '13px',
                    color: location.pathname === item.route ? 'var(--accent)' : 'var(--text)',
                    border: 'none', background: location.pathname === item.route ? 'rgba(200,240,104,0.08)' : 'none',
                    cursor: 'pointer', borderRadius: '8px', textAlign: 'left',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
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
