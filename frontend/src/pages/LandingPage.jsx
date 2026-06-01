import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ── Animated counter ────────────────────────────────────────────────────────
function CountUp({ target, suffix = '', duration = 1800 }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const tick = (now) => {
          const pct = Math.min((now - start) / duration, 1);
          const ease = 1 - Math.pow(1 - pct, 3);
          setVal(Math.round(ease * target));
          if (pct < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return <span ref={ref}>{typeof target === 'number' && target >= 1000 ? val.toLocaleString('en-IN') : val}{suffix}</span>;
}

// ── Mini score ring for hero preview ───────────────────────────────────────
function MiniRing({ score, color, size = 56, animate = true }) {
  const r = (size / 2) - 5;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circ} strokeDashoffset={animate ? circ : offset}
          strokeLinecap="round"
          style={animate ? { animation: `ringReveal 1.2s ease forwards`, '--target': offset } : {}}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: size * 0.28, color }}>
        {score}
      </div>
    </div>
  );
}

// ── Live product preview card ───────────────────────────────────────────────
function HeroPreview() {
  const creators = [
    { name: 'Shashwat',       meta: 'Fitness · 1.2M · Instagram', score: 94, growth: 88, auth: 96, brand: 91, color: '#C8F068', badge: '👑 #1 Match' },
    { name: 'Vaidehi Turkar', meta: 'Beauty · 480K · Instagram', score: 81, growth: 85, auth: 90, brand: 78, color: '#68B8F0', badge: null },
    { name: 'Ram Travels',  meta: 'Travel · 720K · Instagram',  score: 73, growth: 70, auth: 83, brand: 86, color: '#F0C96A', badge: null },
  ];

  return (
    <div style={{
      background: 'rgba(17,20,23,0.85)', backdropFilter: 'blur(24px)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '20px', padding: '1.25rem',
      width: '100%', maxWidth: '520px',
      boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(200,240,104,0.08)',
    }}>
      {/* Window chrome */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '1rem' }}>
        {['#FF5F57','#FEBC2E','#28C840'].map(c => (
          <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
        ))}
        <div style={{ flex: 1, height: '20px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', marginLeft: '8px' }} />
      </div>

      {/* Label */}
      <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--accent)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '10px', opacity: .7 }}>
        AI Recommendations · Skincare Campaign · ₹5L budget
      </div>

      {/* Creator rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {creators.map((c, i) => (
          <div key={c.name} className="fade-up" style={{
            animationDelay: `${0.3 + i * 0.15}s`,
            background: i === 0 ? 'linear-gradient(135deg,rgba(200,240,104,0.06),rgba(17,20,23,0.8))' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${i === 0 ? 'rgba(200,240,104,0.2)' : 'rgba(255,255,255,0.06)'}`,
            borderRadius: '12px', padding: '10px 12px',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            {/* Avatar */}
            <div style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              background: `linear-gradient(135deg,${c.color}40,${c.color}20)`,
              border: `1px solid ${c.color}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: 600, color: c.color,
              fontFamily: 'var(--font-display)',
            }}>
              {c.name.split(' ').map(w => w[0]).join('')}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500 }}>{c.name}</span>
                {c.badge && <span style={{ fontSize: '9px', background: 'var(--gold-dim)', color: 'var(--gold)', padding: '1px 6px', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>{c.badge}</span>}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text3)' }}>{c.meta}</div>
            </div>

            {/* Mini scores */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {[
                { val: c.auth + '%', label: 'Auth', color: 'var(--blue)' },
                { val: c.growth + '%', label: 'Growth', color: 'var(--gold)' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', color: s.color, lineHeight: 1 }}>{s.val}</div>
                  <div style={{ fontSize: '8px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{s.label}</div>
                </div>
              ))}
              <MiniRing score={c.score} color={c.color} size={44} animate={i === 0} />
            </div>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div style={{ marginTop: '10px', padding: '8px 10px', background: 'rgba(200,240,104,0.05)', borderRadius: '8px', border: '1px solid rgba(200,240,104,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>Analysed 50,000 creators in 2.3s</span>
        <span style={{ fontSize: '10px', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>✓ 0 fakes detected</span>
      </div>
    </div>
  );
}

// ── Feature card ────────────────────────────────────────────────────────────
function FeatureCard({ icon, iconBg, title, desc, scoreLabel, scoreClass, color }) {
  return (
    <div className="shine-card grad-border" style={{
      background: 'var(--bg2)', padding: '2rem',
      borderRadius: 'var(--radius)', cursor: 'default',
      border: '1px solid var(--border)',
    }}>
      <div style={{
        width: '44px', height: '44px', borderRadius: '12px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '20px', marginBottom: '1.25rem', background: iconBg,
      }}>
        {icon}
      </div>
      <div style={{ fontSize: '16px', fontWeight: 500, marginBottom: '10px' }}>{title}</div>
      <div style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.7 }}>{desc}</div>
      <span className={`tag ${scoreClass}`} style={{
        fontFamily: 'var(--font-mono)', fontSize: '11px',
        marginTop: '16px', display: 'inline-block',
      }}>
        {scoreLabel}
      </span>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: '🛡️', iconBg: 'var(--accent-dim)', title: 'Authenticity Detection', desc: 'XGBoost model (93% accuracy, AUC 98.25%) detects fake followers, bots, and engagement pods before you spend a rupee.', scoreLabel: 'Authenticity Score 0–100', scoreClass: 'tag-green' },
  { icon: '📈', iconBg: 'var(--blue-dim)',   title: 'Growth Prediction',      desc: 'RandomForest regression (R² = 0.896) forecasts follower growth and engagement trajectory over 30/90/180 days.', scoreLabel: 'Growth Score 0–100', scoreClass: 'tag-blue' },
  { icon: '🏷️', iconBg: 'var(--gold-dim)',  title: 'Brand Matching via RAG',  desc: 'SentenceTransformer embeddings + ChromaDB semantic search matches creators to brands across 50,000 profiles in under 3 seconds.', scoreLabel: 'Brand Match 0–100', scoreClass: 'tag-gold' },
];

const FEATURES2 = [
  { icon: '🤖', iconBg: 'var(--coral-dim)',  title: 'Ratefluencer™ Score',          desc: 'Goal-aware weighted composite of all three models. Shifts automatically between brand awareness, conversions, and niche targeting objectives.', scoreLabel: 'Ratefluencer™ Score 0–100', scoreClass: 'tag-coral' },
  { icon: '📊', iconBg: 'var(--purple-dim)', title: 'Real Data Viral Optimizer',     desc: 'Content recommendations backed by 30,000 real Instagram posts — optimal hashtag count, posting hours, and CTA patterns per category.', scoreLabel: 'Virality Score 0–100', scoreClass: 'tag-purple' },
];

const STEPS = [
  { num: '01', title: 'Define your campaign',         desc: 'Set your brand, budget, target audience, and content category. The AI picks up context automatically.' },
  { num: '02', title: 'ML engine scores 50K creators', desc: 'Authenticity, Growth, and Brand Match models evaluate every creator in the database simultaneously.' },
  { num: '03', title: 'Ratefluencer™ score computed',  desc: 'Goal-aware weights combine all three models into a single ROI-ranked recommendation list.' },
  { num: '04', title: 'You get actionable results',    desc: 'Ranked creators, fraud flags, ROI estimate, virality-optimised content brief — ready in seconds.' },
];

const STATS = [
  { target: 94,    suffix: '%', label: 'Authenticity Accuracy',  color: 'var(--accent)' },
  { target: 33935, suffix: '',  label: 'Real Creators Analyzed',  color: 'var(--blue)'   },
  { target: 30000, suffix: '+', label: 'Real Posts Benchmarked',  color: 'var(--gold)'   },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const onNavigate = (page) => {
    const map = {
      landing: '/', dashboard: '/dashboard', campaign: '/campaign',
      recommendations: '/recommendations', viralLab: '/viral-lab',
      aiAgent: '/ai-agent', shortlist: '/shortlist',
      creatorCorner: '/creator-corner',
    };
    navigate(map[page] || '/');
  };
  return (
    <div style={{ paddingTop: '56px' }}>

      <style>{`
        @keyframes ringReveal {
          from { stroke-dashoffset: var(--circ, 176); }
          to   { stroke-dashoffset: var(--target, 12); }
        }
        @keyframes orb1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(40px,-30px)} }
        @keyframes orb2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-30px,20px)} }
      `}</style>

      {/* ── Hero ── */}
      <section style={{
        minHeight: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '4rem 2rem', position: 'relative', overflow: 'hidden',
      }}>
        {/* Grid background */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)',
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse 90% 70% at 50% 40%,black,transparent)',
          WebkitMaskImage: 'radial-gradient(ellipse 90% 70% at 50% 40%,black,transparent)',
        }} />

        {/* Floating orbs */}
        <div style={{ position: 'absolute', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(200,240,104,0.07) 0%,transparent 65%)', top: '20%', left: '15%', animation: 'orb1 8s ease-in-out infinite', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(104,184,240,0.07) 0%,transparent 65%)', bottom: '20%', right: '15%', animation: 'orb2 10s ease-in-out infinite', pointerEvents: 'none' }} />

        {/* Two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center', maxWidth: '1100px', width: '100%', position: 'relative' }}>

          {/* Left — text */}
          <div>
            <div className="fade-up" style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '6px 14px', borderRadius: '20px',
              border: '1px solid rgba(200,240,104,0.3)', background: 'rgba(200,240,104,0.07)',
              fontSize: '12px', color: 'var(--accent)', marginBottom: '2rem',
              fontFamily: 'var(--font-mono)', letterSpacing: '.04em',
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 2s infinite', display: 'inline-block' }} />
              Powered by ML + RAG + Real Data
            </div>

            <h1 className="fade-up delay-1" style={{
              fontFamily: 'var(--font-display)', fontSize: 'clamp(38px,4.5vw,64px)', lineHeight: 1.05,
              marginBottom: '1.5rem',
            }}>
              Find influencers<br />that{' '}
              <em style={{ color: 'var(--accent)', fontStyle: 'italic' }}>actually convert.</em>
            </h1>

            <p className="fade-up delay-2" style={{
              fontSize: '17px', color: 'var(--text2)', lineHeight: 1.75,
              marginBottom: '2.5rem', fontWeight: 300, maxWidth: '460px',
            }}>
              Stop guessing with follower counts. Our AI scores 50,000 creators on authenticity, growth, and brand fit — and tells you the ROI before you spend a rupee.
            </p>

            <div className="fade-up delay-3" style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '3rem' }}>
              <button
                className="btn btn-primary"
                onClick={() => onNavigate('campaign')}
                style={{ fontSize: '15px', padding: '13px 28px' }}
              >
                Start a Campaign →
              </button>
              <button className="btn btn-ghost" onClick={() => onNavigate('dashboard')}>
                View Dashboard
              </button>
            </div>

            {/* Trust badges */}
            <div className="fade-up delay-4" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {[
                { icon: '🛡️', text: '93% accuracy on fake detection' },
                { icon: '📊', text: '30K real posts analysed' },
                { icon: '⚡', text: 'Results in under 3 seconds' },
              ].map(b => (
                <div key={b.text} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text3)' }}>
                  <span>{b.icon}</span> {b.text}
                </div>
              ))}
            </div>
          </div>

          {/* Right — live product preview */}
          <div className="fade-up delay-2" style={{ display: 'flex', justifyContent: 'center' }}>
            <HeroPreview />
          </div>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1px', background: 'var(--border)' }}>
          {STATS.map(s => (
            <div key={s.label} style={{ background: 'var(--bg2)', padding: '2.5rem 2rem', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '48px', color: s.color, lineHeight: 1, marginBottom: '8px' }}>
                <CountUp target={s.target} suffix={s.suffix} />
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text3)', letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: '7rem 2rem', maxWidth: '1100px', margin: '0 auto' }}>
        <div className="section-label">What we analyze</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,52px)', marginBottom: '1rem', lineHeight: 1.05 }}>
          Every signal that matters.
        </h2>
        <p style={{ fontSize: '16px', color: 'var(--text2)', marginBottom: '3.5rem', fontWeight: 300, maxWidth: '480px' }}>
          We go beyond the follower count with three purpose-built ML models.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '12px' }}>
          {FEATURES.map(f => <FeatureCard key={f.title} {...f} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '12px' }}>
          {FEATURES2.map(f => <FeatureCard key={f.title} {...f} />)}
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ padding: '7rem 2rem', background: 'var(--bg2)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="section-label">How it works</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,52px)', marginBottom: '4rem', lineHeight: 1.05 }}>
            Four steps to the<br />perfect creator.
          </h2>
          <div>
            {STEPS.map((step, i) => (
              <div key={step.num} style={{
                display: 'grid', gridTemplateColumns: '72px 1fr', gap: '2rem',
                padding: '2.5rem 0', borderBottom: i < STEPS.length - 1 ? '1px solid var(--border)' : 'none',
                alignItems: 'flex-start',
              }}>
                <div style={{
                  fontFamily: 'var(--font-display)', fontSize: '52px', color: 'transparent',
                  lineHeight: 1, WebkitTextStroke: '1px rgba(255,255,255,0.15)',
                }}>{step.num}</div>
                <div style={{ paddingTop: '8px' }}>
                  <div style={{ fontSize: '18px', fontWeight: 500, marginBottom: '8px' }}>{step.title}</div>
                  <div style={{ fontSize: '14px', color: 'var(--text2)', lineHeight: 1.7 }}>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Grand Challenge Progress ── */}
      <section style={{ padding: '6rem 2rem', maxWidth: '1100px', margin: '0 auto' }}>
        <div className="section-label">Grand Challenge Status</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,48px)', marginBottom: '1rem', lineHeight: 1.05 }}>
          Every requirement. Built.
        </h2>
        <p style={{ fontSize: '16px', color: 'var(--text2)', marginBottom: '3rem', fontWeight: 300 }}>
          Track exactly which Grand Challenge features are implemented.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
          {[
            {
              title: 'Influencer Intelligence',
              icon: '🛡️',
              color: 'var(--accent)',
              items: [
                { label: 'Identify high-potential influencers', done: true },
                { label: 'Detect fake engagement & bots', done: true },
                { label: 'Predict future creator growth', done: true },
                { label: 'Estimate campaign success probability', done: true },
                { label: 'Recommend brand partnerships', done: true },
              ]
            },
            {
              title: 'Viral Content Intelligence',
              icon: '🎬',
              color: 'var(--blue)',
              items: [
                { label: 'Discover trending topics', done: true },
                { label: 'Rank trends using ML (5 dimensions)', done: true },
                { label: 'Generate viral reel concepts', done: true },
                { label: 'Create complete video scripts', done: true },
                { label: 'Instagram-ready content', done: true },
                { label: 'LinkedIn-ready content', done: true },
              ]
            },
            {
              title: 'Autonomous AI Agent',
              icon: '🤖',
              color: 'var(--gold)',
              items: [
                { label: 'Discover & rank trends automatically', done: true },
                { label: 'Create short-form video scripts', done: true },
                { label: 'Generate LinkedIn posts', done: true },
                { label: 'Generate Instagram captions', done: true },
                { label: 'Predict virality before publishing', done: true },
                { label: 'Learn from engagement feedback (👍/👎)', done: true },
                { label: 'Continuously improve LinkedIn recommendations', done: true },
              ]
            },
          ].map(section => (
            <div key={section.title} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                <span style={{ fontSize: '20px' }}>{section.icon}</span>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>{section.title}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {section.items.map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: item.done ? 'var(--accent)' : 'var(--coral)', flexShrink: 0, marginTop: '1px' }}>
                      {item.done ? '✓' : '○'}
                    </span>
                    <span style={{ fontSize: '12px', color: item.done ? 'var(--text2)' : 'var(--text3)', lineHeight: 1.5 }}>{item.label}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '12px', height: '3px', borderRadius: '2px', background: 'var(--border)' }}>
                <div style={{ height: '100%', borderRadius: '2px', background: section.color, width: `${Math.round(section.items.filter(i => i.done).length / section.items.length * 100)}%`, transition: 'width .5s' }} />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
                {section.items.filter(i => i.done).length}/{section.items.length} complete
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: '8rem 2rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 50%,rgba(200,240,104,0.05),transparent)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: '600px', margin: '0 auto', position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '5px 14px', borderRadius: '20px', border: '1px solid rgba(200,240,104,0.25)', background: 'rgba(200,240,104,0.06)', fontSize: '11px', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: '1.5rem' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            LIVE · Ready to use
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px,5vw,56px)', marginBottom: '1.25rem', lineHeight: 1.1 }}>
            Stop guessing.<br />Start converting.
          </h2>
          <p style={{ fontSize: '17px', color: 'var(--text2)', marginBottom: '2.5rem', fontWeight: 300, lineHeight: 1.7 }}>
            Run your first campaign analysis free.<br />Results in under 3 seconds.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={() => onNavigate('campaign')}
              style={{ fontSize: '16px', padding: '15px 36px' }}
            >
              Analyze a Campaign →
            </button>
            <button className="btn btn-ghost" onClick={() => onNavigate('viralLab')}>
              Try Viral Lab
            </button>
          </div>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '2rem', textAlign: 'center', color: 'var(--text3)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
        © 2025 Ratefluencer™ · AI Influencer Intelligence · XGBoost + RandomForest + RAG
      </footer>
    </div>
  );
}
