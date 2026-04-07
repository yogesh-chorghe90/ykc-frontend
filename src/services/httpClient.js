import axios from 'axios';
import API_BASE_URL from '../config/api';
import { authService } from './auth.service';
import { logoutAndRedirect } from './authSession';

export const httpClient = axios.create({
  baseURL: API_BASE_URL, // ends with /api
  withCredentials: true,
});

// Axios interceptor:
// - Any 401 (except login/signup) forces logout + redirect.
// - Inactivity-expired sessions show "Session expired due to inactivity".
httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const responseData = error?.response?.data;
    const reasonMessage = responseData?.message;

    const requestedUrl = error?.config?.url || '';
    const isAuthEndpoint =
      requestedUrl.includes('/auth/login') ||
      requestedUrl.includes('/auth/signup') ||
      requestedUrl.includes('/auth/register');

    if (status === 401 && !isAuthEndpoint) {
      // Mark so API wrapper doesn't double-handle
      error._authHandled = true;
      logoutAndRedirect({ reasonMessage, showAlert: reasonMessage === 'Session expired due to inactivity' });
    }

    return Promise.reject(error);
  }
);

/**
 * Helper to create request configs with auth header.
 */
export const withAuthHeader = (extraHeaders = {}) => {
  const token = authService.getToken();
  return {
    ...(extraHeaders || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

