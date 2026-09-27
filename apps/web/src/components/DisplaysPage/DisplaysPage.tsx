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
import { OverrideAssignments } from "./OverrideAssignments";
import { type Assignment, ScheduledAssignments } from "./ScheduledAssignments";

type Display = {
  id: string;
  name: string;
  playerUrl: string;
  lastSeenAt: string | null;
  lastHealth: string | null;
};

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

/** Orders always-active playlists for one display. */
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
    mutationFn: () =>
      requestJson(`/admin/displays/${id}/always`, {
        method: "PUT",
        body: JSON.stringify({ playlistIds: always }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["assignments", id] });
    },
  });
  const display = displays.data?.displays.find((item) => item.id === id);
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
          Always and active scheduled playlists cycle together in order.
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
          <Title order={3}>Always-active playlists</Title>
          {always.map((playlistId, position) => (
            <Paper key={playlistId} withBorder p="sm">
              <Group justify="space-between">
                <Group>
                  <Badge variant="light" color="gray">
                    {position + 1}
                  </Badge>
                  <Text fw={600}>
                    {playlists.data?.playlists.find(
                      (item) => item.id === playlistId,
                    )?.name ?? "Playlist"}
                  </Text>
                </Group>
                <Group gap="xs">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label={`Move playlist ${position + 1} up`}
                    disabled={position === 0}
                    onClick={() => move(position, -1)}
                  >
                    <LuArrowUp size={16} />
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label={`Move playlist ${position + 1} down`}
                    disabled={position === always.length - 1}
                    onClick={() => move(position, 1)}
                  >
                    <LuArrowDown size={16} />
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label={`Remove playlist ${position + 1}`}
                    onClick={() =>
                      setAlways((previous) =>
                        previous.filter((_, index) => index !== position),
                      )
                    }
                  >
                    <LuTrash2 size={16} />
                  </ActionIcon>
                </Group>
              </Group>
            </Paper>
          ))}
          {playlists.data?.playlists
            .filter((playlist) => !always.includes(playlist.id))
            .map((playlist) => (
              <Button
                key={playlist.id}
                variant="subtle"
                leftSection={<LuPlus size={15} />}
                style={{ alignSelf: "flex-start" }}
                onClick={() =>
                  setAlways((previous) => [...previous, playlist.id])
                }
              >
                Add {playlist.name}
              </Button>
            ))}
          {always.length === 0 && (
            <Text size="sm" c="dimmed">
              No playlists assigned. The player will wait until you add one.
            </Text>
          )}
          {save.error && <Alert color="red">{save.error.message}</Alert>}
          {save.isSuccess && (
            <Alert color="signal">
              Assignments saved. The player will pick them up shortly.
            </Alert>
          )}
          <Group justify="flex-end">
            <Button loading={save.isPending} onClick={() => save.mutate()}>
              Save assignments
            </Button>
          </Group>
        </Stack>
      </Paper>
      {id && (
        <ScheduledAssignments
          displayId={id}
          assignments={assignments.data?.assignments ?? []}
          playlists={playlists.data?.playlists ?? []}
        />
      )}
      {id && (
        <OverrideAssignments
          displayId={id}
          assignments={assignments.data?.assignments ?? []}
          playlists={playlists.data?.playlists ?? []}
        />
      )}
    </Stack>
  );
};
