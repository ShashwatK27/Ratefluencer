import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { config } from '../config.js';
import ReelAssets from '../components/ReelAssets.jsx';

const CATEGORIES = ['Fashion', 'Food', 'Travel', 'Family', 'Beauty', 'Fitness', 'Interior', 'Pet', 'Other'];
const DURATIONS  = [{ label: '30s Reel', val: 30 }, { label: '45s Reel', val: 45 }, { label: '60s Reel', val: 60 }];

// -- Virality Score Ring -------------------------------------------------------
function ViralityRing({ score, label }) {
  const color  = score >= 70 ? 'var(--accent)' : score >= 50 ? 'var(--gold)' : 'var(--coral)';
  const offset = 201 * (1 - score / 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div style={{ position: 'relative', width: '72px', height: '72px', flexShrink: 0 }}>
        <svg viewBox="0 0 72 72" width="72" height="72" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
          <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
          <circle cx="36" cy="36" r="28" fill="none" stroke={color} strokeWidth="6" strokeDasharray="176" strokeDashoffset={176 * (1 - score/100)} strokeLinecap="round" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '18px', color }}>
          {score}
        </div>
      </div>
      <div>
        <div style={{ fontWeight: 500, color, fontSize: '14px', marginBottom: '2px' }}>{label}</div>
        <div style={{ fontSize: '11px', color: 'var(--text3)' }}>Virality Score / 100</div>
      </div>
    </div>
  );
}

