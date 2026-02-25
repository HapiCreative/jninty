import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { format, parseISO, differenceInDays } from "date-fns";
import { db } from "../db/schema";
import * as seedRepository from "../db/repositories/seedRepository";
import * as plantRepository from "../db/repositories/plantRepository";
import * as plantingRepository from "../db/repositories/plantingRepository";
import * as seasonRepository from "../db/repositories/seasonRepository";
import { QUANTITY_UNIT_LABELS } from "../constants/seedLabels";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { ChevronLeftIcon, SeedIcon } from "../components/icons";
import Skeleton from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";

export default function SeedDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const seed = useLiveQuery(
    () => (id ? seedRepository.getById(id).then((s) => s ?? null) : null),
    [id],
  );

  // "I Planted Some" modal state
  const [showPlantModal, setShowPlantModal] = useState(false);
  const [plantAmount, setPlantAmount] = useState("");
  const [createPlant, setCreatePlant] = useState(true);
  const [planting, setPlanting] = useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (seed === undefined) {
    return (
      <div className="mx-auto max-w-2xl p-4" role="status" aria-label="Loading seed">
        <Skeleton className="h-8 w-40" />
        <div className="mt-6 space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (seed === null) {
    return (
      <div className="mx-auto max-w-2xl p-4 text-center">
        <p className="text-lg font-medium text-soil-700">Seed not found</p>
        <Link
          to="/seeds"
          className="mt-2 inline-block text-sm text-green-700 hover:underline"
        >
          Back to Seed Bank
        </Link>
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0]!;
  const isExpired = seed.expiryDate != null && seed.expiryDate < today;
  const daysUntilExpiry =
    seed.expiryDate != null
      ? differenceInDays(parseISO(seed.expiryDate), new Date())
      : null;
  const isExpiringSoon =
    daysUntilExpiry != null && daysUntilExpiry >= 0 && daysUntilExpiry <= 30;

  async function handlePlantFromSeed() {
    if (!seed || !id) return;
    const amount = Number(plantAmount);
    if (!amount || amount <= 0) {
      toast("Enter a valid amount", "error");
      return;
    }
    if (amount > seed.quantityRemaining) {
      toast("Not enough seeds remaining", "error");
      return;
    }

    setPlanting(true);
    try {
      // Run in a transaction so deduction + plant creation are atomic
      await db.transaction(
        "rw",
        [db.seeds, db.plantInstances, db.plantings, db.seasons],
        async () => {
          // Deduct quantity
          await seedRepository.deductQuantity(id, amount);

          // Optionally create PlantInstance + Planting
          if (createPlant) {
            const activeSeason = await seasonRepository.getActive();
            const plant = await plantRepository.create({
              species: seed.species,
              type: "vegetable",
              isPerennial: false,
              source: "seed",
              seedId: id,
              status: "active",
              tags: [],
              ...(seed.variety != null ? { variety: seed.variety } : {}),
            });

            if (activeSeason) {
              const todayISO = new Date().toISOString().split("T")[0]!;
              await plantingRepository.create({
                plantInstanceId: plant.id,
                seasonId: activeSeason.id,
                datePlanted: todayISO,
              });
            }
          }
        },
      );

      toast(
        createPlant
          ? "Seeds deducted and plant created"
          : "Seeds deducted",
        "success",
      );

      setShowPlantModal(false);
      setPlantAmount("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to plant seeds";
      toast(message, "error");
    } finally {
      setPlanting(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    setDeleting(true);
    try {
      await seedRepository.softDelete(id);
      toast("Seed deleted", "success");
      void navigate("/seeds", { replace: true });
    } catch {
      toast("Failed to delete seed", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void navigate("/seeds")}
          className="rounded-lg p-1.5 text-soil-600 transition-colors hover:bg-cream-200 hover:text-soil-900"
          aria-label="Back to Seed Bank"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="flex-1 truncate font-display text-2xl font-bold text-green-800">
          {seed.name}
        </h1>
      </div>

      {/* Status badges */}
      <div className="mt-3 flex flex-wrap gap-2">
        {isExpired && <Badge variant="danger">Expired</Badge>}
        {isExpiringSoon && !isExpired && (
          <Badge variant="warning">
            Expires in {String(daysUntilExpiry)}d
          </Badge>
        )}
      </div>

      {/* Seed info */}
      <Card className="mt-4">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-green-50">
            <SeedIcon className="h-8 w-8 text-green-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm italic text-soil-600">{seed.species}</p>
            {seed.variety && (
              <p className="text-sm text-soil-500">Variety: {seed.variety}</p>
            )}
            {seed.brand && (
              <p className="text-sm text-soil-500">Brand: {seed.brand}</p>
            )}
            {seed.supplier && (
              <p className="text-sm text-soil-500">
                Supplier: {seed.supplier}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Quantity & dates */}
      <Card className="mt-3">
        <h2 className="font-display text-base font-semibold text-green-800">
          Stock & Dates
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <span className="text-xs text-soil-500">Quantity Remaining</span>
            <p className="text-lg font-semibold text-soil-900">
              {String(seed.quantityRemaining)}{" "}
              <span className="text-sm font-normal text-soil-600">
                {QUANTITY_UNIT_LABELS[seed.quantityUnit].toLowerCase()}
              </span>
            </p>
          </div>
          {seed.germinationRate != null && (
            <div>
              <span className="text-xs text-soil-500">Germination Rate</span>
              <p className="text-lg font-semibold text-soil-900">
                {String(seed.germinationRate)}%
              </p>
            </div>
          )}
          {seed.purchaseDate && (
            <div>
              <span className="text-xs text-soil-500">Purchased</span>
              <p className="text-sm font-medium text-soil-900">
                {format(parseISO(seed.purchaseDate), "MMM d, yyyy")}
              </p>
            </div>
          )}
          {seed.expiryDate && (
            <div>
              <span className="text-xs text-soil-500">Expires</span>
              <p
                className={`text-sm font-medium ${isExpired ? "text-terracotta-600" : "text-soil-900"}`}
              >
                {format(parseISO(seed.expiryDate), "MMM d, yyyy")}
              </p>
            </div>
          )}
          {seed.cost != null && (
            <div>
              <span className="text-xs text-soil-500">Cost</span>
              <p className="text-sm font-medium text-soil-900">
                ${seed.cost.toFixed(2)}
              </p>
            </div>
          )}
          {seed.storageLocation && (
            <div>
              <span className="text-xs text-soil-500">Storage Location</span>
              <p className="text-sm font-medium text-soil-900">
                {seed.storageLocation}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Notes */}
      {seed.notes && (
        <Card className="mt-3">
          <h2 className="font-display text-base font-semibold text-green-800">
            Notes
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-soil-700">
            {seed.notes}
          </p>
        </Card>
      )}

      {/* Actions */}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={() => setShowPlantModal(true)}>
          Plant from this Seed
        </Button>
        <Button
          variant="secondary"
          onClick={() => void navigate(`/seeds/${seed.id}/edit`)}
        >
          Edit
        </Button>
        <Button variant="ghost" onClick={() => setShowDeleteConfirm(true)}>
          Delete
        </Button>
      </div>

      {/* "I Planted Some" modal */}
      {showPlantModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-soil-900/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPlantModal(false);
          }}
        >
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-display text-lg font-bold text-green-800">
              Plant from Seed
            </h3>
            <p className="mt-1 text-sm text-soil-600">
              How many/much did you plant?
            </p>

            <div className="mt-4">
              <label
                htmlFor="plant-amount"
                className="mb-1 block text-sm font-medium text-soil-700"
              >
                Amount ({QUANTITY_UNIT_LABELS[seed.quantityUnit].toLowerCase()})
              </label>
              <Input
                id="plant-amount"
                type="number"
                min="0"
                step={
                  seed.quantityUnit === "grams" ||
                  seed.quantityUnit === "ounces"
                    ? "0.1"
                    : "1"
                }
                max={String(seed.quantityRemaining)}
                value={plantAmount}
                onChange={(e) => setPlantAmount(e.target.value)}
                placeholder={`Max: ${String(seed.quantityRemaining)}`}
              />
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                id="create-plant-toggle"
                role="switch"
                aria-checked={createPlant}
                onClick={() => setCreatePlant(!createPlant)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 ${
                  createPlant ? "bg-green-600" : "bg-brown-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                    createPlant ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <label
                htmlFor="create-plant-toggle"
                className="text-sm text-soil-700"
              >
                Create a new plant record
              </label>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                onClick={() => void handlePlantFromSeed()}
                disabled={planting}
              >
                {planting ? "Planting..." : "Confirm"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowPlantModal(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-soil-900/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDeleteConfirm(false);
          }}
        >
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-display text-lg font-bold text-soil-900">
              Delete Seed?
            </h3>
            <p className="mt-1 text-sm text-soil-600">
              This will remove &ldquo;{seed.name}&rdquo; from your seed bank.
            </p>
            <div className="mt-6 flex gap-3">
              <Button
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="bg-terracotta-500 hover:bg-terracotta-600"
              >
                {deleting ? "Deleting..." : "Delete"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
