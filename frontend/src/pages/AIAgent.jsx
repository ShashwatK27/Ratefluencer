import React, { useState, useEffect, useRef } from "react";
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


function VideoGeneratorCard({ result }) {
  const [storyboard,       setStoryboard]       = useState(null);
  const [storyboardLoading,setStoryboardLoading]= useState(false);
  const [selectedScenes,   setSelectedScenes]   = useState(new Set());
  const [videoLoading,     setVideoLoading]     = useState(false);
  const [videoUrl,         setVideoUrl]         = useState(null);
  const [msg,              setMsg]              = useState('');

  const fetchStoryboard = async () => {
    setStoryboardLoading(true); setStoryboard(null); setSelectedScenes(new Set()); setVideoUrl(null); setMsg('');
    try {
      const r = await fetch(config.api.endpoints.generateStoryboard, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reel_idea: result?.reel_idea || '',
          hook:      result?.caption?.split('.')[0] || result?.reel_idea || '',
          story:     result?.caption || '',
          key_insights: '',
          cta:       'Follow for more viral content',
          category:  result?.category || 'Lifestyle',
          duration:  20,
        }),
      });
      const d = await r.json();
      if (d.scenes) {
        setStoryboard(d);
        setSelectedScenes(new Set(d.scenes.slice(0, 3).map(s => s.id)));
      } else setMsg(d.error || 'Storyboard failed');
    } catch (e) { setMsg('Storyboard failed: ' + e.message); }
    finally { setStoryboardLoading(false); }
  };

  const toggleScene = (id) => {
    setSelectedScenes(prev => {
      const next = new Set(prev);
      if (next.has(id)) { if (next.size > 2) next.delete(id); }
      else              { if (next.size < 4) next.add(id); }
      return next;
    });
  };

  const generateVideo = async () => {
    const chosen = storyboard.scenes.filter(s => selectedScenes.has(s.id));
    setVideoLoading(true); setVideoUrl(null); setMsg('Generating images → video (~40s)...');
    try {
      const r = await fetch(config.api.endpoints.generateVideo, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reel_idea:         result?.reel_idea || '',
          hook:              result?.caption?.split('.')[0] || '',
          story:             result?.caption || '',
          key_insights:      '',
          cta:               'Follow for more',
          category:          result?.category || 'Lifestyle',
          duration:          20,
          use_script_scenes: true,
          selected_scenes:   chosen,
        }),
      });
      const d = await r.json();
      if (d.video_b64) {
        const blob = new Blob([Uint8Array.from(atob(d.video_b64), c => c.charCodeAt(0))], { type: 'video/mp4' });
        setVideoUrl(URL.createObjectURL(blob));
        setMsg(d.message || 'Video ready');
      } else setMsg(d.error || 'Generation failed — try again');
    } catch (e) { setMsg('Failed: ' + e.message); }
    finally { setVideoLoading(false); }
  };

  return (
    <div style={{
      marginTop: "1.5rem", borderRadius: "var(--radius)", padding: "2px",
      background: "linear-gradient(135deg, rgba(200,240,104,0.5), rgba(104,184,240,0.4), rgba(176,104,240,0.4))",
      boxShadow: "0 0 40px rgba(200,240,104,0.12)",
    }}>
      <div style={{ background: "linear-gradient(160deg, rgba(14,18,12,0.99), rgba(11,13,15,0.99))", borderRadius: "calc(var(--radius) - 2px)", padding: "1.5rem" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "1.25rem" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "12px", flexShrink: 0, background: "linear-gradient(135deg, rgba(200,240,104,0.2), rgba(104,184,240,0.15))", border: "1px solid rgba(200,240,104,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px" }}>🎬</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text)" }}>AI Video Generation</div>
            <div style={{ fontSize: "12px", color: "var(--text3)", marginTop: "2px" }}>
              {storyboard ? `Select 2-4 scenes → Generate Reel` : 'Generate a storyboard first, then pick your scenes'}
            </div>
          </div>
          {!storyboard && (
            <button onClick={fetchStoryboard} disabled={storyboardLoading}
              style={{ padding: "9px 18px", borderRadius: "100px", cursor: storyboardLoading ? "wait" : "pointer", background: "rgba(200,240,104,0.12)", border: "1px solid rgba(200,240,104,0.35)", color: "var(--accent)", fontSize: "12px", fontWeight: 600, fontFamily: "var(--font-body)", opacity: storyboardLoading ? 0.6 : 1 }}>
              {storyboardLoading ? "⏳ Building..." : "Generate Storyboard →"}
            </button>
          )}
        </div>

        {/* Storyboard scene grid */}
        {storyboard && (
          <div>
            <div style={{ fontSize: "11px", color: "var(--text3)", fontFamily: "var(--font-mono)", marginBottom: "8px" }}>
              Click to select scenes ({selectedScenes.size} selected, max 4) · {storyboard.color_grade} · {storyboard.music_mood}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
              {storyboard.scenes.map(scene => {
                const sel = selectedScenes.has(scene.id);
                return (
                  <div key={scene.id} onClick={() => toggleScene(scene.id)}
                    style={{ padding: "10px 12px", borderRadius: "8px", cursor: "pointer", transition: "all .15s",
                      background: sel ? "rgba(200,240,104,0.08)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${sel ? "rgba(200,240,104,0.4)" : "rgba(255,255,255,0.07)"}`,
                    }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "9px", color: sel ? "var(--accent)" : "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>
                        Scene {scene.id} · {scene.label || scene.shot}
                      </span>
                      {sel && <span style={{ fontSize: "10px", color: "var(--accent)" }}>✓</span>}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text2)", lineHeight: 1.4 }}>{String(scene.action || '').slice(0, 65)}</div>
                    {scene.text_overlay && (
                      <div style={{ fontSize: "10px", color: "var(--gold)", marginTop: "3px", fontStyle: "italic" }}>"{scene.text_overlay}"</div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button onClick={generateVideo} disabled={videoLoading || selectedScenes.size < 2}
                style={{ padding: "9px 18px", borderRadius: "100px", cursor: (videoLoading || selectedScenes.size < 2) ? "not-allowed" : "pointer",
                  background: "rgba(176,104,240,0.15)", border: "1px solid rgba(176,104,240,0.4)",
                  color: "var(--purple)", fontSize: "12px", fontWeight: 600, fontFamily: "var(--font-body)",
                  opacity: (videoLoading || selectedScenes.size < 2) ? 0.5 : 1 }}>
                {videoLoading ? "⏳ Generating..." : videoUrl ? "↻ Regenerate" : `Generate Video (${selectedScenes.size} scenes) →`}
              </button>
              <button onClick={() => { setStoryboard(null); setVideoUrl(null); setMsg(''); }} className="btn btn-ghost btn-sm" style={{ fontSize: "11px" }}>
                ↻ New Storyboard
              </button>
            </div>
          </div>
        )}

        {msg && !videoUrl && (
          <div style={{ fontSize: "11px", color: "var(--accent)", fontFamily: "var(--font-mono)", marginTop: "10px" }}>{msg}</div>
        )}

        {/* Video player */}
        {videoUrl && (
          <div style={{ marginTop: "12px" }}>
            <div style={{ fontSize: "10px", color: "var(--accent)", fontFamily: "var(--font-mono)", textTransform: "uppercase", marginBottom: "8px" }}>✓ Video Ready</div>
            <video src={videoUrl} controls autoPlay loop style={{ width: "100%", maxWidth: "320px", borderRadius: "12px", border: "1px solid rgba(200,240,104,0.3)", display: "block" }} />
            <a href={videoUrl} download="ratefluencer-reel.mp4" style={{ display: "inline-block", marginTop: "8px", fontSize: "12px", color: "var(--accent)", fontFamily: "var(--font-mono)" }}>⬇ Download MP4</a>
          </div>
        )}

      </div>
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
  const [prefs, setPrefs] = useState(null);

  useEffect(() => {
    fetch(config.api.endpoints.agentPreferences)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.has_preferences) setPrefs(d.preferences); })
      .catch(() => {});
  }, [result]);

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

            {/* Agent Reasoning Trail with before/after comparison */}
            {result.content_attempts && result.content_attempts.length > 0 && (() => {
              const attempts = result.content_attempts;
              const first = attempts[0];
              const best  = attempts.reduce((a,b) => b.virality_score > a.virality_score ? b : a, first);
              const improved = best.virality_score > first.virality_score;
              const learnedIter = attempts.find(a => a.learned_applied);
              return (
                <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.25rem", marginBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                    <div style={{ fontSize: "11px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>
                      Agent Reasoning  -  {attempts.length} iterations
                    </div>
                    {improved && (
                      <span style={{ fontSize: "11px", color: "var(--accent)", fontFamily: "var(--font-mono)", padding: "2px 8px", borderRadius: "10px", background: "rgba(200,240,104,0.08)", border: "1px solid rgba(200,240,104,0.2)" }}>
                        Score: {first.virality_score} -> {best.virality_score} (+{best.virality_score - first.virality_score})
                      </span>
                    )}
                  </div>

                  {/* Before / after strip */}
                  {learnedIter && (
                    <div style={{ padding: "8px 12px", background: "rgba(200,240,104,0.04)", border: "1px solid rgba(200,240,104,0.15)", borderRadius: "var(--radius-sm)", marginBottom: "10px", fontSize: "11px" }}>
                      <span style={{ color: "var(--text3)" }}>Baseline (iter 1): </span>
                      <span style={{ color: "var(--coral)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{first.virality_score}</span>
                      <span style={{ color: "var(--text3)", margin: "0 8px" }}>--&gt; After learned prefs (iter {learnedIter.iteration}): </span>
                      <span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{learnedIter.virality_score}</span>
                      <span style={{ color: "var(--text3)", marginLeft: "6px" }}>Tone, hashtag count, and style adjusted from your upvote history.</span>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
                    {attempts.map(attempt => {
                      const isFirst = attempt.iteration === 1;
                      const isBest  = attempt.virality_score === best.virality_score && attempt.iteration === best.iteration;
                      const vColor  = attempt.virality_score >= 68 ? "var(--accent)" : attempt.virality_score >= 50 ? "var(--gold)" : "var(--coral)";
                      return (
                        <div key={attempt.iteration} style={{
                          background: isBest ? "rgba(200,240,104,0.06)" : "var(--bg)",
                          border: `1px solid ${isBest ? "rgba(200,240,104,0.3)" : vColor + "30"}`,
                          borderRadius: "var(--radius-sm)", padding: "10px 14px", minWidth: "150px", position: "relative",
                        }}>
                          {isBest && <div style={{ position: "absolute", top: "4px", right: "6px", fontSize: "8px", color: "var(--accent)", fontFamily: "var(--font-mono)" }}>BEST</div>}
                          <div style={{ fontSize: "10px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", marginBottom: "4px" }}>
                            {isFirst ? "Baseline" : `Iteration ${attempt.iteration}`}
                          </div>
                          <div style={{ fontFamily: "var(--font-display)", fontSize: "22px", color: vColor, lineHeight: 1 }}>
                            {attempt.virality_score}
                          </div>
                          <div style={{ fontSize: "10px", color: "var(--text3)", marginTop: "2px" }}>{attempt.bucket}</div>
                          {attempt.strategy && (
                            <div style={{ fontSize: "9px", color: "var(--blue)", marginTop: "4px", lineHeight: 1.4 }}>
                              {attempt.strategy.slice(0, 48)}
                            </div>
                          )}
                          {attempt.learned_applied && (
                            <div style={{ fontSize: "8px", color: "var(--accent)", marginTop: "3px", fontFamily: "var(--font-mono)" }}>
                              learned prefs applied
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {result.creator_pool && result.creator_pool.length > 0 && (
                    <div style={{ fontSize: "11px", color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
                      Top creators evaluated: {result.creator_pool.map(c => `${c.name} (RF ${c.rf_score})`).join("  .  ")}
                    </div>
                  )}
                </div>
              );
            })()}

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

            {/* Learning Loop Panel */}
            {prefs && (
              <div style={{ marginTop: "12px", padding: "1rem 1.25rem", background: "rgba(200,240,104,0.04)", border: "1px solid rgba(200,240,104,0.2)", borderRadius: "var(--radius)" }}>
                <div style={{ fontSize: "11px", color: "var(--accent)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: "10px" }}>
                  Continuous Learning — Active
                </div>
                <div style={{ fontSize: "12px", color: "var(--text2)", marginBottom: "8px" }}>
                  Based on <strong style={{ color: "var(--accent)" }}>{prefs.upvoted_count} upvotes</strong> · Confidence <strong style={{ color: "var(--accent)" }}>{prefs.confidence}%</strong>
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {[
                    { label: "Preferred Tone", val: prefs.detected_tone },
                    { label: "Avg Hashtags",   val: `~${prefs.avg_hashtags}` },
                    { label: "Avg Virality",   val: prefs.avg_virality },
                  ].map(p => p.val && (
                    <span key={p.label} style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "20px", background: "rgba(200,240,104,0.08)", border: "1px solid rgba(200,240,104,0.2)", color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
                      {p.label}: {p.val}
                    </span>
                  ))}
                </div>
                {prefs.preferred_words?.length > 0 && (
                  <div style={{ fontSize: "11px", color: "var(--text3)", marginTop: "6px" }}>
                    Preferred keywords: {prefs.preferred_words.slice(0, 5).join(", ")}
                  </div>
                )}
              </div>
            )}

            <FeedbackBar result={result} />

            {/* -- Video Generation Card -- */}
            <VideoGeneratorCard result={result} />
          </div>
        )}
      </div>
    </div>
  );
}
