"""
HouseAI Dental Collaboration Engine with Google Gemini Pro Integration
Implements a multi-agent collaborative dental intelligence swarm:
1. Dental Triage Nurse: Evaluates patient concerns, differentiates cosmetic goals vs acute pain/infection,
   and assigns clinical priority tiers with urgency color coding.
2. Cosmetic & Restorative Dentist Specialist: Designs smile makeover treatment plans (veneers, whitening,
   composite bonding, clear aligners, shade matching, prep invasiveness).
3. Radiographic & Visual Analyst: Evaluates dental X-rays, bitewings, panorex, and intraoral/smile photographs
   using Google Gemini Pro Multimodal Vision or heuristic diagnostic heuristics.
4. Insurance & Billing Agent: Parses insurance policies, checks cosmetic exclusion criteria, and identifies CDT billing codes.
5. Safety Critic Agent: Peer-reviews case, checks biological width and periodontal stability, and validates consensus.

Supports real-time cloud LLM reasoning via Google Gemini (Gemini 1.5 Pro / Flash / 2.0)
with an automatic graceful fallback to the local dental clinical decision engine if offline or no key is provided.

All outputs are strictly simulated for demonstration and hackathon review.
"""

from __future__ import annotations

import base64
import json
import os
import re
from typing import List, Dict, Any, Optional, Tuple

import requests

from schemas import (
    DentalIntakeInput,
    DentalDiagnosticResponse,
    CosmeticAnalysis,
    InsuranceAnalysis,
)

DEMO_DISCLAIMER = (
    "SIMULATED DENTAL DEMO ONLY: Synthetic aesthetic and clinical assessment for hackathon demonstration. "
    "Not intended for clinical diagnosis, treatment decisions, or medical advice. Licensed dentist review required."
)

# Standard urgency mapping for cosmetic and general dentistry
DENTAL_URGENCY_LEVELS = {
    1: {"name": "Elective", "color": "#10b981", "desc": "Purely elective aesthetic treatment (whitening, minor bonding, elective consultation)"},
    2: {"name": "Cosmetic-Priority", "color": "#3b82f6", "desc": "Scheduled aesthetic restorative (veneers prep/seat, aligner refinement, cosmetic crown)"},
    3: {"name": "Moderate", "color": "#f59e0b", "desc": "Routine restorative or periodontal concern (early caries, mild gingivitis, replacement filling)"},
    4: {"name": "Urgent", "color": "#f97316", "desc": "Urgent cosmetic/functional breakdown (fractured front incisor, dislodged veneer/crown, acute sensitivity)"},
    5: {"name": "Emergency", "color": "#ef4444", "desc": "Dental emergency (acute periapical abscess, severe throbbing pain, facial cellulitis, dental trauma)"},
}


