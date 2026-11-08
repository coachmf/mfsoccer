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
    let precond = 'currentDocument.exists=true';
    if(b.team !== undefined){
      const t = b.team;
      if(!t || typeof t !== 'object' || !Array.isArray(t.squad) || !t.squad.length || JSON.stringify(t).length >= 60000) return out(400, {ok:false, err:'bad-team'});
      const [lk, rp, rm] = await Promise.all([fetch(`${BASE}/meta/lock`, { headers:auth }), fetch(`${BASE}/meta/players`, { headers:auth }),
        fetch(`${BASE}/managers/${encodeURIComponent(uid)}`, { headers:auth })]);
      const lock = lk.ok ? fields((await lk.json()).fields) : null;
      if(!rp.ok || !rm.ok) return out(503, {ok:false, err:'retry'});          // لا نقبل فريقاً لم نتحقق منه
      const md = await rm.json(), cur = fields(md.fields), oldT = cur.team || {};
      /* نفس قفل القواعد (fanWindowOpen): بعد موعد الجولة الحالية لا تُكتب التشكيلة — إلا لمنضم جديد (تدقيق 2026-11-09، H6):
         لا فريق له على الخادم أو منضم أصلاً للجولة التالية ← يُحفظ ويبدأ من الجولة التالية */
      const dl = lock && lock.deadline ? Date.parse(lock.deadline) : NaN;
      if(isNaN(dl) || Date.now() >= dl){
        const lateOk = b.late === true && lock && +lock.gw > 0 && (!(oldT.squad||[]).length || +cur.joinedGW > +lock.gw);
        if(!lateOk) return out(403, {ok:false, err:'closed'});
        patch.joinedGW = +lock.gw + 1;
      }
      /* رقم نسخة الفريق (تدقيق 2026-11-09، C3): لا يكتب جهاز فوق نسخة لم يرها — والكتابة مشروطة بوقت تحديث المستند الذي قرأناه */
      if(b.expectRev !== undefined && b.expectRev !== null){
        if((+oldT.rev || 0) !== +b.expectRev) return out(409, {ok:false, err:'conflict'});
        t.rev = +b.expectRev + 1;
      }
      if(md.updateTime) precond = 'currentDocument.updateTime=' + encodeURIComponent(md.updateTime);
      /* التحقق من الفريق على الخادم (تدقيق 2026-11-09، H3): 15 لاعباً معروفاً بلا تكرار، تكوين المراكز لا يسوء عمّا كان،
         حد 3 من النادي لا يزيد، والتشكيلة 11 من القائمة والكابتن ونائبه منها */
      const list = (fields((await rp.json()).fields).list) || [];
      const P = {}; list.forEach(p => { if(p && p.id) P[p.id] = p; });
      const sq = t.squad, NEED = { G:2, D:5, M:5, F:3 };
      if(sq.length !== 15 || new Set(sq).size !== 15) return out(400, {ok:false, err:'squad-size'});
      if(sq.some(id => !P[id])) return out(503, {ok:false, err:'retry'});   // لاعب جديد لم يصل لقائمتنا بعد
      const dist = s => { const c = {G:0,D:0,M:0,F:0}; s.forEach(id => { const q = P[id]; if(q) c[q.pos] = (c[q.pos]||0) + 1; });
        return Object.keys(NEED).reduce((a,k) => a + Math.abs((c[k]||0) - NEED[k]), 0); };
      const oldSq = (oldT.squad || []).filter(id => P[id]);
      if(dist(sq) > (oldSq.length === 15 ? dist(oldSq) : 0)) return out(400, {ok:false, err:'positions'});
      const cnt = s => { const c = {}; s.forEach(id => { const k = P[id] && P[id].club; if(k) c[k] = (c[k] || 0) + 1; }); return c; };
      const a = cnt(sq), o = cnt(oldSq);
      for(const k in a) if(a[k] > 3 && a[k] > (o[k] || 0)) return out(400, {ok:false, err:'club', club:k});
      const xi = Array.isArray(t.xi) ? t.xi : [], bench = Array.isArray(t.bench) ? t.bench : [];
      if(xi.length !== 11 || xi.some(id => !sq.includes(id)) || bench.some(id => !sq.includes(id) || xi.includes(id)))
        return out(400, {ok:false, err:'xi'});
      if(t.cap && !xi.includes(t.cap)) return out(400, {ok:false, err:'cap'});
      const { history, ...team } = t;          // السجل يكتبه المدير وحده
      patch.team = team;
    }
    const mask = Object.keys(patch).map(k => 'updateMask.fieldPaths='+encodeURIComponent(k)).join('&');
    const f = {}; for(const k in patch) f[k] = enc(patch[k]);
    /* currentDocument.exists=true: لا ينشئ ملفاً (fantasy-me ينشئه بالشكل الصحيح) */
    const w = await fetch(`${BASE}/managers/${encodeURIComponent(uid)}?${mask}&${precond}`,
      { method:'PATCH', headers:{...auth, 'Content-Type':'application/json'}, body:JSON.stringify({fields:f}) });
    if(w.ok) return out(200, {ok:true, updated:patch.updated});
    if(w.status === 400 || w.status === 412){ const e = await w.json().catch(() => null); if(e && e.error && e.error.status === 'FAILED_PRECONDITION') return out(409, {ok:false, err:'conflict'}); }   // تغيّر المستند بين القراءة والكتابة
    return out(w.status === 404 ? 404 : 502, {ok:false, err:'write '+w.status});
  }catch(e){ return out(502, {ok:false, err:String(e.message||e).slice(0,120)}); }
};
