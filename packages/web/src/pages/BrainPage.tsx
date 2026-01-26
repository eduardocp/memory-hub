import { useState, useEffect, useMemo, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useSocket } from '../context/SocketContext';
import { Loader2, Share2, Maximize, Sparkles } from 'lucide-react';
import axios from 'axios';
import { useToast } from '../components/Toast';
import { API_URL } from '../config';
import type { HelperEvent } from '../domain/models';

export function BrainPage() {
    const { socket } = useSocket();
    const { addToast } = useToast();
    const [events, setEvents] = useState<HelperEvent[]>([]);
    const [extraLinks, setExtraLinks] = useState<any[]>([]);
    const [detecting, setDetecting] = useState(false);
    const [loading, setLoading] = useState(true);
    const graphRef = useRef<any>(null);
    const [containerDimensions, setContainerDimensions] = useState({ width: 800, height: 600 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Fetch Events (All time)
    useEffect(() => {
        if (!socket) return;
        setLoading(true);
        // Request ample limit for graph
        socket.emit('events:list', { limit: 500 }, (res: any) => {
            if (res.success) {
                setEvents(res.data);
            }
            setLoading(false);
        });
    }, [socket]);

    // Update dimensions
    useEffect(() => {
        const updateDim = () => {
            if (containerRef.current) {
                setContainerDimensions({
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight
                });
            }
        };

        window.addEventListener('resize', updateDim);
        updateDim();
        // Delay slightly for layout shift
        setTimeout(updateDim, 100);

        return () => window.removeEventListener('resize', updateDim);
    }, []);

    // Transform Data for Graph
    const graphData = useMemo(() => {
        const nodes: any[] = [];
        const links: any[] = [];
        
        // 1. Create Nodes
        events.forEach(e => {
            nodes.push({
                id: e.id,
                name: e.text.substring(0, 30) + (e.text.length > 30 ? '...' : ''),
                fullText: e.text,
                date: new Date(e.timestamp).toLocaleDateString(),
                val: e.type === 'summary' ? 3 : 1, // Size
                group: e.type,
                project: e.project
            });
        });

        // 2. Create Links (Sequential)
        // Strategy: Connect sequential events within same project
        const eventsByProject: Record<string, HelperEvent[]> = {};
        
        // Sort by time first
        const sorted = [...events].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        sorted.forEach(e => {
            if (!eventsByProject[e.project]) eventsByProject[e.project] = [];
            
            const list = eventsByProject[e.project];
            if (list.length > 0) {
                // Link to previous event in project
                const prev = list[list.length - 1];
                links.push({
                    source: prev.id,
                    target: e.id,
                    color: '#333' // Basic Timeline Link
                });
            }
            list.push(e);
        });

        // 3. Add AI Links
        extraLinks.forEach(link => {
            // Validate nodes exist
            if (nodes.find(n => n.id === link.source) && nodes.find(n => n.id === link.target)) {
                 links.push({
                    source: link.source,
                    target: link.target,
                    color: '#a855f7', // Purple AI Link
                    dashed: true,     // Custom prop to maybe render dashed
                    label: link.reason // Show reason
                });
            }
        });

        return { nodes, links };
    }, [events, extraLinks]);

    const handleDetectConnections = async () => {
        setDetecting(true);
        try {
            const res = await axios.post(`${API_URL}/ai/connections`);
            if (res.data.success && Array.isArray(res.data.connections)) {
                setExtraLinks(res.data.connections);
                addToast(`Found ${res.data.connections.length} semantic connections!`, 'success');
            }
        } catch (e) {
            console.error(e);
            addToast('Failed to analyze connections', 'error');
        } finally {
            setDetecting(false);
        }
    };

    const getColor = (type: string) => {
        switch (type) {
            case 'note': return '#a3a3a3';
            case 'idea': return '#facc15';
            case 'task_update': return '#60a5fa';
            case 'new_feat': return '#4ade80';
            case 'new_bug': return '#f87171';
            case 'git_commit': return '#fb923c';
            case 'summary': return '#c084fc';
            default: return '#fff';
        }
    };

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col bg-[#0e0e11] rounded-2xl border border-border/40 overflow-hidden relative">
            {/* Header Overlay */}
            <div className="absolute top-4 left-4 z-10 bg-card/80 backdrop-blur p-4 rounded-xl border border-border/50 max-w-sm pointer-events-none">
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <Share2 className="text-accent" />
                    Neural Map
                </h1>
                <p className="text-xs text-secondary mt-1">
                    Visualizing {events.length} memory events.
                    <br/>Connections represent project timelines.
                </p>
                {loading && <div className="mt-2 flex items-center gap-2 text-xs text-accent"><Loader2 size={12} className="animate-spin"/> Loading neurons...</div>}
            </div>

            {/* Controls */}
            <div className="absolute bottom-4 right-4 z-10 flex gap-2">
                 <button 
                    onClick={handleDetectConnections}
                    disabled={detecting}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg shadow-purple-500/20"
                >
                    {detecting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    {detecting ? 'Analyzing...' : 'Connect Ideas'}
                </button>
                <button 
                    onClick={() => graphRef.current?.zoomToFit(400)}
                    className="p-2 bg-card hover:bg-surface border border-border/50 rounded-lg text-secondary hover:text-white transition-colors"
                    title="Reset View"
                >
                    <Maximize size={20} />
                </button>
            </div>

            {/* Canvas */}
            <div className="flex-1 w-full h-full cursor-move" ref={containerRef}>
                <ForceGraph2D
                    ref={graphRef}
                    width={containerDimensions.width}
                    height={containerDimensions.height}
                    graphData={graphData}
                    nodeLabel="fullText"
                    nodeColor={(node: any) => getColor(node.group)}
                    nodeRelSize={4}
                    linkColor={() => '#333'}
                    linkDirectionalParticles={1}
                    linkDirectionalParticleSpeed={0.005}
                    backgroundColor="#0e0e11"
                    onNodeClick={node => {
                        // Focus
                        graphRef.current?.centerAt(node.x, node.y, 1000);
                        graphRef.current?.zoom(4, 2000);
                    }}
                    nodeCanvasObject={(node: any, ctx, globalScale) => {
                        // Custom rendering for nicer visuals
                        const label = node.name;
                        const fontSize = 12/globalScale;
                        ctx.font = `${fontSize}px Sans-Serif`;
                        const textWidth = ctx.measureText(label).width;
                        const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); // some padding

                        // Circle
                        ctx.fillStyle = getColor(node.group);
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, 4, 0, 2 * Math.PI, false);
                        ctx.fill();

                        // Label (only if zoomed in or summary)
                        if (globalScale > 1.5 || node.group === 'summary') {
                            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                            ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2 - 10, bckgDimensions[0], bckgDimensions[1]);

                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillStyle = '#fff';
                            ctx.fillText(label, node.x, node.y - 10);
                        }
                    }}
                />
            </div>
        </div>
    );
}
