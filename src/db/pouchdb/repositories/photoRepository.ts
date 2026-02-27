import { localDB } from "../client.ts";
import { type PouchDoc, stripPouchFields, toPouchDoc } from "../utils.ts";
import { photoSchema, type Photo } from "../../../validation/photo.schema.ts";

const DOC_TYPE = "photo";

type CreatePhotoInput = Omit<
  Photo,
  "id" | "version" | "createdAt" | "updatedAt" | "deletedAt"
>;

export type CreatePhotoWithFilesInput = {
  thumbnailBlob: Blob;
  displayBlob: Blob;
  originalFile?: Blob;
  width: number;
  height: number;
};

function now(): string {
  return new Date().toISOString();
}

/**
 * Convert a Blob to a format PouchDB can store as an attachment.
 * In the browser, PouchDB accepts Blob directly.
 * In Node.js (tests), PouchDB needs a Buffer.
 */
async function toAttachmentData(
  blob: Blob | Buffer,
): Promise<Blob | Buffer> {
  if (typeof Buffer !== "undefined" && blob instanceof Buffer) {
    return blob;
  }
  if (typeof Buffer !== "undefined") {
    // Node.js / jsdom environment — convert Blob to Buffer
    // Use text() as fallback for jsdom Blobs that lack arrayBuffer()
    if (typeof (blob as Blob).arrayBuffer === "function") {
      return Buffer.from(await (blob as Blob).arrayBuffer());
    }
    const text = await (blob as Blob).text();
    return Buffer.from(text);
  }
  return blob;
}

/**
 * Create a photo record with blobs stored as PouchDB attachments.
 * Attachments sync automatically with CouchDB.
 */
export async function create(input: CreatePhotoInput): Promise<Photo> {
  const timestamp = now();
  const id = crypto.randomUUID();

  const record: Photo = {
    ...input,
    id,
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const parsed = photoSchema.parse(record);

  const doc = toPouchDoc(parsed, DOC_TYPE);

  // Remove blob fields from the document body — they'll be attachments
  const { thumbnailBlob, displayBlob, ...docWithoutBlobs } = doc;
  void thumbnailBlob;
  void displayBlob;

  const attachments: Record<
    string,
    { content_type: string; data: Blob | Buffer }
  > = {
    thumbnail: {
      content_type: input.thumbnailBlob.type || "image/jpeg",
      data: await toAttachmentData(input.thumbnailBlob),
    },
  };

  if (input.displayBlob) {
    attachments["display"] = {
      content_type: input.displayBlob.type || "image/jpeg",
      data: await toAttachmentData(input.displayBlob),
    };
  }

  const pouchDoc = {
    ...docWithoutBlobs,
    _attachments: attachments,
  };

  await localDB.put(pouchDoc);
  return parsed;
}

/**
 * Create a photo with separate file handling (thumbnail, display, optional original).
 * All blobs are stored as PouchDB attachments for automatic sync.
 */
export async function createWithFiles(
  input: CreatePhotoWithFilesInput,
): Promise<Photo> {
  const timestamp = now();
  const id = crypto.randomUUID();

  const record: Photo = {
    thumbnailBlob: input.thumbnailBlob,
    displayBlob: input.displayBlob,
    originalStored: !!input.originalFile,
    ...(input.width > 0 ? { width: input.width } : {}),
    ...(input.height > 0 ? { height: input.height } : {}),
    id,
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const parsed = photoSchema.parse(record);
  const doc = toPouchDoc(parsed, DOC_TYPE);

  // Remove blob fields from document body
  const { thumbnailBlob, displayBlob, ...docWithoutBlobs } = doc;
  void thumbnailBlob;
  void displayBlob;

  const attachments: Record<
    string,
    { content_type: string; data: Blob | Buffer }
  > = {
    thumbnail: {
      content_type: input.thumbnailBlob.type || "image/jpeg",
      data: await toAttachmentData(input.thumbnailBlob),
    },
    display: {
      content_type: input.displayBlob.type || "image/jpeg",
      data: await toAttachmentData(input.displayBlob),
    },
  };

  if (input.originalFile) {
    attachments["original"] = {
      content_type: input.originalFile.type || "image/jpeg",
      data: await toAttachmentData(input.originalFile),
    };
  }

  const pouchDoc = {
    ...docWithoutBlobs,
    _attachments: attachments,
  };

  await localDB.put(pouchDoc);
  return parsed;
}

export async function remove(id: string): Promise<void> {
  const docId = `${DOC_TYPE}:${id}`;
  let existing;
  try {
    existing = await localDB.get(docId);
  } catch {
    throw new Error(`Photo not found: ${id}`);
  }
  await localDB.remove(existing);
}

export async function getById(id: string): Promise<Photo | undefined> {
  const docId = `${DOC_TYPE}:${id}`;
  try {
    const doc = await localDB.get<PouchDoc<Photo>>(docId, {
      attachments: true,
      binary: true,
    });

    const entity = stripPouchFields(doc);

    // Restore blobs from attachments
    const attachments = (doc as Record<string, unknown>)._attachments as
      | Record<string, { data: Blob | Buffer }>
      | undefined;
    if (attachments?.["thumbnail"]) {
      const data = attachments["thumbnail"].data;
      entity.thumbnailBlob =
        data instanceof Blob ? data : new Blob([data]);
    }
    if (attachments?.["display"]) {
      const data = attachments["display"].data;
      entity.displayBlob =
        data instanceof Blob ? data : new Blob([data]);
    }

    return entity;
  } catch {
    return undefined;
  }
}

export async function getByIds(ids: string[]): Promise<Photo[]> {
  const results: Photo[] = [];
  for (const id of ids) {
    const photo = await getById(id);
    if (photo) results.push(photo);
  }
  return results;
}

export async function getDisplayBlob(
  photoId: string,
): Promise<Blob | undefined> {
  const docId = `${DOC_TYPE}:${photoId}`;
  try {
    // Try display attachment first, fall back to thumbnail
    try {
      const data = await localDB.getAttachment(docId, "display");
      if (data) {
        return data instanceof Blob ? data : new Blob([data as Buffer]);
      }
    } catch {
      // display attachment doesn't exist
    }

    const data = await localDB.getAttachment(docId, "thumbnail");
    if (data) {
      return data instanceof Blob ? data : new Blob([data as Buffer]);
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export async function getOriginalBlob(
  photoId: string,
): Promise<Blob | undefined> {
  const docId = `${DOC_TYPE}:${photoId}`;
  try {
    const data = await localDB.getAttachment(docId, "original");
    if (data) {
      return data instanceof Blob ? data : new Blob([data as Buffer]);
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Remove a photo and all its attachments.
 * In PouchDB, removing the document removes all attachments.
 */
export async function removeWithFiles(id: string): Promise<void> {
  return remove(id);
}
