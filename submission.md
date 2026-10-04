# HouseAI Dental: Devpost submission

## Devpost fields

- **Project name:** HouseAI Dental
- **Elevator pitch** (max 200 characters): AI agent swarms read dental X-rays, build the schedule, chase insurance and send follow-ups, all on one patient record, while the dentist signs off on every finding.
- **Team:** Gavin Huang, Justin Thai, Aryn Ni
- **Track:** HealthLink Hackathon 2026 · Track 1 · AI for Clinical Diagnostics
- **Try it out:** [DEMO URL] · https://github.com/ryunzz/HouseAI (the clinic app) · https://github.com/ryunzz/edit (post-op video maker)
- **Video:** [VIDEO URL]
- **Built with:** nextjs, react, typescript, tailwindcss, prisma, postgresql, supabase, vercel, google-gemini, model-context-protocol, openswarm, zod, vitest, bun, ffmpeg, headless-chromium

---

# About the project

## Inspiration

We didn't start from a feature list. We started inside a real cosmetic and general dental practice and interviewed the people who run it: the dentist who owns it, the front desk, and the person who handles insurance. We asked where the day goes, what breaks, and what they'd pay to fix.

**The owner already pays for dental AI, and doesn't fully trust it.** The practice pays **$349 a month for Pearl**, an X-ray AI, and treats its reads as a supplementary check rather than an answer. One model gives one opinion: nothing argues with it, and a box on the image doesn't say why or how sure. That's the gap HouseAI goes after. We don't try to be one better model; we read every X-ray the way a case review works.

### What we heard, and what we built

Paraphrased from our discovery interviews at the practice (October 2026). We kept the asks we could build this weekend; the rest are in What's next.

| Who | What they told us | What we built |
|---|---|---|
| **Dentist, practice owner** | Every patient should get the same care whether or not a given staff member is in that day. Inconsistency comes from human error, not bad intent. | An X-ray second opinion that runs the same way on every scan, with the dentist signing off on every finding; follow-ups and a day-12 reminder that go out on their own |
| **Front desk** | The practice software can't verify insurance, and confirmation calls are still done by hand. | An insurance swarm with one agent per question, so verification runs without a person on the phone; calendar auto-fill that books around unverified insurance |
| **Insurance coordinator** | Dual coverage is coordinated by hand, and insurer printouts leave out key details such as annual maximums. | Insurance-card OCR with per-field confidence; dual coverage flagged at intake; eligibility lanes that report annual maximum and amount used; a cost split across both insurers |

### What they'd pay for it

We asked the owner how they'd want to buy it. Their answer: **a core package with modular add-ons, billed monthly per location**, the way they already buy Pearl. Our proposed pricing, anchored to what the practice and its peers already pay (Pearl from $299, Weave Pro $249, Adit $159 per location):

| Package | Proposed price | What's in it today |
|---|---|---|
| **Core: Patient Autopilot** | $299 / month | Post-op follow-up emails with a procedure video, day-12 reminders, the patient record |
| **+ Diagnostics** | $149 / month | The multi-agent X-ray second opinion |
| **+ Insurance** | $199 / month | Card OCR, eligibility and coverage lanes, dual coverage, pre-approvals |
| **+ Content Studio** | $399 / month | edit, for the practice's own procedure and post-op videos |

All four: $899 a month, against $1,046 bought separately. These are draft prices for the practice to react to, not signed contracts.

The goal: once an X-ray is taken, everything after it happens without staff re-typing anything, and the dentist stays in charge of every clinical decision. Inside the app, HouseAI is personalized for our client's practice; the public site stays generic so any clinic can try it.

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
7. **Follow-up.** A personalized aftercare email goes out the morning after the visit with a short **post-op video for that exact procedure** (veneers, extraction, root canal, crown seat, whitening, checkup) and a link to book the next check. The videos are made with **edit**, our second repo (see below). It only sends with email consent, and a reminder goes out on day 12 if the patient hasn't booked.

The record then **loops back**: at the next recall X-ray, HouseAI compares the new findings with the last ones, tooth by tooth, and flags what's new, what got worse and what's unchanged.

### Safeguards built in

