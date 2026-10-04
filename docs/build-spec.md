# Build HouseAI Dental in this repo

You're working in a GitHub Codespace on a project I'm already building. Build **HouseAI Dental**, a web app for dental clinics that takes a patient from X-ray to follow-up in one record. AI agents ("swarms") do the legwork, and the dentist approves every clinical finding.

This prompt is the full spec, including an exact design spec. The UI must match it: same layout, colours, sizes, copy and sample data. If a `design/` folder exists in the repo, its `.dc.html` files are the original mockups and win any conflict with this text. They're plain HTML: open them in the browser or read them.

---

## 0. Before writing code

1. Look at the repo: framework, package manager, folders, existing auth and DB. **Fit into what's there.** If the repo is empty, or has no web framework, use the default stack in section 1.
2. Show me a short plan: where the app lives in the repo, the stack, the data model and the build order. Then start building. Don't wait for approval unless something in the repo conflicts with this spec.
3. This is a Codespace:
   - Bind the dev server to `0.0.0.0` on port 3000, so the forwarded port works.
   - Keep dependencies lean. Don't download large model weights or Docker images.
   - Read secrets from env vars (`GEMINI_API_KEY`, `DATABASE_URL`), which I'll set as Codespaces secrets. Commit a `.env.example`, never a `.env`.
   - With no `GEMINI_API_KEY` set, the app runs in **mock mode**: every model call returns canned responses matching the sample data below. It must run end to end with zero credentials.

## 1. Default stack (only if the repo doesn't already decide this)

- Next.js (App Router) + TypeScript + Tailwind CSS. Use npm, unless the repo uses something else.
- Prisma. SQLite in dev (`file:./dev.db`, no Docker needed), with the schema kept Postgres-compatible.
- Gemini via `@google/genai`, for vision, OCR and email text. Every model call goes through one `lib/llm/` module, with a mock implementation.
- Agent orchestration: write a small coordinator in `lib/swarm/`. Agents run in parallel, each with its own timeout and retries. A merge or consensus step runs at the end. Each agent's run is saved (status, log lines with timestamps, output). No outside agent framework.
- Fonts via `next/font/google`: **Public Sans** (400, 500, 600, 700, 800) and **IBM Plex Mono** (400, 500).
- Tests: Vitest for rules and agents, with mocked model responses.

## 2. Design system (copy exactly)

### Colour tokens
Set these as CSS variables and Tailwind theme colours:

| Token | Hex | Use |
|---|---|---|
| navy | `#0B1F3A` | sidebar, dark "agent" cards, header band |
| navy-2 | `#13335E` | active nav item, sidebar sub-cards, video tiles |
| navy-3 | `#1E3E66` | avatar fill, dividers on navy, "skipped" badge |
| navy-line | `#16304F` | row dividers inside navy panels |
| teal | `#0B7285` | primary accent, primary buttons, logo tile |
| teal-dark | `#075563` | link hover, text on teal-tint |
| cyan | `#7DD3E0` | eyebrow text on navy, active nav icon |
| cyan-2 | `#38BDCF` | "done" dots, heartbeat line, primary-insurer bar |
| cyan-pale | `#A5F3FC` | live dot inside teal pills |
| bg | `#EEF3F8` | app background |
| card | `#FFFFFF` | cards |
| border | `#D9E2EC` | card borders |
| border-soft | `#E6ECF2` | inner dividers |
| row-line | `#EEF2F6` | table and list row dividers |
| subtle | `#F6F9FC` | table headers, card footers |
| btn-border | `#C5D1DE` | secondary button border |
| ink | `#0F1B2D` | main text |
| ink-2 | `#3A4A60` | body text |
| muted | `#52627A` | labels, captions, mono eyebrows |
| muted-2 | `#8FA3BD` | arrows, text on navy |
| on-navy | `#C9D6E8` | body text on navy |
| nav-label | `#6F87A8` | "CLINIC" label in sidebar |

Priority colours (solid / tint bg / tint border / tint text):
- **P1** urgent: `#C2410C` / `#FDEDE3` / `#F3B48F` / `#7C2D12`. Pill text on tint: `#9A3412`.
- **P2** long or high-value: `#0B7285` / `#E3F4F6` / `#8FD0D9` / `#063F48`. Pill text on tint: `#075563`.
- **P3** restorative: `#1A56DB` / `#E8EFFC` / `#A9C1F2` / `#1E3F9A`.
- **P4** routine: `#52627A` / `#F1F5F9` / `#D3DCE6` / `#24324A`. Pill tint bg `#EDF1F5`, text `#3A4A60`.

Allergy chip: bg `#FDECEA`, text `#B42318`, with a warning-triangle icon.

