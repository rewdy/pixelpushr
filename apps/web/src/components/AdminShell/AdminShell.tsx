import { ActionIcon, AppShell, Avatar, Box, Burger, Divider, Group, ScrollArea, Stack, Text, ThemeIcon, UnstyledButton } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IoPlay } from "react-icons/io5";
import { LuCalendarDays, LuFolder, LuLayoutDashboard, LuList, LuLogOut, LuMonitor, LuSettings, LuUsers, LuZap } from "react-icons/lu";
import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { setToken } from "../../helpers/api";
import classes from "./AdminShell.module.css";

type AdminShellProps = { children: ReactNode; userEmail: string; organizationName: string };
const sections = [
  { label: "Workspace", links: [{ href: "/", label: "Overview", icon: LuLayoutDashboard }, { href: "/media", label: "Media library", icon: LuFolder }, { href: "/playlists", label: "Playlists", icon: LuList }, { href: "/displays", label: "Displays", icon: LuMonitor }] },
  { label: "Playback", links: [{ href: "/schedules", label: "Schedules", icon: LuCalendarDays }, { href: "/overrides", label: "Overrides", icon: LuZap }] },
  { label: "Administration", links: [{ href: "/people", label: "People & access", icon: LuUsers }, { href: "/settings", label: "Settings", icon: LuSettings }] },
];

/** Renders the approved headerless, shaded-sidebar administration frame. */
export const AdminShell = ({ children, userEmail, organizationName }: AdminShellProps) => {
  const [opened, { toggle, close }] = useDisclosure(false);
  const [location, navigate] = useLocation();
  return (
    <AppShell navbar={{ width: 246, breakpoint: "md", collapsed: { mobile: !opened } }} padding={{ base: "md", md: "xl" }}>
      <AppShell.Navbar p="md" className={classes.navbar}>
        <Stack h="100%" justify="space-between">
          <Group gap="sm">
            <ThemeIcon size={30} radius="sm" variant="gradient" gradient={{ from: "brand.4", to: "brand.7", deg: 130 }}><IoPlay size={15} /></ThemeIcon>
            <Text fw={750} size="lg" lts="-0.04em">pixelpushr</Text>
          </Group>
          <ScrollArea offsetScrollbars style={{ flex: 1 }} mt="xl">
            <Text size="xs" c="dimmed" fw={700} mb="xl">{organizationName}</Text>
            {sections.map((section) => (
              <Box key={section.label} mb="xl">
                <Text size="xs" c="dimmed" className={classes.mono} mb="xs">{section.label}</Text>
                <Stack gap={3}>
                  {section.links.map((link) => {
                    const active = link.href === "/" ? location === "/" : location.startsWith(link.href);
                    const Icon = link.icon;
                    return <UnstyledButton key={link.href} component={Link} href={link.href} className={classes.navItem} data-active={active || undefined} onClick={close}><Group gap="sm"><Icon size={17} /><Text size="sm" fw={active ? 650 : 500}>{link.label}</Text></Group></UnstyledButton>;
                  })}
                </Stack>
              </Box>
            ))}
          </ScrollArea>
          <Box>
            <Divider mb="md" />
            <Group justify="space-between" wrap="nowrap">
              <Group gap="sm" wrap="nowrap"><Avatar color="brand" size="sm" radius="xl">{userEmail.slice(0, 1).toUpperCase()}</Avatar><Text size="xs" truncate>{userEmail}</Text></Group>
              <ActionIcon variant="subtle" color="gray" aria-label="Sign out" onClick={() => { setToken(null); navigate("/login"); }}><LuLogOut size={16} /></ActionIcon>
            </Group>
          </Box>
        </Stack>
      </AppShell.Navbar>
      <AppShell.Main className={classes.main}>
        <Group hiddenFrom="md" mb="lg"><Burger opened={opened} onClick={toggle} aria-label="Toggle navigation" /><Text fw={700}>pixelpushr</Text></Group>
        {children}
      </AppShell.Main>
    </AppShell>
  );
};
