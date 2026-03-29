/* ── nobet-algo.js ──────────────────────────────────────────────
   Nöbet oluşturma algoritması, hedef hesaplama, atama kontrolleri
   Bağımlılıklar: nobet-core.js, nobet-rules.js
   ────────────────────────────────────────────────────────────── */

/* ── NÖBET OLUŞTUR / ANALİZ / SİL ── */
async function nobetOlustur(){
  if(window.ACILX_ROLE!=='basasistan') return;
  showSpinner();
  try{ autoGen(); }catch(e){ hideSpinner(); showToast('Oluşturma hatası: '+e.message); return; }
  // ── KRİTİK: listeyi HEMEN kaydet ──────────────────────────────
  try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch(_){}
  if(_db && window.ACILX_ROLE === 'basasistan' && window._assistantsLoaded) {
    window._pendingSave = true;
    try { await _fsSaveNow(); } catch(e) { console.warn('nobetOlustur kayıt:', e); }
    window._pendingSave = false;
  }
  updateTercihUI();
  _checkHedefEksikleri();
  hideSpinner();
  showToast('Nöbet oluşturuldu ve kaydedildi');

  // ── Analiz modalı: render tamamlandıktan sonra göster ──
  setTimeout(_showGenAnaliz, 100);
}

function _showGenAnaliz(){
  const {y,m}=S.currentDate;
  const days=daysInMonth(y,m);

  // ── 1) Alan × Kıdem: hedef vs gerçekleşen matris ──
  // gercekMatris[aId][k] = bu ay bu alana atanan K{k} toplam nöbet-gün sayısı
  const gercekMatris={};
  AREAS.forEach(a=>{
    gercekMatris[a.id]={};
    [1,2,3,4,5].forEach(k=>{ gercekMatris[a.id][k]=0; });
  });
  for(let d=1;d<=days;d++){
    ASSISTANTS.forEach((ast,i)=>{
      const aId=S.schedule[gk(i,d)];
      if(aId&&gercekMatris[aId]) gercekMatris[aId][ast.kidem]++;
    });
  }

  // Eksik ve fazla kombinasyonları topla
  const eksikler=[]; // {alan, aId, kidem, hedef, gercek, eksik}
  const fazlalar=[]; // {alan, aId, kidem, hedef, gercek, fazla}
  AREAS.forEach(a=>{
    [1,2,3,4,5].forEach(k=>{
      const hedef=(S.quota[a.id]||{})[k]||0;
      if(hedef===0) return;
      const gercek=gercekMatris[a.id][k]||0;
      if(gercek<hedef) eksikler.push({alan:a,aId:a.id,kidem:k,hedef,gercek,eksik:hedef-gercek});
      if(gercek>hedef) fazlalar.push({alan:a,aId:a.id,kidem:k,hedef,gercek,fazla:gercek-hedef});
    });
  });

  // Kıdem başına asistan sayısı ve toplam kapasite
  const kidemAstSayi={};
  const kidemKapasite={}; // maxHours/24 × asistan sayısı
  [1,2,3,4,5].forEach(k=>{
    const astlar=ASSISTANTS.filter(ast=>ast.kidem===k);
    kidemAstSayi[k]=astlar.length;
    const maxNobet=Math.round((S.maxHours[k]||168)/24);
    kidemKapasite[k]=astlar.length*maxNobet;
  });

  // İhlal sayısı
  let toplamIhlal=0;
  for(let d=1;d<=days;d++){
    if(ASSISTANTS.some((_,i)=>S.schedule[gk(i,d)])) toplamIhlal+=gunIhlalleri(d).length;
  }

  // Hedef eksik/fazla asistan sayısı
  let hedefSorunSayi=0;
  ASSISTANTS.forEach((_,i)=>{
    const h=_hesaplaHedef(i);
    if(h<=0) return;
    let mev=0; for(let d=1;d<=days;d++) if(S.schedule[gk(i,d)]) mev++;
    if(mev!==h) hedefSorunSayi++;
  });

  if(toplamIhlal===0&&eksikler.length===0&&hedefSorunSayi===0) return;

  // ── 2) Spesifik öneriler üret ──
  const oneriler=[]; // {metin, detay, renk, uygula}

  eksikler.forEach(e=>{
    const k=e.kidem;
    // A) Aynı kıdem başka alanda fazla mı?
    const fazlaKaynak=fazlalar.find(f=>f.kidem===k&&f.aId!==e.aId);
    if(fazlaKaynak){
      const transfer=Math.min(e.eksik,fazlaKaynak.fazla);
      oneriler.push({
        metin:'K'+k+' kotasını '+fazlaKaynak.alan.name+'\'den '+transfer+' azalt, '+e.alan.name+'\'e ekle',
        detay:fazlaKaynak.alan.name+' K'+k+': '+fazlaKaynak.gercek+'/'+fazlaKaynak.hedef+' ('+fazlaKaynak.fazla+' fazla) → '+e.alan.name+' K'+k+': '+e.gercek+'/'+e.hedef+' ('+e.eksik+' eksik)',
        renk:'var(--orange)',
        ikon:'&#8644;',
        uygula:function(){
          if(!S.quota[fazlaKaynak.aId]) S.quota[fazlaKaynak.aId]={};
          if(!S.quota[e.aId]) S.quota[e.aId]={};
          S.quota[fazlaKaynak.aId][k]=Math.max(0,(S.quota[fazlaKaynak.aId][k]||0)-transfer);
          S.quota[e.aId][k]=(S.quota[e.aId][k]||0)+transfer;
        }
      });
      return; // En iyi çözüm bulundu
    }

    // B) O kıdemden yeterli asistan/kapasite var mı?
    // Kıdemin toplam kullanımı vs toplam kapasite
    let toplamKullanim=0;
    AREAS.forEach(a=>{ toplamKullanim+=gercekMatris[a.id][k]||0; });
    const maxNobet=Math.round((S.maxHours[k]||168)/24);
    const toplamHedef=AREAS.reduce((s,a)=>s+((S.quota[a.id]||{})[k]||0),0);

    if(kidemAstSayi[k]===0){
      // Hiç asistan yok — min düşür
      const r=S.defaultDayMin[e.aId];
      const minVal=r&&r.min?r.min:0;
      if(minVal>1){
        oneriler.push({
          metin:e.alan.name+' minimumunu '+(minVal-1)+'\'e düşür (K'+k+' asistanı yok)',
          detay:'K'+k+' kıdeminde 0 asistan var. Mevcut min: '+minVal,
          renk:'var(--red)',
          ikon:'&#9660;',
          uygula:function(){
            if(S.defaultDayMin[e.aId]) S.defaultDayMin[e.aId].min=minVal-1;
          }
        });
      }
      return;
    }

    if(toplamHedef>kidemKapasite[k]){
      // Kapasite yetersiz — hedef toplam kapasitenin üzerinde
      // En düşük öncelikli alandan kotayı düşür
      const enCokKotali=AREAS.filter(a=>((S.quota[a.id]||{})[k]||0)>0&&a.id!==e.aId)
        .sort((a,b)=>((S.quota[b.id]||{})[k]||0)-((S.quota[a.id]||{})[k]||0));
      if(enCokKotali.length>0){
        const kaynak=enCokKotali[0];
        const kaynakKota=(S.quota[kaynak.id]||{})[k]||0;
        const azalt=Math.min(e.eksik,Math.max(1,Math.floor(kaynakKota*0.3)));
        oneriler.push({
          metin:'K'+k+' kapasitesi yetersiz — '+kaynak.name+'\'den '+azalt+' azalt, '+e.alan.name+'\'e ekle',
          detay:'K'+k+': '+kidemAstSayi[k]+' asistan × '+maxNobet+' max = '+kidemKapasite[k]+' kapasite, toplam hedef: '+toplamHedef,
          renk:'var(--red)',
          ikon:'&#9888;',
          uygula:function(){
            if(!S.quota[kaynak.id]) S.quota[kaynak.id]={};
            if(!S.quota[e.aId]) S.quota[e.aId]={};
            S.quota[kaynak.id][k]=Math.max(0,(S.quota[kaynak.id][k]||0)-azalt);
            S.quota[e.aId][k]=(S.quota[e.aId][k]||0)+azalt;
          }
        });
      } else {
        // Başka alan yok — min düşür
        const r=S.defaultDayMin[e.aId];
        const minVal=r&&r.min?r.min:0;
        if(minVal>1){
          oneriler.push({
            metin:'Bu ay K'+k+' kapasitesi yetersiz — '+e.alan.name+' minimumunu '+(minVal-1)+'\'e düşür',
            detay:'K'+k+': '+kidemAstSayi[k]+' asistan × '+maxNobet+' max = '+kidemKapasite[k]+', hedef: '+toplamHedef,
            renk:'var(--red)',
            ikon:'&#9660;',
            uygula:function(){
              if(S.defaultDayMin[e.aId]) S.defaultDayMin[e.aId].min=minVal-1;
            }
          });
        }
      }
      return;
    }

    // C) Kapasite var ama kota yetersiz — basitçe kota artır
    oneriler.push({
      metin:e.alan.name+'\'de K'+k+' kotasını '+e.eksik+' artır',
      detay:'Hedef: '+e.hedef+', Gerçek: '+e.gercek+'. K'+k+' kapasitesi yeterli ('+toplamKullanim+'/'+kidemKapasite[k]+')',
      renk:'#7DC44A',
      ikon:'&#9650;',
      uygula:function(){
        if(!S.quota[e.aId]) S.quota[e.aId]={};
        S.quota[e.aId][k]=(S.quota[e.aId][k]||0)+e.eksik;
      }
    });
  });

  // D) Kıdem kuralı ihlalleri (yalnız tutamaz) — hangi alan/kural?
  const bagIhlalMap={}; // aId → Set of rule indices
  for(let d=1;d<=days;d++){
    gunIhlalleri(d).forEach(ih=>{
      if(ih.tip==='kidem'&&ih.msg&&ih.msg.includes('yalnız')&&ih.alan){
        if(!bagIhlalMap[ih.alan.id]) bagIhlalMap[ih.alan.id]=0;
        bagIhlalMap[ih.alan.id]++;
      }
    });
  }
  Object.keys(bagIhlalMap).forEach(aId=>{
    const alan=AREAS.find(a=>a.id===aId);
    if(!alan) return;
    const sayi=bagIhlalMap[aId];
    const r=S.defaultDayMin[aId];
    if(!r||!r.kidemKurallari) return;
    if(oneriler.some(o=>o.uygula&&o.metin.includes(alan.name)&&o.metin.includes('kota'))) return;
    Object.keys(r.kidemKurallari).forEach(kStr=>{
      const k=parseInt(kStr);
      const kural=r.kidemKurallari[k];
      if(!kural||!kural.yalnizTutamaz) return;
      const tumYaninda=[...new Set(kural.yanindaKidemler||kural.yaninda||[])];
      if(!tumYaninda.length){
        const astSayi=kidemAstSayi[k]||0;
        if(astSayi<2){
          oneriler.push({
            metin:alan.name+'\'de K'+k+' yalnız tutamaz kuralını kaldır (sadece '+astSayi+' K'+k+' asistanı var)',
            detay:sayi+' gün ihlal. K'+k+' yalnız tutulamaz kuralı ama yeterli asistan yok',
            renk:'#9B7AE0',
            ikon:'&#9881;',
            uygula:function(){ if(S.defaultDayMin[aId]&&S.defaultDayMin[aId].kidemKurallari&&S.defaultDayMin[aId].kidemKurallari[k]) S.defaultDayMin[aId].kidemKurallari[k].yalnizTutamaz=false; }
          });
        }
      } else {
        const refKota=tumYaninda.reduce((s,yk)=>s+((S.quota[aId]||{})[yk]||0),0);
        const refAstSayi=tumYaninda.reduce((s,yk)=>s+(kidemAstSayi[yk]||0),0);
        const refLbl='K'+tumYaninda.join('/K');
        if(refAstSayi===0){
          oneriler.push({
            metin:alan.name+'\'de K'+k+' yalnız tutamaz kuralını kaldır ('+refLbl+' asistanı yok)',
            detay:sayi+' gün ihlal. Yanında '+refLbl+' olmalı kuralı ama o kıdemde asistan yok',
            renk:'#9B7AE0',
            ikon:'&#9881;',
            uygula:function(){ if(S.defaultDayMin[aId]&&S.defaultDayMin[aId].kidemKurallari&&S.defaultDayMin[aId].kidemKurallari[k]) S.defaultDayMin[aId].kidemKurallari[k].yalnizTutamaz=false; }
          });
        } else if(refKota===0){
          const ekleme=Math.min(3,Math.ceil(sayi/days*tumYaninda.length));
          oneriler.push({
            metin:alan.name+'\'e '+refLbl+' kotası ekle ('+ekleme+' nöbet)',
            detay:sayi+' gün ihlal. '+refLbl+' asistanı var ('+refAstSayi+') ama bu alana kotası 0',
            renk:'#9B7AE0',
            ikon:'&#9650;',
            uygula:function(){
              tumYaninda.forEach(yk=>{
                if(!S.quota[aId]) S.quota[aId]={};
                S.quota[aId][yk]=(S.quota[aId][yk]||0)+ekleme;
              });
            }
          });
        }
      }
    });
  });

  // E) Min doluluk ihlali — önerisi yoksa min düşür
  const minIhlalSayi={};
  for(let d=1;d<=days;d++){
    gunIhlalleri(d).forEach(ih=>{
      if(ih.tip==='min'&&ih.alan){
        if(!minIhlalSayi[ih.alan.id]) minIhlalSayi[ih.alan.id]=0;
        minIhlalSayi[ih.alan.id]++;
      }
    });
  }
  Object.keys(minIhlalSayi).forEach(aId=>{
    // Zaten bu alan için bir öneri var mı?
    if(oneriler.some(o=>o.uygula&&o.metin.includes(AREAS.find(a=>a.id===aId)?.name||''))) return;
    const alan=AREAS.find(a=>a.id===aId);
    if(!alan) return;
    const sayi=minIhlalSayi[aId];
    const r=S.defaultDayMin[aId];
    const minVal=r&&r.min?r.min:0;
    if(minVal<=1) return;
    // Toplam kota yeterli mi?
    let toplamKota=0;
    [1,2,3,4,5].forEach(k=>{ toplamKota+=((S.quota[aId]||{})[k]||0); });
    let aktifGun=0;
    for(let d=1;d<=days;d++){ if(isAlanAktif(d,aId)) aktifGun++; }
    if(toplamKota<aktifGun*minVal){
      oneriler.push({
        metin:alan.name+' minimumunu '+(minVal-1)+'\'e düşür ('+sayi+' gün ihlal)',
        detay:'Toplam kota: '+toplamKota+', Gereken: '+(aktifGun*minVal)+' ('+aktifGun+' gün × '+minVal+' min)',
        renk:'var(--red)',
        ikon:'&#9660;',
        uygula:function(){
          if(S.defaultDayMin[aId]) S.defaultDayMin[aId].min=minVal-1;
        }
      });
    }
  });

  if(oneriler.length===0&&eksikler.length===0) return;

  // ── Modal HTML ──
  let mhtml='<div id="genAnalizModal" style="position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px)">';
  mhtml+='<div style="background:var(--bg1);border:1px solid var(--bord);border-radius:12px;width:min(560px,92vw);max-height:80vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5)">';

  // Header
  mhtml+='<div style="padding:16px 20px;border-bottom:1px solid var(--bord);display:flex;align-items:center;gap:10px">';
  mhtml+='<div style="width:8px;height:8px;border-radius:50%;background:var(--red)"></div>';
  mhtml+='<div style="flex:1"><div style="font-size:14px;font-weight:800;color:var(--w1)">Nöbet Analizi</div>';
  mhtml+='<div style="font-size:11px;color:var(--w3)">'+toplamIhlal+' kural ihlali'+(eksikler.length>0?' · '+eksikler.length+' eksik kota':'')+' · '+oneriler.length+' öneri</div></div>';
  mhtml+='<button onclick="document.getElementById(\'genAnalizModal\').remove()" style="background:none;border:none;color:var(--w3);font-size:18px;cursor:pointer;padding:4px">&#10005;</button>';
  mhtml+='</div>';

  // Eksik alan × kıdem tablosu
  if(eksikler.length>0){
    mhtml+='<div style="padding:12px 20px;border-bottom:1px solid var(--bord)">';
    mhtml+='<div style="font-size:11px;font-weight:700;color:var(--w2);margin-bottom:8px">Hedef vs Gerçekleşen</div>';
    mhtml+='<table style="width:100%;border-collapse:collapse;font-size:11px">';
    mhtml+='<thead><tr><th style="text-align:left;padding:4px 8px;color:var(--w3);font-weight:600;border-bottom:1px solid var(--bord)">Alan</th><th style="padding:4px;color:var(--w3);font-weight:600;border-bottom:1px solid var(--bord)">Kıdem</th><th style="padding:4px;color:var(--w3);font-weight:600;border-bottom:1px solid var(--bord)">Hedef</th><th style="padding:4px;color:var(--w3);font-weight:600;border-bottom:1px solid var(--bord)">Gerçek</th><th style="padding:4px;color:var(--w3);font-weight:600;border-bottom:1px solid var(--bord)">Fark</th></tr></thead><tbody>';
    eksikler.forEach(e=>{
      mhtml+='<tr><td style="padding:4px 8px;border-bottom:1px solid var(--bord)"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:'+e.alan.color+';margin-right:4px"></span>'+e.alan.name+'</td>';
      mhtml+='<td style="text-align:center;padding:4px;border-bottom:1px solid var(--bord)"><span class="kt '+KIDEM_CLS[e.kidem]+'" style="font-size:9px;padding:1px 4px">K'+e.kidem+'</span></td>';
      mhtml+='<td style="text-align:center;padding:4px;border-bottom:1px solid var(--bord);color:var(--w2)">'+e.hedef+'</td>';
      mhtml+='<td style="text-align:center;padding:4px;border-bottom:1px solid var(--bord);color:var(--w1);font-weight:700">'+e.gercek+'</td>';
      mhtml+='<td style="text-align:center;padding:4px;border-bottom:1px solid var(--bord);color:var(--red);font-weight:700">-'+e.eksik+'</td></tr>';
    });
    mhtml+='</tbody></table></div>';
  }

  // Öneriler — her biri ayrı "Uygula" butonu ile
  if(oneriler.length>0){
    mhtml+='<div style="padding:12px 20px;border-bottom:1px solid var(--bord)">';
    mhtml+='<div style="font-size:11px;font-weight:700;color:var(--w2);margin-bottom:8px">Öneriler</div>';
    window._genAnalizOneriler=oneriler;
    oneriler.forEach((o,idx)=>{
      mhtml+='<div id="gaOneri'+idx+'" style="display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid var(--bord)">';
      mhtml+='<span style="font-size:12px;color:'+o.renk+';flex-shrink:0;margin-top:1px">'+o.ikon+'</span>';
      mhtml+='<div style="flex:1;min-width:0">';
      mhtml+='<div style="font-size:11px;font-weight:600;color:var(--w1)">'+o.metin+'</div>';
      if(o.detay) mhtml+='<div style="font-size:10px;color:var(--w3);margin-top:2px">'+o.detay+'</div>';
      mhtml+='</div>';
      mhtml+='<button onclick="_genAnalizTekUygula('+idx+')" style="flex-shrink:0;font-size:9px;padding:3px 10px;border-radius:4px;background:rgba(80,180,80,0.12);border:1px solid rgba(80,180,80,0.3);color:#7DC44A;cursor:pointer;font-weight:700;font-family:var(--font-sans);white-space:nowrap">Uygula</button>';
      mhtml+='</div>';
    });
    mhtml+='</div>';
  }

  // Footer
  mhtml+='<div style="padding:14px 20px;display:flex;align-items:center;gap:8px;justify-content:flex-end">';
  if(oneriler.length>1){
    mhtml+='<button onclick="_genAnalizTumUygula()" style="padding:7px 16px;border-radius:6px;background:var(--red);border:none;color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:var(--font-sans)">Tümünü Uygula</button>';
  }
  mhtml+='<button onclick="document.getElementById(\'genAnalizModal\').remove()" style="padding:7px 16px;border-radius:6px;background:var(--bg3);border:1px solid var(--bord);color:var(--w2);font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font-sans)">Kapat</button>';
  mhtml+='</div>';
  mhtml+='</div></div>';

  const eski=document.getElementById('genAnalizModal');
  if(eski) eski.remove();
  document.body.insertAdjacentHTML('beforeend',mhtml);
}

