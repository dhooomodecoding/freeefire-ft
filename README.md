# FF Tournament Score Tracker — Vercel Deploy Guide

## Struktur Project
```
ff-tournament/
├── index.html       ← Frontend (tanpa API key)
├── api/
│   └── scan.js      ← Serverless function (API key ada di sini, aman)
└── vercel.json      ← Konfigurasi Vercel
```

## Cara Deploy ke Vercel (Gratis)

### 1. Buat akun Vercel
- Daftar gratis di https://vercel.com

### 2. Upload project
**Opsi A — via GitHub (Recommended):**
1. Upload folder ini ke GitHub repo baru
2. Di Vercel → "Add New Project" → import repo GitHub kamu

**Opsi B — via Vercel CLI:**
```bash
npm i -g vercel
cd ff-tournament
vercel
```

### 3. Set Environment Variable (API Key)
Di Vercel Dashboard:
1. Buka project kamu → Settings → Environment Variables
2. Tambahkan:
   - **Name:** `GEMINI_API_KEY`
   - **Value:** API key kamu dari https://aistudio.google.com/app/apikey
   - **Environment:** Production, Preview, Development (centang semua)
3. Klik Save
4. **Redeploy** project (Settings → Deployments → Redeploy)

### 4. Selesai!
Website kamu sudah live. API key aman di server, tidak terlihat di browser.

---

## Dapat API Key Gemini Gratis
1. Buka https://aistudio.google.com/app/apikey
2. Login dengan akun Google
3. Klik "Create API Key"
4. Copy key → paste di Vercel Environment Variables

**Free tier Gemini 2.0 Flash:**
- 15 request/menit
- 1.500 request/hari
- GRATIS selamanya ✓
