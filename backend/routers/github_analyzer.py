from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx, os

router = APIRouter()


class GithubInput(BaseModel):
    username: str
    token: Optional[str] = None  # optional for higher rate limits


@router.post("/analyze-github")
async def analyze_github(body: GithubInput):
    username = body.username.strip().lstrip("@")
    if not username:
        raise HTTPException(status_code=400, detail="Username required")

    # Check cache first
    from database import get_github_cache, set_github_cache
    cached = get_github_cache(username)
    if cached:
        cached["from_cache"] = True
        return cached

    headers = {"Accept": "application/vnd.github.v3+json"}
    if body.token:
        headers["Authorization"] = f"token {body.token}"
    elif os.getenv("GITHUB_TOKEN"):
        headers["Authorization"] = f"token {os.getenv('GITHUB_TOKEN')}"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            user_resp = await client.get(f"https://api.github.com/users/{username}", headers=headers)
            if user_resp.status_code == 404:
                raise HTTPException(status_code=404, detail=f"GitHub user '{username}' not found")
            if user_resp.status_code == 403:
                raise HTTPException(status_code=429, detail="GitHub rate limit reached. Add a GitHub token or try again later.")
            user_resp.raise_for_status()
            user = user_resp.json()

            repos_resp = await client.get(f"https://api.github.com/users/{username}/repos?per_page=100&sort=updated", headers=headers)
            repos = repos_resp.json() if repos_resp.status_code == 200 else []

        # Process repos
        langs: dict = {}
        total_stars = 0
        total_forks = 0
        has_tests = False
        has_docs = False
        open_source_contrib = False

        if isinstance(repos, list):
            for r in repos:
                if r.get("language"):
                    langs[r["language"]] = langs.get(r["language"], 0) + 1
                total_stars += r.get("stargazers_count", 0)
                total_forks += r.get("forks_count", 0)
                name = (r.get("name", "") + r.get("description", "")).lower()
                if any(w in name for w in ["test", "spec", "jest", "pytest"]):
                    has_tests = True
                if r.get("has_pages") or "docs" in name or "documentation" in name:
                    has_docs = True
                if r.get("fork"):
                    open_source_contrib = True

        top_langs = [k for k, _ in sorted(langs.items(), key=lambda x: -x[1])[:5]]
        repo_count = user.get("public_repos", 0)
        followers = user.get("followers", 0)

        # Quality scoring
        quality = min(98, 50
            + min(25, repo_count)
            + min(10, total_stars // 10)
            + (5 if has_tests else 0)
            + (5 if has_docs else 0)
            + (5 if open_source_contrib else 0))

        consistency = min(98, 50
            + min(20, followers // 5)
            + min(15, repo_count // 3)
            + (8 if len(top_langs) >= 3 else 0)
            + (5 if total_forks > 5 else 0))

        result = {
            "username": username,
            "name": user.get("name") or username,
            "bio": user.get("bio") or "",
            "avatar": user.get("avatar_url"),
            "repos": repo_count,
            "followers": followers,
            "following": user.get("following", 0),
            "stars": total_stars,
            "forks": total_forks,
            "languages": top_langs,
            "quality": quality,
            "consistency": consistency,
            "writes_tests": has_tests,
            "has_docs": has_docs,
            "open_source": open_source_contrib,
            "location": user.get("location"),
            "company": user.get("company"),
            "blog": user.get("blog"),
            "created_at": user.get("created_at"),
            "updated_at": user.get("updated_at"),
            "from_cache": False,
            "rate_limited": False,
        }

        # Cache the result
        set_github_cache(username, result)
        return result

    except HTTPException:
        raise
    except httpx.TimeoutException:
        raise HTTPException(status_code=408, detail="GitHub API timeout — try again")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GitHub API error: {str(e)}")
