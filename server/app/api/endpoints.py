from fastapi import APIRouter, HTTPException, Depends, Request
from typing import List
from app.models.schemas import (
    DashboardResponse,
    Campaign,
    StrategyUpdate,
    ChatMessage,
    ChatResponse,
    ReportAnalysisResponse
)
from app.services.ai_simulation import (
    generate_dashboard_data,
    generate_campaigns,
    update_campaign_strategy
)
from app.services.ai_client import generate_chat_response
from app.core.config import settings
from app.api.deps import verify_token

router = APIRouter(prefix=settings.API_V1_STR, tags=["grok-admaster"])


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(user_id: str = Depends(verify_token)):
    """Get dashboard metrics, sales data, and AI actions"""
    return generate_dashboard_data()


@router.get("/campaigns", response_model=List[Campaign])
async def get_campaigns(user_id: str = Depends(verify_token)):
    """Get all campaigns"""
    return generate_campaigns()


@router.get("/campaigns/{campaign_id}", response_model=Campaign)
async def get_campaign(campaign_id: str, user_id: str = Depends(verify_token)):
    """Get specific campaign by ID"""
    campaigns = generate_campaigns()
    for campaign in campaigns:
        if campaign.id == campaign_id:
            return campaign
    raise HTTPException(status_code=404, detail="Campaign not found")


@router.post("/campaigns/{campaign_id}/strategy", response_model=Campaign)
async def update_strategy(campaign_id: str, strategy_update: StrategyUpdate, user_id: str = Depends(verify_token)):
    """Update campaign strategy"""
    try:
        return update_campaign_strategy(campaign_id, strategy_update.strategy)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


from fastapi import UploadFile, File

@router.post("/chat", response_model=ChatResponse)
async def chat(message: ChatMessage, user_id: str = Depends(verify_token)):
    """Send message to Grok AI and get response"""
    return await generate_chat_response(message.message, history=message.history)

