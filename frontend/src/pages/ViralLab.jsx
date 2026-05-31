import React, { useState } from "react";
import axios from "axios";
import { config } from "../config.js";

const IG_COLOR    = "#F07868";          // Instagram pinkish-orange (coral)
const IG_COLOR_DIM = "rgba(240,120,104,0.12)";
const IG_BORDER    = "rgba(240,120,104,0.3)";
const IG_GLOW      = "rgba(240,120,104,0.25)";

const TONES = ["Inspirational", "Humorous", "Educational", "Trendy", "Authentic", "Professional"];
const CATEGORIES = ["Lifestyle","Fitness","Beauty","Fashion","Technology","Food","Travel","Music","Photography","Comedy","Business","Finance"];

const IG_FIELDS = [
  { key: "reel_idea", icon: "🎬", label: "Reel Idea" },
  { key: "script",    icon: "📝", label: "Script", mono: true },
  { key: "caption",   icon: "📱", label: "Caption" },
  { key: "hashtags",  icon: "🏷️", label: "Hashtags" },
];

const LI_FIELDS = [
  { key: "hook",             icon: "⚡", label: "Opening Hook" },
  { key: "post",             icon: "📝", label: "LinkedIn Post", mono: true },
  { key: "caption",          icon: "💼", label: "Professional Caption" },
  { key: "hashtags",         icon: "🏷️", label: "Hashtags" },
  { key: "engagement_hook",  icon: "💬", label: "Engagement Question" },
];

function FeedbackBar({ contentKey, result }) {
  const storageKey = `feedback_${contentKey}_${JSON.stringify(result).slice(0,30)}`;
  const [vote, setVote] = useState(() => localStorage.getItem(storageKey) || null);

  const handleVote = (v) => {
    setVote(v);
    localStorage.setItem(storageKey, v);
    // Store feedback for "learning from engagement" demo
    const history = JSON.parse(localStorage.getItem('ratefluencer_feedback') || '[]');
    history.push({ key: contentKey, vote: v, ts: Date.now(), virality: result?.virality_score });
    localStorage.setItem('ratefluencer_feedback', JSON.stringify(history.slice(-50)));
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
      <span style={{ fontSize: "12px", color: "var(--text3)", fontFamily: "var(--font-mono)" }}>Was this content useful?</span>
      {[
        { v: "up",   icon: "👍", label: "Yes" },
        { v: "down", icon: "👎", label: "No"  },
      ].map(({ v, icon, label }) => (
        <button
          key={v}
          onClick={() => handleVote(v)}
          style={{
            padding: "4px 12px", borderRadius: "20px", fontSize: "12px", cursor: "pointer",
            border: vote === v ? `1px solid ${v === 'up' ? 'var(--accent)' : 'var(--coral)'}` : "1px solid var(--border)",
            background: vote === v ? (v === 'up' ? 'rgba(200,240,104,0.1)' : 'rgba(240,120,104,0.1)') : "transparent",
            color: vote === v ? (v === 'up' ? 'var(--accent)' : 'var(--coral)') : "var(--text3)",
            transition: "all .2s",
          }}
        >
          {icon} {label}
        </button>
      ))}
      {vote && <span style={{ fontSize: "11px", color: "var(--text3)", fontFamily: "var(--font-mono)" }}>✓ Feedback saved — improving future results</span>}
    </div>
  );
}

