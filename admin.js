/* =========================================================
   mfsoccer — لوحة الإدارة ومحرّر المباراة (MX)
   أداء 2026-11-14: منقولة كما هي من index.html حتى لا يحمّلها الزائر.
   يحمّلها admLoad() في index.html للطاقم فقط (بعد التحقق من الدخول) أو عند فتح شاشة الدخول.
   الأسماء العامة renderAdmin / renderEditorAdmin / renderMatchAdmin تبقى في index.html (عليها أغلفة الملفات الأخرى)
   وتنادي ADMX.renderAdmin / ADMX.renderEditorAdmin / ADMX.rma المعرّفة هنا.
   ========================================================= */

/* ---------- نموذج المباراة (من index.html) ---------- */
function matchFormHTML(){
  const E=EDIT, m=E.match;
  const sides=[m.home,m.away].filter(Boolean);
  return `
  ${FORMERR?`<div class="formerr">${esc(FORMERR)}</div>`:""}
  <div class="card pad">
    <div class="fgrid">
      ${fld("الجولة","match.round","number",null,m.round)}
      ${fld("المسابقة","match.comp","select",COMPS,m.comp)}
      ${isCupComp(m.comp)?fld("الدور (للكؤوس)","match.stage","select",CUP_STAGES,m.stage):""}
      ${isCupComp(m.comp)?fld("نتيجة بلا هدافين · المضيف","match.manH","number",null,m.manH)+fld("نتيجة بلا هدافين · الضيف","match.manA","number",null,m.manA):""}
      ${fld("الملعب","match.venue","text",null,m.venue)}
      ${fld("الفريق المضيف","match.home","select",editClubs(m),m.home)}
      ${fld("الفريق الضيف","match.away","select",editClubs(m),m.away)}
      ${fld("التاريخ","match.date","date",null,m.date)}
      ${fld("الوقت","match.time","time",null,m.time)}
      ${fld("ملاحظة تظهر للجمهور (اختيارية)","match.note","text",null,m.note)}
    </div>
  </div>

  <h2 class="sec">التشكيلة الأساسية (${E.lineup.length})</h2>
  <p class="hint">أحد عشر لاعباً لكل فريق. من لا يُذكر هنا يُعدّ بديلاً، ولا تُحتسب له دقائق إلا إن دخل ضمن التبديلات.</p>
  ${sides.map(cl=>{ const n=E.lineup.filter(x=>x.club===cl).length;
    return `<button class="addbtn" data-fill="${esc(cl)}">+ أضف 11 خانة لـ${esc(cl)}${n?` (مسجّل ${n})`:""}</button>`;
  }).join("")}
  ${E.lineup.map((x,i)=>`<div class="subrow">
    <button class="del" data-del="lineup.${i}" title="حذف">✕</button>
    <div class="idx">أساسي ${i+1}</div>
    <div class="fgrid">
      ${fld("النادي","lineup."+i+".club","select",sides,x.club)}
      ${pfld("اللاعب","lineup."+i+".p",x.club,sides,x.p)}
    </div></div>`).join("")}
  <button class="addbtn" data-add="lineup">+ إضافة لاعب أساسي</button>
  ${xiTally(sides, E)}

  <h2 class="sec">شكل التشكيلة على الملعب</h2>
  <p class="hint">اختر طريقة اللعب، واسحب أي لاعب لموضعه الفعلي. المراكز في الكشف تصف اللاعب عموماً،
    وهذا يوثّق كيف لعب في هذه المباراة تحديداً — ويظهر للجمهور كما تضبطه.</p>
  <div class="shapes">${sides.filter(cl=>E.lineup.some(x=>x.club===cl&&x.p)).map(cl=>`
    <div class="shapebox" data-shapeclub="${esc(cl)}">
      <div class="shead">
        <b>${esc(cl)}</b>
        <select data-formfor="${esc(cl)}">${(()=>{
          const cur=(E.shapes[cl]||{}).f || autoFormation(cl);
          /* الطريقة المستنتجة قد لا تكون من القياسية (4-2-4 مثلاً)؛
             نضمّها للقائمة حتى لا تختلف القائمة عمّا يُرسم على الملعب */
          const list=FORMATIONS.includes(cur)?FORMATIONS:[cur,...FORMATIONS];
          return list.map(f=>`<option ${f===cur?"selected":""}>${f}</option>`).join("");
        })()}</select>
        <button type="button" class="btn ghost sm" data-flipshape="${esc(cl)}" title="اقلب التشكيلة يمين↔يسار">⇄ اعكس الجهات</button>
        <button type="button" class="btn ghost sm" data-resetshape="${esc(cl)}">إرجاع التلقائي</button>
      </div>
      <div class="xipitch half epitch" data-pitchfor="${esc(cl)}"></div>
    </div>`).join("")}</div>

  <h2 class="sec">التبديلات (${E.subs.length})</h2>
  <p class="hint">الخارج والداخل والشوط والدقيقة. منها تُحسب دقائق كل لاعب، وعليها تُبنى نقاط المشاركة والشباك النظيفة في الفانتسي.</p>
  ${E.subs.map((x,i)=>`<div class="subrow">
    <button class="del" data-del="subs.${i}" title="حذف">✕</button>
    <div class="idx">تبديل ${i+1}${x.m?` · الدقيقة ${absMinute(x.h,x.m)}`:""}</div>
    <div class="fgrid">
      ${fld("النادي","subs."+i+".club","select",sides,x.club)}
      ${pfld("خرج","subs."+i+".out",x.club,sides,x.out)}
      ${pfld("دخل","subs."+i+".in",x.club,sides,x.in)}
      ${fld("الشوط","subs."+i+".h","select",["1","2"],String(x.h||1))}
      ${fld("الدقيقة","subs."+i+".m","number",null,x.m)}
    </div></div>`).join("")}
  <button class="addbtn" data-add="subs">+ إضافة تبديل</button>

  <h2 class="sec">الأهداف (${E.goals.length})</h2>
  ${E.goals.map((g,i)=>`<div class="subrow">
    <button class="del" data-del="goals.${i}" title="حذف">✕</button>
    <div class="idx">هدف ${i+1}${g.det?` · ${esc(catOf(g.det))}`:""}</div>
    <div class="fgrid">
      ${fld("الفريق المسجل","goals.${i}.sc".replace("${i}",i),"select",sides,g.sc)}
      ${pfld("اللاعب المسجل","goals."+i+".p",g.sc,sides,g.p)}
      ${pfld("صانع الهدف","goals."+i+".a",g.sc,sides,g.a)}
      ${fld("الدقيقة","goals."+i+".m","number",null,g.m)}
      ${fld("إضافي","goals."+i+".x","number",null,g.x)}
      ${fld("تفصيل طريقة التسجيل","goals."+i+".det","select",LIST.det,g.det)}
      ${fld("وضعية التسجيل","goals."+i+".bp","select",LIST.bp,g.bp)}
      ${g.bp==="هدف عكسي" ? pfld("ارتدت عن (لاعب الفريق الخصم)","goals."+i+".og",
           sides.find(c=>c!==g.sc)||"", sides, g.og) : ""}
      ${fld("منطقة التسجيل","goals."+i+".zone","select",LIST.zone,g.zone)}
    </div></div>`).join("")}
  <button class="addbtn" data-add="goals">+ إضافة هدف</button>

  <h2 class="sec">الإنذارات (${E.cards.length})</h2>
  ${E.cards.map((x,i)=>`<div class="subrow">
    <button class="del" data-del="cards.${i}" title="حذف">✕</button>
    <div class="idx">بطاقة ${i+1}${secondYellowAt(E.cards,i)?' · <span style="color:var(--loss)">إنذار ثانٍ = طرد</span>':""}</div>
    <div class="fgrid">
      ${fld("النادي","cards."+i+".club","select",sides,x.club)}
      ${pfld("اللاعب","cards."+i+".p",x.club,sides,x.p)}
      ${fld("الدقيقة","cards."+i+".m","number",null,x.m)}
      ${fld("النوع","cards."+i+".type","select",LIST.cardtype,x.type)}
    </div></div>`).join("")}
  <button class="addbtn" data-add="cards">+ إضافة بطاقة</button>

  <h2 class="sec">ركلات الجزاء (${E.pens.length})</h2>
  ${E.pens.map((x,i)=>`<div class="subrow">
    <button class="del" data-del="pens.${i}" title="حذف">✕</button>
    <div class="idx">ركلة ${i+1}</div>
    <div class="fgrid">
      ${fld("الفريق المنفّذ","pens."+i+".by","select",sides,x.by)}
      ${pfld("اللاعب المنفّذ","pens."+i+".p",x.by,sides,x.p)}
      ${fld("الدقيقة","pens."+i+".m","number",null,x.m)}
      ${fld("النتيجة","pens."+i+".res","select",LIST.penres,x.res)}
      <div class="pp-wrap">${fld("مكان التسديد","pens."+i+".place","select",PZONES,x.place)}${penPickSVG(x.place, z=>`data-ppk="pens.${i}.place" data-ppv="${esc(z)}"`)}</div>
    </div></div>`).join("")}
  <button class="addbtn" data-add="pens">+ إضافة ركلة جزاء</button>

  <div style="height:16px"></div>
  <button class="btn" data-act="save">حفظ المباراة</button>
  <div style="height:8px"></div>
  <button class="btn ghost" data-act="cancel">إلغاء</button>
  <p class="hint" style="margin-top:10px">النتيجة تُحتسب تلقائياً من الأهداف — لا تُكتب. والقوائم هنا مطابقة لقوائم ملف الإكسل.</p>`;
}


/* ---------- أزرار المزامنة + قائمة مباريات الإدارة (من index.html) ---------- */
/* أزرار المزامنة والشعارات — كانت مدفونة داخل معالج «إضافة هدف» فلا تُربط أبداً */
function wireAdminIO(){
    const da=$("#dlAssets");
  if(da) da.onclick=()=>{ downloadAssets(); toast("نزّل الملف — ارفعه إلى GitHub بجانب index.html","ok"); };
  const ua=$("#upAssets");
  if(ua) ua.onchange=e=>{
    const f=e.target.files[0]; if(!f) return;
    const fr=new FileReader();
    fr.onload=async()=>{
      try{
        const d=JSON.parse(fr.result);
        if(!d.LOGOS && !d.BRAND) throw new Error("الملف لا يحتوي شعارات");
        applyAssets(d); ASSETSRC="ملف مستورد";
        paintHeader(); renderAll();
        const ok=await persist();
        toast(ok===true?`استُوردت الشعارات (${assetsKB()} ك.ب) ✅`
             :ok==="pending"?SYNCMSG:"استُوردت محلياً، وتعذّر رفعها للسحابة", ok===true?"ok":"busy");
        renderAdmin();
      }catch(err){ toast("تعذّرت القراءة: "+err.message,"err"); }
    };
    fr.readAsText(f); };
  const db2=$("#diagBtn");
  if(db2) db2.onclick=async()=>{
    busy(db2,true,"جارٍ الفحص…");
    $("#diagOut").innerHTML='<p class="hint">قد يستغرق الفحص حتى عشرين ثانية…</p>';
    const res=await diagnose(); busy(db2,false);
    const adv=diagAdvice(res);
    $("#diagOut").innerHTML=`<div style="height:12px"></div>`+
      res.map(x=>`<div class="stat"><span>${x.ok?"✅":"❌"} ${esc(x.t)}</span>
        <span class="v" style="font-size:.72rem;direction:ltr;text-align:left">${esc(x.d)}</span></div>`).join("")+
      (adv?`<div class="note" style="margin-top:12px"><b>التشخيص:</b> ${esc(adv)}</div>`:"");
    toast(res.every(x=>x.ok)?"الاتصال سليم بالكامل":"وُجدت مشكلة — التفاصيل بالأسفل", res.every(x=>x.ok)?"ok":"err");
  };
  const rc2=$("#recompress");
  if(rc2) rc2.onclick=async()=>{
    busy(rc2,true,"جارٍ الضغط…"); toast("جارٍ إعادة ضغط الصور…","busy",true);
    const before=assetsKB();
    const shrink=(u,dim,q)=>new Promise(r=>{
      if(!u){ r(u); return; }
      const img=new Image();
      img.onload=()=>{ try{
          const sc=Math.min(1,dim/Math.max(img.width,img.height));
          const w=Math.max(1,Math.round(img.width*sc)), h=Math.max(1,Math.round(img.height*sc));
          const c=document.createElement("canvas"); c.width=w; c.height=h;
          c.getContext("2d").drawImage(img,0,0,w,h);
          let o=""; try{ o=c.toDataURL("image/webp",q); }catch(e){}
          r(o && o.indexOf("data:image/webp")===0 ? o : c.toDataURL("image/png"));
        }catch(e){ r(u); } };
      img.onerror=()=>r(u); img.src=u; });
    for(const k of Object.keys(LOGOS))  LOGOS[k]  = await shrink(LOGOS[k],160,0.9);
    for(const k of Object.keys(PHOTOS)) PHOTOS[k] = await shrink(PHOTOS[k],220,0.85);
    BRAND  = await shrink(BRAND,300,0.9);
    LEAGUE = await shrink(LEAGUE,180,0.9);
    const after=assetsKB();
    const ok=await persist();
    busy(rc2,false);
    if(ok===true){ LASTSYNC=new Date(); SYNCMSG="";
      toast(`تم الضغط: ${before} ك.ب ← ${after} ك.ب · حُفظ في السحابة`,"ok"); }
    else if(ok==="pending") toast(`ضُغطت إلى ${after} ك.ب · ${SYNCMSG}`,"busy");
    else toast(SYNCMSG||`ضُغطت إلى ${after} ك.ب لكن الحفظ في السحابة فشل`,"err");
    paintHeader(); renderAdmin(); renderAll(); };
  const ft=$("#fantasyToggle");
  if(ft) ft.onclick=async()=>{
    if(!fbDb){ toast("السحابة غير متاحة — افتح الموقع من نطاقه المنشور","err"); return; }
    if(!isAdmin){ toast("سجّل الدخول أولاً","err"); return; }
    const turningOn = !FANTASY_OPEN;
    if(!turningOn && !confirm("إخفاء لعبة الفانتسي عن الجمهور؟")) return;
    busy(ft,true,turningOn?"جارٍ الإشهار…":"جارٍ الإخفاء…");
    const r=await setFantasyOpen(turningOn);
    busy(ft,false);
    if(r===true){ LASTSYNC=new Date();
      toast(turningOn?"أُشهرت اللعبة — صارت ظاهرة لكل الزوار":"أُخفيت اللعبة عن الجمهور","ok"); }
    else if(r==="pending") toast(SYNCMSG||"الاتصال بطيء — سيكتمل الحفظ تلقائياً","busy");
    else toast(SYNCMSG||"تعذّر الحفظ — لم تتغيّر الحالة","err");
    renderAdmin(); };
  const fo=$("#fantasyOpenBtn");
  if(fo) fo.onclick=()=>window.open(FANTASY_URL+"#admin","_blank","noopener");
  const pc=$("#pushCloud");
  if(pc) pc.onclick=async()=>{
    if(!fbDb){ toast("السحابة غير متاحة — افتح الموقع من نطاقه المنشور","err"); return; }
    if(!isAdmin){ toast("سجّل الدخول أولاً","err"); return; }
    busy(pc,true,"جارٍ الرفع…"); toast("جارٍ الرفع إلى السحابة…","busy",true);
    SYNCMSG="";
    const a=await fbSaveSeason(); const b=await fbSaveAssets();
    busy(pc,false);
    if(a===true&&b===true){ LASTSYNC=new Date(); SYNCMSG="";
      toast(`رُفع كل شيء: ${MATCHES.length} مباراة و${GOALS.length} هدفاً و${assetsKB()} ك.ب صوراً`,"ok"); }
    else if(a==="pending"||b==="pending") toast(SYNCMSG||"الاتصال بطيء — سيكتمل الرفع تلقائياً","busy");
    else if(a===true) toast(SYNCMSG||"رُفعت البيانات، لكن تعذّر رفع الصور","err");
    else toast(SYNCMSG||"تعذّر الرفع إلى السحابة","err");
    renderAdmin(); };
  const pl=$("#pullCloud");
  if(pl) pl.onclick=async()=>{
    busy(pl,true,"جارٍ الجلب…"); toast("جارٍ الجلب من السحابة…","busy",true);
    const d=await fbLoad(seasonId()); const a=await fbLoad("assets");
    busy(pl,false);
    if(!d){ toast("لا توجد نسخة في السحابة بعد","err"); return; }
    applyAssets(a); applyData(d,"السحابة (Firestore)");
    LASTSYNC=new Date();
    toast(`جُلبت ${MATCHES.length} مباراة و${GOALS.length} هدفاً من السحابة`,"ok");
    paintHeader(); paintFoot(); renderAdmin(); };
}

function __admRenderMatchAdmin(){
  const box=$("#matchAdmin"); if(!box) return;
  if(EDIT){
    EDIT.shapes = EDIT.shapes || {};
    box.innerHTML = `<h2 class="sec">${EDIT.orig?"تعديل مباراة":"مباراة جديدة"}</h2>` + matchFormHTML();
    wireShapes(box);
  } else {
    const ms=(ALL?.matches||[]).slice();
    const rounds=[...new Set(ms.map(m=>+m.round))].sort((a,b)=>b-a);
    const mRow=m=>`<div class="mrow adm" data-mcomp-row="${esc(compOf(m))}" style="${clubVars(m.home).replace(/--cc/g,"--hc")};${clubVars(m.away).replace(/--cc/g,"--ac")}">
        <div class="am-teams">
          <span class="am-t h">${crest(m.home)}<b>${esc(m.home)}</b></span>
          <span class="am-score${isUpcoming(m)?" soon":""}">${isUpcoming(m)?(m.time?esc(m.time):"—"):`${m.hg} - ${m.ag}`}</span>
          <span class="am-t a">${crest(m.away)}<b>${esc(m.away)}</b></span>
        </div>
        <div class="am-meta">${isUpcoming(m)?'<span class="mstat soon">لم تبدأ</span>':""}<span>${esc(compOf(m))}</span><span dir="ltr">${esc(m.date||"بلا تاريخ")}</span>${m.venue?`<span>${esc(m.venue)}</span>`:""}${m.tv?`<span class="am-tv">${esc(m.tv)}</span>`:""}</div>
        <div class="am-btns"><button class="am-eff" data-eff-open="${esc(matchKey(m))}" title="ساعة الوقت الفعلي للعب — مستقلة عن الأحداث والإحصاءات">الوقت الفعلي</button><button data-edit="${esc(mkey(m))}" title="إدخال الأحداث يدوياً بعد المباراة">${window.LIVE?"إدخال يدوي":"تعديل"}</button><button class="dl" data-rm="${esc(mkey(m))}">حذف</button></div>
      </div>`;
    const cc={}; ms.forEach(m=>{ const c=compOf(m); cc[c]=(cc[c]||0)+1; });
    const mf = (typeof ADM_MCOMP!=="undefined" && ADM_MCOMP) || "الكل";
    box.innerHTML = `
      <button class="btn" data-act="new">+ إضافة مباراة جديدة</button>
      <button class="btn am-efftool" data-eff-tool="1" title="ساعة الوقت الفعلي بدون اختيار مباراة — تحفظها على أي مباراة بعد ما تخلص">أداة الوقت الفعلي</button>
      <div class="segbar compbar adm-compf" role="tablist" aria-label="البطولة">
        <button class="seg" data-mcompf="الكل" aria-pressed="${mf==="الكل"}">كل البطولات <small>${ms.length}</small></button>
        ${COMPS.map(c=>`<button class="seg" data-mcompf="${esc(c)}" aria-pressed="${mf===c}">${esc(c)} <small>${cc[c]||0}</small></button>`).join("")}</div>
      <h2 class="sec">المباريات المسجّلة (${ms.length})</h2>
      ${ms.length? `<div class="card pad">`+rounds.map((r,ri)=>{
        const rms=ms.filter(m=>+m.round===r).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
        const up=rms.filter(isUpcoming).length;
        return `<details class="rndbox" ${ri===0?"open":""}>
          <summary><b>الجولة ${r}</b><span class="rc">${rms.length} مباراة</span>${up?`<span class="rc soon">${up} لم تبدأ</span>`:""}</summary>
          <div class="rndbody adm-matches">${rms.map(mRow).join("")}</div>
        </details>`;
      }).join("")+`</div>`
      : '<div class="card pad"><span style="color:var(--slate)">لا مباريات بعد.</span></div>'}`;
  }
  box.querySelectorAll("[data-k]").forEach(el=>{
    el.oninput=()=>{ setPath(el.dataset.k, el.value); syncPNum(box, el); };
    el.onchange=()=>{ setPath(el.dataset.k, el.value);
      if(/^match\.(home|away|comp)$/.test(el.dataset.k) || /\.det$/.test(el.dataset.k)
         || /^goals\.\d+\.(sc|bp)$/.test(el.dataset.k) || /^cards\.\d+\.club$/.test(el.dataset.k)
         || /^pens\.\d+\.by$/.test(el.dataset.k)
         || /^(lineup|subs)\.\d+\.club$/.test(el.dataset.k)) renderMatchAdmin(); };
  });
  box.querySelectorAll(".pnum").forEach(el=>{
    el.oninput=()=>{
      el.value=el.value.replace(/\D/g,"");
      const key=el.dataset.pfor;
      const target=box.querySelector(`[data-k="${key}"]`);
      const hint=box.querySelector(`[data-phint="${key}"]`);
      if(hint) hint.textContent="";
      if(!el.value || !target) return;
      const hits=squadEntriesOf(el.dataset.pclub, editSides()).filter(e=>e.s===+el.value && !isHidden(e.club,e.n));
      if(hits.length===1){ target.value=hits[0].n; setPath(key, hits[0].n); }
      else if(hits.length>1){ if(hint) hint.textContent="أكثر من لاعب بهذا الرقم: "+hits.map(e=>`${e.n} (${e.club})`).join(" · "); }
      else if(hint) hint.textContent="ما فيه لاعب بهذا الرقم في الكشف";
    };
  });
  box.querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>{
    const k=b.dataset.add;
    if(k==="goals") EDIT.goals.push({sc:"",p:"",a:"",m:"",x:0,det:"",bp:"",zone:"",og:""});
    if(k==="cards") EDIT.cards.push({club:"",p:"",m:"",type:"إنذار"});
    if(k==="pens")  EDIT.pens.push({by:"",p:"",m:"",res:"احتُسبت",place:""});
    if(k==="lineup") EDIT.lineup.push({club:"",p:""});
    if(k==="subs")   EDIT.subs.push({club:"",out:"",in:"",h:"1",m:"",x:0});
  renderMatchAdmin();
  });
  box.querySelectorAll("[data-fill]").forEach(b=>b.onclick=()=>{
    const cl=b.dataset.fill;
    const have=EDIT.lineup.filter(x=>x.club===cl).length;
    for(let i=have;i<11;i++) EDIT.lineup.push({club:cl,p:""});
    renderMatchAdmin(); });
  box.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{
    const [k,i]=b.dataset.del.split("."); EDIT[k].splice(+i,1); renderMatchAdmin(); });
  box.querySelectorAll("[data-act]").forEach(b=>b.onclick=()=>{
    const a=b.dataset.act;
    if(a==="new"){ EDIT=newEdit(); FORMERR=""; renderMatchAdmin(); }
    if(a==="cancel"){ EDIT=null; FORMERR=""; renderMatchAdmin(); flushRemote(); }
    if(a==="save") saveMatch();
  });
  box.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>{
    const m=(ALL.matches||[]).find(x=>mkey(x)===b.dataset.edit);
    if(m){ EDIT=loadEdit(m); FORMERR=""; renderMatchAdmin(); } });
  /* فلتر البطولة: يُخفي مباريات البطولات الأخرى والجولات الفارغة (منصور 2026-09-21) */
  const applyMF=()=>{ const f=(typeof ADM_MCOMP!=="undefined" && ADM_MCOMP)||"الكل";
    box.querySelectorAll("[data-mcomp-row]").forEach(r=>r.hidden = f!=="الكل" && r.dataset.mcompRow!==f);
    box.querySelectorAll(".rndbox").forEach(d=>{ const n=[...d.querySelectorAll("[data-mcomp-row]")].filter(r=>!r.hidden).length; d.hidden=!n; const rc=d.querySelector(".rc"); if(rc) rc.textContent=n+" مباراة"; }); };
  box.querySelectorAll("[data-mcompf]").forEach(b=>b.onclick=()=>{ ADM_MCOMP=b.dataset.mcompf; box.querySelectorAll("[data-mcompf]").forEach(x=>x.setAttribute("aria-pressed", x===b)); applyMF(); });
  applyMF();
  box.querySelectorAll("[data-rm]").forEach(b=>b.onclick=async()=>{
    if(!confirm("حذف هذه المباراة وكل أهدافها وبطاقاتها وركلاتها؟")) return;
    await rebaseOnCloud();   /* v27 */
    removeMatchByKey(b.dataset.rm);
    stampComp(ALL); applyComp(); await persistData();
    paintRail(); renderAll(); renderMatchAdmin(); });
}


