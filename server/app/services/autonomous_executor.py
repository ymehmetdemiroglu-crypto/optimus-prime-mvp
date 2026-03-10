"""
Autonomous Executor — the brain of Optimus Pryme's autonomous operations.

This service runs as a scheduled job and autonomously:
1. Generates ensemble bid recommendations for all active campaigns
2. Evaluates each recommendation against the approval policy
3. Auto-applies tier-1 (AUTO_EXECUTE) changes silently
4. Auto-applies tier-2 (NOTIFY) changes and queues notifications
5. Queues tier-3 (HUMAN_REQUIRED) changes for the approval queue
6. Auto-concludes experiments that have reached statistical significance
7. Auto-advances healthy rollout stages
8. Auto-negates wasteful search terms

All actions are logged to `autonomous_logs` for full audit trail.
"""
import os
import logging
from datetime import datetime, timezone
from supabase import create_client, Client
from dotenv import load_dotenv
from app.services.approval_policy import (
    ApprovalPolicyEngine,
    PolicyConfig,
    ApprovalTier,
    ApprovalDecision,
)

load_dotenv()

logger = logging.getLogger("autonomous_executor")

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


# Shared policy engine instance
_policy = ApprovalPolicyEngine(PolicyConfig())


# ──────────────────────────────────────────────
# 1. Autonomous Bid Optimization
# ──────────────────────────────────────────────

async def run_autonomous_bid_optimization():
    """
    Main autonomous loop:
    For each active campaign with strategy != manual,
    generate ensemble recommendations and auto-apply based on policy.
    """
    logger.info("🤖 [AUTONOMOUS] Starting bid optimization cycle...")
    sb = _get_supabase()

    try:
        # Fetch campaigns with AI strategies enabled
        camp_res = sb.table("campaigns").select("id, name, strategy, daily_budget").eq("status", "active").neq("strategy", "manual").execute()
        campaigns = camp_res.data or []
        logger.info(f"  Found {len(campaigns)} AI-enabled campaigns")

        total_auto = 0
        total_notify = 0
        total_queued = 0

        for camp in campaigns:
            campaign_id = camp["id"]
            campaign_name = camp["name"]
            try:
                auto, notify, queued = await _process_campaign_bids(sb, campaign_id, campaign_name)
                total_auto += auto
                total_notify += notify
                total_queued += queued
            except Exception as e:
                logger.error(f"  ❌ Failed for campaign {campaign_name}: {e}")

        logger.info(
            f"🤖 [AUTONOMOUS] Bid optimization complete: "
            f"{total_auto} auto-applied, {total_notify} notified, {total_queued} queued for human"
        )
        return {"auto_applied": total_auto, "notified": total_notify, "queued": total_queued}

    except Exception as e:
        logger.error(f"🤖 [AUTONOMOUS] Bid optimization failed: {e}")
        return {"error": str(e)}


async def _process_campaign_bids(sb: Client, campaign_id: str, campaign_name: str) -> tuple[int, int, int]:
    """Process bid recommendations for a single campaign."""
    # Generate ensemble recommendations via RPC
    recs_res = sb.rpc("ensemble_recommendations", {"p_campaign_id": campaign_id}).execute()
    recs = recs_res.data or []

    if not recs:
        return 0, 0, 0

    # Fetch keyword health for context
    health_res = sb.rpc("campaign_keyword_health", {"p_campaign_id": campaign_id}).execute()
    health_map = {}
    for h in (health_res.data or []):
        health_map[h["keyword_id"]] = h.get("health_status", "good")

    auto_count = 0
    notify_count = 0
    queued_count = 0
    batch_id = _generate_batch_id()

    for rec in recs:
        current_bid = float(rec.get("current_bid", 0))
        recommended_bid = float(rec.get("recommended_bid", 0))

        # Skip if no change
        if abs(recommended_bid - current_bid) < 0.01:
            continue

        # Use the max of thompson confidence and a base confidence for ensemble
        confidence = float(rec.get("confidence", 0.75))
        keyword_id = rec["keyword_id"]
        health_status = health_map.get(keyword_id)

        decision = _policy.evaluate_bid_change(
            keyword_id=keyword_id,
            current_bid=current_bid,
            recommended_bid=recommended_bid,
            confidence=confidence,
            health_status=health_status,
        )

        if decision.tier == ApprovalTier.AUTO_EXECUTE:
            _apply_bid(sb, keyword_id, recommended_bid, current_bid, campaign_id, batch_id, "auto_execute")
            auto_count += 1
        elif decision.tier == ApprovalTier.NOTIFY:
            _apply_bid(sb, keyword_id, recommended_bid, current_bid, campaign_id, batch_id, "notify")
            notify_count += 1
        else:
            _queue_for_approval(sb, keyword_id, recommended_bid, current_bid, campaign_id, decision)
            queued_count += 1

    if auto_count + notify_count > 0:
        logger.info(
            f"  ✅ {campaign_name}: {auto_count} auto, {notify_count} notify, {queued_count} queued"
        )

    return auto_count, notify_count, queued_count


