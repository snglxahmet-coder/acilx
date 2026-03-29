/* ═══════════════════════════════════════════════════════════════
   nobet-ui.js — Kullanıcı Arayüzü
   Takvim grid render, gün detay, dağılım, özet, asistan profil,
   tab geçişleri, tercih ekranları, ay değişimi, YZ fonksiyonları
   ═══════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════
   YENİ TAKVİM SİSTEMİ
══════════════════════════════════════════ */
let _newView = 0; // 0=takvim, 1=asistan, 2=alan

function setNewView(v){
  _newView = v;
  document.getElementById('newCalView').style.display  = v===0?'':'none';
  document.getElementById('newAsstView').style.display = v===1?'':'none';
  document.getElementById('newAreaView').style.display = v===2?'':'none';
  document.getElementById('dayDetailPanel').style.display = 'none';
  [0,1,2].forEach(i=>{
    const btn = document.getElementById('vBtn'+i);
    if(btn){
      btn.style.background = i===v?'var(--red)':'var(--bg3)';
      btn.style.color      = i===v?'#fff':'var(--w3)';
    }
  });
  if(v===1) renderAsstList();
  if(v===2) renderAreaList();
}

// Eski setView — geriye dönük uyumluluk
function setView(v){ setNewView(v==='area'?2:v==='asst'?1:0); }

function renderNewCal(){
  if(!document.getElementById('tab-takvim')) return;
  // Giriş yapan kullanıcının asistan index'ini bul
  const myAstIdx = window._myAstIdx !== undefined ? window._myAstIdx : -1;
  const {y,m} = S.currentDate;
  const days   = daysInMonth(y,m);
  const firstDow = new Date(y,m,1).getDay();
  const offset   = firstDow===0?6:firstDow-1;
  const grid = document.getElementById('newCalGrid');
  if(!grid) return;

  let html = '';
  // Boş hücreler
  for(let i=0;i<offset;i++) html += '<div></div>';

  for(let d=1;d<=days;d++){
    const dow   = new Date(y,m,d).getDay();
    const isWE  = dow===0||dow===6;

    // Sorunlu gün — tip bazlı (min=kırmızı, max=turuncu, kidem=mor)
    let violType = null; // null | 'min' | 'max' | 'kidem'
    AREAS.forEach(a=>{
      const rule = getDayRule(d, a.id);
      if(!rule.aktif) return;
      // Eğitim bloke tümü
      const allBlocked = ASSISTANTS.every(ast => isEgtFull(y,m,d,ast.kidem));
      if(allBlocked) return;
      const girebilir = ASSISTANTS.some(ast => !isEgtFull(y,m,d,ast.kidem) && ((S.quota[a.id]||{})[ast.kidem]||0)>0);
      const cnt = ASSISTANTS.filter((_,i)=>S.schedule[gk(i,d)]===a.id).length;
      if(cnt < rule.min && girebilir){ if(violType===null) violType='min'; }
      if(rule.max>0 && cnt > rule.max){ if(violType===null||violType==='kidem') violType='max'; }
      // Kıdem kuralı — yalnız tutamaz
      if(cnt>0 && kidemKuralIhlali(d,a.id).length>0){
        if(violType===null) violType='kidem';
      }
      // Kıdem min/max ihlali
      if(cnt>0){
        const kMinObj=rule.kidemMin||{};
        const kMaxObj=rule.kidemMax||{};
        const atananlar=ASSISTANTS.filter((_,i)=>S.schedule[gk(i,d)]===a.id);
        for(const kk of Object.keys(kMinObj)){
          if((kMinObj[kk]||0)>0 && atananlar.filter(x=>x.kidem===Number(kk)).length<kMinObj[kk]){
            if(violType===null) violType='kidem'; break;
          }
        }
        for(const kk of Object.keys(kMaxObj)){
          if((kMaxObj[kk]||0)>0 && atananlar.filter(x=>x.kidem===Number(kk)).length>kMaxObj[kk]){
            if(violType===null) violType='max'; break;
          }
        }
      }
    });

    // Viol renkleri
    const VCOL  = {min:'rgba(232,87,42,0.85)',max:'rgba(240,160,64,0.85)',kidem:'rgba(155,122,224,0.85)'};
    const VBORD = {min:'rgba(232,87,42,0.35)',max:'rgba(240,160,64,0.35)',kidem:'rgba(155,122,224,0.35)'};
    const VBG   = {min:'rgba(232,87,42,0.06)',max:'rgba(240,160,64,0.06)',kidem:'rgba(155,122,224,0.06)'};

    // O günde nöbetçiler
    const nob = AREAS.map(a=>{
      const cnt = ASSISTANTS.filter((_,i)=>S.schedule[gk(i,d)]===a.id).length;
      return cnt>0?{a,cnt}:null;
    }).filter(Boolean);
    const total = ASSISTANTS.filter((_,i)=>S.schedule[gk(i,d)]).length;
    // Kullanıcının kendi nöbeti bu günde var mı?
    const myAlanId = myAstIdx > -1 ? S.schedule[gk(myAstIdx, d)] : null;
    const myAlan = myAlanId ? AREAS.find(a=>a.id===myAlanId) : null;
    const isMyDay = !!myAlan;

    const borderColor = isMyDay ? myAlan.color : violType ? VBORD[violType] : 'var(--bord)';
    const bgColor     = isMyDay ? 'rgba(232,87,42,0.12)' : violType ? VBG[violType] : isWE ? 'rgba(255,255,255,0.02)' : 'var(--bg2)';
    const dayColor    = isMyDay ? 'var(--w1)' : violType ? VCOL[violType] : isWE ? 'var(--w4)' : 'var(--w2)';

    html += `<div data-gun="${d}" onclick="openDayDetail(${d})" style="
      background:${bgColor};
      border:1px solid ${borderColor};
      border-radius:6px;padding:4px;cursor:pointer;min-height:52px;
      transition:border-color .1s,outline .3s;position:relative;
      ${isMyDay?'box-shadow:0 0 0 1px '+myAlan.color+'33;':''}
    " onmouseover="this.style.borderColor='rgba(232,87,42,0.5)'" onmouseout="this.style.borderColor='${borderColor}'">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">
        <span style="font-size:10px;font-weight:${isMyDay?'800':'700'};color:${dayColor}">${d}</span>
        ${isMyDay?`<span style="font-size:8px;font-weight:700;padding:1px 4px;border-radius:3px;background:${myAlan.color};color:#fff">${getAreaLabel(myAlan.id)}</span>`:(total>0?`<span style="font-size:8px;font-weight:700;color:var(--w3)">${total}</span>`:'')}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:1px">
        ${nob.slice(0,4).map(n=>`<div style="width:${Math.min(n.cnt*4+4,14)}px;height:4px;border-radius:2px;background:${n.a.color};opacity:${isMyDay&&n.a.id===myAlanId?1:.6}"></div>`).join('')}
      </div>
      ${violType&&!isMyDay?`<div style="position:absolute;bottom:2px;right:3px;font-size:8px;color:${VCOL[violType]}">!</div>`:''}
      ${isMyDay?'<div style="position:absolute;bottom:2px;left:3px;font-size:8px;color:var(--w3)">Ben</div>':''}
    </div>`;
  }
  grid.innerHTML = html;
  renderTakStats();
  // Renk legend'ı sadece ihlal varsa göster
  const {toplamIhlal} = hesaplaUyarilar();
  const legendEl = document.getElementById('calLegend');
  if(legendEl) legendEl.style.display = toplamIhlal>0 ? 'flex' : 'none';
  if(typeof updateTercihUI==='function') setTimeout(updateTercihUI,0);
}

// Viol hesabını merkezi yap — hem stat hem uyarılar kullanır
// Gün bazlı ihlal detaylarını döndürür — renderSorunlar ile aynı mantık

function sapmaCacheTikla(idx){
  const c = window._sapmaCache && window._sapmaCache[idx];
  if(!c) return;
  openSapmaOneriModal(c.astIdx, c.fark, c.alanSayim, c.alanHedef);
}

function renderTakStats(){
  window._sapmaCache = []; // Her render'da cache sıfırla
  if(!document.getElementById('takStats')) return;
  const {y,m} = S.currentDate;
  const days = daysInMonth(y,m);
  const {sorunluGun, toplamIhlal} = hesaplaUyarilar();

  let kusursuz=0, bosGun=0;
  for(let d=1;d<=days;d++){
    const toplamAtanan=ASSISTANTS.filter((_,i)=>S.schedule[gk(i,d)]).length;
    if(toplamAtanan===0){ bosGun++; continue; }
    const hepsiBloke=ASSISTANTS.every(ast=>isEgtFull(y,m,d,ast.kidem));
    if(hepsiBloke) continue;
    // gunIhlalleri ile tutarlı hesaplama — tüm ihlal tipleri tek merkezden
    const gunViols=gunIhlalleri(d);
    if(gunViols.length===0) kusursuz++;
  }

  const el=document.getElementById('takStats');
  if(!el) return;
  el.innerHTML=`
    <div style="background:var(--bg2);border:1px solid var(--bord);border-radius:7px;padding:6px 10px;flex:1;min-width:70px">
      <div style="font-size:8px;color:var(--w3);text-transform:uppercase;letter-spacing:.4px;font-weight:600;margin-bottom:2px">Kusursuz Gün</div>
      <div style="font-size:20px;font-weight:800;color:${kusursuz>0?'#7DC44A':'var(--w1)'};font-family:'DM Mono',monospace">${kusursuz}</div>
    </div>
    <div style="background:${toplamIhlal>0?'rgba(232,87,42,0.08)':'var(--bg2)'};border:1px solid ${toplamIhlal>0?'rgba(232,87,42,0.25)':'var(--bord)'};border-radius:7px;padding:6px 10px;flex:1;min-width:70px;${toplamIhlal>0?'cursor:pointer':''}" ${toplamIhlal>0?'onclick="openUyarilarGun(null)"':''}>
      <div style="font-size:8px;color:var(--w3);text-transform:uppercase;letter-spacing:.4px;font-weight:600;margin-bottom:2px">Kural İhlali${toplamIhlal>0?' ↗':''}</div>
      <div style="font-size:20px;font-weight:800;color:${toplamIhlal>0?'var(--red)':'var(--w1)'};font-family:'DM Mono',monospace">${toplamIhlal}</div>
    </div>
    <div style="background:var(--bg2);border:1px solid var(--bord);border-radius:7px;padding:6px 10px;flex:1;min-width:70px">
      <div style="font-size:8px;color:var(--w3);text-transform:uppercase;letter-spacing:.4px;font-weight:600;margin-bottom:2px">Boş Gün</div>
      <div style="font-size:20px;font-weight:800;color:${bosGun>0?'var(--orange)':'var(--w1)'};font-family:'DM Mono',monospace">${bosGun}</div>
    </div>`;

}

function openDayDetail(d){
  const {y,m} = S.currentDate;
  const panel = document.getElementById('dayDetailPanel');
  const title = document.getElementById('ddTitle');
  const body  = document.getElementById('ddBody');
  if(!panel||!title||!body) return;
  // Panel her zaman görünür — view değişmeden açık kalmalı
  panel.style.display = '';

  const dow = new Date(y,m,d).getDay();
  const DAYS_FULL = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
  title.textContent = d+' '+MONTHS[m]+' '+y+' · '+DAYS_FULL[dow];
  const myAstIdx = window._myAstIdx !== undefined ? window._myAstIdx : -1;

  let html = '';

  // ── Uyarılar: gunIhlalleri ile tutarlı hesaplama ──
  const isBasasistan = window.ACILX_ROLE === 'basasistan';
  const _ddSorunlar = gunIhlalleri(d);
  window._ddSorunlarCache = _ddSorunlar;

  if(_ddSorunlar.length){
    const RENK_MAP={min:'var(--red)',max:'var(--orange)',kidem:'#9B7AE0'};
    const LBL_MAP={min:'Min',max:'Max',kidem:'Kıdem'};
    html += `<div style="background:rgba(232,87,42,0.07);border:1px solid rgba(232,87,42,0.2);border-radius:8px;overflow:hidden;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid rgba(232,87,42,0.15)">
        <span style="font-size:11px;font-weight:700;color:var(--red);flex:1">Bu günde ${_ddSorunlar.length} kural ihlali var</span>
      </div>
      ${_ddSorunlar.map((s,si)=>{
        const tipCol=RENK_MAP[s.tip]||'var(--red)';
        const tipLbl=LBL_MAP[s.tip]||s.tip;
        return `<div
          onclick="${isBasasistan ? 'ddSorunTikla('+si+')' : ''}"
          style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid rgba(232,87,42,0.08);transition:background .12s;" class="${isBasasistan?'uyari-sorun-satir':''}">
          <span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;background:${tipCol}22;color:${tipCol};flex-shrink:0">${tipLbl}</span>
          <span style="font-size:11px;color:var(--w2);flex:1">${s.msg}</span>
          ${isBasasistan?'<span style="font-size:10px;color:var(--w4)">&#128161;</span>':''}
        </div>`;
      }).join('')}
    </div>`;
  }

  // Alan bazlı nöbetçiler — isimler tıklanabilir (başasistan ise swap açar)
  html += '<div style="display:flex;flex-direction:column;gap:8px">';
  AREAS.forEach(a=>{
    const list = ASSISTANTS.filter((_,i)=>S.schedule[gk(i,d)]===a.id);
    const rule = getDayRule(d,a.id);
    if(!rule.aktif && list.length===0) return;
    html += `<div style="background:var(--bg3);border-radius:7px;padding:8px 10px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:6px">
          <div class="adot" style="background:${a.color}"></div>
          <span style="font-size:11px;font-weight:700;color:var(--w1)">${a.name}</span>
        </div>
        <span style="font-size:10px;color:${list.length<rule.min&&rule.min>0?'var(--red)':'var(--w3)'}">${list.length}/${rule.min} min</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">
        ${list.length?list.map(ast=>{
          const astI = ASSISTANTS.indexOf(ast);
          const isMe = astI===myAstIdx;
          return `<div style="display:flex;align-items:center;gap:4px;background:${isMe?'rgba(232,87,42,0.12)':'var(--bg4)'};border:1px solid ${isMe?'rgba(232,87,42,0.4)':'var(--bord)'};border-radius:5px;padding:3px 8px;">
            <span class="kt ${KIDEM_CLS[ast.kidem]}" style="font-size:9px;padding:1px 3px">K${ast.kidem}</span>
            <span style="font-size:11px;font-weight:600;color:${isMe?'var(--w1)':'var(--w2)'};${isBasasistan?'cursor:pointer;text-decoration:underline;text-underline-offset:2px;':''}" 
              ${isBasasistan?`onclick="openSwapModal(${astI},${d},'${a.id}')" title="Değişim yap"`:''}>${shortName(ast.name)}</span>
            ${isBasasistan?`<span style="font-size:10px;color:var(--w4);cursor:pointer" onclick="removeAssign(${astI},${d},'${a.id}')" title="Kaldır">✕</span>`:''}
            ${isMe?'<span style="font-size:8px;color:var(--acc)">●</span>':''}
          </div>`;
        }).join(''):`<span style="font-size:10px;color:var(--w4)">Nöbetçi yok</span>`}
      </div>
      ${isBasasistan ? `
      <div style="margin-top:7px;border-top:1px solid var(--bord);padding-top:6px">
        <select onchange="quickAssignWarn(this,${d},'${a.id}')" style="width:100%;padding:5px 8px;border:1px solid var(--bord);border-radius:5px;font-size:11px;background:var(--bg2);color:var(--w1);font-family:var(--font-sans)">
          <option value="">+ Nöbetçi ekle...</option>
          ${(()=>{
            const {y:qy,m:qm}=S.currentDate;
            const qDays=daysInMonth(qy,qm);
            const qRule=getDayRule(d,a.id);
            const alanCnt=ASSISTANTS.filter((_,xi)=>S.schedule[gk(xi,d)]===a.id).length;
            const alanMaxDolu=qRule.max>0&&alanCnt>=qRule.max;
            const uygunlar=[];
            const uyarililar=[];
            ASSISTANTS.forEach((ast,ai)=>{
              if(S.schedule[gk(ai,d)]) return; // zaten atanmış — gösterme
              const warns=[];
              // Durum kontrol
              const _qDur=(S.astProfiles&&S.astProfiles[ai]&&S.astProfiles[ai].durum)||'aktif';
              if(_qDur==='izinli'||_qDur==='rot_hayir'){ warns.push('\\u26D4 İzinli'); }
              const _qMoKey=qy+'_'+qm;
              const _qIzin=((S.astProfiles&&S.astProfiles[ai]&&S.astProfiles[ai].izinliAylik)||{})[_qMoKey]||[];
              if(_qIzin.includes(d)){ if(!warns.length) warns.push('\\u26D4 İzinli'); }
              // Art arda
              if(d>1&&S.schedule[gk(ai,d-1)]) warns.push('\\u26D4 Art arda');
              if(d<qDays&&S.schedule[gk(ai,d+1)]) warns.push('\\u26D4 Art arda');
              if(d===1&&S.prevMonthLastDay&&S.prevMonthLastDay[ai]) warns.push('\\u26D4 Art arda');
              if(d===qDays&&S.nextMonthFirstDay&&S.nextMonthFirstDay[ai]) warns.push('\\u26D4 Art arda');
              // Eğitim
              if(isEgtFull(qy,qm,d,ast.kidem)) warns.push('\\u26D4 Eğitim');
              // Kota
              const q=(S.quota[a.id]||{})[ast.kidem]||0;
              if(q===0){ warns.push('\\u26D4 Kota yok'); }
              else{
                let alanKul=0;
                for(let dd=1;dd<=qDays;dd++) if(S.schedule[gk(ai,dd)]===a.id) alanKul++;
                if(alanKul>=q) warns.push('\\u26A0\\uFE0F Kota dolu');
              }
              // Alan günlük max
              if(alanMaxDolu) warns.push('\\u26A0\\uFE0F Alan dolu');
              // Kıdem ihlali simülasyonu
              if(!warns.some(w=>w.includes('\\u26D4'))){
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
                      if(bul<eAK) warns.push('\\u26A0\\uFE0F Kıdem ihlali');
                    } else {
                      if(simKidemler.filter(x=>x===k).length<2) warns.push('\\u26A0\\uFE0F Kıdem ihlali');
                    }
                  }
                }
              }
              const label=ast.name+' (K'+ast.kidem+')';
              const warnTxt=warns.length?' — '+warns.join(', '):'';
              const entry={ai, label:label+warnTxt, hasWarn:warns.length>0, hasHard:warns.some(w=>w.includes('\\u26D4'))};
              if(warns.length) uyarililar.push(entry); else uygunlar.push(entry);
            });
            const all=[...uygunlar,...uyarililar];
            let sep=false;
            return all.map(e=>{
              let pre='';
              if(!sep&&e.hasWarn){sep=true;pre='<option disabled>──── Uyarılı ────</option>';}
              return pre+'<option value="'+e.ai+'"'+(e.hasHard?' style="color:#888"':e.hasWarn?' style="color:#b08020"':'')+'>'+e.label+'</option>';
            }).join('');
          })()}
        </select>
      </div>` : ''}
    </div>`;
  });
  html += '</div>';

  body.innerHTML = html;
  panel.style.display = '';
}

function removeAssign(astIdx, d, aId){
  const key = gk(astIdx,d);
  if(S.schedule[key]===aId){
    delete S.schedule[key];
    save();
    renderSchedule(); renderTakStats(); renderUyarilar();
    openDayDetail(d);
  }
}

function quickAssign(astIdxStr, d, aId){
  if(!astIdxStr) return;
  const astIdx = parseInt(astIdxStr);
  if(!ASSISTANTS[astIdx]) return;
  const _qEngel=_nobetYazilamaz(astIdx,d);
  if(_qEngel){ showToast(_qEngel); return; }
  if(_maxNobetAsildimi(astIdx)){
    showToast(ASSISTANTS[astIdx].name+' max nöbet sayısına ulaştı — eklenemez');
    return;
  }
  S.schedule[gk(astIdx,d)] = aId;
  save();
  renderSchedule(); renderTakStats(); renderUyarilar();
  openDayDetail(d);
}

