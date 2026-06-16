import type { Position } from "./demo-state";

const CARDINAL_DELTAS: readonly Position[] = [
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
];

function positionKey(position: Position): string {
  return `${position.x},${position.y}`;
}

function positionsEqual(first: Position, second: Position): boolean {
  return first.x === second.x && first.y === second.y;
}

function isInBounds(position: Position, gridWidth: number, gridHeight: number): boolean {
  return position.x >= 0 && position.x < gridWidth && position.y >= 0 && position.y < gridHeight;
}

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

  const path: Position[] = [];
  let cursor: string | null = goalKey;

  while (cursor) {
    const [x, y] = cursor.split(",").map(Number);
    path.unshift({ x, y });
    cursor = cameFrom.get(cursor) ?? null;
  }

  return path;
}

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

export function nextPathStep(path: Position[]): Position | null {
  return path.length > 1 ? path[1] : null;
}
