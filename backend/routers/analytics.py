from fastapi import APIRouter, Header, HTTPException
from routers.auth import verify_token

router = APIRouter()

DEMO_DATA = {
    "total_resumes": 47,
    "total_jobs": 8,
    "avg_match_score": 68.4,
    "avg_ats_score": 72.1,
    "avg_resume_score": 65.8,
    "pipeline_status": {"screened": 23, "shortlisted": 12, "interview": 7, "offer": 3, "rejected": 8},
    "weekly_activity": [
        {"day": "Mon", "n": 8}, {"day": "Tue", "n": 12}, {"day": "Wed", "n": 6},
        {"day": "Thu", "n": 15}, {"day": "Fri", "n": 9}, {"day": "Sat", "n": 3}, {"day": "Sun", "n": 2}
    ],
    "top_roles": [
        {"role": "Senior Full-Stack Engineer", "count": 18},
        {"role": "ML / AI Engineer", "count": 12},
        {"role": "Backend Engineer", "count": 9},
        {"role": "DevOps / Platform Engineer", "count": 5},
        {"role": "Frontend Engineer", "count": 3},
    ],
    "hire_rate": 6.4,
    "is_demo": True
}

@router.get("/analytics")
def get_analytics_ep(authorization: str = Header(...)):
    payload = verify_token(authorization.replace("Bearer ", ""))
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    try:
        from database import get_analytics_full
        data = get_analytics_full(payload["user_id"])
        # If no real data yet, return demo data
        if data["total_resumes"] == 0 and data["total_jobs"] == 0:
            return {**DEMO_DATA, "is_demo": True}
        return {**data, "is_demo": False}
    except Exception:
        return {**DEMO_DATA, "is_demo": True}
