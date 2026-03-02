import { describe, it, expect, beforeEach, vi } from "vitest";
import PouchDB from "pouchdb";
import PouchDBFind from "pouchdb-find";
import PouchDBAdapterMemory from "pouchdb-adapter-memory";
import { Blob as NodeBlob } from "node:buffer";

PouchDB.plugin(PouchDBFind);
PouchDB.plugin(PouchDBAdapterMemory);

let testDB: PouchDB.Database;
let originalsTestDB: PouchDB.Database;

vi.mock("../client.ts", () => ({
  get localDB() {
    return testDB;
  },
}));

// Mock originalsStore to use a per-test in-memory PouchDB
vi.mock("../originalsStore.ts", async () => {
  const PouchDBModule = await import("pouchdb");
  const PouchDBMem = await import("pouchdb-adapter-memory");
  PouchDBModule.default.plugin(PouchDBMem.default);
  const { Blob: NBlob } = await import("node:buffer");

  // originalsTestDB is reassigned in beforeEach
  return {
    saveOriginal: async (photoId: string, blob: Blob) => {
      let data: Buffer;
      if (typeof (blob as Blob).arrayBuffer === "function") {
        data = Buffer.from(await (blob as Blob).arrayBuffer());
      } else {
        data = Buffer.alloc(0);
      }
      await originalsTestDB.put({
        _id: `original:${photoId}`,
        photoId,
        _attachments: {
          original: {
            content_type: blob.type || "image/jpeg",
            data,
          },
        },
      });
    },
    getOriginal: async (photoId: string): Promise<Blob | undefined> => {
      try {
        const att = await originalsTestDB.getAttachment(`original:${photoId}`, "original");
        if (!att) return undefined;
        return att instanceof NBlob ? (att as unknown as Blob) : new NBlob([att as Buffer]) as unknown as Blob;
      } catch {
        return undefined;
      }
    },
    removeOriginal: async (photoId: string) => {
      try {
        const doc = await originalsTestDB.get(`original:${photoId}`);
        await originalsTestDB.remove(doc);
      } catch {
        // not found
      }
    },
  };
});

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
  originalsTestDB = new PouchDB(`test-originals-${crypto.randomUUID()}`, {
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
    it("creates a photo with thumbnail and display as PouchDB attachments", async () => {
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

    it("stores originals in local-only store, not as PouchDB attachments", async () => {
      const photo = await photoRepo.createWithFiles({
        thumbnailBlob: makeBlob("thumb"),
        displayBlob: makeBlob("display"),
        originalFile: makeBlob("original-data"),
        width: 1600,
        height: 1200,
      });

      // The synced PouchDB doc should NOT have an "original" attachment
      const doc = await testDB.get(`photo:${photo.id}`, { attachments: true });
      const attachments = (doc as Record<string, unknown>)["_attachments"] as
        | Record<string, unknown>
        | undefined;

      expect(attachments?.["thumbnail"]).toBeDefined();
      expect(attachments?.["display"]).toBeDefined();
      expect(attachments?.["original"]).toBeUndefined();

      // The original should be in the local-only originals store
      const originalBlob = await photoRepo.getOriginalBlob(photo.id);
      expect(originalBlob).toBeDefined();
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
    it("returns original blob from local store when stored", async () => {
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

    it("removeWithFiles removes doc, attachments, and local originals", async () => {
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

      // Original should also be removed from local store
      const originalBlob = await photoRepo.getOriginalBlob(photo.id);
      expect(originalBlob).toBeUndefined();
    });

    it("throws when removing non-existent photo", async () => {
      await expect(photoRepo.remove("nonexistent")).rejects.toThrow(
        "Photo not found",
      );
    });
  });
});