function quickAssignWarn(sel, d, aId){
  const val=sel.value;
  if(!val){return;}
  sel.value='';
  const ai=parseInt(val);
  const ast=ASSISTANTS[ai];
  if(!ast) return;
  // Uyarı kontrolü: seçilen option metninde uyarı var mı?
  const optEl=sel.options[sel.selectedIndex];
  const optText=optEl?optEl.textContent:'';
  const hasWarn=optText.includes('\u26A0\uFE0F')||optText.includes('\u26D4');
  if(hasWarn){
    if(!confirm(ast.name+' için uyarılar var:\\n'+optText.split(' — ').slice(1).join('\\n')+'\\n\\nYine de atamak istiyor musunuz?')){
      return;
    }
  }
  quickAssign(String(ai), d, aId);
}

// İsim kısalt: "Ahmet Şengül" → "Ahmet Ş.", "Taha Yaşar Kiraz" → "Taha Y.K."
function shortName(name){
  if(!name) return '';
  const parts = _esc(name).trim().split(/\s+/);
  if(parts.length<=1) return parts[0]||'';
  const first = parts[0];
  const rest = parts.slice(1).map(p=>p[0].toUpperCase()+'.').join('');
  return first+' '+rest;
}

function renderAsstList(){
  const {y,m} = S.currentDate;
  const days = daysInMonth(y,m);
  const el = document.getElementById('asstListView');
  if(!el) return;
  let html = '';
  ASSISTANTS.forEach((ast,i)=>{
    const nobetler = [];
    for(let d=1;d<=days;d++){
      const aId = S.schedule[gk(i,d)];
      if(aId){
        const a = AREAS.find(x=>x.id===aId);
        nobetler.push({d, a});
      }
    }
    html += `<div style="background:var(--bg2);border:1px solid var(--bord);border-radius:8px;padding:10px 12px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:8px">
        <span class="kt ${KIDEM_CLS[ast.kidem]}" style="font-size:10px">K${ast.kidem}</span>
        <span style="font-size:12px;font-weight:700;color:var(--w1)">${_esc(ast.name)}</span>
        <span style="font-size:10px;color:var(--w3);margin-left:auto">${nobetler.length} nöbet</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">
        ${nobetler.length?nobetler.map(n=>`
          <div style="display:flex;align-items:center;gap:3px;background:var(--bg3);border-radius:5px;padding:3px 7px;border-left:3px solid ${n.a?n.a.color:'#888'}">
            <span style="font-size:10px;font-weight:600;color:var(--w2)">${n.d}</span>
            <span style="font-size:9px;color:var(--w3)">${n.a?getAreaLabel(n.a.id):'?'}</span>
          </div>
        `).join(''):`<span style="font-size:10px;color:var(--w4)">Nöbet yok</span>`}
      </div>
    </div>`;
  });
  el.innerHTML = html;
}

function renderAreaList(){
  const {y,m} = S.currentDate;
  const days = daysInMonth(y,m);
  const el = document.getElementById('areaListView');
  if(!el) return;
  let html = '';
  AREAS.forEach(a=>{
    let total=0, violation=0;
    const gunler = [];
    for(let d=1;d<=days;d++){
      const cnt = ASSISTANTS.filter((_,i)=>S.schedule[gk(i,d)]===a.id).length;
      const rule = getDayRule(d,a.id);
      if(rule.aktif){
        total+=cnt;
        if(cnt<rule.min) violation++;
        if(cnt>0) gunler.push({d,cnt});
      }
    }
    html += `<div style="background:var(--bg2);border:1px solid var(--bord);border-left:3px solid ${a.color};border-radius:8px;padding:10px 12px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:8px">
        <div class="adot" style="background:${a.color}"></div>
        <span style="font-size:12px;font-weight:700;color:var(--w1)">${a.name}</span>
        <span style="font-size:10px;color:var(--w3);margin-left:auto">${total} toplam</span>
        ${violation>0?`<span style="font-size:9px;color:var(--red);font-weight:700">${violation} sorun</span>`:''}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:3px">
        ${gunler.map(g=>`<div style="background:var(--bg3);border-radius:4px;padding:2px 6px;font-size:10px;font-weight:600;color:var(--w2)">${g.d}<span style="color:var(--w4);font-size:9px;margin-left:2px">×${g.cnt}</span></div>`).join('')}
      </div>
    </div>`;
  });
  el.innerHTML = html;
}

/* ── KIDEM KURALLARI FONKSİYONLARI (Yeni basitleştirilmiş sistem) ── */

/* ══════════════════════════════════════════
   ASİSTAN EKLE / SİL / ONAY
══════════════════════════════════════════ */

function updateTercihUI() {
  const isBasasistan = window.ACILX_ROLE === 'basasistan';
  const tercihAcik   = window._tercihAcik || false;
  const yayinda      = window._nobetYayinda || false;

  // Başasistan tercih butonu
  const tercihBtn  = document.getElementById('tercihBtn');
  const yayinlaBtn = document.getElementById('yayinlaBtn');
  if(tercihBtn && isBasasistan) {
    tercihBtn.style.display = '';
    tercihBtn.disabled = false;
    tercihBtn.style.opacity = '1';
    tercihBtn.textContent = tercihAcik ? '🔒 Tercihleri Kapat' : '📋 Tercih Aç';
    tercihBtn.style.borderColor = tercihAcik ? 'rgba(240,160,64,0.5)' : 'var(--bord)';
    tercihBtn.style.color       = tercihAcik ? 'var(--orange)' : 'var(--w3)';
    tercihBtn.style.background  = tercihAcik ? 'rgba(240,160,64,0.1)' : 'var(--bg3)';
  }

  const scheduleEmpty = Object.keys(S.schedule).length === 0;
  if(isBasasistan) {
    const olusturBtn = document.getElementById('olusturBtn');
    const silBtn     = document.getElementById('silBtn');
    const kaldirBtn  = document.getElementById('yayindanKaldirBtn');

    if(yayinda) {
      // Yayında: Oluştur ve Sil GİZLİ — sadece Kaldır görünür
      // Liste değişikliği için önce yayından kaldırılmalı
      if(olusturBtn) olusturBtn.style.display='none';
      if(silBtn)     silBtn.style.display='none';
      if(kaldirBtn)  kaldirBtn.style.display='';
      if(yayinlaBtn) yayinlaBtn.style.display='none';
    } else {
      if(kaldirBtn) kaldirBtn.style.display='none';
      if(olusturBtn) { olusturBtn.disabled=false; olusturBtn.style.opacity='1'; }
      if(!scheduleEmpty) {
        if(olusturBtn) olusturBtn.style.display='none';
        if(silBtn)     { silBtn.style.display=''; silBtn.disabled=false; silBtn.style.opacity='1'; }
        if(yayinlaBtn) yayinlaBtn.style.display='';
      } else {
        if(olusturBtn) olusturBtn.style.display='';
        if(silBtn)     silBtn.style.display='none';
        if(yayinlaBtn) yayinlaBtn.style.display='none';
      }
    }
  }

  // Asistan bannerleri
  const tercihBanner = document.getElementById('tercihBanner');
  const yayinBanner  = document.getElementById('yayinBanner');
  if(tercihBanner) tercihBanner.style.display = (!isBasasistan && tercihAcik) ? '' : 'none';
  if(yayinBanner)  yayinBanner.style.display  = (!isBasasistan && yayinda)    ? '' : 'none';
  const tb2 = document.getElementById('tercihBannerTakvim');
  if(tb2) tb2.style.display = (!isBasasistan && tercihAcik) ? '' : 'none';
}

function renderDayConfigPanel(){
  let total=0,html='';
  AREAS.forEach(a=>{
    const r=S.defaultDayMin[a.id];total+=r.min;
    const can=ASSISTANTS.filter(ast=>(S.quota[a.id]||{})[ast.kidem]>0).length;
    html+=`<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:0.5px solid var(--bord)">
      <div style="display:flex;align-items:center;gap:7px;min-width:110px;font-size:13px;color:var(--w1)"><div class="adot" style="background:${a.color}"></div>${a.name}</div>
      <div style="flex:1;font-size:12px;color:var(--w3)">${r.min===0?'<span style="color:var(--w3)">Zorunlu değil</span>':'Min <strong style="color:var(--w1)">'+r.min+'</strong>'} · Max <strong style="color:var(--w1)">${r.max}</strong></div>
      <span style="font-size:11px;padding:2px 8px;border-radius:var(--border-radius-md);font-weight:500;${can>=r.min?'background:#EAF3DE;color:#3B6D11':'background:#FCEBEB;color:#A32D2D'}">${can>=r.min?'&#10003; '+can+' uygun':'&#9888; Yetersiz'}</span>
    </div>`;
  });
  const _dcp=document.getElementById('dayConfigPanel'); if(!_dcp) return;
  _dcp.innerHTML=html;
  const _tmd=document.getElementById('totalMinDisplay'); if(_tmd) _tmd.textContent=total;
}


/* ── NÖBET DAĞILIMI ── */
function renderDagilim(){
  const dagEl=document.getElementById('dagTbl');
  if(!dagEl) return;
  if(!AREAS||AREAS.length===0){ dagEl.innerHTML='<tr><td style="padding:20px;color:var(--w4);text-align:center">Alan verisi yükleniyor…</td></tr>'; return; }
  if(!S.quota) S.quota={};
  if(!S.minNobet) S.minNobet={};
  if(!S.maxHours) S.maxHours={1:216,2:192,3:168,4:144,5:120};
  let html='<thead><tr>';
  html+='<th style="text-align:left;padding:6px 10px;font-size:10px;font-weight:600;color:var(--w3);border-bottom:1px solid var(--bord);background:var(--bg3);position:sticky;left:0;z-index:2">Alan</th>';
  [1,2,3,4,5].forEach(k=>{
    html+=`<th style="padding:6px 4px;font-size:10px;font-weight:600;text-align:center;border-bottom:1px solid var(--bord);background:var(--bg3);min-width:54px">
      <span class="kt ${KIDEM_CLS[k]}" style="font-size:10px;padding:1px 5px">K${k}</span>
    </th>`;
  });
  html+='</tr></thead><tbody>';
  // Alan × Kıdem nöbet sayıları
  AREAS.forEach(a=>{
    if(!S.quota[a.id]) S.quota[a.id]={1:0,2:0,3:0,4:0,5:0};
    if(!S.minNobet[a.id]) S.minNobet[a.id]={1:0,2:0,3:0,4:0,5:0};
    html+=`<tr>
      <td style="padding:6px 10px;border-bottom:1px solid var(--bord);background:var(--bg2);position:sticky;left:0;z-index:1;white-space:nowrap">
        <div style="display:flex;align-items:center;gap:5px">
          <div class="adot" style="background:${a.color};flex-shrink:0"></div>
          <span style="font-size:11px;font-weight:600;color:var(--w1)">${a.name}</span>
        </div>
      </td>`;
    [1,2,3,4,5].forEach(k=>{
      const v=(S.quota[a.id]||{})[k]||0;
      html+=`<td style="text-align:center;border-bottom:1px solid var(--bord);padding:2px">
        <div class="ni-wrap" style="justify-content:center">
          <button class="ni-btn" type="button" onclick="niStep(this,-1)">−</button>
          <input class="ni dagKotaInput" data-kidem="${k}" type="number" min="0" max="31" value="${v}"
            title="${v===0?'0 = giremez':'Aylık '+v+' nöbet'}"
            style="width:34px;font-size:12px;font-weight:600;${v===0?'opacity:.35;color:var(--w4)':''}"
            onchange="
              const val=Math.max(0,parseInt(this.value)||0);
              if(!S.quota['${a.id}'])S.quota['${a.id}']={};
              S.quota['${a.id}'][${k}]=val;
              if(!S.minNobet['${a.id}'])S.minNobet['${a.id}']={};
              S.minNobet['${a.id}'][${k}]=val>0?1:0;
              this.style.opacity=val===0?'.35':'1';
              this.style.color=val===0?'var(--w4)':'';
              save();showSaved('dagSaved');dagKontrolToplamlar()">
          <button class="ni-btn" type="button" onclick="niStep(this,1)">+</button>
        </div>
      </td>`;
    });
    html+='</tr>';
  });
  // ── Toplam satırı ──
  html+='<tr style="border-top:2px solid var(--bord)">';
  html+='<td style="padding:6px 10px;background:var(--bg3);position:sticky;left:0;z-index:1;font-size:10px;font-weight:700;color:var(--w2)">Toplam</td>';
  [1,2,3,4,5].forEach(k=>{
    let toplam=0;
    AREAS.forEach(a=>{ toplam+=((S.quota[a.id]||{})[k]||0); });
    const maxNobet=Math.round(S.maxHours[k]/24);
    const asim=toplam>maxNobet;
    html+=`<td id="dagTop${k}" style="text-align:center;padding:4px 2px;background:var(--bg3)">
      <span style="font-size:12px;font-weight:700;color:${asim?'var(--red)':'var(--w1)'}">${toplam}</span>
      <span style="font-size:9px;color:${asim?'var(--red)':'var(--w4)'}">/ ${maxNobet}</span>
      ${asim?'<div style="font-size:8px;color:var(--red);font-weight:600;margin-top:1px">Max aşıldı!</div>':''}
    </td>`;
  });
  html+='</tr>';
  // ── Max saat satırı ──
  html+='<tr>';
  html+='<td style="padding:6px 10px;background:var(--bg3);position:sticky;left:0;z-index:1;font-size:10px;font-weight:600;color:var(--w3)">Max (s/ay)</td>';
  [1,2,3,4,5].forEach(k=>{
    html+=`<td style="text-align:center;padding:4px 2px;background:var(--bg3)">
      <div class="ni-wrap" style="justify-content:center">
        <button class="ni-btn" type="button" onclick="niStep(this,-24)">−</button>
        <input class="ni" type="number" min="24" max="720" step="24" value="${S.maxHours[k]}"
          style="width:40px;font-size:11px;font-weight:600"
          onchange="S.maxHours[${k}]=parseInt(this.value)||24;save();showSaved('dagSaved');dagKontrolToplamlar()">
        <button class="ni-btn" type="button" onclick="niStep(this,24)">+</button>
      </div>
      <div style="font-size:9px;color:var(--w4);margin-top:1px">${Math.round(S.maxHours[k]/24)} nöbet</div>
    </td>`;
  });
  html+='</tr>';
  html+='</tbody>';
  dagEl.innerHTML=html;
}

// Matris toplam/max doğrulama — kota veya maxHours değişince çağrılır
function dagKontrolToplamlar(){
  if(!S.maxHours) S.maxHours={1:216,2:192,3:168,4:144,5:120};
  [1,2,3,4,5].forEach(k=>{
    let toplam=0;
    AREAS.forEach(a=>{ toplam+=((S.quota[a.id]||{})[k]||0); });
    const maxNobet=Math.round(S.maxHours[k]/24);
    const asim=toplam>maxNobet;
    const el=document.getElementById('dagTop'+k);
    if(el){
      el.innerHTML=
        '<span style="font-size:12px;font-weight:700;color:'+(asim?'var(--red)':'var(--w1)')+'">'+toplam+'</span>'+
        ' <span style="font-size:9px;color:'+(asim?'var(--red)':'var(--w4)')+'">/ '+maxNobet+'</span>'+
        (asim?'<div style="font-size:8px;color:var(--red);font-weight:600;margin-top:1px">Max aşıldı!</div>':'');
    }
    // Kıdem sütunundaki hücreleri vurgula
    document.querySelectorAll('.dagKotaInput[data-kidem="'+k+'"]').forEach(inp=>{
      const val=parseInt(inp.value)||0;
      if(val>0&&asim){
        inp.style.background='rgba(232,87,42,0.12)';
        inp.style.borderColor='rgba(232,87,42,0.4)';
      } else {
        inp.style.background='';
        inp.style.borderColor='';
      }
    });
  });
}

/* ── KOTA (kaldırıldı — renderDagilim içine taşındı) ── */
function renderKota(){
  // Max saat artık renderDagilim tablonun altında gösteriliyor
  // Geriye dönük uyumluluk için boş bırakıldı
}


let _currentView='both';
function setView(v){
  _currentView=v;
  ['both','area','asst'].forEach(x=>{
    const btn=document.getElementById('viewBtn'+x.charAt(0).toUpperCase()+x.slice(1));
    if(btn){btn.style.background=x===v?'var(--red)':'var(--bg3)';btn.style.color=x===v?'#fff':'var(--w3)';}
  });
  const areaView=document.getElementById('areaView');
  const asstView=document.getElementById('asstView');
  if(areaView) areaView.style.display=(v==='both'||v==='area')?'block':'none';
  if(asstView) asstView.style.display=(v==='both'||v==='asst')?'block':'none';
}

