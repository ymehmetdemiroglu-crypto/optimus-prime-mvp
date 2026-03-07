-- ============================================================================
-- BID OPTIMIZATION ENGINE UPGRADES — All 10 Upgrades
-- ============================================================================

-- ============================================================================
-- UPGRADE 1: Bid Change Guardrails & Safety Net
-- ============================================================================

CREATE TABLE IF NOT EXISTS bid_guardrail_config (
    seller_id uuid PRIMARY KEY REFERENCES sellers(id),
    max_bid_change_percent numeric DEFAULT 30,
    max_absolute_bid numeric DEFAULT 10.00,
    min_absolute_bid numeric DEFAULT 0.10,
    require_confirmation_above numeric DEFAULT 0.50,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bid_change_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id uuid NOT NULL,
    keyword_id uuid NOT NULL REFERENCES keywords(id),
    campaign_id uuid NOT NULL REFERENCES campaigns(id),
    seller_id uuid NOT NULL REFERENCES sellers(id),
    previous_bid numeric NOT NULL,
    new_bid numeric NOT NULL,
    clipped_bid numeric,
    was_clipped boolean DEFAULT false,
    model_used text NOT NULL,
    applied_at timestamptz DEFAULT now(),
    rolled_back_at timestamptz,
    applied_by uuid
);

CREATE INDEX idx_bid_change_history_batch ON bid_change_history(batch_id);
CREATE INDEX idx_bid_change_history_keyword ON bid_change_history(keyword_id);
CREATE INDEX idx_bid_change_history_campaign ON bid_change_history(campaign_id);

CREATE OR REPLACE FUNCTION apply_bid_with_guardrails(
    p_keyword_id uuid,
    p_new_bid numeric,
    p_model text,
    p_batch_id uuid
) RETURNS jsonb AS $$
DECLARE
    v_keyword record;
    v_config record;
    v_final_bid numeric;
    v_was_clipped boolean := false;
    v_max_change numeric;
    v_upper_bound numeric;
    v_lower_bound numeric;
BEGIN
    SELECT k.*, k.bid AS current_bid, k.campaign_id, k.seller_id
    INTO v_keyword
    FROM keywords k WHERE k.id = p_keyword_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Keyword not found');
    END IF;

    SELECT * INTO v_config
    FROM bid_guardrail_config WHERE seller_id = v_keyword.seller_id;

    IF NOT FOUND THEN
        v_config := ROW(v_keyword.seller_id, 30, 10.00, 0.10, 0.50);
    END IF;

    v_final_bid := p_new_bid;
    v_max_change := v_keyword.current_bid * (v_config.max_bid_change_percent / 100.0);
    v_upper_bound := v_keyword.current_bid + v_max_change;
    v_lower_bound := GREATEST(v_keyword.current_bid - v_max_change, v_config.min_absolute_bid);

    IF v_final_bid > v_upper_bound THEN
        v_final_bid := v_upper_bound;
        v_was_clipped := true;
    ELSIF v_final_bid < v_lower_bound THEN
        v_final_bid := v_lower_bound;
        v_was_clipped := true;
    END IF;

    IF v_final_bid > v_config.max_absolute_bid THEN
        v_final_bid := v_config.max_absolute_bid;
        v_was_clipped := true;
    END IF;
    IF v_final_bid < v_config.min_absolute_bid THEN
        v_final_bid := v_config.min_absolute_bid;
        v_was_clipped := true;
    END IF;

    v_final_bid := ROUND(v_final_bid, 2);

    UPDATE keywords SET bid = v_final_bid, updated_at = now() WHERE id = p_keyword_id;

    INSERT INTO bid_change_history (batch_id, keyword_id, campaign_id, seller_id, previous_bid, new_bid, clipped_bid, was_clipped, model_used)
    VALUES (p_batch_id, p_keyword_id, v_keyword.campaign_id, v_keyword.seller_id, v_keyword.current_bid, v_final_bid,
            CASE WHEN v_was_clipped THEN p_new_bid ELSE NULL END, v_was_clipped, p_model);

    RETURN jsonb_build_object(
        'keyword_id', p_keyword_id,
        'previous_bid', v_keyword.current_bid,
        'applied_bid', v_final_bid,
        'requested_bid', p_new_bid,
        'was_clipped', v_was_clipped
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION rollback_bid_batch(p_batch_id uuid)
RETURNS integer AS $$
DECLARE
    v_count integer := 0;
    v_record record;
BEGIN
    FOR v_record IN
        SELECT keyword_id, previous_bid
        FROM bid_change_history
        WHERE batch_id = p_batch_id AND rolled_back_at IS NULL
    LOOP
        UPDATE keywords SET bid = v_record.previous_bid, updated_at = now()
        WHERE id = v_record.keyword_id;
        v_count := v_count + 1;
    END LOOP;

    UPDATE bid_change_history SET rolled_back_at = now()
    WHERE batch_id = p_batch_id AND rolled_back_at IS NULL;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_batch_history(p_seller_id uuid, p_limit integer DEFAULT 20)
RETURNS TABLE(
    batch_id uuid,
    model_used text,
    keyword_count bigint,
    total_clipped bigint,
    applied_at timestamptz,
    is_rolled_back boolean,
    avg_change_percent numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        h.batch_id,
        MAX(h.model_used)::text,
        COUNT(*)::bigint,
        COUNT(*) FILTER (WHERE h.was_clipped)::bigint,
        MIN(h.applied_at),
        BOOL_OR(h.rolled_back_at IS NOT NULL),
        ROUND(AVG(CASE WHEN h.previous_bid > 0 THEN ((h.new_bid - h.previous_bid) / h.previous_bid) * 100 ELSE 0 END), 2)
    FROM bid_change_history h
    WHERE h.seller_id = p_seller_id
    GROUP BY h.batch_id
    ORDER BY MIN(h.applied_at) DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_projected_spend(p_campaign_id uuid, p_recommendations jsonb)
RETURNS jsonb AS $$
DECLARE
    v_current_spend numeric;
    v_projected_spend numeric := 0;
    v_rec record;
    v_keyword record;
BEGIN
    SELECT SUM(spend) INTO v_current_spend FROM keywords WHERE campaign_id = p_campaign_id;

    FOR v_rec IN SELECT * FROM jsonb_array_elements(p_recommendations) AS r
    LOOP
        SELECT impressions, clicks, bid INTO v_keyword
        FROM keywords WHERE id = (v_rec.value->>'keyword_id')::uuid;

        IF FOUND AND v_keyword.impressions > 0 THEN
            v_projected_spend := v_projected_spend +
                (v_keyword.clicks::numeric / GREATEST(v_keyword.impressions, 1)) *
                v_keyword.impressions *
                (v_rec.value->>'recommended_bid')::numeric;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'current_daily_spend', COALESCE(v_current_spend, 0),
        'projected_daily_spend', ROUND(v_projected_spend, 2),
        'spend_change', ROUND(v_projected_spend - COALESCE(v_current_spend, 0), 2),
        'spend_change_percent', CASE WHEN COALESCE(v_current_spend, 0) > 0
            THEN ROUND(((v_projected_spend - v_current_spend) / v_current_spend) * 100, 2)
            ELSE 0 END
    );
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- UPGRADE 9: Model Performance Tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_performance_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword_id uuid NOT NULL REFERENCES keywords(id),
    campaign_id uuid NOT NULL REFERENCES campaigns(id),
    seller_id uuid NOT NULL REFERENCES sellers(id),
    model_type text NOT NULL CHECK (model_type IN ('thompson', 'q_learning', 'ensemble')),
    recommended_bid numeric NOT NULL,
    actual_bid_applied numeric NOT NULL,
    predicted_direction text NOT NULL CHECK (predicted_direction IN ('increase', 'decrease', 'maintain')),
    pre_acos numeric,
    pre_sales numeric,
    pre_ctr numeric,
    post_acos_7d numeric,
    post_sales_7d numeric,
    post_ctr_7d numeric,
    was_correct boolean,
    improvement_percent numeric,
    created_at timestamptz DEFAULT now(),
    evaluated_at timestamptz
);

