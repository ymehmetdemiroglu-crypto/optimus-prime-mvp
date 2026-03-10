"""
Explainability Layer — "Why This Recommendation?" for Optimus Pryme.

Uses AI to generate human-readable explanations for every autonomous decision,
pulling context from keyword performance, campaign strategy, ML model outputs,
and historical trends.

This service is called:
1. On-demand via the /explain endpoint (for a specific action or recommendation)
2. Inline by the autonomous executor to enrich approval queue items with rationale
"""
import os
import json
import logging
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("explainability")


_supabase: Client | None = None


def _get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        _supabase = create_client(
            os.getenv("SUPABASE_URL", ""),
            os.getenv("SUPABASE_KEY", ""),
        )
        try:
            _supabase.auth.sign_in_with_password({
                "email": os.getenv("SERVICE_EMAIL", ""),
                "password": os.getenv("SERVICE_PASSWORD", ""),
            })
        except Exception:
            pass
    return _supabase


async def explain_bid_recommendation(
    keyword_id: str,
    campaign_id: str,
    current_bid: float,
    recommended_bid: float,
    confidence: float,
    model_source: str = "ensemble",
) -> dict:
    """
    Generate a human-readable explanation for a bid recommendation.
    Pulls keyword performance, campaign context, and model reasoning.
    """
    sb = _get_supabase()
    context = {}

    try:
        # 1. Keyword performance data
        kw_res = sb.table("keywords").select(
            "keyword_text, match_type, bid, status, impressions, clicks, spend, sales, orders, acos"
        ).eq("id", keyword_id).single().execute()
        context["keyword"] = kw_res.data if kw_res.data else {}

        # 2. Campaign context
        camp_res = sb.table("campaigns").select(
            "name, strategy, daily_budget, spend, sales, acos, status"
        ).eq("id", campaign_id).single().execute()
        context["campaign"] = camp_res.data if camp_res.data else {}

        # 3. Keyword health score if available
        try:
            health_res = sb.rpc("campaign_keyword_health", {"p_campaign_id": campaign_id}).execute()
            for h in (health_res.data or []):
                if h.get("keyword_id") == keyword_id:
                    context["health"] = h
                    break
        except Exception:
            pass

        # 4. Recent autonomous actions on this keyword
        try:
            log_res = sb.table("autonomous_logs").select("*").eq(
                "keyword_id", keyword_id
            ).order("created_at", desc=True).limit(5).execute()
            context["recent_actions"] = log_res.data or []
        except Exception:
            context["recent_actions"] = []

    except Exception as e:
        logger.warning(f"Failed to gather context for explanation: {e}")

    # Build the explanation
    kw = context.get("keyword", {})
    camp = context.get("campaign", {})
    health = context.get("health", {})
    recent = context.get("recent_actions", [])

    change_pct = abs((recommended_bid - current_bid) / current_bid * 100) if current_bid > 0 else 0
    direction = "increase" if recommended_bid > current_bid else "decrease"

    explanation = {
        "summary": "",
        "factors": [],
        "risk_level": "low",
        "historical_context": "",
        "recommendation_action": f"{'↑' if direction == 'increase' else '↓'} {direction.title()} bid from ${current_bid:.2f} → ${recommended_bid:.2f} ({change_pct:.1f}%)",
    }

    # Build factor list
    factors = []

    # Performance factors
    if kw:
        kw_acos = float(kw.get("acos", 0))
        kw_clicks = int(kw.get("clicks", 0))
        kw_orders = int(kw.get("orders", 0))
        kw_spend = float(kw.get("spend", 0))
        kw_sales = float(kw.get("sales", 0))
        kw_cvr = (kw_orders / kw_clicks * 100) if kw_clicks > 0 else 0

        if kw_acos > 50 and direction == "decrease":
            factors.append({
                "factor": "High ACoS",
                "detail": f"Keyword ACoS is {kw_acos:.1f}% — above efficient threshold. Lowering bid reduces wasted spend.",
                "impact": "high",
            })
        elif kw_acos < 20 and direction == "increase":
            factors.append({
                "factor": "Strong ACoS",
                "detail": f"Keyword ACoS is only {kw_acos:.1f}% — well below target. Increasing bid can capture more volume.",
                "impact": "high",
            })

        if kw_cvr > 10:
            factors.append({
                "factor": "High Converting",
                "detail": f"Conversion rate is {kw_cvr:.1f}% ({kw_orders} orders from {kw_clicks} clicks). This keyword is a strong performer.",
                "impact": "high",
            })
        elif kw_clicks > 50 and kw_orders == 0:
            factors.append({
                "factor": "Zero Conversions",
                "detail": f"Keyword has {kw_clicks} clicks but 0 orders (${kw_spend:.2f} spent). Reducing bid limits further waste.",
                "impact": "critical",
            })

    # Campaign context
    if camp:
        camp_strategy = camp.get("strategy", "unknown")
        camp_acos = float(camp.get("acos", 0))
        factors.append({
            "factor": "Campaign Strategy",
            "detail": f"Campaign '{camp.get('name')}' uses '{camp_strategy}' strategy with current ACoS {camp_acos:.1f}%.",
            "impact": "medium",
        })

    # Health context
    if health:
        health_status = health.get("health_status", "good")
        health_score = health.get("health_score", 100)
        if health_status in ("warning", "critical"):
            factors.append({
                "factor": f"Health: {health_status.title()}",
                "detail": f"Keyword health score is {health_score}/100 — flagged as {health_status}.",
                "impact": "high" if health_status == "critical" else "medium",
            })

    # ML confidence
    factors.append({
        "factor": "Model Confidence",
        "detail": f"The {model_source} model has {confidence:.0%} confidence in this recommendation.",
        "impact": "high" if confidence >= 0.85 else "medium" if confidence >= 0.70 else "low",
    })

    # Historical context
    if recent:
        last_action = recent[0]
        explanation["historical_context"] = (
            f"Last autonomous action on this keyword: '{last_action.get('action_type')}' "
            f"on {last_action.get('created_at', 'unknown date')[:10]} — "
            f"changed bid from ${last_action.get('previous_value', 0)} to ${last_action.get('new_value', 0)}."
        )

    # Risk level
    if change_pct > 30 or confidence < 0.70:
        explanation["risk_level"] = "high"
    elif change_pct > 20 or confidence < 0.85:
        explanation["risk_level"] = "medium"
    else:
        explanation["risk_level"] = "low"

    # Summary
    kw_text = kw.get("keyword_text", "this keyword")
    if direction == "increase":
        explanation["summary"] = (
            f"The {model_source} model recommends increasing the bid for '{kw_text}' by {change_pct:.1f}% "
            f"because it shows strong conversion performance and there's room to capture more search volume "
            f"at an efficient cost-per-acquisition."
        )
    else:
        explanation["summary"] = (
            f"The {model_source} model recommends decreasing the bid for '{kw_text}' by {change_pct:.1f}% "
            f"to reduce inefficient spend. The current performance metrics suggest the keyword is underperforming "
            f"relative to its cost."
        )

    explanation["factors"] = factors
    return explanation


