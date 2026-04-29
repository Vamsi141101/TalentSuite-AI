from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from rewriter import rewrite_bullet, generate_cover_letter, generate_interview_questions

router = APIRouter()


class BulletInput(BaseModel):
    bullet: str
    context: Optional[str] = None


class CoverLetterInput(BaseModel):
    resume_text: str
    job_description: str
    tone: Optional[str] = "professional"


class InterviewInput(BaseModel):
    resume_text: str
    job_description: str
    role: Optional[str] = None


class CompareInput(BaseModel):
    resume_v1: str
    resume_v2: str
    job_description: Optional[str] = None


@router.post("/rewrite-bullet")
def rewrite_bullet_ep(body: BulletInput):
    if not body.bullet.strip():
        raise HTTPException(status_code=400, detail="bullet cannot be empty.")
    return rewrite_bullet(body.bullet, body.context)


@router.post("/cover-letter")
def cover_letter_ep(body: CoverLetterInput):
    return generate_cover_letter(body.resume_text, body.job_description, body.tone)


@router.post("/interview-questions")
def interview_ep(body: InterviewInput):
    return generate_interview_questions(body.resume_text, body.job_description, body.role)


@router.post("/compare-resumes")
def compare_resumes(body: CompareInput):
    from parser import parse_resume_text
    from skills import extract_skills
    from ats import compute_ats_score
    from scorer import compute_resume_score
    from matcher import match_jd

    def analyze(text):
        profile = parse_resume_text(text)
        skills = extract_skills(text)
        ats = compute_ats_score(text, skills, body.job_description)
        score = compute_resume_score(text, skills, profile)
        jd = match_jd(skills, text, body.job_description) if body.job_description else None
        return {"profile": profile, "skills": skills, "ats": ats, "score": score, "jd": jd}

    v1 = analyze(body.resume_v1)
    v2 = analyze(body.resume_v2)
    all_v1 = set(v1["skills"].get("technical", []) + v1["skills"].get("tools", []))
    all_v2 = set(v2["skills"].get("technical", []) + v2["skills"].get("tools", []))
    return {
        "v1": v1, "v2": v2,
        "winner": "v2" if v2["score"]["overall"] > v1["score"]["overall"] else "v1",
        "score_diff": round(v2["score"]["overall"] - v1["score"]["overall"], 1),
        "ats_diff": round(v2["ats"]["overall"] - v1["ats"]["overall"], 1),
        "skills_only_v1": list(all_v1 - all_v2),
        "skills_only_v2": list(all_v2 - all_v1),
        "shared_skills": list(all_v1 & all_v2),
    }
