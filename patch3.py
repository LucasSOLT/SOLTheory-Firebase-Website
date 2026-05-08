import re

file_path = r"c:\Users\lucas\Desktop\SOLTheory-Firebase-Website\src\app\portal\dashboard\soltheory\ai-agents\[agentId]\page.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Remove Jarvis text from start screen
content = content.replace(
    '<div className="text-3xl font-black opacity-10 tracking-[0.3em] uppercase mb-16">{agent.name}</div>',
    ''
)

# 2. Add New Chat tile
new_chat_btn = """          <div className="text-xs font-semibold text-slate-900  mb-2 px-1 uppercase tracking-widest">Chat History</div>
          <button onClick={() => startNewSession()} className="w-full text-left p-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center gap-3 mb-4 group">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-100 transition-colors">
              <Plus className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold text-slate-700">New Chat</span>
          </button>"""

content = content.replace('<div className="text-xs font-semibold text-slate-900  mb-2 px-1 uppercase tracking-widest">Chat History</div>', new_chat_btn)

# 3. Fix 3 intro responses (Replace 3 blocks with 1)
# We find the section after the chat heading
chat_heading = '<div className="text-3xl font-black opacity-10 tracking-[0.3em] uppercase text-center max-w-full truncate px-4">{selectedExploreItem ? `${exploreItemsMeta[selectedExploreItem]?.name || \'\'} - ${selectedExploreItem}` : agent.name}</div>\n                        </div>'

# The single correct block
single_intro_block = """                        <div className="flex gap-4">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border border-slate-300  bg-slate-200/50 `}><Bot className={`w-5 h-5 ${agent.accent}`} /></div>
                          <div className="flex-1 space-y-1 pt-1">
                            <div className="font-bold text-sm text-slate-700 ">{selectedExploreItem ? exploreItemsMeta[selectedExploreItem]?.name || agent.name.split(' ')[0] : agent.name.split(' ')[0]}</div>
                            <div className={`text-slate-800  inline-block p-4 rounded-2xl rounded-tl-sm border backdrop-blur-md ${agent.chatBg}`}>{selectedExploreItem ? exploreItemsMeta[selectedExploreItem]?.greeting || agent.greeting : agent.greeting}</div>
                          </div>
                        </div>"""

# Find where it starts and replace everything up to {messages.map
start_idx = content.find(chat_heading)
if start_idx != -1:
    end_idx = content.find('{messages.map(msg => (', start_idx)
    if end_idx != -1:
        # Replace the middle part
        content = content[:start_idx + len(chat_heading)] + '\n' + single_intro_block + '\n                        ' + content[end_idx:]


# 4. Curve tiles more and center text and header
content = content.replace("rounded-2xl p-6", "rounded-3xl p-6 text-center items-center")
# Fix the h3 and icon centering by making flex col
content = content.replace('className="flex items-center gap-3 mb-3"', 'className="flex flex-col items-center gap-3 mb-3"')
# Update the header flex direction to center the content
old_header = '<div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">'
new_header = '<div className="flex flex-col items-center justify-center text-center mb-10 gap-6">'
content = content.replace(old_header, new_header)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Patch 3 complete!")
