/* =========================================================
   أدوات مشتركة للدوال: رمز وصول من حساب الخدمة، والتحقّق من
   هوية المستخدم عبر رمز Firebase.

   لا نستعمل firebase-admin: حزمة ثقيلة تُبطئ الإقلاع البارد،
   وكل ما نحتاجه توقيع JWT والتحقّق منه — وكلاهما في node:crypto.
   ========================================================= */
'use strict';
const crypto = require('crypto');

const b64url = buf => Buffer.from(buf).toString('base64')
  .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');

function serviceAccount(){
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if(!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT غير مضبوط');
  const sa = JSON.parse(raw);
  /* بعض الواجهات تحوّل أسطر المفتاح إلى \n نصية فيفشل التوقيع بلا رسالة مفهومة */
  if(sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  return sa;
}

/* رمز وصول قصير العمر. نحتفظ به بين الاستدعاءات الساخنة فلا
   نُرهق خادم OAuth بطلب لكل إشعار. */
let cached = { token:null, exp:0 };
async function accessToken(scope){
  const now = Math.floor(Date.now()/1000);
  if(cached.token && cached.exp - 60 > now) return cached.token;

  const sa = serviceAccount();
  const header = b64url(JSON.stringify({alg:'RS256', typ:'JWT'}));
  const claim  = b64url(JSON.stringify({
    iss: sa.client_email, scope, aud:'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600
  }));
  const sig = b64url(crypto.sign('RSA-SHA256', Buffer.from(header+'.'+claim), sa.private_key));

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: header+'.'+claim+'.'+sig
    })
  });
  const j = await res.json();
  if(!res.ok || !j.access_token) throw new Error('تعذّر الحصول على رمز وصول: '+JSON.stringify(j));
  cached = { token: j.access_token, exp: now + (j.expires_in||3600) };
  return cached.token;
}

/* شهادات Google العامة للتحقّق من رموز Firebase — تتغيّر كل بضع ساعات */
let certs = { at:0, map:null };
async function publicCerts(){
  if(certs.map && Date.now() - certs.at < 3600000) return certs.map;
  const r = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
  const m = await r.json();
  certs = { at: Date.now(), map: m };
  return m;
}

/* يتحقّق من رمز الهوية ويعيد uid، أو يرمي. التحقّق كامل: التوقيع
   والمُصدِر والجمهور والصلاحية — فلا يكفي فكّ الترميز. */
async function verifyIdToken(idToken, projectId){
  const parts = String(idToken||'').split('.');
  if(parts.length !== 3) throw new Error('رمز غير صالح');
  const head = JSON.parse(Buffer.from(parts[0],'base64url').toString());
  const body = JSON.parse(Buffer.from(parts[1],'base64url').toString());

  const cert = (await publicCerts())[head.kid];
  if(!cert) throw new Error('مفتاح توقيع غير معروف');

  const ok = crypto.verify('RSA-SHA256', Buffer.from(parts[0]+'.'+parts[1]),
    crypto.createPublicKey(cert), Buffer.from(parts[2],'base64url'));
  if(!ok) throw new Error('توقيع غير صالح');

  const now = Math.floor(Date.now()/1000);
  if(body.aud !== projectId) throw new Error('جمهور غير مطابق');
  if(body.iss !== 'https://securetoken.google.com/'+projectId) throw new Error('مُصدِر غير مطابق');
  if(!body.exp || body.exp < now) throw new Error('انتهت صلاحية الجلسة — سجّل الدخول من جديد');
  if(!body.sub) throw new Error('رمز بلا هوية');
  return body.sub;
}

module.exports = { serviceAccount, accessToken, verifyIdToken };
