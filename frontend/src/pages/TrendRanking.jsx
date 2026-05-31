import React, { useState } from "react";
import axios from "axios";
import { config } from "../config.js";
import Sidebar from "../components/Sidebar.jsx";

const CATEGORIES = ["General","Fitness","Beauty","Fashion","Technology","Food","Travel","Music","Business","Finance","Gaming","Education"];
const DIMENSIONS = [
  { key: "growth_velocity",     label: "Growth Velocity",     color: "var(--accent)" },
  { key: "engagement_potential",label: "Engagement Potential",color: "var(--blue)"   },
  { key: "novelty",             label: "Novelty",             color: "var(--gold)"   },
  { key: "audience_relevance",  label: "Audience Relevance",  color: "var(--coral)"  },
  { key: "search_interest",     label: "Search Interest",     color: "var(--purple)" },
];

function TrendCard({ trend, rank }) {
  const [expanded, setExpanded] = useState(false);
  const score = trend.trend_score || 0;
  const color = score >= 80 ? "var(--accent)" : score >= 65 ? "var(--gold)" : "var(--blue)";

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className="shine-card"
      style={{
        background: "var(--bg2)", border: `1px solid ${rank === 1 ? "rgba(200,240,104,0.25)" : "var(--border)"}`,
        borderRadius: "var(--radius)", padding: "1.25rem 1.5rem",
        cursor: "pointer", transition: "all .2s",
        background: rank === 1 ? "linear-gradient(135deg,rgba(200,240,104,0.04),var(--bg2))" : "var(--bg2)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: "36px", color: rank === 1 ? "var(--gold)" : "var(--border2)", width: "40px", textAlign: "center", flexShrink: 0 }}>{rank}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ fontSize: "15px", fontWeight: 500 }}>{trend.topic}</span>
            {rank === 1 && <span className="tag tag-green" style={{ fontSize: "10px" }}>🔥 Top Trend</span>}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text2)" }}>{trend.description}</div>
        </div>
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "28px", color, lineHeight: 1 }}>{score}</div>
          <div style={{ fontSize: "10px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>Trend Score</div>
        </div>
      </div>

      {/* Mini bar chart of 5 dimensions */}
      <div style={{ marginTop: "12px", display: "flex", gap: "6px", alignItems: "flex-end", height: "32px" }}>
        {DIMENSIONS.map(dim => {
          const val = trend[dim.key] || 0;
          return (
            <div key={dim.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
              <div style={{ width: "100%", background: "var(--border)", borderRadius: "2px", height: "24px", display: "flex", alignItems: "flex-end" }}>
                <div style={{ width: "100%", height: `${val}%`, background: dim.color, borderRadius: "2px", transition: "height .4s ease", opacity: 0.8 }} />
              </div>
            </div>
          );
        })}
      </div>

      {expanded && (
        <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "8px", marginBottom: "12px" }}>
            {DIMENSIONS.map(dim => (
              <div key={dim.key} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "20px", color: dim.color }}>{trend[dim.key] || 0}</div>
                <div style={{ fontSize: "10px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", lineHeight: 1.3 }}>{dim.label}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text2)", background: "var(--bg)", padding: "10px 12px", borderRadius: "var(--radius-sm)", fontStyle: "italic" }}>
            💡 {trend.why}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrendRanking({ currentPage, onNavigate }) {
  const [category, setCategory] = useState("General");
  const [goal, setGoal] = useState("");
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasRun, setHasRun] = useState(false);

  const fetchTrends = async () => {
    try {
      setLoading(true);
      setError(null);
      const resp = await axios.post(config.api.endpoints.trendRanking, { category, goal });
      setTrends(resp.data.trends || []);
      setHasRun(true);
    } catch (err) {
      setError("Failed to fetch trends. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ paddingTop: "56px" }}>
      <div className="dashboard-wrap" style={{ display: "grid", gridTemplateColumns: "220px 1fr", minHeight: "calc(100vh - 56px)" }}>
        <Sidebar currentPage={currentPage} onNavigate={onNavigate} />

        <main style={{ padding: "2rem", overflowY: "auto" }}>
          <div style={{ maxWidth: "860px" }}>

            <div style={{ marginBottom: "2rem" }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "28px", marginBottom: "4px" }}>Trend Ranking Engine</h2>
              <p style={{ fontSize: "14px", color: "var(--text2)" }}>ML-scored trending topics — ranked on 5 dimensions in real time</p>
            </div>

            {/* Controls */}
            <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.5rem", marginBottom: "1.5rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: "12px", alignItems: "flex-end" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "13px", color: "var(--text2)" }}>Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value)}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "13px", color: "var(--text2)" }}>Campaign goal (optional)</label>
                  <input type="text" value={goal} onChange={e => setGoal(e.target.value)} placeholder="e.g. skincare launch for Gen-Z women" onKeyDown={e => e.key === "Enter" && fetchTrends()} />
                </div>
                <button
                  className="btn btn-primary"
                  onClick={fetchTrends}
                  disabled={loading}
                  style={{ padding: "11px 20px", opacity: loading ? 0.6 : 1 }}
                >
                  {loading ? "Analysing..." : "🔍 Rank Trends"}
                </button>
              </div>

              {/* Dimension legend */}
              <div style={{ display: "flex", gap: "16px", marginTop: "14px", flexWrap: "wrap" }}>
                {DIMENSIONS.map(d => (
                  <div key={d.key} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: d.color }} />
                    <span style={{ fontSize: "11px", color: "var(--text3)", fontFamily: "var(--font-mono)" }}>{d.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div style={{ background: "rgba(240,100,100,0.08)", border: "1px solid rgba(240,100,100,0.2)", borderRadius: "var(--radius)", padding: "1rem", color: "#F06464", fontSize: "13px", marginBottom: "1rem" }}>
                {error}
              </div>
            )}

            {!hasRun && !loading && (
              <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "4rem 2rem", textAlign: "center", color: "var(--text3)" }}>
                <div style={{ fontSize: "40px", marginBottom: "1rem" }}>📊</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "20px", marginBottom: "8px", color: "var(--text)" }}>No trends loaded yet</div>
                <div style={{ fontSize: "14px" }}>Select a category and click Rank Trends to discover what's trending</div>
              </div>
            )}

            {trends.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {trends.map((trend, i) => (
                  <TrendCard key={trend.topic} trend={trend} rank={i + 1} />
                ))}
                <div style={{ fontSize: "11px", color: "var(--text3)", fontFamily: "var(--font-mono)", textAlign: "center", marginTop: "8px" }}>
                  Click any trend to see full dimension breakdown · Scores powered by LLM analysis
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
