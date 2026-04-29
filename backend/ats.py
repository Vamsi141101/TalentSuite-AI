import re
from typing import Optional


def compute_ats_score(text: str, skills: dict, job_description: Optional[str] = None) -> dict:
    checks = {}
    has_email = bool(re.search(r"[\w.+-]+@[\w-]+\.[a-z]{2,}", text, re.IGNORECASE))
    has_phone = bool(re.search(r"(\+?\d[\d\s\-().]{8,14}\d)", text))
    checks["contact_info"] = {"score": (10 if has_email else 0) + (5 if has_phone else 0), "max": 15, "details": f"Email: {'✓' if has_email else '✗'}, Phone: {'✓' if has_phone else '✗'}"}
    section_patterns = {"experience": r"\b(experience|work history)\b", "education": r"\b(education|degree)\b", "skills": r"\b(skills|technologies)\b", "summary": r"\b(summary|objective|profile)\b", "projects": r"\b(projects|portfolio)\b"}
    t = text.lower()
    found_sections = [s for s, pat in section_patterns.items() if re.search(pat, t)]
    checks["sections"] = {"score": min(20, len(found_sections) * 4), "max": 20, "details": f"Found: {', '.join(found_sections) or 'none'}"}
    total_skills = sum(len(v) for v in skills.values())
    checks["keyword_density"] = {"score": min(20, total_skills * 2), "max": 20, "details": f"{total_skills} keywords detected"}
    has_bullets = text.count("•") + text.count("-") + text.count("*") > 3
    word_count = len(text.split())
    good_length = 300 <= word_count <= 900
    checks["formatting"] = {"score": (10 if has_bullets else 0) + (10 if good_length else 5), "max": 20, "details": f"Bullets: {'✓' if has_bullets else '✗'}, Words: {word_count}"}
    if job_description:
        jd_lower = job_description.lower()
        all_skills = skills.get("technical", []) + skills.get("tools", []) + skills.get("soft", [])
        matched_kw = [s for s in all_skills if s.lower() in jd_lower]
        checks["jd_keywords"] = {"score": min(25, len(matched_kw) * 3), "max": 25, "details": f"{len(matched_kw)} JD keywords matched"}
    else:
        checks["jd_keywords"] = {"score": 12, "max": 25, "details": "No JD provided"}
    overall = sum(c["score"] for c in checks.values())
    max_score = sum(c["max"] for c in checks.values())
    pct = round(overall / max_score * 100)
    return {"overall": pct, "grade": _grade(pct), "checks": checks, "improvements": _improvements(checks)}


def _grade(score: int) -> str:
    if score >= 85: return "A"
    elif score >= 70: return "B"
    elif score >= 55: return "C"
    elif score >= 40: return "D"
    return "F"


def _improvements(checks: dict) -> list:
    tips = []
    if checks["contact_info"]["score"] < 15:
        tips.append("Add both email and phone number to the top of your resume.")
    if checks["sections"]["score"] < 16:
        tips.append("Add missing sections: Summary, Skills, Projects.")
    if checks["keyword_density"]["score"] < 15:
        tips.append("Include more relevant technical keywords.")
    if checks["formatting"]["score"] < 15:
        tips.append("Use bullet points and keep resume between 300-900 words.")
    if checks["jd_keywords"]["score"] < 15:
        tips.append("Mirror more keywords from the job description.")
    return tips
