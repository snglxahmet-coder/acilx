/* ═══════════════════════════════════════════════════════════════
   nobet-config.js — Ayarlar ve Yapılandırma
   Alan ekle/sil, alan kapalı günler, asistan profil yönetimi,
   nöbet yayınlama, kıdem yapısı, algoritma config, tercih dönemi
   ═══════════════════════════════════════════════════════════════ */
/* ── ALAN EKLE / SİL ── */
let _selectedAlanColor = '#EF9F27';

function selectAlanColor(c){
  _selectedAlanColor = c;
  document.querySelectorAll('#alanColorPicker > div').forEach(d=>{
    d.style.border = d.dataset.color===c ? '2px solid #fff' : '2px solid transparent';
  });
  document.getElementById('alanColorPreview').style.background = c;
  document.getElementById('alanColorVal').textContent = c+' seçili';
}

function openAlanModal(){
  _selectedAlanColor = '#EF9F27';
  document.getElementById('alanName').value = '';
  document.getElementById('alanMin').value = '1';
  document.getElementById('alanMax').value = '3';
  selectAlanColor('#EF9F27');
  document.getElementById('alanModal').classList.add('open');
}
function closeAlanModal(){ document.getElementById('alanModal').classList.remove('open'); }

function saveAlan(){
  if(window.ACILX_ROLE!=='basasistan') return;
  const name = document.getElementById('alanName').value.trim();
  if(!name){ alert('Alan adı girin.'); return; }
  const id = 'custom_'+Date.now();
  // AREAS dizisine ekle
  AREAS.push({id, name, color:_selectedAlanColor});
  AREA_CLS[id] = 'c-s1';
  AREA_LBL[id] = name.substring(0,3).toUpperCase();
  // State'e ekle
  S.defaultDayMin[id] = {
    min: parseInt(document.getElementById('alanMin').value)||0,
    max: parseInt(document.getElementById('alanMax').value)||0,
    kidemMin:{1:0,2:0,3:0,4:0,5:0},
    kidemMax:{1:0,2:0,3:0,4:0,5:0},
    kidemKurallari:{},
    siftler:['24h']
  };
  S.minNobet[id] = {1:1,2:1,3:1,4:0,5:0};
  S.quota[id] = {1:5,2:5,3:4,4:3,5:2};
  closeAlanModal();
  // KRİTİK: AREAS'ı Firestore'a hemen kaydet
  if(_db && window.ACILX_ROLE === 'basasistan') {
    _fsSaveAreas().catch(e => console.warn('Alan kayıt hatası:', e));
  }
  save();showSaved('minSaved');
  try{renderMinConf();}catch(e){} try{renderDagilim();}catch(e){} try{renderKota();}catch(e){}
}

function deleteAlan(aId){
  if(window.ACILX_ROLE!=='basasistan') return;
  if(!confirm('Bu alanı silmek istediğinizden emin misiniz?')) return;
  const idx = AREAS.findIndex(a=>a.id===aId);
  if(idx>-1) AREAS.splice(idx,1);
  delete S.defaultDayMin[aId];
  delete S.minNobet[aId];
  delete S.quota[aId];
  // Bu alana yapılmış tüm atamaları temizle
  Object.keys(S.schedule).forEach(k=>{ if(S.schedule[k]===aId) delete S.schedule[k]; });
  // Kapali günlerden de temizle
  if(S.kapaliGunler){
    Object.keys(S.kapaliGunler).forEach(k=>{ if(k.endsWith('_'+aId)) delete S.kapaliGunler[k]; });
  }
  // Alan etiket/cls cache temizle
  if(typeof AREA_LBL !== 'undefined') delete AREA_LBL[aId];
  if(typeof AREA_CLS !== 'undefined') delete AREA_CLS[aId];
  // KRİTİK: AREAS'ı Firestore'a hemen kaydet
  if(_db && window.ACILX_ROLE === 'basasistan') {
    _fsSaveAreas().catch(e => console.warn('Alan silme kayıt hatası:', e));
  }
  save();showSaved('minSaved');
  try{renderMinConf();}catch(e){} try{renderDagilim();}catch(e){} try{renderKota();}catch(e){}
  renderNewCal(); // takvimi güncelle
  // Uyarılar içeriğini de temizle
  const uyEl = document.getElementById('uyarilarContent');
  if(uyEl) uyEl.innerHTML = '';
}

/* ── ALAN KAPALI GÜNLER TAKVİM ── */
let _akAlanId = null;
let _akCalY = new Date().getFullYear();
let _akCalM = new Date().getMonth();

function openAkModal(aId){
  _akAlanId = aId;
  _akCalY = S.currentDate.y;
  _akCalM = S.currentDate.m;
  const alan = AREAS.find(a=>a.id===aId);
  document.getElementById('akTitle').textContent = (alan?alan.name:'Alan') + ' — Kapalı Günler';
  renderAkCal();
  document.getElementById('alanKapaliModal').classList.add('open');
}
function closeAkModal(){ document.getElementById('alanKapaliModal').classList.remove('open'); }

function akCalPrev(){ _akCalM--; if(_akCalM<0){_akCalM=11;_akCalY--;} renderAkCal(); }
function akCalNext(){ _akCalM++; if(_akCalM>11){_akCalM=0;_akCalY++;} renderAkCal(); }

function getAkKey(){ return _akCalY+'_'+_akCalM+'_'+_akAlanId; }

function renderAkCal(){
  const title = document.getElementById('akCalTitle');
  if(title) title.textContent = MONTHS[_akCalM]+' '+_akCalY;
  const grid = document.getElementById('akCalGrid');
  if(!grid) return;
  if(!S.kapaliGunler) S.kapaliGunler = {};
  const key = getAkKey();
  const kapalilar = S.kapaliGunler[key] || [];
  const days = daysInMonth(_akCalY, _akCalM);
  const firstDow = new Date(_akCalY, _akCalM, 1).getDay();
  const offset = firstDow===0?6:firstDow-1;
  let html = '';
  for(let i=0;i<offset;i++) html += '<div></div>';
  for(let d=1;d<=days;d++){
    const kapali = kapalilar.includes(d);
    const dow = new Date(_akCalY,_akCalM,d).getDay();
    const isWe = dow===0||dow===6;
    html += `<div onclick="akToggle(${d})" style="
      text-align:center;padding:5px 2px;cursor:pointer;border-radius:5px;font-size:11px;font-weight:500;
      background:${kapali?'var(--red)':'transparent'};
      color:${kapali?'#fff':isWe?'var(--w4)':'var(--w2)'};
      transition:background .1s;
    ">${d}</div>`;
  }
  grid.innerHTML = html;
  // Label güncelle
  const lbl = document.getElementById('akSelLabel');
  if(lbl) lbl.textContent = kapalilar.length ? kapalilar.sort((a,b)=>a-b).join(', ')+'. günler' : 'Yok';
  // Alan kartındaki sayacı güncelle
  const cnt = document.getElementById('akCount_'+_akAlanId);
  if(cnt) cnt.textContent = kapalilar.length ? kapalilar.length+' gün kapalı' : '';
}

