import { describe, it, expect, beforeEach, vi } from "vitest";
import PouchDB from "pouchdb";
import PouchDBFind from "pouchdb-find";
import PouchDBAdapterMemory from "pouchdb-adapter-memory";
import { Blob as NodeBlob } from "node:buffer";

PouchDB.plugin(PouchDBFind);
PouchDB.plugin(PouchDBAdapterMemory);

let testDB: PouchDB.Database;

vi.mock("../client.ts", () => ({
  get localDB() {
    return testDB;
  },
}));

// Mock the photo schema to accept Node.js Blob (jsdom overrides global Blob
// with a broken implementation that lacks arrayBuffer/text methods)
vi.mock("../../../validation/photo.schema.ts", async () => {
  const { z } = await import("zod");
  const { baseEntitySchema } = await import("../../../validation/base.schema.ts");

  const photoSchema = baseEntitySchema
    .extend({
      thumbnailBlob: z.any(),
      displayBlob: z.any().optional(),
      displayStoredInOpfs: z.boolean().optional(),
      originalStored: z.boolean(),
      caption: z.string().min(1).optional(),
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
    })
    .strict();

  type Photo = z.infer<typeof photoSchema>;
  return { photoSchema };
});

const photoRepo = await import("./photoRepository.ts");

// Use Node.js native Blob which has proper arrayBuffer()/text() methods
function makeBlob(content: string, type = "image/jpeg"): Blob {
  return new NodeBlob([content], { type }) as unknown as Blob;
}

beforeEach(async () => {
  testDB = new PouchDB(`test-photo-${crypto.randomUUID()}`, {
    adapter: "memory",
  });
});

describe("PouchDB photoRepository", () => {
  describe("create", () => {
    it("creates a photo with blobs stored as attachments", async () => {
      const thumbnailBlob = makeBlob("thumb-data");
      const displayBlob = makeBlob("display-data");

      const photo = await photoRepo.create({
        thumbnailBlob,
        displayBlob,
        originalStored: false,
      });

      expect(photo.id).toBeDefined();
      expect(photo.version).toBe(1);
    });
  });

  describe("createWithFiles", () => {
    it("creates a photo with thumbnail, display, and original attachments", async () => {
      const photo = await photoRepo.createWithFiles({
        thumbnailBlob: makeBlob("thumb"),
        displayBlob: makeBlob("display"),
        originalFile: makeBlob("original"),
        width: 1600,
        height: 1200,
      });

      expect(photo.id).toBeDefined();
      expect(photo.originalStored).toBe(true);
      expect(photo.width).toBe(1600);
      expect(photo.height).toBe(1200);
    });
  });

  describe("getById", () => {
    it("retrieves photo with blobs from attachments", async () => {
      const created = await photoRepo.create({
        thumbnailBlob: makeBlob("thumb-content"),
        displayBlob: makeBlob("display-content"),
        originalStored: false,
      });

      const found = await photoRepo.getById(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      // In Node.js, PouchDB returns Buffers; our code wraps them in Blob
      expect(found?.thumbnailBlob).toBeDefined();
    });

    it("returns undefined for non-existent photo", async () => {
      const found = await photoRepo.getById("nonexistent");
      expect(found).toBeUndefined();
    });
  });

  describe("getByIds", () => {
    it("returns photos matching the given ids", async () => {
      const p1 = await photoRepo.create({
        thumbnailBlob: makeBlob("t1"),
        originalStored: false,
      });
      const p2 = await photoRepo.create({
        thumbnailBlob: makeBlob("t2"),
        originalStored: false,
      });
      await photoRepo.create({
        thumbnailBlob: makeBlob("t3"),
        originalStored: false,
      });

      const results = await photoRepo.getByIds([p1.id, p2.id]);
      expect(results).toHaveLength(2);
    });
  });

  describe("getDisplayBlob", () => {
    it("returns display blob when available", async () => {
      const created = await photoRepo.createWithFiles({
        thumbnailBlob: makeBlob("thumb"),
        displayBlob: makeBlob("display-blob-content"),
        width: 800,
        height: 600,
      });

      const blob = await photoRepo.getDisplayBlob(created.id);
      expect(blob).toBeDefined();
    });

    it("falls back to thumbnail when no display blob", async () => {
      const created = await photoRepo.create({
        thumbnailBlob: makeBlob("thumb-only"),
        originalStored: false,
      });

      const blob = await photoRepo.getDisplayBlob(created.id);
      expect(blob).toBeDefined();
    });
  });

  describe("getOriginalBlob", () => {
    it("returns original blob when stored", async () => {
      const created = await photoRepo.createWithFiles({
        thumbnailBlob: makeBlob("thumb"),
        displayBlob: makeBlob("display"),
        originalFile: makeBlob("original-full"),
        width: 3000,
        height: 2000,
      });

      const blob = await photoRepo.getOriginalBlob(created.id);
      expect(blob).toBeDefined();
    });

    it("returns undefined when no original stored", async () => {
      const created = await photoRepo.create({
        thumbnailBlob: makeBlob("thumb"),
        originalStored: false,
      });

      const blob = await photoRepo.getOriginalBlob(created.id);
      expect(blob).toBeUndefined();
    });
  });

  describe("remove / removeWithFiles", () => {
    it("removes a photo document", async () => {
      const photo = await photoRepo.create({
        thumbnailBlob: makeBlob("thumb"),
        originalStored: false,
      });

      await photoRepo.remove(photo.id);

      const found = await photoRepo.getById(photo.id);
      expect(found).toBeUndefined();
    });

    it("removeWithFiles removes doc and all attachments", async () => {
      const photo = await photoRepo.createWithFiles({
        thumbnailBlob: makeBlob("thumb"),
        displayBlob: makeBlob("display"),
        originalFile: makeBlob("original"),
        width: 100,
        height: 100,
      });

      await photoRepo.removeWithFiles(photo.id);

      const found = await photoRepo.getById(photo.id);
      expect(found).toBeUndefined();
    });

    it("throws when removing non-existent photo", async () => {
      await expect(photoRepo.remove("nonexistent")).rejects.toThrow(
        "Photo not found",
      );
    });
  });
});
