export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const URL = process.env.KV_REST_API_URL;
  const TOKEN = process.env.KV_REST_API_TOKEN;
  if (!URL || !TOKEN) return res.status(500).json({ error: 'Upstash not configured' });

  const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
  const type = req.query.type || 'tv';

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
      await fetch(`${URL}/set/${key}`, { method: 'POST', headers, body: JSON.stringify(value) });
    } catch(e) {}
  }

  if (req.method === 'GET') {
    const data = await kget(type);
    return res.status(200).json({ data });
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e) {} }
    if (type === 'tv') {
      await kset('tv', JSON.stringify({ ...body, timestamp: Date.now() }));
    } else {
      await kset(type, JSON.stringify(body));
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
