import { useState } from 'react';
import { keywordApi } from '../api/client';
import type { Keyword } from '../types';

interface KeywordTableProps {
    keywords: Keyword[];
    onKeywordUpdated: (updated: Keyword) => void;
    onKeywordDeleted: (id: string) => void;
}

type SortField = 'keyword_text' | 'bid' | 'impressions' | 'clicks' | 'spend' | 'sales' | 'acos';
type SortDir = 'asc' | 'desc';

export default function KeywordTable({ keywords, onKeywordUpdated }: KeywordTableProps) {
    const [sortField, setSortField] = useState<SortField>('spend');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [editingBid, setEditingBid] = useState<string | null>(null);
    const [bidValue, setBidValue] = useState('');
    const [filter, setFilter] = useState('');

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('desc');
        }
    };

    const handleBidSave = async (id: string) => {
        const newBid = parseFloat(bidValue);
        if (isNaN(newBid) || newBid <= 0) return;
        try {
            const updated = await keywordApi.updateKeyword(id, { bid: newBid });
            onKeywordUpdated(updated);
        } catch (error) {
            console.error('Failed to update bid:', error);
        }
        setEditingBid(null);
    };

    const handleToggleStatus = async (kw: Keyword) => {
        const newStatus = kw.status === 'active' ? 'paused' : 'active';
        try {
            const updated = await keywordApi.updateKeyword(kw.id, { status: newStatus });
            onKeywordUpdated(updated);
        } catch (error) {
            console.error('Failed to toggle status:', error);
        }
    };

    const filtered = keywords.filter(kw =>
        kw.keyword_text.toLowerCase().includes(filter.toLowerCase())
    );

    const sorted = [...filtered].sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        if (typeof aVal === 'string' && typeof bVal === 'string') {
            return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return sortDir === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
    });

    const SortIcon = ({ field }: { field: SortField }) => (
        <span className="ml-1 text-xs">
            {sortField === field ? (sortDir === 'asc' ? '▲' : '▼') : '▽'}
        </span>
    );

    return (
        <div>
            {/* Filter */}
            <div className="mb-4">
                <input
                    type="text"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filter keywords..."
                    className="input w-64"
                />
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-800 text-gray-400">
                            <th className="text-left py-3 px-2">Status</th>
                            <th className="text-left py-3 px-2 cursor-pointer hover:text-gray-200" onClick={() => handleSort('keyword_text')}>
                                Keyword<SortIcon field="keyword_text" />
                            </th>
                            <th className="text-left py-3 px-2">Match</th>
                            <th className="text-right py-3 px-2 cursor-pointer hover:text-gray-200" onClick={() => handleSort('bid')}>
                                Bid<SortIcon field="bid" />
                            </th>
                            <th className="text-right py-3 px-2 cursor-pointer hover:text-gray-200" onClick={() => handleSort('impressions')}>
                                Impr.<SortIcon field="impressions" />
                            </th>
                            <th className="text-right py-3 px-2 cursor-pointer hover:text-gray-200" onClick={() => handleSort('clicks')}>
                                Clicks<SortIcon field="clicks" />
                            </th>
                            <th className="text-right py-3 px-2 cursor-pointer hover:text-gray-200" onClick={() => handleSort('spend')}>
                                Spend<SortIcon field="spend" />
                            </th>
                            <th className="text-right py-3 px-2 cursor-pointer hover:text-gray-200" onClick={() => handleSort('sales')}>
                                Sales<SortIcon field="sales" />
                            </th>
                            <th className="text-right py-3 px-2 cursor-pointer hover:text-gray-200" onClick={() => handleSort('acos')}>
                                ACoS<SortIcon field="acos" />
                            </th>
                            <th className="text-right py-3 px-2">CTR</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((kw) => (
                            <tr
                                key={kw.id}
                                className="border-b border-gray-800/50 hover:bg-cyber-darker/50 transition-colors"
                            >
                                <td className="py-2 px-2">
                                    <button
                                        onClick={() => handleToggleStatus(kw)}
                                        className={`w-3 h-3 rounded-full ${
                                            kw.status === 'active' ? 'bg-cyber-lime' :
                                            kw.status === 'paused' ? 'bg-yellow-400' :
                                            'bg-gray-600'
                                        }`}
                                        title={`${kw.status} — click to toggle`}
                                    />
                                </td>
                                <td className="py-2 px-2 text-gray-100 font-medium">
                                    {kw.keyword_text}
                                </td>
                                <td className="py-2 px-2">
                                    <span className={`text-xs px-2 py-0.5 rounded ${
                                        kw.match_type === 'exact' ? 'bg-cyber-cyan/20 text-cyber-cyan' :
                                        kw.match_type === 'phrase' ? 'bg-cyber-purple/20 text-cyber-purple' :
                                        'bg-cyber-blue/20 text-cyber-blue'
                                    }`}>
                                        {kw.match_type}
                                    </span>
                                </td>
                                <td className="py-2 px-2 text-right">
                                    {editingBid === kw.id ? (
                                        <div className="flex items-center justify-end gap-1">
                                            <input
                                                type="number"
                                                value={bidValue}
                                                onChange={(e) => setBidValue(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleBidSave(kw.id);
                                                    if (e.key === 'Escape') setEditingBid(null);
                                                }}
                                                className="w-20 bg-cyber-darker border border-cyber-cyan/50 rounded px-1 py-0.5 text-right text-sm text-gray-100"
                                                step="0.01"
                                                min="0.01"
                                                autoFocus
                                            />
                                            <button onClick={() => handleBidSave(kw.id)} className="text-cyber-lime text-xs">OK</button>
                                        </div>
                                    ) : (
                                        <span
                                            className="text-cyber-cyan cursor-pointer hover:underline"
                                            onClick={() => { setEditingBid(kw.id); setBidValue(kw.bid.toFixed(2)); }}
                                        >
                                            ${kw.bid.toFixed(2)}
                                        </span>
                                    )}
                                </td>
                                <td className="py-2 px-2 text-right text-gray-300">{kw.impressions.toLocaleString()}</td>
                                <td className="py-2 px-2 text-right text-gray-300">{kw.clicks.toLocaleString()}</td>
                                <td className="py-2 px-2 text-right text-gray-300">${kw.spend.toFixed(2)}</td>
                                <td className="py-2 px-2 text-right text-cyber-lime">${kw.sales.toFixed(2)}</td>
                                <td className="py-2 px-2 text-right">
                                    <span className={kw.acos > 30 ? 'text-cyber-red' : kw.acos > 20 ? 'text-yellow-400' : 'text-cyber-lime'}>
                                        {kw.acos.toFixed(1)}%
                                    </span>
                                </td>
                                <td className="py-2 px-2 text-right text-gray-400">
                                    {kw.impressions > 0 ? ((kw.clicks / kw.impressions) * 100).toFixed(2) : '0.00'}%
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {sorted.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                    {filter ? 'No keywords match your filter' : 'No keywords found for this campaign'}
                </div>
            )}

            {/* Summary */}
            {sorted.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-800 flex gap-6 text-sm text-gray-400">
                    <span>{sorted.length} keywords</span>
                    <span>Active: {sorted.filter(k => k.status === 'active').length}</span>
                    <span>Total Spend: <span className="text-gray-200">${sorted.reduce((s, k) => s + k.spend, 0).toFixed(2)}</span></span>
                    <span>Total Sales: <span className="text-cyber-lime">${sorted.reduce((s, k) => s + k.sales, 0).toFixed(2)}</span></span>
                </div>
            )}
        </div>
    );
}
