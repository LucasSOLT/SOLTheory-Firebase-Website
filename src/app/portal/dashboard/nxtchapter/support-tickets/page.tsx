import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Ticket, Plus, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function SupportTicketsPage() {
  const tickets = [
    { id: "T-892", title: "Cannot access reporting dashboard", date: "2 hours ago", status: "Open", priority: "High" },
    { id: "T-890", title: "Update participant housing status", date: "Yesterday", status: "In Progress", priority: "Medium" },
    { id: "T-885", title: "Requesting new AI agent capabilities", date: "Oct 24, 2026", status: "Resolved", priority: "Low" },
    { id: "T-881", title: "Data export error on Safari", date: "Oct 22, 2026", status: "Resolved", priority: "Medium" },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Open": return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case "In Progress": return <Clock className="w-4 h-4 text-blue-400" />;
      case "Resolved": return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      default: return null;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "High": return <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/20">High</Badge>;
      case "Medium": return <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-amber-500/20">Medium</Badge>;
      case "Low": return <Badge variant="outline" className="border-slate-700 text-slate-400">Low</Badge>;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-900 text-slate-200">
      <Header />
      <main className="flex-grow py-8 px-4 md:px-8">
        <div className="w-full max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/portal/dashboard/nxtchapter" className="p-2 hover:bg-slate-800 rounded-md transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-3xl font-bold text-white">Support Tickets</h1>
            </div>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" /> New Ticket
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
             <Card className="bg-slate-800/60 border-slate-800">
              <CardContent className="p-6 flex flex-col items-center justify-center gap-2">
                <Ticket className="w-8 h-8 text-blue-400" />
                <span className="text-2xl font-bold text-white">4</span>
                <span className="text-sm text-slate-400">Total Tickets</span>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/60 border-slate-800">
              <CardContent className="p-6 flex flex-col items-center justify-center gap-2">
                <AlertCircle className="w-8 h-8 text-amber-500" />
                <span className="text-2xl font-bold text-white">1</span>
                <span className="text-sm text-slate-400">Open Tickets</span>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/60 border-slate-800">
              <CardContent className="p-6 flex flex-col items-center justify-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                <span className="text-2xl font-bold text-white">2</span>
                <span className="text-sm text-slate-400">Resolved</span>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/60 border-slate-800">
              <CardContent className="p-6 flex flex-col items-center justify-center gap-2">
                <Clock className="w-8 h-8 text-slate-400" />
                <span className="text-2xl font-bold text-white">1.2h</span>
                <span className="text-sm text-slate-400">Avg Response Time</span>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-slate-800/60 border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg text-white">Recent Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tickets.map((ticket) => (
                  <div key={ticket.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg bg-slate-800/30 border border-slate-800 hover:border-slate-700 transition-colors gap-4">
                    <div className="flex items-start gap-4">
                      <div className="mt-1">{getStatusIcon(ticket.status)}</div>
                      <div>
                        <h3 className="font-semibold text-white">{ticket.title}</h3>
                        <p className="text-sm text-slate-400">
                          {ticket.id} • Opened {ticket.date}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                      <span className="text-sm text-slate-400 whitespace-nowrap">{ticket.status}</span>
                      {getPriorityBadge(ticket.priority)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
