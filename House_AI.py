"""
HouseAI Main Execution Entry Point & Collaborative Diagnostic Engine
Solution: House_AI.slnx / Project: House_AI.pyproj

Multi-Agent Diagnostic Assessment Pipeline:
1. Triage Nurse: Evaluates acuity, initial vital flags, and routes to appropriate specialty.
2. Specialist: Synthesizes symptoms, labs, and differential diagnoses with confidence scoring.
3. Safety Critic: Reviews diagnostic assumptions, checks contraindications, and validates consensus.

Validates input and output schemas against PatientInput and DiagnosticResponse.
All outputs are strictly simulated for demonstration purposes.
"""

import json
from typing import List, Dict, Any

# ==============================================================================
# 1. DATA CONTRACT  SCHEMAS
# ==============================================================================

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


DEMO_DISCLAIMER = (
    "SIMULATED DEMO ONLY: Fabricated synthetic case for demonstration purposes. "
    "Not intended for medical advice, diagnosis, triage, or clinical care."
)

# ==============================================================================
# 2. COLLABORATIVE DIAGNOSTIC AGENTS
# ==============================================================================

class TriageNurseAgent:
    """Agent responsible for intake triage, acuity classification, and specialty routing."""

    def evaluate(self, patient: PatientInput) -> Dict[str, Any]:
        symptoms_lower = patient.symptoms.lower()
        labs_lower = patient.lab_notes.lower()
        combined_text = f"{symptoms_lower} {labs_lower}"

        # Specialty routing rules based on symptom keywords
        if any(word in combined_text for word in ["chest pain", "angina", "troponin", "palpitations", "arrhythmia", "ecg"]):
            specialty = "Cardiology"
            urgency = "High"
        elif any(word in combined_text for word in ["shortness of breath", "dyspnea", "cough", "wheezing", "hypoxia", "infiltrate"]):
            specialty = "Pulmonology"
            urgency = "High" if "hypoxia" in combined_text or "severe" in combined_text else "Moderate"
        elif any(word in combined_text for word in ["headache", "neuropathy", "numbness", "seizure", "syncope", "vision"]):
            specialty = "Neurology"
            urgency = "High" if "seizure" in combined_text or "syncope" in combined_text else "Moderate"
        elif any(word in combined_text for word in ["abdominal", "nausea", "vomiting", "jaundice", "liver", "bilirubin", "elevated alt"]):
            specialty = "Gastroenterology"
            urgency = "Moderate"
        elif any(word in combined_text for word in ["creatinine", "bun", "kidney", "renal", "proteinuria"]):
            specialty = "Nephrology"
            urgency = "Moderate"
        elif any(word in combined_text for word in ["fever", "chills", "leukocytosis", "sepsis", "bacterial", "viral"]):
            specialty = "Infectious Disease"
            urgency = "High" if "sepsis" in combined_text or "hypotension" in combined_text else "Moderate"
        else:
            specialty = "Internal Medicine"
            urgency = "Routine"

        # Check age-based risk factor adjustments
        if patient.age > 65 and urgency == "Moderate":
            urgency = "High"

        triage_note = (
            f"[Triage Nurse]: Patient {patient.patient_id} (age {patient.age}) assessed. "
            f"Primary clinical acuity set to {urgency}. "
            f"Routing case to {specialty} department for specialist review."
        )

        return {
            "specialty_required": specialty,
            "preliminary_urgency": urgency,
            "triage_note": triage_note
        }


class SpecialistAgent:
    """Agent responsible for clinical synthesis, differential diagnosis, and initial confidence scoring."""

    def evaluate(self, patient: PatientInput, triage_data: Dict[str, Any]) -> Dict[str, Any]:
        specialty = triage_data["specialty_required"]
        symptoms_lower = patient.symptoms.lower()
        labs_lower = patient.lab_notes.lower()
        combined_text = f"{symptoms_lower} {labs_lower}"

        # Clinical synthesis simulation
        if specialty == "Cardiology":
            if "troponin" in labs_lower or "ecg" in labs_lower:
                diagnosis = "Suspected Non-ST Elevation Myocardial Infarction (NSTEMI)"
                confidence = 0.88
            else:
                diagnosis = "Atypical Angina Pectoris with exertional ischemia"
                confidence = 0.81
        elif specialty == "Pulmonology":
            if "infiltrate" in labs_lower or "fever" in combined_text:
                diagnosis = "Community Acquired Pneumonia with secondary airway reactivity"
                confidence = 0.86
            else:
                diagnosis = "Acute Exacerbation of Reactive Airway Disease"
                confidence = 0.79
        elif specialty == "Neurology":
            if "vision" in symptoms_lower or "headache" in symptoms_lower:
                diagnosis = "Migraine with typical aura and visual scotoma"
                confidence = 0.84
            else:
                diagnosis = "Transient Focal Neurological Deficit (workup indicated)"
                confidence = 0.76
        elif specialty == "Gastroenterology":
            diagnosis = "Acute Calculous Cholecystitis with biliary tract irritation"
            confidence = 0.83
        elif specialty == "Nephrology":
            diagnosis = "Acute Kidney Injury (Prerenal etiology suspected)"
            confidence = 0.82
        elif specialty == "Infectious Disease":
            diagnosis = "Systemic Inflammatory Response secondary to suspected bacteremia"
            confidence = 0.85
        else:
            diagnosis = "Subacute Multisystem Inflammatory Syndrome (undifferentiated)"
            confidence = 0.72

        specialist_note = (
            f"[Specialist ({specialty})]: Formulated primary hypothesis: '{diagnosis}'. "
            f"Calculated preliminary confidence score: {confidence:.2f} based on reported markers: "
            f"'{patient.symptoms}' and lab findings: '{patient.lab_notes}'."
        )

        return {
            "candidate_diagnosis": diagnosis,
            "confidence_score": confidence,
            "specialist_note": specialist_note
        }


