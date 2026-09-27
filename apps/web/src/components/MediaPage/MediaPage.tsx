import {
  Alert,
  Badge,
  Button,
  FileButton,
  Group,
  Modal,
  MultiSelect,
  Paper,
  Stack,
  Table,
  TagsInput,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import type { MediaDeleteImpact, MediaTag } from "@pixelpushr/contracts/media";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LuUpload } from "react-icons/lu";
import { requestJson } from "../../helpers/api";
import { filterMediaAssets } from "../../helpers/mediaFilters";
import { replaceMediaFile } from "../../helpers/mediaUpload";
import { useMediaUploadQueue } from "../../hooks/useMediaUploadQueue";
import type { MediaAsset } from "../../models/media.models";
import { MediaThumbnail } from "../MediaThumbnail/MediaThumbnail";
import classes from "./MediaPage.module.css";

/** Accepts image/video batches from the picker or a page-wide drop target. */
export const MediaPage = () => {
  const queryClient = useQueryClient();
  const assets = useQuery({
    queryKey: ["media"],
    queryFn: () => requestJson<{ assets: MediaAsset[] }>("/admin/media"),
  });
  const tags = useQuery({
    queryKey: ["media-tags"],
    queryFn: () => requestJson<{ tags: MediaTag[] }>("/admin/media/tags"),
  });
  const { entries, enqueue } = useMediaUploadQueue();
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [search, setSearch] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [action, setAction] = useState<
    "rename" | "replace" | "tags" | "delete" | null
  >(null);
  const [target, setTarget] = useState<MediaAsset | null>(null);
  const [name, setName] = useState("");
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const deleteImpact = useQuery({
    queryKey: ["media-delete-impact", target?.id],
    queryFn: () =>
      requestJson<MediaDeleteImpact>(
        `/admin/media/${target?.id}/delete-impact`,
      ),
    enabled: action === "delete" && !!target,
  });
  const visibleAssets = filterMediaAssets(
    assets.data?.assets ?? [],
    search,
    tagIds,
  );
  const openAction = (next: typeof action, asset: MediaAsset) => {
    setTarget(asset);
    setAction(next);
    setName(asset.name);
    setTagNames(asset.tags.map((tag) => tag.name));
    setActionError(null);
  };
  const closeAction = () => {
    setAction(null);
    setTarget(null);
    setActionError(null);
  };
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["media"] }),
      queryClient.invalidateQueries({ queryKey: ["media-tags"] }),
      queryClient.invalidateQueries({ queryKey: ["playlist"] }),
    ]);
  };
  const runAction = async (
    work: () => Promise<unknown>,
    onFailure?: () => Promise<unknown>,
  ) => {
    setBusy(true);
    setActionError(null);
    try {
      await work();
      await refresh();
      closeAction();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Media action failed",
      );
      if (onFailure) await onFailure();
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const hasFiles = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes("Files");
    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      setDraggingFiles(true);
    };
    const onDragOver = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault();
    };
    const onDragLeave = (event: DragEvent) => {
      if (!event.relatedTarget) setDraggingFiles(false);
    };
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      setDraggingFiles(false);
      enqueue(Array.from(event.dataTransfer?.files ?? []));
    };
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [enqueue]);
  return (
    <Stack gap="xl">
      <Group justify="space-between" align="end">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" ff="monospace">
            Library
          </Text>
          <Title>Media library</Title>
          <Text c="dimmed">
            Choose several images or videos, or drop them anywhere on this page.
          </Text>
        </Stack>
        <FileButton
          multiple
          onChange={(files) => enqueue(files ?? [])}
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
        >
          {(props) => (
            <Button {...props} leftSection={<LuUpload size={16} />}>
              Upload media
            </Button>
          )}
        </FileButton>
      </Group>
      {entries.length > 0 && (
        <Paper withBorder p="lg">
          <Stack gap="sm">
            <Text fw={600}>Upload queue</Text>
            {entries.map((entry) => (
              <Group
                key={entry.id}
                data-testid="upload-entry"
                justify="space-between"
                align="start"
                gap="sm"
              >
                <Stack gap={0}>
                  <Text size="sm">{entry.name}</Text>
                  {entry.error && (
                    <Text size="xs" c="red">
                      {entry.error}
                    </Text>
                  )}
                </Stack>
                <Badge
                  variant="light"
                  color={
                    entry.status === "ready"
                      ? "signal"
                      : entry.status === "failed"
                        ? "red"
                        : "gray"
                  }
                >
                  {entry.status}
                </Badge>
              </Group>
            ))}
          </Stack>
        </Paper>
      )}
      {entries.some((entry) => entry.status === "ready") && (
        <Alert color="signal">Media is ready for playlists.</Alert>
      )}
      <Group align="end" gap="md">
        <TextInput
          label="Search media"
          placeholder="Search by name"
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
        <MultiSelect
          label="Filter by tags"
          placeholder="Any selected tag"
          data={(tags.data?.tags ?? []).map((tag) => ({
            value: tag.id,
            label: tag.name,
          }))}
          value={tagIds}
          onChange={setTagIds}
          clearable
        />
      </Group>
      <Paper withBorder p="lg">
        <Table.ScrollContainer minWidth={820}>
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Asset</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Size</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Tags</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {visibleAssets.map((asset) => (
                <Table.Tr key={asset.id}>
                  <Table.Td>
                    <Group gap="md">
                      <MediaThumbnail asset={asset} width={48} height={36} />
                      <Stack gap={0}>
                        <Text size="sm" fw={600}>
                          {asset.name}
                        </Text>
                        {asset.failureReason && (
                          <Text size="xs" c="red">
                            {asset.failureReason}
                          </Text>
                        )}
                      </Stack>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{asset.kind}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {(asset.sizeBytes / 1024 / 1024).toFixed(1)} MB
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      variant="light"
                      color={
                        asset.status === "ready"
                          ? "signal"
                          : asset.status === "failed"
                            ? "red"
                            : "gray"
                      }
                    >
                      {asset.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {asset.tags.map((tag) => (
                        <Badge
                          key={tag.id}
                          variant="light"
                          color="gray"
                          size="sm"
                        >
                          {tag.name}
                        </Badge>
                      ))}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <Button
                        size="xs"
                        variant="subtle"
                        onClick={() => openAction("rename", asset)}
                      >
                        Rename
                      </Button>
                      <Button
                        size="xs"
                        variant="subtle"
                        onClick={() => openAction("tags", asset)}
                      >
                        Tags
                      </Button>
                      <Button
                        size="xs"
                        variant="subtle"
                        disabled={asset.status !== "ready"}
                        onClick={() => openAction("replace", asset)}
                      >
                        Replace
                      </Button>
                      <Button
                        size="xs"
                        variant="subtle"
                        color="red"
                        onClick={() => openAction("delete", asset)}
                      >
                        Delete
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        {visibleAssets.length === 0 && (
          <Text c="dimmed" ta="center" py="xl">
            {assets.data?.assets.length
              ? "No matching media."
              : "No media yet. Upload an image or video to start."}
          </Text>
        )}
        {assets.error && <Alert color="red">{assets.error.message}</Alert>}
      </Paper>
      <Modal
        opened={action !== null}
        onClose={closeAction}
        title={`${action === "rename" ? "Rename" : action === "replace" ? "Replace" : action === "tags" ? "Edit tags for" : "Delete"} ${target?.name ?? "media"}`}
      >
        <Stack>
          {action === "rename" && target && (
            <>
              <TextInput
                label="Asset name"
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
              />
              <Button
                loading={busy}
                disabled={!name.trim()}
                onClick={() =>
                  void runAction(() =>
                    requestJson(`/admin/media/${target.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({ name }),
                    }),
                  )
                }
              >
                Save name
              </Button>
            </>
          )}
          {action === "tags" && target && (
            <>
              <TagsInput
                label="Tags"
                description="Reuse existing tags or type a new one"
                data={(tags.data?.tags ?? []).map((tag) => tag.name)}
                value={tagNames}
                onChange={setTagNames}
                maxTags={20}
              />
              <Button
                loading={busy}
                onClick={() =>
                  void runAction(() =>
                    requestJson(`/admin/media/${target.id}/tags`, {
                      method: "PUT",
                      body: JSON.stringify({ tags: tagNames }),
                    }),
                  )
                }
              >
                Save tags
              </Button>
            </>
          )}
          {action === "replace" && target && (
            <>
              <Text size="sm">
                Choose a new {target.kind}. Its playlist uses and playback
                timing will stay the same.
              </Text>
              <FileButton
                accept={
                  target.kind === "image"
                    ? "image/jpeg,image/png,image/webp,image/gif"
                    : "video/mp4,video/webm"
                }
                onChange={(file) => {
                  if (file)
                    void runAction(() => replaceMediaFile(target, file));
                }}
              >
                {(props) => (
                  <Button {...props} loading={busy}>
                    Choose replacement
                  </Button>
                )}
              </FileButton>
              {busy && (
                <Text size="sm" c="dimmed">
                  Uploading and validating replacement…
                </Text>
              )}
            </>
          )}
          {action === "delete" && target && (
            <>
              {deleteImpact.isLoading && (
                <Text size="sm">Checking playlist uses…</Text>
              )}
              {deleteImpact.error && (
                <Alert color="red">{deleteImpact.error.message}</Alert>
              )}
              {deleteImpact.data && (
                <>
                  <Text size="sm">
                    {deleteImpact.data.totalItems === 0
                      ? "This asset is not used by any saved playlist."
                      : `This will remove ${deleteImpact.data.totalItems} item${deleteImpact.data.totalItems === 1 ? "" : "s"} from existing playlists:`}
                  </Text>
                  {deleteImpact.data.playlists.map((playlist) => (
                    <Text key={playlist.id} size="sm">
                      {playlist.name}: {playlist.itemIds.length} item
                      {playlist.itemIds.length === 1 ? "" : "s"}
                    </Text>
                  ))}
                  <Text size="xs" c="dimmed">
                    This cannot be undone. Existing players may keep the old
                    file during a seven-day handoff.
                  </Text>
                  <Button
                    color="red"
                    loading={busy}
                    onClick={() =>
                      void runAction(
                        () =>
                          requestJson(`/admin/media/${target.id}`, {
                            method: "DELETE",
                            body: JSON.stringify({
                              snapshotToken: deleteImpact.data.snapshotToken,
                            }),
                          }),
                        () => deleteImpact.refetch(),
                      )
                    }
                  >
                    Delete asset
                    {deleteImpact.data.totalItems ? " and playlist uses" : ""}
                  </Button>
                </>
              )}
            </>
          )}
          {actionError && <Alert color="red">{actionError}</Alert>}
        </Stack>
      </Modal>
      {draggingFiles && (
        <div className={classes.dropOverlay} data-testid="media-drop-overlay">
          <Paper withBorder shadow="xl" p="xl" ta="center">
            <LuUpload size={32} aria-hidden="true" />
            <Title order={3}>Drop files to upload</Title>
            <Text c="dimmed">Images and videos can be uploaded together.</Text>
          </Paper>
        </div>
      )}
    </Stack>
  );
};
