import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AuthGuard from './components/AuthGuard';
import Navigation from './components/Navigation';
import './index.css';

// ── Lazy-loaded pages (each becomes its own JS chunk) ──────────────────────
const Dashboard   = lazy(() => import('./pages/Dashboard'));
const Campaigns   = lazy(() => import('./pages/Campaigns'));
const AiChat      = lazy(() => import('./pages/AiChat'));
const Optimization = lazy(() => import('./pages/Optimization'));
const Experiments = lazy(() => import('./pages/Experiments'));
const Portfolio   = lazy(() => import('./pages/Portfolio'));
const Forecasts   = lazy(() => import('./pages/Forecasts'));
const Alerts      = lazy(() => import('./pages/Alerts'));
const Competitive = lazy(() => import('./pages/Competitive'));
const Settings    = lazy(() => import('./pages/Settings'));
const Semantic    = lazy(() => import('./pages/Semantic'));
const Reports     = lazy(() => import('./pages/Reports'));
const Login       = lazy(() => import('./pages/Login'));

function PageSpinner() {
    return (
        <div className="flex items-center justify-center h-[80vh]">
            <div className="w-10 h-10 border-2 border-prime-gunmetal/30 border-t-prime-silver rounded-full animate-spin" />
        </div>
    );
}

function AppLayout() {
    return (
        <div className="min-h-screen bg-cyber-black">
            <Navigation />
            <Outlet />
        </div>
    );
}

function App() {
    return (
        <AuthProvider>
            <Router>
                <Suspense fallback={<PageSpinner />}>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route element={<AuthGuard />}>
                            <Route element={<AppLayout />}>
                                <Route path="/"           element={<Dashboard />} />
                                <Route path="/campaigns"  element={<Campaigns />} />
                                <Route path="/optimize"   element={<Optimization />} />
                                <Route path="/experiments" element={<Experiments />} />
                                <Route path="/portfolio"  element={<Portfolio />} />
                                <Route path="/forecasts"  element={<Forecasts />} />
                                <Route path="/alerts"     element={<Alerts />} />
                                <Route path="/competitive" element={<Competitive />} />
                                <Route path="/semantic"   element={<Semantic />} />
                                <Route path="/reports"    element={<Reports />} />
                                <Route path="/chat"       element={<AiChat />} />
                                <Route path="/settings"   element={<Settings />} />
                            </Route>
                        </Route>
                    </Routes>
                </Suspense>
            </Router>
        </AuthProvider>
    );
}

export default App;
