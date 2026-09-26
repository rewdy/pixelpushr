import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  NumberInput,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LuArrowDown, LuArrowUp, LuPlus, LuTrash2 } from "react-icons/lu";
import { Link, useLocation, useParams } from "wouter";
import { requestJson } from "../../helpers/api";
import type {
  MediaAsset,
  Playlist,
  PlaylistItem,
} from "../../models/media.models";

type DraftItem = {
  mediaAssetId: string;
  imageDurationMs?: number;
  videoMode?: "once" | "repeat";
  repeatDurationMs?: number;
};

/** Lists playlists and creates a new ordered content collection. */
export const PlaylistsPage = () => {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const playlists = useQuery({
    queryKey: ["playlists"],
    queryFn: () => requestJson<{ playlists: Playlist[] }>("/admin/playlists"),
  });
  const create = useMutation({
    mutationFn: () =>
      requestJson<{ playlist: Playlist }>("/admin/playlists", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: ({ playlist }) => {
      void queryClient.invalidateQueries({ queryKey: ["playlists"] });
      navigate(`/playlists/${playlist.id}`);
    },
  });
  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Text size="xs" c="dimmed" tt="uppercase" ff="monospace">
          Content
        </Text>
        <Title>Playlists</Title>
        <Text c="dimmed">
          Arrange ready media in the order each display should play it.
        </Text>
      </Stack>
      <Paper withBorder p="lg">
        <Group align="end">
          <TextInput
            label="New playlist"
            placeholder="Brand loop"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Button
            leftSection={<LuPlus size={16} />}
            loading={create.isPending}
            onClick={() => create.mutate()}
          >
            Create playlist
          </Button>
        </Group>
        {create.error && (
          <Alert color="red" mt="md">
            {create.error.message}
          </Alert>
        )}
      </Paper>
      <Paper withBorder p="lg">
        <Table.ScrollContainer minWidth={450}>
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Updated</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {playlists.data?.playlists.map((playlist) => (
                <Table.Tr key={playlist.id}>
                  <Table.Td>
                    <Text fw={600}>{playlist.name}</Text>
                  </Table.Td>
                  <Table.Td>
                    {new Date(playlist.updatedAt).toLocaleDateString()}
                  </Table.Td>
                  <Table.Td>
                    <Button
                      component={Link}
                      href={`/playlists/${playlist.id}`}
                      size="xs"
                      variant="light"
                    >
                      Edit
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        {playlists.data?.playlists.length === 0 && (
          <Text c="dimmed" ta="center" py="xl">
            No playlists yet.
          </Text>
        )}
        {playlists.error && (
          <Alert color="red">{playlists.error.message}</Alert>
        )}
      </Paper>
    </Stack>
  );
};

/** Edits ordered playlist items and per-item image/video playback settings. */
export const PlaylistEditorPage = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
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
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  useEffect(() => {
    if (playlist.data)
      setDraft(
        playlist.data.items.map((item) => ({
          mediaAssetId: item.mediaAssetId,
          ...(item.imageDurationMs
            ? { imageDurationMs: item.imageDurationMs }
            : {}),
          ...(item.videoMode ? { videoMode: item.videoMode } : {}),
          ...(item.repeatDurationMs
            ? { repeatDurationMs: item.repeatDurationMs }
            : {}),
        })),
      );
  }, [playlist.data]);
  const save = useMutation({
    mutationFn: () =>
      requestJson(`/admin/playlists/${id}/items`, {
        method: "PUT",
        body: JSON.stringify({ items: draft }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["playlist", id] });
    },
  });
  const readyAssets =
    assets.data?.assets.filter((asset) => asset.status === "ready") ?? [];
  const update = (position: number, values: Partial<DraftItem>) =>
    setDraft((previous) =>
      previous.map((item, index) =>
        index === position ? { ...item, ...values } : item,
      ),
    );
  const move = (position: number, offset: number) =>
    setDraft((previous) => {
      const copy = [...previous];
      const target = position + offset;
      if (target < 0 || target >= copy.length) return previous;
      [copy[position], copy[target]] = [copy[target]!, copy[position]!];
      return copy;
    });
  const add = () => {
    const asset = readyAssets.find((item) => item.id === selectedAssetId);
    if (!asset) return;
    setDraft((previous) => [
      ...previous,
      asset.kind === "image"
        ? { mediaAssetId: asset.id, imageDurationMs: 8000 }
        : { mediaAssetId: asset.id, videoMode: "once" },
    ]);
    setSelectedAssetId(null);
  };
  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Text size="xs" c="dimmed" tt="uppercase" ff="monospace">
          Content / Playlists
        </Text>
        <Title>{playlist.data?.playlist.name ?? "Playlist editor"}</Title>
        <Text c="dimmed">Set the playback order and timing for each item.</Text>
      </Stack>
      {playlist.error && <Alert color="red">{playlist.error.message}</Alert>}
      <Paper withBorder p="lg">
        <Stack>
          <Title order={3}>Add media</Title>
          <Group align="end">
            <Select
              label="Ready asset"
              placeholder="Choose an image or video"
              data={readyAssets.map((asset) => ({
                value: asset.id,
                label: `${asset.name} (${asset.kind})`,
              }))}
              searchable
              value={selectedAssetId}
              onChange={setSelectedAssetId}
              style={{ flex: 1 }}
            />
            <Button
              leftSection={<LuPlus size={16} />}
              disabled={!selectedAssetId}
              onClick={add}
            >
              Add item
            </Button>
          </Group>
          {readyAssets.length === 0 && (
            <Text size="sm" c="dimmed">
              Upload ready media before editing this playlist.
            </Text>
          )}
        </Stack>
      </Paper>
      <Paper withBorder p="lg">
        <Stack>
          <Group justify="space-between">
            <Title order={3}>Playback order</Title>
            <Badge variant="light">{draft.length} items</Badge>
          </Group>
          {draft.map((item, position) => {
            const asset = readyAssets.find(
              (candidate) => candidate.id === item.mediaAssetId,
            );
            return (
              <Paper key={`${item.mediaAssetId}-${position}`} withBorder p="md">
                <Group justify="space-between" align="start">
                  <Stack gap="xs" style={{ flex: 1 }}>
                    <Group>
                      <Badge variant="light" color="gray">
                        {position + 1}
                      </Badge>
                      <Text fw={600}>{asset?.name ?? "Unavailable asset"}</Text>
                    </Group>
                    {asset?.kind === "image" ? (
                      <NumberInput
                        label="Display seconds"
                        min={1}
                        max={86400}
                        value={(item.imageDurationMs ?? 8000) / 1000}
                        onChange={(value) =>
                          update(position, {
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
                            update(position, {
                              videoMode: value === "repeat" ? "repeat" : "once",
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
                              update(position, {
                                repeatDurationMs: Number(value) * 1000,
                              })
                            }
                          />
                        )}
                      </Group>
                    )}
                  </Stack>
                  <Group gap="xs">
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
                      onClick={() =>
                        setDraft((previous) =>
                          previous.filter((_, index) => index !== position),
                        )
                      }
                    >
                      <LuTrash2 size={16} />
                    </ActionIcon>
                  </Group>
                </Group>
              </Paper>
            );
          })}
          {draft.length === 0 && (
            <Text c="dimmed" ta="center" py="xl">
              This playlist is empty.
            </Text>
          )}
          {save.error && <Alert color="red">{save.error.message}</Alert>}
          {save.isSuccess && <Alert color="signal">Playlist saved.</Alert>}
          <Group justify="flex-end">
            <Button loading={save.isPending} onClick={() => save.mutate()}>
              Save playlist
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Stack>
  );
};
