from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from parser import parse_resume_text
from skills import extract_skills
from classifier import predict_roles
from matcher import match_jd
from ats import compute_ats_score
from scorer import compute_resume_score

router = APIRouter()


class BulkInput(BaseModel):
    resumes: List[str]
    job_description: str
    weights: dict = {"jd_match": 0.4, "ats": 0.3, "resume_score": 0.3}


@router.post("/bulk-analyze")
def bulk_analyze(body: BulkInput):
    if not body.resumes:
        raise HTTPException(status_code=400, detail="No resumes provided.")
    results = []
    for i, resume_text in enumerate(body.resumes):
        if not resume_text.strip():
            continue
        profile = parse_resume_text(resume_text)
        skills = extract_skills(resume_text)
        roles = predict_roles(resume_text, skills)
        jd = match_jd(skills, resume_text, body.job_description)
        ats = compute_ats_score(resume_text, skills, body.job_description)
        rs = compute_resume_score(resume_text, skills, profile)
        jd_score = jd["score"] if jd else 0
        w = body.weights
        composite = round(jd_score * w.get("jd_match", 0.4) + ats["overall"] * w.get("ats", 0.3) + rs["overall"] * w.get("resume_score", 0.3), 1)
        results.append({
            "index": i + 1, "name": profile["name"], "email": profile.get("email") or "—",
            "seniority": profile["seniority"], "top_role": roles[0]["role"] if roles else "Unknown",
            "jd_match_score": jd_score, "ats_score": ats["overall"], "resume_score": rs["overall"],
            "composite_score": composite, "total_skills": sum(len(v) for v in skills.values()),
            "top_skills": skills.get("technical", [])[:5],
            "matched_skills": jd["matched_skills"][:5] if jd else [],
            "missing_skills": jd["missing_skills"][:5] if jd else [],
            "profile": profile, "skills": skills,
        })
    results.sort(key=lambda x: x["composite_score"], reverse=True)
    for i, r in enumerate(results):
        r["rank"] = i + 1
    return {"candidates": results, "total": len(results), "job_description": body.job_description[:200]}
