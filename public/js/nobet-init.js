/* ═══════════════════════════════════════════════════════════════
   nobet-init.js — Uygulama Başlatma ve Yaşam Döngüsü
   DOMContentLoaded/init, Firestore realtime listener,
   ilk veri yükleme, event listener binding, PDF export
   ═══════════════════════════════════════════════════════════════ */
function initApp(){
  // KRİTİK: ASSISTANTS ve AREAS henüz boş olabilir.
  // İlk render'ı loadNobetSettings tamamlandıktan SONRA yap.
  loadApiKeyInput();
  updateListNameHeader();
  document.getElementById('monthLbl').textContent=MONTHS[S.currentDate.m]+' '+S.currentDate.y;
  // Takvim sekmesini direkt aç — boş ekran sorunu çözümü
  const takvimBtn = document.getElementById('tab-btn-takvim');
  if(takvimBtn) switchTab(takvimBtn,'takvim');
  // Tercihler sekme adını role göre ayarla
  var _initTBtn = document.getElementById('tab-btn-tercihler');
  if(_initTBtn) _initTBtn.textContent = window.ACILX_ROLE==='basasistan' ? 'Asistanlar' : 'Tercihlerim';
  // Rol kısıtlamaları
  if(typeof applyRoleRestrictions==='function' && !window._roleApplied) {
    window._roleApplied = true;
    applyRoleRestrictions();
  }
  window._myAstIdx = undefined;
  if(typeof loadNobetSettings==='function') {
    loadNobetSettings().then(()=>{
      // Asistan ve alan verileri yüklendi — ŞİMDİ render yap
      try{renderMinConf();}catch(e){console.warn('renderMinConf:',e);} try{renderDagilim();}catch(e){console.warn('renderDagilim:',e);} try{renderKota();}catch(e){console.warn('renderKota:',e);}
      // KRİTİK: Takvimi ilk açılışta render et
      try { renderNewCal(); renderTakStats(); } catch(e) { console.warn('initApp takvim:', e); }

      // Badge'i kıdem bilgisiyle güncelle
      const _isBasasistan2 = window.ACILX_ROLE === 'basasistan';
      const badge = document.getElementById('roleBadge');
      if(badge) {
        const myIdx = window._myAstIdx > -1 ? window._myAstIdx : -1;
        const myKidem = (myIdx > -1 && ASSISTANTS[myIdx]) ? ASSISTANTS[myIdx].kidem : null;
        if(_isBasasistan2) {
          badge.textContent = myKidem ? 'Başasistan · K'+myKidem : 'Başasistan';
        } else {
          badge.textContent = myKidem ? 'K'+myKidem : 'Asistan';
        }
      }
      const apTab = document.getElementById('tab-astprofile');
      if(apTab && apTab.style.display !== 'none') {
        _apIdx = null;
        if(window._myAstIdx > -1) { _apIdx = window._myAstIdx; _apMonth = S.currentDate; _renderAstProfile(); }
        else if(window.ACILX_ROLE !== 'basasistan') { _showProfileNotFound(); }
      }
    });
  } else {
    // loadNobetSettings yoksa — fallback ile render
    _applyFallbackData();
    try{renderMinConf();}catch(e){console.warn('renderMinConf:',e);} try{renderDagilim();}catch(e){console.warn('renderDagilim:',e);} try{renderKota();}catch(e){console.warn('renderKota:',e);}
  }
  function fixMobileGrids() {
    if(window.innerWidth <= 768) {
      document.querySelectorAll('[style*="grid-template-columns:1fr 320px"]').forEach(el => {
        el.style.gridTemplateColumns = '1fr';
      });
    }
  }
  fixMobileGrids();
  window.addEventListener('resize', fixMobileGrids);
}

// Başlangıç: önce Firestore'dan yükle
initApp();

