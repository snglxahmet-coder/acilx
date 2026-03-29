/* ═══════════════════════════════════════════════════════════════
   nobet-analiz.js — Analiz ve Sorun Çözüm Motoru
   Sorunlar paneli, sapma analizi, akıllı çözüm önerileri,
   hedef eksikleri, öneri motoru, uyarı çözümleri
   ═══════════════════════════════════════════════════════════════ */
// ── AKSİYON FONKSİYONLARI ──
function fixAlanMin(aId, newVal){
  S.defaultDayMin[aId].min=Math.max(0,newVal);
  save();
  goToTab('minconf','');
  setTimeout(()=>{
    // İlgili kartı vurgula
    const cards=document.querySelectorAll('#minGrid .eg-card');
    const idx=AREAS.findIndex(a=>a.id===aId);
    if(cards[idx]){
      cards[idx].style.outline='2px solid var(--red)';
      cards[idx].scrollIntoView({behavior:'smooth',block:'center'});
      setTimeout(()=>cards[idx].style.outline='',2000);
    }
  },100);
  autoGen();
  save();
}
function fixNobetSayisi(aId, astIdx, newVal){
  if(!S.quota[aId]) S.quota[aId]={};
  const kidem=ASSISTANTS[astIdx].kidem;
  S.quota[aId][kidem]=Math.max(0,newVal);
  if(!S.minNobet[aId]) S.minNobet[aId]={};
  S.minNobet[aId][kidem]=Math.max(0,newVal);
  save();
  goToTab('nobet_dagilim','');
  setTimeout(()=>{
    // Tabloyu vurgula
    const tbl=document.getElementById('dagTbl');
    if(tbl){
      tbl.style.outline='2px solid var(--red)';
      tbl.scrollIntoView({behavior:'smooth',block:'center'});
      setTimeout(()=>tbl.style.outline='',2000);
    }
  },100);
  renderDagilim();
  autoGen();
  save();
}
function goToTab(tabName, highlight){
  const tabEl = document.querySelector('.tab[onclick*="\''+tabName+'\'"]');
  switchTab(tabEl, tabName);
  setTimeout(()=>{
    if(highlight){
      const el=document.getElementById(highlight);
      if(el){el.style.outline='2px solid var(--red)';el.scrollIntoView({behavior:'smooth'});setTimeout(()=>el.style.outline='',2000);}
    }
  },100);
}

function renderSorunlar(){
  const el = document.getElementById('sorunlarContent');
  if(!el) return;
  window._sorunCozCache = [];
  window._sorunManuelCache = [];
  const {y,m} = S.currentDate;
  const days = daysInMonth(y,m);
  const isBasas = window.ACILX_ROLE==='basasistan';
  const RENK = {min:'var(--red)', max:'var(--orange)', kidem:'#9B7AE0', kidemMin:'#9B7AE0', kidemMax:'#9B7AE0'};
  const TIP_LBL = {min:'Min eksik', max:'Max aşım', kidem:'Kıdem', kidemMin:'Kıdem Min', kidemMax:'Kıdem Max'};
  let html = '';
  let toplamSorun = 0;

  // ═══════════════════════════════════════════════
  // BÖLÜM 1: Hedef altında / üstünde asistanlar
  // ═══════════════════════════════════════════════
  const sapmalar = _hesaplaSapmaDetayli();
  const altinda = sapmalar.filter(s=>s.fark<0).sort((a,b)=>a.fark-b.fark);
  const ustunde = sapmalar.filter(s=>s.fark>0).sort((a,b)=>b.fark-a.fark);

  if(altinda.length>0 || ustunde.length>0){
    html += '<div style="margin-bottom:12px">';
    html += '<div style="font-size:12px;font-weight:800;color:var(--w1);padding:8px 12px;border-bottom:1px solid var(--bord)">Hedef Sapmaları</div>';

    // --- Hedef altında ---
    if(altinda.length>0){
      html += '<div style="padding:6px 12px 2px"><span style="font-size:10px;font-weight:700;color:var(--orange)">Hedef altında</span></div>';
      altinda.forEach(s=>{
        // Alan bazında eksik: fark > 0 olanlar (hedef - mevcut)
        const alanEksik=s.alanDetay.filter(ad=>ad.fark>0);
        const dokumHtml=alanEksik.map(ae=>
          `<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:${ae.alan.color}18;color:${ae.alan.color};border:1px solid ${ae.alan.color}33">${getAreaLabel(ae.alan.id)} ${ae.mevcut}/${ae.hedef}</span>`
        ).join(' ');
        const mIdx=window._sorunManuelCache.length;
        window._sorunManuelCache.push({tip:'eksik',astIdx:s.i,fark:s.fark});
        html += `<div style="display:flex;align-items:center;gap:6px;padding:5px 12px;border-bottom:1px solid var(--bord)">
          <span style="font-size:11px;font-weight:600;color:var(--w1);min-width:60px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${shortName(s.ast.name)}</span>
          <span style="font-size:10px;color:var(--orange);font-weight:700;flex-shrink:0">${s.fark}</span>
          <div style="display:flex;gap:3px;flex:1;flex-wrap:wrap;overflow:hidden">${dokumHtml}</div>
          ${isBasas?`<button onclick="sorunOtoYaz(${mIdx})" style="flex-shrink:0;font-size:9px;padding:2px 7px;border-radius:3px;background:rgba(80,180,80,0.12);border:1px solid rgba(80,180,80,0.3);color:#80B840;cursor:pointer;font-weight:700;font-family:var(--font-sans)">Otomatik Yaz</button>
          <button onclick="sorunManuelSec(${mIdx})" style="flex-shrink:0;font-size:9px;padding:2px 7px;border-radius:3px;background:rgba(96,165,250,0.12);border:1px solid rgba(96,165,250,0.3);color:#60a5fa;cursor:pointer;font-weight:700;font-family:var(--font-sans)">Manuel Seç</button>`:''}
        </div>`;
      });
    }

    // --- Hedef üstünde ---
    if(ustunde.length>0){
      html += '<div style="padding:6px 12px 2px"><span style="font-size:10px;font-weight:700;color:var(--red)">Hedef üstünde</span></div>';
      ustunde.forEach(s=>{
        const mIdx=window._sorunManuelCache.length;
        window._sorunManuelCache.push({tip:'fazla',astIdx:s.i,fark:s.fark});
        html += `<div style="display:flex;align-items:center;gap:6px;padding:5px 12px;border-bottom:1px solid var(--bord)">
          <span style="font-size:11px;font-weight:600;color:var(--w1);min-width:60px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${shortName(s.ast.name)}</span>
          <span style="font-size:10px;color:var(--red);font-weight:700;flex-shrink:0">+${s.fark}</span>
          <span style="font-size:10px;color:var(--w3);flex:1">${s.mevcut}/${s.hedef} nöbet</span>
          ${isBasas?`<button onclick="sorunOtoSil(${mIdx})" style="flex-shrink:0;font-size:9px;padding:2px 7px;border-radius:3px;background:rgba(232,87,42,0.12);border:1px solid rgba(232,87,42,0.3);color:var(--red);cursor:pointer;font-weight:700;font-family:var(--font-sans)">Otomatik Sil</button>`:''}
        </div>`;
      });
    }
    html += '</div>';
  }

  // ═══════════════════════════════════════════════
  // BÖLÜM 2: Kural ihlalleri (gün/alan bazında)
  // ═══════════════════════════════════════════════
  const gunler = (_uyarilarGun !== null && _uyarilarGun !== undefined)
    ? [_uyarilarGun]
    : Array.from({length:days}, (_,i) => i+1);

  let ihlalHtml = '';

  for(const d of gunler){
    const dow = new Date(y,m,d).getDay();
    const gunAdi = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'][dow];

    // ── TEK MERKEZ: gunIhlalleri() ile tutarlı hesaplama ──
    const rawIhlaller = gunIhlalleri(d);
    if(rawIhlaller.length === 0) continue;

    // Her ihlal için buton mantığı ekle
    const sorunlar = rawIhlaller.map(ih => {
      const a = ih.alan;
      const rule = getDayRule(d, a.id);
      const cnt = ASSISTANTS.filter((_,i)=>S.schedule[gk(i,d)]===a.id).length;
      const alanDolu = rule.max>0 && cnt>=rule.max;
      let uygunVar = false;
      let cozumData = {d, aId:a.id};

      if(ih.tip==='min'){
        const eksik = rule.min - cnt;
        cozumData.eksik = eksik;
        const adaylar = ASSISTANTS.map((_,j)=>j).filter(j=>{
          if(!ASSISTANTS[j]||S.schedule[gk(j,d)]) return false;
          if(((S.quota[a.id]||{})[ASSISTANTS[j].kidem]||0)===0) return false;
          return canAssign(j,d,a.id,true);
        });
        uygunVar = adaylar.length>0;
        console.log(`[Sorunlar] ${d}. gün ${a.name} MIN eksik: ${eksik}, müsait aday: ${adaylar.length}${uygunVar?'':' — Asistan yok'}`);
      } else if(ih.tip==='max'){
        cozumData.fazla = cnt - rule.max;
        console.log(`[Sorunlar] ${d}. gün ${a.name} MAX aşım: ${cnt}/${rule.max}`);
      } else if(ih.tip==='kidem'){
        const gerekli = ih.yanindaKidemler||[ih.kidem||1];
        cozumData.kidemler = gerekli;
        cozumData.bagimlilik = true;
        const adaylar = ASSISTANTS.map((_,j)=>j).filter(j=>{
          if(!ASSISTANTS[j]||S.schedule[gk(j,d)]) return false;
          if(!gerekli.includes(ASSISTANTS[j].kidem)) return false;
          if(((S.quota[a.id]||{})[ASSISTANTS[j].kidem]||0)===0) return false;
          return canAssign(j,d,a.id,true);
        });
        uygunVar = adaylar.length>0;
        console.log(`[Sorunlar] ${d}. gün ${a.name} Kıdem: müsait aday: ${adaylar.length}${uygunVar?'':' — Asistan yok'}, alan dolu: ${alanDolu}`);
      } else if(ih.tip==='kidemMin'){
        cozumData.bagimlilik = true;
        // kidemMin ihlali — eksik kıdemden asistan ekle
        const kMatch = ih.msg.match(/K(\d+)/);
        const gerekliK = kMatch ? [Number(kMatch[1])] : [];
        cozumData.kidemler = gerekliK;
        const adaylar = ASSISTANTS.map((_,j)=>j).filter(j=>{
          if(!ASSISTANTS[j]||S.schedule[gk(j,d)]) return false;
          if(gerekliK.length && !gerekliK.includes(ASSISTANTS[j].kidem)) return false;
          if(((S.quota[a.id]||{})[ASSISTANTS[j].kidem]||0)===0) return false;
          return canAssign(j,d,a.id,true);
        });
        uygunVar = adaylar.length>0;
        console.log(`[Sorunlar] ${d}. gün ${a.name} KıdemMin: K${gerekliK.join('+K')}, müsait: ${adaylar.length}`);
      } else if(ih.tip==='kidemMax'){
        cozumData.fazla = 1;
        console.log(`[Sorunlar] ${d}. gün ${a.name} KıdemMax aşım`);
      }

      return {tip:ih.tip, alan:a, gun:d, msg:ih.msg, uygunVar, alanDolu, cozumData};
    });

    toplamSorun += sorunlar.length;
    sorunlar.forEach(s=>{
      const cIdx = window._sorunCozCache.length;
      window._sorunCozCache.push(s.cozumData);

      // ── Tutarlı buton mantığı ──
      let akBtn='';
      if(isBasas){
        if(s.tip==='min' || s.tip==='kidemMin'){
          // Eksik: müsait asistan varsa Çöz, yoksa Asistan yok + Ek Nöbet Yaz
          const cozTip = s.tip==='min' ? 'ekle_alan' : 'ekle_kidem';
          if(s.uygunVar){
            akBtn=`<button onclick="sorunCoz(${cIdx},'${cozTip}')" class="sr-btn sr-btn-g">Çöz</button>`;
          } else {
            akBtn=`<span class="sr-lbl sr-lbl-o">Asistan yok</span>
              <button onclick="sorunCoz(${cIdx},'${cozTip}')" class="sr-btn sr-btn-g" title="Max dolmuş asistandan zorla yaz">Ek Nöbet Yaz</button>`;
          }
          if(s.alanDolu){
            akBtn+=`<button onclick="sorunKapasiteArtir(${s.cozumData.d},'${s.cozumData.aId}')" class="sr-btn sr-btn-b">Kapasiteyi Artır</button>`;
          }
        } else if(s.tip==='max' || s.tip==='kidemMax'){
          // Fazla: Çöz (çıkar) + Kapasiteyi Artır
          akBtn=`<button onclick="sorunCoz(${cIdx},'cikar_alan')" class="sr-btn sr-btn-r">Çöz</button>
            <button onclick="sorunKapasiteArtir(${s.cozumData.d},'${s.cozumData.aId}')" class="sr-btn sr-btn-b">Kapasiteyi Artır</button>`;
        } else if(s.tip==='kidem'){
          // Kıdem bağımlılık: müsait varsa Çöz, yoksa Asistan yok + Ek Nöbet Yaz
          if(s.uygunVar){
            akBtn=`<button onclick="sorunCoz(${cIdx},'ekle_kidem')" class="sr-btn sr-btn-g">Çöz</button>`;
          } else {
            akBtn=`<span class="sr-lbl sr-lbl-o">Asistan yok</span>
              <button onclick="sorunCoz(${cIdx},'ekle_kidem')" class="sr-btn sr-btn-g" title="Max dolmuş asistandan zorla yaz">Ek Nöbet Yaz</button>`;
          }
          if(s.alanDolu){
            akBtn+=`<button onclick="sorunKapasiteArtir(${s.cozumData.d},'${s.cozumData.aId}')" class="sr-btn sr-btn-b">Kapasiteyi Artır</button>`;
          }
        }
      }

      // Onaylı ihlal kontrolü
      const _onayli=window._onayliIhlaller&&window._onayliIhlaller.some(o=>o.d===d&&o.aId===s.alan.id);
      const onayBadge=_onayli?'<span style="font-size:8px;font-weight:700;padding:1px 4px;border-radius:2px;background:rgba(74,222,128,0.15);color:#4ade80;flex-shrink:0" title="Manuel olarak onaylandı">✓ Onaylı</span>':'';

      const tipBg = {min:'rgba(232,87,42,0.1)',max:'rgba(240,160,64,0.1)',kidem:'rgba(155,122,224,0.1)',kidemMin:'rgba(155,122,224,0.1)',kidemMax:'rgba(155,122,224,0.1)'};

      ihlalHtml += `<div style="display:flex;align-items:center;gap:5px;padding:4px 12px;border-bottom:1px solid var(--bord)${_onayli?';background:rgba(74,222,128,0.03)':''}">
        <span style="font-size:10px;font-weight:700;color:var(--w1);min-width:22px;font-family:'DM Mono',monospace">${d}</span>
        <span style="font-size:9px;color:var(--w4);min-width:22px">${gunAdi}</span>
        <span style="width:8px;height:8px;border-radius:2px;background:${s.alan.color};flex-shrink:0"></span>
        <span style="font-size:10px;color:${s.alan.color};min-width:40px;flex-shrink:0">${getAreaLabel(s.alan.id)}</span>
        <span style="font-size:9px;font-weight:700;padding:1px 4px;border-radius:2px;background:${tipBg[s.tip]||'rgba(155,122,224,0.1)'};color:${RENK[s.tip]||'#9B7AE0'};flex-shrink:0">${TIP_LBL[s.tip]||s.tip}</span>
        ${onayBadge}
        <span style="font-size:10px;color:var(--w3);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.msg}</span>
        <div style="display:flex;gap:3px;flex-shrink:0">${akBtn}</div>
      </div>`;
    });
  }

  // --- Birleştir ---
  if(toplamSorun === 0 && altinda.length===0 && ustunde.length===0){
    html = '<div style="text-align:center;padding:40px 20px">'+
      '<div style="font-size:32px;margin-bottom:12px">&#10003;</div>'+
      '<div style="font-size:14px;font-weight:700;color:var(--w1);margin-bottom:6px">Sorun yok</div>'+
      '<div style="font-size:12px;color:var(--w3)">Tüm kurallar karşılanıyor.</div>'+
    '</div>';
  } else {
    if(toplamSorun > 0){
      html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(232,87,42,0.06);border-radius:8px 8px 0 0;border:1px solid rgba(232,87,42,0.15);border-bottom:none">'+
        '<span style="font-size:14px;font-weight:800;color:var(--red)">'+toplamSorun+'</span>'+
        '<span style="font-size:11px;color:var(--w3)">kural ihlali</span>'+
        (isBasas?'<button onclick="tumSorunlariCoz()" style="margin-left:auto;padding:4px 10px;border-radius:5px;background:var(--red);border:none;color:#fff;font-size:10px;font-weight:700;cursor:pointer;font-family:var(--font-sans)">Tümünü Çöz</button>':'')+
      '</div>';
      html += '<div style="background:var(--bg2);border:1px solid rgba(232,87,42,0.15);border-radius:0 0 8px 8px;overflow:hidden;margin-bottom:8px">' + ihlalHtml + '</div>';
    }
  }

  var badge = document.getElementById('tab-btn-sorunlar');
  if(badge){
    const total = toplamSorun + altinda.length + ustunde.length;
    badge.textContent = total > 0 ? 'Sorunlar ('+total+')' : 'Sorunlar';
  }

  el.innerHTML = html;
}

