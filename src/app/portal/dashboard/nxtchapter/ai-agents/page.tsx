import Link from "next/link";
import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Mail, Phone, BarChart, Search, Receipt } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function AIAgentsPage() {
  const agents = [
    {
      id: "outbound-email",
      name: "Vance (Outbound Email)",
      href: "/portal/dashboard/nxtchapter/ai-agents/outbound-email",
      iconSrc: "/agents/vance.png",
      color: "bg-blue-100 dark:bg-blue-900/40 border-blue-200 dark:border-blue-800",
    },
    {
      id: "inbound-email",
      name: "Clara (Inbound Email)",
      href: "/portal/dashboard/nxtchapter/ai-agents/inbound-email",
      iconSrc: "/agents/clara.png",
      color: "bg-green-100 dark:bg-green-900/40 border-green-200 dark:border-green-800",
    },
    {
      id: "outbound-phone",
      name: "Dex (Outbound Phone)",
      href: "/portal/dashboard/nxtchapter/ai-agents/outbound-phone",
      iconSrc: "/agents/dex.png",
      color: "bg-purple-100 dark:bg-purple-900/40 border-purple-200 dark:border-purple-800",
    },
    {
      id: "analytics",
      name: "Aris (Analytic Agent)",
      href: "/portal/dashboard/nxtchapter/ai-agents/analytics",
      iconSrc: "/agents/aris.png",
      color: "bg-orange-100 dark:bg-orange-900/40 border-orange-200 dark:border-orange-800",
    },
    {
      id: "prospecting",
      name: "Piper (Prospecting)",
      href: "/portal/dashboard/nxtchapter/ai-agents/prospecting",
      iconSrc: "/agents/piper.png",
      color: "bg-pink-100 dark:bg-pink-900/40 border-pink-200 dark:border-pink-800",
    },
    {
      id: "billing",
      name: "Benji (Billing Specialist)",
      href: "/portal/dashboard/nxtchapter/ai-agents/billing",
      iconSrc: "/agents/benji.png",
      color: "bg-yellow-100 dark:bg-yellow-900/40 border-yellow-200 dark:border-yellow-800",
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-grow flex flex-col items-center pt-24 pb-12 px-4">
        <div className="w-full max-w-5xl">
          <div className="flex items-center mb-8 gap-4">
            <Button variant="outline" size="icon" asChild>
                <Link href="/portal/dashboard/nxtchapter">
                    <ArrowLeft className="w-4 h-4" />
                </Link>
            </Button>
            <h1 className="text-3xl font-bold">AI Agents Directory</h1>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <Link key={agent.id} href={agent.href} className="block group">
                <Card className={`h-full transition-all hover:shadow-lg border-2 hover:scale-[1.02] ${agent.color}`}>
                  <CardContent className="flex flex-col items-center justify-center p-8 h-56">
                    <div className="relative w-24 h-24 rounded-full mb-4 flex items-center justify-center shadow-inner overflow-hidden border-4 border-background">
                      <Image src={agent.iconSrc} alt={agent.name} fill className="object-cover" />
                      <Bot className="absolute bottom-2 right-2 w-6 h-6 text-foreground/50" />
                    </div>
                    <span className="font-bold text-lg text-center">{agent.name}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