- **The dentist signs off.** The swarm only suggests; every finding stays "suggested" until a dentist accepts it.
- **Audit log.** Every agent output, every request to the swarm host, and every human accept or reject writes an audit event. Events store hashes, not content.
- **Data minimization.** Agents get the images plus the minimum context. The host interface refuses any request containing names, dates of birth or contact details. Outside production, real patient data is never sent to a model.
- **GDPR.** Consent per purpose, an EU data-residency guard on model calls, and endpoints to export a patient's record or erase it (erasure removes their files too, and the audit trail keeps only a hash of the patient ID).
- **Licence-aware demo.** The public landing page only shows images licensed for commercial use. Clinic uploads never appear there.

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
- **Post-op videos with edit** ([github.com/ryunzz/edit](https://github.com/ryunzz/edit)): we built a second tool so a coding agent can make the procedure videos the follow-up emails send.
  - Each video is a React component driven by the frame number. edit renders it to MP4 **on our own machine** with headless Chromium and ffmpeg, so patient-facing content never goes through a third-party video service.
  - The agent works through edit's MCP tools: it renders single frames and contact sheets to **check its own work**, reads timing from audio beat analysis, and queues the final render.
  - A local studio shows a live preview, timeline, assets and renders. Renders are deterministic (no timers or `Math.random()`), so a re-render of the same video is frame-for-frame identical.
  - Each procedure gets one video in HouseAI's video library, and the follow-up email picks the one that matches the visit.
- **Tests:** 45 Vitest tests. They cover the prioritizer, consensus scoring, the coordinator's timeouts and retries, independent insurance lanes, calendar auto-fill, CSV parsing, follow-up consent, recall comparison, GDPR erasure, and the MCP host round trip against our reference server.

## Challenges we ran into

- **Making failure visible instead of hiding it.** Swarms are only useful if one bad agent doesn't sink the run. Getting timeouts, retries and "skipped because there was no intraoral photo" to show up clearly took real design work, in the coordinator and in the UI.
- **Coordinates on real images.** Models return boxes relative to the image, while the viewer letterboxes every X-ray into a fixed frame. Mapping between the two, and keeping that mapping consistent across uploads, datasets and model output, took a while to get right.
- **Free-tier model limits.** Gemini's free tier allows 20 requests per model per day, and a full seven-agent read uses about seven. We built the mock host and replayable runs so the demo never depends on quota.
- **Image licensing.** Most good dental X-ray datasets are non-commercial. We built licence tracking into the data model so the public site can't show the wrong image by accident.
- **Many hands on one codebase.** Several people and AI coding agents worked in parallel. We coordinated by claiming files and keeping each commit to one complete change.

## Accomplishments that we're proud of

- Every module traces back to something the practice's own staff told us is broken, and the pricing follows the shape the owner asked for. We built what our client said they needed, not what we guessed they'd want.
- The full patient journey works end to end: X-ray, findings, treatment plan, booked schedule, verified insurance, follow-up email and recall.
- It runs with **zero credentials** in mock mode and switches to live models or a remote OpenSwarm host with a config change.
- A Skeptic agent and agreement scoring mean the dentist sees *how sure* the swarm is, not just what it thinks.
- Compliance is part of how the system works, not a page in a slide deck.

## What we learned

- Talking to the client first changed what we built. We'd assumed the pitch was "better X-ray AI". The owner already pays for one and treats it as a maybe, so we built a swarm that shows its reasoning, with a Skeptic and a Verifier, instead of chasing a slightly better single model.
- Agent swarms earn their keep when the work naturally splits into independent jobs, like separate insurers or separate specialists, and when one part failing shouldn't stop the rest. Where a rule does the job, a rule is better.
- Validating every model output against a schema, and saving every run, makes AI features debuggable and auditable.
- In healthcare, the hard part isn't getting a model to answer. It's provenance, consent, sign-off and knowing what the system *didn't* check.

## What's next for House AI

- **Pilot with our client:** run HouseAI on their real schedule and their own de-identified X-rays, at the modular pricing the owner asked for, with their feedback going into new prompt versions.
- **The asks we haven't built yet:** automated appointment-confirmation calls, payment links, and an extension for their practice software (EagleSoft) so verification happens where the front desk already works.
- **OpenSwarm host:** connect the real OpenSwarm desktop app behind our MCP contract. The client side and a reference server are done.
- **Real integrations:** insurer portals, Dentrix as well as EagleSoft, and an email provider, with the practice's approval.
- **More imaging:** intraoral photos for the cosmetic Shade agent, and CBCT.
- **More post-op videos:** one for every procedure in the practice's fee schedule, made with edit in the clinic's branding.

---

*HouseAI is decision support, not a certified medical device. A licensed dentist reviews and confirms every finding. The demo uses synthetic patient records and publicly licensed, de-identified X-rays.*
