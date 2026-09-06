import { useState, useRef, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { Send, Bot, Hash, ChevronDown, Search, Filter, Edit, Plane, MoreVertical, Phone, Video, Paperclip, Smile, Image as ImageIcon } from "lucide-react";

function timeStr(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Avatar({ initials, isAgent, isOnline }: { initials: string; isAgent?: boolean; isOnline?: boolean }) {
  return (
    <div className="relative">
      <div className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center text-[13px] font-bold ${
        isAgent ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 text-slate-700"
      }`}>
        {isAgent ? <Bot size={18} /> : initials.slice(0, 2)}
      </div>
      {isOnline !== undefined && (
        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
      )}
    </div>
  );
}

export default function ChatView() {
  const { threads, messages, sendMessage, selectedThreadId, setSelectedThreadId } = useApp();
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const currentThread = threads.find((t) => t.id === selectedThreadId);
  const currentMessages = messages[selectedThreadId] ?? [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages]);

  function handleSend() {
    if (!input.trim() || !selectedThreadId) return;
    sendMessage(selectedThreadId, input.trim());
    setInput("");
  }

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden">
      {/* Left Sub-Sidebar (Conversations List, ~320px width) */}
      <div className="w-[320px] flex-shrink-0 bg-white border-r border-slate-200 flex flex-col z-10 shadow-sm">
        {/* Header controls */}
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 cursor-pointer text-slate-900 hover:text-indigo-600 transition-colors">
              <span className="text-[14px] font-bold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Grouped by</span>
              <ChevronDown size={16} />
            </div>
            <div className="flex items-center gap-3 text-slate-400">
              <Search size={18} className="cursor-pointer hover:text-slate-700 transition-colors" />
              <Filter size={18} className="cursor-pointer hover:text-slate-700 transition-colors" />
              <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-indigo-100 transition-colors">
                <Edit size={14} />
              </div>
            </div>
          </div>
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search conversations..." 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-[13px] focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
            />
            <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        {/* Conversation Categories */}
        <div className="flex-1 overflow-y-auto py-2">
          {/* Unread */}
          <div className="mb-4">
            <div className="px-5 py-2 flex items-center gap-2 text-[12px] font-bold text-slate-400 uppercase tracking-wider">
              <ChevronDown size={14} /> Unread
            </div>
            {threads.filter(t => t.unread > 0).map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedThreadId(t.id)}
                className={`w-full text-left px-5 py-3 transition-colors ${
                  t.id === selectedThreadId ? "bg-indigo-50" : "hover:bg-slate-50"
                }`}
              >
                <div className="flex gap-3">
                  <Avatar initials={t.name} isAgent={t.type === 'agent'} isOnline={true} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className={`text-[14px] font-bold truncate ${t.id === selectedThreadId ? "text-indigo-900" : "text-slate-900"}`}>
                        {t.name}
                      </span>
                      <span className={`text-[11px] font-medium flex-shrink-0 ${t.unread > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
                        12:45 PM
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <p className={`text-[13px] truncate ${t.unread > 0 ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>
                        {t.lastMessage}
                      </p>
                      <div className="w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                        {t.unread}
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Favorite Messages */}
          <div className="mb-4">
            <div className="px-5 py-2 flex items-center gap-2 text-[12px] font-bold text-slate-400 uppercase tracking-wider">
              <ChevronDown size={14} /> Favorite Messages
            </div>
            {/* Mocked favorite */}
            <button
              onClick={() => {}}
              className="w-full text-left px-5 py-3 transition-colors hover:bg-slate-50"
            >
              <div className="flex gap-3">
                <Avatar initials="Design Team" isAgent={false} isOnline={false} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className="text-[14px] font-bold text-slate-900 truncate">Design Team</span>
                    <span className="text-[11px] font-medium text-slate-400 flex-shrink-0">Yesterday</span>
                  </div>
                  <p className="text-[13px] text-slate-500 truncate">Here are the new mockups for...</p>
                </div>
              </div>
            </button>
          </div>

          {/* Direct Messages */}
          <div className="mb-4">
            <div className="px-5 py-2 flex items-center gap-2 text-[12px] font-bold text-slate-400 uppercase tracking-wider">
              <ChevronDown size={14} /> Direct Messages
            </div>
            {threads.filter(t => t.unread === 0).map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedThreadId(t.id)}
                className={`w-full text-left px-5 py-3 transition-colors ${
                  t.id === selectedThreadId ? "bg-indigo-50" : "hover:bg-slate-50"
                }`}
              >
                <div className="flex gap-3">
                  <Avatar initials={t.name} isAgent={t.type === 'agent'} isOnline={false} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className={`text-[14px] font-bold truncate ${t.id === selectedThreadId ? "text-indigo-900" : "text-slate-900"}`}>
                        {t.name}
                      </span>
                      <span className="text-[11px] font-medium text-slate-400 flex-shrink-0">
                        {t.lastActivity ? new Date(t.lastActivity).toLocaleDateString([], { month: 'short', day: 'numeric'}) : 'Mon'}
                      </span>
                    </div>
                    <p className="text-[13px] text-slate-500 truncate">{t.lastMessage}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel (Active Workspace / Stage) */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#F8F9FC]">
        {currentThread ? (
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shadow-sm z-10">
              <div className="flex items-center gap-4">
                <Avatar initials={currentThread.name} isAgent={currentThread.type === 'agent'} isOnline={true} />
                <div>
                  <h2 className="text-[16px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {currentThread.name}
                  </h2>
                  <p className="text-[12px] text-emerald-500 font-medium">Online</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-slate-400">
                <Phone size={20} className="cursor-pointer hover:text-indigo-600 transition-colors" />
                <Video size={20} className="cursor-pointer hover:text-indigo-600 transition-colors" />
                <div className="w-px h-6 bg-slate-200" />
                <MoreVertical size={20} className="cursor-pointer hover:text-slate-700 transition-colors" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {currentMessages.map((msg) => {
                const isMe = msg.senderType === "human" && msg.sender === "You"; // Simple mock
                return (
                  <div key={msg.id} className={`flex flex-col max-w-2xl ${isMe ? 'self-end items-end ml-auto' : 'self-start items-start'}`}>
                    <div className="flex items-baseline gap-2 mb-1.5 px-1">
                      <span className="text-[13px] font-bold text-slate-900">{isMe ? "You" : msg.sender}</span>
                      <span className="text-[11px] font-medium text-slate-400">{timeStr(msg.timestamp)}</span>
                    </div>
                    <div className={`rounded-2xl px-5 py-3.5 text-[14px] leading-relaxed shadow-sm ${
                      isMe
                        ? "bg-indigo-600 text-white rounded-tr-sm"
                        : "bg-white border border-slate-200 text-slate-700 rounded-tl-sm"
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>

            <div className="p-6 bg-white border-t border-slate-200">
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-2 pr-3 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-400 transition-all">
                <div className="flex gap-1 pl-2 text-slate-400">
                  <button className="p-1.5 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"><Smile size={20} /></button>
                  <button className="p-1.5 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"><Paperclip size={20} /></button>
                  <button className="p-1.5 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"><ImageIcon size={20} /></button>
                </div>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Type a message..."
                  className="flex-1 bg-transparent text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none min-w-0"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="w-10 h-10 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex-shrink-0 shadow-sm"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-[#F8F9FC]">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
              <Plane size={32} className="text-slate-300" />
            </div>
            <h3 className="text-[18px] font-bold text-slate-900 mb-2">Your Messages</h3>
            <p className="text-[14px]">Select a chat to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}