import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import clsx from 'clsx';

interface Option {
    label: string;
    value: string;
}

interface SelectProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    options: Option[];
    placeholder?: string;
    error?: string;
    className?: string;
}

export function Select({ label, value, onChange, options, placeholder, error, className }: SelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(o => o.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={clsx("relative", className)} ref={containerRef}>
            {label && <label className="block text-xs font-medium text-secondary mb-1">{label}</label>}
            
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={clsx(
                    "w-full flex items-center justify-between bg-black/20 border rounded-lg px-4 py-2 text-sm outline-none transition-all",
                    error ? "border-red-500 focus:border-red-500" : "border-white/10 focus:border-accent hover:border-white/20",
                    isOpen && "border-accent ring-1 ring-accent"
                )}
            >
                <span className={clsx(!selectedOption && "text-secondary", "text-white")}>
                    {selectedOption ? selectedOption.label : placeholder || "Select..."}
                </span>
                <ChevronDown size={16} className={clsx("text-secondary transition-transform", isOpen && "rotate-180")} />
            </button>

            {error && <p className="text-red-400 text-xs mt-1">{error}</p>}

            {isOpen && (
                <div className="absolute z-[100] w-full mt-1 bg-[#1c1c1f] border border-border rounded-lg shadow-xl animate-in fade-in zoom-in-95 duration-100 max-h-60 overflow-y-auto">
                    <div className="py-1">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                className={clsx(
                                    "w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-white/5 transition-colors",
                                    option.value === value ? "text-accent bg-accent/5 font-medium" : "text-primary"
                                )}
                            >
                                {option.label}
                                {option.value === value && <Check size={14} />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