def _apply_bid(sb: Client, keyword_id: str, new_bid: float, old_bid: float, campaign_id: str, batch_id: str, tier: str):
    """Apply a bid change and log it."""
    try:
        # Apply via guardrails RPC for safety
        sb.rpc("apply_bid_with_guardrails", {
            "p_keyword_id": keyword_id,
            "p_new_bid": new_bid,
            "p_model": "ensemble",
            "p_batch_id": batch_id,
        }).execute()

        # Log to autonomous_logs
        sb.table("autonomous_logs").insert({
            "campaign_id": campaign_id,
            "keyword_id": keyword_id,
            "action_type": "BID_UPDATE_ENSEMBLE",
            "previous_value": old_bid,
            "new_value": new_bid,
            "reason": f"Auto-{tier}: confidence-based policy (change {abs(new_bid - old_bid) / old_bid * 100:.1f}%)",
            "approval_tier": tier,
            "batch_id": batch_id,
        }).execute()
    except Exception as e:
        logger.warning(f"    Failed to apply bid for {keyword_id[:8]}: {e}")


def _queue_for_approval(sb: Client, keyword_id: str, new_bid: float, old_bid: float, campaign_id: str, decision: ApprovalDecision):
    """Queue a recommendation for human approval."""
    try:
        sb.table("pending_approvals").insert({
            "campaign_id": campaign_id,
            "keyword_id": keyword_id,
            "action_type": "bid_change",
            "current_value": old_bid,
            "recommended_value": new_bid,
            "confidence": decision.confidence,
            "change_pct": decision.change_pct,
            "reasons": decision.reasons,
            "status": "pending",
        }).execute()
    except Exception as e:
        logger.warning(f"    Failed to queue approval for {keyword_id[:8]}: {e}")


# ──────────────────────────────────────────────
# 2. Auto-Conclude Experiments
# ──────────────────────────────────────────────

async def auto_conclude_experiments():
    """Check running experiments and auto-conclude those that reached significance."""
    logger.info("🧪 [AUTONOMOUS] Checking experiments for auto-conclusion...")
    sb = _get_supabase()

    try:
        # Fetch running experiments
        exp_res = sb.table("bid_experiments").select("*").eq("status", "running").execute()
        experiments = exp_res.data or []

        concluded = 0
        for exp in experiments:
            try:
                # Analyze experiment
                analysis_res = sb.rpc("analyze_experiment", {"p_experiment_id": exp["id"]}).execute()
                analysis = analysis_res.data
                if not analysis:
                    continue

                p_value = 1.0 - float(analysis.get("confidence", 0))
                min_sample = True  # TODO: check actual sample size vs minimum
                started_at = exp.get("started_at")
                min_duration_met = True
                if started_at:
                    started = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
                    days_running = (datetime.now(timezone.utc) - started).days
                    min_duration_met = days_running >= 7  # Minimum 7 days

                decision = _policy.evaluate_experiment_conclusion(
                    p_value=p_value,
                    min_sample_met=min_sample,
                    min_duration_met=min_duration_met,
                    auto_conclude_enabled=True,  # Could be stored per-experiment
                )

                if decision.tier == ApprovalTier.AUTO_EXECUTE:
                    # Stop the experiment and declare winner
                    sb.rpc("stop_experiment", {"p_experiment_id": exp["id"]}).execute()
                    winner = analysis.get("winner", "tie")
                    sb.table("bid_experiments").update({
                        "winner": analysis.get(f"model_{winner.lower()}", winner),
                        "confidence_level": float(analysis.get("confidence", 0)),
                    }).eq("id", exp["id"]).execute()

                    # Log
                    sb.table("autonomous_logs").insert({
                        "campaign_id": exp.get("campaign_id"),
                        "action_type": "EXPERIMENT_CONCLUDED",
                        "reason": f"Auto-concluded: {decision.reasons[0]}. Winner: {winner}",
                        "approval_tier": "auto_execute",
                    }).execute()

                    concluded += 1
                    logger.info(f"  🧪 Auto-concluded experiment '{exp.get('name')}' — Winner: {winner}")

            except Exception as e:
                logger.warning(f"  Failed to evaluate experiment {exp.get('name')}: {e}")

        logger.info(f"🧪 [AUTONOMOUS] Experiments checked: {concluded} auto-concluded out of {len(experiments)}")
        return concluded

    except Exception as e:
        logger.error(f"🧪 [AUTONOMOUS] Experiment check failed: {e}")
        return 0


# ──────────────────────────────────────────────
# 3. Auto-Negate Wasteful Keywords
# ──────────────────────────────────────────────

