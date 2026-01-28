import { useState, useEffect, useCallback } from 'react';
import { Search, Lightbulb, RotateCcw, Star, Settings, X, Sparkles, Bug, FlaskConical, Rocket, Folder, Filter, GitBranch, BrainCircuit } from 'lucide-react';
import clsx from 'clsx';
import { format, isToday, isYesterday, subDays, startOfDay, endOfDay } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { useToast, ToastContainer } from '../components/Toast';
import axios from 'axios';
import { useSocket } from '../context/SocketContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

// Shared imports
import { API_URL } from '../config';
import type { HelperEvent, Project } from '../domain/models';
import { EVENT_TYPES, DATE_FILTERS } from '../shared/constants';
import { projectSchema } from '../shared/schemas';
import type { ProjectFormData } from '../shared/schemas';
import { Select } from '../components/Select';

export function TimelinePage() {
  const [events, setEvents] = useState<HelperEvent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const { toasts, addToast, removeToast } = useToast();
  const { socket, isConnected } = useSocket();

  // Modal States
  const [isProjectModalOpen, setProjectModalOpen] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [showGit, setShowGit] = useState(false);
  const [semanticSearch, setSemanticSearch] = useState(false);

  // Forms
  const { 
      register: registerProject, 
      handleSubmit: handleSubmitProject, 
      reset: resetProject,
      formState: { errors: projectErrors } 
  } = useForm<ProjectFormData>({
      // Cast to any to bypass version mismatch between Zod 4 and Resolver (expects Zod 3 internals)
      resolver: zodResolver(projectSchema as any)
  });

  // Fetch data via WebSocket
  const fetchEventsViaSocket = useCallback((term: string = '', type: string = 'all', range: string = 'all') => {
    if (!socket) return;

    const params: any = { query: term };
    
    if (type !== 'all') {
        params.type = type;
    }

    if (showGit || type === 'git_commit') {
        params.includeGit = true;
    }

    if (range !== 'all') {
        const now = new Date();
        let start, end;
        
        switch(range) {
            case 'today':
                start = startOfDay(now);
                end = endOfDay(now);
                break;
            case 'yesterday':
                start = startOfDay(subDays(now, 1));
                end = endOfDay(subDays(now, 1));
                break;
            case 'week':
                start = subDays(now, 7);
                end = endOfDay(now);
                break;
        }

        if (start && end) {
            params.startDate = start.toISOString();
            params.endDate = end.toISOString();
        }
    }

    socket.emit('events:list', params, (response: any) => {
      if (response.success) {
        setEvents(response.data);
      } else {
        console.error('Failed to fetch events:', response.error);
      }
      setLoading(false);
      setLoading(false);
    });
  }, [socket, showGit]);

  const fetchProjectsViaSocket = useCallback(() => {
    if (!socket) return;
    socket.emit('projects:list', (response: any) => {
      if (response.success) {
        setProjects(response.data);
      } else {
        console.error('Failed to fetch projects:', response.error);
      }
    });
  }, [socket]);



  useEffect(() => {
    if (!socket || !isConnected) return;
    
    fetchEventsViaSocket(searchTerm, selectedType, dateRange);
    fetchProjectsViaSocket();

    const onEventNew = (event: HelperEvent) => {
        setEvents(prev => [event, ...prev]); 
    };

    const onProjectAdded = (project: Project) => setProjects(prev => [...prev, project]);
    const onProjectUpdated = (project: Project) => setProjects(prev => prev.map(p => p.id === project.id ? project : p));
    const onProjectDeleted = ({ id }: { id: string }) => setProjects(prev => prev.filter(p => p.id !== id));

    socket.on('events:new', onEventNew);
    socket.on('projects:added', onProjectAdded);
    socket.on('projects:updated', onProjectUpdated);
    socket.on('projects:deleted', onProjectDeleted);

    return () => {
        socket.off('events:new', onEventNew);
        socket.off('projects:added', onProjectAdded);
        socket.off('projects:updated', onProjectUpdated);
        socket.off('projects:deleted', onProjectDeleted);
    };
  }, [socket, isConnected, fetchProjectsViaSocket]);

  // Perform Search Logic (Hybrid)
  const performSearch = useCallback(async () => {
    setLoading(true);

    if (semanticSearch && searchTerm.length > 2) {
         // Semantic Search / RAG via Ask Brain
         try {
             // We use /ai/chat for RAG now, which returns an answer + related memories
             const res = await axios.post(`${API_URL}/ai/chat`, { 
                 query: searchTerm,
                 project: projects[0]?.name // Optional: context of current project if needed, or global
             });
             
             if (res.data.success && res.data.answer) {
                 const { user_response, related_memories } = res.data.answer;
                 
                 // Map related memories to HelperEvent shape if needed (usually matches)
                 // And inject the AI Answer as a special event at the top
                 const aiEvent: HelperEvent = {
                     id: 'ai-answer-' + Date.now(),
                     type: 'system', // Use 'system' or create a specific type
                     text: user_response,
                     timestamp: new Date().toISOString(),
                     source: 'ai_response', // Special marker
                     project: 'Memory Hub'
                 };
                 
                 // Ensure related_memories has necessary fields
                 const memories = (related_memories || []).map((m: any) => ({
                    ...m,
                    text: m.excerpt || m.text, // Handle mapping
                    timestamp: m.date || m.timestamp || new Date().toISOString(),
                    source: 'ai_citation'
                 }));

                 setEvents([aiEvent, ...memories]);
             }
         } catch (e) {
             console.error("Semantic search failed:", e);
             addToast("Semantic search failed", 'error');
         } finally {
             setLoading(false);
         }
    } else {
        // Standard Socket Filter
        fetchEventsViaSocket(searchTerm, selectedType, dateRange);
    }
  }, [semanticSearch, searchTerm, selectedType, dateRange, fetchEventsViaSocket, addToast, projects]);

  // Debounce search (only for standard search)
  useEffect(() => {
    if (semanticSearch) return; // Don't auto-search for semantic

    const timeout = setTimeout(() => {
        performSearch();
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchTerm, selectedType, dateRange, showGit, semanticSearch, performSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && semanticSearch) {
        performSearch();
    }
  };

  // Handlers
  const handleGenerateSummary = async () => {
    if (projects.length === 0) {
        addToast('No projects available to summarize.', 'error');
        return;
    }
    const targetProject = projects[0]?.name || '';

    setGeneratingSummary(true);
    try {
        const res = await axios.post(`${API_URL}/summary/generate`, { project: targetProject });
        if (res.data.success) {
            addToast('AI Summary generated successfully!', 'success');
        } else {
            addToast(res.data.message || 'Failed to generate summary', 'error');
        }
    } catch (e) {
        console.error(e);
        addToast('Error generating summary. Check console.', 'error');
    } finally {
        setGeneratingSummary(false);
    }
  };



  const onAddProjectSubmit = (data: ProjectFormData) => {
    if (!socket) return;

    socket.emit('projects:add', {
        path: data.path,
        name: data.name
    }, (response: any) => {
        if (response.success) {
            setProjectModalOpen(false);
            resetProject();
            addToast('Project added successfully!', 'success');
        } else {
            addToast(response.error || 'Failed to add project', 'error');
        }
    });
  };

  // Group events by day
  const groupedEvents = events.reduce((acc, event) => {
    const date = new Date(event.timestamp);
    const key = format(date, 'yyyy-MM-dd');
    if (!acc[key]) acc[key] = [];
    acc[key].push(event);
    return acc;
  }, {} as Record<string, HelperEvent[]>);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'idea': return <Lightbulb size={16} className="text-yellow-400" />;
      case 'task_update': return <RotateCcw size={16} className="text-blue-400" />;
      case 'summary': return <Star size={16} className="text-purple-400" />;
      case 'system': return <Settings size={16} className="text-gray-400" />;
      case 'new_bug': return <Bug size={16} className="text-red-500" />;
      case 'bug_update': return <Bug size={16} className="text-orange-400" />;
      case 'spike_progress': return <FlaskConical size={16} className="text-cyan-400" />;
      case 'new_feat': return <Rocket size={16} className="text-emerald-400" />;
      case 'git_commit': return <GitBranch size={16} className="text-orange-500" />;
      default: return <div className="w-2 h-2 rounded-full bg-gray-400" />;
    }
  };

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(`${dateStr}T00:00:00`);
    if (isToday(date)) return `Today — ${format(date, 'MMM d, yyyy')}`;
    if (isYesterday(date)) return `Yesterday — ${format(date, 'MMM d, yyyy')}`;
    return format(date, 'EEEE — MMM d, yyyy');
  };

  return (
    <div className="max-w-4xl mx-auto py-4">
      
      {/* Search & Actions Header */}
      <div className="mb-4 flex items-center justify-between gap-4">
         <div className="relative flex-1 max-w-2xl">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={16} />
           <input 
             type="text" 
             placeholder={semanticSearch ? "Ask a question (e.g. 'what did I do on auth?')..." : "Search by keyword..."}
             className="w-full bg-card border border-border/50 rounded-full py-2.5 pl-10 pr-28 text-sm focus:outline-none focus:border-accent/50 focus:bg-card/80 transition-all placeholder:text-secondary/50"
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             onKeyDown={handleKeyDown}
           />
           <button 
              onClick={() => setSemanticSearch(!semanticSearch)}
              className={clsx(
                  "absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                  semanticSearch 
                    ? "bg-purple-500 text-white border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.3)]" 
                    : "bg-surface text-secondary hover:text-primary border-border/50 hover:border-border"
              )}
           >
               <BrainCircuit size={14} />
               <span>AI Search</span>
           </button>
         </div>
         
         <div className="flex items-center gap-3">
             <button 
                onClick={handleGenerateSummary}
                disabled={generatingSummary}
                className="flex items-center gap-2 bg-surface hover:bg-border text-primary px-3 py-2 rounded-full text-xs font-medium transition-all disabled:opacity-50 border border-transparent"
                title="Generate AI Summary"
              >
                <Sparkles size={14} className={generatingSummary ? "animate-pulse text-accent" : "text-secondary"} />
                {generatingSummary ? 'Thinking...' : 'Summary'}
              </button>
             

         </div>
      </div>

      {/* Filters Toolbar */}
      <div className="mb-8 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-card rounded-full border border-border/50 text-xs text-secondary">
             <Filter size={12} />
             <span>Filters:</span>
        </div>
        
        {/* Show Git Toggle */}
        <button
           onClick={() => setShowGit(!showGit)}
           className={clsx(
             "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all border shrink-0",
             showGit ? "bg-accent/10 border-accent text-accent" : "bg-card border-border/50 text-secondary hover:border-border"
           )}
        >
           <GitBranch size={12} />
           <span>Include Git</span>
        </button>
        <div className="h-4 w-[1px] bg-border/50 mx-1 shrink-0" />

        {/* Date Filter */}
        <div className="w-40">
            <Select 
                value={dateRange}
                onChange={(val) => setDateRange(val)}
                options={DATE_FILTERS}
                placeholder="Date Range"
            />
        </div>

        {/* Type Filter */}
        <div className="w-40">
             <Select 
                value={selectedType}
                onChange={(val) => setSelectedType(val)}
                options={EVENT_TYPES}
                placeholder="Event Type"
            />
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-10">
        {Object.entries(groupedEvents).sort((a,b) => b[0].localeCompare(a[0])).map(([dateKey, dayEvents]) => (
          <div key={dateKey}>
            <h3 className="text-secondary text-sm font-medium mb-4">{formatDateHeader(dateKey)}</h3>
            <div className="space-y-3">
              {dayEvents.map(event => (
                <div key={event.id} className="group bg-card hover:bg-surface border border-border/40 rounded-xl p-5 transition-all relative">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 w-full">
                      <div className="mt-0.5 p-1.5 bg-background rounded-lg border border-border/50 text-secondary group-hover:text-primary transition-colors">
                        {getEventIcon(event.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                         {/* Header Line */}
                         <div className="flex items-center gap-2 mb-1">
                            <span className={clsx(
                                "text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md border",
                                event.type === 'summary' 
                                    ? "bg-purple-500/10 text-purple-400 border-purple-500/20" 
                                    : "bg-background text-secondary border-border/50"
                            )}>
                                {event.type.replace('_', ' ')}
                            </span>
                            <span className="text-secondary/50 mx-1">•</span>
                            <span className="text-[10px] md:text-xs text-primary/80 bg-surface border border-white/10 px-2 py-0.5 rounded-full flex items-center gap-1.5 shadow-sm">
                                <Folder size={10} className="text-blue-400" />
                                {event.project || 'Unknown'}
                            </span>
                            
                            {/* Source Badges */}
                            {event.source === 'ai_response' && (
                                <span className="flex items-center gap-1 text-[9px] bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold uppercase tracking-wider" title="AI Answer">
                                    <Sparkles size={8} /> AI ANSWER
                                </span>
                            )}
                            {event.source === 'ai' && (
                                <span className="flex items-center gap-1 text-[9px] bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/20 font-medium" title="Generated by AI">
                                    <Sparkles size={8} /> AI
                                </span>
                            )}
                            {event.source === 'git' && (
                                <span className="flex items-center gap-1 text-[9px] bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded border border-orange-500/20 font-medium" title="From Git">
                                    <GitBranch size={8} /> Git
                                </span>
                            )}

                             <span className="text-xs text-secondary/50 md:hidden ml-auto">
                                {format(new Date(event.timestamp), 'HH:mm')}
                            </span>
                         </div>

                        {/* Content */}
                        {event.type === 'summary' ? (
                          <div className="text-sm p-4 rounded-lg bg-background/50 border border-border/30 prose-summary mt-2">
                            <ReactMarkdown>{event.text}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-300 leading-relaxed font-normal">{event.text}</p>
                        )}
                      
                      {/* Similarity Score Badge */}
                      {(event as any).similarity !== undefined && (
                          <div className="mt-2 flex">
                            <span className="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded-full" title="Similarity Score">
                                {Math.round((event as any).similarity * 100)}% Match
                            </span>
                          </div>
                      )}
                    </div>
                  </div>
                    
                    <span className="text-xs text-secondary/40 font-mono hidden md:block whitespace-nowrap">
                      {format(new Date(event.timestamp), 'HH:mm')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {loading && <div className="text-center text-secondary py-10">Loading events...</div>}
        {!loading && events.length === 0 && (
          <div className="text-center text-secondary py-10">No events found matching your filter.</div>
        )}
      </div>

      {/* Add Project Modal */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-semibold">Add Project to Monitor</h2>
                    <button onClick={() => setProjectModalOpen(false)} className="text-secondary hover:text-white">
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleSubmitProject(onAddProjectSubmit)}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-secondary mb-1">Project Name</label>
                            <input 
                                {...registerProject('name')}
                                className={clsx(
                                    "w-full bg-background border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent",
                                    projectErrors.name ? "border-red-500/50 focus:border-red-500" : "border-border"
                                )}
                                placeholder="my-awesome-project"
                            />
                            {projectErrors.name && <span className="text-red-400 text-xs mt-1 block">{projectErrors.name.message}</span>}
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-secondary mb-1">Absolute Path</label>
                            <input 
                                {...registerProject('path')}
                                className={clsx(
                                    "w-full bg-background border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent",
                                    projectErrors.path ? "border-red-500/50 focus:border-red-500" : "border-border"
                                )}
                                placeholder="C:/Users/Dev/Values/Project"
                            />
                            {projectErrors.path && <span className="text-red-400 text-xs mt-1 block">{projectErrors.path.message}</span>}
                        </div>
                        <div className="pt-2 flex justify-end">
                            <button type="submit" className="bg-accent text-white px-4 py-2 rounded text-sm font-medium hover:bg-opacity-90">
                                Start Monitoring
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
      )}



      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
