import { useState, useEffect, useCallback, useRef } from 'react';
import { useNetwork } from './hooks/useNetwork.js';
import Header from './components/Header.jsx';
import NetworkMap from './components/NetworkMap.jsx';
import DeviceDrawer from './components/DeviceDrawer.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import LogsModal from './components/LogsModal.jsx';
import SpeedTestModal from './components/SpeedTestModal.jsx';
import NetworkHealthModal from './components/NetworkHealthModal.jsx';
import LoadingState from './components/LoadingState.jsx';
import ErrorState from './components/ErrorState.jsx';
import Footer from './components/Footer.jsx';
import MobileList from './components/MobileList.jsx';
import { isNewDevice } from './utils/devices.js';
import { fetchNetworkHealth } from './utils/api.js';

export default function App() {
  const {
    network, devices, settings, loading, scanning, error,
    autoRefresh, setAutoRefresh, scan, refresh, refreshSettings
  } = useNetwork();

  // Track the selection by id so the drawer follows live scan updates instead
  // of showing a snapshot frozen at the moment the device was clicked.
  const [selectedId, setSelectedId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showSpeedTest, setShowSpeedTest] = useState(false);
  const [showHealth, setShowHealth] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [healthStatus, setHealthStatus] = useState('healthy');
  const healthIntervalRef = useRef(null);

  // Periodically fetch health status for the header indicator
  const loadHealthStatus = useCallback(async () => {
    try {
      const data = await fetchNetworkHealth();
      setHealthStatus(data.status || 'healthy');
    } catch {
      // Silent fail — header dot stays green
    }
  }, []);

  useEffect(() => {
    loadHealthStatus();
    healthIntervalRef.current = setInterval(loadHealthStatus, 30000); // every 30s
    return () => clearInterval(healthIntervalRef.current);
  }, [loadHealthStatus]);

  const selectedDevice = selectedId ? devices.find(d => d.id === selectedId) : null;
  const newDeviceCount = devices.filter(d => d.status === 'online' && isNewDevice(d)).length;

  // Filter devices by search
  const filteredDevices = devices.filter(d => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (d.nickname && d.nickname.toLowerCase().includes(q)) ||
      (d.hostname && d.hostname.toLowerCase().includes(q)) ||
      (d.vendor && d.vendor.toLowerCase().includes(q)) ||
      d.ip.includes(q) ||
      d.mac.includes(q) ||
      d.deviceType.toLowerCase().includes(q)
    );
  });

  // Highlighted device IDs from search
  const highlightedIds = searchQuery
    ? new Set(filteredDevices.map(d => d.id))
    : null;

  if (loading) return <LoadingState />;

  return (
    <div className="h-full w-full flex flex-col bg-ns-bg overflow-hidden">
      <Header
        network={network}
        scanning={scanning}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={() => setAutoRefresh(!autoRefresh)}
        onScan={scan}
        onOpenSettings={() => setShowSettings(true)}
        onOpenLogs={() => setShowLogs(true)}
        onOpenSpeedTest={() => setShowSpeedTest(true)}
        onOpenHealth={() => setShowHealth(true)}
        healthStatus={healthStatus}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        refreshInterval={settings?.refreshIntervalSeconds}
        newDeviceCount={newDeviceCount}
      />

      {error && <ErrorState message={error} onRetry={scan} />}

      <main className="flex-1 relative overflow-hidden">
        {/* Desktop: Radial Map */}
        <div className="hidden md:block h-full">
          <NetworkMap
            network={network}
            devices={searchQuery ? filteredDevices : devices}
            highlightedIds={highlightedIds}
            onSelectDevice={(d) => setSelectedId(d.id)}
          />
        </div>

        {/* Mobile: Card List */}
        <div className="md:hidden h-full overflow-y-auto pb-16">
          <MobileList
            network={network}
            devices={searchQuery ? filteredDevices : devices}
            onSelectDevice={(d) => setSelectedId(d.id)}
          />
        </div>
      </main>

      <Footer />

      {selectedDevice && (
        <DeviceDrawer
          device={selectedDevice}
          network={network}
          onClose={() => setSelectedId(null)}
          onUpdate={() => refresh()}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          network={network}
          onClose={() => setShowSettings(false)}
          onSaved={() => { refreshSettings(); refresh(); }}
        />
      )}

      {showLogs && (
        <LogsModal onClose={() => setShowLogs(false)} />
      )}

      {showSpeedTest && (
        <SpeedTestModal onClose={() => setShowSpeedTest(false)} />
      )}

      {showHealth && (
        <NetworkHealthModal onClose={() => { setShowHealth(false); loadHealthStatus(); }} />
      )}
    </div>
  );
}