CREATE INDEX idx_model_perf_model ON model_performance_log(model_type);
CREATE INDEX idx_model_perf_campaign ON model_performance_log(campaign_id);
CREATE INDEX idx_model_perf_created ON model_performance_log(created_at);

CREATE OR REPLACE FUNCTION log_model_prediction(
    p_keyword_id uuid,
    p_campaign_id uuid,
    p_model_type text,
    p_recommended_bid numeric,
    p_actual_bid numeric,
    p_previous_bid numeric
) RETURNS uuid AS $$
DECLARE
    v_seller_id uuid;
    v_keyword record;
    v_direction text;
    v_log_id uuid;
BEGIN
    SELECT seller_id INTO v_seller_id FROM campaigns WHERE id = p_campaign_id;
    SELECT acos, sales, clicks, impressions INTO v_keyword FROM keywords WHERE id = p_keyword_id;

    IF p_actual_bid > p_previous_bid THEN v_direction := 'increase';
    ELSIF p_actual_bid < p_previous_bid THEN v_direction := 'decrease';
    ELSE v_direction := 'maintain';
    END IF;

    INSERT INTO model_performance_log (
        keyword_id, campaign_id, seller_id, model_type,
        recommended_bid, actual_bid_applied, predicted_direction,
        pre_acos, pre_sales, pre_ctr
    ) VALUES (
        p_keyword_id, p_campaign_id, v_seller_id, p_model_type,
        p_recommended_bid, p_actual_bid, v_direction,
        v_keyword.acos, v_keyword.sales,
        CASE WHEN v_keyword.impressions > 0 THEN (v_keyword.clicks::numeric / v_keyword.impressions) * 100 ELSE 0 END
    ) RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION evaluate_model_predictions(p_days_ago integer DEFAULT 7)
RETURNS integer AS $$
DECLARE
    v_count integer := 0;
    v_log record;
    v_keyword record;
    v_correct boolean;
    v_improvement numeric;