function _genAnalizTekUygula(idx){
  const o=window._genAnalizOneriler&&window._genAnalizOneriler[idx];
  if(!o||!o.uygula) return;
  o.uygula();
  save();
  // Satırı "uygulandı" olarak işaretle
  const el=document.getElementById('gaOneri'+idx);
  if(el){
    el.style.opacity='0.4';
    const btn=el.querySelector('button');
    if(btn){ btn.textContent='Tamam'; btn.disabled=true; btn.style.color='var(--w3)'; btn.style.background='var(--bg3)'; btn.style.border='1px solid var(--bord)'; }
  }
  showToast('Ayar güncellendi');
}

function _genAnalizTumUygula(){
  const oneriler=window._genAnalizOneriler;
  if(!oneriler||!oneriler.length) return;
  oneriler.forEach(o=>{ if(typeof o.uygula==='function') o.uygula(); });
  save();
  const m=document.getElementById('genAnalizModal');
  if(m) m.remove();
  showToast('Tüm ayarlar güncellendi — yeniden oluşturuluyor');
  setTimeout(function(){ nobetOlustur(); },200);
}

async function nobetSil(){
  if(!confirm('Bu ayın nöbet listesini silmek istediğinden emin misin?')) return;
  _clearSchedule();
  S.dayOverride = {};
  S.prevMonthLastDay = {};
  S.nextMonthFirstDay = {};
  // localStorage'a da yaz
  try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch(_){}
  // Firestore'a hemen yaz — AWAIT ile
  if(_db && window.ACILX_ROLE === 'basasistan' && window._assistantsLoaded) {
    window._pendingSave = true;
    try { await _fsSaveNow(); } catch(e) {}
    window._pendingSave = false;
  }
  renderNewCal();
  updateTercihUI();
  const uyEl = document.getElementById('uyarilarContent');
  if(uyEl) uyEl.innerHTML = '';
  const uyTab = document.getElementById('tab-uyarilar');
  if(uyTab && uyTab.style.display !== 'none') renderUyarilar();
  showToast('Nöbet listesi silindi');
}

