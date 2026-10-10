/* احتساب «تحدي التوقعات» أولاً بأول (منصور 2026-10-11: «ودنا تكون النقاط أول بأول»).
   كان جدول الجمهور (boards/{season}) لا يتحدث إلا حين يضغط المالك «احتسب» بعد نهاية الجولة،
   والقواعد تسمح للمالك وحده بكتابته. هنا نفس معادلة scoreRound في index.html بحساب الخدمة:
   المباريات المنتهية فقط من جولات الدوري (الجولة الحالية + آخر جولة محتسبة)، نتيجة مطابقة 5،
   اتجاه صحيح 2، هداف الجولة 3 — وإعادة الاحتساب لا تضاعف النقاط (نطرح القديم ونضيف الجديد).
   POST {idToken}  ← محرّر/مالك بعد حفظ مباراة (index.html يستدعيها تلقائياً).
   الدالة preds-score-cron تستدعي run() كل 10 دقائق احتياطاً. */
'use strict';
const { accessToken, verifyIdToken } = require('./lib/google');

const PROJECT = 'mfsoccer-c7ee4';
const SEASON = '2026-2027';
const OWNER = 'iiTgVfDryXNLb9IrOyLkkNMHDxq2';
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const PT_EXACT = 5, PT_RIGHT = 2, PT_SCORER = 3;
const LIVE = ['h1','ht','h2','e1','e2','pso'];
const H = { 'Content-Type':'application/json; charset=utf-8', 'Access-Control-Allow-Origin':'https://mfsoccer.com',
  'Access-Control-Allow-Headers':'Content-Type', 'Access-Control-Allow-Methods':'POST, OPTIONS', 'Cache-Control':'no-store' };
const out = (code, body) => ({ statusCode:code, headers:H, body:JSON.stringify(body) });

function val(v){
  if(!v || typeof v !== 'object') return null;
  if('stringValue'  in v) return v.stringValue;
  if('integerValue' in v) return Number(v.integerValue);
  if('doubleValue'  in v) return Number(v.doubleValue);
  if('booleanValue' in v) return v.booleanValue;
  if('nullValue'    in v) return null;
  if('timestampValue' in v) return v.timestampValue;
  if('mapValue'     in v) return fields(v.mapValue.fields);
  if('arrayValue'   in v) return (v.arrayValue.values || []).map(val);
  return null;
}
function fields(f){ const o = {}; for(const k in (f || {})) o[k] = val(f[k]); return o; }
function enc(x){
  if(x === null || x === undefined) return { nullValue:null };
  if(typeof x === 'boolean') return { booleanValue:x };
  if(typeof x === 'number') return Number.isInteger(x) ? { integerValue:String(x) } : { doubleValue:x };
  if(typeof x === 'string') return { stringValue:x };
  if(Array.isArray(x)) return { arrayValue:{ values:x.map(enc) } };
  if(typeof x === 'object'){ const f = {}; for(const k in x) if(x[k] !== undefined) f[k] = enc(x[k]); return { mapValue:{ fields:f } }; }
  return { nullValue:null };
}

const compOf = x => x.comp || 'الدوري';
/* موعد المباراة بتوقيت الكويت (+03:00) */
function kickoff(m){
  if(!m.date) return null;
  const t = /^\d{1,2}:\d{2}$/.test(String(m.time || '')) ? m.time.padStart(5, '0') : '23:59';
  const ms = Date.parse(`${m.date}T${t}:00+03:00`);
  return isNaN(ms) ? null : ms;
}
/* منتهية فقط — لا تُحتسب نتيجة مباراة جارية. «ft» حاسمة؛ المباريات القديمة بلا حالة تُعدّ منتهية
   بعد ساعتين من موعدها إن سُجّل لها هدف أو تشكيلة؛ حالة شوط عالقة بعد 6 ساعات تُعدّ منتهية */
function finished(m, d){
  if(m.status === 'ft') return true;
  if(m.status === 'pre') return false;
  const k = kickoff(m); if(k === null) return false;
  if(LIVE.includes(m.status)) return Date.now() > k + 6*3600e3;
  if(Date.now() < k + 2*3600e3) return false;
  const r = +m.round, c = compOf(m);
  const hasGoal = (d.goals || []).some(g => +g.r === r && compOf(g) === c && (g.sc === m.home || g.sc === m.away));
  const hasXI = (d.lineups || []).some(x => +x.r === r && compOf(x) === c && (x.club === m.home || x.club === m.away));
  return hasGoal || hasXI;
}

async function get(path, auth){
  const r = await fetch(`${DOCS}/${path}`, { headers:auth });
  if(r.status === 404) return null;
  if(!r.ok) throw new Error(`read ${path} ${r.status}`);
  return fields((await r.json()).fields);
}
async function predsOf(rk, auth){
  const r = await fetch(`${DOCS}:runQuery`, { method:'POST', headers:{ ...auth, 'Content-Type':'application/json' },
    body: JSON.stringify({ structuredQuery:{ from:[{ collectionId:'preds' }],
      where:{ fieldFilter:{ field:{ fieldPath:'rk' }, op:'EQUAL', value:{ stringValue:rk } } } } }) });
  if(!r.ok) throw new Error('preds ' + r.status);
  return (await r.json()).filter(x => x.document).map(x => fields(x.document.fields));
}

