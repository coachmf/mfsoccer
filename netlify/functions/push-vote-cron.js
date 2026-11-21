/* إشعارات التصويت (منصور 2026-11-21): «بعد انتهاء المباراة بدقيقتين: صوّت لأفضل لاعب بالمباراة، وبعد نهاية جولة الدوري بساعة:
   صوّت لأفضل تشكيلة الجولة».
   كل دقيقة بحساب الخدمة: يقرأ مباريات وثيقة الموسم (الدوري والكؤوس). المباراة لا تحفظ وقت نهايتها، فأول مرة نراها «انتهت» (status ft)
   نسجّل الوقت في pushlog/vote، وبعد دقيقتين نرسل «صوّت لأفضل لاعب» (التصويت يفتح بعد الصافرة — motmOpen في الصفحة).
   جولة الدوري (من الجولة 3 كما VOTE_FROM_ROUND): حين تنتهي كل مبارياتها المجدولة (المؤجلة لما بعد 7 أيام لا تمنع — roundPlayed)
   وبعد ساعة من نهاية آخرها → «صوّت لتشكيلة الجولة» مع رابط #fans.
   المستلمون: تصويت المباراة = من يتابع صافرة النهاية لهذه المباراة (موضوع ft) + الأجهزة القديمة + أجهزة اللوحة غير المخصّصة لـft؛
   تصويت الجولة = الجميع. أول تشغيل يعتبر كل ما انتهى سابقاً مُرسلاً (لا سيل إشعارات قديمة). منع التكرار ببصمات في pushlog/vote. */
'use strict';
const { accessToken } = require('./lib/google');
const { condition } = require('./lib/topics');
const REG = require('./lib/reg');

const PROJECT = 'mfsoccer-c7ee4';
const SEASON = '2026-2027';
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const MOTM_AFTER = 2 * 60e3, ROUND_AFTER = 60 * 60e3, VOTE_FROM_ROUND = 3;
const DRY = process.env.PUSH_VOTE_DRY === '1';

function val(v){
  if(!v || typeof v !== 'object') return null;
  if('stringValue'  in v) return v.stringValue;
  if('integerValue' in v) return Number(v.integerValue);
  if('doubleValue'  in v) return Number(v.doubleValue);
  if('booleanValue' in v) return v.booleanValue;
  if('timestampValue' in v) return v.timestampValue;
  if('nullValue'    in v) return null;
  if('arrayValue'   in v) return (v.arrayValue.values || []).map(val);
  if('mapValue'     in v){ const o = {}; const f = v.mapValue.fields || {}; for(const k in f) o[k] = val(f[k]); return o; }
  return null;
}
function normTime(t){
  if(!t) return null;
  const x = String(t).trim().replace(/[٠-٩]/g, d=>String.fromCharCode(d.charCodeAt(0)-0x0660+48));
  const pm = /(م|مساء|p\.?m\.?)/i.test(x), am = /(ص|صباح|a\.?m\.?)/i.test(x);
  const mt = x.match(/(\d{1,2})\s*[:.]\s*(\d{2})/); if(!mt) return null;
  let h = +mt[1]; const mi = +mt[2]; if(h>23 || mi>59) return null;
  if(pm && h<12) h += 12; if(am && h===12) h = 0;
  return String(h).padStart(2,'0')+':'+String(mi).padStart(2,'0');
}
const kickoff = m => { const t = m && normTime(m.time); if(!t || !/^\d{4}-\d{2}-\d{2}$/.test(m.date||'')) return NaN; return Date.parse(`${m.date}T${t}:00+03:00`); };
const compOf = m => m.comp || 'الدوري';
const isFt = m => m && m.status === 'ft';
const sigM = m => ['m', compOf(m), m.round, m.home, m.away, m.date].join('|');
const sigR = (r, comp) => ['r', comp, r].join('|');
const matchKey = m => [compOf(m), m.round, m.home, m.away].map(v => encodeURIComponent(String(v))).join('/');

/* مثل roundPlayed في index.html: مباريات الجولة المجدولة كلها انتهت، والمؤجلة (بعد آخر مباراة بأكثر من 7 أيام) أو بلا موعد لا تمنع */
function roundDone(ms){
  const dated = ms.filter(m => isFinite(kickoff(m)));
  const done = dated.filter(isFt); if(!done.length) return null;
  const last = Math.max(...done.map(kickoff));
  const pending = dated.filter(m => !isFt(m) && kickoff(m) - last <= 7 * 864e5);
  return pending.length ? null : done;
}

