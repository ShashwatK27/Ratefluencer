import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { config } from "../config.js";
import ReelAssets from "../components/ReelAssets.jsx";

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

function FeedbackBar({ contentKey, result, category }) {
  const storageKey = `feedback_${contentKey}_${JSON.stringify(result).slice(0,30)}`;
  const [vote, setVote] = useState(() => localStorage.getItem(storageKey) || null);

  const handleVote = async (v) => {
    setVote(v);
    // 1. Persist locally
    localStorage.setItem(storageKey, v);
    const history = JSON.parse(localStorage.getItem('ratefluencer_feedback') || '[]');
    const entry = {
      key: contentKey, vote: v, ts: Date.now(), virality: result?.virality_score,
      content: { hook: result?.hook, caption: result?.caption, hashtags: result?.hashtags },
    };
    history.push(entry);
    localStorage.setItem('ratefluencer_feedback', JSON.stringify(history.slice(-50)));
    // 2. Persist server-side for continuous learning
    try {
      await fetch(config.api.endpoints.feedback, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key:      contentKey,
          vote:     v,
          virality: result?.virality_score,
          category: category || '',
          content:  { hook: result?.hook, caption: result?.caption, hashtags: result?.hashtags },
        }),
      });
    } catch (_) { /* non-blocking */ }
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
      {vote && <span style={{ fontSize: "11px", color: "var(--text3)", fontFamily: "var(--font-mono)" }}>✓ Feedback saved  -  improving future results</span>}
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

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const HOURS = Array.from({length:24},(_,i) => ({ label: `${i}:00`, value: i }));
const MEDIA_TYPES = ["reel","image","carousel","video"];

