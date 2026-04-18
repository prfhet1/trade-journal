export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const UPSTASH_URL = process.env.KV_REST_API_URL;
  const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN;

  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return res.status(500).json({ error: 'Upstash not configured' });
  }

  const headers = {
    Authorization: `Bearer ${UPSTASH_TOKEN}`,
    'Content-Type': 'application/json'
  };

  if (req.method === 'GET') {
    try {
      const r = await fetch(`${UPSTASH_URL}/get/tv_data`, { headers });
      const json = await r.json();
      const data = json.result ? JSON.parse(json.result) : null;
      return res.status(200).json({ data });
    } catch (e) {
      return res.status(200).json({ data: null });
    }
  }

  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) {}
      }
      const payload = JSON.stringify({
        ...body,
        timestamp: Date.now()
      });
      await fetch(`${UPSTASH_URL}/set/tv_data`, {
        method: 'POST',
        headers,
        body: JSON.stringify([payload, 'EX', 3600])
      });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
