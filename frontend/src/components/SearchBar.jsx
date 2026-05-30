import React from 'react';

const CATEGORIES = ['All', 'Tech', 'Fashion', 'Fitness', 'Food'];

export default function SearchBar({ searchQuery, onSearch, activeCategory, onCategoryChange }) {
  return (
    <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem', alignItems: 'center' }}>
      <input
        type="text"
        placeholder="Search by name, handle, category…"
        value={searchQuery}
        onChange={e => onSearch(e.target.value)}
        style={{
          flex: 1,
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: '100px',
          padding: '10px 18px',
          fontSize: '14px',
          color: 'var(--text)',
          fontFamily: 'var(--font-body)',
          outline: 'none',
          transition: 'border-color .2s',
        }}
        onFocus={e => { e.target.style.borderColor = 'rgba(200,240,104,0.4)'; }}
        onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
      />

      {CATEGORIES.map(cat => {
        const isActive = activeCategory === cat;
        return (
          <button
            key={cat}
            onClick={() => onCategoryChange(cat)}
            style={{
              padding: '9px 16px',
              borderRadius: '100px',
              background: isActive ? 'var(--accent-dim)' : 'var(--bg2)',
              border: isActive ? '1px solid rgba(200,240,104,0.4)' : '1px solid var(--border)',
              color: isActive ? 'var(--accent)' : 'var(--text2)',
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all .2s',
              fontFamily: 'var(--font-body)',
            }}
          >
            {cat}
          </button>
        );
      })}
    </div>
  );
}
