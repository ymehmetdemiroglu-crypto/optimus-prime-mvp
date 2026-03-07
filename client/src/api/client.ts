import { supabase } from '../lib/supabase';
import type {
    DashboardData, DashboardMetrics, SalesDataPoint, AIAction, Campaign, StrategyType, ChatResponse, Keyword, Alert, AlertRule, SearchTerm, SemanticCluster, ListingSuggestion, CampaignExpansion, ComplianceIssue,
    GuardrailResult, BatchHistory, ProjectedSpend, ModelLeaderboardEntry, NegativeKeywordSuggestion, DaypartingHour, DaypartingSchedule, SpendPacing, RolloutStatus, BidExperiment, ExperimentAnalysis, CompetitorBidEstimate, AuctionSimulation, PortfolioBudgetAllocation, BudgetSimulation, KeywordHealth, HealthStatus
} from '../types';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8001';

/**
 * Shared helper: apply a list of bid recommendations to the keywords table.
 * Returns the count of successfully applied updates.
 */
async function applyBidRecommendations(
    recommendations: { keyword_id: string; recommended_bid: number; current_bid: number }[]
): Promise<number> {
    let applied = 0;
    for (const rec of recommendations) {
        if (rec.recommended_bid !== rec.current_bid) {
            const { error } = await supabase
                .from('keywords')
                .update({ bid: rec.recommended_bid, updated_at: new Date().toISOString() })
                .eq('id', rec.keyword_id);
            if (!error) applied++;
        }
    }
    return applied;
}

/**
 * Get the current Supabase session token and return headers
 * suitable for authenticated fetch() calls to the Python FastAPI backend.
 */
async function getAuthHeaders(contentType?: string): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {};
    if (contentType) headers['Content-Type'] = contentType;
    if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
}

