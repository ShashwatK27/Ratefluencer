import React, { useState } from 'react';
import { campaignCategories } from '../data/index.js';

function FormGroup({ label, children, full }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: full ? '1 / -1' : undefined }}>
      <label>{label}</label>
      {children}
    </div>
  );
}

const BUDGET_PRESETS = [
  { label: '₹1L',  value: 100000  },
  { label: '₹5L',  value: 500000  },
  { label: '₹10L', value: 1000000 },
  { label: '₹25L', value: 2500000 },
  { label: '₹50L', value: 5000000 },
];

const RELATED_CATEGORIES = {
  Beauty: ['Wellness','Fashion'], Wellness: ['Fitness','Beauty'],
  Fitness: ['Wellness','Food'],   Food: ['Wellness','Travel'],
  Tech: ['Gaming','Education'],   Fashion: ['Beauty','Travel'],
  Travel: ['Food','Fashion'],     Gaming: ['Tech','Entertainment'],
  Finance: ['Tech','Education'],  Education: ['Tech','Finance'],
  Entertainment: ['Gaming','Travel'], Pets: ['Wellness','Food'],
};

const TIER_TIPS = {
  'Brand Awareness':     'Macro creators (100K–1M) maximise reach at the lowest CPM.',
  'Sales / Conversions': 'Micro-creators (10K–100K) show 3× higher conversion rates.',
  'Community Growth':    'Nano creators (1K–10K) drive the highest engagement per follower.',
  'Product Launch':      'Mix Macro reach with Micro authenticity for maximum launch impact.',
  'App Downloads':       'Tech-savvy audiences aged 18–34 deliver 4× higher install rates.',
};

const STEPS = [
  { num: 1, label: 'Basics',     icon: '📋' },
  { num: 2, label: 'Budget',     icon: '💰' },
  { num: 3, label: 'Audience',   icon: '👥' },
  { num: 4, label: 'Categories', icon: '🏷️' },
  { num: 5, label: 'Filters',    icon: '⚙️' },
];