/* ── AUTO GEN v4 — CSP Solver (3-Fazlı: Domain + Backtracking + SA) ── */
function autoGen(){
  const _t0=Date.now();
  const y=S.currentDate.y, mo=S.currentDate.m;
  const days=daysInMonth(y,mo);
  _clearSchedule();

  // ── ALGORİTMA KONFİGÜRASYONU ──
  const CFG = S.algoConfig || {};
  const ART_ARDA_MESAFE  = CFG.artArdaMesafe  || 1;
  const KACINMA_GUCU     = CFG.kacinmaGucu     || 'guclu';
  const TERCIH_CAKISMA   = CFG.tercihCakisma   || 'azTercih';
  const WE_DENGESI       = CFG.weDengesi       || 'toplamEsit';
  const IZIN_HEDEF       = CFG.izinHedef       || 'otoDusManuel';
  const ALAN_ONCELIKLERI = CFG.alanOncelikleri  || null;

  // ── Temel yardımcılar ──
  const _moKey=y+'_'+mo;
  function astDurum(i){ return (S.astProfiles&&S.astProfiles[i]&&S.astProfiles[i].durum)||'aktif'; }
  function astSiftler(i){
    const p=S.astProfiles&&S.astProfiles[i];
    if(p&&p.siftler&&p.siftler.length) return p.siftler;
    return [(p&&p.sift)||'24h'];
  }
  function astTercihGunler(i){ return (S.astProfiles&&S.astProfiles[i]&&S.astProfiles[i].tercihGunler)||[]; }
  function astKacGunler(i){ return (S.astProfiles&&S.astProfiles[i]&&S.astProfiles[i].kacGunler)||[]; }
  function astTercihAylik(i){ const p=S.astProfiles&&S.astProfiles[i]; return (p&&p.tercihAylik&&p.tercihAylik[_moKey])||[]; }
  function astKacAylik(i){ const p=S.astProfiles&&S.astProfiles[i]; return (p&&p.kacAylik&&p.kacAylik[_moKey])||[]; }
  function astIzinliAylik(i){ const p=S.astProfiles&&S.astProfiles[i]; return (p&&p.izinliAylik&&p.izinliAylik[_moKey])||[]; }
  function astToplamTercih(i){ return astTercihAylik(i).length + astTercihGunler(i).length; }

  // Dinamik hedef: izin oranında düşürme + başasistan override
  function hedef(i){
    const ov=S.monthOverride&&S.monthOverride[_moKey]&&S.monthOverride[_moKey][i];
    if(ov!==undefined&&ov!==null) return ov;
    const baseH=Math.round(S.maxHours[ASSISTANTS[i].kidem]/24);
    if(IZIN_HEDEF==='sabit') return baseH;
    const dur=astDurum(i);
    if(dur==='izinli'||dur==='rot_hayir') return 0;
    const izinGunleri=astIzinliAylik(i).length;
    if(izinGunleri>0) return Math.max(0, Math.round(baseH*((days-izinGunleri)/days)));
    return baseH;
  }

  const load=ASSISTANTS.map(()=>({total:0,byArea:{},weCount:0}));
  function kalan(i){ return hedef(i)-load[i].total; }
  function aRem(i,aId){ return ((S.quota[aId]||{})[ASSISTANTS[i].kidem]||0)-(load[i].byArea[aId]||0); }
  function dCnt(d,aId){ return ASSISTANTS.filter((_,j)=>S.schedule[gk(j,d)]===aId).length; }
  function weScore(i){ return load[i].weCount||0; }

  function put(i,d,aId){
    if(kalan(i)<=0) return false;
    const _dur=astDurum(i);
    if(_dur==='izinli'||_dur==='rot_hayir') return false;
    if(astIzinliAylik(i).includes(d)) return false;
    if(!mesafeUygun(i,d)) return false; // ART ARDA 24S HARD BLOCK
    // Alan kotası kontrolü — 0=giremez, N=üst limit
    const kotaLimit = (S.quota[aId]||{})[ASSISTANTS[i].kidem]||0;
    if(kotaLimit <= 0) return false;
    if((load[i].byArea[aId]||0) >= kotaLimit) return false;
    S.schedule[gk(i,d)]=aId;
    load[i].total++;
    load[i].byArea[aId]=(load[i].byArea[aId]||0)+1;
    if(isWE(y,mo,d)) load[i].weCount=(load[i].weCount||0)+1;
    return true;
  }
  function remove(i,d){
    const aId=S.schedule[gk(i,d)]; if(!aId) return;
    delete S.schedule[gk(i,d)];
    load[i].total=Math.max(0,load[i].total-1);
    load[i].byArea[aId]=Math.max(0,(load[i].byArea[aId]||1)-1);
    if(isWE(y,mo,d)) load[i].weCount=Math.max(0,(load[i].weCount||1)-1);
  }

  // Yapılandırılabilir mesafe kontrolü
  function mesafeUygun(i,d){
    for(let delta=1;delta<=ART_ARDA_MESAFE;delta++){
      if(d-delta>=1&&S.schedule[gk(i,d-delta)]) return false;
      if(d+delta<=days&&S.schedule[gk(i,d+delta)]) return false;
    }
    if(d===1&&S.prevMonthLastDay&&S.prevMonthLastDay[i]) return false;
    if(d===days&&S.nextMonthFirstDay&&S.nextMonthFirstDay[i]) return false;
    return true;
  }

  // canAssign — ignoreKacinma: Adım 3'te güçlü kaçınmayı bypass eder
  function canAssign(i,d,aId,ignoreHedef,ignoreKacinma){
    if(!ignoreHedef&&kalan(i)<=0) return false;
    const dur=astDurum(i);
    if(dur==='izinli'||dur==='rot_hayir') return false;
    if(isEgtFull(y,mo,d,ASSISTANTS[i].kidem)) return false;
    if(!isAlanAktif(d,aId)) return false;
    if(S.schedule[gk(i,d)]) return false;
    if(!mesafeUygun(i,d)) return false;
    if(aRem(i,aId)<=0) return false;
    if(astIzinliAylik(i).includes(d)) return false;
    if(!ignoreKacinma){
      if(KACINMA_GUCU==='sert'&&astKacAylik(i).includes(d)) return false;
      if(KACINMA_GUCU==='guclu'&&astKacAylik(i).includes(d)) return false;
    }
    const alanSiftler=(S.defaultDayMin[aId]&&S.defaultDayMin[aId].siftler)||['24h'];
    if(!astSiftler(i).some(s=>alanSiftler.includes(s))) return false;
    return true;
  }

  // Tercih skoru — yapılandırılabilir çakışma çözümü
  function tercihScore(i,d){
    const dw=getDOW(y,mo,d);
    let score=0;
    if(astKacGunler(i).includes(dw)) score+=20;
    if(astTercihGunler(i).includes(dw)) score-=8;
    if(astTercihAylik(i).includes(d)) score-=60;
    if(KACINMA_GUCU==='yumusak'&&astKacAylik(i).includes(d)) score+=100;
    if(TERCIH_CAKISMA==='azTercih'){
      const tp=astToplamTercih(i);
      score-=tp>0?Math.max(0,15-tp*3):0;
    } else if(TERCIH_CAKISMA==='kidemOnce'){
      score-=ASSISTANTS[i].kidem*5;
    } else if(TERCIH_CAKISMA==='adaletli'){
      // Adaletli: daha az nöbet almış olan önce (kalan nöbet sayısı yüksekse öncelik)
      score-=kalan(i)*2;
    } else if(TERCIH_CAKISMA==='karma'){
      // Karma: kıdem + adalet birlikte
      score-=ASSISTANTS[i].kidem*3;
      score-=kalan(i)*1.5;
    }
    return score;
  }

  function enYakinMesafe(idx,d){
    let min=days;
    for(let dd=1;dd<=days;dd++) if(S.schedule[gk(idx,dd)]&&dd!==d) min=Math.min(min,Math.abs(dd-d));
    return min;
  }
  function calcMusait(i,fromDay,aId){
    let c=0;
    for(let dd=fromDay+1;dd<=days;dd++){
      if(!canAssign(i,dd,aId,false)) continue;
      if(dCnt(dd,aId)>=(getDayRule(dd,aId).max||99)) continue;
      c++;
    }
    return c;
  }

  // Alan sırası — yapılandırılabilir
  let BASE_AREA_ORDER;
  if(ALAN_ONCELIKLERI&&ALAN_ONCELIKLERI.length){
    BASE_AREA_ORDER=ALAN_ONCELIKLERI.map(id=>AREAS.find(a=>a.id===id)).filter(Boolean);
    AREAS.forEach(a=>{ if(!BASE_AREA_ORDER.find(x=>x.id===a.id)) BASE_AREA_ORDER.push(a); });
  } else {
    BASE_AREA_ORDER=[...AREAS].sort((a,b)=>{
      const ra=S.defaultDayMin[a.id],rb=S.defaultDayMin[b.id];
      const minA=(ra&&ra.min)||0,minB=(rb&&rb.min)||0;
      const grpA=(ra&&ra.kidemKurallari&&Object.values(ra.kidemKurallari).some(k=>k.yalnizTutamaz))?1:0;
      const grpB=(rb&&rb.kidemKurallari&&Object.values(rb.kidemKurallari).some(k=>k.yalnizTutamaz))?1:0;
      if((minA===0)!==(minB===0)) return minA===0?1:-1;
      if(grpA!==grpB) return grpB-grpA;
      return ASSISTANTS.filter(x=>(S.quota[a.id]||{})[x.kidem]>0).length-ASSISTANTS.filter(x=>(S.quota[b.id]||{})[x.kidem]>0).length;
    });
  }
  const ZORUNLU_ALANLAR=new Set(BASE_AREA_ORDER.filter(a=>(S.defaultDayMin[a.id]&&S.defaultDayMin[a.id].min||0)>0).map(a=>a.id));
  function alanSirasi(i){ const n=BASE_AREA_ORDER.length,offset=i%n; return [...BASE_AREA_ORDER.slice(offset),...BASE_AREA_ORDER.slice(0,offset)]; }

  // Gün d için tüm alanların minimumları karşılandı mı?
  function gunMinlerKarsilandi(d){
    for(const a of BASE_AREA_ORDER){
      if(!isAlanAktif(d,a.id)) continue;
      const rule=getDayRule(d,a.id);
      if((rule.min||0)<=0) continue;
      if(dCnt(d,a.id)<rule.min) return false;
    }
    return true;
  }
  // Gün d, alan aId için min hala eksik mi?
  function alanMinEksik(d,aId){ const rule=getDayRule(d,aId); return dCnt(d,aId)<(rule.min||0); }

  function makeAreaComparator(aId,d,isWEday){
    return function(a,b){
      const kotaA=(S.quota[aId]||{})[ASSISTANTS[a].kidem]||1,kotaB=(S.quota[aId]||{})[ASSISTANTS[b].kidem]||1;
      const dagA=(d/days)-(load[a].byArea[aId]||0)/kotaA,dagB=(d/days)-(load[b].byArea[aId]||0)/kotaB;
      const kalanKotaA=kotaA-(load[a].byArea[aId]||0),kalanKotaB=kotaB-(load[b].byArea[aId]||0);
      const musaitA=calcMusait(a,d,aId),musaitB=calcMusait(b,d,aId);
      const riskA=kalanKotaA>0?(kalanKotaA-musaitA)/Math.max(kalanKotaA,1):0;
      const riskB=kalanKotaB>0?(kalanKotaB-musaitB)/Math.max(kalanKotaB,1):0;
      const mesA=enYakinMesafe(a,d),mesB=enYakinMesafe(b,d);
      const mesScoreA=mesA>=4?0:mesA===3?0.3:mesA===2?0.8:1.5;
      const mesScoreB=mesB>=4?0:mesB===3?0.3:mesB===2?0.8:1.5;
      // Kıdem dağılım bonusu: bu günde aynı kıdemden az olan tercih edilir
      const kdA=ASSISTANTS[a].kidem,kdB=ASSISTANTS[b].kidem;
      const gundeKdA=ASSISTANTS.filter((_,j)=>S.schedule[gk(j,d)]===aId&&ASSISTANTS[j].kidem===kdA).length;
      const gundeKdB=ASSISTANTS.filter((_,j)=>S.schedule[gk(j,d)]===aId&&ASSISTANTS[j].kidem===kdB).length;
      const kdBonusA=gundeKdA===0?0.5:0;
      const kdBonusB=gundeKdB===0?0.5:0;
      const skorA=dagA+riskA*2+mesScoreA+kdBonusA,skorB=dagB+riskB*2+mesScoreB+kdBonusB;
      if(Math.abs(skorA-skorB)>0.01) return skorB-skorA;
      const tA=tercihScore(a,d),tB=tercihScore(b,d);
      if(tA!==tB) return tA-tB;
      if(WE_DENGESI!=='yok'&&isWEday){
        if(WE_DENGESI==='oranEsit'){
          // Oran eşit: WE/toplam oranı düşük olan önce
          const oranA=load[a].total>0?(load[a].weCount||0)/load[a].total:0;
          const oranB=load[b].total>0?(load[b].weCount||0)/load[b].total:0;
          if(Math.abs(oranA-oranB)>0.01) return oranA-oranB;
        } else {
          // toplamEsit: mutlak WE sayısı düşük olan önce
          return weScore(a)-weScore(b);
        }
      }
      return kalan(b)-kalan(a);
    };
  }


  // ═══════════════════════════════════════════════════════════════════════
  // CSP SOLVER v4 — 3 Fazlı: Domain Hesaplama + Greedy+Repair + SA
  // ═══════════════════════════════════════════════════════════════════════
  console.log('[CSP] Başlatılıyor...', ASSISTANTS.length, 'asistan,', AREAS.length, 'alan,', days, 'gün');

  // ── FAZ 0: SLOT ve DOMAIN HAZIRLIĞI ──
  // Her (gün, alan) çifti bir "slot". Her slot'a atanabilecek asistan listesi = domain.
  const N=ASSISTANTS.length;
  const slotList=[]; // [{d, aId, minReq, maxReq}]
  const areaIds=AREAS.map(a=>a.id);

  // Aktif slotları topla
  for(let d=1;d<=days;d++){
    for(const area of BASE_AREA_ORDER){
      const aId=area.id;
      if(!isAlanAktif(d,aId)) continue;
      const rule=getDayRule(d,aId);
      if(!rule.aktif) continue;
      slotList.push({d, aId, minReq:rule.min||0, maxReq:rule.max||99});
    }
  }

  // Her asistanın hard constraint domainini hesapla
  // domain[i] = bu asistanın atanabileceği (d, aId) çiftleri kümesi
  function computeDomain(i){
    const dur=astDurum(i);
    if(dur==='izinli'||dur==='rot_hayir') return [];
    const izinler=astIzinliAylik(i);
    const kidem=ASSISTANTS[i].kidem;
    const siftleri=astSiftler(i);
    const dom=[];
    for(const sl of slotList){
      const {d, aId}=sl;
      if(izinler.includes(d)) continue;
      if(isEgtFull(y,mo,d,kidem)) continue;
      const alanKota=(S.quota[aId]||{})[kidem]||0;
      if(alanKota<=0) continue;
      const alanSiftler=(S.defaultDayMin[aId]&&S.defaultDayMin[aId].siftler)||['24h'];
      if(!siftleri.some(s=>alanSiftler.includes(s))) continue;
      dom.push({d, aId});
    }
    return dom;
  }

  const domains=ASSISTANTS.map((_,i)=>computeDomain(i));
  const hedefler=ASSISTANTS.map((_,i)=>hedef(i));
  const toplamHedef=hedefler.reduce((s,h)=>s+h,0);
  console.log('[CSP] Toplam hedef:', toplamHedef, 'Domain boyutları:', domains.map(d=>d.length).join(','));

  // ── Hızlı lookup tablolar ──
  // astDayAreas[i][d] = bu asistanın gün d'de atanabileceği alanlar
  const astDayAreas=ASSISTANTS.map((_,i)=>{
    const m={};
    for(const {d,aId} of domains[i]){
      if(!m[d]) m[d]=[];
      m[d].push(aId);
    }
    return m;
  });

  // ═══════════════════════════════════════════════════════════════════════
  // FAZ 1: GREEDY CONSTRUCTIVE HEURISTIC + ITERATIVE REPAIR
  // ═══════════════════════════════════════════════════════════════════════
  // Saf backtracking NP-hard olan bu problemi 2-3 saniyede çözemez.
  // Yerine: akıllı greedy yerleştirme + constraint violation repair döngüsü.

  // ── Adım 1a: Her asistanın nöbetlerini aya yay ──
  // İlk geçiş: min gereksinimleri karşıla, kıdem dengesini koru
  // İkinci geçiş: kalan hedefleri doldur

  // Schedule'a atama yap (load güncellemeyle)
  // ART ARDA 24S HARD BLOCK — mesafe kontrolü assign seviyesinde zorunlu
  function assign(i,d,aId){
    if(S.schedule[gk(i,d)]) return false;
    if(!mesafeUygun(i,d)) return false;
    const dur=astDurum(i);
    if(dur==='izinli'||dur==='rot_hayir') return false;
    if(astIzinliAylik(i).includes(d)) return false;
    S.schedule[gk(i,d)]=aId;
    load[i].total++;
    load[i].byArea[aId]=(load[i].byArea[aId]||0)+1;
    if(isWE(y,mo,d)) load[i].weCount=(load[i].weCount||0)+1;
    return true;
  }
  function unassign(i,d){
    const aId=S.schedule[gk(i,d)]; if(!aId) return null;
    delete S.schedule[gk(i,d)];
    load[i].total=Math.max(0,load[i].total-1);
    load[i].byArea[aId]=Math.max(0,(load[i].byArea[aId]||1)-1);
    if(isWE(y,mo,d)) load[i].weCount=Math.max(0,(load[i].weCount||1)-1);
    return aId;
  }

  // Hard constraint kontrolü — bir atama yapılabilir mi?
  function canPlace(i,d,aId,ignoreHedef,ignoreMesafe,ignoreKacinma){
    if(!ignoreHedef && load[i].total>=hedefler[i]) return false;
    if(S.schedule[gk(i,d)]) return false;
    const kidem=ASSISTANTS[i].kidem;
    const alanKota=(S.quota[aId]||{})[kidem]||0;
    if(alanKota<=0) return false; // Kota 0 → bu kıdem bu alana giremez
    if((load[i].byArea[aId]||0)>=alanKota) return false; // Kota dolu → üst limit aşılamaz
    // Günlük max
    const _cpRule=getDayRule(d,aId);
    if(dCnt(d,aId)>=(_cpRule.max||99)) return false;
    // Kıdem bazlı günlük max
    const _kMax=(_cpRule.kidemMax||{})[kidem]||0;
    if(_kMax>0){
      const _kCnt=ASSISTANTS.filter((_,j)=>S.schedule[gk(j,d)]===aId&&ASSISTANTS[j].kidem===kidem).length;
      if(_kCnt>=_kMax) return false;
    }
    // Kıdem grubu max kontrolü
    const _gRules=(S.defaultDayMin[aId]&&S.defaultDayMin[aId].kidemGrupKurallari)||[];
    for(const _g of _gRules){
      const _gMax=_g.enFazlaKac||0;
      if(_gMax<=0) continue;
      if(!(_g.kidemler||[]).includes(kidem)) continue;
      let _gCnt=0;
      for(const _gk of (_g.kidemler||[])) _gCnt+=ASSISTANTS.filter((_,j)=>S.schedule[gk(j,d)]===aId&&ASSISTANTS[j].kidem===_gk).length;
      if(_gCnt>=_gMax) return false;
    }
    // Art arda mesafe — ASLA bypass edilemez (ignoreMesafe parametresi yok sayılır)
    for(let delta=1;delta<=ART_ARDA_MESAFE;delta++){
      if(d-delta>=1&&S.schedule[gk(i,d-delta)]) return false;
      if(d+delta<=days&&S.schedule[gk(i,d+delta)]) return false;
    }
    if(d===1&&S.prevMonthLastDay&&S.prevMonthLastDay[i]) return false;
    if(d===days&&S.nextMonthFirstDay&&S.nextMonthFirstDay[i]) return false;
    // Kaçınma
    if(!ignoreKacinma){
      if(KACINMA_GUCU==='sert'&&astKacAylik(i).includes(d)) return false;
      if(KACINMA_GUCU==='guclu'&&astKacAylik(i).includes(d)) return false;
    }
    return true;
  }

  // ── Gün skorlama: bir asistanı gün d, alan aId'ye atamanın ne kadar iyi olduğu ──
  function dayScore(i,d,aId){
    let sc=0;
    const kidem=ASSISTANTS[i].kidem;
    // ── Kota hedef bonusu — alan×kıdem kotasına yakınlık ──
    const kotaLimit=(S.quota[aId]||{})[kidem]||0;
    const mevcutAlan=load[i].byArea[aId]||0;
    if(kotaLimit>0){
      const kotaKalan=kotaLimit-mevcutAlan;
      if(kotaKalan>0) sc+=300+kotaKalan*40; // Kota dolmamış → güçlü bonus
      else sc-=2000; // Kota dolu → yerleştirme
    } else {
      sc-=5000; // Kota 0 → bu alana giremez
    }
    // Min eksik gün bonusu — min karşılanmamış günlere öncelik
    const rule=getDayRule(d,aId);
    const cnt=dCnt(d,aId);
    if(cnt<(rule.min||0)) sc+=500;
    // kidemMin bonusu — bu gün/alan'da bu kıdemden minimum gerekiyorsa ve henüz yeterli yoksa
    const kMinObj=rule.kidemMin||{};
    const kMaxObj=rule.kidemMax||{};
    const kMinReq=kMinObj[kidem]||0;
    const kMaxReq=kMaxObj[kidem]||0;
    const gundeKidemSayi=ASSISTANTS.filter((_,j)=>S.schedule[gk(j,d)]===aId&&ASSISTANTS[j].kidem===kidem).length;
    if(kMinReq>0 && gundeKidemSayi<kMinReq) sc+=600;
    // kidemMax cezası — bu kıdemden max dolmuşsa yerleştirme
    if(kMaxReq>0 && gundeKidemSayi>=kMaxReq) sc-=3000;
    // Cross-area kıdem cezası — aynı gün TÜM alanlarda aynı kıdemden çok kişi varsa
    const gunToplamKidem=ASSISTANTS.filter((_,j)=>S.schedule[gk(j,d)]&&ASSISTANTS[j].kidem===kidem).length;
    if(gunToplamKidem>=3) sc-=gunToplamKidem*40;
    // Kıdem çeşitlilik bonusu — bu günde bu kıdem yoksa tercih et
    const gundeKidem=ASSISTANTS.filter((_,j)=>S.schedule[gk(j,d)]===aId&&ASSISTANTS[j].kidem===kidem).length;
    if(gundeKidem===0) sc+=200;
    else sc-=gundeKidem*80;
    // Kıdem grubu min/max bonusu
    const _dsGRules=(S.defaultDayMin[aId]&&S.defaultDayMin[aId].kidemGrupKurallari)||[];
    for(const _dg of _dsGRules){
      if(!(_dg.kidemler||[]).includes(kidem)) continue;
      let _dgCnt=0;
      for(const _dgk of (_dg.kidemler||[])) _dgCnt+=ASSISTANTS.filter((_,j)=>S.schedule[gk(j,d)]===aId&&ASSISTANTS[j].kidem===_dgk).length;
      const _dgMin=_dg.enAzKac||0;
      const _dgMax=_dg.enFazlaKac||0;
      if(_dgMin>0 && _dgCnt<_dgMin) sc+=400; // Grup min eksik → bonus
      if(_dgMax>0 && _dgCnt>=_dgMax) sc-=3000; // Grup max doldu → güçlü ceza
    }
    // Doluluk — az dolu günleri tercih et
    sc-=cnt*15;
    // İdeal aralık — nöbetleri aya eşit yay
    const myDays=[];
    for(let dd=1;dd<=days;dd++) if(S.schedule[gk(i,dd)]) myDays.push(dd);
    if(myDays.length>0){
      const minDist=Math.min(...myDays.map(dd=>Math.abs(dd-d)));
      if(minDist<=ART_ARDA_MESAFE) sc-=2000;
      else if(minDist===ART_ARDA_MESAFE+1) sc-=50;
      else sc+=minDist*3;
    }
    // Tercih/kaçınma
    sc+=tercihScore(i,d)*(-3);
    // Hafta sonu dengesi
    if(isWE(y,mo,d)){
      const idealWe=Math.round(hedefler[i]*(7/days));
      sc-=Math.abs((load[i].weCount||0)-idealWe)*20;
    }
    return sc;
  }

  // ── Ana yerleştirme stratejisi ──
  // Günleri ve alanları min gereksinimine göre sırala,
  // en kısıtlı slotları önce doldur (MRV prensibi)

  // Geçiş 1: Her gün için min gereksinimleri karşıla
  for(let pass=0;pass<3;pass++){
    // Her geçişte daha gevşek kurallarla dene
    const ignoreMesafe=false; // Art arda 24s ASLA bypass edilemez
    const ignoreKacinma=pass>=1;

    // Slot ihtiyaçlarını hesapla
    const needs=[];
    for(const sl of slotList){
      const {d,aId,minReq}=sl;
      const cnt=dCnt(d,aId);
      const eksik=minReq-cnt;
      if(eksik<=0) continue;
      // Bu slot'a atanabilecek aday sayısı (MRV)
      const adaylar=[];
      for(let i=0;i<N;i++){
        if(hedefler[i]<=0) continue;
        if(!astDayAreas[i][d]||!astDayAreas[i][d].includes(aId)) continue;
        if(canPlace(i,d,aId,false,ignoreMesafe,ignoreKacinma)) adaylar.push(i);
      }
      needs.push({d,aId,eksik,adayCount:adaylar.length,adaylar});
    }
    // MRV sırası: en az aday olan slotu önce doldur
    needs.sort((a,b)=>a.adayCount-b.adayCount||b.eksik-a.eksik);

    for(const need of needs){
      const {d,aId,adaylar}=need;
      const rule=getDayRule(d,aId);
      let eksik=(rule.min||0)-dCnt(d,aId);
      if(eksik<=0) continue;
      // Adayları skorla
      const scored=adaylar
        .filter(i=>canPlace(i,d,aId,false,ignoreMesafe,ignoreKacinma))
        .map(i=>({i,sc:dayScore(i,d,aId)}))
        .sort((a,b)=>b.sc-a.sc);
      for(const {i} of scored){
        if(eksik<=0) break;
        if(dCnt(d,aId)>=(rule.max||99)) break;
        if(canPlace(i,d,aId,false,ignoreMesafe,ignoreKacinma)){
          assign(i,d,aId);
          eksik--;
        }
      }
    }
  }

  console.log('[CSP] Min doldurma sonrası:', Object.keys(S.schedule).length, 'atama');

  // Geçiş 1b: kidemMin doldurma — her (gün,alan) için kıdem seviyesi minimum karşılansın
  for(let pass=0;pass<3;pass++){
    const ignoreMesafe=false; // Art arda 24s ASLA bypass edilemez
    const ignoreKacinma=pass>=1;
    for(const sl of slotList){
      const {d,aId}=sl;
      const rule=getDayRule(d,aId);
      if(!rule.aktif) continue;
      const kMinObj=rule.kidemMin||{};
      for(const kk of Object.keys(kMinObj)){
        const kMinReq=kMinObj[kk]||0;
        if(kMinReq<=0) continue;
        const kidemNum=Number(kk);
        const mevcutK=ASSISTANTS.filter((_,j)=>S.schedule[gk(j,d)]===aId&&ASSISTANTS[j].kidem===kidemNum).length;
        let eksikK=kMinReq-mevcutK;
        if(eksikK<=0) continue;
        // Bu kıdemden aday bul
        const adaylar=[];
        for(let i=0;i<N;i++){
          if(hedefler[i]<=0) continue;
          if(ASSISTANTS[i].kidem!==kidemNum) continue;
          if(!astDayAreas[i][d]||!astDayAreas[i][d].includes(aId)) continue;
          if(canPlace(i,d,aId,false,ignoreMesafe,ignoreKacinma)) adaylar.push(i);
        }
        adaylar.sort((a,b)=>dayScore(b,d,aId)-dayScore(a,d,aId));
        for(const i of adaylar){
          if(eksikK<=0) break;
          if(dCnt(d,aId)>=(rule.max||99)) break;
          if(canPlace(i,d,aId,false,ignoreMesafe,ignoreKacinma)){
            assign(i,d,aId);
            eksikK--;
          }
        }
      }
    }
  }
  console.log('[CSP] kidemMin doldurma sonrası:', Object.keys(S.schedule).length, 'atama');

  // Geçiş 2: Kalan hedefleri doldur — her asistanı en uygun günlere yerleştir
  // Asistanları kalan hedeflerine göre sırala (çok ihtiyacı olan önce)
  const astOrder=ASSISTANTS.map((_,i)=>i)
    .filter(i=>hedefler[i]>0)
    .sort((a,b)=>{
      // Kalanı oransal olarak en çok olan önce
      const kalanA=hedefler[a]-load[a].total;
      const kalanB=hedefler[b]-load[b].total;
      const oranA=kalanA/Math.max(hedefler[a],1);
      const oranB=kalanB/Math.max(hedefler[b],1);
      return oranB-oranA;
    });

  for(let pass=0;pass<3;pass++){
    const ignoreMesafe=false; // Art arda 24s ASLA bypass edilemez
    const ignoreKacinma=pass>=1;
    const ignoreHedef=pass>=2;

    for(const i of astOrder){
      const kalan_i=hedefler[i]-load[i].total;
      if(kalan_i<=0) continue;

      // Bu asistanın atanabileceği tüm (gün,alan) çiftlerini skorla
      const options=[];
      for(const {d,aId} of domains[i]){
        if(!canPlace(i,d,aId,ignoreHedef,ignoreMesafe,ignoreKacinma)) continue;
        options.push({d,aId,sc:dayScore(i,d,aId)});
      }
      options.sort((a,b)=>b.sc-a.sc);

      let placed=0;
      for(const opt of options){
        if(placed>=kalan_i) break;
        if(!canPlace(i,opt.d,opt.aId,ignoreHedef,ignoreMesafe,ignoreKacinma)) continue;
        assign(i,opt.d,opt.aId);
        placed++;
      }
    }
  }

  console.log('[CSP] Hedef doldurma sonrası:', Object.keys(S.schedule).length, 'atama');

  // ═══════════════════════════════════════════════════════════════════════
  // FAZ 2: ITERATIVE REPAIR — İhlalleri düzelt
  // ═══════════════════════════════════════════════════════════════════════
  // Geçerli çözümü tara, ihlalleri bul, swap/move ile düzelt.
  // Max 50.000 iterasyon.

  function countViolations(){
    let v=0;
    for(let d=1;d<=days;d++){
      for(const area of AREAS){
        const aId=area.id;
        if(!isAlanAktif(d,aId)) continue;
        const rule=getDayRule(d,aId);
        if(!rule.aktif) continue;
        const cnt=dCnt(d,aId);
        // Min ihlali
        if(cnt<(rule.min||0)){
          // Eğitim bloğu — tüm asistanlar eğitimdeyse ihlal sayma
          if(!ASSISTANTS.every(ast=>isEgtFull(y,mo,d,ast.kidem)))
            v+=(rule.min||0)-cnt;
        }
        // Max ihlali
        if((rule.max||99)<99 && cnt>(rule.max)) v+=cnt-(rule.max);
        // Kıdem kuralı ihlali
        if(cnt>0) v+=kidemKuralIhlali(d,aId).length;
        // kidemMin ihlali
        const kMinObj=rule.kidemMin||{};
        for(const kk of Object.keys(kMinObj)){
          const kMinReq=kMinObj[kk]||0;
          if(kMinReq<=0) continue;
          const kCnt=ASSISTANTS.filter((_,j)=>S.schedule[gk(j,d)]===aId&&ASSISTANTS[j].kidem===Number(kk)).length;
          if(kCnt<kMinReq) v+=(kMinReq-kCnt);
        }
        // kidemMax ihlali
        const kMaxObj=rule.kidemMax||{};
        for(const kk of Object.keys(kMaxObj)){
          const kMaxReq=kMaxObj[kk]||0;
          if(kMaxReq<=0) continue;
          const kCnt=ASSISTANTS.filter((_,j)=>S.schedule[gk(j,d)]===aId&&ASSISTANTS[j].kidem===Number(kk)).length;
          if(kCnt>kMaxReq) v+=(kCnt-kMaxReq);
        }
      }
    }
    // Hedef ihlali
    for(let i=0;i<N;i++){
      const diff=Math.abs(load[i].total-hedefler[i]);
      if(diff>0) v+=diff;
    }
    // Alan kota ihlali — hem aşım hem eksik (kota = hedef + üst limit)
    for(let i=0;i<N;i++){
      if(hedefler[i]<=0) continue;
      for(const aId of areaIds){
        const limit=(S.quota[aId]||{})[ASSISTANTS[i].kidem]||0;
        const mevcut=load[i].byArea[aId]||0;
        if(limit>0 && mevcut>limit) v+=(mevcut-limit)*2; // Aşım — ağır ihlal
        if(limit>0 && mevcut<limit) v+=(limit-mevcut);   // Eksik — kota hedefine ulaşılamamış
      }
    }
    return v;
  }

  let violations=countViolations();
  console.log('[CSP] İlk ihlal sayısı:', violations);

  const REPAIR_LIMIT=50000;
  let repairIter=0;

  while(violations>0 && repairIter<REPAIR_LIMIT){
    let improved=false;

    // Strateji 1: Hedefi eksik olan asistanlara nöbet ekle
    for(let i=0;i<N&&repairIter<REPAIR_LIMIT;i++){
      repairIter++;
      const eksik=hedefler[i]-load[i].total;
      if(eksik<=0) continue;
      // En iyi boş slotu bul
      let bestD=null,bestA=null,bestSc=-Infinity;
      for(const {d,aId} of domains[i]){
        if(S.schedule[gk(i,d)]) continue;
        const kidem=ASSISTANTS[i].kidem;
        const alanKota=(S.quota[aId]||{})[kidem]||0;
        if(alanKota<=0) continue;
        if((load[i].byArea[aId]||0)>=alanKota) continue;
        if(dCnt(d,aId)>=(getDayRule(d,aId).max||99)) continue;
        // Mesafe kontrolü — HARD BLOCK, esnek değil
        if(!mesafeUygun(i,d)) continue;
        const sc=dayScore(i,d,aId);
        if(sc>bestSc){bestSc=sc;bestD=d;bestA=aId;}
      }
      if(bestD!==null){
        assign(i,bestD,bestA);
        improved=true;
      }
    }

    // Strateji 2: Min eksik slotlara kişi ekle (hedef aşımını kabul et)
    for(let d=1;d<=days&&repairIter<REPAIR_LIMIT;d++){
      for(const area of AREAS){
        repairIter++;
        const aId=area.id;
        if(!isAlanAktif(d,aId)) continue;
        const rule=getDayRule(d,aId);
        const cnt=dCnt(d,aId);
        const eksik=(rule.min||0)-cnt;
        if(eksik<=0) continue;
        // Aday bul
        for(let i=0;i<N&&eksik>dCnt(d,aId)-(rule.min||0);i++){
          if(S.schedule[gk(i,d)]) continue;
          if(!astDayAreas[i][d]||!astDayAreas[i][d].includes(aId)) continue;
          const kidem=ASSISTANTS[i].kidem;
          const alanKota=(S.quota[aId]||{})[kidem]||0;
          if(alanKota>0 && (load[i].byArea[aId]||0)>=alanKota) continue;
          // Mesafe HARD BLOCK — art arda 24s kesinlikle yasak
          if(!mesafeUygun(i,d)) continue;
          if(assign(i,d,aId)) improved=true;
        }
      }
    }

    // Strateji 3: Kıdem kuralı ihlallerini düzelt (yalnız tutamaz + kıdem grupları)
    for(let d=1;d<=days&&repairIter<REPAIR_LIMIT;d++){
      for(const area of AREAS){
        const aId=area.id;
        if(!isAlanAktif(d,aId)) continue;
        if(dCnt(d,aId)===0) continue;
        const ih=kidemKuralIhlali(d,aId);
        if(!ih.length) continue;
        repairIter++;
        for(const viol of ih){
          // Gerekli kıdemleri belirle
          let gerekli=[];
          if(viol.tip==='yalniz'){
            gerekli=viol.yanindaKidemler&&viol.yanindaKidemler.length
              ? viol.yanindaKidemler : [viol.kidem];
          } else if(viol.tip==='grup'){
            gerekli=viol.kidemler||[];
          }
          const maxD=getDayRule(d,aId).max||99;
          if(dCnt(d,aId)>=maxD) continue;
          for(let i=0;i<N;i++){
            if(S.schedule[gk(i,d)]) continue;
            if(!mesafeUygun(i,d)) continue; // ART ARDA HARD BLOCK
            if(!gerekli.includes(ASSISTANTS[i].kidem)) continue;
            if(!astDayAreas[i][d]||!astDayAreas[i][d].includes(aId)) continue;
            const kidem=ASSISTANTS[i].kidem;
            const alanKota=(S.quota[aId]||{})[kidem]||0;
            if(alanKota>0 && (load[i].byArea[aId]||0)>=alanKota) continue;
            if(assign(i,d,aId)){ improved=true; break; }
          }
        }
      }
    }

    // Strateji 4: Hedefi aşan asistanlardan nöbet kaldır
    for(let i=0;i<N&&repairIter<REPAIR_LIMIT;i++){
      repairIter++;
      const fazla=load[i].total-hedefler[i];
      if(fazla<=0) continue;
      // En az zararlı nöbeti kaldır
      const myShifts=[];
      for(let d=1;d<=days;d++){
        const aId=S.schedule[gk(i,d)];
        if(!aId) continue;
        const rule=getDayRule(d,aId);
        const cnt=dCnt(d,aId);
        // Maliyet: min bozulursa yüksek, kota dolmamışsa düşük
        const kotaLimit=(S.quota[aId]||{})[ASSISTANTS[i].kidem]||0;
        const mevcutAlan=load[i].byArea[aId]||0;
        const kotaCost=kotaLimit>0&&mevcutAlan<=kotaLimit?500:0;
        const cost=(cnt<=(rule.min||0)?1000:0)+kotaCost;
        myShifts.push({d,aId,cost});
      }
      myShifts.sort((a,b)=>a.cost-b.cost);
      let removed=0;
      for(const sh of myShifts){
        if(removed>=fazla) break;
        unassign(i,sh.d);
        removed++;
        improved=true;
      }
    }

    // Strateji 5: Kota hedefi eksik — alan×kıdem kotasına ulaşılamamış asistanlara nöbet ekle
    for(let i=0;i<N&&repairIter<REPAIR_LIMIT;i++){
      if(hedefler[i]<=0) continue;
      for(const aId of areaIds){
        repairIter++;
        const kotaLimit=(S.quota[aId]||{})[ASSISTANTS[i].kidem]||0;
        if(kotaLimit<=0) continue;
        const mevcut=load[i].byArea[aId]||0;
        const eksik=kotaLimit-mevcut;
        if(eksik<=0) continue;
        // Bu asistanı bu alana yerleştirebileceğimiz en iyi günleri bul
        let placed=0;
        for(let d=1;d<=days&&placed<eksik;d++){
          if(S.schedule[gk(i,d)]) continue;
          if(!isAlanAktif(d,aId)) continue;
          if(dCnt(d,aId)>=(getDayRule(d,aId).max||99)) continue;
          // Mesafe kontrolü (esnek)
          let mesafeOk=true;
          for(let delta=1;delta<=ART_ARDA_MESAFE;delta++){
            if(d-delta>=1&&S.schedule[gk(i,d-delta)]){mesafeOk=false;break;}
            if(d+delta<=days&&S.schedule[gk(i,d+delta)]){mesafeOk=false;break;}
          }
          if(!mesafeOk) continue;
          if(astIzinliAylik(i).includes(d)) continue;
          if(isEgtFull(y,mo,d,ASSISTANTS[i].kidem)) continue;
          assign(i,d,aId);
          placed++;
          improved=true;
        }
      }
    }

    // Strateji 6: kidemMin ihlalleri — her (gün,alan) için kıdem minimum eksiklerini gider
    for(let d=1;d<=days&&repairIter<REPAIR_LIMIT;d++){
      for(const area of AREAS){
        const aId=area.id;
        if(!isAlanAktif(d,aId)) continue;
        const rule=getDayRule(d,aId);
        if(!rule.aktif) continue;
        const kMinObj=rule.kidemMin||{};
        for(const kk of Object.keys(kMinObj)){
          repairIter++;
          const kMinReq=kMinObj[kk]||0;
          if(kMinReq<=0) continue;
          const kidemNum=Number(kk);
          const kCnt=ASSISTANTS.filter((_,j)=>S.schedule[gk(j,d)]===aId&&ASSISTANTS[j].kidem===kidemNum).length;
          if(kCnt>=kMinReq) continue;
          const eksik=kMinReq-kCnt;
          const maxSlot=(rule.max||99);
          const cnt=dCnt(d,aId);
          if(cnt<maxSlot){
            // Max dolmamış — doğrudan ekle
            for(let i=0;i<N&&(kMinReq-ASSISTANTS.filter((_,j)=>S.schedule[gk(j,d)]===aId&&ASSISTANTS[j].kidem===kidemNum).length)>0;i++){
              if(hedefler[i]<=0) continue;
              if(ASSISTANTS[i].kidem!==kidemNum) continue;
              if(S.schedule[gk(i,d)]) continue;
              if(astIzinliAylik(i).includes(d)) continue;
              if(isEgtFull(y,mo,d,ASSISTANTS[i].kidem)) continue;
              assign(i,d,aId);
              improved=true;
            }
          } else {
            // Max dolu — gerekli olmayan kıdemden biriyle swap
            const atananlar=ASSISTANTS.map((_,j)=>j).filter(j=>S.schedule[gk(j,d)]===aId);
            const swapAday=atananlar.find(j=>{
              const jKidem=ASSISTANTS[j].kidem;
              if(jKidem===kidemNum) return false;
              // Bu kıdemin minimum'u yoksa veya fazlası varsa swap edilebilir
              const jKMin=kMinObj[jKidem]||0;
              const jKCnt=ASSISTANTS.filter((_,jj)=>S.schedule[gk(jj,d)]===aId&&ASSISTANTS[jj].kidem===jKidem).length;
              return jKCnt>jKMin;
            });
            if(swapAday!==undefined){
              // Gerekli kıdemden aday bul
              for(let i=0;i<N;i++){
                if(hedefler[i]<=0||ASSISTANTS[i].kidem!==kidemNum) continue;
                if(S.schedule[gk(i,d)]) continue;
                if(astIzinliAylik(i).includes(d)) continue;
                if(isEgtFull(y,mo,d,ASSISTANTS[i].kidem)) continue;
                unassign(swapAday,d);
                assign(i,d,aId);
                improved=true;
                break;
              }
            }
          }
        }
      }
    }

    const newV=countViolations();
    if(newV>=violations&&!improved) break; // İyileşme yok — çık
    violations=newV;
  }

  console.log('[CSP] Repair sonrası:', violations, 'ihlal,', repairIter, 'iterasyon');

  // ═══════════════════════════════════════════════════════════════════════
  // FAZ 3: SIMULATED ANNEALING — Soft constraint optimizasyonu
  // ═══════════════════════════════════════════════════════════════════════

  function softScore(){
    let score=0;
    for(let i=0;i<N;i++){
      if(hedefler[i]<=0) continue;
      // WE dengesi sapması
      const idealWe=Math.round(hedefler[i]*(7/days))||0;
      score-=Math.abs((load[i].weCount||0)-idealWe)*50;
      // Tercih/kaçınma
      for(let d=1;d<=days;d++){
        if(!S.schedule[gk(i,d)]) continue;
        if(astTercihAylik(i).includes(d)) score+=30;
        if(astTercihGunler(i).includes(getDOW(y,mo,d))) score+=10;
        if(astKacAylik(i).includes(d)){
          score-=(KACINMA_GUCU==='guclu'?80:KACINMA_GUCU==='sert'?120:40);
        }
        if(astKacGunler(i).includes(getDOW(y,mo,d))) score-=20;
      }
      // Nöbet aralığı dengesi
      const myDays=[];
      for(let d=1;d<=days;d++) if(S.schedule[gk(i,d)]) myDays.push(d);
      if(myDays.length>=2){
        const gaps=[];
        for(let j=1;j<myDays.length;j++) gaps.push(myDays[j]-myDays[j-1]);
        const avg=gaps.reduce((s,g)=>s+g,0)/gaps.length;
        const dev=Math.sqrt(gaps.reduce((s,g)=>s+(g-avg)*(g-avg),0)/gaps.length);
        score-=dev*20;
      }
      // Alan×kıdem kota sapması — kotaya yakınlık ödüllendirmesi
      for(const aId of areaIds){
        const kotaLimit=(S.quota[aId]||{})[ASSISTANTS[i].kidem]||0;
        if(kotaLimit<=0) continue;
        const mevcut=load[i].byArea[aId]||0;
        const sapma=Math.abs(mevcut-kotaLimit);
        score-=sapma*80; // Her 1 sapma = -80 puan
      }
    }
    // Kıdem karışımı
    for(let d=1;d<=days;d++){
      for(const area of AREAS){
        const aId=area.id;
        const atananlar=ASSISTANTS.filter((_,j)=>S.schedule[gk(j,d)]===aId);
        if(atananlar.length<=1) continue;
        const kidemSayi={};
        atananlar.forEach(a=>{kidemSayi[a.kidem]=(kidemSayi[a.kidem]||0)+1;});
        Object.values(kidemSayi).forEach(c=>{if(c>1)score-=(c-1)*50;});
        // kidemMin soft cezası — eksik her kişi için -200
        const rule=getDayRule(d,aId);
        const kMinObj=rule.kidemMin||{};
        const kMaxObj=rule.kidemMax||{};
        for(const kk of Object.keys(kMinObj)){
          const kMinReq=kMinObj[kk]||0;
          if(kMinReq<=0) continue;
          const kCnt=atananlar.filter(a=>a.kidem===Number(kk)).length;
          if(kCnt<kMinReq) score-=(kMinReq-kCnt)*200;
        }
        for(const kk of Object.keys(kMaxObj)){
          const kMaxReq=kMaxObj[kk]||0;
          if(kMaxReq<=0) continue;
          const kCnt=atananlar.filter(a=>a.kidem===Number(kk)).length;
          if(kCnt>kMaxReq) score-=(kCnt-kMaxReq)*300;
        }
      }
    }
    return score;
  }

  let currentScore=softScore();
  const SA_ITER=5000;
  let temp=100;
  const coolingRate=0.98;
  let saImproved=0;

  for(let iter=0;iter<SA_ITER;iter++){
    // Rastgele iki asistanın aynı gündeki nöbetlerini swap et
    const d=1+Math.floor(Math.random()*days);
    // Bu günde atanan asistanları topla
    const assigned=[];
    for(let i=0;i<N;i++){
      if(S.schedule[gk(i,d)]) assigned.push(i);
    }
    if(assigned.length<2){ temp*=coolingRate; continue; }

    const iA=assigned[Math.floor(Math.random()*assigned.length)];
    let iB=assigned[Math.floor(Math.random()*assigned.length)];
    if(iA===iB){ temp*=coolingRate; continue; }

    const aIdA=S.schedule[gk(iA,d)];
    const aIdB=S.schedule[gk(iB,d)];
    if(aIdA===aIdB){ temp*=coolingRate; continue; }

    // Swap yap
    unassign(iA,d);
    unassign(iB,d);
    const okA=assign(iA,d,aIdB);
    const okB=assign(iB,d,aIdA);

    if(!okA||!okB){
      // Geri al
      if(okA) unassign(iA,d);
      if(okB) unassign(iB,d);
      assign(iA,d,aIdA);
      assign(iB,d,aIdB);
      temp*=coolingRate;
      continue;
    }

    // Hard constraint kontrolü
    const newV=countViolations();
    if(newV>violations){
      // Hard constraint bozuldu — geri al
      unassign(iA,d); unassign(iB,d);
      assign(iA,d,aIdA); assign(iB,d,aIdB);
      temp*=coolingRate;
      continue;
    }

    const newScore=softScore();
    const delta=newScore-currentScore;

    if(delta>=0 || Math.random()<Math.exp(delta/Math.max(temp,0.1))){
      // Kabul et
      currentScore=newScore;
      violations=newV;
      if(delta>0) saImproved++;
    } else {
      // Reddet — geri al
      unassign(iA,d); unassign(iB,d);
      assign(iA,d,aIdA); assign(iB,d,aIdB);
    }
    temp*=coolingRate;
  }

  console.log('[CSP] SA sonrası: soft score=', currentScore, ', iyileşme=', saImproved, '/', SA_ITER);

  // ═══════════════════════════════════════════════════════════════════════
  // FAZ SON: HEDEF SINIRI — kesin clamp
  // ═══════════════════════════════════════════════════════════════════════
  // Hedefi aşan asistanlardan en az zararlı nöbetleri kaldır (kota hedefini koru)
  ASSISTANTS.forEach((_,i)=>{
    const fazla=load[i].total-hedefler[i];
    if(fazla<=0) return;
    const atamalar=[];
    for(let d=1;d<=days;d++){
      const aId=S.schedule[gk(i,d)];
      if(!aId) continue;
      const rule=getDayRule(d,aId);
      const cnt=dCnt(d,aId);
      // Kota hedefi koruması: kotaya tam uyan nöbetleri kaldırmaktan kaçın
      const kotaLimit=(S.quota[aId]||{})[ASSISTANTS[i].kidem]||0;
      const mevcutAlan=load[i].byArea[aId]||0;
      const kotaCost=kotaLimit>0&&mevcutAlan<=kotaLimit?500:0; // Kota dolmamışsa kaldırma
      const cost=(cnt<=(rule.min||0)?1000:cnt<=((rule.min||0)+1)?100:0)+kotaCost;
      atamalar.push({d,cost});
    }
    atamalar.sort((a,b)=>a.cost-b.cost);
    let kaldirilan=0;
    for(const at of atamalar){
      if(kaldirilan>=fazla) break;
      unassign(i,at.d);
      kaldirilan++;
    }
  });

  console.log('[CSP] Tamamlandı:', Date.now()-_t0, 'ms,', Object.keys(S.schedule).length, 'atama, son ihlal:', countViolations());

  // ── LOG ──
  const uyarilar=[];
  AREAS.forEach(a=>{const aId=a.id,defMin=S.defaultDayMin[aId];if(!defMin||(defMin.min||0)===0)return;const minVal=defMin.min||0;let aktifGun=0;for(let d=1;d<=days;d++){if(!isAlanAktif(d,aId))continue;if(ASSISTANTS.every(ast=>isEgtFull(y,mo,d,ast.kidem)))continue;aktifGun++;}const gereken=aktifGun*minVal;const toplamKota=ASSISTANTS.reduce((s,ast)=>s+((S.quota[aId]||{})[ast.kidem]||0),0);if(toplamKota<gereken)uyarilar.push({tip:'kota_yetersiz',alan:a.name,toplamKota,gereken,eksik:gereken-toplamKota,aktifGun,minVal});});
  // Doldurulamamış slot tespiti — müsait asistan bulunamayan günler
  for(let d=1;d<=days;d++){
    for(const area of AREAS){
      const aId=area.id;
      if(!isAlanAktif(d,aId)) continue;
      const rule=getDayRule(d,aId);
      if(!rule.aktif) continue;
      const cnt=dCnt(d,aId);
      const eksik=(rule.min||0)-cnt;
      if(eksik>0){
        uyarilar.push({tip:'slot_bos',alan:area.name,gun:d,eksik,mesaj:'Doldurulamamadı — müsait asistan yok (art arda/izin kısıtı)'});
      }
    }
  }
  const hedefEksikler=[],hedefFazlalar=[];
  ASSISTANTS.forEach((_,i)=>{const h=hedef(i);if(load[i].total<h)hedefEksikler.push({ast:ASSISTANTS[i].name,eksik:h-load[i].total});if(load[i].total>h)hedefFazlalar.push({ast:ASSISTANTS[i].name,fazla:load[i].total-h});});
  window._lastGenLog={uyarilar,hedefEksikler,hedefFazlalar};
  try{localStorage.setItem(typeof LS_KEY!=='undefined'?LS_KEY:'acilx_state',JSON.stringify(S));}catch(_){}
  renderSchedule({uyarilar,hedefEksikler,hedefFazlalar});
}

