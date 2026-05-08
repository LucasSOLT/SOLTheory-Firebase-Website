import re

file_path = r"c:\Users\lucas\Desktop\SOLTheory-Firebase-Website\src\app\portal\dashboard\soltheory\ai-agents\[agentId]\page.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

print(f"Original file length: {len(content)}")

# 1. Add exploreItemsMeta
if "const exploreItemsMeta" not in content:
    meta_str = """
const exploreItemsMeta: Record<string, { name: string, greeting: string }> = {
  "Featured": { name: "Felix", greeting: "Hello. I'm Felix, what premium models would you like to test today?" },
  "Conversational AI": { name: "Jarvis", greeting: "Hello. I am Jarvis. How can I assist you today?" },
  "Image Generation": { name: "Iris", greeting: "Hello. I'm Iris, what kind of image can I help you generate today?" },
  "Video Generation": { name: "Victor", greeting: "Hello. I'm Victor, what video concept are we working on today?" },
  "Music Generation": { name: "Mac", greeting: "Hello. I'm Mac, can I help generate some music for you?" },
  "Code Generation": { name: "Cody", greeting: "Hello. I'm Cody, what logic-related endeavor are we tackling today?" },
  
  "Email Agents": { name: "Emma", greeting: "Hello. I'm Emma, what kind of email campaign are we setting up today?" },
  "Social Media Agents": { name: "Sam", greeting: "Hello. I'm Sam, what social media posts are we scheduling today?" },
  "Message Agents": { name: "Max", greeting: "Hello. I'm Max, what messaging integration are we building today?" },
  "Advertising Agents": { name: "Adam", greeting: "Hello. I'm Adam, what advertising campaign are we launching today?" },
  "Build your own Agent": { name: "Builder", greeting: "Hello. I'm Builder, how can I help you configure your custom agent today?" }
};

export default function SolTheoryAgentChatbotPage"""
    content = content.replace("export default function SolTheoryAgentChatbotPage", meta_str, 1)
    if "const exploreItemsMeta" in content:
        print("Successfully added exploreItemsMeta")
    else:
        print("Failed to replace export default function SolTheoryAgentChatbotPage")


# 2. Add Modal State
state_str = """  const [exploreTab, setExploreTab] = useState<"models" | "agents">("models");
  const [selectedExploreItem, setSelectedExploreItem] = useState<string | null>(null);

  const [isAgentRequestModalOpen, setIsAgentRequestModalOpen] = useState(false);
  const [agentRequestForm, setAgentRequestForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [isSubmittingAgentRequest, setIsSubmittingAgentRequest] = useState(false);

  const submitAgentRequest = async () => {
    if (!agentRequestForm.name || !agentRequestForm.email || !agentRequestForm.message) {
      alert("Name, Email, and Message are required fields.");
      return;
    }
    setIsSubmittingAgentRequest(true);
    try {
      const { collection, addDoc } = await import("firebase/firestore");
      await addDoc(collection(firestore, "support_tickets"), {
        subject: "New Agent Request",
        message: `Name: ${agentRequestForm.name}\\nPhone: ${agentRequestForm.phone}\\nEmail: ${agentRequestForm.email}\\n\\nRequest:\\n${agentRequestForm.message}`,
        fromEmail: agentRequestForm.email,
        fromName: agentRequestForm.name,
        toEmail: "lucas@soltheory.com",
        status: "open",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isAgentRequest: true
      });
      alert("Agent Request Submitted!");
      setIsAgentRequestModalOpen(false);
      setAgentRequestForm({ name: '', email: '', phone: '', message: '' });
    } catch (err) {
      console.error(err);
      alert("Failed to submit request.");
    } finally {
      setIsSubmittingAgentRequest(false);
    }
  };

  const [agentContacts"""
target_state = """  const [exploreTab, setExploreTab] = useState<"models" | "agents">("models");
  const [selectedExploreItem, setSelectedExploreItem] = useState<string | null>(null);

  const [agentContacts"""