function ContentCard({ field, result, platform }) {
  const val = result[field.key];
  if (val == null) return null;
  return (
    <div className="fade-up" style={{ background: platform === "linkedin" ? "rgba(104,184,240,0.03)" : `${IG_COLOR}08`, border: platform === "linkedin" ? "1px solid rgba(104,184,240,0.15)" : `1px solid ${IG_BORDER}`, borderRadius: "var(--radius)", padding: "1.25rem 1.5rem", display: "flex", alignItems: "flex-start", gap: "14px" }}>
      <span style={{ fontSize: "18px", flexShrink: 0, width: "40px", height: "40px", borderRadius: "10px", background: platform === "linkedin" ? "var(--blue-dim)" : IG_COLOR_DIM, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {field.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "11px", letterSpacing: ".05em", textTransform: "uppercase", color: "var(--text3)", fontFamily: "var(--font-mono)", marginBottom: "6px" }}>{field.label}</div>
        {field.mono ? (
          <pre style={{ fontSize: "13px", color: "var(--text2)", lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: "var(--font-mono)", margin: 0 }}>{val}</pre>
        ) : (
          <div style={{ fontSize: "14px", color: "var(--text)", lineHeight: 1.6 }}>{val}</div>
        )}
      </div>
    </div>
  );
}

export default function ViralLab({ onNavigate }) {
  const [platform, setPlatform] = useState("instagram");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("Inspirational");
  const [category, setCategory] = useState("Lifestyle");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const linkedinFeedbackCount = (() => {
    try { return JSON.parse(localStorage.getItem('ratefluencer_feedback') || '[]').filter(f => f.key?.includes('linkedin')).length; }
    catch { return 0; }
  })();

  const generate = async () => {
    if (!topic.trim()) return;
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const endpoint = platform === "linkedin"
        ? config.api.endpoints.generateLinkedin
        : config.api.endpoints.generateContent;

      // Send feedback history for LinkedIn improvement (requirement #7)
      const feedbackHistory = platform === "linkedin"
        ? JSON.parse(localStorage.getItem('ratefluencer_feedback') || '[]').filter(f => f.key?.includes('linkedin'))
        : [];

      const response = await axios.post(endpoint, {
        topic, tone, content_category: category,
        feedback_history: feedbackHistory,
      });
      setResult(response.data);
    } catch (err) {
      console.error(err);
      setError("Content generation failed. Please check the backend is running and try again.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ paddingTop: "56px", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "3rem 4rem", textAlign: "center", maxWidth: "400px", width: "100%" }}>
          <div style={{ fontSize: "40px", marginBottom: "1.5rem" }}>{platform === "linkedin" ? "💼" : "🧪"}</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "24px", color: "var(--text)", marginBottom: "8px" }}>
            Generating {platform === "linkedin" ? "LinkedIn" : "Viral"} Content
          </div>
          <div style={{ fontSize: "14px", color: "var(--text2)" }}>
            Crafting your {tone.toLowerCase()} {platform === "linkedin" ? "professional" : "viral"} content...
          </div>
          <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "center", gap: "6px" }}>
            {[0,1,2].map(i => (
              <span key={i} style={{ width: "8px", height: "8px", borderRadius: "50%", background: platform === "linkedin" ? "var(--blue)" : "var(--accent)", display: "inline-block", animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const fields = platform === "linkedin" ? LI_FIELDS : IG_FIELDS;

  return (
    <div style={{ paddingTop: "56px" }}>
      <div style={{ maxWidth: "780px", margin: "0 auto", padding: "3rem 2rem" }}>

        <div style={{ marginBottom: "3rem" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('landing')} style={{ marginBottom: "1.5rem", fontSize: "13px" }}>
            ← Home
          </button>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "36px", marginBottom: "8px" }}>Viral Content Lab</h2>
          <p style={{ fontSize: "15px", color: "var(--text2)" }}>
            Generate platform-optimised content for Instagram Reels or LinkedIn — backed by real data.
          </p>
        </div>

        {/* Learning indicator for LinkedIn */}
        {platform === "linkedin" && linkedinFeedbackCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 14px", background: "rgba(104,184,240,0.06)", border: "1px solid rgba(104,184,240,0.2)", borderRadius: "var(--radius-sm)", marginBottom: "12px", fontSize: "12px", color: "var(--blue)" }}>
            <span>🧠</span>
            <span>AI is learning from your {linkedinFeedbackCount} previous LinkedIn feedback{linkedinFeedbackCount > 1 ? 's' : ''} — content improves with each generation</span>
          </div>
        )}

        {/* Platform tabs */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "1.5rem" }}>
          {[
            { id: "instagram", icon: "📸", label: "Instagram Reel" },
            { id: "linkedin",  icon: "💼", label: "LinkedIn Post"  },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => { setPlatform(p.id); setResult(null); setError(null); setTopic(""); }}
              className={`btn btn-sm ${platform === p.id ? "btn-primary" : "btn-ghost"}`}
              style={{ fontSize: "13px",
                background: platform === p.id ? (p.id === "linkedin" ? "var(--blue)" : IG_COLOR) : undefined,
                color: platform === p.id ? "#0B0D0F" : undefined,
              }}
            >
              {p.icon} {p.label}
            </button>
          ))}
        </div>

        {/* Input card */}
        <div style={{ background: "var(--bg2)", border: `1px solid ${platform === "linkedin" ? "rgba(104,184,240,0.3)" : IG_BORDER}`, borderRadius: "var(--radius)", padding: "2rem", marginBottom: "1.5rem", boxShadow: platform === "linkedin" ? "0 0 0 1px rgba(104,184,240,0.08)" : `0 0 0 1px ${IG_COLOR_DIM}` }}>
          <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text2)", letterSpacing: ".05em", textTransform: "uppercase", fontFamily: "var(--font-mono)", marginBottom: "1.5rem" }}>
            {platform === "linkedin" ? "💼 LinkedIn Topic" : "🧪 Content Topic"}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label>{platform === "linkedin" ? "What professional insight do you want to share?" : "What do you want to go viral about?"}</label>
              <input
                type="text"
                placeholder={platform === "linkedin"
                  ? "e.g. How AI is changing influencer marketing in 2025"
                  : "e.g. Sustainable skincare routine for busy millennials"}
                value={topic}
                onChange={e => setTopic(e.target.value)}
                onKeyDown={e => e.key === "Enter" && generate()}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "13px", color: "var(--text2)" }}>Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "13px", color: "var(--text2)" }}>Tone</label>
                <select value={tone} onChange={e => setTone(e.target.value)}>
                  {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ background: "rgba(240,100,100,0.08)", border: "1px solid rgba(240,100,100,0.2)", borderRadius: "var(--radius)", padding: "1rem 1.25rem", color: "#F06464", fontSize: "13px", marginBottom: "1rem" }}>
            {error}
          </div>
        )}

        <button
          onClick={generate}
          disabled={!topic.trim()}
          className="btn btn-primary"
          style={{ width: "100%", padding: "16px", borderRadius: "100px", fontSize: "16px", fontWeight: 600, marginTop: ".5rem", justifyContent: "center", opacity: topic.trim() ? 1 : 0.5, cursor: topic.trim() ? "pointer" : "not-allowed", background: platform === "linkedin" ? "var(--blue)" : IG_COLOR }}
          onMouseEnter={e => { if (topic.trim()) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 12px 40px ${platform === "linkedin" ? "rgba(104,184,240,0.3)" : IG_GLOW}`; }}}
          onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
        >
          {platform === "linkedin" ? "💼 Generate LinkedIn Post" : "🚀 Generate Viral Content"}
        </button>

        {result && (
          <div style={{ marginTop: "2.5rem" }}>
            {/* Score strip */}
            <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "12px" }}>
              {[
                { label: platform === "linkedin" ? "Professional Score" : "Virality Score", value: result.virality_score, color: platform === "linkedin" ? "var(--blue)" : "var(--accent)", icon: platform === "linkedin" ? "💼" : "🚀" },
                { label: "Trend Score",    value: result.trend_score,    color: "var(--gold)", icon: "🔥" },
                { label: "Best Post Time", value: result.best_post_time || (platform === "linkedin" ? "Tue–Thu 9:00 AM" : "18:00 Wed"), color: "var(--coral)", icon: "⏰" },
              ].map(item => item.value != null && (
                <div key={item.label} style={{ background: platform === "linkedin" ? "rgba(104,184,240,0.04)" : IG_COLOR_DIM.replace("0.12","0.05"), border: platform === "linkedin" ? "1px solid rgba(104,184,240,0.2)" : `1px solid ${IG_BORDER}`, borderRadius: "var(--radius)", padding: "1rem 1.25rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "14px" }}>{item.icon}</span>
                    <span style={{ fontSize: "11px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>{item.label}</span>
                  </div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "22px", color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* Optimization tips */}
            {result.optimization_tips?.length > 0 && (
              <div className="fade-up" style={{
                background: platform === "linkedin" ? "rgba(104,184,240,0.04)" : `${IG_COLOR}0D`,
                border: platform === "linkedin" ? "1px solid rgba(104,184,240,0.2)" : `1px solid ${IG_BORDER}`,
                borderRadius: "var(--radius)", padding: "1rem 1.25rem", marginBottom: "12px"
              }}>
                <div style={{ fontSize: "11px", color: platform === "linkedin" ? "var(--blue)" : IG_COLOR, fontFamily: "var(--font-mono)", letterSpacing: ".05em", textTransform: "uppercase", marginBottom: "8px" }}>📊 Data-Driven Optimisation</div>
                {result.optimization_tips.map((tip, i) => (
                  <div key={i} style={{ fontSize: "12px", color: tip.startsWith("✓") ? (platform === "linkedin" ? "var(--blue)" : IG_COLOR) : "var(--text2)", marginBottom: "3px" }}>{tip}</div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div className="section-label">Generated Content</div>
              <button onClick={generate} className="btn btn-ghost btn-sm" style={{ fontSize: "12px" }}>↻ Regenerate</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {fields.map((field, i) => (
                <ContentCard key={field.key} field={field} result={result} platform={platform} />
              ))}
            </div>

            <FeedbackBar contentKey={`${platform}_${topic}`} result={result} />
          </div>
        )}

      </div>
    </div>
  );
}
