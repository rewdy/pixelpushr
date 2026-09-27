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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LuPlus } from "react-icons/lu";
import { Link, useLocation } from "wouter";
import { requestJson } from "../../helpers/api";
import type { Playlist } from "../../models/media.models";

/** Lists playlists and creates a new ordered content collection. */
export const PlaylistsPage = () => {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const playlists = useQuery({
    queryKey: ["playlists"],
    queryFn: () => requestJson<{ playlists: Playlist[] }>("/admin/playlists"),
  });
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
        {playlists.data?.playlists.length === 0 && (
          <Text c="dimmed" ta="center" py="xl">
            No playlists yet.
          </Text>
        )}
        {playlists.error && (
          <Alert color="red">{playlists.error.message}</Alert>
        )}
      </Paper>
    </Stack>
  );
};