function renderSchedule(log){
  renderNewCal();
  if(_newView===1) renderAsstList();
  if(_newView===2) renderAreaList();
  const uyTab = document.getElementById('tab-uyarilar');
  if(uyTab && uyTab.style.display !== 'none') renderUyarilar();
  if(typeof updateTercihUI==='function') updateTercihUI();

  log=log||window._lastGenLog||{};
  const uyarilar=log.uyarilar||[];
  const hedefEksikler=log.hedefEksikler||[];
  const hedefFazlalar=log.hedefFazlalar||[];
  const y=S.currentDate.y,mo=S.currentDate.m;
  const days=daysInMonth(y,mo);
  let filled=0,minViolDays=0,overQ=0;

  // ── SÜTUN BAŞLIKLARI (ortak) ──
  function colHeaders(){
    let h='';
    for(let d=1;d<=days;d++){
      const dw=getDOW(y,mo,d);
      const we=isWE(y,mo,d);
      const minViols=checkDayMin(d);
      const kidemViols=checkKidemGrup(d);
      const hasViol=minViols.length>0||kidemViols.length>0;
      if(minViols.length>0) minViolDays++;
      const title=hasViol?[...minViols,...kidemViols].join(' | '):'';
      const titleAttr=title?' title="'+title.replace(/"/g,"'")+'"':'';
      const _ov=S.dayOverride[d]&&Object.keys(S.dayOverride[d]).length>0;
      h+=`<th class="${hasViol?'day-viol':we?'day-we':''}" onclick="openDayModal(${d})" style="cursor:pointer;min-width:28px${_ov?';border-bottom:2px solid var(--bord-r)':''}"${titleAttr}>
        <span style="font-size:9px;font-weight:600">${DAYS_TR[dw]}</span><br>
        <span style="font-size:9px;opacity:.7">${d}${_ov?'<span style="color:var(--red);font-size:7px"> ✎</span>':''}</span>
      </th>`;
    }
    return h;
  }

  // ── ALAN ÖZETİ TABLOSU ──
  const _colHdr=colHeaders(); // tek seferlik hesapla (minViolDays sadece bir kez sayılsın)

  // Alan özeti üstü: kapalı gün bilgisi
  const _kapaliToplamBuAy=(()=>{
    const moKey3=y+'_'+mo;
    let t=0;
    AREAS.forEach(a=>{
      const arr=(S.kapaliGunler&&S.kapaliGunler[moKey3+'_'+a.id])||[];
      t+=arr.length;
    });
    return t;
  })();

  if(_kapaliToplamBuAy>0){
    const areaTblEl=document.getElementById('areaTbl');
    if(areaTblEl) areaTblEl.setAttribute('data-kapalibilgi','1');
  }

  let areaHtml='<thead><tr>';
  areaHtml+=`<th class="cn" style="min-width:100px;font-size:11px">Alan
    <div style="font-size:9px;color:var(--w4);font-weight:400;margin-top:1px">hücreye tıkla: kapat/aç</div>
  </th>${_colHdr}</tr></thead><tbody>`;

  AREAS.forEach(a=>{
    const rule=getDayRule(1,a.id);
    areaHtml+=`<tr>
      <td class="cn" style="padding:4px 8px">
        <div style="display:flex;align-items:center;gap:6px">
          <div class="adot" style="background:${a.color};width:8px;height:8px"></div>
          <span style="font-size:12px;font-weight:600;color:var(--w1)">${a.name}</span>
        </div>
      </td>`;
    for(let d=1;d<=days;d++){
      const we=isWE(y,mo,d);
      const cnt=getAreaCount(d,a.id);
      const rule2=getDayRule(d,a.id);
      const short=cnt<rule2.min&&rule2.min>0;
      // O günde bu alandaki asistanların isimlerini bul
      const who=ASSISTANTS.map((ast,i)=>{
        if(S.schedule[gk(i,d)]!==a.id) return null;
        return ast.name;
      }).filter(Boolean);

      // Kıdem grubu ihlali: bu alan + bu gün için kontrol
      const kidemViolsCell=(()=>{
        return kidemKuralIhlali(d,a.id).map(ih=>ih.msg);
      })();
      const kidemShort=kidemViolsCell.length>0&&who.length>0;
      const isViol=short||kidemShort;
      const moKey2=y+'_'+mo;
      const kapaliKey=moKey2+'_'+a.id;
      const isKapali=S.kapaliGunler&&S.kapaliGunler[kapaliKey]&&S.kapaliGunler[kapaliKey].includes(d);

      const tdCls=['atd',isKapali?'atd-kapali':isViol?'atd-viol':'',we&&!isKapali?'atd-we':''].filter(Boolean).join(' ');
      areaHtml+=`<td class="${tdCls}"
        onclick="toggleKapaliGun('${a.id}',${d})"
        title="${isKapali?'Kapalı — tıkla: aç':'Tıkla: bu alanı bu gün kapat'}">
        ${isKapali
          ? `<div class="atd-kapali-icon">✕</div>`
          : who.length
            ? `<div class="atd-who">${who.map(n=>`<span>${n}</span>`).join('')}</div>`
            : `<span class="atd-empty">—</span>`
        }
        ${!isKapali&&short?`<div class="atd-min-warn">min${rule2.min}</div>`:''}
        ${!isKapali&&kidemShort&&kidemViolsCell[0]?`<div class="atd-kidem-warn">K${(kidemViolsCell[0].split(':')[0]||'').replace('K','')}</div>`:''}
      </td>`;
    }
    areaHtml+='</tr>';
  });
  areaHtml+='</tbody>';
  const areaTbl=document.getElementById('areaTbl');
  if(areaTbl) areaTbl.innerHTML=areaHtml;

  // ── ASİSTAN DETAY TABLOSU ──
  let html='<thead><tr><th class="cn">Asistan</th>'+_colHdr+'</tr></thead><tbody>';

  const _schedMoKey=y+'_'+mo;
  ASSISTANTS.forEach((ast,i)=>{
    const th=countAll(i);
    const _ov=S.monthOverride&&S.monthOverride[_schedMoKey]&&S.monthOverride[_schedMoKey][i];
    const mh=_hesaplaHedef(i);
    const isRot=_ov!==undefined&&_ov!==null;
    html+=`<tr>
      <td class="cn" style="cursor:pointer" onclick="openAstProfile(${i})" title="Tıkla: asistan profili aç">
        <span style="font-size:12px;color:var(--w1)">${_esc(ast.name)}</span>
        ${isRot?`<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:#1A2E10;color:#7DC44A;margin-left:4px;font-weight:600">${mh}n</span>`:''}
        <span class="sub">
          <span class="kt ${KIDEM_CLS[ast.kidem]}" style="font-size:9px;padding:1px 4px">K${ast.kidem}</span>
          <span style="font-size:9px;color:${th>=mh?'var(--red)':'var(--w3)'}">${th}/${mh} nöbet</span>
        </span>
      </td>`;
    for(let d=1;d<=days;d++){
      const v=S.schedule[gk(i,d)];
      const we=isWE(y,mo,d);
      const egt=getEgtStatus(y,mo,d,ast.kidem);
      if(v) filled++;
      const q=v&&S.quota[v]?(S.quota[v][ast.kidem]||0):99;
      const kotaOver=v&&q>0&&countArea(i,v)>q;
      if(kotaOver) overQ++;
      const weCls=we&&!v?'style="opacity:.45"':'';

      {
        const lbl=v?AREA_LBL[v]:'+';
        const cellClick = v ? 'openAstProfile('+i+')' : 'openCellModal('+i+','+d+')';
        html+=`<td ${weCls}><button class="cb ${v?AREA_CLS[v]:''} ${kotaOver?'c-kota':''}" onclick="${cellClick}">${lbl}</button></td>`;
      }
    }
    html+='</tr>';
  });
  html+='</tbody>';
  document.getElementById('schedTbl').innerHTML=html;

  // Kıdem grubu ihlali olan gün sayısını say
  let kidemViolDays=0;
  for(let d=1;d<=days;d++){ if(checkKidemGrup(d).length>0) kidemViolDays++; }

  const _stF=document.getElementById('stF'); if(_stF) _stF.textContent=filled;
  const _stMin=document.getElementById('stMin'); if(_stMin) _stMin.textContent=minViolDays+(kidemViolDays>0?' (+'+kidemViolDays+'K)':'');
  const _stOver=document.getElementById('stOver'); if(_stOver) _stOver.textContent=overQ;

  let alerts='';

  // Uyarı banner kaldırıldı
  renderOzet();
  return;

  // Matematiksel imkânsızlık uyarıları
  uyarilar.forEach(u=>{
    alerts+=`<div class="alert al-e" style="flex-direction:column;gap:4px">
      <div style="font-weight:600;font-size:13px">⛔ ${u.alan} — kota yetersiz</div>
      <div style="font-size:12px">
        ${u.aktifGun} aktif gün × min ${u.minVal} = <strong>${u.gereken} nöbet</strong> gerekli,
        mevcut toplam kota: <strong>${u.toplamKota}</strong>
        (<strong style="color:#E87070">+${u.eksik} eksik</strong>)
      </div>
      <div style="font-size:11px;color:var(--w3)">
        Nöbet Dağılımı sekmesinden ${u.alan} kotalarını toplamda ${u.eksik} artırın.
      </div>
    </div>`;
  });

  // Asistan hedef eksikleri
  if(hedefEksikler.length>0){
    const toplamEksik=hedefEksikler.reduce((s,r)=>s+r.eksik,0);
    alerts+=`<div class="alert al-w" style="flex-direction:column;gap:2px">
      <div style="font-weight:600">⚠ ${hedefEksikler.length} asistana ${toplamEksik} nöbet yazılamadı</div>
      <div style="font-size:11px;color:var(--w3)">${hedefEksikler.map(r=>r.ast+' (−'+r.eksik+')').join(', ')}</div>
    </div>`;
  }
  // Asistan hedef fazlaları
  if(hedefFazlalar.length>0){
    const toplamFazla=hedefFazlalar.reduce((s,r)=>s+r.fazla,0);
    alerts+=`<div class="alert al-w" style="flex-direction:column;gap:2px;border-color:rgba(232,87,42,0.3);background:rgba(232,87,42,0.06)">
      <div style="font-weight:600;color:var(--red)">↑ ${hedefFazlalar.length} asistan hedefinin üstünde (toplam +${toplamFazla})</div>
      <div style="font-size:11px;color:var(--w3)">${hedefFazlalar.map(r=>r.ast+' (+'+r.fazla+')').join(', ')}</div>
    </div>`;
  }

  // Takvimde kırmızı gün var mı?
  if(minViolDays>0)
    alerts+=`<div class="alert al-w">⚠ ${minViolDays} günde alan minimum karşılanmıyor — takvimde kırmızı sütunlar</div>`;

  // Kıdem grubu ihlali
  if(kidemViolDays>0)
    alerts+=`<div class="alert al-w">⚠ ${kidemViolDays} günde kıdem grubu karşılanmıyor — takvimde kırmızı sütunlar</div>`;

  if(!uyarilar.length&&!hedefEksikler.length&&!minViolDays&&!kidemViolDays&&filled>0)
    alerts+=`<div class="alert al-ok">&#10003; Tüm kurallar karşılandı.</div>`;

  const _ab2=document.getElementById('alertBox'); if(_ab2) _ab2.innerHTML=alerts;
  // Uyarılar sekmesini de güncelle
  window._lastAlerts = alerts;
  renderOzet();
}

/* ── GÜN MODAL — transfer + atama + kural ── */
function openDayModal(day){
  const y=S.currentDate.y,mo=S.currentDate.m,days2=daysInMonth(y,mo);
  const dw=getDOW(y,mo,day);
  const we=isWE(y,mo,day);
  const moKey=y+'_'+mo;
  const _dmHasOv=S.dayOverride[day]&&Object.keys(S.dayOverride[day]).length>0;
  document.getElementById('dmTitle').textContent=`${day} ${MONTHS[mo]} — ${DAYS_TR[dw]}${we?' (Hafta sonu)':''}${_dmHasOv?' ✎':''}`;
  document.getElementById('dmSub').textContent=_dmHasOv?'Bu güne özel kontenjan aktif':'';
  document.getElementById('dayModal')._day=day;
  _renderDayModal(day);
  document.getElementById('dayModal').classList.add('open');
}

function _renderDayModal(day){
  const y=S.currentDate.y,mo=S.currentDate.m,days2=daysInMonth(y,mo);
  const viols=[...checkDayMin(day),...checkKidemGrup(day)];

  // Asistan bazlı kota sayacı (schedule'dan direkt)
  function astKotaKullanimi(i,aId){
    return Object.keys(S.schedule).filter(k=>{
      const [ai]=k.split('_');return parseInt(ai)===i&&S.schedule[k]===aId;
    }).length;
  }
  // O alan o asistana bu gün yazılabilir mi?
  function yazilabilir(i,aId,mevcutAlanId){
    const ast=ASSISTANTS[i];
    if(((S.quota[aId]||{})[ast.kidem]||0)===0) return false;
    if(!isAlanAktif(day,aId)) return false;
    // Kota: mevcut alandan geçiyorsa o alandan 1 çıkar
    const kullanim=astKotaKullanimi(i,aId);
    const kotaMax=(S.quota[aId]||{})[ast.kidem]||0;
    if(mevcutAlanId===aId) return true; // zaten orada, "koru" seçeneği
    if(kullanim>=kotaMax) return false;
    // Günlük max: eğer geçiş ise mevcut alandaki kişi çıkacak, yeni alana girecek
    const cnt=getAreaCount(day,aId);
    if(cnt>=(getDayRule(day,aId).max||99)) return false;
    return true;
  }
  // Art arda yasak var mı? Hangi gün engel oluşturuyor?
  function artArdaEngel(i){
    if(day>1&&S.schedule[gk(i,day-1)]) return day-1;
    if(day<days2&&S.schedule[gk(i,day+1)]) return day+1;
    // Ay sınırı kontrolleri
    if(day===1&&S.prevMonthLastDay&&S.prevMonthLastDay[i]) return 'önceki ay son gün';
    if(day===days2&&S.nextMonthFirstDay&&S.nextMonthFirstDay[i]) return 'sonraki ay ilk gün';
    return false;
  }

  let html='';
  if(viols.length)
    html+=`<div class="alert al-e" style="margin-bottom:10px;font-size:11px">&#9888; ${viols.join(' · ')}</div>`;

  // ── ALAN KONTENJAN PANELİ ──
  const _hasOv=S.dayOverride[day]&&Object.keys(S.dayOverride[day]).length>0;
  html+='<div style="margin-bottom:12px;background:var(--bg3);border:1px solid var(--bord);border-radius:6px;overflow:hidden">';
  html+='<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-bottom:1px solid var(--bord)">';
  html+='<span style="font-size:10px;font-weight:600;color:var(--w2)">Günlük kontenjan</span>';
  html+='<div style="display:flex;gap:6px;align-items:center">';
  if(_hasOv) html+='<span style="font-size:8px;color:var(--bord-r);background:var(--red-sub);padding:2px 6px;border-radius:3px;border:1px solid var(--bord-r)">ÖZEL</span>';
  if(_hasOv) html+='<button onclick="clearDayOverride('+day+')" style="font-size:9px;padding:2px 7px;border-radius:3px;border:1px solid var(--bord);background:var(--bg4);color:var(--w3);cursor:pointer">↺ Sıfırla</button>';
  html+='</div></div>';
  html+='<table style="width:100%;border-collapse:collapse;font-size:11px">';
  html+='<thead><tr>';
  html+='<th style="text-align:left;padding:5px 10px;font-size:9px;color:var(--w3);font-weight:600;border-bottom:1px solid var(--bord);letter-spacing:.5px">ALAN</th>';
  html+='<th style="text-align:center;padding:5px 8px;font-size:9px;color:var(--w3);font-weight:600;border-bottom:1px solid var(--bord);width:40px">MEVCUT</th>';
  html+='<th style="text-align:center;padding:5px 8px;font-size:9px;color:var(--w3);font-weight:600;border-bottom:1px solid var(--bord);width:52px">MİN</th>';
  html+='<th style="text-align:center;padding:5px 8px;font-size:9px;color:var(--w3);font-weight:600;border-bottom:1px solid var(--bord);width:52px">MAX</th>';
  html+='</tr></thead><tbody>';
  AREAS.forEach(function(a){
    var rule=getDayRule(day,a.id);
    var ov=S.dayOverride[day]&&S.dayOverride[day][a.id];
    var isOv=!!ov;
    var cnt=getAreaCount(day,a.id);
    var short=rule.aktif&&cnt<rule.min;
    var bord=isOv?'var(--bord-r)':'var(--bord)';
    var bg=isOv?'var(--red-sub)':'var(--bg4)';
    var rowBg=isOv?'rgba(217,43,43,0.04)':'transparent';
    html+='<tr style="border-bottom:1px solid var(--bord);background:'+rowBg+'">';
    html+='<td style="padding:5px 10px">';
    html+='<div style="display:flex;align-items:center;gap:6px">';
    html+='<div class="adot" style="background:'+a.color+';width:6px;height:6px"></div>';
    html+='<span style="color:'+(isOv?'var(--w1)':'var(--w2)')+'">'+a.name+'</span>';
    html+='</div></td>';
    // Mevcut sayı — renkli
    var cntCol=short?'var(--red)':cnt>0?a.color:'var(--w4)';
    html+='<td style="text-align:center;padding:5px 8px;font-weight:700;color:'+cntCol+'">'+cnt+'</td>';
    // Min input
    html+='<td style="text-align:center;padding:4px 6px">';
    html+='<input type="number" min="0" max="19" value="'+rule.min+'"'
      +' data-day="'+day+'" data-aid="'+a.id+'" data-type="min" class="day-ov-inp"'
      +' style="width:40px;padding:3px 4px;font-size:11px;text-align:center;border:1px solid '+bord+';border-radius:3px;background:'+bg+';color:var(--w1);font-family:var(--font-sans)">';
    html+='</td>';
    // Max input
    html+='<td style="text-align:center;padding:4px 6px">';
    html+='<input type="number" min="0" max="19" value="'+(rule.max||19)+'"'
      +' data-day="'+day+'" data-aid="'+a.id+'" data-type="max" class="day-ov-inp"'
      +' style="width:40px;padding:3px 4px;font-size:11px;text-align:center;border:1px solid '+bord+';border-radius:3px;background:'+bg+';color:var(--w1);font-family:var(--font-sans)">';
    html+='</td>';
    html+='</tr>';
  });
  html+='</tbody></table></div>';



  // Tüm asistanlar tek listede — uyarılarla birlikte
  // Önce her asistan için uyarıları hesapla
  const _astRows = ASSISTANTS.map((ast,i)=>{
    const mevcutAlanId=S.schedule[gk(i,day)]||null;
    const egtBloke=isEgtFull(y,mo,day,ast.kidem);
    const artArda=!mevcutAlanId&&artArdaEngel(i);
    const prof=S.astProfiles&&S.astProfiles[i]?S.astProfiles[i]:{};
    const dur=prof.durum||'aktif';
    const moKey2=y+'_'+mo;
    const izinGunler=((prof.izinliAylik&&prof.izinliAylik[moKey2])||[]);
    const izinli=dur==='izinli'||dur==='rot_hayir'||izinGunler.includes(day);
    const yazAlanlar=AREAS.filter(a=>yazilabilir(i,a.id,mevcutAlanId));

    // Her alan için uyarı hesapla
    const alanUyarilar={};
    AREAS.forEach(a=>{
      const uyarilar=[];
      const kota=(S.quota[a.id]||{})[ast.kidem]||0;
      if(kota===0) return; // bu alana giremez, göstermeyeceğiz
      // Alan günlük max dolu mu?
      const cnt=getAreaCount(day,a.id);
      const maxRule=getDayRule(day,a.id).max||99;
      if(!mevcutAlanId&&cnt>=maxRule) uyarilar.push({tip:'alan_dolu',msg:'Alan dolu',renk:'var(--orange)'});
      // Aylık kota doldu mu?
      const kullanim=astKotaKullanimi(i,a.id);
      if(mevcutAlanId!==a.id&&kullanim>=kota) uyarilar.push({tip:'kota_dolu',msg:'Kota dolu',renk:'var(--red)'});
      // Kıdem ihlali olacak mı? — simüle et
      if(!mevcutAlanId||mevcutAlanId!==a.id){
        const eskiSched=S.schedule[gk(i,day)];
        S.schedule[gk(i,day)]=a.id;
        const ihl=kidemKuralIhlali(day,a.id);
        if(eskiSched) S.schedule[gk(i,day)]=eskiSched; else delete S.schedule[gk(i,day)];
        if(ihl.length>0) uyarilar.push({tip:'kidem',msg:'Kıdem ihlali',renk:'var(--orange)'});
      }
      alanUyarilar[a.id]=uyarilar;
    });

    // Genel uyarılar (asistan seviyesi)
    const genelUyarilar=[];
    if(egtBloke) genelUyarilar.push({msg:'Eğitim engeli',renk:'var(--w4)'});
    if(artArda) genelUyarilar.push({msg:'Art arda yasak',renk:'var(--w4)'});
    if(izinli) genelUyarilar.push({msg:'İzinli',renk:'var(--w4)'});

    // Sıralama skoru: aktif (seçili) en üst, sonra uyarısız, sonra uyarılı
    const aktif=!!mevcutAlanId;
    const herhangiUyari=genelUyarilar.length>0||Object.values(alanUyarilar).every(u=>u.length>0);
    const skor=aktif?0:(genelUyarilar.length>0?2:(herhangiUyari?1:0));

    return {ast,i,mevcutAlanId,egtBloke,artArda,izinli,yazAlanlar,alanUyarilar,genelUyarilar,aktif,skor};
  });

  // Sırala: aktif → uyarısız → uyarılı
  _astRows.sort((a,b)=>{
    if(a.aktif!==b.aktif) return a.aktif?-1:1;
    return a.skor-b.skor;
  });

  html+=`<div style="display:flex;flex-direction:column;gap:4px">`;

  _astRows.forEach(row=>{
    const {ast,i,mevcutAlanId,egtBloke,artArda,izinli,alanUyarilar,genelUyarilar,aktif}=row;
    const satirBg=aktif?'var(--bg3)':'transparent';
    const satirBord=aktif?'1px solid var(--bord)':'1px solid transparent';
    const dimmed=egtBloke||izinli;

    html+=`<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;
      background:${satirBg};border:${satirBord};${dimmed?'opacity:.45':''}">`;

    // İsim + kıdem
    html+=`<div style="min-width:130px;flex-shrink:0;cursor:pointer" onclick="closeDayModal();openAstProfile(${i})" title="Profili aç">
      <span style="font-size:12px;font-weight:${aktif?'600':'400'};color:${aktif?'var(--w1)':'var(--w3)'}">
        ${shortName(ast.name)}
      </span>
      <span class="kt ${KIDEM_CLS[ast.kidem]}" style="font-size:9px;padding:1px 3px;margin-left:3px">K${ast.kidem}</span>
    </div>`;

    // Alan butonları + uyarılar
    html+=`<div style="display:flex;gap:4px;flex-wrap:wrap;flex:1;align-items:center">`;

    if(genelUyarilar.length>0 && !aktif){
      // Genel engel varsa ama yine de alan butonlarını göster
      genelUyarilar.forEach(u=>{
        html+=`<span style="font-size:9px;color:${u.renk};padding:1px 4px;border-radius:2px;background:${u.renk}15">${u.msg}</span>`;
      });
    }

    // Alan butonları — tüm kotası olan alanlar
    AREAS.forEach(a=>{
      const kota=(S.quota[a.id]||{})[ast.kidem]||0;
      if(kota===0) return;
      const secili=mevcutAlanId===a.id;
      const uyarilar=alanUyarilar[a.id]||[];

      html+=`<button onclick="${secili?`manuelKaldir(${i},${day})`:`manuelAtaUyarili(${i},${day},'${a.id}')`}"
        style="font-size:11px;padding:3px 9px;border-radius:4px;cursor:pointer;font-weight:${secili?'700':'500'};
        border:${secili?'2px solid '+a.color:'1px solid '+(uyarilar.length>0?'var(--orange)':'var(--bord)')};
        background:${secili?a.color+'22':'var(--bg4)'};
        color:${secili?a.color:uyarilar.length>0?'var(--orange)':'var(--w3)'};"
        title="${secili?'Tıkla: kaldır':a.name+(uyarilar.length?' — '+uyarilar.map(u=>u.msg).join(', '):'')}"
      >${getAreaLabel(a.id)}${secili?' ✕':''}${uyarilar.length>0?'<span style="margin-left:2px;font-size:9px">⚠</span>':''}</button>`;
    });

    // Hiç kotası olan alan yoksa
    if(AREAS.every(a=>((S.quota[a.id]||{})[ast.kidem]||0)===0)){
      html+=`<span style="font-size:11px;color:var(--w4)">Kota yok</span>`;
    }

    html+='</div></div>';
  });

  html+='</div>';
  document.getElementById('dmBody').innerHTML=html;
  // Kontenjan input'larına event delegation
  document.getElementById('dmBody').querySelectorAll('.day-ov-inp').forEach(function(inp){
    inp.addEventListener('change', function(){
      setDayOverride(parseInt(this.dataset.day), this.dataset.aid, this.dataset.type, parseInt(this.value)||0);
    });
  });
}

function manuelAta(i,day,aId){
  const days2=daysInMonth(S.currentDate.y,S.currentDate.m);
  const mevcutVar=!!S.schedule[gk(i,day)];
  // Merkezi izin + art arda kontrolü (yeni atama ise)
  if(!mevcutVar){
    const _maEngel=_nobetYazilamaz(i,day);
    if(_maEngel){ alert(_maEngel); return; }
  }
  // Günlük max: geçişte eski alan çıkıyor, yeni alan giriyor → cnt değişmez (aynı kişi)
  if(!mevcutVar&&getAreaCount(day,aId)>=(getDayRule(day,aId).max||99)){
    alert('Bu alan bu gün maksimum dolulukta.');return;
  }
  S.schedule[gk(i,day)]=aId;
  save();_renderDayModal(day);renderSchedule(window._lastGenLog);
}
function manuelAtaUyarili(i,day,aId){
  const ast=ASSISTANTS[i]; if(!ast) return;
  const days2=daysInMonth(S.currentDate.y,S.currentDate.m);
  const mevcutVar=!!S.schedule[gk(i,day)];
  // HARD BLOCK: izin + art arda — yeni atama ise asla geçilemez
  if(!mevcutVar){
    const _mauEngel=_nobetYazilamaz(i,day);
    if(_mauEngel){ showToast(_mauEngel); return; }
  }
  const uyarilar=[];
  // Alan dolu
  if(!mevcutVar&&getAreaCount(day,aId)>=(getDayRule(day,aId).max||99))
    uyarilar.push('Alan günlük max dolulukta');
  // Kota dolu
  const kullanim=Object.keys(S.schedule).filter(k=>{const [ai]=k.split('_');return parseInt(ai)===i&&S.schedule[k]===aId;}).length;
  const kotaMax=(S.quota[aId]||{})[ast.kidem]||0;
  if(!mevcutVar&&kullanim>=kotaMax&&kotaMax>0) uyarilar.push('Aylık kota dolu ('+kullanim+'/'+kotaMax+')');
  // Kıdem ihlali
  const eskiSched=S.schedule[gk(i,day)];
  S.schedule[gk(i,day)]=aId;
  const ihl=kidemKuralIhlali(day,aId);
  if(eskiSched) S.schedule[gk(i,day)]=eskiSched; else delete S.schedule[gk(i,day)];
  if(ihl.length>0) uyarilar.push('Kıdem kuralı ihlali: '+ihl[0].msg);
  // Uyarı varsa göster ama ata
  if(uyarilar.length>0){
    showToast('⚠ '+uyarilar.join(' · '));
  }
  S.schedule[gk(i,day)]=aId;
  save();_renderDayModal(day);renderSchedule(window._lastGenLog);renderUyarilar();
}
function manuelKaldir(i,day){
  delete S.schedule[gk(i,day)];
  save();_renderDayModal(day);renderSchedule(window._lastGenLog);renderUyarilar();
}

function closeDayModal(){document.getElementById('dayModal').classList.remove('open');}
document.getElementById('dayModal').addEventListener('click',function(e){if(e.target===this)closeDayModal();});

function setDayOverride(day,aId,type,val){
  if(!S.dayOverride[day]) S.dayOverride[day]={};
  if(!S.dayOverride[day][aId]){
    var def=S.defaultDayMin[aId]||{min:1,max:3};
    S.dayOverride[day][aId]={min:def.min,max:def.max||19};
  }
  S.dayOverride[day][aId][type]=val;
  if(type==='min'&&val>S.dayOverride[day][aId].max) S.dayOverride[day][aId].max=val;
  if(type==='max'&&val<S.dayOverride[day][aId].min) S.dayOverride[day][aId].min=val;
  save(); _renderDayModal(day); renderSchedule(window._lastGenLog);
}

function clearDayOverride(day){
  delete S.dayOverride[day];
  save(); _renderDayModal(day); renderSchedule(window._lastGenLog);
}

/* ── HÜCRE MODAL ── */
function openCellModal(i,d){
  const ast=ASSISTANTS[i];
  const y=S.currentDate.y,mo=S.currentDate.m;
  const dw=getDOW(y,mo,d);
  const we=isWE(y,mo,d);
  document.getElementById('cmTitle').textContent=`${ast.name} · ${d} ${MONTHS[mo]}`;
  document.getElementById('cmSub').textContent=`Kıdem ${ast.kidem} · ${DAYS_TR[dw]}${we?' · Hafta sonu':''}`;
  let html='';
  {
    document.getElementById('cmSaveBtn').style.display='';
    const cur=S.schedule[gk(i,d)]||'';
    html+=`<div class="field"><label>Alan ataması</label><select id="cmSel"><option value="">— Boş —</option>`;
    AREAS.forEach(a=>{
      const q=(S.quota[a.id]||{})[ast.kidem]||0;
      const cnt=countArea(i,a.id);
      const mn=(S.minNobet[a.id]||{})[ast.kidem]||0;
      const dis=q===0?'disabled':'';
      const hint=q===0?'(giremez)':cnt>=q?'(kota doldu)':`${cnt}/${q}${mn>0?' min'+mn:''}`;
      html+=`<option value="${a.id}" ${cur===a.id?'selected':''} ${dis}>${a.name} ${hint}</option>`;
    });
    html+=`</select></div>`;
  }
  html+=`<div style="background:var(--bg3);border-radius:var(--border-radius-md);padding:10px;font-size:12px">
    <div style="font-weight:500;margin-bottom:8px;color:var(--w1)">Alan doluluk — ${d} ${MONTHS[mo]}</div>`;
  AREAS.forEach(a=>{
    const rule=getDayRule(d,a.id);
    const cnt=getAreaCount(d,a.id);
    const pct=rule.max>0?Math.min(100,Math.round(cnt/rule.max*100)):0;
    const col=cnt<rule.min?'#E24B4A':cnt>=rule.max?'#BA7517':'#378ADD';
    html+=`<div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="color:var(--w3)">${a.name}</span><span style="font-weight:500;color:${col}">${cnt}<span style="font-size:10px;font-weight:400"> min${rule.min}–max${rule.max}</span></span></div>
    <div class="pb-wrap" style="margin-bottom:5px"><div class="pb-fill" style="width:${pct}%;background:${col}"></div></div>`;
  });
  const th=countAll(i)*24,mh=S.maxHours[ast.kidem];
  html+=`<div style="padding-top:6px;border-top:0.5px solid var(--bord)"><span style="color:var(--w3)">Saat: </span><span style="font-weight:500;color:${th>=mh?'#A32D2D':'var(--w1)'}">${th}/${mh}s</span>
    <div class="pb-wrap" style="margin-top:2px"><div class="pb-fill" style="width:${Math.min(100,Math.round(th/mh*100))}%;background:${th>=mh?'#E24B4A':'#378ADD'}"></div></div></div></div>`;
  document.getElementById('cmBody').innerHTML=html;
  document.getElementById('cellModal')._cell={i,d};
  document.getElementById('cellModal').classList.add('open');
}
function closeCellModal(){document.getElementById('cellModal').classList.remove('open');}
function saveCellModal(){
  const c=document.getElementById('cellModal')._cell;
  if(!c) return;
  const sel=document.getElementById('cmSel');
  if(!sel) return;
  const v=sel.value;
  const k=gk(c.i,c.d);
  if(!v) delete S.schedule[k]; else S.schedule[k]=v;
  save();closeCellModal();
  renderNewCal(); renderTakStats(); renderUyarilar();
  if(_newView===1) renderAsstList();
}
document.getElementById('cellModal').addEventListener('click',function(e){if(e.target===this)closeCellModal();});

/* ── ÖZET ── */
let _ozetDate = null;
let _ozetSchedule = null;

function renderOzet(){
  if(!_ozetDate) _ozetDate = {y: S.currentDate.y, m: S.currentDate.m};
  const lbl = document.getElementById('ozetMonthLbl');
  if(lbl) lbl.textContent = MONTHS[_ozetDate.m]+' '+_ozetDate.y;
  const {y,m} = _ozetDate;
  const days = daysInMonth(y,m);

  if(window.ACILX_ROLE !== 'basasistan' && window._myAstIdx > -1) {
    renderOzetAsistan(y, m, days);
    return;
  }
  _renderOzetBasasistan();
}

function ozetChangeMonth(dir){
  if(!_ozetDate) _ozetDate = {y: S.currentDate.y, m: S.currentDate.m};
  _ozetDate.m += dir;
  if(_ozetDate.m > 11){ _ozetDate.m=0; _ozetDate.y++; }
  if(_ozetDate.m < 0){ _ozetDate.m=11; _ozetDate.y--; }
  const lbl = document.getElementById('ozetMonthLbl');
  if(lbl) lbl.textContent = MONTHS[_ozetDate.m]+' '+_ozetDate.y;
  const isCurrent = _ozetDate.y===S.currentDate.y && _ozetDate.m===S.currentDate.m;
  if(_db && !isCurrent){
    showSpinner();
    fsScheduleRef(_ozetDate.y, _ozetDate.m).get().then(snap=>{
      _ozetSchedule = snap.exists ? (snap.data().schedule||{}) : {};
      renderOzet();
    }).catch(()=>{ _ozetSchedule={}; renderOzet(); })
    .finally(()=>{ hideSpinner(); });
  } else {
    _ozetSchedule = null;
    renderOzet();
  }
}

function renderOzetAsistan(y, m, days){
  const myIdx = window._myAstIdx;
  const ast   = ASSISTANTS[myIdx];
  if(!ast){ document.getElementById('ozetContent').innerHTML=''; return; }

  // Nöbetleri topla
  const nobetler = [];
  for(let d=1;d<=days;d++){
    const aId = S.schedule[gk(myIdx,d)];
    if(aId){
      const dow = new Date(y,m,d).getDay();
      nobetler.push({ d, aId, isWE: dow===0||dow===6 });
    }
  }

  const total   = nobetler.length;
  const hafIci  = nobetler.filter(n=>!n.isWE).length;
  const hafSonu = nobetler.filter(n=>n.isWE).length;

  // En uzun boşluk
  let maxGap=0, maxGapStart=0, maxGapEnd=0;
  let curGap=0, curStart=1;
  for(let d=1;d<=days;d++){
    if(!S.schedule[gk(myIdx,d)]){ curGap++; }
    else {
      if(curGap>maxGap){ maxGap=curGap; maxGapEnd=d-1; maxGapStart=d-curGap; }
      curGap=0; curStart=d+1;
    }
  }
  if(curGap>maxGap){ maxGap=curGap; maxGapEnd=days; maxGapStart=days-curGap+1; }

  // Sıradaki nöbet
  const today = new Date();
  const todayD = (y===today.getFullYear()&&m===today.getMonth()) ? today.getDate() : 0;
  const nextNobet = nobetler.find(n=>n.d>todayD);
  const prevNobet = [...nobetler].reverse().find(n=>n.d<=todayD);

  // Alan dağılımı
  const alanMap = {};
  nobetler.forEach(n=>{ alanMap[n.aId]=(alanMap[n.aId]||0)+1; });

  let html = '';

  // Kişisel özet başlık
  html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
    <div style="width:36px;height:36px;border-radius:50%;background:rgba(232,87,42,0.12);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:var(--red)">${ast.name.split(' ').map(p=>p[0]).join('').slice(0,2)}</div>
    <div>
      <div style="font-size:13px;font-weight:700;color:var(--w1)">${_esc(ast.name)}</div>
      <div style="font-size:10px;color:var(--w3)">${MONTHS[m]} ${y} nöbet özeti</div>
    </div>
  </div>`;

  // 4 stat kart
  html += `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:12px">
    <div style="background:var(--bg2);border:1px solid var(--bord);border-radius:8px;padding:10px 12px">
      <div style="font-size:9px;color:var(--w3);text-transform:uppercase;letter-spacing:.5px;font-weight:600;margin-bottom:3px">Toplam Nöbet</div>
      <div style="font-size:24px;font-weight:800;color:var(--w1);font-family:'DM Mono',monospace">${total}</div>
    </div>
    <div style="background:var(--bg2);border:1px solid var(--bord);border-radius:8px;padding:10px 12px">
      <div style="font-size:9px;color:var(--w3);text-transform:uppercase;letter-spacing:.5px;font-weight:600;margin-bottom:3px">En Uzun Boşluk</div>
      <div style="font-size:24px;font-weight:800;color:${maxGap>7?'var(--orange)':'var(--w1)'};font-family:'DM Mono',monospace">${maxGap}<span style="font-size:11px;font-weight:500;color:var(--w3)"> gün</span></div>
      ${maxGap>0?`<div style="font-size:9px;color:var(--w4)">${maxGapStart}-${maxGapEnd}. günler</div>`:''}
    </div>
    <div style="background:var(--bg2);border:1px solid var(--bord);border-radius:8px;padding:10px 12px">
      <div style="font-size:9px;color:var(--w3);text-transform:uppercase;letter-spacing:.5px;font-weight:600;margin-bottom:3px">Hafta İçi</div>
      <div style="font-size:24px;font-weight:800;color:var(--w1);font-family:'DM Mono',monospace">${hafIci}</div>
    </div>
    <div style="background:var(--bg2);border:1px solid var(--bord);border-radius:8px;padding:10px 12px">
      <div style="font-size:9px;color:var(--w3);text-transform:uppercase;letter-spacing:.5px;font-weight:600;margin-bottom:3px">Hafta Sonu</div>
      <div style="font-size:24px;font-weight:800;color:var(--w1);font-family:'DM Mono',monospace">${hafSonu}</div>
    </div>
  </div>`;

  // Sıradaki / son nöbet
  html += `<div style="background:var(--bg2);border:1px solid var(--bord);border-radius:10px;padding:10px 14px;margin-bottom:10px">
    <div style="display:flex;gap:12px">
      ${nextNobet?`<div style="flex:1">
        <div style="font-size:9px;color:var(--w3);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Sıradaki Nöbet</div>
        <div style="font-size:16px;font-weight:800;color:var(--red);font-family:'DM Mono',monospace">${nextNobet.d} ${MONTHS[m]}</div>
        <div style="display:flex;align-items:center;gap:4px;margin-top:3px">
          <div style="width:8px;height:8px;border-radius:50%;background:${AREAS.find(a=>a.id===nextNobet.aId)?.color||'#888'}"></div>
          <span style="font-size:10px;color:var(--w3)">${AREAS.find(a=>a.id===nextNobet.aId)?.name||nextNobet.aId}</span>
        </div>
      </div>`:'<div style="flex:1"><div style="font-size:11px;color:var(--w4)">Bu ay nöbet yok</div></div>'}
      ${prevNobet?`<div style="flex:1;border-left:1px solid var(--bord);padding-left:12px">
        <div style="font-size:9px;color:var(--w3);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Son Nöbet</div>
        <div style="font-size:16px;font-weight:800;color:var(--w2);font-family:'DM Mono',monospace">${prevNobet.d} ${MONTHS[m]}</div>
        <div style="display:flex;align-items:center;gap:4px;margin-top:3px">
          <div style="width:8px;height:8px;border-radius:50%;background:${AREAS.find(a=>a.id===prevNobet.aId)?.color||'#888'}"></div>
          <span style="font-size:10px;color:var(--w3)">${AREAS.find(a=>a.id===prevNobet.aId)?.name||prevNobet.aId}</span>
        </div>
      </div>`:''}
    </div>
  </div>`;

  // Alan dağılımı
  if(Object.keys(alanMap).length > 0){
    html += `<div style="background:var(--bg2);border:1px solid var(--bord);border-radius:10px;padding:10px 14px">
      <div style="font-size:9px;color:var(--w3);font-weight:700;text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px">Alan Dağılımı</div>`;
    Object.entries(alanMap).sort((a,b)=>b[1]-a[1]).forEach(([aId,cnt])=>{
      const alan = AREAS.find(a=>a.id===aId);
      const pct  = Math.round(cnt/total*100);
      html += `<div style="margin-bottom:7px">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px">
          <div style="display:flex;align-items:center;gap:5px">
            <div style="width:7px;height:7px;border-radius:50%;background:${alan?.color||'#888'}"></div>
            <span style="font-size:11px;color:var(--w2)">${alan?.name||aId}</span>
          </div>
          <span style="font-size:11px;font-weight:700;color:var(--w1);font-family:'DM Mono',monospace">${cnt} <span style="color:var(--w4);font-weight:400">(${pct}%)</span></span>
        </div>
        <div style="height:4px;background:var(--bg4);border-radius:2px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${alan?.color||'#888'};border-radius:2px"></div>
        </div>
      </div>`;
    });
    html += '</div>';
  }

  document.getElementById('ozetContent').innerHTML = html;
}

function _renderOzetBasasistan(){
  if(!_ozetDate) _ozetDate = {y: S.currentDate.y, m: S.currentDate.m};
  const y=_ozetDate.y, m=_ozetDate.m;
  const days = daysInMonth(y,m);
  const sched = (_ozetSchedule!==null) ? _ozetSchedule : S.schedule;
  function ogk(i,d){ return i+'_'+d; }

  const astStats = ASSISTANTS.map((ast,i)=>{
    const alanCnt = {};
    AREAS.forEach(a=>{ alanCnt[a.id]=0; });
    let total=0;
    for(let d=1;d<=days;d++){
      const aId=sched[ogk(i,d)];
      if(aId){ total++; if(alanCnt[aId]!==undefined) alanCnt[aId]++; }
    }
    const hedef=_hesaplaHedef(i);
    return {ast, i, total, alanCnt, hedef};
  }).sort((a,b)=>b.total-a.total);

  const maxNobet = Math.max(...astStats.map(s=>s.total), 1);
  const activeAreas = AREAS.filter(a=>astStats.some(s=>(s.alanCnt[a.id]||0)>0));

  let html = `<div style="background:var(--bg2);border:1px solid var(--bord);border-radius:10px;padding:12px 14px">`;

  if(activeAreas.length>0){
    html += `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--bord)">`;
    activeAreas.forEach(a=>{
      html += `<div style="display:flex;align-items:center;gap:4px">
        <div style="width:8px;height:8px;border-radius:2px;background:${a.color}"></div>
        <span style="font-size:10px;color:var(--w3)">${a.name}</span>
      </div>`;
    });
    html += `</div>`;
  }

  if(astStats.every(s=>s.total===0)){
    html += `<div style="text-align:center;padding:24px 0;color:var(--w4);font-size:12px">${MONTHS[m]} ${y} için nöbet verisi yok</div>`;
  } else {
    astStats.forEach(({ast, i, total, alanCnt, hedef})=>{
      const nameColor = total>hedef ? 'var(--orange)' : total===0 ? 'var(--w4)' : 'var(--w2)';
      const segments = AREAS.map(a=>{
        const cnt = alanCnt[a.id]||0;
        if(!cnt) return '';
        const segW = Math.max(2, Math.round(cnt/maxNobet*100));
        return `<div style="height:100%;width:${segW}%;background:${a.color};flex-shrink:0" title="${a.name}: ${cnt}"></div>`;
      }).join('');
      html += `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--bord)">
        <span class="kt ${KIDEM_CLS[ast.kidem]}" style="font-size:9px;padding:1px 5px;flex-shrink:0">K${ast.kidem}</span>
        <span style="font-size:11px;font-weight:600;color:${nameColor};min-width:110px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${_esc(ast.name)}">${shortName(ast.name)}</span>
        <div style="flex:1;height:10px;background:var(--bg4);border-radius:5px;overflow:hidden;display:flex;min-width:0">${segments}</div>
        <span style="font-size:13px;font-weight:800;color:var(--w1);font-family:'DM Mono',monospace;min-width:22px;text-align:right">${total}</span>
        <span style="font-size:9px;color:var(--w4);min-width:28px;text-align:right">/${hedef}</span>
      </div>`;
    });
  }

  html += '</div>';
  document.getElementById('ozetContent').innerHTML = html;
}

var _pendingMonthSaves = {};
var _changeMonthBusy = false;

function changeMonth(dir){
  // Hızlı ardışık tıklamayı engelle
  if(_changeMonthBusy) return;
  _changeMonthBusy = true;

  // Bekleyen debounce'u iptal et — snapshot alacağız
  clearTimeout(_fsSaveTimer);

  // ── 1. Eski ayın snapshot'ını al (senkron) ──
  var oldY = S.currentDate.y;
  var oldM = S.currentDate.m;
  var oldKey = oldY + '_' + oldM;
  var oldFsReady = window._fsReady; // Bu ay Firestore'dan yüklendi mi?
  var _snp = {};
  MONTHLY_KEYS.forEach(function(k){ _snp[k] = S[k] || {}; });
  GLOBAL_KEYS.forEach(function(k){ _snp[k] = S[k]; });
  var snapshot = JSON.parse(JSON.stringify(_snp));
  console.log('[ACİLX] changeMonth snapshot (' + oldKey + ')',
    'schedule:', Object.keys(snapshot.schedule||{}).length,
    'kapaliGunler:', Object.keys(snapshot.kapaliGunler||{}).length,
    'fsReady:', oldFsReady);

  // ── 2. localStorage'a anında yedekle (senkron, <1ms) ──
  // Sadece Firestore'dan yüklenmiş veya düzenlenmiş veri varsa cache'e yaz
  if(oldFsReady && Object.keys(snapshot.schedule||{}).length > 0) {
    try { localStorage.setItem(LS_KEY + '_' + oldKey, JSON.stringify(snapshot)); } catch(e) {}
  } else {
    console.log('[ACİLX] changeMonth: boş/yüklenmemiş ay, cache yazılmadı (' + oldKey + ')');
  }

  // ── 3. Firestore'a arka planda kaydet (await yok, kullanıcı beklemez) ──
  // KRİTİK: Sadece Firestore'dan yüklenmiş veri varsa kaydet — boş snapshot'la Firestore'u ezme
  if(window.ACILX_ROLE === 'basasistan' && _db && window._assistantsLoaded && oldFsReady) {
    var gId = window.ACILX_GROUP || 'default';
    // Sadece ay-bazlı verileri kaydet — global ayarları Firestore'daki schedule doc'una yazma
    var saveP = _db.collection('groups').doc(gId).collection('schedule').doc(oldKey).set({
      schedule: snapshot.schedule,
      dayOverride: snapshot.dayOverride, monthOverride: snapshot.monthOverride,
      kapaliGunler: snapshot.kapaliGunler, prevMonthLastDay: snapshot.prevMonthLastDay,
      nextMonthFirstDay: snapshot.nextMonthFirstDay,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: window.ACILX_UID
    }, {merge: true}).then(function(){
      delete _pendingMonthSaves[oldKey];
      console.log('[ACİLX] changeMonth: Firestore kaydedildi (' + oldKey + ')');
    }).catch(function(err){
      console.error('[ACİLX] changeMonth kayıt hatası:', err);
      delete _pendingMonthSaves[oldKey];
    });
    _pendingMonthSaves[oldKey] = saveP;
  } else if(!oldFsReady) {
    console.log('[ACİLX] changeMonth: Firestore yüklenmemişti, kayıt atlandı (' + oldKey + ')');
  }

  // ── 4. Ay HEMEN değişir ──
  S.currentDate.m += dir;
  if(S.currentDate.m > 11){ S.currentDate.m = 0; S.currentDate.y++; }
  if(S.currentDate.m < 0){ S.currentDate.m = 11; S.currentDate.y--; }

  window._fsReady = false;
  window._scheduleUserEdited = false; // Yeni ay → düzenleme bayrağını sıfırla
  // Ay-bazlı verileri sıfırla (global ayarlar korunur)
  _clearSchedule();
  S.dayOverride = {};
  S.monthOverride = {};
  S.kapaliGunler = {};
  S.prevMonthLastDay = {};
  S.nextMonthFirstDay = {};
  window._tercihAcik = false;
  window._nobetYayinda = false;
  window._tercihAy = null;

  var y = S.currentDate.y, m = S.currentDate.m;
  var newKey = y + '_' + m;
  var lbl = document.getElementById('monthLbl');
  if(lbl) lbl.textContent = MONTHS[m] + ' ' + y;

  console.log('[ACİLX] changeMonth → ' + newKey,
    'quota:', JSON.stringify(S.quota).substring(0,80),
    'maxHours:', JSON.stringify(S.maxHours));

  // ── 5. localStorage cache'den anında göster (sadece ay-bazlı veriler) ──
  var lsCacheLoaded = false;
  try {
    var cached = localStorage.getItem(LS_KEY + '_' + newKey);
    if(cached){
      var data = JSON.parse(cached);
      // Sadece ay-bazlı anahtarları yükle — global ayarları ezme
      MONTHLY_KEYS.forEach(function(k){
        if(data[k] === undefined) return;
        if(k === 'schedule'){ _loadScheduleData(data[k]); }
        else { S[k] = data[k]; }
      });
      lsCacheLoaded = Object.keys(S.schedule||{}).length > 0;
      console.log('[ACİLX] cache→S (' + newKey + ')',
        'schedule:', Object.keys(S.schedule||{}).length,
        'kapaliGunler:', Object.keys(S.kapaliGunler||{}).length);
    } else {
      console.log('[ACİLX] cache yok (' + newKey + ')');
    }
  } catch(e) { console.warn('[ACİLX] cache okuma hatası:', e); }

  // Anında render — localStorage verisiyle
  try{renderMinConf();}catch(e){console.warn('renderMinConf:',e);} try{renderDagilim();}catch(e){console.warn('renderDagilim:',e);} try{renderKota();}catch(e){console.warn('renderKota:',e);}
  try { renderNewCal(); } catch(e) {}
  updateTercihUI();
  _changeMonthBusy = false; // Kullanıcı tekrar tıklayabilir

  // ── 6. Firestore'dan arka planda güncelle ──
  if(_db) {
    // Bu ay için bekleyen kayıt varsa önce onu bekle
    var pending = _pendingMonthSaves[newKey] || Promise.resolve();
    pending.then(function(){
      return Promise.all([
        fsLoadState(y, m),
        (function(){ var ref=fsSettingsRef(y,m); return ref ? ref.get().catch(function(){return null}) : Promise.resolve(null); })()
      ]);
    }).then(function(results){
      var loaded = results[0], settSnap = results[1];
      // Ay hâlâ aynı mı? (hızlı geçiş koruması)
      if(S.currentDate.y !== y || S.currentDate.m !== m) return;
      if(settSnap && settSnap.exists){
        var sd = settSnap.data();
        window._tercihAcik   = sd.tercihAcik  || false;
        window._nobetYayinda = sd.nobetYayinda || false;
        window._tercihAy     = sd.tercihAy     || null;
      }
      window._fsReady = true;
      console.log('[ACİLX] Firestore yüklendi (' + newKey + ')',
        'schedule:', Object.keys(S.schedule||{}).length,
        'quota:', JSON.stringify(S.quota).substring(0,80),
        'maxHours:', JSON.stringify(S.maxHours));
      // localStorage cache'i sadece ay-bazlı verilerle güncelle
      try {
        var _cacheObj = {};
        MONTHLY_KEYS.forEach(function(k){ _cacheObj[k] = S[k]; });
        // Global ayarları da cache'e yaz (changeMonth geri geldiğinde yedek)
        GLOBAL_KEYS.forEach(function(k){ _cacheObj[k] = S[k]; });
        localStorage.setItem(LS_KEY + '_' + newKey, JSON.stringify(_cacheObj));
      } catch(e) {}
      // Firestore'dan yeni veri geldiyse re-render
      if(loaded){
        console.log('[ACİLX] changeMonth re-render (' + newKey + ')');
        try{renderMinConf();}catch(e){console.warn('renderMinConf:',e);} try{renderDagilim();}catch(e){console.warn('renderDagilim:',e);} try{renderKota();}catch(e){console.warn('renderKota:',e);}
        try { renderNewCal(); } catch(e) {}
        updateTercihUI();
      }
    }).catch(function(){
      if(S.currentDate.y === y && S.currentDate.m === m) window._fsReady = true;
    });
  } else {
    window._fsReady = true;
  }
}
// YZ FONKSIYONLARI
function saveApiKey(val){
  localStorage.setItem('acilx_apikey', val.trim());
}
function getApiKey(){
  return localStorage.getItem('acilx_apikey')||'';
}
function loadApiKeyInput(){
  const el=document.getElementById('apiKeyInput');
  if(el) el.value=getApiKey();
}
function buildContext(){
  const y=S.currentDate.y,mo=S.currentDate.m;
  const days=daysInMonth(y,mo);
  const MONTHS_TR=['Ocak','Subat','Mart','Nisan','Mayis','Haziran','Temmuz','Agustos','Eylul','Ekim','Kasim','Aralik'];
  const liste={};
  ASSISTANTS.forEach((ast,i)=>{
    const nobetler=[];
    for(let d=1;d<=days;d++){
      const v=S.schedule[gk(i,d)];
      if(v) nobetler.push({gun:d,alan:AREAS.find(a=>a.id===v)?.name||v});
    }
    liste[ast.name]={kidem:ast.kidem,nobetler};
  });
  const alanKurallari={};
  AREAS.forEach(a=>{
    const r=S.defaultDayMin[a.id];
    alanKurallari[a.name]={
      gunlukMin:r.min,gunlukMax:r.max,
      yalnizTutamaz:Object.keys(r.kidemKurallari||{}).filter(k=>(r.kidemKurallari[k]||{}).yalnizTutamaz).map(k=>{
        const kural=r.kidemKurallari[k];
        return {kidem:'K'+k,yaninda:(kural.yanindaKidemler||[]).map(y=>'K'+y),enAzKac:kural.enAzKac||1};
      }),
      kidemGruplari:(r.kidemGrupKurallari||[]).map(g=>({kidemler:(g.kidemler||[]).map(y=>'K'+y),enAzKac:g.enAzKac||0,enFazlaKac:g.enFazlaKac||0})),
      kapaliGunSayisi:Object.keys(S.kapaliGunler||{}).filter(k=>k.endsWith('_'+a.id)).reduce((s,k)=>(S.kapaliGunler[k]||[]).length+s,0)
    };
  });
  const dagitim={};
  AREAS.forEach(a=>{
    dagitim[a.name]={};
    [1,2,3,4,5].forEach(k=>{
      const q=(S.quota[a.id]||{})[k]||0;
      if(q>0) dagitim[a.name]['K'+k]=q+' nobet/ay';
    });
  });
  return {
    ay:MONTHS_TR[mo]+' '+y,
    toplamGun:days,
    asistanlar:ASSISTANTS.map(a=>({isim:a.name,kidem:'K'+a.kidem,hedefNobet:Math.round(S.maxHours[a.kidem]/24)})),
    alanKurallari,nobetDagitimi:dagitim,mevcutListe:liste
  };
}

function scheduleToJson(){
  const result={};
  ASSISTANTS.forEach((ast,i)=>{
    result[ast.name]={};
    AREAS.forEach(a=>{
      const g=[];
      for(let d=1;d<=daysInMonth(S.currentDate.y,S.currentDate.m);d++)
        if(S.schedule[gk(i,d)]===a.id) g.push(d);
      if(g.length) result[ast.name][a.name]=g;
    });
  });
  return result;
}

function applyScheduleFromJson(json){
  const days=daysInMonth(S.currentDate.y,S.currentDate.m);
  const moKey=S.currentDate.y+'_'+S.currentDate.m;
  _clearSchedule();
  let atladilar=0;
  ASSISTANTS.forEach((ast,i)=>{
    const astData=json[ast.name];
    if(!astData) return;
    const prof=(S.astProfiles&&S.astProfiles[i])||{};
    const dur=prof.durum||'aktif';
    const izinArr=((prof.izinliAylik)||{})[moKey]||[];
    AREAS.forEach(a=>{
      const gunler=astData[a.name]||[];
      gunler.forEach(d=>{
        if(d<1||d>days) return;
        // İzin kontrolü
        if(dur==='izinli'||dur==='rot_hayir'){ atladilar++; return; }
        if(izinArr.includes(d)){ atladilar++; return; }
        // Art arda kontrolü
        if(S.schedule[gk(i,d-1)]){ atladilar++; return; }
        if(S.schedule[gk(i,d+1)]){ atladilar++; return; }
        S.schedule[gk(i,d)]=a.id;
      });
    });
  });
  if(atladilar>0) showToast(atladilar+' atama izin/art arda kuralı nedeniyle atlandı');
  save();
  renderSchedule(window._lastGenLog||[]);
}

async function yzOlustur(){
  alert('YZ entegrasyonu mobil uygulama aşamasında aktif olacak.'); return;
  const btn=document.getElementById('yzBtn');
  btn.textContent='Hazirlaniyor...'; btn.disabled=true;
  document.getElementById('yzPanel').style.display='block';
  const panel=document.getElementById('yzMesajlar');
  panel.innerHTML='<div style="font-size:12px;color:var(--w3)">YZ nobet listesini hazirlıyor...</div>';
  const ctx=buildContext();
  const sistem=`Sen bir acil tip kliniginin nobet listesi uzmanisın. Verilen kural ve kisitlara gore aylik nobet listesi hazirlarsin.
KURALLAR:
- Her asistan tam hedef nobet sayisina ulasmali (ne eksik ne fazla)
- Art arda nobet yasak - nobet sonrasi mutlaka 1 gun dinlenme
- Alan gunluk minimum doluluk karsilanmali
- Kidem grubu kurallari uyulmali
YANIT FORMATI: Sadece JSON dondur, baska hicbir sey yazma.
Format: {"AsistanAdi": {"AlanAdi": [gun1, gun2, ...], ...}, ...}`;
  const kullanici=`${ctx.ay} ayi icin nobet listesi hazirla.
Asistanlar ve hedef nobet sayilari:
${ctx.asistanlar.map(a=>`- ${a.isim} (${a.kidem}): ${a.hedefNobet} nobet`).join('\n')}
Alan kurallari:
${Object.entries(ctx.alanKurallari).map(([alan,k])=>`- ${alan}: min=${k.gunlukMin}/gun, max=${k.gunlukMax}/gun`+(k.kidemKurallari&&k.kidemKurallari.length?', kidem kuralları: '+k.kidemKurallari.map(r=>r.kidem+' yalnız tutamaz → '+(r.gruplar||[]).map(g=>'['+g.kidemler.join('/')+' '+g.kosul+']').join(' & ')).join('; '):'')).join('\n')}
Nobet dagitimi (kota):
${Object.entries(ctx.nobetDagitimi).map(([alan,d])=>`- ${alan}: `+Object.entries(d).map(([k,v])=>`${k}=${v}`).join(', ')).join('\n')}
Toplam ${ctx.toplamGun} gun.`;
  try{
    const resp=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',headers:{'Content-Type':'application/json','x-api-key':getApiKey(),'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:4000,system:sistem,messages:[{role:'user',content:kullanici}]})
    });
    const data=await resp.json();
    const raw=data.content?.[0]?.text||'';
    let json;
    try{json=JSON.parse(raw.replace(/```json|```/g,'').trim());}
    catch(e){panel.innerHTML='<div style="color:var(--red);font-size:12px">YZ yaniti islenemedi.</div>';btn.textContent='YZ ile olustur';btn.disabled=false;return;}
    applyScheduleFromJson(json);
    window._yzHistory=[{role:'user',content:kullanici},{role:'assistant',content:raw}];
    panel.innerHTML='<div style="font-size:12px;color:#7DC44A">YZ nobet listesini hazirladi. Degisiklik icin asagiya yazin.</div>';
  }catch(e){panel.innerHTML='<div style="color:var(--red);font-size:12px">Baglanti hatasi.</div>';}
  btn.textContent='YZ ile olustur';btn.disabled=false;
}

