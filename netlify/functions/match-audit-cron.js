/* فحص تلقائي بعد المباريات (منصور 2026-11-07: «كل جوله قاعده تصير مشاكل ليش… سو كل شي راح يحسن الاداء»).
   كل 10 دقائق بحساب الخدمة، لمباريات الدوري في الجولة الحالية والسابقة خلال آخر يومين:
   - بدأت (بعد الانطلاق بربع ساعة) وتشكيلة أحد الفريقين أقل من 11 في الموقع ← «التشكيلة ناقصة»
   - انتهت في الموقع ولم تصل الفانتسي على الخادم (غير منتهية أو النتيجة مختلفة) بعد 20 دقيقة ← «لم تُنشر في الفانتسي»
   - انتهت منذ ساعتين ونصف وبلا 3 بونص في الفانتسي ← «بلا بونص»
   يرسل إشعاراً لأجهزة الإدارة (المالك + أعضاء فريق العمل بصلاحية «مدير») من pushprefs، مرة واحدة لكل مشكلة (pushlog/audit). */
'use strict';
const { accessToken } = require('./lib/google');

const PROJECT = 'mfsoccer-c7ee4', SEASON = '2026-2027';
const OWNER_UID = 'iiTgVfDryXNLb9IrOyLkkNMHDxq2';
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const LIVE = ['h1','ht','h2','e1','e2','pso','ft'];

function val(v){
  if(!v || typeof v !== 'object') return null;
  if('stringValue' in v) return v.stringValue; if('integerValue' in v) return Number(v.integerValue);
  if('doubleValue' in v) return Number(v.doubleValue); if('booleanValue' in v) return v.booleanValue;
  if('timestampValue' in v) return v.timestampValue; if('nullValue' in v) return null;
  if('arrayValue' in v) return (v.arrayValue.values || []).map(val);
  if('mapValue' in v){ const o = {}; const f = v.mapValue.fields || {}; for(const k in f) o[k] = val(f[k]); return o; }
  return null;
}
/* موعد المباراة بتوقيت الكويت (+03:00) */
const kickOf = m => { const d = String(m.date||''), t = /^\d{1,2}:\d{2}$/.test(m.time||'') ? m.time.padStart(5,'0') : '00:00';
  const ms = Date.parse(`${d}T${t}:00+03:00`); return isNaN(ms) ? null : ms; };

