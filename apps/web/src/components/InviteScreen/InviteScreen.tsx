import { Alert, Anchor, Button, Container, Paper, Stack, Text, Title } from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "wouter";
import { getToken, requestJson } from "../../helpers/api";

/** Lets an invited user claim administrator access after authenticating. */
export const InviteScreen = () => {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const path = `/invite/${token}`;
  const accept = useMutation({ mutationFn: () => requestJson("/invitations/accept", { method: "POST", body: JSON.stringify({ token }) }), onSuccess: () => navigate("/") });
  return <Container size={450} py={80}><Paper withBorder p="xl"><Stack><Title order={2}>Accept invitation</Title><Text c="dimmed">Join this pixelpushr workspace as an administrator.</Text>{!getToken() ? <><Anchor component={Link} href={`/login?next=${encodeURIComponent(path)}`}>Sign in to accept</Anchor><Anchor component={Link} href={`/register?next=${encodeURIComponent(path)}`}>Create an account</Anchor></> : <>{accept.error && <Alert color="red">{accept.error.message}</Alert>}<Button loading={accept.isPending} onClick={() => accept.mutate()}>Accept invitation</Button></>}</Stack></Paper></Container>;
};
