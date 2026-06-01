import React from "react";
import { useNavigate } from "react-router-dom";

const FEATURES = [
  { name: "Follower / Following Ratio", weight: "High", desc: "Bots often follow thousands but have few followers back" },
  { name: "Posting Frequency", weight: "High", desc: "Abnormal burst posting is a strong bot signal" },
  { name: "Engagement Rate", weight: "High", desc: "Fake accounts have near-zero organic engagement" },
  { name: "Profile Image Present", weight: "Medium", desc: "Many bot accounts use default or stolen profile pictures" },
  { name: "Link in Bio", weight: "Medium", desc: "Spam accounts often use suspicious redirect links" },
  { name: "Hashtag Count per Post", weight: "Medium", desc: "Excessive hashtags (30+) indicate engagement manipulation" },
  { name: "Description Changes", weight: "Medium", desc: "Frequent bio changes correlate with account recycling" },
  { name: "Content Similarity Score", weight: "Medium", desc: "Copy-paste content across accounts signals inauthentic networks" },
  { name: "Early Registration Signal", weight: "Low", desc: "Aged accounts with no early activity are suspicious" },
  { name: "Clickbait Level", weight: "Low", desc: "Sensational language correlates with low-quality accounts" },
];

const THRESHOLDS = [
  { name: "Balanced", value: "0.50", desc: "Maximizes F1 score across both classes. Best for general use.", color: "var(--accent)" },
  { name: "Optimal F1", value: "0.58", desc: "Prioritizes catching fakes even at cost of some false positives.", color: "var(--gold)" },
  { name: "High Precision", value: "0.72", desc: "Only flags clear-cut fakes. Minimizes false accusations.", color: "var(--blue)" },
];

const WEIGHT_COLOR = { High: "var(--coral)", Medium: "var(--gold)", Low: "var(--blue)" };

export default function AuthenticityPage() {
  const navigate = useNavigate();
  return (
    <div style={{ paddingTop: "56px" }}>
      <div style={{ minHeight: "calc(100vh - 56px)" }}>

        <main style={{ padding: "2rem", overflowY: "auto" }}>
          <button onClick={() => navigate("/")} className="btn btn-ghost btn-sm" style={{ fontSize: "13px", marginBottom: "1.5rem" }}>← Home</button>
          <div style={{ maxWidth: "860px" }}>

            <div style={{ marginBottom: "2rem" }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "28px", marginBottom: "4px" }}>
                Authenticity Detector
              </h2>
              <p style={{ fontSize: "14px", color: "var(--text2)" }}>
                XGBoost binary classifier  -  flags fake accounts before you spend budget on them
              </p>
            </div>

            {/* Model stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "2rem" }}>
              {[
                { label: "Accuracy", value: "93.0%", color: "var(--accent)" },
                { label: "F1 Score", value: "93.38%", color: "var(--gold)" },
                { label: "AUC-ROC", value: "98.25%", color: "var(--blue)" },
                { label: "False Positive Reduction", value: "−31%", color: "var(--coral)" },
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
                The model evaluates <strong style={{ color: "var(--text)" }}>16 behavioural and structural signals</strong> for each creator.
                It uses <strong style={{ color: "var(--accent)" }}>XGBoost gradient boosting</strong> trained on a labelled dataset of authentic vs fake accounts,
                with <strong style={{ color: "var(--text)" }}>stratified 5-fold cross-validation</strong> to prevent overfitting.
                Three decision thresholds are available depending on how aggressively you want to filter:
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "1rem", flexWrap: "wrap" }}>
                {THRESHOLDS.map(t => (
                  <div key={t.name} style={{
                    flex: 1, minWidth: "180px",
                    background: "var(--bg)", border: `1px solid ${t.color}30`,
                    borderRadius: "var(--radius-sm)", padding: "1rem",
                  }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: t.color, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: "4px" }}>{t.name}</div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: "24px", color: t.color }}>{t.value}</div>
                    <div style={{ fontSize: "12px", color: "var(--text3)", marginTop: "4px", lineHeight: 1.5 }}>{t.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Feature table */}
            <div style={{
              background: "var(--bg2)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", padding: "1.5rem",
            }}>
              <div className="section-label" style={{ marginBottom: "12px" }}>Top Predictive Features</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {FEATURES.map(f => (
                  <div key={f.name} style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    padding: "10px 12px", borderRadius: "var(--radius-sm)",
                    background: "var(--bg)", border: "1px solid var(--border)",
                  }}>
                    <span style={{
                      fontSize: "10px", fontFamily: "var(--font-mono)", textTransform: "uppercase",
                      letterSpacing: ".05em", color: WEIGHT_COLOR[f.weight],
                      border: `1px solid ${WEIGHT_COLOR[f.weight]}40`,
                      borderRadius: "4px", padding: "2px 7px", flexShrink: 0,
                    }}>{f.weight}</span>
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
