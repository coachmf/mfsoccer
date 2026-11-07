/* تجربة سرعة الإشعار (منصور 2026-11-07: «ابي بسرعه ينزل نفسهم باللحظه»): يرسل إشعاراً واحداً مباشرة لرمز الجهاز الذي طلبه.
   بلا مصادقة عمداً — لا يصل إلا للجهاز صاحب الرمز (مثل push-subscribe). مهلة دقيقة لكل رمز حتى لا يُساء استعماله. */
'use strict';
const { serviceAccount, accessToken } = require('./lib/google');
const REG = require('./lib/reg');
const CORS = { 'Access-Control-Allow-Origin':'https://mfsoccer.com', 'Access-Control-Allow-Headers':'Content-Type', 'Access-Control-Allow-Methods':'POST, OPTIONS', 'Content-Type':'application/json; charset=utf-8' };
const LAST = new Map();

exports.handler = async (event) => {
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:CORS, body:'' };
  let token; try{ ({ token } = JSON.parse(event.body||'{}')); }catch(e){}
  if(!REG.okTok(token)) return { statusCode:400, headers:CORS, body: JSON.stringify({ok:false, err:'رمز جهاز غير صالح'}) };
  const k = token.slice(-32); if(Date.now() - (LAST.get(k)||0) < 60000) return { statusCode:429, headers:CORS, body: JSON.stringify({ok:false, err:'انتظر دقيقة بين التجارب'}) };
  LAST.set(k, Date.now());
  try{
    const pid = serviceAccount().project_id, at = await accessToken('https://www.googleapis.com/auth/firebase.messaging');
    const id = 'test' + Date.now().toString(36), sentAt = new Date();
    const hh = sentAt.toLocaleTimeString('en-GB', { timeZone:'Asia/Kuwait' });
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${pid}/messages:send`, { method:'POST',
      headers:{ Authorization:'Bearer '+at, 'Content-Type':'application/json' },
      body: JSON.stringify({ message:{ token, notification:{ title:'تجربة سرعة', body:'أُرسل الساعة ' + hh + ' — قارن بوقت الوصول' }, data:{ ev:'test', id, url:'https://mfsoccer.com/' },
        apns:{ headers:{ 'apns-priority':'10', 'apns-push-type':'alert', 'apns-expiration':String(Math.floor(Date.now()/1000)+900) }, payload:{ aps:{ sound:'default', 'interruption-level':'time-sensitive' } } },
        android:{ priority:'HIGH', notification:{ sound:'default' } }, webpush:{ headers:{ Urgency:'high', TTL:'600' } } } }) });
    const j = await r.json().catch(() => ({}));
    if(!r.ok) return { statusCode:502, headers:CORS, body: JSON.stringify({ok:false, err:'رفض FCM', detail: JSON.stringify(j).slice(0,300)}) };
    return { statusCode:200, headers:CORS, body: JSON.stringify({ ok:true, id, sentAt: sentAt.toISOString(), hh }) };
  }catch(e){ return { statusCode:500, headers:CORS, body: JSON.stringify({ok:false, err:String(e.message||e)}) }; }
};
