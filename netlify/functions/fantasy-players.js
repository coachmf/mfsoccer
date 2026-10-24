/* نشر قائمة لاعبي الفانتسي (meta/players) عبر الخادم (منصور 2026-10-24: «لم يتم نشر اللاعبين — الاتصال بطيء»):
   القائمة ~320KB، وكتابتها من الجوال عبر قناة Firestore تنتهي مهلتها على الشبكة البطيئة فتبقى الأسعار/اللاعبون الجدد
   على جهاز المدير وحده. POST {idToken, list, priceVer?, updated?} → للمدير فقط (المالك أو «محرر» فعّال بلا perm:'matches'
   في seasons/staff — نفس CLOUD.admin)، ويكتب meta/players بحساب الخدمة. */
'use strict';
const { accessToken, verifyIdToken } = require('./lib/google');

const PROJECT = 'mfsoccer-c7ee4';
const SEASON = '2026-2027';
const OWNER_UID = 'iiTgVfDryXNLb9IrOyLkkNMHDxq2';
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const H = { 'Content-Type':'application/json; charset=utf-8', 'Access-Control-Allow-Origin':'https://mfsoccer.com',
  'Access-Control-Allow-Headers':'Content-Type', 'Access-Control-Allow-Methods':'POST, OPTIONS', 'Cache-Control':'no-store' };
const out = (code, body) => ({ statusCode:code, headers:H, body:JSON.stringify(body) });

function val(v){
  if(!v || typeof v !== 'object') return null;
  if('stringValue'  in v) return v.stringValue;
  if('integerValue' in v) return Number(v.integerValue);
  if('doubleValue'  in v) return Number(v.doubleValue);
  if('booleanValue' in v) return v.booleanValue;
  if('mapValue'     in v){ const o = {}; const f = v.mapValue.fields || {}; for(const k in f) o[k] = val(f[k]); return o; }
  if('arrayValue'   in v) return (v.arrayValue.values || []).map(val);
  return null;
}
function enc(x){
  if(x === null || x === undefined) return { nullValue:null };
  if(typeof x === 'boolean') return { booleanValue:x };
  if(typeof x === 'number') return Number.isInteger(x) ? { integerValue:String(x) } : { doubleValue:x };
  if(typeof x === 'string') return { stringValue:x };
  if(Array.isArray(x)) return { arrayValue:{ values:x.map(enc) } };
  if(typeof x === 'object'){ const f = {}; for(const k in x) if(x[k] !== undefined) f[k] = enc(x[k]); return { mapValue:{ fields:f } }; }
  return { nullValue:null };
}

exports.handler = async (event) => {
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:H, body:'' };
  if(event.httpMethod !== 'POST') return out(405, {ok:false, err:'POST فقط'});
  let b; try{ b = JSON.parse(event.body || '{}'); }catch(e){ return out(400, {ok:false, err:'bad-body'}); }
  let uid;
  try{ uid = await verifyIdToken(b.idToken, PROJECT); }catch(e){ return out(401, {ok:false, err:'auth'}); }
  const list = b.list;
  if(!Array.isArray(list) || list.length < 50 || list.some(p => !p || typeof p !== 'object' || !p.id)) return out(400, {ok:false, err:'bad-list'});
  try{
    const at = await accessToken('https://www.googleapis.com/auth/datastore');
    const auth = { Authorization:'Bearer '+at };
    if(uid !== OWNER_UID){
      const s = await fetch(`${DOCS}/seasons/staff`, { headers:auth });
      const members = s.ok ? (val({mapValue:{fields:(await s.json()).fields || {}}}).members || {}) : {};
      const me = members[uid];
      if(!(me && me.role === 'editor' && me.active === true && me.perm !== 'matches')) return out(403, {ok:false, err:'admin'});
    }
    const patch = { list, updated: typeof b.updated === 'string' ? b.updated.slice(0, 40) : new Date().toISOString() };
    if(b.priceVer != null && !isNaN(+b.priceVer)) patch.priceVer = +b.priceVer;
    const mask = Object.keys(patch).map(k => 'updateMask.fieldPaths='+encodeURIComponent(k)).join('&');
    const f = {}; for(const k in patch) f[k] = enc(patch[k]);
    const w = await fetch(`${DOCS}/fantasy/${SEASON}/meta/players?${mask}`,
      { method:'PATCH', headers:{...auth, 'Content-Type':'application/json'}, body:JSON.stringify({fields:f}) });
    if(w.ok) return out(200, {ok:true, n:list.length, updated:patch.updated});
    return out(502, {ok:false, err:'write '+w.status});
  }catch(e){ return out(502, {ok:false, err:String(e.message||e).slice(0,120)}); }
};
