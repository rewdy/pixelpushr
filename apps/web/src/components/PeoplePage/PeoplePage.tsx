import {
  Alert,
  Badge,
  Button,
  CopyButton,
  Group,
  Modal,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { requestJson } from "../../helpers/api";

type Member = {
  id: string;
  email: string;
  name: string | null;
  role: "owner" | "admin";
  joinedAt: string;
};
type Invitation = {
  id: string;
  email: string;
  status: "pending" | "accepted" | "expired";
  expiresAt: string;
};

/** Lists administrators and lets the owner send and copy invitation links. */
export const PeoplePage = ({ role }: { role: "owner" | "admin" }) => {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [lastUrl, setLastUrl] = useState("");
  const closeInvite = () => {
    setInviteOpen(false);
    setEmail("");
    setEmailError("");
    invite.reset();
  };
  const members = useQuery({
    queryKey: ["members"],
    queryFn: () => requestJson<{ members: Member[] }>("/admin/members"),
  });
  const invitations = useQuery({
    queryKey: ["invitations"],
    queryFn: () =>
      requestJson<{ invitations: Invitation[] }>("/admin/invitations"),
    enabled: role === "owner",
  });
  const invite = useMutation({
    mutationFn: () =>
      requestJson<{ url: string }>("/admin/invitations", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    onSuccess: ({ url }) => {
      setLastUrl(url);
      closeInvite();
      void queryClient.invalidateQueries({ queryKey: ["invitations"] });
    },
  });
  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Text size="xs" c="dimmed" tt="uppercase" ff="monospace">
          Administration
        </Text>
        <Title>People & access</Title>
        <Text c="dimmed">
          Manage the people who can configure this workspace.
        </Text>
      </Stack>
      {role === "owner" && (
        <Paper withBorder p="lg">
          <Stack>
            <Title order={3}>Invite an administrator</Title>
            <Button w="fit-content" onClick={() => setInviteOpen(true)}>
              Send invitation
            </Button>
            {lastUrl && (
              <Group>
                <Text size="sm">Invitation sent.</Text>
                <CopyButton value={lastUrl}>
                  {({ copied, copy }) => (
                    <Button size="xs" variant="light" onClick={copy}>
                      {copied ? "Copied" : "Copy link"}
                    </Button>
                  )}
                </CopyButton>
              </Group>
            )}
          </Stack>
        </Paper>
      )}
      {role === "owner" && (
        <Modal
          opened={inviteOpen}
          onClose={closeInvite}
          title="Send invitation"
          centered
        >
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
                setEmailError("Enter a valid email address.");
                return;
              }
              setEmailError("");
              invite.mutate();
            }}
          >
            <Stack>
              <TextInput
                label="Email address"
                type="email"
                placeholder="admin@example.com"
                value={email}
                error={emailError}
                onChange={(event) => {
                  setEmail(event.currentTarget.value);
                  setEmailError("");
                }}
                autoFocus
              />
              {invite.error && (
                <Alert color="red">{invite.error.message}</Alert>
              )}
              <Group justify="flex-end">
                <Button variant="subtle" onClick={closeInvite}>
                  Cancel
                </Button>
                <Button type="submit" loading={invite.isPending}>
                  Send invitation
                </Button>
              </Group>
            </Stack>
          </form>
        </Modal>
      )}
      <Paper withBorder p="lg">
        <Stack>
          <Title order={3}>Administrators</Title>
          {members.error && <Alert color="red">{members.error.message}</Alert>}
          <Table.ScrollContainer minWidth={480}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Email</Table.Th>
                  <Table.Th>Role</Table.Th>
                  <Table.Th>Joined</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {members.data?.members.map((member) => (
                  <Table.Tr key={member.id}>
                    <Table.Td>{member.email}</Table.Td>
                    <Table.Td>
                      <Badge
                        color={member.role === "owner" ? "brand" : "gray"}
                        variant="light"
                      >
                        {member.role}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {new Date(member.joinedAt).toLocaleDateString()}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Stack>
      </Paper>
      {role === "owner" && (
        <Paper withBorder p="lg">
          <Stack>
            <Title order={3}>Invitations</Title>
            {invitations.error && (
              <Alert color="red">{invitations.error.message}</Alert>
            )}
            <Table.ScrollContainer minWidth={480}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Email</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Expires</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {invitations.data?.invitations.map((invitation) => (
                    <Table.Tr key={invitation.id}>
                      <Table.Td>{invitation.email}</Table.Td>
                      <Table.Td>
                        <Badge
                          variant="light"
                          color={
                            invitation.status === "accepted"
                              ? "signal"
                              : invitation.status === "expired"
                                ? "gray"
                                : "brand"
                          }
                        >
                          {invitation.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {new Date(invitation.expiresAt).toLocaleDateString()}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
};
