"""
Tiered Auto-Approval Policy Engine for Optimus Pryme.

Evaluates each optimization recommendation against configurable thresholds
to determine if it can be auto-executed, needs notification, or requires
human approval.

Tiers:
  1. AUTO_EXECUTE  — confidence >= 0.85, change <= 20%, no anomalies → apply silently
  2. NOTIFY        — confidence 0.70-0.85, change <= 30% → apply and send digest
  3. HUMAN_REQUIRED — everything else → queue for human review
"""
import logging
from enum import Enum
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger("approval_policy")


class ApprovalTier(str, Enum):
    AUTO_EXECUTE = "auto_execute"
    NOTIFY = "notify"
    HUMAN_REQUIRED = "human_required"


@dataclass
class PolicyConfig:
    """Configurable thresholds for the approval policy."""
    # Auto-execute thresholds
    auto_min_confidence: float = 0.85
    auto_max_change_pct: float = 20.0
    # Notify thresholds
    notify_min_confidence: float = 0.70
    notify_max_change_pct: float = 30.0
    # Budget thresholds
    max_auto_budget_increase: float = 25.0  # USD per day
    max_notify_budget_increase: float = 50.0
    # Negative keyword policy
    auto_negate_min_spend: float = 20.0
    auto_negate_min_clicks: int = 50
    auto_negate_max_orders: int = 0
    auto_negate_exact_only: bool = True  # Only auto-negate exact match
    # Rollout policy
    auto_advance_non_final: bool = True
    auto_advance_final: bool = False  # Final stage always needs human


@dataclass
class ApprovalDecision:
    """Result of evaluating a recommendation against the policy."""
    tier: ApprovalTier
    reasons: list[str] = field(default_factory=list)
    keyword_id: str = ""
    recommended_bid: float = 0.0
    current_bid: float = 0.0
    confidence: float = 0.0
    change_pct: float = 0.0
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())


