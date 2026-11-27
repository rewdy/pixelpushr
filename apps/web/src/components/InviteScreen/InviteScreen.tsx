import {
  Alert,
  Anchor,
  Button,
  Container,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "wouter";
import {
  RequestError,
  requestJson,
  resetSessionState,
} from "../../helpers/api";
import {
  loginDestination,
  rememberInvite,
} from "../../helpers/sessionNavigation";

/** Lets an invited user claim administrator access after authenticating. */
export const InviteScreen = () => {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const path = `/invite/${token}`;
  const queryClient = useQueryClient();
  const session = useQuery({
    queryKey: ["auth-session"],
    queryFn: ({ signal }) => requestJson("/auth/session", { signal }),
    retry: false,
  });
  const signOut = useMutation({
    mutationFn: () => requestJson("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      resetSessionState();
      queryClient.clear();
      navigate(loginDestination(path), { replace: true });
    },
  });
  const accept = useMutation({
    mutationFn: () =>
      requestJson("/invitations/accept", {
        method: "POST",
        body: JSON.stringify({ token }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate("/");
    },
  });
  return (
    <Container size={450} py={80}>
      <Paper withBorder p="xl">
        <Stack>
          <Title order={2}>Accept invitation</Title>
          <Text c="dimmed">
            Join this pixelpushr workspace as an administrator.
          </Text>
          {session.isPending ? (
            <Loader size="sm" />
          ) : session.error &&
            !(
              session.error instanceof RequestError &&
              session.error.status === 401
            ) ? (
            <>
              <Alert color="red">{session.error.message}</Alert>
              <Button onClick={() => void session.refetch()}>Try again</Button>
            </>
          ) : !session.data ? (
            <>
              <Anchor
                component={Link}
                href="/login?next=invite"
                onClick={() => rememberInvite(path)}
              >
                Sign in to accept
              </Anchor>
              <Anchor
                component={Link}
                href="/register?next=invite"
                onClick={() => rememberInvite(path)}
              >
                Create an account
              </Anchor>
            </>
          ) : (
            <>
              {accept.error && (
                <Alert color="red">{accept.error.message}</Alert>
              )}
              <Button
                loading={accept.isPending}
                onClick={() => accept.mutate()}
              >
                Accept invitation
              </Button>
              <Button
                variant="subtle"
                loading={signOut.isPending}
                onClick={() => signOut.mutate()}
              >
                Switch accounts
              </Button>
              {signOut.error && (
                <Alert color="red">{signOut.error.message}</Alert>
              )}
            </>
          )}
        </Stack>
      </Paper>
    </Container>
  );
};
