import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { StoryNode, StoryLink, D3Node, D3Link } from '../types';
import { ZoomIn, ZoomOut, RefreshCw, Lock, Unlock } from 'lucide-react';

interface GraphVisualizerProps {
  nodes: StoryNode[];
  links: StoryLink[];
  onNodeSelect: (nodeId: string) => void;
  selectedNodeId: string | null;
}

// Extend D3Node locally to include layout properties
interface ExtendedD3Node extends D3Node {
  level?: number;
  isStart?: boolean;
  isEnd?: boolean;
}

const GraphVisualizer: React.FC<GraphVisualizerProps> = ({ nodes, links, onNodeSelect, selectedNodeId }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // State for Fixed Mode
  const [isFixed, setIsFixed] = useState(false);
  
  // We keep a reference to the simulation to stop/restart it
  const simulationRef = useRef<d3.Simulation<ExtendedD3Node, D3Link> | null>(null);

  // Cache for node positions to prevent reset on re-render
  const nodePositionsRef = useRef<Map<string, { x: number, y: number, fx?: number | null, fy?: number | null }>>(new Map());

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    if (nodes.length === 0) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Clear previous SVG content to avoid duplicates on re-render
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // --- 1. Topology Analysis for Layout ---
    const incomingCount: Record<string, number> = {};
    const outgoingCount: Record<string, number> = {};
    
    nodes.forEach(n => {
        incomingCount[n.id] = 0;
        outgoingCount[n.id] = 0;
    });

    links.forEach(l => {
        incomingCount[l.target] = (incomingCount[l.target] || 0) + 1;
        outgoingCount[l.source] = (outgoingCount[l.source] || 0) + 1;
    });

    let startNodes = nodes.filter(n => incomingCount[n.id] === 0);
    if (startNodes.length === 0 && nodes.length > 0) startNodes = [nodes[0]];

    // --- 2. Calculate Levels (BFS) for Left-to-Right Layout ---
    const nodeLevels: Record<string, number> = {};
    const queue: {id: string, level: number}[] = startNodes.map(n => ({ id: n.id, level: 0 }));
    const visited = new Set<string>();

    startNodes.forEach(n => visited.add(n.id));

    while (queue.length > 0) {
        const { id, level } = queue.shift()!;
        nodeLevels[id] = level;

        const childLinks = links.filter(l => l.source === id);
        childLinks.forEach(l => {
            if (!visited.has(l.target)) {
                visited.add(l.target);
                queue.push({ id: l.target, level: level + 1 });
            }
        });
    }

    nodes.forEach(n => {
        if (nodeLevels[n.id] === undefined) nodeLevels[n.id] = 0;
    });


    // --- 3. Prepare Data for D3 ---
    const levelSpacing = 200;

    const d3Nodes: ExtendedD3Node[] = nodes.map(n => {
        const cached = nodePositionsRef.current.get(n.id);
        const autoX = (nodeLevels[n.id] || 0) * levelSpacing + 100;
        const autoY = height / 2 + (Math.random() - 0.5) * 100;

        // Use cached position if available, otherwise use auto layout position
        const currentX = cached ? cached.x : autoX;
        const currentY = cached ? cached.y : autoY;

        return {
            ...n,
            level: nodeLevels[n.id],
            isStart: incomingCount[n.id] === 0,
            isEnd: outgoingCount[n.id] === 0,
            x: currentX,
            y: currentY,
            // If Fixed Mode is ON, pin the node to its current position
            fx: isFixed ? currentX : null,
            fy: isFixed ? currentY : null
        };
    });
    
    const d3Links: D3Link[] = links.map(l => ({ ...l, source: l.source, target: l.target }));


    // --- 4. Render Setup ---
    svg.append("defs").selectAll("marker")
      .data(["end", "end-selected"])
      .enter().append("marker")
      .attr("id", d => d)
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 28)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", d => d === "end-selected" ? "#60a5fa" : "#64748b");

    const g = svg.append("g");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Apply saved zoom transform if exists? (Optional, skipping for now to keep simple)


    // --- 5. Simulation Setup ---
    const simulation = d3.forceSimulation<ExtendedD3Node, D3Link>(d3Nodes)
      .force("link", d3.forceLink<ExtendedD3Node, D3Link>(d3Links).id(d => d.id).distance(150))
      .force("charge", d3.forceManyBody().strength(-500))
      .force("collide", d3.forceCollide().radius(50));
      
    // Only apply layout forces if NOT in Fixed Mode
    if (!isFixed) {
        simulation
            .force("x", d3.forceX<ExtendedD3Node>(d => (d.level || 0) * levelSpacing).strength(1.2))
            .force("y", d3.forceY(height / 2).strength(0.1));
    } else {
        // In Fixed Mode, we remove the positioning forces so nodes don't drift if unpinned momentarily
        simulation.force("x", null).force("y", null);
    }

    simulationRef.current = simulation;

    // --- 6. Draw Elements ---
    const link = g.append("g")
      .attr("class", "links")
      .selectAll("g")
      .data(d3Links)
      .enter().append("g")
      .attr("class", "link-group");

    const linkPath = link.append("line")
      .attr("stroke", "#475569")
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#end)");

    const linkLabelBg = link.append("rect")
      .attr("rx", 4)
      .attr("ry", 4)
      .attr("fill", "#0f172a")
      .attr("fill-opacity", 0.8);

    const linkLabel = link.append("text")
      .text(d => d.label)
      .attr("font-size", "10px")
      .attr("fill", "#94a3b8")
      .attr("text-anchor", "middle")
      .attr("font-family", "sans-serif")
      .attr("dy", 4);

    const node = g.append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(d3Nodes)
      .enter().append("g")
      .attr("cursor", isFixed ? "move" : "grab")
      .call(d3.drag<SVGGElement, ExtendedD3Node>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    const getNodeColor = (d: ExtendedD3Node) => {
        if (d.id === selectedNodeId) return "#3b82f6";
        if (d.isStart) return "#10b981";
        if (d.isEnd) return "#f59e0b";
        return "#1e293b";
    };
    
    const getNodeStroke = (d: ExtendedD3Node) => {
        if (d.id === selectedNodeId) return "#60a5fa";
        if (d.isStart) return "#34d399";
        if (d.isEnd) return "#fbbf24";
        return "#475569";
    };

    node.append("circle")
      .attr("r", d => d.isStart || d.isEnd ? 24 : 20)
      .attr("fill", d => getNodeColor(d))
      .attr("stroke", d => getNodeStroke(d))
      .attr("stroke-width", d => d.id === selectedNodeId ? 4 : 3)
      .on("click", (event, d) => {
        event.stopPropagation();
        onNodeSelect(d.id);
      });

    node.filter(d => !!d.isStart || !!d.isEnd)
        .append("text")
        .text(d => d.isStart ? "START" : "END")
        .attr("dy", -32)
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .attr("font-weight", "bold")
        .attr("font-family", "sans-serif")
        .attr("fill", d => d.isStart ? "#34d399" : "#fbbf24");

    node.append("text")
      .text(d => {
          const title = d.title;
          return title.length > 12 ? title.substring(0, 12) + "..." : title;
      })
      .attr("dy", 5)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("font-family", "sans-serif")
      .attr("fill", "#e2e8f0")
      .style("pointer-events", "none")
      .style("text-shadow", "0 1px 3px rgba(0,0,0,0.8)");

    simulation.on("tick", () => {
      // Update ref with current positions on every tick to ensure we have latest coords
      d3Nodes.forEach(n => {
          if (n.x !== undefined && n.y !== undefined) {
              nodePositionsRef.current.set(n.id, { x: n.x, y: n.y, fx: n.fx, fy: n.fy });
          }
      });

      linkPath
        .attr("x1", d => (d.source as ExtendedD3Node).x!)
        .attr("y1", d => (d.source as ExtendedD3Node).y!)
        .attr("x2", d => (d.target as ExtendedD3Node).x!)
        .attr("y2", d => (d.target as ExtendedD3Node).y!);

      linkLabel
        .attr("x", d => ((d.source as ExtendedD3Node).x! + (d.target as ExtendedD3Node).x!) / 2)
        .attr("y", d => ((d.source as ExtendedD3Node).y! + (d.target as ExtendedD3Node).y!) / 2);
        
      linkLabelBg
        .attr("x", d => ((d.source as ExtendedD3Node).x! + (d.target as ExtendedD3Node).x!) / 2 - 20)
        .attr("y", d => ((d.source as ExtendedD3Node).y! + (d.target as ExtendedD3Node).y!) / 2 - 6)
        .attr("width", 40)
        .attr("height", 14);

      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    // Drag functions
    function dragstarted(event: d3.D3DragEvent<SVGGElement, ExtendedD3Node, ExtendedD3Node>, d: ExtendedD3Node) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, ExtendedD3Node, ExtendedD3Node>, d: ExtendedD3Node) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, ExtendedD3Node, ExtendedD3Node>, d: ExtendedD3Node) {
      if (!event.active) simulation.alphaTarget(0);
      
      if (isFixed) {
          // In Fixed Mode, keep the node pinned where it was dropped
          d.fx = d.x;
          d.fy = d.y;
      } else {
          // In Auto Mode, release the node to let physics take over
          d.fx = null;
          d.fy = null;
      }
      
      // Update cache immediately
      nodePositionsRef.current.set(d.id, { x: d.x!, y: d.y!, fx: d.fx, fy: d.fy });
    }

    // Auto Center only on initial load or empty cache, not on every re-render
    const timer = setTimeout(() => {
        if (!svgRef.current || nodePositionsRef.current.size > 0) return; 
        
        const bounds = g.node()?.getBBox();
        if(!bounds) return;

        const fullWidth = containerRef.current?.clientWidth || 800;
        const fullHeight = containerRef.current?.clientHeight || 600;
        
        const scale = 0.9 / Math.max(bounds.width / fullWidth, bounds.height / fullHeight);
        const translate = [
            fullWidth / 2 - scale * (bounds.x + bounds.width / 2),
            fullHeight / 2 - scale * (bounds.y + bounds.height / 2)
        ];

        svg.transition().duration(1000).call(
            zoom.transform,
            d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );
    }, 500);

    return () => {
      simulation.stop();
      clearTimeout(timer);
    };
  }, [nodes, links, selectedNodeId, onNodeSelect, isFixed]); // Add isFixed to dependency

  const handleZoomIn = () => {
    if(!svgRef.current) return;
    d3.select(svgRef.current).transition().call(d3.zoom<SVGSVGElement, unknown>().scaleBy, 1.2);
  };

  const handleZoomOut = () => {
    if(!svgRef.current) return;
    d3.select(svgRef.current).transition().call(d3.zoom<SVGSVGElement, unknown>().scaleBy, 0.8);
  };
  
  const handleCenter = () => {
      if(!svgRef.current || nodes.length === 0) return;
      const svg = d3.select(svgRef.current);
      svg.transition().duration(750).call(d3.zoom<SVGSVGElement, unknown>().transform, d3.zoomIdentity);
  }
  
  const toggleFixedMode = () => {
      setIsFixed(prev => !prev);
  }

  return (
    <div ref={containerRef} className="w-full h-full relative bg-slate-900 overflow-hidden">
      <div className="absolute top-4 left-4 flex space-x-2 z-10 print:hidden">
         <div className="flex bg-slate-800 rounded-md border border-slate-700 overflow-hidden">
             <button onClick={handleZoomIn} className="p-2 hover:bg-slate-700 text-slate-200 border-r border-slate-700" title="확대">
                 <ZoomIn size={18} />
             </button>
             <button onClick={handleZoomOut} className="p-2 hover:bg-slate-700 text-slate-200 border-r border-slate-700" title="축소">
                 <ZoomOut size={18} />
             </button>
             <button onClick={handleCenter} className="p-2 hover:bg-slate-700 text-slate-200" title="화면 맞춤">
                 <RefreshCw size={18} />
             </button>
         </div>
         
         <button 
            onClick={toggleFixedMode} 
            className={`flex items-center gap-2 px-3 py-2 rounded-md border transition-colors ${
                isFixed 
                ? "bg-blue-600/20 border-blue-500 text-blue-300 hover:bg-blue-600/30" 
                : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            }`}
            title={isFixed ? "고정 모드 켜짐 (드래그하여 위치 고정)" : "고정 모드 꺼짐 (자동 정렬)"}
         >
             {isFixed ? <Lock size={16} /> : <Unlock size={16} />}
             <span className="text-xs font-medium">{isFixed ? "위치 고정" : "자동 정렬"}</span>
         </button>
      </div>
      {/* ADD UNIQUE ID HERE */}
      <svg id="story-graph-canvas" ref={svgRef} className={`w-full h-full ${isFixed ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}></svg>
      
      {/* Helper Toast for Fixed Mode */}
      {isFixed && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-blue-900/80 text-blue-100 px-4 py-2 rounded-full text-xs pointer-events-none backdrop-blur animate-fade-in print:hidden">
              고정 모드: 노드를 원하는 위치로 드래그하면 고정됩니다.
          </div>
      )}
    </div>
  );
};

export default GraphVisualizer;