
import React from 'react';
import { motion } from 'framer-motion';

interface StatsCardProps {
    title: string;
    value: string | number;
    trend?: {
        value: number;
        label: string;
        isPositive: boolean;
    };
    icon?: React.ReactNode;
    color?: string;
    onClick?: () => void;
}

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, trend, icon, color = "blue", onClick }) => {
    return (
        <motion.div 
            whileHover={{ y: -2 }}
            className={`p-6 rounded-2xl bg-[#1e1e1e]/50 border border-white/5 backdrop-blur-sm relative overflow-hidden group cursor-pointer transition-colors hover:border-white/10`}
            onClick={onClick}
        >
            <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-${color}-500`}>
                {icon}
            </div>
            
            <div className="relative z-10">
                <h3 className="text-sm font-medium text-gray-400 mb-1">{title}</h3>
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-white tracking-tight">{value}</span>
                    {trend && (
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            trend.isPositive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                            {trend.isPositive ? '+' : ''}{trend.value}%
                        </span>
                    )}
                </div>
                {trend && (
                    <p className="text-xs text-gray-500 mt-2">{trend.label}</p>
                )}
            </div>
        </motion.div>
    );
}
