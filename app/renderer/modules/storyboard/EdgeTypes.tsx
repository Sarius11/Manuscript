import { BaseEdge, EdgeLabelRenderer, getBezierPath, Position, type EdgeProps } from "@xyflow/react";
import { useBoardStore } from "./useBoardStore";

const BOARD_NODE_WIDTH = 220;
const BOARD_SOURCE_CONNECTOR_X = BOARD_NODE_WIDTH;
const BOARD_TARGET_CONNECTOR_X = 0;
const BOARD_CONNECTOR_CENTER_Y = 100;
const STORY_STRING_STROKE = "#A12E2E";

export function RedStringEdge({
  id,
  source,
  sourceX,
  sourceY,
  target,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label
}: EdgeProps): JSX.Element {
  const nodesById = useBoardStore((state) => state.nodes);
  const sourceNode = nodesById.find((node) => node.id === source) ?? null;
  const targetNode = nodesById.find((node) => node.id === target) ?? null;
  const resolvedSourceX = sourceNode ? sourceNode.position.x + BOARD_SOURCE_CONNECTOR_X : sourceX;
  const resolvedSourceY = sourceNode ? sourceNode.position.y + BOARD_CONNECTOR_CENTER_Y : sourceY;
  const resolvedTargetX = targetNode ? targetNode.position.x + BOARD_TARGET_CONNECTOR_X : targetX;
  const resolvedTargetY = targetNode ? targetNode.position.y + BOARD_CONNECTOR_CENTER_Y : targetY;
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: resolvedSourceX,
    sourceY: resolvedSourceY,
    sourcePosition: sourcePosition ?? Position.Right,
    targetX: resolvedTargetX,
    targetY: resolvedTargetY,
    targetPosition: targetPosition ?? Position.Left
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        interactionWidth={24}
        style={{
          stroke: STORY_STRING_STROKE,
          strokeWidth: 1.9,
          strokeLinecap: "round",
          filter: "drop-shadow(0 0 2px rgba(112, 22, 22, 0.22))"
        }}
      />
      {typeof label === "string" && label.trim().length > 0 ? (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "none",
              background: "rgba(15, 15, 15, 0.88)",
              color: "#E0E0E0",
              border: "1px solid rgba(204, 0, 0, 0.32)",
              borderRadius: 999,
              padding: "3px 8px",
              fontSize: 11,
              letterSpacing: 0.3,
              whiteSpace: "nowrap"
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

export const storyBoardEdgeTypes = {
  redString: RedStringEdge
};

export default RedStringEdge;
