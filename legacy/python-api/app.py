"""
FastAPI Backend for HouseAI Dental Intelligence Platform
Tailored for the Cosmetic & Restorative Dentist with Multi-Agent Swarm Analysis,
File/X-Ray/Text Wall Ingestion, Insurance CDT Parsing, and Priority-Colored Dental Calendar.
All outputs are strictly simulated for hackathon demonstration.
"""

from __future__ import annotations

import base64
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Literal

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from schemas import (
    DentalIntakeInput,
    DentalDiagnosticResponse,
    CalendarEvent,
    CalendarEventCreate,
    PatientInput,
)
from agents import (
    DentalSwarmEngine,
    DENTAL_URGENCY_LEVELS,
    DEMO_DISCLAIMER,
)

app = FastAPI(
    title="HouseAI Dental Intelligence API",
    description="Multi-agent cosmetic and general dentistry triage, multimodal X-ray/photo analysis, and priority calendar.",
    version="1.0.0",
)

# Enable CORS so frontend applications (Streamlit, React, Next.js, Vite) can connect seamlessly
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = DentalSwarmEngine()


# ==============================================================================
# MOCK DENTAL DIRECTORY & CLINICAL PREPARATION
# ==============================================================================

MOCK_DENTAL_DIRECTORY = {
    "Cosmetic & Restorative Dentistry": [
        {"doctor_name": "Dr. Julian Vance, DDS", "location": "Aesthetic Suite · Operatory 1"},
        {"doctor_name": "Dr. Camille Dupont, DMD", "location": "Smile Design Center · Operatory 2"},
    ],
    "Orthodontics & Clear Aligners": [
        {"doctor_name": "Dr. Marcus Sterling, DDS, MS", "location": "Studio Ortho · Operatory 3"},
    ],
    "Endodontics (Root Canal Therapy)": [
        {"doctor_name": "Dr. Elena Rostova, DDS", "location": "Micro-Endodontic Suite · Operatory 4"},
    ],
    "Periodontics & Gum Aesthetics": [
        {"doctor_name": "Dr. Tariq Al-Mansoor, DMD", "location": "Periodontal Wellness · Operatory 5"},
    ],
    "General Dentistry & Hygiene": [
        {"doctor_name": "Dr. Sarah Jenkins, DDS", "location": "Preventive Care · Operatory 6"},
    ],
    "Emergency Dentistry": [
        {"doctor_name": "Dr. Julian Vance, DDS", "location": "Rapid Care Operatory · Urgent Bay"},
    ],
}

DENTAL_PREP_BY_SPECIALTY = {
    "Cosmetic & Restorative Dentistry": "Avoid coffee, dark tea, or red wine 24 hours prior to aesthetic shade matching.",
    "Orthodontics & Clear Aligners": "Bring your current clear aligner trays and chewies to the appointment.",
    "Endodontics (Root Canal Therapy)": "Take pre-operative pain relievers as directed; avoid chewing on the symptomatic tooth.",
    "Periodontics & Gum Aesthetics": "Avoid vigorous brushing in inflamed quadrant; bring any previous periodontal charting records.",
    "General Dentistry & Hygiene": "Maintain normal brushing routine; list any tooth sensitivity or flossing bleeding areas.",
    "Emergency Dentistry": "Do not apply heat to swollen areas; if an avulsed tooth, keep in whole milk or saline.",
}


def build_mock_dental_schedule() -> List[Dict[str, Any]]:
    """Build dynamic slots for dental providers relative to today's date."""
    today = datetime.now()
    schedule = []
    for specialty, doctors in MOCK_DENTAL_DIRECTORY.items():
        for i, doc in enumerate(doctors):
            offset = i * 2
            available_slots = [
                {"time_slot": f"{today + timedelta(days=1 + offset):%Y-%m-%d} 09:00", "urgency_scores": [4, 5]},
                {"time_slot": f"{today + timedelta(days=2 + offset):%Y-%m-%d} 11:30", "urgency_scores": [3, 4]},
                {"time_slot": f"{today + timedelta(days=4 + offset):%Y-%m-%d} 14:00", "urgency_scores": [1, 2]},
                {"time_slot": f"{today + timedelta(days=7 + offset):%Y-%m-%d} 10:00", "urgency_scores": [1, 2]},
            ]
            schedule.append({**doc, "specialty": specialty, "available_slots": available_slots})
    return schedule


