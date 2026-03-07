import type { HealthStatus } from '../../types';

export function TabButton({
    active,
    onClick,
    title,
    subtitle,
}: {
    active: boolean;
    onClick: () => void;
    title: string;
    subtitle: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`px-5 py-3 text-left transition-all border chamfer-sm ${
                active
                    ? 'bg-prime-darker border-prime-energon/30 shadow-energon'
                    : 'bg-prime-dark border-prime-gunmetal/20 hover:border-prime-gunmetal/40'
            }`}
        >
            <div
                className={`font-bold text-xs uppercase tracking-widest ${
                    active ? 'text-prime-energon' : 'text-prime-gunmetal'
                }`}
            >
                {title}
            </div>
            <div className="text-[10px] text-prime-gunmetal/50 mt-0.5 uppercase tracking-wider">
                {subtitle}
            </div>
        </button>
    );
}

export function ConfidenceBar({ value }: { value: number }) {
    const percent = Math.min(100, value * 100);
    const color =
        percent >= 70
            ? 'bg-emerald-400'
            : percent >= 40
              ? 'bg-yellow-400'
              : 'bg-prime-red';
    return (
        <div className="flex items-center gap-2 justify-end">
            <div className="w-16 bg-prime-darker h-1.5 overflow-hidden">
                <div
                    className={`h-full ${color} transition-all`}
                    style={{ width: `${percent}%` }}
                />
            </div>
            <span className="text-xs text-prime-gunmetal w-8 text-right">
                {percent.toFixed(0)}%
            </span>
        </div>
    );
}

export function HealthBadge({ status }: { status?: HealthStatus }) {
    if (!status) return <span className="text-prime-gunmetal/40 text-[10px]">--</span>;
    const colors: Record<HealthStatus, string> = {
        excellent: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        good: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        at_risk: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        declining: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    const labels: Record<HealthStatus, string> = {
        excellent: 'EXCELLENT',
        good: 'GOOD',
        at_risk: 'AT RISK',
        declining: 'DECLINING',
        critical: 'CRITICAL',
    };
    return (
        <span
            className={`inline-block text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 border chamfer-sm ${colors[status]}`}
        >
            {labels[status]}
        </span>
    );
}

export function CompetitionBadge({ level }: { level?: 'low' | 'medium' | 'high' }) {
    if (!level) return <span className="text-prime-gunmetal/40 text-[10px]">--</span>;
    const colors: Record<string, string> = {
        low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        high: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return (
        <span
            className={`inline-block text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 border chamfer-sm ${colors[level]}`}
        >
            {level}
        </span>
    );
}

export function Spinner({ text, subtext }: { text: string; subtext?: string }) {
    return (
        <div className="text-center py-16">
            <div className="w-10 h-10 border-2 border-prime-energon/30 border-t-prime-energon rounded-full animate-spin mx-auto mb-4" />
            <div className="text-prime-energon text-sm font-bold uppercase tracking-widest mb-1">
                {text}
            </div>
            {subtext && (
                <p className="text-prime-gunmetal text-xs">{subtext}</p>
            )}
        </div>
    );
}
