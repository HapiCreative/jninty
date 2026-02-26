import { describe, it, expect } from "vitest";
import { photoSchema } from "./photo.schema.ts";
import { validateEntity } from "./helpers.ts";

const validPhoto = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  version: 0,
  createdAt: "2026-03-15T14:30:00Z",
  updatedAt: "2026-03-15T14:30:00Z",
  thumbnailBlob: new Blob(["thumb"], { type: "image/jpeg" }),
  originalStored: false,
};

describe("photoSchema", () => {
  it("accepts valid minimal photo", () => {
    const result = validateEntity(photoSchema, validPhoto);
    expect(result.success).toBe(true);
  });

  it("accepts photo with all optional fields", () => {
    const full = {
      ...validPhoto,
      displayBlob: new Blob(["display"], { type: "image/jpeg" }),
      displayStoredInOpfs: true,
      originalStored: true,
      caption: "My tomato seedling",
      width: 320,
      height: 240,
    };
    const result = validateEntity(photoSchema, full);
    expect(result.success).toBe(true);
  });

  it("accepts photo without displayStoredInOpfs (defaults to absent)", () => {
    const result = validateEntity(photoSchema, validPhoto);
    expect(result.success).toBe(true);
  });

  it("rejects missing thumbnailBlob", () => {
    const { thumbnailBlob: _, ...noThumb } = validPhoto;
    const result = validateEntity(photoSchema, noThumb);
    expect(result.success).toBe(false);
  });

  it("rejects string instead of Blob for thumbnailBlob", () => {
    const result = validateEntity(photoSchema, {
      ...validPhoto,
      thumbnailBlob: "not-a-blob",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-boolean originalStored", () => {
    const result = validateEntity(photoSchema, {
      ...validPhoto,
      originalStored: "no",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative width", () => {
    const result = validateEntity(photoSchema, {
      ...validPhoto,
      width: -100,
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero height", () => {
    const result = validateEntity(photoSchema, {
      ...validPhoto,
      height: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects fractional width", () => {
    const result = validateEntity(photoSchema, {
      ...validPhoto,
      width: 320.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty caption", () => {
    const result = validateEntity(photoSchema, {
      ...validPhoto,
      caption: "",
    });
    expect(result.success).toBe(false);
  });
});
