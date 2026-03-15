import type { XYPosition } from "@xyflow/react";

export type StoryNodeType = "event" | "character" | "location" | "note";
export type StoryConnectorHandle = "left" | "right" | "top" | "bottom";

export const STORY_BOARD_NODE_WIDTH = 220;
export const STORY_BOARD_NODE_HEIGHT = 224;
export const STORY_CONNECTOR_SIZE = 10;
export const STORY_CONNECTOR_CENTER_OFFSETS: Readonly<Record<StoryConnectorHandle, XYPosition>> = {
  left: { x: -6, y: STORY_BOARD_NODE_HEIGHT / 2 },
  right: { x: STORY_BOARD_NODE_WIDTH + 6, y: STORY_BOARD_NODE_HEIGHT / 2 },
  top: { x: STORY_BOARD_NODE_WIDTH / 2, y: -6 },
  bottom: { x: STORY_BOARD_NODE_WIDTH / 2, y: STORY_BOARD_NODE_HEIGHT + 6 }
};

export interface StoryNode {
  id: string;
  type: StoryNodeType;
  title: string;
  text?: string;
  position: XYPosition;
  color?: string;
  linkedSceneId?: string;
  timeLabel?: string;
}

export interface StoryEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  sourceHandle?: StoryConnectorHandle;
  targetHandle?: StoryConnectorHandle;
}

export interface StoryBoardState {
  nodes: StoryNode[];
  edges: StoryEdge[];
}

export interface StoryBoardSceneOption {
  id: string;
  title: string;
}

export interface StoryEventSummary {
  event: StoryNode;
  characters: StoryNode[];
  locations: StoryNode[];
}

export interface StoryEntitySummary {
  node: StoryNode;
  relatedEvents: StoryNode[];
  relatedLocations: StoryNode[];
  timeLabels: string[];
}

export interface StoryTimelineWarning {
  id: string;
  characterId: string;
  characterTitle: string;
  timeLabel: string;
  locationTitles: string[];
  eventTitles: string[];
}

export interface StoryBoardInsights {
  events: StoryEventSummary[];
  characters: StoryEntitySummary[];
  locations: StoryEntitySummary[];
  notes: StoryNode[];
  warnings: StoryTimelineWarning[];
}

export const STORY_NODE_TYPE_LABELS: Readonly<Record<StoryNodeType, string>> = {
  event: "Event",
  character: "Character",
  location: "Location",
  note: "Note"
};

export const STORY_NODE_TYPE_COLORS: Readonly<Record<StoryNodeType, string>> = {
  event: "#D4C36A",
  character: "#6E99D4",
  location: "#6AA47A",
  note: "#7A7A7A"
};

const EMPTY_BOARD_STATE: StoryBoardState = {
  nodes: [],
  edges: []
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function normalizeStoryConnectorHandle(
  value: unknown,
  fallback?: StoryConnectorHandle
): StoryConnectorHandle | undefined {
  if (value === "left" || value === "right" || value === "top" || value === "bottom") {
    return value;
  }

  if (value === "out") {
    return "right";
  }

  if (value === "in") {
    return "left";
  }

  return fallback;
}

function normalizeNodeType(value: unknown): StoryNodeType {
  return value === "event" || value === "character" || value === "location" ? value : "note";
}

function normalizePosition(value: unknown): XYPosition {
  if (!isRecord(value)) {
    return { x: 0, y: 0 };
  }

  const x = typeof value.x === "number" && Number.isFinite(value.x) ? value.x : 0;
  const y = typeof value.y === "number" && Number.isFinite(value.y) ? value.y : 0;
  return { x, y };
}

function sanitizeStoryNode(value: unknown): StoryNode | null {
  if (!isRecord(value) || typeof value.id !== "string") {
    return null;
  }

  const title = normalizeString(value.title) ?? "Untitled";
  const text = normalizeString(value.text);
  const color = normalizeString(value.color);
  const linkedSceneId = normalizeString(value.linkedSceneId);
  const timeLabel = normalizeString(value.timeLabel);

  return {
    id: value.id,
    type: normalizeNodeType(value.type),
    title,
    text,
    position: normalizePosition(value.position),
    color,
    linkedSceneId,
    timeLabel
  };
}

function sanitizeStoryEdge(value: unknown): StoryEdge | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.source !== "string" ||
    typeof value.target !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    source: value.source,
    target: value.target,
    label: normalizeString(value.label),
    sourceHandle: normalizeStoryConnectorHandle(value.sourceHandle, "right"),
    targetHandle: normalizeStoryConnectorHandle(value.targetHandle, "left")
  };
}

function getConnectedNodes(eventNode: StoryNode, nodeMap: Map<string, StoryNode>, edges: StoryEdge[]): StoryNode[] {
  return edges
    .filter((edge) => edge.source === eventNode.id || edge.target === eventNode.id)
    .map((edge) => nodeMap.get(edge.source === eventNode.id ? edge.target : edge.source) ?? null)
    .filter((node): node is StoryNode => node !== null);
}

function getNodeTimeLabel(node: StoryNode): string {
  return node.timeLabel?.trim() ?? "";
}

export function createEmptyBoardState(): StoryBoardState {
  return {
    nodes: [],
    edges: []
  };
}

export function createEntityId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createStoryNode(nodeType: StoryNodeType, position: XYPosition): StoryNode {
  return {
    id: createEntityId("node"),
    type: nodeType,
    title: STORY_NODE_TYPE_LABELS[nodeType],
    text: "",
    position,
    color: STORY_NODE_TYPE_COLORS[nodeType],
    timeLabel: nodeType === "event" ? "Unknown time" : undefined
  };
}

