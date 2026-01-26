import { useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

let toastId = 0;

export function useToast() {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = `toast-${toastId++}`;
        setToasts(prev => [...prev, { id, message, type }]);

        // Auto-remove after 4 seconds
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return { toasts, addToast, removeToast };
}

interface ToastContainerProps {
    toasts: Toast[];
    removeToast: (id: string) => void;
}

export function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
    if (toasts.length === 0) return null;

    const getIcon = (type: ToastType) => {
        switch (type) {
            case 'success': return <CheckCircle size={18} className="text-success" />;
            case 'error': return <AlertCircle size={18} className="text-error" />;
            default: return <Info size={18} className="text-accent" />;
        }
    };

    const getBorderColor = (type: ToastType) => {
        switch (type) {
            case 'success': return 'border-success/50';
            case 'error': return 'border-error/50';
            default: return 'border-accent/50';
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
            {toasts.map(toast => (
                <div 
                    key={toast.id} 
                    className={`bg-card border ${getBorderColor(toast.type)} rounded-lg p-4 shadow-lg flex items-center gap-3 min-w-[300px] max-w-[400px] animate-slide-in`}
                >
                    {getIcon(toast.type)}
                    <p className="text-sm text-gray-200 flex-1">{toast.message}</p>
                    <button 
                        onClick={() => removeToast(toast.id)} 
                        className="text-secondary hover:text-white transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>
            ))}
        </div>
    );
}
