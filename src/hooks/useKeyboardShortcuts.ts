import { useEffect, useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const NAV_MAP: Record<string, string> = {
  h: "/",
  p: "/plants",
  j: "/journal",
  t: "/tasks",
  c: "/calendar",
  m: "/map",
  s: "/settings",
};

const NEW_MAP: Record<string, string> = {
  l: "/quick-log",
  p: "/plants/new",
  j: "/journal/new",
};

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    (el as HTMLElement).isContentEditable
  );
}

export function useKeyboardShortcuts(onShowHelp: () => void) {
  const navigate = useNavigate();
  const pendingRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const clearPending = useCallback(() => {
    pendingRef.current = null;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isInputFocused()) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      // Two-key sequence: second key
      if (pendingRef.current === "g") {
        clearPending();
        const route = NAV_MAP[key];
        if (route) {
          e.preventDefault();
          navigate(route);
        }
        return;
      }

      if (pendingRef.current === "n") {
        clearPending();
        const route = NEW_MAP[key];
        if (route) {
          e.preventDefault();
          navigate(route);
        }
        return;
      }

      // First key of a sequence
      if (key === "g" || key === "n") {
        e.preventDefault();
        pendingRef.current = key;
        timerRef.current = setTimeout(clearPending, 500);
        return;
      }

      // Single-key shortcuts
      if (key === "?") {
        e.preventDefault();
        onShowHelp();
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearPending();
    };
  }, [navigate, onShowHelp, clearPending]);
}

export function useShortcutsHelpState() {
  const [isOpen, setIsOpen] = useState(false);
  const show = useCallback(() => setIsOpen(true), []);
  const hide = useCallback(() => setIsOpen(false), []);
  return { isOpen, show, hide };
}
