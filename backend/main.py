from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn, stripe, os, json
from dotenv import load_dotenv
load_dotenv()
from routers import analysis, bulk, tools, auth, pipeline, analytics, payments, ai_tools, features, github_analyzer
from database import init_db
stripe.api_key = os.getenv("STRIPE_SECRET_KEY","")
app = FastAPI(title="TalentSuite API", version="3.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(analysis.router, tags=["analysis"])
app.include_router(bulk.router, tags=["bulk"])
app.include_router(tools.router, tags=["tools"])
app.include_router(pipeline.router, tags=["pipeline"])
app.include_router(analytics.router, tags=["analytics"])
app.include_router(payments.router, prefix="/payments", tags=["payments"])
app.include_router(ai_tools.router, prefix="/ai", tags=["ai"])
app.include_router(features.router, prefix="/features", tags=["features"])
app.include_router(github_analyzer.router, prefix="/github", tags=["github"])

@app.on_event("startup")
def startup(): init_db()

@app.get("/")
def root(): return {"message": "TalentSuite API v3.1", "features": 50}

@app.get("/health")
def health(): return {"status": "ok", "stripe": bool(os.getenv("STRIPE_SECRET_KEY")), "openai": bool(os.getenv("OPENAI_API_KEY")), "resend": bool(os.getenv("RESEND_API_KEY"))}

@app.post("/stripe-webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature","")
    secret = os.getenv("STRIPE_WEBHOOK_SECRET","")
    try:
        event = stripe.Webhook.construct_event(payload, sig, secret) if secret else json.loads(payload)
        if event["type"] == "checkout.session.completed":
            s = event["data"]["object"]
            if s.get("customer_email"):
                from database import update_user_plan
                update_user_plan(s["customer_email"], "pro", s.get("subscription",""))
        elif event["type"] == "customer.subscription.deleted":
            from database import downgrade_user_plan
            downgrade_user_plan(event["data"]["object"]["id"])
    except Exception as e: raise HTTPException(status_code=400, detail=str(e))
    return {"status": "ok"}

if __name__ == "__main__": uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
