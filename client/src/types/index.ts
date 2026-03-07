export interface Seller {
    id: string;
    user_id: string;
    name: string;
    marketplace: 'US' | 'UK' | 'DE';
    currency: string;
}

export interface DashboardMetrics {
    acos: number;
    roas: number;
    ctr: number;
    cvr: number;
    total_sales: number;
    total_spend: number;
    impressions: number;
    clicks: number;
}

export interface SalesDataPoint {
    date: string;
    sales: number;
    orders: number;
}

export interface AIAction {
    id: string;
    timestamp: string;
    action: string;
    impact: string;
    status: 'success' | 'pending' | 'failed';
}

export interface DashboardData {
    metrics: DashboardMetrics;
    sales_data: SalesDataPoint[];
    ai_actions: AIAction[];
}

export type StrategyType = 'auto_pilot' | 'aggressive' | 'profit_guard';
export type CampaignStatus = 'active' | 'paused' | 'archived';

export interface Campaign {
    id: string;
    name: string;
    status: CampaignStatus;
    strategy: StrategyType;
    budget: number;       // maps to daily_budget in DB
    spend: number;
    sales: number;
    acos: number;
    impressions: number;
    clicks: number;
    orders: number;
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

export interface ChatResponse {
    response: string;
    timestamp: string;
    suggestions?: string[];
}

export type MatchType = 'exact' | 'phrase' | 'broad';
export type KeywordStatus = 'active' | 'paused' | 'archived' | 'negative';

export interface Keyword {
    id: string;
    campaign_id: string;
    keyword_text: string;
    match_type: MatchType;
    bid: number;
    status: KeywordStatus;
    impressions: number;
    clicks: number;
    spend: number;
    sales: number;
    orders: number;
    acos: number;
}

export interface KeywordFeatures {
    keyword_id: string;
    ctr_7d: number;
    cvr_7d: number;
    acos_7d: number;
    roas_7d: number;
    ctr_trend: number;
    sales_trend: number;
    spend_trend: number;
}

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertRuleType = 'acos_threshold' | 'spend_spike' | 'no_sales' | 'ctr_drop' | 'budget_depletion';

export interface AlertRule {
    id: string;
    seller_id: string;
    rule_type: AlertRuleType;
    name: string;
    description: string;
    severity: AlertSeverity;
    config: Record<string, number>;
    is_enabled: boolean;
    cooldown_minutes: number;
    last_triggered_at: string | null;
    created_at: string;
}

export interface Alert {
    id: string;
    rule_id: string;
    seller_id: string;
    campaign_id: string | null;
    keyword_id: string | null;
    severity: AlertSeverity;
    title: string;
    message: string;
    metric_value: number;
    threshold_value: number;
    is_read: boolean;
    is_dismissed: boolean;
    created_at: string;
}

// ─── Semantic Optimization (Cosmo & Rufus) ───

export interface SearchTerm {
    id: string;
    seller_id: string;
    campaign_id: string;
    query_text: string;
    impressions: number;
    clicks: number;
    spend: number;
    sales: number;
    orders: number;
    acos: number;
    ctr: number;
    cvr: number;
    report_date: string | null;
    created_at: string;
}

export interface SemanticCluster {
    id: string;
    seller_id: string;
    campaign_id: string;
    cluster_label: string;
    description: string | null;
    term_count: number;
    total_impressions: number;
    total_clicks: number;
    total_spend: number;
    total_sales: number;
    avg_acos: number;
    avg_ctr: number;
    avg_cvr: number;
    cosmo_relevance_score: number;
    rufus_intent_score: number;
    status: 'active' | 'archived' | 'applied';
    created_at: string;
    terms?: ClusterTerm[];
}

export interface ClusterTerm {
    id: string;
    cluster_id: string;
    search_term_id: string;
    similarity_score: number;
    search_term?: SearchTerm;
}

export interface ListingSuggestion {
    id: string;
    seller_id: string;
    campaign_id: string;
    cluster_id: string | null;
    suggested_title: string | null;
    suggested_bullets: string[];
    suggested_backend_terms: string | null;
    aplus_keywords: string[];
    cosmo_score: number;
    rufus_score: number;
    compliance_status: 'pending' | 'pass' | 'warning' | 'fail';
    compliance_issues: ComplianceIssue[];
    title_char_count: number;
    status: 'draft' | 'approved' | 'deployed' | 'rejected';
    created_at: string;
    cluster?: SemanticCluster;
}

export interface ComplianceIssue {
    field: string;
    issue: string;
    severity: 'warning' | 'error';
}

export interface CampaignExpansion {
    id: string;
    seller_id: string;
    campaign_id: string;
    cluster_id: string | null;
    proposed_campaign_name: string;
    match_type: 'exact' | 'broad';
    keywords: string[];
    suggested_daily_budget: number;
    suggested_bid: number;
    estimated_daily_impressions: number;
    estimated_daily_clicks: number;
    estimated_daily_spend: number;
    status: 'proposed' | 'approved' | 'launched' | 'rejected';
    created_at: string;
    cluster?: SemanticCluster;
}

// ─── Bid Optimization Upgrades ───

export type HealthStatus = 'excellent' | 'good' | 'at_risk' | 'declining' | 'critical';

export interface KeywordHealth {
    keyword_id: string;
    health_score: number;
    health_status: HealthStatus;
    performance_score: number;
    trend_score: number;
    efficiency_score: number;
    engagement_score: number;
    risk_factors: string[];
}

export interface GuardrailResult {
    keyword_id: string;
    previous_bid: number;
    applied_bid: number;
    requested_bid: number;
    was_clipped: boolean;
}

export interface BatchHistory {
    batch_id: string;
    model_used: string;
    keyword_count: number;
    total_clipped: number;
    applied_at: string;
    is_rolled_back: boolean;
    avg_change_percent: number;
}

export interface ProjectedSpend {
    current_daily_spend: number;
    projected_daily_spend: number;
    spend_change: number;
    spend_change_percent: number;
}

export interface ModelLeaderboardEntry {
    model_type: string;
    total_predictions: number;
    evaluated_predictions: number;
    hit_rate: number;
    avg_improvement: number;
    avg_acos_change: number;
    best_streak: number;
}

export interface NegativeKeywordSuggestion {
    id: string;
    search_term: string;
    total_spend: number;
    total_clicks: number;
    total_orders: number;
    estimated_savings_30d: number;
    suggested_match_type: 'exact' | 'phrase';
    reason: string;
    status?: 'pending' | 'applied' | 'dismissed';
}

export interface DaypartingHour {
    hour: number;
    bid_multiplier: number;
    avg_cvr: number;
    avg_roas: number;
    total_orders: number;
    confidence: number;
}

export interface DaypartingSchedule {
    id: string;
    campaign_id: string;
    hour: number;
    bid_multiplier: number;
    is_enabled: boolean;
}

export interface SpendPacing {
    campaign_id: string;
    campaign_name: string;
    daily_budget: number;
    spent_today: number;
    hours_elapsed: number;
    projected_eod_spend: number;
    pace_percentage: number;
    pacing_status: 'on_track' | 'overspending' | 'underspending';
}

export interface RolloutStatus {
    active: boolean;
    rollout_id?: string;
    status?: string;
    current_stage?: number;
    total_keywords?: number;
    model_type?: string;
    pre_acos?: number;
    stages?: { stage: number; keyword_count: number; applied: number }[];
    created_at?: string;
}

export interface BidExperiment {
    id: string;
    campaign_id: string;
    name: string;
    model_a: string;
    model_b: string;
    split_percent: number;
    status: 'draft' | 'running' | 'completed' | 'cancelled';
    started_at: string | null;
    ended_at: string | null;
    winner: string | null;
    confidence_level: number | null;
    created_at: string;
}

export interface ExperimentAnalysis {
    group_a: ExperimentGroupMetrics;
    group_b: ExperimentGroupMetrics;
    winner: 'A' | 'B' | 'tie';
    confidence: number;
    model_a: string;
    model_b: string;
}

export interface ExperimentGroupMetrics {
    impressions: number;
    clicks: number;
    spend: number;
    sales: number;
    orders: number;
    acos: number;
    ctr: number;
    cvr: number;
    roas: number;
}

export interface CompetitorBidEstimate {
    keyword_id: string;
    keyword_text: string;
    current_bid: number;
    estimated_competitor_low: number;
    estimated_competitor_mid: number;
    estimated_competitor_high: number;
    competition_level: 'low' | 'medium' | 'high';
}

export interface AuctionSimulation {
    keyword_id: string;
    test_bid: number;
    simulations: number;
    estimated_win_rate: number;
    estimated_avg_position: number;
    estimated_avg_cpc: number;
}

export interface PortfolioBudgetAllocation {
    campaign_id: string;
    campaign_name: string;
    current_budget: number;
    recommended_budget: number;
    budget_change: number;
    current_roas: number;
    marginal_roas: number;
    expected_roas: number;
}

export interface BudgetSimulation {
    current_total_budget: number;
    new_total_budget: number;
    additional_budget: number;
    allocations: PortfolioBudgetAllocation[];
}
