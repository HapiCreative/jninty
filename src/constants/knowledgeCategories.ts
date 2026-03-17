import type { PlantType } from "../types/index.ts";

export interface PlantCategory {
  slug: string;
  label: string;
  description: string;
  /** Which plantType values belong in this category */
  plantTypes: PlantType[];
}

/** Top-level knowledge sections (plants now, diseases/techniques later) */
export interface KnowledgeSection {
  slug: string;
  label: string;
  description: string;
  route: string;
}

export const PLANT_CATEGORIES: PlantCategory[] = [
  {
    slug: "vegetables",
    label: "Vegetables",
    description: "Edible crops, roots, and leafy greens",
    plantTypes: ["vegetable"],
  },
  {
    slug: "fruits",
    label: "Fruits",
    description: "Fruit trees, berries, and vine fruits",
    plantTypes: ["fruit_tree", "berry"],
  },
  {
    slug: "flowers",
    label: "Flowers",
    description: "Annuals, perennials, and ornamental blooms",
    plantTypes: ["flower", "ornamental"],
  },
  {
    slug: "herbs",
    label: "Herbs",
    description: "Culinary and medicinal herbs",
    plantTypes: ["herb"],
  },
];

/** All top-level knowledge sections. Add diseases, techniques, etc. here later. */
export const ALL_KNOWLEDGE_SECTIONS: KnowledgeSection[] = [
  {
    slug: "plants",
    label: "Plants",
    description: "Browse plant species and varieties",
    route: "/knowledge",
  },
];

export function getCategoryBySlug(slug: string): PlantCategory | undefined {
  return PLANT_CATEGORIES.find((c) => c.slug === slug);
}