def load_env_file() -> None:
    """Load key-value pairs from .env into os.environ if not already present."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(base_dir, ".env")
    if not os.path.exists(env_path):
        return

    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip("'\"")
                if k and k not in os.environ:
                    os.environ[k] = v
    except Exception:
        pass


load_env_file()


def get_gemini_config() -> Tuple[Optional[str], str]:
    """Retrieve Gemini API key and target model from environment."""
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if api_key:
        api_key = api_key.strip()
        if not api_key or api_key == "your_gemini_api_key_here":
            api_key = None

    model = os.getenv("GEMINI_MODEL", "gemini-1.5-pro").strip()
    return api_key, model


def call_gemini_api(
    prompt: str,
    system_instruction: str = "",
    image_base64: Optional[str] = None,
    image_mime_type: str = "image/jpeg",
    model: str = "gemini-1.5-pro",
    api_key: str = "",
    temperature: float = 0.2,
    timeout: int = 30,
) -> Optional[Dict[str, Any]]:
    """
    Direct HTTPS REST call to Google Gemini generateContent endpoint.
    Supports multimodal inputs (text + X-ray/smile photos) and structured JSON outputs.
    """
    if not api_key:
        return None

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}

    parts: List[Dict[str, Any]] = []

    # If an image (X-ray, intraoral photo, or insurance scan) is provided, attach as inlineData
    if image_base64:
        clean_base64 = image_base64
        if "base64," in clean_base64:
            header, clean_base64 = clean_base64.split("base64,", 1)
            if "image/" in header:
                match = re.search(r"image/([a-zA-Z0-9\+\-]+)", header)
                if match:
                    image_mime_type = f"image/{match.group(1)}"

        parts.append({
            "inlineData": {
                "mimeType": image_mime_type,
                "data": clean_base64.strip()
            }
        })

    parts.append({"text": prompt})

    payload: Dict[str, Any] = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "temperature": temperature,
            "responseMimeType": "application/json",
        },
    }

    if system_instruction:
        payload["systemInstruction"] = {
            "parts": [{"text": system_instruction}]
        }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=timeout)
        if response.status_code != 200:
            return None

        data = response.json()
        candidates = data.get("candidates", [])
        if not candidates:
            return None

        content = candidates[0].get("content", {})
        cand_parts = content.get("parts", [])
        if not cand_parts:
            return None

        raw_text = cand_parts[0].get("text", "").strip()

        # Clean markdown code block if present
        if raw_text.startswith("```"):
            raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
            raw_text = re.sub(r"\s*```$", "", raw_text)

        return json.loads(raw_text)
    except Exception:
        return None


# ==============================================================================
# 1. DENTAL TRIAGE NURSE AGENT
# ==============================================================================

class DentalTriageNurseAgent:
    """Evaluates patient concerns, classifies clinical acuity vs elective cosmetic wishes, and assigns urgency."""

    def evaluate(self, patient: DentalIntakeInput) -> Dict[str, Any]:
        api_key, model = get_gemini_config()
        concerns = patient.get_effective_concerns()
        notes = patient.get_effective_notes()

        if api_key:
            system_prompt = (
                "You are the HouseAI Dental Triage Nurse Agent. Your role is to examine dental concerns, "
                "differentiating between elective aesthetic goals (veneers, whitening, bonding, smile makeover) "
                "versus clinical symptoms, pain, infection, or trauma.\n"
                "Return ONLY a JSON object with these exact keys:\n"
                "- 'specialty_required': (string, e.g. 'Cosmetic & Restorative Dentistry', 'Endodontics', 'Periodontics', 'Orthodontics', 'General Dentistry')\n"
                "- 'urgency_score': (integer, 1 for Elective, 2 for Cosmetic-Priority, 3 for Moderate, 4 for Urgent, 5 for Emergency)\n"
                "- 'urgency_tier': (string, exactly one of 'Elective', 'Cosmetic-Priority', 'Moderate', 'Urgent', 'Emergency')\n"
                "- 'urgency_color': (string hex color: #10b981 for Elective, #3b82f6 for Cosmetic-Priority, #f59e0b for Moderate, #f97316 for Urgent, #ef4444 for Emergency)\n"
                "- 'triage_note': (string, 1-2 sentences summarizing clinical and aesthetic triage findings)"
            )
            user_prompt = (
                f"Patient ID: {patient.patient_id}\n"
                f"Age: {patient.age}\n"
                f"Patient Concerns / Symptoms: {concerns}\n"
                f"Clinical & Insurance Notes: {notes}"
            )
            result = call_gemini_api(user_prompt, system_instruction=system_prompt, model=model, api_key=api_key)
            if result and "urgency_score" in result:
                score = int(result.get("urgency_score", 1))
                score = max(1, min(5, score))
                tier_info = DENTAL_URGENCY_LEVELS.get(score, DENTAL_URGENCY_LEVELS[1])
                return {
                    "agent": "Dental Triage Nurse Agent",
                    "specialty_required": result.get("specialty_required", "Cosmetic & Restorative Dentistry"),
                    "urgency_score": score,
                    "urgency_tier": tier_info["name"],
                    "urgency_color": tier_info["color"],
                    "finding": result.get("triage_note", "Patient concerns evaluated for aesthetic smile design and dental stability."),
                    "source": "Google Gemini Pro Cloud Reasoning"
                }

        # Local Clinical Heuristic Fallback
        c_lower = concerns.lower()
        if any(w in c_lower for w in ["swelling", "fever", "abscess", "unbearable", "trauma", "knocked out", "avulsed"]):
            score = 5
            specialty = "Emergency Dentistry / Oral Surgery"
            finding = "High acuity dental emergency detected with infection or acute trauma risks requiring immediate evaluation."
        elif any(w in c_lower for w in ["broken veneer", "chipped front", "chipped tooth", "wedding", "interview", "sharp pain"]):
            score = 4
            specialty = "Cosmetic & Restorative Dentistry"
            finding = "Urgent aesthetic disruption or structural chip identified; prioritized for rapid aesthetic restoration."
        elif any(w in c_lower for w in ["toothache", "sensitivity", "bleeding", "cavity", "filling"]):
            score = 3
            specialty = "General & Restorative Dentistry"
            finding = "Active symptomatic concern or localized tooth sensitivity identified requiring clinical exam before aesthetic prep."
        elif any(w in c_lower for w in ["veneer", "smile makeover", "aligner", "invisalign", "crowding"]):
            score = 2
            specialty = "Cosmetic & Restorative Dentistry"
            finding = "Elective comprehensive smile transformation case; scheduled for digital smile design and aesthetic diagnostic wax-up."
        else:
            score = 1
            specialty = "Cosmetic & Restorative Dentistry"
            finding = "Elective aesthetic enhancement and consultation requested (e.g. whitening, minor bonding, shade evaluation)."

        tier_info = DENTAL_URGENCY_LEVELS[score]
        return {
            "agent": "Dental Triage Nurse Agent",
            "specialty_required": specialty,
            "urgency_score": score,
            "urgency_tier": tier_info["name"],
            "urgency_color": tier_info["color"],
            "finding": finding,
            "source": "Local Dental Decision Tree Fallback"
        }


# ==============================================================================
# 2. COSMETIC & RESTORATIVE DENTIST SPECIALIST AGENT
# ==============================================================================

class CosmeticDentistSpecialistAgent:
    """Specializes in smile design, tooth proportions, veneer prep, bonding, and shade matching."""

    def evaluate(self, patient: DentalIntakeInput, triage_data: Dict[str, Any]) -> Dict[str, Any]:
        api_key, model = get_gemini_config()
        concerns = patient.get_effective_concerns()
        notes = patient.get_effective_notes()

        if api_key:
            system_prompt = (
                "You are the HouseAI Cosmetic & Restorative Dentist Specialist Agent. You are an expert in "
                "aesthetic smile design, porcelain laminate veneers (e.max lithium disilicate vs feldspathic), "
                "direct composite bonding, teeth whitening protocols (carbamide vs hydrogen peroxide in-office Zoom), "
                "clear aligners / Invisalign, and smile line proportions.\n"
                "Return ONLY a JSON object with these exact keys:\n"
                "- 'aesthetic_diagnosis': (string, clinical description of aesthetic issues and diagnosis)\n"
                "- 'recommended_procedure': (string, exact procedure title)\n"
                "- 'target_teeth': (string, tooth numbering or sextant e.g. '#6-#11 Maxillary Anterior')\n"
                "- 'shade_recommendation': (string, e.g. 'VITA Bleach Shade BL2' or 'VITA A1')\n"
                "- 'invasiveness_level': (string, e.g. 'Minimally Invasive 0.3mm enamel prep' or 'No-Prep Additive Bonding')\n"
                "- 'treatment_steps': (array of 3-4 strings detailing the clinical sequence)\n"
                "- 'confidence_score': (float between 0.85 and 0.98)\n"
                "- 'specialist_notes': (string, clinical explanation of aesthetic rationale)"
            )
            user_prompt = (
                f"Patient Concerns: {concerns}\n"
                f"Clinical Context: {notes}\n"
                f"Triage Finding: {triage_data.get('finding')}"
            )
            result = call_gemini_api(user_prompt, system_instruction=system_prompt, model=model, api_key=api_key)
            if result and "recommended_procedure" in result:
                return {
                    "agent": "Cosmetic Dentist Specialist Agent",
                    "diagnosis": result.get("aesthetic_diagnosis", "Aesthetic Smile Disharmony suitable for cosmetic restoration"),
                    "procedure": result.get("recommended_procedure", "Porcelain Veneers & Smile Makeover"),
                    "target_teeth": result.get("target_teeth", "Maxillary Anteriors (#6-#11)"),
                    "shade": result.get("shade_recommendation", "VITA BL2 Bleach Shade"),
                    "invasiveness": result.get("invasiveness_level", "Minimally Invasive (0.3mm to 0.5mm)"),
                    "treatment_steps": result.get("treatment_steps", [
                        "Digital intraoral scan, aesthetic facial photography, and 3D digital smile design",
                        "Minimally invasive enamel preservation prep with provisional aesthetic mockup",
                        "Master ceramist lithium disilicate (e.max) fabrication with customized surface micro-texture",
                        "Adhesive resin cementation under rubber dam isolation and occlusal equilibration"
                    ]),
                    "confidence_score": float(result.get("confidence_score", 0.92)),
                    "finding": result.get("specialist_notes", "Formulated custom cosmetic smile makeover prioritizing enamel conservation."),
                    "source": "Google Gemini Pro Cloud Reasoning"
                }

        # Local Clinical Fallback
        c_lower = concerns.lower()
        if "whiten" in c_lower and "veneer" not in c_lower:
            diag = "Intrinsic Enamel Chromogenic Staining"
            proc = "In-Office Power Laser Whitening (Zoom) + Custom Take-Home Maintenance Trays"
            teeth = "Full Arch Maxillary and Mandibular Smile Zone"
            shade = "Targeting 4-6 shade improvement to VITA B1"
            invasiveness = "Non-Invasive Enamel Conditioning"
            steps = [
                "Pre-treatment prophylaxis and gingival barrier application",
                "Four 15-minute cycles of 25% hydrogen peroxide with light activation",
                "Desensitizing ACP gel application and custom fabrication of bleaching splints"
            ]
        elif "chip" in c_lower or "bonding" in c_lower:
            diag = "Coronal Fracture / Enamel Edge Attrition on Anterior Tooth"
            proc = "Direct Nanohybrid Composite Aesthetic Layering & Incisal Recontouring"
            teeth = "Maxillary Central Incisors (#8 or #9)"
            shade = "Multi-opacity VITA A1 / B1 with translucent incisal halo"
            invasiveness = "Ultra-Conservative Selective Enamel Beveling"
            steps = [
                "Shade matching under 5500K daylight-corrected illumination",
                "Conservative infinite-margin bevel placement to seamlessly blend composite",
                "Stratified layering with dentin opacities and enamel translucency",
                "Multi-step diamond polishing to high-luster natural gloss"
            ]
        elif "align" in c_lower or "crooked" in c_lower or "invisalign" in c_lower:
            diag = "Anterior Dental Crowding & Malalignment affecting Smile Arc"
            proc = "Clear Aligner Aesthetic Orthodontic Therapy (Invisalign / ClearCorrect)"
            teeth = "Maxillary and Mandibular Anterior Arch"
            shade = "Pre-aligner shade baseline with post-orthodontic whitening planned"
            invasiveness = "Non-Invasive Biomechanical Removable Therapy"
            steps = [
                "High-definition 3D intraoral optical scanning and ClinCheck computer simulation",
                "Strategic aesthetic composite attachment placement and aligner delivery",
                "Bi-weekly progression checks with IPR (interproximal reduction) if indicated",
                "Final Vivera retention and aesthetic finishing"
            ]
        else:
            diag = "Micro-Crack Lines, Moderate Enamel Dysplasia & Aesthetic Proportional Asymmetry"
            proc = "Custom Porcelain Laminate Veneers (IPS e.max Lithium Disilicate)"
            teeth = "#6 through #11 (Upper Front 6 Smile Zone)"
            shade = "VITA Bleach Shade BL2 with lifelike incisal translucency"
            invasiveness = "Minimally Invasive Selective Enamel Reduction (0.3mm to 0.5mm)"
            steps = [
                "Digital smile design mockup and intraoral aesthetic trial try-in",
                "Conservative enamel preparation preserving peripheral enamel seal for maximum bond strength",
                "Chairside provisionalization mirroring approved smile design",
                "Adhesive resin cementation with light-cure aesthetic luting composite"
            ]

        return {
            "agent": "Cosmetic Dentist Specialist Agent",
            "diagnosis": diag,
            "procedure": proc,
            "target_teeth": teeth,
            "shade": shade,
            "invasiveness": invasiveness,
            "treatment_steps": steps,
            "confidence_score": 0.94,
            "finding": f"Crafted comprehensive cosmetic plan: {proc} targeting {teeth}.",
            "source": "Local Dental Knowledge Base"
        }


# ==============================================================================
# 3. RADIOGRAPHIC & VISUAL ANALYST AGENT (MULTIMODAL X-RAY & SMILE PHOTO)
# ==============================================================================

class RadiographicVisualAgent:
    """Analyzes dental X-rays, bitewings, periapicals, panorex, and clinical smile photos."""

    def evaluate(self, patient: DentalIntakeInput) -> Dict[str, Any]:
        api_key, model = get_gemini_config()
        image_data = patient.image_data
        image_type = patient.image_type or "xray"
        concerns = patient.get_effective_concerns()

        # If user supplied real image data (base64) or prompt text with Gemini API
        if api_key and image_data:
            system_prompt = (
                "You are the HouseAI Radiographic & Visual Analyst Agent. You evaluate dental X-rays, "
                "bitewings, periapical films, panoramic scans, and intraoral clinical photographs.\n"
                "Evaluate the image for:\n"
                "1. Biological width and alveolar crest bone heights\n"
                "2. Absence or presence of periapical radiolucencies / pulpal pathology\n"
                "3. Enamel thickness available for aesthetic adhesive bonding\n"
                "4. Interproximal bone levels and smile arc contour\n"
                "Return ONLY a JSON object with these exact keys:\n"
                "- 'imaging_type_identified': (string, e.g. 'Periapical X-Ray', 'Panoramic Radiograph', 'Frontal Smile Photograph')\n"
                "- 'bone_levels': (string, e.g. 'Normal alveolar crest height with no vertical defect')\n"
                "- 'periapical_status': (string, e.g. 'Intact periodontal ligament space; no apical radiolucency')\n"
                "- 'bonding_suitability': (string, e.g. 'Excellent; robust enamel thickness on facial surface')\n"
                "- 'summary_findings': (string, 1-2 concise clinical sentences summarizing radiographic stability)"
            )
            prompt = f"Analyze this dental {image_type} for patient concerns: {concerns}"
            result = call_gemini_api(
                prompt,
                system_instruction=system_prompt,
                image_base64=image_data,
                model=model,
                api_key=api_key
            )
            if result and "summary_findings" in result:
                return {
                    "agent": "Radiographic & Visual Analyst Agent",
                    "imaging_type": result.get("imaging_type_identified", "Dental Radiograph / Photography"),
                    "bone_levels": result.get("bone_levels", "Within normal limits"),
                    "periapical_status": result.get("periapical_status", "Clear of periapical pathology"),
                    "bonding_suitability": result.get("bonding_suitability", "Suitable for adhesive porcelain bonding"),
                    "finding": result.get("summary_findings", "Radiographic review confirms healthy periodontal framework."),
                    "source": "Google Gemini Pro Multimodal Vision"
                }

        # Local Clinical Heuristic Fallback
        c_lower = concerns.lower()
        if "abscess" in c_lower or "severe pain" in c_lower:
            return {
                "agent": "Radiographic & Visual Analyst Agent",
                "imaging_type": "Periapical Radiograph (Simulated)",
                "bone_levels": "Widened periodontal ligament space at apical third",
                "periapical_status": "Circumscribed periapical radiolucency suspicious for apical periodontitis",
                "bonding_suitability": "Contraindicated until endodontic resolution achieved",
                "finding": "Identified periapical radiolucency; patient requires endodontic therapy prior to any cosmetic crown or veneer placement.",
                "source": "Local Dental Radiographic Rules"
            }

        return {
            "agent": "Radiographic & Visual Analyst Agent",
            "imaging_type": "Digital Bitewing & Panoramic Series (Simulated)",
            "bone_levels": "Alveolar crest intact at 1.5mm apical to cementoenamel junction; robust horizontal bone support",
            "periapical_status": "Uniform lamina dura and intact periodontal ligament space; no apical lesions detected",
            "bonding_suitability": "Optimal enamel thickness (0.8mm-1.2mm on facial surfaces) provides ideal substrate for silane-treated ceramic bonding",
            "finding": "Radiographic assessment confirms healthy bone support and sound root structures; clear for aesthetic veneer preparation.",
            "source": "Local Dental Radiographic Rules"
        }


# ==============================================================================
# 4. INSURANCE & BILLING PARSER AGENT
# ==============================================================================

class InsuranceBillingAgent:
    """Parses text walls, policy documents, and insurance cards for dental benefits and cosmetic exclusions."""

    def evaluate(self, patient: DentalIntakeInput, specialist_data: Dict[str, Any]) -> Dict[str, Any]:
        api_key, model = get_gemini_config()
        concerns = patient.get_effective_concerns()
        raw_wall = patient.raw_text_wall or ""
        ins_notes = patient.insurance_notes or ""
        combined_text = f"{raw_wall}\n{ins_notes}".strip()

        if api_key and combined_text:
            system_prompt = (
                "You are the HouseAI Insurance & Billing Agent specializing in dental billing, CDT codes, "
                "and cosmetic exclusion policies.\n"
                "Evaluate the text for:\n"
                "- Insurance carrier (Delta Dental, MetLife, Cigna Dental, Guardian, Aetna, Humana, etc.)\n"
                "- Whether the requested cosmetic procedures (veneers, whitening, bonding) are covered or excluded\n"
                "- Applicable dental CDT codes (e.g., D2962 Porcelain Veneer, D9972 Teeth Whitening, D8090 Ortho, D0150 Exam)\n"
                "- Estimated patient out-of-pocket responsibility percentage\n"
                "- Financing alternatives (CareCredit, Proceed Finance, in-house aesthetic memberships)\n"
                "Return ONLY a JSON object with these exact keys:\n"
                "- 'carrier_detected': (string)\n"
                "- 'cosmetic_coverage_status': (string, e.g. 'Excluded - Elective Aesthetic' or 'Partially Covered with Prior Auth')\n"
                "- 'applicable_cdt_codes': (array of strings with code and procedure name)\n"
                "- 'estimated_patient_responsibility_percent': (integer 0 to 100)\n"
                "- 'financing_options': (string)\n"
                "- 'billing_notes': (string, 1-2 sentences summarizing coverage analysis)"
            )
            user_prompt = f"Patient Concerns: {concerns}\nInsurance / Intake Wall of Text:\n{combined_text}"
            result = call_gemini_api(user_prompt, system_instruction=system_prompt, model=model, api_key=api_key)
            if result and "applicable_cdt_codes" in result:
                return {
                    "agent": "Insurance & Billing Agent",
                    "carrier_detected": result.get("carrier_detected", "Commercial PPO Dental"),
                    "cosmetic_coverage_status": result.get("cosmetic_coverage_status", "Excluded - Elective Cosmetic"),
                    "applicable_cdt_codes": result.get("applicable_cdt_codes", ["D2962 (Porcelain Veneer)", "D0150 (Comprehensive Exam)"]),
                    "estimated_patient_responsibility_percent": int(result.get("estimated_patient_responsibility_percent", 100)),
                    "financing_options": result.get("financing_options", "Eligible for 0% APR CareCredit and in-house installment plans."),
                    "finding": result.get("billing_notes", "Parsed insurance details: aesthetic restorations fall under elective coverage."),
                    "source": "Google Gemini Pro Cloud Reasoning"
                }

        # Local Clinical Fallback
        c_lower = concerns.lower()
        t_lower = combined_text.lower()

        carrier = "Out-of-Pocket / Commercial Dental PPO"
        if "delta" in t_lower:
            carrier = "Delta Dental Premier / PPO"
        elif "metlife" in t_lower:
            carrier = "MetLife Dental"
        elif "cigna" in t_lower:
            carrier = "Cigna Dental Health"
        elif "guardian" in t_lower:
            carrier = "Guardian Dental Advantage"
        elif "aetna" in t_lower:
            carrier = "Aetna Dental PPO"

        if "whiten" in c_lower:
            cdt = ["D9972 (External Bleaching - Per Arch)", "D0150 (Comprehensive Oral Evaluation)"]
            status = "Standard Insurance Exclusion (Elective Aesthetic)"
            patient_pct = 100
        elif "align" in c_lower or "invisalign" in c_lower:
            cdt = ["D8090 (Comprehensive Orthodontic Treatment of Adult Dentition)", "D0330 (Panoramic Radiographic Image)"]
            status = "Lifetime Orthodontic Maximum May Apply ($1,500 - $2,500 allowance)"
            patient_pct = 65
        elif "chip" in c_lower or "fracture" in c_lower:
            cdt = ["D2335 (Resin-based Composite - 4 or More Surfaces / Incisal Angle)", "D0220 (Intraoral Periapical First Film)"]
            status = "Partially Covered (Trauma / Restorative Medical Necessity)"
            patient_pct = 30
        else:
            cdt = ["D2962 (Labial Veneer - Porcelain Laminate)", "D0470 (Diagnostic Casts)", "D0150 (Comprehensive Oral Exam)"]
            status = "Standard Insurance Exclusion (Elective Cosmetic Smile Makeover)"
            patient_pct = 100

        return {
            "agent": "Insurance & Billing Agent",
            "carrier_detected": carrier,
            "cosmetic_coverage_status": status,
            "applicable_cdt_codes": cdt,
            "estimated_patient_responsibility_percent": patient_pct,
            "financing_options": "CareCredit 12-month interest-free financing, Proceed Finance, and in-house dental savings club.",
            "finding": f"Detected {carrier}; {status}. Formulated CDT code breakdown ({', '.join(cdt[:2])}).",
            "source": "Local Dental Billing Engine"
        }


# ==============================================================================
# 5. SAFETY CRITIC AGENT
# ==============================================================================

class SafetyCriticAgent:
    """Dental peer reviewer: validates biological width, periodontal health, and contraindications before cosmetic prep."""

    def evaluate(
        self,
        patient: DentalIntakeInput,
        triage_data: Dict[str, Any],
        specialist_data: Dict[str, Any],
        imaging_data: Dict[str, Any],
        insurance_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        api_key, model = get_gemini_config()
        concerns = patient.get_effective_concerns()

        if api_key:
            system_prompt = (
                "You are the HouseAI Dental Safety Critic Agent. You serve as the senior clinical peer-reviewer.\n"
                "Critically evaluate the proposed cosmetic plan for:\n"
                "1. Periodontal contraindications (e.g. active gingivitis or pocket depths >4mm that must be resolved first)\n"
                "2. Occlusal trauma / severe bruxism that could fracture porcelain veneers without a protective nightguard\n"
                "3. Tooth vitality and conservation of enamel substrate (preserving 0.3-0.5mm minimum enamel for etching)\n"
                "4. Confirming final clinical urgency score (1 to 5) and urgency color hex code\n"
                "Return ONLY a JSON object with these exact keys:\n"
                "- 'safety_clearance': (string, e.g. 'Approved with Protective Nightguard Protocol' or 'Conditional on Periodontal Prophy')\n"
                "- 'contraindications_ruled_out': (array of 2-3 clinical conditions verified)\n"
                "- 'final_urgency_score': (integer 1-5)\n"
                "- 'final_urgency_color': (hex color string: #10b981 for 1, #3b82f6 for 2, #f59e0b for 3, #f97316 for 4, #ef4444 for 5)\n"
                "- 'critic_assessment': (string, 1-2 concise sentences summarizing peer review consensus)"
            )
            user_prompt = (
                f"Proposed Procedure: {specialist_data.get('procedure')}\n"
                f"Triage Urgency: {triage_data.get('urgency_tier')} (Score {triage_data.get('urgency_score')})\n"
                f"Imaging Findings: {imaging_data.get('finding')}\n"
                f"Patient Concerns: {concerns}"
            )
            result = call_gemini_api(user_prompt, system_instruction=system_prompt, model=model, api_key=api_key)
            if result and "safety_clearance" in result:
                score = int(result.get("final_urgency_score", triage_data.get("urgency_score", 1)))
                score = max(1, min(5, score))
                tier_info = DENTAL_URGENCY_LEVELS.get(score, DENTAL_URGENCY_LEVELS[1])
                return {
                    "agent": "Safety Critic Agent",
                    "safety_clearance": result.get("safety_clearance", "Approved for aesthetic protocol"),
                    "contraindications_checked": result.get("contraindications_ruled_out", [
                        "Ruled out active periodontal pocketing > 4mm",
                        "Verified adequate healthy enamel substrate for silane resin bonding",
                        "Mandated post-operative nocturnal occlusal guard to safeguard restorations"
                    ]),
                    "final_urgency_score": score,
                    "final_urgency_tier": tier_info["name"],
                    "final_urgency_color": tier_info["color"],
                    "finding": result.get("critic_assessment", "Safety audit verified biological width and stable occlusal dynamics."),
                    "source": "Google Gemini Pro Cloud Reasoning"
                }

        # Local Clinical Fallback
        score = triage_data.get("urgency_score", 1)
        tier_info = DENTAL_URGENCY_LEVELS.get(score, DENTAL_URGENCY_LEVELS[1])
        return {
            "agent": "Safety Critic Agent",
            "safety_clearance": "Approved with Protective Occlusal Protocol",
            "contraindications_checked": [
                "Ruled out active periodontal inflammation and subgingival calculus",
                "Confirmed sufficient healthy enamel (>0.5mm) across maxillary facial surfaces",
                "Prescribed custom hard/soft occlusal nightguard for sleep bruxism protection"
            ],
            "final_urgency_score": score,
            "final_urgency_tier": tier_info["name"],
            "final_urgency_color": tier_info["color"],
            "finding": "Safety review confirms biological width integrity; recommended custom occlusal nightguard to guarantee ceramic longevity.",
            "source": "Local Dental Peer Review"
        }


# ==============================================================================
# 6. DENTAL SWARM ORCHESTRATOR ENGINE
# ==============================================================================

class DentalSwarmEngine:
    """Coordinates the 5 collaborative dental agents into a cohesive consensus report."""

    def __init__(self):
        self.triage_nurse = DentalTriageNurseAgent()
        self.specialist = CosmeticDentistSpecialistAgent()
        self.radiographic = RadiographicVisualAgent()
        self.insurance = InsuranceBillingAgent()
        self.critic = SafetyCriticAgent()

    def process_case(self, payload: Dict[str, Any]) -> DentalDiagnosticResponse:
        patient = DentalIntakeInput(**payload) if not isinstance(payload, DentalIntakeInput) else payload

        # 1. Triage & Acuity Evaluation
        triage_res = self.triage_nurse.evaluate(patient)

        # 2. Cosmetic & Restorative Specialist Design
        specialist_res = self.specialist.evaluate(patient, triage_res)

        # 3. Radiographic & Imagery Evaluation
        imaging_res = self.radiographic.evaluate(patient)

        # 4. Insurance & Billing Parsing
        insurance_res = self.insurance.evaluate(patient, specialist_res)

        # 5. Safety Peer Review & Consensus
        critic_res = self.critic.evaluate(patient, triage_res, specialist_res, imaging_res, insurance_res)

        # Determine procedure pricing, chair duration, and out-of-pocket financials
        proc_title = specialist_res.get("procedure", "Porcelain Veneers").lower()
        if "whitening" in proc_title or "bleaching" in proc_title:
            est_price = 650.00
            est_range = "$500 - $800"
            est_minutes = 75
            est_hours = 1.25
        elif "bonding" in proc_title or "layering" in proc_title:
            est_price = 1400.00
            est_range = "$1,000 - $1,800 ($350 - $450 / tooth)"
            est_minutes = 90
            est_hours = 1.5
        elif "aligner" in proc_title or "invisalign" in proc_title or "ortho" in proc_title:
            est_price = 5500.00
            est_range = "$4,500 - $6,800 full case"
            est_minutes = 60
            est_hours = 1.0
        elif "repair" in proc_title or "emergency" in proc_title:
            est_price = 850.00
            est_range = "$650 - $1,100"
            est_minutes = 60
            est_hours = 1.0
        else:
            # Multi-unit porcelain veneers / smile makeover
            est_price = 8400.00
            est_range = "$7,200 - $9,600 ($1,200 - $1,600 / tooth)"
            est_minutes = 150
            est_hours = 2.5

        # Build structured cosmetic breakdown
        cosmetic_dict = {
            "aesthetic_goal": specialist_res.get("diagnosis", "Smile Aesthetics"),
            "recommended_procedure": specialist_res.get("procedure", "Porcelain Veneers"),
            "target_teeth": specialist_res.get("target_teeth", "#6-#11 Maxillary Sextant"),
            "shade_recommendation": specialist_res.get("shade", "VITA BL2 Bleach Shade"),
            "invasiveness_level": specialist_res.get("invasiveness", "Minimally Invasive"),
            "clinical_steps": specialist_res.get("treatment_steps", []),
            "estimated_price_usd": est_price,
            "estimated_price_range": est_range,
            "estimated_chair_time_hours": est_hours,
            "estimated_duration_minutes": est_minutes,
            "lab_turnaround_days": 10 if "veneer" in proc_title else 0,
            "maintenance_requirements": "Custom nightguard to prevent ceramic fractures",
        }

        # Calculate estimated insurance coverage vs patient out-of-pocket responsibility
        resp_pct = insurance_res.get("estimated_patient_responsibility_percent", 100)
        coverage_usd = round(est_price * (100 - resp_pct) / 100.0, 2)
        out_of_pocket_usd = round(est_price - coverage_usd, 2)

        # Build structured insurance breakdown
        insurance_dict = {
            "carrier_detected": insurance_res.get("carrier_detected", "Commercial Dental PPO"),
            "cosmetic_coverage_status": insurance_res.get("cosmetic_coverage_status", "Excluded"),
            "applicable_cdt_codes": insurance_res.get("applicable_cdt_codes", []),
            "estimated_patient_responsibility_percent": resp_pct,
            "estimated_insurance_coverage_usd": coverage_usd,
            "estimated_out_of_pocket_usd": out_of_pocket_usd,
            "financing_options": insurance_res.get("financing_options", "CareCredit / In-House financing"),
        }

        urgency_score = critic_res.get("final_urgency_score", triage_res.get("urgency_score", 1))
        urgency_tier = critic_res.get("final_urgency_tier", triage_res.get("urgency_tier", "Elective"))
        urgency_color = critic_res.get("final_urgency_color", triage_res.get("urgency_color", "#10b981"))

        reasoning_log = [
            f"[Dental Triage Nurse]: {triage_res['finding']} (Tier: {urgency_tier}, Score: {urgency_score})",
            f"[Cosmetic Dentist Specialist]: Recommended {specialist_res.get('procedure')} targeting {specialist_res.get('target_teeth')} with shade {specialist_res.get('shade')} (Estimated: ${est_price:,.2f}, {est_minutes} mins).",
            f"[Radiographic Analyst]: {imaging_res.get('finding')}",
            f"[Insurance Agent]: {insurance_res.get('finding')} (Patient responsibility: {resp_pct}% / ${out_of_pocket_usd:,.2f})",
            f"[Safety Critic]: {critic_res.get('finding')} (Urgency Color: {urgency_color})"
        ]

        treatment_summary = (
            f"Recommended Procedure: {specialist_res.get('procedure')}. "
            f"Target: {specialist_res.get('target_teeth')}. Shade: {specialist_res.get('shade')}. "
            f"Approach: {specialist_res.get('invasiveness')}. "
            f"Estimated Fee: ${est_price:,.2f} ({est_range}). Chair Time: {est_minutes} min ({est_hours} hrs). "
            f"Safety Protocol: {critic_res.get('safety_clearance')}."
        )

        return DentalDiagnosticResponse(
            consensus_diagnosis=specialist_res.get("diagnosis", "Aesthetic Smile Disharmony"),
            specialty_required=triage_res.get("specialty_required", "Cosmetic & Restorative Dentistry"),
            urgency_tier=urgency_tier,
            urgency_score=urgency_score,
            urgency_color=urgency_color,
            confidence_score=float(specialist_res.get("confidence_score", 0.94)),
            treatment_plan=treatment_summary,
            estimated_price_usd=est_price,
            estimated_price_display=f"${est_price:,.2f}",
            estimated_duration_minutes=est_minutes,
            cosmetic_breakdown=cosmetic_dict,
            insurance_breakdown=insurance_dict,
            imaging_findings=imaging_res.get("finding", "Radiographic stability confirmed."),
            reasoning_log=reasoning_log,
            demo_notice=DEMO_DISCLAIMER,
        )


# Backward compatibility alias
HouseAIEngine = DentalSwarmEngine
