import {
  Alert,
  Anchor,
  Button,
  Container,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { requestJson, setToken } from "../../helpers/api";
import { TimezoneSelect } from "../TimezoneSelect/TimezoneSelect";

type Session = { accessToken: string };

/** Handles administrator sign-in without Cognito's hosted UI. */
export const LoginScreen = () => {
  const [, navigate] = useLocation();
  const next = new URLSearchParams(window.location.search).get("next") ?? "/";
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useMutation({
    mutationFn: () =>
      requestJson<Session>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    onSuccess: (session) => {
      setToken(session.accessToken);
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate(next.startsWith("/") && !next.startsWith("//") ? next : "/");
    },
  });
  return (
    <Container size={420} py={80}>
      <Paper withBorder p="xl">
        <Stack>
          <Title order={2}>Sign in</Title>
          <Text c="dimmed" size="sm">
            Manage your signage from one place.
          </Text>
          <TextInput
            label="Email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />
          <PasswordInput
            label="Password"
            required
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />
          {login.error && <Alert color="red">{login.error.message}</Alert>}
          <Button loading={login.isPending} onClick={() => login.mutate()}>
            Sign in
          </Button>
          <Anchor
            component={Link}
            href={`/register?next=${encodeURIComponent(next)}`}
            size="sm"
          >
            Create the first account or accept an invitation
          </Anchor>
        </Stack>
      </Paper>
    </Container>
  );
};

/** Creates an account using the app-owned registration screen. */
export const RegisterScreen = () => {
  const [, navigate] = useLocation();
  const next = new URLSearchParams(window.location.search).get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const register = useMutation({
    mutationFn: () =>
      requestJson<{ confirmationRequired: boolean }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    onSuccess: (result) =>
      navigate(
        result.confirmationRequired
          ? `/confirm?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`
          : `/login?next=${encodeURIComponent(next)}`,
      ),
  });
  return (
    <Container size={420} py={80}>
      <Paper withBorder p="xl">
        <Stack>
          <Title order={2}>Create account</Title>
          <Text c="dimmed" size="sm">
            The first account can set up this organization. Later accounts need
            an invitation.
          </Text>
          <TextInput
            label="Email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />
          <PasswordInput
            label="Password"
            description="At least 12 characters"
            required
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />
          {register.error && (
            <Alert color="red">{register.error.message}</Alert>
          )}
          <Button
            loading={register.isPending}
            onClick={() => register.mutate()}
          >
            Create account
          </Button>
          <Anchor
            component={Link}
            href={`/login?next=${encodeURIComponent(next)}`}
            size="sm"
          >
            Already have an account? Sign in
          </Anchor>
        </Stack>
      </Paper>
    </Container>
  );
};

/** Confirms a new Cognito account with the emailed code. */
export const ConfirmScreen = () => {
  const [, navigate] = useLocation();
  const next = new URLSearchParams(window.location.search).get("next") ?? "/";
  const [email, setEmail] = useState(
    new URLSearchParams(window.location.search).get("email") ?? "",
  );
  const [code, setCode] = useState("");
  const confirm = useMutation({
    mutationFn: () =>
      requestJson("/auth/confirm", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      }),
    onSuccess: () => navigate(`/login?next=${encodeURIComponent(next)}`),
  });
  return (
    <Container size={420} py={80}>
      <Paper withBorder p="xl">
        <Stack>
          <Title order={2}>Confirm email</Title>
          <Text c="dimmed" size="sm">
            Enter the code sent by Cognito.
          </Text>
          <TextInput
            label="Email"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />
          <TextInput
            label="Code"
            value={code}
            onChange={(event) => setCode(event.currentTarget.value)}
          />
          {confirm.error && <Alert color="red">{confirm.error.message}</Alert>}
          <Button loading={confirm.isPending} onClick={() => confirm.mutate()}>
            Confirm account
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
};

/** Claims the single organization for the first authenticated user. */
export const SetupScreen = () => {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const setup = useMutation({
    mutationFn: () =>
      requestJson("/setup", {
        method: "POST",
        body: JSON.stringify({ name, timezone }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate("/");
    },
  });
  return (
    <Container size={460} py={80}>
      <Paper withBorder p="xl">
        <Stack>
          <Title order={2}>Set up your workspace</Title>
          <Text c="dimmed" size="sm">
            This account will become the owner of the single signage
            organization.
          </Text>
          <TextInput
            label="Organization name"
            required
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
          <TimezoneSelect value={timezone} onChange={setTimezone} required />
          {setup.error && <Alert color="red">{setup.error.message}</Alert>}
          <Button
            loading={setup.isPending}
            disabled={!timezone}
            onClick={() => setup.mutate()}
          >
            Create workspace
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
};
