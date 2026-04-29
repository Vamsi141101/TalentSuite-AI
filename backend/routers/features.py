from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, List
import re, json, os
from datetime import datetime

router = APIRouter()


# ── Language Detection + Translation ─────────────────────────────────────────
class TranslateInput(BaseModel):
    text: str


@router.post("/detect-language")
def detect_language(body: TranslateInput):
    try:
        from langdetect import detect, DetectorFactory
        DetectorFactory.seed = 0
        lang = detect(body.text)
        lang_names = {
            "en": "English", "es": "Spanish", "fr": "French",
            "de": "German", "hi": "Hindi", "zh-cn": "Chinese",
            "zh-tw": "Chinese", "pt": "Portuguese", "it": "Italian",
            "ja": "Japanese", "ko": "Korean", "ar": "Arabic",
            "ru": "Russian", "nl": "Dutch"
        }
        return {"language": lang, "language_name": lang_names.get(lang, lang.upper()), "confidence": "high" if len(body.text) > 100 else "medium"}
    except Exception as e:
        return {"language": "en", "language_name": "English", "confidence": "low", "error": str(e)}


@router.post("/translate")
def translate_resume(body: TranslateInput):
    try:
        from langdetect import detect, DetectorFactory
        DetectorFactory.seed = 0
        lang = detect(body.text)
        if lang == "en":
            return {"translated": body.text, "original_language": "en", "original_language_name": "English", "was_translated": False}
        from deep_translator import GoogleTranslator
        # Split into chunks to handle long resumes
        chunks = [body.text[i:i+4500] for i in range(0, len(body.text), 4500)]
        translated_chunks = []
        for chunk in chunks:
            translated = GoogleTranslator(source="auto", target="en").translate(chunk)
            translated_chunks.append(translated or chunk)
        lang_names = {"es": "Spanish", "fr": "French", "de": "German", "hi": "Hindi", "zh-cn": "Chinese", "pt": "Portuguese", "it": "Italian"}
        return {
            "translated": "\n".join(translated_chunks),
            "original_language": lang,
            "original_language_name": lang_names.get(lang, lang.upper()),
            "was_translated": True
        }
    except Exception as e:
        return {"translated": body.text, "original_language": "unknown", "original_language_name": "Unknown", "was_translated": False, "error": str(e)}


# ── Auto-Rejection Email Generator ───────────────────────────────────────────
class RejectionInput(BaseModel):
    candidate_name: str
    role: str
    missing_skills: List[str] = []
    tone: str = "polite"  # polite | firm | encouraging
    company_name: str = "our company"


@router.post("/rejection-email")
def generate_rejection(body: RejectionInput):
    name = body.candidate_name or "Candidate"
    role = body.role or "the position"
    company = body.company_name
    missing = body.missing_skills[:3]
    missing_str = ", ".join(missing) if missing else "some key technical requirements"

    templates = {
        "polite": f"""Subject: Your Application for {role} — {company}

Dear {name},

Thank you for taking the time to apply for the {role} position at {company} and for your interest in joining our team.

After carefully reviewing your application and background, we have decided to move forward with other candidates whose experience more closely aligns with our current requirements — specifically in {missing_str}.

We were genuinely impressed by your background and encourage you to apply for future openings that may be a better match. We will keep your resume on file for upcoming opportunities.

We wish you the very best in your job search and career.

Warm regards,
The {company} Talent Team""",

        "firm": f"""Subject: Application Update — {role} at {company}

Dear {name},

Thank you for applying for the {role} role at {company}.

After reviewing all applications, we will not be moving forward with your candidacy at this time. The role requires strong experience in {missing_str}, which we felt was not sufficiently demonstrated in your application.

We appreciate the time you invested in this process and wish you success in your search.

Regards,
{company} Recruiting""",

        "encouraging": f"""Subject: Your {role} Application — Next Steps

Dear {name},

Thank you so much for applying for the {role} position at {company} — it takes courage and effort, and we truly appreciate your interest.

After careful consideration, we've decided to move forward with candidates who have deeper experience in {missing_str}. However, we were genuinely impressed by several aspects of your background.

Our honest advice: building hands-on projects around {missing[0] if missing else 'the required skills'} would significantly strengthen future applications. Consider open-source contributions or a personal portfolio project.

We'd love to see you apply again in 6–12 months. Please don't be discouraged — you're on the right track.

With encouragement,
The {company} Team"""
    }

    email = templates.get(body.tone, templates["polite"])
    word_count = len(email.split())
    return {
        "email": email,
        "tone": body.tone,
        "word_count": word_count,
        "subject": email.split("\n")[0].replace("Subject: ", ""),
        "tips": [
            "Personalize the company name before sending",
            "Send within 48 hours of decision for best candidate experience",
            "BCC yourself to keep a record"
        ]
    }


