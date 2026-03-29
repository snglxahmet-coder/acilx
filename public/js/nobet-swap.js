/* ═══════════════════════════════════════════════════════════════
   nobet-swap.js — Değişim (Swap) Motoru
   Takvim üzerinden takas, gün taşıma ve değişim modalı işlemleri
   ═══════════════════════════════════════════════════════════════ */
/* ── DEĞİŞİM MOTORU (takvim üzerinden) ── */
// Herhangi bir asistanın ismine tıklanınca açılır
// Kurallar: kıdem/kota/art arda/min doluluk — takasMumkunMu() kullanır

let _swapAst = null; // {i, d, alanId}

function openSwapModal(astIdx, d, alanId){
  const ast = ASSISTANTS[astIdx];
  if(!ast) return;
  _swapAst = {i:astIdx, d, alanId};
  const alan = AREAS.find(a=>a.id===alanId);

  document.getElementById('swapTitle').textContent =
    shortName(ast.name) + ' · ' + d + ' ' + MONTHS[S.currentDate.m] +
    (alan ? ' — ' + alan.name : '');

  const {y,m} = S.currentDate;
  const days = daysInMonth(y,m);
  const _swMoKey = y+'_'+m;

  // Asistanın tercih/kaçınma verileri
  const _swProf0=(S.astProfiles&&S.astProfiles[astIdx])||{};
  const tercihArr=((_swProf0.tercihAylik)||{})[_swMoKey]||[];
  const kacArr=((_swProf0.kacAylik)||{})[_swMoKey]||[];
  const tercihHafta=_swProf0.tercihGunler||[];
  const kacHafta=_swProf0.kacGunler||[];

  function _isTercih(gIdx, gun){
    const p=(S.astProfiles&&S.astProfiles[gIdx])||{};
    const t=((p.tercihAylik)||{})[_swMoKey]||[];
    const th=p.tercihGunler||[];
    const dow=(new Date(y,m,gun).getDay()+6)%7;
    return t.includes(gun)||th.includes(dow);
  }
  function _isKac(gIdx, gun){
    const p=(S.astProfiles&&S.astProfiles[gIdx])||{};
    const k=((p.kacAylik)||{})[_swMoKey]||[];
    const kh=p.kacGunler||[];
    const dow=(new Date(y,m,gun).getDay()+6)%7;
    return k.includes(gun)||kh.includes(dow);
  }

  // ── 1. Takas seçenekleri ──
  const eslesme = [];
  for(let iB=0; iB<ASSISTANTS.length; iB++){
    if(iB===astIdx) continue;
    const _swProf=(S.astProfiles&&S.astProfiles[iB])||{};
    const _swDur=_swProf.durum||'aktif';
    if(_swDur==='izinli'||_swDur==='rot_hayir') continue;
    const _swIzin=((_swProf.izinliAylik)||{})[_swMoKey]||[];
    if(_swIzin.includes(d)) continue;

    // Farklı gün, aynı alan
    for(let dB=1; dB<=days; dB++){
      const alanB = S.schedule[gk(iB,dB)];
      if(!alanB) continue;
      if(alanB !== alanId) continue;
      if(dB===d) continue;
      if(S.schedule[gk(astIdx,dB)]) continue;
      if(S.schedule[gk(iB,d)]) continue;
      const chk = takasMumkunMu(astIdx, d, alanId, iB, dB, alanB);
      if(chk.ok){
        const tercihA=_isTercih(astIdx,dB), kacA=_isKac(astIdx,dB);
        const kacBKurt=_isKac(iB,dB); // B kaçınma günü kurtarılıyor mu?
        eslesme.push({iB, dB, alanB, astB:ASSISTANTS[iB], alanBObj:AREAS.find(a=>a.id===alanB), tip:'farkliGun', tercihA, kacA, kacBKurt});
      }
    }
    // Aynı gün, farklı alan
    const alanB_ayniGun = S.schedule[gk(iB,d)];
    if(alanB_ayniGun && alanB_ayniGun !== alanId){
      const chk = takasMumkunMu(astIdx, d, alanId, iB, d, alanB_ayniGun);
      if(chk.ok){
        eslesme.push({iB, dB:d, alanB:alanB_ayniGun, astB:ASSISTANTS[iB], alanBObj:AREAS.find(a=>a.id===alanB_ayniGun), tip:'ayniGun', tercihA:false, kacA:false, kacBKurt:false});
      }
    }
  }

  // ── 2. Başka güne taşı seçenekleri ──
  const tasiSecenekler = [];
  for(let dT=1; dT<=days; dT++){
    if(dT===d) continue;
    if(S.schedule[gk(astIdx,dT)]) continue; // o gün zaten nöbetçi
    if(_nobetYazilamaz(astIdx,dT)) continue; // izin/art arda engeli
    // O günde uygun boş alan var mı?
    AREAS.forEach(a=>{
      if(!isAlanAktif(dT,a.id)) return;
      const q=(S.quota[a.id]||{})[ast.kidem]||0;
      if(q<=0) return;
      // Alan kotası kontrol
      let alanKul=0;
      for(let dd=1;dd<=days;dd++) if(dd!==d && S.schedule[gk(astIdx,dd)]===a.id) alanKul++;
      if(alanKul>=q) return;
      // Günlük max doluluk kontrol
      const rule=getDayRule(dT,a.id);
      if(!rule.aktif) return;
      const doluluk=ASSISTANTS.filter((_,j)=>S.schedule[gk(j,dT)]===a.id).length;
      if(rule.max>0 && doluluk>=rule.max) return;
      // canAssign simülasyonu: eski atamasını geçici sil
      const tmpOld=S.schedule[gk(astIdx,d)];
      delete S.schedule[gk(astIdx,d)];
      const ok=canAssign(astIdx,dT,a.id,true);
      S.schedule[gk(astIdx,d)]=tmpOld;
      if(!ok) return;

      const tercihA=_isTercih(astIdx,dT), kacA=_isKac(astIdx,dT);
      const kacKurt=_isKac(astIdx,d); // mevcut kaçınma gününden kurtarılıyor
      tasiSecenekler.push({dT, alan:a, doluluk, max:rule.max||0, tercihA, kacA, kacKurt});
    });
  }

  // ── Sıralama fonksiyonu: 0=tercih+temiz, 1=nötr, 2=kaçınma ──
  function _sira(tercih, kac){ return tercih?0:(kac?2:1); }

  // Takas sıralama
  eslesme.sort((a,b)=>{
    const sa=_sira(a.tercihA,a.kacA), sb=_sira(b.tercihA,b.kacA);
    if(sa!==sb) return sa-sb;
    return a.dB-b.dB;
  });

  // Taşı sıralama
  tasiSecenekler.sort((a,b)=>{
    const sa=_sira(a.tercihA,a.kacA), sb=_sira(b.tercihA,b.kacA);
    if(sa!==sb) return sa-sb;
    return a.dT-b.dT;
  });

  // ── HTML oluştur ──
  let html = '';
  const toplam = eslesme.length + tasiSecenekler.length;

  if(toplam===0){
    html = `<div style="text-align:center;padding:24px 16px;color:var(--w4);font-size:12px">Bu nöbet için uygun değişim veya taşıma seçeneği bulunamadı.<br><br>Kıdem uyumsuzluğu, kota dolması veya<br>art arda nöbet kuralı engelliyor olabilir.</div>`;
  } else {
    html += `<div style="font-size:10px;color:var(--w3);margin-bottom:8px">${toplam} seçenek (${eslesme.length} takas, ${tasiSecenekler.length} taşıma)</div>`;

    // Tercih/kaçınma HTML yardımcısı
    function _prefHtml(tercih, kac, kacKurt){
      let s='';
      if(tercih) s+='<span style="font-size:9px;color:#4ade80;font-weight:600">✓ Tercih</span> ';
      if(kac) s+='<span style="font-size:9px;color:var(--orange);font-weight:600">⚠ Kaçınıyor</span> ';
      if(kacKurt) s+='<span style="font-size:9px;color:#4ade80;font-weight:600">✓ Kaçınma kurtarıldı</span> ';
      return s;
    }

    // ── Takas seçenekleri ──
    if(eslesme.length>0){
      const ayniGunler = eslesme.filter(e=>e.tip==='ayniGun');
      const farkliGunler = eslesme.filter(e=>e.tip==='farkliGun');

      if(ayniGunler.length>0){
        html += `<div style="font-size:10px;font-weight:700;color:var(--orange);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">⇄ Aynı Gün Alan Değişimi (${d} ${MONTHS[m]})</div>`;
        ayniGunler.forEach(e=>{
          const col = e.alanBObj?e.alanBObj.color:'var(--w3)';
          const aCol = alan?.color||'var(--w3)';
          html += `<div style="display:flex;align-items:center;gap:6px;padding:7px 10px;background:rgba(240,160,64,0.06);border-radius:7px;margin-bottom:3px;border:1px solid rgba(240,160,64,0.2);flex-wrap:wrap">
            <span class="kt ${KIDEM_CLS[e.astB.kidem]}" style="font-size:9px;padding:1px 4px">K${e.astB.kidem}</span>
            <span style="font-size:12px;font-weight:600;color:var(--w1);flex:1;min-width:60px">${shortName(e.astB.name)}</span>
            <span style="font-size:10px;padding:2px 5px;border-radius:3px;background:${aCol}22;color:${aCol};font-weight:600">${getAreaLabel(alanId)}</span>
            <span style="font-size:10px;color:var(--w4)">⇄</span>
            <span style="font-size:10px;padding:2px 5px;border-radius:3px;background:${col}22;color:${col};font-weight:600">${getAreaLabel(e.alanB)}</span>
            <button onclick="applySwap(${astIdx},${d},'${alanId}',${e.iB},${e.dB},'${e.alanB}')"
              style="font-size:10px;padding:4px 10px;border-radius:5px;background:rgba(240,160,64,0.12);border:1px solid rgba(240,160,64,0.3);color:var(--orange);cursor:pointer;font-weight:700;font-family:var(--font-sans);white-space:nowrap">
              ⇄ Değiştir
            </button>
          </div>`;
        });
        html += `<div style="height:6px"></div>`;
      }

      if(farkliGunler.length>0){
        html += `<div style="font-size:10px;font-weight:700;color:var(--w3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">⇄ Farklı Gün Takası</div>`;
        farkliGunler.forEach(e=>{
          const col = e.alanBObj?e.alanBObj.color:'var(--w3)';
          const dow=['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'][new Date(y,m,e.dB).getDay()];
          const pref=_prefHtml(e.tercihA, e.kacA, e.kacBKurt);
          html += `<div style="display:flex;align-items:center;gap:6px;padding:7px 10px;background:var(--bg3);border-radius:7px;margin-bottom:3px;border:1px solid ${e.kacA?'rgba(240,160,64,0.3)':'var(--bord)'};flex-wrap:wrap">
            <span style="font-size:11px;font-weight:700;color:var(--w1);min-width:44px">${e.dB} ${MONTHS[m].slice(0,3)}</span>
            <span style="font-size:9px;color:var(--w4);min-width:18px">${dow}</span>
            <span class="kt ${KIDEM_CLS[e.astB.kidem]}" style="font-size:9px;padding:1px 4px">K${e.astB.kidem}</span>
            <span style="font-size:11px;font-weight:600;color:var(--w1);flex:1;min-width:50px">${shortName(e.astB.name)}</span>
            <span style="font-size:10px;padding:2px 5px;border-radius:3px;background:${col}22;color:${col};font-weight:600">${getAreaLabel(e.alanB)}</span>
            ${pref}
            <button onclick="${e.kacA?'if(!confirm(\'Hedef gün kaçınma günü — emin misiniz?\')){return;}':''}applySwap(${astIdx},${d},'${alanId}',${e.iB},${e.dB},'${e.alanB}')"
              style="font-size:10px;padding:4px 10px;border-radius:5px;background:rgba(80,180,80,0.12);border:1px solid rgba(80,180,80,0.3);color:#80B840;cursor:pointer;font-weight:700;font-family:var(--font-sans);white-space:nowrap">
              ⇄ Değiştir
            </button>
          </div>`;
        });
        html += `<div style="height:6px"></div>`;
      }
    }

    // ── Başka güne taşı seçenekleri ──
    if(tasiSecenekler.length>0){
      html += `<div style="font-size:10px;font-weight:700;color:#60a5fa;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">→ Başka Güne Taşı</div>`;
      html += `<div style="max-height:200px;overflow:auto">`;
      tasiSecenekler.forEach(t=>{
        const dow=['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'][new Date(y,m,t.dT).getDay()];
        const dolulukLbl=t.max>0?t.doluluk+'/'+t.max:t.doluluk+'/?';
        const pref=_prefHtml(t.tercihA, t.kacA, t.kacKurt);
        html += `<div style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:var(--bg3);border-radius:7px;margin-bottom:3px;border:1px solid ${t.kacA?'rgba(240,160,64,0.3)':'var(--bord)'};flex-wrap:wrap">
          <span style="font-size:11px;font-weight:700;color:var(--w1);min-width:44px">${t.dT} ${MONTHS[m].slice(0,3)}</span>
          <span style="font-size:9px;color:var(--w4);min-width:18px">${dow}</span>
          <span style="width:8px;height:8px;border-radius:2px;background:${t.alan.color};flex-shrink:0"></span>
          <span style="font-size:10px;color:${t.alan.color};font-weight:600;min-width:24px">${getAreaLabel(t.alan.id)}</span>
          <span style="font-size:9px;color:var(--w3)" title="Doluluk">${dolulukLbl}</span>
          ${pref}
          <span style="flex:1"></span>
          <button onclick="${t.kacA?'if(!confirm(\'Hedef gün kaçınma günü — emin misiniz?\')){return;}':''}applyMoveDay(${astIdx},${d},'${alanId}',${t.dT},'${t.alan.id}')"
            style="font-size:10px;padding:4px 10px;border-radius:5px;background:rgba(96,165,250,0.12);border:1px solid rgba(96,165,250,0.3);color:#60a5fa;cursor:pointer;font-weight:700;font-family:var(--font-sans);white-space:nowrap">
            → Taşı
          </button>
        </div>`;
      });
      html += `</div>`;
    }
  }

  document.getElementById('swapBody').innerHTML = html;
  document.getElementById('swapModal').classList.add('open');
}

