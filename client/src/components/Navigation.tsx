import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function Navigation() {
    const location = useLocation();
    const { user, signOut } = useAuth();
    const [pendingCount, setPendingCount] = useState(0);

    // Fetch pending approval count
    useEffect(() => {
        const fetchCount = async () => {
            try {
                const { count } = await supabase
                    .from('pending_approvals')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'pending');
                setPendingCount(count || 0);
            } catch { /* ignore */ }
        };
        fetchCount();
        const interval = setInterval(fetchCount, 60000); // Refresh every minute
        return () => clearInterval(interval);
    }, []);

    const navItems = [
        { path: '/', label: 'War Room' },
        { path: '/campaigns', label: 'Campaigns' },
        { path: '/optimize', label: 'Optimize' },
        { path: '/experiments', label: 'A/B Tests' },
        { path: '/portfolio', label: 'Portfolio' },
        { path: '/forecasts', label: 'Forecasts' },
        { path: '/competitive', label: 'Intel' },
        { path: '/semantic', label: 'Semantic' },
        { path: '/reports', label: 'Reports' },
        { path: '/alerts', label: 'Alerts' },
        { path: '/approvals', label: 'Approvals', badge: pendingCount },
        { path: '/chat', label: 'Optimus AI' },
        { path: '/settings', label: 'Settings' },
    ];

    return (
        <nav className="bg-prime-dark/90 backdrop-blur-xl border-b border-prime-gunmetal/30 sticky top-0 z-50">
            <div className="max-w-[1600px] mx-auto px-6">
                <div className="flex items-center justify-between h-12">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2.5 shrink-0">
                        <div className="w-7 h-7 bg-gradient-to-br from-prime-red to-prime-blue flex items-center justify-center chamfer-sm">
                            <span className="text-white font-black text-[10px] tracking-tighter">OP</span>
                        </div>
                        <div className="hidden lg:block">
                            <h1 className="text-xs font-black uppercase tracking-wider leading-none">
                                <span className="text-prime-red">Optimus</span>{' '}
                                <span className="text-prime-silver">Prime</span>
                            </h1>
                        </div>
                    </Link>

                    {/* Navigation Links */}
                    <div className="flex items-center gap-0.5">
                        {navItems.map((item) => {
                            const isActive = location.pathname === item.path;
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`relative px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all duration-200 ${isActive
                                        ? 'text-prime-energon'
                                        : 'text-prime-gunmetal hover:text-prime-silver'
                                        }`}
                                >
                                    {item.label}
                                    {item.badge > 0 && (
                                        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center text-[9px] font-black bg-prime-red text-white rounded-full leading-none">
                                            {item.badge > 99 ? '99+' : item.badge}
                                        </span>
                                    )}
                                    {isActive && (
                                        <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-prime-red" />
                                    )}
                                </Link>
                            );
                        })}
                    </div>

                    {/* User Info & Logout */}
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 bg-prime-energon rounded-full animate-pulse" />
                            <span className="text-[10px] text-prime-gunmetal uppercase tracking-widest font-bold">Online</span>
                        </div>
                        {user && (
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-prime-gunmetal hidden xl:inline max-w-[140px] truncate">
                                    {user.email}
                                </span>
                                <button
                                    onClick={signOut}
                                    className="px-2.5 py-1 text-[10px] font-bold text-prime-gunmetal border border-prime-gunmetal/30 hover:text-prime-silver hover:border-prime-gunmetal transition-all uppercase tracking-widest chamfer-sm"
                                >
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}
