/* ══════════════════════════════════════════════════════════════
   nobet-core.js — ACİLX Nöbet Modülü: Temel fonksiyonlar & state
   mod-nobet.html'den çıkarıldı — dokunulmadan taşındı
   ══════════════════════════════════════════════════════════════ */

// ── XSS koruması — kullanıcı girdileri için ──
function _esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

let _spinCount=0, _spinTimer=null;
function showSpinner(){
  _spinCount++;
  if(!_spinTimer){
    _spinTimer=setTimeout(()=>{
      _spinTimer=null;
      if(_spinCount>0) document.getElementById('acilxSpinner').classList.add('on');
    },600); // 600ms'den kısa işlemlerde pervane çıkmaz
  }
}
function hideSpinner(){
  _spinCount=Math.max(0,_spinCount-1);
  if(_spinCount===0){
    if(_spinTimer){ clearTimeout(_spinTimer); _spinTimer=null; }
    document.getElementById('acilxSpinner').classList.remove('on');
  }
}

function niStep(btn,delta){
  const inp=btn.parentNode.querySelector('.ni');
  if(!inp) return;
  const mn=parseFloat(inp.min)||0, mx=parseFloat(inp.max)||999;
  inp.value=Math.max(mn,Math.min(mx,(parseFloat(inp.value)||0)+delta));
  inp.dispatchEvent(new Event('change',{bubbles:true}));
}

