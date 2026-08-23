import { useState } from 'react';
import { useApp } from '@/app/AppContext';


export function useRuntimesViewModel() {
  const { runtimes, scanLocalRuntimes, isScanningRuntimes, setDefaultRuntime } = useApp();
  const [selectedRuntimeId, setSelectedRuntimeId] = useState<string | null>(null);

  const handleScan = async () => {
    await scanLocalRuntimes();
  };

  const selectedRuntime = runtimes.find(r => r.id === selectedRuntimeId) || runtimes[0] || null;

  return {
    runtimes,
    selectedRuntime,
    selectedRuntimeId,
    setSelectedRuntimeId,
    isScanningRuntimes,
    handleScan,
    setDefaultRuntime
  };
}
