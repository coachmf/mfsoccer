/* حفظ تشكيلة المشترك عبر الخادم (منصور 2026-10-23، محمد القلاف وحساب والده: «ابيه دايماً يتسيف بالتطبيق»):
   على بعض الأجهزة (تطبيق iOS) تعلق قناة Firestore فتفشل الكتابة من الجهاز بصمت ويرجع الفريق القديم عند الإقفال.
   POST {idToken, team?, username?, teamName?, avatar?} → يتحقق من الهوية ويكتب managers/{uid} بحساب الخدمة —
   نفس ما تسمح به قواعد Firestore للمشترك بالضبط: الملف الشخصي دائماً، والتشكيلة قبل موعد الجولة فقط،
   ولا يلمس النقاط/السجل/الجولة. ملف غير موجود لا يُنشأ هنا (fantasy-me ينشئه). */
'use strict';
const { accessToken, verifyIdToken } = require('./lib/google');

const PROJECT = 'mfsoccer-c7ee4';
const SEASON = '2026-2027';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/fantasy/${SEASON}`;
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
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

exports.handler = async (event) => {
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:H, body:'' };
  if(event.httpMethod !== 'POST') return out(405, {ok:false, err:'POST فقط'});
  let b; try{ b = JSON.parse(event.body || '{}'); }catch(e){ return out(400, {ok:false, err:'bad-body'}); }
  let uid;
  try{ uid = await verifyIdToken(b.idToken, PROJECT); }catch(e){ return out(401, {ok:false, err:'auth'}); }
  try{
    const at = await accessToken('https://www.googleapis.com/auth/datastore');
    const auth = { Authorization:'Bearer '+at };
    const patch = { updated: new Date().toISOString() };
    if(b.username != null) patch.username = clean(b.username, 40) || 'مشترك';
    if(b.teamName != null) patch.teamName = clean(b.teamName, 40) || 'فريقي';
    if(b.avatar   != null){ const a = String(b.avatar); if(a.length < 60000) patch.avatar = a; }
    if(b.team !== undefined){
      const t = b.team;
      if(!t || typeof t !== 'object' || !Array.isArray(t.squad) || !t.squad.length || JSON.stringify(t).length >= 60000) return out(400, {ok:false, err:'bad-team'});
      /* نفس قفل القواعد (fanWindowOpen): بعد موعد الجولة الحالية لا تُكتب التشكيلة */
      const lk = await fetch(`${BASE}/meta/lock`, { headers:auth });
      const lock = lk.ok ? fields((await lk.json()).fields) : null;
      const dl = lock && lock.deadline ? Date.parse(lock.deadline) : NaN;
      if(isNaN(dl) || Date.now() >= dl) return out(403, {ok:false, err:'closed'});
      const { history, ...team } = t;          // السجل يكتبه المدير وحده
      patch.team = team;
    }
    const mask = Object.keys(patch).map(k => 'updateMask.fieldPaths='+encodeURIComponent(k)).join('&');
    const f = {}; for(const k in patch) f[k] = enc(patch[k]);
    /* currentDocument.exists=true: لا ينشئ ملفاً (fantasy-me ينشئه بالشكل الصحيح) */
    const w = await fetch(`${BASE}/managers/${encodeURIComponent(uid)}?${mask}&currentDocument.exists=true`,
      { method:'PATCH', headers:{...auth, 'Content-Type':'application/json'}, body:JSON.stringify({fields:f}) });
    if(w.ok) return out(200, {ok:true, updated:patch.updated});
    return out(w.status === 404 ? 404 : 502, {ok:false, err:'write '+w.status});
  }catch(e){ return out(502, {ok:false, err:String(e.message||e).slice(0,120)}); }
};
