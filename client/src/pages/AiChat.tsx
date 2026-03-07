import { useState, useRef, useEffect, useCallback } from 'react';
import { chatApi } from '../api/client';
import { supabase } from '../lib/supabase';
import type { ChatMessage } from '../types';

const HISTORY_PAGE = 50;

export default function AiChat() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [historyLoaded, setHistoryLoaded] = useState(false);
    const [historyOffset, setHistoryOffset] = useState(HISTORY_PAGE);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([
        'Analyze my ACOS performance',
        'Show top performing keywords',
        'Optimize budget allocation',
    ]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const loadHistory = async () => {
            const { data } = await supabase
                .from('chat_messages')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(HISTORY_PAGE);

            if (data && data.length > 0) {
                const mapped = data.reverse().map(msg => ({
                    role: msg.sender === 'grok' ? 'assistant' as const : 'user' as const,
                    content: msg.content,
                    timestamp: msg.created_at || new Date().toISOString(),
                }));
                setMessages(mapped);
                setHasMore(data.length === HISTORY_PAGE);
            } else {
                setMessages([{
                    role: 'assistant',
                    content: "I'm Optimus, your advertising optimization assistant. How can I help you today?",
                    timestamp: new Date().toISOString(),
                }]);
                setHasMore(false);
            }
            setHistoryLoaded(true);
        };
        loadHistory();
    }, []);

    useEffect(() => { scrollToBottom(); }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const loadEarlier = useCallback(async () => {
        setLoadingMore(true);
        try {
            const { data } = await supabase
                .from('chat_messages')
                .select('*')
                .order('created_at', { ascending: false })
                .range(historyOffset, historyOffset + HISTORY_PAGE - 1);

            if (data && data.length > 0) {
                const mapped = data.reverse().map(msg => ({
                    role: msg.sender === 'grok' ? 'assistant' as const : 'user' as const,
                    content: msg.content,
                    timestamp: msg.created_at || new Date().toISOString(),
                }));
                setMessages(prev => [...mapped, ...prev]);
                setHistoryOffset(prev => prev + HISTORY_PAGE);
                setHasMore(data.length === HISTORY_PAGE);
            } else {
                setHasMore(false);
            }
        } finally {
            setLoadingMore(false);
        }
    }, [historyOffset]);

    const handleSend = async (text?: string) => {
        const messageText = text || input.trim();
        if (!messageText || loading) return;

        const userMsg: ChatMessage = { role: 'user', content: messageText, timestamp: new Date().toISOString() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const history = messages.map(m => ({
                role: m.role,
                content: m.content
            }));
            const response = await chatApi.sendMessage(messageText, history);
            setMessages(prev => [...prev, { role: 'assistant', content: response.response, timestamp: response.timestamp }]);
            if (response.suggestions) setSuggestions(response.suggestions);
        } catch (error) {
            console.error('Failed to send message:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: 'Communication error. Please try again.', timestamp: new Date().toISOString() }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    if (!historyLoaded) {
        return (
            <div className="flex items-center justify-center h-[80vh]">
                <div className="w-10 h-10 border-2 border-prime-red/30 border-t-prime-red rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen p-6 lg:p-8">
            <div className="max-w-3xl mx-auto h-[calc(100vh-7rem)] flex flex-col">
                {/* Header */}
                <div className="pb-3 mb-3 flex items-center gap-3 border-b border-prime-gunmetal/20">
                    <div className="w-9 h-9 bg-gradient-to-br from-prime-red to-prime-blue flex items-center justify-center chamfer-sm">
                        <span className="text-white font-black text-[10px]">OP</span>
                    </div>
                    <div>
                        <h1 className="text-sm font-black text-prime-silver uppercase tracking-wider">Optimus AI</h1>
                        <p className="text-[10px] text-prime-gunmetal uppercase tracking-widest font-semibold">Advertising Optimization</p>
                    </div>
                    <div className="ml-auto flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 bg-prime-energon rounded-full animate-pulse" aria-hidden="true" />
                        <span className="text-[10px] text-prime-gunmetal uppercase tracking-widest font-bold">Active</span>
                    </div>
                </div>

                {/* Messages */}
                <div
                    className="flex-1 overflow-y-auto space-y-3 mb-3 pr-2"
                    aria-live="polite"
                    aria-label="Chat messages"
                >
                    {/* Load earlier messages */}
                    {hasMore && (
                        <div className="text-center py-2">
                            <button
                                onClick={loadEarlier}
                                disabled={loadingMore}
                                className="text-[10px] text-prime-gunmetal hover:text-prime-silver border border-prime-gunmetal/20 hover:border-prime-gunmetal/40 px-4 py-1.5 uppercase tracking-widest font-bold transition-all chamfer-sm disabled:opacity-50"
                            >
                                {loadingMore ? 'Loading...' : 'Load earlier messages'}
                            </button>
                        </div>
                    )}

                    {messages.map((message) => (
                        <MessageBubble key={`${message.role}-${message.timestamp}`} message={message} />
                    ))}
                    {loading && (
                        <div className="flex gap-3 items-start" role="status" aria-label="Optimus is typing">
                            <div className="w-7 h-7 bg-prime-dark border border-prime-gunmetal/30 flex items-center justify-center chamfer-sm shrink-0">
                                <span className="text-prime-energon text-[10px] font-black">OP</span>
                            </div>
                            <div className="bg-prime-dark/80 border border-prime-gunmetal/20 px-4 py-3 chamfer-sm flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 bg-prime-energon rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-1.5 h-1.5 bg-prime-energon rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-1.5 h-1.5 bg-prime-energon rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Suggestions */}
                {suggestions.length > 0 && messages.length <= 1 && !loading && (
                    <div className="mb-3 flex flex-wrap gap-2">
                        {suggestions.map((suggestion) => (
                            <button
                                key={suggestion}
                                onClick={() => handleSend(suggestion)}
                                className="px-3.5 py-2 bg-prime-dark/80 border border-prime-gunmetal/20 text-prime-gunmetal text-xs uppercase tracking-wider font-semibold hover:border-prime-energon/30 hover:text-prime-energon transition-all duration-300 chamfer-sm"
                                disabled={loading}
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                )}

                {/* Input */}
                <div className="bg-prime-dark/80 backdrop-blur-sm border border-prime-gunmetal/30 p-2 flex gap-2 chamfer">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Ask Optimus anything about your campaigns..."
                        aria-label="Message input"
                        className="flex-1 bg-transparent px-3 py-2 text-sm text-gray-100 placeholder-prime-gunmetal focus:outline-none"
                        disabled={loading}
                    />
                    <button
                        onClick={() => handleSend()}
                        disabled={loading || !input.trim()}
                        className="btn-primary disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
}

function MessageBubble({ message }: { message: ChatMessage }) {
    const isUser = message.role === 'user';

    return (
        <div className={`flex gap-3 items-start ${isUser ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 flex items-center justify-center shrink-0 chamfer-sm ${isUser
                ? 'bg-prime-blue/20 border border-prime-blue/30'
                : 'bg-prime-dark border border-prime-gunmetal/30'
                }`}
                aria-hidden="true"
            >
                <span className={`text-[10px] font-black ${isUser ? 'text-prime-blue' : 'text-prime-energon'}`}>
                    {isUser ? 'U' : 'OP'}
                </span>
            </div>
            <div className="max-w-[75%]">
                <div className={`px-4 py-3 text-sm leading-relaxed chamfer-sm ${isUser
                    ? 'bg-prime-blue text-white'
                    : 'bg-prime-dark/80 border border-prime-gunmetal/20 text-prime-silver'
                    }`}>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
                <p className={`text-[10px] text-prime-gunmetal/50 mt-1 px-1 ${isUser ? 'text-right' : 'text-left'}`}>
                    {new Date(message.timestamp).toLocaleTimeString()}
                </p>
            </div>
        </div>
    );
}
