/* احتساب جولة الفانتسي على الخادم (تدقيق 2026-11-09، الدفعة 3: «اللعبة تدير نفسها»).
   يعيد ما يفعله ADMIN.doFinalize في المتصفح حرفياً — بنفس المحرك (fantasy-engine) — لكن:
   - كل الحساب في الذاكرة أولاً (نقاط الجميع والترتيب على الجميع)، ثم الكتابة على دفعات مشروطة؛
   - قابل للاستئناف: كل تشغيل يعيد الحساب (حتمي) ويكتب ما بقي فقط، فالانقطاع لا يترك نصف جولة؛
   - قفل تشغيل واحد (meta/gwrun) فلا يعمل منفّذان معاً، وسجل يراه المدير.
   الترتيب: نقاط المشتركين ← (عند اكتمالها) الأسعار وحالة اللعبة ← لقطة الترتيب ← قفل الانتقالات للجولة التالية آخراً. */
'use strict';
const { makeEngine, buildState } = require('./fantasy-engine');

const SEASON = '2026-2027';
const F = `fantasy/${SEASON}`;
const LEASE_MS = 4 * 60e3;

const clone = x => JSON.parse(JSON.stringify(x));

/* ===== استيراد النتائج من الموقع على الخادم (تدقيق 2026-11-09، C7): نفس MFSYNC الذي يعمل في المتصفح، فلا تتوقف الجولة
   على فتح المدير للعبة. يُنشر مستند الجولة إن اختلف عن نسخة الخادم (نفس مقارنة ADMIN.autoSync المرتّبة المفاتيح). ===== */
const canon = x => JSON.stringify(x, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce((o, kk) => (o[kk] = v[kk], o), {}) : v);
const fxSig = f => [f.hs, f.as, !!f.over, (f.bonus || []).filter(b => b && b.name).map(b => b.name + b.pts).join('|'),
  canon([f.goals || [], f.cards || [], f.pens || [], f.subs || [], f.lineups || null]), f.status, f.date || ''].join('/');
