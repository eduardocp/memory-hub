import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { useToast, ToastContainer } from '../components/Toast';
import { Select } from '../components/Select';
import { Server, Power, Trash2, Plus, Terminal, Box, PlayCircle, StopCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

interface McpServer {
    id: string;
    name: string;
    type: string;
    command: string;
    url?: string;
    args: string[];
    env: Record<string, string>;
    enabled: boolean;
    status: 'stopped' | 'running' | 'error';
    auth_config?: { type: string; data?: any };
    isAuthenticated?: boolean;
}

const serverSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    type: z.enum(['stdio', 'sse']),
    url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
    command: z.string().optional(),
    args: z.string().refine((val) => {
        if (!val?.trim()) return true;
        try {
            const parsed = JSON.parse(val);
            return Array.isArray(parsed);
        } catch {
            return true;
        }
    }, 'Invalid JSON Array or space separated string').optional(),
    env: z.string().refine((val) => {
        if (!val?.trim()) return true;
        try {
            const parsed = JSON.parse(val);
            return typeof parsed === 'object' && !Array.isArray(parsed);
        } catch {
            return false;
        }
    }, 'Invalid JSON Object').optional(),

    presetId: z.string().optional(),

    // Auth Fields
    authType: z.enum(['none', 'basic', 'bearer', 'custom', 'oauth']).default('none'),
    authUsername: z.string().optional(),
    authPassword: z.string().optional(),
    authToken: z.string().optional(),
    // OAuth Fields
    authClientId: z.string().optional(),
    authClientSecret: z.string().optional(),
    authAuthUrl: z.string().optional(),
    authTokenUrl: z.string().optional(),
    authScope: z.string().optional(),
    
    authHeaders: z.string().refine((val) => {
        if (!val?.trim()) return true;
        try {
            const parsed = JSON.parse(val);
            return typeof parsed === 'object' && !Array.isArray(parsed);
        } catch {
            return false;
        }
    }, 'Invalid JSON Object for Headers').optional()
}).refine(data => {
    // If a preset is selected, we don't need to validate URL/command here as they come from the preset
    if (data.presetId) return true;

    if (data.type === 'sse' && !data.url) return false;
    if (data.type === 'stdio' && !data.command) return false;
    return true;
}, {
    message: "Field is required based on type",
    path: ["command"] // Simplified error path, could be more specific
});

type ServerFormData = z.infer<typeof serverSchema>;

