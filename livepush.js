/* =========================================================
   إشعارات أحداث المباراة — بثّ مباشر أثناء الرصد
   ---------------------------------------------------------
   المحرّر يحفظ تلقائياً بعد ثانيتين من كل تعديل. فعند تفعيل
   «بثّ الأحداث» لمباراة، نقارن ما حُفظ بما كان قبله، ونرسل
   إشعاراً لكل هدف أو طرد جديد، وإشعاراً واحداً عند النهاية.

   قيود مقصودة:
   · مطفأ افتراضياً لكل مباراة — يُفعَّل يدوياً قبل الانطلاق.
   · ٣ إشعارات كحد أقصى في الحفظة الواحدة؛ من يُدخل مباراة
     كاملة دفعة واحدة لا يُفجّر عشرة إشعارات.
   · بصمة كل حدث تُحفظ، فإعادة الحفظ لا تُعيد الإرسال.
   · الإرسال يحتاج حساب المالك أو محرّراً — تتحقق منه الدالة.
   ========================================================= */
'use strict';
window.LIVEPUSH = {
  ON:'mf_lp_on', SENT:'mf_lp_sent', MAX:3,

  _get(k, d){ try{ return JSON.parse(localStorage.getItem(k)) || d; }catch(e){ return d; } },
  _set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} },

  isOn(key){ return !!this._get(this.ON, {})[key]; },
  toggle(key){
    const o = this._get(this.ON, {});
    if(o[key]) delete o[key]; else o[key] = 1;
    this._set(this.ON, o);
    return !!o[key];
  },

  /* بصمة الحدث: لا تتغيّر بتعديل لا يخصّه، فلا يُرسل مرتين */
  _sig(k, x){ return [k, x.r, x.comp, x.club||x.sc||'', x.p||'', x.m||0, x.x||0, x.type||''].join('|'); },
  _seen(sig){ return this._get(this.SENT, []).indexOf(sig) >= 0; },
  _mark(sigs){
    const a = this._get(this.SENT, []).concat(sigs);
    this._set(this.SENT, a.slice(-400));          /* سقف حتى لا ينتفخ التخزين */
  },

  /* النتيجة من قائمة الأهداف نفسها: الالتقاط يحدث قبل applyEdit فقيم
     m.hg/m.ag لا تزال قيم ما قبل هذه الحفظة. */
  _scoreNow(m, goals){
    let h=0,a=0;
    (goals||[]).forEach(g=>{ if(g.sc===m.home) h++; else if(g.sc===m.away) a++; });
    return h + ' - ' + a;
  },

  /* النتيجة لحظة الهدف — لا النتيجة النهائية */
  _scoreAt(m, goals, g){
    const at = (typeof goalAbs === 'function') ? goalAbs(m, g) : (+g.m||0) + (+g.x||0);
    let h = 0, a = 0;
    goals.forEach(q => {
      const qa = (typeof goalAbs === 'function') ? goalAbs(m, q) : (+q.m||0) + (+q.x||0);
      if(qa > at) return;
      if(q.sc === m.home) h++; else if(q.sc === m.away) a++;
    });
    return h + ' - ' + a;
  },

  _min(m, g){
    const abs = (typeof goalAbs === 'function') ? goalAbs(m, g) : (+g.m||0) + (+g.x||0);
    return (typeof clockLabel === 'function') ? clockLabel(m, abs) : abs + '′';
  },

  /* ما الجديد بين اللقطة السابقة وما حُفظ الآن */
  plan(base, cur, m){
    if(!base || !cur || !m) return [];
    const out = [], ogoal = (base.goals||[]), ncard = (cur.cards||[]), ocard = (base.cards||[]);
    const key = g => [g.sc, g.p, g.m, g.x||0].join('|');
    const had = new Set(ogoal.map(key));
    const isOG = g => g && g.bp === 'هدف عكسي';

    (cur.goals||[]).forEach(g => {
      if(had.has(key(g))) return;
      const sig = this._sig('g', Object.assign({r:m.round, comp:m.comp}, g));
      if(this._seen(sig)) return;
      const who = isOG(g) ? (g.og || g.p) + ' (هدف عكسي)' : g.p;
      const ast = (!isOG(g) && g.a) ? ' · صناعة ' + g.a : '';
      out.push({ sig, title: '⚽ ' + m.home + '  ' + this._scoreAt(m, cur.goals||[], g) + '  ' + m.away,
                 body: who + ' ' + this._min(m, g) + ast });
    });

    const ck = c => [c.club, c.p, c.m, c.type].join('|');
    const hadc = new Set(ocard.map(ck));
    ncard.forEach(c => {
      if(hadc.has(ck(c))) return;
      if(!(typeof isRed === 'function' ? isRed(c.type) : /طرد/.test(c.type||''))) return;
      const sig = this._sig('c', Object.assign({r:m.round, comp:m.comp}, c));
      if(this._seen(sig)) return;
      out.push({ sig, title: '🟥 طرد — ' + c.club,
                 body: c.p + ' ' + (+c.m||0) + '′ · ' + m.home + ' ' + this._scoreNow(m, cur.goals) + ' ' + m.away });
    });

    /* صافرة النهاية مرة واحدة */
    if(cur.match && cur.match.status === 'ft' && (!base.match || base.match.status !== 'ft')){
      const sig = this._sig('ft', {r:m.round, comp:m.comp, club:m.home, p:m.away});
      if(!this._seen(sig))
        out.push({ sig, title: 'صافرة النهاية',
                   body: m.home + '  ' + this._scoreNow(m, cur.goals) + '  ' + m.away });
    }
    return out.slice(0, this.MAX);
  },

  async send(list){
    if(!list || !list.length) return;
    /* FBUSER مُعرَّف بـlet في index.html، وlet على مستوى السكربت لا يُضاف
       إلى window — فـwindow.FBUSER كان undefined دائماً والإرسال يخرج هنا
       بلا أن يرسل شيئاً. (منصور 2026-10-24) */
    let tok = '';
    try{
      const u = (typeof FBUSER !== 'undefined') ? FBUSER : null;
      if(u && u.getIdToken) tok = await u.getIdToken();
    }catch(e){}
    if(!tok){ if(typeof toast === 'function') toast('البثّ يحتاج تسجيل دخول المحرّر','err'); return; }
    const sent = [];
    for(const n of list){
      try{
        const r = await fetch('/.netlify/functions/push-send', {
          method:'POST',
          headers:{'Content-Type':'application/json', Authorization:'Bearer ' + tok},
          body: JSON.stringify({ title: n.title.slice(0,80), body: n.body.slice(0,240), url:'/' })
        });
        const j = await r.json().catch(()=>({}));
        if(j && j.ok) sent.push(n.sig);
      }catch(e){}
    }
    if(sent.length){
      this._mark(sent);
      if(typeof toast === 'function') toast('أُرسل ' + sent.length + ' إشعاراً للمشتركين','ok');
    }
  },

  /* يُستدعى من saveMatch: يلتقط الخطة قبل استبدال EDIT */
  capture(E){
    try{
      if(!E || !E.orig || !E.base || E.gulf) return null;
      const m = E.match; if(!m) return null;
      const k = (typeof matchKey === 'function') ? matchKey(m) : [m.comp, m.round, m.home, m.away].join('/');
      if(!this.isOn(k)) return null;
      const live = (ALL.matches||[]).find(z => +z.round === +m.round && compOf(z) === m.comp
                        && z.home === m.home && z.away === m.away) || m;
      return this.plan(E.base, E, live);
    }catch(e){ return null; }
  }
};
