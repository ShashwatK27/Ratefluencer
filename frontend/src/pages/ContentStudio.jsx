import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { config } from '../config.js';

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

// -- API Key setup panel -------------------------------------------------------
function ApiKeyPanel({ onKeySet }) {
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    if (!key.trim()) return;
    setSaving(true); setErr('');
    try {
      const res = await fetch(config.api.endpoints.setGroqKey, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      onKeySet();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ background: 'rgba(200,240,104,0.04)', border: '1px solid rgba(200,240,104,0.2)', borderRadius: 'var(--radius)', padding: '1.5rem', marginBottom: '2rem' }}>
      <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px', color: 'var(--accent)' }}>Groq API Key Required</div>
      <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '1rem', lineHeight: 1.6 }}>
        Track 2 uses Groq (LLaMA 3.3 70B) for trend discovery and content generation. Get a free key at <strong style={{ color: 'var(--text)' }}>console.groq.com</strong>.
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="password" value={key} onChange={e => setKey(e.target.value)}
          placeholder="gsk_..." style={{ flex: 1, fontSize: '13px' }}
          onKeyDown={e => e.key === 'Enter' && save()}
        />
        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving} style={{ flexShrink: 0 }}>
          {saving ? 'Connecting...' : 'Connect'}
        </button>
      </div>
      {err && <div style={{ fontSize: '11px', color: 'var(--coral)', marginTop: '6px' }}>{err}</div>}
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

// -- Main page -----------------------------------------------------------------
export default function ContentStudio() {
  const _nav = useNavigate(); // eslint-disable-line no-unused-vars
  const [groqReady,    setGroqReady]    = useState(false);
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
      .then(r => r.json())
      .then(d => setGroqReady(d.available))
      .catch(() => {});
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

  // Step 3: Generate content
  const generateContent = async () => {
    setLoadingContent(true); setError(''); setContent(null);
    try {
      const res = await fetch(config.api.endpoints.generateContent, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic:   selectedTrend?.topic || '',
          hook:    script?.hook || '',
          script:  script?.story || '',
          context,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setContent(d);
    } catch (e) { setError(e.message); }
    finally { setLoadingContent(false); }
  };

  const trendColor = (score) => score >= 80 ? 'var(--accent)' : score >= 65 ? 'var(--gold)' : 'var(--blue)';

  return (
    <div style={{ paddingTop: '56px', minHeight: '100vh' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '3rem 2rem' }}>

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
        {!groqReady && <ApiKeyPanel onKeySet={() => setGroqReady(true)} />}

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
              <button className="btn btn-primary" onClick={discoverTrends} disabled={!groqReady || loadingTrends} style={{ fontSize: '13px', justifyContent: 'center' }}>
                {loadingTrends ? 'Discovering trends...' : 'Discover Trends ->'}
              </button>
              {!groqReady && <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '8px' }}>Connect your Groq API key above first.</div>}
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
              <div style={{ marginTop: step !== 3 ? 0 : '1.5rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* LinkedIn */}
                <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-sm)', background: 'rgba(104,184,240,0.04)', border: '1px solid rgba(104,184,240,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--blue)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.05em' }}>LinkedIn Post</div>
                    <CopyBtn text={content.linkedin_post + '\n\n' + (content.linkedin_hashtags||[]).map(h => '#'+h).join(' ')} />
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-line', marginBottom: '8px' }}>{content.linkedin_post}</div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {(content.linkedin_hashtags||[]).map(h => (
                      <span key={h} style={{ fontSize: '11px', color: 'var(--blue)', fontFamily: 'var(--font-mono)' }}>#{h}</span>
                    ))}
                  </div>
                </div>

                {/* Instagram */}
                <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-sm)', background: 'rgba(176,104,240,0.04)', border: '1px solid rgba(176,104,240,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--purple)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Instagram Caption</div>
                    <CopyBtn text={content.instagram_caption + '\n\n' + (content.instagram_hashtags||[]).map(h => '#'+h).join(' ')} />
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.7, marginBottom: '8px' }}>{content.instagram_caption}</div>
                  {content.engagement_hook && (
                    <div style={{ fontSize: '12px', color: 'var(--purple)', fontStyle: 'italic', marginBottom: '8px' }}>{content.engagement_hook}</div>
                  )}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {(content.instagram_hashtags||[]).map(h => (
                      <span key={h} style={{ fontSize: '11px', color: 'var(--purple)', fontFamily: 'var(--font-mono)' }}>#{h}</span>
                    ))}
                  </div>
                </div>

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
