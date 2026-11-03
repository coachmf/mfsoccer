/* تذكير قبل الانطلاق بـ30 و15 و5 دقائق (تفضيلات الإشعارات، منصور 2026-11-03).
   كل 5 دقائق بحساب الخدمة: يقرأ مواعيد المباريات من وثيقة الموسم (الدوري والكؤوس) ووثيقة المشاركات الخارجية،
   ويرسل لكل مباراة دخلت نافذة تذكير — بشرط مواضيع r30/r15/r5 فلا يصل إلا من اختاره، ولا يصل الأجهزة القديمة.
   الموعد من حقلي date/time كما يدخلهما المحرّر (توقيت الكويت +03:00)؛ مباراة بلا موعد أو بنتيجة أو بدأت تُتجاوز.
   منع التكرار: بصمة كل تذكير مرسل في pushlog/remind (آخر 300)، فإعادة التشغيل أو التداخل لا تعيد الإرسال. */
'use strict';
const { accessToken } = require('./lib/google');
const { condition } = require('./lib/topics');

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
  if(!due.length) return { ok:true, sent:0 };

  const log = await read('pushlog/remind').catch(() => null);
  const seen = (log && log.sent) || [];
  const sent = [];
  for(const { d, mins, m } of due){
    const sig = [d, m.comp || 'الدوري', m.round, m.home, m.away, m.date, m.time].join('|');
    if(seen.indexOf(sig) >= 0) continue;
    const ev = { d, comp: m.comp || 'الدوري', home: m.home, away: m.away };
    const link = 'https://mfsoccer.com/#m/' + matchKey(m);
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${PROJECT}/messages:send`, { method:'POST',
      headers:{ ...H, 'Content-Type':'application/json' },
      body: JSON.stringify({ message:{ condition: condition(ev),
        notification:{ title: `الانطلاق بعد ${mins} دقيقة`, body: `${m.home} × ${m.away}${m.venue ? ' · ' + m.venue : ''}` },
        data:{ ev:d, url:link }, webpush:{ fcm_options:{ link } } } }) });
    if(r.ok) sent.push(sig); else console.error('remind send', r.status, (await r.text()).slice(0, 200));
  }
  if(sent.length){
    const all = seen.concat(sent).slice(-300);
    await fetch(`${DOCS}/pushlog/remind`, { method:'PATCH', headers:{ ...H, 'Content-Type':'application/json' },
      body: JSON.stringify({ fields:{ sent:{ arrayValue:{ values: all.map(s => ({ stringValue:s })) } }, updated:{ stringValue:new Date().toISOString() } } }) });
  }
  return { ok:true, due:due.length, sent:sent.length };
}

exports.handler = async () => {
  try{ const r = await run(); console.log('push-remind', JSON.stringify(r)); return { statusCode:200, body:JSON.stringify(r) }; }
  catch(e){ console.error('push-remind failed', e); return { statusCode:500, body:String(e.message || e) }; }
};
