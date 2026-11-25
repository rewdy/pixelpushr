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
import type {
  CreateInvitationResponse,
  Invitation,
  SendInvitationEmailResponse,
} from "@pixelpushr/contracts/invitations";
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

/** Lists administrators and lets the owner create, share, and revoke invitations. */
export const PeoplePage = ({ role }: { role: "owner" | "admin" }) => {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [lastInvitation, setLastInvitation] =
    useState<CreateInvitationResponse>();
  const [revokeTarget, setRevokeTarget] = useState<Invitation>();
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
  const sendEmail = useMutation({
    mutationFn: (url: string) =>
      requestJson<SendInvitationEmailResponse>("/admin/invitations/email", {
        method: "POST",
        body: JSON.stringify({
          token: new URL(url).pathname.split("/").at(-1),
        }),
      }),
  });
  const invite = useMutation({
    mutationFn: () =>
      requestJson<CreateInvitationResponse>("/admin/invitations", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    onSuccess: (result) => {
      sendEmail.reset();
      setLastInvitation(result);
      closeInvite();
      void queryClient.invalidateQueries({ queryKey: ["invitations"] });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) =>
      requestJson<{ revoked: true }>(`/admin/invitations/${id}`, {
        method: "DELETE",
      }),
    onSuccess: (_result, id) => {
      if (lastInvitation?.invitation.id === id) {
        setLastInvitation(undefined);
        sendEmail.reset();
      }
      setRevokeTarget(undefined);
    },
    onSettled: () => {
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
              Create invitation
            </Button>
            {lastInvitation && (
              <Stack gap="xs">
                <Text size="sm" role="status">
                  Invitation created for {lastInvitation.invitation.email}.
                  {sendEmail.data?.emailStatus === "submitted" &&
                    " Email submitted."}
                  {sendEmail.data?.emailStatus === "unconfirmed" &&
                    " Couldn’t confirm email. Share the link directly."}
                </Text>
                <TextInput
                  label="Invitation link"
                  value={lastInvitation.url}
                  readOnly
                />
                <Group gap="xs">
                  <CopyButton
                    key={lastInvitation.invitation.id}
                    value={lastInvitation.url}
                  >
                    {({ copied, copy }) => (
                      <Button size="xs" variant="light" onClick={copy}>
                        {copied ? "Copied" : "Copy link"}
                      </Button>
                    )}
                  </CopyButton>
                  <Button
                    size="xs"
                    variant="default"
                    loading={sendEmail.isPending}
                    disabled={sendEmail.data?.emailStatus === "submitted"}
                    onClick={() => sendEmail.mutate(lastInvitation.url)}
                  >
                    Send email
                  </Button>
                </Group>
                {sendEmail.error && (
                  <Alert color="red">{sendEmail.error.message}</Alert>
                )}
                <Text size="xs" c="dimmed">
                  Copy the link before leaving this page.
                </Text>
              </Stack>
            )}
          </Stack>
        </Paper>
      )}
      {role === "owner" && (
        <Modal
          opened={inviteOpen}
          onClose={closeInvite}
          title="Create invitation"
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
                  Create invitation
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
            {invitations.isSuccess &&
              !invitations.data.invitations.some(
                (invitation) => invitation.status === "pending",
              ) && (
                <Text size="sm" c="dimmed">
                  No invitations pending.
                </Text>
              )}
            {Boolean(invitations.data?.invitations.length) && (
              <Table.ScrollContainer minWidth={480}>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Email</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Expires</Table.Th>
                      <Table.Th>Actions</Table.Th>
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
                        <Table.Td>
                          {invitation.status === "pending" && (
                            <Button
                              size="xs"
                              variant="subtle"
                              color="red"
                              aria-label={`Revoke invitation for ${invitation.email}`}
                              onClick={() => {
                                revoke.reset();
                                setRevokeTarget(invitation);
                              }}
                            >
                              Revoke
                            </Button>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </Stack>
        </Paper>
      )}
      {role === "owner" && (
        <Modal
          opened={Boolean(revokeTarget)}
          title="Revoke invitation"
          centered
          onClose={() => setRevokeTarget(undefined)}
          closeOnClickOutside={!revoke.isPending}
          closeOnEscape={!revoke.isPending}
          withCloseButton={!revoke.isPending}
        >
          {revokeTarget && (
            <Stack>
              <Text size="sm">
                Revoke the invitation for {revokeTarget.email}? Its link will
                stop working. You can create a new invitation for this address.
              </Text>
              {revoke.error && (
                <Alert color="red">{revoke.error.message}</Alert>
              )}
              <Group justify="flex-end">
                <Button
                  variant="subtle"
                  disabled={revoke.isPending}
                  onClick={() => setRevokeTarget(undefined)}
                >
                  Cancel
                </Button>
                <Button
                  color="red"
                  loading={revoke.isPending}
                  onClick={() => revoke.mutate(revokeTarget.id)}
                >
                  Revoke invitation
                </Button>
              </Group>
            </Stack>
          )}
        </Modal>
      )}
    </Stack>
  );
};
