/* نسخة احتياطية يومية للفانتسي (منصور 2026-11-09): المشتركون + مستند اللعبة + meta + الجولات + الدوريات،
   مضغوطة gzip في مستندات fbackups/<يوم>-<جزء> (bytes، ≤ 900KB للجزء). مجموعة fbackups لا تصلها القواعد (القاعدة العامة ترفض)،
   فلا يقرأها إلا حساب الخدمة. تُحفظ آخر 14 يوماً ويُحذف الأقدم. الاسترجاع لمشترك واحد عبر /api/fantasy-gw (action:'restore'). */
'use strict';
const zlib = require('zlib');
const SEASON = '2026-2027', F = `fantasy/${SEASON}`, KEEP_DAYS = 14, PART = 900 * 1024;
const kwDay = t => new Date(t + 3 * 3600e3).toISOString().slice(0, 10);

async function snapshot(io){
  const [root, meta, rounds, mgrs, leagues] = await Promise.all([
    io.get(F), io.list(`${F}/meta`, 100), io.list(`${F}/rounds`, 100), io.list(`${F}/managers`, 300), io.list(`${F}/leagues`, 300).catch(() => [])]);
  return { season:SEASON, at:new Date().toISOString(), root: root && root.data,
    meta: Object.fromEntries(meta.filter(d => !['livepicks', 'liveboard'].includes(d.id)).map(d => [d.id, d.data])),
    rounds: Object.fromEntries(rounds.map(d => [d.id, d.data])),
    managers: Object.fromEntries(mgrs.map(d => [d.id, d.data])),
    leagues: Object.fromEntries(leagues.map(d => [d.id, d.data])) };
}

async function run(io, opts){
  opts = opts || {};
  const day = opts.day || kwDay(Date.now());
  const head = await io.get(`fbackups/${day}-0`).catch(() => null);
  if(head && !opts.force) return { idle:'exists', day };
  const snap = await snapshot(io);
  const gz = zlib.gzipSync(JSON.stringify(snap), { level:6 });
  const parts = Math.ceil(gz.length / PART);
  const counts = { managers:Object.keys(snap.managers).length, rounds:Object.keys(snap.rounds).length, leagues:Object.keys(snap.leagues).length };
  for(let i = 0; i < parts; i++){
    await io.commit([{ path:`fbackups/${day}-${i}`, mask:false, data:{ day, part:i, parts, bytes:gz.length, at:snap.at, counts,
      gz:{ __bytes: gz.subarray(i * PART, (i + 1) * PART).toString('base64') } } }]);
  }
  /* حذف الأقدم من 14 يوماً (قائمة المعرّفات فقط — الأجزاء كبيرة فنقرأ بلا حقول) */
  const cut = kwDay(Date.now() - KEEP_DAYS * 864e5);
  const old = (await io.ids('fbackups')).filter(id => id.slice(0, 10) < cut);
  if(old.length) await io.commit(old.map(id => ({ path:`fbackups/${id}`, delete:true })));
  const res = { day, parts, kb:Math.round(gz.length / 1024), counts, deleted:old.length };
  /* ملخص صغير يقرؤه المدير في لوحة الجولات (النسخة نفسها لا يقرؤها إلا الخادم) */
  await io.commit([{ path:`${F}/meta/bkstat`, data:{ ...res, at:snap.at, days:(await days(io)).length }, mask:false }]).catch(() => null);
  return res;
}

async function load(io, day){
  const h = await io.get(`fbackups/${day}-0`); if(!h) return null;
  const bufs = [Buffer.from(h.data.gz, 'base64')];
  for(let i = 1; i < h.data.parts; i++){ const d = await io.get(`fbackups/${day}-${i}`); bufs.push(Buffer.from(d.data.gz, 'base64')); }
  return JSON.parse(zlib.gunzipSync(Buffer.concat(bufs)).toString('utf8'));
}

async function days(io){ return [...new Set((await io.ids('fbackups')).map(id => id.slice(0, 10)))].sort(); }

/* استرجاع مستند مشترك واحد كما كان في نسخة اليوم day (المستند الحالي يُحفظ أولاً في fbackups-restore للتراجع) */
async function restoreManager(io, day, uid){
  const s = await load(io, day); if(!s) return { ok:false, err:'no backup ' + day };
  const v = s.managers[uid]; if(!v) return { ok:false, err:'manager not in backup' };
  const cur = await io.get(`${F}/managers/${uid}`);
  await io.commit([{ path:`fbackups-restore/${uid}-${Date.now()}`, mask:false, data:{ uid, day, before: cur ? JSON.stringify(cur.data) : null, at:new Date().toISOString() } }]);
  await io.commit([{ path:`${F}/managers/${uid}`, data:v, mask:false }]);
  return { ok:true, uid, day, username:v.username, total:v.total };
}

module.exports = { run, load, days, restoreManager, snapshot };
