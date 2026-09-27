/** Unwraps a database mutation that must return exactly one row. */
export const firstRow = <T>(rows: readonly T[]): T => {
  const row = rows[0];
  if (!row) throw new Error("Database mutation returned no row");
  return row;
};
