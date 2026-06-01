import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { config } from "../config.js";

const AGENT_STEPS = [
  { icon: "🔍", label: "Discovering & Ranking Trends..." },
  { icon: "👤", label: "Finding Best Influencer..." },
  { icon: "🎬", label: "Generating Instagram + LinkedIn Content..." },
  { icon: "📈", label: "Predicting Campaign Success..." },
];

const IG_FIELDS = [
  { key: "trend",          icon: "🔥", label: "Trend Found" },
  { key: "trend_source",   icon: "📡", label: "Trend Source" },
  { key: "influencer",     icon: "👤", label: "Influencer Selected" },
  { key: "reel_idea",      icon: "🎬", label: "Reel Idea" },
  { key: "caption",        icon: "📱", label: "Instagram Caption" },
  { key: "virality_score", icon: "🚀", label: "Virality Score", suffix: "%" },
  { key: "campaign_success", icon: "📈", label: "Campaign Success", suffix: "%" },
];

const LI_FIELDS = [
  { key: "linkedin_hook",     icon: "⚡", label: "LinkedIn Hook" },
  { key: "linkedin_post",     icon: "📝", label: "LinkedIn Post", mono: true },
  { key: "linkedin_hashtags", icon: "🏷️", label: "LinkedIn Hashtags" },
];

function FeedbackBar({ result }) {
  const storageKey = `agent_feedback_${JSON.stringify(result).slice(0, 30)}`;
  const [vote, setVote] = useState(() => localStorage.getItem(storageKey) || null);

  const handleVote = (v) => {
    setVote(v);
    localStorage.setItem(storageKey, v);
    const history = JSON.parse(localStorage.getItem('ratefluencer_feedback') || '[]');
    history.push({ key: 'agent', vote: v, ts: Date.now(), success: result?.campaign_success });
    localStorage.setItem('ratefluencer_feedback', JSON.stringify(history.slice(-50)));
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "1rem", padding: "12px 14px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
      <span style={{ fontSize: "12px", color: "var(--text3)", fontFamily: "var(--font-mono)", flex: 1 }}>Was this campaign plan useful?</span>
      {[{ v: "up", icon: "👍" }, { v: "down", icon: "👎" }].map(({ v, icon }) => (
        <button key={v} onClick={() => handleVote(v)} style={{
          padding: "4px 14px", borderRadius: "20px", fontSize: "12px", cursor: "pointer",
          border: vote === v ? `1px solid ${v === "up" ? "var(--accent)" : "var(--coral)"}` : "1px solid var(--border)",
          background: vote === v ? (v === "up" ? "rgba(200,240,104,0.1)" : "rgba(240,120,104,0.1)") : "transparent",
          color: vote === v ? (v === "up" ? "var(--accent)" : "var(--coral)") : "var(--text3)",
        }}>{icon}</button>
      ))}
      {vote && <span style={{ fontSize: "11px", color: "var(--text3)" }}>✓ Improving future recommendations</span>}
    </div>
  );
}

