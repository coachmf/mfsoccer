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
    const hist = (r.v.history || []).filter(h => h.gw !== gw).concat([{
      gw, pts:r.res.total, benchPts:r.res.benchPts || 0, rank:r.rank, chip:r.res.chip || null, hits:r.res.hits || 0
    }]).sort((a, b) => a.gw - b.gw);
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
  return { E, st, root };
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
    if(!pre.ok && pre.why !== 'too soon' && pre.why !== 'waiting bonus') return { ok:true, gw:cur, idle:pre.why };
  }
  const { E, st } = await readState(io);
  const gw = st.currentGW, ready = readiness(st);
  const run0 = await getRun(io);
  if(!ready.ok){
    /* لا شيء ليُحتسب — نسجّل آخر فحص فقط إن تغيّرت الحالة (لا كتابة كل 5 دقائق بلا داعٍ) */
    return { ok:true, gw, idle:ready.why };
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
    ownUpdated:updated, board:st.board || [], updated, updatedBy:'server' };
  /* اللاعبون (الأسعار) أولاً، ثم اللعبة، ثم لقطة الترتيب، ثم القفل — فلا تفتح الانتقالات قبل أن يكتمل كل شيء */
  await io.commit([{ path:`${F}/meta/players`, data:{ list:st.players, priceVer:E.SEED_PRICE_VER || 1, updated }, mask:false }]);
  await io.commit([{ path:F, data:meta }]);
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

module.exports = { step, verify, readiness, scoreAll, writesFor, readState, getRun };
