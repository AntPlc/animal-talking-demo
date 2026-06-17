// Client shell for the Animal Talking demo views.

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  interactionCandidateFromConversation,
  randomizeNpcPositions,
  reconcileConversationRuntime,
  startInteraction,
  type CharacterUpdate,
  type ConversationRecord,
  type DemoState,
  type DemoView,
  type InteractionCandidate,
  type NpcProfile,
  type NpcState,
  type OverrideEvent,
} from "@/lib/demo-state";

const STORAGE_KEY = "animal-talking-demo-state-v4";
const STORAGE_VERSION = 4;
// Presence of this key in sessionStorage signals a normal reload (not hard refresh).
// sessionStorage is cleared on Shift+F5 / Ctrl+Shift+R, preserved on F5.
const SESSION_KEY = "animal-talking-session-v4";
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
  const [isHydrated, setIsHydrated] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerRef = useRef<number | null>(null);
  const simulationStartRef = useRef(Date.now());
  const hasHydratedStorageRef = useRef(false);

  useEffect(() => {
    // Detect hard refresh: sessionStorage has no marker → Shift+F5 or new tab.
    // On normal F5 the marker survives, so we keep the saved state untouched.
    const isHardRefresh = typeof sessionStorage !== "undefined" && !sessionStorage.getItem(SESSION_KEY);
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(SESSION_KEY, "1");
    }

    const saved = readSavedState();

    if (saved) {
      const normalized = normalizeSavedState(saved);
      setState(isHardRefresh ? randomizeNpcPositions(normalized, Date.now()) : normalized);
    } else if (isHardRefresh) {
      setState((current) => randomizeNpcPositions(current, Date.now()));
    }

    hasHydratedStorageRef.current = true;
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!hasHydratedStorageRef.current) {
      return;
    }

    writeSavedState(state);
  }, [state]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setState((current) => advanceDemoState(current));
    }, TICK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isHydrated]);

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
        timerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!state.activeConversationId) {
      if (pendingCandidate) {
        setPendingCandidate(null);
      }
      return;
    }

    const activeConversation = state.conversations.find(
      (conversation) => conversation.id === state.activeConversationId,
    );

    if (!activeConversation || activeConversation.status !== "generating") {
      return;
    }

    if (timerRef.current !== null) {
      return;
    }

    const candidate = interactionCandidateFromConversation(activeConversation);
    setPendingCandidate(candidate);
    timerRef.current = window.setTimeout(() => {
      setState((current) => finishInteraction(current, candidate));
      setPendingCandidate(null);
      timerRef.current = null;
    }, GENERATION_DELAY_MS);
  }, [isHydrated, pendingCandidate, state.activeConversationId, state.conversations]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (state.activeConversationId || pendingCandidate) {
      return;
    }

    const candidate = findInteractionCandidate(state);
    if (candidate) {
      beginConversation(candidate);
    }
  }, [isHydrated, pendingCandidate, state]);

  const activeConversation = useMemo(() => {
    if (!state.activeConversationId) {
      return null;
    }

    return state.conversations.find((conversation) => conversation.id === state.activeConversationId) ?? null;
  }, [state.activeConversationId, state.conversations]);

  const beginConversation = useCallback(
    (candidate: InteractionCandidate) => {
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
    },
    [],
  );

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

      <section
        className={`${styles.topRow} ${isSimulationView ? styles.topRowSimulation : ""}`}
        aria-label="World summary"
      >
        <SummaryCard label="World time" value={formatWorldTime(state.worldTime)} />
        <SummaryCard label="Weather" value={`${weatherIcon(state.weather)} ${formatWeather(state.weather)}`} />
        <SummaryCard label="Elapsed (real)" value={formatElapsed(elapsedMs)} />
        {!isSimulationView ? (
          <SummaryCard
            label="Active conversation"
            value={activeConversation ? activeConversation.summary : "None"}
          />
        ) : null}
      </section>

      <div
        className={`${styles.mainContent} ${isSimulationView ? styles.mainSimulation : styles.mainScrollable}`}
      >
        {view === "simulation" && (
          <SimulationView
            zones={state.zones}
            npcs={state.npcs}
            conversations={state.conversations}
            activeConversation={activeConversation}
          />
        )}
        {view === "history" && (
          <HistoryView
            conversations={state.conversations}
            npcs={state.npcs}
            logs={state.logs}
          />
        )}
        {view === "database" && <DatabaseView state={state} />}
      </div>
    </div>
  );
}

