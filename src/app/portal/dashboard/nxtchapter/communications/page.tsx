"use client";

import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Users, Activity, X, FileText } from "lucide-react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type FeedItem = {
  user: string;
  action: string;
  time: string;
  details?: string;
};

type ChatMessage = {
  text: string;
  sender: string;
  time: string;
  isSelf: boolean;
};

const LIVE_EVENTS: FeedItem[] = [
  { user: "Case Worker Jenkins", action: "logged a new transition plan", time: "Just now", details: "Transition plan ID: TP-1049. Focus areas include housing stability and job readiness." },
  { user: "System", action: "generated weekly outcome report", time: "2 mins ago", details: "Automated report summarizing key performance indicators across all transition programs." },
  { user: "Shelter Outreach Team", action: "completed 15 assessments", time: "15 mins ago", details: "Initial intake assessments conducted at Downtown Shelter Location." },
  { user: "Admin", action: "updated policy guidelines document", time: "1 hour ago", details: "Revisions made to section 4.2 regarding participant confidentiality." },
  { user: "Volunteer Smith", action: "checked in 5 participants", time: "1.5 hours ago", details: "Participants successfully arrived for the afternoon skill-building workshop." },
];

const INITIAL_CHAT = [
  { text: "Are we still doing the orientation at 2?", sender: "S. Jenkins", time: "1:15 PM", isSelf: false },
  { text: "Yes, room B is set up.", sender: "You", time: "1:18 PM", isSelf: true },
  { text: "Great, I'll bring the new intake forms.", sender: "S. Jenkins", time: "1:20 PM", isSelf: false },
];

export default function CommunicationsPage() {
  const [feed, setFeed] = useState<FeedItem[]>(LIVE_EVENTS);
  const [chat, setChat] = useState<ChatMessage[]>(INITIAL_CHAT);
  const [newMessage, setNewMessage] = useState("");
  const [selectedFeedItem, setSelectedFeedItem] = useState<FeedItem | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  useEffect(() => {
    const interval = setInterval(() => {
      const actions = ["updated a profile", "approved a housing application", "uploaded a document", "completed a training module"];
      const users = ["Coordinator Lee", "Case Worker Davis", "Director Miller", "System"];
      
      const newEvent: FeedItem = {
        user: users[Math.floor(Math.random() * users.length)],
        action: actions[Math.floor(Math.random() * actions.length)],
        time: "Just now",
        details: "This is a system-generated live event placeholder. In a production environment, this would contain specific metadata regarding the action taken."
      };

      setFeed(prev => [newEvent, ...prev.slice(0, 9)]);
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    
    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChat(prev => [...prev, { text: newMessage, sender: "You", time: timeString, isSelf: true }]);
    setNewMessage("");

    // Simulate a reply after 2 seconds
    setTimeout(() => {
      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setChat(prev => [...prev, { text: "Got it, thanks!", sender: "S. Jenkins", time: replyTime, isSelf: false }]);
    }, 2000);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-900 text-slate-200">
      <Header />
      <main className="flex-grow py-8 pt-24 px-4 md:px-8 relative">
        <div className="w-full max-w-6xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Link href="/portal/dashboard/nxtchapter" className="p-2 hover:bg-slate-800 rounded-md transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-3xl font-bold text-white">Communications & Feed</h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            <div className="lg:col-span-1 xl:col-span-2 space-y-6">
              <Card className="bg-slate-800/60 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-lg text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-400" />
                    Organization Live Feed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {feed.map((item, idx) => (
                      <button 
                        key={idx} 
                        onClick={() => setSelectedFeedItem(item)}
                        className="w-full flex gap-4 text-left p-3 rounded-xl hover:bg-slate-800/80 transition-colors border border-transparent hover:border-slate-700 animate-in fade-in slide-in-from-top-2 duration-500 max-h-24 overflow-hidden"
                      >
                        <Avatar className="w-10 h-10 border border-slate-700 shrink-0">
                          <AvatarFallback className="bg-slate-800 text-slate-300">
                            {item.user.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-1">
                          <p className="text-sm">
                            <span className="font-semibold text-white">{item.user}</span>{" "}
                            <span className="text-slate-400">{item.action}</span>
                          </p>
                          <p className="text-xs text-slate-500">{item.time}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1 xl:col-span-1 space-y-6">
              <Card className="bg-slate-800/60 border-slate-800 h-full flex flex-col min-h-[500px]">
                <CardHeader>
                  <CardTitle className="text-lg text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-400" />
                    Team Chat (Read Only)
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col p-4 pt-0 h-[450px]">
                  <div className="flex-grow space-y-4 overflow-y-auto pr-2 mb-4 scrollbar-thin flex flex-col">
                    {chat.map((msg, i) => (
                      <div key={i} className={`p-3 rounded-xl max-w-[85%] ${msg.isSelf ? 'bg-blue-600/20 rounded-tr-sm self-end ml-auto border border-blue-500/20' : 'bg-slate-800/80 rounded-tl-sm border border-slate-700 self-start'}`}>
                        <p className={`text-sm ${msg.isSelf ? 'text-slate-200' : 'text-slate-300'}`}>{msg.text}</p>
                        <p className={`text-[10px] mt-1 ${msg.isSelf ? 'text-blue-200/50 text-right' : 'text-slate-500'}`}>
                          {msg.sender} - {msg.time}
                        </p>
                      </div>
                    ))}
                    <div ref={chatBottomRef} />
                  </div>
                  <div className="flex gap-2 relative mt-auto pt-2 border-t border-slate-800 shrink-0">
                    <Input 
                      placeholder="Type a message..." 
                      className="bg-slate-800 border-slate-700 text-sm focus-visible:ring-1 focus-visible:ring-primary"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    />
                    <Button size="icon" className="bg-blue-600 hover:bg-blue-700 shrink-0" onClick={handleSendMessage}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Basic Report Modal */}
      {selectedFeedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md bg-slate-800 border-slate-700 shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-800/80 px-4 py-3 flex justify-between items-center border-b border-slate-700">
              <div className="flex items-center gap-2 text-white font-medium">
                <FileText className="w-4 h-4 text-blue-400" />
                Notification Details
              </div>
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white h-8 w-8" onClick={() => setSelectedFeedItem(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <CardContent className="p-6 space-y-6">
              <div className="flex gap-4 items-center">
                 <Avatar className="w-12 h-12 border border-slate-700">
                  <AvatarFallback className="bg-slate-800 text-slate-300 text-lg">
                    {selectedFeedItem.user.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-white text-lg">{selectedFeedItem.user}</h3>
                  <p className="text-sm text-slate-400">{selectedFeedItem.time}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Action Taken</h4>
                <p className="text-slate-200 bg-slate-800/50 p-3 rounded-md border border-slate-700/50">
                  {selectedFeedItem.action}
                </p>
              </div>

               <div className="space-y-2">
                <h4 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Event Metadata Activity Report</h4>
                <p className="text-sm text-slate-300 leading-relaxed max-h-32 overflow-y-auto pr-2 scrollbar-thin">
                  {selectedFeedItem.details || "No additional metadata is available for this systemic event."}
                </p>
              </div>
              
              <div className="pt-4 border-t border-slate-800 flex justify-end">
                <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setSelectedFeedItem(null)}>Dismiss</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Footer />
    </div>
  );
}
