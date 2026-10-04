"""
HouseAI Dental Intelligence Engine
Main Execution Entry Point & Multi-Agent Swarm for Cosmetic and Restorative Dentistry
Solution: House_AI.slnx / Project: House_AI.pyproj

Multi-Agent Swarm Collaboration:
1. Dental Triage Nurse Agent: Acuity triage, concerns analysis, urgency scoring (1-5), and hex color assignment.
2. Cosmetic Dentist Specialist Agent: Smile design, porcelain veneers (e.max), composite bonding, shade matching, and clear aligners.
3. Radiographic & Visual Analyst Agent: Evaluates dental X-rays (periapical, bitewing, panorex) and intraoral smile photography.
4. Insurance & Billing Agent: Parses text walls, identifies CDT billing codes, and flags cosmetic exclusions.
5. Safety Critic Agent: Peer reviews biological width, periodontal health, and contraindications before aesthetic prep.

Supports real-time cloud LLM reasoning with Google Gemini Pro (or automatic local dental clinical fallback).
All outputs are strictly simulated for hackathon demonstration.
"""

from __future__ import annotations

import json
from typing import Dict, Any

from schemas import (
    DentalIntakeInput,
    DentalDiagnosticResponse,
    PatientInput,
    DiagnosticResponse,
)
from agents import (
    DentalSwarmEngine,
    HouseAIEngine,
    DEMO_DISCLAIMER,
    DENTAL_URGENCY_LEVELS,
)


def run_diagnostic_pipeline(payload: Dict[str, Any]) -> DentalDiagnosticResponse:
    """Execute the multi-agent dental diagnostic assessment and return a validated DentalDiagnosticResponse."""
    engine = DentalSwarmEngine()
    return engine.process_case(payload)


def main():
    print("=" * 75)
    print("HouseAI Dental Intelligence Platform")
    print("Multi-Agent Swarm: Triage Nurse, Cosmetic Specialist, Imaging Analyst, Billing Agent, Safety Critic")
    print("=" * 75)

    # Benchmark Cosmetic Dentistry Case
    cosmetic_payload = {
        "patient_id": "P-COSM-204",
        "patient_name": "Sophia Martinez",
        "age": 28,
        "concerns": "Looking for porcelain veneers for my upper front 6 teeth. I have minor discoloration and a small gap between my front teeth that I want fixed before my wedding next month.",
        "raw_text_wall": (
            "Patient emailed our office: 'Hi Dr. Vance, I'm getting married in 6 weeks and really want to fix my smile. "
            "I have Delta Dental PPO through my employer (group #98234), but I understand cosmetic veneers might be out-of-pocket. "
            "Can we do a preview mock-up? I also grind my teeth slightly at night.'"
        ),
        "insurance_notes": "Delta Dental PPO, group #98234. Inquiring about cosmetic veneer coverage and financing.",
        "image_type": "smile_photo",
        "clinical_notes": "Healthy periodontal status, no bleeding on probing, minor nocturnal bruxism."
    }

    print("\n[Input Case]:")
    print(f"Patient: {cosmetic_payload['patient_name']} (ID: {cosmetic_payload['patient_id']}, Age: {cosmetic_payload['age']})")
    print(f"Concerns: {cosmetic_payload['concerns']}")
    print(f"Intake Paste / Text Wall: {cosmetic_payload['raw_text_wall'][:120]}...")

    print("\n[Executing Dental Agent Swarm Assessment...]")
    response = run_diagnostic_pipeline(cosmetic_payload)

    print("\n" + "=" * 75)
    print("DENTAL SWARM ASSESSMENT REPORT")
    print("=" * 75)
    print(f"Consensus Diagnosis:    {response.consensus_diagnosis}")
    print(f"Specialty Required:     {response.specialty_required}")
    print(f"Urgency Tier:           {response.urgency_tier} (Score: {response.urgency_score}/5)")
    print(f"Calendar Urgency Color: {response.urgency_color}")
    print(f"Confidence Score:       {response.confidence_score * 100:.1f}%")
    print(f"Estimated Price:        {response.estimated_price_display} (${response.estimated_price_usd:,.2f})")
    print(f"Estimated Chair Time:   {response.estimated_duration_minutes} minutes ({response.estimated_duration_minutes / 60:.1f} hrs)")
    print(f"\n[Treatment Plan Summary]:\n{response.treatment_plan}")

    print("\n[Cosmetic Smile Design Breakdown]:")
    for k, v in response.cosmetic_breakdown.items():
        if k != "clinical_steps":
            print(f"  - {k.replace('_', ' ').title()}: {v}")

    print("\n[Insurance & CDT Billing Breakdown]:")
    for k, v in response.insurance_breakdown.items():
        print(f"  - {k.replace('_', ' ').title()}: {v}")

    print("\n[Collaborative Agent Reasoning Log]:")
    for entry in response.reasoning_log:
        print(f"  * {entry}")

    print(f"\n[Notice]: {response.demo_notice}")
    print("=" * 75)


if __name__ == "__main__":
    main()