// ── Sorunlar BÖLÜM 1: Hedef sapması aksiyonları ──
function sorunOtoYaz(mIdx){
  const p=window._sorunManuelCache[mIdx]; if(!p||p.tip!=='eksik') return;
  tümSapmalariEkle(p.astIdx);
  renderSorunlar();
}
function sorunOtoSil(mIdx){
  const p=window._sorunManuelCache[mIdx]; if(!p||p.tip!=='fazla') return;
  tümSapmalariCikar(p.astIdx);
  renderSorunlar();
}
function sorunManuelSec(mIdx){
  const p=window._sorunManuelCache[mIdx]; if(!p||p.tip!=='eksik') return;
  const astIdx=p.astIdx;
  const ast=ASSISTANTS[astIdx]; if(!ast) return;
  const {y,m}=S.currentDate; const days=daysInMonth(y,m);
  const moKey=y+'_'+m;
  const tercihAylik=(S.astProfiles&&S.astProfiles[astIdx]&&S.astProfiles[astIdx].tercihAylik&&S.astProfiles[astIdx].tercihAylik[moKey])||[];
  const kacAylik=(S.astProfiles&&S.astProfiles[astIdx]&&S.astProfiles[astIdx].kacAylik&&S.astProfiles[astIdx].kacAylik[moKey])||[];
  const tercihHafta=(S.astProfiles&&S.astProfiles[astIdx]&&S.astProfiles[astIdx].tercihGunler)||[];
  const kacHafta=(S.astProfiles&&S.astProfiles[astIdx]&&S.astProfiles[astIdx].kacGunler)||[];
  const dur=(S.astProfiles&&S.astProfiles[astIdx]&&S.astProfiles[astIdx].durum)||'aktif';
  const izinliAylik=(S.astProfiles&&S.astProfiles[astIdx]&&S.astProfiles[astIdx].izinliAylik&&S.astProfiles[astIdx].izinliAylik[moKey])||[];

  // Tüm gün/alan kombinasyonlarını topla
  let secimler=[];
  for(let d=1;d<=days;d++){
    if(S.schedule[gk(astIdx,d)]) continue; // zaten atanmış bu güne — atla
    AREAS.forEach(a=>{
      const rule=getDayRule(d,a.id);
      if(!rule.aktif) return;
      const q=(S.quota[a.id]||{})[ast.kidem]||0;
      if(q===0) return; // kıdem kotası hiç yok bu alan için

      const doluluk=ASSISTANTS.filter((_,j)=>S.schedule[gk(j,d)]===a.id).length;
      const warns=[];
      let yazilamaz=false;

      // ─ Kesin yazılamaz kontrolleri ─
      if(dur==='izinli'||dur==='rot_hayir'){ yazilamaz=true; warns.push('İzinli'); }
      if(izinliAylik.includes(d)){ yazilamaz=true; warns.push('İzinli (günlük)'); }
      // Art arda engeli
      if(d>1&&S.schedule[gk(astIdx,d-1)]){ yazilamaz=true; warns.push('Art arda (önceki gün)'); }
      if(d<days&&S.schedule[gk(astIdx,d+1)]){ yazilamaz=true; warns.push('Art arda (sonraki gün)'); }
      if(d===1&&S.prevMonthLastDay&&S.prevMonthLastDay[astIdx]){ yazilamaz=true; warns.push('Art arda (önceki ay)'); }
      if(d===days&&S.nextMonthFirstDay&&S.nextMonthFirstDay[astIdx]){ yazilamaz=true; warns.push('Art arda (sonraki ay)'); }
      if(isEgtFull(y,m,d,ast.kidem)){ yazilamaz=true; warns.push('Eğitim'); }

      // ─ Uyarı kontrolleri (yazılabilir ama ihlal) ─
      // Kota dolu
      let alanKul=0;
      for(let dd=1;dd<=days;dd++) if(S.schedule[gk(astIdx,dd)]===a.id) alanKul++;
      if(alanKul>=q && !yazilamaz) warns.push('Kota dolu');

      // Alan günlük max dolu
      if(rule.max>0 && doluluk>=rule.max && !yazilamaz) warns.push('Alan dolu');

      // Kıdem ihlali simülasyonu
      if(!yazilamaz){
        const mevcutKidemler=ASSISTANTS.filter((_,xi)=>S.schedule[gk(xi,d)]===a.id).map(x=>x.kidem);
        const simKidemler=[...mevcutKidemler, ast.kidem];
        const rr=S.defaultDayMin[a.id];
        if(rr&&rr.kidemKurallari){
          const k=ast.kidem;
          const kural=rr.kidemKurallari[k];
          if(kural&&kural.yalnizTutamaz){
            const yanK=kural.yanindaKidemler||(kural.yaninda&&kural.yaninda.length?kural.yaninda:[]);
            const eAK=kural.enAzKac||1;
            if(yanK.length){
              let bul=0;
              for(const yk of yanK){
                if(yk===k){if(simKidemler.filter(x=>x===k).length>=2)bul++;}
                else{if(simKidemler.includes(yk))bul++;}
              }
              if(bul<eAK) warns.push('Kıdem ihlali');
            } else {
              if(simKidemler.filter(x=>x===k).length<2) warns.push('Kıdem ihlali');
            }
          }
        }
      }

      // Tercih durumu
      const dow=new Date(y,m,d).getDay();
      const dowIdx=(dow+6)%7; // 0=Pzt..6=Paz
      const isTercih=tercihAylik.includes(d)||tercihHafta.includes(dowIdx);
      const isKac=kacAylik.includes(d)||kacHafta.includes(dowIdx);

      const ihlalSayisi=yazilamaz?0:warns.length;
      // Sıralama puanı: 0=ihlalsiz+tercih, 1=ihlalsiz, 2=ihlalli, 3=yazılamaz
      let sira=yazilamaz?3:(ihlalSayisi>0?2:(isTercih?0:1));

      secimler.push({d, a, doluluk, max:rule.max||0, min:rule.min||0,
        warns, yazilamaz, isTercih, isKac, sira, ihlalSayisi});
    });
  }

  // Sıralama
  secimler.sort((a,b)=>{
    if(a.sira!==b.sira) return a.sira-b.sira;
    return a.d-b.d;
  });

  if(secimler.length===0){ showToast('Uygun gün/alan bulunamadı'); return; }

  // Modal aç
  const AY=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  document.getElementById('dmTitle').innerHTML=`<span style="color:var(--orange)">Manuel Seç</span> — ${shortName(ast.name)}`;
  document.getElementById('dmSub').textContent=Math.abs(p.fark)+' nöbet eksik';
  window._manuelSecAstIdx=astIdx;
  let body='<div style="max-height:350px;overflow:auto">';
  let prevSira=-1;
  secimler.forEach((s,si)=>{
    // Grup ayracı
    if(s.sira!==prevSira){
      prevSira=s.sira;
      const grpLbl=s.sira===0?'Tercih ediyor — kurala uygun':s.sira===1?'Kurala uygun':s.sira===2?'Uyarılı (kural ihlali olacak)':'Yazılamaz';
      const grpCol=s.sira===0?'#4ade80':s.sira===1?'var(--w3)':s.sira===2?'var(--orange)':'var(--w4)';
      body+=`<div style="font-size:9px;font-weight:700;color:${grpCol};padding:6px 0 2px;border-bottom:1px solid var(--bord);margin-top:${si>0?4:0}px">${grpLbl}</div>`;
    }
    const dow=['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'][new Date(y,m,s.d).getDay()];
    const dolulukLbl=s.max>0?s.doluluk+'/'+s.max:s.doluluk+'/?';

    // Tercih etiketi
    let tercihHtml='';
    if(s.isTercih) tercihHtml='<span style="font-size:9px;color:#4ade80;font-weight:700" title="Tercih ediyor">✓ Tercih</span>';
    else if(s.isKac) tercihHtml='<span style="font-size:9px;color:var(--red);font-weight:700" title="Kaçınıyor">✗ Kaçınıyor</span>';

    // Uyarı/ihlal etiketi
    let ihlalHtml='';
    if(s.yazilamaz){
      ihlalHtml='<span style="font-size:9px;color:var(--w4);font-weight:600;padding:1px 4px;border-radius:2px;background:rgba(128,128,128,0.12)">Yazılamaz</span>';
    } else if(s.warns.length>0){
      ihlalHtml=s.warns.map(w=>{
        const col=w==='Kota dolu'?'var(--red)':w==='Alan dolu'?'var(--orange)':w==='Kıdem ihlali'?'#E8872A':'var(--w4)';
        return '<span style="font-size:8px;color:'+col+';font-weight:600;padding:1px 3px;border-radius:2px;background:'+col+'18">⚠️ '+w+'</span>';
      }).join(' ');
    } else {
      ihlalHtml='<span style="font-size:9px;color:#4ade80">✓</span>';
    }

    // Satır rengi
    const rowBg=s.yazilamaz?'rgba(128,128,128,0.04)':s.sira===0?'rgba(74,222,128,0.03)':'transparent';
    const rowOpacity=s.yazilamaz?'0.5':'1';

    body+=`<div style="display:flex;align-items:center;gap:5px;padding:5px 0;border-bottom:1px solid var(--bord);background:${rowBg};opacity:${rowOpacity}">
      <span style="font-size:11px;font-weight:700;color:var(--w1);min-width:48px">${s.d} ${AY[m]}</span>
      <span style="font-size:9px;color:var(--w4);min-width:20px">${dow}</span>
      <span style="width:8px;height:8px;border-radius:2px;background:${s.a.color};flex-shrink:0"></span>
      <span style="font-size:10px;color:${s.a.color};min-width:30px">${getAreaLabel(s.a.id)}</span>
      <span style="font-size:9px;color:var(--w3)" title="Doluluk">${dolulukLbl}</span>
      ${tercihHtml}
      <span style="flex:1;display:flex;gap:2px;flex-wrap:wrap;justify-content:flex-end">${ihlalHtml}</span>
      ${s.yazilamaz
        ?'<span style="font-size:9px;color:var(--w4);min-width:32px;text-align:center">—</span>'
        :`<button onclick="manuelSecYaz(${astIdx},${s.d},'${s.a.id}',${si})" class="sr-btn sr-btn-g" style="min-width:32px">Yaz</button>`}
    </div>`;
  });
  body+='</div>';
  document.getElementById('dmBody').innerHTML=body;
  window._manuelSecCache=secimler;
  document.getElementById('dayModal').classList.add('open');
}