### Type
- Body: Public Sans, colour ink.
- Page title: 30px / 800 / letter-spacing -0.01em.
- Card heading: 16px / 700.
- Eyebrows: IBM Plex Mono, 11–13px, letter-spacing 0.1em, uppercase, colour muted (cyan on navy).
- Mono is also used for: patient IDs, tooth numbers, times, video lengths, agreement scores.

### Shapes and surfaces
- **Card:** white, `1px solid #D9E2EC`, radius 16px, shadow `0 1px 2px rgba(11,31,58,0.05)`. Raised cards add `0 8px 24px rgba(11,31,58,0.05)`.
- **Navy card:** bg navy, radius 16px, shadow `0 10px 30px rgba(11,31,58,0.2–0.25)`.
- **Primary button:** min-height 44px, padding 0 16–18px, radius 10px, bg teal, white text, 14px / 700.
- **Secondary button:** same size, white bg, `1px solid #C5D1DE`, ink text, 14px / 600.
- **Pills:** radius 99px. Priority pill: 11–12px / 700, padding 2–4px × 8–10px. Status badge: 11px / 700, padding 3–4px × 8–9px.
- **Stat icon tile:** 42×42, radius 12px, tinted bg, coloured stroke icon.
- **Icons:** inline stroke SVG, 24-unit viewBox, stroke-width 1.8, round caps and joins. No emoji, no icon fonts. Touch targets are at least 44px.
- **Logo:** a tooth outline. Use this SVG path (white stroke 1.7, round join) on a teal rounded tile (38px with radius 11 in the sidebar, 64px with radius 18 on the Flow header, 32px with radius 9 in the email):
  `M7 3c-2.5 0-4 2-4 4.5 0 3 1.5 4.5 2 7.5.4 2.6 1 6 2.5 6s1.7-3.5 2.5-6c.3-1 1.7-1 2 0 .8 2.5 1 6 2.5 6s2.1-3.4 2.5-6c.5-3 2-4.5 2-7.5C21 5 19.5 3 17 3c-2 0-3 1-5 1S9 3 7 3z`

Icon paths used throughout (24-unit viewBox):
- calendar: `M4 6h16v14H4zM4 10h16M8 3v4M16 3v4`
- shield-check: `M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4`
- mail: `M3 6h18v12H3zM3 7l9 6 9-6`
- swarm (3 nodes): `M12 5a2 2 0 1 0 0 .01M5 17a2 2 0 1 0 0 .01M19 17a2 2 0 1 0 0 .01M12 7v4M12 11l-5.5 5M12 11l5.5 5M7 17h10`
- scan / OCR: `M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 10h8M8 14h5`
- upload: `M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3`
- pulse: `M3 12h4l2-6 4 12 2-6h6`
- warning: `M12 4l9 16H3zM12 10v4M12 17v.01`
- clock: `M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2`
- check: `M5 12l5 5L20 7`
- flow (nav): `M4 6h16M4 12h10M4 18h6`
- dollar: `M12 3v18M16 7H10a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6H7`
- document: `M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6`
- sparkle: `M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z`
- bell: `M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0`
- loop: `M3 12a9 9 0 1 0 3-6.7M3 4v5h5`
- zoom: `M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4M11 8v6M8 11h6`
- contrast: `M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 3v18`
- ruler: `M4 16L16 4l4 4L8 20zM8 12l2 2M11 9l2 2M14 6l2 2`

### Responsive
At 1440px wide, the layout is a 232px sidebar plus fluid main content. Below about 800px the sidebar stacks above the content. Card grids use `repeat(auto-fit, minmax(…, 1fr))` and wrap. Wide tables and the schedule grid scroll horizontally inside their card. The page never scrolls sideways.

## 3. App shell: left sidebar (every screen except Flow)

Navy sidebar, 232px wide, padding 22px 14px, vertical flex with 4px gap. From top to bottom:
1. **Brand:** the logo tile (38px), then "HouseAI" (17px / 800, white) above "Dental clinical suite" (12px, cyan).
2. **"CLINIC" label:** mono, 11px, 0.1em letter-spacing, colour `#6F87A8`.
3. **Nav links:** each is 44px tall, padding 0 12px, radius 10px, 14px text, colour on-navy, with a 20px icon. Items and their icons:
   - Flow (flow)
   - Diagnostics (scan), with a count pill showing **5** open findings
   - Schedule (calendar)
   - Insurance (shield-check), with an orange pill (`#C2410C`) showing **1** lane needing attention
   - Follow-ups (mail)

   **Active item:** bg `#13335E`, white text, weight 600, icon in cyan `#7DD3E0`.
4. **Compliance card**, pushed to the bottom (`margin-top: auto`): bg `#13335E`, radius 12px, padding 14px. "GDPR compliant" (13px / 700, white, with a cyan shield icon), then "EU data residency · audit log on · encrypted at rest" (12px).
5. **Signed-in user:** a 34px round avatar (`#1E3E66`, white initials "DR"), then "Dr. [NAME]" (white, 600) above "[PRACTICE NAME]" (12px).

