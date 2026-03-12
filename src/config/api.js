// API Configuration - ensure base URL always ends with /api for correct endpoint paths
const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://ykc-finserv.onrender.com/';
const normalized = rawBaseUrl.replace(/\/+$/, ''); // Remove trailing slashes
const API_BASE_URL = normalized.endsWith('/api') ? normalized : normalized + '/api';

// Log API configuration in development
if (import.meta.env.DEV) {
  console.log('🔧 API Configuration:', {
    baseURL: API_BASE_URL,
    envVar: import.meta.env.VITE_API_BASE_URL || 'Not set (using default)',
    message: 'Make sure the backend server is running on port 5000'
  });
}

export default API_BASE_URL;
