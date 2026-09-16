import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchNetwork, fetchDevices, triggerScan, fetchSettings } from '../utils/api.js';

export function useNetwork() {
  const [network, setNetwork] = useState(null);
  const [devices, setDevices] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef(null);

  const loadData = useCallback(async () => {
    try {
      const [netData, devData] = await Promise.all([
        fetchNetwork(),
        fetchDevices()
      ]);
      setNetwork(netData);
      setDevices(devData);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const s = await fetchSettings();
      setSettings(s);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }, []);

  const scan = useCallback(async () => {
    setScanning(true);
    try {
      await triggerScan();
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  }, [loadData]);

  // Initial load
  useEffect(() => {
    loadData();
    loadSettings();
  }, [loadData, loadSettings]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh && settings?.refreshIntervalSeconds) {
      intervalRef.current = setInterval(loadData, settings.refreshIntervalSeconds * 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, settings?.refreshIntervalSeconds, loadData]);

  return {
    network,
    devices,
    settings,
    loading,
    scanning,
    error,
    autoRefresh,
    setAutoRefresh,
    scan,
    refresh: loadData,
    refreshSettings: loadSettings
  };
}
