import re

BASE_SALARIES = {
    "Senior Full-Stack Engineer": {"min": 130000, "max": 200000, "median": 160000},
    "ML / AI Engineer": {"min": 150000, "max": 250000, "median": 190000},
    "Backend Engineer": {"min": 120000, "max": 185000, "median": 150000},
    "Frontend Engineer": {"min": 110000, "max": 170000, "median": 135000},
    "DevOps / Platform Engineer": {"min": 125000, "max": 190000, "median": 155000},
    "Data Scientist": {"min": 120000, "max": 185000, "median": 148000},
    "Data Engineer": {"min": 125000, "max": 185000, "median": 152000},
    "Product Manager": {"min": 130000, "max": 210000, "median": 165000},
}

SKILL_PREMIUMS = {
    "LLMs": 25000, "LangChain": 20000, "OpenAI API": 20000, "Kubernetes": 18000,
    "Rust": 20000, "Go": 15000, "PyTorch": 18000, "TensorFlow": 15000,
    "AWS": 12000, "GCP": 10000, "Azure": 10000, "Terraform": 12000,
    "Machine Learning": 20000, "Deep Learning": 22000, "MLOps": 18000,
    "leadership": 15000, "system design": 12000, "architecture": 12000,
}

SENIORITY_MULTIPLIERS = {
    "Junior": 0.65, "Mid-level": 0.85, "Senior": 1.0,
    "Lead": 1.15, "Staff": 1.25, "Principal": 1.35,
}


def estimate_salary(skills: dict, profile: dict, roles: list) -> dict:
    top_role = roles[0]["role"] if roles else "Senior Full-Stack Engineer"
    base = BASE_SALARIES.get(top_role, BASE_SALARIES["Senior Full-Stack Engineer"])
    seniority = profile.get("seniority", "Mid-level")
    multiplier = SENIORITY_MULTIPLIERS.get(seniority, 1.0)
    all_skills = skills.get("technical", []) + skills.get("tools", []) + skills.get("soft", [])
    premium = min(sum(SKILL_PREMIUMS.get(s, 0) for s in all_skills), 50000)
    low = round((base["min"] * multiplier + premium * 0.5) / 1000) * 1000
    high = round((base["max"] * multiplier + premium) / 1000) * 1000
    median = round((low + high) / 2 / 1000) * 1000
    return {
        "low": low, "high": high, "median": median,
        "currency": "USD", "period": "annual",
        "role": top_role, "seniority": seniority,
        "market": "US (Remote-friendly)",
        "premium_skills": [s for s in all_skills if s in SKILL_PREMIUMS][:5],
        "note": "Estimates based on 2024-2025 US market data.",
    }