function manuelSecYaz(astIdx, d, aId, si){
  // Merkezi engel kontrolü — cache'den kaçmış olabilir
  const _mEngel=_nobetYazilamaz(astIdx,d);
  if(_mEngel){ showToast(_mEngel); return; }
  const s=window._manuelSecCache&&window._manuelSecCache[si];
  if(s&&s.yazilamaz){ showToast('Bu gün/alan kombinasyonu yazılamaz'); return; }
  if(s&&s.warns&&s.warns.length>0&&!s.yazilamaz){
    const uyariTxt=s.warns.map(w=>'• '+w).join('\n');
    if(!confirm('Bu atama şu kuralları ihlal edecek:\n'+uyariTxt+'\n\nYine de yazmak istiyor musunuz?')) return;
    // Onaylanan ihlali kaydet
    if(!window._onayliIhlaller) window._onayliIhlaller=[];
    window._onayliIhlaller.push({astIdx, d, aId, warns:s.warns, ts:Date.now()});
  }
  sapmaOneriEkle(astIdx, d, aId);
}

// ── BÖLÜM 2: Kapasiteyi artır (güne özel max+1) ──
function sorunKapasiteArtir(d,aId){
  const rule=getDayRule(d,aId);
  const yeniMax=(rule.max||0)+1;
  setDayOverride(d,aId,'max',yeniMax);
  showToast(d+'. gün '+getAreaLabel(aId)+' max: '+yeniMax);
  renderSorunlar();
}

window._sorunCozCache = [];
function sorunCoz(idx, cozum){
  var p = window._sorunCozCache[idx];
  if(p) uyariCoz(p, cozum);
}
function tumSorunlariCoz(){ if(typeof akillicoz==='function') akillicoz(); }

function _renderUyarilar_legacy(){
  const el = document.getElementById('uyarilarContent');
  if(!el) return;
  window._uyariSorunCache = []; // Her render'da cache sıfırla
  const {y,m} = S.currentDate;
  const days = daysInMonth(y,m);
  let html = '';
  let toplamUyari = 0;

  function getTipColor(tip){
    if(tip==='min') return 'var(--red)';
    if(tip==='max') return 'var(--orange)';
    if(tip==='kidem') return '#9B7AE0';
    return 'var(--red)';
  }
  function getTipBg(tip){
    if(tip==='min') return 'rgba(232,87,42,0.10)';
    if(tip==='max') return 'rgba(240,160,64,0.10)';
    if(tip==='kidem') return 'rgba(155,122,224,0.10)';
    return 'rgba(232,87,42,0.10)';
  }
  function getTipLabel(tip){
    if(tip==='min') return 'Min eksik';
    if(tip==='max') return 'Max aşım';
    if(tip==='kidem') return 'Kıdem';
    return '';
  }

  // Filtre: sadece belirli gün veya tüm ay
  const gunler = (_uyarilarGun !== null && _uyarilarGun !== undefined)
    ? [_uyarilarGun]
    : Array.from({length:days}, (_,i) => i+1);

  for(const d of gunler){
    const dow = new Date(y,m,d).getDay();
    const gunAdi = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'][dow];
    const sorunlar = [];

    AREAS.forEach(a=>{
      const rule = getDayRule(d, a.id);
      if(!rule.aktif) return;
      const allBlocked = ASSISTANTS.every(ast => isEgtFull(y,m,d,ast.kidem));
      if(allBlocked) return;
      const girebilir = ASSISTANTS.some(ast =>
        !isEgtFull(y,m,d,ast.kidem) && ((S.quota[a.id]||{})[ast.kidem]||0)>0
      );
      if(!girebilir && rule.min>0) return;

      const atananlar = ASSISTANTS.filter((_,i)=>S.schedule[gk(i,d)]===a.id);
      const cnt = atananlar.length;

      if(cnt < rule.min){
        sorunlar.push({ tip:'min', alan:a, gun:d, msg:`${a.name}: ${cnt}/${rule.min} kişi — ${rule.min-cnt} eksik` });
      }
      if(rule.max > 0 && cnt > rule.max){
        sorunlar.push({ tip:'max', alan:a, gun:d, msg:`${a.name}: ${cnt}/${rule.max} kişi — fazla atama` });
      }
      if(cnt>0){
        kidemKuralIhlali(d,a.id).forEach(ih=>{
          sorunlar.push({ tip:'kidem', alan:a, gun:d, msg:`${a.name}: ${ih.msg}` });
        });
      }
    });

    if(sorunlar.length > 0){
      toplamUyari += sorunlar.length;
      // Sorunları global cache'e kaydet — onclick'te index kullanılacak
      const cacheStart = window._uyariSorunCache.length;
      sorunlar.forEach(s => window._uyariSorunCache.push(s));
      html += `<div style="background:var(--bg2);border:1px solid rgba(232,87,42,0.15);border-left:3px solid var(--red);border-radius:8px;overflow:hidden;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--bord)">
          <span style="font-size:13px;font-weight:800;color:var(--w1);font-family:'DM Mono',monospace">${d} ${MONTHS[m]}</span>
          <span style="font-size:10px;color:var(--w3)">${gunAdi}</span>
          <span style="font-size:9px;padding:1px 6px;border-radius:3px;background:rgba(232,87,42,0.12);color:var(--red);font-weight:700">${sorunlar.length} sorun</span>
          <button onclick="switchTab(document.getElementById('tab-btn-takvim'),'takvim');setTimeout(()=>openDayDetail(${d}),50)" style="margin-left:auto;font-size:10px;padding:3px 8px;border-radius:4px;background:var(--bg3);border:1px solid var(--bord);color:var(--w2);cursor:pointer;font-family:var(--font-sans)">📅 Günü aç</button>
        </div>
        ${sorunlar.map((s,si)=>{
          const isBasas = window.ACILX_ROLE==='basasistan';
          const cacheIdx = cacheStart + si;
          return `<div
            onclick="${isBasas ? 'uyariSorunTikla('+cacheIdx+')' : ''}"
            style="display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid var(--bord);${isBasas?'cursor:pointer;transition:background .12s':''};"
            ${isBasas ? 'onmouseover="this.style.background=\'rgba(255,255,255,0.04)\'" onmouseout="this.style.background=\'\'"' : ''}>
            <span style="display:inline-flex;align-items:center;gap:3px;font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px;background:${getTipBg(s.tip)};color:${getTipColor(s.tip)};flex-shrink:0">
              <span style="width:5px;height:5px;border-radius:50%;background:${getTipColor(s.tip)};display:inline-block"></span>${getTipLabel(s.tip)}
            </span>
            <span style="font-size:11px;color:var(--w2);flex:1">${s.msg}</span>
            ${isBasas ? '<span style="font-size:10px;color:var(--w4);flex-shrink:0">💡</span>' : ''}
          </div>`;
        }).join('')}
      </div>`;
    }
  }

  if(toplamUyari === 0){
    html = `<div style="text-align:center;padding:40px 20px">
      <div style="font-size:32px;margin-bottom:12px">✓</div>
      <div style="font-size:14px;font-weight:700;color:var(--w1);margin-bottom:6px">Uyarı yok</div>
      <div style="font-size:12px;color:var(--w3)">${(_uyarilarGun ? _uyarilarGun+' '+MONTHS[m]+' için' : 'Tüm ay')} minimum şartları karşılıyor.</div>
    </div>`;
  } else {
    html = `<div style="background:rgba(232,87,42,0.06);border-radius:8px;margin-bottom:12px;overflow:hidden">
      <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;flex-wrap:wrap">
        <div>
          <span style="font-size:16px;font-weight:800;color:var(--red)">${toplamUyari}</span>
          <span style="font-size:11px;color:var(--w3);margin-left:6px">sorun</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span style="display:flex;align-items:center;gap:3px;font-size:9px;color:var(--red)"><span style="width:6px;height:6px;border-radius:50%;background:var(--red);display:inline-block"></span>Min</span>
          <span style="display:flex;align-items:center;gap:3px;font-size:9px;color:var(--orange)"><span style="width:6px;height:6px;border-radius:50%;background:var(--orange);display:inline-block"></span>Max</span>
          <span style="display:flex;align-items:center;gap:3px;font-size:9px;color:#9B7AE0"><span style="width:6px;height:6px;border-radius:50%;background:#9B7AE0;display:inline-block"></span>Kıdem</span>
        </div>
        <button onclick="akillicoz()" style="margin-left:auto;padding:5px 12px;border-radius:6px;background:var(--red);border:none;color:#fff;font-size:11px;font-weight:700;cursor:pointer;font-family:var(--font-sans);display:flex;align-items:center;gap:4px">
          ⚡ Tümünü Çöz
        </button>
      </div>
    </div>` + html;
  }
  el.innerHTML = html;
}

/* ── UYARI ÇÖZÜMLEME ── */
function uyariCoz(params, cozum){
  const {d, aId, eksik, fazla, kidemler, grpMin} = params;
  if(cozum === 'ekle_alan'){
    // O alana girebilecek, o gün atanmamış, max nöbete ulaşmamış asistanları bul
    const adaylar = ASSISTANTS.map((_,i)=>i).filter(i=>{
      if(!ASSISTANTS[i]) return false;
      if(S.schedule[gk(i,d)]) return false;
      if(_maxNobetAsildimi(i)) return false;
      const q = (S.quota[aId]||{})[ASSISTANTS[i].kidem]||0;
      return q > 0 && canAssign(i,d,aId,true);
    });
    // En az nöbetli olan önce
    adaylar.sort((a,b)=>_nobetSayisi(a)-_nobetSayisi(b));
    let eklenen=0;
    for(const i of adaylar){
      if(eklenen>=(eksik||1)) break;
      if(_maxNobetAsildimi(i)) continue;
      if(_nobetYazilamaz(i,d)) continue;
      S.schedule[gk(i,d)] = aId;
      eklenen++;
    }
    if(eklenen>0){ save(); renderSchedule(); renderTakStats(); renderUyarilar(); showToast(eklenen+' asistan eklendi'); }
    else showToast('Uygun asistan bulunamadı');

  } else if(cozum === 'cikar_alan'){
    // Fazla atanmış asistanları çıkar (en çok nöbetli olan önce)
    const atananlar = ASSISTANTS.map((_,i)=>i).filter(i=>ASSISTANTS[i]&&S.schedule[gk(i,d)]===aId);
    atananlar.sort((a,b)=>_nobetSayisi(b)-_nobetSayisi(a));
    atananlar.slice(0, fazla||1).forEach(i=>{ delete S.schedule[gk(i,d)]; });
    save(); renderSchedule(); renderTakStats(); renderUyarilar(); showToast('Fazla atama kaldırıldı');

  } else if(cozum === 'ekle_kidem'){
    // Gerekli kıdemden, o gün boş, max nöbete ulaşmamış birini ekle
    const adaylar = ASSISTANTS.map((_,i)=>i).filter(i=>{
      if(!ASSISTANTS[i]) return false;
      if(S.schedule[gk(i,d)]) return false;
      if(_maxNobetAsildimi(i)) return false;
      return kidemler.includes(ASSISTANTS[i].kidem) && ((S.quota[aId]||{})[ASSISTANTS[i].kidem]||0)>0 && canAssign(i,d,aId,true);
    });
    adaylar.sort((a,b)=>_nobetSayisi(a)-_nobetSayisi(b));
    const _uygunAday = adaylar.find(i=>!_nobetYazilamaz(i,d));
    if(_uygunAday!==undefined){
      S.schedule[gk(_uygunAday,d)] = aId;
      save(); renderSchedule(); renderTakStats(); renderUyarilar(); showToast(ASSISTANTS[_uygunAday].name+' eklendi');
    } else showToast('Uygun kıdem bulunamadı');
  }
}

// Uyarılar sekmesindeki sorun satırına tıklayınca — (kaldırıldı)
function openUyariOneriModal(){ return; }
function _openUyariOneriModal_disabled(sorunJSON){
  let sorun;
  try { sorun = typeof sorunJSON==='string' ? JSON.parse(sorunJSON) : sorunJSON; } catch(e){ return; }
  window._aktifOneriSorun = sorun; // uygulama sonrası kontrol için sakla
  const {m} = S.currentDate;
  const AY=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  const d = sorun.gun;
  const tipLbl = sorun.tip==='min'?'Min Eksik':sorun.tip==='kidem'?'Kıdem Eksik':'Max Fazla';
  const tipCol = sorun.tip==='min'?'var(--red)':sorun.tip==='kidem'?'#9B7AE0':'var(--orange)';

  document.getElementById('dmTitle').innerHTML =
    `<span style="color:${tipCol};font-size:11px;font-weight:700">${tipLbl}</span> &nbsp;${d} ${AY[m]}`;
  document.getElementById('dmSub').textContent = sorun.msg||'';

  const html = uyariOneriHTML(sorun);
  document.getElementById('dmBody').innerHTML =
    `<div style="font-size:10px;color:var(--w3);padding:8px 0 4px">💡 Önerilen çözümler:</div>${html}`;
  document.getElementById('dayModal').classList.add('open');
}

