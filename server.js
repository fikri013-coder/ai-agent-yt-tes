const express = require("express");
const cors = require("cors");
const fetch = (...args) =>
  import("node-fetch").then(({ default: f }) => f(...args));
const FormData = require("form-data");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

const PORT = process.env.PORT || 3000;

// ─── Health check ────────────────────────────────────────────────────────────
app.get("/", (_, res) => res.send("Home of the Railway API"));

// ─── STEP 1: Research trending ───────────────────────────────────────────────
app.post("/research", async (req, res) => {
  try {
    const { keyword, anthropicKey } = req.body;
    const prompt = keyword
      ? `Cari berita trending terkini tentang: "${keyword}".`
      : `Cari 3 berita Indonesia paling viral dan trending hari ini.`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [
          {
            role: "user",
            content: `${prompt}
Return ONLY raw JSON array (no markdown, no backtick), format:
[{"title":"...","summary":"...","why_trending":"..."}]`,
          },
        ],
      }),
    });

    const d = await r.json();
    if (d.error) throw new Error(d.error.message);

    const txt = d.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("");
    const m = txt.match(/\[[\s\S]*?\]/);
    if (!m) throw new Error("Gagal parse topik dari AI");

    const topics = JSON.parse(m[0]);
    res.json({ success: true, topics, topic: topics[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── STEP 2: Generate Script ─────────────────────────────────────────────────
app.post("/script", async (req, res) => {
  try {
    const { topic, anthropicKey } = req.body;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: `Buat script video YouTube berita trending.

Topik: ${topic.title}
Konteks: ${topic.summary}
Trending karena: ${topic.why_trending}

Return ONLY raw JSON (no markdown, no backtick):
{
  "title": "Judul YouTube menarik max 60 karakter",
  "description": "Deskripsi 200 karakter SEO-friendly",
  "tags": ["tag1","tag2","tag3","tag4","tag5","tag6"],
  "script": "Naskah narasi 3-4 menit Bahasa Indonesia, hook kuat di awal, tone profesional berita",
  "thumbnail_prompt": "DALL-E 3 prompt English untuk thumbnail YouTube bold news style eye-catching"
}`,
          },
        ],
      }),
    });

    const d = await r.json();
    if (d.error) throw new Error(d.error.message);

    const txt = d.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("");
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Gagal parse script dari AI");

    res.json({ success: true, script: JSON.parse(m[0]) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── STEP 3: Generate Thumbnail ──────────────────────────────────────────────
app.post("/thumbnail", async (req, res) => {
  try {
    const { prompt, openaiKey } = req.body;

    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt:
          prompt +
          ". YouTube thumbnail style, bold text space, high contrast vibrant colors, dramatic lighting, professional news broadcast, 16:9 format",
        n: 1,
        size: "1792x1024",
        quality: "hd",
      }),
    });

    const d = await r.json();
    if (d.error) throw new Error(d.error.message);

    res.json({ success: true, url: d.data[0].url });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── STEP 4: Voiceover ───────────────────────────────────────────────────────
app.post("/voiceover", async (req, res) => {
  try {
    const { text, elevenKey, voiceId } = req.body;

    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": elevenKey,
        },
        body: JSON.stringify({
          text: text.substring(0, 2500),
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.8 },
        }),
      }
    );

    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.detail?.message || `ElevenLabs error ${r.status}`);
    }

    const buffer = await r.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    res.json({ success: true, audio_base64: base64 });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── STEP 5: D-ID Video ──────────────────────────────────────────────────────
app.post("/video", async (req, res) => {
  try {
    const { audio_base64, avatarUrl, didKey } = req.body;
    const auth = `Basic ${Buffer.from(didKey + ":").toString("base64")}`;

    // Upload audio
    const audioBuffer = Buffer.from(audio_base64, "base64");
    const fd = new FormData();
    fd.append("audio", audioBuffer, { filename: "voice.mp3", contentType: "audio/mpeg" });

    const upAudio = await fetch("https://api.d-id.com/audios", {
      method: "POST",
      headers: { Authorization: auth, ...fd.getHeaders() },
      body: fd,
    });

    if (!upAudio.ok) {
      const e = await upAudio.json().catch(() => ({}));
      throw new Error(e.description || `D-ID audio upload error ${upAudio.status}`);
    }
    const { url: hostedAudioUrl } = await upAudio.json();

    // Create talk
    const createTalk = await fetch("https://api.d-id.com/talks", {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        source_url: avatarUrl,
        script: { type: "audio", audio_url: hostedAudioUrl },
        config: { result_format: "mp4", stitch: true },
      }),
    });

    if (!createTalk.ok) {
      const e = await createTalk.json().catch(() => ({}));
      throw new Error(e.description || `D-ID talk error ${createTalk.status}`);
    }
    const { id: talkId } = await createTalk.json();

    // Poll
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const poll = await fetch(`https://api.d-id.com/talks/${talkId}`, {
        headers: { Authorization: auth },
      });
      const pd = await poll.json();
      if (pd.status === "done") {
        return res.json({ success: true, video_url: pd.result_url });
      }
      if (pd.status === "error") {
        throw new Error("D-ID gagal: " + (pd.error?.description || "unknown"));
      }
    }
    throw new Error("D-ID timeout setelah 5 menit");
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── STEP 6: YouTube Upload ──────────────────────────────────────────────────
app.post("/upload", async (req, res) => {
  try {
    const { script, thumbUrl, videoUrl, ytToken, ytPrivacy } = req.body;

    // Download video
    const vRes = await fetch(videoUrl);
    if (!vRes.ok) throw new Error("Gagal download video dari D-ID");
    const videoBuffer = Buffer.from(await vRes.arrayBuffer());

    const hashtags = script.tags.map((t) => "#" + t.replace(/\s+/g, "")).join(" ");
    const meta = {
      snippet: {
        title: script.title,
        description: script.description + "\n\n" + hashtags,
        tags: script.tags,
        categoryId: "25",
      },
      status: {
        privacyStatus: ytPrivacy || "public",
        selfDeclaredMadeForKids: false,
      },
    };

    // Init resumable upload
    const init = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ytToken}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": "video/mp4",
          "X-Upload-Content-Length": String(videoBuffer.length),
        },
        body: JSON.stringify(meta),
      }
    );

    if (!init.ok) {
      const e = await init.json().catch(() => ({}));
      throw new Error(e.error?.message || `YouTube init error ${init.status}`);
    }

    const uploadUrl = init.headers.get("location");

    // Upload video
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(videoBuffer.length),
      },
      body: videoBuffer,
    });

    if (!uploadRes.ok && uploadRes.status !== 201) {
      const e = await uploadRes.json().catch(() => ({}));
      throw new Error(e.error?.message || `YouTube upload error ${uploadRes.status}`);
    }

    const vData = await uploadRes.json();
    const ytId = vData.id;

    // Upload thumbnail
    if (thumbUrl) {
      try {
        const tRes = await fetch(thumbUrl);
        const tBuffer = Buffer.from(await tRes.arrayBuffer());
        await fetch(
          `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${ytId}&uploadType=media`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ytToken}`,
              "Content-Type": "image/jpeg",
              "Content-Length": String(tBuffer.length),
            },
            body: tBuffer,
          }
        );
      } catch (_) {}
    }

    res.json({
      success: true,
      ytId,
      ytUrl: `https://youtube.com/watch?v=${ytId}`,
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
