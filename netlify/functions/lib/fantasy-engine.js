/* محرك الفانتسي نفسه (fantasy/js/data.js + engine.js + coach.js) داخل vm على الخادم — نفس كود المتصفح حرفياً، فلا نسخة ثانية
   تختلف قواعدها (تدقيق 2026-11-09). كل استدعاء يبني سياقاً جديداً معزولاً (DB.state عام داخل المحرك). */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

let SRC = null;
function engineDir(){
  const cands = [
    path.join(__dirname, '../../../fantasy/js'), path.join(__dirname, '../../fantasy/js'),
    path.join(process.cwd(), 'fantasy/js'), path.join(process.env.LAMBDA_TASK_ROOT || '/var/task', 'fantasy/js'),
    path.join(__dirname, 'fantasy/js'), '/var/task/fantasy/js',
  ];
  for(const d of cands){ try{ if(fs.existsSync(path.join(d, 'engine.js'))) return d; }catch(e){} }
  throw new Error('fantasy engine files not found: ' + cands.join(' | '));
}
function source(){
  if(SRC) return SRC;
  const d = engineDir();
  SRC = ['data.js', 'engine.js', 'coach.js', 'mfsync.js'].map(f => fs.readFileSync(path.join(d, f), 'utf8')).join('\n;\n')
    + '\n;globalThis.__E = { DB, TEAM, GWADMIN, MARKET, RANKS, STANDINGS, COACH, COACHES, NOTIF, buildSeedState, normalizeFixtures, applyFreeRule, computeDeadlines, SEED_RULES, SEED_PRICE_VER, finalizeGWStats, genMatchStats, MFSYNC, aggPGW };';
  return SRC;
}

function makeEngine(){
  const store = new Map();
  const ctx = {
    console: { log(){}, info(){}, warn(){}, error: (...a) => console.error('[engine]', ...a) },
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    setTimeout: () => 0, clearTimeout(){}, setInterval: () => 0, clearInterval(){},
    Promise, JSON, Math, Date, Object, Array, String, Number, Boolean, Set, Map, Error, RegExp, Symbol, Intl, isNaN, isFinite, parseInt, parseFloat,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(source(), ctx, { filename: 'fantasy-engine.js', timeout: 20000 });
  const E = ctx.__E;
  E.NOTIF.push = () => {};
  return E;
}

/* حالة اللعبة كما يبنيها DB.hydrate في المتصفح: الجذر + اللاعبون + مستندات الجولات */
function buildState(E, game, playersDoc, rounds){
  const st = E.buildSeedState();
  E.DB.state = st;
  if(game.rules) st.rules = game.rules;
  if(st.rules && st.rules.chips && E.SEED_RULES.chips){
    for(const k in E.SEED_RULES.chips){
      if(st.rules.chips[k]){ st.rules.chips[k].label = E.SEED_RULES.chips[k].label; st.rules.chips[k].desc = E.SEED_RULES.chips[k].desc; }
      else st.rules.chips[k] = { ...E.SEED_RULES.chips[k] };
    }
  }
  if(st.rules) st.rules.scoringFromGW = E.SEED_RULES.scoringFromGW;
  ['scoring','clubs','coaches','news','gws','own','transferStats','ownUpdated','liveSpeed'].forEach(k => { if(game[k] !== undefined && game[k] !== null) st[k] = game[k]; });
  if(game.currentGW) st.currentGW = game.currentGW;
  if(game.managerCount != null) st.managerCount = +game.managerCount;
  if(Array.isArray(game.board)) st.board = game.board;
  try{ E.DB.syncCoaches(); }catch(e){}
  E.applyFreeRule(st);
  st.players = (playersDoc && playersDoc.list) || st.players;
  st.fromCloud = true;
  st.playerGW = {};
  const keep = st.fixtures.filter(f => !rounds[f.gw]);
  const merged = keep.slice();
  Object.keys(rounds).sort((a, b) => a - b).forEach(gw => {
    (rounds[gw].fixtures || []).forEach(f => merged.push(f));
    const pg = rounds[gw].playerGW || {};
    for(const pid in pg){ st.playerGW[pid] = st.playerGW[pid] || {}; st.playerGW[pid][gw] = pg[pid]; }
  });
  merged.sort((a, b) => (a.gw - b.gw) || String(a.date || '').localeCompare(String(b.date || '')));
  st.fixtures = merged;
  E.normalizeFixtures(st);
  try{ E.DB.applyForcedStatus(); }catch(e){}
  st.teams = {}; st.users = []; st.session = null;
  return st;
}

module.exports = { makeEngine, buildState, engineDir };
