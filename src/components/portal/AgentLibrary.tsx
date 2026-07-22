"use client";

import React, { useState } from 'react';
import { 
  Bot, 
  Sparkles, 
  Image as ImageIcon, 
  Video, 
  Music, 
  Code, 
  Mail, 
  Share2, 
  MessageCircle, 
  Megaphone, 
  Wrench,
  X
} from 'lucide-react';

type Agent = {
  id: string;
  name: string;
  title: string;
  description: string;
  status: 'Active' | 'Coming Soon';
  category: string;
  icon: any; // using any to bypass LucideIcon types issue with size
};

const AGENTS: Agent[] = [
  {
    id: 'jarvis',
    name: 'Jarvis',
    title: 'Executive AI Assistant',
    status: 'Active',
    category: 'Productivity',
    description: 'Email, calendar, drive, and executive task management',
    icon: Bot
  },
  {
    id: 'felix',
    name: 'Felix',
    title: 'Premium AI Models',
    status: 'Active',
    category: 'Premium',
    description: 'Access to advanced AI models for complex tasks',
    icon: Sparkles
  },
  {
    id: 'iris',
    name: 'Iris',
    title: 'Image Generation',
    status: 'Coming Soon',
    category: 'Creative',
    description: 'Generate images and visual assets with AI',
    icon: ImageIcon
  },
  {
    id: 'victor',
    name: 'Victor',
    title: 'Video Generation',
    status: 'Coming Soon',
    category: 'Creative',
    description: 'Create and edit videos with AI assistance',
    icon: Video
  },
  {
    id: 'mac',
    name: 'Mac',
    title: 'Music Generation',
    status: 'Coming Soon',
    category: 'Creative',
    description: 'Compose and produce music with AI',
    icon: Music
  },
  {
    id: 'cody',
    name: 'Cody',
    title: 'Code Generation',
    status: 'Coming Soon',
    category: 'Developer',
    description: 'Write, debug, and refactor code',
    icon: Code
  },
  {
    id: 'emma',
    name: 'Emma',
    title: 'Email Agent',
    status: 'Coming Soon',
    category: 'Communication',
    description: 'Automated email management and campaigns',
    icon: Mail
  },
  {
    id: 'sam',
    name: 'Sam',
    title: 'Social Media Agent',
    status: 'Coming Soon',
    category: 'Marketing',
    description: 'Social media scheduling and content creation',
    icon: Share2
  },
  {
    id: 'max',
    name: 'Max',
    title: 'Messaging Agent',
    status: 'Coming Soon',
    category: 'Communication',
    description: 'Automated messaging across platforms',
    icon: MessageCircle
  },
  {
    id: 'adam',
    name: 'Adam',
    title: 'Advertising Agent',
    status: 'Coming Soon',
    category: 'Marketing',
    description: 'AI-powered ad creation and optimization',
    icon: Megaphone
  },
  {
    id: 'builder',
    name: 'Builder',
    title: 'Custom Agent Builder',
    status: 'Coming Soon',
    category: 'Advanced',
    description: 'Build your own custom AI agent',
    icon: Wrench
  }
];

const CATEGORIES = ['All', 'Productivity', 'Creative', 'Communication', 'Marketing', 'Developer', 'Advanced', 'Premium'];

interface AgentLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAgent: (agentId: string) => void;
  isDarkMode: boolean;
}

export default function AgentLibrary({ isOpen, onClose, onSelectAgent, isDarkMode }: AgentLibraryProps) {
  const [selectedCategory, setSelectedCategory] = useState('All');

  if (!isOpen) return null;

  const filteredAgents = AGENTS.filter(agent => 
    selectedCategory === 'All' ? true : agent.category === selectedCategory
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm bg-black/40 transition-opacity animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl shadow-2xl transform transition-all animate-in slide-in-from-bottom-4 duration-300 ${
          isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-gray-200'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${isDarkMode ? 'border-slate-800' : 'border-gray-200'}`}>
          <div>
            <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Agent Library</h2>
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>Browse and deploy AI agents</p>
          </div>
          <button 
            onClick={onClose}
            className={`p-2 rounded-full transition-colors ${
              isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'
            }`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Categories */}
        <div className={`px-6 py-4 border-b overflow-x-auto whitespace-nowrap scrollbar-hide ${isDarkMode ? 'border-slate-800' : 'border-gray-200'}`}>
          <div className="flex space-x-2">
            {CATEGORIES.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === category
                    ? isDarkMode 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-blue-600 text-white'
                    : isDarkMode
                      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAgents.map(agent => (
              <div 
                key={agent.id}
                className={`flex flex-col rounded-xl border p-5 transition-all duration-200 ${
                  isDarkMode 
                    ? 'bg-slate-800/80 border-slate-700 hover:border-slate-600 hover:bg-slate-800' 
                    : 'bg-[#faf8f3] border-gray-200 hover:border-gray-300 hover:shadow-md'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-lg ${
                    isDarkMode ? 'bg-slate-900/50 text-blue-400' : 'bg-white text-blue-600 shadow-sm'
                  }`}>
                    <agent.icon size={24} />
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    agent.status === 'Active'
                      ? isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                      : isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {agent.status}
                  </span>
                </div>
                
                <h3 className={`text-lg font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {agent.name}
                  <span className={`block text-xs font-normal mt-0.5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                    {agent.title}
                  </span>
                </h3>
                
                <p className={`text-sm mb-6 flex-1 ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>
                  {agent.description}
                </p>

                <button
                  onClick={() => {
                    if (agent.status === 'Active') {
                      onSelectAgent(agent.id);
                      onClose();
                    }
                  }}
                  disabled={agent.status !== 'Active'}
                  className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    agent.status === 'Active'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : isDarkMode 
                        ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed border border-slate-700/50' 
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                  }`}
                >
                  {agent.status === 'Active' ? 'Launch' : 'Coming Soon'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
