/* ══════════════════════════════════════════════════════════════
   nobet-firebase.js — ACİLX Nöbet Modülü: Firebase/Firestore entegrasyonu
   mod-nobet.html'den çıkarıldı — dokunulmadan taşındı
   Bağımlılık: nobet-core.js önce yüklenmelidir (S, AREAS, AREA_CLS, AREA_LBL, MONTHLY_KEYS, GLOBAL_KEYS vb.)
   ══════════════════════════════════════════════════════════════ */

/* ── ROL & UID ── */
(function(){
  try {
    const params = new URLSearchParams(window.location.search);
    window.ACILX_ROLE    = params.get('role')    || 'asistan';
    window.ACILX_UID     = params.get('uid')     || '';
    window.ACILX_GROUP   = params.get('groupId') || '';
  } catch(e) {
    window.ACILX_ROLE = 'asistan';
    window.ACILX_UID  = '';
  }
})();

/* ── Production log kontrolü ── */
// URL'de ?debug=1 yoksa console.log'ları sustur
(function(){
  if(!(new URLSearchParams(window.location.search)).has('debug')){
    var _noop=function(){};
    console.log=_noop;
  }
})();

/* ── Sunucu tarafı rol doğrulama ── */
// Firestore'dan kullanıcının gerçek rolünü çeker, cache'ler (30sn TTL)
var _verifiedRole = null;
var _roleVerifiedAt = 0;
async function verifyRole() {
  if (_verifiedRole && Date.now() - _roleVerifiedAt < 30000) return _verifiedRole;
  if (!_db || !window.ACILX_UID) { _verifiedRole = 'asistan'; return _verifiedRole; }
  try {
    var snap = await _db.collection('users').doc(window.ACILX_UID).get();
    _verifiedRole = (snap.exists && snap.data().role) || 'asistan';
  } catch(e) {
    _verifiedRole = _verifiedRole || 'asistan';
  }
  _roleVerifiedAt = Date.now();
  window.ACILX_ROLE = _verifiedRole;
  // Tercihler sekme adını güncelle
  var _tvBtn = document.getElementById('tab-btn-tercihler');
  if(_tvBtn) _tvBtn.textContent = _verifiedRole==='basasistan' ? 'Asistanlar' : 'Tercihlerim';
  return _verifiedRole;
}
async function isVerifiedBasasistan() {
  return (await verifyRole()) === 'basasistan';
}

/* ── Firestore bağlantısı (shell ile aynı config kullanılır) ──────────── */
/* Config shell'den mesaj olarak da alınabilir; şimdilik aynı config kopyalanır. */
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyB84OiA8dA8MqIDhp2mVPHbOwbfM7hXkcw",
  authDomain:        "acilx-d3635.firebaseapp.com",
  projectId:         "acilx-d3635",
  storageBucket:     "acilx-d3635.firebasestorage.app",
  messagingSenderId: "539148511591",
  appId:             "1:539148511591:web:4ca4f0eb49a1345c4fa7c2",
  measurementId:     "G-XX2XPQ9YVY"
};

let _fbApp, _db;
try {
  if (typeof firebase !== 'undefined') {
    try { _fbApp = firebase.app('nobet'); }
    catch(e) {
      try { _fbApp = firebase.app(); }
      catch(e2) { _fbApp = firebase.initializeApp(FIREBASE_CONFIG, 'nobet'); }
    }
    _db = firebase.firestore(_fbApp);
  }
} catch(e) {
  console.warn('[ACİLX Nobet] Firestore hatasi:', e.message);
}

/* ── Firestore yardımcıları ──────────────────────────────────────────── */
// Koleksiyon: schedules/{year_month}/state  (tek döküman)
// Koleksiyon: preferences/{uid}_{year_month} (asistan tercihleri)

function fsScheduleRef(y, m) {
  const gId = window.ACILX_GROUP || 'default';
  return _db.collection('groups').doc(gId).collection('schedule').doc(y + '_' + m);
}
function fsPreferenceRef(uid, y, m) {
  const gId = window.ACILX_GROUP || 'default';
  return _db.collection('groups').doc(gId).collection('preferences').doc(uid + '_' + y + '_' + m);
}