async function yzGonder(){
  const input=document.getElementById('yzInput');
  const mesaj=input.value.trim();
  if(!mesaj) return;
  const panel=document.getElementById('yzMesajlar');
  const gonderBtn=document.getElementById('yzGonderBtn');
  input.value='';gonderBtn.disabled=true;
  panel.innerHTML+=`<div style="background:var(--bg3);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--w1);align-self:flex-end">${mesaj}</div>`;
  panel.innerHTML+='<div id="yzBekliyor" style="font-size:12px;color:var(--w3)">Duzenleniyor...</div>';
  panel.scrollTop=panel.scrollHeight;
  const mevcutJson=JSON.stringify(scheduleToJson());
  const gecmis=window._yzHistory||[];
  const yeniMesaj=`Mevcut nobet listesi:\n${mevcutJson}\n\nKullanici istegi: ${mesaj}\n\nDegisiklikleri uygulayarak guncel listeyi JSON formatinda dondur. Sadece JSON.`;
  try{
    const resp=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',headers:{'Content-Type':'application/json','x-api-key':getApiKey(),'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:4000,
        system:'Nobet listesi duzenleme asistanisin. Verilen listeyi kullanicinin istegine gore duzenle. Sadece JSON dondur.',
        messages:[...gecmis,{role:'user',content:yeniMesaj}]})
    });
    const data=await resp.json();
    const raw=data.content?.[0]?.text||'';
    let json;
    try{json=JSON.parse(raw.replace(/```json|```/g,'').trim());}
    catch(e){const b=document.getElementById('yzBekliyor');if(b)b.outerHTML='<div style="color:var(--red);font-size:12px">Yanit islenemedi.</div>';gonderBtn.disabled=false;return;}
    applyScheduleFromJson(json);
    window._yzHistory=[...gecmis.slice(-8),{role:'user',content:yeniMesaj},{role:'assistant',content:raw}];
    const b=document.getElementById('yzBekliyor');
    if(b) b.outerHTML='<div style="background:var(--red-sub);border:1px solid var(--bord-r);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--w2)">Duzenleme uygulandı.</div>';
    panel.scrollTop=panel.scrollHeight;
  }catch(e){const b=document.getElementById('yzBekliyor');if(b)b.outerHTML='<div style="color:var(--red);font-size:12px">Hata.</div>';}
  gonderBtn.disabled=false;
}

