/* إضافة/إزالة مواضيع FCM لرموز أجهزة — نداء واحد لكل موضوع (batchAdd/batchRemove يقبل حتى 1000 رمز)،
   بالتوازي على دفعات حتى لا تتجاوز الدالة مهلتها. 'all' مسموح في الإزالة فقط (خروج الجهاز من الموضوع القديم). */
'use strict';
const { TOPIC_RX } = require('./topics');
const MAX = 300, PAR = 16;

async function applyTopics(at, tokens, add, remove){
  const okT = t => typeof t === 'string' && TOPIC_RX.test(t);
  add = [...new Set(add)].filter(okT);
  remove = [...new Set(remove)].filter(t => t === 'all' || okT(t)).filter(t => add.indexOf(t) < 0);
  tokens = tokens.filter(t => typeof t === 'string' && t.length >= 100 && t.length <= 4096 && !/[^\w:.\-]/.test(t)).slice(0, 20);
  if(!tokens.length) return { ok:false, err:'رمز جهاز غير صالح' };
  if(add.length + remove.length > MAX) return { ok:false, err:'مواضيع أكثر من المسموح' };
  const jobs = add.map(t => ['batchAdd', t]).concat(remove.map(t => ['batchRemove', t]));
  let fail = 0, lastErr = '';
  for(let i = 0; i < jobs.length; i += PAR){
    await Promise.all(jobs.slice(i, i + PAR).map(async ([op, topic]) => {
      try{
        const r = await fetch(`https://iid.googleapis.com/iid/v1:${op}`, { method:'POST',
          headers:{ Authorization:'Bearer '+at, access_token_auth:'true', 'Content-Type':'application/json' },
          body: JSON.stringify({ to:'/topics/'+topic, registration_tokens: tokens }) });
        if(!r.ok){ fail++; lastErr = (await r.text()).slice(0, 200); }
      }catch(e){ fail++; lastErr = String(e.message||e); }
    }));
  }
  return fail ? { ok:false, err:'تعذّر ربط '+fail+' من '+jobs.length+' موضوعاً', detail:lastErr } : { ok:true, n:jobs.length };
}
module.exports = { applyTopics };
