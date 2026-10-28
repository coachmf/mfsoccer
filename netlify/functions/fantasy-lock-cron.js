/* حارس موعد الإغلاق (منصور 2026-10-28: «ليش كل مره يكون مكتوب خلصت الجوله… مابي تتكرر»).
   احتساب الجولة يتم من جهاز المدير، ونشر meta/lock بعده قد يتعثّر على اتصال بطيء فيبقى القفل على الجولة
   المنتهية (موعدها فات) والانتقالات مغلقة عند الجميع رغم أن اللعبة انتقلت للجولة التالية (حدث في 6 و5).
   هنا كل 10 دقائق بحساب الخدمة: إن كان currentGW في جذر اللعبة أحدث من gw في القفل، يُكتب القفل من
   جدول الجولات نفسه (نفس حقول CLOUD.publishLock). لا يلمس القفل إن كان مطابقاً — التعديل اليدوي يبقى. */
'use strict';
const { accessToken } = require('./lib/google');

const PROJECT = 'mfsoccer-c7ee4';
const SEASON = '2026-2027';
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

function val(v){
  if(!v || typeof v !== 'object') return null;
  if('stringValue'    in v) return v.stringValue;
  if('integerValue'   in v) return Number(v.integerValue);
  if('doubleValue'    in v) return Number(v.doubleValue);
  if('booleanValue'   in v) return v.booleanValue;
  if('timestampValue' in v) return v.timestampValue;
  if('nullValue'      in v) return null;
  if('arrayValue'     in v) return (v.arrayValue.values || []).map(val);
  if('mapValue'       in v){ const o = {}; const f = v.mapValue.fields || {}; for(const k in f) o[k] = val(f[k]); return o; }
  return null;
}

async function run(){
  const at = await accessToken('https://www.googleapis.com/auth/datastore');
  const auth = { Authorization:'Bearer ' + at };
  const get = async p => { const r = await fetch(`${DOCS}/${p}?mask.fieldPaths=currentGW&mask.fieldPaths=gws&mask.fieldPaths=gw`, { headers:auth });
    if(r.status === 404) return null; if(!r.ok) throw new Error(p + ' ' + r.status); const d = await r.json();
    const o = {}; for(const k in (d.fields || {})) o[k] = val(d.fields[k]); return o; };

  const root = await get(`fantasy/${SEASON}`);
  const cur = root && Number(root.currentGW);
  if(!cur) return { ok:true, skip:'no-root' };
  const lock = await get(`fantasy/${SEASON}/meta/lock`);
  if(lock && Number(lock.gw) >= cur) return { ok:true, skip:'lock-current', gw:cur };

  const g = (root.gws || []).find(x => x && Number(x.n) === cur);
  if(!g) return { ok:true, skip:'no-gw', gw:cur };
  const has = !!g.deadline;
  const dl = has ? new Date(g.deadline) : new Date('2099-01-01T00:00:00Z');
  const fields = {
    gw:          { integerValue: String(cur) },
    deadline:    { timestampValue: dl.toISOString() },
    deadlineISO: has ? { stringValue: g.deadline } : { nullValue: null },
    provisional: { booleanValue: !has },
    open:        { booleanValue: g.status !== 'finished' },
    updated:     { stringValue: new Date().toISOString() },
    by:          { stringValue: 'lock-cron' }
  };
  const w = await fetch(`${DOCS}/fantasy/${SEASON}/meta/lock`, { method:'PATCH',
    headers:{ ...auth, 'Content-Type':'application/json' }, body: JSON.stringify({ fields }) });
  if(!w.ok) throw new Error('lock write ' + w.status + ' ' + (await w.text()).slice(0, 200));
  return { ok:true, fixed:true, from: lock ? Number(lock.gw) : null, to:cur, deadline: g.deadline || null };
}

exports.handler = async () => {
  try{ const r = await run(); console.log('fantasy-lock', JSON.stringify(r)); return { statusCode:200, body:JSON.stringify(r) }; }
  catch(e){ console.error('fantasy-lock failed', e); return { statusCode:500, body:String(e.message || e) }; }
};
