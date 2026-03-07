import { useState, useEffect, useCallback } from 'react';
import { experimentApi, campaignApi } from '../api/client';
import type { Campaign, BidExperiment, ExperimentAnalysis, ExperimentGroupMetrics } from '../types';
import { fmt, fmtPct, fmtDollar } from '../utils/formatting';

const MODEL_LABELS: Record<string, string> = {
    thompson: 'Model Alpha',
    q_learning: 'Model Bravo',
    ensemble: 'Combined',
};

const MODEL_OPTIONS = [
    { value: 'thompson', label: 'Model Alpha' },
    { value: 'q_learning', label: 'Model Bravo' },
    { value: 'ensemble', label: 'Combined' },
];

function StatusBadge({ status }: { status: BidExperiment['status'] }) {
    const styles: Record<string, string> = {
        draft: 'text-prime-gunmetal border-prime-gunmetal/30',
        running: 'text-prime-energon border-prime-energon/30 animate-pulse',
        completed: 'text-emerald-400 border-emerald-500/30',
        cancelled: 'text-prime-red border-prime-red/30',
    };
    return (
        <span className={`inline-block px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest border ${styles[status]} chamfer-sm`}>
            {status}
        </span>
    );
}

function SignificanceBadge({ confidence }: { confidence: number }) {
    const pct = confidence * 100;
    let label: string;
    let color: string;
    if (pct >= 95) {
        label = 'Strong';
        color = 'text-emerald-400 border-emerald-500/30';
    } else if (pct >= 90) {
        label = 'Moderate';
        color = 'text-yellow-400 border-yellow-500/30';
    } else {
        label = 'Insufficient';
        color = 'text-prime-gunmetal border-prime-gunmetal/30';
    }
    return (
        <span className={`inline-block px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest border ${color} chamfer-sm`}>
            {label} ({pct.toFixed(1)}%)
        </span>
    );
}

function MetricRow({ label, a, b, winner, format }: { label: string; a: number; b: number; winner: 'A' | 'B' | 'tie'; format: (v: number) => string }) {
    const aWins = winner === 'A';
    const bWins = winner === 'B';
    return (
        <div className="flex items-center justify-between py-2 border-b border-prime-gunmetal/10 last:border-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-prime-gunmetal w-20">{label}</span>
            <span className={`text-sm font-mono font-bold ${aWins ? 'text-prime-energon' : 'text-prime-silver'}`}>
                {format(a)}
            </span>
            <span className="text-prime-gunmetal/30 text-xs">vs</span>
            <span className={`text-sm font-mono font-bold ${bWins ? 'text-prime-energon' : 'text-prime-silver'}`}>
                {format(b)}
            </span>
        </div>
    );
}

