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

## Google Gemini Pro Cloud AI Integration

HouseAI includes native cloud LLM support via Google Gemini Pro. The application connects directly to Google's Gemini API over HTTPS, meaning **no local AI models need to be downloaded or run**.

### Connecting your Gemini API Key
1. Get a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Create or edit `.env` in this directory (use `.env.example` as a template):
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-1.5-pro
   ```
3. When `GEMINI_API_KEY` is present, the 3 collaborative agents (Triage Nurse, Specialist, and Safety Critic) query Google Gemini Pro in real-time.
4. If no key is set or if offline, HouseAI automatically falls back to its deterministic clinical decision tree, ensuring zero downtime during hackathon presentations.

## Demo flow

The patient form accepts `patient_id`, `age`, `symptoms`, and `lab_notes`, matching HouseAI's `PatientInput`. `POST /api/diagnose` calls `run_diagnostic_pipeline`, adapts its specialty and urgency result for the dashboard, and `POST /api/schedule` selects a matching mock provider slot. `GET /api/doctors` returns the mock doctor schedule.

## Safety and limitations

All analysis and appointment data are synthetic demonstrations. The diagnostic engine uses scripted rules and labels candidate diagnoses; it is not a medical device or a reliable diagnostic or triage service. Do not enter real patient information. The simulated output must not guide actual care decisions; clinical review is required.
