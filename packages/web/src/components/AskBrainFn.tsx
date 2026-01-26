import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { X, Send, Bot, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';

const API_URL = 'http://localhost:3000';

interface Message {
    role: 'user' | 'assistant';
    text: string;
}

export function AskBrainFn() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', text: "Hello! I'm your Second Brain. Ask me anything about your projects, fixes, or past work." }
    ]);
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!query.trim() || loading) return;

        const userText = query;
        setQuery('');
        setMessages(prev => [...prev, { role: 'user', text: userText }]);
        setLoading(true);

        try {
            const res = await axios.post(`${API_URL}/ai/chat`, { query: userText });
            if (res.data.success) {
                setMessages(prev => [...prev, { role: 'assistant', text: res.data.answer }]);
            } else {
                setMessages(prev => [...prev, { role: 'assistant', text: "Sorry, I couldn't process that request." }]);
            }
        } catch (err) {
            console.error(err);
            setMessages(prev => [...prev, { role: 'assistant', text: "Error connecting to brain." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Floating Action Button */}
            {!isOpen && (
                <button 
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full shadow-[0_0_20px_rgba(129,140,248,0.5)] flex items-center justify-center text-white hover:scale-110 transition-transform z-50 group"
                >
                    <Bot size={28} className="animate-bounce-slow" />
                    <span className="absolute -top-10 scale-0 group-hover:scale-100 transition-transform bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                        Ask Brain
                    </span>
                </button>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-6 right-6 w-[400px] h-[600px] bg-[#0e0e11] border border-border/50 rounded-2xl shadow-2xl flex flex-col z-50 animate-in slide-in-from-bottom-10 fade-in overflow-hidden">
                    {/* Header */}
                    <div className="p-4 border-b border-border/50 bg-card/50 flex justify-between items-center backdrop-blur-md">
                        <div className="flex items-center gap-2">
                             <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                <Sparkles size={16} className="text-white" />
                             </div>
                             <div>
                                 <h3 className="font-bold text-sm">Brain Chat</h3>
                                 <p className="text-[10px] text-green-400 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Online
                                 </p>
                             </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-secondary hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={clsx("flex gap-3", msg.role === 'user' ? "justify-end" : "justify-start")}>
                                {msg.role === 'assistant' && (
                                    <div className="w-8 h-8 rounded-full bg-surface flex-shrink-0 flex items-center justify-center border border-white/5">
                                        <Bot size={16} className="text-accent" />
                                    </div>
                                )}
                                <div className={clsx(
                                    "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                                    msg.role === 'user' 
                                        ? "bg-accent text-white rounded-br-none" 
                                        : "bg-surface text-secondary-foreground rounded-bl-none border border-white/5"
                                )}>
                                    <div className="prose prose-invert prose-sm max-w-none">
                                        <ReactMarkdown 
                                            components={{
                                                code: ({node, inline, className, children, ...props}: any) => {
                                                    if (inline) return <code className="bg-white/10 rounded px-1 py-0.5 text-xs font-mono" {...props}>{children}</code>
                                                    return <code className="block bg-black/30 rounded p-2 my-2 text-xs font-mono overflow-x-auto" {...props}>{children}</code>
                                                }
                                            }}
                                        >
                                            {msg.text}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-surface flex-shrink-0 flex items-center justify-center">
                                    <Bot size={16} className="text-accent" />
                                </div>
                                <div className="bg-surface rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                    <span className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                    <span className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce"></span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <form onSubmit={handleSend} className="p-4 border-t border-border/50 bg-card/30">
                        <div className="relative">
                            <input 
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Ask about past errors, features, logs..."
                                className="w-full bg-surface border border-white/10 rounded-full pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-accent text-white placeholder:text-secondary/50 shadow-inner"
                                disabled={loading}
                            />
                            <button 
                                type="submit" 
                                disabled={!query.trim() || loading}
                                className="absolute right-2 top-2 w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white disabled:opacity-50 disabled:bg-surface disabled:text-secondary transition-all hover:bg-accent/80"
                            >
                                <Send size={14} />
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </>
    );
}
