import React, { useEffect, useState } from 'react';
import { config } from '../config.js';
import { kpis as fallbackKpis } from '../data/index.js';

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
  const [kpis, setKpis] = useState(fallbackKpis);
  const delays = ['', 'delay-1', 'delay-2', 'delay-3'];

  useEffect(() => {
    fetch(config.api.endpoints.stats)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setKpis([
          {
            label: 'Total Influencers',
            value: data.total_influencers.toLocaleString('en-IN'),
            delta: `${data.authentic_count.toLocaleString('en-IN')} verified authentic`,
            deltaType: 'up',
            icon: '👥',
          },
          {
            label: 'Avg Engagement',
            value: `${data.avg_engagement_rate}%`,
            delta: 'Live from dataset',
            deltaType: 'up',
            icon: '💬',
          },
          {
            label: 'Fake Detection Rate',
            value: `${data.fake_detection_rate}%`,
            delta: 'Flagged by XGBoost model',
            deltaType: 'down',
            icon: '🛡️',
          },
          {
            label: 'Top Ratefluencer™',
            value: String(data.top_score),
            delta: 'Best composite score',
            deltaType: 'neutral',
            icon: '⭐',
          },
        ]);
      })
      .catch(() => {});
  }, []);

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
