import apiClient from './apiClient';

// Types
export interface DashboardStats {
  activeDevices: number;
  testsToday: number;
  alerts: number;
  successRate: number;
  trends: {
    activeDevices: { value: number; isPositive: boolean };
    testsToday: { value: number; isPositive: boolean };
    alerts: { value: number; isPositive: boolean };
    successRate: { value: number; isPositive: boolean };
  };
}

export interface Device {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'warning';
  lastActive: string;
  batteryLevel: number;
  firmwareVersion?: string;
  location?: string;
}

export interface Activity {
  id: string;
  type: 'test' | 'alert' | 'device' | 'system';
  title: string;
  description: string;
  timestamp: string;
  result?: 'positive' | 'negative' | 'inconclusive';
  deviceId?: string;
}

// Mock data for development
const mockStats: DashboardStats = {
  activeDevices: 12,
  testsToday: 48,
  alerts: 3,
  successRate: 96,
  trends: {
    activeDevices: { value: 8, isPositive: true },
    testsToday: { value: 12, isPositive: true },
    alerts: { value: 2, isPositive: false },
    successRate: { value: 4, isPositive: true },
  },
};

const mockDevices: Device[] = [
  {
    id: '1',
    name: 'SafeStrip Device #1',
    status: 'online',
    lastActive: '2 min ago',
    batteryLevel: 85,
  },
  {
    id: '2',
    name: 'SafeStrip Device #2',
    status: 'online',
    lastActive: '5 min ago',
    batteryLevel: 62,
  },
  {
    id: '3',
    name: 'SafeStrip Device #3',
    status: 'warning',
    lastActive: '1 hour ago',
    batteryLevel: 15,
  },
  {
    id: '4',
    name: 'SafeStrip Device #4',
    status: 'offline',
    lastActive: '2 days ago',
    batteryLevel: 0,
  },
];

const mockActivities: Activity[] = [
  {
    id: '1',
    type: 'test',
    title: 'Test Completed',
    description: 'Device #1 completed substance test',
    timestamp: '2 min ago',
    result: 'negative',
    deviceId: '1',
  },
  {
    id: '2',
    type: 'alert',
    title: 'Low Battery Warning',
    description: 'Device #3 battery below 20%',
    timestamp: '15 min ago',
    deviceId: '3',
  },
  {
    id: '3',
    type: 'test',
    title: 'Test Completed',
    description: 'Device #2 completed substance test',
    timestamp: '32 min ago',
    result: 'positive',
    deviceId: '2',
  },
  {
    id: '4',
    type: 'device',
    title: 'Device Connected',
    description: 'Device #5 connected to network',
    timestamp: '1 hour ago',
  },
  {
    id: '5',
    type: 'system',
    title: 'System Update',
    description: 'Firmware update available for 3 devices',
    timestamp: '2 hours ago',
  },
];

// API flag for using mock data in development
const USE_MOCK_DATA = true;

// Dashboard API service
export const dashboardApi = {
  /**
   * Get dashboard statistics
   */
  async getStats(): Promise<DashboardStats> {
    if (USE_MOCK_DATA) {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 500));
      return mockStats;
    }
    
    const response = await apiClient.get<DashboardStats>('/api/dashboard/stats');
    return response.data;
  },

  /**
   * Get all devices
   */
  async getDevices(): Promise<Device[]> {
    if (USE_MOCK_DATA) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return mockDevices;
    }
    
    const response = await apiClient.get<Device[]>('/api/devices');
    return response.data;
  },

  /**
   * Get device by ID
   */
  async getDevice(id: string): Promise<Device> {
    if (USE_MOCK_DATA) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const device = mockDevices.find((d) => d.id === id);
      if (!device) throw new Error('Device not found');
      return device;
    }
    
    const response = await apiClient.get<Device>(`/api/devices/${id}`);
    return response.data;
  },

  /**
   * Get recent activities
   */
  async getRecentActivities(limit: number = 10): Promise<Activity[]> {
    if (USE_MOCK_DATA) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return mockActivities.slice(0, limit);
    }
    
    const response = await apiClient.get<Activity[]>('/api/activities', {
      params: { limit },
    });
    return response.data;
  },

  /**
   * Run a test on a device
   */
  async runTest(deviceId: string): Promise<Activity> {
    if (USE_MOCK_DATA) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const newActivity: Activity = {
        id: Date.now().toString(),
        type: 'test',
        title: 'Test Completed',
        description: `Device #${deviceId} completed substance test`,
        timestamp: 'Just now',
        result: Math.random() > 0.8 ? 'positive' : 'negative',
        deviceId,
      };
      return newActivity;
    }
    
    const response = await apiClient.post<Activity>(`/api/devices/${deviceId}/test`);
    return response.data;
  },
};

export default dashboardApi;
