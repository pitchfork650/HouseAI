"""
Unit and Contract Verification Tests for HouseAI Dental Intelligence Platform
Validates schema compliance, collaborative agent consensus, urgency coloring, and calendar endpoints.
"""

from schemas import DentalIntakeInput, DentalDiagnosticResponse, CalendarEvent
from agents import DentalSwarmEngine, DENTAL_URGENCY_LEVELS


def test_cosmetic_dentistry_benchmark():
    engine = DentalSwarmEngine()
    payload = {
        "patient_id": "P-COSM-101",
        "patient_name": "Claire Davies",
        "age": 29,
        "concerns": "Looking for porcelain veneers on my upper front teeth (#6-#11) to fix discoloration and mild chipping",
        "raw_text_wall": "Patient has Delta Dental PPO. Inquiring about elective veneer costs and tooth shade BL2.",
        "insurance_notes": "Delta Dental PPO. Seeking cosmetic pre-determination and financing alternatives.",
        "image_type": "smile_photo",
        "clinical_notes": "Healthy periodontal status, no bleeding on probing, biological width preserved."
    }

    # Validate input model
    patient = DentalIntakeInput(**payload)
    assert patient.patient_id == "P-COSM-101"
    assert "veneers" in patient.get_effective_concerns().lower()

    # Run multi-agent dental swarm
    response = engine.process_case(payload)

    # Validate output schema
    assert isinstance(response, DentalDiagnosticResponse)
    assert response.consensus_diagnosis != ""
    assert response.specialty_required != ""
    assert 1 <= response.urgency_score <= 5
    assert response.urgency_color in [info["color"] for info in DENTAL_URGENCY_LEVELS.values()]
    assert 0.0 <= response.confidence_score <= 1.0
    assert response.estimated_price_usd > 0
    assert response.estimated_duration_minutes > 0
    assert len(response.reasoning_log) == 5
    assert "SIMULATED DENTAL DEMO ONLY" in response.demo_notice
    assert "recommended_procedure" in response.cosmetic_breakdown
    assert "applicable_cdt_codes" in response.insurance_breakdown

    print(f"Cosmetic dentistry benchmark passed: Urgency {response.urgency_tier} ({response.urgency_score}), Fee: {response.estimated_price_display}, Duration: {response.estimated_duration_minutes}m, Color: {response.urgency_color}")


def test_emergency_dentistry_triage():
    engine = DentalSwarmEngine()
    payload = {
        "patient_id": "P-EMERG-999",
        "patient_name": "Tom Harris",
        "age": 42,
        "concerns": "Severe unbearable throbbing pain in lower left molar with swelling and fever since last night",
        "clinical_notes": "Suspected acute periapical abscess"
    }

    response = engine.process_case(payload)
    assert response.urgency_score >= 4  # Should trigger Urgent or Emergency
    assert response.urgency_color in ["#f97316", "#ef4444"]
    print(f"Emergency triage test passed: Urgency {response.urgency_tier} ({response.urgency_score}), Color: {response.urgency_color}")


if __name__ == "__main__":
    test_cosmetic_dentistry_benchmark()
    test_emergency_dentistry_triage()
    print("All dental tests passed successfully!")
