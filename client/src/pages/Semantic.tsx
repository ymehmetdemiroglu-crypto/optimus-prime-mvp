import { useState, useEffect, useMemo } from 'react';
import { campaignApi, semanticApi } from '../api/client';
import type { Campaign, SearchTerm, SemanticCluster, ListingSuggestion, CampaignExpansion } from '../types';

type SemanticTab = 'terms' | 'clusters' | 'listings' | 'campaigns';

export default function Semantic() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [selectedCampaign, setSelectedCampaign] = useState<string>('');
    const [activeTab, setActiveTab] = useState<SemanticTab>('terms');

    // Data states
    const [searchTerms, setSearchTerms] = useState<SearchTerm[]>([]);
    const [clusters, setClusters] = useState<SemanticCluster[]>([]);
    const [listings, setListings] = useState<ListingSuggestion[]>([]);
    const [expansions, setExpansions] = useState<CampaignExpansion[]>([]);

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        campaignApi.getCampaigns().then(setCampaigns)
            .catch((e) => { console.error(e); setMessage('Error: Failed to load campaigns'); });
    }, []);

    useEffect(() => {
        if (!selectedCampaign) return;
        loadTabData();
    }, [selectedCampaign, activeTab]);

    const loadTabData = async () => {
        if (!selectedCampaign) return;
        setLoading(true); setMessage('');
        try {
            if (activeTab === 'terms') setSearchTerms(await semanticApi.getSearchTerms(selectedCampaign));
            else if (activeTab === 'clusters') setClusters(await semanticApi.getClusters(selectedCampaign));
            else if (activeTab === 'listings') setListings(await semanticApi.getListingSuggestions(selectedCampaign));
            else setExpansions(await semanticApi.getCampaignExpansions(selectedCampaign));
        } catch (e: unknown) {
            console.error(e);
            setMessage(`Error: ${e instanceof Error ? e.message : 'Failed to load data'}`);
        }
        finally { setLoading(false); }
    };

    const handleImportTerms = async () => {
        setLoading(true); setMessage('');
        try {
            const count = await semanticApi.importSearchTerms(selectedCampaign);
            setMessage(`Imported ${count} search terms successfully`);
            setSearchTerms(await semanticApi.getSearchTerms(selectedCampaign));
        } catch (e: unknown) { setMessage(`Error: ${e instanceof Error ? e.message : String(e)}`); }
        finally { setLoading(false); }
    };

    const handleRunClustering = async () => {
        setLoading(true); setMessage('');
        try {
            const count = await semanticApi.runClustering(selectedCampaign);
            setMessage(`Created ${count} semantic clusters`);
            setClusters(await semanticApi.getClusters(selectedCampaign));
        } catch (e: unknown) { setMessage(`Error: ${e instanceof Error ? e.message : String(e)}`); }
        finally { setLoading(false); }
    };

    const handleGenerateListing = async (clusterId: string) => {
        setLoading(true); setMessage('');
        try {
            await semanticApi.generateListingSuggestion(clusterId, selectedCampaign);
            setMessage('Listing suggestion generated');
            setListings(await semanticApi.getListingSuggestions(selectedCampaign));
        } catch (e: unknown) { setMessage(`Error: ${e instanceof Error ? e.message : String(e)}`); }
        finally { setLoading(false); }
    };

    const handleComplianceCheck = async (suggestionId: string) => {
        try {
            const updated = await semanticApi.runComplianceCheck(suggestionId);
            setListings(prev => prev.map(l => l.id === updated.id ? updated : l));
        } catch (e: unknown) { setMessage(`Error: ${e instanceof Error ? e.message : String(e)}`); }
    };

    const handleGenerateExpansions = async (clusterId: string) => {
        setLoading(true); setMessage('');
        try {
            await semanticApi.generateCampaignExpansions(clusterId, selectedCampaign);
            setMessage('Campaign expansion proposals created');
            setExpansions(await semanticApi.getCampaignExpansions(selectedCampaign));
        } catch (e: unknown) { setMessage(`Error: ${e instanceof Error ? e.message : String(e)}`); }
        finally { setLoading(false); }
    };

    const tabs: { key: SemanticTab; label: string; subtitle: string }[] = [
        { key: 'terms', label: 'Search Terms', subtitle: 'Raw query data' },
        { key: 'clusters', label: 'Clusters', subtitle: 'Semantic themes' },
        { key: 'listings', label: 'Listing Optimizer', subtitle: 'Cosmo & Rufus' },
        { key: 'campaigns', label: 'Campaign Builder', subtitle: 'SKAG proposals' },
    ];

    return (
        <div className="min-h-screen p-6 lg:p-8 space-y-5">
            {/* Header */}
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-wider">
                        <span className="text-prime-energon">Semantic</span>{' '}
                        <span className="text-prime-silver">Optimization</span>
                    </h1>
                    <p className="text-prime-gunmetal text-xs mt-1 uppercase tracking-widest font-semibold">AI pipeline for Cosmo and Rufus optimization</p>
                </div>
            </div>

            {/* Campaign Selector */}
            <div className="bg-prime-dark/80 border border-prime-energon/15 p-5 chamfer">
                <div className="flex flex-wrap items-end gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-[10px] font-bold text-prime-gunmetal mb-2 uppercase tracking-widest">Campaign</label>
                        <select value={selectedCampaign} onChange={e => setSelectedCampaign(e.target.value)} className="input">
                            <option value="">Select a campaign...</option>
                            {campaigns.filter(c => c.status === 'active').map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                {tabs.map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        className={`px-5 py-3 text-left transition-all border chamfer-sm ${activeTab === tab.key ? 'bg-prime-darker border-prime-energon/30 shadow-energon' : 'bg-prime-dark border-prime-gunmetal/20 hover:border-prime-gunmetal/40'
                            }`}>
                        <div className={`font-bold text-xs uppercase tracking-widest ${activeTab === tab.key ? 'text-prime-energon' : 'text-prime-gunmetal'}`}>{tab.label}</div>
                        <div className="text-[10px] text-prime-gunmetal/50 mt-0.5 uppercase tracking-wider">{tab.subtitle}</div>
                    </button>
                ))}
            </div>

            {message && (
                <div className={`px-4 py-3 text-sm chamfer-sm ${message.startsWith('Error') ? 'bg-prime-red/5 border border-prime-red/20 text-prime-red' : 'bg-emerald-500/5 border border-emerald-500/20 text-emerald-400'}`}>
                    {message}
                </div>
            )}

            {!selectedCampaign ? (
                <div className="text-center py-16 text-prime-gunmetal text-sm uppercase tracking-wider">Select a campaign to begin</div>
            ) : loading ? (
                <div className="text-center py-16">
                    <div className="w-10 h-10 border-2 border-prime-energon/30 border-t-prime-energon rounded-full animate-spin mx-auto mb-4" />
                    <div className="text-prime-energon text-sm font-bold uppercase tracking-widest">Processing...</div>
                </div>
            ) : (
                <>
                    {activeTab === 'terms' && <SearchTermsTab terms={searchTerms} onImport={handleImportTerms} />}
                    {activeTab === 'clusters' && <ClustersTab clusters={clusters} onRunClustering={handleRunClustering} onGenerateListing={handleGenerateListing} onGenerateExpansion={handleGenerateExpansions} />}
                    {activeTab === 'listings' && <ListingsTab listings={listings} onComplianceCheck={handleComplianceCheck} />}
                    {activeTab === 'campaigns' && <CampaignsTab expansions={expansions} />}
                </>
            )}
        </div>
    );
}