export const dashboardApi = {
    getDashboard: async (): Promise<DashboardData> => {
        const { data: campaigns, error: campError } = await supabase
            .from('campaigns')
            .select('*');

        if (campError) throw campError;

        const allCampaigns = campaigns || [];

        const totalSales = allCampaigns.reduce((sum, c) => sum + Number(c.sales), 0);
        const totalSpend = allCampaigns.reduce((sum, c) => sum + Number(c.spend), 0);
        const totalImpressions = allCampaigns.reduce((sum, c) => sum + c.impressions, 0);
        const totalClicks = allCampaigns.reduce((sum, c) => sum + c.clicks, 0);
        const totalOrders = allCampaigns.reduce((sum, c) => sum + c.orders, 0);

        const metrics: DashboardMetrics = {
            acos: totalSales > 0 ? Number(((totalSpend / totalSales) * 100).toFixed(2)) : 0,
            roas: totalSpend > 0 ? Number((totalSales / totalSpend).toFixed(2)) : 0,
            ctr: totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0,
            cvr: totalClicks > 0 ? Number(((totalOrders / totalClicks) * 100).toFixed(2)) : 0,
            total_sales: totalSales,
            total_spend: totalSpend,
            impressions: totalImpressions,
            clicks: totalClicks,
        };

        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
        const { data: perfData } = await supabase
            .from('performance_metrics')
            .select('recorded_at, ad_sales, organic_sales')
            .gte('recorded_at', thirtyDaysAgo)
            .order('recorded_at');

        const salesByDate = new Map<string, { sales: number; count: number }>();
        for (const row of perfData || []) {
            const date = new Date(row.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const existing = salesByDate.get(date) || { sales: 0, count: 0 };
            existing.sales += Number(row.ad_sales) + Number(row.organic_sales);
            existing.count += 1;
            salesByDate.set(date, existing);
        }

        const sales_data: SalesDataPoint[] = Array.from(salesByDate.entries()).map(([date, { sales, count }]) => ({
            date,
            sales: Number(sales.toFixed(2)),
            orders: count,
        }));

        const { data: actionsData } = await supabase
            .from('ai_actions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

        const ai_actions: AIAction[] = (actionsData || []).map(a => ({
            id: a.id,
            timestamp: a.created_at || new Date().toISOString(),
            action: a.action,
            impact: a.impact,
            status: a.status as AIAction['status'],
        }));

        return { metrics, sales_data, ai_actions };
    },
};

export const campaignApi = {
    getCampaigns: async (): Promise<Campaign[]> => {
        const { data, error } = await supabase
            .from('campaigns')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(mapCampaignRow);
    },

    getCampaign: async (id: string): Promise<Campaign> => {
        const { data, error } = await supabase
            .from('campaigns')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return mapCampaignRow(data);
    },

    updateStrategy: async (id: string, strategy: StrategyType): Promise<Campaign> => {
        const { data, error } = await supabase
            .from('campaigns')
            .update({ strategy, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return mapCampaignRow(data);
    },
};

export const chatApi = {
    sendMessage: async (message: string, history: { role: string, content: string }[] = []): Promise<ChatResponse> => {
        const headers = await getAuthHeaders('application/json');
        const response = await fetch(`${API_BASE}/api/v1/chat`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ message, history })
        });
        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Failed to send chat message: ${err}`);
        }
        const data = await response.json();
        return data as ChatResponse;
    },
};

export interface AutonomousLog {
    id: string;
    action_type: string;
    previous_value: number | null;
    new_value: number | null;
    reason: string;
    created_at: string;
    keyword?: { keyword_text: string };
    campaign?: { name: string };
}

export const autonomousApi = {
    getLogs: async (limit: number = 20): Promise<AutonomousLog[]> => {
        const { data, error } = await supabase
            .from('autonomous_logs')
            .select('*, keyword:keywords(keyword_text), campaign:campaigns(name)')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return (data || []) as any;
    },
    runOperator: async (): Promise<number> => {
        const sellerRes = await supabase.rpc('get_my_seller_id');
        if (sellerRes.error || !sellerRes.data) throw new Error('No seller found');

        const { data, error } = await supabase.rpc('run_autonomous_operator', {
            p_seller_id: sellerRes.data
        });

        if (error) throw error;
        return data as number;
    }
};

export const keywordApi = {
    getKeywords: async (campaignId: string): Promise<Keyword[]> => {
        const { data, error } = await supabase
            .from('keywords')
            .select('*')
            .eq('campaign_id', campaignId)
            .order('spend', { ascending: false });

        if (error) throw error;
        return (data || []).map(mapKeywordRow);
    },

    updateKeyword: async (id: string, updates: Partial<Pick<Keyword, 'bid' | 'status'>>): Promise<Keyword> => {
        const { data, error } = await supabase
            .from('keywords')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return mapKeywordRow(data);
    },

    createKeyword: async (campaignId: string, sellerId: string, keyword: { keyword_text: string; match_type: string; bid: number }): Promise<Keyword> => {
        const { data, error } = await supabase
            .from('keywords')
            .insert({
                campaign_id: campaignId,
                seller_id: sellerId,
                keyword_text: keyword.keyword_text,
                match_type: keyword.match_type,
                bid: keyword.bid,
            })
            .select()
            .single();

        if (error) throw error;
        return mapKeywordRow(data);
    },

    deleteKeyword: async (id: string): Promise<void> => {
        const { error } = await supabase
            .from('keywords')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },
};

// ─── Bid Recommendation Types ───

export interface BidRecommendation {
    keyword_id: string;
    keyword_text: string;
    current_bid: number;
    recommended_bid: number;
    multiplier: number;
    confidence: number;
    health_score?: number;
    health_status?: HealthStatus;
}

export const thompsonApi = {
    getCampaignRecommendations: async (campaignId: string): Promise<BidRecommendation[]> => {
        const { data, error } = await supabase.rpc('thompson_campaign_recommendations', {
            p_campaign_id: campaignId,
        });

        if (error) throw error;
        const recs = (data || []).map((r: any) => ({
            keyword_id: r.keyword_id,
            keyword_text: r.keyword_text,
            current_bid: Number(r.current_bid),
            recommended_bid: Number(r.recommended_bid),
            multiplier: Number(r.multiplier),
            confidence: Number(r.confidence),
        }));

        return enrichWithHealth(recs, campaignId);
    },

    applyRecommendation: async (keywordId: string, newBid: number): Promise<void> => {
        const { error } = await supabase
            .from('keywords')
            .update({ bid: newBid, updated_at: new Date().toISOString() })
            .eq('id', keywordId);

        if (error) throw error;
    },

    applyAll: (recommendations: BidRecommendation[]): Promise<number> =>
        applyBidRecommendations(recommendations),
};

export interface QLearningRecommendation {
    keyword_id: string;
    keyword_text: string;
    current_bid: number;
    recommended_bid: number;
    multiplier: number;
    q_value: number;
    state_bucket: string;
    is_explore: boolean;
    health_score?: number;
    health_status?: HealthStatus;
}

export const qLearningApi = {
    getCampaignRecommendations: async (campaignId: string): Promise<QLearningRecommendation[]> => {
        const { data, error } = await supabase.rpc('q_campaign_recommendations', {
            p_campaign_id: campaignId,
        });

        if (error) throw error;
        const recs = (data || []).map((r: any) => ({
            keyword_id: r.keyword_id,
            keyword_text: r.keyword_text,
            current_bid: Number(r.current_bid),
            recommended_bid: Number(r.recommended_bid),
            multiplier: Number(r.multiplier),
            q_value: Number(r.q_value),
            state_bucket: r.state_bucket,
            is_explore: r.is_explore,
        }));

        return enrichWithHealth(recs, campaignId);
    },

    applyRecommendation: async (keywordId: string, newBid: number): Promise<void> => {
        const { error } = await supabase
            .from('keywords')
            .update({ bid: newBid, updated_at: new Date().toISOString() })
            .eq('id', keywordId);
        if (error) throw error;
    },

    applyAll: (recommendations: QLearningRecommendation[]): Promise<number> =>
        applyBidRecommendations(recommendations),
};

export interface CampaignForecast {
    target_date: string;
    predicted_spend: number;
    spend_lower_bound: number;
    spend_upper_bound: number;
    predicted_sales: number;
    sales_lower_bound: number;
    sales_upper_bound: number;
    predicted_acos: number | null;
}

export const forecastApi = {
    getCampaignForecasts: async (campaignId: string, horizonDays: number = 7): Promise<CampaignForecast[]> => {
        const { data, error } = await supabase.rpc('get_campaign_forecasts', {
            p_campaign_id: campaignId,
            p_horizon_days: horizonDays
        });

        if (error) throw error;
        return (data || []).map((r: any) => ({
            target_date: r.target_date,
            predicted_spend: Number(r.predicted_spend),
            spend_lower_bound: Number(r.spend_lower_bound),
            spend_upper_bound: Number(r.spend_upper_bound),
            predicted_sales: Number(r.predicted_sales),
            sales_lower_bound: Number(r.sales_lower_bound),
            sales_upper_bound: Number(r.sales_upper_bound),
            predicted_acos: r.predicted_acos !== null ? Number(r.predicted_acos) : null,
        }));
    },

    computeForecasts: async (): Promise<void> => {
        const sellerRes = await supabase.rpc('get_my_seller_id');
        if (sellerRes.error || !sellerRes.data) throw new Error('No seller found');

        const { error } = await supabase.rpc('compute_ewma_forecast', {
            p_seller_id: sellerRes.data,
            p_horizon_days: 7
        });

        if (error) throw error;
    }
};

export interface EnsembleRecommendation {
    keyword_id: string;
    keyword_text: string;
    current_bid: number;
    recommended_bid: number;
    multiplier: number;
    thompson_weight: number;
    thompson_multiplier: number;
    q_learning_weight: number;
    q_learning_multiplier: number;
    forecast_weight: number;
    forecast_multiplier: number;
    health_score?: number;
    health_status?: HealthStatus;
    competition_level?: 'low' | 'medium' | 'high';
    competitor_bid_estimate?: number;
}

export const ensembleApi = {
    getCampaignRecommendations: async (campaignId: string): Promise<EnsembleRecommendation[]> => {
        const { data, error } = await supabase.rpc('ensemble_recommendations', {
            p_campaign_id: campaignId,
        });

        if (error) throw error;
        const recs = (data || []).map((r: any) => ({
            keyword_id: r.keyword_id,
            keyword_text: r.keyword_text,
            current_bid: Number(r.current_bid),
            recommended_bid: Number(r.recommended_bid),
            multiplier: Number(r.multiplier),
            thompson_weight: Number(r.thompson_weight),
            thompson_multiplier: Number(r.thompson_multiplier),
            q_learning_weight: Number(r.q_learning_weight),
            q_learning_multiplier: Number(r.q_learning_multiplier),
            forecast_weight: Number(r.forecast_weight),
            forecast_multiplier: Number(r.forecast_multiplier),
        }));

        const [enriched, competitors] = await Promise.all([
            enrichWithHealth(recs, campaignId),
            competitorApi.estimateBids(campaignId).catch(() => []),
        ]);

        const competitorMap = new Map(competitors.map(c => [c.keyword_id, c]));
        return enriched.map(rec => {
            const comp = competitorMap.get(rec.keyword_id);
            return {
                ...rec,
                competition_level: comp?.competition_level,
                competitor_bid_estimate: comp?.estimated_competitor_mid,
            };
        });
    },

    applyRecommendation: async (keywordId: string, newBid: number): Promise<void> => {
        const { error } = await supabase
            .from('keywords')
            .update({ bid: newBid, updated_at: new Date().toISOString() })
            .eq('id', keywordId);
        if (error) throw error;
    },

    applyAll: (recommendations: EnsembleRecommendation[]): Promise<number> =>
        applyBidRecommendations(recommendations),
};

// ─── Upgrade 1: Guardrails API ───

export const guardrailApi = {
    applyWithGuardrails: async (keywordId: string, newBid: number, model: string, batchId: string): Promise<GuardrailResult> => {
        const { data, error } = await supabase.rpc('apply_bid_with_guardrails', {
            p_keyword_id: keywordId,
            p_new_bid: newBid,
            p_model: model,
            p_batch_id: batchId,
        });
        if (error) throw error;
        return data as GuardrailResult;
    },

    applyAllWithGuardrails: async (recommendations: { keyword_id: string; recommended_bid: number; current_bid: number }[], model: string): Promise<{ applied: number; clipped: number; batchId: string }> => {
        const batchId = crypto.randomUUID();
        let applied = 0;
        let clipped = 0;

        for (const rec of recommendations) {
            if (rec.recommended_bid !== rec.current_bid) {
                const result = await guardrailApi.applyWithGuardrails(rec.keyword_id, rec.recommended_bid, model, batchId);
                applied++;
                if (result.was_clipped) clipped++;
            }
        }

        return { applied, clipped, batchId };
    },

    rollbackBatch: async (batchId: string): Promise<number> => {
        const { data, error } = await supabase.rpc('rollback_bid_batch', { p_batch_id: batchId });
        if (error) throw error;
        return data as number;
    },

    getBatchHistory: async (): Promise<BatchHistory[]> => {
        const sellerRes = await supabase.rpc('get_my_seller_id');
        if (sellerRes.error || !sellerRes.data) return [];

        const { data, error } = await supabase.rpc('get_batch_history', {
            p_seller_id: sellerRes.data,
            p_limit: 20,
        });
        if (error) throw error;
        return (data || []).map((r: any) => ({
            batch_id: r.batch_id,
            model_used: r.model_used,
            keyword_count: Number(r.keyword_count),
            total_clipped: Number(r.total_clipped),
            applied_at: r.applied_at,
            is_rolled_back: r.is_rolled_back,
            avg_change_percent: Number(r.avg_change_percent),
        }));
    },

    getProjectedSpend: async (campaignId: string, recommendations: { keyword_id: string; recommended_bid: number }[]): Promise<ProjectedSpend> => {
        const { data, error } = await supabase.rpc('get_projected_spend', {
            p_campaign_id: campaignId,
            p_recommendations: JSON.stringify(recommendations),
        });
        if (error) throw error;
        return data as ProjectedSpend;
    },
};

// ─── Upgrade 9: Model Performance Tracking ───

export const modelTrackingApi = {
    logPrediction: async (keywordId: string, campaignId: string, modelType: string, recommendedBid: number, actualBid: number, previousBid: number): Promise<string> => {
        const { data, error } = await supabase.rpc('log_model_prediction', {
            p_keyword_id: keywordId,
            p_campaign_id: campaignId,
            p_model_type: modelType,
            p_recommended_bid: recommendedBid,
            p_actual_bid: actualBid,
            p_previous_bid: previousBid,
        });
        if (error) throw error;
        return data as string;
    },

    evaluatePredictions: async (daysAgo: number = 7): Promise<number> => {
        const { data, error } = await supabase.rpc('evaluate_model_predictions', { p_days_ago: daysAgo });
        if (error) throw error;
        return data as number;
    },

    getLeaderboard: async (): Promise<ModelLeaderboardEntry[]> => {
        const { data, error } = await supabase.rpc('get_model_leaderboard');
        if (error) throw error;
        return (data || []).map((r: any) => ({
            model_type: r.model_type,
            total_predictions: Number(r.total_predictions),
            evaluated_predictions: Number(r.evaluated_predictions),
            hit_rate: Number(r.hit_rate),
            avg_improvement: Number(r.avg_improvement),
            avg_acos_change: Number(r.avg_acos_change),
            best_streak: Number(r.best_streak),
        }));
    },
};

// ─── Upgrade 4: Keyword Health ───

export const healthApi = {
    getCampaignHealth: async (campaignId: string): Promise<KeywordHealth[]> => {
        const { data, error } = await supabase.rpc('campaign_keyword_health', { p_campaign_id: campaignId });
        if (error) throw error;
        return (data || []).map((r: any) => ({
            keyword_id: r.keyword_id,
            keyword_text: r.keyword_text,
            health_score: Number(r.health_score),
            health_status: r.health_status as HealthStatus,
            performance_score: 0,
            trend_score: 0,
            efficiency_score: 0,
            engagement_score: 0,
            risk_factors: r.risk_factors || [],
        }));
    },
};

// Helper to enrich recommendations with health scores
async function enrichWithHealth<T extends { keyword_id: string }>(recs: T[], campaignId: string): Promise<(T & { health_score?: number; health_status?: HealthStatus })[]> {
    try {
        const healthData = await healthApi.getCampaignHealth(campaignId);
        const healthMap = new Map(healthData.map(h => [h.keyword_id, h]));
        return recs.map(rec => {
            const h = healthMap.get(rec.keyword_id);
            return { ...rec, health_score: h?.health_score, health_status: h?.health_status };
        });
    } catch {
        return recs;
    }
}

// ─── Upgrade 7: Negative Keywords ───

export const negativeKeywordApi = {
    discover: async (campaignId: string): Promise<NegativeKeywordSuggestion[]> => {
        const { data, error } = await supabase.rpc('discover_negative_keywords', { p_campaign_id: campaignId });
        if (error) throw error;
        return (data || []).map((r: any) => ({
            id: r.id,
            search_term: r.search_term,
            total_spend: Number(r.total_spend),
            total_clicks: Number(r.total_clicks),
            total_orders: Number(r.total_orders),
            estimated_savings_30d: Number(r.estimated_savings_30d),
            suggested_match_type: r.suggested_match_type,
            reason: r.reason,
        }));
    },

    applySuggestion: async (suggestionId: string): Promise<void> => {
        const { error } = await supabase
            .from('negative_keyword_suggestions')
            .update({ status: 'applied' })
            .eq('id', suggestionId);
        if (error) throw error;
    },

    dismissSuggestion: async (suggestionId: string): Promise<void> => {
        const { error } = await supabase
            .from('negative_keyword_suggestions')
            .update({ status: 'dismissed' })
            .eq('id', suggestionId);
        if (error) throw error;
    },
};

// ─── Upgrade 5: Dayparting ───

export const daypartingApi = {
    computeSchedule: async (campaignId: string): Promise<DaypartingHour[]> => {
        const { data, error } = await supabase.rpc('compute_dayparting_schedule', { p_campaign_id: campaignId });
        if (error) throw error;
        return (data || []).map((r: any) => ({
            hour: Number(r.hour),
            bid_multiplier: Number(r.bid_multiplier),
            avg_cvr: Number(r.avg_cvr),
            avg_roas: Number(r.avg_roas),
            total_orders: Number(r.total_orders),
            confidence: Number(r.confidence),
        }));
    },

    getSchedule: async (campaignId: string): Promise<DaypartingSchedule[]> => {
        const { data, error } = await supabase
            .from('dayparting_schedules')
            .select('*')
            .eq('campaign_id', campaignId)
            .order('hour');
        if (error) throw error;
        return (data || []) as DaypartingSchedule[];
    },

    updateHourMultiplier: async (campaignId: string, hour: number, multiplier: number): Promise<void> => {
        const { error } = await supabase
            .from('dayparting_schedules')
            .upsert({ campaign_id: campaignId, hour, bid_multiplier: multiplier, updated_at: new Date().toISOString() }, { onConflict: 'campaign_id,hour' });
        if (error) throw error;
    },
};

// ─── Upgrade 3: Budget Pacing ───

export const pacingApi = {
    getSpendPacing: async (campaignId: string): Promise<SpendPacing> => {
        const { data, error } = await supabase.rpc('get_spend_pacing', { p_campaign_id: campaignId });
        if (error) throw error;
        return data as SpendPacing;
    },

    getPaceModifier: async (campaignId: string): Promise<number> => {
        const { data, error } = await supabase.rpc('pace_bid_modifier', { p_campaign_id: campaignId });
        if (error) throw error;
        return data as number;
    },

    getAllCampaignPacing: async (): Promise<SpendPacing[]> => {
        const campaigns = await campaignApi.getCampaigns();
        const active = campaigns.filter(c => c.status === 'active');
        const results: SpendPacing[] = [];
        for (const c of active) {
            try {
                const pacing = await pacingApi.getSpendPacing(c.id);
                results.push(pacing);
            } catch { /* skip */ }
        }
        return results;
    },
};

// ─── Upgrade 10: Staged Rollout ───

export const rolloutApi = {
    createRollout: async (campaignId: string, modelType: string, recommendations: { keyword_id: string; recommended_bid: number }[]): Promise<string> => {
        const { data, error } = await supabase.rpc('create_staged_rollout', {
            p_campaign_id: campaignId,
            p_model_type: modelType,
            p_recommendations: JSON.stringify(recommendations),
        });
        if (error) throw error;
        return data as string;
    },

    advanceStage: async (rolloutId: string): Promise<{ status: string; stage_advanced_to?: number; current_acos?: number; reason?: string }> => {
        const { data, error } = await supabase.rpc('advance_rollout_stage', { p_rollout_id: rolloutId });
        if (error) throw error;
        return data as any;
    },

    rollbackRollout: async (rolloutId: string): Promise<number> => {
        const { data, error } = await supabase.rpc('rollback_rollout', { p_rollout_id: rolloutId });
        if (error) throw error;
        return data as number;
    },

    getRolloutStatus: async (campaignId: string): Promise<RolloutStatus> => {
        const { data, error } = await supabase.rpc('get_rollout_status', { p_campaign_id: campaignId });
        if (error) throw error;
        return data as RolloutStatus;
    },
};

// ─── Upgrade 8: A/B Experiments ───

export const experimentApi = {
    create: async (campaignId: string, name: string, modelA: string, modelB: string, split: number = 50): Promise<string> => {
        const { data, error } = await supabase.rpc('create_experiment', {
            p_campaign_id: campaignId,
            p_name: name,
            p_model_a: modelA,
            p_model_b: modelB,
            p_split: split,
        });
        if (error) throw error;
        return data as string;
    },

    start: async (experimentId: string): Promise<void> => {
        const { error } = await supabase.rpc('start_experiment', { p_experiment_id: experimentId });
        if (error) throw error;
    },

    stop: async (experimentId: string): Promise<void> => {
        const { error } = await supabase.rpc('stop_experiment', { p_experiment_id: experimentId });
        if (error) throw error;
    },

    analyze: async (experimentId: string): Promise<ExperimentAnalysis> => {
        const { data, error } = await supabase.rpc('analyze_experiment', { p_experiment_id: experimentId });
        if (error) throw error;
        return data as ExperimentAnalysis;
    },

    recordMetrics: async (experimentId: string): Promise<number> => {
        const { data, error } = await supabase.rpc('record_experiment_metrics', { p_experiment_id: experimentId });
        if (error) throw error;
        return data as number;
    },

    getAll: async (): Promise<BidExperiment[]> => {
        const { data, error } = await supabase
            .from('bid_experiments')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as BidExperiment[];
    },

    getForCampaign: async (campaignId: string): Promise<BidExperiment[]> => {
        const { data, error } = await supabase
            .from('bid_experiments')
            .select('*')
            .eq('campaign_id', campaignId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as BidExperiment[];
    },
};

// ─── Upgrade 6: Competitor Analysis ───

export const competitorApi = {
    estimateBids: async (campaignId: string): Promise<CompetitorBidEstimate[]> => {
        const { data, error } = await supabase.rpc('estimate_competitor_bids', { p_campaign_id: campaignId });
        if (error) throw error;
        return (data || []).map((r: any) => ({
            keyword_id: r.keyword_id,
            keyword_text: r.keyword_text,
            current_bid: Number(r.current_bid),
            estimated_competitor_low: Number(r.estimated_competitor_low),
            estimated_competitor_mid: Number(r.estimated_competitor_mid),
            estimated_competitor_high: Number(r.estimated_competitor_high),
            competition_level: r.competition_level,
        }));
    },

    simulateAuction: async (keywordId: string, bid: number, simulations: number = 1000): Promise<AuctionSimulation> => {
        const { data, error } = await supabase.rpc('simulate_auction', {
            p_keyword_id: keywordId,
            p_bid: bid,
            p_num_simulations: simulations,
        });
        if (error) throw error;
        return data as AuctionSimulation;
    },
};

// ─── Upgrade 2: Portfolio Budget Optimizer ───

export const portfolioApi = {
    optimizeBudget: async (totalBudget: number): Promise<PortfolioBudgetAllocation[]> => {
        const sellerRes = await supabase.rpc('get_my_seller_id');
        if (sellerRes.error || !sellerRes.data) throw new Error('No seller found');

        const { data, error } = await supabase.rpc('optimize_portfolio_budget', {
            p_seller_id: sellerRes.data,
            p_total_budget: totalBudget,
        });
        if (error) throw error;
        return (data || []).map((r: any) => ({
            campaign_id: r.campaign_id,
            campaign_name: r.campaign_name,
            current_budget: Number(r.current_budget),
            recommended_budget: Number(r.recommended_budget),
            budget_change: Number(r.budget_change),
            current_roas: Number(r.current_roas),
            marginal_roas: Number(r.marginal_roas),
            expected_roas: Number(r.expected_roas),
        }));
    },

    simulateBudgetChange: async (additionalBudget: number): Promise<BudgetSimulation> => {
        const sellerRes = await supabase.rpc('get_my_seller_id');
        if (sellerRes.error || !sellerRes.data) throw new Error('No seller found');

        const { data, error } = await supabase.rpc('simulate_budget_change', {
            p_seller_id: sellerRes.data,
            p_additional_budget: additionalBudget,
        });
        if (error) throw error;
        return data as BudgetSimulation;
    },

    applyBudgetRecommendations: async (allocations: { campaign_id: string; recommended_budget: number }[]): Promise<number> => {
        let applied = 0;
        for (const alloc of allocations) {
            const { error } = await supabase
                .from('campaigns')
                .update({ daily_budget: alloc.recommended_budget, updated_at: new Date().toISOString() })
                .eq('id', alloc.campaign_id);
            if (!error) applied++;
        }
        return applied;
    },
};

// ─── Existing APIs (alerts, semantic, etc.) ───

export const alertApi = {
    getAlerts: async (options?: { unreadOnly?: boolean }): Promise<Alert[]> => {
        let query = supabase
            .from('alerts')
            .select('*')
            .eq('is_dismissed', false)
            .order('created_at', { ascending: false })
            .limit(50);

        if (options?.unreadOnly) {
            query = query.eq('is_read', false);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as Alert[];
    },

    markRead: async (alertId: string): Promise<void> => {
        const { error } = await supabase
            .from('alerts')
            .update({ is_read: true })
            .eq('id', alertId);
        if (error) throw error;
    },

    markAllRead: async (): Promise<void> => {
        const { error } = await supabase
            .from('alerts')
            .update({ is_read: true })
            .eq('is_read', false);
        if (error) throw error;
    },

    dismiss: async (alertId: string): Promise<void> => {
        const { error } = await supabase
            .from('alerts')
            .update({ is_dismissed: true })
            .eq('id', alertId);
        if (error) throw error;
    },

    runCheck: async (): Promise<number> => {
        const sellerRes = await supabase.rpc('get_my_seller_id');
        if (sellerRes.error || !sellerRes.data) throw new Error('No seller found');
        const { data, error } = await supabase.rpc('check_alert_rules', {
            p_seller_id: sellerRes.data,
        });
        if (error) throw error;
        return data as number;
    },

    getUnreadCount: async (): Promise<number> => {
        const { count, error } = await supabase
            .from('alerts')
            .select('*', { count: 'exact', head: true })
            .eq('is_read', false)
            .eq('is_dismissed', false);
        if (error) throw error;
        return count || 0;
    },
};

export interface Competitor {
    competitor_id: string;
    seller_id: string;
    asin: string;
    brand_name: string | null;
    product_title: string | null;
    tracked_since: string;
    is_active: boolean;
    estimated_price: number | null;
    estimated_daily_sales: number | null;
    bsr: number | null;
    review_count: number | null;
    rating: number | null;
    share_of_voice_percent: number | null;
    latest_metrics_date: string | null;
}

export const competitiveApi = {
    getCompetitors: async (): Promise<Competitor[]> => {
        const { data, error } = await supabase
            .from('vw_competitor_dashboard')
            .select('*')
            .order('share_of_voice_percent', { ascending: false });

        if (error) throw error;
        return (data || []) as Competitor[];
    },

    addCompetitor: async (asin: string, brandName?: string, productTitle?: string): Promise<void> => {
        const sellerRes = await supabase.rpc('get_my_seller_id');
        if (sellerRes.error || !sellerRes.data) throw new Error('No seller found');

        const { error } = await supabase
            .from('competitors')
            .insert({
                seller_id: sellerRes.data,
                asin,
                brand_name: brandName,
                product_title: productTitle
            });

        if (error) throw error;
    }
};

export interface SPApiCredentials {
    id: string;
    region: string;
    is_connected: boolean;
    last_synced_at: string | null;
}

export interface SyncLog {
    id: string;
    sync_type: string;
    status: 'pending' | 'in_progress' | 'success' | 'failed';
    records_processed: number;
    error_message: string | null;
    started_at: string;
    completed_at: string | null;
}

export const integrationApi = {
    getCredentials: async (): Promise<SPApiCredentials | null> => {
        const sellerRes = await supabase.rpc('get_my_seller_id');
        if (sellerRes.error || !sellerRes.data) return null;

        const { data, error } = await supabase
            .from('sp_api_credentials')
            .select('*')
            .eq('seller_id', sellerRes.data)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;
        return data as SPApiCredentials | null;
    },

    saveCredentials: async (credentials: { region: string; client_id: string; client_secret: string; refresh_token: string }): Promise<void> => {
        const sellerRes = await supabase.rpc('get_my_seller_id');
        if (sellerRes.error || !sellerRes.data) throw new Error('No seller found');

        const { error } = await supabase
            .from('sp_api_credentials')
            .upsert({
                seller_id: sellerRes.data,
                region: credentials.region,
                client_id: credentials.client_id,
                client_secret: credentials.client_secret,
                refresh_token: credentials.refresh_token,
                is_connected: true,
                updated_at: new Date().toISOString()
            }, { onConflict: 'seller_id' });

        if (error) throw error;
    },

    getRecentLogs: async (limit: number = 10): Promise<SyncLog[]> => {
        const { data, error } = await supabase
            .from('sync_logs')
            .select('*')
            .order('started_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return (data || []) as SyncLog[];
    },

    simulateSync: async (syncType: string): Promise<void> => {
        const { data: logId, error: startError } = await supabase.rpc('simulate_sp_api_sync', {
            p_sync_type: syncType
        });

        if (startError) throw startError;

        await new Promise(resolve => setTimeout(resolve, 3000));

        const { error: endError } = await supabase.rpc('complete_sp_api_sync', {
            p_log_id: logId,
            p_records: Math.floor(Math.random() * 500) + 10,
            p_status: 'success'
        });

        if (endError) throw endError;
    }
};

export const alertRuleApi = {
    getRules: async (): Promise<AlertRule[]> => {
        const { data, error } = await supabase
            .from('alert_rules')
            .select('*')
            .order('created_at', { ascending: true });
        if (error) throw error;
        return (data || []) as AlertRule[];
    },

    updateRule: async (id: string, updates: Partial<Pick<AlertRule, 'is_enabled' | 'severity' | 'config' | 'cooldown_minutes'>>): Promise<AlertRule> => {
        const { data, error } = await supabase
            .from('alert_rules')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as AlertRule;
    },

    deleteRule: async (id: string): Promise<void> => {
        const { error } = await supabase
            .from('alert_rules')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },
};

function mapKeywordRow(row: any): Keyword {
    return {
        id: row.id,
        campaign_id: row.campaign_id,
        keyword_text: row.keyword_text,
        match_type: row.match_type,
        bid: Number(row.bid),
        status: row.status,
        impressions: row.impressions || 0,
        clicks: row.clicks || 0,
        spend: Number(row.spend || 0),
        sales: Number(row.sales || 0),
        orders: row.orders || 0,
        acos: Number(row.acos || 0),
    };
}

function mapCampaignRow(row: any): Campaign {
    return {
        id: row.id,
        name: row.name,
        status: row.status,
        strategy: row.strategy,
        budget: Number(row.daily_budget),
        spend: Number(row.spend),
        sales: Number(row.sales),
        acos: Number(row.acos),
        impressions: row.impressions,
        clicks: row.clicks,
        orders: row.orders,
    };
}

// ─── Semantic Optimization API (Cosmo & Rufus) ───

const db = (table: string) => (supabase as any).from(table);

export const semanticApi = {
    getSearchTerms: async (campaignId: string): Promise<SearchTerm[]> => {
        const { data, error } = await db('search_terms')
            .select('*')
            .eq('campaign_id', campaignId)
            .order('impressions', { ascending: false });
        if (error) throw error;
        return (data || []) as SearchTerm[];
    },

    importSearchTerms: async (campaignId: string): Promise<number> => {
        const sellerRes = await supabase.rpc('get_my_seller_id');
        if (sellerRes.error || !sellerRes.data) throw new Error('No seller found');
        const sellerId = sellerRes.data;

        const sampleQueries = [
            'wireless bluetooth earbuds', 'noise cancelling headphones', 'earbuds with microphone',
            'bluetooth earphones waterproof', 'wireless earbuds for running', 'true wireless earbuds',
            'earbuds noise cancelling', 'bluetooth headphones over ear', 'wireless headphones gym',
            'earbuds long battery life', 'sport earbuds wireless', 'in ear monitors bluetooth',
            'earbuds with bass', 'wireless earbuds cheap', 'premium bluetooth earbuds',
            'earbuds for small ears', 'headphones for music', 'wireless earbuds gaming',
            'active noise cancellation earbuds', 'bluetooth 5.3 earbuds', 'earbuds with charging case',
            'sweatproof earbuds workout', 'earbuds hi-fi sound', 'wireless earbuds iphone compatible',
            'budget wireless earbuds', 'earbuds touch control', 'stereo bluetooth earbuds',
            'earbuds for calls', 'lightweight wireless earbuds', 'earbuds fast charging',
        ];

        const terms = sampleQueries.map(q => {
            const impressions = Math.floor(Math.random() * 5000) + 100;
            const clicks = Math.floor(impressions * (Math.random() * 0.08 + 0.005));
            const orders = Math.floor(clicks * (Math.random() * 0.2 + 0.02));
            const spend = Number((clicks * (Math.random() * 1.5 + 0.3)).toFixed(2));
            const sales = Number((orders * (Math.random() * 25 + 10)).toFixed(2));
            const acos = sales > 0 ? Number(((spend / sales) * 100).toFixed(2)) : 0;
            const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(4)) : 0;
            const cvr = clicks > 0 ? Number(((orders / clicks) * 100).toFixed(4)) : 0;
            return {
                seller_id: sellerId,
                campaign_id: campaignId,
                query_text: q,
                impressions, clicks, spend, sales, orders, acos, ctr, cvr,
                report_date: new Date().toISOString().slice(0, 10),
            };
        });

        const { error } = await db('search_terms').upsert(terms, {
            onConflict: 'seller_id,campaign_id,query_text,report_date',
        });
        if (error) throw error;
        return terms.length;
    },

    getClusters: async (campaignId: string): Promise<SemanticCluster[]> => {
        const { data, error } = await db('semantic_clusters')
            .select('*')
            .eq('campaign_id', campaignId)
            .order('total_sales', { ascending: false });
        if (error) throw error;
        return (data || []) as SemanticCluster[];
    },

    getClusterTerms: async (clusterId: string): Promise<SearchTerm[]> => {
        const { data, error } = await db('cluster_terms')
            .select('*, search_terms(*)')
            .eq('cluster_id', clusterId);
        if (error) throw error;
        return (data || []).map((ct: any) => ct.search_terms).filter(Boolean) as SearchTerm[];
    },

    runClustering: async (campaignId: string): Promise<number> => {
        const headers = await getAuthHeaders('application/json');
        const response = await fetch(`${API_BASE}/api/v1/semantic/cluster/${campaignId}`, {
            method: 'POST',
            headers
        });
        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Failed to run clustering via backend: ${err}`);
        }
        const data = await response.json();
        return data.cluster_count;
    },

    getListingSuggestions: async (campaignId: string): Promise<ListingSuggestion[]> => {
        const { data, error } = await db('listing_suggestions')
            .select('*, semantic_clusters(cluster_label)')
            .eq('campaign_id', campaignId)
            .order('cosmo_score', { ascending: false });
        if (error) throw error;
        return (data || []).map((d: any) => ({
            ...d,
            suggested_bullets: d.suggested_bullets || [],
            aplus_keywords: d.aplus_keywords || [],
            compliance_issues: d.compliance_issues || [],
            cluster: d.semantic_clusters,
        })) as ListingSuggestion[];
    },

    generateListingSuggestion: async (clusterId: string, campaignId: string): Promise<ListingSuggestion> => {
        const headers = await getAuthHeaders('application/json');
        const response = await fetch(`${API_BASE}/api/v1/semantic/listing/${clusterId}`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ campaign_id: campaignId })
        });
        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Failed to generate listing via backend: ${err}`);
        }
        const data = await response.json();
        return {
            ...data,
            suggested_bullets: data.suggested_bullets || [],
            aplus_keywords: data.aplus_keywords || [],
            compliance_issues: []
        } as ListingSuggestion;
    },

    runComplianceCheck: async (suggestionId: string): Promise<ListingSuggestion> => {
        const { data: suggestion, error: fetchErr } = await db('listing_suggestions')
            .select('*')
            .eq('id', suggestionId)
            .single();
        if (fetchErr) throw fetchErr;

        const issues: ComplianceIssue[] = [];
        const title = suggestion.suggested_title || '';

        if (title.length > 200) issues.push({ field: 'title', issue: `Title exceeds 200 characters (${title.length})`, severity: 'error' });
        if (title.length > 150) issues.push({ field: 'title', issue: `Title is long (${title.length}/200). Consider shortening for mobile`, severity: 'warning' });
        if (/[!$%]/.test(title)) issues.push({ field: 'title', issue: 'Title contains prohibited special characters', severity: 'error' });
        if (/\b(best|top|#1|guaranteed)\bi/i.test(title)) issues.push({ field: 'title', issue: 'Title contains superlative claims that violate Amazon policy', severity: 'error' });

        const bullets = (suggestion.suggested_bullets || []) as string[];
        bullets.forEach((b: string, i: number) => {
            if (b.length > 500) issues.push({ field: `bullet_${i + 1}`, issue: `Bullet ${i + 1} exceeds 500 characters`, severity: 'warning' });
        });

        const backend = suggestion.suggested_backend_terms || '';
        if (backend.length > 250) issues.push({ field: 'backend_terms', issue: `Backend terms exceed 250 bytes (${backend.length})`, severity: 'error' });

        const status = issues.some(i => i.severity === 'error') ? 'fail' : issues.length > 0 ? 'warning' : 'pass';

        const { data: updated, error: updateErr } = await db('listing_suggestions')
            .update({ compliance_status: status, compliance_issues: issues })
            .eq('id', suggestionId)
            .select()
            .single();
        if (updateErr) throw updateErr;
        return { ...updated, suggested_bullets: updated.suggested_bullets || [], aplus_keywords: updated.aplus_keywords || [], compliance_issues: issues } as ListingSuggestion;
    },

    getCampaignExpansions: async (campaignId: string): Promise<CampaignExpansion[]> => {
        const { data, error } = await db('campaign_expansions')
            .select('*, semantic_clusters(cluster_label)')
            .eq('campaign_id', campaignId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map((d: any) => ({
            ...d,
            keywords: d.keywords || [],
            cluster: d.semantic_clusters,
        })) as CampaignExpansion[];
    },

    generateCampaignExpansions: async (clusterId: string, campaignId: string): Promise<number> => {
        const headers = await getAuthHeaders('application/json');
        const response = await fetch(`${API_BASE}/api/v1/semantic/campaigns/${clusterId}`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ campaign_id: campaignId })
        });
        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Failed to generate SKAGs via backend: ${err}`);
        }
        const data = await response.json();
        return data.count;
    },
};

export interface ReportInsight {
    title: string;
    description: string;
    impact: string;
    actionable_step: string;
}

export interface ReportAnalysisResponse {
    summary: string;
    insights: ReportInsight[];
}

export const reportsApi = {
    uploadReport: async (file: File): Promise<ReportAnalysisResponse> => {
        const formData = new FormData();
        formData.append('file', file);

        const authHeaders = await getAuthHeaders();
        const response = await fetch(`${API_BASE}/api/v1/reports/upload`, {
            method: 'POST',
            headers: authHeaders,
            body: formData,
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Failed to analyze report: ${err}`);
        }

        return await response.json() as ReportAnalysisResponse;
    }
};