# ── Market Timing Scorer ──────────────────────────────────────────────────────
class MarketTimingInput(BaseModel):
    resume_text: str


@router.post("/market-timing")
def market_timing(body: MarketTimingInput):
    text = body.resume_text.lower()
    score = 30
    signals = []

    # Positive signals — likely looking
    if any(w in text for w in ["seeking", "looking for", "open to", "available", "actively"]):
        score += 25
        signals.append({"signal": "Actively seeking language detected", "impact": "+25", "type": "high"})

    if any(w in text for w in ["present", "current", "2024", "2025"]):
        score += 15
        signals.append({"signal": "Resume recently updated", "impact": "+15", "type": "medium"})

    years = re.findall(r'\b(20\d{2})\b', text)
    if years:
        latest = max(int(y) for y in years)
        current_year = datetime.now().year
        if latest >= current_year - 1:
            score += 10
            signals.append({"signal": f"Recent activity in {latest}", "impact": "+10", "type": "medium"})

    gaps = re.findall(r'(20\d{2})\s*[-–]\s*(20\d{2}|present)', text)
    if len(gaps) >= 3:
        score += 15
        signals.append({"signal": "Multiple job transitions — mobile career", "impact": "+15", "type": "medium"})

    # Negative signals — likely stable
    if any(w in text for w in ["promoted", "senior", "lead", "principal", "staff"]):
        score -= 10
        signals.append({"signal": "Career progression signals stability", "impact": "-10", "type": "low"})

    if text.count("year") + text.count("years") >= 3:
        score -= 5
        signals.append({"signal": "Long tenure patterns detected", "impact": "-5", "type": "low"})

    score = min(95, max(10, score))
    level = "HIGH" if score >= 70 else "MEDIUM" if score >= 40 else "LOW"
    recommendation = (
        "Contact immediately — strong signals of active search" if score >= 70
        else "Worth reaching out — candidate may be open to opportunities" if score >= 40
        else "Passive candidate — requires compelling outreach"
    )

    return {
        "score": score,
        "level": level,
        "signals": signals,
        "recommendation": recommendation,
        "best_outreach": "LinkedIn InMail + Email" if score >= 70 else "LinkedIn InMail" if score >= 40 else "Warm intro via mutual connection"
    }


# ── Team Complement Analyzer ──────────────────────────────────────────────────
class TeamComplementInput(BaseModel):
    team_skills: List[str]
    candidate_resume: str


@router.post("/team-complement")
def team_complement(body: TeamComplementInput):
    from skills import extract_skills
    candidate_skills_obj = extract_skills(body.candidate_resume)
    candidate_skills = set(s.lower() for s in candidate_skills_obj["technical"] + candidate_skills_obj["tools"])
    team_skills = set(s.lower() for s in body.team_skills)

    unique_to_candidate = candidate_skills - team_skills
    shared = candidate_skills & team_skills
    team_gaps_filled = unique_to_candidate
    remaining_gaps = team_skills - candidate_skills

    complement_score = round((len(unique_to_candidate) / max(len(candidate_skills), 1)) * 100)
    overlap_score = round((len(shared) / max(len(candidate_skills | team_skills), 1)) * 100)

    recommendation = (
        "Strong hire — fills significant team gaps" if complement_score >= 60
        else "Good hire — adds some new capabilities" if complement_score >= 30
        else "Redundant hire — consider different skill profile"
    )

    return {
        "complement_score": complement_score,
        "overlap_score": overlap_score,
        "unique_to_candidate": list(unique_to_candidate)[:12],
        "shared_skills": list(shared)[:12],
        "remaining_team_gaps": list(remaining_gaps)[:8],
        "candidate_skill_count": len(candidate_skills),
        "recommendation": recommendation,
        "hire_recommendation": complement_score >= 40
    }


# ── Skill Trajectory Predictor ────────────────────────────────────────────────
class TrajectoryInput(BaseModel):
    resume_text: str


