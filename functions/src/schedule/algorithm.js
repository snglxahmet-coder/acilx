/**
 * AcilX Nöbet Algoritması
 * Mevcut PWA'dan (mod-nobet.html) Cloud Function'a port edildi.
 *
 * Girdi: { residents, zones, config, preferences, trainingBlocks, year, month }
 * Çıktı: { schedule, analysis }
 *
 * schedule: { "residentId_day": "zoneId", ... }
 * analysis: { violations, unmetPreferences, targetVsActual, weekendBalance }
 */

// ── Yardımcılar ───────────────────────────────────────────────────────────────

function daysInMonth(y, m) {
  return new Date(y, m + 1, 0).getDate();
}

function isWeekend(y, m, d) {
  const dw = new Date(y, m, d).getDay();
  return dw === 0 || dw === 6;
}

function getDayOfWeek(y, m, d) {
  const dw = new Date(y, m, d).getDay();
  return dw === 0 ? 6 : dw - 1; // 0=Pzt, 6=Paz
}

function key(residentId, day) {
  return `${residentId}_${day}`;
}

// ── Eğitim bloğu kontrolü ─────────────────────────────────────────────────────

function isTrainingFullBlock(y, m, d, pgyLevel, trainingBlocks) {
  return trainingBlocks.some(block => {
    if (block.mode !== 'full_day_off') return false;
    if (!block.affectedPgyLevels.includes(pgyLevel)) return false;
    if (block.type === 'recurring') {
      return getDayOfWeek(y, m, d) === block.dayOfWeek;
    }
    if (block.type === 'one_time' && block.specificDate) {
      const bd = block.specificDate.toDate ? block.specificDate.toDate() : new Date(block.specificDate);
      return bd.getFullYear() === y && bd.getMonth() === m && bd.getDate() === d;
    }
    return false;
  });
}

// ── Alan aktif mi? ─────────────────────────────────────────────────────────────

function isZoneActive(day, zone, y, m) {
  if (!zone.isActive) return false;
  if (!zone.activeDays || zone.activeDays.length === 0) return true;
  return zone.activeDays.includes(getDayOfWeek(y, m, day));
}

// ── Ana algoritma ─────────────────────────────────────────────────────────────