// Firestore'a state kaydet (sadece başasistan)
// Debounce — 1.5sn içinde birden fazla save() gelirse sadece son birini yaz
let _fsSaveTimer = null;
function fsSaveState() {
  if (!_db) return;
  if (window.ACILX_ROLE !== 'basasistan') return;
  if (!window._assistantsLoaded) return;
  clearTimeout(_fsSaveTimer);
  _fsSaveTimer = setTimeout(function(){
    // Yazma anında Firestore'dan rol doğrula
    isVerifiedBasasistan().then(function(ok){
      if (!ok) { console.warn('[ACİLX] fsSaveState engellendi — rol doğrulanamadı'); return; }
      _fsSaveNow();
    });
  }, 1500);
}
async function _fsSaveNow() {
  if (!_db) return;
  if (!window._assistantsLoaded) return;
  if (!window._fsReady) { console.log('[ACİLX] _fsSaveNow engellendi — fsReady=false'); return; }
  const {y, m} = S.currentDate;
  const schedLen = Object.keys(S.schedule||{}).length;
  console.log('[ACİLX] _fsSaveNow → Firestore (' + y + '_' + m + ')',
    'schedule:', schedLen,
    'kapaliGunler:', Object.keys(S.kapaliGunler||{}).length);
  try {
    await fsScheduleRef(y, m).set({
      schedule:          S.schedule,
      defaultDayMin:     S.defaultDayMin,
      minNobet:          S.minNobet,
      quota:             S.quota,
      maxHours:          S.maxHours,
      dayOverride:       S.dayOverride,
      monthOverride:     S.monthOverride,
      kapaliGunler:      S.kapaliGunler,
      prevMonthLastDay:  S.prevMonthLastDay,
      nextMonthFirstDay: S.nextMonthFirstDay,
      listName:          S.listName,
      astProfiles:       S.astProfiles,
      algoConfig:        S.algoConfig,
      updatedAt:         firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy:         window.ACILX_UID
    }, {merge: true});
    await _fsSaveAreas();
  } catch(err) {
    console.error('Firestore kayıt hatası:', err);
  }
}

// ── AREAS Firestore Kaydet/Yükle ──
async function _fsSaveAreas() {
  if (!_db || window.ACILX_ROLE !== 'basasistan') return;
  if (!(await isVerifiedBasasistan())) return;
  if (!window._areasLoaded && AREAS.length === 0) return;
  const gId = window.ACILX_GROUP || 'default';
  try {
    await _db.collection('groups').doc(gId).collection('assistants').doc('areas').set({
      list: AREAS.map(a => ({id:a.id, name:a.name, color:a.color})),
      // AREA_CLS ve AREA_LBL cache'lerini de kaydet
      areaCls: Object.assign({}, AREA_CLS),
      areaLbl: Object.assign({}, AREA_LBL),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: window.ACILX_UID
    });
  } catch(e) {
    console.warn('[ACİLX] AREAS kayıt hatası:', e);
  }
}

async function _fsLoadAreas() {
  if (!_db) return false;
  const gId = window.ACILX_GROUP || 'default';
  try {
    const snap = await _db.collection('groups').doc(gId).collection('assistants').doc('areas').get();
    if (snap.exists && snap.data().list && snap.data().list.length > 0) {
      const fsList = snap.data().list;
      AREAS.length = 0;
      fsList.forEach(a => AREAS.push({id:a.id, name:a.name, color:a.color}));
      // CLS ve LBL cache'lerini yükle
      if (snap.data().areaCls) Object.assign(AREA_CLS, snap.data().areaCls);
      if (snap.data().areaLbl) Object.assign(AREA_LBL, snap.data().areaLbl);
      console.log('[ACİLX] AREAS Firestore\'dan yüklendi:', AREAS.length);
      window._areasLoaded = true;
      return true;
    }
  } catch(e) {
    console.warn('[ACİLX] AREAS yükleme hatası:', e);
  }
  return false;
}

// Firestore'dan state yükle (tüm kullanıcılar okuyabilir)
async function fsLoadState(y, m) {
  if (!_db) return false;
  try {
    const snap = await fsScheduleRef(y, m).get();
    if (snap.exists) {
      const data = snap.data();

      // Race condition koruması: async yükleme sırasında ay değişmiş olabilir
      if (S.currentDate.y !== y || S.currentDate.m !== m) {
        console.warn('[ACİLX] fsLoadState: ay değişti, veri atıldı (' + y + '/' + (m+1) + ')');
        return false;
      }

      // Sadece ay-bazlı verileri yükle — global ayarları ezme
      // KRİTİK: Kullanıcı düzenleme yaptıysa Firestore ile ezme
      const _localEdited = !!window._scheduleUserEdited;
      MONTHLY_KEYS.forEach(k => {
        if (data[k] === undefined) return;
        if (k === 'schedule' && _localEdited) {
          console.log('[ACİLX] fsLoadState: kullanıcı düzenleme yaptı, schedule Firestore ile ezilmedi');
          return;
        }
        if (k === 'schedule') { _loadScheduleData(data[k]); }
        else { S[k] = data[k]; }
      });
      // Firestore yükledikten sonra düzenleme bayrağını temizle
      if(!_localEdited) window._scheduleUserEdited = false;

      // Global ayarları sadece ilk yüklemede al (initApp), changeMonth'ta değil
      if (window._fsInitialLoad) {
        console.log('[ACİLX] fsLoadState: İlk yükleme — global ayarlar Firestore\'dan alınıyor');
        GLOBAL_KEYS.forEach(k => {
          if (data[k] !== undefined) {
            console.log('[ACİLX] fsLoadState: global ' + k + ' yüklendi');
            S[k] = data[k];
          }
        });
        window._fsInitialLoad = false;
        // İlk yüklemede global ayarları ana cache'e yaz
        try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch(_) {}
      }
      // NOT: changeMonth sırasında ana LS_KEY cache'e yazma — cross-month contamination önlenir

      console.log('[ACİLX] fsLoadState: Firestore→S (' + y + '/' + (m+1) + ')',
        'schedule:', Object.keys(S.schedule||{}).length,
        'kapaliGunler:', Object.keys(S.kapaliGunler||{}).length);
      return true;
    } else {
      console.log('[ACİLX] fsLoadState: Firestore boş (' + y + '/' + (m+1) + ')');
    }
  } catch(e) {
    console.warn('Firestore okuma hatası:', e);
  }
  return false;
}

