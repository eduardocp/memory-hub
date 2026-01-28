import { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Lock, Cpu, Activity, Eye, Zap, Check, AlertCircle } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { API_URL } from '../config';
import { Select } from '../components/Select';

const settingsSchema = z.object({
  // Global
  file_watcher_enabled: z.boolean(),
  git_sync_enabled: z.boolean(),
  
  // AI
  ai_provider: z.string(),
  ai_model: z.string().optional(),
  
  // Embedding specific
  embedding_provider: z.string().optional(),
  embedding_model: z.string().optional(),

  ai_custom_base_url: z.string().optional(),
  gemini_key: z.string().optional(),
  openai_key: z.string().optional(),
  anthropic_key: z.string().optional(),
  vertex_project_id: z.string().optional(),
  vertex_location: z.string().optional(),

  // Integrations
  slack_token: z.string().optional(),
  jira_url: z.string().optional(),
  jira_email: z.string().optional(),
  jira_token: z.string().optional(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [modelsConfig, setModelsConfig] = useState<any>({});
  
  // Visibility States
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const {
      register,
      handleSubmit,
      reset,
      watch,
      setValue
  } = useForm<SettingsFormData>({
      resolver: zodResolver(settingsSchema as any),
      defaultValues: {
          file_watcher_enabled: true,
          git_sync_enabled: true,
          ai_provider: 'gemini',
          ai_model: '',
          // Default to gemini to avoid null issues
          embedding_provider: 'gemini',
          embedding_model: '',
          
          ai_custom_base_url: '',
          openai_key: '',
          gemini_key: '',
          anthropic_key: '',
          vertex_project_id: '',
          vertex_location: 'us-central1',
          slack_token: '',
          jira_url: '',
          jira_email: '',
          jira_token: '',
      }
  });

  const watchedAiProvider = watch('ai_provider');
  const watchedEmbeddingProvider = watch('embedding_provider');
  const watchedAiModel = watch('ai_model');
  const watchedEmbeddingModel = watch('embedding_model');
  const watchedFileWatcher = watch('file_watcher_enabled');
  const watchedGitSync = watch('git_sync_enabled');

  const toggleKey = (field: string) => {
    setShowKeys(prev => ({ ...prev, [field]: !prev[field] }));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [settingsRes, modelsRes] = await Promise.all([
        axios.get(`${API_URL}/settings`),
        axios.get(`${API_URL}/ai/models`)
      ]);
      
      const settings = settingsRes.data;
      
      reset({
          file_watcher_enabled: settings['system.file_watcher_enabled'] !== 'false',
          git_sync_enabled: settings['system.git_sync_enabled'] !== 'false',
          
          
          ai_provider: settings['ai_provider'] || 'gemini',
          ai_model: settings['ai_model'] || '',

          embedding_provider: settings['embedding_provider'] || 'gemini',
          embedding_model: settings['embedding_model'] || '',

          ai_custom_base_url: settings['ai_custom_base_url'] || '',
          openai_key: settings['openai_key'] || '',
          gemini_key: settings['gemini_key'] || '',
          anthropic_key: settings['anthropic_key'] || '', 
          vertex_project_id: settings['vertex_project_id'] || '',
          vertex_location: settings['vertex_location'] || 'us-central1',
          
          slack_token: settings['slack_token'] || '',
          jira_url: settings['jira_url'] || '',
          jira_email: settings['jira_email'] || '',
          jira_token: settings['jira_token'] || '',
      });

      setModelsConfig(modelsRes.data);

    } catch (e) {
      console.error("Error loading settings:", e);
    } finally {
      setLoading(false);
    }
  };

  const saveSetting = async (key: string, value: string, category: string) => {
    await axios.post(`${API_URL}/settings`, { key, value, category });
  };

  const onSubmit = async (data: SettingsFormData) => {
    setSubmitStatus('saving');
    try {
      await Promise.all([
        saveSetting('slack_token', data.slack_token || '', 'integrations'),
        saveSetting('jira_url', data.jira_url || '', 'integrations'),
        saveSetting('jira_email', data.jira_email || '', 'integrations'),
        saveSetting('jira_token', data.jira_token || '', 'integrations'),
        
        saveSetting('openai_key', data.openai_key || '', 'ai'),
        saveSetting('gemini_key', data.gemini_key || '', 'ai'),
        saveSetting('anthropic_key', data.anthropic_key || '', 'ai'),
        saveSetting('vertex_project_id', data.vertex_project_id || '', 'ai'),
        saveSetting('vertex_location', data.vertex_location || '', 'ai'),
        
        saveSetting('ai_provider', data.ai_provider, 'ai'),
        saveSetting('ai_model', data.ai_model || '', 'ai'),
        saveSetting('ai_custom_base_url', data.ai_custom_base_url || '', 'ai'),
        
        saveSetting('embedding_provider', data.embedding_provider || 'gemini', 'ai'),
        saveSetting('embedding_model', data.embedding_model || '', 'ai'),
        
        saveSetting('system.file_watcher_enabled', String(data.file_watcher_enabled), 'system'),
        saveSetting('system.git_sync_enabled', String(data.git_sync_enabled), 'system'),
      ]);
      setSubmitStatus('success');
      setTimeout(() => setSubmitStatus('idle'), 3000);
    } catch (e) {
      console.error(e);
      setSubmitStatus('error');
      setTimeout(() => setSubmitStatus('idle'), 5000);
    }
  };
  
  const activeChatProviderConfig = modelsConfig[watchedAiProvider];
  const activeEmbeddingProviderConfig = modelsConfig[watchedEmbeddingProvider || 'gemini'];

  // Helper to render API Key input for a provider
  const renderProviderCredentials = (provider: string) => {
      if (provider === 'gemini') {
          return (
            <div>
                <label className="flex items-center justify-between text-xs font-medium text-secondary mb-1.5">Google Gemini API Key</label>
                <div className="relative">
                    <input 
                        type={showKeys['gemini'] ? 'text' : 'password'}
                        className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent text-white transition-all pr-10"
                        {...register('gemini_key')}
                        placeholder="AIza..."
                    />
                    <button type="button" onClick={() => toggleKey('gemini')} className="absolute right-3 top-2.5 text-secondary hover:text-white"><Eye size={14} /></button>
                </div>
            </div>
          );
      }
      if (provider === 'openai') {
          return (
            <div>
                <label className="flex items-center justify-between text-xs font-medium text-secondary mb-1.5">OpenAI API Key</label>
                <div className="relative">
                    <input 
                        type={showKeys['openai'] ? 'text' : 'password'}
                        className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent text-white transition-all pr-10"
                        {...register('openai_key')}
                        placeholder="sk-..."
                    />
                    <button type="button" onClick={() => toggleKey('openai')} className="absolute right-3 top-2.5 text-secondary hover:text-white"><Eye size={14} /></button>
                </div>
            </div>
          );
      }
      if (provider === 'anthropic') {
          return (
            <div>
                <label className="flex items-center justify-between text-xs font-medium text-secondary mb-1.5">Anthropic API Key</label>
                <div className="relative">
                    <input 
                        type={showKeys['anthropic'] ? 'text' : 'password'}
                        className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent text-white transition-all pr-10"
                        {...register('anthropic_key')}
                        placeholder="sk-ant-..."
                    />
                    <button type="button" onClick={() => toggleKey('anthropic')} className="absolute right-3 top-2.5 text-secondary hover:text-white"><Eye size={14} /></button>
                </div>
            </div>
          );
      }
      if (provider === 'vertex') {
           return (
                <div className="bg-white/5 rounded-lg p-4 border border-blue-500/20 mt-2">
                    <h5 className="text-xs font-semibold text-blue-400 mb-3 uppercase tracking-wider">Vertex AI Configuration</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-secondary mb-1.5">Project ID</label>
                            <input type="text" className="w-full bg-background border border-border rounded px-3 py-2 text-sm font-mono" {...register('vertex_project_id')} placeholder="my-project" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-secondary mb-1.5">Region</label>
                            <input type="text" className="w-full bg-background border border-border rounded px-3 py-2 text-sm font-mono" {...register('vertex_location')} placeholder="us-central1" />
                        </div>
                    </div>
                </div>
           );
      }
      return null;
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3">
            <Lock size={24} className="text-accent" />
            System Settings
        </h1>
        <p className="text-secondary mt-2">Manage system services, integrations, watchers and AI configuration.</p>
      </header>

      {loading ? (
        <div className="text-center py-10 text-secondary">Loading settings...</div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">

            {/* Global Services Section */}
          <section>
            <h3 className="text-sm font-medium text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                <Zap size={16} /> Global Services
            </h3>
            <div className="bg-card rounded-lg p-6 border border-border grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* File Watcher Toggle */}
                 <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-sm font-medium text-white">File Watcher</h4>
                        <p className="text-[10px] text-secondary">Monitor memory.json changes via filesystem.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            {...register('file_watcher_enabled')}
                        />
                        <div className="w-11 h-6 bg-surface border border-white/10 rounded-full peer peer-focus:ring-2 peer-focus:ring-accent/50 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                    </label>
                 </div>
                 
                 {/* Git Sync Toggle */}
                 <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-sm font-medium text-white">Git Auto-Sync</h4>
                        <p className="text-[10px] text-secondary">Automatically fetch & sync git commits.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            {...register('git_sync_enabled')}
                        />
                        <div className="w-11 h-6 bg-surface border border-white/10 rounded-full peer peer-focus:ring-2 peer-focus:ring-accent/50 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                    </label>
                 </div>
            </div>
            {(!watchedFileWatcher || !watchedGitSync) && (
                <div className="mt-2 text-xs text-orange-400 bg-orange-400/10 p-2 rounded flex items-center gap-2">
                    <Activity size={12} />
                    <span>Some background services are paused. Events may not be recorded automatically.</span>
                </div>
            )}
          </section>

            {/* AI Section */}
          <section>
            <h3 className="text-sm font-medium text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                <Cpu size={16} /> Artificial Intelligence
            </h3>
            
            <div className="space-y-6">
                
                {/* 1. Main Chat Logic */}
                <div className="bg-card rounded-lg p-6 border border-border">
                    <div className="mb-4">
                        <h4 className="text-base font-medium text-white flex items-center gap-2">
                            <span>🧠 Main Intelligence (Brain)</span>
                        </h4>
                        <p className="text-xs text-secondary mt-1">Used for answering questions, summarizing memories, and reasoning.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-5">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Select
                                    label="Provider"
                                    value={watchedAiProvider}
                                    onChange={(val) => setValue('ai_provider', val)}
                                    options={Object.keys(modelsConfig).map(key => ({
                                        label: modelsConfig[key].name,
                                        value: key
                                    }))}
                                />
                            </div>
                            <div>
                                <Select
                                    label="Model"
                                    value={watchedAiModel || ''}
                                    onChange={(val) => setValue('ai_model', val)}
                                    placeholder="Select a chat model"
                                    options={(activeChatProviderConfig?.models.filter((m: any) => m.type !== 'embedding') || []).map((m: any) => ({
                                        label: m.name,
                                        value: m.id
                                    }))}
                                />
                            </div>
                       </div>
                       
                       {/* Dynamic Credentials for Chat */}
                       <div className="pt-2 border-t border-white/5">
                            {renderProviderCredentials(watchedAiProvider || 'gemini')}
                       </div>
                    </div>
                </div>

                {/* 2. Embeddings Logic */}
                <div className="bg-card rounded-lg p-6 border border-border">
                    <div className="mb-4">
                        <h4 className="text-base font-medium text-white flex items-center gap-2">
                            <span>🔍 Semantic Search Engine</span>
                        </h4>
                        <p className="text-xs text-secondary mt-1">Used to index events and find relevant memories. (Must support Embeddings)</p>
                    </div>

                    <div className="grid grid-cols-1 gap-5">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Select
                                    label="Provider"
                                    value={watchedEmbeddingProvider || 'gemini'}
                                    onChange={(val) => setValue('embedding_provider', val)}
                                    options={Object.keys(modelsConfig).filter(k => k !== 'anthropic').map(key => ({
                                        label: modelsConfig[key].name,
                                        value: key
                                    }))}
                                />
                            </div>
                            <div>
                                <Select
                                    label="Embedding Model"
                                    value={watchedEmbeddingModel || ''}
                                    onChange={(val) => setValue('embedding_model', val)}
                                    placeholder="Select model"
                                    options={(activeEmbeddingProviderConfig?.models.filter((m: any) => m.type === 'embedding') || []).map((m: any) => ({
                                        label: m.name,
                                        value: m.id
                                    }))}
                                />
                            </div>
                       </div>

                       {/* Dynamic Credentials for Embeddings (if different from Chat) */}
                       {watchedEmbeddingProvider !== watchedAiProvider && (
                           <div className="pt-2 border-t border-white/5">
                                <p className="text-[10px] text-orange-400 mb-2">Different provider selected. Ensure credentials are set.</p>
                                {renderProviderCredentials(watchedEmbeddingProvider || 'gemini')}
                           </div>
                       )}
                    </div>
                </div>

                {/* Advanced / Base URL */}
                <div className="px-2">
                  <div className="flex items-center gap-2 mb-2 cursor-pointer opacity-70 hover:opacity-100 transition-opacity" onClick={() => toggleKey('advanced')}>
                      <span className="text-xs font-medium text-secondary">Advanced Configuration</span>
                  </div>
                  {showKeys['advanced'] && (
                    <div className="bg-card/50 p-4 rounded border border-white/5">
                         <label className="block text-xs font-medium text-secondary mb-1.5">Custom Base URL (Optional)</label>
                         <input 
                            type="text"
                            className="w-full bg-background border border-border rounded px-3 py-2 text-sm font-mono placeholder:text-secondary/30"
                            {...register('ai_custom_base_url')}
                            placeholder="https://api.openai.com/v1"
                        />
                    </div>
                  )}
                </div>

            </div>
          </section>

          {/* Integrations Section */}
          <section>
            <h3 className="text-sm font-medium text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                <Activity size={16} /> Integrations
            </h3>
            
            <div className="grid grid-cols-1 gap-6">
                {/* Slack */}
                <div className="bg-card rounded-lg p-6 border border-border">
                    <h4 className="text-sm font-medium text-white mb-3">Slack</h4>
                    <div>
                        <label className="block text-xs font-medium text-secondary mb-1.5">Bot Token</label>
                        <input 
                        type="password"
                        className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent text-white transition-all"
                        {...register('slack_token')}
                        placeholder="xoxb-..."
                        />
                    </div>
                </div>

                {/* Jira */}
                <div className="bg-card rounded-lg p-6 border border-border space-y-4">
                    <h4 className="text-sm font-medium text-white mb-3">Jira</h4>
                    <div>
                        <label className="block text-xs font-medium text-secondary mb-1.5">Base URL</label>
                        <input 
                        type="text"
                        className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent text-white transition-all"
                        {...register('jira_url')}
                        placeholder="https://your-domain.atlassian.net"
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-secondary mb-1.5">Email</label>
                            <input 
                            type="email"
                            className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent text-white transition-all"
                            {...register('jira_email')}
                            placeholder="user@example.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-secondary mb-1.5">API Token</label>
                            <input 
                            type="password"
                            className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent text-white transition-all"
                            {...register('jira_token')}
                            placeholder="Token..."
                            />
                        </div>
                    </div>
                </div>
            </div>
          </section>

          <div className="flex justify-end pt-4 sticky bottom-4 items-center gap-4">
               {submitStatus === 'success' && (
                  <div className="flex items-center gap-2 text-green-400 bg-green-400/10 px-4 py-2 rounded-full border border-green-400/20 text-sm font-medium animate-fade-in">
                      <Check size={16} /> Saved Successfully
                  </div>
               )}
               {submitStatus === 'error' && (
                  <div className="flex items-center gap-2 text-red-400 bg-red-400/10 px-4 py-2 rounded-full border border-red-400/20 text-sm font-medium animate-fade-in">
                      <AlertCircle size={16} /> Error Saving
                  </div>
               )}

               <button 
                type="submit" 
                disabled={submitStatus === 'saving'}
                className={`flex items-center gap-2 px-8 py-3 rounded-full text-sm font-bold transition-all shadow-lg backdrop-blur-md 
                    ${submitStatus === 'saving' ? 'bg-secondary/20 text-secondary cursor-wait' : 'bg-accent text-white hover:brightness-110 shadow-accent/20'}
                `}
               >
                 {submitStatus === 'saving' ? (
                     <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving...
                     </>
                 ) : (
                     <>
                        <Save size={18} />
                        Save System Configuration
                     </>
                 )}
              </button>
          </div>
        </form>
      )}
    </div>
  );
}