function runAlgorithm({ residents, zones, config, preferences, trainingBlocks, year, month, prevMonthLastDays = {}, nextMonthFirstDays = {} }) {
  const y = year;
  const m = month;
  const days = daysInMonth(y, m);
  const schedule = {}; // key(residentId, day) → zoneId

  // Konfigürasyon
  const CONSECUTIVE_DISTANCE = config.consecutiveDistance || 1;
  const AVOIDANCE_STRENGTH    = config.avoidanceStrength || 'strong';
  const WEEKEND_BALANCE       = config.weekendBalance || 'equal';
  const LEAVE_TARGET_ADJUST   = config.leaveTargetAdjust || 'proportional';

  // Tercih haritaları
  const prefMap   = {}; // residentId → { preferred: Set<day>, avoid: Set<day> }
  const avoidMap  = {}; // residentId → Set<day>
  const leaveMap  = {}; // residentId → Set<day>

  preferences.forEach(p => {
    prefMap[p.residentId]  = {
      preferred: new Set(p.preferredDays  || []),
      avoid:     new Set(p.avoidDays      || []),
    };
  });

  residents.forEach(r => {
    leaveMap[r.id] = new Set(r.leaveDays || []);
  });

  // Yük takibi
  const load = {}; // residentId → { total, byZone: {zoneId: count}, weekendCount }
  residents.forEach(r => {
    load[r.id] = { total: 0, byZone: {}, weekendCount: 0 };
  });

  // Hedef nöbet sayısı
  function targetShifts(resident) {
    const moKey = `${y}_${m}`;
    const override = resident.monthlyTargetOverride && resident.monthlyTargetOverride[moKey];
    if (override !== undefined && override !== null) return override;

    const baseTarget = config.targetShiftsByPgy[resident.pgyLevel] || 0;
    if (resident.status !== 'active') return 0;

    const leaveDays = (leaveMap[resident.id] || new Set()).size;
    if (leaveDays > 0 && LEAVE_TARGET_ADJUST === 'proportional') {
      return Math.max(0, Math.round(baseTarget * ((days - leaveDays) / days)));
    }
    return baseTarget;
  }

  // Kalan hedef
  function remaining(residentId) {
    return targetShifts(residents.find(r => r.id === residentId)) - load[residentId].total;
  }

  // Alan kotası kalan
  function zoneQuotaRemaining(residentId, zoneId) {
    const resident = residents.find(r => r.id === residentId);
    const quota = (config.zoneQuota[zoneId] || {})[resident.pgyLevel] || 0;
    return quota - (load[residentId].byZone[zoneId] || 0);
  }

  // O gün o alanda kaç kişi var
  function countInZone(day, zoneId) {
    return residents.filter(r => schedule[key(r.id, day)] === zoneId).length;
  }

  // Ardışık mesafe kontrolü
  function isDistanceOk(residentId, day) {
    for (let delta = 1; delta <= CONSECUTIVE_DISTANCE; delta++) {
      if (day - delta >= 1 && schedule[key(residentId, day - delta)]) return false;
      if (day + delta <= days && schedule[key(residentId, day + delta)]) return false;
    }
    // Önceki ay son gün
    if (day === 1 && prevMonthLastDays[residentId]) return false;
    // Sonraki ay ilk gün
    if (day === days && nextMonthFirstDays[residentId]) return false;
    return true;
  }

  // Atama mümkün mü?
  function canAssign(residentId, day, zoneId, opts = {}) {
    const { ignoreTarget = false, ignoreAvoid = false } = opts;
    const resident = residents.find(r => r.id === residentId);
    if (!resident) return false;
    if (resident.status !== 'active') return false;

    // İzin günü
    if (leaveMap[residentId] && leaveMap[residentId].has(day)) return false;

    // Eğitim tam blok
    if (isTrainingFullBlock(y, m, day, resident.pgyLevel, trainingBlocks)) return false;

    // Zaten atanmış
    if (schedule[key(residentId, day)]) return false;

    // Alan aktif mi
    const zone = zones.find(z => z.id === zoneId);
    if (!zone || !isZoneActive(day, zone, y, m)) return false;

    // Ardışık mesafe
    if (!isDistanceOk(residentId, day)) return false;

    // Hedef dolu mu
    if (!ignoreTarget && remaining(residentId) <= 0) return false;

    // Alan kotası
    if (zoneQuotaRemaining(residentId, zoneId) <= 0) return false;

    // Kaçınma
    if (!ignoreAvoid) {
      const avoidSet = prefMap[residentId] && prefMap[residentId].avoid;
      if (avoidSet && avoidSet.has(day)) {
        if (AVOIDANCE_STRENGTH === 'strict' || AVOIDANCE_STRENGTH === 'strong') return false;
      }
    }

    // Kıdem grup kısıtları
    if (zone.seniorityGroups && zone.seniorityGroups.length) {
      for (const grp of zone.seniorityGroups) {
        if (grp.pgyLevels.includes(resident.pgyLevel)) {
          // Max kontrol
          if (grp.maxCount) {
            const currentInGrp = residents.filter(
              r => schedule[key(r.id, day)] === zoneId && grp.pgyLevels.includes(r.pgyLevel)
            ).length;
            if (currentInGrp >= grp.maxCount) return false;
          }
        } else {
          // Bu grup henüz min'e ulaşmadıysa ve uygun aday varsa, bekle
          const currentInGrp = residents.filter(
            r => schedule[key(r.id, day)] === zoneId && grp.pgyLevels.includes(r.pgyLevel)
          ).length;
          if (currentInGrp < (grp.minCount || 1)) {
            const hasCandidate = residents.some(
              r => r.id !== residentId &&
                   grp.pgyLevels.includes(r.pgyLevel) &&
                   !schedule[key(r.id, day)] &&
                   zoneQuotaRemaining(r.id, zoneId) > 0 &&
                   !isTrainingFullBlock(y, m, day, r.pgyLevel, trainingBlocks) &&
                   isDistanceOk(r.id, day)
            );
            if (hasCandidate) return false;
          }
        }
      }
    }

    return true;
  }

  // Atama yap
  function assign(residentId, day, zoneId) {
    schedule[key(residentId, day)] = zoneId;
    load[residentId].total++;
    load[residentId].byZone[zoneId] = (load[residentId].byZone[zoneId] || 0) + 1;
    if (isWeekend(y, m, day)) load[residentId].weekendCount++;
  }

  // Tercih skoru (düşük = daha iyi)
  function preferenceScore(residentId, day) {
    let score = 0;
    const dw = getDayOfWeek(y, m, day);
    const pref = prefMap[residentId];
    if (!pref) return 0;

    // Haftalık kaçınma
    if ((config.avoidDayOfWeek || {})[residentId]?.includes(dw)) score += 20;
    // Haftalık tercih
    if ((config.preferDayOfWeek || {})[residentId]?.includes(dw)) score -= 8;
    // Aylık tercih
    if (pref.preferred.has(day)) score -= 60;
    // Aylık kaçınma (yumuşak modda skor olarak)
    if (AVOIDANCE_STRENGTH === 'soft' && pref.avoid.has(day)) score += 100;

    return score;
  }

  // Asistan sıralama comparator'ı (belirli alan ve gün için)
  function makeComparator(zoneId, day) {
    const isWE = isWeekend(y, m, day);
    return (aId, bId) => {
      const ra = remaining(aId), rb = remaining(bId);
      const prefA = preferenceScore(aId, day), prefB = preferenceScore(bId, day);

      // Önce tercih skoru
      if (prefA !== prefB) return prefA - prefB;
      // Hafta sonu dengesi
      if (WEEKEND_BALANCE === 'equal' && isWE) {
        return (load[aId].weekendCount || 0) - (load[bId].weekendCount || 0);
      }
      // Daha çok kalanı olan önce
      return rb - ra;
    };
  }

  // ── ADIM 1: Kıdem grubu minimum doldurmayı önce yap ──────────────────────

  zones.forEach(zone => {
    if (!zone.seniorityGroups || !zone.seniorityGroups.length) return;
    zone.seniorityGroups.forEach(grp => {
      const minCount = grp.minCount || 1;
      const groupResidents = residents.filter(r =>
        grp.pgyLevels.includes(r.pgyLevel) &&
        r.status === 'active'
      );
      if (!groupResidents.length) return;

      for (let d = 1; d <= days; d++) {
        if (!isZoneActive(d, zone, y, m)) continue;

        const currentCount = residents.filter(
          r => schedule[key(r.id, d)] === zone.id && grp.pgyLevels.includes(r.pgyLevel)
        ).length;
        if (currentCount >= minCount) continue;

        // Uygun adayları sırala
        const candidates = groupResidents
          .filter(r => canAssign(r.id, d, zone.id))
          .sort(makeComparator(zone.id, d));

        const needed = minCount - currentCount;
        candidates.slice(0, needed).forEach(r => assign(r.id, d, zone.id));
      }
    });
  });

  // ── ADIM 2: Alan minimumlarını doldur ──────────────────────────────────────

  // Alan öncelik sırası: min > 0 olanlar önce, kıdem gruplu olanlar önce
  const orderedZones = [...zones].sort((a, b) => {
    const minA = (config.zoneMinPerDay[a.id] || 0);
    const minB = (config.zoneMinPerDay[b.id] || 0);
    const grpA = (a.seniorityGroups && a.seniorityGroups.length) ? 1 : 0;
    const grpB = (b.seniorityGroups && b.seniorityGroups.length) ? 1 : 0;
    if ((minA === 0) !== (minB === 0)) return minA === 0 ? 1 : -1;
    if (grpA !== grpB) return grpB - grpA;
    return 0;
  });

  for (let d = 1; d <= days; d++) {
    orderedZones.forEach(zone => {
      if (!isZoneActive(d, zone, y, m)) return;
      const minCount = config.zoneMinPerDay[zone.id] || 0;
      if (!minCount) return;

      let current = countInZone(d, zone.id);
      if (current >= minCount) return;

      const candidates = residents
        .filter(r => canAssign(r.id, d, zone.id))
        .sort(makeComparator(zone.id, d));

      const needed = minCount - current;
      candidates.slice(0, needed).forEach(r => assign(r.id, d, zone.id));
    });
  }

  // ── ADIM 3: Kalan hedefleri doldur (genel dağılım) ───────────────────────

  for (let d = 1; d <= days; d++) {
    orderedZones.forEach(zone => {
      if (!isZoneActive(d, zone, y, m)) return;
      const maxCount = config.zoneMaxPerDay[zone.id] || 99;
      if (countInZone(d, zone.id) >= maxCount) return;

      // Bu alanda kotası olan ve henüz atanamayacak asistanlar
      const candidates = residents
        .filter(r => {
          if (!canAssign(r.id, d, zone.id)) return false;
          if (remaining(r.id) <= 0) return false;
          return true;
        })
        .sort(makeComparator(zone.id, d));

      candidates.forEach(r => {
        if (countInZone(d, zone.id) >= maxCount) return;
        if (!canAssign(r.id, d, zone.id)) return;
        assign(r.id, d, zone.id);
      });
    });
  }

  // ── ADIM 4: Hafta sonu dengesini düzelt (swap) ────────────────────────────

  if (WEEKEND_BALANCE === 'equal') {
    // Hafta sonu nöbet sayısını dengele (basit heuristic)
    const weekendDays = [];
    for (let d = 1; d <= days; d++) {
      if (isWeekend(y, m, d)) weekendDays.push(d);
    }

    const avgWE = residents.reduce((s, r) => s + (load[r.id].weekendCount || 0), 0) / residents.length;

    residents.forEach(r => {
      if ((load[r.id].weekendCount || 0) <= Math.ceil(avgWE) + 1) return;
      // Bu asistanın fazla hafta sonu varsa, swap adayı bul
      weekendDays.forEach(d => {
        const assignedZone = schedule[key(r.id, d)];
        if (!assignedZone) return;

        // Bu günde az hafta sonu olan biri var mı?
        const swapCandidate = residents.find(r2 =>
          r2.id !== r.id &&
          !schedule[key(r2.id, d)] &&
          (load[r2.id].weekendCount || 0) < Math.floor(avgWE) &&
          canAssign(r2.id, d, assignedZone, { ignoreTarget: true })
        );

        if (swapCandidate) {
          // Swap
          delete schedule[key(r.id, d)];
          load[r.id].total--;
          load[r.id].byZone[assignedZone] = Math.max(0, (load[r.id].byZone[assignedZone] || 1) - 1);
          load[r.id].weekendCount = Math.max(0, (load[r.id].weekendCount || 1) - 1);

          assign(swapCandidate.id, d, assignedZone);
        }
      });
    });
  }

  // ── ANALİZ ────────────────────────────────────────────────────────────────

  const analysis = buildAnalysis({ residents, zones, schedule, config, preferences, trainingBlocks, y, m, days, load, targetShifts });

  return { schedule, analysis };
}

