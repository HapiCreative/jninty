import { format, parseISO } from "date-fns";
import PhotoThumbnail from "../PhotoThumbnail";
import Badge from "../ui/Badge";
import Card from "../ui/Card";
import { MILESTONE_LABELS } from "../../constants/plantLabels";
import { ImageIcon } from "../icons";
import type { MilestoneType } from "../../validation/journalEntry.schema";

function isMilestoneType(s: string): s is MilestoneType {
  return s in MILESTONE_LABELS;
}

export interface PhotoWithContext {
  photoId: string;
  journalEntryId: string;
  activityType: string;
  body: string;
  title?: string | undefined;
  isMilestone: boolean;
  milestoneType?: string | undefined;
  createdAt: string;
  seasonId: string;
}

interface PhotoTimelineGridProps {
  photosWithContext: PhotoWithContext[];
  onPhotoClick: (photoId: string) => void;
}

export default function PhotoTimelineGrid({
  photosWithContext,
  onPhotoClick,
}: PhotoTimelineGridProps) {
  if (photosWithContext.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-8 text-soil-400">
          <ImageIcon className="h-10 w-10" />
          <p className="mt-2 text-sm">No photos yet</p>
        </div>
      </Card>
    );
  }

  // Group by month
  const grouped = new Map<string, PhotoWithContext[]>();
  for (const photo of photosWithContext) {
    const key = format(parseISO(photo.createdAt), "yyyy-MM");
    const group = grouped.get(key);
    if (group) {
      group.push(photo);
    } else {
      grouped.set(key, [photo]);
    }
  }

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([monthKey, photos]) => (
        <div key={monthKey}>
          <h3 className="mb-2 text-sm font-semibold text-soil-700">
            {format(parseISO(`${monthKey}-01`), "MMMM yyyy")}
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo) => (
              <button
                key={photo.photoId}
                type="button"
                onClick={() => onPhotoClick(photo.photoId)}
                className="relative aspect-square overflow-hidden rounded-lg"
              >
                <PhotoThumbnail
                  photoId={photo.photoId}
                  alt={photo.title ?? (photo.body || "Plant photo")}
                  className="h-full w-full"
                />
                {photo.isMilestone && photo.milestoneType && (
                  <>
                    <div className="absolute inset-0 rounded-lg ring-2 ring-terracotta-500" />
                    <div className="absolute right-0 bottom-1 left-0 flex justify-center">
                      <Badge variant="success" className="text-[10px]">
                        {isMilestoneType(photo.milestoneType) ? MILESTONE_LABELS[photo.milestoneType] : "Milestone"}
                      </Badge>
                    </div>
                  </>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
