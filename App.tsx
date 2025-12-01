import React, { useState, useRef } from 'react';
import { StoryNode, StoryLink } from './types';
import GraphVisualizer from './components/GraphVisualizer';
import StoryEditor from './components/StoryEditor';
import { Download, FileText, Image as ImageIcon, Upload, FileType } from 'lucide-react';
import { downloadJSON, downloadTextScript, downloadImage, downloadPDF } from './utils/exportUtils';

// Initial dummy data
const initialNodes: StoryNode[] = [
  { id: '1', title: '갈림길', content: '당신은 먼지 날리는 갈림길에 서 있습니다. 뜨거운 태양이 내리쬡니다. 북쪽으로는 어두운 숲이 보이고, 동쪽으로는 멀리 희미하게 빛나는 도시가 보입니다.' },
  { id: '2', title: '어두운 숲', content: '나무들은 고대의 것이며 뒤틀려 있습니다. 근처 덤불에서 부스럭거리는 소리가 들립니다.' },
  { id: '3', title: '수정 도시', content: '성문은 진주로 만들어졌습니다. 경비병들이 감시하고 있습니다.' }
];

const initialLinks: StoryLink[] = [
  { id: 'l1', source: '1', target: '2', label: '북쪽으로 간다' },
  { id: 'l2', source: '1', target: '3', label: '동쪽으로 간다' }
];

const App: React.FC = () => {
  const [nodes, setNodes] = useState<StoryNode[]>(initialNodes);
  const [links, setLinks] = useState<StoryLink[]>(initialLinks);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  // Ref for the hidden file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreateNode = (title = '새 장면', content = '') => {
    const newNode: StoryNode = {
      id: Date.now().toString(),
      title,
      content,
    };
    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
  };

  const handleUpdateNode = (updatedNode: StoryNode) => {
    setNodes(prev => prev.map(n => n.id === updatedNode.id ? updatedNode : n));
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setLinks(prev => prev.filter(l => l.source !== nodeId && l.target !== nodeId));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  };

  const handleAddLink = (sourceId: string, targetId: string, label: string) => {
    const newLink: StoryLink = {
      id: Date.now().toString(),
      source: sourceId,
      target: targetId,
      label
    };
    setLinks(prev => [...prev, newLink]);
  };

  const handleRemoveLink = (linkId: string) => {
    setLinks(prev => prev.filter(l => l.id !== linkId));
  };

  const handleExportJSON = () => {
    downloadJSON({ nodes, links }, 'story-map');
  };

  const handleExportText = () => {
    downloadTextScript({ nodes, links }, 'story-script');
  };

  const handleExportImage = () => {
     // Explicitly target the graph SVG by ID to avoid picking up icon SVGs
     const svg = document.getElementById('story-graph-canvas') as unknown as SVGSVGElement;
     if (svg) {
         downloadImage(svg, 'story-visual-map');
     } else {
         alert("내보낼 맵을 찾을 수 없습니다.");
     }
  };

  const handleExportPDF = () => {
    // Explicitly target the graph SVG by ID
    const svg = document.getElementById('story-graph-canvas') as unknown as SVGSVGElement;
     if (svg) {
         downloadPDF(svg, 'story-visual-map');
     } else {
         alert("내보낼 맵을 찾을 수 없습니다.");
     }
  };

  // JSON Import Handlers
  const handleImportJSONClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rawContent = e.target?.result as string;
        if (!rawContent) return;

        // Strip comments (// and /* */) while preserving strings (e.g. "http://...")
        // This regex matches: quoted strings OR comments. If it's a comment (captured in group 1), replace with empty string.
        const jsonContent = rawContent.replace(
            /\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, 
            (m, g) => g ? "" : m
        );

        const data = JSON.parse(jsonContent);
        
        // Basic validation checking for nodes and links arrays
        if (data && Array.isArray(data.nodes) && Array.isArray(data.links)) {
          setNodes(data.nodes);
          setLinks(data.links);
          setSelectedNodeId(null);
        } else {
          alert("올바르지 않은 JSON 파일 형식입니다. (nodes 및 links 배열 필요)");
        }
      } catch (err) {
        console.error("JSON Import Error:", err);
        alert(`파일을 읽거나 분석하는 중 오류가 발생했습니다.\n${(err as Error).message}\n\nJSON 파일 형식을 확인해주세요.`);
      }
      
      // Reset input value to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
      
      {/* Main Content Area (Graph) */}
      <div className="flex-1 relative flex flex-col print:h-screen print:w-screen">
        {/* Toolbar - Hidden when printing */}
        <div className="absolute top-4 right-4 z-20 flex space-x-2 print:hidden">
            <div className="bg-slate-800/90 backdrop-blur border border-slate-700 p-1 rounded-lg shadow-xl flex items-center space-x-1">
                <button onClick={handleImportJSONClick} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-blue-300 hover:bg-slate-700 rounded transition" title="JSON 파일 불러오기">
                    <Upload size={14} /> 불러오기
                </button>
                <div className="w-px h-4 bg-slate-700 mx-1"></div>
                <button onClick={handleExportJSON} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 rounded transition" title="JSON 다운로드">
                    <Download size={14} /> JSON
                </button>
                <div className="w-px h-4 bg-slate-700 mx-1"></div>
                <button onClick={handleExportText} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 rounded transition" title="스크립트(TXT) 다운로드">
                    <FileText size={14} /> 스크립트
                </button>
                <div className="w-px h-4 bg-slate-700 mx-1"></div>
                <button onClick={handleExportPDF} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 rounded transition" title="PDF로 저장">
                    <FileType size={14} /> PDF
                </button>
                <div className="w-px h-4 bg-slate-700 mx-1"></div>
                <button onClick={handleExportImage} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 rounded transition" title="이미지(PNG) 다운로드">
                    <ImageIcon size={14} /> 이미지
                </button>
            </div>
        </div>

        {/* Hidden File Input */}
        <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".json" 
            onChange={handleFileChange} 
        />

        {/* Graph */}
        <div className="flex-1 w-full h-full">
          <GraphVisualizer
            nodes={nodes}
            links={links}
            onNodeSelect={setSelectedNodeId}
            selectedNodeId={selectedNodeId}
          />
        </div>
      </div>

      {/* Sidebar Editor - Hidden when printing */}
      <div className="w-80 md:w-96 flex-shrink-0 z-30 shadow-2xl print:hidden">
        <StoryEditor
          selectedNode={selectedNode}
          allNodes={nodes}
          allLinks={links}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={handleDeleteNode}
          onAddLink={handleAddLink}
          onRemoveLink={handleRemoveLink}
          onCreateNode={handleCreateNode}
        />
      </div>
    </div>
  );
};

export default App;