function switchTab(el,name){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  if(el) el.classList.add('active');
  ['minconf','nobet_dagilim','takvim','astprofile','asistanlar','ozet','sorunlar','tercihler','ayarlar'].forEach(n=>{
    const tabEl=document.getElementById('tab-'+n);
    if(tabEl) tabEl.style.display=n===name?'block':'none';
  });
  if(name==='takvim') try { renderNewCal(); } catch(e) {}
  if(name==='nobet_dagilim'){ try { renderDagilim(); } catch(e){ console.warn('renderDagilim:', e); } try { renderKota(); } catch(e){ console.warn('renderKota:', e); } }
  if(name==='minconf') try { renderMinConf(); } catch(e){ console.warn('renderMinConf:', e); }
  if(name==='ozet'){ _ozetDate={y:S.currentDate.y,m:S.currentDate.m}; _ozetSchedule=null; renderOzet(); }
  if(name==='sorunlar') renderSorunlar();
  if(name==='tercihler') renderTercihler();
  if(name==='asistanlar') renderAsistanlar();
  if(name==='astprofile'){
    _apMonth = _apMonth || S.currentDate;
    if(_apIdx === null || _apIdx === undefined){
      if(window.ACILX_ROLE === 'basasistan'){
        // Başasistan: kendi profilini göster, yoksa ilk asistanı
        const myIdx = (window._myAstIdx !== undefined && window._myAstIdx > -1) ? window._myAstIdx : 0;
        _apIdx = myIdx;
        _apMonth = S.currentDate;
        _renderAstProfile();
      } else {
        // Asistan: SADECE kendi index'i — başkasının profili asla
        // _myAstIdx henüz yüklenmediyse bekle
        if(window._myAstIdx === undefined) {
          // loadNobetSettings henüz tamamlanmadı — bekle ve tekrar dene
          setTimeout(()=>{ switchTab(document.getElementById('tab-btn-astprofile'),'astprofile'); }, 800);
          return;
        }
        if(window._myAstIdx > -1){
          _apIdx = window._myAstIdx;
          _apMonth = S.currentDate;
          _renderAstProfile();
        } else {
          // Henüz yüklenmedi — Firestore'dan tekrar bul
          const uid = window.ACILX_UID || '';
          if(_db && uid){
            _db.collection('users').doc(uid).get().then(snap=>{
              const email = snap.exists?(snap.data().email||''):'';
              let idx = ASSISTANTS.findIndex(a=>a.uid===uid);
              if(idx===-1) idx = ASSISTANTS.findIndex(a=>
                a.email && a.email.toLowerCase()===email.toLowerCase()
              );
              if(idx > -1){
                window._myAstIdx = idx;
                _apIdx = idx;
              } else {
                // Asistan listede yok — ilk asistanı göster
                _apIdx = 0;
              }
              _apMonth = S.currentDate;
              _renderAstProfile();
            }).catch(()=>{ _apIdx=0; _apMonth=S.currentDate; _renderAstProfile(); });
          } else {
            _apIdx = 0;
            _apMonth = S.currentDate;
            _renderAstProfile();
          }
        }
      }
    } else {
      _renderAstProfile();
    }
  }
  if(name==='ayarlar') renderAyarlar();
}

