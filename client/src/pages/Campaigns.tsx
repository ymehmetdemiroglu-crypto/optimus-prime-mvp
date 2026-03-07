import { useState, useEffect } from 'react';
import { campaignApi, keywordApi } from '../api/client';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import KeywordTable from '../components/KeywordTable';
import type { Campaign, Keyword, StrategyType } from '../types';
import { exportToCsv } from '../utils/export';

export default function Campaigns() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
    const [keywords, setKeywords] = useState<Record<string, Keyword[]>>({});
    const [loadingKeywords, setLoadingKeywords] = useState<string | null>(null);

    useEffect(() => { loadCampaigns(); }, []);

    const loadCampaigns = async () => {
        try { setCampaigns(await campaignApi.getCampaigns()); }
        catch (error) { console.error('Failed to load campaigns:', error); setError('Failed to load campaigns. Please refresh.'); }
        finally { setLoading(false); }
    };

    useRealtimeSubscription('campaigns', () => { loadCampaigns(); });

    const handleStrategyChange = async (campaignId: string, strategy: StrategyType) => {
        try { const updated = await campaignApi.updateStrategy(campaignId, strategy); setCampaigns(campaigns.map(c => c.id === campaignId ? updated : c)); }
        catch (error) { console.error('Failed to update strategy:', error); setError('Failed to update strategy. Please try again.'); }
    };

    const handleToggleKeywords = async (campaignId: string) => {
        if (expandedCampaign === campaignId) { setExpandedCampaign(null); return; }
        setExpandedCampaign(campaignId);
        if (!keywords[campaignId]) {
            setLoadingKeywords(campaignId);
            try { const kws = await keywordApi.getKeywords(campaignId); setKeywords(prev => ({ ...prev, [campaignId]: kws })); }
            catch (error) { console.error('Failed to load keywords:', error); }
            finally { setLoadingKeywords(null); }
        }
    };

    const handleKeywordUpdated = (campaignId: string, updated: Keyword) => {
        setKeywords(prev => ({ ...prev, [campaignId]: (prev[campaignId] || []).map(k => k.id === updated.id ? updated : k) }));
    };

    const handleKeywordDeleted = (campaignId: string, keywordId: string) => {
        setKeywords(prev => ({ ...prev, [campaignId]: (prev[campaignId] || []).filter(k => k.id !== keywordId) }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[80vh]">
                <div className="w-10 h-10 border-2 border-prime-red/30 border-t-prime-red rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen p-6 lg:p-8 space-y-5">
            {/* Error Banner */}
            {error && (
                <div role="alert" className="bg-prime-red/10 border border-prime-red/30 p-4 chamfer flex items-center justify-between">
                    <span className="text-prime-red text-sm">{error}</span>
                    <button onClick={() => setError(null)} aria-label="Dismiss error" className="text-prime-gunmetal hover:text-prime-silver ml-4 text-lg leading-none">✕</button>
                </div>
            )}

            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-wider">
                        <span className="text-prime-red">Campaign</span>{' '}
                        <span className="text-prime-silver">Manager</span>
                    </h1>
                    <p className="text-prime-gunmetal text-xs mt-1 uppercase tracking-widest font-semibold">AI-powered campaign optimization</p>
                </div>
                <button onClick={() => exportToCsv('campaigns-export', campaigns)}
                    className="px-4 py-2 bg-prime-dark border border-prime-gunmetal/30 text-prime-gunmetal text-xs font-bold uppercase tracking-widest hover:text-prime-silver hover:border-prime-gunmetal transition-all chamfer-sm">
                    Export CSV
                </button>
            </div>

            <div className="space-y-3">
                {campaigns.map((campaign) => (
                    <div key={campaign.id}>
                        <CampaignCard campaign={campaign} onStrategyChange={handleStrategyChange} isExpanded={expandedCampaign === campaign.id} onToggleKeywords={() => handleToggleKeywords(campaign.id)} />
                        {expandedCampaign === campaign.id && (
                            <div className="mt-px bg-prime-dark/80 border border-prime-energon/15 border-t-0 p-6 chamfer">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-xs font-bold text-prime-energon uppercase tracking-widest">Keywords ({keywords[campaign.id]?.length || 0})</h4>
                                </div>
                                {loadingKeywords === campaign.id ? (
                                    <div className="text-prime-energon animate-pulse py-4 text-center text-sm">Loading keywords...</div>
                                ) : (
                                    <KeywordTable keywords={keywords[campaign.id] || []} onKeywordUpdated={(kw) => handleKeywordUpdated(campaign.id, kw)} onKeywordDeleted={(id) => handleKeywordDeleted(campaign.id, id)} />
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function CampaignCard({ campaign, onStrategyChange, isExpanded, onToggleKeywords }: {
    campaign: Campaign; onStrategyChange: (id: string, strategy: StrategyType) => void;
    isExpanded: boolean; onToggleKeywords: () => void;
}) {
    const strategies: { value: StrategyType; label: string; color: string }[] = [
        { value: 'auto_pilot', label: 'Auto Pilot', color: 'bg-prime-blue' },
        { value: 'aggressive', label: 'Aggressive', color: 'bg-prime-red' },
        { value: 'profit_guard', label: 'Profit Guard', color: 'bg-emerald-500' },
    ];

    const budgetUsed = (campaign.spend / campaign.budget) * 100;

    return (
        <div className={`bg-prime-dark/80 backdrop-blur-sm border border-prime-gunmetal/25 p-6 hover:border-prime-gunmetal/40 transition-all chamfer ${isExpanded ? 'border-b-prime-energon/15' : ''}`}>
            <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-bold text-prime-silver">{campaign.name}</h3>
                            <div className="flex items-center gap-3 mt-2">
                                <span className={`badge ${campaign.status === 'active' ? 'badge-success' : campaign.status === 'paused' ? 'badge-warning' : 'badge-danger'}`}>{campaign.status}</span>
                                <span className="text-prime-gunmetal/50 text-[10px] font-mono">ID: {campaign.id.slice(0, 8)}...</span>
                            </div>
                        </div>
                        <button onClick={onToggleKeywords}
                            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-widest border transition-all chamfer-sm ${isExpanded
                                ? 'bg-prime-energon/10 border-prime-energon/30 text-prime-energon'
                                : 'border-prime-gunmetal/30 text-prime-gunmetal hover:border-prime-gunmetal/50 hover:text-prime-silver'
                                }`}>
                            {isExpanded ? 'Hide Keywords' : 'Keywords'}
                        </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <Metric label="ACOS" value={`${campaign.acos}%`} color="prime-energon" />
                        <Metric label="Sales" value={`$${campaign.sales.toFixed(2)}`} color="emerald-400" />
                        <Metric label="Spend" value={`$${campaign.spend.toFixed(2)}`} color="prime-blue" />
                        <Metric label="Orders" value={campaign.orders.toString()} color="prime-gold" />
                    </div>

                    <div className="mb-4">
                        <div className="flex justify-between text-xs mb-2">
                            <span className="text-prime-gunmetal uppercase tracking-widest text-[10px] font-bold">Budget Usage</span>
                            <span className="text-prime-silver font-bold">{budgetUsed.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-prime-darker h-2 overflow-hidden">
                            <div className={`h-full transition-all ${budgetUsed > 90 ? 'bg-prime-red' : budgetUsed > 70 ? 'bg-yellow-400' : 'bg-emerald-400'}`}
                                style={{ width: `${Math.min(budgetUsed, 100)}%` }} />
                        </div>
                        <div className="flex justify-between text-[10px] text-prime-gunmetal/50 mt-1">
                            <span>${campaign.spend.toFixed(2)}</span>
                            <span>${campaign.budget.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                        <div><span className="text-prime-gunmetal text-[10px] uppercase tracking-widest block">Impressions</span><p className="text-prime-silver font-bold">{campaign.impressions.toLocaleString()}</p></div>
                        <div><span className="text-prime-gunmetal text-[10px] uppercase tracking-widest block">Clicks</span><p className="text-prime-silver font-bold">{campaign.clicks.toLocaleString()}</p></div>
                        <div><span className="text-prime-gunmetal text-[10px] uppercase tracking-widest block">CTR</span><p className="text-prime-silver font-bold">{campaign.impressions > 0 ? ((campaign.clicks / campaign.impressions) * 100).toFixed(2) : '0.00'}%</p></div>
                    </div>
                </div>

                {/* Strategy Selector */}
                <div className="lg:w-64 border-t lg:border-t-0 lg:border-l border-prime-gunmetal/20 pt-6 lg:pt-0 lg:pl-6">
                    <h4 className="text-[10px] font-bold text-prime-gunmetal mb-4 uppercase tracking-widest">Optimization Mode</h4>
                    <div className="space-y-2">
                        {strategies.map((strategy) => (
                            <button key={strategy.value} onClick={() => onStrategyChange(campaign.id, strategy.value)}
                                className={`w-full p-3 border transition-all chamfer-sm ${campaign.strategy === strategy.value
                                    ? `${strategy.color} text-white border-transparent shadow-lg`
                                    : 'bg-prime-darker text-prime-gunmetal border-prime-gunmetal/20 hover:border-prime-gunmetal/40 hover:text-prime-silver'
                                    }`}>
                                <div className="font-bold text-xs uppercase tracking-widest">{strategy.label}</div>
                                <div className="text-[10px] mt-1 opacity-80">
                                    {strategy.value === 'auto_pilot' && 'Balanced optimization'}
                                    {strategy.value === 'aggressive' && 'Maximum visibility'}
                                    {strategy.value === 'profit_guard' && 'Cost efficiency'}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div>
            <div className="text-prime-gunmetal text-[10px] mb-1 uppercase tracking-widest font-bold">{label}</div>
            <div className={`text-lg font-black text-${color}`}>{value}</div>
        </div>
    );
}