function AnalysisPanel({ analysis, onClose }: { analysis: ExperimentAnalysis; onClose: () => void }) {
    const a = analysis.group_a;
    const b = analysis.group_b;

    return (
        <div className="bg-prime-dark/80 backdrop-blur-sm border border-prime-energon/15 p-6 chamfer space-y-5">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-prime-silver uppercase tracking-widest">Experiment Analysis</h3>
                <button onClick={onClose} className="text-prime-gunmetal hover:text-prime-silver text-xs uppercase tracking-widest transition-colors">
                    Close
                </button>
            </div>

            {/* Winner + Significance */}
            <div className="flex items-center gap-4 flex-wrap">
                <div className="px-4 py-2 bg-prime-black/40 border border-prime-energon/15 chamfer-sm">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-prime-gunmetal mr-2">Winner</span>
                    <span className="text-prime-energon font-bold text-sm">
                        {analysis.winner === 'tie' ? 'Tie' : `Group ${analysis.winner} (${MODEL_LABELS[analysis.winner === 'A' ? analysis.model_a : analysis.model_b] || (analysis.winner === 'A' ? analysis.model_a : analysis.model_b)})`}
                    </span>
                </div>
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-prime-gunmetal mr-2">Significance</span>
                    <SignificanceBadge confidence={analysis.confidence} />
                </div>
            </div>

            {/* Side-by-side comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Group A */}
                <div className="bg-prime-darker border border-prime-gunmetal/30 p-5 chamfer-sm">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-prime-gunmetal">Group A</span>
                        <span className="text-xs font-bold text-prime-energon">{MODEL_LABELS[analysis.model_a] || analysis.model_a}</span>
                        {analysis.winner === 'A' && (
                            <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-widest chamfer-sm">
                                Winner
                            </span>
                        )}
                    </div>
                    <GroupMetricsBlock metrics={a} />
                </div>

                {/* Group B */}
                <div className="bg-prime-darker border border-prime-gunmetal/30 p-5 chamfer-sm">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-prime-gunmetal">Group B</span>
                        <span className="text-xs font-bold text-prime-energon">{MODEL_LABELS[analysis.model_b] || analysis.model_b}</span>
                        {analysis.winner === 'B' && (
                            <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-widest chamfer-sm">
                                Winner
                            </span>
                        )}
                    </div>
                    <GroupMetricsBlock metrics={b} />
                </div>
            </div>

            {/* Head-to-head comparison */}
            <div className="bg-prime-black/40 border border-prime-gunmetal/30 p-5 chamfer-sm">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-prime-gunmetal mb-3">Head-to-Head</h4>
                <MetricRow label="ACoS" a={a.acos} b={b.acos} winner={analysis.winner} format={fmtPct} />
                <MetricRow label="CTR" a={a.ctr} b={b.ctr} winner={analysis.winner} format={fmtPct} />
                <MetricRow label="CVR" a={a.cvr} b={b.cvr} winner={analysis.winner} format={fmtPct} />
                <MetricRow label="ROAS" a={a.roas} b={b.roas} winner={analysis.winner} format={fmt} />
                <MetricRow label="Spend" a={a.spend} b={b.spend} winner={analysis.winner} format={fmtDollar} />
                <MetricRow label="Sales" a={a.sales} b={b.sales} winner={analysis.winner} format={fmtDollar} />
                <MetricRow label="Orders" a={a.orders} b={b.orders} winner={analysis.winner} format={(v) => String(Math.round(v))} />
            </div>
        </div>
    );
}