// Başka güne taşı: eski günden sil, yeni güne yaz
function applyMoveDay(astIdx, dOld, alanOld, dNew, alanNew){
  const engel=_nobetYazilamaz(astIdx,dNew);
  if(engel){ showToast(engel); return; }
  delete S.schedule[gk(astIdx,dOld)];
  S.schedule[gk(astIdx,dNew)] = alanNew;
  save();
  renderSchedule(); renderTakStats(); renderUyarilar();
  closeSwapModal();
  openDayDetail(dNew);
  showToast(ASSISTANTS[astIdx].name+' → '+dNew+'. güne taşındı ✓');
}

function closeSwapModal(){
  document.getElementById('swapModal').classList.remove('open');
  _swapAst = null;
}
document.getElementById('swapModal').addEventListener('click',function(e){
  if(e.target===this) closeSwapModal();
});

function applySwap(iA, dA, alanA, iB, dB, alanB){
  // Güvenlik: bir kez daha kontrol et
  const chk = takasMumkunMu(iA,dA,alanA,iB,dB,alanB);
  if(!chk.ok){
    showToast('Değişim artık mümkün değil: '+chk.reason);
    closeSwapModal();
    return;
  }

  // A ve B'nin mevcut atamalarını sil
  delete S.schedule[gk(iA,dA)];
  delete S.schedule[gk(iB,dB)];

  // A → B'nin gün+alanına gider, B → A'nın gün+alanına gider
  S.schedule[gk(iA,dB)] = alanB;  // A, B'nin alanına gider
  S.schedule[gk(iB,dA)] = alanA;  // B, A'nın alanına gider

  save();
  renderSchedule(); renderTakStats(); renderUyarilar();
  closeSwapModal();
  // Takas sonrası: dA günü açık kalsın (kullanıcının baktığı gün)
  openDayDetail(dA);
  // Her iki günü de flash ile vurgula
  [dA, dB].filter((g,i,a)=>a.indexOf(g)===i).forEach(gFlash=>{
    const el = document.querySelector('[data-gun="'+gFlash+'"]');
    if(el){
      el.style.outline='2px solid var(--red)';
      setTimeout(()=>{ el.style.outline=''; },1400);
    }
  });
  showToast('Değişim uygulandı ✓');
}
