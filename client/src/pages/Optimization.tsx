import { useState, useEffect } from 'react';
import { campaignApi, thompsonApi, qLearningApi, ensembleApi } from '../api/client';
import type { BidRecommendation, QLearningRecommendation, EnsembleRecommendation } from '../api/client';
import type { Campaign } from '../types';
import { exportToCsv } from '../utils/export';

type OptimizationModel = 'thompson' | 'q-learning' | 'ensemble';

export default function Optimization() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [selectedCampaign, setSelectedCampaign] = useState<string>('');
    const [activeTab, setActiveTab] = useState<OptimizationModel>('thompson');

    const [thompsonRecs, setThompsonRecs] = useState<BidRecommendation[]>([]);
    const [qLearningRecs, setQLearningRecs] = useState<QLearningRecommendation[]>([]);
    const [ensembleRecs, setEnsembleRecs] = useState<EnsembleRecommendation[]>([]);

    const [loading, setLoading] = useState(false);
    const [applying, setApplying] = useState(false);
    const [applied, setApplied] = useState<Set<string>>(new Set());
    const [message, setMessage] = useState('');

    useEffect(() => { campaignApi.getCampaigns().then(setCampaigns).catch(console.error); }, []);

    useEffect(() => {
        setThompsonRecs([]); setQLearningRecs([]); setEnsembleRecs([]);
        setApplied(new Set()); setMessage('');
    }, [selectedCampaign, activeTab]);

    const handleGenerate = async () => {
        if (!selectedCampaign) return;
        setLoading(true); setApplied(new Set()); setMessage('');
        try {
            if (activeTab === 'thompson') { setThompsonRecs(await thompsonApi.getCampaignRecommendations(selectedCampaign)); }
            else if (activeTab === 'q-learning') { setQLearningRecs(await qLearningApi.getCampaignRecommendations(selectedCampaign)); }
            else { setEnsembleRecs(await ensembleApi.getCampaignRecommendations(selectedCampaign)); }
        } catch (error) { console.error('Failed to generate recommendations:', error); setMessage('Failed to generate recommendations'); }
        finally { setLoading(false); }
    };

    const tabLabels: Record<OptimizationModel, string> = {
        'thompson': 'Model Alpha',
        'q-learning': 'Model Bravo',
        'ensemble': 'Combined Model',
    };

    const currentRecs = activeTab === 'thompson' ? thompsonRecs : activeTab === 'q-learning' ? qLearningRecs : ensembleRecs;
    const changedRecs = currentRecs.filter(r => r.recommended_bid !== r.current_bid);
    const unchangedCount = currentRecs.length - changedRecs.length;

    const handleApplyOne = async (rec: any) => {
        try {
            if (activeTab === 'thompson') { await thompsonApi.applyRecommendation(rec.keyword_id, rec.recommended_bid); }
            else if (activeTab === 'q-learning') { await qLearningApi.applyRecommendation(rec.keyword_id, rec.recommended_bid); }
            else { await ensembleApi.applyRecommendation(rec.keyword_id, rec.recommended_bid); }
            setApplied(prev => new Set(prev).add(rec.keyword_id));
        } catch (error) { console.error('Failed to apply:', error); }
    };

    const handleApplyAll = async () => {
        setApplying(true);
        try {
            const unapplied = currentRecs.filter(r => !applied.has(r.keyword_id) && r.recommended_bid !== r.current_bid) as any[];
            let count = 0;
            if (activeTab === 'thompson') { count = await thompsonApi.applyAll(unapplied); }
            else if (activeTab === 'q-learning') { count = await qLearningApi.applyAll(unapplied); }
            else { count = await ensembleApi.applyAll(unapplied); }
            setApplied(new Set(currentRecs.map(r => r.keyword_id)));
            setMessage(`Applied ${count} bid changes successfully via ${tabLabels[activeTab]}`);
        } catch (error) { console.error('Failed to apply all:', error); setMessage('Failed to apply some changes'); }
        finally { setApplying(false); }
    };

    return (
        <div className="min-h-screen p-6 lg:p-8 space-y-5">
            {/* Header */}
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-wider">
                        <span className="text-prime-energon">Bid</span>{' '}
                        <span className="text-prime-silver">Optimization</span>
                    </h1>
                    <p className="text-prime-gunmetal text-xs mt-1 uppercase tracking-widest font-semibold">AI-driven bid optimization and recommendations</p>
                </div>
                {currentRecs.length > 0 && (
                    <button onClick={() => exportToCsv(`bids-${activeTab}-export`, currentRecs)}
                        className="px-4 py-2 bg-prime-dark border border-prime-gunmetal/30 text-prime-gunmetal text-xs font-bold uppercase tracking-widest hover:text-prime-silver hover:border-prime-gunmetal transition-all chamfer-sm">
                        Export Bids CSV
                    </button>
                )}
            </div>

            {/* Model Tabs */}
            <div className="flex gap-2">
                <TabButton active={activeTab === 'thompson'} onClick={() => setActiveTab('thompson')} title="Model Alpha" subtitle="Primary optimizer" />
                <TabButton active={activeTab === 'q-learning'} onClick={() => setActiveTab('q-learning')} title="Model Bravo" subtitle="Adaptive optimizer" />
                <TabButton active={activeTab === 'ensemble'} onClick={() => setActiveTab('ensemble')} title="Combined Model" subtitle="Multi-model blend" />
            </div>

            {/* Controls */}
            <div className="bg-prime-dark/80 backdrop-blur-sm border border-prime-energon/15 p-5 chamfer">
                <div className="flex flex-wrap items-end gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-[10px] font-bold text-prime-gunmetal mb-2 uppercase tracking-widest">Campaign</label>
                        <select value={selectedCampaign} onChange={(e) => setSelectedCampaign(e.target.value)}
                            className="input">
                            <option value="">Select a campaign...</option>
                            {campaigns.filter(c => c.status === 'active').map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                        </select>
                    </div>
                    <button onClick={handleGenerate} disabled={!selectedCampaign || loading}
                        className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
                        {loading ? 'Analyzing...' : `Run ${tabLabels[activeTab]}`}
                    </button>
                    {changedRecs.length > 0 && (
                        <button onClick={handleApplyAll} disabled={applying || applied.size === currentRecs.length}
                            className="px-6 py-2.5 bg-emerald-500 text-white font-bold text-xs uppercase tracking-widest hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all chamfer-sm">
                            {applying ? 'Applying...' : `Apply All (${changedRecs.length - [...applied].filter(id => changedRecs.find(r => r.keyword_id === id)).length})`}
                        </button>
                    )}
                </div>
            </div>

            {message && (
                <div className="px-4 py-3 bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 text-sm chamfer-sm">{message}</div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="text-center py-16">
                    <div className="w-10 h-10 border-2 border-prime-energon/30 border-t-prime-energon rounded-full animate-spin mx-auto mb-4" />
                    <div className="text-prime-energon text-sm font-bold uppercase tracking-widest mb-1">Analyzing bid performance...</div>
                    <p className="text-prime-gunmetal text-xs">Evaluating keyword data and generating recommendations</p>
                </div>
            )}

            {/* Results */}
            {!loading && currentRecs.length > 0 && (
                <div className="bg-prime-dark/80 backdrop-blur-sm border border-prime-gunmetal/30 p-6 chamfer">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-bold text-prime-silver uppercase tracking-widest flex items-center gap-3">
                            {tabLabels[activeTab]} Recommendations
                            <span className="text-[10px] px-2 py-0.5 bg-prime-black/50 text-prime-gunmetal font-semibold chamfer-sm">{currentRecs.length} keywords</span>
                        </h3>
                        {unchangedCount > 0 && (
                            <span className="text-[10px] text-prime-gunmetal uppercase tracking-widest">{unchangedCount} keywords optimal</span>
                        )}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-prime-gunmetal/20 text-prime-gunmetal">
                                    <th className="text-left py-3 px-2 text-[10px] uppercase tracking-widest">Keyword</th>
                                    <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">Current Bid</th>
                                    <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">Recommended</th>
                                    <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">Change</th>
                                    <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">Multiplier</th>
                                    {activeTab === 'ensemble' ? (
                                        <th className="text-right py-3 px-2 w-[150px] text-[10px] uppercase tracking-widest">Model Blend</th>
                                    ) : (
                                        <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">Confidence</th>
                                    )}
                                    <th className="text-right py-3 px-2 text-[10px] uppercase tracking-widest">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentRecs.map((rec: any) => {
                                    const changePercent = ((rec.recommended_bid - rec.current_bid) / rec.current_bid * 100);
                                    const isApplied = applied.has(rec.keyword_id);
                                    const noChange = rec.recommended_bid === rec.current_bid;

                                    return (
                                        <tr key={rec.keyword_id} className={`border-b border-prime-gunmetal/10 transition-colors ${isApplied ? 'bg-emerald-500/5' : 'hover:bg-prime-darker/50'}`}>
                                            <td className="py-3 px-2">
                                                <div className="text-prime-silver font-semibold">{rec.keyword_text}</div>
                                                {activeTab === 'q-learning' && (
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] text-prime-blue font-mono bg-prime-blue/10 px-1 chamfer-sm">State: {rec.state_bucket}</span>
                                                        {rec.is_explore && (<span className="text-[10px] text-prime-gold font-mono bg-prime-gold/10 px-1 chamfer-sm">Exploring</span>)}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-3 px-2 text-right text-prime-gunmetal align-top">${rec.current_bid.toFixed(2)}</td>
                                            <td className="py-3 px-2 text-right font-bold text-prime-energon align-top">${rec.recommended_bid.toFixed(2)}</td>
                                            <td className="py-3 px-2 text-right align-top">
                                                {noChange ? (<span className="text-prime-gunmetal/50">--</span>) : (
                                                    <span className={changePercent > 0 ? 'text-emerald-400' : 'text-prime-red'}>{changePercent > 0 ? '+' : ''}{changePercent.toFixed(1)}%</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-2 text-right text-prime-gunmetal align-top">x{rec.multiplier.toFixed(2)}</td>

                                            {activeTab === 'ensemble' ? (
                                                <td className="py-3 px-2 text-right align-top w-[150px]">
                                                    <div className="flex h-1.5 w-full bg-prime-darker rounded-none overflow-hidden mt-2" title={`A:${(rec.thompson_weight * 100).toFixed(0)}% B:${(rec.q_learning_weight * 100).toFixed(0)}% F:${(rec.forecast_weight * 100).toFixed(0)}%`}>
                                                        <div style={{ width: `${rec.thompson_weight * 100}%` }} className="bg-prime-energon" />
                                                        <div style={{ width: `${rec.q_learning_weight * 100}%` }} className="bg-prime-blue" />
                                                        <div style={{ width: `${rec.forecast_weight * 100}%` }} className="bg-emerald-400" />
                                                    </div>
                                                </td>
                                            ) : (
                                                <td className="py-3 px-2 text-right align-top">
                                                    {activeTab === 'thompson' ? (
                                                        <ConfidenceBar value={rec.confidence} />
                                                    ) : (
                                                        <span className="text-prime-blue font-mono">{rec.q_value > 0 ? '+' : ''}{rec.q_value.toFixed(4)}</span>
                                                    )}
                                                </td>
                                            )}

                                            <td className="py-3 px-2 text-right align-top">
                                                {isApplied ? (
                                                    <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Applied</span>
                                                ) : noChange ? (
                                                    <span className="text-prime-gunmetal/50 text-xs font-bold uppercase tracking-wider">Optimal</span>
                                                ) : (
                                                    <button onClick={() => handleApplyOne(rec)}
                                                        className="text-xs px-3 py-1 border border-prime-energon/30 text-prime-energon hover:bg-prime-energon/10 transition-colors font-bold uppercase tracking-wider chamfer-sm">
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
                    Select a campaign and click "Run" to get bid recommendations via {tabLabels[activeTab]}
                </div>
            )}
        </div>
    );
}

function TabButton({ active, onClick, title, subtitle, disabled }: { active: boolean; onClick: () => void; title: string; subtitle: string; disabled?: boolean }) {
    return (
        <button onClick={onClick} disabled={disabled}
            className={`px-5 py-3 text-left transition-all border chamfer-sm ${active ? 'bg-prime-darker border-prime-energon/30 shadow-energon' : 'bg-prime-dark border-prime-gunmetal/20 hover:border-prime-gunmetal/40'
                } ${disabled ? 'opacity-50 cursor-not-allowed hidden md:block' : ''}`}>
            <div className={`font-bold text-xs uppercase tracking-widest ${active ? 'text-prime-energon' : 'text-prime-gunmetal'}`}>{title}</div>
            <div className="text-[10px] text-prime-gunmetal/50 mt-0.5 uppercase tracking-wider">{subtitle}</div>
        </button>
    );
}

function ConfidenceBar({ value }: { value: number }) {
    const percent = Math.min(100, value * 100);
    const color = percent >= 70 ? 'bg-emerald-400' : percent >= 40 ? 'bg-yellow-400' : 'bg-prime-red';
    return (
        <div className="flex items-center gap-2 justify-end">
            <div className="w-16 bg-prime-darker h-1.5 overflow-hidden">
                <div className={`h-full ${color} transition-all`} style={{ width: `${percent}%` }} />
            </div>
            <span className="text-xs text-prime-gunmetal w-8 text-right">{percent.toFixed(0)}%</span>
        </div>
    );
}
