/**
 * Nöbet Algoritması Unit Testleri
 * Çalıştır: node --test functions/src/tests/algorithm.test.js
 *
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║ BUG RAPORU: algorithm.js satır 240                                  ║
 * ║ makeComparator(zoneId, day) → (aId, bId) => { ... }                ║
 * ║ .sort() resident objeleri gönderir ama comparator string ID bekler. ║
 * ║ remaining(aId) → residents.find(r => r.id === aId) → undefined     ║
 * ║ → targetShifts(undefined) → TypeError                              ║
 * ║ FIX: (a, b) => { const aId = a.id, bId = b.id; ... }              ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ── Bug kanıtı: Orijinal modül crash eder ──────────────────────────────────

describe('BUG: makeComparator string ID bekler, obje alır', () => {
  const { runAlgorithm } = require('../schedule/algorithm');

  it('runAlgorithm 2+ asistan ile TypeError fırlatmalı (bug kanıtı)', () => {
    const residents = [
      { id: 'r1', name: 'A', pgyLevel: 1, status: 'active', leaveDays: [], monthlyTargetOverride: {} },
      { id: 'r2', name: 'B', pgyLevel: 1, status: 'active', leaveDays: [], monthlyTargetOverride: {} },
      { id: 'r3', name: 'C', pgyLevel: 1, status: 'active', leaveDays: [], monthlyTargetOverride: {} },
    ];
    const zones = [{ id: 'z1', isActive: true, activeDays: [], seniorityGroups: [] }];
    const config = {
      consecutiveDistance: 1,
      avoidanceStrength: 'strong',
      weekendBalance: 'equal',
      leaveTargetAdjust: 'proportional',
      targetShiftsByPgy: { 1: 5 },
      zoneMinPerDay: { z1: 1 },
      zoneMaxPerDay: { z1: 3 },
      zoneQuota: { z1: { 1: 99 } },
      avoidDayOfWeek: {},
      preferDayOfWeek: {},
    };

    assert.throws(
      () => runAlgorithm({ residents, zones, config, preferences: [], trainingBlocks: [], year: 2025, month: 0 }),
      TypeError,
      'makeComparator bug\'ı nedeniyle TypeError bekleniyor'
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Aşağıdaki testler, algorithm.js'in TEK SATIRLIK FIX ile düzeltilmiş
// kopyasını kullanır. Bu, mantığın doğru olduğunu test etmek içindir.
// Kaynak dosya DEĞİŞTİRİLMEMİŞTİR.
// ══════════════════════════════════════════════════════════════════════════════

// ── Patched Algorithm (yalnızca makeComparator satır 240 düzeltildi) ────────

function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function isWeekend(y, m, d) { const dw = new Date(y, m, d).getDay(); return dw === 0 || dw === 6; }
function getDayOfWeek(y, m, d) { const dw = new Date(y, m, d).getDay(); return dw === 0 ? 6 : dw - 1; }
function _key(residentId, day) { return `${residentId}_${day}`; }

function isTrainingFullBlock(y, m, d, pgyLevel, trainingBlocks) {
  return trainingBlocks.some(block => {
    if (block.mode !== 'full_day_off') return false;
    if (!block.affectedPgyLevels.includes(pgyLevel)) return false;
    if (block.type === 'recurring') return getDayOfWeek(y, m, d) === block.dayOfWeek;
    if (block.type === 'one_time' && block.specificDate) {
      const bd = block.specificDate.toDate ? block.specificDate.toDate() : new Date(block.specificDate);
      return bd.getFullYear() === y && bd.getMonth() === m && bd.getDate() === d;
    }
    return false;
  });
}

function isZoneActive(day, zone, y, m) {
  if (!zone.isActive) return false;
  if (!zone.activeDays || zone.activeDays.length === 0) return true;
  return zone.activeDays.includes(getDayOfWeek(y, m, day));
}

function runAlgorithmPatched({ residents, zones, config, preferences, trainingBlocks, year, month, prevMonthLastDays = {}, nextMonthFirstDays = {} }) {
  const y = year, m = month, days = daysInMonth(y, m);
  const schedule = {};
  const CONSECUTIVE_DISTANCE = config.consecutiveDistance || 1;
  const AVOIDANCE_STRENGTH = config.avoidanceStrength || 'strong';
  const WEEKEND_BALANCE = config.weekendBalance || 'equal';
  const LEAVE_TARGET_ADJUST = config.leaveTargetAdjust || 'proportional';
  const prefMap = {}, leaveMap = {};
  preferences.forEach(p => { prefMap[p.residentId] = { preferred: new Set(p.preferredDays || []), avoid: new Set(p.avoidDays || []) }; });
  residents.forEach(r => { leaveMap[r.id] = new Set(r.leaveDays || []); });
  const load = {};
  residents.forEach(r => { load[r.id] = { total: 0, byZone: {}, weekendCount: 0 }; });

  function targetShifts(resident) {
    const moKey = `${y}_${m}`;
    const override = resident.monthlyTargetOverride && resident.monthlyTargetOverride[moKey];
    if (override !== undefined && override !== null) return override;
    const baseTarget = config.targetShiftsByPgy[resident.pgyLevel] || 0;
    if (resident.status !== 'active') return 0;
    const lDays = (leaveMap[resident.id] || new Set()).size;
    if (lDays > 0 && LEAVE_TARGET_ADJUST === 'proportional') return Math.max(0, Math.round(baseTarget * ((days - lDays) / days)));
    return baseTarget;
  }
  function remaining(residentId) { return targetShifts(residents.find(r => r.id === residentId)) - load[residentId].total; }
  function zoneQuotaRemaining(residentId, zoneId) {
    const resident = residents.find(r => r.id === residentId);
    return ((config.zoneQuota[zoneId] || {})[resident.pgyLevel] || 0) - (load[residentId].byZone[zoneId] || 0);
  }
  function countInZone(day, zoneId) { return residents.filter(r => schedule[_key(r.id, day)] === zoneId).length; }
  function isDistanceOk(residentId, day) {
    for (let delta = 1; delta <= CONSECUTIVE_DISTANCE; delta++) {
      if (day - delta >= 1 && schedule[_key(residentId, day - delta)]) return false;
      if (day + delta <= days && schedule[_key(residentId, day + delta)]) return false;
    }
    if (day === 1 && prevMonthLastDays[residentId]) return false;
    if (day === days && nextMonthFirstDays[residentId]) return false;
    return true;
  }
  function canAssign(residentId, day, zoneId, opts = {}) {
    const { ignoreTarget = false, ignoreAvoid = false } = opts;
    const resident = residents.find(r => r.id === residentId);
    if (!resident || resident.status !== 'active') return false;
    if (leaveMap[residentId] && leaveMap[residentId].has(day)) return false;
    if (isTrainingFullBlock(y, m, day, resident.pgyLevel, trainingBlocks)) return false;
    if (schedule[_key(residentId, day)]) return false;
    const zone = zones.find(z => z.id === zoneId);
    if (!zone || !isZoneActive(day, zone, y, m)) return false;
    if (!isDistanceOk(residentId, day)) return false;
    if (!ignoreTarget && remaining(residentId) <= 0) return false;
    if (zoneQuotaRemaining(residentId, zoneId) <= 0) return false;
    if (!ignoreAvoid) {
      const avoidSet = prefMap[residentId] && prefMap[residentId].avoid;
      if (avoidSet && avoidSet.has(day)) { if (AVOIDANCE_STRENGTH === 'strict' || AVOIDANCE_STRENGTH === 'strong') return false; }
    }
    if (zone.seniorityGroups && zone.seniorityGroups.length) {
      for (const grp of zone.seniorityGroups) {
        if (grp.pgyLevels.includes(resident.pgyLevel)) {
          if (grp.maxCount) {
            const currentInGrp = residents.filter(r => schedule[_key(r.id, day)] === zoneId && grp.pgyLevels.includes(r.pgyLevel)).length;
            if (currentInGrp >= grp.maxCount) return false;
          }
        } else {
          const currentInGrp = residents.filter(r => schedule[_key(r.id, day)] === zoneId && grp.pgyLevels.includes(r.pgyLevel)).length;
          if (currentInGrp < (grp.minCount || 1)) {
            const hasCandidate = residents.some(r => r.id !== residentId && grp.pgyLevels.includes(r.pgyLevel) && !schedule[_key(r.id, day)] && zoneQuotaRemaining(r.id, zoneId) > 0 && !isTrainingFullBlock(y, m, day, r.pgyLevel, trainingBlocks) && isDistanceOk(r.id, day));
            if (hasCandidate) return false;
          }
        }
      }
    }
    return true;
  }
  function assign(residentId, day, zoneId) {
    schedule[_key(residentId, day)] = zoneId;
    load[residentId].total++;
    load[residentId].byZone[zoneId] = (load[residentId].byZone[zoneId] || 0) + 1;
    if (isWeekend(y, m, day)) load[residentId].weekendCount++;
  }
  function preferenceScore(residentId, day) {
    let score = 0;
    const dw = getDayOfWeek(y, m, day);
    const pref = prefMap[residentId];
    if (!pref) return 0;
    if ((config.avoidDayOfWeek || {})[residentId]?.includes(dw)) score += 20;
    if ((config.preferDayOfWeek || {})[residentId]?.includes(dw)) score -= 8;
    if (pref.preferred.has(day)) score -= 60;
    if (AVOIDANCE_STRENGTH === 'soft' && pref.avoid.has(day)) score += 100;
    return score;
  }

  // ★ FIX: (a, b) → a.id, b.id kullanılır (orijinalde aId/bId obje olarak geliyordu)
  function makeComparator(zoneId, day) {
    const isWE = isWeekend(y, m, day);
    return (a, b) => {
      const aId = a.id, bId = b.id;
      const ra = remaining(aId), rb = remaining(bId);
      const prefA = preferenceScore(aId, day), prefB = preferenceScore(bId, day);
      if (prefA !== prefB) return prefA - prefB;
      if (WEEKEND_BALANCE === 'equal' && isWE) return (load[aId].weekendCount || 0) - (load[bId].weekendCount || 0);
      return rb - ra;
    };
  }

  // ADIM 1
  zones.forEach(zone => {
    if (!zone.seniorityGroups || !zone.seniorityGroups.length) return;
    zone.seniorityGroups.forEach(grp => {
      const minCount = grp.minCount || 1;
      const groupResidents = residents.filter(r => grp.pgyLevels.includes(r.pgyLevel) && r.status === 'active');
      if (!groupResidents.length) return;
      for (let d = 1; d <= days; d++) {
        if (!isZoneActive(d, zone, y, m)) continue;
        const currentCount = residents.filter(r => schedule[_key(r.id, d)] === zone.id && grp.pgyLevels.includes(r.pgyLevel)).length;
        if (currentCount >= minCount) continue;
        const candidates = groupResidents.filter(r => canAssign(r.id, d, zone.id)).sort(makeComparator(zone.id, d));
        candidates.slice(0, minCount - currentCount).forEach(r => assign(r.id, d, zone.id));
      }
    });
  });
  // ADIM 2
  const orderedZones = [...zones].sort((a, b) => {
    const minA = config.zoneMinPerDay[a.id] || 0, minB = config.zoneMinPerDay[b.id] || 0;
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
      const candidates = residents.filter(r => canAssign(r.id, d, zone.id)).sort(makeComparator(zone.id, d));
      candidates.slice(0, minCount - current).forEach(r => assign(r.id, d, zone.id));
    });
  }
  // ADIM 3
  for (let d = 1; d <= days; d++) {
    orderedZones.forEach(zone => {
      if (!isZoneActive(d, zone, y, m)) return;
      const maxCount = config.zoneMaxPerDay[zone.id] || 99;
      if (countInZone(d, zone.id) >= maxCount) return;
      const candidates = residents.filter(r => canAssign(r.id, d, zone.id) && remaining(r.id) > 0).sort(makeComparator(zone.id, d));
      candidates.forEach(r => {
        if (countInZone(d, zone.id) >= maxCount) return;
        if (!canAssign(r.id, d, zone.id)) return;
        assign(r.id, d, zone.id);
      });
    });
  }
  // ADIM 4
  if (WEEKEND_BALANCE === 'equal') {
    const weekendDays = [];
    for (let d = 1; d <= days; d++) { if (isWeekend(y, m, d)) weekendDays.push(d); }
    const avgWE = residents.length ? residents.reduce((s, r) => s + (load[r.id].weekendCount || 0), 0) / residents.length : 0;
    residents.forEach(r => {
      if ((load[r.id].weekendCount || 0) <= Math.ceil(avgWE) + 1) return;
      weekendDays.forEach(d => {
        const assignedZone = schedule[_key(r.id, d)];
        if (!assignedZone) return;
        const swapCandidate = residents.find(r2 => r2.id !== r.id && !schedule[_key(r2.id, d)] && (load[r2.id].weekendCount || 0) < Math.floor(avgWE) && canAssign(r2.id, d, assignedZone, { ignoreTarget: true }));
        if (swapCandidate) {
          delete schedule[_key(r.id, d)];
          load[r.id].total--;
          load[r.id].byZone[assignedZone] = Math.max(0, (load[r.id].byZone[assignedZone] || 1) - 1);
          load[r.id].weekendCount = Math.max(0, (load[r.id].weekendCount || 1) - 1);
          assign(swapCandidate.id, d, assignedZone);
        }
      });
    });
  }
  // ANALİZ
  const targetVsActual = residents.map(r => ({ residentId: r.id, pgyLevel: r.pgyLevel, target: targetShifts(r), actual: load[r.id].total, diff: targetShifts(r) - load[r.id].total, weekendShifts: load[r.id].weekendCount || 0 }));
  const violations = [];
  for (let d = 1; d <= days; d++) {
    zones.forEach(zone => {
      if (!isZoneActive(d, zone, y, m)) return;
      const minCount = config.zoneMinPerDay[zone.id] || 0;
      const actual = residents.filter(r => schedule[_key(r.id, d)] === zone.id).length;
      if (actual < minCount) violations.push({ day: d, zoneId: zone.id, type: 'min_not_met', required: minCount, actual });
    });
  }
  const unmetPreferences = [];
  preferences.forEach(p => {
    (p.preferredDays || []).forEach(d => { if (!schedule[_key(p.residentId, d)]) unmetPreferences.push({ residentId: p.residentId, day: d, type: 'preferred_not_assigned' }); });
    (p.avoidDays || []).forEach(d => { if (schedule[_key(p.residentId, d)]) unmetPreferences.push({ residentId: p.residentId, day: d, type: 'avoid_assigned' }); });
  });
  return { schedule, analysis: { targetVsActual, violations, unmetPreferences } };
}

// ── Yardımcı: test verisi üretici ──────────────────────────────────────────

function makeResidents(count, opts = {}) {
  const list = [];
  for (let i = 1; i <= count; i++) {
    list.push({
      id: `r${i}`,
      name: `Asistan ${i}`,
      pgyLevel: opts.pgyLevel || ((i % 5) + 1),
      status: 'active',
      leaveDays: opts.leaveDays && opts.leaveDays[`r${i}`] ? opts.leaveDays[`r${i}`] : [],
      monthlyTargetOverride: {},
    });
  }
  return list;
}

function makeZones(count, opts = {}) {
  const list = [];
  for (let i = 1; i <= count; i++) {
    list.push({
      id: `z${i}`,
      name: `Alan ${i}`,
      isActive: true,
      activeDays: opts.activeDays || [],
      seniorityGroups: opts.seniorityGroups && opts.seniorityGroups[`z${i}`] ? opts.seniorityGroups[`z${i}`] : [],
    });
  }
  return list;
}

function makeConfig(zones, overrides = {}) {
  const zoneMinPerDay = {}, zoneMaxPerDay = {}, zoneQuota = {};
  zones.forEach(z => {
    zoneMinPerDay[z.id] = overrides.minPerDay ?? 1;
    zoneMaxPerDay[z.id] = overrides.maxPerDay || 3;
    zoneQuota[z.id] = overrides.quota || { 1: 99, 2: 99, 3: 99, 4: 99, 5: 99 };
  });
  return {
    consecutiveDistance: overrides.consecutiveDistance ?? 1,
    avoidanceStrength: overrides.avoidanceStrength || 'strong',
    weekendBalance: overrides.weekendBalance || 'equal',
    leaveTargetAdjust: overrides.leaveTargetAdjust || 'proportional',
    targetShiftsByPgy: overrides.targetShiftsByPgy || { 1: 8, 2: 8, 3: 7, 4: 6, 5: 5 },
    zoneMinPerDay, zoneMaxPerDay, zoneQuota,
    avoidDayOfWeek: {}, preferDayOfWeek: {},
  };
}

// ── 1. Normal senaryo: 10 asistan, 5 alan, 1 ay ────────────────────────────

describe('Normal Senaryo (10 asistan, 5 alan, Ocak 2025)', () => {
  const residents = makeResidents(10);
  const zones = makeZones(5);
  const config = makeConfig(zones);

  const result = runAlgorithmPatched({
    residents, zones, config,
    preferences: [], trainingBlocks: [],
    year: 2025, month: 0,
  });

  it('schedule ve analysis döndürmeli', () => {
    assert.ok(result.schedule);
    assert.ok(result.analysis);
  });

  it('en az bir atama yapılmış olmalı', () => {
    assert.ok(Object.keys(result.schedule).length > 0);
  });

  it('hiçbir asistan hedefinin üstünde atanmamalı', () => {
    const load = {};
    for (const [k] of Object.entries(result.schedule)) {
      const resId = k.split('_')[0];
      load[resId] = (load[resId] || 0) + 1;
    }
    for (const r of residents) {
      const target = config.targetShiftsByPgy[r.pgyLevel];
      const actual = load[r.id] || 0;
      assert.ok(actual <= target + 1, `${r.id} PGY${r.pgyLevel} hedef=${target} gerçek=${actual}`);
    }
  });

  it('analysis.targetVsActual tüm asistanları içermeli', () => {
    assert.equal(result.analysis.targetVsActual.length, 10);
  });

  it('violations dizisi olmalı', () => {
    assert.ok(Array.isArray(result.analysis.violations));
  });
});

// ── 2. Ardışık nöbet kısıtı ─────────────────────────────────────────────────

describe('Ardışık Nöbet Kısıtı', () => {
  it('consecutiveDistance=1 iken art arda gün ataması olmamalı', () => {
    const residents = makeResidents(10);
    const zones = makeZones(3);
    const config = makeConfig(zones, { consecutiveDistance: 1 });

    const { schedule } = runAlgorithmPatched({
      residents, zones, config,
      preferences: [], trainingBlocks: [],
      year: 2025, month: 0,
    });

    for (const r of residents) {
      for (let d = 1; d <= 30; d++) {
        if (schedule[_key(r.id, d)] && schedule[_key(r.id, d + 1)]) {
          assert.fail(`${r.id} gün ${d} ve ${d + 1} arka arkaya atanmış`);
        }
      }
    }
  });

  it('consecutiveDistance=2 iken 2 gün mesafe korunmalı', () => {
    const residents = makeResidents(10);
    const zones = makeZones(2);
    const config = makeConfig(zones, { consecutiveDistance: 2 });

    const { schedule } = runAlgorithmPatched({
      residents, zones, config,
      preferences: [], trainingBlocks: [],
      year: 2025, month: 0,
    });

    for (const r of residents) {
      for (let d = 1; d <= 29; d++) {
        if (schedule[_key(r.id, d)]) {
          assert.ok(!schedule[_key(r.id, d + 1)], `${r.id} gün ${d}/${d + 1} mesafe=2 ihlali`);
          assert.ok(!schedule[_key(r.id, d + 2)], `${r.id} gün ${d}/${d + 2} mesafe=2 ihlali`);
        }
      }
    }
  });

  it('önceki ay son gün nöbeti varsa 1. güne atamazsın', () => {
    const residents = makeResidents(5);
    const zones = makeZones(2);
    const config = makeConfig(zones, { consecutiveDistance: 1 });

    const { schedule } = runAlgorithmPatched({
      residents, zones, config,
      preferences: [], trainingBlocks: [],
      year: 2025, month: 0,
      prevMonthLastDays: { r1: true },
    });

    assert.ok(!schedule[_key('r1', 1)], 'r1 önceki ay son gün nöbetli, 1. güne atanmamalı');
  });
});

// ── 3. İzinli asistan ──────────────────────────────────────────────────────

describe('İzinli Asistan', () => {
  it('izin gününe atama yapılmamalı', () => {
    const residents = makeResidents(5);
    residents[0].leaveDays = [5, 6, 7, 8, 9, 10];
    const zones = makeZones(2);
    const config = makeConfig(zones);

    const { schedule } = runAlgorithmPatched({
      residents, zones, config,
      preferences: [], trainingBlocks: [],
      year: 2025, month: 0,
    });

    for (const d of [5, 6, 7, 8, 9, 10]) {
      assert.ok(!schedule[_key('r1', d)], `r1 izinli gün ${d}'e atanmamalı`);
    }
  });

  it('izinli asistanın hedefi orantılı azaltılmalı (proportional)', () => {
    const residents = makeResidents(5);
    const leaveDays = [];
    for (let d = 1; d <= 15; d++) leaveDays.push(d);
    residents[0].leaveDays = leaveDays;

    const zones = makeZones(2);
    const config = makeConfig(zones, {
      targetShiftsByPgy: { 1: 10, 2: 10, 3: 10, 4: 10, 5: 10 },
      leaveTargetAdjust: 'proportional',
    });

    const { analysis } = runAlgorithmPatched({
      residents, zones, config,
      preferences: [], trainingBlocks: [],
      year: 2025, month: 0,
    });

    const r1 = analysis.targetVsActual.find(x => x.residentId === 'r1');
    // 10 * (31-15)/31 ≈ 5.16 → round → 5
    assert.ok(r1.target >= 4 && r1.target <= 6, `İzinli hedef beklenen aralıkta değil: ${r1.target}`);
  });

  it('inaktif asistana atama yapılmamalı', () => {
    const residents = makeResidents(5);
    residents[0].status = 'inactive';
    const zones = makeZones(2);
    const config = makeConfig(zones);

    const { schedule } = runAlgorithmPatched({
      residents, zones, config,
      preferences: [], trainingBlocks: [],
      year: 2025, month: 0,
    });

    const r1Assignments = Object.keys(schedule).filter(k => k.startsWith('r1_'));
    assert.equal(r1Assignments.length, 0, 'İnaktif asistana atama yapılmamalı');
  });
});

// ── 4. Hafta sonu dengesi ──────────────────────────────────────────────────

describe('Hafta Sonu Dengesi', () => {
  it('weekendBalance=equal iken hafta sonu dağılımı makul olmalı', () => {
    const residents = makeResidents(8, { pgyLevel: 1 });
    const zones = makeZones(2);
    const config = makeConfig(zones, { weekendBalance: 'equal' });

    const { analysis } = runAlgorithmPatched({
      residents, zones, config,
      preferences: [], trainingBlocks: [],
      year: 2025, month: 0,
    });

    const weCounts = analysis.targetVsActual.map(r => r.weekendShifts);
    const maxWE = Math.max(...weCounts);
    const minWE = Math.min(...weCounts);
    assert.ok(maxWE - minWE <= 3, `Hafta sonu farkı çok büyük: max=${maxWE} min=${minWE}`);
  });
});

// ── 5. Kıdem grubu zorunlulukları ──────────────────────────────────────────

describe('Kıdem Grubu Zorunlulukları', () => {
  it('minCount kıdem grubu her aktif günde karşılanmalı', () => {
    const residents = makeResidents(10);
    const seniorityGroups = {
      z1: [{ pgyLevels: [4, 5], minCount: 1, maxCount: 2 }],
    };
    const zones = makeZones(3, { seniorityGroups });
    const config = makeConfig(zones);

    const { schedule } = runAlgorithmPatched({
      residents, zones, config,
      preferences: [], trainingBlocks: [],
      year: 2025, month: 0,
    });

    for (let d = 1; d <= 31; d++) {
      const seniorInZ1 = residents.filter(r =>
        schedule[_key(r.id, d)] === 'z1' && [4, 5].includes(r.pgyLevel)
      ).length;
      const totalInZ1 = residents.filter(r => schedule[_key(r.id, d)] === 'z1').length;
      if (totalInZ1 > 0) {
        assert.ok(seniorInZ1 >= 1, `Gün ${d}: z1'de kıdemli yok (toplam=${totalInZ1})`);
      }
    }
  });

  it('maxCount kıdem grubu aşılmamalı', () => {
    const residents = makeResidents(10);
    const seniorityGroups = {
      z1: [{ pgyLevels: [1, 2], minCount: 0, maxCount: 1 }],
    };
    const zones = makeZones(2, { seniorityGroups });
    const config = makeConfig(zones);

    const { schedule } = runAlgorithmPatched({
      residents, zones, config,
      preferences: [], trainingBlocks: [],
      year: 2025, month: 0,
    });

    for (let d = 1; d <= 31; d++) {
      const juniorInZ1 = residents.filter(r =>
        schedule[_key(r.id, d)] === 'z1' && [1, 2].includes(r.pgyLevel)
      ).length;
      assert.ok(juniorInZ1 <= 1, `Gün ${d}: z1'de junior ${juniorInZ1} > maxCount=1`);
    }
  });
});

// ── 6. 0 Asistan Edge Case ────────────────────────────────────────────────

describe('Edge Case: 0 Asistan', () => {
  it('asistan yoksa boş çizelge döndürmeli', () => {
    const zones = makeZones(3);
    const config = makeConfig(zones);

    const { schedule, analysis } = runAlgorithmPatched({
      residents: [], zones, config,
      preferences: [], trainingBlocks: [],
      year: 2025, month: 0,
    });

    assert.equal(Object.keys(schedule).length, 0);
    assert.equal(analysis.targetVsActual.length, 0);
  });
});

// ── 7. Tüm Günler İzinli Edge Case ────────────────────────────────────────

describe('Edge Case: Tüm Günler İzinli', () => {
  it('tüm günleri izinli asistana atama yapılmamalı', () => {
    const residents = makeResidents(3);
    const allDays = [];
    for (let d = 1; d <= 31; d++) allDays.push(d);
    residents[0].leaveDays = allDays;

    const zones = makeZones(2);
    const config = makeConfig(zones);

    const { schedule } = runAlgorithmPatched({
      residents, zones, config,
      preferences: [], trainingBlocks: [],
      year: 2025, month: 0,
    });

    const r1Assignments = Object.keys(schedule).filter(k => k.startsWith('r1_'));
    assert.equal(r1Assignments.length, 0, 'Tüm ay izinli asistana atama yapılmamalı');
  });
});

// ── 8. Tercih ve Kaçınma ────────────────────────────────────────────────────

describe('Tercih ve Kaçınma', () => {
  it('avoidanceStrength=strict iken kaçınma günlerine atama yapılmamalı', () => {
    const residents = makeResidents(8, { pgyLevel: 2 });
    const zones = makeZones(2);
    const config = makeConfig(zones, { avoidanceStrength: 'strict' });
    const preferences = [{ residentId: 'r1', preferredDays: [], avoidDays: [10, 11, 12] }];

    const { schedule } = runAlgorithmPatched({
      residents, zones, config, preferences,
      trainingBlocks: [], year: 2025, month: 0,
    });

    for (const d of [10, 11, 12]) {
      assert.ok(!schedule[_key('r1', d)], `r1 kaçınma günü ${d}'e atanmamalı (strict)`);
    }
  });

  it('avoidanceStrength=strong iken kaçınma günlerine atama yapılmamalı', () => {
    const residents = makeResidents(8, { pgyLevel: 2 });
    const zones = makeZones(2);
    const config = makeConfig(zones, { avoidanceStrength: 'strong' });
    const preferences = [{ residentId: 'r1', preferredDays: [], avoidDays: [15, 16] }];

    const { schedule } = runAlgorithmPatched({
      residents, zones, config, preferences,
      trainingBlocks: [], year: 2025, month: 0,
    });

    for (const d of [15, 16]) {
      assert.ok(!schedule[_key('r1', d)], `r1 kaçınma günü ${d}'e atanmamalı (strong)`);
    }
  });
});

// ── 9. Eğitim Bloğu ────────────────────────────────────────────────────────

describe('Eğitim Bloğu (Training Full Block)', () => {
  it('recurring full_day_off gününe atama yapılmamalı', () => {
    const residents = makeResidents(5, { pgyLevel: 1 });
    const zones = makeZones(2);
    const config = makeConfig(zones);
    const trainingBlocks = [{ mode: 'full_day_off', type: 'recurring', dayOfWeek: 0, affectedPgyLevels: [1] }];

    const { schedule } = runAlgorithmPatched({
      residents, zones, config,
      preferences: [], trainingBlocks,
      year: 2025, month: 0,
    });

    // Ocak 2025 Pazartesi günleri: 6, 13, 20, 27
    for (const r of residents) {
      for (const d of [6, 13, 20, 27]) {
        assert.ok(!schedule[_key(r.id, d)], `${r.id} Pazartesi gün ${d} eğitim bloğu ihlali`);
      }
    }
  });
});
