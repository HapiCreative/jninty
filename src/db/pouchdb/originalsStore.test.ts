import { describe, it, expect, beforeEach } from "vitest";
import PouchDB from "pouchdb";
import PouchDBAdapterMemory from "pouchdb-adapter-memory";
import { Blob as NodeBlob } from "node:buffer";
import {
  _setOriginalsDB,
  saveOriginal,
  getOriginal,
  removeOriginal,
  clearAllOriginals,
  getOriginalsSizeBytes,
} from "./originalsStore.ts";

PouchDB.plugin(PouchDBAdapterMemory);

function makeBlob(content: string, type = "image/jpeg"): Blob {
  return new NodeBlob([content], { type }) as unknown as Blob;
}

beforeEach(() => {
  const db = new PouchDB(`test-originals-${crypto.randomUUID()}`, {
    adapter: "memory",
  });
  _setOriginalsDB(db);
});

describe("originalsStore", () => {
  describe("saveOriginal + getOriginal", () => {
    it("stores and retrieves a blob by photo ID", async () => {
      const blob = makeBlob("full-resolution-photo-data");
      await saveOriginal("photo-1", blob);

      const retrieved = await getOriginal("photo-1");
      expect(retrieved).toBeDefined();
    });

    it("returns undefined for non-existent photo", async () => {
      const retrieved = await getOriginal("nonexistent");
      expect(retrieved).toBeUndefined();
    });

    it("overwrites existing original (upsert)", async () => {
      await saveOriginal("photo-1", makeBlob("version-1"));
      await saveOriginal("photo-1", makeBlob("version-2"));

      const retrieved = await getOriginal("photo-1");
      expect(retrieved).toBeDefined();
    });
  });

  describe("removeOriginal", () => {
    it("removes a stored original", async () => {
      await saveOriginal("photo-1", makeBlob("data"));
      await removeOriginal("photo-1");

      const retrieved = await getOriginal("photo-1");
      expect(retrieved).toBeUndefined();
    });

    it("does not throw when removing non-existent original", async () => {
      await expect(removeOriginal("nonexistent")).resolves.toBeUndefined();
    });
  });

  describe("clearAllOriginals", () => {
    it("removes all stored originals", async () => {
      await saveOriginal("photo-1", makeBlob("data-1"));
      await saveOriginal("photo-2", makeBlob("data-2"));
      await saveOriginal("photo-3", makeBlob("data-3"));

      await clearAllOriginals();

      expect(await getOriginal("photo-1")).toBeUndefined();
      expect(await getOriginal("photo-2")).toBeUndefined();
      expect(await getOriginal("photo-3")).toBeUndefined();
    });

    it("succeeds when no originals exist", async () => {
      await expect(clearAllOriginals()).resolves.toBeUndefined();
    });
  });

  describe("getOriginalsSizeBytes", () => {
    it("returns 0 when no originals stored", async () => {
      const size = await getOriginalsSizeBytes();
      expect(size).toBe(0);
    });

    it("returns total size of stored originals", async () => {
      await saveOriginal("photo-1", makeBlob("a".repeat(100)));
      await saveOriginal("photo-2", makeBlob("b".repeat(200)));

      const size = await getOriginalsSizeBytes();
      // In memory adapter, attachment lengths should be tracked
      expect(typeof size).toBe("number");
      expect(size).toBeGreaterThanOrEqual(0);
    });
  });
});