async def auto_negate_wasteful_keywords():
    """Discover wasteful search terms and auto-negate those that meet policy criteria."""
    logger.info("🗑️ [AUTONOMOUS] Running auto-negation check...")
    sb = _get_supabase()

    try:
        camp_res = sb.table("campaigns").select("id, name").eq("status", "active").execute()
        campaigns = camp_res.data or []
        total_negated = 0
        total_queued = 0

        for camp in campaigns:
            campaign_id = camp["id"]
            try:
                # Discover negative keyword candidates
                neg_res = sb.rpc("discover_negative_keywords", {
                    "p_campaign_id": campaign_id,
                    "p_min_spend": 5.0,
                    "p_min_clicks": 10,
                    "p_max_cvr": 0.01,
                }).execute()
                candidates = neg_res.data or []

                for candidate in candidates:
                    decision = _policy.evaluate_negative_keyword(
                        search_term=candidate.get("search_term", ""),
                        total_spend=float(candidate.get("total_spend", 0)),
                        total_clicks=int(candidate.get("total_clicks", 0)),
                        total_orders=int(candidate.get("total_orders", 0)),
                        match_type=candidate.get("suggested_match_type", "exact"),
                    )

                    if decision.tier == ApprovalTier.AUTO_EXECUTE:
                        # Apply the negation
                        sb.table("negative_keyword_suggestions").update({
                            "status": "applied",
                        }).eq("id", candidate["id"]).execute()

                        sb.table("autonomous_logs").insert({
                            "campaign_id": campaign_id,
                            "action_type": "NEGATIVE_KEYWORD_APPLIED",
                            "reason": f"Auto-negated '{candidate.get('search_term')}': {decision.reasons[0]}",
                            "approval_tier": "auto_execute",
                        }).execute()
                        total_negated += 1

                    elif decision.tier == ApprovalTier.HUMAN_REQUIRED:
                        # Queue for approval
                        sb.table("pending_approvals").insert({
                            "campaign_id": campaign_id,
                            "action_type": "negative_keyword",
                            "current_value": 0,
                            "recommended_value": 0,
                            "reasons": decision.reasons,
                            "metadata": {
                                "search_term": candidate.get("search_term"),
                                "match_type": candidate.get("suggested_match_type"),
                                "suggestion_id": candidate["id"],
                            },
                            "status": "pending",
                        }).execute()
                        total_queued += 1

            except Exception as e:
                logger.warning(f"  Auto-negate skipped for {camp['name']}: {e}")

        logger.info(f"🗑️ [AUTONOMOUS] Auto-negation complete: {total_negated} applied, {total_queued} queued")
        return {"negated": total_negated, "queued": total_queued}

    except Exception as e:
        logger.error(f"🗑️ [AUTONOMOUS] Auto-negation failed: {e}")
        return {"error": str(e)}


# ──────────────────────────────────────────────
# 4. Auto-Advance Rollouts
# ──────────────────────────────────────────────

async def auto_advance_rollouts():
    """Check active rollouts and auto-advance stages that are healthy."""
    logger.info("🚀 [AUTONOMOUS] Checking rollouts for auto-advancement...")
    sb = _get_supabase()

    try:
        # Fetch active rollouts
        rollout_res = sb.table("staged_rollouts").select("*").eq("status", "in_progress").execute()
        rollouts = rollout_res.data or []
        advanced = 0

        for rollout in rollouts:
            try:
                rollout_id = rollout["id"]
                campaign_id = rollout["campaign_id"]
                current_stage = rollout.get("current_stage", 1)
                total_stages = 4  # Standard 4-stage rollout

                # Get pre-rollout ACoS and current ACoS
                pre_acos = float(rollout.get("pre_acos", 0))

                # Get current campaign ACoS
                camp_res = sb.table("campaigns").select("acos").eq("id", campaign_id).single().execute()
                current_acos = float(camp_res.data.get("acos", 0)) if camp_res.data else 0

                acos_change_pct = ((current_acos - pre_acos) / pre_acos * 100) if pre_acos > 0 else 0

                decision = _policy.evaluate_rollout_advance(
                    current_stage=current_stage,
                    total_stages=total_stages,
                    acos_change_pct=acos_change_pct,
                    has_anomaly=False,  # TODO: check anomaly detection
                )

                if decision.tier == ApprovalTier.AUTO_EXECUTE:
                    advance_res = sb.rpc("advance_rollout_stage", {"p_rollout_id": rollout_id}).execute()
                    result = advance_res.data
                    if result and result.get("status") == "advanced":
                        sb.table("autonomous_logs").insert({
                            "campaign_id": campaign_id,
                            "action_type": "ROLLOUT_ADVANCED",
                            "reason": f"Auto-advanced to stage {result.get('stage_advanced_to')}: {decision.reasons[0]}",
                            "approval_tier": "auto_execute",
                        }).execute()
                        advanced += 1
                        logger.info(f"  🚀 Auto-advanced rollout {rollout_id[:8]} to stage {result.get('stage_advanced_to')}")
                else:
                    logger.info(f"  ⏸️ Rollout {rollout_id[:8]} needs human review: {decision.reasons}")

            except Exception as e:
                logger.warning(f"  Rollout check failed for {rollout.get('id', '')[:8]}: {e}")

        logger.info(f"🚀 [AUTONOMOUS] Rollout check complete: {advanced} auto-advanced out of {len(rollouts)}")
        return advanced

    except Exception as e:
        logger.error(f"🚀 [AUTONOMOUS] Rollout check failed: {e}")
        return 0


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _generate_batch_id() -> str:
    """Generate a unique batch ID for grouping autonomous actions."""
    import uuid
    return f"auto_{uuid.uuid4().hex[:12]}"
