import React, { useState, useEffect } from 'react';
import { StoryNode, StoryLink } from '../types';
import { Plus, Trash2, ArrowRightCircle, Sparkles, Link as LinkIcon } from 'lucide-react';
import { generateStorySuggestion, getGeminiApiKey, setGeminiApiKey } from '../services/geminiService';

interface StoryEditorProps {
  selectedNode: StoryNode | null;
  allNodes: StoryNode[];
  allLinks: StoryLink[];
  onUpdateNode: (node: StoryNode) => void;
  onDeleteNode: (nodeId: string) => void;
  onAddLink: (sourceId: string, targetId: string, label: string) => void;
  onRemoveLink: (linkId: string) => void;
  onCreateNode: (title?: string, content?: string) => void;
}

const StoryEditor: React.FC<StoryEditorProps> = ({
  selectedNode,
  allNodes,
  allLinks,
  onUpdateNode,
  onDeleteNode,
  onAddLink,
  onRemoveLink,
  onCreateNode
}) => {
  const [localTitle, setLocalTitle] = useState('');
  const [localContent, setLocalContent] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [newLinkTargetId, setNewLinkTargetId] = useState('');
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isApiKeySaved, setIsApiKeySaved] = useState(false);

  // Sync local state when selected node changes
  useEffect(() => {
    if (selectedNode) {
      setLocalTitle(selectedNode.title);
      setLocalContent(selectedNode.content);
      setNewLinkLabel('');
      setNewLinkTargetId('');
    }
  }, [selectedNode]);

  useEffect(() => {
    setApiKeyInput(getGeminiApiKey());
  }, []);

  const handleSave = () => {
    if (selectedNode) {
      onUpdateNode({
        ...selectedNode,
        title: localTitle,
        content: localContent,
      });
    }
  };

  const handleAiImprove = async () => {
    if (!selectedNode) return;
    if (!getGeminiApiKey()) {
      alert("먼저 Gemini API Key를 입력하고 저장해주세요.");
      return;
    }
    setIsAiLoading(true);
    try {
      const outgoingLinks = allLinks.filter(l => l.source === selectedNode.id);
      const suggestion = await generateStorySuggestion(
        { ...selectedNode, title: localTitle, content: localContent },
        outgoingLinks,
        allNodes
      );
      
      setLocalTitle(suggestion.title);
      setLocalContent(suggestion.content);
      // Auto-save the text changes
      onUpdateNode({
        ...selectedNode,
        title: suggestion.title,
        content: suggestion.content
      });

      console.log("AI 추천 선택지:", suggestion.choices);
    } catch (e) {
      console.error(e);
      alert("AI 제안을 가져오지 못했습니다. API Key를 확인하세요.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSaveApiKey = () => {
    setGeminiApiKey(apiKeyInput);
    setIsApiKeySaved(true);
    setTimeout(() => setIsApiKeySaved(false), 1500);
  };

  const handleAddLink = () => {
    if (selectedNode && newLinkTargetId && newLinkLabel) {
      onAddLink(selectedNode.id, newLinkTargetId, newLinkLabel);
      setNewLinkLabel('');
      setNewLinkTargetId('');
    }
  };
  
  if (!selectedNode) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 p-6 text-center">
        <ArrowRightCircle size={48} className="mb-4 opacity-50" />
        <p className="text-lg font-medium">편집할 노드를 선택하세요</p>
        <p className="text-sm mb-6">또는 새로운 시작 지점을 만드세요</p>
        <button
          onClick={() => onCreateNode()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus size={18} />
          새 노드 생성
        </button>
      </div>
    );
  }

  const outgoingLinks = allLinks.filter(l => l.source === selectedNode.id);

  return (
    <div className="h-full flex flex-col bg-slate-900 border-l border-slate-800 text-slate-100 overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-900/95 backdrop-blur z-10">
        <h2 className="font-semibold text-lg text-blue-400">노드 편집</h2>
        <button
          onClick={() => onDeleteNode(selectedNode.id)}
          className="text-red-400 hover:text-red-300 p-2 rounded hover:bg-red-400/10 transition"
          title="노드 삭제"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* API Key input */}
        <div className="space-y-2 bg-slate-800/60 border border-slate-700 rounded p-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Gemini API Key</label>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="프로젝트의 Gemini API Key를 입력하세요"
            />
            <button
              onClick={handleSaveApiKey}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-xs text-white rounded font-medium transition"
            >
              저장
            </button>
          </div>
          <p className="text-[11px] text-slate-500">입력한 키는 로컬 브라우저에만 저장되며 언제든 다시 바꿀 수 있습니다.</p>
          {isApiKeySaved && <p className="text-[11px] text-green-400">API Key가 저장되었습니다.</p>}
        </div>

        {/* Title Input */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">장면 제목</label>
          <input
            type="text"
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            onBlur={handleSave}
            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="예: 어두운 동굴"
          />
        </div>

        {/* Content Textarea */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">이야기 내용</label>
            <button
              onClick={handleAiImprove}
              disabled={isAiLoading}
              className="text-xs flex items-center gap-1 text-purple-400 hover:text-purple-300 disabled:opacity-50"
            >
              <Sparkles size={12} />
              {isAiLoading ? '작성 중...' : 'AI 다듬기'}
            </button>
          </div>
          <textarea
            value={localContent}
            onChange={(e) => setLocalContent(e.target.value)}
            onBlur={handleSave}
            rows={8}
            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-300 focus:ring-2 focus:ring-blue-500 outline-none resize-y text-sm leading-relaxed"
            placeholder="장면을 묘사하세요..."
          />
        </div>

        {/* Connections Section */}
        <div className="space-y-4">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <LinkIcon size={12} />
            연결 (선택지)
          </label>
          
          {/* List existing links */}
          <div className="space-y-2">
            {outgoingLinks.map(link => {
              const targetNode = allNodes.find(n => n.id === link.target);
              return (
                <div key={link.id} className="flex items-center justify-between bg-slate-800 p-2 rounded border border-slate-700 text-sm">
                  <div className="flex flex-col truncate mr-2">
                     <span className="text-slate-200 font-medium">"{link.label}"</span>
                     <span className="text-slate-500 text-xs">→ {targetNode?.title || '알 수 없음'}</span>
                  </div>
                  <button 
                    onClick={() => onRemoveLink(link.id)}
                    className="text-slate-500 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
            {outgoingLinks.length === 0 && (
              <p className="text-slate-600 text-xs italic">이 장면에 정의된 선택지가 없습니다.</p>
            )}
          </div>

          {/* Add New Link */}
          <div className="bg-slate-800/50 p-3 rounded border border-slate-700/50 space-y-3">
             <p className="text-xs text-slate-400 font-medium">새 선택지 추가</p>
             <input
                type="text"
                placeholder="선택지 내용 (예: 문을 연다)"
                value={newLinkLabel}
                onChange={(e) => setNewLinkLabel(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"
             />
             <select
                value={newLinkTargetId}
                onChange={(e) => setNewLinkTargetId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-300"
             >
                <option value="">이동할 장면 선택...</option>
                {allNodes
                  .filter(n => n.id !== selectedNode.id) // Avoid self-loops for simplicity, though valid in graphs
                  .map(n => (
                    <option key={n.id} value={n.id}>{n.title}</option>
                  ))
                }
             </select>
             <button
               onClick={handleAddLink}
               disabled={!newLinkLabel || !newLinkTargetId}
               className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs rounded font-medium transition"
             >
               연결하기
             </button>
          </div>
          
           <div className="pt-2 border-t border-slate-800">
               <button
                 onClick={() => onCreateNode(`'${selectedNode.title}'에서 연결된 새 장면`)}
                 className="w-full py-2 border border-dashed border-slate-600 text-slate-400 hover:text-white hover:border-slate-400 rounded text-xs transition"
               >
                 + 연결되지 않은 새 노드 생성
               </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default StoryEditor;
