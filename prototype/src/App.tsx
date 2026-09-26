import {
  ActionIcon,
  AppShell,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Container,
  Divider,
  Drawer,
  Group,
  Kbd,
  Menu,
  Paper,
  Progress,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
  UnstyledButton,
  useComputedColorScheme,
  useMantineColorScheme,
  useMatches,
} from "@mantine/core";
import {
  LuCalendarDays,
  LuChevronDown,
  LuChevronRight,
  LuCircleCheck,
  LuCloudOff,
  LuEllipsis,
  LuFolder,
  LuGauge,
  LuLayoutDashboard,
  LuList,
  LuLogOut,
  LuMenu,
  LuMonitor,
  LuPlay,
  LuPlus,
  LuRefreshCw,
  LuSearch,
  LuSettings,
  LuUpload,
  LuUsers,
  LuZap,
} from "react-icons/lu";
import { IoPlay } from "react-icons/io5";
import type { IconType } from "react-icons";
import { useState, type ReactNode } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import { mediaAssets, navSections, playlists } from "./data/prototype.data";

type IconName = "dashboard" | "photo" | "list" | "screen" | "calendar" | "bolt" | "users";
type IconOptions = { size?: number; color?: string; strokeWidth?: number; fill?: string };

const iconFor = (name: IconName, props?: IconOptions) => {
  const icons: Record<IconName, IconType> = {
    dashboard: LuLayoutDashboard,
    photo: LuFolder,
    list: LuList,
    screen: LuMonitor,
    calendar: LuCalendarDays,
    bolt: LuZap,
    users: LuUsers,
  };
  const Icon = icons[name];
  return <Icon {...props} />;
};

const StatusBadge = ({ children, tone = "gray" }: { children: ReactNode; tone?: "green" | "blue" | "orange" | "red" | "gray" }) => (
  <Badge variant="light" color={tone === "gray" ? "gray" : tone === "blue" ? "brand" : tone === "green" ? "signal" : tone} radius="sm" size="sm">
    {children}
  </Badge>
);

const Eyebrow = ({ children }: { children: ReactNode }) => <Text className="mono-label" c="dimmed">{children}</Text>;

const NavItem = ({ label, path, icon }: { label: string; path: string; icon: IconName }) => {
  const [location] = useLocation();
  const active = path === "/" ? location === path : location.startsWith(path);
  return (
    <UnstyledButton component={Link} href={path} data-active={active || undefined} className="nav-item">
      <Group gap="sm" wrap="nowrap">
        {iconFor(icon, { size: 17, strokeWidth: 1.8 })}
        <Text size="sm" fw={active ? 650 : 500}>{label}</Text>
      </Group>
      {active && <Box className="nav-active-mark" />}
    </UnstyledButton>
  );
};

const Brand = () => (
  <Group gap="xs" wrap="nowrap">
    <ThemeIcon size={30} radius="sm" variant="gradient" gradient={{ from: "brand.4", to: "brand.7", deg: 130 }}>
      <IoPlay size={15} />
    </ThemeIcon>
    <Text fw={750} size="lg" lts="-0.04em">pixelpushr</Text>
  </Group>
);

