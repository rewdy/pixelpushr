import {
  Alert,
  Button,
  Center,
  Container,
  Loader,
  Stack,
  Title,
} from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Redirect, Route, Switch, useLocation } from "wouter";
import { AdminShell } from "./components/AdminShell/AdminShell";
import {
  ConfirmScreen,
  LoginScreen,
  RegisterScreen,
  SetupScreen,
} from "./components/AuthScreens/AuthScreens";
import {
  DisplayEditorPage,
  DisplaysPage,
} from "./components/DisplaysPage/DisplaysPage";
import { InviteScreen } from "./components/InviteScreen/InviteScreen";
import { MediaPage } from "./components/MediaPage/MediaPage";
import { OverviewPage } from "./components/OverviewPage/OverviewPage";
import { PageTitle } from "./components/PageTitle";
import { PeoplePage } from "./components/PeoplePage/PeoplePage";
import { PlayerPage } from "./components/PlayerPage/PlayerPage";
import { PlaylistEditorPage } from "./components/PlaylistsPage/PlaylistEditorPage";
import { PlaylistsPage } from "./components/PlaylistsPage/PlaylistsPage";
import { SettingsPage } from "./components/SettingsPage/SettingsPage";
import { RequestError, requestJson, sessionEndedEvent } from "./helpers/api";
import { loginDestination } from "./helpers/sessionNavigation";
import { useSignOut } from "./hooks/useSignOut";

type MeResponse = {
  user: { email: string };
  membership: { role: "owner" | "admin" };
  organization: { name: string; timezone: string };
};

const AdminGate = () => {
  const signOut = useSignOut();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: ({ signal }) => requestJson<MeResponse>("/admin/me", { signal }),
    retry: false,
  });
  const lacksMembership =
    me.error instanceof RequestError && me.error.code === "membership_required";
  const setup = useQuery({
    queryKey: ["setup-status"],
    queryFn: () => requestJson<{ setupRequired: boolean }>("/setup/status"),
    enabled: lacksMembership,
    retry: false,
  });

  if (me.isPending)
    return (
      <Center h="100vh">
        <PageTitle name="Loading" />
        <Loader />
      </Center>
    );
  if (me.isError) {
    if (
      me.error instanceof RequestError &&
      (me.error.code === "session_required" ||
        me.error.code === "session_ended")
    )
      return (
        <Redirect
          to={loginDestination(
            window.location.pathname + window.location.search,
            me.error.code === "session_ended",
          )}
          replace
        />
      );
    if (lacksMembership && setup.data?.setupRequired)
      return <Redirect to="/setup" />;
    if (lacksMembership && setup.isPending)
      return (
        <Center h="100vh">
          <PageTitle name="Loading" />
          <Loader />
        </Center>
      );
    return (
      <Container py="xl">
        <PageTitle
          name={lacksMembership ? "Access denied" : "Workspace unavailable"}
        />
        <Stack align="start">
          <Alert color="red">{setup.error?.message ?? me.error.message}</Alert>
          {lacksMembership && !setup.isError ? (
            <Button
              loading={signOut.isPending}
              onClick={() => signOut.mutate()}
            >
              Switch accounts
            </Button>
          ) : (
            <Button
              onClick={() =>
                void (setup.isError ? setup.refetch() : me.refetch())
              }
            >
              Try again
            </Button>
          )}
          {signOut.error && <Alert color="red">{signOut.error.message}</Alert>}
        </Stack>
      </Container>
    );
  }
  return (
    <AdminShell
      userEmail={me.data.user.email}
      organizationName={me.data.organization.name}
    >
      <Switch>
        <Route path="/">
          <PageTitle name="Overview" />
          <OverviewPage />
        </Route>
        <Route path="/media">
          <PageTitle name="Media library" />
          <MediaPage />
        </Route>
        <Route path="/playlists/:id" component={PlaylistEditorPage} />
        <Route path="/playlists">
          <PageTitle name="Playlists" />
          <PlaylistsPage />
        </Route>
        <Route path="/displays/:id" component={DisplayEditorPage} />
        <Route path="/displays">
          <PageTitle name="Displays" />
          <DisplaysPage />
        </Route>
        <Route path="/people">
          <PageTitle name="People & access" />
          <PeoplePage role={me.data.membership.role} />
        </Route>
        <Route path="/settings">
          <PageTitle name="Workspace settings" />
          <SettingsPage
            name={me.data.organization.name}
            timezone={me.data.organization.timezone}
            role={me.data.membership.role}
          />
        </Route>
        {/* Keep the catch-all last; Wouter selects the first matching route. */}
        <Route>
          <Container py="xl">
            <PageTitle name="Page not found" />
            <Title order={2}>Page not found</Title>
          </Container>
        </Route>
      </Switch>
    </AdminShell>
  );
};

/** Renders the admin and public player routes. */
export const App = () => {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  useEffect(() => {
    const handleSessionEnd = () => {
      const { pathname, search } = window.location;
      if (pathname === "/login" || pathname.startsWith("/player/")) return;
      const destination = loginDestination(pathname + search, true);
      queryClient.clear();
      navigate(destination, { replace: true });
    };
    window.addEventListener(sessionEndedEvent, handleSessionEnd);
    return () =>
      window.removeEventListener(sessionEndedEvent, handleSessionEnd);
  }, [navigate, queryClient]);
  return (
    <Switch>
      <Route path="/player/:token">
        <PageTitle name="Player" />
        <PlayerPage />
      </Route>
      <Route path="/login">
        <PageTitle name="Sign in" />
        <LoginScreen />
      </Route>
      <Route path="/register">
        <PageTitle name="Create account" />
        <RegisterScreen />
      </Route>
      <Route path="/confirm">
        <PageTitle name="Confirm account" />
        <ConfirmScreen />
      </Route>
      <Route path="/setup">
        <PageTitle name="Set up workspace" />
        <SetupScreen />
      </Route>
      <Route path="/invite/:token">
        <PageTitle name="Accept invitation" />
        <InviteScreen />
      </Route>
      {/* Keep the catch-all last; Wouter selects the first matching route. */}
      <Route>
        <AdminGate />
      </Route>
    </Switch>
  );
};
