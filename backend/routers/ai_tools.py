from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import os

router = APIRouter()


def get_openai_client():
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        return None
    try:
        from openai import OpenAI
        return OpenAI(api_key=api_key)
    except Exception:
        return None


class NegoMessage(BaseModel):
    role: str
    content: str


class NegoInput(BaseModel):
    messages: List[NegoMessage]
    resume_text: Optional[str] = ""
    target_salary: Optional[str] = "$150,000"


class InterviewInput(BaseModel):
    question: str
    answer: str
    resume_text: Optional[str] = ""
    job_description: Optional[str] = ""


class AIRewriteInput(BaseModel):
    bullet: str
    context: Optional[str] = ""


@router.post("/negotiate")
def salary_negotiate(body: NegoInput):
    client = get_openai_client()
    if not client:
        # Fallback scripted responses
        scripted = [
            "We'd like to offer you $140,000 base for this role. We believe it's competitive. What are your thoughts?",
            "I can see your point. We could stretch to $150,000 with a $10k signing bonus. Does that work?",
            "That's a strong ask. Let me see what I can do — we might be able to do $155,000 base.",
            "We've reached our budget ceiling. Our final offer is $155,000 base + $15k signing bonus = $170k total year 1.",
            "I appreciate your persistence. The offer stands at $155,000 + $15k signing. This is our best and final.",
        ]
        idx = min(len([m for m in body.messages if m.role == "user"]) - 1, len(scripted) - 1)
        return {"response": scripted[max(0, idx)], "mode": "scripted"}
    try:
        system = f"""You are a realistic hiring manager negotiating salary with a candidate.
The candidate's target salary appears to be around {body.target_salary}.
Be firm but fair. Push back realistically. Keep responses under 3 sentences.
Start by offering $140,000. Gradually increase if pushed. Max budget is $165,000.
Never immediately agree to their first ask."""
        messages = [{"role": "system", "content": system}]
        for m in body.messages:
            messages.append({"role": m.role, "content": m.content})
        response = client.chat.completions.create(model="gpt-3.5-turbo", messages=messages, max_tokens=150, temperature=0.8)
        return {"response": response.choices[0].message.content, "mode": "ai"}
    except Exception as e:
        return {"response": "I need to consult with our compensation team. Can we reconnect tomorrow?", "mode": "fallback", "error": str(e)}


@router.post("/score-interview-answer")
def score_interview(body: InterviewInput):
    client = get_openai_client()
    if not client:
        # Heuristic scoring
        words = len(body.answer.split())
        has_numbers = any(c.isdigit() for c in body.answer)
        has_star = any(w in body.answer.lower() for w in ["situation","task","action","result","led","built","achieved","reduced","increased"])
        clarity = min(10, max(4, 6 + (1 if words > 80 else 0) + (1 if words > 150 else 0) + (1 if has_star else 0)))
        depth = min(10, max(4, 5 + (2 if words > 100 else 0) + (1 if has_numbers else 0) + (1 if has_star else 0)))
        relevance = min(10, max(5, 7 + (1 if has_star else 0)))
        overall = round((clarity + depth + relevance) / 3)
        feedback = "Excellent use of STAR method with specific metrics!" if overall >= 8 else "Good answer. Add more specific numbers and outcomes." if overall >= 6 else "Consider using the STAR method: Situation, Task, Action, Result."
        return {"clarity": clarity, "depth": depth, "relevance": relevance, "overall": overall, "feedback": feedback, "mode": "heuristic"}
    try:
        prompt = f"""Score this interview answer on a scale of 1-10 for:
1. Clarity (is it clear and well-structured?)
2. Depth (does it go into enough detail?)
3. Relevance (does it answer the question?)

Question: {body.question}
Answer: {body.answer}

Respond in JSON format only:
{{"clarity": 8, "depth": 7, "relevance": 9, "overall": 8, "feedback": "Brief specific feedback in 1-2 sentences"}}"""
        response = client.chat.completions.create(model="gpt-3.5-turbo", messages=[{"role": "user", "content": prompt}], max_tokens=200, temperature=0.3)
        import json
        result = json.loads(response.choices[0].message.content)
        result["mode"] = "ai"
        return result
    except Exception as e:
        return {"clarity": 7, "depth": 7, "relevance": 7, "overall": 7, "feedback": "Good answer. Consider adding more specific examples.", "mode": "fallback"}


@router.post("/ai-rewrite")
def ai_rewrite_bullet(body: AIRewriteInput):
    client = get_openai_client()
    if not client:
        from rewriter import rewrite_bullet
        return rewrite_bullet(body.bullet, body.context)
    try:
        prompt = f"""Rewrite this resume bullet point to be more impactful. Make it:
- Start with a strong action verb
- Include a quantified metric if possible
- Be concise and results-focused

Original: {body.bullet}

Return JSON only:
{{"improved": "rewritten bullet here", "alternatives": ["alt1", "alt2"], "issues_found": ["issue1"], "tips": ["tip1"]}}"""
        response = client.chat.completions.create(model="gpt-3.5-turbo", messages=[{"role": "user", "content": prompt}], max_tokens=300, temperature=0.7)
        import json
        result = json.loads(response.choices[0].message.content)
        result["original"] = body.bullet
        result["mode"] = "ai"
        return result
    except Exception:
        from rewriter import rewrite_bullet
        return rewrite_bullet(body.bullet, body.context)
