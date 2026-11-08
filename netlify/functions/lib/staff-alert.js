/* تنبيه أجهزة الإدارة (المالك + فريق العمل بصلاحية «مدير») — نفس مستقبلي match-audit-cron، مرة واحدة لكل توقيع (pushlog/audit) */
'use strict';
const PROJECT = 'mfsoccer-c7ee4';
const OWNER_UID = 'iiTgVfDryXNLb9IrOyLkkNMHDxq2';
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const { fields } = require('./fsrest');

async function notifyStaff(at, sig, title, body){
  const H = { Authorization:'Bearer ' + at };
  const get = async p => { const r = await fetch(`${DOCS}/${p}`, { headers:H }); if(!r.ok) return null; return fields((await r.json()).fields); };
  const log = await get('pushlog/audit'); const seen = (log && log.sent) || [];
  if(seen.indexOf(sig) >= 0) return { skip:'sent' };
  const staff = await get('seasons/staff'); const mem = (staff && staff.members) || {};
  const uids = [OWNER_UID].concat(Object.keys(mem).filter(u => mem[u] && mem[u].active !== false && mem[u].perm !== 'matches'));
  const tokens = new Set();
  for(const u of [...new Set(uids)]){ const p = await get(`pushprefs/${u}`); ((p && p.tokens) || []).forEach(t => t && tokens.add(t)); }
  let sent = 0;
  await Promise.all([...tokens].map(async token => {
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${PROJECT}/messages:send`, { method:'POST', headers:{ ...H, 'Content-Type':'application/json' },
      body: JSON.stringify({ message:{ token, notification:{ title, body:String(body).slice(0, 230) }, data:{ ev:'gen', url:'https://mfsoccer.com/fantasy/' },
        apns:{ headers:{ 'apns-priority':'10', 'apns-push-type':'alert' }, payload:{ aps:{ sound:'default' } } },
        webpush:{ headers:{ Urgency:'high' }, fcm_options:{ link:'https://mfsoccer.com/fantasy/' } } } }) }).catch(() => null);
    if(r && r.ok) sent++;
  }));
  const all = seen.concat([sig]).slice(-300);
  await fetch(`${DOCS}/pushlog/audit?updateMask.fieldPaths=sent&updateMask.fieldPaths=updated`, { method:'PATCH', headers:{ ...H, 'Content-Type':'application/json' },
    body: JSON.stringify({ fields:{ sent:{ arrayValue:{ values: all.map(s => ({ stringValue:s })) } }, updated:{ stringValue:new Date().toISOString() } } }) });
  return { sent, tokens:tokens.size };
}
module.exports = { notifyStaff };