content = content.replace(target_state, state_str, 1)
if "isAgentRequestModalOpen" in content:
    print("Successfully added Modal State")
else:
    print("Failed to replace Modal State")


# 3. Replace Grid styling and content
grid_replacement = """                          {exploreTab === "models" ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                               <div onClick={() => setSelectedExploreItem("Featured")} className="border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white group">
                                 <div className="flex items-center gap-3 mb-4">
                                   <div className="w-9 h-9 rounded-lg bg-slate-50 group-hover:bg-slate-100 transition-colors flex items-center justify-center text-slate-700">
                                     <Sparkles className="w-4.5 h-4.5" />
                                   </div>
                                   <h3 className="font-bold text-[13px] text-slate-700">Featured</h3>
                                 </div>
                                 <p className="text-[13px] text-slate-500 leading-relaxed font-medium">Test out our premium Groq models.</p>
                               </div>
                               
                               <div onClick={() => setSelectedExploreItem("Conversational AI")} className="border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white group">
                                 <div className="flex items-center gap-3 mb-4">
                                   <div className="w-9 h-9 rounded-lg bg-slate-50 group-hover:bg-slate-100 transition-colors flex items-center justify-center text-slate-700">
                                     <MessageSquare className="w-4.5 h-4.5" />
                                   </div>
                                   <h3 className="font-bold text-[13px] text-slate-700">Conversational AI</h3>
                                 </div>
                                 <p className="text-[13px] text-slate-500 leading-relaxed font-medium">Converse with our voice agent, Jarvis.</p>
                               </div>
                               
                               <div onClick={() => setSelectedExploreItem("Image Generation")} className="border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white/70 opacity-80 group">
                                 <div className="flex items-center gap-3 mb-4">
                                   <div className="w-9 h-9 rounded-lg bg-slate-50 group-hover:bg-slate-100 transition-colors flex items-center justify-center text-slate-700">
                                     <ImageIcon className="w-4.5 h-4.5" />
                                   </div>
                                   <h3 className="font-bold text-[13px] text-slate-700">Image Generation</h3>
                                 </div>
                                 <p className="text-[13px] text-slate-500 leading-relaxed font-medium">Create and edit cutting-edge AI images - Coming Soon.</p>
                               </div>
                               
                               <div onClick={() => setSelectedExploreItem("Video Generation")} className="border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white/70 opacity-80 group">
                                 <div className="flex items-center gap-3 mb-4">
                                   <div className="w-9 h-9 rounded-lg bg-slate-50 group-hover:bg-slate-100 transition-colors flex items-center justify-center text-slate-700">
                                     <Video className="w-4.5 h-4.5" />
                                   </div>
                                   <h3 className="font-bold text-[13px] text-slate-700">Video Generation</h3>
                                 </div>
                                 <p className="text-[13px] text-slate-500 leading-relaxed font-medium">Generate state of the art AI videos - Coming Soon.</p>
                               </div>
                               
                               <div onClick={() => setSelectedExploreItem("Music Generation")} className="border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white/70 opacity-80 group">
                                 <div className="flex items-center gap-3 mb-4">
                                   <div className="w-9 h-9 rounded-lg bg-slate-50 group-hover:bg-slate-100 transition-colors flex items-center justify-center text-slate-700">
                                     <Music className="w-4.5 h-4.5" />
                                   </div>
                                   <h3 className="font-bold text-[13px] text-slate-700">Music</h3>
                                 </div>
                                 <p className="text-[13px] text-slate-500 leading-relaxed font-medium">Explore our text to speech and music models - Coming Soon.</p>
                               </div>
                               
                               <div onClick={() => setSelectedExploreItem("Code Generation")} className="border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white group">
                                 <div className="flex items-center gap-3 mb-4">
                                   <div className="w-9 h-9 rounded-lg bg-slate-50 group-hover:bg-slate-100 transition-colors flex items-center justify-center text-slate-700">
                                     <Code className="w-4.5 h-4.5" />
                                   </div>
                                   <h3 className="font-bold text-[13px] text-slate-700">Code</h3>
                                 </div>
                                 <p className="text-[13px] text-slate-500 leading-relaxed font-medium">Tackle your logic-related endeavors.</p>
                               </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                               <div onClick={() => setSelectedExploreItem("Email Agents")} className="border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white group">
                                 <div className="flex items-center gap-3 mb-4">
                                   <div className="w-9 h-9 rounded-lg bg-slate-50 group-hover:bg-slate-100 transition-colors flex items-center justify-center text-slate-700">
                                     <Mail className="w-4.5 h-4.5" />
                                   </div>
                                   <h3 className="font-bold text-[13px] text-slate-700">Email Agents</h3>
                                 </div>
                                 <p className="text-[13px] text-slate-500 leading-relaxed font-medium">Set up scheduled email campaigns!</p>
                               </div>

                               <div onClick={() => setSelectedExploreItem("Social Media Agents")} className="border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white group">
                                 <div className="flex items-center gap-3 mb-4">
                                   <div className="w-9 h-9 rounded-lg bg-slate-50 group-hover:bg-slate-100 transition-colors flex items-center justify-center text-slate-700">
                                     <Users className="w-4.5 h-4.5" />
                                   </div>
                                   <h3 className="font-bold text-[13px] text-slate-700">Social Media Agents</h3>
                                 </div>
                                 <p className="text-[13px] text-slate-500 leading-relaxed font-medium">Set up scheduled social media posts</p>
                               </div>

                               <div onClick={() => setSelectedExploreItem("Message Agents")} className="border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white group">
                                 <div className="flex items-center gap-3 mb-4">
                                   <div className="w-9 h-9 rounded-lg bg-slate-50 group-hover:bg-slate-100 transition-colors flex items-center justify-center text-slate-700">
                                     <MessageSquare className="w-4.5 h-4.5" />
                                   </div>
                                   <h3 className="font-bold text-[13px] text-slate-700">Message Agents</h3>
                                 </div>
                                 <p className="text-[13px] text-slate-500 leading-relaxed font-medium">Create messaging app integrations with AI</p>
                               </div>

                               <div onClick={() => setSelectedExploreItem("Advertising Agents")} className="border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white/70 opacity-80 group">
                                 <div className="flex items-center gap-3 mb-4">
                                   <div className="w-9 h-9 rounded-lg bg-slate-50 group-hover:bg-slate-100 transition-colors flex items-center justify-center text-slate-700">
                                     <Presentation className="w-4.5 h-4.5" />
                                   </div>
                                   <h3 className="font-bold text-[13px] text-slate-700">Advertising Agents</h3>
                                 </div>
                                 <p className="text-[13px] text-slate-500 leading-relaxed font-medium">Build cron jobs for advertising campagins - Google LSA coming soon</p>
                               </div>

                               <div onClick={() => setIsAgentRequestModalOpen(true)} className="border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white group">
                                 <div className="flex items-center gap-3 mb-4">
                                   <div className="w-9 h-9 rounded-lg bg-slate-50 group-hover:bg-slate-100 transition-colors flex items-center justify-center text-slate-700">
                                     <Plus className="w-4.5 h-4.5" />
                                   </div>
                                   <h3 className="font-bold text-[13px] text-slate-700">Submit an Agent Request</h3>
                                 </div>
                                 <p className="text-[13px] text-slate-500 leading-relaxed font-medium">Submit a new agent request to the team</p>
                               </div>

                               <div onClick={() => setSelectedExploreItem("Build your own Agent")} className="border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white/70 opacity-80 group">
                                 <div className="flex items-center gap-3 mb-4">
                                   <div className="w-9 h-9 rounded-lg bg-slate-50 group-hover:bg-slate-100 transition-colors flex items-center justify-center text-slate-700">
                                     <Settings className="w-4.5 h-4.5" />
                                   </div>
                                   <h3 className="font-bold text-[13px] text-slate-700">Build your own Agent</h3>
                                 </div>
                                 <p className="text-[13px] text-slate-500 leading-relaxed font-medium">Configure a custom agent with our drag & drop system - Coming Soon</p>
                               </div>
                            </div>
                          )}"""