async function syncResults(io, E, st, R, opts){
  opts = opts || {};
  const site = await io.get(`seasons/${SEASON}`); if(!site) return { skip:'no site' };
  const M = E.MFSYNC; M.fetchSeasonRaw = async () => clone(site.data);
  const data = await M.fetchSeason();
  M.syncFixtures(data, st, { removeMissing:true });
  const out = { published:[], diff:{} };
  for(const gw of (opts.gws || [st.currentGW])){
    await M.importRound(gw, { quiet:true, data, force:!!opts.force });
    const srv = (R[gw] && R[gw].fixtures) || [];
    const loc = st.fixtures.filter(f => f.gw === gw);
    const diff = loc.length !== srv.length || loc.some(f => { const o = srv.find(x => x.id === f.id); return !o || fxSig(o) !== fxSig(f); });
    out.diff[gw] = diff;
    if(diff && !opts.dry){
      const pg = {}; for(const pid in st.playerGW){ const row = st.playerGW[pid][gw]; if(row) pg[pid] = row; }
      await io.commit([{ path:`${F}/rounds/${gw}`, data:{ fixtures:clone(loc), playerGW:pg, updated:new Date().toISOString(), by:'server' }, mask:false }]);
      out.published.push(gw);
    }
  }
  return out;
}
/* فحص خفيف: هل في الموقع مباراة منتهية من الجولة الحالية لم تصل لنسخة الخادم بعد؟ */
async function siteAhead(io, root, cur, roundFx){
  const nz = x => String(x || '').replace(/[ىيئ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/\s+/g, '');
  const ids = {}; (root.clubs || []).forEach(c => { if(c && c.id){ ids[nz(c.name)] = c.id; if(c.short) ids[nz(c.short)] = c.id; } });
  const s = await io.get(`seasons/${SEASON}`); if(!s) return false;
  return (s.data.matches || []).some(m => {
    if((m.comp && m.comp !== 'الدوري') || +m.round !== cur || m.status !== 'ft') return false;
    const h = ids[nz(m.home)], a = ids[nz(m.away)]; if(!h || !a) return false;
    const f = roundFx.find(x => (x.h === h && x.a === a) || (x.h === a && x.a === h));
    if(!f || f.status !== 'F' || f.over === false) return true;
    const hs = f.h === h ? +f.hs : +f.as, as = f.h === h ? +f.as : +f.hs;
    return hs !== +m.hg || as !== +m.ag;
  });
}

/* readiness = ADMIN.autoFinalizeReady */
function readiness(st){
  const gw = st.currentGW;
  if(!(gw >= (st.rules.scoringFromGW || 1))) return { ok:false, why:'before scoring' };
  const g = (st.gws || []).find(x => x.n === gw); if(!g || g.status === 'finished') return { ok:false, why:'finished' };
  const played = st.fixtures.filter(f => f.gw === gw && f.status !== 'P');
  if(!played.length) return { ok:false, why:'no fixtures' };
  if(played.some(f => f.status !== 'F' || f.over === false)) return { ok:false, why:'matches left' };
  const last = Math.max(...played.map(f => Date.parse(f.date)).filter(n => !isNaN(n)));
  if(!isFinite(last)) return { ok:false, why:'too soon' };
  const bonus = played.every(f => (f.bonus || []).length >= 3);
  if(bonus) return { ok:true, gw };
  const now = Date.now();
  if(now < last + 3*3600e3) return { ok:false, why:'too soon' };
  if(now < last + 18*3600e3) return { ok:false, why:'waiting bonus' };
  return { ok:true, gw, noBonus:true };
}

/* CLOUD.validPicks */
function validPicks(E, p, st){
  if(!p) return false;
  const xi = p.xi || [], bench = p.bench || [], sq = [...xi, ...bench];
  if(xi.length !== 11 || bench.length !== (st.rules.squadSize || 15) - 11 || new Set(sq).size !== sq.length) return false;
  if(sq.some(pid => !E.DB.player(pid))) return false;
  if(!E.TEAM.validateXI(xi, st).ok) return false;
  if(!p.cap || !xi.includes(p.cap) || (p.vice && !xi.includes(p.vice))) return false;
  if(p.chip && !Object.keys((st.rules && st.rules.chips) || {benchboost:1, triplecap:1, freehit:1, wildcard:1}).includes(p.chip)) return false;
  return true;
}
/* CLOUD.boardRow */
function boardRow(uid, v, hist, total){
  hist = (hist || v.history || []).map(h => ({ gw:+h.gw, pts:+h.pts || 0 }));
  return { id:uid, name:v.username || 'مشترك', teamName:v.teamName || '', total: total != null ? +total : (+v.total || 0),
    hist, last: hist.length ? hist[hist.length - 1].pts : 0,
    fav: (/^fav:([A-Z]{3})(?:\||$)/.exec(v.avatar || '') || [])[1] || null };
}

/* نقاط كل المشتركين للجولة gw — نفس CLOUD.finalizeForAll، لكن الترتيب على كل من شارك (لا على من كُتب في هذا التشغيل) */
function scoreAll(E, st, gw, mgrs){
  const fill = t => Object.assign({ squad:[], xi:[], bench:[], cap:null, vice:null, bank:st.rules.budget,
    ft:st.rules.freeTransfers, usedChips:{}, activeChip:null, joinedGW:1, transfers:[], gwPicks:{}, pendingHits:0 }, t || {});
  const out = { rows:[], skipped:0, badPicks:0, own:{}, transfers:{}, count:0, board:[], cleanEmail:[] };
  for(const m of mgrs){
    const v = m.data;
    if(((v.team && v.team.squad) || []).some(pid => !E.DB.player(pid))){ out.skipped++; out.board.push(boardRow(m.id, v)); continue; }
    const team = fill(clone(v.team || {}));
    delete team.history;
    E.TEAM.normalize(team, st);
    const squad = team.squad || [];
    if(!squad.length){ if(v.email !== undefined) out.cleanEmail.push(m); continue; }
    out.count++;
    squad.forEach(pid => { out.own[pid] = (out.own[pid] || 0) + 1; });
    if(team.coach) out.own[team.coach] = (out.own[team.coach] || 0) + 1;
    (team.transfers || []).filter(t => t.gw === gw).forEach(t => {
      out.transfers[t.in] = out.transfers[t.in] || {in:0, out:0}; out.transfers[t.in].in++;
      out.transfers[t.out] = out.transfers[t.out] || {in:0, out:0}; out.transfers[t.out].out++;
    });
    const joined = v.joinedGW || team.joinedGW || 1;
    if(joined > gw){ out.board.push(boardRow(m.id, v)); continue; }
    const prev = (v.history || []).find(h => h.gw === gw);
    const done = !!(prev && (+(v.team && v.team.rolledGW) || 0) >= gw);
    let res;
    if(done) res = { total:+prev.pts || 0, benchPts:+prev.benchPts || 0, chip:prev.chip || null, hits:+prev.hits || 0 };
    else {
      team.gwPicks = team.gwPicks || {};
      if(team.gwPicks[gw] && !validPicks(E, team.gwPicks[gw], st)){ team.gwPicks[gw] = null; out.badPicks++; }
      if(!team.gwPicks[gw]){ team.gwPicks[gw] = E.TEAM.picksFrom(team); if(gw < st.currentGW){ team.gwPicks[gw].chip = null; team.gwPicks[gw].hits = 0; } }
      res = prev ? { total:+prev.pts || 0, benchPts:+prev.benchPts || 0, chip:prev.chip || null, hits:+prev.hits || 0 } : E.TEAM.gwPoints(team, gw, st);
    }
    out.rows.push({ m, v, team, res, done, prev });
  }
  out.rows.sort((a, b) => b.res.total - a.res.total);
  let p = null, rank = 0;
  out.rows.forEach((r, i) => { if(p === null || r.res.total < p){ rank = i + 1; p = r.res.total; } r.rank = rank; });
  return out;
}

/* الكتابة المطلوبة لكل مشترك: كاملة لمن لم يُحتسب، والسجل فقط لمن احتُسب وترتيبه المخزّن مختلف */
function writesFor(E, st, gw, sc){
  const W = [];
  for(const r of sc.rows){
    const det = (r.res.rows && r.res.rows.length) ? E.TEAM.detOf(r.res) : (r.prev && r.prev.det);
    const hist = (r.v.history || []).filter(h => h.gw !== gw).concat([Object.assign({
      gw, pts:r.res.total, benchPts:r.res.benchPts || 0, rank:r.rank, chip:r.res.chip || null, hits:r.res.hits || 0
    }, det ? { det } : {})]).sort((a, b) => a.gw - b.gw);
    const total = hist.reduce((s, h) => s + (h.pts || 0), 0);
    r.hist = hist; r.total = total;
    if(!r.done){
      E.GWADMIN.rollover(r.team, gw, st);
      const team = clone(r.team); team.rev = (+((r.v.team || {}).rev) || 0) + 1;
      W.push({ path:`${F}/managers/${r.m.id}`, data:{ history:hist, total, lastGW:gw, team }, updateTime:r.m.updateTime, deleteFields: r.v.email !== undefined ? ['email'] : [] });
    } else if((r.prev.rank || 0) !== r.rank || +r.v.total !== total){
      W.push({ path:`${F}/managers/${r.m.id}`, data:{ history:hist, total }, updateTime:r.m.updateTime });
    }
  }
  return W;
}

async function readState(io){
  const [root, players, rounds] = await Promise.all([io.get(F), io.get(`${F}/meta/players`), io.list(`${F}/rounds`, 50)]);
  if(!root || !players) throw new Error('game not published');
  const R = {}; rounds.forEach(d => { R[d.id] = d.data; });
  const E = makeEngine();
  const st = buildState(E, root.data, players.data, R);
  return { E, st, root, R };
}

/* سجل التشغيل والقفل */
async function getRun(io){ const d = await io.get(`${F}/meta/gwrun`); return d ? { ...d.data, _ut:d.updateTime } : null; }
async function putRun(io, run, prevUT){
  const data = { ...run }; delete data._ut;
  const w = { path:`${F}/meta/gwrun`, data, mask:false };
  if(prevUT) w.updateTime = prevUT; else w.exists = false;
  await io.commit([w]);
}

/* تشغيل واحد (دقيقة كحد أقصى): opts = { by, budgetMs, dry } */
async function step(io, opts){
  opts = opts || {};
  const t0 = Date.now(), budget = opts.budgetMs || 20000, by = opts.by || 'server';
  /* فحص خفيف أولاً (مستندان صغيران): الأغلبية الساحقة من التشغيلات لا شيء فيها — لا نقرأ اللاعبين والجولات كلها كل 5 دقائق */
  if(!opts.dry){
    const root = await io.get(F); if(!root) return { ok:true, idle:'no game' };
    const cur = +root.data.currentGW, rd = await io.get(`${F}/rounds/${cur}`);
    const lite = { currentGW:cur, rules:root.data.rules || {}, gws:root.data.gws || [], fixtures:((rd && rd.data.fixtures) || []).map(f => ({ ...f, gw:cur })) };
    const pre = readiness(lite);
    if(!pre.ok && pre.why !== 'too soon' && pre.why !== 'waiting bonus'){
      if(!(pre.why === 'matches left' && await siteAhead(io, root.data, cur, lite.fixtures))) return { ok:true, gw:cur, idle:pre.why };
    }
  }
  const { E, st, R } = await readState(io);
  /* نتائج الجولة الحالية من الموقع أولاً (وتُنشر إن اختلفت) — ثم الجاهزية على البيانات المحدّثة */
  let imp = null;
  if(!opts.noImport){ try{ imp = await syncResults(io, E, st, R, { dry:opts.dry }); }catch(e){ imp = { error:String(e.message || e).slice(0, 120) }; } }
  const gw = st.currentGW, ready = readiness(st);
  const run0 = await getRun(io);
  if(!ready.ok){
    return { ok:true, gw, idle:ready.why, imported:imp };
  }
  const now = Date.now();
  if(run0 && run0.gw === gw && run0.lease && Date.parse(run0.lease) > now && run0.by !== by) return { ok:true, gw, busy:run0.by };
  const run = (run0 && run0.gw === gw) ? { ...run0 } : { gw, state:'scoring', started:new Date().toISOString(), log:[], written:0 };
  run.by = by; run.lease = new Date(now + LEASE_MS).toISOString(); run.updated = new Date().toISOString();
  if(!opts.dry){ try{ await putRun(io, run, run0 && run0._ut); }catch(e){ if(e.precondition) return { ok:true, gw, busy:'race' }; throw e; } }
  const say = m => { run.log = (run.log || []).concat([new Date().toISOString().slice(11, 19) + ' ' + m]).slice(-30); };

  const mgrs = await io.list(`${F}/managers`, 300);
  const sc = scoreAll(E, st, gw, mgrs);
  const W = writesFor(E, st, gw, sc);
  run.eligible = sc.rows.length; run.remaining = W.length; run.skipped = sc.skipped;
  if(opts.dry) return { ok:true, gw, dry:true, eligible:sc.rows.length, writes:W.length, full:W.filter(w => w.data.team).length, skipped:sc.skipped, badPicks:sc.badPicks };

  /* 1) نقاط المشتركين على دفعات مشروطة بوقت تحديث كل مستند (لا نكتب فوق حفظ لم نره) */
  let wrote = 0, conflicts = 0;
  for(let i = 0; i < W.length; i += 100){
    if(i > 0 && Date.now() - t0 > budget) break;   // دفعة واحدة على الأقل في كل تشغيل
    const chunk = W.slice(i, i + 100);
    try{ await io.commit(chunk); wrote += chunk.length; }
    catch(e){
      if(!e.precondition) throw e;
      for(const w of chunk){ try{ await io.commit([w]); wrote++; }catch(e2){ if(e2.precondition) conflicts++; else throw e2; } }   // مستند تغيّر: التشغيل التالي يعيد قراءته
    }
  }
  run.written = (+run.written || 0) + wrote;
  if(wrote < W.length || conflicts){
    run.state = 'scoring'; run.remaining = W.length - wrote + conflicts; say(`كُتب ${wrote} — بقي ${run.remaining}`);
    run.lease = new Date(Date.now() + 30e3).toISOString();   // التشغيل التالي يكمل فوراً
    await putRun(io, run, (await getRun(io))._ut);
    return { ok:true, gw, state:'scoring', wrote, remaining:run.remaining };
  }

  /* 2) اكتمل احتساب الجميع: الأسعار + إغلاق الجولة + الجولة التالية (GWADMIN.finalize على حالة الخادم) */
  const pts = sc.rows.map(r => r.res.total);
  const board = sc.board.concat(sc.rows.map(r => boardRow(r.m.id, r.v, r.hist, r.total)));
  board.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'ar'));
  const agg = { avg: pts.length ? Math.round(pts.reduce((a, b) => a + b, 0) / pts.length) : null, high: pts.length ? Math.max(...pts) : null,
    own: sc.own, count: sc.count, transfers: sc.transfers, board };
  if(E.STANDINGS) E.STANDINGS.snapshot(st, gw);
  const fin = E.GWADMIN.finalize(gw, agg);
  if(!fin.ok) throw new Error('finalize: ' + fin.err);
  const updated = new Date().toISOString();
  st.ownUpdated = updated;
  const g = st.gws.find(x => x.n === st.currentGW);
  const lock = { gw: st.currentGW, deadline: { __ts: new Date(g && g.deadline ? g.deadline : '2099-01-01T00:00:00Z').toISOString() },
    deadlineISO: (g && g.deadline) || null, provisional: !(g && g.deadline), open: !!g && g.status !== 'finished', updated };
  const meta = { rules:st.rules, scoring:st.scoring, currentGW:st.currentGW, gws:st.gws, news:st.news || [], liveSpeed:st.liveSpeed || 2,
    clubs:st.clubs, coaches:st.coaches || [], own:st.own || {}, managerCount:st.managerCount || 0, transferStats:st.transferStats || {},
    updated, updatedBy:'server' };   /* لوحة الترتيب وطابعها في meta/own وحدها (M7) */
  /* اللاعبون (الأسعار) أولاً، ثم اللعبة، ثم لقطة الترتيب، ثم القفل — فلا تفتح الانتقالات قبل أن يكتمل كل شيء */
  await io.commit([{ path:`${F}/meta/players`, data:{ list:st.players, priceVer:E.SEED_PRICE_VER || 1, updated }, mask:false }]);
  await io.commit([{ path:F, data:meta, deleteFields:['board','ownUpdated'] }]);
  await io.commit([{ path:`${F}/meta/own`, data:{ own:st.own || {}, managerCount:sc.count, registered:mgrs.length, ownUpdated:updated, board, updatedBy:'server' }, mask:false }]);
  await io.commit([{ path:`${F}/meta/lock`, data:lock, mask:false }]);
  run.state = 'done'; run.finished = updated; run.avg = agg.avg; run.high = agg.high; run.prices = fin.changes; run.lease = null; run.remaining = 0;
  say(`احتُسبت الجولة ${gw}: ${sc.rows.length} مشتركاً، متوسط ${agg.avg}، أعلى ${agg.high}، تغيّر سعر ${fin.changes}`);
  await putRun(io, run, (await getRun(io))._ut);
  return { ok:true, gw, state:'done', avg:agg.avg, high:agg.high, prices:fin.changes, eligible:sc.rows.length, wrote };
}

