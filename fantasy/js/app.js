/* هيكل التطبيق: التوجيه، الشريط العلوي، الإشعارات */
'use strict';

const APP = {
  route:'dashboard',
  NAV: [
    ['dashboard','home','الرئيسية'], ['team','shirt','فريقي'],
    ['players','users','اللاعبون'], ['fixtures','cal','المباريات'],
    ['leagues','trophy','الدوريات'], ['stats','stats','إحصائيات'],
  ],

  init(){
    DB.load();
    if(!DB.me()) AUTH.guest();
    ADMINAUTH.sync();
    document.documentElement.setAttribute('data-theme','light');
    window.addEventListener('hashchange',()=>{
      const r=location.hash.slice(1)||'dashboard';
      if(r!==this.route){ this.route=r; this.render(); }
    });
    this.route=location.hash.slice(1)||'dashboard';
    this.checkDeadline();
    this.render();
    setInterval(()=>this.tickCountdown(),30000);
    setInterval(()=>REMIND.check(),60000);
    REMIND.check();
    // شاشة الافتتاح
    const splash=document.getElementById('splash');
    if(splash) setTimeout(()=>{ splash.classList.add('hide'); setTimeout(()=>splash.remove(),700); }, 1500);
  },

  go(route){ this.route=route; location.hash=route; this.render(); window.scrollTo(0,0); },

  toggleTheme(){
    const cur=document.documentElement.getAttribute('data-theme')==='light'?'dark':'light';
    if(cur==='light') document.documentElement.setAttribute('data-theme','light');
    else document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('kwf_theme',cur==='light'?'light':'');
    this.render();
  },

  checkDeadline(){
    const st=DB.state; const m=DB.me();
    if(!m) return;
    const g=DB.gw(st.currentGW);
    if(!g) return;
    const ms=new Date(g.deadline)-new Date();
    // تذكير قبل الإغلاق بيوم
    if(ms>0 && ms<86400000){
      const key='dl'+st.currentGW;
      const has=(st.notifications[m.id]||[]).some(n=>n.type===key);
      if(!has){ NOTIF.push(m.id,key,`تذكير: تُغلق الجولة ${st.currentGW} بعد ${UI.countdown(g.deadline)}`); DB.save(); }
    }
    // قفل التشكيلة عند تجاوز الموعد
    const team=DB.myTeam();
    if(team && team.squad.length && GWADMIN.deadlinePassed(st.currentGW) && !team.gwPicks[st.currentGW]){
      GWADMIN.snapshotPicks(team, st.currentGW);
      DB.save();
    }
  },

  tickCountdown(){ if(['dashboard','team','transfers'].includes(this.route)) this.render(); },
  onLiveTick(){ if(this.route==='live') this.render(); },

  render(){
    if(!DB.me()) AUTH.guest();   // بدون تسجيل دخول — حساب محلي تلقائي
    const m=DB.me();
    const main=document.getElementById('main');
    document.getElementById('topbar').style.display='flex';
    document.getElementById('bottomnav').style.display='';
    this.checkDeadline();
    this.renderTopbar();
    let html='';
    const r=this.route;
    try{
      if(r==='team') html=VIEWS.team();
      else if(r==='transfers'){ VIEWS.ui.teamView='market'; this.route='team'; html=VIEWS.team(); }
      else if(r==='players') html=VIEWS.players();
      else if(r==='player') html=VIEWS.player();
      else if(r==='fixtures') html=VIEWS.fixtures();
      else if(r==='live') html=VIEWS.live();
      else if(r==='leagues') html=VIEWS.leagues();
      else if(r==='stats') html=VIEWS.stats();
      else if(r==='points') html=VIEWS.points();
      else if(r==='profile') html=VIEWS.profile();
      else if(r==='compare') html=VIEWS.compare();
      else if(r==='champions') html=VIEWS.champions();
      else if(r==='about') html=VIEWS.about();
      else if(r==='admin') html=ADMIN.view();
      else html=VIEWS.dashboard();
    }catch(e){
      console.error(e);
      html=`<div class="card" style="border-color:var(--red)"><h3>حدث خطأ</h3><div class="tiny">${esc(e.message)}</div>
        <button class="btn sm sec" style="margin-top:10px" onclick="APP.go('dashboard')">العودة للرئيسية</button></div>`;
    }
    main.innerHTML=`<div class="view">${html}</div>`;
    this.renderBottomNav();
  },

  renderTopbar(){
    const m=DB.me();
    const nav=document.getElementById('navlinks');
    nav.innerHTML=this.NAV.map(([id,ic,l])=>
      `<button class="${this.route===id?'active':''}" onclick="APP.go('${id}')">${l}</button>`).join('')
      + (ADMINAUTH.active()? `<button class="${this.route==='admin'?'active':''}" onclick="APP.go('admin')">الإدارة</button>`:'');
    const unread=NOTIF.unread();
    document.getElementById('topActions').innerHTML=`
      <button class="iconbtn" title="الإشعارات" onclick="APP.toggleNotif()">${UI.icon('bell',18)}${unread?`<span class="dot">${unread}</span>`:''}</button>
      <div id="userchip" onclick="APP.go('profile')"><div class="av">${UI.icon('users',15)}</div><span class="uc-name">${esc(m.username)}</span></div>`;
  },
  renderBottomNav(){
    const m=DB.me(); if(!m) return;
    const items=[['dashboard','home','الرئيسية'],['team','shirt','فريقي'],['players','users','اللاعبون'],['leagues','trophy','دوريات']];
    if(ADMINAUTH.active()) items.push(['admin','gear','إدارة']);
    document.getElementById('bottomnav').innerHTML=items.map(([id,ic,l])=>
      `<button class="${this.route===id?'active':''}" onclick="APP.go('${id}')"><span class="ic">${UI.icon(ic,21)}</span>${l}</button>`).join('');
  },

  toggleNotif(){
    const ex=document.getElementById('notifPanel');
    if(ex){ ex.remove(); return; }
    const list=NOTIF.mine();
    const panel=document.createElement('div');
    panel.id='notifPanel';
    panel.innerHTML=`<div class="row spread" style="padding:6px 8px"><b>الإشعارات</b>
      <button class="btn sm sec" onclick="NOTIF.markAll();APP.render();document.getElementById('notifPanel')?.remove()">تمييز الكل كمقروء</button></div>
      ${list.length? list.map(n=>`<div class="notif-item ${n.read?'':'unread'}">${esc(n.text)}
        <div class="ts">${UI.fmtDateShort(n.ts)}</div></div>`).join('') : '<div class="muted" style="padding:14px">لا إشعارات بعد</div>'}`;
    document.body.appendChild(panel);
  },
};

document.addEventListener('DOMContentLoaded',()=>APP.init());