BEGIN
    FOR v_log IN
        SELECT l.id, l.keyword_id, l.pre_acos, l.pre_sales, l.predicted_direction
        FROM model_performance_log l
        WHERE l.evaluated_at IS NULL
          AND l.created_at < now() - (p_days_ago || ' days')::interval
    LOOP
        SELECT acos, sales, clicks, impressions INTO v_keyword
        FROM keywords WHERE id = v_log.keyword_id;

        v_correct := CASE
            WHEN v_log.predicted_direction = 'increase' AND COALESCE(v_keyword.acos, 0) <= COALESCE(v_log.pre_acos, 100) THEN true
            WHEN v_log.predicted_direction = 'decrease' AND COALESCE(v_keyword.acos, 0) <= COALESCE(v_log.pre_acos, 100) THEN true
            WHEN v_log.predicted_direction = 'maintain' THEN true
            ELSE false
        END;

        v_improvement := CASE WHEN COALESCE(v_log.pre_acos, 0) > 0
            THEN ROUND(((v_log.pre_acos - COALESCE(v_keyword.acos, 0)) / v_log.pre_acos) * 100, 2)
            ELSE 0 END;

        UPDATE model_performance_log
        SET post_acos_7d = v_keyword.acos,
            post_sales_7d = v_keyword.sales,
            post_ctr_7d = CASE WHEN v_keyword.impressions > 0 THEN (v_keyword.clicks::numeric / v_keyword.impressions) * 100 ELSE 0 END,
            was_correct = v_correct,
            improvement_percent = v_improvement,
            evaluated_at = now()
        WHERE id = v_log.id;

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_model_leaderboard()
RETURNS TABLE(
    model_type text,
    total_predictions bigint,
    evaluated_predictions bigint,
    hit_rate numeric,
    avg_improvement numeric,
    avg_acos_change numeric,
    best_streak integer
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        l.model_type,
        COUNT(*)::bigint AS total_predictions,
        COUNT(*) FILTER (WHERE l.evaluated_at IS NOT NULL)::bigint,
        ROUND(
            (COUNT(*) FILTER (WHERE l.was_correct = true)::numeric /
             GREATEST(COUNT(*) FILTER (WHERE l.evaluated_at IS NOT NULL), 1)) * 100, 1
        ),
        ROUND(AVG(l.improvement_percent) FILTER (WHERE l.evaluated_at IS NOT NULL), 2),
        ROUND(AVG(COALESCE(l.pre_acos, 0) - COALESCE(l.post_acos_7d, 0)) FILTER (WHERE l.evaluated_at IS NOT NULL), 2),
        0
    FROM model_performance_log l
    GROUP BY l.model_type
    ORDER BY hit_rate DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- UPGRADE 4: Keyword Health Scoring
-- ============================================================================

CREATE OR REPLACE FUNCTION compute_keyword_health(p_keyword_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_kw record;
    v_perf_score numeric;
    v_trend_score numeric;
    v_efficiency_score numeric;
    v_engagement_score numeric;
    v_health_score numeric;
    v_status text;
    v_risk_factors jsonb := '[]'::jsonb;
BEGIN
    SELECT * INTO v_kw FROM keywords WHERE id = p_keyword_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Keyword not found'); END IF;

    -- Performance score (35%): ACoS-based
    v_perf_score := CASE
        WHEN v_kw.acos <= 15 THEN 100
        WHEN v_kw.acos <= 25 THEN 80
        WHEN v_kw.acos <= 35 THEN 60
        WHEN v_kw.acos <= 50 THEN 40
        WHEN v_kw.acos <= 75 THEN 20
        ELSE 5
    END;

    -- Trend score (25%): based on recent activity
    v_trend_score := CASE
        WHEN v_kw.impressions > 1000 AND v_kw.clicks > 50 THEN 90
        WHEN v_kw.impressions > 500 AND v_kw.clicks > 20 THEN 70
        WHEN v_kw.impressions > 100 AND v_kw.clicks > 5 THEN 50
        WHEN v_kw.impressions > 0 THEN 30
        ELSE 10
    END;

    -- Efficiency score (25%): CVR and revenue per click
    v_efficiency_score := CASE
        WHEN v_kw.clicks > 0 AND (v_kw.orders::numeric / v_kw.clicks) > 0.15 THEN 100
        WHEN v_kw.clicks > 0 AND (v_kw.orders::numeric / v_kw.clicks) > 0.10 THEN 80
        WHEN v_kw.clicks > 0 AND (v_kw.orders::numeric / v_kw.clicks) > 0.05 THEN 60
        WHEN v_kw.clicks > 0 AND (v_kw.orders::numeric / v_kw.clicks) > 0.02 THEN 40
        WHEN v_kw.clicks > 0 THEN 20
        ELSE 10
    END;

    -- Engagement score (15%): CTR quality
    v_engagement_score := CASE
        WHEN v_kw.impressions > 0 AND (v_kw.clicks::numeric / v_kw.impressions) > 0.05 THEN 100
        WHEN v_kw.impressions > 0 AND (v_kw.clicks::numeric / v_kw.impressions) > 0.03 THEN 80
        WHEN v_kw.impressions > 0 AND (v_kw.clicks::numeric / v_kw.impressions) > 0.01 THEN 60
        WHEN v_kw.impressions > 0 AND (v_kw.clicks::numeric / v_kw.impressions) > 0.005 THEN 40
        WHEN v_kw.impressions > 0 THEN 20
        ELSE 10
    END;

    v_health_score := ROUND(
        v_perf_score * 0.35 +
        v_trend_score * 0.25 +
        v_efficiency_score * 0.25 +
        v_engagement_score * 0.15
    , 1);

    v_status := CASE
        WHEN v_health_score >= 85 THEN 'excellent'
        WHEN v_health_score >= 70 THEN 'good'
        WHEN v_health_score >= 50 THEN 'at_risk'
        WHEN v_health_score >= 30 THEN 'declining'
        ELSE 'critical'
    END;

    IF v_kw.acos > 50 THEN v_risk_factors := v_risk_factors || '"High ACoS"'::jsonb; END IF;
    IF v_kw.clicks > 20 AND v_kw.orders = 0 THEN v_risk_factors := v_risk_factors || '"Spend without conversions"'::jsonb; END IF;
    IF v_kw.impressions < 100 THEN v_risk_factors := v_risk_factors || '"Low visibility"'::jsonb; END IF;
    IF v_kw.impressions > 0 AND (v_kw.clicks::numeric / v_kw.impressions) < 0.005 THEN v_risk_factors := v_risk_factors || '"Very low CTR"'::jsonb; END IF;

    RETURN jsonb_build_object(
        'keyword_id', p_keyword_id,
        'health_score', v_health_score,
        'health_status', v_status,
        'performance_score', v_perf_score,
        'trend_score', v_trend_score,
        'efficiency_score', v_efficiency_score,
        'engagement_score', v_engagement_score,
        'risk_factors', v_risk_factors
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION campaign_keyword_health(p_campaign_id uuid)
RETURNS TABLE(
    keyword_id uuid,
    keyword_text text,
    health_score numeric,
    health_status text,
    risk_factors jsonb
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        k.id,
        k.keyword_text,
        (compute_keyword_health(k.id)->>'health_score')::numeric,
        compute_keyword_health(k.id)->>'health_status',
        compute_keyword_health(k.id)->'risk_factors'
    FROM keywords k
    WHERE k.campaign_id = p_campaign_id
    ORDER BY (compute_keyword_health(k.id)->>'health_score')::numeric ASC;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- UPGRADE 7: Negative Keyword Auto-Discovery
-- ============================================================================

CREATE TABLE IF NOT EXISTS negative_keyword_suggestions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid NOT NULL REFERENCES campaigns(id),
    seller_id uuid NOT NULL REFERENCES sellers(id),
    search_term text NOT NULL,
    total_spend numeric NOT NULL DEFAULT 0,
    total_impressions integer NOT NULL DEFAULT 0,
    total_clicks integer NOT NULL DEFAULT 0,
    total_orders integer NOT NULL DEFAULT 0,
    suggested_match_type text NOT NULL DEFAULT 'exact' CHECK (suggested_match_type IN ('exact', 'phrase')),
    estimated_savings_30d numeric DEFAULT 0,
    reason text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'dismissed')),
    created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_neg_kw_campaign ON negative_keyword_suggestions(campaign_id);
CREATE INDEX idx_neg_kw_status ON negative_keyword_suggestions(status);

CREATE OR REPLACE FUNCTION discover_negative_keywords(p_campaign_id uuid)
RETURNS TABLE(
    id uuid,
    search_term text,
    total_spend numeric,
    total_clicks integer,
    total_orders integer,
    estimated_savings_30d numeric,
    suggested_match_type text,
    reason text
) AS $$
DECLARE
    v_seller_id uuid;
BEGIN
    SELECT seller_id INTO v_seller_id FROM campaigns WHERE campaigns.id = p_campaign_id;

    DELETE FROM negative_keyword_suggestions
    WHERE negative_keyword_suggestions.campaign_id = p_campaign_id AND status = 'pending';

    INSERT INTO negative_keyword_suggestions (campaign_id, seller_id, search_term, total_spend, total_impressions, total_clicks, total_orders, suggested_match_type, estimated_savings_30d, reason)
    SELECT
        p_campaign_id,
        v_seller_id,
        st.query_text,
        SUM(st.spend),
        SUM(st.impressions)::integer,
        SUM(st.clicks)::integer,
        SUM(st.orders)::integer,
        CASE WHEN LENGTH(st.query_text) - LENGTH(REPLACE(st.query_text, ' ', '')) >= 2 THEN 'phrase' ELSE 'exact' END,
        ROUND(SUM(st.spend) * 4, 2),
        CASE
            WHEN SUM(st.orders) = 0 AND SUM(st.clicks) > 5 THEN 'High clicks, zero conversions'
            WHEN SUM(st.orders) = 0 AND SUM(st.spend) > 10 THEN 'Significant spend, zero sales'
            ELSE 'No conversions detected'
        END
    FROM search_terms st
    WHERE st.campaign_id = p_campaign_id
      AND st.orders = 0
      AND st.spend > 2
    GROUP BY st.query_text
    HAVING SUM(st.spend) > 5;

    RETURN QUERY
    SELECT
        nks.id, nks.search_term, nks.total_spend, nks.total_clicks,
        nks.total_orders, nks.estimated_savings_30d, nks.suggested_match_type, nks.reason
    FROM negative_keyword_suggestions nks
    WHERE nks.campaign_id = p_campaign_id AND nks.status = 'pending'
    ORDER BY nks.estimated_savings_30d DESC;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- UPGRADE 5: Dayparting / Time-of-Day Bid Modifiers
-- ============================================================================

CREATE TABLE IF NOT EXISTS hourly_performance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid NOT NULL REFERENCES campaigns(id),
    hour_of_day integer NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
    day_of_week integer CHECK (day_of_week BETWEEN 0 AND 6),
    impressions integer DEFAULT 0,
    clicks integer DEFAULT 0,
    spend numeric DEFAULT 0,
    sales numeric DEFAULT 0,
    orders integer DEFAULT 0,
    sample_days integer DEFAULT 0,
    updated_at timestamptz DEFAULT now(),
    UNIQUE(campaign_id, hour_of_day, day_of_week)
);

CREATE TABLE IF NOT EXISTS dayparting_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid NOT NULL REFERENCES campaigns(id),
    hour integer NOT NULL CHECK (hour BETWEEN 0 AND 23),
    bid_multiplier numeric NOT NULL DEFAULT 1.0,
    is_enabled boolean DEFAULT true,
    updated_at timestamptz DEFAULT now(),
    UNIQUE(campaign_id, hour)
);

