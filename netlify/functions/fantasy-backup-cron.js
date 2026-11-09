/* نسخة احتياطية يومية للفانتسي (منصور 2026-11-09). يعمل كل ساعة لكن لا يكتب إلا إن لم تُؤخذ نسخة اليوم (بتوقيت الكويت) —
   فإن فشل تشغيل يُعاد في الساعة التالية. التفاصيل في lib/backup.js. */
'use strict';
const { accessToken } = require('./lib/google');
const { makeIO } = require('./lib/fsrest');
const bk = require('./lib/backup');
const { notifyStaff } = require('./lib/staff-alert');

exports.handler = async () => {
  const at = await accessToken('https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging');
  try{ const r = await bk.run(makeIO(at)); console.log('fantasy-backup', JSON.stringify(r)); return { statusCode:200, body:JSON.stringify(r) }; }
  catch(e){
    const msg = String(e && e.message || e).slice(0, 160);
    const day = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
    if(new Date(Date.now() + 3 * 3600e3).getUTCHours() >= 12)   /* تنبيه فقط إن ظل يفشل حتى منتصف اليوم */
      await notifyStaff(at, `bkfail|${day}`, 'تنبيه للإدارة: تعذّرت النسخة الاحتياطية للفانتسي اليوم', msg).catch(() => null);
    console.error('fantasy-backup failed', e); return { statusCode:500, body:msg };
  }
};
