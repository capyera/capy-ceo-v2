import { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MarkerType,
  NodeTypes,
  Handle,
  Position,
  Panel,
  NodeResizer,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { supabase } from '../lib/supabase';
import {
  Plus, Save, Trash2, X, Edit2, HelpCircle, ChevronLeft,
  Target, ShoppingBag, Users, Package, Truck, Megaphone, 
  Video, Palette, HeadphonesIcon, DollarSign, AlertCircle,
  CheckCircle2, Clock, Circle, Copy, Clipboard, Building2,
  FolderKanban, Layers, Flag
} from 'lucide-react';

// ============ TYPES ============
interface CanvasNodeData {
  label: string;
  description?: string;
  status: string;
  category?: string;
  color: string;
  questions?: string[];
  nodeType?: 'team' | 'plan' | 'focus-area' | 'objective' | 'initiative';
}

// ============ CONFIG ============
const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  not_started: { label: 'Not Started', color: 'slate', icon: Circle },
  in_progress: { label: 'In Progress', color: 'blue', icon: Clock },
  blocked: { label: 'Blocked', color: 'red', icon: AlertCircle },
  done: { label: 'Done', color: 'emerald', icon: CheckCircle2 },
  opportunity: { label: 'Opportunity', color: 'purple', icon: Target },
};

const nodeTypeConfig: Record<string, { label: string; icon: any; defaultColor: string }> = {
  team: { label: 'Team', icon: Building2, defaultColor: 'indigo' },
  plan: { label: 'Plan', icon: FolderKanban, defaultColor: 'blue' },
  'focus-area': { label: 'Focus Area', icon: Layers, defaultColor: 'purple' },
  objective: { label: 'Objective', icon: Target, defaultColor: 'emerald' },
  initiative: { label: 'Initiative', icon: Flag, defaultColor: 'amber' },
};

const categoryConfig: Record<string, { label: string; icon: any; color: string }> = {
  channel: { label: 'Channel', icon: ShoppingBag, color: 'blue' },
  team: { label: 'Team', icon: Users, color: 'purple' },
  product: { label: 'Product', icon: Package, color: 'pink' },
  operations: { label: 'Operations', icon: Truck, color: 'amber' },
  marketing: { label: 'Marketing', icon: Megaphone, color: 'green' },
  content: { label: 'Content', icon: Video, color: 'red' },
  creative: { label: 'Creative', icon: Palette, color: 'orange' },
  support: { label: 'Support', icon: HeadphonesIcon, color: 'cyan' },
  finance: { label: 'Finance', icon: DollarSign, color: 'emerald' },
};

