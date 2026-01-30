
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

interface HeatmapData {
    date: string;
    count: number;
    topType: string | null;
}

interface Props {
    data: HeatmapData[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const ActivityHeatmap: React.FC<Props> = ({ data }) => {
    // Determine the last 365 days or so
    const { weeks, monthLabels } = useMemo(() => {
        const today = new Date();
        const endDate = new Date(today);
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 364); // roughly 1 year

        // Normalize data for easy lookup
        const dataMap = new Map(data.map(d => [d.date, d]));

        const weeksArr = [];
        const monthLabelsArr: { month: string, index: number }[] = [];

        let currentWeek = [];
        let tempDate = new Date(startDate);
        
        // Align start date to Sunday for proper calendar view
        while (tempDate.getDay() !== 0) {
            tempDate.setDate(tempDate.getDate() - 1);
        }

        while (tempDate <= endDate || tempDate.getDay() !== 0) {
            const dateStr = tempDate.toISOString().split('T')[0];
            const info = dataMap.get(dateStr);
            
            // Check for month label placement
            if (currentWeek.length === 0) {
                 const checkDate = new Date(tempDate);
                 let foundMonthStart = -1;
                 
                 // Look ahead 7 days to see if this week contains the 1st of a month
                 for(let i=0; i<7; i++) {
                     if (checkDate.getDate() === 1) {
                         foundMonthStart = checkDate.getMonth();
                         break;
                     }
                     checkDate.setDate(checkDate.getDate() + 1);
                 }
                 
                 // If it's the very first week, show the current month label
                 if (weeksArr.length === 0) {
                     const firstDayMonth = tempDate.getMonth();
                     monthLabelsArr.push({ month: MONTHS[firstDayMonth], index: 0 });
                 } 
                 // Otherwise, if we found a month start (day 1), add label
                 else if (foundMonthStart !== -1) {
                     monthLabelsArr.push({ month: MONTHS[foundMonthStart], index: weeksArr.length });
                 }
            }

            currentWeek.push({
                date: dateStr,
                count: info?.count || 0,
                // topType ignored in classic view
            });

            if (currentWeek.length === 7) {
                weeksArr.push(currentWeek);
                currentWeek = [];
            }
            tempDate.setDate(tempDate.getDate() + 1);
        }
        
        if (currentWeek.length > 0) {
            weeksArr.push(currentWeek);
        }

        return { weeks: weeksArr, monthLabels: monthLabelsArr };
    }, [data]);

    return (
        <div className="flex flex-col gap-2 w-full overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10">
            <div className="flex">
                {/* Day Labels Column */}
                <div className="flex flex-col gap-1 mr-2 mt-[19px] text-[9px] text-gray-500">
                    <div className="h-2.5 leading-[10px] opacity-0">Sun</div>
                    <div className="h-2.5 leading-[10px]">Mon</div>
                    <div className="h-2.5 leading-[10px] opacity-0">Tue</div>
                    <div className="h-2.5 leading-[10px]">Wed</div>
                    <div className="h-2.5 leading-[10px] opacity-0">Thu</div>
                    <div className="h-2.5 leading-[10px]">Fri</div>
                    <div className="h-2.5 leading-[10px] opacity-0">Sat</div>
                </div>

                {/* Grid Container */}
                <div className="flex flex-col">
                    {/* Month Labels Row */}
                    <div className="flex mb-1 h-4 relative">
                         {monthLabels.map((label, i) => (
                             <div 
                                key={i} 
                                className="absolute text-[10px] text-gray-500"
                                style={{ left: `${label.index * 14}px` }} 
                             >
                                 {label.month}
                             </div>
                         ))}
                    </div>

                    {/* Heatmap Grid */}
                    <div className="flex gap-1 min-w-max">
                        {weeks.map((week, wIndex) => (
                            <div key={wIndex} className="flex flex-col gap-1">
                                {week.map((day) => {
                                    // Classic GitHub-style intensity logic
                                    let colorClass = 'bg-gray-800'; // default empty
                                    if (day.count > 0) {
                                        if (day.count <= 2) colorClass = 'bg-green-900';
                                        else if (day.count <= 5) colorClass = 'bg-green-700';
                                        else if (day.count <= 9) colorClass = 'bg-green-500';
                                        else colorClass = 'bg-green-400';
                                    }

                                    return (
                                        <motion.div 
                                            key={day.date}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: wIndex * 0.01 }}
                                            className={`w-2.5 h-2.5 rounded-[2px] ${colorClass}`}
                                            title={`${day.date}: ${day.count} contributions`}
                                        />
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Classic Legend Footer */}
            <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-2 pl-8 justify-end">
                <span>Less</span>
                <div className="flex gap-1">
                    <div className="w-2.5 h-2.5 rounded-[2px] bg-gray-800" />
                    <div className="w-2.5 h-2.5 rounded-[2px] bg-green-900" />
                    <div className="w-2.5 h-2.5 rounded-[2px] bg-green-700" />
                    <div className="w-2.5 h-2.5 rounded-[2px] bg-green-500" />
                    <div className="w-2.5 h-2.5 rounded-[2px] bg-green-400" />
                </div>
                <span>More</span>
            </div>
        </div>
    );
};