export function parseBoardState(rawContent: string | null | undefined): StoryBoardState {
  if (!rawContent) {
    return createEmptyBoardState();
  }

  try {
    const parsed = JSON.parse(rawContent);
    if (!isRecord(parsed)) {
      return createEmptyBoardState();
    }

    const nodes = Array.isArray(parsed.nodes)
      ? parsed.nodes.map(sanitizeStoryNode).filter((node): node is StoryNode => node !== null)
      : [];
    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges = Array.isArray(parsed.edges)
      ? parsed.edges
          .map(sanitizeStoryEdge)
          .filter((edge): edge is StoryEdge => edge !== null && nodeIds.has(edge.source) && nodeIds.has(edge.target))
      : [];

    return {
      nodes,
      edges
    };
  } catch {
    return createEmptyBoardState();
  }
}

export function serializeBoardState(state: StoryBoardState): string {
  return `${JSON.stringify(state, null, 2)}\n`;
}

export function buildBoardInsights(state: StoryBoardState): StoryBoardInsights {
  const nodeMap = new Map(state.nodes.map((node) => [node.id, node]));
  const eventNodes = state.nodes.filter((node) => node.type === "event");
  const characterNodes = state.nodes.filter((node) => node.type === "character");
  const locationNodes = state.nodes.filter((node) => node.type === "location");
  const notes = state.nodes.filter((node) => node.type === "note");

  const events = eventNodes.map((eventNode) => {
    const connectedNodes = getConnectedNodes(eventNode, nodeMap, state.edges);

    return {
      event: eventNode,
      characters: connectedNodes.filter((node) => node.type === "character"),
      locations: connectedNodes.filter((node) => node.type === "location")
    };
  });

  const characters = characterNodes.map((characterNode) => {
    const relatedEvents = events.filter((eventSummary) =>
      eventSummary.characters.some((relatedCharacter) => relatedCharacter.id === characterNode.id)
    );
    const relatedLocations = relatedEvents.flatMap((eventSummary) => eventSummary.locations);
    const uniqueLocationMap = new Map(relatedLocations.map((location) => [location.id, location]));
    const timeLabels = relatedEvents
      .map((eventSummary) => getNodeTimeLabel(eventSummary.event))
      .filter((timeLabel, index, values) => timeLabel.length > 0 && values.indexOf(timeLabel) === index);

    return {
      node: characterNode,
      relatedEvents: relatedEvents.map((eventSummary) => eventSummary.event),
      relatedLocations: [...uniqueLocationMap.values()],
      timeLabels
    };
  });

  const locations = locationNodes.map((locationNode) => {
    const relatedEvents = events.filter((eventSummary) =>
      eventSummary.locations.some((relatedLocation) => relatedLocation.id === locationNode.id)
    );
    const relatedCharacters = relatedEvents.flatMap((eventSummary) => eventSummary.characters);
    const uniqueCharacterMap = new Map(relatedCharacters.map((character) => [character.id, character]));
    const timeLabels = relatedEvents
      .map((eventSummary) => getNodeTimeLabel(eventSummary.event))
      .filter((timeLabel, index, values) => timeLabel.length > 0 && values.indexOf(timeLabel) === index);

    return {
      node: locationNode,
      relatedEvents: relatedEvents.map((eventSummary) => eventSummary.event),
      relatedLocations: [...uniqueCharacterMap.values()],
      timeLabels
    };
  });

  const warnings: StoryTimelineWarning[] = [];

  characterNodes.forEach((characterNode) => {
    const relatedEvents = events.filter((eventSummary) =>
      eventSummary.characters.some((relatedCharacter) => relatedCharacter.id === characterNode.id)
    );
    const eventsByTime = new Map<string, StoryEventSummary[]>();

    relatedEvents.forEach((eventSummary) => {
      const timeLabel = getNodeTimeLabel(eventSummary.event);
      if (timeLabel.length === 0) {
        return;
      }

      const currentEvents = eventsByTime.get(timeLabel) ?? [];
      currentEvents.push(eventSummary);
      eventsByTime.set(timeLabel, currentEvents);
    });

    eventsByTime.forEach((eventSummaries, timeLabel) => {
      if (eventSummaries.length < 2) {
        return;
      }

      const locationTitles = eventSummaries
        .flatMap((eventSummary) => eventSummary.locations)
        .map((location) => location.title.trim())
        .filter((locationTitle) => locationTitle.length > 0);
      const uniqueLocationTitles = [...new Set(locationTitles)];

      if (uniqueLocationTitles.length < 2) {
        return;
      }

      warnings.push({
        id: `${characterNode.id}:${timeLabel}`,
        characterId: characterNode.id,
        characterTitle: characterNode.title,
        timeLabel,
        locationTitles: uniqueLocationTitles,
        eventTitles: eventSummaries.map((eventSummary) => eventSummary.event.title)
      });
    });
  });

  return {
    events,
    characters,
    locations,
    notes,
    warnings
  };
}

export function getBoardNodeColor(node: StoryNode): string {
  return node.color ?? STORY_NODE_TYPE_COLORS[node.type] ?? STORY_NODE_TYPE_COLORS.note;
}

export function isEmptyBoardState(state: StoryBoardState): boolean {
  return state.nodes.length === EMPTY_BOARD_STATE.nodes.length && state.edges.length === EMPTY_BOARD_STATE.edges.length;
}
