import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { DashboardHeader } from './components/DashboardHeader';
import { StatusCard } from './components/StatusCard';
import { OutletCard } from './components/OutletCard';
import DeviceCard from './components/DeviceCard';
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalCloseButton,
} from '@/components/ui/modal';
import { Button, ButtonText } from '@/components/ui/button';
import {
  Workspace,
  DeviceStrip,
  fetchWorkspaces,
  createWorkspace,
  fetchDevicesForWorkspace,
  createDevice,
} from '@/services/api/workspacesApi';

interface Outlet {
  id: number;
  name: string;
  powerOn: boolean;
  temperature: number;
  current: number;
  smokeDetected: boolean;
  waterDetected: boolean;
}

type DashboardView = 'devices' | 'deviceDetail';

interface DashboardScreenProps {
  onOpenSettings?: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onOpenSettings,
}) => {
  const insets = useSafeAreaInsets();

  // Workspace + device state
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [devices, setDevices] = useState<DeviceStrip[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null
  );
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [view, setView] = useState<DashboardView>('devices');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [deviceLabel, setDeviceLabel] = useState('');

  // Mock outlet data (per-device dashboard)
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [outlets, setOutlets] = useState<Outlet[]>([
    {
      id: 1,
      name: 'Outlet 1',
      powerOn: true,
      temperature: 24.5,
      current: 2.3,
      smokeDetected: false,
      waterDetected: false,
    },
    {
      id: 2,
      name: 'Outlet 2',
      powerOn: true,
      temperature: 26.8,
      current: 4.1,
      smokeDetected: false,
      waterDetected: false,
    },
    {
      id: 3,
      name: 'Outlet 3',
      powerOn: false,
      temperature: 23.2,
      current: 0,
      smokeDetected: false,
      waterDetected: false,
    },
    {
      id: 4,
      name: 'Outlet 4',
      powerOn: true,
      temperature: 25.1,
      current: 1.8,
      smokeDetected: false,
      waterDetected: false,
    },
  ]);

  // Simulate live sensor updates
  useEffect(() => {
    const interval = setInterval(() => {
      setOutlets((prev) =>
        prev.map((outlet) => ({
          ...outlet,
          temperature: outlet.powerOn
            ? Math.max(
                20,
                Math.min(
                  45,
                  outlet.temperature + (Math.random() - 0.5) * 0.3
                )
              )
            : outlet.temperature,
          current: outlet.powerOn
            ? Math.max(
                0,
                Math.min(10, outlet.current + (Math.random() - 0.5) * 0.1)
              )
            : 0,
        }))
      );
      setLastUpdate(new Date());
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Load workspaces on mount
  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const data = await fetchWorkspaces();
        setWorkspaces(data);
        if (data.length > 0) {
          const firstId = data[0].id;
          setSelectedWorkspaceId(firstId);
          const devs = await fetchDevicesForWorkspace(firstId);
          setDevices(devs);
        }
      } catch (e) {
        setError('Failed to load workspaces');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  const selectedWorkspace = selectedWorkspaceId
    ? workspaces.find((w) => w.id === selectedWorkspaceId) ?? null
    : null;

  const devicesForWorkspace = selectedWorkspace
    ? devices.filter((d) => d.workspace_id === selectedWorkspace.id)
    : [];

  const selectedDevice = selectedDeviceId
    ? devices.find((d) => d.id === selectedDeviceId) ?? null
    : null;

  // Device/status helpers (per-device dashboard)
  const getSystemStatus = () => {
    const activeOutlets = outlets.filter((o) => o.powerOn);

    if (activeOutlets.length === 0) {
      return {
        status: 'All Power Off',
        variant: 'neutral' as const,
      };
    }

    const hasRisk = activeOutlets.some(
      (o) => o.waterDetected || o.smokeDetected
    );
    if (hasRisk) {
      return {
        status: '⚠️ Risk Detected',
        variant: 'danger' as const,
      };
    }

    const hasWarning = activeOutlets.some(
      (o) => o.temperature > 40 || o.current > 8
    );
    if (hasWarning) {
      return {
        status: '⚠️ Warning',
        variant: 'warning' as const,
      };
    }

    return {
      status: 'All Systems Safe',
      variant: 'safe' as const,
    };
  };

  const handlePowerToggle = (outletId: number) => {
    setOutlets((prev) =>
      prev.map((outlet) =>
        outlet.id === outletId
          ? { ...outlet, powerOn: !outlet.powerOn }
          : outlet
      )
    );
  };

  const getTimeSinceUpdate = () => {
    const seconds = Math.floor(
      (Date.now() - lastUpdate.getTime()) / 1000
    );
    return `Updated ${seconds} seconds ago`;
  };

  const systemStatus = getSystemStatus();

  // Workspace + device creation
  const handleCreateWorkspace = async () => {
    if (!workspaceName.trim()) return;
    try {
      setLoading(true);
      const created = await createWorkspace({ name: workspaceName.trim() });
      setWorkspaces((prev) => [created, ...prev]);
      setSelectedWorkspaceId(created.id);
      setWorkspaceModalOpen(false);
      setWorkspaceName('');
    } catch (e) {
      setError('Failed to create workspace');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDevice = async () => {
    if (!selectedWorkspace) return;
    if (!deviceName.trim()) return;
    try {
      setLoading(true);
      const created = await createDevice({
        workspace_id: selectedWorkspace.id,
        device_name: deviceName.trim(),
        device_label: deviceLabel.trim() || null,
      });
      setDevices((prev) => [created, ...prev]);
      setDeviceModalOpen(false);
      setDeviceName('');
      setDeviceLabel('');
    } catch (e) {
      setError('Failed to create device');
    } finally {
      setLoading(false);
    }
  };

  const openDeviceDetail = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    setView('deviceDetail');
  };

  const renderDeviceDetail = () => {
    if (!selectedDevice) {
      return (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Device not found</Text>
          <Button onPress={() => setView('devices')}>
            <ButtonText>Back to devices</ButtonText>
          </Button>
        </View>
      );
    }

    return (
      <>
        <View className="px-4 pt-3 pb-2 bg-slate-50 border-b border-slate-200">
          <Pressable
            onPress={() => setView('devices')}
            className="flex-row items-center gap-2"
          >
            <Ionicons name="chevron-back" size={18} color="#0f172a" />
            <Text className="text-slate-700 text-sm font-medium">
              Back to devices
            </Text>
          </Pressable>
          <Text className="text-slate-900 text-lg font-semibold mt-1">
            {selectedDevice.device_name}
          </Text>
        </View>

        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          <View style={styles.content}>
            <StatusCard
              status={systemStatus.status}
              variant={systemStatus.variant}
              activeCount={outlets.filter((o) => o.powerOn).length}
              totalCount={outlets.length}
            />

            <View style={styles.outletsWrap}>
              <Text style={styles.sectionTitle}>
                Power Outlets
              </Text>
              {outlets.map((outlet) => (
                <OutletCard
                  key={outlet.id}
                  outlet={outlet}
                  onPowerToggle={() => handlePowerToggle(outlet.id)}
                />
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {getTimeSinceUpdate()}
          </Text>
        </View>
      </>
    );
  };

  const renderDevicesList = () => {
    if (workspaces.length === 0) {
      return (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="bg-white rounded-2xl border border-dashed border-slate-300 p-5">
            <Text className="text-slate-900 text-base font-semibold mb-2">
              Create your first workspace
            </Text>
            <Text className="text-slate-500 text-sm mb-4">
              Group your SafeStrip devices by room, like “Kitchen” or “Bedroom”.
            </Text>
            <Button onPress={() => setWorkspaceModalOpen(true)}>
              <ButtonText>Create workspace</ButtonText>
            </Button>
          </View>
        </ScrollView>
      );
    }

    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-4 flex-row items-center justify-between">
          <View>
            <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Workspace
            </Text>
            <Text className="text-slate-900 text-lg font-semibold mt-0.5">
              {selectedWorkspace?.name ?? 'Select workspace'}
            </Text>
          </View>
          <Button
            size="sm"
            onPress={() => setWorkspaceModalOpen(true)}
          >
            <ButtonText>New workspace</ButtonText>
          </Button>
        </View>

        {selectedWorkspace && (
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-slate-700 text-sm font-semibold">
              Devices
            </Text>
            <Button
              size="sm"
              onPress={() => setDeviceModalOpen(true)}
            >
              <ButtonText>Add device</ButtonText>
            </Button>
          </View>
        )}

        {selectedWorkspace && devicesForWorkspace.length === 0 && (
          <View className="bg-white rounded-2xl border border-dashed border-slate-300 p-5 mb-3">
            <Text className="text-slate-900 text-base font-semibold mb-2">
              No devices yet
            </Text>
            <Text className="text-slate-500 text-sm mb-4">
              Add your first SafeStrip device for this workspace.
            </Text>
            <Button onPress={() => setDeviceModalOpen(true)}>
              <ButtonText>Add device</ButtonText>
            </Button>
          </View>
        )}

        {selectedWorkspace &&
          devicesForWorkspace.map((d) => (
            <DeviceCard
              key={d.id}
              name={d.device_name}
              workspaceName={selectedWorkspace.name}
              status={d.status}
              lastSeenAt={d.last_seen_at ?? undefined}
              onOpen={() => openDeviceDetail(d.id)}
            />
          ))}
      </ScrollView>
    );
  };

  return (
    <View style={styles.statusBarWrapper}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <DashboardHeader onSettingsPress={onOpenSettings} />

        {view === 'deviceDetail' ? renderDeviceDetail() : renderDevicesList()}

        {loading && (
          <View className="absolute inset-0 items-center justify-center bg-black/10">
            <ActivityIndicator size="small" color="#0f172a" />
          </View>
        )}

        {/* Workspace modal */}
        <Modal isOpen={workspaceModalOpen} onClose={() => setWorkspaceModalOpen(false)}>
          <ModalBackdrop />
          <ModalContent size="md">
            <ModalHeader>
              <Text className="text-slate-900 text-base font-semibold">
                New workspace
              </Text>
              <ModalCloseButton onPress={() => setWorkspaceModalOpen(false)} />
            </ModalHeader>
            <ModalBody>
              <Text className="text-slate-700 text-sm mb-2">
                Workspace name
              </Text>
              <View className="border border-slate-300 rounded-lg px-3 py-2 bg-white">
                <TextInput
                  placeholder="e.g. Kitchen"
                  placeholderTextColor="#9ca3af"
                  value={workspaceName}
                  onChangeText={setWorkspaceName}
                  className="text-slate-900 text-base"
                />
              </View>
            </ModalBody>
            <ModalFooter>
              <Button
                variant="outline"
                action="primary"
                size="sm"
                onPress={() => setWorkspaceModalOpen(false)}
              >
                <ButtonText>Cancel</ButtonText>
              </Button>
              <Button size="sm" onPress={handleCreateWorkspace}>
                <ButtonText>Create</ButtonText>
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Device modal */}
        <Modal isOpen={deviceModalOpen} onClose={() => setDeviceModalOpen(false)}>
          <ModalBackdrop />
          <ModalContent size="md">
            <ModalHeader>
              <Text className="text-slate-900 text-base font-semibold">
                New device
              </Text>
              <ModalCloseButton onPress={() => setDeviceModalOpen(false)} />
            </ModalHeader>
            <ModalBody>
              <Text className="text-slate-500 text-xs mb-1">
                Workspace
              </Text>
              <Text className="text-slate-900 text-sm font-semibold mb-3">
                {selectedWorkspace?.name ?? 'None selected'}
              </Text>

              <Text className="text-slate-700 text-sm mb-2">
                Device name
              </Text>
              <View className="border border-slate-300 rounded-lg px-3 py-2 bg-white mb-3">
                <TextInput
                  placeholder="e.g. Beside table strip"
                  placeholderTextColor="#9ca3af"
                  value={deviceName}
                  onChangeText={setDeviceName}
                  className="text-slate-900 text-base"
                />
              </View>

              <Text className="text-slate-700 text-sm mb-2">
                Label (optional)
              </Text>
              <View className="border border-slate-300 rounded-lg px-3 py-2 bg-white">
                <TextInput
                  placeholder="Short label"
                  placeholderTextColor="#9ca3af"
                  value={deviceLabel}
                  onChangeText={setDeviceLabel}
                  className="text-slate-900 text-base"
                />
              </View>
            </ModalBody>
            <ModalFooter>
              <Button
                variant="outline"
                action="primary"
                size="sm"
                onPress={() => setDeviceModalOpen(false)}
              >
                <ButtonText>Cancel</ButtonText>
              </Button>
              <Button size="sm" onPress={handleCreateDevice} disabled={!selectedWorkspace}>
                <ButtonText>Create</ButtonText>
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {error && (
          <View className="absolute bottom-4 left-4 right-4 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <Text className="text-xs text-red-700">{error}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default DashboardScreen;

const styles = StyleSheet.create({
  statusBarWrapper: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  outletsWrap: {
    gap: 12,
  },
  sectionTitle: {
    paddingHorizontal: 2,
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  footerText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
  },
  emptyWrap: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
});

