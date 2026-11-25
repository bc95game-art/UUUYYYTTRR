import { describe, expect, it } from "vitest";
import { initialLibraryState, libraryReducer } from "../features/offline/reducer";

describe("offline foundation", () => {
  it("accepts only newer library revisions", () => {
    const ready = libraryReducer(initialLibraryState, { type: "SNAPSHOT", revision: 4 });
    expect(ready.phase).toBe("ready");
    expect(ready.revision).toBe(4);
    expect(libraryReducer(ready, { type: "SNAPSHOT", revision: 3 })).toEqual(ready);
  });

  it("models transfer verification and commit", () => {
    const started = libraryReducer(initialLibraryState, { type: "TRANSFER_START", id: "x", total: 10 });
    const verifying = libraryReducer(started, { type: "TRANSFER_VERIFY", id: "x" });
    const committed = libraryReducer(verifying, { type: "TRANSFER_COMMIT", id: "x" });
    expect(committed.transfer.phase).toBe("committing");
  });

});