// ── Tab 1: Search Terms ──
function SearchTermsTab({ terms, onImport }: { terms: SearchTerm[]; onImport: () => void }) {
    const [sortBy, setSortBy] = useState<'impressions' | 'clicks' | 'sales' | 'acos'>('impressions');
    const sorted = useMemo(
        () => [...terms].sort((a, b) => sortBy === 'acos' ? a[sortBy] - b[sortBy] : b[sortBy] - a[sortBy]),
        [terms, sortBy]
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-prime-silver uppercase tracking-widest">
                    Search Term Report
                    <span className="text-prime-gunmetal ml-3 text-[10px]">{terms.length} terms</span>
                </h3>
                <div className="flex gap-2">
                    <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
                        className="px-3 py-1.5 bg-prime-darker border border-prime-gunmetal/30 text-prime-silver text-xs chamfer-sm">
                        <option value="impressions">Sort by Impressions</option>
                        <option value="clicks">Sort by Clicks</option>
                        <option value="sales">Sort by Sales</option>
                        <option value="acos">Sort by ACoS</option>
                    </select>
                    <button onClick={onImport}
                        className="btn-primary text-xs">
                        Import Search Terms
                    </button>
                </div>
            </div>

            {terms.length === 0 ? (
                <div className="text-center py-16 bg-prime-dark/80 border border-dashed border-prime-gunmetal/30 chamfer">
                    <p className="text-prime-gunmetal text-sm uppercase tracking-wider mb-4">No search terms loaded</p>
                    <button onClick={onImport} className="btn-primary text-xs">Import Sample Data</button>
                </div>
            ) : (
                <div className="bg-prime-dark/80 border border-prime-gunmetal/30 chamfer overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-prime-gunmetal/20 text-prime-gunmetal">
                                    <th className="text-left py-3 px-4 text-[10px] uppercase tracking-widest">Query</th>
                                    <th className="text-right py-3 px-3 text-[10px] uppercase tracking-widest">Impressions</th>
                                    <th className="text-right py-3 px-3 text-[10px] uppercase tracking-widest">Clicks</th>
                                    <th className="text-right py-3 px-3 text-[10px] uppercase tracking-widest">CTR</th>
                                    <th className="text-right py-3 px-3 text-[10px] uppercase tracking-widest">Orders</th>
                                    <th className="text-right py-3 px-3 text-[10px] uppercase tracking-widest">Sales</th>
                                    <th className="text-right py-3 px-3 text-[10px] uppercase tracking-widest">Spend</th>
                                    <th className="text-right py-3 px-3 text-[10px] uppercase tracking-widest">ACoS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map(term => (
                                    <tr key={term.id} className="border-b border-prime-gunmetal/10 hover:bg-prime-darker/50 transition-colors">
                                        <td className="py-3 px-4 text-prime-silver font-semibold">{term.query_text}</td>
                                        <td className="py-3 px-3 text-right text-prime-gunmetal">{term.impressions.toLocaleString()}</td>
                                        <td className="py-3 px-3 text-right text-prime-gunmetal">{term.clicks.toLocaleString()}</td>
                                        <td className="py-3 px-3 text-right text-prime-blue">{term.ctr.toFixed(2)}%</td>
                                        <td className="py-3 px-3 text-right text-prime-gunmetal">{term.orders}</td>
                                        <td className="py-3 px-3 text-right text-emerald-400 font-bold">${Number(term.sales).toFixed(2)}</td>
                                        <td className="py-3 px-3 text-right text-prime-gunmetal">${Number(term.spend).toFixed(2)}</td>
                                        <td className="py-3 px-3 text-right">
                                            <span className={`font-bold ${Number(term.acos) < 25 ? 'text-emerald-400' : Number(term.acos) < 40 ? 'text-yellow-400' : 'text-prime-red'}`}>
                                                {Number(term.acos).toFixed(1)}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Tab 2: Clusters ──
function ClustersTab({ clusters, onRunClustering, onGenerateListing, onGenerateExpansion }: {
    clusters: SemanticCluster[]; onRunClustering: () => void;
    onGenerateListing: (clusterId: string) => void; onGenerateExpansion: (clusterId: string) => void;
}) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-prime-silver uppercase tracking-widest">
                    Semantic Clusters
                    <span className="text-prime-gunmetal ml-3 text-[10px]">{clusters.length} themes</span>
                </h3>
                <button onClick={onRunClustering} className="btn-primary text-xs">Run Clustering</button>
            </div>

            {clusters.length === 0 ? (
                <div className="text-center py-16 bg-prime-dark/80 border border-dashed border-prime-gunmetal/30 chamfer">
                    <p className="text-prime-gunmetal text-sm uppercase tracking-wider mb-4">No clusters yet</p>
                    <p className="text-prime-gunmetal/50 text-xs mb-4">Import search terms first, then run clustering</p>
                    <button onClick={onRunClustering} className="btn-primary text-xs">Run Clustering</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {clusters.map(cluster => (
                        <div key={cluster.id} className="bg-prime-dark/80 border border-prime-gunmetal/30 hover:border-prime-energon/20 transition-all chamfer p-5">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h4 className="text-sm font-bold text-prime-silver uppercase tracking-wider">{cluster.cluster_label}</h4>
                                    <p className="text-[10px] text-prime-gunmetal mt-1">{cluster.term_count} terms grouped</p>
                                </div>
                                <span className={`badge ${cluster.status === 'active' ? 'badge-success' : cluster.status === 'applied' ? 'badge-warning' : ''}`}>{cluster.status}</span>
                            </div>

                            {/* Cosmo & Rufus Scores */}
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="bg-prime-black/50 p-3 chamfer-sm">
                                    <div className="text-[10px] text-prime-gunmetal uppercase tracking-widest mb-1">Cosmo Score</div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-prime-darker h-2 overflow-hidden">
                                            <div className="h-full bg-prime-blue transition-all" style={{ width: `${cluster.cosmo_relevance_score}%` }} />
                                        </div>
                                        <span className="text-prime-blue text-xs font-bold w-8 text-right">{cluster.cosmo_relevance_score}</span>
                                    </div>
                                </div>
                                <div className="bg-prime-black/50 p-3 chamfer-sm">
                                    <div className="text-[10px] text-prime-gunmetal uppercase tracking-widest mb-1">Rufus Score</div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-prime-darker h-2 overflow-hidden">
                                            <div className="h-full bg-prime-gold transition-all" style={{ width: `${cluster.rufus_intent_score}%` }} />
                                        </div>
                                        <span className="text-prime-gold text-xs font-bold w-8 text-right">{cluster.rufus_intent_score}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Metrics */}
                            <div className="grid grid-cols-4 gap-2 mb-4 text-center">
                                <div><div className="text-[10px] text-prime-gunmetal uppercase">Sales</div><div className="text-emerald-400 font-bold text-sm">${Number(cluster.total_sales).toFixed(0)}</div></div>
                                <div><div className="text-[10px] text-prime-gunmetal uppercase">Spend</div><div className="text-prime-gunmetal font-bold text-sm">${Number(cluster.total_spend).toFixed(0)}</div></div>
                                <div><div className="text-[10px] text-prime-gunmetal uppercase">ACoS</div><div className={`font-bold text-sm ${Number(cluster.avg_acos) < 25 ? 'text-emerald-400' : 'text-yellow-400'}`}>{Number(cluster.avg_acos).toFixed(1)}%</div></div>
                                <div><div className="text-[10px] text-prime-gunmetal uppercase">Clicks</div><div className="text-prime-blue font-bold text-sm">{cluster.total_clicks.toLocaleString()}</div></div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 border-t border-prime-gunmetal/20 pt-3">
                                <button onClick={() => onGenerateListing(cluster.id)}
                                    className="flex-1 px-3 py-2 text-[10px] font-bold uppercase tracking-widest border border-prime-blue/30 text-prime-blue hover:bg-prime-blue/10 transition-all chamfer-sm">
                                    Generate Listing
                                </button>
                                <button onClick={() => onGenerateExpansion(cluster.id)}
                                    className="flex-1 px-3 py-2 text-[10px] font-bold uppercase tracking-widest border border-prime-gold/30 text-prime-gold hover:bg-prime-gold/10 transition-all chamfer-sm">
                                    Build Campaign
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Tab 3: Listing Optimizer ──
function ListingsTab({ listings, onComplianceCheck }: { listings: ListingSuggestion[]; onComplianceCheck: (id: string) => void }) {
    const [expanded, setExpanded] = useState<string | null>(null);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-prime-silver uppercase tracking-widest">
                    Listing Suggestions
                    <span className="text-prime-gunmetal ml-3 text-[10px]">{listings.length} listings</span>
                </h3>
            </div>

            {listings.length === 0 ? (
                <div className="text-center py-16 bg-prime-dark/80 border border-dashed border-prime-gunmetal/30 chamfer">
                    <p className="text-prime-gunmetal text-sm uppercase tracking-wider">No listing suggestions yet</p>
                    <p className="text-prime-gunmetal/50 text-xs mt-2">Generate listings from the Clusters tab</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {listings.map(listing => (
                        <div key={listing.id} className="bg-prime-dark/80 border border-prime-gunmetal/30 chamfer overflow-hidden">
                            {/* Header */}
                            <button className="w-full text-left p-5 cursor-pointer" aria-expanded={expanded === listing.id} onClick={() => setExpanded(expanded === listing.id ? null : listing.id)}>
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-[10px] text-prime-gunmetal uppercase tracking-widest font-bold">
                                                {listing.cluster?.cluster_label ?? 'General'}
                                            </span>
                                            <ComplianceBadge status={listing.compliance_status} />
                                        </div>
                                        <h4 className="text-sm text-prime-silver font-semibold leading-relaxed">{listing.suggested_title}</h4>
                                        <div className="flex items-center gap-4 mt-3">
                                            <ScorePill label="Cosmo" value={listing.cosmo_score} color="prime-blue" />
                                            <ScorePill label="Rufus" value={listing.rufus_score} color="prime-gold" />
                                            <span className="text-[10px] text-prime-gunmetal">{listing.title_char_count}/200 chars</span>
                                        </div>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); onComplianceCheck(listing.id); }}
                                        className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-prime-energon/30 text-prime-energon hover:bg-prime-energon/10 transition-all chamfer-sm shrink-0">
                                        Run QA
                                    </button>
                                </div>
                            </button>

                            {/* Expanded Details */}
                            {expanded === listing.id && (
                                <div className="border-t border-prime-gunmetal/20 p-5 space-y-4">
                                    {/* Bullets */}
                                    <div>
                                        <div className="text-[10px] font-bold text-prime-gunmetal uppercase tracking-widest mb-2">Bullet Points (Rufus-Ready)</div>
                                        <div className="space-y-2">
                                            {listing.suggested_bullets.map((bullet, i) => (
                                                <div key={i} className="flex gap-2">
                                                    <span className="text-prime-energon text-xs font-bold shrink-0 mt-0.5">{i + 1}.</span>
                                                    <p className="text-prime-silver text-xs leading-relaxed">{bullet}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Backend Terms */}
                                    <div>
                                        <div className="text-[10px] font-bold text-prime-gunmetal uppercase tracking-widest mb-2">Backend Search Terms ({listing.suggested_backend_terms?.length || 0}/250 bytes)</div>
                                        <div className="bg-prime-black/50 p-3 chamfer-sm">
                                            <code className="text-prime-energon text-xs font-mono break-all">{listing.suggested_backend_terms}</code>
                                        </div>
                                    </div>

                                    {/* A+ Keywords */}
                                    <div>
                                        <div className="text-[10px] font-bold text-prime-gunmetal uppercase tracking-widest mb-2">A+ Content Keywords</div>
                                        <div className="flex flex-wrap gap-2">
                                            {listing.aplus_keywords.map((kw, i) => (
                                                <span key={i} className="px-2 py-1 bg-prime-blue/10 border border-prime-blue/20 text-prime-blue text-[10px] font-bold uppercase chamfer-sm">{kw}</span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Compliance Issues */}
                                    {listing.compliance_issues.length > 0 && (
                                        <div>
                                            <div className="text-[10px] font-bold text-prime-gunmetal uppercase tracking-widest mb-2">Compliance Issues</div>
                                            <div className="space-y-1">
                                                {listing.compliance_issues.map((issue, i) => (
                                                    <div key={i} className={`px-3 py-2 text-xs chamfer-sm ${issue.severity === 'error' ? 'bg-prime-red/5 border border-prime-red/20 text-prime-red' : 'bg-yellow-500/5 border border-yellow-500/20 text-yellow-400'}`}>
                                                        <span className="font-bold uppercase text-[10px] mr-2">[{issue.field}]</span>{issue.issue}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Tab 4: Campaign Builder ──
function CampaignsTab({ expansions }: { expansions: CampaignExpansion[] }) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-prime-silver uppercase tracking-widest">
                    Campaign Expansion Proposals
                    <span className="text-prime-gunmetal ml-3 text-[10px]">{expansions.length} proposals</span>
                </h3>
            </div>

            {expansions.length === 0 ? (
                <div className="text-center py-16 bg-prime-dark/80 border border-dashed border-prime-gunmetal/30 chamfer">
                    <p className="text-prime-gunmetal text-sm uppercase tracking-wider">No campaign proposals yet</p>
                    <p className="text-prime-gunmetal/50 text-xs mt-2">Generate campaigns from the Clusters tab</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {expansions.map(exp => (
                        <div key={exp.id} className="bg-prime-dark/80 border border-prime-gunmetal/30 chamfer p-5">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h4 className="text-sm font-bold text-prime-silver">{exp.proposed_campaign_name}</h4>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider chamfer-sm ${exp.match_type === 'exact' ? 'bg-prime-blue/10 border border-prime-blue/20 text-prime-blue' : 'bg-prime-gold/10 border border-prime-gold/20 text-prime-gold'}`}>
                                            {exp.match_type}
                                        </span>
                                        <span className={`badge ${exp.status === 'proposed' ? '' : exp.status === 'approved' ? 'badge-success' : exp.status === 'launched' ? 'badge-warning' : 'badge-danger'}`}>{exp.status}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Keywords */}
                            <div className="mb-4">
                                <div className="text-[10px] font-bold text-prime-gunmetal uppercase tracking-widest mb-2">Keywords ({exp.keywords.length})</div>
                                <div className="flex flex-wrap gap-1">
                                    {exp.keywords.map((kw, i) => (
                                        <span key={i} className="px-2 py-0.5 bg-prime-darker text-prime-silver text-[10px] font-mono chamfer-sm border border-prime-gunmetal/20">{kw}</span>
                                    ))}
                                </div>
                            </div>

                            {/* Estimates */}
                            <div className="grid grid-cols-2 gap-3 border-t border-prime-gunmetal/20 pt-3">
                                <div>
                                    <div className="text-[10px] text-prime-gunmetal uppercase tracking-widest">Daily Budget</div>
                                    <div className="text-prime-silver font-bold text-sm">${exp.suggested_daily_budget.toFixed(2)}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-prime-gunmetal uppercase tracking-widest">Suggested Bid</div>
                                    <div className="text-prime-energon font-bold text-sm">${exp.suggested_bid.toFixed(2)}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-prime-gunmetal uppercase tracking-widest">Est. Daily Clicks</div>
                                    <div className="text-prime-blue font-bold text-sm">{exp.estimated_daily_clicks}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-prime-gunmetal uppercase tracking-widest">Est. Daily Spend</div>
                                    <div className="text-prime-gunmetal font-bold text-sm">${exp.estimated_daily_spend.toFixed(2)}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Shared Components ──
function ComplianceBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        pending: 'bg-prime-gunmetal/10 text-prime-gunmetal border-prime-gunmetal/20',
        pass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
        fail: 'bg-prime-red/10 text-prime-red border-prime-red/20',
    };
    return (
        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border chamfer-sm ${styles[status] || styles.pending}`}>
            QA: {status}
        </span>
    );
}

function ScorePill({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="flex items-center gap-1.5">
            <span className={`text-[10px] text-${color} font-bold uppercase`}>{label}</span>
            <div className={`w-12 bg-prime-darker h-1.5 overflow-hidden`}>
                <div className={`h-full bg-${color} transition-all`} style={{ width: `${Math.min(100, value)}%` }} />
            </div>
            <span className={`text-[10px] text-${color} font-bold`}>{value}</span>
        </div>
    );
}
