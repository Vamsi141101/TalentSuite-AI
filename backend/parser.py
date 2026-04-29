import io, re
import pdfplumber
import docx


def parse_resume_file(contents: bytes, filename: str) -> str:
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        return _extract_pdf(contents)
    elif name.endswith(".docx"):
        return _extract_docx(contents)
    return contents.decode("utf-8", errors="ignore")


def _extract_pdf(contents: bytes) -> str:
    text = []
    try:
        with pdfplumber.open(io.BytesIO(contents)) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    text.append(t)
    except Exception:
        return ""
    return "\n".join(text)


def _extract_docx(contents: bytes) -> str:
    try:
        doc = docx.Document(io.BytesIO(contents))
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    except Exception:
        return ""


def parse_resume_text(text: str) -> dict:
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    return {
        "name": _extract_name(lines),
        "email": _extract_email(text),
        "phone": _extract_phone(text),
        "linkedin": _extract_linkedin(text),
        "github": _extract_github(text),
        "location": _extract_location(text),
        "experience_years": _extract_years(text),
        "seniority": _extract_seniority(text),
        "education": _extract_education(text),
        "summary": _extract_summary(lines),
        "sections": _detect_sections(text),
        "total_words": len(text.split()),
        "total_bullets": text.count("•") + text.count("-") + text.count("*"),
    }


def _extract_name(lines):
    for line in lines[:5]:
        if len(line) < 45 and not re.search(r"[@|/\\:]", line) and not re.search(r"\d{4}", line):
            words = line.split()
            if 2 <= len(words) <= 4 and all(w[0].isupper() for w in words if w):
                return line
    return "Not detected"

def _extract_email(text):
    m = re.search(r"[\w.+-]+@[\w-]+\.[a-z]{2,}", text, re.IGNORECASE)
    return m.group() if m else None

def _extract_phone(text):
    m = re.search(r"(\+?\d[\d\s\-().]{8,14}\d)", text)
    return m.group().strip() if m else None

def _extract_linkedin(text):
    m = re.search(r"linkedin\.com/in/[\w-]+", text, re.IGNORECASE)
    return m.group() if m else None

def _extract_github(text):
    m = re.search(r"github\.com/[\w-]+", text, re.IGNORECASE)
    return m.group() if m else None

def _extract_location(text):
    m = re.search(r"\b([A-Z][a-z]+,\s*[A-Z]{2})\b", text)
    return m.group() if m else None

def _extract_years(text):
    m = re.search(r"(\d+)\+?\s*years?\s*(of\s+)?(experience|exp)", text, re.IGNORECASE)
    return f"{m.group(1)}+ years" if m else "Not specified"

def _extract_seniority(text):
    t = text.lower()
    for level in ["principal", "staff", "senior", "lead", "junior", "mid-level"]:
        if level in t:
            return level.capitalize()
    return "Mid-level"

def _extract_education(text):
    for pat in [r"(Ph\.?D\.?|Doctor of [A-Za-z]+)", r"(M\.?S\.?|Master[s]? of [A-Za-z\s]+)", r"(B\.?S\.?|B\.?E\.?|Bachelor[s]? of [A-Za-z\s]+)"]:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            return m.group().strip()
    return "Not detected"

def _extract_summary(lines):
    for i, line in enumerate(lines):
        if re.match(r"(summary|objective|about|profile)", line, re.IGNORECASE):
            chunk = " ".join(lines[i+1:i+4])
            return chunk[:300] if chunk else ""
    return lines[1][:200] if len(lines) > 1 else ""

def _detect_sections(text):
    sections = []
    patterns = {
        "summary": r"\b(summary|objective|about|profile)\b",
        "experience": r"\b(experience|work history|employment)\b",
        "education": r"\b(education|academic|degree)\b",
        "skills": r"\b(skills|technologies|tech stack)\b",
        "projects": r"\b(projects|portfolio)\b",
        "certifications": r"\b(certifications|certificates)\b",
    }
    t = text.lower()
    for section, pat in patterns.items():
        if re.search(pat, t):
            sections.append(section)
    return sections
