/**
 * PouchDB document wrapper and utility functions.
 *
 * PouchDB stores all documents in a single database. We use a `docType`
 * discriminator and a prefixed `_id` (e.g. "plant:abc-123") to namespace
 * entities and enable efficient queries.
 */

export type PouchDoc<T> = T & {
  _id: string;
  _rev?: string;
  docType: string;
};

/**
 * Generate a PouchDB _id in the format "{docType}:{uuid}".
 * Grouping by prefix enables efficient allDocs range queries.
 */
export function generateId(docType: string): string {
  return `${docType}:${crypto.randomUUID()}`;
}

/**
 * Strip PouchDB-specific fields (_id, _rev, docType) from a document,
 * returning the clean application entity.
 */
export function stripPouchFields<T>(doc: PouchDoc<T>): T {
  const { _id, _rev, docType, ...rest } = doc;
  void _id;
  void _rev;
  void docType;
  return rest as T;
}

/**
 * Wrap an application entity into a PouchDB document.
 * If the entity has an `id` field, it is used to build the _id.
 * Otherwise a new UUID is generated.
 */
export function toPouchDoc<T extends { id?: string }>(
  entity: T,
  docType: string,
): PouchDoc<T> {
  const uuid = entity.id ?? crypto.randomUUID();
  return {
    ...entity,
    _id: `${docType}:${uuid}`,
    docType,
  };
}
