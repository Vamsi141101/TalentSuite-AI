from typing import Optional
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from skills import SKILLS_TAXONOMY
import re


def match_jd(skills: dict, resume_text: str, job_description: Optional[str]) -> Optional[dict]:
    if not job_description or not job_description.strip():
        return None
    all_resume_skills = skills.get("technical", []) + skills.get("tools", []) + skills.get("soft", [])
    resume_combined = resume_text + " " + " ".join(all_resume_skills)
    score = _tfidf_similarity(resume_combined, job_description.strip())
    matched, missing = _skill_gap(all_resume_skills, job_description)
    return {
        "score": round(score * 100, 1),
        "method": "TF-IDF cosine similarity",
        "matched_skills": matched,
        "missing_skills": missing[:15],
        "matched_count": len(matched),
        "missing_count": len(missing),
        "gap_analysis": _gap_summary(len(matched), len(missing)),
        "recommendation": _recommendation(matched, missing),
    }


def _tfidf_similarity(text1: str, text2: str) -> float:
    try:
        vec = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
        matrix = vec.fit_transform([text1, text2])
        return float(max(0.0, min(1.0, cosine_similarity(matrix[0], matrix[1]).flatten()[0])))
    except Exception:
        return 0.0


def _skill_gap(resume_skills: list, jd_text: str) -> tuple:
    jd_lower = jd_text.lower()
    resume_lower = {s.lower() for s in resume_skills}
    matched = [s for s in resume_skills if s.lower() in jd_lower]
    all_known = SKILLS_TAXONOMY["technical"] + SKILLS_TAXONOMY["tools"] + SKILLS_TAXONOMY["soft"]
    missing = [s for s in all_known if re.search(r'\b' + re.escape(s.lower()) + r'\b', jd_lower) and s.lower() not in resume_lower]
    return matched, missing


def _gap_summary(matched: int, missing: int) -> str:
    total = matched + missing
    if total == 0:
        return "Unable to analyze."
    pct = round(matched / total * 100)
    if pct >= 80:
        return "Excellent match! Your resume aligns very well with this role."
    elif pct >= 60:
        return "Good match. A few skill gaps to address before applying."
    elif pct >= 40:
        return "Moderate match. Consider highlighting relevant experience more."
    return "Low match. Resume needs significant tailoring for this role."


def _recommendation(matched: list, missing: list) -> list:
    tips = []
    if missing:
        tips.append(f"Add experience with: {', '.join(missing[:3])}")
    if len(matched) >= 5:
        tips.append("Highlight your matched skills prominently at the top of your resume.")
    if len(missing) > 5:
        tips.append("Consider adding a projects section to demonstrate missing skills.")
    return tips
