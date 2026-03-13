import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, Target, Bot, Shield, BarChart3, TrendingUp, GitMerge, Cpu, Layers, ChevronRight } from 'lucide-react';

const LandingPage: React.FC = () => {
    return (
        <div className="min-h-screen bg-prime-black text-gray-100 selection:bg-prime-red/40 selection:text-white">
            
            {/* HERO SECTION */}
            <header className="relative pt-32 pb-20 overflow-hidden">
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-3/4 h-1/2 bg-prime-energon/10 blur-[120px] rounded-full pointer-events-none"></div>
                </div>
                {/* Cyber Scanline effect */}
                <div className="cyber-scan-overlay"></div>
                
                <div className="container mx-auto px-6 relative z-10 text-center max-w-5xl">
                    <div className="inline-block mb-4 px-3 py-1 rounded-full bg-prime-gunmetal/50 border border-prime-energon/30 text-prime-energon text-xs font-bold tracking-widest uppercase animate-pop-in">
                        NexOptimus Prime
                    </div>
                    <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight text-white drop-shadow-lg animate-pop-in delay-100 hover-glitch">
                        Your Amazon Ads. <span className="text-transparent bg-clip-text bg-gradient-to-r from-prime-energon to-blue-500 pulse-glow animate-flicker block sm:inline mt-2 sm:mt-0">Fully Autonomous.</span>
                    </h1>
                    <p className="text-xl md:text-2xl text-gray-300 mb-10 max-w-3xl mx-auto leading-relaxed animate-pop-in delay-200">
                        Optimus Pryme runs your PPC bids, SEO strategy, and DSP campaigns 24/7 — without a single spreadsheet. Connect your Seller Central. The AI handles the rest.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-8 animate-pop-in delay-300">
                        <Link to="/login" className="btn-primary text-lg px-8 py-4 w-full sm:w-auto flex items-center justify-center gap-2">
                            Enter the War Room <ChevronRight size={20} />
                        </Link>
                        <a href="#demo" className="text-prime-silver hover:text-white transition-colors underline underline-offset-4 decoration-prime-gunmetal hover:decoration-prime-energon flex items-center gap-2">
                            Watch a 2-minute demo
                        </a>
                    </div>
                    
                    <p className="text-sm text-gray-500 font-medium tracking-wide">
                        No advertising expertise required. Works with your existing Amazon account.
                    </p>
                </div>
            </header>

            {/* SOCIAL PROOF BAR */}
            <section className="py-8 border-y border-prime-gunmetal/30 bg-prime-dark/50 backdrop-blur-md">
                <div className="container mx-auto px-6 text-center">
                    <p className="text-sm text-gray-400 uppercase tracking-widest mb-6 font-semibold">
                        Trusted by Amazon private label sellers, brand aggregators, and growth agencies
                    </p>
                    <div className="flex flex-wrap justify-center gap-8 md:gap-16">
                        <div className="flex flex-col items-center">
                            <span className="text-3xl font-bold text-white tracking-wider">4.7×</span>
                            <span className="text-xs text-prime-energon uppercase tracking-wider mt-1">avg ROAS improvement</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-3xl font-bold text-white tracking-wider">68%</span>
                            <span className="text-xs text-prime-energon uppercase tracking-wider mt-1">reduction in manual bids</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-3xl font-bold text-white tracking-wider">12+</span>
                            <span className="text-xs text-prime-energon uppercase tracking-wider mt-1">active product categories</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* PROBLEM SECTION */}
            <section className="py-24 relative">
                <div className="container mx-auto px-6 max-w-4xl text-center">
                    <h2 className="text-3xl md:text-5xl font-bold mb-8">Amazon Ads Should Not Be a <span className="text-prime-red">Full-Time Job.</span></h2>
                    
                    <div className="text-lg text-gray-300 space-y-6 text-left p-8 md:p-12 border border-prime-gunmetal/30 bg-prime-dark/40 backdrop-blur-sm chamfer relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-prime-red"></div>
                        <p>But here you are — in Seller Central at midnight, adjusting bids by 10% and hoping for the best.</p>
                        <p>You're pulling data from three different places. Building formulas in sheets. Reacting to yesterday's numbers while today's auction already happened.</p>
                        <p>The platform is built for advertisers with whole teams. You're competing against them alone.</p>
                        <p className="text-xl font-bold text-white pt-4">That's the problem Optimus Pryme was built to solve.</p>
                    </div>
                </div>
            </section>

            {/* FEATURES / BENEFITS SECTION */}
            <section className="py-24 bg-prime-dark/30 border-t border-prime-gunmetal/20">
                <div className="container mx-auto px-6 max-w-6xl">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-bold mb-4">Every Part of Amazon Advertising You Hate — <span className="text-prime-energon">Automated.</span></h2>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Benefit 1 */}
                        <div className="card-glow flex flex-col items-start group hover-border-pulse animate-pop-in">
                            <div className="p-3 bg-prime-energon/10 text-prime-energon mb-6 rounded-sm group-hover:bg-prime-energon/20 transition-colors">
                                <Target size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2 tracking-wide uppercase">Precision Bidding</h3>
                            <h4 className="text-sm text-prime-energon font-semibold mb-4 bg-prime-energon/10 px-2 py-1 inline-block">Bid the right amount. For every keyword. Every hour.</h4>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Static rules — raise bid 10%, cut bid 10% — leave money on the table in both directions. Optimus Pryme uses a multi-model ensemble of Gradient Boosting, Neural Networks, and Reinforcement Learning to calculate the optimal bid for each keyword based on your real data. Not averages. Not rules. The actual number.
                            </p>
                        </div>

                        {/* Benefit 2 */}
                        <div className="card-glow flex flex-col items-start group hover-border-pulse animate-pop-in delay-100">
                            <div className="p-3 bg-emerald-500/10 text-emerald-400 mb-6 rounded-sm group-hover:bg-emerald-500/20 transition-colors">
                                <TrendingUp size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2 tracking-wide uppercase">Proactive Budget Management</h3>
                            <h4 className="text-sm text-emerald-400 font-semibold mb-4 bg-emerald-500/10 px-2 py-1 inline-block">Your budget is in position before the traffic spike hits.</h4>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Your competitors react to demand. You'll predict it. Optimus Pryme's LSTM forecasting analyzes 14 days of trend data — seasonal patterns, weekend lifts, promo cycles — and adjusts your daily budgets in advance. You'll never lose a Sunday spike because your budget ran out at noon on Saturday again.
                            </p>
                        </div>

                        {/* Benefit 3 */}
                        <div className="card-glow flex flex-col items-start group hover-border-pulse animate-pop-in delay-200">
                            <div className="p-3 bg-blue-500/10 text-blue-400 mb-6 rounded-sm group-hover:bg-blue-500/20 transition-colors">
                                <BarChart3 size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2 tracking-wide uppercase">The War Room Dashboard</h3>
                            <h4 className="text-sm text-blue-400 font-semibold mb-4 bg-blue-500/10 px-2 py-1 inline-block">One screen. Every metric. No more tab-switching.</h4>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Stop logging into four different platforms to understand your business. Sales Velocity, ACoS, ROAS, Organic Rank, and Inventory are all live in one high-contrast, data-dense dashboard built for the way serious Amazon sellers actually work.
                            </p>
                        </div>

                        {/* Benefit 4 */}
                        <div className="card-glow flex flex-col items-start group hover-border-pulse animate-pop-in delay-300">
                            <div className="p-3 bg-prime-red/10 text-prime-red mb-6 rounded-sm group-hover:bg-prime-red/20 transition-colors">
                                <Shield size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2 tracking-wide uppercase">Campaign Autopilot</h3>
                            <h4 className="text-sm text-prime-red font-semibold mb-4 bg-prime-red/10 px-2 py-1 inline-block">Attack when you're winning. Protect when you're not.</h4>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Optimus Pryme reads your campaign health and shifts strategy automatically. A keyword gaining traction gets pushed harder. A campaign burning budget without conversions moves to maintenance mode. You set the goal — Maximize Profit or Maximize Velocity — and the AI executes it.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* HOW IT WORKS SECTION */}
            <section className="py-24 border-t border-prime-gunmetal/20">
                <div className="container mx-auto px-6 max-w-5xl">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-bold">From Connected to Optimized in <span className="text-white">Three Steps.</span></h2>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 relative">
                        {/* Connecting Line */}
                        <div className="hidden md:block absolute top-[40px] left-[15%] right-[15%] h-0.5 bg-prime-gunmetal/50 z-0"></div>

                        {/* Step 1 */}
                        <div className="relative z-10 flex flex-col items-center text-center animate-pop-in">
                            <div className="w-20 h-20 rounded-full bg-prime-dark border-2 border-prime-gunmetal flex items-center justify-center text-2xl font-bold text-prime-silver mb-6 shadow-[0_0_15px_rgba(0,0,0,0.5)] group-hover:border-white transition-colors">1</div>
                            <h3 className="text-xl font-bold text-white mb-3">Connect</h3>
                            <p className="text-sm text-gray-400">Link your Amazon Seller Central account. Takes under 3 minutes. No dev work, no CSV uploads.</p>
                        </div>

                        {/* Step 2 */}
                        <div className="relative z-10 flex flex-col items-center text-center animate-pop-in delay-100">
                            <div className="w-20 h-20 rounded-full bg-prime-dark border-2 border-prime-energon flex items-center justify-center text-2xl font-bold text-prime-energon mb-6 shadow-[0_0_15px_rgba(0,251,255,0.2)] animate-pulse">2</div>
                            <h3 className="text-xl font-bold text-white mb-3">Configure</h3>
                            <p className="text-sm text-gray-400">Choose your ASINs and set your goal: Maximize Profit, Maximize Velocity, or Balanced Growth. The AI calibrates to your strategy.</p>
                        </div>

                        {/* Step 3 */}
                        <div className="relative z-10 flex flex-col items-center text-center animate-pop-in delay-200">
                            <div className="w-20 h-20 rounded-full bg-prime-dark border-2 border-prime-red flex items-center justify-center text-2xl font-bold text-prime-red mb-6 shadow-[0_0_15px_rgba(196,30,58,0.3)] animate-pulse">3</div>
                            <h3 className="text-xl font-bold text-white mb-3">Command</h3>
                            <p className="text-sm text-gray-400">Watch the War Room dashboard update in real time. Ask the Grok AI anything about your performance. Let the autonomous optimizer handle bids & budgets.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* AUTONOMOUS AI CAPABILITIES SECTION */}
            <section className="py-24 bg-[#0a0f14] border-y border-prime-gunmetal/50 relative overflow-hidden">
                {/* Background Grid */}
                <div className="absolute inset-0 z-0 opacity-20" style={{ backgroundImage: 'linear-gradient(#3a4a5c 1px, transparent 1px), linear-gradient(90deg, #3a4a5c 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
                
                <div className="container mx-auto px-6 max-w-6xl relative z-10">
                    <div className="text-center mb-16 max-w-3xl mx-auto">
                        <h2 className="text-3xl md:text-5xl font-bold mb-6">Not Rules. <span className="text-transparent bg-clip-text bg-gradient-to-r from-prime-energon to-purple-500">Four AI Systems</span> Working in Parallel.</h2>
                        <p className="text-gray-300 text-lg leading-relaxed">
                            Most PPC tools follow static logic: "If ACoS is above 40%, cut bid by 10%." That's not optimization — that's a spreadsheet formula dressed up as software.
                        </p>
                        <p className="text-gray-300 text-lg leading-relaxed mt-4">
                            Optimus Pryme runs four purpose-built AI systems simultaneously, each handling a different type of decision.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6 mb-12">
                        {/* AI 1 */}
                        <div className="card border-l-4 border-l-prime-energon bg-prime-dark/80 hover:bg-prime-dark transition-colors hover-border-pulse flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-xl font-bold font-mono text-white flex items-center gap-2"><Cpu size={20} className="text-prime-energon"/> Model Ensemble</h3>
                                <span className="badge bg-prime-energon/10 text-prime-energon border-prime-energon/20">Established Keywords</span>
                            </div>
                            <p className="text-sm text-gray-400 leading-relaxed">
                                Four models — Gradient Boosting, a Deep Neural Network, a Reinforcement Learning agent, and a Multi-Armed Bandit — vote on every bid. When one model is overconfident, the others ground it. The result is a single precise bid recommendation that accounts for both short-term ACoS and long-term profitability.
                            </p>
                        </div>

                        {/* AI 2 */}
                        <div className="card border-l-4 border-l-purple-500 bg-prime-dark/80 hover:bg-prime-dark transition-colors hover-border-pulse flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-xl font-bold font-mono text-white flex items-center gap-2"><GitMerge size={20} className="text-purple-500"/> Thompson Sampling Bandit</h3>
                                <span className="badge bg-purple-500/10 text-purple-400 border-purple-500/20">New Keywords</span>
                            </div>
                            <p className="text-sm text-gray-400 leading-relaxed">
                                Standard tools wait for 10–20 clicks before making a move. The Bandit optimizer starts learning from impression one. It treats each bid level as a slot machine arm and systematically identifies your winner — balancing learning and earning simultaneously.
                            </p>
                        </div>

                        {/* AI 3 */}
                        <div className="card border-l-4 border-l-emerald-500 bg-prime-dark/80 hover:bg-prime-dark transition-colors hover-border-pulse flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-xl font-bold font-mono text-white flex items-center gap-2"><Activity size={20} className="text-emerald-500"/> LSTM Forecaster</h3>
                                <span className="badge bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Budget Allocation</span>
                            </div>
                            <p className="text-sm text-gray-400 leading-relaxed">
                                Long Short-Term Memory networks analyze your performance timeline and decompose it into trend, seasonality, and noise. The forecaster then sets your daily budget caps based on what's about to happen — not what happened last week.
                            </p>
                        </div>

                        {/* AI 4 */}
                        <div className="card border-l-4 border-l-blue-500 bg-prime-dark/80 hover:bg-prime-dark transition-colors hover-border-pulse flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-xl font-bold font-mono text-white flex items-center gap-2"><Layers size={20} className="text-blue-500"/> Bayesian Estimator</h3>
                                <span className="badge bg-blue-500/10 text-blue-400 border-blue-500/20">Low-Data Keywords</span>
                            </div>
                            <p className="text-sm text-gray-400 leading-relaxed">
                                Zero orders. Five clicks. A standard tool calls that keyword a failure. The Bayesian Estimator calculates the probability distribution of your true conversion rate — so you don't kill potential winners that just got unlucky in their first few impressions.
                            </p>
                        </div>
                    </div>
                    
                    <div className="text-center">
                        <Link to="/semantic" className="text-prime-energon hover:text-white font-mono uppercase tracking-widest text-sm inline-flex items-center gap-2 transition-colors">
                            See the full AI architecture <ChevronRight size={16} />
                        </Link>
                    </div>
                </div>
            </section>

            {/* TESTIMONIAL / SOCIAL PROOF SECTION */}
            <section className="py-20">
                <div className="container mx-auto px-6 max-w-5xl">
                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="p-8 border border-prime-gunmetal/30 bg-prime-dark/40 rounded-sm relative">
                            <div className="text-prime-energon/20 text-6xl absolute top-4 left-4 font-serif">"</div>
                            <p className="text-gray-300 italic mb-6 relative z-10 pt-4">
                                "[Quote about time saved or ACoS improvement. How the autonomous bidding completely changed our daily workflow.]"
                            </p>
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-prime-gunmetal rounded-full"></div>
                                <div>
                                    <h4 className="text-white font-bold text-sm uppercase">— Name Segment</h4>
                                    <span className="text-xs text-prime-energon uppercase">Title, Brand/Agency</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 border border-prime-gunmetal/30 bg-prime-dark/40 rounded-sm relative">
                            <div className="text-prime-energon/20 text-6xl absolute top-4 left-4 font-serif">"</div>
                            <p className="text-gray-300 italic mb-6 relative z-10 pt-4">
                                "[Quote about the dashboard or AI recommendations. The explainability makes it easy to trust the autonomous decisions.]"
                            </p>
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-prime-gunmetal rounded-full"></div>
                                <div>
                                    <h4 className="text-white font-bold text-sm uppercase">— Name Segment</h4>
                                    <span className="text-xs text-prime-energon uppercase">Title, Brand/Agency</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* FAQ SECTION */}
            <section className="py-24 bg-prime-dark/20 border-t border-prime-gunmetal/20">
                <div className="container mx-auto px-6 max-w-3xl">
                    <h2 className="text-3xl font-bold text-center mb-12 uppercase tracking-wide">Questions Sellers Ask Before Signing Up</h2>
                    
                    <div className="space-y-6">
                        <div className="card">
                            <h3 className="text-lg font-bold text-white mb-3 flex items-start gap-3">
                                <span className="text-prime-energon mt-1">Q:</span> 
                                Do I need an Amazon advertising expert to use this?
                            </h3>
                            <div className="text-gray-400 pl-8 space-y-2">
                                <p><span className="text-white font-bold">A:</span> No. You set a goal — Maximize Profit or Maximize Velocity — and the AI handles the execution. The dashboard shows you what's happening and why, in plain language.</p>
                            </div>
                        </div>

                        <div className="card">
                            <h3 className="text-lg font-bold text-white mb-3 flex items-start gap-3">
                                <span className="text-prime-energon mt-1">Q:</span> 
                                How is this different from Amazon's own automated bidding?
                            </h3>
                            <div className="text-gray-400 pl-8 space-y-2">
                                <p><span className="text-white font-bold">A:</span> Amazon's automation optimizes for Amazon's revenue. Optimus Pryme optimizes for your ACoS, ROAS, and profit margin — using models trained on your specific account data, not platform averages.</p>
                            </div>
                        </div>

                        <div className="card">
                            <h3 className="text-lg font-bold text-white mb-3 flex items-start gap-3">
                                <span className="text-prime-energon mt-1">Q:</span> 
                                What if the AI makes a bad decision?
                            </h3>
                            <div className="text-gray-400 pl-8 space-y-2">
                                <p><span className="text-white font-bold">A:</span> You can toggle AI automation on or off for any campaign at any time. Every recommendation includes the model's reasoning so you understand what it's doing and why.</p>
                            </div>
                        </div>

                        <div className="card">
                            <h3 className="text-lg font-bold text-white mb-3 flex items-start gap-3">
                                <span className="text-prime-energon mt-1">Q:</span> 
                                How long does setup take?
                            </h3>
                            <div className="text-gray-400 pl-8 space-y-2">
                                <p><span className="text-white font-bold">A:</span> Most sellers connect their account and see their first dashboard in under 10 minutes.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* FINAL CTA SECTION */}
            <section className="py-24 relative overflow-hidden">
                <div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent to-prime-red/5"></div>
                <div className="container mx-auto px-6 relative z-10 text-center max-w-4xl">
                    <h2 className="text-4xl md:text-5xl font-bold mb-6 hover-glitch">
                        Your Ads Don't Sleep. <span className="text-transparent bg-clip-text bg-gradient-to-r from-prime-red to-orange-500 animate-flicker block sm:inline mt-2 sm:mt-0">Neither Does Optimus Pryme.</span>
                    </h2>
                    <p className="text-xl text-gray-300 mb-10">
                        Connect your Amazon Seller Central today. The AI starts bidding, forecasting, and optimizing within hours — so you can stop reacting to yesterday's data and start winning tomorrow's auctions.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-6">
                        <Link to="/login" className="btn-primary text-lg px-10 py-4 w-full sm:w-auto shadow-[0_0_20px_rgba(196,30,58,0.4)]">
                            Start Free Trial &rarr;
                        </Link>
                        <a href="#demo" className="btn-secondary text-lg px-10 py-4 w-full sm:w-auto">
                            Book a Demo
                        </a>
                    </div>
                    
                    <p className="text-sm text-gray-500 font-mono flex items-center justify-center gap-2">
                        <Shield size={14} /> No credit card required. Cancel anytime. Full data export on exit.
                    </p>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="bg-[#05080c] pt-16 pb-8 border-t border-prime-gunmetal">
                <div className="container mx-auto px-6 max-w-7xl">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
                        <div className="col-span-2 md:col-span-1">
                            <div className="flex items-center gap-3 mb-4">
                                <Bot size={28} className="text-prime-energon" />
                                <span className="text-xl font-bold font-mono tracking-widest text-white uppercase">Optimus Pryme</span>
                            </div>
                            <p className="text-sm text-gray-500 mb-6">AI-Powered Amazon Advertising</p>
                        </div>
                        
                        <div>
                            <h4 className="text-white font-bold uppercase tracking-widest text-sm mb-4">Product</h4>
                            <ul className="space-y-2 text-sm text-gray-400">
                                <li><a href="#" className="hover:text-prime-energon transition-colors">Features</a></li>
                                <li><a href="#" className="hover:text-prime-energon transition-colors">How It Works</a></li>
                                <li><a href="#" className="hover:text-prime-energon transition-colors">Pricing</a></li>
                                <li><a href="#" className="hover:text-prime-energon transition-colors">Integrations</a></li>
                            </ul>
                        </div>
                        
                        <div>
                            <h4 className="text-white font-bold uppercase tracking-widest text-sm mb-4">Resources</h4>
                            <ul className="space-y-2 text-sm text-gray-400">
                                <li><a href="#" className="hover:text-prime-energon transition-colors">Documentation</a></li>
                                <li><a href="#" className="hover:text-prime-energon transition-colors">API Reference</a></li>
                                <li><a href="#" className="hover:text-prime-energon transition-colors">Changelog</a></li>
                                <li><a href="#" className="hover:text-prime-energon transition-colors">Support</a></li>
                            </ul>
                        </div>
                        
                        <div>
                            <h4 className="text-white font-bold uppercase tracking-widest text-sm mb-4">Company</h4>
                            <ul className="space-y-2 text-sm text-gray-400">
                                <li><a href="#" className="hover:text-prime-energon transition-colors">About</a></li>
                                <li><a href="#" className="hover:text-prime-energon transition-colors">Contact</a></li>
                                <li><a href="#" className="hover:text-prime-energon transition-colors">Security</a></li>
                                <li><a href="#" className="hover:text-prime-energon transition-colors">Terms / Privacy</a></li>
                            </ul>
                        </div>
                    </div>
                    
                    <div className="pt-8 border-t border-prime-gunmetal/30 text-center flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-xs text-gray-600 font-mono">
                            &copy; 2025 Optimus Pryme. All rights reserved.
                        </p>
                        <div className="flex gap-4 opacity-50">
                            {/* Placeholder social icons */}
                            <div className="w-8 h-8 rounded-full bg-prime-gunmetal flex items-center justify-center">X</div>
                            <div className="w-8 h-8 rounded-full bg-prime-gunmetal flex items-center justify-center">In</div>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
