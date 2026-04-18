"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Users, Activity, X, FileText } from "lucide-react";

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
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 h-full overflow-y-auto pb-10">
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
            Communications <span className="text-indigo-600">& Feed</span>
          </h1>
          <p className="text-slate-500 text-base max-w-2xl font-medium">
            Organization live feed and team messaging.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <div className="lg:col-span-1 xl:col-span-2 space-y-6">
          <Card className="bg-white border border-slate-200 shadow-sm rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-500" />
                Organization Live Feed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {feed.map((item, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => setSelectedFeedItem(item)}
                    className="w-full flex gap-4 text-left p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200 animate-in fade-in slide-in-from-top-2 duration-500 max-h-24 overflow-hidden"
                  >
                    <Avatar className="w-10 h-10 border border-slate-200 shrink-0">
                      <AvatarFallback className="bg-slate-50 text-slate-600">
                        {item.user.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <p className="text-sm">
                        <span className="font-semibold text-slate-900">{item.user}</span>{" "}
                        <span className="text-slate-500">{item.action}</span>
                      </p>
                      <p className="text-xs text-slate-400">{item.time}</p>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 xl:col-span-1 space-y-6">
          <Card className="bg-white border border-slate-200 shadow-sm h-full flex flex-col min-h-[500px] rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-500" />
                Team Chat (Read Only)
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col p-4 pt-0 h-[450px]">
              <div className="flex-grow space-y-4 overflow-y-auto pr-2 mb-4 scrollbar-thin flex flex-col">
                {chat.map((msg, i) => (
                  <div key={i} className={`p-3 rounded-xl max-w-[85%] ${msg.isSelf ? 'bg-indigo-50 rounded-tr-sm self-end ml-auto border border-indigo-100' : 'bg-slate-50 rounded-tl-sm border border-slate-200 self-start'}`}>
                    <p className="text-sm text-slate-700">{msg.text}</p>
                    <p className={`text-[10px] mt-1 ${msg.isSelf ? 'text-indigo-400 text-right' : 'text-slate-400'}`}>
                      {msg.sender} - {msg.time}
                    </p>
                  </div>
                ))}
                <div ref={chatBottomRef} />
              </div>
              <div className="flex gap-2 relative mt-auto pt-2 border-t border-slate-100 shrink-0">
                <Input 
                  placeholder="Type a message..." 
                  className="bg-white border-slate-200 text-sm text-slate-900 focus-visible:ring-1 focus-visible:ring-indigo-500"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <Button size="icon" className="bg-indigo-600 hover:bg-indigo-500 shrink-0" onClick={handleSendMessage}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Basic Report Modal */}
      {selectedFeedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md bg-white border border-slate-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 rounded-2xl">
            <div className="bg-slate-50 px-4 py-3 flex justify-between items-center border-b border-slate-200">
              <div className="flex items-center gap-2 text-slate-900 font-medium">
                <FileText className="w-4 h-4 text-indigo-500" />
                Notification Details
              </div>
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-900 h-8 w-8" onClick={() => setSelectedFeedItem(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <CardContent className="p-6 space-y-6">
              <div className="flex gap-4 items-center">
                 <Avatar className="w-12 h-12 border border-slate-200">
                  <AvatarFallback className="bg-slate-50 text-slate-600 text-lg">
                    {selectedFeedItem.user.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-slate-900 text-lg">{selectedFeedItem.user}</h3>
                  <p className="text-sm text-slate-500">{selectedFeedItem.time}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Action Taken</h4>
                <p className="text-slate-700 bg-slate-50 p-3 rounded-md border border-slate-100">
                  {selectedFeedItem.action}
                </p>
              </div>

               <div className="space-y-2">
                <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Event Metadata Activity Report</h4>
                <p className="text-sm text-slate-600 leading-relaxed max-h-32 overflow-y-auto pr-2 scrollbar-thin">
                  {selectedFeedItem.details || "No additional metadata is available for this systemic event."}
                </p>
              </div>
              
              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <Button className="bg-indigo-600 hover:bg-indigo-500 text-white" onClick={() => setSelectedFeedItem(null)}>Dismiss</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