function GroupMetricsBlock({ metrics }: { metrics: ExperimentGroupMetrics }) {
    return (
        <div className="space-y-2">
            <div className="flex justify-between text-sm">
                <span className="text-prime-gunmetal">ACoS</span>
                <span className="text-prime-silver font-mono font-bold">{metrics.acos.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between text-sm">
                <span className="text-prime-gunmetal">CTR</span>
                <span className="text-prime-silver font-mono font-bold">{metrics.ctr.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between text-sm">
                <span className="text-prime-gunmetal">CVR</span>
                <span className="text-prime-silver font-mono font-bold">{metrics.cvr.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between text-sm">
                <span className="text-prime-gunmetal">ROAS</span>
                <span className="text-prime-silver font-mono font-bold">{metrics.roas.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
                <span className="text-prime-gunmetal">Spend</span>
                <span className="text-prime-silver font-mono font-bold">${metrics.spend.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
                <span className="text-prime-gunmetal">Sales</span>
                <span className="text-emerald-400 font-mono font-bold">${metrics.sales.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
                <span className="text-prime-gunmetal">Orders</span>
                <span className="text-prime-silver font-mono font-bold">{Math.round(metrics.orders)}</span>
            </div>
        </div>
    );
}

export default function Experiments() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [experiments, setExperiments] = useState<BidExperiment[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    // Create form state
    const [formOpen, setFormOpen] = useState(false);
    const [formCampaignId, setFormCampaignId] = useState('');
    const [formName, setFormName] = useState('');
    const [formModelA, setFormModelA] = useState('thompson');
    const [formModelB, setFormModelB] = useState('q_learning');
    const [formSplit, setFormSplit] = useState(50);
    const [creating, setCreating] = useState(false);

    // Analysis state
    const [analysisMap, setAnalysisMap] = useState<Record<string, ExperimentAnalysis>>({});
    const [activeAnalysis, setActiveAnalysis] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [campaignData, experimentData] = await Promise.all([
                campaignApi.getCampaigns(),
                experimentApi.getAll(),
            ]);
            setCampaigns(campaignData);
            setExperiments(experimentData);
        } catch (err) {
            console.error('Failed to load experiments:', err);
            setMessage({ text: 'Failed to load data', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const flash = (text: string, type: 'success' | 'error') => {
        setMessage({ text, type });
        setTimeout(() => setMessage(null), 4000);
    };

    const handleCreate = async () => {
        if (!formCampaignId || !formName.trim()) {
            flash('Please select a campaign and enter a name', 'error');
            return;
        }
        if (formModelA === formModelB) {
            flash('Model A and Model B must be different', 'error');
            return;
        }
        setCreating(true);
        try {
            await experimentApi.create(formCampaignId, formName.trim(), formModelA, formModelB, formSplit);
            flash('Experiment created successfully', 'success');
            setFormName('');
            setFormCampaignId('');
            setFormSplit(50);
            setFormOpen(false);
            await loadData();
        } catch (err) {
            console.error('Failed to create experiment:', err);
            flash('Failed to create experiment', 'error');
        } finally {
            setCreating(false);
        }
    };

    const handleStart = async (id: string) => {
        setActionLoading(id);
        try {
            await experimentApi.start(id);
            flash('Experiment started', 'success');
            await loadData();
        } catch (err) {
            console.error('Failed to start experiment:', err);
            flash('Failed to start experiment', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleStop = async (id: string) => {
        setActionLoading(id);
        try {
            await experimentApi.stop(id);
            flash('Experiment stopped', 'success');
            await loadData();
        } catch (err) {
            console.error('Failed to stop experiment:', err);
            flash('Failed to stop experiment', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleRecordMetrics = async (id: string) => {
        setActionLoading(id);
        try {
            const count = await experimentApi.recordMetrics(id);
            flash(`Recorded ${count} metric snapshots`, 'success');
        } catch (err) {
            console.error('Failed to record metrics:', err);
            flash('Failed to record metrics', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleAnalyze = async (id: string) => {
        setActionLoading(id);
        try {
            const result = await experimentApi.analyze(id);
            setAnalysisMap(prev => ({ ...prev, [id]: result }));
            setActiveAnalysis(id);
            await loadData();
        } catch (err) {
            console.error('Failed to analyze experiment:', err);
            flash('Failed to analyze experiment', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '--';
        return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const activeCampaigns = campaigns.filter(c => c.status === 'active');

    return (
        <div className="min-h-screen p-6 lg:p-8 space-y-5">
            {/* Header */}
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-wider">
                        <span className="text-prime-energon">A/B</span>{' '}
                        <span className="text-prime-silver">Tests</span>
                    </h1>
                    <p className="text-prime-gunmetal text-xs mt-1 uppercase tracking-widest font-semibold">
                        Experiment with bid strategies
                    </p>
                </div>
                <button
                    onClick={() => setFormOpen(!formOpen)}
                    className="px-5 py-2.5 bg-prime-dark border border-prime-energon/20 text-prime-energon text-xs font-bold uppercase tracking-widest hover:border-prime-energon/40 transition-all chamfer-sm"
                >
                    {formOpen ? 'Close Form' : '+ New Experiment'}
                </button>
            </div>

            {/* Flash message */}
            {message && (
                <div className={`px-4 py-3 text-sm chamfer-sm ${
                    message.type === 'success'
                        ? 'bg-emerald-500/5 border border-emerald-500/20 text-emerald-400'
                        : 'bg-prime-red/5 border border-prime-red/20 text-prime-red'
                }`}>
                    {message.text}
                </div>
            )}

            {/* Create Experiment Form */}
            {formOpen && (
                <div className="bg-prime-dark/80 backdrop-blur-sm border border-prime-energon/15 p-6 chamfer space-y-4">
                    <h3 className="text-sm font-bold text-prime-silver uppercase tracking-widest mb-4">Create Experiment</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Campaign */}
                        <div>
                            <label className="block text-[10px] font-bold text-prime-gunmetal mb-2 uppercase tracking-widest">Campaign</label>
                            <select value={formCampaignId} onChange={e => setFormCampaignId(e.target.value)} className="input">
                                <option value="">Select campaign...</option>
                                {activeCampaigns.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Name */}
                        <div>
                            <label className="block text-[10px] font-bold text-prime-gunmetal mb-2 uppercase tracking-widest">Experiment Name</label>
                            <input
                                type="text"
                                value={formName}
                                onChange={e => setFormName(e.target.value)}
                                placeholder="e.g. Thompson vs Q-Learning Feb"
                                className="input"
                            />
                        </div>

                        {/* Model A */}
                        <div>
                            <label className="block text-[10px] font-bold text-prime-gunmetal mb-2 uppercase tracking-widest">Model A</label>
                            <select value={formModelA} onChange={e => setFormModelA(e.target.value)} className="input">
                                {MODEL_OPTIONS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Model B */}
                        <div>
                            <label className="block text-[10px] font-bold text-prime-gunmetal mb-2 uppercase tracking-widest">Model B</label>
                            <select value={formModelB} onChange={e => setFormModelB(e.target.value)} className="input">
                                {MODEL_OPTIONS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Split */}
                        <div>
                            <label className="block text-[10px] font-bold text-prime-gunmetal mb-2 uppercase tracking-widest">
                                Split: {formSplit}% / {100 - formSplit}%
                            </label>
                            <input
                                type="range"
                                min={30}
                                max={70}
                                value={formSplit}
                                onChange={e => setFormSplit(Number(e.target.value))}
                                className="w-full accent-prime-energon"
                            />
                            <div className="flex justify-between text-[10px] text-prime-gunmetal mt-1">
                                <span>Group A: {formSplit}%</span>
                                <span>Group B: {100 - formSplit}%</span>
                            </div>
                        </div>

                        {/* Submit */}
                        <div className="flex items-end">
                            <button
                                onClick={handleCreate}
                                disabled={creating}
                                className="btn-primary w-full disabled:opacity-50"
                            >
                                {creating ? 'Creating...' : 'Create Experiment'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Analysis Panel */}
            {activeAnalysis && analysisMap[activeAnalysis] && (
                <AnalysisPanel
                    analysis={analysisMap[activeAnalysis]}
                    onClose={() => setActiveAnalysis(null)}
                />
            )}

            {/* Experiments List */}
            {loading ? (
                <div className="text-center py-16">
                    <div className="w-10 h-10 border-2 border-prime-energon/30 border-t-prime-energon rounded-full animate-spin mx-auto mb-4" />
                    <div className="text-prime-energon text-sm font-bold uppercase tracking-widest">Loading experiments...</div>
                </div>
            ) : experiments.length === 0 ? (
                <div className="text-center py-16 bg-prime-dark/80 border border-dashed border-prime-gunmetal/30 chamfer">
                    <p className="text-prime-gunmetal text-sm uppercase tracking-wider">
                        No experiments yet.<br />
                        Create one to start A/B testing bid strategies.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-prime-silver uppercase tracking-widest">
                        All Experiments ({experiments.length})
                    </h3>

                    {experiments.map(exp => (
                        <div key={exp.id} className="bg-prime-dark/80 backdrop-blur-sm border border-prime-gunmetal/30 p-5 chamfer hover:border-prime-energon/15 transition-colors">
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                {/* Left: Info */}
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <h4 className="text-prime-silver font-bold text-base">{exp.name}</h4>
                                        <StatusBadge status={exp.status} />
                                        {exp.winner && (
                                            <span className="px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-widest chamfer-sm">
                                                Winner: Group {exp.winner} ({MODEL_LABELS[exp.winner === 'A' ? exp.model_a : exp.model_b] || exp.winner})
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-4 flex-wrap text-xs">
                                        <span className="text-prime-gunmetal">
                                            <span className="text-[10px] font-bold uppercase tracking-widest">Campaign:</span>{' '}
                                            <span className="text-prime-silver font-mono">{exp.campaign_id.slice(0, 8)}...</span>
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-6 flex-wrap">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-prime-gunmetal">A:</span>
                                            <span className="px-2 py-0.5 bg-prime-black/40 border border-prime-energon/15 text-prime-energon text-[10px] font-bold uppercase tracking-widest chamfer-sm">
                                                {MODEL_LABELS[exp.model_a] || exp.model_a}
                                            </span>
                                        </div>
                                        <span className="text-prime-gunmetal/30 text-xs font-bold">vs</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-prime-gunmetal">B:</span>
                                            <span className="px-2 py-0.5 bg-prime-black/40 border border-prime-red/15 text-prime-red text-[10px] font-bold uppercase tracking-widest chamfer-sm">
                                                {MODEL_LABELS[exp.model_b] || exp.model_b}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-prime-gunmetal">Split:</span>
                                            <span className="text-prime-silver text-xs font-mono font-bold">{exp.split_percent}% / {100 - exp.split_percent}%</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 flex-wrap text-[10px] text-prime-gunmetal uppercase tracking-widest">
                                        <span>Created: {formatDate(exp.created_at)}</span>
                                        {exp.started_at && <span>Started: {formatDate(exp.started_at)}</span>}
                                        {exp.ended_at && <span>Ended: {formatDate(exp.ended_at)}</span>}
                                        {exp.confidence_level !== null && exp.confidence_level !== undefined && (
                                            <span>Confidence: {(exp.confidence_level * 100).toFixed(1)}%</span>
                                        )}
                                    </div>
                                </div>

                                {/* Right: Actions */}
                                <div className="flex items-center gap-2 flex-wrap lg:flex-nowrap">
                                    {exp.status === 'draft' && (
                                        <button
                                            onClick={() => handleStart(exp.id)}
                                            disabled={actionLoading === exp.id}
                                            className="px-4 py-2 bg-prime-dark border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-widest hover:border-emerald-500/50 hover:bg-emerald-500/5 disabled:opacity-50 transition-all chamfer-sm"
                                        >
                                            {actionLoading === exp.id ? '...' : 'Start'}
                                        </button>
                                    )}

                                    {exp.status === 'running' && (
                                        <>
                                            <button
                                                onClick={() => handleRecordMetrics(exp.id)}
                                                disabled={actionLoading === exp.id}
                                                className="px-4 py-2 bg-prime-dark border border-prime-energon/20 text-prime-energon text-[10px] font-bold uppercase tracking-widest hover:border-prime-energon/40 disabled:opacity-50 transition-all chamfer-sm"
                                            >
                                                {actionLoading === exp.id ? '...' : 'Record Metrics'}
                                            </button>
                                            <button
                                                onClick={() => handleStop(exp.id)}
                                                disabled={actionLoading === exp.id}
                                                className="px-4 py-2 bg-prime-dark border border-prime-red/30 text-prime-red text-[10px] font-bold uppercase tracking-widest hover:border-prime-red/50 hover:bg-prime-red/5 disabled:opacity-50 transition-all chamfer-sm"
                                            >
                                                {actionLoading === exp.id ? '...' : 'Stop'}
                                            </button>
                                            <button
                                                onClick={() => handleAnalyze(exp.id)}
                                                disabled={actionLoading === exp.id}
                                                className="px-4 py-2 bg-prime-dark border border-prime-silver/20 text-prime-silver text-[10px] font-bold uppercase tracking-widest hover:border-prime-silver/40 disabled:opacity-50 transition-all chamfer-sm"
                                            >
                                                {actionLoading === exp.id ? '...' : 'Analyze'}
                                            </button>
                                        </>
                                    )}

                                    {exp.status === 'completed' && (
                                        <button
                                            onClick={() => handleAnalyze(exp.id)}
                                            disabled={actionLoading === exp.id}
                                            className="px-4 py-2 bg-prime-dark border border-prime-energon/20 text-prime-energon text-[10px] font-bold uppercase tracking-widest hover:border-prime-energon/40 disabled:opacity-50 transition-all chamfer-sm"
                                        >
                                            {actionLoading === exp.id ? '...' : 'Analyze'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