function akToggle(d){
  if(!S.kapaliGunler) S.kapaliGunler = {};
  const key = getAkKey();
  if(!S.kapaliGunler[key]) S.kapaliGunler[key] = [];
  const idx = S.kapaliGunler[key].indexOf(d);
  if(idx>-1) S.kapaliGunler[key].splice(idx,1);
  else S.kapaliGunler[key].push(d);
  renderAkCal();
}

function akClearAll(){
  if(!S.kapaliGunler) return;
  const key = getAkKey();
  S.kapaliGunler[key] = [];
  renderAkCal();
}

function saveAkModal(){
  save();showSaved('minSaved');
  closeAkModal();
  renderMinConf();
}

document.getElementById('alanModal').addEventListener('click',function(e){if(e.target===this)closeAlanModal();});
document.getElementById('alanKapaliModal').addEventListener('click',function(e){if(e.target===this)closeAkModal();});

function openAstEkleModal(){
  document.getElementById('astEkleName').value  = '';
  document.getElementById('astEkleEmail').value = '';
  // Kıdem dropdown'u dinamik doldur
  const sel = document.getElementById('astEkleKidem');
  if(sel) {
    const n = window._kidemSayisi || 5;
    sel.innerHTML = '';
    for(let k=1;k<=n;k++) {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = 'K'+k+' — '+(getKidemLabel(k));
      sel.appendChild(opt);
    }
  }
  document.getElementById('astEkleModal').classList.add('open');
}
function closeAstEkleModal(){
  document.getElementById('astEkleModal').classList.remove('open');
}

function saveAstEkle(){
  if(window.ACILX_ROLE!=='basasistan') return;
  const name  = document.getElementById('astEkleName').value.trim();
  const kidem = parseInt(document.getElementById('astEkleKidem').value);
  const email = document.getElementById('astEkleEmail').value.trim().toLowerCase();
  if(!name){ alert('Ad Soyad gerekli.'); return; }

  const newId = ASSISTANTS.length;
  const newAst = {id: newId, name, kidem};
  if(email) newAst.email = email;

  ASSISTANTS.push(newAst);
  window._assistantsLoaded = true; // Artık asistan verisi mevcut

  // Firestore'a kaydet (rol doğrulamalı)
  if(_db){
    isVerifiedBasasistan().then(function(ok){
      if(!ok) return;
      var _gId = window.ACILX_GROUP || 'default';
      return _db.collection('groups').doc(_gId).collection('assistants').doc('list').set({
        list: ASSISTANTS,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: window.ACILX_UID
      });
    }).catch(function(e){ console.warn('Asistan kayıt hatası:', e); showToast('Kayıt hatası — tekrar deneyin'); });
  }

  closeAstEkleModal();
  showSaved('astSaved');
  save();
  renderAsistanlar();
  renderDagilim();
  renderNewCal();
}

function confirmDeleteAst(idx){
  const ast = ASSISTANTS[idx];
  if(!ast) return;
    if(!confirm(ast.name + " listeden cikarilacak. Nobetleri de silinecek. Emin misiniz?")) return;
  deleteAst(idx);
}

function deleteAst(idx){
  if(window.ACILX_ROLE!=='basasistan') return;
  const {y,m} = S.currentDate;
  const days = daysInMonth(y,m);
  // Nöbet atamalarını temizle
  for(let d=1;d<=days;d++){
    delete S.schedule[gk(idx,d)];
  }
  // Asistanı listeden çıkar
  ASSISTANTS.splice(idx,1);
  // ID'leri güncelle
  ASSISTANTS.forEach((a,i)=>{ a.id=i; });

  // Firestore'a kaydet (rol doğrulamalı)
  if(_db){
    isVerifiedBasasistan().then(function(ok){
      if(!ok) return;
      var _gIdDel = window.ACILX_GROUP || 'default';
      return _db.collection('groups').doc(_gIdDel).collection('assistants').doc('list').set({
        list: ASSISTANTS,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: window.ACILX_UID
      });
    }).catch(function(e){ console.warn('Asistan silme hatası:', e); showToast('Silme hatası — tekrar deneyin'); });
  }

  save();
  showSaved('astSaved');
  renderAsistanlar();
  renderDagilim();
  renderNewCal();
}

// Pending (onay bekleyen) kullanıcıları göster
async function loadPendingUsers(){
  if(!_db || window.ACILX_ROLE !== 'basasistan') return;
  try {
    const snap = await _db.collection('users')
      .where('status','==','pending').get();
    if(snap.empty){
      document.getElementById('pendingAstList').style.display = 'none';
      return;
    }
    // Mevcut asistanlar listesi (eşleştirilmemiş olanlar)
    const eslestirilmemis = ASSISTANTS
      .map((a,i)=>({...a,idx:i}))
      .filter(a=>!a.uid);

    let html = '';
    snap.forEach(doc=>{
      const u = doc.data();
      const displayName = u.name || u.email;

      // Mevcut asistanlar dropdown'u
      const astOptions = eslestirilmemis.map(a=>
        `<option value="match_${a.idx}">${a.name} (K${a.kidem})</option>`
      ).join('');

      html += `<div style="background:var(--bg2);border:1px solid rgba(240,160,64,0.25);border-radius:8px;padding:10px 12px;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <div style="width:32px;height:32px;border-radius:50%;background:rgba(240,160,64,0.15);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--orange);flex-shrink:0">
            ${displayName[0].toUpperCase()}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:700;color:var(--w1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${displayName}</div>
            <div style="font-size:10px;color:var(--w3)">${u.email}</div>
          </div>
          <button onclick="rejectUser('${doc.id}')" style="background:none;border:none;cursor:pointer;color:var(--w4);font-size:14px;flex-shrink:0" title="Reddet">✕</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <div style="font-size:10px;color:var(--w3);font-weight:600;text-transform:uppercase;letter-spacing:.4px">Eşleştir:</div>
          <select id="pendingAction_${doc.id}" onchange="togglePendingKidem('${doc.id}',this.value)"
            style="width:100%;padding:6px 8px;border:1px solid var(--bord);border-radius:6px;font-size:11px;background:var(--bg3);color:var(--w1);font-family:var(--font-sans)">
            <option value="">-- Seçin --</option>
            ${astOptions}
            <option value="new">+ Yeni asistan olarak ekle</option>
          </select>
          <div id="pendingKidemRow_${doc.id}" style="display:none;flex-direction:column;gap:4px">
            <div style="font-size:10px;color:var(--w3)">Kıdem:</div>
            <select id="pendingKidem_${doc.id}" style="width:100%;padding:6px 8px;border:1px solid var(--bord);border-radius:6px;font-size:11px;background:var(--bg3);color:var(--w1)">
              <option value="1">K1 — 1. Yıl</option><option value="2">K2 — 2. Yıl</option>
              <option value="3">K3 — 3. Yıl</option><option value="4">K4 — 4. Yıl</option>
              <option value="5">K5 — 5. Yıl</option>
            </select>
          </div>
          <button onclick="approveUser('${doc.id}','${u.email}','${displayName}')"
            style="width:100%;padding:7px;border-radius:6px;background:var(--red);color:#fff;border:none;cursor:pointer;font-size:11px;font-weight:700;font-family:var(--font-sans)">
            Onayla
          </button>
        </div>
      </div>`;
    });
    document.getElementById('pendingAstItems').innerHTML = html;
    document.getElementById('pendingAstList').style.display = '';
  } catch(e) {
    console.warn('Pending users hatasi:', e);
  }
}

