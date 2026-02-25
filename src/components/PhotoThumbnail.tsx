import { useState, useEffect } from "react";
import * as photoRepository from "../db/repositories/photoRepository.ts";

interface PhotoThumbnailProps {
  photoId: string;
  className?: string;
  alt?: string;
}

export default function PhotoThumbnail({
  photoId,
  className = "",
  alt = "",
}: PhotoThumbnailProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let revoked = false;
    let objectUrl: string | undefined;

    photoRepository.getById(photoId).then((photo) => {
      if (revoked) return;
      if (photo) {
        objectUrl = URL.createObjectURL(photo.thumbnailBlob);
        setSrc(objectUrl);
      }
      setLoading(false);
    });

    return () => {
      revoked = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [photoId]);

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Loading photo"
        className={`animate-pulse rounded-lg bg-cream-200 ${className}`}
      />
    );
  }

  if (!src) {
    return (
      <div
        aria-label="Photo not found"
        className={`flex items-center justify-center rounded-lg bg-cream-200 text-brown-400 ${className}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="h-6 w-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
          />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`rounded-lg object-cover ${className}`}
    />
  );
}
