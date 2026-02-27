import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ZodError } from "zod";
import * as seedRepository from "../db/repositories/seedRepository";
import type { QuantityUnit } from "../types";
import { QUANTITY_UNIT_OPTIONS } from "../constants/seedLabels";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import StoreAutosuggest from "../components/StoreAutosuggest";
import { ChevronLeftIcon } from "../components/icons";
import Skeleton from "../components/ui/Skeleton";

const selectClass =
  "w-full rounded-lg border border-brown-200 bg-cream-50 px-3 py-2 text-sm text-soil-900 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/25";

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  species: "Species",
  variety: "Variety",
  brand: "Brand",
  supplier: "Supplier",
  quantityRemaining: "Quantity",
  quantityUnit: "Unit",
  purchaseDate: "Purchase Date",
  expiryDate: "Expiry Date",
  germinationRate: "Germination Rate",
  cost: "Cost",
  storageLocation: "Storage Location",
  notes: "Notes",
};

export default function SeedFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;

  // Form state
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [variety, setVariety] = useState("");
  const [brand, setBrand] = useState("");
  const [supplier, setSupplier] = useState("");
  const [quantityRemaining, setQuantityRemaining] = useState("");
  const [quantityUnit, setQuantityUnit] = useState<QuantityUnit>("packets");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [germinationRate, setGerminationRate] = useState("");
  const [cost, setCost] = useState("");
  const [purchaseStore, setPurchaseStore] = useState("");
  const [storageLocation, setStorageLocation] = useState("");
  const [notes, setNotes] = useState("");

  // Submission state
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(isEditing);

  // Load existing seed data for edit mode
  useEffect(() => {
    if (!id) return;

    void (async () => {
      const seed = await seedRepository.getById(id);
      if (!seed) {
        void navigate("/seeds", { replace: true });
        return;
      }

      setName(seed.name);
      setSpecies(seed.species);
      setVariety(seed.variety ?? "");
      setBrand(seed.brand ?? "");
      setSupplier(seed.supplier ?? "");
      setQuantityRemaining(String(seed.quantityRemaining));
      setQuantityUnit(seed.quantityUnit);
      setPurchaseDate(seed.purchaseDate ?? "");
      setExpiryDate(seed.expiryDate ?? "");
      setGerminationRate(
        seed.germinationRate != null ? String(seed.germinationRate) : "",
      );
      setCost(seed.cost != null ? String(seed.cost) : "");
      setPurchaseStore(seed.purchaseStore ?? "");
      setStorageLocation(seed.storageLocation ?? "");
      setNotes(seed.notes ?? "");

      setLoading(false);
    })();
  }, [id, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    if (!name.trim()) {
      setErrors(["Name is required."]);
      return;
    }
    if (!species.trim()) {
      setErrors(["Species is required."]);
      return;
    }

    const qty = Number(quantityRemaining);
    if (Number.isNaN(qty) || qty < 0) {
      setErrors(["Quantity must be a non-negative number."]);
      return;
    }

    setSaving(true);

    try {
      const input: Parameters<typeof seedRepository.create>[0] = {
        name: name.trim(),
        species: species.trim(),
        quantityRemaining: qty,
        quantityUnit,
      };

      const trimmedVariety = variety.trim();
      if (trimmedVariety) input.variety = trimmedVariety;

      const trimmedBrand = brand.trim();
      if (trimmedBrand) input.brand = trimmedBrand;

      const trimmedSupplier = supplier.trim();
      if (trimmedSupplier) input.supplier = trimmedSupplier;

      if (purchaseDate) input.purchaseDate = purchaseDate;
      if (expiryDate) input.expiryDate = expiryDate;

      const germRate = Number(germinationRate);
      if (germinationRate && !Number.isNaN(germRate)) {
        input.germinationRate = Math.round(germRate);
      }

      const costNum = Number(cost);
      if (cost && !Number.isNaN(costNum)) {
        input.cost = costNum;
      }

      const trimmedPurchaseStore = purchaseStore.trim();
      if (trimmedPurchaseStore) input.purchaseStore = trimmedPurchaseStore;

      const trimmedLocation = storageLocation.trim();
      if (trimmedLocation) input.storageLocation = trimmedLocation;

      const trimmedNotes = notes.trim();
      if (trimmedNotes) input.notes = trimmedNotes;

      let seed;
      if (isEditing && id) {
        seed = await seedRepository.update(id, input);
      } else {
        seed = await seedRepository.create(input);
      }

      void navigate(`/seeds/${seed.id}`, { replace: true });
    } catch (err) {
      if (err instanceof ZodError) {
        setErrors(
          err.issues.map((issue) => {
            const field = issue.path[0];
            const label =
              typeof field === "string"
                ? (FIELD_LABELS[field] ?? field)
                : "Field";
            return `${label}: ${issue.message}`;
          }),
        );
      } else {
        const message =
          err instanceof Error ? err.message : "Failed to save seed.";
        setErrors([message]);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl p-4" role="status" aria-label="Loading form">
        <Skeleton className="h-8 w-40" />
        <div className="mt-6 space-y-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  const backPath = isEditing && id ? `/seeds/${id}` : "/seeds";

  return (
    <div className="mx-auto max-w-2xl p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void navigate(backPath)}
          className="rounded-lg p-1.5 text-soil-600 transition-colors hover:bg-cream-200 hover:text-soil-900"
          aria-label="Go back"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="font-display text-2xl font-bold text-green-800">
          {isEditing ? "Edit Seed" : "Add Seed"}
        </h1>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-6">
        {/* Seed identification */}
        <Card>
          <h2 className="font-display text-lg font-semibold text-green-800">
            Seed Information
          </h2>

          <div className="mt-4 space-y-4">
            {/* Name (required) */}
            <div>
              <label
                htmlFor="seed-name"
                className="mb-1 block text-sm font-medium text-soil-700"
              >
                Name <span className="text-terracotta-500">*</span>
              </label>
              <Input
                id="seed-name"
                type="text"
                placeholder='e.g. "San Marzano Tomato Seeds"'
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Species (required) */}
            <div>
              <label
                htmlFor="seed-species"
                className="mb-1 block text-sm font-medium text-soil-700"
              >
                Species <span className="text-terracotta-500">*</span>
              </label>
              <Input
                id="seed-species"
                type="text"
                placeholder="e.g. Solanum lycopersicum"
                value={species}
                onChange={(e) => setSpecies(e.target.value)}
              />
            </div>

            {/* Variety */}
            <div>
              <label
                htmlFor="seed-variety"
                className="mb-1 block text-sm font-medium text-soil-700"
              >
                Variety
              </label>
              <Input
                id="seed-variety"
                type="text"
                placeholder="e.g. San Marzano"
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
              />
            </div>

            {/* Brand */}
            <div>
              <label
                htmlFor="seed-brand"
                className="mb-1 block text-sm font-medium text-soil-700"
              >
                Brand
              </label>
              <Input
                id="seed-brand"
                type="text"
                placeholder="e.g. Burpee"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              />
            </div>

            {/* Supplier */}
            <div>
              <label
                htmlFor="seed-supplier"
                className="mb-1 block text-sm font-medium text-soil-700"
              >
                Supplier
              </label>
              <Input
                id="seed-supplier"
                type="text"
                placeholder="e.g. Local garden center"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* Quantity & unit */}
        <Card>
          <h2 className="font-display text-lg font-semibold text-green-800">
            Quantity
          </h2>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="seed-quantity"
                className="mb-1 block text-sm font-medium text-soil-700"
              >
                Amount <span className="text-terracotta-500">*</span>
              </label>
              <Input
                id="seed-quantity"
                type="number"
                min="0"
                step="any"
                placeholder="0"
                value={quantityRemaining}
                onChange={(e) => setQuantityRemaining(e.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor="seed-unit"
                className="mb-1 block text-sm font-medium text-soil-700"
              >
                Unit
              </label>
              <select
                id="seed-unit"
                value={quantityUnit}
                onChange={(e) => setQuantityUnit(e.target.value as QuantityUnit)}
                className={selectClass}
              >
                {QUANTITY_UNIT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* Dates & details */}
        <Card>
          <h2 className="font-display text-lg font-semibold text-green-800">
            Details
          </h2>

          <div className="mt-4 space-y-4">
            {/* Purchase date */}
            <div>
              <label
                htmlFor="seed-purchase-date"
                className="mb-1 block text-sm font-medium text-soil-700"
              >
                Purchase Date
              </label>
              <Input
                id="seed-purchase-date"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>

            {/* Expiry date */}
            <div>
              <label
                htmlFor="seed-expiry-date"
                className="mb-1 block text-sm font-medium text-soil-700"
              >
                Expiry Date
              </label>
              <Input
                id="seed-expiry-date"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>

            {/* Germination rate */}
            <div>
              <label
                htmlFor="seed-germination"
                className="mb-1 block text-sm font-medium text-soil-700"
              >
                Germination Rate (%)
              </label>
              {germinationRate ? (
                <div className="flex items-center gap-3">
                  <input
                    id="seed-germination"
                    type="range"
                    min="0"
                    max="100"
                    value={germinationRate}
                    onChange={(e) => setGerminationRate(e.target.value)}
                    className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-cream-200 accent-green-600"
                  />
                  <span className="w-12 text-right text-sm font-medium text-soil-700">
                    {germinationRate}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setGerminationRate("")}
                    className="text-xs text-soil-500 hover:text-soil-700"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  id="seed-germination"
                  onClick={() => setGerminationRate("50")}
                  className="text-sm text-green-700 hover:underline"
                >
                  Set germination rate
                </button>
              )}
            </div>

            {/* Cost */}
            <div>
              <label
                htmlFor="seed-cost"
                className="mb-1 block text-sm font-medium text-soil-700"
              >
                Cost ($)
              </label>
              <Input
                id="seed-cost"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </div>

            {/* Purchased at */}
            <div>
              <label
                htmlFor="seed-purchase-store"
                className="mb-1 block text-sm font-medium text-soil-700"
              >
                Purchased At
              </label>
              <StoreAutosuggest
                id="seed-purchase-store"
                value={purchaseStore}
                onChange={setPurchaseStore}
              />
            </div>

            {/* Storage location */}
            <div>
              <label
                htmlFor="seed-storage"
                className="mb-1 block text-sm font-medium text-soil-700"
              >
                Storage Location
              </label>
              <Input
                id="seed-storage"
                type="text"
                placeholder='e.g. "Fridge box A", "Shed drawer 3"'
                value={storageLocation}
                onChange={(e) => setStorageLocation(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div>
              <label
                htmlFor="seed-notes"
                className="mb-1 block text-sm font-medium text-soil-700"
              >
                Notes
              </label>
              <textarea
                id="seed-notes"
                rows={3}
                placeholder="Any notes about this seed..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-brown-200 bg-cream-50 px-3 py-2 text-sm text-soil-900 placeholder:text-brown-400 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/25"
              />
            </div>
          </div>
        </Card>

        {/* Error display */}
        {errors.length > 0 && (
          <div className="rounded-lg bg-terracotta-400/10 p-3">
            {errors.map((err, i) => (
              <p key={i} className="text-sm text-terracotta-600">
                {err}
              </p>
            ))}
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving
              ? "Saving..."
              : isEditing
                ? "Save Changes"
                : "Add Seed"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => void navigate(backPath)}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
