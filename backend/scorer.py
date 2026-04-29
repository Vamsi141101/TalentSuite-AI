import re


def compute_resume_score(text: str, skills: dict, profile: dict) -> dict:
    dimensions = {}
    numbers = re.findall(r"\d+[%x+]?|\$\d+|\d+\+", text)
    action_verbs = ["led", "built", "designed", "architected", "improved", "reduced", "increased", "launched", "developed", "created", "managed", "delivered", "optimized", "scaled"]
    verb_count = sum(1 for v in action_verbs if v in text.lower())
    dimensions["impact"] = {"score": min(100, len(numbers) * 8 + verb_count * 6), "label": "Impact", "tip": "Add more quantified metrics (%, $, time saved) to bullet points."}
    word_count = len(text.split())
    has_sections = len(profile.get("sections", [])) >= 3
    sentences = text.split(".")
    avg_sentence_len = sum(len(s.split()) for s in sentences) / max(len(sentences), 1)
    dimensions["clarity"] = {"score": min(100, (20 if has_sections else 0) + (20 if 300 <= word_count <= 800 else 10) + (30 if avg_sentence_len < 20 else 15) + 20), "label": "Clarity", "tip": "Keep sentences concise and ensure all major sections are present."}
    total_skills = sum(len(v) for v in skills.values())
    tech_skills = len(skills.get("technical", []))
    dimensions["skill_depth"] = {"score": min(100, total_skills * 4 + tech_skills * 2), "label": "Skill Depth", "tip": "Add more specific technologies relevant to your target role."}
    has_email = bool(profile.get("email"))
    has_phone = bool(profile.get("phone"))
    has_linkedin = bool(profile.get("linkedin"))
    dimensions["ats_friendly"] = {"score": (25 if has_email else 0) + (20 if has_phone else 0) + (20 if has_linkedin else 0) + (35 if len(profile.get("sections", [])) >= 4 else 15), "label": "ATS Friendly", "tip": "Include email, phone, LinkedIn, and all standard sections."}
    years_str = profile.get("experience_years", "")
    years_num = int(re.search(r"\d+", years_str).group()) if re.search(r"\d+", years_str) else 0
    bullets = text.count("•") + text.count("-")
    dimensions["experience"] = {"score": min(100, years_num * 10 + bullets * 3), "label": "Experience", "tip": "Add more bullet points detailing achievements at each role."}
    overall = round(sum(d["score"] for d in dimensions.values()) / len(dimensions))
    return {"overall": overall, "grade": _grade(overall), "dimensions": dimensions, "summary": _summary(overall)}


def _grade(score: int) -> str:
    if score >= 85: return "A"
    elif score >= 70: return "B"
    elif score >= 55: return "C"
    elif score >= 40: return "D"
    return "F"


def _summary(score: int) -> str:
    if score >= 85: return "Outstanding resume. Ready to send to top-tier companies."
    elif score >= 70: return "Strong resume with minor areas for improvement."
    elif score >= 55: return "Average resume. Focus on quantifying achievements."
    elif score >= 40: return "Needs significant improvement before applying."
    return "Resume needs a complete rewrite."
