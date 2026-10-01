import { Button, Group, Text } from "@mantine/core";

type PageControlsProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

/** Shows a consistent result range and bounded navigation for admin lists. */
export const PageControls = ({
  page,
  pageSize,
  total,
  onPageChange,
}: PageControlsProps) => {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const first = total ? (page - 1) * pageSize + 1 : 0;
  const last = total ? Math.min(page * pageSize, total) : 0;
  return (
    <Group justify="space-between" gap="sm" wrap="wrap" mt="md">
      <Text size="sm" c="dimmed">
        Showing {first}–{last} of {total} results
      </Text>
      <Group gap="xs">
        <Button
          size="xs"
          variant="subtle"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Text size="sm" ff="monospace">
          Page {page} of {lastPage}
        </Text>
        <Button
          size="xs"
          variant="subtle"
          disabled={page >= lastPage}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </Group>
    </Group>
  );
};
