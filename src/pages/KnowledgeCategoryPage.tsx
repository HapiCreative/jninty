import { useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { usePouchQuery } from "../hooks/usePouchQuery.ts";
import { userPlantKnowledgeRepository } from "../db/index.ts";
import { loadAllKnowledgeItems, groupBySpecies } from "../services/knowledgeBase";
import { getCategoryBySlug } from "../constants/knowledgeCategories.ts";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import { ChevronLeftIcon } from "../components/icons";
import Skeleton from "../components/ui/Skeleton";

export default function KnowledgeCategoryPage() {
  const { category } = useParams<{ category: string }>();
  const navigate = useNavigate();

  const categoryDef = category ? getCategoryBySlug(category) : undefined;

  const userEntries = usePouchQuery(() =>
    userPlantKnowledgeRepository.getAll(),
  );

  const allItems = useMemo(
    () => loadAllKnowledgeItems(userEntries ?? []),
    [userEntries],
  );

  const speciesGroups = useMemo(() => {
    if (!categoryDef) return [];
    const filtered = allItems.filter((item) =>
      categoryDef.plantTypes.includes(item.data.plantType),
    );
    return groupBySpecies(filtered);
  }, [allItems, categoryDef]);

  // Unknown category
  if (!categoryDef) {
    return (
      <div className="p-4 text-center">
        <p className="text-lg font-medium text-text-secondary">
          Category not found
        </p>
        <Link
          to="/knowledge"
          className="mt-2 inline-block text-sm text-text-heading hover:underline"
        >
          Back to Knowledge Base
        </Link>
      </div>
    );
  }

  // Loading
  if (userEntries === undefined) {
    return (
      <div className="mx-auto max-w-5xl p-4" role="status" aria-label="Loading category">
        <Skeleton className="h-8 w-48" />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-border-default bg-surface-elevated p-4">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="mt-2 h-4 w-1/2" />
              <Skeleton className="mt-3 h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/knowledge")}
          className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
          aria-label="Back to knowledge base"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <div>
          <h1 className="font-display text-2xl font-bold text-text-heading">
            {categoryDef.label}
          </h1>
          <p className="text-sm text-text-secondary">
            {speciesGroups.length} species &middot; {categoryDef.description}
          </p>
        </div>
      </div>

      {/* Species grid */}
      {speciesGroups.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-lg font-medium text-text-secondary">
            No entries in this category
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {speciesGroups.map((group) => {
            const isSingle = group.entries.length === 1;
            const href = isSingle
              ? `/knowledge/${group.entries[0]!.id}`
              : `/knowledge/species/${group.speciesSlug}`;
            return (
              <Link key={group.speciesSlug} to={href}>
                <Card className="p-4 transition-shadow hover:shadow-md">
                  <p className="font-display font-semibold text-text-primary truncate">
                    {group.commonName}
                  </p>
                  <p className="mt-0.5 text-sm text-text-secondary truncate italic">
                    {group.species}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    {group.family && (
                      <Badge variant="default">{group.family}</Badge>
                    )}
                    {!isSingle && (
                      <Badge variant="success">
                        {group.entries.length} varieties
                      </Badge>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