/* ── ASİSTAN PROFİL MODAL ── */
let _apIdx = null;
let _apMonth = null;

function openAstProfile(i){
  _apIdx = i;
  _apMonth = {y: S.currentDate.y, m: S.currentDate.m};
  const btn = document.getElementById('tab-btn-astprofile');
  // Tab adı değişmez — hep "👤 Profilim" kalır
  if(btn) btn.style.display = 'inline-block';
  switchTab(btn, 'astprofile');
}


function _showProfileNotFound(){
  _apIdx = null;
  // Başlık alanlarını temizle
  const name  = document.getElementById('apName');
  const kidem = document.getElementById('apKidem');
  const badge = document.getElementById('apIdxBadge');
  const meta  = document.getElementById('apMeta');
  if(name)  name.textContent  = '';
  if(kidem){ kidem.textContent=''; kidem.className=''; }
  if(badge) badge.textContent = '';
  if(meta)  meta.textContent  = '';

  // Nav butonlarını gizle
  const prev = document.getElementById('apPrevBtn');
  const next = document.getElementById('apNextBtn');
  if(prev) prev.style.display = 'none';
  if(next) next.style.display = 'none';

  // İstatistik ve takvim alanlarını temizle
  const stats = document.getElementById('apStats');
  const grid  = document.getElementById('apCalGrid');
  if(stats) stats.innerHTML = '';
  if(grid)  grid.innerHTML  = '';

  // Onay bekleniyor mesajı göster
  const profileContent = document.querySelector('#tab-astprofile > div:last-child') ||
                         document.getElementById('apStats')?.parentElement;

  // Tab içeriğini bul ve mesaj göster
  const tab = document.getElementById('tab-astprofile');
  if(tab) {
    // Mevcut içeriği bul (başlık sonrası)
    const existing = document.getElementById('_profileNotFoundMsg');
    if(!existing) {
      const msg = document.createElement('div');
      msg.id = '_profileNotFoundMsg';
      msg.style.cssText = 'margin:40px 0;text-align:center;padding:24px 16px';
      msg.innerHTML = `
        <div style="width:56px;height:56px;border-radius:50%;background:rgba(240,160,64,0.12);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:24px">⏳</div>
        <div style="font-size:15px;font-weight:700;color:var(--w1);margin-bottom:8px">Onay Bekleniyor</div>
        <div style="font-size:12px;color:var(--w3);line-height:1.6;max-width:260px;margin:0 auto">
          Hesabınız henüz bir asistanla eşleştirilmemiş.<br>
          Başasistanın sizi onaylamasını bekleyin.
        </div>
        <div style="margin-top:16px;font-size:10px;color:var(--w4);font-family:'DM Mono',monospace">${window.ACILX_UID ? window.ACILX_UID.slice(0,8)+'...' : ''}</div>
      `;
      // apStats'tan sonra ekle
      const statsEl = document.getElementById('apStats');
      if(statsEl) statsEl.parentNode.insertBefore(msg, statsEl);
      else tab.appendChild(msg);
    }
  }
}

function apNavAst(dir){
  // Sadece başasistan geçiş yapabilir
  if(window.ACILX_ROLE !== 'basasistan') {
    console.warn('[ACİLX] Yetkisiz profil gecisi engellendi');
    return;
  }
  const n = ASSISTANTS.length;
  _apIdx = ((_apIdx + dir) % n + n) % n;
  const btn = document.getElementById('tab-btn-astprofile');
  if(btn) btn.textContent = '👤 ' + ASSISTANTS[_apIdx].name;
  _renderAstProfile();
}

