import hashlib, json, base64, time
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel
from database import get_conn

router = APIRouter()
SECRET = "talentsuite_secret_2025"


def hash_password(password: str) -> str:
    return hashlib.sha256((password + SECRET).encode()).hexdigest()


def create_token(user_id: int, email: str) -> str:
    payload = {"user_id": user_id, "email": email, "exp": time.time() + 86400 * 7}
    encoded = base64.b64encode(json.dumps(payload).encode()).decode()
    sig = hashlib.sha256((encoded + SECRET).encode()).hexdigest()[:16]
    return f"{encoded}.{sig}"


def verify_token(token: str) -> Optional[dict]:
    try:
        parts = token.split(".")
        if len(parts) != 2:
            return None
        payload = json.loads(base64.b64decode(parts[0]).decode())
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None


class RegisterInput(BaseModel):
    email: str
    name: str
    password: str
    role: str = "recruiter"


class LoginInput(BaseModel):
    email: str
    password: str


@router.post("/register")
def register(body: RegisterInput):
    conn = get_conn()
    existing = conn.execute("SELECT id FROM users WHERE email=?", (body.email,)).fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=400, detail="Email already registered")
    pw_hash = hash_password(body.password)
    cur = conn.execute("INSERT INTO users (email, name, password_hash, role) VALUES (?,?,?,?)", (body.email, body.name, pw_hash, body.role))
    user_id = cur.lastrowid
    conn.commit()
    conn.close()
    token = create_token(user_id, body.email)
    return {"token": token, "user": {"id": user_id, "email": body.email, "name": body.name, "role": body.role}}


@router.post("/login")
def login(body: LoginInput):
    conn = get_conn()
    user = conn.execute("SELECT * FROM users WHERE email=?", (body.email,)).fetchone()
    conn.close()
    if not user or user["password_hash"] != hash_password(body.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"], user["email"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]}}


@router.get("/me")
def me(authorization: str = Header(...)):
    payload = verify_token(authorization.replace("Bearer ", ""))
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    conn = get_conn()
    u = conn.execute("SELECT id, email, name, role, plan, created_at FROM users WHERE id=?", (payload["user_id"],)).fetchone()
    conn.close()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(u)


@router.get("/snapshots")
def get_snapshots(authorization: str = Header(...)):
    payload = verify_token(authorization.replace("Bearer ", ""))
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    from database import get_snapshots
    return get_snapshots(payload["user_id"])


@router.post("/save-snapshot")
def save_snapshot(body: dict, authorization: str = Header(...)):
    payload = verify_token(authorization.replace("Bearer ", ""))
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    from database import save_snapshot
    save_snapshot(payload["user_id"], body.get("score", 0), body.get("skills", 0), body.get("label", ""))
    return {"status": "saved"}
