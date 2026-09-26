import { Alert, Badge, Button, FileButton, Group, Image, Paper, Stack, Table, Text, Title } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LuUpload } from "react-icons/lu";
import { readMediaPreview } from "../../helpers/mediaPreview";
import { requestJson } from "../../helpers/api";
import type { MediaAsset } from "../../models/media.models";

/** Uploads image/video assets and displays their processing state. */
export const MediaPage = () => {
  const queryClient = useQueryClient();
  const assets = useQuery({ queryKey: ["media"], queryFn: () => requestJson<{ assets: MediaAsset[] }>("/admin/media") });
  const upload = useMutation({ mutationFn: async (file: File) => {
    const created = await requestJson<{ asset: MediaAsset; uploadUrl: string | null }>("/admin/media/uploads", { method: "POST", body: JSON.stringify({ name: file.name, mimeType: file.type || "application/octet-stream", sizeBytes: file.size }) });
    if (!created.uploadUrl) throw new Error(created.asset.failureReason ?? "Unsupported file");
    const response = await fetch(created.uploadUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
    if (!response.ok) throw new Error(`Upload failed (${response.status})`);
    let preview: { width?: number; height?: number; durationMs?: number } = {};
    try { preview = await readMediaPreview(file); }
    catch (error) { if (file.type.startsWith("video/")) { await requestJson(`/admin/media/${created.asset.id}/complete`, { method: "POST", body: "{}" }); throw error; } }
    const completed = await requestJson<{ asset: MediaAsset }>(`/admin/media/${created.asset.id}/complete`, { method: "POST", body: JSON.stringify(preview) });
    if (completed.asset.status !== "ready") throw new Error(completed.asset.failureReason ?? "Media could not be processed");
  }, onSettled: () => { void queryClient.invalidateQueries({ queryKey: ["media"] }); } });
  return <Stack gap="xl"><Group justify="space-between" align="end"><Stack gap={4}><Text size="xs" c="dimmed" tt="uppercase" ff="monospace">Library</Text><Title>Media library</Title><Text c="dimmed">Upload the images and videos you want to show.</Text></Stack><FileButton onChange={(file) => { if (file) upload.mutate(file); }} accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm">{(props) => <Button {...props} leftSection={<LuUpload size={16} />} loading={upload.isPending}>Upload media</Button>}</FileButton></Group>{upload.error && <Alert color="red">{upload.error.message}</Alert>}{upload.isSuccess && <Alert color="signal">Media is ready for playlists.</Alert>}<Paper withBorder p="lg"><Table.ScrollContainer minWidth={560}><Table highlightOnHover><Table.Thead><Table.Tr><Table.Th>Asset</Table.Th><Table.Th>Type</Table.Th><Table.Th>Size</Table.Th><Table.Th>Status</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{assets.data?.assets.map((asset) => <Table.Tr key={asset.id}><Table.Td><Group gap="md">{asset.previewUrl ? <Image src={asset.previewUrl} alt="" w={48} h={36} fit="cover" radius="sm" /> : null}<Stack gap={0}><Text size="sm" fw={600}>{asset.name}</Text>{asset.failureReason && <Text size="xs" c="red">{asset.failureReason}</Text>}</Stack></Group></Table.Td><Table.Td><Text size="sm">{asset.kind}</Text></Table.Td><Table.Td><Text size="sm">{(asset.sizeBytes / 1024 / 1024).toFixed(1)} MB</Text></Table.Td><Table.Td><Badge variant="light" color={asset.status === "ready" ? "signal" : asset.status === "failed" ? "red" : "gray"}>{asset.status}</Badge></Table.Td></Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer>{assets.data?.assets.length === 0 && <Text c="dimmed" ta="center" py="xl">No media yet. Upload an image or video to start.</Text>}{assets.error && <Alert color="red">{assets.error.message}</Alert>}</Paper></Stack>;
};
