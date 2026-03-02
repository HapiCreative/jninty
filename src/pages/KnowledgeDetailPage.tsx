import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { usePouchQuery } from "../hooks/usePouchQuery.ts";
import { userPlantKnowledgeRepository } from "../db/index.ts";
import { findKnowledgeItemById } from "../services/knowledgeBase";
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
        <p className="text-lg font-medium text-soil-700">Entry not found</p>
        <Link
          to="/knowledge"
          className="mt-2 inline-block text-sm text-green-700 hover:underline"
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
            onClick={() => navigate("/knowledge")}
            className="rounded-lg p-1.5 text-soil-600 transition-colors hover:bg-cream-200 hover:text-soil-900"
            aria-label="Back to knowledge base"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold text-soil-900">
              {data.commonName}
            </h1>
            <p className="mt-0.5 text-soil-600 italic">
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
        </div>
      </div>

      <div className="space-y-4 px-4">
        {/* Growing Info */}
        <Card>
          <h2 className="font-display text-lg font-semibold text-green-800">
            Growing Info
          </h2>
          <dl className="mt-3 space-y-2">
            <div className="flex justify-between">
              <dt className="text-sm text-soil-600">Sun</dt>
              <dd className="text-sm font-medium text-soil-900">
                {SUN_LABELS[data.sunNeeds]}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-soil-600">Water</dt>
              <dd className="text-sm font-medium text-soil-900">
                {WATER_LABELS[data.waterNeeds]}
              </dd>
            </div>
            {data.soilPreference && (
              <div className="flex justify-between">
                <dt className="text-sm text-soil-600">Soil</dt>
                <dd className="text-sm font-medium text-soil-900">
                  {data.soilPreference}
                </dd>
              </div>
            )}
            {data.growthRate && (
              <div className="flex justify-between">
                <dt className="text-sm text-soil-600">Growth Rate</dt>
                <dd className="text-sm font-medium text-soil-900">
                  {GROWTH_RATE_LABELS[data.growthRate]}
                </dd>
              </div>
            )}
            {data.matureHeightInches != null && (
              <div className="flex justify-between">
                <dt className="text-sm text-soil-600">Height</dt>
                <dd className="text-sm font-medium text-soil-900">
                  {data.matureHeightInches}"
                </dd>
              </div>
            )}
            {data.matureSpreadInches != null && (
              <div className="flex justify-between">
                <dt className="text-sm text-soil-600">Spread</dt>
                <dd className="text-sm font-medium text-soil-900">
                  {data.matureSpreadInches}"
                </dd>
              </div>
            )}
            {data.spacingInches != null && (
              <div className="flex justify-between">
                <dt className="text-sm text-soil-600">Spacing</dt>
                <dd className="text-sm font-medium text-soil-900">
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
            <h2 className="font-display text-lg font-semibold text-green-800">
              Planting Timing
            </h2>
            <dl className="mt-3 space-y-2">
              {data.indoorStartWeeksBeforeLastFrost != null && (
                <div className="flex justify-between">
                  <dt className="text-sm text-soil-600">Indoor Start</dt>
                  <dd className="text-sm font-medium text-soil-900">
                    {data.indoorStartWeeksBeforeLastFrost} weeks before last
                    frost
                  </dd>
                </div>
              )}
              {data.transplantWeeksAfterLastFrost != null && (
                <div className="flex justify-between">
                  <dt className="text-sm text-soil-600">Transplant</dt>
                  <dd className="text-sm font-medium text-soil-900">
                    {data.transplantWeeksAfterLastFrost} weeks after last frost
                  </dd>
                </div>
              )}
              {data.directSowWeeksBeforeLastFrost != null && (
                <div className="flex justify-between">
                  <dt className="text-sm text-soil-600">Direct Sow (before)</dt>
                  <dd className="text-sm font-medium text-soil-900">
                    {data.directSowWeeksBeforeLastFrost} weeks before last frost
                  </dd>
                </div>
              )}
              {data.directSowWeeksAfterLastFrost != null && (
                <div className="flex justify-between">
                  <dt className="text-sm text-soil-600">Direct Sow (after)</dt>
                  <dd className="text-sm font-medium text-soil-900">
                    {data.directSowWeeksAfterLastFrost} weeks after last frost
                  </dd>
                </div>
              )}
              {data.daysToGermination != null && (
                <div className="flex justify-between">
                  <dt className="text-sm text-soil-600">Germination</dt>
                  <dd className="text-sm font-medium text-soil-900">
                    {data.daysToGermination} days
                  </dd>
                </div>
              )}
              {data.daysToMaturity != null && (
                <div className="flex justify-between">
                  <dt className="text-sm text-soil-600">Maturity</dt>
                  <dd className="text-sm font-medium text-soil-900">
                    {data.daysToMaturity} days
                  </dd>
                </div>
              )}
            </dl>
          </Card>
        )}

        {/* Companion Planting */}
        {((data.goodCompanions && data.goodCompanions.length > 0) ||
          (data.badCompanions && data.badCompanions.length > 0)) && (
          <Card>
            <h2 className="font-display text-lg font-semibold text-green-800">
              Companion Planting
            </h2>
            {data.goodCompanions && data.goodCompanions.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-soil-600">
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
                <p className="text-sm font-medium text-soil-600">
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
            <h2 className="font-display text-lg font-semibold text-green-800">
              Common Issues
            </h2>
            {data.commonPests && data.commonPests.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-soil-600">Pests</p>
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
                <p className="text-sm font-medium text-soil-600">Diseases</p>
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
                className="font-display text-lg font-semibold text-soil-900"
              >
                Delete {data.commonName}?
              </h3>
              <p className="mt-2 text-sm text-soil-600">
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
