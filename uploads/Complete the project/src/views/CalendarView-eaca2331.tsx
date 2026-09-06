import { useState } from "react";
import { ChevronLeft, ChevronRight, Settings, Plus, Paperclip, Image as ImageIcon, Mic, Send, Bot, Clock } from "lucide-react";
import { useApp } from "../context/AppContext";

const EVENTS = [
  { id: 1, title: "Design Process", start: 11, duration: 0.5, color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { id: 2, title: "Team Sync", start: 13, duration: 1, color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { id: 3, title: "Client Review", start: 15.5, duration: 1.5, color: "bg-amber-100 text-amber-700 border-amber-200" }
];

export default function CalendarView() {
  const { currentUser } = useApp();
  const [chatInput, setChatInput] = useState("");

  const hours = Array.from({ length: 8 }, (_, i) => i + 9); // 9 AM to 4 PM

  return (
    <div className="flex h-full bg-slate-50">
      {/* Left Column (Schedule View) */}
      <div className="flex-1 flex flex-col border-r border-slate-200 bg-white overflow-hidden min-w-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-[18px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>July 2025</h1>
            <div className="flex items-center gap-1">
              <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
                <ChevronLeft size={16} />
              </button>
              <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
            <button className="px-3 py-1.5 text-[13px] font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 shadow-sm bg-white">
              Today
            </button>
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 shadow-sm bg-white">
            <Settings size={14} /> Manage Widgets
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 relative">
          <div className="relative min-h-[800px]">
            {/* Hourly timeline grid */}
            {hours.map((hour, i) => (
              <div key={hour} className="flex group" style={{ height: "100px" }}>
                <div className="w-16 flex-shrink-0 flex items-start justify-end pr-4 text-[12px] text-slate-400 font-medium relative top-[-8px]">
                  {hour > 12 ? `${hour - 12} PM` : hour === 12 ? "12 PM" : `${hour} AM`}
                </div>
                <div className="flex-1 border-t border-slate-100 relative group-hover:bg-slate-50 transition-colors flex flex-col justify-between">
                  <div className="h-1/2 border-b border-slate-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center pl-4">
                    <button className="hidden group-hover:flex items-center gap-1 text-[11px] font-medium text-indigo-600">
                      <Plus size={12} /> Add Event
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Current Time Indicator (Static for demo - say 10:30 AM) */}
            <div className="absolute left-16 right-0 border-t-2 border-red-500 z-10 flex items-center" style={{ top: "150px" }}>
              <div className="w-2 h-2 rounded-full bg-red-500 absolute -left-1 transform -translate-y-1/2" />
            </div>

            {/* Events */}
            {EVENTS.map(ev => {
              const top = (ev.start - 9) * 100;
              const height = ev.duration * 100;
              return (
                <div
                  key={ev.id}
                  className={`absolute left-20 right-8 rounded-lg border p-3 flex flex-col cursor-pointer hover:shadow-md transition-shadow ${ev.color}`}
                  style={{ top: `${top}px`, height: `${height}px` }}
                >
                  <span className="text-[12px] font-bold tracking-tight">{ev.title}</span>
                  <span className="text-[11px] font-medium opacity-80 mt-0.5 flex items-center gap-1">
                    <Clock size={10} /> {ev.start > 12 ? ev.start - 12 : ev.start}:00 {ev.start >= 12 ? 'PM' : 'AM'} - {ev.start + ev.duration > 12 ? (ev.start + ev.duration) - 12 : ev.start + ev.duration}:{(ev.start + ev.duration) % 1 === 0.5 ? '30' : '00'} {ev.start + ev.duration >= 12 ? 'PM' : 'AM'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Column (AI Assistant / Context Panel) */}
      <div className="w-80 border-l border-slate-200 bg-white flex flex-col flex-shrink-0">
        <div className="flex items-center justify-center py-4 border-b border-slate-200 bg-slate-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-indigo-600" />
            <h2 className="text-[13px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>AI Assistant</h2>
            <span className="text-[9px] text-slate-400 font-medium px-1.5 py-0.5 border border-slate-200 rounded uppercase tracking-wider bg-white">Powered by ChatGPT</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 flex-shrink-0 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
              <Bot size={14} />
            </div>
            <div className="flex-1">
              <div className="bg-white border border-slate-200 rounded-xl rounded-tl-sm px-3 py-2.5 text-[13px] text-slate-700 shadow-sm">
                Good morning! You have the Design Process meeting at 11:00 AM. Would you like me to prepare the briefing document?
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 flex-row-reverse">
            <div className="w-7 h-7 flex-shrink-0 rounded-lg bg-slate-200 flex items-center justify-center text-[11px] font-bold text-slate-700">
              {currentUser.avatar}
            </div>
            <div className="flex-1">
              <div className="bg-indigo-600 text-white rounded-xl rounded-tr-sm px-3 py-2.5 text-[13px] shadow-sm">
                Yes, please draft the document and pull in the latest analytics from last week's test.
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-slate-200 bg-white">
          <div className="flex items-center gap-1.5 mb-2 px-1">
            <button className="text-slate-400 hover:text-slate-600 transition-colors"><Paperclip size={16} /></button>
            <button className="text-slate-400 hover:text-slate-600 transition-colors"><ImageIcon size={16} /></button>
            <button className="text-slate-400 hover:text-slate-600 transition-colors"><Mic size={16} /></button>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="text" 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask anything..." 
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
            />
            <button className="w-9 h-9 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors disabled:opacity-50" disabled={!chatInput.trim()}>
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}