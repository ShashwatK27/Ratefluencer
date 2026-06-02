import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function PreferencesPage() {
  const navigate = useNavigate();
  const [defaultGoal, setDefaultGoal] = useState("balanced");
  const [defaultBudget, setDefaultBudget] = useState("500000");
  const [minAuth, setMinAuth] = useState("70");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem("ratefluencer_prefs", JSON.stringify({ defaultGoal, defaultBudget, minAuth }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ paddingTop: "56px" }}>
      <div style={{ minHeight: "calc(100vh - 56px)" }}>

        <main style={{ padding: "2rem", overflowY: "auto" }}>
          <button onClick={() => navigate("/")} className="btn btn-ghost btn-sm" style={{ fontSize: "13px", marginBottom: "1.5rem" }}>← Home</button>
          <div style={{ maxWidth: "600px", margin: "0 auto" }}>

            <div style={{ marginBottom: "2rem" }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "28px", marginBottom: "4px" }}>
                Preferences
              </h2>
              <p style={{ fontSize: "14px", color: "var(--text2)" }}>
                Default settings applied to new campaigns
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

              <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.5rem" }}>
                <div className="section-label" style={{ marginBottom: "12px" }}>Campaign Defaults</div>

                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "13px" }}>Default Campaign Goal</label>
                    <select value={defaultGoal} onChange={e => setDefaultGoal(e.target.value)}>
                      <option value="brand_awareness">Brand Awareness</option>
                      <option value="sales">Sales / Conversions</option>
                      <option value="niche_targeting">Niche Targeting</option>
                      <option value="balanced">Balanced</option>
                    </select>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "13px" }}>Default Budget (₹)</label>
                    <input
                      type="number"
                      value={defaultBudget}
                      onChange={e => setDefaultBudget(e.target.value)}
                      placeholder="500000"
                    />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "13px" }}>Minimum Authenticity Score (0-100)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={minAuth}
                      onChange={e => setMinAuth(e.target.value)}
                      placeholder="70"
                    />
                  </div>
                </div>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleSave}
                style={{ alignSelf: "flex-start", padding: "10px 24px" }}
              >
                {saved ? "✓ Saved!" : "Save Preferences"}
              </button>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