async function run(){
  const at = await accessToken('https://www.googleapis.com/auth/datastore');
  const auth = { Authorization:'Bearer ' + at };
  const [season, board, cur] = await Promise.all([get(`seasons/${SEASON}`, auth), get(`boards/${SEASON}`, auth), get('rounds/current', auth)]);
  if(!season) throw new Error('season missing');
  const curR = cur && +cur.round || 0;
  const lastR = board && +board.lastRound || 0;
  const rounds = [...new Set([lastR, curR].filter(Boolean))].sort((a, b) => a - b);
  const rows = (board && board.rows) ? JSON.parse(JSON.stringify(board.rows)) : {};
  let lastRound = lastR, lastMonth = board && board.lastMonth || '', scored = [], changed = false;

  for(const r of rounds){
    const ms = (season.matches || []).filter(m => compOf(m) === 'الدوري' && (+m.round || 0) === r && finished(m, season));
    if(!ms.length) continue;
    const keys = new Set(ms.map(m => m.home + '|' + m.away));
    const actual = {}; ms.forEach(m => actual[m.home + '|' + m.away] = [+m.hg || 0, +m.ag || 0]);
    /* هداف الجولة: من المباريات المنتهية فقط */
    const scorers = new Set((season.goals || []).filter(g => compOf(g) === 'الدوري' && +g.r === r
      && (keys.has(g.sc + '|' + g.cd) || keys.has(g.cd + '|' + g.sc))).map(g => g.p));
    const month = String(ms[0].date || '').slice(0, 7);
    const preds = await predsOf(`${SEASON}_${r}`, auth);
    preds.forEach(p => {
      if(!p || !p.uid) return;
      let pts = 0;
      Object.entries(p.picks || {}).forEach(([k, v]) => {
        const a = actual[k]; if(!a) return;
        const ph = +v[0] || 0, pa = +v[1] || 0;
        if(ph === a[0] && pa === a[1]) pts += PT_EXACT;
        else if(Math.sign(ph - pa) === Math.sign(a[0] - a[1])) pts += PT_RIGHT;
      });
      if(p.scorer && scorers.has(p.scorer)) pts += PT_SCORER;
      const row = rows[p.uid] || { n:p.name || 'مشترك', t:0, r:{}, m:{} };
      row.n = p.name || row.n;
      row.r = row.r || {}; row.m = row.m || {};
      const prev = +row.r[r] || 0;
      if(prev !== pts || row.r[r] === undefined) changed = true;
      row.r[r] = pts;
      row.m[month] = Math.max(0, (+row.m[month] || 0) - prev + pts);
      row.t = Math.max(0, (+row.t || 0) - prev + pts);
      rows[p.uid] = row;
    });
    scored.push({ round:r, matches:ms.length, preds:preds.length });
    if(r >= lastRound){ lastRound = r; lastMonth = month; }
  }
  if(!scored.length) return { ok:true, scored, written:false };
  if(!changed && lastRound === lastR) return { ok:true, scored, written:false };
  const body = { rows, lastRound, lastMonth, updated:new Date().toISOString() };
  const w = await fetch(`${DOCS}/boards/${SEASON}`, { method:'PATCH', headers:{ ...auth, 'Content-Type':'application/json' },
    body: JSON.stringify({ fields:enc(body).mapValue.fields }) });
  if(!w.ok) throw new Error('write board ' + w.status + ' ' + (await w.text()).slice(0, 200));
  return { ok:true, scored, written:true, lastRound };
}

async function isStaff(uid, auth){
  if(uid === OWNER) return true;
  const s = await get('seasons/staff', auth);
  const m = s && s.members && s.members[uid];
  return !!(m && m.role === 'editor' && m.active === true);
}

exports.run = run;
exports.handler = async (event) => {
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:H, body:'' };
  if(event.httpMethod !== 'POST') return out(405, { ok:false, err:'POST فقط' });
  let b; try{ b = JSON.parse(event.body || '{}'); }catch(e){ return out(400, { ok:false, err:'جسم غير صالح' }); }
  let uid;
  try{ uid = await verifyIdToken(b.idToken, PROJECT); }catch(e){ return out(401, { ok:false, err:String(e.message || e) }); }
  try{
    const at = await accessToken('https://www.googleapis.com/auth/datastore');
    if(!(await isStaff(uid, { Authorization:'Bearer ' + at }))) return out(403, { ok:false, err:'للمحررين فقط' });
    return out(200, await run());
  }catch(e){ return out(500, { ok:false, err:String(e.message || e) }); }
};
