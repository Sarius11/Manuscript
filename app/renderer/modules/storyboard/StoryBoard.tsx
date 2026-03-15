import "@xyflow/react/dist/style.css";
import {
  Background,
  BackgroundVariant,
  getBezierPath,
  Position,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  ConnectionMode,
  SelectionMode,
  useReactFlow,
  type Connection,
  type Edge,
  type OnSelectionChangeParams,
  type Viewport,
  type XYPosition
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Text, XStack, YStack } from "tamagui";
import { AppButton, SectionLabel } from "../../components/uiPrimitives";
import { storyBoardEdgeTypes } from "./EdgeTypes";
import PostItNode, { type PostItFlowNode } from "./PostItNode";
import {
  buildBoardInsights,
  createEntityId,
  createStoryNode,
  getBoardNodeColor,
  parseBoardState,
  serializeBoardState,
  STORY_CONNECTOR_CENTER_OFFSETS,
  STORY_BOARD_NODE_WIDTH,
  STORY_BOARD_NODE_HEIGHT,
  normalizeStoryConnectorHandle,
  type StoryBoardSceneOption,
  type StoryConnectorHandle,
  type StoryBoardState,
  type StoryEdge,
  type StoryNodeType
} from "./boardTypes";
import { useBoardStore } from "./useBoardStore";

type StoryBoardViewMode = "board" | "list";
type FlowNode = PostItFlowNode;
type FlowEdge = Edge<Record<string, never>>;

interface StoryBoardProps {
  projectPath: string;
  sceneOptions?: StoryBoardSceneOption[];
  onOpenScene?: (sceneId: string) => void;
  onError?: (message: string | null) => void;
}

interface DraftConnectionState {
  sourceNodeId: string;
  sourceHandle: StoryConnectorHandle;
  pointerX: number;
  pointerY: number;
}

const storyBoardNodeTypes = {
  postIt: PostItNode
};

const BOARD_NODE_HALF_HEIGHT = STORY_BOARD_NODE_HEIGHT / 2;
const STORY_STRING_STROKE = "#A12E2E";
const STORY_STRING_STROKE_SELECTED = "#C66161";

function stopInputEvent(event: MouseEvent<HTMLElement>): void {
  event.stopPropagation();
}

function getConnectorPosition(handle: StoryConnectorHandle): Position {
  switch (handle) {
    case "left":
      return Position.Left;
    case "right":
      return Position.Right;
    case "top":
      return Position.Top;
    case "bottom":
      return Position.Bottom;
  }
}

function getSourceHandleId(handle: StoryConnectorHandle): string {
  return `source:${handle}`;
}

function getTargetHandleId(handle: StoryConnectorHandle): string {
  return `target:${handle}`;
}

function getConnectorScreenPosition(
  nodePosition: XYPosition,
  handle: StoryConnectorHandle,
  viewport: Viewport
): XYPosition {
  const connectorOffset = STORY_CONNECTOR_CENTER_OFFSETS[handle];

  return {
    x: viewport.x + (nodePosition.x + connectorOffset.x) * viewport.zoom,
    y: viewport.y + (nodePosition.y + connectorOffset.y) * viewport.zoom
  };
}

function inferDraftTargetPosition(startX: number, startY: number, endX: number, endY: number): Position {
  const deltaX = endX - startX;
  const deltaY = endY - startY;

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0 ? Position.Left : Position.Right;
  }

  return deltaY >= 0 ? Position.Top : Position.Bottom;
}

function SummaryCard({
  title,
  caption,
  children
}: {
  title: string;
  caption?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <YStack
      gap="$3"
      backgroundColor="$paperDarker"
      borderWidth={1}
      borderColor="$panelLine"
      borderRadius="$3"
      padding="$4"
      minWidth={0}
    >
      <XStack justifyContent="space-between" alignItems="center" gap="$3">
        <SectionLabel>{title}</SectionLabel>
        {caption ? (
          <Text color="$textMuted" fontFamily="$body" fontSize="$1">
            {caption}
          </Text>
        ) : null}
      </XStack>
      {children}
    </YStack>
  );
}