/* ── HEDEF HESAPLAMA / MAX KONTROL / CAN ASSIGN ── */
// ── GLOBAL canAssign ──
// autoGen içindeki local canAssign ile birebir aynı mantık.
// ── MAX NÖBET KONTROLÜ — global yardımcı ──
// Asistanın mevcut nöbet sayısı hedefine ulaşmış mı?
// İzin günleri dikkate alınarak hesaplanır.
// ── Merkezi hedef hesaplama — IZIN_HEDEF ayarını dikkate alır ──
// Tüm hedef hesaplamaları bu fonksiyonu kullanmalı
function _hesaplaHedef(astIdx){
  const {y,m}=S.currentDate;
  const days=daysInMonth(y,m);
  const moKey=y+'_'+m;
  // Manuel override her zaman öncelikli
  const ov=S.monthOverride&&S.monthOverride[moKey]&&S.monthOverride[moKey][astIdx];
  if(ov!==undefined&&ov!==null) return ov;
  if(!ASSISTANTS[astIdx]) return 0;
  const baseH=Math.round(S.maxHours[ASSISTANTS[astIdx].kidem]/24);
  const izinHedef=(S.algoConfig&&S.algoConfig.izinHedef)||'otoDusManuel';
  // "sabit" modda izin düşürmesi yapılmaz
  if(izinHedef==='sabit') return baseH;
  const prof=S.astProfiles&&S.astProfiles[astIdx]?S.astProfiles[astIdx]:{};
  const dur=prof.durum||'aktif';
  if(dur==='izinli'||dur==='rot_hayir') return 0;
  const izinG=((prof.izinliAylik&&prof.izinliAylik[moKey])||[]).length;
  if(izinG>0) return Math.max(0,Math.round(baseH*((days-izinG)/days)));
  return baseH;
}

