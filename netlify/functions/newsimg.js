/* صور الأخبار من CDN (news.js) — الصورة محفوظة في Firestore newsimg/{id} كـ dataURL
   (WebP مضغوطة في المتصفح). الصورة لا تتغيّر أبداً بعد رفعها (الاستبدال = معرّف جديد)،
   فتُخزَّن في المتصفح وفي CDN سنة كاملة: قراءة Firestore واحدة لكل صورة تقريباً مهما كثر الزوار.
   الاستخدام: /api/newsimg/<id> ، والمصغّرة /api/newsimg/<id>_t */
'use strict';
const { accessToken } = require('./lib/google');

const PROJECT = 'mfsoccer-c7ee4';
const API_KEY = 'AIzaSyD_ZzAE4HEKPIuAKCmta8tzN5KOa8IUfuo';   /* نفس المفتاح العام في index.html */
const ID = /^[a-z0-9]{8,24}(_t)?$/;

async function readDoc(id){
  const base = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/newsimg/${id}`;
  let r = await fetch(`${base}?key=${API_KEY}`);
  if(r.status === 429 || r.status === 403){
    try{
      const at = await accessToken('https://www.googleapis.com/auth/datastore');
      r = await fetch(base, { headers:{ Authorization:'Bearer '+at } });
    }catch(e){}
  }
  return r;
}

exports.handler = async (event) => {
  const id = String((event.path || '').split('/').pop() || '');
  const noStore = { 'Content-Type':'text/plain; charset=utf-8', 'Cache-Control':'no-store' };
  if(!ID.test(id)) return { statusCode:400, headers:noStore, body:'bad id' };
  try{
    const r = await readDoc(id);
    if(r.status === 404) return { statusCode:404, headers:{ ...noStore, 'Cache-Control':'public, max-age=60' }, body:'not found' };
    if(!r.ok) return { statusCode:502, headers:noStore, body:'upstream '+r.status };
    const f = (await r.json()).fields || {};
    const m = /^data:(image\/(?:webp|jpeg|png));base64,(.+)$/.exec((f.d && f.d.stringValue) || '');
    if(!m) return { statusCode:404, headers:noStore, body:'no image' };
    return {
      statusCode: 200,
      headers: {
        'Content-Type': m[1],
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Netlify-CDN-Cache-Control': 'public, durable, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
      isBase64Encoded: true,
      body: m[2],
    };
  }catch(e){
    return { statusCode:502, headers:noStore, body:String(e.message||e) };
  }
};
