import { useState, useEffect } from 'react';
import { FileText, Copy, Sun, Trello, MessageSquare, Loader2, Calendar, Sparkles, GitBranch } from 'lucide-react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import clsx from 'clsx';
import { useToast, ToastContainer } from '../components/Toast';
import { API_URL } from '../config';

interface Template {
    id: string;
    name: string;
    description: string;
    icon: string;
}

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ReportsPage() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [workingDays, setWorkingDays] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [sourceMode, setSourceMode] = useState<'manual' | 'all' | 'git'>('manual');
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    // Cache: { [templateId]: { report: string, context: any } }
    const [reportsCache, setReportsCache] = useState<Record<string, { report: string, context: any }>>({});
    const { toasts, addToast, removeToast } = useToast();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [tplRes, setRes] = await Promise.all([
                axios.get(`${API_URL}/templates`),
                axios.get(`${API_URL}/settings`)
            ]);
            setTemplates(tplRes.data);
            
            const wd = setRes.data.working_days ? JSON.parse(setRes.data.working_days) : [1, 2, 3, 4, 5];
            setWorkingDays(wd);
            setLoading(false);
        } catch (e) {
            console.error(e);
            addToast('Failed to load reports configuration', 'error');
            setLoading(false);
        }
    };

    const toggleWorkDay = async (dayIndex: number) => {
        const newDays = workingDays.includes(dayIndex) 
            ? workingDays.filter(d => d !== dayIndex)
            : [...workingDays, dayIndex].sort();
        
        setWorkingDays(newDays);
        try {
            await axios.post(`${API_URL}/settings`, {
                key: 'working_days',
                value: JSON.stringify(newDays),
                category: 'system'
            });
        } catch (e) {
            addToast('Failed to save settings', 'error');
        }
    };

    const generateReport = async () => {
        if (!selectedTemplate) return;
        setGenerating(true);
        // Clear current cache for this template to force regeneration view state (optional, or keep old while loading)
        // keeping old while loading is better UX, but let's just set generating flag.
        
        try {
            const res = await axios.post(`${API_URL}/reports/generate`, {
                templateId: selectedTemplate.id,
                project: null, // For now, global. Later add project selector.
                options: {
                    includeCommits: sourceMode === 'all',
                    onlyCommits: sourceMode === 'git'
                }
            });
            
            if (res.data.success) {
                setReportsCache(prev => ({
                    ...prev,
                    [selectedTemplate.id]: {
                        report: res.data.data.report,
                        context: res.data.data.contextUsed
                    }
                }));
                addToast('Report generated!', 'success');
            }
        } catch (e) {
            console.error(e);
            addToast('Error generating report', 'error');
        } finally {
            setGenerating(false);
        }
    };

    const currentCache = selectedTemplate ? reportsCache[selectedTemplate.id] : null;
    const reportOutput = currentCache?.report || '';
    const contextUsed = currentCache?.context || null;

    const copyToClipboard = () => {
        navigator.clipboard.writeText(reportOutput);
        addToast('Copied to clipboard!', 'success');
    };

    const getIcon = (name: string) => {
        switch(name) {
            case 'Sun': return <Sun size={24} className="text-orange-400" />;
            case 'Trello': return <Trello size={24} className="text-blue-400" />;
            case 'MessageSquare': return <MessageSquare size={24} className="text-green-400" />;
            default: return <FileText size={24} className="text-gray-400" />;
        }
    };

    if (loading) return <div className="text-center py-20 text-secondary">Loading reports...</div>;

    return (
        <div className="max-w-6xl mx-auto py-8 flex gap-8 h-[calc(100vh-100px)]">
            {/* Sidebar / Config */}
            <div className="w-1/3 flex flex-col gap-8 overflow-y-auto pr-2">
                
                {/* Working Days Config */}
                <div className="bg-card border border-border/50 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-4 text-secondary">
                        <Calendar size={18} />
                        <h3 className="text-sm font-semibold uppercase tracking-wider">Working Days</h3>
                    </div>
                    <div className="flex justify-between gap-1">
                        {WEEK_DAYS.map((day, i) => (
                            <button
                                key={day}
                                onClick={() => toggleWorkDay(i)}
                                className={clsx(
                                    "w-8 h-8 rounded-full text-xs font-medium transition-all",
                                    workingDays.includes(i) 
                                        ? "bg-accent text-white shadow-lg shadow-accent/20" 
                                        : "bg-surface text-secondary hover:bg-border"
                                )}
                                title={day}
                            >
                                {day.charAt(0)}
                            </button>
                        ))}
                    </div>
                    <p className="text-[10px] text-secondary/60 mt-3">
                        The AI uses this to calculate "Yesterday" correctly (e.g. Monday's "yesterday" is Friday).
                    </p>
                </div>

                {/* Templates List */}
                <div>
                     <h2 className="text-xl font-semibold mb-4">Available Reports</h2>
                     <div className="space-y-3">
                        {templates.map(t => (
                            <div 
                                key={t.id}
                                onClick={() => setSelectedTemplate(t)}
                                className={clsx(
                                    "p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-4",
                                    selectedTemplate?.id === t.id 
                                        ? "bg-accent/10 border-accent shadow-md" 
                                        : "bg-card border-border/40 hover:bg-surface hover:border-border"
                                )}
                            >
                                <div className="mt-1">{getIcon(t.icon)}</div>
                                <div>
                                    <h3 className={clsx("font-medium", selectedTemplate?.id === t.id ? "text-accent" : "text-primary")}>
                                        {t.name}
                                    </h3>
                                    <p className="text-xs text-secondary mt-1 leading-relaxed">
                                        {t.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                     </div>
                </div>
            </div>

            {/* Main Area / Preview */}
            <div className="flex-1 bg-[#1c1c1f] border border-border/50 rounded-2xl flex flex-col overflow-hidden relative shadow-2xl">
                {!selectedTemplate ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-secondary/40">
                        <FileText size={64} className="mb-4 opacity-20" />
                        <p>Select a report template to start</p>
                    </div>
                ) : (
                    <>
                        <div className="p-6 border-b border-border/40 flex justify-between items-center bg-card/30">
                            <div>
                                <h2 className="text-lg font-semibold flex items-center gap-2">
                                    {getIcon(selectedTemplate.icon)}
                                    {selectedTemplate.name}
                                </h2>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex bg-surface p-0.5 rounded-lg border border-border/50 mr-2">
                                    {[
                                        { id: 'manual', label: 'Manual', icon: FileText },
                                        { id: 'all', label: 'All', icon: Sparkles },
                                        { id: 'git', label: 'Git Only', icon: GitBranch }
                                    ].map(mode => (
                                        <button
                                            key={mode.id}
                                            onClick={() => setSourceMode(mode.id as any)}
                                            className={clsx(
                                                "px-2.5 py-1.5 rounded-md text-[10px] font-medium flex items-center gap-1.5 transition-all",
                                                sourceMode === mode.id 
                                                    ? "bg-background text-white shadow-sm ring-1 ring-border/50" 
                                                    : "text-secondary hover:text-white"
                                            )}
                                            title={mode.label}
                                        >
                                            <mode.icon size={12} />
                                            {mode.label}
                                        </button>
                                    ))}
                                </div>

                                {reportOutput && (
                                    <button 
                                        onClick={copyToClipboard}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface hover:bg-border transition-colors text-secondary hover:text-white"
                                    >
                                        <Copy size={14} /> Copy
                                    </button>
                                )}
                                <button 
                                    onClick={generateReport}
                                    disabled={generating}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-white text-black hover:bg-gray-200 transition-colors disabled:opacity-50 shadow-lg shadow-white/5"
                                >
                                    {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                    {generating ? 'Generating...' : 'Generate Report'}
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 relative">
                            {generating ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
                                    <div className="flex flex-col items-center gap-3">
                                        <Loader2 size={32} className="animate-spin text-accent" />
                                        <p className="text-sm text-secondary animate-pulse">Consulting your memory hub...</p>
                                    </div>
                                </div>
                            ) : reportOutput ? (
                                <div className="prose prose-invert max-w-none prose-sm">
                                    <ReactMarkdown>{reportOutput}</ReactMarkdown>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-secondary/30 text-sm">
                                    <p>Ready to generate.</p>
                                    <p className="mt-2 text-xs opacity-60 max-w-xs text-center">
                                        The AI will analyze your {selectedTemplate.name === 'Daily Standup' ? 'recent activity' : 'logs'} based on your working days configuration.
                                    </p>
                                </div>
                            )}
                        </div>
                        
                        {contextUsed && (
                             <div className="border-t border-border/40 p-3 bg-black/20 text-[10px] text-secondary/40 font-mono flex justify-between px-6">
                                <span>Context: {contextUsed.today_date}</span>
                                <span>Workdays: {contextUsed.work_days}</span>
                            </div>
                        )}
                    </>
                )}
            </div>

            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </div>
    );
}
