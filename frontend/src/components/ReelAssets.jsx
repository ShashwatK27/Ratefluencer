import React, { useRef, useEffect, useState } from "react";

// ── Voiceover ────────────────────────────────────────────────────────────────
function Voiceover({ script }) {
  const [playing, setPlaying] = useState(false);
  const [supported] = useState(() => "speechSynthesis" in window);
  const uttRef = useRef(null);

  const play = () => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(script);
    utt.rate  = 0.95;
    utt.pitch = 1.05;
    utt.lang  = "en-IN";
    // prefer an English-Indian voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.lang === "en-IN") || voices.find(v => v.lang.startsWith("en")) || null;
    if (preferred) utt.voice = preferred;
    utt.onend = () => setPlaying(false);
    utt.onerror = () => setPlaying(false);
    uttRef.current = utt;
    window.speechSynthesis.speak(utt);
    setPlaying(true);
  };

  const stop = () => {
    window.speechSynthesis.cancel();
    setPlaying(false);
  };

  useEffect(() => () => window.speechSynthesis.cancel(), []);

  if (!supported) return (
    <div style={{ fontSize: "12px", color: "var(--text3)" }}>Voiceover not supported in this browser.</div>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <button
        onClick={playing ? stop : play}
        style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "9px 18px", borderRadius: "100px", fontSize: "13px",
          background: playing ? "rgba(240,120,104,0.12)" : "rgba(200,240,104,0.12)",
          border: `1px solid ${playing ? "rgba(240,120,104,0.3)" : "rgba(200,240,104,0.3)"}`,
          color: playing ? "var(--coral)" : "var(--accent)",
          cursor: "pointer", transition: "all .2s",
        }}
      >
        {playing ? "⏹ Stop" : "🔊 Play Voiceover"}
      </button>
      {playing && (
        <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{
              width: "3px", borderRadius: "2px", background: "var(--accent)",
              animation: `waveBar 0.8s ease-in-out ${i * 0.1}s infinite alternate`,
              height: `${8 + i * 4}px`,
            }} />
          ))}
        </div>
      )}
      <style>{`@keyframes waveBar { from{transform:scaleY(0.4)} to{transform:scaleY(1)} }`}</style>
    </div>
  );
}

