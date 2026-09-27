import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { uploadMediaFile } from "../helpers/mediaUpload";

export type UploadEntry = {
  id: string;
  name: string;
  status: "queued" | "uploading" | "ready" | "failed";
  error: string | null;
};

type PendingUpload = { id: string; file: File };
const maxConcurrentUploads = 2;
const supportedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
]);

/** Runs independent media uploads with a bounded, page-local queue. */
export const useMediaUploadQueue = () => {
  const queryClient = useQueryClient();
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const pending = useRef<PendingUpload[]>([]);
  const active = useRef(0);

  const updateEntry = useCallback(
    (id: string, update: Partial<UploadEntry>) => {
      setEntries((current) =>
        current.map((entry) =>
          entry.id === id ? { ...entry, ...update } : entry,
        ),
      );
    },
    [],
  );

  const runQueue = useCallback(() => {
    while (
      active.current < maxConcurrentUploads &&
      pending.current.length > 0
    ) {
      const next = pending.current.shift();
      if (!next) break;
      active.current++;
      updateEntry(next.id, { status: "uploading" });
      void uploadMediaFile(next.file)
        .then(() => updateEntry(next.id, { status: "ready", error: null }))
        .catch((error: unknown) =>
          updateEntry(next.id, {
            status: "failed",
            error: error instanceof Error ? error.message : "Upload failed",
          }),
        )
        .finally(() => {
          active.current--;
          void queryClient.invalidateQueries({ queryKey: ["media"] });
          runQueue();
        });
    }
  }, [queryClient, updateEntry]);

  const enqueue = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const accepted: PendingUpload[] = [];
      const nextEntries = files.map((file): UploadEntry => {
        const id = crypto.randomUUID();
        if (file.type && !supportedTypes.has(file.type))
          return {
            id,
            name: file.name,
            status: "failed",
            error: `Unsupported file type: ${file.type}`,
          };
        accepted.push({ id, file });
        return { id, name: file.name, status: "queued", error: null };
      });
      setEntries((current) => [...nextEntries, ...current]);
      pending.current.push(...accepted);
      runQueue();
    },
    [runQueue],
  );

  return { entries, enqueue };
};
