"""
Unit and Contract Verification Tests for HouseAI
Validates schema compliance and collaborative agent consensus.
"""

from schemas import PatientInput, DiagnosticResponse
from agents import HouseAIEngine

def test_benchmark_case():
    engine = HouseAIEngine()
    payload = {
        "patient_id": "P-1049",
        "age": 45,
        "symptoms": "Fictional demo symptoms",
        "lab_notes": "Fictional demo notes"
    }

    # Validate input model
    patient = PatientInput(**payload)
    assert patient.patient_id == "P-1049"
    assert patient.age == 45

    # Run multi-agent pipeline
    response = engine.process_case(payload)

    # Validate output schema
    assert isinstance(response, DiagnosticResponse)
    assert response.consensus_diagnosis != ""
    assert response.specialty_required != ""
    assert response.urgency_tier in ["Routine", "Moderate", "High", "Critical"]
    assert 0.0 <= response.confidence_score <= 1.0
    assert len(response.reasoning_log) == 3
    assert "SIMULATED DEMO ONLY" in response.demo_notice

    print("Benchmark case test passed successfully.")

if __name__ == "__main__":
    test_benchmark_case()
