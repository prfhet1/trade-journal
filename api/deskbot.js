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
      const r = await fetch(`${UPSTASH_URL}`, {
        method: 'POST', headers,
        body: JSON.stringify(['GET', key])
      });
      const j = await r.json();
      console.log('kget', key, '->', JSON.stringify(j).substring(0,80));
      if (!j.result || j.result === 'nil') return null;
      if (typeof j.result === 'string') {
        try { return JSON.parse(j.result); } catch(e) { return j.result; }
      }
      return j.result;
    } catch(e) { console.log('kget err:', e.message); return null; }
  }
  async function kset(key, value) {
    try {
      const strValue = typeof value === 'string' ? value : JSON.stringify(value);
      const r = await fetch(`${UPSTASH_URL}`, {
        method: 'POST', headers,
        body: JSON.stringify(['SET', key, strValue])
      });
      const j = await r.json();
      console.log('kset', key, '->', j.result);
    } catch(e) { console.log('kset error:', e.message); }
  }
  async function kdel(key) {
    try {
      await fetch(`${UPSTASH_URL}`, {
        method: 'POST', headers,
        body: JSON.stringify(['DEL', key])
      });
    } catch(e) {}
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
    if (d.ticker || d.tf) lines.push('📊 ' + bold(d.ticker || 'US500CFD') + (d.tf ? '  ⏱ ' + esc(d.tf) : '') + (d.session ? '  🕐 ' + esc(d.session) : ''));
    if (d.bias) lines.push(d.bias === 'bull' ? 'כיוון מצופה: 📈 עולה' : 'כיוון מצופה: 📉 יורד');
    if (d.tp) lines.push('Planned TP: ' + bold(d.tp));
    const entryLabel = d.bias === 'bull' ? 'Entry after close above' : 'Entry after close below';
    if (d.entry) lines.push(entryLabel + ': ' + bold(d.entry));
    if (d.sl) lines.push('Estimated Stop Loss: ' + bold(d.sl));
    if (d.entry && d.sl && d.tp) {
      const rr = (Math.abs(d.tp - d.entry) / Math.abs(d.entry - d.sl)).toFixed(2);
      lines.push('סיכון/סיכוי: ' + bold('1:' + rr));
    }
    if (d.riskPct) lines.push('חשיפת חשבון: ' + bold(d.riskPct));
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
    if (d.ticker || d.tf) lines.push('📊 ' + bold(d.ticker || 'US500CFD') + (d.tf ? '  ⏱ ' + esc(d.tf) : '') + (d.session ? '  🕐 ' + esc(d.session) : ''));
    if (d.bias) lines.push(d.bias === 'bull' ? 'כיוון: 📈 עולה' : 'כיוון: 📉 יורד');
    if (d.tp) lines.push('Planned TP: ' + bold(d.tp));
    const entryLabel = d.bias === 'bull' ? 'Entry after close above' : 'Entry after close below';
    if (d.entry) lines.push(entryLabel + ': ' + bold(d.entry));
    if (d.sl) lines.push('Estimated Stop Loss: ' + bold(d.sl));
    if (d.entry && d.sl && d.tp) {
      const rr = (Math.abs(d.tp - d.entry) / Math.abs(d.entry - d.sl)).toFixed(2);
      lines.push('סיכון/סיכוי: ' + bold('1:' + rr));
    }
    if (d.riskPct) lines.push('חשיפת חשבון: ' + bold(d.riskPct));
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
    if (d.ticker) lines.push('📊 ' + bold(d.ticker) + (d.session ? '  🕐 ' + esc(d.session) : ''));
    if (d.utype === 'sl' && d.sl) lines.push('Updated Stop Loss: ' + bold(d.sl));
    if (d.utype === 'partial' && d.pct) lines.push('Partial Close: ' + bold(d.pct + '%'));
    if (d.utype === 'add') {
      if (d.entry) lines.push('Add Level: ' + bold(d.entry));
      if (d.pct) lines.push('% Added: ' + bold(d.pct + '%'));
    }
    if (d.comment) lines.push('', esc(d.comment));
    lines.push(SEP);
    lines.push('⚠️ ' + DISC);
    return lines.join('\n');
  }

  function buildCloseMsg(d) {
    const icon = d.reason === 'TP' ? '✅' : d.reason === 'SL' ? '❌' : '🔄';
    const lines = [];
    lines.push(bold(icon + ' סגירת עסקה  יומן מסחר DJR'));
    lines.push(SEP);
    if (d.ticker || d.tf) lines.push('📊 ' + bold(d.ticker || 'US500CFD') + (d.tf ? '  ⏱ ' + esc(d.tf) : '') + (d.session ? '  🕐 ' + esc(d.session) : ''));
    if (d.exit) lines.push('Exit: ' + bold(d.exit));
    if (d.reason) lines.push('סיבת סגירה: ' + bold(esc(d.reason)));
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
      let journal = [];
      if (journalData) {
        journal = Array.isArray(journalData) ? journalData :
          (typeof journalData === 'string' ? JSON.parse(journalData) : []);
      }
      journal.unshift({
        type, text,
        time: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' }),
        date: new Date().toISOString()
      });
      await kset('journal', JSON.stringify(journal));
      console.log('Saved to journal, type:', type, 'total:', journal.length);
    } catch(e) { console.log('saveToJournal error:', e.message); }
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
    const state = await kget('deskbot_' + userId);

    // Message type selection
    if (data === 'type_idea' || data === 'type_trade' || data === 'type_update' || data === 'type_close') {
      const type = data.replace('type_', '');
      if (type === 'update') {
        await kset('deskbot_' + userId, JSON.stringify({ type: 'update', step: 'utype' }));
        await sendButtons(chatId, '🔄 <b>ניהול עסקה</b>\n\nסוג עדכון?', [
          [{ text: 'Move Stop Loss', callback_data: 'utype_sl' }],
          [{ text: 'Partial Close', callback_data: 'utype_partial' }],
          [{ text: 'Add to Position', callback_data: 'utype_add' }]
        ]);
      } else {
        await kset('deskbot_' + userId, JSON.stringify({ ...state, type, step: 'bias' }));
        await sendButtons(chatId, '📈 כיוון?', [[
          { text: '📈 Bull', callback_data: 'bias_bull' },
          { text: '📉 Bear', callback_data: 'bias_bear' }
        ]]);
      }
      return res.status(200).json({ ok: true });
    }

    if (data === 'type_nosetup') {
      const msg2 = buildNoSetupMsg();
      await postToChannel(msg2, null, null);
      await saveToJournal('nosetup', msg2);
      await kdel('deskbot_' + userId);
      await sendMsg(chatId, '✅ נשלח לערוץ!');
      return res.status(200).json({ ok: true });
    }

    if (data === 'bias_bull' || data === 'bias_bear') {
      const bias = data === 'bias_bull' ? 'bull' : 'bear';
      const newState = { ...state, bias };
      newState.step = 'ticker';
      await kset('deskbot_' + userId, JSON.stringify(newState));
      await sendMsg(chatId, '📊 נכס? (default: US500, - להשמיט)');
      return res.status(200).json({ ok: true });
    }

    // Update type selection - each goes to its own flow
    if (data === 'utype_sl') {
      await kset('deskbot_' + userId, JSON.stringify({ type: 'update', utype: 'sl', step: 'new_sl', ticker: 'US500CFD' }));
      await sendMsg(chatId, 'Updated Stop Loss?');
      return res.status(200).json({ ok: true });
    }
    if (data === 'utype_partial') {
      await kset('deskbot_' + userId, JSON.stringify({ type: 'update', utype: 'partial', step: 'pct', ticker: 'US500CFD' }));
      await sendMsg(chatId, '% מהפוזיציה? (e.g. 50%)');
      return res.status(200).json({ ok: true });
    }
    if (data === 'utype_add') {
      await kset('deskbot_' + userId, JSON.stringify({ type: 'update', utype: 'add', step: 'add_level', ticker: 'US500CFD' }));
      await sendMsg(chatId, 'רמת הוספה? (Entry level)');
      return res.status(200).json({ ok: true });
    }

    // Edit fields
    if (data === 'edit_fields') {
      const s = typeof state === 'string' ? JSON.parse(state) : state;
      const type = s.type;
      let editButtons = [];
      if (type === 'idea') {
        editButtons = [
          [{ text: '📈📉 Bias', callback_data: 'edit_bias' }, { text: '📊 Asset', callback_data: 'edit_ticker' }],
          [{ text: '⏱ Chart', callback_data: 'edit_tf' }, { text: '🎯 TP', callback_data: 'edit_tp' }],
          [{ text: '📍 Entry', callback_data: 'edit_entry' }, { text: '🛑 Est. SL', callback_data: 'edit_sl' }],
          [{ text: '🔗 Optional Assets', callback_data: 'edit_related' }, { text: '💬 Comment', callback_data: 'edit_comment' }],
          [{ text: '🔙 חזור לתצוגה', callback_data: 'back_preview' }]
        ];
      } else if (type === 'trade') {
        editButtons = [
          [{ text: '📈📉 Bias', callback_data: 'edit_bias' }, { text: '📊 Asset', callback_data: 'edit_ticker' }],
          [{ text: '⏱ Chart', callback_data: 'edit_tf' }, { text: '🎯 TP', callback_data: 'edit_tp' }],
          [{ text: '📍 Entry', callback_data: 'edit_entry' }, { text: '🛑 SL', callback_data: 'edit_sl' }],
          [{ text: '💬 Comment', callback_data: 'edit_comment' }],
          [{ text: '🔙 חזור לתצוגה', callback_data: 'back_preview' }]
        ];
      } else if (type === 'update') {
        editButtons = [
          [{ text: '🛑 Updated SL', callback_data: 'edit_sl' }, { text: '🎯 Updated TP', callback_data: 'edit_tp' }],
          [{ text: '% Position', callback_data: 'edit_pct' }, { text: '💬 Comment', callback_data: 'edit_comment' }],
          [{ text: '🔙 חזור לתצוגה', callback_data: 'back_preview' }]
        ];
      } else if (type === 'close') {
        editButtons = [
          [{ text: '📊 Asset', callback_data: 'edit_ticker' }, { text: '⏱ Chart', callback_data: 'edit_tf' }],
          [{ text: '🚪 Exit', callback_data: 'edit_exit' }, { text: '📋 Reason', callback_data: 'edit_reason' }],
          [{ text: '💬 Comment', callback_data: 'edit_comment' }],
          [{ text: '🔙 חזור לתצוגה', callback_data: 'back_preview' }]
        ];
      }
      await sendButtons(chatId, '✏️ מה לערוך?', editButtons);
      return res.status(200).json({ ok: true });
    }

    // Cancel
    if (data === 'cancel_msg') {
      await kdel('deskbot_' + userId);
      await sendMsg(chatId, '❌ ההודעה בוטלה.');
      return res.status(200).json({ ok: true });
    }

    // Back to preview
    if (data === 'back_preview') {
      await showPreview(chatId, state);
      return res.status(200).json({ ok: true });
    }

    // Edit field handlers
    if (data.startsWith('edit_')) {
      const field = data.replace('edit_', '');
      const newState = { ...(typeof state === 'string' ? JSON.parse(state) : state), editing: field, step: 'editing' };
      await kset('deskbot_' + userId, JSON.stringify(newState));
      const prompts = {
        bias: null,
        ticker: '📊 Asset? (e.g. ES1!)',
        tf: '⏱ Chart? (e.g. 5min)',
        tp: '🎯 TP?',
        entry: newState.bias === 'bull' ? 'Entry after close above?' : 'Entry after close below?',
        sl: '🛑 Stop Loss?',
        related: '🔗 Optional assets? (e.g. US500CFD)',
        comment: '💬 Comment? (- להשמיט)',
        pct: '% Position?',
        exit: '🚪 Exit price?',
        reason: null
      };
      if (field === 'bias') {
        await sendButtons(chatId, '📈📉 Bias?', [[
          { text: '📈 Bull', callback_data: 'edit_set_bull' },
          { text: '📉 Bear', callback_data: 'edit_set_bear' }
        ]]);
      } else if (field === 'reason') {
        await sendButtons(chatId, 'סיבת סגירה?', [
          [{ text: '✅ TP', callback_data: 'edit_set_reason_TP' }, { text: '❌ SL', callback_data: 'edit_set_reason_SL' }],
          [{ text: '📉 Trailing', callback_data: 'edit_set_reason_Trailing' }, { text: '🔄 Manual Close', callback_data: 'edit_set_reason_Manual Close' }]
        ]);
      } else {
        await sendMsg(chatId, prompts[field] || 'New value?');
      }
      return res.status(200).json({ ok: true });
    }

    // Edit bias set
    if (data === 'edit_set_bull' || data === 'edit_set_bear') {
      const bias = data === 'edit_set_bull' ? 'bull' : 'bear';
      const newState = { ...(typeof state === 'string' ? JSON.parse(state) : state), bias, editing: null, step: 'done' };
      await kset('deskbot_' + userId, JSON.stringify(newState));
      await showPreview(chatId, newState);
      return res.status(200).json({ ok: true });
    }

    // Edit reason set
    if (data.startsWith('edit_set_reason_')) {
      const reason = data.replace('edit_set_reason_', '');
      const newState = { ...(typeof state === 'string' ? JSON.parse(state) : state), reason, editing: null, step: 'done' };
      await kset('deskbot_' + userId, JSON.stringify(newState));
      await showPreview(chatId, newState);
      return res.status(200).json({ ok: true });
    }

    // Post options
    if (data === 'post_now') {
      const builtMsg = buildMessage(state);
      await postToChannel(builtMsg, state.photoId || null, state.comment || null);
      await saveToJournal(state.type, builtMsg);
      await kdel('deskbot_' + userId);
      await sendMsg(chatId, '✅ נשלח לערוץ!');
      return res.status(200).json({ ok: true });
    }
    if (data === 'post_photo') {
      await kset('deskbot_' + userId, JSON.stringify({ ...state, waiting: 'photo' }));
      await sendMsg(chatId, '📸 שלח תמונה:');
      return res.status(200).json({ ok: true });
    }
    if (data === 'post_comment') {
      await kset('deskbot_' + userId, JSON.stringify({ ...state, waiting: 'comment' }));
      await sendMsg(chatId, '✏️ שלח הערה:');
      return res.status(200).json({ ok: true });
    }
    if (data === 'post_both') {
      await kset('deskbot_' + userId, JSON.stringify({ ...state, waiting: 'photo_then_comment' }));
      await sendMsg(chatId, '📸 שלח תמונה תחילה:');
      return res.status(200).json({ ok: true });
    }
    if (data === 'post_confirm') {
      const builtMsg = buildMessage(state);
      await postToChannel(builtMsg, state.photoId, state.comment);
      await saveToJournal(state.type, builtMsg);
      await kdel('deskbot_' + userId);
      await sendMsg(chatId, '✅ נשלח לערוץ!');
      return res.status(200).json({ ok: true });
    }

    // Close reason
    if (data.startsWith('reason_')) {
      const reason = data.replace('reason_', '');
      const newState = { ...state, reason, step: 'done' };
      await kset('deskbot_' + userId, JSON.stringify(newState));
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
    await kset('deskbot_' + userId, JSON.stringify({ type: 'idea', step: 'bias' }));
    await sendButtons(chatId, '📋 <b>רעיון מקדים</b>\n\nכיוון מצופה?', [[
      { text: '📈 Bull', callback_data: 'bias_bull' },
      { text: '📉 Bear', callback_data: 'bias_bear' }
    ]]);
    return res.status(200).json({ ok: true });
  }

  if (text === '/trade' || text === 'trade') {
    await kset('deskbot_' + userId, JSON.stringify({ type: 'trade', step: 'bias' }));
    await sendButtons(chatId, '📌 <b>תיעוד עסקה</b>\n\nכיוון?', [[
      { text: '📈 Bull', callback_data: 'bias_bull' },
      { text: '📉 Bear', callback_data: 'bias_bear' }
    ]]);
    return res.status(200).json({ ok: true });
  }

  if (text === '/update' || text === 'update') {
    await kset('deskbot_' + userId, JSON.stringify({ type: 'update', step: 'utype' }));
    await sendButtons(chatId, '🔄 <b>ניהול עסקה</b>\n\nסוג עדכון?', [
      [{ text: 'Move Stop Loss', callback_data: 'utype_sl' }],
      [{ text: 'Partial Close', callback_data: 'utype_partial' }],
      [{ text: 'Add to Position', callback_data: 'utype_add' }]
    ]);
    return res.status(200).json({ ok: true });
  }

  if (text === '/close' || text === 'close') {
    await kset('deskbot_' + userId, JSON.stringify({ type: 'close', step: 'ticker' }));
    await sendMsg(chatId, '❌ <b>סגירת עסקה</b>\n\n📊 נכס? (- להשמיט, default: US500)');
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
  if (!text.startsWith('/') && !(await kget('deskbot_' + userId))) {
    await sendButtons(chatId, '📊 <b>DJR Trading Journal</b>\n\nבחר סוג הודעה:', [
      [{ text: '📋 רעיון מקדים', callback_data: 'type_idea' }, { text: '📌 תיעוד עסקה', callback_data: 'type_trade' }],
      [{ text: '🔄 ניהול עסקה', callback_data: 'type_update' }, { text: '❌ סגירת עסקה', callback_data: 'type_close' }],
      [{ text: '📵 אין סט אפ היום', callback_data: 'type_nosetup' }]
    ]);
    return res.status(200).json({ ok: true });
  }

  // ── HANDLE STATE MACHINE ─────────────────────────────────────
  const stateData = await kget('deskbot_' + userId);
  if (!stateData) return res.status(200).json({ ok: true });
  let state = typeof stateData === 'string' ? JSON.parse(stateData) : stateData;

  // Handle waiting for photo
  if (state.waiting === 'photo' || state.waiting === 'photo_then_comment') {
    if (photo && photo.length > 0) {
      const photoId = photo[photo.length - 1].file_id;
      if (state.waiting === 'photo_then_comment') {
        await kset('deskbot_' + userId, JSON.stringify({ ...state, photoId, waiting: 'comment' }));
        await sendMsg(chatId, '✏️ עכשיו שלח הערה:');
      } else {
        state = { ...state, photoId, waiting: null };
        await kset('deskbot_' + userId, JSON.stringify(state));
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
    await kset('deskbot_' + userId, JSON.stringify(state));
    await showPreview(chatId, state);
    return res.status(200).json({ ok: true });
  }

  // ── HANDLE EDITING ───────────────────────────────────────────
  if (state.step === 'editing' && state.editing) {
    const field = state.editing;
    const skip2 = text === '-';
    const newState = { ...state, editing: null, step: 'done' };
    if (field === 'ticker') newState.ticker = skip2 ? state.ticker : text;
    else if (field === 'tf') newState.tf = skip2 ? state.tf : text;
    else if (field === 'tp') newState.tp = skip2 ? state.tp : parseFloat(text) || text;
    else if (field === 'entry') newState.entry = skip2 ? state.entry : parseFloat(text) || text;
    else if (field === 'sl') newState.sl = skip2 ? state.sl : parseFloat(text) || text;
    else if (field === 'related') newState.related = skip2 ? state.related : text;
    else if (field === 'comment') newState.comment = skip2 ? null : text;
    else if (field === 'session') newState.session = skip2 ? 'NY' : text;
    else if (field === 'pct') newState.pct = skip2 ? state.pct : text;
    else if (field === 'exit') newState.exit = skip2 ? state.exit : parseFloat(text) || text;
    await kset('deskbot_' + userId, JSON.stringify(newState));
    await showPreview(chatId, newState);
    return res.status(200).json({ ok: true });
  }

  // ── STEP BY STEP FORM ─────────────────────────────────────────
  const skip = text === '-' || text === 'skip' || text === 'ס';

  if (state.step === 'ticker') {
    state.ticker = skip ? 'US500CFD' : text;
    state.step = 'tf';
    await kset('deskbot_' + userId, JSON.stringify(state));
    await sendMsg(chatId, '⏱ גרף? (default: 5min, - להשמיט)');
    return res.status(200).json({ ok: true });
  }

  if (state.step === 'tf') {
    state.tf = skip ? '5min' : text;
    state.step = 'session';
    await kset('deskbot_' + userId, JSON.stringify(state));
    await sendMsg(chatId, 'Session? (default: NY, - להשמיט)');
    return res.status(200).json({ ok: true });
  }

  if (state.step === 'session') {
    state.session = skip ? 'NY' : text;
    if (state.type === 'close') {
      state.step = 'exit';
      await kset('deskbot_' + userId, JSON.stringify(state));
      await sendMsg(chatId, 'Exit price?');
    } else {
      state.step = 'tp';
      await kset('deskbot_' + userId, JSON.stringify(state));
      await sendMsg(chatId, 'TP?');
    }
    return res.status(200).json({ ok: true });
  }

  if (state.step === 'tp') {
    state.tp = skip ? null : parseFloat(text) || text;
    state.step = 'entry';
    await kset('deskbot_' + userId, JSON.stringify(state));
    var entryLabel = state.bias === 'bull' ? 'Entry after close above?' : 'Entry after close below?';
    await sendMsg(chatId, entryLabel);
    return res.status(200).json({ ok: true });
  }

  if (state.step === 'entry') {
    state.entry = skip ? null : parseFloat(text) || text;
    if (state.type === 'close') {
      state.step = 'exit';
      await kset('deskbot_' + userId, JSON.stringify(state));
      await sendMsg(chatId, 'Exit?');
    } else {
      state.step = 'sl';
      await kset('deskbot_' + userId, JSON.stringify(state));
      await sendMsg(chatId, 'Stop Loss?');
    }
    return res.status(200).json({ ok: true });
  }

  if (state.step === 'sl') {
    state.sl = skip ? null : parseFloat(text) || text;
    if (state.type === 'trade') {
      state.step = 'risk_pct';
      await kset('deskbot_' + userId, JSON.stringify(state));
      await sendMsg(chatId, '% חשיפת חשבון? (default: 2%, - להשמיט)');
    } else {
      state.step = 'related';
      await kset('deskbot_' + userId, JSON.stringify(state));
      await sendMsg(chatId, 'Optional assets? (default: ES1!, - להשמיט)');
    }
    return res.status(200).json({ ok: true });
  }

  if (state.step === 'exit') {
    state.exit = skip ? null : parseFloat(text) || text;
    state.step = 'close_reason';
    await kset('deskbot_' + userId, JSON.stringify(state));
    await sendButtons(chatId, 'סיבת סגירה?', [
      [{ text: '✅ TP', callback_data: 'reason_TP' }, { text: '❌ SL', callback_data: 'reason_SL' }],
      [{ text: '📉 Trailing', callback_data: 'reason_Trailing' }, { text: '🔄 Manual Close', callback_data: 'reason_Manual Close' }]
    ]);
    return res.status(200).json({ ok: true });
  }

  if (state.step === 'related') {
    state.related = skip ? 'ES1!' : text;
    state.step = 'risk_pct';
    await kset('deskbot_' + userId, JSON.stringify(state));
    await sendMsg(chatId, '% חשיפת חשבון? (default: 2%, - להשמיט)');
    return res.status(200).json({ ok: true });
  }

  if (state.step === 'risk_pct') {
    state.riskPct = skip ? '2%' : (text.includes('%') ? text : text + '%');
    state.step = 'done';
    await kset('deskbot_' + userId, JSON.stringify(state));
    await showPreview(chatId, state);
    return res.status(200).json({ ok: true });
  }

  if (state.step === 'new_sl') {
    state.sl = skip ? null : text;
    state.step = 'done';
    await kset('deskbot_' + userId, JSON.stringify(state));
    await showPreview(chatId, state);
    return res.status(200).json({ ok: true });
  }

  if (state.step === 'pct') {
    state.pct = skip ? null : text;
    state.step = 'done';
    await kset('deskbot_' + userId, JSON.stringify(state));
    await showPreview(chatId, state);
    return res.status(200).json({ ok: true });
  }

  if (state.step === 'add_level') {
    state.entry = skip ? null : text;
    state.step = 'pct';
    await kset('deskbot_' + userId, JSON.stringify(state));
    await sendMsg(chatId, '% מהפוזיציה?');
    return res.status(200).json({ ok: true });
  }

  // ── HELPER FUNCTIONS ─────────────────────────────────────────
  function buildMessage(s) {
    if (!s) return '';
    // Ensure state is parsed object not string
    const state = typeof s === 'string' ? JSON.parse(s) : s;
    console.log('buildMessage type:', state.type, 'keys:', Object.keys(state).join(','));
    if (state.type === 'idea') return buildIdeaMsg(state);
    if (state.type === 'trade') return buildTradeMsg(state);
    if (state.type === 'update') return buildUpdateMsg(state);
    if (state.type === 'close') return buildCloseMsg(state);
    if (state.type === 'nosetup') return buildNoSetupMsg();
    return 'type not found: ' + state.type;
  }

  async function showPreview(chatId, s) {
    const state = typeof s === 'string' ? JSON.parse(s) : s;
    const preview = buildMessage(state);
    console.log('PREVIEW STATE:', JSON.stringify(state).substring(0,150));
    console.log('PREVIEW MSG:', preview ? preview.substring(0,100) : 'EMPTY');
    const plainText = (preview || 'No message built').replace(/[*\\]/g,'');
    await sendMsg(chatId, '👁 Preview:\n\n' + plainText.substring(0,1000));
    await sendButtons(chatId, 'מה לעשות?', [
      [{ text: '✅ שלח עכשיו', callback_data: 'post_now' }],
      [{ text: '📸 הוסף תמונה', callback_data: 'post_photo' }, { text: '✏️ הוסף הערה', callback_data: 'post_comment' }],
      [{ text: '📸✏️ תמונה + הערה', callback_data: 'post_both' }],
      [{ text: '🔙 ערוך שדה', callback_data: 'edit_fields' }, { text: '❌ בטל', callback_data: 'cancel_msg' }]
    ]);
  }

  return res.status(200).json({ ok: true });
}
