/* =========================================================
   إشعارات أحداث المباراة — بثّ مباشر أثناء الرصد
   ---------------------------------------------------------
   المحرّر يحفظ تلقائياً بعد ثانيتين من كل تعديل. فعند تفعيل
   «بثّ الأحداث» لمباراة، نقارن ما حُفظ بما كان قبله، ونرسل
   إشعاراً لكل حدث جديد مسجَّل فعلاً في النموذج — لا شيء يُخترع.

   كل إشعار يحمل نوع حدثه (ev.d) والمباراة، فيرسله push-send بشرط
   مواضيع تفضيلات المستخدمين (notif-prefs.js): يصل من اختار الحدث ونطاقه
   فقط. الأحداث التي كانت تصل الجميع قبل اللوحة (legacy: هدف، طرد، إنذار،
   تبديل، صافرة النهاية) تُرسل أيضاً لموضوع «all» القديم للأجهزة التي لم تفتح اللوحة.

   قيود مقصودة:
   · مطفأ افتراضياً لكل مباراة — يُفعَّل يدوياً قبل الانطلاق.
   · ٦ إشعارات كحد أقصى في الحفظة الواحدة بالأولوية؛ من يُدخل مباراة
     كاملة دفعة واحدة لا يُفجّر عشرات الإشعارات.
   · بصمة كل حدث تُحفظ، فإعادة الحفظ لا تُعيد الإرسال، وتعديل حدث مسجَّل
     (تصحيح الدقيقة أو الاسم) لا يُرسل إشعاراً ثانياً لنفس الحدث (uid ثابت).
   · الإرسال يحتاج حساب المالك أو محرّراً — تتحقق منه الدالة.
   ========================================================= */
