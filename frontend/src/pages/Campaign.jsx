import React, { useState } from 'react';
import { campaignCategories } from '../data/index.js';

function FormCard({ title, children }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '2rem', marginBottom: '1.5rem' }}>
      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text2)', letterSpacing: '.05em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function FormGroup({ label, children, full }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: full ? '1 / -1' : undefined }}>
      <label>{label}</label>
      {children}
    </div>
  );
}

const BUDGET_PRESETS = [
  { label: '₹1L', value: 100000 },
  { label: '₹5L', value: 500000 },
  { label: '₹10L', value: 1000000 },
  { label: '₹25L', value: 2500000 },
  { label: '₹50L', value: 5000000 },
];

// Fix #6: dynamic AI suggestion helpers
const RELATED_CATEGORIES = {
  Beauty:        ['Wellness', 'Fashion'],
  Wellness:      ['Fitness', 'Beauty'],
  Fitness:       ['Wellness', 'Food'],
  Food:          ['Wellness', 'Travel'],
  Tech:          ['Gaming', 'Education'],
  Fashion:       ['Beauty', 'Travel'],
  Travel:        ['Food', 'Fashion'],
  Gaming:        ['Tech', 'Entertainment'],
  Finance:       ['Tech', 'Education'],
  Education:     ['Tech', 'Finance'],
  Entertainment: ['Gaming', 'Travel'],
  Pets:          ['Wellness', 'Food'],
};

const TIER_TIPS = {
  'Brand Awareness':     'Macro creators (100K–1M) maximise reach at the lowest CPM.',
  'Sales / Conversions': 'Micro-creators (10K–100K) show 3× higher conversion rates than mega-influencers.',
  'Community Growth':    'Nano creators (1K–10K) drive the highest engagement per follower.',
  'Product Launch':      'Mix Macro reach with Micro authenticity for maximum launch impact.',
  'App Downloads':       'Tech-savvy audiences aged 18–34 deliver 4× higher app install rates.',
};

