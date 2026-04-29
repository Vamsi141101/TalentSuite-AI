import sqlite3,json
from pathlib import Path
from datetime import datetime
DB_PATH=Path("./talentsuite.db")
def get_conn():
    conn=sqlite3.connect(DB_PATH);conn.row_factory=sqlite3.Row;return conn
def init_db():
    conn=get_conn();c=conn.cursor()
    c.execute("""CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password_hash TEXT NOT NULL,role TEXT DEFAULT 'recruiter',plan TEXT DEFAULT 'free',stripe_customer_id TEXT,stripe_subscription_id TEXT,resumes_used_this_month INTEGER DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP)""")
    c.execute("""CREATE TABLE IF NOT EXISTS resumes(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,filename TEXT,raw_text TEXT,analysis_json TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id))""")
    c.execute("""CREATE TABLE IF NOT EXISTS jobs(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,title TEXT NOT NULL,description TEXT,department TEXT,status TEXT DEFAULT 'active',created_at TEXT DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id))""")
    c.execute("""CREATE TABLE IF NOT EXISTS candidates(id INTEGER PRIMARY KEY AUTOINCREMENT,job_id INTEGER,resume_id INTEGER,name TEXT,email TEXT,status TEXT DEFAULT 'screened',match_score REAL DEFAULT 0,ats_score REAL DEFAULT 0,resume_score REAL DEFAULT 0,notes TEXT DEFAULT '',created_at TEXT DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(job_id) REFERENCES jobs(id))""")
    c.execute("""CREATE TABLE IF NOT EXISTS results(id TEXT PRIMARY KEY,data_json TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)""")
    c.execute("""CREATE TABLE IF NOT EXISTS score_snapshots(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,score INTEGER,skills INTEGER,label TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)""")
    conn.commit();conn.close()
def save_result(rid,data):
    conn=get_conn();conn.execute("INSERT OR REPLACE INTO results(id,data_json,created_at)VALUES(?,?,?)",(rid,json.dumps(data,default=str),datetime.now().isoformat()));conn.commit();conn.close()
def get_result(rid):
    conn=get_conn();row=conn.execute("SELECT data_json FROM results WHERE id=?",(rid,)).fetchone();conn.close();return json.loads(row["data_json"]) if row else None
def save_resume(user_id,filename,raw_text,analysis):
    conn=get_conn();cur=conn.execute("INSERT INTO resumes(user_id,filename,raw_text,analysis_json)VALUES(?,?,?,?)",(user_id,filename,raw_text,json.dumps(analysis,default=str)));rid=cur.lastrowid
    conn.execute("UPDATE users SET resumes_used_this_month=resumes_used_this_month+1 WHERE id=?",(user_id,));conn.commit();conn.close();return rid
def get_user_resumes(user_id):
    conn=get_conn();rows=conn.execute("SELECT id,filename,created_at,analysis_json FROM resumes WHERE user_id=? ORDER BY created_at DESC",(user_id,)).fetchall();conn.close()
    results=[]
    for row in rows:
        try:
            a=json.loads(row["analysis_json"]);results.append({"id":row["id"],"filename":row["filename"],"created_at":row["created_at"],"name":a.get("profile",{}).get("name","Unknown"),"top_role":a.get("role_predictions",[{}])[0].get("role",""),"ats_score":a.get("ats_score",{}).get("overall",0),"resume_score":a.get("resume_score",{}).get("overall",0)})
        except:pass
    return results
def save_snapshot(user_id,score,skills,label):
    conn=get_conn();conn.execute("INSERT INTO score_snapshots(user_id,score,skills,label)VALUES(?,?,?,?)",(user_id,score,skills,label));conn.commit();conn.close()
def get_snapshots(user_id):
    conn=get_conn();rows=conn.execute("SELECT score,skills,label,created_at FROM score_snapshots WHERE user_id=? ORDER BY created_at ASC LIMIT 10",(user_id,)).fetchall();conn.close();return [dict(r) for r in rows]
def create_job(user_id,title,description,department):
    conn=get_conn();cur=conn.execute("INSERT INTO jobs(user_id,title,description,department)VALUES(?,?,?,?)",(user_id,title,description,department));jid=cur.lastrowid;conn.commit();conn.close();return jid
def get_jobs(user_id):
    conn=get_conn();rows=conn.execute("SELECT j.*,COUNT(c.id) as candidate_count FROM jobs j LEFT JOIN candidates c ON c.job_id=j.id WHERE j.user_id=? GROUP BY j.id ORDER BY j.created_at DESC",(user_id,)).fetchall();conn.close();return [dict(r) for r in rows]
def add_candidate(job_id,resume_id,name,email,match_score,ats_score,resume_score):
    conn=get_conn();cur=conn.execute("INSERT INTO candidates(job_id,resume_id,name,email,match_score,ats_score,resume_score)VALUES(?,?,?,?,?,?,?)",(job_id,resume_id,name,email,match_score,ats_score,resume_score));cid=cur.lastrowid;conn.commit();conn.close();return cid
def get_candidates(job_id):
    conn=get_conn();rows=conn.execute("SELECT * FROM candidates WHERE job_id=? ORDER BY match_score DESC",(job_id,)).fetchall();conn.close();return [dict(r) for r in rows]
def update_candidate_status(candidate_id,status,notes=None):
    conn=get_conn()
    if notes is not None:conn.execute("UPDATE candidates SET status=?,notes=? WHERE id=?",(status,notes,candidate_id))
    else:conn.execute("UPDATE candidates SET status=? WHERE id=?",(status,candidate_id))
    conn.commit();conn.close()
