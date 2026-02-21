import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { dashboardApi, DashboardStats, Device, Activity } from '@/services/api/dashboardApi';

interface DashboardState {
  stats: DashboardStats | null;
  devices: Device[];
  activities: Activity[];
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

const initialState: DashboardState = {
  stats: null,
  devices: [],
  activities: [],
  loading: false,
  error: null,
  lastUpdated: null,
};

// Async thunks
export const fetchDashboardStats = createAsyncThunk(
  'dashboard/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await dashboardApi.getStats();
      return response;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const fetchDevices = createAsyncThunk(
  'dashboard/fetchDevices',
  async (_, { rejectWithValue }) => {
    try {
      const response = await dashboardApi.getDevices();
      return response;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const fetchActivities = createAsyncThunk(
  'dashboard/fetchActivities',
  async (limit: number = 10, { rejectWithValue }) => {
    try {
      const response = await dashboardApi.getRecentActivities(limit);
      return response;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const fetchAllDashboardData = createAsyncThunk(
  'dashboard/fetchAll',
  async (_, { dispatch }) => {
    await Promise.all([
      dispatch(fetchDashboardStats()),
      dispatch(fetchDevices()),
      dispatch(fetchActivities(10)),
    ]);
  }
);

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    updateDeviceStatus: (
      state,
      action: PayloadAction<{ deviceId: string; status: Device['status'] }>
    ) => {
      const device = state.devices.find((d) => d.id === action.payload.deviceId);
      if (device) {
        device.status = action.payload.status;
      }
    },
    addActivity: (state, action: PayloadAction<Activity>) => {
      state.activities.unshift(action.payload);
      // Keep only the last 50 activities
      if (state.activities.length > 50) {
        state.activities = state.activities.slice(0, 50);
      }
    },
  },
  extraReducers: (builder) => {
    // Stats
    builder.addCase(fetchDashboardStats.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(fetchDashboardStats.fulfilled, (state, action) => {
      state.stats = action.payload;
      state.loading = false;
      state.lastUpdated = new Date().toISOString();
    });
    builder.addCase(fetchDashboardStats.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // Devices
    builder.addCase(fetchDevices.fulfilled, (state, action) => {
      state.devices = action.payload;
    });
    builder.addCase(fetchDevices.rejected, (state, action) => {
      state.error = action.payload as string;
    });

    // Activities
    builder.addCase(fetchActivities.fulfilled, (state, action) => {
      state.activities = action.payload;
    });
    builder.addCase(fetchActivities.rejected, (state, action) => {
      state.error = action.payload as string;
    });
  },
});

export const { clearError, updateDeviceStatus, addActivity } = dashboardSlice.actions;
export default dashboardSlice.reducer;
