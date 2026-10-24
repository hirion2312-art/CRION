// 게임 화면 점검용 가짜 window.crion (Electron 없이)
(function(){
  let settings={onboarded:true,volume:0,intensity:'mid',textSpeed:'instant',autoUpdate:true,packEnabled:{},packOptions:{},workUrls:{},registryUrl:''};
  window.crion={
    info:async()=>({version:'0.2.0',engineVersion:'0.2.0',engineSource:'bundled',crackOrigin:'https://crack.wrtn.ai',platform:'darwin',updatesEnabled:false}),
    engineReady:async()=>true,
    getSettings:async()=>JSON.parse(JSON.stringify(settings)),
    setSettings:async(p)=>{Object.assign(settings,p);return JSON.parse(JSON.stringify(settings));},
    getWorks:async()=>window.__WORKS,
    listPacks:async()=>({installed:[window.__PACK],available:[]}),
    installPack:async()=>({ok:true}), uninstallPack:async()=>({ok:true}),
    checkUpdates:async()=>({skipped:'no-registry',packs:[]}), relaunch:async()=>{}, openFolder:async()=>{}, openExternal:async()=>{},
    onPackProgress:()=>()=>{}, onUpdate:(fn)=>{window.__update=fn;return()=>{};}
  };
  window.__sent=[];
  HTMLElement.prototype.send=function(ch,d){window.__sent.push([ch,d]);};
  window.__crionAssetUrl=(pack,rel)=>'game/'+rel;   // 임시 그림 폴더로 연결
})();