// Sapma barındaki asistan satırına tıklayınca — (kaldırıldı)
function openSapmaOneriModal(){ return; }
function _openSapmaOneriModal_disabled(astIdx, fark, alanSayim, alanHedef){
  const ast = ASSISTANTS[astIdx];
  if(!ast) return;
  const {y,m} = S.currentDate;
  const AY=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  const days = daysInMonth(y,m);
  const col = fark>0 ? 'var(--red)' : 'var(--orange)';
  const lbl = fark>0 ? '▲ Hedefin Üstünde' : '▼ Hedefin Altında';

  document.getElementById('dmTitle').innerHTML =
    `<span style="color:${col}">${lbl}</span>`;
  document.getElementById('dmSub').textContent = shortName(ast.name)+' — '+Math.abs(fark)+' nöbet '+(fark>0?'fazla':'eksik');

  // Alan dökümü
  const alanDokum = AREAS.filter(a=>(alanHedef[a.id]||0)>0).map(a=>{
    const as=alanSayim[a.id]||0, ah=alanHedef[a.id]||0, af=as-ah;
    const c=af>0?'var(--red)':af<0?'var(--orange)':'var(--w4)';
    return `<span style="display:inline-flex;align-items:center;gap:2px;padding:2px 7px;border-radius:3px;background:${a.color}18;border:1px solid ${a.color}44;font-size:9px;color:${a.color}">
      ${getAreaLabel(a.id)} <span style="color:${c};font-weight:700;margin-left:2px">${as}/${ah}</span>
    </span>`;
  }).join('');

  let body = alanDokum ? `<div style="display:flex;gap:4px;flex-wrap:wrap;padding:8px 0 12px">${alanDokum}</div>` : '';

  if(fark < 0){
    // Eksik: bu asistana yazılabilecek günler
    body += `<div style="font-size:10px;color:var(--w3);padding-bottom:6px">💡 Eklenebilecek günler:</div>`;
    let bulunan = 0;
    for(let d=1;d<=days && bulunan<8;d++){
      if(S.schedule[gk(astIdx,d)]) continue;
      AREAS.forEach(a=>{
        if(bulunan>=8) return;
        // canAssign kullan
        const orig = S.schedule[gk(astIdx,d)];
        if(canAssign(astIdx,d,a.id,true)){
          const dow=['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'][new Date(y,m,d).getDay()];
          body+=`<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--bord)">
            <span style="font-size:12px;font-weight:700;color:var(--w1);min-width:48px">${d} ${AY[m]}</span>
            <span style="font-size:10px;color:var(--w3)">${dow}</span>
            <div style="width:8px;height:8px;border-radius:2px;background:${a.color};flex-shrink:0"></div>
            <span style="font-size:11px;color:${a.color};flex:1">${a.name}</span>
            <button onclick="sapmaOneriEkle(${astIdx},${d},'${a.id}')"
              style="font-size:10px;padding:4px 12px;border-radius:5px;background:rgba(80,180,80,0.12);border:1px solid rgba(80,180,80,0.3);color:#80B840;cursor:pointer;font-weight:700;font-family:var(--font-sans)">+ Ekle</button>
          </div>`;
          bulunan++;
        }
      });
    }
    if(!bulunan) body += '<div style="color:var(--w4);font-size:11px;padding:8px 0">Müsait gün bulunamadı.</div>';

  } else {
    // Fazla: bu asistanın nöbetlerini göster, çıkar butonu
    body += `<div style="font-size:10px;color:var(--w3);padding-bottom:6px">💡 Çıkarılabilecek günler:</div>`;
    let found=0;
    for(let d=1;d<=days && found<8;d++){
      const aId=S.schedule[gk(astIdx,d)];
      if(!aId) continue;
      const a=AREAS.find(x=>x.id===aId);
      const dow=['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'][new Date(y,m,d).getDay()];
      body+=`<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--bord)">
        <span style="font-size:12px;font-weight:700;color:var(--w1);min-width:48px">${d} ${AY[m]}</span>
        <span style="font-size:10px;color:var(--w3)">${dow}</span>
        <div style="width:8px;height:8px;border-radius:2px;background:${a?a.color:'#888'};flex-shrink:0"></div>
        <span style="font-size:11px;color:${a?a.color:'var(--w3)'};flex:1">${a?a.name:'?'}</span>
        <button onclick="sapmaOneriCikar(${astIdx},${d})"
          style="font-size:10px;padding:4px 12px;border-radius:5px;background:rgba(232,87,42,0.1);border:1px solid rgba(232,87,42,0.3);color:var(--red);cursor:pointer;font-weight:700;font-family:var(--font-sans)">✕ Kaldır</button>
      </div>`;
      found++;
    }
    if(!found) body += '<div style="color:var(--w4);font-size:11px;padding:8px 0">Nöbet bulunamadı.</div>';
  }

  // Üste "Tüm sapmaları dengele" butonu ekle
  const dengeleBtn = fark>0
    ? `<button onclick="tümSapmalariCikar(${astIdx})" style="width:100%;padding:6px;margin-bottom:10px;border-radius:6px;background:rgba(232,87,42,0.1);border:1px solid rgba(232,87,42,0.3);color:var(--red);font-size:11px;font-weight:700;cursor:pointer;font-family:var(--font-sans)">⚡ Fazla nöbetleri kaldır (${Math.abs(fark)})</button>`
    : `<button onclick="tümSapmalariEkle(${astIdx})" style="width:100%;padding:6px;margin-bottom:10px;border-radius:6px;background:rgba(80,180,80,0.1);border:1px solid rgba(80,180,80,0.3);color:#80B840;font-size:11px;font-weight:700;cursor:pointer;font-family:var(--font-sans)">⚡ Eksik nöbetleri doldur (${Math.abs(fark)})</button>`;
  body = dengeleBtn + body;

  document.getElementById('dmBody').innerHTML = body;
  document.getElementById('dayModal').classList.add('open');
}

function tümSapmalariEkle(astIdx){
  if(window.ACILX_ROLE!=='basasistan') return;
  const {y,m}=S.currentDate; const days=daysInMonth(y,m);
  const ast=ASSISTANTS[astIdx]; if(!ast) return;
  const hedef=_hesaplaHedef(astIdx);
  let mevcut=0; for(let d=1;d<=days;d++) if(S.schedule[gk(astIdx,d)]) mevcut++;
  const eksik = hedef - mevcut;
  if(eksik<=0){ closeDayModal(); return; }

  let eklendi=0;

  // Geçiş 1: canAssign(ignoreHedef=true) — kota dahil tüm kurallar
  for(let d=1;d<=days&&eklendi<eksik;d++){
    if(S.schedule[gk(astIdx,d)]) continue;
    for(const a of AREAS){
      if(canAssign(astIdx,d,a.id,true)){
        S.schedule[gk(astIdx,d)]=a.id;
        eklendi++; break;
      }
    }
  }

  // Geçiş 2: kota dolmuşsa kota sınırını atla ama izinli/artarda/eğitim kısıtını koru
  if(eklendi<eksik){
    for(let d=1;d<=days&&eklendi<eksik;d++){
      if(S.schedule[gk(astIdx,d)]) continue;
      const dur=(S.astProfiles&&S.astProfiles[astIdx]&&S.astProfiles[astIdx].durum)||'aktif';
      if(dur==='izinli'||dur==='rot_hayir') break;
      const moKey2=y+'_'+m;
      const izinliAylik=((S.astProfiles&&S.astProfiles[astIdx]&&S.astProfiles[astIdx].izinliAylik)||{})[moKey2]||[];
      if(izinliAylik.includes(d)) continue;
      if(isEgtFull(y,m,d,ast.kidem)) continue;
      if(d>1&&S.schedule[gk(astIdx,d-1)]) continue;
      if(d<days&&S.schedule[gk(astIdx,d+1)]) continue;
      // Kota aşımına izin ver — aktif alana ata (ilk uygun)
      for(const a of AREAS){
        if(!isAlanAktif(d,a.id)) continue;
        if(((S.quota[a.id]||{})[ast.kidem]||0)===0) continue; // hiç kotası yok, atla
        const maxD=getDayRule(d,a.id).max||99;
        if(ASSISTANTS.filter((_,j)=>S.schedule[gk(j,d)]===a.id).length>=maxD) continue;
        S.schedule[gk(astIdx,d)]=a.id;
        eklendi++; break;
      }
    }
  }

  save(); renderSchedule(); renderTakStats(); renderUyarilar();
  _sapmaModalYenile(astIdx);
  if(eklendi>0) showToast(eklendi+' nöbet eklendi ✓'+(eklendi<eksik?' ('+( eksik-eklendi)+' eklenemedi)':''));
  else showToast('Uygun gün bulunamadı — izin/artarda/eğitim engeli');
}

function tümSapmalariCikar(astIdx){
  if(window.ACILX_ROLE!=='basasistan') return;
  const {y,m}=S.currentDate; const days=daysInMonth(y,m);
  const ast=ASSISTANTS[astIdx]; if(!ast) return;
  const hedef=_hesaplaHedef(astIdx);
  let mevcut=[]; for(let d=1;d<=days;d++) if(S.schedule[gk(astIdx,d)]) mevcut.push(d);
  const fazla=mevcut.length-hedef;
  if(fazla<=0){ closeDayModal(); return; }
  // En yüksek min-güvenceli günleri koruyarak fazlayı kaldır
  mevcut.sort((da,db)=>{
    const ruleA=getDayRule(da,S.schedule[gk(astIdx,da)]);
    const ruleB=getDayRule(db,S.schedule[gk(astIdx,db)]);
    const cntA=ASSISTANTS.filter((_,j)=>S.schedule[gk(j,da)]===S.schedule[gk(astIdx,da)]).length;
    const cntB=ASSISTANTS.filter((_,j)=>S.schedule[gk(j,db)]===S.schedule[gk(astIdx,db)]).length;
    // Min gereksinim karşılanıyor mu? Karşılanıyorsa bu gün silinebilir (kaldırınca min yine ok)
    const aOk=(cntA-1)>=(ruleA.min||0)?1:0;
    const bOk=(cntB-1)>=(ruleB.min||0)?1:0;
    return bOk-aOk; // silinebilirler önce
  });
  let kaldirildi=0;
  for(const d of mevcut){
    if(kaldirildi>=fazla) break;
    const aId=S.schedule[gk(astIdx,d)];
    const rule=getDayRule(d,aId);
    const cnt=ASSISTANTS.filter((_,j)=>S.schedule[gk(j,d)]===aId).length;
    if((cnt-1)>=(rule.min||0)){
      delete S.schedule[gk(astIdx,d)]; kaldirildi++;
    }
  }
  save(); renderSchedule(); renderTakStats(); renderUyarilar(); closeDayModal();
  showToast(kaldirildi>0?kaldirildi+' nöbet kaldırıldı ✓':'Kaldırılabilecek nöbet bulunamadı (min kısıtı)');
}

// ══════════════════════════════════════════════════════
// GLOBAL DENGELE — Tüm sapmaları tek tuşla düzelt
// Önce fazlaları kaldır, sonra eksikleri doldur.
// En güçsüz kalmış (algoritmadan en uzak) yerlere ekler.
// ══════════════════════════════════════════════════════
function tumSapmalariDengele(){
  if(!confirm('Tüm asistanların hedef sapmalarını dengelemek istiyor musun?\n\nFazlalar kaldırılıp eksikler doldurulacak.')) return;

  const {y,m}=S.currentDate;
  const days=daysInMonth(y,m);
  const moKey=y+'_'+m;
  let toplamKaldirilan=0, toplamEklenen=0;

  // ── PASS 1: Hedefin üstündekileri kaldır ──
  // Sapması en büyük olan asistandan başla → en az hasarla kaldır
  const fazlaList = _hesaplaSapma().filter(s=>s.fark>0).sort((a,b)=>b.fark-a.fark);
  for(const {i:astIdx, fark} of fazlaList){
    let mevcutGunler=[];
    for(let d=1;d<=days;d++) if(S.schedule[gk(astIdx,d)]) mevcutGunler.push(d);
    // Güvenli kaldırılabilecekleri sırala — min karşılanan günler önce
    mevcutGunler.sort((da,db)=>{
      const aIdA=S.schedule[gk(astIdx,da)], aIdB=S.schedule[gk(astIdx,db)];
      const rA=getDayRule(da,aIdA), rB=getDayRule(db,aIdB);
      const cntA=ASSISTANTS.filter((_,j)=>S.schedule[gk(j,da)]===aIdA).length;
      const cntB=ASSISTANTS.filter((_,j)=>S.schedule[gk(j,db)]===aIdB).length;
      const safeA=(cntA-1)>=(rA.min||0)?1:0;
      const safeB=(cntB-1)>=(rB.min||0)?1:0;
      if(safeB!==safeA) return safeB-safeA;
      // İkisi de güvenli: kalabalık alandakini sil (en az impact)
      return cntB-cntA;
    });
    let kaldirildi=0;
    for(const d of mevcutGunler){
      if(kaldirildi>=fark) break;
      const aId=S.schedule[gk(astIdx,d)];
      const rule=getDayRule(d,aId);
      const cnt=ASSISTANTS.filter((_,j)=>S.schedule[gk(j,d)]===aId).length;
      if((cnt-1)>=(rule.min||0)){
        delete S.schedule[gk(astIdx,d)];
        kaldirildi++; toplamKaldirilan++;
      }
    }
  }

  // ── PASS 2: Hedefin altındakileri doldur ──
  // En çok eksik olandan başla
  const eksikList = _hesaplaSapma().filter(s=>s.fark<0).sort((a,b)=>a.fark-b.fark);
  for(const {i:astIdx, fark, ast} of eksikList){
    if(_maxNobetAsildimi(astIdx)) continue; // Max nöbet kontrolü
    const eksik = Math.abs(fark);
    let eklendi=0;

    // Alan öncelik sırası: en çok eksik olan alan önce
    const alanEksikSira = AREAS.map(a=>{
      const as = _sayAlan(astIdx, a.id, days);
      const ah = (S.quota[a.id]||{})[ast.kidem]||0;
      return {a, eksik: ah - as};
    }).filter(x=>x.eksik>0).sort((a,b)=>b.eksik-a.eksik);

    // Gün öncelik sırası: en güçsüz (min eksik) günler önce
    const gunSkor = [];
    for(let d=1;d<=days;d++){
      if(S.schedule[gk(astIdx,d)]) continue;
      // Bu günün "zayıflık skoru": min eksiği ne kadar büyükse o kadar öncelikli
      let skor=0;
      AREAS.forEach(a=>{
        const rule=getDayRule(d,a.id);
        if(!rule.aktif) return;
        const cnt=ASSISTANTS.filter((_,j)=>S.schedule[gk(j,d)]===a.id).length;
        if(cnt<rule.min) skor+=(rule.min-cnt)*10; // min eksik çok ağırlıklı
      });
      gunSkor.push({d, skor});
    }
    gunSkor.sort((a,b)=>b.skor-a.skor); // En zayıf gün önce

    // Her gün için en uygun alanı dene
    for(const {d} of gunSkor){
      if(eklendi>=eksik||_maxNobetAsildimi(astIdx)) break;
      // Önce alan eksik sıraya göre dene
      for(const {a} of alanEksikSira){
        if(canAssign(astIdx,d,a.id,true)){
          S.schedule[gk(astIdx,d)]=a.id;
          eklendi++; toplamEklenen++; break;
        }
      }
      // O alanlar uymadıysa herhangi bir alana dene
      if(!S.schedule[gk(astIdx,d)]){
        for(const a of AREAS){
          if(canAssign(astIdx,d,a.id,true)){
            S.schedule[gk(astIdx,d)]=a.id;
            eklendi++; toplamEklenen++; break;
          }
        }
      }
    }

    // Geçiş 2: kota aşımına izin vererek doldur (art arda + izin kısıtı hâlâ geçerli)
    if(eklendi<eksik&&!_maxNobetAsildimi(astIdx)){
      for(const {d} of gunSkor){
        if(eklendi>=eksik||_maxNobetAsildimi(astIdx)) break;
        if(S.schedule[gk(astIdx,d)]) continue;
        if(_nobetYazilamaz(astIdx,d)) continue;
        if(isEgtFull(y,m,d,ast.kidem)) continue;
        for(const a of AREAS){
          if(!isAlanAktif(d,a.id)) continue;
          if(((S.quota[a.id]||{})[ast.kidem]||0)===0) continue;
          const maxD=getDayRule(d,a.id).max||99;
          if(ASSISTANTS.filter((_,j)=>S.schedule[gk(j,d)]===a.id).length>=maxD) continue;
          S.schedule[gk(astIdx,d)]=a.id;
          eklendi++; toplamEklenen++; break;
        }
      }
    }
  }

  // Kaydet ve TÜM ekranı güncelle
  save();
  renderNewCal(); renderTakStats(); renderUyarilar();
  if(_newView===1) renderAsstList();
  if(typeof updateTercihUI==='function') updateTercihUI();

  const msg = [];
  if(toplamKaldirilan>0) msg.push(toplamKaldirilan+' nöbet kaldırıldı');
  if(toplamEklenen>0) msg.push(toplamEklenen+' nöbet eklendi');
  showToast(msg.length>0 ? '⚡ '+msg.join(', ')+' ✓' : 'Değişiklik gerekmedi');
}

