"""
Scheduled background jobs for NexOptimus Prime.
These run automatically via APScheduler to keep optimization data fresh.
"""
import os
import asyncio
import logging
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("jobs")

# Shared Supabase client for background tasks
_supabase: Client | None = None


def _get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        _supabase = create_client(
            os.getenv("SUPABASE_URL", ""),
            os.getenv("SUPABASE_KEY", "")
        )
        try:
            _supabase.auth.sign_in_with_password({
                "email": os.getenv("SERVICE_EMAIL", ""),
                "password": os.getenv("SERVICE_PASSWORD", "")
            })
        except Exception:
            pass
    return _supabase


async def run_daily_optimization_models():
    """
    Nightly job: Generate fresh bid recommendations for every active campaign
    using Thompson Sampling, Q-Learning, and Ensemble models.
    """
    logger.info("🔄 [JOB] Starting daily optimization model run...")
    sb = _get_supabase()

    try:
        # Fetch all active campaigns
        camp_res = sb.table('campaigns').select('id, seller_id').eq('status', 'active').execute()
        campaigns = camp_res.data or []
        logger.info(f"  Found {len(campaigns)} active campaigns")

        for camp in campaigns:
            campaign_id = camp['id']
            try:
                # Run Thompson Sampling
                sb.rpc('generate_thompson_recommendations', {
                    'p_campaign_id': campaign_id, 'p_limit': 50
                }).execute()

                # Run Q-Learning
                sb.rpc('generate_qlearning_recommendations', {
                    'p_campaign_id': campaign_id, 'p_limit': 50
                }).execute()

                # Run Ensemble (blends Thompson + Q-Learning)
                sb.rpc('generate_ensemble_recommendations', {
                    'p_campaign_id': campaign_id, 'p_limit': 50
                }).execute()

                logger.info(f"  ✅ Recommendations generated for campaign {campaign_id[:8]}...")
            except Exception as e:
                logger.error(f"  ❌ Failed for campaign {campaign_id[:8]}: {e}")

        logger.info("🔄 [JOB] Daily optimization model run complete.")
    except Exception as e:
        logger.error(f"🔄 [JOB] Daily optimization failed: {e}")


async def compute_keyword_health_scores():
    """
    Nightly job: Compute keyword health scores for all keywords across all campaigns.
    """
    logger.info("🩺 [JOB] Starting keyword health scoring...")
    sb = _get_supabase()

    try:
        camp_res = sb.table('campaigns').select('id').eq('status', 'active').execute()
        campaigns = camp_res.data or []

        for camp in campaigns:
            try:
                sb.rpc('compute_keyword_health', {
                    'p_campaign_id': camp['id']
                }).execute()
            except Exception as e:
                logger.warning(f"  Health scoring skipped for {camp['id'][:8]}: {e}")

        logger.info(f"🩺 [JOB] Keyword health scoring complete for {len(campaigns)} campaigns.")
    except Exception as e:
        logger.error(f"🩺 [JOB] Health scoring failed: {e}")


async def discover_negative_keywords():
    """
    Nightly job: Discover wasteful search terms that should be negated.
    """
    logger.info("🗑️ [JOB] Starting negative keyword discovery...")
    sb = _get_supabase()

    try:
        camp_res = sb.table('campaigns').select('id').eq('status', 'active').execute()
        campaigns = camp_res.data or []

        total_found = 0
        for camp in campaigns:
            try:
                res = sb.rpc('discover_negative_keywords', {
                    'p_campaign_id': camp['id'],
                    'p_min_spend': 5.0,
                    'p_min_clicks': 10,
                    'p_max_cvr': 0.01
                }).execute()
                total_found += len(res.data or [])
            except Exception as e:
                logger.warning(f"  Discovery skipped for {camp['id'][:8]}: {e}")

        logger.info(f"🗑️ [JOB] Negative keyword discovery complete. Found {total_found} candidates.")
    except Exception as e:
        logger.error(f"🗑️ [JOB] Negative keyword discovery failed: {e}")


async def compute_budget_pacing():
    """
    Run multiple times per day: Calculate budget pacing for all active campaigns.
    """
    logger.info("📊 [JOB] Computing budget pacing...")
    sb = _get_supabase()

    try:
        camp_res = sb.table('campaigns').select('id').eq('status', 'active').execute()
        campaigns = camp_res.data or []

        for camp in campaigns:
            try:
                sb.rpc('compute_spend_pacing', {
                    'p_campaign_id': camp['id']
                }).execute()
            except Exception as e:
                logger.warning(f"  Pacing skipped for {camp['id'][:8]}: {e}")

        logger.info(f"📊 [JOB] Budget pacing complete for {len(campaigns)} campaigns.")
    except Exception as e:
        logger.error(f"📊 [JOB] Budget pacing failed: {e}")
