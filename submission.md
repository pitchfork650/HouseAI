# HouseAI Dental

**From X-ray to follow-up, on one record.**
AI agent swarms read every X-ray, fill the calendar, chase insurance and bring patients back, while the dentist signs off on every clinical finding.

- **Live demo:** [DEMO URL]
- **Video:** [VIDEO URL]
- **Code:** https://github.com/ryunzz/HouseAI
- **Team:** [TEAM NAMES]

---

## Inspiration

A dental practice runs on two separate jobs. One is clinical: reading X-rays, spotting what needs treatment, deciding what comes first. The other is admin: booking the chair, checking insurance, explaining costs and getting patients back for their next visit. The admin side takes hours from the front desk, and it's where patients fall through the cracks: an insurance check that never finished, a recall email that never went out, a crown that never got booked.

We built HouseAI for cosmetic and restorative practices, working with a real cosmetic-dentistry client. The goal is that once an X-ray is taken, everything after it happens without staff re-typing anything. The dentist stays in charge of every clinical decision.

## What it does

HouseAI follows one patient record through seven steps:

1. **Intake.** Add one patient, or import a whole day from a CSV export. Drop in X-rays, intraoral photos and insurance cards. Each patient gives consent per purpose: treatment, AI analysis and email.
2. **Read documents.** OCR plus Gemini fills in name, date of birth, member ID, group number and carrier from the insurance card. Every field gets a confidence score, and staff only check the ones under 80%.
3. **Swarm diagnostics.** Seven agents read the X-ray. Four specialists look for different things: cavities between teeth, infection at root tips, impacted wisdom teeth and their nerve canal, and failing crowns or fillings. A **Verifier** re-reads every finding on its own, and a **Skeptic** tries to argue each one away. Agreement is scored out of 3: the reporter, plus the Verifier, plus the Skeptic. A consensus step explains each finding in plain language by tooth number, and findings are drawn on the X-ray.
4. **Prioritize.** Rules turn each finding into a procedure code, a duration and a priority: P1 urgent, P2 long or high-value, P3 restorative, P4 routine. They also add any imaging needed first, for example "D3330 root canal, molar · 75 min (D0220 PA film first)". **Nothing reaches the chart until the dentist accepts it.**
5. **Calendar builder.** Auto-fill places the treatment plan and imported requests across providers and chairs:
   - long cases go before noon;
   - one P1 emergency slot is held each day;
   - checkups fill the afternoon gaps;
   - nothing is booked within 48 h if insurance isn't verified;
   - nothing is booked without an X-ray from the last 12 months;
   - patient time windows are respected.

   Anything that can't be placed lands in a "Needs input" queue with the reason.
6. **Insurance swarm.** One agent per insurer checks eligibility, a copay agent looks up coverage by procedure code, and a pre-approval agent files with the X-rays attached. The lanes are independent. In the demo, Carrier B's portal times out twice, so that lane schedules a phone-line retry for 14:00 while every other lane finishes. The patient's share is split across both insurers from the results.
7. **Follow-up.** A personalized aftercare email with a short video for that procedure goes out the morning after the visit, with a link to book the next check. It only sends with email consent, and a reminder goes out on day 12 if the patient hasn't booked.

The record then **loops back**: at the next recall X-ray, HouseAI compares the new findings with the last ones, tooth by tooth, and flags what's new, what got worse and what's unchanged.

## How we built it

- **App:** Next.js 16 (App Router), React 19, TypeScript and Tailwind CSS 4. The screens follow hand-made design mockups: Flow, Diagnostics, Schedule, Insurance, Recall, Intake and Follow-ups, plus a marketing landing page.
- **Data:** Prisma on Postgres (Supabase), with Supabase Storage for files. Patient files are encrypted with AES-256-GCM before they're stored. The app is deployed on Vercel, and a Vercel Cron job runs the follow-up and insurance-retry scheduler.
- **Swarm coordinator:** a small orchestrator we wrote ourselves, with no agent framework. Agents run in parallel, each with its own timeout and retries, so one failing or timing out never blocks the others. Every agent run is saved with its status, timestamped log lines and output, which is what the live swarm panels show.
- **One host interface, two versions:** all swarm agent calls go through a single `SwarmHost` interface.
  - The **mock** replays our sample runs, so the whole app works with zero credentials.
  - The **OpenSwarm** version runs agents on a separate host machine through an MCP server (Streamable HTTP, bearer token), only over HTTPS or a private tunnel. We wrote the contract (`run_agent` and `health` tools) and a reference host server.
  - Diagnostic agents can also run directly as **Gemini vision** calls.
