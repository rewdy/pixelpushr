import { Alert, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { requestJson } from "../../helpers/api";
import type { Playlist } from "../../models/media.models";
import { LocalDateTimePicker } from "./LocalDateTimePicker";

type Props = { displayId: string; timezone: string; playlists: Playlist[] };
type ManifestPreview = {
  normalQueue: { playlistId: string }[];
  activeQueue: { playlistId: string }[];
  override: { assignmentId: string } | null;
};

/** Shows the server-resolved effective queue, including a winning Override. */
export const ScheduleTimePreview = ({
  displayId,
  timezone,
  playlists,
}: Props) => {
  const [local, setLocal] = useState("");
  const [at, setAt] = useState("");
  const preview = useQuery({
    queryKey: ["schedule-preview", displayId, at],
    queryFn: () =>
      requestJson<ManifestPreview>(
        `/admin/displays/${displayId}/preview?atLocal=${encodeURIComponent(at)}`,
      ),
    enabled: !!at,
  });
  const names = new Map(
    playlists.map((playlist) => [playlist.id, playlist.name]),
  );
  return (
    <Paper withBorder p="lg">
      <Stack gap="sm">
        <Title order={3}>Preview effective queue</Title>
        <Text size="sm" c="dimmed">
          Choose a time in {timezone} to see the normal queue or winning
          Override.
        </Text>
        <Group align="end">
          <LocalDateTimePicker
            label="Preview at"
            value={local}
            onChange={setLocal}
          />
          <Button
            variant="light"
            disabled={!local}
            onClick={() => setAt(local)}
          >
            Preview
          </Button>
        </Group>
        {preview.error && <Alert color="red">{preview.error.message}</Alert>}
        {preview.data && (
          <Text size="sm">
            {preview.data.override ? "Winning override: " : ""}
            {preview.data.activeQueue.length
              ? [
                  ...new Set(
                    preview.data.activeQueue.map((item) => item.playlistId),
                  ),
                ]
                  .map((id) => names.get(id) ?? "Unknown playlist")
                  .join(" → ")
              : "No content at this time"}
          </Text>
        )}
      </Stack>
    </Paper>
  );
};
