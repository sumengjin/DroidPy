# Legacy Bridge contract baseline

Status: characterization only; no runtime behavior is changed by this contract.

This directory records the existing NDJSON stream event shape shared by the external Python Bridge and the APK-embedded Kotlin Bridge. Both implementations currently emit:

- `stdout`: `{"type":"stdout","data":"..."}`
- `done`: `{"type":"done","exitCode":0,"durationMs":12}`

The PTY/process output is merged into the `stdout` event in both implementations. Do not interpret this as preserving a separate stderr channel.

## Scope and limits

- The schema validates individual NDJSON records, not HTTP framing, authentication, request bodies, or process lifecycle.
- The schema deliberately describes the legacy format. It does not add `requestId`, sequence numbers, progress events, structured errors, or a protocol version.
- The two implementations share these event fields, but their request routing, available endpoints, process-launch behavior, and some HTTP error handling are not yet equivalent.
- A client disconnect does not imply process cancellation; the process continues to drain output. Explicit `POST /stop` remains the control operation.
- HTTP errors are currently ordinary JSON objects, commonly `{"error":"..."}`; exact status and message vary by route and implementation. They are not NDJSON stream events.

## Source characterization

- Python: `src/services/termuxBridge.ts`, `_stream_pty_command`.
- Kotlin: generated `EmbeddedTermuxBridge` source in `src/services/androidApkBuilder.ts`, `streamShellCommand`.

## Next compatibility work

Before introducing a versioned protocol, add route-specific request/response schemas and fixtures, then run the same characterization cases against both servers. Do not use this legacy schema as a reason to change either runtime's behavior.

## HTTP characterization fixture

- `fixtures/stop-no-active.python.json`: expected response shape from the external Python handler when `POST /stop` has no active process (`stopped: false`).
- `fixtures/stop-no-active.kotlin.json`: expected response shape from the embedded Kotlin handler for the same state (`ok: true`, without a `stopped` field).

These are source-derived characterization expectations, not device-captured integration results. Their purpose is to preserve the known legacy difference until both implementations are exercised by a shared test harness.
