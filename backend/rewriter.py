import re
from typing import Optional

ACTION_VERBS = ["Architected", "Engineered", "Spearheaded", "Delivered", "Optimized", "Scaled", "Launched", "Reduced", "Increased", "Improved", "Designed", "Built", "Led", "Mentored", "Implemented"]
WEAK_STARTS = ["worked on", "helped with", "was responsible for", "assisted with", "participated in", "contributed to", "involved in", "part of"]


def rewrite_bullet(bullet: str, context: Optional[str] = None) -> dict:
    original = bullet.strip()
    issues = _detect_issues(original)
    improved = _improve_bullet(original)
    return {
        "original": original,
        "improved": improved,
        "alternatives": _alternatives(original, improved),
        "issues_found": issues,
        "tips": _tips(issues),
    }


def _detect_issues(bullet: str) -> list:
    issues = []
    b = bullet.lower()
    if not any(b.startswith(v.lower()) for v in ACTION_VERBS):
        issues.append("Does not start with a strong action verb")
    if not re.search(r"\d+[%x+]?|\$\d+|\d+\+", bullet):
        issues.append("No quantified metric (%, $, number)")
    if any(w in b for w in WEAK_STARTS):
        issues.append("Starts with weak/passive language")
    if len(bullet.split()) < 8:
        issues.append("Too short — needs more context and impact")
    return issues


def _improve_bullet(bullet: str) -> str:
    b = bullet.strip()
    b_lower = b.lower()
    replacements = {"worked on": "Engineered", "helped with": "Collaborated to deliver", "was responsible for": "Owned and delivered", "assisted with": "Supported", "participated in": "Contributed to", "contributed to": "Drove", "involved in": "Led", "part of": "Core member of team that"}
    for weak, strong in replacements.items():
        if b_lower.startswith(weak):
            b = strong + b[len(weak):]
            break
    if b and b[0].islower():
        b = b[0].upper() + b[1:]
    if not re.search(r"\d+[%x+]?|\$\d+|\d+\+", b):
        b = b.rstrip(".") + ", resulting in measurable performance improvements"
    return b


def _alternatives(original: str, improved: str) -> list:
    words = original.split()
    topic = " ".join(words[:5]) if len(words) >= 5 else original
    return [improved, f"Engineered {topic.lower()} solution, improving team efficiency by 30%+", f"Spearheaded development of {topic.lower()}, delivering on time and within scope"]


def _tips(issues: list) -> list:
    tips = []
    if "No quantified metric" in " ".join(issues):
        tips.append("Add a specific number: 'reduced load time by 40%', 'served 10k+ users'")
    if "action verb" in " ".join(issues):
        tips.append(f"Start with: {', '.join(ACTION_VERBS[:5])}")
    if "passive" in " ".join(issues):
        tips.append("Replace passive language with active verbs that show ownership")
    return tips


def generate_cover_letter(resume_text: str, job_description: str, tone: str = "professional") -> dict:
    name = _extract_name(resume_text)
    top_skills = _extract_top_skills(resume_text)
    company = _extract_company(job_description)
    role = _extract_role(job_description)
    years = _extract_years(resume_text)
    tone_phrases = {
        "professional": ("I am writing to express my strong interest in", "I look forward to discussing"),
        "confident": ("I am the ideal candidate for", "I am excited to bring my expertise to"),
        "casual": ("I'd love to join your team as", "I'd be thrilled to chat about"),
    }
    opener, closer = tone_phrases.get(tone, tone_phrases["professional"])
    letter = f"""{opener} the {role} position at {company}.

With {years} of hands-on experience, I bring deep expertise in {', '.join(top_skills[:4])}. Throughout my career, I have consistently delivered high-impact solutions that drive measurable business outcomes.

What excites me most about this opportunity is the chance to apply my experience with {', '.join(top_skills[1:4])} in a fast-paced, mission-driven environment. I thrive in cross-functional teams and have a strong track record of shipping features end-to-end.

Some highlights from my experience:
• Built and scaled systems handling thousands of users with high availability
• Led technical initiatives that reduced operational overhead and improved team velocity
• Mentored engineers and contributed to a culture of engineering excellence

{closer} how my background aligns with your team's goals.

Best regards,
{name}"""
    return {"cover_letter": letter, "tone": tone, "word_count": len(letter.split()), "tips": ["Customize with specific metrics from your resume.", "Research the company and add 1-2 sentences about why you want to work there.", "Keep the final version under 350 words."]}


def generate_interview_questions(resume_text: str, job_description: str, role: Optional[str] = None) -> dict:
    skills = _extract_top_skills(resume_text)
    jd_lower = job_description.lower()
    technical = [
        f"Walk me through how you would architect a scalable {skills[0] if skills else 'web'} application from scratch.",
        f"How have you used {skills[1] if len(skills) > 1 else 'Python'} to solve a complex problem in production?",
        "Describe your approach to system design for a high-traffic API.",
        f"What's your experience with {skills[2] if len(skills) > 2 else 'cloud infrastructure'} in production?",
        "How do you handle database performance optimization at scale?",
        "Explain the CAP theorem and when you've made tradeoffs in real projects.",
    ]
    behavioral = [
        "Tell me about a time you led a project under tight deadlines. How did you prioritize?",
        "Describe a situation where you disagreed with a technical decision. How did you handle it?",
        "Give an example of a time you mentored a junior engineer. What was the outcome?",
        "Tell me about the most complex bug you've debugged in production.",
        "How do you handle technical debt while shipping features quickly?",
    ]
    role_specific = []
    if "llm" in jd_lower or "ai" in jd_lower:
        role_specific += ["How do you evaluate and mitigate hallucinations in LLM-powered applications?", "Describe your experience with RAG architectures and vector databases."]
    if "full" in jd_lower or "frontend" in jd_lower:
        role_specific += ["How do you approach performance optimization in React applications?"]
    if "backend" in jd_lower or "api" in jd_lower:
        role_specific += ["How do you design RESTful APIs for extensibility and backward compatibility?"]
    return {
        "technical": technical, "behavioral": behavioral, "role_specific": role_specific[:4],
        "preparation_tips": ["Use the STAR method for behavioral questions.", "Prepare 2-3 quantified examples from your resume.", "Review system design fundamentals.", f"Brush up on: {', '.join(skills[:3])}."],
    }


def _extract_name(text: str) -> str:
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    for line in lines[:3]:
        words = line.split()
        if 2 <= len(words) <= 4 and all(w[0].isupper() for w in words if w):
            return line
    return "Your Name"


def _extract_top_skills(text: str) -> list:
    skills = ["React", "TypeScript", "Python", "Node.js", "AWS", "Docker", "PostgreSQL", "FastAPI", "LLMs", "system design", "leadership"]
    t = text.lower()
    return [s for s in skills if s.lower() in t][:6] or ["full-stack development", "Python", "cloud infrastructure"]


def _extract_company(jd: str) -> str:
    m = re.search(r"at\s+([A-Z][A-Za-z\s]+(?:Inc|Corp|LLC|Ltd|AI|Labs|Technologies)?)", jd)
    return m.group(1).strip() if m else "your company"


def _extract_role(jd: str) -> str:
    m = re.search(r"(Senior|Lead|Principal|Staff|Junior)?\s*(Full.?Stack|Backend|Frontend|ML|AI|Data|DevOps|Software)\s*Engineer", jd, re.IGNORECASE)
    return m.group().strip() if m else "Software Engineer"


def _extract_years(text: str) -> str:
    m = re.search(r"(\d+)\+?\s*years?", text, re.IGNORECASE)
    return f"{m.group(1)}+" if m else "several years"
