import {
  Alert,
  Button,
  Checkbox,
  Drawer,
  Group,
  NumberInput,
  Radio,
  Select,
  Stack,
  Text,
} from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { requestJson } from "../../helpers/api";
import type { Playlist } from "../../models/media.models";
import type { Assignment } from "./assignment.models";
import { LocalDateTimePicker } from "./LocalDateTimePicker";
import {
  emptyRecurrence,
  RecurrenceFields,
  recurrencePayload,
} from "./RecurrenceFields";

type Props = {
  opened: boolean;
  onClose: () => void;
  onSaved: () => void;
  displayId: string;
  playlists: Playlist[];
  timezone: string;
  assignments: Assignment[];
};

/** Adds one playlist with only the controls needed by its assignment mode. */
export const AddPlaylistDrawer = ({
  opened,
  onClose,
  onSaved,
  displayId,
  playlists,
  timezone,
  assignments,
}: Props) => {
  const [playlistId, setPlaylistId] = useState<string | null>(null);
  const [timing, setTiming] = useState("always");
  const [behavior, setBehavior] = useState("append");
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [recurrence, setRecurrence] = useState(emptyRecurrence);
  const [activateNow, setActivateNow] = useState(false);
  const [priority, setPriority] = useState<number | string>(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const scheduled = timing === "scheduled";
  const override = scheduled && behavior === "override";
  const create = useMutation({
    mutationFn: async () => {
      if (!playlistId) throw new Error("Choose a playlist.");
      if (timing === "always") {
        // PUT replaces the queue, so read it immediately before appending.
        const latest = await requestJson<{ assignments: Assignment[] }>(
          `/admin/displays/${displayId}/assignments`,
        );
        const ids = latest.assignments
          .filter((item) => item.mode === "always")
          .sort((a, b) => a.position - b.position)
          .map((item) => item.playlistId);
        if (ids.includes(playlistId))
          throw new Error(
            "This playlist is already always-on for this display.",
          );
        return requestJson(`/admin/displays/${displayId}/always`, {
          method: "PUT",
          body: JSON.stringify({ playlistIds: [...ids, playlistId] }),
        });
      }
      if (!endLocal) throw new Error("Enter an end time.");
      if (!override) {
        if (!startLocal) throw new Error("Enter a start time.");
        if (endLocal <= startLocal)
          throw new Error("Schedule end must be after start.");
        return requestJson(`/admin/displays/${displayId}/schedules`, {
          method: "POST",
          body: JSON.stringify({
            playlistId,
            startLocal,
            endLocal,
            ...recurrencePayload(recurrence, startLocal),
            position: assignments.filter((item) => item.mode === "scheduled")
              .length,
          }),
        });
      }
      if (!activateNow && !startLocal) throw new Error("Enter a start time.");
      if (!activateNow && endLocal <= startLocal)
        throw new Error("Override expiration must be after its start.");
      if (
        !Number.isInteger(Number(priority)) ||
        Number(priority) < 0 ||
        Number(priority) > 1000
      )
        throw new Error("Priority must be between 0 and 1000.");
      return requestJson(`/admin/displays/${displayId}/overrides`, {
        method: "POST",
        body: JSON.stringify({
          playlistId,
          activateNow,
          startLocal: activateNow ? undefined : startLocal,
          endLocal,
          priority: Number(priority),
          ...recurrencePayload(recurrence, startLocal),
        }),
      });
    },
    onSuccess: () => {
      setValidationError(null);
      setPlaylistId(null);
      setTiming("always");
      setBehavior("append");
      setStartLocal("");
      setEndLocal("");
      setRecurrence(emptyRecurrence());
      setActivateNow(false);
      setPriority(0);
      onSaved();
      onClose();
    },
    onError: (error) => setValidationError(error.message),
  });

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title="Add playlist"
      position="right"
      size="md"
    >
      <Stack gap="lg">
        <Select
          label="Playlist"
          placeholder="Choose a playlist"
          data={playlists.map((playlist) => ({
            value: playlist.id,
            label: playlist.name,
          }))}
          value={playlistId}
          onChange={setPlaylistId}
          searchable
          required
        />
        <Radio.Group
          label="Timing"
          value={timing}
          onChange={(value) => {
            setTiming(value);
            setValidationError(null);
          }}
        >
          <Group mt="xs">
            <Radio value="always" label="Always-on" />
            <Radio value="scheduled" label="Scheduled" />
          </Group>
        </Radio.Group>
        {scheduled && (
          <>
            <Radio.Group
              label="Behavior"
              value={behavior}
              onChange={(value) => {
                setBehavior(value);
                setValidationError(null);
              }}
            >
              <Group mt="xs">
                <Radio value="append" label="Append" />
                <Radio value="override" label="Override" />
              </Group>
            </Radio.Group>
            <Text size="sm" c="dimmed">
              Times use {timezone}.
            </Text>
            {override && (
              <Checkbox
                label="Activate now"
                checked={activateNow}
                disabled={recurrence.recurrence !== "none"}
                onChange={(event) =>
                  setActivateNow(event.currentTarget.checked)
                }
              />
            )}
            {(!override || !activateNow) && (
              <LocalDateTimePicker
                label="Start"
                value={startLocal}
                onChange={setStartLocal}
                required
              />
            )}
            <LocalDateTimePicker
              label={override ? "Expiration" : "End"}
              value={endLocal}
              onChange={setEndLocal}
              required
            />
            {override && (
              <NumberInput
                label="Priority"
                description="Larger numbers supersede smaller ones."
                min={0}
                max={1000}
                value={priority}
                onChange={setPriority}
                w={136}
              />
            )}
            <RecurrenceFields
              value={recurrence}
              firstDate={startLocal}
              onChange={(value) => {
                setRecurrence(value);
                if (value.recurrence !== "none") setActivateNow(false);
              }}
            />
          </>
        )}
        {validationError && <Alert color="red">{validationError}</Alert>}
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={create.isPending} onClick={() => create.mutate()}>
            Add playlist
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
};