Main area: padding 24px 32px 40px, vertical flex with an 18–20px gap.

## 4. Screens

Build these as real routes: `/` (Flow), `/diagnostics/[patientId]`, `/schedule`, `/insurance/[patientId]`, `/follow-ups/[followUpId]`. Seed the database so each one shows exactly the sample content below. All content comes from the DB or the swarm runs, not hard-coded JSX.

### 4.1 Flow (`/`): platform overview
This screen has no sidebar. It's a full-width overview page on bg `#EEF3F8`.

**Header band**
- Navy band, padding 44px 64px 40px.
- On the left: the 64px logo tile, then the eyebrow "HOUSEAI DENTAL · CLINICAL FLOW" (mono 13px, cyan) above the H1 "From X-ray to follow-up, one record" (44px / 800 / -0.02em, white).
- On the right, two legend pills:
  - "OpenSwarm agents": teal bg, white text, `#A5F3FC` dot.
  - "Single model call or rules": `#13335E` bg, `#C9D6E8` text, `#93A8C4` dot.
- Decoration: a faint heartbeat line across the bottom of the band, an SVG at opacity 0.35 with stroke `#38BDCF` 2px, using the path `M0 80 H520 L540 80 L556 40 L572 108 L588 20 L604 96 L616 80 H1040 L1056 80 L1068 56 L1080 96 L1092 80 H1600` in a 1600×120 box.

**Body:** padding 40px 64px, 30px gap. There are two rows. Each row starts with an eyebrow: a 24×2px teal bar, then mono 12px text in muted.

Steps are 316px-wide cards with 22px padding and a 12px gap. Each card contains:
- a top row with a 44px icon tile on the left and a tag pill on the right
- the number (mono 13px) next to the title (21px / 700)
- the body (14px, line-height 1.55)
- a footer "Out: …" (13px / 600), above a 1px top rule and pushed to the bottom of the card

Between cards there's a 44px gap holding a 34×14 arrow (stroke `#8FA3BD`).

Two card styles:
- **Plain:** white card, icon tile `#E8EFFC` with a `#1A56DB` icon, tag `#EDF1F5` / `#3A4A60`, number `#52627A`, rule `#E6ECF2`.
- **Swarm:** navy card with white text, icon tile teal with a white icon, tag teal / white, number cyan, body `#C9D6E8`, rule `#1E3E66`, shadow `0 10px 30px rgba(11,31,58,0.25)`.

**Row 1, "BEFORE THE VISIT"**
1. Plain. 01 **Intake** · icon upload · tag "Form · CSV · drop zone". Body: "Add one patient or a whole day at once. Drop in X-rays, intraoral photos, insurance cards and old records." Footer: "Out: patient + files".
2. Plain. 02 **Read documents** · icon scan · tag "OCR + Gemini". Body: "OCR fills in name, date of birth, member ID, group number and carrier. Staff only confirm fields marked low-confidence." Footer: "Out: structured record".
3. **Swarm.** 03 · TRACK 1 **Swarm diagnostics** · icon swarm · tag "OpenSwarm". Body: "Specialist agents each read the X-ray, a skeptic challenges their findings, and a consensus agent explains each finding by tooth number." Footer: "Out: findings + confidence".
4. Plain. 04 **Prioritize** · icon pulse · tag "Rules" · no arrow after it. Body: "Each finding maps to a procedure code, duration and priority. P1 urgent · P2 long / high-value · P3 restorative · P4 routine." Footer: "Out: treatment plan".

**Row 2, "BOOK · VERIFY · BRING BACK"**
5. Plain. 05 **Calendar builder** · icon calendar · tag "Rules". Body: "Fills the whole schedule automatically: long cases in the morning, one emergency slot held, checkups fill the gaps." Footer: "Out: booked day / week".
6. **Swarm.** 06 **Insurance swarm** · icon shield-check · tag "OpenSwarm". Body: "One agent per insurer checks eligibility, chases copay amounts, coordinates dual coverage and files pre-approvals with the X-rays attached." Footer: "Out: patient cost estimate".
7. Plain. 07 **Follow-up** · icon mail · tag "Gemini + template". Body: "A personalized email with a short video for that procedure, sent 24 h after the visit, with a link to book the next check." Footer: "Out: rebooking, retention".

After card 7 comes a dashed connector (stroke-dasharray 3 3). It leads to a **"Loops back"** card: 316px wide, transparent background, `1.5px dashed #8FA3BD` border, radius 16px. It has a teal loop icon and a 16px / 700 title, then the body "At the next recall X-ray, the swarm compares against earlier X-rays and flags what changed."