async function run(){
  const at = await accessToken('https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging');
  const H = { Authorization:'Bearer ' + at };
  const read = async p => { const r = await fetch(`${DOCS}/${p}`, { headers:H }); if(r.status === 404) return null;
    if(!r.ok) throw new Error(p + ' ' + r.status); const f = (await r.json()).fields || {}; const o = {}; for(const k in f) o[k] = val(f[k]); return o; };

  const season = await read(`seasons/${SEASON}?mask.fieldPaths=matches`);
  const matches = ((season && season.matches) || []).filter(m => m && m.home && m.away);
  const log = await read('pushlog/vote').catch(() => null);
  const first = !log;
  const seenArr = (log && log.seen) || [];            /* "sig@ms" وقت أول رؤية «انتهت» */
  const sent = new Set((log && log.sent) || []);
  const seen = new Map(seenArr.map(s => { const i = s.lastIndexOf('@'); return [s.slice(0, i), +s.slice(i + 1)]; }));
  const now = Date.now();
  let changed = false;

  /* 1) تسجيل أول رؤية لكل مباراة انتهت (المباريات الحديثة فقط) */
  for(const m of matches){
    if(!isFt(m)) continue;
    const k = kickoff(m); if(!isFinite(k) || now - k > 30 * 3600e3) continue;
    const s = sigM(m);
    if(!seen.has(s)){ seen.set(s, now); changed = true; if(first){ sent.add(s); } }
  }
  /* 2) الجولات المكتملة */
  const rounds = new Map();
  matches.filter(m => compOf(m) === 'الدوري' && +m.round >= VOTE_FROM_ROUND).forEach(m => { const k = +m.round; (rounds.get(k) || rounds.set(k, []).get(k)).push(m); });

  const out = { motm:[], round:[] };
  const send = async (conds, title, body, url, ev) => {
    if(DRY){ console.log('DRY', ev, title, '|', body, '|', url, '|', conds.join(' ;; ')); return true; }
    let okAny = false;
    for(const cond of conds){
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${PROJECT}/messages:send`, { method:'POST', headers:{ ...H, 'Content-Type':'application/json' },
        body: JSON.stringify({ message:{ condition: cond, notification:{ title, body }, data:{ ev, url },
          apns:{ headers:{ 'apns-priority':'10', 'apns-push-type':'alert', 'apns-expiration':String(Math.floor(Date.now()/1000)+3600) }, payload:{ aps:{ sound:'default' } } },
          android:{ priority:'HIGH', notification:{ sound:'default' } }, webpush:{ fcm_options:{ link:url } } } }) });
      if(r.ok) okAny = true; else console.error('vote send', r.status, cond, (await r.text()).slice(0, 200));
    }
    try{ const dr = await REG.sendDirect(at, PROJECT, conds.map(condition => ({ condition })), { notification:{ title, body }, data:{ ev, url },
        apns:{ headers:{ 'apns-priority':'10', 'apns-push-type':'alert', 'apns-expiration':String(Math.floor(Date.now()/1000)+3600) }, payload:{ aps:{ sound:'default' } } } }, x => x.x);
      if(dr.ok) okAny = true; }catch(e){ console.error('vote direct', e && e.message); }
    return okAny;
  };

  for(const [s, t] of seen){
    if(sent.has(s) || now - t < MOTM_AFTER) continue;
    const m = matches.find(x => sigM(x) === s && isFt(x)); if(!m){ sent.add(s); changed = true; continue; }   /* أُعيد فتحها أو حُذفت */
    if(now - t > 3 * 3600e3){ sent.add(s); changed = true; continue; }   /* فاتنا التوقيت (توقف الخادم) — لا إشعار متأخر */
    const ev = { d:'ft', comp: compOf(m), home: m.home, away: m.away };
    const conds = [condition(ev) + " || 'all' in topics", "'gen' in topics && !('ft_a' in topics)"];
    const sc = (m.hg != null && m.ag != null && m.hg !== '' && m.ag !== '') ? ` ${m.hg}-${m.ag} ` : ' × ';
    const ok = await send(conds, 'صوّت لأفضل لاعب في المباراة', `${m.home}${sc}${m.away} — اختر رجل المباراة`, 'https://mfsoccer.com/#m/' + matchKey(m), 'mv');
    if(ok){ sent.add(s); changed = true; out.motm.push(s); }
  }

  for(const [r, ms] of rounds){
    const s = sigR(r, 'الدوري'); if(sent.has(s)) continue;
    const done = roundDone(ms); if(!done) continue;
    const ends = done.map(m => seen.get(sigM(m)));
    if(ends.some(x => x == null)){ if(first || done.every(m => now - kickoff(m) > 30 * 3600e3)){ sent.add(s); changed = true; } continue; }   /* جولة قديمة */
    const end = Math.max(...ends);
    if(first){ sent.add(s); changed = true; continue; }
    if(now - end < ROUND_AFTER) continue;
    if(now - end > 6 * 3600e3){ sent.add(s); changed = true; continue; }
    const ok = await send(["'all' in topics || 'gen' in topics"], `صوّت لتشكيلة الجولة ${r}`, `انتهت الجولة ${r} من الدوري الكويتي — اختر تشكيلتك وأفضل لاعب وحارس وهدف الجولة`, 'https://mfsoccer.com/#fans', 'tv');
    if(ok){ sent.add(s); changed = true; out.round.push(s); }
  }

  if(changed && !DRY){
    const seenOut = [...seen].slice(-300).map(([s, t]) => s + '@' + t), sentOut = [...sent].slice(-400);
    const arr = a => ({ arrayValue:{ values: a.map(x => ({ stringValue:x })) } });
    await fetch(`${DOCS}/pushlog/vote`, { method:'PATCH', headers:{ ...H, 'Content-Type':'application/json' },
      body: JSON.stringify({ fields:{ seen: arr(seenOut), sent: arr(sentOut), updated:{ stringValue:new Date().toISOString() } } }) });
  }
  return { ok:true, first, matches:matches.length, seen:seen.size, motm:out.motm, round:out.round, dry:DRY };
}

exports.handler = async () => {
  try{ const r = await run(); console.log('push-vote', JSON.stringify(r)); return { statusCode:200, body:JSON.stringify(r) }; }
  catch(e){ console.error('push-vote failed', e); return { statusCode:500, body:String(e.message || e) }; }
};
exports._t = { roundDone, kickoff, sigM };
