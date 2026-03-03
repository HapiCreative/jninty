import GrowthStory from "./GrowthStory";
import PhotoTimelineGrid from "./PhotoTimelineGrid";
import type { PhotoWithContext } from "./PhotoTimelineGrid";
import type { JournalEntry } from "../../validation/journalEntry.schema";

interface PhotoTimelineTabProps {
  photosWithContext: PhotoWithContext[];
  milestoneEntries: JournalEntry[];
  onPhotoClick: (photoId: string) => void;
}

export default function PhotoTimelineTab({
  photosWithContext,
  milestoneEntries,
  onPhotoClick,
}: PhotoTimelineTabProps) {
  return (
    <div className="space-y-4">
      <GrowthStory
        milestoneEntries={milestoneEntries}
        onPhotoClick={onPhotoClick}
      />
      <PhotoTimelineGrid
        photosWithContext={photosWithContext}
        onPhotoClick={onPhotoClick}
      />
    </div>
  );
}
