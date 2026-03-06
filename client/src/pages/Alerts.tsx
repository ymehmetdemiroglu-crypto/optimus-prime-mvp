import { useState, useEffect, useCallback } from 'react';
import { alertApi, alertRuleApi } from '../api/client';
import type { Alert, AlertRule } from '../types';

const severityColors: Record<string, string> = {
    critical: 'bg-red-500/10 text-red-400 border-red-500/20',
    high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    low: 'bg-prime-blue/10 text-blue-400 border-prime-blue/20',
};

const severityDots: Record<string, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-blue-500',
};

const ruleTypeLabels: Record<string, string> = {
    acos_threshold: 'ACoS Threshold',
    spend_spike: 'Spend Spike',
    no_sales: 'No Sales',
    ctr_drop: 'CTR Drop',
    budget_depletion: 'Budget Depletion',
};

type Tab = 'alerts' | 'rules';

export default function Alerts() {
    const [tab, setTab] = useState<Tab>('alerts');
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [rules, setRules] = useState<AlertRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [checking, setChecking] = useState(false);
    const [newAlertsCount, setNewAlertsCount] = useState(0);

    const loadAlerts = useCallback(async () => {
        try { setAlerts(await alertApi.getAlerts()); } catch (err) { console.error(err); }
    }, []);
    const loadRules = useCallback(async () => {
        try { setRules(await alertRuleApi.getRules()); } catch (err) { console.error(err); }
    }, []);

    useEffect(() => {
        setLoading(true);
        Promise.all([loadAlerts(), loadRules()]).finally(() => setLoading(false));
    }, [loadAlerts, loadRules]);

    const handleRunCheck = async () => {
        setChecking(true);
        try { const count = await alertApi.runCheck(); setNewAlertsCount(count); await loadAlerts(); }
        catch (err) { console.error(err); }
        finally { setChecking(false); }
    };
    const handleMarkRead = async (id: string) => { await alertApi.markRead(id); setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a)); };
    const handleMarkAllRead = async () => { await alertApi.markAllRead(); setAlerts(prev => prev.map(a => ({ ...a, is_read: true }))); };
    const handleDismiss = async (id: string) => { await alertApi.dismiss(id); setAlerts(prev => prev.filter(a => a.id !== id)); };
    const handleToggleRule = async (rule: AlertRule) => { const updated = await alertRuleApi.updateRule(rule.id, { is_enabled: !rule.is_enabled }); setRules(prev => prev.map(r => r.id === rule.id ? updated : r)); };

    const unreadCount = alerts.filter(a => !a.is_read).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[80vh]">
                <div className="w-10 h-10 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen p-6 lg:p-8 space-y-5">
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-wider">
                        <span className="text-yellow-400">Alerts</span>{' '}
                        <span className="text-prime-silver">& Rules</span>
                    </h1>
                    <p className="text-prime-gunmetal text-xs mt-1 uppercase tracking-widest font-semibold">
                        {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}` : 'All systems nominal'}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleRunCheck} disabled={checking}
                        className="px-4 py-2 bg-prime-dark border border-yellow-400/20 text-yellow-400 text-xs font-bold uppercase tracking-widest hover:border-yellow-400/40 transition-all disabled:opacity-50 chamfer-sm">
                        {checking ? 'Scanning...' : 'Run Alert Check'}
                    </button>
                    {unreadCount > 0 && tab === 'alerts' && (
                        <button onClick={handleMarkAllRead}
                            className="px-4 py-2 text-prime-gunmetal border border-prime-gunmetal/30 text-xs font-bold uppercase tracking-widest hover:text-prime-silver hover:border-prime-gunmetal transition-all chamfer-sm">
                            Mark All Read
                        </button>
                    )}
                </div>
            </div>

            {newAlertsCount > 0 && (
                <div className="bg-prime-energon/5 border border-prime-energon/20 px-4 py-3 text-prime-energon text-sm chamfer-sm">
                    {newAlertsCount} new alert{newAlertsCount > 1 ? 's' : ''} generated from rule check.
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 bg-prime-dark/80 border border-prime-gunmetal/20 p-1 w-fit chamfer-sm">
                {(['alerts', 'rules'] as Tab[]).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`px-5 py-2 text-xs font-bold uppercase tracking-widest transition-all chamfer-sm ${tab === t ? 'bg-prime-red/15 text-prime-red border border-prime-red/20' : 'text-prime-gunmetal hover:text-prime-silver border border-transparent'
                            }`}>
                        {t === 'alerts' ? `Alerts${unreadCount > 0 ? ` (${unreadCount})` : ''}` : 'Rules'}
                    </button>
                ))}
            </div>

            {/* Alerts Tab */}
            {tab === 'alerts' && (
                <div className="space-y-2">
                    {alerts.length === 0 ? (
                        <div className="bg-prime-dark/80 border border-prime-gunmetal/20 p-16 text-center chamfer">
                            <p className="text-prime-gunmetal text-sm uppercase tracking-wider">No alerts detected. Run a scan to check your campaigns.</p>
                        </div>
                    ) : alerts.map(alert => (
                        <div key={alert.id} className={`bg-prime-dark/80 border p-4 transition-all duration-300 hover:border-prime-gunmetal/40 chamfer-sm ${alert.is_read ? 'border-prime-gunmetal/10 opacity-60' : 'border-prime-gunmetal/25'
                            }`}>
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 flex-1">
                                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${severityDots[alert.severity]} ${!alert.is_read ? 'animate-pulse' : ''}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className={`text-sm font-bold ${alert.is_read ? 'text-prime-gunmetal' : 'text-prime-silver'}`}>{alert.title}</h3>
                                            <span className={`text-[10px] px-2 py-0.5 border font-bold uppercase tracking-wider chamfer-sm ${severityColors[alert.severity]}`}>{alert.severity}</span>
                                        </div>
                                        <p className="text-xs text-prime-gunmetal">{alert.message}</p>
                                        <div className="flex items-center gap-3 mt-2 text-[10px] text-prime-gunmetal/50">
                                            <span>Value: {alert.metric_value?.toFixed(1)}</span>
                                            <span>Threshold: {alert.threshold_value?.toFixed(1)}</span>
                                            <span>{new Date(alert.created_at).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-1.5 shrink-0">
                                    {!alert.is_read && (
                                        <button onClick={() => handleMarkRead(alert.id)} className="text-[10px] px-2.5 py-1 text-prime-gunmetal border border-prime-gunmetal/20 hover:text-prime-silver hover:border-prime-gunmetal transition-all uppercase tracking-widest font-bold chamfer-sm">Read</button>
                                    )}
                                    <button onClick={() => handleDismiss(alert.id)} className="text-[10px] px-2.5 py-1 text-prime-gunmetal/50 border border-prime-gunmetal/10 hover:text-red-400 hover:border-prime-red/20 transition-all uppercase tracking-widest font-bold chamfer-sm">Dismiss</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Rules Tab */}
            {tab === 'rules' && (
                <div className="space-y-2">
                    {rules.length === 0 ? (
                        <div className="bg-prime-dark/80 border border-prime-gunmetal/20 p-16 text-center chamfer">
                            <p className="text-prime-gunmetal text-sm">No rules configured.</p>
                        </div>
                    ) : rules.map(rule => (
                        <div key={rule.id} className="bg-prime-dark/80 border border-prime-gunmetal/20 p-4 hover:border-prime-gunmetal/35 transition-all duration-300 chamfer-sm">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                    <button onClick={() => handleToggleRule(rule)}
                                        className={`w-9 h-5 rounded-full transition-all duration-300 relative ${rule.is_enabled ? 'bg-prime-energon' : 'bg-prime-gunmetal/50'}`}>
                                        <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all duration-300 ${rule.is_enabled ? 'left-[18px]' : 'left-[3px]'}`} />
                                    </button>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-bold text-prime-silver">{rule.name}</h3>
                                            <span className="text-[10px] px-2 py-0.5 bg-prime-black/50 text-prime-gunmetal font-semibold chamfer-sm">{ruleTypeLabels[rule.rule_type] || rule.rule_type}</span>
                                            <span className={`text-[10px] px-2 py-0.5 border font-bold uppercase chamfer-sm ${severityColors[rule.severity]}`}>{rule.severity}</span>
                                        </div>
                                        <p className="text-xs text-prime-gunmetal mt-1">{rule.description}</p>
                                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-prime-gunmetal/50">
                                            <span>Cooldown: {rule.cooldown_minutes}m</span>
                                            {rule.last_triggered_at && <span>Last fired: {new Date(rule.last_triggered_at).toLocaleString()}</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
