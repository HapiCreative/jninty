import { useState, useEffect, useCallback } from "react";

/**
 * Detects iOS Safari (not already in standalone/PWA mode)
 * and shows a prompt guiding the user to Add to Home Screen.
 *
 * On Android/desktop Chrome, listens for the native
 * `beforeinstallprompt` event and offers a one-tap install button.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // Exclude Chrome, Firefox, Edge etc. on iOS — they don't support PWA install
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIOS && isSafari;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true)
  );
}

const DISMISS_KEY = "jninty-install-dismissed";

export default function InstallPrompt() {
  const [showIOS, setShowIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Don't show if already installed or previously dismissed
    if (isStandalone()) return;
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const ts = Number(dismissed);
      // Re-show after 7 days
      if (Date.now() - ts < 7 * 24 * 60 * 60 * 1000) return;
    }

    if (isIOSSafari()) {
      setShowIOS(true);
      return;
    }

    // Android / desktop Chrome install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = useCallback(() => {
    setShowIOS(false);
    setDeferredPrompt(null);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  }, []);

  const installNative = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  if (!showIOS && !deferredPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-xl border border-green-200 bg-surface p-4 shadow-lg">
      <button
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        className="absolute right-2 top-2 p-1 text-text-muted hover:text-brown-700"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>

      {showIOS ? (
        <div className="pr-6">
          <p className="text-sm font-semibold text-text-heading">
            Install Jninty
          </p>
          <p className="mt-1 text-xs text-brown-700">
            Tap{" "}
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block align-text-bottom"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>{" "}
            in the toolbar, then <strong>Add to Home Screen</strong> for the
            full app experience.
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-3 pr-6">
          <div className="flex-1">
            <p className="text-sm font-semibold text-text-heading">
              Install Jninty
            </p>
            <p className="mt-0.5 text-xs text-brown-700">
              Add to your home screen for quick access.
            </p>
          </div>
          <button
            onClick={installNative}
            className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover"
          >
            Install
          </button>
        </div>
      )}
    </div>
  );
}
