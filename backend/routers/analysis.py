from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Header
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime
from parser import parse_resume_file, parse_resume_text
from skills import extract_skills
from classifier import predict_roles
from matcher import match_jd
from ats import compute_ats_score
from scorer import compute_resume_score
from salary import estimate_salary
from database import save_result, get_result, save_resume, save_snapshot
from routers.auth import verify_token

router = APIRouter()


class TextInput(BaseModel):
    resume_text: str
    job_description: Optional[str] = None


def _full_analyze(text: str, job_description: Optional[str]) -> dict:
    profile = parse_resume_text(text)
    skills = extract_skills(text)
    roles = predict_roles(text, skills)
    jd = match_jd(skills, text, job_description) if job_description else None
    ats = compute_ats_score(text, skills, job_description)
    resume_score = compute_resume_score(text, skills, profile)
    salary = estimate_salary(skills, profile, roles)
    return {
        "profile": profile, "skills": skills, "role_predictions": roles,
        "jd_match": jd, "ats_score": ats, "resume_score": resume_score,
        "salary_estimate": salary, "analyzed_at": datetime.now().isoformat(),
    }


@router.post("/upload-resume")
async def upload_resume(file: UploadFile = File(...), job_description: Optional[str] = Form(None), authorization: Optional[str] = Header(None)):
    allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"]
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Only PDF, DOCX, or TXT supported.")
    contents = await file.read()
    text = parse_resume_file(contents, file.filename)
    if not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from file.")
    result = _full_analyze(text, job_description)
    result_id = str(uuid.uuid4())[:8]
    result["result_id"] = result_id
    save_result(result_id, result)
    if authorization and authorization.startswith("Bearer "):
        payload = verify_token(authorization.replace("Bearer ", ""))
        if payload:
            save_resume(payload["user_id"], file.filename, text, result)
            total_skills = len(result["skills"]["technical"]) + len(result["skills"]["tools"])
            save_snapshot(payload["user_id"], result["resume_score"]["overall"], total_skills, str(datetime.now().year))
    return result


@router.post("/analyze-text")
def analyze_text(body: TextInput, authorization: Optional[str] = Header(None)):
    if not body.resume_text.strip():
        raise HTTPException(status_code=400, detail="resume_text cannot be empty.")
    result = _full_analyze(body.resume_text, body.job_description)
    result_id = str(uuid.uuid4())[:8]
    result["result_id"] = result_id
    save_result(result_id, result)
    if authorization and authorization.startswith("Bearer "):
        payload = verify_token(authorization.replace("Bearer ", ""))
        if payload:
            save_resume(payload["user_id"], "pasted_text.txt", body.resume_text, result)
            total_skills = len(result["skills"]["technical"]) + len(result["skills"]["tools"])
            save_snapshot(payload["user_id"], result["resume_score"]["overall"], total_skills, str(datetime.now().year))
    return result


@router.get("/result/{result_id}")
def get_result_endpoint(result_id: str):
    result = get_result(result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Result not found.")
    return result


@router.get("/my-resumes")
def my_resumes(authorization: str = Header(...)):
    payload = verify_token(authorization.replace("Bearer ", ""))
    if not payload:
        raise HTTPException(status_code=401, detail="Not authenticated")
    from database import get_user_resumes
    return get_user_resumes(payload["user_id"])
