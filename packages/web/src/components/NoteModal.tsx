import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSocket } from '../context/SocketContext';
import { useToast } from './Toast';
import { noteSchema } from '../shared/schemas';
import type { NoteFormData } from '../shared/schemas';
import type { Project } from '../domain/models';
import { NOTE_TYPES } from '../shared/constants';

interface NoteModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function NoteModal({ isOpen, onClose }: NoteModalProps) {
    const { socket } = useSocket();
    const { addToast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);

    const { 
        register, 
        handleSubmit, 
        reset,
        setValue,
        watch,
        formState: { errors } 
    } = useForm<NoteFormData>({
        resolver: zodResolver(noteSchema as any),
        defaultValues: {
            type: 'note',
            text: ''
        }
    });

    const watchedProject = watch('project');

    // Fetch projects when modal opens
    useEffect(() => {
        if (!socket || !isOpen) return;
        
        socket.emit('projects:list', (response: any) => {
            if (response.success) {
                setProjects(response.data);
            }
        });
    }, [socket, isOpen]);

    // Set default project when projects load
    useEffect(() => {
        if (projects.length > 0 && !watchedProject) {
            setValue('project', projects[0].name);
        }
    }, [projects, watchedProject, setValue]);

    const onSubmit = (data: NoteFormData) => {
        if (!socket) return;

        socket.emit('events:add', {
            text: data.text,
            type: data.type,
            project: data.project
        }, (response: any) => {
            if (response.success) {
                onClose();
                reset();
                // Re-set default project
                if (projects.length > 0) setValue('project', projects[0].name);
                addToast('Note added successfully!', 'success');
            } else {
                addToast(response.error || 'Failed to add note', 'error');
            }
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-semibold">Add New Memory</h2>
                    <button onClick={onClose} className="text-secondary hover:text-white">
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-secondary mb-1">Project</label>
                            <select 
                                {...register('project')}
                                className={clsx(
                                    "w-full bg-background border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent",
                                    errors.project ? "border-red-500/50 focus:border-red-500" : "border-border"
                                )}
                            >
                                <option value="" disabled>Select a project</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.name}>{p.name}</option>
                                ))}
                            </select>
                            {errors.project && <span className="text-red-400 text-xs mt-1 block">{errors.project.message}</span>}
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-secondary mb-1">Type</label>
                            <select 
                                {...register('type')}
                                className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent"
                            >
                                {NOTE_TYPES.map(type => (
                                    <option key={type.value} value={type.value}>{type.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-secondary mb-1">Content</label>
                            <textarea 
                                {...register('text')}
                                className={clsx(
                                    "w-full bg-background border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent min-h-[100px]",
                                    errors.text ? "border-red-500/50 focus:border-red-500" : "border-border"
                                )}
                                placeholder="What's on your mind?"
                                autoFocus
                            />
                            {errors.text && <span className="text-red-400 text-xs mt-1 block">{errors.text.message}</span>}
                        </div>
                        <div className="pt-2 flex justify-end gap-2">
                            <button 
                                type="button" 
                                onClick={onClose}
                                className="px-4 py-2 rounded text-sm font-medium text-secondary hover:text-white"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                className="bg-white text-black px-4 py-2 rounded text-sm font-medium hover:bg-gray-200"
                            >
                                Add Memory
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
