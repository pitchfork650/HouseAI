"""Streamlit demo dashboard for ConsensusFlow's diagnostic and scheduling APIs."""

from __future__ import annotations

import html
import os
from datetime import datetime

import requests
import streamlit as st

API_BASE_URL = os.getenv("CONSENSUSFLOW_API_URL", "http://localhost:8000").rstrip("/")

st.set_page_config(page_title="ConsensusFlow | Care coordination", page_icon="✳", layout="wide")
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap');
:root { --ink:#142d32; --muted:#637a7e; --teal:#087f73; --line:#e4eceb; --surface:#fff; }
html, body, [class*="css"] { font-family:'DM Sans',sans-serif; color:var(--ink); }
.stApp, [data-testid="stAppViewContainer"], [data-testid="stMain"] { color:#142d32; }
.stMarkdown, .stMarkdown p, .stMarkdown li, .stMarkdown h1, .stMarkdown h2, .stMarkdown h3,
[data-testid="stWidgetLabel"], [data-testid="stWidgetLabel"] p { color:#263f44 !important; }
[data-testid="stMarkdownContainer"] { color:#263f44; }
.stApp { background:radial-gradient(ellipse at 88% 5%,#e7ddd0 0,transparent 32%),linear-gradient(180deg,#f2ede5 0,#f4f1eb 420px,#f1eee8 100%); }
.stApp::before { content:""; position:fixed; inset:0; z-index:0; pointer-events:none; opacity:.52;
  background-image:
    repeating-radial-gradient(circle at 96% 23%,transparent 0 29px,#9c896d16 30px 31px,transparent 32px 50px),
    radial-gradient(circle,#927d5d1c 1px,transparent 1.5px),
    linear-gradient(90deg,transparent 46%,#927d5d0b 46% 54%,transparent 54%),
    linear-gradient(transparent 46%,#927d5d0b 46% 54%,transparent 54%);
  background-size:auto,28px 28px,32px 32px,32px 32px;
  background-position:center,10px 13px,14px 17px,14px 17px;
  mask-image:linear-gradient(90deg,transparent 0%,#000 12%,#000 91%,transparent 100%); }
[data-testid="stMain"] { position:relative; z-index:1; }
[data-testid="stHeader"], footer, #MainMenu { visibility:hidden; height:0; }
.block-container { max-width:1240px; padding:1.5rem 2rem 3rem; }
.hero { position:relative; overflow:hidden; background:linear-gradient(115deg,#082f34,#075a55 68%,#087064); color:#fff; border-radius:22px; padding:27px 32px 26px; margin:0 0 24px; box-shadow:0 16px 34px #164b451c; animation:hero-enter .65s cubic-bezier(.2,.75,.25,1) both; }
.hero:after { content:""; position:absolute; width:260px; height:260px; right:7%; top:-178px; border:1px solid #ffffff26; border-radius:50%; box-shadow:0 0 0 32px #ffffff0b,0 0 0 68px #ffffff08; }
.brand { display:flex; align-items:center; gap:9px; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.16em; color:#e0fff7; }
.brand-mark { display:grid; place-items:center; width:25px; height:25px; border-radius:8px; background:#ffffff1b; font-size:16px; }
.hero h1 { font:800 clamp(26px,3vw,38px)/1.13 Manrope,sans-serif; letter-spacing:-1.3px; margin:19px 0 7px; color:#59f2d0 !important; text-shadow:0 1px 1px #001d1b55; }
.hero p { color:#8fffe4 !important; margin:0; font-size:14px; }
.hero-meta { position:absolute; right:31px; bottom:27px; z-index:1; color:#edfffb; font-size:12px; }
.section-head { display:flex; align-items:end; justify-content:space-between; margin:0 0 12px; }
.section-head h2 { font:700 18px Manrope,sans-serif; margin:0; letter-spacing:-.3px; }
.section-head p { margin:4px 0 0; color:var(--muted); font-size:13px; }
div[data-testid="stForm"] { background:#fffefa; border:1px solid #e4ddd2; border-radius:17px; padding:21px 24px 18px; box-shadow:0 10px 26px #463d2d0b; }
div[data-testid="stForm"] label { color:#40585c; font-weight:600; font-size:13px; }
div[data-testid="stForm"] input, div[data-testid="stForm"] textarea,
div[data-testid="stForm"] [data-baseweb="select"] > div { border-radius:9px; border-color:#dce7e5; background:#fbfdfd; color:#20383d !important; }
div[data-testid="stForm"] input::placeholder, div[data-testid="stForm"] textarea::placeholder { color:#718488 !important; opacity:1; }
div[data-testid="stForm"] [data-baseweb="select"] *, div[data-testid="stForm"] [data-baseweb="select"] input { color:#20383d !important; }
div[data-testid="stForm"] [data-baseweb="select"] svg { fill:#51696d; }
div[data-testid="stForm"] textarea { min-height:84px; }
div[data-testid="stFormSubmitButton"] button { background:linear-gradient(100deg,#087f73,#119589); color:white; border:0; border-radius:10px; font-weight:700; min-height:44px; box-shadow:0 5px 12px #087f7324; transition:transform .15s,box-shadow .15s; }
div[data-testid="stFormSubmitButton"] button:hover { background:#076f65; color:white; transform:translateY(-1px); box-shadow:0 8px 16px #087f7330; }
.workspace-head { display:flex; justify-content:space-between; align-items:center; margin:25px 0 12px; }
.workspace-head h2 { font:700 18px Manrope,sans-serif; margin:0; }
.live { color:#168172; font-size:12px; font-weight:700; }
.live i { display:inline-block; width:7px; height:7px; border-radius:50%; background:#26a68c; margin-right:6px; box-shadow:0 0 0 4px #dff4ee; }
.card { background:#fffefa; border:1px solid #e4ddd2; border-radius:17px; padding:20px 21px; box-shadow:0 10px 26px #463d2d0b; height:100%; }
.card, .card * { color:inherit; }
.card-title, .activity-agent, .report-text, .report-list li, .doctor-name, .appt-date { color:#203a3f; }
.card-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:15px; }
.card-title { font:700 16px Manrope,sans-serif; letter-spacing:-.25px; color:#1a3539; }
.badge { display:inline-flex; align-items:center; gap:5px; white-space:nowrap; border-radius:999px; background:#e8f5f1; color:#147668; padding:5px 9px; font-size:10px; line-height:1; font-weight:700; letter-spacing:.02em; }
.badge.neutral { background:#f0f4f4; color:#63777a; }
.activity-row { display:grid; grid-template-columns:24px 1fr; column-gap:10px; position:relative; padding:1px 0 15px; }
.activity-row:not(:last-child):before { content:""; position:absolute; left:11px; top:23px; bottom:0; width:1px; background:#dcebe8; }
.activity-icon { z-index:1; width:23px; height:23px; display:grid; place-items:center; border-radius:8px; background:#eaf6f3; color:#188477; font-size:11px; }
.activity-agent { font-weight:700; font-size:12px; color:#25454a; margin:2px 0 3px; }
.activity-text { font-size:12px; line-height:1.48; color:#718286; }
.case-meta { color:#75878a; font-size:11px; margin-top:-8px; margin-bottom:14px; }
.report-section { border-top:1px solid #edf1f1; padding:12px 0 0; margin-top:11px; }
.report-label { color:#829295; font-size:9px; font-weight:700; letter-spacing:.13em; text-transform:uppercase; margin-bottom:5px; }
.report-text { color:#40585c; font-size:12px; line-height:1.55; }
.report-list { list-style:none; padding:0; margin:0; }
.report-list li { color:#40585c; font-size:12px; line-height:1.55; padding:2px 0 2px 14px; position:relative; }
.report-list li:before { content:""; position:absolute; left:2px; top:9px; width:5px; height:5px; background:#42a693; border-radius:50%; }
.appt-hero { background:linear-gradient(135deg,#eaf8f4,#f2faf8); border:1px solid #d8eee7; border-radius:13px; padding:15px; margin:3px 0 14px; }
.doctor-name { font:700 17px Manrope,sans-serif; color:#155d55; margin-bottom:2px; }
.doctor-spec { font-size:11px; color:#66827e; }
.appt-date { color:#1a514c; font-weight:700; font-size:13px; margin:14px 0 5px; }
.appt-location { color:#617a77; font-size:11px; }
.prep { background:#f7f9f9; border-radius:10px; color:#52696c; padding:11px 12px; font-size:12px; line-height:1.5; }
.disclaimer { color:#94a1a3; font-size:10px; line-height:1.4; margin-top:14px; }
.empty { background:#fffefa; border:1px dashed #d6cdbf; border-radius:17px; padding:28px; text-align:center; color:#718488; font-size:13px; }
.empty-icon { display:grid; place-items:center; width:38px; height:38px; margin:0 auto 11px; background:#eaf6f3; color:#138174; border-radius:13px; font-size:18px; }
.flow { display:flex; align-items:center; gap:8px; margin:20px 0 12px; padding:3px 2px 12px; overflow-x:auto; scrollbar-color:#c5d9d3 transparent; scrollbar-width:thin; }
.flow-step { flex:1 0 145px; background:#fffefa; border:1px solid #ded8cd; border-radius:11px; padding:9px 7px; text-align:center; color:#40585c; font-size:10px; font-weight:700; box-shadow:0 3px 9px #463d2d08; }
.flow-step span { display:block; color:#168477; font-size:9px; margin-bottom:3px; letter-spacing:.08em; }
.flow-arrow { flex:none; color:#168477; font-size:17px; font-weight:500; animation:arrow-glow 2.4s ease-in-out infinite; }
.analysis-title { font:700 18px Manrope,sans-serif; color:#1a3539; margin:22px 0 4px; }
.analysis-sub { color:#728286; font-size:12px; margin-bottom:12px; }
.agent-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
.agent-card { background:#fffefa; border:1px solid #e4ddd2; border-radius:15px; padding:15px 16px; box-shadow:0 7px 18px #463d2d08; animation:rise-in .55s cubic-bezier(.2,.75,.25,1) both; }
.agent-card:nth-child(2) { animation-delay:.08s; }
.agent-card:nth-child(3) { animation-delay:.16s; }
.agent-card:nth-child(4) { animation-delay:.24s; }
.agent-top { display:flex; align-items:center; gap:9px; margin-bottom:9px; }
.agent-icon { display:grid; place-items:center; width:28px; height:28px; flex:none; border-radius:9px; background:#e8f5f1; color:#087f73; font-size:14px; }
.agent-focus { font-size:9px; color:#829295; text-transform:uppercase; letter-spacing:.1em; font-weight:700; }
.agent-name { font:700 13px Manrope,sans-serif; color:#203a3f; margin-top:1px; }
.agent-finding { color:#586e72; font-size:11px; line-height:1.5; }
.agent-signals { display:flex; flex-wrap:wrap; gap:5px; margin-top:10px; }
.signal { color:#58716d; background:#f0f5f2; border-radius:999px; padding:4px 7px; font-size:9px; }
.consensus { position:relative; margin:14px 0 22px; padding:18px 20px; border:1px solid #b8ded4; border-radius:15px; background:linear-gradient(110deg,#e4f5ef,#f4f8f2); box-shadow:0 8px 20px #174f430b; animation:consensus-arrive .75s .3s cubic-bezier(.2,.75,.25,1) both; }
.consensus:before { content:""; position:absolute; width:1px; height:15px; background:#9dcfc1; left:50%; top:-15px; }
.consensus-kicker { color:#14786b; font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:.14em; }
.consensus-line { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:4px; }
.consensus-summary { font:700 15px Manrope,sans-serif; color:#194d47; }
.consensus-score { white-space:nowrap; border-radius:999px; background:#fffefa; color:#14786b; padding:6px 9px; font-size:10px; font-weight:800; }
.output-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:14px 0; }
.output-chip { border:1px solid #e7e2d8; background:#faf8f3; border-radius:11px; padding:10px 12px; }
.output-chip .report-label { margin:0 0 4px; }
.output-value { font:700 14px Manrope,sans-serif; color:#1d514b; }
.pathway { border-left:3px solid #16a08c; border-radius:4px 10px 10px 4px; background:#f3f7f4; padding:11px 13px; margin-top:13px; color:#40585c; font-size:11px; line-height:1.5; }
.redflag { border:1px solid #eed0c4; background:#fff4ee; border-radius:10px; color:#854833; padding:10px 12px; font-size:11px; margin-top:10px; }
.emergency { border-color:#e9c2b4; background:#fff0e9; }
@keyframes rise-in { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
@keyframes hero-enter { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
@keyframes arrow-glow { 0%,100% { opacity:.52; transform:translateX(0); } 50% { opacity:1; transform:translateX(3px); } }
@keyframes consensus-arrive { from { opacity:0; transform:translateY(9px) scale(.99); } to { opacity:1; transform:translateY(0) scale(1); } }
@media(prefers-reduced-motion:reduce) {
  *, *::before, *::after { animation-duration:.01ms !important; animation-iteration-count:1 !important; scroll-behavior:auto !important; }
}
@media(max-width:700px) { .agent-grid{grid-template-columns:1fr}.flow-step{flex-basis:138px}.consensus-line{align-items:flex-start;flex-direction:column} }
div[data-testid="stAlert"] { border-radius:12px; }
@media(max-width:700px) { .block-container{padding:1rem 1rem 2rem}.hero{padding:23px 22px}.hero-meta{position:static;margin-top:16px}.card{padding:17px}.card-head{align-items:flex-start} }
</style>
""", unsafe_allow_html=True)


def safe(value: object) -> str:
    """Escape API-provided text before embedding it into dashboard HTML."""
    return html.escape(str(value), quote=True)


st.markdown("""
<div class="hero">
  <div class="brand"><span class="brand-mark">✳</span> ConsensusFlow</div>
  <h1>From clinical debate<br>to coordinated care.</h1>
  <p>One connected view of clinical reasoning and the next step in care.</p>
  <div class="hero-meta">CARE COORDINATION · DEMO WORKSPACE</div>
</div>
""", unsafe_allow_html=True)

st.markdown('<div class="section-head"><div><h2>Patient information</h2><p>Enter the HouseAI intake fields. Specialty and urgency are determined by the analysis.</p></div></div>', unsafe_allow_html=True)
with st.form("case_form"):
    patient_id = st.text_input("Patient ID", value="P-2088", help="Use a synthetic demo ID; do not enter a real patient identifier.")
    age = st.number_input("Age", min_value=1, max_value=120, value=62, step=1)
    symptoms = st.text_area("Symptoms / primary concern", value="Substernal chest pain radiating to left jaw, diaphoresis", height=75, placeholder="Describe the main symptoms or concern")
    lab_notes = st.text_area("Lab notes / additional case information", value="ECG reveals ST segment depression in leads V4-V6, elevated troponin I", height=75, placeholder="Enter synthetic demo lab notes or additional context")
    submitted = st.form_submit_button("✦  Analyze case and find the care pathway", use_container_width=True)

if "case_result" not in st.session_state:
    st.session_state.case_result = None

if submitted:
    try:
        with st.spinner("Clinical agents are reviewing the case and building consensus…"):
            response = requests.post(
                f"{API_BASE_URL}/api/diagnose",
                json={"patient_id": patient_id, "age": int(age), "symptoms": symptoms, "lab_notes": lab_notes},
                timeout=10,
            )
            response.raise_for_status()
            diagnostic = response.json()
            routing = diagnostic["care_routing"]
            appointment = None
            if not routing["emergency_escalation"]:
                booking_response = requests.post(
                    f"{API_BASE_URL}/api/schedule",
                    json={"urgency_tier": routing["urgency_tier"], "specialty": routing["specialty"]},
                    timeout=10,
                )
                booking_response.raise_for_status()
                appointment = booking_response.json()
            st.session_state.case_result = {"diagnostic": diagnostic, "appointment": appointment}
    except requests.RequestException as exc:
        st.error(f"Could not reach the ConsensusFlow API at {API_BASE_URL}: {exc}")

result = st.session_state.case_result
if result:
    stages = ["Patient information", "Swarm analysis", "Agent consensus", "Urgency + specialty", "Care routing", "Scheduling"]
    flow_html = '<div class="flow" aria-label="Patient information flows through analysis, consensus, routing, and scheduling">'
    for index, stage in enumerate(stages):
        flow_html += f'<div class="flow-step"><span>{index + 1:02d}</span>{safe(stage)}</div>'
        if index < len(stages) - 1:
            flow_html += '<div class="flow-arrow" aria-hidden="true">→</div>'
    flow_html += '</div>'
    st.markdown(flow_html, unsafe_allow_html=True)
    st.markdown('<div class="analysis-title">Swarm clinical analysis</div><div class="analysis-sub">Independent demo agents reviewed the submitted symptoms and case context.</div>', unsafe_allow_html=True)
    diagnostic = result["diagnostic"]
    agents_html = []
    for agent in diagnostic["agents"]:
        signals = "".join(f'<span class="signal">{safe(signal)}</span>' for signal in agent["signals"])
        agents_html.append(
            f'<div class="agent-card"><div class="agent-top"><div class="agent-icon">{safe(agent["icon"])}</div>'
            f'<div><div class="agent-focus">{safe(agent["focus"])}</div><div class="agent-name">{safe(agent["name"])}</div></div></div>'
            f'<div class="agent-finding">{safe(agent["finding"])}</div><div class="agent-signals">{signals}</div></div>'
        )
    st.markdown('<div class="agent-grid">' + "".join(agents_html) + '</div>', unsafe_allow_html=True)
    consensus = diagnostic["consensus"]
    st.markdown(
        f'<div class="consensus"><div class="consensus-kicker">✳ &nbsp; Agent consensus · {safe(consensus["level"])}</div>'
        f'<div class="consensus-line"><div class="consensus-summary">{safe(consensus["summary"])}</div>'
        f'<div class="consensus-score">{safe(consensus["score_percent"])}% ALIGNMENT</div></div></div>',
        unsafe_allow_html=True,
    )
    report = result["diagnostic"]["report"]
    routing = diagnostic["care_routing"]
    red_flags_html = (
        '<div class="redflag"><b>Safety escalation:</b> ' + ", ".join(safe(flag) for flag in report["red_flags"])
        + '. Seek emergency medical care now; this prototype does not book a routine slot for this case.</div>'
        if report["red_flags"] else '<div class="pathway"><b>Factors considered:</b> '
        + ", ".join(safe(item) for item in report["factors_considered"]) + '</div>'
    )
    output_html = f"""
    <div class="card">
      <div class="card-head"><div class="card-title">AI-assisted clinical analysis</div><span class="badge">ROUTING RECOMMENDATION</span></div>
      <div class="case-meta">CASE {safe(report['case_id'])} &nbsp;·&nbsp; PATIENT {safe(report['patient_id'])} &nbsp;·&nbsp; AGE {safe(report['age'])}</div>
      <div class="report-section"><div class="report-label">Patient-reported case</div><div class="report-text">{safe(report['summary'])}</div></div>
      <div class="report-section"><div class="report-label">Concise reasoning summary</div><div class="report-text">{safe(report['reasoning_summary'])}</div></div>
      <div class="report-section"><div class="report-label">Simulated pipeline hypothesis · not a diagnosis</div><div class="report-text">{safe(report['provisional_assessment'])}</div></div>
      <div class="output-grid">
        <div class="output-chip"><div class="report-label">Recommended specialty · AI-determined</div><div class="output-value">{safe(report['specialty'])}</div></div>
        <div class="output-chip"><div class="report-label">Urgency tier · AI-determined</div><div class="output-value">Tier {safe(report['urgency_tier'])} · {safe(report['urgency_label'])}</div></div>
      </div>
      <div class="pathway"><b>Care routing · {safe(routing['pathway'])}</b><br>{safe(routing['next_step'])}</div>
      {red_flags_html}
      <div class="disclaimer">{safe(report['disclaimer'])}</div>
    </div>
    """
    st.markdown('<div class="workspace-head"><h2>Care routing & scheduling</h2><span class="live"><i></i>ANALYSIS COMPLETE</span></div>', unsafe_allow_html=True)
    report_col, appointment_col = st.columns([1, 1], gap="large")
    with report_col:
        st.markdown(output_html, unsafe_allow_html=True)
    appointment = result["appointment"]
    if appointment:
        appointment_dt = datetime.strptime(appointment["time_slot"], "%Y-%m-%d %H:%M")
        appointment_label = f"{appointment_dt:%A, %B} {appointment_dt.day} · {appointment_dt:%I:%M %p}".replace(" 0", " ")
        appointment_html = f"""
        <div class="card">
          <div class="card-head"><div class="card-title">Scheduling pathway</div><span class="badge">MATCH FOUND · DEMO</span></div>
          <div class="case-meta">ROUTED USING AI-RECOMMENDED SPECIALTY AND URGENCY</div>
          <div class="output-grid">
            <div class="output-chip"><div class="report-label">Specialty</div><div class="output-value">{safe(routing['specialty'])}</div></div>
            <div class="output-chip"><div class="report-label">Appointment priority</div><div class="output-value">Tier {safe(routing['urgency_tier'])} · {safe(routing['urgency_label'])}</div></div>
          </div>
          <div class="appt-hero"><div class="doctor-name">{safe(appointment['doctor_name'])}</div><div class="doctor-spec">{safe(routing['specialty'])} · {safe(routing['pathway'])}</div>
            <div class="appt-date">▣ &nbsp;{safe(appointment_label)}</div><div class="appt-location">⌖ &nbsp;{safe(appointment['location'])}</div>
          </div>
          <div class="report-label">Before you arrive</div><div class="prep">{safe(appointment['prep_instructions'])}</div>
          <div class="disclaimer">Demo schedule only; this is not a real clinic booking. Clinical review is required before care decisions.</div>
        </div>
        """
    else:
        appointment_html = f"""
        <div class="card emergency">
          <div class="card-head"><div class="card-title">Emergency care pathway</div><span class="badge" style="background:#fbe2d7;color:#8b4328">NO ROUTINE BOOKING</span></div>
          <div class="redflag"><b>Potential red-flag signal detected.</b> This demo routes the case to immediate emergency care guidance instead of booking a routine appointment.</div>
          <div class="pathway">{safe(routing['next_step'])}<br><br>If this may be an emergency, contact local emergency services now.</div>
          <div class="disclaimer">Prototype safety behavior only. This system cannot assess emergencies; clinical review is required.</div>
        </div>
        """
    with appointment_col:
        st.markdown(appointment_html, unsafe_allow_html=True)
else:
    st.markdown('<div class="workspace-head"><h2>Case workspace</h2><span class="live"><i></i>READY FOR REVIEW</span></div><div class="empty"><div class="empty-icon">✳</div>Submit the sample case to see agent activity, the consensus report, and the appointment details here.</div>', unsafe_allow_html=True)

st.markdown('<div class="disclaimer" style="text-align:center;margin-top:24px">ConsensusFlow demo &nbsp;·&nbsp; Mock clinical and scheduling data</div>', unsafe_allow_html=True)
