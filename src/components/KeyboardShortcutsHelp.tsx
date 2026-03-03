import { useRef, useEffect } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUT_GROUPS = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["g", "h"], label: "Home" },
      { keys: ["g", "p"], label: "Plants" },
      { keys: ["g", "j"], label: "Journal" },
      { keys: ["g", "t"], label: "Tasks" },
      { keys: ["g", "c"], label: "Calendar" },
      { keys: ["g", "m"], label: "Map" },
      { keys: ["g", "s"], label: "Settings" },
    ],
  },
  {
    title: "Create",
    shortcuts: [
      { keys: ["n", "l"], label: "New quick log" },
      { keys: ["n", "p"], label: "New plant" },
      { keys: ["n", "j"], label: "New journal entry" },
    ],
  },
  {
    title: "Other",
    shortcuts: [{ keys: ["?"], label: "Show this help" }],
  },
];

export default function KeyboardShortcutsHelp({
  isOpen,
  onClose,
}: KeyboardShortcutsHelpProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);

  useEffect(() => {
    if (!isOpen) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="w-full max-w-md rounded-xl border border-border-default bg-surface-elevated p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-text-heading">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-muted hover:text-text-primary"
            aria-label="Close"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
                {group.title}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.label}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm text-text-secondary">
                      {shortcut.label}
                    </span>
                    <div className="flex gap-1">
                      {shortcut.keys.map((key, i) => (
                        <span key={i}>
                          <kbd className="inline-flex min-w-6 items-center justify-center rounded border border-border-strong bg-surface-muted px-1.5 py-0.5 font-mono text-xs text-text-primary">
                            {key}
                          </kbd>
                          {i < shortcut.keys.length - 1 && (
                            <span className="mx-0.5 text-text-muted">then</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-text-muted">
          Shortcuts are disabled when focused in an input field.
        </p>
      </div>
    </div>
  );
}
