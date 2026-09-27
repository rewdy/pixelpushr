import { describe, expect, test } from "bun:test";
import { buildMediaDeleteImpact } from "../../apps/api/src/media/deleteImpact";
import type { MediaStorage } from "../../apps/api/src/media/storage";
import {
  uploadDeclarationFailure,
  uploadedMediaFailure,
} from "../../apps/api/src/media/uploadValidation";
import { filterMediaAssets } from "../../apps/web/src/helpers/mediaFilters";
import type { MediaAsset } from "../../packages/contracts/src/media";

describe("media management helpers", () => {
  test("delete impact token changes with saved uses, not row order", () => {
    const rows = [
      { itemId: "item-b", playlistId: "playlist-b", playlistName: "B" },
      { itemId: "item-a", playlistId: "playlist-a", playlistName: "A" },
    ];
    const first = buildMediaDeleteImpact("asset", rows);
    expect(
      buildMediaDeleteImpact("asset", [...rows].reverse()).snapshotToken,
    ).toBe(first.snapshotToken);
    expect(
      buildMediaDeleteImpact("asset", rows.slice(0, 1)).snapshotToken,
    ).not.toBe(first.snapshotToken);
    expect(first.totalItems).toBe(2);
  });

  test("selected tags OR together and combine with text search", () => {
    const asset = (id: string, name: string, tags: string[]): MediaAsset => ({
      id,
      name,
      tags: tags.map((tag) => ({ id: tag, name: tag })),
      kind: "image",
      status: "ready",
      mimeType: "image/png",
      sizeBytes: 12,
      width: 1,
      height: 1,
      durationMs: null,
      failureReason: null,
      url: "/media",
      previewUrl: "/media",
      contentVersion: id,
    });
    const assets = [
      asset("a", "Holiday", ["red"]),
      asset("b", "Holiday", ["blue"]),
      asset("c", "Logo", ["blue"]),
    ];
    expect(
      filterMediaAssets(assets, "holiday", ["red", "blue"]).map(
        (item) => item.id,
      ),
    ).toEqual(["a", "b"]);
    expect(filterMediaAssets(assets, "holiday", ["green"])).toEqual([]);
  });

  test("replacement and upload declarations share kind limits and signature checks", async () => {
    expect(uploadDeclarationFailure("image/png", 21, 20, 100)).toContain(
      "limit",
    );
    expect(uploadDeclarationFailure("video/mp4", 21, 20, 100)).toBeNull();
    expect(uploadDeclarationFailure("application/pdf", 10, 20, 100)).toContain(
      "Unsupported",
    );
    const storage: MediaStorage = {
      kind: "local",
      createUploadUrl: async () => "",
      head: async () => ({ sizeBytes: 8, mimeType: "image/png" }),
      readPrefix: async () => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      copy: async () => {},
      writeSmall: async () => {},
      remove: async () => {},
      publicUrl: () => "",
    };
    expect(
      await uploadedMediaFailure(
        storage,
        {
          kind: "image",
          mimeType: "image/png",
          sizeBytes: 8,
          objectKey: "key",
        },
        {},
      ),
    ).toBeNull();
    expect(
      await uploadedMediaFailure(
        storage,
        {
          kind: "video",
          mimeType: "video/mp4",
          sizeBytes: 8,
          objectKey: "key",
        },
        {},
      ),
    ).toBe("Uploaded content type differs from declared type");
  });
});
