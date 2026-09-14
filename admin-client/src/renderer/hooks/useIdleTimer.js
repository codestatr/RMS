import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useIdleTimer Hook
 * Tracks user activity and triggers auto-logout after idle threshold (default: 4 minutes = 240,000ms).
 * Displays a warning countdown 30 seconds before logout with an option to extend session.
 *
 * @param {Object} options
 * @param {number} options.timeout - Total idle timeout in milliseconds (default: 240,000 = 4 mins)
 * @param {number} options.warningTime - Time in ms before timeout to show warning (default: 30,000 = 30s)
 * @param {Function} options.onTimeout - Callback executed when timeout occurs
 * @param {boolean} options.enabled - Whether idle tracking is currently enabled
 */
export function useIdleTimer({
  timeout = 4 * 60 * 1000, // 4 minutes
  warningTime = 30 * 1000, // 30 seconds warning
  onTimeout,
  enabled = true,
}) {
  const [isWarning, setIsWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(Math.round(warningTime / 1000));
  
  const lastActivityRef = useRef(Date.now());
  const warningTimerRef = useRef(null);
  const logoutTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    setIsWarning(false);
    setRemainingSeconds(Math.round(warningTime / 1000));

    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    if (!enabled) return;

    // Warning timer fires at (timeout - warningTime)
    const timeUntilWarning = Math.max(0, timeout - warningTime);
    warningTimerRef.current = setTimeout(() => {
      setIsWarning(true);
      const startCountdown = Math.round(warningTime / 1000);
      setRemainingSeconds(startCountdown);

      countdownIntervalRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, timeUntilWarning);

    // Final logout timer fires at timeout
    logoutTimerRef.current = setTimeout(() => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      setIsWarning(false);
      if (typeof onTimeout === 'function') {
        onTimeout();
      }
    }, timeout);
  }, [timeout, warningTime, onTimeout, enabled]);

  useEffect(() => {
    if (!enabled) {
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      setIsWarning(false);
      return;
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    
    // Throttle activity reset to avoid high CPU on frequent mouse moves
    let throttleTimer = null;
    const handleActivity = () => {
      if (isWarning) {
        // While warning modal is active, require deliberate action like clicking "Stay Logged In"
        return;
      }
      if (!throttleTimer) {
        throttleTimer = setTimeout(() => {
          resetTimer();
          throttleTimer = null;
        }, 1000);
      }
    };

    events.forEach((evt) => window.addEventListener(evt, handleActivity));
    resetTimer();

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleActivity));
      if (throttleTimer) clearTimeout(throttleTimer);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [enabled, resetTimer, isWarning]);

  return {
    isWarning,
    remainingSeconds,
    resetTimer,
  };
}
