import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { config } from "../config.js";

function CreatorRow({ creator, rank }) {
  const score = creator.influence_score || 70;
  const scoreColor = score >= 85 ? "var(--accent)" : score >= 75 ? "var(--gold)" : "var(--blue)";
  const platformColor = creator.platform === "Instagram" ? "var(--coral)" : "var(--blue)";

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "36px 1fr auto auto auto",
      alignItems: "center", gap: "1rem",
      padding: "10px 14px", borderRadius: "var(--radius-sm)",
      background: "var(--bg)", border: "1px solid var(--border)",
      transition: "all .15s",
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "var(--border2)"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
    >
      <div style={{ fontFamily: "var(--font-display)", fontSize: "18px", color: rank <= 3 ? "var(--gold)" : "var(--text3)", textAlign: "center" }}>
        {rank}
      </div>
      <div>
        <div style={{ fontSize: "14px", fontWeight: 500 }}>{creator.name}</div>
        <div style={{ fontSize: "12px", color: "var(--text3)", marginTop: "1px" }}>{creator.handle}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: "13px", color: "var(--text2)" }}>{creator.followers_str}</div>
        <div style={{ fontSize: "11px", color: "var(--text3)" }}>followers</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: "13px", color: "var(--accent)" }}>{creator.engagement_rate?.toFixed(2)}%</div>
        <div style={{ fontSize: "11px", color: "var(--text3)" }}>eng. rate</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: "20px", color: scoreColor }}>{score}</div>
        <span style={{
          fontSize: "10px", padding: "2px 7px", borderRadius: "4px",
          fontFamily: "var(--font-mono)", textTransform: "uppercase",
          background: `${platformColor}18`, color: platformColor,
          border: `1px solid ${platformColor}30`,
        }}>{creator.platform}</span>
      </div>
    </div>
  );
}

export default function RealCreatorsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("instagram");

  useEffect(() => {
    fetch(config.api.endpoints.realCreators)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const creators = tab === "instagram" ? (data?.instagram || []) : (data?.tiktok || []);

  return (
    <div style={{ paddingTop: "56px" }}>
      <div style={{ minHeight: "calc(100vh - 56px)" }}>

        <main style={{ padding: "2rem", overflowY: "auto" }}>
          <button onClick={() => navigate("/")} className="btn btn-ghost btn-sm" style={{ fontSize: "13px", marginBottom: "1.5rem" }}>← Home</button>
          <div style={{ maxWidth: "860px", margin: "0 auto" }}>

            <div style={{ marginBottom: "2rem" }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "28px", marginBottom: "4px" }}>
                Real World Creators
              </h2>
              <p style={{ fontSize: "14px", color: "var(--text2)" }}>
                Top influencers from real platform data  -  Instagram Top 100 & TikTok 1000
              </p>
            </div>

            {/* Platform tabs */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "1.5rem" }}>
              {[
                { key: "instagram", label: "📸 Instagram Top 20", count: data?.instagram?.length },
                { key: "tiktok",    label: "🎵 TikTok Top 10",    count: data?.tiktok?.length    },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`btn btn-sm ${tab === t.key ? "btn-primary" : "btn-ghost"}`}
                  style={{ fontSize: "13px" }}
                >
                  {t.label} {t.count && `(${t.count})`}
                </button>
              ))}
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: "4rem", color: "var(--text3)" }}>Loading real creator data...</div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {creators.map((c, i) => (
                    <CreatorRow key={c.handle} creator={c} rank={i + 1} />
                  ))}
                </div>

                <div style={{
                  marginTop: "1.5rem", background: "rgba(200,240,104,0.04)",
                  border: "1px solid rgba(200,240,104,0.12)",
                  borderRadius: "var(--radius)", padding: "1rem 1.5rem",
                  fontSize: "13px", color: "var(--text2)", lineHeight: 1.7,
                }}>
                  <strong style={{ color: "var(--accent)" }}>Data source:</strong> Instagram rankings from Top100 influencer dataset. TikTok rankings from platform analytics data (1,000 creators). Influence scores computed from follower count, engagement rate, and posting consistency.
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
