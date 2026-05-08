import re

file_path = r"c:\Users\lucas\Desktop\SOLTheory-Firebase-Website\src\app\portal\dashboard\soltheory\ai-agents\[agentId]\page.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

header_replacement = """                          <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
                             <h2 className="text-[32px] md:text-[40px] font-light text-slate-700 tracking-tight">
                               Explore INSiGHT {exploreTab === "models" ? "Models" : "Agents"}
                             </h2>
                             <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full border border-slate-200/60 self-start md:self-auto">
                               <button onClick={() => setExploreTab("models")} className={`px-5 py-2 text-[13px] font-semibold rounded-full shadow-sm transition-all ${exploreTab === 'models' ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 border border-transparent'}`}>Models</button>
                               <button onClick={() => setExploreTab("agents")} className={`px-5 py-2 text-[13px] font-semibold rounded-full shadow-sm transition-all ${exploreTab === 'agents' ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 border border-transparent'}`}>Agents</button>
                             </div>
                          </div>"""

# Replace the header
content = re.sub(
    r'\<div className="flex items-center justify-between mb-8"\>[\s\S]*?\<\/div\>',
    header_replacement,
    content,
    count=1
)

grid_replacement = """                          {exploreTab === "models" ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                               <div onClick={() => setSelectedExploreItem("Featured")} className="border border-slate-200/80 rounded-2xl p-6 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white group min-h-[140px] flex flex-col justify-center">
                                 <div className="flex items-center gap-3 mb-3">
                                   <div className="w-10 h-10 rounded-xl bg-amber-50 group-hover:bg-amber-100 transition-colors flex items-center justify-center text-amber-500">
                                     <Sparkles className="w-5 h-5" />
                                   </div>
                                   <h3 className="font-medium text-[15px] text-slate-800">Featured</h3>
                                 </div>
                                 <p className="text-[14px] text-slate-600 leading-relaxed font-normal">Test out our premium Groq models.</p>
                               </div>
                               
                               <div onClick={() => setSelectedExploreItem("Conversational AI")} className="border border-slate-200/80 rounded-2xl p-6 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white group min-h-[140px] flex flex-col justify-center">
                                 <div className="flex items-center gap-3 mb-3">
                                   <div className="w-10 h-10 rounded-xl bg-blue-50 group-hover:bg-blue-100 transition-colors flex items-center justify-center text-blue-500">
                                     <MessageSquare className="w-5 h-5" />
                                   </div>
                                   <h3 className="font-medium text-[15px] text-slate-800">Conversational AI</h3>
                                 </div>
                                 <p className="text-[14px] text-slate-600 leading-relaxed font-normal">Converse with our voice agent, Jarvis.</p>
                               </div>
                               
                               <div onClick={() => setSelectedExploreItem("Image Generation")} className="border border-slate-200/80 rounded-2xl p-6 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white group min-h-[140px] flex flex-col justify-center">
                                 <div className="flex items-center gap-3 mb-3">
                                   <div className="w-10 h-10 rounded-xl bg-purple-50 group-hover:bg-purple-100 transition-colors flex items-center justify-center text-purple-500">
                                     <ImageIcon className="w-5 h-5" />
                                   </div>
                                   <h3 className="font-medium text-[15px] text-slate-800">Image Generation</h3>
                                 </div>
                                 <p className="text-[14px] text-slate-600 leading-relaxed font-normal">Create and edit cutting-edge AI images - Coming Soon.</p>
                               </div>
                               
                               <div onClick={() => setSelectedExploreItem("Video Generation")} className="border border-slate-200/80 rounded-2xl p-6 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white group min-h-[140px] flex flex-col justify-center">
                                 <div className="flex items-center gap-3 mb-3">
                                   <div className="w-10 h-10 rounded-xl bg-green-50 group-hover:bg-green-100 transition-colors flex items-center justify-center text-green-600">
                                     <Video className="w-5 h-5" />
                                   </div>
                                   <h3 className="font-medium text-[15px] text-slate-800">Video Generation</h3>
                                 </div>
                                 <p className="text-[14px] text-slate-600 leading-relaxed font-normal">Generate state of the art AI videos - Coming Soon.</p>
                               </div>
                               
                               <div onClick={() => setSelectedExploreItem("Music Generation")} className="border border-slate-200/80 rounded-2xl p-6 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white group min-h-[140px] flex flex-col justify-center">
                                 <div className="flex items-center gap-3 mb-3">
                                   <div className="w-10 h-10 rounded-xl bg-rose-50 group-hover:bg-rose-100 transition-colors flex items-center justify-center text-rose-500">
                                     <Music className="w-5 h-5" />
                                   </div>
                                   <h3 className="font-medium text-[15px] text-slate-800">Music Generation</h3>
                                 </div>
                                 <p className="text-[14px] text-slate-600 leading-relaxed font-normal">Explore our text to speech and music models - Coming Soon.</p>
                               </div>
                               
                               <div onClick={() => setSelectedExploreItem("Code Generation")} className="border border-slate-200/80 rounded-2xl p-6 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white group min-h-[140px] flex flex-col justify-center">
                                 <div className="flex items-center gap-3 mb-3">
                                   <div className="w-10 h-10 rounded-xl bg-orange-50 group-hover:bg-orange-100 transition-colors flex items-center justify-center text-orange-500">
                                     <Code className="w-5 h-5" />
                                   </div>
                                   <h3 className="font-medium text-[15px] text-slate-800">Code Generation</h3>
                                 </div>
                                 <p className="text-[14px] text-slate-600 leading-relaxed font-normal">Tackle your logic-related endeavors.</p>
                               </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                               <div onClick={() => setSelectedExploreItem("Email Agents")} className="border border-slate-200/80 rounded-2xl p-6 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white group min-h-[140px] flex flex-col justify-center">
                                 <div className="flex items-center gap-3 mb-3">
                                   <div className="w-10 h-10 rounded-xl bg-blue-50 group-hover:bg-blue-100 transition-colors flex items-center justify-center text-blue-500">
                                     <Mail className="w-5 h-5" />
                                   </div>
                                   <h3 className="font-medium text-[15px] text-slate-800">Email Agents</h3>
                                 </div>
                                 <p className="text-[14px] text-slate-600 leading-relaxed font-normal">Set up scheduled email campaigns!</p>
                               </div>

                               <div onClick={() => setSelectedExploreItem("Social Media Agents")} className="border border-slate-200/80 rounded-2xl p-6 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white group min-h-[140px] flex flex-col justify-center">
                                 <div className="flex items-center gap-3 mb-3">
                                   <div className="w-10 h-10 rounded-xl bg-pink-50 group-hover:bg-pink-100 transition-colors flex items-center justify-center text-pink-500">
                                     <Users className="w-5 h-5" />
                                   </div>
                                   <h3 className="font-medium text-[15px] text-slate-800">Social Media Agents</h3>
                                 </div>
                                 <p className="text-[14px] text-slate-600 leading-relaxed font-normal">Set up scheduled social media posts.</p>
                               </div>

                               <div onClick={() => setSelectedExploreItem("Message Agents")} className="border border-slate-200/80 rounded-2xl p-6 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white group min-h-[140px] flex flex-col justify-center">
                                 <div className="flex items-center gap-3 mb-3">
                                   <div className="w-10 h-10 rounded-xl bg-emerald-50 group-hover:bg-emerald-100 transition-colors flex items-center justify-center text-emerald-500">
                                     <MessageSquare className="w-5 h-5" />
                                   </div>
                                   <h3 className="font-medium text-[15px] text-slate-800">Message Agents</h3>
                                 </div>
                                 <p className="text-[14px] text-slate-600 leading-relaxed font-normal">Create messaging app integrations with AI.</p>
                               </div>

                               <div onClick={() => setSelectedExploreItem("Advertising Agents")} className="border border-slate-200/80 rounded-2xl p-6 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white group min-h-[140px] flex flex-col justify-center">
                                 <div className="flex items-center gap-3 mb-3">
                                   <div className="w-10 h-10 rounded-xl bg-amber-50 group-hover:bg-amber-100 transition-colors flex items-center justify-center text-amber-500">
                                     <Presentation className="w-5 h-5" />
                                   </div>
                                   <h3 className="font-medium text-[15px] text-slate-800">Advertising Agents</h3>
                                 </div>
                                 <p className="text-[14px] text-slate-600 leading-relaxed font-normal">Build cron jobs for advertising campagins - Coming Soon.</p>
                               </div>

                               <div onClick={() => setIsAgentRequestModalOpen(true)} className="border border-slate-200/80 rounded-2xl p-6 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white group min-h-[140px] flex flex-col justify-center">
                                 <div className="flex items-center gap-3 mb-3">
                                   <div className="w-10 h-10 rounded-xl bg-indigo-50 group-hover:bg-indigo-100 transition-colors flex items-center justify-center text-indigo-500">
                                     <Plus className="w-5 h-5" />
                                   </div>
                                   <h3 className="font-medium text-[15px] text-slate-800">Submit an Agent Request</h3>
                                 </div>
                                 <p className="text-[14px] text-slate-600 leading-relaxed font-normal">Submit a new agent request to the team.</p>
                               </div>

                               <div onClick={() => setSelectedExploreItem("Build your own Agent")} className="border border-slate-200/80 rounded-2xl p-6 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white group min-h-[140px] flex flex-col justify-center">
                                 <div className="flex items-center gap-3 mb-3">
                                   <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-slate-200 transition-colors flex items-center justify-center text-slate-600">
                                     <Settings className="w-5 h-5" />
                                   </div>
                                   <h3 className="font-medium text-[15px] text-slate-800">Build your own Agent</h3>
                                 </div>
                                 <p className="text-[14px] text-slate-600 leading-relaxed font-normal">Configure a custom agent with our drag & drop system - Coming Soon.</p>
                               </div>
                            </div>
                          )}"""

content = re.sub(
    r'\{exploreTab === "models" \? \([\s\S]*?\<\/div\>\n\s*\)\}',
    grid_replacement,
    content,
    count=1
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Patching complete!")