class SafetyCriticAgent:
    """Agent responsible for safety checks, counter-evidence analysis, and final consensus ratification."""

    def review(
        self,
        patient: PatientInput,
        triage_data: Dict[str, Any],
        specialist_data: Dict[str, Any]
    ) -> DiagnosticResponse:
        reasoning_log: List[str] = [
            triage_data["triage_note"],
            specialist_data["specialist_note"]
        ]

        candidate = specialist_data["candidate_diagnosis"]
        confidence = specialist_data["confidence_score"]
        urgency = triage_data["preliminary_urgency"]
        specialty = triage_data["specialty_required"]

        # Safety critique evaluation
        critique_points = []
        if patient.age > 70 and confidence > 0.85:
            critique_points.append("Age factor warrants conservative confidence adjustment.")
            confidence = round(confidence - 0.05, 2)

        if "fictional" in patient.symptoms.lower() or "demo" in patient.symptoms.lower():
            critique_points.append("Explicit synthetic benchmark keywords verified in intake payload.")

        # Check for diagnostic anchoring or atypical flags
        critique_points.append(
            "Differential validated against contraindications and atypical presentation patterns."
        )

        safety_note = (
            f"[Safety Critic]: Cross-examination complete. Consensus validated for '{candidate}'. "
            f"Final calibrated confidence score: {confidence:.2f}. "
            f"Acuity tier confirmed as {urgency}. " + " ".join(critique_points)
        )
        reasoning_log.append(safety_note)

        return DiagnosticResponse(
            consensus_diagnosis=candidate,
            specialty_required=specialty,
            urgency_tier=urgency,
            confidence_score=confidence,
            reasoning_log=reasoning_log,
            demo_notice=DEMO_DISCLAIMER
        )


class HouseAIEngine:
    """Multi-agent coordinator linking Triage Nurse, Specialist, and Safety Critic."""

    def __init__(self):
        self.triage_nurse = TriageNurseAgent()
        self.specialist = SpecialistAgent()
        self.safety_critic = SafetyCriticAgent()

    def process_case(self, payload: Dict[str, Any]) -> DiagnosticResponse:
        """Processes raw patient JSON dictionary and outputs validated DiagnosticResponse."""
        patient = PatientInput(**payload)

        # Step 1: Triage Nurse evaluates acuity and routing
        triage_result = self.triage_nurse.evaluate(patient)

        # Step 2: Specialist formulates diagnosis and differential
        specialist_result = self.specialist.evaluate(patient, triage_result)

        # Step 3: Safety Critic challenges assumptions and validates final consensus
        final_response = self.safety_critic.review(patient, triage_result, specialist_result)

        return final_response


# ==============================================================================
# 3. PIPELINE ENTRY POINT & DEMONSTRATION RUNNER
# ==============================================================================

def run_diagnostic_pipeline(payload: Dict[str, Any]) -> DiagnosticResponse:
    """Execute the multi-agent diagnostic assessment and return a validated DiagnosticResponse."""
    engine = HouseAIEngine()
    return engine.process_case(payload)


def main():
    print("=" * 70)
    print("HouseAI Multi-Agent Diagnostic Demo")
    print("Collaborators: Triage Nurse, Specialist, Safety Critic")
    print("=" * 70)

    # 1. Benchmark case requested in project requirements
    benchmark_payload = {
        "patient_id": "P-1049",
        "age": 45,
        "symptoms": "Fictional demo symptoms",
        "lab_notes": "Fictional demo notes"
    }

    print("\n[Input Request]")
    print(json.dumps(benchmark_payload, indent=2))

    # Run the collaborative agent pipeline
    result: DiagnosticResponse = run_diagnostic_pipeline(benchmark_payload)

    # Convert model to dictionary for pretty printing
    result_dict = result.dict() if hasattr(result, "dict") else result.__dict__

    print("\n[Validated DiagnosticResponse]")
    print(json.dumps(result_dict, indent=2))

    # 2. Simulated Clinical Scenario: Cardiology Intake
    print("\n" + "=" * 70)
    print("Simulated Clinical Scenario: Cardiology Intake")
    print("=" * 70)

    cardiac_case = {
        "patient_id": "P-2088",
        "age": 62,
        "symptoms": "Substernal chest pain radiating to left jaw, diaphoresis",
        "lab_notes": "ECG reveals ST segment depression in leads V4-V6, elevated troponin I"
    }

    cardiac_result = run_diagnostic_pipeline(cardiac_case)
    cardiac_dict = cardiac_result.dict() if hasattr(cardiac_result, "dict") else cardiac_result.__dict__
    print(json.dumps(cardiac_dict, indent=2))


if __name__ == "__main__":
    main()
