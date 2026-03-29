/**
 * AcilX Cloud Functions — Ana giriş noktası
 * Tüm fonksiyonlar buradan export edilir.
 */

const { initializeApp } = require('firebase-admin/app');
initializeApp();

// ── Nöbet ─────────────────────────────────────────────
const { generateSchedule } = require('./schedule/generate');
const { onSchedulePublished } = require('./schedule/triggers');

// ── Tercih ────────────────────────────────────────────
const { openPreferencePeriod, closePreferencePeriod } = require('./preferences/manage');

// ── Swap ──────────────────────────────────────────────
const { onSwapCreated, onSwapUpdated } = require('./swap/triggers');

// ── Bildirimler ───────────────────────────────────────
const { scheduledShiftReminder, scheduledPreferenceReminder } = require('./notifications/scheduled');

// ── Klinik yönetimi ───────────────────────────────────
const { createClinic, approveClinic, joinClinic, autoMatchResident, deleteClinic } = require('./clinic/manage');
const { importFromSchedule } = require('./clinic/import-schedule');

module.exports = {
  // Nöbet
  generateSchedule,
  onSchedulePublished,

  // Tercih
  openPreferencePeriod,
  closePreferencePeriod,

  // Swap
  onSwapCreated,
  onSwapUpdated,

  // Bildirimler (zamanlı)
  scheduledShiftReminder,
  scheduledPreferenceReminder,

  // Klinik
  createClinic,
  approveClinic,
  joinClinic,
  autoMatchResident,
  importFromSchedule,
  deleteClinic,
};
