
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
    Activity, 
    Flame, 
    Zap, 
    Briefcase 
} from 'lucide-react';
import { StatsCard } from '../components/dashboard/StatsCard';
import { ActivityHeatmap } from '../components/dashboard/ActivityHeatmap';
import { TypeDistributionChart } from '../components/dashboard/TypeDistributionChart';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const DashboardPage: React.FC = () => {
    // We could move these fetches to a service, but keeping here for speed/simplicity as requested
    const { data: stats } = useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: async () => {
            const res = await axios.get(`${API_URL}/api/analytics/stats?range=week`);
            return res.data;
        }
    });

    const { data: heatmap } = useQuery({
        queryKey: ['dashboard-heatmap'],
        queryFn: async () => {
            const res = await axios.get(`${API_URL}/api/analytics/heatmap`);
            return res.data;
        }
    });

    const { data: distribution } = useQuery({
        queryKey: ['dashboard-distribution'],
        queryFn: async () => {
            const res = await axios.get(`${API_URL}/api/analytics/distribution?range=month`);
            return res.data;
        }
    });

    const welcomeMessages = [
        "Welcome back, Commander. 🚀",
        "Ready to build the future? ✨",
        "Let's make today count. 🔥",
        "Your memory hub is ready. 🧠"
    ];
    const [welcomeMessage] = useState(() => welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)]);

    return (
        <div className="p-8 h-full overflow-y-auto">
            <header className="mb-8">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent inline-block">
                        Dashboard
                    </h1>
                    <p className="text-gray-400 mt-2 text-lg">{welcomeMessage}</p>
                </motion.div>
            </header>

            {/* Main Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* 1. Hero/Summary Stats */}
                <StatsCard 
                    title="Events this Week" 
                    value={stats?.totalEvents || 0}
                    icon={<Zap size={24} />}
                    color="purple"
                    trend={{ value: 12, label: "vs last week", isPositive: true }} // Mock trend for now
                />
                
                <StatsCard 
                    title="Current Streak" 
                    value={`${stats?.streak || 0} days`}
                    icon={<Flame size={24} />}
                    color="orange"
                />

                <StatsCard 
                    title="Top Project" 
                    value={stats?.topProject?.name || "None"}
                    icon={<Briefcase size={24} />}
                    color="blue"
                />

                 <StatsCard 
                    title="Focus Score" 
                    value="85%" // Placeholder for future feature
                    icon={<Activity size={24} />}
                    color="green"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 2. Activity Heatmap (Spans 2 cols) */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="lg:col-span-2 p-6 rounded-2xl bg-[#1e1e1e]/50 border border-white/5 backdrop-blur-sm"
                >
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-medium text-white">Activity Flow</h3>
                        <div className="flex gap-2">
                            {/* Legend could go here */}
                        </div>
                    </div>
                    {heatmap && <ActivityHeatmap data={heatmap} />}
                </motion.div>

                {/* 3. Type Distribution */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="p-6 rounded-2xl bg-[#1e1e1e]/50 border border-white/5 backdrop-blur-sm flex flex-col"
                >
                    <h3 className="text-lg font-medium text-white mb-4">Focus Distribution (30d)</h3>
                    <div className="flex-1 min-h-[250px]">
                        {distribution && <TypeDistributionChart data={distribution} />}
                    </div>
                </motion.div>
            </div>
            
             {/* 4. Recent Activity Summary (Bottom Row) */}
             {/* Placeholder for future expansion */}
        </div>
    );
};
