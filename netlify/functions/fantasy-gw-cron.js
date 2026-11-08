/* احتساب الجولة تلقائياً على الخادم كل 5 دقائق (تدقيق 2026-11-09، الدفعة 3 — منصور: «اللعبة تدير نفسها»).
   لا يحتاج جهاز مدير مفتوحاً: إن اكتملت مباريات الجولة وبونصها (أو مرّت 18 ساعة) يحتسب نقاط الجميع على دفعات
   قابلة للاستئناف ثم يغلق الجولة ويفتح التالية. التفاصيل في lib/gw-core.js، والسجل في fantasy/<season>/meta/gwrun.
   عند الفشل يُرسل تنبيه لأجهزة الإدارة مرة واحدة لكل خطأ. */
'use strict';
const { accessToken } = require('./lib/google');
const { makeIO } = require('./lib/fsrest');
const core = require('./lib/gw-core');
const { notifyStaff } = require('./lib/staff-alert');

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
  if(r.state === 'done') await notifyStaff(at, `gwdone|${r.gw}`, `احتُسبت الجولة ${r.gw} تلقائياً`,
    `${r.eligible} مشتركاً · المتوسط ${r.avg} · الأعلى ${r.high} · تغيّر سعر ${r.prices} لاعباً`).catch(() => null);
  return r;
}

exports.handler = async () => {
  try{ const r = await run(); console.log('fantasy-gw', JSON.stringify(r)); return { statusCode:200, body:JSON.stringify(r) }; }
  catch(e){ console.error('fantasy-gw failed', e); return { statusCode:500, body:String(e.message || e) }; }
};
exports._run = run;