# ==============================================================================
# IN-MEMORY DENTAL CALENDAR STORE
# ==============================================================================

# Seed realistic initial calendar events for the Cosmetic Dentist
_now = datetime.now()
_CALENDAR_STORE: List[CalendarEvent] = [
    CalendarEvent(
        id="evt_101",
        patient_id="P-COSM-01",
        patient_name="Jessica Reynolds",
        procedure="Porcelain Veneers - Tooth Prep & Mockup (#6-#11)",
        category="Cosmetic",
        start_time=f"{_now + timedelta(days=1):%Y-%m-%d}T09:00:00",
        end_time=f"{_now + timedelta(days=1):%Y-%m-%d}T11:30:00",
        duration_minutes=150,
        estimated_price_usd=8400.00,
        operatory="Operatory 1: Cosmetic Studio",
        dentist_name="Dr. Julian Vance, DDS",
        urgency_score=2,
        urgency_level="Cosmetic-Priority",
        urgency_color="#3b82f6",
        notes="Minimally invasive 0.3mm prep; master lab shade target VITA BL2; trial mockup approved by patient.",
        status="confirmed",
    ),
    CalendarEvent(
        id="evt_102",
        patient_id="P-COSM-02",
        patient_name="Michael Chen",
        procedure="Zoom In-Office Laser Teeth Whitening",
        category="Cosmetic",
        start_time=f"{_now + timedelta(days=1):%Y-%m-%d}T13:00:00",
        end_time=f"{_now + timedelta(days=1):%Y-%m-%d}T14:15:00",
        duration_minutes=75,
        estimated_price_usd=650.00,
        operatory="Operatory 2: Laser & Whitening Suite",
        dentist_name="Dr. Camille Dupont, DMD",
        urgency_score=1,
        urgency_level="Elective",
        urgency_color="#10b981",
        notes="In-office power bleaching; fabricate take-home custom touch-up trays with 10% ACP desensitizer.",
        status="confirmed",
    ),
    CalendarEvent(
        id="evt_103",
        patient_id="P-URG-03",
        patient_name="Brandon Cole",
        procedure="Emergency Composite Repair: Fractured Central Incisor (#8)",
        category="Emergency",
        start_time=f"{_now + timedelta(days=1):%Y-%m-%d}T15:00:00",
        end_time=f"{_now + timedelta(days=1):%Y-%m-%d}T16:00:00",
        duration_minutes=60,
        estimated_price_usd=850.00,
        operatory="Operatory 1: Cosmetic Studio",
        dentist_name="Dr. Julian Vance, DDS",
        urgency_score=4,
        urgency_level="Urgent",
        urgency_color="#f97316",
        notes="Traumatic incisal edge fracture before weekend speaking engagement. Nanohybrid aesthetic layer restoration.",
        status="scheduled",
    ),
    CalendarEvent(
        id="evt_104",
        patient_id="P-COSM-04",
        patient_name="Olivia Taylor",
        procedure="Invisalign Digital ClinCheck & Aligner Attachment Delivery",
        category="Orthodontic",
        start_time=f"{_now + timedelta(days=2):%Y-%m-%d}T10:00:00",
        end_time=f"{_now + timedelta(days=2):%Y-%m-%d}T11:00:00",
        duration_minutes=60,
        estimated_price_usd=5500.00,
        operatory="Operatory 3: Studio Ortho",
        dentist_name="Dr. Marcus Sterling, DDS",
        urgency_score=2,
        urgency_level="Cosmetic-Priority",
        urgency_color="#3b82f6",
        notes="Deliver trays 1-4; bond aesthetic tooth-colored composite buttons on upper premolars.",
        status="confirmed",
    ),
    CalendarEvent(
        id="evt_105",
        patient_id="P-COSM-05",
        patient_name="Sophia Martinez",
        procedure="Smile Makeover Consultation & 3D Intraoral Scan",
        category="Consultation",
        start_time=f"{_now + timedelta(days=2):%Y-%m-%d}T14:00:00",
        end_time=f"{_now + timedelta(days=2):%Y-%m-%d}T15:00:00",
        duration_minutes=60,
        estimated_price_usd=250.00,
        operatory="Operatory 1: Cosmetic Studio",
        dentist_name="Dr. Julian Vance, DDS",
        urgency_score=1,
        urgency_level="Elective",
        urgency_color="#10b981",
        notes="Wedding in 6 weeks; aesthetic smile analysis, shade mapping, and diagnostic digital photography.",
        status="scheduled",
    ),
    CalendarEvent(
        id="evt_106",
        patient_id="P-EMERG-06",
        patient_name="David Patel",
        procedure="Acute Odontogenic Pain & Periapical Drainage (#19)",
        category="Emergency",
        start_time=f"{_now + timedelta(days=3):%Y-%m-%d}T08:30:00",
        end_time=f"{_now + timedelta(days=3):%Y-%m-%d}T09:30:00",
        duration_minutes=60,
        estimated_price_usd=1200.00,
        operatory="Operatory 4: Micro-Endodontic Suite",
        dentist_name="Dr. Elena Rostova, DDS",
        urgency_score=5,
        urgency_level="Emergency",
        urgency_color="#ef4444",
        notes="Severe nocturnal throbbing pain and localized swelling; pulpal debridement and antibiotic therapy.",
        status="scheduled",
    ),
]