// Yardımcı: tüm asistanların sapmasını hesapla
// ── Merkezi hedef-sapma hesaplama — tüm uygulama bunu kullansın ──
function _hesaplaSapmaDetayli(){
  const {y,m}=S.currentDate;
  const days=daysInMonth(y,m);
  return ASSISTANTS.map((ast,i)=>{
    const hedef=_hesaplaHedef(i);
    let mevcut=0;
    const alanSayim={};
    AREAS.forEach(a=>{alanSayim[a.id]=0;});
    for(let d=1;d<=days;d++){
      const aId=S.schedule[gk(i,d)];
      if(aId){ mevcut++; if(alanSayim[aId]!==undefined) alanSayim[aId]++; }
    }
    // Alan bazlı hedef: quota[aId][kidem] = o asistanın o alandaki hedefi
    const alanDetay=[];
    AREAS.forEach(a=>{
      const alanH=(S.quota[a.id]||{})[ast.kidem]||0;
      if(alanH<=0) return;
      const alanM=alanSayim[a.id]||0;
      const fark=alanH-alanM;
      alanDetay.push({alan:a, hedef:alanH, mevcut:alanM, fark});
    });
    return {ast,i,hedef,mevcut,fark:mevcut-hedef,alanSayim,alanDetay};
  }).filter(s=>s.hedef>0);
}
// Basit versiyon — geriye uyumluluk
function _hesaplaSapma(){ return _hesaplaSapmaDetayli(); }

// Yardımcı: bir asistanın belirli alandaki nöbet sayısı
function _sayAlan(astIdx, aId, days){
  let cnt=0;
  for(let d=1;d<=days;d++) if(S.schedule[gk(astIdx,d)]===aId) cnt++;
  return cnt;
}

function sapmaOneriEkle(astIdx, d, aId){
  if(window.ACILX_ROLE!=='basasistan') return;
  if(!ASSISTANTS[astIdx]) return;
  const _seEngel=_nobetYazilamaz(astIdx,d);
  if(_seEngel){ showToast(_seEngel); return; }
  if(_maxNobetAsildimi(astIdx)){
    showToast(ASSISTANTS[astIdx].name+' max nöbet sayısına ulaştı — eklenemez');
    return;
  }
  S.schedule[gk(astIdx,d)] = aId;
  save(); renderSchedule(); renderTakStats(); renderUyarilar();
  _sapmaModalYenile(astIdx);
  showToast(ASSISTANTS[astIdx].name+' eklendi ✓');
}

function sapmaOneriCikar(astIdx, d){
  if(window.ACILX_ROLE!=='basasistan') return;
  delete S.schedule[gk(astIdx,d)];
  save(); renderSchedule(); renderTakStats(); renderUyarilar();
  _sapmaModalYenile(astIdx);
  showToast(ASSISTANTS[astIdx].name+' kaldırıldı');
}

// Modal içeriğini güncel durumla yenile — hedef karşılandıysa kapat
function _sapmaModalYenile(astIdx){
  const ast=ASSISTANTS[astIdx]; if(!ast){ closeDayModal(); return; }
  const hedef=_hesaplaHedef(astIdx);
  const {y,m}=S.currentDate; const days=daysInMonth(y,m);
  let mevcut=0; for(let d=1;d<=days;d++) if(S.schedule[gk(astIdx,d)]) mevcut++;
  const yeniFark = mevcut - hedef;
  if(yeniFark===0){ closeDayModal(); return; }
  // Merkezi hesaplama kullan
  const alanSayim={}, alanHedef={};
  AREAS.forEach(a=>{
    alanSayim[a.id]=_sayAlan(astIdx,a.id,days);
    alanHedef[a.id]=(S.quota[a.id]||{})[ast.kidem]||0;
  });
  openSapmaOneriModal(astIdx, yeniFark, alanSayim, alanHedef);
}


function ddSorunTikla(idx){
  const cache = window._ddSorunlarCache;
  if(!cache || !cache[idx]) return;
  openUyariOneriModal(cache[idx]);
}

function uyariGunCoz(d){
  AREAS.forEach(a=>{
    const rule=getDayRule(d,a.id);
    if(!rule.aktif) return;
    const cnt=ASSISTANTS.filter((_,i)=>S.schedule[gk(i,d)]===a.id).length;
    if(cnt<rule.min){
      uyariCoz({d,aId:a.id,eksik:rule.min-cnt,rule},'ekle_alan');
    }
  });
}

// ─── Akıllı toplu çözüm ─────────────────────────────────────────
function _sorunlariTopla(){
  const {y,m}=S.currentDate; const days=daysInMonth(y,m);
  const gorevler=[];
  for(let d=1;d<=days;d++){
    AREAS.forEach(a=>{
      const rule=getDayRule(d,a.id);
      if(!rule.aktif) return;
      const atananlar=ASSISTANTS.filter((_,i)=>S.schedule[gk(i,d)]===a.id);
      const cnt=atananlar.length;
      if(cnt<rule.min){
        const adaylar=_cozumEkle(d,a.id,[]);
        gorevler.push({tip:'min',d,alan:a,eksik:rule.min-cnt,adaylar,oncelik:adaylar.length});
      }
      if(cnt>0){
        kidemKuralIhlali(d,a.id).forEach(ih=>{
          const gerekli=ih.yaninda&&ih.yaninda.length?ih.yaninda:[ih.kidem];
          const adaylar=_cozumEkle(d,a.id,gerekli);
          gorevler.push({tip:'kidem',d,alan:a,kidemler:gerekli,
            eksik:1,adaylar,oncelik:adaylar.length});
        });
      }
      if(rule.max>0&&cnt>rule.max){
        gorevler.push({tip:'max',d,alan:a,fazla:cnt-rule.max,oncelik:0});
      }
    });
  }
  gorevler.sort((a,b)=>{
    if(a.tip==='max'&&b.tip!=='max') return 1;
    if(b.tip==='max'&&a.tip!=='max') return -1;
    return a.oncelik-b.oncelik;
  });
  return gorevler;
}

