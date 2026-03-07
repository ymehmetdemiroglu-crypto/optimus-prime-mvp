import { useState, useEffect } from 'react';
import { competitiveApi } from '../api/client';
import type { Competitor } from '../api/client';

export default function Competitive() {
    const [competitors, setCompetitors] = useState<Competitor[]>([]);
    const [loading, setLoading] = useState(true);
    const [newAsin, setNewAsin] = useState('');
    const [newBrand, setNewBrand] = useState('');
    const [newTitle, setNewTitle] = useState('');
    const [adding, setAdding] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => { loadCompetitors(); }, []);

    const loadCompetitors = async () => {
        setLoading(true);
        try { setCompetitors(await competitiveApi.getCompetitors()); }
        catch (error) { console.error('Failed to load competitors:', error); setMessage('Failed to load competitor data'); }
        finally { setLoading(false); }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAsin) return;
        if (!/^B[A-Z0-9]{9}$/.test(newAsin)) {
            setMessage('Invalid ASIN format. Must be 10 characters starting with B (e.g. B08X123456).');
            return;
        }
        if (newBrand.length > 200 || newTitle.length > 500) {
            setMessage('Brand name (max 200) or product title (max 500) is too long.');
            return;
        }
        setAdding(true); setMessage('');
        try {
            await competitiveApi.addCompetitor(newAsin, newBrand, newTitle);
            setMessage('Tracker added successfully');
            setNewAsin(''); setNewBrand(''); setNewTitle('');
            await loadCompetitors();
        } catch (error) { console.error('Failed to add competitor:', error); setMessage('Failed to add competitor (ASIN may already exist)'); }
        finally { setAdding(false); }
    };

    return (
        <div className="min-h-screen p-6 lg:p-8 space-y-5">
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-wider">
                        <span className="text-prime-blue">Competitive</span>{' '}
                        <span className="text-prime-silver">Intel</span>
                    </h1>
                    <p className="text-prime-gunmetal text-xs mt-1 uppercase tracking-widest font-semibold">Track competitor ASINs, pricing, and share of voice</p>
                </div>
                <span className="text-[10px] text-prime-gunmetal uppercase tracking-widest font-bold">{competitors.length} tracked</span>
            </div>

            {message && (
                <div className={`px-4 py-3 text-sm chamfer-sm ${message.includes('success')
                    ? 'bg-emerald-500/5 border border-emerald-500/20 text-emerald-400'
                    : 'bg-yellow-500/5 border border-yellow-500/20 text-yellow-400'
                    }`}>{message}</div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Add Tracker Form */}
                <div className="relative bg-prime-dark/80 backdrop-blur-sm border border-prime-gunmetal/30 p-6 h-fit overflow-hidden chamfer">
                    <h3 className="text-xs font-bold text-prime-gunmetal mb-5 uppercase tracking-widest">Add New Tracker</h3>
                    <form onSubmit={handleAdd} className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-bold text-prime-gunmetal mb-1.5 uppercase tracking-widest">ASIN <span className="text-prime-red">*</span></label>
                            <input type="text" value={newAsin} onChange={(e) => setNewAsin(e.target.value.toUpperCase())} placeholder="e.g. B08X12345" required className="input font-mono" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-prime-gunmetal mb-1.5 uppercase tracking-widest">Brand Name</label>
                            <input type="text" value={newBrand} onChange={(e) => setNewBrand(e.target.value)} placeholder="Competitor Brand" className="input" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-prime-gunmetal mb-1.5 uppercase tracking-widest">Product Title</label>
                            <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Short description" className="input" />
                        </div>
                        <button type="submit" disabled={!newAsin || adding} className="btn-primary w-full disabled:opacity-40 disabled:hover:scale-100 mt-2">
                            {adding ? 'Adding...' : 'Start Tracking'}
                        </button>
                    </form>
                </div>

                {/* Tracking List */}
                <div className="lg:col-span-2 space-y-3">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-10 h-10 border-2 border-prime-blue/30 border-t-prime-blue rounded-full animate-spin" />
                        </div>
                    ) : competitors.length > 0 ? (
                        competitors.map((comp) => (
                            <div key={comp.competitor_id} className="bg-prime-dark/80 backdrop-blur-sm border border-prime-gunmetal/20 p-5 hover:border-prime-gunmetal/40 transition-all duration-300 chamfer">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="flex items-center gap-2.5">
                                            <h4 className="text-base font-bold text-prime-silver">{comp.brand_name || 'Unknown Brand'}</h4>
                                            <span className="text-[10px] bg-prime-black/60 text-prime-gunmetal px-2 py-0.5 font-mono chamfer-sm">{comp.asin}</span>
                                            {!comp.is_active && (
                                                <span className="text-[10px] bg-prime-red/10 text-red-400 px-2 py-0.5 font-bold uppercase chamfer-sm">Inactive</span>
                                            )}
                                        </div>
                                        <p className="text-prime-gunmetal text-xs mt-1">{comp.product_title || 'No title provided'}</p>
                                    </div>
                                    {comp.share_of_voice_percent !== null && (
                                        <div className="text-right">
                                            <div className="text-xl font-black text-prime-energon">{comp.share_of_voice_percent}%</div>
                                            <div className="text-[10px] text-prime-gunmetal uppercase tracking-widest">SoV</div>
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-prime-gunmetal/15">
                                    <MetricCell label="Est. Price" value={comp.estimated_price ? `$${comp.estimated_price.toFixed(2)}` : '--'} />
                                    <MetricCell label="BSR" value={comp.bsr ? `#${comp.bsr.toLocaleString()}` : '--'} />
                                    <MetricCell label="Rating" value={comp.rating ? `${comp.rating.toFixed(1)}` : '--'} accent="text-prime-gold" suffix={comp.review_count ? `(${comp.review_count})` : ''} />
                                    <MetricCell label="Est. Daily Sales" value={comp.estimated_daily_sales ? `${comp.estimated_daily_sales.toLocaleString()}` : '--'} accent="text-emerald-400" />
                                </div>
                                <div className="text-right pt-2 text-[10px] text-prime-gunmetal/50">{comp.latest_metrics_date ? `Data as of ${comp.latest_metrics_date}` : 'Awaiting data sync'}</div>
                            </div>
                        ))
                    ) : (
                        <div className="bg-prime-dark/80 border border-dashed border-prime-gunmetal/30 py-20 text-center chamfer">
                            <p className="text-prime-gunmetal text-sm uppercase tracking-wider">No competitors tracked yet.<br /><span className="text-prime-gunmetal/50">Add an ASIN to begin intelligence gathering.</span></p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function MetricCell({ label, value, accent, suffix }: { label: string; value: string; accent?: string; suffix?: string }) {
    return (
        <div>
            <div className="text-[10px] text-prime-gunmetal uppercase tracking-widest mb-0.5">{label}</div>
            <div className={`text-sm font-bold ${accent || 'text-prime-silver'}`}>
                {value}{suffix && <span className="text-prime-gunmetal text-[10px] ml-1">{suffix}</span>}
            </div>
        </div>
    );
}
