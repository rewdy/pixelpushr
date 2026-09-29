type Props = { name: string };

/** Gives the active React view one consistently suffixed browser title. */
export const PageTitle = ({ name }: Props) => (
  <title>{`${name} | pixelpushr`}</title>
);