function akillicoz(){
  if(window.ACILX_ROLE!=='basasistan') return;
  const {y,m}=S.currentDate; const days=daysInMonth(y,m);
  const moKey=y+'_'+m;
  let cozulen=0;
  const manuelLog=[]; // Çözülemeyen sorunlar + neden

  // ── Yardımcılar ──────────────────────────────────────────────
  function dur(i){ return (S.astProfiles&&S.astProfiles[i]&&S.astProfiles[i].durum)||'aktif'; }
  function izinliGunler(i){
    return ((S.astProfiles&&S.astProfiles[i]&&S.astProfiles[i].izinliAylik)||{})[moKey]||[];
  }
  function hedef(i){ return _hesaplaHedef(i); }
  function nobetSay(i){ let n=0; for(let d=1;d<=days;d++) if(S.schedule[gk(i,d)]) n++; return n; }
  function alanCnt(d,aId){ return ASSISTANTS.filter((_,j)=>S.schedule[gk(j,d)]===aId).length; }

  // Tüm ihlalleri say
  function ihlalSay(){
    let toplam=0;
    for(let d=1;d<=days;d++){
      AREAS.forEach(a=>{
        const rule=getDayRule(d,a.id); if(!rule.aktif) return;
        const cnt=alanCnt(d,a.id);
        if(cnt<rule.min) toplam+=(rule.min-cnt);
        if(rule.max>0&&cnt>rule.max) toplam+=(cnt-rule.max);
        // Kıdem kuralı ihlali (yalnız tutamaz)
        if(cnt>0) toplam+=kidemKuralIhlali(d,a.id).length;
      });
    }
    return toplam;
  }

  // Bir hamlenin güvenli olup olmadığını kontrol et
  // Hamleyi uygula, ihlal artıyorsa veya max nöbet aşılıyorsa geri al
  function guvenliEkle(i,d,aId){
    if(S.schedule[gk(i,d)]) return false;
    if(_nobetYazilamaz(i,d)) return false;
    // Max nöbet sayısı kontrolü — hedefi geçme
    if(nobetSay(i)>=hedef(i)) return false;
    const onceki=ihlalSay();
    S.schedule[gk(i,d)]=aId;
    const sonraki=ihlalSay();
    if(sonraki>onceki){
      // Bu hamle yeni ihlal yarattı — geri al
      delete S.schedule[gk(i,d)];
      return false;
    }
    return true;
  }

  function guvenliCikar(i,d){
    const aId=S.schedule[gk(i,d)]; if(!aId) return false;
    const onceki=ihlalSay();
    delete S.schedule[gk(i,d)];
    const sonraki=ihlalSay();
    if(sonraki>onceki){
      S.schedule[gk(i,d)]=aId;
      return false;
    }
    return true;
  }

  // Temel uygunluk — izin, artarda, eğitim, durum
  function temelUygun(i,d){
    if(!ASSISTANTS[i]) return false;
    const dd=dur(i);
    if(dd==='izinli'||dd==='rot_hayir') return false;
    if(izinliGunler(i).includes(d)) return false;
    if(isEgtFull(y,m,d,ASSISTANTS[i].kidem)) return false;
    if(S.schedule[gk(i,d)]) return false;
    if(d>1&&S.schedule[gk(i,d-1)]) return false;
    if(d<days&&S.schedule[gk(i,d+1)]) return false;
    if(d===1&&S.prevMonthLastDay&&S.prevMonthLastDay[i]) return false;
    if(d===days&&S.nextMonthFirstDay&&S.nextMonthFirstDay[i]) return false;
    return true;
  }

  // ═══════════════════════════════════════════════════════════
  // GEÇİŞ DÖNGÜSÜ — maksimum 3 geçiş
  // ═══════════════════════════════════════════════════════════
  for(let gecis=1; gecis<=3; gecis++){
    const gecisBaslangic=ihlalSay();
    if(gecisBaslangic===0) break;
    console.log('[ACİLX] akillicoz geçiş '+gecis+', toplam ihlal:', gecisBaslangic);

    // ── ADIM 1: MAX aşımlarını çöz — fazla asistanı çıkar ──
    for(let d=1;d<=days;d++){
      AREAS.forEach(a=>{
        const rule=getDayRule(d,a.id); if(!rule.aktif) return;
        const cnt=alanCnt(d,a.id);
        if(rule.max>0&&cnt>rule.max){
          const fazla=cnt-rule.max;
          // En çok nöbetçi olan asistandan başla
          const adaylar=ASSISTANTS.map((_,j)=>j)
            .filter(j=>S.schedule[gk(j,d)]===a.id)
            .sort((x,z)=>nobetSay(z)-nobetSay(x));
          let cikarilan=0;
          for(const j of adaylar){
            if(cikarilan>=fazla) break;
            if(guvenliCikar(j,d)){ cikarilan++; cozulen++; }
          }
        }
      });
    }

    // ── ADIM 2: MIN doluluk ihlallerini çöz — asistan ekle ──
    for(let d=1;d<=days;d++){
      AREAS.forEach(a=>{
        const rule=getDayRule(d,a.id); if(!rule.aktif) return;
        const cnt=alanCnt(d,a.id);
        if(cnt>=rule.min) return;
        const eksik=rule.min-cnt;
        // Uygun asistanlar: temelUygun + alan kotası var + hedef dolmamış tercih
        const adaylar=ASSISTANTS.map((_,j)=>j)
          .filter(j=>{
            if(!ASSISTANTS[j]) return false;
            if(!temelUygun(j,d)) return false;
            if(!isAlanAktif(d,a.id)) return false;
            const kotaVar=((S.quota[a.id]||{})[ASSISTANTS[j].kidem]||0)>0;
            if(!kotaVar) return false;
            return true;
          })
          .sort((x,z)=>{
            // Hedeften en uzak olan önce
            const kalanX=hedef(x)-nobetSay(x), kalanZ=hedef(z)-nobetSay(z);
            return kalanZ-kalanX;
          });
        let eklendi=0;
        for(const j of adaylar){
          if(eklendi>=eksik) break;
          if(guvenliEkle(j,d,a.id)){ eklendi++; cozulen++; }
        }
        // Çözemediyse — kota aşımına izin vererek dene (2. ve 3. geçiş)
        if(eklendi<eksik && gecis>=2){
          const adaylar2=ASSISTANTS.map((_,j)=>j)
            .filter(j=>ASSISTANTS[j]&&temelUygun(j,d)&&isAlanAktif(d,a.id)&&((S.quota[a.id]||{})[ASSISTANTS[j].kidem]||0)>0)
            .sort((x,z)=>(hedef(z)-nobetSay(z))-(hedef(x)-nobetSay(x)));
          for(const j of adaylar2){
            if(eklendi>=eksik) break;
            if(guvenliEkle(j,d,a.id)){ eklendi++; cozulen++; }
          }
        }
      });
    }

    // ── ADIM 3: KIDEM KURALI ihlallerini çöz (yalnız tutamaz) ──
    for(let d=1;d<=days;d++){
      AREAS.forEach(a=>{
        const rule=getDayRule(d,a.id); if(!rule.aktif) return;
        const cnt=alanCnt(d,a.id); if(cnt<=0) return;
        const ihlaller=kidemKuralIhlali(d,a.id);
        if(!ihlaller.length) return;
        const maxD=rule.max||99;
        ihlaller.forEach(ih=>{
          if(alanCnt(d,a.id)>=maxD) return;
          const gerekliKidemler=ih.yaninda&&ih.yaninda.length?ih.yaninda:[ih.kidem];
          const adaylar=ASSISTANTS.map((_,j)=>j)
            .filter(j=>ASSISTANTS[j]&&gerekliKidemler.includes(ASSISTANTS[j].kidem)&&temelUygun(j,d)&&((S.quota[a.id]||{})[ASSISTANTS[j].kidem]||0)>0)
            .sort((x,z)=>(hedef(z)-nobetSay(z))-(hedef(x)-nobetSay(x)));
          for(const j of adaylar){
            if(guvenliEkle(j,d,a.id)){ cozulen++; break; }
          }
        });
      });
    }

    const gecisSonu=ihlalSay();
    console.log('[ACİLX] akillicoz geçiş '+gecis+' tamamlandı, ihlal: '+gecisBaslangic+' → '+gecisSonu);
    if(gecisSonu===0||gecisSonu>=gecisBaslangic) break; // İyileşme yoksa döngüden çık
  }

  // ── Çözülemeyen sorunları tespit et ──
  for(let d=1;d<=days;d++){
    AREAS.forEach(a=>{
      const rule=getDayRule(d,a.id); if(!rule.aktif) return;
      const cnt=alanCnt(d,a.id);
      if(cnt<rule.min){
        // Neden çözülemedi?
        const uygunAst=ASSISTANTS.map((_,j)=>j).filter(j=>ASSISTANTS[j]&&temelUygun(j,d)&&((S.quota[a.id]||{})[ASSISTANTS[j].kidem]||0)>0);
        const maxaOlmayan=uygunAst.filter(j=>nobetSay(j)<hedef(j));
        let neden='';
        if(uygunAst.length===0) neden='Uygun asistan yok (tümü izinli, art arda engeli veya eğitimde)';
        else if(maxaOlmayan.length===0) neden='Çözülemiyor: tüm uygun asistanlar max nöbet sayısına ulaştı ('+uygunAst.length+' aday)';
        else neden='Atanabilir asistan var ama atama yeni ihlal yaratıyor ('+maxaOlmayan.length+' aday)';
        manuelLog.push({tip:'min',d,alan:a.name,eksik:rule.min-cnt,neden});
      }
      if(rule.max>0&&cnt>rule.max){
        manuelLog.push({tip:'max',d,alan:a.name,fazla:cnt-rule.max,neden:'Çıkarılabilecek asistan yok (min doluluk bozulur)'});
      }
      // Kıdem kuralı ihlali
      if(cnt>0){
        kidemKuralIhlali(d,a.id).forEach(ih=>{
          manuelLog.push({tip:'kidem',d,alan:a.name,eksik:1,neden:ih.msg});
        });
      }
    });
  }

  save(); renderSchedule(); renderTakStats(); renderUyarilar();

  // ── Sonuç bildirimi ──
  if(manuelLog.length>0){
    console.log('[ACİLX] akillicoz: çözülemeyen sorunlar:', manuelLog);
    let body='<div style="font-size:11px;color:var(--w3);margin-bottom:10px">'+
      '✓ <b>'+cozulen+'</b> sorun çözüldü, <b>'+manuelLog.length+'</b> sorun manuel müdahale gerektiriyor.</div>';
    body+='<div style="max-height:300px;overflow:auto">';
    const TIP_LABEL={min:'Min eksik',max:'Max aşımı',kidem:'Kıdem ihlali'};
    const TIP_COLOR={min:'var(--red)',max:'var(--orange)',kidem:'#9B7AE0'};
    manuelLog.forEach(m=>{
      body+='<div style="padding:8px 10px;border-bottom:1px solid var(--bord)">'+
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">'+
          '<span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;background:rgba(0,0,0,0.1);color:'+TIP_COLOR[m.tip]+'">'+TIP_LABEL[m.tip]+'</span>'+
          '<span style="font-size:11px;font-weight:600;color:var(--w1)">'+m.d+'. gün — '+m.alan+'</span>'+
        '</div>'+
        '<div style="font-size:10px;color:var(--w4);padding-left:4px">'+m.neden+'</div>'+
      '</div>';
    });
    body+='</div>';
    document.getElementById('dmTitle').innerHTML='<span style="color:var(--orange)">Manuel Müdahale Gerekiyor</span>';
    document.getElementById('dmSub').textContent=manuelLog.length+' sorun otomatik çözülemedi';
    document.getElementById('dmBody').innerHTML=body;
    document.getElementById('dayModal').classList.add('open');
  } else if(cozulen>0){
    showToast('✓ '+cozulen+' sorun çözüldü');
  } else {
    showToast('Çözülecek sorun bulunamadı ✓');
  }
}

function tumUyarilariCoz(){
  akillicoz();
}


// ═══════════════════════════════════════════════════════════════
// ÖNERİ MOTORU — Her uyarı tipi için akıllı çözüm önerileri
// ═══════════════════════════════════════════════════════════════

// Temel yardımcılar
// ═══════════════════════════════════════════════════════════════
// ÖNERİ MOTORU v2 — canAssign() ile tam kural kontrolü
// ═══════════════════════════════════════════════════════════════

// Bir asistanın ay içi toplam nöbet sayısı
function _nobetSayisi(i){
  const {y,m}=S.currentDate; const days=daysInMonth(y,m);
  let n=0; for(let d=1;d<=days;d++) if(S.schedule[gk(i,d)]) n++;
  return n;
}

// canAssign kullanarak direkt eklenebilecek asistanlar
function _cozumEkle(d, aId, kidemFiltre){
  const {y,m}=S.currentDate;
  return ASSISTANTS.map((_,i)=>i)
    .filter(i=>{
      if(!ASSISTANTS[i]) return false;
      if(S.schedule[gk(i,d)]) return false; // zaten o gün nöbetçi
      if(_maxNobetAsildimi(i)) return false; // max nöbet kontrolü
      if(kidemFiltre&&kidemFiltre.length&&!kidemFiltre.includes(ASSISTANTS[i].kidem)) return false;
      return canAssign(i,d,aId,true); // tüm kurallar — kota, izin, art arda, eğitim
    })
    .sort((a,b)=>_nobetSayisi(a)-_nobetSayisi(b));
}

// Gerçek takas önerileri: iA(dA) ↔ iB(dB)
// Her iki yön de kural kontrolünden geçer
function _cozumTakas(d, aId, kidemFiltre){
  const {y,m}=S.currentDate; const days=daysInMonth(y,m);
  const _ctMoKey=y+'_'+m;
  const sonuclar=[];

  // Bu güne (d, aId) gelmesi gereken kıdemdeki asistanlar başka günde nöbetçi
  for(let iB=0; iB<ASSISTANTS.length; iB++){
    if(!ASSISTANTS[iB]) continue;
    if(kidemFiltre&&kidemFiltre.length&&!kidemFiltre.includes(ASSISTANTS[iB].kidem)) continue;
    // İzinli asistanları atla
    const _ctProf=(S.astProfiles&&S.astProfiles[iB])||{};
    const _ctDur=_ctProf.durum||'aktif';
    if(_ctDur==='izinli'||_ctDur==='rot_hayir') continue;
    const _ctIzin=((_ctProf.izinliAylik)||{})[_ctMoKey]||[];
    if(_ctIzin.includes(d)) continue; // Hedef günde izinli
    for(let dB=1; dB<=days; dB++){
      if(dB===d) continue;
      const alanB = S.schedule[gk(iB,dB)];
      if(!alanB) continue;
      if(S.schedule[gk(iB,d)]) continue; // iB zaten d'de nöbetçi
      
      // iB → d/aId'ye gelebilir mi? (dB boşalacak, d'ye gelecek)
      // Geçici olarak dB'yi çıkar, d'ye koy, kontrol et, geri al
      delete S.schedule[gk(iB,dB)];
      const iB_dD_ok = canAssign(iB,d,aId,true);
      S.schedule[gk(iB,dB)] = alanB; // geri al
      if(!iB_dD_ok) continue;
      
      // dB boşalınca alanB'nin minimumu bozulur mu?
      const cnt_dB = ASSISTANTS.filter((_,j)=>S.schedule[gk(j,dB)]===alanB).length;
      const rule_dB = getDayRule(dB,alanB);
      if(cnt_dB-1 < (rule_dB.min||0)) continue;
      
      // Bu gerçek takas mı (karşılıklı) yoksa tek yönlü transfer mi?
      // Önce tek yönlü transfer dene (dB boşalır, d dolar)
      sonuclar.push({tip:'transfer', iB, dB, alanB,
        label: ASSISTANTS[iB].name+' — '+dB+'. gün → '+d+'. güne taşı'});
      if(sonuclar.length>=6) return sonuclar;
    }
  }
  
  // Gerçek takas: bu günde nöbetçi biri, başka günle yer değiştirir
  const buGunAtananlar = ASSISTANTS.map((_,i)=>i).filter(i=>ASSISTANTS[i]&&S.schedule[gk(i,d)]===aId);
  for(const iA of buGunAtananlar){
    for(let iB=0; iB<ASSISTANTS.length; iB++){
      if(!ASSISTANTS[iB]) continue;
      if(iB===iA) continue;
      if(kidemFiltre&&kidemFiltre.length&&!kidemFiltre.includes(ASSISTANTS[iB].kidem)) continue;
      // İzinli asistanları atla
      const _ct2Prof=(S.astProfiles&&S.astProfiles[iB])||{};
      const _ct2Dur=_ct2Prof.durum||'aktif';
      if(_ct2Dur==='izinli'||_ct2Dur==='rot_hayir') continue;
      const _ct2Izin=((_ct2Prof.izinliAylik)||{})[_ctMoKey]||[];
      if(_ct2Izin.includes(d)) continue;
      for(let dB=1; dB<=days; dB++){
        if(dB===d) continue;
        const alanB=S.schedule[gk(iB,dB)];
        if(!alanB) continue;
        if(S.schedule[gk(iA,dB)]) continue;
        if(S.schedule[gk(iB,d)]) continue;
        // Takas: iA d→dB, iB dB→d
        const tmpA=S.schedule[gk(iA,d)]; const tmpB=S.schedule[gk(iB,dB)];
        delete S.schedule[gk(iA,d)]; delete S.schedule[gk(iB,dB)];
        const okA=canAssign(iA,dB,alanB,true);
        const okB=canAssign(iB,d,aId,true);
        S.schedule[gk(iA,d)]=tmpA; S.schedule[gk(iB,dB)]=tmpB; // geri al
        if(okA&&okB){
          sonuclar.push({tip:'takas', iA, iB, dB, alanB,
            label: ASSISTANTS[iA].name+' ('+d+'.gün) ↔ '+ASSISTANTS[iB].name+' ('+dB+'.gün)'});
          if(sonuclar.length>=6) return sonuclar;
        }
      }
      if(sonuclar.length>=6) return sonuclar;
    }
  }
  return sonuclar;
}

// Max fazla: çıkarılabilecekler
function _cozumCikar(d, aId, kidemFiltre){
  return ASSISTANTS.map((_,i)=>i)
    .filter(i=>{
      if(!ASSISTANTS[i]) return false;
      if(S.schedule[gk(i,d)]!==aId) return false;
      if(kidemFiltre&&kidemFiltre.length&&!kidemFiltre.includes(ASSISTANTS[i].kidem)) return false;
      return true;
    })
    .sort((a,b)=>_nobetSayisi(b)-_nobetSayisi(a));
}

// ─── Öneri Motoru v3 ───────────────────────────────────────────
// Öneri cache — tırnak çakışması olmadan onclick
window._oneriCache = [];

function _oneriCacheTemizle(){ window._oneriCache = []; }

function _oneriEkle(entry){
  const idx = window._oneriCache.length;
  window._oneriCache.push(entry);
  return idx;
}

// Global — öneri butonuna tıklayınca
function oneriUygula(idx){
  const e = window._oneriCache[idx];
  if(!e) return;
  uyariOneriUygula(e.tip, e.iA, e.d, e.aId, e.dB||0, e.alanB||'', e.iB);
}

