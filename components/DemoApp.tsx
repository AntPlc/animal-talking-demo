// Client shell for the Animal Talking demo views.

"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./DemoApp.module.css";
import {
  advanceDemoState,
  createInitialDemoState,
  createScriptedInteraction,
  findPlayerInteractionCandidate,
  findInteractionCandidate,
  finishInteraction,
  finishPlayerInteraction,
  formatObjective,
  formatRelationship,
  formatWeather,
  formatWorldTime,
  getGridHeight,
  getGridWidth,
  getNpcById,
  getZoneForPosition,
  hydrateNpcProfile,
  movePlayer,
  startPlayerInteraction,
  startInteraction,
  type ConversationRecord,
  type DemoState,
  type DemoView,
  type InteractionCandidate,
  type NpcProfile,
  type NpcState,
  type PlayerInteractionCandidate,
  type PlayerState,
} from "@/lib/demo-state";

const STORAGE_KEY = "animal-talking-demo-state-v2";
const STORAGE_VERSION = 2;
const TICK_INTERVAL_MS = 1800;
const GENERATION_DELAY_MS = 1100;

type ViewLabel = {
  title: string;
  description: string;
};

const VIEW_LABELS: Record<DemoView, ViewLabel> = {
  simulation: {
    title: "Simulation view",
    description: "Grid, NPC movement, world clock, weather, and live interactions.",
  },
  history: {
    title: "Conversation history",
    description: "All generated exchanges, structured turns, and extracted updates.",
  },
  database: {
    title: "NPC database",
    description: "Runtime state for every hardcoded character in the demo.",
  },
};

