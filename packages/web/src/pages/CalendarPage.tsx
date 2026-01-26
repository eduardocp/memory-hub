import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import clsx from 'clsx';
import { useToast, ToastContainer } from '../components/Toast';
import { useSocket } from '../context/SocketContext';

interface CalendarEvent {
  id: string;
  timestamp: string;
  type: string;
  text: string;
  project: string;
}

export function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const { socket, isConnected } = useSocket();
  const { toasts, addToast, removeToast } = useToast();

 const fetchMonthEvents = useCallback(() => {
    if (!socket) return;
    
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    setLoading(true);

    socket.emit('events:list', {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        limit: 1000 // Ensure we get all events for the month logic
    }, (response: any) => {
        if (response.success) {
            setEvents(response.data);
        } else {
            console.error(response.error);
            addToast('Failed to load events', 'error');
        }
        setLoading(false);
    });
  }, [currentDate, socket]);

  useEffect(() => {
    if (isConnected) {
        fetchMonthEvents();
    }
  }, [fetchMonthEvents, isConnected]);


  const days = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  });

  const previousMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  // Get events for a specific day
  const getDayEvents = (date: Date) => {
    return events.filter(e => isSameDay(new Date(e.timestamp), date));
  };
  
  const selectedDateEvents = selectedDate ? getDayEvents(selectedDate) : [];

  return (
    <div className="max-w-5xl mx-auto py-8 h-full flex flex-col">
      <header className="mb-8 flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-semibold tracking-tight">Calendar</h1>
            <p className="text-secondary mt-2">Visualize your brain's activity over time.</p>
        </div>
        
        <div className="flex items-center gap-4 bg-card rounded-xl p-1 border border-border/50">
             <button onClick={previousMonth} className="p-2 hover:bg-surface rounded-lg transition-colors text-secondary hover:text-white">
                <ChevronLeft size={20} />
             </button>
             <span className="text-sm font-medium min-w-[140px] text-center">
                {format(currentDate, 'MMMM yyyy')}
             </span>
             <button onClick={nextMonth} className="p-2 hover:bg-surface rounded-lg transition-colors text-secondary hover:text-white">
                <ChevronRight size={20} />
             </button>
        </div>
      </header>

      <div className="flex-1 bg-card border border-border/30 rounded-2xl p-6 shadow-sm overflow-hidden flex flex-col">
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 mb-4">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-xs font-semibold text-secondary uppercase tracking-wider py-2">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2 flex-1 auto-rows-fr">
                {/* Empty slots for days before start of month (simplified, date-fns handles this better usually but keeping simple) */}
               {Array.from({ length: startOfMonth(currentDate).getDay() }).map((_, i) => (
                   <div key={`empty-${i}`} className="bg-transparent" />
               ))}

               {days.map(day => {
                   const dayEvents = getDayEvents(day);
                   const hasEvents = dayEvents.length > 0;
                   const isSelected = selectedDate && isSameDay(day, selectedDate);
                   
                   return (
                       <div 
                           key={day.toISOString()}
                           onClick={() => setSelectedDate(day)}
                           className={clsx(
                               "relative rounded-xl border p-3 flex flex-col justify-between transition-all cursor-pointer min-h-[100px]",
                               isToday(day) ? "bg-accent/5 border-accent" : "bg-background border-border/40 hover:border-border",
                               isSelected && "ring-2 ring-accent ring-offset-2 ring-offset-card"
                           )}
                       >
                           <div className="flex justify-between items-start">
                               <span className={clsx(
                                   "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full", 
                                   isToday(day) ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-secondary"
                                )}>
                                   {format(day, 'd')}
                               </span>
                               {hasEvents && (
                                   <div className="text-[10px] bg-surface text-secondary px-1.5 py-0.5 rounded border border-border/50">
                                       {dayEvents.length}
                                   </div>
                               )}
                           </div>
                           
                           <div className="mt-2 space-y-1 overflow-hidden">
                                {dayEvents.slice(0, 3).map(e => (
                                    <div key={e.id} className="text-[10px] truncate text-secondary/70 flex items-center gap-1">
                                        <div className={clsx("w-1.5 h-1.5 rounded-full flex-shrink-0", 
                                            e.type === 'new_bug' ? 'bg-red-500' : 
                                            e.type === 'new_feat' ? 'bg-green-500' : 'bg-gray-500'
                                        )} />
                                        {e.text}
                                    </div>
                                ))}
                                {dayEvents.length > 3 && (
                                    <div className="text-[9px] text-secondary/40 pl-2.5">+{dayEvents.length - 3} more</div>
                                )}
                           </div>
                       </div>
                   );
               })}
            </div>
      </div>

      {/* Day Details Modal */}
      {selectedDate && (
           <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={() => setSelectedDate(null)}>
                <div 
                    className="bg-[#1c1c1f] border border-border rounded-2xl w-full max-w-2xl shadow-2xl scale-100 animate-scale-in max-h-[80vh] flex flex-col" 
                    onClick={e => e.stopPropagation()}
                >
                    <div className="flex justify-between items-center p-6 border-b border-border/40">
                        <div>
                            <h2 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
                                <CalendarIcon size={20} className="text-accent"/>
                                {format(selectedDate, 'EEEE, MMMM do')}
                            </h2>
                            <p className="text-sm text-secondary mt-1">{selectedDateEvents.length} events recorded</p>
                        </div>
                        <button onClick={() => setSelectedDate(null)} className="text-secondary hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    
                    <div className="p-6 overflow-y-auto min-h-[300px]">
                        {selectedDateEvents.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-secondary/50">
                                <Clock size={48} className="mb-4 opacity-20" />
                                <p>No memories on this day.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {selectedDateEvents.map(e => (
                                    <div key={e.id} className="flex gap-4 p-4 rounded-xl bg-card border border-border/30 hover:bg-surface transition-colors">
                                        <div className="text-xs font-mono text-secondary pt-1 min-w-[40px]">
                                            {format(new Date(e.timestamp), 'HH:mm')}
                                        </div>
                                        <div className="flex-1">
                                             <div className="flex items-center gap-2 mb-2">
                                                 <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-background border border-border/50 text-secondary">
                                                     {e.type}
                                                 </span>
                                                 <span className="text-xs text-secondary">{e.project}</span>
                                             </div>
                                             <div className="text-sm text-gray-200">
                                                 {e.text}
                                             </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
           </div>
      )}

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
