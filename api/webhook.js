export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET — dashboard polls for latest data
  if (req.method === 'GET') {
    // We use a simple in-memory store (resets on cold start, fine for this use case)
    const data = global._tvData || null;
    return res.status(200).json({ data });
  }

  // POST — TradingView fires this
  if (req.method === 'POST') {
    try {
      const body = req.body;

      // Store latest data globally (persists within same Vercel instance)
      global._tvData = {
        ...body,
        timestamp: Date.now()
      };

      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
