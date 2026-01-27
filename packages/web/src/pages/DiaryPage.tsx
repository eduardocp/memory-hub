import { useState, useEffect, useCallback, memo } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameDay, addMonths, subMonths, addDays, subDays, startOfWeek, getWeek, addWeeks, subWeeks } from 'date-fns';

import clsx from 'clsx';
import axios from 'axios';
import MDEditor from '@uiw/react-md-editor';
import { useToast, ToastContainer } from '../components/Toast';
import { API_URL } from '../config';

interface DiaryEntry {
    id: string;
    date: string;
    content: string;
    preview?: string;
    created_at: string;
    updated_at: string;
}

type ViewMode = 'month' | 'week' | 'threedays' | 'day';

// Weekday colors
const WEEKDAY_COLORS: Record<number, string> = {
    0: 'text-amber-400', // Sunday
    1: 'text-pink-400',  // Monday
    2: 'text-rose-400',  // Tuesday
    3: 'text-emerald-400', // Wednesday
    4: 'text-orange-400', // Thursday
    5: 'text-cyan-400',  // Friday
    6: 'text-purple-400', // Saturday
};

// DayCard component - defined outside to prevent re-creation on each render
interface DayCardProps {
    date: Date;
    expanded?: boolean;
    entry?: DiaryEntry;
    fullContent?: string;
    editingDate: string | null;
    editContent: string;
    saving: boolean;
    onStartEditing: (date: Date) => void;
    onContentChange: (content: string) => void;
    onSave: (date: string, content: string) => void;
    onCancelEdit: () => void;
}

const DayCard = memo(function DayCard({
    date,
    expanded = false,
    entry,
    fullContent,
    editingDate,
    editContent,
    saving,
    onStartEditing,
    onContentChange,
    onSave,
    onCancelEdit
}: DayCardProps) {
    const dateStr = format(date, 'yyyy-MM-dd');
    const isTodayDate = isToday(date);
    const dayOfWeek = date.getDay();
    const isEditing = editingDate === dateStr;

    return (
        <div className={clsx("border-b border-border py-4", expanded && "flex-1 border-b-0")}>
            <div className="flex items-baseline gap-2 mb-2">
                <span className={clsx("text-xs font-medium", WEEKDAY_COLORS[dayOfWeek])}>
                    {format(date, 'EEEE')}
                </span>
                {isTodayDate && (
                    <span className="text-xs text-amber-400">Today</span>
                )}
            </div>
            <div className="flex items-baseline gap-2 mb-4">
                <h3 className="text-xl font-semibold">{format(date, 'MMMM d, yyyy')}</h3>
                <span className="text-xs text-secondary">Week {getWeek(date)}</span>
            </div>

            {isEditing ? (
                <div className="space-y-3" data-color-mode="dark">
                    <MDEditor
                        value={editContent}
                        onChange={(val) => onContentChange(val || '')}
                        height={300}
                        preview="edit"
                        hideToolbar={false}
                        autoFocus={true}
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={() => onSave(dateStr, editContent)}
                            disabled={saving}
                            className="px-3 py-1.5 bg-accent text-white rounded text-sm font-medium hover:bg-accent/80 disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                            onClick={onCancelEdit}
                            className="px-3 py-1.5 text-secondary hover:text-white text-sm"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {entry ? (
                        <div>
                            {/* Daily note header */}
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-xs text-secondary">Daily note</span>
                                <button 
                                    onClick={() => onStartEditing(date)}
                                    className="text-xs text-accent hover:underline"
                                >
                                    Edit
                                </button>
                            </div>
                            
                            {/* Full markdown content */}
                            <div 
                                className="prose prose-sm prose-invert max-w-none"
                                data-color-mode="dark"
                            >
                                <MDEditor.Markdown 
                                    source={fullContent || entry.preview || ''} 
                                    style={{ background: 'transparent' }}
                                />
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => onStartEditing(date)}
                            className="flex items-center gap-2 text-sm text-secondary hover:text-accent transition-colors group"
                        >
                            <Plus size={14} className="group-hover:text-accent" />
                            <span>Daily Note</span>
                        </button>
                    )}
                </>
            )}
        </div>
    );
});

