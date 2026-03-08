import { useState, useEffect } from 'react';
import { campaignApi, forecastApi } from '../api/client';
import type { CampaignForecast } from '../api/client';
import type { Campaign } from '../types';

export default function Forecasts() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [selectedCampaign, setSelectedCampaign] = useState<string>('');
    const [forecasts, setForecasts] = useState<CampaignForecast[]>([]);

    const [loading, setLoading] = useState(false);
    const [computing, setComputing] = useState(false);
    const [message, setMessage] = useState('');
    const [loadError, setLoadError] = useState('');

    useEffect(() => {
        campaignApi.getCampaigns().then(setCampaigns)
            .catch((e) => { console.error(e); setLoadError('Failed to load campaigns'); });
    }, []);

    const handleComputeAll = async () => {
        setComputing(true); setMessage('');
        try {
            await forecastApi.computeForecasts();
            setMessage('Successfully computed forecasts for all active keywords');
            if (selectedCampaign) { handleLoadForecast(selectedCampaign); }
        } catch (error) { console.error('Failed to compute forecasts:', error); setMessage('Failed to compute forecasts'); }
        finally { setComputing(false); }
    };

    const handleLoadForecast = async (campaignId: string) => {
        if (!campaignId) { setForecasts([]); return; }
        setLoading(true);
        try { setForecasts(await forecastApi.getCampaignForecasts(campaignId, 7)); }
        catch (error) { console.error('Failed to load forecasts:', error); setForecasts([]); }
        finally { setLoading(false); }
    };

    const handleCampaignChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value; setSelectedCampaign(val); handleLoadForecast(val);
    };

    return (
        <div className="min-h-screen p-6 lg:p-8 space-y-5">
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-wider">
                        <span className="text-prime-gold">Performance</span>{' '}
                        <span className="text-prime-silver">Forecasts</span>
                    </h1>
                    <p className="text-prime-gunmetal text-xs mt-1 uppercase tracking-widest font-semibold">7-Day performance projections with confidence ranges</p>
                </div>
                <button onClick={handleComputeAll} disabled={computing}
                    className="px-5 py-2.5 bg-prime-dark border border-prime-gold/20 text-prime-gold text-xs font-bold uppercase tracking-widest hover:border-prime-gold/40 disabled:opacity-50 transition-all chamfer-sm">
                    {computing ? 'Computing...' : 'Run Global Forecast'}
                </button>
            </div>

            {loadError && (
                <div className="px-4 py-3 bg-prime-red/5 border border-prime-red/20 text-prime-red text-sm chamfer-sm">{loadError}</div>
            )}

            {message && (
                <div className={`px-4 py-3 text-sm chamfer-sm ${message.startsWith('Failed') ? 'bg-prime-red/5 border border-prime-red/20 text-prime-red' : 'bg-emerald-500/5 border border-emerald-500/20 text-emerald-400'}`}>{message}</div>
            )}

            {/* Controls */}
            <div className="bg-prime-dark/80 border border-prime-energon/15 p-5 chamfer">
                <div className="flex gap-4">
                    <div className="flex-1 max-w-sm">
                        <label className="block text-[10px] font-bold text-prime-gunmetal mb-2 uppercase tracking-widest">View Forecast For</label>
                        <select value={selectedCampaign} onChange={handleCampaignChange} className="input">
                            <option value="">Select a campaign...</option>
                            {campaigns.filter(c => c.status === 'active').map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Results */}
            {loading ? (
                <div className="text-center py-16">
                    <div className="w-10 h-10 border-2 border-prime-gold/30 border-t-prime-gold rounded-full animate-spin mx-auto mb-4" />
                    <div className="text-prime-gold text-sm font-bold uppercase tracking-widest">Loading forecast data...</div>
                </div>
            ) : forecasts.length > 0 ? (
                <div className="bg-prime-dark/80 backdrop-blur-sm border border-prime-gunmetal/30 p-6 chamfer">
                    <h3 className="text-sm font-bold text-prime-silver uppercase tracking-widest mb-6">7-Day Projection</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-prime-gunmetal/20 text-prime-gunmetal">
                                    <th className="text-left py-3 px-4 text-[10px] uppercase tracking-widest">Date</th>
                                    <th className="text-right py-3 px-4 w-1/4 text-[10px] uppercase tracking-widest">Predicted Spend</th>
                                    <th className="text-right py-3 px-4 w-1/4 text-[10px] uppercase tracking-widest">Predicted Sales</th>
                                    <th className="text-right py-3 px-4 w-1/4 text-[10px] uppercase tracking-widest">Predicted ACoS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {forecasts.map((f) => (
                                    <tr key={f.target_date} className="border-b border-prime-gunmetal/10 hover:bg-prime-darker/50 transition-colors">
                                        <td className="py-4 px-4 font-semibold text-prime-silver">
                                            {new Date(f.target_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            <div className="text-prime-silver font-bold">${f.predicted_spend.toFixed(2)}</div>
                                            <div className="text-[10px] mt-1 text-prime-gunmetal/50 font-mono">[{f.spend_lower_bound.toFixed(2)} - {f.spend_upper_bound.toFixed(2)}]</div>
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            <div className="text-emerald-400 font-bold">${f.predicted_sales.toFixed(2)}</div>
                                            <div className="text-[10px] mt-1 text-prime-gunmetal/50 font-mono">[{f.sales_lower_bound.toFixed(2)} - {f.sales_upper_bound.toFixed(2)}]</div>
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            <div className="text-prime-energon font-bold">{f.predicted_acos !== null ? `${f.predicted_acos.toFixed(2)}%` : '--'}</div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : selectedCampaign ? (
                <div className="text-center py-16 bg-prime-dark/80 border border-dashed border-prime-gunmetal/30 chamfer">
                    <p className="text-prime-gunmetal text-sm uppercase tracking-wider">
                        No forecast data available for this campaign.<br />
                        Click "Run Global Forecast" to compute predictions.
                    </p>
                </div>
            ) : (
                <div className="text-center py-16 text-prime-gunmetal text-sm uppercase tracking-wider">
                    Select a campaign to view forecasts
                </div>
            )}
        </div>
    );
}
