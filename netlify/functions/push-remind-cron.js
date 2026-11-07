/* تذكير قبل الانطلاق بـ30 و15 و5 دقائق (تفضيلات الإشعارات، منصور 2026-11-03).
   كل 5 دقائق بحساب الخدمة: يقرأ مواعيد المباريات من وثيقة الموسم (الدوري والكؤوس) ووثيقة المشاركات الخارجية،
   ويرسل لكل مباراة دخلت نافذة تذكير — بشرط مواضيع r30/r15/r5 فلا يصل إلا من اختاره، ولا يصل الأجهزة القديمة.
   الموعد من حقلي date/time كما يدخلهما المحرّر (توقيت الكويت +03:00)؛ مباراة بلا موعد أو بنتيجة أو بدأت تُتجاوز.
   منع التكرار: بصمة كل تذكير مرسل في pushlog/remind (آخر 300)، فإعادة التشغيل أو التداخل لا تعيد الإرسال. */
'use strict';
const { accessToken } = require('./lib/google');
const { condition } = require('./lib/topics');
const REG = require('./lib/reg');

const PROJECT = 'mfsoccer-c7ee4';
const SEASON = '2026-2027';
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const WIN = [['r30',30],['r15',15],['r5',5]];
const SLACK = 5;   /* دقائق — بقدر فاصل التشغيل، فلا تفوت نافذة */

function val(v){
  if(!v || typeof v !== 'object') return null;
  if('stringValue'  in v) return v.stringValue;
  if('integerValue' in v) return Number(v.integerValue);
  if('doubleValue'  in v) return Number(v.doubleValue);
  if('booleanValue' in v) return v.booleanValue;
  if('timestampValue' in v) return v.timestampValue;   /* meta/lock.deadline */
  if('nullValue'    in v) return null;
  if('arrayValue'   in v) return (v.arrayValue.values || []).map(val);
  if('mapValue'     in v){ const o = {}; const f = v.mapValue.fields || {}; for(const k in f) o[k] = val(f[k]); return o; }
  return null;
}
/* نفس normTime في index.html: أرقام عربية، و«م/ص»، و7.30 — بلا وقت لا تذكير (الموقع يفترض 23:59 للعرض فقط) */
function normTime(t){
  if(!t) return null;
  const x = String(t).trim().replace(/[٠-٩]/g, d=>String.fromCharCode(d.charCodeAt(0)-0x0660+48))
    .replace(/[۰-۹]/g, d=>String.fromCharCode(d.charCodeAt(0)-0x06F0+48));
  const pm = /(م|مساء|مساءً|p\.?m\.?)/i.test(x), am = /(ص|صباح|صباحاً|a\.?m\.?)/i.test(x);
  const mt = x.match(/(\d{1,2})\s*[:.]\s*(\d{2})/); if(!mt) return null;
  let h = +mt[1]; const mi = +mt[2]; if(h>23 || mi>59) return null;
  if(pm && h<12) h += 12; if(am && h===12) h = 0;
  return String(h).padStart(2,'0')+':'+String(mi).padStart(2,'0');
}
const kickoff = m => {
  const t = m && normTime(m.time);
  if(!t || !/^\d{4}-\d{2}-\d{2}$/.test(m.date||'')) return NaN;
  return Date.parse(`${m.date}T${t}:00+03:00`);
};
const played = m => (m.hg !== '' && m.hg != null && m.ag !== '' && m.ag != null && (+m.hg || +m.ag)) || (m.status && m.status !== 'pre');
const matchKey = m => [m.comp || 'الدوري', m.round, m.home, m.away].map(v => encodeURIComponent(String(v))).join('/');