CREATE OR REPLACE FUNCTION compute_dayparting_schedule(p_campaign_id uuid)
RETURNS TABLE(
    hour integer,
    bid_multiplier numeric,
    avg_cvr numeric,
    avg_roas numeric,
    total_orders integer,
    confidence numeric
) AS $$
DECLARE
    v_avg_cvr numeric;
BEGIN
    SELECT CASE WHEN SUM(clicks) > 0 THEN SUM(orders)::numeric / SUM(clicks) ELSE 0 END
    INTO v_avg_cvr
    FROM hourly_performance WHERE campaign_id = p_campaign_id;

    RETURN QUERY
    WITH hourly AS (
        SELECT
            hp.hour_of_day,
            SUM(hp.impressions) AS total_imp,
            SUM(hp.clicks) AS total_clicks,
            SUM(hp.orders) AS total_orders,
            SUM(hp.sales) AS total_sales,
            SUM(hp.spend) AS total_spend,
            SUM(hp.sample_days) AS total_samples
        FROM hourly_performance hp
        WHERE hp.campaign_id = p_campaign_id
        GROUP BY hp.hour_of_day
    )
    SELECT
        h.hour_of_day,
        ROUND(GREATEST(0.5, LEAST(2.0,
            CASE WHEN v_avg_cvr > 0 AND h.total_clicks > 0
                THEN (h.total_orders::numeric / h.total_clicks) / v_avg_cvr
                ELSE 1.0
            END
        )), 2),
        CASE WHEN h.total_clicks > 0 THEN ROUND((h.total_orders::numeric / h.total_clicks) * 100, 2) ELSE 0 END,
        CASE WHEN h.total_spend > 0 THEN ROUND(h.total_sales / h.total_spend, 2) ELSE 0 END,
        h.total_orders::integer,
        LEAST(1.0, h.total_samples::numeric / 30)
    FROM hourly h
    ORDER BY h.hour_of_day;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- UPGRADE 3: Budget Pacing & Spend Forecasting
-- ============================================================================

