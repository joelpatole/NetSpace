import { JSONFilePreset } from 'lowdb/node';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'data', 'db.json');

const defaultData = {
  devices: {},       // keyed by MAC address: { nickname, notes, firstSeen, lastSeen, name, ip }
  settings: {
    refreshIntervalSeconds: 20,
    maxOverride: null,
    onlineVendorLookupEnabled: false
  },
  networkInfo: null,  // cached network info from last scan
  dropLogs: [],       // array of { id, timestamp, event, message, duration?, diagnosis? }
  history: {},        // keyed by MAC: [{ t, o, p }] availability/latency samples
  historyUpdatedAt: null,
  deviceEvents: [],   // array of { id, timestamp, type, mac, name, ip }
  networkHealth: null  // latest health snapshot from connection monitor
};

// Availability history is kept at a coarse resolution so the JSON store stays
// small: one sample per device per 5 minutes, over a rolling 24 hours.
export const HISTORY_WINDOW_MS = 24 * 60 * 60 * 1000;
const HISTORY_SAMPLE_INTERVAL_MS = 5 * 60 * 1000;
const MAX_SAMPLES_PER_DEVICE = 320;
const MAX_DEVICE_EVENTS = 300;

let dbInstance = null;

export async function getDb() {
  if (!dbInstance) {
    dbInstance = await JSONFilePreset(dbPath, defaultData);
  }
  return dbInstance;
}

// Device persistence helpers
export async function getDeviceOverrides(mac) {
  const db = await getDb();
  return db.data.devices[mac] || {};
}

export async function setDeviceOverride(mac, updates) {
  const db = await getDb();
  if (!db.data.devices[mac]) {
    db.data.devices[mac] = {};
  }
  Object.assign(db.data.devices[mac], updates);
  await db.write();
}

export async function getSettings() {
  const db = await getDb();
  return db.data.settings;
}

export async function updateSettings(updates) {
  const db = await getDb();
  Object.assign(db.data.settings, updates);
  await db.write();
  return db.data.settings;
}

export async function cacheNetworkInfo(info) {
  const db = await getDb();
  db.data.networkInfo = info;
  await db.write();
}

export async function getCachedNetworkInfo() {
  const db = await getDb();
  return db.data.networkInfo;
}

// Drop Logs persistence helpers
export async function getDropLogs() {
  const db = await getDb();
  return db.data.dropLogs || [];
}

export async function addDropLog(log) {
  const db = await getDb();
  if (!db.data.dropLogs) db.data.dropLogs = [];
  db.data.dropLogs.push(log);
  // Keep only the last 200 logs for richer history
  if (db.data.dropLogs.length > 200) {
    db.data.dropLogs = db.data.dropLogs.slice(-200);
  }
  await db.write();
}

export async function clearDropLogs() {
  const db = await getDb();
  db.data.dropLogs = [];
  await db.write();
}

// ---------------------------------------------------------------------------
// Network Health persistence
// ---------------------------------------------------------------------------

export async function getNetworkHealth() {
  const db = await getDb();
  return db.data.networkHealth || null;
}

export async function updateNetworkHealth(data) {
  const db = await getDb();
  db.data.networkHealth = data;
  await db.write();
}

// ---------------------------------------------------------------------------
// Device registry — what we have ever seen, so "first seen" survives restarts
// and genuinely new devices can be told apart from familiar ones.
// ---------------------------------------------------------------------------

export async function getAllDeviceRecords() {
  const db = await getDb();
  if (!db.data.devices) db.data.devices = {};
  return db.data.devices;
}

export async function upsertDeviceRecords(records) {
  const db = await getDb();
  if (!db.data.devices) db.data.devices = {};
  for (const [mac, update] of Object.entries(records)) {
    db.data.devices[mac] = { ...db.data.devices[mac], ...update };
  }
  await db.write();
}

// ---------------------------------------------------------------------------
// Availability / latency history
// ---------------------------------------------------------------------------

export async function getDeviceHistory(mac) {
  const db = await getDb();
  const samples = (db.data.history && db.data.history[mac]) || [];
  const cutoff = Date.now() - HISTORY_WINDOW_MS;
  return samples.filter(s => s.t >= cutoff);
}

/**
 * Append one sample per device, throttled to HISTORY_SAMPLE_INTERVAL_MS.
 * @param {Array<{mac: string, online: boolean, pingMs: number|null}>} samples
 * @returns {Promise<boolean>} whether a sample was actually written
 */
export async function recordHistorySamples(samples, now = Date.now()) {
  const db = await getDb();
  if (!db.data.history) db.data.history = {};

  if (db.data.historyUpdatedAt && now - db.data.historyUpdatedAt < HISTORY_SAMPLE_INTERVAL_MS) {
    return false;
  }

  const cutoff = now - HISTORY_WINDOW_MS;
  const liveMacs = new Set(samples.map(s => s.mac));

  for (const sample of samples) {
    const list = db.data.history[sample.mac] || [];
    list.push({ t: now, o: sample.online ? 1 : 0, p: sample.pingMs ?? null });
    db.data.history[sample.mac] = list
      .filter(s => s.t >= cutoff)
      .slice(-MAX_SAMPLES_PER_DEVICE);
  }

  // Expire devices whose samples have all aged out of the window.
  for (const mac of Object.keys(db.data.history)) {
    if (liveMacs.has(mac)) continue;
    const kept = db.data.history[mac].filter(s => s.t >= cutoff);
    if (kept.length === 0) delete db.data.history[mac];
    else db.data.history[mac] = kept;
  }

  db.data.historyUpdatedAt = now;
  await db.write();
  return true;
}

// ---------------------------------------------------------------------------
// Device events — devices appearing, joining and leaving the network
// ---------------------------------------------------------------------------

export async function getDeviceEvents() {
  const db = await getDb();
  return db.data.deviceEvents || [];
}

export async function addDeviceEvents(events) {
  if (!events.length) return;
  const db = await getDb();
  if (!db.data.deviceEvents) db.data.deviceEvents = [];
  db.data.deviceEvents.push(...events);
  if (db.data.deviceEvents.length > MAX_DEVICE_EVENTS) {
    db.data.deviceEvents = db.data.deviceEvents.slice(-MAX_DEVICE_EVENTS);
  }
  await db.write();
}

export async function clearDeviceEvents() {
  const db = await getDb();
  db.data.deviceEvents = [];
  await db.write();
}