async function run(){
  const at = await accessToken('https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging');
  const H = { Authorization:'Bearer ' + at };
  const read = async p => { const r = await fetch(`${DOCS}/${p}`, { headers:H }); if(r.status === 404) return null;
    if(!r.ok) throw new Error(p + ' ' + r.status); const f = (await r.json()).fields || {}; const o = {}; for(const k in f) o[k] = val(f[k]); return o; };

  const now = Date.now(), due = [];
  for(const id of [SEASON, 'ext2627']){
    const d = await read('seasons/' + id).catch(() => null);
    ((d && d.matches) || []).forEach(m => {
      const t = kickoff(m); if(!isFinite(t) || played(m)) return;
      const left = (t - now) / 60000;
      WIN.forEach(([d, mins]) => { if(left <= mins && left > mins - SLACK) due.push({ d, mins, m }); });
    });
  }
  /* ديدلاين الفانتسي (منصور 2026-11-04): قبل يوم وساعتين وساعة من meta/lock — من اختاره (fd_a) + الأجهزة القديمة (all)
     + أجهزة اللوحة التي لم تختره بعد (gen بلا fd_a) */
  const fdue = [];
  const lock = await read(`fantasy/${SEASON}/meta/lock`).catch(() => null);
  if(lock && lock.open !== false && !lock.provisional && lock.deadline){
    const t = Date.parse(lock.deadline), left = (t - now) / 60000;
    [['fd24',1440,'بعد يوم'],['fd2',120,'بعد ساعتين'],['fd1',60,'بعد ساعة']].forEach(([d, mins, lbl]) => {
      if(left <= mins && left > mins - SLACK) fdue.push({ d, mins, lbl, gw:Number(lock.gw)||0, t });
    });
  }
  if(!due.length && !fdue.length) return { ok:true, sent:0 };

  const log = await read('pushlog/remind').catch(() => null);
  const seen = (log && log.sent) || [];
  const sent = [];
  for(const { d, mins, m } of due){
    const sig = [d, m.comp || 'الدوري', m.round, m.home, m.away, m.date, m.time].join('|');
    if(seen.indexOf(sig) >= 0) continue;
    const ev = { d, comp: m.comp || 'الدوري', home: m.home, away: m.away };
    const link = 'https://mfsoccer.com/#m/' + matchKey(m);
    /* تذكير الـ30 دقيقة للجميع (منصور 2026-11-04 «للكل»): من اختاره + الأجهزة القديمة (موضوع all، والأجهزة على اللوحة
       خرجت منه فلا تكرار) + كل جهاز على اللوحة لم يختره (gen بلا r30_a) */
    const conds = [condition(ev)];
    if(d === 'r30'){ conds[0] += " || 'all' in topics"; conds.push("'gen' in topics && !('r30_a' in topics)"); }
    let okAny = false;
    for(const cond of conds){
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${PROJECT}/messages:send`, { method:'POST',
        headers:{ ...H, 'Content-Type':'application/json' },
        body: JSON.stringify({ message:{ condition: cond,
          notification:{ title: `الانطلاق بعد ${mins} دقيقة`, body: `${m.home} × ${m.away}${m.venue ? ' · ' + m.venue : ''}` },
          data:{ ev:d, url:link },
          apns:{ headers:{ 'apns-priority':'10', 'apns-push-type':'alert', 'apns-expiration':String(Math.floor(Date.now()/1000)+900) }, payload:{ aps:{ sound:'default', 'interruption-level':'time-sensitive' } } },
          android:{ priority:'HIGH', notification:{ sound:'default', default_vibrate_timings:true } },
          webpush:{ headers:{ Urgency:'high' }, fcm_options:{ link } } } }) });
      if(r.ok) okAny = true; else console.error('remind send', r.status, cond, (await r.text()).slice(0, 200));
    }
    /* أجهزة التطبيق خرجت من المواضيع (الإرسال المباشر) — تصلها التذكيرات مباشرة */
    try{ const dr = await REG.sendDirect(at, PROJECT, conds.map(condition => ({ condition })), {
        notification:{ title: `الانطلاق بعد ${mins} دقيقة`, body: `${m.home} × ${m.away}${m.venue ? ' · ' + m.venue : ''}` },
        data:{ ev:d, url:link }, apns:{ headers:{ 'apns-priority':'10', 'apns-push-type':'alert', 'apns-expiration':String(Math.floor(Date.now()/1000)+900) }, payload:{ aps:{ sound:'default', 'interruption-level':'time-sensitive' } } } }, x => x.x);
      if(dr.ok) okAny = true; }catch(e){}
    if(okAny) sent.push(sig);
  }
  const KW_D = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  const KW_M = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const kwLabel = t => { const k = new Date(t + 3*3600e3); let h = k.getUTCHours(); const mi = String(k.getUTCMinutes()).padStart(2,'0');
    const ap = h >= 12 ? 'م' : 'ص'; h = h % 12 || 12; return `${KW_D[k.getUTCDay()]} ${k.getUTCDate()} ${KW_M[k.getUTCMonth()]} · ${h}:${mi} ${ap}`; };
  for(const f of fdue){
    const sig = ['fd', f.d, f.gw, f.t].join('|');
    if(seen.indexOf(sig) >= 0) continue;
    const link = 'https://mfsoccer.com/fantasy/';
    const conds = ["'fd_a' in topics || 'all' in topics", "'gen' in topics && !('fd_a' in topics)"];
    let okAny = false;
    for(const cond of conds){
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${PROJECT}/messages:send`, { method:'POST',
        headers:{ ...H, 'Content-Type':'application/json' },
        body: JSON.stringify({ message:{ condition: cond,
          notification:{ title: `ديدلاين الفانتسي ${f.lbl}`, body: `الجولة ${f.gw} · آخر موعد للتعديل ${kwLabel(f.t)} — راجع تشكيلتك` },
          data:{ ev:'fd', url:link },
          apns:{ headers:{ 'apns-priority':'10', 'apns-push-type':'alert', 'apns-expiration':String(Math.floor(Date.now()/1000)+900) }, payload:{ aps:{ sound:'default', 'interruption-level':'time-sensitive' } } },
          android:{ priority:'HIGH', notification:{ sound:'default', default_vibrate_timings:true } },
          webpush:{ headers:{ Urgency:'high' }, fcm_options:{ link } } } }) });
      if(r.ok) okAny = true; else console.error('fd send', r.status, cond, (await r.text()).slice(0, 200));
    }
    try{ const dr = await REG.sendDirect(at, PROJECT, conds.map(condition => ({ condition })), {
        notification:{ title: `ديدلاين الفانتسي ${f.lbl}`, body: `الجولة ${f.gw} · آخر موعد للتعديل ${kwLabel(f.t)} — راجع تشكيلتك` },
        data:{ ev:'fd', url:link }, apns:{ headers:{ 'apns-priority':'10', 'apns-push-type':'alert', 'apns-expiration':String(Math.floor(Date.now()/1000)+900) }, payload:{ aps:{ sound:'default', 'interruption-level':'time-sensitive' } } } }, x => x.x);
      if(dr.ok) okAny = true; }catch(e){}
    if(okAny) sent.push(sig);
  }

  if(sent.length){
    const all = seen.concat(sent).slice(-300);
    await fetch(`${DOCS}/pushlog/remind`, { method:'PATCH', headers:{ ...H, 'Content-Type':'application/json' },
      body: JSON.stringify({ fields:{ sent:{ arrayValue:{ values: all.map(s => ({ stringValue:s })) } }, updated:{ stringValue:new Date().toISOString() } } }) });
  }
  return { ok:true, due:due.length, fdue:fdue.length, sent:sent.length };
}

exports.handler = async () => {
  try{ const r = await run(); console.log('push-remind', JSON.stringify(r)); return { statusCode:200, body:JSON.stringify(r) }; }
  catch(e){ console.error('push-remind failed', e); return { statusCode:500, body:String(e.message || e) }; }
};
