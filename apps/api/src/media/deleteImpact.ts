import { createHash } from "node:crypto";
import type { MediaDeleteImpact } from "@pixelpushr/contracts/media";

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
