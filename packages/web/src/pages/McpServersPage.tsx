import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { useToast, ToastContainer } from '../components/Toast';
import { Select } from '../components/Select';
import { Server, Power, Trash2, Plus, Terminal, Box, PlayCircle, StopCircle, CheckCircle2, AlertCircle, Lock, Wrench, ChevronDown, ChevronUp, Pencil, RotateCw } from 'lucide-react';
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
    type: z.enum(['stdio', 'sse', 'http']),
    url: z.url('Must be a valid URL').optional().or(z.literal('')),
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

    if ((data.type === 'sse' || data.type === 'http') && !data.url) return false;
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
    const [submitting, setSubmitting] = useState(false);
    const submittingRef = useRef(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [serverToDelete, setServerToDelete] = useState<McpServer | null>(null);
    
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

    const [expandedServerId, setExpandedServerId] = useState<string | null>(null);
    const [editingServerId, setEditingServerId] = useState<string | null>(null);
    const [tools, setTools] = useState<any[]>([]);
    const [loadingTools, setLoadingTools] = useState(false);

    const toggleTools = async (server: any) => {
        if (expandedServerId === server.id) {
            setExpandedServerId(null);
            setTools([]);
            return;
        }

        if (server.status !== 'running') {
            addToast('Server must be running to list tools', 'error');
            return;
        }

        setExpandedServerId(server.id);
        setLoadingTools(true);
        setTools([]);
        
        try {
            const res = await axios.get(`${API_URL}/mcp/servers/${server.id}/tools`);
            setTools(res.data.tools || []);
        } catch (e) {
            console.error(e);
            addToast('Failed to fetch tools', 'error');
        } finally {
            setLoadingTools(false);
        }
    };

    const openEditModal = (server: any) => {
        setEditingServerId(server.id);
        const authConfig = server.auth_config || {};
        const presetId = authConfig.data?.presetId || '';
        
        const envString = Object.entries(server.env || {})
            .map(([k,v]) => `${k}=${v}`)
            .join('\n');

        reset({
            name: server.name,
            type: server.type,
            url: server.url || '',
            command: server.command || '',
            args: server.args?.join(' ') || '',
            env: envString,
            presetId: presetId,
            authType: authConfig.type || 'none',
            authToken: authConfig.data?.token || '',
            authClientId: authConfig.data?.clientId || '',
            authClientSecret: authConfig.data?.clientSecret || '',
            authScope: authConfig.data?.scope || '',
            authAuthUrl: authConfig.data?.authorizationUrl || '',
            authTokenUrl: authConfig.data?.tokenUrl || '',
        });
        
        // Modal is opened by the button click handler setting setShowAddModal(true)
    };

    const onSubmit = async (data: ServerFormData) => {
        if (submittingRef.current) return; // Prevent double submit
        submittingRef.current = true;
        setSubmitting(true);
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

                // Include token if auth type is bearer
                if (preset.auth.type === 'bearer' && data.authToken) {
                    auth_config.data.token = data.authToken;
                }

                // Copy OAuth scope from preset if available
                if (preset.auth.type === 'oauth' && preset.auth.oauth?.scope) {
                    auth_config.data.scope = preset.auth.oauth.scope;
                }

                let env = preset.env || {};
                let args = preset.args || [];
                
                const payload = {
                    name: data.name,
                    type: preset.type,
                    url: (preset.type === 'sse' || preset.type === 'http') ? preset.url : undefined,
                    command: preset.type === 'stdio' ? preset.command : undefined,
                    args: preset.type === 'stdio' ? args : undefined,
                    env: preset.type === 'stdio' ? env : undefined,
                    auth_config: auth_config,
                    enabled: true
                };

                if (editingServerId) {
                    await axios.put(`${API_URL}/mcp/servers/${editingServerId}`, payload);
                    addToast('MCP Server updated successfully', 'success');
                } else {
                    await axios.post(`${API_URL}/mcp/servers`, payload);
                    addToast('MCP Server added successfully', 'success');
                }

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

                const payload = {
                    name: data.name,
                    type: data.type,
                    url: (data.type === 'sse' || data.type === 'http') ? data.url : undefined,
                    command: data.type === 'stdio' ? data.command : undefined,
                    args: data.type === 'stdio' ? parsedArgs : undefined,
                    env: data.type === 'stdio' ? parsedEnv : undefined,
                    auth_config: auth_config,
                    enabled: true
                };

                if (editingServerId) {
                    await axios.put(`${API_URL}/mcp/servers/${editingServerId}`, payload);
                    addToast('MCP Server updated successfully', 'success');
                } else {
                    await axios.post(`${API_URL}/mcp/servers`, payload);
                    addToast('MCP Server added successfully', 'success');
                }
            }

            setEditingServerId(null);
            setShowAddModal(false);
            reset();
            fetchServers();
        } catch (e: any) {
            console.error(e);
            addToast(`Failed to add server: ${e.response?.data?.error || e.message}`, 'error');
        } finally {
            setSubmitting(false);
            submittingRef.current = false;
        }
    };

    const openDeleteModal = (server: McpServer) => {
        setServerToDelete(server);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!serverToDelete) return;
        try {
            await axios.delete(`${API_URL}/mcp/servers/${serverToDelete.id}`);
            addToast('Server deleted', 'success');
            fetchServers();
        } catch (e) {
             addToast('Failed to delete server', 'error');
        } finally {
            setShowDeleteModal(false);
            setServerToDelete(null);
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
            case 'auth_required': return <Lock size={14} className="text-amber-400" />;
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
                    onClick={() => {
                        setEditingServerId(null);
                        reset({
                            name: '', type: 'stdio', url: '', command: '', args: '', env: '', 
                            authType: 'none', authUsername: '', authPassword: '', authToken: '', authHeaders: '', 
                            authClientId: '', authClientSecret: '', authAuthUrl: '', authTokenUrl: '', authScope: '', presetId: ''
                        });
                        setShowAddModal(true);
                    }}
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
                    {servers.map(server => {
                        const isAuthRequired = server.auth_config && !server.isAuthenticated;
                        const displayStatus = isAuthRequired && server.status === 'error' ? 'auth_required' : server.status;
                        const isExpanded = expandedServerId === server.id;
                        
                        return (
                        <div key={server.id} className="bg-card border border-border/50 rounded-xl transition-all hover:bg-surface overflow-hidden">
                            <div className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div className="flex items-start gap-4">
                                    <div className={clsx("mt-1 p-2 rounded-lg bg-surface border border-border/50", {
                                        "border-green-500/30 bg-green-500/10": displayStatus === 'running',
                                        "border-red-500/30 bg-red-500/10": displayStatus === 'error',
                                        "border-amber-500/30 bg-amber-500/10": displayStatus === 'auth_required',
                                    })}>
                                        <Server size={24} className={clsx({
                                            "text-green-400": displayStatus === 'running',
                                            "text-red-400": displayStatus === 'error',
                                            "text-amber-400": displayStatus === 'auth_required',
                                            "text-gray-400": displayStatus === 'stopped'
                                        })} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h3 className="font-semibold text-lg">{server.name}</h3>
                                            <span className={clsx("text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border flex items-center gap-1", {
                                                "bg-green-500/10 text-green-400 border-green-500/20": displayStatus === 'running',
                                                "bg-red-500/10 text-red-400 border-red-500/20": displayStatus === 'error',
                                                "bg-amber-500/10 text-amber-400 border-amber-500/20": displayStatus === 'auth_required',
                                                "bg-gray-500/10 text-gray-400 border-gray-500/20": displayStatus === 'stopped'
                                            })}>
                                                {getStatusIcon(displayStatus)}
                                                {displayStatus === 'auth_required' ? 'Auth Required' : displayStatus}
                                                {(server.type === 'sse' || server.type === 'http') && <span className="text-accent/80 border-l border-white/10 pl-1 ml-1">{server.type.toUpperCase()}</span>}
                                            </span>

                                        </div>
                                        <div className="text-xs font-mono text-secondary mt-1 flex items-center gap-2">
                                            <Terminal size={12} />
                                            <span className="opacity-70">
                                                {(server.type === 'sse' || server.type === 'http') ? server.url : `${server.command} ${server.args?.join(' ')}`}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 w-full md:w-auto">
                                    {server.auth_config?.type === 'oauth' && (
                                        !server.isAuthenticated ? (
                                            <button
                                                onClick={() => window.open(`${API_URL}/mcp/auth/start?id=${server.id}`, '_blank')}
                                                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20"
                                            >
                                                Authenticate
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => window.open(`${API_URL}/mcp/auth/start?id=${server.id}`, '_blank')}
                                                className="p-2 rounded-lg text-secondary hover:text-white hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
                                                title="Re-authenticate (Refresh Tokens)"
                                            >
                                                <RotateCw size={18} />
                                            </button>
                                        )
                                    )}
                                    <button
                                        onClick={() => {
                                            openEditModal(server);
                                            setShowAddModal(true); 
                                        }}
                                        className="p-2 rounded-lg text-secondary hover:text-white border border-transparent hover:bg-white/5 transition-colors"
                                        title="Edit Server"
                                    >
                                        <Pencil size={18} />
                                    </button>
                                    <button
                                        onClick={() => toggleTools(server)}
                                        className={clsx("p-2 rounded-lg transition-colors border flex items-center justify-center", 
                                            isExpanded ? "bg-accent/20 text-accent border-accent/30" : "text-secondary hover:text-white border-transparent hover:bg-white/5"
                                        )}
                                        title="View Available Tools"
                                    >
                                       {isExpanded ? <ChevronUp size={18} /> : <Wrench size={18} />}
                                    </button>
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
                                        onClick={() => openDeleteModal(server)}
                                        className="p-2 text-secondary hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                            
                            {isExpanded && (
                                <div className="bg-black/20 border-t border-white/5 p-4 md:p-6 animate-in slide-in-from-top-2">
                                    <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                        <Wrench size={14} className="text-accent" />
                                        Available Tools
                                        <span className="text-secondary font-normal text-xs ml-auto">
                                            {loadingTools ? 'Fetching...' : `${tools.length} tools found`}
                                        </span>
                                    </h4>
                                    
                                    {loadingTools ? (
                                        <div className="py-8 text-center text-secondary text-sm">Loading tools capability...</div>
                                    ) : tools.length === 0 ? (
                                        <div className="py-4 text-center text-secondary text-sm">No tools exposed by this server.</div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {tools.map((tool: any) => (
                                                <div key={tool.name} className="bg-surface/50 border border-white/5 p-3 rounded-lg hover:border-accent/30 transition-colors">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <code className="text-accent text-xs font-bold bg-accent/10 px-1.5 py-0.5 rounded">
                                                            {tool.name}
                                                        </code>
                                                    </div>
                                                    <p className="text-xs text-secondary line-clamp-2" title={tool.description}>
                                                        {tool.description || 'No description provided'}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )})}
                </div>
            )}

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1c1c1f] border border-border rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center rounded-t-2xl">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                {editingServerId ? <Pencil size={20} className="text-accent" /> : <Plus size={20} className="text-accent" />}
                                {editingServerId ? 'Edit MCP Server' : 'Add MCP Server'}
                            </h2>
                            <button onClick={() => setShowAddModal(false)} className="text-secondary hover:text-white">✕</button>
                        </div>
                        
                        <form onSubmit={handleSubmit(onSubmit, (e) => console.error("Validation Errors:", e))} className="p-6 space-y-4 rounded-b-2xl">
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
                                            <p className="text-xs text-secondary">{presets.find(p => p.id === watchPresetId)?.description}</p>
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

                            {/* Show token field when preset uses bearer auth */}
                            {watchPresetId && presets.find(p => p.id === watchPresetId)?.auth?.type === 'bearer' && (
                                <div className="mb-4">
                                    <label className="block text-xs font-medium text-secondary mb-1">Personal Access Token (PAT)</label>
                                    <input 
                                        {...register('authToken')}
                                        type="password"
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none text-white focus:border-accent font-mono"
                                        placeholder="ghp_••••••••••••••••••••••••••••••••••••"
                                    />
                                    <p className="text-xs text-secondary mt-1">
                                        Create a PAT at <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">github.com/settings/tokens</a>
                                    </p>
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
                                    disabled={submitting}
                                    className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/5 text-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    disabled={submitting}
                                    className="px-6 py-2 rounded-lg text-sm font-bold bg-white text-black hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {submitting ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Adding...
                                        </>
                                    ) : 'Add Server'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && serverToDelete && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-card border border-border/50 rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                                <Trash2 className="text-red-400" size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Delete Server</h2>
                                <p className="text-secondary text-sm">This action cannot be undone.</p>
                            </div>
                        </div>
                        
                        <p className="text-white mb-6">
                            Are you sure you want to delete <span className="font-bold text-accent">{serverToDelete.name}</span>?
                        </p>
                        
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => { setShowDeleteModal(false); setServerToDelete(null); }}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-secondary hover:text-white hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 rounded-lg text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </div>
    );
}
