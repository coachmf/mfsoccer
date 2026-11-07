/* قراءة سجل توقيت الإشعارات (pushlog) وسجل الأجهزة (pushreg) — للمالك فقط، للتشخيص (منصور 2026-11-07: «الاشعارات وايد قاعد تتاخر»).
   GET بترويسة Authorization: Bearer <رمز Firebase>. */
'use strict';
const { serviceAccount, accessToken, verifyIdToken } = require('./lib/google');
const REG = require('./lib/reg');
const OWNER_UID = 'iiTgVfDryXNLb9IrOyLkkNMHDxq2';
const CORS = { 'Access-Control-Allow-Origin':'https://mfsoccer.com', 'Access-Control-Allow-Headers':'Authorization', 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' };

exports.handler = async (event) => {
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:CORS, body:'' };
  const auth = event.headers.authorization || event.headers.Authorization || '';
  try{
    const pid = serviceAccount().project_id;
    const uid = await verifyIdToken(auth.replace(/^Bearer /, ''), pid);
    const at = await accessToken('https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging');
    /* المالك أو عضو فعّال في فريق العمل (seasons/staff) */
    if(uid !== OWNER_UID){
      const sr = await fetch(`https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents/seasons/staff`, { headers:{ Authorization:'Bearer '+at } });
      const d = sr.ok ? await sr.json() : {}; const mem = d.fields && d.fields.members && d.fields.members.mapValue && d.fields.members.mapValue.fields;
      const me = mem && mem[uid] && mem[uid].mapValue && mem[uid].mapValue.fields;
      if(!(me && me.active && me.active.booleanValue === true)) return { statusCode:403, headers:CORS, body: JSON.stringify({ok:false, uid}) };
    }
    /* ?import=1: نقل أجهزة الحسابات المعروفة (pushprefs/{uid}.tokens + مواضيعها) إلى سجل الإرسال المباشر وإخراجها من المواضيع */
    if((event.queryStringParameters||{}).import === '1'){
      let page = '', moved = 0, seen = 0;
      do{
        const lr = await fetch(`https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents/pushprefs?pageSize=300${page ? '&pageToken='+page : ''}`, { headers:{ Authorization:'Bearer '+at } });
        const lj = await lr.json(); page = lj.nextPageToken || '';
        for(const d of (lj.documents||[])){
          const f = d.fields || {}, arr = k => ((f[k] && f[k].arrayValue && f[k].arrayValue.values) || []).map(v => v.stringValue).filter(Boolean);
          const topics = arr('topics'); for(const t of arr('tokens')){ seen++;
            if(!REG.okTok(t) || !topics.length) continue;
            if(await REG.get(at, pid, t)) continue;
            if(await REG.put(at, pid, t, topics, true)){ moved++; await REG.leaveAllTopics(at, t); } }
        }
      }while(page);
      return { statusCode:200, headers:CORS, body: JSON.stringify({ ok:true, seen, moved }) };
    }
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents:runQuery`, { method:'POST',
      headers:{ Authorization:'Bearer '+at, 'Content-Type':'application/json' },
      body: JSON.stringify({ structuredQuery:{ from:[{ collectionId:'pushlog' }], where:{ fieldFilter:{ field:{ fieldPath:'t1' }, op:'GREATER_THAN', value:{ integerValue:'0' } } }, orderBy:[{ field:{ fieldPath:'t1' }, direction:'DESCENDING' }], limit:30 } }) });
    const rows = (await r.json()).filter(x => x.document).map(x => { const f = x.document.fields, n = k => +(f[k] && f[k].integerValue || 0);
      return { title: f.title && f.title.stringValue, quick: !!(f.quick && f.quick.booleanValue), openToSend: n('t0') ? n('t1') - n('t0') : null,
        netToServer: n('tIn') - n('t1'), serverToFcm: n('tOut') - n('tIn'), directDone: n('tDir') - n('tIn'), dN: n('dN'), dOk: n('dOk'), at: f.at && f.at.timestampValue }; });
    const reg = await REG.all(at, pid);
    return { statusCode:200, headers:CORS, body: JSON.stringify({ ok:true, devices: reg.length, appDevices: reg.filter(d => d.x).length, rows }) };
  }catch(e){ return { statusCode:500, headers:CORS, body: JSON.stringify({ok:false, err:String(e.message||e)}) }; }
};
