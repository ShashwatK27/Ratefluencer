import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar.jsx";

function ScoreBar({ value, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div style={{ flex: 1, height: "4px", borderRadius: "2px", background: "var(--border)" }}>
        <div style={{ width: `${value}%`, height: "100%", borderRadius: "2px", background: color, transition: "width .4s" }} />
      </div>
      <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color, width: "32px", textAlign: "right" }}>{value}</span>
    </div>
  );
}

export default function ShortlistPage() {
  const navigate = useNavigate();
  const [shortlist, setShortlist] = useState([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("ratefluencer_shortlist") || "[]");
      setShortlist(saved);
    } catch {
      setShortlist([]);
    }
  }, []);

  const removeCreator = (name) => {
    const updated = shortlist.filter(c => c.name !== name);
    setShortlist(updated);
    localStorage.setItem("ratefluencer_shortlist", JSON.stringify(updated));
  };

  const clearAll = () => {
    setShortlist([]);
    localStorage.removeItem("ratefluencer_shortlist");
  };

  const exportCSV = () => {
    if (!shortlist.length) return;
    const header = "Name,Handle,Category,Followers,Engagement Rate,Ratefluencer Score,Authenticity,Growth,Brand Match,Success Probability";
    const rows = shortlist.map(c =>
      `"${c.name}","${c.handle || ""}","${c.meta || ""}","","${c.engRate || ""}",${c.ratefluencer || ""},${c.authenticity || ""},${c.growth || ""},${c.brandMatch || ""},"${c.successProb || ""}"`
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ratefluencer_shortlist.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ paddingTop: "56px" }}>
      <div className="dashboard-wrap" style={{ display: "grid", gridTemplateColumns: "220px 1fr", minHeight: "calc(100vh - 56px)" }}>
        <Sidebar />

        <main style={{ padding: "2rem", overflowY: "auto" }}>
          <div style={{ maxWidth: "860px" }}>

            <div style={{ marginBottom: "2rem", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: "28px", marginBottom: "4px" }}>
                  Shortlisted Creators
                </h2>
                <p style={{ fontSize: "14px", color: "var(--text2)" }}>
                  {shortlist.length} creator{shortlist.length !== 1 ? "s" : ""} saved for your campaigns
                </p>
              </div>
              {shortlist.length > 0 && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="btn btn-ghost btn-sm" onClick={exportCSV}>⬇ Export CSV</button>
                  <button className="btn btn-ghost btn-sm" onClick={clearAll} style={{ color: "var(--coral)" }}>✕ Clear All</button>
                </div>
              )}
            </div>

            {shortlist.length === 0 ? (
              <div style={{
                background: "var(--bg2)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", padding: "4rem 2rem",
                textAlign: "center",
              }}>
                <div style={{ fontSize: "48px", marginBottom: "1rem" }}>📋</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "22px", marginBottom: "8px" }}>No creators shortlisted yet</div>
                <div style={{ fontSize: "14px", color: "var(--text2)", marginBottom: "1.5rem" }}>
                  Run a campaign and click "Shortlist" on recommended creators to save them here.
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => navigate("/campaign")}>
                  Start a Campaign
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {shortlist.map(creator => (
                  <div key={creator.name} style={{
                    background: "var(--bg2)", border: "1px solid var(--border)",
                    borderRadius: "var(--radius)", padding: "1.25rem 1.5rem",
                    display: "grid", gridTemplateColumns: "1fr auto",
                    gap: "1.5rem", alignItems: "start",
                  }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                        <span style={{ fontSize: "16px", fontWeight: 500 }}>{creator.name}</span>
                        {creator.badge && (
                          <span className="tag tag-gold" style={{ fontSize: "11px" }}>{creator.badge}</span>
                        )}
                        <span style={{
                          fontSize: "11px", fontFamily: "var(--font-mono)", padding: "2px 8px",
                          borderRadius: "4px", background: "rgba(200,240,104,0.08)",
                          color: "var(--accent)", border: "1px solid rgba(200,240,104,0.15)",
                        }}>
                          {creator.ratefluencer} RF™
                        </span>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text3)", marginBottom: "12px" }}>
                        {creator.meta} {creator.engRate && `· ${creator.engRate} ER`}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "10px" }}>
                        <div>
                          <div style={{ fontSize: "11px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", marginBottom: "4px" }}>Authenticity</div>
                          <ScoreBar value={creator.authenticity || 0} color="var(--blue)" />
                        </div>
                        <div>
                          <div style={{ fontSize: "11px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", marginBottom: "4px" }}>Growth</div>
                          <ScoreBar value={creator.growth || 0} color="var(--gold)" />
                        </div>
                        <div>
                          <div style={{ fontSize: "11px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", marginBottom: "4px" }}>Brand Match</div>
                          <ScoreBar value={creator.brandMatch || 0} color="var(--coral)" />
                        </div>
                      </div>

                      {creator.why && (
                        <div style={{
                          fontSize: "11px", padding: "4px 10px", borderRadius: "20px",
                          background: "rgba(200,240,104,0.08)", color: "var(--accent)",
                          border: "1px solid rgba(200,240,104,0.15)", fontFamily: "var(--font-mono)",
                          marginTop: "10px", display: "inline-block",
                        }}>{creator.why}</div>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end" }}>
                      {creator.successProb && (
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontFamily: "var(--font-display)", fontSize: "22px", color: "var(--accent)" }}>{creator.successProb}</div>
                          <div style={{ fontSize: "10px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>Success Prob.</div>
                        </div>
                      )}
                      <button
                        onClick={() => removeCreator(creator.name)}
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: "11px", color: "var(--text3)" }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