class ApprovalPolicyEngine:
    """Evaluates bid recommendations against the tiered approval policy."""

    def __init__(self, config: PolicyConfig | None = None):
        self.config = config or PolicyConfig()

    def evaluate_bid_change(
        self,
        keyword_id: str,
        current_bid: float,
        recommended_bid: float,
        confidence: float,
        health_status: str | None = None,
        has_active_anomaly: bool = False,
    ) -> ApprovalDecision:
        """Evaluate a single bid change recommendation."""
        if current_bid <= 0:
            return ApprovalDecision(
                tier=ApprovalTier.HUMAN_REQUIRED,
                reasons=["Current bid is zero or negative"],
                keyword_id=keyword_id,
                recommended_bid=recommended_bid,
                current_bid=current_bid,
                confidence=confidence,
            )

        change_pct = abs((recommended_bid - current_bid) / current_bid) * 100
        reasons: list[str] = []

        # Always escalate if there's an active anomaly
        if has_active_anomaly:
            reasons.append("Active anomaly detected on this keyword/campaign")
            return ApprovalDecision(
                tier=ApprovalTier.HUMAN_REQUIRED,
                reasons=reasons,
                keyword_id=keyword_id,
                recommended_bid=recommended_bid,
                current_bid=current_bid,
                confidence=confidence,
                change_pct=change_pct,
            )

        # Always escalate critical health keywords
        if health_status == "critical":
            reasons.append("Keyword health is critical")
            return ApprovalDecision(
                tier=ApprovalTier.HUMAN_REQUIRED,
                reasons=reasons,
                keyword_id=keyword_id,
                recommended_bid=recommended_bid,
                current_bid=current_bid,
                confidence=confidence,
                change_pct=change_pct,
            )

        # Tier 1: Auto-execute
        if (
            confidence >= self.config.auto_min_confidence
            and change_pct <= self.config.auto_max_change_pct
        ):
            reasons.append(
                f"High confidence ({confidence:.2f}) and small change ({change_pct:.1f}%)"
            )
            return ApprovalDecision(
                tier=ApprovalTier.AUTO_EXECUTE,
                reasons=reasons,
                keyword_id=keyword_id,
                recommended_bid=recommended_bid,
                current_bid=current_bid,
                confidence=confidence,
                change_pct=change_pct,
            )

        # Tier 2: Notify
        if (
            confidence >= self.config.notify_min_confidence
            and change_pct <= self.config.notify_max_change_pct
        ):
            reasons.append(
                f"Moderate confidence ({confidence:.2f}) and moderate change ({change_pct:.1f}%)"
            )
            return ApprovalDecision(
                tier=ApprovalTier.NOTIFY,
                reasons=reasons,
                keyword_id=keyword_id,
                recommended_bid=recommended_bid,
                current_bid=current_bid,
                confidence=confidence,
                change_pct=change_pct,
            )

        # Tier 3: Human required
        if confidence < self.config.notify_min_confidence:
            reasons.append(f"Low confidence ({confidence:.2f})")
        if change_pct > self.config.notify_max_change_pct:
            reasons.append(f"Large change ({change_pct:.1f}%)")
        return ApprovalDecision(
            tier=ApprovalTier.HUMAN_REQUIRED,
            reasons=reasons,
            keyword_id=keyword_id,
            recommended_bid=recommended_bid,
            current_bid=current_bid,
            confidence=confidence,
            change_pct=change_pct,
        )

    def evaluate_budget_change(
        self,
        campaign_id: str,
        current_budget: float,
        recommended_budget: float,
        confidence: float = 0.80,
    ) -> ApprovalDecision:
        """Evaluate a budget reallocation recommendation."""
        increase = recommended_budget - current_budget
        change_pct = abs(increase / current_budget) * 100 if current_budget > 0 else 100

        if increase <= self.config.max_auto_budget_increase and confidence >= self.config.auto_min_confidence:
            return ApprovalDecision(
                tier=ApprovalTier.AUTO_EXECUTE,
                reasons=[f"Budget increase ${increase:.2f}/day within auto threshold"],
                keyword_id=campaign_id,
                recommended_bid=recommended_budget,
                current_bid=current_budget,
                confidence=confidence,
                change_pct=change_pct,
            )
        elif increase <= self.config.max_notify_budget_increase:
            return ApprovalDecision(
                tier=ApprovalTier.NOTIFY,
                reasons=[f"Budget increase ${increase:.2f}/day within notify threshold"],
                keyword_id=campaign_id,
                recommended_bid=recommended_budget,
                current_bid=current_budget,
                confidence=confidence,
                change_pct=change_pct,
            )
        else:
            return ApprovalDecision(
                tier=ApprovalTier.HUMAN_REQUIRED,
                reasons=[f"Budget increase ${increase:.2f}/day exceeds all thresholds"],
                keyword_id=campaign_id,
                recommended_bid=recommended_budget,
                current_bid=current_budget,
                confidence=confidence,
                change_pct=change_pct,
            )

    def evaluate_negative_keyword(
        self,
        search_term: str,
        total_spend: float,
        total_clicks: int,
        total_orders: int,
        match_type: str,
    ) -> ApprovalDecision:
        """Evaluate whether a negative keyword can be auto-applied."""
        reasons: list[str] = []

        # Only auto-negate exact match unless configured otherwise
        if self.config.auto_negate_exact_only and match_type != "exact":
            reasons.append(f"Broad/phrase negatives require human approval (match_type={match_type})")
            return ApprovalDecision(
                tier=ApprovalTier.HUMAN_REQUIRED,
                reasons=reasons,
                keyword_id=search_term,
            )

        # Any sales history → human review
        if total_orders > self.config.auto_negate_max_orders:
            reasons.append(f"Has {total_orders} orders — cannot auto-negate keywords with sales history")
            return ApprovalDecision(
                tier=ApprovalTier.HUMAN_REQUIRED,
                reasons=reasons,
                keyword_id=search_term,
            )

        # Must meet spend + click thresholds
        if (
            total_spend >= self.config.auto_negate_min_spend
            and total_clicks >= self.config.auto_negate_min_clicks
        ):
            reasons.append(
                f"Wasteful: ${total_spend:.2f} spend, {total_clicks} clicks, {total_orders} orders"
            )
            return ApprovalDecision(
                tier=ApprovalTier.AUTO_EXECUTE,
                reasons=reasons,
                keyword_id=search_term,
            )

        reasons.append("Below auto-negate thresholds — notify for review")
        return ApprovalDecision(
            tier=ApprovalTier.NOTIFY,
            reasons=reasons,
            keyword_id=search_term,
        )

    def evaluate_rollout_advance(
        self,
        current_stage: int,
        total_stages: int,
        acos_change_pct: float,
        has_anomaly: bool,
    ) -> ApprovalDecision:
        """Evaluate whether a rollout stage can be auto-advanced."""
        is_final = current_stage >= total_stages

        if has_anomaly:
            return ApprovalDecision(
                tier=ApprovalTier.HUMAN_REQUIRED,
                reasons=["Anomaly detected during rollout — pausing for human review"],
            )

        if acos_change_pct > 15:
            return ApprovalDecision(
                tier=ApprovalTier.HUMAN_REQUIRED,
                reasons=[f"ACoS increased {acos_change_pct:.1f}% since rollout started"],
            )

        if is_final and not self.config.auto_advance_final:
            return ApprovalDecision(
                tier=ApprovalTier.HUMAN_REQUIRED,
                reasons=["Final rollout stage requires human approval"],
            )

        return ApprovalDecision(
            tier=ApprovalTier.AUTO_EXECUTE,
            reasons=[f"Stage {current_stage}/{total_stages} metrics healthy, auto-advancing"],
        )

    def evaluate_experiment_conclusion(
        self,
        p_value: float,
        min_sample_met: bool,
        min_duration_met: bool,
        auto_conclude_enabled: bool,
        involves_strategy_change: bool = False,
    ) -> ApprovalDecision:
        """Evaluate whether an A/B experiment can be auto-concluded."""
        if not auto_conclude_enabled:
            return ApprovalDecision(
                tier=ApprovalTier.HUMAN_REQUIRED,
                reasons=["Auto-conclude is disabled for this experiment"],
            )

        if involves_strategy_change:
            return ApprovalDecision(
                tier=ApprovalTier.HUMAN_REQUIRED,
                reasons=["Experiment involves strategy change — requires human approval"],
            )

        if not min_sample_met:
            return ApprovalDecision(
                tier=ApprovalTier.HUMAN_REQUIRED,
                reasons=["Minimum sample size not yet reached"],
            )

        if not min_duration_met:
            return ApprovalDecision(
                tier=ApprovalTier.HUMAN_REQUIRED,
                reasons=["Minimum experiment duration not yet reached"],
            )

        if p_value < 0.05:
            return ApprovalDecision(
                tier=ApprovalTier.AUTO_EXECUTE,
                reasons=[f"Statistically significant (p={p_value:.4f}), all criteria met"],
            )

        return ApprovalDecision(
            tier=ApprovalTier.NOTIFY,
            reasons=[f"Not yet significant (p={p_value:.4f})"],
        )
