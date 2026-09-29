import {
  Alert,
  Button,
  Drawer,
  Group,
  NumberInput,
  Stack,
  Text,
} from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { requestJson } from "../../helpers/api";
import type { Assignment } from "./assignment.models";
import {
  assignmentEditPayload,
  savedLocalDateTime,
} from "./assignmentEditPayload";
import { LocalDateTimePicker } from "./LocalDateTimePicker";
import { type RecurrenceDraft, RecurrenceFields } from "./RecurrenceFields";

type Props = {
  assignment: Assignment | null;
  displayId: string;
  onClose: () => void;
  onSaved: () => void;
};

const draftFromAssignment = (assignment: Assignment): RecurrenceDraft => {
  const schedule = assignment.schedule;
  if (!schedule) throw new Error("Scheduled assignment is required");
  return {
    recurrence: schedule.recurrence,
    repeatInterval: schedule.repeatInterval ?? 1,
    weekdays: (schedule.weekdays ?? []).map(String),
    monthlyPattern: schedule.monthDay !== null ? "date" : "weekday",
    monthDay: schedule.monthDay ?? 1,
    monthOrdinal: String(schedule.monthOrdinal ?? 1),
    monthWeekday: String(schedule.monthWeekday ?? 1),
    lastOccurrenceDate: schedule.lastOccurrenceDate ?? "",
  };
};

/** Edits only settings; the assigned playlist and Append/Override mode stay fixed. */
export const EditAssignmentDrawer = ({
  assignment,
  displayId,
  onClose,
  onSaved,
}: Props) => {
  if (!assignment?.schedule || !assignment.version) return null;
  return (
    <EditAssignmentForm
      key={`${assignment.id}:${assignment.version}`}
      assignment={assignment}
      displayId={displayId}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
};

const EditAssignmentForm = ({
  assignment,
  displayId,
  onClose,
  onSaved,
}: Props & { assignment: Assignment }) => {
  const schedule = assignment.schedule;
  if (!schedule || !assignment.version)
    throw new Error("Scheduled assignment is required");
  const [startLocal, setStartLocal] = useState(() =>
    savedLocalDateTime(schedule.startAt, schedule.timezone),
  );
  const [endLocal, setEndLocal] = useState(() =>
    savedLocalDateTime(schedule.endAt, schedule.timezone),
  );
  const [recurrence, setRecurrence] = useState(() =>
    draftFromAssignment(assignment),
  );
  const [priority, setPriority] = useState<number | string>(
    assignment.priority,
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const original = JSON.stringify([
    savedLocalDateTime(schedule.startAt, schedule.timezone),
    savedLocalDateTime(schedule.endAt, schedule.timezone),
    draftFromAssignment(assignment),
    assignment.priority,
  ]);
  const unchanged =
    JSON.stringify([startLocal, endLocal, recurrence, priority]) === original;
  const save = useMutation({
    mutationFn: async () => {
      if (!startLocal || !endLocal || endLocal <= startLocal)
        throw new Error("End must be after start.");
      if (
        !Number.isInteger(Number(priority)) ||
        Number(priority) < 0 ||
        Number(priority) > 1000
      )
        throw new Error("Priority must be between 0 and 1000.");
      const body = assignmentEditPayload(
        assignment,
        startLocal,
        endLocal,
        recurrence,
        Number(priority),
      );
      return requestJson(
        `/admin/displays/${displayId}/assignments/${assignment.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(body),
        },
      );
    },
    onSuccess: () => {
      setValidationError(null);
      onSaved();
      onClose();
    },
    onError: (error) => setValidationError(error.message),
  });
  return (
    <Drawer
      opened
      onClose={onClose}
      title={`Edit ${assignment.playlistName} settings`}
      position="right"
      size="md"
    >
      <Stack gap="lg">
        <Text size="sm" c="dimmed">
          {assignment.mode === "override" ? "Override" : "Append"} ·{" "}
          {assignment.playlistName}. Times use the saved timezone:{" "}
          {schedule.timezone}.
        </Text>
        <LocalDateTimePicker
          label="Start"
          value={startLocal}
          onChange={setStartLocal}
          required
        />
        <LocalDateTimePicker
          label="End"
          value={endLocal}
          onChange={setEndLocal}
          required
        />
        {assignment.mode === "override" && (
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
          onChange={setRecurrence}
        />
        {validationError && <Alert color="red">{validationError}</Alert>}
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={save.isPending}
            disabled={unchanged}
            onClick={() => save.mutate()}
          >
            Save settings
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
};
