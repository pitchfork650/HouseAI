# Legacy Python prototype (FastAPI + Streamlit)

The first HouseAI demo: a FastAPI backend (`app.py`) with a 5-agent dental swarm (`agents.py`, `schemas.py`), a Streamlit dashboard (`dashboard.py`) and a verification script (`test_house_ai.py`).

It has been superseded by the Next.js app at the repo root, which covers the same ground (diagnostics, scheduling, insurance, follow-ups). Nothing in the Next.js app imports or calls it. It is kept here for reference.

Run it from this folder:

```bash
python -m pip install -r requirements.txt
python -m uvicorn app:app --reload --port 8000   # API + Swagger at /docs
streamlit run dashboard.py                        # dashboard (expects the API on :8000)
python test_house_ai.py
```

`GEMINI_API_KEY` / `GEMINI_MODEL` (env vars, or a `.env` in this folder) enable live Gemini calls; without them it falls back to a deterministic decision tree.