/* تحقق بلا كتابة: نقاط الجولة gw لكل مشترك من تشكيلته المحفوظة بالمحرك على الخادم، مقابل المخزّن في سجله */
async function verify(io, gw){
  const { E, st } = await readState(io);
  const mgrs = await io.list(`${F}/managers`, 300);
  let n = 0, same = 0; const diff = [];
  for(const m of mgrs){
    const v = m.data, h = (v.history || []).find(x => x.gw === gw), t = v.team;
    if(!h || !t || !(t.gwPicks || {})[gw]) continue;
    if((t.squad || []).some(pid => !E.DB.player(pid))) continue;
    n++;
    const team = clone(t); delete team.history;
    const res = E.TEAM.gwPoints(team, gw, st);
    if(res.total === +h.pts) same++; else diff.push({ id:m.id, name:v.username, stored:+h.pts, now:res.total });
  }
  return { gw, checked:n, same, diff:diff.length, examples:diff.slice(0, 15) };
}

/* ===== الترتيب الحي على الخادم (تدقيق 2026-11-09، البند 2): كان كل جهاز يحمّل تشكيلات كل المشتركين (~1500) ويحسبها بنفسه،
   فتختلف الأرقام بين جهاز وآخر حسب توقيت التحميل ويثقل الجوال. الآن يحسبها الخادم مرة بنفس المحرك وينشرها في meta/liveboard،
   والأجهزة تقرأ اللقطة من /api/fantasy-live. نقاط المشترك نفسه تبقى تُحسب على جهازه لحظياً.
   التشكيلات بعد الموعد مقفلة، فتُخزَّن مرة في meta/livepicks (تُجدَّد كل 6 ساعات لالتقاط أي تصحيح من الإدارة) — لا قراءة لكل المشتركين كل 5 دقائق. ===== */
