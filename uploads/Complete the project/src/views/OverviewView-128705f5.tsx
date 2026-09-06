import { useApp } from "../context/AppContext";
import { FolderKanban, CheckSquare, Bot, DollarSign, ArrowUpRight, CheckCircle2, Circle, MoreHorizontal, ChevronRight, ChevronLeft, Play, LayoutDashboard, Clock, FileText, Calendar as CalendarIcon, Hash } from "lucide-react";

export default function OverviewView() {
  const { currentUser } = useApp();

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Top Section: Profile Status Banner */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col md:flex-row gap-6">
            <div className="flex-1 flex flex-col justify-center">
              <h1 className="text-[20px] font-bold text-slate-900 tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Welcome back, {currentUser.name}
              </h1>
              <p className="text-[13px] text-slate-500 mt-1 mb-4">Complete your profile to unlock all AI agent capabilities.</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[13px] text-slate-700">
                  <CheckCircle2 size={16} className="text-emerald-500" /> Connect calendar account
                </div>
                <div className="flex items-center gap-2 text-[13px] text-slate-700">
                  <CheckCircle2 size={16} className="text-emerald-500" /> Create your first agent room
                </div>
                <div className="flex items-center gap-2 text-[13px] text-slate-700">
                  <Circle size={16} className="text-slate-300" /> Set up payment method
                </div>
              </div>
            </div>
            
            <div className="w-48 flex-shrink-0 flex flex-col items-center justify-center border-l border-slate-100 pl-6">
              <div className="relative w-24 h-24 flex items-center justify-center mb-2">
                {/* Radial graph placeholder */}
                <svg viewBox="0 0 36 36" className="w-full h-full text-slate-100">
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#6366f1" strokeWidth="4" strokeDasharray="75, 100" />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-[20px] font-bold text-slate-900">75%</span>
                </div>
              </div>
              <p className="text-[12px] text-slate-500 font-medium">Profile Completion</p>
            </div>

            <div className="w-64 flex-shrink-0 bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1 block">Pro Tip</span>
                <p className="text-[13px] text-indigo-900 font-medium leading-snug">Invite team members to collaborate in Live Build Rooms.</p>
              </div>
              <button className="text-[12px] bg-indigo-600 text-white font-medium py-1.5 px-3 rounded-lg w-fit mt-3 hover:bg-indigo-700 transition-colors">
                Invite Team
              </button>
            </div>
          </div>

          {/* Overview Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative overflow-hidden">
              <div className="text-[13px] text-slate-500 font-medium mb-1">Daily Meetings</div>
              <div className="text-[24px] font-bold text-slate-900 tracking-tight mb-4">4</div>
              {/* Line graph overlay placeholder */}
              <div className="absolute bottom-0 left-0 right-0 h-12 opacity-20 bg-gradient-to-t from-indigo-500 to-transparent" />
              <svg className="absolute bottom-0 left-0 right-0 w-full h-12 text-indigo-500 opacity-50" preserveAspectRatio="none" viewBox="0 0 100 100">
                <polyline points="0,100 0,50 20,60 40,30 60,70 80,40 100,20 100,100" fill="currentColor" />
              </svg>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative overflow-hidden">
              <div className="text-[13px] text-slate-500 font-medium mb-1">Booked Meetings</div>
              <div className="text-[24px] font-bold text-slate-900 tracking-tight mb-4">12</div>
              {/* Bar chart overlay placeholder */}
              <div className="absolute bottom-0 left-0 right-0 h-12 flex items-end gap-1 px-4">
                {[40, 60, 30, 80, 50, 70, 90, 40].map((h, i) => (
                  <div key={i} className="flex-1 bg-emerald-100 rounded-t-sm" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative overflow-hidden">
              <div className="text-[13px] text-slate-500 font-medium mb-1">Monthly Income</div>
              <div className="text-[24px] font-bold text-slate-900 tracking-tight mb-4">$12,450</div>
              {/* Area chart overlay placeholder */}
              <svg className="absolute bottom-0 left-0 right-0 w-full h-12 text-amber-500 opacity-20" preserveAspectRatio="none" viewBox="0 0 100 100">
                <polygon points="0,100 0,80 30,50 60,60 100,20 100,100" fill="currentColor" />
              </svg>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative overflow-hidden">
              <div className="text-[13px] text-slate-500 font-medium mb-1">Used Storage</div>
              <div className="text-[24px] font-bold text-slate-900 tracking-tight mb-2">45 GB</div>
              <div className="flex gap-2">
                <div className="flex-1 h-1.5 bg-indigo-500 rounded-full" />
                <div className="flex-1 h-1.5 bg-emerald-500 rounded-full" />
                <div className="flex-1 h-1.5 bg-amber-500 rounded-full" />
                <div className="flex-1 h-1.5 bg-slate-200 rounded-full" />
              </div>
            </div>
          </div>

          <div className="flex gap-6">
            {/* Left Column (Main Content) */}
            <div className="flex-1 space-y-6 min-w-0">
              {/* Upcoming Meetings Carousel */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[16px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Upcoming Meetings</h2>
                  <button className="text-[13px] text-indigo-600 font-medium hover:text-indigo-700">View All</button>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  <div className="w-80 flex-shrink-0 bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Live</span>
                      <MoreHorizontal size={16} className="text-slate-400" />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-bold text-slate-900">Design Process</h3>
                      <p className="text-[12px] text-slate-500">Workspace / UI/UX</p>
                    </div>
                    <div className="flex items-center gap-2 text-[12px] font-medium text-slate-700">
                      <Clock size={14} className="text-indigo-500" /> 11:00 AM - 11:30 AM
                    </div>
                    <div className="flex items-center justify-between mt-1 pt-3 border-t border-slate-100">
                      <div className="flex -space-x-2">
                        <div className="w-7 h-7 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600 z-30">AJ</div>
                        <div className="w-7 h-7 rounded-full bg-slate-300 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600 z-20">MK</div>
                        <div className="w-7 h-7 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-500 z-10">+45</div>
                      </div>
                      <button className="text-[12px] bg-indigo-600 text-white font-medium py-1.5 px-4 rounded-lg hover:bg-indigo-700 transition-colors">
                        Join Now
                      </button>
                    </div>
                  </div>

                  <div className="w-80 flex-shrink-0 bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Start in 5 min</span>
                      <MoreHorizontal size={16} className="text-slate-400" />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-bold text-slate-900">Team Sync</h3>
                      <p className="text-[12px] text-slate-500">Workspace / Engineering</p>
                    </div>
                    <div className="flex items-center gap-2 text-[12px] font-medium text-slate-700">
                      <Clock size={14} className="text-amber-500" /> 1:00 PM - 2:00 PM
                    </div>
                    <div className="flex items-center justify-between mt-1 pt-3 border-t border-slate-100">
                      <div className="flex -space-x-2">
                        <div className="w-7 h-7 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600 z-30">SC</div>
                        <div className="w-7 h-7 rounded-full bg-slate-300 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600 z-20">TR</div>
                      </div>
                      <button className="text-[12px] bg-white border border-slate-200 text-slate-700 font-medium py-1.5 px-4 rounded-lg hover:bg-slate-50 transition-colors">
                        Details
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rooms Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[16px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Rooms</h2>
                  <button className="flex items-center gap-1.5 text-[12px] bg-indigo-50 text-indigo-700 font-medium py-1.5 px-3 rounded-lg hover:bg-indigo-100 transition-colors">
                    + New Room
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-[14px] font-bold text-slate-900">Personal Room</h3>
                        <span className="text-[11px] text-slate-400">/NAME</span>
                      </div>
                      <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                        <Hash size={18} className="text-indigo-600" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center text-[11px] font-bold text-emerald-700 z-30">AJ</div>
                        <div className="w-8 h-8 rounded-full bg-cyan-100 border-2 border-white flex items-center justify-center text-[11px] font-bold text-cyan-700 z-20">TR</div>
                      </div>
                      <span className="text-[12px] text-slate-500 font-medium px-2 py-1 bg-slate-50 rounded-md">2 Active</span>
                    </div>
                    <button className="w-full text-[13px] bg-white border border-indigo-200 text-indigo-700 font-bold py-2 rounded-lg hover:bg-indigo-50 transition-colors">
                      Join Room
                    </button>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-[14px] font-bold text-slate-900">Engineering Sync</h3>
                        <span className="text-[11px] text-slate-400">/ENGINEERING</span>
                      </div>
                      <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                        <Hash size={18} className="text-amber-600" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-2">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[11px] font-bold text-slate-500 z-10 opacity-50"><Bot size={14}/></div>
                      </div>
                      <span className="text-[12px] text-slate-400 font-medium px-2 py-1 bg-slate-50 rounded-md">Empty</span>
                    </div>
                    <button className="w-full text-[13px] bg-slate-50 text-slate-400 font-bold py-2 rounded-lg cursor-not-allowed">
                      Join Room
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column (Utility Sidebar) */}
            <div className="w-72 flex-shrink-0 flex flex-col gap-6">
              {/* Mini Calendar Widget */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[14px] font-bold text-slate-900">July 2025</h3>
                  <div className="flex gap-1 text-slate-400">
                    <ChevronLeft size={16} />
                    <ChevronRight size={16} />
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                    <div key={d} className="text-[10px] font-bold text-slate-400 uppercase">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-[12px] font-medium text-slate-700">
                  {Array.from({length: 31}).map((_, i) => (
                    <div key={i} className={`w-8 h-8 flex items-center justify-center rounded-lg mx-auto ${i+1 === 15 ? 'bg-indigo-600 text-white shadow-sm' : 'hover:bg-slate-100'}`}>
                      {i + 1}
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5" />
                    <div>
                      <div className="text-[12px] font-bold text-slate-900">Design Process</div>
                      <div className="text-[11px] text-slate-500">11:00 AM - 11:30 AM</div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5" />
                    <div>
                      <div className="text-[12px] font-bold text-slate-900">Team Sync</div>
                      <div className="text-[11px] text-slate-500">1:00 PM - 2:00 PM</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Members */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-[14px] font-bold text-slate-900 mb-4">Active Members</h3>
                <div className="space-y-4">
                  {[
                    { id: 1, name: "Sarah Chen", role: "Frontend", status: "bg-emerald-500" },
                    { id: 2, name: "Alex Johnson", role: "Design", status: "bg-emerald-500" },
                    { id: 3, name: "CodeSage (AI)", role: "Backend Agent", status: "bg-indigo-500 animate-pulse" },
                    { id: 4, name: "Maria Garcia", role: "Product", status: "bg-amber-500" },
                  ].map(m => (
                    <div key={m.id} className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[11px] font-bold text-slate-700">
                          {m.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${m.status}`} />
                      </div>
                      <div>
                        <div className="text-[13px] font-bold text-slate-900">{m.name}</div>
                        <div className="text-[11px] text-slate-500">{m.role}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}