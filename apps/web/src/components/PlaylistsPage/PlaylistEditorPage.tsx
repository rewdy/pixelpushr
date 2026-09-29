import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Drawer,
  Group,
  MultiSelect,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  Transition,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LuArrowDown,
  LuArrowLeft,
  LuArrowUp,
  LuPlus,
  LuTrash2,
} from "react-icons/lu";
import { Link, useParams } from "wouter";
import { requestJson } from "../../helpers/api";
import { filterMediaAssets } from "../../helpers/mediaFilters";
import {
  applyBulkDuration,
  type DraftItem,
  draftFromAsset,
  draftFromItem,
  eligibleDurationCount,
  publishedItems,
} from "../../helpers/playlistDraft";
import type {
  MediaAsset,
  Playlist,
  PlaylistItem,
} from "../../models/media.models";
import {
  CompactPlaybackPreview,
  type PreviewItem,
} from "../CompactPlaybackPreview/CompactPlaybackPreview";
import { MediaThumbnail } from "../MediaThumbnail/MediaThumbnail";
import { PageTitle } from "../PageTitle";
import classes from "./PlaylistEditorPage.module.css";

type MediaPickerProps = {
  assets: MediaAsset[];
  onAdd: (asset: MediaAsset) => void;
};

const MediaPicker = ({ assets, onAdd }: MediaPickerProps) => {
  const [filter, setFilter] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const tags = [
    ...new Map(
      assets.flatMap((asset) => asset.tags.map((tag) => [tag.id, tag])),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const filtered = filterMediaAssets(assets, filter, tagIds);
  return (
    <Stack gap="md" w="100%" style={{ minWidth: 0 }} data-testid="media-picker">
      <TextInput
        label="Search ready media"
        placeholder="Search images and videos"
        value={filter}
        onChange={(event) => setFilter(event.currentTarget.value)}
      />
      <MultiSelect
        label="Filter by tags"
        placeholder="Any selected tag"
        data={tags.map((tag) => ({ value: tag.id, label: tag.name }))}
        value={tagIds}
        onChange={setTagIds}
        clearable
      />
      <ScrollArea.Autosize
        mah="65vh"
        type="auto"
        w="100%"
        styles={{ viewport: { maxWidth: "100%" } }}
        className={classes.mediaPickerScroll}
        data-testid="media-picker-scroll"
      >
        <Stack gap="sm" pr="xs" style={{ minWidth: 0 }}>
          {filtered.map((asset) => (
            <Paper
              withBorder
              p="sm"
              key={asset.id}
              w="100%"
              style={{ minWidth: 0 }}
              data-testid="media-picker-row"
            >
              <Group wrap="nowrap" align="center" gap="sm" w="100%">
                <Box style={{ flexShrink: 0 }}>
                  <MediaThumbnail asset={asset} width={80} height={60} />
                </Box>
                <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
                  <Text size="sm" fw={600} truncate title={asset.name}>
                    {asset.name}
                  </Text>
                  <Text size="xs" c="dimmed" tt="capitalize">
                    {asset.kind}
                  </Text>
                </Stack>
                <ActionIcon
                  variant="light"
                  aria-label={`Add ${asset.name}`}
                  onClick={() => onAdd(asset)}
                  style={{ flexShrink: 0 }}
                >
                  <LuPlus size={16} />
                </ActionIcon>
              </Group>
            </Paper>
          ))}
          {filtered.length === 0 && (
            <Text size="sm" c="dimmed">
              {assets.length
                ? "No matching media."
                : "Upload ready media before editing this playlist."}
            </Text>
          )}
        </Stack>
      </ScrollArea.Autosize>
    </Stack>
  );
};

/** Edits an unpublished playlist draft with visual media and bulk actions. */
export const PlaylistEditorPage = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const isDesktop = useMediaQuery("(min-width: 62em)");
  const playlist = useQuery({
    queryKey: ["playlist", id],
    queryFn: () =>
      requestJson<{ playlist: Playlist; items: PlaylistItem[] }>(
        `/admin/playlists/${id}`,
      ),
    enabled: !!id,
  });
  const assets = useQuery({
    queryKey: ["media"],
    queryFn: () => requestJson<{ assets: MediaAsset[] }>("/admin/media"),
  });
  const [draft, setDraft] = useState<DraftItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [panelOpen, setPanelOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [bulkSeconds, setBulkSeconds] = useState<number | string>(8);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const hydratedId = useRef<string | null>(null);
  const revision = useRef(0);

  useEffect(() => {
    if (!playlist.data) return;
    const changedPlaylist = hydratedId.current !== playlist.data.playlist.id;
    if (changedPlaylist || !dirty) {
      setDraft(playlist.data.items.map(draftFromItem));
      setSelected(new Set());
      hydratedId.current = playlist.data.playlist.id;
      if (changedPlaylist) setDirty(false);
    }
  }, [playlist.data, dirty]);

  const readyAssets = useMemo(
    () => assets.data?.assets.filter((asset) => asset.status === "ready") ?? [],
    [assets.data],
  );
  const assetMap = useMemo(
    () => new Map(readyAssets.map((asset) => [asset.id, asset])),
    [readyAssets],
  );
  const changeDraft = (transform: (items: DraftItem[]) => DraftItem[]) => {
    revision.current += 1;
    setDirty(true);
    setBulkMessage(null);
    setDraft(transform);
  };
  const save = useMutation({
    mutationFn: ({
      items,
    }: {
      items: ReturnType<typeof publishedItems>;
      revision: number;
    }) =>
      requestJson(`/admin/playlists/${id}/items`, {
        method: "PUT",
        body: JSON.stringify({ items }),
      }),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["playlist", id] });
      if (revision.current === variables.revision) setDirty(false);
    },
  });
  const add = (asset: MediaAsset) =>
    changeDraft((items) => [...items, draftFromAsset(asset)]);
  const update = (clientId: string, values: Partial<DraftItem>) =>
    changeDraft((items) =>
      items.map((item) =>
        item.clientId === clientId ? { ...item, ...values } : item,
      ),
    );
  const move = (position: number, offset: number) =>
    changeDraft((items) => {
      const target = position + offset;
      if (target < 0 || target >= items.length) return items;
      const copy = [...items];
      const currentItem = copy[position];
      const targetItem = copy[target];
      if (!currentItem || !targetItem) return items;
      copy[position] = targetItem;
      copy[target] = currentItem;
      return copy;
    });
  const remove = (ids: ReadonlySet<string>) => {
    changeDraft((items) => items.filter((item) => !ids.has(item.clientId)));
    setSelected(
      (previous) => new Set([...previous].filter((value) => !ids.has(value))),
    );
  };
  const eligible = eligibleDurationCount(draft, selected, assetMap);
  const validBulkSeconds =
    Number.isInteger(Number(bulkSeconds)) &&
    Number(bulkSeconds) >= 1 &&
    Number(bulkSeconds) <= 86400;
  const picker = <MediaPicker assets={readyAssets} onAdd={add} />;
  const previewItems: PreviewItem[] = draft.flatMap((item) => {
    const asset =
      assetMap.get(item.mediaAssetId) ??
      playlist.data?.items.find(
        (entry) => entry.mediaAssetId === item.mediaAssetId,
      )?.asset;
    if (!asset?.url) return [];
    return [
      {
        id: item.clientId,
        name: asset.name,
        kind: asset.kind,
        url: asset.url,
        imageDurationMs: item.imageDurationMs ?? null,
        videoMode: item.videoMode ?? null,
        repeatDurationMs: item.repeatDurationMs ?? null,
      },
    ];
  });
  const previewStructureKey = draft
    .map((item) => `${item.clientId}:${item.mediaAssetId}`)
    .join("|");
  const preview = (
    <Paper
      withBorder
      p="md"
      w={isDesktop ? 360 : undefined}
      style={{ maxWidth: 360 }}
    >
      <Stack gap="sm">
        <Title order={4}>Draft preview</Title>
        <Text size="xs" c="dimmed">
          Local draft playback · not a live display view
        </Text>
        <CompactPlaybackPreview
          items={previewItems}
          structureKey={previewStructureKey}
        />
      </Stack>
    </Paper>
  );

  return (
    <Stack gap="xl">
      <PageTitle name={playlist.data?.playlist.name ?? "Playlist editor"} />
      <Stack gap={4}>
        <Button
          component={Link}
          href="/playlists"
          variant="subtle"
          size="sm"
          leftSection={<LuArrowLeft size={16} />}
          w="fit-content"
        >
          Back to Playlists
        </Button>
        <Text size="xs" c="dimmed" tt="uppercase" ff="monospace">
          Content / Playlists
        </Text>
        <Title>{playlist.data?.playlist.name ?? "Playlist editor"}</Title>
        <Text c="dimmed">
          Set the playback order and timing for each item. Changes publish on
          Save.
        </Text>
      </Stack>
      {playlist.error && <Alert color="red">{playlist.error.message}</Alert>}
      <Group align="flex-start" wrap="nowrap" gap="lg">
        <Paper withBorder p="lg" style={{ flex: 1, minWidth: 0 }}>
          <Stack>
            <Group justify="space-between">
              <Group gap="sm">
                <Title order={3}>Playback order</Title>
                <Badge variant="light">{draft.length} items</Badge>
              </Group>
              <Group gap="xs">
                <Button
                  variant="subtle"
                  onClick={() => setPreviewOpen((open) => !open)}
                >
                  {previewOpen ? "Hide preview" : "Show preview"}
                </Button>
                <Button
                  variant="light"
                  leftSection={<LuPlus size={16} />}
                  onClick={() => setPanelOpen((open) => !open)}
                >
                  {panelOpen ? "Close media" : "Add media"}
                </Button>
              </Group>
            </Group>
            {selected.size > 0 && (
              <Paper withBorder p="sm">
                <Stack gap="sm">
                  <Group justify="space-between" gap="xs">
                    <Text size="sm">
                      {selected.size} selected · {eligible} can receive a
                      duration
                    </Text>
                    <Button
                      size="xs"
                      variant="subtle"
                      onClick={() => setSelected(new Set())}
                    >
                      Deselect all
                    </Button>
                  </Group>
                  <Group align="end">
                    <NumberInput
                      label="Bulk duration (seconds)"
                      min={1}
                      max={86400}
                      value={bulkSeconds}
                      onChange={setBulkSeconds}
                    />
                    <Button
                      variant="light"
                      disabled={!eligible || !validBulkSeconds}
                      onClick={() => {
                        changeDraft((items) =>
                          applyBulkDuration(
                            items,
                            selected,
                            assetMap,
                            Number(bulkSeconds),
                          ),
                        );
                        setBulkMessage(
                          `${eligible} item${eligible === 1 ? "" : "s"} updated.`,
                        );
                      }}
                    >
                      Apply duration
                    </Button>
                    <Button
                      color="red"
                      variant="light"
                      leftSection={<LuTrash2 size={16} />}
                      onClick={() => remove(selected)}
                    >
                      Delete selected
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            )}
            {bulkMessage && <Alert color="signal">{bulkMessage}</Alert>}
            {draft.map((item, position) => {
              const asset =
                assetMap.get(item.mediaAssetId) ??
                playlist.data?.items.find(
                  (entry) => entry.mediaAssetId === item.mediaAssetId,
                )?.asset;
              return (
                <Paper key={item.clientId} withBorder p="md">
                  <Group justify="space-between" align="start" wrap="nowrap">
                    <Checkbox
                      aria-label={`Select item ${position + 1}`}
                      checked={selected.has(item.clientId)}
                      onChange={(event) => {
                        const checked = event.currentTarget.checked;
                        setSelected((previous) => {
                          const next = new Set(previous);
                          if (checked) next.add(item.clientId);
                          else next.delete(item.clientId);
                          return next;
                        });
                      }}
                    />
                    {asset && (
                      <MediaThumbnail asset={asset} width={64} height={48} />
                    )}
                    <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
                      <Group gap="xs">
                        <Badge variant="light" color="gray">
                          {position + 1}
                        </Badge>
                        <Text fw={600} truncate>
                          {asset?.name ?? "Unavailable asset"}
                        </Text>
                      </Group>
                      {asset?.kind === "image" ? (
                        <NumberInput
                          label="Display seconds"
                          min={1}
                          max={86400}
                          value={(item.imageDurationMs ?? 8000) / 1000}
                          onChange={(value) =>
                            update(item.clientId, {
                              imageDurationMs: Number(value) * 1000,
                            })
                          }
                        />
                      ) : (
                        <Group align="end">
                          <Select
                            label="Video playback"
                            data={[
                              { value: "once", label: "Play once" },
                              { value: "repeat", label: "Repeat for duration" },
                            ]}
                            value={item.videoMode ?? "once"}
                            onChange={(value) =>
                              update(item.clientId, {
                                videoMode:
                                  value === "repeat" ? "repeat" : "once",
                                repeatDurationMs:
                                  value === "repeat"
                                    ? (item.repeatDurationMs ?? 30000)
                                    : undefined,
                              })
                            }
                          />
                          {item.videoMode === "repeat" && (
                            <NumberInput
                              label="Repeat seconds"
                              min={1}
                              max={86400}
                              value={(item.repeatDurationMs ?? 30000) / 1000}
                              onChange={(value) =>
                                update(item.clientId, {
                                  repeatDurationMs: Number(value) * 1000,
                                })
                              }
                            />
                          )}
                        </Group>
                      )}
                    </Stack>
                    <Stack gap="xs">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        aria-label={`Move item ${position + 1} up`}
                        disabled={position === 0}
                        onClick={() => move(position, -1)}
                      >
                        <LuArrowUp size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        aria-label={`Move item ${position + 1} down`}
                        disabled={position === draft.length - 1}
                        onClick={() => move(position, 1)}
                      >
                        <LuArrowDown size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label={`Remove item ${position + 1}`}
                        onClick={() => remove(new Set([item.clientId]))}
                      >
                        <LuTrash2 size={16} />
                      </ActionIcon>
                    </Stack>
                  </Group>
                </Paper>
              );
            })}
            {draft.length === 0 && (
              <Text c="dimmed" ta="center" py="xl">
                This playlist is empty.
              </Text>
            )}
            <Divider />
            {save.error && <Alert color="red">{save.error.message}</Alert>}
            {save.isSuccess && !dirty && (
              <Alert color="signal">Playlist saved.</Alert>
            )}
            <Group justify="flex-end">
              <Button
                loading={save.isPending}
                onClick={() =>
                  save.mutate({
                    items: publishedItems(draft),
                    revision: revision.current,
                  })
                }
              >
                Save playlist
              </Button>
            </Group>
          </Stack>
        </Paper>
        {isDesktop && (
          <Stack gap="md" style={{ flexShrink: 0 }}>
            {previewOpen && preview}
            <Transition
              mounted={panelOpen}
              transition="slide-left"
              duration={200}
              timingFunction="ease"
            >
              {(styles) => (
                <Paper withBorder p="md" w={360} style={styles}>
                  <Title order={4} mb="md">
                    Ready media
                  </Title>
                  {picker}
                </Paper>
              )}
            </Transition>
          </Stack>
        )}
      </Group>
      {!isDesktop && previewOpen && preview}
      {!isDesktop && (
        <Drawer
          opened={panelOpen}
          onClose={() => setPanelOpen(false)}
          title="Ready media"
          position="right"
          size="md"
        >
          {picker}
        </Drawer>
      )}
    </Stack>
  );
};
