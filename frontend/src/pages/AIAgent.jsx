import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { config } from "../config.js";

const AGENT_STEPS = [
  { icon: "🔍", label: "Discovering Real-Time Trends (Google + Reddit + News)..." },
  { icon: "👤", label: "Selecting Best Influencer via Ratefluencer Score..." },
  { icon: "🧠", label: "Applying Learned Preferences + Iterating Content..." },
  { icon: "📈", label: "Predicting Virality + Campaign Success..." },
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

// One-click "open video generator" launchers
// Copies the AI-generated prompt to clipboard then opens the service in a new tab.
// The user just lands on the page and hits Ctrl+V — no manual copy needed.
const VIDEO_SERVICES = [
  {
    id:    'runway',
    label: 'Runway Gen-3',
    url:   'https://app.runwayml.com/video-tools/teams',
    hint:  'Paste prompt -> Generate',
    color: 'var(--accent)',
    bg:    'rgba(200,240,104,0.08)',
    border:'rgba(200,240,104,0.25)',
    free:  false,
    note:  'Needs credits',
  },
  {
    id:    'kling',
    label: 'Kling AI',
    url:   'https://klingai.com/text-to-video/new',
    hint:  'Paste prompt -> Generate',
    color: 'var(--blue)',
    bg:    'rgba(104,184,240,0.08)',
    border:'rgba(104,184,240,0.25)',
    free:  true,
    note:  '66 free credits/day',
  },
  {
    id:    'luma',
    label: 'Luma Dream Machine',
    url:   'https://lumalabs.ai/dream-machine',
    hint:  'Paste prompt -> Generate',
    color: 'var(--purple)',
    bg:    'rgba(176,104,240,0.08)',
    border:'rgba(176,104,240,0.25)',
    free:  true,
    note:  '30 free/month',
  },
  {
    id:    'pika',
    label: 'Pika Labs',
    url:   'https://pika.art/create',
    hint:  'Paste prompt -> Generate',
    color: 'var(--coral)',
    bg:    'rgba(240,120,104,0.08)',
    border:'rgba(240,120,104,0.25)',
    free:  true,
    note:  'Free tier',
  },
  {
    id:    'veo',
    label: 'Google VideoFX',
    url:   'https://aitestkitchen.withgoogle.com/tools/video-fx',
    hint:  'Paste prompt -> Generate',
    color: 'var(--gold)',
    bg:    'rgba(240,200,104,0.08)',
    border:'rgba(240,200,104,0.25)',
    free:  true,
    note:  'Veo 2 - free',
  },
];

function VideoGeneratorCard({ runVideoGeneration, videoLoading, videoResult }) {
  const [copied, setCopied] = useState(null);
  const [toast,  setToast]  = useState('');

  const openService = (svc, prompt) => {
    if (!prompt) {
      setToast('Generate a storyboard first to get the video prompt.');
      setTimeout(() => setToast(''), 3000);
      return;
    }
    // Copy prompt to clipboard
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(svc.id);
      setToast(`Prompt copied! Opening ${svc.label} — just paste (Ctrl+V) and hit Generate.`);
      setTimeout(() => { setCopied(null); setToast(''); }, 4000);
    }).catch(() => {
      setToast('Could not copy automatically — please copy the prompt below manually.');
      setTimeout(() => setToast(''), 4000);
    });
    // Open the service in a new tab
    window.open(svc.url, '_blank', 'noopener,noreferrer');
  };

  const prompt = videoResult?.runway_prompt || videoResult?.veo_prompt || '';

  return (
    <div style={{ marginTop: "12px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.25rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div>
          <div style={{ fontSize: "11px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: ".06em" }}>
            AI Video Generation
          </div>
          <div style={{ fontSize: "12px", color: "var(--text2)", marginTop: "2px" }}>
            Generate storyboard, then click any service to open it with prompt pre-loaded
          </div>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={runVideoGeneration}
          disabled={videoLoading}
          style={{ fontSize: "11px", flexShrink: 0 }}
        >
          {videoLoading ? "Generating..." : videoResult ? "Regenerate" : "Generate Storyboard"}
        </button>
      </div>

      {/* Storyboard scenes */}
      {videoResult && (
        <div style={{ marginBottom: "12px" }}>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
            {videoResult.scenes?.slice(0, 4).map((scene, i) => (
              <div key={i} style={{ flex: "1 1 45%", padding: "8px 10px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: "11px" }}>
                <div style={{ color: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: "9px", marginBottom: "3px" }}>
                  Scene {scene.id} · {scene.start_sec}s-{scene.end_sec}s · {scene.shot || 'wide'}
                </div>
                <div style={{ color: "var(--text2)" }}>{String(scene.action || '').slice(0, 55)}</div>
                {scene.broll_keyword && (
                  <div style={{ color: "var(--text3)", fontSize: "10px", marginTop: "2px" }}>B-roll: {scene.broll_keyword}</div>
                )}
              </div>
            ))}
          </div>

          {/* Prompt box */}
          {prompt && (
            <div style={{ padding: "8px 12px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", marginBottom: "10px" }}>
              <div style={{ fontSize: "9px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", marginBottom: "4px" }}>AI Video Prompt (auto-copied on click)</div>
              <div style={{ fontSize: "12px", color: "var(--text2)", lineHeight: 1.5 }}>{prompt}</div>
            </div>
          )}
        </div>
      )}

      {/* Service launchers */}
      <div style={{ fontSize: "11px", color: "var(--text3)", marginBottom: "8px", fontFamily: "var(--font-mono)" }}>
        {videoResult ? "Click to copy prompt + open service:" : "Generate storyboard above first, then use any service below:"}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
        {VIDEO_SERVICES.map(svc => (
          <button
            key={svc.id}
            onClick={() => openService(svc, prompt)}
            style={{
              padding: "10px 8px", borderRadius: "var(--radius-sm)", cursor: "pointer",
              background: copied === svc.id ? svc.bg : "var(--bg)",
              border: `1px solid ${copied === svc.id ? svc.border : "var(--border)"}`,
              display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "3px",
              transition: "all .15s", textAlign: "left",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = svc.bg; e.currentTarget.style.borderColor = svc.border; }}
            onMouseLeave={e => { if (copied !== svc.id) { e.currentTarget.style.background = "var(--bg)"; e.currentTarget.style.borderColor = "var(--border)"; }}}
          >
            <div style={{ fontSize: "12px", fontWeight: 500, color: svc.color }}>
              {copied === svc.id ? "Prompt copied!" : svc.label}
            </div>
            <div style={{ fontSize: "10px", color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
              {svc.free
                ? <span style={{ color: "var(--accent)" }}>FREE - {svc.note}</span>
                : <span style={{ color: "var(--text3)" }}>{svc.note}</span>
              }
            </div>
            <div style={{ fontSize: "9px", color: "var(--text3)" }}>{svc.hint}</div>
          </button>
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ marginTop: "10px", padding: "8px 12px", background: "rgba(200,240,104,0.08)", border: "1px solid rgba(200,240,104,0.2)", borderRadius: "var(--radius-sm)", fontSize: "12px", color: "var(--accent)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}

export default function AIAgent() {
  const navigate   = useNavigate();
  const [goal,        setGoal]        = useState("");
  const [result,      setResult]      = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [stepIndex,   setStepIndex]   = useState(0);
  const [error,       setError]       = useState(null);
  const [activeTab,   setActiveTab]   = useState("instagram");
  const [learnResult, setLearnResult] = useState(null);
  const [learningActive, setLearningActive] = useState(false);
  const [prefs,       setPrefs]       = useState(null);
  const [videoResult, setVideoResult] = useState(null);
  const [videoLoading, setVideoLoading] = useState(false);

  // Load persisted preferences on mount
  useEffect(() => {
    fetch(config.api.endpoints.agentPreferences)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.has_preferences) setPrefs(d.preferences); })
      .catch(() => {});
  }, []);

  const runLearn = async () => {
    setLearningActive(true);
    try {
      const r = await fetch(config.api.endpoints.agentLearn, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: result?.category || '' }),
      });
      const d = await r.json();
      setLearnResult(d);
      if (d.learned) setPrefs(d.preferences);
    } catch (e) { console.warn(e); }
    finally { setLearningActive(false); }
  };

  const runVideoGeneration = async () => {
    if (!result) return;
    setVideoLoading(true);
    setVideoResult(null);
    try {
      const r = await fetch(config.api.endpoints.generateVideo, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reel_idea: result.reel_idea,
          script: result.caption,
          category: result.category,
          duration: 30,
        }),
      });
      const d = await r.json();
      setVideoResult(d);
    } catch (e) { console.warn(e); }
    finally { setVideoLoading(false); }
  };

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
            Discovers trends -> selects best influencer -> generates Instagram + LinkedIn content -> predicts success.
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
              placeholder="e.g. Launch a skincare product for urban women aged 25-34 in India"
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
                  🧠 Agent Reasoning  -  {result.content_attempts.length} iteration{result.content_attempts.length > 1 ? "s" : ""}
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
                        {attempt.strategy && (
                          <div style={{ fontSize: "10px", color: "var(--blue)", marginTop: "4px", lineHeight: 1.4 }}>
                            {attempt.strategy.slice(0, 55)}
                          </div>
                        )}
                        {attempt.learned_applied && (
                          <div style={{ fontSize: "9px", color: "var(--accent)", marginTop: "3px", fontFamily: "var(--font-mono)" }}>
                            + learned prefs applied
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {result.creator_pool && result.creator_pool.length > 0 && (
                  <div style={{ fontSize: "12px", color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
                    Evaluated creators: {result.creator_pool.map(c => `${c.name} (RF=${c.rf_score})`).join(" . ")}
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

            {/* -- Learning Loop Card -- */}
            <div style={{ marginTop: "12px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <div style={{ fontSize: "11px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>
                  Continuous Learning Loop
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={runLearn}
                  disabled={learningActive}
                  style={{ fontSize: "11px" }}
                >
                  {learningActive ? "Learning..." : "Learn from Feedback"}
                </button>
              </div>
              {prefs && prefs.upvoted_count >= 2 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ fontSize: "12px", color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
                    Active — learned from {prefs.upvoted_count} upvotes (confidence {prefs.confidence}%)
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {[
                      { label: "Tone", val: prefs.detected_tone },
                      { label: "Hashtags", val: `~${prefs.avg_hashtags}` },
                      { label: "Avg virality", val: prefs.avg_virality },
                    ].map(p => (
                      <span key={p.label} style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "20px", background: "rgba(200,240,104,0.08)", border: "1px solid rgba(200,240,104,0.2)", color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
                        {p.label}: {p.val}
                      </span>
                    ))}
                  </div>
                  {prefs.preferred_words?.length > 0 && (
                    <div style={{ fontSize: "11px", color: "var(--text3)" }}>
                      Preferred words: {prefs.preferred_words.slice(0,5).join(", ")}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: "12px", color: "var(--text3)", lineHeight: 1.6 }}>
                  Rate content with thumbs up/down in Viral Lab, then click "Learn from Feedback"
                  to activate the improvement loop. The agent will automatically apply your preferences
                  in the next {`{MAX_CONTENT_ITERS}`} iterations.
                </div>
              )}
              {learnResult?.learned && (
                <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--accent)", padding: "8px 12px", background: "rgba(200,240,104,0.06)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(200,240,104,0.15)" }}>
                  {learnResult.message}
                </div>
              )}
            </div>

            {/* -- Video Generation Card -- */}
            <VideoGeneratorCard
              runVideoGeneration={runVideoGeneration}
              videoLoading={videoLoading}
              videoResult={videoResult}
            />
          </div>
        )}
      </div>
    </div>
  );
}
