import { useState } from "react";
import {
  LayoutDashboard, Bell, MessageSquare, CheckSquare, Kanban,   FolderKanban,
  FileText, PlusCircle, ClipboardList, Bot, Users, Cpu, Wrench, Rocket,
  BarChart2, CreditCard, Settings, ChevronRight, ChevronDown, ChevronLeft,
  Zap, Calendar
} from "lucide-react";
import { MASTER_NAVIGATION } from "../config/navigationSchema";
import { getVisibleSections, getVisibleItems, getItemLabel, getSectionLabel } from "../config/navigationRBAC";
import { useApp } from "../context/AppContext";
import type { ViewId, SectionId } from "../config/types";

const ICONS: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard size={15} />,
  Bell: <Bell size={15} />,
  MessageSquare: <MessageSquare size={15} />,
  CheckSquare: <CheckSquare size={15} />,
  Kanban: <Kanban size={15} />,
  FolderKanban: <FolderKanban size={15} />,
  Calendar: <Calendar size={15} />,
  FileText: <FileText size={15} />,
  PlusCircle: <PlusCircle size={15} />,
  ClipboardList: <ClipboardList size={15} />,
  Bot: <Bot size={15} />,
  Users: <Users size={15} />,
  Cpu: <Cpu size={15} />,
  Wrench: <Wrench size={15} />,
  Rocket: <Rocket size={15} />,
  BarChart2: <BarChart2 size={15} />,
  CreditCard: <CreditCard size={15} />,
  Settings: <Settings size={15} />,
  Inbox: <Bell size={15} />,
  Zap: <Zap size={15} />,
};

const ROLE_LABELS: Record<string, string> = {
  client: "Client",
  dev: "Developer",
  pm: "Project Manager",
  admin: "Admin",
};

const ROLE_CLS: Record<string, string> = {
  client: "text-sky-700 bg-sky-50 border border-sky-200",
  dev: "text-emerald-700 bg-emerald-50 border border-emerald-200",
  pm: "text-amber-700 bg-amber-50 border border-amber-200",
  admin: "text-indigo-700 bg-indigo-50 border border-indigo-200",
};

export default function HierarchicalSidebar() {
  const { role, switchRole, activeView, setActiveView, currentUser, unreadCount } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Set<SectionId>>(
    new Set(["workspace", "work", "ai_ops", "delivery", "insights", "settings_section", "requests"])
  );
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  const visibleSections = getVisibleSections(role);

  function toggleSection(id: SectionId) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (collapsed) {
    return (
      <div className="w-[52px] flex-shrink-0 bg-white border-r border-slate-200 flex flex-col items-center py-3 gap-0.5">
        <button
          onClick={() => setCollapsed(false)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors mb-3"
        >
          <ChevronRight size={14} />
        </button>
        {MASTER_NAVIGATION.filter((s) => visibleSections.includes(s.id)).map((section) => {
          const visItems = getVisibleItems(role, section.id);
          return visItems.map((itemId) => {
            const item = section.items.find((i) => i.id === itemId);
            if (!item) return null;
            const isActive = activeView === itemId;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                title={getItemLabel(role, item.id, item.label)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  isActive
                    ? "bg-indigo-50 text-indigo-600"
                    : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                }`}
              >
                {ICONS[item.icon]}
              </button>
            );
          });
        })}
      </div>
    );
  }

  return (
    <div className="w-56 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col select-none">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm">
            <Bot size={14} className="text-white" />
          </div>
          <span className="text-[14px] font-bold text-slate-900 tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Alpha
          </span>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <ChevronLeft size={13} />
        </button>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-3">
        {MASTER_NAVIGATION.filter((section) => visibleSections.includes(section.id)).map((section) => {
          const visItemIds = getVisibleItems(role, section.id);
          const visItems = section.items.filter((item) => visItemIds.includes(item.id));
          if (visItems.length === 0) return null;

          const isOpen = openSections.has(section.id);
          const sectionLabel = getSectionLabel(role, section.id, section.label);

          return (
            <div key={section.id} className="mb-1">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-2 px-4 py-1.5 text-[10px] text-slate-400 hover:text-slate-600 uppercase tracking-widest font-semibold transition-colors"
              >
                <span className="flex-1 text-left">{sectionLabel}</span>
                {isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              </button>
              {isOpen && (
                <div className="pb-1">
                  {visItems.map((item) => {
                    const label = getItemLabel(role, item.id, item.label);
                    const isActive = activeView === item.id;
                    const showBadge = item.id === "inbox" && unreadCount > 0;
                    const isLiveBuild = item.id === "live_build";
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveView(item.id)}
                        className={`w-full flex items-center gap-2.5 px-4 py-[7px] text-[13px] transition-colors relative ${
                          isActive
                            ? "bg-indigo-50 text-indigo-700 border-r-2 border-indigo-600 font-medium"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                        }`}
                      >
                        <span className={isActive ? "text-indigo-600" : isLiveBuild ? "text-amber-500" : "text-slate-400"}>
                          {ICONS[item.icon]}
                        </span>
                        <span className="flex-1 text-left">{label}</span>
                        {isLiveBuild && (
                          <span className="text-[9px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider">
                            Live
                          </span>
                        )}
                        {showBadge && (
                          <span className="w-4 h-4 text-[10px] bg-indigo-600 text-white rounded-full flex items-center justify-center font-semibold">
                            {unreadCount > 9 ? "9+" : unreadCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* User footer */}
      <div className="border-t border-slate-200 p-3 relative">
        <button
          onClick={() => setRoleMenuOpen((v) => !v)}
          className="w-full flex items-center gap-3 hover:bg-slate-50 rounded-lg px-2 py-2 transition-colors"
        >
          <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center text-[11px] font-bold text-slate-700 flex-shrink-0">
            {currentUser.avatar}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[12px] font-semibold text-slate-900 truncate">{currentUser.name}</p>
            <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded font-medium ${ROLE_CLS[role]}`}>
              {ROLE_LABELS[role]}
            </span>
          </div>
          <ChevronRight
            size={11}
            className={`text-slate-400 transition-transform flex-shrink-0 ${roleMenuOpen ? "rotate-90" : ""}`}
          />
        </button>

        {roleMenuOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-1 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-lg z-50">
            <p className="px-3 py-2 text-[10px] text-slate-400 uppercase tracking-widest font-semibold border-b border-slate-100">
              Switch Role
            </p>
            {(["admin", "pm", "dev", "client"] as const).map((r) => (
              <button
                key={r}
                onClick={() => { switchRole(r); setRoleMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] transition-colors ${
                  r === role ? "bg-indigo-50" : "hover:bg-slate-50"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    r === role ? "bg-indigo-500" : "bg-slate-200"
                  }`}
                />
                <span className={r === role ? "text-indigo-700 font-medium" : "text-slate-700"}>
                  {ROLE_LABELS[r]}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
