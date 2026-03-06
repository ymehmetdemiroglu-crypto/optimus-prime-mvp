import { useState, useEffect } from 'react';
import { integrationApi } from '../api/client';
import type { SPApiCredentials, SyncLog } from '../api/client';

export default function Settings() {
    const [credentials, setCredentials] = useState<SPApiCredentials | null>(null);
    const [logs, setLogs] = useState<SyncLog[]>([]);
    const [loading, setLoading] = useState(true);

    const [region, setRegion] = useState('NA');
    const [clientId, setClientId] = useState('');
    const [clientSecret, setClientSecret] = useState('');
    const [refreshToken, setRefreshToken] = useState('');
    const [saving, setSaving] = useState(false);

    const [syncing, setSyncing] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [creds, recentLogs] = await Promise.all([integrationApi.getCredentials(), integrationApi.getRecentLogs(10)]);
            setCredentials(creds); setLogs(recentLogs);
            if (creds) setRegion(creds.region);
        } catch (error) { console.error('Failed to load settings data:', error); }
        finally { setLoading(false); }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault(); setSaving(true); setMessage(null);
        try {
            await integrationApi.saveCredentials({ region, client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken });
            setMessage({ type: 'success', text: 'Credentials saved successfully.' });
            setClientId(''); setClientSecret(''); setRefreshToken(''); await loadData();
        } catch (error) { console.error('Save failed:', error); setMessage({ type: 'error', text: 'Failed to save credentials.' }); }
        finally { setSaving(false); }
    };

    const handleSync = async (syncType: string) => {
        setSyncing(true); setMessage(null);
        try { await integrationApi.simulateSync(syncType); setMessage({ type: 'success', text: `${syncType} sync completed successfully.` }); await loadData(); }
        catch (error) { console.error('Sync failed:', error); setMessage({ type: 'error', text: `Failed to sync ${syncType}.` }); }
        finally { setSyncing(false); }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[80vh]">
                <div className="w-10 h-10 border-2 border-prime-gunmetal/30 border-t-prime-silver rounded-full animate-spin" />
            </div>
        );
    }

    const inputClass = "w-full bg-prime-black/60 border border-prime-gunmetal/40 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:border-prime-energon/50 focus:outline-none focus:ring-2 focus:ring-prime-energon/15 transition-all duration-300 chamfer-sm";

    return (
        <div className="min-h-screen p-6 lg:p-8 space-y-5">
            <div>
                <h1 className="text-3xl font-black uppercase tracking-wider">
                    <span className="text-prime-silver">Settings</span>{' '}
                    <span className="text-prime-gunmetal">&</span>{' '}
                    <span className="text-prime-silver">Integrations</span>
                </h1>
                <p className="text-prime-gunmetal text-xs mt-1 uppercase tracking-widest font-semibold">Manage your Amazon SP-API connection and preferences</p>
            </div>

            {message && (
                <div className={`px-4 py-3 text-sm chamfer-sm ${message.type === 'success'
                    ? 'bg-emerald-500/5 border border-emerald-500/20 text-emerald-400'
                    : 'bg-prime-red/5 border border-prime-red/20 text-red-400'
                    }`}>{message.text}</div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* SP-API Configuration */}
                <div className="bg-prime-dark/80 backdrop-blur-sm border border-prime-gunmetal/30 p-6 chamfer">
                    <div className="flex justify-between items-start mb-6">
                        <h2 className="text-xs font-bold text-prime-gunmetal uppercase tracking-widest">Amazon SP-API</h2>
                        <div className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest chamfer-sm ${credentials?.is_connected
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-prime-gunmetal/10 text-prime-gunmetal border border-prime-gunmetal/20'
                            }`}>
                            {credentials?.is_connected ? 'Connected' : 'Disconnected'}
                        </div>
                    </div>

                    <form onSubmit={handleSave} className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-bold text-prime-gunmetal mb-1.5 uppercase tracking-widest">Selling Region</label>
                            <select value={region} onChange={(e) => setRegion(e.target.value)} className={inputClass}>
                                <option value="NA">North America (US, CA, MX)</option>
                                <option value="EU">Europe (UK, DE, FR, IT, ES)</option>
                                <option value="FE">Far East (JP, SG, AU)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-prime-gunmetal mb-1.5 uppercase tracking-widest">LWA Client ID</label>
                            <input type="text" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder={credentials?.is_connected ? "••••••••" : "amzn1.application-oa2-client..."} className={inputClass} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-prime-gunmetal mb-1.5 uppercase tracking-widest">LWA Client Secret</label>
                            <input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder={credentials?.is_connected ? "••••••••" : ""} className={inputClass} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-prime-gunmetal mb-1.5 uppercase tracking-widest">Refresh Token</label>
                            <input type="password" value={refreshToken} onChange={(e) => setRefreshToken(e.target.value)} placeholder={credentials?.is_connected ? "••••••••" : "Atzr|..."} className={inputClass} />
                        </div>
                        <button type="submit" disabled={saving || (!credentials?.is_connected && (!clientId || !clientSecret || !refreshToken))} className="btn-primary w-full disabled:opacity-40 disabled:hover:scale-100 mt-2">
                            {saving ? 'Saving...' : credentials?.is_connected ? 'Update Credentials' : 'Connect Account'}
                        </button>
                    </form>
                </div>

                {/* Data Synchronization */}
                <div className="bg-prime-dark/80 backdrop-blur-sm border border-prime-gunmetal/30 p-6 chamfer">
                    <h2 className="text-xs font-bold text-prime-gunmetal uppercase tracking-widest mb-6">Data Synchronization</h2>
                    <div className="space-y-3">
                        <SyncCard title="Catalog & Campaigns" subtitle="Sync portfolio structure" onSync={() => handleSync('CAMPAIGNS')} disabled={syncing || !credentials?.is_connected} syncing={syncing} />
                        <SyncCard title="60-Day Performance Data" subtitle="Sync metrics for optimization models" onSync={() => handleSync('PERFORMANCE')} disabled={syncing || !credentials?.is_connected} syncing={syncing} />
                    </div>

                    <div className="pt-5 mt-5 border-t border-prime-gunmetal/20">
                        <h3 className="text-[10px] font-bold text-prime-gunmetal mb-3 uppercase tracking-widest">Recent Sync Logs</h3>
                        {logs.length > 0 ? (
                            <div className="space-y-2">
                                {logs.map(log => (
                                    <div key={log.id} className="flex justify-between items-center text-xs py-1.5">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-1.5 h-1.5 rounded-full ${log.status === 'success' ? 'bg-emerald-400' : log.status === 'in_progress' ? 'bg-prime-energon animate-pulse' : 'bg-red-400'}`} />
                                            <span className="text-prime-silver">{log.sync_type}</span>
                                        </div>
                                        <span className="text-prime-gunmetal/50 text-[10px]">{new Date(log.started_at).toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-prime-gunmetal/50">No recent sync activity.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function SyncCard({ title, subtitle, onSync, disabled, syncing }: {
    title: string; subtitle: string; onSync: () => void; disabled: boolean; syncing: boolean;
}) {
    return (
        <div className="p-4 bg-prime-black/40 border border-prime-gunmetal/15 hover:border-prime-gunmetal/30 transition-all duration-300 chamfer-sm">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-sm font-bold text-prime-silver">{title}</h3>
                    <p className="text-[10px] text-prime-gunmetal">{subtitle}</p>
                </div>
                <button onClick={onSync} disabled={disabled}
                    className="px-3 py-1.5 bg-emerald-500/5 border border-emerald-500/15 text-emerald-400 text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-500/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed chamfer-sm">
                    {syncing ? 'Syncing...' : 'Sync Now'}
                </button>
            </div>
        </div>
    );
}
