from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from database import create_job, get_jobs, add_candidate, get_candidates, update_candidate_status
from routers.auth import verify_token

router = APIRouter()
KANBAN_STAGES = ["screened", "shortlisted", "interview", "offer", "rejected"]


class JobInput(BaseModel):
    title: str
    description: str
    department: Optional[str] = "Engineering"


class CandidateInput(BaseModel):
    job_id: int
    resume_id: int
    name: str
    email: Optional[str] = ""
    match_score: float = 0
    ats_score: float = 0
    resume_score: float = 0


class StatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None


def _get_user(authorization: str):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = verify_token(authorization.replace("Bearer ", ""))
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload


@router.post("/jobs")
def create_job_ep(body: JobInput, authorization: str = Header(...)):
    user = _get_user(authorization)
    jid = create_job(user["user_id"], body.title, body.description, body.department)
    return {"id": jid, "title": body.title, "message": "Job created"}


@router.get("/jobs")
def get_jobs_ep(authorization: str = Header(...)):
    user = _get_user(authorization)
    return get_jobs(user["user_id"])


@router.post("/candidates")
def add_candidate_ep(body: CandidateInput, authorization: str = Header(...)):
    _get_user(authorization)
    cid = add_candidate(body.job_id, body.resume_id, body.name, body.email, body.match_score, body.ats_score, body.resume_score)
    return {"id": cid, "message": "Candidate added"}


@router.get("/candidates/{job_id}")
def get_candidates_ep(job_id: int, authorization: str = Header(...)):
    _get_user(authorization)
    return get_candidates(job_id)


@router.put("/candidates/{candidate_id}/status")
def update_status(candidate_id: int, body: StatusUpdate, authorization: str = Header(...)):
    _get_user(authorization)
    update_candidate_status(candidate_id, body.status, body.notes)
    return {"message": "Status updated"}


@router.get("/pipeline/{job_id}")
def get_pipeline(job_id: int, authorization: str = Header(...)):
    _get_user(authorization)
    candidates = get_candidates(job_id)
    board = {stage: [] for stage in KANBAN_STAGES}
    for c in candidates:
        stage = c.get("status", "screened")
        if stage in board:
            board[stage].append(c)
    return {"stages": KANBAN_STAGES, "board": board, "total": len(candidates)}
