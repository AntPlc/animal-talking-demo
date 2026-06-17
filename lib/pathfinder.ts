// BFS-based grid pathfinder used by the simulation engine to move NPCs toward their destinations.
// Hard-blocked cells (occupied by another NPC or the top row) are impassable.
// Soft-blocked cells (adjacent to a non-conversation NPC) are skipped unless ignoreSoftBlock is set.

import type { Position } from "./demo-state";

// The four cardinal movement directions — no diagonal movement.
const CARDINAL_DELTAS: readonly Position[] = [
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
];

// Encodes a Position as a "x,y" string key for use in Sets and Maps.
function positionKey(position: Position): string {
  return `${position.x},${position.y}`;
}

// Returns true if both positions refer to the same grid cell.
function positionsEqual(first: Position, second: Position): boolean {
  return first.x === second.x && first.y === second.y;
}

// Returns true if the position falls within the playable grid area.
function isInBounds(position: Position, gridWidth: number, gridHeight: number): boolean {
  return position.x >= 0 && position.x < gridWidth && position.y >= 0 && position.y < gridHeight;
}

// Returns true if an NPC may step onto the given position.
// The goal cell itself is always walkable even if occupied (the NPC stops adjacent to it).
// Soft blocks are only enforced when ignoreSoftBlock is false.
function canWalkTo(
  position: Position,
  goal: Position,
  gridWidth: number,
  gridHeight: number,
  occupied: Set<string>,
  softBlocked: Set<string>,
  ignoreSoftBlock: boolean,
): boolean {
  if (!isInBounds(position, gridWidth, gridHeight)) {
    return false;
  }

  const key = positionKey(position);
  const isGoal = positionsEqual(position, goal);

  if (occupied.has(key) && !isGoal) {
    return false;
  }

  if (!ignoreSoftBlock && softBlocked.has(key) && !isGoal) {
    return false;
  }

  return true;
}

// Breadth-first search from start to goal.
// Returns the full path (start → goal) as an ordered list of positions,
// or an empty array if no route exists. The cameFrom map is used to reconstruct
// the path by walking backwards from the goal.
function bfs(
  start: Position,
  goal: Position,
  gridWidth: number,
  gridHeight: number,
  occupied: Set<string>,
  softBlocked: Set<string>,
  ignoreSoftBlock: boolean,
): Position[] {
  const startKey = positionKey(start);
  const goalKey = positionKey(goal);

  if (startKey === goalKey) {
    return [start];
  }

  if (!canWalkTo(goal, goal, gridWidth, gridHeight, occupied, softBlocked, ignoreSoftBlock)) {
    return [];
  }

  const queue: Position[] = [start];
  // Maps each visited cell key to the key of the cell it was reached from.
  const cameFrom = new Map<string, string | null>([[startKey, null]]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentKey = positionKey(current);

    if (currentKey === goalKey) {
      break;
    }

    for (const delta of CARDINAL_DELTAS) {
      const next = { x: current.x + delta.x, y: current.y + delta.y };
      const nextKey = positionKey(next);

      if (cameFrom.has(nextKey)) {
        continue;
      }

      if (!canWalkTo(next, goal, gridWidth, gridHeight, occupied, softBlocked, ignoreSoftBlock)) {
        continue;
      }

      cameFrom.set(nextKey, currentKey);
      queue.push(next);
    }
  }

  if (!cameFrom.has(goalKey)) {
    return [];
  }

  // Reconstruct path by walking the cameFrom chain backwards from goal to start.
  const path: Position[] = [];
  let cursor: string | null = goalKey;

  while (cursor) {
    const [x, y] = cursor.split(",").map(Number);
    path.unshift({ x, y });
    cursor = cameFrom.get(cursor) ?? null;
  }

  return path;
}

// Entry point for pathfinding. Tries to reach the goal cell directly first.
// If the goal is occupied (another NPC standing there), looks for the shortest
// path to any of the four adjacent cells instead, so the approaching NPC stops
// one step away — ready to trigger a conversation.
export function findPathToGoal(
  start: Position,
  goal: Position,
  gridWidth: number,
  gridHeight: number,
  occupied: Set<string>,
  softBlocked: Set<string>,
  ignoreSoftBlock: boolean,
): Position[] {
  const goalOccupied = occupied.has(positionKey(goal));

  if (!goalOccupied) {
    const directPath = bfs(start, goal, gridWidth, gridHeight, occupied, softBlocked, ignoreSoftBlock);
    if (directPath.length > 0) {
      return directPath;
    }
  }

  // Goal is occupied — find the nearest free adjacent cell.
  let bestPath: Position[] = [];

  for (const delta of CARDINAL_DELTAS) {
    const adjacent = { x: goal.x + delta.x, y: goal.y + delta.y };
    const path = bfs(start, adjacent, gridWidth, gridHeight, occupied, softBlocked, ignoreSoftBlock);

    if (path.length > 1 && (bestPath.length === 0 || path.length < bestPath.length)) {
      bestPath = path;
    }
  }

  return bestPath;
}

// Returns the second cell in the path — the immediate next step the NPC should take.
// Returns null if the path is empty or contains only the current position.
export function nextPathStep(path: Position[]): Position | null {
  return path.length > 1 ? path[1] : null;
}
