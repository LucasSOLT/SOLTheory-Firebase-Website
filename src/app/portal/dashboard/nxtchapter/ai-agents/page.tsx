import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Mail, Phone, BarChart, Search, Receipt } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NxtChapterAIAgentsPage() {
  const agents = [
    {
      id: "morpheus",
      name: "Morpheus",
      role: "Email Agent",
      href: "/portal/dashboard/nxtchapter/ai-agents/morpheus",
      iconSrc: "/agents/dex.png",
      color: "bg-white border-slate-200 group-hover:border-blue-400 group-hover:ring-1 group-hover:ring-blue-400",
      glow: "group-hover:shadow-lg group-hover:shadow-blue-100/50",
      accent: "text-blue-600",
      badge: "bg-blue-50 text-blue-600 border-blue-200",
    }
  ];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 h-full overflow-y-auto pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-100 mb-8">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="border-slate-200 bg-white hover:bg-slate-50 text-slate-600" asChild>
              <Link href="/portal/dashboard/nxtchapter">
                  <ArrowLeft className="w-4 h-4" />
              </Link>
          </Button>
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
              Agent <span className="text-blue-600">Directory</span>
            </h1>
            <p className="text-slate-500 text-base max-w-2xl font-medium mt-1">
              Access your rehabilitation artificial intelligence units.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {agents.map((agent) => (
          <Link key={agent.id} href={agent.href} className="block group">
            <div className={`h-full rounded-2xl transition-all duration-500 border hover:-translate-y-2 ${agent.glow} overflow-hidden bg-white shadow-sm ${agent.color} relative`}>
              <div className="relative z-10 flex flex-col items-center p-8 pt-10">
                <div className="relative w-32 h-32 mb-6 rounded-full flex items-center justify-center shadow-inner overflow-hidden border-4 border-slate-50 group-hover:scale-105 transition-transform duration-500">
                  <Image src={agent.iconSrc} alt={agent.name} fill className="object-cover" />
                  <Bot className="absolute bottom-2 right-2 w-6 h-6 text-slate-900/50" />
                </div>
                <span className="font-extrabold text-2xl text-center text-slate-900 tracking-tight">{agent.name}</span>
                <span className={`mt-2 px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full border ${agent.badge}`}>
                  {agent.role}
                </span>
                <div className="mt-5 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full bg-current ${agent.accent} animate-pulse`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${agent.accent}`}>Online</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
