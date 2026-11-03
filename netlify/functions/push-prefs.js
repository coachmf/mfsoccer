/* تفضيلات الإشعارات في حساب المستخدم (pushprefs/{uid}) — تبقى واحدة على كل أجهزته.
   GET  ← التفضيلات المحفوظة.
   POST {prefs, topics, token, prev} ← يحفظها، ويربط مواضيع كل أجهزة الحساب المعروفة بالقائمة الجديدة:
        الأجهزة السابقة بالفرق بين القائمتين، والجهاز الجديد بالقائمة كاملة مع خروجه من «all» القديم.
   الكتابة بحساب الخدمة (لا تحتاج تعديل firestore.rules)، والهوية من رمز Firebase المتحقَّق منه. */
'use strict';
const { serviceAccount, accessToken, verifyIdToken } = require('./lib/google');
const { TOPIC_RX } = require('./lib/topics');
const { applyTopics } = require('./lib/subs');

const CORS = {
  'Access-Control-Allow-Origin': 'https://mfsoccer.com',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};
const reply = (code, obj) => ({ statusCode:code, headers:CORS, body: JSON.stringify(obj) });
const okTok = t => typeof t === 'string' && t.length >= 100 && t.length <= 4096 && !/[^\w:.\-]/.test(t);

exports.handler = async (event) => {
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:CORS, body:'' };
  const auth = event.headers.authorization || event.headers.Authorization || '';
  const idToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if(!idToken) return reply(401, {ok:false, err:'سجّل الدخول لحفظ التفضيلات في حسابك'});
  try{
    const sa = serviceAccount(), projectId = sa.project_id;
    const uid = await verifyIdToken(idToken, projectId);
    if(!/^[\w-]{1,128}$/.test(uid)) return reply(400, {ok:false, err:'هوية غير صالحة'});
    const at = await accessToken('https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore');
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/pushprefs/${uid}`;
    const H = { Authorization:'Bearer '+at };

    const r0 = await fetch(url, { headers:H });
    let cur = { prefs:null, topics:[], tokens:[] };
    if(r0.ok){
      const f = (await r0.json()).fields || {};
      const arr = k => ((f[k] && f[k].arrayValue && f[k].arrayValue.values) || []).map(v => v.stringValue).filter(Boolean);
      try{ cur.prefs = f.prefs ? JSON.parse(f.prefs.stringValue) : null; }catch(e){}
      cur.topics = arr('topics'); cur.tokens = arr('tokens');
    }else if(r0.status !== 404) return reply(502, {ok:false, err:'تعذّرت قراءة التفضيلات'});

    if(event.httpMethod === 'GET') return reply(200, {ok:true, prefs:cur.prefs});
    if(event.httpMethod !== 'POST') return reply(405, {ok:false, err:'GET أو POST'});

    let body; try{ body = JSON.parse(event.body||'{}'); }catch(e){ return reply(400, {ok:false, err:'جسم غير صالح'}); }
    const sv = a => ({ arrayValue:{ values: a.map(s => ({ stringValue:s })) } });

    /* جهاز أوقف الإشعارات: يخرج من مواضيعه ومن قائمة أجهزة الحساب (التفضيلات تبقى) */
    if(okTok(body.drop)){
      const prev = (Array.isArray(body.prev) ? body.prev : []).filter(t => TOPIC_RX.test(t));
      const rem = [...new Set(cur.topics.concat(prev))];
      const r = rem.length ? await applyTopics(at, [body.drop], [], rem) : {ok:true};
      const left = cur.tokens.filter(t => t !== body.drop);
      await fetch(url + '?updateMask.fieldPaths=tokens', { method:'PATCH', headers:{ ...H, 'Content-Type':'application/json' },
        body: JSON.stringify({ fields:{ tokens:sv(left) } }) });
      return reply(r.ok ? 200 : 502, r);
    }

    const prefs = body.prefs && typeof body.prefs === 'object' ? body.prefs : null;
    const ps = prefs ? JSON.stringify(prefs) : '';
    if(!prefs || ps.length > 8000) return reply(400, {ok:false, err:'تفضيلات غير صالحة'});
    const want = (Array.isArray(body.topics) ? body.topics : []).filter(t => TOPIC_RX.test(t));
    const prev = (Array.isArray(body.prev) ? body.prev : []).filter(t => TOPIC_RX.test(t));

    /* الأجهزة: السابقة + هذا الجهاز (آخر 10) */
    const tok = okTok(body.token) ? body.token : '';
    const known = cur.tokens.filter(okTok);
    const isNew = tok && known.indexOf(tok) < 0;
    const tokens = (tok ? known.filter(t => t !== tok).concat(tok) : known).slice(-10);

    const results = [];
    const others = tokens.filter(t => t !== tok);
    if(others.length){
      const add = want.filter(t => cur.topics.indexOf(t) < 0), rem = cur.topics.filter(t => want.indexOf(t) < 0);
      if(add.length || rem.length) results.push(await applyTopics(at, others, add, rem));
    }
    if(tok){
      const base = isNew ? prev : cur.topics;
      const add = isNew ? want : want.filter(t => base.indexOf(t) < 0);
      const rem = base.filter(t => want.indexOf(t) < 0).concat(isNew ? ['all'] : []);
      if(add.length || rem.length) results.push(await applyTopics(at, [tok], add, rem));
    }
    const bad = results.find(x => !x.ok);

    /* القائمة تُحفظ حتى لو تعثّر جزء من الربط: الجهاز يعيد المحاولة عند الإقلاع التالي */
    const w = await fetch(url, { method:'PATCH', headers:{ ...H, 'Content-Type':'application/json' },
      body: JSON.stringify({ fields:{ prefs:{ stringValue:ps }, topics:sv(want), tokens:sv(tokens), updated:{ timestampValue:new Date().toISOString() } } }) });
    if(!w.ok) return reply(502, {ok:false, err:'تعذّر حفظ التفضيلات'});
    if(bad) return reply(502, {ok:false, err:bad.err, detail:bad.detail});
    return reply(200, {ok:true});
  }catch(e){
    const m = String(e.message||e);
    return reply(/صالح|صلاحية|مطابق|هوية|الجلسة/.test(m) ? 401 : 500, {ok:false, err:m});
  }
};
