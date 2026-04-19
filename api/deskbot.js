// DJR DeskBot - Telegram bot for quick trade posting
// Only responds to admin (ADMIN_TELEGRAM_ID)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const BOT_TOKEN = process.env.TG_BOT_TOKEN;
  const CHANNEL_ID = process.env.TG_CHAT_ID;
  const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID;
  const UPSTASH_URL = process.env.KV_REST_API_URL;
  const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN;

  const headers = { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' };

  async function kget(key) {
    try {
      const r = await fetch(`${UPSTASH_URL}/get/${key}`, { headers });
      const j = await r.json();
      if (!j.result) return null;
      return typeof j.result === 'string' ? JSON.parse(j.result) : j.result;
    } catch(e) { return null; }
  }
  async function kset(key, value) {
    try {
      await fetch(`${UPSTASH_URL}/set/${key}`, { method: 'POST', headers, body: JSON.stringify(value) });
    } catch(e) {}
  }
  async function kdel(key) {
    try { await fetch(`${UPSTASH_URL}/del/${key}`, { method: 'POST', headers }); } catch(e) {}
  }

  async function tg(method, body) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      return await r.json();
    } catch(e) { return { ok: false }; }
  }

  async function sendMsg(chatId, text, opts = {}) {
    return tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...opts });
  }

  async function sendButtons(chatId, text, buttons) {
    return tg('sendMessage', {
      chat_id: chatId, text, parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  }

  // ── MARKDOWN HELPERS ─────────────────────────────────────────
  function esc(s) {
    if (!s && s !== 0) return '';
    var c = String(s);
    ['_','*','[',']','(',')','.','+','-','=','{','}','!','|','~','`','#','>','\\'].forEach(ch => { c = c.split(ch).join('\\' + ch); });
    return c;
  }
  function bold(s) {
    if (!s && s !== 0) return '';
    var c = String(s);
    c = c.replace(/\\/g,'\\\\').replace(/\*/g,'\\*').replace(/\./g,'\\.').replace(/!/g,'\\!');
    c = c.replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/-/g,'\\-').replace(/\+/g,'\\+');
    c = c.replace(/=/g,'\\=').replace(/~/g,'\\~').replace(/>/g,'\\>').replace(/#/g,'\\#');
    c = c.replace(/\|/g,'\\|').replace(/_/g,'\\_').replace(/`/g,'\\`');
    c = c.replace(/\[/g,'\\[').replace(/\]/g,'\\]').replace(/\{/g,'\\{').replace(/\}/g,'\\}');
    return '*' + c + '*';
  }
  const SEP = '━━━━━━━━━━━━━━━';
  const DISC = 'תוכן זה הינו חלק מיומן מסחר אישי לצורכי לימוד בלבד\\. אין לראות בכך ייעוץ השקעות\\. כל החלטה היא באחריות הקורא בלבד\\.';

  // ── BUILD MESSAGES ───────────────────────────────────────────
  function buildIdeaMsg(d) {
    const lines = [];
    lines.push(bold('📋 רעיון מקדים  יומן מסחר DJR'));
    lines.push(SEP);
    if (d.ticker || d.tf) lines.push('📊 ' + bold(d.ticker || 'US500') + (d.tf ? '  ⏱ ' + esc(d.tf) : ''));
    if (d.bias) lines.push(d.bias === 'bull' ? 'כיוון מצופה: 📈 עולה' : 'כיוון מצופה: 📉 יורד');
    if (d.tp) lines.push('TP: ' + bold(d.tp));
    if (d.entry) lines.push('Entry: ' + bold(d.entry));
    if (d.sl) lines.push('Stop Loss: ' + bold(d.sl));
    if (d.entry && d.sl && d.tp) {
      const rr = (Math.abs(d.tp - d.entry) / Math.abs(d.entry - d.sl)).toFixed(2);
      lines.push('סיכון/סיכוי: ' + bold('1:' + rr));
    }
    if (d.related) lines.push('נכסים אופציונאליים בהתאמה: ' + esc(d.related));
    if (d.comment) lines.push('', esc(d.comment));
    lines.push(SEP);
    lines.push('⚠️ ' + DISC);
    return lines.join('\n');
  }

  function buildTradeMsg(d) {
    const lines = [];
    lines.push(bold('📌 תיעוד עסקה  יומן מסחר DJR'));
    lines.push(SEP);
    if (d.ticker || d.tf) lines.push('📊 ' + bold(d.ticker || 'US500') + (d.tf ? '  ⏱ ' + esc(d.tf) : ''));
    if (d.bias) lines.push(d.bias === 'bull' ? 'כיוון: 📈 עולה' : 'כיוון: 📉 יורד');
    if (d.tp) lines.push('TP: ' + bold(d.tp));
    if (d.entry) lines.push('Entry: ' + bold(d.entry));
    if (d.sl) lines.push('Stop Loss: ' + bold(d.sl));
    if (d.entry && d.sl && d.tp) {
      const rr = (Math.abs(d.tp - d.entry) / Math.abs(d.entry - d.sl)).toFixed(2);
      lines.push('סיכון/סיכוי: ' + bold('1:' + rr));
    }
    if (d.comment) lines.push('', esc(d.comment));
    lines.push(SEP);
    lines.push('⚠️ ' + DISC);
    return lines.join('\n');
  }

  function buildUpdateMsg(d) {
    const utypeLabels = { sl: 'Move Stop Loss', partial: 'Partial Close', add: 'Add to Position' };
    const lines = [];
    lines.push(bold('🔄 ניהול עסקה  יומן מסחר DJR'));
    lines.push(esc(utypeLabels[d.utype] || 'Update'));
    lines.push(SEP);
    if (d.ticker) lines.push('📊 ' + bold(d.ticker));
    if (d.tp) lines.push('Updated TP: ' + bold(d.tp));
    if (d.sl) lines.push('Updated Stop Loss: ' + bold(d.sl));
    if (d.pct) lines.push('% Position: ' + bold(d.pct));
    if (d.comment) lines.push('', esc(d.comment));
    lines.push(SEP);
    lines.push('⚠️ ' + DISC);
    return lines.join('\n');
  }

  function buildCloseMsg(d) {
    const isProfit = parseFloat(d.exit) > parseFloat(d.entry);
    const lines = [];
    lines.push(bold((isProfit ? '✅ ' : '❌ ') + 'סגירת עסקה  יומן מסחר DJR'));
    lines.push(SEP);
    if (d.ticker || d.tf) lines.push('📊 ' + bold(d.ticker || 'US500') + (d.tf ? '  ⏱ ' + esc(d.tf) : ''));
    if (d.tp) lines.push('TP: ' + bold(d.tp));
    if (d.entry) lines.push('Entry: ' + bold(d.entry));
    if (d.exit) lines.push('Exit: ' + bold(d.exit));
    if (d.sl) lines.push('Stop Loss: ' + bold(d.sl));
    if (d.entry && d.sl && d.exit) {
      const rr = (Math.abs(d.exit - d.entry) / Math.abs(d.entry - d.sl)).toFixed(2);
      lines.push('🎯 R:R Achieved: ' + bold('1:' + rr));
    }
    if (d.reason) lines.push('סיבת סגירה: ' + esc(d.reason));
    if (d.comment) lines.push('', esc(d.comment));
    lines.push(SEP);
    lines.push('⚠️ ' + DISC);
    return lines.join('\n');
  }

  function buildNoSetupMsg() {
    const lines = [];
    lines.push(bold('📵 עדכון יומי  יומן מסחר DJR'));
    lines.push(SEP);
    lines.push('השוק לא מייצר סט אפ נדרש \\— הוחלט לא לבצע עסקאות היום\\.');
    lines.push('');
    lines.push('The market is not producing the required setup \\— decided not to trade today\\.');
    lines.push(SEP);
    lines.push('⚠️ ' + DISC);
    return lines.join('\n');
  }

  // ── POST TO CHANNEL ──────────────────────────────────────────
  async function postToChannel(text, photoFileId, caption) {
    if (photoFileId) {
      const finalCaption = caption ? text + '\n\n' + esc(caption) : text;
      return tg('sendPhoto', { chat_id: CHANNEL_ID, photo: photoFileId, caption: finalCaption, parse_mode: 'MarkdownV2' });
    }
    return tg('sendMessage', { chat_id: CHANNEL_ID, text, parse_mode: 'MarkdownV2' });
  }

  // ── SAVE JOURNAL TO UPSTASH ──────────────────────────────────
  async function saveToJournal(type, text) {
    try {
      const journalData = await kget('journal');
      let journal = Array.isArray(journalData) ? journalData :
        (typeof journalData === 'string' ? JSON.parse(journalData) : []);
      journal.unshift({
        type, text,
        time: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toISOString()
      });
      await kset('journal', JSON.stringify(journal));
    } catch(e) {}
  }

  // ── PROCESS UPDATE ───────────────────────────────────────────
  const update = req.body;
  const msg = update.message || update.callback_query?.message;
  const callbackQuery = update.callback_query;

  const userId = callbackQuery ? callbackQuery.from.id : msg?.from?.id;
  const chatId = callbackQuery ? callbackQuery.message.chat.id : msg?.chat?.id;

  // Only respond to admin
  if (!userId || String(userId) !== String(ADMIN_ID)) {
    return res.status(200).json({ ok: true });
  }

  // ── HANDLE CALLBACK BUTTONS ──────────────────────────────────
  if (callbackQuery) {
    await tg('answerCallbackQuery', { callback_query_id: callbackQuery.id });
    const data = callbackQuery.data;
    const state = await kget('deskbot_state:' + userId);

    // Message type selection
    if (data === 'type_idea' || data === 'type_trade' || data === 'type_update' || data === 'type_close') {
      const type = data.replace('type_', '');
      await kset('deskbot_state:' + userId, JSON.stringify({ ...state, type, step: 'bias' }));
      await sendButtons(chatId, '📈 כיוון?', [[
        { text: '📈 Bull', callback_data: 'bias_bull' },
        { text: '📉 Bear', callback_data: 'bias_bear' }
      ]]);
      return res.status(200).json({ ok: true });
    }

    if (data === 'type_nosetup') {
      const msg2 = buildNoSetupMsg();
      await postToChannel(msg2, null, null);
      await saveToJournal('nosetup', msg2);
      await kdel('deskbot_state:' + userId);
      await sendMsg(chatId, '✅ נשלח לערוץ!');
      return res.status(200).json({ ok: true });
    }

    if (data === 'bias_bull' || data === 'bias_bear') {
      const bias = data === 'bias_bull' ? 'bull' : 'bear';
      const newState = { ...state, bias };
      if (newState.type === 'update') {
        newState.step = 'ticker';
        await kset('deskbot_state:' + userId, JSON.stringify(newState));
        await sendMsg(chatId, '📊 נכס? (Enter להשמיט, default: US500)');
      } else {
        newState.step = 'ticker';
        await kset('deskbot_state:' + userId, JSON.stringify(newState));
        await sendMsg(chatId, '📊 נכס? (Enter להשמיט, default: US500)');
      }
      return res.status(200).json({ ok: true });
    }

    // Update type selection
    if (data === 'utype_sl' || data === 'utype_partial' || data === 'utype_add') {
      const utype = data.replace('utype_', '');
      const newState = { ...state, utype, step: 'ticker' };
      await kset('deskbot_state:' + userId, JSON.stringify(newState));
      await sendMsg(chatId, '📊 נכס? (Enter להשמיט, default: US500)');
      return res.status(200).json({ ok: true });
    }

    // Post options
    if (data === 'post_now') {
      const builtMsg = buildMessage(state);
      await postToChannel(builtMsg, state.photoId || null, state.comment || null);
      await saveToJournal(state.type, builtMsg);
      await kdel('deskbot_state:' + userId);
      await sendMsg(chatId, '✅ נשלח לערוץ!');
      return res.status(200).json({ ok: true });
    }
    if (data === 'post_photo') {
      await kset('deskbot_state:' + userId, JSON.stringify({ ...state, waiting: 'photo' }));
      await sendMsg(chatId, '📸 שלח תמונה:');
      return res.status(200).json({ ok: true });
    }
    if (data === 'post_comment') {
      await kset('deskbot_state:' + userId, JSON.stringify({ ...state, waiting: 'comment' }));
      await sendMsg(chatId, '✏️ שלח הערה:');
      return res.status(200).json({ ok: true });
    }
    if (data === 'post_both') {
      await kset('deskbot_state:' + userId, JSON.stringify({ ...state, waiting: 'photo_then_comment' }));
      await sendMsg(chatId, '📸 שלח תמונה תחילה:');
      return res.status(200).json({ ok: true });
    }
    if (data === 'post_confirm') {
      const builtMsg = buildMessage(state);
      await postToChannel(builtMsg, state.photoId, state.comment);
      await saveToJournal(state.type, builtMsg);
      await kdel('deskbot_state:' + userId);
      await sendMsg(chatId, '✅ נשלח לערוץ!');
      return res.status(200).json({ ok: true });
    }

    // Close reason
    if (data.startsWith('reason_')) {
      const reason = data.replace('reason_', '');
      const newState = { ...state, reason, step: 'done' };
      await kset('deskbot_state:' + userId, JSON.stringify(newState));
      await showPreview(chatId, newState);
      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true });
  }

  // ── HANDLE TEXT/PHOTO MESSAGES ───────────────────────────────
  if (!msg) return res.status(200).json({ ok: true });
  const text = msg.text || '';
  const photo = msg.photo;

  // ── COMMANDS ─────────────────────────────────────────────────
  if (text === '/idea' || text === 'idea') {
    await kset('deskbot_state:' + userId, JSON.stringify({ type: 'idea', step: 'bias' }));
    await sendButtons(chatId, '📋 <b>רעיון מקדים</b>\n\nכיוון מצופה?', [[
      { text: '📈 Bull', callback_data: 'bias_bull' },
      { text: '📉 Bear', callback_data: 'bias_bear' }
    ]]);
    return res.status(200).json({ ok: true });
  }

  if (text === '/trade' || text === 'trade') {
    await kset('deskbot_state:' + userId, JSON.stringify({ type: 'trade', step: 'bias' }));
    await sendButtons(chatId, '📌 <b>תיעוד עסקה</b>\n\nכיוון?', [[
      { text: '📈 Bull', callback_data: 'bias_bull' },
      { text: '📉 Bear', callback_data: 'bias_bear' }
    ]]);
    return res.status(200).json({ ok: true });
  }

  if (text === '/update' || text === 'update') {
    await kset('deskbot_state:' + userId, JSON.stringify({ type: 'update', step: 'utype' }));
    await sendButtons(chatId, '🔄 <b>ניהול עסקה</b>\n\nסוג עדכון?', [[
      { text: 'Move Stop Loss', callback_data: 'utype_sl' }
    ], [
      { text: 'Partial Close', callback_data: 'utype_partial' },
      { text: 'Add to Position', callback_data: 'utype_add' }
    ]]);
    return res.status(200).json({ ok: true });
  }

  if (text === '/close' || text === 'close') {
    await kset('deskbot_state:' + userId, JSON.stringify({ type: 'close', step: 'bias' }));
    await sendButtons(chatId, '❌ <b>סגירת עסקה</b>\n\nכיוון המקורי?', [[
      { text: '📈 Bull', callback_data: 'bias_bull' },
      { text: '📉 Bear', callback_data: 'bias_bear' }
    ]]);
    return res.status(200).json({ ok: true });
  }

  if (text === '/nosetup' || text.toLowerCase() === 'no setup' || text.toLowerCase() === 'nosetup') {
    const noSetupMsg = buildNoSetupMsg();
    await postToChannel(noSetupMsg, null, null);
    await saveToJournal('nosetup', noSetupMsg);
    await sendMsg(chatId, '✅ נשלח לערוץ!');
    return res.status(200).json({ ok: true });
  }

  if (text === '/start' || text === '/help') {
    await sendMsg(chatId, `🤖 <b>DJR DeskBot</b>\n\nפקודות זמינות:\n/idea — רעיון מקדים\n/trade — תיעוד עסקה\n/update — ניהול עסקה\n/close — סגירת עסקה\n/nosetup — אין סט אפ היום`);
    return res.status(200).json({ ok: true });
  }

  // Show main menu if no command
  if (!text.startsWith('/') && !(await kget('deskbot_state:' + userId))) {
    await sendButtons(chatId, '📊 <b>DJR Trading Journal</b>\n\nבחר סוג הודעה:', [
      [{ text: '📋 רעיון מקדים', callback_data: 'type_idea' }, { text: '📌 תיעוד עסקה', callback_data: 'type_trade' }],
      [{ text: '🔄 ניהול עסקה', callback_data: 'type_update' }, { text: '❌ סגירת עסקה', callback_data: 'type_close' }],
      [{ text: '📵 אין סט אפ היום', callback_data: 'type_nosetup' }]
    ]);
    return res.status(200).json({ ok: true });
  }

  // ── HANDLE STATE MACHINE ─────────────────────────────────────
  const stateData = await kget('deskbot_state:' + userId);
  if (!stateData) return res.status(200).json({ ok: true });
  let state = typeof stateData === 'string' ? JSON.parse(stateData) : stateData;

  // Handle waiting for photo
  if (state.waiting === 'photo' || state.waiting === 'photo_then_comment') {
    if (photo && photo.length > 0) {
      const photoId = photo[photo.length - 1].file_id;
      if (state.waiting === 'photo_then_comment') {
        await kset('deskbot_state:' + userId, JSON.stringify({ ...state, photoId, waiting: 'comment' }));
        await sendMsg(chatId, '✏️ עכשיו שלח הערה:');
      } else {
        state = { ...state, photoId, waiting: null };
        await kset('deskbot_state:' + userId, JSON.stringify(state));
        await showPreview(chatId, state);
      }
    } else {
      await sendMsg(chatId, '📸 שלח תמונה בבקשה');
    }
    return res.status(200).json({ ok: true });
  }

  // Handle waiting for comment
  if (state.waiting === 'comment') {
    state = { ...state, comment: text, waiting: null };
    await kset('deskbot_state:' + userId, JSON.stringify(state));
    await showPreview(chatId, state);
    return res.status(200).json({ ok: true });
  }

  // ── STEP BY STEP FORM ─────────────────────────────────────────
  const skip = text === '-' || text === 'skip' || text === 'ס';

  if (state.step === 'ticker') {
    state.ticker = skip ? 'US500' : text;
    if (state.type === 'update') {
      state.step = 'new_sl';
      await kset('deskbot_state:' + userId, JSON.stringify(state));
      await sendMsg(chatId, 'Updated Stop Loss? (- להשמיט)');
    } else {
      state.step = 'tf';
      await kset('deskbot_state:' + userId, JSON.stringify(state));
      await sendMsg(chatId, '⏱ גרף? (default: 5min, - להשמיט)');
    }
    return res.status(200).json({ ok: true });
  }

  if (state.step === 'tf') {
    state.tf = skip ? '5min' : text;
    state.step = 'tp';
    await kset('deskbot_state:' + userId, JSON.stringify(state));
    await sendMsg(chatId, state.type === 'close' ? 'TP המקורי? (- להשמיט)' : 'TP?');
    return res.status(200).json({ ok: true });
  }

  if (state.step === 'tp') {
    state.tp = skip ? null : parseFloat(text) || text;
    state.step = 'entry';
    await kset('deskbot_state:' + userId, JSON.stringify(state));
    await sendMsg(chatId, 'Entry?');
    return res.status(200).json({ ok: true });
  }

  if (state.step === 'entry') {
    state.entry = skip ? null : parseFloat(text) || text;
    state.step = 'sl';
    await kset('deskbot_state:' + userId, JSON.stringify(state));
    await sendMsg(chatId, 'Stop Loss?');
    return res.status(200).json({ ok: true });
  }

  if (state.step === 'sl') {
    state.sl = skip ? null : parseFloat(text) || text;
    if (state.type === 'close') {
      state.step = 'exit';
      await kset('deskbot_state:' + userId, JSON.stringify(state));
      await sendMsg(chatId, 'Exit?');
    } else {
      state.step = 'related';
      await kset('deskbot_state:' + userId, JSON.stringify(state));
      await sendMsg(chatId, 'נכסים אופציונליים? (default: ES1!, - להשמיט)');
    }
    return res.status(200).json({ ok: true });
  }

  if (state.step === 'exit') {
    state.exit = skip ? null : parseFloat(text) || text;
    state.step = 'close_reason';
    await kset('deskbot_state:' + userId, JSON.stringify(state));
    await sendButtons(chatId, 'סיבת סגירה?', [
      [{ text: 'TP', callback_data: 'reason_TP' }, { text: 'SL', callback_data: 'reason_SL' }],
      [{ text: 'Trailing', callback_data: 'reason_Trailing' }, { text: 'Manual Close', callback_data: 'reason_Manual Close' }]
    ]);
    return res.status(200).json({ ok: true });
  }

  if (state.step === 'related') {
    state.related = skip ? 'ES1!' : text;
    state.step = 'done';
    await kset('deskbot_state:' + userId, JSON.stringify(state));
    await showPreview(chatId, state);
    return res.status(200).json({ ok: true });
  }

  if (state.step === 'new_sl') {
    state.sl = skip ? null : text;
    state.step = 'new_tp';
    await kset('deskbot_state:' + userId, JSON.stringify(state));
    await sendMsg(chatId, 'Updated TP? (- להשמיט)');
    return res.status(200).json({ ok: true });
  }

  if (state.step === 'new_tp') {
    state.tp = skip ? null : text;
    if (state.utype === 'partial' || state.utype === 'add') {
      state.step = 'pct';
      await kset('deskbot_state:' + userId, JSON.stringify(state));
      await sendMsg(chatId, '% מהפוזיציה? (- להשמיט)');
    } else {
      state.step = 'done';
      await kset('deskbot_state:' + userId, JSON.stringify(state));
      await showPreview(chatId, state);
    }
    return res.status(200).json({ ok: true });
  }

  if (state.step === 'pct') {
    state.pct = skip ? null : text;
    state.step = 'done';
    await kset('deskbot_state:' + userId, JSON.stringify(state));
    await showPreview(chatId, state);
    return res.status(200).json({ ok: true });
  }

  // ── HELPER FUNCTIONS ─────────────────────────────────────────
  function buildMessage(s) {
    if (s.type === 'idea') return buildIdeaMsg(s);
    if (s.type === 'trade') return buildTradeMsg(s);
    if (s.type === 'update') return buildUpdateMsg(s);
    if (s.type === 'close') return buildCloseMsg(s);
    if (s.type === 'nosetup') return buildNoSetupMsg();
    return '';
  }

  async function showPreview(chatId, s) {
    const preview = buildMessage(s);
    console.log('PREVIEW STATE:', JSON.stringify(s));
    console.log('PREVIEW MSG:', preview ? preview.substring(0,100) : 'EMPTY');
    const plainText = preview || 'No message built';
    await sendMsg(chatId, '👁 Preview:\n\n' + plainText.substring(0,500));
    await sendButtons(chatId, 'מה לעשות?', [
      [{ text: '✅ שלח עכשיו', callback_data: 'post_now' }],
      [{ text: '📸 הוסף תמונה', callback_data: 'post_photo' }, { text: '✏️ הוסף הערה', callback_data: 'post_comment' }],
      [{ text: '📸✏️ תמונה + הערה', callback_data: 'post_both' }]
    ]);
  }

  return res.status(200).json({ ok: true });
}