const LIVE_PICKS_MS = 6 * 3600e3, LIVE_MAX_AGE_MS = 30 * 60e3;
function liveTeam(row, gw){ return { joinedGW:row[4], gwPicks:{ [gw]: row[5] }, transfers:[], history:[] }; }
async function livePicks(io, E, st, gw, force){
  const c = await io.get(`${F}/meta/livepicks`);
  if(!force && c && +c.data.gw === gw && Date.now() - Date.parse(c.data.at) < LIVE_PICKS_MS){ try{ return JSON.parse(c.data.json); }catch(e){} }
  const mgrs = await io.list(`${F}/managers`, 300), rows = [];
  for(const m of mgrs){
    const v = m.data, t = v.team;
    if(!t || !Array.isArray(t.squad) || !t.squad.length) continue;
    if((+v.joinedGW || 0) > gw) continue;                    // فريقه يبدأ من الجولة التالية
    const p = (t.gwPicks && t.gwPicks[gw]) || E.TEAM.picksFrom(t);
    rows.push([m.id, v.username || 'مشترك', v.teamName || '', +v.total || 0, +v.joinedGW || 1,
      { xi:p.xi || [], bench:p.bench || [], cap:p.cap || null, vice:p.vice || null, chip:p.chip || null, hits:+p.hits || 0, coach:p.coach || null }]);
  }
  const json = JSON.stringify(rows);
  if(json.length < 900000) await io.commit([{ path:`${F}/meta/livepicks`, data:{ gw, at:new Date().toISOString(), n:rows.length, json }, mask:false }]);   // حد المستند 1MB
  return rows;
}
/* نقاط الجولة قبل آخر مباراة انتهت — LIVEGW.beforeLast نفسها (لأسهم الترتيب) */
function beforeLast(E, st, gw, calc){
  const fin = st.fixtures.filter(f => f.gw === gw && f.status === 'F' && f.over !== false && f.stats);
  if(!fin.length) return null;
  const f = fin.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0];
  const pids = new Set(); for(const c in f.stats) for(const pid in (f.stats[c] || {})) pids.add(pid);
  const saved = {}; pids.forEach(pid => { saved[pid] = st.playerGW[pid] ? st.playerGW[pid][gw] : undefined; });
  const sS = f.stats, sSt = f.status, sO = f.over, out = {};
  try{
    f.stats = null; f.status = 'U'; f.over = false;
    pids.forEach(pid => { const r = E.aggPGW(st, pid, gw); st.playerGW[pid] = st.playerGW[pid] || {}; if(r) st.playerGW[pid][gw] = r; else delete st.playerGW[pid][gw]; });
    out.v = calc();
  }finally{
    f.stats = sS; f.status = sSt; f.over = sO;
    pids.forEach(pid => { if(saved[pid] === undefined){ if(st.playerGW[pid]) delete st.playerGW[pid][gw]; } else st.playerGW[pid][gw] = saved[pid]; });
  }
  return out.v;
}
/* opts: { force, dry, state:{E,st,R} } */
async function live(io, opts){
  opts = opts || {};
  if(!opts.state && !opts.force){
    /* فحص خفيف: قبل موعد إغلاق الجولة لا يوجد ترتيب حي — مستند واحد بدل قراءة الحالة كلها */
    const root = await io.get(F); if(!root) return { idle:'no game' };
    const cur = +root.data.currentGW, g = (root.data.gws || []).find(x => +x.n === cur);
    if(!g || g.status === 'finished' || !g.deadline || Date.now() < Date.parse(g.deadline)) return { idle:'before deadline', gw:cur };
  }
  const S = opts.state || await readState(io);
  const { E, st, R } = S;
  if(!opts.state){ try{ await syncResults(io, E, st, R, { dry:true }); }catch(e){} }   // نتائج الموقع الآن (بلا نشر — النشر للاحتساب)
  const gw = st.currentGW;
  if(!E.GWADMIN.inProgress(gw)) return { idle:'not live', gw };
  const fx = st.fixtures.filter(f => f.gw === gw);
  const sig = fx.map(f => f.id + ':' + fxSig(f)).join(';');
  const old = await io.get(`${F}/meta/liveboard`);
  if(!opts.force && old && +old.data.gw === gw && old.data.sig === sig && Date.now() - Date.parse(old.data.at) < LIVE_MAX_AGE_MS) return { same:true, gw, n:+old.data.n, avg:+old.data.avg, high:+old.data.high, at:old.data.at };
  const picks = await livePicks(io, E, st, gw, opts.force);
  const calcAll = () => { const o = {}; for(const r of picks){ try{ o[r[0]] = +E.TEAM.gwPoints(liveTeam(r, gw), gw, st, { live:true }).total || 0; }catch(e){ o[r[0]] = 0; } } return o; };
  const now = calcAll(), prev = beforeLast(E, st, gw, calcAll);
  const rows = picks.map(r => ({ id:r[0], name:r[1], teamName:r[2], total:r[3], live:now[r[0]] || 0, prev: prev ? (prev[r[0]] || 0) : null }));
  rows.sort((a, b) => b.live - a.live);
  let p = null, rank = 0; rows.forEach((r, i) => { if(p === null || r.live < p){ rank = i + 1; p = r.live; } r.liveRank = rank; });
  const played = fx.filter(f => f.status === 'F' && f.over !== false).length;
  if(rows.length > 1 && played > 0 && rows.every(r => r.live <= 0)) return { zero:true, gw };   // إحصاءات لم تصل بعد
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.live, 0) / rows.length) : 0, high = rows.length ? rows[0].live : 0;
  const compact = rows.map(r => [r.id, r.name, r.teamName, r.total, r.live, r.prev, r.liveRank]);
  if(opts.dry) return { gw, n:rows.length, avg, high, played, rows };
  await io.commit([{ path:`${F}/meta/liveboard`, data:{ gw, at:new Date().toISOString(), sig, n:rows.length, avg, high, played, json:JSON.stringify(compact) }, mask:false }]);
  return { wrote:true, gw, n:rows.length, avg, high, played };
}

