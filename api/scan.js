// api/scan.js — Vercel Serverless Function
// Pakai Google Gemini (GRATIS 1500x/hari)
// Daftar API key gratis di: aistudio.google.com
// Simpan di Vercel Environment Variables: GEMINI_API_KEY

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const APIKEY = process.env.GEMINI_API_KEY;
  if (!APIKEY) {
    return res.status(500).json({ ok: false, msg: 'GEMINI_API_KEY belum di-set di Vercel. Buka Settings > Environment Variables.' });
  }

  const { image, mime, matchNum } = req.body;
  if (!image || !matchNum) {
    return res.status(400).json({ ok: false, msg: 'Data tidak lengkap.' });
  }

  const prompt = `Kamu ahli baca screenshot Free Fire. Screenshot ini mungkin foto layar HP/monitor, bisa agak blur.

Baca SEMUA tim/squad:
- placement (angka 1,2,3,...)
- nama tim (gabung tag clan atau nama pemain)
- total kill semua anggota dijumlah

Poin: Top1=12,Top2=9,Top3=8,Top4=7,Top5=6,Top6=5,Top7=4,Top8=3,Top9=2,Top10=1,Top11+=0. Kill=1poin.

BALAS HANYA JSON ini tanpa teks apapun:
{"match":${matchNum},"teams":[{"placement":1,"teamName":"nama","members":["p1","p2"],"kills":5,"placementPts":12,"killPts":5,"totalPts":17}]}

Kalau tidak bisa baca: {"match":${matchNum},"error":"alasan"}`;

  // Coba 2 model Gemini gratis sebagai fallback
  const models = [
    'gemini-2.0-flash',
    'gemini-1.5-flash'
  ];

  let lastError = '';

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${APIKEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { inline_data: { mime_type: mime || 'image/jpeg', data: image } },
                { text: prompt }
              ]
            }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 2000 }
          })
        }
      );

      if (response.status === 429) {
        lastError = `Rate limit model ${model}, coba lagi sebentar`;
        continue;
      }

      if (response.status === 400) {
        const e = await response.json().catch(() => ({}));
        lastError = `API Key tidak valid: ${e?.error?.message || ''}`;
        break; // key salah, tidak perlu coba model lain
      }

      if (response.status === 403) {
        lastError = 'API Key tidak punya akses. Pastikan Gemini API sudah di-enable di aistudio.google.com';
        break;
      }

      if (!response.ok) {
        const e = await response.json().catch(() => ({}));
        lastError = `Model ${model} error ${response.status}: ${e?.error?.message || ''}`;
        continue;
      }

      const d = await response.json();
      const raw = d?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const clean = raw.replace(/```json|```/g, '').trim();

      let json;
      try {
        json = JSON.parse(clean);
      } catch {
        lastError = `Model ${model} gagal parse JSON, coba screenshot lebih jelas`;
        continue;
      }

      if (json.error) {
        return res.status(200).json({ ok: false, msg: 'AI: ' + json.error });
      }

      if (!json.teams?.length) {
        lastError = `Tidak ada tim terbaca. Pastikan ini screenshot leaderboard FF`;
        continue;
      }

      const PP = { 1:12, 2:9, 3:8, 4:7, 5:6, 6:5, 7:4, 8:3, 9:2, 10:1 };
      json.teams.forEach(t => {
        t.placementPts = PP[t.placement] ?? 0;
        t.killPts = parseInt(t.kills) || 0;
        t.totalPts = t.placementPts + t.killPts;
      });

      return res.status(200).json({ ok: true, data: json, modelUsed: model });

    } catch (e) {
      lastError = `Koneksi error: ${e.message}`;
      continue;
    }
  }

  return res.status(500).json({ ok: false, msg: lastError });
}
