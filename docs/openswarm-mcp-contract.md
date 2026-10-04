# OpenSwarm host: MCP contract

HouseAI Dental runs its swarms on **OpenSwarm on a separate host device** (the Windows
laptop). The web app reaches the host through a small **MCP server** that your team runs
on that laptop. This file is the contract between the two. The web app side is
implemented in `src/lib/swarm/host/openswarm.ts`; a reference server that speaks this
contract lives in `host/server.ts`.

```
 codespace (web app)  ──HTTPS──▶  Cloudflare Tunnel  ──▶  host laptop: MCP server  ──▶  OpenSwarm
   invokeAgent()                  (or Tailscale)          run_agent / health            (desktop app)
```

## Transport

- **MCP over Streamable HTTP**, endpoint path **`/mcp`** (JSON-RPC over HTTP POST; the SDK handles it).
- Stateless is fine: the app opens a session, calls one tool, and closes it.
- Reachable only through **HTTPS or a private tunnel**, never an open port on the internet. The
  app refuses any other `OPENSWARM_HOST_URL`.
  - Recommended for the demo: a Cloudflare quick tunnel on the laptop:
    `cloudflared tunnel --url http://localhost:8787` gives an `https://<random>.trycloudflare.com` URL.
  - Alternative: Tailscale (`http://<machine>.<tailnet>.ts.net:8787`).

## Auth

- Every request carries `Authorization: Bearer <OPENSWARM_TOKEN>`.
- The server must reject a missing or wrong token with **HTTP 401** before touching OpenSwarm.
- Generate the token once and set it on both sides:
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`

## Tools

### `health`

No arguments. Read-only. Returns JSON (as `structuredContent`, or as a single text content item):

```json
{ "ok": true, "openswarm": { "running": true, "signedIn": true, "version": "x.y.z" }, "host": "WIN-LAPTOP" }
```

The sidebar chip turns **green** only when `ok`, `openswarm.running` and `openswarm.signedIn` are all true.

### `run_agent`

Runs one agent on OpenSwarm and returns its JSON output. **The agent definition comes from
the web app's repo with every call.** The host must not keep its own copy of prompts.

Arguments:

| field | type | notes |
|---|---|---|
| `runId` | string | the app's swarm run id, for your logs |
| `agent.name` | string | e.g. `"Root-Tip Agent"` |
| `agent.slug` | string | e.g. `"root-tip"`, matches `agents/<slug>.v<N>.md` |
| `agent.version` | string | e.g. `"v1"` |
| `agent.prompt` | string | the full system prompt |
| `agent.outputSchema` | object | JSON Schema the output must match |
| `context` | object | minimal context only: never names, DOB or contact details |
| `images` | `{ mimeType, dataBase64 }[]` | X-rays / photos for vision agents (may be empty) |
| `timeoutMs` | number | how long the app will wait |

Result (as `structuredContent`, or as one text content item holding JSON):

```json
{ "output": { "...": "matches agent.outputSchema" }, "model": "openswarm/<agent or model name>", "logs": [{ "t": "ISO time", "text": "..." }] }
```

On failure, return a tool result with `isError: true` and a one-line message. The app
validates `output` against the schema, retries once, and keeps the other agents running if
this one fails.

### Agents the app calls

| slug | swarm | output (see the zod schemas in the repo) |
|---|---|---|
| `caries-scout`, `root-tip`, `third-molar`, `restoration-auditor`, `shade` | diagnostic | `{ findings[], summary }` |
| `verifier` | diagnostic | `{ results[], summary }` |
| `skeptic` | diagnostic | `{ challenges[], summary }` |
| `consensus` | diagnostic | `{ rows[] }` |
| `carrier-eligibility` | insurance | `{ status: "ok" \| "timeout", timeoutSec?, activeSince?, annualMax?, used? }` |
| `carrier-coverage` | insurance | `{ items[{ code, label, pct, note? }], waitingPeriod }` |
| `carrier-preapproval` | insurance | `{ ref }` |
| `preapproval-narrative` | insurance | `{ narrative }` |

## Privacy

- The host only receives images plus minimal context. The app blocks keys like `name`,
  `dob`, `email`, `phone`, `patientId` before sending.
- The app writes an audit event for every request it sends (hashes only, never content).
- Don't persist images on the host beyond the run.

## Testing without OpenSwarm

`npm run host:dev` starts the reference server in **replay mode** on port 8787. It answers
`run_agent` with the same sample outputs as the in-app mock. Point the app at it:

```
SWARM_HOST=openswarm
OPENSWARM_HOST_URL=http://localhost:8787
OPENSWARM_TOKEN=dev-token
```

`npm run host:probe` makes read-only calls (`tools/list`, `health`) against
`OPENSWARM_HOST_URL` and prints what it finds.

## Seed data

Seed patients are synthetic. Their panoramic is generated, so it arrives as
`image/svg+xml` (800×400) instead of PNG/JPEG. Uploaded studies arrive as PNG, JPEG or WebP.