- **Agents as data:** every agent's prompt is a versioned file in the repo. Its expected output is a zod schema that's sent to the host as JSON Schema with every request, and every result is validated against it before we use it.
- **Pure rules where rules beat models:** the prioritizer, the calendar auto-fill and the insurance cost split are plain deterministic functions with unit tests. We only use models for jobs that need judgement or vision.
- **Real X-rays:**
  - We tested the diagnostic swarm on real, de-identified research X-rays and scored it against expert labels: what it found, what it missed, and what it flagged that the labels don't have.
  - Research datasets are non-commercial, so they stay inside the app.
  - The public demo uses a periapical X-ray licensed for commercial use (Wikimedia Commons, CC BY-SA 4.0), credited on the page.
- **Tests:** 45 Vitest tests. They cover the prioritizer, consensus scoring, the coordinator's timeouts and retries, independent insurance lanes, calendar auto-fill, CSV parsing, follow-up consent, recall comparison, GDPR erasure, and the MCP host round trip against our reference server.

## Compliance and safety, built in

- **The dentist signs off.** The swarm only suggests; every finding stays "suggested" until a dentist accepts it.
- **Audit log.** Every agent output, every request to the swarm host, and every human accept or reject writes an audit event. Events store hashes, not content.
- **Data minimization.** Agents get the images plus the minimum context. The host interface refuses any request containing names, dates of birth or contact details. Outside production, real patient data is never sent to a model.
- **GDPR.** Consent per purpose, an EU data-residency guard on model calls, and endpoints to export a patient's record or erase it (erasure removes their files too, and the audit trail keeps only a hash of the patient ID).
- **Licence-aware demo.** The public landing page only shows images licensed for commercial use. Clinic uploads never appear there.

## Challenges we ran into

- **Making failure visible instead of hiding it.** Swarms are only useful if one bad agent doesn't sink the run. Getting timeouts, retries and "skipped because there was no intraoral photo" to show up clearly took real design work, in the coordinator and in the UI.
- **Coordinates on real images.** Models return boxes relative to the image, while the viewer letterboxes every X-ray into a fixed frame. Mapping between the two, and keeping that mapping consistent across uploads, datasets and model output, took a while to get right.
- **Free-tier model limits.** Gemini's free tier allows 20 requests per model per day, and a full seven-agent read uses about seven. We built the mock host and replayable runs so the demo never depends on quota.
- **Image licensing.** Most good dental X-ray datasets are non-commercial. We built licence tracking into the data model so the public site can't show the wrong image by accident.
- **Many hands on one codebase.** Several people and AI coding agents worked in parallel. We coordinated by claiming files and keeping each commit to one complete change.

## Accomplishments that we're proud of

- The full patient journey works end to end: X-ray, findings, treatment plan, booked schedule, verified insurance, follow-up email and recall.
- It runs with **zero credentials** in mock mode and switches to live models or a remote OpenSwarm host with a config change.
- A Skeptic agent and agreement scoring mean the dentist sees *how sure* the swarm is, not just what it thinks.
- Compliance is part of how the system works, not a page in a slide deck.

## What we learned

- Agent swarms earn their keep when the work naturally splits into independent jobs, like separate insurers or separate specialists, and when one part failing shouldn't stop the rest. Where a rule does the job, a rule is better.
- Validating every model output against a schema, and saving every run, makes AI features debuggable and auditable.
- In healthcare, the hard part isn't getting a model to answer. It's provenance, consent, sign-off and knowing what the system *didn't* check.

## What's next

- **OpenSwarm host:** connect the real OpenSwarm desktop app behind our MCP contract. The client side and a reference server are done.
- **Practice software:** integrations with Eaglesoft and Dentrix, real insurer portals and an email provider, with the practice's approval.
- **More imaging:** intraoral photos for the cosmetic Shade agent, and CBCT.
- **Pilot:** a pilot with our client practice using their own de-identified X-rays, with dentist feedback fed back into prompt versions.

## Built with

Next.js · React · TypeScript · Tailwind CSS · Prisma · PostgreSQL · Supabase · Vercel · Google Gemini (`@google/genai`) · Model Context Protocol (MCP SDK) · OpenSwarm · zod · Vitest

---

*HouseAI is decision support, not a certified medical device. A licensed dentist reviews and confirms every finding. The demo uses synthetic patient records and publicly licensed, de-identified X-rays.*