function togglePendingKidem(uid, val){
  const row = document.getElementById('pendingKidemRow_'+uid);
  if(row) row.style.display = val==='new' ? 'flex' : 'none';
}

async function approveUser(uid, email, name){
  if(!(await isVerifiedBasasistan())){ showToast('Yetkiniz yok'); return; }
  const action = document.getElementById('pendingAction_'+uid)?.value;
  if(!action){ alert('Lütfen bir seçim yapın.'); return; }

  if(action.startsWith('match_')){
    // Mevcut asistanla eşleştir
    const astIdx = parseInt(action.replace('match_',''));
    const ast = ASSISTANTS[astIdx];
    if(!ast){ alert('Asistan bulunamadı.'); return; }
    // UID ve email'i ASSISTANTS'a ekle
    ASSISTANTS[astIdx].uid   = uid;
    ASSISTANTS[astIdx].email = email.toLowerCase();
    // Firestore'da kullanıcı güncelle
    await _db.collection('users').doc(uid).update({
      status: 'approved',
      role:   'asistan',
      kidem:  ast.kidem,
      astIdx
    });
  } else {
    // Yeni asistan olarak ekle
    const kidem = parseInt(document.getElementById('pendingKidem_'+uid)?.value||'1');
    const newAst = {id:ASSISTANTS.length, name, kidem, email:email.toLowerCase(), uid};
    ASSISTANTS.push(newAst);
    await _db.collection('users').doc(uid).update({
      status: 'approved',
      role:   'asistan',
      kidem,
      astIdx: ASSISTANTS.length-1
    });
  }

  window._assistantsLoaded = true; // Asistan verisi güncel

  // Asistan listesini Firestore'a kaydet
  const _gIdApprove = window.ACILX_GROUP || 'default';
  await _db.collection('groups').doc(_gIdApprove).collection('assistants').doc('list').set({
    list: ASSISTANTS,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: window.ACILX_UID
  });

  save();
  loadPendingUsers();
  renderAsistanlar();
  showSaved('astSaved');
}

async function rejectUser(uid){
  if(!(await isVerifiedBasasistan())){ showToast('Yetkiniz yok'); return; }
  if(!confirm('Bu kullaniciyi reddetmek istediginizden emin misiniz?')) return;
  await _db.collection('users').doc(uid).update({status:'rejected'});
  loadPendingUsers();
}

/* ══════════════════════════════════════════
   TERCİH DÖNEMİ + NÖBET YAYINLA
══════════════════════════════════════════ */

// Firestore settings referansı
function fsSettingsRef(y, m) {
  if(!_db) return null;
  const gId = window.ACILX_GROUP || 'default';
  // y ve m verilmezse mevcut ayı kullan
  const _y = y !== undefined ? y : S.currentDate.y;
  const _m = m !== undefined ? m : S.currentDate.m;
  const ayKey = _y + '_' + _m;
  return _db.collection('groups').doc(gId).collection('settings').doc('nobet_' + ayKey);
}

// Sayfa yüklenince ayarları çek
async function loadNobetSettings() {
  window._myAstIdx = -1;
  if(!_db) {
    _applyFallbackData();
    return;
  }
  showSpinner();
  try {
    // 0. Rolü Firestore'dan doğrula (URL parametresine güvenme)
    await verifyRole();

    // 0b. Grup bilgisini çek (kıdem yapısı)
    const gId = window.ACILX_GROUP || 'default';
    const groupSnap = await _db.collection('groups').doc(gId).get();
    if(groupSnap.exists) {
      const gData = groupSnap.data();
      if(gData.kidemSayisi) window._kidemSayisi = gData.kidemSayisi;
      if(gData.kidemIsimler) window._kidemIsimler = gData.kidemIsimler;
    }

    // 1. Asistan listesini Firestore'dan çek (group bazlı)
    const astSnap = await _db.collection('groups').doc(gId).collection('assistants').doc('list').get();
    if(astSnap.exists && astSnap.data().list && astSnap.data().list.length > 0) {
      const fsList = astSnap.data().list;
      // Mevcut ASSISTANTS'ı güncelle
      ASSISTANTS.length = 0;
      fsList.forEach((a,i) => ASSISTANTS.push({...a, id:i}));
      window._assistantsLoaded = true;
      console.log('[ACİLX] Asistanlar yuklendi:', ASSISTANTS.length);
    } else if(ASSISTANTS.length === 0) {
      // Firestore'da asistan yok ve bellekte de yok — ilk kurulum, fallback kullan
      console.log('[ACİLX] İlk kurulum — varsayılan asistan listesi yükleniyor');
      _DEFAULT_ASSISTANTS.forEach((a,i) => ASSISTANTS.push({...a, id:i}));
      window._assistantsLoaded = true;
      // İlk kez Firestore'a kaydet
      if(window.ACILX_ROLE === 'basasistan') {
        await _db.collection('groups').doc(gId).collection('assistants').doc('list').set({
          list: ASSISTANTS,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: window.ACILX_UID
        }).catch(e => console.warn('İlk asistan kayıt hatası:', e));
      }
    } else {
      // Bellekte zaten var (önceki yüklemeden) — koru
      window._assistantsLoaded = true;
    }

    // 1b. AREAS listesini Firestore'dan çek
    const areasLoaded = await _fsLoadAreas();
    if(!areasLoaded && AREAS.length === 0) {
      // Firestore'da alan yok — ilk kurulum, fallback kullan
      console.log('[ACİLX] İlk kurulum — varsayılan alan listesi yükleniyor');
      _DEFAULT_AREAS.forEach(a => AREAS.push({...a}));
      window._areasLoaded = true;
      // İlk kez Firestore'a kaydet
      if(window.ACILX_ROLE === 'basasistan') {
        await _fsSaveAreas();
      }
    } else if(!areasLoaded) {
      window._areasLoaded = true; // Bellekte zaten var
    }

    // 2. Tüm kullanıcıları çek ve ASSISTANTS ile eşleştir (email/isim)
    try {
      const usersSnap = await _db.collection('users').get();
      usersSnap.forEach(doc => {
        const u = doc.data();
        const uEmail = (u.email || '').toLowerCase();
        const uName  = (u.name  || '').toLowerCase();
        const uId    = doc.id;
        // ASSISTANTS içinde eşleşen var mı?
        // SADECE uid veya email ile eşleştir — isim bazlı asla
      const idx = ASSISTANTS.findIndex(a => {
          if(a.uid === uId) return true;
          if(a.email && uEmail && a.email.toLowerCase() === uEmail) return true;
          return false;
        });
        if(idx > -1) {
          // UID ve email'i kaydet (sessizce)
          ASSISTANTS[idx].uid   = uId;
          ASSISTANTS[idx].email = uEmail;
        }
      });
    } catch(e) { console.warn('Kullanici eslestirme hatasi:', e); }

    // 3. Kendi index'ini bul — astIdx, uid veya email ile
    if(window.ACILX_UID) {
      const mySnap = await _db.collection('users').doc(window.ACILX_UID).get();
      let idx = -1;
      if(mySnap.exists) {
        const myData = mySnap.data();
        const astIdx = parseInt(myData.astIdx); if(!isNaN(astIdx) && astIdx >= 0) idx = astIdx;
        if(idx === -1) idx = ASSISTANTS.findIndex(a => a.uid === window.ACILX_UID);
        if(idx === -1 && myData.email) idx = ASSISTANTS.findIndex(a =>
          a.email && a.email.toLowerCase() === myData.email.toLowerCase()
        );
        if(idx > -1 && ASSISTANTS[idx]) {
          ASSISTANTS[idx].uid   = window.ACILX_UID;
          ASSISTANTS[idx].email = myData.email || '';
        }
      }
      window._myAstIdx = idx;
      console.log('[ACİLX] myAstIdx:', idx, window.ACILX_UID);
    }
    // 3. Bu aya ait nöbet ayarlarını yükle
    const {y,m} = S.currentDate;
    const settSnap = await fsSettingsRef(y,m).get();
    if(settSnap && settSnap.exists) {
      const data = settSnap.data();
      window._tercihAcik   = data.tercihAcik  || false;
      window._nobetYayinda = data.nobetYayinda || false;
      window._tercihAy     = data.tercihAy     || null;
    } else {
      window._tercihAcik   = false;
      window._nobetYayinda = false;
      window._tercihAy     = null;
    }
    updateTercihUI();
  } catch(e) {
    console.warn('[ACİLX] loadNobetSettings hatası:', e);
    // Hata olursa fallback'leri uygula
    _applyFallbackData();
  } finally {
    hideSpinner();
  }
}