// Klavye ok tuşu desteği — sadece astprofile sekmesindeyken
document.addEventListener('keydown', function(e){
  if(window.ACILX_ROLE !== 'basasistan') return;
  const apTab = document.getElementById('tab-astprofile');
  if(!apTab || apTab.style.display === 'none') return;
  if(_apIdx === null) return;
  const tag = document.activeElement && document.activeElement.tagName;
  if(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if(e.key === 'ArrowLeft'){ e.preventDefault(); apNavAst(-1); }
  else if(e.key === 'ArrowRight'){ e.preventDefault(); apNavAst(1); }
});

function closeAstProfile(){
  _apIdx = null;
  const btn = document.getElementById('tab-btn-astprofile');
  btn.style.display = 'none';
}

function backToTakvim(){
  _apIdx = null; // sıfırla, sonra tekrar açılınca doğru yüklensin
  // Takvim sekmesine geç — profil sekmesi sekmeler çubuğunda kalır
  const takvimBtn = document.getElementById('tab-btn-takvim') ||
                    document.querySelector('.tab[onclick*="takvim"]');
  if(takvimBtn) takvimBtn.click();
}

function apChangeMonth(dir){
  _apMonth.m += dir;
  if(_apMonth.m < 0){ _apMonth.m = 11; _apMonth.y--; }
  if(_apMonth.m > 11){ _apMonth.m = 0; _apMonth.y++; }
  // Cache'i sıfırla — yeni ay için Firestore'dan yüklenecek
  window._apScheduleLoaded = null;
  window._apScheduleCache = null;
  _renderAstProfile();
}

function _renderAstProfile(){
  const i = _apIdx;
  const ast = ASSISTANTS[i];
  const y = _apMonth.y, mo = _apMonth.m;
  const days = daysInMonth(y, mo);
  const moKey = y+'_'+mo;
  const today = new Date();
  const todayY=today.getFullYear(), todayM=today.getMonth(), todayD=today.getDate();

  // Farklı ay mı bakıyoruz?
  const isCurrent = y===S.currentDate.y && mo===S.currentDate.m;
  const _sched = isCurrent ? S.schedule : (window._apScheduleCache||{});

  // Farklı ay verisi Firestore'dan yüklenmeli
  if(!isCurrent && !window._apScheduleLoaded) {
    window._apScheduleLoaded = moKey;
    if(_db) {
      showSpinner();
      fsScheduleRef(y, mo).get().then(snap=>{
        window._apScheduleCache = snap.exists ? (snap.data().schedule||{}) : {};
        _renderAstProfile();
      }).catch(()=>{ window._apScheduleCache={}; _renderAstProfile(); })
      .finally(()=>{ hideSpinner(); });
      return;
    } else {
      window._apScheduleCache = {};
    }
  }
  // Ay değiştiğinde cache'i sıfırla
  if(isCurrent) { window._apScheduleLoaded = null; window._apScheduleCache = null; }

  // Profil-local sayaçlar: farklı ay için _sched kullanır
  function _countAll(idx){ let c=0; for(let d=1;d<=days;d++) if(_sched[gk(idx,d)]) c++; return c; }
  function _countArea(idx,aId){ let c=0; for(let d=1;d<=days;d++) if(_sched[gk(idx,d)]===aId) c++; return c; }

  // Başlık
  document.getElementById('apName').textContent = ast.name;
  const kidemEl = document.getElementById('apKidem');
  kidemEl.textContent = 'K'+ast.kidem;
  kidemEl.className = 'kt '+KIDEM_CLS[ast.kidem];
  document.getElementById('apMonthLbl').textContent = MONTHS[mo]+' '+y;
  // Başasistana izin legend'ını göster
  const izinLeg = document.getElementById('izinLegend');
  const limitInfo = document.getElementById('tercihLimitInfo');
  if(izinLeg) izinLeg.style.display = window.ACILX_ROLE==='basasistan' ? '' : 'none';
  if(limitInfo) limitInfo.style.display = window.ACILX_ROLE==='basasistan' ? 'none' : '';
  const badgeEl = document.getElementById('apIdxBadge');
  if(badgeEl) badgeEl.textContent = (i+1)+'/'+ASSISTANTS.length;

  const hedef = _hesaplaHedef(i);
  const toplam = _countAll(i);
  const _prof = S.astProfiles&&S.astProfiles[i]?S.astProfiles[i]:{};
  const _durum = _prof.durum||'aktif';
  const _DLBL={'aktif':'Aktif','izinli':'İzinli','rot_evet':'Rotasyon (nöbet tutar)','rot_hayir':'Rotasyon (nöbet tutmaz)'};
  const _DCOL={'aktif':'#7DC44A','izinli':'#E87070','rot_evet':'#E8A84E','rot_hayir':'#888'};
  const _SLBL={'24h':'24s','08-20':'08-20','20-08':'20-08','08-16':'08-16','16-24':'16-24','00-08':'00-08'};
  const _siftler=(_prof.siftler&&_prof.siftler.length)?_prof.siftler:[_prof.sift||'24h'];
  const _siftStr=_siftler.map(s=>_SLBL[s]||s).join(', ');
  const _tercihStr=((_prof.tercihGunler||[]).map(g=>['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'][g]).join(', '))||'—';
  const _kacStr=((_prof.kacGunler||[]).map(g=>['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'][g]).join(', '))||'—';
  const _moKey2=y+'_'+mo;
  const _tAyl=((_prof.tercihAylik&&_prof.tercihAylik[_moKey2])||[]).length;
  const _kAyl=((_prof.kacAylik&&_prof.kacAylik[_moKey2])||[]).length;
  const _iAyl=((_prof.izinliAylik&&_prof.izinliAylik[_moKey2])||[]).length;
  // Sonraki nöbet hesapla
  var _sonrakiNobet = '';
  if(isCurrent){
    var _bugun = new Date();
    var _bugunD = _bugun.getDate();
    for(var _nd = _bugunD; _nd <= days; _nd++){
      if(_sched[gk(i,_nd)]){
        var _nAlan = AREAS.find(function(a){return a.id===_sched[gk(i,_nd)];});
        _sonrakiNobet = '&nbsp;&nbsp;<span style="font-size:11px;padding:2px 7px;border-radius:4px;background:rgba(232,87,42,0.1);color:var(--red);font-weight:700">Sonraki: '+_nd+' '+MONTHS[mo]+(_nAlan?' · '+_nAlan.name:'')+'</span>';
        break;
      }
    }
  }
  document.getElementById('apMeta').innerHTML =
    '<span style="padding:2px 7px;border-radius:4px;font-size:11px;font-weight:600;background:'+_DCOL[_durum]+'22;color:'+_DCOL[_durum]+'">'+_DLBL[_durum]+'</span>' +
    '&nbsp;<span style="font-size:11px;color:var(--w4);background:var(--bg4);padding:2px 6px;border-radius:4px">⏱ '+_siftStr+'</span>' +
    '&nbsp;&nbsp;Hedef: <strong style="color:var(--w1)">'+hedef+'</strong>' +
    ' &nbsp;·&nbsp; Tamamlanan: <strong style="color:'+(toplam>=hedef?'var(--red)':'#7DC44A')+'">'+toplam+'</strong>' +
    _sonrakiNobet +
    (_tAyl?'&nbsp;&nbsp;<span style="font-size:10px;color:#7DC44A">✓ '+_tAyl+' gün tercih</span>':'') +
    (_kAyl?'&nbsp;<span style="font-size:10px;color:#E87070">✕ '+_kAyl+' gün kaçın</span>':'') +
    (_iAyl?'&nbsp;<span style="font-size:10px;color:#B090E0">⊘ '+_iAyl+' gün izinli</span>':'') +
    (_prof.tercihGunler&&_prof.tercihGunler.length?'&nbsp;<span style="font-size:10px;color:var(--w4)">'+_tercihStr+'</span>':'') +
    (_prof.kacGunler&&_prof.kacGunler.length?'&nbsp;<span style="font-size:10px;color:#E87070">✗ '+_kacStr+'</span>':'');

  // Alan istatistikleri
  let statsHtml = '';
  AREAS.forEach(function(a){
    const cnt = _countArea(i, a.id);
    statsHtml += '<div style="background:var(--bg2);border:1px solid var(--bord);border-radius:6px;padding:8px 10px;text-align:center">'+
      '<div style="font-size:10px;color:var(--w3);margin-bottom:2px">'+a.name+'</div>'+
      '<div style="font-size:20px;font-weight:700;font-family:DM Mono,monospace;color:'+(cnt>0?a.color:'var(--w4)')+'">'+cnt+'</div>'+
      '</div>';
  });
  document.getElementById('apStats').innerHTML = statsHtml;

  // ── TAKVİM GRID ──
  const firstDOW = getDOW(y, mo, 1);
  let calHtml = '';
  const moKey2 = y+'_'+mo;
  const _tercihAylik = (ast && S.astProfiles&&S.astProfiles[i]&&S.astProfiles[i].tercihAylik&&S.astProfiles[i].tercihAylik[moKey2])||[];
  const _kacAylik    = (ast && S.astProfiles&&S.astProfiles[i]&&S.astProfiles[i].kacAylik   &&S.astProfiles[i].kacAylik[moKey2]   )||[];
  const _izinliAylik = (ast && S.astProfiles&&S.astProfiles[i]&&S.astProfiles[i].izinliAylik&&S.astProfiles[i].izinliAylik[moKey2])||[];

  for(let blank=0; blank<firstDOW; blank++){
    calHtml += '<div style="aspect-ratio:1/1"></div>';
  }

  for(let d=1; d<=days; d++){
    const alanId = _sched[gk(i,d)];
    const alan = alanId ? AREAS.find(a=>a.id===alanId) : null;
    const dw = getDOW(y,mo,d);
    const isToday = y===todayY&&mo===todayM&&d===todayD;
    const egt = getEgtStatus(y,mo,d,ast.kidem);
    const egtFull = egt&&egt.type==='full';
    const isTercih = _tercihAylik.includes(d);
    const isKac    = _kacAylik.includes(d);
    const isIzinli = _izinliAylik.includes(d);
    const cellOpacity = (egtFull&&!alan) ? '0.4' : '1';

    let cellBg = alan        ? 'rgba(50,130,220,0.22)'
               : isToday     ? 'rgba(232,87,42,0.12)'
               : isTercih    ? 'rgba(100,200,80,0.10)'
               : isKac       ? 'rgba(220,80,60,0.10)'
               : isIzinli    ? 'rgba(150,100,220,0.10)'
               : 'var(--bg2)';
    let cellBorder = alan     ? '2px solid rgba(50,130,220,0.7)'
                   : isToday  ? '1.5px solid var(--red)'
                   : isTercih ? '1px solid rgba(100,200,80,0.45)'
                   : isKac    ? '1px solid rgba(220,80,60,0.45)'
                   : isIzinli ? '1px solid rgba(150,100,220,0.35)'
                   : '1px solid var(--bord)';

    // Tercih butonu — asistanda sadece tercih dönemi açıksa göster
    const isBasasistanLocal = window.ACILX_ROLE === 'basasistan';
    const _canTercih = isBasasistanLocal || (window._tercihAcik && window._tercihAy &&
      window._tercihAy.y === y && window._tercihAy.m === mo);
    const _showTercihBtn = _canTercih && !alan;
    const _tbBg = isIzinli ? 'rgba(150,100,220,0.22);color:#B090E0'
                : isTercih ? 'rgba(100,200,80,0.22);color:#7DC44A'
                : isKac    ? 'rgba(200,80,80,0.22);color:#E87070'
                : 'rgba(255,255,255,0.06);color:var(--w4)';
    const _tbLbl = isIzinli ? '⊘' : isTercih ? '✓' : isKac ? '✕' : '·';
    const _tercihBtn = _showTercihBtn
      ? '<button data-td="'+d+'" onclick="event.stopPropagation();toggleTercihAylik('+i+',parseInt(this.dataset.td))"'+
        ' style="position:absolute;top:2px;right:3px;font-size:9px;padding:1px 4px;border-radius:2px;border:none;cursor:pointer;line-height:1.4;background:'+_tbBg+'"'+
        '>'+_tbLbl+'</button>'
      : (isTercih||isKac||isIzinli
          ? '<span style="position:absolute;top:2px;right:3px;font-size:9px;opacity:.6">'+_tbLbl+'</span>'
          : '');

    // Nöbet kaldır butonu — sadece başasistan
    const _removeBtn = ''; // Nöbet çıkarma sadece takvimden yapılır

    calHtml += '<div onclick="apCalClick('+d+')" style="'+
      'background:'+cellBg+';border:'+cellBorder+';'+
      'border-radius:5px;aspect-ratio:1/1;padding:5px 5px 3px;cursor:pointer;'+
      'opacity:'+cellOpacity+';position:relative;overflow:hidden;display:flex;flex-direction:column">'+
      _tercihBtn+
      _removeBtn+
      '<div style="font-size:10px;font-weight:700;color:'+(isToday?'var(--red)':alan?'rgba(80,160,255,0.95)':'var(--w2)')+'">'+d+'</div>'+
      (alan
        ? '<div style="margin-top:2px;font-size:8px;font-weight:700;padding:1px 3px;border-radius:2px;background:rgba(50,130,220,0.18);color:rgba(80,160,255,0.9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1">'+getAreaLabel(alan.id)+'</div>'
        : ''
      )+
      '</div>';
  }

  document.getElementById('apCalGrid').innerHTML = calHtml;

  // Tercih sayacı güncelle
  const sayacEl = document.getElementById('apTercihSayac');
  if(sayacEl){
    const tSay = _tercihAylik.length, kSay = _kacAylik.length, iSay = _izinliAylik.length;
    if(window.ACILX_ROLE === 'basasistan'){
      sayacEl.innerHTML =
        `<span style="color:#80B840">✓ ${tSay}</span>` +
        ' &nbsp;' +
        `<span style="color:var(--red)">✕ ${kSay}</span>` +
        (iSay>0 ? ` &nbsp;<span style="color:#B090E0">⊘ ${iSay}</span>` : '');
    } else {
      sayacEl.innerHTML =
        `<span style="color:${tSay>=3?'var(--orange)':'#80B840'}">✓ ${tSay}/3</span>` +
        ' &nbsp;' +
        `<span style="color:${kSay>=3?'var(--orange)':'var(--red)'}">✕ ${kSay}/3</span>`;
    }
  }  // Nöbet ekle — dropdown güncelle
  const daysSel = document.getElementById('apAddDay');
  daysSel.innerHTML = '';
  const _apMoKey2 = y+'_'+mo;
  const _apIzinli = ((S.astProfiles&&S.astProfiles[i]&&S.astProfiles[i].izinliAylik)||{})[_apMoKey2]||[];
  const _apDur = (S.astProfiles&&S.astProfiles[i]&&S.astProfiles[i].durum)||'aktif';
  for(let d=1; d<=days; d++){
    if(S.schedule[gk(i,d)]) continue;
    if(_apDur==='izinli'||_apDur==='rot_hayir') continue; // izinli asistana gün gösterme
    if(_apIzinli.includes(d)) continue;                   // izinli güne ekleme yapılamaz
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d+' '+DAYS_TR[getDOW(y,mo,d)];
    daysSel.appendChild(opt);
  }
  if(daysSel.options.length===0) daysSel.innerHTML='<option value="">Müsait gün yok</option>';

  const areaSel = document.getElementById('apAddArea');
  areaSel.innerHTML = '<option value="">— Alan seçin —</option>';
  AREAS.forEach(function(a){ const o=document.createElement('option'); o.value=a.id; o.textContent=a.name; areaSel.appendChild(o); });
}

function apCalClick(d){
  const i = _apIdx;
  const alanId = S.schedule[gk(i,d)];
  if(alanId){
    apOpenDayDetail(d, alanId);
  } else {
    const isBasasistan = window.ACILX_ROLE === 'basasistan';
    const _m = (_apMonth && _apMonth.y) ? _apMonth : S.currentDate;
    const tercihAyOk = isBasasistan || (window._tercihAcik &&
      window._tercihAy && window._tercihAy.y===_m.y && window._tercihAy.m===_m.m);
    if(tercihAyOk) toggleTercihAylik(i,d);
  }
}

function apRemoveShift(d){
  if(window.ACILX_ROLE !== 'basasistan') return;
  delete S.schedule[gk(_apIdx,d)];
  save();
  _renderAstProfile();
  renderNewCal(); renderTakStats(); renderUyarilar();
  if(_newView===1) renderAsstList();
}

/* ── TAKAS MOTORU ── */
// A asistanı dA gününü, B asistanı dB gününü takas etmek istiyor
// Tüm kuralları kontrol eder: kıdem, kota, art arda, eğitim
function takasMumkunMu(iA, dA, alanA, iB, dB, alanB){
  const _m = (_apMonth && _apMonth.y) ? _apMonth : S.currentDate;
  const y = _m.y, mo = _m.m;
  const days = daysInMonth(y, mo);
  const astA = ASSISTANTS[iA], astB = ASSISTANTS[iB];
  const moKey = y+'_'+mo;

  // 0) İzin kontrolü — izinli asistanlar takas edemez
  const profA = (S.astProfiles&&S.astProfiles[iA])||{};
  const profB = (S.astProfiles&&S.astProfiles[iB])||{};
  const durA = profA.durum||'aktif';
  const durB = profB.durum||'aktif';
  if(durA==='izinli'||durA==='rot_hayir') return {ok:false, reason:astA.name+' izinli/rotasyon dışı'};
  if(durB==='izinli'||durB==='rot_hayir') return {ok:false, reason:astB.name+' izinli/rotasyon dışı'};
  const izinA = ((profA.izinliAylik)||{})[moKey]||[];
  const izinB = ((profB.izinliAylik)||{})[moKey]||[];
  // A, dB gününde izinliyse oraya gidemez
  if(izinA.includes(dB)) return {ok:false, reason:astA.name+' '+dB+'. gün izinli'};
  // B, dA gününde izinliyse oraya gidemez
  if(izinB.includes(dA)) return {ok:false, reason:astB.name+' '+dA+'. gün izinli'};

  // 1) Kıdem uyumu: A → alanB, B → alanA girebilmeli
  if(((S.quota[alanB]||{})[astA.kidem]||0) === 0) return {ok:false, reason:'Kıdem uyumsuz ('+astA.name+' → '+AREAS.find(a=>a.id===alanB)?.name+')'};
  if(((S.quota[alanA]||{})[astB.kidem]||0) === 0) return {ok:false, reason:'Kıdem uyumsuz ('+astB.name+' → '+AREAS.find(a=>a.id===alanA)?.name+')'};

  // 2) Art arda nöbet kontrolü — takas sonrası durumu simüle et
  // Geçici schedule kopyası
  const tmpSched = Object.assign({}, S.schedule);
  delete tmpSched[gk(iA,dA)];
  delete tmpSched[gk(iB,dB)];
  tmpSched[gk(iA,dB)] = alanB;
  tmpSched[gk(iB,dA)] = alanA;

  function artArda(idx, gun){
    const prev = gun > 1 ? tmpSched[gk(idx,gun-1)] : (gun===1 ? (S.prevMonthLastDay&&S.prevMonthLastDay[idx]) : null);
    const next = gun < days ? tmpSched[gk(idx,gun+1)] : (gun===days ? (S.nextMonthFirstDay&&S.nextMonthFirstDay[idx]) : null);
    return (prev && tmpSched[gk(idx,gun)]) || (next && tmpSched[gk(idx,gun)]);
  }

  if(dA !== dB){
    // Farklı gün takası: art arda kontrol gerekli
    if(artArda(iA, dB)) return {ok:false, reason:astA.name+' → '+dB+'. gün art arda nöbet oluşuyor'};
    if(artArda(iB, dA)) return {ok:false, reason:astB.name+' → '+dA+'. gün art arda nöbet oluşuyor'};
    // Farklı gün takasında alan aynı olmalı (istatistik koruması)
    if(alanA !== alanB) return {ok:false, reason:'Farklı gün takasında aynı alan olmalı'};
  }
  // Aynı gün takasında (alan değişimi) art arda kontrolü gerekmez — gün değişmiyor

  // 4) Takas sonrası günlük minimum doluluk kontrolü
  const checkDays = dA===dB ? [dA] : [dA, dB];
  for(const checkDay of checkDays){
    for(let ai=0; ai<AREAS.length; ai++){
      const aObj = AREAS[ai];
      const rule = getDayRule(checkDay, aObj.id);
      if(!rule.aktif || rule.min===0) continue;
      const cnt = ASSISTANTS.filter(function(_,ci){
        return tmpSched[gk(ci,checkDay)] === aObj.id;
      }).length;
      if(cnt < rule.min){
        return {ok:false, reason: checkDay+'. gün '+aObj.name+' minimumu karşılanmıyor ('+cnt+'/'+rule.min+')'};
      }
    }
  }

  // 5) Kıdem kuralı kontrolü — takas sonrası yalnız tutamaz ihlali oluşuyor mu?
  // tmpSched üzerinden geçici kontrol — S.schedule'ı geçici olarak swap et
  const origSched={};
  for(const checkDay of checkDays){
    for(let ci=0;ci<ASSISTANTS.length;ci++){
      const key=gk(ci,checkDay);
      origSched[key]=S.schedule[key];
      S.schedule[key]=tmpSched[key];
    }
  }
  let kidemHata=null;
  for(const checkDay of checkDays){
    for(const aObj of AREAS){
      const ih=kidemKuralIhlali(checkDay,aObj.id);
      if(ih.length>0){
        kidemHata={ok:false, reason:checkDay+'. gün '+aObj.name+': '+ih[0].msg};
        break;
      }
    }
    if(kidemHata) break;
  }
  // Schedule'ı geri al
  Object.keys(origSched).forEach(key=>{ if(origSched[key]===undefined) delete S.schedule[key]; else S.schedule[key]=origSched[key]; });
  if(kidemHata) return kidemHata;

  return {ok:true};
}

// O asistanın tüm nöbetleri için takas edilebilecek diğer asistan+gün çiftlerini bul
function takasListesiBul(iA){
  const y = _apMonth.y, mo = _apMonth.m;
  const days = daysInMonth(y, mo);
  const sonuclar = [];

  for(let dA=1; dA<=days; dA++){
    const alanA = S.schedule[gk(iA,dA)];
    if(!alanA) continue;

    const eslesmeler = [];
    for(let iB=0; iB<ASSISTANTS.length; iB++){
      if(iB===iA) continue;
      const _tkProf=(S.astProfiles&&S.astProfiles[iB])||{};
      const _tkDur=_tkProf.durum||'aktif';
      if(_tkDur==='izinli'||_tkDur==='rot_hayir') continue;
      const _tkMoKey=y+'_'+mo;
      const _tkIzin=((_tkProf.izinliAylik)||{})[_tkMoKey]||[];
      // iB, dA gününde izinliyse bu asistanla takas yapılamaz (B → dA'ya gidemez)
      if(_tkIzin.includes(dA)) continue;
      for(let dB=1; dB<=days; dB++){
        const alanB = S.schedule[gk(iB,dB)];
        if(!alanB) continue;
        // Aynı gün takas anlamsız
        if(dA===dB) continue;
        // A o günde zaten nöbetçiyse takas edemez
        if(S.schedule[gk(iA,dB)]) continue;
        // B o günde (dA) zaten nöbetçiyse takas edemez
        if(S.schedule[gk(iB,dA)]) continue;
        const check = takasMumkunMu(iA, dA, alanA, iB, dB, alanB);
        if(check.ok) eslesmeler.push({iB, dB, alanB});
      }
    }
    if(eslesmeler.length > 0) sonuclar.push({dA, alanA, eslesmeler});
  }
  return sonuclar;
}

function applyTakas(iA, dA, alanA, iB, dB, alanB){
  if(window.ACILX_ROLE!=='basasistan') return;
  // Takas öncesi izin + art arda kontrolü (mevcut atamaları geçici silerek kontrol et)
  const _tmpA=S.schedule[gk(iA,dA)]; const _tmpB=S.schedule[gk(iB,dB)];
  delete S.schedule[gk(iA,dA)]; delete S.schedule[gk(iB,dB)];
  const engelA=_nobetYazilamaz(iA,dB); const engelB=_nobetYazilamaz(iB,dA);
  S.schedule[gk(iA,dA)]=_tmpA; S.schedule[gk(iB,dB)]=_tmpB; // geri al
  if(engelA){ showToast(engelA); return; }
  if(engelB){ showToast(engelB); return; }
  // A → B'nin gün+alanına, B → A'nın gün+alanına
  delete S.schedule[gk(iA,dA)];
  delete S.schedule[gk(iB,dB)];
  S.schedule[gk(iA,dB)] = alanB;  // A, B'nin alanına gider
  S.schedule[gk(iB,dA)] = alanA;  // B, A'nın alanına gider
  save();
  // TÜM ekranı canlı güncelle
  renderNewCal(); renderTakStats(); renderUyarilar();
  if(_newView===1) renderAsstList();
  if(typeof _renderAstProfile==='function') _renderAstProfile();
  apOpenDayDetail(dB, alanB);
}

function apAddShift(){
  const d = parseInt(document.getElementById('apAddDay').value);
  const alanId = document.getElementById('apAddArea').value;
  if(!d||!alanId){ alert('Gün ve alan seçin.'); return; }
  // Merkezi izin + art arda kontrolü
  const _apEngel=_nobetYazilamaz(_apIdx,d);
  if(_apEngel){ showToast(_apEngel); return; }
  if(_maxNobetAsildimi(_apIdx)){
    showToast(ASSISTANTS[_apIdx].name+' max nöbet sayısına ulaştı — eklenemez');
    return;
  }
  S.schedule[gk(_apIdx,d)] = alanId;
  save();
  renderNewCal(); renderTakStats(); renderUyarilar();
  if(_newView===1) renderAsstList();
  if(typeof _renderAstProfile==='function') _renderAstProfile();
}

function apOpenDayDetail(d, myAlanId){
  const i = _apIdx, ast = ASSISTANTS[i];
  const y = _apMonth.y, mo = _apMonth.m;
  const dw = getDOW(y,mo,d);
  const myAlan = AREAS.find(a=>a.id===myAlanId);

  const colleagues = ASSISTANTS.map(function(ca,ci){
    if(ci===i) return null;
    if(S.schedule[gk(ci,d)]!==myAlanId) return null;
    return ca;
  }).filter(Boolean);

  const others = ASSISTANTS.map(function(ca,ci){
    if(ci===i) return null;
    const aId = S.schedule[gk(ci,d)];
    if(!aId) return null;
    return {ast:ca, alan:AREAS.find(a=>a.id===aId)};
  }).filter(Boolean);

  // Takas eşleşmelerini bul (sadece bu gün için)
  const takaslar = [];
  const days2 = daysInMonth(y,mo);
  for(let iB=0;iB<ASSISTANTS.length;iB++){
    if(iB===i) continue;
    for(let dB=1;dB<=days2;dB++){
      const alanB = S.schedule[gk(iB,dB)];
      if(!alanB) continue;
      // A zaten o günde nöbetçiyse takas yapamaz
      if(S.schedule[gk(i,dB)]) continue;
      // B zaten o günde (dA) nöbetçiyse takas yapamaz
      if(S.schedule[gk(iB,d)]) continue;
      const chk = takasMumkunMu(i,d,myAlanId,iB,dB,alanB);
      if(chk.ok) takaslar.push({iB,dB,alanB,astB:ASSISTANTS[iB],alanBObj:AREAS.find(a=>a.id===alanB)});
    }
  }

  let html = '';
  // Başlık
  html += '<div style="font-size:13px;font-weight:700;color:var(--w1);margin-bottom:3px">'+d+' '+MONTHS[mo]+' — '+DAYS_TR[dw]+'</div>';
  html += '<div style="font-size:11px;color:var(--w3);margin-bottom:10px">'+ast.name+(myAlan?' · <span style="color:'+myAlan.color+'">'+myAlan.name+'</span>':'')+'</div>';

  // Aynı alandakiler
  html += '<div style="font-size:10px;font-weight:600;color:var(--w3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px">'+(myAlan?myAlan.name:'')+' — Birlikte</div>';
  if(colleagues.length===0){
    html += '<div style="font-size:11px;color:var(--w4);padding:2px 0 8px">Tek başına.</div>';
  } else {
    html += '<div style="margin-bottom:10px">'+colleagues.map(function(c){
      return '<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid var(--bord)">'+
        '<span class="kt '+KIDEM_CLS[c.kidem]+'" style="font-size:9px;padding:1px 4px">K'+c.kidem+'</span>'+
        '<span style="font-size:12px;font-weight:500;color:var(--w1)">'+c.name+'</span>'+
        '</div>';
    }).join('')+'</div>';
  }

  // Diğer alanlar
  if(others.length>0){
    html += '<div style="font-size:10px;font-weight:600;color:var(--w3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px">Diğer alanlarda</div>';
    html += '<div style="margin-bottom:10px">'+others.map(function(o){
      if(!o.alan) return '';
      return '<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid var(--bord)">'+
        '<span class="kt '+KIDEM_CLS[o.ast.kidem]+'" style="font-size:9px;padding:1px 4px">K'+o.ast.kidem+'</span>'+
        '<span style="font-size:12px;color:var(--w2)">'+o.ast.name+'</span>'+
        '<span style="margin-left:auto;font-size:10px;color:'+o.alan.color+'">'+o.alan.name+'</span>'+
        '</div>';
    }).join('')+'</div>';
  }

  // ── TAKAS LİSTESİ ──
  html += '<div style="border-top:1px solid var(--bord);padding-top:10px;margin-top:4px">';
  html += '<div style="font-size:10px;font-weight:700;color:#E8A84E;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">⇄ Sorunsuz Takas ('+(takaslar.length>0?takaslar.length:'0')+')</div>';
  if(takaslar.length===0){
    html += '<div style="font-size:11px;color:var(--w4)">Bu nöbet için uygun takas yok.</div>';
  } else {
    // İlk 6 takas göster
    const goster = takaslar.slice(0,6);
    html += goster.map(function(t){
      const alanBColor = t.alanBObj?t.alanBObj.color:'var(--w3)';
      const alanBName = t.alanBObj?t.alanBObj.name:'?';
      return '<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid var(--bord)">'+
        '<span class="kt '+KIDEM_CLS[t.astB.kidem]+'" style="font-size:9px;padding:1px 4px">K'+t.astB.kidem+'</span>'+
        '<div style="flex:1;min-width:0">'+
          '<span style="font-size:11px;font-weight:600;color:var(--w1)">'+t.astB.name+'</span>'+
          '<span style="font-size:10px;color:var(--w3)"> · '+t.dB+'. gün</span>'+
          '<span style="font-size:10px;margin-left:4px;color:'+alanBColor+'">'+alanBName+'</span>'+
        '</div>'+
        '<button data-ia="'+i+'" data-da="'+d+'" data-alana="'+myAlanId+'" data-ib="'+t.iB+'" data-db="'+t.dB+'" data-alanb="'+t.alanB+'"'+
        ' onclick="applyTakasBtn(this)"'+
        ' style="font-size:10px;padding:3px 8px;border-radius:4px;background:#1A2E10;color:#7DC44A;border:1px solid #2A5010;cursor:pointer;white-space:nowrap">Takas</button>'+
        '</div>';
    }).join('');
    if(takaslar.length>6) html += '<div style="font-size:11px;color:var(--w4);padding:4px 0">+'+( takaslar.length-6)+' daha…</div>';
  }
  html += '</div>';

  document.getElementById('apDayPanel').innerHTML = html;
}

function applyTakasBtn(btn){
  const iA=parseInt(btn.dataset.ia), dA=parseInt(btn.dataset.da), alanA=btn.dataset.alana;
  const iB=parseInt(btn.dataset.ib), dB=parseInt(btn.dataset.db), alanB=btn.dataset.alanb;
  // Butonu geçici olarak devre dışı bırak
  btn.disabled=true; btn.textContent='✓';
  applyTakas(iA,dA,alanA,iB,dB,alanB);
}

let _uyarilarGun = null;
function openUyarilarGun(d){
  _uyarilarGun = d;
  const titleEl = document.getElementById('sorunlarTitle');
  if(titleEl){
    titleEl.textContent = d !== null
      ? d+' '+MONTHS[S.currentDate.m]+' Sorunları'
      : 'Tüm Sorunlar — '+MONTHS[S.currentDate.m]+' '+S.currentDate.y;
  }
  switchTab(document.getElementById('tab-btn-sorunlar'),'sorunlar');
}

/* ═══════════════════════════════════════════════════════════════
   TERCİHLER SEKMESİ
═══════════════════════════════════════════════════════════════ */
var _tercihlerAstIdx = null; // Gösterilen asistan indexi
var _tercihlerMonth = null;  // Tercihler sekmesinde gösterilen ay

function renderTercihler(){
  const isBasasistan = window.ACILX_ROLE === 'basasistan';
  const durEl = document.getElementById('tercihlerDurum');
  const conEl = document.getElementById('tercihlerContent');
  const titleEl = document.getElementById('tercihlerTitle');
  const subEl = document.getElementById('tercihlerSub');
  const tabBtn = document.getElementById('tab-btn-tercihler');
  if(!conEl) return;

  // Sekme adı ve başlık
  if(tabBtn) tabBtn.textContent = isBasasistan ? 'Asistanlar' : 'Tercihlerim';
  if(titleEl) titleEl.textContent = isBasasistan ? 'Asistanlar' : 'Tercihlerim';
  if(subEl) subEl.textContent = isBasasistan ? 'Tüm asistanların tercih, izin ve nöbet bilgileri' : 'Tercih, kaçınma ve izin günlerin';

  if(!_tercihlerMonth) _tercihlerMonth = {y:S.currentDate.y, m:S.currentDate.m};
  const {y,m} = _tercihlerMonth;
  const moKey = y+'_'+m;
  const days = daysInMonth(y,m);

  const tercihAcik = !!window._tercihAcik;
  const tercihAyMatch = window._tercihAy && window._tercihAy.y===y && window._tercihAy.m===m;
  const canEdit = isBasasistan || (tercihAcik && tercihAyMatch);

  // Durum banneri
  if(isBasasistan){
    durEl.innerHTML = tercihAcik
      ? '<div style="background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.2);border-radius:8px;padding:10px 14px;font-size:12px;color:#4ade80;display:flex;align-items:center;gap:8px"><span style="font-size:16px">📋</span> Tercih dönemi açık — asistanlar tercihlerini girebilir.</div>'
      : '<div style="background:var(--bg3);border:1px solid var(--bord);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--w3);display:flex;align-items:center;gap:8px"><span style="font-size:16px">🔒</span> Tercih dönemi kapalı. Asistanlar düzenleyemez.</div>';
  } else {
    durEl.innerHTML = canEdit
      ? '<div style="background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.2);border-radius:8px;padding:10px 14px;font-size:12px;color:#4ade80;display:flex;align-items:center;gap:8px"><span style="font-size:16px">📋</span> Tercih dönemi açık — günlere tıklayarak tercihini belirle.</div>'
      : '<div style="background:var(--bg3);border:1px solid var(--bord);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--w3);display:flex;align-items:center;gap:8px"><span style="font-size:16px">🔒</span> Tercih dönemi kapalı — sadece görüntüleyebilirsin.</div>';
  }

  if(isBasasistan){
    if(_tercihlerAstIdx===null && ASSISTANTS.length>0) _tercihlerAstIdx=0;
  } else {
    _tercihlerAstIdx = window._myAstIdx !== undefined ? window._myAstIdx : null;
  }

  if(_tercihlerAstIdx===null || !ASSISTANTS[_tercihlerAstIdx]){
    conEl.innerHTML = '<div style="text-align:center;color:var(--w4);padding:40px 0;font-size:13px">'+(isBasasistan?'Asistan bulunamadı.':'Asistan profili bulunamadı.')+'</div>';
    return;
  }

  _renderTercihlerEkran(conEl, _tercihlerAstIdx, y, m, moKey, days, canEdit);
}

/* ── Tek ekran asistan görünümü (başasistan + asistan ortak) ── */
function _renderTercihlerEkran(conEl, astIdx, y, m, moKey, days, canEdit){
  const isBasasistan = window.ACILX_ROLE === 'basasistan';
  const ast = ASSISTANTS[astIdx];
  if(!ast){
    conEl.innerHTML = '<div style="text-align:center;color:var(--w4);padding:40px 0;font-size:13px">Asistan bulunamadı.</div>';
    return;
  }

  if(!S.astProfiles) S.astProfiles={};
  if(!S.astProfiles[astIdx]) S.astProfiles[astIdx]={};
  const prof = S.astProfiles[astIdx];
  if(!prof.tercihAylik) prof.tercihAylik={};
  if(!prof.kacAylik) prof.kacAylik={};
  if(!prof.izinliAylik) prof.izinliAylik={};
  if(!prof.tercihAylik[moKey]) prof.tercihAylik[moKey]=[];
  if(!prof.kacAylik[moKey]) prof.kacAylik[moKey]=[];
  if(!prof.izinliAylik[moKey]) prof.izinliAylik[moKey]=[];

  const tArr = prof.tercihAylik[moKey];
  const kArr = prof.kacAylik[moKey];
  const iArr = prof.izinliAylik[moKey];

  // Nöbet verileri hesapla — sadece S.currentDate ayıyla eşleşiyorsa
  const isCurrentMonth = (y===S.currentDate.y && m===S.currentDate.m);
  const hedef = isCurrentMonth ? _hesaplaHedef(astIdx) : 0;
  let mevcut=0;
  const nobetMap={}; // gün → {aId, alan, color}
  const alanSayim={};
  if(isCurrentMonth){
    for(let d=1;d<=days;d++){
      const aId=S.schedule[gk(astIdx,d)];
      if(aId){
        mevcut++;
        const ar=AREAS.find(a=>a.id===aId);
        nobetMap[d]={aId, alan:ar?ar.name:aId, color:ar?ar.color:'var(--w3)', label:getAreaLabel(aId)};
        if(!alanSayim[aId]) alanSayim[aId]=0;
        alanSayim[aId]++;
      }
    }
  }
  const fark = mevcut - hedef;

  let html = '';

  // ── Asistan navigasyonu (başasistan: ok butonları, asistan: sadece ad) ──
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding:8px 0;border-bottom:1px solid var(--bord)">';
  if(isBasasistan){
    html += '<button onclick="_tercihlerNav(-1)" style="background:none;border:1px solid var(--bord);border-radius:6px;padding:5px 14px;color:var(--w2);cursor:pointer;font-size:13px;font-family:var(--font-sans)">← Önceki</button>';
  } else {
    html += '<div></div>';
  }
  html += '<div style="text-align:center">';
  html += '<div style="font-size:15px;font-weight:700;color:var(--w1)">'+_esc(ast.name)+'</div>';
  html += '<div style="font-size:11px;color:var(--w3)">Kıdem '+ast.kidem;
  if(isBasasistan) html += ' · '+(astIdx+1)+'/'+ASSISTANTS.length;
  html += '</div>';
  html += '</div>';
  if(isBasasistan){
    html += '<button onclick="_tercihlerNav(1)" style="background:none;border:1px solid var(--bord);border-radius:6px;padding:5px 14px;color:var(--w2);cursor:pointer;font-size:13px;font-family:var(--font-sans)">Sonraki →</button>';
  } else {
    html += '<div></div>';
  }
  html += '</div>';

  // ── Özet istatistik şeridi ──
  html += '<div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">';
  html += '<div style="flex:1;min-width:80px;background:var(--bg3);border:1px solid var(--bord);border-radius:8px;padding:10px 12px;text-align:center">';
  html += '<div style="font-size:20px;font-weight:700;color:'+(fark===0?'#4ade80':fark>0?'var(--orange)':'#E87070')+'">'+mevcut+'<span style="font-size:13px;color:var(--w3)"> / '+hedef+'</span></div>';
  html += '<div style="font-size:10px;color:var(--w3);margin-top:2px">Nöbet / Hedef</div>';
  html += '</div>';
  html += '<div style="flex:1;min-width:60px;background:var(--bg3);border:1px solid var(--bord);border-radius:8px;padding:10px 12px;text-align:center">';
  html += '<div style="font-size:20px;font-weight:700;color:'+(fark===0?'#4ade80':fark>0?'var(--orange)':'#E87070')+'">'+(fark>0?'+':'')+fark+'</div>';
  html += '<div style="font-size:10px;color:var(--w3);margin-top:2px">Fark</div>';
  html += '</div>';
  if(tArr.length||kArr.length||iArr.length){
    html += '<div style="flex:1;min-width:80px;background:var(--bg3);border:1px solid var(--bord);border-radius:8px;padding:10px 12px;text-align:center">';
    html += '<div style="font-size:13px;font-weight:600">';
    if(tArr.length) html += '<span style="color:#80B840">'+tArr.length+'T</span> ';
    if(kArr.length) html += '<span style="color:#E87070">'+kArr.length+'K</span> ';
    if(iArr.length) html += '<span style="color:#B090E0">'+iArr.length+'İ</span>';
    html += '</div>';
    html += '<div style="font-size:10px;color:var(--w3);margin-top:2px">Tercih / Kaçın / İzin</div>';
    html += '</div>';
  }
  html += '</div>';

  // ── Ay navigasyonu ──
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding:4px 0">';
  html += '<button onclick="_tercihlerAyGec(-1)" style="background:none;border:1px solid var(--bord);border-radius:6px;padding:4px 10px;color:var(--w2);cursor:pointer;font-size:14px">◀</button>';
  html += '<span style="font-size:14px;font-weight:700;color:var(--w1);font-family:\'DM Mono\',monospace">'+MONTHS[m]+' '+y+'</span>';
  html += '<button onclick="_tercihlerAyGec(1)" style="background:none;border:1px solid var(--bord);border-radius:6px;padding:4px 10px;color:var(--w2);cursor:pointer;font-size:14px">▶</button>';
  html += '</div>';

  // ── Aylık takvim — nöbet günleri alan rengiyle ──
  const firstDow = new Date(y,m,1).getDay();
  const calOffset = firstDow===0?6:firstDow-1;
  html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:14px">';
  ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'].forEach(g=>{
    html += '<div style="text-align:center;font-size:10px;color:var(--w4);padding:4px 0;font-weight:600">'+g+'</div>';
  });
  for(let i=0;i<calOffset;i++) html += '<div></div>';
  for(let d=1;d<=days;d++){
    const nb = nobetMap[d];
    const isIzin = iArr.includes(d);
    const isTercih = tArr.includes(d);
    const isKac = kArr.includes(d);
    const dow = new Date(y,m,d).getDay();
    const isWeekend = dow===0||dow===6;

    let bg='var(--bg3)', brd='var(--bord)', clr='var(--w2)';
    let topLabel='', botLabel='';

    if(nb){
      // Nöbet günü — alan rengiyle göster
      bg=nb.color+'18'; brd=nb.color+'60'; clr=nb.color;
      topLabel='<div style="font-size:9px;font-weight:700;color:'+nb.color+';margin-top:1px">'+_esc(nb.label)+'</div>';
    } else if(isIzin){
      bg='rgba(176,144,224,0.12)'; brd='rgba(176,144,224,0.4)'; clr='#B090E0';
      topLabel='<div style="font-size:9px;color:#B090E0;margin-top:1px">İzin</div>';
    }

    // Tercih/kaçınma işaretleri (küçük nokta)
    if(isTercih) botLabel='<div style="width:5px;height:5px;border-radius:50%;background:#80B840;margin:1px auto 0"></div>';
    else if(isKac) botLabel='<div style="width:5px;height:5px;border-radius:50%;background:#E87070;margin:1px auto 0"></div>';

    const click = canEdit ? 'onclick="_tercihlerToggle('+astIdx+','+d+')"' : '';
    html += '<div '+click+' style="text-align:center;padding:4px 2px;border-radius:6px;background:'+bg+';border:1px solid '+brd+';'+(canEdit?'cursor:pointer;':'')+(isWeekend&&!nb&&!isIzin?'color:var(--w4);':'')+';min-height:38px;display:flex;flex-direction:column;align-items:center;justify-content:center">';
    html += '<div style="font-size:12px;font-weight:600;color:'+clr+'">'+d+'</div>';
    html += topLabel;
    html += botLabel;
    html += '</div>';
  }
  html += '</div>';

  // Legend
  html += '<div style="display:flex;gap:10px;margin-bottom:14px;font-size:10px;flex-wrap:wrap;color:var(--w3)">';
  html += '<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#80B840;vertical-align:middle"></span> Tercih</span>';
  html += '<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#E87070;vertical-align:middle"></span> Kaçın</span>';
  html += '<span><span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:rgba(176,144,224,0.3);border:1px solid rgba(176,144,224,0.5);vertical-align:middle"></span> İzin</span>';
  AREAS.forEach(a=>{
    html += '<span><span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:'+a.color+'30;border:1px solid '+a.color+'80;vertical-align:middle"></span> '+_esc(getAreaLabel(a.id))+'</span>';
  });
  if(canEdit) html += '<span style="color:var(--w4)">(Günlere tıkla: boş→tercih→kaçın'+(isBasasistan?'→izin':'')+'→temizle)</span>';
  html += '</div>';

  // ── Tercihler bölümü: uygulanma durumu ──
  html += '<div style="background:var(--bg3);border:1px solid var(--bord);border-radius:8px;padding:12px;font-size:12px;margin-bottom:10px">';
  html += '<div style="font-weight:700;color:var(--w1);margin-bottom:8px">Tercihler</div>';

  // Tercih günleri — uygulandı mı?
  if(tArr.length>0){
    html += '<div style="margin-bottom:6px"><span style="color:#80B840;font-weight:600;font-size:11px">Tercih edilen günler:</span></div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">';
    tArr.slice().sort((a,b)=>a-b).forEach(d=>{
      const applied = !!nobetMap[d]; // O gün nöbet atanmış mı?
      html += '<span style="padding:2px 8px;border-radius:4px;font-size:11px;border:1px solid '+(applied?'rgba(74,222,128,0.3)':'var(--bord)')+';background:'+(applied?'rgba(74,222,128,0.08)':'var(--bg2)')+';color:'+(applied?'#4ade80':'var(--w4)')+'">';
      html += (applied?'✓':'✗')+' '+d+'.';
      html += '</span>';
    });
    html += '</div>';
  }

  // Kaçınma günleri — kaçınıldı mı?
  if(kArr.length>0){
    html += '<div style="margin-bottom:6px"><span style="color:#E87070;font-weight:600;font-size:11px">Kaçınılan günler:</span></div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">';
    kArr.slice().sort((a,b)=>a-b).forEach(d=>{
      const avoided = !nobetMap[d]; // O gün nöbet YOK = başarılı kaçınma
      html += '<span style="padding:2px 8px;border-radius:4px;font-size:11px;border:1px solid '+(avoided?'rgba(74,222,128,0.3)':'rgba(232,112,112,0.3)')+';background:'+(avoided?'rgba(74,222,128,0.08)':'rgba(232,112,112,0.08)')+';color:'+(avoided?'#4ade80':'#E87070')+'">';
      html += (avoided?'✓ Kaçınıldı':'✗ Kaçınılamadı')+' '+d+'.';
      html += '</span>';
    });
    html += '</div>';
  }

  // İzin günleri — uygulandı mı?
  if(iArr.length>0){
    html += '<div style="margin-bottom:6px"><span style="color:#B090E0;font-weight:600;font-size:11px">İzin günleri:</span></div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px">';
    iArr.slice().sort((a,b)=>a-b).forEach(d=>{
      const respected = !nobetMap[d]; // İzin gününde nöbet yok = uygulandı
      html += '<span style="padding:2px 8px;border-radius:4px;font-size:11px;border:1px solid '+(respected?'rgba(176,144,224,0.3)':'rgba(232,112,112,0.3)')+';background:'+(respected?'rgba(176,144,224,0.08)':'rgba(232,112,112,0.08)')+';color:'+(respected?'#B090E0':'#E87070')+'">';
      html += (respected?'✓':'✗')+' '+d+'.';
      html += '</span>';
    });
    html += '</div>';
  }

  if(!tArr.length && !kArr.length && !iArr.length){
    html += '<div style="color:var(--w4);font-size:11px">Bu ay için tercih girilmemiş.</div>';
  }
  html += '</div>';

  // ── Alan dağılımı: hedef vs gerçekleşen ──
  html += '<div style="background:var(--bg3);border:1px solid var(--bord);border-radius:8px;padding:12px;font-size:12px">';
  html += '<div style="font-weight:700;color:var(--w1);margin-bottom:8px">Alan Dağılımı</div>';
  html += '<div style="display:flex;flex-wrap:wrap;gap:6px">';
  let hasAlanDetay = false;
  AREAS.forEach(a=>{
    const alanH = (S.quota[a.id]||{})[ast.kidem]||0;
    if(alanH<=0) return;
    hasAlanDetay = true;
    const alanM = alanSayim[a.id]||0;
    const ok = alanM >= alanH;
    html += '<div style="padding:4px 10px;border-radius:6px;border:1px solid '+a.color+'40;background:'+a.color+'10;display:flex;align-items:center;gap:5px">';
    html += '<span style="font-weight:700;color:'+a.color+'">'+_esc(getAreaLabel(a.id))+':</span>';
    html += '<span style="font-weight:600;color:'+(ok?'#4ade80':'#E87070')+'">'+alanM+'/'+alanH+'</span>';
    html += '</div>';
  });
  if(!hasAlanDetay) html += '<div style="color:var(--w4);font-size:11px">Alan kotası tanımlanmamış.</div>';
  html += '</div></div>';

  conEl.innerHTML = html;
}

