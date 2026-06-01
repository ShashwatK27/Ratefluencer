import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '2rem',
      background: 'var(--bg)', color: 'var(--text)',
    }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '96px', lineHeight: 1, color: 'var(--accent)', marginBottom: '1rem' }}>
        404
      </div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', marginBottom: '8px' }}>
        Page not found
      </h2>
      <p style={{ color: 'var(--text2)', fontSize: '14px', marginBottom: '2rem' }}>
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div style={{ display: 'flex', gap: '12px' }}>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/')}>
          Go Home
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/dashboard')}>
          Dashboard
        </button>
      </div>
    </div>
  );
}