export function DemoApp({ view }: Readonly<{ view: DemoView }>) {
  const [state, setState] = useState<DemoState>(() => initializeDemoState());
  const [pendingCandidate, setPendingCandidate] = useState<InteractionCandidate | null>(null);
  const [pendingPlayerCandidate, setPendingPlayerCandidate] = useState<PlayerInteractionCandidate | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    writeSavedState(state);
  }, [state]);

  useEffect(() => {
    if (view !== "simulation") {
      return;
    }

    const intervalId = window.setInterval(() => {
      setState((current) => advanceDemoState(current));
    }, TICK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [view]);

  useEffect(() => {
    if (view !== "simulation") {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (state.activeConversationId || pendingCandidate || pendingPlayerCandidate) {
        return;
      }

      const direction = keyToDirection(event.key);

      if (!direction) {
        if (event.key.toLowerCase() === "e") {
          event.preventDefault();
          const candidate = findPlayerInteractionCandidate(state);
          if (candidate && timerRef.current === null) {
            setPendingPlayerCandidate(candidate);
            setState((current) => startPlayerInteraction(current, candidate));
            timerRef.current = window.setTimeout(() => {
              setState((current) => finishPlayerInteraction(current, candidate));
              setPendingPlayerCandidate(null);
              timerRef.current = null;
            }, GENERATION_DELAY_MS);
          }
        }
        return;
      }

      event.preventDefault();
      setState((current) => movePlayer(current, direction));
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [pendingCandidate, pendingPlayerCandidate, state, view]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const activeConversation = useMemo(() => {
    if (!state.activeConversationId) {
      return state.conversations[0] ?? null;
    }

    return state.conversations.find((conversation) => conversation.id === state.activeConversationId) ?? null;
  }, [state.activeConversationId, state.conversations]);

  const recentConversations = useMemo(() => state.conversations.slice(0, 6), [state.conversations]);
  const movingCount = state.npcs.filter((npc) => npc.runtime.status === "moving").length;
  const nearbyCandidate = useMemo(() => findPlayerInteractionCandidate(state), [state]);
  const nearbyNpc = nearbyCandidate ? getNpcById(state, nearbyCandidate.npcId) ?? null : null;

  function beginConversation(candidate: InteractionCandidate) {
    if (timerRef.current !== null) {
      return;
    }

    setPendingCandidate(candidate);
    setState((current) => startInteraction(current, candidate));

    timerRef.current = window.setTimeout(() => {
      setState((current) => finishInteraction(current, candidate));
      setPendingCandidate(null);
      timerRef.current = null;
    }, GENERATION_DELAY_MS);
  }

  function beginPlayerConversation(candidate: PlayerInteractionCandidate) {
    if (timerRef.current !== null) {
      return;
    }

    setPendingPlayerCandidate(candidate);
    setState((current) => startPlayerInteraction(current, candidate));

    timerRef.current = window.setTimeout(() => {
      setState((current) => finishPlayerInteraction(current, candidate));
      setPendingPlayerCandidate(null);
      timerRef.current = null;
    }, GENERATION_DELAY_MS);
  }

  function stepOnce() {
    setState((current) => {
      const next = advanceDemoState(current);

      if (!next.activeConversationId && !pendingCandidate) {
        const candidate = findInteractionCandidate(next);

        if (candidate) {
          beginConversation(candidate);
        }
      }

      return next;
    });
  }

  function resetDemo() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setPendingCandidate(null);
    setState(createInitialDemoState());
  }

  function movePlayerWithButton(direction: "up" | "down" | "left" | "right") {
    setState((current) => movePlayer(current, direction));
  }

  function talkToNearbyNpc() {
    if (pendingCandidate || pendingPlayerCandidate || state.activeConversationId) {
      return;
    }

    const candidate = findPlayerInteractionCandidate(state);

    if (!candidate) {
      return;
    }

    beginPlayerConversation(candidate);
  }

  function scriptedConversation() {
    if (state.activeConversationId || pendingCandidate) {
      return;
    }

    const candidate = createScriptedInteraction(state, "SCRIPTED_EVENT");

    if (!candidate) {
      return;
    }

    beginConversation(candidate);
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Animal Talking demo</p>
          <h1>{VIEW_LABELS[view].title}</h1>
          <p className={styles.subtitle}>{VIEW_LABELS[view].description}</p>
        </div>

        <nav className={styles.nav} aria-label="Demo routes">
          <Link className={view === "simulation" ? styles.navActive : styles.navLink} href="/">
            Simulation
          </Link>
          <Link className={view === "history" ? styles.navActive : styles.navLink} href="/history">
            History
          </Link>
          <Link className={view === "database" ? styles.navActive : styles.navLink} href="/database">
            Database
          </Link>
        </nav>
      </header>

      <section className={styles.topRow} aria-label="World summary">
        <SummaryCard label="World time" value={formatWorldTime(state.worldTime)} />
        <SummaryCard label="Weather" value={formatWeather(state.weather)} />
        <SummaryCard label="NPCs moving" value={String(movingCount)} />
        <SummaryCard
          label="Active conversation"
          value={activeConversation ? activeConversation.summary : "None"}
        />
      </section>

      {view === "simulation" && renderSimulationView()}
      {view === "history" && renderHistoryView()}
      {view === "database" && renderDatabaseView()}
    </div>
  );

  function renderSimulationView() {
    return (
      <div className={styles.layout}>
        <section className={styles.boardPanel} aria-label="Game world">
          <div className={styles.panelHeader}>
            <div>
              <h2>2D grid</h2>
              <p>Move with arrows/WASD then press E (or Talk) near an NPC to create an exchange.</p>
            </div>

            <div className={styles.controls}>
              <button className={styles.button} type="button" onClick={() => movePlayerWithButton("up")}>
                Up
              </button>
              <button className={styles.button} type="button" onClick={() => movePlayerWithButton("left")}>
                Left
              </button>
              <button className={styles.button} type="button" onClick={() => movePlayerWithButton("down")}>
                Down
              </button>
              <button className={styles.button} type="button" onClick={() => movePlayerWithButton("right")}>
                Right
              </button>
              <button
                className={styles.button}
                type="button"
                onClick={talkToNearbyNpc}
                disabled={!nearbyNpc || !!state.activeConversationId}
              >
                {nearbyNpc ? `Talk to ${nearbyNpc.profile.name}` : "Talk"}
              </button>
              <button className={styles.button} type="button" onClick={stepOnce}>
                Step once
              </button>
              <button className={styles.button} type="button" onClick={scriptedConversation}>
                Scripted interaction
              </button>
              <button className={styles.buttonSecondary} type="button" onClick={resetDemo}>
                Reset
              </button>
            </div>
          </div>

          <div className={styles.gridShell}>
            <div
              className={styles.grid}
              style={{
                gridTemplateColumns: `repeat(${getGridWidth()}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${getGridHeight()}, minmax(0, 1fr))`,
              }}
            >
              {state.zones.map((zone) => (
                <div
                  key={zone.id}
                  className={styles.zone}
                  style={{
                    gridColumn: `${zone.topLeft.x + 1} / ${zone.bottomRight.x + 2}`,
                    gridRow: `${zone.topLeft.y + 1} / ${zone.bottomRight.y + 2}`,
                  }}
                >
                  <span>{zone.name}</span>
                </div>
              ))}

              {Array.from({ length: getGridWidth() * getGridHeight() }, (_, index) => {
                const x = index % getGridWidth();
                const y = Math.floor(index / getGridWidth());
                return <div key={`${x}-${y}`} className={styles.cell} />;
              })}
            </div>

            <div className={styles.tokensLayer} aria-hidden="true">
              <PlayerToken player={state.player} />
              {state.npcs.map((npc) => {
                const active = activeConversation?.participantIds.includes(npc.profile.id) ?? false;
                return (
                  <NpcToken
                    key={npc.profile.id}
                    npc={npc}
                    active={active}
                    zones={state.zones}
                  />
                );
              })}
            </div>
          </div>
        </section>

        <aside className={styles.sideRail}>
          <section className={styles.panel} aria-label="Conversation status">
            <div className={styles.panelHeader}>
              <div>
                <h2>Conversation pipeline</h2>
                <p>{nearbyNpc ? `${nearbyNpc.profile.name} is in range. Press E to talk.` : "Approach an NPC to start a player-driven interaction."}</p>
              </div>
              <span className={styles.badge}>
                {activeConversation ? activeConversation.status : "idle"}
              </span>
            </div>

            {activeConversation ? (
              <ConversationCard conversation={activeConversation} />
            ) : (
              <p className={styles.placeholder}>
                No conversation is running right now. NPCs will trigger one automatically when they
                meet.
              </p>
            )}
          </section>

          <section className={styles.panel} aria-label="Recent interactions">
            <div className={styles.panelHeader}>
              <div>
                <h2>Recent interactions</h2>
                <p>Latest structured results applied to the runtime state.</p>
              </div>
            </div>

            <div className={styles.cardList}>
              {recentConversations.map((conversation) => (
                <ConversationPreview key={conversation.id} conversation={conversation} />
              ))}
            </div>
          </section>

          <section className={styles.panel} aria-label="Debug log">
            <div className={styles.panelHeader}>
              <div>
                <h2>Debug trail</h2>
                <p>Useful for demo narration and verification.</p>
              </div>
            </div>

            <ul className={styles.logList}>
              {state.logs.slice(0, 6).map((log) => (
                <li key={log}>{log}</li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    );
  }

  function renderHistoryView() {
    return (
      <section className={styles.panel} aria-label="Conversation history">
        <div className={styles.panelHeader}>
          <div>
            <h2>Saved conversations</h2>
            <p>These are persisted locally and can be reopened after a reload.</p>
          </div>
        </div>

        <div className={styles.historyList}>
          {recentConversations.map((conversation) => (
            <ConversationCard key={conversation.id} conversation={conversation} />
          ))}
        </div>
      </section>
    );
  }

  function renderDatabaseView() {
    return (
      <section className={styles.panel} aria-label="NPC database">
        <div className={styles.panelHeader}>
          <div>
            <h2>NPC runtime database</h2>
            <p>A read-only view of the in-memory simulation state.</p>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Mood</th>
                <th>Objective</th>
                <th>Position</th>
                <th>Memory trail</th>
              </tr>
            </thead>
            <tbody>
              {state.npcs.map((npc) => (
                <tr key={npc.profile.id}>
                  <td>
                    <strong>{npc.profile.name}</strong>
                    <div className={styles.tableMeta}>{npc.profile.id}</div>
                  </td>
                  <td>{npc.profile.role}</td>
                  <td>{npc.runtime.mood}</td>
                  <td>{formatObjective(npc.runtime.objective)}</td>
                  <td>
                    {npc.runtime.position.x}, {npc.runtime.position.y}
                  </td>
                  <td>{npc.memories.slice(0, 2).join(" | ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.databaseGrid}>
          {state.npcs.map((npc) => (
            <article key={npc.profile.id} className={styles.smallCard}>
              <div className={styles.smallCardHeader}>
                <NpcPortrait profile={npc.profile} className={styles.smallCardPortrait} />
                <div className={styles.smallCardHeaderText}>
                  <strong>{npc.profile.name}</strong>
                  <span>{npc.profile.role}</span>
                </div>
              </div>
              <p className={styles.loreText}>{npc.profile.lore}</p>
              <p>{npc.profile.personality.join(", ")}</p>
              <p>{npc.profile.goals.join(", ")}</p>
              <p>
                Relationship sample:{" "}
                {Object.values(npc.relationships)
                  .slice(0, 2)
                  .map((relation) => formatRelationship(relation))
                  .join(", ")}
              </p>
            </article>
          ))}
        </div>
      </section>
    );
  }
}

function SummaryCard({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <article className={styles.summaryCard}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function NpcPortrait({
  profile,
  className,
}: Readonly<{
  profile: NpcProfile;
  className?: string;
}>) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className={`${styles.portrait} ${className ?? ""}`}>
      {!imageFailed ? (
        <img
          className={styles.portraitImage}
          src={profile.portraitSrc}
          alt={profile.portraitAlt}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className={styles.portraitFallback}>{profile.monogram}</span>
      )}
    </div>
  );
}

function NpcToken({
  npc,
  active,
  zones,
}: Readonly<{
  npc: NpcState;
  active: boolean;
  zones: DemoState["zones"];
}>) {
  const zone = getZoneForPosition(npc.runtime.position, zones);
  const left = `${((npc.runtime.position.x + 0.5) / getGridWidth()) * 100}%`;
  const top = `${((npc.runtime.position.y + 0.5) / getGridHeight()) * 100}%`;

  return (
    <div
      className={`${styles.token} ${active ? styles.tokenActive : ""}`}
      style={{ left, top }}
      title={`${npc.profile.name} in ${zone?.name ?? "the world"}`}
    >
      <NpcPortrait profile={npc.profile} className={styles.tokenPortrait} />
      <small>{npc.profile.name}</small>
    </div>
  );
}

function PlayerToken({ player }: Readonly<{ player: PlayerState }>) {
  const left = `${((player.position.x + 0.5) / getGridWidth()) * 100}%`;
  const top = `${((player.position.y + 0.5) / getGridHeight()) * 100}%`;

  return (
    <div className={`${styles.token} ${styles.playerToken}`} style={{ left, top }} title="Player">
      <span>{player.monogram}</span>
      <small>{player.name}</small>
    </div>
  );
}

function ConversationCard({ conversation }: Readonly<{ conversation: ConversationRecord }>) {
  return (
    <article className={styles.conversationCard}>
      <header className={styles.conversationHeader}>
        <div>
          <strong>{conversation.participantNames.join(" + ")}</strong>
          <p>
            {conversation.reason} {conversation.zoneId ? `at ${conversation.zoneId}` : ""}
          </p>
        </div>
        <span className={styles.badge}>{conversation.status}</span>
      </header>

      <p className={styles.conversationSummary}>{conversation.summary}</p>

      <div className={styles.turnList}>
        {conversation.turns.map((turn) => (
          <div key={`${conversation.id}-${turn.index}`} className={styles.turnItem}>
            <strong>{turn.speakerName}</strong>
            <span>{turn.message}</span>
          </div>
        ))}
      </div>

      <div className={styles.updateList}>
        {conversation.updates.slice(0, 4).map((update, index) => (
          <span key={`${conversation.id}-${index}`} className={styles.updateChip}>
            {update.type}
          </span>
        ))}
      </div>
    </article>
  );
}

function ConversationPreview({ conversation }: Readonly<{ conversation: ConversationRecord }>) {
  return (
    <article className={styles.previewCard}>
      <div className={styles.conversationHeader}>
        <div>
          <strong>{conversation.participantNames.join(" + ")}</strong>
          <p>{conversation.summary}</p>
        </div>
        <span className={styles.badge}>{conversation.generatedTurnCount} turns</span>
      </div>

      <div className={styles.previewLine}>
        <span>Status</span>
        <strong>{conversation.status}</strong>
      </div>
      <div className={styles.previewLine}>
        <span>Started</span>
        <strong>{conversation.startedAt}</strong>
      </div>
      <div className={styles.previewLine}>
        <span>Reason</span>
        <strong>{conversation.reason}</strong>
      </div>
    </article>
  );
}

function readSavedState(): DemoState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as
      | DemoState
      | {
          version?: number;
          state?: DemoState;
        };

    if (isSavedDemoState(parsed)) {
      return parsed.state;
    }

    return null;
  } catch {
    return null;
  }
}

function initializeDemoState(): DemoState {
  const saved = readSavedState();

  if (!saved) {
    return createInitialDemoState();
  }

  return normalizeSavedState(saved);
}

function writeSavedState(state: DemoState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: STORAGE_VERSION,
      state,
    }),
  );
}

function normalizeSavedState(state: DemoState): DemoState {
  const normalizedPlayer = state.player ?? {
    id: "player",
    name: "You",
    monogram: "YOU",
    position: { x: 1, y: 6 },
    lastInteractionTick: -100,
  };

  if (!state.activeConversationId) {
    return {
      ...state,
      player: normalizedPlayer,
      npcs: state.npcs.map(hydrateNpcProfile),
    };
  }

  const completedAt = new Date().toISOString();

  return {
    ...state,
    player: normalizedPlayer,
    npcs: state.npcs.map(hydrateNpcProfile),
    activeConversationId: null,
    conversations: state.conversations.map((conversation) => {
      if (conversation.id !== state.activeConversationId) {
        return conversation;
      }

      return {
        ...conversation,
        status: "failed",
        endedAt: completedAt,
      };
    }),
    logs: [`Recovered from interrupted conversation ${state.activeConversationId}.`, ...state.logs].slice(0, 20),
  };
}

function isSavedDemoState(
  value: DemoState | { version?: number; state?: DemoState },
): value is { version: number; state: DemoState } {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    value.version === STORAGE_VERSION &&
    "state" in value &&
    typeof value.state === "object" &&
    value.state !== null
  );
}

function keyToDirection(key: string): "up" | "down" | "left" | "right" | null {
  switch (key.toLowerCase()) {
    case "arrowup":
    case "w":
      return "up";
    case "arrowdown":
    case "s":
      return "down";
    case "arrowleft":
    case "a":
      return "left";
    case "arrowright":
    case "d":
      return "right";
    default:
      return null;
  }
}

