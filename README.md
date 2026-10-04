# HouseAI: Cosmetic & Restorative Dental Intelligence Platform

HouseAI is an intelligent multi-agent platform designed specifically for cosmetic and restorative dentists. It combines an autonomous 5-agent dental clinical swarm, multimodal X-ray and photo evaluation via Google Gemini Pro, raw text wall and insurance parsing, and an urgency-colored dental calendar.

---

## Architecture: The 5-Agent Dental Swarm

HouseAI runs an orchestrated agent swarm where each agent focuses on a distinct dental discipline:

1. **Dental Triage Nurse Agent**: Evaluates patient concerns, differentiates between elective aesthetic wishes (veneers, whitening, bonding) versus acute dental pathology/infection, and assigns the initial clinical urgency score (1 to 5) and hex color.
2. **Cosmetic Dentist Specialist Agent**: Evaluates smile design aesthetics, tooth proportions, shade selection (VITA Bleach Shades BL1 to BL4), minimally invasive prep thickness (0.3mm to 0.5mm), e.max lithium disilicate vs feldspathic porcelain, and clear aligner sequencing.
3. **Radiographic & Visual Analyst Agent**: Evaluates dental X-rays (periapical, bitewing, panorex, CBCT) and intraoral smile photographs using Google Gemini Pro Vision to assess biological width, alveolar bone levels, and enamel bonding substrate.
4. **Insurance & Billing Agent**: Parses unstructured text walls and insurance documents to extract carriers, CDT billing codes (e.g. D2962, D9972, D8090, D2740), cosmetic exclusion clauses, and patient financing options.
5. **Safety Critic Agent**: Acts as the senior clinical peer-reviewer, checking for contraindications (active periodontal pocketing, severe nocturnal bruxism requiring nightguards) and finalizing the consensus urgency score and color badge.

---

## Clinical Urgency Scoring & Calendar Hex Colors

Every case and calendar appointment is classified with an urgency score and corresponding color for high-visibility visual scheduling:

| Score | Tier | Hex Color | Clinical Description | Example Procedures |
|---|---|---|---|---|
| **1** | **Elective** | `#10b981` (Green) | Purely elective cosmetic enhancement | In-office Zoom whitening, cosmetic consultation, aesthetic mock-up |
| **2** | **Cosmetic-Priority** | `#3b82f6` (Blue) | Scheduled aesthetic restorative or aligner refinement | Porcelain veneers prep/seat, Invisalign attachment delivery, cosmetic crown |
| **3** | **Moderate** | `#f59e0b` (Yellow) | Routine general restorative or hygiene | Composite filling replacement, prophy, localized gingivitis review |
| **4** | **Urgent** | `#f97316` (Orange) | Urgent aesthetic disruption or localized pain | Fractured front central incisor, broken veneer before an event, dislodged crown |
| **5** | **Emergency** | `#ef4444` (Red) | High-acuity dental infection or acute trauma | Periapical abscess, severe throbbing pain, facial swelling, avulsed tooth |

---

## API Endpoints for Frontend Integration

### 1. Multi-Agent Dental Diagnosis
- `POST /api/diagnose`
  - Input JSON: `DentalIntakeInput` (`patient_id`, `patient_name`, `age`, `concerns`, `raw_text_wall`, `insurance_notes`, `image_data`, `image_type`)
  - Output: Complete report with:
    - `urgency_score` (1-5) and `urgency_color` (hex color)
    - `estimated_price_usd` and `estimated_price_display` (e.g. `$8,400.00`)
    - `estimated_duration_minutes` (e.g. `150`)
    - `treatment_plan` and `provisional_diagnosis`
    - `cosmetic_breakdown` (aesthetic goals, shade recommendation, chair time, fees)
    - `insurance_breakdown` (CDT codes, patient out-of-pocket responsibility, coverage status)
    - `calendar_recommendation` (pre-computed slot recommendation with duration, fee, and operatory)
    - `reasoning_log` (transcripts from all 5 agents)

### 2. File Upload & Text Wall Ingestion
- `POST /api/intake/upload`
  - Accepts multipart file upload:
    - Text files (`.txt`, `.md`, `.csv`) parsed as clinical notes and insurance text.
    - Image files (`.png`, `.jpg`, `.jpeg`, `.webp`) converted to base64 for Gemini Vision X-ray or smile photograph analysis.
- `POST /api/intake/parse-text-wall`
  - JSON endpoint for pasting unstructured consultation emails, insurance summaries, or notes.

### 3. Cosmetic Dentist Calendar API
- `GET /api/calendar/events`
  - Retrieve all appointments. Supports query filtering: `?category=Cosmetic` or `?min_urgency=3`.
  - Each event includes `id`, `patient_name`, `procedure`, `category`, `start_time`, `end_time`, `duration_minutes`, `estimated_price_usd`, `operatory`, `urgency_score`, `urgency_level`, `urgency_color`, and `status`.
- `POST /api/calendar/events`
  - Book a new dental procedure with automated duration, procedure pricing, operatory assignment, urgency score, and color badge.
- `GET /api/calendar/events/{event_id}`
  - Fetch appointment details.
- `PATCH /api/calendar/events/{event_id}`
  - Reschedule appointment time or update status (`confirmed`, `in_progress`, `completed`, `cancelled`).
- `DELETE /api/calendar/events/{event_id}`
  - Remove/cancel an appointment.

### 4. Specialists & Health Checks
- `GET /api/doctors`
  - Dental specialist directory, operatory suites, and upcoming available slots.
- `GET /health`
  - Status indicator returning active agents.

---

## Local Setup & Execution

### 1. Install Dependencies
```powershell
python -m pip install -r requirements.txt
```

### 2. Configure Google Gemini Pro (Optional)
To enable live cloud LLM reasoning and multimodal vision:
1. Copy `.env.example` to `.env`.
2. Add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-1.5-pro
   ```
*(If no API key is provided, HouseAI automatically falls back to its deterministic dental clinical decision tree, ensuring zero downtime during presentations.)*

### 3. Start the Backend API
```powershell
python -m uvicorn app:app --reload --port 8000
```
- Interactive Swagger documentation and API playground: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

### 4. Run Verification Suite
```powershell
python test_house_ai.py
python House_AI.py
```

---

## Safety and Limitations

All analysis and appointment records are synthetic demonstrations created for hackathon review. HouseAI is not a certified medical device and does not provide clinical diagnoses. Licensed dental practitioner evaluation and clinical judgment are required for all patient care decisions.