# ==============================================================================
# API ENDPOINTS
# ==============================================================================

@app.get("/health")
def health_check() -> Dict[str, Any]:
    """Health check endpoint indicating active dental platform status."""
    return {
        "status": "ok",
        "service": "HouseAI Dental Intelligence API",
        "version": "1.0.0",
        "agents": [
            "Dental Triage Nurse Agent",
            "Cosmetic Dentist Specialist Agent",
            "Radiographic & Visual Analyst Agent",
            "Insurance & Billing Agent",
            "Safety Critic Agent"
        ]
    }


@app.get("/api/doctors")
def get_doctors() -> List[Dict[str, Any]]:
    """Expose dental specialists, operatories, and availability."""
    return build_mock_dental_schedule()


@app.post("/api/diagnose")
def diagnose_case(patient: DentalIntakeInput) -> Dict[str, Any]:
    """
    Run HouseAI's dental multi-agent swarm on patient intake data.
    Evaluates concerns, raw text wall, insurance notes, and X-ray/photo inputs.
    """
    try:
        payload = patient.model_dump() if hasattr(patient, "model_dump") else patient.dict()
        result = engine.process_case(payload)
        res_data = result.model_dump() if hasattr(result, "model_dump") else result.dict()
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Dental swarm evaluation failed: {exc}") from exc

    urgency_score = res_data.get("urgency_score", 1)
    urgency_tier = res_data.get("urgency_tier", "Elective")
    urgency_color = res_data.get("urgency_color", "#10b981")
    specialty = res_data.get("specialty_required", "Cosmetic & Restorative Dentistry")

    est_price = res_data.get("estimated_price_usd", 8400.00)
    est_duration = res_data.get("estimated_duration_minutes", 150)

    return {
        "report": {
            "case_id": f"DENT-{datetime.now():%y%m%d%H%M%S}",
            "patient_id": patient.patient_id,
            "patient_name": patient.patient_name,
            "age": patient.age,
            "specialty": specialty,
            "concerns": patient.get_effective_concerns(),
            "urgency_score": urgency_score,
            "urgency_tier": urgency_tier,
            "urgency_color": urgency_color,
            "estimated_price_usd": est_price,
            "estimated_price_display": f"${est_price:,.2f}",
            "estimated_duration_minutes": est_duration,
            "provisional_diagnosis": res_data.get("consensus_diagnosis"),
            "treatment_plan": res_data.get("treatment_plan"),
            "imaging_findings": res_data.get("imaging_findings"),
            "confidence_percent": round(res_data.get("confidence_score", 0.94) * 100),
            "disclaimer": res_data.get("demo_notice", DEMO_DISCLAIMER),
        },
        "cosmetic_breakdown": res_data.get("cosmetic_breakdown", {}),
        "insurance_breakdown": res_data.get("insurance_breakdown", {}),
        "agents": [
            {"agent": "Dental Triage Nurse", "role": "Acuity Classification & Urgency Coloring", "status": "Consensus Reached"},
            {"agent": "Cosmetic Dentist Specialist", "role": "Aesthetic Smile Design & Veneer Engineering", "status": "Consensus Reached"},
            {"agent": "Radiographic Analyst", "role": "X-Ray & Enamel Thickness Assessment", "status": "Consensus Reached"},
            {"agent": "Insurance & Billing Agent", "role": "CDT Code & Exclusion Parsing", "status": "Consensus Reached"},
            {"agent": "Safety Critic Agent", "role": "Biological Width & Peer Review Clearance", "status": "Consensus Reached"},
        ],
        "reasoning_log": res_data.get("reasoning_log", []),
        "calendar_recommendation": {
            "recommended_duration_minutes": est_duration,
            "estimated_price_usd": est_price,
            "operatory": "Operatory 1: Cosmetic Studio" if urgency_score <= 2 else "Operatory 4: Urgent Dental Suite",
            "urgency_score": urgency_score,
            "urgency_color": urgency_color,
            "urgency_level": urgency_tier,
        }
    }


