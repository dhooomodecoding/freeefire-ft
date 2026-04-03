// api/scan.js — Vercel Serverless Function
// Pakai OpenRouter (GRATIS!) — daftar di openrouter.ai
// Simpan API Key di Vercel Environment Variables: OPENROUTER_API_KEY

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const APIKEY = process.env.OPENROUTER_API_KEY;
  if (!APIKEY) {
    return res.status(500).json({ ok: false, msg: 'OPENROUTER_API_KEY belum di-set di Vercel Environment Variables.' });
  }

  const { image, mime, matchNum } = req.body;
  if (!image || !matchNum) {
    return res.status(400).json({ ok: false, msg: 'Data tidak lengkap (image, matchNum).' });
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

  // Coba beberapa model gratis OpenRouter sebagai fallback
  const models = [
    'google/gemini-2.0-flash-exp:free',
    'meta-llama/llama-4-scout:free',
    'google/gemini-flash-1.5:free'
  ];

  let lastError = '';

  for (const model of models) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${APIKEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://ff-tournament.vercel.app',
          'X-Title': 'FF Tournament Score'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: { url: `data:${mime || 'image/jpeg'};base64,${image}` }
                },
                { type: 'text', text: prompt }
              ]
            }
          ],
          temperature: 0.1,
          max_tokens: 2000
        })
      });

      if (response.status === 429) {
        lastError = `Rate limit model ${model}`;
        continue;
      }

      if (!response.ok) {
        const e = await response.json().catch(() => ({}));
        lastError = `Model ${model} error ${response.status}: ${e?.error?.message || ''}`;
        continue;
      }

      const d = await response.json();
      const raw = d?.choices?.[0]?.message?.content || '';
      const clean = raw.replace(/```json|```/g, '').trim();

      let json;
      try {
        json = JSON.parse(clean);
      } catch {
        lastError = `Model ${model} gagal parse JSON`;
        continue;
      }

      if (json.error) {
        return res.status(200).json({ ok: false, msg: 'AI: ' + json.error });
      }

      if (!json.teams?.length) {
        lastError = `Model ${model}: Tidak ada tim terbaca`;
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
      lastError = `Model ${model} koneksi error: ${e.message}`;
      continue;
    }
  }

  return res.status(500).json({
    ok: false,
    msg: `Semua model gagal. Error terakhir: ${lastError}. Gunakan input manual.`
  });
}