old_len = len(content)
content = re.sub(r'\{exploreTab === "models" \? \([\s\S]*?\<\/div\>\n\s*\)\}', grid_replacement, content)
if len(content) != old_len:
    print("Successfully replaced Grid styling")
else:
    print("Failed to replace Grid styling")

# 4. Replace Chat Heading
chat_heading_rep = """                      <>
                        <div className="flex justify-center mb-10 pt-10">
                          <div className="text-3xl font-black opacity-10 tracking-[0.3em] uppercase text-center max-w-full truncate px-4">{selectedExploreItem ? `${exploreItemsMeta[selectedExploreItem]?.name || ''} - ${selectedExploreItem}` : agent.name}</div>
                        </div>
                        <div className="flex gap-4">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border border-slate-300  bg-slate-200/50 `}><Bot className={`w-5 h-5 ${agent.accent}`} /></div>
                          <div className="flex-1 space-y-1 pt-1">
                            <div className="font-bold text-sm text-slate-700 ">{selectedExploreItem ? exploreItemsMeta[selectedExploreItem]?.name || agent.name.split(' ')[0] : agent.name.split(' ')[0]}</div>
                            <div className={`text-slate-800  inline-block p-4 rounded-2xl rounded-tl-sm border backdrop-blur-md ${agent.chatBg}`}>{selectedExploreItem ? exploreItemsMeta[selectedExploreItem]?.greeting || agent.greeting : agent.greeting}</div>
                          </div>
                        </div>"""

