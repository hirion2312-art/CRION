// 브라우저 점검용 가짜 window.crion (Electron 없이 화면만 확인)
(function(){
  let settings={onboarded:false,volume:60,intensity:'mid',packEnabled:{},packOptions:{},workUrls:{},registryUrl:''};
  let installed=[]; const listeners=[];
  window.crion={
    info:async()=>({version:'0.1.0',crackPreload:'file:///x/preload-crack.js',crackOrigin:'https://crack.wrtn.ai',platform:'win32'}),
    getSettings:async()=>JSON.parse(JSON.stringify(settings)),
    setSettings:async(p)=>{Object.assign(settings,p);return JSON.parse(JSON.stringify(settings));},
    getWorks:async()=>window.__WORKS,
    listPacks:async()=>({installed:installed.slice(),available:[{id:'hirion.safehouse',name:'x',version:'1.0.0',source:'bundled'}]}),
    installPack:async(id)=>{for(let i=0;i<=8;i++){listeners.forEach(f=>f({id,done:i,total:8,file:i<8?'bgm/scene'+i+'.ogg':''}));await new Promise(r=>setTimeout(r,60));} installed=[window.__MAN]; return {ok:true,manifest:window.__MAN};},
    uninstallPack:async()=>{installed=[];return {ok:true};},
    openExternal:async()=>{},
    onPackProgress:(fn)=>{listeners.push(fn);return()=>{const i=listeners.indexOf(fn);if(i>=0)listeners.splice(i,1);};}
  };
  // webview 흉내: send 기록
  window.__sent=[];
  HTMLElement.prototype.send=function(ch,d){window.__sent.push([ch,d]);};
})();