@router.post("/skill-trajectory")
def skill_trajectory(body: TrajectoryInput):
    from skills import extract_skills
    skills_obj = extract_skills(body.resume_text)
    current_skills = skills_obj["technical"] + skills_obj["tools"]

    # Skill evolution paths — common industry progressions
    evolution_map = {
        "python": ["fastapi", "pytorch", "ray", "mlflow"],
        "react": ["nextjs", "remix", "react native", "turborepo"],
        "java": ["spring boot", "quarkus", "graalvm", "micronaut"],
        "sql": ["dbt", "bigquery", "snowflake", "databricks"],
        "docker": ["kubernetes", "helm", "argocd", "istio"],
        "aws": ["terraform", "pulumi", "aws cdk", "crossplane"],
        "machine learning": ["llmops", "rag", "fine-tuning", "mlflow"],
        "typescript": ["bun", "deno", "effect-ts", "zod"],
        "node": ["bun", "fastify", "trpc", "turborepo"],
        "kubernetes": ["service mesh", "gitops", "argocd", "crossplane"],
        "tensorflow": ["pytorch", "jax", "triton", "tflite"],
        "fastapi": ["async python", "pydantic v2", "sqlmodel", "grpc"],
        "openai": ["langchain", "llamaindex", "rag", "fine-tuning"],
        "spark": ["databricks", "delta lake", "iceberg", "dbt"],
    }

    predicted = []
    seen = set()
    for skill in current_skills:
        key = skill.lower()
        if key in evolution_map:
            for next_skill in evolution_map[key]:
                if next_skill not in [s.lower() for s in current_skills] and next_skill not in seen:
                    predicted.append({
                        "skill": next_skill,
                        "based_on": skill,
                        "confidence": "High" if len(current_skills) > 10 else "Medium",
                        "timeline": "6–12 months",
                        "reason": f"Natural progression from {skill}"
                    })
                    seen.add(next_skill)
                    if len(predicted) >= 6:
                        break
        if len(predicted) >= 6:
            break

    # Trending skills to add based on seniority signals
    trending = []
    text_lower = body.resume_text.lower()
    if "senior" in text_lower or "lead" in text_lower:
        trending = [
            {"skill": "System Design", "reason": "Expected at senior level", "priority": "High"},
            {"skill": "Technical Leadership", "reason": "Career progression signal", "priority": "High"},
        ]
    else:
        trending = [
            {"skill": "LLM Integration", "reason": "Fastest growing skill in 2025", "priority": "High"},
            {"skill": "Cloud Architecture", "reason": "High demand, high salary premium", "priority": "Medium"},
        ]

    years = re.findall(r'\b(20\d{2})\b', body.resume_text)
    start_year = min(int(y) for y in years) if years else 2020
    end_year = max(int(y) for y in years) if years else 2024

    return {
        "current_skills": current_skills[:10],
        "predicted_next": predicted[:6],
        "trending_to_add": trending,
        "career_start": start_year,
        "career_current": end_year,
        "years_experience": end_year - start_year,
        "trajectory": "Upward" if len(current_skills) > 8 else "Early stage",
        "insight": f"Based on {len(current_skills)} detected skills, your trajectory points toward {'AI/ML Engineering' if any('ml' in s.lower() or 'ai' in s.lower() or 'python' in s.lower() for s in current_skills) else 'Full-Stack Architecture'}"
    }


# ── Resume Heatmap ────────────────────────────────────────────────────────────
class HeatmapInput(BaseModel):
    resume_text: str


