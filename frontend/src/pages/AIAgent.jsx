import React, { useState } from "react";
import axios from "axios";

const AGENT_STEPS = [
  { icon: "🔍", label: "Discovering Trends..." },
  { icon: "👤", label: "Finding Best Influencers..." },
  { icon: "🎬", label: "Generating Viral Content..." },
  { icon: "📈", label: "Predicting Campaign Success..." },
];

const RESULT_FIELDS = [
  { key: "trend",            icon: "🔥", label: "Trend Found" },
  { key: "influencer",       icon: "👤", label: "Influencer Selected" },
  { key: "reel_idea",        icon: "🎬", label: "Reel Idea" },
  { key: "caption",          icon: "📱", label: "Caption" },
  { key: "virality_score",   icon: "🚀", label: "Virality Score",      suffix: "%" },
  { key: "campaign_success", icon: "📈", label: "Campaign Success",    suffix: "%" },
];

export default function AIAgent() {
  const [goal, setGoal] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const runAgent = async () => {
    try {
      setLoading(true);
      setResult(null);

      for (let i = 0; i < AGENT_STEPS.length; i++) {
        setStepIndex(i);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const response = await axios.post(
        "http://127.0.0.1:5000/api/run-agent",
        { goal }
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
          textAlign: "center", maxWidth: "480px", width: "100%",
        }}>
          <div style={{ fontSize: "40px", marginBottom: "1.5rem" }}>🤖</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "24px", marginBottom: "1rem", color: "var(--text)" }}>
            Autonomous Agent Running
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "1.5rem" }}>
            {AGENT_STEPS.map((step, i) => (
              <div key={step.label} style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "10px 14px", borderRadius: "var(--radius-sm)",
                background: i === stepIndex ? "var(--accent-dim)" : "transparent",
                border: i === stepIndex ? "1px solid rgba(200,240,104,0.2)" : "1px solid transparent",
                fontSize: "13px",
                color: i < stepIndex ? "var(--text3)" : i === stepIndex ? "var(--accent)" : "var(--text2)",
                transition: "all .3s",
              }}>
                <span>{step.icon}</span>
                {step.label}
                {i < stepIndex && <span style={{ marginLeft: "auto", color: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: "11px" }}>✓ Done</span>}
                {i === stepIndex && <span style={{ marginLeft: "auto", width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent)", animation: "pulse 2s infinite", display: "inline-block" }} />}
              </div>
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
            Autonomous AI Agent
          </h2>
          <p style={{ fontSize: "15px", color: "var(--text2)" }}>
            Let the AI automatically discover trends, select influencers, generate content, and predict campaign success.
          </p>
        </div>

        {/* Goal Input Card */}
        <div style={{
          background: "var(--bg2)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: "2rem", marginBottom: "1.5rem",
        }}>
          <div style={{
            fontSize: "13px", fontWeight: 500, color: "var(--text2)",
            letterSpacing: ".05em", textTransform: "uppercase",
            fontFamily: "var(--font-mono)", marginBottom: "1.5rem",
          }}>
            🎯 Campaign Goal
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label>Describe what you want to achieve</label>
            <input
              type="text"
              placeholder="e.g. Launch a skincare product for urban women aged 25–34 in India"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>
        </div>

        {/* Run Button */}
        <button
          onClick={runAgent}
          className="btn btn-primary"
          style={{
            width: "100%", padding: "16px", borderRadius: "100px",
            fontSize: "16px", fontWeight: 600, marginTop: ".5rem",
            justifyContent: "center",
          }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 12px 40px rgba(200,240,104,0.3)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
        >
          🤖 Run Autonomous Agent
        </button>

        {/* Results */}
        {result && (
          <div style={{ marginTop: "2.5rem" }}>
            <div className="section-label" style={{ marginBottom: "12px" }}>Agent Output</div>

            <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {RESULT_FIELDS.map(({ key, icon, label, suffix }, i) => (
                result[key] != null && (
                  <div key={key} className={`fade-up delay-${i}`} style={{
                    background: "var(--bg2)", border: "1px solid var(--border)",
                    borderRadius: "var(--radius)", padding: "1.25rem 1.5rem",
                    display: "flex", alignItems: "flex-start", gap: "14px",
                  }}>
                    <span style={{
                      fontSize: "20px", flexShrink: 0,
                      width: "40px", height: "40px", borderRadius: "10px",
                      background: "var(--accent-dim)", display: "flex",
                      alignItems: "center", justifyContent: "center",
                    }}>
                      {icon}
                    </span>
                    <div>
                      <div style={{ fontSize: "11px", letterSpacing: ".05em", textTransform: "uppercase", color: "var(--text3)", fontFamily: "var(--font-mono)", marginBottom: "4px" }}>
                        {label}
                      </div>
                      <div style={{ fontSize: "15px", color: "var(--text)", lineHeight: 1.6 }}>
                        {suffix
                          ? <span style={{ fontFamily: "var(--font-display)", fontSize: "28px", color: "var(--accent)" }}>{result[key]}{suffix}</span>
                          : result[key]
                        }
                      </div>
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