export function McpServersPage() {
    const [servers, setServers] = useState<McpServer[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    
    // React Hook Form
    const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<ServerFormData>({
        resolver: zodResolver(serverSchema as any),
        defaultValues: {
            name: '',
            type: 'stdio',
            url: '',
            command: '',
            args: '',
            env: '',
            authType: 'none',
            authUsername: '',
            authPassword: '',
            authToken: '',
            authHeaders: '',
            authClientId: '',
            authClientSecret: '',
            authAuthUrl: '',
            authTokenUrl: '',
            authScope: '',
            presetId: ''
        }
    });

    const [presets, setPresets] = useState<any[]>([]);

    useEffect(() => {
        axios.get(`${API_URL}/mcp/presets`)
            .then(res => setPresets(res.data))
            .catch(err => console.error("Failed to load presets", err));
    }, []);

    const watchType = watch('type');
    const watchAuthType = watch('authType');
    const watchPresetId = watch('presetId');
    const { toasts, addToast, removeToast } = useToast();

    useEffect(() => {
        fetchServers();
    }, []);

    const fetchServers = async () => {
        try {
            const res = await axios.get(`${API_URL}/mcp/servers`);
            setServers(res.data);
        } catch (e) {
            console.error(e);
            addToast('Failed to load MCP servers', 'error');
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (data: ServerFormData) => {
        try {
            let auth_config: any = undefined;

            // If a preset is selected, construct the config from the preset
            if (data.presetId) {
                const preset = presets.find(p => p.id === data.presetId);
                if (!preset) throw new Error('Preset not found');

                auth_config = {
                    type: preset.auth.type,
                    data: { presetId: data.presetId }
                };

                let env = preset.env || {};
                let args = preset.args || [];
                
                await axios.post(`${API_URL}/mcp/servers`, {
                    name: data.name,
                    type: preset.type,
                    url: preset.type === 'sse' ? preset.url : undefined,
                    command: preset.type === 'stdio' ? preset.command : undefined,
                    args: preset.type === 'stdio' ? args : undefined,
                    env: preset.type === 'stdio' ? env : undefined,
                    auth_config: auth_config,
                    enabled: true
                });

            } else {
                // Manual configuration
                let parsedArgs: string[] = [];
                if (data.type === 'stdio') {
                    const argsRaw = (data.args || '').trim();
                    if (argsRaw) {
                         try { parsedArgs = JSON.parse(argsRaw); } 
                         catch { parsedArgs = argsRaw.split(' ').filter(Boolean); }
                    }
                }
                
                let parsedEnv = {};
                if (data.type === 'stdio') {
                    const envRaw = (data.env || '').trim();
                    if (envRaw) { parsedEnv = JSON.parse(envRaw); }
                }

                if (data.type === 'sse' && data.authType !== 'none') {
                     auth_config = {
                         type: data.authType,
                         data: {}
                     };
                     if (data.authType === 'basic') {
                         auth_config.data = { username: data.authUsername, password: data.authPassword };
                     } else if (data.authType === 'bearer') {
                         auth_config.data = { token: data.authToken };
                     } else if (data.authType === 'custom') {
                         auth_config.data = { headers: data.authHeaders ? JSON.parse(data.authHeaders) : {} };
                     } else if (data.authType === 'oauth') {
                         auth_config.data = {
                             clientId: data.authClientId,
                             clientSecret: data.authClientSecret,
                             authorizationUrl: data.authAuthUrl,
                             tokenUrl: data.authTokenUrl,
                             scope: data.authScope
                         };
                     }
                }

                await axios.post(`${API_URL}/mcp/servers`, {
                    name: data.name,
                    type: data.type,
                    url: data.type === 'sse' ? data.url : undefined,
                    command: data.type === 'stdio' ? data.command : undefined,
                    args: data.type === 'stdio' ? parsedArgs : undefined,
                    env: data.type === 'stdio' ? parsedEnv : undefined,
                    auth_config: auth_config,
                    enabled: true
                });
            }

            addToast('MCP Server added successfully', 'success');
            setShowAddModal(false);
            reset();
            fetchServers();
        } catch (e: any) {
            console.error(e);
            addToast(`Failed to add server: ${e.response?.data?.error || e.message}`, 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this server?')) return;
        try {
            await axios.delete(`${API_URL}/mcp/servers/${id}`);
            addToast('Server deleted', 'success');
            fetchServers();
        } catch (e) {
             addToast('Failed to delete server', 'error');
        }
    };

    const toggleServer = async (server: McpServer) => {
        const action = server.status === 'running' ? 'stop' : 'start';
        try {
            await axios.post(`${API_URL}/mcp/servers/${server.id}/${action}`);
            addToast(`Server ${action}ed`, 'success');
            fetchServers();
        } catch (e: any) {
             addToast(`Failed to ${action} server`, 'error');
             fetchServers(); // refresh status
        }
    };

    const getStatusIcon = (status: string) => {
        switch(status) {
            case 'running': return <CheckCircle2 size={18} className="text-green-400" />;
            case 'error': return <AlertCircle size={18} className="text-red-400" />;
            default: return <StopCircle size={18} className="text-gray-500" />;
        }
    };

    // OAuth success listener
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data === 'mcp-auth-success') {
                addToast('Authentication successful', 'success');
                fetchServers();
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [fetchServers]);

    return (
        <div className="max-w-4xl mx-auto py-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                        <Box className="text-accent" /> MCP Servers
                    </h1>
                    <p className="text-secondary">Manage Model Context Protocol connections.</p>
                </div>
                <button 
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20"
                >
                    <Plus size={18} /> Add Server
                </button>
            </div>

            {loading ? (
                <div className="text-center py-20 text-secondary">Loading servers...</div>
            ) : servers.length === 0 ? (
                <div className="bg-card border border-border/50 rounded-2xl p-12 text-center">
                    <Box size={48} className="mx-auto text-secondary/30 mb-4" />
                    <h3 className="text-lg font-medium text-primary mb-2">No servers connected</h3>
                    <p className="text-secondary text-sm mb-6 max-w-md mx-auto">
                        Connect external tools like GitHub, Postgres, or Slack to give your Memory Hub more context.
                    </p>
                    <button 
                        onClick={() => setShowAddModal(true)}
                        className="text-accent hover:underline text-sm font-medium"
                    >
                        + Add your first server
                    </button>
                </div>
            ) : (
                <div className="grid gap-4">
                    {servers.map(server => (
                        <div key={server.id} className="bg-card border border-border/50 rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all hover:bg-surface">
                            <div className="flex items-start gap-4">
                                <div className={clsx("mt-1 p-2 rounded-lg bg-surface border border-border/50", {
                                    "border-green-500/30 bg-green-500/10": server.status === 'running',
                                    "border-red-500/30 bg-red-500/10": server.status === 'error',
                                })}>
                                    <Server size={24} className={clsx({
                                        "text-green-400": server.status === 'running',
                                        "text-red-400": server.status === 'error',
                                        "text-gray-400": server.status === 'stopped'
                                    })} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-semibold text-lg">{server.name}</h3>
                                        <span className={clsx("text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border flex items-center gap-1", {
                                            "bg-green-500/10 text-green-400 border-green-500/20": server.status === 'running',
                                            "bg-red-500/10 text-red-400 border-red-500/20": server.status === 'error',
                                            "bg-gray-500/10 text-gray-400 border-gray-500/20": server.status === 'stopped'
                                        })}>
                                            {getStatusIcon(server.status)}
                                            {server.status}
                                            {server.type === 'sse' && <span className="text-accent/80 border-l border-white/10 pl-1 ml-1">SSE</span>}
                                        </span>
                                    </div>
                                    <div className="text-xs font-mono text-secondary mt-1 flex items-center gap-2">
                                        <Terminal size={12} />
                                        <span className="opacity-70">
                                            {server.type === 'sse' ? server.url : `${server.command} ${server.args?.join(' ')}`}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 w-full md:w-auto">
                                {server.auth_config?.type === 'oauth' && (
                                    server.isAuthenticated ? (
                                        <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                                            <CheckCircle2 size={14} />
                                            Authenticated
                                        </span>
                                    ) : (
                                        <button
                                            onClick={() => window.open(`${API_URL}/mcp/auth/start?id=${server.id}`, '_blank')}
                                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20"
                                        >
                                            Authenticate
                                        </button>
                                    )
                                )}
                                <button 
                                    onClick={() => toggleServer(server)}
                                    className={clsx("flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border", {
                                        "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20": server.status === 'running',
                                        "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20": server.status !== 'running'
                                    })}
                                >
                                    {server.status === 'running' ? (
                                        <> <Power size={16} /> Stop </>
                                    ) : (
                                        <> <PlayCircle size={16} /> Start </>
                                    )}
                                </button>
                                <button 
                                    onClick={() => handleDelete(server.id)}
                                    className="p-2 text-secondary hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                    title="Delete"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1c1c1f] border border-border rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center rounded-t-2xl">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Plus size={20} className="text-accent" /> Add MCP Server
                            </h2>
                            <button onClick={() => setShowAddModal(false)} className="text-secondary hover:text-white">✕</button>
                        </div>
                        
                        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 rounded-b-2xl">
                            <div>
                                <label className="block text-xs font-medium text-secondary mb-1">Server Name</label>
                                <input 
                                    {...register('name')}
                                    type="text" 
                                    placeholder="e.g. GitHub or Jira"
                                    className={clsx(
                                        "w-full bg-black/20 border rounded-lg px-4 py-2 text-sm outline-none text-white transition-colors",
                                        errors.name ? "border-red-500 focus:border-red-500" : "border-white/10 focus:border-accent"
                                    )}
                                />
                                {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
                            </div>

                            {!watchPresetId ? (
                                <>
                                    <div className="mb-4">
                                        <label className="block text-xs font-medium text-secondary mb-1">Server Type</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => { setValue('type', 'stdio'); setValue('presetId', ''); }}
                                                className={clsx("py-2 px-3 rounded-lg border text-sm transition-colors", 
                                                    watchType === 'stdio' ? "bg-accent/10 border-accent text-accent" : "bg-white/5 border-white/10 text-secondary hover:bg-white/10")}
                                            >
                                                Stdio (Local)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setValue('type', 'sse'); setValue('presetId', ''); }}
                                                className={clsx("py-2 px-3 rounded-lg border text-sm transition-colors", 
                                                    watchType === 'sse' ? "bg-accent/10 border-accent text-accent" : "bg-white/5 border-white/10 text-secondary hover:bg-white/10")}
                                            >
                                                SSE (Remote)
                                            </button>
                                        </div>
                                    </div>

                                    {/* Presets List */}
                                    {presets.length > 0 && (
                                        <div className="mb-6 border-b border-white/10 pb-6">
                                            <h3 className="text-secondary text-xs uppercase tracking-wider font-bold mb-3">Popular Services</h3>
                                            <div className="grid grid-cols-2 gap-3">
                                                {presets.map(preset => (
                                                    <div 
                                                        key={preset.id}
                                                        onClick={() => {
                                                            setValue('name', preset.name);
                                                            setValue('type', preset.type);
                                                            if (preset.type === 'stdio') {
                                                                setValue('command', preset.command);
                                                                setValue('args', JSON.stringify(preset.args || []));
                                                                setValue('env', JSON.stringify(preset.env || {}));
                                                            } else {
                                                                setValue('url', preset.url || '');
                                                            }
                                                            setValue('authType', preset.auth.type);
                                                            setValue('presetId', preset.id);
                                                            // Clear manual auth fields
                                                            setValue('authUsername', '');
                                                            setValue('authPassword', '');
                                                            setValue('authToken', '');
                                                            setValue('authHeaders', '');
                                                            setValue('authClientId', '');
                                                            setValue('authClientSecret', '');
                                                            setValue('authAuthUrl', '');
                                                            setValue('authTokenUrl', '');
                                                            setValue('authScope', '');
                                                        }}
                                                        className="p-3 bg-white/5 border border-white/10 rounded-lg hover:border-accent/50 cursor-pointer transition-colors flex items-center gap-3"
                                                    >
                                                        {/* Icon placeholder */}
                                                        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-xs">
                                                            {preset.name.substring(0,2).toUpperCase()}
                                                        </div>
                                                        <div className="text-left">
                                                            <div className="text-sm font-medium text-white">{preset.name}</div>
                                                            <div className="text-[10px] text-secondary">{preset.description}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="mb-6 p-4 bg-accent/10 border border-accent/20 rounded-lg flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-black font-bold">
                                            {presets.find(p => p.id === watchPresetId)?.name.substring(0,2).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-lg">{presets.find(p => p.id === watchPresetId)?.name}</h3>
                                            <p className="text-xs text-secondary">Configuration managed by Memory Hub</p>
                                        </div>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            reset(); // Reset the form to default values
                                            setValue('presetId', ''); // Explicitly clear presetId
                                            setValue('type', 'stdio'); // Set default type back to stdio
                                        }}
                                        className="text-xs text-secondary hover:text-white underline"
                                    >
                                        Change
                                    </button>
                                </div>
                            )}

                            {!watchPresetId && (
                            <>
                            {watchType === 'sse' ? (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium text-secondary mb-1">Server URL (SSE Endpoint)</label>
                                        <input 
                                            {...register('url')}
                                            type="text" 
                                            placeholder="https://mcp.atlassian.com/v1/sse"
                                            className={clsx(
                                                "w-full bg-black/20 border rounded-lg px-4 py-2 text-sm outline-none text-white font-mono transition-colors",
                                                errors.url ? "border-red-500 focus:border-red-500" : "border-white/10 focus:border-accent"
                                            )}
                                        />
                                        {errors.url && <p className="text-red-400 text-xs mt-1">{errors.url.message}</p>}
                                    </div>

                                    <div className="border-t border-white/5 pt-4 mt-4">
                                        <h3 className="text-secondary text-xs uppercase tracking-wider font-bold mb-3">Authentication</h3>
                                        
                                        <div className="mb-4">
                                            <Select 
                                                label="Auth Type"
                                                value={watchAuthType}
                                                onChange={(val) => setValue('authType', val as any)}
                                                options={[
                                                    { label: "None", value: "none" },
                                                    { label: "Basic Auth (Username/Password)", value: "basic" },
                                                    { label: "Bearer Token", value: "bearer" },
                                                    { label: "Custom Headers", value: "custom" },
                                                    { label: "OAuth 2.0", value: "oauth" }
                                                ]}
                                            />
                                        </div>

                                        {watchAuthType === 'basic' && (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-secondary mb-1">Username</label>
                                                    <input 
                                                        {...register('authUsername')}
                                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none text-white focus:border-accent"
                                                        placeholder="user@example.com"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-secondary mb-1">Password / API Token</label>
                                                    <input 
                                                        {...register('authPassword')}
                                                        type="password"
                                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none text-white focus:border-accent"
                                                        placeholder="••••••••"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {watchAuthType === 'bearer' && (
                                            <div>
                                                <label className="block text-xs font-medium text-secondary mb-1">Bearer Token</label>
                                                <input 
                                                    {...register('authToken')}
                                                    type="password"
                                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none text-white focus:border-accent"
                                                    placeholder="ey..."
                                                />
                                            </div>
                                        )}

                                        {watchAuthType === 'custom' && (
                                            <div>
                                                <label className="block text-xs font-medium text-secondary mb-1">Headers (JSON)</label>
                                                <textarea 
                                                    {...register('authHeaders')}
                                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none text-white font-mono h-20 resize-none focus:border-accent"
                                                    placeholder='{ "X-Api-Key": "..." }'
                                                />
                                                 {errors.authHeaders && <p className="text-red-400 text-xs mt-1">{errors.authHeaders.message}</p>}
                                            </div>
                                        )}

                                        {watchAuthType === 'oauth' && (
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-medium text-secondary mb-1">Client ID</label>
                                                        <input 
                                                            {...register('authClientId')}
                                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none text-white focus:border-accent"
                                                            placeholder="Client ID"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-secondary mb-1">Client Secret</label>
                                                        <input 
                                                            {...register('authClientSecret')}
                                                            type="password"
                                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none text-white focus:border-accent"
                                                            placeholder="Client Secret"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-secondary mb-1">Authorization URL</label>
                                                    <input 
                                                        {...register('authAuthUrl')}
                                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none text-white focus:border-accent"
                                                        placeholder="https://provider.com/oauth/authorize"
                                                    />
                                                    <p className="text-[10px] text-secondary mt-1">Found in provider documentation.</p>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-secondary mb-1">Token URL</label>
                                                    <input 
                                                        {...register('authTokenUrl')}
                                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none text-white focus:border-accent"
                                                        placeholder="https://provider.com/oauth/token"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-secondary mb-1">Scope (Space separated)</label>
                                                    <input 
                                                        {...register('authScope')}
                                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none text-white focus:border-accent"
                                                        placeholder="read:jira-work write:jira-work"
                                                    />
                                                </div>
                                                <div className="p-3 bg-white/5 rounded-lg border border-white/10 text-xs text-secondary">
                                                    <p className="font-bold mb-1">Callback URL:</p>
                                                    <code className="bg-black/30 px-2 py-1 rounded block mt-1 select-all hover:text-white transition-colors">
                                                        {window.location.protocol}//{window.location.hostname}:3000/mcp/auth/callback
                                                    </code>
                                                    <p className="mt-2 text-[10px] opacity-70">Register this URL in your OAuth Provider settings.</p>
                                                </div>
                                            </div>
                                        )}

                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium text-secondary mb-1">Command</label>
                                        <input 
                                            {...register('command')}
                                            type="text" 
                                            placeholder="npx" 
                                            className={clsx(
                                                "w-full bg-black/20 border rounded-lg px-4 py-2 text-sm outline-none text-white font-mono transition-colors",
                                                errors.command ? "border-red-500 focus:border-red-500" : "border-white/10 focus:border-accent"
                                            )}
                                        />
                                        {errors.command && <p className="text-red-400 text-xs mt-1">{errors.command.message}</p>}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-secondary mb-1">Arguments (Space separated or JSON)</label>
                                        <textarea 
                                            {...register('args')}
                                            placeholder='["-y", "@modelcontextprotocol/server-github"]'
                                            className={clsx(
                                                "w-full bg-black/20 border rounded-lg px-4 py-2 text-sm outline-none text-white font-mono h-24 resize-none transition-colors",
                                                errors.args ? "border-red-500 focus:border-red-500" : "border-white/10 focus:border-accent"
                                            )}
                                        />
                                        {errors.args && <p className="text-red-400 text-xs mt-1">{errors.args.message}</p>}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-secondary mb-1">Environment Variables (JSON)</label>
                                        <textarea 
                                            {...register('env')}
                                            placeholder='{"GITHUB_TOKEN": "ghp_..."}'
                                            className={clsx(
                                                "w-full bg-black/20 border rounded-lg px-4 py-2 text-sm outline-none text-white font-mono h-24 resize-none transition-colors",
                                                errors.env ? "border-red-500 focus:border-red-500" : "border-white/10 focus:border-accent"
                                            )}
                                        />
                                        {errors.env && <p className="text-red-400 text-xs mt-1">{errors.env.message}</p>}
                                    </div>
                                </>
                            )}
                            </>
                            )}

                            <div className="flex justify-end gap-3 mt-6">
                                <button 
                                    type="button"
                                    onClick={() => { setShowAddModal(false); reset(); }}
                                    className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/5 text-secondary transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className="px-6 py-2 rounded-lg text-sm font-bold bg-white text-black hover:bg-gray-200 transition-colors"
                                >
                                    Add Server
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </div>
    );
}
