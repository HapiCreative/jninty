import "fake-indexeddb/auto";
import { beforeEach } from "vitest";
import { db } from "../src/db/schema.ts";

// Reset the database before each test to ensure isolation.
beforeEach(async () => {
  await db.delete();
  await db.open();
});