// Asistan tercihini kaydet
async function fsSavePreference(y, m) {
  if (!_db) return;
  const uid = window.ACILX_UID;
  if (!uid) return;
  const astIdx = ASSISTANTS.findIndex(a => a.id === parseInt(uid) || window.ACILX_ROLE === 'asistan');
  const profile = (S.astProfiles && S.astProfiles[astIdx]) || {};
  try {
    await fsPreferenceRef(uid, y, m).set({
      uid,
      tercihGunlerAylik: profile.tercihGunlerAylik || [],
      kacGunlerAylik:    profile.kacGunlerAylik    || [],
      durum:             profile.durum || 'aktif',
      updatedAt:         firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch(e) {
    console.warn('Tercih kayıt hatası:', e);
  }
}

/* ── Rol tabanlı UI kısıtları ────────────────────────────────────────── */
function applyRoleRestrictions() {
  const isBasasistan = window.ACILX_ROLE === 'basasistan';

  if (isBasasistan) {
    // Nav butonları
    const prevBtn = document.getElementById('apPrevBtn');
    const nextBtn = document.getElementById('apNextBtn');
    const badge   = document.getElementById('apIdxBadge');
    if(prevBtn) prevBtn.style.display = '';
    if(nextBtn) nextBtn.style.display = '';
    if(badge)   badge.style.display   = '';
    // Tercih Aç + Yayınla butonları
    const tercihBtn  = document.getElementById('tercihBtn');
    const yayinlaBtn = document.getElementById('yayinlaBtn');
    if(tercihBtn)  tercihBtn.style.display  = '';
    if(yayinlaBtn) yayinlaBtn.style.display = '';
  }

  // Başasistan olmayanlardan düzenleme yetkisini gizle
  if (!isBasasistan) {
    // Sekme erişimini kısıtla — asistan sadece kendi profil + özet sekmesini görür
    document.querySelectorAll('.tab').forEach(t => {
      const txt = t.textContent.trim();
      if(['Alanlar','Nöbet Dağılımı','⚙ Ayarlar'].includes(txt) || txt.startsWith('Sorunlar')){
        t.style.display = 'none';
      }
    });
    // Başlangıçta Profilim sekmesini aç
    setTimeout(()=>{
      const profileBtn = document.getElementById('tab-btn-astprofile');
      if(profileBtn) profileBtn.click();
    }, 100);

    // Otomatik oluştur + YZ + Onayla butonlarını gizle
    ['autoGen','yzOlustur'].forEach(fn => {
      document.querySelectorAll(`button[onclick="${fn}()"]`).forEach(b => b.style.display='none');
    });
    const yzBtn = document.getElementById('yzBtn');
    if (yzBtn) yzBtn.style.display = 'none';

    // Asistan için: nöbet ekle paneli + nav butonları gizli
    setTimeout(()=>{
      const addPanel = document.getElementById('apAddShiftPanel');
      if(addPanel) addPanel.style.display = 'none';
    }, 200);
    // Asistanlar sekmesini gizle (başasistan için görünür kalır)
    const tabBtns = document.querySelectorAll('.tab');
    tabBtns.forEach(t => {
    });

    // Alan doluluk ve nöbet dağılım sekmelerini salt-okunur yap
    // (tab içeriği render edilir ama input'lar devre dışı bırakılır)
    document.querySelectorAll('.ni').forEach(el => { el.disabled = true; el.style.opacity='.5'; });
  }

  // Rol badge — header'ın yanına ekle
  const existingBadge = document.getElementById('roleBadge');
  if (!existingBadge) {
    const badge = document.createElement('span');
    badge.id = 'roleBadge';
    badge.style.cssText = 'font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;font-family:\'DM Mono\',monospace;flex-shrink:0;';
    // Kıdem yüklenmeden önce placeholder
    if (isBasasistan) {
      badge.textContent = 'Başasistan';
      badge.style.background = 'rgba(232,87,42,.15)';
      badge.style.color = 'var(--red)';
      badge.style.border = '1px solid rgba(232,87,42,.3)';
    } else {
      badge.textContent = 'Asistan';
      badge.style.background = 'var(--bg4)';
      badge.style.color = 'var(--w3)';
      badge.style.border = '1px solid var(--bord)';
    }
    const listHeader = document.getElementById('listNameHeader');
    if (listHeader && listHeader.parentNode) {
      listHeader.parentNode.insertBefore(badge, listHeader.nextSibling);
    }
  }
}