**Footer strip** (pushed to the bottom of the page): a white card, padding 18px 24px.
- "Shared, compliant layer" in bold, with a teal shield-check icon.
- Then these items separated by `·` in `#A7B4C6`: "One patient record" · "Audit log of every agent decision" · "GDPR: consent, data minimization, EU residency, erasure" · "Dentist signs off on every finding".

Each card links to its screen.

### 4.2 Diagnostics (`/diagnostics/P-1042`): swarm X-ray second opinion

**Patient header card**
- A 48px round avatar: `#E8EFFC` bg, `#1A56DB` initials "JM", weight 800.
- "Jordan M." (18px / 700) above "P-1042 · 34 Y · DOB [DATE]" (mono 12px muted).
- Chips:
  - "Allergy: Penicillin" (allergy style, with a warning icon)
  - "No premedication needed"
  - "Last X-rays 2025-03"

  The last two use bg `#EDF1F5`, text `#3A4A60`, 12px / 600, radius 8px.
- On the right: a secondary button "Upload images" and a primary button "Re-run swarm".

**Two columns** (wrapping): left is flex 999 with a 600px basis, right is flex 1 with a 360px basis, 20px gap.

**Left column, top: X-ray viewer card**
- Bg `#05090F`, radius 16px, big shadow.
- Toolbar (bottom border `#1A2533`):
  - on the left, "PANORAMIC · 2026-10-02 09:12" in mono 12px `#8FA3BD`
  - on the right, three 40px icon buttons (zoom, contrast, ruler), each with bg `#0D1520`, border `#243246` and a `#C9D6E8` icon, plus an `aria-label`
  - a toggle button "AI overlay on" (teal); clicking it hides or shows the overlay
- The image area is 800×400 (scales to width). It shows the patient's uploaded panoramic. For the seed patient, generate a **stylized SVG panoramic** with:
  - a dark radial-gradient background (`#26303C` → `#05090F`)
  - jaw and bone shapes in `#3A4656` at 0.35–0.45 opacity
  - 32 tooth silhouettes in two arches that curve along a smile: universal numbering, upper #1–#16 and lower #32–#17, left to right
  - teeth `#AEB9C6` at 0.62, enamel `#E6ECF2` at 0.55, pulp and canals `#141B25`
  - bright white restorations on #14 (crown) and #30 (filling)
  - dark caries dots on #3 and #19, and a dark lesion at the root tip of #30
  - #32 tilted about 45° and #17 about −30°, sitting deep (impacted)
  - the nerve canals traced as dashed cyan lines (`#7DD3E0`, dasharray 5 4), labelled "nerve canal (traced)"
- **Overlay**, drawn from the findings data (each finding stores a bounding box or point in image coordinates). Labels are mono 11px:
  - #17 and #32: amber box (`#FBBF24`, rx 6), labels "#17 partly bony" and "#32 near canal" in `#FCD34D`
  - #14: blue box (`#60A5FA`), label "#14 open margin" in `#93C5FD`
  - #30: an orange circle (r 18, stroke `#FB923C`, fill `#F97316` at 15%), label "#30 root tip" in `#FDBA74`
  - #3 and #19: small blue circles (r 8), labels "#3" and "#19"
- For real uploads, draw the same overlay on top of the image.

**Left column, middle: "Tooth chart" card**
- Legend on the right with 10px squares: Urgent `#C2410C`, Surgery `#0B7285`, Restorative `#1A56DB`.
- Two 16-column grids (4px gap, min-width 640px, scrolls horizontally): upper row 1→16, lower row 32→17.
- Cells are 34px tall, radius 8px, mono 12px / 600.
- Flagged teeth are filled with their colour and white text: 30 = `#C2410C`; 17 and 32 = `#0B7285`; 14, 3 and 19 = `#1A56DB`.
- Other teeth: bg `#F1F5F9`, text `#52627A`, border `#E2E8F0`.

**Left column, bottom: "Consensus findings" card**
- Header on the right: "6 of 7 agents reported · agreement = reporter + Verifier + Skeptic · dentist review required" (13px muted).
- Table (min-width 680px, scrolls horizontally):
  - Header row: bg `#F6F9FC`, 11px uppercase with 0.08em letter-spacing. Columns: TOOTH | FINDING | AGREEMENT | SUGGESTED | PRIORITY.
  - Tooth column: mono.
  - Agreement column: a 64×6px bar (track `#E6ECF2`) filled in the priority colour, then mono 12px "2/3".
  - Priority column: tint pill.
