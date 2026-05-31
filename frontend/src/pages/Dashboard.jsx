import React, { useState, useMemo, useEffect } from 'react';
import { config } from '../config.js';
import Sidebar from '../components/Sidebar.jsx';
import KPIGrid from '../components/KPIGrid.jsx';
import SearchBar from '../components/SearchBar.jsx';
import InfluencerTable from '../components/InfluencerTable.jsx';
import { influencers } from '../data/index.js';

export default function Dashboard({ currentPage, onNavigate }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [dbInfluencers, setDbInfluencers] = useState(influencers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const fetchCreators = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          q: searchQuery,
          niche: activeCategory === 'All' ? '' : activeCategory,
          page,
          limit: 20,
          sort_by: 'followers',
        });

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(`${config.api.endpoints.search}?${params}`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.ok) {
          const data = await response.json();
          if (data.results && data.results.length > 0) {
            setDbInfluencers(data.results);
            setTotalPages(data.pages);
            setTotalCount(data.total);
          } else {
            // Empty results — keep existing data, no error
            setTotalCount(0);
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          console.warn("Search timed out — using fallback data");
        } else {
          console.warn("Search API unavailable — using fallback data:", err.message);
        }
        // Fall back to static data filtered by category
        const cat = activeCategory === 'All' ? null : activeCategory.toLowerCase();
        const fallback = cat
          ? influencers.filter(i => i.cat.toLowerCase().includes(cat))
          : influencers;
        setDbInfluencers(fallback);
        setTotalPages(1);
        setTotalCount(fallback.length);
      } finally {
        setLoading(false);
      }
    };

    fetchCreators();
  }, [searchQuery, activeCategory, page]);

  const filtered = useMemo(() => {
    return dbInfluencers;
  }, [dbInfluencers]);

  return (
    <div style={{ paddingTop: '56px' }}>
      <div className="dashboard-wrap" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: 'calc(100vh - 56px)' }}>
        <Sidebar currentPage={currentPage} onNavigate={onNavigate} />

        <main style={{ padding: '2rem', overflowY: 'auto' }}>
          {/* Page Header */}
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', marginBottom: '4px' }}>
              Influencer Dashboard
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text2)' }}>
              Browse and filter {totalCount.toLocaleString()} creators across all platforms
            </p>
          </div>

          <KPIGrid />

          <SearchBar
            searchQuery={searchQuery}
            onSearch={setSearchQuery}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />

          {error && (
            <div style={{ 
              background: 'rgba(255,0,0,0.1)', 
              color: '#ff6b6b', 
              padding: '1rem', 
              borderRadius: 'var(--radius)',
              marginBottom: '1.5rem',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          {loading && (
            <div style={{ 
              textAlign: 'center', 
              padding: '2rem',
              color: 'var(--text2)'
            }}>
              Loading creators...
            </div>
          )}

          {!loading && <InfluencerTable data={filtered} />}

          {/* Pagination */}
          {totalPages > 1 && !loading && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              gap: '8px', 
              marginTop: '2rem',
              alignItems: 'center'
            }}>
              <button 
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                style={{
                  padding: '8px 12px',
                  border: '1px solid var(--border)',
                  background: page === 1 ? 'var(--bg3)' : 'var(--bg2)',
                  color: 'var(--text)',
                  borderRadius: 'var(--radius)',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  opacity: page === 1 ? 0.5 : 1,
                }}
              >
                ← Previous
              </button>
              
              <span style={{ color: 'var(--text2)', fontSize: '14px' }}>
                Page {page} of {totalPages}
              </span>
              
              <button 
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                style={{
                  padding: '8px 12px',
                  border: '1px solid var(--border)',
                  background: page === totalPages ? 'var(--bg3)' : 'var(--bg2)',
                  color: 'var(--text)',
                  borderRadius: 'var(--radius)',
                  cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  opacity: page === totalPages ? 0.5 : 1,
                }}
              >
                Next →
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
