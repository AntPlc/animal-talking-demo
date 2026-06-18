// Client shell for the Animal Talking demo views.

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./DemoApp.module.css";
import {
  CONV_PAGE_SIZE,
  GENERATION_DELAY_MS,
  PAGE_SIZE,
  SESSION_KEY,
  SESSION_START_KEY,
  STORAGE_KEY,
  STORAGE_VERSION,
  TICK_INTERVAL_MS,
} from "@/lib/constants";
import {
  advanceDemoState,
  createInitialDemoState,
  findInteractionCandidate,
  finishInteraction,
  finishInteractionWithDialogue,
  formatObjective,
  formatRelationship,
  formatTimestamp,
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
  type ConversationRecord,
  type DemoState,
  type DemoView,
  type InteractionCandidate,
  type NpcProfile,
  type NpcState,
  type OverrideEvent,
} from "@/lib/demo-state";
import { buildDemoDialogue } from "@/lib/animal-talking-engine";


type ViewLabel = {
  title: string;
  description?: string;
};

const VIEW_LABELS: Record<DemoView, ViewLabel> = {
  simulation: {
    title: "Simulation view",
  },
  data: {
    title: "Data"
  },
};

// Root client component for the Animal Talking demo.
// Owns the simulation state, drives the tick loop, persists state to localStorage,
// and orchestrates conversation timing (start → fake generation delay → finish).
export function DemoApp({ view }: Readonly<{ view: DemoView }>) {
  const [state, setState] = useState<DemoState>(() => createInitialDemoState());
  const [pendingCandidate, setPendingCandidate] = useState<InteractionCandidate | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerRef = useRef<number | null>(null);
  const simulationStartRef = useRef(Date.now());
  // Always-current state snapshot used inside setTimeout callbacks to avoid stale closures.
  const stateRef = useRef<DemoState>(state);
  useEffect(() => { stateRef.current = state; }, [state]);


  useEffect(() => {
    const isHardRefresh = !sessionStorage.getItem(SESSION_KEY);
    sessionStorage.setItem(SESSION_KEY, "1");
  
    if (isHardRefresh) {
      const startMs = Date.now();
      sessionStorage.setItem(SESSION_START_KEY, String(startMs));
      simulationStartRef.current = startMs;
      setElapsedMs(0);
      setState((current) => randomizeNpcPositions(current, startMs));
    } else {
      const storedStart = sessionStorage.getItem(SESSION_START_KEY);
      if (storedStart) {
        const start = parseInt(storedStart, 10);
        simulationStartRef.current = start;
        setElapsedMs(Date.now() - start);
      }
      const saved = readSavedState();
      if (saved) {
        setState(normalizeSavedState(saved));
      }
    }
  
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    writeSavedState(state);
  }, [isHydrated, state]);

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
    const elapsed = activeConversation.startedAtMs ? Date.now() - activeConversation.startedAtMs : 0;
    const remainingMs = Math.max(0, GENERATION_DELAY_MS - elapsed);
    timerRef.current = window.setTimeout(() => {
      const snap = stateRef.current;
      const [firstId, secondId] = candidate.participantIds;
      const first = snap.npcs.find((n) => n.profile.id === firstId);
      const second = snap.npcs.find((n) => n.profile.id === secondId);
      const wallTime = formatTimestamp(new Date());
      void (async () => {
        if (first && second) {
          const dialogue = await buildDemoDialogue(first, second, snap, candidate, wallTime);
          setState((s) => finishInteractionWithDialogue(s, candidate, dialogue));
        } else {
          setState((s) => finishInteraction(s, candidate));
        }
        setPendingCandidate(null);
        timerRef.current = null;
      })();
    }, remainingMs);
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
        const snap = stateRef.current;
        const [firstId, secondId] = candidate.participantIds;
        const first = snap.npcs.find((n) => n.profile.id === firstId);
        const second = snap.npcs.find((n) => n.profile.id === secondId);
        const wallTime = formatTimestamp(new Date());
        void (async () => {
          if (first && second) {
            const dialogue = await buildDemoDialogue(first, second, snap, candidate, wallTime);
            setState((s) => finishInteractionWithDialogue(s, candidate, dialogue));
          } else {
            setState((s) => finishInteraction(s, candidate));
          }
          setPendingCandidate(null);
          timerRef.current = null;
        })();
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
          <Link className={view === "data" ? styles.navActive : styles.navLink} href="/data">
            Data
          </Link>
        </nav>
      </header>

      {isSimulationView && (
        <section className={`${styles.topRow} ${styles.topRowSimulation}`} aria-label="World summary">
          <SummaryCard label="World time" value={formatWorldTime(state.worldTime)} />
          <SummaryCard label="Weather" value={`${weatherIcon(state.weather)} ${formatWeather(state.weather)}`} />
          <SummaryCard label="Elapsed (real)" value={formatElapsed(elapsedMs)} />
        </section>
      )}

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
        {view === "data" && <DataView state={state} />}
      </div>
    </div>
  );
}

