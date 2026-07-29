import { useEffect, useState } from 'preact/hooks';

/**
 * Whether the browser currently believes it has a network connection.
 *
 * Deliberately limited: `navigator.onLine` only reports whether an interface is
 * up, so it stays `true` on a captive-portal wifi or a connection that reaches
 * the router and nothing else — precisely the case that hung a save. This is a
 * heads-up for the obvious case, NOT the fix for it; the save path is made safe
 * by its own timeout (see SAVE_ACK_TIMEOUT_MS), never by trusting this flag.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    // The flag can flip between first render and this effect attaching.
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
