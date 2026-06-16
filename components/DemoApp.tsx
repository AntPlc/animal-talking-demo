// Client shell for the Animal Talking demo views.

"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./DemoApp.module.css";
import {
  advanceDemoState,
  createInitialDemoState,
  findInteractionCandidate,
  finishInteraction,
  formatObjective,
  formatRelationship,
  formatWeather,
  formatWorldTime,
  getGridHeight,
  getGridWidth,
  getZoneForPosition,
  hydrateNpcProfile,
  startInteraction,
  type ConversationRecord,
  type DemoState,
  type DemoView,
  type InteractionCandidate,
  type NpcProfile,
  type NpcState,
  type OverrideEvent,
} from "@/lib/demo-state";

const STORAGE_KEY = "animal-talking-demo-state-v2";
const STORAGE_VERSION = 2;
const TICK_INTERVAL_MS = 1800;
const GENERATION_DELAY_MS = Number(process.env.NEXT_PUBLIC_GENERATION_DELAY_MS) || 20_000;

type ViewLabel = {
  title: string;
  description?: string;
};

const VIEW_LABELS: Record<DemoView, ViewLabel> = {
  simulation: {
    title: "Simulation view",
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
  const [state, setState] = useState<DemoState>(() => createInitialDemoState());
  const [pendingCandidate, setPendingCandidate] = useState<InteractionCandidate | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerRef = useRef<number | null>(null);
  const simulationStartRef = useRef(Date.now());
  const hasHydratedStorageRef = useRef(false);

  useEffect(() => {
    const saved = readSavedState();

    if (saved) {
      setState(normalizeSavedState(saved));
    }

    hasHydratedStorageRef.current = true;
  }, []);

  useEffect(() => {
    if (!hasHydratedStorageRef.current) {
      return;
    }

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
    const intervalId = window.setInterval(() => {
      setElapsedMs(Date.now() - simulationStartRef.current);
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (view !== "simulation") {
      return;
    }

    if (state.activeConversationId || pendingCandidate) {
      return;
    }

    const candidate = findInteractionCandidate(state);
    if (candidate) {
      beginConversation(candidate);
    }
  }, [pendingCandidate, state, view]);

  const activeConversation = useMemo(() => {
    if (!state.activeConversationId) {
      return state.conversations[0] ?? null;
    }

    return state.conversations.find((conversation) => conversation.id === state.activeConversationId) ?? null;
  }, [state.activeConversationId, state.conversations]);

  const recentConversations = useMemo(() => state.conversations.slice(0, 6), [state.conversations]);

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

  const isSimulationView = view === "simulation";

  return (
    <div
      className={`${styles.shell} ${isSimulationView ? styles.shellSimulation : styles.shellScrollable}`}
    >
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Animal Talking demo</p>
          <h1>{VIEW_LABELS[view].title}</h1>
          {VIEW_LABELS[view].description ? (
            <p className={styles.subtitle}>{VIEW_LABELS[view].description}</p>
          ) : null}
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
        <SummaryCard label="Weather" value={`${weatherIcon(state.weather)} ${formatWeather(state.weather)}`} />
        <SummaryCard label="Elapsed (real)" value={formatElapsed(elapsedMs)} />
        <SummaryCard
          label="Active conversation"
          value={activeConversation ? activeConversation.summary : "None"}
        />
      </section>

      <div
        className={`${styles.mainContent} ${isSimulationView ? styles.mainSimulation : styles.mainScrollable}`}
      >
        {view === "simulation" && renderSimulationView()}
        {view === "history" && renderHistoryView()}
        {view === "database" && renderDatabaseView()}
      </div>
    </div>
  );

  function renderSimulationView() {
    return (
      <div className={styles.layout}>
        <section className={styles.boardPanel} aria-label="Game world">
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
              {state.npcs.map((npc) => {
                const active = activeConversation?.participantIds.includes(npc.profile.id) ?? false;
                const generating = active && activeConversation?.status === "generating";
                return (
                  <NpcToken
                    key={npc.profile.id}
                    npc={npc}
                    active={active}
                    generating={generating}
                    zones={state.zones}
                  />
                );
              })}
            </div>
          </div>
        </section>

        <aside className={styles.sideRail}>
          <section className={`${styles.panel} ${styles.railPanel}`} aria-label="Conversation status">
            <div className={styles.panelHeader}>
              <div>
                <h2>Conversation pipeline</h2>
                <p>
                  NPC interactions are triggered automatically when characters meet in the same zone
                  or get close enough. Movement follows their objectives and the simulation tick.
                </p>
              </div>
              <span className={styles.badge}>
                {activeConversation ? activeConversation.status : "idle"}
              </span>
            </div>

            <div className={styles.panelScroll}>
              {activeConversation ? (
                <ConversationCard conversation={activeConversation} />
              ) : (
                <p className={styles.placeholder}>
                  No conversation is running right now. NPCs will trigger one automatically when they
                  meet.
                </p>
              )}
            </div>
          </section>

          <section className={`${styles.panel} ${styles.railPanel}`} aria-label="Recent interactions">
            <div className={styles.panelHeader}>
              <div>
                <h2>Recent interactions</h2>
                <p>Latest structured results applied to the runtime state.</p>
              </div>
            </div>

            <div className={`${styles.panelScroll} ${styles.cardList}`}>
              {recentConversations.map((conversation) => (
                <ConversationPreview key={conversation.id} conversation={conversation} />
              ))}
            </div>
          </section>

          <section className={`${styles.panel} ${styles.railPanel}`} aria-label="Debug log">
            <div className={styles.panelHeader}>
              <div>
                <h2>Debug trail</h2>
                <p>Useful for demo narration and verification.</p>
              </div>
            </div>

            <ul className={`${styles.panelScroll} ${styles.logList}`}>
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
      <section className={`${styles.panel} ${styles.contentPanel}`} aria-label="Conversation history">
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
      <section className={`${styles.panel} ${styles.contentPanel}`} aria-label="NPC database">
        <div className={styles.panelHeader}>
          <div>
            <h2>NPC runtime database</h2>
            <p>A read-only view of the in-memory simulation state.</p>
          </div>
        </div>

        <div className={styles.contentBody}>
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

          <section className={styles.overridePanel} aria-label="Override actions">
            <div className={styles.panelHeader}>
              <div>
                <h2>Override actions</h2>
                <p>Blue = Classic engine overrides, violet = package/LLM overrides.</p>
              </div>
            </div>
            <div className={styles.overrideList}>
              {state.recentOverrides.slice(0, 12).map((event) => (
                <OverrideEventRow key={event.id} event={event} />
              ))}
            </div>
          </section>

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
  generating,
  zones,
}: Readonly<{
  npc: NpcState;
  active: boolean;
  generating: boolean;
  zones: DemoState["zones"];
}>) {
  const zone = getZoneForPosition(npc.runtime.position, zones);
  const left = `${((npc.runtime.position.x + 0.5) / getGridWidth()) * 100}%`;
  const top = `${((npc.runtime.position.y + 0.5) / getGridHeight()) * 100}%`;

  return (
    <div
      className={`${styles.token} ${styles.tokenAnimated} ${active ? styles.tokenActive : ""} ${generating ? styles.tokenGenerating : ""} ${npc.runtime.status === "moving" ? styles.tokenMoving : ""}`}
      style={{ left, top }}
      title={
        generating
          ? `${npc.profile.name} is generating dialogue in ${zone?.name ?? "the world"}`
          : `${npc.profile.name} in ${zone?.name ?? "the world"}`
      }
    >
      <NpcPortrait profile={npc.profile} className={styles.tokenPortrait} />
      <small>{generating ? "Generating…" : npc.profile.name}</small>
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
      <p className={styles.llmTag}>Generated by package interaction pipeline</p>

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
          <span
            key={`${conversation.id}-${index}`}
            className={`${styles.updateChip} ${update.source === "CLASSIC_ENGINE" ? styles.updateChipClassic : styles.updateChipLlm}`}
          >
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

function normalizeSavedState(state: DemoState & { player?: unknown }): DemoState {
  const { player: _player, ...rest } = state;

  if (!rest.activeConversationId) {
    return {
      ...rest,
      worldTime: {
        ...rest.worldTime,
        second: rest.worldTime.second ?? 0,
      },
      recentOverrides: rest.recentOverrides ?? [],
      npcs: rest.npcs.map(hydrateNpcProfile),
    };
  }

  const completedAt = new Date().toISOString();

  return {
    ...rest,
    worldTime: {
      ...rest.worldTime,
      second: rest.worldTime.second ?? 0,
    },
    recentOverrides: rest.recentOverrides ?? [],
    npcs: rest.npcs.map(hydrateNpcProfile),
    activeConversationId: null,
    conversations: rest.conversations.map((conversation) => {
      if (conversation.id !== rest.activeConversationId) {
        return conversation;
      }

      return {
        ...conversation,
        status: "failed",
        endedAt: completedAt,
      };
    }),
    logs: [`Recovered from interrupted conversation ${rest.activeConversationId}.`, ...rest.logs].slice(0, 20),
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

function formatElapsed(valueMs: number): string {
  const totalSeconds = Math.floor(valueMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function weatherIcon(weather: DemoState["weather"]): string {
  switch (weather) {
    case "SUNNY":
      return "☀";
    case "CLOUDY":
      return "☁";
    case "RAINY":
      return "🌧";
    case "STORMY":
      return "⛈";
  }
}

function OverrideEventRow({ event }: Readonly<{ event: OverrideEvent }>) {
  return (
    <article
      className={`${styles.overrideItem} ${event.source === "CLASSIC_ENGINE" ? styles.overrideClassic : styles.overrideLlm}`}
    >
      <div>
        <strong>{event.type}</strong>
        <p>{event.note}</p>
      </div>
      <span>{event.source === "CLASSIC_ENGINE" ? "Classic" : "Package LLM"}</span>
    </article>
  );
}