/* ================= لوحة المدير ================= */
/* ================= الكشوفات وفريق العمل — أقسام مشتركة ================= */
function squadRowsHTML(club){
  const a=SQUADS[club]||[];
  if(!a.length) return `<p class="hint" style="margin:2px 0 0">لا كشف لهذا النادي بعد.</p>`;
  const dup=squadDupNums(club);
  return a.map((x,i)=>{
    const p=sqPos(x), s=sqNum(x);
    const cut=(typeof photoCut==="function" && sqName(x)) ? photoCut(sqName(x), club) : null;
    return `<div class="sqrow ${p?"":"nopos"} pg-${posMain(x)||"x"}" data-i="${i}">
      <span class="sqface">${cut?`<img src="${cut}_f.webp?v=39" alt="" loading="lazy" decoding="async">`:esc(iniOf(sqName(x)))}</span>
      <input type="text" class="sqno ${dup.has(s)?"dup":""}" inputmode="numeric" maxlength="3"
        value="${s||""}" placeholder="#" title="رقم القميص">
      <input type="text" class="sqn" value="${esc(sqName(x))}" spellcheck="false" placeholder="اسم اللاعب">
      <select class="sqp">${posSelectHTML(p)}</select>
      <button type="button" class="sqx" title="حذف">✕</button>
    </div>`;
  }).join("");
}
/* v23: club colour CSS vars for admin widgets (white-primary clubs use their secondary) */
function clubVars(c){
  const cc=(window.CLUB_COLORS||{})[c]; if(!cc) return "--cc:#0D4F92;--cc2:#7FE0FF;--cct:#fff;--ccb:transparent;--ccd:#083B70";
  const lum=h=>{const x=h.replace("#","");return (.2126*parseInt(x.slice(0,2),16)+.7152*parseInt(x.slice(2,4),16)+.0722*parseInt(x.slice(4,6),16))/255;};
  if(lum(cc[0])>.9) return `--cc:#FFFFFF;--cc2:${cc[1]};--cct:#0B1F3A;--ccb:${cc[1]};--ccd:#E6EBF2`;
  /* لون فاتح (أصفر القادسية): النص كحلي بدل الأبيض الذي لا يُقرأ */
  return `--cc:${cc[0]};--cc2:${cc[1]};--cct:${lum(cc[0])>.55?"#0B1F3A":"#fff"};--ccb:transparent;--ccd:color-mix(in srgb,${cc[0]} 70%,#000)`;
}
function squadBoxHTML(c){
  const n=(SQUADS[c]||[]).length, miss=squadMissing(c);
  return `<details class="squadbox" data-club="${esc(c)}" style="${clubVars(c)}" ${SQOPEN.has(c)?"open":""}>
    <summary><label class="lb sqhead">${crest(c)}<b>${esc(c)}</b>
      <span class="cnt">${n} لاعباً</span>
      ${miss?`<span class="cnt miss">بلا مركز ${miss}</span>`:""}</label></summary>
    <div class="sqbody">
    <div class="sqtools">
      <button type="button" class="sqsort">ترتيب حسب المركز</button>
      <button type="button" class="sqbulk">لصق دفعة</button>
    </div>
    <textarea class="sqpaste" rows="4" spellcheck="false" style="display:none"
      placeholder="سطر لكل لاعب:  9 خالد الخرقاوي ST"></textarea>
    <div class="sqrows">${squadRowsHTML(c)}</div>
    <div class="sqadd">
      <input type="text" class="sqnewno" inputmode="numeric" maxlength="3" placeholder="#">
      <input type="text" class="sqnew" placeholder="إضافة لاعب">
      <select class="sqnewpos">${posSelectHTML("")}</select>
      <button type="button" class="sqaddbtn">إضافة</button>
    </div>
    </div>
  </details>`;
}
function squadsSectionHTML(){
  const found=squadsExtractNums();      /* شبكة أمان: يشتغل حتى لو فُتحت الإعدادات مباشرة */
  if(found) SQNUMS_FOUND=found;
  const miss=squadMissingAll();
  return `
    <h2 class="sec">كشوفات اللاعبين</h2>
    <p class="hint">ثلاث خانات لكل لاعب: رقم القميص، الاسم، والمركز. المراكز تنحفظ مع الكشف وتصدّر للفانتسي، والأسماء تظهر كقائمة منسدلة عند إدخال الأهداف والبطاقات وركلات الجزاء.</p>
    <div class="card pad">
      ${CLUBS.map(c=>squadBoxHTML(c)).join("")}
      <div style="height:6px"></div>
      <button class="btn" id="saveSquads">حفظ الكشوفات</button>
      <button class="btn ghost" id="extractNums" style="margin-inline-start:8px">استخراج الأرقام من الأسماء</button>
      ${SQNUMS_FOUND?`<p class="hint" style="margin:10px 0 0;color:#E0B23C">انفصل رقم ${SQNUMS_FOUND} لاعب عن اسمه تلقائياً وانحط في خانة الرقم — اضغط «حفظ الكشوفات» لاعتماده.</p>`:""}
      <p class="hint" style="margin:10px 0 0">الكشوفات تُحفظ مع بيانات الموسم وتُرفع للسحابة تلقائياً. إجمالي المسجّل الآن: ${squadTotal()} لاعباً${miss?` · ${miss} منهم بلا مركز`:""}.</p>
    </div>`;
}
/* تحرير حيّ: كل تغيير ينعكس على SQUADS فوراً، وزر الحفظ يرفعه للسحابة */
const SQ = {
  arr(c){ return (SQUADS[c] = SQUADS[c] || []); },
  box(c){ return [...document.querySelectorAll(".squadbox")].find(b=>b.dataset.club===c); },
  set(c,i,n,p,s){ this.arr(c)[i]=sqItem(n,p,s); },
  paint(c){
    const b=this.box(c); if(!b) return;
    b.querySelector(".sqrows").innerHTML=squadRowsHTML(c);
    const n=(SQUADS[c]||[]).length, miss=squadMissing(c), lb=b.querySelector("summary label.lb");
    lb.innerHTML=`${crest(c)}<b>${esc(c)}</b> <span class="cnt">${n} لاعباً</span>`
      + (miss?` <span class="cnt miss">بلا مركز ${miss}</span>`:"");
  },
  name(c,i,v){ const x=this.arr(c)[i]; this.set(c,i, v.trim().replace(/\s+/g," "), sqPos(x), sqNum(x)); },
  pos(c,i,v){ const x=this.arr(c)[i]; this.set(c,i, sqName(x), v, sqNum(x)); this.paint(c); },
  num(c,i,v){ const x=this.arr(c)[i]; this.set(c,i, sqName(x), sqPos(x), parseInt(String(v).replace(/\D/g,""),10)||0); },
  del(c,i){ const a=this.arr(c); a.splice(i,1); if(!a.length) delete SQUADS[c]; this.paint(c); },
  add(c,n,p,s){
    n=(n||"").trim().replace(/\s+/g," "); if(!n) return false;
    const a=this.arr(c);
    if(a.some(x=>sqName(x)===n)){ toast("الاسم موجود في الكشف","err"); return false; }
    a.push(sqItem(n,p,parseInt(String(s).replace(/\D/g,""),10)||0)); this.paint(c); return true;
  },
  bulk(c,txt){
    const a=this.arr(c); let added=0;
    txt.split("\n").map(x=>x.trim().replace(/\s+/g," ")).filter(Boolean).forEach(line=>{
      let s=0, p="";
      let t=line.replace(/^(\d{1,3})\s*[-.,]?\s*/, (m,d)=>{ s=+d; return ""; });   /* رقم في أول السطر */
      t=t.replace(/[\s,،-]+([A-Za-z]{1,3})$/, (m,code)=>{                          /* مركز في آخر السطر */
        const up=POS_ALIAS[code.toUpperCase()] || code.toUpperCase();
        if(POS_ALL.includes(up)){ p=up; return ""; }
        return m;
      });
      const n=t.trim().replace(/\s+/g," ");
      if(!n || a.some(x=>sqName(x)===n)) return;
      a.push(sqItem(n,p,s)); added++;
    });
    if(!a.length) delete SQUADS[c];
    this.paint(c);
    toast(added?`أُضيف ${added} لاعب`:"ما فيه أسماء جديدة", added?"ok":"err");
  },
  sort(c){
    const main={G:0,D:1,M:2,F:3,"":4}, det={};
    POS_ALL.forEach((k,i)=>det[k]=i);
    this.arr(c).sort((x,y)=>
      (main[posMain(x)]??4)-(main[posMain(y)]??4)
      || (det[sqPos(x)]??99)-(det[sqPos(y)]??99)
      || (sqNum(x)||999)-(sqNum(y)||999)
      || sqName(x).localeCompare(sqName(y),"ar"));
    this.paint(c);
  },
  clean(){   /* قبل الحفظ: حذف الفاضي والمكرر */
    Object.keys(SQUADS).forEach(c=>{
      const seen=new Set(), out=[];
      (SQUADS[c]||[]).forEach(x=>{
        const n=sqName(x).trim().replace(/\s+/g," ");
        if(!n || seen.has(n)) return;
        seen.add(n); out.push(sqItem(n, sqPos(x), sqNum(x)));
      });
      if(out.length) SQUADS[c]=out; else delete SQUADS[c];
    });
  }
};
function wireSquads(){
  const sqb=$("#saveSquads"); if(!sqb) return;

  const ext=$("#extractNums");
  if(ext) ext.onclick=()=>{
    const n=squadsExtractNums();
    if(!n){ toast("ما فيه أرقام مدموجة بالأسماء","err"); return; }
    CLUBS.forEach(c=>SQ.paint(c));
    toast(`انفصل رقم ${n} لاعب — احفظ الكشوفات للاعتماد`,"ok");
  };

  document.querySelectorAll(".squadbox").forEach(box=>{
    const c=box.dataset.club;
    const idx=el=>+el.closest(".sqrow").dataset.i;
    box.addEventListener("input", e=>{
      const t=e.target;
      if(t.classList.contains("sqn"))  SQ.name(c, idx(t), t.value);
      if(t.classList.contains("sqno")){ t.value=t.value.replace(/\D/g,""); SQ.num(c, idx(t), t.value); }
      if(t.classList.contains("sqnewno")) t.value=t.value.replace(/\D/g,"");
    });
    box.addEventListener("change", e=>{ if(e.target.classList.contains("sqp")) SQ.pos(c, idx(e.target), e.target.value); });
    box.addEventListener("click", e=>{
      const t=e.target;
      if(t.classList.contains("sqx")) return SQ.del(c, idx(t));
      if(t.classList.contains("sqsort")) return SQ.sort(c);
      if(t.classList.contains("sqbulk")){
        const ta=box.querySelector(".sqpaste");
        if(ta.style.display==="none"){ ta.style.display="block"; ta.focus(); t.textContent="أضف الأسماء الملصوقة"; }
        else { SQ.bulk(c, ta.value); ta.value=""; ta.style.display="none"; t.textContent="لصق دفعة"; }
        return;
      }
      if(t.classList.contains("sqaddbtn")){
        const no=box.querySelector(".sqnewno"), inp=box.querySelector(".sqnew"), sel=box.querySelector(".sqnewpos");
        if(SQ.add(c, inp.value, sel.value, no.value)){ inp.value=""; no.value=""; no.focus(); }
      }
    });
    box.addEventListener("keydown", e=>{
      if(e.key==="Enter" && (e.target.classList.contains("sqnew")||e.target.classList.contains("sqnewno"))){
        e.preventDefault(); box.querySelector(".sqaddbtn").click();
      }
    });
    box.addEventListener("toggle", ()=>{ box.open ? SQOPEN.add(c) : SQOPEN.delete(c); });
  });

  sqb.onclick=async()=>{
    SQ.clean();
    busy(sqb,true,"جارٍ الحفظ…");
    /* نأخذ أحدث بيانات الموسم ثم نُعيد كشوفاتي فوقها، فلا يُمحى عمل غيري ولا عملي */
    const reb = await rebaseOnCloud(()=>{ const mine=SQUADS; return ()=>{ SQUADS=mine; SQNUMS_FOUND=squadsExtractNums(); }; });   /* v27 */
    if(reb.changed && fromOther(reb.by)) toast(`وصل تحديث من ${reb.by} — دُمج قبل الحفظ`,"busy");
    const ok=await persistData();
    busy(sqb,false);
    if(ok===true){ LASTSYNC=new Date();
      const ms=squadMissingAll();
      toast(`حُفظت الكشوفات · ${squadTotal()} لاعباً ✅${ms?` · ${ms} بلا مركز`:""}`,"ok"); }
    else if(ok==="pending") toast(SYNCMSG,"busy");
    else toast(SYNCMSG||"حُفظت محلياً، وتعذّر رفعها للسحابة","err");
    renderAdmin();
  };
}
async function saveStaff(btn, msg){
  if(btn) busy(btn,true,"جارٍ الحفظ…");
  const ok=await fbSaveStaff();
  if(btn) busy(btn,false);
  toast(ok===true?msg:(SYNCMSG||"تعذّر الحفظ"), ok===true?"ok":"err");
  renderAdmin();
}
function wireFanList(){
  document.querySelectorAll("[data-fan]").forEach(b=>b.onclick=async()=>{
    busy(b,true,"…");
    const ok=await toggleFan(b.dataset.fan);
    busy(b,false);
    toast(ok?"حُدّث الجدول ✅":"تعذّر التحديث", ok?"ok":"err");
    if(ok) renderAdmin();
  });
}
/* قسم «فريق العمل» — للمالك ولمنصور (canStaff) */
/* مركز التحليل: صفحة مستقلة (/office.html) تعرض من يعمل الآن وأين.
   يراها كل فريق العمل لا المالك وحده — فهي أداة تنسيق بينهم، بخلاف
   «فريق العمل» أدناه التي يحدّدها المالك ومنصور. (منصور 2026-11-10) */
function officeSectionHTML(){
  if(!(MYROLE==="owner" || MYROLE==="editor")) return "";
  return `
    <h2 class="sec">مركز التحليل</h2>
    <p class="hint">من يعمل الآن ومن أين — إدارة الرصد أو اللعب الفعلي. يُحدَّث لحظياً، ومن أغلق الموقع يظهر غير متصل بعد دقيقتين.</p>
    <div class="card pad">
      <a class="btn" href="/office.html" style="display:inline-block;text-decoration:none">افتح مركز التحليل</a>
    </div>`;
}

function staffSectionHTML(){
  if(!canStaff()) return "";
  return `
    <h2 class="sec">فريق العمل</h2>
    <p class="hint">«مدير»: يرى كل لوحة فريق العمل. «محرر»: تحرير المباريات فقط، ولا يرى أي قسم آخر. الصلاحيات يحددها المالك ومنصور فقط.</p>
    <div class="card pad">
      ${Object.keys(STAFF).length?Object.entries(STAFF).map(([uid,m])=>`
        <div class="staffrow">
          <div class="sm">
            <b>${esc(m.name||"بلا اسم")} <span class="cnt">${esc(PERM_AR[permOf(m)])}</span>${m.active===false?' <span class="cnt off">موقوف</span>':""}</b>
            <span>${esc(m.email||"—")}</span>
            <code>${esc(uid)}</code>
          </div>
          ${STAFF_ADMINS.includes(uid)?`<span class="cnt">يحدد الصلاحيات</span>`:`<select class="staffperm" data-staff-perm="${esc(uid)}" aria-label="الصلاحية">${Object.entries(PERM_AR).map(([k,t])=>`<option value="${k}" ${permOf(m)===k?"selected":""}>${t}</option>`).join("")}</select>
          <button data-staff-toggle="${esc(uid)}">${m.active===false?"تفعيل":"إيقاف"}</button>
          <button class="dl" data-staff-rm="${esc(uid)}">حذف</button>`}
        </div>`).join(""):'<span style="color:var(--slate)">لا أعضاء بعد.</span>'}
      <div style="height:14px"></div>
      <label class="lb">إضافة عضو</label>
      <div class="fgrid">
        <div class="fld"><label>الاسم</label><input type="text" id="stName"></div>
        <div class="fld"><label>البريد الإلكتروني</label><input type="text" id="stMail" dir="ltr"></div>
      </div>
      <div class="fld"><label>رمز الحساب (UID)</label><input type="text" id="stUid" dir="ltr" placeholder="ينسخه العضو من شاشة الدخول"></div>
      <div class="fld"><label>الصلاحية</label><select id="stPerm"><option value="matches">محرر — تحرير المباريات فقط</option><option value="full">مدير — كل لوحة فريق العمل</option></select></div>
      <div style="height:10px"></div>
      <button class="btn" id="addStaff">إضافة العضو</button>
      <p class="hint" style="margin:12px 0 0">الخطوات: أنشئ الحساب من Firebase Console ← Authentication ← Users ← Add user (بريد وكلمة مرور). يدخل العضو من صفحة «التحليل ← الإعدادات» فيظهر له رمز حسابه، يرسله لك، وتضيفه هنا.</p>
    </div>`;
}
function wireStaff(){
  const add=$("#addStaff");
  if(add) add.onclick=async()=>{
    const name=($("#stName").value||"").trim();
    const mail=($("#stMail").value||"").trim();
    const uid =($("#stUid").value||"").trim();
    if(!uid){ toast("الصق رمز الحساب (UID)","err"); return; }
    if(uid===ADMIN_UID){ toast("هذا حسابك أنت — المالك مضاف أصلاً","err"); return; }
    if(STAFF[uid]){ toast("هذا العضو مضاف مسبقاً","err"); return; }
    const perm=($("#stPerm")&&$("#stPerm").value)==="full"?"full":"matches";
    STAFF[uid]={name, email:mail, role:"editor", perm, active:true};
    await saveStaff(add, `أُضيف ${name||"العضو"} ك${PERM_AR[perm]} ✅`);
  };
  document.querySelectorAll("[data-staff-perm]").forEach(sel=>sel.onchange=async()=>{
    const uid=sel.dataset.staffPerm, m=STAFF[uid]; if(!m || STAFF_ADMINS.includes(uid)) return;
    m.perm = sel.value==="matches" ? "matches" : "full"; m.role = "editor";
    await saveStaff(null, `${m.name||"العضو"}: ${PERM_AR[m.perm]} ✅`);
  });
  document.querySelectorAll("[data-staff-toggle]").forEach(b=>b.onclick=async()=>{
    const uid=b.dataset.staffToggle, m=STAFF[uid]; if(!m) return;
    m.active = m.active===false;
    await saveStaff(b, m.active?"فُعّل الحساب ✅":"أُوقف الحساب");
  });
  document.querySelectorAll("[data-staff-rm]").forEach(b=>b.onclick=async()=>{
    const uid=b.dataset.staffRm;
    if(!confirm(`حذف ${STAFF[uid]?.name||"هذا العضو"} من فريق العمل؟`)) return;
    delete STAFF[uid];
    await saveStaff(b, "حُذف العضو");
  });
}

