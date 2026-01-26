import { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Lock, Cpu, Key, Activity, Eye, EyeOff, Zap } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const API_URL = 'http://localhost:3000';

const settingsSchema = z.object({
  // Global
  file_watcher_enabled: z.boolean(),
  git_sync_enabled: z.boolean(),
  
  // AI
  ai_provider: z.string(),
  ai_model: z.string().optional(),
  openai_key: z.string().optional(),
  gemini_key: z.string().optional(),
  anthropic_key: z.string().optional(),

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

  const {
      register,
      handleSubmit,
      reset,
      watch
  } = useForm<SettingsFormData>({
      resolver: zodResolver(settingsSchema as any),
      defaultValues: {
          file_watcher_enabled: true,
          git_sync_enabled: true,
          ai_provider: 'gemini',
          ai_model: '',
          openai_key: '',
          gemini_key: '',
          anthropic_key: '',
          slack_token: '',
          jira_url: '',
          jira_email: '',
          jira_token: '',
      }
  });

  const watchedAiProvider = watch('ai_provider');
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
          openai_key: settings['openai_key'] || '',
          gemini_key: settings['gemini_key'] || '',
          anthropic_key: settings['anthropic_key'] || '', 
          
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
    try {
      await Promise.all([
        saveSetting('slack_token', data.slack_token || '', 'integrations'),
        saveSetting('jira_url', data.jira_url || '', 'integrations'),
        saveSetting('jira_email', data.jira_email || '', 'integrations'),
        saveSetting('jira_token', data.jira_token || '', 'integrations'),
        
        saveSetting('openai_key', data.openai_key || '', 'ai'),
        saveSetting('gemini_key', data.gemini_key || '', 'ai'),
        saveSetting('anthropic_key', data.anthropic_key || '', 'ai'),
        saveSetting('ai_provider', data.ai_provider, 'ai'),
        saveSetting('ai_model', data.ai_model || '', 'ai'),
        
        saveSetting('system.file_watcher_enabled', String(data.file_watcher_enabled), 'system'),
        saveSetting('system.git_sync_enabled', String(data.git_sync_enabled), 'system'),
      ]);
      alert('Settings saved successfully!');
    } catch (e) {
      alert('Failed to save settings');
      console.error(e);
    }
  };
  
  const activeProviderConfig = modelsConfig[watchedAiProvider];

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
            <div className="bg-card rounded-lg p-6 border border-border space-y-6">
              
              {/* Provider Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-medium text-secondary mb-1.5">Active AI Provider</label>
                    <select 
                        {...register('ai_provider')}
                        className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent text-white transition-all appearance-none"
                    >
                        {Object.keys(modelsConfig).map(key => (
                            <option key={key} value={key}>{modelsConfig[key].name}</option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-secondary mb-1.5">Model</label>
                     <select 
                        {...register('ai_model')}
                        className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent text-white transition-all appearance-none"
                    >
                        <option value="" disabled>Select a model</option>
                        {activeProviderConfig?.models.map((m: any) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                    <p className="text-[10px] text-secondary mt-1">
                        Select which model version to use for automatic tasks.
                    </p>
                  </div>
              </div>

              <div className="border-t border-white/5 pt-4">
                  <h4 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                      <Key size={14} className="text-accent" /> API Keys
                  </h4>
                  
                  <div className="space-y-4">
                    {/* Gemini */}
                    <div>
                        <label className="flex items-center justify-between text-xs font-medium text-secondary mb-1.5">
                            <span>Google Gemini Key</span>
                            {/* ... */}
                        </label>
                        <div className="relative">
                            <input 
                                type={showKeys['gemini'] ? 'text' : 'password'}
                                className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent text-white transition-all pr-10"
                                {...register('gemini_key')}
                                placeholder="AIza..."
                            />
                            <button
                                type="button"
                                onClick={() => toggleKey('gemini')}
                                className="absolute right-3 top-2.5 text-secondary hover:text-white focus:outline-none"
                            >
                                {showKeys['gemini'] ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                    </div>

                    {/* OpenAI */}
                    <div>
                        <label className="flex items-center justify-between text-xs font-medium text-secondary mb-1.5">
                            <span>OpenAI Key</span>
                            {/* ... */}
                        </label>
                        <div className="relative">
                             <input 
                                type={showKeys['openai'] ? 'text' : 'password'}
                                className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent text-white transition-all pr-10"
                                {...register('openai_key')}
                                placeholder="sk-..."
                            />
                            <button
                                type="button"
                                onClick={() => toggleKey('openai')}
                                className="absolute right-3 top-2.5 text-secondary hover:text-white focus:outline-none"
                            >
                                {showKeys['openai'] ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                    </div>

                    {/* Anthropic */}
                    <div>
                        <label className="flex items-center justify-between text-xs font-medium text-secondary mb-1.5">
                            <span>Anthropic Key</span>
                            {/* ... */}
                        </label>
                         <div className="relative">
                            <input 
                                type={showKeys['anthropic'] ? 'text' : 'password'}
                                className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent text-white transition-all pr-10"
                                {...register('anthropic_key')}
                                placeholder="sk-ant-..."
                            />
                            <button
                                type="button"
                                onClick={() => toggleKey('anthropic')}
                                className="absolute right-3 top-2.5 text-secondary hover:text-white focus:outline-none"
                            >
                                {showKeys['anthropic'] ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                    </div>
                  </div>
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

          <div className="flex justify-end pt-4 sticky bottom-4">
              <button 
                type="submit" 
                className="flex items-center gap-2 bg-accent text-white px-8 py-3 rounded-full text-sm font-bold hover:brightness-110 transition-all shadow-lg shadow-accent/20 backdrop-blur-md"
              >
                <Save size={18} />
                Save System Configuration
              </button>
          </div>
        </form>
      )}
    </div>
  );
}
