"""
HouseAI Dental Data Schemas
Defines input and output contracts for cosmetic and general dentistry intake,
multi-agent clinical evaluation, multimodal imagery analysis, procedure pricing, duration estimates,
and the dental calendar.
All data and outputs are strictly simulated for demonstration and hackathon purposes.
"""

from __future__ import annotations

from typing import List, Dict, Any, Optional

try:
    from pydantic import BaseModel, Field
except ImportError:
    class BaseModel:
        """Lightweight fallback when pydantic is not installed."""
        def __init__(self, **data: Any):
            for field, val in data.items():
                setattr(self, field, val)

        def dict(self) -> Dict[str, Any]:
            return {k: v for k, v in self.__dict__.items() if not k.startswith('_')}

        def model_dump(self) -> Dict[str, Any]:
            return self.dict()

        def __repr__(self) -> str:
            items = ", ".join(f"{k}={v!r}" for k, v in self.dict().items())
            return f"{self.__class__.__name__}({items})"


# ==============================================================================
# INTAKE CONTRACTS
# ==============================================================================

class DentalIntakeInput(BaseModel):
    """
    Intake contract for dental patients.
    Supports aesthetic/cosmetic concerns, clinical symptoms, raw text walls,
    insurance information, and base64 imagery (X-rays or smile photos).
    """
    patient_id: str = "P-1001"
    patient_name: Optional[str] = "Jane Doe"
    age: int = 32
    concerns: str = "Interested in porcelain veneers for upper front teeth and professional teeth whitening"
    symptoms: Optional[str] = None  # Backwards compatibility alias for concerns
    clinical_notes: Optional[str] = ""
    lab_notes: Optional[str] = None  # Backwards compatibility alias
    raw_text_wall: Optional[str] = ""  # Unstructured consultation paste, email, or intake notes
    insurance_notes: Optional[str] = ""  # Policy details, carrier, cosmetic exclusion notes
    image_data: Optional[str] = None  # Base64 string or data URI for X-ray / intraoral photo
    image_type: Optional[str] = "smile_photo"  # 'xray', 'intraoral_photo', 'panoramic', 'bitewing', 'smile_photo'

    def get_effective_concerns(self) -> str:
        """Extract primary concern text whether supplied via concerns or legacy symptoms."""
        parts = []
        if self.concerns and self.concerns.strip():
            parts.append(self.concerns.strip())
        elif self.symptoms and self.symptoms.strip():
            parts.append(self.symptoms.strip())
        if self.raw_text_wall and self.raw_text_wall.strip():
            parts.append(f"Intake Notes: {self.raw_text_wall.strip()}")
        return " | ".join(parts) if parts else "Cosmetic dental evaluation requested."

    def get_effective_notes(self) -> str:
        """Extract clinical notes and insurance notes combined."""
        parts = []
        if self.clinical_notes and self.clinical_notes.strip():
            parts.append(self.clinical_notes.strip())
        elif self.lab_notes and self.lab_notes.strip():
            parts.append(self.lab_notes.strip())
        if self.insurance_notes and self.insurance_notes.strip():
            parts.append(f"Insurance info: {self.insurance_notes.strip()}")
        return " | ".join(parts)


# Backward compatibility alias
PatientInput = DentalIntakeInput


# ==============================================================================
# DIAGNOSTIC AND COLLABORATION CONTRACTS
# ==============================================================================

class CosmeticAnalysis(BaseModel):
    """Specific cosmetic smile design and aesthetic metrics."""
    aesthetic_goal: str = "Smile Makeover"
    recommended_procedure: str = "Minimal-Prep Porcelain Veneers (e.max)"
    target_teeth: str = "#6 through #11 (Maxillary Anterior Sextant)"
    shade_recommendation: str = "VITA BL2 Bleach Shade"
    invasiveness_level: str = "Minimally Invasive (0.3mm to 0.5mm enamel reduction)"
    estimated_chair_time_hours: float = 2.5
    estimated_duration_minutes: int = 150
    estimated_price_usd: float = 8400.00
    estimated_price_range: str = "$7,200 - $9,600 ($1,200 - $1,600 / tooth)"
    lab_turnaround_days: int = 10
    maintenance_requirements: str = "Custom occlusal nightguard recommended to prevent nocturnal bruxism chipping"