export default function Campaign({ onNavigate, onCampaignSubmit }) {
  const [form, setForm] = useState({
    name: '', brand: '', country: 'India', goal: 'Brand Awareness',
    duration: '1 month', budget: 1000000,
    ageGroup: '25–34', gender: 'All Genders', audience: '',
    selectedCategories: ['Wellness'],
    minAuth: '75+', tier: 'Macro (100K–1M)',
    minEr: '3%+', platform: 'Instagram',
    excludedBrands: '',
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const toggleCategory = (label) => {
    set('selectedCategories',
      form.selectedCategories.includes(label)
        ? form.selectedCategories.filter(c => c !== label)
        : [...form.selectedCategories, label]
    );
  };

  const formatBudget = (v) => '₹' + parseInt(v).toLocaleString('en-IN');

  const handleAnalyze = () => {
    onCampaignSubmit(form);
  };

  return (
    <div style={{ paddingTop: '56px' }}>
      <div style={{ maxWidth: '780px', margin: '0 auto', padding: '3rem 2rem' }}>

        <div style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '36px', marginBottom: '8px' }}>Create Campaign</h2>
          <p style={{ fontSize: '15px', color: 'var(--text2)' }}>Fill in the details below. Our AI will analyze 50,000+ creators and recommend the best fit.</p>
        </div>

        {/* Basics */}
        <FormCard title="📋 Campaign Basics">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <FormGroup label="Campaign Name" full>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Diwali 2025 — Skincare Launch" />
            </FormGroup>
            <FormGroup label="Brand / Product">
              <input type="text" value={form.brand} onChange={e => set('brand', e.target.value)} placeholder="e.g. Nykaa Glow Serum" />
            </FormGroup>
            <FormGroup label="Target Country">
              <select value={form.country} onChange={e => set('country', e.target.value)}>
                <option value="India">🇮🇳 India</option>
                <option value="USA">🇺🇸 United States</option>
                <option value="UK">🇬🇧 United Kingdom</option>
                <option value="UAE">🇦🇪 UAE</option>
                <option value="Singapore">🇸🇬 Singapore</option>
              </select>
            </FormGroup>
            <FormGroup label="Campaign Goal">
              <select value={form.goal} onChange={e => set('goal', e.target.value)}>
                {['Brand Awareness','Product Launch','Sales / Conversions','App Downloads','Community Growth'].map(g => <option key={g}>{g}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Campaign Duration">
              <select value={form.duration} onChange={e => set('duration', e.target.value)}>
                {['1 week','2 weeks','1 month','3 months'].map(d => <option key={d}>{d}</option>)}
              </select>
            </FormGroup>
          </div>
        </FormCard>

        {/* Budget */}
        <FormCard title="💰 Budget">
          <FormGroup label="Total Campaign Budget (₹)">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="range" min="50000" max="5000000" step="50000"
                value={form.budget}
                onChange={e => set('budget', Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--accent)', minWidth: '80px' }}>
                {formatBudget(form.budget)}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
              {BUDGET_PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => set('budget', p.value)}
                  style={{
                    padding: '5px 12px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', transition: 'all .2s',
                    border: form.budget === p.value ? '1px solid rgba(200,240,104,0.4)' : '1px solid var(--border)',
                    color: form.budget === p.value ? 'var(--accent)' : 'var(--text2)',
                    background: form.budget === p.value ? 'var(--accent-dim)' : 'transparent',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </FormGroup>
        </FormCard>

        {/* Audience */}
        <FormCard title="👥 Target Audience">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <FormGroup label="Primary Age Group">
              <select value={form.ageGroup} onChange={e => set('ageGroup', e.target.value)}>
                {['13–17','18–24','25–34','35–44','45+'].map(a => <option key={a}>{a}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Gender Focus">
              <select value={form.gender} onChange={e => set('gender', e.target.value)}>
                {['All Genders','Primarily Female','Primarily Male','Non-binary inclusive'].map(g => <option key={g}>{g}</option>)}
              </select>
            </FormGroup>
            <FormGroup label={<>Audience Description <span style={{ color: 'var(--text3)' }}>(helps AI refine matches)</span></>} full>
              <textarea
                value={form.audience}
                onChange={e => set('audience', e.target.value)}
                placeholder="e.g. Urban millennials interested in skincare, wellness, and sustainable living. Tier-1 and Tier-2 Indian cities."
              />
            </FormGroup>
          </div>
        </FormCard>

        {/* Categories */}
        <FormCard title="🏷️ Content Category">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px' }}>
            {campaignCategories.map(({ icon, label }) => {
              const active = form.selectedCategories.includes(label);
              return (
                <button
                  key={label}
                  onClick={() => toggleCategory(label)}
                  style={{
                    padding: '8px', borderRadius: 'var(--radius-sm)', fontSize: '12px',
                    border: active ? '1px solid rgba(200,240,104,0.4)' : '1px solid var(--border)',
                    color: active ? 'var(--accent)' : 'var(--text2)',
                    cursor: 'pointer', transition: 'all .2s', textAlign: 'center',
                    background: active ? 'var(--accent-dim)' : 'var(--bg3)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  <span style={{ fontSize: '18px', display: 'block', marginBottom: '4px' }}>{icon}</span>
                  {label}
                </button>
              );
            })}
          </div>

          {/* AI suggestion */}
          <div style={{ background: 'linear-gradient(135deg,rgba(200,240,104,0.05),rgba(104,184,240,0.05))', border: '1px solid rgba(200,240,104,0.15)', borderRadius: 'var(--radius)', padding: '1.25rem', marginTop: '1rem', display: 'flex', gap: '12px' }}>
            <span style={{ fontSize: '20px', flexShrink: 0, marginTop: '2px' }}>💡</span>
            <div style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--accent)' }}>AI Suggestion:</strong>{' '}
            {(() => {
              const primary = form.selectedCategories[0] || 'General';
              const related = RELATED_CATEGORIES[primary] || ['Lifestyle'];
              const suggestions = related.filter(s => !form.selectedCategories.includes(s)).slice(0, 2);
              const tip = TIER_TIPS[form.goal] || 'A Macro + Micro creator mix balances reach and engagement.';
              return suggestions.length > 0 ? (
                <>For <strong style={{ color: 'var(--text)' }}>{primary}</strong> targeting <strong style={{ color: 'var(--text)' }}>{form.ageGroup}</strong>, also consider{' '}
                  {suggestions.map((s, i) => (
                    <React.Fragment key={s}>
                      <strong style={{ color: 'var(--accent)' }}>{s}</strong>{i < suggestions.length - 1 ? ' and ' : ''}
                    </React.Fragment>
                  ))}{' '}
                  — strong audience overlap. {tip}</>
              ) : (
                <>Your <strong style={{ color: 'var(--accent)' }}>{form.selectedCategories.join(' + ')}</strong> selection is well-targeted for {form.ageGroup}. {tip}</>
              );
            })()}
            </div>
          </div>
        </FormCard>

        {/* Advanced */}
        <FormCard title={<>⚙️ Advanced Filters <span style={{ color: 'var(--text3)', fontSize: '11px', textTransform: 'none', fontWeight: 400, letterSpacing: 0 }}>(optional but improves recommendations)</span></>}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <FormGroup label="Minimum Authenticity Score">
              <select value={form.minAuth} onChange={e => set('minAuth', e.target.value)}>
                {['Any','60+','75+','85+','90+'].map(v => <option key={v}>{v}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Influencer Tier">
              <select value={form.tier} onChange={e => set('tier', e.target.value)}>
                {['All tiers','Nano (1K–10K)','Micro (10K–100K)','Macro (100K–1M)','Mega (1M+)'].map(v => <option key={v}>{v}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Minimum Engagement Rate">
              <select value={form.minEr} onChange={e => set('minEr', e.target.value)}>
                {['Any','1%+','3%+','5%+','8%+'].map(v => <option key={v}>{v}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Platform">
              <select value={form.platform} onChange={e => set('platform', e.target.value)}>
                {['All Platforms','Instagram','YouTube','TikTok','Twitter/X'].map(v => <option key={v}>{v}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Exclude Competitors / Blocked Brands" full>
              <input type="text" value={form.excludedBrands} onChange={e => set('excludedBrands', e.target.value)} placeholder="e.g. Lakme, Mamaearth (comma separated)" />
            </FormGroup>
          </div>
        </FormCard>

        <button
          onClick={handleAnalyze}
          style={{
            width: '100%', padding: '16px', borderRadius: '100px',
            background: 'var(--accent)', color: '#0B0D0F', fontSize: '16px',
            fontWeight: 600, border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-body)', transition: 'all .2s', marginTop: '.5rem',
          }}
          onMouseEnter={e => { e.target.style.background = 'var(--accent2)'; e.target.style.boxShadow = '0 12px 40px rgba(200,240,104,0.3)'; e.target.style.transform = 'translateY(-2px)'; }}
          onMouseLeave={e => { e.target.style.background = 'var(--accent)'; e.target.style.boxShadow = 'none'; e.target.style.transform = 'none'; }}
        >
          ⚡ Analyze Campaign with AI
        </button>
      </div>
    </div>
  );
}
