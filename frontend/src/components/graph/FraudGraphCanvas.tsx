import { useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type NodeProps,
  type Node,
  type Edge,
} from '@xyflow/react';
import {
  CreditCard,
  User,
  AlertTriangle,
  Smartphone,
  MapPin,
  Mail,
  Info,
  ShieldAlert,
} from 'lucide-react';
import type { GraphEdge as MyGraphEdge, GraphNode as MyGraphNode } from '../../types/fraud';

// Custom Node: Customer
function CustomerNode({ data, selected }: NodeProps) {
  return (
    <div
      className={`min-w-[170px] rounded-xl border bg-slate-900/95 p-3 shadow-xl backdrop-blur transition-all ${
        selected ? 'border-cyan-400 ring-2 ring-cyan-400/40' : 'border-cyan-500/40 hover:border-cyan-400'
      }`}
    >
      <Handle type="source" position={Position.Right} className="!bg-cyan-400" />
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
          <User size={16} />
        </div>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400">Customer</span>
          <p className="text-xs font-bold text-white">{String(data.label || '')}</p>
        </div>
      </div>
      {data.sub ? <p className="mt-2 text-[10px] text-slate-400">{String(data.sub)}</p> : null}
    </div>
  );
}

// Custom Node: Card
function CardNode({ data, selected }: NodeProps) {
  return (
    <div
      className={`min-w-[170px] rounded-xl border bg-slate-900/95 p-3 shadow-xl backdrop-blur transition-all ${
        selected ? 'border-violet-400 ring-2 ring-violet-400/40' : 'border-violet-500/40 hover:border-violet-400'
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-violet-400" />
      <Handle type="source" position={Position.Right} className="!bg-violet-400" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-violet-400" />
      <Handle type="target" position={Position.Top} id="top" className="!bg-violet-400" />
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-400/30 bg-violet-400/10 text-violet-300">
          <CreditCard size={16} />
        </div>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-400">Payment Card</span>
          <p className="text-xs font-bold text-white">{String(data.label || '')}</p>
        </div>
      </div>
      {data.sub ? <p className="mt-2 text-[10px] text-slate-400">{String(data.sub)}</p> : null}
    </div>
  );
}

// Custom Node: Transaction
function TransactionNode({ data, selected }: NodeProps) {
  const isFlagged = Boolean(data.isFlagged);
  return (
    <div
      className={`min-w-[190px] rounded-xl border bg-slate-900/95 p-3 shadow-xl backdrop-blur transition-all ${
        isFlagged
          ? selected
            ? 'border-amber-400 ring-2 ring-amber-400/40'
            : 'border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
          : selected
          ? 'border-slate-400 ring-2 ring-slate-400/40'
          : 'border-slate-700'
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-amber-400" />
      <Handle type="source" position={Position.Right} className="!bg-amber-400" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-amber-400" />
      <Handle type="target" position={Position.Top} id="top" className="!bg-amber-400" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
              isFlagged
                ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
                : 'border-slate-700 bg-slate-800 text-slate-300'
            }`}
          >
            <AlertTriangle size={15} />
          </div>
          <div>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider ${
                isFlagged ? 'text-amber-400' : 'text-slate-400'
              }`}
            >
              {isFlagged ? 'Flagged Txn' : 'Transaction'}
            </span>
            <p className="text-xs font-bold text-white">{String(data.label || '')}</p>
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-slate-800 pt-2 text-[11px]">
        <span className="font-semibold text-slate-200">{String(data.title || '')}</span>
        {data.risk !== undefined ? (
          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
            Risk: {Number(data.risk).toFixed(2)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// Custom Node: Device
function DeviceNode({ data, selected }: NodeProps) {
  return (
    <div
      className={`min-w-[170px] rounded-xl border bg-slate-900/95 p-3 shadow-xl backdrop-blur transition-all ${
        selected ? 'border-emerald-400 ring-2 ring-emerald-400/40' : 'border-emerald-500/40 hover:border-emerald-400'
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-emerald-400" />
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
          <Smartphone size={16} />
        </div>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Device Profile</span>
          <p className="text-xs font-bold text-white">{String(data.label || '')}</p>
        </div>
      </div>
      {data.sub ? <p className="mt-2 text-[10px] text-slate-400">{String(data.sub)}</p> : null}
    </div>
  );
}

// Custom Node: Region
function RegionNode({ data, selected }: NodeProps) {
  return (
    <div
      className={`min-w-[160px] rounded-xl border bg-slate-900/95 p-3 shadow-xl backdrop-blur transition-all ${
        selected ? 'border-blue-400 ring-2 ring-blue-400/40' : 'border-blue-500/40 hover:border-blue-400'
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-blue-400" />
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-400/30 bg-blue-400/10 text-blue-300">
          <MapPin size={16} />
        </div>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">Billing Region</span>
          <p className="text-xs font-bold text-white">{String(data.label || '')}</p>
        </div>
      </div>
    </div>
  );
}

// Custom Node: Email
function EmailNode({ data, selected }: NodeProps) {
  return (
    <div
      className={`min-w-[160px] rounded-xl border bg-slate-900/95 p-3 shadow-xl backdrop-blur transition-all ${
        selected ? 'border-sky-400 ring-2 ring-sky-400/40' : 'border-sky-500/40 hover:border-sky-400'
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-sky-400" />
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-400/30 bg-sky-400/10 text-sky-300">
          <Mail size={16} />
        </div>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-400">Email Domain</span>
          <p className="text-xs font-bold text-white">{String(data.label || '')}</p>
        </div>
      </div>
    </div>
  );
}

// Custom Node: HistoricalCase
function HistoricalCaseNode({ data, selected }: NodeProps) {
  return (
    <div
      className={`min-w-[180px] rounded-xl border bg-slate-900/95 p-3 shadow-xl backdrop-blur transition-all ${
        selected ? 'border-fuchsia-400 ring-2 ring-fuchsia-400/40' : 'border-fuchsia-500/40 hover:border-fuchsia-400'
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-fuchsia-400" />
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-300">
          <ShieldAlert size={16} />
        </div>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-fuchsia-400">Institutional Memory</span>
          <p className="text-xs font-bold text-white">{String(data.label || '')}</p>
        </div>
      </div>
      {data.sub ? <p className="mt-2 text-[10px] font-medium text-slate-300">{String(data.sub)}</p> : null}
    </div>
  );
}

const nodeTypes = {
  Customer: CustomerNode,
  Card: CardNode,
  Transaction: TransactionNode,
  Device: DeviceNode,
  Region: RegionNode,
  Email: EmailNode,
  HistoricalCase: HistoricalCaseNode,
};

interface FraudGraphCanvasProps {
  nodes: MyGraphNode[];
  edges: MyGraphEdge[];
  caseId: string;
  hasDevice: boolean;
  deviceStatus?: string;
  height?: string;
}

export function FraudGraphCanvas({
  nodes: initialNodes,
  edges: initialEdges,
  caseId,
  hasDevice,
  deviceStatus = 'Device evidence unavailable',
  height = '480px',
}: FraudGraphCanvasProps) {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const rfNodes: Node[] = useMemo(
    () =>
      initialNodes.map((n) => ({
        id: n.id,
        type: n.type,
        data: n.data,
        position: n.position,
      })),
    [initialNodes]
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      initialEdges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: Boolean(e.animated),
        style: { stroke: '#475569', strokeWidth: 1.5 },
        labelStyle: { fill: '#94a3b8', fontSize: 10, fontWeight: 600 },
        labelBgStyle: { fill: '#0f172a', fillOpacity: 0.85, rx: 4, ry: 4 },
        labelBgPadding: [6, 2],
      })),
    [initialEdges]
  );

  const isHHG002 = caseId === 'HHG-002';
  const showMissingDeviceBanner = isHHG002 || !hasDevice;

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950" style={{ height }}>
      {/* Top Banner for HHG-002 / Missing Device state */}
      {showMissingDeviceBanner && (
        <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-lg border border-amber-400/30 bg-slate-900/90 px-3 py-1.5 text-xs text-amber-200 shadow-lg backdrop-blur">
          <Info size={14} className="text-amber-400" />
          <span className="font-semibold">{deviceStatus}</span>
          <span className="text-[10px] text-slate-400">· Zero device nodes rendered</span>
        </div>
      )}

      {/* Selected Node Details Drawer */}
      {selectedNode && (
        <div className="absolute bottom-4 right-4 z-10 max-w-xs rounded-xl border border-slate-700 bg-slate-900/95 p-4 text-xs shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold uppercase tracking-wider text-cyan-400">{selectedNode.type} Details</span>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-slate-500 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="mt-2 space-y-1 text-slate-300">
            <p><strong className="text-white">ID:</strong> {selectedNode.id}</p>
            <p><strong className="text-white">Label:</strong> {String(selectedNode.data.label || '')}</p>
            {selectedNode.data.sub ? (
              <p><strong className="text-white">Meta:</strong> {String(selectedNode.data.sub)}</p>
            ) : null}
            {selectedNode.data.risk !== undefined ? (
              <p><strong className="text-white">Risk:</strong> {Number(selectedNode.data.risk)}</p>
            ) : null}
          </div>
        </div>
      )}

      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => setSelectedNode(node)}
        onPaneClick={() => setSelectedNode(null)}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.5}
      >
        <Background color="#334155" gap={24} size={1} />
        <Controls className="!border-slate-800 !bg-slate-900/90 !text-slate-200" />
        <MiniMap
          nodeColor={(n) => {
            switch (n.type) {
              case 'Customer':
                return '#22d3ee';
              case 'Card':
                return '#a78bfa';
              case 'Transaction':
                return '#f59e0b';
              case 'Device':
                return '#10b981';
              case 'Region':
                return '#3b82f6';
              case 'HistoricalCase':
                return '#e879f9';
              default:
                return '#64748b';
            }
          }}
          className="!border-slate-800 !bg-slate-950/80"
          maskColor="rgba(15, 23, 42, 0.7)"
        />
      </ReactFlow>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-slate-800/80 bg-slate-900/80 px-3 py-1.5 text-[10px] text-slate-400 backdrop-blur">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-cyan-400" /> Customer</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet-400" /> Card</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" /> Transaction</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Device</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-400" /> Region</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-fuchsia-400" /> Closed Case</span>
      </div>
    </div>
  );
}
