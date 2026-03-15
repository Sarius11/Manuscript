import type { CSSProperties, MouseEvent } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { StoryBoardSceneOption, StoryConnectorHandle, StoryNode } from "./boardTypes";
import {
  STORY_BOARD_NODE_HEIGHT,
  STORY_BOARD_NODE_WIDTH,
  STORY_CONNECTOR_CENTER_OFFSETS,
  STORY_CONNECTOR_SIZE,
  STORY_NODE_TYPE_LABELS,
  getBoardNodeColor
} from "./boardTypes";
import { useBoardStore } from "./useBoardStore";

export interface PostItNodeData extends Record<string, unknown> {
  nodeId: string;
  sceneOptions: StoryBoardSceneOption[];
  onOpenScene: (sceneId: string) => void;
  onConnectionStart: (nodeId: string, handle: StoryConnectorHandle) => void;
  onConnectionComplete: (nodeId: string, handle: StoryConnectorHandle) => void;
  isConnecting: boolean;
  activeConnectionHandle: StoryConnectorHandle | null;
}

export type PostItFlowNode = Node<PostItNodeData, "postIt">;

const connectorHandles: StoryConnectorHandle[] = ["left", "right", "top", "bottom"];

const handleStyle: CSSProperties = {
  width: STORY_CONNECTOR_SIZE,
  height: STORY_CONNECTOR_SIZE,
  borderRadius: "999px",
  border: "1px solid rgba(92, 11, 11, 0.62)",
  background: "rgba(142, 31, 31, 0.9)",
  boxShadow: "0 0 0 3px rgba(247, 226, 140, 0.82)"
};

const inputStyle: CSSProperties = {
  width: "100%",
  border: "none",
  background: "transparent",
  color: "#141414",
  outline: "none",
  fontFamily: "\"Avenir Next\", \"Segoe UI\", \"Helvetica Neue\", sans-serif"
};

function stopNodeEvent(event: MouseEvent<HTMLElement>): void {
  event.stopPropagation();
}

