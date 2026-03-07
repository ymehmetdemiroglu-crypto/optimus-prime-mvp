import { useState, useEffect, useCallback } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { dashboardApi, autonomousApi, pacingApi } from '../api/client';
import type { AutonomousLog } from '../api/client';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import type { DashboardData, SpendPacing } from '../types';

export default function Dashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [autoLogs, setAutoLogs] = useState<AutonomousLog[]>([]);
    const [pacing, setPacing] = useState<SpendPacing[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadDashboard = useCallback(async () => {
        try {
            const [dashboardData, logsData, pacingData] = await Promise.all([
                dashboardApi.getDashboard(),
                autonomousApi.getLogs(5),
                pacingApi.getAllCampaignPacing().catch(() => []),
            ]);
            setData(dashboardData);
            setAutoLogs(logsData);
            setPacing(pacingData);
        } catch (error) {
            console.error('Failed to load dashboard:', error);
            setError('Failed to load dashboard data. Please refresh.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadDashboard(); }, [loadDashboard]);
    useRealtimeSubscription('campaigns', () => { loadDashboard(); });
    useRealtimeSubscription('ai_actions', () => { loadDashboard(); });

    if (loading || !data) {
        return (
            <div className="flex items-center justify-center h-[80vh]">
                <div className="text-center">
                    <div className="w-12 h-12 border-2 border-prime-energon/30 border-t-prime-energon rounded-full animate-spin mx-auto mb-4" />
                    <div className="text-prime-gunmetal text-sm uppercase tracking-widest font-bold">Initializing War Room</div>
                </div>
            </div>
        );
    }

    const { metrics, sales_data, ai_actions } = data;

    return (
        <div className="min-h-screen p-6 lg:p-8 space-y-5">
            {/* Error Banner */}
            {error && (
                <div role="alert" className="bg-prime-red/10 border border-prime-red/30 p-4 chamfer flex items-center justify-between">
                    <span className="text-prime-red text-sm">{error}</span>
                    <button onClick={() => setError(null)} aria-label="Dismiss error" className="text-prime-gunmetal hover:text-prime-silver ml-4 text-lg leading-none">✕</button>
                </div>
            )}

            {/* Header */}
            <div className="flex items-end justify-between pb-2">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-wider">
                        <span className="text-prime-red">War</span>{' '}
                        <span className="text-prime-silver">Room</span>
                    </h1>
                    <p className="text-prime-gunmetal text-xs mt-1 uppercase tracking-widest font-semibold">Real-time advertising intelligence</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-prime-gunmetal uppercase tracking-widest font-bold">
                    <div className="w-1.5 h-1.5 bg-prime-energon rounded-full animate-pulse" />
                    Live feed
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricCard title="ACOS" value={`${metrics.acos}%`} subtitle="Ad Cost of Sales" accent="prime-energon" trend={metrics.acos < 25 ? 'good' : 'warning'} />
                <MetricCard title="ROAS" value={metrics.roas.toFixed(2)} subtitle="Return on Ad Spend" accent="emerald-400" trend="good" />
                <MetricCard title="CTR" value={`${metrics.ctr}%`} subtitle="Click-Through Rate" accent="prime-blue" trend={metrics.ctr > 0.5 ? 'good' : 'warning'} />
                <MetricCard title="CVR" value={`${metrics.cvr}%`} subtitle="Conversion Rate" accent="prime-gold" trend={metrics.cvr > 10 ? 'good' : 'warning'} />
            </div>

            {/* Budget Pacing */}
            {pacing.length > 0 && (
                <div className="bg-prime-dark/80 backdrop-blur-sm border border-prime-gunmetal/30 p-5 chamfer">
                    <h3 className="text-xs font-bold text-prime-gunmetal uppercase tracking-widest mb-3">Budget Pacing</h3>
                    <div className="space-y-2.5">
                        {pacing.map(p => {
                            const pct = Math.min(100, p.pace_percentage);
                            const barColor = p.pacing_status === 'on_track' ? 'bg-emerald-400' : p.pacing_status === 'overspending' ? 'bg-prime-red' : 'bg-yellow-400';
                            const statusColor = p.pacing_status === 'on_track' ? 'text-emerald-400' : p.pacing_status === 'overspending' ? 'text-prime-red' : 'text-yellow-400';
                            const statusLabel = p.pacing_status === 'on_track' ? 'On Track' : p.pacing_status === 'overspending' ? 'Overspending' : 'Underspending';
                            return (
                                <div key={p.campaign_id} className="flex items-center gap-4 p-2.5 bg-prime-black/40 border border-prime-gunmetal/15 chamfer-sm">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-prime-silver text-sm font-semibold truncate">{p.campaign_name}</span>
                                            <span className={`text-[10px] font-bold uppercase tracking-widest ${statusColor}`}>{statusLabel}</span>
                                        </div>
                                        <div className="w-full bg-prime-darker h-1.5 overflow-hidden">
                                            <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                                        </div>
                                        <div className="flex justify-between mt-1">
                                            <span className="text-prime-gunmetal text-[10px]">${p.spent_today.toFixed(2)} / ${p.daily_budget.toFixed(2)}</span>
                                            <span className="text-prime-gunmetal text-[10px]">Projected EOD: ${p.projected_eod_spend.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Sales Chart */}
            <div className="relative bg-prime-dark/80 backdrop-blur-sm border border-prime-gunmetal/30 p-6 chamfer overflow-hidden">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="text-sm font-bold text-prime-silver uppercase tracking-widest">Sales Velocity</h2>
                        <p className="text-[10px] text-prime-gunmetal mt-0.5 uppercase tracking-wider">30-day performance trend</p>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-prime-gunmetal uppercase tracking-wider">
                        <span className="flex items-center gap-1.5"><span className="w-3 h-[2px] bg-prime-energon inline-block" /> Revenue</span>
                    </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={sales_data}>
                        <defs>
                            <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#00FBFF" stopOpacity={0.12} />
                                <stop offset="100%" stopColor="#00FBFF" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e2a38" vertical={false} />
                        <XAxis dataKey="date" stroke="transparent" tick={{ fill: '#3a4a5c', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis stroke="transparent" tick={{ fill: '#3a4a5c', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#0e1419', border: '1px solid #3a4a5c', borderRadius: '0', fontSize: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }} />
                        <Area type="monotone" dataKey="sales" stroke="#00FBFF" strokeWidth={2} fill="url(#salesGrad)" dot={false} activeDot={{ fill: '#00FBFF', r: 5, stroke: '#0e1419', strokeWidth: 2 }} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Two column: Performance + Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="bg-prime-dark/80 backdrop-blur-sm border border-prime-gunmetal/30 p-6 chamfer">
                    <h3 className="text-xs font-bold text-prime-gunmetal uppercase tracking-widest mb-4">Total Performance</h3>
                    <div className="space-y-1">
                        <StatRow label="Total Sales" value={`$${metrics.total_sales.toLocaleString()}`} accent="text-emerald-400" />
                        <StatRow label="Total Spend" value={`$${metrics.total_spend.toLocaleString()}`} accent="text-prime-energon" />
                        <StatRow label="Impressions" value={metrics.impressions.toLocaleString()} accent="text-prime-silver" />
                        <StatRow label="Clicks" value={metrics.clicks.toLocaleString()} accent="text-prime-silver" />
                    </div>
                </div>

                <div className="bg-prime-dark/80 backdrop-blur-sm border border-prime-gunmetal/30 p-6 chamfer">
                    <h3 className="text-xs font-bold text-prime-gunmetal uppercase tracking-widest mb-4">AI Analysis</h3>
                    <ul className="space-y-3">
                        <li className="flex items-start gap-2.5 text-sm text-prime-silver">
                            <span className="text-prime-red mt-0.5 text-xs">&#9656;</span>
                            <span>ACOS is {metrics.acos < 25 ? 'performing well' : 'above target'}. Consider adjusting bids.</span>
                        </li>
                        <li className="flex items-start gap-2.5 text-sm text-prime-silver">
                            <span className="text-prime-red mt-0.5 text-xs">&#9656;</span>
                            <span>ROAS of {metrics.roas.toFixed(2)}x indicates {metrics.roas > 3 ? 'strong' : 'moderate'} returns.</span>
                        </li>
                        <li className="flex items-start gap-2.5 text-sm text-prime-silver">
                            <span className="text-prime-red mt-0.5 text-xs">&#9656;</span>
                            <span>{ai_actions.filter(a => a.status === 'pending').length} actions pending optimization.</span>
                        </li>
                    </ul>
                </div>
            </div>

            {/* Autonomous Operator */}
            {autoLogs.length > 0 && (
                <div className="bg-prime-dark/80 backdrop-blur-sm border border-prime-gunmetal/30 p-6 chamfer">
                    <div className="flex items-center gap-3 mb-4">
                        <h2 className="text-xs font-bold text-prime-gunmetal uppercase tracking-widest">Autonomous Operator</h2>
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-prime-red/10 text-prime-red border border-prime-red/20 chamfer-sm">
                            Auto-Pilot
                        </span>
                    </div>
                    <div className="space-y-2">
                        {autoLogs.map((log) => (
                            <div key={log.id} className="flex items-start gap-3 p-3 bg-prime-black/40 border border-prime-gunmetal/15 hover:border-prime-gunmetal/30 transition-all duration-300 chamfer-sm">
                                <div className="w-1.5 h-1.5 rounded-full mt-2 bg-prime-energon animate-pulse shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-prime-silver text-sm font-semibold">
                                        {log.action_type === 'BID_UPDATE_ENSEMBLE' ? 'Bid Optimization' : log.action_type}
                                    </p>
                                    <p className="text-prime-gunmetal text-xs mt-0.5 truncate">{log.reason}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className="text-prime-gunmetal text-xs line-through block">${log.previous_value?.toFixed(2)}</span>
                                    <span className="text-emerald-400 text-sm font-bold block">${log.new_value?.toFixed(2)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* AI Actions Feed */}
            <div className="bg-prime-dark/80 backdrop-blur-sm border border-prime-gunmetal/30 p-6 chamfer">
                <h2 className="text-xs font-bold text-prime-gunmetal uppercase tracking-widest mb-4">Action Feed</h2>
                <div className="space-y-2">
                    {ai_actions.map((action) => (
                        <div key={action.id} className="flex items-start gap-3 p-3 bg-prime-black/40 border border-prime-gunmetal/15 hover:border-prime-gunmetal/30 transition-all duration-300 chamfer-sm">
                            <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${action.status === 'success' ? 'bg-emerald-400' : action.status === 'pending' ? 'bg-yellow-400' : 'bg-prime-red'} animate-pulse`} />
                            <div className="flex-1 min-w-0">
                                <p className="text-prime-silver text-sm font-semibold">{action.action}</p>
                                <p className="text-prime-gunmetal text-xs mt-0.5">{action.impact}</p>
                                <p className="text-prime-gunmetal/50 text-[10px] mt-1">
                                    {new Date(action.timestamp).toLocaleString()}
                                </p>
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 chamfer-sm ${action.status === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : action.status === 'pending' ? 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20' : 'bg-prime-red/10 text-red-400 border border-prime-red/20'}`}>
                                {action.status}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function MetricCard({ title, value, subtitle, accent, trend }: {
    title: string; value: string; subtitle: string; accent: string;
    trend: 'good' | 'warning' | 'bad';
}) {
    return (
        <div className="bg-prime-dark/80 backdrop-blur-sm border border-prime-gunmetal/30 p-4 hover:border-prime-gunmetal/50 transition-all duration-300 chamfer group">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] font-bold text-prime-gunmetal uppercase tracking-widest">{title}</h3>
                <span className={`text-sm ${trend === 'good' ? 'text-emerald-400' : trend === 'warning' ? 'text-yellow-400' : 'text-prime-red'}`}>
                    {trend === 'good' ? '\u25B2' : trend === 'warning' ? '\u25B6' : '\u25BC'}
                </span>
            </div>
            <div className={`text-2xl lg:text-3xl font-black text-${accent}`}>
                {value}
            </div>
            <p className="text-prime-gunmetal text-[10px] uppercase tracking-widest mt-1">{subtitle}</p>
        </div>
    );
}

function StatRow({ label, value, accent }: { label: string; value: string; accent: string }) {
    return (
        <div className="flex justify-between items-center py-2.5 border-b border-prime-gunmetal/15 last:border-0">
            <span className="text-prime-gunmetal text-sm">{label}</span>
            <span className={`${accent} font-bold text-sm`}>{value}</span>
        </div>
    );
}
