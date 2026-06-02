import React from "react";
import { useNavigate } from "react-router-dom";

const FEATURES = [
  { name: "7-Day Avg Views", type: "Rolling", desc: "Mean views per post over the trailing week" },
  { name: "7-Day Avg Likes", type: "Rolling", desc: "Tracks like velocity to detect content quality trends" },
  { name: "7-Day Avg Comments", type: "Rolling", desc: "Comment rate is a stronger signal than likes for genuine engagement" },
  { name: "7-Day Avg Shares", type: "Rolling", desc: "Shares predict viral amplification potential" },
  { name: "Engagement Rate", type: "Core", desc: "Ratio of total interactions to follower count" },
  { name: "Net Follower Growth", type: "Core", desc: "New followers minus unfollows over the period" },
  { name: "Lag-1 Growth", type: "Lag", desc: "Net growth from 1 day ago  -  captures short-term momentum" },
  { name: "Lag-2 Growth", type: "Lag", desc: "Net growth from 2 days ago  -  smooths noise" },
  { name: "Lag-7 Growth", type: "Lag", desc: "Week-over-week growth comparison" },
  { name: "3-Day Rolling Mean", type: "Rolling", desc: "Short-term smoothed growth for trend detection" },
  { name: "3-Day Rolling Std", type: "Rolling", desc: "Volatility indicator  -  high std = inconsistent posting" },
  { name: "Growth Momentum", type: "Derived", desc: "Lag-1 minus Lag-7, positive = accelerating growth" },
];

const TYPE_COLOR = { Core: "var(--accent)", Rolling: "var(--blue)", Lag: "var(--gold)", Derived: "var(--coral)" };

export default function GrowthEnginePage() {
  const navigate = useNavigate();
  return (
    <div style={{ paddingTop: "56px" }}>
      <div style={{ minHeight: "calc(100vh - 56px)" }}>

        <main style={{ padding: "2rem", overflowY: "auto" }}>
          <button onClick={() => navigate("/")} className="btn btn-ghost btn-sm" style={{ fontSize: "13px", marginBottom: "1.5rem" }}>← Home</button>
          <div style={{ maxWidth: "860px", margin: "0 auto" }}>

            <div style={{ marginBottom: "2rem" }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "28px", marginBottom: "4px" }}>
                Growth Engine
              </h2>
              <p style={{ fontSize: "14px", color: "var(--text2)" }}>
                RandomForest regression  -  forecasts follower growth trajectory for any creator
              </p>
            </div>

            {/* Model stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "2rem" }}>
              {[
                { label: "R² Score", value: "0.896", color: "var(--accent)" },
                { label: "MAE", value: "2.94", color: "var(--gold)" },
                { label: "RMSE", value: "4.12", color: "var(--blue)" },
                { label: "vs Baseline", value: "−38.8%", color: "var(--coral)" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  background: "var(--bg2)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius)", padding: "1.25rem",
                }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "28px", color, lineHeight: 1 }}>{value}</div>
                  <div style={{ fontSize: "12px", color: "var(--text3)", marginTop: "4px", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</div>
                </div>
              ))}
            </div>

            {/* How it works */}
            <div style={{
              background: "var(--bg2)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", padding: "1.5rem", marginBottom: "1.5rem",
            }}>
              <div className="section-label" style={{ marginBottom: "12px" }}>How It Works</div>
              <div style={{ fontSize: "14px", color: "var(--text2)", lineHeight: 1.8 }}>
                The model uses <strong style={{ color: "var(--accent)" }}>RandomForest regression</strong> with{" "}
                <strong style={{ color: "var(--text)" }}>16 time-series features</strong> engineered from raw creator metrics.
                Lag features capture short and long-term growth momentum, while rolling statistics smooth noise.
                Trained with <strong style={{ color: "var(--text)" }}>5-fold cross-validation</strong>, this v2 model
                achieves a <strong style={{ color: "var(--accent)" }}>45% improvement over v1</strong> (MAE: 5.37 -> 2.94).
                Each prediction includes a confidence bound derived from the variance across decision trees.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "12px", marginTop: "1rem" }}>
                {[
                  { label: "v1 MAE", value: "5.37", sub: "Previous model", color: "var(--text3)" },
                  { label: "v2 MAE", value: "2.94", sub: "Current model  -  45% improvement", color: "var(--accent)" },
                ].map(item => (
                  <div key={item.label} style={{
                    background: "var(--bg)", border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)", padding: "1rem",
                  }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: "28px", color: item.color }}>{item.value}</div>
                    <div style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text3)", textTransform: "uppercase", marginTop: "4px" }}>{item.label}</div>
                    <div style={{ fontSize: "12px", color: "var(--text2)", marginTop: "2px" }}>{item.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Feature table */}
            <div style={{
              background: "var(--bg2)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", padding: "1.5rem",
            }}>
              <div className="section-label" style={{ marginBottom: "12px" }}>Feature Engineering</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {FEATURES.map(f => (
                  <div key={f.name} style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    padding: "10px 12px", borderRadius: "var(--radius-sm)",
                    background: "var(--bg)", border: "1px solid var(--border)",
                  }}>
                    <span style={{
                      fontSize: "10px", fontFamily: "var(--font-mono)", textTransform: "uppercase",
                      letterSpacing: ".05em", color: TYPE_COLOR[f.type],
                      border: `1px solid ${TYPE_COLOR[f.type]}40`,
                      borderRadius: "4px", padding: "2px 7px", flexShrink: 0,
                    }}>{f.type}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "13px", fontWeight: 500 }}>{f.name}</div>
                      <div style={{ fontSize: "12px", color: "var(--text3)", marginTop: "2px" }}>{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
