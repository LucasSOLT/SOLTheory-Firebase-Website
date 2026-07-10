"use client";

import React, { useState, useEffect } from "react";
import { useUser, useFirestore } from "@/firebase";
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, CheckCircle2, Loader2, Send, Archive, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { Label } from "@/components/ui/label";
import { logActivity } from '@/lib/activity-logger';

const SUPPORT_EMAIL = "lucas@soltheory.com";

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.email === SUPPORT_EMAIL;

  // View modes: "sent" for everyone, "inbox" + "archived" only for lucas
  const [viewMode, setViewMode] = useState<"sent" | "inbox" | "archived">("sent");
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  // Form State — "To" is always locked to lucas@soltheory.com
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!firestore || !user?.email) return;

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
    if (!firestore || !user?.email || !subject || !message) return;

    setSubmitting(true);
    try {
      await addDoc(collection(firestore, "support_tickets"), {
        fromEmail: user.email,
        toEmail: SUPPORT_EMAIL,
        subject,
        message,
        status: "Unanswered",
        isArchived: false,
        comments: [],
        createdAt: serverTimestamp(),
      });
      logActivity(firestore, 'support_ticket_created', { email: user?.email || '', displayName: user?.displayName }, `Ticket to ${SUPPORT_EMAIL}: ${subject}`);

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
        createdAt: new Date().getTime(),
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

  const getStatusStyle = (status: string, isArchived?: boolean) => {
    if (isArchived) return "bg-slate-100 text-slate-500";
    if (status === "Unanswered") return "bg-slate-900 text-white";
    if (status === "Under review") return "bg-slate-200 text-slate-700";
    if (status === "Denial of service") return "bg-slate-100 text-slate-500";
    if (status === "Completed") return "bg-slate-100 text-slate-700";
    return "bg-slate-100 text-slate-500";
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
    <div className="w-full max-w-4xl mx-auto animate-in fade-in duration-700 h-full overflow-y-auto pb-10 px-6 bg-[#fefdfb]">
      {/* Success Dialog */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="sm:max-w-[380px] border-slate-200 shadow-xl rounded-xl bg-white text-center flex flex-col items-center justify-center p-10 [&>button]:hidden">
          <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-5">
            <CheckCircle2 className="w-7 h-7 text-slate-900" />
          </div>
          <DialogTitle className="text-lg font-semibold text-slate-900 mb-1">Ticket submitted</DialogTitle>
          <p className="text-slate-500 text-sm">Your support request has been logged.</p>
        </DialogContent>
      </Dialog>
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between pt-8 pb-8 gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Support Tickets</h1>
          <p className="text-slate-400 text-sm mt-1">Submit and track your support requests.</p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* View mode tabs — only show inbox/archived for lucas */}
          {isAdmin && (
            <div className="flex bg-slate-100 p-0.5 rounded-lg">
              {(["sent", "inbox", "archived"] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize ${
                    viewMode === mode
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          )}

          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors">
                <Plus className="w-4 h-4" />
                New Ticket
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px] border-slate-200 bg-white text-slate-900 shadow-xl rounded-xl p-0">
              <DialogHeader className="px-6 pt-6 pb-0">
                <DialogTitle className="text-lg font-semibold text-slate-900">New Support Ticket</DialogTitle>
                <p className="text-sm text-slate-400 mt-1">Your ticket will be sent to the support team.</p>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="px-6 pb-6 pt-4 space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="from" className="text-slate-500 text-xs font-medium">From</Label>
                  <Input id="from" value={user?.email || ""} disabled className="bg-slate-50 text-slate-400 border-slate-200 h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="toEmail" className="text-slate-500 text-xs font-medium">To</Label>
                  <Input 
                    id="toEmail" 
                    value={SUPPORT_EMAIL} 
                    disabled
                    className="bg-slate-50 text-slate-400 border-slate-200 h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="subject" className="text-slate-500 text-xs font-medium">Subject</Label>
                  <Input 
                    id="subject" 
                    value={subject} 
                    onChange={(e) => setSubject(e.target.value)} 
                    placeholder="Brief description" 
                    required
                    className="bg-white text-slate-900 border-slate-200 h-10 placeholder:text-slate-300 focus-visible:ring-slate-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="message" className="text-slate-500 text-xs font-medium">Message</Label>
                  <Textarea 
                    id="message" 
                    value={message} 
                    onChange={(e) => setMessage(e.target.value)} 
                    placeholder="Describe your issue or request..." 
                    className="bg-white text-slate-900 min-h-[140px] resize-none border-slate-200 placeholder:text-slate-300 focus-visible:ring-slate-400"
                    required
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting} className="flex items-center gap-2 px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Submit
                  </button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Row — minimal inline numbers */}
      <div className="flex items-center gap-8 pb-8 border-b border-slate-100">
        <div>
          <span className="text-2xl font-semibold text-slate-900 tabular-nums">{stats.total}</span>
          <span className="text-xs text-slate-400 ml-2 font-medium">Total</span>
        </div>
        <div>
          <span className="text-2xl font-semibold text-slate-900 tabular-nums">{stats.open}</span>
          <span className="text-xs text-slate-400 ml-2 font-medium">Open</span>
        </div>
        <div>
          <span className="text-2xl font-semibold text-slate-900 tabular-nums">{stats.resolved}</span>
          <span className="text-xs text-slate-400 ml-2 font-medium">Resolved</span>
        </div>
      </div>

      {/* Ticket List */}
      <div className="pt-6">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-[#faf8f3] flex items-center justify-center mb-4">
              <Send className="w-5 h-5 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-900">No tickets</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">Submit a support ticket and it will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTickets.map((ticket) => {
              const isSentByMe = ticket.fromEmail === user?.email;
              const isExpanded = expandedTicketId === ticket.id;
              
              return (
              <div
                key={ticket.id}
                className={`border border-slate-100 rounded-xl transition-all ${isExpanded ? 'bg-[#faf8f3]' : 'bg-[#fefdfb] hover:bg-[#faf8f3]'}`}
              >
                {/* Ticket Header Row */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer"
                  onClick={() => setExpandedTicketId(isExpanded ? null : ticket.id)}
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-medium text-slate-900 truncate">{ticket.subject}</h3>
                      <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${getStatusStyle(ticket.status, ticket.isArchived)}`}>
                        {ticket.isArchived ? "Archived" : ticket.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {isSentByMe ? `To ${ticket.toEmail}` : `From ${ticket.fromEmail}`}
                      <span className="mx-1.5">·</span>
                      {ticket.createdAt?.toDate ? ticket.createdAt.toDate().toLocaleDateString() : "Just now"}
                      {ticket.comments && ticket.comments.length > 0 && (
                        <>
                          <span className="mx-1.5">·</span>
                          <span className="text-slate-500">{ticket.comments.length} {ticket.comments.length === 1 ? 'reply' : 'replies'}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {ticket.status === "Completed" && !ticket.isArchived && isAdmin && (
                      <button
                        onClick={(e) => handleArchive(ticket, e)}
                        className="text-xs text-slate-400 hover:text-slate-600 transition-colors px-2 py-1"
                      >
                        Archive
                      </button>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-300" />}
                  </div>
                </div>

                {/* Expanded Ticket Body & Comments */}
                {isExpanded && (
                  <div className="px-5 pb-5 animate-in slide-in-from-top-2 fade-in duration-200" onClick={e => e.stopPropagation()}>
                    <div className="border-t border-slate-100 pt-5">
                      {/* Original Message */}
                      <div className="mb-6">
                        <p className="text-xs font-medium text-slate-400 mb-2">Original message</p>
                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {ticket.message}
                        </p>
                      </div>

                      {/* Status changer — admin only */}
                      {isAdmin && !ticket.isArchived && (
                        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-100">
                          <span className="text-xs font-medium text-slate-400">Status</span>
                          <select 
                            value={ticket.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleStatusChange(ticket.id, e.target.value, e)}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 cursor-pointer"
                          >
                            <option value="Unanswered">Unanswered</option>
                            <option value="Under review">Under review</option>
                            <option value="Denial of service">Denial of service</option>
                            <option value="Completed">Completed</option>
                          </select>
                          <span className="text-[10px] text-slate-300 ml-auto font-mono">{ticket.id.slice(0, 8)}</span>
                        </div>
                      )}

                      {/* Comments */}
                      <div className="space-y-4">
                        <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                          <MessageSquare className="w-3 h-3" />
                          {ticket.comments?.length || 0} {(ticket.comments?.length || 0) === 1 ? 'reply' : 'replies'}
                        </p>
                        
                        {(ticket.comments || []).length === 0 ? (
                          <p className="text-xs text-slate-300 py-4 text-center">No replies yet</p>
                        ) : (
                          <div className="space-y-3">
                            {ticket.comments?.map((comment, idx) => (
                              <div key={idx} className="flex gap-3 items-start">
                                <div className="w-7 h-7 rounded-full bg-slate-900 text-white text-[10px] font-medium flex items-center justify-center shrink-0">
                                  {comment.senderEmail.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-baseline gap-2 mb-0.5">
                                    <span className="text-xs font-medium text-slate-700">{comment.senderEmail}</span>
                                    <span className="text-[10px] text-slate-300">
                                      {new Date(comment.createdAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{comment.text}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Add Comment */}
                      {!ticket.isArchived && (
                        <div className="flex gap-2 items-center mt-6 pt-5 border-t border-slate-100">
                          <Input 
                            value={commentInputs[ticket.id] || ""}
                            onChange={(e) => setCommentInputs(prev => ({...prev, [ticket.id]: e.target.value}))}
                            placeholder="Write a reply..."
                            className="bg-white border-slate-200 text-slate-900 focus-visible:ring-slate-400 rounded-lg h-9 text-sm"
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddComment(ticket.id);
                              }
                            }}
                          />
                          <button 
                            onClick={() => handleAddComment(ticket.id)}
                            disabled={!commentInputs[ticket.id]?.trim()}
                            className="shrink-0 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-white text-xs font-medium rounded-lg transition-colors h-9"
                          >
                            Reply
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );})}
          </div>
        )}
      </div>
    </div>
  );
}
