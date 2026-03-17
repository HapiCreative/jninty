import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { usePouchQuery } from "../hooks/usePouchQuery.ts";
import { userPlantKnowledgeRepository } from "../db/index.ts";
import { findKnowledgeItemById, getCropGroup, builtInEntryId } from "../services/knowledgeBase";
import { TYPE_LABELS } from "../constants/plantLabels";
import {
  SUN_LABELS,
  WATER_LABELS,
  GROWTH_RATE_LABELS,
  SOURCE_LABELS,
} from "../constants/knowledgeLabels";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { ChevronLeftIcon } from "../components/icons";
import Skeleton from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";

export default function KnowledgeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const userEntries = usePouchQuery(() =>
    userPlantKnowledgeRepository.getAll(),
  );

  const item = useMemo(() => {
    if (!id || userEntries === undefined) return undefined;
    return findKnowledgeItemById(id, userEntries) ?? null;
  }, [id, userEntries]);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleDialogKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && showDeleteConfirm) {
        setShowDeleteConfirm(false);
      }
    },
    [showDeleteConfirm],
  );

  useEffect(() => {
    if (showDeleteConfirm) {
      document.addEventListener("keydown", handleDialogKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleDialogKeyDown);
      document.body.style.overflow = "";
    };
  }, [showDeleteConfirm, handleDialogKeyDown]);

  useEffect(() => {
    if (showDeleteConfirm && dialogRef.current) {
      const cancelBtn = dialogRef.current.querySelector<HTMLButtonElement>(
        "[data-cancel]",
      );
      cancelBtn?.focus();
    }
  }, [showDeleteConfirm]);

  const handleDelete = async () => {
    if (!id || !item || item.source !== "custom") return;
    setDeleting(true);
    try {
      await userPlantKnowledgeRepository.softDelete(id);
      toast("Entry deleted", "success");
      void navigate("/knowledge", { replace: true });
    } catch {
      toast("Failed to delete entry", "error");
      setDeleting(false);
    }
  };

  // Loading
  if (item === undefined) {
    return (
      <div
        className="mx-auto max-w-2xl p-4"
        role="status"
        aria-label="Loading knowledge entry"
      >
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="mt-2 h-5 w-1/2" />
        <Skeleton className="mt-6 h-40 w-full" />
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
    );
  }

  // Not found
  if (item === null) {
    return (
      <div className="p-4 text-center">
        <p className="text-lg font-medium text-text-secondary">Entry not found</p>
        <Link
          to="/knowledge"
          className="mt-2 inline-block text-sm text-text-heading hover:underline"
        >
          Back to Knowledge Base
        </Link>
      </div>
    );
  }

  const { data, source } = item;

  return (
    <div className="mx-auto max-w-2xl pb-8">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
            aria-label="Back to knowledge base"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold text-text-primary">
              {data.commonName}
            </h1>
            <p className="mt-0.5 text-text-secondary italic">
              {data.species}
              {data.variety ? ` '${data.variety}'` : ""}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge>{TYPE_LABELS[data.plantType]}</Badge>
          <Badge variant={source === "builtin" ? "success" : "warning"}>
            {SOURCE_LABELS[source]}
          </Badge>
          {data.isPerennial && <Badge variant="default">Perennial</Badge>}
          {data.family && <Badge variant="default">{data.family}</Badge>}
        </div>
      </div>

      <div className="space-y-4 px-4">
        {/* Growing Info */}
        <Card>
          <h2 className="font-display text-lg font-semibold text-text-heading">
            Growing Info
          </h2>
          <dl className="mt-3 space-y-2">
            <div className="flex justify-between">
              <dt className="text-sm text-text-secondary">Sun</dt>
              <dd className="text-sm font-medium text-text-primary">
                {SUN_LABELS[data.sunNeeds]}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-text-secondary">Water</dt>
              <dd className="text-sm font-medium text-text-primary">
                {WATER_LABELS[data.waterNeeds]}
              </dd>
            </div>
            {data.soilPreference && (
              <div className="flex justify-between">
                <dt className="text-sm text-text-secondary">Soil</dt>
                <dd className="text-sm font-medium text-text-primary">
                  {data.soilPreference}
                </dd>
              </div>
            )}
            {data.growthRate && (
              <div className="flex justify-between">
                <dt className="text-sm text-text-secondary">Growth Rate</dt>
                <dd className="text-sm font-medium text-text-primary">
                  {GROWTH_RATE_LABELS[data.growthRate]}
                </dd>
              </div>
            )}
            {data.matureHeightInches != null && (
              <div className="flex justify-between">
                <dt className="text-sm text-text-secondary">Height</dt>
                <dd className="text-sm font-medium text-text-primary">
                  {data.matureHeightInches}"
                </dd>
              </div>
            )}
            {data.matureSpreadInches != null && (
              <div className="flex justify-between">
                <dt className="text-sm text-text-secondary">Spread</dt>
                <dd className="text-sm font-medium text-text-primary">
                  {data.matureSpreadInches}"
                </dd>
              </div>
            )}
            {data.spacingInches != null && (
              <div className="flex justify-between">
                <dt className="text-sm text-text-secondary">Spacing</dt>
                <dd className="text-sm font-medium text-text-primary">
                  {data.spacingInches}"
                </dd>
              </div>
            )}
          </dl>
        </Card>

        {/* Planting Timing */}
        {(data.indoorStartWeeksBeforeLastFrost != null ||
          data.transplantWeeksAfterLastFrost != null ||
          data.directSowWeeksBeforeLastFrost != null ||
          data.directSowWeeksAfterLastFrost != null ||
          data.daysToGermination != null ||
          data.daysToMaturity != null) && (
          <Card>
            <h2 className="font-display text-lg font-semibold text-text-heading">
              Planting Timing
            </h2>
            <dl className="mt-3 space-y-2">
              {data.indoorStartWeeksBeforeLastFrost != null && (
                <div className="flex justify-between">
                  <dt className="text-sm text-text-secondary">Indoor Start</dt>
                  <dd className="text-sm font-medium text-text-primary">
                    {data.indoorStartWeeksBeforeLastFrost} weeks before last
                    frost
                  </dd>
                </div>
              )}
              {data.transplantWeeksAfterLastFrost != null && (
                <div className="flex justify-between">
                  <dt className="text-sm text-text-secondary">Transplant</dt>
                  <dd className="text-sm font-medium text-text-primary">
                    {data.transplantWeeksAfterLastFrost} weeks after last frost
                  </dd>
                </div>
              )}
              {data.directSowWeeksBeforeLastFrost != null && (
                <div className="flex justify-between">
                  <dt className="text-sm text-text-secondary">Direct Sow (before)</dt>
                  <dd className="text-sm font-medium text-text-primary">
                    {data.directSowWeeksBeforeLastFrost} weeks before last frost
                  </dd>
                </div>
              )}
              {data.directSowWeeksAfterLastFrost != null && (
                <div className="flex justify-between">
                  <dt className="text-sm text-text-secondary">Direct Sow (after)</dt>
                  <dd className="text-sm font-medium text-text-primary">
                    {data.directSowWeeksAfterLastFrost} weeks after last frost
                  </dd>
                </div>
              )}
              {data.daysToGermination != null && (
                <div className="flex justify-between">
                  <dt className="text-sm text-text-secondary">Germination</dt>
                  <dd className="text-sm font-medium text-text-primary">
                    {data.daysToGermination} days
                  </dd>
                </div>
              )}
              {data.daysToMaturity != null && (
                <div className="flex justify-between">
                  <dt className="text-sm text-text-secondary">Maturity</dt>
                  <dd className="text-sm font-medium text-text-primary">
                    {data.daysToMaturity} days
                  </dd>
                </div>
              )}
            </dl>
          </Card>
        )}

        {/* Scheduling Info */}
        {data.scheduling && (
          <Card>
            <h2 className="font-display text-lg font-semibold text-text-heading">
              Scheduling Info
            </h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {data.scheduling.directSow && (
                <Badge variant="success">Direct Sow</Badge>
              )}
              {data.scheduling.indoorStart && (
                <Badge variant="success">Indoor Start</Badge>
              )}
              {data.scheduling.frostHardy && (
                <Badge variant="default">Frost Hardy</Badge>
              )}
            </div>
            <dl className="mt-3 space-y-2">
              {data.scheduling.seedingDepthInches > 0 && (
                <div className="flex justify-between">
                  <dt className="text-sm text-text-secondary">Seeding Depth</dt>
                  <dd className="text-sm font-medium text-text-primary">
                    {data.scheduling.seedingDepthInches} inches
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-sm text-text-secondary">Row Spacing</dt>
                <dd className="text-sm font-medium text-text-primary">
                  {data.scheduling.rowSpacingInches} inches
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-text-secondary">Harvest Window</dt>
                <dd className="text-sm font-medium text-text-primary">
                  {data.scheduling.harvestWindowDays} days
                </dd>
              </div>
              {data.scheduling.successionIntervalDays != null && (
                <div className="flex justify-between">
                  <dt className="text-sm text-text-secondary">Succession Interval</dt>
                  <dd className="text-sm font-medium text-text-primary">
                    {data.scheduling.successionIntervalDays} days
                  </dd>
                </div>
              )}
              {data.scheduling.bedPrepLeadDays > 0 && (
                <div className="flex justify-between">
                  <dt className="text-sm text-text-secondary">Bed Prep Lead</dt>
                  <dd className="text-sm font-medium text-text-primary">
                    {data.scheduling.bedPrepLeadDays} days
                  </dd>
                </div>
              )}
              {data.scheduling.daysToTransplant != null && (
                <div className="flex justify-between">
                  <dt className="text-sm text-text-secondary">Days to Transplant</dt>
                  <dd className="text-sm font-medium text-text-primary">
                    {data.scheduling.daysToTransplant} days
                  </dd>
                </div>
              )}
            </dl>
            {data.scheduling.notes && (
              <p className="mt-3 text-sm text-text-secondary">
                {data.scheduling.notes}
              </p>
            )}
          </Card>
        )}

        {/* Companion Planting */}
        {((data.goodCompanions && data.goodCompanions.length > 0) ||
          (data.badCompanions && data.badCompanions.length > 0)) && (
          <Card>
            <h2 className="font-display text-lg font-semibold text-text-heading">
              Companion Planting
            </h2>
            {data.goodCompanions && data.goodCompanions.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-text-secondary">
                  Good Companions
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {data.goodCompanions.map((c) => (
                    <Badge key={c} variant="success">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {data.badCompanions && data.badCompanions.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-text-secondary">
                  Bad Companions
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {data.badCompanions.map((c) => (
                    <Badge key={c} variant="danger">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Common Issues */}
        {((data.commonPests && data.commonPests.length > 0) ||
          (data.commonDiseases && data.commonDiseases.length > 0)) && (
          <Card>
            <h2 className="font-display text-lg font-semibold text-text-heading">
              Common Issues
            </h2>
            {data.commonPests && data.commonPests.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-text-secondary">Pests</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {data.commonPests.map((p) => (
                    <Badge key={p} variant="warning">
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {data.commonDiseases && data.commonDiseases.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-text-secondary">Diseases</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {data.commonDiseases.map((d) => (
                    <Badge key={d} variant="danger">
                      {d}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Related Varieties */}
        {(() => {
          const siblings = getCropGroup(data.cropGroup).filter(
            (s) => builtInEntryId(s.species, s.variety) !== id,
          );
          if (siblings.length === 0) return null;
          return (
            <Card>
              <h2 className="font-display text-lg font-semibold text-text-heading">
                Related Varieties
              </h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {siblings.map((s) => (
                  <Link
                    key={builtInEntryId(s.species, s.variety)}
                    to={`/knowledge/${builtInEntryId(s.species, s.variety)}`}
                  >
                    <Badge variant="default">
                      {s.variety ?? s.commonName}
                    </Badge>
                  </Link>
                ))}
              </div>
            </Card>
          );
        })()}

        {/* Actions (custom only) */}
        {source === "custom" && (
          <div className="flex gap-3">
            <Button
              onClick={() => void navigate(`/knowledge/${item.id}/edit`)}
            >
              Edit Entry
            </Button>
            <Button
              variant="ghost"
              className="text-terracotta-600 hover:bg-terracotta-400/10"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete
            </Button>
          </div>
        )}

        {/* Delete confirmation dialog */}
        {showDeleteConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-soil-900/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowDeleteConfirm(false);
            }}
          >
            <Card className="w-full max-w-sm" ref={dialogRef}>
              <h3
                id="delete-dialog-title"
                className="font-display text-lg font-semibold text-text-primary"
              >
                Delete {data.commonName}?
              </h3>
              <p className="mt-2 text-sm text-text-secondary">
                This knowledge entry will be permanently removed. This action
                cannot be undone.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  data-cancel
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="bg-terracotta-500 hover:bg-terracotta-600"
                  onClick={() => void handleDelete()}
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
