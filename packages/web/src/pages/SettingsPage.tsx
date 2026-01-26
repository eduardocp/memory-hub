import { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Lock } from 'lucide-react';

const API_URL = 'http://localhost:3000';

export function SettingsPage() {
  const [loading, setLoading] = useState(true);

  // Form states
  const [slackToken, setSlackToken] = useState('');
  const [jiraUrl, setJiraUrl] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [cursorKey, setCursorKey] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/settings`);
      setSlackToken(res.data['slack_token'] || '');
      setJiraUrl(res.data['jira_url'] || '');
      setJiraEmail(res.data['jira_email'] || '');
      setJiraToken(res.data['jira_token'] || '');
      setOpenaiKey(res.data['openai_key'] || '');
      setGeminiKey(res.data['gemini_key'] || '');
      setCursorKey(res.data['cursor_key'] || '');
    } catch (e) {
      console.error(e);
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
        saveSetting('cursor_key', cursorKey, 'ai'),
      ]);
      alert('Settings saved!');
    } catch (e) {
      alert('Failed to save settings');
      console.error(e);
    }
  };

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
            
          {/* Integrations Section */}
          <section>
            <h3 className="text-sm font-medium text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                Slack Integration
            </h3>
            <div className="bg-card rounded-lg p-6 border border-border space-y-5">
              <div>
                <label className="block text-xs font-medium text-secondary mb-1.5">Slack Bot Token (xoxb-)</label>
                <input 
                  type="password"
                  className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent text-white transition-all"
                  value={slackToken}
                  onChange={e => setSlackToken(e.target.value)}
                  placeholder="xoxb-..."
                />
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-medium text-white mb-4 uppercase tracking-wider">Jira Integration</h3>
            <div className="bg-card rounded-lg p-6 border border-border space-y-5">
              <div>
                <label className="block text-xs font-medium text-secondary mb-1.5">Jira Base URL</label>
                <input 
                  type="text"
                  className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent text-white transition-all"
                  value={jiraUrl}
                  onChange={e => setJiraUrl(e.target.value)}
                  placeholder="https://your-domain.atlassian.net"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                    <label className="block text-xs font-medium text-secondary mb-1.5">Jira Email</label>
                    <input 
                    type="email"
                    className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent text-white transition-all"
                    value={jiraEmail}
                    onChange={e => setJiraEmail(e.target.value)}
                    placeholder="you@company.com"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-secondary mb-1.5">Jira API Token</label>
                    <input 
                    type="password"
                    className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent text-white transition-all"
                    value={jiraToken}
                    onChange={e => setJiraToken(e.target.value)}
                    placeholder="API Token..."
                    />
                </div>
              </div>
            </div>
          </section>

          {/* AI Section */}
          <section>
            <h3 className="text-sm font-medium text-white mb-4 uppercase tracking-wider">Artificial Intelligence</h3>
            <div className="bg-card rounded-lg p-6 border border-border space-y-5">
              
              {/* OpenAI / ChatGPT */}
              <div>
                <label className="block text-xs font-medium text-secondary mb-1.5">ChatGPT API Key (OpenAI)</label>
                <input 
                  type="password"
                  className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent text-white transition-all"
                  value={openaiKey}
                  onChange={e => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                />
              </div>

              {/* Gemini */}
              <div>
                <label className="block text-xs font-medium text-secondary mb-1.5">Gemini API Key (Google)</label>
                <input 
                  type="password"
                  className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent text-white transition-all"
                  value={geminiKey}
                  onChange={e => setGeminiKey(e.target.value)}
                  placeholder="AI..."
                />
              </div>

              {/* Cursor / Anthropic */}
              <div>
                <label className="block text-xs font-medium text-secondary mb-1.5">Cursor AI API Key (Anthropic / Generic)</label>
                <input 
                  type="password"
                  className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent text-white transition-all"
                  value={cursorKey}
                  onChange={e => setCursorKey(e.target.value)}
                  placeholder="sk-ant-..."
                />
                <p className="text-[10px] text-secondary mt-2">Required for AI-powered summaries and insights.</p>
              </div>

            </div>
          </section>

          <div className="flex justify-end pt-4">
              <button 
                type="submit" 
                className="flex items-center gap-2 bg-accent text-white px-8 py-2.5 rounded-md text-sm font-medium hover:bg-opacity-90 transition-all shadow-lg shadow-accent/20"
              >
                <Save size={18} />
                Save All Application Settings
              </button>
          </div>
        </form>
      )}
    </div>
  );
}
