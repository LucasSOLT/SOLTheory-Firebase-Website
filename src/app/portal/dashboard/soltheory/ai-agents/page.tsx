import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

// --- Inline SVG Robot Avatars — unique per agent ---



const MorpheusRobot = () => (
  <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Body */}
    <rect x="28" y="58" width="64" height="44" rx="10" fill="#0f172a" />
    {/* Headset cable */}
    <path d="M24 34 Q10 34 10 55 Q10 72 22 72" stroke="#38bdf8" strokeWidth="3" fill="none" strokeLinecap="round" />
    <path d="M96 34 Q110 34 110 55 Q110 72 98 72" stroke="#38bdf8" strokeWidth="3" fill="none" strokeLinecap="round" />
    {/* Headset ear cups */}
    <rect x="8" y="54" width="16" height="20" rx="8" fill="#0f172a" />
    <rect x="96" y="54" width="16" height="20" rx="8" fill="#0f172a" />
    {/* Microphone boom */}
    <path d="M16 74 Q12 84 20 86" stroke="#38bdf8" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <circle cx="20" cy="87" r="3" fill="#0ea5e9" />
    {/* Arms */}
    <rect x="10" y="66" width="18" height="8" rx="4" fill="#1e293b" />
    <rect x="92" y="66" width="18" height="8" rx="4" fill="#1e293b" />
    {/* Hands */}
    <circle cx="9" cy="73" r="7" fill="#0ea5e9" />
    <circle cx="111" cy="73" r="7" fill="#0ea5e9" />
    {/* Neck */}
    <rect x="52" y="46" width="16" height="14" rx="4" fill="#38bdf8" />
    {/* Headset band */}
    <path d="M28 32 Q60 10 92 32" stroke="#1e293b" strokeWidth="8" fill="none" strokeLinecap="round" />
    {/* Head */}
    <rect x="26" y="14" width="68" height="40" rx="12" fill="#1e293b" />
    {/* Visor */}
    <rect x="32" y="20" width="56" height="24" rx="7" fill="#020617" />
    <rect x="34" y="22" width="52" height="20" rx="5" fill="#0f172a" />
    {/* Eyes — cool blue */}
    <polygon points="38,32 46,27 54,32 46,37" fill="#38bdf8" />
    <polygon points="38,32 46,27 54,32 46,37" fill="#0ea5e9" opacity="0.6" />
    <circle cx="46" cy="32" r="3" fill="#bae6fd" />
    <polygon points="66,32 74,27 82,32 74,37" fill="#38bdf8" />
    <circle cx="74" cy="32" r="3" fill="#bae6fd" />
    {/* Coolface */}
    <path d="M43 44 L50 40 L60 46 L70 40 L77 44" stroke="#e0f2fe" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    {/* Antenna */}
    <rect x="57" y="5" width="6" height="11" rx="3" fill="#38bdf8" />
    <rect x="53" y="3" width="14" height="5" rx="2.5" fill="#7dd3fc" />
    {/* Ear bolts */}
    <circle cx="26" cy="32" r="5" fill="#0f172a" />
    <circle cx="94" cy="32" r="5" fill="#0f172a" />
    {/* Chest panel */}
    <rect x="38" y="68" width="44" height="24" rx="6" fill="#020617" />
    <rect x="42" y="72" width="10" height="8" rx="2" fill="#0ea5e9" />
    <rect x="55" y="72" width="10" height="8" rx="2" fill="#38bdf8" />
    <rect x="68" y="72" width="10" height="8" rx="2" fill="#7dd3fc" />
    <rect x="42" y="83" width="36" height="5" rx="2" fill="#1e293b" />
  </svg>
);

export default function SolTheoryAIAgentsPage() {
  const agents = [
    {
      id: "morpheus",
      name: "Morpheus",
      role: "Email Agent",
      href: "/portal/dashboard/soltheory/ai-agents/morpheus",
      Robot: MorpheusRobot,
      color: "border-slate-200 group-hover:border-blue-400 group-hover:ring-1 group-hover:ring-blue-400",
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
              <Link href="/portal/dashboard/soltheory">
                  <ArrowLeft className="w-4 h-4" />
              </Link>
          </Button>
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
              Agent <span className="text-blue-600">Hub</span>
            </h1>
            <p className="text-slate-500 text-base max-w-2xl font-medium mt-1">
              Access your global fleet of specialized artificial intelligence units.
            </p>
          </div>
        </div>
      </div>
          
      {/* 3-column centered grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {agents.map(({ id, name, role, href, Robot, color, glow, accent, badge }) => (
          <Link key={id} href={href} className="block group">
            <div className={`h-full rounded-2xl transition-all duration-500 border hover:-translate-y-2 ${glow} overflow-hidden bg-white shadow-sm ${color} relative`}>
              <div className="relative z-10 flex flex-col items-center p-8 pt-10">
                {/* Robot Avatar */}
                <div className="w-32 h-32 mb-6 group-hover:scale-105 transition-transform duration-500 drop-shadow-md">
                  <Robot />
                </div>
                {/* Name + Role */}
                <span className="font-extrabold text-2xl text-center text-slate-900 tracking-tight">{name}</span>
                <span className={`mt-2 px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full border ${badge}`}>
                  {role}
                </span>
                {/* Status dot */}
                <div className="mt-5 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full bg-current ${accent} animate-pulse`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${accent}`}>Online</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
