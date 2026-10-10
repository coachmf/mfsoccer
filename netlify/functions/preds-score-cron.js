/* احتياط: احتساب «تحدي التوقعات» كل 10 دقائق (الجدول في netlify.toml) — حتى لو لم يُستدعَ بعد حفظ مباراة.
   الاحتساب لا يكتب إلا عند تغيّر النقاط، فالتشغيل المتكرر لا يكلّف كتابات زائدة. */
'use strict';
const { run } = require('./preds-score');
exports.handler = async () => {
  try{ const r = await run(); console.log('preds-score', JSON.stringify(r)); return { statusCode:200, body:JSON.stringify(r) }; }
  catch(e){ console.error('preds-score failed', e); return { statusCode:500, body:String(e.message || e) }; }
};