(async function(){
  showSpinner();
  try {
    if(_db) {
      const {y,m} = S.currentDate;
      // İlk yüklemede global ayarları da al
      window._fsInitialLoad = true;
      const loaded = await fsLoadState(y, m);
      if(loaded){
        // KRİTİK: ASSISTANTS/AREAS yüklendiyse render yap, yoksa loadNobetSettings zaten halleder
        if(ASSISTANTS.length > 0) {
          try{renderMinConf();}catch(e){console.warn('renderMinConf:',e);} try{renderDagilim();}catch(e){console.warn('renderDagilim:',e);} try{renderKota();}catch(e){console.warn('renderKota:',e);}
          try { renderNewCal(); } catch(e){}
        }
        updateListNameHeader();
        updateTercihUI();
      } else {
        // Firestore'a bağlanamazsa localStorage'daki veriyle devam et
        console.warn('[ACİLX] Startup: Firestore yüklenemedi, localStorage kullanılıyor');
        if(ASSISTANTS.length > 0) {
          try{renderMinConf();}catch(e){console.warn('renderMinConf:',e);} try{renderDagilim();}catch(e){console.warn('renderDagilim:',e);} try{renderKota();}catch(e){console.warn('renderKota:',e);}
          try { renderNewCal(); } catch(e){}
        }
        updateListNameHeader();
        updateTercihUI();
      }
    } else {
      // DB yok — fallback + localStorage ile devam
      _applyFallbackData();
      try{renderMinConf();}catch(e){console.warn('renderMinConf:',e);} try{renderDagilim();}catch(e){console.warn('renderDagilim:',e);} try{renderKota();}catch(e){console.warn('renderKota:',e);}
      try { renderNewCal(); } catch(e){}
    }
  } catch(e) {
    console.warn('[ACİLX] Firestore atland:', e.message);
    _applyFallbackData();
    try { renderNewCal(); } catch(er){}
  } finally {
    window._fsReady = true;
    hideSpinner();
    // İçerik hazır — overlay kaldır
    try { window.parent.postMessage('acilx_nobet_ready', '*'); } catch(_){}
    // Güvenlik: 500ms sonra tekrar gönder (bazı tarayıcılarda ilk mesaj kaybolur)
    setTimeout(()=>{
      try { window.parent.postMessage('acilx_nobet_ready', '*'); } catch(_){}
    }, 500);
  }
})();

// ══════════════════════════════════════════════════════
// SAYFA KAPANMA KORUMASI — bekleyen kayıt varsa uyar
// ══════════════════════════════════════════════════════
window._pendingSave = false;
window.addEventListener('beforeunload', function(e){
  // Bekleyen Firestore yazımı varsa uyar
  if(window._pendingSave){
    e.preventDefault();
    e.returnValue = 'Nöbet listesi kaydediliyor, çıkmak istediğinize emin misiniz?';
    return e.returnValue;
  }
  // Çıkmadan önce localStorage'ı güncel tut (her ihtimale karşı)
  try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch(_){}
});

/* ══════════════════════════════════════════════════════════════════
   PDF EXPORT — Nöbet listesini profesyonel tablo formatında PDF'e aktar
   jsPDF 3.0.3 + jsPDF-AutoTable 5.0.2 (CDN'den lazy-load)
   ══════════════════════════════════════════════════════════════════ */

function exportPDF(){
  if(typeof window.jspdf==='undefined' || typeof window.jspdf.jsPDF==='undefined'){
    showToast('PDF hazırlanıyor...');
    const s1=document.createElement('script');
    s1.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/3.0.3/jspdf.umd.min.js';
    s1.onload=()=>{
      const s2=document.createElement('script');
      s2.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/5.0.2/jspdf.plugin.autotable.min.js';
      s2.onload=()=> _generatePDF();
      s2.onerror=()=> showToast('PDF eklentisi yüklenemedi');
      document.head.appendChild(s2);
    };
    s1.onerror=()=> showToast('PDF kütüphanesi yüklenemedi');
    document.head.appendChild(s1);
  } else {
    _generatePDF();
  }
}

