import { Alert, Center, Container, Loader, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Redirect, Route, Switch } from "wouter";
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
import { getToken, requestJson } from "./helpers/api";

type MeResponse = {
  user: { email: string };
  membership: { role: "owner" | "admin" };
  organization: { name: string; timezone: string };
};

const AdminGate = () => {
  const token = getToken();
  const me = useQuery({
    queryKey: ["me", token],
    queryFn: () => requestJson<MeResponse>("/admin/me"),
    enabled: !!token,
    retry: false,
  });
  const setup = useQuery({
    queryKey: ["setup-status"],
    queryFn: () => requestJson<{ setupRequired: boolean }>("/setup/status"),
    enabled: !!token && me.isError,
    retry: false,
  });
  if (!token) return <Redirect to="/login" />;
  if (me.isPending)
    return (
      <Center h="100vh">
        <PageTitle name="Loading" />
        <Loader />
      </Center>
    );
  if (me.isError) {
    if (setup.data?.setupRequired) return <Redirect to="/setup" />;
    if (setup.isPending)
      return (
        <Center h="100vh">
          <PageTitle name="Loading" />
          <Loader />
        </Center>
      );
    return (
      <Container py="xl">
        <PageTitle name="Access denied" />
        <Alert color="red">
          This account is not an administrator. Accept an invitation to
          continue.
        </Alert>
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
export const App = () => (
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
