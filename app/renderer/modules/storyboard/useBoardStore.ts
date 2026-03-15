import { applyEdgeChanges, applyNodeChanges, type Edge, type EdgeChange, type Node, type NodeChange } from "@xyflow/react";
import { create } from "zustand";
import { normalizeStoryConnectorHandle, type StoryBoardState, type StoryConnectorHandle, type StoryEdge, type StoryNode } from "./boardTypes";

interface BoardStore extends StoryBoardState {
  isLoaded: boolean;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  setBoard: (board: StoryBoardState) => void;
  setNodes: (nodes: StoryNode[]) => void;
  setEdges: (edges: StoryEdge[]) => void;
  addNode: (node: StoryNode) => void;
  updateNode: (nodeId: string, patch: Partial<Omit<StoryNode, "id">>) => void;
  deleteNode: (nodeId: string) => void;
  applyNodeChanges: (changes: NodeChange[]) => void;
  addEdge: (edge: StoryEdge) => void;
  updateEdge: (edgeId: string, patch: Partial<Omit<StoryEdge, "id" | "source" | "target">>) => void;
  deleteEdge: (edgeId: string) => void;
  applyEdgeChanges: (changes: EdgeChange[]) => void;
  setSelection: (selectedNodeId: string | null, selectedEdgeId: string | null) => void;
}

function toFlowNodes(nodes: StoryNode[]): Node[] {
  return nodes.map((node) => ({
    id: node.id,
    position: node.position,
    type: "postIt",
    data: {}
  }));
}

function toStoryNodes(flowNodes: Node[], previousNodes: StoryNode[]): StoryNode[] {
  const previousById = new Map(previousNodes.map((node) => [node.id, node]));

  return flowNodes
    .map((flowNode) => {
      const existing = previousById.get(flowNode.id);
      if (!existing) {
        return null;
      }

      return {
        ...existing,
        position: flowNode.position
      };
    })
    .filter((node): node is StoryNode => node !== null);
}

function toFlowEdges(edges: StoryEdge[]): Edge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ? `source:${edge.sourceHandle}` : undefined,
    targetHandle: edge.targetHandle ? `target:${edge.targetHandle}` : undefined,
    type: "redString",
    data: {},
    label: edge.label
  }));
}

function toStoryHandle(value: string | null | undefined, fallback?: StoryConnectorHandle): StoryConnectorHandle | undefined {
  if (!value) {
    return fallback;
  }

  const normalizedValue = value.includes(":") ? value.split(":")[1] : value;
  return normalizeStoryConnectorHandle(normalizedValue, fallback);
}

function toStoryEdges(flowEdges: Edge[], previousEdges: StoryEdge[]): StoryEdge[] {
  const previousById = new Map(previousEdges.map((edge) => [edge.id, edge]));
  const nextEdges: StoryEdge[] = [];

  flowEdges.forEach((flowEdge) => {
    const existing = previousById.get(flowEdge.id);
    if (!existing) {
      return;
    }

    nextEdges.push({
      ...existing,
      sourceHandle: toStoryHandle(flowEdge.sourceHandle, existing.sourceHandle),
      targetHandle: toStoryHandle(flowEdge.targetHandle, existing.targetHandle),
      label: typeof flowEdge.label === "string" ? flowEdge.label : existing.label
    });
  });

  return nextEdges;
}

export const useBoardStore = create<BoardStore>((set) => ({
  nodes: [],
  edges: [],
  isLoaded: false,
  selectedNodeId: null,
  selectedEdgeId: null,
  setBoard: (board) =>
    set({
      nodes: board.nodes,
      edges: board.edges,
      isLoaded: true,
      selectedNodeId: null,
      selectedEdgeId: null
    }),
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  addNode: (node) =>
    set((state) => ({
      nodes: [...state.nodes, node],
      selectedNodeId: node.id,
      selectedEdgeId: null
    })),
  updateNode: (nodeId, patch) =>
    set((state) => ({
      nodes: state.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node))
    })),
  deleteNode: (nodeId) =>
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== nodeId),
      edges: state.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
      selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId
    })),
  applyNodeChanges: (changes) =>
    set((state) => {
      const nextNodes = toStoryNodes(applyNodeChanges(changes, toFlowNodes(state.nodes)), state.nodes);
      const removedNodeIds = new Set(state.nodes.filter((node) => !nextNodes.some((candidate) => candidate.id === node.id)).map((node) => node.id));

      return {
        nodes: nextNodes,
        edges:
          removedNodeIds.size > 0
            ? state.edges.filter((edge) => !removedNodeIds.has(edge.source) && !removedNodeIds.has(edge.target))
            : state.edges,
        selectedNodeId:
          state.selectedNodeId && removedNodeIds.has(state.selectedNodeId) ? null : state.selectedNodeId
      };
    }),
  addEdge: (edge) =>
    set((state) => ({
      edges: [...state.edges, edge],
      selectedNodeId: null,
      selectedEdgeId: edge.id
    })),
  updateEdge: (edgeId, patch) =>
    set((state) => ({
      edges: state.edges.map((edge) => (edge.id === edgeId ? { ...edge, ...patch } : edge))
    })),
  deleteEdge: (edgeId) =>
    set((state) => ({
      edges: state.edges.filter((edge) => edge.id !== edgeId),
      selectedEdgeId: state.selectedEdgeId === edgeId ? null : state.selectedEdgeId
    })),
  applyEdgeChanges: (changes) =>
    set((state) => {
      const nextEdges = toStoryEdges(applyEdgeChanges(changes, toFlowEdges(state.edges)), state.edges);
      const removedEdgeIds = new Set(state.edges.filter((edge) => !nextEdges.some((candidate) => candidate.id === edge.id)).map((edge) => edge.id));

      return {
        edges: nextEdges,
        selectedEdgeId:
          state.selectedEdgeId && removedEdgeIds.has(state.selectedEdgeId) ? null : state.selectedEdgeId
      };
    }),
  setSelection: (selectedNodeId, selectedEdgeId) =>
    set({
      selectedNodeId,
      selectedEdgeId
    })
}));
