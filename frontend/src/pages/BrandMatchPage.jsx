import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { config } from "../config.js";

const GOAL_WEIGHTS = [
  {
    goal: "Brand Awareness",
    weights: [
      { label: "Brand Match", value: 35, color: "var(--accent)" },
      { label: "Engagement", value: 30, color: "var(--blue)" },
      { label: "Growth", value: 20, color: "var(--gold)" },
      { label: "Authenticity", value: 15, color: "var(--coral)" },
    ],
  },
  {
    goal: "Sales / Conversions",
    weights: [
      { label: "Authenticity", value: 35, color: "var(--coral)" },
      { label: "Brand Match", value: 25, color: "var(--accent)" },
      { label: "Engagement", value: 25, color: "var(--blue)" },
      { label: "Growth", value: 15, color: "var(--gold)" },
    ],
  },
  {
    goal: "Niche Targeting",
    weights: [
      { label: "Brand Match", value: 55, color: "var(--accent)" },
      { label: "Engagement", value: 15, color: "var(--blue)" },
      { label: "Authenticity", value: 15, color: "var(--coral)" },
      { label: "Growth", value: 15, color: "var(--gold)" },
    ],
  },
];

export default function BrandMatchPage() {
  const navigate  = useNavigate();
  const [demo,    setDemo]    = useState({ text: '', goal: 'Brand Awareness', category: 'Beauty' });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const runDemo = async () => {
    if (!demo.text.trim()) return;
    setLoading(true); setResults(null);
    try {
      const r = await fetch(config.api.endpoints.match, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_text: demo.text,
          campaign_goal: demo.goal,
          category_filters: [demo.category],
          top_k: 3,
        }),
      });
      const d = await r.json();
      setResults(d.recommendations || []);
    } catch { setResults([]); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ paddingTop: "56px" }}>
      <div style={{ minHeight: "calc(100vh - 56px)" }}>

        <main style={{ padding: "2rem", overflowY: "auto" }}>
          <button onClick={() => navigate("/")} className="btn btn-ghost btn-sm" style={{ fontSize: "13px", marginBottom: "1.5rem" }}>← Home</button>
          <div style={{ maxWidth: "860px" }}>

            <div style={{ marginBottom: "2rem" }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "28px", marginBottom: "4px" }}>
                Brand Match Engine
              </h2>
              <p style={{ fontSize: "14px", color: "var(--text2)" }}>
                SentenceTransformer + ChromaDB  -  semantic similarity matching between campaigns and creators
              </p>
            </div>

            {/* Pipeline */}
            <div style={{
              background: "var(--bg2)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", padding: "1.5rem", marginBottom: "1.5rem",
            }}>
              <div className="section-label" style={{ marginBottom: "16px" }}>RAG Matching Pipeline</div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                {[
                  { step: "1", label: "Campaign Brief", icon: "📋" },
                  { step: "->", label: null, icon: null },
                  { step: "2", label: "Embed via SentenceTransformer", icon: "🧠" },
                  { step: "->", label: null, icon: null },
                  { step: "3", label: "Cosine Search in ChromaDB", icon: "🔍" },
                  { step: "->", label: null, icon: null },
                  { step: "4", label: "Goal-Weighted Re-rank", icon: "⚖️" },
                  { step: "->", label: null, icon: null },
                  { step: "5", label: "Top-K Results", icon: "🏆" },
                ].map((item, i) => (
                  item.label ? (
                    <div key={i} style={{
                      background: "var(--bg)", border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)", padding: "10px 14px",
                      display: "flex", alignItems: "center", gap: "8px",
                    }}>
                      <span style={{
                        width: "20px", height: "20px", borderRadius: "50%",
                        background: "rgba(200,240,104,0.12)", border: "1px solid rgba(200,240,104,0.3)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "10px", color: "var(--accent)", fontFamily: "var(--font-mono)",
                        flexShrink: 0,
                      }}>{item.step}</span>
                      <span style={{ fontSize: "13px" }}>{item.icon}</span>
                      <span style={{ fontSize: "12px", color: "var(--text2)" }}>{item.label}</span>
                    </div>
                  ) : (
                    <span key={i} style={{ color: "var(--text3)", fontSize: "18px" }}>-></span>
                  )
                ))}
              </div>
            </div>

            {/* Goal weights */}
            <div style={{
              background: "var(--bg2)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", padding: "1.5rem", marginBottom: "1.5rem",
            }}>
              <div className="section-label" style={{ marginBottom: "16px" }}>Goal-Aware Scoring Weights</div>
              <p style={{ fontSize: "13px", color: "var(--text2)", marginBottom: "16px", lineHeight: 1.6 }}>
                When you choose a campaign goal, the scoring weights shift automatically to prioritize what matters most for that objective.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {GOAL_WEIGHTS.map(({ goal, weights }) => (
                  <div key={goal} style={{
                    background: "var(--bg)", border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)", padding: "1rem 1.25rem",
                  }}>
                    <div style={{ fontSize: "13px", fontWeight: 500, marginBottom: "10px" }}>{goal}</div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {weights.map(w => (
                        <div key={w.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <div style={{
                            height: "6px", borderRadius: "3px", background: w.color,
                            width: `${w.value * 1.4}px`, flexShrink: 0,
                          }} />
                          <span style={{ fontSize: "12px", color: "var(--text2)" }}>{w.label}</span>
                          <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: w.color }}>{w.value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tech stack */}
            <div style={{
              background: "var(--bg2)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", padding: "1.5rem",
            }}>
              <div className="section-label" style={{ marginBottom: "12px" }}>Technology Stack</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "10px" }}>
                {[
                  { name: "SentenceTransformer", detail: "all-MiniLM-L12-v2  -  fast, high-quality embeddings", icon: "🧠" },
                  { name: "ChromaDB", detail: "Vector store with cosine similarity and metadata filters", icon: "🗄️" },
                  { name: "50,000 Creators", detail: "Indexed in-memory for sub-second search", icon: "👥" },
                  { name: "Cosine Similarity", detail: "Bounded 0-1 similarity metric, stable across embedding spaces", icon: "📐" },
                ].map(item => (
                  <div key={item.name} style={{
                    background: "var(--bg)", border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)", padding: "12px",
                    display: "flex", gap: "10px", alignItems: "flex-start",
                  }}>
                    <span style={{ fontSize: "20px" }}>{item.icon}</span>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 500 }}>{item.name}</div>
                      <div style={{ fontSize: "12px", color: "var(--text3)", marginTop: "2px" }}>{item.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Demo */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', padding: '1.75rem', marginBottom: '1.5rem' }}>
              <div className="section-label" style={{ marginBottom: '12px' }}>Live Demo — Try It Now</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
                <textarea
                  placeholder="Describe your campaign... e.g. 'organic skincare glow serum for Indian women aged 25-34'"
                  value={demo.text}
                  onChange={e => setDemo(d => ({ ...d, text: e.target.value }))}
                  rows={2}
                  style={{ fontSize: '13px', resize: 'vertical' }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select value={demo.goal} onChange={e => setDemo(d => ({ ...d, goal: e.target.value }))} style={{ fontSize: '13px', flex: 1 }}>
                    {['Brand Awareness', 'Sales / Conversions', 'Niche Targeting', 'Community Growth'].map(g => <option key={g}>{g}</option>)}
                  </select>
                  <select value={demo.category} onChange={e => setDemo(d => ({ ...d, category: e.target.value }))} style={{ fontSize: '13px', flex: 1 }}>
                    {['Beauty', 'Fitness', 'Fashion', 'Food', 'Travel', 'Technology', 'Finance', 'Gaming'].map(c => <option key={c}>{c}</option>)}
                  </select>
                  <button className="btn btn-primary btn-sm" onClick={runDemo} disabled={loading || !demo.text.trim()} style={{ flexShrink: 0 }}>
                    {loading ? 'Matching...' : 'Find Creators'}
                  </button>
                </div>
              </div>
              {results && results.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {results.map((rec, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 500 }}>{rec.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>{rec.meta}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                        {[
                          { l: 'BM', v: rec.brandMatch, c: 'var(--accent)' },
                          { l: 'Auth', v: rec.authenticity, c: 'var(--blue)' },
                          { l: 'RF', v: rec.ratefluencer, c: 'var(--gold)' },
                        ].map(s => (
                          <div key={s.l} style={{ textAlign: 'center' }}>
                            <div style={{ color: s.c, fontFamily: 'var(--font-display)', fontSize: '16px' }}>{s.v}</div>
                            <div style={{ color: 'var(--text3)', fontSize: '9px', textTransform: 'uppercase' }}>{s.l}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                    Matched via ChromaDB semantic search + TF-IDF cross-niche scoring
                  </div>
                </div>
              )}
              {results && results.length === 0 && <div style={{ fontSize: '13px', color: 'var(--text3)' }}>No matches found — try different campaign text.</div>}
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