- Rows:

  | Tooth | Finding | Agree | Suggested | Prio |
  |---|---|---|---|---|
  | #30 | Dark spot at the root tip (likely infection) | 2/3 | D3330 root canal, molar · 75 min (D0220 PA film first) | P1 |
  | #32 | Impacted wisdom tooth (completely bony), roots on the nerve canal | 3/3 | D7240 · 60 min (D0367 CBCT first) | P2 |
  | #17 | Impacted wisdom tooth (partially bony) | 3/3 | D7230 · 45 min | P2 |
  | #14 | Gap at the crown edge (open margin) | 2/3 | D2740 new crown · 90 min, 2 visits | P3 |
  | #3 #19 | Cavities between teeth, into the dentin | 3/3 | D2391 ×2 · 45 min, one visit | P3 |

- Footer (bg `#F6F9FC`), three actions:
  - primary "Accept into treatment plan": creates TreatmentItems and writes audit events
  - secondary "Send to calendar": goes to /schedule
  - secondary "Order periapical film for #30": creates an imaging order

**Right column: "Diagnostic swarm" navy panel**
- Header: "Diagnostic swarm" (17px / 700, white) above "OpenSwarm · Gemini vision · 7 agents" (12px `#8FA3BD`). On the right, a teal pill "Done in 14 s" with a `#A5F3FC` dot (live while running, showing a running state).
- One row per agent, padding 14px 20px, divider `#16304F`. Each row has:
  - a 10px status dot (with a ring `0 0 0 4px rgba(255,255,255,0.06)`)
  - the name (14px / 700, white) and a status badge
  - the scope (12px `#8FA3BD`)
  - the result (13px, line-height 1.5)
- Badge styles:
  - **done:** teal bg, white text
  - **flag:** `#FDEDE3` / `#9A3412`
  - **skip:** `#1E3E66` / `#C9D6E8`
- Dot colours: done `#38BDCF`, flag `#FB923C`, skip `#52627A`.

  | Agent | Scope | Status | Result |
  |---|---|---|---|
  | Caries Scout | Bitewings · cavities between teeth | 2 found (done) | Dentin-level cavities on #3 (side facing #4) and #19 (side facing #20). |
  | Root-Tip Agent | Panoramic · infection at root tips | Flagged (flag) | Dark area around 3 mm at the root tip of #30. Confidence 0.71. |
  | Third-Molar Agent | Panoramic · wisdom teeth, nerve canal | 2 found (done) | #32 roots overlap the nerve canal; recommend a 3D scan (CBCT) before surgery. |
  | Restoration Auditor | Crowns · fillings · root canals | 1 found (done) | Open margin on the #14 crown, near the gumline. |
  | Verifier | Independently re-reads every finding | 5 of 6 confirmed (done) | Confirmed #3, #19, #17, #32 and #30. Could not confirm the #14 margin gap on the panoramic alone. |
  | Skeptic | Challenges every finding | Challenged 1 (flag) | The #30 dark area could be an overlapping shadow. Confirm with a periapical film before treating. |
  | Shade Agent | Intraoral photos · cosmetic | Skipped (skip) | No intraoral photo uploaded. Nothing else was affected. |

- Panel footer: bg `#13335E`, 13px. "The shade agent had no intraoral photo to read, so it was skipped. The other agents still finished, and the consensus notes what wasn't checked." Generate this from what was actually skipped.

**Below both columns:** "Decision support only. The swarm suggests and explains findings, and the dentist confirms each one before it reaches the chart." (13px muted). This line is always shown.

### 4.3 Schedule (`/schedule`): calendar builder

**Page header**
- Eyebrow "TUESDAY · OCT 6" (mono 12px), H1 "Calendar builder".
- On the right: a secondary button "Import CSV / Eaglesoft" and a primary button "Auto-fill week".

**Stat cards** (auto-fit grid, minmax 180px, 12px gap). Each has an icon tile, a value (24px / 800) and a label (13px muted):

| Value | Label | Icon | Colour / tile |
|---|---|---|---|
| 25 | Appointments placed | calendar | `#1A56DB` / `#E8EFFC` |
| 3 | Long cases before noon | clock | `#0B7285` / `#E3F4F6` |
| 1 | Emergency slot held | pulse | `#C2410C` / `#FDEDE3` |
| 3 | Need input | warning | `#9A3412` / `#FDEDE3` |

Compute these from the data.

**Rule chips** (wrap, 8px gap). Each is a pill with bg `#E3F4F6`, text `#075563`, 13px / 600 and a check icon. One chip per active scheduling rule:
- "Long cases (90 min or more) before noon"
- "Hold one P1 emergency slot a day"
- "Checkups fill the afternoon gaps"
- "Insurance verified at least 48 h before"

**Two columns.**

