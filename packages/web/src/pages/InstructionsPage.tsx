import { useState } from 'react';
import { 
  Book, 
  Shield, 
  Terminal, 
  Copy, 
  Check,
  Cpu,
  Code,
  Box,
  Laptop,
  ChevronRight,
  LayoutTemplate
} from 'lucide-react';
import clsx from 'clsx';

type MainTab = 'overview' | 'rules' | 'skills' | 'mcp';
type IdeOption = 'cursor' | 'vscode' | 'windsurf' | 'antigravity';

export function InstructionsPage() {
  const [activeTab, setActiveTab] = useState<MainTab>('overview');
  const [activeIde, setActiveIde] = useState<IdeOption>('cursor');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const mainTabs = [
    { id: 'overview', label: 'Overview', icon: LayoutTemplate },
    { id: 'mcp', label: 'MCP Server', icon: Box },
    { id: 'rules', label: 'Rules', icon: Shield },
    { id: 'skills', label: 'Skills', icon: Book },
  ];

  const ideOptions = [
    { id: 'cursor', label: 'Cursor', icon: Terminal },
    { id: 'vscode', label: 'VS Code', icon: Code },
    { id: 'windsurf', label: 'Windsurf', icon: Laptop },
    { id: 'antigravity', label: 'Antigravity', icon: Cpu },
  ];

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const CodeBlock = ({ id, filename, content, language = 'markdown' }: { id: string, filename: string, content: string, language?: string }) => (
    <div className="border border-border/50 rounded-lg overflow-hidden my-4 group shadow-sm bg-[#0d0d10]">
      <div className="bg-surface px-4 py-2 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileTextIcon language={language} />
          <span className="text-xs font-mono text-secondary">{filename}</span>
        </div>
        <button
          onClick={() => handleCopy(id, content)}
          className="p-1.5 rounded hover:bg-white/10 text-secondary hover:text-white transition-colors flex items-center gap-1.5"
          title="Copy content"
        >
          {copiedId === id ? (
            <>
              <Check size={14} className="text-green-400" />
              <span className="text-[10px] text-green-400 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span className="text-[10px] font-medium">Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm text-gray-300 font-mono scrollbar-thin leading-relaxed">
        {content}
      </pre>
    </div>
  );

  // Standardized Content
  const memoryRuleContent = `# Memory

1. **Context First**: Always run \`memory_list\` at the start of a task to understand project history.
2. **Record Decisions**: Use \`memory_add\` to log architectural choices, new features, or fixes.
3. **Consistency**: Ensure your changes align with past decisions found in memory.`;

  const memorySkillContent = `# Memory

The memory skill provides persistent long-term memory for the project, allowing agents to store and retrieve context, decisions, and knowledge.

## When to use this skill

- Use this at the start of every task to understand the project's history and active context.
- Use this when making significant architectural decisions or completing milestones to save state.
- This is helpful for maintaining consistency with past work and avoiding regression.

## Tools

- \`memory_list\`: Get all project events.
- \`memory_add(text, type, links)\`: Save event.

## Best Practices

### Categorization
Always choose the most specific type for your memory:
- \`note\`: General info.
- \`idea\`: Future improvements.
- \`task_update\`: Progress logs.
- \`summary\`: Session recap.
- \`new_bug\`: Bug discovered.
- \`bug_update\`: Bug fixed or updated.
- \`spike_progress\`: Research notes.
- \`new_feat\`: New feature implemented.

### Linking
- Link related events using the \`links\` parameter (e.g., linking a fix to a bug report).
- Usage: \`links: [{ target: "UUID", type: "related" }]\`.`;

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
          Integration Guide
        </h1>
        <p className="text-secondary text-lg">
          Configure your development environment to leverage Memory Hub's capabilities.
        </p>
      </div>

      {/* Main Tabs (Resource Type) */}
      <div className="flex gap-2 border-b border-border/40 overflow-x-auto pb-1">
        {mainTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as MainTab);
                if (tab.id === 'mcp' && activeIde === 'antigravity') {
                    setActiveIde('antigravity');
                }
              }}
              className={clsx(
                "flex items-center gap-2 px-6 py-3 text-sm font-medium transition-all rounded-t-lg relative whitespace-nowrap min-w-[120px] justify-center",
                isActive 
                  ? "text-accent bg-accent/5" 
                  : "text-secondary hover:text-white hover:bg-surface/50"
              )}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              {tab.label}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent shadow-[0_0_8px_rgba(88,101,242,0.6)]" />
              )}
            </button>
          );
        })}
      </div>

      {/* OVERVIEW CONTENT (Full Width) */}
      {activeTab === 'overview' && (
          <div className="animate-fade-in space-y-8">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-card p-6 rounded-xl border border-border/50 hover:border-accent/30 transition-all">
                <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4 text-blue-400">
                  <Box size={24} />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">1. Connect MCP</h3>
                <p className="text-secondary mb-4">
                  First, connect the Memory Hub MCP server to your IDE. This gives your agent the ability to "read" and "write" memories.
                </p>
                <button 
                  onClick={() => setActiveTab('mcp')}
                  className="text-sm font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  Configure Server <span aria-hidden="true">&rarr;</span>
                </button>
              </div>

              <div className="bg-card p-6 rounded-xl border border-border/50 hover:border-accent/30 transition-all">
                <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4 text-purple-400">
                  <Shield size={24} />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">2. Set Rules</h3>
                <p className="text-secondary mb-4">
                  Define global constraints that force the agent to always check the memory before starting a task.
                </p>
                <button 
                  onClick={() => setActiveTab('rules')}
                  className="text-sm font-medium text-purple-400 hover:text-purple-300 flex items-center gap-1"
                >
                  Get Rules <span aria-hidden="true">&rarr;</span>
                </button>
              </div>

              <div className="bg-card p-6 rounded-xl border border-border/50 hover:border-accent/30 transition-all">
                <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center mb-4 text-green-400">
                   <Book size={24} />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">3. Teach Skills</h3>
                <p className="text-secondary mb-4">
                  Give your agent specific instructions on how and when to use the memory tools effectively.
                </p>
                <button 
                  onClick={() => setActiveTab('skills')}
                  className="text-sm font-medium text-green-400 hover:text-green-300 flex items-center gap-1"
                >
                  Get Skills <span aria-hidden="true">&rarr;</span>
                </button>
              </div>
            </div>
            
             <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 p-8 rounded-xl border border-accent/20">
              <h2 className="text-2xl font-bold text-white mb-4">Why use Memory Hub?</h2>
              <div className="grid md:grid-cols-2 gap-8">
                  <div>
                      <h4 className="font-semibold text-white mb-2">Persistence</h4>
                      <p className="text-secondary text-sm leading-relaxed">
                          Standard agents lose context when you close the chat. 
                          Memory persists knowledge in a file, allowing the agent to "remember" architectural decisions, unresolved bugs, and feature plans indefinitely.
                      </p>
                  </div>
                  <div>
                       <h4 className="font-semibold text-white mb-2">Consistency</h4>
                      <p className="text-secondary text-sm leading-relaxed">
                          By forcing the agent to read past events vs `memory_list`, you ensure that new code follows established patterns and doesn't conflict with previous work.
                      </p>
                  </div>
              </div>
            </div>
          </div>
      )}

      {/* TECHNICAL CONTENT (Split Layout) */}
      {activeTab !== 'overview' && (
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar: IDE Selection */}
        <div className="w-full lg:w-64 flex-shrink-0 space-y-2">
           <h3 className="text-xs font-bold text-secondary uppercase tracking-wider mb-3 px-2">Select your Editor</h3>
           {ideOptions.map((ide) => {
             const Icon = ide.icon;
             const isActive = activeIde === ide.id;
             return (
               <button
                 key={ide.id}
                 onClick={() => setActiveIde(ide.id as IdeOption)}
                 className={clsx(
                   "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all border",
                   isActive 
                     ? "bg-accent text-white border-accent shadow-lg shadow-accent/20" 
                     : "bg-card text-secondary border-border/50 hover:border-border hover:bg-surface"
                 )}
               >
                 <div className="flex items-center gap-3">
                   <Icon size={18} />
                   <span className="font-medium">{ide.label}</span>
                 </div>
                 {isActive && <ChevronRight size={16} />}
               </button>
             )
           })}
        </div>

        {/* content Area */}
        <div className="flex-1 min-w-0">
            
            {/* RULES CONTENT */}
            {activeTab === 'rules' && (
                <div className="animate-fade-in space-y-6">
                    <div className="bg-card p-6 rounded-xl border border-border/50">
                        <h2 className="text-2xl font-bold text-white mb-2">Memory Hub Rules for {ideOptions.find(i => i.id === activeIde)?.label}</h2>
                        <p className="text-secondary mb-6">
                            These rules enforce the usage of Memory Hub, ensuring the agent always consults and updates the project memory.
                        </p>

                        {activeIde === 'cursor' && (
                             <>
                                <h3 className="text-sm font-semibold text-white mb-2 ml-1">Configuration</h3>
                                <CodeBlock 
                                    id="cursor-rules"
                                    filename=".cursorrules"
                                    content={memoryRuleContent}
                                />
                             </>
                        )}

                        {activeIde === 'vscode' && (
                             <>
                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-4">
                                    <p className="text-sm text-blue-300">
                                        <strong>Setup:</strong> Go to settings <code>.vscode/settings.json</code> or use the "Edit Copilot Instructions" command.
                                    </p>
                                </div>
                                <h3 className="text-sm font-semibold text-white mb-2 ml-1">Instruction Template</h3>
                                <CodeBlock 
                                    id="vscode-rules"
                                    filename=".github/copilot-instructions.md"
                                    content={memoryRuleContent}
                                />
                             </>
                        )}
                        
                        {activeIde === 'windsurf' && (
                             <div className="space-y-4">
                                <p className="text-secondary text-sm">
                                    Windsurf allows defining global rules in the Cascade settings or via a <code>.windsurfrules</code> file (if supported).
                                </p>
                                <CodeBlock 
                                    id="windsurf-rules"
                                    filename=".windsurfrules"
                                    content={memoryRuleContent}
                                />
                             </div>
                        )}

                        {activeIde === 'antigravity' && (
                             <div className="space-y-4">
                                <p className="text-secondary text-sm">
                                    Antigravity natively scans the <code>.agent/rules</code> directory.
                                </p>
                                <CodeBlock 
                                    id="antigravity-rules"
                                    filename=".agent/rules/memory.md"
                                    content={memoryRuleContent}
                                />
                             </div>
                        )}
                    </div>
                </div>
            )}

            {/* SKILLS CONTENT */}
            {activeTab === 'skills' && (
                <div className="animate-fade-in space-y-6">
                     <div className="bg-card p-6 rounded-xl border border-border/50">
                        <h2 className="text-2xl font-bold text-white mb-2">Memory Skill for {ideOptions.find(i => i.id === activeIde)?.label}</h2>
                        <p className="text-secondary mb-6">
                            Specific instructions on HOW and WHEN to use the Memory Hub tools.
                        </p>

                        {activeIde === 'cursor' && (
                             <>
                                <p className="text-secondary text-sm mb-4">
                                    Teach Cursor how to use the memory tools.
                                </p>
                                <CodeBlock 
                                    id="cursor-skill"
                                    filename=".agent/skills/memory/SKILL.md"
                                    content={`---
name: Memory
description: Instructions to manipulate and save project context avoiding data loss
---

${memorySkillContent}`}
                                />
                             </>
                        )}

                        {activeIde === 'vscode' && (
                             <>
                                <p className="text-secondary text-sm mb-4">
                                    For VS Code Copilot, create a guide file.
                                </p>
                                <CodeBlock 
                                    id="vscode-skill"
                                    filename="docs/memory-hub-guide.md"
                                    content={memorySkillContent}
                                />
                             </>
                        )}

                         {activeIde === 'windsurf' && (
                             <>
                                <p className="text-secondary text-sm mb-4">
                                    Windsurf skill definition.
                                </p>
                                <CodeBlock 
                                    id="windsurf-skill"
                                    filename=".agent/skills/memory-tools.md"
                                    content={memorySkillContent}
                                />
                             </>
                        )}

                        {activeIde === 'antigravity' && (
                             <>
                                <p className="text-secondary text-sm mb-4">
                                    Antigravity skill definition.
                                </p>
                                <CodeBlock 
                                    id="antigravity-skill"
                                    filename=".agent/skills/memory/SKILL.md"
                                    content={`---
name: Memory
description: Instructions to manipulate and save project context avoiding data loss
---

${memorySkillContent}`}
                                />
                             </>
                        )}
                    </div>
                </div>
            )}

            {/* MCP SERVER CONTENT */}
            {activeTab === 'mcp' && (
                <div className="animate-fade-in space-y-6">
                     <div className="bg-card p-6 rounded-xl border border-border/50">
                        <h2 className="text-2xl font-bold text-white mb-2">MCP Config for {ideOptions.find(i => i.id === activeIde)?.label}</h2>
                         <p className="text-secondary mb-6">
                            Connect your IDE to the Memory Hub MCP server (stdio transport) to enable the tools.
                        </p>

                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
                            <p className="text-sm text-yellow-200">
                                <strong>Prerequisite:</strong> Build the package first if using from source.<br/>
                                <code>npm run build</code> in packages/mcp-server
                            </p>
                        </div>

                         {activeIde === 'vscode' && (
                             <>
                                <h3 className="text-sm font-semibold text-white mb-2 ml-1">Cline / Claude Dev Settings</h3>
                                <p className="text-secondary text-xs mb-2">Location: <code>%APPDATA%/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json</code></p>
                                <CodeBlock 
                                    id="vscode-mcp"
                                    filename="cline_mcp_settings.json"
                                    language="json"
                                    content={`{
  "mcpServers": {
    "memory-hub": {
      "command": "node",
      "args": ["C:/path/to/memory-hub/packages/mcp-server/dist/index.js"],
      "disabled": false,
      "alwaysAllow": ["memory_add", "memory_list"]
    }
  }
}`}
                                />
                             </>
                        )}

                         {activeIde === 'cursor' && (
                             <>
                                <h3 className="text-sm font-semibold text-white mb-2 ml-1">Cursor Settings</h3>
                                <p className="text-secondary text-xs mb-2"><strong>Cursor Settings {'>'} Features {'>'} MCP Servers</strong></p>
                                <CodeBlock 
                                    id="cursor-mcp"
                                    filename="Add New MCP Server"
                                    content={`Name: memory-hub
Type: command
Command: node C:/path/to/memory-hub/packages/mcp-server/dist/index.js`}
                                />
                             </>
                        )}

                        {activeIde === 'windsurf' && (
                             <>
                                <h3 className="text-sm font-semibold text-white mb-2 ml-1">Cascade Config</h3>
                                <p className="text-secondary text-xs mb-2">Location: <code>~/.codeium/windsurf/mcp_config.json</code></p>
                                <CodeBlock 
                                    id="windsurf-mcp"
                                    filename="mcp_config.json"
                                    language="json"
                                    content={`{
  "mcpServers": {
    "memory-hub": {
      "command": "node",
      "args": ["C:/path/to/memory-hub/packages/mcp-server/dist/index.js"]
    }
  }
}`}
                                />
                             </>
                        )}

                        {activeIde === 'antigravity' && (
                             <>
                                <h3 className="text-sm font-semibold text-white mb-2 ml-1">Antigravity Config</h3>
                                <p className="text-secondary text-xs mb-2">Location: <code>project_root/.agent/mcp_config.json</code> (or similar depending on setup)</p>
                                <CodeBlock 
                                    id="antigravity-mcp"
                                    filename="mcp_config.json"
                                    language="json"
                                    content={`{
  "mcpServers": {
    "memory-hub": {
      "command": "node",
      "args": ["C:/path/to/memory-hub/packages/mcp-server/dist/index.js"]
    }
  }
}`}
                                />
                             </>
                        )}
                    </div>
                </div>
            )}
        </div>
      </div>
      )}
    </div>
  );
}

function FileTextIcon({ language }: { language: string }) {
  if (language === 'json') return <span className="text-yellow-400 text-[10px] font-bold border border-yellow-400 px-1 rounded">JSON</span>;
  if (language === 'markdown') return <span className="text-blue-400 text-[10px] font-bold border border-blue-400 px-1 rounded">MD</span>;
  return <span className="text-secondary text-[10px] font-bold border border-secondary px-1 rounded">TXT</span>;
}