// -- Virality signal bars ------------------------------------------------------
function ViralityBreakdown({ signals }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
      {signals.map(s => (
        <div key={s.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', fontSize: '11px', color: 'var(--text3)' }}>
            <span>{s.label}</span>
            <span>{s.score}/{s.max}</span>
          </div>
          <div style={{ height: '3px', background: 'var(--bg3)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '3px', background: 'var(--accent)', width: `${(s.score / s.max) * 100}%`, borderRadius: '2px', transition: 'width 0.6s ease' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// -- Step badge ----------------------------------------------------------------
function StepBadge({ n, active, done }) {
  const bg = done ? 'var(--accent)' : active ? 'rgba(200,240,104,0.15)' : 'var(--bg3)';
  const color = done ? '#0B0D0F' : active ? 'var(--accent)' : 'var(--text3)';
  const border = active ? '1px solid rgba(200,240,104,0.4)' : '1px solid transparent';
  return (
    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: bg, color, border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontFamily: 'var(--font-mono)', fontWeight: 500, flexShrink: 0 }}>
      {done ? '✓' : n}
    </div>
  );
}

function SectionHeader({ step, total, title, subtitle, active, done }) {
  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: active ? '1.5rem' : '0' }}>
      <StepBadge n={step} active={active} done={done} />
      <div>
        <div style={{ fontWeight: 500, fontSize: '14px', color: active || done ? 'var(--text)' : 'var(--text3)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>{subtitle}</div>}
      </div>
    </div>
  );
}

// -- Backend offline banner ---------------------------------------------------
function BackendOfflineBanner() {
  return (
    <div style={{ background: 'rgba(240,120,104,0.06)', border: '1px solid rgba(240,120,104,0.25)', borderRadius: 'var(--radius)', padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--coral)', flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--coral)', marginBottom: '2px' }}>Backend not running</div>
        <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
          Start the backend to enable content generation:
          <code style={{ marginLeft: '8px', padding: '1px 8px', background: 'var(--bg3)', borderRadius: '4px', fontSize: '11px', color: 'var(--text2)' }}>
            cd backend && source venv/bin/activate && python app.py
          </code>
        </div>
      </div>
    </div>
  );
}

// -- Copy button ---------------------------------------------------------------
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy} className="btn btn-ghost btn-sm" style={{ fontSize: '11px', padding: '4px 10px' }}>
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

// -- Instagram Post Preview ----------------------------------------------------
function InstagramPreview({ caption, hashtags, engagementHook }) {
  const hashtagStr = (hashtags || []).map(h => '#' + h).join(' ');
  return (
    <div style={{ background: '#0B0D0F', border: '1px solid rgba(176,104,240,0.3)', borderRadius: '12px', overflow: 'hidden', maxWidth: '380px', margin: '0 auto', fontFamily: 'var(--font-body)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)', flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>your_handle</div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>Sponsored</div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '20px', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>···</div>
      </div>
      {/* Image placeholder */}
      <div style={{ aspectRatio: '1', background: 'linear-gradient(135deg, rgba(176,104,240,0.15), rgba(200,240,104,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)' }}>
          <div style={{ fontSize: '36px', marginBottom: '6px' }}>📸</div>
          <div style={{ fontSize: '11px' }}>Your reel thumbnail</div>
        </div>
      </div>
      {/* Actions */}
      <div style={{ display: 'flex', gap: '14px', padding: '10px 14px 6px', alignItems: 'center' }}>
        {['♡', '💬', '↗'].map(icon => (
          <span key={icon} style={{ fontSize: '20px', cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }}>{icon}</span>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '20px', cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }}>🔖</span>
      </div>
      {/* Caption */}
      <div style={{ padding: '4px 14px 14px' }}>
        <div style={{ fontSize: '13px', color: '#fff', lineHeight: 1.5, marginBottom: '6px', whiteSpace: 'pre-line' }}>
          <span style={{ fontWeight: 600 }}>your_handle </span>{caption}
        </div>
        {engagementHook && (
          <div style={{ fontSize: '12px', color: 'rgba(176,104,240,0.9)', fontStyle: 'italic', marginBottom: '6px' }}>{engagementHook}</div>
        )}
        <div style={{ fontSize: '12px', color: 'rgba(104,144,240,0.8)', lineHeight: 1.6, wordBreak: 'break-word' }}>{hashtagStr}</div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '6px' }}>View all comments</div>
      </div>
    </div>
  );
}

// -- LinkedIn Post Preview -----------------------------------------------------
function LinkedInPreview({ post, hashtags }) {
  const hashtagStr = (hashtags || []).map(h => '#' + h).join(' ');
  return (
    <div style={{ background: '#1B1F23', border: '1px solid rgba(104,184,240,0.3)', borderRadius: '8px', overflow: 'hidden', maxWidth: '480px', margin: '0 auto', fontFamily: 'var(--font-body)' }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: '10px', padding: '14px 16px 10px', alignItems: 'flex-start' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(104,184,240,0.6), rgba(200,240,104,0.4))', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>👤</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>Your Name</div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>Creator · Content Strategist</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>Just now · 🌐</div>
        </div>
        <button style={{ background: 'transparent', border: '1px solid rgba(104,184,240,0.4)', color: 'rgba(104,184,240,0.9)', fontSize: '12px', borderRadius: '20px', padding: '5px 14px', cursor: 'pointer', fontWeight: 600 }}>+ Follow</button>
      </div>
      {/* Post body */}
      <div style={{ padding: '0 16px 12px' }}>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, whiteSpace: 'pre-line', marginBottom: '8px' }}>{post}</div>
        <div style={{ fontSize: '12px', color: 'rgba(104,144,240,0.8)', lineHeight: 1.7, wordBreak: 'break-word' }}>{hashtagStr}</div>
      </div>
      {/* Reactions */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 16px', display: 'flex', gap: '4px', alignItems: 'center' }}>
        {['👍', '❤️', '💡'].map(e => (
          <span key={e} style={{ fontSize: '14px' }}>{e}</span>
        ))}
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginLeft: '4px' }}>Be the first to react</span>
      </div>
      {/* Actions */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-around', padding: '4px 0' }}>
        {[['👍', 'Like'], ['💬', 'Comment'], ['🔁', 'Repost'], ['✉️', 'Send']].map(([icon, label]) => (
          <button key={label} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.45)', fontSize: '12px', padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', borderRadius: '4px' }}>
            <span style={{ fontSize: '15px' }}>{icon}</span>{label}
          </button>
        ))}
      </div>
    </div>
  );
}

