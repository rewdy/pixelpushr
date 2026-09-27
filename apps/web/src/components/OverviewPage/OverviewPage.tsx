import {
  Alert,
  Badge,
  Button,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import type { PlayerManifest } from "@pixelpushr/contracts/manifest";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { requestJson } from "../../helpers/api";
import {
  CompactPlaybackPreview,
  type PreviewItem,
} from "../CompactPlaybackPreview/CompactPlaybackPreview";
import type { Display } from "../DisplaysPage/assignment.models";

const MAX_MANIFEST_REQUESTS = 4;
let inFlight = 0;
const waiters: Array<() => void> = [];

const withManifestSlot = async <T,>(load: () => Promise<T>): Promise<T> => {
  if (inFlight >= MAX_MANIFEST_REQUESTS)
    await new Promise<void>((resolve) => waiters.push(resolve));
  inFlight += 1;
  try {
    return await load();
  } finally {
    inFlight -= 1;
    waiters.shift()?.();
  }
};

const manifestPath = (playerUrl: string) => {
  const path = new URL(playerUrl, window.location.origin).pathname;
  if (!/^\/player\/[^/]+$/.test(path)) throw new Error("Invalid player URL");
  return `${path}/manifest`;
};

const previewItems = (manifest: PlayerManifest): PreviewItem[] =>
  manifest.activeQueue.map((item, index) => ({
    id: item.id,
    name: `${item.kind === "image" ? "Image" : "Video"} ${index + 1}`,
    kind: item.kind,
    url: item.url,
    imageDurationMs: item.imageDurationMs,
    videoMode: item.videoMode,
    repeatDurationMs: item.repeatDurationMs,
  }));

/** Simulates one display from its public manifest without heartbeating the device. */
export const DisplaySimulationCard = ({ display }: { display: Display }) => {
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(
    () => document.visibilityState === "visible",
  );
  const [node, setNode] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => setInView(!!entries[0]?.isIntersecting),
      { rootMargin: "150px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  const active = inView && pageVisible;
  const manifest = useQuery({
    queryKey: ["display-simulation", display.id],
    queryFn: () =>
      withManifestSlot(() =>
        requestJson<PlayerManifest>(manifestPath(display.playerUrl)),
      ),
    enabled: active,
    retry: false,
    refetchInterval: active ? 30_000 : false,
  });
  useEffect(() => {
    if (!active || !manifest.data) return;
    const serverOffsetMs = Date.parse(manifest.data.serverTime) - Date.now();
    const next = manifest.data.transitions
      .map((transition) => Date.parse(transition.at))
      .filter((at) => Number.isFinite(at) && at > Date.now() + serverOffsetMs)
      .sort((a, b) => a - b)[0];
    if (!next) return;
    const delay = Math.max(
      0,
      Math.min(2_147_483_647, next - Date.now() - serverOffsetMs + 50),
    );
    const timer = window.setTimeout(() => void manifest.refetch(), delay);
    return () => window.clearTimeout(timer);
  }, [active, manifest.data, manifest.refetch]);
  const items = useMemo(
    () => (manifest.data ? previewItems(manifest.data) : []),
    [manifest.data],
  );
  const structureKey = manifest.data
    ? `${manifest.data.version}:${manifest.data.override?.assignmentId ?? "normal"}:${manifest.data.activeQueue.map((item) => item.id).join("|")}`
    : "empty";
  return (
    <Paper
      withBorder
      p="md"
      ref={setNode}
      data-testid={`display-card-${display.id}`}
      data-simulation-mode={manifest.data?.override ? "override" : "normal"}
    >
      <Stack gap="sm">
        <Group justify="space-between" align="start">
          <Stack gap={3}>
            <Text fw={700}>{display.name}</Text>
            <Badge size="xs" variant="light" color="brand">
              Simulated preview
            </Badge>
          </Stack>
          <Button
            component={Link}
            href={`/displays/${display.id}`}
            size="xs"
            variant="light"
          >
            Manage display
          </Button>
        </Group>
        {manifest.isError ? (
          <Alert color="red">
            Preview unavailable. Device status is shown separately below.
          </Alert>
        ) : !active ? (
          <Text size="sm" c="dimmed">
            Preview paused while offscreen.
          </Text>
        ) : manifest.isPending ? (
          <Text size="sm" c="dimmed">
            Loading preview…
          </Text>
        ) : items.length === 0 ? (
          <Text size="sm" c="dimmed">
            No playable items right now.
          </Text>
        ) : (
          <CompactPlaybackPreview
            items={items}
            structureKey={structureKey}
            videoPresentation="still"
          />
        )}
        <Text size="xs" c="dimmed">
          Local simulation · not synchronized with the device
        </Text>
        <Text size="xs" c="dimmed">
          Device last seen:{" "}
          {display.lastSeenAt
            ? new Date(display.lastSeenAt).toLocaleString()
            : "Never"}
        </Text>
        <Text size="xs" c="dimmed">
          Device-reported health: {display.lastHealth ?? "Unknown"}
        </Text>
      </Stack>
    </Paper>
  );
};

/** Shows a local simulation for each registered display. */
export const OverviewPage = () => {
  const displays = useQuery({
    queryKey: ["displays"],
    queryFn: () => requestJson<{ displays: Display[] }>("/admin/displays"),
    refetchInterval: 30_000,
  });
  return (
    <Container fluid>
      <Stack gap="xl">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" ff="monospace">
            Workspace
          </Text>
          <Title>Overview</Title>
          <Text c="dimmed">
            See what each display is configured to show. Previews run locally
            and are not device playback.
          </Text>
        </Stack>
        {displays.error && <Alert color="red">{displays.error.message}</Alert>}
        {displays.data?.displays.length === 0 && (
          <Paper withBorder p="xl">
            <Text c="dimmed">
              No displays yet. Register one on the Displays page.
            </Text>
          </Paper>
        )}
        <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing="lg">
          {displays.data?.displays.map((display) => (
            <DisplaySimulationCard key={display.id} display={display} />
          ))}
        </SimpleGrid>
      </Stack>
    </Container>
  );
};