// ── Thumbnail ────────────────────────────────────────────────────────────────
function Thumbnail({ reelIdea, category, viralityScore }) {
  const canvasRef = useRef(null);

  const GRADIENTS = {
    Fitness:       ["#1a1a2e","#16213e","#0f3460"],
    Beauty:        ["#1a0a0e","#2d1020","#8B0038"],
    Fashion:       ["#0a0a1a","#1a0a2e","#4a0080"],
    Food:          ["#1a0e0a","#2e1a10","#7a3010"],
    Technology:    ["#0a1a0a","#0a2e1a","#005a2e"],
    Travel:        ["#0a1020","#102040","#003080"],
    default:       ["#0B0D0F","#111417","#1a1c20"],
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = 540, H = 960;
    canvas.width  = W;
    canvas.height = H;

    // Background gradient
    const [c1, c2, c3] = GRADIENTS[category] || GRADIENTS.default;
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, c1);
    bg.addColorStop(0.5, c2);
    bg.addColorStop(1, c3);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Grid overlay
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    // Glow circle
    const glow = ctx.createRadialGradient(W/2, H/2, 50, W/2, H/2, 350);
    glow.addColorStop(0, "rgba(200,240,104,0.12)");
    glow.addColorStop(1, "rgba(200,240,104,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Category pill
    ctx.fillStyle = "rgba(200,240,104,0.15)";
    roundRect(ctx, W/2-60, 80, 120, 32, 16);
    ctx.fill();
    ctx.font = "bold 13px 'DM Mono', monospace";
    ctx.fillStyle = "#C8F068";
    ctx.textAlign = "center";
    ctx.fillText(category.toUpperCase(), W/2, 101);

    // Reel idea text (main hook)
    const hook = reelIdea?.split(".")?.[0] || reelIdea || "Viral Reel Concept";
    ctx.textAlign = "center";
    ctx.fillStyle = "#F0EDE8";
    wrapText(ctx, hook, W/2, 340, W - 80, 52, "bold 36px 'Instrument Serif', serif");

    // Divider line
    ctx.strokeStyle = "rgba(200,240,104,0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W/2-80, 560); ctx.lineTo(W/2+80, 560);
    ctx.stroke();

    // Virality score
    ctx.font = "bold 72px 'Instrument Serif', serif";
    ctx.fillStyle = "#C8F068";
    ctx.textAlign = "center";
    ctx.fillText(viralityScore || "—", W/2, 660);
    ctx.font = "13px 'DM Mono', monospace";
    ctx.fillStyle = "rgba(200,240,104,0.6)";
    ctx.fillText("VIRALITY SCORE", W/2, 685);

    // Ratefluencer watermark
    ctx.font = "bold 15px 'Instrument Serif', serif";
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.textAlign = "center";
    ctx.fillText("Ratefluencer™", W/2, H - 50);

    // Bottom accent line
    const accentLine = ctx.createLinearGradient(0, H-4, W, H-4);
    accentLine.addColorStop(0, "transparent");
    accentLine.addColorStop(0.5, "#C8F068");
    accentLine.addColorStop(1, "transparent");
    ctx.strokeStyle = accentLine;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, H-4); ctx.lineTo(W, H-4); ctx.stroke();

  }, [reelIdea, category, viralityScore]);

  const download = () => {
    const canvas = canvasRef.current;
    const link = document.createElement("a");
    link.download = "reel-thumbnail.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
      <canvas ref={canvasRef} style={{ width: "135px", height: "240px", borderRadius: "10px", border: "1px solid var(--border2)", flexShrink: 0 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ fontSize: "12px", color: "var(--text2)", lineHeight: 1.6 }}>
          Auto-generated 9:16 thumbnail from your reel concept. Download and use directly or customise in Canva.
        </div>
        <button onClick={download} style={{
          padding: "7px 16px", borderRadius: "20px", fontSize: "12px", cursor: "pointer",
          background: "rgba(200,240,104,0.1)", border: "1px solid rgba(200,240,104,0.3)",
          color: "var(--accent)", fontFamily: "var(--font-body)",
        }}>
          ⬇ Download PNG
        </button>
      </div>
    </div>
  );
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y); ctx.arcTo(x+w, y, x+w, y+r, r);
  ctx.lineTo(x+w, y+h-r); ctx.arcTo(x+w, y+h, x+w-r, y+h, r);
  ctx.lineTo(x+r, y+h); ctx.arcTo(x, y+h, x, y+h-r, r);
  ctx.lineTo(x, y+r); ctx.arcTo(x, y, x+r, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxW, lineH, font) {
  ctx.font = font;
  const words = text.split(" ");
  let line = "";
  let curY = y;
  words.forEach((word, i) => {
    const test = line + word + " ";
    if (ctx.measureText(test).width > maxW && i > 0) {
      ctx.fillText(line.trim(), x, curY);
      line = word + " ";
      curY += lineH;
    } else {
      line = test;
    }
  });
  ctx.fillText(line.trim(), x, curY);
}

