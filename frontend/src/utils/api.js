const API_BASE = '/api';

export async function fetchNetwork() {
  const res = await fetch(`${API_BASE}/network`);
  if (!res.ok) throw new Error('Failed to fetch network info');
  return res.json();
}

export async function fetchDevices() {
  const res = await fetch(`${API_BASE}/devices`);
  if (!res.ok) throw new Error('Failed to fetch devices');
  return res.json();
}

export async function triggerScan() {
  const res = await fetch(`${API_BASE}/scan`, { method: 'POST' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || data.error || 'Scan failed');
  }
  return res.json();
}

export async function updateDevice(id, updates) {
  const res = await fetch(`${API_BASE}/devices/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error('Failed to update device');
  return res.json();
}

export async function fetchSettings() {
  const res = await fetch(`${API_BASE}/settings`);
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

export async function updateSettings(settings) {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });
  if (!res.ok) throw new Error('Failed to update settings');
  return res.json();
}

export async function fetchLogs() {
  const res = await fetch(`${API_BASE}/logs`);
  if (!res.ok) throw new Error('Failed to fetch logs');
  return res.json();
}

export async function clearLogs() {
  const res = await fetch(`${API_BASE}/logs`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to clear logs');
  return res.json();
}

export async function runSpeedTest() {
  const res = await fetch(`${API_BASE}/speedtest`);
  if (!res.ok) throw new Error('Failed to run speed test');
  return res.json();
}

export async function fetchDeviceHistory(id) {
  const res = await fetch(`${API_BASE}/devices/${encodeURIComponent(id)}/history`);
  if (!res.ok) throw new Error('Failed to fetch device history');
  return res.json();
}

export async function scanDevicePorts(id) {
  const res = await fetch(`${API_BASE}/devices/${encodeURIComponent(id)}/ports`, {
    method: 'POST'
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Port scan failed');
  return data;
}

export async function fetchDeviceEvents() {
  const res = await fetch(`${API_BASE}/events`);
  if (!res.ok) throw new Error('Failed to fetch device events');
  return res.json();
}

export async function clearDeviceEvents() {
  const res = await fetch(`${API_BASE}/events`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to clear device events');
  return res.json();
}

export async function fetchNetworkHealth() {
  const res = await fetch(`${API_BASE}/network-health`);
  if (!res.ok) throw new Error('Failed to fetch network health');
  return res.json();
}
