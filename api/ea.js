export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, *');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const UPSTASH_URL   = process.env.KV_REST_API_URL;
  const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN;
  const BOT_TOKEN     = process.env.TG_BOT_TOKEN;
  const CHANNEL_ID    = process.env.TG_CHAT_ID;

  const hdr = { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' };

  console.log('EA endpoint hit, method:', req.method);

  // Handle GET for testing
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, message: 'EA endpoint ready' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e) {} }
  
  console.log('Body received:', JSON.stringify(body).substring(0, 200));

  if (!body || !body.type) {
    return res.status(200).json({ ok: false, error: 'no type in body' });
  }

  const SEP  = '━━━━━━━━━━━━━━━';
  const DISC = '⚠️ תוכן זה הינו חלק מיומן מסחר אישי לצורכי לימוד בלבד\\. אין לראות בכך ייעוץ השקעות\\. כל החלטה היא באחריות הקורא בלבד\\.';

  function bold(s) {
    if (!s && s !== 0) return '';
    let c = String(s);
    c = c.replace(/\\/g,'\\\\').replace(/\*/g,'\\*').replace(/\./g,'\\.').replace(/!/g,'\\!');
    c = c.replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/-/g,'\\-').replace(/\+/g,'\\+');
    c = c.replace(/=/g,'\\=').replace(/~/g,'\\~').replace(/>/g,'\\>').replace(/#/g,'\\#');
    c = c.replace(/\|/g,'\\|').replace(/_/g,'\\_').replace(/`/g,'\\`');
    c = c.replace(/\[/g,'\\[').replace(/\]/g,'\\]').replace(/\{/g,'\\{').replace(/\}/g,'\\}');
    return '*' + c + '*';
  }
  function esc(s) {
    if (!s && s !== 0) return '';
    let c = String(s);
    ['_','*','[',']','(',')','.','+','-','=','{','}','!','|','~','`','#','>','\\'].forEach(ch => { c = c.split(ch).join('\\' + ch); });
    return c;
  }

  const t = body.type;
  const sym = body.ticker || 'US500CFD';
  const tf  = body.tf || '5min';
  const sess = body.session || 'NY';
  let msg = '';

  if (t === 'idea') {
    const entryLabel = body.bias === 'bull' ? 'Entry after close above' : 'Entry after close below';
    const lines = [
      bold('📋 רעיון מקדים  יומן מסחר DJR'), SEP,
      '📊 ' + bold(sym) + '  ⏱ ' + esc(tf) + '  🕐 ' + esc(sess),
      body.bias === 'bull' ? 'כיוון מצופה: 📈 עולה' : 'כיוון מצופה: 📉 יורד',
      body.tp    ? 'Planned TP: ' + bold(body.tp) : '',
      body.entry ? entryLabel + ': ' + bold(body.entry) : '',
      body.sl    ? 'Estimated Stop Loss: ' + bold(body.sl) : '',
      body.rr    ? 'סיכון/סיכוי: ' + bold(body.rr) : '',
      body.riskPct ? 'חשיפת חשבון: ' + bold(body.riskPct) : '',
      body.related ? 'נכסים אופציונאליים בהתאמה: ' + esc(body.related) : '',
      body.comment ? '\n' + esc(body.comment) : '',
      SEP, DISC
    ];
    msg = lines.filter(Boolean).join('\n');
  }
  else if (t === 'trade') {
    const lines = [
      bold('📌 תיעוד עסקה  יומן מסחר DJR'), SEP,
      '📊 ' + bold(sym) + '  ⏱ ' + esc(tf) + '  🕐 ' + esc(sess),
      body.bias === 'bull' ? 'כיוון: 📈 עולה' : 'כיוון: 📉 יורד',
      body.tp    ? 'TP: ' + bold(body.tp) : '',
      body.entry ? 'Entry: ' + bold(body.entry) : '',
      body.sl    ? 'Stop Loss: ' + bold(body.sl) : '',
      body.rr    ? 'סיכון/סיכוי: ' + bold(body.rr) : '',
      body.riskPct ? 'חשיפת חשבון: ' + bold(body.riskPct) : '',
      body.lots  ? 'Lots: ' + bold(body.lots) : '',
      body.comment ? '\n' + esc(body.comment) : '',
      SEP, DISC
    ];
    msg = lines.filter(Boolean).join('\n');
  }
  else if (t === 'update') {
    let utypeLbl;
    if(body.utype==='partial') utypeLbl='Partial Close';
    else if(body.utype==='add') utypeLbl='Add to Position';
    else if(body.utype==='sltp') utypeLbl='Move Stop Loss / TP';
    else if(body.utype==='tp') utypeLbl='Move Take Profit';
    else if(body.utype==='sl') utypeLbl='Move Stop Loss';
    else utypeLbl='Update';
    const lines = [
      bold('🔄 ניהול עסקה  יומן מסחר DJR'),
      esc(utypeLbl), SEP,
      '📊 ' + bold(sym),
      body.sl  ? 'Updated Stop Loss: ' + bold(body.sl) : '',
      body.tp  ? 'Updated TP: ' + bold(body.tp) : '',
      body.pct ? '% Position: ' + bold(body.pct) : '',
      body.entry ? 'Add Level: ' + bold(body.entry) : '',
      SEP, DISC
    ];
    msg = lines.filter(Boolean).join('\n');
  }
  else if (t === 'close') {
    const icon = body.reason === 'TP' ? '✅' : body.reason === 'SL' ? '❌' : '🔄';
    const lines = [
      bold(icon + ' סגירת עסקה  יומן מסחר DJR'), SEP,
      '📊 ' + bold(sym) + '  ⏱ ' + esc(tf) + '  🕐 ' + esc(sess),
      body.exit   ? 'Exit: ' + bold(body.exit) : '',
      body.rr     ? '🎯 R:R Achieved: ' + bold(body.rr) : '',
      body.profit ? 'P&L: ' + bold(body.profit) : '',
      body.reason ? 'סיבת סגירה: ' + bold(esc(body.reason)) : '',
      SEP, DISC
    ];
    msg = lines.filter(Boolean).join('\n');
  }
  else if (t === 'nosetup') {
    msg = bold('📵 עדכון יומי  יומן מסחר DJR') + '\n' + SEP +
          '\nהשוק לא מייצר סט אפ נדרש \\— הוחלט לא לבצע עסקאות היום\\.' +
          '\n\nThe market is not producing the required setup \\— decided not to trade today\\.' +
          '\n' + SEP + '\n' + DISC;
  }

  if (msg) {
    // Load token from settings
    let token = BOT_TOKEN;
    let chatId = CHANNEL_ID;
    try {
      const sr = await fetch(`${UPSTASH_URL}/get/settings`, { headers: hdr });
      const sj = await sr.json();
      if (sj.result) {
        const settings = typeof sj.result === 'string' ? JSON.parse(sj.result) : sj.result;
        if (settings.token) token = settings.token;
        if (settings.chatId) chatId = settings.chatId;
      }
    } catch(e) { console.log('Settings load error:', e.message); }

    console.log('Posting to Telegram, token exists:', !!token, 'chatId:', chatId);

    if (token && chatId) {
      const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'MarkdownV2' })
      });
      const tgJ = await tgRes.json();
      console.log('Telegram result:', JSON.stringify(tgJ).substring(0, 200));

      // Save to journal
      try {
        const jr = await fetch(`${UPSTASH_URL}/get/journal`, { headers: hdr });
        const jj = await jr.json();
        let journal = [];
        if (jj.result && jj.result !== 'nil') {
          journal = typeof jj.result === 'string' ? JSON.parse(jj.result) : jj.result;
        }
        journal.unshift({
          type: t, text: msg,
          time: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' }),
          date: new Date().toISOString()
        });
        await fetch(`${UPSTASH_URL}/set/journal`, { method: 'POST', headers: hdr, body: JSON.stringify(JSON.stringify(journal)) });
      } catch(e) { console.log('Journal save error:', e.message); }

      return res.status(200).json({ ok: tgJ.ok, sent: true });
    }
  }

  // Handle screenshot
  if (t === 'screenshot' && body.image) {
    let token = BOT_TOKEN;
    let chatId = CHANNEL_ID;
    try {
      const sr = await fetch(`${UPSTASH_URL}/get/settings`, { headers: hdr });
      const sj = await sr.json();
      if (sj.result) {
        const settings = typeof sj.result === 'string' ? JSON.parse(sj.result) : sj.result;
        if (settings.token) token = settings.token;
        if (settings.chatId) chatId = settings.chatId;
      }
    } catch(e) {}

    if (token && chatId) {
      const imgBuffer = Buffer.from(body.image, 'base64');
      const caption = `📸 Chart Screenshot\n${esc(sym)}  🕐 ${esc(sess)}${body.comment ? '\n' + esc(body.comment) : ''}`;
      
      const { FormData, Blob } = await import('node:buffer').then(() => globalThis);
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('caption', caption);
      formData.append('photo', new Blob([imgBuffer], { type: 'image/png' }), 'chart.png');

      const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: 'POST',
        body: formData
      });
      const tgJ = await tgRes.json();
      console.log('Screenshot result:', JSON.stringify(tgJ).substring(0, 200));
      return res.status(200).json({ ok: tgJ.ok, sent: true, type: 'screenshot' });
    }
  }

  return res.status(200).json({ ok: true, sent: false, type: t });
}
