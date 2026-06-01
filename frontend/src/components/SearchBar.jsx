import React from 'react';

const CATEGORIES = ['All', 'Tech', 'Fashion', 'Fitness', 'Food', 'Beauty', 'Travel', 'Gaming', 'Wellness', 'Comedy', 'Music'];

export default function SearchBar({ searchQuery, onSearch, activeCategory, onCategoryChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.5rem' }}>
      {/* Search input */}
      <div style={{ position: 'relative' }}>
        <span style={{
          position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
          fontSize: '15px', pointerEvents: 'none', opacity: 0.4,
        }}>🔍</span>
        <input
          type="text"
          placeholder="Search by name, handle, or category…"
          value={searchQuery}
          onChange={e => onSearch(e.target.value)}
          style={{
            width: '100%',
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: '100px',
            padding: '11px 18px 11px 42px',
            fontSize: '14px',
            color: 'var(--text)',
            fontFamily: 'var(--font-body)',
            outline: 'none',
            transition: 'border-color .2s',
            boxSizing: 'border-box',
          }}
          onFocus={e => { e.target.style.borderColor = 'rgba(200,240,104,0.4)'; }}
          onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
        />
        {searchQuery && (
          <button
            onClick={() => onSearch('')}
            style={{
              position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer',
              fontSize: '16px', lineHeight: 1, padding: '2px 4px',
            }}
          >✕</button>
        )}
      </div>

      {/* Category pills */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {CATEGORIES.map(cat => {
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => onCategoryChange(cat)}
              style={{
                padding: '6px 14px',
                borderRadius: '100px',
                background: isActive ? 'var(--accent-dim)' : 'var(--bg2)',
                border: isActive ? '1px solid rgba(200,240,104,0.4)' : '1px solid var(--border)',
                color: isActive ? 'var(--accent)' : 'var(--text2)',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all .2s',
                fontFamily: 'var(--font-body)',
                whiteSpace: 'nowrap',
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>
    </div>
  );
}
