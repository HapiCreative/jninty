import { format, parseISO } from "date-fns";
import PhotoThumbnail from "../PhotoThumbnail";
import Badge from "../ui/Badge";
import Card from "../ui/Card";
import { MILESTONE_LABELS } from "../../constants/plantLabels";
import { SeedIcon } from "../icons";
import type { JournalEntry, MilestoneType } from "../../validation/journalEntry.schema";

function isMilestoneType(s: string): s is MilestoneType {
  return s in MILESTONE_LABELS;
}

interface GrowthStoryProps {
  milestoneEntries: JournalEntry[];
  onPhotoClick: (photoId: string) => void;
}

export default function GrowthStory({
  milestoneEntries,
  onPhotoClick,
}: GrowthStoryProps) {
  if (milestoneEntries.length === 0) return null;

  return (
    <Card>
      <h2 className="mb-3 font-display text-lg font-semibold text-green-800">
        Growth Story
      </h2>
      <div className="overflow-x-auto">
        <div className="flex items-start" style={{ minWidth: "max-content" }}>
          {milestoneEntries.map((entry, index) => {
            const photoId = entry.photoIds[0];
            const label =
              entry.milestoneType && isMilestoneType(entry.milestoneType)
                ? MILESTONE_LABELS[entry.milestoneType]
                : "Milestone";

            return (
              <div key={entry.id} className="flex items-start">
                {/* Node */}
                <div className="flex w-[120px] flex-col items-center">
                  {/* Date */}
                  <p className="mb-1 text-[10px] text-soil-500">
                    {format(parseISO(entry.createdAt), "MMM d, yyyy")}
                  </p>

                  {/* Photo circle */}
                  {photoId ? (
                    <button
                      type="button"
                      onClick={() => onPhotoClick(photoId)}
                      className="h-16 w-16 overflow-hidden rounded-full border-2 border-green-600"
                    >
                      <PhotoThumbnail
                        photoId={photoId}
                        alt={label}
                        className="h-full w-full"
                      />
                    </button>
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-green-600 bg-cream-100">
                      <SeedIcon className="h-6 w-6 text-green-600" />
                    </div>
                  )}

                  {/* Label */}
                  <div className="mt-1">
                    <Badge variant="success" className="text-[10px]">
                      {label}
                    </Badge>
                  </div>
                </div>

                {/* Connector line */}
                {index < milestoneEntries.length - 1 && (
                  <div className="mt-[calc(10px+0.25rem+32px)] flex items-center">
                    <div className="h-0.5 w-6 bg-green-400" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