old_len = len(content)
content = re.sub(r'\<\>\n\s*\<div className="flex justify-center mb-10 pt-10"\>[\s\S]*?\<\/div\>\n\s*\<\/div\>', chat_heading_rep, content)
if len(content) != old_len:
    print("Successfully replaced Chat Heading")
else:
    print("Failed to replace Chat Heading")

# 5. Append Modal UI
modal_ui = """
      {isAgentRequestModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-500" />
                Submit an Agent Request
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setIsAgentRequestModalOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Name *</label>
                <Input placeholder="John Doe" value={agentRequestForm.name} onChange={e => setAgentRequestForm({...agentRequestForm, name: e.target.value})} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Email *</label>
                  <Input placeholder="john@example.com" type="email" value={agentRequestForm.email} onChange={e => setAgentRequestForm({...agentRequestForm, email: e.target.value})} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Phone</label>
                  <Input placeholder="(555) 000-0000" type="tel" value={agentRequestForm.phone} onChange={e => setAgentRequestForm({...agentRequestForm, phone: e.target.value})} className="mt-1" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Message *</label>
                <textarea 
                  placeholder="Describe the agent you'd like us to build..." 
                  value={agentRequestForm.message} 
                  onChange={e => setAgentRequestForm({...agentRequestForm, message: e.target.value})} 
                  className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none text-slate-900 h-32" 
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsAgentRequestModalOpen(false)}>Cancel</Button>
              <Button onClick={submitAgentRequest} disabled={isSubmittingAgentRequest || !agentRequestForm.name || !agentRequestForm.email || !agentRequestForm.message} className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[120px]">
                {isSubmittingAgentRequest ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Request"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
"""

if "{isAgentRequestModalOpen &&" not in content:
    content = content.replace("    </div>\n  );\n}\n", modal_ui)
    if "{isAgentRequestModalOpen &&" in content:
        print("Successfully added Modal UI")
    else:
        print("Failed to replace Modal UI")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print(f"Final file length: {len(content)}")
