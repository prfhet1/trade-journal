export default async function handler(req, res) {
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const UPSTASH_URL = process.env.KV_REST_API_URL;
  const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN;
  const BOT_TOKEN = process.env.TG_BOT_TOKEN;
  const CHANNEL_ID = process.env.TG_CHAT_ID;

  const headers = { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' };

  async function kget(key) {
    try {
      const r = await fetch(`${UPSTASH_URL}/get/${key}`, { headers });
      const j = await r.json();
      if (!j.result) return null;
      return typeof j.result === 'string' ? JSON.parse(j.result) : j.result;
    } catch(e) { return null; }
  }

  async function sendMsg(text) {
    try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHANNEL_ID, text, parse_mode: 'MarkdownV2' })
      });
    } catch(e) {}
  }

  function esc(s) {
    if (!s && s !== 0) return '';
    var c = String(s);
    var sp = ['_','*','[',']','(',')','.','+','-','=','{','}','!','|','~','`','#','>','\\'];
    sp.forEach(function(ch) { c = c.split(ch).join('\\' + ch); });
    return c;
  }
  function bold(s) {
    if (!s && s !== 0) return '';
    var c = String(s);
    c = c.replace(/\\/g, '\\\\').replace(/\*/g, '\\*').replace(/\./g, '\\.').replace(/!/g, '\\!');
    c = c.replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/-/g, '\\-').replace(/\+/g, '\\+');
    c = c.replace(/=/g, '\\=').replace(/~/g, '\\~').replace(/>/g, '\\>').replace(/#/g, '\\#');
    c = c.replace(/\|/g, '\\|').replace(/_/g, '\\_').replace(/`/g, '\\`');
    c = c.replace(/\[/g, '\\[').replace(/\]/g, '\\]').replace(/\{/g, '\\{').replace(/\}/g, '\\}');
    return '*' + c + '*';
  }

  const SEP = '━━━━━━━━━━━━━━━';
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sunday
  const dayOfMonth = now.getDate();

  // Load journal from Upstash
  const journalData = await kget('journal');
  const journal = Array.isArray(journalData) ? journalData :
    (typeof journalData === 'string' ? JSON.parse(journalData) : []);

  function getWeekStart() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay() - 7); // last week
    return d;
  }
  function getWeekEnd() {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    d.setDate(d.getDate() - d.getDay() - 1); // last Saturday
    return d;
  }
  function getMonthKey(d) {
    const dt = new Date(d);
    return dt.getFullYear() + '-' + (dt.getMonth() + 1);
  }
  function extractRR(text) {
    const m = text && text.match(/R:R Achieved[: ]+1:([0-9.]+)/);
    return m ? parseFloat(m[1]) : null;
  }

  function buildStatsMsg(label, entries) {
    const closes = entries.filter(j => j.type === 'close');
    const wins = closes.filter(j => j.text && j.text.includes('✅')).length;
    const losses = closes.filter(j => j.text && j.text.includes('❌')).length;
    const wr = closes.length > 0 ? Math.round((wins / closes.length) * 100) + '%' : 'N/A';
    const rrVals = closes.map(j => extractRR(j.text)).filter(v => v !== null);
    const avgRR = rrVals.length > 0 ? '1:' + (rrVals.reduce((a, b) => a + b, 0) / rrVals.length).toFixed(2) : 'N/A';
    const ideas = entries.filter(j => j.type === 'idea').length;
    const updates = entries.filter(j => j.type === 'update').length;

    const lines = [];
    lines.push(bold(label + '  יומן מסחר DJR'));
    lines.push(SEP);
    lines.push('עסקאות: ' + bold(String(closes.length)));
    lines.push('מנצחות ✅: ' + bold(String(wins)));
    lines.push('מפסידות ❌: ' + bold(String(losses)));
    lines.push('Win Rate: ' + bold(wr));
    lines.push('Avg R:R: ' + bold(avgRR));
    lines.push(esc('רעיונות') + ': ' + esc(String(ideas)));
    lines.push(esc('עדכונים') + ': ' + esc(String(updates)));
    lines.push(SEP);
    lines.push(esc('⚠️ כל הפרסומים הינם חלק מיומן מסחר אישי לצורכי לימוד בלבד. אין לראות בכך ייעוץ השקעות.'));
    return lines.join('\n');
  }

  let sent = false;

  // Sunday = send weekly stats for last week
  if (dayOfWeek === 0) {
    const weekStart = getWeekStart();
    const weekEnd = getWeekEnd();
    const weekEntries = journal.filter(j => {
      const d = new Date(j.date);
      return d >= weekStart && d <= weekEnd;
    });
    const msg = buildStatsMsg('📊 סיכום שבועי', weekEntries);
    await sendMsg(msg);
    sent = true;
  }

  // 1st of month = send monthly stats for last month
  if (dayOfMonth === 1) {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = getMonthKey(lastMonth);
    const monthEntries = journal.filter(j => j.date && getMonthKey(j.date) === lastMonthKey);
    const monthName = lastMonth.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
    const msg = buildStatsMsg('📈 סיכום חודשי  ' + monthName, monthEntries);
    await sendMsg(msg);
    sent = true;
  }

  return res.status(200).json({ ok: true, sent, day: dayOfWeek, date: dayOfMonth });
}
