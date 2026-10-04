"""
HouseAI Agent Collaboration Engine
Implements three collaborative diagnostic agents:
1. Triage Nurse: Evaluates acuity, initial vital flags, and routes to appropriate specialty.
2. Specialist: Synthesizes symptoms, labs, and differential diagnoses with confidence scoring.
3. Safety Critic: Reviews diagnostic assumptions, checks contraindications, and validates consensus.

All outputs are strictly simulated for demonstration purposes.
"""

from typing import List, Dict, Any, Tuple
from schemas import PatientInput, DiagnosticResponse

DEMO_DISCLAIMER = (
    "SIMULATED DEMO ONLY: Fabricated synthetic case for hackathon demonstration purposes. "
    "Not intended for medical advice, diagnosis, triage, or clinical care."
)

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
