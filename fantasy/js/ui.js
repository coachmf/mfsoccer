/* أدوات الواجهة المشتركة */
'use strict';

/* أيقونات SVG خطية (بدل الإيموجي) */
const ICONS = {
  plane:'M21 4 3.5 11l6.7 2.3M21 4l-5.5 16.5-4.3-7.2M21 4 11.2 13.3',
  home:'M3 10.8 12 3.5l9 7.3M5.4 9.3V20a.7.7 0 0 0 .7.7h11.8a.7.7 0 0 0 .7-.7V9.3M9.6 20.4v-6h4.8v6',
  shirt:'M8.2 4.2 4 6.6l1.6 4 2-.9v9.8h8.8v-9.8l2 .9 1.6-4-4.2-2.4a3.7 3.7 0 0 1-7.6 0Z',
  swap:'M7 8.5h12m0 0-3.4-3.4M19 8.5l-3.4 3.4M17 15.5H5m0 0 3.4-3.4M5 15.5l3.4 3.4',
  live:'M12 11.6a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2Zm-4.2 6a6 6 0 0 1 0-8.5m8.4 0a6 6 0 0 1 0 8.5M5 20a10 10 0 0 1 0-13.3m14 0a10 10 0 0 1 0 13.3',
  trophy:'M7 4.5h10v4a5 5 0 0 1-10 0v-4Zm-3 1h3m14 0h-3M4 5.5v1.6a3 3 0 0 0 3 3m13-4.6v1.6a3 3 0 0 1-3 3M12 13.5v3m-3.4 3h6.8m-5.6-3h4.4',
  stats:'M5 20V12m4.7 8V6m4.6 14v-5.4M19 20V9',
  cal:'M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm3-2.5V7m8-3.5V7M4 10.4h16',
  users:'M9 12a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 12Zm-5.4 8a5.4 5.4 0 0 1 10.8 0M15.5 6.2a3.2 3.2 0 0 1 0 5.6m2 8.2a5.4 5.4 0 0 0-3-4.8',
  gear:'M4.5 8h9m3.6 0h2.4M13.5 8a2 2 0 1 0 4 0 2 2 0 0 0-4 0ZM4.5 16h2.4m5.6 0h7M6.9 16a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z',
  bell:'M12 4a5.2 5.2 0 0 0-5.2 5.2c0 4-1.6 5.4-2.3 6.3h15c-.7-.9-2.3-2.3-2.3-6.3A5.2 5.2 0 0 0 12 4Zm-2 14a2.1 2.1 0 0 0 4 0',
  moon:'M19.5 13.5A7.5 7.5 0 0 1 10.5 4.5 7.8 7.8 0 1 0 19.5 13.5Z',
  clock:'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 3.6V12l3.2 2',
  chev:'m14.5 6-6 6 6 6',
  wallet:'M4 7.5A1.5 1.5 0 0 1 5.5 6h11A1.5 1.5 0 0 1 18 7.5V9h2v8.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-10ZM18 9H5.5M15.5 13.8h2.6',
  spark:'M12 3.5 13.8 9l5.7.2-4.5 3.5 1.6 5.6L12 15l-4.6 3.3 1.6-5.6L4.5 9.2 10.2 9 12 3.5Z',
  ball:'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm0 5 3.3 2.4-1.2 3.9H9.9l-1.2-3.9L12 8.5Zm0-5v3m8 2.8-2.8 1m-13.2-1 2.9 1m10 8.4-1.8-2.4m-8.4 2.4 1.8-2.4',
  news:'M5 5h11v14H6.5A1.5 1.5 0 0 1 5 17.5V5Zm11 3h3v9.5a1.5 1.5 0 0 1-1.5 1.5M8 8.5h5M8 12h5m-5 3.5h5',
};
const UI = {
  icon(name, size){
    size=size||20;
    const d=ICONS[name]; if(!d) return '';
    return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
  },
  toast(msg, err){
    const box=document.getElementById('toasts');
    const el=document.createElement('div');
    el.className='toast'+(err?' err':''); el.textContent=msg;
    box.appendChild(el);
    setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity .4s'; setTimeout(()=>el.remove(),400); }, 3400);
  },
  modal(html){
    this.closeModal();
    const back=document.createElement('div'); back.id='modalBack';
    back.innerHTML=`<div id="modalBox">${html}</div>`;
    back.addEventListener('click',e=>{ if(e.target===back) UI.closeModal(); });
    document.body.appendChild(back);
  },
  closeModal(){ const b=document.getElementById('modalBack'); if(b) b.remove(); },
  /* نافذة سفلية منسحبة (على طراز FPL) */
  sheet(html){
    this.closeSheet();
    const back=document.createElement('div'); back.id='sheetBack';
    back.innerHTML=`<div class="psheet"><div class="ps-grab"></div>${html}</div>`;
    back.addEventListener('click',e=>{ if(e.target===back) UI.closeSheet(); });
    document.body.appendChild(back);
  },
  closeSheet(){ const b=document.getElementById('sheetBack'); if(b) b.remove(); },

  crest(clubId, cls){
    const c=DB.club(clubId);
    return `<img class="crest ${cls||''}" src="${c.crest}" alt="${esc(c.name)}" title="${esc(c.name)}">`;
  },
  playerPhoto(p){
    if(p.photo) return p.photo;
    if(typeof PLAYER_PHOTOS!=='undefined'){
      const v=PLAYER_PHOTOS[p.club+'|'+p.name];
      if(typeof v==='number') return 'assets/players/'+v+'.png';
      if(typeof v==='string') return 'assets/players/'+v;
    }
    return null;
  },
  playerAvatar(p, size){
    size=size||36;
    const c=DB.club(p.club);
    const ph=this.playerPhoto(p);
    if(ph) return `<img class="avatar" style="width:${size}px;height:${size}px;object-fit:cover;background:#eef2f7;border:2px solid ${c.color}" src="${esc(ph)}" alt="" loading="lazy">`;
    return `<div class="avatar" style="width:${size}px;height:${size}px;background:#fff;border:2px solid ${c.color}">
      <img src="${c.crest}" alt="" style="width:68%;height:68%;object-fit:contain" loading="lazy"></div>`;
  },
  shirtStyle(clubId){
    const c=DB.club(clubId);
    return `background:linear-gradient(160deg, ${c.color}, ${c.dark})`;
  },
  /* قميص النادي (SVG) — الحارس بطقم مختلف مثل الواقع */
  kitShirt(clubId, isGK, w){
    const c=DB.club(clubId);
    const k=(typeof KITS!=='undefined' && KITS[clubId]) || {body:c.color, trim:'#ffffff', gk:'#555'};
    const body = isGK? k.gk : k.body;
    const trim = isGK? '#ffffff' : k.trim;
    w=w||56;
    const line='rgba(0,0,0,.22)';
    return `<svg class="kit" width="${w}" height="${Math.round(w*0.9)}" viewBox="0 0 100 90" aria-hidden="true">
      <path d="M50 13 C42 13 36 8 33 4 L8 15 L18 40 L28 35 L28 82 Q50 90 72 82 L72 35 L82 40 L92 15 L67 4 C64 8 58 13 50 13 Z"
        fill="${body}" stroke="${line}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M33 4 L8 15 L18 40 L28 35 L28 24 Z" fill="${trim}" stroke="${line}" stroke-width="2"/>
      <path d="M67 4 L92 15 L82 40 L72 35 L72 24 Z" fill="${trim}" stroke="${line}" stroke-width="2"/>
      <path d="M33 4 C36 8 42 13 50 13 C58 13 64 8 67 4 L61 1.5 C58 6.5 42 6.5 39 1.5 Z" fill="${trim}" stroke="${line}" stroke-width="1.6"/>
    </svg>`;
  },
  statusPill(p){
    if(p.status==='i') return '<span class="pill red">مصاب</span>';
    if(p.status==='s') return '<span class="pill red">موقوف</span>';
    if(p.status==='d') return '<span class="pill gold">مشكوك</span>';
    return '';
  },
  fdrPill(f){
    return `<span class="fdr l${f.lvl}" title="${f.label}">${DB.club(f.opp).short} ${UI.icon(f.home?'home':'plane',10)}</span>`;
  },
  fmtDate(iso){
    const d=new Date(iso);
    return d.toLocaleDateString('ar-KW',{weekday:'long',day:'numeric',month:'long'})+' — '+d.toLocaleTimeString('ar-KW',{hour:'2-digit',minute:'2-digit'});
  },
  fmtDateShort(iso){
    const d=new Date(iso);
    return d.toLocaleDateString('ar-KW',{day:'numeric',month:'short'})+' '+d.toLocaleTimeString('ar-KW',{hour:'2-digit',minute:'2-digit'});
  },
  countdown(iso){
    const ms=new Date(iso)-new Date();
    if(ms<=0) return 'انتهى الموعد';
    const d=Math.floor(ms/86400000), h=Math.floor(ms%86400000/3600000), m=Math.floor(ms%3600000/60000);
    if(d>0) return `${d} يوم و ${h} ساعة`;
    if(h>0) return `${h} ساعة و ${m} دقيقة`;
    return `${m} دقيقة`;
  },
  /* رسم خطي بسيط SVG */
  lineChart(points, w, h, color){
    w=w||600; h=h||160; color=color||'var(--accent)';
    if(!points.length) return '<div class="muted" style="text-align:center;padding:30px">لا توجد بيانات بعد</div>';
    const max=Math.max(...points.map(p=>p.y), 5), min=Math.min(...points.map(p=>p.y),0);
    const px=i=> 30 + (w-50)*(points.length===1?0.5:i/(points.length-1));
    const py=v=> h-24 - (h-42)*((v-min)/(max-min||1));
    let path='';
    points.forEach((p,i)=>{ path += (i===0?'M':'L')+px(i).toFixed(1)+','+py(p.y).toFixed(1)+' '; });
    const dots=points.map((p,i)=>`<circle cx="${px(i)}" cy="${py(p.y)}" r="3.6" fill="${color}"/>
      <text x="${px(i)}" y="${py(p.y)-9}" text-anchor="middle" font-size="10" fill="var(--text2)">${p.y}</text>
      <text x="${px(i)}" y="${h-6}" text-anchor="middle" font-size="9" fill="var(--text3)">${esc(String(p.x))}</text>`).join('');
    return `<svg class="chart" viewBox="0 0 ${w} ${h}" style="direction:ltr">
      <path d="${path}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/>
      ${dots}</svg>`;
  },
  bar(pct, color){
    return `<div style="background:var(--surface2);border-radius:6px;height:8px;overflow:hidden">
      <div style="width:${Math.min(100,pct)}%;height:100%;background:${color||'var(--accent)'};border-radius:6px"></div></div>`;
  },
};