CREATE OR REPLACE FUNCTION get_spend_pacing(p_campaign_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_campaign record;
    v_spent_today numeric;
    v_hours_elapsed numeric;
    v_projected_eod numeric;
    v_pace_pct numeric;
    v_status text;
BEGIN
    SELECT * INTO v_campaign FROM campaigns WHERE id = p_campaign_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Campaign not found'); END IF;

    v_hours_elapsed := EXTRACT(HOUR FROM now()) + (EXTRACT(MINUTE FROM now()) / 60.0);
    IF v_hours_elapsed < 1 THEN v_hours_elapsed := 1; END IF;

    SELECT COALESCE(SUM(pm.ad_spend), 0) INTO v_spent_today
    FROM performance_metrics pm
    WHERE pm.campaign_id = p_campaign_id
      AND pm.recorded_at >= date_trunc('day', now());

    IF v_spent_today = 0 THEN
        v_spent_today := v_campaign.spend * (v_hours_elapsed / 24.0);
    END IF;

    v_projected_eod := (v_spent_today / v_hours_elapsed) * 24;
    v_pace_pct := CASE WHEN v_campaign.daily_budget > 0
        THEN ROUND((v_spent_today / v_campaign.daily_budget) * 100, 1)
        ELSE 0 END;

    v_status := CASE
        WHEN v_projected_eod > v_campaign.daily_budget * 1.2 THEN 'overspending'
        WHEN v_projected_eod < v_campaign.daily_budget * 0.7 THEN 'underspending'
        ELSE 'on_track'
    END;

    RETURN jsonb_build_object(
        'campaign_id', p_campaign_id,
        'campaign_name', v_campaign.name,
        'daily_budget', v_campaign.daily_budget,
        'spent_today', ROUND(v_spent_today, 2),
        'hours_elapsed', ROUND(v_hours_elapsed, 1),
        'projected_eod_spend', ROUND(v_projected_eod, 2),
        'pace_percentage', v_pace_pct,
        'pacing_status', v_status
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pace_bid_modifier(p_campaign_id uuid)
RETURNS numeric AS $$
DECLARE
    v_pacing jsonb;
    v_status text;
BEGIN
    v_pacing := get_spend_pacing(p_campaign_id);
    v_status := v_pacing->>'pacing_status';

    RETURN CASE
        WHEN v_status = 'overspending' THEN 0.85
        WHEN v_status = 'underspending' THEN 1.15
        ELSE 1.0
    END;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- UPGRADE 10: Staged Rollout
-- ============================================================================

CREATE TABLE IF NOT EXISTS rollout_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid NOT NULL REFERENCES campaigns(id),
    seller_id uuid NOT NULL REFERENCES sellers(id),
    model_type text NOT NULL,
    total_keywords integer NOT NULL,
    current_stage integer NOT NULL DEFAULT 1,
    keywords_per_stage integer NOT NULL,
    status text NOT NULL DEFAULT 'stage_1' CHECK (status IN ('stage_1','stage_2','stage_3','stage_4','completed','halted','rolled_back')),
    pre_acos numeric,
    stage_1_acos numeric,
    stage_2_acos numeric,
    stage_3_acos numeric,
    stage_4_acos numeric,
    halt_reason text,
    created_at timestamptz DEFAULT now(),
    completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS rollout_keyword_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rollout_id uuid NOT NULL REFERENCES rollout_batches(id),
    keyword_id uuid NOT NULL REFERENCES keywords(id),
    stage integer NOT NULL CHECK (stage BETWEEN 1 AND 4),
    new_bid numeric NOT NULL,
    previous_bid numeric NOT NULL,
    applied_at timestamptz
);

CREATE INDEX idx_rollout_kw_rollout ON rollout_keyword_assignments(rollout_id);

CREATE OR REPLACE FUNCTION create_staged_rollout(
    p_campaign_id uuid,
    p_model_type text,
    p_recommendations jsonb
) RETURNS uuid AS $$
DECLARE
    v_rollout_id uuid;
    v_seller_id uuid;
    v_total integer;
    v_per_stage integer;
    v_stage integer;
    v_counter integer := 0;
    v_rec record;
    v_pre_acos numeric;
BEGIN
    SELECT seller_id, acos INTO v_seller_id, v_pre_acos FROM campaigns WHERE id = p_campaign_id;
    v_total := jsonb_array_length(p_recommendations);
    v_per_stage := GREATEST(1, v_total / 4);

    INSERT INTO rollout_batches (campaign_id, seller_id, model_type, total_keywords, keywords_per_stage, pre_acos)
    VALUES (p_campaign_id, v_seller_id, p_model_type, v_total, v_per_stage, v_pre_acos)
    RETURNING id INTO v_rollout_id;

    FOR v_rec IN SELECT * FROM jsonb_array_elements(p_recommendations) AS r ORDER BY random()
    LOOP
        v_counter := v_counter + 1;
        v_stage := LEAST(4, ((v_counter - 1) / v_per_stage) + 1);

        INSERT INTO rollout_keyword_assignments (rollout_id, keyword_id, stage, new_bid, previous_bid)
        SELECT v_rollout_id, k.id, v_stage, (v_rec.value->>'recommended_bid')::numeric, k.bid
        FROM keywords k WHERE k.id = (v_rec.value->>'keyword_id')::uuid;
    END LOOP;

    -- Apply stage 1 immediately
    UPDATE keywords k SET bid = rka.new_bid, updated_at = now()
    FROM rollout_keyword_assignments rka
    WHERE rka.rollout_id = v_rollout_id AND rka.stage = 1 AND rka.keyword_id = k.id;

    UPDATE rollout_keyword_assignments SET applied_at = now()
    WHERE rollout_id = v_rollout_id AND stage = 1;

    RETURN v_rollout_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION advance_rollout_stage(p_rollout_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_rollout record;
    v_current_acos numeric;
    v_next_stage integer;
    v_acos_threshold numeric;
BEGIN
    SELECT * INTO v_rollout FROM rollout_batches WHERE id = p_rollout_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Rollout not found'); END IF;
    IF v_rollout.status IN ('completed', 'halted', 'rolled_back') THEN
        RETURN jsonb_build_object('error', 'Rollout already finished', 'status', v_rollout.status);
    END IF;

    SELECT acos INTO v_current_acos FROM campaigns WHERE id = v_rollout.campaign_id;
    v_acos_threshold := COALESCE(v_rollout.pre_acos, 0) * 1.2;

    IF v_current_acos > v_acos_threshold AND COALESCE(v_rollout.pre_acos, 0) > 0 THEN
        UPDATE rollout_batches SET status = 'halted', halt_reason = 'ACoS exceeded 20% above baseline: ' || v_current_acos || '% vs ' || v_rollout.pre_acos || '%'
        WHERE id = p_rollout_id;
        RETURN jsonb_build_object('status', 'halted', 'reason', 'ACoS threshold exceeded', 'current_acos', v_current_acos, 'baseline_acos', v_rollout.pre_acos);
    END IF;

    v_next_stage := v_rollout.current_stage + 1;
    IF v_next_stage > 4 THEN
        UPDATE rollout_batches SET status = 'completed', completed_at = now() WHERE id = p_rollout_id;
        RETURN jsonb_build_object('status', 'completed');
    END IF;

    UPDATE keywords k SET bid = rka.new_bid, updated_at = now()
    FROM rollout_keyword_assignments rka
    WHERE rka.rollout_id = p_rollout_id AND rka.stage = v_next_stage AND rka.keyword_id = k.id;

    UPDATE rollout_keyword_assignments SET applied_at = now()
    WHERE rollout_id = p_rollout_id AND stage = v_next_stage;

    EXECUTE format('UPDATE rollout_batches SET current_stage = %s, status = %L, stage_%s_acos = %s WHERE id = %L',
        v_next_stage, 'stage_' || v_next_stage, v_rollout.current_stage, v_current_acos, p_rollout_id);

    RETURN jsonb_build_object('status', 'stage_' || v_next_stage, 'stage_advanced_to', v_next_stage, 'current_acos', v_current_acos);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION rollback_rollout(p_rollout_id uuid)
RETURNS integer AS $$
DECLARE
    v_count integer := 0;
BEGIN
    UPDATE keywords k SET bid = rka.previous_bid, updated_at = now()
    FROM rollout_keyword_assignments rka
    WHERE rka.rollout_id = p_rollout_id AND rka.applied_at IS NOT NULL AND rka.keyword_id = k.id;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    UPDATE rollout_batches SET status = 'rolled_back', completed_at = now()
    WHERE id = p_rollout_id;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_rollout_status(p_campaign_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_rollout record;
    v_stages jsonb;
BEGIN
    SELECT * INTO v_rollout FROM rollout_batches
    WHERE campaign_id = p_campaign_id AND status NOT IN ('completed', 'rolled_back')
    ORDER BY created_at DESC LIMIT 1;

    IF NOT FOUND THEN RETURN jsonb_build_object('active', false); END IF;

    SELECT jsonb_agg(jsonb_build_object(
        'stage', rka.stage,
        'keyword_count', COUNT(*),
        'applied', COUNT(*) FILTER (WHERE rka.applied_at IS NOT NULL)
    )) INTO v_stages
    FROM rollout_keyword_assignments rka
    WHERE rka.rollout_id = v_rollout.id
    GROUP BY rka.stage ORDER BY rka.stage;

    RETURN jsonb_build_object(
        'active', true,
        'rollout_id', v_rollout.id,
        'status', v_rollout.status,
        'current_stage', v_rollout.current_stage,
        'total_keywords', v_rollout.total_keywords,
        'model_type', v_rollout.model_type,
        'pre_acos', v_rollout.pre_acos,
        'stages', v_stages,
        'created_at', v_rollout.created_at
    );
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- UPGRADE 8: A/B Testing for Bid Strategies
-- ============================================================================

CREATE TABLE IF NOT EXISTS bid_experiments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid NOT NULL REFERENCES campaigns(id),
    seller_id uuid NOT NULL REFERENCES sellers(id),
    name text NOT NULL,
    model_a text NOT NULL,
    model_b text NOT NULL,
    split_percent integer NOT NULL DEFAULT 50,
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'completed', 'cancelled')),
    started_at timestamptz,
    ended_at timestamptz,
    winner text,
    confidence_level numeric,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS experiment_keyword_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id uuid NOT NULL REFERENCES bid_experiments(id),
    keyword_id uuid NOT NULL REFERENCES keywords(id),
    experiment_group text NOT NULL CHECK (experiment_group IN ('A', 'B')),
    assigned_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS experiment_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id uuid NOT NULL REFERENCES bid_experiments(id),
    experiment_group text NOT NULL CHECK (experiment_group IN ('A', 'B')),
    metric_date date NOT NULL DEFAULT CURRENT_DATE,
    impressions integer DEFAULT 0,
    clicks integer DEFAULT 0,
    spend numeric DEFAULT 0,
    sales numeric DEFAULT 0,
    orders integer DEFAULT 0,
    acos numeric DEFAULT 0,
    ctr numeric DEFAULT 0,
    cvr numeric DEFAULT 0,
    UNIQUE(experiment_id, experiment_group, metric_date)
);

