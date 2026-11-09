/* تنبيه شخصي قبل إغلاق الجولة بساعة (تدقيق 2026-11-09، البند 5): لكل مشترك في تشكيلته الأساسية لاعب مصاب/موقوف/غير متوفر،
   أو لاعب مباراة ناديه في الجولة مؤجلة أو بلا مباراة — إشعار واحد لأجهزته (pushprefs/<uid>.tokens) إن كان مفعّلاً تذكير الديدلاين (fd_a).
   مرة واحدة لكل جولة: fantasy/<season>/meta/xialert {gw} يُكتب قبل الإرسال، فالتشغيل المتداخل لا يكرر. */
'use strict';
const { readState } = require('./gw-core');

const SEASON = '2026-2027', F = `fantasy/${SEASON}`, PROJECT = 'mfsoccer-c7ee4';
const WINDOW_MIN = 60, SLACK_MIN = 10;
const LBL = { i:'مصاب', s:'موقوف', n:'غير متوفر', d:'غير متوفر', u:'خارج القائمة' };

/* من في تشكيلته الأساسية مشكلة — بلا إرسال (يُستعمل للاختبار أيضاً) */
function findIssues(E, st, gw, mgrs){
  const fx = st.fixtures.filter(f => f.gw === gw);
  const clubIssue = cid => { const mine = fx.filter(f => f.h === cid || f.a === cid);
    if(!mine.length) return 'بلا مباراة'; return mine.every(f => f.status === 'P') ? 'مباراة مؤجلة' : null; };
  const out = [];
  for(const m of mgrs){
    const v = m.data, t = v.team;
    if(!t || !Array.isArray(t.squad) || !t.squad.length) continue;
    if((+v.joinedGW || 0) > gw) continue;
    const p = (t.gwPicks && t.gwPicks[gw]) || E.TEAM.picksFrom(t);
    const items = [];
    for(const pid of (p.xi || [])){
      const pl = E.DB.player(pid); if(!pl) continue;
      const why = LBL[pl.status] || clubIssue(pl.club);
      if(why) items.push({ pid, name:pl.name, why });
    }
    if(items.length) out.push({ uid:m.id, name:v.username || '', items });
  }
  return out;
}

const msgOf = (gw, items) => {
  const list = items.slice(0, 3).map(x => `${x.name} (${x.why})`).join('، ') + (items.length > 3 ? ` و${items.length - 3} غيرهم` : '');
  return { title:`تشكيلتك في الجولة ${gw} تحتاج مراجعة`, body:`في أساسيّيك: ${list} — الإغلاق بعد أقل من ساعة` };
};

async function run(io, at, opts){
  opts = opts || {};
  const root = await io.get(F); if(!root) return { idle:'no game' };
  const gw = +root.data.currentGW, g = (root.data.gws || []).find(x => +x.n === gw);
  if(!g || !g.deadline || g.status === 'finished') return { idle:'no deadline' };
  const left = (Date.parse(g.deadline) - Date.now()) / 60000;
  if(!opts.force && !(left <= WINDOW_MIN && left > WINDOW_MIN - SLACK_MIN - 30)) return { idle:'not due', left:Math.round(left) };
  const mark = await io.get(`${F}/meta/xialert`);
  if(!opts.force && mark && +mark.data.gw === gw) return { idle:'sent', gw };
  const { E, st } = await readState(io);
  const mgrs = await io.list(`${F}/managers`, 300);
  const issues = findIssues(E, st, gw, mgrs);
  if(opts.dry) return { gw, issues:issues.length, sample:issues.slice(0, 5) };
  /* علامة الجولة أولاً (مشروطة: لا تُكتب فوق تشغيل آخر سبقنا) */
  try{ await io.commit([{ path:`${F}/meta/xialert`, data:{ gw, at:new Date().toISOString(), users:issues.length }, mask:false,
    ...(mark ? { updateTime:mark.updateTime } : { exists:false }) }]); }
  catch(e){ if(e.precondition) return { idle:'race', gw }; throw e; }
  const prefs = {}; (await io.list('pushprefs', 300).catch(() => [])).forEach(d => { prefs[d.id] = d.data; });
  let users = 0, sent = 0, devices = 0;
  const jobs = [];
  for(const it of issues){
    const pp = prefs[it.uid]; if(!pp) continue;
    const topics = pp.topics || [], tokens = (pp.tokens || []).filter(t => typeof t === 'string' && t.length > 100);
    if(!tokens.length || !(topics.includes('fd_a') || topics.includes('all'))) continue;
    users++;
    const m = msgOf(gw, it.items);
    tokens.forEach(token => jobs.push({ token, m }));
  }
  for(let i = 0; i < jobs.length; i += 50){
    await Promise.all(jobs.slice(i, i + 50).map(async ({ token, m }) => {
      devices++;
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${PROJECT}/messages:send`, { method:'POST',
        headers:{ Authorization:'Bearer ' + at, 'Content-Type':'application/json' },
        body: JSON.stringify({ message:{ token, notification:m, data:{ ev:'fxi', url:'https://mfsoccer.com/fantasy/' },
          apns:{ headers:{ 'apns-priority':'10', 'apns-push-type':'alert', 'apns-expiration':String(Math.floor(Date.now() / 1000) + 3600) }, payload:{ aps:{ sound:'default' } } },
          android:{ priority:'HIGH', notification:{ sound:'default' } },
          webpush:{ fcm_options:{ link:'https://mfsoccer.com/fantasy/' } } } }) }).catch(() => null);
      if(r && r.ok) sent++;
    }));
  }
  await io.commit([{ path:`${F}/meta/xialert`, data:{ users, devices, sent, done:new Date().toISOString() } }]).catch(() => null);
  return { gw, issues:issues.length, users, devices, sent };
}

module.exports = { run, findIssues, msgOf };