/* لوحة المحرّر — إدخال البيانات فقط، بلا هوية ولا ملفات ولا صلاحيات */
function __admRenderEditorAdmin(){
  if(MF_MATCHES_ONLY()){
    $("#v-admin").innerHTML=`
    <div class="brandcard" style="border-color:rgba(95,178,232,.32)">
      <div class="bt"><b>${esc((STAFF[FBUSER.uid]&&STAFF[FBUSER.uid].name)||FBUSER.email)}</b>
        <div class="handles" style="display:flex;align-items:center;gap:8px"><span class="cnt" style="width:auto;height:auto;border-radius:999px;padding:3px 12px">محرر</span><button class="btn ghost" id="logout" style="width:auto;padding:6px 16px">خروج</button></div></div>
    </div>
    ${SYNCMSG?`<div class="formerr">${esc(SYNCMSG)}</div>`:""}
    <h2 class="sec">إدارة المباريات</h2>
    <div id="matchAdmin"></div>`;
    renderMatchAdmin();
    const lo=$("#logout");
    if(lo) lo.onclick=async()=>{
      if(fbAuth && FBUSER){ try{ await fbAuth.signOut(); }catch(e){} }
      isAdmin=false; isOwner=false; MYROLE=""; MYPERM="full";
      $("#adminBtn").classList.remove("on"); ADMIN_REVEAL=false; ADMIN_HINT.set(false); paintAdminBtn(); paintFantasyTab(); go("home");
    };
    return;
  }
  $("#v-admin").innerHTML=`
    <div class="brandcard" style="border-color:rgba(95,178,232,.32)">
      <div class="bt">
        <b>${esc((STAFF[FBUSER.uid]&&STAFF[FBUSER.uid].name)||FBUSER.email)}</b>
        <div class="handles"><span class="cnt">مدير</span></div>
      </div>
    </div>
    ${SYNCMSG?`<div class="formerr">${esc(SYNCMSG)}</div>`:""}

    <h2 class="sec">إدارة المباريات</h2>
    <p class="hint">أضف مباراة كاملة: الجولة والملعب والتاريخ والوقت، ثم الأهداف والبطاقات وركلات الجزاء. النتيجة تُحسب من الأهداف.</p>
    <div id="matchAdmin"></div>

    ${refsAdminHTML()}
    ${refCrewsHTML()}

    ${squadsSectionHTML()}

    ${totAdminHTML()}

    ${kitsAdminHTML()}

    ${canPreds() ? `<h2 class="sec">تحدي التوقعات</h2>
    <p class="hint">بعد إدخال نتائج الجولة، احتسب نقاط الجمهور. الاحتساب ينشر بعدها توقعات كل مشترك في بروفايله.</p>
    <div class="card pad">
      <div class="stat"><span>آخر جولة محتسبة</span><span class="v">${BOARD&&BOARD.lastRound?BOARD.lastRound:"—"}</span></div>
      <div class="fld"><label>الجولة</label>
        <select id="scRound">${[...new Set(MATCHES.filter(m=>!isUpcoming(m)).map(m=>+m.round||0))]
          .sort((a,b)=>b-a).map(r=>`<option value="${r}">الجولة ${r}</option>`).join("")}</select></div>
      <div style="height:10px"></div>
      <button class="btn" id="scGo">احتسب نقاط الجمهور</button>
    </div>` : ""}

    ${officeSectionHTML()}

    ${staffSectionHTML()}

    <h2 class="sec">حالة الحفظ</h2>
    <div class="card pad">
      <div class="stat"><span>الحساب</span><span class="v" style="font-size:.78rem;direction:ltr">${esc(FBUSER.email||"—")}</span></div>
      <div class="stat"><span>الحالة</span><span class="v" style="font-size:.82rem">${esc(FBSTATE)}</span></div>
      <div class="stat"><span>المحتوى</span><span class="v">${MATCHES.length} مباراة · ${GOALS.length} هدفاً</span></div>
      <div class="stat"><span>آخر حفظ ناجح</span><span class="v" style="font-size:.8rem">${LASTSYNC?esc(LASTSYNC.toLocaleTimeString("ar-KW",{hour:"2-digit",minute:"2-digit"})):"—"}</span></div>
      <div style="height:12px"></div>
      <button class="btn ghost" id="logout">خروج</button>
      <p class="hint" style="margin:10px 0 0">كل حفظ يُرفع للسحابة تلقائياً ويظهر للزوار مباشرة.</p>
    </div>`;
  renderMatchAdmin();
  if(canStaff()) wireStaff();
  wireSquads();
  wireKits();
  wireRefs();
  wireRefCrews();
  wireTot();
  const esc2=$("#scGo");
  if(esc2) esc2.onclick=async()=>{
    const r=$("#scRound").value; if(!r) return;
    busy(esc2,true,"جارٍ الاحتساب…");
    const res=await scoreRound(r);
    busy(esc2,false);
    toast(res.msg, res.ok?"ok":"err");
    if(res.ok) renderAdmin();
  };
  const lo=$("#logout");
  if(lo) lo.onclick=async()=>{
    if(fbAuth && FBUSER){ try{ await fbAuth.signOut(); }catch(e){} }
    isAdmin=false; isOwner=false; MYROLE="";
    $("#adminBtn").classList.remove("on"); ADMIN_REVEAL=false; ADMIN_HINT.set(false); paintAdminBtn(); paintFantasyTab(); go("home");
  };
}

let RESETMSG="", LOGIN_EM="";
function __admRenderAdmin(){
  if(isAdmin) ensureXLSX().catch(()=>{});   /* تسخين مكتبة الإكسل قبل أن يختار المدير ملفاً */
  if(!isAdmin){
    const wrongUser = !!FBUSER;
    $("#v-admin").innerHTML=`
      <h2 class="sec">دخول فريق العمل</h2>
      <div class="card pad">
        ${SYNCMSG?`<div class="formerr">${esc(SYNCMSG)}</div>`:""}
        ${RESETMSG?`<div class="formok">${esc(RESETMSG)}</div>`:""}
        ${wrongUser?`<div class="formerr">هذا الحساب غير مصرّح له بالتحرير بعد.</div>
          <div class="uidbox">
            <label class="lb">أرسل هذا الرمز للمالك ليضيفك لفريق العمل</label>
            <code id="myUid">${esc(FBUSER.uid)}</code>
            <button class="btn ghost" id="copyUid">نسخ الرمز</button>
          </div>`:""}
        <label class="lb">البريد الإلكتروني</label>
        <input type="text" id="em" autocomplete="username" inputmode="email" dir="ltr" value="${esc(LOGIN_EM)}">
        <div style="height:10px"></div>
        <label class="lb">كلمة المرور</label>
        <input type="password" id="pw" autocomplete="current-password" dir="ltr">
        <div style="height:14px"></div>
        <button class="btn" id="loginBtn">دخول</button>
        <button type="button" class="linkbtn" id="forgotPw">نسيت كلمة المرور؟</button>
        ${wrongUser?'<div style="height:8px"></div><button class="btn ghost" id="signOut">خروج</button>':""}
        <p class="hint" style="margin:12px 0 0">حالة السحابة: ${esc(FBSTATE)} · القراءة مفتوحة للزوار، والكتابة محصورة بحسابك وحده.</p>
      </div>`;
    const doLogin=async()=>{
      SYNCMSG="";
      if(!fbAuth){ SYNCMSG="السحابة غير متاحة — افتح الموقع من نطاق منشور لا من ملف محلي."; renderAdmin(); return; }
      const em=$("#em").value.trim(), pw=$("#pw").value; LOGIN_EM=em; RESETMSG="";
      if(!em||!pw){ SYNCMSG="أدخل البريد وكلمة المرور."; renderAdmin(); return; }
      try{ await fbAuth.signInWithEmailAndPassword(em,pw); SYNCMSG=""; renderAdmin(); }
      catch(e){ SYNCMSG = AUTH_MSG[e.code] || ("تعذّر الدخول: "+(e.code||e.message)); renderAdmin(); }
    };
    $("#loginBtn").onclick=doLogin;
    /* نسيت كلمة المرور: رابط تغيير من Firebase إلى البريد المكتوب (نفس الرسالة دائماً حتى لا يُكشف إن كان البريد مسجلاً) */
    $("#forgotPw").onclick=async()=>{
      SYNCMSG=""; RESETMSG=""; LOGIN_EM=$("#em").value.trim();
      if(!fbAuth){ SYNCMSG="السحابة غير متاحة — افتح الموقع من نطاق منشور لا من ملف محلي."; renderAdmin(); return; }
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(LOGIN_EM)){ SYNCMSG="اكتب بريدك الإلكتروني أولاً ثم اضغط «نسيت كلمة المرور؟»."; renderAdmin(); return; }
      const b=$("#forgotPw"); b.disabled=true; b.textContent="جارٍ الإرسال…";
      try{ fbAuth.languageCode="ar"; await fbAuth.sendPasswordResetEmail(LOGIN_EM.toLowerCase()); }
      catch(e){ if(e && (e.code==="auth/too-many-requests" || e.code==="auth/network-request-failed")){ SYNCMSG = e.code==="auth/too-many-requests" ? "محاولات كثيرة — جرّب بعد قليل." : "تعذّر الاتصال — تأكد من الإنترنت."; renderAdmin(); return; } }
      RESETMSG="إذا كان هذا البريد مسجلاً في فريق العمل فسيصلك رابط لتغيير كلمة المرور خلال دقائق — افحص البريد الوارد ومجلد الرسائل غير المرغوبة (Junk).";
      renderAdmin();
    };
    $("#pw").onkeydown=e=>{ if(e.key==="Enter") doLogin(); };
    const so=$("#signOut"); if(so) so.onclick=()=>fbAuth.signOut();
    const cu=$("#copyUid");
    if(cu) cu.onclick=async()=>{
      try{ await navigator.clipboard.writeText(FBUSER.uid); toast("نُسخ الرمز ✅","ok"); }
      catch(e){ toast("انسخ الرمز يدوياً","err"); }
    };
    return;
  }
  if(!isOwner){ renderEditorAdmin(); return; }
  $("#v-admin").innerHTML=`
    <h2 class="sec">شعارات الأندية</h2>
    <p class="hint">ارفع الشعار الرسمي لكل نادٍ (PNG أو SVG بخلفية شفافة). يظهر فوراً في الجدول وبطاقات المباريات وصفحة النادي. ارفع فقط ما لديك إذن باستخدامه.</p>
    <div class="logogrid">${CLUBS.map(c=>`
      <label class="logocell">
        ${crest(c,true)}
        <div class="nm">${esc(c)}</div>
        <div class="up">${LOGOS[c]?"تغيير الشعار":"+ رفع شعار"}</div>
        <input type="file" accept="image/*" data-club="${esc(c)}">
      </label>`).join("")}</div>

    ${squadsSectionHTML()}

    <h2 class="sec">الزيارات</h2>
    <p class="hint">عدد الجلسات اليومية على الموقع. جلسة واحدة لكل زائر في كل مرة يفتح فيها الموقع من جديد.</p>
    <div class="card pad" id="visBox">
      <button class="btn ghost" id="visLoad">اعرض آخر ٣٠ يوماً</button>
    </div>

    <h2 class="sec">تحدي التوقعات</h2>
    <p class="hint">بعد إدخال نتائج الجولة كاملة، احتسب نقاط الجمهور. الاحتساب يقرأ توقعات المشتركين ويحدّث جداول الترتيب — وإعادته على نفس الجولة آمنة ولا تُضاعف النقاط.</p>
    <div class="card pad">
      <div class="stat"><span>مشتركون في الترتيب</span><span class="v">${BOARD&&BOARD.rows?Object.keys(BOARD.rows).length:0}</span></div>
      <div class="stat"><span>آخر جولة محتسبة</span><span class="v">${BOARD&&BOARD.lastRound?BOARD.lastRound:"—"}</span></div>
      <div style="height:12px"></div>
      ${(()=>{
        const rs=[...new Set(MATCHES.map(m=>+m.round||0))].filter(Boolean).sort((a,b)=>a-b);
        const cur = ROUNDMETA;
        const auto = openRound();
        /* الجولة المحفوظة أُقفلت وجاءت بعدها جولة: الافتراضي الجولة القادمة وإقفالها (منصور 2026-10-07) */
        const nextUp = !!(auto && cur && cur.lockAt && Date.now() >= cur.lockAt && auto.round > +cur.round);
        const def = nextUp ? auto.round : cur ? +cur.round : (auto ? auto.round : (rs[rs.length-1]||1));
        const defMs = nextUp ? auto.lockAt : cur && cur.lockAt ? cur.lockAt : (auto && auto.lockAt ? auto.lockAt : null);
        const dISO = defMs ? new Date(defMs - new Date().getTimezoneOffset()*60000).toISOString() : "";
        return `
        <div class="stat"><span>الحالة الآن</span><span class="v" style="font-size:.8rem">${
          cur ? (cur.open ? `مفتوحة · الجولة ${cur.round}` : `مغلقة · الجولة ${cur.round}`) : "لم تُفتح أي جولة"}</span></div>
        <div class="stat"><span>الإقفال المحفوظ</span><span class="v" style="font-size:.78rem">${
          cur && cur.lockAt ? esc(stampLabel(cur.lockAt)) : "—"}</span></div>
        <div style="height:12px"></div>
        <div class="fgrid" style="grid-template-columns:minmax(0,1fr)">
          <div class="fld"><label>جولة التوقعات</label>
            <select id="opRound">${rs.map(r=>`<option value="${r}" ${r===def?"selected":""}>الجولة ${r}</option>`).join("")}</select></div>
          <div class="fld"><label>تاريخ ووقت الإقفال</label>
            <input type="datetime-local" id="opLock" value="${dISO.slice(0,16)}"></div>
        </div>
        <p class="hint" style="margin:0 0 10px">يُملأ تلقائياً من أول مباراة في الجولة، وتقدر تعدّله كما تشاء — تمديداً أو تقديماً.</p>
        <div style="display:flex;gap:8px">
          <button class="btn" id="opGo" style="flex:1">فتح التوقعات</button>
          <button class="btn ghost" id="opShut" style="flex:none;width:auto;padding-inline:18px">أغلقها الآن</button>
        </div>
        <div style="height:16px"></div>`;
      })()}
      <div class="fld"><label>الجولة</label>
        <select id="scRound">${[...new Set(MATCHES.filter(m=>!isUpcoming(m)).map(m=>+m.round||0))]
          .sort((a,b)=>b-a).map(r=>`<option value="${r}">الجولة ${r}</option>`).join("")}</select></div>
      <div style="height:10px"></div>
      <button class="btn" id="scGo">احتسب نقاط الجمهور</button>
    </div>

    ${BOARD&&BOARD.rows&&Object.keys(BOARD.rows).length?`
    <h2 class="sec">مشتركو التوقعات</h2>
    <p class="hint">الإخفاء يشيل المشترك من الجدول العام ويحتفظ بنقاطه — للأسماء المسيئة. يمكن إظهاره في أي وقت.</p>
    <div class="card pad">
      <div class="fld"><label>بحث بالاسم</label><input type="text" id="fanFind" placeholder="اكتب جزءاً من الاسم"></div>
      <div id="fanList">${fanListHTML("")}</div>
    </div>`:""}

    ${officeSectionHTML()}

    ${staffSectionHTML()}

    <h2 class="sec">المزامنة السحابية</h2>
    <div class="card pad">
      ${SYNCMSG?`<div class="formerr">${esc(SYNCMSG)}</div>`:""}
      <div class="stat"><span>الحالة</span><span class="v" style="font-size:.82rem">${esc(FBSTATE)}</span></div>
      <div class="stat"><span>الحساب</span><span class="v" style="font-size:.78rem;direction:ltr">${esc(FBUSER?FBUSER.email:"—")}</span></div>
      <div class="stat"><span>وثيقة الموسم</span><span class="v" style="font-size:.78rem;direction:ltr">seasons/${esc(seasonId())}</span></div>
      <div style="height:12px"></div>
      <div class="stat"><span>حجم الصور المخزّنة</span><span class="v" id="akb" style="font-size:.82rem">${assetsKB()} ك.ب من 1024</span></div>
      <div class="stat"><span>آخر مزامنة ناجحة</span><span class="v" style="font-size:.8rem">${LASTSYNC?esc(LASTSYNC.toLocaleTimeString("ar-KW",{hour:"2-digit",minute:"2-digit"})):"—"}</span></div>
      <div style="height:12px"></div>
      <button class="btn" id="pushCloud">⬆ رفع البيانات الحالية إلى السحابة</button>
      <div style="height:8px"></div>
      <button class="btn ghost" id="recompress">🗜 إعادة ضغط كل الصور</button>
      <div style="height:8px"></div>
      <button class="btn ghost" id="diagBtn">🔍 فحص الاتصال بالسحابة</button>
      <div style="height:14px"></div>
      <div class="stat"><span>مصدر الشعارات الحالي</span><span class="v" style="font-size:.78rem">${esc(ASSETSRC)}</span></div>
      <div style="height:10px"></div>
      <button class="btn" id="dlAssets">⬇ تحميل ملف الشعارات (assets.json)</button>
      <div style="height:8px"></div>
      <label class="btn ghost" style="display:block;cursor:pointer;text-align:center">⬆ استيراد ملف شعارات
        <input type="file" id="upAssets" accept=".json" style="display:none"></label>
      <p class="hint" style="margin:10px 0 0">لتثبيت الشعارات نهائياً: نزّل <b>assets.json</b> وارفعه إلى مستودع GitHub بجانب index.html. عندها تظهر لكل زائر بلا اعتماد على السحابة أو على متصفحك.</p>
      <div id="diagOut"></div>
      <div style="height:8px"></div>
      <button class="btn ghost" id="pullCloud">⬇ جلب أحدث نسخة من السحابة</button>
      <p class="hint" style="margin:10px 0 0">كل حفظ أو تعديل يُرفع تلقائياً. هذان الزران للحالات الاستثنائية فقط.</p>
    </div>

    <h2 class="sec">إدارة المباريات</h2>
    <p class="hint">أضف مباراة كاملة يدوياً: الجولة والملعب والتاريخ والوقت، ثم الأهداف والبطاقات وركلات الجزاء بنفس حقول ملف الإكسل. النتيجة تُحسب من الأهداف.</p>
    <div id="matchAdmin"></div>

    ${refsAdminHTML()}
    ${refCrewsHTML()}

    <h2 class="sec">لعبة الفانتسي</h2>
    <div class="card pad">
      <div class="stat"><span>الحالة</span><span class="v" style="font-size:.85rem">${FANTASY_OPEN?"مُشهرة للجمهور":"مخفية — تظهر لك وحدك"}</span></div>
      <div style="height:12px"></div>
      <button class="btn${FANTASY_OPEN?" ghost":""}" id="fantasyToggle">${FANTASY_OPEN?"🔒 إخفاء اللعبة عن الجمهور":"🚀 إشهار اللعبة للجمهور"}</button>
      <div style="height:8px"></div>
      <button class="btn ghost" id="fantasyOpenBtn">↗ فتح لوحة إدارة الفانتسي</button>
      <p class="hint" style="margin:12px 0 0">${FANTASY_OPEN
        ? "اللعبة ظاهرة الآن لكل زائر: يشوف تبويب «فانتسي» ويدخلها بلا رمز. الإخفاء يرجّعها لبوابة الرمز فوراً."
        : "الإشهار يُظهر تبويب «فانتسي» لكل الزوار ويرفع بوابة الرمز عن اللعبة. يُحفظ في السحابة فيسري على كل الأجهزة خلال ثوانٍ."}</p>
    </div>

    ${totAdminHTML()}

    ${kitsAdminHTML()}

    ${eventsAdminHTML()}

    ${backupsHTML()}

    <h2 class="sec">بيانات الموسم</h2>
    <div class="card pad">
      <div class="stat"><span>المصدر الحالي</span><span class="v" style="font-size:.8rem">${esc(DATA_SOURCE)}</span></div>
      <div class="stat"><span>آخر تحديث للبيانات</span><span class="v" style="font-size:.8rem;direction:ltr">${esc(DATA_UPDATED.slice(0,16).replace("T"," "))}</span></div>
      <div class="stat"><span>المحتوى</span><span class="v">${MATCHES.length} مباراة · ${GOALS.length} هدفاً</span></div>
      <div class="stat"><span>آخر من حفظ</span><span class="v" style="font-size:.78rem;direction:ltr">${esc(DATA_BY||"—")}</span></div>
      <div style="height:14px"></div>
      <label class="btn" style="display:block;cursor:pointer;text-align:center">⬆ رفع ملف الجولة (xlsx أو json)
        <input type="file" id="dataUp" accept=".xlsx,.xlsm,.json" style="display:none"></label>
      <div style="height:8px"></div>
      <button class="btn ghost" id="dlJSON">⬇ تحميل data.json للنشر على الموقع</button>
      <div style="height:8px"></div>
      <button class="btn ghost" id="resetData">إرجاع البيانات المضمّنة</button>
      <p class="hint" style="margin-top:10px">ارفع ملف الاستوديو التحليلي كما هو — يقرأ الموقع أوراق «سجل الأهداف» و«سجل المباريات» و«سجل ركلات الجزاء» و«الإعدادات»، ويعرض تقرير تحقق قبل الاعتماد. النتائج تُحتسب من الأهداف لا من خلايا الصيغ.</p>
    </div>
    <div id="dataReport"></div>

    <h2 class="sec">صور الهدافين</h2>
    <div class="card pad" style="margin-bottom:12px">
      <label class="toggle">
        <input type="checkbox" id="photosOn" ${PHOTOSON?"checked":""}>
        <span>إظهار صور اللاعبين في الموقع</span>
      </label>
      <p class="hint" style="margin:8px 0 0">أطفئه لتظهر كل الأسماء بحروفها الأولى بشكل موحّد — أنظف من خليط صور وحروف حين لا تكتمل الصور.</p>
      <div style="height:14px"></div>
      <label class="lb">حجم الصورة — <b id="pvVal">${PAVSIZE}px</b></label>
      <input type="range" id="pavsize" class="rng" min="26" max="46" step="2" value="${PAVSIZE}">
      <div style="height:12px"></div>
      <div class="prevrow">${scorers().filter(x=>x.g>0).slice(0,10).map(x=>pav(x.n,0,true)).join("")}</div>
    </div>
    ${Object.keys(PHOTOS).length?`
    <h2 class="sec">ضبط تأطير الوجوه</h2>
    <p class="hint">التكبير يقرّب الوجه، والأفقي والرأسي يحرّكان مركز القص. المعاينة حيّة.</p>
    <div class="card pad">${Object.keys(PHOTOS).map(n=>{
      const a=PAV[n]||{z:100,x:50,y:50};
      return `<div class="tune">
        <div class="tprev" id="tp-${esc(n)}">${pav(n,54)}</div>
        <div class="tbody">
          <div class="tnm">${esc(n)}</div>
          <div class="trow"><span>تكبير</span><input type="range" class="rng" data-tune="${esc(n)}|z" min="100" max="260" step="5" value="${a.z}"><span id="tv-z-${esc(n)}">${a.z}%</span></div>
          <div class="trow"><span>أفقي</span><input type="range" class="rng" data-tune="${esc(n)}|x" min="0" max="100" step="2" value="${a.x}"><span id="tv-x-${esc(n)}">${a.x}%</span></div>
          <div class="trow"><span>رأسي</span><input type="range" class="rng" data-tune="${esc(n)}|y" min="0" max="100" step="2" value="${a.y}"><span id="tv-y-${esc(n)}">${a.y}%</span></div>
        </div>
        <button class="tdel" data-unphoto="${esc(n)}" title="حذف الصورة">✕</button>
      </div>`;}).join("")}</div>
    <div style="height:14px"></div>`:""}
    <p class="hint">ارفع صورة كل لاعب. الوجه في الوسط أفضل، وإن لم يكن فاضبطه بالمنزلقات أعلاه. ارفع فقط ما لديك حق استخدامه.</p>
    <div class="photogrid">${(()=>{const L=scorers().filter(x=>x.g>0).slice(0,24);
      return L.length?L.map(x=>`<label class="photocell">
        <div style="display:flex;justify-content:center">${pav(x.n,54,true)}</div>
        <div class="nm">${esc(x.n)}</div>
        <div class="up">${PHOTOS[x.n]?"تغيير":"+ رفع صورة"}</div>
        <input type="file" accept="image/*" data-photo="${esc(x.n)}" style="display:none">
      </label>`).join(""):'<span style="color:var(--slate);font-size:.85rem">لا يوجد هدافون بعد.</span>';})()}</div>
    <div style="height:10px"></div>
    <button class="btn ghost" id="clearPhotos">حذف كل صور اللاعبين</button>

    <h2 class="sec">شعار الدوري</h2>
    <div class="card pad">
      <div style="display:flex;align-items:center;gap:14px;background:var(--navy-800);border-radius:10px;padding:14px">
        <img src="${LEAGUE}" alt="شعار الدوري" style="height:46px;width:46px;object-fit:contain;background:#fff;border-radius:10px;padding:3px">
        <div style="flex:1;font-size:.78rem;color:var(--slate)">يظهر في ترويسة الموقع. ارفع نسخة أوضح أو بخلفية شفافة إن توفرت.</div>
      </div>
      <div style="height:12px"></div>
      <label class="btn ghost" style="display:block;cursor:pointer">تغيير شعار الدوري
        <input type="file" id="leagueUp" accept="image/*" style="display:none"></label>
      <div style="height:8px"></div>
      <button class="btn ghost" id="leagueReset">إعادة الشعار الأصلي</button>
    </div>

    <h2 class="sec">شعار العلامة</h2>
    <div class="card pad">
      <div style="display:flex;align-items:center;gap:14px;background:var(--navy-800);border-radius:10px;padding:14px">
        <img src="${BRAND}" alt="brand" style="height:46px">
        <div style="flex:1;font-size:.78rem;color:var(--slate)">يظهر في الصفحة الرئيسية وفي كل صورة أو تقرير مُصدَّر — لحفظ الحقوق.</div>
      </div>
      <div style="height:12px"></div>
      <label class="btn ghost" style="display:block;cursor:pointer">تغيير شعار العلامة
        <input type="file" id="brandUp" accept="image/*" style="display:none"></label>
      <div style="height:8px"></div>
      <button class="btn ghost" id="brandReset">إعادة الشعار الأصلي</button>
    </div>

    <h2 class="sec">تنسيق حجم الشعارات</h2>
    <div class="card pad">
      <label class="lb">الحجم العام لكل الشعارات — <b id="gsVal">${GSCALE}%</b></label>
      <input type="range" id="gscale" min="60" max="140" step="5" value="${GSCALE}" class="rng">
      <div style="height:14px"></div>
      <label class="lb" style="display:flex;align-items:center;gap:9px;cursor:pointer">
        <input type="checkbox" id="logobg" ${LOGOBG?"checked":""} style="width:18px;height:18px;accent-color:var(--sky)">
        لوحة بيضاء خلف الشعار (تُستحسن للشعارات الداكنة)
      </label>
      <div style="height:16px"></div>
      <div class="prevrow">${CLUBS.map(c=>crest(c)).join("")}</div>
      <p class="hint" style="margin:10px 0 0">معاينة حيّة — الشعارات المرفوعة فقط تتأثر بالحجم.</p>
    </div>

    ${Object.keys(LOGOS).length?`
    <h2 class="sec">ضبط دقيق لكل نادٍ</h2>
    <div class="card pad">${Object.keys(LOGOS).map(c=>`
      <div class="fine">
        ${crest(c)}
        <span class="fnm">${esc(c)}</span>
        <input type="range" class="rng" data-fine="${esc(c)}" min="60" max="160" step="5" value="${LSCALE[c]??100}">
        <span class="fval" id="fv-${esc(c)}">${LSCALE[c]??100}%</span>
      </div>`).join("")}</div>`:""}

    <h2 class="sec">إعدادات الموسم</h2>
    <div class="card pad">
      <label class="lb">آخر تحديث (يظهر أسفل كل صورة مُصدَّرة)</label>
      <input type="text" id="luInput" value="${esc(LASTUPDATE)}">
      <div style="height:10px"></div>
      <button class="btn ghost" id="clearLogos">حذف كل الشعارات المرفوعة</button>
      <div style="height:8px"></div>
      <button class="btn ghost" id="logout">خروج من وضع المدير</button>
    </div>

    <div class="note" style="margin-top:18px">
      <b>تنبيه قانوني:</b> شعارات الأندية علامات تجارية مسجّلة. إن كان الهدف عرض المشروع على اتحاد الكرة لاحقاً، احصل على إذن كتابي من كل نادٍ قبل النشر العام — الملف النظيف قانونياً يرفع قيمة المشروع أكثر من أي ميزة تقنية.
    </div>`;

  document.querySelectorAll('.logocell input[type=file]').forEach(inp=>{
    inp.onchange=async e=>{
      const f=e.target.files[0]; if(!f) return;
      const r=await takeImage(f,160,0.9,"شعار "+inp.dataset.club);
      if(!r.url){ SYNCMSG=r.msg; renderAdmin(); return; }
      LOGOS[inp.dataset.club]=r.url;
      renderAdmin(); renderAll();
      const ok=await persist();
      if(ok===true){ LASTSYNC=new Date(); toast(r.msg+" · حُفظ ✅","ok"); }
      else if(ok==="pending") toast(SYNCMSG,"busy");
      else toast(SYNCMSG||"تعذّر الحفظ في السحابة","err");
      renderAdmin();
    };
  });
  renderMatchAdmin();
  document.querySelectorAll("[data-photo]").forEach(inp=>{
    inp.onchange=async e=>{ const f=e.target.files[0]; if(!f) return;
      const n=inp.dataset.photo;
      const r=await takeImage(f,220,0.85,"صورة "+n);
      if(!r.url){ SYNCMSG=r.msg; renderAdmin(); return; }
      PHOTOS[n]=r.url; PAV[n]=PAV[n]||{z:100,x:50,y:50};
      renderAdmin(); renderAll();
      const ok=await persist();
      if(ok===true){ LASTSYNC=new Date(); toast(r.msg+" · حُفظ ✅","ok"); }
      else if(ok==="pending") toast(SYNCMSG,"busy");
      else toast(SYNCMSG||"تعذّر الحفظ في السحابة","err");
      renderAdmin(); };
  });
  const po=$("#photosOn");
  if(po) po.onchange=e=>{ PHOTOSON=e.target.checked; persist(); renderAdmin(); renderAll(); };
  const pv=$("#pavsize");
  if(pv){ pv.oninput=e=>{ PAVSIZE=+e.target.value; $("#pvVal").textContent=PAVSIZE+"px"; };
          pv.onchange=()=>{ persist(); renderAdmin(); renderAll(); }; }
  document.querySelectorAll("[data-tune]").forEach(r=>{
    r.oninput=()=>{
      const [n,k]=r.dataset.tune.split("|");
      PAV[n]=PAV[n]||{z:100,x:50,y:50};
      PAV[n][k]=+r.value;
      const lab=$("#tv-"+k+"-"+CSS.escape(n)); if(lab) lab.textContent=r.value+"%";
      const prev=$("#tp-"+CSS.escape(n));
      if(prev){ const img=prev.querySelector("img"); if(img) img.style.cssText=pavStyle(n); }
    };
    r.onchange=()=>{ persist(); renderAll(); };
  });
  document.querySelectorAll("[data-unphoto]").forEach(b=>b.onclick=()=>{
    const n=b.dataset.unphoto;
    delete PHOTOS[n]; delete PAV[n];
    persist(); renderAdmin(); renderAll(); });
  const cp=$("#clearPhotos");
  if(cp) cp.onclick=()=>{ if(confirm("حذف كل صور اللاعبين؟")){ PHOTOS={}; PAV={}; persist(); renderAdmin(); renderAll(); } };
  const du=$("#dataUp");
  if(du) du.onchange=e=>{ const f=e.target.files[0]; if(f) readDataFile(f); };
  wireKits();
  wireRefs();
  wireRefCrews();
  wireTot();
  const eva=$("#evAdd");
  if(eva) eva.onclick=async()=>{
    busy(eva,true,"جارٍ الحفظ…");
    const ok=await addEvent();
    busy(eva,false);
    if(ok===true){ LASTSYNC=new Date(); toast("أُضيفت المناسبة ✅","ok"); renderAll(); renderAdmin(); }
    else if(ok===false) { /* رسالة الخطأ عُرضت */ }
    else toast(SYNCMSG||"حُفظت محلياً، لكن تعذّر الحفظ في السحابة","err");
  };
  document.querySelectorAll("[data-evdel]").forEach(b=>b.onclick=async()=>{
    if(!confirm("حذف هذه المناسبة؟")) return;
    busy(b,true,"…");
    const ok=await delEvent(+b.dataset.evdel);
    busy(b,false);
    if(ok===true){ LASTSYNC=new Date(); toast("حُذفت المناسبة","ok"); renderAll(); renderAdmin(); }
    else toast(SYNCMSG||"تعذّر الحذف","err");
  });
  paintBackups();
  const bkr=$("#bkRefresh"); if(bkr) bkr.onclick=()=>paintBackups();
  const dj=$("#dlJSON"); if(dj) dj.onclick=downloadJSON;
  const rd=$("#resetData");
  if(rd) rd.onclick=async()=>{
    if(!confirm("إرجاع البيانات المضمّنة في الملف؟")) return;
    /* إرجاع كامل: التشكيلات والتبديلات تُمسح هنا عمداً — تُمرَّر فارغة صراحةً */
    applyData(JSON.parse(JSON.stringify({season:SEED.SEASON,clubs:SEED.CLUBS,matches:SEED.MATCHES,goals:SEED.GOALS,pens:SEED.PENS,cards:SEED.CARDS||[],lineups:[],subs:[]})), "مضمّنة في الملف");
    try{ await window.storage.delete("zain_data"); }catch(e){}
    renderAdmin();
  };
  const lu=$("#leagueUp");
  if(lu) lu.onchange=async e=>{ const f=e.target.files[0]; if(!f) return;
    const r=await takeImage(f,180,0.9,"شعار الدوري");
    if(!r.url){ SYNCMSG=r.msg; renderAdmin(); return; }
    LEAGUE=r.url; paintHeader(); renderAdmin();
    const ok=await persist();
    if(ok===true){ LASTSYNC=new Date(); toast(r.msg+" · حُفظ ✅","ok"); }
    else if(ok==="pending") toast(SYNCMSG,"busy");
    else toast(SYNCMSG||"تعذّر الحفظ في السحابة","err");
    renderAdmin(); };
  const lr=$("#leagueReset");
  if(lr) lr.onclick=()=>{ LEAGUE=LEAGUE_DEFAULT; persist(); paintHeader(); renderAdmin(); };
  const bu=$("#brandUp");
  if(bu) bu.onchange=async e=>{ const f=e.target.files[0]; if(!f) return;
    const r=await takeImage(f,300,0.9,"شعار العلامة");
    if(!r.url){ SYNCMSG=r.msg; renderAdmin(); return; }
    BRAND=r.url; renderAdmin(); renderAll(); paintFoot();
    const ok=await persist();
    if(ok===true){ LASTSYNC=new Date(); toast(r.msg+" · حُفظ ✅","ok"); }
    else if(ok==="pending") toast(SYNCMSG,"busy");
    else toast(SYNCMSG||"تعذّر الحفظ في السحابة","err");
    renderAdmin(); };
  const br=$("#brandReset");
  if(br) br.onclick=()=>{ BRAND=BRAND_DEFAULT; persist(); renderAdmin(); renderAll(); paintFoot(); };
  wireAdminIO();
  wireSquads();
  wireStaff();
  const vl=$("#visLoad");
  if(vl) vl.onclick=async()=>{
    busy(vl,true,"جارٍ التحميل…");
    const rows=await loadVisits(30);
    busy(vl,false);
    const tot=rows.reduce((s,r)=>s+r.v,0);
    const act=rows.filter(r=>r.v>0).length;
    const mx=Math.max(1,...rows.map(r=>r.v));
    const last7=rows.slice(-7).reduce((s,r)=>s+r.v,0);
    $("#visBox").innerHTML=`
      <div class="stat"><span>آخر ٣٠ يوماً</span><span class="v">${tot} زيارة</span></div>
      <div class="stat"><span>آخر ٧ أيام</span><span class="v">${last7} زيارة</span></div>
      <div class="stat"><span>اليوم</span><span class="v">${rows[rows.length-1].v}</span></div>
      <div class="stat"><span>متوسط اليوم النشط</span><span class="v">${act?Math.round(tot/act):0}</span></div>
      <div style="height:14px"></div>
      <div class="spark">${rows.map(r=>`<i style="height:${Math.max(3,Math.round(r.v/mx*100))}%" title="${r.d}: ${r.v}"></i>`).join("")}</div>
      <p class="hint" style="margin:10px 0 0">العدّاد يبدأ من يوم رفع هذا الملف — ما قبله يظهر أصفاراً لأنه لم يُسجَّل.</p>`;
  };
  /* تغيير الجولة يملأ الإقفال من أول مباراة فيها (يبقى قابلاً للتعديل) */
  const opr=$("#opRound");
  if(opr) opr.onchange=()=>{
    const ts=MATCHES.filter(m=>(+m.round||0)===+opr.value).map(kickoffTS).filter(t=>t!==null);
    if(ts.length) $("#opLock").value=new Date(Math.min(...ts)-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
  };
  const op=$("#opGo");
  if(op) op.onclick=async()=>{
    const r=$("#opRound").value, v=$("#opLock").value;
    if(!v){ toast("حدد تاريخ ووقت الإقفال","err"); return; }
    busy(op,true,"جارٍ الفتح…");
    const res=await publishRound(r, new Date(v).getTime(), true);
    busy(op,false);
    toast(res.msg, res.ok?"ok":"err");
    if(res.ok) renderAdmin();
  };
  const osh=$("#opShut");
  if(osh) osh.onclick=async()=>{
    const r=$("#opRound").value;
    busy(osh,true,"…");
    const res=await publishRound(r, Date.now(), false);
    busy(osh,false);
    toast(res.msg, res.ok?"ok":"err");
    if(res.ok) renderAdmin();
  };
  const ff=$("#fanFind");
  if(ff) ff.oninput=()=>{ $("#fanList").innerHTML=fanListHTML(ff.value.trim()); wireFanList(); };
  wireFanList();
  const sc=$("#scGo");
  if(sc) sc.onclick=async()=>{
    const r=$("#scRound").value; if(!r) return;
    busy(sc,true,"جارٍ الاحتساب…");
    const res=await scoreRound(r);
    busy(sc,false);
    toast(res.msg, res.ok?"ok":"err");
    if(res.ok) renderAdmin();
  };
  const gs=$("#gscale");
  if(gs){ gs.oninput=e=>{ GSCALE=+e.target.value; $("#gsVal").textContent=GSCALE+"%";
    document.querySelectorAll(".crest.has-logo img").forEach(img=>{
      const c=img.alt; img.style.transform=`scale(${((GSCALE/100)*((LSCALE[c]??100)/100)).toFixed(2)})`; });
    persist(); }; 
    gs.onchange=()=>{ renderAll(); }; }
  const bg=$("#logobg");
  if(bg) bg.onchange=e=>{ LOGOBG=e.target.checked; persist(); renderAdmin(); renderAll(); };
  document.querySelectorAll("[data-fine]").forEach(r=>{
    r.oninput=e=>{ const c=r.dataset.fine; LSCALE[c]=+e.target.value;
      $("#fv-"+c).textContent=LSCALE[c]+"%";
      document.querySelectorAll(".crest.has-logo img").forEach(img=>{
        if(img.alt===c) img.style.transform=`scale(${((GSCALE/100)*((LSCALE[c]??100)/100)).toFixed(2)})`; });
      persist(); };
    r.onchange=()=>renderAll();
  });
  $("#luInput").oninput=e=>{ LASTUPDATE=e.target.value; persist(); };
  $("#clearLogos").onclick=()=>{ if(confirm("حذف كل الشعارات المرفوعة؟")){ LOGOS={}; LSCALE={}; persist(); renderAdmin(); renderAll(); } };
  $("#logout").onclick=async()=>{
    if(fbAuth && FBUSER){ try{ await fbAuth.signOut(); }catch(e){} }
    isAdmin=false; $("#adminBtn").classList.remove("on"); ADMIN_REVEAL=false; ADMIN_HINT.set(false); paintAdminBtn(); paintFantasyTab(); go("home"); };
}


