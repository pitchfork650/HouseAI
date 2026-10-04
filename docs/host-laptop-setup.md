# Host laptop setup (app + OpenSwarm on one machine)

Step-by-step setup for running the HouseAI Dental web app **and** the OpenSwarm MCP host on
the same Windows laptop. Written so an AI coding assistant on the laptop can follow it: each
step has a check, so don't move on until the check passes.

With everything on one machine there is no tunnel: the app talks to the host server at
`http://localhost:8787`. The wire format between them is in
[`openswarm-mcp-contract.md`](openswarm-mcp-contract.md).

```
 browser ──▶ web app (npm run dev, :3000) ──▶ MCP host server (npm run host:dev, :8787) ──▶ OpenSwarm desktop app
```

## Prerequisites

- **Node.js 22 or newer** (`node -v`). The Codespace uses Node 24.
- **Git**
- **OpenSwarm desktop app**, installed and signed in (only needed in step 5)
- Run the commands below in **PowerShell**. Env vars use `$env:NAME="value"`, not `NAME=value`.

## 1. Get the code and install

```powershell
git clone https://github.com/pitchfork650/HouseAI
cd HouseAI
npm install
copy .env.example .env
npm run setup
```

**Check:** `npm run setup` ends with `Seeded: 25 patients, ...`.

## 2. Pick a token and configure the app

Generate a random token:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

In `.env`, set:

```
SWARM_HOST=openswarm
OPENSWARM_HOST_URL=http://localhost:8787
OPENSWARM_TOKEN=<the token>
```

Never commit `.env`. It is already in `.gitignore`.

## 3. Start the host server in replay mode (terminal 1)

The host server does **not** read `.env`, so set its variables in the shell, using the same token:

```powershell
$env:OPENSWARM_TOKEN="<the token>"
$env:HOST_MODE="replay"
npm run host:dev
```

**Check:** it prints `OpenSwarm MCP host (replay) on http://localhost:8787/mcp`.

Replay mode answers with sample outputs. It proves the link works before OpenSwarm is wired in.

## 4. Check the link and start the app (terminal 2)

```powershell
npm run host:probe
```

**Check:** the output lists the tools `health` and `run_agent`, and `health.openswarm` shows
`running: true, signedIn: true`. A 401 means the tokens don't match.

```powershell
npm run dev
```

**Check:** open http://localhost:3000. The sidebar chip reads **Host connected** (green). Open
a patient's Diagnostics page and run the swarm. Terminal 1 logs one `[run_agent] ... ok` line per
agent.

## 5. Connect the real OpenSwarm

All the remaining work is in `host/server.ts`. Two functions are stubs:

### `openSwarmState()`

Return `{ running, signedIn, version? }` for the OpenSwarm desktop app on this laptop. The
sidebar chip turns green only when both `running` and `signedIn` are true.

### `runOnOpenSwarm(args)`

Run one agent on OpenSwarm and return `{ output, model }`.

- `args.agent.prompt`: the agent's instructions. Use them as-is. The host must **not** keep its
  own copy of prompts, because they come from `agents/` in this repo on every call.
- `args.agent.outputSchema`: JSON Schema that `output` must match. The app validates the output
  and retries once if it doesn't match.
- `args.context`: minimal patient context (no names, DOB or contact details).
- `args.images`: `{ mimeType, dataBase64 }[]`, X-rays and photos for vision agents. The seed
  patients' panoramics are **`image/svg+xml`**. If OpenSwarm's models only take raster images,
  convert them to PNG first. Uploaded studies are PNG, JPEG or WebP.
- `args.timeoutMs`: how long the app will wait (180 s by default).
- On failure, throw. The server turns the error into an `isError` tool result.
- Don't write images to disk beyond the run.

The agents the app calls and their output shapes are listed in the contract doc under
"Agents the app calls".

How to hand a job to OpenSwarm (its API, CLI or SDK) depends on OpenSwarm itself, so check its
documentation on this laptop.

**Check:** restart terminal 1 with `$env:HOST_MODE="openswarm"`, run `npm run host:probe`
again, then run a Diagnostics swarm in the app. Any agent that fails shows its error in
terminal 1.

## Security notes

- The host server listens on all network interfaces, so other devices on the same Wi-Fi can reach
  port 8787. Only the token protects it, so always use a random token, never `dev-token`.
- Don't open port 8787 in the Windows firewall or on the router.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `EADDRINUSE ... :3000` or `:8787` | That server is already running. Use it, or stop the other process first. |
| Probe or app gets 401 | `OPENSWARM_TOKEN` in `.env` doesn't match the one set in terminal 1. |
| Chip says **Host not ready** | The host is reachable but `openSwarmState()` reports OpenSwarm isn't running or signed in. |
| Chip says **Host offline** | Terminal 1 isn't running, or `OPENSWARM_HOST_URL` is wrong. |
| Chip is amber and the app uses sample data | `SWARM_HOST` isn't `openswarm`. Restart `npm run dev` after editing `.env`. |
| `... returned output that doesn't match its format` | OpenSwarm's output doesn't match `agent.outputSchema`. Tighten the prompt handling in `runOnOpenSwarm()`. |