@router.post("/reports/upload", response_model=ReportAnalysisResponse)
async def upload_report(file: UploadFile = File(...), user_id: str = Depends(verify_token)):
    """Upload and analyze a CSV report"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
        
    content = await file.read()
    try:
        text_content = content.decode('utf-8')
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Could not read CSV file. Please ensure it is UTF-8 encoded.")
        
    from app.services.ai_client import analyze_csv_report
    analysis = await analyze_csv_report(text_content)
    return analysis

@router.get("/health")
async def health_check(request: Request = None):
    """Enhanced health check — verifies dependencies and reports status."""
    from datetime import datetime
    import time

    checks = {"api": "healthy"}
    overall = "healthy"

    # Check Supabase connectivity
    try:
        from app.api.deps import get_supabase_client
        sb = get_supabase_client()
        sb.table("campaigns").select("id").limit(1).execute()
        checks["supabase"] = "healthy"
    except Exception as e:
        checks["supabase"] = f"degraded: {str(e)[:80]}"
        overall = "degraded"

    # Check scheduler
    try:
        from fastapi import Request as Req
        if request and hasattr(request, 'app') and hasattr(request.app.state, 'scheduler'):
            scheduler = request.app.state.scheduler
            jobs = scheduler.get_jobs()
            checks["scheduler"] = f"running ({len(jobs)} jobs)"
        else:
            checks["scheduler"] = "unknown"
    except Exception:
        checks["scheduler"] = "unknown"

    return {
        "status": overall,
        "service": "optimus-pryme",
        "version": "2.1.0",
        "timestamp": datetime.utcnow().isoformat(),
        "checks": checks,
    }



# ─── Approval Queue Endpoints ───

@router.get("/approvals/pending")
async def get_pending_approvals(user_id: str = Depends(verify_token)):
    """Get all pending approval items across all action types."""
    from app.api.deps import get_supabase_client
    sb = get_supabase_client()
    res = sb.table("pending_approvals").select("*").eq("status", "pending").order("created_at", desc=True).execute()
    return res.data or []


@router.post("/approvals/{approval_id}/approve")
async def approve_action(approval_id: str, user_id: str = Depends(verify_token)):
    """Approve a pending action and execute it."""
    from app.api.deps import get_supabase_client
    sb = get_supabase_client()

    # Fetch the pending approval
    res = sb.table("pending_approvals").select("*").eq("id", approval_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Approval not found")

    item = res.data
    if item["status"] != "pending":
        raise HTTPException(status_code=400, detail="Already processed")

    # Execute based on action type
    if item["action_type"] == "bid_change":
        sb.from_("keywords").update({
            "bid": item["recommended_value"],
            "updated_at": __import__("datetime").datetime.utcnow().isoformat(),
        }).eq("id", item["keyword_id"]).execute()
    elif item["action_type"] == "negative_keyword":
        metadata = item.get("metadata", {})
        if metadata.get("suggestion_id"):
            sb.table("negative_keyword_suggestions").update({
                "status": "applied",
            }).eq("id", metadata["suggestion_id"]).execute()

    # Mark as approved
    sb.table("pending_approvals").update({
        "status": "approved",
        "resolved_by": user_id,
        "resolved_at": __import__("datetime").datetime.utcnow().isoformat(),
    }).eq("id", approval_id).execute()

    return {"status": "approved", "id": approval_id}


@router.post("/approvals/{approval_id}/reject")
async def reject_action(approval_id: str, user_id: str = Depends(verify_token)):
    """Reject a pending action."""
    from app.api.deps import get_supabase_client
    sb = get_supabase_client()

    sb.table("pending_approvals").update({
        "status": "rejected",
        "resolved_by": user_id,
        "resolved_at": __import__("datetime").datetime.utcnow().isoformat(),
    }).eq("id", approval_id).execute()

    return {"status": "rejected", "id": approval_id}


@router.get("/approvals/count")
async def get_pending_count(user_id: str = Depends(verify_token)):
    """Get count of pending approvals for badge display."""
    from app.api.deps import get_supabase_client
    sb = get_supabase_client()
    res = sb.table("pending_approvals").select("id", count="exact").eq("status", "pending").execute()
    return {"count": res.count or 0}


@router.get("/notifications")
async def get_notifications(user_id: str = Depends(verify_token)):
    """Get recent notifications."""
    from app.api.deps import get_supabase_client
    sb = get_supabase_client()
    res = sb.table("notifications").select("*").order("created_at", desc=True).limit(50).execute()
    return res.data or []


@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user_id: str = Depends(verify_token)):
    """Mark a notification as read."""
    from app.api.deps import get_supabase_client
    sb = get_supabase_client()
    sb.table("notifications").update({"is_read": True}).eq("id", notification_id).execute()
    return {"status": "ok"}


@router.post("/autonomous/trigger")
async def trigger_autonomous_cycle(user_id: str = Depends(verify_token)):
    """Manually trigger an autonomous optimization cycle (for testing/on-demand)."""
    from app.services.autonomous_executor import (
        run_autonomous_bid_optimization,
        auto_conclude_experiments,
        auto_negate_wasteful_keywords,
        auto_advance_rollouts,
    )

    bid_result = await run_autonomous_bid_optimization()
    negate_result = await auto_negate_wasteful_keywords()
    exp_concluded = await auto_conclude_experiments()
    rollouts_advanced = await auto_advance_rollouts()

    return {
        "bids": bid_result,
        "negations": negate_result,
        "experiments_concluded": exp_concluded,
        "rollouts_advanced": rollouts_advanced,
    }


# ─── Explainability Endpoints ───

@router.get("/explain/approval/{approval_id}")
async def explain_approval(approval_id: str, user_id: str = Depends(verify_token)):
    """Get a human-readable explanation for a pending approval item."""
    from app.services.explainability import explain_pending_approval
    return await explain_pending_approval(approval_id)


@router.get("/explain/log/{log_id}")
async def explain_log(log_id: str, user_id: str = Depends(verify_token)):
    """Get a human-readable explanation for an autonomous log entry ('Why did Optimus do this?')."""
    from app.services.explainability import explain_autonomous_log
    return await explain_autonomous_log(log_id)


@router.post("/explain/recommendation")
async def explain_recommendation(
    keyword_id: str,
    campaign_id: str,
    current_bid: float,
    recommended_bid: float,
    confidence: float = 0.80,
    model_source: str = "ensemble",
    user_id: str = Depends(verify_token),
):
    """Get a human-readable explanation for a bid recommendation before accepting."""
    from app.services.explainability import explain_bid_recommendation
    return await explain_bid_recommendation(
        keyword_id=keyword_id,
        campaign_id=campaign_id,
        current_bid=current_bid,
        recommended_bid=recommended_bid,
        confidence=confidence,
        model_source=model_source,
    )


# ─── Autonomous Activity Feed ───

@router.get("/autonomous/logs")
async def get_autonomous_logs(limit: int = 50, user_id: str = Depends(verify_token)):
    """Get recent autonomous action logs for the activity feed."""
    from app.api.deps import get_supabase_client
    sb = get_supabase_client()
    res = sb.table("autonomous_logs").select("*").order("created_at", desc=True).limit(limit).execute()
    return res.data or []


@router.get("/autonomous/stats")
async def get_autonomous_stats(user_id: str = Depends(verify_token)):
    """Get aggregate stats for autonomous operations (for dashboards)."""
    from app.api.deps import get_supabase_client
    sb = get_supabase_client()

    # Count by tier
    auto_res = sb.table("autonomous_logs").select("id", count="exact").eq("approval_tier", "auto_execute").execute()
    notify_res = sb.table("autonomous_logs").select("id", count="exact").eq("approval_tier", "notify").execute()

    # Pending count
    pending_res = sb.table("pending_approvals").select("id", count="exact").eq("status", "pending").execute()

    # Recent 24h actions
    from datetime import datetime, timedelta
    yesterday = (datetime.utcnow() - timedelta(hours=24)).isoformat()
    recent_res = sb.table("autonomous_logs").select("id", count="exact").gte("created_at", yesterday).execute()

    return {
        "total_auto_executed": auto_res.count or 0,
        "total_notified": notify_res.count or 0,
        "pending_approvals": pending_res.count or 0,
        "actions_last_24h": recent_res.count or 0,
    }


# ─── Predictive Alerts ───

@router.post("/predictive-alerts")
async def trigger_predictive_alerts(user_id: str = Depends(verify_token)):
    """Run the predictive alerts engine to detect anomalies and generate early warnings."""
    from app.services.predictive_alerts import generate_predictive_alerts
    alerts = await generate_predictive_alerts()
    return {"status": "success", "alerts_generated": len(alerts), "alerts": alerts}