export default function ViralLab() {
  const navigate = useNavigate();
  const [platform, setPlatform] = useState("instagram");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("Inspirational");
  const [category, setCategory] = useState("Lifestyle");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Score My Caption state
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [mediaType, setMediaType] = useState("reel");
  const [postHour, setPostHour] = useState(18);
  const [dayOfWeek, setDayOfWeek] = useState("Wednesday");
  const [scoreCategory, setScoreCategory] = useState("Lifestyle");
  const [scoreResult, setScoreResult] = useState(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [scoreError, setScoreError] = useState(null);

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

  const scoreCaption = async () => {
    if (!caption.trim()) return;
    try {
      setScoreLoading(true);
      setScoreError(null);
      setScoreResult(null);
      const response = await axios.post(config.api.endpoints.scoreCaption, {
        caption, hashtags,
        media_type: mediaType,
        content_category: scoreCategory,
        post_hour: postHour,
        day_of_week: dayOfWeek,
      });
      setScoreResult(response.data);
    } catch (err) {
      console.error(err);
      setScoreError("Scoring failed. Please check the backend is running.");
    } finally {
      setScoreLoading(false);
    }
  };

  if (loading || scoreLoading) {
    return (
      <div style={{ paddingTop: "56px", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "3rem 4rem", textAlign: "center", maxWidth: "400px", width: "100%" }}>
          <div style={{ fontSize: "40px", marginBottom: "1.5rem" }}>{scoreLoading ? "🔬" : platform === "linkedin" ? "💼" : "🧪"}</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "24px", color: "var(--text)", marginBottom: "8px" }}>
            {scoreLoading ? "Scoring Your Caption" : `Generating ${platform === "linkedin" ? "LinkedIn" : "Viral"} Content`}
          </div>
          <div style={{ fontSize: "14px", color: "var(--text2)" }}>
            {scoreLoading ? "Analysing against 30K real Instagram posts..." : `Crafting your ${tone.toLowerCase()} content...`}
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
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')} style={{ marginBottom: "1.5rem", fontSize: "13px" }}>
            ← Home
          </button>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "36px", marginBottom: "8px" }}>Viral Content Lab</h2>
          <p style={{ fontSize: "15px", color: "var(--text2)" }}>
            Generate platform-optimised content for Instagram Reels or LinkedIn  -  backed by real data.
          </p>
        </div>

        {/* Learning indicator for LinkedIn */}
        {platform === "linkedin" && linkedinFeedbackCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 14px", background: "rgba(104,184,240,0.06)", border: "1px solid rgba(104,184,240,0.2)", borderRadius: "var(--radius-sm)", marginBottom: "12px", fontSize: "12px", color: "var(--blue)" }}>
            <span>🧠</span>
            <span>AI is learning from your {linkedinFeedbackCount} previous LinkedIn feedback{linkedinFeedbackCount > 1 ? 's' : ''}  -  content improves with each generation</span>
          </div>
        )}

        {/* Platform tabs */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "1.5rem" }}>
          {[
            { id: "instagram", icon: "📸", label: "Instagram Reel" },
            { id: "linkedin",  icon: "💼", label: "LinkedIn Post"  },
            { id: "score",     icon: "🔬", label: "Score My Caption" },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => { setPlatform(p.id); setResult(null); setScoreResult(null); setError(null); setScoreError(null); setTopic(""); }}
              className={`btn btn-sm ${platform === p.id ? "btn-primary" : "btn-ghost"}`}
              style={{ fontSize: "13px",
                background: platform === p.id ? (p.id === "linkedin" ? "var(--blue)" : p.id === "score" ? "var(--purple)" : IG_COLOR) : undefined,
                color: platform === p.id ? "#0B0D0F" : undefined,
              }}
            >
              {p.icon} {p.label}
            </button>
          ))}
        </div>

        {/* -- Score My Caption tab -- */}
        {platform === "score" && (
          <div>
            {/* Input */}
            <div style={{ background: "var(--bg2)", border: "1px solid rgba(176,104,240,0.3)", borderRadius: "var(--radius)", padding: "2rem", marginBottom: "1.5rem", boxShadow: "0 0 0 1px rgba(176,104,240,0.06)" }}>
              <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text2)", letterSpacing: ".05em", textTransform: "uppercase", fontFamily: "var(--font-mono)", marginBottom: "1.5rem" }}>
                🔬 Paste Your Caption
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label>Your Caption</label>
                  <textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="Paste your Instagram caption here..." style={{ minHeight: "100px" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label>Your Hashtags <span style={{ color: "var(--text3)", fontWeight: 400 }}>(optional)</span></label>
                  <input type="text" value={hashtags} onChange={e => setHashtags(e.target.value)} placeholder="#skincare #wellness #glow (space separated)" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "10px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "12px", color: "var(--text2)" }}>Category</label>
                    <select value={scoreCategory} onChange={e => setScoreCategory(e.target.value)}>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "12px", color: "var(--text2)" }}>Format</label>
                    <select value={mediaType} onChange={e => setMediaType(e.target.value)}>
                      {MEDIA_TYPES.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "12px", color: "var(--text2)" }}>Post Hour</label>
                    <select value={postHour} onChange={e => setPostHour(Number(e.target.value))}>
                      {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "12px", color: "var(--text2)" }}>Day</label>
                    <select value={dayOfWeek} onChange={e => setDayOfWeek(e.target.value)}>
                      {DAYS.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {scoreError && (
              <div style={{ background: "rgba(240,100,100,0.08)", border: "1px solid rgba(240,100,100,0.2)", borderRadius: "var(--radius)", padding: "1rem 1.25rem", color: "#F06464", fontSize: "13px", marginBottom: "1rem" }}>
                {scoreError}
              </div>
            )}

            <button
              onClick={scoreCaption}
              disabled={!caption.trim()}
              className="btn btn-primary"
              style={{ width: "100%", padding: "16px", borderRadius: "100px", fontSize: "16px", fontWeight: 600, marginBottom: "2rem", justifyContent: "center", background: "var(--purple)", opacity: caption.trim() ? 1 : 0.5, cursor: caption.trim() ? "pointer" : "not-allowed" }}
              onMouseEnter={e => { if (caption.trim()) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(176,104,240,0.3)"; }}}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
            >
              🔬 Score My Caption
            </button>

            {/* Results */}
            {scoreResult && (
              <div className="fade-up">
                {/* Score strip */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "10px", marginBottom: "16px" }}>
                  {[
                    { label: "Virality Score", value: scoreResult.virality_score, suffix: "", color: scoreResult.virality_score >= 70 ? "var(--accent)" : scoreResult.virality_score >= 50 ? "var(--gold)" : "var(--coral)", icon: "🚀" },
                    { label: "Readability", value: scoreResult.readability_score, suffix: "", color: "var(--blue)", icon: "📖" },
                    { label: "Hashtags", value: `${scoreResult.your_hashtag_count} / ${scoreResult.optimal_hashtag_range}`, suffix: "", color: "var(--gold)", icon: "🏷️" },
                    { label: "Has CTA", value: scoreResult.has_cta ? "Yes ✓" : "No ✗", suffix: "", color: scoreResult.has_cta ? "var(--accent)" : "var(--coral)", icon: "📣" },
                  ].map(item => (
                    <div key={item.label} style={{ background: "rgba(176,104,240,0.05)", border: "1px solid rgba(176,104,240,0.2)", borderRadius: "var(--radius)", padding: "1rem 1.25rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "4px" }}>
                        <span>{item.icon}</span>
                        <span style={{ fontSize: "10px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>{item.label}</span>
                      </div>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: "20px", color: item.color }}>{item.value}{item.suffix}</div>
                    </div>
                  ))}
                </div>

                {/* Predicted numbers */}
                {scoreResult.predicted_views && (
                  <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.25rem", marginBottom: "16px" }}>
                    <div style={{ fontSize: "11px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", marginBottom: "12px" }}>📊 Predicted Performance</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px" }}>
                      {[
                        { label: "Views",    value: scoreResult.predicted_views_str,    color: "var(--accent)" },
                        { label: "Likes",    value: scoreResult.predicted_likes_str,    color: "var(--gold)"   },
                        { label: "Shares",   value: scoreResult.predicted_shares_str,   color: "var(--blue)"   },
                        { label: "Saves",    value: scoreResult.predicted_saves_str,    color: "var(--coral)"  },
                      ].map(item => (
                        <div key={item.label} style={{ textAlign: "center" }}>
                          <div style={{ fontFamily: "var(--font-display)", fontSize: "22px", color: item.color, lineHeight: 1 }}>{item.value}</div>
                          <div style={{ fontSize: "11px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", marginTop: "3px" }}>{item.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tone + data source */}
                <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
                  {scoreResult.tone && <span style={{ fontSize: "12px", padding: "4px 12px", borderRadius: "20px", background: "rgba(176,104,240,0.08)", color: "var(--purple)", border: "1px solid rgba(176,104,240,0.2)", fontFamily: "var(--font-mono)" }}>Tone: {scoreResult.tone}</span>}
                  {scoreResult.predicted_bucket && <span style={{ fontSize: "12px", padding: "4px 12px", borderRadius: "20px", background: "rgba(200,240,104,0.08)", color: "var(--accent)", border: "1px solid rgba(200,240,104,0.15)", fontFamily: "var(--font-mono)" }}>Predicted: {scoreResult.predicted_bucket.toUpperCase()}</span>}
                  <span style={{ fontSize: "12px", color: "var(--text3)", display: "flex", alignItems: "center" }}>📊 {scoreResult.data_source}</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                  {/* Strengths */}
                  {scoreResult.strengths?.length > 0 && (
                    <div style={{ background: "rgba(200,240,104,0.04)", border: "1px solid rgba(200,240,104,0.15)", borderRadius: "var(--radius)", padding: "1.25rem" }}>
                      <div style={{ fontSize: "11px", color: "var(--accent)", fontFamily: "var(--font-mono)", textTransform: "uppercase", marginBottom: "10px" }}>✓ What Works</div>
                      {scoreResult.strengths.map((s, i) => (
                        <div key={i} style={{ fontSize: "13px", color: "var(--text2)", marginBottom: "6px", display: "flex", gap: "8px" }}>
                          <span style={{ color: "var(--accent)", flexShrink: 0 }}>✓</span>{s}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Improvements */}
                  {scoreResult.improvements?.length > 0 && (
                    <div style={{ background: "rgba(240,120,104,0.04)", border: "1px solid rgba(240,120,104,0.15)", borderRadius: "var(--radius)", padding: "1.25rem" }}>
                      <div style={{ fontSize: "11px", color: "var(--coral)", fontFamily: "var(--font-mono)", textTransform: "uppercase", marginBottom: "10px" }}>^ Improvements</div>
                      {scoreResult.improvements.map((s, i) => (
                        <div key={i} style={{ fontSize: "13px", color: "var(--text2)", marginBottom: "6px", display: "flex", gap: "8px" }}>
                          <span style={{ color: "var(--coral)", flexShrink: 0 }}>^</span>{s}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Rewritten hook */}
                {scoreResult.rewritten_hook && (
                  <div style={{ background: "rgba(176,104,240,0.05)", border: "1px solid rgba(176,104,240,0.2)", borderRadius: "var(--radius)", padding: "1.25rem", marginBottom: "12px" }}>
                    <div style={{ fontSize: "11px", color: "var(--purple)", fontFamily: "var(--font-mono)", textTransform: "uppercase", marginBottom: "8px" }}>✨ Rewritten Opening Hook</div>
                    <div style={{ fontSize: "15px", color: "var(--text)", lineHeight: 1.6, fontStyle: "italic" }}>"{scoreResult.rewritten_hook}"</div>
                  </div>
                )}

                {/* Optimization tips from real data */}
                {scoreResult.optimization_tips?.length > 0 && (
                  <div style={{ background: "rgba(176,104,240,0.04)", border: "1px solid rgba(176,104,240,0.15)", borderRadius: "var(--radius)", padding: "1rem 1.25rem", marginBottom: "12px" }}>
                    <div style={{ fontSize: "11px", color: "var(--purple)", fontFamily: "var(--font-mono)", textTransform: "uppercase", marginBottom: "8px" }}>📊 Data-Driven Timing Tips</div>
                    {scoreResult.optimization_tips.map((tip, i) => (
                      <div key={i} style={{ fontSize: "12px", color: tip.startsWith("✓") ? "var(--accent)" : "var(--text2)", marginBottom: "3px" }}>{tip}</div>
                    ))}
                  </div>
                )}

                <button onClick={scoreCaption} className="btn btn-ghost btn-sm" style={{ fontSize: "12px" }}>↻ Re-score</button>
              </div>
            )}
          </div>
        )}

        {/* Input card  -  only for Instagram / LinkedIn */}
        {platform !== "score" && <><div style={{ background: "var(--bg2)", border: `1px solid ${platform === "linkedin" ? "rgba(104,184,240,0.3)" : IG_BORDER}`, borderRadius: "var(--radius)", padding: "2rem", marginBottom: "1.5rem", boxShadow: platform === "linkedin" ? "0 0 0 1px rgba(104,184,240,0.08)" : `0 0 0 1px ${IG_COLOR_DIM}` }}>
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

        {error && <div style={{ background: "rgba(240,100,100,0.08)", border: "1px solid rgba(240,100,100,0.2)", borderRadius: "var(--radius)", padding: "1rem 1.25rem", color: "#F06464", fontSize: "13px", marginBottom: "1rem" }}>{error}</div>}

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
                { label: "Best Post Time", value: result.best_post_time || (platform === "linkedin" ? "Tue-Thu 9:00 AM" : "18:00 Wed"), color: "var(--coral)", icon: "⏰" },
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

            {/* Predicted performance numbers */}
            {result.predicted_views && (
              <div className="fade-up" style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.25rem", marginBottom: "12px" }}>
                <div style={{ fontSize: "11px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", marginBottom: "10px" }}>📊 Predicted Performance</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px" }}>
                  {[
                    { label: "Views",  value: result.predicted_views_str,  color: "var(--accent)" },
                    { label: "Likes",  value: result.predicted_likes_str,  color: "var(--gold)"   },
                    { label: "Shares", value: result.predicted_shares_str, color: "var(--blue)"   },
                    { label: "Saves",  value: result.predicted_saves_str,  color: "var(--coral)"  },
                  ].map(item => (
                    <div key={item.label} style={{ textAlign: "center" }}>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: "22px", color: item.color, lineHeight: 1 }}>{item.value}</div>
                      <div style={{ fontSize: "11px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", marginTop: "3px" }}>{item.label}</div>
                    </div>
                  ))}
                </div>
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

            {platform === "instagram" && (
              <ReelAssets result={result} category={category} />
            )}

            <FeedbackBar contentKey={`${platform}_${topic}`} result={result} />
          </div>
        )}</>}

      </div>
    </div>
  );
}