**Left: "Needs input" card** (flex basis 280px)
- Subtitle: "14 imported · 11 placed · 3 blocked".
- One queue item per patient: the patient (bold 14px) with a priority pill on the right, the procedure (13px `#3A4A60`), and the blocker with a warning icon (12px / 600 `#9A3412`):
  - P-1088 · Elena V. — 8-unit veneer prep · 3 h — P2 — "No X-ray from the last 12 months on file"
  - P-1091 · Marcus T. — Implant consult · 45 min — P3 — "Insurance changed: waiting on swarm"
  - P-1093 · Priya S. — Cleaning + exam · 45 min — P4 — "Can only come after 3 pm"
- Footer key (bg `#F6F9FC`, eyebrow "PRIORITY") with solid pills:
  - P1 "Urgent: pain, infection, injury"
  - P2 "Long / high-value: veneers, surgery"
  - P3 "Restorative: fillings, crowns"
  - P4 "Routine: checkups, cleanings"

**Right: day grid card** (flex basis 640px, min-width 760px, scrolls horizontally)
- Column header row (bg `#F6F9FC`): a 64px time gutter, then 3 provider columns. Each has a 30px navy round avatar with initials (11px / 700), the name (13px / 700) and the chair (12px muted):
  - LD "Dr. [LEAD]" — Chair 1 · cosmetic
  - AS "Dr. [ASSOCIATE]" — Chair 2 · surgery
  - HY "[HYGIENIST]" — Hygiene
- **8 am to 5 pm, 72px per hour** (648px tall). Hour labels are mono 11px muted, right-aligned in the gutter. Hour lines are 1px `#EEF2F6`, and column dividers are 1px `#EEF2F6`.
- **Lunch 12–1 pm** in every column: a diagonal stripe pattern (`#F6F9FC` / `#EDF2F7`, 6px stripes) with "LUNCH" in mono 11px `#8FA3BD`.
- **Appointment block**: absolutely positioned, inset 6px left and right, `top = (start − 8) × 72 + 2`, `height = duration × 72 − 4`. Padding 7px 10px, radius 9px. Bg, border and text use the priority tint colours. Contents: the title (13px / 700) with a solid priority pill on the right, then the meta (12px, opacity 0.85).
- **Emergency hold**: white bg, **dashed** `#F3B48F` border, text `#9A3412`, P1 pill.
- Seed day (start–end in decimal hours, title, meta, priority):
  - **Chair 1:**
    - 8–11 Porcelain veneers ×8 · "P-1077 · #5–#12 · [$ VALUE]" · P2
    - 11–11.5 **Emergency hold** · "Released at 10:30 if unused" · HOLD
    - 11.5–12 Crown seat #14 · P-1042 · P3
    - 13–13.75 Composite #3, #19 · "P-1042 · from swarm" · P3
    - 13.75–14 Checkup P-1101 · P4
    - 14–14.25 Checkup P-1102 · P4
    - 14.5–15.5 Smile design consult · "P-1110 · cosmetic" · P3
    - 15.5–15.75 Checkup P-1104 · P4
    - 16–16.25 Post-op check P-1061 · P4
  - **Chair 2:**
    - 8–9.5 Wisdom teeth #17, #32 · "P-1042 · CBCT done" · P2
    - 9.5–10.75 Root canal #30 · "P-1042 · after PA film" · P1
    - 10.75–12 Implant placement #19 · P-0988 · P2
    - 13–13.5 Filling #30 (temporary) · P-1095 · P3
    - 13.5–13.75 Checkup P-1106 · P4
    - 14–15 Crown prep #3 · P-1032 · P3
    - 15–15.25 Checkup P-1107 · P4
    - 15.5–16.5 Whitening · "P-1112 · cosmetic" · P3
  - **Hygiene:**
    - 8–8.75 Cleaning + exam P-1080 · P4
    - 8.75–9.5 Cleaning + exam P-1081 · P4
    - 9.5–10.5 Deep cleaning (SRP) · "P-1066 · bone loss" · P3
    - 10.5–11.25 Cleaning + exam P-1083 · P4
    - 11.25–12 Cleaning + exam P-1084 · P4
    - 13–13.75 Cleaning + exam P-1085 · P4
    - 13.75–14.5 Cleaning + exam P-1086 · P4
    - 14.5–15.25 Cleaning + bitewings P-1087 · P4
    - 15.25–16 Cleaning + exam P-1089 · P4

**Auto-fill** is a pure, unit-tested function. Inputs: treatment items (code, duration, priority, patient constraints), providers and chairs with their skills, existing bookings and rules. Output: placed blocks plus an unplaced list with reasons. The rules:
- cases of 90 minutes or more go before noon
- one P1 hold a day, at 11:00–11:30, released at 10:30
- P4 checkups fill the afternoon gaps
- a procedure requiring insurance can't be placed less than 48 h out unless verification is done
- respect patient time windows and the imaging prerequisites (no X-ray within 12 months → blocked)

**CSV import:** columns patient_id, name, procedure_code, duration_min, priority, earliest, latest.

