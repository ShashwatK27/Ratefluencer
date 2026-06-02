import React, { useState, useRef, useEffect } from "react";
import { config } from "../config.js";

const API = config.api.baseURL;
const proxy = (url) => `${API}/api/proxy-image?url=${encodeURIComponent(url)}`;

// Load image for canvas — needs CORS via proxy, prefers pre-fetched base64
function loadCanvasImage(scene) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = scene.image_data || proxy(scene.image_url);
  });
}

function wrapCanvasText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(" ");
  let line = "";
  words.forEach((word, i) => {
    const test = line + word + " ";
    if (ctx.measureText(test).width > maxW && i > 0) {
      ctx.fillText(line.trim(), x, y);
      line = word + " ";
      y += lineH;
    } else { line = test; }
  });
  ctx.fillText(line.trim(), x, y);
  return y;
}

export default function ReelVideoCreator({ scenes, category }) {
  const canvasRef   = useRef(null);
  const animRef     = useRef(null);
  const recorderRef = useRef(null);

  // Canvas images (loaded lazily when user hits Preview/Create)
  const [canvasImgs,   setCanvasImgs]   = useState(null);
  const [canvasLoading,setCanvasLoading] = useState(false);

  const [playing,      setPlaying]      = useState(false);
  const [recording,    setRecording]    = useState(false);
  const [progress,     setProgress]     = useState(0);
  const [currentScene, setCurrentScene] = useState(0);
  const [videoBlob,    setVideoBlob]    = useState(null);

  // Reset when scenes change
  useEffect(() => {
    setCanvasImgs(null);
    setVideoBlob(null);
    setPlaying(false);
    setProgress(0);
  }, [scenes]);

  // Load images for canvas (only when needed)
  const ensureCanvasImgs = async () => {
    if (canvasImgs) return canvasImgs;
    setCanvasLoading(true);
    const imgs = await Promise.all(scenes.slice(0, 4).map(s => loadCanvasImage(s)));
    setCanvasImgs(imgs);
    setCanvasLoading(false);
    return imgs;
  };

  // Draw one frame on canvas
  const drawFrame = (ctx, img, scene, progress, W, H) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    if (img) {
      const scale = 1 + progress * 0.06;
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(scale, scale);
      ctx.drawImage(img, -W / 2, -H / 2, W, H);
      ctx.restore();
      const grad = ctx.createLinearGradient(0, H * 0.65, 0, H);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.72)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, H * 0.65, W, H * 0.35);
    } else {
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, "#0B0D0F"); bg.addColorStop(1, "#1a1c20");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    }
    // Scene chip
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath(); ctx.roundRect(14, 14, 130, 28, 6); ctx.fill();
    ctx.font = "bold 12px 'DM Mono', monospace";
    ctx.fillStyle = "#C8F068"; ctx.textAlign = "left";
    ctx.fillText(`S${scene.id || "?"} · ${scene.start_sec}–${scene.end_sec}s`, 24, 33);
    // Text overlay
    if (scene.text_overlay) {
      ctx.font = "bold 26px Georgia, serif";
      ctx.fillStyle = "#fff"; ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 10;
      wrapCanvasText(ctx, `"${scene.text_overlay}"`, W / 2, H - 100, W - 56, 34);
      ctx.shadowBlur = 0;
    }
    // Progress bar
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(0, H - 5, W, 5);
    ctx.fillStyle = "#C8F068";
    ctx.fillRect(0, H - 5, W * progress, 5);
  };

  const startPreview = async () => {
    if (playing) {
      cancelAnimationFrame(animRef.current);
      setPlaying(false); setCurrentScene(0); setProgress(0); return;
    }
    const imgs = await ensureCanvasImgs();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = 270; canvas.height = 480;
    setPlaying(true);
    let si = 0, sceneStart = performance.now();
    const animate = (now) => {
      const dur = (scenes[si]?.duration_sec || 5) * 1000;
      const elapsed = now - sceneStart;
      const p = Math.min(elapsed / dur, 1);
      drawFrame(ctx, imgs[si], scenes[si], p, 270, 480);
      setCurrentScene(si); setProgress(((si + p) / scenes.length) * 100);
      if (elapsed >= dur) {
        si++; sceneStart = now;
        if (si >= Math.min(scenes.length, 4)) {
          setPlaying(false); setCurrentScene(0); setProgress(0); return;
        }
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
  };

  const createVideo = async () => {
    const imgs = await ensureCanvasImgs();
    const off = document.createElement("canvas");
    const W = 540, H = 960;
    off.width = W; off.height = H;
    const ctx = off.getContext("2d");
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9" : "video/webm";
    const stream = off.captureStream(24);
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    recorderRef.current = recorder;
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    setRecording(true); setProgress(0);
    recorder.start(100);
    const allScenes = scenes.slice(0, 4);
    for (let si = 0; si < allScenes.length; si++) {
      const dur = (allScenes[si].duration_sec || 5) * 1000;
      const frames = Math.round((dur / 1000) * 24);
      for (let f = 0; f < frames; f++) {
        drawFrame(ctx, imgs[si], allScenes[si], f / frames, W, H);
        setProgress(((si + f / frames) / allScenes.length) * 100);
        await new Promise(r => setTimeout(r, 1000 / 24));
      }
    }
    drawFrame(ctx, imgs[allScenes.length - 1], allScenes[allScenes.length - 1], 1, W, H);
    await new Promise(r => setTimeout(r, 200));
    recorder.stop();
    await new Promise(r => { recorder.onstop = r; });
    const blob = new Blob(chunks, { type: mime });
    setVideoBlob(blob); setRecording(false); setProgress(100);
  };

  const downloadVideo = () => {
    if (!videoBlob) return;
    const url = URL.createObjectURL(videoBlob);
    const a = document.createElement("a");
    a.href = url; a.download = "reel-video.webm"; a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => () => {
    cancelAnimationFrame(animRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  if (!scenes?.length) return null;

  return (
    <div style={{ marginTop: "1.25rem" }}>
      <div style={{ fontSize: "10px", color: "var(--accent)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: "10px" }}>
        AI Visual Storyboard — {scenes.length} scenes · powered by Pollinations.ai
      </div>
      <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>

        {/* Canvas preview */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ width: "148px", height: "263px", borderRadius: "16px", overflow: "hidden", background: "#000", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
            <canvas ref={canvasRef} style={{ width: "148px", height: "263px" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: "5px", marginTop: "8px" }}>
            {scenes.slice(0, 4).map((_, i) => (
              <div key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: currentScene === i && playing ? "#C8F068" : "rgba(255,255,255,0.2)", transition: "all .3s" }} />
            ))}
          </div>
        </div>

        {/* Scene grid + controls */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            {scenes.slice(0, 4).map((scene, i) => (
              <div key={i} style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden", fontSize: "10px" }}>
                <div style={{ position: "relative", paddingTop: "56%", background: "#0a0a0a" }}>
                  {/* Direct URL for display — no CORS needed for <img> */}
                  <img
                    src={scene.image_data || scene.image_url}
                    alt={`Scene ${i + 1}`}
                    loading="eager"
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                    onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
                  />
                  {/* Fallback shown on error */}
                  <div style={{ position: "absolute", inset: 0, display: "none", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>🎬</div>
                  <div style={{ position: "absolute", top: "4px", left: "4px", background: "rgba(0,0,0,0.7)", borderRadius: "3px", padding: "1px 5px", fontSize: "8px", color: "#C8F068", fontFamily: "var(--font-mono)" }}>
                    S{i + 1} · {scene.start_sec}–{scene.end_sec}s
                  </div>
                </div>
                <div style={{ padding: "5px 7px" }}>
                  <div style={{ color: "var(--text3)", lineHeight: 1.3, fontSize: "9px" }}>{(scene.action || "").slice(0, 50)}{(scene.action || "").length > 50 ? "…" : ""}</div>
                  {scene.text_overlay && <div style={{ color: "#F07868", marginTop: "2px", fontSize: "8px", fontStyle: "italic" }}>"{scene.text_overlay}"</div>}
                </div>
              </div>
            ))}
          </div>

          {/* Progress */}
          {recording && (
            <div style={{ fontSize: "10px", color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
              Rendering {Math.round(progress)}%
              <div style={{ marginTop: "4px", height: "3px", background: "rgba(255,255,255,0.1)", borderRadius: "2px" }}>
                <div style={{ height: "100%", background: "#C8F068", borderRadius: "2px", width: `${progress}%`, transition: "width .2s" }} />
              </div>
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "2px" }}>
            <button onClick={startPreview} disabled={recording} style={{ padding: "7px 14px", borderRadius: "20px", fontSize: "11px", cursor: "pointer", background: playing ? "rgba(240,120,104,0.12)" : "rgba(200,240,104,0.10)", border: `1px solid ${playing ? "rgba(240,120,104,0.4)" : "rgba(200,240,104,0.3)"}`, color: playing ? "#F07868" : "var(--accent)", fontFamily: "var(--font-body)", fontWeight: 600, opacity: canvasLoading ? 0.6 : 1 }}>
              {canvasLoading && !playing ? "⏳ Loading..." : playing ? "⏹ Stop" : "▶ Preview"}
            </button>
            {!videoBlob ? (
              <button onClick={createVideo} disabled={recording || playing} style={{ padding: "7px 14px", borderRadius: "20px", fontSize: "11px", cursor: recording || playing ? "wait" : "pointer", background: "rgba(104,184,240,0.10)", border: "1px solid rgba(104,184,240,0.35)", color: "var(--blue)", fontFamily: "var(--font-body)", fontWeight: 600, opacity: recording ? 0.5 : 1 }}>
                {recording ? `⏳ ${Math.round(progress)}%` : "🎬 Create Video"}
              </button>
            ) : (
              <button onClick={downloadVideo} style={{ padding: "7px 14px", borderRadius: "20px", fontSize: "11px", cursor: "pointer", background: "rgba(104,184,240,0.15)", border: "1px solid rgba(104,184,240,0.5)", color: "var(--blue)", fontFamily: "var(--font-body)", fontWeight: 600 }}>
                ⬇ Download .webm
              </button>
            )}
          </div>
          <div style={{ fontSize: "10px", color: "var(--text3)", fontFamily: "var(--font-mono)", lineHeight: 1.5 }}>
            Preview plays scenes · Create Video records 540×960 WebM · Ken Burns zoom
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
