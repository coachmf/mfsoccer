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
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:CORS, body:'' };
  if(event.httpMethod !== 'POST') return reply(405, {ok:false, err:'POST فقط'});

  let title, body, url, token, ev, legacy;
  try{ ({ title, body, url, token, ev, legacy } = JSON.parse(event.body||'{}')); }
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

    if(uid !== OWNER_UID && !(await isStaff(uid, projectId, at)))
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

    const ids = [];
    for(const t of targets){
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method:'POST',
        headers:{ Authorization:'Bearer '+at, 'Content-Type':'application/json' },
        /* الحمولة كما ثبت وصولها: notification + رابط الفتح، ومعها data (نوع الحدث والرابط)
           ليختار خادم الخدمة الصوت ويفتح صفحة المباراة */
        body: JSON.stringify({ message: Object.assign(t,
          { notification:{ title, body }, data, webpush:{ fcm_options:{ link } } }
        )})
      });
      const out = await res.json();
      if(!res.ok) return reply(502, {ok:false, err:'رفض FCM الإرسال', detail: JSON.stringify(out).slice(0,300)});
      ids.push(out.name || '');
    }
    return reply(200, {ok:true, id: ids[0] || '', ids});
  }catch(e){
    const m = String(e.message||e);
    /* رسائل التحقّق مفهومة للمستخدم؛ ما عداها خطأ خادم */
    const authErr = /صالح|صلاحية|مطابق|هوية/.test(m);
    return reply(authErr ? 401 : 500, {ok:false, err:m});
  }
};
