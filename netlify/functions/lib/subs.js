/* إضافة/إزالة مواضيع FCM لرموز أجهزة — نداء واحد لكل موضوع (batchAdd/batchRemove يقبل حتى 1000 رمز)،
   بالتوازي على دفعات حتى لا تتجاوز الدالة مهلتها. 'all' مسموح في الإزالة فقط (خروج الجهاز من الموضوع القديم). */
'use strict';
const { TOPIC_RX } = require('./topics');
const REG = require('./reg');
const { serviceAccount } = require('./google');
const MAX = 300, PAR = 16;

async function applyTopics(at, tokens, add, remove){
  const okT = t => typeof t === 'string' && TOPIC_RX.test(t);
  add = [...new Set(add)].filter(okT);
  remove = [...new Set(remove)].filter(t => t === 'all' || okT(t)).filter(t => add.indexOf(t) < 0);
  tokens = tokens.filter(t => typeof t === 'string' && t.length >= 100 && t.length <= 4096 && !/[^\w:.\-]/.test(t)).slice(0, 20);
  if(!tokens.length) return { ok:false, err:'رمز جهاز غير صالح' };
  /* أجهزة التطبيق على الإرسال المباشر (السجل، x): تتغيّر مواضيعها في السجل لا في FCM — وإلا عادت إليها نسخة الموضوع فتتكرر */
  try{
    const pid = serviceAccount().project_id;
    const ents = await Promise.all(tokens.map(t => REG.get(at, pid, t).catch(() => null)));
    const appT = tokens.filter((t, i) => ents[i] && ents[i].x);
    for(const t of appT){ const e = ents[tokens.indexOf(t)];
      const p = e.p.filter(x => remove.indexOf(x) < 0).concat(add.filter(x => e.p.indexOf(x) < 0));
      await REG.put(at, pid, t, p, true); }
    tokens = tokens.filter(t => appT.indexOf(t) < 0);
    if(!tokens.length) return { ok:true, n:0, direct:appT.length };
  }catch(e){}
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
