import { useState } from 'react';
import { useNetwork } from './hooks/useNetwork.js';
import Header from './components/Header.jsx';
import NetworkMap from './components/NetworkMap.jsx';
import DeviceDrawer from './components/DeviceDrawer.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import LogsModal from './components/LogsModal.jsx';
import SpeedTestModal from './components/SpeedTestModal.jsx';
import LoadingState from './components/LoadingState.jsx';
import ErrorState from './components/ErrorState.jsx';
import Footer from './components/Footer.jsx';
import MobileList from './components/MobileList.jsx';

export default function App() {
  const {
    network, devices, settings, loading, scanning, error,
    autoRefresh, setAutoRefresh, scan, refresh, refreshSettings
  } = useNetwork();

  const [selectedDevice, setSelectedDevice] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showSpeedTest, setShowSpeedTest] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);

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
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        refreshInterval={settings?.refreshIntervalSeconds}
      />

      {error && <ErrorState message={error} onRetry={scan} />}

      <main className="flex-1 relative overflow-hidden">
        {/* Desktop: Radial Map */}
        <div className="hidden md:block h-full">
          <NetworkMap
            network={network}
            devices={searchQuery ? filteredDevices : devices}
            highlightedIds={highlightedIds}
            onSelectDevice={setSelectedDevice}
          />
        </div>

        {/* Mobile: Card List */}
        <div className="md:hidden h-full overflow-y-auto pb-16">
          <MobileList
            network={network}
            devices={searchQuery ? filteredDevices : devices}
            onSelectDevice={setSelectedDevice}
          />
        </div>
      </main>

      <Footer />

      {selectedDevice && (
        <DeviceDrawer
          device={selectedDevice}
          onClose={() => setSelectedDevice(null)}
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
    </div>
  );
}
