import { useState, useEffect } from 'react';
import { modelTrackingApi } from '../api/client';
import type { ModelLeaderboardEntry } from '../types';

const modelLabels: Record<string, string> = {
    thompson: 'Model Alpha',
    q_learning: 'Model Bravo',
    ensemble: 'Combined Model',
};

const modelColors: Record<string, string> = {
    thompson: 'prime-energon',
    q_learning: 'prime-blue',
    ensemble: 'emerald-400',
};

export default function ModelLeaderboard() {
    const [leaderboard, setLeaderboard] = useState<ModelLeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [evaluating, setEvaluating] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => { loadLeaderboard(); }, []);

    const loadLeaderboard = async () => {
        setLoading(true);
        try {
            const data = await modelTrackingApi.getLeaderboard();
            setLeaderboard(data);
        } catch (err) {
            console.error('Failed to load leaderboard:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleEvaluate = async () => {
        setEvaluating(true);
        try {
            const count = await modelTrackingApi.evaluatePredictions(7);
            setMessage(`Evaluated ${count} predictions`);
            await loadLeaderboard();
        } catch (err) {
            setMessage('Failed to evaluate predictions');
        } finally {
            setEvaluating(false);
        }
    };

    if (loading) {
        return (
            <div className="text-center py-12">
                <div className="w-8 h-8 border-2 border-prime-energon/30 border-t-prime-energon rounded-full animate-spin mx-auto mb-3" />
                <p className="text-prime-gunmetal text-xs uppercase tracking-widest">Loading model data...</p>
            </div>
        );
    }

    if (leaderboard.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-prime-gunmetal text-sm uppercase tracking-widest">No model predictions logged yet</p>
                <p className="text-prime-gunmetal/50 text-xs mt-2">Apply bid recommendations to start tracking model performance</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-prime-silver uppercase tracking-widest">Model Leaderboard</h3>
                <button onClick={handleEvaluate} disabled={evaluating}
                    className="px-4 py-2 bg-prime-dark border border-prime-gunmetal/30 text-prime-gunmetal text-xs font-bold uppercase tracking-widest hover:text-prime-silver hover:border-prime-gunmetal transition-all chamfer-sm disabled:opacity-50">
                    {evaluating ? 'Evaluating...' : 'Evaluate Predictions'}
                </button>
            </div>

            {message && (
                <div className="px-3 py-2 bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 text-xs chamfer-sm">{message}</div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {leaderboard.map((entry, idx) => {
                    const color = modelColors[entry.model_type] || 'prime-silver';
                    const hitColor = entry.hit_rate >= 70 ? 'text-emerald-400' : entry.hit_rate >= 50 ? 'text-yellow-400' : 'text-prime-red';

                    return (
                        <div key={entry.model_type} className={`bg-prime-dark/80 border ${idx === 0 ? 'border-emerald-500/30' : 'border-prime-gunmetal/20'} p-5 chamfer relative`}>
                            {idx === 0 && (
                                <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase tracking-widest chamfer-sm">
                                    Leader
                                </span>
                            )}

                            <div className={`text-xs font-bold uppercase tracking-widest text-${color} mb-3`}>
                                {modelLabels[entry.model_type] || entry.model_type}
                            </div>

                            <div className="space-y-2.5">
                                <div className="flex justify-between items-center">
                                    <span className="text-prime-gunmetal text-xs">Hit Rate</span>
                                    <span className={`font-bold text-lg ${hitColor}`}>{entry.hit_rate.toFixed(1)}%</span>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="text-prime-gunmetal text-xs">Total Predictions</span>
                                    <span className="text-prime-silver font-semibold">{entry.total_predictions}</span>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="text-prime-gunmetal text-xs">Evaluated</span>
                                    <span className="text-prime-silver font-semibold">{entry.evaluated_predictions}</span>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="text-prime-gunmetal text-xs">Avg Improvement</span>
                                    <span className={`font-semibold ${entry.avg_improvement > 0 ? 'text-emerald-400' : 'text-prime-red'}`}>
                                        {entry.avg_improvement > 0 ? '+' : ''}{entry.avg_improvement.toFixed(2)}%
                                    </span>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="text-prime-gunmetal text-xs">Avg ACoS Change</span>
                                    <span className={`font-semibold ${entry.avg_acos_change > 0 ? 'text-emerald-400' : 'text-prime-red'}`}>
                                        {entry.avg_acos_change > 0 ? '-' : '+'}{Math.abs(entry.avg_acos_change).toFixed(2)}%
                                    </span>
                                </div>
                            </div>

                            <div className="mt-3 pt-3 border-t border-prime-gunmetal/15">
                                <div className="w-full bg-prime-darker h-1.5 overflow-hidden">
                                    <div className={`h-full ${entry.hit_rate >= 70 ? 'bg-emerald-400' : entry.hit_rate >= 50 ? 'bg-yellow-400' : 'bg-prime-red'} transition-all`}
                                        style={{ width: `${Math.min(100, entry.hit_rate)}%` }} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
