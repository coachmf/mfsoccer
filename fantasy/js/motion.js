/* لغة الحركة (منصور 2026-09-17، محلي) — بصري فقط:
   شريط تقدّم التمرير، إغلاق متحرك للبطاقة السفلية، وعدّاد أرقام الواجهة عند أول ظهور لكل صفحة. */
(function(){
  var RM=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)');
  var reduced=function(){ return !!(RM&&RM.matches); };

  if(!reduced() && window.CSS && CSS.supports && CSS.supports('animation-timeline: scroll()')){
    var bar=document.createElement('i'); bar.className='mo-progress'; bar.setAttribute('aria-hidden','true');
    (document.body ? Promise.resolve() : new Promise(function(r){ document.addEventListener('DOMContentLoaded', r); }))
      .then(function(){ document.body.appendChild(bar); });
  }

  /* إغلاق البطاقة السفلية بحركة: نسخة شبحية تنزل بينما تُزال الأصلية فوراً (لا تأخير على المنطق) */
  if(typeof UI!=='undefined' && UI.closeSheet){
    var _close=UI.closeSheet;
    UI.closeSheet=function(){
      var b=document.getElementById('sheetBack');
      if(b && !reduced()){
        var sh=b.querySelector('.psheet'), st=sh?sh.scrollTop:0, tr=sh?sh.style.transform:'';
        var g=b.cloneNode(true); g.removeAttribute('id'); g.className='mo-sheet-ghost'; g.setAttribute('aria-hidden','true');
        g.querySelectorAll('[id]').forEach(function(n){ n.removeAttribute('id'); });
        document.body.appendChild(g);
        var gs=g.querySelector('.psheet'); if(gs){ gs.scrollTop=st; gs.style.transform=tr; gs.style.transition='none'; }
        setTimeout(function(){ g.remove(); }, 240);
      }
      return _close.apply(this, arguments);
    };
  }

  /* عدّاد الأرقام: فقط عند دخول صفحة جديدة (.view.anim) */
  function countUp(el){
    if(el.childNodes.length!==1 || el.firstChild.nodeType!==3) return;
    var txt=el.textContent, m=txt.match(/^(\s*)(\d+(?:\.(\d+))?)(%?)(\s*)$/); if(!m) return;
    var target=parseFloat(m[2]), dec=m[3]?m[3].length:0; if(!(target>0) || target>100000) return;
    var t0=null, dur=Math.min(900, 450+target*4), last=txt;
    function step(ts){ if(t0===null) t0=ts; var k=Math.min(1,(ts-t0)/dur), e=1-Math.pow(1-k,4);
      if(!el.isConnected || el.textContent!==last) return;
      last = k<1 ? m[1]+(target*e).toFixed(dec)+m[4]+m[5] : txt; el.textContent=last;
      if(k<1) requestAnimationFrame(step); }
    requestAnimationFrame(step);
  }
  function wire(){
    var main=document.getElementById('main'); if(!main){ return setTimeout(wire, 200); }
    new MutationObserver(function(){
      if(reduced()) return;
      var v=main.querySelector(':scope > .view.anim'); if(!v || v._moDone) return; v._moDone=1;
      v.querySelectorAll('.home-hero .num, .home-hero b, .statbox .v, .hh-pts, .big-pill b').forEach(function(el,i){ setTimeout(function(){ countUp(el); }, 250+i*60); });
    }).observe(main, {childList:true});
  }
  wire();
})();
