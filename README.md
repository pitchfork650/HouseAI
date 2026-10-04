# HouseAI Dental

A web app for cosmetic and restorative dental clinics that takes a patient from X-ray to follow-up in one record. AI agents ("swarms") do the legwork: second-opinion X-ray reads, insurance checks, scheduling and follow-up emails. The dentist approves every clinical finding.

## HouseAI Dental web app (Next.js)

The clinic web app (Flow, Diagnostics, Schedule, Insurance, Follow-ups) lives at the repo root: `src/`, `prisma/`, `agents/`.

```bash
npm install
npm run setup     # create the SQLite DB and seed the sample clinic
npm run dev       # http://localhost:3000 (binds 0.0.0.0 for Codespaces)
npm test          # Vitest
npm run lint      # tsc --noEmit
```

It runs end to end with zero credentials: with no `GEMINI_API_KEY` and `SWARM_HOST=mock`, every model and swarm call replays the sample data. See `.env.example`.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Prisma 6 (SQLite in dev, schema kept Postgres-compatible), Gemini via `@google/genai`, zod 4, Vitest.

### OpenSwarm host

**Swarms run on OpenSwarm on a separate host device** (the Windows host laptop), reached through an MCP server over HTTPS or a private tunnel. Agent prompts and output formats stay in `agents/` and are sent with every run. The contract is in [`docs/openswarm-mcp-contract.md`](docs/openswarm-mcp-contract.md), and a reference host server is in `host/server.ts` (`npm run host:dev`; check a host with `npm run host:probe`). The sidebar chip shows the host status: green when connected, amber when offline or on the mock.

### Layout

| Path | What |
|---|---|
| `src/app/` | Pages (`/`, `/diagnostics/[patientId]`, `/schedule`, `/insurance/[patientId]`, `/follow-ups/[id]`) and API routes |
| `src/lib/swarm/` | Coordinator (parallel agents, timeouts, retries, saved runs), diagnostic and insurance swarms, host connectors |
| `src/lib/rules/` | Pure rules: prioritizer, schedule rules, calendar auto-fill |
| `src/lib/llm/` | The single model gateway (Gemini or mock), data-residency guard |
| `agents/` | Versioned agent prompts (`*.v1.md`) |
| `prisma/` | Schema and seed for the sample clinic |
| `host/` | Reference OpenSwarm MCP host server |
| `scripts/` | Dev helpers: `npm run host:probe`, `npm run runs:inspect`, `npm run insurance:run [patientId]` |
| `design/` | Original `.dc.html` mockups; they win any conflict with the spec |
| `docs/` | [Build spec](docs/build-spec.md), OpenSwarm contract |
| `legacy/python-api/` | The earlier FastAPI + Streamlit prototype, kept for reference (not used by the app) |

## Status

Build order from the [spec](docs/build-spec.md#7-build-order-commit-after-each-with-tests):

- [x] 1. Scaffold, design tokens, fonts, sidebar shell, Flow page
- [x] 2. Prisma schema and seed
- [x] 3. Diagnostics screen, swarm coordinator and the 7 diagnostic agents (mock and Gemini)
- [x] 4. Prioritizer rules, Accept into treatment plan
- [x] 5. Schedule screen, auto-fill, CSV import
- [x] 6. Insurance screen and insurance swarm with independent lanes
- [x] 7. Follow-up screen, email generation, scheduler, day-12 reminder
- [x] 8. Intake (form, CSV, drop zone) and card OCR with per-field confidence
- [x] 9. Recall comparison against earlier studies

Also open:

- GDPR export and erasure endpoints (consent per purpose, residency guard and encrypted file storage are in place)
- `host/server.ts`: the host team still has to wire `run_agent` and `health` to the OpenSwarm desktop app
- Real integrations (Eaglesoft/Dentrix, insurer portals, an email provider) are out of scope until approved

## Safety and limitations

All patient records are synthetic. HouseAI is not a certified medical device and does not provide clinical diagnoses. A licensed dentist's evaluation and judgment are required for all patient care decisions.
