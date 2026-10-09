/* ملف المشترك عبر الخادم — لمن تعذّر عليه Firestore من جهازه (2026-10-09، يوم ديدلاين الجولة 4):
   مشتركون سجّلوا ولم تُكتب ملفاتهم، أو قناة Firestore محجوبة/مخنوقة على شبكتهم، فبقي اسمهم «فريقي» ولا يُحفظ شيء.
   POST {idToken, username?, teamName?, team?} → يتحقق من الهوية، يقرأ managers/{uid} بحساب الخدمة،
   وإن لم يوجد ينشئه بالشكل الذي تقبله القواعد (total 0، history []) — تشكيلة بعد الموعد تبدأ من الجولة التالية.
   يعيد {ok, created, doc}. لا يعدّل ملفاً موجوداً أبداً. */
'use strict';
const { accessToken, verifyIdToken } = require('./lib/google');

const PROJECT = 'mfsoccer-c7ee4';
const API_KEY = 'AIzaSyD_ZzAE4HEKPIuAKCmta8tzN5KOa8IUfuo';   /* المفتاح العام (accounts:lookup برمز المستخدم نفسه) */
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
  let b; try{ b = JSON.parse(event.body || '{}'); }catch(e){ return out(400, {ok:false, err:'جسم غير صالح'}); }
  let uid;
  try{ uid = await verifyIdToken(b.idToken, PROJECT); }catch(e){ return out(401, {ok:false, err:String(e.message||e)}); }
  try{
    const at = await accessToken('https://www.googleapis.com/auth/datastore');
    const auth = { Authorization:'Bearer '+at };
    const url = `${BASE}/managers/${encodeURIComponent(uid)}`;
    const r = await fetch(url, { headers:auth });
    if(r.ok) return out(200, {ok:true, created:false, doc:fields((await r.json()).fields)});
    if(r.status !== 404) return out(502, {ok:false, err:'read '+r.status});

    /* غير موجود: ننشئه. الجولة الحالية والموعد من مستند اللعبة */
    const g = await fetch(BASE, { headers:auth });
    const game = g.ok ? fields((await g.json()).fields) : {};
    const cur = +game.currentGW || 1;
    const gw = (game.gws || []).find(x => +x.n === cur) || {};
    const dl = gw.deadline ? Date.parse(gw.deadline) : NaN;
    const open = !isNaN(dl) && Date.now() < dl;
    /* بعد الموعد (منصور 2026-10-10: «صلح الثغرة»): لا مهلة — كانت 12 ساعة لمن سُجّل حسابه قبل الموعد، فدخل بها
       من كوّن فريقه بعد الموعد أيضاً. الفريق يُحفظ ويبدأ من الجولة التالية (joinedGW = الحالية + 1)، كالقواعد على الخادم. */
    let team = null;
    if(b.team && typeof b.team === 'object' && Array.isArray(b.team.squad) && b.team.squad.length && JSON.stringify(b.team).length < 60000){
      const { history, ...t } = b.team; team = t;
    }
    const now = new Date().toISOString();
    const doc = { username: clean(b.username, 40) || 'مشترك', teamName: clean(b.teamName, 40) || 'فريقي', avatar:'',
      joinedGW: (team && !open) ? cur + 1 : cur, created: now, updated: now, team, history: [], total: 0, lastGW: 0 };
    const f = {}; for(const k in doc) f[k] = enc(doc[k]);
    /* currentDocument.exists=false: لا يطمس ملفاً كُتب في هذه الأثناء */
    const w = await fetch(`${url}?currentDocument.exists=false`, { method:'PATCH', headers:{...auth, 'Content-Type':'application/json'}, body:JSON.stringify({fields:f}) });
    if(w.ok) return out(200, {ok:true, created:true, doc});
    if(w.status === 409 || w.status === 400){
      const r2 = await fetch(url, { headers:auth });
      if(r2.ok) return out(200, {ok:true, created:false, doc:fields((await r2.json()).fields)});
    }
    return out(502, {ok:false, err:'write '+w.status});
  }catch(e){ return out(502, {ok:false, err:String(e.message||e)}); }
};
