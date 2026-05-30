import React from 'react';
import { kpis } from '../data/index.js';

function KPICard({ label, value, delta, deltaType, icon, delay }) {
  const deltaColor =
    deltaType === 'up'      ? 'var(--accent)' :
    deltaType === 'down'    ? 'var(--coral)'  :
    'var(--text3)';

  return (
    <div
      className={`fade-up ${delay}`}
      style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '1.25rem',
      }}
    >
      <div style={{
        fontSize: '12px', color: 'var(--text3)', marginBottom: '8px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>{label}</span>
        <span style={{ fontSize: '16px' }}>{icon}</span>
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '30px', color: 'var(--text)', marginBottom: '2px' }}>
        {value}
      </div>
      <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: deltaColor }}>
        {delta}
      </div>
    </div>
  );
}

export default function KPIGrid() {
  const delays = ['', 'delay-1', 'delay-2', 'delay-3'];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '12px',
      marginBottom: '2rem',
    }}>
      {kpis.map((kpi, i) => (
        <KPICard key={kpi.label} {...kpi} delay={delays[i]} />
      ))}
    </div>
  );
}