def get_analytics(user_id):
    conn=get_conn()
    total_resumes=conn.execute("SELECT COUNT(*) as n FROM resumes WHERE user_id=?",(user_id,)).fetchone()["n"]
    total_jobs=conn.execute("SELECT COUNT(*) as n FROM jobs WHERE user_id=?",(user_id,)).fetchone()["n"]
    avg=conn.execute("SELECT AVG(match_score) as avg_match,AVG(ats_score) as avg_ats FROM candidates c JOIN jobs j ON c.job_id=j.id WHERE j.user_id=?",(user_id,)).fetchone()
    status_counts=conn.execute("SELECT status,COUNT(*) as n FROM candidates c JOIN jobs j ON c.job_id=j.id WHERE j.user_id=? GROUP BY status",(user_id,)).fetchall()
    weekly=conn.execute("SELECT DATE(created_at) as day,COUNT(*) as n FROM resumes WHERE user_id=? AND created_at>=DATE('now','-7 days') GROUP BY day",(user_id,)).fetchall()
    conn.close()
    return {"total_resumes":total_resumes,"total_jobs":total_jobs,"avg_match_score":round(avg["avg_match"] or 0,1),"avg_ats_score":round(avg["avg_ats"] or 0,1),"pipeline_status":{r["status"]:r["n"] for r in status_counts},"weekly_activity":[dict(r) for r in weekly]}
def get_user_plan(user_id):
    conn=get_conn();row=conn.execute("SELECT plan,resumes_used_this_month FROM users WHERE id=?",(user_id,)).fetchone();conn.close();return dict(row) if row else {"plan":"free","resumes_used_this_month":0}
def update_user_plan(email,plan,subscription_id=""):
    conn=get_conn();conn.execute("UPDATE users SET plan=?,stripe_subscription_id=? WHERE email=?",(plan,subscription_id,email));conn.commit();conn.close()
def downgrade_user_plan(subscription_id):
    conn=get_conn();conn.execute("UPDATE users SET plan='free' WHERE stripe_subscription_id=?",(subscription_id,));conn.commit();conn.close()
def get_user_by_email(email):
    conn=get_conn();row=conn.execute("SELECT * FROM users WHERE email=?",(email,)).fetchone();conn.close();return dict(row) if row else None

def get_github_cache(username: str):
    conn = get_conn()
    try:
        row = conn.execute("SELECT data_json, created_at FROM github_cache WHERE username=?", (username,)).fetchone()
        conn.close()
        if not row:
            return None
        # Cache valid for 1 hour
        from datetime import datetime, timezone
        cached_at = datetime.fromisoformat(row["created_at"])
        age = (datetime.now() - cached_at).total_seconds()
        if age > 3600:
            return None
        return json.loads(row["data_json"])
    except:
        conn.close()
        return None

def set_github_cache(username: str, data: dict):
    conn = get_conn()
    try:
        conn.execute("CREATE TABLE IF NOT EXISTS github_cache (username TEXT PRIMARY KEY, data_json TEXT, created_at TEXT)")
        conn.execute("INSERT OR REPLACE INTO github_cache (username, data_json, created_at) VALUES (?,?,?)",
                     (username, json.dumps(data), datetime.now().isoformat()))
        conn.commit()
    except:
        pass
    finally:
        conn.close()

def get_analytics_full(user_id):
    conn = get_conn()
    total_resumes = conn.execute("SELECT COUNT(*) as n FROM resumes WHERE user_id=?", (user_id,)).fetchone()["n"]
    total_jobs = conn.execute("SELECT COUNT(*) as n FROM jobs WHERE user_id=?", (user_id,)).fetchone()["n"]
    avg = conn.execute("SELECT AVG(match_score) as avg_match, AVG(ats_score) as avg_ats, AVG(resume_score) as avg_score FROM candidates c JOIN jobs j ON c.job_id=j.id WHERE j.user_id=?", (user_id,)).fetchone()
    status_counts = conn.execute("SELECT status, COUNT(*) as n FROM candidates c JOIN jobs j ON c.job_id=j.id WHERE j.user_id=? GROUP BY status", (user_id,)).fetchall()
    weekly = conn.execute("SELECT DATE(created_at) as day, COUNT(*) as n FROM resumes WHERE user_id=? AND created_at>=DATE('now','-7 days') GROUP BY day ORDER BY day", (user_id,)).fetchall()
    top_roles = conn.execute("SELECT analysis_json FROM resumes WHERE user_id=? ORDER BY created_at DESC LIMIT 20", (user_id,)).fetchall()
    conn.close()

    # Extract top roles from stored analyses
    roles = {}
    for r in top_roles:
        try:
            a = json.loads(r["analysis_json"])
            role = a.get("role_predictions", [{}])[0].get("role", "Unknown")
            roles[role] = roles.get(role, 0) + 1
        except:
            pass

    top_roles_list = sorted([{"role": k, "count": v} for k, v in roles.items()], key=lambda x: -x["count"])[:5]
    pipeline_status = {r["status"]: r["n"] for r in status_counts}
    hired = pipeline_status.get("offer", 0)
    screened = sum(pipeline_status.values()) or 1
    hire_rate = round((hired / screened) * 100, 1)

    return {
        "total_resumes": total_resumes,
        "total_jobs": total_jobs,
        "avg_match_score": round(avg["avg_match"] or 0, 1),
        "avg_ats_score": round(avg["avg_ats"] or 0, 1),
        "avg_resume_score": round(avg["avg_score"] or 0, 1),
        "pipeline_status": pipeline_status,
        "weekly_activity": [dict(r) for r in weekly],
        "top_roles": top_roles_list,
        "hire_rate": hire_rate,
    }