# ==============================================================================
# FILE UPLOAD / TEXT WALL / X-RAY MULTIMODAL INGESTION
# ==============================================================================

class TextWallUploadRequest(BaseModel):
    patient_id: Optional[str] = "P-WALL-01"
    patient_name: Optional[str] = "Walk-in Consultation"
    age: Optional[int] = 30
    text_content: str
    image_base64: Optional[str] = None
    image_type: Optional[str] = "xray"


@app.post("/api/intake/upload")
async def upload_intake_file(
    patient_id: str = Form("P-UPLOAD-01"),
    patient_name: str = Form("Consultation Patient"),
    age: int = Form(30),
    concerns: str = Form(""),
    raw_text_wall: str = Form(""),
    file: Optional[UploadFile] = File(None),
) -> Dict[str, Any]:
    """
    Handle direct file uploads:
    - Text files (.txt, .md, .csv) are extracted as raw text walls for insurance / notes.
    - Image files (PNG, JPG, JPEG, WEBP) such as X-rays or smile photos are converted to base64 for Gemini Vision analysis.
    """
    image_base64 = None
    image_type = "smile_photo"
    extracted_text = raw_text_wall or ""

    if file:
        content = await file.read()
        filename = (file.filename or "").lower()

        # Handle image files (X-rays, intraoral scans, smile photos)
        if any(filename.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".webp", ".bmp"]):
            mime = "image/png" if filename.endswith(".png") else "image/jpeg"
            image_base64 = base64.b64encode(content).decode("utf-8")
            image_type = "xray" if any(w in filename for w in ["xray", "rad", "pa", "bitewing", "pano"]) else "smile_photo"
        else:
            # Handle text, markdown, or unstructured policy documents
            try:
                decoded_str = content.decode("utf-8")
                extracted_text = f"{extracted_text}\n{decoded_str}".strip()
            except Exception:
                pass

    intake_input = DentalIntakeInput(
        patient_id=patient_id,
        patient_name=patient_name,
        age=age,
        concerns=concerns or "Consultation from uploaded clinical file.",
        raw_text_wall=extracted_text,
        image_data=image_base64,
        image_type=image_type,
    )

    return diagnose_case(intake_input)


@app.post("/api/intake/parse-text-wall")
def parse_text_wall(request: TextWallUploadRequest) -> Dict[str, Any]:
    """Convenience JSON endpoint to parse a raw text wall (notes, emails, insurance paste)."""
    intake_input = DentalIntakeInput(
        patient_id=request.patient_id or "P-WALL-01",
        patient_name=request.patient_name or "Consultation Patient",
        age=request.age or 30,
        concerns="Aesthetic & clinical evaluation from pasted notes",
        raw_text_wall=request.text_content,
        image_data=request.image_base64,
        image_type=request.image_type or "xray",
    )
    return diagnose_case(intake_input)


# ==============================================================================
# COSMETIC DENTIST CALENDAR MANAGEMENT ENDPOINTS
# ==============================================================================

