import { useState, useEffect, useRef } from 'react';
import { Play, Pause, CheckCircle, RotateCcw, Minimize2 } from 'lucide-react';
import clsx from 'clsx';
import { useSocket } from '../context/SocketContext';
import { useToast, ToastContainer } from '../components/Toast';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Select } from '../components/Select';

const focusSchema = z.object({
    task: z.string().min(1, "What are you working on?"),
    project: z.string().min(1, "Project is required")
});

type FocusFormData = z.infer<typeof focusSchema>;

export function FocusPage() {
    const [isRunning, setIsRunning] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const [projects, setProjects] = useState<{name: string}[]>([]); 
    
    // UI State
    const [isFinished, setIsFinished] = useState(false);

    const { socket } = useSocket();
    const { toasts, addToast, removeToast } = useToast();
    const navigate = useNavigate();
    const timerRef = useRef<number | undefined>(undefined);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors }
    } = useForm<FocusFormData>({
        resolver: zodResolver(focusSchema as any),
        defaultValues: {
            task: '',
            project: ''
        }
    });

    const watchedProject = watch('project');

    // Load projects
    useEffect(() => {
        if (!socket) return;
        socket.emit('projects:list', (res: any) => {
            if (res.success) {
                setProjects(res.data);
                if (res.data.length > 0) setValue('project', res.data[0].name);
            }
        });
    }, [socket, setValue]);

    // Timer Logic
    useEffect(() => {
        if (isRunning) {
            timerRef.current = setInterval(() => {
                setSeconds(s => s + 1);
            }, 1000) as unknown as number;
        } else {
            if (timerRef.current !== undefined) clearInterval(timerRef.current);
        }
        return () => { if (timerRef.current !== undefined) clearInterval(timerRef.current); };
    }, [isRunning]);

    // Format HH:MM:SS
    const formatTime = (totalSeconds: number) => {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleFinish = () => {
        setIsRunning(false);
        setIsFinished(true);
    };

    const onSubmit = (data: FocusFormData) => {
        if (!socket) return;
        
        // Clean text: "Task Name (45m)"
        // Calculate minutes nicely
        const minutes = Math.ceil(seconds / 60);
        const timeTag = minutes < 60 ? `${minutes}m` : `${(minutes/60).toFixed(1)}h`;
        
        const finalContent = `${data.task} (Focus: ${timeTag})`;

        socket.emit('events:add', {
            project: data.project,
            type: 'task_update',
            text: finalContent,
            source: 'user'
        }, (res: any) => {
            if (res.success) {
                addToast('Focus session logged!', 'success');
                // Reset
                setSeconds(0);
                setIsFinished(false);
                setValue('task', '');
                // Keep project as is
            } else {
                addToast('Failed to save session', 'error');
            }
        });
    };

    const handleDiscard = () => {
        setIsFinished(false);
        setSeconds(0);
        setIsRunning(false);
        reset({
            task: '',
            project: watchedProject // Keep selected project
        });
    };

    return (
        <div className="h-screen w-screen bg-[#0e0e11] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden select-none">
            
            {/* Background Pulse Effect */}
            <div className={clsx(
                "absolute inset-0 bg-accent/5 rounded-full blur-3xl transition-all duration-[2000ms]",
                isRunning ? "scale-150 opacity-100 animate-pulse" : "scale-50 opacity-0"
            )} />

            {/* Header Controls */}
            <div className="absolute top-4 right-4 flex gap-2 z-10">
                 <button onClick={() => navigate('/')} className="p-2 text-secondary hover:text-white transition-colors">
                    <Minimize2 size={18} />
                 </button>
            </div>

            {/* Main HUD */}
            <div className="z-10 w-full max-w-md flex flex-col items-center gap-8">
                
                {/* Timer Display */}
                <div className="relative">
                    <div className={clsx(
                        "text-7xl font-mono font-bold tracking-tighter transition-colors",
                        isRunning ? "text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]" : "text-secondary"
                    )}>
                        {formatTime(seconds)}
                    </div>
                </div>

                {/* Task Input */}
                <div className="w-full">
                    {!isFinished ? (
                        <div className="flex flex-col items-center">
                             <input 
                                {...register('task')}
                                placeholder="What are you working on?"
                                className="w-full bg-transparent text-center text-xl placeholder:text-secondary/30 focus:outline-none border-b border-white/10 focus:border-accent pb-2 transition-all font-medium"
                                disabled={isFinished} 
                             />
                             {errors.task && <span className="text-red-400 text-xs mt-2">{errors.task.message}</span>}
                        </div>
                    ) : (
                         <div className="text-center animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-2xl font-bold text-green-400 mb-1">Session Complete</h2>
                            <p className="text-secondary text-sm">Log this to {watchedProject}?</p>
                         </div>
                    )}
                </div>

                {/* Project Selector (Subtle) */}
                {!isFinished && (
                    <div className="w-full max-w-xs">
                        <Select
                            value={watchedProject || ''}
                            onChange={(val) => setValue('project', val)}
                            options={projects.map(p => ({ label: p.name, value: p.name }))}
                            placeholder="Select Project"
                        />
                    </div>
                )}

                {/* Controls */}
                <div className="flex items-center gap-6 mt-4">
                    {!isFinished ? (
                        <>
                            {isRunning ? (
                                <button 
                                    onClick={() => setIsRunning(false)}
                                    className="w-16 h-16 rounded-full bg-surface border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all hover:scale-105"
                                >
                                    <Pause size={28} className="fill-current" />
                                </button>
                            ) : (
                                <button 
                                    onClick={() => setIsRunning(true)}
                                    className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:bg-gray-200 transition-all hover:scale-105 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                                >
                                    <Play size={28} className="ml-1 fill-current" />
                                </button>
                            )}

                            {(seconds > 0 && !isRunning) && (
                                <button 
                                    onClick={handleFinish}
                                    className="w-12 h-12 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 flex items-center justify-center hover:bg-green-500/30 transition-all hover:scale-105"
                                    title="Finish & Log"
                                >
                                    <CheckCircle size={20} />
                                </button>
                            )}
                             {(seconds > 0 && !isRunning) && (
                                <button 
                                    onClick={handleDiscard}
                                    className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center hover:bg-red-500/20 transition-all hover:scale-105"
                                    title="Discard Timer"
                                >
                                    <RotateCcw size={20} />
                                </button>
                            )}
                        </>
                    ) : (
                        <div className="flex gap-4">
                            <button 
                                onClick={handleDiscard}
                                className="px-6 py-2 rounded-lg border border-white/10 text-secondary hover:text-white hover:bg-white/5 transition-colors"
                            >
                                Discard
                            </button>
                            <button 
                                onClick={handleSubmit(onSubmit)}
                                className="px-6 py-2 rounded-lg bg-green-500 text-black font-bold hover:bg-green-400 shadow-lg shadow-green-500/20 transition-all"
                            >
                                Save to Memory
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </div>
    );
}