function StoryBoardCanvas({
  projectPath,
  sceneOptions = [],
  onOpenScene,
  onError
}: StoryBoardProps): JSX.Element {
  const desktopApi = typeof window !== "undefined" ? window.codex : undefined;
  const reactFlow = useReactFlow<FlowNode, FlowEdge>();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const hasAppliedInitialFitRef = useRef<boolean>(false);
  const [viewMode, setViewMode] = useState<StoryBoardViewMode>("board");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loadedProjectPath, setLoadedProjectPath] = useState<string | null>(null);
  const [draftConnection, setDraftConnection] = useState<DraftConnectionState | null>(null);
  const [viewportState, setViewportState] = useState<Viewport>({
    x: 0,
    y: 0,
    zoom: 1
  });
  const nodes = useBoardStore((state) => state.nodes);
  const edges = useBoardStore((state) => state.edges);
  const isLoaded = useBoardStore((state) => state.isLoaded);
  const selectedNodeId = useBoardStore((state) => state.selectedNodeId);
  const selectedEdgeId = useBoardStore((state) => state.selectedEdgeId);
  const setBoard = useBoardStore((state) => state.setBoard);
  const addNode = useBoardStore((state) => state.addNode);
  const updateEdge = useBoardStore((state) => state.updateEdge);
  const addEdge = useBoardStore((state) => state.addEdge);
  const deleteNode = useBoardStore((state) => state.deleteNode);
  const deleteEdge = useBoardStore((state) => state.deleteEdge);
  const applyNodeChanges = useBoardStore((state) => state.applyNodeChanges);
  const applyEdgeChanges = useBoardStore((state) => state.applyEdgeChanges);
  const setSelection = useBoardStore((state) => state.setSelection);

  const boardState = useMemo<StoryBoardState>(
    () => ({
      nodes,
      edges
    }),
    [edges, nodes]
  );

  const boardInsights = useMemo(() => buildBoardInsights(boardState), [boardState]);
  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId) ?? null, [nodes, selectedNodeId]);
  const selectedEdge = useMemo(() => edges.find((edge) => edge.id === selectedEdgeId) ?? null, [edges, selectedEdgeId]);

  const emitOpenScene = useCallback(
    (sceneId: string) => {
      window.dispatchEvent(
        new CustomEvent("storyboard:openScene", {
          detail: {
            sceneId
          }
        })
      );
      onOpenScene?.(sceneId);
    },
    [onOpenScene]
  );

  const flowNodes = useMemo<FlowNode[]>(
    () => {
      const mappedNodes: FlowNode[] = nodes.map((node) => ({
        id: node.id,
        type: "postIt" as const,
        position: node.position,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        width: STORY_BOARD_NODE_WIDTH,
        height: STORY_BOARD_NODE_HEIGHT,
        initialWidth: STORY_BOARD_NODE_WIDTH,
        initialHeight: STORY_BOARD_NODE_HEIGHT,
        style: {
          width: STORY_BOARD_NODE_WIDTH,
          height: STORY_BOARD_NODE_HEIGHT
        },
        data: {
          nodeId: node.id,
          sceneOptions,
          onOpenScene: emitOpenScene,
          onConnectionStart: (sourceNodeId: string, sourceHandle: StoryConnectorHandle) => {
            const bounds = wrapperRef.current?.getBoundingClientRect();
            const viewport = reactFlow.getViewport();
            if (!bounds) {
              return;
            }

            const connectorOffset = STORY_CONNECTOR_CENTER_OFFSETS[sourceHandle];

            setDraftConnection({
              sourceNodeId,
              sourceHandle,
              pointerX: viewport.x + (node.position.x + connectorOffset.x) * viewport.zoom,
              pointerY: viewport.y + (node.position.y + connectorOffset.y) * viewport.zoom
            });
          },
          onConnectionComplete: (targetNodeId: string, targetHandle: StoryConnectorHandle) => {
            setDraftConnection((currentDraft) => {
              if (!currentDraft || currentDraft.sourceNodeId === targetNodeId) {
                return null;
              }

              addEdge({
                id: createEntityId("edge"),
                source: currentDraft.sourceNodeId,
                target: targetNodeId,
                sourceHandle: currentDraft.sourceHandle,
                targetHandle,
                label: ""
              });

              return null;
            });
          },
          isConnecting: draftConnection?.sourceNodeId === node.id,
          activeConnectionHandle: draftConnection?.sourceNodeId === node.id ? draftConnection.sourceHandle : null
        }
      }));

      return mappedNodes;
    },
    [addEdge, draftConnection?.sourceHandle, draftConnection?.sourceNodeId, emitOpenScene, nodes, reactFlow, sceneOptions]
  );

  const flowEdges = useMemo<FlowEdge[]>(
    () => {
      const mappedEdges = edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: getSourceHandleId(normalizeStoryConnectorHandle(edge.sourceHandle, "right") ?? "right"),
        targetHandle: getTargetHandleId(normalizeStoryConnectorHandle(edge.targetHandle, "left") ?? "left"),
        type: "redString",
        label: edge.label
      }));
      return mappedEdges;
    },
    [edges]
  );

  const placeNodeAt = useCallback(
    (nodeType: StoryNodeType, position: XYPosition) => {
      addNode(createStoryNode(nodeType, position));
      setViewMode("board");
      window.requestAnimationFrame(() => {
        void reactFlow
          .setCenter(position.x + STORY_BOARD_NODE_WIDTH / 2, position.y + BOARD_NODE_HALF_HEIGHT, {
            zoom: Math.max(reactFlow.getZoom(), 0.9),
            duration: 220
          })
          .then(() => {
            setViewportState(reactFlow.getViewport());
          });
      });
    },
    [addNode, reactFlow]
  );

  const placeNodeAtViewportCenter = useCallback(
    (nodeType: StoryNodeType) => {
      const bounds = wrapperRef.current?.getBoundingClientRect();
      if (!bounds) {
        placeNodeAt(nodeType, {
          x: nodes.length * 40,
          y: nodes.length * 24
        });
        return;
      }

      const position = reactFlow.screenToFlowPosition({
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2
      });
      placeNodeAt(nodeType, position);
    },
    [nodes.length, placeNodeAt, reactFlow]
  );

  useEffect(() => {
    if (!desktopApi || projectPath.trim().length === 0) {
      return;
    }

    let isCancelled = false;
    hasAppliedInitialFitRef.current = false;
    setLoadedProjectPath(null);
    setStatusMessage("Loading board...");
    onError?.(null);

    const load = async (): Promise<void> => {
      try {
        const rawContent = await desktopApi.loadBoard(projectPath);
        if (isCancelled) {
          return;
        }

        setBoard(parseBoardState(rawContent));
        setLoadedProjectPath(projectPath);
        setStatusMessage(null);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : String(error);
        setBoard({
          nodes: [],
          edges: []
        });
        setLoadedProjectPath(projectPath);
        setStatusMessage(`Board fallback loaded. ${message}`);
        onError?.(`Failed to load board. ${message}`);
      }
    };

    void load();

    return () => {
      isCancelled = true;
    };
  }, [desktopApi, onError, projectPath, setBoard]);

  useEffect(() => {
    if (!desktopApi || !isLoaded || loadedProjectPath !== projectPath) {
      return;
    }

    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      void desktopApi
        .saveBoard(projectPath, serializeBoardState(boardState))
        .then(() => {
          setStatusMessage(null);
          onError?.(null);
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          setStatusMessage(`Board save failed. ${message}`);
          onError?.(`Failed to save board. ${message}`);
        });
    }, 500);

    return () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [boardState, desktopApi, isLoaded, loadedProjectPath, onError, projectPath]);

  useEffect(() => {
    if (viewMode !== "board" || loadedProjectPath !== projectPath || flowNodes.length === 0 || hasAppliedInitialFitRef.current) {
      return;
    }

    hasAppliedInitialFitRef.current = true;
    window.requestAnimationFrame(() => {
      void reactFlow
        .fitView({
          padding: 0.24,
          duration: 240
        })
        .then(() => {
          setViewportState(reactFlow.getViewport());
        });
    });
  }, [flowNodes.length, loadedProjectPath, projectPath, reactFlow, viewMode]);

  useEffect(() => {
    setViewportState(reactFlow.getViewport());
  }, [flowNodes.length, reactFlow, viewMode]);

  useEffect(() => {
    if (!draftConnection) {
      return;
    }

    const handlePointerMove = (event: PointerEvent): void => {
      const bounds = wrapperRef.current?.getBoundingClientRect();
      if (!bounds) {
        return;
      }

      setDraftConnection((currentDraft) =>
        currentDraft
          ? {
              ...currentDraft,
              pointerX: event.clientX - bounds.left,
              pointerY: event.clientY - bounds.top
            }
          : null
      );
    };

    const handlePointerUp = (): void => {
      setDraftConnection((currentDraft) => (currentDraft ? null : currentDraft));
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draftConnection]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Delete" && event.key !== "Backspace") {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) {
        return;
      }

      if (selectedEdgeId) {
        event.preventDefault();
        deleteEdge(selectedEdgeId);
        return;
      }

      if (selectedNodeId) {
        event.preventDefault();
        deleteNode(selectedNodeId);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [deleteEdge, deleteNode, selectedEdgeId, selectedNodeId]);

  const draftConnectionPath = useMemo(() => {
    if (!draftConnection) {
      return null;
    }

    const sourceNode = nodes.find((node) => node.id === draftConnection.sourceNodeId);
    if (!sourceNode) {
      return null;
    }

    const viewport = reactFlow.getViewport();
    const sourcePoint = getConnectorScreenPosition(sourceNode.position, draftConnection.sourceHandle, viewport);
    const endX = draftConnection.pointerX;
    const endY = draftConnection.pointerY;
    const [edgePath] = getBezierPath({
      sourceX: sourcePoint.x,
      sourceY: sourcePoint.y,
      sourcePosition: getConnectorPosition(draftConnection.sourceHandle),
      targetX: endX,
      targetY: endY,
      targetPosition: inferDraftTargetPosition(sourcePoint.x, sourcePoint.y, endX, endY)
    });

    return edgePath;
  }, [draftConnection, nodes, reactFlow]);

  const visibleEdges = useMemo(
    () =>
      edges
        .map((edge) => {
          const sourceNode = nodes.find((node) => node.id === edge.source);
          const targetNode = nodes.find((node) => node.id === edge.target);
          if (!sourceNode || !targetNode) {
            return null;
          }

          const sourceHandle = normalizeStoryConnectorHandle(edge.sourceHandle, "right") ?? "right";
          const targetHandle = normalizeStoryConnectorHandle(edge.targetHandle, "left") ?? "left";
          const sourcePoint = getConnectorScreenPosition(sourceNode.position, sourceHandle, viewportState);
          const targetPoint = getConnectorScreenPosition(targetNode.position, targetHandle, viewportState);
          const [path, labelX, labelY] = getBezierPath({
            sourceX: sourcePoint.x,
            sourceY: sourcePoint.y,
            sourcePosition: getConnectorPosition(sourceHandle),
            targetX: targetPoint.x,
            targetY: targetPoint.y,
            targetPosition: getConnectorPosition(targetHandle)
          });

          return {
            edge,
            path,
            labelX,
            labelY
          };
        })
        .filter((edgeOverlay): edgeOverlay is NonNullable<typeof edgeOverlay> => edgeOverlay !== null),
    [edges, nodes, viewportState.x, viewportState.y, viewportState.zoom]
  );

  const handleCanvasDoubleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (
        target.closest(".react-flow__node") ||
        target.closest(".react-flow__edge") ||
        target.closest("input") ||
        target.closest("textarea") ||
        target.closest("select") ||
        target.closest("button")
      ) {
        return;
      }

      const position = reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY
      });
      placeNodeAt("note", position);
    },
    [placeNodeAt, reactFlow]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target) {
        return;
      }

      const nextEdge: StoryEdge = {
        id: createEntityId("edge"),
        source: connection.source,
        target: connection.target,
        sourceHandle: normalizeStoryConnectorHandle(connection.sourceHandle, "right"),
        targetHandle: normalizeStoryConnectorHandle(connection.targetHandle, "left"),
        label: ""
      };

      addEdge(nextEdge);
    },
    [addEdge]
  );

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }: OnSelectionChangeParams) => {
      setSelection(selectedNodes[0]?.id ?? null, selectedEdges[0]?.id ?? null);
    },
    [setSelection]
  );

  return (
    <YStack flex={1} minHeight={0}>
      <YStack
        paddingHorizontal="$4"
        paddingVertical="$3"
        borderBottomWidth={1}
        borderBottomColor="$panelLine"
        backgroundColor="$paperDarker"
        gap="$3"
      >
        <XStack justifyContent="space-between" alignItems="center" gap="$3" flexWrap="wrap">
          <XStack gap="$2" flexWrap="wrap">
            <AppButton tone={viewMode === "board" ? "focus" : "default"} onPress={() => setViewMode("board")}>
              Board
            </AppButton>
            <AppButton tone={viewMode === "list" ? "focus" : "default"} onPress={() => setViewMode("list")}>
              List
            </AppButton>
          </XStack>
          <XStack gap="$2" flexWrap="wrap">
            <AppButton onPress={() => placeNodeAtViewportCenter("note")}>Add Note</AppButton>
            <AppButton onPress={() => placeNodeAtViewportCenter("event")}>Add Event</AppButton>
            <AppButton onPress={() => placeNodeAtViewportCenter("character")}>Add Character</AppButton>
            <AppButton onPress={() => placeNodeAtViewportCenter("location")}>Add Place</AppButton>
            <AppButton
              tone="ghost"
              onPress={() => {
                void reactFlow.fitView({ padding: 0.2, duration: 320 }).then(() => {
                  setViewportState(reactFlow.getViewport());
                });
              }}
            >
              Fit View
            </AppButton>
          </XStack>
        </XStack>
        <XStack justifyContent="space-between" alignItems="center" gap="$3" flexWrap="wrap">
          <XStack gap="$4" flexWrap="wrap">
            <Text color="$textMuted" fontFamily="$body" fontSize="$1">
              {`${nodes.length} nodes`}
            </Text>
            <Text color="$textMuted" fontFamily="$body" fontSize="$1">
              {`${edges.length} strings`}
            </Text>
            <Text color={boardInsights.warnings.length > 0 ? "#E3B36B" : "$textMuted"} fontFamily="$body" fontSize="$1">
              {boardInsights.warnings.length > 0
                ? `${boardInsights.warnings.length} timeline warning${boardInsights.warnings.length === 1 ? "" : "s"}`
                : "Timeline clear"}
            </Text>
            <Text color="$textMuted" fontFamily="$body" fontSize="$1">
              Double-click the canvas to drop a note at the cursor.
            </Text>
          </XStack>
          {selectedEdge ? (
            <XStack alignItems="center" gap="$2" flexWrap="wrap">
              <input
                value={selectedEdge.label ?? ""}
                placeholder="Selected string label"
                onClick={stopInputEvent}
                onChange={(event) => {
                  updateEdge(selectedEdge.id, {
                    label: event.target.value
                  });
                }}
                style={{
                  width: 220,
                  maxWidth: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid #3A3A3A",
                  background: "#191A1D",
                  color: "#E0E0E0",
                  outline: "none"
                }}
              />
              <AppButton
                onPress={() => {
                  deleteEdge(selectedEdge.id);
                }}
              >
                Delete String
              </AppButton>
            </XStack>
          ) : selectedNode ? (
            <XStack alignItems="center" gap="$2" flexWrap="wrap">
              <Text color="$textMuted" fontFamily="$body" fontSize="$1">
                {`Selected card: ${selectedNode.title}`}
              </Text>
              <AppButton
                onPress={() => {
                  deleteNode(selectedNode.id);
                }}
              >
                Delete Card
              </AppButton>
            </XStack>
          ) : null}
        </XStack>
        {statusMessage ? (
          <Text color="#D4C3A9" fontFamily="$body" fontSize="$1">
            {statusMessage}
          </Text>
        ) : null}
      </YStack>

      {viewMode === "board" ? (
        <div
          ref={wrapperRef}
          onDoubleClick={handleCanvasDoubleClick}
          style={{
            flex: 1,
            width: "100%",
            height: "100%",
            minHeight: 0,
            display: "flex",
            position: "relative",
            background: "#121417"
          }}
        >
          <ReactFlow<FlowNode, FlowEdge>
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={storyBoardNodeTypes}
            edgeTypes={storyBoardEdgeTypes}
            onNodesChange={applyNodeChanges}
            onEdgesChange={applyEdgeChanges}
            onConnect={handleConnect}
            onSelectionChange={handleSelectionChange}
            onMove={(_, viewport) => {
              setViewportState(viewport);
            }}
            connectionMode={ConnectionMode.Loose}
            nodesConnectable
            connectOnClick
            connectionDragThreshold={0}
            connectionRadius={28}
            connectionLineStyle={{
              stroke: STORY_STRING_STROKE,
              strokeWidth: 1.9
            }}
            deleteKeyCode={["Backspace", "Delete"]}
            multiSelectionKeyCode={["Meta", "Control"]}
            selectionOnDrag
            selectionMode={SelectionMode.Partial}
            panOnDrag
            panOnScroll
            minZoom={0.15}
            maxZoom={1.75}
            defaultEdgeOptions={{
              type: "redString"
            }}
            proOptions={{
              hideAttribution: true
            }}
          >
            <Background variant={BackgroundVariant.Lines} gap={28} color="rgba(212, 195, 169, 0.08)" />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              nodeColor={(node) => {
                const nodeId = (node.data as Partial<FlowNode["data"]> | undefined)?.nodeId;
                const storyNode = nodes.find((candidate) => candidate.id === nodeId);
                return storyNode ? getBoardNodeColor(storyNode) : "#7A7A7A";
              }}
              maskColor="rgba(15, 15, 15, 0.55)"
              style={{
                background: "#191A1D",
                border: "1px solid #3A3A3A"
              }}
            />
          </ReactFlow>
          <svg
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 5,
              overflow: "visible"
            }}
          >
            {visibleEdges.map(({ edge, path, labelX, labelY }) => {
              const isSelected = edge.id === selectedEdgeId;
              const label = edge.label?.trim() ?? "";
              const labelWidth = Math.max(56, label.length * 7 + 18);

              return (
                <g key={`overlay-${edge.id}`}>
                  <path
                    d={path}
                    stroke="transparent"
                    strokeWidth={14}
                    fill="none"
                    pointerEvents="stroke"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setSelection(null, edge.id);
                    }}
                  />
                  <path
                    d={path}
                    stroke={isSelected ? STORY_STRING_STROKE_SELECTED : STORY_STRING_STROKE}
                    strokeWidth={isSelected ? 2.5 : 1.9}
                    fill="none"
                    strokeLinecap="round"
                    pointerEvents="none"
                    style={{
                      filter: "drop-shadow(0 0 2px rgba(112, 22, 22, 0.22))"
                    }}
                  />
                  {label.length > 0 ? (
                    <g transform={`translate(${labelX}, ${labelY})`} pointerEvents="none">
                      <rect
                        x={-labelWidth / 2}
                        y={-11}
                        width={labelWidth}
                        height={22}
                        rx={11}
                        fill="rgba(15, 15, 15, 0.88)"
                        stroke="rgba(204, 0, 0, 0.32)"
                      />
                      <text
                        x={0}
                        y={0}
                        fill="#E0E0E0"
                        textAnchor="middle"
                        dominantBaseline="central"
                        style={{
                          fontSize: 11,
                          letterSpacing: 0.3,
                          fontFamily: "\"Avenir Next\", \"Segoe UI\", \"Helvetica Neue\", sans-serif"
                        }}
                      >
                        {label}
                      </text>
                    </g>
                  ) : null}
                </g>
              );
            })}
          </svg>
          {draftConnectionPath ? (
            <svg
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                zIndex: 6,
                overflow: "visible"
              }}
            >
              <path
                d={draftConnectionPath}
                stroke={STORY_STRING_STROKE}
                strokeWidth={1.9}
                fill="none"
                strokeLinecap="round"
                style={{
                  filter: "drop-shadow(0 0 2px rgba(112, 22, 22, 0.22))"
                }}
              />
            </svg>
          ) : null}
        </div>
      ) : (
        <YStack flex={1} minHeight={0} overflow="scroll" backgroundColor="#14161A" padding="$4" gap="$4">
          {boardInsights.warnings.length > 0 ? (
            <YStack
              gap="$2"
              padding="$4"
              borderRadius="$3"
              borderWidth={1}
              borderColor="#7C5A28"
              backgroundColor="#2B2117"
            >
              <SectionLabel color="#E3B36B">Soft Timeline Warnings</SectionLabel>
              {boardInsights.warnings.map((warning) => (
                <Text key={warning.id} color="#F0D5B1" fontFamily="$body" fontSize="$2">
                  {`${warning.characterTitle} appears in ${warning.locationTitles.join(", ")} at ${warning.timeLabel}. Related events: ${warning.eventTitles.join(", ")}.`}
                </Text>
              ))}
            </YStack>
          ) : null}

          <SummaryCard
            title="Events"
            caption="Event nodes carry the time label used for basic conflict detection."
          >
            {boardInsights.events.length > 0 ? (
              boardInsights.events.map((eventSummary) => (
                <YStack
                  key={eventSummary.event.id}
                  gap="$2"
                  padding="$3"
                  borderRadius="$2"
                  backgroundColor="$paperDeep"
                  borderWidth={1}
                  borderColor="$panelLine"
                >
                  <Text color="$textPrimary" fontFamily="$heading" fontSize="$3">
                    {eventSummary.event.title}
                  </Text>
                  <Text color="$textMuted" fontFamily="$body" fontSize="$1">
                    {eventSummary.event.timeLabel?.trim().length ? eventSummary.event.timeLabel : "No time assigned"}
                  </Text>
                  <Text color="$textSubtle" fontFamily="$body" fontSize="$2">
                    {eventSummary.event.text?.trim().length ? eventSummary.event.text : "No summary yet."}
                  </Text>
                  <Text color="$textMuted" fontFamily="$body" fontSize="$1">
                    {`Characters: ${eventSummary.characters.map((character) => character.title).join(", ") || "None"}`}
                  </Text>
                  <Text color="$textMuted" fontFamily="$body" fontSize="$1">
                    {`Places: ${eventSummary.locations.map((location) => location.title).join(", ") || "None"}`}
                  </Text>
                </YStack>
              ))
            ) : (
              <Text color="$textMuted" fontFamily="$body" fontSize="$2">
                No events yet.
              </Text>
            )}
          </SummaryCard>

          <XStack gap="$4" flexWrap="wrap">
            <YStack flex={1} minWidth={320}>
              <SummaryCard title="Characters" caption="Connect characters to event nodes to place them on the timeline.">
                {boardInsights.characters.length > 0 ? (
                  boardInsights.characters.map((characterSummary) => (
                    <YStack
                      key={characterSummary.node.id}
                      gap="$2"
                      padding="$3"
                      borderRadius="$2"
                      backgroundColor="$paperDeep"
                      borderWidth={1}
                      borderColor="$panelLine"
                    >
                      <Text color="$textPrimary" fontFamily="$heading" fontSize="$3">
                        {characterSummary.node.title}
                      </Text>
                      <Text color="$textMuted" fontFamily="$body" fontSize="$1">
                        {`Times: ${characterSummary.timeLabels.join(", ") || "Unplaced"}`}
                      </Text>
                      <Text color="$textMuted" fontFamily="$body" fontSize="$1">
                        {`Places: ${characterSummary.relatedLocations.map((location) => location.title).join(", ") || "Unplaced"}`}
                      </Text>
                    </YStack>
                  ))
                ) : (
                  <Text color="$textMuted" fontFamily="$body" fontSize="$2">
                    No characters yet.
                  </Text>
                )}
              </SummaryCard>
            </YStack>

            <YStack flex={1} minWidth={320}>
              <SummaryCard title="Places" caption="Location nodes become part of warnings when multiple events share the same time.">
                {boardInsights.locations.length > 0 ? (
                  boardInsights.locations.map((locationSummary) => (
                    <YStack
                      key={locationSummary.node.id}
                      gap="$2"
                      padding="$3"
                      borderRadius="$2"
                      backgroundColor="$paperDeep"
                      borderWidth={1}
                      borderColor="$panelLine"
                    >
                      <Text color="$textPrimary" fontFamily="$heading" fontSize="$3">
                        {locationSummary.node.title}
                      </Text>
                      <Text color="$textMuted" fontFamily="$body" fontSize="$1">
                        {`Times: ${locationSummary.timeLabels.join(", ") || "Unused"}`}
                      </Text>
                      <Text color="$textMuted" fontFamily="$body" fontSize="$1">
                        {`Events: ${locationSummary.relatedEvents.map((eventNode) => eventNode.title).join(", ") || "None"}`}
                      </Text>
                    </YStack>
                  ))
                ) : (
                  <Text color="$textMuted" fontFamily="$body" fontSize="$2">
                    No places yet.
                  </Text>
                )}
              </SummaryCard>
            </YStack>
          </XStack>

          <SummaryCard title="Loose Notes" caption="Unstructured notes remain available outside the timeline heuristic.">
            {boardInsights.notes.length > 0 ? (
              boardInsights.notes.map((noteNode) => (
                <YStack
                  key={noteNode.id}
                  gap="$2"
                  padding="$3"
                  borderRadius="$2"
                  backgroundColor="$paperDeep"
                  borderWidth={1}
                  borderColor="$panelLine"
                >
                  <Text color="$textPrimary" fontFamily="$heading" fontSize="$3">
                    {noteNode.title}
                  </Text>
                  <Text color="$textSubtle" fontFamily="$body" fontSize="$2">
                    {noteNode.text?.trim().length ? noteNode.text : "No note text yet."}
                  </Text>
                </YStack>
              ))
            ) : (
              <Text color="$textMuted" fontFamily="$body" fontSize="$2">
                No loose notes yet.
              </Text>
            )}
          </SummaryCard>
        </YStack>
      )}
    </YStack>
  );
}

export function StoryBoard(props: StoryBoardProps): JSX.Element {
  return (
    <ReactFlowProvider>
      <StoryBoardCanvas {...props} />
    </ReactFlowProvider>
  );
}

export default StoryBoard;
