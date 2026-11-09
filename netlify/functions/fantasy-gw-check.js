/* لوحة متابعة احتساب الجولة على الخادم — للمدير فقط (رمز Firebase لمالك أو مدير مفعّل).
   POST {idToken, action:'status'|'dry'|'verify'|'step', gw?}
   backups = أيام النسخ الاحتياطية · restore {day, uid} = استرجاع مشترك واحد (المالك فقط)
   status = سجل meta/gwrun وجاهزية الجولة · dry = ما سيُكتب بلا كتابة · verify = نقاط جولة محتسبة بالمحرك مقابل المخزّن · step = تشغيل الآن */
'use strict';
const { accessToken, verifyIdToken } = require('./lib/google');
const { makeIO, fields } = require('./lib/fsrest');
const core = require('./lib/gw-core');
const bk = require('./lib/backup');

const PROJECT = 'mfsoccer-c7ee4';
const OWNER_UID = 'iiTgVfDryXNLb9IrOyLkkNMHDxq2';
const H = { 'Content-Type':'application/json; charset=utf-8', 'Access-Control-Allow-Origin':'https://mfsoccer.com',
  'Access-Control-Allow-Headers':'Content-Type', 'Access-Control-Allow-Methods':'POST, OPTIONS', 'Cache-Control':'no-store' };
const out = (code, body) => ({ statusCode:code, headers:H, body:JSON.stringify(body) });

exports.handler = async (event) => {
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:H, body:'' };
  if(event.httpMethod !== 'POST') return out(405, { ok:false });
  let b; try{ b = JSON.parse(event.body || '{}'); }catch(e){ return out(400, { ok:false }); }
  let uid; try{ uid = await verifyIdToken(b.idToken, PROJECT); }catch(e){ return out(401, { ok:false, err:'auth' }); }
  try{
    const at = await accessToken('https://www.googleapis.com/auth/datastore');
    const io = makeIO(at);
    if(uid !== OWNER_UID){
      const s = await io.get('seasons/staff'); const me = s && s.data.members && s.data.members[uid];
      if(!(me && me.role === 'editor' && me.active === true && me.perm !== 'matches')) return out(403, { ok:false, err:'admin only' });
    }
    const a = b.action || 'status';
    if(a === 'status'){
      const { st } = await core.readState(io);
      return out(200, { ok:true, gw:st.currentGW, ready:core.readiness(st), run: await core.getRun(io) });
    }
    if(a === 'dry') return out(200, await core.step(io, { by:'check', dry:true }));
    if(a === 'verify') return out(200, { ok:true, ...(await core.verify(io, +b.gw)) });
    if(a === 'step') return out(200, await core.step(io, { by:'server', budgetMs:7000 }));
    /* النسخ الاحتياطية: قائمة الأيام، واسترجاع مشترك واحد من يوم بعينه (الحالي يُحفظ في fbackups-restore قبل الاستبدال) */
    if(a === 'backups') return out(200, { ok:true, days: await bk.days(io) });
    if(a === 'restore'){
      if(uid !== OWNER_UID) return out(403, { ok:false, err:'owner only' });
      if(!/^\d{4}-\d{2}-\d{2}$/.test(b.day || '') || !/^[\w-]{1,128}$/.test(b.uid || '')) return out(400, { ok:false, err:'day/uid' });
      return out(200, await bk.restoreManager(io, b.day, b.uid));
    }
    return out(400, { ok:false, err:'action' });
  }catch(e){ return out(500, { ok:false, err:String(e.message || e).slice(0, 200) }); }
};