### 4.4 Insurance (`/insurance/P-1091`): insurance swarm

**Patient header card**
- A 48px avatar with "MT" (same colours as before), then "Marcus T." above "P-1091 · changed jobs 2026-09 · card scanned 09:40" (mono 12px).
- Chips: "Dual coverage", "Implant #19 planned".
- On the right, a navy pill: "OpenSwarm · 5 agents · 1 retrying", with a `#38BDCF` dot.

**Agent lane cards** (auto-fit grid, minmax 300px, 16px gap). Each white card has:
- a 40px icon tile, the name (15px / 700) and the target (12px muted), and a status badge
- a vertical timeline: 10px dots joined by a 2px `#E6ECF2` line; each entry has a mono 12px time and 13px text

Badge styles:
- **Running:** `#E8EFFC` / `#1E3F9A`
- **Verified / Submitted:** `#E3F4F6` / `#075563`
- **Retry:** `#FDEDE3` / `#9A3412`

A failing lane gets a **2px `#F3B48F` border**, a `#FDEDE3` icon tile and orange dots (`#C2410C`). Default dots are teal. The Coordinator's dots are blue `#1A56DB`.

| Lane | Target | Status | Icon tile | Log |
|---|---|---|---|---|
| Coordinator | Splits the job, merges results | Running | navy tile, cyan swarm icon | 09:40 Card OCR found 2 carriers · 09:40 Started 4 agents · 09:52 Merged Carrier A result |
| Eligibility · Carrier A | New employer PPO · portal | Verified | `#E3F4F6`, teal shield | 09:41 Portal login ok · 09:43 Active since [DATE] · 09:44 Annual max [$], [$] used |
| Eligibility · Carrier B | Spouse plan (secondary) · portal | Retry 14:00 | `#FDEDE3`, orange warning | 09:41 Portal timeout (30 s) · 09:46 Timeout again · 09:47 Next try: phone line at 14:00 |
| Copay Chaser | Coverage % by procedure code | Verified | teal tile, dollar icon | 09:45 D2740 crown: 50% · 09:45 D6010 implant: 50% after pre-approval · 09:46 Waiting period: none |
| Pre-approval Agent | Implant #19 · attaches X-rays | Submitted | teal tile, document icon | 09:48 Narrative from swarm findings · 09:49 Attached pano + bitewings · 09:50 Submitted · ref [#] |

**Bottom row**, wrapping:

*Cost split card* (navy, flex 2, 520px basis)
- Eyebrow "IMPLANT #19 · COST SPLIT (ESTIMATE)" (mono 11px cyan).
- The amount "[$ AMOUNT]" (34px / 800, white), followed by "patient pays" (15px / 500 `#8FA3BD`).
- On the right, "Updates when Carrier B responds" (12px).
- A 14px rounded bar, split with 2px gaps:
  - primary: solid `#38BDCF`
  - secondary (pending): diagonal stripes `#1E3E66` / `#2A5285`
  - patient: white
- Legend with 10px squares:
  - "Carrier A (primary) · verified"
  - "Carrier B (secondary) · pending"
  - "Patient"
- Calculate it from the coverage results and coordination of benefits.

*Explainer card* (white, flex 1, 300px basis)
- Title "Why a swarm and not a script", with a teal swarm icon.
- Text: "Carrier B's portal timed out, so only that lane is retrying. Carrier A's result and the pre-approval went through unaffected." Generate this from the run.

Lanes are independent: a timeout or retry in one lane must never block the others. Each lane uses a mock carrier adapter by default (Carrier B simulates timeouts in seed mode).

### 4.5 Follow-ups (`/follow-ups/[id]`): email + video

The layout is two columns: the email preview on the left (flex 999, 560px basis) and the side panel on the right (flex 1, 320px basis).

**Left column**
- Top bar: the eyebrow "PREVIEW · SENDS WED 9:00 AM · P-1077", then a secondary button "Send test" and a primary button "Approve and schedule".
- **Email card** (white, radius 16px):
  1. Header strip (bg `#F6F9FC`, 13px muted): "From: Dr. [NAME] <care@[practice].com>", "To: Elena V.", then the subject "Your new veneers: what to expect this week" (17px / 700, ink).
  2. Navy brand bar (padding 18px 32px): the 32px logo tile, "[PRACTICE NAME]" (white / 700), and on the right "Aftercare · Day 1" (12px cyan).
  3. Body (padding 28px 32px, max-width 640px, 18px gap):
     - Text (16px, line-height 1.6): "Hi Elena, thank you for coming in yesterday. Your eight porcelain veneers (#5–#12) are bonded, and I recorded a short video on caring for them."
     - **Video tile**: 16:9, radius 14px, bg `#13335E`.
       - A faint heartbeat line across it (`#38BDCF`, opacity 0.25).
       - Top left: "[ VIDEO · DR. [NAME] · 0:58 ]" (mono 12px cyan).
       - Centre: a 76px white circular play button with a teal triangle and a ring `0 0 0 10px rgba(255,255,255,0.15)`.
       - Bottom left: "Caring for new veneers: the first 14 days" (15px / 600, white).
     - **Tips box** (bg `#F6F9FC`, border `#E6ECF2`, radius 12px): the heading "For the next few days", then three items, each with a teal check:
       - "Mild sensitivity to cold is normal and usually fades within a week."
       - "Avoid biting hard foods (ice, nuts, pens) with your front teeth."
       - "Floss normally. The edges are sealed."
     - CTA button "Book your 2-week check" (teal, with a calendar icon, 46px tall).
     - Footer (13px muted): "Questions? Reply to this email or call [PHONE]. You're receiving this because of your visit on Oct 6." followed by an "Email preferences" link.