function getHandlePosition(handle: StoryConnectorHandle): Position {
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

export function PostItNode({ data, selected }: NodeProps<PostItFlowNode>): JSX.Element {
  const { nodeId, sceneOptions, onOpenScene, onConnectionStart, onConnectionComplete, isConnecting, activeConnectionHandle } =
    data;
  const node = useBoardStore((state) => state.nodes.find((candidate) => candidate.id === nodeId) ?? null);
  const onChange = useBoardStore((state) => state.updateNode);
  const deleteNode = useBoardStore((state) => state.deleteNode);

  if (!node) {
    return (
      <div
        style={{
          width: STORY_BOARD_NODE_WIDTH,
          minHeight: 96,
          borderRadius: 10,
          border: "1px solid #A33A3A",
          background: "#341919",
          color: "#F0D5D5",
          padding: 12,
          boxShadow: "0 12px 24px rgba(0, 0, 0, 0.26)"
        }}
      >
        {`Node missing: ${nodeId}`}
      </div>
    );
  }

  const headerColor = getBoardNodeColor(node);
  const linkedSceneTitle = sceneOptions.find((scene) => scene.id === node.linkedSceneId)?.title ?? null;

  return (
    <div
      onClick={() => {
        if (node.linkedSceneId) {
          onOpenScene(node.linkedSceneId);
        }
      }}
      style={{
        width: STORY_BOARD_NODE_WIDTH,
        minHeight: STORY_BOARD_NODE_HEIGHT,
        position: "relative",
        overflow: "visible"
      }}
    >
      {connectorHandles.map((handle) => {
        const connectorCenter = STORY_CONNECTOR_CENTER_OFFSETS[handle];

        return (
          <Handle
            key={`target:${handle}`}
            id={`target:${handle}`}
            type="target"
            position={getHandlePosition(handle)}
            isConnectable
            style={{
              ...handleStyle,
              top: connectorCenter.y - STORY_CONNECTOR_SIZE / 2,
              left: connectorCenter.x - STORY_CONNECTOR_SIZE / 2,
              zIndex: 2,
              opacity: 0,
              pointerEvents: "none"
            }}
          />
        );
      })}
      {connectorHandles.map((handle) => {
        const connectorCenter = STORY_CONNECTOR_CENTER_OFFSETS[handle];

        return (
          <Handle
            key={`source:${handle}`}
            id={`source:${handle}`}
            type="source"
            position={getHandlePosition(handle)}
            isConnectable
            style={{
              ...handleStyle,
              top: connectorCenter.y - STORY_CONNECTOR_SIZE / 2,
              left: connectorCenter.x - STORY_CONNECTOR_SIZE / 2,
              zIndex: 2,
              opacity: 0,
              pointerEvents: "none"
            }}
          />
        );
      })}
      {connectorHandles.map((handle) => {
        const connectorCenter = STORY_CONNECTOR_CENTER_OFFSETS[handle];
        const isActiveHandle = isConnecting && activeConnectionHandle === handle;

        return (
          <button
            key={`button:${handle}`}
            type="button"
            className="nodrag"
            aria-label={`Connect from ${handle}`}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onConnectionStart(node.id, handle);
            }}
            onPointerUp={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onConnectionComplete(node.id, handle);
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onConnectionComplete(node.id, handle);
            }}
            style={{
              position: "absolute",
              left: connectorCenter.x - STORY_CONNECTOR_SIZE / 2,
              top: connectorCenter.y - STORY_CONNECTOR_SIZE / 2,
              width: STORY_CONNECTOR_SIZE,
              height: STORY_CONNECTOR_SIZE,
              borderRadius: "999px",
              border: isActiveHandle
                ? "1px solid rgba(212, 195, 169, 0.92)"
                : "1px solid rgba(212, 195, 169, 0.54)",
              background: isActiveHandle ? "#8A1F1F" : "#17191D",
              boxShadow: isActiveHandle
                ? "0 0 0 2px rgba(212, 195, 169, 0.24)"
                : "0 0 0 1px rgba(12, 13, 15, 0.34)",
              cursor: "crosshair",
              zIndex: 4,
              padding: 0
            }}
          />
        );
      })}
      <div
        style={{
          minHeight: STORY_BOARD_NODE_HEIGHT,
          display: "flex",
          flexDirection: "column",
          borderRadius: 10,
          overflow: "hidden",
          background: "#F7E28C",
          border: selected ? "1px solid #D4C3A9" : "1px solid rgba(24,24,24,0.35)",
          boxShadow: selected
            ? "0 18px 30px rgba(0, 0, 0, 0.34), 0 0 0 1px rgba(212, 195, 169, 0.22)"
            : "0 12px 24px rgba(0, 0, 0, 0.26)"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            background: headerColor,
            borderBottom: "1px solid rgba(24,24,24,0.15)"
          }}
        >
          <select
            className="nodrag nowheel"
            value={node.type}
            onClick={stopNodeEvent}
            onChange={(event) => {
              onChange(node.id, {
                type: event.target.value as StoryNode["type"],
                color: undefined,
                timeLabel: event.target.value === "event" ? node.timeLabel ?? "Unknown time" : undefined
              });
            }}
            style={{
              flex: 1,
              minWidth: 0,
              border: "none",
              background: "rgba(15, 15, 15, 0.14)",
              color: "#141414",
              borderRadius: 6,
              padding: "4px 8px",
              outline: "none",
              fontWeight: 700
            }}
          >
            {Object.entries(STORY_NODE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="nodrag"
            aria-label="Delete card"
            onClick={(event) => {
              stopNodeEvent(event);
              deleteNode(node.id);
            }}
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              border: "1px solid rgba(24, 24, 24, 0.16)",
              background: "rgba(20, 20, 20, 0.1)",
              color: "#4E3B2E",
              cursor: "pointer",
              fontSize: 15,
              lineHeight: 1,
              padding: 0,
              flexShrink: 0
            }}
          >
            ×
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10 }}>
          <input
            className="nodrag"
            value={node.title}
            placeholder="Title"
            onClick={stopNodeEvent}
            onChange={(event) => {
              onChange(node.id, {
                title: event.target.value
              });
            }}
            style={{
              ...inputStyle,
              fontSize: 16,
              fontWeight: 700
            }}
          />
          {node.type === "event" ? (
            <input
              className="nodrag"
              value={node.timeLabel ?? ""}
              placeholder="Time"
              onClick={stopNodeEvent}
              onChange={(event) => {
                onChange(node.id, {
                  timeLabel: event.target.value
                });
              }}
              style={{
                ...inputStyle,
                fontSize: 12,
                fontWeight: 600,
                color: "#4E3B2E",
                textTransform: "uppercase",
                letterSpacing: 1.2
              }}
            />
          ) : null}
          <textarea
            className="nodrag nowheel"
            value={node.text ?? ""}
            placeholder="Add context, motive, clue, or reference..."
            onClick={stopNodeEvent}
            onChange={(event) => {
              onChange(node.id, {
                text: event.target.value
              });
            }}
            style={{
              ...inputStyle,
              resize: "none",
              minHeight: 72,
              lineHeight: 1.5
            }}
          />
          {sceneOptions.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <select
                className="nodrag nowheel"
                value={node.linkedSceneId ?? ""}
                onClick={stopNodeEvent}
                onChange={(event) => {
                  const nextValue = event.target.value.trim();
                  onChange(node.id, {
                    linkedSceneId: nextValue.length > 0 ? nextValue : undefined
                  });
                }}
                style={{
                  width: "100%",
                  border: "1px solid rgba(20, 20, 20, 0.15)",
                  background: "rgba(255,255,255,0.24)",
                  color: "#141414",
                  borderRadius: 6,
                  padding: "6px 8px",
                  outline: "none"
                }}
              >
                <option value="">No scene link</option>
                {sceneOptions.map((scene) => (
                  <option key={scene.id} value={scene.id}>
                    {scene.title}
                  </option>
                ))}
              </select>
              {linkedSceneTitle ? (
                <button
                  type="button"
                  className="nodrag"
                  onClick={(event) => {
                    stopNodeEvent(event);
                    if (node.linkedSceneId) {
                      onOpenScene(node.linkedSceneId);
                    }
                  }}
                  style={{
                    border: "none",
                    borderRadius: 6,
                    background: "rgba(20, 20, 20, 0.12)",
                    color: "#141414",
                    padding: "6px 8px",
                    textAlign: "left",
                    fontSize: 12,
                    cursor: "pointer"
                  }}
                >
                  {`Linked scene: ${linkedSceneTitle}`}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default PostItNode;