// -- Main page -----------------------------------------------------------------
export default function ContentStudio() {
  const _nav = useNavigate(); // eslint-disable-line no-unused-vars
  const [backendOnline, setBackendOnline] = useState(true);
  const [category,     setCategory]     = useState('Fashion');
  const [context,      setContext]      = useState('');
  const [duration,     setDuration]     = useState(45);

  // Step results
  const [trends,       setTrends]       = useState(null);
  const [selectedTrend, setSelectedTrend] = useState(null);
  const [script,       setScript]       = useState(null);
  const [content,      setContent]      = useState(null);

  // Loading states per step
  const [loadingTrends,  setLoadingTrends]  = useState(false);
  const [loadingScript,  setLoadingScript]  = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [error,          setError]          = useState('');

  useEffect(() => {
    fetch(config.api.endpoints.groqStatus)
      .then(r => r.ok ? r.json() : null)
      .then(d => setBackendOnline(d?.available !== false))
      .catch(() => setBackendOnline(false));
  }, []);

  const step = !trends ? 1 : !script ? 2 : !content ? 3 : 4;

  // Step 1: Discover trends
  const discoverTrends = async () => {
    setLoadingTrends(true); setError(''); setTrends(null); setSelectedTrend(null); setScript(null); setContent(null);
    try {
      const res = await fetch(config.api.endpoints.discoverTrends, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, context }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setTrends(d.trends);
    } catch (e) { setError(e.message); }
    finally { setLoadingTrends(false); }
  };

  // Step 2: Generate script
  const generateScript = async () => {
    if (!selectedTrend) return;
    setLoadingScript(true); setError(''); setScript(null); setContent(null);
    try {
      const res = await fetch(config.api.endpoints.generateScript, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: selectedTrend.topic, category, context, duration }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setScript(d);
    } catch (e) { setError(e.message); }
    finally { setLoadingScript(false); }
  };

  // Step 3: Generate content — parallel calls to Instagram + LinkedIn endpoints
  const generateContent = async () => {
    setLoadingContent(true); setError(''); setContent(null);
    const topic = selectedTrend?.topic || '';
    const body  = { topic, tone: 'Inspirational', content_category: category, context };
    try {
      const [igRes, liRes] = await Promise.all([
        fetch(config.api.endpoints.generateContent, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
        fetch(config.api.endpoints.generateLinkedin, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, tone: 'Professional' }),
        }),
      ]);
      if (!igRes.ok || !liRes.ok) throw new Error('Content generation failed');
      const ig = await igRes.json();
      const li = await liRes.json();

      const toArr = (str) =>
        (str || '').replace(/#/g, '').split(/\s+/).filter(Boolean);

      setContent({
        instagram_caption:  ig.caption   || '',
        instagram_hashtags: toArr(ig.hashtags),
        engagement_hook:    li.engagement_hook || ig.reel_idea || '',
        linkedin_post:      li.post      || '',
        linkedin_hashtags:  toArr(li.hashtags),
        virality: {
          score:   Math.round((ig.virality_score + li.virality_score) / 2) || ig.virality_score,
          label:   ig.virality_score >= 70 ? 'High Virality' : 'Moderate Virality',
          signals: ig.optimization_tips?.slice(0, 4).map((t, i) => ({
            label: t.replace(/^[✓v^[\]OK\s]+/,'').slice(0, 30),
            score: Math.max(5, 25 - i * 4),
            max: 25,
          })) || [],
        },
        predicted_views_str:  ig.predicted_views_str,
        predicted_likes_str:  ig.predicted_likes_str,
        predicted_shares_str: ig.predicted_shares_str,
        predicted_saves_str:  ig.predicted_saves_str,
        best_post_time: ig.best_post_time,
      });
    } catch (e) { setError(e.message); }
    finally { setLoadingContent(false); }
  };

  const trendColor = (score) => score >= 80 ? 'var(--accent)' : score >= 65 ? 'var(--gold)' : 'var(--blue)';

  return (
    <div style={{ paddingTop: '56px', minHeight: '100vh' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '3rem 2rem' }}>
        <button onClick={() => _nav('/')} className="btn btn-ghost btn-sm" style={{ fontSize: '13px', marginBottom: '1.5rem' }}>← Home</button>

        {/* Header */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div className="section-label" style={{ marginBottom: '8px' }}>Track 2  -  AI Content Studio</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '40px', marginBottom: '8px', lineHeight: 1.1 }}>
            Viral Content<br /><em style={{ color: 'var(--accent)', fontStyle: 'italic' }}>on autopilot.</em>
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--text2)', maxWidth: '520px', lineHeight: 1.7 }}>
            Discover trending topics, generate a reel script, and get LinkedIn + Instagram content  -  all in one AI-powered workflow.
          </p>
        </div>

        {/* API Key setup */}
        {!backendOnline && <BackendOfflineBanner />}

        {/* -- STEP 1: Campaign setup + Trend Discovery -- */}
        <div className="shine-card" style={{ background: 'var(--bg2)', border: `1px solid ${step >= 1 ? 'var(--border2)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '1.5rem', marginBottom: '1.5rem', overflow: 'hidden' }}>
          <SectionHeader step={1} title="Discover Trending Topics" subtitle="Choose your niche and let AI surface what's going viral" active={step === 1} done={!!trends} />

          {step === 1 && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.04em', fontFamily: 'var(--font-mono)' }}>Niche / Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} style={{ fontSize: '13px' }}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.04em', fontFamily: 'var(--font-mono)' }}>Brand / Product (optional)</label>
                  <input value={context} onChange={e => setContext(e.target.value)} placeholder="e.g. organic skincare brand" style={{ fontSize: '13px' }} />
                </div>
              </div>
              <button className="btn btn-primary" onClick={discoverTrends} disabled={!backendOnline || loadingTrends} style={{ fontSize: '13px', justifyContent: 'center' }}>
                {loadingTrends ? 'Discovering trends...' : 'Discover Trends ->'}
              </button>
              {!backendOnline && <div style={{ fontSize: '11px', color: 'var(--coral)', marginTop: '8px' }}>Start the backend to continue.</div>}
            </>
          )}

          {/* Trend results */}
          {trends && (
            <div style={{ marginTop: step !== 1 ? 0 : '1.5rem' }}>
              {step !== 1 && selectedTrend && (
                <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '8px' }}>
                  Selected: <strong style={{ color: 'var(--accent)' }}>{selectedTrend.topic}</strong>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setTrends(null); setSelectedTrend(null); setScript(null); setContent(null); }} style={{ fontSize: '11px', marginLeft: '8px' }}>Change</button>
                </div>
              )}
              {step === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '1rem' }}>
                  {trends.map((t, i) => (
                    <div
                      key={i}
                      onClick={() => setSelectedTrend(t)}
                      style={{ padding: '12px 14px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: `1px solid ${selectedTrend?.topic === t.topic ? 'rgba(200,240,104,0.4)' : 'var(--border)'}`, background: selectedTrend?.topic === t.topic ? 'rgba(200,240,104,0.06)' : 'var(--bg3)', transition: 'all .15s', display: 'flex', gap: '12px', alignItems: 'center' }}
                    >
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: trendColor(t.trend_score), minWidth: '36px' }}>{t.trend_score}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', marginBottom: '2px' }}>{t.topic}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{t.why_trending}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', fontSize: '10px', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                        <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(200,240,104,0.08)', color: 'var(--accent)' }}>vel {t.growth_velocity}</span>
                        <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(104,184,240,0.08)', color: 'var(--blue)' }}>fit {t.audience_fit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* -- STEP 2: Script Generation -- */}
        {trends && (
          <div className="shine-card" style={{ background: 'var(--bg2)', border: `1px solid ${step >= 2 ? 'var(--border2)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '1.5rem', marginBottom: '1.5rem', overflow: 'hidden' }}>
            <SectionHeader step={2} title="Generate Reel Script" subtitle="AI writes your Hook, Story, Key Insights, and CTA" active={step === 2} done={!!script} />

            {step === 2 && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
                  {DURATIONS.map(d => (
                    <button key={d.val} onClick={() => setDuration(d.val)} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-body)', border: duration === d.val ? '1px solid rgba(200,240,104,0.4)' : '1px solid var(--border)', background: duration === d.val ? 'var(--accent-dim)' : 'transparent', color: duration === d.val ? 'var(--accent)' : 'var(--text2)', transition: 'all .15s' }}>
                      {d.label}
                    </button>
                  ))}
                </div>
                <button className="btn btn-primary" onClick={generateScript} disabled={!selectedTrend || loadingScript} style={{ fontSize: '13px', justifyContent: 'center', width: '100%', opacity: !selectedTrend ? 0.5 : 1 }}>
                  {loadingScript ? 'Writing script...' : selectedTrend ? `Generate ${duration}s Script ->` : 'Select a trend first'}
                </button>
              </div>
            )}

            {script && (
              <div style={{ marginTop: step !== 2 ? 0 : '1.5rem' }}>
                {step !== 2 && <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '8px', marginBottom: '1rem' }}>Script generated for: <strong style={{ color: 'var(--accent)' }}>{selectedTrend?.topic}</strong></div>}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '1rem' }}>
                  {[
                    { label: 'HOOK (0-5s)', content: script.hook, color: 'var(--coral)' },
                    { label: 'CALL TO ACTION', content: script.cta, color: 'var(--gold)' },
                  ].map(s => (
                    <div key={s.label} style={{ padding: '12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '10px', color: s.color, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '6px' }}>{s.label}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.5 }}>"{s.content}"</div>
                    </div>
                  ))}
                </div>

                <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg3)', border: '1px solid var(--border)', marginBottom: '10px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--blue)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '6px' }}>STORY (5-{script.estimated_duration - 5}s)</div>
                  <div style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.6 }}>{script.story}</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--accent)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '6px' }}>KEY INSIGHTS</div>
                    {(script.key_insights || []).map((ins, i) => (
                      <div key={i} style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '4px', display: 'flex', gap: '6px' }}>
                        <span style={{ color: 'var(--accent)', flexShrink: 0 }}>-></span>{ins}
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--purple)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '6px' }}>VISUAL DIRECTIONS</div>
                    {(script.visual_directions || []).map((v, i) => (
                      <div key={i} style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '4px', display: 'flex', gap: '6px' }}>
                        <span style={{ color: 'var(--purple)', flexShrink: 0 }}>-></span>{v}
                      </div>
                    ))}
                  </div>
                </div>

                {script.virality && <ViralityRing score={script.virality.score} label={script.virality.label} />}
                {script.virality && <ViralityBreakdown signals={script.virality.signals} />}
              </div>
            )}
          </div>
        )}

        {/* -- STEP 3: Content Generation -- */}
        {script && (
          <div className="shine-card" style={{ background: 'var(--bg2)', border: `1px solid ${step >= 3 ? 'var(--border2)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '1.5rem', marginBottom: '1.5rem', overflow: 'hidden' }}>
            <SectionHeader step={3} title="Generate LinkedIn & Instagram Content" subtitle="Ready-to-post captions and hashtags for both platforms" active={step === 3} done={!!content} />

            {step === 3 && (
              <div style={{ marginTop: '1rem' }}>
                <button className="btn btn-primary" onClick={generateContent} disabled={loadingContent} style={{ fontSize: '13px', justifyContent: 'center', width: '100%' }}>
                  {loadingContent ? 'Generating content...' : 'Generate LinkedIn + Instagram Content ->'}
                </button>
              </div>
            )}

            {content && (
              <div style={{ marginTop: step !== 3 ? 0 : '1.5rem', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* LinkedIn */}
                <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-sm)', background: 'rgba(104,184,240,0.04)', border: '1px solid rgba(104,184,240,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--blue)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.05em' }}>LinkedIn Post — Preview</div>
                    <CopyBtn text={content.linkedin_post + '\n\n' + (content.linkedin_hashtags||[]).map(h => '#'+h).join(' ')} />
                  </div>
                  <LinkedInPreview post={content.linkedin_post} hashtags={content.linkedin_hashtags} />
                </div>

                {/* Instagram */}
                <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-sm)', background: 'rgba(176,104,240,0.04)', border: '1px solid rgba(176,104,240,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--purple)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Instagram Caption — Preview</div>
                    <CopyBtn text={content.instagram_caption + '\n\n' + (content.instagram_hashtags||[]).map(h => '#'+h).join(' ')} />
                  </div>
                  <InstagramPreview caption={content.instagram_caption} hashtags={content.instagram_hashtags} engagementHook={content.engagement_hook} />
                </div>

                {/* Predicted performance + best post time */}
                {content.predicted_views_str && (
                  <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '12px' }}>
                      Predicted Performance
                      {content.best_post_time && <span style={{ marginLeft: '10px', color: 'var(--accent)' }}>· Best time: {content.best_post_time}</span>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px' }}>
                      {[
                        { label: 'Views',  value: content.predicted_views_str,  color: 'var(--accent)' },
                        { label: 'Likes',  value: content.predicted_likes_str,  color: 'var(--gold)'   },
                        { label: 'Shares', value: content.predicted_shares_str, color: 'var(--blue)'   },
                        { label: 'Saves',  value: content.predicted_saves_str,  color: 'var(--coral)'  },
                      ].map(item => (
                        <div key={item.label} style={{ textAlign: 'center' }}>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: item.color, lineHeight: 1 }}>{item.value}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginTop: '3px' }}>{item.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reel Assets */}
                <ReelAssets
                  result={{
                    reel_idea:     selectedTrend?.topic || '',
                    script:        [script?.hook, script?.story, script?.cta].filter(Boolean).join('\n\n'),
                    virality_score: content.virality?.score ?? script?.virality?.score ?? 75,
                  }}
                  category={category}
                />

                {/* Final virality */}
                {content.virality && (
                  <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '12px' }}>Content Virality Prediction</div>
                    <ViralityRing score={content.virality.score} label={content.virality.label} />
                    <ViralityBreakdown signals={content.virality.signals} />
                  </div>
                )}

                {/* Restart */}
                <button className="btn btn-ghost btn-sm" onClick={() => { setTrends(null); setSelectedTrend(null); setScript(null); setContent(null); }} style={{ fontSize: '12px', alignSelf: 'flex-start' }}>
                  Start New Content
                </button>
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(240,120,104,0.08)', color: 'var(--coral)', border: '1px solid rgba(240,120,104,0.2)', fontSize: '13px', marginTop: '1rem' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
