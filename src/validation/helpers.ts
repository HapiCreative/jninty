import type { z } from "zod";

export type ValidationSuccess<T> = { success: true; data: T };
export type ValidationError = {
  success: false;
  error: z.ZodError;
};
export type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

export function validateEntity<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
