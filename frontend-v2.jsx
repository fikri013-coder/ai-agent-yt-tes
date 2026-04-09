import { useState } from "react";

const PIPELINE = [
  { id: "research",  label: "Riset Trending",  icon: "🔍", desc: "Cari topik berita viral hari ini" },
  { id: "script",    label: "Script & SEO",    icon: "📝", desc: "Tulis naskah + judul + deskripsi + tags" },
  { id: "thumbnail", label: "Thumbnail AI",    icon: "🎨", desc: "Generate thumbnail dengan DALL-E 3" },
  { id: "voiceover", label: "Voiceover",       icon: "🎙️", desc: "Narasi AI dengan ElevenLabs" },
  { id: "video",     label: "Generate Video",  icon: "🎬", desc: "Avatar berbicara otomatis dengan D-ID" },
  { id: "upload",    label: "Upload YouTube",  icon: "📤", desc: "Publish otomatis ke channel YouTube" },
];

const initSteps = () => PIPELINE.map((p) => ({ ...p, status: "idle", out: null, err: null }));

export default function App() {
  const [tab, setTab] = useState("config");
  const [busy, setBusy] = useState(false);
  const [cfg, setCfg] = useState({
    backendUrl: "",
    keyword: "",
    anthropicKey: "",
    openaiKey: "",
    elevenKey: "",
    elVoiceId: "pNInz6obpgDQGcFmaJgB",
    didKey: "",
    didAvatar: "https://create-images-results.d-id.com/DefaultPresenters/Noelle_f/image.jpeg",
    ytToken: "",
    ytPrivacy: "public",
  });
  const [steps, setSteps] = useState(initSteps());

  const upd = (id, patch) =>
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const api = async (path, body) => {
    const base = cfg.backendUrl.replace(/\/$/, "");
    const r = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!d.success) throw new Error(d.error || "Unknown error");
    return d;
  };

  const doResearch = async () => {
    upd("research", { status: "running", err: null, out: null });
    try {
      const d = await api("/research", { keyword: cfg.keyword, anthropicKey: cfg.anthropicKey });
      upd("research", { status: "done", out: d });
      return d.topic;
    } catch (e) { upd("research", { status: "error", err: e.message }); throw e; }
  };

  const doScript = async (topic) => {
    upd("script", { status: "running", err: null, out: null });
    try {
      const d = await api("/script", { topic, anthropicKey: cfg.anthropicKey });
      upd("script", { status: "done", out: d.script });
      return d.script;
    } catch (e) { upd("script", { status: "error", err: e.message }); throw e; }
  };

  const doThumbnail = async (script) => {
    upd("thumbnail", { status: "running", err: null, out: null });
    try {
      const d = await api("/thumbnail", { prompt: script.thumbnail_prompt, openaiKey: cfg.openaiKey });
      upd("thumbnail", { status: "done", out: { url: d.url } });
      return d.url;
    } catch (e) { upd("thumbnail", { status: "error", err: e.message }); throw e; }
  };

  const doVoiceover = async (script) => {
    upd("voiceover", { status: "running", err: null, out: null });
    try {
      const d = await api("/voiceover", { text: script.script, elevenKey: cfg.elevenKey, voiceId: cfg.elVoiceId });
      const blob = new Blob([Uint8Array.from(atob(d.audio_base64), c => c.charCodeAt(0))], { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(blob);
      upd("voiceover", { status: "done", out: { url: audioUrl } });
      return d.audio_base64;
    } catch (e) { upd("voiceover", { status: "error", err: e.message }); throw e; }
  };

  const doVideo = async (audio_base64) => {
    upd("video", { status: "running", err: null, out: null });
    try {
      const d = await api("/video", { audio_base64, avatarUrl: cfg.didAvatar, didKey: cfg.didKey });
      upd("video", { status: "done", out: { url: d.video_url } });
      return d.video_url;
    } catch (e) { upd("video", { status: "error", err: e.message }); throw e; }
  };

  const doUpload = async (script, thumbUrl, videoUrl) => {
    upd("upload", { status: "running", err: null, out: null });
    try {
      const d = await api("/upload", { script, thumbUrl, videoUrl, ytToken: cfg.ytToken, ytPrivacy: cfg.ytPrivacy });
      upd("upload", { status: "done", out: d });
      return d.ytUrl;
    } catch (e) { upd("upload", { status: "error", err: e.message }); throw e; }
  };

  const runAll = async () => {
    if (!cfg.backendUrl) { alert("Isi URL Backend Railway dulu!"); setTab("config"); return; }
    setBusy(true);
    setTab("pipeline");
    setSteps(initSteps());
    try {
      const topic     = await doResearch();
      const script    = await doScript(topic);
      const thumbUrl  = await doThumbnail(script);
      const audio64   = await doVoiceover(script);
      const videoUrl  = await doVideo(audio64);
      await doUpload(script, thumbUrl, videoUrl);
    } catch (_) {}
    setBusy(false);
  };

  const stepBorder = (s) => ({ idle: "border-gray-700", running: "border-blue-500 shadow-blue-900/40 shadow-lg", done: "border-green-600", error: "border-red-600" }[s]);
  const badge = (s) => ({ idle: "bg-gray-700 text-gray-400", running: "bg-blue-600 text-white", done: "bg-green-600 text-white", error: "bg-red-600 text-white" }[s]);
  const badgeLabel = (s) => ({ idle: "Menunggu", running: "Berjalan...", done: "✓ Selesai", error: "✗ Error" }[s]);

  const allDone = steps.every((s) => s.status === "done");
  const hasError = steps.some((s) => s.status === "error");

  const inputCls = "w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none";
  const inputStyle = { background: "#1f2937", border: "1px solid #374151" };

  return (
    <div className="min-h-screen bg-gray-950 text-white" style={{ fontFamily: "system-ui, sans-serif" }}>

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">🎬 YouTube AI Agent</h1>
          <p className="text-gray-400 text-sm">Berita & Trending — 100% Otomatis</p>
        </div>
        <button onClick={runAll} disabled={busy}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm"
          style={{ background: busy ? "#374151" : "#dc2626", cursor: busy ? "not-allowed" : "pointer" }}>
          {busy ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Berjalan...</> : "▶ Jalankan Agent"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-900 border-b border-gray-800">
        {[["config", "⚙️ Konfigurasi"], ["pipeline", "🚀 Pipeline"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className="px-6 py-3 text-sm font-medium relative"
            style={{ color: tab === id ? "#fff" : "#9ca3af" }}>
            {label}
            {tab === id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500" />}
          </button>
        ))}
      </div>

      {/* Config */}
      {tab === "config" && (
        <div className="p-6 max-w-2xl space-y-8">

          {/* Backend URL */}
          <section>
            <h2 className="text-base font-semibold mb-3">🌐 Backend Railway</h2>
            <div className="rounded-xl p-4 mb-3" style={{ background: "#1c1917", border: "1px solid #f97316" }}>
              <p className="text-sm text-orange-300 font-medium mb-1">⚠️ Wajib diisi pertama kali!</p>
              <p className="text-xs text-gray-400">Deploy backend dulu ke Railway, lalu copy URL-nya ke sini. Panduan lengkap ada di bawah.</p>
            </div>
            <input className={inputCls} style={inputStyle}
              placeholder="https://youtube-agent-production.up.railway.app"
              value={cfg.backendUrl}
              onChange={(e) => setCfg((p) => ({ ...p, backendUrl: e.target.value }))} />
          </section>

          {/* Topik */}
          <section>
            <h2 className="text-base font-semibold mb-3">🎯 Sumber Topik</h2>
            <label className="block text-sm text-gray-400 mb-1.5">Keyword <span className="text-gray-600">(kosongkan = auto trending Indonesia)</span></label>
            <input className={inputCls} style={inputStyle}
              placeholder="contoh: AI, politik, ekonomi..."
              value={cfg.keyword}
              onChange={(e) => setCfg((p) => ({ ...p, keyword: e.target.value }))} />
          </section>

          {/* API Keys */}
          <section>
            <h2 className="text-base font-semibold mb-3">🔑 API Keys</h2>
            <div className="space-y-4">
              {[
                { k: "anthropicKey", label: "Anthropic API Key",      ph: "sk-ant-...",  pw: true,  hint: "console.anthropic.com → API Keys" },
                { k: "openaiKey",    label: "OpenAI API Key",          ph: "sk-...",      pw: true,  hint: "platform.openai.com → API Keys (untuk DALL-E 3)" },
                { k: "elevenKey",    label: "ElevenLabs API Key",      ph: "xi_...",      pw: true,  hint: "elevenlabs.io → Profile → API Key" },
                { k: "elVoiceId",   label: "ElevenLabs Voice ID",     ph: "pNInz6obpgDQGcFmaJgB", pw: false, hint: "Default: Adam. Cari Voice ID di ElevenLabs dashboard." },
                { k: "didKey",       label: "D-ID API Key",            ph: "email:key",  pw: true,  hint: "studio.d-id.com → API → format: email:apikey" },
                { k: "didAvatar",   label: "D-ID Avatar URL",         ph: "https://...", pw: false, hint: "URL foto untuk avatar yang akan berbicara" },
                { k: "ytToken",      label: "YouTube OAuth 2.0 Token", ph: "ya29...",     pw: true,  hint: "Lihat panduan di bawah cara mendapatkan token" },
              ].map(({ k, label, ph, pw, hint }) => (
                <div key={k}>
                  <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
                  <input type={pw ? "password" : "text"} className={inputCls} style={inputStyle}
                    placeholder={ph} value={cfg[k]}
                    onChange={(e) => setCfg((p) => ({ ...p, [k]: e.target.value }))} />
                  <p className="text-xs text-gray-500 mt-1">{hint}</p>
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Visibilitas YouTube</label>
                <select className={inputCls} style={inputStyle} value={cfg.ytPrivacy}
                  onChange={(e) => setCfg((p) => ({ ...p, ytPrivacy: e.target.value }))}>
                  <option value="public">🌍 Public</option>
                  <option value="unlisted">🔗 Unlisted</option>
                  <option value="private">🔒 Private</option>
                </select>
              </div>
            </div>
          </section>

          {/* Deploy Guide */}
          <section className="rounded-xl p-5 space-y-4" style={{ background: "#1f2937", border: "1px solid #374151" }}>
            <p className="font-semibold text-base">📋 Panduan Deploy Backend ke Railway</p>
            
            <div className="space-y-3 text-sm">
              {[
                ["1️⃣", "Buat akun GitHub", "Buka github.com → Sign Up (gratis)"],
                ["2️⃣", "Upload kode backend", "Buat repo baru → upload file server.js dan package.json yang sudah didownload"],
                ["3️⃣", "Buat akun Railway", "Buka railway.app → Login with GitHub"],
                ["4️⃣", "Deploy", "Klik New Project → Deploy from GitHub repo → pilih repo kamu"],
                ["5️⃣", "Dapat URL", "Setelah deploy selesai, Railway beri URL seperti: https://nama-production.up.railway.app"],
                ["6️⃣", "Isi di sini", "Copy URL itu, paste di kolom Backend Railway di atas"],
              ].map(([num, title, desc]) => (
                <div key={num} className="flex gap-3">
                  <span className="text-xl flex-shrink-0">{num}</span>
                  <div>
                    <div className="font-medium text-gray-200">{title}</div>
                    <div className="text-gray-400 text-xs mt-0.5">{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg p-3 mt-2" style={{ background: "#111827" }}>
              <p className="text-xs font-semibold text-yellow-400 mb-1">📺 Cara dapat YouTube OAuth Token:</p>
              <ol className="text-xs text-gray-400 space-y-1 list-decimal pl-4">
                <li>Buka <span className="text-blue-400">developers.google.com/oauthplayground</span></li>
                <li>Pilih scope: YouTube Data API v3 → youtube.upload</li>
                <li>Klik Authorize APIs → login Google</li>
                <li>Klik Exchange authorization code for tokens</li>
                <li>Copy Access token → paste di atas</li>
              </ol>
            </div>
          </section>
        </div>
      )}

      {/* Pipeline */}
      {tab === "pipeline" && (
        <div className="p-6 max-w-2xl space-y-3">
          {allDone && (
            <div className="rounded-xl p-4 text-sm font-medium flex items-center gap-2"
              style={{ background: "#14532d", border: "1px solid #166534", color: "#86efac" }}>
              🎉 Pipeline selesai! Video berhasil diupload ke YouTube.
            </div>
          )}
          {hasError && !busy && (
            <div className="rounded-xl p-4 text-sm"
              style={{ background: "#450a0a", border: "1px solid #7f1d1d", color: "#fca5a5" }}>
              ❌ Ada step yang gagal. Cek error di bawah dan pastikan API keys benar.
            </div>
          )}

          {steps.map((step) => (
            <div key={step.id}
              className={`rounded-xl p-5 border transition-all ${stepBorder(step.status)}`}
              style={{ background: "#111827" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="text-2xl leading-none mt-0.5">{step.icon}</span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{step.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge(step.status)}`}>
                        {badgeLabel(step.status)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{step.desc}</p>
                  </div>
                </div>
                {step.status === "running" && (
                  <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0 mt-1" />
                )}
              </div>

              {step.status === "error" && step.err && (
                <div className="mt-3 rounded-lg p-3 text-xs" style={{ background: "#450a0a", color: "#fca5a5" }}>
                  ❌ {step.err}
                </div>
              )}

              {step.status === "done" && step.out && (
                <div className="mt-4 space-y-2">
                  {step.id === "research" && step.out.topics?.map((t, i) => (
                    <div key={i} className="rounded-lg p-3 text-sm"
                      style={{ background: i === 0 ? "#14532d33" : "#1f2937", border: `1px solid ${i === 0 ? "#166534" : "#374151"}` }}>
                      <div className="font-medium">{i === 0 && <span className="text-green-400">✅ Dipilih: </span>}{t.title}</div>
                      <div className="text-xs text-gray-400 mt-1">{t.why_trending}</div>
                    </div>
                  ))}
                  {step.id === "script" && (
                    <>
                      <div className="rounded-lg p-3" style={{ background: "#1f2937" }}>
                        <div className="text-xs text-gray-400 mb-1">Judul YouTube</div>
                        <div className="text-sm font-medium">{step.out.title}</div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {step.out.tags?.map((t) => (
                          <span key={t} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#374151", color: "#d1d5db" }}>#{t}</span>
                        ))}
                      </div>
                    </>
                  )}
                  {step.id === "thumbnail" && step.out.url && (
                    <img src={step.out.url} alt="thumbnail" className="rounded-lg w-full" style={{ maxWidth: 480 }} />
                  )}
                  {step.id === "voiceover" && step.out.url && (
                    <audio controls src={step.out.url} className="w-full mt-1" />
                  )}
                  {step.id === "video" && step.out.url && (
                    <video controls src={step.out.url} className="rounded-lg w-full" style={{ maxWidth: 480 }} />
                  )}
                  {step.id === "upload" && step.out.ytUrl && (
                    <a href={step.out.ytUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                      style={{ background: "#dc2626" }}>
                      🎉 Lihat Video di YouTube →
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}

          {!busy && steps.every((s) => s.status === "idle") && (
            <div className="text-center py-16 text-gray-500">
              <div className="text-5xl mb-4">🤖</div>
              <p className="text-sm">Isi konfigurasi di tab <strong className="text-gray-300">⚙️ Konfigurasi</strong><br />lalu klik <strong className="text-white">▶ Jalankan Agent</strong></p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