export default function AIAgent() {
  const navigate = useNavigate();
  const [goal, setGoal] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("instagram");

  const runAgent = async () => {
    if (!goal.trim()) return;
    try {
      setLoading(true);
      setResult(null);
      setError(null);

      for (let i = 0; i < AGENT_STEPS.length; i++) {
        setStepIndex(i);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const response = await axios.post(config.api.endpoints.agent, { goal });
      setResult(response.data);
      setActiveTab("instagram");
    } catch (err) {
      console.error(err);
      setError("Agent run failed. Please check the backend is running and try again.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ paddingTop: "56px", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "3rem 4rem", textAlign: "center", maxWidth: "480px", width: "100%" }}>
          <div style={{ fontSize: "40px", marginBottom: "1.5rem" }}>🤖</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "24px", marginBottom: "1rem", color: "var(--text)" }}>Autonomous Agent Running</div>
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

        <div style={{ marginBottom: "3rem" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')} style={{ marginBottom: "1.5rem", fontSize: "13px" }}>
            ← Home
          </button>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "36px", marginBottom: "8px" }}>Autonomous AI Agent</h2>
          <p style={{ fontSize: "15px", color: "var(--text2)" }}>
            Discovers trends → selects best influencer → generates Instagram + LinkedIn content → predicts success.
          </p>
        </div>

        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "2rem", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text2)", letterSpacing: ".05em", textTransform: "uppercase", fontFamily: "var(--font-mono)", marginBottom: "1.5rem" }}>
            🎯 Campaign Goal
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label>Describe what you want to achieve</label>
            <input
              type="text"
              placeholder="e.g. Launch a skincare product for urban women aged 25–34 in India"
              value={goal}
              onChange={e => setGoal(e.target.value)}
              onKeyDown={e => e.key === "Enter" && runAgent()}
            />
          </div>
        </div>

        {error && (
          <div style={{ background: "rgba(240,100,100,0.08)", border: "1px solid rgba(240,100,100,0.2)", borderRadius: "var(--radius)", padding: "1rem 1.25rem", color: "#F06464", fontSize: "13px", marginBottom: "1rem" }}>
            {error}
          </div>
        )}

        <button
          onClick={runAgent}
          disabled={!goal.trim()}
          className="btn btn-primary"
          style={{ width: "100%", padding: "16px", borderRadius: "100px", fontSize: "16px", fontWeight: 600, marginTop: ".5rem", justifyContent: "center", opacity: goal.trim() ? 1 : 0.5, cursor: goal.trim() ? "pointer" : "not-allowed" }}
          onMouseEnter={e => { if (goal.trim()) { e.currentTarget.style.boxShadow = "0 12px 40px rgba(200,240,104,0.3)"; e.currentTarget.style.transform = "translateY(-2px)"; }}}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
        >
          🤖 Run Autonomous Agent
        </button>

        {result && (
          <div style={{ marginTop: "2.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div className="section-label">Agent Output</div>
              <button onClick={runAgent} className="btn btn-ghost btn-sm" style={{ fontSize: "12px" }}>↻ Run Again</button>
            </div>

            {/* Agent Reasoning Trail */}
            {result.content_attempts && result.content_attempts.length > 0 && (
              <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.25rem", marginBottom: "16px" }}>
                <div style={{ fontSize: "11px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", marginBottom: "10px" }}>
                  🧠 Agent Reasoning — {result.content_attempts.length} iteration{result.content_attempts.length > 1 ? "s" : ""}
                  {result.agent_refined && <span style={{ marginLeft: "8px", color: "var(--accent)" }}>✓ Content refined</span>}
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
                  {result.content_attempts.map(attempt => {
                    const vColor = attempt.virality_score >= 68 ? "var(--accent)" : attempt.virality_score >= 50 ? "var(--gold)" : "var(--coral)";
                    return (
                      <div key={attempt.iteration} style={{
                        background: "var(--bg)", border: `1px solid ${vColor}30`,
                        borderRadius: "var(--radius-sm)", padding: "10px 14px", minWidth: "160px",
                      }}>
                        <div style={{ fontSize: "10px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", marginBottom: "4px" }}>
                          Iteration {attempt.iteration}
                        </div>
                        <div style={{ fontFamily: "var(--font-display)", fontSize: "22px", color: vColor, lineHeight: 1 }}>
                          {attempt.virality_score}
                        </div>
                        <div style={{ fontSize: "10px", color: "var(--text3)", marginTop: "2px" }}>{attempt.bucket}</div>
                        {attempt.refinement_used && (
                          <div style={{ fontSize: "10px", color: "var(--text2)", marginTop: "6px", fontFamily: "var(--font-mono)", wordBreak: "break-word" }}>
                            Hint: {String(attempt.refinement_used).slice(0, 60)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {result.creator_pool && result.creator_pool.length > 0 && (
                  <div style={{ fontSize: "12px", color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
                    Evaluated creators: {result.creator_pool.map(c => `${c.name} (RF=${c.rf_score})`).join(" · ")}
                  </div>
                )}
              </div>
            )}

            {/* Platform tabs */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              {[
                { id: "instagram", icon: "📸", label: "Instagram" },
                { id: "linkedin",  icon: "💼", label: "LinkedIn"  },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`btn btn-sm ${activeTab === t.id ? "btn-primary" : "btn-ghost"}`}
                  style={{ fontSize: "12px", background: activeTab === t.id && t.id === "linkedin" ? "var(--blue)" : undefined }}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {/* Instagram fields */}
            {activeTab === "instagram" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {IG_FIELDS.map(({ key, icon, label, suffix }) => (
                  result[key] != null && (
                    <div key={key} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.25rem 1.5rem", display: "flex", alignItems: "flex-start", gap: "14px" }}>
                      <span style={{ fontSize: "20px", flexShrink: 0, width: "40px", height: "40px", borderRadius: "10px", background: "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
                      <div>
                        <div style={{ fontSize: "11px", letterSpacing: ".05em", textTransform: "uppercase", color: "var(--text3)", fontFamily: "var(--font-mono)", marginBottom: "4px" }}>{label}</div>
                        <div style={{ fontSize: "15px", color: "var(--text)", lineHeight: 1.6 }}>
                          {suffix
                            ? <span style={{ fontFamily: "var(--font-display)", fontSize: "28px", color: "var(--accent)" }}>{result[key]}{suffix}</span>
                            : result[key]}
                        </div>
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}

            {/* LinkedIn fields */}
            {activeTab === "linkedin" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {result.linkedin_post ? (
                  LI_FIELDS.map(({ key, icon, label, mono }) => (
                    result[key] && (
                      <div key={key} style={{ background: "var(--bg2)", border: "1px solid rgba(104,184,240,0.2)", borderRadius: "var(--radius)", padding: "1.25rem 1.5rem", display: "flex", alignItems: "flex-start", gap: "14px" }}>
                        <span style={{ fontSize: "20px", flexShrink: 0, width: "40px", height: "40px", borderRadius: "10px", background: "var(--blue-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "11px", letterSpacing: ".05em", textTransform: "uppercase", color: "var(--text3)", fontFamily: "var(--font-mono)", marginBottom: "4px" }}>{label}</div>
                          {mono
                            ? <pre style={{ fontSize: "13px", color: "var(--text2)", lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: "var(--font-mono)", margin: 0 }}>{result[key]}</pre>
                            : <div style={{ fontSize: "14px", color: "var(--text)", lineHeight: 1.6 }}>{result[key]}</div>}
                        </div>
                      </div>
                    )
                  ))
                ) : (
                  <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "2rem", textAlign: "center", color: "var(--text3)" }}>
                    No LinkedIn content in this result. Run the agent again for fresh output.
                  </div>
                )}
              </div>
            )}

            {/* Predicted performance */}
            {result.predicted_views && activeTab === "instagram" && (
              <div style={{ marginTop: "12px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.25rem" }}>
                <div style={{ fontSize: "11px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", marginBottom: "10px" }}>📊 Predicted Campaign Performance</div>
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

            <FeedbackBar result={result} />
          </div>
        )}
      </div>
    </div>
  );
}
