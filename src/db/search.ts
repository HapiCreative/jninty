// Re-export PouchDB search module.
// Files that import from "../db/search" get PouchDB search automatically.
export {
  addToIndex,
  removeFromIndex,
  search,
  rebuildIndex,
  serializeIndex,
  loadIndex,
  startListening,
  stopListening,
  handleChange,
  _resetIndex,
  type SearchHit,
} from "./pouchdb/search.ts";
