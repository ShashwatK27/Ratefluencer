import React, { useState } from "react";
import axios from "axios";
import { config } from "../config.js";

const NICHES = ["Beauty","Wellness","Fitness","Food","Fashion","Tech","Travel","Gaming","Finance","Education","Entertainment","Pets","Photography","Music","Comedy","Lifestyle","Sports","Business"];

function MatchCard({ campaign, idx }) {
  const score = campaign.match_score;
  const color = score >= 75 ? "var(--accent)" : score >= 55 ? "var(--gold)" : "var(--blue)";
  const ringOffset = Math.round(201 * (1 - score / 100));

  return (
    <div className="fade-up shine-card" style={{
      background: idx === 0
        ? "linear-gradient(135deg,rgba(200,240,104,0.05),var(--bg2))"
        : "var(--bg2)",
      border: `1px solid ${idx === 0 ? "rgba(200,240,104,0.25)" : "var(--border)"}`,
      borderRadius: "var(--radius)", padding: "1.25rem 1.5rem",
      display: "grid", gridTemplateColumns: "1fr auto",
      gap: "1.5rem", alignItems: "center",
      animationDelay: `${idx * 0.08}s`,
    }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          <span style={{ fontSize: "16px", fontWeight: 600 }}>{campaign.brand}</span>
          {idx === 0 && <span className="tag tag-green" style={{ fontSize: "10px" }}>🎯 Best Match</span>}
          {campaign.is_demo && <span style={{ fontSize: "10px", color: "var(--text3)", fontFamily: "var(--font-mono)", padding: "1px 6px", borderRadius: "4px", background: "var(--bg3)" }}>DEMO</span>}
        </div>
        <div style={{ fontSize: "13px", color: "var(--text2)", marginBottom: "8px" }}>{campaign.name}</div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <span className="tag tag-blue" style={{ fontSize: "11px" }}>{campaign.goal}</span>
          <span className="tag tag-gold" style={{ fontSize: "11px" }}>{campaign.budget_label} budget</span>
          {campaign.categories.slice(0,2).map(c => (
            <span key={c} className="tag tag-green" style={{ fontSize: "11px" }}>{c}</span>
          ))}
        </div>
        <div style={{ marginTop: "8px", fontSize: "11px", color: "var(--accent)", fontFamily: "var(--font-mono)", padding: "3px 10px", borderRadius: "20px", background: "rgba(200,240,104,0.06)", border: "1px solid rgba(200,240,104,0.15)", display: "inline-block" }}>
          ✦ {campaign.why}
        </div>
      </div>

      {/* Match ring */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
        <div style={{ position: "relative", width: "70px", height: "70px" }}>
          <svg viewBox="0 0 70 70" width="70" height="70" style={{ transform: "rotate(-90deg)", position: "absolute", inset: 0 }}>
            <circle cx="35" cy="35" r="28" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
            <circle cx="35" cy="35" r="28" fill="none" stroke={color} strokeWidth="6"
              strokeDasharray="201" strokeDashoffset={ringOffset} strokeLinecap="round" />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "18px", color, lineHeight: 1 }}>{score}%</div>
          </div>
        </div>
        <div style={{ fontSize: "10px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>Match</div>
      </div>
    </div>
  );
}

export default function CreatorCorner({ onNavigate }) {
  const [form, setForm] = useState({
    name: "", handle: "", niche: "Beauty",
    followers: "", engagement_rate: "",
    bio: "",
  });
  const [campaigns, setCampaigns] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.name.trim())        e.name        = "Name is required";
    if (!form.handle.trim())      e.handle      = "Handle is required";
    if (!form.followers.trim())   e.followers   = "Follower count is required";
    if (!form.engagement_rate.trim()) e.engagement_rate = "Engagement rate is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const findCampaigns = async () => {
    if (!validate()) return;
    try {
      setLoading(true);
      setError(null);
      const resp = await axios.post(config.api.endpoints.creatorMatch, {
        handle:          form.handle,
        niche:           form.niche,
        followers:       parseInt(form.followers.replace(/[^0-9]/g, "")) || 10000,
        engagement_rate: parseFloat(form.engagement_rate.replace("%","")) || 3.0,
      });
      setCampaigns(resp.data.campaigns || []);
      setTotal(resp.data.total || 0);
      setSubmitted(true);
    } catch (err) {
      setError("Could not load campaigns. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ paddingTop: "56px", minHeight: "100vh" }}>
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "3rem 2rem" }}>

        <button className="btn btn-ghost btn-sm" onClick={() => onNavigate("landing")} style={{ marginBottom: "1.5rem", fontSize: "13px" }}>
          ← Home
        </button>

        {/* Header */}
        <div style={{ marginBottom: "2.5rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "5px 14px", borderRadius: "20px", border: "1px solid rgba(200,240,104,0.3)", background: "rgba(200,240,104,0.07)", fontSize: "12px", color: "var(--accent)", fontFamily: "var(--font-mono)", marginBottom: "1rem" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent)", animation: "pulse 2s infinite", display: "inline-block" }} />
            Creator Corner
          </div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "36px", marginBottom: "8px" }}>
            Find Brand Campaigns<br />
            <em style={{ color: "var(--accent)", fontStyle: "italic" }}>made for you.</em>
          </h2>
          <p style={{ fontSize: "15px", color: "var(--text2)", maxWidth: "520px", lineHeight: 1.7 }}>
            Enter your creator profile and we'll match you with live brand campaigns that fit your niche, audience size, and engagement.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: submitted ? "380px 1fr" : "1fr", gap: "2rem", alignItems: "flex-start" }}>

          {/* Profile Form */}
          <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.75rem" }}>
            <div className="section-label" style={{ marginBottom: "1.25rem" }}>Your Creator Profile</div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "13px" }}>Full Name</label>
                <input type="text" value={form.name} onChange={e => { set("name", e.target.value); setErrors(p=>({...p,name:""})); }}
                  placeholder="e.g. Priya Sharma"
                  style={errors.name ? { borderColor: "var(--coral)" } : {}} />
                {errors.name && <div style={{ color: "var(--coral)", fontSize: "12px" }}>⚠ {errors.name}</div>}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "13px" }}>Instagram Handle</label>
                <input type="text" value={form.handle} onChange={e => { set("handle", e.target.value); setErrors(p=>({...p,handle:""})); }}
                  placeholder="@yourusername"
                  style={errors.handle ? { borderColor: "var(--coral)" } : {}} />
                {errors.handle && <div style={{ color: "var(--coral)", fontSize: "12px" }}>⚠ {errors.handle}</div>}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "13px" }}>Primary Niche</label>
                <select value={form.niche} onChange={e => set("niche", e.target.value)}>
                  {NICHES.map(n => <option key={n}>{n}</option>)}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "13px" }}>Followers</label>
                  <input type="text" value={form.followers} onChange={e => { set("followers", e.target.value); setErrors(p=>({...p,followers:""})); }}
                    placeholder="e.g. 50000"
                    style={errors.followers ? { borderColor: "var(--coral)" } : {}} />
                  {errors.followers && <div style={{ color: "var(--coral)", fontSize: "12px" }}>⚠ {errors.followers}</div>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "13px" }}>Engagement Rate %</label>
                  <input type="text" value={form.engagement_rate} onChange={e => { set("engagement_rate", e.target.value); setErrors(p=>({...p,engagement_rate:""})); }}
                    placeholder="e.g. 4.5"
                    style={errors.engagement_rate ? { borderColor: "var(--coral)" } : {}} />
                  {errors.engagement_rate && <div style={{ color: "var(--coral)", fontSize: "12px" }}>⚠ {errors.engagement_rate}</div>}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "13px" }}>Bio / Content Description <span style={{ color: "var(--text3)", fontWeight: 400 }}>(optional)</span></label>
                <textarea value={form.bio} onChange={e => set("bio", e.target.value)}
                  placeholder="e.g. Skincare enthusiast, daily routines, product reviews for Indian women..."
                  style={{ minHeight: "70px" }} />
              </div>

              {error && <div style={{ background: "rgba(240,100,100,0.08)", border: "1px solid rgba(240,100,100,0.2)", borderRadius: "var(--radius-sm)", padding: "10px 12px", color: "#F06464", fontSize: "12px" }}>{error}</div>}

              <button
                onClick={findCampaigns}
                disabled={loading}
                className="btn btn-primary"
                style={{ justifyContent: "center", padding: "13px", fontSize: "15px", opacity: loading ? 0.7 : 1 }}
              >
                {loading ? "Finding Campaigns..." : "🎯 Find My Campaigns"}
              </button>
            </div>
          </div>

          {/* Results */}
          {submitted && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "22px", marginBottom: "2px" }}>
                    {campaigns.length > 0 ? `${campaigns.length} Campaigns Match` : "No matches found"}
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--text2)" }}>
                    {campaigns.length > 0
                      ? `Based on your ${form.niche} niche and ${parseInt(form.followers).toLocaleString()} followers`
                      : `Try a different niche or adjust your profile`}
                  </div>
                </div>
                <button onClick={findCampaigns} className="btn btn-ghost btn-sm" style={{ fontSize: "12px" }}>↻ Refresh</button>
              </div>

              {campaigns.length === 0 ? (
                <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "3rem", textAlign: "center" }}>
                  <div style={{ fontSize: "40px", marginBottom: "1rem" }}>🔍</div>
                  <div style={{ fontSize: "14px", color: "var(--text2)" }}>No active campaigns match your profile right now. Check back soon or try a broader niche.</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {campaigns.map((c, i) => (
                    <MatchCard key={c.campaign_id} campaign={c} idx={i} />
                  ))}
                  <div style={{ fontSize: "11px", color: "var(--text3)", fontFamily: "var(--font-mono)", textAlign: "center", marginTop: "4px" }}>
                    Matched from {total} active campaigns · Updates when brands run new campaigns
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
