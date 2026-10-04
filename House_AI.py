"""
HouseAI Main Execution Entry Point & Collaborative Diagnostic Engine
Solution: House_AI.slnx / Project: House_AI.pyproj

Multi-Agent Diagnostic Assessment Pipeline:
1. Triage Nurse: Evaluates acuity, initial vital flags, and routes to appropriate specialty.
2. Specialist: Synthesizes symptoms, labs, and differential diagnoses with confidence scoring.
3. Safety Critic: Reviews diagnostic assumptions, checks contraindications, and validates consensus.

Supports cloud LLM reasoning with Google Gemini Pro (or automatic local heuristic fallback).
Validates input and output schemas against PatientInput and DiagnosticResponse contracts.
All outputs are strictly simulated for demonstration purposes.
"""

from __future__ import annotations

import json
from typing import Dict, Any

from schemas import PatientInput, DiagnosticResponse
from agents import (
    TriageNurseAgent,
    SpecialistAgent,
    SafetyCriticAgent,
    HouseAIEngine,
    DEMO_DISCLAIMER,
)


def run_diagnostic_pipeline(payload: Dict[str, Any]) -> DiagnosticResponse:
    """Execute the multi-agent diagnostic assessment and return a validated DiagnosticResponse."""
    engine = HouseAIEngine()
    return engine.process_case(payload)


def main():
    print("=" * 70)
    print("HouseAI Multi-Agent Diagnostic Demo")
    print("Collaborators: Triage Nurse, Specialist, Safety Critic")
    print("=" * 70)

    # Benchmark case
    benchmark_payload = {
        "patient_id": "P-1049",
        "age": 45,
        "symptoms": "Fictional demo symptoms",
        "lab_notes": "Fictional demo notes"
    }

    print("\n[Input Case]:")
    print(json.dumps(benchmark_payload, indent=2))

    print("\n[Processing Collaborative Multi-Agent Consensus]...")
    result = run_diagnostic_pipeline(benchmark_payload)

    print("\n[Diagnostic Consensus Report]:")
    res_dict = result.model_dump() if hasattr(result, "model_dump") else result.dict()
    print(f"Consensus Diagnosis: {res_dict['consensus_diagnosis']}")
    print(f"Specialty Required:  {res_dict['specialty_required']}")
    print(f"Urgency Tier:        {res_dict['urgency_tier']}")
    print(f"Confidence Score:    {res_dict['confidence_score']:.2f}")

    print("\n[Agent Collaboration & Reasoning Trail]:")
    for step in res_dict["reasoning_log"]:
        print(f" - {step}")

    print("\n[Compliance Notice]:")
    print(res_dict["demo_notice"])
    print("=" * 70)


if __name__ == "__main__":
    main()