// Başasistana sor (kural esnetme)
function oneriBasasistanaOnayla(idx){
  const e = window._oneriCache[idx];
  if(!e) return;
  const msg = e.onayMesaji || 'Bu işlem kural istisnası gerektiriyor. Onaylıyor musunuz?';
  if(!confirm(msg)) return;
  uyariOneriUygula(e.tip, e.iA, e.d, e.aId, e.dB||0, e.alanB||'', e.iB);
}

// Simülasyon: bu öneriyi uygulasak sorun çözülür mü?
function _oneriCozumu(sorun, tip, iA, d, aId, dB, alanB, iB){
  const tmpSched = Object.assign({}, S.schedule);
  if(tip==='ekle'){
    tmpSched[gk(iA,d)]=aId;
  } else if(tip==='transfer'){
    delete tmpSched[gk(iA,dB)];
    tmpSched[gk(iA,d)]=aId;
  } else if(tip==='takas'){
    delete tmpSched[gk(iA,d)];
    delete tmpSched[gk(iB,dB)];
    tmpSched[gk(iA,dB)]=alanB;
    tmpSched[gk(iB,d)]=aId;
  } else if(tip==='cikar'){
    delete tmpSched[gk(iA,d)];
  }
  const cnt=ASSISTANTS.filter((_,j)=>tmpSched[gk(j,sorun.gun)]===sorun.alan.id).length;
  const rule=getDayRule(sorun.gun, sorun.alan.id);
  if(sorun.tip==='min') return cnt>=(rule.min||0);
  if(sorun.tip==='max') return !(rule.max>0 && cnt>rule.max);
  if(sorun.tip==='kidem'){
    // Geçici schedule ile kidem kuralı ihlali kontrol et
    const origS={};
    ASSISTANTS.forEach((_,j)=>{const key=gk(j,sorun.gun);origS[key]=S.schedule[key];S.schedule[key]=tmpSched[key];});
    const ih=kidemKuralIhlali(sorun.gun,sorun.alan.id);
    ASSISTANTS.forEach((_,j)=>{const key=gk(j,sorun.gun);if(origS[key]===undefined)delete S.schedule[key];else S.schedule[key]=origS[key];});
    return ih.length===0;
  }
  return true;
}

function uyariOneriHTML(sorun){
  const {tip, alan, gun:d} = sorun;
  const AY=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  const {m}=S.currentDate;
  _oneriCacheTemizle();

  // Öneri satırı oluştur
  function oneriSatir(tip, params, aciklama, btnLabel, btnStyle, cozur, onayGerektir, onayMesaji){
    const cIdx = _oneriEkle({
      tip, iA:params[0], d:params[1], aId:params[2],
      dB:params[3]||0, alanB:params[4]||'', iB:params[5],
      onayMesaji
    });
    const badge = cozur
      ? '<span style="font-size:9px;padding:2px 6px;border-radius:3px;background:rgba(80,180,80,0.15);color:#80B840;font-weight:700;flex-shrink:0">✓ Çözer</span>'
      : '<span style="font-size:9px;padding:2px 6px;border-radius:3px;background:rgba(240,160,64,0.12);color:var(--orange);font-weight:700;flex-shrink:0">△ Kısmî</span>';
    const btn = onayGerektir
      ? `<button onclick="oneriBasasistanaOnayla(${cIdx})" style="${btnStyle};background:rgba(240,160,64,0.12);border:1px solid rgba(240,160,64,0.4);color:var(--orange)">⚠ Onayla</button>`
      : `<button onclick="oneriUygula(${cIdx})" style="${btnStyle}">${btnLabel}</button>`;
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid var(--bord)">
      <span style="font-size:11px;color:var(--w2);flex:1;min-width:0">${aciklama}</span>
      ${badge}${btn}
    </div>`;
  }

  const btnS = 'font-size:10px;padding:4px 12px;border-radius:5px;cursor:pointer;font-weight:700;font-family:var(--font-sans);flex-shrink:0;white-space:nowrap';

  let html = '';

  if(tip==='min'||tip==='kidem'){
    let kidemler = [];
    if(tip==='kidem'){
      const kMatch = sorun.msg.match(/K(\d+(?:\/\d+)*)/);
      if(kMatch && kMatch[1]) kidemler = kMatch[1].split('/').map(Number).filter(Boolean);
    }

    // ── Direkt Ekle ──────────────────────────────────────────
    const direkt = _cozumEkle(d, alan.id, kidemler);
    const direktCozur = direkt.filter(i=>_oneriCozumu(sorun,'ekle',i,d,alan.id,0,''));
    const direktKismi = direkt.filter(i=>!_oneriCozumu(sorun,'ekle',i,d,alan.id,0,''));

    if(direktCozur.length){
      html += `<div style="padding:5px 14px 2px;font-size:9px;font-weight:700;color:#80B840;letter-spacing:.4px;text-transform:uppercase;background:rgba(80,180,80,0.04);border-bottom:1px solid var(--bord)">✚ Direkt Ekle</div>`;
      direktCozur.slice(0,4).forEach(i=>{
        const ast=ASSISTANTS[i];
        const alan2=AREAS.find(a=>a.id===alan.id);
        const acik=`<span class="kt ${KIDEM_CLS[ast.kidem]}" style="font-size:9px;padding:1px 4px;margin-right:3px">K${ast.kidem}</span>${shortName(ast.name)} → <span style="color:${alan2?.color||'var(--w3)'}">${alan2?.name||alan.id}</span>`;
        html+=oneriSatir('ekle',[i,d,alan.id,0,''],acik,'+ Ekle',
          `${btnS};background:rgba(80,180,80,0.12);border:1px solid rgba(80,180,80,0.3);color:#80B840`,
          true,false,'');
      });
    }

    // ── Transfer (başka günden taşı) ─────────────────────────
    const takaslar = _cozumTakas(d, alan.id, kidemler);
    const transferCozur = takaslar.filter(t=>t.tip==='transfer'&&_oneriCozumu(sorun,'transfer',t.iB,d,alan.id,t.dB,t.alanB));
    const takasCozur = takaslar.filter(t=>t.tip==='takas'&&_oneriCozumu(sorun,'takas',t.iA,d,alan.id,t.dB,t.alanB,t.iB));

    if(transferCozur.length){
      html += `<div style="padding:5px 14px 2px;font-size:9px;font-weight:700;color:rgba(100,160,255,0.9);letter-spacing:.4px;text-transform:uppercase;background:rgba(80,130,220,0.04);border-bottom:1px solid var(--bord);border-top:1px solid var(--bord)">⇒ Gün Taşı</div>`;
      transferCozur.slice(0,3).forEach(t=>{
        const ast=ASSISTANTS[t.iB];
        const alanSrc=AREAS.find(a=>a.id===t.alanB);
        const alanDst=AREAS.find(a=>a.id===alan.id);
        const acik=`<span class="kt ${KIDEM_CLS[ast.kidem]}" style="font-size:9px;padding:1px 4px;margin-right:3px">K${ast.kidem}</span>${shortName(ast.name)}: <span style="color:${alanSrc?.color||'var(--w3)'}">${t.dB} ${AY[m]}</span> → <span style="color:${alanDst?.color||'var(--w3)'}">${d} ${AY[m]} ${alanDst?.name||alan.id}</span>`;
        html+=oneriSatir('transfer',[t.iB,d,alan.id,t.dB,t.alanB],acik,'⇒ Taşı',
          `${btnS};background:rgba(80,130,220,0.12);border:1px solid rgba(80,130,220,0.3);color:rgba(100,160,255,0.9)`,
          true,false,'');
      });
    }

    if(takasCozur.length){
      html += `<div style="padding:5px 14px 2px;font-size:9px;font-weight:700;color:#9B7AE0;letter-spacing:.4px;text-transform:uppercase;background:rgba(155,122,224,0.04);border-bottom:1px solid var(--bord);border-top:1px solid var(--bord)">⇄ Gerçek Takas</div>`;
      takasCozur.slice(0,3).forEach(t=>{
        const astA=ASSISTANTS[t.iA]; const astB=ASSISTANTS[t.iB];
        const alanA=AREAS.find(a=>a.id===alan.id);
        const alanBObj=AREAS.find(a=>a.id===t.alanB);
        const acik=`<span class="kt ${KIDEM_CLS[astA.kidem]}" style="font-size:9px;padding:1px 3px;margin-right:2px">K${astA.kidem}</span>${shortName(astA.name)} (<span style="color:${alanA?.color}">${d}/${AY[m]}</span>) ⇄ <span class="kt ${KIDEM_CLS[astB.kidem]}" style="font-size:9px;padding:1px 3px;margin:0 2px">K${astB.kidem}</span>${shortName(astB.name)} (<span style="color:${alanBObj?.color}">${t.dB}/${AY[m]}</span>)`;
        html+=oneriSatir('takas',[t.iA,d,alan.id,t.dB,t.alanB,t.iB],acik,'⇄ Takas',
          `${btnS};background:rgba(155,122,224,0.12);border:1px solid rgba(155,122,224,0.3);color:#9B7AE0`,
          true,false,'');
      });
    }

    // ── Kısmî çözümler (çözmez ama yardımcı olur) ────────────
    const kismiDirekt = direktKismi.slice(0,2);
    if(kismiDirekt.length && !direktCozur.length && !transferCozur.length && !takasCozur.length){
      html += `<div style="padding:5px 14px 2px;font-size:9px;font-weight:700;color:var(--orange);letter-spacing:.4px;text-transform:uppercase;background:rgba(240,160,64,0.04);border-bottom:1px solid var(--bord)">△ Kısmî (Tam Çözmez)</div>`;
      kismiDirekt.forEach(i=>{
        const ast=ASSISTANTS[i];
        const alan2=AREAS.find(a=>a.id===alan.id);
        const acik=`<span class="kt ${KIDEM_CLS[ast.kidem]}" style="font-size:9px;padding:1px 4px;margin-right:3px">K${ast.kidem}</span>${shortName(ast.name)} → <span style="color:${alan2?.color||'var(--w3)'}">${alan2?.name||alan.id}</span>`;
        html+=oneriSatir('ekle',[i,d,alan.id,0,''],acik,'+ Ekle',
          `${btnS};background:rgba(240,160,64,0.1);border:1px solid rgba(240,160,64,0.3);color:var(--orange)`,
          false,false,'');
      });
    }

    // ── Başasistana sor (kural esnetme) ──────────────────────
    // Kota dolmuş ama asistan müsait → başasistana sor
    const kotaAsmali = ASSISTANTS.map((_,i)=>i).filter(i=>{
      if(S.schedule[gk(i,d)]) return false;
      if(kidemler&&kidemler.length&&!kidemler.includes(ASSISTANTS[i].kidem)) return false;
      const dur=(S.astProfiles&&S.astProfiles[i]&&S.astProfiles[i].durum)||'aktif';
      if(dur==='izinli'||dur==='rot_hayir') return false;
      const moKey=S.currentDate.y+'_'+S.currentDate.m;
      const izinli=((S.astProfiles&&S.astProfiles[i]&&S.astProfiles[i].izinliAylik)||{})[moKey]||[];
      if(izinli.includes(d)) return false;
      if(isEgtFull(S.currentDate.y,S.currentDate.m,d,ASSISTANTS[i].kidem)) return false;
      if(d>1&&S.schedule[gk(i,d-1)]) return false;
      const days=daysInMonth(S.currentDate.y,S.currentDate.m);
      if(d<days&&S.schedule[gk(i,d+1)]) return false;
      // Kota dolu ama girebileceği alan
      if(((S.quota[alan.id]||{})[ASSISTANTS[i].kidem]||0)===0) return false;
      // Normal canAssign'dan geçmedi (kota dolu), direkt listede zaten yok
      return !direkt.includes(i);
    });
    if(kotaAsmali.length && !direktCozur.length){
      html += `<div style="padding:5px 14px 2px;font-size:9px;font-weight:700;color:var(--orange);letter-spacing:.4px;text-transform:uppercase;background:rgba(240,160,64,0.06);border-bottom:1px solid var(--bord);border-top:1px solid var(--bord)">⚠ Kota Aşımı — Başasistan Onayı</div>`;
      kotaAsmali.slice(0,3).forEach(i=>{
        const ast=ASSISTANTS[i];
        const used=Object.keys(S.schedule).filter(k=>k.startsWith(i+'_')&&S.schedule[k]===alan.id).length; // yaklaşık
        const mota=(S.quota[alan.id]||{})[ast.kidem]||0;
        const alan2=AREAS.find(a=>a.id===alan.id);
        const acik=`<span class="kt ${KIDEM_CLS[ast.kidem]}" style="font-size:9px;padding:1px 4px;margin-right:3px">K${ast.kidem}</span>${shortName(ast.name)} → <span style="color:${alan2?.color}">${alan2?.name}</span> <span style="font-size:9px;color:var(--orange)">(kota dolu)</span>`;
        html+=oneriSatir('ekle',[i,d,alan.id,0,''],acik,'+ Ekle',
          `${btnS};background:rgba(240,160,64,0.1);border:1px solid rgba(240,160,64,0.3);color:var(--orange)`,
          _oneriCozumu(sorun,'ekle',i,d,alan.id,0,''),true,
          `${_esc(ast.name)} kendi ${alan2?.name} kotasını aştı. Başasistan olarak onaylıyor musun?`);
      });
    }

    if(!html)
      html = '<div style="padding:16px 14px;font-size:11px;color:var(--w4);text-align:center">⚠ Çözüm bulunamadı.<br><span style="font-size:10px">İzin veya art arda kısıtı engelliyor.</span></div>';

  } else if(tip==='max'){
    const kidemMatch = sorun.msg.match(/K(\d+(?:\/\d+)*)/);
    const kidemler = kidemMatch ? kidemMatch[1].split('/').map(Number).filter(Boolean) : [];
    const cikar = _cozumCikar(d, alan.id, kidemler);

    if(!cikar.length)
      return '<div style="padding:12px 14px;font-size:11px;color:var(--w4)">Çıkarılacak asistan bulunamadı.</div>';

    html+=`<div style="padding:5px 14px 2px;font-size:9px;font-weight:700;color:var(--w4);letter-spacing:.4px;text-transform:uppercase;background:rgba(232,87,42,0.04);border-bottom:1px solid var(--bord)">✕ Fazlayı Kaldır</div>`;
    cikar.slice(0,4).forEach(i=>{
      const ast=ASSISTANTS[i];
      const alan2=AREAS.find(a=>a.id===alan.id);
      const cozur=_oneriCozumu(sorun,'cikar',i,d,alan.id,0,'');
      const acik=`<span class="kt ${KIDEM_CLS[ast.kidem]}" style="font-size:9px;padding:1px 4px;margin-right:3px">K${ast.kidem}</span>${shortName(ast.name)} ← <span style="color:${alan2?.color}">${alan2?.name}</span> <span style="font-size:9px;color:var(--w4)">${_nobetSayisi(i)}n</span>`;
      html+=oneriSatir('cikar',[i,d,alan.id,0,''],acik,'✕ Kaldır',
        `${btnS};background:rgba(232,87,42,0.1);border:1px solid rgba(232,87,42,0.3);color:var(--red)`,
        cozur,false,'');
    });
  }

  return html || '<div style="padding:12px 14px;font-size:11px;color:var(--w4)">Öneri bulunamadı.</div>';
}
// ─── Öneri paneli toggle ──────────────────────────────────────
function uyariOneriToggle(panelId, sorunJSON){
  const panel=document.getElementById(panelId);
  if(!panel) return;
  if(panel.style.display!=='none'){ panel.style.display='none'; return; }
  panel.style.display='block';
  panel.innerHTML='<div style="padding:10px 14px;font-size:11px;color:var(--w4)">Hesaplanıyor…</div>';
  setTimeout(()=>{
    try{
      const sorun=JSON.parse(decodeURIComponent(sorunJSON));
      panel.innerHTML=uyariOneriHTML(sorun);
    }catch(e){ panel.innerHTML='<div style="padding:10px;color:var(--red)">Hata: '+e.message+'</div>'; }
  },30);
}