const AdminSidebar = ({ opened, onClose }: { opened: boolean; onClose: () => void }) => (
  <Drawer opened={opened} onClose={onClose} size={280} withCloseButton={false} hiddenFrom="md" padding={0}>
    <Box p="md" className="mobile-drawer">
      <Brand />
      <Stack gap={4} mt={42}>
        {navSections.map((section) => (
          <Box key={section.label} mb="md">
            <Eyebrow>{section.label}</Eyebrow>
            <Stack gap={3} mt="xs">
              {section.items.map((item) => <NavItem key={item.path} {...item} />)}
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  </Drawer>
);

const Sidebar = () => (
  <AppShell.Navbar p="md" visibleFrom="md" className="sidebar">
    <Stack h="100%" justify="space-between">
      <Box>
        <Brand />
        <Paper withBorder radius="md" p="sm" mt="xl" bg="transparent">
          <Group wrap="nowrap" gap="sm">
            <Avatar color="brand" radius="sm" size="sm">FC</Avatar>
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Text size="sm" fw={650} truncate>First Community</Text>
              <Text size="xs" c="dimmed" truncate>3 active displays</Text>
            </Box>
            <LuChevronDown size={15} color="var(--mantine-color-dimmed)" />
          </Group>
        </Paper>
        <ScrollArea className="nav-scroll" mt="xl" offsetScrollbars>
          {navSections.map((section) => (
            <Box key={section.label} mb="xl">
              <Eyebrow>{section.label}</Eyebrow>
              <Stack gap={3} mt="xs">
                {section.items.map((item) => <NavItem key={item.path} {...item} />)}
              </Stack>
            </Box>
          ))}
        </ScrollArea>
      </Box>
      <Box>
        <Divider mb="md" />
        <Group justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Avatar color="gray" radius="xl" size="sm">DS</Avatar>
            <Box style={{ minWidth: 0 }}>
              <Text size="xs" fw={650} truncate>Darrell Steward</Text>
              <Text size="xs" c="dimmed">Owner</Text>
            </Box>
          </Group>
          <Menu shadow="md" width={160} position="right-end">
            <Menu.Target><ActionIcon variant="subtle" color="gray"><LuEllipsis size={17} /></ActionIcon></Menu.Target>
            <Menu.Dropdown><Menu.Item leftSection={<LuSettings size={15} />}>Settings</Menu.Item><Menu.Item color="red" leftSection={<LuLogOut size={15} />}>Sign out</Menu.Item></Menu.Dropdown>
          </Menu>
        </Group>
      </Box>
    </Stack>
  </AppShell.Navbar>
);

const MobileNavButton = ({ onMenu }: { onMenu: () => void }) => (
  <ActionIcon className="mobile-nav-button" hiddenFrom="md" variant="default" size="lg" radius="xl" aria-label="Open navigation" onClick={onMenu}>
    <LuMenu size={18} />
  </ActionIcon>
);

const PageHeader = ({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) => (
  <Group justify="space-between" align="flex-end" mb="xl" gap="md">
    <Box>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <Title order={1} mt={eyebrow ? 5 : 0} size="clamp(1.65rem, 2.2vw, 2.2rem)" lts="-0.045em">{title}</Title>
      {description && <Text c="dimmed" mt={6} size="sm">{description}</Text>}
    </Box>
    {action}
  </Group>
);

const StatCard = ({ label, value, detail, icon, color = "brand" }: { label: string; value: string; detail: string; icon: ReactNode; color?: "brand" | "signal" | "orange" }) => (
  <Card withBorder padding="lg" radius="lg">
    <Group justify="space-between" align="flex-start"><ThemeIcon color={color} variant="light" size={38} radius="md">{icon}</ThemeIcon><Text size="xs" c="dimmed" className="mono-label">{label}</Text></Group>
    <Text size="2rem" fw={750} mt="lg" lts="-0.055em">{value}</Text>
    <Text size="xs" c="dimmed" mt={3}>{detail}</Text>
  </Card>
);

const DashboardPage = () => (
  <>
    <PageHeader eyebrow="Monday, September 26, 2026" title="Good morning, Darrell" description="Here's what's happening across your signage workspace." action={<Button leftSection={<LuPlus size={16} />}>Create playlist</Button>} />
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
      <StatCard label="Active displays" value="3 / 4" detail="1 display needs attention" icon={<LuMonitor size={20} />} />
      <StatCard label="Published media" value="42" detail="6 added this month" icon={<LuFolder size={20} />} color="signal" />
      <StatCard label="Live playlists" value="8" detail="3 scheduled this week" icon={<LuList size={20} />} color="orange" />
      <StatCard label="Next override" value="04:32" detail="Community night countdown" icon={<LuZap size={20} />} />
    </SimpleGrid>
    <SimpleGrid cols={{ base: 1, lg: 7 }} spacing="md" mt="md">
      <Card withBorder radius="lg" padding="lg" style={{ gridColumn: "span 4" }}>
        <Group justify="space-between" mb="lg"><Box><Eyebrow>Display health</Eyebrow><Title order={3} mt={4}>Everything is mostly good</Title></Box><Button variant="subtle" size="xs" rightSection={<LuChevronRight size={14} />} component={Link} href="/displays">View displays</Button></Group>
        <Stack gap="md">
          {[{ name: "Lobby display", location: "Main lobby", state: "Online", progress: 92, color: "signal" }, { name: "Welcome center", location: "Welcome desk", state: "Online", progress: 78, color: "signal" }, { name: "Auditorium", location: "Building A", state: "Needs attention", progress: 31, color: "orange" }].map((display) => (
            <Box key={display.name}><Group justify="space-between" mb={6}><Group gap="sm"><ThemeIcon size={25} radius="sm" variant="light" color={display.color}><LuMonitor size={14} /></ThemeIcon><Box><Text size="sm" fw={600}>{display.name}</Text><Text size="xs" c="dimmed">{display.location}</Text></Box></Group><Group gap="sm"><StatusBadge tone={display.color === "signal" ? "green" : "orange"}>{display.state}</StatusBadge><Text size="xs" c="dimmed" w={32} ta="right">{display.progress}%</Text></Group></Group><Progress value={display.progress} color={display.color} size="xs" radius="xl" /></Box>
          ))}
        </Stack>
      </Card>
      <Card withBorder radius="lg" padding="lg" style={{ gridColumn: "span 3" }}>
        <Group justify="space-between" mb="lg"><Box><Eyebrow>Coming up</Eyebrow><Title order={3} mt={4}>Scheduled moments</Title></Box><ActionIcon variant="subtle" color="gray"><LuEllipsis size={17} /></ActionIcon></Group>
        <Stack gap={0}>
          {[{ time: "12:00 PM", label: "Lunch menu", detail: "Lobby display", color: "brand" }, { time: "5:55 PM", label: "Community night countdown", detail: "All displays · Override", color: "red" }, { time: "Oct 03", label: "October events", detail: "Welcome center", color: "signal" }].map((event) => <Group key={event.label} gap="md" py="sm" align="flex-start"><Text size="xs" c="dimmed" w={54} pt={3}>{event.time}</Text><Box style={{ borderLeft: "2px solid var(--mantine-color-" + (event.color === "red" ? "red-5" : event.color === "signal" ? "signal-5" : "brand-5") + ")", paddingLeft: 12 }}><Text size="sm" fw={650}>{event.label}</Text><Text size="xs" c="dimmed" mt={2}>{event.detail}</Text></Box></Group>)}
        </Stack>
      </Card>
    </SimpleGrid>
    <Card withBorder radius="lg" padding="lg" mt="md">
      <Group justify="space-between" mb="lg"><Box><Eyebrow>Recent activity</Eyebrow><Title order={3} mt={4}>Workspace activity</Title></Box><Button variant="subtle" size="xs">See all activity</Button></Group>
      <Table.ScrollContainer minWidth={580}><Table verticalSpacing="sm" highlightOnHover><Table.Tbody>{[{ icon: <LuCircleCheck size={15} />, text: "October events was assigned to Welcome center", time: "18 min ago", color: "signal" }, { icon: <LuUpload size={15} />, text: "Community Night Promo was uploaded", time: "1 hour ago", color: "brand" }, { icon: <LuZap size={15} />, text: "Countdown override ended on Lobby display", time: "Yesterday", color: "orange" }].map((item) => <Table.Tr key={item.text}><Table.Td w={40}><ThemeIcon variant="light" color={item.color} size={28} radius="xl">{item.icon}</ThemeIcon></Table.Td><Table.Td><Text size="sm">{item.text}</Text></Table.Td><Table.Td ta="right"><Text size="xs" c="dimmed">{item.time}</Text></Table.Td></Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer>
    </Card>
  </>
);

const MediaPage = () => (
  <>
    <PageHeader eyebrow="Manage" title="Media library" description="The images and videos that power your displays." action={<Button leftSection={<LuUpload size={16} />}>Upload media</Button>} />
    <Group justify="space-between" mb="md"><TextInput placeholder="Search your media..." leftSection={<LuSearch size={16} />} w={{ base: "100%", sm: 320 }} /><Group><Button variant="default">All media</Button><Button variant="subtle" color="gray">Recently added</Button></Group></Group>
    <SimpleGrid cols={{ base: 1, xs: 2, lg: 3 }} spacing="md">
      {mediaAssets.map((asset) => <Card key={asset.id} withBorder radius="lg" padding="sm"><Box className="media-thumb" style={{ background: asset.color }}>{asset.kind === "video" && <ThemeIcon pos="absolute" top={10} left={10} color="dark" variant="white" radius="xl" size={30} style={{ zIndex: 1 }}><LuPlay size={14} fill="currentColor" /></ThemeIcon>}<Text pos="absolute" bottom={10} left={12} c="dark.8" fw={700} size="sm" style={{ zIndex: 1, maxWidth: "78%" }}>{asset.kind === "image" ? "IMAGE" : "VIDEO"}</Text></Box><Group justify="space-between" mt="sm" align="flex-start"><Box style={{ minWidth: 0 }}><Text size="sm" fw={650} truncate>{asset.name}</Text><Text size="xs" c="dimmed" mt={3}>{asset.size} · {asset.duration}</Text></Box><Menu shadow="md" width={140}><Menu.Target><ActionIcon variant="subtle" color="gray"><LuEllipsis size={17} /></ActionIcon></Menu.Target><Menu.Dropdown><Menu.Item>Preview</Menu.Item><Menu.Item>Edit details</Menu.Item><Menu.Item color="red">Remove</Menu.Item></Menu.Dropdown></Menu></Group><Group justify="space-between" mt="sm"><StatusBadge tone={asset.state === "Ready" ? "green" : asset.state === "Processing" ? "orange" : "red"}>{asset.state}</StatusBadge><Text size="xs" c="dimmed">{asset.updated}</Text></Group></Card>)}
    </SimpleGrid>
  </>
);

const PlaylistsPage = () => (
  <>
    <PageHeader eyebrow="Manage" title="Playlists" description="Build the rhythm your displays play throughout the day." action={<Button leftSection={<LuPlus size={16} />}>New playlist</Button>} />
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">{playlists.map((playlist) => <Card key={playlist.id} withBorder radius="lg" padding="lg"><Group justify="space-between" align="flex-start"><ThemeIcon size={42} radius="md" variant="light" color={playlist.mode === "Override" ? "red" : playlist.mode === "Scheduled" ? "orange" : "brand"}>{playlist.mode === "Override" ? <LuZap size={21} /> : playlist.mode === "Scheduled" ? <LuCalendarDays size={21} /> : <LuList size={21} />}</ThemeIcon><Menu shadow="md"><Menu.Target><ActionIcon variant="subtle" color="gray"><LuEllipsis size={17} /></ActionIcon></Menu.Target><Menu.Dropdown><Menu.Item>Edit playlist</Menu.Item><Menu.Item>Duplicate</Menu.Item><Menu.Item color="red">Delete</Menu.Item></Menu.Dropdown></Menu></Group><Title order={3} mt="lg" size="1.15rem">{playlist.name}</Title><Text size="sm" c="dimmed" mt={5}>{playlist.description}</Text><Group gap="lg" mt="lg"><Box><Eyebrow>Items</Eyebrow><Text fw={700} mt={3}>{playlist.items}</Text></Box><Box><Eyebrow>Displays</Eyebrow><Text fw={700} mt={3}>{playlist.displays}</Text></Box><Box><Eyebrow>Mode</Eyebrow><Box mt={3}><StatusBadge tone={playlist.mode === "Override" ? "red" : playlist.mode === "Scheduled" ? "orange" : "blue"}>{playlist.mode}</StatusBadge></Box></Box></Group><Button fullWidth variant="default" mt="lg" rightSection={<LuChevronRight size={15} />}>Open playlist</Button></Card>)}</SimpleGrid>
  </>
);

const DisplaysPage = () => (
  <>
    <PageHeader eyebrow="Manage" title="Displays" description="Keep an eye on every screen connected to your workspace." action={<Button leftSection={<LuPlus size={16} />}>Register display</Button>} />
    <Card withBorder radius="lg" padding={0} style={{ overflow: "hidden" }}><Table.ScrollContainer minWidth={700}><Table verticalSpacing="md" highlightOnHover><Table.Thead><Table.Tr><Table.Th>Display</Table.Th><Table.Th>Status</Table.Th><Table.Th>Now playing</Table.Th><Table.Th>Last seen</Table.Th><Table.Th>Queue</Table.Th><Table.Th /></Table.Tr></Table.Thead><Table.Tbody>{[{ name: "Lobby display", location: "Main lobby", status: "Online", playlist: "Lobby essentials", seen: "Just now", queue: "8 items" }, { name: "Welcome center", location: "Welcome desk", status: "Online", playlist: "October events", seen: "2 min ago", queue: "13 items" }, { name: "Auditorium", location: "Building A", status: "Needs attention", playlist: "Community night", seen: "26 min ago", queue: "5 items" }, { name: "Overflow room", location: "Building B", status: "Offline", playlist: "No playlist", seen: "3 days ago", queue: "—" }].map((display) => <Table.Tr key={display.name}><Table.Td><Group gap="sm" wrap="nowrap"><ThemeIcon variant="light" color={display.status === "Online" ? "signal" : "orange"} size={32} radius="md"><LuMonitor size={16} /></ThemeIcon><Box><Text size="sm" fw={650}>{display.name}</Text><Text size="xs" c="dimmed">{display.location}</Text></Box></Group></Table.Td><Table.Td><StatusBadge tone={display.status === "Online" ? "green" : display.status === "Offline" ? "gray" : "orange"}>{display.status}</StatusBadge></Table.Td><Table.Td><Text size="sm">{display.playlist}</Text></Table.Td><Table.Td><Text size="xs" c="dimmed">{display.seen}</Text></Table.Td><Table.Td><Text size="sm">{display.queue}</Text></Table.Td><Table.Td><ActionIcon variant="subtle" color="gray"><LuEllipsis size={17} /></ActionIcon></Table.Td></Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer></Card>
  </>
);

const SchedulesPage = ({ overrides = false }: { overrides?: boolean }) => {
  const events = overrides ? [{ name: "Community night countdown", display: "All displays", when: "Today · 5:55–6:00 PM", mode: "Override", status: "Upcoming" }, { name: "Emergency closure", display: "Auditorium", when: "Not active", mode: "Override", status: "Ready" }] : [{ name: "October events", display: "Welcome center", when: "Oct 01–07 · All day", mode: "Scheduled", status: "Upcoming" }, { name: "Lunch menu", display: "Lobby display", when: "Every weekday · 12:00 PM", mode: "Scheduled", status: "Active" }, { name: "Holiday campaign", display: "All displays", when: "Dec 01–31 · All day", mode: "Scheduled", status: "Draft" }];
  return <><PageHeader eyebrow="Plan" title={overrides ? "Overrides" : "Schedules"} description={overrides ? "Take over playback for moments that need everyone’s attention." : "Add playlists to the queue when the timing is right."} action={<Button leftSection={<LuPlus size={16} />}>{overrides ? "Create override" : "Add schedule"}</Button>} /><Card withBorder radius="lg" padding={0} style={{ overflow: "hidden" }}><Table.ScrollContainer minWidth={680}><Table verticalSpacing="md"><Table.Thead><Table.Tr><Table.Th>{overrides ? "Override" : "Playlist"}</Table.Th><Table.Th>Display</Table.Th><Table.Th>Active window</Table.Th><Table.Th>Type</Table.Th><Table.Th>Status</Table.Th><Table.Th /></Table.Tr></Table.Thead><Table.Tbody>{events.map((event) => <Table.Tr key={event.name}><Table.Td><Group gap="sm" wrap="nowrap"><ThemeIcon variant="light" color={overrides ? "red" : "brand"} size={30} radius="md">{overrides ? <LuZap size={15} /> : <LuCalendarDays size={15} />}</ThemeIcon><Text size="sm" fw={650}>{event.name}</Text></Group></Table.Td><Table.Td><Text size="sm">{event.display}</Text></Table.Td><Table.Td><Text size="sm">{event.when}</Text></Table.Td><Table.Td><StatusBadge tone={overrides ? "red" : "blue"}>{event.mode}</StatusBadge></Table.Td><Table.Td><StatusBadge tone={event.status === "Active" ? "green" : event.status === "Draft" ? "gray" : "orange"}>{event.status}</StatusBadge></Table.Td><Table.Td><ActionIcon variant="subtle" color="gray"><LuEllipsis size={17} /></ActionIcon></Table.Td></Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer></Card><Paper withBorder radius="lg" p="lg" mt="md" bg="var(--mantine-color-brand-light)"><Group align="flex-start" gap="md"><ThemeIcon color="brand" variant="light" radius="xl"><LuGauge size={17} /></ThemeIcon><Box><Text size="sm" fw={650}>How playback is resolved</Text><Text size="sm" c="dimmed" mt={4}>{overrides ? "An active override replaces every always-active and scheduled playlist until its exact end time." : "Scheduled playlists join your always-active playlists. Normal changes take effect at the next playback boundary."}</Text></Box></Group></Paper></>;
};

const SettingsPage = () => (
  <><PageHeader eyebrow="Workspace" title="Administrators" description="Manage the people who can shape your signage." action={<Button leftSection={<LuPlus size={16} />}>Invite administrator</Button>} /><Card withBorder radius="lg" padding={0} style={{ overflow: "hidden" }}><Table verticalSpacing="md"><Table.Thead><Table.Tr><Table.Th>Person</Table.Th><Table.Th>Role</Table.Th><Table.Th>Status</Table.Th><Table.Th>Last active</Table.Th><Table.Th /></Table.Tr></Table.Thead><Table.Tbody>{[{ name: "Darrell Steward", email: "darrell@firstcommunity.org", role: "Owner", status: "Active", last: "Just now", initials: "DS" }, { name: "Margaret Nichols", email: "margaret@firstcommunity.org", role: "Admin", status: "Active", last: "2 hours ago", initials: "MN" }, { name: "Thomas Lane", email: "thomas@firstcommunity.org", role: "Admin", status: "Invitation sent", last: "—", initials: "TL" }].map((person) => <Table.Tr key={person.email}><Table.Td><Group gap="sm"><Avatar color="brand" size="sm">{person.initials}</Avatar><Box><Text size="sm" fw={650}>{person.name}</Text><Text size="xs" c="dimmed">{person.email}</Text></Box></Group></Table.Td><Table.Td><Text size="sm">{person.role}</Text></Table.Td><Table.Td><StatusBadge tone={person.status === "Active" ? "green" : "orange"}>{person.status}</StatusBadge></Table.Td><Table.Td><Text size="xs" c="dimmed">{person.last}</Text></Table.Td><Table.Td><ActionIcon variant="subtle" color="gray"><LuEllipsis size={17} /></ActionIcon></Table.Td></Table.Tr>)}</Table.Tbody></Table></Card></>
);

const AuthPage = ({ setup = false }: { setup?: boolean }) => <Center mih="100vh" p="md" bg="var(--mantine-color-gray-light)"><Card withBorder radius="lg" padding="xl" maw={440} w="100%"><Brand /><Eyebrow>{setup ? "First-run setup" : "Welcome back"}</Eyebrow><Title order={1} size="1.8rem" mt="sm">{setup ? "Set up your workspace" : "Sign in to pixelpushr"}</Title><Text c="dimmed" size="sm" mt="xs">{setup ? "Create your organization and become the first administrator." : "Manage your displays from anywhere."}</Text><Stack mt="xl" gap="md">{setup && <TextInput label="Organization name" placeholder="First Community" />}{setup && <TextInput label="Your name" placeholder="Darrell Steward" />}<TextInput label="Email address" placeholder="you@example.com" type="email" /><Button fullWidth mt="sm">{setup ? "Create workspace" : "Continue"}</Button></Stack><Text size="xs" c="dimmed" ta="center" mt="xl">Protected admin access · Player links remain public for display devices</Text></Card></Center>;

const PlayerPage = () => {
  const [state, setState] = useState<"playing" | "loading" | "empty" | "offline">("playing");
  return <Box className="player-view" bg={state === "playing" ? "#d8defd" : "#10131c"} onKeyDown={(event) => { if (event.key === "1") setState("playing"); if (event.key === "2") setState("loading"); if (event.key === "3") setState("empty"); if (event.key === "4") setState("offline"); }} tabIndex={0}>
    {state === "playing" && <><Box className="player-art" /><Stack className="player-copy" gap={4}><Text className="mono-label" c="dark.7">First Community · Sunday, September 26</Text><Title order={1} c="dark.9">Make room for<br />what matters.</Title><Text c="dark.6" size="lg">Welcome to our community.</Text></Stack></>}
    {state === "loading" && <Center h="100vh"><Stack align="center" gap="sm"><ThemeIcon size={54} radius="xl" color="brand"><LuRefreshCw size={25} /></ThemeIcon><Text c="white" fw={650}>Loading your display</Text><Text c="gray.5" size="sm">This should only take a moment.</Text></Stack></Center>}
    {state === "empty" && <Center h="100vh"><Stack align="center" gap="sm"><ThemeIcon size={54} radius="xl" color="gray" variant="light"><LuMonitor size={25} /></ThemeIcon><Text c="white" fw={650}>Nothing is scheduled yet</Text><Text c="gray.5" size="sm">Assign a playlist to start playback.</Text></Stack></Center>}
    {state === "offline" && <Center h="100vh"><Stack align="center" gap="sm"><ThemeIcon size={54} radius="xl" color="orange" variant="light"><LuCloudOff size={25} /></ThemeIcon><Text c="white" fw={650}>Playing cached content</Text><Text c="gray.5" size="sm">We’ll reconnect when the network returns.</Text></Stack></Center>}
    <Text pos="fixed" bottom={18} right={22} c="rgba(255,255,255,.45)" size="xs">Press 1–4 to preview player states</Text>
  </Box>;
};

const AdminShell = () => {
  const [mobileOpened, setMobileOpened] = useState(false);
  return <AppShell navbar={{ width: 246, breakpoint: "md" }} padding="xl" className="admin-shell"><Sidebar /><AdminSidebar opened={mobileOpened} onClose={() => setMobileOpened(false)} /><MobileNavButton onMenu={() => setMobileOpened(true)} /><AppShell.Main><Container size="xl" px={{ base: 0, sm: "md" }}><Switch>
    <Route path="/" component={DashboardPage} />
    <Route path="/media" component={MediaPage} />
    <Route path="/playlists" component={PlaylistsPage} />
    <Route path="/displays" component={DisplaysPage} />
    <Route path="/schedules" component={() => <SchedulesPage />} />
    <Route path="/overrides" component={() => <SchedulesPage overrides />} />
    <Route path="/settings" component={SettingsPage} />
    {/* Keep the catch-all route last in <Switch>; wouter renders the first match. */}
    <Route> <DashboardPage /> </Route>
  </Switch></Container></AppShell.Main></AppShell>;
};

/** Renders the navigable visual prototype for the signage administration console and player. */
export const App = () => <Switch><Route path="/player" component={PlayerPage} /><Route path="/sign-in" component={() => <AuthPage />} /><Route path="/setup" component={() => <AuthPage setup />} /><Route component={AdminShell} /></Switch>;