@app.get("/api/calendar/events", response_model=List[CalendarEvent])
def get_calendar_events(
    category: Optional[str] = None,
    min_urgency: Optional[int] = None,
) -> List[CalendarEvent]:
    """
    Retrieve all appointments for the dentist's calendar.
    Returns urgency scores (1-5), urgency colors, procedures, and operatories.
    """
    events = _CALENDAR_STORE
    if category:
        events = [e for e in events if e.category.casefold() == category.casefold()]
    if min_urgency is not None:
        events = [e for e in events if e.urgency_score >= min_urgency]
    return sorted(events, key=lambda e: e.start_time)


@app.post("/api/calendar/events", response_model=CalendarEvent)
def create_calendar_event(event_in: CalendarEventCreate) -> CalendarEvent:
    """Schedule a new dental procedure directly on the cosmetic dentist's calendar."""
    score = event_in.urgency_score or 1
    score = max(1, min(5, score))
    tier_info = DENTAL_URGENCY_LEVELS.get(score, DENTAL_URGENCY_LEVELS[1])

    urgency_color = event_in.urgency_color or tier_info["color"]
    urgency_level = event_in.urgency_level or tier_info["name"]

    try:
        start_dt = datetime.fromisoformat(event_in.start_time.replace("Z", ""))
    except Exception:
        start_dt = datetime.now() + timedelta(days=1, hours=9)

    duration = event_in.duration_minutes or 60
    end_dt = start_dt + timedelta(minutes=duration)

    new_event = CalendarEvent(
        id=f"evt_{datetime.now():%y%m%d%H%M%S}",
        patient_id=event_in.patient_id,
        patient_name=event_in.patient_name,
        procedure=event_in.procedure,
        category=event_in.category or "Cosmetic",
        start_time=f"{start_dt:%Y-%m-%d}T{start_dt:%H:%M:%S}",
        end_time=f"{end_dt:%Y-%m-%d}T{end_dt:%H:%M:%S}",
        duration_minutes=duration,
        estimated_price_usd=event_in.estimated_price_usd or 0.00,
        operatory=event_in.operatory or "Operatory 1: Cosmetic Studio",
        dentist_name=event_in.dentist_name or "Dr. Julian Vance, DDS",
        urgency_score=score,
        urgency_level=urgency_level,
        urgency_color=urgency_color,
        notes=event_in.notes or "Scheduled via HouseAI Dental Platform",
        status="confirmed",
    )
    _CALENDAR_STORE.append(new_event)
    return new_event


@app.get("/api/calendar/events/{event_id}", response_model=CalendarEvent)
def get_calendar_event(event_id: str) -> CalendarEvent:
    """Retrieve details for a specific calendar appointment."""
    for event in _CALENDAR_STORE:
        if event.id == event_id:
            return event
    raise HTTPException(status_code=404, detail=f"Calendar event {event_id} not found.")


@app.delete("/api/calendar/events/{event_id}")
def delete_calendar_event(event_id: str) -> Dict[str, Any]:
    """Cancel or remove an appointment from the dentist's calendar."""
    global _CALENDAR_STORE
    initial_len = len(_CALENDAR_STORE)
    _CALENDAR_STORE = [e for e in _CALENDAR_STORE if e.id != event_id]
    if len(_CALENDAR_STORE) == initial_len:
        raise HTTPException(status_code=404, detail=f"Calendar event {event_id} not found.")
    return {"status": "success", "message": f"Appointment {event_id} removed from calendar."}


@app.patch("/api/calendar/events/{event_id}", response_model=CalendarEvent)
def update_calendar_event(event_id: str, updates: Dict[str, Any]) -> CalendarEvent:
    """Update appointment details (e.g. rescheduling, status change, notes)."""
    for i, event in enumerate(_CALENDAR_STORE):
        if event.id == event_id:
            data = event.model_dump() if hasattr(event, "model_dump") else event.dict()
            data.update(updates)
            updated = CalendarEvent(**data)
            _CALENDAR_STORE[i] = updated
            return updated
    raise HTTPException(status_code=404, detail=f"Calendar event {event_id} not found.")
