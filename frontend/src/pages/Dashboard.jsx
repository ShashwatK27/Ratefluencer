import React, { useState, useMemo, useEffect } from 'react';
import { config } from '../config.js';
import Sidebar from '../components/Sidebar.jsx';
import KPIGrid from '../components/KPIGrid.jsx';
import SearchBar from '../components/SearchBar.jsx';
import InfluencerTable from '../components/InfluencerTable.jsx';
import { influencers as fallbackData } from '../data/index.js';

export default function Dashboard({ currentPage, onNavigate }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [allCreators, setAllCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isReal, setIsReal] = useState(false);

  // Load real creators once on mount
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(config.api.endpoints.realCreators, { signal: controller.signal });
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          if (data.results && data.results.length > 0) {
            setAllCreators(data.results);
            setIsReal(true);
            return;
          }
        }
      } catch (e) {
        console.warn('Real creators unavailable, using fallback');
      }
      setAllCreators(fallbackData);
      setIsReal(false);
      setLoading(false);
    };
    load().finally(() => setLoading(false));
  }, []);

  // Filter entirely on the frontend — instant, no round-trip
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const cat = activeCategory.toLowerCase();
    return allCreators.filter(inf => {
      const matchSearch = !q ||
        inf.name.toLowerCase().includes(q) ||
        inf.handle.toLowerCase().includes(q) ||
        (inf.cat || '').toLowerCase().includes(q);
      const matchCat = activeCategory === 'All' ||
        (inf.cat || '').toLowerCase().includes(cat);
      return matchSearch && matchCat;
    });
  }, [allCreators, searchQuery, activeCategory]);

  return (
    <div style={{ paddingTop: '56px' }}>
      <div className="dashboard-wrap" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: 'calc(100vh - 56px)' }}>
        <Sidebar currentPage={currentPage} onNavigate={onNavigate} />

        <main style={{ padding: '2rem', overflowY: 'auto' }}>
          <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', marginBottom: '4px' }}>
                Influencer Dashboard
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--text2)' }}>
                {isReal
                  ? `Showing ${filtered.length} real-world creators from Top100 Instagram + TikTok`
                  : `Showing ${filtered.length} creators`}
              </p>
            </div>
            {isReal && (
              <span style={{
                fontSize: '11px', padding: '4px 12px', borderRadius: '20px',
                background: 'rgba(200,240,104,0.08)', color: 'var(--accent)',
                border: '1px solid rgba(200,240,104,0.2)', fontFamily: 'var(--font-mono)',
              }}>
                ✓ Real Data
              </span>
            )}
          </div>

          <KPIGrid />

          <SearchBar
            searchQuery={searchQuery}
            onSearch={setSearchQuery}
            activeCategory={activeCategory}
            onCategoryChange={cat => { setActiveCategory(cat); }}
          />

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: '58px', borderRadius: 'var(--radius-sm)', opacity: 1 - i * 0.12 }} />
              ))}
            </div>
          ) : (
            <InfluencerTable data={filtered} />
          )}
        </main>
      </div>
    </div>
  );
}
