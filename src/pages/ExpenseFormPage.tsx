import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ZodError } from "zod";
import { usePouchQuery } from "../hooks/usePouchQuery.ts";
import { expenseRepository, seasonRepository } from "../db/index.ts";
import type { ExpenseCategory } from "../types";
import { EXPENSE_CATEGORY_OPTIONS } from "../constants/expenseLabels";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import StoreAutosuggest from "../components/StoreAutosuggest";
import { ChevronLeftIcon } from "../components/icons";
import Skeleton from "../components/ui/Skeleton";

const selectClass =
  "w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary focus:border-focus-ring focus:outline-none focus:ring-2 focus:ring-focus-ring/25";

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  category: "Category",
  amount: "Amount",
  store: "Store",
  date: "Date",
  seasonId: "Season",
  notes: "Notes",
};

function todayDate(): string {
  return new Date().toISOString().split("T")[0]!;
}

export default function ExpenseFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;

  const seasons = usePouchQuery(() => seasonRepository.getAll());

  // Form state
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("other");
  const [store, setStore] = useState("");
  const [date, setDate] = useState(todayDate());
  const [seasonId, setSeasonId] = useState("");
  const [notes, setNotes] = useState("");

  // Submission state
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(isEditing);

  // Load existing expense for edit mode
  useEffect(() => {
    if (!id) return;

    void (async () => {
      const expense = await expenseRepository.getById(id);
      if (!expense) {
        void navigate("/expenses", { replace: true });
        return;
      }

      setName(expense.name);
      setAmount(String(expense.amount));
      setCategory(expense.category);
      setStore(expense.store ?? "");
      setDate(expense.date);
      setSeasonId(expense.seasonId ?? "");
      setNotes(expense.notes ?? "");

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

    const amountNum = Number(amount);
    if (!amount || Number.isNaN(amountNum) || amountNum < 0) {
      setErrors(["Amount must be a non-negative number."]);
      return;
    }

    if (!date) {
      setErrors(["Date is required."]);
      return;
    }

    setSaving(true);

    try {
      const input: Parameters<typeof expenseRepository.create>[0] = {
        name: name.trim(),
        category,
        amount: amountNum,
        date,
      };

      const trimmedStore = store.trim();
      if (trimmedStore) input.store = trimmedStore;

      if (seasonId) input.seasonId = seasonId;

      const trimmedNotes = notes.trim();
      if (trimmedNotes) input.notes = trimmedNotes;

      if (isEditing && id) {
        await expenseRepository.update(id, input);
      } else {
        await expenseRepository.create(input);
      }

      void navigate("/expenses", { replace: true });
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
          err instanceof Error ? err.message : "Failed to save expense.";
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
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void navigate("/expenses")}
          className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
          aria-label="Go back"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="font-display text-2xl font-bold text-text-heading">
          {isEditing ? "Edit Expense" : "Add Expense"}
        </h1>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-6">
        <Card>
          <h2 className="font-display text-lg font-semibold text-text-heading">
            Expense Details
          </h2>

          <div className="mt-4 space-y-4">
            {/* Name */}
            <div>
              <label
                htmlFor="expense-name"
                className="mb-1 block text-sm font-medium text-text-secondary"
              >
                Name <span className="text-terracotta-500">*</span>
              </label>
              <Input
                id="expense-name"
                type="text"
                placeholder='e.g. "Garden hose", "Potting mix"'
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Amount */}
            <div>
              <label
                htmlFor="expense-amount"
                className="mb-1 block text-sm font-medium text-text-secondary"
              >
                Amount ($) <span className="text-terracotta-500">*</span>
              </label>
              <Input
                id="expense-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            {/* Category */}
            <div>
              <label
                htmlFor="expense-category"
                className="mb-1 block text-sm font-medium text-text-secondary"
              >
                Category <span className="text-terracotta-500">*</span>
              </label>
              <select
                id="expense-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className={selectClass}
              >
                {EXPENSE_CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Store */}
            <div>
              <label
                htmlFor="expense-store"
                className="mb-1 block text-sm font-medium text-text-secondary"
              >
                Store
              </label>
              <StoreAutosuggest
                id="expense-store"
                value={store}
                onChange={setStore}
              />
            </div>

            {/* Date */}
            <div>
              <label
                htmlFor="expense-date"
                className="mb-1 block text-sm font-medium text-text-secondary"
              >
                Date <span className="text-terracotta-500">*</span>
              </label>
              <Input
                id="expense-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {/* Season */}
            <div>
              <label
                htmlFor="expense-season"
                className="mb-1 block text-sm font-medium text-text-secondary"
              >
                Season
              </label>
              <select
                id="expense-season"
                value={seasonId}
                onChange={(e) => setSeasonId(e.target.value)}
                className={selectClass}
              >
                <option value="">No season</option>
                {seasons?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label
                htmlFor="expense-notes"
                className="mb-1 block text-sm font-medium text-text-secondary"
              >
                Notes
              </label>
              <textarea
                id="expense-notes"
                rows={3}
                placeholder="Any notes about this expense..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-focus-ring focus:outline-none focus:ring-2 focus:ring-focus-ring/25"
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
                : "Add Expense"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => void navigate("/expenses")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
