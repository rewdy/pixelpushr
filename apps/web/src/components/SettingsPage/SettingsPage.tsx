import {
  Alert,
  Button,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { requestJson } from "../../helpers/api";

/** Edits the single organization's display name and schedule timezone. */
export const SettingsPage = ({
  name,
  timezone,
  role,
}: {
  name: string;
  timezone: string;
  role: "owner" | "admin";
}) => {
  const queryClient = useQueryClient();
  const [draftName, setDraftName] = useState(name);
  const [draftTimezone, setDraftTimezone] = useState(timezone);
  const save = useMutation({
    mutationFn: () =>
      requestJson("/admin/organization", {
        method: "PATCH",
        body: JSON.stringify({ name: draftName, timezone: draftTimezone }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Text size="xs" c="dimmed" tt="uppercase" ff="monospace">
          Administration
        </Text>
        <Title>Workspace settings</Title>
      </Stack>
      <Paper withBorder p="lg" maw={600}>
        <Stack>
          <TextInput
            label="Organization name"
            value={draftName}
            onChange={(event) => setDraftName(event.currentTarget.value)}
            disabled={role !== "owner"}
          />
          <TextInput
            label="Timezone"
            description="IANA timezone used for schedules"
            value={draftTimezone}
            onChange={(event) => setDraftTimezone(event.currentTarget.value)}
            disabled={role !== "owner"}
          />
          {save.error && <Alert color="red">{save.error.message}</Alert>}
          {save.isSuccess && <Alert color="signal">Settings saved.</Alert>}
          {role === "owner" && (
            <Button
              style={{ alignSelf: "flex-start" }}
              loading={save.isPending}
              onClick={() => save.mutate()}
            >
              Save changes
            </Button>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
};
