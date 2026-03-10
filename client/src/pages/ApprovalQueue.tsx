import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ─── Types ───

interface PendingApproval {
    id: string;
    campaign_id: string;
    keyword_id: string | null;
    action_type: 'bid_change' | 'negative_keyword' | 'budget_change';
    current_value: number;
    recommended_value: number;
    confidence: number | null;
    change_pct: number | null;
    reasons: string[];
    metadata: Record<string, any> | null;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    campaigns?: { name: string };
    keywords?: { keyword_text: string };
}

type ActionTypeLabel = Record<PendingApproval['action_type'], string>;

const ACTION_LABELS: ActionTypeLabel = {
    bid_change: 'Bid Change',
    negative_keyword: 'Neg. Keyword',
    budget_change: 'Budget Change',
};

const ACTION_COLORS: ActionTypeLabel = {
    bid_change: 'bg-prime-energon/15 text-prime-energon border-prime-energon/30',
    negative_keyword: 'bg-red-500/15 text-red-400 border-red-500/30',
    budget_change: 'bg-prime-blue/15 text-prime-blue border-prime-blue/30',
};

// ─── Auth Helper ───

async function getAuthHeaders(contentType?: string): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {};
    if (contentType) headers['Content-Type'] = contentType;
    if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
}

// ─── Helper Components ───

function Spinner({ text, subtext }: { text: string; subtext?: string }) {
    return (
        <div className="text-center py-16">
            <div className="w-10 h-10 border-2 border-prime-energon/30 border-t-prime-energon rounded-full animate-spin mx-auto mb-4" />
            <div className="text-prime-energon text-sm font-bold uppercase tracking-widest mb-1">
                {text}
            </div>
            {subtext && (
                <p className="text-prime-gunmetal text-xs">{subtext}</p>
            )}
        </div>
    );
}

function ConfidenceBar({ value }: { value: number }) {
    const percent = Math.min(100, value * 100);
    const color =
        percent >= 70
            ? 'bg-emerald-400'
            : percent >= 40
                ? 'bg-yellow-400'
                : 'bg-prime-red';
    return (
        <div className="flex items-center gap-2 justify-end">
            <div className="w-16 bg-prime-darker h-1.5 overflow-hidden">
                <div
                    className={`h-full ${color} transition-all`}
                    style={{ width: `${percent}%` }}
                />
            </div>
            <span className="text-xs text-prime-gunmetal w-8 text-right">
                {percent.toFixed(0)}%
            </span>
        </div>
    );
}

// ─── Types for Explainability ───

interface ExplainFactor {
    factor: string;
    detail: string;
    impact: 'low' | 'medium' | 'high' | 'critical';
}

interface Explanation {
    summary: string;
    factors: ExplainFactor[];
    risk_level: 'low' | 'medium' | 'high';
    historical_context?: string;
    recommendation_action?: string;
}

// ─── Main Component ───

