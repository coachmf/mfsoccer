/* إشعار شخصي بعد احتساب الجولة (منصور 2026-11-09): «الجولة 9: 62 نقطة · ترتيبك العام 143 (تقدّمت 85 مركزاً)».
   يُرسل مرة لكل جولة بعد أن يصير meta/gwrun في حالة done (خلال 24 ساعة)، لأجهزة حساب كل مشترك (pushprefs/<uid>.tokens)
   ممن فعّل «نقاطك وترتيبك بعد احتساب الجولة» (fr_a) — أو حفظ تفضيلاته قبل إضافته وكان ديدلاين الفانتسي مفعّلاً عنده.
   العلامة fantasy/<season>/meta/gwpush {gw} تُكتب قبل الإرسال (مشروطة)، فلا تكرار. */
'use strict';
const SEASON = '2026-2027', F = `fantasy/${SEASON}`, PROJECT = 'mfsoccer-c7ee4';

function wants(pp){
  const topics = pp.topics || [];
  if(topics.includes('fr_a')) return true;
  let ev = null; try{ ev = pp.prefs ? (JSON.parse(pp.prefs).ev || {}) : null; }catch(e){}
  return !!(ev && ev.fr === undefined && topics.includes('fd_a'));
}
/* الترتيب العام الآن وقبل الجولة (المجموع ناقص نقاط الجولة) — نفس قاعدة التعادل: نفس النقاط = نفس المركز */
function ranks(rows){
  const rank = key => { const s = rows.slice().sort((a, b) => b[key] - a[key]); const o = {}; let p = null, r = 0;
    s.forEach((x, i) => { if(p === null || x[key] < p){ r = i + 1; p = x[key]; } o[x.id] = r; }); return o; };
  return { now:rank('total'), before:rank('before') };
}
const msgOf = (gw, x) => {
  const mv = x.before - x.rank, move = !x.before || x.gw === 1 ? '' : mv > 0 ? ` (تقدّمت ${mv.toLocaleString('en')} مركزاً)` : mv < 0 ? ` (تراجعت ${(-mv).toLocaleString('en')} مركزاً)` : ' (بقيت في مركزك)';
  return { title:`نتيجتك في الجولة ${gw}`, body:`${x.pts} نقطة · ترتيبك العام ${x.rank.toLocaleString('en')} من ${x.of.toLocaleString('en')}${move}` };
};

function build(gw, mgrs){
  const rows = [];
  for(const m of mgrs){
    const h = (m.data.history || []).find(e => +e.gw === gw); if(!h) continue;
    const total = +m.data.total || 0;
    rows.push({ id:m.id, total, before: total - (+h.pts || 0), pts:+h.pts || 0 });
  }
  const R = ranks(rows);
  return rows.map(r => ({ ...r, rank:R.now[r.id], before:R.before[r.id], of:rows.length, gw }));
}

async function run(io, at, opts){
  opts = opts || {};
  const run = await io.get(`${F}/meta/gwrun`); if(!run || run.data.state !== 'done') return { idle:'no finished run' };
  const gw = +run.data.gw;
  if(gw < 9 && !opts.force) return { idle:'before feature', gw };   // أُضيف بعد احتساب الجولة 8 — يبدأ من 9
  if(!opts.force && Date.now() - Date.parse(run.data.finished || 0) > 24 * 3600e3) return { idle:'old run', gw };
  const mark = await io.get(`${F}/meta/gwpush`);
  if(!opts.force && mark && +mark.data.gw === gw) return { idle:'sent', gw };
  const mgrs = await io.list(`${F}/managers`, 300);
  const rows = build(gw, mgrs);
  if(opts.dry) return { gw, rows:rows.length, sample:rows.slice(0, 5).map(r => msgOf(gw, r).body) };
  try{ await io.commit([{ path:`${F}/meta/gwpush`, data:{ gw, at:new Date().toISOString(), rows:rows.length }, mask:false,
    ...(mark ? { updateTime:mark.updateTime } : { exists:false }) }]); }
  catch(e){ if(e.precondition) return { idle:'race', gw }; throw e; }
  const prefs = {}; (await io.list('pushprefs', 300).catch(() => [])).forEach(d => { prefs[d.id] = d.data; });
  const jobs = [];
  for(const r of rows){
    const pp = prefs[r.id]; if(!pp || !wants(pp)) continue;
    const m = msgOf(gw, r);
    (pp.tokens || []).filter(t => typeof t === 'string' && t.length > 100).forEach(token => jobs.push({ token, m }));
  }
  let sent = 0;
  for(let i = 0; i < jobs.length; i += 50){
    await Promise.all(jobs.slice(i, i + 50).map(async ({ token, m }) => {
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${PROJECT}/messages:send`, { method:'POST',
        headers:{ Authorization:'Bearer ' + at, 'Content-Type':'application/json' },
        body: JSON.stringify({ message:{ token, notification:m, data:{ ev:'fr', url:'https://mfsoccer.com/fantasy/#points' },
          apns:{ headers:{ 'apns-push-type':'alert' }, payload:{ aps:{ sound:'default' } } },
          android:{ notification:{ sound:'default' } }, webpush:{ fcm_options:{ link:'https://mfsoccer.com/fantasy/#points' } } } }) }).catch(() => null);
      if(r && r.ok) sent++;
    }));
  }
  await io.commit([{ path:`${F}/meta/gwpush`, data:{ devices:jobs.length, sent, done:new Date().toISOString() } }]).catch(() => null);
  return { gw, rows:rows.length, devices:jobs.length, sent };
}
module.exports = { run, build, msgOf, wants };
