import { createContext } from 'preact';
import { useCallback, useContext, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

interface ToastState {
  message: string;
  isError: boolean;
  undo: (() => void) | null;
}

interface ToastContextValue {
  showToast: (message: string, isError?: boolean) => void;
  showUndoToast: (message: string, onUndo: () => void) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast() must be used inside <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: ComponentChildren }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const hideToast = useCallback(() => {
    clearTimer();
    setToast(null);
  }, []);

  const showToast = useCallback((message: string, isError = false) => {
    clearTimer();
    setToast({ message, isError, undo: null });
    timerRef.current = setTimeout(() => setToast(null), 2500);
  }, []);

  // Matches the live app's 5s undo window (see scheduleUndoableDelete).
  const showUndoToast = useCallback((message: string, onUndo: () => void) => {
    clearTimer();
    setToast({ message, isError: false, undo: onUndo });
    timerRef.current = setTimeout(() => setToast(null), 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, showUndoToast, hideToast }}>
      {children}
      {toast && (
        <div
          class={
            'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full px-4 py-2.5 text-sm shadow-lg flex items-center gap-3 ' +
            (toast.isError ? 'bg-red-600 text-white' : 'bg-neutral-900 text-white')
          }
          style={{ pointerEvents: toast.undo ? 'auto' : 'none' }}
        >
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              class="font-bold underline underline-offset-2"
              style={{ pointerEvents: 'auto' }}
              onClick={() => {
                toast.undo?.();
                hideToast();
              }}
            >
              تراجع
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  );
}
