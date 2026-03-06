import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export default function Login() {
    const { user, loading, signIn, signUp } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-prime-energon text-xl animate-pulse">Initializing...</div>
            </div>
        );
    }

    if (user) {
        return <Navigate to="/" replace />;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);

        const { error } = isSignUp
            ? await signUp(email, password)
            : await signIn(email, password);

        if (error) {
            setError(error);
        }
        setSubmitting(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background grid overlay */}
            <div className="absolute inset-0 opacity-[0.04]" style={{
                backgroundImage: 'linear-gradient(rgba(196,30,58,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(26,79,139,0.4) 1px, transparent 1px)',
                backgroundSize: '60px 60px'
            }} />

            {/* Ambient glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute w-[500px] h-[500px] rounded-full bg-prime-red/5 blur-[150px] -top-40 -right-40" />
                <div className="absolute w-[400px] h-[400px] rounded-full bg-prime-blue/5 blur-[120px] -bottom-32 -left-32" />
            </div>

            <div className="w-full max-w-md relative z-10">
                {/* Logo */}
                <div className="text-center mb-10">
                    <div className="relative inline-block mb-5">
                        <div className="w-20 h-20 bg-gradient-to-br from-prime-red to-prime-blue flex items-center justify-center shadow-autobot-red mx-auto chamfer">
                            <span className="text-white font-black text-3xl tracking-tighter">OP</span>
                        </div>
                        <div className="absolute -inset-3 bg-gradient-to-br from-prime-red/15 to-prime-blue/15 blur-xl -z-10 animate-pulse" />
                    </div>
                    <h1 className="text-4xl font-black uppercase tracking-wider">
                        <span className="text-prime-red">Optimus</span>{' '}
                        <span className="text-prime-silver">Prime</span>
                    </h1>
                    <p className="text-prime-gunmetal mt-2 text-sm tracking-[0.3em] uppercase font-semibold">Command Dashboard</p>
                </div>

                {/* Form Card */}
                <div className="relative group">
                    <div className="absolute -inset-[1px] bg-gradient-to-r from-prime-red/30 via-prime-gunmetal/30 to-prime-blue/30 blur-sm opacity-60 group-hover:opacity-100 transition-opacity duration-500 chamfer" />

                    <div className="relative bg-prime-dark/95 backdrop-blur-xl border border-prime-gunmetal/40 p-8 chamfer">
                        <h2 className="text-xl font-bold text-gray-100 mb-1 uppercase tracking-wide">
                            {isSignUp ? 'Create Account' : 'Welcome Back'}
                        </h2>
                        <p className="text-prime-gunmetal text-sm mb-8">
                            {isSignUp ? 'Join the command center' : 'Sign in to your dashboard'}
                        </p>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-prime-gunmetal mb-2 uppercase tracking-widest">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="input"
                                    placeholder="you@example.com"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-prime-gunmetal mb-2 uppercase tracking-widest">Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="input"
                                    placeholder="Min 6 characters"
                                    minLength={6}
                                    required
                                />
                            </div>

                            {error && (
                                <div className="p-3 bg-prime-red/10 border border-prime-red/20 text-red-400 text-sm chamfer-sm">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={submitting}
                                className="btn-primary w-full disabled:opacity-50"
                            >
                                {submitting ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                        Authenticating...
                                    </span>
                                ) : isSignUp ? 'Create Account' : 'Sign In'}
                            </button>
                        </form>

                        <div className="mt-8 pt-6 border-t border-prime-gunmetal/20 text-center">
                            <button
                                onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
                                className="text-prime-gunmetal text-sm hover:text-prime-energon transition-colors duration-300"
                            >
                                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                                <span className="text-prime-energon font-bold">{isSignUp ? 'Sign in' : 'Sign up'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