class InsuranceAnalysis(BaseModel):
    """Insurance benefits, cosmetic exclusion assessment, and CDT codes."""
    carrier_detected: str = "General PPO / Out-of-Pocket Elective"
    cosmetic_coverage_status: str = "Excluded (Elective Aesthetic Procedure)"
    estimated_patient_responsibility_percent: int = 100
    estimated_out_of_pocket_usd: float = 8400.00
    estimated_insurance_coverage_usd: float = 0.00
    applicable_cdt_codes: List[str] = ["D2962 (Porcelain Laminate Veneer)", "D9972 (External In-Office Whitening)"]
    financing_options: str = "Eligible for CareCredit, Proceed Finance, or in-house aesthetic installment plan"


class DentalDiagnosticResponse(BaseModel):
    """Output contract validated after collaborative dental agent consensus."""
    consensus_diagnosis: str
    specialty_required: str
    urgency_tier: str  # 'Elective', 'Cosmetic-Priority', 'Moderate', 'Urgent', 'Emergency'
    urgency_score: int  # 1 (Lowest/Routine) to 5 (Critical Emergency)
    urgency_color: str  # Hex code for frontend calendar & badge display
    confidence_score: float
    treatment_plan: str
    estimated_price_usd: float = 8400.00
    estimated_price_display: str = "$8,400.00"
    estimated_duration_minutes: int = 150
    cosmetic_breakdown: Dict[str, Any]
    insurance_breakdown: Dict[str, Any]
    imaging_findings: Optional[str] = "No active periapical pathology noted; adequate enamel support for adhesive bonding."
    reasoning_log: List[str]
    demo_notice: str


# Backward compatibility alias
DiagnosticResponse = DentalDiagnosticResponse


# ==============================================================================
# CALENDAR CONTRACTS
# ==============================================================================

class CalendarEvent(BaseModel):
    """Represents a scheduled appointment on the dentist's calendar."""
    id: str
    patient_id: str
    patient_name: str
    procedure: str
    category: str  # 'Cosmetic', 'Restorative', 'Consultation', 'Orthodontic', 'Emergency'
    start_time: str  # ISO 8601 string, e.g. '2026-10-05T09:00:00'
    end_time: str    # ISO 8601 string, e.g. '2026-10-05T10:30:00'
    duration_minutes: int
    estimated_price_usd: float = 0.00
    operatory: str   # 'Operatory 1: Cosmetic Studio', 'Operatory 2: Laser Suite', etc.
    dentist_name: str
    urgency_score: int  # 1 to 5
    urgency_level: str  # 'Elective', 'Cosmetic-Priority', 'Moderate', 'Urgent', 'Emergency'
    urgency_color: str  # Hex color: #10b981 (Green), #3b82f6 (Blue), #f59e0b (Yellow), #f97316 (Orange), #ef4444 (Red)
    notes: str
    status: str = "scheduled"  # 'scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled'


class CalendarEventCreate(BaseModel):
    """Input contract to create a new appointment on the calendar."""
    patient_id: str = "P-1002"
    patient_name: str = "Alex Mercer"
    procedure: str = "Porcelain Veneers Prep"
    category: Optional[str] = "Cosmetic"
    start_time: str = "2026-10-06T10:00:00"
    duration_minutes: Optional[int] = 90
    estimated_price_usd: Optional[float] = 4800.00
    operatory: Optional[str] = "Operatory 1: Cosmetic Studio"
    dentist_name: Optional[str] = "Dr. Julian Vance, DDS"
    urgency_score: Optional[int] = 1
    urgency_color: Optional[str] = None
    urgency_level: Optional[str] = None
    notes: Optional[str] = "Upper anterior smile makeover consultation and mock-up."
