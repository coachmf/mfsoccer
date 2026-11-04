/* مواضيع FCM لتفضيلات الإشعارات — نفس الدالة h() في notif-prefs.js (لا تغيّرها في مكان دون الآخر).
   موضوع = عائلة الحدث + نطاق: _a كل المباريات، _c_<بطولة>، _t_<فريق> (أي حدث في مباراته)،
   وللأهداف والبطاقات: _f_<فريق> (الفريق فعلها) و_o_<فريق> (فعلها منافسه). */
'use strict';
function h(s){ let x = 5381; s = String(s||''); for(let i=0;i<s.length;i++) x = ((x*33) ^ s.charCodeAt(i)) >>> 0; return x.toString(36); }

const SIDE = new Set(['g','gp','gog','gat','y','r','r2']);
const FAMS = new Set(['r30','r15','r5','ko','h2','ft','g','gp','gog','gat','y','r','r2','var','pa','pm','sub','add','ht','et','pso','xi','form','fd']);
const TOPIC_RX = /^(gen|[a-z0-9]{1,4}_(a|[cfot]_[0-9a-z]{1,8}))$/;

/* شرط الإرسال لحدث واحد: 4 مواضيع كحد أقصى (FCM يسمح بخمسة) */
function condition(ev){
  const d = ev.d, q = t => `'${t}' in topics`;
  const parts = [q(d+'_a')];
  if(ev.comp) parts.push(q(d+'_c_'+h(ev.comp)));
  if(SIDE.has(d)){
    if(ev.side) parts.push(q(d+'_f_'+h(ev.side)));
    const opp = ev.side === ev.home ? ev.away : ev.side === ev.away ? ev.home : '';
    if(opp) parts.push(q(d+'_o_'+h(opp)));
  }else{
    if(ev.home) parts.push(q(d+'_t_'+h(ev.home)));
    if(ev.away) parts.push(q(d+'_t_'+h(ev.away)));
  }
  return parts.join(' || ');
}
module.exports = { h, SIDE, FAMS, TOPIC_RX, condition };
