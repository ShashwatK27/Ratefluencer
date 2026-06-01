import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { config } from "../config.js";

function ScoreArc({ score, color, label, size = 120 }) {
  const r = size / 2 - 10;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: size * 0.25, color, lineHeight: 1 }}>{score}</div>
          <div style={{ fontSize: "9px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>/100</div>
        </div>
      </div>
      <div style={{ fontSize: "12px", color: "var(--text2)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
    </div>
  );
}

function ScoreBar({ label, value, color, desc }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
        <span style={{ fontSize: "13px", fontWeight: 500 }}>{label}</span>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "18px", color }}>{value}</span>
      </div>
      <div style={{ height: "6px", borderRadius: "3px", background: "var(--border)", marginBottom: "6px" }}>
        <div style={{ width: `${value}%`, height: "100%", borderRadius: "3px", background: color, transition: "width .6s ease" }} />
      </div>
      {desc && <div style={{ fontSize: "11px", color: "var(--text3)", lineHeight: 1.5 }}>{desc}</div>}
    </div>
  );
}

// SHAP horizontal bar chart rendered in pure SVG/div -- no external library
function ShapChart({ title, explanations, color }) {
  if (!explanations || explanations.length === 0) return null;
  const maxAbs = Math.max(...explanations.map(e => Math.abs(e.shap_value)), 0.001);
  return (
    <div style={{ marginBottom: "12px" }}>
      <div style={{ fontSize: "10px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "8px" }}>{title}</div>
      {explanations.map((e, i) => {
        const pct   = Math.abs(e.shap_value) / maxAbs * 100;
        const isPos = e.direction === "positive";
        return (
          <div key={i} style={{ marginBottom: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
              <span style={{ fontSize: "11px", color: "var(--text2)" }}>{e.feature}</span>
              <span style={{ fontSize: "10px", color: isPos ? "var(--accent)" : "var(--coral)", fontFamily: "var(--font-mono)" }}>
                {isPos ? "+" : ""}{e.shap_value.toFixed(3)}
              </span>
            </div>
            <div style={{ height: "4px", background: "var(--bg3)", borderRadius: "2px", overflow: "hidden" }}>
              <div style={{
                height: "4px", borderRadius: "2px",
                width: `${pct}%`,
                background: isPos ? "var(--accent)" : "var(--coral)",
                transition: "width .6s ease",
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function CreatorProfile() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const creator   = location.state?.creator;

  const [insights, setInsights] = useState(null);
  const [shap,     setShap]     = useState(null);

  useEffect(() => {
    if (!creator?.cat) return;
    fetch(`${config.api.endpoints.platformInsights}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const catStat = (data.category_stats || []).find(
          c => c.category.toLowerCase() === (creator.cat || '').toLowerCase()
        ) || data.category_stats?.[0];
        setInsights({ catStat, hourly: data.hourly_distribution, daily: data.daily_distribution });
      })
      .catch(() => {});
  }, [creator]);

  // Fetch SHAP feature explanations for this creator
  useEffect(() => {
    if (!creator?.id) return;
    fetch(config.api.endpoints.explain, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creator_id: creator.id }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.shap_available) setShap(d); })
      .catch(() => {});
  }, [creator]);

  if (!creator) {
    return (
      <div style={{ paddingTop: "56px", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
        <div style={{ fontSize: "32px" }}>👤</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: "20px" }}>No creator selected</div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  const viralityScore = creator.score || 72;
  const authScore     = creator.auth  || 80;
  const growthScore   = creator.growth || 75;
  const erVal         = parseFloat(creator.er) || 4.2;

  const viralColor  = viralityScore >= 80 ? "var(--accent)" : viralityScore >= 65 ? "var(--gold)" : "var(--coral)";
  const tier        = creator.tier || "A";
  const tierLabel   = tier === "S" ? "Elite Creator" : tier === "A" ? "Top Creator" : "Rising Creator";

  const bestHours = insights?.hourly?.sort((a, b) => b.count - a.count).slice(0, 3).map(h => `${h.hour}:00`) || ["18:00", "12:00", "20:00"];
  const bestDays  = insights?.daily?.sort((a, b) => b.count - a.count).slice(0, 3).map(d => d.day) || ["Wednesday", "Friday", "Saturday"];
  const viralRate = insights?.catStat?.viral_rate || 50;
  const avgER     = insights?.catStat?.avg_engagement_rate || 4.2;

  const tips = [
    erVal >= avgER
      ? `✓ Your ${erVal.toFixed(1)}% engagement rate beats the ${creator.cat} average of ${avgER}%`
      : `^ Your engagement (${erVal.toFixed(1)}%) is below the ${creator.cat} average (${avgER}%). Post more consistently.`,
    authScore >= 85
      ? "✓ Authenticity score is strong  -  your audience is organic and genuine"
      : "^ Improve authenticity: reduce hashtag stuffing and avoid engagement pods",
    growthScore >= 80
      ? "✓ Strong growth trajectory  -  your follower momentum is positive"
      : "^ Post during peak hours to accelerate growth",
    `^ Best time to post: ${bestHours[0]} on ${bestDays[0]} for maximum ${creator.cat} reach`,
  ];

  return (
    <div style={{ paddingTop: "56px", minHeight: "100vh" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "3rem 2rem" }}>

        <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm" style={{ marginBottom: "2rem", fontSize: "13px" }}>
          ← Back
        </button>

        {/* Header */}
        <div className="fade-up" style={{
          background: "var(--bg2)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: "2rem",
          display: "flex", alignItems: "center", gap: "1.5rem",
          marginBottom: "1.5rem",
        }}>
          <div style={{
            width: "72px", height: "72px", borderRadius: "50%", flexShrink: 0,
            background: creator.c1 || "rgba(200,240,104,0.12)",
            color: creator.c2 || "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 700,
            border: `2px solid ${creator.c2 || "rgba(200,240,104,0.3)"}30`,
          }}>
            {creator.av || creator.name?.slice(0,2).toUpperCase()}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "26px" }}>{creator.name}</h2>
              <span className={`tag ${tier === "S" ? "tag-green" : tier === "A" ? "tag-blue" : "tag-gold"}`}>
                {tierLabel}
              </span>
              {creator.real && (
                <span style={{ fontSize: "10px", background: "rgba(200,240,104,0.08)", color: "var(--accent)", border: "1px solid rgba(200,240,104,0.2)", padding: "2px 7px", borderRadius: "4px", fontFamily: "var(--font-mono)" }}>
                  REAL
                </span>
              )}
            </div>
            <div style={{ fontSize: "14px", color: "var(--text3)", marginBottom: "8px" }}>
              {creator.handle} . {creator.cat} . {creator.followers} followers
            </div>
            <div style={{ display: "flex", gap: "16px" }}>
              <span style={{ fontSize: "13px", color: "var(--accent)" }}>{creator.er} Engagement Rate</span>
              <span style={{ fontSize: "13px", color: "var(--text3)" }}>Instagram</span>
            </div>
          </div>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate("/viral-lab")}
            style={{ flexShrink: 0 }}
          >
            🚀 Generate Content
          </button>
        </div>

        {/* Score arcs */}
        <div className="fade-up delay-1" style={{
          background: "var(--bg2)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: "2rem",
          display: "flex", justifyContent: "space-around", alignItems: "center",
          marginBottom: "1.5rem",
        }}>
          <ScoreArc score={viralityScore} color={viralColor}   label="Virality Score" size={130} />
          <ScoreArc score={authScore}     color="var(--blue)"  label="Authenticity"   size={110} />
          <ScoreArc score={growthScore}   color="var(--gold)"  label="Growth"         size={110} />
          <ScoreArc score={Math.min(99, Math.round(erVal * 8))} color="var(--coral)" label="Engagement" size={110} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "1.5rem" }}>

          {/* Score breakdown */}
          <div className="fade-up delay-2" style={{
            background: "var(--bg2)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", padding: "1.5rem",
          }}>
            <div className="section-label" style={{ marginBottom: "16px" }}>Score Breakdown</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <ScoreBar label="Virality Score"  value={viralityScore} color={viralColor}      desc="Overall predicted viral potential" />
              <ScoreBar label="Authenticity"    value={authScore}     color="var(--blue)"     desc="Organic audience quality" />
              <ScoreBar label="Growth Momentum" value={growthScore}   color="var(--gold)"     desc="Follower growth trajectory" />
              <ScoreBar label="Engagement"      value={Math.min(99, Math.round(erVal * 8))} color="var(--coral)" desc={`${erVal.toFixed(1)}% engagement rate`} />
            </div>
          </div>

          {/* Optimal posting times */}
          <div className="fade-up delay-2" style={{
            background: "var(--bg2)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", padding: "1.5rem",
          }}>
            <div className="section-label" style={{ marginBottom: "16px" }}>Optimal Posting Times</div>
            <div style={{ fontSize: "13px", color: "var(--text2)", marginBottom: "16px", lineHeight: 1.6 }}>
              Based on <strong style={{ color: "var(--accent)" }}>30,000 real Instagram posts</strong> in the {creator.cat} category:
            </div>

            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "11px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", marginBottom: "8px" }}>Best Hours</div>
              <div style={{ display: "flex", gap: "8px" }}>
                {bestHours.map((h, i) => (
                  <div key={h} style={{
                    padding: "6px 14px", borderRadius: "8px",
                    background: i === 0 ? "rgba(200,240,104,0.1)" : "var(--bg)",
                    border: `1px solid ${i === 0 ? "rgba(200,240,104,0.3)" : "var(--border)"}`,
                    fontFamily: "var(--font-mono)", fontSize: "14px",
                    color: i === 0 ? "var(--accent)" : "var(--text2)",
                  }}>{h}</div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "11px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", marginBottom: "8px" }}>Best Days</div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {bestDays.map((d, i) => (
                  <div key={d} style={{
                    padding: "5px 12px", borderRadius: "8px",
                    background: i === 0 ? "rgba(200,240,104,0.1)" : "var(--bg)",
                    border: `1px solid ${i === 0 ? "rgba(200,240,104,0.3)" : "var(--border)"}`,
                    fontSize: "13px",
                    color: i === 0 ? "var(--accent)" : "var(--text2)",
                  }}>{d}</div>
                ))}
              </div>
            </div>

            <div style={{
              padding: "10px 14px", borderRadius: "var(--radius-sm)",
              background: "rgba(200,240,104,0.05)", border: "1px solid rgba(200,240,104,0.15)",
              fontSize: "13px", color: "var(--text2)",
            }}>
              🔥 Viral rate in <strong style={{ color: "var(--text)" }}>{creator.cat}</strong>: <strong style={{ color: "var(--accent)" }}>{viralRate}%</strong> of posts go viral
            </div>
          </div>
        </div>

        {/* SHAP Feature Importance */}
        {shap && (
          <div className="fade-up delay-3" style={{
            background: "var(--bg2)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", padding: "1.5rem", marginBottom: "1.5rem",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div className="section-label">AI Explainability (SHAP)</div>
              <span style={{ fontSize: "10px", color: "var(--text3)", fontFamily: "var(--font-mono)", padding: "2px 8px", borderRadius: "10px", background: "var(--bg3)", border: "1px solid var(--border)" }}>
                XGBoost TreeExplainer
              </span>
            </div>
            <div style={{ fontSize: "12px", color: "var(--text3)", marginBottom: "14px", lineHeight: 1.6 }}>
              Feature contributions to this creator's scores. Green bars push the score <strong style={{ color: "var(--accent)" }}>higher</strong>, red bars push it <strong style={{ color: "var(--coral)" }}>lower</strong>.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
              <ShapChart
                title="Authenticity Model"
                explanations={shap.authenticity_explanation?.slice(0, 5)}
                color="var(--blue)"
              />
              <ShapChart
                title="Growth Model"
                explanations={shap.growth_explanation?.slice(0, 5)}
                color="var(--gold)"
              />
            </div>
          </div>
        )}

        {/* Audience Demographics */}
        {creator.demographics && (
          <div className="fade-up delay-3" style={{
            background: "var(--bg2)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", padding: "1.5rem", marginBottom: "1.5rem",
          }}>
            <div className="section-label" style={{ marginBottom: "16px" }}>Audience Demographics</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>

              {/* Age groups */}
              <div>
                <div style={{ fontSize: "11px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", marginBottom: "10px" }}>Age Groups</div>
                {creator.demographics.age_groups.map(ag => (
                  <div key={ag.label} style={{ marginBottom: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                      <span style={{ fontSize: "12px", color: "var(--text2)" }}>{ag.label}</span>
                      <span style={{ fontSize: "12px", color: "var(--accent)", fontFamily: "var(--font-mono)" }}>{ag.pct}%</span>
                    </div>
                    <div style={{ height: "4px", background: "var(--bg3)", borderRadius: "2px", overflow: "hidden" }}>
                      <div style={{ height: "4px", background: "var(--accent)", width: `${ag.pct}%`, borderRadius: "2px", transition: "width .6s ease" }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Gender split */}
              <div>
                <div style={{ fontSize: "11px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", marginBottom: "10px" }}>Gender Split</div>
                <div style={{ marginBottom: "10px" }}>
                  {[
                    { label: "Female", pct: creator.demographics.gender.female, color: "var(--coral)" },
                    { label: "Male",   pct: creator.demographics.gender.male,   color: "var(--blue)" },
                  ].map(g => (
                    <div key={g.label} style={{ marginBottom: "10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                        <span style={{ fontSize: "12px", color: "var(--text2)" }}>{g.label}</span>
                        <span style={{ fontSize: "12px", color: g.color, fontFamily: "var(--font-mono)" }}>{g.pct}%</span>
                      </div>
                      <div style={{ height: "4px", background: "var(--bg3)", borderRadius: "2px", overflow: "hidden" }}>
                        <div style={{ height: "4px", background: g.color, width: `${g.pct}%`, borderRadius: "2px", transition: "width .6s ease" }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: "10px 14px", borderRadius: "var(--radius-sm)", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", fontSize: "12px", color: "var(--text2)", lineHeight: 1.6 }}>
                  <strong style={{ color: "var(--text)" }}>Primary audience:</strong> {creator.demographics.primary_age} . {creator.demographics.primary_gender}-dominant
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Improvement tips */}
        <div className="fade-up delay-3" style={{
          background: "var(--bg2)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: "1.5rem", marginBottom: "1.5rem",
        }}>
          <div className="section-label" style={{ marginBottom: "12px" }}>AI Recommendations to Go Viral</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {tips.map((tip, i) => (
              <div key={i} style={{
                display: "flex", gap: "10px", alignItems: "flex-start",
                padding: "10px 14px", borderRadius: "var(--radius-sm)",
                background: tip.startsWith("✓") ? "rgba(200,240,104,0.05)" : "var(--bg)",
                border: `1px solid ${tip.startsWith("✓") ? "rgba(200,240,104,0.15)" : "var(--border)"}`,
              }}>
                <span style={{ fontSize: "14px", flexShrink: 0 }}>{tip.startsWith("✓") ? "✅" : "💡"}</span>
                <span style={{ fontSize: "13px", color: tip.startsWith("✓") ? "var(--accent)" : "var(--text2)", lineHeight: 1.6 }}>
                  {tip.replace(/^[✓^]\s/, "")}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="fade-up delay-4" style={{ display: "flex", gap: "12px" }}>
          <button
            className="btn btn-primary"
            onClick={() => navigate("/viral-lab")}
            style={{ flex: 1, justifyContent: "center", padding: "14px" }}
          >
            🚀 Generate Viral Content for {creator.cat}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => navigate("/ai-agent")}
            style={{ flex: 1, justifyContent: "center", padding: "14px" }}
          >
            🤖 Run AI Agent for My Niche
          </button>
        </div>

      </div>
    </div>
  );
}