function _generatePDF(){
  const {jsPDF} = window.jspdf;
  const {y,m} = S.currentDate;
  const days = daysInMonth(y,m);
  const listName = S.listName || 'Nobet Listesi';

  const filled = Object.keys(S.schedule).length;
  if(filled===0){ showToast('Takvimde nobet yok'); return; }

  const doc = new jsPDF({orientation:'landscape', unit:'mm', format:'a4'});
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  function hexToRgb(hex){
    hex=hex.replace('#','');
    if(hex.length===3) hex=hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    return [parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16)];
  }

  // ── Türkçe karakter temizleme (jsPDF default font Türkçe desteklemez) ──
  function trClean(s){
    if(!s) return '';
    return s.replace(/ğ/g,'g').replace(/Ğ/g,'G')
            .replace(/ü/g,'u').replace(/Ü/g,'U')
            .replace(/ş/g,'s').replace(/Ş/g,'S')
            .replace(/ı/g,'i').replace(/İ/g,'I')
            .replace(/ö/g,'o').replace(/Ö/g,'O')
            .replace(/ç/g,'c').replace(/Ç/g,'C');
  }

  // ── SAYFA 1: BAŞLIK ──
  doc.setFontSize(14);
  doc.setFont('helvetica','bold');
  doc.text(trClean(listName), pw/2, 12, {align:'center'});
  doc.setFontSize(10);
  doc.setFont('helvetica','normal');
  doc.text(trClean(MONTHS[m])+' '+y, pw/2, 18, {align:'center'});

  // ── TABLO 1: ALAN BAZLI ──
  const dayHeaders = [trClean('Alan')];
  for(let d=1;d<=days;d++){
    const dw=getDOW(y,m,d);
    dayHeaders.push(d+'\n'+trClean(DAYS_TR[dw]));
  }
  dayHeaders.push('Top');

  const dayRows = [];
  AREAS.forEach(a=>{
    const row = [trClean(a.name)];
    let total=0;
    for(let d=1;d<=days;d++){
      const names=[];
      ASSISTANTS.forEach((ast,i)=>{
        if(S.schedule[gk(i,d)]===a.id) names.push(trClean(shortName(ast.name)));
      });
      row.push(names.join('\n'));
      total+=names.length;
    }
    row.push(total.toString());
    dayRows.push(row);
  });

  const totRow = [trClean('TOPLAM')];
  let grandTotal=0;
  for(let d=1;d<=days;d++){
    let cnt=0;
    ASSISTANTS.forEach((_,i)=>{ if(S.schedule[gk(i,d)]) cnt++; });
    totRow.push(cnt.toString());
    grandTotal+=cnt;
  }
  totRow.push(grandTotal.toString());
  dayRows.push(totRow);

  const weCols=[];
  for(let d=1;d<=days;d++){
    if(isWE(y,m,d)) weCols.push(d);
  }

  doc.autoTable({
    head:[dayHeaders],
    body:dayRows,
    startY:22,
    theme:'grid',
    styles:{
      fontSize:6,
      cellPadding:1.2,
      lineWidth:0.15,
      lineColor:[180,180,180],
      overflow:'linebreak',
      halign:'center',
      valign:'middle',
      minCellHeight:7
    },
    headStyles:{
      fillColor:[232,87,42],
      textColor:[255,255,255],
      fontStyle:'bold',
      fontSize:5.5,
      halign:'center',
      cellPadding:1
    },
    columnStyles:{
      0:{halign:'left', fontStyle:'bold', cellWidth:22, fontSize:6.5}
    },
    alternateRowStyles:{fillColor:[248,248,252]},
    didParseCell:function(data){
      if(weCols.includes(data.column.index) && data.section!=='head'){
        data.cell.styles.fillColor=[255,240,235];
      }
      if(data.row.index===dayRows.length-1 && data.section==='body'){
        data.cell.styles.fontStyle='bold';
        data.cell.styles.fillColor=[240,240,245];
      }
      if(data.section==='body' && data.column.index===0 && data.row.index<AREAS.length){
        const a=AREAS[data.row.index];
        if(a && a.color){
          const rgb=hexToRgb(a.color);
          data.cell.styles.textColor=rgb;
        }
      }
    },
    margin:{left:5, right:5}
  });

  // ── SAYFA 2: ASİSTAN BAZLI ──
  doc.addPage('a4','landscape');

  doc.setFontSize(14);
  doc.setFont('helvetica','bold');
  doc.text(trClean(listName)+' — Asistan Detay', pw/2, 12, {align:'center'});
  doc.setFontSize(10);
  doc.setFont('helvetica','normal');
  doc.text(trClean(MONTHS[m])+' '+y, pw/2, 18, {align:'center'});

  const astHeaders = [trClean('Asistan'),'K'];
  for(let d=1;d<=days;d++){
    const dw=getDOW(y,m,d);
    astHeaders.push(d+'\n'+trClean(DAYS_TR[dw]));
  }
  astHeaders.push('Top');

  const astRows = [];
  ASSISTANTS.forEach((ast,i)=>{
    const row = [trClean(ast.name), 'K'+ast.kidem];
    let total=0;
    for(let d=1;d<=days;d++){
      const aId = S.schedule[gk(i,d)];
      if(aId){
        row.push(trClean(getAreaLabel(aId)));
        total++;
      } else {
        row.push('');
      }
    }
    row.push(total.toString());
    astRows.push(row);
  });

  doc.autoTable({
    head:[astHeaders],
    body:astRows,
    startY:22,
    theme:'grid',
    styles:{
      fontSize:5.5,
      cellPadding:1,
      lineWidth:0.15,
      lineColor:[180,180,180],
      overflow:'linebreak',
      halign:'center',
      valign:'middle',
      minCellHeight:5.5
    },
    headStyles:{
      fillColor:[55,138,221],
      textColor:[255,255,255],
      fontStyle:'bold',
      fontSize:5,
      halign:'center',
      cellPadding:0.8
    },
    columnStyles:{
      0:{halign:'left', fontStyle:'bold', cellWidth:28, fontSize:6},
      1:{cellWidth:7, fontSize:5.5}
    },
    alternateRowStyles:{fillColor:[248,250,255]},
    didParseCell:function(data){
      const colD = data.column.index - 2;
      if(colD>=1 && colD<=days && isWE(y,m,colD) && data.section!=='head'){
        data.cell.styles.fillColor=[255,240,235];
      }
      if(data.section==='body' && data.column.index>=2 && data.column.index<2+days){
        const cellText = data.cell.raw || '';
        if(cellText){
          const area = AREAS.find(a=>trClean(getAreaLabel(a.id))===cellText);
          if(area && area.color){
            const rgb=hexToRgb(area.color);
            data.cell.styles.textColor=rgb;
            data.cell.styles.fontStyle='bold';
          }
        }
      }
      if(data.column.index===2+days && data.section==='body'){
        data.cell.styles.fontStyle='bold';
      }
    },
    margin:{left:5, right:5}
  });

  // ── LEJAND + İSTATİSTİK ──
  const finalY = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(7);
  doc.setFont('helvetica','bold');
  doc.text('Alan Kisaltmalari:', 8, finalY);
  doc.setFont('helvetica','normal');
  const legendParts = AREAS.map(a => trClean(getAreaLabel(a.id)) + ' = ' + trClean(a.name));
  doc.text(legendParts.join('   |   '), 8, finalY+4);

  const kidemToplam = {};
  ASSISTANTS.forEach((ast,i)=>{
    if(!kidemToplam[ast.kidem]) kidemToplam[ast.kidem]={count:0,total:0};
    kidemToplam[ast.kidem].count++;
    for(let d=1;d<=days;d++) if(S.schedule[gk(i,d)]) kidemToplam[ast.kidem].total++;
  });
  doc.setFont('helvetica','bold');
  doc.text('Kidem Ozeti:', 8, finalY+10);
  doc.setFont('helvetica','normal');
  const kidemParts = Object.keys(kidemToplam).sort().map(k =>
    trClean(getKidemLabel(parseInt(k)))+': '+kidemToplam[k].count+' kisi, '+kidemToplam[k].total+' nobet (ort '+
    (kidemToplam[k].total/kidemToplam[k].count).toFixed(1)+')'
  );
  doc.text(kidemParts.join('   |   '), 8, finalY+14);

  // ── FOOTER ──
  const totalPages = doc.internal.getNumberOfPages();
  for(let p=1;p<=totalPages;p++){
    doc.setPage(p);
    doc.setFontSize(6);
    doc.setFont('helvetica','normal');
    doc.setTextColor(160,160,160);
    const now=new Date();
    doc.text('Olusturma: '+now.getDate()+'.'+(now.getMonth()+1)+'.'+now.getFullYear()+' '+
      String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0'), 5, ph-3);
    doc.text('Sayfa '+p+'/'+totalPages, pw-5, ph-3, {align:'right'});
    doc.setTextColor(0,0,0);
  }

  // ── İNDİR ──
  const fileName = trClean(listName).replace(/[^a-zA-Z0-9 ]/g,'').replace(/\s+/g,'_') +
    '_'+trClean(MONTHS[m])+'_'+y+'.pdf';
  doc.save(fileName);
  showToast('PDF indirildi');
}