async function run(){
  const at = await accessToken('https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging');
  const H = { Authorization:'Bearer ' + at };
  const get = async (p, mask) => { const q = (mask||[]).map(f => 'mask.fieldPaths=' + f).join('&');
    const r = await fetch(`${DOCS}/${p}${q ? '?' + q : ''}`, { headers:H }); if(r.status === 404) return null;
    if(!r.ok) throw new Error(p + ' ' + r.status); const d = await r.json(); const o = {}; for(const k in (d.fields||{})) o[k] = val(d.fields[k]); return o; };

  const root = await get(`fantasy/${SEASON}`, ['currentGW','clubs']);
  const cur = root && Number(root.currentGW); if(!cur) return { ok:true, skip:'no-root' };
  /* الأسماء قد تختلف إملائياً بين الموقع والفانتسي («الصليبخات» / «الصليبيخات») — نقارن بعد التطبيع */
  const nz = x => String(x||'').replace(/[ىيئ]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/\s+/g,'');
  const ids = {}; (root.clubs||[]).forEach(c => { if(c && c.id){ ids[nz(c.name)] = c.id; if(c.short) ids[nz(c.short)] = c.id; } });
  const idOf = new Proxy({}, { get:(_, k) => ids[nz(k)] });
  const site = await get(`seasons/${SEASON}`, ['matches','lineups']);
  if(!site) return { ok:true, skip:'no-season' };
  const now = Date.now(), issues = [];
  const rounds = {};
  for(const gw of [cur - 1, cur]){ if(gw < 1) continue; const r = await get(`fantasy/${SEASON}/rounds/${gw}`, ['fixtures']); rounds[gw] = (r && r.fixtures) || []; }
  const lu = site.lineups || [];
  for(const m of (site.matches || [])){
    if(m.comp && m.comp !== 'الدوري') continue;
    const k = kickOf(m); if(!k || now - k > 2*864e5 || now < k) continue;
    const st = String(m.status||''), name = `${m.home} × ${m.away}`;
    /* التشكيلة */
    if(LIVE.indexOf(st) >= 0 && now - k > 15*60e3){
      const n = c => lu.filter(l => l && Number(l.r) === Number(m.round) && l.club === c && (!l.comp || l.comp === 'الدوري')).length;
      if(n(m.home) < 11 || n(m.away) < 11) issues.push({ sig:`xi|${m.round}|${name}`, t:`${name}: التشكيلة ناقصة في الموقع` });
    }
    if(st !== 'ft') continue;
    const h = idOf[m.home], a = idOf[m.away]; if(!h || !a) continue;
    const fx = (rounds[cur] || []).concat(rounds[cur-1] || []).find(f => (f.h === h && f.a === a) || (f.h === a && f.a === h));
    const ftAge = now - k - 105*60e3;   /* تقريباً منذ صافرة النهاية */
    const same = fx && fx.over && ((fx.h === h && Number(fx.hs) === Number(m.hg) && Number(fx.as) === Number(m.ag)) || (fx.h === a && Number(fx.hs) === Number(m.ag) && Number(fx.as) === Number(m.hg)));
    if(!same && ftAge > 20*60e3) issues.push({ sig:`sync|${m.round}|${name}|${m.hg}-${m.ag}`, t:`${name}: النتيجة لم تُنشر في الفانتسي — افتح الفانتسي كمدير` });
    else if(same && ((fx.bonus||[]).filter(b => b && b.name).length < 3) && ftAge > 150*60e3) issues.push({ sig:`bonus|${m.round}|${name}`, t:`${name}: بلا بونص في الفانتسي` });
  }
  if(!issues.length) return { ok:true, issues:0 };

  const log = await get('pushlog/audit'); const seen = (log && log.sent) || [];
  const fresh = issues.filter(i => seen.indexOf(i.sig) < 0);
  if(!fresh.length) return { ok:true, issues:issues.length, fresh:0 };

  /* أجهزة الإدارة: المالك + فريق العمل بصلاحية مدير */
  const staff = await get('seasons/staff'); const mem = (staff && staff.members) || {};
  const uids = [OWNER_UID].concat(Object.keys(mem).filter(u => mem[u] && mem[u].active !== false && mem[u].perm !== 'matches'));
  const tokens = new Set();
  for(const u of [...new Set(uids)]){ const p = await get(`pushprefs/${u}`, ['tokens']).catch(() => null); ((p && p.tokens) || []).forEach(t => t && tokens.add(t)); }
  const body = fresh.map(i => '• ' + i.t).join('\n').slice(0, 230);
  let sent = 0;
  await Promise.all([...tokens].map(async token => {
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${PROJECT}/messages:send`, { method:'POST', headers:{ ...H, 'Content-Type':'application/json' },
      body: JSON.stringify({ message:{ token, notification:{ title:'تنبيه للإدارة: مباريات تحتاج متابعة', body }, data:{ ev:'gen', url:'https://mfsoccer.com/fantasy/' },
        apns:{ headers:{ 'apns-priority':'10', 'apns-push-type':'alert' }, payload:{ aps:{ sound:'default' } } },
        webpush:{ headers:{ Urgency:'high' }, fcm_options:{ link:'https://mfsoccer.com/fantasy/' } } } }) }).catch(() => null);
    if(r && r.ok) sent++;
  }));
  if(sent || !tokens.size){
    const all = seen.concat(fresh.map(i => i.sig)).slice(-300);
    await fetch(`${DOCS}/pushlog/audit`, { method:'PATCH', headers:{ ...H, 'Content-Type':'application/json' },
      body: JSON.stringify({ fields:{ sent:{ arrayValue:{ values: all.map(s => ({ stringValue:s })) } }, last:{ arrayValue:{ values: fresh.map(i => ({ stringValue:i.t })) } }, updated:{ stringValue:new Date().toISOString() } } }) });
  }
  return { ok:true, issues:issues.length, fresh:fresh.length, tokens:tokens.size, sent };
}

exports.handler = async () => {
  try{ const r = await run(); console.log('match-audit', JSON.stringify(r)); return { statusCode:200, body:JSON.stringify(r) }; }
  catch(e){ console.error('match-audit failed', e); return { statusCode:500, body:String(e.message || e) }; }
};
exports._run = run;
