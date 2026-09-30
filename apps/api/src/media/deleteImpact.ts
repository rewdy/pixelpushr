import { createHash } from "node:crypto";
import type {
  BulkMediaDeleteImpact,
  MediaDeleteImpact,
} from "@pixelpushr/contracts/media";

type UseRow = {
  itemId: string;
  playlistId: string;
  playlistName: string;
};

/** Produces a stable token for the exact set of saved uses shown to an admin. */
export const buildMediaDeleteImpact = (
  assetId: string,
  rows: UseRow[],
): MediaDeleteImpact => {
  const playlists = new Map<string, MediaDeleteImpact["playlists"][number]>();
  for (const row of rows) {
    const playlist = playlists.get(row.playlistId) ?? {
      id: row.playlistId,
      name: row.playlistName,
      itemIds: [],
    };
    playlist.itemIds.push(row.itemId);
    playlists.set(row.playlistId, playlist);
  }
  const ordered = [...playlists.values()].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const playlist of ordered) playlist.itemIds.sort();
  const snapshotToken = createHash("sha256")
    .update(
      JSON.stringify([
        assetId,
        ordered.map((playlist) => [playlist.id, playlist.itemIds]),
      ]),
    )
    .digest("hex");
  return {
    assetId,
    snapshotToken,
    totalItems: rows.length,
    playlists: ordered,
  };
};

/** Summarizes a selected set and hashes both asset versions and saved uses. */
export const buildBulkMediaDeleteImpact = (
  assets: Array<{
    id: string;
    name: string;
    objectKey: string;
    thumbnailKey: string | null;
  }>,
  rows: Array<UseRow & { assetId: string }>,
): BulkMediaDeleteImpact => {
  const orderedAssets = [...assets].sort((a, b) => a.id.localeCompare(b.id));
  const byPlaylist = new Map<
    string,
    BulkMediaDeleteImpact["playlists"][number]
  >();
  for (const row of rows) {
    const playlist = byPlaylist.get(row.playlistId) ?? {
      id: row.playlistId,
      name: row.playlistName,
      itemIds: [],
    };
    playlist.itemIds.push(row.itemId);
    byPlaylist.set(row.playlistId, playlist);
  }
  const playlists = [...byPlaylist.values()].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const playlist of playlists) playlist.itemIds.sort();
  const snapshotToken = createHash("sha256")
    .update(
      JSON.stringify([
        orderedAssets.map((asset) => [
          asset.id,
          asset.name,
          asset.objectKey,
          asset.thumbnailKey,
        ]),
        playlists.map((playlist) => [
          playlist.id,
          playlist.name,
          playlist.itemIds,
        ]),
      ]),
    )
    .digest("hex");
  return {
    assetIds: orderedAssets.map((asset) => asset.id),
    assets: orderedAssets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      itemCount: rows.filter((row) => row.assetId === asset.id).length,
    })),
    snapshotToken,
    totalItems: rows.length,
    playlists,
  };
};
