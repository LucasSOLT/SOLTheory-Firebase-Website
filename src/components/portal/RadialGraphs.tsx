"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Activity } from "lucide-react";
import { CollapsibleTile } from "@/components/ui/collapsible-tile";

const mockData1 = [
  { name: "Completed", value: 0, color: "#6366f1" },
  { name: "Remaining", value: 100, color: "#e0e7ff" },
];

const mockData2 = [
  { name: "Active", value: 0, color: "#10b981" },
  { name: "Inactive", value: 100, color: "#d1fae5" },
];

const mockData3 = [
  { name: "Positive", value: 0, color: "#d946ef" },
  { name: "Negative", value: 100, color: "#fae8ff" },
];

function RadialItem({ title, value, label, data, color }: { title: string, value: string, label: string, data: any[], color: string }) {
  return (
    <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-[#faf6ed] transition-colors">
      <div className="w-16 h-16 shrink-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={22}
              outerRadius={30}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              stroke="none"
              cornerRadius={4}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ display: 'none' }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[10px] font-bold" style={{ color }}>{data[0].value}%</span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-0.5">{title}</p>
        <p className="text-base font-bold text-slate-800 leading-none mb-1">{value}</p>
        <p className="text-[10px] text-slate-500 truncate">{label}</p>
      </div>
    </div>
  );
}

export function RadialGraphs() {
  return (
    <CollapsibleTile id="radial-graphs" title="Performance" icon={<Activity className="w-4 h-4" />} className="w-full h-full min-h-[300px] p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
          <Activity className="w-4 h-4 text-emerald-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Performance</h3>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">System health metrics</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-around gap-2">
        <RadialItem 
          title="Task Completion" 
          value="0" 
          label="Automated actions today" 
          data={mockData1} 
          color="#6366f1" 
        />
        <div className="h-px w-full bg-[#faf6ed]" />
        <RadialItem 
          title="Agent Activity" 
          value="0 hrs" 
          label="Total active time" 
          data={mockData2} 
          color="#10b981" 
        />
        <div className="h-px w-full bg-[#faf6ed]" />
        <RadialItem 
          title="Client Sentiment" 
          value="N/A" 
          label="Based on latest interactions" 
          data={mockData3} 
          color="#d946ef" 
        />
      </div>
    </CollapsibleTile>
  );
}
