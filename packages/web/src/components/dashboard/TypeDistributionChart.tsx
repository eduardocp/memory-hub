
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface DataPoint {
    type: string;
    count: number;
}

interface Props {
    data: DataPoint[];
}

const COLORS = {
  'note': '#8884d8', 
  'task_update': '#82ca9d', 
  'new_bug': '#ff8042', 
  'new_feat': '#00C49F',
  'idea': '#ffbb28',
  'git_commit': '#0088FE'
};

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1e1e1e] border border-white/10 p-2 rounded shadow-xl text-xs">
          <p className="text-white font-medium">{`${payload[0].name}`}</p>
          <p className="text-gray-400">{`Count: ${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
};

export const TypeDistributionChart: React.FC<Props> = ({ data }) => {
    const chartData = data.map(d => ({
        name: d.type.replace('_', ' '),
        value: d.count,
        type: d.type
    }));

    return (
        <div className="h-full w-full min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="35%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={60}
                        paddingAngle={5}
                        dataKey="value"
                    >
                         {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={(COLORS as any)[entry.type] || '#555'} stroke="none" />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                        layout="vertical" 
                        verticalAlign="middle" 
                        align="right"
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: '12px', color: '#999' }}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
};
