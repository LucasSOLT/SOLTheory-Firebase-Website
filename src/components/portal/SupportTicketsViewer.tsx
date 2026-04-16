"use client";

import React, { useState, useEffect } from "react";
import { useUser, useFirestore } from "@/firebase";
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, arrayUnion, getDoc, serverTimestamp, orderBy } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Ticket, Plus, CheckCircle2, AlertCircle, Loader2, Inbox, Send } from "lucide-react";
import { Label } from "@/components/ui/label";

type TicketData = {
  id: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  message: string;
  status: "Unanswered" | "Answered";
  createdAt: any;
};

export function SupportTicketsViewer({ dashboardName }: { dashboardName: string }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [savedEmails, setSavedEmails] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // "sent" = we sent it to someone else (fromEmail === user.email)
  // "inbox" = someone sent it to us (toEmail === user.email)
  const [viewMode, setViewMode] = useState<"sent" | "inbox">("sent");

  // Form State
  const [toEmail, setToEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!firestore || !user?.email) return;

    // Fetch user's saved emails
    if (user.uid) {
      const userRef = doc(firestore, "users", user.uid);
      getDoc(userRef).then((docSnap) => {
        if (docSnap.exists() && docSnap.data().savedContactEmails) {
          setSavedEmails(docSnap.data().savedContactEmails);
        }
      });
    }

    // Query tickets where user is either sender or receiver
    const qFrom = query(collection(firestore, "support_tickets"), where("fromEmail", "==", user.email));
    const qTo = query(collection(firestore, "support_tickets"), where("toEmail", "==", user.email));

    const unsubscribeFrom = onSnapshot(qFrom, (snap1) => {
      onSnapshot(qTo, (snap2) => {
        const merged = new Map<string, TicketData>();
        snap1.forEach(d => merged.set(d.id, { id: d.id, ...d.data() } as TicketData));
        snap2.forEach(d => merged.set(d.id, { id: d.id, ...d.data() } as TicketData));
        
        const sortedTickets = Array.from(merged.values()).sort((a, b) => {
          const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return tB - tA;
        });

        setTickets(sortedTickets);
        setLoading(false);
      });
    });

    return () => unsubscribeFrom();
  }, [firestore, user?.email, user?.uid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !user?.email || !toEmail || !subject || !message) return;

    setSubmitting(true);
    try {
      // 1. Create the ticket
      await addDoc(collection(firestore, "support_tickets"), {
        fromEmail: user.email,
        toEmail,
        subject,
        message,
        status: "Unanswered",
        createdAt: serverTimestamp(),
      });

      // 2. Save the toEmail to user's suggestions if not present
      if (!savedEmails.includes(toEmail)) {
        const userRef = doc(firestore, "users", user.uid);
        await updateDoc(userRef, {
          savedContactEmails: arrayUnion(toEmail)
        });
        setSavedEmails(prev => [...prev, toEmail]);
      }

      // Reset form
      setToEmail("");
      setSubject("");
      setMessage("");
      
      // Delay closing to give visual feedback, then show success modal
      await new Promise(resolve => setTimeout(resolve, 800));
      setIsModalOpen(false);
      
      setTimeout(() => {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2500);
      }, 300); // 300ms delay while the old modal animation closes

    } catch (error) {
      console.error("Error submitting ticket", error);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "Unanswered") {
      return <Badge variant="destructive" className="bg-red-50 text-red-600 border-red-200">Unanswered</Badge>;
    }
    return <Badge variant="secondary" className="bg-green-50 text-green-600 border-green-200">Answered</Badge>;
  };

  const filteredTickets = tickets.filter(t => 
    viewMode === "sent" ? t.fromEmail === user?.email : t.toEmail === user?.email
  );

  const stats = {
    total: filteredTickets.length,
    open: filteredTickets.filter(t => t.status === "Unanswered").length,
    resolved: filteredTickets.filter(t => t.status === "Answered").length,
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-700 h-full overflow-y-auto pb-10">
      
      {/* Success Popup */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="sm:max-w-[400px] border-slate-200 shadow-2xl rounded-2xl bg-white text-center flex flex-col items-center justify-center p-8 [&>button]:hidden">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <DialogTitle className="text-xl font-black text-slate-900 mb-2">Support ticket has been sent!</DialogTitle>
          <p className="text-slate-500 font-medium text-sm">We've logged your request successfully.</p>
        </DialogContent>
      </Dialog>
      
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 mb-8 pt-6 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
            Support <span className="text-indigo-600">Tickets</span>
          </h1>
          <p className="text-slate-500 text-sm font-medium mt-1">
            Manage your internal IT requests and support communications.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button 
            variant="outline"
            onClick={() => setViewMode(viewMode === "sent" ? "inbox" : "sent")}
            className="bg-white hover:bg-slate-50 text-slate-700 font-semibold border-slate-200 shadow-sm"
          >
            {viewMode === "sent" ? (
              <><Inbox className="w-4 h-4 mr-2 text-indigo-500" /> View Inbox</>
            ) : (
              <><Send className="w-4 h-4 mr-2 text-indigo-500" /> View Sent Tickets</>
            )}
          </Button>

          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700 text-white font-semibold shadow-sm">
                <Plus className="w-4 h-4 mr-2" /> New Ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] border-slate-200 bg-[#f8f9fc] text-slate-900 shadow-2xl rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-green-600" /> Open New Ticket
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="from" className="text-slate-600 text-[10px] font-bold uppercase tracking-wider">From</Label>
                  <Input id="from" value={user?.email || ""} disabled className="bg-slate-100/50 text-slate-500 font-medium border-slate-300" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="toEmail" className="text-slate-600 text-[10px] font-bold uppercase tracking-wider">To</Label>
                  <Input 
                    id="toEmail" 
                    value={toEmail} 
                    onChange={(e) => setToEmail(e.target.value)} 
                    placeholder="support@organization.com" 
                    autoComplete="off"
                    list="savedEmailsList"
                    required
                    className="bg-white text-slate-900 font-medium focus-visible:ring-green-500 border-slate-300 placeholder:text-slate-400"
                  />
                  <datalist id="savedEmailsList">
                    {savedEmails.map((email) => (
                      <option key={email} value={email} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject" className="text-slate-600 text-[10px] font-bold uppercase tracking-wider">Subject</Label>
                  <Input 
                    id="subject" 
                    value={subject} 
                    onChange={(e) => setSubject(e.target.value)} 
                    placeholder="Brief description of the issue" 
                    required
                    className="bg-white text-slate-900 font-medium focus-visible:ring-green-500 border-slate-300 placeholder:text-slate-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message" className="text-slate-600 text-[10px] font-bold uppercase tracking-wider">Message</Label>
                  <Textarea 
                    id="message" 
                    value={message} 
                    onChange={(e) => setMessage(e.target.value)} 
                    placeholder="Detail your request or communication here..." 
                    className="bg-white text-slate-900 min-h-[120px] resize-none font-medium focus-visible:ring-green-500 border-slate-300 placeholder:text-slate-400"
                    required
                  />
                </div>
                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="font-semibold text-slate-600 border-slate-300 bg-white hover:bg-slate-50">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting} className="bg-green-600 hover:bg-green-700 font-semibold text-white">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Submit Ticket
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-white border border-slate-100 shadow-sm rounded-2xl">
          <CardContent className="p-6 flex flex-col items-center justify-center gap-2">
            <Ticket className="w-8 h-8 text-indigo-500" />
            <span className="text-3xl font-black text-slate-900">{stats.total}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total {viewMode === "sent" ? "Sent" : "Inbox"}</span>
          </CardContent>
        </Card>
        <Card className="bg-white border border-slate-100 shadow-sm rounded-2xl">
          <CardContent className="p-6 flex flex-col items-center justify-center gap-2">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <span className="text-3xl font-black text-slate-900">{stats.open}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Unanswered</span>
          </CardContent>
        </Card>
        <Card className="bg-white border border-slate-100 shadow-sm rounded-2xl">
          <CardContent className="p-6 flex flex-col items-center justify-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
            <span className="text-3xl font-black text-slate-900">{stats.resolved}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Answered</span>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white border border-slate-100 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
          <CardTitle className="text-sm font-bold text-slate-700 uppercase tracking-wide">
            {viewMode === "sent" ? "Sent Tickets" : "Tickets Received"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center p-12">
              <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                <Ticket className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No tickets found</h3>
              <p className="text-slate-500 text-sm mt-1 max-w-sm">When you send or receive support tickets, they will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredTickets.map((ticket) => {
                const isSentByMe = ticket.fromEmail === user?.email;
                const isUnanswered = ticket.status === "Unanswered";
                
                return (
                <div key={ticket.id} className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 transition-colors hover:bg-slate-50 gap-4
                  ${isUnanswered ? 'bg-red-50/30' : 'bg-green-50/30'}
                `}>
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      {isUnanswered ? <AlertCircle className="w-5 h-5 text-red-500" /> : <CheckCircle2 className="w-5 h-5 text-green-600" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                        {ticket.subject} 
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 font-medium">
                        {isSentByMe ? (
                          <>To: <span className="text-slate-700">{ticket.toEmail}</span></>
                        ) : (
                          <>From: <span className="text-slate-700">{ticket.fromEmail}</span></>
                        )}
                        <span className="mx-2 text-slate-300">•</span>
                        {ticket.createdAt?.toDate ? ticket.createdAt.toDate().toLocaleDateString() : "Just now"}
                      </p>
                      <p className="text-sm text-slate-600 mt-3 line-clamp-2 leading-relaxed">
                        {ticket.message}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center sm:items-end gap-3 w-full sm:w-auto shrink-0 flex-col">
                    {getStatusBadge(ticket.status)}
                    <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mt-2">ID: {ticket.id.slice(0, 8)}</span>
                  </div>
                </div>
              )})}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
