import { taskRuleSchema, type TaskRule } from "../validation/taskRule.schema.ts";
import { taskRuleRepository } from "../db/index.ts";

// Import JSON rule files directly — Vite resolves these at build time
import vegetableRules from "../../data/taskRules/vegetables.json";
import herbRules from "../../data/taskRules/herbs.json";
import generalRules from "../../data/taskRules/general.json";

type RuleInput = Omit<TaskRule, "version" | "createdAt" | "updatedAt" | "deletedAt">;

/**
 * Validate an array of raw rule objects against the TaskRule schema.
 * Invalid entries are skipped with a console warning.
 */
export function parseRuleFile(raw: unknown[]): RuleInput[] {
  const validRules: RuleInput[] = [];

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (typeof item !== "object" || item == null) {
      console.warn(`taskRuleLoader: skipping invalid entry at index ${String(i)}`);
      continue;
    }

    const withDefaults = {
      ...(item as Record<string, unknown>),
      version: 1,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };

    const result = taskRuleSchema.safeParse(withDefaults);
    if (result.success) {
      validRules.push({
        id: result.data.id,
        appliesTo: result.data.appliesTo,
        trigger: result.data.trigger,
        task: result.data.task,
        isBuiltIn: result.data.isBuiltIn,
      });
    } else {
      console.warn(
        `taskRuleLoader: skipping invalid rule at index ${String(i)}:`,
        result.error.issues,
      );
    }
  }

  return validRules;
}

/**
 * Load all built-in rule JSON files and upsert into DB.
 * Safe to call on every app startup — uses upsertBuiltIn for idempotency.
 */
export async function loadBuiltInRules(): Promise<void> {
  const allFiles = [
    vegetableRules as unknown[],
    herbRules as unknown[],
    generalRules as unknown[],
  ];

  for (const file of allFiles) {
    const rules = parseRuleFile(file);
    for (const rule of rules) {
      await taskRuleRepository.upsertBuiltIn(rule);
    }
  }
}