'use strict';
window.LIVEPUSH = {
  ON:'mf_lp_on', SENT:'mf_lp_sent', MAX:6,

  _get(k, d){ try{ return JSON.parse(localStorage.getItem(k)) || d; }catch(e){ return d; } },
  _set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} },

  isOn(key){ return !!this._get(this.ON, {})[key]; },
  toggle(key){
    const o = this._get(this.ON, {});
    if(o[key]) delete o[key]; else o[key] = 1;
    this._set(this.ON, o);
    return !!o[key];
  },

  /* بصمة الحدث: معرّف المحرّر الثابت (uid) إن وُجد — فتصحيح الدقيقة لا يُعدّ حدثاً جديداً — وإلا محتواه */
  _sig(k, x){ return x.uid ? [k, x.r, x.comp, 'u', x.uid].join('|') : [k, x.r, x.comp, x.club||x.sc||'', x.p||'', x.m||0, x.x||0, x.type||''].join('|'); },
  _seen(sig){ return this._get(this.SENT, []).indexOf(sig) >= 0; },
  _mark(sigs){
    const a = this._get(this.SENT, []).concat(sigs);
    this._set(this.SENT, a.slice(-600));          /* سقف حتى لا ينتفخ التخزين */
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
  _mm(x){ return (+x.m||0) + (+x.x ? '+' + (+x.x) : '') + '′'; },

  /* ما الجديد بين اللقطة السابقة وما حُفظ الآن. pri: الأصغر أولاً عند سقف الحفظة */
  plan(base, cur, m){
    if(!base || !cur || !m) return [];
    const out = [], comp = m.comp || (typeof compOf === 'function' ? compOf(m) : 'الدوري');
    const R = {r:m.round, comp};
    const E = (d, side) => ({ d, comp, home:m.home, away:m.away, side: side||'' });
    const score = () => m.home + ' ' + this._scoreNow(m, cur.goals) + ' ' + m.away;
    const add = (pri, sig, title, body, ev, legacy, parent) => { if(!this._seen(sig)) out.push({ pri, sig, title, body, ev, legacy: !!legacy, parent }); };
    const isRedT = t => (typeof isRed === 'function') ? isRed(t) : /طرد|ثانٍ/.test(t||'');

    /* ——— الأهداف ——— */
    const gk = g => g.uid || [g.sc, g.p, g.m, g.x||0].join('|');
    const hadG = new Set((base.goals||[]).map(gk));
    const pens = cur.pens || [];
    (cur.goals||[]).forEach(g => {
      if(hadG.has(gk(g))) return;
      const og = g.bp === 'هدف عكسي';
      const who = og ? (g.og || g.p) + ' (هدف عكسي)' : g.p;
      const ast = (!og && g.a) ? ' · صناعة ' + g.a : '';
      const title = '⚽ ' + m.home + '  ' + this._scoreAt(m, cur.goals||[], g) + '  ' + m.away;
      const body = who + ' ' + this._min(m, g) + ast;
      const sig = this._sig('g', Object.assign({}, R, g));
      add(0, sig, title, body, E('g', g.sc), true);
      /* أنواع فرعية: تصل فقط من اختارها دون «كل هدف» (الاشتراك لا يكررها) */
      const pen = !og && (/جزاء/.test(g.det||'') || pens.some(p => p.p === g.p && p.res === 'سجلت' && Math.abs((+p.m||0) - (+g.m||0)) <= 1));
      if(pen) add(0, sig + '|gp', title, body + ' · ركلة جزاء', E('gp', g.sc), false, sig);
      if(og)  add(0, sig + '|gog', title, body, E('gog', g.sc), false, sig);
      if(+g.x > 0) add(0, sig + '|gat', title, body + ' · الوقت بدل الضائع', E('gat', g.sc), false, sig);
    });

    /* ——— البطاقات ——— */
    const ck = c => c.uid || [c.club, c.p, c.m, c.type].join('|');
    const hadC = new Set((base.cards||[]).map(ck));
    (cur.cards||[]).forEach((c, i) => {
      if(hadC.has(ck(c))) return;
      /* الإنذار الثاني: صريحاً أو إنذار ثانٍ لنفس اللاعب في المباراة (الترقية الآلية في الموقع) */
      const second = c.type === 'إنذار ثانٍ' || (c.type === 'إنذار' && (cur.cards||[]).some((o, j) => j !== i && o.p === c.p && o.club === c.club && o.type === 'إنذار' && ((+o.m||0) + (+o.x||0)/100) < ((+c.m||0) + (+c.x||0)/100)));
      const body = c.p + ' ' + this._mm(c) + ' · ' + score();
      if(second || isRedT(c.type)){
        const sig = this._sig('c', Object.assign({}, R, c));
        add(1, sig, '🟥 طرد — ' + c.club, body + (second ? ' · إنذار ثانٍ' : ''), E('r', c.club), true);
        if(second) add(1, sig + '|r2', '🟥 إنذار ثانٍ — ' + c.club, body, E('r2', c.club), false, sig);
      }else{
        add(5, this._sig('y', Object.assign({}, R, c)), '🟨 إنذار — ' + c.club, body, E('y', c.club), true);
      }
    });

    /* ——— ركلات الجزاء: احتسابها، ثم إهدارها إن سُجّلت نتيجتها ضائعة ——— */
    const pk = x => x.uid || [x.by, x.p, x.m].join('|');
    const oldP = new Map((base.pens||[]).map(x => [pk(x), x]));
    const MISS = ['تصدى لها الحارس','خارج المرمى','القائم / العارضة'];
    pens.forEach(x => {
      const o = oldP.get(pk(x)), sig = this._sig('pa', Object.assign({club:x.by}, R, x));
      if(!o) add(2, sig, 'ركلة جزاء — ' + x.by, (x.p ? x.p + ' · ' : '') + this._mm(x) + ' · ' + score(), E('pa'));
      if(MISS.indexOf(x.res) >= 0 && (!o || o.res !== x.res))
        add(2, sig + '|pm', 'ركلة جزاء ضائعة — ' + x.by, (x.p ? x.p + ' · ' : '') + x.res + ' · ' + score(), E('pm'));
    });

    /* ——— VAR: مراجعة جديدة من سجل الأحداث (نصّها كما كتبه المحرّر) ——— */
    const mk = x => x.uid || [x.k, x.club, x.p, x.m, x.x||0, x.note].join('|');
    const hadM = new Set((base.mev||[]).map(mk));
    (cur.mev||[]).forEach(x => {
      if(x.k !== 'var' || hadM.has(mk(x))) return;
      add(2, this._sig('var', Object.assign({club:x.club}, R, x)), 'مراجعة VAR — ' + m.home + ' × ' + m.away,
        (x.m ? this._mm(x) + ' · ' : '') + (String(x.note||'').trim() || 'الحكم يراجع اللقطة'), E('var'));
    });

    /* ——— مراحل المباراة من الحالة التي يختارها المحرّر ——— */
    const st0 = (base.match && base.match.status) || '', st = (cur.match && cur.match.status) || '';
    if(st && st !== st0){
      const PH = { h1:['ko','انطلاق المباراة', m.home + ' × ' + m.away],
                   ht:['ht','نهاية الشوط الأول', score()],
                   h2:['h2','بداية الشوط الثاني', score()],
                   e1:['et','بداية الأشواط الإضافية', score()],
                   pso:['pso','ركلات الترجيح', score()],
                   ft:['ft','صافرة النهاية', m.home + '  ' + this._scoreNow(m, cur.goals) + '  ' + m.away] }[st];
      if(PH) add(st === 'ft' ? 0 : 3, this._sig(PH[0], {r:m.round, comp, club:m.home, p:m.away}), PH[1], PH[2], E(PH[0]), st === 'ft');
    }
    /* الوقت بدل الضائع: أول إدخال له في الشوط */
    [['add1','الشوط الأول'],['add2','الشوط الثاني']].forEach(([k, t]) => {
      const a = +((cur.match||{})[k]) || 0, b = +((base.match||{})[k]) || 0;
      if(a > 0 && !b) add(4, this._sig('add', {r:m.round, comp, club:m.home, p:m.away, type:k}), 'الوقت بدل الضائع +' + a, t + ' · ' + score(), E('add'));
    });

    /* ——— التبديلات ——— */
    const sk = x => x.uid || [x.club, x.out, x.in, x.m, x.x||0].join('|');
    const hadS = new Set((base.subs||[]).map(sk));
    (cur.subs||[]).forEach(x => {
      if(!x.in || !x.out || hadS.has(sk(x))) return;
      add(6, this._sig('s', {r:m.round, comp, club:x.club, p:x.in + '>' + x.out, m:x.m, x:x.x, uid:x.uid}), '🔁 تبديل — ' + x.club,
        'دخول ' + x.in + ' بدلاً من ' + x.out + (x.m ? ' ' + this._mm(x) : ''), E('sub'), true);
    });

    /* ——— التشكيلة الأساسية والخطة: أول مرة تكتمل لكل نادٍ ——— */
    [m.home, m.away].forEach(club => {
      const n1 = (cur.lineup||[]).filter(x => x.club === club).length, n0 = (base.lineup||[]).filter(x => x.club === club).length;
      if(n1 >= 11 && n0 < 11)
        add(7, this._sig('xi', {r:m.round, comp, club, p:m.home + '×' + m.away}), 'التشكيلة الرسمية — ' + club, m.home + ' × ' + m.away, E('xi'));
      const f1 = ((cur.shapes||{})[club]||{}).f || '', f0 = ((base.shapes||{})[club]||{}).f || '';
      if(f1 && !f0) add(7, this._sig('form', {r:m.round, comp, club, p:f1}), 'خطة ' + club + ': ' + f1, m.home + ' × ' + m.away, E('form'));
    });

    /* السقف على الأحداث نفسها؛ الأنواع الفرعية ترافق حدثها الأب ولا تزاحم غيره (تصل من أطفأ الأب فقط) */
    const main = out.filter(n => !n.parent).sort((a, b) => a.pri - b.pri).slice(0, this.MAX);
    const keep = new Set(main.map(n => n.sig));
    return main.concat(out.filter(n => n.parent && keep.has(n.parent)));
  },

  async send(list, m){
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
          /* الإشعار يفتح صفحة المباراة نفسها */
          body: JSON.stringify({ title: n.title.slice(0,80), body: n.body.slice(0,240), url: n.url || '/', ev: n.ev, legacy: n.legacy })
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
      const url = '/#m/' + k;
      return this.plan(E.base, E, live).map(n => Object.assign(n, { url }));
    }catch(e){ return null; }
  }
};