const MONTHS=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const DAYS_TR=['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];
const DAY_NAMES_FULL={0:'Pazar',1:'Pazartesi',2:'Salı',3:'Çarşamba',4:'Perşembe',5:'Cuma',6:'Cumartesi'};

// ── KRİTİK: Asistan ve alan verileri Firestore'dan yüklenir ──
// Hardcoded liste SADECE Firestore'da hiç veri yoksa ilk kurulumda kullanılır (fallback).
// Bir kez Firestore'a yazıldığında, hardcoded liste bir daha kullanılmaz.
const _DEFAULT_ASSISTANTS=[
  {id:0,name:'Süleyman Ekici',kidem:1},{id:1,name:'Taha Yaşar Kiraz',kidem:1},
  {id:2,name:'Berkay Başar',kidem:2},{id:3,name:'M. Akif Öğeç',kidem:2},{id:4,name:'Emre Can Göksu',kidem:2},
  {id:5,name:'Ahmet İnce',kidem:3},{id:6,name:'Ahmet Şengül',kidem:3},{id:7,name:'Şule Aldemir',kidem:3},
  {id:8,name:'Kevser Turhan',kidem:3},{id:9,name:'Ömer Faruk Ertürk',kidem:3},
  {id:10,name:'Buket Şahin',kidem:4},{id:11,name:'Buğrahan Şahin',kidem:4},
  {id:12,name:'Barış Berk Aşcı',kidem:4},{id:13,name:'Abidin Mirac Gülmez',kidem:4},{id:14,name:'Kemal Çakır',kidem:4},
  {id:15,name:'Dilara Kahyaoğlu',kidem:5},{id:16,name:'Beyza Çiftlikçi',kidem:5},
  {id:17,name:'Ayça Koca',kidem:5},{id:18,name:'İlknur Yıldırım',kidem:5},
];
const _DEFAULT_AREAS=[
  {id:'s1',name:'Sarı 1',color:'#EF9F27'},{id:'s2',name:'Sarı 2',color:'#BA7517'},
  {id:'r1',name:'Kırmızı 1',color:'#E24B4A'},{id:'r2',name:'Kırmızı 2',color:'#A32D2D'},
  {id:'mt',name:'Min. Travma',color:'#378ADD'},{id:'yp',name:'Y/S Pol',color:'#639922'},
];

// Başlangıçta BOŞ — Firestore'dan yüklenecek. Yüklenene kadar render yapılmamalı.
let ASSISTANTS = [];
let AREAS = [];
// Firestore'dan yüklendi mi? Bu bayrak true olmadan save() Firestore'a yazmaz.
window._assistantsLoaded = false;
window._areasLoaded      = false;

const AREA_CLS={s1:'c-s1',s2:'c-s2',r1:'c-r1',r2:'c-r2',mt:'c-mt',yp:'c-yp'};
const AREA_LBL={s1:'S1',s2:'S2',r1:'R1',r2:'R2',mt:'MT',yp:'YP'};
const KIDEM_CLS={1:'k1',2:'k2',3:'k3',4:'k4',5:'k5',6:'k5'};

// Alan etiketi otomatik üret: "Kırmızı 2" → "K2", "Sarı 1" → "S1", "Min. Travma" → "MT"
function alanKisalt(name){
  if(!name) return '??';
  const words = name.trim().split(/\s+/);
  const lastWord = words[words.length-1];
  const isNum = /^\d+$/.test(lastWord);
  if(isNum && words.length>=2){
    return words.slice(0,-1).map(w=>w[0].toUpperCase()).join('') + lastWord;
  }
  // "Pol" suffix: "Sarı Pol" → "SP"
  return words.map(w=>w[0].toUpperCase()).join('').slice(0,3);
}
function getAreaLabel(aId){
  if(AREA_LBL[aId]) return AREA_LBL[aId];
  const alan = AREAS.find(a=>a.id===aId);
  if(!alan) return aId.toUpperCase().slice(0,2);
  return alanKisalt(alan.name);
}

function getKidemLabel(k) {
  if(window._kidemIsimler && window._kidemIsimler[k-1]) return window._kidemIsimler[k-1];
  return 'K'+k;
}

// Ay-bazlı anahtarlar (her ay farklı, aydan aya sıfırlanır)
var MONTHLY_KEYS = ['schedule','dayOverride','monthOverride','kapaliGunler','prevMonthLastDay','nextMonthFirstDay'];
// Global anahtarlar (tüm aylarda aynı, ay geçişinde korunur)
var GLOBAL_KEYS = ['defaultDayMin','minNobet','quota','maxHours','listName','algoConfig','astProfiles'];

// ── KALICI STATE — localStorage'da saklanır ──
const LS_KEY = 'acilx_nobet_state';
const DEFAULT_STATE = {
  egBlocks:[],
  defaultDayMin:{
    s1:{min:1,max:3,kidemMin:{1:0,2:0,3:0,4:0,5:0},kidemMax:{1:0,2:0,3:0,4:0,5:0},kidemKurallari:{},siftler:['24h']},
    s2:{min:1,max:3,kidemMin:{1:0,2:0,3:0,4:0,5:0},kidemMax:{1:0,2:0,3:0,4:0,5:0},kidemKurallari:{},siftler:['24h']},
    r1:{min:2,max:4,kidemMin:{1:0,2:0,3:0,4:0,5:0},kidemMax:{1:0,2:0,3:0,4:0,5:0},kidemKurallari:{},siftler:['24h']},
    r2:{min:1,max:3,kidemMin:{1:0,2:0,3:0,4:0,5:0},kidemMax:{1:0,2:0,3:0,4:0,5:0},kidemKurallari:{},siftler:['24h']},
    mt:{min:1,max:3,kidemMin:{1:0,2:0,3:0,4:0,5:0},kidemMax:{1:0,2:0,3:0,4:0,5:0},kidemKurallari:{},siftler:['24h']},
    yp:{min:1,max:2,kidemMin:{1:0,2:0,3:0,4:0,5:0},kidemMax:{1:0,2:0,3:0,4:0,5:0},kidemKurallari:{},siftler:['24h']},
  },
  minNobet:{
    s1:{1:1,2:1,3:1,4:0,5:0},s2:{1:1,2:1,3:1,4:0,5:0},
    r1:{1:2,2:1,3:1,4:0,5:0},r2:{1:2,2:1,3:0,4:0,5:0},
    mt:{1:0,2:0,3:1,4:1,5:1},yp:{1:0,2:0,3:1,4:1,5:1},
  },
  quota:{
    s1:{1:5,2:5,3:4,4:3,5:2},s2:{1:5,2:5,3:4,4:3,5:2},
    r1:{1:6,2:5,3:3,4:1,5:0},r2:{1:6,2:5,3:3,4:2,5:0},
    mt:{1:3,2:3,3:4,4:5,5:5},yp:{1:2,2:2,3:3,4:5,5:6},
  },
  maxHours:{1:216,2:192,3:168,4:144,5:120},
  dayOverride:{},
  monthOverride:{},
  kapaliGunler:{},
  prevMonthLastDay:{}, // {astIdx: alanId} — önceki ayın son günü nöbetçiler
  nextMonthFirstDay:{}, // {astIdx: alanId} — sonraki ayın ilk günü nöbetçiler
  schedule:{},
  currentDate:{y:new Date().getFullYear(),m:new Date().getMonth()},
  listName:'Acil Servis Nöbet Listesi',
  astProfiles:{},
  // ── ALGORİTMA KONFİGÜRASYONU ──
  // Her hastane kendi kurallarını belirleyebilir.
  // Kurulum sihirbazında ayarlanır, sonra Ayarlar sekmesinden değiştirilebilir.
  algoConfig:{
    artArdaMesafe: 1,           // minimum gün arası (1=sadece art arda yasak, 2=en az 2 gün ara, 3=3 gün...)
    kacinmaGucu: 'guclu',       // 'sert'=asla yazılmaz | 'guclu'=son çare dışında yazılmaz | 'yumusak'=puanlama
    tercihCakisma: 'azTercih',  // 'azTercih'=az tercih yapan önce | 'kidemOnce'=üst kıdem önce | 'adaletli'=rotasyonlu | 'karma'
    weDengesi: 'toplamEsit',    // 'oranEsit'=WE/toplam oranı eşit | 'toplamEsit'=mutlak WE sayısı eşit | 'yok'=WE dengesi yok
    izinHedef: 'otoDusManuel',  // 'otoDus'=izin oranında düşür | 'sabit'=hedef sabit | 'otoDusManuel'=otomatik + başasistan override
    alanOncelikleri: null,      // null=otomatik (min/kıdem sırası) | ['s1','s2','r1',...]=manuel sıra
  },
  // astProfiles[i] = {
  //   durum: 'aktif'|'izinli'|'rot_evet'|'rot_hayir'
  //   sift: '24h'|'08-20'|'20-08'|'08-16'|'16-24'|'00-08'  (legacy, tekil)
  //   siftler: string[]  — birden fazla şift seçilebilir
  //   tercihGunler: number[]  — 0=Pzt..6=Paz (haftalık tercih)
  //   tercihGunlerAylik: number[]  — o ayın tercih ettiği günler (gün numaraları)
  //   kacGunlerAylik: number[]  — o ayın kaçındığı günler
  // }
};

function loadState(){
  try{
    const raw=localStorage.getItem(LS_KEY);
    if(!raw) return JSON.parse(JSON.stringify(DEFAULT_STATE));
    const saved=JSON.parse(raw);
    const base=JSON.parse(JSON.stringify(DEFAULT_STATE));
    // Deep merge — üst seviye alanları koru, alt alanları birleştir
    ['dayOverride','monthOverride','kapaliGunler','prevMonthLastDay','nextMonthFirstDay','schedule','currentDate','maxHours','astProfiles','listName','algoConfig'].forEach(k=>{
      if(saved[k]!==undefined) base[k]=saved[k];
    });
    // quota, minNobet, defaultDayMin için alan bazlı merge
    ['quota','minNobet','defaultDayMin'].forEach(section=>{
      if(saved[section]){
        Object.keys(saved[section]).forEach(aId=>{
          if(base[section][aId] && saved[section][aId]){
            Object.assign(base[section][aId], saved[section][aId]);
          }
        });
      }
    });
    return base;
  }catch(e){ return JSON.parse(JSON.stringify(DEFAULT_STATE)); }
}

const S = loadState();

// ═══════════════════════════════════════════════════════════════
// ART ARDA 24S + İZİN PROXY — S.schedule'a her yazma bu geçitten geçer
// Hiçbir fonksiyon, hiçbir koşulda bu kontrolü atlayamaz.
// ═══════════════════════════════════════════════════════════════
(function(){
  if(!S.schedule) S.schedule={};
  const _raw = S.schedule;
  // schedule'ı sıfırlamak için Proxy'yi koruyarak clear fonksiyonu
  window._clearSchedule = function(){ Object.keys(_raw).forEach(function(k){ delete _raw[k]; }); };
  // schedule'ı toptan yüklemek için Proxy üzerinden merge
  window._loadScheduleData = function(data){ window._clearSchedule(); if(data) Object.keys(data).forEach(function(k){ S.schedule[k]=data[k]; }); };
  S.schedule = new Proxy(_raw, {
    set: function(target, key, value){
      // gk formatı: "astIdx_d" — sadece bu formattaki anahtarları kontrol et
      const parts = String(key).split('_');
      if(parts.length===2 && !isNaN(parts[0]) && !isNaN(parts[1]) && value){
        const astIdx=parseInt(parts[0]), d=parseInt(parts[1]);
        if(ASSISTANTS[astIdx]){
          const _y=S.currentDate.y, _m=S.currentDate.m;
          const _days=daysInMonth(_y,_m);
          const _moKey=_y+'_'+_m;
          const prof=(S.astProfiles&&S.astProfiles[astIdx])||{};
          const dur=prof.durum||'aktif';
          const izinArr=((prof.izinliAylik)||{})[_moKey]||[];
          // İzin kontrolü
          if(dur==='izinli'||dur==='rot_hayir'){
            console.error('[HARD-BLOCK] İzinli asistana nöbet yazma ENGELLENDİ: ast='+astIdx+' gün='+d+' caller='+(new Error().stack||'').split('\n')[2]);
            return true; // Sessizce engelle — Proxy set true dönmeli
          }
          if(izinArr.includes(d)){
            console.error('[HARD-BLOCK] İzinli güne nöbet yazma ENGELLENDİ: ast='+astIdx+' gün='+d+' caller='+(new Error().stack||'').split('\n')[2]);
            return true;
          }
          // Art arda 24s kontrolü
          if(d>1 && target[astIdx+'_'+(d-1)]){
            console.error('[HARD-BLOCK] Art arda 24s nöbet ENGELLENDİ: ast='+astIdx+' gün='+d+' (önceki gün nöbetli) caller='+(new Error().stack||'').split('\n')[2]);
            return true;
          }
          if(d<_days && target[astIdx+'_'+(d+1)]){
            console.error('[HARD-BLOCK] Art arda 24s nöbet ENGELLENDİ: ast='+astIdx+' gün='+d+' (sonraki gün nöbetli) caller='+(new Error().stack||'').split('\n')[2]);
            return true;
          }
          if(d===1 && S.prevMonthLastDay && S.prevMonthLastDay[astIdx]){
            console.error('[HARD-BLOCK] Art arda 24s nöbet ENGELLENDİ: ast='+astIdx+' gün=1 (önceki ay son gün) caller='+(new Error().stack||'').split('\n')[2]);
            return true;
          }
          if(d===_days && S.nextMonthFirstDay && S.nextMonthFirstDay[astIdx]){
            console.error('[HARD-BLOCK] Art arda 24s nöbet ENGELLENDİ: ast='+astIdx+' gün='+d+' (sonraki ay ilk gün) caller='+(new Error().stack||'').split('\n')[2]);
            return true;
          }
        }
      }
      target[key] = value;
      return true;
    },
    deleteProperty: function(target, key){
      delete target[key];
      return true;
    },
    get: function(target, key){
      return target[key];
    },
    has: function(target, key){
      return key in target;
    },
    ownKeys: function(target){
      return Object.keys(target);
    },
    getOwnPropertyDescriptor: function(target, key){
      const val = target[key];
      if(val !== undefined) return {value:val, writable:true, enumerable:true, configurable:true};
      return Object.getOwnPropertyDescriptor(target, key);
    }
  });
})();

function save(){
  // Kullanıcı schedule'da değişiklik yaptıysa işaretle — fsLoadState Firestore ile ezmesin
  if(Object.keys(S.schedule||{}).length > 0) window._scheduleUserEdited = true;
  try{
    localStorage.setItem(LS_KEY, JSON.stringify(S));
    // Ay-bazlı cache de güncelle — changeMonth geri geldiğinde hızlı yükleme için
    const _sy=S.currentDate.y, _sm=S.currentDate.m;
    var _sc = {};
    MONTHLY_KEYS.forEach(function(k){ _sc[k] = S[k]; });
    GLOBAL_KEYS.forEach(function(k){ _sc[k] = S[k]; });
    localStorage.setItem(LS_KEY+'_'+_sy+'_'+_sm, JSON.stringify(_sc));
    const el=document.getElementById('globalSaved');
    if(el){el.style.display='inline';clearTimeout(el._t);el._t=setTimeout(()=>el.style.display='none',1800);}
  }catch(e){}
  if(window._fsReady && window._assistantsLoaded && typeof fsSaveState==='function') fsSaveState();
  // ── Kayıt sonrası UI'ı otomatik güncelle (debounce ile tek seferde) ──
  if(!save._rafPending){
    save._rafPending=true;
    requestAnimationFrame(()=>{
      save._rafPending=false;
      try{ refreshUI(); }catch(e){ console.warn('[ACİLX] save→refreshUI:',e); }
    });
  }
}

// ── MERKEZİ RENDER — save() sonrası requestAnimationFrame ile otomatik çağrılır ──
// Aynı frame'de birden fazla save() olursa sadece bir kez refreshUI() çalışır.
function refreshUI(){
  try {
    // Tercihler sekme adını role göre güncelle
    const _tBtn = document.getElementById('tab-btn-tercihler');
    if(_tBtn) _tBtn.textContent = window.ACILX_ROLE==='basasistan' ? 'Asistanlar' : 'Tercihlerim';

    if(typeof renderSchedule==='function'){
      renderSchedule(window._lastGenLog);
      if(typeof renderTakStats==='function') renderTakStats();
    } else {
      if(typeof renderNewCal==='function') renderNewCal();
      if(typeof renderTakStats==='function') renderTakStats();
      if(typeof _newView!=='undefined'){
        if(_newView===1 && typeof renderAsstList==='function') renderAsstList();
        if(_newView===2 && typeof renderAreaList==='function') renderAreaList();
      }
    }
    // Sorunlar sekmesi ve badge'i her save sonrası güncelle
    if(typeof renderSorunlar==='function') renderSorunlar();
    const ozTab = document.getElementById('tab-ozet');
    if(ozTab && ozTab.style.display !== 'none' && typeof renderOzet==='function') renderOzet();
    const apTab = document.getElementById('tab-astprofile');
    if(apTab && apTab.style.display !== 'none' && typeof _renderAstProfile==='function') _renderAstProfile();
  } catch(e) { console.warn('[ACİLX] refreshUI:', e); }
}

function resetState(){
  if(!confirm('Tüm ayarlar ve nöbet listesi sıfırlanacak. Emin misiniz?\n\nNOT: Asistan listesi ve alan tanımları korunacak.')) return;
  // KRİTİK: Asistan ve alan verilerini koru — bunlar bir kez girildikten sonra kaybolmamalı
  // Firestore'daki assistants/list ve areas/list dokümanları ZATen ayrı koleksiyonda,
  // localStorage'dan silinse bile Firestore'dan tekrar yüklenir.
  // Ama güvenlik için Firestore'a "sıfırlandı" bilgisi gönderme — sadece schedule sıfırla.
  _clearSchedule();
  S.dayOverride = {};
  S.monthOverride = {};
  S.kapaliGunler = {};
  S.prevMonthLastDay = {};
  S.nextMonthFirstDay = {};
  S.astProfiles = {};
  // defaultDayMin, minNobet, quota, maxHours, algoConfig KORUNUR
  save();
  // Render güncelle
  try{renderMinConf();}catch(e){console.warn('renderMinConf:',e);} try{renderDagilim();}catch(e){console.warn('renderDagilim:',e);} try{renderKota();}catch(e){console.warn('renderKota:',e);}
  try { renderNewCal(); } catch(e){}
  updateTercihUI();
  showToast('Liste sıfırlandı. Asistan ve alan verileri korundu.');
}

function showSaved(id){
  const el=document.getElementById(id);
  if(!el) return;
  el.style.display='inline-flex';
  clearTimeout(el._t);
  el._t=setTimeout(()=>el.style.display='none',2000);
}

function gk(i,d){return i+'_'+d}
function daysInMonth(y,m){return new Date(y,m+1,0).getDate()}
function isWE(y,m,d){const dw=new Date(y,m,d).getDay();return dw===0||dw===6}
function getDOW(y,m,d){const dw=new Date(y,m,d).getDay();return dw===0?6:dw-1}

function getEgtStatus(){return null;}
function isEgtFull(){return false;}
function getDayRule(day,aId,_y,_m){
  const y=_y!==undefined?_y:S.currentDate.y, m=_m!==undefined?_m:S.currentDate.m;
  const base=(S.dayOverride[day]&&S.dayOverride[day][aId])||S.defaultDayMin[aId]||{min:1,max:3};
  // Spesifik gün kapatma kontrolü (aylık takvimden)
  const moKey=y+'_'+m;
  const kapaliKey=moKey+'_'+aId;
  if(S.kapaliGunler&&S.kapaliGunler[kapaliKey]&&S.kapaliGunler[kapaliKey].includes(day))
    return {min:0,max:0,aktif:false};
  return {...base,aktif:true};
}
function isAlanAktif(day,aId,_y,_m){
  return getDayRule(day,aId,_y,_m).aktif!==false;
}
function countArea(i,aId){
  const y=S.currentDate.y,mo=S.currentDate.m;
  const days=daysInMonth(y,mo);
  let c=0;for(let d=1;d<=days;d++){if(S.schedule[gk(i,d)]===aId)c++;}return c;
}
function countAll(i){
  const y=S.currentDate.y,mo=S.currentDate.m;
  const days=daysInMonth(y,mo);
  let c=0;for(let d=1;d<=days;d++){if(S.schedule[gk(i,d)])c++;}return c;
}
function getAreaCount(day,aId){return ASSISTANTS.filter((_,i)=>S.schedule[gk(i,day)]===aId).length;}

// FIX: eğitim full olan günleri min hesabına dahil etme
function checkDayMin(day){
  const y=S.currentDate.y,mo=S.currentDate.m;
  const viols=[];
  AREAS.forEach(a=>{
    const rule=getDayRule(day,a.id);
    if(rule.min===0) return;
    const eligible=ASSISTANTS.filter(ast=>{
      const eq=getEgtStatus(y,mo,day,ast.kidem);
      if(eq&&eq.type==='full') return false;
      return true;
    });
    const canEnter=eligible.filter(ast=>(S.quota[a.id]||{})[ast.kidem]>0);
    if(canEnter.length===0) return;
    const cnt=getAreaCount(day,a.id);
    if(cnt<rule.min) viols.push(`${a.name}: ${cnt}/${rule.min}`);
  });
  return viols;
}

// Toast mesajı
function showToast(msg) {
  let toast = document.getElementById('acilxToast');
  if(!toast) {
    toast = document.createElement('div');
    toast.id = 'acilxToast';
    toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1A1818;border:1px solid rgba(232,87,42,0.4);color:#F2EEE8;padding:10px 18px;border-radius:8px;font-size:12px;font-weight:600;z-index:9999;transition:opacity .3s;font-family:Inter,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,0.5)';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.style.opacity='0'; }, 3000);
}
