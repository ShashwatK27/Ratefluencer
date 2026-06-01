import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar.jsx";
import { config } from "../config.js";

const DAYS_ORDER = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

function StatCard({ label, value, color, sub }) {
  return (
    <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.25rem" }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "28px", color: color || "var(--accent)", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: "12px", color: "var(--text3)", marginTop: "4px", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</div>
      {sub && <div style={{ fontSize: "11px", color: "var(--text2)", marginTop: "4px" }}>{sub}</div>}
    </div>
  );
}

function BarChart({ data, valueKey, labelKey, color, maxVal }) {
  if (!data || data.length === 0) return null;
  const max = maxVal || Math.max(...data.map(d => d[valueKey]));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {data.map(item => (
        <div key={item[labelKey]} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "80px", fontSize: "12px", color: "var(--text2)", flexShrink: 0, textAlign: "right" }}>
            {item[labelKey]}
          </div>
          <div style={{ flex: 1, height: "20px", borderRadius: "4px", background: "var(--border)", position: "relative" }}>
            <div style={{
              width: `${(item[valueKey] / max) * 100}%`, height: "100%",
              borderRadius: "4px", background: color || "var(--accent)",
              transition: "width .5s ease",
            }} />
          </div>
          <div style={{ width: "40px", fontSize: "11px", fontFamily: "var(--font-mono)", color: color || "var(--accent)", flexShrink: 0 }}>
            {item[valueKey]}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function InsightsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(null);

  useEffect(() => {
    fetch(config.api.endpoints.platformInsights)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const summary = data?.platform_summary || {};
  const catStats = data?.category_stats || [];
  const hourly = (data?.hourly_distribution || []).sort((a, b) => a.hour - b.hour);
  const daily = (data?.daily_distribution || []).sort((a, b) => DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day));

  const displayCat = activeCategory
    ? catStats.find(c => c.category === activeCategory)
    : null;

  return (
    <div style={{ paddingTop: "56px" }}>
      <div className="dashboard-wrap" style={{ display: "grid", gridTemplateColumns: "220px 1fr", minHeight: "calc(100vh - 56px)" }}>
        <Sidebar />

        <main style={{ padding: "2rem", overflowY: "auto" }}>
          <div style={{ maxWidth: "940px" }}>

            <div style={{ marginBottom: "2rem" }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "28px", marginBottom: "4px" }}>
                Real Data Insights
              </h2>
              <p style={{ fontSize: "14px", color: "var(--text2)" }}>
                Patterns from <strong style={{ color: "var(--accent)" }}>{data?.total_posts?.toLocaleString() || "29,999"} real Instagram posts</strong>  -  what actually goes viral
              </p>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: "4rem", color: "var(--text3)" }}>Loading real data...</div>
            ) : (
              <>
                {/* Summary KPIs */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "2rem" }}>
                  <StatCard label="Posts Analysed" value={(data?.total_posts || 29999).toLocaleString()} color="var(--accent)" sub="Real Instagram data" />
                  <StatCard label="Overall Viral Rate" value={`${((summary.overall_viral_rate || 0.25) * 100).toFixed(0)}%`} color="var(--gold)" sub="Viral + High posts" />
                  <StatCard label="Best Format" value={summary.best_media_type || "Reel"} color="var(--blue)" sub="Highest viral rate" />
                  <StatCard label="Best Posting Hour" value={`${summary.best_global_hour || 18}:00`} color="var(--coral)" sub="Peak viral window" />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "2rem" }}>
                  {/* Best posting hours */}
                  <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.5rem" }}>
                    <div className="section-label" style={{ marginBottom: "12px" }}>Viral Posts by Hour</div>
                    <BarChart
                      data={hourly.filter(h => h.count > 0)}
                      valueKey="count"
                      labelKey="hour"
                      color="var(--accent)"
                    />
                  </div>

                  {/* Best days */}
                  <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.5rem" }}>
                    <div className="section-label" style={{ marginBottom: "12px" }}>Viral Posts by Day</div>
                    <BarChart
                      data={daily}
                      valueKey="count"
                      labelKey="day"
                      color="var(--gold)"
                    />
                  </div>
                </div>

                {/* Category breakdown */}
                <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.5rem", marginBottom: "2rem" }}>
                  <div className="section-label" style={{ marginBottom: "12px" }}>Viral Rate by Content Category</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {catStats.map(cat => (
                      <div
                        key={cat.category}
                        onClick={() => setActiveCategory(activeCategory === cat.category ? null : cat.category)}
                        style={{
                          padding: "10px 14px", borderRadius: "var(--radius-sm)", cursor: "pointer",
                          background: activeCategory === cat.category ? "rgba(200,240,104,0.06)" : "var(--bg)",
                          border: `1px solid ${activeCategory === cat.category ? "rgba(200,240,104,0.2)" : "var(--border)"}`,
                          transition: "all .15s",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{ width: "100px", fontSize: "13px", fontWeight: 500, flexShrink: 0 }}>{cat.category}</div>
                          <div style={{ flex: 1, height: "8px", borderRadius: "4px", background: "var(--border)" }}>
                            <div style={{ width: `${cat.viral_rate}%`, height: "100%", borderRadius: "4px", background: cat.viral_rate >= 30 ? "var(--accent)" : cat.viral_rate >= 25 ? "var(--gold)" : "var(--blue)" }} />
                          </div>
                          <div style={{ width: "45px", fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--accent)", flexShrink: 0 }}>{cat.viral_rate}%</div>
                          <div style={{ width: "60px", fontSize: "11px", color: "var(--text3)", flexShrink: 0 }}>{cat.total_posts} posts</div>
                          <span style={{
                            fontSize: "10px", padding: "2px 7px", borderRadius: "4px",
                            fontFamily: "var(--font-mono)", textTransform: "uppercase",
                            background: "var(--border)", color: "var(--text3)", flexShrink: 0,
                          }}>{cat.best_media}</span>
                        </div>

                        {activeCategory === cat.category && (
                          <div style={{ marginTop: "10px", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "8px" }}>
                            {[
                              { label: "Avg Engagement Rate", value: `${cat.avg_engagement_rate}%`, color: "var(--accent)" },
                              { label: "Avg Hashtags", value: cat.avg_hashtags, color: "var(--gold)" },
                              { label: "Best Format", value: cat.best_media, color: "var(--blue)" },
                            ].map(item => (
                              <div key={item.label} style={{ background: "var(--bg)", borderRadius: "var(--radius-sm)", padding: "8px 10px" }}>
                                <div style={{ fontFamily: "var(--font-display)", fontSize: "18px", color: item.color }}>{item.value}</div>
                                <div style={{ fontSize: "10px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", marginTop: "2px" }}>{item.label}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ background: "rgba(200,240,104,0.04)", border: "1px solid rgba(200,240,104,0.12)", borderRadius: "var(--radius)", padding: "1rem 1.5rem", fontSize: "13px", color: "var(--text2)", lineHeight: 1.7 }}>
                  <strong style={{ color: "var(--accent)" }}>How this is used:</strong> Every content generated in Viral Lab is automatically optimised against these benchmarks  -  hashtag count, posting time, and CTA inclusion are calibrated to the best-performing patterns in your content category.
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
