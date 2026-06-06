"use client";

import React, { useState, useEffect } from "react";
import { useUser, useFirestore } from "@/firebase";
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, arrayUnion, getDoc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Ticket, Plus, CheckCircle2, AlertCircle, Loader2, Inbox, Send, Archive, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { Label } from "@/components/ui/label";
import { logActivity } from '@/lib/activity-logger';

type TicketComment = {
  text: string;
  senderEmail: string;
  createdAt: any;
};

type TicketData = {
  id: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  message: string;
  status: "Unanswered" | "Under review" | "Denial of service" | "Completed";
  createdAt: any;
  isArchived?: boolean;
  comments?: TicketComment[];
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
  
  // "sent" = we sent it to someone else
  // "inbox" = someone sent it to us
  // "archived" = answered tickets that were archived
  const [viewMode, setViewMode] = useState<"sent" | "inbox" | "archived">("sent");
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

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

    let fromDocs: any[] = [];
    let toDocs: any[] = [];

    const updateTickets = () => {
      const merged = new Map<string, TicketData>();
      fromDocs.forEach(d => merged.set(d.id, { id: d.id, ...d.data() } as TicketData));
      toDocs.forEach(d => merged.set(d.id, { id: d.id, ...d.data() } as TicketData));
      
      const sortedTickets = Array.from(merged.values()).sort((a, b) => {
        const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tB - tA;
      });

      setTickets(sortedTickets);
      setLoading(false);
    };

    const unsubscribeFrom = onSnapshot(qFrom, (snap) => {
      fromDocs = snap.docs;
      updateTickets();
    });

    const unsubscribeTo = onSnapshot(qTo, (snap) => {
      toDocs = snap.docs;
      updateTickets();
    });

    return () => {
      unsubscribeFrom();
      unsubscribeTo();
    };
  }, [firestore, user?.email, user?.uid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !user?.email || !toEmail || !subject || !message) return;

    setSubmitting(true);
    try {
      await addDoc(collection(firestore, "support_tickets"), {
        fromEmail: user.email,
        toEmail,
        subject,
        message,
        status: "Unanswered",
        isArchived: false,
        comments: [],
        createdAt: serverTimestamp(),
      });
      logActivity(firestore, 'support_ticket_created', { email: user?.email || '', displayName: user?.displayName }, `Ticket to ${toEmail}: ${subject}`);

      if (!savedEmails.includes(toEmail)) {
        const userRef = doc(firestore, "users", user.uid);
        await updateDoc(userRef, {
          savedContactEmails: arrayUnion(toEmail)
        });
        setSavedEmails(prev => [...prev, toEmail]);
      }

      setToEmail("");
      setSubject("");
      setMessage("");
      
      await new Promise(resolve => setTimeout(resolve, 800));
      setIsModalOpen(false);
      
      setTimeout(() => {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2500);
      }, 300);

    } catch (error) {
      console.error("Error submitting ticket", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddComment = async (ticketId: string) => {
    if (!firestore || !user?.email) return;
    const text = commentInputs[ticketId]?.trim();
    if (!text) return;

    try {
      const ticketRef = doc(firestore, "support_tickets", ticketId);
      const newComment = {
        text,
        senderEmail: user.email,
        createdAt: new Date().getTime(), // Fallback local time for instant UI feel
      };
      await updateDoc(ticketRef, {
        comments: arrayUnion(newComment)
      });
      setCommentInputs(prev => ({...prev, [ticketId]: ""}));
    } catch(e) {
      console.error(e);
      alert("Failed to post comment.");
    }
  };

  const handleArchive = async (ticket: TicketData, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, "support_tickets", ticket.id), {
        isArchived: true
      });
      if(expandedTicketId === ticket.id) setExpandedTicketId(null);
    } catch(e) {
      console.error(e);
      alert("Failed to archive ticket.");
    }
  };

  const handleStatusChange = async (ticketId: string, newStatus: string, e?: React.ChangeEvent<HTMLSelectElement>) => {
    if (e) e.stopPropagation();
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, "support_tickets", ticketId), {
        status: newStatus
      });
    } catch(e) {
      console.error(e);
      alert("Failed to update status.");
    }
  };

  const getStatusColorClass = (status: string, isArchived?: boolean) => {
    if (isArchived) return "bg-slate-100 text-slate-500 border-slate-200";
    if (status === "Unanswered") return "bg-red-50 text-red-600 border-red-200";
    if (status === "Under review") return "bg-amber-50 text-amber-600 border-amber-200";
    if (status === "Denial of service") return "bg-slate-100 text-slate-600 border-slate-200";
    if (status === "Completed") return "bg-green-50 text-green-600 border-green-200";
    return "bg-slate-100 text-slate-500 border-slate-200";
  };

  const filteredTickets = tickets.filter(t => {
    if (viewMode === "archived") return t.isArchived;
    if (t.isArchived) return false;
    return viewMode === "sent" ? t.fromEmail === user?.email : t.toEmail === user?.email;
  });

  const stats = {
    total: filteredTickets.length,
    open: filteredTickets.filter(t => (t.status === "Unanswered" || t.status === "Under review") && !t.isArchived).length,
    resolved: filteredTickets.filter(t => (t.status === "Completed" || t.status === "Denial of service") && !t.isArchived).length,
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-700 h-full overflow-y-auto pb-10">
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="sm:max-w-[400px] border-slate-200 shadow-2xl rounded-2xl bg-[#fefcf6] text-center flex flex-col items-center justify-center p-8 [&>button]:hidden">
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

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <Button 
              variant="ghost" size="sm"
              onClick={() => setViewMode("inbox")}
              className={`rounded-lg ${viewMode === "inbox" ? "bg-[#fefcf6] shadow-sm text-indigo-600" : "text-slate-500"}`}
            >
              <Inbox className="w-4 h-4 mr-2" /> Inbox
            </Button>
            <Button 
              variant="ghost" size="sm"
              onClick={() => setViewMode("sent")}
              className={`rounded-lg ${viewMode === "sent" ? "bg-[#fefcf6] shadow-sm text-indigo-600" : "text-slate-500"}`}
            >
              <Send className="w-4 h-4 mr-2" /> Sent
            </Button>
            <Button 
              variant="ghost" size="sm"
              onClick={() => setViewMode("archived")}
              className={`rounded-lg ${viewMode === "archived" ? "bg-[#fefcf6] shadow-sm text-indigo-600" : "text-slate-500"}`}
            >
              <Archive className="w-4 h-4 mr-2" /> Archived
            </Button>
          </div>

          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700 text-white font-semibold shadow-sm rounded-xl ml-2">
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
                    className="bg-[#fefcf6] text-slate-900 font-medium focus-visible:ring-green-500 border-slate-300 placeholder:text-slate-400"
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
                    className="bg-[#fefcf6] text-slate-900 font-medium focus-visible:ring-green-500 border-slate-300 placeholder:text-slate-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message" className="text-slate-600 text-[10px] font-bold uppercase tracking-wider">Message</Label>
                  <Textarea 
                    id="message" 
                    value={message} 
                    onChange={(e) => setMessage(e.target.value)} 
                    placeholder="Detail your request or communication here..." 
                    className="bg-[#fefcf6] text-slate-900 min-h-[120px] resize-none font-medium focus-visible:ring-green-500 border-slate-300 placeholder:text-slate-400"
                    required
                  />
                </div>
                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="font-semibold text-slate-600 border-slate-300 bg-[#fefcf6] hover:bg-[#faf6ed] rounded-xl">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting} className="bg-green-600 hover:bg-green-700 font-semibold text-white rounded-xl">
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
        <Card className="bg-[#fefcf6] border border-slate-100 shadow-sm rounded-2xl">
          <CardContent className="p-6 flex flex-col items-center justify-center gap-2">
            <Ticket className="w-8 h-8 text-indigo-500" />
            <span className="text-3xl font-black text-slate-900">{stats.total}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {viewMode === "sent" ? "Total Sent" : viewMode === "inbox" ? "Total Inbox" : "Archived Tickets"}
            </span>
          </CardContent>
        </Card>
        <Card className="bg-[#fefcf6] border border-slate-100 shadow-sm rounded-2xl opacity-80">
          <CardContent className="p-6 flex flex-col items-center justify-center gap-2">
            <AlertCircle className="w-8 h-8 text-amber-500" />
            <span className="text-3xl font-black text-slate-900">{stats.open}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Open / Review</span>
          </CardContent>
        </Card>
        <Card className="bg-[#fefcf6] border border-slate-100 shadow-sm rounded-2xl opacity-80">
          <CardContent className="p-6 flex flex-col items-center justify-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
            <span className="text-3xl font-black text-slate-900">{stats.resolved}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Resolved</span>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#fefcf6] border border-slate-100 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-[#faf6ed] border-b border-slate-100 pb-4">
          <CardTitle className="text-sm font-bold text-slate-700 uppercase tracking-wide">
            {viewMode === "sent" ? "Sent Tickets" : viewMode === "inbox" ? "Tickets Received" : "Archived Tickets"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center p-12">
              <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-[#faf6ed] flex items-center justify-center mb-4">
                <Ticket className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No tickets found</h3>
              <p className="text-slate-500 text-sm mt-1 max-w-sm">When you send, receive, or archive support tickets, they will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredTickets.map((ticket) => {
                const isSentByMe = ticket.fromEmail === user?.email;
                const isUnanswered = ticket.status === "Unanswered";
                const isUnderReview = ticket.status === "Under review";
                const isExpanded = expandedTicketId === ticket.id;
                
                return (
                <div key={ticket.id} className={`flex flex-col p-5 transition-colors cursor-pointer
                  ${(isUnanswered || isUnderReview) && !ticket.isArchived ? 'bg-amber-50/10 hover:bg-amber-50/30' : !ticket.isArchived ? 'bg-green-50/10 hover:bg-green-50/30' : 'bg-[#fefcf6] hover:bg-[#faf6ed]'}
                `} onClick={() => setExpandedTicketId(isExpanded ? null : ticket.id)}>
                  
                  {/* Ticket Header Row */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full">
                    <div className="flex items-start gap-4">
                      <div className="mt-1">
                        {ticket.isArchived ? <Archive className="w-5 h-5 text-slate-400" /> : ticket.status === "Completed" ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : ticket.status === "Denial of service" ? <AlertCircle className="w-5 h-5 text-slate-400" /> : <AlertCircle className="w-5 h-5 text-amber-500" />}
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
                          <span className="mx-2 text-slate-300">â€¢</span>
                          {ticket.createdAt?.toDate ? ticket.createdAt.toDate().toLocaleDateString() : "Just now"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-9 sm:ml-0">
                      {ticket.status === "Completed" && !ticket.isArchived && (
                        <Button 
                          variant="outline" size="sm" 
                          onClick={(e) => handleArchive(ticket, e)}
                          className="h-7 text-xs bg-[#fefcf6] text-slate-600 hover:text-slate-900 border-slate-200"
                        >
                          <Archive className="w-3 h-3 mr-1" /> Archive
                        </Button>
                      )}
                      <div className="flex flex-col items-end gap-1">
                         <select 
                           value={ticket.status}
                           onClick={(e) => e.stopPropagation()}
                           onChange={(e) => handleStatusChange(ticket.id, e.target.value, e)}
                           className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer transition-colors ${getStatusColorClass(ticket.status, ticket.isArchived)}`}
                           disabled={ticket.isArchived}
                         >
                           <option value="Unanswered">Unanswered</option>
                           <option value="Under review">Under review</option>
                           <option value="Denial of service">Denial of service</option>
                           <option value="Completed">Completed</option>
                         </select>
                         <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">ID: {ticket.id.slice(0, 8)}</span>
                      </div>
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                    </div>
                  </div>

                  {/* Expanded Ticket Body & Comments */}
                  {isExpanded && (
                    <div className="mt-5 ml-9 border-t border-slate-100 pt-5 animate-in slide-in-from-top-2 fade-in" onClick={e => e.stopPropagation()}>
                      <div className="bg-[#faf6ed] border border-slate-100 rounded-xl p-4 mb-6">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 block">Original Request</span>
                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {ticket.message}
                        </p>
                      </div>

                      {/* Comments Feed */}
                      <div className="space-y-4 mb-6">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                          <MessageSquare className="w-3.5 h-3.5" /> Comments ({ticket.comments?.length || 0})
                        </h4>
                        
                        {(ticket.comments || []).length === 0 ? (
                          <div className="text-sm text-slate-500 italic p-4 bg-[#fefcf6] border border-slate-100 border-dashed rounded-xl text-center">
                            No comments yet. Start the conversation!
                          </div>
                        ) : (
                          ticket.comments?.map((comment, idx) => (
                            <div key={idx} className="flex gap-3 items-start">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 text-xs">
                                {comment.senderEmail.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 bg-[#fefcf6] border border-slate-100 rounded-xl p-3 shadow-sm">
                                <div className="flex justify-between items-start mb-1">
                                  <span className="text-xs font-bold text-slate-800">{comment.senderEmail}</span>
                                  <span className="text-[10px] font-semibold text-slate-400">
                                    {new Date(comment.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{comment.text}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Add Comment Box */}
                      {!ticket.isArchived && (
                        <div className="flex gap-3 items-start mt-2 border-t border-slate-100 pt-5">
                          <div className="w-8 h-8 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                            {user?.email?.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 flex gap-2">
                            <Input 
                              value={commentInputs[ticket.id] || ""}
                              onChange={(e) => setCommentInputs(prev => ({...prev, [ticket.id]: e.target.value}))}
                              placeholder="Type a response..."
                              className="bg-[#fefcf6] border-slate-200 text-slate-900 focus-visible:ring-indigo-500 rounded-xl"
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddComment(ticket.id);
                                }
                              }}
                            />
                            <Button 
                              onClick={() => handleAddComment(ticket.id)}
                              disabled={!commentInputs[ticket.id]?.trim()}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm rounded-xl px-6"
                            >
                              Reply
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )})}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
