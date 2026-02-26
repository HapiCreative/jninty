import { useState, useEffect, useRef, useCallback } from "react";
import * as photoRepository from "../db/repositories/photoRepository.ts";

interface PhotoLightboxProps {
  photoIds: string[];
  initialIndex: number;
  onClose: () => void;
}

export default function PhotoLightbox({
  photoIds,
  initialIndex,
  onClose,
}: PhotoLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Touch state refs (not stateful to avoid re-renders during gestures)
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const initialPinchDistance = useRef<number | null>(null);
  const baseScale = useRef(1);

  const photoId = photoIds[currentIndex];

  // Load display-size photo
  useEffect(() => {
    if (!photoId) return;
    let revoked = false;
    let objectUrl: string | undefined;

    setLoading(true);
    void (async () => {
      const blob = await photoRepository.getDisplayBlob(photoId);
      if (revoked) return;
      if (blob) {
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      }
      setLoading(false);
    })();

    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoId]);

  // Reset zoom on slide change
  useEffect(() => {
    setScale(1);
    baseScale.current = 1;
  }, [currentIndex]);

  // Navigation
  const goNext = useCallback(() => {
    if (currentIndex < photoIds.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  }, [currentIndex, photoIds.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose, goNext, goPrev]);

  // Focus trap
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // Touch handlers for swipe and pinch-to-zoom
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0]!;
      touchStartX.current = touch.clientX;
      touchStartY.current = touch.clientY;
    } else if (e.touches.length === 2) {
      initialPinchDistance.current = getTouchDistance(e.touches);
      baseScale.current = scale;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale]);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2 && initialPinchDistance.current) {
        e.preventDefault();
        const dist = getTouchDistance(e.touches);
        const newScale = baseScale.current * (dist / initialPinchDistance.current);
        setScale(Math.max(1, Math.min(4, newScale)));
      }
    },
    [],
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      // Swipe detection (single finger, not pinching)
      if (e.changedTouches.length === 1 && !initialPinchDistance.current) {
        const touch = e.changedTouches[0]!;
        const deltaX = touch.clientX - touchStartX.current;
        const deltaY = Math.abs(touch.clientY - touchStartY.current);
        const SWIPE_THRESHOLD = 50;

        // Only swipe if horizontal movement exceeds vertical
        if (Math.abs(deltaX) > SWIPE_THRESHOLD && Math.abs(deltaX) > deltaY) {
          if (deltaX < 0) goNext();
          else goPrev();
        }
      }
      initialPinchDistance.current = null;
    },
    [goNext, goPrev],
  );

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      className="fixed inset-0 z-50 flex items-center justify-center bg-soil-900/95 outline-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-4 right-4 z-10 rounded-full bg-soil-900/60 p-2 text-white transition-colors hover:bg-soil-900/80"
        aria-label="Close photo viewer"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="h-6 w-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      {/* Counter */}
      {photoIds.length > 1 && (
        <div className="absolute top-4 left-4 z-10 rounded-full bg-soil-900/60 px-3 py-1 text-sm text-white">
          {String(currentIndex + 1)} / {String(photoIds.length)}
        </div>
      )}

      {/* Previous button */}
      {currentIndex > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          className="absolute left-2 z-10 rounded-full bg-soil-900/60 p-2 text-white transition-colors hover:bg-soil-900/80"
          aria-label="Previous photo"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-6 w-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      )}

      {/* Next button */}
      {currentIndex < photoIds.length - 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          className="absolute right-2 z-10 rounded-full bg-soil-900/60 p-2 text-white transition-colors hover:bg-soil-900/80"
          aria-label="Next photo"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-6 w-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      )}

      {/* Photo */}
      <div className="flex h-full w-full items-center justify-center p-4">
        {loading ? (
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-white/20 border-t-white" />
        ) : src ? (
          <img
            src={src}
            alt={`Photo ${String(currentIndex + 1)}`}
            className="max-h-full max-w-full object-contain transition-transform"
            style={{ transform: `scale(${String(scale)})` }}
            draggable={false}
          />
        ) : (
          <p className="text-white/60">Photo not found</p>
        )}
      </div>
    </div>
  );
}

function getTouchDistance(touches: React.TouchList): number {
  const t1 = touches[0]!;
  const t2 = touches[1]!;
  return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
}