async def explain_autonomous_log(log_id: str) -> dict:
    """
    Generate an explanation for a specific autonomous log entry.
    Used to answer "Why did Optimus do this?" on the activity feed.
    """
    sb = _get_supabase()

    try:
        log_res = sb.table("autonomous_logs").select("*").eq("id", log_id).single().execute()
        if not log_res.data:
            return {"error": "Log entry not found"}

        log = log_res.data
        action_type = log.get("action_type", "")
        reason = log.get("reason", "No reason recorded")
        prev_val = log.get("previous_value")
        new_val = log.get("new_value")
        tier = log.get("approval_tier", "unknown")
        campaign_id = log.get("campaign_id")
        keyword_id = log.get("keyword_id")

        result = {
            "action_type": action_type,
            "approval_tier": tier,
            "original_reason": reason,
            "explanation": "",
            "what_happened": "",
            "why": "",
            "what_next": "",
        }

        if "BID_UPDATE" in action_type:
            change_pct = abs((new_val - prev_val) / prev_val * 100) if prev_val and prev_val > 0 else 0
            direction = "increased" if new_val > prev_val else "decreased"
            result["what_happened"] = f"Optimus {direction} the bid from ${prev_val:.2f} to ${new_val:.2f} ({change_pct:.1f}% change)."
            result["why"] = reason
            result["what_next"] = (
                "Monitor this keyword's performance over the next 24-48 hours. "
                "If ACoS moves in the wrong direction, Optimus will detect and correct course automatically."
            )
            result["explanation"] = f"{result['what_happened']} {result['why']} {result['what_next']}"

        elif "NEGATIVE_KEYWORD" in action_type:
            result["what_happened"] = "Optimus added a negative keyword to stop spending on a wasteful search term."
            result["why"] = reason
            result["what_next"] = "The search term will no longer trigger ads. This saves budget for better-performing terms."
            result["explanation"] = f"{result['what_happened']} {result['why']} {result['what_next']}"

        elif "EXPERIMENT" in action_type:
            result["what_happened"] = "Optimus concluded an A/B test that reached statistical significance."
            result["why"] = reason
            result["what_next"] = "The winning strategy is now active. Monitor for the next week to confirm real-world results match the test."
            result["explanation"] = f"{result['what_happened']} {result['why']} {result['what_next']}"

        elif "ROLLOUT" in action_type:
            result["what_happened"] = "Optimus advanced a staged rollout to the next phase."
            result["why"] = reason
            result["what_next"] = "Performance will continue to be monitored. If metrics destabilize, the rollout will pause automatically."
            result["explanation"] = f"{result['what_happened']} {result['why']} {result['what_next']}"

        else:
            result["explanation"] = reason

        return result

    except Exception as e:
        logger.error(f"Failed to explain log {log_id}: {e}")
        return {"error": str(e)}


