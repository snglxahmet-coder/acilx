/* ── nobet-rules.js ─────────────────────────────────────────────
   Kıdem kuralları, alan min/max, ihlal tespiti fonksiyonları
   Bağımlılıklar: nobet-core.js (AREAS, S, ASSISTANTS, gk, save, etc.)
   ────────────────────────────────────────────────────────────── */

// Kıdem grubu ihlallerini kontrol et — o gün herhangi bir alanda kıdem grubu karşılanmamışsa döner
function checkKidemGrup(day){
  const viols=[];
  AREAS.forEach(a=>{
    if(!isAlanAktif(day,a.id)) return;
    const cnt=getAreaCount(day,a.id);
    if(cnt===0) return;
    const ih=kidemKuralIhlali(day,a.id);
    ih.forEach(i=>viols.push(a.name+': '+i.msg));
  });
  return viols;
}

function renderEgitim(){}

/* ── ALAN MİNİMUM ── */
function renderMinConf(){
  let html='';
  AREAS.forEach(a=>{
    if(!S.defaultDayMin[a.id]) S.defaultDayMin[a.id]={min:1,max:3,kidemMin:{1:0,2:0,3:0,4:0,5:0},kidemMax:{1:0,2:0,3:0,4:0,5:0},kidemKurallari:{},siftler:['24h']};
    const r=S.defaultDayMin[a.id];
    if(!r.kidemMin) r.kidemMin={1:0,2:0,3:0,4:0,5:0};
    if(!r.kidemMax) r.kidemMax={1:0,2:0,3:0,4:0,5:0};
    if(!r.kidemKurallari) r.kidemKurallari={};
    // Eski veri yapısından migration
    if(r.kidemGruplari&&r.kidemGruplari.length&&!Object.keys(r.kidemKurallari).length){
      migrateKidemKurallari(a.id);
    }

    // ── BÖLÜM 1: Yalnız tutamaz kuralı (her kıdem için) ──
    // Migration: eski yanindaGruplar → yeni yanindaKidemler+enAzKac
    [1,2,3,4,5].forEach(k=>{
      const kural=r.kidemKurallari[k];
      if(!kural) return;
      // Eski yapı migration: yaninda/yanindaGruplar → yanindaKidemler+enAzKac
      if(kural.yanindaGruplar&&kural.yanindaGruplar.length&&!kural.yanindaKidemler){
        const g0=kural.yanindaGruplar[0];
        kural.yanindaKidemler=g0.kidemler||[];
        kural.enAzKac=(g0.kosul==='hepsi'?(g0.kidemler||[]).length:1);
        // Kalan grupları alan bazlı kidemGrupKurallari'na taşı
        if(!r.kidemGrupKurallari) r.kidemGrupKurallari=[];
        for(let gi=1;gi<kural.yanindaGruplar.length;gi++){
          const gg=kural.yanindaGruplar[gi];
          r.kidemGrupKurallari.push({kidemler:gg.kidemler||[],enAzKac:gg.kosul==='hepsi'?(gg.kidemler||[]).length:1});
        }
        delete kural.yanindaGruplar;
        delete kural.yaninda; delete kural.kosul;
        save();
      } else if(kural.yaninda&&kural.yaninda.length&&!kural.yanindaKidemler){
        kural.yanindaKidemler=kural.yaninda;
        kural.enAzKac=1;
        delete kural.yaninda; delete kural.kosul; delete kural.yanindaGruplar;
        save();
      }
    });

    const yalnizTutamazHtml=[1,2,3,4,5].map(k=>{
      const kural=r.kidemKurallari[k]||{yalnizTutamaz:false};
      const yalniz=kural.yalnizTutamaz;
      const yanindaKidemler=kural.yanindaKidemler||[];
      const enAzKac=kural.enAzKac||1;
      let detayHtml='';
      if(yalniz){
        const cbHtml=[1,2,3,4,5].map(k2=>`<label style="display:inline-flex;align-items:center;gap:2px;cursor:pointer">
            <input type="checkbox" ${yanindaKidemler.includes(k2)?'checked':''} style="accent-color:#4ade80"
              onchange="toggleYanindaKidem('${a.id}',${k},${k2},this.checked)">
            <span class="kt ${KIDEM_CLS[k2]}" style="font-size:9px;padding:1px 4px">K${k2}</span>
          </label>`).join('');
        const maxOpt=Math.max(yanindaKidemler.length,1);
        const optHtml=Array.from({length:maxOpt},(_,i)=>i+1).map(n=>`<option value="${n}" ${enAzKac===n?'selected':''}>${n}</option>`).join('');
        detayHtml=`<div style="display:flex;align-items:center;gap:6px;margin-top:6px;padding-top:6px;border-top:1px dashed var(--bord);flex-wrap:wrap">
          <span style="font-size:10px;color:var(--w3)">Yanında:</span>
          ${cbHtml}
          <span style="font-size:10px;color:var(--w3);margin-left:4px">en az</span>
          <select style="font-size:11px;padding:1px 4px;border-radius:4px;border:1px solid var(--bord);background:var(--bg2);color:var(--w2);font-family:var(--font-sans)"
            onchange="setYanindaEnAz('${a.id}',${k},parseInt(this.value))">${optHtml}</select>
          <span style="font-size:10px;color:var(--w3)">kişi</span>
        </div>`;
      }
      return `<div style="background:var(--bg3);border-radius:6px;padding:8px 10px;margin-bottom:4px">
        <div style="display:flex;align-items:center;gap:8px">
          <span class="kt ${KIDEM_CLS[k]}" style="font-size:11px;padding:2px 8px">K${k}</span>
          <label style="display:inline-flex;align-items:center;gap:5px;cursor:pointer;margin-left:auto">
            <span style="font-size:11px;color:${yalniz?'#4ade80':'var(--w4)'}">Yalnız tutamaz</span>
            <input type="checkbox" ${yalniz?'checked':''} style="accent-color:#4ade80"
              onchange="toggleKidemYalniz('${a.id}',${k},this.checked)">
          </label>
        </div>
        ${detayHtml}
      </div>`;
    }).join('');

    // ── BÖLÜM 2: Kıdem grupları (alan bazında) ──
    if(!r.kidemGrupKurallari) r.kidemGrupKurallari=[];
    const grupKurallariHtml=r.kidemGrupKurallari.map((g,gi)=>{
      const cbHtml=[1,2,3,4,5].map(k=>`<label style="display:inline-flex;align-items:center;gap:2px;cursor:pointer">
          <input type="checkbox" ${(g.kidemler||[]).includes(k)?'checked':''} style="accent-color:#60a5fa"
            onchange="toggleKidemGrupKidem('${a.id}',${gi},${k},this.checked)">
          <span class="kt ${KIDEM_CLS[k]}" style="font-size:9px;padding:1px 4px">K${k}</span>
        </label>`).join('');
      const gMin=g.enAzKac||0;
      const gMax=g.enFazlaKac||0;
      // Gruptaki toplam asistan sayısı
      let grupAstSayi=0;
      (g.kidemler||[]).forEach(k=>{grupAstSayi+=ASSISTANTS.filter(ast=>ast.kidem===k).length;});
      const deaktif=gMin===0&&gMax===0;
      const ozet=deaktif?'yazılmaz':'min '+gMin+', max '+gMax+(grupAstSayi>0?' ('+grupAstSayi+' asistan)':'');
      return `<div style="background:var(--bg2);border:1px solid var(--bord);border-radius:5px;padding:6px 8px;margin-bottom:4px;${deaktif?'opacity:.5':''}">
        <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">
          ${cbHtml}
          <button onclick="silKidemGrupKurali('${a.id}',${gi})" style="margin-left:auto;background:none;border:none;color:var(--w4);cursor:pointer;font-size:11px;padding:1px 4px" title="Grubu sil">&#10005;</button>
        </div>
        <div style="display:flex;align-items:center;gap:5px;margin-top:5px;padding-top:5px;border-top:1px dashed var(--bord);flex-wrap:wrap">
          <span style="font-size:10px;font-weight:600;color:var(--w3)">Min</span>
          <div class="ni-wrap"><button class="ni-btn" type="button" onclick="niStep(this,-1)">−</button><input class="ni" type="number" min="0" max="99" value="${gMin}"
            style="width:28px;font-size:11px;font-weight:600;color:${gMin>0?'#4ade80':'var(--w4)'}"
            onchange="setKidemGrupEnAz('${a.id}',${gi},parseInt(this.value)||0)"><button class="ni-btn" type="button" onclick="niStep(this,1)">+</button></div>
          <span style="font-size:10px;font-weight:600;color:var(--w3);margin-left:4px">Max</span>
          <div class="ni-wrap"><button class="ni-btn" type="button" onclick="niStep(this,-1)">−</button><input class="ni" type="number" min="0" max="99" value="${gMax}"
            style="width:28px;font-size:11px;font-weight:600;color:${gMax>0?'var(--acc)':'var(--w4)'}"
            onchange="setKidemGrupEnFazla('${a.id}',${gi},parseInt(this.value)||0)"><button class="ni-btn" type="button" onclick="niStep(this,1)">+</button></div>
          <span style="font-size:10px;color:var(--w3)">kişi</span>
          <span style="font-size:9px;color:var(--w4);margin-left:2px">(${ozet})</span>
        </div>
      </div>`;
    }).join('');

    const kidemKartHtml=`
      <div style="margin-bottom:8px">
        <div style="font-size:11px;font-weight:700;color:var(--w2);margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--bord)">Yalnız Tutamaz Kuralı</div>
        ${yalnizTutamazHtml}
      </div>
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--bord)">
          <span style="font-size:11px;font-weight:700;color:var(--w2)">Kıdem Grupları</span>
          <button onclick="ekleKidemGrupKurali('${a.id}')" style="font-size:9px;padding:2px 8px;border-radius:4px;border:1px solid rgba(96,165,250,0.3);background:rgba(96,165,250,0.06);color:#60a5fa;cursor:pointer;font-family:var(--font-sans)">+ Grup ekle</button>
        </div>
        ${grupKurallariHtml||'<div style="font-size:10px;color:var(--w4);padding:2px 0">Henüz grup eklenmedi</div>'}
      </div>`;

    const advId='alanAdv_'+a.id.replace(/[^a-zA-Z0-9]/g,'_');
    html+=`<div class="eg-card">
      <div class="eg-head">
        <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
          <div style="width:12px;height:12px;border-radius:3px;background:${a.color};flex-shrink:0"></div>
          <strong style="font-size:14px;color:var(--w1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.name}</strong>
          <span style="font-size:12px;color:var(--w4);font-family:'DM Mono',monospace">Min ${r.min} · Max ${r.max}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
          <button onclick="openAkModal('${a.id}')" style="font-size:12px;padding:4px 10px;border-radius:5px;border:1px solid var(--bord);background:var(--bg3);color:var(--w3);cursor:pointer;touch-action:manipulation" title="Kapalı günler">📅</button>
          <button onclick="deleteAlan('${a.id}')" style="background:none;border:none;cursor:pointer;color:var(--w4);font-size:15px;padding:4px 6px;touch-action:manipulation" title="Alanı sil" onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--w4)'">✕</button>
        </div>
      </div>
      <div class="eg-body">
        <div class="eg-row">
          <span class="eg-lbl">Günlük min</span>
          <div style="display:flex;align-items:center;gap:5px">
            <div class="ni-wrap"><button class="ni-btn" type="button" onclick="niStep(this,-1)">−</button><input class="ni" type="number" min="0" max="19" value="${r.min}"
              onchange="S.defaultDayMin['${a.id}'].min=Math.max(0,parseInt(this.value)||0);save();showSaved('minSaved');renderMinConf()"><button class="ni-btn" type="button" onclick="niStep(this,1)">+</button></div>
            <span style="font-size:12px;color:var(--w3)">kişi</span>
          </div>
        </div>
        <div class="eg-row">
          <span class="eg-lbl">Günlük max</span>
          <div style="display:flex;align-items:center;gap:5px">
            <div class="ni-wrap"><button class="ni-btn" type="button" onclick="niStep(this,-1)">−</button><input class="ni" type="number" min="0" max="19" value="${r.max}"
              onchange="S.defaultDayMin['${a.id}'].max=Math.max(0,parseInt(this.value)||0);save();showSaved('minSaved');renderMinConf()"><button class="ni-btn" type="button" onclick="niStep(this,1)">+</button></div>
            <span style="font-size:12px;color:var(--w3)">kişi</span>
          </div>
        </div>
        <div class="eg-row" style="flex-direction:column;align-items:flex-start;gap:6px">
          <span class="eg-lbl">Kıdem kuralları</span>
          ${kidemKartHtml}
        </div>
        <div id="${advId}" class="eg-adv">
          <div class="eg-row" style="flex-direction:column;align-items:flex-start;gap:6px">
            <span class="eg-lbl">Kıdem bazlı günlük min / max <span style="font-size:11px;color:var(--w4)">(0 = sınır yok)</span></span>
            <div style="display:flex;flex-direction:column;gap:6px">${[1,2,3,4,5].map(k=>{
              const kMin=r.kidemMin[k]||0;
              const kMax=r.kidemMax[k]||0;
              const deaktif=kMin===0&&kMax===0;
              return `<div style="display:flex;align-items:center;gap:6px;${deaktif?'opacity:.5':''}">
                <span class="kt ${KIDEM_CLS[k]}" style="font-size:11px;padding:2px 6px;min-width:30px;text-align:center">K${k}</span>
                <span style="font-size:10px;color:var(--w3)">en az</span>
                <div class="ni-wrap"><button class="ni-btn" type="button" onclick="niStep(this,-1)">−</button><input class="ni" type="number" min="0" max="8" value="${kMin}"
                  style="width:28px;color:${kMin>0?'#4ade80':'var(--w4)'}"
                  onchange="
                    let v=Math.max(0,parseInt(this.value)||0);
                    if(!S.defaultDayMin['${a.id}'].kidemMin)S.defaultDayMin['${a.id}'].kidemMin={};
                    if(!S.defaultDayMin['${a.id}'].kidemMax)S.defaultDayMin['${a.id}'].kidemMax={};
                    const mx=S.defaultDayMin['${a.id}'].kidemMax[${k}]||0;
                    if(mx>0&&v>mx){v=mx;this.value=v;}
                    S.defaultDayMin['${a.id}'].kidemMin[${k}]=v;
                    save();showSaved('minSaved');renderMinConf()"><button class="ni-btn" type="button" onclick="niStep(this,1)">+</button></div>
                <span style="font-size:10px;color:var(--w3)">en fazla</span>
                <div class="ni-wrap"><button class="ni-btn" type="button" onclick="niStep(this,-1)">−</button><input class="ni" type="number" min="0" max="8" value="${kMax}"
                  style="width:28px;color:${kMax>0?'var(--acc)':'var(--w4)'}"
                  onchange="
                    let v=Math.max(0,parseInt(this.value)||0);
                    if(!S.defaultDayMin['${a.id}'].kidemMax)S.defaultDayMin['${a.id}'].kidemMax={};
                    if(!S.defaultDayMin['${a.id}'].kidemMin)S.defaultDayMin['${a.id}'].kidemMin={};
                    const mn=S.defaultDayMin['${a.id}'].kidemMin[${k}]||0;
                    if(v>0&&mn>v){S.defaultDayMin['${a.id}'].kidemMin[${k}]=v;}
                    S.defaultDayMin['${a.id}'].kidemMax[${k}]=v;
                    save();showSaved('minSaved');renderMinConf()"><button class="ni-btn" type="button" onclick="niStep(this,1)">+</button></div>
                <span style="font-size:10px;color:var(--w4)">${kMin===0&&kMax===0?'sınır yok':kMax===0?'min '+kMin+', max sınırsız':'min '+kMin+', max '+kMax}</span>
              </div>`;
            }).join('')}</div>
          </div>
          <div class="eg-row" style="flex-direction:column;align-items:flex-start;gap:6px">
            <span class="eg-lbl">Alan şiftleri</span>
            <div style="display:flex;flex-direction:column;gap:6px">
              ${[
                {grup:'24s', seçenekler:[{v:'24h',lbl:'24s',sub:'00→24'}]},
                {grup:'12s', seçenekler:[{v:'08-20',lbl:'Gündüz',sub:'08→20'},{v:'20-08',lbl:'Gece',sub:'20→08'}]},
                {grup:'8s',  seçenekler:[{v:'08-16',lbl:'Sabah',sub:'08→16'},{v:'16-24',lbl:'Akşam',sub:'16→24'},{v:'00-08',lbl:'Gece',sub:'00→08'}]},
              ].map(g=>{
                const alanSiftler=(r.siftler||['24h']);
                return `<div style="display:flex;align-items:center;gap:6px">
                  <span style="font-size:10px;color:var(--w4);min-width:24px;text-align:right">${g.grup}</span>
                  <div style="display:flex;gap:4px;flex-wrap:wrap">
                    ${g.seçenekler.map(s=>{
                      const sel=alanSiftler.includes(s.v);
                      return `<button onclick="toggleAlanSift('${a.id}','${s.v}')"
                        style="display:flex;flex-direction:column;align-items:center;padding:5px 10px;border-radius:6px;cursor:pointer;font-family:var(--font-sans);touch-action:manipulation;
                          border:${sel?'2px solid var(--red)':'1px solid var(--bord)'};
                          background:${sel?'var(--red-sub)':'var(--bg4)'};min-width:52px">
                        <span style="font-size:12px;font-weight:600;color:${sel?'var(--red)':'var(--w3)'}">${s.lbl}</span>
                        <span style="font-size:10px;color:${sel?'var(--red)':'var(--w4)'};font-family:'DM Mono',monospace">${s.sub}</span>
                      </button>`;
                    }).join('')}
                  </div>
                </div>`;
              }).join('')}
            </div>
          </div>
          <div class="eg-row" style="border-bottom:none;flex-direction:column;align-items:flex-start;gap:6px">
            <span class="eg-lbl">Kapalı günler</span>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <button onclick="openAkModal('${a.id}')" style="font-size:11px;padding:5px 12px;border-radius:6px;border:1px solid var(--bord);background:var(--bg3);color:var(--w3);cursor:pointer;display:flex;align-items:center;gap:5px;touch-action:manipulation">
                📅 Belirli tarihleri kapat
              </button>
              <span id="akCount_${a.id}" style="font-size:10px;color:var(--w3)"></span>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  });
  document.getElementById('minGrid').innerHTML=html;
  renderDayConfigPanel();
}

function gunIhlalleri(d){
  const {y,m}=S.currentDate;
  const ihlaller=[];
  AREAS.forEach(a=>{
    const rule=getDayRule(d,a.id);
    if(!rule.aktif) return;
    const atananlar=ASSISTANTS.filter((_,i)=>S.schedule[gk(i,d)]===a.id);
    const cnt=atananlar.length;
    // Min eksik
    if(cnt<rule.min){
      ihlaller.push({tip:'min',alan:a,msg:a.name+': '+cnt+'/'+rule.min+' — '+(rule.min-cnt)+' kişi eksik'});
    }
    // Max aşım
    if(rule.max>0&&cnt>rule.max){
      ihlaller.push({tip:'max',alan:a,msg:a.name+': '+cnt+'/'+rule.max+' — '+(cnt-rule.max)+' fazla'});
    }
    // Kıdem kuralı ihlali (yalnız tutamaz)
    if(cnt>0){
      const kIhlaller=kidemKuralIhlali(d,a.id);
      kIhlaller.forEach(ih=>{
        ihlaller.push({tip:'kidem',alan:a,msg:a.name+': '+ih.msg,
          kidem:ih.kidem, yanindaKidemler:ih.yanindaKidemler||ih.yaninda||[]});
      });
    }
    // kidemMin ihlali
    const kMinObj=rule.kidemMin||{};
    for(const kk of Object.keys(kMinObj)){
      const kMinReq=kMinObj[kk]||0;
      if(kMinReq<=0) continue;
      const kCnt=atananlar.filter(x=>x.kidem===Number(kk)).length;
      if(kCnt<kMinReq){
        ihlaller.push({tip:'kidemMin',alan:a,msg:a.name+': K'+kk+' min '+kMinReq+' gerekli, mevcut '+kCnt+' — '+(kMinReq-kCnt)+' eksik'});
      }
    }
    // kidemMax ihlali
    const kMaxObj=rule.kidemMax||{};
    for(const kk of Object.keys(kMaxObj)){
      const kMaxReq=kMaxObj[kk]||0;
      if(kMaxReq<=0) continue;
      const kCnt=atananlar.filter(x=>x.kidem===Number(kk)).length;
      if(kCnt>kMaxReq){
        ihlaller.push({tip:'kidemMax',alan:a,msg:a.name+': K'+kk+' max '+kMaxReq+' olmalı, mevcut '+kCnt+' — '+(kCnt-kMaxReq)+' fazla'});
      }
    }
  });
  return ihlaller;
}

function hesaplaUyarilar(){
  const {y,m}=S.currentDate;
  const days=daysInMonth(y,m);
  let toplamIhlal=0;
  let sorunluGun=0;
  for(let d=1;d<=days;d++){
    const gundeAtanan=ASSISTANTS.filter((_,i)=>S.schedule[gk(i,d)]).length;
    if(gundeAtanan===0) continue;
    const ih=gunIhlalleri(d);
    toplamIhlal+=ih.length;
    if(ih.length>0) sorunluGun++;
  }
  return {sorunluGun, toplamIhlal};
}

function migrateKidemKurallari(aId){
  const r=S.defaultDayMin[aId];
  if(!r) return;
  if(!r.kidemKurallari) r.kidemKurallari={};
  // Eski kidemBagimliligi → yeni kidemKurallari (yanindaKidemler+enAzKac format)
  if(r.kidemBagimliligi&&r.kidemBagimliligi.length){
    r.kidemBagimliligi.forEach(b=>{
      const bagimli=b.bagimli||[];
      const refans=b.refans||[];
      bagimli.forEach(k=>{
        if(!r.kidemKurallari[k]) r.kidemKurallari[k]={yalnizTutamaz:false};
        r.kidemKurallari[k].yalnizTutamaz=true;
        r.kidemKurallari[k].yanindaKidemler=refans.filter(rk=>rk!==k);
        r.kidemKurallari[k].enAzKac=1;
      });
    });
  }
  // Eski yapıyı temizle
  delete r.kidemGruplari;
  delete r.kidemBagimliligi;
  if(!r.kidemGrupKurallari) r.kidemGrupKurallari=[];
  save();
}

// ── BÖLÜM 1 fonksiyonları: Yalnız tutamaz ──
function toggleKidemYalniz(aId,k,checked){
  const r=S.defaultDayMin[aId];
  if(!r.kidemKurallari) r.kidemKurallari={};
  if(!r.kidemKurallari[k]) r.kidemKurallari[k]={yalnizTutamaz:false};
  r.kidemKurallari[k].yalnizTutamaz=checked;
  if(checked&&!r.kidemKurallari[k].yanindaKidemler) r.kidemKurallari[k].yanindaKidemler=[];
  if(checked&&!r.kidemKurallari[k].enAzKac) r.kidemKurallari[k].enAzKac=1;
  // Eski yapıyı temizle
  delete r.kidemKurallari[k].yaninda; delete r.kidemKurallari[k].kosul; delete r.kidemKurallari[k].yanindaGruplar;
  save();showSaved('minSaved');renderMinConf();
}
function toggleYanindaKidem(aId,k,k2,checked){
  const r=S.defaultDayMin[aId];
  const kural=r.kidemKurallari[k]; if(!kural) return;
  if(!kural.yanindaKidemler) kural.yanindaKidemler=[];
  if(checked){if(!kural.yanindaKidemler.includes(k2))kural.yanindaKidemler.push(k2);}
  else{kural.yanindaKidemler=kural.yanindaKidemler.filter(x=>x!==k2);}
  // enAzKac, seçili kidem sayısını aşamaz
  if(kural.enAzKac>kural.yanindaKidemler.length) kural.enAzKac=Math.max(1,kural.yanindaKidemler.length);
  save();showSaved('minSaved');renderMinConf();
}
function setYanindaEnAz(aId,k,val){
  const r=S.defaultDayMin[aId];
  const kural=r.kidemKurallari[k]; if(!kural) return;
  kural.enAzKac=Math.max(1,val);
  save();showSaved('minSaved');
}

// ── BÖLÜM 2 fonksiyonları: Kıdem grupları ──
function ekleKidemGrupKurali(aId){
  const r=S.defaultDayMin[aId];
  if(!r.kidemGrupKurallari) r.kidemGrupKurallari=[];
  r.kidemGrupKurallari.push({kidemler:[],enAzKac:0,enFazlaKac:0});
  save();showSaved('minSaved');renderMinConf();
}
function silKidemGrupKurali(aId,gi){
  const r=S.defaultDayMin[aId];
  if(!r.kidemGrupKurallari) return;
  r.kidemGrupKurallari.splice(gi,1);
  save();showSaved('minSaved');renderMinConf();
}
// Gruptaki toplam asistan sayısını hesapla
function _kidemGrupAstSayi(g){
  let toplam=0;
  (g.kidemler||[]).forEach(k=>{toplam+=ASSISTANTS.filter(ast=>ast.kidem===k).length;});
  return toplam;
}
function toggleKidemGrupKidem(aId,gi,k,checked){
  const r=S.defaultDayMin[aId];
  const g=(r.kidemGrupKurallari||[])[gi]; if(!g) return;
  if(!g.kidemler) g.kidemler=[];
  if(checked){if(!g.kidemler.includes(k))g.kidemler.push(k);}
  else{g.kidemler=g.kidemler.filter(x=>x!==k);}
  // Max'ı toplam asistan sayısına clamp et
  const topAst=_kidemGrupAstSayi(g);
  if((g.enFazlaKac||0)>topAst) g.enFazlaKac=topAst;
  if((g.enAzKac||0)>topAst) g.enAzKac=topAst;
  // Min > max ise max'ı min'e eşitle
  if((g.enFazlaKac||0)>0 && (g.enAzKac||0)>(g.enFazlaKac||0)) g.enFazlaKac=g.enAzKac;
  save();showSaved('minSaved');renderMinConf();
}
function setKidemGrupEnAz(aId,gi,val){
  const r=S.defaultDayMin[aId];
  const g=(r.kidemGrupKurallari||[])[gi]; if(!g) return;
  val=Math.max(0,val);
  // Toplam asistan sayısına clamp
  const topAst=_kidemGrupAstSayi(g);
  if(topAst>0 && val>topAst) val=topAst;
  g.enAzKac=val;
  // Min > max ise max'ı min'e eşitle
  if((g.enFazlaKac||0)>0 && g.enAzKac>(g.enFazlaKac||0)) g.enFazlaKac=g.enAzKac;
  else if((g.enFazlaKac||0)===0 && g.enAzKac>0) g.enFazlaKac=g.enAzKac;
  save();showSaved('minSaved');renderMinConf();
}
function setKidemGrupEnFazla(aId,gi,val){
  const r=S.defaultDayMin[aId];
  const g=(r.kidemGrupKurallari||[])[gi]; if(!g) return;
  val=Math.max(0,val);
  // Toplam asistan sayısına clamp
  const topAst=_kidemGrupAstSayi(g);
  if(topAst>0 && val>topAst){ val=topAst; _showCalToast('Max, gruptaki toplam asistan sayısına ('+topAst+') düşürüldü.'); }
  g.enFazlaKac=val;
  // Max < min ise min'i düşür
  if(val>0 && (g.enAzKac||0)>val) g.enAzKac=val;
  // Max 0 yapıldığında min de 0 olmalı (hiç yazılmaz)
  if(val===0 && (g.enAzKac||0)>0) g.enAzKac=0;
  save();showSaved('minSaved');renderMinConf();
}

// Kıdem kuralı ihlal kontrolü (2 bölümlü sistem)
function kidemKuralIhlali(d, aId){
  const r=S.defaultDayMin[aId];
  if(!r) return [];
  const ihlaller=[];
  const atananlar=ASSISTANTS.filter((_,i)=>S.schedule[gk(i,d)]===aId);
  if(!atananlar.length) return [];
  const atananKidemler=atananlar.map(ast=>ast.kidem);

  function kidemSayisi(k){ return atananKidemler.filter(ak=>ak===k).length; }

  // ── BÖLÜM 1: Yalnız tutamaz kuralı ──
  if(r.kidemKurallari){
    Object.keys(r.kidemKurallari).forEach(kStr=>{
      const k=parseInt(kStr);
      const kural=r.kidemKurallari[k];
      if(!kural||!kural.yalnizTutamaz) return;
      if(!atananKidemler.includes(k)) return;

      const yanindaKidemler=kural.yanindaKidemler||
        (kural.yaninda&&kural.yaninda.length?kural.yaninda:[]);
      const enAzKac=kural.enAzKac||1;

      if(!yanindaKidemler.length){
        // Hiç yanında kidem seçilmemiş → aynı kıdemden en az 2 kişi olmalı
        if(kidemSayisi(k)===1){
          ihlaller.push({tip:'yalniz',kidem:k,msg:'K'+k+' yalnız — aynı kıdemden en az 2 kişi olmalı'});
        }
        return;
      }

      // Yanındaki kidemlerden kaç tanesi mevcut?
      let bulunan=0;
      for(const yk of yanindaKidemler){
        if(yk===k){ if(kidemSayisi(k)>=2) bulunan++; }
        else{ if(atananKidemler.includes(yk)) bulunan++; }
      }
      if(bulunan<enAzKac){
        const eksik=enAzKac-bulunan;
        ihlaller.push({tip:'yalniz',kidem:k,yanindaKidemler,enAzKac,
          msg:'K'+k+' yalnız — yanında K'+yanindaKidemler.join('/K')+"'ten en az "+enAzKac+' kişi olmalı ('+eksik+' eksik)'});
      }
    });
  }

  // ── BÖLÜM 2: Kıdem grupları ──
  if(r.kidemGrupKurallari&&r.kidemGrupKurallari.length){
    r.kidemGrupKurallari.forEach((g,gi)=>{
      const gKidemler=g.kidemler||[];
      if(!gKidemler.length) return;
      const enAzKac=g.enAzKac||0;
      const enFazlaKac=g.enFazlaKac||0;
      // Bu gruptan kaç kişi atanmış?
      let bulunan=0;
      for(const yk of gKidemler){ bulunan+=kidemSayisi(yk); }
      // Min ihlali
      if(enAzKac>0 && bulunan<enAzKac){
        const eksik=enAzKac-bulunan;
        ihlaller.push({tip:'grup',grupIdx:gi,kidemler:gKidemler,enAzKac,
          msg:'K'+gKidemler.join('+K')+' grubundan en az '+enAzKac+' kişi olmalı ('+eksik+' eksik)'});
      }
      // Max ihlali
      if(enFazlaKac>0 && bulunan>enFazlaKac){
        const fazla=bulunan-enFazlaKac;
        ihlaller.push({tip:'grupMax',grupIdx:gi,kidemler:gKidemler,enFazlaKac,
          msg:'K'+gKidemler.join('+K')+' grubundan en fazla '+enFazlaKac+' kişi olmalı ('+fazla+' fazla)'});
      }
    });
  }

  return ihlaller;
}
