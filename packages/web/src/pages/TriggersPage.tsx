import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Clock, Zap, FileText, Bot } from 'lucide-react';
import clsx from 'clsx';
import { useToast } from '../components/Toast';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { API_URL } from '../config';

interface Trigger {
  id: string;
  name: string;
  type: string;
  schedule: string;
  action: string;
  config: string; // JSON string from DB
  enabled: boolean;
  last_run: string | null;
}

const triggerSchema = z.object({
  name: z.string().min(1, "Bot name is required"),
  action: z.string(),
  project: z.string().optional(),
  schedule: z.string().min(1, "Schedule is required").refine((val) => {
      const parts = val.trim().split(' ');
      return parts.length >= 5 && parts.length <= 6;
  }, "Invalid Cron format (needs 5-6 parts)"),
});

type TriggerFormData = z.infer<typeof triggerSchema>;

export function TriggersPage() {
  const { addToast } = useToast();
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form
  const { 
      register, 
      handleSubmit, 
      setValue, 
      watch, 
      reset,
      formState: { errors } 
  } = useForm<TriggerFormData>({
      resolver: zodResolver(triggerSchema as any),
      defaultValues: {
          name: '',
          schedule: '0 9 * * *',
          action: 'daily_summary',
          project: ''
      }
  });

  const watchedSchedule = watch('schedule');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
        const [trigRes, projRes] = await Promise.all([
            axios.get(`${API_URL}/triggers`),
            axios.get(`${API_URL}/projects`)
        ]);
        setTriggers(trigRes.data);
        setProjects(projRes.data);
    } catch (e) {
        console.error(e);
        addToast('Failed to load triggers', 'error');
    } finally {
        setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
      if (!confirm('Delete this automation?')) return;
      try {
          await axios.delete(`${API_URL}/triggers/${id}`);
          setTriggers(prev => prev.filter(t => t.id !== id));
          addToast('Automation deleted', 'success');
      } catch (e) {
          addToast('Failed to delete', 'error');
      }
  };

  const onSubmit = async (data: TriggerFormData) => {
      const config = {
          project: data.project || ''
          // templateId could be added here for report trigger
      };

      try {
          const payload = {
              name: data.name,
              type: 'schedule', // hardcoded for now
              schedule: data.schedule,
              action: data.action,
              config: JSON.stringify(config),
              enabled: true
          };
          
          await axios.post(`${API_URL}/triggers`, payload);
          addToast('Automation active!', 'success');
          setIsModalOpen(false);
          reset();
          fetchData();
      } catch (e) {
          addToast('Failed to create.', 'error');
      }
  };

  const humanizeSchedule = (cron: string) => {
      if (cron === '0 9 * * *') return 'Daily at 9:00 AM';
      if (cron === '0 18 * * 5') return 'Every Friday at 6:00 PM';
      return cron;
  };

  return (
    <div className="max-w-5xl mx-auto py-8">
      <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3">
                <Zap size={24} className="text-accent" />
                Automations & Triggers
            </h1>
            <p className="text-secondary mt-2">Let Memory Hub work for you automatically.</p>
          </div>
          <button 
            onClick={() => { setIsModalOpen(true); reset(); }}
            className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:brightness-110 transition-all shadow-lg shadow-accent/20"
          >
              <Plus size={16} />
              New Bot
          </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {triggers.map(trigger => {
              const config = JSON.parse(trigger.config || '{}');
              return (
                <div key={trigger.id} className="bg-card border border-border/50 rounded-xl p-5 hover:border-accent/50 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleDelete(trigger.id)} className="text-secondary hover:text-red-400">
                            <Trash2 size={16} />
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-white/5 text-accent">
                            {trigger.action === 'daily_summary' ? <Bot size={20} /> : <FileText size={20} />}
                        </div>
                        <div>
                            <h3 className="font-medium text-sm text-white">{trigger.name}</h3>
                            <div className="flex items-center gap-1.5 text-[10px] text-secondary mt-0.5">
                                <span className={clsx("w-1.5 h-1.5 rounded-full", trigger.enabled ? "bg-green-400 shadow-[0_0_5px_rgba(74,222,128,0.5)]" : "bg-red-400")} />
                                {trigger.enabled ? 'Active' : 'Disabled'}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-xs text-secondary bg-surface/50 p-2 rounded">
                            <Clock size={14} />
                            <span>{humanizeSchedule(trigger.schedule)}</span>
                        </div>
                        
                        {config.project && (
                            <div className="flex items-center gap-2 text-xs text-secondary px-2">
                                <FolderIcon /> 
                                Project: <span className="text-white">{config.project}</span>
                            </div>
                        )}
                        
                        <div className="text-[10px] text-secondary/60 mt-2 px-2">
                            Last run: {trigger.last_run ? new Date(trigger.last_run).toLocaleString() : 'Never'}
                        </div>
                    </div>
                </div>
              );
          })}
          
          {triggers.length === 0 && !loading && (
              <div className="col-span-full py-20 text-center text-secondary">
                  <Bot size={48} className="mx-auto mb-4 opacity-20" />
                  <p>No automations yet. Create your first bot!</p>
              </div>
          )}
      </div>

      {/* Create Modal */}
      {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-[#18181b] border border-border w-full max-w-md rounded-xl p-6 shadow-2xl animate-in zoom-in-95">
                  <h2 className="text-xl font-bold mb-6">Create Automation</h2>
                  
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                      <div>
                          <label className="block text-xs text-secondary mb-1.5">Bot Name <span className="text-red-400">*</span></label>
                          <input 
                            {...register('name')}
                            className={clsx(
                                "w-full bg-surface border rounded px-3 py-2 text-sm outline-none transition-all",
                                errors.name 
                                    ? "border-red-500/50 focus:border-red-500" 
                                    : "border-white/10 focus:border-accent"
                            )}
                            placeholder="e.g., Daily Summary"
                          />
                          {errors.name && <p className="text-red-400 text-[10px] mt-1">{errors.name.message}</p>}
                      </div>
                      
                      <div>
                          <label className="block text-xs text-secondary mb-1.5">Action</label>
                          <select 
                            {...register('action')}
                            className="w-full bg-surface border border-white/10 rounded px-3 py-2 text-sm focus:border-accent outline-none"
                          >
                              <option value="daily_summary">Generate Daily Summary</option>
                              <option value="generate_report">Generate Specific Report (Coming Soon)</option>
                          </select>
                      </div>

                      <div>
                          <label className="block text-xs text-secondary mb-1.5">Target Project <span className="text-secondary/50 font-normal">(Optional)</span></label>
                          <select 
                            {...register('project')}
                            className={clsx(
                                "w-full bg-surface border rounded px-3 py-2 text-sm outline-none transition-all",
                                errors.project 
                                    ? "border-red-500/50 focus:border-red-500" 
                                    : "border-white/10 focus:border-accent"
                            )}
                          >
                              <option value="">All Projects (Global)</option>
                              {projects.map(p => (
                                  <option key={p.name} value={p.name}>{p.name}</option>
                              ))}
                          </select>
                          {errors.project && <p className="text-red-400 text-[10px] mt-1">{errors.project.message}</p>}
                      </div>

                      <div>
                          <label className="block text-xs text-secondary mb-1.5">Schedule <span className="text-red-400">*</span></label>
                          <select 
                             className="w-full bg-surface border border-white/10 rounded px-3 py-2 text-sm focus:border-accent outline-none mb-2"
                             value={watchedSchedule} // Sync with form state
                             onChange={e => setValue('schedule', e.target.value, { shouldValidate: true })}
                          >
                              <option value="0 9 * * *">Daily at 9:00 AM</option>
                              <option value="0 18 * * *">Daily at 6:00 PM</option>
                              <option value="0 18 * * 5">Every Friday at 6:00 PM (Weekly)</option>
                              <option value="*/30 * * * *">Every 30 Minutes (Test)</option>
                          </select>
                          <input 
                            {...register('schedule')}
                            className={clsx(
                                "w-full bg-surface border rounded px-3 py-2 text-xs font-mono text-secondary outline-none transition-all",
                                errors.schedule 
                                    ? "border-red-500/50 focus:border-red-500" 
                                    : "border-white/10 focus:border-accent"
                            )}
                            placeholder="Custom Cron (e.g. 0 9 * * *)"
                          />
                          {errors.schedule && <p className="text-red-400 text-[10px] mt-1">{errors.schedule.message}</p>}
                      </div>

                      <div className="flex justify-end gap-3 mt-8">
                          <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded text-secondary hover:bg-surface text-sm">Cancel</button>
                          <button type="submit" className="px-4 py-2 rounded bg-accent text-white font-medium text-sm hover:brightness-110">Create Bot</button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
}

function FolderIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 2H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
    )
}