async def explain_pending_approval(approval_id: str) -> dict:
    """
    Generate a rich explanation for a pending approval item.
    Gives the human reviewer all context they need to decide.
    """
    sb = _get_supabase()

    try:
        res = sb.table("pending_approvals").select("*").eq("id", approval_id).single().execute()
        if not res.data:
            return {"error": "Approval not found"}

        item = res.data
        action_type = item.get("action_type", "")
        reasons = item.get("reasons", [])
        confidence = float(item.get("confidence", 0))
        current_val = float(item.get("current_value", 0))
        recommended_val = float(item.get("recommended_value", 0))
        keyword_id = item.get("keyword_id")
        campaign_id = item.get("campaign_id")

        if action_type == "bid_change" and keyword_id and campaign_id:
            return await explain_bid_recommendation(
                keyword_id=keyword_id,
                campaign_id=campaign_id,
                current_bid=current_val,
                recommended_bid=recommended_val,
                confidence=confidence,
            )
        elif action_type == "negative_keyword":
            metadata = item.get("metadata", {})
            return {
                "summary": f"Optimus wants to negate the search term '{metadata.get('search_term', 'unknown')}' "
                           f"as a {metadata.get('match_type', 'exact')} match negative keyword.",
                "factors": [{"factor": r, "detail": r, "impact": "medium"} for r in reasons],
                "risk_level": "low",
                "recommendation_action": f"Add '{metadata.get('search_term')}' as negative keyword",
            }
        else:
            return {
                "summary": f"Pending {action_type} action",
                "factors": [{"factor": r, "detail": r, "impact": "medium"} for r in reasons],
                "risk_level": "medium",
            }

    except Exception as e:
        logger.error(f"Failed to explain approval {approval_id}: {e}")
        return {"error": str(e)}