ADMX.renderAdmin = __admRenderAdmin;
ADMX.renderEditorAdmin = __admRenderEditorAdmin;
ADMX.rma = __admRenderMatchAdmin;

/* ===== محرّر المباراة (MX) =====
   يستبدل واجهة النموذج فقط: EDIT وvalidateEdit وsaveMatch وremoveMatchByKey كما هي.
   قائمة المباريات (EDIT=null) تبقى من renderMatchAdmin الأصلية. */
(function(){
  if(typeof renderMatchAdmin!=="function") return;
  const MX = window.MX = {tab:"match", side:"home", sel:null, q:"", sheet:null};
  const SV = {
    x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    save:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>',
    trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    swap:'<svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v14M7 18l-3-3M7 18l3-3" stroke="#3ecf8e"/><path d="M17 20V6M17 6l-3 3M17 6l3 3" stroke="#e5484d"/></svg>',
    flip:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h11l-3-3M17 17H6l3 3"/></svg>',
    search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    pin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    whistle:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="14" r="5"/><path d="M13.5 11.5 21 8V5l-9.5 4.2"/></svg>',
    shield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/></svg>',
    warn:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 8v5M12 16.5v.5"/><circle cx="12" cy="12" r="9"/></svg>',
    chance:'<svg viewBox="0 0 24 24" fill="none" stroke="#ffb547" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="1" fill="#ffb547"/></svg>',
    var:'<svg viewBox="0 0 24 24" fill="none"><rect x="2.5" y="5" width="19" height="13" rx="2.5" stroke="#9fb4ff" stroke-width="2"/><text x="12" y="14.6" text-anchor="middle" font-size="7.2" font-weight="800" fill="#9fb4ff" font-family="Arial">VAR</text></svg>',
    note:'<svg viewBox="0 0 24 24" fill="none" stroke="#8FA6C4" stroke-width="2" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4V5z"/><path d="M8 9.5h8M8 12.5h5" stroke-linecap="round"/></svg>',
    tv:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 21h8M9 3l3 3 3-3"/></svg>',
    pen:'<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9.2" fill="#fff" stroke="#0B1F3A" stroke-width="1.5"/><text x="12" y="16" text-anchor="middle" font-size="11" font-weight="800" fill="#0B1F3A" font-family="Arial">P</text></svg>'
  };
  const hexRgb=h=>{ const c=String(h||"").replace("#",""); if(c.length!==6) return "24,120,190"; return [0,2,4].map(i=>parseInt(c.slice(i,i+2),16)).join(","); };
  const sideClub=s=>EDIT.match[s]||"";
  const sideOf=club=>club&&club===EDIT.match.home?"home":club&&club===EDIT.match.away?"away":"";
  const rgbOf=club=>{ try{ return clubAccent(club).rgb; }catch(e){ return hexRgb(kitOf(club).bg); } };
  const initials=n=>esc(String(n||"").trim().split(/\s+/).slice(0,2).map(w=>w[0]||"").join(""));
  const face=(n,club)=>{ const cut=(typeof photoCut==="function"&&n&&club)?photoCut(n,club):null;
    const e=cut?null:squadEntriesOf(club,[club]).find(x=>x.n===n);
    return `<span class="mx-face${cut?"":" jer"}">${cut?`<img src="${cut}_f.webp?v=39" alt="" loading="lazy" decoding="async">`:jerseySVG(club, e&&e.s, e&&/^(GK|G)$/i.test(e.p||""))}</span>`; };
  const crestOr=c=>c?crest(c):`<span class="mx-crest-ph">${SV.shield}</span>`;
  /* كشف أندية الدرجة الأولى من المحرّر (منصور 2026-10-19): إضافة لاعب وتعديل رقمه ومركزه — يُحفظ مع المباراة */
  const SQ_POS=[["GK","حارس"],["CB","مدافع"],["CM","وسط"],["ST","مهاجم"]];
  const posKey=p=>({G:"GK",D:"CB",M:"CM",F:"ST"})[POS_MAIN[String(p||"").toUpperCase()]]||"";
  const sqAddHTML=club=>{
    const sel=`<select data-msqp><option value="">المركز</option>${SQ_POS.map(([k,t])=>`<option value="${k}">${t}</option>`).join("")}</select>`;
    return `<div class="mx-sqadd"><input data-msqn placeholder="لاعب جديد"><input data-msqs type="number" min="1" max="99" inputmode="numeric" placeholder="الرقم">${sel}<button class="mx-addb" data-msqadd="${esc(club)}">إضافة</button></div>
      <p class="mx-hint" style="margin:-4px 0 10px">اللاعب الجديد ينزل على الملعب مباشرة، واضغط رقم أي لاعب لتعديله.</p>`;
  };
  const starters=club=>{ const seen={},out=[]; (EDIT.lineup||[]).forEach(x=>{ if(x.club===club&&x.p&&!seen[x.p]){ seen[x.p]=1; out.push(x.p);} }); return out; };
  const roster=club=>{
    if(!club) return [];
    const used=[...starters(club), ...(EDIT.subs||[]).filter(s=>s.club===club).flatMap(s=>[s.in,s.out])];
    /* المخفيون (SQUAD_HIDE) لا يُعرضون للاختيار — إلا إن كانوا مسجّلين في هذه المباراة (مباراة قديمة) */
    const ent=squadEntriesOf(club,[club]).filter(e=>!isHidden(club,e.n) || used.includes(e.n));
    const names=new Set(ent.map(e=>e.n));
    /* أسماء مسجّلة في المباراة وليست في الكشف (قديمة/مكتوبة يدوياً) تبقى قابلة للاختيار */
    const extra=used.filter(n=>n&&!names.has(n));
    [...new Set(extra)].forEach(n=>ent.push({n, s:0, p:"", club}));
    return ent;
  };
  const posOf=(club,n)=>{ const e=squadEntriesOf(club,[club]).find(z=>z.n===n); return e?e.p:""; };
  const numOf=(club,n)=>{ const e=squadEntriesOf(club,[club]).find(z=>z.n===n); return e&&e.s?e.s:""; };
  const score=()=>{ const h=EDIT.match.home, a=EDIT.match.away; let hg=0,ag=0;
    (EDIT.goals||[]).forEach(g=>{ if(g.sc&&g.sc===h) hg++; else if(g.sc&&g.sc===a) ag++; }); return [hg,ag]; };
  const errTab=msg=>/^(الهدف|البطاقة|ركلة)/.test(msg)?"events":"match";

  /* ===================== الملعب ===================== */
  const PITCH_SVG=`<svg class="lines" viewBox="0 0 680 760" preserveAspectRatio="none" aria-hidden="true">
    ${Array.from({length:10},(_,i)=>`<rect x="0" y="${i*76}" width="680" height="38" fill="var(--pitch-grass2)" opacity=".55"/>`).join("")}
    <g fill="none" stroke="var(--pitch-line)" stroke-width="3">
      <rect x="18" y="18" width="644" height="724"/>
      <path d="M18 18H662"/><path d="M248.5 18A91.5 91.5 0 0 0 431.5 18"/>
      <rect x="138.5" y="577" width="403" height="165"/><rect x="248.5" y="687" width="183" height="55"/>
      <path d="M268 577A91.5 91.5 0 0 1 412 577"/>
    </g>
    <circle cx="340" cy="632" r="4" fill="var(--pitch-line)"/><circle cx="340" cy="18" r="4" fill="var(--pitch-line)"/>
  </svg>`;
  function slotsFor(club){
    const st=(EDIT.shapes||{})[club]||{f:"",pos:{}};
    const men=shapeMenFrom(starters(club), club);
    const form=normForm(st.f||autoForm(men));
    const pos=fullPos(st.pos, men);
    return {form, spots:shapeSlots(men, form).map(({p,x,y,n})=>{ const ov=pos[p.n]; return {p, x:ov?ov.x:x, y:ov?ov.y:y, n}; })};
  }
  function pitchHTML(club){
    const S=slotsFor(club), kit=kitOf(club);
    const spots=S.spots.map(({p,x,y})=>{
      const cut=photoCut(p.n, club);
      const gk=p.line==="G"; const k=gk?(gkKitOf(club,p.s)||kit):kit;
      /* حدود المواضع تُبقي البطاقة كاملة داخل الملعب */
      const xx=Math.max(9,Math.min(91,x)), yy=Math.max(9,Math.min(92,y));
      return `<div class="mx-spot${MX.sel===p.n?" sel":""}" data-sp="${esc(p.n)}" style="right:${xx}%;top:${yy}%">
        <span class="mx-pc${cut?"":" jer"}" style="${dotVars(k)}">${cut?`<img src="${cut}_f.webp?v=39" alt="" draggable="false">`:`<span class="mx-jer">${jerseySVG(club, p.s, gk)}</span>`}
          ${p.s&&cut?`<span class="no">${p.s}</span>`:""}<span class="nm">${esc(shortName(p.n))}</span></span></div>`;
    }).join("");
    return `<div class="mx-pitch" data-mxpitch="${esc(club)}">${PITCH_SVG}${spots||`<div class="mx-empty">اختر اللاعبين الأساسيين من القائمة — ينزلون على الملعب مباشرة</div>`}</div>`;
  }

  /* ===================== التبويبات ===================== */
  function tabMatch(){
    const m=EDIT.match, pool=refPool();
    const stHome=m.home&&typeof CLUB_INFO!=="undefined"&&CLUB_INFO[m.home]?CLUB_INFO[m.home].st:"";
    return `<div class="mx-card"><h3>المسابقة والجولة</h3>
        <div class="mx-chips">${COMPS.map(c=>`<button class="mx-chip${m.comp===c?" on":""}" data-mcomp="${esc(c)}">${esc(c)}</button>`).join("")}</div>
        ${isCupComp(m.comp)?`<span class="mx-lbl" style="margin-top:12px;display:block">الدور</span><div class="mx-chips">${CUP_STAGES.map(t=>`<button class="mx-chip${m.stage===t?" on":""}" data-mstage="${esc(t)}">${esc(t)}</button>`).join("")}</div>`:""}
        <div class="mx-grid g3" style="margin-top:14px">
          <div><span class="mx-lbl">الجولة</span><div class="mx-step"><button data-mround="-1" aria-label="أنقص">−</button>
            <input type="number" min="1" inputmode="numeric" data-mf="round" value="${esc(m.round)}"><button data-mround="1" aria-label="زد">+</button></div></div>
          <div><span class="mx-lbl">التاريخ</span><input type="date" data-mf="date" value="${esc(m.date)}"></div>
          <div><span class="mx-lbl">وقت الانطلاق</span><input type="time" data-mf="time" value="${esc(m.time)}"></div>
        </div></div>
      <div class="mx-card"><h3>البث</h3>
        <span class="mx-lbl">القناة الناقلة</span>
        <div class="mx-chips">${TV_LIST.map(t=>`<button class="mx-chip${m.tv===t?" on":""}" data-mtv="${esc(t)}">${esc(t)}</button>`).join("")}</div>
        <input data-mf="tv" value="${esc(m.tv||"")}" placeholder="أو اكتب اسم القناة" style="margin-top:10px"></div>
      <div class="mx-card"><h3>بثّ أحداث هذه المباراة<small>إشعار فوري لكل مشترك</small></h3>
        <label class="mx-lp${EDIT.orig?"":" off"}"><input type="checkbox" id="lpOn" ${EDIT.orig?"":"disabled"}
          ${(EDIT.orig && window.LIVEPUSH && LIVEPUSH.isOn(matchKey(m), m))?"checked":""}
          onchange="LIVEPUSH.toggle(matchKey(EDIT.match), EDIT.match); toast(this.checked?'بثّ الأحداث مُفعّل لهذه المباراة':'أُوقف البثّ', this.checked?'ok':'busy')">
          <span>أرسل إشعاراً عند كل هدف وإنذار وطرد وتبديل وعند صافرة النهاية</span></label>
        <p class="mx-hint">${EDIT.orig?`مُفعّل تلقائياً في يوم المباراة لكل البطولات عدا الدرجة الأولى والهواة —
          كل حدث تُدخله يصل للمشتركين خلال ثوانٍ. أطفئه إذا كنت تدخل أحداثاً لا تريد إرسالها. ستة إشعارات كحد أقصى في الحفظة الواحدة،
          ولا يُعاد إرسال حدث أُرسل. لا يمكن سحب إشعار بعد إرساله.`
          :`احفظ المباراة أولاً، ثم يصير البثّ متاحاً.`}</p></div>
      ${isKO(m)?`<div class="mx-card"><h3>الأشواط الإضافية وركلات الترجيح<small>لمباريات خروج المغلوب</small></h3>
        <label class="mx-et"><input type="checkbox" data-met ${hasET(m)?"checked":""}> امتدت المباراة للأشواط الإضافية (30 دقيقة)</label>
        <p class="mx-hint">بعد التفعيل تُسجَّل أحداث الأشواط الإضافية بدقيقتها الحقيقية: 91 إلى 120 (مثلاً هدف في الدقيقة 100). وبدل ضائع الإضافي على 105 أو 120.</p>
        <span class="mx-lbl" style="margin-top:14px">ركلات الترجيح بالترتيب${pskOf(m).length?` — النتيجة <b dir="ltr">${psoOf(m).h} - ${psoOf(m).a}</b>`:""}</span>
        <div class="mx-psk">${pskOf(m).map((k,i)=>{ const club=k.t==="h"?m.home:m.away;
          const names=(typeof roster==="function"?roster(club):[]).map(e=>e.n);
          if(k.p && !names.includes(k.p)) names.unshift(k.p);
          return `<div class="mx-pkr"><span class="n">${i+1}</span><span class="c">${club?crest(club):""}</span>
            <select data-mpsk-p="${i}" aria-label="المنفّذ">${opt(names,k.p,"اختر اللاعب")}</select>
            <button class="mx-chip${k.ok?" on ok":""}" data-mpsk-ok="${i}" data-v="1">سجّل</button>
            <button class="mx-chip${!k.ok?" on red":""}" data-mpsk-ok="${i}" data-v="0">أضاع</button>
            <button class="mx-pkdel" data-mpsk-del="${i}" aria-label="حذف الركلة">${SV.trash}</button></div>`; }).join("")}</div>
        <div class="mx-chips" style="margin-top:8px">
          <button class="mx-chip" data-mpsk-add="h">+ ركلة ${esc(m.home||"المضيف")}</button>
          <button class="mx-chip" data-mpsk-add="a">+ ركلة ${esc(m.away||"الضيف")}</button></div>
        ${pskOf(m).length?"":`<div class="mx-grid" style="margin-top:10px">
          <div><span class="mx-lbl">أو النتيجة فقط: ${esc(m.home||"المضيف")}</span>
            <input data-mpso="h" type="number" min="0" max="30" inputmode="numeric" value="${esc(String((m.pso||{}).h??""))}" placeholder="—"></div>
          <div><span class="mx-lbl">${esc(m.away||"الضيف")}</span>
            <input data-mpso="a" type="number" min="0" max="30" inputmode="numeric" value="${esc(String((m.pso||{}).a??""))}" placeholder="—"></div>
        </div>`}
        <p class="mx-hint">للعرض فقط: تظهر للمتابع في صفحة المباراة بالترتيب (من سدّد، سجّل أو أضاع). لا تُحسب أهدافاً ولا ركلات جزاء ولا مكان تسديد في أي إحصاء بالموقع. النتيجة الأصلية للمباراة لا تتغير.</p></div>`:""}
      <div class="mx-card"><h3>الملعب والحكم</h3>
        <div class="mx-grid">
          <div class="mx-span"><span class="mx-lbl">الملعب</span>
            <div class="mx-chips" style="margin-bottom:10px">${stadiums().map(v=>`<button class="mx-chip${m.venue===v?" on":""}" data-mvenue="${esc(v)}">${esc(v)}</button>`).join("")}</div>
            <input data-mf="venue" value="${esc(m.venue)}" placeholder="اسم الملعب">
            ${stHome&&stHome!==m.venue?`<div class="mx-sug">ملعب ${esc(m.home)}: <button data-mvenue="${esc(stHome)}">${esc(stHome)}</button></div>`:""}</div>
          <div class="mx-span mx-crew"><span class="mx-lbl" style="font-size:.8rem;color:var(--head,#fff)">طاقم التحكيم</span>
            <div class="mx-crewsum">${[["حكم الساحة",m.ref],...REF_ROLES.map(([k,t])=>[t,(m.refs||{})[k]])].filter(x=>x[1]).map(([t,v])=>`<span><small>${esc(t)}</small>${esc(v)}</span>`).join("")||`<span class="none">لم يُحدَّد الطاقم بعد</span>`}</div>
            <p class="mx-hint">الحكام يُدارون من تبويب «الحكام» في الإدارة (قائمة الحكام وطاقم كل مباراة) — منفصلين عن أحداث المباراة.</p></div>
          <div class="mx-span"><span class="mx-lbl">ملاحظة تظهر للجمهور (اختيارية)</span><input data-mf="note" value="${esc(m.note)}" placeholder="مثال: المباراة غير منقولة"></div>
        </div></div>
      <p class="mx-hint">النتيجة تُحتسب تلقائياً من الأهداف في تبويب الأحداث.</p>`;
  }

  function tabLineup(){
    const club=sideClub(MX.side);
    const sideBtn=s=>{ const c=sideClub(s), n=c?starters(c).length:0;
      return `<button class="mx-side${MX.side===s?" on":""}" data-mside="${s}" style="--srgb:${rgbOf(c)}">${crestOr(c)}
        <div><b>${esc(c||(s==="home"?"المضيف":"الضيف"))}</b><small class="${n===11?"full":""}">${c?`${n} من 11 أساسياً`:"لم يُحدَّد"}</small></div></button>`; };
    if(!club) return `<div class="mx-sides">${sideBtn("home")}${sideBtn("away")}</div><div class="mx-none">اختر ${MX.side==="home"?"الفريق المضيف":"الفريق الضيف"} من لوحة النتيجة أعلاه أولاً.</div>`;
    const S=slotsFor(club), xi=starters(club), st=(EDIT.shapes||{})[club];
    const list=FORMATIONS.includes(S.form)?FORMATIONS:[S.form,...FORMATIONS];
    const q=MX.q.trim();
    const ent=roster(club).filter(e=>!q||e.n.includes(q)||String(e.s)===q);
    const groups=[["G","حراس المرمى"],["D","الدفاع"],["M","الوسط"],["F","الهجوم"],["","بدون مركز"]];
    /* الغائب عن المباراة (زر «تحديد الغائبين» أو حالة الفانتسي) يظهر بالأحمر مع سببه ولا يُعرض في اختيار البدلاء */
    const why=n=>absentWhy(EDIT.match, club, n, EDIT.match.abs||[]);
    const readyTag=n=>{ const f=fantWhy(EDIT.match, club, n); return f && inPL(EDIT.match.pres, club, n) ? `جاهز (الفانتسي: ${f})` : ""; };
    const nOut=roster(club).filter(e=>!xi.includes(e.n) && why(e.n)).length;
    const plBtn=e=>{ const on=xi.includes(e.n), w=on?"":why(e.n);
      return `<button class="mx-pl${on?" in":""}${w?" out":""}${MX.sel&&!on&&!MX.abs?" swap":""}" data-mpl="${esc(e.n)}" style="--srgb:${rgbOf(club)}">
        ${face(e.n,club)}<span class="tx"><b>${esc(e.n)}</b><small>${esc(w||readyTag(e.n)||posLabel(e.p)||"—")}</small></span>${CUP_CLUBS.includes(club)?`<span class="num ed" data-msqnumed="${esc(e.n)}" title="تعديل الرقم">${e.s||"#"}</span>`:e.s?`<span class="num">${e.s}</span>`:""}</button>`; };
    const clubSubs=(EDIT.subs||[]).map((s,i)=>({s,i})).filter(o=>o.s.club===club);
    return `<div class="mx-sides">${sideBtn("home")}${sideBtn("away")}</div>
      <div class="mx-xi">
        <div class="mx-pitchwrap"><div class="mx-card">
          <div class="mx-ptools">
            <div class="mx-chips">${list.map(f=>`<button class="mx-chip${S.form===f?" on":""}" data-mform="${esc(f)}">${esc(f)}</button>`).join("")}</div>
          </div>
          ${pitchHTML(club)}
          ${MX.sel?`<div class="mx-pbar"><span>${esc(MX.sel)}</span><span class="sp"></span><span style="font-weight:600;color:var(--slate)">اختر لاعباً من القائمة للاستبدال</span>
            <button data-mxout="1">إخراج</button><button data-mxsel="">إلغاء</button></div>`:""}
          <div class="mx-ptools" style="margin:10px 0 0">
            <button class="mx-ghost" data-mflip="1">${SV.flip}اعكس الجهات</button>
            ${st&&(st.f||Object.keys(st.pos||{}).length)?`<button class="mx-ghost" data-mreset="1">المواضع التلقائية</button>`:""}
          </div>
          <p class="mx-hint">اسحب أي لاعب لموضعه الفعلي في المباراة، واضغط عليه لإخراجه أو استبداله.</p>
        </div></div>
        <div>
          <div class="mx-card"><h3>قائمة ${esc(club)}<small>${xi.length} من 11</small></h3>
            <div class="mx-search">${SV.search}<input data-mq="1" value="${esc(MX.q)}" placeholder="ابحث بالاسم أو الرقم"></div>
            ${CUP_CLUBS.includes(club)?sqAddHTML(club):""}
            <div class="mx-absbar"><button class="mx-ghost${MX.abs?" on":""}" data-mabs="1">${MX.abs?"تم":"تحديد الغائبين"}</button>
              <p class="mx-hint">${MX.abs?"اضغط المصاب أو الغائب ليُستبعد من قائمة هذه المباراة، واضغطه مرة ثانية لإرجاعه. المسجّل «مصاب» في الفانتسي: اضغطه إذا كان جاهزاً فيرجع للاحتياط."
                :nOut?`${nOut} غائب عن هذه المباراة — لا يظهرون في الاحتياط.`:"المصابون والغائبون لا يظهرون في الاحتياط."}</p></div>
            ${groups.map(([k,t])=>{ const L=ent.filter(e=>(POS_MAIN[String(e.p||"").toUpperCase()]||"")===k); if(!L.length) return "";
              return `<div class="mx-grp">${t}</div><div class="mx-roster">${L.map(plBtn).join("")}</div>`; }).join("") || `<div class="mx-none">لا يوجد لاعب بهذا البحث</div>`}
          </div>
          <div class="mx-card"><h3>البدلاء والتبديلات<small>${clubSubs.length} تبديل</small></h3>
            <div class="mx-add"><button class="mx-addb" data-mnew="sub" data-mclub="${esc(club)}">${SV.swap}إضافة تبديل</button></div>
            ${clubSubs.length?`<div class="mx-tl">${clubSubs.sort((a,b)=>absMinute(a.s.h,a.s.m,a.s.x,(EDIT.match&&EDIT.match.add1))-absMinute(b.s.h,b.s.m,b.s.x,(EDIT.match&&EDIT.match.add1))).map(o=>evRow({k:"sub",i:o.i,r:o.s})).join("")}</div>`
              :`<p class="mx-hint">لم يُسجَّل تبديل بعد. الاحتياط = كل من في القائمة وليس أساسياً ولا غائباً.</p>`}
          </div>
        </div>
      </div>`;
  }

  function evItems(){
    const out=[];
    (EDIT.goals||[]).forEach((r,i)=>out.push({k:"goal",i,r,t:(+r.m||0)+(+r.x||0)/100}));
    (EDIT.cards||[]).forEach((r,i)=>out.push({k:"card",i,r,t:(+r.m||0)+(+r.x||0)/100}));
    (EDIT.pens||[]).forEach((r,i)=>{ out.push({k:"pen",i,r,t:+r.m||0});
      if(r.res && r.res!==PEN_PENDING) out.push({k:"penr",i,r,t:(+r.rm||+r.m||0)+0.001}); });
    /* نفس مقياس بقية الأحداث (الدقيقة المكتوبة): absMinute مع بدل ضائع الشوط الأول كان يجعل تبديل 58' = 63 فيسبقه إنذار 63' (المحررون 2026-09-30) */
    (EDIT.subs||[]).forEach((r,i)=>out.push({k:"sub",i,r,t:(+r.h===2 && (+r.m||0)<=45) ? 45.999 : (+r.m||0)+(+r.x||0)/100}));
    (EDIT.mev||[]).forEach((r,i)=>out.push({k:r.k,i,r,t:(+r.m||0)+(+r.x||0)/100}));
    /* قائمة المحرّر بنفس ترتيب صفحة المباراة: «نهاية الشوط الأول» بعد كل 45+x، و«نهاية المباراة» آخراً */
    out.forEach(o=>{ if(o.k==="note" && !o.r.club){ const t=String(o.r.note||"").trim();
      if(/^نهاية الشوط الأول/.test(t)) o.t=45.99; else if(/^نهاية المباراة/.test(t)) o.t=1e6; } });
    return out.sort((a,b)=>a.t-b.t);
  }
  function evRow({k,i,r}){
    let club="", who="", sub="", ic="", mn="";
    if(k==="goal"){ club=r.sc; who=goalWho(r); ic=ICO_BALL; mn=r.m?`${r.m}${+r.x?`+${r.x}`:""}'`:"—";
      sub=[r.bp==="هدف عكسي"?`هدف عكسي لصالح ${r.sc}`:"", r.a&&r.bp!=="هدف عكسي"?`صناعة: ${r.a}`:"", goalDetTxt(r)].filter(Boolean).join(" · "); }
    if(k==="card"){ club=r.club; who=r.p; mn=r.m?`${r.m}${+r.x?`+${r.x}`:""}'`:"—";
      const t=r.type||""; ic=`<span class="ic-card ${/ثان/.test(t)?"yr":isRed(t)?"r":"y"}"></span>`; sub=t; }
    if(k==="pen"){ club=r.by; who=r.p||r.by; ic=SV.pen; mn=r.m?`${r.m}'`:"—"; sub="احتساب ركلة جزاء"; }
    if(k==="penr"){ club=r.by; who=r.p||r.by; ic=SV.pen; const rmn=+r.rm||+r.m; mn=rmn?`${rmn}'`:"—"; sub=`نتيجة الركلة · ${r.res||""}`; }
    if(k==="sub"){ club=r.club; who=r.in||"—"; ic=SV.swap; mn=r.m?`${halfLabel(r.h,r.m,r.x)}'`:"—"; sub=`خرج: ${r.out||"—"}`; }
    if(MEV[k]){ club=r.club; who=r.p||TITLE[k]; ic=SV[k]; mn=r.m?`${r.m}${+r.x?`+${r.x}`:""}'`:"—"; sub=[r.p?TITLE[k]:"", r.note||""].filter(Boolean).join(" · "); }
    return `<div class="mx-ev" style="--srgb:${rgbOf(club)}">
      <div class="mn">${esc(mn)}<small>${k==="sub"?`الشوط ${+r.h||1}`:esc(club||"")}</small></div>
      <div class="ic">${ic}</div>
      <div class="who">${face(who,club)}<div class="tx"><b>${esc(who||"بلا لاعب")}</b><small>${esc(sub)}</small></div></div>
      <div class="acts"><button data-medit="${k}.${i}" aria-label="تعديل">${SV.edit}</button><button class="del" data-mdel="${k}.${i}" aria-label="حذف">${SV.trash}</button></div></div>`;
  }
  /* مرحلة المباراة والوقت بدل الضائع أعلى تبويب الأحداث (منصور 2026-11-02: «لسهولة الإدخال») */
  function liveCards(){
    const m=EDIT.match;
    return `<div class="mx-card"><h3>مرحلة المباراة<small>تظهر للجمهور كحالة المباراة</small></h3>
        <div class="mx-phase">${PHASES.map(([k,t])=>`<button class="mx-ph${(m.status||"")===k?" on":""}" data-mstatus="${k}">${t}</button>`).join("")}</div>
        ${isKO(m)?`<div class="mx-phase" style="margin-top:8px">${PHASES_KO.map(([k,t])=>`<button class="mx-ph${(m.status||"")===k?" on":""}" data-mstatus="${k}">${t}</button>`).join("")}</div>`:""}
        ${PH_CLOCK[m.status]&&+m.pst?`<div class="mx-clk"><span class="mx-lbl">الدقيقة عند الجمهور</span>${mclkHTML(m)}
          <span class="mx-clk-adj"><button type="button" class="mx-ghost" data-mclk="-1">− دقيقة</button><button type="button" class="mx-ghost" data-mclk="1">+ دقيقة</button></span></div>`:""}
        <p class="mx-hint">اضغط «الشوط الأول» مع صافرة البداية فتبدأ الدقيقة عند الجمهور وتُحفظ المباراة فوراً. تقف الساعة عند 45 (و90) حتى تُدخل الوقت بدل الضائع فتكمل 45+1، 45+2… ثم اختر «بين الشوطين» و«الشوط الثاني» و«انتهت» في وقتها. «− / + دقيقة» لتصحيح الساعة إن تأخّرت الضغطة.</p></div>
      <div class="mx-card"><h3>الوقت بدل الضائع</h3>
        <div class="mx-grid">
          <div><span class="mx-lbl">الشوط الأول +</span>
            <input data-mf="add1" type="number" min="0" max="30" inputmode="numeric"
                   value="${esc(String(m.add1??""))}" placeholder="0"></div>
          <div><span class="mx-lbl">الشوط الثاني +</span>
            <input data-mf="add2" type="number" min="0" max="30" inputmode="numeric"
                   value="${esc(String(m.add2??""))}" placeholder="0"></div>
          ${hasET(m)?`<div><span class="mx-lbl">الإضافي الأول +</span>
            <input data-mf="add3" type="number" min="0" max="30" inputmode="numeric" value="${esc(String(m.add3??""))}" placeholder="0"></div>
          <div><span class="mx-lbl">الإضافي الثاني +</span>
            <input data-mf="add4" type="number" min="0" max="30" inputmode="numeric" value="${esc(String(m.add4??""))}" placeholder="0"></div>`:""}
        </div>
        <p class="mx-hint">ما أعلنه الحكم لكل شوط. تُحتسب في دقائق اللعب:
          مباراة بها ٧+٥ طولها ١٠٢ دقيقة، والبديل الذي دخل ٤٥+٣ تُحسب له دقائق الوقت المحتسب.
          اتركها فارغة إن لم تُسجّل.</p></div>`;
  }
  function tabEvents(){
    const items=evItems();
    return `${liveCards()}
      <div class="mx-card"><h3>إضافة حدث</h3>
      <div class="mx-add">
        <button class="mx-addb" data-mnew="goal">${ICO_BALL}هدف</button>
        <button class="mx-addb" data-mnew="card" data-mtype="إنذار"><span class="ic-card y"></span>إنذار</button>
        <button class="mx-addb" data-mnew="card" data-mtype="طرد مباشر"><span class="ic-card r"></span>طرد</button>
        <button class="mx-addb" data-mnew="sub">${SV.swap}تبديل</button>
        <button class="mx-addb" data-mnew="pen">${SV.pen}احتساب ركلة جزاء</button>
        <button class="mx-addb" data-mnew="penr">${SV.pen}نتيجة ركلة جزاء</button>
        <button class="mx-addb" data-mnew="chance">${SV.chance}فرصة خطيرة</button>
        <button class="mx-addb" data-mnew="var">${SV.var}مراجعة VAR</button>
        <button class="mx-addb" data-mnew="note">${SV.note}تعليق</button>
      </div></div>
      <div class="mx-card"><h3>مجريات المباراة<small>${items.length} حدث</small></h3>
      ${items.length?`<div class="mx-tl">${items.map(evRow).join("")}</div>`:`<div class="mx-none">لا أحداث بعد — أضف الأهداف والبطاقات والتبديلات بالأزرار أعلاه.</div>`}</div>`;
  }

  /* ===================== النافذة السفلية ===================== */
  const BLANK={goal:()=>({sc:"",p:"",a:"",m:"",x:0,det:"",bp:"",zone:"",og:""}),
               card:()=>({club:"",p:"",m:"",type:"إنذار"}), pen:()=>({by:"",p:"",m:"",res:"احتُسبت",place:""}),
               sub:()=>({club:"",out:"",in:"",h:"1",m:""}),
               chance:()=>({k:"chance",club:"",p:"",m:"",x:0,note:""}), var:()=>({k:"var",club:"",p:"",m:"",x:0,note:""}), note:()=>({k:"note",club:"",p:"",m:"",x:0,note:""})};
  const MEV={chance:1,var:1,note:1};
  const ARR={goal:"goals",card:"cards",pen:"pens",penr:"pens",sub:"subs",chance:"mev",var:"mev",note:"mev"};
  const CLUBKEY={goal:"sc",card:"club",pen:"by",penr:"by",sub:"club",chance:"club",var:"club",note:"club"};
  const TITLE={goal:"هدف",card:"بطاقة",pen:"احتساب ركلة جزاء",penr:"نتيجة ركلة الجزاء",sub:"تبديل",chance:"فرصة خطيرة",var:"مراجعة VAR",note:"تعليق"};
  const PHASE_NOTE={h1:[1,"بداية المباراة"],ht:[45,"نهاية الشوط الأول"],h2:[46,"بداية الشوط الثاني"],e1:[91,"بداية الشوط الإضافي الأول"],e2:[106,"بداية الشوط الإضافي الثاني"],pso:[120,"ركلات الترجيح"],ft:[90,"نهاية المباراة"]};
  const PHASES=[["pre","قبل البداية"],["h1","الشوط الأول"],["ht","بين الشوطين"],["h2","الشوط الثاني"],["ft","انتهت"]];
  /* مباريات خروج المغلوب فقط (نصف نهائي ونهائي الخليج، والكؤوس): أشواط إضافية وركلات ترجيح (منصور 2026-10-03) */
  /* دور المجموعات في المشاركات الخارجية ليس خروج مغلوب حتى خارج تبويبها (منصور 2026-10-29: دقيقة 93 في ناساف × الكويت فعّلت الإضافي) */
  const isKO=m=>EDIT && EDIT.gulf ? +m.round>=4 : window.EXT && EXT.isGroup && EXT.isGroup(m) ? false : EDIT && EDIT.ext && window.EXT ? EXT.isKO(m) : String(m.comp||"")!=="الدوري";
  const PHASES_KO=[["e1","الشوط الإضافي الأول"],["e2","الشوط الإضافي الثاني"],["pso","ركلات الترجيح"]];
  const TV_LIST=["كويت سبورت","كويت سبورت بلس","الكويت الأولى","غير منقولة"];
  const stadiums=()=>{ const set=new Set(); if(typeof CLUB_INFO!=="undefined") Object.values(CLUB_INFO).forEach(i=>i&&i.st&&set.add(i.st)); (ALL.matches||[]).forEach(x=>x.venue&&set.add(String(x.venue).trim())); return [...set].filter(Boolean).slice(0,16); };
  /* اختصارات الدقائق حسب المرحلة */
  /* اختيار الشوط في كل حدث (منصور 2026-10-03: التبديلات والأهداف والإنذارات بلا خيار للإضافي): أربعة أشواط في مباريات
     خروج المغلوب. للتبديل يُحفظ في h (3/4 = الإضافيان)؛ لبقية الأحداث يضبط الدقيقة على مدى الشوط فقط. */
  const PERS=[["1","الشوط الأول",1,45],["2","الشوط الثاني",46,90],["3","الإضافي الأول",91,105],["4","الإضافي الثاني",106,120]];
  const perOf=(k,d)=>{ if(k==="sub") return String(d.h||"1"); if(d._per) return d._per; const m=+d.m||0;
    if(!m){ const st=EDIT.match.status; return st==="h2"?"2":st==="e1"?"3":st==="e2"?"4":"1"; }
    return m<=45?"1":m<=90?"2":m<=105?"3":"4"; };
  const perChips=(k,d)=>{ const ko=isKO(EDIT.match); if(!ko && k!=="sub") return "";
    const L=ko?PERS:PERS.slice(0,2), cur=perOf(k,d);
    return `<div class="mx-span"><span class="mx-lbl">الشوط</span><div class="mx-chips">${L.map(([v,t])=>`<button class="mx-chip${cur===v?" on":""}" data-mper="${v}">${t}</button>`).join("")}</div></div>`; };
  const PER_MIN={"1":[1,15,30,45],"2":[46,60,75,90],"3":[91,95,100,105],"4":[106,110,115,120]};
  const minChips=(key,per)=>{ const st=EDIT.match.status; const L=per&&isKO(EDIT.match)?PER_MIN[per]:st==="h1"?[1,15,30,45]:st==="h2"?[46,60,75,90]:st==="e1"?[91,95,100,105]:st==="e2"?[106,110,115,120]:
      hasET(EDIT.match)?[1,15,30,45,60,75,90,105,120]:[1,15,30,45,60,75,90];
    return `<div class="mx-chips" style="margin-top:8px">${L.map(v=>`<button class="mx-chip" data-mset="${key}" data-mval="${v}">${v}'</button>`).join("")}</div>`; };
  function openEv(k,i,preset){
    EDIT.mev=EDIT.mev||[];
    if(k==="penr" && i<0){
      for(let j=(EDIT.pens||[]).length-1;j>=0;j--) if(!EDIT.pens[j].res || EDIT.pens[j].res===PEN_PENDING){ i=j; break; }
      if(i<0){ toast("أضف «احتساب ركلة جزاء» أولاً","busy"); return; }
      const d=JSON.parse(JSON.stringify(EDIT.pens[i])); d.res=""; if(!d.rm) d.rm=String(+d.m||"");
      MX.sheet={kind:"ev",k,i,d,err:"",sig0:rowSig(EDIT.pens[i])}; renderMatchAdmin(); return;
    }
    const d=i>=0?JSON.parse(JSON.stringify(EDIT[ARR[k]][i])):Object.assign(BLANK[k](),preset||{});
    if(!d[CLUBKEY[k]]) d[CLUBKEY[k]]=sideClub(MX.tab==="lineup"?MX.side:"home")||"";
    MX.sheet={kind:"ev",k,i,d,err:"",sig0:i>=0?rowSig(EDIT[ARR[k]][i]):"",t0:Date.now()}; renderMatchAdmin();
  }
  /* من في الملعب الآن مرتّباً حسب الرسم التكتيكي (المحررون 2026-09-30: «رتّب اللاعبين حسب الرسم»):
     موضع كل أساسي من الملعب في تبويب التشكيلة، والبديل يأخذ موضع من خرج مكانه، ومن خرج يُنقل إلى الاحتياط */
  function onPitchGroups(club){
    const xi=starters(club); if(!xi.length) return null;
    const pos={}; slotsFor(club).spots.forEach(({p,x,y})=>{ pos[p.n]={x,y,line:p.line}; });
    const off=new Set();
    (EDIT.subs||[]).filter(sb=>sb.club===club).slice()
      .sort((a,b)=>((+a.h||1)-(+b.h||1))||((+a.m||0)+(+a.x||0)/100-((+b.m||0)+(+b.x||0)/100)))
      .forEach(sb=>{ if(sb.out){ if(pos[sb.out] && sb.in && !pos[sb.in]) pos[sb.in]=pos[sb.out]; off.add(sb.out); }
                     else if(sb.in && !pos[sb.in]) pos[sb.in]={x:50,y:45,line:"M"}; });
    const band=q=>q.line==="G"||q.y>82?"G":q.y>=58?"D":q.y>=24?"M":"F";
    const G={F:[],M:[],D:[],G:[]};
    Object.keys(pos).filter(n=>!off.has(n)).forEach(n=>G[band(pos[n])].push({n,x:pos[n].x,y:pos[n].y}));
    /* داخل الخط: الصف الأكثر تقدماً أولاً (صانع اللعب قبل المحور)، ثم يمين الملعب أولاً كما يُرى */
    Object.values(G).forEach(a=>a.sort((u,v)=>(Math.round(u.y/8)-Math.round(v.y/8))||(v.x-u.x)));
    return {G, onP:new Set(Object.values(G).flat().map(o=>o.n)), off};
  }
  function pickGrid(club, key, cur, opt){
    opt=opt||{};
    if(!club) return `<div class="mx-none">اختر الفريق أولاً</div>`;
    const xi=starters(club); let ent=roster(club);
    /* شريط أفقي مضغوط لورقة الهدف (منصور 2026-10-22: «ابي كل شي من اول ما ادش») — من في الملعب بترتيب الخطوط، ثم من خرج */
    if(opt.strip){
      const PG=onPitchGroups(club), byN={}; ent.forEach(e=>{ byN[e.n]=e; });
      let list;
      if(PG){ list=[]; ["F","M","D","G"].forEach(k=>PG.G[k].forEach(o=>list.push({...(byN[o.n]||{n:o.n})})));
        ent.filter(e=>!PG.onP.has(e.n) && (PG.off.has(e.n) || e.n===cur)).forEach(e=>list.push({...e, off:true})); }
      else list=ent.slice().sort((a,b)=>(xi.includes(b.n)-xi.includes(a.n))||((a.s||999)-(b.s||999)));
      const chip=e=>`<button class="mx-pl sm${cur===e.n?" picked":""}${opt.exclude&&opt.exclude===e.n?" dim":""}${e.off?" off":""}" data-mpick="${key}" data-mname="${esc(e.n)}" style="--srgb:${rgbOf(club)}">${face(e.n,club)}<b>${esc(e.n)}</b>${e.s?`<span class="num">${e.s}</span>`:""}</button>`;
      return `<div class="mx-strip">${opt.none?`<button class="mx-pl sm none${!cur?" picked":""}" data-mpick="${key}" data-mname=""><span class="mx-face">—</span><b>${esc(opt.none)}</b></button>`:""}${list.map(chip).join("")}</div>`;
    }
    const btn=e=>`<button class="mx-pl${cur===e.n?" picked":""}${opt.exclude&&opt.exclude===e.n?" dim":""}" data-mpick="${key}" data-mname="${esc(e.n)}" style="--srgb:${rgbOf(club)}">
        ${face(e.n,club)}<span class="tx"><b>${esc(e.n)}</b><small>${e.tag||(xi.includes(e.n)?"أساسي":"احتياط")}</small></span>${e.s?`<span class="num">${e.s}</span>`:""}</button>`;
    const none=opt.none?`<div class="mx-roster"><button class="mx-pl${!cur?" picked":""}" data-mpick="${key}" data-mname=""><span class="mx-face">—</span><span class="tx"><b>${esc(opt.none)}</b></span></button></div>`:"";
    const PG=opt.only==="bench" ? null : onPitchGroups(club);
    if(PG){
      const byN={}; ent.forEach(e=>{ byN[e.n]=e; });
      const LBL={F:"الهجوم",M:"الوسط",D:"الدفاع",G:"الحارس"};
      /* كل صف تكتيكي في سطر مستقل داخل خطه (صنّاع اللعب ثم المحور) */
      const rowsOf=a=>{ const r=[]; a.forEach(o=>{ const k=Math.round(o.y/8); const last=r[r.length-1]; if(last&&last.k===k) last.a.push(o); else r.push({k,a:[o]}); }); return r; };
      const groups=["F","M","D","G"].filter(k=>PG.G[k].length).map(k=>`<div class="mx-grp"><span class="mx-glbl">${LBL[k]}</span>${
        rowsOf(PG.G[k]).map(r=>`<div class="mx-roster">${r.a.map(o=>btn({...(byN[o.n]||{n:o.n}), tag:xi.includes(o.n)?"أساسي":"دخل بديلاً"})).join("")}</div>`).join("")}</div>`).join("");
      if(opt.only==="xi") return none+groups;   /* «خرج» في التبديل: من في الملعب فقط */
      const rest=ent.filter(e=>!PG.onP.has(e.n) && (PG.off.has(e.n) || e.n===cur || !absentWhy(EDIT.match, club, e.n, EDIT.match.abs||[]))).map(e=>({...e, tag:PG.off.has(e.n)?"خرج":"احتياط"}));
      const open=(MX.sheet&&MX.sheet.bench&&MX.sheet.bench[key]) || rest.some(e=>e.n===cur);
      const more=!rest.length ? "" : open ? `<div class="mx-grp"><span class="mx-glbl">الاحتياط ومن خرج</span><div class="mx-roster">${rest.map(btn).join("")}</div></div>`
        : `<button class="mx-more" data-mbench="${key}">عرض الاحتياط ومن خرج (${rest.length})</button>`;
      return none+groups+more;
    }
    if(opt.only==="xi") ent=ent.filter(e=>xi.includes(e.n)||(EDIT.subs||[]).some(s=>s.club===club&&s.in===e.n));
    if(opt.only==="bench"){
      /* «دخل»: من دخل أصلاً في تبديل آخر ليس من الاحتياط (منصور 2026-11-07: «ليش يطلعون لي الاعبين الي اصلا دشوا الملعب») — إلا لاعب هذا التبديل نفسه */
      const usedIn=new Set((EDIT.subs||[]).filter(s=>s.club===club && s.in).map(s=>s.in));
      ent=ent.filter(e=>!xi.includes(e.n) && (e.n===cur || (!usedIn.has(e.n) && !absentWhy(EDIT.match, club, e.n, EDIT.match.abs||[]))));   /* المصاب/الغائب ليس من البدلاء */
    }
    ent.sort((a,b)=>(xi.includes(b.n)-xi.includes(a.n))||((a.s||999)-(b.s||999)));
    return `${none}<div class="mx-roster">${ent.map(btn).join("")}</div>`;
  }
  /* منطقة التسجيل بالضغط على الملعب (منصور 2026-10-22) — نفس مفاتيح ZONES/LIST.zone التي تقرؤها خريطة الإحصاءات */
  const zoneMap=cur=>{ const on=zoneKeyOf(cur), Y0=-3, YH=83, ty=y=>((y-Y0)/YH*100).toFixed(2);
    /* نفس رسم خريطة الإحصاءات ونفس مواضع الدوائر (anBadgePos)؛ المسافة البعيدة تُعرض مقصوصة ودائرتها داخل الجزء الظاهر */
    const pos=z=>{ const [x,y]=anBadgePos(z); return [x, z.k==="مسافة بعيدة (+30م)"?72:y]; };
    const R=ZONES.filter(z=>z.t==="r").map(z=>`<rect class="pz${on===z.k?" on":""}" x="${z.x}" y="${z.y}" width="${z.w}" height="${Math.min(z.h,80-z.y)}" data-mzone="${esc(z.k)}"/>`).join("");
    const D=ZONES.map(z=>{ const [x,y]=pos(z); return `<button type="button" class="pzb${on===z.k?" on":""}" style="left:${x}%;top:${ty(y)}%" data-mzone="${esc(z.k)}" aria-label="${esc(z.k)}" title="${esc(z.k)}"></button>`; }).join("");
    const lanes=[21,36,64,79].map(x=>`<line class="ah-lane" x1="${x}" y1="2" x2="${x}" y2="80"/>`).join("");
    return `<div class="mx-zone"><div class="mx-zone-h"><span class="mx-lbl">منطقة التسجيل</span><b class="${cur?"on":""}">${cur?esc(cur):"اضغط على الملعب"}</b></div>
      <div class="pf"><svg viewBox="0 ${Y0} 100 ${YH}" preserveAspectRatio="none" aria-hidden="true">
        <rect class="ah-grass" x="0" y="2" width="100" height="78"/>
        ${[...Array(8)].map((_,i)=>`<rect class="ah-mow${i%2?" b":""}" x="0" y="${(2+i*9.8).toFixed(1)}" width="100" height="9.8"/>`).join("")}
        <rect class="ah-hs" x="21" y="2" width="15" height="62"/><rect class="ah-hs" x="64" y="2" width="15" height="62"/>
        <g class="pzl">${lanes}<line class="ah-third" x1="0" y1="64" x2="100" y2="64"/></g>
        ${R}
        <g class="ah-ln pzl"><rect x="0" y="2" width="100" height="78"/><rect x="21" y="2" width="58" height="32"/><rect x="36" y="2" width="28" height="12"/><path d="M 34.5 34 A 17 17 0 0 0 65.5 34"/></g>
        <rect class="ah-goal pzl" x="43" y="-1.2" width="14" height="3.2"/><circle class="pzl" cx="50" cy="24" r=".7" fill="#fff"/>
      </svg>${D}</div></div>`; };
  const chips=(key,list,cur,cls)=>`<div class="mx-chips">${list.map(v=>`<button class="mx-chip${cls?" "+cls(v):""}${cur===v?" on":""}" data-mset="${key}" data-mval="${esc(v)}">${esc(v)}</button>`).join("")}</div>`;
  const rangeHint=v=>{ const st=EDIT.match.status, m=+v||0; if(!m) return "";
    if(st==="h1"&&m>45) return `<p class="mx-hint" style="color:#ffb547">المباراة في الشوط الأول — الدقيقة عادة بين 1 و45 (استخدم «وقت بدل ضائع» بعد 45).</p>`;
    if(st==="h2"&&m<46) return `<p class="mx-hint" style="color:#ffb547">المباراة في الشوط الثاني — الدقيقة عادة بين 46 و90.</p>`;
    if(st==="e1"&&(m<91||m>105)) return `<p class="mx-hint" style="color:#ffb547">الشوط الإضافي الأول — الدقيقة بين 91 و105 (بعدها «وقت بدل ضائع» على 105).</p>`;
    if(st==="e2"&&(m<106||m>120)) return `<p class="mx-hint" style="color:#ffb547">الشوط الإضافي الثاني — الدقيقة بين 106 و120 (بعدها «وقت بدل ضائع» على 120).</p>`;
    if(m>90 && !hasET(EDIT.match)) return `<p class="mx-hint" style="color:#ffb547">الدقيقة بعد 90 تُحسب وقتاً إضافياً فقط إذا امتدت المباراة للأشواط الإضافية (فعّلها في تبويب المباراة). لبدل الضائع اكتب 90 و«وقت بدل ضائع +».</p>`;
    return ""; };
  const stepper=(key,val,label,max)=>`<div><span class="mx-lbl">${label}</span><div class="mx-step"><button data-mstep="${key}" data-mby="-1" aria-label="أنقص">−</button>
    <input type="number" min="0" max="${max||130}" inputmode="numeric" data-msf="${key}" value="${esc(val)}"><button data-mstep="${key}" data-mby="1" aria-label="زد">+</button></div></div>`;
  const plBtn=(club,key,label,cur,empty)=>`<div class="mx-inl"><span class="mx-lbl">${label}</span><button type="button" class="mx-detbtn mx-plbtn${cur?" on":""}" data-mplopen="${key}">${cur?`${face(cur,club)}<span>${esc(cur)}</span>`:`<span>${esc(empty)}</span>`}</button></div>`;
  function sheetHTML(){
    const S=MX.sheet; if(!S) return "";
    if(S.kind==="club"){
      const other=S.side==="home"?EDIT.match.away:EDIT.match.home, cur=EDIT.match[S.side];
      return `<div class="mx-sheet" data-mclose="bg"><div class="box" role="dialog" aria-modal="true">
        <div class="hd"><h3>${S.side==="home"?"الفريق المضيف":"الفريق الضيف"}</h3><button data-mclose="x" aria-label="إغلاق">${SV.x}</button></div>
        <div class="bd"><div class="mx-clubs">${editClubs(EDIT.match).map(c=>`<button class="mx-clubb${c===cur?" on":""}" data-mclub="${esc(c)}" ${c===other?"disabled":""}>${crest(c)}<span>${esc(c)}</span></button>`).join("")}</div></div></div></div>`;
    }
    const {k,i,d}=S, h=EDIT.match.home, a=EDIT.match.away, ck=CLUBKEY[k], club=d[ck], opp=club===h?a:h;
    const team=`<div class="mx-teamrow"><span class="mx-lbl">${k==="goal"?"الفريق المسجّل":k==="pen"?"الفريق المنفّذ":"الفريق"}</span><div class="mx-tsw">
      ${[h,a].filter(Boolean).map(c=>`<button class="mx-side${club===c?" on":""}" data-mset="${ck}" data-mval="${esc(c)}" style="--srgb:${rgbOf(c)}">${crest(c)}<div><b>${esc(c)}</b></div></button>`).join("")}</div></div>`;
    let body=team;
    if(k==="goal"){
      body+=`${perChips(k,d)}<div class="mx-grid">${stepper("m",d.m,"الدقيقة",130)}${stepper("x",d.x||0,"وقت بدل ضائع +",20)}</div>${minChips("m",perOf(k,d))}${rangeHint(d.m)}
        <div><span class="mx-lbl">طريقة التسجيل</span>${chips("bp",LIST.bp,d.bp)}</div>
        ${d.bp==="هدف عكسي"
          ? `<div><span class="mx-lbl">سجّل في مرماه (لاعب ${esc(opp||"الخصم")})</span>${pickGrid(opp,"og",d.og)}</div>
             <p class="mx-hint">الهدف العكسي يُحتسب لـ${esc(club||"الفريق المختار")} بلا مسجّل ولا صانع من لاعبيه، ويُنسب للاعب الخصم الذي سجّل في مرماه.</p>`
          : `${plBtn(club,"p","المسجّل",d.p,"اختر")}${plBtn(club,"a","صانع الهدف",d.a,"بدون صناعة")}`}
        <div class="mx-inl"><span class="mx-lbl">تفصيل الهجمة</span><button type="button" class="mx-detbtn${d.det?" on":""}" data-mdetopen="1">${d.det?esc(d.det):"اختر"}</button></div>
        ${zoneMap(d.zone)}
        ${isDefErr(d)?`<div><span class="mx-lbl">اللاعب المخطئ (لاعب ${esc(opp||"الخصم")})</span>${pickGrid(opp,"err",d.err,{none:"غير محدد"})}</div>`:""}`;
    }
    if(k==="card"){
      body+=`<div><span class="mx-lbl">نوع البطاقة</span>${chips("type",LIST.cardtype,d.type,v=>isRed(v)&&!/ثان/.test(v)?"red":"warn")}</div>
        ${perChips(k,d)}<div class="mx-grid">${stepper("m",d.m,"الدقيقة",130)}${stepper("x",d.x||0,"وقت بدل ضائع +",20)}</div>${isKO(EDIT.match)?minChips("m",perOf(k,d)):""}
        <div><span class="mx-lbl">اللاعب</span>${pickGrid(club,"p",d.p)}</div>`;   /* الدقيقة فوق قائمة اللاعبين (كانت تختفي تحت 26 لاعباً) + بدل الضائع 45+1 (المحررون 2026-09-30) */
    }
    if(k==="pen"){
      body+=`${perChips(k,d)}<div class="mx-grid">${stepper("m",d.m,"دقيقة الاحتساب",130)}</div>
        <p class="mx-hint">الاحتساب حدث وحده (إشعار «احتساب ركلة جزاء»). المنفّذ والنتيجة من زر «نتيجة ركلة جزاء» بدقيقتها.</p>`;
    }
    if(k==="penr"){
      body+=`<div class="mx-grid">${stepper("rm",d.rm,"دقيقة النتيجة",130)}</div>
        <div><span class="mx-lbl">النتيجة</span>${chips("res",LIST.penres.filter(v=>v!==PEN_PENDING),d.res,v=>v==="سجلت"?"ok":"")}</div>
        ${d.res!==PEN_VOID?`<div><span class="mx-lbl">المنفّذ</span>${pickGrid(club,"p",d.p)}</div>
        <div><span class="mx-lbl">مكان التسديد</span>${penPickSVG(d.place, z=>`data-mset="place" data-mval="${esc(z)}"`)}</div>`:""}
        <p class="mx-hint">«سجلت» يضيف الهدف تلقائياً بهذه الدقيقة. كل نتيجة حدث مستقل بإشعاره.</p>`;
    }
    if(MEV[k]){
      if(k==="chance") body+=`<div><span class="mx-lbl">اللاعب</span>${pickGrid(club,"p",d.p)}</div>`;
      else if(club) body+=`<div><span class="mx-lbl">اللاعب المعني (اختياري)</span>${pickGrid(club,"p",d.p,{none:"بدون لاعب"})}</div>`;
      body+=`${perChips(k,d)}<div class="mx-grid">${stepper("m",d.m,"الدقيقة",130)}${stepper("x",d.x||0,"وقت بدل ضائع +",20)}</div>${minChips("m",perOf(k,d))}
        <div><span class="mx-lbl">${k==="note"?"نص التعليق":"وصف قصير (اختياري)"}</span><input data-msf="note" value="${esc(d.note||"")}" placeholder="${k==="var"?"مثال: مراجعة ركلة جزاء — أُلغيت":k==="chance"?"مثال: تسديدة من خارج المنطقة":"مثال: بداية الشوط الثاني"}"></div>`;
    }
    if(k==="sub"){
      /* تبديلات متعددة في اللحظة نفسها (منصور 2026-11-04): عدد التبديلات أولاً، ثم زوج خرج/دخل لكل تبديل، وتأكيد واحد للدفعة */
      const cnt = S.i<0 ? Math.max(1, Math.min(5, +d.cnt||1)) : 1;
      const cntChips = S.i<0 ? `<div class="mx-span"><span class="mx-lbl">عدد التبديلات في هذه اللحظة</span><div class="mx-chips">${[1,2,3,4,5].map(n=>`<button class="mx-chip${cnt===n?" on":""}" data-mset="cnt" data-mval="${n}">${n===1?"تبديل واحد":n===2?"تبديلان":n+" تبديلات"}</button>`).join("")}</div></div>` : "";
      const taken = (j, side) => { const L=[]; for(let q=0;q<cnt;q++){ if(q===j) continue; const o=d[q?("out"+q):"out"], n=d[q?("in"+q):"in"]; if(side==="out"&&o) L.push(o); if(side==="in"&&n) L.push(n); } return L; };
      const pair = j => { const ko=j?("out"+j):"out", ki=j?("in"+j):"in";
        const dupO = d[ko] && taken(j,"out").includes(d[ko]), dupI = d[ki] && taken(j,"in").includes(d[ki]);
        return `${cnt>1?`<div class="mx-subhd">التبديل ${j+1}</div>`:""}
        <div><span class="mx-lbl">خرج${dupO?` <em class="mx-warn">مختار في تبديل آخر</em>`:""}</span>${pickGrid(club,ko,d[ko],{only:"xi"})}</div>
        <div><span class="mx-lbl">دخل${dupI?` <em class="mx-warn">مختار في تبديل آخر</em>`:""}</span>${pickGrid(club,ki,d[ki],{only:"bench",exclude:d[ko]})}</div>`; };
      body+=`${cntChips}${perChips(k,d)}<div class="mx-grid">${stepper("m",d.m,"الدقيقة",130)}${stepper("x",d.x||0,"وقت بدل ضائع +",20)}</div>${isKO(EDIT.match)?minChips("m",perOf(k,d)):""}
        ${Array.from({length:cnt},(_,j)=>pair(j)).join("")}`;
    }
    /* المسجّل وصانع الهدف بشاشة كاملة (منصور 2026-10-23: «ما يبينون اللاعبين كلهم… مقسمين حارس دفاع وسط هجوم») —
       كل اللاعبين بخطوطهم من الرسم، والاحتياط ومن خرج ظاهرون مباشرة */
    const plPick=k==="goal"&&S.plOpen ? (()=>{ const key=S.plOpen; S.bench=Object.assign({},S.bench,{[key]:true});
      const g=key==="a"?pickGrid(club,"a",d.a,{none:"بدون صناعة",exclude:d.p}):pickGrid(club,"p",d.p);
      return `<div class="mx-detpick mx-plpick" role="dialog" aria-modal="true"><div class="hd"><h3>${key==="a"?"صانع الهدف":"المسجّل"}</h3><button type="button" data-mplclose="1" aria-label="إغلاق">${SV.x}</button></div>
        <div class="bd">${g}</div></div>`; })() : "";
    /* تفصيل الهجمة بشاشة كاملة بدل القائمة المنسدلة (منصور 2026-10-22) — نفس قيم LIST.det */
    const detPick=k==="goal"&&S.detOpen ? (()=>{ const L=LIST.det, cut=L.indexOf("ركنية"), grp=(t,a)=>`<span class="mx-lbl">${t}</span><div class="mx-detgrid">${a.map(v=>`<button type="button" class="mx-detopt${d.det===v?" on":""}" data-mdet="${esc(v)}">${esc(v)}</button>`).join("")}</div>`;
      return `<div class="mx-detpick" role="dialog" aria-modal="true"><div class="hd"><h3>تفصيل الهجمة</h3><button type="button" data-mdetclose="1" aria-label="إغلاق">${SV.x}</button></div>
        <div class="bd">${grp("لعب مفتوح",L.slice(0,cut))}${grp("كرات ثابتة",L.slice(cut))}</div></div>`; })() : "";
    return `${detPick}${plPick}<div class="mx-sheet${k==="goal"?" goal":""}" data-mclose="bg"><div class="box" role="dialog" aria-modal="true">
      <div class="hd"><h3>${i>=0?"تعديل":"إضافة"} ${TITLE[k]}</h3><button data-mclose="x" aria-label="إغلاق">${SV.x}</button></div>
      <div class="bd">${S.err?`<div class="mx-err">${SV.warn}${esc(S.err)}</div>`:""}${body}</div>
      <div class="ft">${i>=0?`<button class="mx-del" data-mdel="${k}.${i}">${SV.trash}حذف</button>`:""}<span class="sp"></span>
        <button class="mx-ghost" data-mclose="x">إلغاء</button><button class="mx-save" data-mcommit="1">${SV.save}${i>=0?"حفظ التعديل":"إضافة"}</button></div>
    </div></div>`;
  }
  function commitEv(){
    const S=MX.sheet, d=S.d, k=S.k;
    const need=(c,msg)=>{ if(!c){ S.err=msg; renderMatchAdmin(); return false; } return true; };
    /* الهدف العكسي: لا مسجّل ولا صانع من الفريق المستفيد، المطلوب من سجّل في مرماه (og) — كان يطلب المسجّل المخفي فلا يُحفظ (المحررون 2026-10-31) */
    if(k==="goal"){ const og=d.bp==="هدف عكسي"; if(og){ d.p=""; d.a=""; } else d.og="";
      if(!need(d.sc,"اختر الفريق المسجّل")||!need(og?d.og:d.p,og?"اختر اللاعب الذي سجّل في مرماه":"اختر اللاعب المسجّل")||!need(+d.m>=1,"أدخل دقيقة الهدف")||!need(d.det,"اختر تفصيل الهجمة (مطلوب لإحصاءات الأهداف)")) return; }
    if(k==="card"){ if(!need(d.club,"اختر الفريق")||!need(d.p,"اختر اللاعب")||!need(d.type,"اختر نوع البطاقة")) return; }
    if(k==="pen"){ if(!need(d.by,"اختر الفريق")||!need(+d.m>=1,"أدخل دقيقة الاحتساب")) return; if(!d.res) d.res=PEN_PENDING; }
    if(k==="penr"){ if(!need(d.res && d.res!==PEN_PENDING,"اختر نتيجة الركلة")||!need(+d.rm>=1,"أدخل دقيقة النتيجة")) return;
      if(d.res==="سجلت" && !need(d.p,"اختر المنفّذ — الركلة المسجّلة تُضاف هدفاً")) return;
      if(d.res===PEN_VOID){ d.p=d.p||""; d.place=""; } }
    let subBatch = [];
    if(k==="sub"){
      const cnt = S.i<0 ? Math.max(1, Math.min(5, +d.cnt||1)) : 1;
      if(!need(d.club,"اختر الفريق")) return;
      const P = []; for(let j=0;j<cnt;j++) P.push({out:d[j?("out"+j):"out"]||"", in:d[j?("in"+j):"in"]||""});
      for(let j=0;j<cnt;j++){ const t=cnt>1?` (التبديل ${j+1})`:""; if(!need(P[j].out,"اختر اللاعب الخارج"+t)||!need(P[j].in,"اختر اللاعب الداخل"+t)) return; }
      const outs=P.map(x=>x.out), ins=P.map(x=>x.in);
      if(!need(new Set(outs).size===outs.length,"لاعب خارج مكرر في الدفعة")||!need(new Set(ins).size===ins.length,"لاعب داخل مكرر في الدفعة")) return;
      if(!need(!outs.some(o=>ins.includes(o)),"لاعب لا يمكن أن يخرج ويدخل في الدفعة نفسها")) return;
      if(S.i<0){ const PG=onPitchGroups(d.club);
        if(PG){ const offNow=outs.find(o=>!PG.onP.has(o)); if(!need(!offNow, `«${offNow}» ليس في الملعب الآن`)) return;
                const bad=ins.find(n=>PG.onP.has(n)||PG.off.has(n)); if(!need(!bad, `«${bad}» لعب في المباراة — ليس من الاحتياط`)) return; } }
      if(cnt>1){ const bid=Date.now().toString(36)+Math.random().toString(36).slice(2,6); d.b=bid;
        subBatch = P.slice(1).map(x=>({club:d.club, out:x.out, in:x.in, h:d.h||"1", m:d.m, x:+d.x||0, b:bid})); }
      delete d.cnt; Object.keys(d).forEach(f=>{ if(/^(out|in)\d+$/.test(f)) delete d[f]; });
    }
    if(k==="chance"){ if(!need(d.club,"اختر الفريق")||!need(d.p,"اختر اللاعب")||!need(+d.m>=1,"أدخل الدقيقة")) return; }
    if(k==="var"){ if(!need(+d.m>=1,"أدخل الدقيقة")) return; }
    if(k==="note"){ if(!need((d.note||"").trim(),"اكتب نص التعليق")) return; }
    if(k==="goal" && d.p && d.a===d.p) d.a="";
    { const per=perOf(k,d), mm=+d.m||0;      /* «الإضافي الأول، الدقيقة 5» = 95 */
      if(per==="3" && mm>=1 && mm<=15) d.m=String(90+mm);
      if(per==="4" && mm>=1 && mm<=15) d.m=String(105+mm);
      if(+per>=3 && etAllowed(EDIT.match)) EDIT.match.et=true; delete d._per; }
    const arr=EDIT[ARR[k]];
    if(!d.uid) d.uid=Date.now().toString(36)+Math.random().toString(36).slice(2,7);
    /* النموذج قد يُعاد تحميله بعد حفظ تلقائي والنافذة مفتوحة فيتغير ترتيب الصفوف: نبحث عن الصف نفسه لا عن رقمه */
    let at=S.i; if(S.i>=0 && S.sig0){ const j=arr.findIndex(r=>rowSig(r)===S.sig0); if(j>=0) at=j; else if(arr[S.i] && rowSig(arr[S.i])!==S.sig0) at=-1; }
    /* تعديل صف محفوظ أصلاً (موجود في base): لا إشعار له ولا لما يتولّد منه (منصور 2026-11-04) */
    const baseRow = at>=0 && S.sig0 ? ((EDIT.base&&EDIT.base[ARR[k]])||[]).find(r=>(r.uid&&r.uid===d.uid) || rowSig(r)===S.sig0) : null;
    /* نتيجة ركلة كانت «احتُسبت»، أو إلغاؤها بعد VAR = حدث جديد يُرسل؛ ما عدا ذلك تصحيح بلا إشعار */
    const penNews = (k==="pen"||k==="penr") && !!baseRow && baseRow.res!==d.res && (!baseRow.res || baseRow.res===PEN_PENDING || d.res===PEN_VOID);
    const wasSaved = !!baseRow && !penNews;
    if(wasSaved && window.LIVEPUSH && LIVEPUSH.noPush) LIVEPUSH.noPush(d.uid);
    if(at>=0) arr[at]=d; else arr.push(d);
    subBatch.forEach(r=>{ r.uid=Date.now().toString(36)+Math.random().toString(36).slice(2,7); arr.push(r); });   /* بقية الدفعة: نفس الدقيقة والشوط والمعرّف b */
    /* ركلة جزاء مسجّلة = هدف تلقائياً (منصور 2026-11-04: «حطيت البلنتي… النتيجة 0-0 المفروض 1-0»)، ما لم يوجد هدفها أصلاً */
    if((k==="pen"||k==="penr") && d.res==="سجلت" && d.p){
      const gm=+d.rm||+d.m||0;
      const has=EDIT.goals.some(g=>g.sc===d.by && g.p===d.p && g.det==="ركلة جزاء" && (Math.abs((+g.m||0)-gm)<=2 || Math.abs((+g.m||0)-(+d.m||0))<=2));
      if(!has){ const gu=Date.now().toString(36)+Math.random().toString(36).slice(2,7);
        EDIT.goals.push({sc:d.by, p:d.p, a:"", m:String(gm), x:0, det:"ركلة جزاء", bp:"", zone:"علامة الجزاء", og:"", uid:gu});
        if(wasSaved && window.LIVEPUSH && LIVEPUSH.noPush) LIVEPUSH.noPush(gu); }
    }
    MX.sheet=null; FORMERR=""; renderMatchAdmin();
  }

  /* ===================== الرسم والربط ===================== */
  function render(box){
    EDIT.shapes=EDIT.shapes||{};
    const m=EDIT.match, [hg,ag]=score();
    const hx=m.home?starters(m.home).length:0, ax=m.away?starters(m.away).length:0;
    const evs=(EDIT.goals.length+EDIT.cards.length+EDIT.pens.length+EDIT.subs.length+(EDIT.mev||[]).length);
    const teamBtn=s=>{ const c=m[s]; return `<button class="mx-team" data-mpickclub="${s}">${crestOr(c)}<b>${esc(c||(s==="home"?"اختر المضيف":"اختر الضيف"))}</b><small>${s==="home"?"المضيف":"الضيف"}</small></button>`; };
    const upcoming=m.date && !EDIT.goals.length && (typeof kickoffTS==="function") && (kickoffTS({date:m.date,time:m.time})||0)>Date.now();
    box.innerHTML=`<div class="mx" style="--hrgb:${rgbOf(m.home)};--argb:${rgbOf(m.away)}">
      <div class="mx-top"><button class="mx-ghost" data-act="cancel">${SV.back}القائمة</button><h2>${EDIT.orig?"تعديل مباراة":"مباراة جديدة"}</h2></div>
      ${FORMERR?`<div class="mx-err">${SV.warn}${esc(FORMERR)}</div>`:""}
      <div class="mx-board">
        <div class="mx-teams">${teamBtn("home")}
          <div class="mx-sc"><div class="n">${ag}<i>:</i>${hg}</div><span class="st${m.status&&m.status!=="ft"&&m.status!=="pre"?" live":""}">${m.status?(PHASES.find(p=>p[0]===m.status)||["",""])[1]:upcoming?"لم تبدأ":m.round?`الجولة ${esc(m.round)}`:"—"}</span></div>
          ${teamBtn("away")}</div>
        <div class="mx-meta">${m.date?`<span>${SV.cal}<bdi dir="ltr">${esc(m.date)}${m.time?` · ${esc(m.time)}`:""}</bdi></span>`:""}${m.venue?`<span>${SV.pin}${esc(m.venue)}</span>`:""}${m.ref?`<span>${REF_PHOTOS[m.ref]?refFace(m.ref,"sm"):SV.whistle}${esc(m.ref)}</span>`:""}${m.tv?`<span>${SV.tv}${esc(m.tv)}</span>`:""}<span>${esc(m.comp||"")}</span></div>
      </div>
      <nav class="mx-tabs">
        <button class="mx-tab${MX.tab==="match"?" on":""}" data-mtab="match">المباراة<small>${m.round?esc(rndLabel(m)):"البيانات"}</small></button>
        <button class="mx-tab${MX.tab==="lineup"?" on":""}${(hx&&hx!==11)||(ax&&ax!==11)?" bad":""}" data-mtab="lineup">التشكيلة<small>${hx}/11 · ${ax}/11</small></button>
        <button class="mx-tab${MX.tab==="events"?" on":""}" data-mtab="events">الأحداث<small>${evs} حدث</small></button>
      </nav>
      <section>${MX.tab==="lineup"?tabLineup():MX.tab==="events"?tabEvents():tabMatch()}</section>
      <div class="mx-bar"><div class="sum">${esc(m.home||"—")} ${hg} - ${ag} ${esc(m.away||"—")}<br>${hx+ax} لاعباً أساسياً · ${evs} حدث</div>
        ${EDIT.orig?`<button type="button" class="mx-auto" data-act="savestay" title="الحفظ تلقائي. إن ظهر «لم يُحفظ» اضغط لعرض السبب">محفوظ ✓</button>`:`<button class="mx-ghost" data-act="cancel">إلغاء</button>`}<button class="mx-ghost" data-act="savestay">حفظ الآن</button><button class="mx-save" data-act="save">${SV.save}حفظ وإغلاق</button></div>
    </div>`;
    /* النافذة على مستوى body: داخل المحتوى تبقى تحت شريط التنقل السفلي مهما ارتفع z-index */
    let host=document.getElementById("mxSheetHost");
    if(!host){ host=document.createElement("div"); host.id="mxSheetHost"; host.className="mx"; document.body.appendChild(host); }
    /* نفس النافذة مفتوحة وتُعاد رسمها (زيادة بدل الضائع، اختيار المسجّل…): تبقى في موضع التمرير نفسه وبلا حركة فتح جديدة —
       كانت ترجع لأعلى النافذة وتعيد حركة الظهور فيبدو كأنها أُغلقت وفُتحت (المحررون 2026-09-30) */
    const oldBx=host.querySelector(".mx-sheet .box"), keepTop=oldBx?oldBx.scrollTop:0, same=!!(MX.sheet && MX._shown===MX.sheet);
    host.innerHTML=sheetHTML();
    if(same){ const sh=host.querySelector(".mx-sheet"); if(sh){ sh.classList.add("keep"); const bx=sh.querySelector(".box"); if(bx) bx.scrollTop=keepTop; } }
    MX._shown=MX.sheet;
    document.documentElement.classList.toggle("mx-open", !!MX.sheet);
    document.documentElement.classList.add("mx-editing");
    const nav=document.querySelector("nav.tabs"); const cs=nav?getComputedStyle(nav):null;
    const fixedBottom=cs&&cs.position==="fixed"&&nav.getBoundingClientRect().top>innerHeight/2;
    box.style.setProperty("--mx-bottom", fixedBottom?(innerHeight-nav.getBoundingClientRect().top+8)+"px":"8px");
    box.style.setProperty("--mx-top", (cs&&/sticky|fixed/.test(cs.position)&&!fixedBottom)?((parseFloat(cs.top)||0)+nav.offsetHeight+6)+"px":"8px");   /* ارتفاع القائمة الثابتة لا موضعها الحالي على الشاشة */
    wire(box);
  }
  /* busy: إزالة حقل مُركَّز أثناء إعادة الرسم تُطلق change ← إعادة رسم متداخلة تكسر innerHTML */
  function rerender(){ if(MX.busy) return; renderMatchAdmin(); }
  window.mxRerender = () => { if(MX.tab==="lineup" && document.getElementById("mxSheetHost")) rerender(); };   /* بعد وصول حالات الفانتسي */
  function wire(box){
    const host=document.getElementById("mxSheetHost");
    const q=(s,f)=>[box,host].forEach(r=>r&&r.querySelectorAll(s).forEach(f));
    q("[data-act]",b=>b.onclick=()=>{ const a=b.dataset.act;
      if(a==="cancel"){ if(!confirm("الخروج بدون حفظ؟ ستضيع التعديلات غير المحفوظة.")) return; MX.sheet=null; MX.sel=null; document.documentElement.classList.remove("mx-open"); EDIT=null; FORMERR=""; renderMatchAdmin(); flushRemote(); }
      if(a==="savestay"){ saveStay(); return; }
      if(a==="save" && SAVING_MATCH){ toast("لحظة — يُكمل الحفظ التلقائي…","busy"); const t=setInterval(()=>{ if(!SAVING_MATCH){ clearInterval(t); const nb=document.querySelector('[data-act="save"]'); if(nb) nb.click(); } },300); return; }
      if(a==="save"){ MX.sheet=null; MX.sel=null; document.documentElement.classList.remove("mx-open"); const pre=validateEdit(); if(pre){ FORMERR=pre; MX.tab=errTab(pre); rerender(); return; }
        saveMatch(); }
    });
    /* حفظ ومتابعة: يحفظ ثم يعيد فتح المباراة نفسها في التبويب نفسه — للإدخال المباشر أثناء المباراة */
    function saveStay(){
        MX.sheet=null; MX.sel=null; document.documentElement.classList.remove("mx-open"); const pre=validateEdit(); if(pre){ FORMERR=pre; MX.tab=errTab(pre); rerender(); toast("لم يُحفظ: "+pre,"err"); return false; }
        const mm=EDIT.match, key={round:+mm.round, comp:mm.comp, home:mm.home, away:mm.away}, tab=MX.tab, side=MX.side;
        const gulf=!!EDIT.gulf, ext=!!EDIT.ext;
        saveMatch().then(()=>{ if(EDIT) return;
          /* مباراة كأس الخليج في وثيقتها الخاصة: البحث في ALL (الدوري) لا يجدها فكان المحرّر يُغلق بدل أن يبقى مفتوحاً (المحررون 2026-09-30) */
          const find=()=>(ALL.matches||[]).find(z=>z.round===key.round && compOf(z)===key.comp && z.home===key.home && z.away===key.away);
          /* مشاركات أنديتنا الخارجية (ext.js) في وثيقتها الخاصة كذلك */
          const W=gulf && window.GULF ? GULF.withGulf : ext && window.EXT ? EXT.withExt : null;
          const x=W ? W(find) : find();
          if(!x) return; EDIT=W ? W(()=>loadEdit(x)) : loadEdit(x); if(gulf) EDIT.gulf=true; if(ext) EDIT.ext=true;
          MX._edit=EDIT; MX.tab=tab; MX.side=side; renderMatchAdmin(); });
        return true; }
    /* تغيير الشوط أو بدل الضائع أو تصحيح الدقيقة يُحفظ فوراً لتجري الساعة عند الجمهور (مباراة محفوظة سابقاً فقط) */
    function clockSave(){ if(!EDIT || !EDIT.orig){ toast("احفظ المباراة أولاً لتظهر الدقيقة للجمهور","busy"); return false; }
      if(EDIT.gulf) return saveStay();
      rerender(); saveMatch({quiet:true}); return true; }   /* إن كان حفظ آخر جارياً يلتقطه الحفظ التلقائي بعد ثانيتين */
    q("[data-mtab]",b=>b.onclick=()=>{ MX.tab=b.dataset.mtab; MX.sel=null; rerender(); window.scrollTo({top:box.getBoundingClientRect().top+scrollY-80,behavior:"smooth"}); });
    q("[data-mcomp]",b=>b.onclick=()=>{ EDIT.match.comp=b.dataset.mcomp; if(!isCupComp(EDIT.match.comp)) delete EDIT.match.stage; rerender(); });
    q("[data-mstage]",b=>b.onclick=()=>{ EDIT.match.stage=(EDIT.match.stage===b.dataset.mstage?"":b.dataset.mstage); rerender(); });
    const sqTouch=c=>{ SQ_PENDING[c]=JSON.parse(JSON.stringify(SQUADS[c]||[])); };
    q("[data-msqadd]",b=>b.onclick=()=>{ const c=b.dataset.msqadd, box2=b.closest(".mx-sqadd");
      const n=String(box2.querySelector("[data-msqn]").value||"").trim().replace(/\s+/g," "), sN=+box2.querySelector("[data-msqs]").value||0, pP=box2.querySelector("[data-msqp]").value||"";
      if(!n){ toast("اكتب اسم اللاعب","err"); return; }
      const L=SQUADS[c]=SQUADS[c]||[], i=L.findIndex(x=>sqName(x)===n);
      if(sN && L.some((x,j)=>j!==i && sqNum(x)===sN)) toast(`الرقم ${sN} مستخدم في ${c}`,"busy");
      if(i>=0) L[i]=Object.assign({}, typeof L[i]==="object"?L[i]:{n}, {s:sN||sqNum(L[i]), p:pP||sqPos(L[i])}); else L.push({n, s:sN, p:pP});
      sqTouch(c); MX.q=""; rerender();
      if(i<0 && starters(c).length<11){ const nb=[...box.querySelectorAll("[data-mpl]")].find(x=>x.dataset.mpl===n); if(nb) nb.click(); } });
    q("[data-msqnumed]",el=>el.onclick=ev=>{ ev.stopPropagation(); const c=sideClub(MX.side), L=SQUADS[c]||[], i=L.findIndex(x=>sqName(x)===el.dataset.msqnumed);
      if(i<0) return; const v=prompt(`رقم ${sqName(L[i])}`, sqNum(L[i])||""); if(v===null) return; const sN=+String(v).replace(/[^0-9]/g,"")||0;
      if(sN && L.some((x,j)=>j!==i && sqNum(x)===sN)) toast(`الرقم ${sN} مستخدم في ${c}`,"busy");
      L[i]=Object.assign({}, typeof L[i]==="object"?L[i]:{n:L[i]}, {s:sN}); sqTouch(c); rerender(); });
    q("[data-mf]",el=>{ el.oninput=()=>{ EDIT.match[el.dataset.mf]=el.value; }; el.onchange=()=>{ if(!EDIT) return; EDIT.match[el.dataset.mf]=el.value;
      /* لا نعيد الرسم إن انتقل التركيز لحقل آخر في المحرّر — كان يمسح ما يُكتب في الحقل التالي */
      if(PH_CLOCK[EDIT.match.status] && PH_CLOCK[EDIT.match.status][2]===el.dataset.mf && clockSave()) return;   /* بدل الضائع للشوط الجاري يظهر عند الجمهور فوراً */
      setTimeout(()=>{ const a=document.activeElement; if(MX.busy || !EDIT || (a && a!==el && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName) && box.contains(a))) return; if(el.isConnected) rerender(); },0); }; });
    q("[data-mround]",b=>b.onclick=()=>{ EDIT.match.round=String(Math.max(1,(+EDIT.match.round||0)+(+b.dataset.mround))); rerender(); });
    q("[data-mvenue]",b=>b.onclick=()=>{ EDIT.match.venue=b.dataset.mvenue; rerender(); });
    q("[data-mref]",el=>{ el.oninput=()=>{ EDIT.match.refs=EDIT.match.refs||{}; EDIT.match.refs[el.dataset.mref]=el.value; }; });
    q("[data-met]",el=>el.onchange=()=>{ EDIT.match.et=el.checked; rerender(); });
    q("[data-mpsk-add]",b=>b.onclick=()=>{ EDIT.match.psk=EDIT.match.psk||[]; EDIT.match.psk.push({t:b.dataset.mpskAdd, p:"", ok:true}); rerender(); });
    q("[data-mpsk-p]",el=>el.onchange=()=>{ const k=(EDIT.match.psk||[])[+el.dataset.mpskP]; if(k){ k.p=el.value; rerender(); } });
    q("[data-mpsk-ok]",b=>b.onclick=()=>{ const k=(EDIT.match.psk||[])[+b.dataset.mpskOk]; if(k){ k.ok=b.dataset.v==="1"; rerender(); } });
    q("[data-mpsk-del]",b=>b.onclick=()=>{ (EDIT.match.psk||[]).splice(+b.dataset.mpskDel,1); rerender(); });
    q("[data-mpso]",el=>{ el.oninput=()=>{ EDIT.match.pso=EDIT.match.pso||{h:"",a:""}; EDIT.match.pso[el.dataset.mpso]=el.value; }; });
    q("[data-mstatus]",b=>b.onclick=()=>{ const st=b.dataset.mstatus; const was=EDIT.match.status; EDIT.match.status=st; if(["e1","e2"].includes(st)) EDIT.match.et=true;
      if(st!==was) EDIT.match.pst = PH_CLOCK[st] ? Date.now() : 0;   /* بداية ساعة الشوط */
      /* تغيير المرحلة يسجّل حدثاً محايداً مرة واحدة: بداية المباراة/نهاية الشوط الأول/بداية الشوط الثاني/نهاية المباراة */
      const auto=st==="ft" && hasET(EDIT.match) ? [120,"نهاية المباراة"] : st==="pso" ? null : PHASE_NOTE[st];
      if(auto){ EDIT.mev=EDIT.mev||[];
        if(!EDIT.mev.some(x=>x.k==="note"&&x.note===auto[1])){ EDIT.mev.push({k:"note",club:"",p:"",m:String(auto[0]),x:0,note:auto[1]}); toast(auto[1],"ok"); } }
      if(st!==was && clockSave()) return;
      rerender(); });
    q("[data-mclk]",b=>b.onclick=()=>{ if(!+EDIT.match.pst) return; EDIT.match.pst = +EDIT.match.pst - (+b.dataset.mclk)*60000; if(!clockSave()) rerender(); });
    q("[data-mtv]",b=>b.onclick=()=>{ EDIT.match.tv=(EDIT.match.tv===b.dataset.mtv?"":b.dataset.mtv); rerender(); });
    q("[data-mpickclub]",b=>b.onclick=()=>{ MX.sheet={kind:"club",side:b.dataset.mpickclub}; rerender(); });
    q("[data-mclub]",b=>b.onclick=()=>{ const s=MX.sheet.side, old=EDIT.match[s], nw=b.dataset.mclub;
      if(old&&old!==nw){ /* تبديل النادي: تشكيلته وتبديلاته ومواضعه القديمة لا تخصّ النادي الجديد */
        EDIT.lineup=EDIT.lineup.filter(x=>x.club!==old); EDIT.subs=EDIT.subs.filter(x=>x.club!==old); delete EDIT.shapes[old];
        EDIT.goals.forEach(g=>{ if(g.sc===old){ g.sc=nw; g.p=""; g.a=""; } });
        EDIT.cards.forEach(c=>{ if(c.club===old){ c.club=nw; c.p=""; } });
        EDIT.pens.forEach(p=>{ if(p.by===old){ p.by=nw; p.p=""; } }); }
      EDIT.match[s]=nw;
      if(s==="home" && !EDIT.match.venue && typeof CLUB_INFO!=="undefined" && CLUB_INFO[nw]) EDIT.match.venue=CLUB_INFO[nw].st||"";
      MX.sheet=null; rerender(); });
    /* نافذة الحدث لا تُغلق بلمسة على الخلفية — لمسة على الحافة أثناء التمرير كانت تُخرج المحرّر من الحدث فجأة (المحررون 2026-09-30) */
    q("[data-mclose]",el=>el.onclick=e=>{ if(el.dataset.mclose==="bg" && (e.target!==el || (MX.sheet&&MX.sheet.kind==="ev"))) return; MX.sheet=null; rerender(); });
    q("[data-mside]",b=>b.onclick=()=>{ MX.side=b.dataset.mside; MX.sel=null; MX.q=""; rerender(); });
    q("[data-mq]",el=>el.oninput=()=>{ MX.q=el.value; const pos=el.selectionStart; rerender(); const n=box.querySelector("[data-mq]"); if(n){ n.focus(); try{ n.setSelectionRange(pos,pos); }catch(_){} } });
    q("[data-mform]",b=>b.onclick=()=>{ const cl=sideClub(MX.side); EDIT.shapes[cl]={f:b.dataset.mform,pos:{}}; rerender(); });
    q("[data-mreset]",b=>b.onclick=()=>{ delete EDIT.shapes[sideClub(MX.side)]; rerender(); });
    q("[data-mflip]",b=>b.onclick=()=>{ const cl=sideClub(MX.side), S=slotsFor(cl), pos={};
      S.spots.forEach(({p,x,y})=>{ pos[p.n]={x:+(100-x).toFixed(1),y}; }); EDIT.shapes[cl]={f:S.form,pos}; rerender(); });
    q("[data-mxsel]",b=>b.onclick=()=>{ MX.sel=null; rerender(); });
    q("[data-mxout]",b=>b.onclick=()=>{ const cl=sideClub(MX.side), n=MX.sel; removeStarter(cl,n); MX.sel=null; rerender(); });
    q("[data-mabs]",b=>b.onclick=()=>{ MX.abs=!MX.abs; MX.sel=null; rerender(); });
    q("[data-mpl]",b=>b.onclick=()=>{ const cl=sideClub(MX.side), n=b.dataset.mpl, xi=starters(cl);
      if(MX.abs){   /* وضع «تحديد الغائبين»: الضغط يستبعد اللاعب من قائمة هذه المباراة أو يرجعه */
        if(xi.includes(n)){ toast("لاعب أساسي — أخرجه من التشكيلة أولاً","err"); return; }
        const A=EDIT.match.abs=EDIT.match.abs||[], k=_natKey(cl,n), i=A.findIndex(x=>x.c===cl && _natKey(cl,x.p)===k);
        if(i>=0) A.splice(i,1);
        else if(fantWhy(EDIT.match, cl, n)){   /* مصاب في الفانتسي: الضغط يجعله «جاهز» لهذه المباراة، والضغط ثانية يرجع حالة الفانتسي */
          const P=EDIT.match.pres=EDIT.match.pres||[], j=P.findIndex(x=>x.c===cl && _natKey(cl,x.p)===k);
          if(j>=0) P.splice(j,1); else P.push({c:cl, p:n}); }
        else { A.push({c:cl, p:n}); }
        rerender(); return; }
      if(xi.includes(n)){ if(MX.sel===n){ MX.sel=null; } else { removeStarter(cl,n); } rerender(); return; }
      if(MX.sel){ swapStarter(cl, MX.sel, n); MX.sel=null; rerender(); return; }
      if(xi.length>=11){ toast("التشكيلة مكتملة (11) — اضغط لاعباً على الملعب ثم اختر بديله","err"); return; }
      /* كل لاعب يثبت في مكانه لحظة اختياره (منصور 2026-10-09: «كل واحد لمن اضغط عليه يتثبت بمركزه الا اذا انا حركته»):
         كان إضافة لاعب بلا موضع تُرجع الترتيب التلقائي فيتحرك الجميع. نثبّت مواضع الظاهرين كما تُرى، ثم الجديد في مكانه التلقائي. */
      const S0=slotsFor(cl), st=EDIT.shapes[cl]=EDIT.shapes[cl]||{f:"",pos:{}}; st.pos=st.pos||{};
      S0.spots.forEach(({p,x,y})=>{ if(!st.pos[p.n]) st.pos[p.n]={x:+x.toFixed(1),y:+y.toFixed(1)}; });
      EDIT.lineup=EDIT.lineup.filter(x=>!(x.club===cl&&!x.p)); EDIT.lineup.push({club:cl,p:n});
      if(EDIT.match.abs) EDIT.match.abs=EDIT.match.abs.filter(x=>!(x.c===cl && _natKey(cl,x.p)===_natKey(cl,n)));   /* أساسي = ليس غائباً */
      /* الداخل يأخذ مكان آخر من أُخرج، وإلا موضعه في الترتيب التلقائي (بعيداً قليلاً عن أي لاعب فوقه) */
      const vac=(MX.vac||{})[cl];
      if(!st.pos[n] && vac && vac.length) st.pos[n]=vac.pop();
      if(!st.pos[n]){
        /* صفّه من مركزه في الكشف (صفوف 4-4-2 التلقائية: حارس 90، دفاع 64، وسط 38، هجوم 12) وجهته (x يُقاس من اليمين) */
        const me=shapeMenFrom([n], cl)[0]||{line:"M",role:"CM"};
        const y={G:90,D:64,M:38,F:12}[me.line]??38, side=shSide(me.role);
        const free=x=>!Object.entries(st.pos).some(([k,q])=>k!==n && Math.abs(q.y-y)<8 && Math.abs(q.x-x)<14);
        let x=me.line==="G"?50:side===2?22:side===0?78:50;
        if(!free(x)){ const row=Object.entries(st.pos).filter(([k,q])=>k!==n && Math.abs(q.y-y)<8).map(([,q])=>q.x);
          const C=[50,22,78,36,64,12,88,30,70,42,58], gap=c=>Math.min(...row.map(r=>Math.abs(r-c)));
          x=C.find(free) ?? C.reduce((b,c)=>gap(c)>gap(b)?c:b, C[0]); }   /* صف مزدحم: أبعد نقطة عن الموجودين */
        st.pos[n]={x,y};
      }
      rerender(); });
    q("[data-mnew]",b=>b.onclick=()=>{ const k=b.dataset.mnew, preset={}; if(b.dataset.mtype) preset.type=b.dataset.mtype; if(b.dataset.mclub) preset[CLUBKEY[k]]=b.dataset.mclub; openEv(k,-1,preset); });
    q("[data-medit]",b=>b.onclick=()=>{ const [k,i]=b.dataset.medit.split("."); openEv(k,+i); });
    q("[data-mdel]",b=>b.onclick=()=>{ const [k,i]=b.dataset.mdel.split("."); if(!confirm(`حذف ${TITLE[k]}؟`)) return;
      if(k==="penr"){ const r=EDIT.pens[+i]; if(r){ const gm=+r.rm||+r.m||0;
          if(r.res==="سجلت") EDIT.goals=EDIT.goals.filter(g=>!(g.sc===r.by && g.p===r.p && g.det==="ركلة جزاء" && Math.abs((+g.m||0)-gm)<=2));
          r.res=PEN_PENDING; delete r.rm; r.place=""; } }
      else EDIT[ARR[k]].splice(+i,1);
      MX.sheet=null; rerender(); });
    if(MX.sheet && MX.sheet.kind==="ev"){
      const d=MX.sheet.d;
      q("[data-mset]",b=>b.onclick=()=>{ const key=b.dataset.mset, v=b.dataset.mval;
        if(key===CLUBKEY[MX.sheet.k] && d[key]!==v){ ["p","a","og","err","out","in"].forEach(f=>{ if(f in d) d[f]=""; }); Object.keys(d).forEach(f=>{ if(/^(out|in)\d+$/.test(f)) d[f]=""; }); }
        d[key]=v; if(key==="bp"){ if(v!=="هدف عكسي") d.og=""; else { d.p=""; d.a=""; } } rerender(); });
      q("[data-mper]",b=>b.onclick=()=>{ const v=b.dataset.mper, row=PERS.find(r=>r[0]===v), m=+d.m||0;
        if(MX.sheet.k==="sub") d.h=v; else d._per=v;
        /* الدقيقة خارج مدى الشوط المختار → بداية الشوط (التبديل في الشوطين الأصليين يحتفظ بطريقة الإدخال القديمة) */
        if(!(MX.sheet.k==="sub" && +v<=2) && ((m && (m<row[2] || m>row[3])) || (!m && +v>=3))) d.m=String(row[2]);
        if(+v>=3 && etAllowed(EDIT.match)) EDIT.match.et=true; rerender(); });
      q("[data-mbench]",b=>b.onclick=()=>{ const S=MX.sheet; S.bench=S.bench||{}; S.bench[b.dataset.mbench]=true; rerender(); });
      q("[data-mpick]",b=>b.onclick=()=>{ const key=b.dataset.mpick, v=b.dataset.mname; d[key]=(d[key]===v&&key==="a")?"":v; if(MX.sheet.plOpen) MX.sheet.plOpen=""; rerender(); });
      q("[data-mplopen]",b=>b.onclick=()=>{ MX.sheet.plOpen=b.dataset.mplopen; rerender(); });
      q("[data-mplclose]",b=>b.onclick=()=>{ MX.sheet.plOpen=""; rerender(); });
      q("[data-msf]",el=>{ el.oninput=()=>{ d[el.dataset.msf]=el.value; }; el.onchange=()=>{ d[el.dataset.msf]=el.value;
        if(el.dataset.msf==="det"){ if(!isDefErr(d)) d.err=""; rerender(); } }; });   /* إظهار/إخفاء «اللاعب المخطئ» */
      q("[data-mzone]",z=>z.onclick=()=>{ d.zone=z.dataset.mzone; rerender(); });
      q("[data-mdetopen]",b=>b.onclick=()=>{ MX.sheet.detOpen=true; rerender(); });
      q("[data-mdetclose]",b=>b.onclick=()=>{ MX.sheet.detOpen=false; rerender(); });
      q("[data-mdet]",b=>b.onclick=()=>{ d.det=b.dataset.mdet; MX.sheet.detOpen=false; rerender(); });
      q(".mx-strip .picked",b=>{ try{ b.scrollIntoView({block:"nearest",inline:"center"}); }catch(e){} });
      q("[data-mstep]",b=>b.onclick=()=>{ const key=b.dataset.mstep; d[key]=String(Math.max(0,(+d[key]||0)+(+b.dataset.mby))); rerender(); });
      q("[data-mcommit]",b=>b.onclick=commitEv);
    }
    const pitch=box.querySelector("[data-mxpitch]");
    if(pitch){
      let cur=null, rect=null, moved=false, sx=0, sy=0;
      pitch.addEventListener("pointerdown",e=>{ const s=e.target.closest(".mx-spot"); if(!s) return;
        cur=s; rect=pitch.getBoundingClientRect(); moved=false; sx=e.clientX; sy=e.clientY; s.setPointerCapture(e.pointerId); e.preventDefault(); });
      pitch.addEventListener("pointermove",e=>{ if(!cur) return;
        if(!moved && Math.hypot(e.clientX-sx,e.clientY-sy)<6) return;
        moved=true; cur.classList.add("drag");
        const x=Math.max(9,Math.min(91,(rect.right-e.clientX)/rect.width*100));
        const y=Math.max(9,Math.min(92,(e.clientY-rect.top)/rect.height*100));
        cur.style.right=x+"%"; cur.style.top=y+"%"; });
      const up=()=>{ if(!cur) return; const n=cur.dataset.sp, cl=pitch.dataset.mxpitch;
        if(moved){ const S=slotsFor(cl), st=EDIT.shapes[cl]=EDIT.shapes[cl]||{f:"",pos:{}};
          if(!st.f) st.f=S.form;
          if(!Object.keys(fullPos(st.pos, S.spots.map(z=>z.p))).length) st.pos={};   /* مواضع ناقصة: نثبّت الترتيب الظاهر كله من جديد */
          /* أول سحب يثبّت مواضع الجميع كما تُرى، فلا يقفز الباقون عند تغيّر العدد */
          S.spots.forEach(({p,x,y})=>{ if(!st.pos[p.n]) st.pos[p.n]={x:+x.toFixed(1),y:+y.toFixed(1)}; });
          st.pos[n]={x:+parseFloat(cur.style.right).toFixed(1), y:+parseFloat(cur.style.top).toFixed(1)};
          cur.classList.remove("drag"); cur=null; }
        else { cur=null; MX.sel=(MX.sel===n?null:n); rerender(); } };
      pitch.addEventListener("pointerup",up); pitch.addEventListener("pointercancel",up);
    }
  }
  function removeStarter(cl,n){
    EDIT.lineup=EDIT.lineup.filter(x=>!(x.club===cl&&x.p===n));
    const st=EDIT.shapes[cl]; if(st&&st.pos&&st.pos[n]){ MX.vac=MX.vac||{}; (MX.vac[cl]=MX.vac[cl]||[]).push(st.pos[n]); delete st.pos[n]; }
  }
  function swapStarter(cl,outN,inN){
    const row=EDIT.lineup.find(x=>x.club===cl&&x.p===outN); if(row) row.p=inN; else EDIT.lineup.push({club:cl,p:inN});
    const st=EDIT.shapes[cl]; if(st&&st.pos&&st.pos[outN]){ st.pos[inN]=st.pos[outN]; delete st.pos[outN]; }
  }

  /* أداء 2026-11-14: يلفّ التنفيذ (ADMX.rma) لا الاسم العام — فيبقى أعمق غلاف كما كان داخل index.html،
     وأغلفة ext/gulf/mf-shell فوقه بالترتيب نفسه */
  const baseRender=ADMX.rma;
  ADMX.rma=function(){
    const box=$("#matchAdmin"); if(!box) return;
    if(MX.busy) return;
    MX.busy=true;
    try{
    if(!EDIT){ MX.sheet=null; MX.sel=null; MX.q=""; document.documentElement.classList.remove("mx-open","mx-editing"); const h=document.getElementById("mxSheetHost"); if(h) h.innerHTML=""; return baseRender(); }
    if(EDIT!==MX._edit){ MX._edit=EDIT; MX.tab=FORMERR?errTab(FORMERR):"match"; MX.side="home"; MX.sel=null; MX.q=""; MX.sheet=null; MX.vac={}; }
    else if(FORMERR) MX.tab=errTab(FORMERR);
    render(box);
    } finally { MX.busy=false; }
  };
})();
