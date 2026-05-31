import React from 'react';
import { sidebarNav } from '../data/index.js';

function SidebarItem({ icon, label, iconBg, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '8px 12px', borderRadius: 'var(--radius-sm)',
        fontSize: '13px',
        color: active ? 'var(--text)' : 'var(--text2)',
        cursor: 'pointer', transition: 'all .15s',
        border: active ? '1px solid rgba(200,240,104,0.12)' : '1px solid transparent',
        background: active ? 'rgba(200,240,104,0.08)' : 'none',
        width: '100%', fontFamily: 'var(--font-body)',
      }}
    >
      <span style={{
        width: '28px', height: '28px', borderRadius: '6px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '13px', flexShrink: 0, background: iconBg,
      }}>
        {icon}
      </span>
      {label}
    </button>
  );
}

function SidebarSection({ label, children }) {
  return (
    <div style={{ padding: '0 1rem', marginBottom: '1.5rem' }}>
      <div style={{
        fontSize: '10px', letterSpacing: '.1em', textTransform: 'uppercase',
        color: 'var(--text3)', fontFamily: 'var(--font-mono)',
        padding: '0 .75rem', marginBottom: '.5rem',
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

export default function Sidebar({ currentPage, onNavigate }) {
  return (
    <aside style={{
      background: 'var(--bg2)',
      borderRight: '1px solid var(--border)',
      padding: '1.5rem 0',
      width: '220px',
      flexShrink: 0,
    }}>
      <SidebarSection label="Main">
        {sidebarNav.main.map(item => (
          <SidebarItem
            key={item.label}
            icon={item.icon}
            label={item.label}
            iconBg={item.iconBg}
            active={currentPage === item.page}
            onClick={() => item.page && onNavigate(item.page)}
          />
        ))}
      </SidebarSection>

      <SidebarSection label="Analytics">
        {sidebarNav.analytics.map(item => (
          <SidebarItem
            key={item.label}
            icon={item.icon}
            label={item.label}
            iconBg={item.iconBg}
            active={currentPage === item.page}
            onClick={() => item.page && onNavigate(item.page)}
          />
        ))}
      </SidebarSection>

      <SidebarSection label="Settings">
        {sidebarNav.settings.map(item => (
          <SidebarItem
            key={item.label}
            icon={item.icon}
            label={item.label}
            iconBg={item.iconBg}
            active={currentPage === item.page}
            onClick={() => item.page && onNavigate(item.page)}
          />
        ))}
      </SidebarSection>
    </aside>
  );
}
