/* احتساب الجولة تلقائياً على الخادم كل 5 دقائق (تدقيق 2026-11-09، الدفعة 3 — منصور: «اللعبة تدير نفسها»).
   لا يحتاج جهاز مدير مفتوحاً: إن اكتملت مباريات الجولة وبونصها (أو مرّت 18 ساعة) يحتسب نقاط الجميع على دفعات
   قابلة للاستئناف ثم يغلق الجولة ويفتح التالية. التفاصيل في lib/gw-core.js، والسجل في fantasy/<season>/meta/gwrun.
   عند الفشل يُرسل تنبيه لأجهزة الإدارة مرة واحدة لكل خطأ. */
'use strict';
const { accessToken } = require('./lib/google');
const { makeIO } = require('./lib/fsrest');
const core = require('./lib/gw-core');
const { notifyStaff } = require('./lib/staff-alert');
const xiAlert = require('./lib/xi-alert');
const gwPush = require('./lib/gw-push');

async function run(){
  const at = await accessToken('https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging');
  const io = makeIO(at);
  let r;
  try{ r = await core.step(io, { by:'server', budgetMs:18000 }); }
  catch(e){
    const msg = String(e && e.message || e).slice(0, 200);
    await notifyStaff(at, `gwfail|${msg.slice(0, 60)}`, 'تنبيه للإدارة: تعذّر احتساب الجولة تلقائياً', msg + ' — يُعاد المحاولة كل 5 دقائق').catch(() => null);
    throw e;
  }
  /* الترتيب الحي للجولة الجارية (meta/liveboard) — فقط حين لا يوجد احتساب جارٍ في هذا التشغيل */
  if(r && r.idle && r.idle !== 'finished'){
    try{ r.live = await core.live(io); }catch(e){ r.live = { error:String(e && e.message || e).slice(0, 120) }; }
    /* تنبيه التشكيلة قبل الإغلاق بساعة (مصاب/موقوف/مباراة مؤجلة في الأساسيين) — مرة لكل جولة */
    if(r.live && r.live.idle === 'before deadline'){ try{ r.xi = await xiAlert.run(io, at); }catch(e){ r.xi = { error:String(e && e.message || e).slice(0, 120) }; } }
  }
  /* نتيجة كل مشترك بعد الاحتساب (مرة لكل جولة، خلال 24 ساعة من اكتماله) */
  if(r && (r.state === 'done' || r.idle)){ try{ const p = await gwPush.run(io, at); if(!p.idle) r.push = p; }catch(e){ r.push = { error:String(e && e.message || e).slice(0, 120) }; } }
  /* مراقب التأخير — تنبيه واحد لكل حالة (notifyStaff يمنع التكرار بالتوقيع) */
  try{ const W = await core.watch(io); for(const w of W) await notifyStaff(at, w.sig, w.title, w.body).catch(() => null); if(W.length) r.watch = W.map(w => w.sig); }catch(e){}
  /* نبضة: آخر فحص للخادم ونتيجته — تظهر في لوحة الجولات فيُعرف أن الأتمتة تعمل */
  try{ await io.commit([{ path:'fantasy/2026-2027/meta/gwbeat', data:{ at:new Date().toISOString(), gw:r.gw||null, result:JSON.stringify(r).slice(0, 300) }, mask:false }]); }catch(e){}
  if(r.state === 'done') await notifyStaff(at, `gwdone|${r.gw}`, `احتُسبت الجولة ${r.gw} تلقائياً`,
    `${r.eligible} مشتركاً · المتوسط ${r.avg} · الأعلى ${r.high} · تغيّر سعر ${r.prices} لاعباً`).catch(() => null);
  return r;
}

exports.handler = async () => {
  try{ const r = await run(); console.log('fantasy-gw', JSON.stringify(r)); return { statusCode:200, body:JSON.stringify(r) }; }
  catch(e){ console.error('fantasy-gw failed', e); return { statusCode:500, body:String(e.message || e) }; }
};
exports._run = run;
