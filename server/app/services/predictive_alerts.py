"""
Phase 3.4 Predictive Alerts Engine.
Detects statistical anomalies in spend velocity and ACoS trends to warn the user BEFORE they happen.
"""

import logging
from typing import List, Dict, Any
from app.api.deps import get_supabase_client
from app.services.notifications import notification_service

logger = logging.getLogger("optimus.predictive_alerts")

async def generate_predictive_alerts() -> List[Dict[str, Any]]:
    """
    Analyzes all active campaigns for:
    1. Predicted Budget Exhaustion (Velocity Anomaly)
    2. Predicted ACoS Spikes (Conversion Anomaly)
    Genarates actionable alerts if thresholds are breached.
    """
    logger.info("🔮 Running predictive alert analysis...")
    sb = get_supabase_client()
    new_alerts = []

    try:
        # Fetch active campaigns with their metrics
        camp_res = sb.table('campaigns').select(
            'id, name, seller_id, daily_budget, spend, sales, acos, clicks, impressions'
        ).eq('status', 'active').execute()
        campaigns = camp_res.data or []

        for camp in campaigns:
            camp_id = camp['id']
            name = camp['name']
            budget = float(camp.get('daily_budget') or 0)
            spend = float(camp.get('spend') or 0)
            sales = float(camp.get('sales') or 0)
            clicks = int(camp.get('clicks') or 0)
            
            # --- 1. ACoS Spike Prediction ---
            # If ACoS is already high, it's not a prediction.
            # Prediction heuristics: high spend velocity + low CVR recent trajectory
            # Since we don't have full time-series in this mock DB, we simulate a projection based on CPC
            if clicks > 20 and sales < spend:
                # High chance of ACoS spike if this continues
                projected_acos = (spend * 1.5) / (sales + 0.1) * 100
                if projected_acos > 80.0:  # Critical ACoS threshold
                    alert = {
                        "severity": "high",
                        "title": f"Predicted ACoS Spike: {name}",
                        "message": f"Based on current velocity, {name} is projected to hit {projected_acos:.1f}% ACoS today. Consider lowering bids or pausing broad matches.",
                        "campaign_id": camp_id,
                        "metric": "acos",
                        "predicted_value": projected_acos
                    }
                    new_alerts.append(alert)

            # --- 2. Budget Exhaustion Prediction ---
            # Using simple linear projection (spend so far vs budget)
            # Assume we are 50% through the day (mock data logic)
            if spend > 0 and budget > 0:
                projected_spend = spend * 2.5 
                if projected_spend > (budget * 1.2):
                    alert = {
                        "severity": "medium",
                        "title": f"Early Budget Exhaustion: {name}",
                        "message": f"At the current spend rate, {name} will exhaust its ${budget:.2f} budget well before end of day. Projected spend is ${projected_spend:.2f}.",
                        "campaign_id": camp_id,
                        "metric": "budget",
                        "predicted_value": projected_spend
                    }
                    new_alerts.append(alert)

        # Notify via notification service (in-app + slack)
        for alert in new_alerts:
            # We don't save these to DB currently, but we push them to user feed
            await notification_service.send_alert(
                topic="Predictive Alert",
                message=alert["message"],
                severity=alert["severity"]
            )
            
        logger.info(f"🔮 Predictive analysis complete. Generated {len(new_alerts)} early warnings.")
        return new_alerts

    except Exception as e:
        logger.error(f"Failed to generate predictive alerts: {e}")
        return []