/* ── Ok butonuyla asistanlar arası gezinme ── */
function _tercihlerNav(delta){
  if(!ASSISTANTS.length) return;
  let idx = (_tercihlerAstIdx !== null ? _tercihlerAstIdx : 0) + delta;
  if(idx<0) idx=ASSISTANTS.length-1;
  if(idx>=ASSISTANTS.length) idx=0;
  _tercihlerAstIdx = idx;
  renderTercihler();
}

function _tercihlerAyGec(delta){
  if(!_tercihlerMonth) _tercihlerMonth={y:S.currentDate.y,m:S.currentDate.m};
  _tercihlerMonth.m += delta;
  if(_tercihlerMonth.m>11){ _tercihlerMonth.m=0; _tercihlerMonth.y++; }
  if(_tercihlerMonth.m<0){ _tercihlerMonth.m=11; _tercihlerMonth.y--; }
  renderTercihler();
}

function _tercihlerToggle(astIdx,d){
  const isBasasistan = window.ACILX_ROLE === 'basasistan';
  if(!isBasasistan && !window._tercihAcik) return;

  if(!S.astProfiles) S.astProfiles={};
  if(!S.astProfiles[astIdx]) S.astProfiles[astIdx]={};
  const p = S.astProfiles[astIdx];
  if(!_tercihlerMonth) _tercihlerMonth={y:S.currentDate.y,m:S.currentDate.m};
  const moKey = _tercihlerMonth.y+'_'+_tercihlerMonth.m;
  if(!p.tercihAylik) p.tercihAylik={};
  if(!p.tercihAylik[moKey]) p.tercihAylik[moKey]=[];
  if(!p.kacAylik) p.kacAylik={};
  if(!p.kacAylik[moKey]) p.kacAylik[moKey]=[];
  if(!p.izinliAylik) p.izinliAylik={};
  if(!p.izinliAylik[moKey]) p.izinliAylik[moKey]=[];

  const tArr=p.tercihAylik[moKey], kArr=p.kacAylik[moKey], iArr=p.izinliAylik[moKey];
  const LIMIT = isBasasistan ? 999 : 3;
  const tIdx=tArr.indexOf(d), kIdx=kArr.indexOf(d), iIdx=iArr.indexOf(d);

  if(isBasasistan){
    if(tIdx>=0){ tArr.splice(tIdx,1); kArr.push(d); }
    else if(kIdx>=0){ kArr.splice(kIdx,1); iArr.push(d); }
    else if(iIdx>=0){ iArr.splice(iIdx,1); }
    else { tArr.push(d); }
  } else {
    if(tIdx>=0){ tArr.splice(tIdx,1); if(kArr.length<LIMIT) kArr.push(d); }
    else if(kIdx>=0){ kArr.splice(kIdx,1); }
    else if(iIdx>=0){ iArr.splice(iIdx,1); }
    else { if(tArr.length>=LIMIT) return; tArr.push(d); }
  }

  save();
  // Firestore kaydet
  if(_db && window.ACILX_UID){
    const uid = isBasasistan ? (ASSISTANTS[astIdx]&&ASSISTANTS[astIdx].uid)||window.ACILX_UID : window.ACILX_UID;
    fsPreferenceRef(uid,_tercihlerMonth.y,_tercihlerMonth.m).set({
      uid: uid,
      tercihGunlerAylik: tArr,
      kacGunlerAylik: kArr,
      izinliGunlerAylik: isBasasistan ? iArr : [],
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(e=>console.warn('Tercih kayıt:',e));
  }
  renderTercihler();
}

function renderUyarilar(){ renderSorunlar(); }
