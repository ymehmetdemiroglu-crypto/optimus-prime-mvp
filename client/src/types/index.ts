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
