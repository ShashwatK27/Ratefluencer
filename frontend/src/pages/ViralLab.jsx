import React, { useState } from "react";
import axios from "axios";

const RESULT_FIELDS = [
  { key: "reel_idea",      icon: "🎬", label: "Reel Idea" },
  { key: "script",         icon: "📝", label: "Script",        mono: true },
  { key: "caption",        icon: "📱", label: "Caption" },
  { key: "hashtags",       icon: "🏷️", label: "Hashtags" },
  { key: "virality_score", icon: "🚀", label: "Virality Score", suffix: "%" },
];

export default function ViralLab() {
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const generateContent = async () => {
    try {
      setLoading(true);
      setResult(null);

      const response = await axios.post(
        "http://127.0.0.1:5000/api/generate-content",
        { topic }
      );

      setResult(response.data);
    } catch (error) {
      console.error(error);
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
            Analyzing trends and crafting your content...
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

        {/* Page Header */}
        <div style={{ marginBottom: "3rem" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "36px", marginBottom: "8px" }}>
            Viral Content Lab
          </h2>
          <p style={{ fontSize: "15px", color: "var(--text2)" }}>
            Enter a topic and let the AI generate a reel idea, script, caption, and hashtags optimised for virality.
          </p>
        </div>

        {/* Topic Input Card */}
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
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label>What do you want to go viral about?</label>
            <input
              type="text"
              placeholder="e.g. Sustainable skincare routine for busy millennials"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={generateContent}
          className="btn btn-primary"
          style={{
            width: "100%", padding: "16px", borderRadius: "100px",
            fontSize: "16px", fontWeight: 600, marginTop: ".5rem",
            justifyContent: "center",
          }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 12px 40px rgba(200,240,104,0.3)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
        >
          🚀 Generate Viral Content
        </button>

        {/* Results */}
        {result && (
          <div style={{ marginTop: "2.5rem" }}>

            {/* Trend Score banner */}
            {result.trend_score != null && (
              <div className="fade-up" style={{
                background: "var(--accent-dim)", border: "1px solid rgba(200,240,104,0.2)",
                borderRadius: "var(--radius)", padding: "1.25rem 1.5rem",
                display: "flex", alignItems: "center", gap: "14px",
                marginBottom: "12px",
              }}>
                <span style={{ fontSize: "24px" }}>🔥</span>
                <div>
                  <div style={{ fontSize: "11px", letterSpacing: ".05em", textTransform: "uppercase", color: "var(--accent)", fontFamily: "var(--font-mono)", marginBottom: "2px" }}>
                    Trend Score
                  </div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "32px", color: "var(--accent)", lineHeight: 1 }}>
                    {result.trend_score}
                  </div>
                </div>
              </div>
            )}

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