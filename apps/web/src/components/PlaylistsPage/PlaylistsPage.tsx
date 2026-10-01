import {
  Alert,
  Button,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import type { PagedList } from "@pixelpushr/contracts/pagination";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LuPlus } from "react-icons/lu";
import { Link, useLocation } from "wouter";
import { requestJson } from "../../helpers/api";
import { useListingPage } from "../../hooks/useListingPage";
import type { Playlist } from "../../models/media.models";
import { PageControls } from "../PageControls";

/** Lists playlists and creates a new ordered content collection. */
export const PlaylistsPage = () => {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { page, setPage } = useListingPage();
  const pageSize = 25;
  const [name, setName] = useState("");
  const playlists = useQuery({
    queryKey: ["playlists", "list", page],
    queryFn: () =>
      requestJson<PagedList<"playlists", Playlist>>(
        `/admin/playlists?page=${page}&pageSize=${pageSize}`,
      ),
  });
  useEffect(() => {
    if (!playlists.data) return;
    const lastPage = Math.max(1, Math.ceil(playlists.data.total / pageSize));
    if (page > lastPage) setPage(lastPage);
  }, [playlists.data, page, setPage]);
  const create = useMutation({
    mutationFn: () =>
      requestJson<{ playlist: Playlist }>("/admin/playlists", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: ({ playlist }) => {
      void queryClient.invalidateQueries({ queryKey: ["playlists"] });
      navigate(`/playlists/${playlist.id}`);
    },
  });
  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Text size="xs" c="dimmed" tt="uppercase" ff="monospace">
          Content
        </Text>
        <Title>Playlists</Title>
        <Text c="dimmed">
          Arrange ready media in the order each display should play it.
        </Text>
      </Stack>
      <Paper withBorder p="lg">
        <Group align="end">
          <TextInput
            label="New playlist"
            placeholder="Brand loop"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Button
            leftSection={<LuPlus size={16} />}
            loading={create.isPending}
            onClick={() => create.mutate()}
          >
            Create playlist
          </Button>
        </Group>
        {create.error && (
          <Alert color="red" mt="md">
            {create.error.message}
          </Alert>
        )}
      </Paper>
      <Paper withBorder p="lg">
        <Table.ScrollContainer minWidth={450}>
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Updated</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {playlists.data?.playlists.map((playlist) => (
                <Table.Tr key={playlist.id}>
                  <Table.Td>
                    <Text fw={600}>{playlist.name}</Text>
                  </Table.Td>
                  <Table.Td>
                    {new Date(playlist.updatedAt).toLocaleDateString()}
                  </Table.Td>
                  <Table.Td>
                    <Button
                      component={Link}
                      href={`/playlists/${playlist.id}`}
                      size="xs"
                      variant="light"
                    >
                      Edit
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        {playlists.isPending && (
          <Text c="dimmed" ta="center" py="xl">
            Loading playlists…
          </Text>
        )}
        {!playlists.isPending &&
          !playlists.error &&
          playlists.data?.playlists.length === 0 && (
            <Text c="dimmed" ta="center" py="xl">
              {playlists.data.total
                ? "No playlists on this page."
                : "No playlists yet."}
            </Text>
          )}
        {playlists.error && (
          <Alert color="red">{playlists.error.message}</Alert>
        )}
        {playlists.data && (
          <PageControls
            page={page}
            pageSize={pageSize}
            total={playlists.data.total}
            onPageChange={setPage}
          />
        )}
      </Paper>
    </Stack>
  );
};
