import { useState, useEffect, useCallback } from 'react';
import { Trash2, Folder, FolderPlus, X, Edit2, Play, Activity } from 'lucide-react';
import { useToast, ToastContainer } from '../components/Toast';
import { useSocket } from '../context/SocketContext';

interface Project {
  id: string;
  path: string;
  name: string;
}

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  
  const [newPath, setNewPath] = useState('');
  const [newName, setNewName] = useState('');
  const { toasts, addToast, removeToast } = useToast();
  const { socket, isConnected } = useSocket();

  const fetchProjectsViaSocket = useCallback(() => {
    if (!socket) return;
    socket.emit('projects:list', (response: any) => {
      if (response.success) {
        setProjects(response.data);
      } else {
        console.error('Failed to fetch projects:', response.error);
      }
      setLoading(false);
    });
  }, [socket]);

  useEffect(() => {
    if (!socket || !isConnected) return;
    
    fetchProjectsViaSocket();

    const onProjectAdded = (project: Project) => setProjects(prev => [...prev, project]);
    const onProjectUpdated = (project: Project) => setProjects(prev => prev.map(p => p.id === project.id ? project : p));
    const onProjectDeleted = ({ id }: { id: string }) => setProjects(prev => prev.filter(p => p.id !== id));

    socket.on('projects:added', onProjectAdded);
    socket.on('projects:updated', onProjectUpdated);
    socket.on('projects:deleted', onProjectDeleted);

    return () => {
        socket.off('projects:added', onProjectAdded);
        socket.off('projects:updated', onProjectUpdated);
        socket.off('projects:deleted', onProjectDeleted);
    };
  }, [fetchProjectsViaSocket, socket, isConnected]);

  const openAddModal = () => {
    setEditingProject(null);
    setNewName('');
    setNewPath('');
    setModalOpen(true);
  };

  const openEditModal = (p: Project) => {
    setEditingProject(p);
    setNewName(p.name);
    setNewPath(p.path);
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPath || !newName || !socket) return;

    if (editingProject) {
      // Update via socket
      socket.emit('projects:update', {
        id: editingProject.id,
        path: newPath
      }, (response: any) => {
        if (response.success) {
          setModalOpen(false);
          setNewPath('');
          setNewName('');
          setEditingProject(null);
          addToast('Project updated!', 'success');
        } else {
          addToast(response.error || 'Failed to update project', 'error');
        }
      });
    } else {
      // Add via socket
      socket.emit('projects:add', {
        path: newPath,
        name: newName
      }, (response: any) => {
        if (response.success) {
          setModalOpen(false);
          setNewPath('');
          setNewName('');
          addToast('Project added!', 'success');
        } else {
          addToast(response.error || 'Failed to add project', 'error');
        }
      });
    }
  };

  const handleDelete = (id: string) => {
    if (!socket) return;

    socket.emit('projects:delete', { id }, (response: any) => {
      if (response.success) {
        addToast('Project removed', 'success');
      } else {
        addToast(response.error || 'Failed to delete project', 'error');
      }
    });
  };

  return (
    <div className="max-w-5xl mx-auto py-8">
      <header className="mb-12 flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
            <p className="text-secondary mt-2 max-w-lg">
                Manage the directories monitored by your external brain. Each project has its own timeline and memory events.
            </p>
        </div>
        
        <button 
          onClick={openAddModal}
          className="flex items-center gap-2 bg-gradient-to-br from-accent to-purple-600 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:shadow-lg hover:shadow-accent/20 transition-all active:scale-95"
        >
          <FolderPlus size={18} />
          <span>New Project</span>
        </button>
      </header>

      {loading && (
          <div className="flex items-center justify-center py-20 text-secondary gap-3">
              <div className="w-5 h-5 border-2 border-secondary/30 border-t-accent rounded-full animate-spin" />
              Loading projects...
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map(p => (
            <div key={p.id} className="group bg-card hover:bg-surface border border-border/40 hover:border-accent/40 rounded-2xl p-6 transition-all duration-300 relative overflow-hidden">
                {/* Decorative gradient blob */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-accent/5 rounded-full blur-3xl group-hover:bg-accent/10 transition-colors" />

                <div className="flex items-start justify-between mb-6 relative">
                    <div className="w-12 h-12 bg-background rounded-xl border border-border/50 flex items-center justify-center text-accent shadow-sm group-hover:scale-105 transition-transform">
                        <Folder size={24} strokeWidth={1.5} />
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                         <button 
                            onClick={() => openEditModal(p)}
                            className="p-2 text-secondary hover:text-white hover:bg-background rounded-lg transition-colors"
                            title="Edit path"
                         >
                            <Edit2 size={16} />
                         </button>
                         <button 
                            onClick={() => handleDelete(p.id)}
                            className="p-2 text-secondary hover:text-red-400 hover:bg-background rounded-lg transition-colors"
                            title="Remove project"
                         >
                            <Trash2 size={16} />
                         </button>
                    </div>
                </div>

                <div className="relative">
                    <h3 className="font-semibold text-lg text-primary mb-1">{p.name}</h3>
                    <p className="text-xs text-secondary font-mono truncate opacity-60 group-hover:opacity-100 transition-opacity">
                        {p.path}
                    </p>
                </div>

                <div className="mt-6 pt-4 border-t border-border/30 flex items-center justify-between text-xs text-secondary">
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-success"></div>
                        <span>Active</span>
                    </div>
                    <span>Last active: Today</span>
                </div>
            </div>
        ))}

        {!loading && projects.length === 0 && (
            <div className="col-span-full py-16 border-2 border-dashed border-border/40 rounded-2xl flex flex-col items-center justify-center text-secondary/60 hover:border-accent/30 hover:bg-card/30 transition-all cursor-pointer" onClick={openAddModal}>
                <FolderPlus size={48} className="mb-4 opacity-50" />
                <p className="font-medium">No projects yet</p>
                <p className="text-sm mt-1">Click here to start monitoring a folder</p>
            </div>
        )}
      </div>

     

      {/* Add/Edit Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-[#1c1c1f] border border-border rounded-2xl p-8 w-full max-w-lg shadow-2xl scale-100 animate-scale-in">
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h2 className="text-xl font-semibold tracking-tight">{editingProject ? 'Edit Project' : 'New Project'}</h2>
                        <p className="text-sm text-secondary mt-1">Connect a local directory to Memory Hub.</p>
                    </div>
                    <button onClick={() => setModalOpen(false)} className="text-secondary hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleSave}>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-medium text-secondary mb-2 uppercase tracking-wider">Project Name</label>
                            <div className="relative">
                                <Activity className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={16} />
                                <input 
                                    className="w-full bg-[#0e0e11] border border-border rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all placeholder:text-secondary/30 disabled:opacity-50"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    placeholder="e.g. Memory Hub"
                                    disabled={!!editingProject} 
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-secondary mb-2 uppercase tracking-wider">Absolute Path</label>
                            <div className="relative">
                                <Folder className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={16} />
                                <input 
                                    className="w-full bg-[#0e0e11] border border-border rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all placeholder:text-secondary/30"
                                    value={newPath}
                                    onChange={e => setNewPath(e.target.value)}
                                    placeholder="e.g. C:/Users/Dev/Values/Project"
                                    spellCheck={false}
                                />
                            </div>
                            <p className="text-[11px] text-secondary/60 mt-2 flex items-center gap-1">
                                <Play size={10} className="fill-current" />
                                A <code>memory.json</code> file will be created in this root.
                            </p>
                        </div>
                        <div className="pt-4 flex justify-end gap-3">
                            <button 
                                type="button" 
                                onClick={() => setModalOpen(false)}
                                className="px-5 py-2.5 rounded-full text-sm font-medium hover:bg-white/5 transition-colors text-secondary hover:text-white"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                className="bg-white text-black px-6 py-2.5 rounded-full text-sm font-bold hover:bg-gray-200 transition-colors shadow-lg shadow-white/10"
                            >
                                {editingProject ? 'Save Changes' : 'Start Monitoring'}
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