const colorClasses: Record<string, { bg: string; border: string; text: string; solid: string }> = {
  slate: { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-700', solid: 'bg-slate-500' },
  blue: { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-700', solid: 'bg-blue-500' },
  purple: { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-700', solid: 'bg-purple-500' },
  pink: { bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-700', solid: 'bg-pink-500' },
  amber: { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-700', solid: 'bg-amber-500' },
  green: { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-700', solid: 'bg-green-500' },
  red: { bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-700', solid: 'bg-red-500' },
  orange: { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-700', solid: 'bg-orange-500' },
  cyan: { bg: 'bg-cyan-100', border: 'border-cyan-300', text: 'text-cyan-700', solid: 'bg-cyan-500' },
  emerald: { bg: 'bg-emerald-100', border: 'border-emerald-300', text: 'text-emerald-700', solid: 'bg-emerald-500' },
  indigo: { bg: 'bg-indigo-100', border: 'border-indigo-300', text: 'text-indigo-700', solid: 'bg-indigo-500' },
};

// ============ INITIAL DATA - Teams → Plans Hierarchy ============
const initialNodes: Node<CanvasNodeData>[] = [
  // === TEAMS (Top Level) ===
  {
    id: 'team-growth',
    type: 'resizable',
    position: { x: 50, y: 50 },
    data: {
      label: 'Growth Team',
      description: 'Marketing, ads, revenue growth',
      status: 'in_progress',
      color: 'emerald',
      nodeType: 'team',
      questions: ['Who leads this team?', 'What\'s the headcount?']
    },
    style: { width: 220, height: 100 },
  },
  {
    id: 'team-product',
    type: 'resizable',
    position: { x: 50, y: 200 },
    data: {
      label: 'Product Development',
      description: 'Design, sampling, new products',
      status: 'in_progress',
      color: 'purple',
      nodeType: 'team',
      questions: ['Who leads - Chia Yee or hire?']
    },
    style: { width: 220, height: 100 },
  },
  {
    id: 'team-ops',
    type: 'resizable',
    position: { x: 50, y: 350 },
    data: {
      label: 'Ops & Supply Chain',
      description: 'Inventory, suppliers, fulfillment',
      status: 'blocked',
      color: 'amber',
      nodeType: 'team',
      questions: ['How does new hire fit?', 'Who owns inventory?']
    },
    style: { width: 220, height: 100 },
  },
  {
    id: 'team-content',
    type: 'resizable',
    position: { x: 50, y: 500 },
    data: {
      label: 'Organic Content',
      description: 'Social media, UGC, brand',
      status: 'in_progress',
      color: 'pink',
      nodeType: 'team',
      questions: ['1 fresh grad - enough?', 'Who provides direction?']
    },
    style: { width: 220, height: 100 },
  },

  // === PLANS (Under Teams) ===
  {
    id: 'plan-meta',
    type: 'resizable',
    position: { x: 350, y: 30 },
    data: {
      label: 'Meta Ads Scale',
      description: 'Scale spend while maintaining ROAS',
      status: 'in_progress',
      color: 'blue',
      nodeType: 'plan',
      questions: ['How to make team self-run?']
    },
    style: { width: 200, height: 80 },
  },
  {
    id: 'plan-amazon',
    type: 'resizable',
    position: { x: 350, y: 130 },
    data: {
      label: 'Amazon Launch',
      description: 'Certs done ✓ → Listings → Inventory',
      status: 'in_progress',
      color: 'blue',
      nodeType: 'plan',
      questions: ['When do labeled products arrive?', 'Who does listings?']
    },
    style: { width: 200, height: 80 },
  },
  {
    id: 'plan-tiktok',
    type: 'resizable',
    position: { x: 570, y: 80 },
    data: {
      label: 'TikTok Shop',
      description: 'Not started - learning curve',
      status: 'not_started',
      color: 'slate',
      nodeType: 'plan',
      questions: ['Q1 priority or wait?', 'Who would run this?']
    },
    style: { width: 180, height: 70 },
  },
  {
    id: 'plan-kids',
    type: 'resizable',
    position: { x: 350, y: 230 },
    data: {
      label: 'Kids Line Expansion',
      description: 'Hoodie launched - going well! 🔥',
      status: 'opportunity',
      color: 'purple',
      nodeType: 'plan',
      questions: ['What other kids products?', 'Double down here?']
    },
    style: { width: 200, height: 80 },
  },
  {
    id: 'plan-new-characters',
    type: 'resizable',
    position: { x: 570, y: 230 },
    data: {
      label: 'New Characters',
      description: 'Raccoon, otter, seal - new molds needed',
      status: 'not_started',
      color: 'pink',
      nodeType: 'plan',
      questions: ['Which character first?', 'Supplier capable?']
    },
    style: { width: 180, height: 80 },
  },
  {
    id: 'plan-suppliers',
    type: 'resizable',
    position: { x: 350, y: 380 },
    data: {
      label: 'Supplier Strategy',
      description: '4 suppliers: 1 slow, 1 fast/quality issues, 1 great, 1 new',
      status: 'in_progress',
      color: 'amber',
      nodeType: 'plan',
      questions: ['Is #3 ready to scale?', 'Contingency plan?']
    },
    style: { width: 220, height: 90 },
  },
  {
    id: 'plan-inventory',
    type: 'resizable',
    position: { x: 350, y: 490 },
    data: {
      label: 'Inventory System',
      description: 'No good system - flying blind on reorders',
      status: 'blocked',
      color: 'red',
      nodeType: 'plan',
      questions: ['What does "good enough" look like?', 'Who owns this?']
    },
    style: { width: 200, height: 80 },
  },
  {
    id: 'plan-social',
    type: 'resizable',
    position: { x: 350, y: 590 },
    data: {
      label: 'Social Growth',
      description: 'Build trillion-dollar IP through content',
      status: 'in_progress',
      color: 'pink',
      nodeType: 'plan',
      questions: ['Content strategy?', 'Hire lead or train up?']
    },
    style: { width: 200, height: 80 },
  },

  // === FOCUS AREAS / KEY OBJECTIVES ===
  {
    id: 'obj-creative-team',
    type: 'resizable',
    position: { x: 620, y: 380 },
    data: {
      label: 'Build Self-Running Creative Team',
      description: 'Currently James is bottleneck',
      status: 'blocked',
      color: 'red',
      nodeType: 'objective',
      questions: ['Gap: strategy, execution, or volume?', 'Who could lead?']
    },
    style: { width: 200, height: 90 },
  },
  {
    id: 'obj-supply-hire',
    type: 'resizable',
    position: { x: 620, y: 490 },
    data: {
      label: 'Onboard Supply Chain Hire',
      description: 'Girl hired but unclear role',
      status: 'blocked',
      color: 'amber',
      nodeType: 'objective',
      questions: ['What was she hired to do?', 'First project?']
    },
    style: { width: 200, height: 80 },
  },
];

const initialEdges: Edge[] = [
  // Team → Plan connections
  { id: 'e-growth-meta', source: 'team-growth', target: 'plan-meta', type: 'smoothstep', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e-growth-amazon', source: 'team-growth', target: 'plan-amazon', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e-growth-tiktok', source: 'team-growth', target: 'plan-tiktok', type: 'smoothstep', style: { strokeDasharray: '5,5' }, markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e-product-kids', source: 'team-product', target: 'plan-kids', type: 'smoothstep', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e-product-chars', source: 'team-product', target: 'plan-new-characters', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e-ops-suppliers', source: 'team-ops', target: 'plan-suppliers', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e-ops-inventory', source: 'team-ops', target: 'plan-inventory', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e-content-social', source: 'team-content', target: 'plan-social', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
  // Dependencies
  { id: 'e-meta-creative', source: 'plan-meta', target: 'obj-creative-team', label: 'needs', type: 'smoothstep', style: { stroke: '#ef4444' }, markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e-inventory-hire', source: 'plan-inventory', target: 'obj-supply-hire', label: 'could own', type: 'smoothstep', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e-suppliers-amazon', source: 'plan-suppliers', target: 'plan-amazon', label: 'feeds', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
];

// ============ RESIZABLE NODE COMPONENT ============
function ResizableNode({ id, data, selected }: { id: string; data: CanvasNodeData; selected: boolean }) {
  const nodeTypeConf = data.nodeType ? nodeTypeConfig[data.nodeType] : null;
  const status = statusConfig[data.status] || statusConfig.not_started;
  const colors = colorClasses[data.color] || colorClasses.slate;
  const StatusIcon = status.icon;
  const TypeIcon = nodeTypeConf?.icon || Flag;

  return (
    <>
      <NodeResizer
        minWidth={150}
        minHeight={60}
        isVisible={selected}
        lineClassName="!border-indigo-400"
        handleClassName="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white"
      />
      
      {/* Handles on all 4 sides */}
      <Handle type="target" position={Position.Top} id="top" className="!w-3 !h-3 !bg-slate-400 !border-2 !border-white" />
      <Handle type="source" position={Position.Top} id="top-source" className="!w-3 !h-3 !bg-slate-400 !border-2 !border-white !left-[70%]" />
      <Handle type="target" position={Position.Bottom} id="bottom" className="!w-3 !h-3 !bg-slate-400 !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="!w-3 !h-3 !bg-slate-400 !border-2 !border-white !left-[70%]" />
      <Handle type="target" position={Position.Left} id="left" className="!w-3 !h-3 !bg-slate-400 !border-2 !border-white" />
      <Handle type="source" position={Position.Left} id="left-source" className="!w-3 !h-3 !bg-slate-400 !border-2 !border-white !top-[70%]" />
      <Handle type="target" position={Position.Right} id="right" className="!w-3 !h-3 !bg-slate-400 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} id="right-source" className="!w-3 !h-3 !bg-slate-400 !border-2 !border-white !top-[70%]" />
      
      <div 
        className={`
          h-full w-full p-3 rounded-xl border-2 shadow-sm overflow-hidden
          ${colors.bg} ${colors.border}
          ${selected ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}
        `}
      >
        <div className="flex items-start gap-2 h-full">
          <div className={`p-1.5 rounded-lg ${colors.border} bg-white flex-shrink-0`}>
            <TypeIcon className={`w-4 h-4 ${colors.text}`} />
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex items-center gap-2">
              <h3 className={`font-semibold text-sm ${colors.text} truncate`}>{data.label}</h3>
              <StatusIcon className={`w-4 h-4 flex-shrink-0`} style={{ color: `var(--${status.color}-500, #6b7280)` }} />
            </div>
            {data.description && (
              <p className="text-xs text-slate-600 mt-1 line-clamp-2">{data.description}</p>
            )}
            {data.questions && data.questions.length > 0 && (
              <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                <HelpCircle className="w-3 h-3" />
                <span>{data.questions.length} questions</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

const nodeTypes: NodeTypes = {
  resizable: ResizableNode,
};

// ============ NODE EDITOR MODAL ============
function NodeEditor({
  node,
  onSave,
  onDelete,
  onClose,
}: {
  node: Node | null;
  onSave: (data: CanvasNodeData) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState<CanvasNodeData>({
    label: '',
    description: '',
    status: 'not_started',
    color: 'slate',
    nodeType: 'initiative',
    questions: [],
  });
  const [newQuestion, setNewQuestion] = useState('');

  useEffect(() => {
    if (node) {
      setFormData({
        label: node.data.label || '',
        description: node.data.description || '',
        status: node.data.status || 'not_started',
        color: node.data.color || 'slate',
        nodeType: node.data.nodeType || 'initiative',
        questions: node.data.questions || [],
      });
    }
  }, [node]);

  if (!node) return null;

  const addQuestion = () => {
    if (newQuestion.trim()) {
      setFormData(prev => ({
        ...prev,
        questions: [...(prev.questions || []), newQuestion.trim()]
      }));
      setNewQuestion('');
    }
  };

  const removeQuestion = (index: number) => {
    setFormData(prev => ({
      ...prev,
      questions: (prev.questions || []).filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Edit Node</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              type="text"
              value={formData.label}
              onChange={e => setFormData({ ...formData, label: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
              <select
                value={formData.nodeType}
                onChange={e => setFormData({ ...formData, nodeType: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900"
              >
                {Object.entries(nodeTypeConfig).map(([key, config]) => (
                  <option key={key} value={key} className="text-slate-900">{config.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900"
              >
                {Object.entries(statusConfig).map(([key, config]) => (
                  <option key={key} value={key} className="text-slate-900">{config.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(colorClasses).map(([name, classes]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: name })}
                  className={`w-8 h-8 rounded-full ${classes.solid} ${
                    formData.color === name ? 'ring-2 ring-offset-2 ring-slate-400' : ''
                  }`}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Key Questions</label>
            <div className="space-y-2">
              {(formData.questions || []).map((q, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="flex-1 text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded">{q}</span>
                  <button onClick={() => removeQuestion(i)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newQuestion}
                  onChange={e => setNewQuestion(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addQuestion()}
                  placeholder="Add a question..."
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={addQuestion}
                  className="px-3 py-2 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-between">
          <button
            onClick={onDelete}
            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(formData)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ MAIN CANVAS COMPONENT ============
function CanvasInner({ onBack }: { onBack?: () => void }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [saving, setSaving] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [clipboard, setClipboard] = useState<Node | null>(null);
  const reactFlowInstance = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);

  const canvasId = 'main';

  // Load from DB on mount
  useEffect(() => {
    loadCanvas();
  }, []);

  // Keyboard shortcuts for copy/paste
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if we're focused on the canvas area
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        // Copy selected node
        const selected = nodes.find(n => n.selected);
        if (selected) {
          setClipboard(selected);
          console.log('Copied node:', selected.data.label);
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboard) {
        // Paste node
        e.preventDefault();
        const newId = `node-${Date.now()}`;
        const newNode: Node = {
          ...clipboard,
          id: newId,
          position: {
            x: clipboard.position.x + 50,
            y: clipboard.position.y + 50,
          },
          selected: false,
          data: {
            ...clipboard.data,
            label: `${clipboard.data.label} (copy)`,
          },
        };
        setNodes(nds => [...nds, newNode]);
        console.log('Pasted node:', newNode.data.label);
      }

      // Delete with Delete or Backspace key
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        const selected = nodes.find(n => n.selected);
        if (selected) {
          setNodes(nds => nds.filter(n => n.id !== selected.id));
          setEdges(eds => eds.filter(e => e.source !== selected.id && e.target !== selected.id));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, clipboard, setNodes, setEdges]);

  const loadCanvas = async () => {
    try {
      const [nodesRes, edgesRes] = await Promise.all([
        supabase.from('strategy_canvas_nodes').select('*').eq('canvas_id', canvasId),
        supabase.from('strategy_canvas_edges').select('*').eq('canvas_id', canvasId),
      ]);

      if (nodesRes.data && nodesRes.data.length > 0) {
        const loadedNodes: Node[] = nodesRes.data.map(n => ({
          id: n.node_id,
          type: 'resizable',
          position: { x: n.position_x, y: n.position_y },
          style: { width: n.width || 200, height: n.height || 80 },
          data: {
            label: n.label,
            description: n.description,
            status: n.status,
            color: n.color,
            nodeType: n.data?.nodeType || 'initiative',
            questions: n.data?.questions || [],
          },
        }));
        setNodes(loadedNodes);

        if (edgesRes.data && edgesRes.data.length > 0) {
          const loadedEdges: Edge[] = edgesRes.data.map(e => ({
            id: e.edge_id,
            source: e.source_node_id,
            target: e.target_node_id,
            sourceHandle: e.data?.sourceHandle,
            targetHandle: e.data?.targetHandle,
            label: e.label,
            type: e.type || 'smoothstep',
            animated: e.animated,
            markerEnd: { type: MarkerType.ArrowClosed },
          }));
          setEdges(loadedEdges);
        }
      }
    } catch (error) {
      console.error('Error loading canvas:', error);
    }
  };

  const saveCanvas = async () => {
    setSaving(true);
    try {
      // Delete existing and re-insert (simpler than upsert with all fields)
      await supabase.from('strategy_canvas_nodes').delete().eq('canvas_id', canvasId);
      await supabase.from('strategy_canvas_edges').delete().eq('canvas_id', canvasId);

      const nodeRecords = nodes.map(n => ({
        canvas_id: canvasId,
        node_id: n.id,
        type: 'resizable',
        label: n.data.label,
        description: n.data.description,
        status: n.data.status,
        color: n.data.color,
        position_x: n.position.x,
        position_y: n.position.y,
        width: n.style?.width || n.width || 200,
        height: n.style?.height || n.height || 80,
        data: { 
          nodeType: n.data.nodeType,
          questions: n.data.questions || [] 
        },
      }));

      if (nodeRecords.length > 0) {
        await supabase.from('strategy_canvas_nodes').insert(nodeRecords);
      }

      if (edges.length > 0) {
        const edgeRecords = edges.map(e => ({
          canvas_id: canvasId,
          edge_id: e.id,
          source_node_id: e.source,
          target_node_id: e.target,
          label: e.label as string | undefined,
          type: e.type || 'smoothstep',
          animated: e.animated || false,
          data: {
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle,
          },
        }));
        await supabase.from('strategy_canvas_edges').insert(edgeRecords);
      }

      console.log('Canvas saved!');
    } catch (error) {
      console.error('Error saving canvas:', error);
    }
    setSaving(false);
  };

  const onConnect = useCallback((connection: Connection) => {
    const newEdge: Edge = {
      ...connection,
      id: `e-${Date.now()}`,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed },
    } as Edge;
    setEdges(eds => addEdge(newEdge, eds));
  }, [setEdges]);

  const onNodeDoubleClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
    setShowEditor(true);
  }, []);

  const handleAddNode = (nodeType: string = 'initiative') => {
    const config = nodeTypeConfig[nodeType] || nodeTypeConfig.initiative;
    const newId = `node-${Date.now()}`;
    const newNode: Node = {
      id: newId,
      type: 'resizable',
      position: { x: 400, y: 300 },
      style: { width: 200, height: 80 },
      data: {
        label: `New ${config.label}`,
        description: '',
        status: 'not_started',
        color: config.defaultColor,
        nodeType: nodeType,
        questions: [],
      },
    };
    setNodes(nds => [...nds, newNode]);
  };

  const handleUpdateNode = (data: CanvasNodeData) => {
    if (!selectedNode) return;
    
    setNodes(nds => nds.map(n => {
      if (n.id === selectedNode.id) {
        return { ...n, data: { ...n.data, ...data } };
      }
      return n;
    }));
    setShowEditor(false);
    setSelectedNode(null);
  };

  const handleDeleteNode = () => {
    if (!selectedNode) return;
    
    setNodes(nds => nds.filter(n => n.id !== selectedNode.id));
    setEdges(eds => eds.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setShowEditor(false);
    setSelectedNode(null);
  };

  return (
    <div ref={containerRef} className="flex-1 h-full flex flex-col bg-slate-100">
      {/* Header */}
      <div className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <h1 className="text-lg font-semibold text-slate-900">Strategy Canvas</h1>
          <span className="text-xs text-slate-500 hidden md:block">
            Double-click to edit • Drag handles to connect • Ctrl+C/V to copy/paste • Drag corners to resize
          </span>
        </div>
        <div className="flex items-center gap-2">
          {clipboard && (
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Clipboard className="w-3 h-3" />
              Copied: {clipboard.data.label}
            </span>
          )}
          <div className="flex items-center gap-1">
            {Object.entries(nodeTypeConfig).map(([key, config]) => (
              <button
                key={key}
                onClick={() => handleAddNode(key)}
                className="px-2 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg flex items-center gap-1 text-slate-700"
                title={`Add ${config.label}`}
              >
                <Plus className="w-3 h-3" />
                <config.icon className="w-3 h-3" />
                <span className="hidden xl:inline">{config.label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={saveCanvas}
            disabled={saving}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDoubleClick={onNodeDoubleClick}
          nodeTypes={nodeTypes}
          fitView
          snapToGrid
          snapGrid={[20, 20]}
          minZoom={0.1}
          maxZoom={4}
          connectionMode="loose" as any
          defaultEdgeOptions={{
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed },
          }}
        >
          <Background gap={20} size={1} />
          <Controls />
          <Panel position="bottom-left" className="bg-white rounded-lg shadow-lg p-3">
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-indigo-500" /> Team
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-blue-500" /> Plan
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-purple-500" /> Focus Area
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-emerald-500" /> Objective
              </div>
            </div>
          </Panel>
          <Panel position="bottom-right" className="bg-white rounded-lg shadow-lg p-2 text-xs text-slate-500">
            <div className="flex items-center gap-3">
              <span>⌘/Ctrl + C: Copy</span>
              <span>⌘/Ctrl + V: Paste</span>
              <span>Delete: Remove</span>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Node Editor Modal */}
      {showEditor && (
        <NodeEditor
          node={selectedNode}
          onSave={handleUpdateNode}
          onDelete={handleDeleteNode}
          onClose={() => { setShowEditor(false); setSelectedNode(null); }}
        />
      )}
    </div>
  );
}

// ============ EXPORTED COMPONENT WITH PROVIDER ============
export function StrategyCanvas({ onBack }: { onBack?: () => void }) {
  return (
    <ReactFlowProvider>
      <CanvasInner onBack={onBack} />
    </ReactFlowProvider>
  );
}

export default StrategyCanvas;