CREATE OR REPLACE FUNCTION create_experiment(
    p_campaign_id uuid,
    p_name text,
    p_model_a text,
    p_model_b text,
    p_split integer DEFAULT 50
) RETURNS uuid AS $$
DECLARE
    v_exp_id uuid;
    v_seller_id uuid;
    v_keyword record;
    v_counter integer := 0;
    v_total integer;
    v_group_a_count integer;
BEGIN
    SELECT seller_id INTO v_seller_id FROM campaigns WHERE id = p_campaign_id;

    INSERT INTO bid_experiments (campaign_id, seller_id, name, model_a, model_b, split_percent)
    VALUES (p_campaign_id, v_seller_id, p_name, p_model_a, p_model_b, p_split)
    RETURNING id INTO v_exp_id;

    SELECT COUNT(*) INTO v_total FROM keywords WHERE campaign_id = p_campaign_id AND status = 'active';
    v_group_a_count := ROUND(v_total * (p_split / 100.0));

    FOR v_keyword IN
        SELECT id FROM keywords WHERE campaign_id = p_campaign_id AND status = 'active' ORDER BY random()
    LOOP
        v_counter := v_counter + 1;
        INSERT INTO experiment_keyword_assignments (experiment_id, keyword_id, experiment_group)
        VALUES (v_exp_id, v_keyword.id, CASE WHEN v_counter <= v_group_a_count THEN 'A' ELSE 'B' END);
    END LOOP;

    RETURN v_exp_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION start_experiment(p_experiment_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE bid_experiments SET status = 'running', started_at = now() WHERE id = p_experiment_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION stop_experiment(p_experiment_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE bid_experiments SET status = 'completed', ended_at = now() WHERE id = p_experiment_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION analyze_experiment(p_experiment_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_group_a jsonb;
    v_group_b jsonb;
    v_winner text;
    v_confidence numeric;
BEGIN
    SELECT jsonb_build_object(
        'impressions', COALESCE(SUM(impressions), 0),
        'clicks', COALESCE(SUM(clicks), 0),
        'spend', COALESCE(SUM(spend), 0),
        'sales', COALESCE(SUM(sales), 0),
        'orders', COALESCE(SUM(orders), 0),
        'acos', CASE WHEN SUM(sales) > 0 THEN ROUND((SUM(spend) / SUM(sales)) * 100, 2) ELSE 0 END,
        'ctr', CASE WHEN SUM(impressions) > 0 THEN ROUND((SUM(clicks)::numeric / SUM(impressions)) * 100, 4) ELSE 0 END,
        'cvr', CASE WHEN SUM(clicks) > 0 THEN ROUND((SUM(orders)::numeric / SUM(clicks)) * 100, 4) ELSE 0 END,
        'roas', CASE WHEN SUM(spend) > 0 THEN ROUND(SUM(sales) / SUM(spend), 2) ELSE 0 END
    ) INTO v_group_a
    FROM experiment_metrics WHERE experiment_id = p_experiment_id AND experiment_group = 'A';

    SELECT jsonb_build_object(
        'impressions', COALESCE(SUM(impressions), 0),
        'clicks', COALESCE(SUM(clicks), 0),
        'spend', COALESCE(SUM(spend), 0),
        'sales', COALESCE(SUM(sales), 0),
        'orders', COALESCE(SUM(orders), 0),
        'acos', CASE WHEN SUM(sales) > 0 THEN ROUND((SUM(spend) / SUM(sales)) * 100, 2) ELSE 0 END,
        'ctr', CASE WHEN SUM(impressions) > 0 THEN ROUND((SUM(clicks)::numeric / SUM(impressions)) * 100, 4) ELSE 0 END,
        'cvr', CASE WHEN SUM(clicks) > 0 THEN ROUND((SUM(orders)::numeric / SUM(clicks)) * 100, 4) ELSE 0 END,
        'roas', CASE WHEN SUM(spend) > 0 THEN ROUND(SUM(sales) / SUM(spend), 2) ELSE 0 END
    ) INTO v_group_b
    FROM experiment_metrics WHERE experiment_id = p_experiment_id AND experiment_group = 'B';

    v_winner := CASE
        WHEN (v_group_a->>'roas')::numeric > (v_group_b->>'roas')::numeric THEN 'A'
        WHEN (v_group_b->>'roas')::numeric > (v_group_a->>'roas')::numeric THEN 'B'
        ELSE 'tie'
    END;

    v_confidence := LEAST(0.99, GREATEST(0.5,
        0.5 + (ABS((v_group_a->>'roas')::numeric - (v_group_b->>'roas')::numeric) /
               GREATEST(((v_group_a->>'roas')::numeric + (v_group_b->>'roas')::numeric) / 2, 0.01)) * 0.5
    ));

    UPDATE bid_experiments SET winner = v_winner, confidence_level = v_confidence WHERE id = p_experiment_id;

    RETURN jsonb_build_object(
        'group_a', v_group_a,
        'group_b', v_group_b,
        'winner', v_winner,
        'confidence', ROUND(v_confidence * 100, 1),
        'model_a', (SELECT model_a FROM bid_experiments WHERE id = p_experiment_id),
        'model_b', (SELECT model_b FROM bid_experiments WHERE id = p_experiment_id)
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION record_experiment_metrics(p_experiment_id uuid)
RETURNS integer AS $$
DECLARE
    v_exp record;
    v_group text;
    v_metrics record;
    v_count integer := 0;
BEGIN
    SELECT * INTO v_exp FROM bid_experiments WHERE id = p_experiment_id;
    IF NOT FOUND OR v_exp.status != 'running' THEN RETURN 0; END IF;

    FOR v_group IN VALUES ('A'), ('B')
    LOOP
        SELECT
            COALESCE(SUM(k.impressions), 0) AS impressions,
            COALESCE(SUM(k.clicks), 0) AS clicks,
            COALESCE(SUM(k.spend), 0) AS spend,
            COALESCE(SUM(k.sales), 0) AS sales,
            COALESCE(SUM(k.orders), 0) AS orders
        INTO v_metrics
        FROM keywords k
        JOIN experiment_keyword_assignments eka ON eka.keyword_id = k.id
        WHERE eka.experiment_id = p_experiment_id AND eka.experiment_group = v_group;

        INSERT INTO experiment_metrics (experiment_id, experiment_group, metric_date, impressions, clicks, spend, sales, orders, acos, ctr, cvr)
        VALUES (
            p_experiment_id, v_group, CURRENT_DATE,
            v_metrics.impressions, v_metrics.clicks, v_metrics.spend, v_metrics.sales, v_metrics.orders,
            CASE WHEN v_metrics.sales > 0 THEN ROUND((v_metrics.spend / v_metrics.sales) * 100, 2) ELSE 0 END,
            CASE WHEN v_metrics.impressions > 0 THEN ROUND((v_metrics.clicks::numeric / v_metrics.impressions) * 100, 4) ELSE 0 END,
            CASE WHEN v_metrics.clicks > 0 THEN ROUND((v_metrics.orders::numeric / v_metrics.clicks) * 100, 4) ELSE 0 END
        )
        ON CONFLICT (experiment_id, experiment_group, metric_date)
        DO UPDATE SET impressions = EXCLUDED.impressions, clicks = EXCLUDED.clicks, spend = EXCLUDED.spend,
                      sales = EXCLUDED.sales, orders = EXCLUDED.orders, acos = EXCLUDED.acos,
                      ctr = EXCLUDED.ctr, cvr = EXCLUDED.cvr;

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- UPGRADE 6: Competitor-Aware Bid Adjustments
-- ============================================================================

CREATE OR REPLACE FUNCTION estimate_competitor_bids(p_campaign_id uuid)
RETURNS TABLE(
    keyword_id uuid,
    keyword_text text,
    current_bid numeric,
    estimated_competitor_low numeric,
    estimated_competitor_mid numeric,
    estimated_competitor_high numeric,
    competition_level text
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        k.id,
        k.keyword_text,
        k.bid,
        ROUND(k.bid * 0.7, 2) AS est_low,
        ROUND(k.bid * 1.0, 2) AS est_mid,
        ROUND(k.bid * 1.4, 2) AS est_high,
        CASE
            WHEN k.impressions > 0 AND (k.clicks::numeric / k.impressions) < 0.01 THEN 'high'
            WHEN k.impressions > 0 AND (k.clicks::numeric / k.impressions) < 0.03 THEN 'medium'
            ELSE 'low'
        END
    FROM keywords k
    WHERE k.campaign_id = p_campaign_id AND k.status = 'active'
    ORDER BY k.spend DESC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION simulate_auction(
    p_keyword_id uuid,
    p_bid numeric,
    p_num_simulations integer DEFAULT 1000
) RETURNS jsonb AS $$
DECLARE
    v_keyword record;
    v_wins integer := 0;
    v_total_position numeric := 0;
    v_total_cpc numeric := 0;
    v_competitor_bid numeric;
    v_i integer;
BEGIN
    SELECT * INTO v_keyword FROM keywords WHERE id = p_keyword_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Keyword not found'); END IF;

    FOR v_i IN 1..p_num_simulations LOOP
        v_competitor_bid := v_keyword.bid * (0.5 + random() * 1.0);
        IF p_bid >= v_competitor_bid THEN
            v_wins := v_wins + 1;
            v_total_position := v_total_position + 1;
            v_total_cpc := v_total_cpc + LEAST(p_bid, v_competitor_bid + 0.01);
        ELSE
            v_total_position := v_total_position + 2 + floor(random() * 3);
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'keyword_id', p_keyword_id,
        'test_bid', p_bid,
        'simulations', p_num_simulations,
        'estimated_win_rate', ROUND((v_wins::numeric / p_num_simulations) * 100, 1),
        'estimated_avg_position', ROUND(v_total_position / p_num_simulations, 1),
        'estimated_avg_cpc', CASE WHEN v_wins > 0 THEN ROUND(v_total_cpc / v_wins, 2) ELSE p_bid END
    );
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- UPGRADE 2: Portfolio-Level Budget Optimizer
-- ============================================================================

CREATE OR REPLACE FUNCTION optimize_portfolio_budget(p_seller_id uuid, p_total_budget numeric)
RETURNS TABLE(
    campaign_id uuid,
    campaign_name text,
    current_budget numeric,
    recommended_budget numeric,
    budget_change numeric,
    current_roas numeric,
    marginal_roas numeric,
    expected_roas numeric
) AS $$
BEGIN
    RETURN QUERY
    WITH campaign_stats AS (
        SELECT
            c.id,
            c.name,
            c.daily_budget,
            c.spend,
            c.sales,
            CASE WHEN c.spend > 0 THEN c.sales / c.spend ELSE 0 END AS roas,
            CASE WHEN c.spend > 0 THEN c.sales / c.spend ELSE 0 END AS m_roas
        FROM campaigns c
        WHERE c.seller_id = p_seller_id AND c.status = 'active'
    ),
    total_mroas AS (
        SELECT SUM(m_roas) AS total FROM campaign_stats
    ),
    allocations AS (
        SELECT
            cs.id,
            cs.name,
            cs.daily_budget,
            cs.roas,
            cs.m_roas,
            CASE WHEN tm.total > 0
                THEN ROUND(p_total_budget * (cs.m_roas / tm.total), 2)
                ELSE ROUND(p_total_budget / GREATEST((SELECT COUNT(*) FROM campaign_stats), 1), 2)
            END AS rec_budget
        FROM campaign_stats cs, total_mroas tm
    )
    SELECT
        a.id,
        a.name,
        a.daily_budget,
        a.rec_budget,
        ROUND(a.rec_budget - a.daily_budget, 2),
        ROUND(a.roas, 2),
        ROUND(a.m_roas, 2),
        ROUND(a.roas * (a.rec_budget / GREATEST(a.daily_budget, 0.01)), 2)
    FROM allocations a
    ORDER BY a.m_roas DESC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION simulate_budget_change(p_seller_id uuid, p_additional_budget numeric)
RETURNS jsonb AS $$
DECLARE
    v_current_total numeric;
    v_result jsonb;
BEGIN
    SELECT COALESCE(SUM(daily_budget), 0) INTO v_current_total
    FROM campaigns WHERE seller_id = p_seller_id AND status = 'active';

    SELECT jsonb_agg(jsonb_build_object(
        'campaign_id', r.campaign_id,
        'campaign_name', r.campaign_name,
        'current_budget', r.current_budget,
        'recommended_budget', r.recommended_budget,
        'budget_change', r.budget_change,
        'expected_roas', r.expected_roas
    )) INTO v_result
    FROM optimize_portfolio_budget(p_seller_id, v_current_total + p_additional_budget) r;

    RETURN jsonb_build_object(
        'current_total_budget', v_current_total,
        'new_total_budget', v_current_total + p_additional_budget,
        'additional_budget', p_additional_budget,
        'allocations', COALESCE(v_result, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql;
