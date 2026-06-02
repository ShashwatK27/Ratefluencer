import React, { useRef, useEffect, useState } from "react";
import axios from "axios";
import { config } from "../config.js";

// -- Voiceover ----------------------------------------------------------------
const VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella",   desc: "Warm female" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam",    desc: "Clear male"  },
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel",  desc: "Professional female" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi",    desc: "Strong female" },
];

function Voiceover({ script }) {
  const [playing, setPlaying]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [voiceId, setVoiceId]     = useState(VOICES[0].id);
  const [error, setError]         = useState(null);
  const [charsUsed, setCharsUsed] = useState(null);
  const audioRef = useRef(null);

  const playElevenLabs = async () => {
    try {
      setLoading(true);
      setError(null);
      const resp = await axios.post(config.api.endpoints.voiceover, {
        text: script?.slice(0, 800) || "",
        voice_id: voiceId,
      });

      const { audio_base64, content_type, chars_used } = resp.data;
      const binary = atob(audio_base64);
      const bytes  = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: content_type });
      const url  = URL.createObjectURL(blob);

      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended  = () => setPlaying(false);
      audio.onerror  = () => { setPlaying(false); setError("Playback error"); };
      await audio.play();
      setPlaying(true);
      setCharsUsed(chars_used);
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      if (msg?.includes("ELEVENLABS_API_KEY not set")) {
        setError("Add ELEVENLABS_API_KEY to backend/.env and restart the backend.");
      } else {
        setError(msg || "ElevenLabs request failed");
      }
      // Fallback to browser TTS
      browserFallback();
    } finally {
      setLoading(false);
    }
  };

  const browserFallback = () => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(script?.slice(0, 800) || "");
    utt.rate = 0.95; utt.lang = "en-IN";
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find(v => v.lang === "en-IN") || voices.find(v => v.lang.startsWith("en"));
    if (v) utt.voice = v;
    utt.onend   = () => setPlaying(false);
    utt.onerror = () => setPlaying(false);
    window.speechSynthesis.speak(utt);
    setPlaying(true);
  };

  const stop = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    window.speechSynthesis?.cancel();
    setPlaying(false);
  };

  useEffect(() => () => {
    stop();
    if (audioRef.current) URL.revokeObjectURL(audioRef.current.src);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

      {/* Voice selector */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {VOICES.map(v => (
          <button key={v.id} onClick={() => setVoiceId(v.id)} style={{
            padding: "5px 12px", borderRadius: "20px", fontSize: "12px", cursor: "pointer",
            border: voiceId === v.id ? "1px solid var(--accent)" : "1px solid var(--border)",
            background: voiceId === v.id ? "rgba(200,240,104,0.1)" : "transparent",
            color: voiceId === v.id ? "var(--accent)" : "var(--text2)",
            fontFamily: "var(--font-body)",
          }}>
            {v.name} <span style={{ color: "var(--text3)", fontSize: "10px" }}>. {v.desc}</span>
          </button>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <button
          onClick={playing ? stop : playElevenLabs}
          disabled={loading}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "10px 20px", borderRadius: "100px", fontSize: "13px",
            background: playing ? "rgba(240,120,104,0.12)" : "rgba(200,240,104,0.12)",
            border: `1px solid ${playing ? "rgba(240,120,104,0.3)" : "rgba(200,240,104,0.3)"}`,
            color: playing ? "var(--coral)" : "var(--accent)",
            cursor: loading ? "wait" : "pointer", transition: "all .2s",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "⏳ Generating..." : playing ? "⏹ Stop" : "🎙️ Play with ElevenLabs"}
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

        {charsUsed && !playing && (
          <span style={{ fontSize: "11px", color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
            {charsUsed} chars used
          </span>
        )}
      </div>

      {error && (
        <div style={{ fontSize: "12px", color: "var(--coral)", padding: "8px 12px", background: "rgba(240,120,104,0.08)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(240,120,104,0.2)" }}>
          ⚠ {error}
          {error.includes("ELEVENLABS") && (
            <div style={{ marginTop: "4px", color: "var(--text3)" }}>
              Using browser speech as fallback.
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: "11px", color: "var(--text3)", lineHeight: 1.6 }}>
        Powered by ElevenLabs . <strong style={{ color: "var(--text2)" }}>eleven_multilingual_v2</strong> model . Free tier: 10K chars/month
      </div>
      <style>{`@keyframes waveBar { from{transform:scaleY(0.4)} to{transform:scaleY(1)} } @keyframes spin { to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}

// -- Thumbnail ----------------------------------------------------------------
const ACCENT = {
  Beauty: "#F07898", Fitness: "#38BDF8", Fashion: "#B57BFF", Food: "#F97316",
  Travel: "#06B6D4", Technology: "#4ADE80", Gaming: "#A855F7", Finance: "#10B981",
  Wellness: "#34D399", Lifestyle: "#C8F068", default: "#C8F068",
};

function Thumbnail({ reelIdea, category, viralityScore }) {
  const canvasRef = useRef(null);
  const [generating, setGenerating] = useState(false);
  const [imgLoaded,  setImgLoaded]  = useState(false);

  const THEMES = {
    Beauty:     { bg: ["#1a0612","#2d0a22","#1a0612"], accent: "#F07898", accent2: "#FFB6C1", icon: "✦" },
    Fitness:    { bg: ["#030d1a","#061a30","#0a2040"], accent: "#38BDF8", accent2: "#7DD3FC", icon: "◈" },
    Fashion:    { bg: ["#0d0a1a","#1a0d30","#0d0a1a"], accent: "#B57BFF", accent2: "#DDB6FF", icon: "◆" },
    Food:       { bg: ["#1a0a00","#2d1400","#1a0a00"], accent: "#F97316", accent2: "#FED7AA", icon: "◉" },
    Travel:     { bg: ["#000d1a","#001a2e","#000d1a"], accent: "#06B6D4", accent2: "#A5F3FC", icon: "◎" },
    Technology: { bg: ["#030d03","#061a06","#030d03"], accent: "#4ADE80", accent2: "#BBF7D0", icon: "◈" },
    Gaming:     { bg: ["#0d0014","#1a0028","#0d0014"], accent: "#A855F7", accent2: "#D8B4FE", icon: "◆" },
    Finance:    { bg: ["#001a0d","#002d1a","#001a0d"], accent: "#10B981", accent2: "#6EE7B7", icon: "◉" },
    Wellness:   { bg: ["#001a14","#002d22","#001a14"], accent: "#34D399", accent2: "#A7F3D0", icon: "✦" },
    Lifestyle:  { bg: ["#0B0D0F","#111820","#0B0D0F"], accent: "#C8F068", accent2: "#E8FFB0", icon: "◎" },
    default:    { bg: ["#0B0D0F","#111820","#0B0D0F"], accent: "#C8F068", accent2: "#E8FFB0", icon: "◎" },
  };

  const drawOverlay = (ctx, W, H, imgLoaded) => {
    const accent = ACCENT[category] || ACCENT.default;
    const score  = viralityScore || 0;

    if (!imgLoaded) {
      // Fallback gradient background
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, "#0B0D0F"); bg.addColorStop(1, "#1a1c20");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    }

    // Dark gradient over bottom 40% (text legibility)
    const shade = ctx.createLinearGradient(0, H * 0.5, 0, H);
    shade.addColorStop(0, "rgba(0,0,0,0)");
    shade.addColorStop(0.4, "rgba(0,0,0,0.65)");
    shade.addColorStop(1,   "rgba(0,0,0,0.9)");
    ctx.fillStyle = shade; ctx.fillRect(0, H * 0.5, W, H * 0.5);

    // Thin top strip
    ctx.fillStyle = accent + "30";
    ctx.fillRect(0, 0, W, 56);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 52, W, 3);

    // Category pill
    ctx.font = "bold 12px 'DM Mono', monospace";
    ctx.fillStyle = accent; ctx.textAlign = "left";
    ctx.fillText(category.toUpperCase(), 22, 34);

    // Virality score top-right
    ctx.font = "bold 13px 'DM Mono', monospace";
    ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.textAlign = "right";
    ctx.fillText("VIRAL", W - 22, 28);
    ctx.font = `bold 22px Georgia, serif`;
    ctx.fillStyle = score >= 80 ? accent : score >= 60 ? "#F0C868" : "#F07868";
    ctx.fillText(score, W - 22, 50);

    // Main hook text (large, bottom portion)
    const hook = (reelIdea || "Viral Reel Concept").split(".")[0];
    ctx.textAlign = "left"; ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 12;
    wrapText(ctx, hook, 28, H - 180, W - 56, 50, "bold 34px Georgia, 'Instrument Serif', serif");
    ctx.shadowBlur = 0;

    // Bottom brand bar
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, H - 64, W, 64);
    ctx.fillStyle = accent; ctx.fillRect(0, H - 64, W, 2);

    ctx.font = "bold 15px Georgia, serif";
    ctx.fillStyle = "#fff"; ctx.textAlign = "left";
    ctx.fillText("Ratefluencer", 22, H - 30);
    ctx.font = "11px 'DM Mono', monospace";
    ctx.fillStyle = accent;
    const rw = ctx.measureText("Ratefluencer").width;
    ctx.fillText(" AI", 22 + rw, H - 30);
    ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.textAlign = "right";
    ctx.fillText("AI-SCORED", W - 22, H - 30);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = 540, H = 960;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");

    setGenerating(true);
    setImgLoaded(false);

    // Generate a scene-like image via Pollinations using the reel idea as prompt
    const prompt = `${reelIdea || category + " content"}, cinematic scene, ${category} creator, warm cinematic lighting, 9:16 vertical, Instagram reel, high quality, no text`;
    const encoded = encodeURIComponent(prompt.slice(0, 300));
    const imgUrl  = `https://image.pollinations.ai/prompt/${encoded}?width=540&height=960&seed=77&model=flux&nologo=true`;

    const img = new window.Image();
    img.crossOrigin = "anonymous";

    const drawWithImage = () => {
      ctx.drawImage(img, 0, 0, W, H);
      drawOverlay(ctx, W, H, true);
      setImgLoaded(true);
      setGenerating(false);
    };

    const drawFallback = () => {
      drawOverlay(ctx, W, H, false);
      setGenerating(false);
    };

    img.onload  = drawWithImage;
    img.onerror = drawFallback;

    // Proxy through backend to resolve CORS for canvas.toDataURL()
    img.src = `${config.api.baseURL}/api/proxy-image?url=${encodeURIComponent(imgUrl)}`;

    // Show fallback immediately, image replaces it when ready
    drawOverlay(ctx, W, H, false);
  }, [reelIdea, category, viralityScore]);

  const download = () => {
    const link = document.createElement("a");
    link.download = "reel-thumbnail.png";
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  return (
    <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <canvas ref={canvasRef} style={{ width: "148px", height: "263px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)", display: "block", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }} />
        {generating && !imgLoaded && (
          <div style={{ position: "absolute", top: "8px", right: "8px", width: "16px", height: "16px", border: "2px solid rgba(200,240,104,0.2)", borderTopColor: "#C8F068", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ fontSize: "13px", color: "var(--text)", fontWeight: 500 }}>9:16 Reel Thumbnail</div>
        <div style={{ fontSize: "12px", color: "var(--text3)", lineHeight: 1.6 }}>
          {generating && !imgLoaded ? "Generating AI scene image..." : "AI scene image with your reel concept. Download and use directly."}
        </div>
        <button onClick={download} style={{
          padding: "8px 18px", borderRadius: "20px", fontSize: "12px", cursor: "pointer",
          background: "rgba(200,240,104,0.1)", border: "1px solid rgba(200,240,104,0.3)",
          color: "var(--accent)", fontFamily: "var(--font-body)", fontWeight: 500,
        }}>
          ⬇ Download PNG
        </button>
        <div style={{ fontSize: "11px", color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
          540 × 960 px · PNG · AI scene background
        </div>
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

// -- Subtitles ----------------------------------------------------------------
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
        {segments.length} segments . ~{Math.round(totalDur)}s total
      </div>
    </div>
  );
}

// -- B-Roll --------------------------------------------------------------------
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
        Keywords extracted from your script  -  click any to find matching stock footage on Pexels.
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
        Opens Pexels video search . Free to use stock footage
      </div>
    </div>
  );
}

// -- Main export ---------------------------------------------------------------
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
                🔊 Script Voiceover  -  Browser Speech Synthesis
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
                🎬 B-Roll Keywords -> Stock Footage
              </div>
              <BRoll script={result.script} reelIdea={result.reel_idea} category={category} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