function _maxNobetAsildimi(astIdx){
  if(!ASSISTANTS[astIdx]) return true;
  const hedef=_hesaplaHedef(astIdx);
  if(hedef<=0){
    const prof=S.astProfiles&&S.astProfiles[astIdx]?S.astProfiles[astIdx]:{};
    const dur=prof.durum||'aktif';
    if(dur==='izinli'||dur==='rot_hayir') return true;
  }
  const {y,m}=S.currentDate;
  const days=daysInMonth(y,m);
  let mevcut=0;
  for(let d=1;d<=days;d++) if(S.schedule[gk(astIdx,d)]) mevcut++;
  return mevcut>=hedef;
}

// Öneri motoru, uyarı çözümleme, manuel atama kontrolleri buradan yararlanır.
function canAssign(i, d, aId, ignoreHedef) {
  const {y,m} = S.currentDate;
  const days = daysInMonth(y, m);
  const moKey = y + '_' + m;

  function _dur(idx) { return (S.astProfiles&&S.astProfiles[idx]&&S.astProfiles[idx].durum)||'aktif'; }
  function _siftler(idx) {
    const p=S.astProfiles&&S.astProfiles[idx];
    if(p&&p.siftler&&p.siftler.length) return p.siftler;
    return [(p&&p.sift)||'24h'];
  }
  function _izinliAylik(idx) {
    const p=S.astProfiles&&S.astProfiles[idx];
    return (p&&p.izinliAylik&&p.izinliAylik[moKey])||[];
  }
  function _kacAylik(idx) {
    const p=S.astProfiles&&S.astProfiles[idx];
    return (p&&p.kacAylik&&p.kacAylik[moKey])||[];
  }
  function _hedef(idx) {
    return _hesaplaHedef(idx);
  }
  function _kalan(idx) {
    let tot=0;
    for(let dd=1;dd<=days;dd++) if(S.schedule[gk(idx,dd)]) tot++;
    return _hedef(idx)-tot;
  }
  function _aRem(idx, aId2) {
    const kotaMax=(S.quota[aId2]||{})[ASSISTANTS[idx].kidem]||0;
    let used=0;
    for(let dd=1;dd<=days;dd++) if(S.schedule[gk(idx,dd)]===aId2) used++;
    return kotaMax-used;
  }

  if(!ignoreHedef && _kalan(i)<=0) return false;
  // ── İZİNLİ HARD BLOCK: hiçbir koşulda bu güne yazma ──
  const dur = _dur(i);
  if(dur==='izinli'||dur==='rot_hayir') return false;
  if(_izinliAylik(i).includes(d)) return false;
  // ─────────────────────────────────────────────────────
  if(isEgtFull(y,m,d,ASSISTANTS[i].kidem)) return false;
  if(!isAlanAktif(d,aId)) return false;
  if(S.schedule[gk(i,d)]) return false;
  if(d>1&&S.schedule[gk(i,d-1)]) return false;
  if(d<days&&S.schedule[gk(i,d+1)]) return false;
  if(d===1&&S.prevMonthLastDay&&S.prevMonthLastDay[i]) return false;
  if(d===days&&S.nextMonthFirstDay&&S.nextMonthFirstDay[i]) return false;
  if(_aRem(i,aId)<=0) return false;
  if(_kacAylik(i).includes(d)) return false;
  const alanSiftler=(S.defaultDayMin[aId]&&S.defaultDayMin[aId].siftler)||['24h'];
  if(!_siftler(i).some(s=>alanSiftler.includes(s))) return false;
  return true;
}

