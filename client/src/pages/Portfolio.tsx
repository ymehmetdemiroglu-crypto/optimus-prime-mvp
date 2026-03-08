import { useState, useEffect, useMemo, useCallback } from 'react';
import { portfolioApi, campaignApi } from '../api/client';
import type { Campaign, PortfolioBudgetAllocation, BudgetSimulation } from '../types';
import { fmtDollar as fmt, fmtPct } from '../utils/formatting';

const CAMPAIGN_COLORS = [
    'bg-prime-energon', 'bg-prime-blue', 'bg-emerald-400', 'bg-amber-400',
    'bg-rose-400', 'bg-violet-400', 'bg-cyan-400', 'bg-orange-400',
    'bg-lime-400', 'bg-fuchsia-400', 'bg-teal-400', 'bg-indigo-400',
];

export default function Portfolio() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Optimizer state
    const [totalBudget, setTotalBudget] = useState(0);
    const [optimizing, setOptimizing] = useState(false);
    const [allocations, setAllocations] = useState<PortfolioBudgetAllocation[]>([]);
    const [optimizeError, setOptimizeError] = useState('');

    // Apply state
    const [applying, setApplying] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [applyMessage, setApplyMessage] = useState('');

    // What-If state
    const [additionalBudget, setAdditionalBudget] = useState(0);
    const [simulating, setSimulating] = useState(false);
    const [simulation, setSimulation] = useState<BudgetSimulation | null>(null);
    const [simError, setSimError] = useState('');

    // Load campaigns
    useEffect(() => {
        setLoading(true);
        campaignApi.getCampaigns()
            .then((data) => {
                setCampaigns(data);
                const total = data.reduce((sum, c) => sum + c.budget, 0);
                setTotalBudget(Number(total.toFixed(2)));
            })
            .catch((e) => setError(e.message || 'Failed to load campaigns'))
            .finally(() => setLoading(false));
    }, []);

    // Summary metrics
    const summary = useMemo(() => {
        const activeCampaigns = campaigns.filter(c => c.status === 'active');
        const totalCurrentBudget = campaigns.reduce((sum, c) => sum + c.budget, 0);
        const totalDailySpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
        const totalSales = campaigns.reduce((sum, c) => sum + c.sales, 0);
        const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
        const avgRoas = totalSpend > 0 ? totalSales / totalSpend : 0;

        return {
            totalCurrentBudget,
            avgRoas,
            totalDailySpend,
            activeCampaigns: activeCampaigns.length,
        };
    }, [campaigns]);

    // Optimize handler
    const handleOptimize = useCallback(async () => {
        if (totalBudget <= 0) return;
        setOptimizing(true);
        setOptimizeError('');
        setApplyMessage('');
        try {
            const result = await portfolioApi.optimizeBudget(totalBudget);
            setAllocations(result);
        } catch (e: unknown) {
            setOptimizeError(e instanceof Error ? e.message : 'Optimization failed');
            setAllocations([]);
        } finally {
            setOptimizing(false);
        }
    }, [totalBudget]);

    // Apply handler
    const handleApplyAll = useCallback(async () => {
        setShowConfirm(false);
        setApplying(true);
        setApplyMessage('');
        try {
            const mapped = allocations.map(a => ({
                campaign_id: a.campaign_id,
                recommended_budget: a.recommended_budget,
            }));
            const count = await portfolioApi.applyBudgetRecommendations(mapped);
            setApplyMessage(`Successfully applied budget changes to ${count} campaign${count !== 1 ? 's' : ''}.`);
            // Refresh campaigns
            const refreshed = await campaignApi.getCampaigns();
            setCampaigns(refreshed);
        } catch (e: unknown) {
            setApplyMessage(`Failed to apply: ${e instanceof Error ? e.message : 'Unknown error'}`);
        } finally {
            setApplying(false);
        }
    }, [allocations]);

    // Simulate handler
    const handleSimulate = useCallback(async () => {
        setSimulating(true);
        setSimError('');
        try {
            const result = await portfolioApi.simulateBudgetChange(additionalBudget);
            setSimulation(result);
        } catch (e: unknown) {
            setSimError(e instanceof Error ? e.message : 'Simulation failed');
            setSimulation(null);
        } finally {
            setSimulating(false);
        }
    }, [additionalBudget]);

    // Color map for campaigns
    const colorMap = useMemo(() => {
        const map = new Map<string, string>();
        const allIds = [
            ...allocations.map(a => a.campaign_id),
            ...(simulation?.allocations || []).map(a => a.campaign_id),
            ...campaigns.map(c => c.id),
        ];
        const unique = [...new Set(allIds)];
        unique.forEach((id, i) => map.set(id, CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length]));
        return map;
    }, [allocations, simulation, campaigns]);

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen p-6 lg:p-8 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-2 border-prime-energon/30 border-t-prime-energon rounded-full animate-spin mx-auto mb-4" />
                    <div className="text-prime-energon text-sm font-bold uppercase tracking-widest mb-1">Loading portfolio data...</div>
                    <p className="text-prime-gunmetal text-xs">Fetching campaign information</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="min-h-screen p-6 lg:p-8">
                <div className="bg-prime-red/10 border border-prime-red/30 p-6 chamfer">
                    <h2 className="text-prime-red text-sm font-bold uppercase tracking-widest mb-2">Error Loading Portfolio</h2>
                    <p className="text-prime-silver text-sm">{error}</p>
                </div>
            </div>
        );
    }

    // Empty state
    if (campaigns.length === 0) {
        return (
            <div className="min-h-screen p-6 lg:p-8 space-y-5">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-wider">
                        <span className="text-prime-blue">Port</span>
                        <span className="text-prime-silver">folio</span>
                    </h1>
                    <p className="text-prime-gunmetal text-xs mt-1 uppercase tracking-widest font-semibold">Cross-campaign budget optimization</p>
                </div>
                <div className="text-center py-24">
                    <div className="text-prime-gunmetal text-sm uppercase tracking-widest mb-2">No Campaigns Found</div>
                    <p className="text-prime-gunmetal/60 text-xs">Create campaigns to begin portfolio-level budget optimization.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-6 lg:p-8 space-y-5">
            {/* ────── Header ────── */}
            <div>
                <h1 className="text-3xl font-black uppercase tracking-wider">
                    <span className="text-prime-blue">Port</span>
                    <span className="text-prime-silver">folio</span>
                </h1>
                <p className="text-prime-gunmetal text-xs mt-1 uppercase tracking-widest font-semibold">Cross-campaign budget optimization</p>
            </div>

            {/* ────── Summary Cards ────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard label="Total Current Budget" value={fmt(summary.totalCurrentBudget)} accent="text-prime-energon" />
                <SummaryCard label="Avg Portfolio ROAS" value={`${summary.avgRoas.toFixed(2)}x`} accent="text-prime-blue" />
                <SummaryCard label="Total Daily Spend" value={fmt(summary.totalDailySpend)} accent="text-prime-silver" />
                <SummaryCard label="Active Campaigns" value={String(summary.activeCampaigns)} accent="text-emerald-400" />
            </div>

            {/* ────── Budget Optimizer ────── */}
            <div className="bg-prime-dark/80 backdrop-blur-sm border border-prime-energon/15 p-6 chamfer">
                <h2 className="text-sm font-bold text-prime-silver uppercase tracking-widest mb-5">Budget Optimizer</h2>

                <div className="flex flex-wrap items-end gap-4 mb-4">
                    <div className="flex-1 min-w-[200px] max-w-[300px]">
                        <label className="block text-[10px] font-bold text-prime-gunmetal mb-2 uppercase tracking-widest">Total Budget ($)</label>
                        <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={totalBudget}
                            onChange={(e) => setTotalBudget(Number(e.target.value))}
                            className="input"
                        />
                    </div>
                    <button
                        onClick={handleOptimize}
                        disabled={optimizing || totalBudget <= 0}
                        className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {optimizing ? 'Optimizing...' : 'Optimize'}
                    </button>
                </div>

                {optimizeError && (
                    <div className="px-4 py-3 bg-prime-red/5 border border-prime-red/20 text-prime-red text-sm chamfer-sm mb-4">{optimizeError}</div>
                )}

                {optimizing && (
                    <div className="text-center py-12">
                        <div className="w-10 h-10 border-2 border-prime-energon/30 border-t-prime-energon rounded-full animate-spin mx-auto mb-4" />
                        <div className="text-prime-energon text-sm font-bold uppercase tracking-widest">Running portfolio optimization...</div>
                    </div>
                )}

                {!optimizing && allocations.length > 0 && (
                    <>
                        <div className="overflow-x-auto mb-4">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-prime-gunmetal/20 text-prime-gunmetal">
                                        <th className="text-left py-3 px-2 text-[10px] uppercase tracking-widest">Campaign Name</th>
                                        <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">Current Budget</th>
                                        <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">Recommended</th>
                                        <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">Change ($)</th>
                                        <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">Change (%)</th>
                                        <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">Current ROAS</th>
                                        <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">Expected ROAS</th>
                                        <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">Marginal ROAS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allocations.map((a) => {
                                        const changePct = a.current_budget > 0
                                            ? ((a.recommended_budget - a.current_budget) / a.current_budget) * 100
                                            : 0;
                                        const isIncrease = a.budget_change > 0;
                                        const isDecrease = a.budget_change < 0;
                                        const changeColor = isIncrease ? 'text-emerald-400' : isDecrease ? 'text-prime-red' : 'text-prime-gunmetal';

                                        return (
                                            <tr key={a.campaign_id} className="border-b border-prime-gunmetal/10 hover:bg-prime-darker/50 transition-colors">
                                                <td className="py-3 px-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${colorMap.get(a.campaign_id) || 'bg-prime-gunmetal'}`} />
                                                        <span className="text-prime-silver font-semibold">{a.campaign_name}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-2 text-right text-prime-gunmetal">{fmt(a.current_budget)}</td>
                                                <td className="py-3 px-2 text-right text-prime-energon font-bold">{fmt(a.recommended_budget)}</td>
                                                <td className={`py-3 px-2 text-right font-semibold ${changeColor}`}>
                                                    {a.budget_change === 0 ? '--' : `${isIncrease ? '+' : ''}${fmt(a.budget_change)}`}
                                                </td>
                                                <td className={`py-3 px-2 text-right font-semibold ${changeColor}`}>
                                                    {a.budget_change === 0 ? '--' : fmtPct(changePct)}
                                                </td>
                                                <td className="py-3 px-2 text-right text-prime-gunmetal">{a.current_roas.toFixed(2)}x</td>
                                                <td className="py-3 px-2 text-right text-prime-silver">{a.expected_roas.toFixed(2)}x</td>
                                                <td className="py-3 px-2 text-right text-prime-blue">{a.marginal_roas.toFixed(2)}x</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowConfirm(true)}
                                disabled={applying}
                                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {applying ? 'Applying...' : 'Apply All Recommendations'}
                            </button>
                            {applyMessage && (
                                <span className={`text-sm ${applyMessage.startsWith('Failed') ? 'text-prime-red' : 'text-emerald-400'}`}>
                                    {applyMessage}
                                </span>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* ────── Confirm Modal ────── */}
            {showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-prime-black/70 backdrop-blur-sm">
                    <div className="bg-prime-darker border border-prime-energon/30 p-8 chamfer max-w-md w-full mx-4">
                        <h3 className="text-sm font-bold text-prime-silver uppercase tracking-widest mb-4">Confirm Budget Changes</h3>
                        <p className="text-prime-gunmetal text-sm mb-2">
                            You are about to update budgets for <span className="text-prime-energon font-bold">{allocations.length}</span> campaign{allocations.length !== 1 ? 's' : ''}.
                        </p>
                        <div className="bg-prime-black/40 border border-prime-gunmetal/20 p-3 chamfer-sm mb-6 max-h-40 overflow-y-auto">
                            {allocations.map(a => (
                                <div key={a.campaign_id} className="flex justify-between text-xs py-1 border-b border-prime-gunmetal/10 last:border-b-0">
                                    <span className="text-prime-silver">{a.campaign_name}</span>
                                    <span className={a.budget_change > 0 ? 'text-emerald-400' : a.budget_change < 0 ? 'text-prime-red' : 'text-prime-gunmetal'}>
                                        {fmt(a.current_budget)} &rarr; {fmt(a.recommended_budget)}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="px-5 py-2.5 bg-prime-dark border border-prime-gunmetal/30 text-prime-gunmetal text-xs font-bold uppercase tracking-widest hover:text-prime-silver hover:border-prime-gunmetal transition-all chamfer-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleApplyAll}
                                className="px-5 py-2.5 bg-emerald-500 text-white font-bold text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all chamfer-sm"
                            >
                                Confirm & Apply
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ────── What-If Simulator ────── */}
            <div className="bg-prime-dark/80 backdrop-blur-sm border border-prime-gunmetal/30 p-6 chamfer">
                <h2 className="text-sm font-bold text-prime-silver uppercase tracking-widest mb-5">What-If Simulator</h2>

                <div className="flex flex-wrap items-end gap-6 mb-4">
                    <div className="flex-1 min-w-[250px] max-w-[450px]">
                        <label className="block text-[10px] font-bold text-prime-gunmetal mb-2 uppercase tracking-widest">
                            Additional Budget: <span className="text-prime-energon">{fmt(additionalBudget)}</span>
                        </label>
                        <input
                            type="range"
                            min={0}
                            max={500}
                            step={25}
                            value={additionalBudget}
                            onChange={(e) => setAdditionalBudget(Number(e.target.value))}
                            className="w-full h-1.5 bg-prime-darker rounded-none appearance-none cursor-pointer accent-prime-energon"
                        />
                        <div className="flex justify-between text-[10px] text-prime-gunmetal/50 mt-1">
                            <span>$0</span>
                            <span>$250</span>
                            <span>$500</span>
                        </div>
                    </div>
                    <div className="w-[120px]">
                        <label className="block text-[10px] font-bold text-prime-gunmetal mb-2 uppercase tracking-widest">Exact Value</label>
                        <input
                            type="number"
                            min={0}
                            max={500}
                            step={25}
                            value={additionalBudget}
                            onChange={(e) => setAdditionalBudget(Math.min(500, Math.max(0, Number(e.target.value))))}
                            className="input"
                        />
                    </div>
                    <button
                        onClick={handleSimulate}
                        disabled={simulating}
                        className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {simulating ? 'Simulating...' : 'Simulate'}
                    </button>
                </div>

                {simError && (
                    <div className="px-4 py-3 bg-prime-red/5 border border-prime-red/20 text-prime-red text-sm chamfer-sm mb-4">{simError}</div>
                )}

                {simulating && (
                    <div className="text-center py-12">
                        <div className="w-10 h-10 border-2 border-prime-energon/30 border-t-prime-energon rounded-full animate-spin mx-auto mb-4" />
                        <div className="text-prime-energon text-sm font-bold uppercase tracking-widest">Running budget simulation...</div>
                    </div>
                )}

                {!simulating && simulation && (
                    <div className="space-y-4">
                        {/* Summary row */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-prime-black/40 border border-prime-gunmetal/20 p-4 chamfer-sm">
                                <div className="text-[10px] font-bold text-prime-gunmetal uppercase tracking-widest mb-1">Current Total</div>
                                <div className="text-xl font-black text-prime-silver">{fmt(simulation.current_total_budget)}</div>
                            </div>
                            <div className="bg-prime-black/40 border border-prime-energon/20 p-4 chamfer-sm">
                                <div className="text-[10px] font-bold text-prime-gunmetal uppercase tracking-widest mb-1">New Total</div>
                                <div className="text-xl font-black text-prime-energon">{fmt(simulation.new_total_budget)}</div>
                            </div>
                            <div className="bg-prime-black/40 border border-prime-gunmetal/20 p-4 chamfer-sm">
                                <div className="text-[10px] font-bold text-prime-gunmetal uppercase tracking-widest mb-1">Additional</div>
                                <div className="text-xl font-black text-emerald-400">+{fmt(simulation.additional_budget)}</div>
                            </div>
                        </div>

                        {/* Per-campaign allocations */}
                        {simulation.allocations.length > 0 && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-prime-gunmetal/20 text-prime-gunmetal">
                                            <th className="text-left py-3 px-2 text-[10px] uppercase tracking-widest">Campaign</th>
                                            <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">Current</th>
                                            <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">Projected</th>
                                            <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">Change</th>
                                            <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">Expected ROAS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {simulation.allocations.map((a) => (
                                            <tr key={a.campaign_id} className="border-b border-prime-gunmetal/10 hover:bg-prime-darker/50 transition-colors">
                                                <td className="py-3 px-2 text-prime-silver font-semibold">{a.campaign_name}</td>
                                                <td className="py-3 px-2 text-right text-prime-gunmetal">{fmt(a.current_budget)}</td>
                                                <td className="py-3 px-2 text-right text-prime-energon font-bold">{fmt(a.recommended_budget)}</td>
                                                <td className={`py-3 px-2 text-right font-semibold ${a.budget_change > 0 ? 'text-emerald-400' : a.budget_change < 0 ? 'text-prime-red' : 'text-prime-gunmetal'}`}>
                                                    {a.budget_change === 0 ? '--' : `${a.budget_change > 0 ? '+' : ''}${fmt(a.budget_change)}`}
                                                </td>
                                                <td className="py-3 px-2 text-right text-prime-silver">{a.expected_roas.toFixed(2)}x</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Projected impact summary */}
                        <div className="bg-prime-black/40 border border-prime-gunmetal/20 p-4 chamfer-sm">
                            <div className="text-[10px] font-bold text-prime-gunmetal uppercase tracking-widest mb-3">Projected Impact Summary</div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div>
                                    <div className="text-[10px] text-prime-gunmetal uppercase tracking-widest">Campaigns Affected</div>
                                    <div className="text-lg font-bold text-prime-silver">
                                        {simulation.allocations.filter(a => a.budget_change !== 0).length}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-prime-gunmetal uppercase tracking-widest">Budget Increase</div>
                                    <div className="text-lg font-bold text-emerald-400">
                                        {simulation.allocations.filter(a => a.budget_change > 0).length} campaigns
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-prime-gunmetal uppercase tracking-widest">Avg Expected ROAS</div>
                                    <div className="text-lg font-bold text-prime-blue">
                                        {simulation.allocations.length > 0
                                            ? (simulation.allocations.reduce((sum, a) => sum + a.expected_roas * a.recommended_budget, 0) /
                                                simulation.allocations.reduce((sum, a) => sum + a.recommended_budget, 0) || 0).toFixed(2)
                                            : '0.00'}x
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-prime-gunmetal uppercase tracking-widest">Avg Marginal ROAS</div>
                                    <div className="text-lg font-bold text-prime-energon">
                                        {simulation.allocations.length > 0
                                            ? (simulation.allocations.reduce((sum, a) => sum + a.marginal_roas, 0) / simulation.allocations.length).toFixed(2)
                                            : '0.00'}x
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ────── Visual Budget Allocation ────── */}
            {allocations.length > 0 && (
                <div className="bg-prime-dark/80 backdrop-blur-sm border border-prime-gunmetal/30 p-6 chamfer">
                    <h2 className="text-sm font-bold text-prime-silver uppercase tracking-widest mb-5">Visual Budget Allocation</h2>

                    <div className="space-y-4">
                        {allocations.map((a) => {
                            const maxBudget = Math.max(...allocations.map(al => Math.max(al.current_budget, al.recommended_budget)));
                            const currentPct = maxBudget > 0 ? (a.current_budget / maxBudget) * 100 : 0;
                            const recommendedPct = maxBudget > 0 ? (a.recommended_budget / maxBudget) * 100 : 0;
                            const barColor = colorMap.get(a.campaign_id) || 'bg-prime-gunmetal';

                            return (
                                <div key={a.campaign_id}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${barColor}`} />
                                            <span className="text-xs text-prime-silver font-semibold">{a.campaign_name}</span>
                                        </div>
                                        <span className="text-[10px] text-prime-gunmetal uppercase tracking-widest">
                                            {fmt(a.current_budget)} &rarr; {fmt(a.recommended_budget)}
                                        </span>
                                    </div>
                                    {/* Current bar */}
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] text-prime-gunmetal w-16 text-right uppercase tracking-widest">Current</span>
                                        <div className="flex-1 bg-prime-black/40 h-3 overflow-hidden">
                                            <div
                                                className={`h-full ${barColor} opacity-40 transition-all duration-500`}
                                                style={{ width: `${currentPct}%` }}
                                            />
                                        </div>
                                    </div>
                                    {/* Recommended bar */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-prime-gunmetal w-16 text-right uppercase tracking-widest">New</span>
                                        <div className="flex-1 bg-prime-black/40 h-3 overflow-hidden">
                                            <div
                                                className={`h-full ${barColor} transition-all duration-500`}
                                                style={{ width: `${recommendedPct}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-prime-gunmetal/15">
                        {allocations.map((a) => (
                            <div key={a.campaign_id} className="flex items-center gap-1.5">
                                <div className={`w-2.5 h-2.5 rounded-full ${colorMap.get(a.campaign_id) || 'bg-prime-gunmetal'}`} />
                                <span className="text-[10px] text-prime-gunmetal uppercase tracking-widest">{a.campaign_name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ────── Summary Card Component ────── */

function SummaryCard({ label, value, accent }: { label: string; value: string; accent: string }) {
    return (
        <div className="bg-prime-dark/80 backdrop-blur-sm border border-prime-gunmetal/30 p-5 chamfer">
            <div className="text-[10px] font-bold text-prime-gunmetal mb-2 uppercase tracking-widest">{label}</div>
            <div className={`text-2xl font-black ${accent}`}>{value}</div>
        </div>
    );
}
