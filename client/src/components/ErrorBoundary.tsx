import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-prime-black flex items-center justify-center p-8">
                    <div className="bg-prime-dark border border-prime-red/30 p-8 chamfer max-w-lg w-full text-center space-y-4">
                        <div className="text-prime-red text-4xl font-black uppercase tracking-widest">Error</div>
                        <p className="text-prime-silver text-sm">Something went wrong. The application encountered an unexpected error.</p>
                        {this.state.error && (
                            <p className="text-prime-gunmetal text-xs font-mono bg-prime-black/50 p-3 text-left break-all">
                                {this.state.error.message}
                            </p>
                        )}
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-2 bg-prime-red text-white text-xs font-bold uppercase tracking-widest hover:bg-prime-red/80 transition-all chamfer-sm"
                        >
                            Reload
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
