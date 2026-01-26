import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Settings, Box, Folder, Plus, Calendar, Sparkles, FileText, Target, Share2, Zap } from 'lucide-react';
import clsx from 'clsx';
import { useSocket } from '../../context/SocketContext';
import { AskBrainFn } from '../AskBrainFn';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isConnected } = useSocket();

  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Folder, label: 'Projects', path: '/projects' },
    { icon: Share2, label: 'Brain', path: '/brain' },
    { icon: Calendar, label: 'Calendar', path: '/calendar' },
    { icon: Zap, label: 'Automations', path: '/triggers' },
    { icon: FileText, label: 'Reports', path: '/reports' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  return (
    <div className="flex h-screen bg-background text-primary font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[280px] border-r border-border/40 flex flex-col bg-[#0e0e11] flex-shrink-0">
        {/* Header / Logo */}
        <div className="h-16 flex items-center px-6 gap-3">
            <div className="text-secondary hover:text-white transition-colors cursor-pointer" onClick={() => navigate('/')}>
               <div className="flex items-center gap-2">
                   <div className="w-6 h-6 rounded bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center text-white shadow-lg shadow-accent/20">
                       <Box size={14} strokeWidth={3} />
                   </div>
                   <span className="font-medium tracking-tight text-sm">Memory Hub</span>
                   <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded ml-2 font-medium">BETA</span>
               </div>
            </div>
        </div>

        {/* Action Button */}
        <div className="px-4 mb-6 mt-2">
            <button 
                onClick={() => document.dispatchEvent(new CustomEvent('open-note-modal'))}
                className="w-full flex items-center justify-center gap-2 bg-secondary/10 hover:bg-secondary/20 text-primary py-3 rounded-full text-sm font-medium transition-all group border border-transparent hover:border-border"
            >
                <Plus size={18} className="text-accent" />
                <span className="bg-gradient-to-r from-accent to-purple-400 bg-clip-text text-transparent font-semibold">New Memory</span>
            </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          <div className="px-3 py-2 text-xs font-medium text-secondary/60 uppercase tracking-wider">Menu</div>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={clsx(
                  "w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium transition-all",
                  isActive 
                    ? "bg-accent/10 text-accent" 
                    : "text-secondary hover:text-white hover:bg-surface"
                )}
              >
                <Icon size={18} className={clsx(isActive ? "text-accent fill-current opacity-20" : "text-secondary")} strokeWidth={isActive ? 2.5 : 2} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Productivity Tools */}
        <div className="px-3 mt-2 mb-2">
           <div className="px-3 py-2 text-xs font-medium text-secondary/60 uppercase tracking-wider">Tools</div>
           <button
                onClick={() => window.open('/focus', 'MemoryHubFocus', 'width=500,height=700,menubar=no,toolbar=no,location=no,status=no')}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium transition-all text-secondary hover:text-white hover:bg-surface"
            >
                <Target size={18} className="text-secondary group-hover:text-accent" />
                <span>Focus HUD</span>
            </button>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/40">
            <div className="bg-card/50 rounded-xl p-3 border border-border/40">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <Sparkles size={14} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">AI Assistant</p>
                        <div className="flex items-center gap-1.5">
                             <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                             <p className="text-[10px] text-secondary truncate">Gemini 2.5 Flash Lite</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto h-full relative scroll-smooth">
          {/* Top Bar */}
         <header className="sticky top-0 z-20 h-16 flex items-center justify-between px-8 bg-background/80 backdrop-blur-md border-b border-border/40">
            <div className="flex items-center gap-4">
                {/* Breadcrumbs could go here */}
            </div>
            <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2 text-[10px] text-secondary bg-surface px-3 py-1.5 rounded-full border border-border/50 transition-all hover:bg-surface/80">
                    <div className={clsx("w-1.5 h-1.5 rounded-full", isConnected ? "bg-success shadow-[0_0_8px_rgba(46,204,113,0.4)]" : "bg-error")}></div>
                    <span className="uppercase tracking-wider font-semibold">{isConnected ? "System Online" : "System Offline"}</span>
                  </div>
            </div>
         </header>

         <div className="max-w-5xl mx-auto p-8 pb-32 animate-fade-in-up">
            {children}
         </div>
      </main>
      <AskBrainFn />
    </div>
  );
}
