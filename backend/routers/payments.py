from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from typing import Optional
import stripe, os
from database import get_user_plan, update_user_plan
from routers.auth import verify_token

router = APIRouter()

PLANS = {
    "free": {"name": "Free", "price": 0, "resumes_per_month": 5, "features": ["5 resumes/month", "Basic analysis", "JD matching", "ATS score"]},
    "pro": {"name": "Pro", "price": 29, "resumes_per_month": 999999, "features": ["Unlimited resumes", "All 50 features", "Pipeline + Kanban", "Analytics", "AI tools", "Priority support"]},
    "enterprise": {"name": "Enterprise", "price": 0, "resumes_per_month": 999999, "features": ["Everything in Pro", "White-label", "SSO + SAML", "Dedicated CSM", "Custom integrations"]},
}


def _get_user(authorization: str):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = verify_token(authorization.replace("Bearer ", ""))
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload


@router.get("/plans")
def get_plans():
    return PLANS


@router.get("/my-plan")
def my_plan(authorization: str = Header(...)):
    user = _get_user(authorization)
    plan_info = get_user_plan(user["user_id"])
    plan_details = PLANS.get(plan_info["plan"], PLANS["free"])
    limit = plan_details["resumes_per_month"]
    used = plan_info["resumes_used_this_month"]
    return {
        "plan": plan_info["plan"],
        "plan_details": plan_details,
        "resumes_used": used,
        "resumes_limit": limit,
        "resumes_remaining": max(0, limit - used) if limit < 999999 else 999999,
        "is_limited": limit < 999999,
    }


class CheckoutInput(BaseModel):
    price_id: Optional[str] = None
    success_url: str = "http://localhost:5173/payment-success"
    cancel_url: str = "http://localhost:5173/pricing"


@router.post("/create-checkout")
def create_checkout(body: CheckoutInput, authorization: str = Header(...)):
    user = _get_user(authorization)
    if not stripe.api_key:
        # Return mock checkout for demo without Stripe key
        return {"url": body.success_url + "?demo=true", "session_id": "demo_session"}
    try:
        price_id = body.price_id or os.getenv("STRIPE_PRO_PRICE_ID", "")
        if not price_id:
            # Create a price on the fly for demo
            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                mode="subscription",
                line_items=[{"price_data": {"currency": "usd", "product_data": {"name": "TalentSuite Pro"}, "unit_amount": 2900, "recurring": {"interval": "month"}}, "quantity": 1}],
                success_url=body.success_url + "?session_id={CHECKOUT_SESSION_ID}",
                cancel_url=body.cancel_url,
                customer_email=user.get("email"),
            )
        else:
            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                mode="subscription",
                line_items=[{"price": price_id, "quantity": 1}],
                success_url=body.success_url + "?session_id={CHECKOUT_SESSION_ID}",
                cancel_url=body.cancel_url,
                customer_email=user.get("email"),
            )
        return {"url": session.url, "session_id": session.id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/billing-portal")
def billing_portal(authorization: str = Header(...)):
    user = _get_user(authorization)
    if not stripe.api_key:
        return {"url": "http://localhost:5173/settings"}
    try:
        from database import get_user_by_email
        db_user = get_user_by_email(user.get("email", ""))
        customer_id = db_user.get("stripe_customer_id") if db_user else None
        if not customer_id:
            return {"url": "http://localhost:5173/pricing"}
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url="http://localhost:5173/settings",
        )
        return {"url": session.url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/upgrade-demo")
def upgrade_demo(authorization: str = Header(...)):
    """Demo upgrade without real Stripe - for testing"""
    user = _get_user(authorization)
    from database import get_user_by_email
    db_user = get_user_by_email(user.get("email", ""))
    if db_user:
        update_user_plan(db_user["email"], "pro", "demo_subscription")
    return {"message": "Upgraded to Pro (demo mode)", "plan": "pro"}
