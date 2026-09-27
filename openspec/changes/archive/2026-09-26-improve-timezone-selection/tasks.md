# Tasks

## 1. Shared timezone selector

- [x] 1.1 Build a shared searchable timezone control and option helper using IANA identifiers, current `UTC±HH:MM` offsets, and the existing saved value; verify search, keyboard choice, UTC, fractional offsets, and aliases in focused tests.
- [x] 1.2 Replace setup's timezone text field with the shared control and retain browser-zone preselection; verify workspace creation saves the selected IANA identifier in browser coverage.
- [x] 1.3 Replace Settings' timezone text field with the shared control, keeping owner edit and administrator read-only behavior; verify both roles and an existing alias in browser coverage.

## 2. Clarity and integration

- [x] 2.1 Explain that displayed offsets are current and can change with daylight saving time in the control and operator documentation; verify labels and documentation agree.
- [x] 2.2 Verify typecheck, build, and relevant browser/schedule tests; confirm selecting a zone does not change existing schedule interpretation until it is saved.
