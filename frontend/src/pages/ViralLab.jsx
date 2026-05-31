import React, { useState } from "react";
import axios from "axios";
import { config } from "../config.js";

const TONES = ["Inspirational", "Humorous", "Educational", "Trendy", "Authentic"];
const CATEGORIES = ["Lifestyle","Fitness","Beauty","Fashion","Technology","Food","Travel","Music","Photography","Comedy"];

const RESULT_FIELDS = [
  { key: "reel_idea",      icon: "🎬", label: "Reel Idea" },
  { key: "script",         icon: "📝", label: "Script",        mono: true },
  { key: "caption",        icon: "📱", label: "Caption" },
  { key: "hashtags",       icon: "🏷️", label: "Hashtags" },
];

export default function ViralLab({ onNavigate }) {
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("Inspirational");
  const [category, setCategory] = useState("Lifestyle");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generateContent = async () => {
    if (!topic.trim()) return;
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const response = await axios.post(config.api.endpoints.generateContent, {
        topic,
        tone,
        content_category: category,
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
        <div style={{
          background: "var(--bg2)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: "3rem 4rem",
          textAlign: "center", maxWidth: "400px", width: "100%",
        }}>
          <div style={{ fontSize: "40px", marginBottom: "1.5rem" }}>🧪</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "24px", color: "var(--text)", marginBottom: "8px" }}>
            Generating Viral Content
          </div>
          <div style={{ fontSize: "14px", color: "var(--text2)" }}>
            Analyzing trends and crafting your {tone.toLowerCase()} content...
          </div>
          <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "center", gap: "6px" }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                width: "8px", height: "8px", borderRadius: "50%",
                background: "var(--accent)", display: "inline-block",
                animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: "56px" }}>
      <div style={{ maxWidth: "780px", margin: "0 auto", padding: "3rem 2rem" }}>

        <div style={{ marginBottom: "3rem" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('landing')} style={{ marginBottom: "1.5rem", fontSize: "13px" }}>
            ← Home
          </button>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "36px", marginBottom: "8px" }}>
            Viral Content Lab
          </h2>
          <p style={{ fontSize: "15px", color: "var(--text2)" }}>
            Enter a topic and let the AI generate a reel idea, script, caption, and hashtags optimised for virality.
          </p>
        </div>

        <div style={{
          background: "var(--bg2)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: "2rem", marginBottom: "1.5rem",
        }}>
          <div style={{
            fontSize: "13px", fontWeight: 500, color: "var(--text2)",
            letterSpacing: ".05em", textTransform: "uppercase",
            fontFamily: "var(--font-mono)", marginBottom: "1.5rem",
          }}>
            🧪 Content Topic
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label>What do you want to go viral about?</label>
              <input
                type="text"
                placeholder="e.g. Sustainable skincare routine for busy millennials"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && generateContent()}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "13px", color: "var(--text2)" }}>Content Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "13px", color: "var(--text2)" }}>Content Tone</label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {TONES.map(t => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    style={{
                      padding: "6px 14px", borderRadius: "100px", fontSize: "12px",
                      fontFamily: "var(--font-mono)", cursor: "pointer", transition: "all .15s",
                      border: tone === t ? "1px solid var(--accent)" : "1px solid var(--border)",
                      background: tone === t ? "rgba(200,240,104,0.12)" : "var(--bg)",
                      color: tone === t ? "var(--accent)" : "var(--text2)",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div style={{
            background: "rgba(240,100,100,0.08)", border: "1px solid rgba(240,100,100,0.2)",
            borderRadius: "var(--radius)", padding: "1rem 1.25rem",
            color: "#F06464", fontSize: "13px", marginBottom: "1rem",
          }}>
            {error}
          </div>
        )}

        <button
          onClick={generateContent}
          disabled={!topic.trim()}
          className="btn btn-primary"
          style={{
            width: "100%", padding: "16px", borderRadius: "100px",
            fontSize: "16px", fontWeight: 600, marginTop: ".5rem",
            justifyContent: "center", opacity: topic.trim() ? 1 : 0.5,
            cursor: topic.trim() ? "pointer" : "not-allowed",
          }}
          onMouseEnter={e => { if (topic.trim()) { e.currentTarget.style.boxShadow = "0 12px 40px rgba(200,240,104,0.3)"; e.currentTarget.style.transform = "translateY(-2px)"; }}}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
        >
          🚀 Generate Viral Content
        </button>

        {result && (
          <div style={{ marginTop: "2.5rem" }}>

            {/* Scores strip */}
            <div className="fade-up" style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "12px",
            }}>
              {[
                { label: "Virality Score", value: result.virality_score, suffix: "%", color: "var(--accent)", icon: "🚀",
                  sub: result.predicted_bucket ? `Predicted: ${result.predicted_bucket.toUpperCase()}` : null },
                { label: "Trend Score", value: result.trend_score, suffix: "", color: "var(--gold)", icon: "🔥",
                  sub: "Current topic momentum" },
                { label: "Best Post Time", value: result.best_post_time || "18:00 Wed", suffix: "", color: "var(--blue)", icon: "⏰",
                  sub: "Based on real data" },
              ].map(item => item.value != null && (
                <div key={item.label} style={{
                  background: "var(--bg2)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius)", padding: "1rem 1.25rem",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "16px" }}>{item.icon}</span>
                    <span style={{ fontSize: "11px", letterSpacing: ".05em", textTransform: "uppercase", color: "var(--text3)", fontFamily: "var(--font-mono)" }}>{item.label}</span>
                  </div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "26px", color: item.color, lineHeight: 1 }}>
                    {item.value}{item.suffix}
                  </div>
                  {item.sub && <div style={{ fontSize: "11px", color: "var(--text3)", marginTop: "3px" }}>{item.sub}</div>}
                </div>
              ))}
            </div>

            {/* Real data optimization tips */}
            {result.optimization_tips && result.optimization_tips.length > 0 && (
              <div className="fade-up" style={{
                background: "rgba(200,240,104,0.04)", border: "1px solid rgba(200,240,104,0.15)",
                borderRadius: "var(--radius)", padding: "1rem 1.25rem", marginBottom: "12px",
              }}>
                <div style={{ fontSize: "11px", letterSpacing: ".05em", textTransform: "uppercase", color: "var(--accent)", fontFamily: "var(--font-mono)", marginBottom: "8px" }}>
                  📊 Data-Driven Optimisation · {result.data_source}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {result.optimization_tips.map((tip, i) => (
                    <div key={i} style={{ fontSize: "12px", color: tip.startsWith("✓") ? "var(--accent)" : "var(--text2)" }}>{tip}</div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div className="section-label">Generated Content</div>
              <button onClick={generateContent} className="btn btn-ghost btn-sm" style={{ fontSize: "12px" }}>↻ Regenerate</button>
            </div>

            <div className="section-label" style={{ marginBottom: "12px" }}>Generated Content</div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {RESULT_FIELDS.map(({ key, icon, label, suffix, mono }, i) => (
                result[key] != null && (
                  <div key={key} className={`fade-up delay-${i}`} style={{
                    background: "var(--bg2)", border: "1px solid var(--border)",
                    borderRadius: "var(--radius)", padding: "1.25rem 1.5rem",
                    display: "flex", alignItems: "flex-start", gap: "14px",
                  }}>
                    <span style={{
                      fontSize: "18px", flexShrink: 0,
                      width: "40px", height: "40px", borderRadius: "10px",
                      background: "var(--accent-dim)", display: "flex",
                      alignItems: "center", justifyContent: "center",
                    }}>
                      {icon}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "11px", letterSpacing: ".05em", textTransform: "uppercase", color: "var(--text3)", fontFamily: "var(--font-mono)", marginBottom: "6px" }}>
                        {label}
                      </div>
                      {suffix ? (
                        <span style={{ fontFamily: "var(--font-display)", fontSize: "28px", color: "var(--accent)" }}>
                          {result[key]}{suffix}
                        </span>
                      ) : mono ? (
                        <pre style={{ fontSize: "13px", color: "var(--text2)", lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: "var(--font-mono)", margin: 0 }}>
                          {result[key]}
                        </pre>
                      ) : (
                        <div style={{ fontSize: "14px", color: "var(--text)", lineHeight: 1.6 }}>
                          {result[key]}
                        </div>
                      )}
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
