/* اشتراك جهاز في موضوع «all» — يناديها المتصفح عند تفعيل المفتاح.
   الاشتراك في المواضيع لا يمكن من العميل: يتطلّب صلاحية الخادم.
   مفتوحة بلا مصادقة عمداً — الزوّار بلا حساب لهم حقّ الإشعارات،
   والضرر الأقصى أن يشترك أحدهم بجهازه هو. */
'use strict';
const { accessToken } = require('./lib/google');

const CORS = {
  'Access-Control-Allow-Origin': 'https://mfsoccer.com',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8'
};

exports.handler = async (event) => {
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:CORS, body:'' };
  if(event.httpMethod !== 'POST')
    return { statusCode:405, headers:CORS, body: JSON.stringify({ok:false, err:'POST فقط'}) };

  let token, unsubscribe, info;
  try{ ({ token, unsubscribe, info } = JSON.parse(event.body||'{}')); }
  catch(e){ return { statusCode:400, headers:CORS, body: JSON.stringify({ok:false, err:'جسم غير صالح'}) }; }

  /* رموز FCM طويلة ومحدودة الأحرف — نرفض ما لا يشبهها قبل أي نداء */
  if(typeof token !== 'string' || token.length < 100 || token.length > 4096 || /[^\w:.\-]/.test(token))
    return { statusCode:400, headers:CORS, body: JSON.stringify({ok:false, err:'رمز جهاز غير صالح'}) };

  try{
    const at = await accessToken('https://www.googleapis.com/auth/firebase.messaging');

    /* تشخيص: يقرأ عضوية الرمز من FCM نفسه — الطريق الوحيد للتأكد
       أن الاشتراك ثبت فعلاً بدل الاكتفاء بنجاح نداء الاشتراك. */
    if(info){
      const r = await fetch(`https://iid.googleapis.com/iid/info/${encodeURIComponent(token)}?details=true`, {
        headers:{ Authorization:'Bearer '+at, access_token_auth:'true' }
      });
      const t = await r.text();
      return { statusCode: r.ok?200:502, headers:CORS, body: JSON.stringify({ok:r.ok, info:t.slice(0,1200)}) };
    }

    const res = await fetch(`https://iid.googleapis.com/iid/v1/${encodeURIComponent(token)}/rel/topics/all`, {
      method: unsubscribe ? 'DELETE' : 'POST',
      headers: { Authorization:'Bearer '+at, access_token_auth:'true', 'Content-Type':'application/json' }
    });
    if(!res.ok){
      const t = await res.text();
      return { statusCode:502, headers:CORS, body: JSON.stringify({ok:false, err:'رفض FCM الاشتراك', detail:t.slice(0,300)}) };
    }
    return { statusCode:200, headers:CORS, body: JSON.stringify({ok:true}) };
  }catch(e){
    return { statusCode:500, headers:CORS, body: JSON.stringify({ok:false, err:String(e.message||e)}) };
  }
};