// Firestore yokken veya hata durumunda varsayılan verileri yükle
function _applyFallbackData() {
  if(ASSISTANTS.length === 0) {
    _DEFAULT_ASSISTANTS.forEach((a,i) => ASSISTANTS.push({...a, id:i}));
    window._assistantsLoaded = true;
    console.log('[ACİLX] Fallback: varsayılan asistanlar yüklendi');
  }
  if(AREAS.length === 0) {
    _DEFAULT_AREAS.forEach(a => AREAS.push({...a}));
    window._areasLoaded = true;
    console.log('[ACİLX] Fallback: varsayılan alanlar yüklendi');
  }
}

/* ── NÖBET OLUŞTUR / SİL / YAYINLA ── */

async function nobetYayindanKaldir(){
  if(!_db) return;
  if(!(await isVerifiedBasasistan())){ showToast('Yetkiniz yok'); return; }
  if(!confirm('Nöbeti yayından kaldırmak istediğinden emin misin?')) return;
  window._nobetYayinda = false;
  showSpinner();
  try {
    const {y,m} = S.currentDate;
    await fsSettingsRef(y,m).set({ nobetYayinda: false, yayinAy: null }, { merge: true });
    await sendPushToAll('yayin_kaldir', '📋 Nöbet Güncellendi', 'Bu ayki nöbet listesi güncelleniyor.');
    updateTercihUI();
    showToast('Nöbet yayından kaldırıldı');
  } catch(e) { showToast('Hata oluştu'); }
  finally { hideSpinner(); }
}

async function toggleTercihDonem() {
  if(!_db || window.ACILX_ROLE !== 'basasistan') return;
  if(!(await isVerifiedBasasistan())){ showToast('Yetkiniz yok'); return; }
  const {y,m} = S.currentDate;
  const yeni = !window._tercihAcik;
  window._tercihAcik = yeni;
  const tercihAy = yeni ? {y, m} : null;
  window._tercihAy = tercihAy;
  showSpinner();
  try {
    await fsSettingsRef(y,m).set({
      tercihAcik: yeni,
      tercihAy:   tercihAy
    }, { merge: true });
    updateTercihUI();
    if(yeni) {
      await sendPushToAll('tercih', '📋 Tercih Dönemi Açıldı', 'Nöbet tercihlerinizi girebilirsiniz.');
      showToast('Tercih dönemi açıldı.');
    } else {
      showToast('Tercih dönemi kapatıldı.');
    }
  } catch(e) { console.error('Tercih toggle hatası:', e); }
  finally { hideSpinner(); }
}

