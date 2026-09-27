import {
  Alert,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { requestJson } from "../../helpers/api";
import type { Playlist } from "../../models/media.models";

type Props = { displayId: string; timezone: string; playlists: Playlist[] };
type ManifestPreview = { normalQueue: { playlistId: string }[] };

/** Shows the server-resolved normal queue at a chosen local time. */
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
          Choose a time in {timezone} to see which playlists will cycle.
        </Text>
        <Group align="end">
          <TextInput
            label="Preview at"
            type="datetime-local"
            value={local}
            onChange={(event) => setLocal(event.currentTarget.value)}
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
            {preview.data.normalQueue.length
              ? [
                  ...new Set(
                    preview.data.normalQueue.map((item) => item.playlistId),
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