**Right column**
- *"Automation" card*. Each row has a 34px tile (`#E3F4F6`, teal icon), a key (12px muted) and a value (600):
  - Trigger: "Procedure completed + 24 h" (clock)
  - Personalized by: "Gemini, from chart + visit notes" (sparkle)
  - Reminder: "Day 12 if not booked" (bell)
  - Consent: "Opted in · GDPR record #[ID]" (shield-check)
- *"Video library by procedure" card*. Each row has a 52×32 navy thumbnail with a white play icon, the procedure name, and the length (mono 12px):
  - Porcelain veneers 0:58
  - Wisdom tooth extraction 1:12
  - Root canal 0:47
  - Crown seat 0:40
  - Whitening 0:35
  - Checkup + cleaning 0:25

The email is real: Gemini writes it from the chart and visit notes, with a template fallback in mock mode. It's rendered as HTML that's safe for email clients, matching this design. Sending goes through a mail adapter (it logs to the console in dev). It only sends if consent is on.

## 5. Data model (Prisma)

Models:
- Patient (id like "P-1042", name, dob, allergies, flags)
- Consent (patient, purpose: treatment | ai_analysis | marketing_email, granted, timestamp)
- ImagingStudy (patient, type: pano | bitewing | pa | cbct | intraoral, takenAt, fileUrl)
- SwarmRun (kind: diagnostic | insurance, patient, status, startedAt, finishedAt)
- AgentRun (run, name, scope, status, badge, result, log JSON, model, promptVersion)
- Finding (run, teeth[], text, agreement, cdtCode, durationMin, priority, prerequisite, overlay geometry, status: suggested | accepted | rejected)
- TreatmentItem
- Provider (name, initials, chair, skills)
- Appointment (provider, patient, start, end, title, meta, priority, isHold)
- InsurancePolicy (carrier, memberId, groupNumber, primary/secondary)
- CostEstimate
- FollowUp (patient, procedure, scheduledFor, subject, html, videoId, status)
- Video (procedure, length, url)
- AuditEvent (actor: user | agent name, action, inputs/outputs hash, model, timestamp)

Seed it so every screen above looks exactly as described.

## 6. Agents and compliance

- Keep the agent prompts in versioned files under `agents/`. Each agent returns typed JSON validated with zod.
- Diagnostic consensus: a finding's agreement is reporter + Verifier + Skeptic out of 3. Skipped agents are listed in the summary.
- Every agent output and every human accept or reject writes an AuditEvent.
- GDPR: consent per purpose, data minimization (models get only the images plus the minimum context), configurable data residency, export and erasure endpoints, and files encrypted at rest. Never send real patient data to a model in dev or tests.
- Placeholders stay literal: [NAME], [PRACTICE NAME], [$ VALUE], [$ AMOUNT], [DATE], [PHONE], [ID], [#]. Don't invent prices or clinical statistics.

## 7. Build order (commit after each, with tests)

1. Scaffold (or fit into the existing app). Then the design tokens, fonts, the sidebar shell, and the Flow page, pixel-matched.
2. Prisma schema + seed.
3. Diagnostics screen from seed data, then the swarm coordinator and the 7 agents (mock first, then Gemini).
4. Prioritizer rules, plus Accept into treatment plan.
5. Schedule screen, the auto-fill algorithm, and CSV import.
6. Insurance screen and the insurance swarm with independent lanes.
7. Follow-up screen, email generation, the scheduler, and the day-12 reminder.
8. Intake (form, CSV, drop zone) and card OCR with per-field confidence.
9. Recall comparison against earlier studies.

After each step:
- run the app on port 3000
- check every screen against this spec at 1440px and at 390px wide
- fix any drift in spacing, colour or copy before moving on

Ask me before adding paid services or real integrations: Eaglesoft/Dentrix, insurer portals, an email provider.
