import { useCallback, useEffect, useState } from 'react';

export interface ToastContent {
  message: string;
  action?: { label: string; run: () => void };
}

interface ToastState extends ToastContent {
  /** Changes on every show, so showing the same text again restarts the timer. */
  key: number;
}

const TOAST_MS = 8000;

/** One short message at a time at the bottom of the panel, hidden after 8 seconds. */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((content: ToastContent) => setToast({ ...content, key: Date.now() }), []);
  const dismissToast = useCallback(() => setToast(null), []);

  return { toast, showToast, dismissToast };
}

/**
 * The live region stays mounted even when empty, so screen readers announce
 * each new message.
 */
export function ToastRegion({ toast, onDismiss }: { toast: ToastContent | null; onDismiss: () => void }) {
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toast && (
        <div className="toast">
          <span className="toast-message">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                toast.action?.run();
                onDismiss();
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button type="button" className="toast-close" aria-label="Dismiss message" onClick={onDismiss}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