async function nobetYayinla() {
  if(!_db || window.ACILX_ROLE !== 'basasistan') return;
  if(!(await isVerifiedBasasistan())){ showToast('Yetkiniz yok'); return; }
  if(!confirm('Nöbet listesini yayınlamak istediğinizden emin misiniz? Asistanlar bildirim alacak.')) return;
  window._nobetYayinda = true;
  showSpinner();
  try {
    const {y,m} = S.currentDate;
    await fsSettingsRef(y,m).set({
      nobetYayinda: true,
      yayinAy: y + '_' + m,
      yayinTarih: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    await _fsSaveNow();
    await sendPushToAll('yayin', '✅ Nöbet Listesi Yayınlandı', 'Bu ayki nöbet listeniz hazır!');
    updateTercihUI();
    showToast('Nöbet listesi yayınlandı!');
  } catch(e) { console.error('Yayinla hatasi:', e); }
  finally { hideSpinner(); }
}

// Push bildirimi gönder (Firestore üzerinden — SW yakalar)
async function sendPushToAll(type, title, body) {
  if(!_db) return;
  try {
    await _db.collection('notifications').add({
      type, title, body,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      read: false
    });
  } catch(e) { console.warn('Push gönderim hatası:', e); }
}



function updateKidemIsim(idx, val){
  if(!window._kidemIsimler) window._kidemIsimler = [];
  window._kidemIsimler[idx] = val;
}

function updateKidemSayisi(n){
  window._kidemSayisi = n;
  renderAyarlar();
}

async function saveKidemYapisi(){
  if(!_db) { showSaved('ayarSaved'); return; }
  const gId = window.ACILX_GROUP || 'default';
  showSpinner();
  try {
    await _db.collection('groups').doc(gId).update({
      kidemSayisi:  window._kidemSayisi || 5,
      kidemIsimler: (window._kidemIsimler||[]).slice(0, window._kidemSayisi||5)
    });
    showSaved('ayarSaved');
    showToast('Kıdem yapısı kaydedildi');
  } catch(e) { showToast('Kayıt hatası'); }
  finally { hideSpinner(); }
}

function toggleAlanSift(aId,sift){
  const r=S.defaultDayMin[aId];
  if(!r.siftler) r.siftler=['24h'];
  const idx=r.siftler.indexOf(sift);
  if(idx>=0){
    if(r.siftler.length===1) return; // en az 1 şift kalmalı
    r.siftler.splice(idx,1);
  } else {
    r.siftler.push(sift);
  }
  save();showSaved('minSaved');renderMinConf();
}

let _aomIdx=null;
function openAstOverride(i){
  _aomIdx=i;
  const ast=ASSISTANTS[i];
  const y=S.currentDate.y,mo=S.currentDate.m;
  const moKey=y+'_'+mo;
  const defHedef=Math.round(S.maxHours[ast.kidem]/24);
  const mevcutHedef=_hesaplaHedef(i);
  const MONTHS_TR=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

  document.getElementById('aomTitle').textContent=ast.name;
  document.getElementById('aomSub').textContent=
    MONTHS_TR[mo]+' '+y+' için nöbet hedefi — normal: '+defHedef+' nöbet';
  document.getElementById('aomBody').innerHTML=`
    <div style="margin:12px 0 6px;font-size:12px;color:var(--w3)">Bu ay kaç nöbet tutsun?</div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <button onclick="stepAom(-1)" style="width:32px;height:32px;border-radius:6px;border:1px solid var(--bord);background:var(--bg3);color:var(--w1);font-size:18px;cursor:pointer;line-height:1">−</button>
      <input id="aomVal" type="number" min="0" max="31" value="${mevcutHedef}"
        style="width:64px;text-align:center;padding:6px;border:1px solid var(--bord);border-radius:6px;background:var(--bg3);color:var(--w1);font-size:18px;font-weight:700">
      <button onclick="stepAom(1)" style="width:32px;height:32px;border-radius:6px;border:1px solid var(--bord);background:var(--bg3);color:var(--w1);font-size:18px;cursor:pointer;line-height:1">+</button>
      <span style="font-size:12px;color:var(--w3)">nöbet</span>
    </div>
    <div style="font-size:11px;color:var(--w4)">0 = bu ay hiç nöbet yok &nbsp;·&nbsp; Normal hedef: ${defHedef}</div>
    ${ov!==undefined&&ov!==null?`<div style="font-size:11px;color:#7DC44A;margin-top:6px">✓ Bu ay için özel hedef aktif</div>`:''}
  `;
  document.getElementById('aomClear').style.display=
    (ov!==undefined&&ov!==null)?'inline-flex':'none';
  document.getElementById('astOverrideModal').classList.add('open');
}
function stepAom(n){
  const el=document.getElementById('aomVal');
  el.value=Math.max(0,Math.min(31,(parseInt(el.value)||0)+n));
}
function closeAstOverride(){
  document.getElementById('astOverrideModal').classList.remove('open');
  _aomIdx=null;
}
function saveAstOverride(){
  if(_aomIdx===null) return;
  const val=parseInt(document.getElementById('aomVal').value)||0;
  const y=S.currentDate.y,mo=S.currentDate.m;
  const moKey=y+'_'+mo;
  if(!S.monthOverride) S.monthOverride={};
  if(!S.monthOverride[moKey]) S.monthOverride[moKey]={};
  S.monthOverride[moKey][_aomIdx]=val;
  save();
  closeAstOverride();
  autoGen();
}
function clearAstOverride(){
  if(_aomIdx===null) return;
  const y=S.currentDate.y,mo=S.currentDate.m;
  const moKey=y+'_'+mo;
  if(S.monthOverride&&S.monthOverride[moKey])
    delete S.monthOverride[moKey][_aomIdx];
  save();
  closeAstOverride();
  autoGen();
}
document.getElementById('astOverrideModal').addEventListener('click',function(e){
  if(e.target===this) closeAstOverride();
});

/* ── GÜNLÜK ALAN KAPATMA ── */
function toggleKapaliGun(aId, day){
  const y=S.currentDate.y,mo=S.currentDate.m;
  const moKey=y+'_'+mo;
  const kapaliKey=moKey+'_'+aId;
  if(!S.kapaliGunler) S.kapaliGunler={};
  if(!S.kapaliGunler[kapaliKey]) S.kapaliGunler[kapaliKey]=[];
  const arr=S.kapaliGunler[kapaliKey];
  const idx=arr.indexOf(day);
  if(idx>=0) arr.splice(idx,1);    // açık → kapat
  else arr.push(day);               // kapalı → aç
  save();
  autoGen();
}

function renderAsistanlar(){
  const y=S.currentDate.y,mo=S.currentDate.m;
  const moKey=y+'_'+mo;
  const MONTHS_TR=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const ayAdi=MONTHS_TR[mo]+' '+y;

  let html='';
  ASSISTANTS.forEach((ast,i)=>{
    const defH=Math.round(S.maxHours[ast.kidem]/24);
    const ov=S.monthOverride&&S.monthOverride[moKey]&&S.monthOverride[moKey][i];
    const prof=S.astProfiles&&S.astProfiles[i]?S.astProfiles[i]:{};
    const durum=prof.durum||'aktif';
    const aktifH=_hesaplaHedef(i);
    const isRot=(ov!==undefined&&ov!==null);
    const siftler=(prof.siftler&&prof.siftler.length)?prof.siftler:[prof.sift||'24h'];
    const DURUM_LABELS={'aktif':'Aktif','izinli':'İzinli','rot_evet':'Rotasyon+','rot_hayir':'Rotasyon-'};
    const DURUM_COLORS={'aktif':'#7DC44A','izinli':'#E87070','rot_evet':'#E8A84E','rot_hayir':'#888'};
    const SIFT_LABELS={'24h':'24s','08-20':'08-20','20-08':'20-08','08-16':'08-16','16-24':'16-24','00-08':'00-08'};
    let mevcut=0; for(let d=1;d<=daysInMonth(y,mo);d++){if(S.schedule[gk(i,d)])mevcut++;}

    html+=`<div class="eg-card" style="margin-bottom:5px;${durum==='izinli'||durum==='rot_hayir'?'opacity:.65':''}">
      <!-- Başlık satırı — tıkla aç/kapat -->
      <div class="eg-head" onclick="toggleAstAccordion(${i})" style="cursor:pointer;user-select:none">
        <div style="display:flex;align-items:center;gap:7px;flex:1;min-width:0">
          <span class="kt ${KIDEM_CLS[ast.kidem]}" style="font-size:10px;padding:1px 5px;flex-shrink:0">K${ast.kidem}</span>
          <span style="font-size:12px;font-weight:700;color:var(--w1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(ast.name)}</span>
          <span style="font-size:9px;padding:1px 5px;border-radius:3px;background:${DURUM_COLORS[durum]}22;color:${DURUM_COLORS[durum]};flex-shrink:0">${DURUM_LABELS[durum]}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          <span style="font-size:11px;color:var(--w3);font-family:'DM Mono',monospace">${mevcut}/${aktifH}</span>
          <span id="astAccChevron_${i}" style="font-size:11px;color:var(--w4);transition:transform .2s">▸</span>
          <button onclick="event.stopPropagation();confirmDeleteAst(${i})" style="background:none;border:none;cursor:pointer;color:var(--w4);font-size:13px;padding:2px 4px"
            onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--w4)'">✕</button>
        </div>
      </div>
      <!-- Gizli ayarlar -->
      <div id="astAccBody_${i}" style="display:none">
        <div class="eg-body">
          <div class="eg-row">
            <span class="eg-lbl">Durum</span>
            <select onchange="setAstProp(${i},'durum',this.value)" style="font-size:12px;padding:3px 7px;border:1px solid var(--bord);border-radius:5px;background:var(--bg3);color:var(--w1);font-family:var(--font-sans)">
              <option value="aktif" ${durum==='aktif'?'selected':''}>Aktif</option>
              <option value="izinli" ${durum==='izinli'?'selected':''}>İzinli</option>
              <option value="rot_evet" ${durum==='rot_evet'?'selected':''}>Rotasyon (nöbet tutar)</option>
              <option value="rot_hayir" ${durum==='rot_hayir'?'selected':''}>Rotasyon (nöbet tutmaz)</option>
            </select>
          </div>
          <div class="eg-row">
            <span class="eg-lbl">Şift</span>
            <div style="display:flex;gap:4px;flex-wrap:wrap">
              ${[{v:'24h',lbl:'24s'},{v:'08-20',lbl:'Gündüz'},{v:'20-08',lbl:'Gece'},{v:'08-16',lbl:'Sabah'},{v:'16-24',lbl:'Akşam'},{v:'00-08',lbl:'Gece2'}].map(s=>{
                const sel=siftler.includes(s.v);
                return `<button onclick="toggleAstSift(${i},'${s.v}')" style="padding:3px 8px;border-radius:4px;cursor:pointer;font-size:10px;font-family:var(--font-sans);border:${sel?'2px solid var(--red)':'1px solid var(--bord)'};background:${sel?'var(--red-sub)':'var(--bg4)'};color:${sel?'var(--red)':'var(--w3)'}">${s.lbl}</button>`;
              }).join('')}
            </div>
          </div>
          <div class="eg-row">
            <span class="eg-lbl">Normal hedef</span>
            <span style="font-size:13px;color:var(--w2)">${defH} nöbet/ay${izinGunleri>0?' <span style="font-size:11px;color:#B090E0">('+izinGunleri+' gün izinli → otomatik '+autoH+')</span>':''}</span>
          </div>
          <div class="eg-row" style="border-bottom:none">
            <span class="eg-lbl">${ayAdi} hedefi</span>
            <div style="display:flex;align-items:center;gap:6px">
              <button onclick="stepAstH(${i},-1)" style="width:26px;height:26px;border-radius:5px;border:1px solid var(--bord);background:var(--bg4);color:var(--w1);font-size:15px;cursor:pointer;line-height:1">−</button>
              <input id="astH_${i}" type="number" min="0" max="31" value="${aktifH}"
                style="width:48px;text-align:center;padding:4px;border:1px solid var(--bord);border-radius:5px;background:var(--bg3);color:var(--w1);font-size:14px;font-weight:700"
                onchange="setAstH(${i},parseInt(this.value)||0)">
              <button onclick="stepAstH(${i},1)" style="width:26px;height:26px;border-radius:5px;border:1px solid var(--bord);background:var(--bg4);color:var(--w1);font-size:15px;cursor:pointer;line-height:1">+</button>
              ${isRot?`<button onclick="clearAstH(${i})" style="font-size:10px;padding:2px 7px;border-radius:4px;border:1px solid var(--bord);background:var(--bg3);color:var(--w3);cursor:pointer">↺</button>`:''}
            </div>
          </div>
        </div>
      </div>
    </div>`;
  });
  const _ag=document.getElementById('astGrid'); if(_ag) _ag.innerHTML=html;
  loadPendingUsers();
}

function toggleAstAccordion(i){
  const body=document.getElementById('astAccBody_'+i);
  const chev=document.getElementById('astAccChevron_'+i);
  if(!body) return;
  const open=body.style.display==='none';
  body.style.display=open?'block':'none';
  if(chev) chev.style.transform=open?'rotate(90deg)':'rotate(0)';
}

function toggleAstSift(i,sift){
  if(!S.astProfiles) S.astProfiles={};
  if(!S.astProfiles[i]) S.astProfiles[i]={};
  const p=S.astProfiles[i];
  if(!p.siftler) p.siftler=[p.sift||'24h'];
  const idx=p.siftler.indexOf(sift);
  if(idx>=0){
    if(p.siftler.length===1) return; // en az 1 şift
    p.siftler.splice(idx,1);
  } else {
    p.siftler.push(sift);
  }
  save(); renderAsistanlar();
}

function toggleTercihAylik(i,d){
  const isBasasistan = window.ACILX_ROLE === 'basasistan';

  // Asistan için dönem kontrolü
  if(!isBasasistan) {
    if(!window._tercihAcik) {
      _showCalToast('Tercih dönemi henüz açılmadı.');
      return;
    }
    // Sadece tercih ayına işaretlenebilir
    const tercihAy = window._tercihAy;
    const profAy = (_apMonth && _apIdx===i) ? _apMonth : S.currentDate;
    if(tercihAy && (tercihAy.y !== profAy.y || tercihAy.m !== profAy.m)) {
      _showCalToast('Sadece ' + MONTHS[tercihAy.m] + ' ' + tercihAy.y + ' ayına işaretleyebilirsiniz.');
      return;
    }
  }

  if(!S.astProfiles) S.astProfiles={};
  if(!S.astProfiles[i]) S.astProfiles[i]={};
  const p = S.astProfiles[i];
  const _m = (_apMonth&&_apIdx===i) ? _apMonth : S.currentDate;
  const moKey2 = _m.y+'_'+_m.m;
  if(!p.tercihAylik)  p.tercihAylik={};
  if(!p.tercihAylik[moKey2])  p.tercihAylik[moKey2]=[];
  if(!p.kacAylik)     p.kacAylik={};
  if(!p.kacAylik[moKey2])     p.kacAylik[moKey2]=[];
  if(!p.izinliAylik)  p.izinliAylik={};
  if(!p.izinliAylik[moKey2])  p.izinliAylik[moKey2]=[];

  const tArr = p.tercihAylik[moKey2];
  const kArr = p.kacAylik[moKey2];
  const iArr = p.izinliAylik[moKey2];

  // Başasistan: sınırsız, 4 durum döngüsü (boş→tercih→kaçın→izin→temizle)
  // Asistan: max 3 tercih ve 3 kaçın (izin yok)
  const LIMIT = isBasasistan ? 999 : 3;

  const tIdx = tArr.indexOf(d);
  const kIdx = kArr.indexOf(d);
  const iIdx = iArr.indexOf(d);

  if(isBasasistan){
    // Başasistan döngüsü: boş → tercih → kaçın → izin → temizle
    if(tIdx>=0){
      tArr.splice(tIdx,1);
      kArr.push(d);
    } else if(kIdx>=0){
      kArr.splice(kIdx,1);
      iArr.push(d);
    } else if(iIdx>=0){
      iArr.splice(iIdx,1);
    } else {
      tArr.push(d);
    }
  } else {
    // Asistan döngüsü: boş → tercih → kaçın → temizle
    if(tIdx>=0){
      tArr.splice(tIdx,1);
      if(kArr.length<LIMIT) kArr.push(d);
      else _showCalToast('En fazla '+LIMIT+' kaçın işaretlenebilir');
    } else if(kIdx>=0){
      kArr.splice(kIdx,1);
    } else if(iIdx>=0){
      iArr.splice(iIdx,1);
    } else {
      if(tArr.length>=LIMIT){ _showCalToast('En fazla '+LIMIT+' tercih günü seçilebilir'); return; }
      tArr.push(d);
    }
  }

  save();
  // Firestore'a kaydet
  if(_db && window.ACILX_UID) {
    const {y,m}=_m;
    fsPreferenceRef(window.ACILX_UID,y,m).set({
      uid: window.ACILX_UID,
      tercihGunlerAylik: tArr,
      kacGunlerAylik:    kArr,
      izinliGunlerAylik: isBasasistan ? iArr : [],
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(e=>console.warn('Tercih kayıt hatası:',e));
  }
  _renderAstProfile();
}

function _showCalToast(msg){
  let el=document.getElementById('_calToast');
  if(!el){
    el=document.createElement('div');
    el.id='_calToast';
    el.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--bg4);color:var(--w2);font-size:12px;padding:7px 16px;border-radius:6px;border:1px solid var(--bord);z-index:999;pointer-events:none;transition:opacity .3s';
    document.body.appendChild(el);
  }
  el.textContent=msg;
  el.style.opacity='1';
  clearTimeout(el._t);
  el._t=setTimeout(()=>el.style.opacity='0',1800);
}

function setAstProp(i,key,val){
  if(!S.astProfiles) S.astProfiles={};
  if(!S.astProfiles[i]) S.astProfiles[i]={};
  S.astProfiles[i][key]=val;
  save(); renderAsistanlar();
}

// 3-state cycle: nötr → tercih (yeşil) → kaçın (kırmızı) → nötr
function cycleGunTercih(i,gi){
  if(!S.astProfiles) S.astProfiles={};
  if(!S.astProfiles[i]) S.astProfiles[i]={};
  const p=S.astProfiles[i];
  if(!p.tercihGunler) p.tercihGunler=[];
  if(!p.kacGunler) p.kacGunler=[];
  const tIdx=p.tercihGunler.indexOf(gi);
  const kIdx=p.kacGunler.indexOf(gi);
  if(tIdx>=0){
    // tercih → kaçın
    p.tercihGunler.splice(tIdx,1);
    p.kacGunler.push(gi);
  } else if(kIdx>=0){
    // kaçın → nötr
    p.kacGunler.splice(kIdx,1);
  } else {
    // nötr → tercih
    p.tercihGunler.push(gi);
  }
  save(); renderAsistanlar();
}

function stepAstH(i,n){
  const el=document.getElementById('astH_'+i);
  if(!el) return;
  setAstH(i,Math.max(0,Math.min(31,(parseInt(el.value)||0)+n)));
}
function setAstH(i,val){
  const y=S.currentDate.y,mo=S.currentDate.m;
  const moKey=y+'_'+mo;
  if(!S.monthOverride) S.monthOverride={};
  if(!S.monthOverride[moKey]) S.monthOverride[moKey]={};
  const defH=Math.round(S.maxHours[ASSISTANTS[i].kidem]/24);
  if(val===defH){
    // Normalle aynıysa override kaldır
    delete S.monthOverride[moKey][i];
  } else {
    S.monthOverride[moKey][i]=val;
  }
  const el=document.getElementById('astH_'+i);
  if(el) el.value=val;
  save();
  renderAsistanlar();
  autoGen();
}
function clearAstH(i){
  const y=S.currentDate.y,mo=S.currentDate.m;
  const moKey=y+'_'+mo;
  if(S.monthOverride&&S.monthOverride[moKey]) delete S.monthOverride[moKey][i];
  save();
  renderAsistanlar();
  autoGen();
}

function renderAyarlar(){
  const ln = S.listName||'Acil Servis Nöbet Listesi';
  const inp = document.getElementById('listNameInput');
  if(inp) inp.value = ln;
  const cur = document.getElementById('listNameCurrent');
  if(cur) cur.textContent = 'Mevcut: '+ln;
  updateListNameHeader();

  // Grup kodu — sadece başasistana göster
  const grupKoduCard = document.getElementById('grupKoduCard');
  const astYonetimCard = document.getElementById('astYonetimCard');
  if(astYonetimCard) astYonetimCard.style.display = window.ACILX_ROLE==='basasistan' ? '' : 'none';
  if(grupKoduCard && window.ACILX_ROLE === 'basasistan') {
    grupKoduCard.style.display = '';
    // Grup kodunu Firestore'dan çek (ya da cache'den)
    if(window._grupKodu) {
      const el = document.getElementById('grupKoduGoster');
      if(el) el.textContent = window._grupKodu;
    } else if(_db) {
      const gId = window.ACILX_GROUP || '';
      if(gId) {
        _db.collection('groups').doc(gId).get().then(snap=>{
          if(snap.exists) {
            window._grupKodu = snap.data().code || '';
            const el = document.getElementById('grupKoduGoster');
            if(el) el.textContent = window._grupKodu;
          }
        }).catch(()=>{});
      }
    }
  } else if(grupKoduCard) {
    grupKoduCard.style.display = 'none';
  }

  // Kıdem yönetimi kartını güncelle
  const kidemCard = document.getElementById('kidemYonetimiCard');
  if(kidemCard) {
    const kidemSayisi = window._kidemSayisi || 5;
    if(!window._kidemIsimler) window._kidemIsimler = [];
    const kidemIsimler = window._kidemIsimler;
    // Stepper sayısını güncelle
    const goster = document.getElementById('kidemSayisiGoster');
    if(goster) goster.textContent = kidemSayisi;
    let kidemHtml = '';
    for(let k=1;k<=kidemSayisi;k++){
      kidemHtml += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-size:11px;font-weight:700;color:var(--red);min-width:24px;font-family:'DM Mono',monospace">K${k}</span>
        <input type="text" value="${kidemIsimler[k-1]||k+'.Yıl'}"
          oninput="if(!window._kidemIsimler)window._kidemIsimler=[];window._kidemIsimler[${k-1}]=this.value"
          style="flex:1;padding:7px 10px;background:var(--bg3);border:1px solid var(--bord);border-radius:7px;color:var(--w1);font-size:12px;font-family:var(--font-sans)">
      </div>`;
    }
    kidemCard.querySelector('.kidem-isimler').innerHTML = kidemHtml;
  }

  // Algoritma konfigürasyonu UI'ını yükle
  loadAlgoConfigUI();

  // Durum özeti
  const el = document.getElementById('durumOzet');
  if(!el) return;
  const DLBL={'aktif':'Aktif','izinli':'İzinli','rot_evet':'Rotasyon (nöbet tutar)','rot_hayir':'Rotasyon (nöbet tutmaz)'};
  const DCOL={'aktif':'#7DC44A','izinli':'#E87070','rot_evet':'#E8A84E','rot_hayir':'#888'};
  const SLBL={'24h':'24s','08-20':'08-20','20-08':'20-08','08-16':'08-16','16-24':'16-24','00-08':'00-08'};
  el.innerHTML = ASSISTANTS.map(function(ast,i){
    const p=(S.astProfiles&&S.astProfiles[i])||{};
    const d=p.durum||'aktif';
    const sl=(p.siftler&&p.siftler.length)?p.siftler:[p.sift||'24h'];
    const sStr=sl.map(function(s){return SLBL[s]||s;}).join(',');
    const tc=(p.tercihGunler||[]).map(function(g){return['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'][g];}).join(',');
    const kc=(p.kacGunler||[]).map(function(g){return['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'][g];}).join(',');
    return '<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid var(--bord);flex-wrap:wrap">'+
      '<span class="kt '+KIDEM_CLS[ast.kidem]+'" style="font-size:9px;padding:1px 4px">K'+ast.kidem+'</span>'+
      '<span style="font-size:12px;color:var(--w1);min-width:150px">'+_esc(ast.name)+'</span>'+
      '<span style="font-size:10px;padding:1px 6px;border-radius:3px;background:'+DCOL[d]+'22;color:'+DCOL[d]+'">'+DLBL[d]+'</span>'+
      '<span style="font-size:10px;color:var(--w3)">'+sStr+'</span>'+
      (tc?'<span style="font-size:10px;color:#7DC44A">✓'+tc+'</span>':'')+
      (kc?'<span style="font-size:10px;color:#E87070">✗'+kc+'</span>':'')+
      '</div>';
  }).join('');
}

// ── ALGORİTMA KONFİGÜRASYON FONKSİYONLARI ──
function loadAlgoConfigUI(){
  const cfg = S.algoConfig || {};
  const acCard = document.getElementById('algoConfigCard');
  if(acCard) acCard.style.display = window.ACILX_ROLE==='basasistan' ? '' : 'none';

  const acArtArda = document.getElementById('acArtArda');
  if(acArtArda) acArtArda.value = String(cfg.artArdaMesafe||1);

  const acKacinma = document.getElementById('acKacinma');
  if(acKacinma) acKacinma.value = cfg.kacinmaGucu||'guclu';

  const acTercih = document.getElementById('acTercih');
  if(acTercih) acTercih.value = cfg.tercihCakisma||'azTercih';

  const acWe = document.getElementById('acWe');
  if(acWe) acWe.value = cfg.weDengesi||'toplamEsit';

  const acIzin = document.getElementById('acIzin');
  if(acIzin) acIzin.value = cfg.izinHedef||'otoDusManuel';

  renderAlanOncelikListesi();
}

function saveAlgoConfig(){
  if(window.ACILX_ROLE!=='basasistan') return;
  if(!S.algoConfig) S.algoConfig = {};
  const el = function(id){ return document.getElementById(id); };
  S.algoConfig.artArdaMesafe  = parseInt(el('acArtArda')?.value)||1;
  S.algoConfig.kacinmaGucu    = el('acKacinma')?.value||'guclu';
  S.algoConfig.tercihCakisma  = el('acTercih')?.value||'azTercih';
  S.algoConfig.weDengesi      = el('acWe')?.value||'toplamEsit';
  S.algoConfig.izinHedef      = el('acIzin')?.value||'otoDusManuel';
  // Alan öncelikleri — her zaman manuel sıralama
  save();
  showSaved('algoSaved');
}

function toggleAlanOncelik(){}

function renderAlanOncelikListesi(){
  const el = document.getElementById('alanOncelikListesi');
  if(!el) return;
  if(!S.algoConfig) S.algoConfig = {};
  // Her zaman manuel — otomatik yok
  if(!S.algoConfig.alanOncelikleri || !S.algoConfig.alanOncelikleri.length){
    S.algoConfig.alanOncelikleri = AREAS.map(a=>a.id);
  }
  // Yeni eklenen alanları sona ekle
  AREAS.forEach(a=>{ if(!S.algoConfig.alanOncelikleri.includes(a.id)) S.algoConfig.alanOncelikleri.push(a.id); });
  // Silinmiş alanları temizle
  S.algoConfig.alanOncelikleri = S.algoConfig.alanOncelikleri.filter(id=>AREAS.find(a=>a.id===id));

  const sira = S.algoConfig.alanOncelikleri;
  el.innerHTML = sira.map(function(aId,idx){
    var a = AREAS.find(function(x){return x.id===aId;});
    if(!a) return '';
    return '<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:var(--bg2);border:1px solid var(--bord);border-radius:5px">'+
      '<span style="font-size:10px;font-weight:700;color:var(--red);min-width:18px">'+(idx+1)+'.</span>'+
      '<div style="width:8px;height:8px;border-radius:2px;background:'+a.color+'"></div>'+
      '<span style="font-size:11px;color:var(--w1);flex:1">'+a.name+'</span>'+
      (idx>0?'<button onclick="alanOncelikTasi('+idx+',-1)" style="font-size:12px;padding:1px 6px;border:1px solid var(--bord);border-radius:3px;background:var(--bg4);color:var(--w2);cursor:pointer">↑</button>':'')+
      (idx<sira.length-1?'<button onclick="alanOncelikTasi('+idx+',1)" style="font-size:12px;padding:1px 6px;border:1px solid var(--bord);border-radius:3px;background:var(--bg4);color:var(--w2);cursor:pointer">↓</button>':'')+
    '</div>';
  }).join('');
}

function alanOncelikTasi(idx, dir){
  if(!S.algoConfig) S.algoConfig = {};
  if(!S.algoConfig.alanOncelikleri) S.algoConfig.alanOncelikleri = AREAS.map(a=>a.id);
  const arr = S.algoConfig.alanOncelikleri;
  const newIdx = idx + dir;
  if(newIdx<0||newIdx>=arr.length) return;
  const tmp = arr[idx];
  arr[idx] = arr[newIdx];
  arr[newIdx] = tmp;
  save();
  showSaved('algoSaved');
  renderAlanOncelikListesi();
}

function grupKoduKopyala(){
  const kod = window._grupKodu || document.getElementById('grupKoduGoster')?.textContent || '';
  if(!kod) return;
  if(navigator.clipboard) {
    navigator.clipboard.writeText(kod).then(()=>showToast('Grup kodu kopyalandı: '+kod));
  } else {
    const ta=document.createElement('textarea');
    ta.value=kod; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Grup kodu kopyalandı: '+kod);
  }
}

function saveListName(){
  if(window.ACILX_ROLE!=='basasistan') return;
  const val = (document.getElementById('listNameInput').value||'').trim();
  if(!val) return;
  S.listName = val;
  save();
  updateListNameHeader();
  const cur = document.getElementById('listNameCurrent');
  if(cur) cur.textContent = 'Kaydedildi: '+val;
}

function updateListNameHeader(){
  const el = document.getElementById('listNameHeader');
  if(el) el.textContent = S.listName||'Nöbet Listesi';
}