function SimulationView({
  zones,
  npcs,
  conversations,
  activeConversation,
}: Readonly<{
  zones: DemoState["zones"];
  npcs: DemoState["npcs"];
  conversations: DemoState["conversations"];
  activeConversation: ConversationRecord | null;
}>) {
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
            {zones.map((zone) => (
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
            {npcs.map((npc) => {
              const active = activeConversation?.participantIds.includes(npc.profile.id) ?? false;
              const chatting = active && activeConversation?.status === "generating";
              const blocked = !active && (npc.runtime.blockedTicks ?? 0) >= 1;
              return (
                <NpcToken
                  key={npc.profile.id}
                  npc={npc}
                  active={active}
                  chatting={chatting}
                  blocked={blocked}
                  zones={zones}
                />
              );
            })}
          </div>
        </div>
      </section>

      <aside className={styles.conversationFeed} aria-label="Generated conversations">
        <section className={`${styles.panel} ${styles.conversationFeedPanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Generated conversations</h2>
              <p>
                Full dialogue and structured updates appear here as soon as a conversation
                finishes. Scroll to review earlier exchanges from today.
              </p>
              <div className={styles.sourceLegend} aria-label="Override source colors">
                <span className={styles.updateChipClassic}>Classic engine</span>
                <span className={styles.updateChipLlm}>Package LLM</span>
              </div>
            </div>
            <span className={styles.badge}>
              {activeConversation ? activeConversation.status : "idle"}
            </span>
          </div>

          <div className={`${styles.panelScroll} ${styles.historyList}`}>
            {conversations.length > 0 ? (
              conversations.map((conversation) => (
                <ConversationCardCompact key={conversation.id} conversation={conversation} />
              ))
            ) : (
              <p className={styles.placeholder}>
                No conversations yet. NPCs will trigger one automatically when they meet on the
                map.
              </p>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}

function HistoryView({
  conversations,
  npcs,
  logs,
}: Readonly<{
  conversations: DemoState["conversations"];
  npcs: DemoState["npcs"];
  logs: DemoState["logs"];
}>) {
  return (
    <div className={styles.historyLayout}>
      <section className={`${styles.panel} ${styles.contentPanel}`} aria-label="Conversation history">
        <div className={styles.panelHeader}>
          <div>
            <h2>Conversation history</h2>
            <p>Full dialogue, extracted memories, relationship changes, mood shifts, and new objectives — all as returned by the LLM.</p>
          </div>
        </div>

        <div className={styles.historyList}>
          {conversations.length > 0 ? (
            conversations.map((conversation) => (
              <ConversationCard key={conversation.id} conversation={conversation} npcs={npcs} />
            ))
          ) : (
            <p className={styles.placeholder}>No conversations yet. The simulation generates them automatically.</p>
          )}
        </div>
      </section>

      <section className={`${styles.panel} ${styles.contentPanel}`} aria-label="Debug trail">
        <div className={styles.panelHeader}>
          <div>
            <h2>Debug trail</h2>
            <p>Useful for demo narration and verification.</p>
          </div>
        </div>

        <ul className={styles.logList}>
          {logs.map((log) => (
            <li key={log}>{log}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function DatabaseView({ state }: Readonly<{ state: DemoState }>) {
  const completedConversations = state.conversations.filter((c) => c.status === "completed");
  const genTimes = completedConversations
    .filter((c) => c.startedAtMs && c.endedAtMs)
    .map((c) => (c.endedAtMs! - c.startedAtMs!) / 1000);
  const avgGenTime = genTimes.length > 0
    ? (genTimes.reduce((a, b) => a + b, 0) / genTimes.length).toFixed(1)
    : "—";
  const totalLlmUpdates = completedConversations.reduce(
    (sum, c) => sum + c.updates.filter((u) => u.source === "LLM_PACKAGE").length,
    0,
  );

  const npcPagination = usePagination(state.npcs);
  const convPagination = usePagination(state.conversations);
  const overridePagination = usePagination(state.recentOverrides);
  const logPagination = usePagination(state.logs);

  return (
    <section className={`${styles.panel} ${styles.contentPanel}`} aria-label="NPC database">
      <div className={styles.panelHeader}>
        <div>
          <h2>NPC runtime database</h2>
          <p>A read-only view of the in-memory simulation state.</p>
        </div>
      </div>

      <div className={styles.contentBody}>
        <div className={styles.dbSummaryRow}>
          <SummaryCard label="Conversations" value={String(state.conversations.length)} />
          <SummaryCard label="Avg gen time" value={avgGenTime === "—" ? "—" : `${avgGenTime}s`} />
          <SummaryCard label="LLM updates applied" value={String(totalLlmUpdates)} />
          <SummaryCard label="Active NPC overrides" value={String(state.recentOverrides.length)} />
        </div>

        <div className={styles.tableSection}>
          <div className={styles.tableSectionHeader}>
            <div>
              <h3>NPCs</h3>
              <p>{state.npcs.length} characters</p>
            </div>
            <PaginationBar {...npcPagination} />
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
                {npcPagination.slice.map((npc) => (
                  <tr key={npc.profile.id}>
                    <td>
                      <strong>{npc.profile.name}</strong>
                      <div className={styles.tableMeta}>{npc.profile.id}</div>
                    </td>
                    <td>{npc.profile.role}</td>
                    <td>{npc.runtime.mood}</td>
                    <td>{formatObjective(npc.runtime.objective)}</td>
                    <td>{npc.runtime.position.x}, {npc.runtime.position.y}</td>
                    <td>{npc.memories.slice(0, 2).join(" | ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {state.conversations.length > 0 && (
          <div className={styles.tableSection}>
            <div className={styles.tableSectionHeader}>
              <div>
                <h3>Conversation metrics</h3>
                <p>Generation time, turns, and LLM updates per conversation.</p>
              </div>
              <PaginationBar {...convPagination} />
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Participants</th>
                    <th>Zone</th>
                    <th>Status</th>
                    <th>Turns</th>
                    <th>Gen time</th>
                    <th>LLM updates</th>
                  </tr>
                </thead>
                <tbody>
                  {convPagination.slice.map((conv) => {
                    const genMs = conv.startedAtMs && conv.endedAtMs
                      ? ((conv.endedAtMs - conv.startedAtMs) / 1000).toFixed(1) + "s"
                      : conv.status === "generating" ? "…" : "—";
                    const llmCount = conv.updates.filter((u) => u.source === "LLM_PACKAGE").length;
                    return (
                      <tr key={conv.id}>
                        <td><strong>{conv.participantNames.join(" + ")}</strong></td>
                        <td>{conv.zoneId ?? "—"}</td>
                        <td><span className={styles.badge}>{conv.status}</span></td>
                        <td>{conv.generatedTurnCount}</td>
                        <td>{genMs}</td>
                        <td>{llmCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className={styles.dbLogsRow}>
          <section className={styles.overridePanel} aria-label="Override actions">
            <div className={styles.tableSectionHeader}>
              <div>
                <h3>Override actions</h3>
                <p>Blue = Classic engine, violet = LLM.</p>
              </div>
              <PaginationBar {...overridePagination} />
            </div>
            <div className={styles.overrideList}>
              {overridePagination.slice.map((event) => (
                <OverrideEventRow key={event.id} event={event} />
              ))}
            </div>
          </section>

          <section className={styles.overridePanel} aria-label="System logs">
            <div className={styles.tableSectionHeader}>
              <div>
                <h3>System logs</h3>
                <p>Generation results, state mutations, weather.</p>
              </div>
              <PaginationBar {...logPagination} />
            </div>
            <ul className={styles.logList}>
              {logPagination.slice.map((log) => (
                <li key={log}>{log}</li>
              ))}
            </ul>
          </section>
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
      </div>
    </section>
  );
}

const PAGE_SIZE = 10;

function usePagination<T>(items: T[]) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const slice = items.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  return { page: safePage, setPage, totalPages, slice };
}

function PaginationBar({
  page,
  totalPages,
  setPage,
}: Readonly<{ page: number; totalPages: number; setPage: (p: number) => void }>) {
  if (totalPages <= 1) return null;
  return (
    <div className={styles.pagination}>
      <button
        className={styles.pageBtn}
        disabled={page === 0}
        onClick={() => setPage(page - 1)}
      >
        ‹
      </button>
      <span className={styles.pageLabel}>
        {page + 1} / {totalPages}
      </span>
      <button
        className={styles.pageBtn}
        disabled={page >= totalPages - 1}
        onClick={() => setPage(page + 1)}
      >
        ›
      </button>
    </div>
  );
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
  chatting,
  blocked,
  zones,
}: Readonly<{
  npc: NpcState;
  active: boolean;
  chatting: boolean;
  blocked: boolean;
  zones: DemoState["zones"];
}>) {
  const zone = getZoneForPosition(npc.runtime.position, zones);
  const left = `${((npc.runtime.position.x + 0.5) / getGridWidth()) * 100}%`;
  const top = `${((npc.runtime.position.y + 0.5) / getGridHeight()) * 100}%`;
  const rerouting = (npc.runtime.blockedTicks ?? 0) >= 2;
  const zoneLabel = zone?.name ?? "the world";

  return (
    <div className={`${styles.tokenWrapper} ${styles.tokenAnimated}`} style={{ left, top, zIndex: chatting ? 10 : 2 }}>
      {chatting ? (
        <div
          className={styles.speechBubble}
          aria-label={`${npc.profile.name} is talking`}
        >
          <span className={styles.speechBubbleDots} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </div>
      ) : null}
      <div
        className={`${styles.token} ${active ? styles.tokenActive : ""} ${blocked && !active ? styles.tokenBlocked : ""} ${npc.runtime.status === "moving" ? styles.tokenMoving : ""}`}
        title={
          chatting
            ? `${npc.profile.name} is talking in ${zoneLabel}`
            : rerouting
              ? `${npc.profile.name} in ${zoneLabel} (rerouting)`
              : `${npc.profile.name} — ${npc.profile.lore}`
        }
      >
        <NpcPortrait profile={npc.profile} className={styles.tokenPortrait} />
        <small>{npc.profile.name}</small>
      </div>
    </div>
  );
}

function ConversationCardCompact({ conversation }: Readonly<{ conversation: ConversationRecord }>) {
  const llmCount = conversation.updates.filter((u) => u.source === "LLM_PACKAGE").length;
  return (
    <article className={styles.conversationCard}>
      <header className={styles.conversationHeader}>
        <div>
          <strong>{conversation.participantNames.join(" + ")}</strong>
          <p>{conversation.zoneId ?? "unknown zone"} · {conversation.reason.toLowerCase().replace("_", " ")}</p>
        </div>
        <span className={styles.badge}>{conversation.status}</span>
      </header>
      <p className={styles.conversationSummary}>{conversation.summary}</p>
      {llmCount > 0 && (
        <p className={styles.llmTag}>{llmCount} LLM update{llmCount > 1 ? "s" : ""} applied</p>
      )}
      {conversation.status === "failed" && (
        <p className={styles.failedNote}>Interrupted by page reload — generation was lost.</p>
      )}
    </article>
  );
}

function formatUpdateDetail(
  update: CharacterUpdate,
  participantIds: [string, string],
  participantNames: [string, string],
  npcs: NpcState[],
): { label: string; detail: string; isLlm: boolean } {
  const idx = participantIds.indexOf(update.characterId);
  const name = idx >= 0 ? participantNames[idx] : "?";
  const isLlm = update.source === "LLM_PACKAGE";

  switch (update.type) {
    case "UPDATE_MOOD":
      return { label: `${name} — mood`, detail: update.mood.toLowerCase(), isLlm };
    case "UPDATE_OBJECTIVE": {
      const goalType = update.objective.type === "GO_TO_LOCATION" ? "go to" : "idle";
      return { label: `${name} — new goal`, detail: `${goalType}: ${update.objective.label}`, isLlm };
    }
    case "ADD_MEMORY":
      return { label: `${name} — memory`, detail: update.memory, isLlm };
    case "UPDATE_RELATIONSHIP": {
      const target = npcs.find((n) => n.profile.id === update.targetCharacterId);
      const targetName = target?.profile.name ?? update.targetCharacterId;
      return {
        label: `${name} → ${targetName}`,
        detail: formatRelationship(update.relationship),
        isLlm,
      };
    }
  }
}

function ConversationCard({
  conversation,
  npcs,
}: Readonly<{ conversation: ConversationRecord; npcs: NpcState[] }>) {
  const llmUpdates = conversation.updates.filter((u) => u.source === "LLM_PACKAGE");
  const classicUpdates = conversation.updates.filter((u) => u.source === "CLASSIC_ENGINE");

  return (
    <article className={styles.conversationCard}>
      <header className={styles.conversationHeader}>
        <div>
          <strong>{conversation.participantNames.join(" + ")}</strong>
          <p>{conversation.zoneId ?? "unknown zone"} · {conversation.reason.toLowerCase().replace("_", " ")}</p>
        </div>
        <span className={styles.badge}>{conversation.status}</span>
      </header>

      <p className={styles.conversationSummary}>{conversation.summary}</p>

      {conversation.status === "failed" ? (
        <p className={styles.failedNote}>Interrupted by page reload — generation was lost.</p>
      ) : (
        <p className={styles.llmTag}>Generated by package interaction pipeline · {conversation.generatedTurnCount} turns</p>
      )}

      {conversation.turns.length > 0 && (
        <div className={styles.turnList}>
          {conversation.turns.map((turn) => (
            <div key={`${conversation.id}-${turn.index}`} className={styles.turnItem}>
              <strong>{turn.speakerName}</strong>
              <span>{turn.message}</span>
            </div>
          ))}
        </div>
      )}

      {llmUpdates.length > 0 && (
        <div className={styles.updatesSection}>
          <p className={styles.updatesSectionLabel}>LLM extractions</p>
          <div className={styles.updateRows}>
            {llmUpdates.map((update, i) => {
              const { label, detail } = formatUpdateDetail(
                update,
                conversation.participantIds,
                conversation.participantNames,
                npcs,
              );
              return (
                <div key={`llm-${i}`} className={styles.updateRow}>
                  <span className={styles.updateRowLabel}>{label}</span>
                  <span className={styles.updateRowDetail}>{detail}</span>
                  <span className={`${styles.updateChip} ${styles.updateChipLlm}`}>LLM</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {classicUpdates.length > 0 && (
        <div className={styles.updatesSection}>
          <p className={styles.updatesSectionLabel}>Classic engine</p>
          <div className={styles.updateRows}>
            {classicUpdates.map((update, i) => {
              const { label, detail } = formatUpdateDetail(
                update,
                conversation.participantIds,
                conversation.participantNames,
                npcs,
              );
              return (
                <div key={`classic-${i}`} className={styles.updateRow}>
                  <span className={styles.updateRowLabel}>{label}</span>
                  <span className={styles.updateRowDetail}>{detail}</span>
                  <span className={`${styles.updateChip} ${styles.updateChipClassic}`}>Classic</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
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

function normalizeSavedState(state: DemoState): DemoState {
  const baseState = reconcileConversationRuntime(
    {
      ...state,
      worldTime: {
        ...state.worldTime,
        second: state.worldTime.second ?? 0,
      },
      recentOverrides: state.recentOverrides ?? [],
      npcs: state.npcs.map(hydrateNpcProfile),
    },
    { stampCooldownOnRelease: true },
  );

  if (!state.activeConversationId) {
    return baseState;
  }

  const completedAt = new Date().toISOString();

  return reconcileConversationRuntime(
    {
      ...baseState,
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
    },
    { stampCooldownOnRelease: true },
  );
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

