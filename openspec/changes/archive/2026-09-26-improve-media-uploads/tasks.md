# Tasks

## 1. Shared per-file upload flow

- [x] 1.1 Extract the current create/upload/complete flow into a reusable per-file operation while retaining API validation and best-effort video thumbnail generation after readiness; verify existing single-file upload and thumbnail browser coverage still passes.
- [x] 1.2 Add a bounded two-at-a-time queue with stable file IDs and independent queued/uploading/ready/failed states; verify a failed or unsupported file does not stop other files in focused tests.

## 2. Batch file intake

- [x] 2.1 Enable multiple file selection and display a per-file status list in the Media library; verify selecting mixed image/video files creates separate library results.
- [x] 2.2 Add a page-wide file-drop overlay and native drop handlers while the Media library is mounted; verify multiple dropped files queue, non-file drags are ignored, and the browser does not navigate to a dropped file.
- [x] 2.3 Document multi-file selection, dropping, discrete status labels, and mixed failure behavior in the operator walkthrough; verify the instructions match the UI.

## 3. Integration verification

- [x] 3.1 Run relevant browser, typecheck, build, and Biome checks; verify batch and single-file uploads use the same API and preserve existing media limits.
