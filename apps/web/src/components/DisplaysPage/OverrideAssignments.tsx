import { Alert, Badge, Button, Checkbox, Group, NumberInput, Paper, Select, Stack, Text, TextInput, Title } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LuTrash2 } from "react-icons/lu";
import { requestJson } from "../../helpers/api";
import type { Playlist } from "../../models/media.models";
import type { Assignment } from "./ScheduledAssignments";

/** An override suppresses every normal playlist until its explicit expiration. */
export const OverrideAssignments = ({ displayId, assignments, playlists }: { displayId: string; assignments: Assignment[]; playlists: Playlist[] }) => {
  const queryClient = useQueryClient();
  const [playlistId, setPlaylistId] = useState<string | null>(null);
  const [activateNow, setActivateNow] = useState(false);
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [priority, setPriority] = useState<number | string>(0);
  const create = useMutation({ mutationFn: () => requestJson(`/admin/displays/${displayId}/overrides`, { method: "POST", body: JSON.stringify({ playlistId, activateNow, startLocal: activateNow ? undefined : startLocal, endLocal, priority: Number(priority) }) }), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["assignments", displayId] }); void queryClient.invalidateQueries({ queryKey: ["schedule-preview", displayId] }); } });
  const remove = useMutation({ mutationFn: (id: string) => requestJson(`/admin/displays/${displayId}/overrides/${id}`, { method: "DELETE" }), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["assignments", displayId] }); void queryClient.invalidateQueries({ queryKey: ["schedule-preview", displayId] }); } });
  return <Paper withBorder p="lg"><Stack>
    <Stack gap={4}><Title order={3}>Overrides</Title><Text size="sm" c="dimmed">An active override cuts in immediately and plays alone until its expiration. Highest priority wins if windows overlap.</Text></Stack>
    {assignments.filter((item) => item.mode === "override").map((item) => <Paper key={item.id} withBorder p="sm"><Group justify="space-between"><Stack gap={2}><Group gap="xs"><Text fw={600}>{item.playlistName}</Text><Badge variant="light" color="accent">Priority {item.priority ?? 0}</Badge></Group><Text size="xs" c="dimmed">{item.schedule ? `${new Date(item.schedule.startAt).toLocaleString()} → ${new Date(item.schedule.endAt).toLocaleString()}` : "No window"}</Text></Stack><Button size="xs" color="red" variant="subtle" leftSection={<LuTrash2 size={14} />} onClick={() => remove.mutate(item.id)}>Remove</Button></Group></Paper>)}
    <Select label="Override playlist" placeholder="Choose a playlist" data={playlists.map((playlist) => ({ value: playlist.id, label: playlist.name }))} value={playlistId} onChange={setPlaylistId} searchable />
    <Checkbox label="Activate now" checked={activateNow} onChange={(event) => setActivateNow(event.currentTarget.checked)} />
    <Group grow align="start">{!activateNow && <TextInput label="Override start" type="datetime-local" value={startLocal} onChange={(event) => setStartLocal(event.currentTarget.value)} />}<TextInput label="Override expiration" type="datetime-local" value={endLocal} onChange={(event) => setEndLocal(event.currentTarget.value)} /></Group>
    <NumberInput label="Priority" description="Larger numbers supersede smaller ones." min={0} max={1000} value={priority} onChange={setPriority} maw={220} />
    {create.error && <Alert color="red">{create.error.message}</Alert>}{create.isSuccess && <Alert color="signal">Override saved. Players will pick it up on their next refresh.</Alert>}{remove.error && <Alert color="red">{remove.error.message}</Alert>}
    <Group justify="flex-end"><Button loading={create.isPending} disabled={!playlistId || !endLocal || (!activateNow && !startLocal)} onClick={() => create.mutate()}>Save override</Button></Group>
  </Stack></Paper>;
};