function StepIndicator({ current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '2.5rem' }}>
      {STEPS.map((step, i) => {
        const done    = current > step.num;
        const active  = current === step.num;
        return (
          <React.Fragment key={step.num}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: done ? '14px' : '13px',
                background: done ? 'var(--accent)' : active ? 'rgba(200,240,104,0.15)' : 'var(--bg3)',
                border: active ? '2px solid var(--accent)' : done ? 'none' : '1px solid var(--border)',
                color: done ? '#0B0D0F' : active ? 'var(--accent)' : 'var(--text3)',
                fontWeight: done || active ? 600 : 400,
                transition: 'all .3s',
              }}>
                {done ? '✓' : step.num}
              </div>
              <div style={{ fontSize: '11px', color: active ? 'var(--accent)' : done ? 'var(--text2)' : 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>
                {step.label}
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: '2px', background: current > step.num ? 'var(--accent)' : 'var(--border)', margin: '0 4px', marginBottom: '22px', transition: 'background .3s' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function Campaign({ onNavigate, onCampaignSubmit, initialForm }) {
  const [step, setStep] = useState(initialForm ? 5 : 1);
  const [form, setForm] = useState(initialForm || {
    name: '', brand: '', goal: 'Brand Awareness',
    budget: 1000000,
    ageGroup: '25–34', audience: '', country: 'India', gender: 'All',
    selectedCategories: ['Wellness'],
    minAuth: '75+', tier: 'Macro (100K–1M)', minEr: '3%+', excludedBrands: '',
  });
  const [errors, setErrors] = useState({});

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const formatBudget = (v) => '₹' + parseInt(v).toLocaleString('en-IN');

  const validateStep = (s) => {
    const e = {};
    if (s === 1) {
      if (!form.name.trim())  e.name  = 'Campaign name is required';
      if (!form.brand.trim()) e.brand = 'Brand name is required';
    }
    if (s === 4 && form.selectedCategories.length === 0) {
      e.categories = 'Select at least one category';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validateStep(step)) setStep(s => Math.min(s + 1, 5)); };
  const back = () => { setErrors({}); setStep(s => Math.max(s - 1, 1)); };

  const handleAnalyze = () => {
    if (!validateStep(step)) return;
    onCampaignSubmit(form);
  };

  const toggleCategory = (label) => {
    set('selectedCategories',
      form.selectedCategories.includes(label)
        ? form.selectedCategories.filter(c => c !== label)
        : [...form.selectedCategories, label]
    );
    setErrors(p => ({ ...p, categories: '' }));
  };

  const cardStyle = {
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', padding: '2rem', marginBottom: '1.5rem',
  };

  return (
    <div style={{ paddingTop: '56px' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '3rem 2rem' }}>

        <div style={{ marginBottom: '2rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('landing')} style={{ marginBottom: '1.5rem', fontSize: '13px' }}>
            ← Home
          </button>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', marginBottom: '4px' }}>Create Campaign</h2>
          <p style={{ fontSize: '14px', color: 'var(--text2)' }}>Our AI will match you with the best creators from 33,935 real profiles.</p>
        </div>

        <StepIndicator current={step} />

        {/* ── Step 1: Basics ── */}
        {step === 1 && (
          <div className="fade-up" style={cardStyle}>
            <div style={{ fontSize: '13px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '1.5rem' }}>📋 Campaign Basics</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <FormGroup label="Campaign Name" full>
                <input type="text" value={form.name}
                  onChange={e => { set('name', e.target.value); setErrors(p => ({...p, name: ''})); }}
                  placeholder="e.g. Diwali 2025 — Skincare Launch"
                  style={errors.name ? { borderColor: 'var(--coral)' } : {}}
                  autoFocus
                />
                {errors.name && <div style={{ color: 'var(--coral)', fontSize: '12px' }}>⚠ {errors.name}</div>}
              </FormGroup>
              <FormGroup label="Brand / Product">
                <input type="text" value={form.brand}
                  onChange={e => { set('brand', e.target.value); setErrors(p => ({...p, brand: ''})); }}
                  placeholder="e.g. Nykaa Glow Serum"
                  style={errors.brand ? { borderColor: 'var(--coral)' } : {}}
                />
                {errors.brand && <div style={{ color: 'var(--coral)', fontSize: '12px' }}>⚠ {errors.brand}</div>}
              </FormGroup>
              <FormGroup label="Campaign Goal">
                <select value={form.goal} onChange={e => set('goal', e.target.value)}>
                  {['Brand Awareness','Product Launch','Sales / Conversions','App Downloads','Community Growth'].map(g => <option key={g}>{g}</option>)}
                </select>
              </FormGroup>
              <FormGroup label="Country">
                <select value={form.country} onChange={e => set('country', e.target.value)}>
                  {['India','UAE','USA','UK','Singapore','Australia'].map(c => <option key={c}>{c}</option>)}
                </select>
              </FormGroup>
            </div>
          </div>
        )}

        {/* ── Step 2: Budget ── */}
        {step === 2 && (
          <div className="fade-up" style={cardStyle}>
            <div style={{ fontSize: '13px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '1.5rem' }}>💰 Campaign Budget</div>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
                <input type="range" min="50000" max="5000000" step="50000"
                  value={form.budget} onChange={e => set('budget', Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--accent)', minWidth: '90px' }}>
                  {formatBudget(form.budget)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {BUDGET_PRESETS.map(p => (
                  <button key={p.label} onClick={() => set('budget', p.value)} style={{
                    padding: '6px 14px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer', transition: 'all .2s',
                    border: form.budget === p.value ? '1px solid rgba(200,240,104,0.4)' : '1px solid var(--border)',
                    color: form.budget === p.value ? 'var(--accent)' : 'var(--text2)',
                    background: form.budget === p.value ? 'var(--accent-dim)' : 'transparent',
                    fontFamily: 'var(--font-body)',
                  }}>{p.label}</button>
                ))}
              </div>
            </div>
            <div style={{ padding: '12px 14px', background: 'rgba(200,240,104,0.05)', border: '1px solid rgba(200,240,104,0.15)', borderRadius: 'var(--radius-sm)', fontSize: '13px', color: 'var(--text2)' }}>
              💡 <strong style={{ color: 'var(--text)' }}>{TIER_TIPS[form.goal]}</strong>
            </div>
          </div>
        )}

        {/* ── Step 3: Audience ── */}
        {step === 3 && (
          <div className="fade-up" style={cardStyle}>
            <div style={{ fontSize: '13px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '1.5rem' }}>👥 Target Audience</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <FormGroup label="Primary Age Group">
                  <select value={form.ageGroup} onChange={e => set('ageGroup', e.target.value)}>
                    {['13–17','18–24','25–34','35–44','45+'].map(a => <option key={a}>{a}</option>)}
                  </select>
                </FormGroup>
                <FormGroup label="Gender">
                  <select value={form.gender} onChange={e => set('gender', e.target.value)}>
                    {['All','Female','Male','Non-binary'].map(g => <option key={g}>{g}</option>)}
                  </select>
                </FormGroup>
              </div>
              <FormGroup label={<>Audience Description <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(most impactful for AI matching)</span></>}>
                <textarea value={form.audience} onChange={e => set('audience', e.target.value)}
                  placeholder="e.g. Urban millennials interested in skincare, wellness, and sustainable living. Tier-1 and Tier-2 Indian cities."
                  style={{ minHeight: '90px' }}
                />
              </FormGroup>
            </div>
          </div>
        )}

        {/* ── Step 4: Categories ── */}
        {step === 4 && (
          <div className="fade-up" style={cardStyle}>
            <div style={{ fontSize: '13px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '1.5rem' }}>🏷️ Content Category</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px', marginBottom: '12px' }}>
              {campaignCategories.map(({ icon, label }) => {
                const active = form.selectedCategories.includes(label);
                return (
                  <button key={label} onClick={() => toggleCategory(label)} style={{
                    padding: '8px', borderRadius: 'var(--radius-sm)', fontSize: '12px',
                    border: active ? '1px solid rgba(200,240,104,0.4)' : '1px solid var(--border)',
                    color: active ? 'var(--accent)' : 'var(--text2)',
                    cursor: 'pointer', transition: 'all .2s', textAlign: 'center',
                    background: active ? 'var(--accent-dim)' : 'var(--bg3)',
                    fontFamily: 'var(--font-body)',
                  }}>
                    <span style={{ fontSize: '18px', display: 'block', marginBottom: '4px' }}>{icon}</span>
                    {label}
                  </button>
                );
              })}
            </div>
            {errors.categories && <div style={{ color: 'var(--coral)', fontSize: '12px', marginBottom: '8px' }}>⚠ {errors.categories}</div>}
            {form.selectedCategories.length > 0 && (
              <div style={{ background: 'linear-gradient(135deg,rgba(200,240,104,0.05),rgba(104,184,240,0.05))', border: '1px solid rgba(200,240,104,0.15)', borderRadius: 'var(--radius)', padding: '1rem', display: 'flex', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>💡</span>
                <div style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.6 }}>
                  {(() => {
                    const primary = form.selectedCategories[0];
                    const related = (RELATED_CATEGORIES[primary] || []).filter(s => !form.selectedCategories.includes(s)).slice(0, 2);
                    return related.length > 0
                      ? <><strong style={{ color: 'var(--accent)' }}>AI Tip:</strong> For <strong style={{ color: 'var(--text)' }}>{primary}</strong> + {form.ageGroup}, also consider <strong style={{ color: 'var(--accent)' }}>{related.join(' & ')}</strong> — strong audience overlap.</>
                      : <><strong style={{ color: 'var(--accent)' }}>Good selection!</strong> {form.selectedCategories.join(' + ')} is well-targeted for {form.ageGroup}.</>;
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 5: Filters ── */}
        {step === 5 && (
          <div className="fade-up" style={cardStyle}>
            <div style={{ fontSize: '13px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '1.5rem' }}>
              ⚙️ Advanced Filters <span style={{ color: 'var(--text3)', fontSize: '11px', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(optional)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <FormGroup label="Min Authenticity">
                <select value={form.minAuth} onChange={e => set('minAuth', e.target.value)}>
                  {['Any','60+','75+','85+','90+'].map(v => <option key={v}>{v}</option>)}
                </select>
              </FormGroup>
              <FormGroup label="Influencer Tier">
                <select value={form.tier} onChange={e => set('tier', e.target.value)}>
                  {['All tiers','Nano (1K–10K)','Micro (10K–100K)','Macro (100K–1M)','Mega (1M+)'].map(v => <option key={v}>{v}</option>)}
                </select>
              </FormGroup>
              <FormGroup label="Min Engagement Rate">
                <select value={form.minEr} onChange={e => set('minEr', e.target.value)}>
                  {['Any','1%+','3%+','5%+','8%+'].map(v => <option key={v}>{v}</option>)}
                </select>
              </FormGroup>
              <FormGroup label="Exclude Brands" full>
                <input type="text" value={form.excludedBrands} onChange={e => set('excludedBrands', e.target.value)}
                  placeholder="e.g. Lakme, Mamaearth (comma separated)" />
              </FormGroup>
            </div>

            {/* Campaign summary */}
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '13px', color: 'var(--text2)', lineHeight: 1.8 }}>
              <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '8px' }}>Campaign Summary</div>
              <strong style={{ color: 'var(--text)' }}>{form.name || 'Untitled'}</strong> for <strong style={{ color: 'var(--accent)' }}>{form.brand || '—'}</strong> ·{' '}
              {formatBudget(form.budget)} · {form.goal} · {form.ageGroup} · {form.selectedCategories.join(', ')}
            </div>
          </div>
        )}

        {/* ── Navigation buttons ── */}
        <div style={{ display: 'flex', gap: '12px' }}>
          {step > 1 && (
            <button className="btn btn-ghost" onClick={back} style={{ flex: 1, justifyContent: 'center', padding: '14px', fontSize: '15px' }}>
              ← Back
            </button>
          )}
          {step < 5 ? (
            <button
              className="btn btn-primary" onClick={next}
              style={{ flex: 2, justifyContent: 'center', padding: '14px', fontSize: '15px' }}
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleAnalyze}
              style={{ flex: 2, padding: '14px', borderRadius: '100px', background: 'var(--accent)', color: '#0B0D0F', fontSize: '15px', fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all .2s' }}
              onMouseEnter={e => { e.target.style.background = 'var(--accent2)'; e.target.style.boxShadow = '0 12px 40px rgba(200,240,104,0.3)'; e.target.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.target.style.background = 'var(--accent)'; e.target.style.boxShadow = 'none'; e.target.style.transform = 'none'; }}
            >
              ⚡ Analyze Campaign with AI
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
