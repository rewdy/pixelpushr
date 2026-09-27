import {
  Alert,
  Badge,
  Button,
  FileButton,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LuUpload } from "react-icons/lu";
import { requestJson } from "../../helpers/api";
import { useMediaUploadQueue } from "../../hooks/useMediaUploadQueue";
import type { MediaAsset } from "../../models/media.models";
import { MediaThumbnail } from "../MediaThumbnail/MediaThumbnail";
import classes from "./MediaPage.module.css";

/** Accepts image/video batches from the picker or a page-wide drop target. */
export const MediaPage = () => {
  const assets = useQuery({
    queryKey: ["media"],
    queryFn: () => requestJson<{ assets: MediaAsset[] }>("/admin/media"),
  });
  const { entries, enqueue } = useMediaUploadQueue();
  const [draggingFiles, setDraggingFiles] = useState(false);

  useEffect(() => {
    const hasFiles = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes("Files");
    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      setDraggingFiles(true);
    };
    const onDragOver = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault();
    };
    const onDragLeave = (event: DragEvent) => {
      if (!event.relatedTarget) setDraggingFiles(false);
    };
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      setDraggingFiles(false);
      enqueue(Array.from(event.dataTransfer?.files ?? []));
    };
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [enqueue]);
  return (
    <Stack gap="xl">
      <Group justify="space-between" align="end">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" ff="monospace">
            Library
          </Text>
          <Title>Media library</Title>
          <Text c="dimmed">
            Choose several images or videos, or drop them anywhere on this page.
          </Text>
        </Stack>
        <FileButton
          multiple
          onChange={(files) => enqueue(files ?? [])}
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
        >
          {(props) => (
            <Button {...props} leftSection={<LuUpload size={16} />}>
              Upload media
            </Button>
          )}
        </FileButton>
      </Group>
      {entries.length > 0 && (
        <Paper withBorder p="lg">
          <Stack gap="sm">
            <Text fw={600}>Upload queue</Text>
            {entries.map((entry) => (
              <Group
                key={entry.id}
                data-testid="upload-entry"
                justify="space-between"
                align="start"
                gap="sm"
              >
                <Stack gap={0}>
                  <Text size="sm">{entry.name}</Text>
                  {entry.error && (
                    <Text size="xs" c="red">
                      {entry.error}
                    </Text>
                  )}
                </Stack>
                <Badge
                  variant="light"
                  color={
                    entry.status === "ready"
                      ? "signal"
                      : entry.status === "failed"
                        ? "red"
                        : "gray"
                  }
                >
                  {entry.status}
                </Badge>
              </Group>
            ))}
          </Stack>
        </Paper>
      )}
      {entries.some((entry) => entry.status === "ready") && (
        <Alert color="signal">Media is ready for playlists.</Alert>
      )}
      <Paper withBorder p="lg">
        <Table.ScrollContainer minWidth={560}>
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Asset</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Size</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {assets.data?.assets.map((asset) => (
                <Table.Tr key={asset.id}>
                  <Table.Td>
                    <Group gap="md">
                      <MediaThumbnail asset={asset} width={48} height={36} />
                      <Stack gap={0}>
                        <Text size="sm" fw={600}>
                          {asset.name}
                        </Text>
                        {asset.failureReason && (
                          <Text size="xs" c="red">
                            {asset.failureReason}
                          </Text>
                        )}
                      </Stack>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{asset.kind}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {(asset.sizeBytes / 1024 / 1024).toFixed(1)} MB
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      variant="light"
                      color={
                        asset.status === "ready"
                          ? "signal"
                          : asset.status === "failed"
                            ? "red"
                            : "gray"
                      }
                    >
                      {asset.status}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        {assets.data?.assets.length === 0 && (
          <Text c="dimmed" ta="center" py="xl">
            No media yet. Upload an image or video to start.
          </Text>
        )}
        {assets.error && <Alert color="red">{assets.error.message}</Alert>}
      </Paper>
      {draggingFiles && (
        <div className={classes.dropOverlay} data-testid="media-drop-overlay">
          <Paper withBorder shadow="xl" p="xl" ta="center">
            <LuUpload size={32} aria-hidden="true" />
            <Title order={3}>Drop files to upload</Title>
            <Text c="dimmed">Images and videos can be uploaded together.</Text>
          </Paper>
        </div>
      )}
    </Stack>
  );
};
