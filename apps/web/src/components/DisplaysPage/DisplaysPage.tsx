import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  CopyButton,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  LuArrowDown,
  LuArrowUp,
  LuExternalLink,
  LuPlus,
  LuTrash2,
} from "react-icons/lu";
import { Link, useParams } from "wouter";
import { requestJson } from "../../helpers/api";
import type { Playlist } from "../../models/media.models";
import { AddPlaylistDrawer } from "./AddPlaylistDrawer";
import type { Assignment, Display } from "./assignment.models";
import { ScheduleTimePreview } from "./ScheduleTimePreview";

/** Registers displays and exposes each public browser player URL. */
export const DisplaysPage = () => {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const displays = useQuery({
    queryKey: ["displays"],
    queryFn: () => requestJson<{ displays: Display[] }>("/admin/displays"),
    refetchInterval: 30000,
  });
  const create = useMutation({
    mutationFn: () =>
      requestJson("/admin/displays", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      setName("");
      void queryClient.invalidateQueries({ queryKey: ["displays"] });
    },
  });
  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Text size="xs" c="dimmed" tt="uppercase" ff="monospace">
          Playback
        </Text>
        <Title>Displays</Title>
        <Text c="dimmed">
          Each display gets a public URL you can open in a browser or kiosk.
        </Text>
      </Stack>
      <Paper withBorder p="lg">
        <Group align="end">
          <TextInput
            label="Display name"
            placeholder="Lobby TV"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Button
            leftSection={<LuPlus size={16} />}
            loading={create.isPending}
            onClick={() => create.mutate()}
          >
            Register display
          </Button>
        </Group>
        {create.error && (
          <Alert color="red" mt="md">
            {create.error.message}
          </Alert>
        )}
      </Paper>
      <Paper withBorder p="lg">
        <Table.ScrollContainer minWidth={660}>
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Display</Table.Th>
                <Table.Th>Last seen</Table.Th>
                <Table.Th>Player URL</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {displays.data?.displays.map((display) => (
                <Table.Tr key={display.id}>
                  <Table.Td>
                    <Stack gap={0}>
                      <Text fw={600}>{display.name}</Text>
                      <Badge
                        size="xs"
                        variant="light"
                        color={
                          display.lastSeenAt &&
                          Date.now() - new Date(display.lastSeenAt).getTime() <
                            90000
                            ? "signal"
                            : "gray"
                        }
                      >
                        {display.lastSeenAt &&
                        Date.now() - new Date(display.lastSeenAt).getTime() <
                          90000
                          ? "online"
                          : "offline"}
                      </Badge>
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {display.lastSeenAt
                        ? new Date(display.lastSeenAt).toLocaleString()
                        : "Never"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <CopyButton value={display.playerUrl}>
                        {({ copied, copy }) => (
                          <Button size="xs" variant="light" onClick={copy}>
                            {copied ? "Copied" : "Copy URL"}
                          </Button>
                        )}
                      </CopyButton>
                      <ActionIcon
                        component="a"
                        href={display.playerUrl}
                        target="_blank"
                        rel="noreferrer"
                        variant="subtle"
                        aria-label={`Open ${display.name} player`}
                      >
                        <LuExternalLink size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Button
                      component={Link}
                      href={`/displays/${display.id}`}
                      size="xs"
                      variant="light"
                    >
                      Assign playlists
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        {displays.data?.displays.length === 0 && (
          <Text c="dimmed" ta="center" py="xl">
            No displays registered yet.
          </Text>
        )}
        {displays.error && <Alert color="red">{displays.error.message}</Alert>}
      </Paper>
    </Stack>
  );
};

/** Manages all assignment modes for one display. */
export const DisplayEditorPage = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const displays = useQuery({
    queryKey: ["displays"],
    queryFn: () => requestJson<{ displays: Display[] }>("/admin/displays"),
  });
  const assignments = useQuery({
    queryKey: ["assignments", id],
    queryFn: () =>
      requestJson<{ assignments: Assignment[] }>(
        `/admin/displays/${id}/assignments`,
      ),
    enabled: !!id,
  });
  const playlists = useQuery({
    queryKey: ["playlists"],
    queryFn: () => requestJson<{ playlists: Playlist[] }>("/admin/playlists"),
  });
  const me = useQuery({
    queryKey: ["display-workspace-timezone"],
    queryFn: () =>
      requestJson<{ organization: { timezone: string } }>("/admin/me"),
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [always, setAlways] = useState<string[]>([]);
  useEffect(() => {
    if (assignments.data)
      setAlways(
        assignments.data.assignments
          .filter((item) => item.mode === "always")
          .sort((a, b) => a.position - b.position)
          .map((item) => item.playlistId),
      );
  }, [assignments.data]);
  const save = useMutation({
    mutationFn: (playlistIds: string[]) =>
      requestJson(`/admin/displays/${id}/always`, {
        method: "PUT",
        body: JSON.stringify({ playlistIds }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["assignments", id] });
    },
  });
  const remove = useMutation({
    mutationFn: async (item: Assignment) => {
      if (item.mode === "always") {
        const latest = await requestJson<{ assignments: Assignment[] }>(
          `/admin/displays/${id}/assignments`,
        );
        const playlistIds = latest.assignments
          .filter(
            (assignment) =>
              assignment.mode === "always" && assignment.id !== item.id,
          )
          .sort((a, b) => a.position - b.position)
          .map((assignment) => assignment.playlistId);
        return requestJson(`/admin/displays/${id}/always`, {
          method: "PUT",
          body: JSON.stringify({ playlistIds }),
        });
      }
      const kind = item.mode === "scheduled" ? "schedules" : "overrides";
      return requestJson(`/admin/displays/${id}/${kind}/${item.id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["assignments", id] });
    },
  });
  const display = displays.data?.displays.find((item) => item.id === id);
  const items = assignments.data?.assignments ?? [];
  const orderedAlways = always.flatMap((playlistId) => {
    const item = items.find(
      (entry) => entry.mode === "always" && entry.playlistId === playlistId,
    );
    return item ? [item] : [];
  });
  const orderedOther = items
    .filter((item) => item.mode !== "always")
    .sort((a, b) => a.mode.localeCompare(b.mode) || a.position - b.position);
  const savedAlways = items
    .filter((item) => item.mode === "always")
    .sort((a, b) => a.position - b.position)
    .map((item) => item.playlistId);
  const orderChanged = always.join("|") !== savedAlways.join("|");
  const move = (position: number, offset: number) =>
    setAlways((previous) => {
      const copy = [...previous];
      const target = position + offset;
      if (target < 0 || target >= copy.length) return previous;
      const currentId = copy[position];
      const targetId = copy[target];
      if (currentId === undefined || targetId === undefined) return previous;
      [copy[position], copy[target]] = [targetId, currentId];
      return copy;
    });
  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Text size="xs" c="dimmed" tt="uppercase" ff="monospace">
          Playback / Displays
        </Text>
        <Title>{display?.name ?? "Display"}</Title>
        <Text c="dimmed">
          Always-on and active Append playlists cycle together. An active
          Override plays alone.
        </Text>
      </Stack>
      {display && (
        <Group>
          <CopyButton value={display.playerUrl}>
            {({ copied, copy }) => (
              <Button size="sm" variant="light" onClick={copy}>
                {copied ? "Copied" : "Copy player URL"}
              </Button>
            )}
          </CopyButton>
          <Button
            component="a"
            href={display.playerUrl}
            target="_blank"
            rel="noreferrer"
            variant="subtle"
            rightSection={<LuExternalLink size={15} />}
          >
            Open player
          </Button>
        </Group>
      )}
      <Paper withBorder p="lg">
        <Stack>
          <Group justify="space-between">
            <Title order={3}>Assigned playlists</Title>
            <Button
              leftSection={<LuPlus size={16} />}
              onClick={() => setDrawerOpen(true)}
            >
              Add playlist
            </Button>
          </Group>
          {[...orderedAlways, ...orderedOther].map((item) => {
            const position =
              item.mode === "always" ? always.indexOf(item.playlistId) : -1;
            const schedule = item.schedule;
            return (
              <Paper key={item.id} withBorder p="sm">
                <Group justify="space-between" align="center" wrap="wrap">
                  <Stack gap={3}>
                    <Group gap="xs">
                      <Text fw={600}>{item.playlistName}</Text>
                      <Badge
                        variant="light"
                        color={
                          item.mode === "override"
                            ? "red"
                            : item.mode === "scheduled"
                              ? "brand"
                              : "gray"
                        }
                      >
                        {item.mode === "always"
                          ? "Always-on"
                          : item.mode === "scheduled"
                            ? "Append"
                            : "Override"}
                      </Badge>
                      {item.mode === "override" && (
                        <Badge variant="light">Priority {item.priority}</Badge>
                      )}
                    </Group>
                    <Text size="xs" c="dimmed">
                      {schedule
                        ? `${new Date(schedule.startAt).toLocaleString("en-US", { timeZone: schedule.timezone })} → ${new Date(schedule.endAt).toLocaleString("en-US", { timeZone: schedule.timezone })} · ${schedule.timezone}${schedule.recurrence === "weekly" ? ` · Every ${schedule.weekInterval ?? 1} week(s)` : ""}`
                        : `Always active · Position ${position + 1}`}
                    </Text>
                  </Stack>
                  <Group gap="xs">
                    {position >= 0 && (
                      <>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          aria-label={`Move ${item.playlistName} up`}
                          disabled={position === 0}
                          onClick={() => move(position, -1)}
                        >
                          <LuArrowUp size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          aria-label={`Move ${item.playlistName} down`}
                          disabled={position === always.length - 1}
                          onClick={() => move(position, 1)}
                        >
                          <LuArrowDown size={16} />
                        </ActionIcon>
                      </>
                    )}
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label={`Remove ${item.playlistName} ${item.mode}`}
                      disabled={remove.isPending || orderChanged}
                      onClick={() => remove.mutate(item)}
                    >
                      <LuTrash2 size={16} />
                    </ActionIcon>
                  </Group>
                </Group>
              </Paper>
            );
          })}
          {items.length === 0 && (
            <Text c="dimmed">
              No playlists assigned. Add one to start playback.
            </Text>
          )}
          {orderChanged && (
            <Text size="sm" c="dimmed">
              Save the always-on order before removing assignments.
            </Text>
          )}
          {(save.error || remove.error) && (
            <Alert color="red">
              {save.error?.message ?? remove.error?.message}
            </Alert>
          )}
          {orderChanged && (
            <Group justify="flex-end">
              <Button
                loading={save.isPending}
                onClick={() => save.mutate(always)}
              >
                Save always-on order
              </Button>
            </Group>
          )}
        </Stack>
      </Paper>
      {id && (
        <ScheduleTimePreview
          displayId={id}
          timezone={me.data?.organization.timezone ?? "organization timezone"}
          playlists={playlists.data?.playlists ?? []}
        />
      )}
      {id && (
        <AddPlaylistDrawer
          opened={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onSaved={() =>
            void queryClient.invalidateQueries({
              queryKey: ["assignments", id],
            })
          }
          displayId={id}
          playlists={playlists.data?.playlists ?? []}
          timezone={me.data?.organization.timezone ?? "organization timezone"}
          assignments={items}
        />
      )}
    </Stack>
  );
};