/* ── Merkezi nöbet yazma engeli: izin + art arda 24s kontrolü ──
   Tüm yazma fonksiyonları bu fonksiyonu çağırmalı.
   Döndürdüğü string hata mesajıdır; null = yazılabilir. */
function _nobetYazilamaz(astIdx, d){
  const {y,m}=S.currentDate;
  const days=daysInMonth(y,m);
  const moKey=y+'_'+m;
  const prof=(S.astProfiles&&S.astProfiles[astIdx])||{};
  const dur=prof.durum||'aktif';
  // İzinli kontrolü
  if(dur==='izinli'||dur==='rot_hayir') return 'Bu asistan izinli — nöbet yazılamaz';
  const izinArr=((prof.izinliAylik)||{})[moKey]||[];
  if(izinArr.includes(d)) return d+'. gün izinli — nöbet yazılamaz';
  // Art arda 24s kontrolü
  if(d>1&&S.schedule[gk(astIdx,d-1)]) return 'Art arda 24s nöbet yazılamaz (önceki gün nöbetli)';
  if(d<days&&S.schedule[gk(astIdx,d+1)]) return 'Art arda 24s nöbet yazılamaz (sonraki gün nöbetli)';
  if(d===1&&S.prevMonthLastDay&&S.prevMonthLastDay[astIdx]) return 'Art arda 24s nöbet yazılamaz (önceki ayın son günü nöbetli)';
  if(d===days&&S.nextMonthFirstDay&&S.nextMonthFirstDay[astIdx]) return 'Art arda 24s nöbet yazılamaz (sonraki ayın ilk günü nöbetli)';
  return null;
}