// Renders the grid map with zone overlays, NPC tokens, and the live conversation feed sidebar.
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
              <h2>Generated conversations</h2>
          </div>

          <div className={`${styles.panelScroll} ${styles.historyList}`}>
            {conversations.length > 0 ? (
              [...conversations]
                .sort((a, b) => {
                  if (a.status === "generating" && b.status !== "generating") return -1;
                  if (b.status === "generating" && a.status !== "generating") return 1;
                  return (b.startedAtMs ?? 0) - (a.startedAtMs ?? 0);
                })
                .map((conversation) => (
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

// Read-only view of the in-memory simulation state.
// Shows NPC runtime rows, full conversation history, override events, system logs, and NPC cards.
function DataView({ state }: Readonly<{ state: DemoState }>) {
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
  const historyPagination = usePagination(state.conversations, CONV_PAGE_SIZE);

  return (
    <section className={`${styles.panel} ${styles.contentPanel}`} aria-label="Data">
      <div className={styles.panelHeader}>
        <div>
          <h2>NPC runtime data</h2>
          <p>A read-only view of the in-memory simulation state and all generated conversations.</p>
        </div>
      </div>

      <div className={styles.contentBody}>
        <div className={styles.dbSummaryRow}>
          <SummaryCard label="Conversations" value={String(state.conversations.length)} />
          <SummaryCard label="Avg gen time" value={avgGenTime === "—" ? "—" : `${avgGenTime}s`} />
          <SummaryCard label="LLM updates applied" value={String(totalLlmUpdates)} />
          <SummaryCard label="Active NPC overrides" value={String(state.recentOverrides.length)} />
        </div>

        <div className={`${styles.dataBlock} ${styles.tablesRow}`}>
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
                    <th>Mood</th>
                    <th>Objective</th>
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
                      <td>{npc.runtime.mood}</td>
                      <td>{formatObjective(npc.runtime.objective)}</td>
                      <td>{npc.memories.slice(0, 2).join(" | ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.tableSection}>
            <div className={styles.tableSectionHeader}>
              <div>
                <h3>Conversation metrics</h3>
                <p>Generation time per conversation.</p>
              </div>
              <PaginationBar {...convPagination} />
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Participants</th>
                    <th>Status</th>
                    <th>Gen time</th>
                  </tr>
                </thead>
                <tbody>
                  {convPagination.slice.map((conv) => {
                    const genMs = conv.startedAtMs && conv.endedAtMs
                      ? ((conv.endedAtMs - conv.startedAtMs) / 1000).toFixed(1) + "s"
                      : conv.status === "generating" ? "…" : "—";
                    return (
                      <tr key={conv.id}>
                        <td><strong>{conv.participantNames.join(" + ")}</strong></td>
                        <td><span className={statusBadgeClass(conv.status)}>{conv.status}</span></td>
                        <td>{genMs}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className={`${styles.dataBlock} ${styles.tableSection}`}>
          <div className={styles.tableSectionHeader}>
            <div>
              <h3>Conversation history</h3>
            </div>
            <PaginationBar {...historyPagination} />
          </div>
          {state.conversations.length > 0 ? (
            <div className={styles.historyGrid}>
              {historyPagination.slice.map((conversation) => (
                <ConversationCard key={conversation.id} conversation={conversation} />
              ))}
            </div>
          ) : (
            <p className={styles.placeholder}>No conversations yet. The simulation generates them automatically.</p>
          )}
        </div>

        <section className={`${styles.dataBlock} ${styles.overridePanel}`} aria-label="Override actions">
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

        <div className={`${styles.dataBlock} ${styles.databaseGrid}`}>
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
                Relationships:{" "}
                {formatNpcRelationships(npc, state.npcs)}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}


// Hook that slices an array into pages and exposes safe page navigation.
// safePage clamps the current page index to prevent out-of-bound reads when the array shrinks.
function usePagination<T>(items: T[], pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const slice = items.slice(safePage * pageSize, safePage * pageSize + pageSize);
  return { page: safePage, setPage, totalPages, slice };
}

// Renders previous / next page buttons. Returns null when there is only one page,
// so callers never see an empty pagination row.
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

// Small stat card displaying a text label and a bold value. Used in the top summary row.
function statusBadgeClass(status: string): string {
  if (status === "completed") return `${styles.badge} ${styles.badgeCompleted}`;
  if (status === "generating") return `${styles.badge} ${styles.badgeGenerating}`;
  if (status === "failed") return `${styles.badge} ${styles.badgeFailed}`;
  return styles.badge;
}

function SummaryCard({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <article className={styles.summaryCard}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

// Renders an NPC's portrait image. Falls back to a monogram badge if the image
// fails to load (e.g. missing asset in development).
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

// Absolutely-positioned overlay token placed on the grid at the NPC's current cell.
// Shows the portrait, name label, a speech bubble when chatting, and visual indicators
// for active / blocked / moving states. Position is expressed as percentages so it
// scales with any grid size.
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

// Compact conversation card shown in the simulation sidebar feed.
// Displays participants, timestamp, status badge, and a collapsible summary + dialogue.
function ConversationCardCompact({ conversation }: Readonly<{ conversation: ConversationRecord }>) {
  const llmCount = conversation.updates.filter((u) => u.source === "LLM_PACKAGE").length;
  const timestamp = conversation.startedAtMs
    ? formatTimestamp(new Date(conversation.startedAtMs))
    : (conversation.startedAt ?? "—");
  const hasContent = !!conversation.summary || conversation.turns.length > 0;

  return (
    <article className={styles.conversationCard}>
      <header className={styles.conversationHeader}>
        <div>
          <strong>{conversation.participantNames.join(" + ")}</strong>
          <p className={styles.updateRowTimestamp}>{timestamp}</p>
        </div>
        <span className={statusBadgeClass(conversation.status)}>{conversation.status}</span>
      </header>
      {hasContent && (
        <details className={styles.convDetails}>
          <summary className={styles.convDetailsSummary}>Summary</summary>
          {conversation.summary && (
            <p className={styles.conversationSummary}>{conversation.summary}</p>
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
        </details>
      )}
      {llmCount > 0 && (
        <p className={styles.llmTag}>{llmCount} LLM update{llmCount > 1 ? "s" : ""} applied</p>
      )}
      {conversation.status === "failed" && (
        <p className={styles.failedNote}>Interrupted by page reload — generation was lost.</p>
      )}
    </article>
  );
}


// Expanded conversation card used in the history view.
// Shows the full dialogue transcript followed by two grouped update sections:
// one for LLM-sourced extractions and one for classic-engine updates.
function ConversationCard({ conversation }: Readonly<{ conversation: ConversationRecord }>) {
  return (
    <article className={styles.conversationCard}>
      <header className={styles.conversationHeader}>
        <div>
          <strong>{conversation.participantNames.join(" + ")}</strong>
          <p className={styles.updateRowTimestamp}>
            {conversation.startedAtMs ? formatTimestamp(new Date(conversation.startedAtMs)) : conversation.startedAt}
          </p>
        </div>
        <span className={statusBadgeClass(conversation.status)}>{conversation.status}</span>
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
    </article>
  );
}

// Reads and parses the versioned demo state from localStorage.
// Returns null on a missing key, a JSON parse error, or a version mismatch.
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

// Serialises the current state together with STORAGE_VERSION into localStorage
// so that future loads can detect and reject stale schemas.
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

// Sanitises a state loaded from localStorage before it enters the simulation.
// Re-hydrates all NPC profiles with the latest static data, fills in missing fields
// (e.g. secondField added in a newer version), and marks any in-progress conversation
// as "failed" (it was interrupted by a page reload and cannot be resumed).
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

  return baseState;
}

// Type guard that verifies the persisted object has the correct schema version
// and a valid state property before the app attempts to restore it.
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

// Formats a millisecond duration as a zero-padded "MM:SS" string for the elapsed timer.
function formatNpcRelationships(npc: NpcState, allNpcs: NpcState[]): string {
  return Object.entries(npc.relationships)
    .map(([targetId, relation]) => {
      const target = allNpcs.find((other) => other.profile.id === targetId);
      const name = target?.profile.name ?? targetId;
      return `${name} → ${formatRelationship(relation)}`;
    })
    .join(", ");
}

function formatElapsed(valueMs: number): string {
  const totalSeconds = Math.floor(valueMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

// Maps a weather state to a Unicode icon displayed next to the weather label.
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

// Renders a single override event row with colour-coding by source:
// blue for Classic engine events, violet for LLM package events.
function OverrideEventRow({ event }: Readonly<{ event: OverrideEvent }>) {
  return (
    <article
      className={`${styles.overrideItem} ${event.source === "CLASSIC_ENGINE" ? styles.overrideClassic : styles.overrideLlm}`}
    >
      <div>
        <strong>{event.type}</strong>
        <p>{event.note}</p>
      </div>
      <div className={styles.overrideItemMeta}>
        <span>{event.source === "CLASSIC_ENGINE" ? "Classic" : "Package LLM"}</span>
        <span className={styles.updateRowTimestamp}>{event.timestamp}</span>
      </div>
    </article>
  );
}

