import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    campaignApi,
    thompsonApi,
    qLearningApi,
    ensembleApi,
    guardrailApi,
    negativeKeywordApi,
    daypartingApi,
    rolloutApi,
    competitorApi,
} from '../api/client';
import type {
    BidRecommendation,
    QLearningRecommendation,
    EnsembleRecommendation,
} from '../api/client';
import type {
    Campaign,
    NegativeKeywordSuggestion,
    DaypartingHour,
    RolloutStatus,
    BatchHistory,
} from '../types';
import { exportToCsv } from '../utils/export';
import ModelLeaderboard from '../components/ModelLeaderboard';
import { TabButton, ConfidenceBar, HealthBadge, CompetitionBadge, Spinner } from '../components/optimization/OptimizationHelpers';

// ─── Types ───

type OptimizationTab =
    | 'thompson'
    | 'q-learning'
    | 'ensemble'
    | 'waste-finder'
    | 'dayparting'
    | 'rollout'
    | 'leaderboard';

interface BatchResult {
    applied: number;
    clipped: number;
    batchId: string;
}

interface ConfirmModalState {
    open: boolean;
    count: number;
    projectedSpendChange: number | null;
    loading: boolean;
}

// ─── Main Component ───

export default function Optimization() {
    const [searchParams, setSearchParams] = useSearchParams();

    // ── Shared state ──
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [selectedCampaign, setSelectedCampaign] = useState(searchParams.get('campaign') ?? '');
    const [activeTab, setActiveTab] = useState<OptimizationTab>('thompson');

    // Cache loaded tab data so switching tabs doesn't re-fetch
    const tabCache = useRef<Partial<Record<OptimizationTab, unknown>>>({});
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState<'success' | 'error'>('success');

    // ── Model tab state ──
    const [thompsonRecs, setThompsonRecs] = useState<BidRecommendation[]>([]);
    const [qLearningRecs, setQLearningRecs] = useState<QLearningRecommendation[]>([]);
    const [ensembleRecs, setEnsembleRecs] = useState<EnsembleRecommendation[]>([]);
    const [loading, setLoading] = useState(false);
    const [applying, setApplying] = useState(false);
    const [applied, setApplied] = useState<Set<string>>(new Set());
    const [batchResult, setBatchResult] = useState<BatchResult | null>(null);

    // ── Confirm modal ──
    const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
        open: false,
        count: 0,
        projectedSpendChange: null,
        loading: false,
    });

    // ── Batch history ──
    const [showHistory, setShowHistory] = useState(false);
    const [batchHistory, setBatchHistory] = useState<BatchHistory[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [rollingBack, setRollingBack] = useState<string | null>(null);

    // ── Waste finder state ──
    const [wasteSuggestions, setWasteSuggestions] = useState<NegativeKeywordSuggestion[]>([]);
    const [wasteLoading, setWasteLoading] = useState(false);
    const [wasteApplied, setWasteApplied] = useState<Set<string>>(new Set());
    const [wasteDismissed, setWasteDismissed] = useState<Set<string>>(new Set());

    // ── Dayparting state ──
    const [daypartHours, setDaypartHours] = useState<DaypartingHour[]>([]);
    const [daypartLoading, setDaypartLoading] = useState(false);
    const [selectedHour, setSelectedHour] = useState<DaypartingHour | null>(null);

    // ── Rollout state ──
    const [rolloutStatus, setRolloutStatus] = useState<RolloutStatus | null>(null);
    const [rolloutLoading, setRolloutLoading] = useState(false);
    const [rolloutActioning, setRolloutActioning] = useState(false);

    // ── Load campaigns ──
    useEffect(() => {
        campaignApi.getCampaigns().then(loaded => {
            setCampaigns(loaded);
            // Validate URL param — reject any campaign ID not in the user's list
            const ids = new Set(loaded.map(c => c.id));
            if (selectedCampaign && !ids.has(selectedCampaign)) {
                setSelectedCampaign('');
                setSearchParams({}, { replace: true });
            }
        }).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Clear state on campaign/tab change ──
    useEffect(() => {
        setThompsonRecs([]);
        setQLearningRecs([]);
        setEnsembleRecs([]);
        setApplied(new Set());
        setBatchResult(null);
        setMessage('');
        setWasteSuggestions([]);
        setWasteApplied(new Set());
        setWasteDismissed(new Set());
        setDaypartHours([]);
        setSelectedHour(null);
        setRolloutStatus(null);
    }, [selectedCampaign, activeTab]);

    // ── Load rollout status when tab opens ──
    useEffect(() => {
        if (activeTab === 'rollout' && selectedCampaign) {
            setRolloutLoading(true);
            rolloutApi
                .getRolloutStatus(selectedCampaign)
                .then(setRolloutStatus)
                .catch(() => setRolloutStatus(null))
                .finally(() => setRolloutLoading(false));
        }
    }, [activeTab, selectedCampaign]);

    // ── Tab config ──
    const tabConfig: Record<
        OptimizationTab,
        { title: string; subtitle: string }
    > = {
        thompson: { title: 'Model Alpha', subtitle: 'Primary optimizer' },
        'q-learning': { title: 'Model Bravo', subtitle: 'Adaptive optimizer' },
        ensemble: { title: 'Combined Model', subtitle: 'Multi-model blend' },
        'waste-finder': { title: 'Waste Finder', subtitle: 'Negative keyword discovery' },
        dayparting: { title: 'Dayparting', subtitle: 'Time-of-day bid modifiers' },
        rollout: { title: 'Staged Rollout', subtitle: 'Progressive deployment' },
        leaderboard: { title: 'Model Performance', subtitle: 'Model tracking' },
    };

    const modelTabs: OptimizationTab[] = ['thompson', 'q-learning', 'ensemble'];
    const isModelTab = modelTabs.includes(activeTab);

    // ── Current recs for model tabs ──
    const currentRecs: (BidRecommendation | QLearningRecommendation | EnsembleRecommendation)[] =
        activeTab === 'thompson'
            ? thompsonRecs
            : activeTab === 'q-learning'
              ? qLearningRecs
              : ensembleRecs;

    const changedRecs = currentRecs.filter(
        (r) => r.recommended_bid !== r.current_bid
    );

    const modelNameForApi =
        activeTab === 'thompson'
            ? 'thompson'
            : activeTab === 'q-learning'
              ? 'q_learning'
              : 'ensemble';

    // ── Generate recommendations ──
    const handleGenerate = async () => {
        if (!selectedCampaign) return;

        // Return cached results for this tab if available
        if (tabCache.current[activeTab]) {
            if (activeTab === 'thompson') setThompsonRecs(tabCache.current['thompson'] as BidRecommendation[]);
            else if (activeTab === 'q-learning') setQLearningRecs(tabCache.current['q-learning'] as QLearningRecommendation[]);
            else if (activeTab === 'ensemble') setEnsembleRecs(tabCache.current['ensemble'] as EnsembleRecommendation[]);
            return;
        }

        setLoading(true);
        setApplied(new Set());
        setBatchResult(null);
        setMessage('');
        try {
            if (activeTab === 'thompson') {
                const recs = await thompsonApi.getCampaignRecommendations(selectedCampaign);
                setThompsonRecs(recs);
                tabCache.current['thompson'] = recs;
            } else if (activeTab === 'q-learning') {
                const recs = await qLearningApi.getCampaignRecommendations(selectedCampaign);
                setQLearningRecs(recs);
                tabCache.current['q-learning'] = recs;
            } else if (activeTab === 'ensemble') {
                const recs = await ensembleApi.getCampaignRecommendations(selectedCampaign);
                setEnsembleRecs(recs);
                tabCache.current['ensemble'] = recs;
            }
        } catch (error) {
            console.error('Failed to generate recommendations:', error);
            showMessage('Failed to generate recommendations', 'error');
        } finally {
            setLoading(false);
        }
    };

    // ── Show message helper ──
    const showMessage = (msg: string, type: 'success' | 'error' = 'success') => {
        setMessage(msg);
        setMessageType(type);
    };

    // ── Apply single recommendation ──
    const handleApplyOne = async (rec: any) => {
        try {
            if (activeTab === 'thompson')
                await thompsonApi.applyRecommendation(rec.keyword_id, rec.recommended_bid);
            else if (activeTab === 'q-learning')
                await qLearningApi.applyRecommendation(rec.keyword_id, rec.recommended_bid);
            else
                await ensembleApi.applyRecommendation(rec.keyword_id, rec.recommended_bid);
            setApplied((prev) => new Set(prev).add(rec.keyword_id));
        } catch (error) {
            console.error('Failed to apply:', error);
        }
    };

    // ── Open confirmation modal for Apply All with Guardrails ──
    const handleOpenConfirmModal = async () => {
        const unapplied = changedRecs.filter(
            (r) => !applied.has(r.keyword_id)
        );
        if (unapplied.length === 0) return;

        setConfirmModal({ open: true, count: unapplied.length, projectedSpendChange: null, loading: true });

        try {
            const projected = await guardrailApi.getProjectedSpend(
                selectedCampaign,
                unapplied.map((r) => ({
                    keyword_id: r.keyword_id,
                    recommended_bid: r.recommended_bid,
                }))
            );
            setConfirmModal((prev) => ({
                ...prev,
                projectedSpendChange: projected.spend_change_percent,
                loading: false,
            }));
        } catch {
            setConfirmModal((prev) => ({ ...prev, loading: false }));
        }
    };

    // ── Apply all with guardrails (after confirmation) ──
    const handleApplyAllGuardrails = async () => {
        setConfirmModal((prev) => ({ ...prev, open: false }));
        setApplying(true);
        setBatchResult(null);
        try {
            const unapplied = changedRecs.filter(
                (r) => !applied.has(r.keyword_id)
            );
            const result = await guardrailApi.applyAllWithGuardrails(
                unapplied.map((r) => ({
                    keyword_id: r.keyword_id,
                    recommended_bid: r.recommended_bid,
                    current_bid: r.current_bid,
                })),
                modelNameForApi
            );
            setApplied(new Set(currentRecs.map((r) => r.keyword_id)));
            setBatchResult(result);
            // Invalidate cache for this tab so next Generate fetches fresh bids
            delete tabCache.current[activeTab];
            showMessage(
                `Applied ${result.applied} bids (${result.clipped} clipped by guardrails) via ${tabConfig[activeTab].title}`
            );
        } catch (error) {
            console.error('Failed to apply all:', error);
            showMessage('Failed to apply changes', 'error');
        } finally {
            setApplying(false);
        }
    };

    // ── Batch history ──
    const loadBatchHistory = useCallback(async () => {
        setHistoryLoading(true);
        try {
            setBatchHistory(await guardrailApi.getBatchHistory());
        } catch (error) {
            console.error('Failed to load batch history:', error);
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    const handleToggleHistory = () => {
        if (!showHistory) loadBatchHistory();
        setShowHistory(!showHistory);
    };

    const handleRollback = async (batchId: string) => {
        setRollingBack(batchId);
        try {
            const count = await guardrailApi.rollbackBatch(batchId);
            showMessage(`Rolled back ${count} keyword bids`);
            loadBatchHistory();
        } catch (error) {
            console.error('Failed to rollback:', error);
            showMessage('Rollback failed', 'error');
        } finally {
            setRollingBack(null);
        }
    };

    // ── Waste finder ──
    const handleDiscoverWaste = async () => {
        if (!selectedCampaign) return;
        setWasteLoading(true);
        setMessage('');
        try {
            setWasteSuggestions(await negativeKeywordApi.discover(selectedCampaign));
        } catch (error) {
            console.error('Failed to discover waste:', error);
            showMessage('Failed to discover waste keywords', 'error');
        } finally {
            setWasteLoading(false);
        }
    };

    const handleApplyNegative = async (id: string) => {
        try {
            await negativeKeywordApi.applySuggestion(id);
            setWasteApplied((prev) => new Set(prev).add(id));
        } catch (error) {
            console.error('Failed to apply negative keyword:', error);
        }
    };

    const handleDismissNegative = async (id: string) => {
        try {
            await negativeKeywordApi.dismissSuggestion(id);
            setWasteDismissed((prev) => new Set(prev).add(id));
        } catch (error) {
            console.error('Failed to dismiss suggestion:', error);
        }
    };

    // ── Dayparting ──
    const handleComputeSchedule = async () => {
        if (!selectedCampaign) return;
        setDaypartLoading(true);
        setMessage('');
        try {
            setDaypartHours(await daypartingApi.computeSchedule(selectedCampaign));
        } catch (error) {
            console.error('Failed to compute schedule:', error);
            showMessage('Failed to compute dayparting schedule', 'error');
        } finally {
            setDaypartLoading(false);
        }
    };

    // ── Rollout ──
    const handleStartRollout = async () => {
        if (!selectedCampaign) return;
        setRolloutActioning(true);
        try {
            // Generate ensemble recs first
            const recs = await ensembleApi.getCampaignRecommendations(selectedCampaign);
            const changed = recs.filter((r) => r.recommended_bid !== r.current_bid);
            if (changed.length === 0) {
                showMessage('No bid changes to roll out', 'error');
                return;
            }
            await rolloutApi.createRollout(
                selectedCampaign,
                'ensemble',
                changed.map((r) => ({
                    keyword_id: r.keyword_id,
                    recommended_bid: r.recommended_bid,
                }))
            );
            const status = await rolloutApi.getRolloutStatus(selectedCampaign);
            setRolloutStatus(status);
            showMessage('Staged rollout created successfully');
        } catch (error) {
            console.error('Failed to create rollout:', error);
            showMessage('Failed to create rollout', 'error');
        } finally {
            setRolloutActioning(false);
        }
    };

    const handleAdvanceStage = async () => {
        if (!rolloutStatus?.rollout_id) return;
        setRolloutActioning(true);
        try {
            const result = await rolloutApi.advanceStage(rolloutStatus.rollout_id);
            if (result.status === 'advanced') {
                showMessage(`Advanced to stage ${result.stage_advanced_to}`);
            } else {
                showMessage(result.reason || 'Cannot advance stage', 'error');
            }
            const status = await rolloutApi.getRolloutStatus(selectedCampaign);
            setRolloutStatus(status);
        } catch (error) {
            console.error('Failed to advance stage:', error);
            showMessage('Failed to advance stage', 'error');
        } finally {
            setRolloutActioning(false);
        }
    };

    const handleRollbackRollout = async () => {
        if (!rolloutStatus?.rollout_id) return;
        setRolloutActioning(true);
        try {
            const count = await rolloutApi.rollbackRollout(rolloutStatus.rollout_id);
            showMessage(`Rolled back ${count} keywords`);
            const status = await rolloutApi.getRolloutStatus(selectedCampaign);
            setRolloutStatus(status);
        } catch (error) {
            console.error('Failed to rollback rollout:', error);
            showMessage('Rollback failed', 'error');
        } finally {
            setRolloutActioning(false);
        }
    };

    // ── Waste finder computed values ──
    const visibleWaste = wasteSuggestions.filter(
        (s) => !wasteApplied.has(s.id) && !wasteDismissed.has(s.id)
    );
    const totalWastedSpend = visibleWaste.reduce((s, w) => s + w.total_spend, 0);
    const totalPotentialSavings = visibleWaste.reduce(
        (s, w) => s + w.estimated_savings_30d,
        0
    );

    // ── Render ──
    return (
        <div className="min-h-screen p-6 lg:p-8 space-y-5">
            {/* ── Header ── */}
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-wider">
                        <span className="text-prime-energon">Bid</span>{' '}
                        <span className="text-prime-silver">Optimization</span>
                    </h1>
                    <p className="text-prime-gunmetal text-xs mt-1 uppercase tracking-widest font-semibold">
                        AI-driven bid optimization and recommendations
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {isModelTab && currentRecs.length > 0 && (
                        <button
                            onClick={() =>
                                exportToCsv(`bids-${activeTab}-export`, currentRecs)
                            }
                            className="px-4 py-2 bg-prime-dark border border-prime-gunmetal/30 text-prime-gunmetal text-xs font-bold uppercase tracking-widest hover:text-prime-silver hover:border-prime-gunmetal transition-all chamfer-sm"
                        >
                            Export CSV
                        </button>
                    )}
                    {isModelTab && (
                        <button
                            onClick={handleToggleHistory}
                            className={`px-4 py-2 border text-xs font-bold uppercase tracking-widest transition-all chamfer-sm ${
                                showHistory
                                    ? 'bg-prime-darker border-prime-energon/30 text-prime-energon'
                                    : 'bg-prime-dark border-prime-gunmetal/30 text-prime-gunmetal hover:text-prime-silver hover:border-prime-gunmetal'
                            }`}
                        >
                            History
                        </button>
                    )}
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="flex gap-2 flex-wrap">
                {(Object.keys(tabConfig) as OptimizationTab[]).map((tab) => (
                    <TabButton
                        key={tab}
                        active={activeTab === tab}
                        onClick={() => setActiveTab(tab)}
                        title={tabConfig[tab].title}
                        subtitle={tabConfig[tab].subtitle}
                    />
                ))}
            </div>

            {/* ── Campaign Selector (tabs 1-6) ── */}
            {activeTab !== 'leaderboard' && (
                <div className="bg-prime-dark/80 backdrop-blur-sm border border-prime-energon/15 p-5 chamfer">
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-[10px] font-bold text-prime-gunmetal mb-2 uppercase tracking-widest">
                                Campaign
                            </label>
                            <select
                                value={selectedCampaign}
                                onChange={(e) => {
                                    setSelectedCampaign(e.target.value);
                                    tabCache.current = {};
                                    if (e.target.value) {
                                        setSearchParams({ campaign: e.target.value }, { replace: true });
                                    } else {
                                        setSearchParams({}, { replace: true });
                                    }
                                }}
                                className="input"
                            >
                                <option value="">Select a campaign...</option>
                                {campaigns
                                    .filter((c) => c.status === 'active')
                                    .map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        {/* Model tab buttons */}
                        {isModelTab && (
                            <>
                                <button
                                    onClick={handleGenerate}
                                    disabled={!selectedCampaign || loading}
                                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading
                                        ? 'Analyzing...'
                                        : `Run ${tabConfig[activeTab].title}`}
                                </button>
                                {changedRecs.length > 0 && (
                                    <button
                                        onClick={handleOpenConfirmModal}
                                        disabled={
                                            applying ||
                                            applied.size === currentRecs.length
                                        }
                                        className="px-6 py-2.5 bg-emerald-500 text-white font-bold text-xs uppercase tracking-widest hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all chamfer-sm"
                                    >
                                        {applying
                                            ? 'Applying...'
                                            : 'Apply All with Guardrails'}
                                    </button>
                                )}
                            </>
                        )}

                        {/* Waste finder button */}
                        {activeTab === 'waste-finder' && (
                            <button
                                onClick={handleDiscoverWaste}
                                disabled={!selectedCampaign || wasteLoading}
                                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {wasteLoading ? 'Scanning...' : 'Discover Waste'}
                            </button>
                        )}

                        {/* Dayparting button */}
                        {activeTab === 'dayparting' && (
                            <button
                                onClick={handleComputeSchedule}
                                disabled={!selectedCampaign || daypartLoading}
                                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {daypartLoading ? 'Computing...' : 'Compute Schedule'}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ── Messages ── */}
            {message && (
                <div
                    className={`px-4 py-3 text-sm chamfer-sm ${
                        messageType === 'success'
                            ? 'bg-emerald-500/5 border border-emerald-500/20 text-emerald-400'
                            : 'bg-red-500/5 border border-red-500/20 text-red-400'
                    }`}
                >
                    {message}
                </div>
            )}

            {/* ── Batch Result ── */}
            {batchResult && (
                <div className="bg-prime-dark/80 border border-emerald-500/20 p-4 chamfer-sm flex items-center gap-6">
                    <div>
                        <span className="text-[10px] text-prime-gunmetal uppercase tracking-widest">Applied</span>
                        <div className="text-emerald-400 font-bold text-lg">{batchResult.applied}</div>
                    </div>
                    <div>
                        <span className="text-[10px] text-prime-gunmetal uppercase tracking-widest">Clipped</span>
                        <div className="text-yellow-400 font-bold text-lg">{batchResult.clipped}</div>
                    </div>
                    <div>
                        <span className="text-[10px] text-prime-gunmetal uppercase tracking-widest">Batch ID</span>
                        <div className="text-prime-silver font-mono text-xs">{batchResult.batchId.slice(0, 8)}...</div>
                    </div>
                </div>
            )}

            {/* ── Confirm Modal ── */}
            {confirmModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-prime-darker border border-prime-energon/20 p-6 chamfer w-full max-w-md space-y-4">
                        <h3 className="text-sm font-bold text-prime-silver uppercase tracking-widest">
                            Confirm Apply All
                        </h3>
                        <p className="text-prime-gunmetal text-sm">
                            You are about to apply bid changes to{' '}
                            <span className="text-prime-energon font-bold">
                                {confirmModal.count}
                            </span>{' '}
                            keywords with guardrail protection.
                        </p>
                        {confirmModal.loading ? (
                            <div className="flex items-center gap-2 text-prime-gunmetal text-xs">
                                <div className="w-4 h-4 border border-prime-energon/30 border-t-prime-energon rounded-full animate-spin" />
                                Calculating projected spend...
                            </div>
                        ) : confirmModal.projectedSpendChange !== null ? (
                            <div className="bg-prime-black/40 p-3 chamfer-sm">
                                <span className="text-[10px] text-prime-gunmetal uppercase tracking-widest">
                                    Projected Daily Spend Change
                                </span>
                                <div
                                    className={`font-bold text-lg ${
                                        confirmModal.projectedSpendChange > 0
                                            ? 'text-red-400'
                                            : 'text-emerald-400'
                                    }`}
                                >
                                    {confirmModal.projectedSpendChange > 0 ? '+' : ''}
                                    {confirmModal.projectedSpendChange.toFixed(1)}%
                                </div>
                            </div>
                        ) : null}
                        <div className="flex gap-3 justify-end pt-2">
                            <button
                                onClick={() =>
                                    setConfirmModal((prev) => ({ ...prev, open: false }))
                                }
                                className="px-4 py-2 border border-prime-gunmetal/30 text-prime-gunmetal text-xs font-bold uppercase tracking-widest hover:text-prime-silver transition-all chamfer-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleApplyAllGuardrails}
                                className="px-6 py-2 bg-emerald-500 text-white text-xs font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all chamfer-sm"
                            >
                                Confirm Apply
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Batch History Panel ── */}
            {showHistory && isModelTab && (
                <div className="bg-prime-dark/80 backdrop-blur-sm border border-prime-gunmetal/30 p-6 chamfer">
                    <h3 className="text-sm font-bold text-prime-silver uppercase tracking-widest mb-4">
                        Batch History
                    </h3>
                    {historyLoading ? (
                        <div className="text-center py-6">
                            <div className="w-6 h-6 border border-prime-energon/30 border-t-prime-energon rounded-full animate-spin mx-auto" />
                        </div>
                    ) : batchHistory.length === 0 ? (
                        <p className="text-prime-gunmetal text-xs uppercase tracking-widest text-center py-4">
                            No batch history found
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-prime-gunmetal/20 text-prime-gunmetal">
                                        <th className="text-left py-2 px-2 text-[10px] uppercase tracking-widest">Model</th>
                                        <th className="text-right py-2 px-2 text-[10px] uppercase tracking-widest">Keywords</th>
                                        <th className="text-right py-2 px-2 text-[10px] uppercase tracking-widest">Clipped</th>
                                        <th className="text-right py-2 px-2 text-[10px] uppercase tracking-widest">Avg Change</th>
                                        <th className="text-right py-2 px-2 text-[10px] uppercase tracking-widest">Date</th>
                                        <th className="text-right py-2 px-2 text-[10px] uppercase tracking-widest">Status</th>
                                        <th className="text-right py-2 px-2 text-[10px] uppercase tracking-widest">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {batchHistory.map((batch) => (
                                        <tr
                                            key={batch.batch_id}
                                            className="border-b border-prime-gunmetal/10 hover:bg-prime-darker/50"
                                        >
                                            <td className="py-2 px-2 text-prime-silver font-semibold">
                                                {batch.model_used}
                                            </td>
                                            <td className="py-2 px-2 text-right text-prime-gunmetal">
                                                {batch.keyword_count}
                                            </td>
                                            <td className="py-2 px-2 text-right text-yellow-400">
                                                {batch.total_clipped}
                                            </td>
                                            <td className="py-2 px-2 text-right text-prime-gunmetal">
                                                {batch.avg_change_percent.toFixed(1)}%
                                            </td>
                                            <td className="py-2 px-2 text-right text-prime-gunmetal text-xs">
                                                {new Date(batch.applied_at).toLocaleDateString()}
                                            </td>
                                            <td className="py-2 px-2 text-right">
                                                {batch.is_rolled_back ? (
                                                    <span className="text-[9px] text-red-400 font-bold uppercase tracking-widest">
                                                        Rolled Back
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest">
                                                        Active
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-2 px-2 text-right">
                                                <button
                                                    onClick={() => handleRollback(batch.batch_id)}
                                                    disabled={
                                                        batch.is_rolled_back ||
                                                        rollingBack === batch.batch_id
                                                    }
                                                    className="text-xs px-3 py-1 border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors font-bold uppercase tracking-wider chamfer-sm disabled:opacity-30 disabled:cursor-not-allowed"
                                                >
                                                    {rollingBack === batch.batch_id
                                                        ? 'Rolling back...'
                                                        : 'Rollback'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════════════════════════════════════
                 MODEL TABS: Thompson / Q-Learning / Ensemble
                 ═══════════════════════════════════════════ */}
            {isModelTab && (
                <>
                    {loading && (
                        <Spinner
                            text="Analyzing bid performance..."
                            subtext="Evaluating keyword data and generating recommendations"
                        />
                    )}

                    {!loading && currentRecs.length > 0 && (
                        <div className="bg-prime-dark/80 backdrop-blur-sm border border-prime-gunmetal/30 p-6 chamfer">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-sm font-bold text-prime-silver uppercase tracking-widest flex items-center gap-3">
                                    {tabConfig[activeTab].title} Recommendations
                                    <span className="text-[10px] px-2 py-0.5 bg-prime-black/50 text-prime-gunmetal font-semibold chamfer-sm">
                                        {currentRecs.length} keywords
                                    </span>
                                </h3>
                                {currentRecs.length - changedRecs.length > 0 && (
                                    <span className="text-[10px] text-prime-gunmetal uppercase tracking-widest">
                                        {currentRecs.length - changedRecs.length} keywords
                                        optimal
                                    </span>
                                )}
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-prime-gunmetal/20 text-prime-gunmetal">
                                            <th className="text-left py-3 px-2 text-[10px] uppercase tracking-widest">
                                                Keyword
                                            </th>
                                            <th className="text-center py-3 px-2 text-[10px] uppercase tracking-widest">
                                                Health
                                            </th>
                                            <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">
                                                Current Bid
                                            </th>
                                            <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">
                                                Recommended
                                            </th>
                                            <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">
                                                Change%
                                            </th>
                                            <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">
                                                Multiplier
                                            </th>
                                            {activeTab === 'ensemble' ? (
                                                <>
                                                    <th className="text-right py-3 px-2 w-[140px] text-[10px] uppercase tracking-widest">
                                                        Blend
                                                    </th>
                                                    <th className="text-center py-3 px-2 text-[10px] uppercase tracking-widest">
                                                        Competition
                                                    </th>
                                                </>
                                            ) : (
                                                <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">
                                                    {activeTab === 'thompson'
                                                        ? 'Confidence'
                                                        : 'Q-Value'}
                                                </th>
                                            )}
                                            <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">
                                                Action
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentRecs.map((rec: any) => {
                                            const changePercent =
                                                ((rec.recommended_bid - rec.current_bid) /
                                                    rec.current_bid) *
                                                100;
                                            const isApplied = applied.has(rec.keyword_id);
                                            const noChange =
                                                rec.recommended_bid === rec.current_bid;

                                            return (
                                                <tr
                                                    key={rec.keyword_id}
                                                    className={`border-b border-prime-gunmetal/10 transition-colors ${
                                                        isApplied
                                                            ? 'bg-emerald-500/5'
                                                            : 'hover:bg-prime-darker/50'
                                                    }`}
                                                >
                                                    <td className="py-3 px-2">
                                                        <div className="text-prime-silver font-semibold">
                                                            {rec.keyword_text}
                                                        </div>
                                                        {activeTab === 'q-learning' && (
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[10px] text-prime-blue font-mono bg-prime-blue/10 px-1 chamfer-sm">
                                                                    State: {rec.state_bucket}
                                                                </span>
                                                                {rec.is_explore && (
                                                                    <span className="text-[10px] text-prime-gold font-mono bg-prime-gold/10 px-1 chamfer-sm">
                                                                        Exploring
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-2 text-center align-top">
                                                        <HealthBadge status={rec.health_status} />
                                                    </td>
                                                    <td className="py-3 px-2 text-right text-prime-gunmetal align-top">
                                                        ${rec.current_bid.toFixed(2)}
                                                    </td>
                                                    <td className="py-3 px-2 text-right font-bold text-prime-energon align-top">
                                                        ${rec.recommended_bid.toFixed(2)}
                                                    </td>
                                                    <td className="py-3 px-2 text-right align-top">
                                                        {noChange ? (
                                                            <span className="text-prime-gunmetal/50">
                                                                --
                                                            </span>
                                                        ) : (
                                                            <span
                                                                className={
                                                                    changePercent > 0
                                                                        ? 'text-emerald-400'
                                                                        : 'text-prime-red'
                                                                }
                                                            >
                                                                {changePercent > 0 ? '+' : ''}
                                                                {changePercent.toFixed(1)}%
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-2 text-right text-prime-gunmetal align-top">
                                                        x{rec.multiplier.toFixed(2)}
                                                    </td>

                                                    {activeTab === 'ensemble' ? (
                                                        <>
                                                            <td className="py-3 px-2 text-right align-top w-[140px]">
                                                                <div
                                                                    className="flex h-1.5 w-full bg-prime-darker overflow-hidden mt-2"
                                                                    title={`A:${(rec.thompson_weight * 100).toFixed(0)}% B:${(rec.q_learning_weight * 100).toFixed(0)}% F:${(rec.forecast_weight * 100).toFixed(0)}%`}
                                                                >
                                                                    <div
                                                                        style={{
                                                                            width: `${rec.thompson_weight * 100}%`,
                                                                        }}
                                                                        className="bg-prime-energon"
                                                                    />
                                                                    <div
                                                                        style={{
                                                                            width: `${rec.q_learning_weight * 100}%`,
                                                                        }}
                                                                        className="bg-prime-blue"
                                                                    />
                                                                    <div
                                                                        style={{
                                                                            width: `${rec.forecast_weight * 100}%`,
                                                                        }}
                                                                        className="bg-emerald-400"
                                                                    />
                                                                </div>
                                                            </td>
                                                            <td className="py-3 px-2 text-center align-top">
                                                                <CompetitionBadge
                                                                    level={rec.competition_level}
                                                                />
                                                            </td>
                                                        </>
                                                    ) : (
                                                        <td className="py-3 px-2 text-right align-top">
                                                            {activeTab === 'thompson' ? (
                                                                <ConfidenceBar
                                                                    value={rec.confidence}
                                                                />
                                                            ) : (
                                                                <span className="text-prime-blue font-mono">
                                                                    {rec.q_value > 0 ? '+' : ''}
                                                                    {rec.q_value.toFixed(4)}
                                                                </span>
                                                            )}
                                                        </td>
                                                    )}

                                                    <td className="py-3 px-2 text-right align-top">
                                                        {isApplied ? (
                                                            <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">
                                                                Applied
                                                            </span>
                                                        ) : noChange ? (
                                                            <span className="text-prime-gunmetal/50 text-xs font-bold uppercase tracking-wider">
                                                                Optimal
                                                            </span>
                                                        ) : (
                                                            <button
                                                                onClick={() =>
                                                                    handleApplyOne(rec)
                                                                }
                                                                className="text-xs px-3 py-1 border border-prime-energon/30 text-prime-energon hover:bg-prime-energon/10 transition-colors font-bold uppercase tracking-wider chamfer-sm"
                                                            >
                                                                Apply
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {!loading && currentRecs.length === 0 && selectedCampaign && (
                        <div className="text-center py-16 text-prime-gunmetal text-sm uppercase tracking-wider">
                            Select a campaign and click &quot;Run&quot; to get bid recommendations
                            via {tabConfig[activeTab].title}
                        </div>
                    )}
                </>
            )}

            {/* ═══════════════════════════════════════════
                 WASTE FINDER TAB
                 ═══════════════════════════════════════════ */}
            {activeTab === 'waste-finder' && (
                <>
                    {wasteLoading && (
                        <Spinner
                            text="Scanning for wasted spend..."
                            subtext="Analyzing search terms for negative keyword opportunities"
                        />
                    )}

                    {!wasteLoading && wasteSuggestions.length > 0 && (
                        <>
                            {/* Summary cards */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-prime-dark/80 border border-red-500/20 p-5 chamfer-sm">
                                    <span className="text-[10px] text-prime-gunmetal uppercase tracking-widest">
                                        Total Wasted Spend
                                    </span>
                                    <div className="text-red-400 font-bold text-2xl mt-1">
                                        ${totalWastedSpend.toFixed(2)}
                                    </div>
                                </div>
                                <div className="bg-prime-dark/80 border border-emerald-500/20 p-5 chamfer-sm">
                                    <span className="text-[10px] text-prime-gunmetal uppercase tracking-widest">
                                        Potential 30d Savings
                                    </span>
                                    <div className="text-emerald-400 font-bold text-2xl mt-1">
                                        ${totalPotentialSavings.toFixed(2)}
                                    </div>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="bg-prime-dark/80 backdrop-blur-sm border border-prime-gunmetal/30 p-6 chamfer">
                                <h3 className="text-sm font-bold text-prime-silver uppercase tracking-widest mb-4 flex items-center gap-3">
                                    Negative Keyword Suggestions
                                    <span className="text-[10px] px-2 py-0.5 bg-prime-black/50 text-prime-gunmetal font-semibold chamfer-sm">
                                        {visibleWaste.length} terms
                                    </span>
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-prime-gunmetal/20 text-prime-gunmetal">
                                                <th className="text-left py-3 px-2 text-[10px] uppercase tracking-widest">
                                                    Search Term
                                                </th>
                                                <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">
                                                    Spend
                                                </th>
                                                <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">
                                                    Clicks
                                                </th>
                                                <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">
                                                    Orders
                                                </th>
                                                <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">
                                                    Est. Savings 30d
                                                </th>
                                                <th className="text-left py-3 px-2 text-[10px] uppercase tracking-widest">
                                                    Reason
                                                </th>
                                                <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {wasteSuggestions.map((s) => {
                                                const isAppliedW = wasteApplied.has(s.id);
                                                const isDismissed = wasteDismissed.has(s.id);
                                                if (isAppliedW || isDismissed) return null;

                                                return (
                                                    <tr
                                                        key={s.id}
                                                        className="border-b border-prime-gunmetal/10 hover:bg-prime-darker/50"
                                                    >
                                                        <td className="py-3 px-2 text-prime-silver font-semibold">
                                                            {s.search_term}
                                                            <div className="text-[10px] text-prime-gunmetal mt-0.5">
                                                                {s.suggested_match_type} match
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-2 text-right text-red-400">
                                                            ${s.total_spend.toFixed(2)}
                                                        </td>
                                                        <td className="py-3 px-2 text-right text-prime-gunmetal">
                                                            {s.total_clicks}
                                                        </td>
                                                        <td className="py-3 px-2 text-right text-prime-gunmetal">
                                                            {s.total_orders}
                                                        </td>
                                                        <td className="py-3 px-2 text-right text-emerald-400 font-bold">
                                                            ${s.estimated_savings_30d.toFixed(2)}
                                                        </td>
                                                        <td className="py-3 px-2 text-prime-gunmetal text-xs max-w-[200px] truncate">
                                                            {s.reason}
                                                        </td>
                                                        <td className="py-3 px-2 text-right">
                                                            <div className="flex items-center gap-2 justify-end">
                                                                <button
                                                                    onClick={() =>
                                                                        handleApplyNegative(s.id)
                                                                    }
                                                                    className="text-xs px-3 py-1 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors font-bold uppercase tracking-wider chamfer-sm"
                                                                >
                                                                    Add as Negative
                                                                </button>
                                                                <button
                                                                    onClick={() =>
                                                                        handleDismissNegative(s.id)
                                                                    }
                                                                    className="text-xs px-3 py-1 border border-prime-gunmetal/30 text-prime-gunmetal hover:text-prime-silver transition-colors font-bold uppercase tracking-wider chamfer-sm"
                                                                >
                                                                    Dismiss
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}

                    {!wasteLoading && wasteSuggestions.length === 0 && selectedCampaign && (
                        <div className="text-center py-16 text-prime-gunmetal text-sm uppercase tracking-wider">
                            Click &quot;Discover Waste&quot; to find negative keyword opportunities
                        </div>
                    )}
                </>
            )}

            {/* ═══════════════════════════════════════════
                 DAYPARTING TAB
                 ═══════════════════════════════════════════ */}
            {activeTab === 'dayparting' && (
                <>
                    {daypartLoading && (
                        <Spinner
                            text="Computing schedule..."
                            subtext="Analyzing hourly conversion patterns"
                        />
                    )}

                    {!daypartLoading && daypartHours.length > 0 && (
                        <div className="bg-prime-dark/80 backdrop-blur-sm border border-prime-gunmetal/30 p-6 chamfer">
                            <h3 className="text-sm font-bold text-prime-silver uppercase tracking-widest mb-6">
                                24-Hour Bid Schedule
                            </h3>
                            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-2">
                                {Array.from({ length: 24 }, (_, i) => {
                                    const hour = daypartHours.find((h) => h.hour === i);
                                    const multiplier = hour?.bid_multiplier ?? 1;
                                    const isBoost = multiplier > 1;
                                    const isReduce = multiplier < 1;
                                    const intensity = Math.abs(multiplier - 1);
                                    const bgColor = isBoost
                                        ? `rgba(16, 185, 129, ${Math.min(intensity * 2, 0.6)})`
                                        : isReduce
                                          ? `rgba(239, 68, 68, ${Math.min(intensity * 2, 0.6)})`
                                          : 'rgba(100, 100, 100, 0.1)';

                                    return (
                                        <button
                                            key={i}
                                            onClick={() => hour && setSelectedHour(hour)}
                                            className="border border-prime-gunmetal/20 p-2 chamfer-sm hover:border-prime-energon/30 transition-all text-center"
                                            style={{ backgroundColor: bgColor }}
                                        >
                                            <div className="text-[10px] text-prime-gunmetal uppercase tracking-widest">
                                                {i.toString().padStart(2, '0')}:00
                                            </div>
                                            <div
                                                className={`text-sm font-bold mt-1 ${
                                                    isBoost
                                                        ? 'text-emerald-400'
                                                        : isReduce
                                                          ? 'text-red-400'
                                                          : 'text-prime-gunmetal'
                                                }`}
                                            >
                                                x{multiplier.toFixed(2)}
                                            </div>
                                            {hour && (
                                                <div className="text-[9px] text-prime-gunmetal/60 mt-0.5">
                                                    {(hour.avg_cvr * 100).toFixed(1)}% cvr
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Legend */}
                            <div className="flex items-center gap-6 mt-4 justify-center">
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-3" style={{ backgroundColor: 'rgba(239, 68, 68, 0.4)' }} />
                                    <span className="text-[10px] text-prime-gunmetal uppercase tracking-widest">
                                        Reduce Bid
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-3 bg-prime-gunmetal/10" />
                                    <span className="text-[10px] text-prime-gunmetal uppercase tracking-widest">
                                        No Change
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-3" style={{ backgroundColor: 'rgba(16, 185, 129, 0.4)' }} />
                                    <span className="text-[10px] text-prime-gunmetal uppercase tracking-widest">
                                        Boost Bid
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Hour detail popup */}
                    {selectedHour && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                            <div className="bg-prime-darker border border-prime-energon/20 p-6 chamfer w-full max-w-sm space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-prime-silver uppercase tracking-widest">
                                        Hour {selectedHour.hour.toString().padStart(2, '0')}:00
                                    </h3>
                                    <button
                                        onClick={() => setSelectedHour(null)}
                                        className="text-prime-gunmetal hover:text-prime-silver text-lg"
                                    >
                                        x
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-prime-black/40 p-3 chamfer-sm">
                                        <span className="text-[10px] text-prime-gunmetal uppercase tracking-widest">
                                            Bid Multiplier
                                        </span>
                                        <div
                                            className={`font-bold text-xl mt-1 ${
                                                selectedHour.bid_multiplier > 1
                                                    ? 'text-emerald-400'
                                                    : selectedHour.bid_multiplier < 1
                                                      ? 'text-red-400'
                                                      : 'text-prime-silver'
                                            }`}
                                        >
                                            x{selectedHour.bid_multiplier.toFixed(3)}
                                        </div>
                                    </div>
                                    <div className="bg-prime-black/40 p-3 chamfer-sm">
                                        <span className="text-[10px] text-prime-gunmetal uppercase tracking-widest">
                                            Avg CVR
                                        </span>
                                        <div className="text-prime-energon font-bold text-xl mt-1">
                                            {(selectedHour.avg_cvr * 100).toFixed(2)}%
                                        </div>
                                    </div>
                                    <div className="bg-prime-black/40 p-3 chamfer-sm">
                                        <span className="text-[10px] text-prime-gunmetal uppercase tracking-widest">
                                            Avg ROAS
                                        </span>
                                        <div className="text-prime-silver font-bold text-xl mt-1">
                                            {selectedHour.avg_roas.toFixed(2)}
                                        </div>
                                    </div>
                                    <div className="bg-prime-black/40 p-3 chamfer-sm">
                                        <span className="text-[10px] text-prime-gunmetal uppercase tracking-widest">
                                            Orders
                                        </span>
                                        <div className="text-prime-silver font-bold text-xl mt-1">
                                            {selectedHour.total_orders}
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-prime-black/40 p-3 chamfer-sm">
                                    <span className="text-[10px] text-prime-gunmetal uppercase tracking-widest">
                                        Confidence
                                    </span>
                                    <div className="mt-2">
                                        <ConfidenceBar value={selectedHour.confidence} />
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedHour(null)}
                                    className="w-full px-4 py-2 border border-prime-gunmetal/30 text-prime-gunmetal text-xs font-bold uppercase tracking-widest hover:text-prime-silver transition-all chamfer-sm"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    )}

                    {!daypartLoading && daypartHours.length === 0 && selectedCampaign && (
                        <div className="text-center py-16 text-prime-gunmetal text-sm uppercase tracking-wider">
                            Click &quot;Compute Schedule&quot; to analyze hourly performance
                        </div>
                    )}
                </>
            )}

            {/* ═══════════════════════════════════════════
                 STAGED ROLLOUT TAB
                 ═══════════════════════════════════════════ */}
            {activeTab === 'rollout' && (
                <>
                    {rolloutLoading && (
                        <Spinner
                            text="Loading rollout status..."
                            subtext="Fetching current staged rollout information"
                        />
                    )}

                    {!rolloutLoading && rolloutStatus && !rolloutStatus.active && (
                        <div className="bg-prime-dark/80 backdrop-blur-sm border border-prime-gunmetal/30 p-6 chamfer text-center space-y-4">
                            <p className="text-prime-gunmetal text-sm uppercase tracking-widest">
                                No active rollout for this campaign
                            </p>
                            <button
                                onClick={handleStartRollout}
                                disabled={!selectedCampaign || rolloutActioning}
                                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {rolloutActioning
                                    ? 'Creating Rollout...'
                                    : 'Start New Rollout'}
                            </button>
                            <p className="text-prime-gunmetal/50 text-xs">
                                This will generate ensemble recommendations and deploy them in 4 progressive stages
                            </p>
                        </div>
                    )}

                    {!rolloutLoading && rolloutStatus && rolloutStatus.active && (
                        <div className="space-y-5">
                            {/* Rollout info */}
                            <div className="bg-prime-dark/80 backdrop-blur-sm border border-prime-energon/15 p-6 chamfer">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="text-sm font-bold text-prime-silver uppercase tracking-widest">
                                            Active Rollout
                                        </h3>
                                        <div className="text-[10px] text-prime-gunmetal mt-1 uppercase tracking-widest">
                                            Model: {rolloutStatus.model_type} | Status:{' '}
                                            {rolloutStatus.status} | Keywords:{' '}
                                            {rolloutStatus.total_keywords}
                                        </div>
                                    </div>
                                    {rolloutStatus.pre_acos !== undefined && (
                                        <div className="text-right">
                                            <span className="text-[10px] text-prime-gunmetal uppercase tracking-widest">
                                                Pre-Rollout ACoS
                                            </span>
                                            <div className="text-prime-energon font-bold text-lg">
                                                {rolloutStatus.pre_acos?.toFixed(1)}%
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 4-stage progress bar */}
                                <div className="flex items-center gap-2 mb-6">
                                    {[1, 2, 3, 4].map((stage) => {
                                        const stageData = rolloutStatus.stages?.find(
                                            (s) => s.stage === stage
                                        );
                                        const isCurrent =
                                            rolloutStatus.current_stage === stage;
                                        const isComplete =
                                            (rolloutStatus.current_stage ?? 0) > stage;
                                        const isPending =
                                            (rolloutStatus.current_stage ?? 0) < stage;

                                        return (
                                            <div key={stage} className="flex-1">
                                                <div
                                                    className={`h-2 chamfer-sm transition-all ${
                                                        isComplete
                                                            ? 'bg-emerald-500'
                                                            : isCurrent
                                                              ? 'bg-prime-energon animate-pulse'
                                                              : 'bg-prime-gunmetal/20'
                                                    }`}
                                                />
                                                <div className="flex items-center justify-between mt-1">
                                                    <span
                                                        className={`text-[10px] uppercase tracking-widest ${
                                                            isCurrent
                                                                ? 'text-prime-energon font-bold'
                                                                : isComplete
                                                                  ? 'text-emerald-400'
                                                                  : 'text-prime-gunmetal/40'
                                                        }`}
                                                    >
                                                        Stage {stage}
                                                    </span>
                                                    {stageData && (
                                                        <span className="text-[9px] text-prime-gunmetal">
                                                            {stageData.applied}/{stageData.keyword_count}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Action buttons */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleAdvanceStage}
                                        disabled={
                                            rolloutActioning ||
                                            rolloutStatus.status === 'completed' ||
                                            rolloutStatus.status === 'rolled_back'
                                        }
                                        className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {rolloutActioning
                                            ? 'Processing...'
                                            : 'Advance Stage'}
                                    </button>
                                    <button
                                        onClick={handleRollbackRollout}
                                        disabled={
                                            rolloutActioning ||
                                            rolloutStatus.status === 'rolled_back'
                                        }
                                        className="px-6 py-2.5 border border-red-500/30 text-red-400 hover:bg-red-500/10 font-bold text-xs uppercase tracking-widest transition-all chamfer-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Rollback
                                    </button>
                                </div>
                            </div>

                            {/* Stage details */}
                            {rolloutStatus.stages && rolloutStatus.stages.length > 0 && (
                                <div className="bg-prime-dark/80 border border-prime-gunmetal/30 p-6 chamfer">
                                    <h3 className="text-sm font-bold text-prime-silver uppercase tracking-widest mb-4">
                                        Stage Details
                                    </h3>
                                    <div className="grid grid-cols-4 gap-3">
                                        {rolloutStatus.stages.map((stage) => {
                                            const isCurrent =
                                                rolloutStatus.current_stage === stage.stage;
                                            return (
                                                <div
                                                    key={stage.stage}
                                                    className={`p-4 chamfer-sm border ${
                                                        isCurrent
                                                            ? 'border-prime-energon/30 bg-prime-energon/5'
                                                            : 'border-prime-gunmetal/20 bg-prime-black/40'
                                                    }`}
                                                >
                                                    <div
                                                        className={`text-[10px] uppercase tracking-widest mb-2 ${
                                                            isCurrent
                                                                ? 'text-prime-energon'
                                                                : 'text-prime-gunmetal'
                                                        }`}
                                                    >
                                                        Stage {stage.stage}
                                                    </div>
                                                    <div className="text-prime-silver font-bold text-lg">
                                                        {stage.keyword_count}
                                                    </div>
                                                    <div className="text-[10px] text-prime-gunmetal">
                                                        keywords
                                                    </div>
                                                    <div className="mt-2 text-emerald-400 text-sm font-bold">
                                                        {stage.applied} applied
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {!rolloutLoading && !rolloutStatus && selectedCampaign && (
                        <div className="bg-prime-dark/80 backdrop-blur-sm border border-prime-gunmetal/30 p-6 chamfer text-center space-y-4">
                            <p className="text-prime-gunmetal text-sm uppercase tracking-widest">
                                No active rollout for this campaign
                            </p>
                            <button
                                onClick={handleStartRollout}
                                disabled={!selectedCampaign || rolloutActioning}
                                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {rolloutActioning
                                    ? 'Creating Rollout...'
                                    : 'Start New Rollout'}
                            </button>
                            <p className="text-prime-gunmetal/50 text-xs">
                                This will generate ensemble recommendations and deploy them in 4 progressive stages
                            </p>
                        </div>
                    )}
                </>
            )}

            {/* ═══════════════════════════════════════════
                 LEADERBOARD TAB
                 ═══════════════════════════════════════════ */}
            {activeTab === 'leaderboard' && <ModelLeaderboard />}

            {/* ── Empty state for no campaign selected (non-leaderboard tabs) ── */}
            {activeTab !== 'leaderboard' && !selectedCampaign && (
                <div className="text-center py-16 text-prime-gunmetal text-sm uppercase tracking-wider">
                    Select a campaign to get started
                </div>
            )}
        </div>
    );
}
