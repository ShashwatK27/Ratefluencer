import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { config } from '../config.js';
import KPIGrid from '../components/KPIGrid.jsx';
import SearchBar from '../components/SearchBar.jsx';
import InfluencerTable from '../components/InfluencerTable.jsx';

const PAGE_SIZE = 20;

function FeaturedCard({ creator, rank, onClick }) {
  const colors = ['var(--accent)', 'var(--blue)', 'var(--gold)'];
  const color  = colors[rank] || 'var(--text2)';
  const scoreColor = creator.score >= 85 ? 'var(--accent)' : creator.score >= 70 ? 'var(--gold)' : 'var(--blue)';

  return (
    <div
      onClick={() => onClick(creator)}
      className="shine-card"
      style={{
        background: rank === 0
          ? 'linear-gradient(135deg, rgba(200,240,104,0.06), var(--bg2))'
          : 'var(--bg2)',
        border: `1px solid ${rank === 0 ? 'rgba(200,240,104,0.25)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding: '1.25rem',
        cursor: 'pointer',
        transition: 'all .2s',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {rank === 0 && (
        <div style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '10px', color: 'var(--accent)', fontFamily: 'var(--font-mono)', padding: '2px 8px', borderRadius: '10px', background: 'rgba(200,240,104,0.1)', border: '1px solid rgba(200,240,104,0.2)' }}>
          TOP CREATOR
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
          background: creator.c1 || 'var(--bg3)',
          border: `2px solid ${color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '15px', fontWeight: 700, color: creator.c2 || color,
        }}>
          {creator.av || creator.name?.[0]?.toUpperCase() || '?'}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {formatName(creator.name)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>
            {creator.handle} · {creator.cat || 'Creator'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
        {[
          { label: 'Ratefluencer™', value: creator.score, color: scoreColor },
          { label: 'Auth',          value: creator.auth,  color: 'var(--blue)'   },
          { label: 'Growth',        value: creator.growth, color: 'var(--gold)'  },
        ].map(m => (
          <div key={m.label} style={{ textAlign: 'center', padding: '8px 4px', background: 'var(--bg3)', borderRadius: '8px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: m.color, lineHeight: 1 }}>{m.value}</div>
            <div style={{ fontSize: '9px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginTop: '3px' }}>{m.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '12px', color: 'var(--text2)' }}>
        <span>{creator.followers} followers</span>
        <span style={{ color: 'var(--accent)' }}>{creator.er} ER</span>
      </div>
    </div>
  );
}

function Pagination({ page, total, pageSize, onChange }) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem', padding: '10px 16px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
      <div style={{ fontSize: '12px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
        {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total.toLocaleString()} creators
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={() => onChange(0)} disabled={page === 0} className="btn btn-ghost btn-sm" style={{ fontSize: '12px', opacity: page === 0 ? 0.3 : 1 }}>«</button>
        <button onClick={() => onChange(page - 1)} disabled={page === 0} className="btn btn-ghost btn-sm" style={{ fontSize: '12px', opacity: page === 0 ? 0.3 : 1 }}>‹ Prev</button>
        <span style={{ padding: '4px 12px', fontSize: '12px', color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
          {page + 1} / {totalPages}
        </span>
        <button onClick={() => onChange(page + 1)} disabled={page >= totalPages - 1} className="btn btn-ghost btn-sm" style={{ fontSize: '12px', opacity: page >= totalPages - 1 ? 0.3 : 1 }}>Next ›</button>
        <button onClick={() => onChange(totalPages - 1)} disabled={page >= totalPages - 1} className="btn btn-ghost btn-sm" style={{ fontSize: '12px', opacity: page >= totalPages - 1 ? 0.3 : 1 }}>»</button>
      </div>
    </div>
  );
}

function formatName(raw) {
  if (!raw) return '';
  return raw.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchQuery,    setSearchQuery]    = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [allCreators,    setAllCreators]    = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [isReal,         setIsReal]         = useState(false);
  const [page,           setPage]           = useState(0);

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
        console.warn('Real creators unavailable');
      }
      setAllCreators([]);
      setIsReal(false);
      setLoading(false);
    };
    load().finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q   = searchQuery.toLowerCase();
    const cat = activeCategory.toLowerCase();
    return allCreators.filter(inf => {
      const matchSearch = !q ||
        inf.name?.toLowerCase().includes(q) ||
        inf.handle?.toLowerCase().includes(q) ||
        (inf.cat || '').toLowerCase().includes(q);
      const matchCat = activeCategory === 'All' ||
        (inf.cat || '').toLowerCase().includes(cat);
      return matchSearch && matchCat;
    });
  }, [allCreators, searchQuery, activeCategory]);

  // Reset to page 0 when filters change
  useEffect(() => { setPage(0); }, [searchQuery, activeCategory]);

  const topCreators = useMemo(() =>
    [...allCreators].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 3),
    [allCreators]
  );

  const paginated = useMemo(() =>
    filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page]
  );

  return (
    <div style={{ paddingTop: '56px', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2.5rem 2rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <div>
            <div className="section-label" style={{ marginBottom: '6px' }}>Creator Intelligence</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', marginBottom: '4px' }}>
              Influencer Dashboard
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text2)' }}>
              {isReal
                ? `${allCreators.length.toLocaleString('en-IN')} real creators · search, filter, and explore`
                : 'Browse and discover creators for your campaigns'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {isReal && (
              <span style={{ fontSize: '11px', padding: '5px 12px', borderRadius: '20px', background: 'rgba(200,240,104,0.08)', color: 'var(--accent)', border: '1px solid rgba(200,240,104,0.2)', fontFamily: 'var(--font-mono)' }}>
                ✓ Live Data
              </span>
            )}
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/campaign')} style={{ fontSize: '13px' }}>
              + New Campaign
            </button>
          </div>
        </div>

        {/* KPIs */}
        <KPIGrid />

        {/* ML Model Metrics */}
        <div style={{ background: 'var(--bg2)', border: '1px solid rgba(200,240,104,0.2)', borderRadius: 'var(--radius)', padding: '1rem 1.5rem', marginBottom: '2rem', display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--accent)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.06em', flexShrink: 0 }}>ML Models</div>
          {[
            { label: 'XGBoost Authenticity',      metric: 'AUC 0.94',   color: 'var(--blue)'   },
            { label: 'RandomForest Growth',        metric: 'R² 0.87',    color: 'var(--gold)'   },
            { label: 'Trend Ranker RF',            metric: 'R² 0.954',   color: 'var(--accent)' },
            { label: 'ChromaDB Brand Match',       metric: '1,500 indexed', color: 'var(--purple)' },
            { label: 'Training Dataset',           metric: '33,935 creators', color: 'var(--coral)' },
          ].map(m => (
            <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: m.color, flexShrink: 0 }} />
              <span style={{ fontSize: '11px', color: 'var(--text3)' }}>{m.label}</span>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: m.color }}>{m.metric}</span>
            </div>
          ))}
        </div>

        {/* Top Creators */}
        {!loading && topCreators.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text2)' }}>Top Ranked Creators</div>
              <div style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>by Ratefluencer™ score</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {topCreators.map((c, i) => (
                <FeaturedCard
                  key={c.id}
                  creator={c}
                  rank={i}
                  onClick={creator => navigate('/creator-profile', { state: { creator } })}
                />
              ))}
            </div>
          </div>
        )}

        {/* Search + Filter */}
        <SearchBar
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
          activeCategory={activeCategory}
          onCategoryChange={cat => setActiveCategory(cat)}
        />

        {/* Results label */}
        {!loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text2)' }}>
              {searchQuery || activeCategory !== 'All'
                ? <><strong style={{ color: 'var(--text)' }}>{filtered.length.toLocaleString()}</strong> results{searchQuery ? ` for "${searchQuery}"` : ''}{activeCategory !== 'All' ? ` in ${activeCategory}` : ''}</>
                : <><strong style={{ color: 'var(--text)' }}>{allCreators.length.toLocaleString()}</strong> creators</>
              }
            </div>
            {(searchQuery || activeCategory !== 'All') && (
              <button className="btn btn-ghost btn-sm" style={{ fontSize: '11px' }}
                onClick={() => { setSearchQuery(''); setActiveCategory('All'); }}>
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[...Array(8)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: '58px', borderRadius: 'var(--radius-sm)', opacity: 1 - i * 0.1 }} />
            ))}
          </div>
        ) : allCreators.length === 0 ? (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '4rem', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '1rem' }}>📡</div>
            <div style={{ fontSize: '15px', fontWeight: 500, marginBottom: '6px' }}>Backend not connected</div>
            <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '1.5rem' }}>
              Start the backend to load 33,935 real creators.
            </div>
            <code style={{ fontSize: '12px', color: 'var(--accent)', background: 'var(--bg3)', padding: '6px 14px', borderRadius: '6px', fontFamily: 'var(--font-mono)' }}>
              cd backend && source venv/bin/activate && python app.py
            </code>
          </div>
        ) : (
          <>
            <InfluencerTable
              data={paginated}
              onCreatorClick={creator => navigate('/creator-profile', { state: { creator } })}
            />
            <Pagination
              page={page}
              total={filtered.length}
              pageSize={PAGE_SIZE}
              onChange={setPage}
            />
          </>
        )}

      </div>
    </div>
  );
}
