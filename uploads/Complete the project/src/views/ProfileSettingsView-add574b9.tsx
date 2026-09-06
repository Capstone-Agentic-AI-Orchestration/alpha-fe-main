import { useState } from "react";
import { useApp } from "../context/AppContext";
import { Upload, Trash2, Camera } from "lucide-react";

const TABS = ["Edit Profile", "Account Security", "Notifications", "Integrations", "Sessions", "Appearance"] as const;
type Tab = (typeof TABS)[number];

export default function ProfileSettingsView() {
  const { currentUser } = useApp();
  const [tab, setTab] = useState<Tab>("Edit Profile");

  return (
    <div className="flex h-full bg-[#F8F9FC] overflow-hidden">
      {/* Left Navigation Column */}
      <div className="w-64 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col p-6 z-10">
        <h1 className="text-[20px] font-bold text-slate-900 mb-8" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Settings</h1>
        <div className="flex flex-col gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`w-full text-left px-4 py-2.5 text-[14px] font-medium rounded-lg transition-colors ${
                tab === t 
                  ? "bg-indigo-50 text-indigo-700" 
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-8">
          
          {/* Main Content Area (Edit Profile Form) */}
          <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
            <h2 className="text-[20px] font-bold text-slate-900 mb-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Edit Profile
            </h2>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-900">Display Name</label>
                  <input 
                    type="text" 
                    defaultValue={currentUser.name} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[14px] text-slate-900 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-900">Username</label>
                  <input 
                    type="text" 
                    defaultValue={currentUser.name.toLowerCase().replace(' ', '_')} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[14px] text-slate-900 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Username can only be changed once per 14 days.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-900">Email Address</label>
                  <input 
                    type="email" 
                    defaultValue={currentUser.email} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[14px] text-slate-900 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-900">Phone Number</label>
                  <div className="flex">
                    <select className="bg-slate-100 border border-slate-200 border-r-0 rounded-l-xl px-3 py-2.5 text-[14px] text-slate-700 font-medium focus:outline-none">
                      <option>+1</option>
                      <option>+44</option>
                      <option>+91</option>
                    </select>
                    <input 
                      type="tel" 
                      placeholder="555-0198" 
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-r-xl px-4 py-2.5 text-[14px] text-slate-900 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-slate-900">Address</label>
                <textarea 
                  rows={4}
                  placeholder="Enter your full address"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[14px] text-slate-900 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all resize-none"
                />
              </div>

              <div className="pt-4 flex justify-end">
                <button className="bg-indigo-600 text-white font-bold text-[14px] py-2.5 px-6 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
                  Save Changes
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel (Profile Photo Management) */}
          <div className="w-full lg:w-72 flex-shrink-0">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col items-center text-center">
              <div className="relative mb-4 group cursor-pointer">
                <div className="w-32 h-32 rounded-full bg-slate-100 border-4 border-white shadow-sm flex items-center justify-center text-[36px] font-bold text-slate-400 overflow-hidden">
                  {currentUser.avatar}
                </div>
                <div className="absolute inset-0 bg-slate-900/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                  <Camera size={24} />
                </div>
              </div>
              
              <h3 className="text-[16px] font-bold text-slate-900 mb-1">Profile Photo</h3>
              <p className="text-[12px] text-slate-500 mb-6 leading-relaxed">
                At least 800x800 px recommended. <br/>JPG, PNG, or GIF up to 5MB.
              </p>
              
              <div className="w-full space-y-3">
                <button className="w-full flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 font-bold text-[13px] py-2.5 rounded-xl hover:bg-indigo-100 transition-colors">
                  <Upload size={16} /> Upload New Image
                </button>
                <button className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 text-red-600 font-bold text-[13px] py-2.5 rounded-xl hover:bg-red-50 hover:border-red-200 transition-colors">
                  <Trash2 size={16} /> Remove
                </button>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}