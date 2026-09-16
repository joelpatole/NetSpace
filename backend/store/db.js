import { JSONFilePreset } from 'lowdb/node';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'data', 'db.json');

const defaultData = {
  devices: {},       // keyed by MAC address: { nickname, notes, firstSeen, lastSeen }
  settings: {
    refreshIntervalSeconds: 20,
    maxOverride: null,
    onlineVendorLookupEnabled: false
  },
  networkInfo: null,  // cached network info from last scan
  dropLogs: []        // array of { id, timestamp, event, message }
};

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
  // Keep only the last 100 logs
  if (db.data.dropLogs.length > 100) {
    db.data.dropLogs = db.data.dropLogs.slice(-100);
  }
  await db.write();
}

export async function clearDropLogs() {
  const db = await getDb();
  db.data.dropLogs = [];
  await db.write();
}
