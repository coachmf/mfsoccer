/* دمج مباراة واحدة في وثيقة الموسم على الخادم (منصور 2026-11-21 «نبي حل جذري… التعليق والانترنت بطيء»).
   نسخة حرفية من خطوات applyEdit في index.html بعد mergeEdit: الجهاز يدمج مباراته (التوقيعات و base كما هي) ويرسل «شريحتها»
   فقط — المباراة وصفوفها — والخادم يحذف صفوف المباراة القديمة (removeMatchByKey) ويضيف الشريحة ويشتق النتيجة ويرتب ويرقّم.
   أي تغيير في removeMatchByKey / applyEdit / stampComp في index.html يجب أن ينعكس هنا. */
'use strict';
const compOf = x => (x && x.comp) || 'الدوري';
const mkey = m => `${m.round}|${compOf(m)}|${m.home}|${m.away}`;

function removeMatchByKey(d, key){
  const old = (d.matches || []).find(m => mkey(m) === key);
  if(!old) return false;
  const pair = (a, b) => (a === old.home && b === old.away) || (a === old.away && b === old.home);
  d.matches = d.matches.filter(m => mkey(m) !== key);
  d.goals   = (d.goals || []).filter(g => !(g.r === old.round && compOf(g) === compOf(old) && pair(g.sc, g.cd)));
  d.cards   = (d.cards || []).filter(x => !(x.r === old.round && compOf(x) === compOf(old) && (x.club === old.home || x.club === old.away)));
  d.pens    = (d.pens || []).filter(x => !(x.r === old.round && compOf(x) === compOf(old) && pair(x.by, x.vs)));
  const mine = x => x.r === old.round && compOf(x) === compOf(old) && (x.club === old.home || x.club === old.away);
  d.lineups = (d.lineups || []).filter(x => !mine(x));
  d.shapes  = (d.shapes || []).filter(x => !mine(x));
  d.subs    = (d.subs || []).filter(x => !mine(x));
  d.mev     = (d.mev || []).filter(x => !(x.r === old.round && compOf(x) === compOf(old) && x.home === old.home && x.away === old.away));
  return true;
}
/* صفوف مباراة كما يحددها removeMatchByKey — الجهاز يستخرج بها شريحته من بياناته بعد applyEdit */
function sliceOf(d, m){
  const pair = (a, b) => (a === m.home && b === m.away) || (a === m.away && b === m.home);
  const mine = x => x.r === m.round && compOf(x) === compOf(m) && (x.club === m.home || x.club === m.away);
  return {
    match: m,
    goals:   (d.goals || []).filter(g => g.r === m.round && compOf(g) === compOf(m) && pair(g.sc, g.cd)),
    cards:   (d.cards || []).filter(mine),
    pens:    (d.pens || []).filter(x => x.r === m.round && compOf(x) === compOf(m) && pair(x.by, x.vs)),
    lineups: (d.lineups || []).filter(mine),
    shapes:  (d.shapes || []).filter(mine),
    subs:    (d.subs || []).filter(mine),
    mev:     (d.mev || []).filter(x => x.r === m.round && compOf(x) === compOf(m) && x.home === m.home && x.away === m.away),
  };
}
function stampComp(d){
  (d.goals || []).forEach(g => { if(g.comp) return;
    const m = (d.matches || []).find(m => m.round === g.r && ((m.home === g.sc && m.away === g.cd) || (m.home === g.cd && m.away === g.sc)));
    g.comp = m ? compOf(m) : compOf(g); });
  (d.pens || []).forEach(x => { if(x.comp) return;
    const m = (d.matches || []).find(m => m.round === x.r && ((m.home === x.by && m.away === x.vs) || (m.home === x.vs && m.away === x.by)));
    x.comp = m ? compOf(m) : compOf(x); });
  ['cards', 'lineups', 'shapes', 'subs'].forEach(k => (d[k] || []).forEach(x => { if(!x.comp) x.comp = 'الدوري'; }));
  return d;
}
/* p = {orig, slice:{match, goals, cards, pens, lineups, shapes, subs, mev}, squads:{club:list}} — يعدّل d ويعيده */
function applySlice(d, p){
  const s = p.slice;
  if(!s || !s.match || !s.match.home || !s.match.away) throw new Error('شريحة ناقصة');
  if(p.squads && typeof p.squads === 'object'){ d.squads = d.squads || {}; for(const c in p.squads) if(Array.isArray(p.squads[c])) d.squads[c] = p.squads[c]; }
  if(p.orig) removeMatchByKey(d, p.orig);
  removeMatchByKey(d, mkey(s.match));   /* حفظ ثانٍ وصل قبل الأول / إعادة إرسال: لا تكرار */
  d.matches = d.matches || [];
  d.matches.push(JSON.parse(JSON.stringify(s.match)));
  for(const k of ['goals', 'cards', 'pens', 'lineups', 'shapes', 'subs', 'mev']){ d[k] = d[k] || []; (s[k] || []).forEach(r => d[k].push(JSON.parse(JSON.stringify(r)))); }
  d.matches.forEach(mm => {
    const gh = d.goals.filter(g => g.r === mm.round && compOf(g) === compOf(mm) && g.sc === mm.home && g.cd === mm.away).length;
    const ga = d.goals.filter(g => g.r === mm.round && compOf(g) === compOf(mm) && g.sc === mm.away && g.cd === mm.home).length;
    if(!(gh + ga) && mm.manH != null && mm.manA != null){ mm.hg = +mm.manH; mm.ag = +mm.manA; }
    else { mm.hg = gh; mm.ag = ga; }
  });
  d.matches.sort((a, b) => (a.round - b.round) || String(a.date).localeCompare(String(b.date)));
  d.matches.forEach((mm, i) => mm.n = i + 1);
  stampComp(d);
  return d;
}
module.exports = { compOf, mkey, removeMatchByKey, sliceOf, stampComp, applySlice };
