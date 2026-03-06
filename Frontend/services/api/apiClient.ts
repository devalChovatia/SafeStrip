import axios from 'axios';

// Base API configuration – strip trailing slash so paths like "/sensor-readings" don't become "//sensor-readings"
// Supports separate dev/prod URLs:
// - EXPO_PUBLIC_API_URL_DEV -> used in __DEV__ when set (e.g. local FastAPI)
// - EXPO_PUBLIC_API_URL     -> used in production when set (e.g. hosted backend)
// Falls back to whichever is defined, then localhost.
const DEV_BASE = process.env.EXPO_PUBLIC_API_URL_DEV;
const PROD_BASE = process.env.EXPO_PUBLIC_API_URL;

const RAW_BASE =
  (__DEV__ ? DEV_BASE || PROD_BASE : PROD_BASE || DEV_BASE) ||
  'http://localhost:8000';

const API_BASE_URL = RAW_BASE.replace(/\/$/, '');

if (__DEV__) {
  console.log('[apiClient] baseURL:', API_BASE_URL, '| __DEV__:', __DEV__, '| DEV_BASE:', DEV_BASE, '| PROD_BASE:', PROD_BASE);
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token + debug logging
apiClient.interceptors.request.use(
  async (config) => {
    if (__DEV__) {
      const url = (config.baseURL || '') + (config.url || '');
      console.log('[apiClient] →', config.method?.toUpperCase(), url);
    }
    // TODO: Add auth token from secure storage
    // const token = await SecureStore.getItemAsync('auth_token');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors + debug logging
apiClient.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      console.log('[apiClient] ←', response.status, response.config.url);
    }
    return response;
  },
  (error) => {
    if (__DEV__) {
      const url = error.config?.baseURL + error.config?.url;
      console.log('[apiClient] ✗', error.message, url, error.response?.status);
    }
    if (error.response?.status === 401) {
      // Handle unauthorized access
      // TODO: Clear auth token and redirect to login
    }
    return Promise.reject(error);
  }
);

export default apiClient;
