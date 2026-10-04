# HouseAI hackathon demo

This repository contains the HouseAI simulated diagnostic pipeline, a FastAPI adapter, a mock scheduling service, and a Streamlit dashboard.

## Run locally on Windows

Open two Command Prompt windows in this folder. In the first, install dependencies (one time):

```cmd
python -m pip install -r requirements.txt
```

Start the API:

```cmd
python -m uvicorn app:app --reload --port 8000
```

In the second window, start the dashboard:

```cmd
python -m streamlit run dashboard.py
```

Open the `http://localhost:8501` URL Streamlit prints. The API health check is at `http://localhost:8000/health`; interactive API docs are at `http://localhost:8000/docs`.

## Demo flow

The patient form accepts `patient_id`, `age`, `symptoms`, and `lab_notes`, matching HouseAI's `PatientInput`. `POST /api/diagnose` calls `run_diagnostic_pipeline`, adapts its specialty and urgency result for the dashboard, and `POST /api/schedule` selects a matching mock provider slot. `GET /api/doctors` returns the mock doctor schedule.

## Safety and limitations

All analysis and appointment data are synthetic demonstrations. The diagnostic engine uses scripted rules and labels candidate diagnoses; it is not a medical device or a reliable diagnostic or triage service. Do not enter real patient information. The simulated output must not guide actual care decisions; clinical review is required.
