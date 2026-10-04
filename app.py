"""FastAPI adapter for the HouseAI simulated diagnostic engine and demo scheduler."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from House_AI import PatientInput, run_diagnostic_pipeline

app = FastAPI(
    title="HouseAI Demo API",
    description="Simulated hackathon diagnostic workflow and mock appointment scheduler.",
    version="0.1.0",
)

URGENCY_TO_TIER = {"Routine": 1, "Moderate": 2, "High": 3}
TIER_TO_LABEL = {1: "Routine", 2: "Soon", 3: "Priority"}

# Mock doctor directory. Slots are generated relative to today's date so they
# remain in the future when the demo is run on a different day.
MOCK_DOCTOR_DIRECTORY = {
    "Cardiology": [
        {"doctor_name": "Dr. Maya Chen", "location": "North Clinic · Suite 210"},
        {"doctor_name": "Dr. Luis Romero", "location": "Downtown Medical · Floor 4"},
    ],
    "Pulmonology": [
        {"doctor_name": "Dr. Priya Shah", "location": "North Clinic · Suite 320"},
        {"doctor_name": "Dr. Evan Brooks", "location": "Riverside Health · Room 18"},
    ],
    "Neurology": [
        {"doctor_name": "Dr. Aisha Patel", "location": "North Clinic · Suite 305"},
        {"doctor_name": "Dr. David Kim", "location": "Downtown Medical · Floor 5"},
    ],
    "Gastroenterology": [
        {"doctor_name": "Dr. Sofia Rivera", "location": "Riverside Health · Room 22"},
        {"doctor_name": "Dr. Owen Clarke", "location": "Downtown Medical · Floor 3"},
    ],
    "Nephrology": [
        {"doctor_name": "Dr. Amara Okafor", "location": "North Clinic · Suite 240"},
        {"doctor_name": "Dr. Henry Park", "location": "Riverside Health · Room 9"},
    ],
    "Infectious Disease": [
        {"doctor_name": "Dr. Elena Flores", "location": "Downtown Medical · Floor 6"},
        {"doctor_name": "Dr. Marcus Reed", "location": "North Clinic · Suite 410"},
    ],
    "Internal Medicine": [
        {"doctor_name": "Dr. Evelyn Brooks", "location": "North Clinic · Suite 105"},
        {"doctor_name": "Dr. Samuel Wright", "location": "Riverside Health · Room 4"},
    ],
}

PREP_BY_SPECIALTY = {
    "Cardiology": "Bring your medication list and any relevant heart test results.",
    "Pulmonology": "Bring your medication list and any recent breathing or imaging test results.",
    "Neurology": "Bring your medication list and any relevant imaging or test results.",
    "Gastroenterology": "Bring your medication list and any relevant lab or imaging results.",
    "Nephrology": "Bring recent lab results and your current medication list.",
    "Infectious Disease": "Bring relevant lab results and your current medication list.",
    "Internal Medicine": "Bring your medication list and any relevant health records or questions.",
}


class ScheduleRequest(BaseModel):
    """Scheduler input. Values come from diagnostic analysis, not patient form choices."""

    urgency_tier: Literal[1, 2, 3]
    specialty: str = Field(min_length=2, max_length=80)


class Appointment(BaseModel):
    doctor_name: str
    time_slot: str
    location: str
    prep_instructions: str
    urgency_tier: int
    specialty: str
    scheduling_priority: str


def build_mock_schedule() -> list[dict]:
    """Return JSON-style provider/slot state for the hackathon demonstration."""
    today = datetime.now().date()
    schedule = []
    for specialty, doctors in MOCK_DOCTOR_DIRECTORY.items():
        for doctor_index, doctor in enumerate(doctors):
            offset = doctor_index
            available_slots = [
                {"time_slot": f"{today + timedelta(days=1 + offset):%Y-%m-%d} 09:00", "urgency_tiers": [3]},
                {"time_slot": f"{today + timedelta(days=2 + offset):%Y-%m-%d} 11:00", "urgency_tiers": [2, 3]},
                {"time_slot": f"{today + timedelta(days=4 + offset):%Y-%m-%d} 10:30", "urgency_tiers": [2, 3]},
                {"time_slot": f"{today + timedelta(days=7 + offset):%Y-%m-%d} 13:30", "urgency_tiers": [1, 2]},
                {"time_slot": f"{today + timedelta(days=10 + offset):%Y-%m-%d} 09:30", "urgency_tiers": [1]},
            ]
            schedule.append({**doctor, "specialty": specialty, "available_slots": available_slots})
    return schedule


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok", "service": "HouseAI Demo API"}


@app.get("/api/doctors")
def get_doctors() -> list[dict]:
    """Expose the mock JSON-style doctor and availability directory."""
    return build_mock_schedule()


@app.post("/api/diagnose")
def diagnose_case(patient: PatientInput) -> dict:
    """Run HouseAI's simulated agent pipeline and adapt it for the dashboard."""
    try:
        payload = patient.model_dump() if hasattr(patient, "model_dump") else patient.dict()
        result = run_diagnostic_pipeline(payload)
        result_data = result.model_dump() if hasattr(result, "model_dump") else result.dict()
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"The demo analysis could not process this case: {exc}") from exc

    urgency_text = str(result_data["urgency_tier"])
    urgency_tier = URGENCY_TO_TIER.get(urgency_text)
    if urgency_tier is None:
        raise HTTPException(status_code=500, detail=f"Unsupported urgency value from HouseAI: {urgency_text}")
    specialty = str(result_data["specialty_required"])
    reasoning_log = result_data.get("reasoning_log", [])
    agent_specs = [
        ("Triage Nurse", "Severity and specialty routing", "◷"),
        ("Specialist", "Possible clinical concerns", "⌕"),
        ("Safety Critic", "Red flags and safety review", "✚"),
    ]
    agents = []
    for index, (name, focus, icon) in enumerate(agent_specs):
        finding = reasoning_log[index] if index < len(reasoning_log) else "No reasoning note was returned by this demo agent."
        agents.append({"name": name, "focus": focus, "icon": icon, "finding": finding, "signals": ["symptoms", "lab / additional notes"]})

    confidence = float(result_data.get("confidence_score", 0.0))
    urgency_label = TIER_TO_LABEL[urgency_tier]
    next_step_by_tier = {
        1: "Routine clinician review is recommended.",
        2: "Arrange a timely clinician review.",
        3: "Prioritize prompt clinician review.",
    }
    pathway_by_tier = {1: "Routine scheduling", 2: "Expedited scheduling", 3: "Priority scheduling"}
    report = {
        "case_id": f"HA-{datetime.now():%y%m%d%H%M%S}",
        "patient_id": patient.patient_id,
        "age": patient.age,
        "specialty": specialty,
        "urgency_tier": urgency_tier,
        "urgency_label": urgency_label,
        "summary": f"Symptoms: {patient.symptoms}. Additional information: {patient.lab_notes or 'None provided.'}",
        "reasoning_summary": (
            f"HouseAI's simulated pipeline routed this case to {specialty} with {urgency_label.lower()} priority. "
            "The displayed assessment is a synthetic demo hypothesis, not a diagnosis."
        ),
        "provisional_assessment": f"Simulated candidate hypothesis: {result_data['consensus_diagnosis']}",
        "red_flags": [],
        "factors_considered": ["patient ID", "age", "reported symptoms", "lab / additional notes"],
        "next_steps": [next_step_by_tier[urgency_tier], "Licensed clinician review is required before any care decision."],
        "disclaimer": result_data.get("demo_notice", "Simulated demo only; not for clinical use."),
    }
    return {
        "report": report,
        "agents": agents,
        "consensus": {
            "level": "HouseAI demo pipeline consensus",
            "score_percent": round(confidence * 100),
            "summary": f"The simulated agents converged on {specialty} routing and tier {urgency_tier} ({urgency_label}).",
        },
        "activity_log": [{"agent": agent["name"], "event": agent["finding"]} for agent in agents],
        "care_routing": {
            "specialty": specialty,
            "urgency_tier": urgency_tier,
            "urgency_label": urgency_label,
            "pathway": pathway_by_tier[urgency_tier],
            "next_step": next_step_by_tier[urgency_tier],
            "emergency_escalation": False,
        },
    }


@app.post("/api/schedule", response_model=Appointment)
def schedule_appointment(request: ScheduleRequest) -> Appointment:
    """Select the earliest mock slot that matches analyzed specialty and tier."""
    requested_specialty = request.specialty.strip().casefold()
    candidates = []
    for doctor in build_mock_schedule():
        if doctor["specialty"].casefold() != requested_specialty:
            continue
        for slot in doctor["available_slots"]:
            if request.urgency_tier in slot["urgency_tiers"]:
                candidates.append((slot["time_slot"], doctor))
    if not candidates:
        raise HTTPException(status_code=404, detail=f"No mock slots are available for {request.specialty} at tier {request.urgency_tier}.")
    time_slot, doctor = min(candidates, key=lambda candidate: candidate[0])
    return Appointment(
        doctor_name=doctor["doctor_name"],
        time_slot=time_slot,
        location=doctor["location"],
        prep_instructions=PREP_BY_SPECIALTY.get(doctor["specialty"], "Bring your current medication list and relevant records."),
        urgency_tier=request.urgency_tier,
        specialty=doctor["specialty"],
        scheduling_priority=TIER_TO_LABEL[request.urgency_tier],
    )
