export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const URL = process.env.KV_REST_API_URL;
  const TOKEN = process.env.KV_REST_API_TOKEN;
  if (!URL || !TOKEN) return res.status(500).json({ error: 'Upstash not configured' });

  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  };

  async function kget(key) {
    try {
      const r = await fetch(`${URL}/get/${key}`, { headers });
      const j = await r.json();
      if (!j.result) return null;
      return typeof j.result === 'string' ? JSON.parse(j.result) : j.result;
    } catch(e) { return null; }
  }

  async function kset(key, value) {
    try {
      await fetch(`${URL}/set/${key}`, {
        method: 'POST', headers,
        body: JSON.stringify(value)
      });
    } catch(e) {}
  }

  const path = req.url.split('?')[0].replace('/api/webhook', '') || '/';

  // ── TV DATA (TradingView webhook) ──────────────────────────────
  if (path === '/' || path === '') {
    if (req.method === 'GET') {
      const data = await kget('tv_data');
      return res.status(200).json({ data });
    }
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e) {} }
      await kset('tv_data', JSON.stringify({ ...body, timestamp: Date.now() }));
      return res.status(200).json({ ok: true });
    }
  }

  // ── SETTINGS (token, chatId) ───────────────────────────────────
  if (path === '/settings') {
    if (req.method === 'GET') {
      const data = await kget('settings');
      return res.status(200).json({ data });
    }
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e) {} }
      await kset('settings', JSON.stringify(body));
      return res.status(200).json({ ok: true });
    }
  }

  // ── JOURNAL ───────────────────────────────────────────────────
  if (path === '/journal') {
    if (req.method === 'GET') {
      const data = await kget('journal');
      return res.status(200).json({ data });
    }
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e) {} }
      await kset('journal', JSON.stringify(body));
      return res.status(200).json({ ok: true });
    }
  }

  // ── WEEKLY NOTE ───────────────────────────────────────────────
  if (path === '/weekly') {
    if (req.method === 'GET') {
      const data = await kget('weekly_note');
      return res.status(200).json({ data });
    }
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e) {} }
      await kset('weekly_note', JSON.stringify(body));
      return res.status(200).json({ ok: true });
    }
  }

  return res.status(404).json({ error: 'Not found' });
}