@router.post("/resume-heatmap")
def resume_heatmap(body: HeatmapInput):
    from skills import extract_skills
    from ats import compute_ats_score
    from scorer import compute_resume_score
    from parser import parse_resume_text

    text = body.resume_text
    profile = parse_resume_text(text)
    skills = extract_skills(text)
    ats = compute_ats_score(text, skills, None)
    score = compute_resume_score(text, skills, profile)

    sections = []

    # Contact info
    has_email = bool(re.search(r'[\w.+-]+@[\w-]+\.[a-z]{2,}', text))
    has_phone = bool(re.search(r'\+?\d[\d\s\-()]{8,}', text))
    has_linkedin = "linkedin" in text.lower()
    contact_score = (int(has_email) + int(has_phone) + int(has_linkedin)) * 33
    sections.append({"name": "Contact Info", "score": min(100, contact_score), "issues": [] if contact_score >= 99 else ["Add " + (", ".join(filter(None, [None if has_email else "email", None if has_phone else "phone", None if has_linkedin else "LinkedIn"])))], "words": 0})

    # Summary
    has_summary = any(w in text.lower() for w in ["summary", "objective", "profile", "about"])
    summary_words = len(text.split()[:50])
    sections.append({"name": "Summary / Objective", "score": 85 if has_summary else 20, "issues": [] if has_summary else ["Add a 2–3 sentence professional summary at the top"], "words": summary_words if has_summary else 0})

    # Skills section
    skill_count = len(skills["technical"]) + len(skills["tools"])
    skill_score = min(100, skill_count * 5)
    sections.append({"name": "Skills Section", "score": skill_score, "issues": [] if skill_score >= 70 else [f"Only {skill_count} skills detected — add more technical skills"], "words": skill_count})

    # Experience
    has_exp = any(w in text.lower() for w in ["experience", "work history", "employment", "position"])
    has_bullets = text.count("•") + text.count("-") + text.count("*")
    has_metrics = bool(re.search(r'\d+%|\$\d+|\d+x|\d+ million|\d+ users', text))
    exp_score = 40 + (20 if has_exp else 0) + (20 if has_bullets >= 3 else 0) + (20 if has_metrics else 0)
    sections.append({"name": "Work Experience", "score": min(100, exp_score), "issues": [i for i in [None if has_metrics else "Add quantified metrics (%, $, numbers)", None if has_bullets >= 3 else "Use bullet points for achievements"] if i], "words": len(text.split()) - 50})

    # Education
    has_edu = any(w in text.lower() for w in ["education", "university", "college", "bachelor", "master", "degree", "b.s", "m.s"])
    sections.append({"name": "Education", "score": 90 if has_edu else 15, "issues": [] if has_edu else ["Add your education section"], "words": 30 if has_edu else 0})

    # Projects
    has_projects = any(w in text.lower() for w in ["project", "github", "built", "developed", "created"])
    sections.append({"name": "Projects / Portfolio", "score": 85 if has_projects else 30, "issues": [] if has_projects else ["Add 2–3 portfolio projects with GitHub links"], "words": 40 if has_projects else 0})

    # ATS score
    sections.append({"name": "ATS Optimization", "score": ats["overall"], "issues": ats["improvements"][:2], "words": 0})

    overall = round(sum(s["score"] for s in sections) / len(sections))
    return {
        "sections": sections,
        "overall": overall,
        "strongest": max(sections, key=lambda x: x["score"])["name"],
        "weakest": min(sections, key=lambda x: x["score"])["name"],
        "total_words": len(text.split()),
        "recommendation": "Strong resume — focus on metrics" if overall >= 75 else "Good foundation — add more details" if overall >= 50 else "Needs significant improvement"
    }


# ── Public Job Board ──────────────────────────────────────────────────────────
class PublicJobInput(BaseModel):
    title: str
    description: str
    department: str = "Engineering"
    location: str = "Remote"
    salary_range: str = ""
    requirements: List[str] = []
    company_name: str = "TalentSuite Demo"


class JobApplicationInput(BaseModel):
    job_id: int
    applicant_name: str
    applicant_email: str
    resume_text: str
    cover_note: str = ""


@router.get("/public-jobs")
def get_public_jobs():
    from database import get_conn
    conn = get_conn()
    try:
        rows = conn.execute("""
            SELECT j.id, j.title, j.description, j.department, j.created_at,
                   j.status, COUNT(c.id) as applicant_count,
                   COALESCE(j.location, 'Remote') as location,
                   COALESCE(j.salary_range, '') as salary_range
            FROM jobs j
            LEFT JOIN candidates c ON c.job_id = j.id
            WHERE j.status = 'active'
            GROUP BY j.id
            ORDER BY j.created_at DESC
            LIMIT 20
        """).fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception:
        conn.close()
        return []


@router.get("/public-jobs/{job_id}")
def get_public_job(job_id: int):
    from database import get_conn
    conn = get_conn()
    row = conn.execute("SELECT * FROM jobs WHERE id=? AND status='active'", (job_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Job not found")
    return dict(row)


@router.post("/public-jobs/{job_id}/apply")
def apply_to_job(job_id: int, body: JobApplicationInput):
    from database import get_conn, add_candidate
    from skills import extract_skills
    from classifier import predict_roles
    from matcher import match_jd
    from ats import compute_ats_score
    from scorer import compute_resume_score
    from parser import parse_resume_text

    # Get job
    conn = get_conn()
    job = conn.execute("SELECT * FROM jobs WHERE id=? AND status='active'", (job_id,)).fetchone()
    conn.close()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or closed")

    # Analyze resume
    try:
        profile = parse_resume_text(body.resume_text)
        skills = extract_skills(body.resume_text)
        jd = match_jd(skills, body.resume_text, job["description"])
        ats = compute_ats_score(body.resume_text, skills, job["description"])
        score = compute_resume_score(body.resume_text, skills, profile)
        match_score = jd["score"] if jd else 0
        add_candidate(job_id, 0, body.applicant_name or profile["name"], body.applicant_email or profile.get("email", ""), match_score, ats["overall"], score["overall"])
    except Exception as e:
        add_candidate(job_id, 0, body.applicant_name, body.applicant_email, 50, 50, 50)

    return {"message": "Application submitted successfully!", "status": "screened", "next_steps": "You will hear back within 5–7 business days."}
