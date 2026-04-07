import { authService } from './auth.service';
import { toast } from './toastService';

const INACTIVITY_MESSAGE = 'Session expired due to inactivity';

let isRedirecting = false;

/**
 * Clears local auth state and redirects to the login page.
 * Used by both:
 * - Axios 401 interceptor
 * - React inactivity auto-logout
 */
export const logoutAndRedirect = ({ reasonMessage, showAlert = false } = {}) => {
  if (isRedirecting) return;
  isRedirecting = true;

  try {
    authService.removeToken();
  } catch (_) {
    // Ignore local storage errors
  }

  const isInactivity = reasonMessage === INACTIVITY_MESSAGE;

  if (isInactivity) {
    toast.warning('Session expired', INACTIVITY_MESSAGE, 5000);
    if (showAlert) window.alert(INACTIVITY_MESSAGE);
  } else {
    toast.error('Authentication Error', 'Please login again', 5000);
  }

  // Full redirect to reset app state
  window.location.href = '/login';
};

