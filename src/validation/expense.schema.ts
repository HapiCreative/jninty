import { z } from "zod";
import { baseEntitySchema, isoDate } from "./base.schema.ts";

export const expenseCategorySchema = z.enum([
  "tools",
  "soil_amendments",
  "containers",
  "infrastructure",
  "fertilizer",
  "pest_control",
  "other",
]);

export const expenseSchema = baseEntitySchema
  .extend({
    name: z.string().min(1),
    category: expenseCategorySchema,
    amount: z.number().nonnegative(),
    store: z.string().min(1).optional(),
    date: isoDate,
    seasonId: z.string().uuid().optional(),
    notes: z.string().min(1).optional(),
  })
  .strict();

export type ExpenseCategory = z.infer<typeof expenseCategorySchema>;
export type Expense = z.infer<typeof expenseSchema>;
