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

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const response = await fetch(config.api.endpoints.influencers);
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            setDbInfluencers(data);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch featured creators, using high-fidelity fallback:", err);
      }
    };
    fetchFeatured();
  }, []);

  const filtered = useMemo(() => {
    return dbInfluencers.filter(inf => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        inf.name.toLowerCase().includes(q) ||
        inf.handle.includes(q) ||
        inf.cat.toLowerCase().includes(q);
      const matchesCat = activeCategory === 'All' || inf.cat === activeCategory;
      return matchesSearch && matchesCat;
    });
  }, [dbInfluencers, searchQuery, activeCategory]);

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
              Monitor and analyze creators across all platforms
            </p>
          </div>

          <KPIGrid />

          <SearchBar
            searchQuery={searchQuery}
            onSearch={setSearchQuery}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />

          <InfluencerTable data={filtered} />
        </main>
      </div>
    </div>
  );
}