export default function ApprovalQueue() {
    const [approvals, setApprovals] = useState<PendingApproval[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<Set<string>>(new Set());
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState<'success' | 'error'>('success');
    const [explanation, setExplanation] = useState<Explanation | null>(null);
    const [explainLoading, setExplainLoading] = useState(false);
    const [explainItemId, setExplainItemId] = useState<string | null>(null);

    // ── Show message helper ──
    const showMessage = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setMessage(msg);
        setMessageType(type);
        setTimeout(() => setMessage(''), 4000);
    }, []);

    // ── Fetch explanation ──
    const handleExplain = useCallback(async (id: string) => {
        setExplainItemId(id);
        setExplainLoading(true);
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(
                `http://localhost:8001/api/v1/explain/approval/${id}`,
                { headers }
            );
            if (!response.ok) throw new Error('Failed to fetch explanation');
            const data = await response.json();
            setExplanation(data);
        } catch (error) {
            console.error('Failed to fetch explanation:', error);
            showMessage('Failed to load explanation', 'error');
            setExplainItemId(null);
        } finally {
            setExplainLoading(false);
        }
    }, [showMessage]);

    const closeExplain = useCallback(() => {
        setExplanation(null);
        setExplainItemId(null);
    }, []);

    // ── Fetch pending approvals ──
    const fetchApprovals = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('pending_approvals')
                .select('*, campaigns(name), keywords(keyword_text)')
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setApprovals((data || []) as PendingApproval[]);
        } catch (error) {
            console.error('Failed to fetch approvals:', error);
            showMessage('Failed to load approval queue', 'error');
        } finally {
            setLoading(false);
        }
    }, [showMessage]);

    useEffect(() => {
        fetchApprovals();
    }, [fetchApprovals]);

    // ── Approve single item ──
    const handleApprove = useCallback(async (id: string) => {
        setProcessing((prev) => new Set(prev).add(id));
        try {
            const headers = await getAuthHeaders('application/json');
            const response = await fetch(`http://localhost:8001/api/v1/approvals/${id}/approve`, {
                method: 'POST',
                headers,
            });
            if (!response.ok) throw new Error('Approve failed');
            setApprovals((prev) => prev.filter((a) => a.id !== id));
            showMessage('Item approved');
        } catch (error) {
            console.error('Failed to approve:', error);
            showMessage('Failed to approve item', 'error');
        } finally {
            setProcessing((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    }, [showMessage]);

    // ── Reject single item ──
    const handleReject = useCallback(async (id: string) => {
        setProcessing((prev) => new Set(prev).add(id));
        try {
            const headers = await getAuthHeaders('application/json');
            const response = await fetch(`http://localhost:8001/api/v1/approvals/${id}/reject`, {
                method: 'POST',
                headers,
            });
            if (!response.ok) throw new Error('Reject failed');
            setApprovals((prev) => prev.filter((a) => a.id !== id));
            showMessage('Item rejected');
        } catch (error) {
            console.error('Failed to reject:', error);
            showMessage('Failed to reject item', 'error');
        } finally {
            setProcessing((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    }, [showMessage]);

    // ── Approve All Safe (confidence >= 0.70) ──
    const handleApproveAllSafe = useCallback(async () => {
        const safeItems = approvals.filter(
            (a) => a.confidence !== null && a.confidence >= 0.70
        );
        if (safeItems.length === 0) {
            showMessage('No items with confidence >= 70%', 'error');
            return;
        }

        const ids = safeItems.map((a) => a.id);
        setProcessing(new Set(ids));

        let approved = 0;
        let failed = 0;

        for (const item of safeItems) {
            try {
                const headers = await getAuthHeaders('application/json');
                const response = await fetch(
                    `http://localhost:8001/api/v1/approvals/${item.id}/approve`,
                    { method: 'POST', headers }
                );
                if (!response.ok) throw new Error('Approve failed');
                approved++;
            } catch {
                failed++;
            }
        }

        setApprovals((prev) => prev.filter((a) => !ids.includes(a.id) || failed > 0));
        if (failed > 0) {
            await fetchApprovals();
        }
        setProcessing(new Set());
        showMessage(
            `Batch approved ${approved} items${failed > 0 ? ` (${failed} failed)` : ''}`
        );
    }, [approvals, fetchApprovals, showMessage]);

    // ── Keyboard shortcuts ──
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Skip if user is typing in an input
            if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement ||
                e.target instanceof HTMLSelectElement
            ) {
                return;
            }

            switch (e.key) {
                case 'j':
                    setSelectedIndex((prev) =>
                        Math.min(prev + 1, approvals.length - 1)
                    );
                    break;
                case 'k':
                    setSelectedIndex((prev) => Math.max(prev - 1, 0));
                    break;
                case 'a': {
                    const item = approvals[selectedIndex];
                    if (item && !processing.has(item.id)) {
                        handleApprove(item.id);
                    }
                    break;
                }
                case 'r': {
                    const item = approvals[selectedIndex];
                    if (item && !processing.has(item.id)) {
                        handleReject(item.id);
                    }
                    break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [approvals, selectedIndex, processing, handleApprove, handleReject]);

    // ── Keep selectedIndex in bounds ──
    useEffect(() => {
        if (selectedIndex >= approvals.length && approvals.length > 0) {
            setSelectedIndex(approvals.length - 1);
        }
    }, [approvals.length, selectedIndex]);

    // ── Computed values ──
    const totalPending = approvals.length;
    const bidChangeCount = approvals.filter((a) => a.action_type === 'bid_change').length;
    const negKeywordCount = approvals.filter((a) => a.action_type === 'negative_keyword').length;
    const budgetChangeCount = approvals.filter((a) => a.action_type === 'budget_change').length;
    const safeCount = approvals.filter(
        (a) => a.confidence !== null && a.confidence >= 0.70
    ).length;

    // ── Render ──
    return (
        <div className="min-h-screen p-6 lg:p-8 space-y-5">
            {/* ── Header ── */}
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-wider flex items-center gap-4">
                        <span className="text-prime-energon">Approval</span>{' '}
                        <span className="text-prime-silver">Queue</span>
                        {totalPending > 0 && (
                            <span className="text-sm px-3 py-1 bg-prime-energon/15 text-prime-energon border border-prime-energon/30 font-bold chamfer-sm">
                                {totalPending}
                            </span>
                        )}
                    </h1>
                    <p className="text-prime-gunmetal text-xs mt-1 uppercase tracking-widest font-semibold">
                        Unified human approval for bid changes, budgets, and negative keywords
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {safeCount > 0 && (
                        <button
                            onClick={handleApproveAllSafe}
                            disabled={processing.size > 0}
                            className="px-6 py-2.5 bg-emerald-500 text-white font-bold text-xs uppercase tracking-widest hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all chamfer-sm"
                        >
                            {processing.size > 0
                                ? 'Processing...'
                                : `Approve All Safe (${safeCount})`}
                        </button>
                    )}
                    <button
                        onClick={fetchApprovals}
                        disabled={loading}
                        className="px-4 py-2 bg-prime-dark border border-prime-gunmetal/30 text-prime-gunmetal text-xs font-bold uppercase tracking-widest hover:text-prime-silver hover:border-prime-gunmetal transition-all chamfer-sm disabled:opacity-50"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {/* ── Messages ── */}
            {message && (
                <div
                    className={`px-4 py-3 text-sm chamfer-sm ${messageType === 'success'
                            ? 'bg-emerald-500/5 border border-emerald-500/20 text-emerald-400'
                            : 'bg-red-500/5 border border-red-500/20 text-red-400'
                        }`}
                >
                    {message}
                </div>
            )}

            {/* ── Summary Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-prime-dark/80 border border-prime-energon/15 p-5 chamfer-sm">
                    <span className="text-[10px] text-prime-gunmetal uppercase tracking-widest">
                        Total Pending
                    </span>
                    <div className="text-prime-energon font-bold text-2xl mt-1">
                        {totalPending}
                    </div>
                </div>
                <div className="bg-prime-dark/80 border border-prime-energon/15 p-5 chamfer-sm">
                    <span className="text-[10px] text-prime-gunmetal uppercase tracking-widest">
                        Bid Changes
                    </span>
                    <div className="text-prime-silver font-bold text-2xl mt-1">
                        {bidChangeCount}
                    </div>
                </div>
                <div className="bg-prime-dark/80 border border-red-500/20 p-5 chamfer-sm">
                    <span className="text-[10px] text-prime-gunmetal uppercase tracking-widest">
                        Negative Keywords
                    </span>
                    <div className="text-red-400 font-bold text-2xl mt-1">
                        {negKeywordCount}
                    </div>
                </div>
                <div className="bg-prime-dark/80 border border-prime-blue/20 p-5 chamfer-sm">
                    <span className="text-[10px] text-prime-gunmetal uppercase tracking-widest">
                        Budget Changes
                    </span>
                    <div className="text-prime-blue font-bold text-2xl mt-1">
                        {budgetChangeCount}
                    </div>
                </div>
            </div>

            {/* ── Keyboard Shortcuts Hint ── */}
            <div className="flex items-center gap-4 text-[10px] text-prime-gunmetal/60 uppercase tracking-widest">
                <span>
                    <kbd className="px-1.5 py-0.5 bg-prime-darker border border-prime-gunmetal/20 text-prime-gunmetal chamfer-sm">j</kbd>
                    {' / '}
                    <kbd className="px-1.5 py-0.5 bg-prime-darker border border-prime-gunmetal/20 text-prime-gunmetal chamfer-sm">k</kbd>
                    {' Navigate'}
                </span>
                <span>
                    <kbd className="px-1.5 py-0.5 bg-prime-darker border border-prime-gunmetal/20 text-prime-gunmetal chamfer-sm">a</kbd>
                    {' Approve'}
                </span>
                <span>
                    <kbd className="px-1.5 py-0.5 bg-prime-darker border border-prime-gunmetal/20 text-prime-gunmetal chamfer-sm">r</kbd>
                    {' Reject'}
                </span>
            </div>

            {/* ── Loading State ── */}
            {loading && (
                <Spinner
                    text="Loading approval queue..."
                    subtext="Fetching pending items requiring human review"
                />
            )}

            {/* ── Approval Table ── */}
            {!loading && approvals.length > 0 && (
                <div className="bg-prime-dark/80 backdrop-blur-sm border border-prime-gunmetal/30 p-6 chamfer">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-bold text-prime-silver uppercase tracking-widest flex items-center gap-3">
                            Pending Items
                            <span className="text-[10px] px-2 py-0.5 bg-prime-black/50 text-prime-gunmetal font-semibold chamfer-sm">
                                {totalPending} items
                            </span>
                        </h3>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-prime-gunmetal/20 text-prime-gunmetal">
                                    <th className="text-left py-3 px-2 text-[10px] uppercase tracking-widest">
                                        Type
                                    </th>
                                    <th className="text-left py-3 px-2 text-[10px] uppercase tracking-widest">
                                        Campaign
                                    </th>
                                    <th className="text-left py-3 px-2 text-[10px] uppercase tracking-widest">
                                        Keyword / Term
                                    </th>
                                    <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">
                                        Current
                                    </th>
                                    <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">
                                        Recommended
                                    </th>
                                    <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">
                                        Change%
                                    </th>
                                    <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">
                                        Confidence
                                    </th>
                                    <th className="text-left py-3 px-2 text-[10px] uppercase tracking-widest">
                                        Reasons
                                    </th>
                                    <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {approvals.map((item, index) => {
                                    const isSelected = index === selectedIndex;
                                    const isProcessing = processing.has(item.id);
                                    const changePct = item.change_pct ?? (
                                        item.current_value > 0
                                            ? ((item.recommended_value - item.current_value) / item.current_value) * 100
                                            : 0
                                    );

                                    return (
                                        <tr
                                            key={item.id}
                                            onClick={() => setSelectedIndex(index)}
                                            className={`border-b border-prime-gunmetal/10 transition-colors cursor-pointer ${isSelected
                                                    ? 'bg-prime-energon/5 border-l-2 border-l-prime-energon'
                                                    : 'hover:bg-prime-darker/50'
                                                } ${isProcessing ? 'opacity-50' : ''}`}
                                        >
                                            {/* Type */}
                                            <td className="py-3 px-2">
                                                <span
                                                    className={`inline-block text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 border chamfer-sm ${ACTION_COLORS[item.action_type]
                                                        }`}
                                                >
                                                    {ACTION_LABELS[item.action_type]}
                                                </span>
                                            </td>

                                            {/* Campaign */}
                                            <td className="py-3 px-2 text-prime-silver font-semibold">
                                                {item.campaigns?.name || 'Unknown'}
                                            </td>

                                            {/* Keyword / Term */}
                                            <td className="py-3 px-2 text-prime-gunmetal">
                                                {item.keywords?.keyword_text || (
                                                    item.metadata?.term || '--'
                                                )}
                                            </td>

                                            {/* Current Value */}
                                            <td className="py-3 px-2 text-right text-prime-gunmetal">
                                                ${item.current_value.toFixed(2)}
                                            </td>

                                            {/* Recommended Value */}
                                            <td className="py-3 px-2 text-right font-bold text-prime-energon">
                                                ${item.recommended_value.toFixed(2)}
                                            </td>

                                            {/* Change % */}
                                            <td className="py-3 px-2 text-right">
                                                {Math.abs(changePct) < 0.01 ? (
                                                    <span className="text-prime-gunmetal/50">--</span>
                                                ) : (
                                                    <span
                                                        className={
                                                            changePct > 0
                                                                ? 'text-emerald-400'
                                                                : 'text-prime-red'
                                                        }
                                                    >
                                                        {changePct > 0 ? '+' : ''}
                                                        {changePct.toFixed(1)}%
                                                    </span>
                                                )}
                                            </td>

                                            {/* Confidence */}
                                            <td className="py-3 px-2 text-right">
                                                {item.confidence !== null ? (
                                                    <ConfidenceBar value={item.confidence} />
                                                ) : (
                                                    <span className="text-prime-gunmetal/40 text-[10px]">
                                                        --
                                                    </span>
                                                )}
                                            </td>

                                            {/* Reasons */}
                                            <td className="py-3 px-2 max-w-[200px]">
                                                {item.reasons && item.reasons.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {item.reasons.slice(0, 2).map((reason, i) => (
                                                            <span
                                                                key={i}
                                                                className="text-[10px] text-prime-gunmetal bg-prime-black/40 px-1.5 py-0.5 chamfer-sm truncate max-w-[160px]"
                                                                title={reason}
                                                            >
                                                                {reason}
                                                            </span>
                                                        ))}
                                                        {item.reasons.length > 2 && (
                                                            <span className="text-[10px] text-prime-gunmetal/50">
                                                                +{item.reasons.length - 2}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-prime-gunmetal/40 text-[10px]">
                                                        --
                                                    </span>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="py-3 px-2 text-right">
                                                <div className="flex items-center gap-2 justify-end">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleExplain(item.id);
                                                        }}
                                                        disabled={explainLoading && explainItemId === item.id}
                                                        className="text-xs px-2 py-1 border border-prime-blue/30 text-prime-blue hover:bg-prime-blue/10 transition-colors font-bold uppercase tracking-wider chamfer-sm disabled:opacity-30"
                                                        title="Why this recommendation?"
                                                    >
                                                        {explainLoading && explainItemId === item.id ? '...' : 'Why?'}
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleApprove(item.id);
                                                        }}
                                                        disabled={isProcessing}
                                                        className="text-xs px-3 py-1 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors font-bold uppercase tracking-wider chamfer-sm disabled:opacity-30 disabled:cursor-not-allowed"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleReject(item.id);
                                                        }}
                                                        disabled={isProcessing}
                                                        className="text-xs px-3 py-1 border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors font-bold uppercase tracking-wider chamfer-sm disabled:opacity-30 disabled:cursor-not-allowed"
                                                    >
                                                        Reject
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
            )}

            {/* ── Empty State ── */}
            {!loading && approvals.length === 0 && (
                <div className="bg-prime-dark/80 backdrop-blur-sm border border-prime-gunmetal/30 p-6 chamfer text-center py-16">
                    <div className="text-emerald-400 text-4xl mb-4">&#10003;</div>
                    <p className="text-prime-silver text-sm font-bold uppercase tracking-widest mb-2">
                        All Clear
                    </p>
                    <p className="text-prime-gunmetal text-xs uppercase tracking-widest">
                        No items pending approval. The queue is empty.
                    </p>
                </div>
            )}

            {/* ── Explainability Slide-Over Panel ── */}
            {(explanation || (explainLoading && explainItemId)) && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={closeExplain}
                    />

                    {/* Panel */}
                    <div className="relative w-full max-w-lg bg-prime-dark border-l border-prime-energon/20 overflow-y-auto animate-slide-in-right">
                        <div className="p-6 space-y-6">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-black uppercase tracking-wider">
                                    <span className="text-prime-blue">Why</span>{' '}
                                    <span className="text-prime-silver">This?</span>
                                </h2>
                                <button
                                    onClick={closeExplain}
                                    className="text-prime-gunmetal hover:text-prime-silver text-lg transition-colors"
                                >
                                    ✕
                                </button>
                            </div>

                            {explainLoading ? (
                                <Spinner text="Analyzing..." subtext="Generating explanation from performance data" />
                            ) : explanation ? (
                                <>
                                    {/* Risk Level Badge */}
                                    <div className="flex items-center gap-3">
                                        <span
                                            className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 border chamfer-sm ${explanation.risk_level === 'low'
                                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                                    : explanation.risk_level === 'medium'
                                                        ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                                                        : 'bg-red-500/15 text-red-400 border-red-500/30'
                                                }`}
                                        >
                                            {explanation.risk_level} risk
                                        </span>
                                        {explanation.recommendation_action && (
                                            <span className="text-xs text-prime-energon font-bold">
                                                {explanation.recommendation_action}
                                            </span>
                                        )}
                                    </div>

                                    {/* Summary */}
                                    <div className="bg-prime-darker/50 border border-prime-gunmetal/20 p-4 chamfer-sm">
                                        <p className="text-sm text-prime-silver leading-relaxed">
                                            {explanation.summary}
                                        </p>
                                    </div>

                                    {/* Factors */}
                                    {explanation.factors && explanation.factors.length > 0 && (
                                        <div>
                                            <h3 className="text-[10px] text-prime-gunmetal uppercase tracking-widest font-bold mb-3">
                                                Contributing Factors
                                            </h3>
                                            <div className="space-y-2">
                                                {explanation.factors.map((f, i) => (
                                                    <div
                                                        key={i}
                                                        className="bg-prime-darker/30 border border-prime-gunmetal/15 p-3 chamfer-sm"
                                                    >
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-xs font-bold text-prime-silver">
                                                                {f.factor}
                                                            </span>
                                                            <span
                                                                className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 chamfer-sm ${f.impact === 'critical'
                                                                        ? 'bg-red-500/20 text-red-400'
                                                                        : f.impact === 'high'
                                                                            ? 'bg-prime-energon/15 text-prime-energon'
                                                                            : f.impact === 'medium'
                                                                                ? 'bg-yellow-500/15 text-yellow-400'
                                                                                : 'bg-prime-gunmetal/15 text-prime-gunmetal'
                                                                    }`}
                                                            >
                                                                {f.impact}
                                                            </span>
                                                        </div>
                                                        <p className="text-[11px] text-prime-gunmetal leading-relaxed">
                                                            {f.detail}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Historical Context */}
                                    {explanation.historical_context && (
                                        <div>
                                            <h3 className="text-[10px] text-prime-gunmetal uppercase tracking-widest font-bold mb-2">
                                                Historical Context
                                            </h3>
                                            <p className="text-[11px] text-prime-gunmetal/80 bg-prime-darker/30 border border-prime-gunmetal/15 p-3 chamfer-sm leading-relaxed">
                                                {explanation.historical_context}
                                            </p>
                                        </div>
                                    )}
                                </>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
