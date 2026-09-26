import { Alert, Center, Container, Loader, Stack, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Redirect, Route, Switch } from "wouter";
import { AdminShell } from "./components/AdminShell/AdminShell";
import { ConfirmScreen, LoginScreen, RegisterScreen, SetupScreen } from "./components/AuthScreens/AuthScreens";
import { InviteScreen } from "./components/InviteScreen/InviteScreen";
import { PeoplePage } from "./components/PeoplePage/PeoplePage";
import { SettingsPage } from "./components/SettingsPage/SettingsPage";
import { MediaPage } from "./components/MediaPage/MediaPage";
import { PlaylistEditorPage, PlaylistsPage } from "./components/PlaylistsPage/PlaylistsPage";
import { PlayerPage } from "./components/PlayerPage/PlayerPage";
import { DisplayEditorPage, DisplaysPage } from "./components/DisplaysPage/DisplaysPage";
import { getToken, requestJson } from "./helpers/api";

type MeResponse = { user: { email: string }; membership: { role: "owner" | "admin" }; organization: { name: string; timezone: string } };

const Home = () => <Container fluid><Stack><Text size="xs" c="dimmed" tt="uppercase" ff="monospace">Workspace</Text><Title>Overview</Title><Text c="dimmed">Your signage workspace is ready. Add media and playlists to get started.</Text></Stack></Container>;

const AdminGate = () => {
  const token = getToken();
  const me = useQuery({ queryKey: ["me", token], queryFn: () => requestJson<MeResponse>("/admin/me"), enabled: !!token, retry: false });
  const setup = useQuery({ queryKey: ["setup-status"], queryFn: () => requestJson<{ setupRequired: boolean }>("/setup/status"), enabled: !!token && me.isError, retry: false });
  if (!token) return <Redirect to="/login" />;
  if (me.isPending) return <Center h="100vh"><Loader /></Center>;
  if (me.isError) {
    if (setup.data?.setupRequired) return <Redirect to="/setup" />;
    if (setup.isPending) return <Center h="100vh"><Loader /></Center>;
    return <Container py="xl"><Alert color="red">This account is not an administrator. Accept an invitation to continue.</Alert></Container>;
  }
  return <AdminShell userEmail={me.data.user.email} organizationName={me.data.organization.name}><Switch><Route path="/" component={Home} /><Route path="/media" component={MediaPage} /><Route path="/playlists/:id" component={PlaylistEditorPage} /><Route path="/playlists" component={PlaylistsPage} /><Route path="/displays/:id" component={DisplayEditorPage} /><Route path="/displays" component={DisplaysPage} /><Route path="/people"><PeoplePage role={me.data.membership.role} /></Route><Route path="/settings"><SettingsPage name={me.data.organization.name} timezone={me.data.organization.timezone} role={me.data.membership.role} /></Route>{/* Keep the catch-all last; Wouter selects the first matching route. */}<Route><Container py="xl"><Title order={2}>Page not found</Title></Container></Route></Switch></AdminShell>;
};

/** Renders the admin and public player routes. */
export const App = () => (
  <Switch>
    <Route path="/player/:token" component={PlayerPage} />
    <Route path="/login" component={LoginScreen} />
    <Route path="/register" component={RegisterScreen} />
    <Route path="/confirm" component={ConfirmScreen} />
    <Route path="/setup" component={SetupScreen} />
    <Route path="/invite/:token" component={InviteScreen} />
    {/* Keep the catch-all last; Wouter selects the first matching route. */}
    <Route><AdminGate /></Route>
  </Switch>
);
