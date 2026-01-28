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
    }, 'Invalid JSON Object').optional()
}).refine(data => {
    if (data.type === 'sse' && !data.url) return false;
    if (data.type === 'stdio' && !data.command) return false;
    return true;
}, {
    message: "Field is required based on type",
    path: ["command"] // Simplified error path
});

type ServerFormData = z.infer<typeof serverSchema>;

export function McpServersPage() {
    const [servers, setServers] = useState<McpServer[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    
    // React Hook Form
    const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<ServerFormData>({
        // @ts-ignore
        resolver: zodResolver(serverSchema),
        defaultValues: {
            name: '',
            type: 'stdio',
            url: '',
            command: '',
            args: '',
            env: ''
        }
    });

    const watchType = watch('type');
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
            let parsedArgs: string[] = [];
            if (data.type === 'stdio') {
                const argsRaw = data.args?.trim() || '';
                if (argsRaw) {
                     try { parsedArgs = JSON.parse(argsRaw); } 
                     catch { parsedArgs = argsRaw.split(' ').filter(Boolean); }
                }
            }
            
            let parsedEnv = {};
            if (data.type === 'stdio') {
                const envRaw = data.env?.trim() || '';
                if (envRaw) { parsedEnv = JSON.parse(envRaw); }
            }

            await axios.post(`${API_URL}/mcp/servers`, {
                name: data.name,
                type: data.type,
                url: data.type === 'sse' ? data.url : undefined,
                command: data.type === 'stdio' ? data.command : undefined,
                args: data.type === 'stdio' ? parsedArgs : undefined,
                env: data.type === 'stdio' ? parsedEnv : undefined,
                enabled: true
            });

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

                            <div>
                                <Select
                                    label="Type"
                                    value={watchType}
                                    onChange={(val) => setValue('type', val as 'stdio' | 'sse')}
                                    options={[
                                        { label: "Stdio (Local Process)", value: "stdio" },
                                        { label: "HTTP (Remote / SSE)", value: "sse" }
                                    ]}
                                />
                            </div>

                            {watchType === 'sse' ? (
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