export function DiaryPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<ViewMode>('day');
    const [entries, setEntries] = useState<DiaryEntry[]>([]);
    const [fullContents, setFullContents] = useState<Record<string, string>>({});
    const [editingDate, setEditingDate] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [saving, setSaving] = useState(false);
    const { toasts, addToast, removeToast } = useToast();

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Fetch entries when date or view mode changes
    useEffect(() => {
        fetchEntries();
    }, [currentDate, viewMode]);

    // Fetch full content for current day immediately (for day view)
    useEffect(() => {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        if (!fullContents[dateStr]) {
            fetchFullContent(dateStr);
        }
    }, [currentDate]);

    // Fetch full content for entries when in month, week or threedays view
    useEffect(() => {
        if (entries.length > 0 && (viewMode === 'month' || viewMode === 'week' || viewMode === 'threedays')) {
            entries.forEach(entry => {
                if (!fullContents[entry.date]) {
                    fetchFullContent(entry.date);
                }
            });
        }
    }, [entries, viewMode]);

    const fetchEntries = async () => {
        try {
            const month = currentDate.getMonth() + 1;
            const year = currentDate.getFullYear();
            const res = await axios.get(`${API_URL}/diary`, { params: { month, year } });
            setEntries(res.data);
        } catch (err) {
            console.error('Failed to fetch diary entries:', err);
        }
    };

    const fetchFullContent = async (date: string) => {
        try {
            const res = await axios.get(`${API_URL}/diary/${date}`);
            if (res.data?.content) {
                setFullContents(prev => ({ ...prev, [date]: res.data.content }));
            }
        } catch (err) {
            console.error('Failed to fetch full content:', err);
        }
    };

    const fetchEntry = async (date: string) => {
        try {
            const res = await axios.get(`${API_URL}/diary/${date}`);
            return res.data?.content || '';
        } catch (err) {
            console.error('Failed to fetch entry:', err);
            return '';
        }
    };

    const saveEntry = useCallback(async (date: string, content: string) => {
        setSaving(true);
        try {
            const res = await axios.post(`${API_URL}/diary`, { date, content });
            if (res.data.success) {
                addToast('Entry saved!', 'success');
                setEditingDate(null);
                // Update fullContents with the new content
                setFullContents(prev => ({ ...prev, [date]: content }));
                fetchEntries();
            }
        } catch (err) {
            console.error('Failed to save entry:', err);
            addToast('Failed to save entry', 'error');
        } finally {
            setSaving(false);
        }
    }, [addToast]);

    const startEditing = useCallback(async (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const content = fullContents[dateStr] || await fetchEntry(dateStr);
        setEditContent(content);
        setEditingDate(dateStr);
    }, [fullContents]);

    const handleContentChange = useCallback((content: string) => {
        setEditContent(content);
    }, []);

    const handleCancelEdit = useCallback(() => {
        setEditingDate(null);
    }, []);

    const getEntryForDate = useCallback((date: Date): DiaryEntry | undefined => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const entry = entries.find(e => e.date === dateStr);
        
        // If we have full content but no entry in the list, create a synthetic entry
        if (!entry && fullContents[dateStr]) {
            return {
                id: dateStr,
                date: dateStr,
                content: fullContents[dateStr],
                preview: fullContents[dateStr].substring(0, 100),
                created_at: '',
                updated_at: ''
            };
        }
        
        return entry;
    }, [entries, fullContents]);



    const goToToday = () => setCurrentDate(new Date());
    const goPrev = () => {
        if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
        else if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1));
        else if (viewMode === 'threedays') setCurrentDate(subDays(currentDate, 3));
        else setCurrentDate(subDays(currentDate, 1));
    };
    const goNext = () => {
        if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
        else if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
        else if (viewMode === 'threedays') setCurrentDate(addDays(currentDate, 3));
        else setCurrentDate(addDays(currentDate, 1));
    };

    // Generate days for week view
    const getWeekDays = () => {
        const start = startOfWeek(currentDate);
        return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    };

    // Generate days for three days view
    const getThreeDays = () => {
        return [subDays(currentDate, 1), currentDate, addDays(currentDate, 1)];
    };

    // Mini calendar for day view
    const renderMiniCalendar = () => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
        const startPadding = monthStart.getDay();
        const paddedDays = [...Array(startPadding).fill(null), ...days];

        return (
            <div className="bg-card border border-border rounded-xl p-4 w-72">
                <div className="flex items-center justify-between mb-4">
                    <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1 hover:bg-surface rounded">
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm font-medium">
                        {format(currentDate, 'MMMM')} <span className="text-secondary">{format(currentDate, 'yyyy')}</span>
                    </span>
                    <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1 hover:bg-surface rounded">
                        <ChevronRight size={16} />
                    </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-xs">
                    {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
                        <div key={d} className="text-center text-secondary py-1">{d}</div>
                    ))}
                    {paddedDays.map((day, i) => day ? (
                        <button
                            key={day.toISOString()}
                            onClick={() => setCurrentDate(day)}
                            className={clsx(
                                "w-7 h-7 rounded-full text-center transition-colors",
                                isToday(day) && "bg-accent text-white",
                                isSameDay(day, currentDate) && !isToday(day) && "bg-surface",
                                !isToday(day) && !isSameDay(day, currentDate) && "hover:bg-surface/50"
                            )}
                        >
                            {format(day, 'd')}
                        </button>
                    ) : <div key={`empty-${i}`} />)}
                </div>
            </div>
        );
    };

    // Shared props for DayCard
    const dayCardProps = {
        editingDate,
        editContent,
        saving,
        onStartEditing: startEditing,
        onContentChange: handleContentChange,
        onSave: saveEntry,
        onCancelEdit: handleCancelEdit,
    };

    // Month view
    const renderMonthView = () => (
        <div>
            {/* Month tabs */}
            <div className="flex gap-1 border-b border-border mb-8">
                {months.map((month, idx) => (
                    <button
                        key={month}
                        onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), idx, 1))}
                        className={clsx(
                            "px-4 py-2 text-sm font-medium transition-colors rounded-lg",
                            currentDate.getMonth() === idx
                                ? "bg-accent text-white"
                                : "text-secondary hover:text-primary hover:bg-surface/50"
                        )}
                    >
                        {month}
                    </button>
                ))}
            </div>

            {/* Entries for the month - Card Grid */}
            {entries.length > 0 ? (
                <div className="flex flex-wrap gap-6">
                    {entries.map(entry => {
                        const date = new Date(entry.date + 'T12:00:00');
                        const content = fullContents[entry.date] || entry.preview || '';
                        return (
                            <div 
                                key={entry.id} 
                                className="bg-card border border-border rounded-xl p-4 w-[320px] flex-shrink-0"
                            >
                                {/* Daily Note Badge */}
                                <div className="mb-3">
                                    <span className="inline-flex items-center gap-1 bg-surface text-xs px-2 py-1 rounded border border-border">
                                        📝 Daily Note
                                    </span>
                                </div>
                                
                                {/* Date */}
                                <h3 className="text-base font-semibold mb-3">
                                    {format(date, 'MMMM d, yyyy')}
                                </h3>
                                
                                {/* Content Preview */}
                                <div className="text-sm text-secondary prose prose-sm prose-invert max-w-none mb-4" data-color-mode="dark">
                                    <MDEditor.Markdown 
                                        source={content.length > 300 ? content.substring(0, 300) + '...' : content} 
                                        style={{ background: 'transparent' }}
                                    />
                                </div>
                                
                                {/* Tags section */}
                                <div className="flex items-center gap-2 text-xs text-secondary border-t border-border pt-3">
                                    <span>🏷️ Tags</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <p className="text-center text-secondary py-12">No daily notes created for this month.</p>
            )}
        </div>
    );

    // Week view
    const renderWeekView = () => (
        <div className="max-w-2xl mx-auto">
            {getWeekDays().map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                return (
                    <DayCard 
                        key={day.toISOString()} 
                        date={day} 
                        entry={getEntryForDate(day)}
                        fullContent={fullContents[dateStr]}
                        {...dayCardProps}
                    />
                );
            })}
        </div>
    );

    // Three days view
    const renderThreeDaysView = () => (
        <div className="grid grid-cols-3 gap-6">
            {getThreeDays().map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                return (
                    <div key={day.toISOString()} className="bg-card border border-border rounded-xl p-4">
                        <DayCard 
                            date={day} 
                            expanded 
                            entry={getEntryForDate(day)}
                            fullContent={fullContents[dateStr]}
                            {...dayCardProps}
                        />
                    </div>
                );
            })}
        </div>
    );

    // Day view
    const renderDayView = () => (
        <div className="flex gap-8">
            <div className="flex-1">
                <DayCard 
                    date={currentDate} 
                    expanded 
                    entry={getEntryForDate(currentDate)}
                    fullContent={fullContents[format(currentDate, 'yyyy-MM-dd')]}
                    {...dayCardProps}
                />
                
                {/* Created today section */}
                <div className="mt-8">
                    <h4 className="text-sm font-medium text-secondary mb-4">
                        Created Today ({entries.filter(e => e.date === format(new Date(), 'yyyy-MM-dd')).length})
                    </h4>
                    {entries.filter(e => e.date === format(currentDate, 'yyyy-MM-dd')).length === 0 && (
                        <p className="text-center text-secondary py-8">No content found</p>
                    )}
                </div>
            </div>
            
            {/* Mini calendar sidebar */}
            <div className="flex-shrink-0">
                {renderMiniCalendar()}
            </div>
        </div>
    );

    return (
        <div className="space-y-6" data-color-mode="dark">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">
                    {format(currentDate, 'MMM yyyy')}
                </h1>

                {/* View mode tabs */}
                <div className="flex items-center gap-1 bg-surface/50 rounded-lg p-1">
                    {[
                        { mode: 'month', label: 'Month' },
                        { mode: 'week', label: 'Week' },
                        { mode: 'threedays', label: 'Three days' },
                        { mode: 'day', label: 'Day' },
                    ].map(({ mode, label }) => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode as ViewMode)}
                            className={clsx(
                                "px-3 py-1.5 text-sm font-medium rounded transition-colors",
                                viewMode === mode
                                    ? "bg-card text-primary shadow-sm"
                                    : "text-secondary hover:text-primary"
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* Navigation */}
                <div className="flex items-center gap-4">
                    <button onClick={goToToday} className="text-sm text-accent hover:underline">
                        Today
                    </button>
                    <div className="flex items-center gap-1">
                        <button onClick={goPrev} className="p-1.5 hover:bg-surface rounded transition-colors">
                            <ChevronLeft size={18} />
                        </button>
                        <button onClick={goNext} className="p-1.5 hover:bg-surface rounded transition-colors">
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="min-h-[60vh]">
                {viewMode === 'month' && renderMonthView()}
                {viewMode === 'week' && renderWeekView()}
                {viewMode === 'threedays' && renderThreeDaysView()}
                {viewMode === 'day' && renderDayView()}
            </div>

            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </div>
    );
}
