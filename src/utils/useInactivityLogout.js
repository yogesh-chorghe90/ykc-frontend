import { useEffect, useRef } from 'react';
import { logoutAndRedirect } from '../services/authSession';
import { authService } from '../services/auth.service';

const DEFAULT_INACTIVITY_MS = 10 * 60 * 1000; // 10 minutes

/**
 * React inactivity detection:
 * - Tracks mouse, keyboard, clicks, scroll, and touch
 * - Auto-logs out after 10 minutes of no user activity
 */
export const useInactivityLogout = ({
  inactivityMs = DEFAULT_INACTIVITY_MS,
  showAlert = true,
} = {}) => {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!authService.isAuthenticated()) return;

    let isActive = true;

    const resetTimer = () => {
      if (!isActive) return;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        logoutAndRedirect({ reasonMessage: 'Session expired due to inactivity', showAlert });
      }, inactivityMs);
    };

    // Start timer immediately on mount
    resetTimer();

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));

    return () => {
      isActive = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [inactivityMs, showAlert]);
};

