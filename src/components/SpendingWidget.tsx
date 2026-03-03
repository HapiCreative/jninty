import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { usePouchQuery } from "../hooks/usePouchQuery.ts";
import { seasonRepository } from "../db/index.ts";
import {
  getTotalSpent,
  getSpendingByCategory,
  type CategoryTotal,
} from "../services/expenseService";
import Card from "./ui/Card";
import { ChevronRightIcon } from "./icons";

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export default function SpendingWidget() {
  const activeSeason = usePouchQuery(() => seasonRepository.getActive());
  const [total, setTotal] = useState<number | null>(null);
  const [topCategories, setTopCategories] = useState<CategoryTotal[]>([]);

  useEffect(() => {
    if (!activeSeason) return;

    void (async () => {
      const filters = { seasonId: activeSeason.id };
      const [t, cats] = await Promise.all([
        getTotalSpent(filters),
        getSpendingByCategory(filters),
      ]);
      setTotal(t);
      setTopCategories(cats.slice(0, 3));
    })();
  }, [activeSeason]);

  // Empty state — no season or no data loaded yet
  if (!activeSeason) return null;

  // Still loading
  if (total === null) return null;

  // No expenses yet
  if (total === 0 && topCategories.length === 0) {
    return (
      <Link to="/expenses" className="block">
        <Card className="border-border-strong bg-brown-50/30 transition-shadow hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brown-100 text-lg">
              $
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary">
                Track your garden spending
              </p>
              <p className="mt-0.5 text-xs text-text-secondary">
                Add expenses to see spending insights
              </p>
            </div>
            <ChevronRightIcon className="h-5 w-5 shrink-0 text-text-muted" />
          </div>
        </Card>
      </Link>
    );
  }

  return (
    <Link to="/expenses" className="block">
      <Card className="transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-text-secondary">Season Spending</p>
            <p className="font-display text-xl font-bold text-text-heading">
              {formatCurrency(total)}
            </p>
          </div>
          <ChevronRightIcon className="h-5 w-5 text-text-muted" />
        </div>
        {topCategories.length > 0 && (
          <p className="mt-1 text-xs text-text-secondary">
            {topCategories
              .map((c) => `${c.label} ${formatCurrency(c.total)}`)
              .join(" · ")}
          </p>
        )}
      </Card>
    </Link>
  );
}
