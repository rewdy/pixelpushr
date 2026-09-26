import { Alert, Badge, Button, Group, NumberInput, Paper, Select, Stack, Text, TextInput, Title } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LuTrash2 } from "react-icons/lu";
import { requestJson } from "../../helpers/api";
import type { Playlist } from "../../models/media.models";

export type Assignment = {
  id: string; playlistId: string; playlistName: string; mode: "always" | "scheduled" | "override"; position: number; priority: number;
  schedule: { recurrence: "none" | "weekly"; startAt: string; endAt: string; timezone: string; weekInterval: number | null } | null;
};

type ManifestPreview = { normalQueue: { playlistId: string }[]; serverTime: string };

/** Configures additive schedules using local times in the organization's timezone. */
export const ScheduledAssignments = ({ displayId, assignments, playlists }: { displayId: string; assignments: Assignment[]; playlists: Playlist[] }) => {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => requestJson<{ organization: { timezone: string } }>("/admin/me") });
  const [playlistId, setPlaylistId] = useState<string | null>(null);
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [recurrence, setRecurrence] = useState<"none" | "weekly">("none");
  const [weekInterval, setWeekInterval] = useState<number | string>(1);
  const [previewLocal, setPreviewLocal] = useState("");
  const [previewAt, setPreviewAt] = useState("");
  const preview = useQuery({ queryKey: ["schedule-preview", displayId, previewAt], queryFn: () => requestJson<ManifestPreview>(`/admin/displays/${displayId}/preview?atLocal=${encodeURIComponent(previewAt)}`), enabled: !!previewAt });
  const create = useMutation({ mutationFn: () => requestJson(`/admin/displays/${displayId}/schedules`, { method: "POST", body: JSON.stringify({ playlistId, startLocal, endLocal, recurrence, weekInterval: recurrence === "weekly" ? Number(weekInterval) : undefined, position: assignments.filter((item) => item.mode === "scheduled").length }) }), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["assignments", displayId] }); void queryClient.invalidateQueries({ queryKey: ["schedule-preview", displayId] }); } });
  const remove = useMutation({ mutationFn: (assignmentId: string) => requestJson(`/admin/displays/${displayId}/schedules/${assignmentId}`, { method: "DELETE" }), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["assignments", displayId] }); void queryClient.invalidateQueries({ queryKey: ["schedule-preview", displayId] }); } });
  const timezone = me.data?.organization.timezone ?? "organization timezone";
  const selected = assignments.filter((item) => item.mode === "scheduled");
  const playlistNames = new Map(playlists.map((playlist) => [playlist.id, playlist.name]));
  return <Paper withBorder p="lg"><Stack>
    <Stack gap={4}><Title order={3}>Scheduled playlists</Title><Text size="sm" c="dimmed">These join the always-active queue while their window is active. Times use {timezone}.</Text></Stack>
    {selected.map((item) => <Paper key={item.id} withBorder p="sm"><Group justify="space-between" align="center"><Stack gap={2}><Group gap="xs"><Text fw={600}>{item.playlistName}</Text><Badge variant="light" color="gray">{item.schedule?.recurrence === "weekly" ? `Every ${item.schedule.weekInterval ?? 1} week${item.schedule.weekInterval === 1 ? "" : "s"}` : "One-time"}</Badge></Group><Text size="xs" c="dimmed">{item.schedule ? `${new Date(item.schedule.startAt).toLocaleString("en-US", { timeZone: item.schedule.timezone })} → ${new Date(item.schedule.endAt).toLocaleString("en-US", { timeZone: item.schedule.timezone })}` : "No window"}</Text></Stack><Button variant="subtle" color="red" size="xs" leftSection={<LuTrash2 size={14} />} onClick={() => remove.mutate(item.id)}>Remove</Button></Group></Paper>)}
    {selected.length === 0 && <Text size="sm" c="dimmed">No scheduled playlists yet.</Text>}
    <Select label="Playlist" placeholder="Choose a playlist" data={playlists.map((playlist) => ({ value: playlist.id, label: playlist.name }))} value={playlistId} onChange={setPlaylistId} searchable />
    <Group grow align="start"><TextInput label="Start" type="datetime-local" value={startLocal} onChange={(event) => setStartLocal(event.currentTarget.value)} /><TextInput label="End" type="datetime-local" value={endLocal} onChange={(event) => setEndLocal(event.currentTarget.value)} /></Group>
    <Group grow align="start"><Select label="Repeat" data={[{ value: "none", label: "One-time window" }, { value: "weekly", label: "Every N weeks" }]} value={recurrence} onChange={(value) => setRecurrence(value === "weekly" ? "weekly" : "none")} />{recurrence === "weekly" && <NumberInput label="Repeat every (weeks)" min={1} max={52} value={weekInterval} onChange={setWeekInterval} description="Use 3 for three weekly campaign playlists." />}</Group>
    {create.error && <Alert color="red">{create.error.message}</Alert>}{create.isSuccess && <Alert color="signal">Schedule saved.</Alert>}
    <Group justify="flex-end"><Button onClick={() => create.mutate()} loading={create.isPending} disabled={!playlistId || !startLocal || !endLocal}>Add schedule</Button></Group>
    <Paper withBorder p="md"><Stack gap="sm"><Title order={4}>Preview effective queue</Title><Text size="sm" c="dimmed">Choose a time in {timezone} to see which playlists will cycle.</Text><Group align="end"><TextInput label="Preview at" type="datetime-local" value={previewLocal} onChange={(event) => setPreviewLocal(event.currentTarget.value)} /><Button variant="light" disabled={!previewLocal} onClick={() => setPreviewAt(previewLocal)}>Preview</Button></Group>{preview.error && <Alert color="red">{preview.error.message}</Alert>}{preview.data && <Text size="sm">{preview.data.normalQueue.length ? [...new Set(preview.data.normalQueue.map((item) => item.playlistId))].map((id) => playlistNames.get(id) ?? "Unknown playlist").join(" → ") : "No content at this time"}</Text>}</Stack></Paper>
  </Stack></Paper>;
};
