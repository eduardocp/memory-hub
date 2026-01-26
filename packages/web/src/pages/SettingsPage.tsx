import { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Lock, Cpu, Key, Activity } from 'lucide-react';

const API_URL = 'http://localhost:3000';

export function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [modelsConfig, setModelsConfig] = useState<any>({});

  // Form states
  const [slackToken, setSlackToken] = useState('');
  const [jiraUrl, setJiraUrl] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  
  // AI States
  const [aiProvider, setAiProvider] = useState('gemini');
  const [aiModel, setAiModel] = useState('');
  
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');

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
      setSlackToken(settings['slack_token'] || '');
      setJiraUrl(settings['jira_url'] || '');
      setJiraEmail(settings['jira_email'] || '');
      setJiraToken(settings['jira_token'] || '');
      
      setOpenaiKey(settings['openai_key'] || '');
      setGeminiKey(settings['gemini_key'] || '');
      setAnthropicKey(settings['anthropic_key'] || '');
      
      setAiProvider(settings['ai_provider'] || 'gemini');
      setAiModel(settings['ai_model'] || '');
      
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await Promise.all([
        saveSetting('slack_token', slackToken, 'integrations'),
        saveSetting('jira_url', jiraUrl, 'integrations'),
        saveSetting('jira_email', jiraEmail, 'integrations'),
        saveSetting('jira_token', jiraToken, 'integrations'),
        
        saveSetting('openai_key', openaiKey, 'ai'),
        saveSetting('gemini_key', geminiKey, 'ai'),
        saveSetting('anthropic_key', anthropicKey, 'ai'),
        saveSetting('ai_provider', aiProvider, 'ai'),
        saveSetting('ai_model', aiModel, 'ai'),
      ]);
      alert('Settings saved successfully!');
    } catch (e) {
      alert('Failed to save settings');
      console.error(e);
    }
  };

  const activeProviderConfig = modelsConfig[aiProvider];

  return (
    <div className="max-w-3xl mx-auto py-8">
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3">
            <Lock size={24} className="text-accent" />
            System Settings
        </h1>
        <p className="text-secondary mt-2">Manage integrations and AI configuration for your Memory Hub.</p>
      </header>

      {loading ? (
        <div className="text-center py-10 text-secondary">Loading settings...</div>
      ) : (
        <form onSubmit={handleSave} className="space-y-10">
            
            {/* AI Section (High Priority) */}
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
                        className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent text-white transition-all appearance-none"
                        value={aiProvider}
                        onChange={e => {
                            setAiProvider(e.target.value);
                            setAiModel(''); // Reset model when provider changes
                        }}
                    >
                        {Object.keys(modelsConfig).map(key => (
                            <option key={key} value={key}>{modelsConfig[key].name}</option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-secondary mb-1.5">Model</label>
                     <select 
                        className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent text-white transition-all appearance-none"
                        value={aiModel}
                        onChange={e => setAiModel(e.target.value)}
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
                            {aiProvider === 'gemini' && <span className="text-[10px] text-accent bg-accent/10 px-1.5 rounded">Active</span>}
                        </label>
                        <input 
                        type="password"
                        className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent text-white transition-all"
                        value={geminiKey}
                        onChange={e => setGeminiKey(e.target.value)}
                        placeholder="AIza..."
                        />
                    </div>

                    {/* OpenAI */}
                    <div>
                        <label className="flex items-center justify-between text-xs font-medium text-secondary mb-1.5">
                            <span>OpenAI Key</span>
                            {aiProvider === 'openai' && <span className="text-[10px] text-accent bg-accent/10 px-1.5 rounded">Active</span>}
                        </label>
                        <input 
                        type="password"
                        className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent text-white transition-all"
                        value={openaiKey}
                        onChange={e => setOpenaiKey(e.target.value)}
                        placeholder="sk-..."
                        />
                    </div>

                    {/* Anthropic */}
                    <div>
                        <label className="flex items-center justify-between text-xs font-medium text-secondary mb-1.5">
                            <span>Anthropic Key</span>
                            {aiProvider === 'anthropic' && <span className="text-[10px] text-accent bg-accent/10 px-1.5 rounded">Active</span>}
                        </label>
                        <input 
                        type="password"
                        className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent text-white transition-all"
                        value={anthropicKey}
                        onChange={e => setAnthropicKey(e.target.value)}
                        placeholder="sk-ant-..."
                        />
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
                        value={slackToken}
                        onChange={e => setSlackToken(e.target.value)}
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
                        value={jiraUrl}
                        onChange={e => setJiraUrl(e.target.value)}
                        placeholder="https://your-domain.atlassian.net"
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-secondary mb-1.5">Email</label>
                            <input 
                            type="email"
                            className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent text-white transition-all"
                            value={jiraEmail}
                            onChange={e => setJiraEmail(e.target.value)}
                            placeholder="user@example.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-secondary mb-1.5">API Token</label>
                            <input 
                            type="password"
                            className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent text-white transition-all"
                            value={jiraToken}
                            onChange={e => setJiraToken(e.target.value)}
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