// ── Subtitles ────────────────────────────────────────────────────────────────
function Subtitles({ script }) {
  const [playing, setPlaying] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const timerRef = useRef(null);

  const WORDS_PER_SEC = 2.5;

  const segments = (() => {
    if (!script) return [];
    const sentences = script.replace(/([.!?])\s*/g, "$1|").split("|").map(s => s.trim()).filter(Boolean);
    let t = 0;
    return sentences.map(text => {
      const words = text.split(" ").length;
      const dur = Math.max(1.5, words / WORDS_PER_SEC);
      const seg = { text, start: t, end: t + dur };
      t += dur;
      return seg;
    });
  })();

  const totalDur = segments.length > 0 ? segments[segments.length-1].end : 0;

  const preview = () => {
    if (playing) { clearInterval(timerRef.current); setPlaying(false); setActiveIdx(-1); return; }
    setPlaying(true);
    let startTime = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const idx = segments.findIndex(s => elapsed >= s.start && elapsed < s.end);
      setActiveIdx(idx);
      if (elapsed >= totalDur) { clearInterval(timerRef.current); setPlaying(false); setActiveIdx(-1); }
    }, 100);
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  const srt = segments.map((s, i) => {
    const fmt = (t) => {
      const h = Math.floor(t/3600), m = Math.floor((t%3600)/60), sec = Math.floor(t%60), ms = Math.floor((t%1)*1000);
      return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")},${String(ms).padStart(3,"0")}`;
    };
    return `${i+1}\n${fmt(s.start)} --> ${fmt(s.end)}\n${s.text}`;
  }).join("\n\n");

  const downloadSrt = () => {
    const blob = new Blob([srt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "reel-subtitles.srt"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Live subtitle preview */}
      <div style={{
        background: "#000", borderRadius: "10px", padding: "2rem 1.5rem",
        minHeight: "80px", display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: "12px", border: "1px solid var(--border)", position: "relative",
      }}>
        <div style={{ position: "absolute", top: "8px", left: "12px", fontSize: "10px", color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-mono)" }}>
          SUBTITLE PREVIEW
        </div>
        {activeIdx >= 0 ? (
          <div style={{
            fontSize: "18px", fontWeight: 600, color: "#fff", textAlign: "center",
            textShadow: "0 2px 8px rgba(0,0,0,0.8)", lineHeight: 1.5,
            padding: "4px 12px", background: "rgba(0,0,0,0.7)", borderRadius: "4px",
            animation: "fadeIn .15s ease",
          }}>
            {segments[activeIdx]?.text}
          </div>
        ) : (
          <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)" }}>
            {playing ? "" : "Press Preview to see subtitles animate"}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button onClick={preview} style={{
          padding: "7px 16px", borderRadius: "20px", fontSize: "12px", cursor: "pointer",
          background: playing ? "rgba(240,120,104,0.1)" : "rgba(104,184,240,0.1)",
          border: `1px solid ${playing ? "rgba(240,120,104,0.3)" : "rgba(104,184,240,0.3)"}`,
          color: playing ? "var(--coral)" : "var(--blue)", fontFamily: "var(--font-body)",
        }}>
          {playing ? "⏹ Stop Preview" : "▶ Preview Subtitles"}
        </button>
        <button onClick={downloadSrt} style={{
          padding: "7px 16px", borderRadius: "20px", fontSize: "12px", cursor: "pointer",
          background: "rgba(200,240,104,0.1)", border: "1px solid rgba(200,240,104,0.3)",
          color: "var(--accent)", fontFamily: "var(--font-body)",
        }}>
          ⬇ Download .SRT
        </button>
      </div>
      <div style={{ fontSize: "11px", color: "var(--text3)", marginTop: "6px" }}>
        {segments.length} segments · ~{Math.round(totalDur)}s total
      </div>
    </div>
  );
}

// ── B-Roll ────────────────────────────────────────────────────────────────────
function BRoll({ script, reelIdea, category }) {
  const keywords = (() => {
    const text = `${reelIdea || ""} ${script || ""} ${category || ""}`.toLowerCase();
    const stopWords = new Set(["the","a","an","and","or","but","in","on","at","to","for","of","with","is","are","was","were","be","been","have","has","had","do","does","did","will","would","could","should","may","might","can","this","that","these","those","it","its","they","their","them","we","our","you","your","i","my","me","he","she","his","her","from","by","as","into","through","during","before","after","above","below","between","out","up","down","just","very","so","if","about","each","more","also","than","then","when","where","how","what","which","who","there","here"]);
    const words = text.match(/\b[a-z]{4,}\b/g) || [];
    const freq = {};
    words.forEach(w => { if (!stopWords.has(w)) freq[w] = (freq[w]||0)+1; });
    return Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([w])=>w);
  })();

  const pexelsUrl = (kw) => `https://www.pexels.com/search/videos/${encodeURIComponent(kw)}/`;

  return (
    <div>
      <div style={{ fontSize: "13px", color: "var(--text2)", marginBottom: "12px", lineHeight: 1.6 }}>
        Keywords extracted from your script — click any to find matching stock footage on Pexels.
      </div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {keywords.map(kw => (
          <a key={kw} href={pexelsUrl(kw)} target="_blank" rel="noreferrer" style={{
            padding: "6px 14px", borderRadius: "20px", fontSize: "12px",
            background: "rgba(104,184,240,0.08)", border: "1px solid rgba(104,184,240,0.25)",
            color: "var(--blue)", textDecoration: "none", fontFamily: "var(--font-mono)",
            transition: "all .2s", display: "flex", alignItems: "center", gap: "5px",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(104,184,240,0.15)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(104,184,240,0.08)"; }}
          >
            🎬 {kw}
          </a>
        ))}
      </div>
      <div style={{ fontSize: "11px", color: "var(--text3)", marginTop: "8px" }}>
        Opens Pexels video search · Free to use stock footage
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
const ASSET_TABS = [
  { id: "voiceover",  icon: "🔊", label: "Voiceover"  },
  { id: "thumbnail",  icon: "🖼️", label: "Thumbnail"  },
  { id: "subtitles",  icon: "💬", label: "Subtitles"  },
  { id: "broll",      icon: "🎬", label: "B-Roll"     },
];

export default function ReelAssets({ result, category }) {
  const [activeTab, setActiveTab] = useState("voiceover");
  if (!result) return null;

  return (
    <div style={{ marginTop: "1.5rem" }}>
      <div style={{
        background: "var(--bg2)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", overflow: "hidden",
      }}>
        {/* Tab bar */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--bg)" }}>
          {ASSET_TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              flex: 1, padding: "12px 8px", fontSize: "12px", fontFamily: "var(--font-body)",
              border: "none", cursor: "pointer", transition: "all .15s",
              background: activeTab === tab.id ? "var(--bg2)" : "transparent",
              color: activeTab === tab.id ? "var(--text)" : "var(--text3)",
              borderBottom: activeTab === tab.id ? "2px solid var(--accent)" : "2px solid transparent",
              display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
            }}>
              <span style={{ fontSize: "16px" }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ padding: "1.5rem" }}>
          {activeTab === "voiceover" && (
            <div>
              <div style={{ fontSize: "11px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", marginBottom: "12px" }}>
                🔊 Script Voiceover — Browser Speech Synthesis
              </div>
              <Voiceover script={result.script || result.reel_idea || ""} />
              <div style={{ marginTop: "12px", padding: "10px 12px", background: "var(--bg)", borderRadius: "var(--radius-sm)", fontSize: "12px", color: "var(--text3)", lineHeight: 1.6 }}>
                Uses your browser's built-in speech engine. For production-quality voiceovers, integrate ElevenLabs API.
              </div>
            </div>
          )}

          {activeTab === "thumbnail" && (
            <div>
              <div style={{ fontSize: "11px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", marginBottom: "12px" }}>
                🖼️ Auto-Generated 9:16 Thumbnail
              </div>
              <Thumbnail reelIdea={result.reel_idea} category={category || "Lifestyle"} viralityScore={result.virality_score} />
            </div>
          )}

          {activeTab === "subtitles" && (
            <div>
              <div style={{ fontSize: "11px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", marginBottom: "12px" }}>
                💬 Auto-Timed Subtitles from Script
              </div>
              <Subtitles script={result.script || result.reel_idea || ""} />
            </div>
          )}

          {activeTab === "broll" && (
            <div>
              <div style={{ fontSize: "11px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", marginBottom: "12px" }}>
                🎬 B-Roll Keywords → Stock Footage
              </div>
              <BRoll script={result.script} reelIdea={result.reel_idea} category={category} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
