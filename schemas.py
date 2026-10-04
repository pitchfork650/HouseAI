"""
HouseAI Data Schemas
Defines input and output contracts for patient intake and multi-agent diagnostic assessment.
All data and outputs are strictly synthetic and for demonstration purposes only.
"""

from typing import List, Dict, Any

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


class PatientInput(BaseModel):
    """Input contract for patient intake data."""
    patient_id: str
    age: int
    symptoms: str
    lab_notes: str


class DiagnosticResponse(BaseModel):
    """Output contract validated after collaborative agent consensus."""
    consensus_diagnosis: str
    specialty_required: str
    urgency_tier: str
    confidence_score: float
    reasoning_log: List[str]
    demo_notice: str