function buildAnalysis({ residents, zones, schedule, config, preferences, trainingBlocks, y, m, days, load, targetShifts }) {
  // Hedef vs gerçekleşen (kıdem başına)
  const targetVsActual = residents.map(r => ({
    residentId: r.id,
    pgyLevel:   r.pgyLevel,
    target:     targetShifts(r),
    actual:     load[r.id].total,
    diff:       targetShifts(r) - load[r.id].total,
    weekendShifts: load[r.id].weekendCount || 0,
  }));

  // Alan × kıdem dağılımı
  const zoneMatrix = {};
  zones.forEach(zone => {
    zoneMatrix[zone.id] = { target: {}, actual: {} };
    [1, 2, 3, 4, 5].forEach(pgy => {
      zoneMatrix[zone.id].target[pgy] = (config.zoneQuota[zone.id] || {})[pgy] || 0;
      zoneMatrix[zone.id].actual[pgy] = 0;
    });
  });
  for (let d = 1; d <= days; d++) {
    residents.forEach(r => {
      const zoneId = schedule[key(r.id, d)];
      if (zoneId && zoneMatrix[zoneId]) {
        zoneMatrix[zoneId].actual[r.pgyLevel] = (zoneMatrix[zoneId].actual[r.pgyLevel] || 0) + 1;
      }
    });
  }

  // Karşılanamayan tercihler
  const unmetPreferences = [];
  preferences.forEach(p => {
    (p.preferredDays || []).forEach(d => {
      if (!schedule[key(p.residentId, d)]) {
        unmetPreferences.push({ residentId: p.residentId, day: d, type: 'preferred_not_assigned' });
      }
    });
    (p.avoidDays || []).forEach(d => {
      if (schedule[key(p.residentId, d)]) {
        unmetPreferences.push({ residentId: p.residentId, day: d, type: 'avoid_assigned' });
      }
    });
  });

  // Min doluluk ihlalleri
  const violations = [];
  for (let d = 1; d <= days; d++) {
    zones.forEach(zone => {
      if (!isZoneActive(d, zone, y, m)) return;
      const minCount = config.zoneMinPerDay[zone.id] || 0;
      const actual = residents.filter(r => schedule[key(r.id, d)] === zone.id).length;
      if (actual < minCount) {
        violations.push({ day: d, zoneId: zone.id, type: 'min_not_met', required: minCount, actual });
      }
    });
  }

  return { targetVsActual, zoneMatrix, unmetPreferences, violations };
}

module.exports = { runAlgorithm };