/* ===== مراقب الجولة (منصور 2026-11-09): تنبيه الإدارة إن تأخر شيء — 3 مستندات صغيرة كل تشغيل =====
   1) مباراة مضى على موعدها 6 ساعات ولم تصل نتيجتها للفانتسي (لم تُدخل في الموقع أو لم تُستورد)
   2) اكتملت المباريات منذ 24 ساعة والجولة لم تُحتسب
   3) احتساب بدأ ولم يتقدّم منذ ساعة */
async function watch(io){
  const root = await io.get(F); if(!root) return [];
  const cur = +root.data.currentGW, g = (root.data.gws || []).find(x => +x.n === cur);
  if(!g || g.status === 'finished') return [];
  const [rd, run] = await Promise.all([io.get(`${F}/rounds/${cur}`), getRun(io)]);
  const fx = (rd && rd.data.fixtures) || [], now = Date.now(), out = [];
  const name = id => { const c = (root.data.clubs || []).find(x => x.id === id); return (c && (c.short || c.name)) || id; };
  for(const f of fx){
    const t = Date.parse(f.date); if(isNaN(t) || f.status === 'P') continue;
    if((f.status !== 'F' || f.over === false) && now > t + 6 * 3600e3)
      out.push({ sig:`fxlate|${cur}|${f.id}`, title:'تنبيه للإدارة: نتيجة مباراة لم تصل للفانتسي',
        body:`${name(f.h)} × ${name(f.a)} (الجولة ${cur}) — مضت 6 ساعات على موعدها. تأكد أن النتيجة والتشكيلة مدخلة في الموقع.` });
  }
  const played = fx.filter(f => f.status !== 'P');
  if(played.length && played.every(f => f.status === 'F' && f.over !== false)){
    const last = Math.max(...played.map(f => Date.parse(f.date)).filter(n => !isNaN(n)));
    if(isFinite(last) && now > last + 24 * 3600e3 && !(run && +run.gw === cur && run.state === 'done'))
      out.push({ sig:`gwlate|${cur}`, title:`تنبيه للإدارة: الجولة ${cur} لم تُحتسب`, body:'اكتملت المباريات منذ أكثر من 24 ساعة والاحتساب التلقائي لم ينتهِ — افتح لوحة الجولات.' });
  }
  if(run && +run.gw === cur && run.state === 'scoring' && run.updated && now - Date.parse(run.updated) > 3600e3)
    out.push({ sig:`gwstuck|${cur}|${String(run.updated).slice(0, 13)}`, title:`تنبيه للإدارة: احتساب الجولة ${cur} متوقف`, body:`بقي ${run.remaining || '?'} مشتركاً ولم يتقدّم منذ ساعة.` });
  return out;
}

module.exports = { step, verify, readiness, scoreAll, writesFor, readState, getRun, syncResults, live, watch };
