import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../schema.ts";
import * as photoRepo from "./photoRepository.ts";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

function makeBlob(content = "photo-data"): Blob {
  return new Blob([content], { type: "image/jpeg" });
}

const basePhoto = {
  thumbnailBlob: makeBlob("thumb"),
  originalStored: false,
};

describe("photoRepository", () => {
  describe("create", () => {
    it("creates a photo with auto-generated fields", async () => {
      const photo = await photoRepo.create(basePhoto);

      expect(photo.id).toBeDefined();
      expect(photo.version).toBe(1);
      expect(photo.createdAt).toBeDefined();
      expect(photo.originalStored).toBe(false);
    });

    it("creates a photo with optional fields", async () => {
      const photo = await photoRepo.create({
        ...basePhoto,
        displayBlob: makeBlob("display"),
        caption: "Beautiful tomato",
        width: 1600,
        height: 1200,
      });

      expect(photo.caption).toBe("Beautiful tomato");
      expect(photo.width).toBe(1600);
    });
  });

  describe("remove (hard delete)", () => {
    it("permanently removes a photo", async () => {
      const photo = await photoRepo.create(basePhoto);
      await photoRepo.remove(photo.id);

      const found = await photoRepo.getById(photo.id);
      expect(found).toBeUndefined();
    });

    it("throws when removing a non-existent photo", async () => {
      await expect(
        photoRepo.remove("00000000-0000-0000-0000-000000000000"),
      ).rejects.toThrow("Photo not found");
    });
  });

  describe("getById", () => {
    it("returns a photo by id", async () => {
      const photo = await photoRepo.create(basePhoto);
      const found = await photoRepo.getById(photo.id);
      expect(found?.id).toBe(photo.id);
    });

    it("returns undefined for non-existent id", async () => {
      const found = await photoRepo.getById(
        "00000000-0000-0000-0000-000000000000",
      );
      expect(found).toBeUndefined();
    });
  });

  describe("getByIds", () => {
    it("returns multiple photos by ids", async () => {
      const p1 = await photoRepo.create(basePhoto);
      const p2 = await photoRepo.create(basePhoto);
      await photoRepo.create(basePhoto); // not requested

      const results = await photoRepo.getByIds([p1.id, p2.id]);
      expect(results).toHaveLength(2);
      const ids = results.map((r) => r.id);
      expect(ids).toContain(p1.id);
      expect(ids).toContain(p2.id);
    });

    it("skips non-existent ids", async () => {
      const p1 = await photoRepo.create(basePhoto);
      const results = await photoRepo.getByIds([
        p1.id,
        "00000000-0000-0000-0000-000000000000",
      ]);
      expect(results).toHaveLength(1);
    });
  });
});
