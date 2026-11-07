/* إرسال إشعار لكل المشتركين في موضوع «all».

   محميّة: لا تقبل إلا رمز هوية Firebase صالحاً لمالك المشروع أو
   لمحرّر مفعّل في seasons/staff — وهو عين شرط firestore.rules.
   بدون ذلك يستطيع أي أحد إغراق كل مستخدمي الموقع بإشعارات.
   ========================================================= */
'use strict';
const { serviceAccount, accessToken, verifyIdToken } = require('./lib/google');
const { FAMS, condition } = require('./lib/topics');

const OWNER_UID = 'iiTgVfDryXNLb9IrOyLkkNMHDxq2';

const CORS = {
  'Access-Control-Allow-Origin': 'https://mfsoccer.com',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8'
};
const reply = (code, obj) => ({ statusCode:code, headers:CORS, body: JSON.stringify(obj) });

/* هل هذا الـuid من فريق العمل؟ نقرأ المستند نفسه الذي تقرأه اللعبة */
/* نتيجة التحقق تُحفظ 10 دقائق في النسخة الدافئة: كل إشعار كان يقرأ مستند الفريق قبل الإرسال */
const STAFF_OK = new Map();
async function isStaffCached(uid, projectId, at){
  const c = STAFF_OK.get(uid); if(c && Date.now() - c < 600000) return true;
  const ok = await isStaff(uid, projectId, at); if(ok) STAFF_OK.set(uid, Date.now()); return ok;
}
async function isStaff(uid, projectId, at){
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/seasons/staff`;
  const r = await fetch(url, { headers:{ Authorization:'Bearer '+at } });
  if(!r.ok) return false;
  const d = await r.json();
  const members = d.fields && d.fields.members && d.fields.members.mapValue && d.fields.members.mapValue.fields;
  const me = members && members[uid] && members[uid].mapValue && members[uid].mapValue.fields;
  if(!me) return false;
  return me.role && me.role.stringValue === 'editor' && me.active && me.active.booleanValue === true;
}

exports.handler = async (event) => {
  const T_IN = Date.now();
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:CORS, body:'' };
  if(event.httpMethod !== 'POST') return reply(405, {ok:false, err:'POST فقط'});

  let title, body, url, token, ev, legacy, t0, t1, q;
  try{ ({ title, body, url, token, ev, legacy, t0, t1, q } = JSON.parse(event.body||'{}')); }
  catch(e){ return reply(400, {ok:false, err:'جسم غير صالح'}); }

  title = String(title||'').trim();
  body  = String(body||'').trim();
  if(!title) return reply(400, {ok:false, err:'العنوان مطلوب'});
  if(title.length > 80)  return reply(400, {ok:false, err:'العنوان أطول من 80 حرفاً'});
  if(body.length  > 240) return reply(400, {ok:false, err:'النص أطول من 240 حرفاً'});

  /* لا نفتح الباب لأي رابط: الإشعار يقود إلى موقعنا وحده */
  let link = 'https://mfsoccer.com/';
  if(url){
    try{ const u = new URL(url, 'https://mfsoccer.com/'); if(u.origin==='https://mfsoccer.com') link = u.href; }
    catch(e){ /* رابط تالف — نُبقي الافتراضي */ }
  }

  const auth = event.headers.authorization || event.headers.Authorization || '';
  const idToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if(!idToken) return reply(401, {ok:false, err:'غير مصرّح'});

  try{
    const sa = serviceAccount();
    const projectId = sa.project_id;
    const uid = await verifyIdToken(idToken, projectId);
    const at  = await accessToken('https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore');

    if(uid !== OWNER_UID && !(await isStaffCached(uid, projectId, at)))
      return reply(403, {ok:false, err:'للمدير فقط'});

    /* الإرسال لرمز بعينه للتشخيص — للمالك وحده، لا تعرضه الواجهة */
    if(token && (typeof token !== 'string' || token.length < 100 || uid !== OWNER_UID))
      return reply(400, {ok:false, err:'رمز غير مقبول'});

    /* الهدف: حدث مباراة ← شرط مواضيع التفضيلات (+ «all» للأجهزة القديمة إن كان الحدث مما كان يصلها)،
       وبلا حدث (إعلان المدير) ← الأجهزة القديمة ومن اختار «أخبار وإعلانات» (منصور 2026-11-03) */
    let targets;
    if(token) targets = [{ token }];
    else if(ev && typeof ev === 'object'){
      if(!FAMS.has(ev.d)) return reply(400, {ok:false, err:'حدث غير معروف'});
      const e = { d:ev.d, comp:String(ev.comp||'').slice(0,60), home:String(ev.home||'').slice(0,60), away:String(ev.away||'').slice(0,60), side:String(ev.side||'').slice(0,60) };
      targets = [{ condition: condition(e) }];
      if(legacy) targets.push({ topic:'all' });
    }
    else targets = [{ condition: "'all' in topics || 'gen' in topics" }];
    const data = { ev: (ev && ev.d) || 'gen', url: link };

    /* الأهداف معاً بالتوازي (شرط التفضيلات + all القديم) */
    const outs = await Promise.all(targets.map(async t => {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method:'POST',
        headers:{ Authorization:'Bearer '+at, 'Content-Type':'application/json' },
        /* الحمولة كما ثبت وصولها: notification + رابط الفتح، ومعها data (نوع الحدث والرابط)
           ليختار خادم الخدمة الصوت ويفتح صفحة المباراة */
        body: JSON.stringify({ message: Object.assign(t,
          { notification:{ title, body }, data,
            /* صوت واهتزاز (منصور 2026-11-04: «ليش ما في اهتزاز»): APNs بلا aps.sound يصل الآيفون صامتاً بلا اهتزاز */
            apns:{ headers:{ 'apns-priority':'10' }, payload:{ aps:{ sound:'default' } } },
            android:{ priority:'HIGH', notification:{ sound:'default', default_vibrate_timings:true } },
            webpush:{ headers:{ Urgency:'high' }, fcm_options:{ link } } }
        )})
      });
      return { ok: res.ok, out: await res.json().catch(() => ({})) };
    }));
    /* سجل التوقيت (منصور 2026-11-07: الإشعار يتأخر 30–60 ث): متى فتح المحرّر الحدث (t0) ومتى أرسل جهازه (t1)
       ومتى وصل الخادم (tIn) ومتى ردّ FCM (tOut) — لمعرفة أين يضيع الوقت. مهلة قصيرة وأخطاؤه تُتجاهل */
    try{
      const tS = Date.now(), num = v => ({ integerValue: String(Math.round(+v||0)) });
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 2500);
      await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/pushlog`, {
        method:'POST', signal: ctl.signal, headers:{ Authorization:'Bearer '+at, 'Content-Type':'application/json' },
        body: JSON.stringify({ fields:{ at:{ timestampValue: new Date(tS).toISOString() }, title:{ stringValue: title }, ev:{ stringValue: (ev && ev.d) || 'gen' },
          t0: num(t0), t1: num(t1), tIn: num(T_IN), tOut: num(tS), quick:{ booleanValue: !!q }, ok:{ booleanValue: !outs.find(x => !x.ok) } } })
      }).catch(() => {});
      clearTimeout(tm);
    }catch(e){}
    const bad = outs.find(o => !o.ok);
    if(bad) return reply(502, {ok:false, err:'رفض FCM الإرسال', detail: JSON.stringify(bad.out).slice(0,300)});
    const ids = outs.map(o => o.out.name || '');
    return reply(200, {ok:true, id: ids[0] || '', ids});
  }catch(e){
    const m = String(e.message||e);
    /* رسائل التحقّق مفهومة للمستخدم؛ ما عداها خطأ خادم */
    const authErr = /صالح|صلاحية|مطابق|هوية/.test(m);
    return reply(authErr ? 401 : 500, {ok:false, err:m});
  }
};