// ─── Öneri uygula ────────────────────────────────────────────
function uyariOneriUygula(tip, iA, d, aId, dB, alanB, iB){
  if(tip==='ekle'){
    const _ueEngel=_nobetYazilamaz(iA,d);
    if(_ueEngel){ showToast(_ueEngel); return; }
    S.schedule[gk(iA,d)]=aId;
    save(); renderSchedule(); renderTakStats();
    showToast(ASSISTANTS[iA].name+' eklendi ✓');

  }else if(tip==='transfer'){
    // Transfer: iA dB'den d'ye taşınıyor — d gününü kontrol et (dB silinecek)
    delete S.schedule[gk(iA,dB)];
    const _utEngel=_nobetYazilamaz(iA,d);
    if(_utEngel){ S.schedule[gk(iA,dB)]=alanB||aId; showToast(_utEngel); return; }
    S.schedule[gk(iA,d)]=aId;
    save(); renderSchedule(); renderTakStats();
    showToast(shortName(ASSISTANTS[iA].name)+' '+dB+'→'+d+'. güne taşındı ✓');

  }else if(tip==='takas'){
    const tmpA=aId; const tmpB=alanB;
    delete S.schedule[gk(iA,d)];
    delete S.schedule[gk(iB,dB)];
    const _tk1=_nobetYazilamaz(iA,dB); const _tk2=_nobetYazilamaz(iB,d);
    if(_tk1||_tk2){ S.schedule[gk(iA,d)]=tmpA; S.schedule[gk(iB,dB)]=tmpB; showToast(_tk1||_tk2); return; }
    S.schedule[gk(iA,dB)]=tmpB;
    S.schedule[gk(iB,d)]=tmpA;
    save(); renderSchedule(); renderTakStats();
    showToast(shortName(ASSISTANTS[iA].name)+' ↔ '+shortName(ASSISTANTS[iB].name)+' takas ✓');

  }else if(tip==='cikar'){
    delete S.schedule[gk(iA,d)];
    save(); renderSchedule(); renderTakStats();
    showToast(ASSISTANTS[iA].name+' kaldırıldı');
  }
  // Modal: sorun çözüldüyse kapat, hâlâ varsa öneri listesini yenile
  const modal = document.getElementById('dayModal');
  if(modal && modal.classList.contains('open')){
    const sorun = window._aktifOneriSorun;
    if(sorun){
      let halaVar = false;
      const rule=getDayRule(sorun.gun, sorun.alan.id);
      const atananlar=ASSISTANTS.filter((_,j)=>S.schedule[gk(j,sorun.gun)]===sorun.alan.id);
      const cnt=atananlar.length;

      if(sorun.tip==='min'){
        halaVar = cnt < (rule.min||0);
      } else if(sorun.tip==='kidem'){
        halaVar = kidemKuralIhlali(sorun.gun, sorun.alan.id).length > 0;
      } else if(sorun.tip==='max'){
        halaVar = rule.max>0 && cnt > rule.max;
      }

      if(!halaVar){
        closeDayModal();
      } else {
        // Sorun hâlâ var — öneri listesini güncelle
        const html = uyariOneriHTML(sorun);
        document.getElementById('dmBody').innerHTML =
          '<div style="font-size:10px;color:var(--w3);padding:8px 0 4px">💡 Önerilen çözümler:</div>'+html;
      }
    }
  }
  renderUyarilar();
}

// ══════════════════════════════════════════════════════
// HEDEF EKSİKLERİ PANELİ — autoGen sonrası başasistana sun
// Maxı dolmamış asistanları tespit et, nereye yazılabilir seçenek göster.
// Başasistan seçer, max esnetme olmaz.
// ══════════════════════════════════════════════════════
function _checkHedefEksikleri(){ return; } // Devre dışı — hedef eksikleri Sorunlar sekmesinde gösterilir
function _checkHedefEksikleri_disabled(){
  if(window.ACILX_ROLE !== 'basasistan') return;
  const {y,m} = S.currentDate;
  const days = daysInMonth(y,m);
  const moKey = y+'_'+m;

  const eksikler = ASSISTANTS.map((ast,i) => {
    const ov = S.monthOverride && S.monthOverride[moKey] && S.monthOverride[moKey][i];
    const defH = Math.round(S.maxHours[ast.kidem]/24);
    const hedef = (ov!==undefined && ov!==null) ? ov : defH;
    let mevcut = 0;
    for(let d=1;d<=days;d++) if(S.schedule[gk(i,d)]) mevcut++;
    const fark = hedef - mevcut;
    return {ast, i, hedef, mevcut, eksik: fark};
  }).filter(s => s.eksik > 0 && s.hedef > 0);

  if(eksikler.length === 0) return; // Herkes hedefe ulaştı

  // Her eksik asistan için nereye yazılabilir bul
  // Öncelik: 1) min eksik alanlar, 2) kıdem grubu eksik alanlar, 3) normal alanlar
  const secenekler = [];
  eksikler.forEach(({ast, i, eksik, mevcut, hedef}) => {
    const gunler = [];
    for(let d=1;d<=days;d++){
      if(S.schedule[gk(i,d)]) continue;
      // Art arda kontrolü
      if(d>1 && S.schedule[gk(i,d-1)]) continue;
      if(d<days && S.schedule[gk(i,d+1)]) continue;
      // İzin kontrolü
      const dur = (S.astProfiles&&S.astProfiles[i]&&S.astProfiles[i].durum)||'aktif';
      if(dur==='izinli'||dur==='rot_hayir') continue;
      const izinli = ((S.astProfiles&&S.astProfiles[i]&&S.astProfiles[i].izinliAylik)||{})[moKey]||[];
      if(izinli.includes(d)) continue;
      if(isEgtFull(y,m,d,ast.kidem)) continue;

      AREAS.forEach(a => {
        if(!isAlanAktif(d,a.id)) return;
        if(((S.quota[a.id]||{})[ast.kidem]||0)===0) return;

        const rule = getDayRule(d, a.id);
        const cnt = ASSISTANTS.filter((_,j)=>S.schedule[gk(j,d)]===a.id).length;

        // Max aşılacak mı? → seçenek olarak sun ama işaretle
        const maxAsim = cnt >= (rule.max||99);

        // Öncelik skoru: min eksik > kıdem eksik > normal
        let oncelik = 0;
        if(cnt < (rule.min||0)) oncelik = 100; // min eksik — en yüksek öncelik
        else {
          // Kıdem kuralı ihlali var mı?
          if(kidemKuralIhlali(d,a.id).length>0) oncelik = 50;
        }

        if(!maxAsim || oncelik >= 50) { // max aşılsa bile min/kıdem eksikse göster
          gunler.push({d, aId:a.id, aName:a.name, aColor:a.color, cnt, min:rule.min||0, max:rule.max||99, maxAsim, oncelik});
        }
      });
    }
    // Önceliğe göre sırala
    gunler.sort((a,b) => b.oncelik - a.oncelik || a.d - b.d);
    if(gunler.length > 0){
      secenekler.push({ast, i, eksik, mevcut, hedef, gunler: gunler.slice(0, 12)}); // max 12 seçenek
    }
  });

  if(secenekler.length === 0) return;

  // Modal göster
  _showHedefEksikModal(secenekler);
}

function _showHedefEksikModal(secenekler){
  const AY=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  const {m} = S.currentDate;

  let body = `<div style="font-size:11px;color:var(--w3);margin-bottom:12px;padding:8px 10px;background:rgba(240,160,64,0.08);border:1px solid rgba(240,160,64,0.2);border-radius:6px">
    ⚠️ <b>${secenekler.length} asistanın</b> hedefi dolmadı. Aşağıdan nereye yazılacağını seçebilirsin.<br>
    <span style="font-size:10px;color:var(--w4)">Min eksik alanlar 🔴 ile, kıdem eksik 🟣 ile, max aşımı gerektirenler ⚡ ile işaretli.</span>
  </div>`;

  // Global cache
  window._hedefEksikCache = secenekler;

  secenekler.forEach(({ast, i, eksik, mevcut, hedef, gunler}, sIdx) => {
    body += `<div style="margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span class="kt ${KIDEM_CLS[ast.kidem]}" style="font-size:9px;padding:1px 4px">K${ast.kidem}</span>
        <span style="font-size:11px;font-weight:700;color:var(--w1)">${_esc(ast.name)}</span>
        <span style="font-size:10px;color:var(--orange);font-family:'DM Mono',monospace;margin-left:auto">${mevcut}/${hedef} <span style="font-weight:700">▼${eksik}</span></span>
      </div>
      <div style="display:flex;flex-direction:column;gap:3px">`;

    gunler.forEach((g, gIdx) => {
      const dow = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'][new Date(S.currentDate.y, m, g.d).getDay()];
      const oncelikIcon = g.oncelik >= 100 ? '🔴' : g.oncelik >= 50 ? '🟣' : '';
      const maxIcon = g.maxAsim ? '⚡' : '';
      const doluluk = `${g.cnt}/${g.max}`;

      body += `<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:var(--bg3);border:1px solid var(--bord);border-radius:5px;${g.oncelik>=50?'border-left:2px solid '+(g.oncelik>=100?'var(--red)':'#9B7AE0'):''}">
        <span style="font-size:11px;font-weight:700;color:var(--w1);min-width:44px">${g.d} ${AY[m]}</span>
        <span style="font-size:9px;color:var(--w4);min-width:22px">${dow}</span>
        <div style="width:8px;height:8px;border-radius:2px;background:${g.aColor};flex-shrink:0"></div>
        <span style="font-size:10px;color:var(--w2);flex:1">${g.aName}</span>
        <span style="font-size:9px;color:var(--w4)">${doluluk}</span>
        ${oncelikIcon?`<span style="font-size:10px">${oncelikIcon}</span>`:''}
        ${maxIcon?`<span style="font-size:9px;color:var(--orange)" title="Max aşılacak">${maxIcon}</span>`:''}
        <button onclick="_hedefEksikAta(${sIdx},${gIdx})"
          style="font-size:9px;padding:3px 10px;border-radius:4px;background:rgba(80,180,80,0.12);border:1px solid rgba(80,180,80,0.3);color:#80B840;cursor:pointer;font-weight:700;font-family:var(--font-sans)">Ata</button>
      </div>`;
    });

    body += `</div></div>`;
  });

  body += `<div style="display:flex;gap:8px;margin-top:8px">
    <button onclick="closeDayModal()" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--bord);background:var(--bg3);color:var(--w3);cursor:pointer;font-family:var(--font-sans);font-size:11px">Kapat</button>
  </div>`;

  document.getElementById('dmTitle').innerHTML = '<span style="color:var(--orange)">▼ Hedefi Dolmamış Asistanlar</span>';
  document.getElementById('dmSub').textContent = secenekler.length + ' asistan · Nereye yazılsın?';
  document.getElementById('dmBody').innerHTML = body;
  document.getElementById('dayModal').classList.add('open');
}

function _hedefEksikAta(sIdx, gIdx){
  const cache = window._hedefEksikCache;
  if(!cache || !cache[sIdx]) return;
  const {i, gunler} = cache[sIdx];
  const g = gunler[gIdx];
  if(!g) return;
  const _heEngel=_nobetYazilamaz(i,g.d);
  if(_heEngel){ showToast(_heEngel); return; }

  S.schedule[gk(i, g.d)] = g.aId;
  save();

  // Tüm ekranı güncelle
  renderNewCal(); renderTakStats(); renderUyarilar();
  if(typeof renderAsstList==='function' && _newView===1) renderAsstList();

  showToast(ASSISTANTS[i].name + ' → ' + g.aName + ' (' + g.d + '. gün) ✓');

  // Cache güncelle ve modal yenile
  _checkHedefEksikleri();
}
