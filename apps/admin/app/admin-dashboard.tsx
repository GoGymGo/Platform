"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import Image from "next/image";
import {
  FormEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type {
  AdminSection,
  AuditEvent,
  Competition,
  CreatorWorkout,
  DashboardSnapshot,
  FirebaseClientConfig,
  LegalDocument,
  OperatorPortalAccess,
  PartnerCompetition,
  PartnerDashboardSnapshot,
  RegionPolicy,
  Reward,
  SystemHealth,
  WorkQueueItem,
} from "./admin-types";
import {
  AdminUserFacingError,
  adminRequestStatus,
  adminRequest,
  authErrorMessage,
  compactObject,
  defaultCompetitionDates,
  errorMessage,
  formatDate,
  formatDateTime,
  formatQueueAge,
  getAuditChange,
  getCompetitionDeadline,
  getQueueUrgency,
  optionalIso,
  optionalNumber,
  optionalString,
  toIso,
  toLocalDateTime,
  type HttpMethod,
} from "./admin-dashboard-utils";
import { PilotOperationsPanel, type PilotData } from "./pilot-operations";
import { downloadPosterJpeg } from "./poster-jpeg";

type AuthStage = "checking" | "denied" | "ready" | "signed-out";
type ConfirmAction = {
  actionLabel: string;
  auditReason?: string;
  description: string;
  execute: (reason: string) => Promise<void>;
  tone?: "danger" | "primary";
};

type NavigationCounts = Partial<Record<AdminSection, number>>;

type ActiveFilter = {
  label: string;
  onClear: () => void;
};

const navigation: {
  description: string;
  id: AdminSection;
  label: string;
  short: string;
}[] = [
  {
    description:
      "Current launch readiness, workload and system health at a glance.",
    id: "overview",
    label: "Overview",
    short: "OV",
  },
  {
    description:
      "Manage pilot gyms, static QR posters, field sessions and intake.",
    id: "pilot",
    label: "QR Pilot",
    short: "QR",
  },
  {
    description: "Build, review and release regional contests to players.",
    id: "competitions",
    label: "Contests",
    short: "CO",
  },
  {
    description:
      "Control reward inventory, coupon readiness and publication status.",
    id: "rewards",
    label: "Rewards",
    short: "RW",
  },
  {
    description:
      "Review the geographic and age policies that determine eligibility.",
    id: "regions",
    label: "Regions",
    short: "RG",
  },
  {
    description:
      "Maintain Creator workouts and authoritative legal document versions.",
    id: "content",
    label: "Content + Legal",
    short: "CL",
  },
  {
    description:
      "Monitor background processing and items awaiting human review.",
    id: "operations",
    label: "Operations",
    short: "OP",
  },
  {
    description:
      "Trace the latest administrative decisions, actors and reasons.",
    id: "audit",
    label: "Audit history",
    short: "AU",
  },
];

const mobilePrimarySections = new Set<AdminSection>([
  "overview",
  "pilot",
  "competitions",
  "operations",
]);

const creatorFeaturesEnabled = false;

const emptyPilotData: PilotData = {
  auditEvents: [],
  gyms: [],
  interestSubmissions: [],
  partnerApplications: [],
  sessions: [],
  waitlist: [],
};

function useStoredPreference<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return fallback;
    try {
      const stored = window.localStorage.getItem(key);
      return stored === null ? fallback : (JSON.parse(stored) as T);
    } catch {
      return fallback;
    }
  });

  const updateValue = useCallback(
    (nextValue: T) => {
      setValue(nextValue);
      try {
        window.localStorage.setItem(key, JSON.stringify(nextValue));
      } catch {
        // Device preferences are optional; the dashboard remains usable without storage.
      }
    },
    [key],
  );

  return [value, updateValue] as const;
}

export function BrandMark() {
  return (
    <span aria-label="GoGymGo" className="brand-mark" role="img">
      <Image
        alt=""
        aria-hidden
        height={100}
        src="/brand-mark.png"
        unoptimized
        width={100}
      />
    </span>
  );
}

export function BrandWordmark() {
  return (
    <strong aria-label="GoGymGo" className="brand-wordmark">
      <span aria-hidden="true" className="brand-wordmark-cyan">
        GO
      </span>
      <span aria-hidden="true" className="brand-wordmark-pink">
        GYM
      </span>
      <span aria-hidden="true" className="brand-wordmark-cyan">
        GO
      </span>
    </strong>
  );
}

function MobileAdminNavigation({
  counts,
  onNavigate,
  section,
}: {
  counts: NavigationCounts;
  onNavigate: (section: AdminSection) => void;
  section: AdminSection;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const primaryItems = navigation.filter((item) =>
    mobilePrimarySections.has(item.id),
  );
  const secondaryItems = navigation.filter(
    (item) => !mobilePrimarySections.has(item.id),
  );
  const secondaryActive = secondaryItems.some((item) => item.id === section);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (moreOpen && !dialog.open) {
      dialog.showModal();
    } else if (!moreOpen && dialog.open) {
      dialog.close();
      moreButtonRef.current?.focus();
    }
  }, [moreOpen]);

  function navigate(nextSection: AdminSection) {
    onNavigate(nextSection);
    setMoreOpen(false);
  }

  return (
    <nav
      aria-label="Primary admin sections"
      className="mobile-admin-navigation"
    >
      {primaryItems.map((item) => (
        <button
          aria-current={section === item.id ? "page" : undefined}
          className={
            section === item.id ? "mobile-nav-item active" : "mobile-nav-item"
          }
          key={item.id}
          onClick={() => navigate(item.id)}
          type="button"
        >
          <span>{item.short}</span>
          <small>{item.label}</small>
          {counts[item.id] ? (
            <b
              aria-label={`${counts[item.id]} items need attention`}
              className="nav-count"
            >
              {counts[item.id]}
            </b>
          ) : null}
        </button>
      ))}
      <button
        aria-expanded={moreOpen}
        className={
          secondaryActive ? "mobile-nav-item active" : "mobile-nav-item"
        }
        onClick={() => setMoreOpen(true)}
        ref={moreButtonRef}
        type="button"
      >
        <span>••</span>
        <small>More</small>
      </button>
      <dialog
        aria-labelledby="mobile-admin-more-title"
        className="mobile-admin-more"
        onCancel={(event) => {
          event.preventDefault();
          setMoreOpen(false);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) setMoreOpen(false);
        }}
        ref={dialogRef}
      >
        <div>
          <header>
            <span id="mobile-admin-more-title">MORE ADMIN SECTIONS</span>
            <button
              aria-label="Close more admin sections"
              onClick={() => setMoreOpen(false)}
              type="button"
            >
              ×
            </button>
          </header>
          {secondaryItems.map((item) => (
            <button
              aria-current={section === item.id ? "page" : undefined}
              className={section === item.id ? "active" : undefined}
              key={item.id}
              onClick={() => navigate(item.id)}
              type="button"
            >
              <span>{item.short}</span>
              <strong>{item.label}</strong>
              <small>{item.description}</small>
              {counts[item.id] ? (
                <b
                  aria-label={`${counts[item.id]} items need attention`}
                  className="nav-count"
                >
                  {counts[item.id]}
                </b>
              ) : null}
            </button>
          ))}
        </div>
      </dialog>
    </nav>
  );
}

const defaultCompetitionRules = {
  categoryPodiumMultipliers: { 1: 3, 2: 2, 3: 1.5 },
  minHeartRateSamples: 10,
  minSessionMinutes: 30,
  perfectMonthMultiplier: 10,
  requireDeviceAttestation: false,
  requireGymQr: true,
  requirePresenceCheck: false,
  signupPrizeDrawEntries: 1,
  verifiedSessionCategoryScore: 10,
  verifiedSessionPrizeDrawEntries: 2,
  weeklyChallengeBothHitMultiplier: 2,
  weeklyChallengeRecoveryMultiplier: 3,
};

export function AdminDashboard({
  firebaseConfig,
}: {
  firebaseConfig: FirebaseClientConfig;
}) {
  const firebaseConfigured = Object.entries(firebaseConfig)
    .filter(([key]) => key !== "measurementId")
    .every(([, value]) => Boolean(value));
  const [section, setSection] = useState<AdminSection>("overview");
  const [authStage, setAuthStage] = useState<AuthStage>(
    firebaseConfigured ? "checking" : "signed-out",
  );
  const [user, setUser] = useState<User | null>(null);
  const [portalAccess, setPortalAccess] = useState<OperatorPortalAccess | null>(
    null,
  );
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [partnerSnapshot, setPartnerSnapshot] =
    useState<PartnerDashboardSnapshot | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [queue, setQueue] = useState<WorkQueueItem[]>([]);
  const [pilotData, setPilotData] = useState<PilotData>(emptyPilotData);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [loadError, setLoadError] = useState(
    firebaseConfigured
      ? ""
      : "Firebase sign-in has not been configured for this dashboard build.",
  );
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [competitionEditor, setCompetitionEditor] = useState<
    Competition | "new" | null
  >(null);
  const [rewardEditor, setRewardEditor] = useState<Reward | "new" | null>(null);
  const [regionEditor, setRegionEditor] = useState(false);
  const [workoutEditor, setWorkoutEditor] = useState<
    CreatorWorkout | "new" | null
  >(null);
  const [legalEditor, setLegalEditor] = useState(false);
  const [couponReward, setCouponReward] = useState<Reward | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null,
  );

  const request = useCallback(
    <T,>(
      path: string,
      options: { body?: unknown; method?: HttpMethod } = {},
    ): Promise<T> => {
      if (!user) {
        return Promise.reject(
          new Error("Sign in before using the admin dashboard."),
        );
      }
      return adminRequest<T>(user, path, options);
    },
    [user],
  );

  const refresh = useCallback(async (activeUser: User) => {
    setBusy(true);
    setLoadError("");
    try {
      let access: OperatorPortalAccess;
      try {
        access = await adminRequest<OperatorPortalAccess>(
          activeUser,
          "operator/access",
          { expectedStatuses: [404] },
        );
      } catch (error) {
        if (adminRequestStatus(error) !== 404) throw error;

        // Older API releases predate role-aware partner workspaces. Continue
        // through the platform-admin contract; its protected endpoints still
        // enforce the administrator role on the server.
        access = {
          assignments: [],
          email: activeUser.email ?? "",
          id: activeUser.uid,
          portal: "gogymgo",
          roles: [],
        };
      }
      setPortalAccess(access);
      if (access.portal === "partner") {
        const partnerResult = await adminRequest<PartnerDashboardSnapshot>(
          activeUser,
          "operator/partner-dashboard",
        );
        setPartnerSnapshot(partnerResult);
        setSnapshot(null);
        setHealth(null);
        setQueue([]);
        setPilotData(emptyPilotData);
        setLastRefreshedAt(new Date());
        setAuthStage("ready");
        return;
      }
      const [
        dashboardResult,
        healthResult,
        queueResult,
        gyms,
        sessions,
        waitlist,
        interestSubmissions,
        partnerApplications,
        auditEvents,
      ] = await Promise.all([
        adminRequest<DashboardSnapshot>(
          activeUser,
          "operator/configuration/dashboard",
        ),
        adminRequest<SystemHealth>(activeUser, "operator/system-health"),
        adminRequest<WorkQueueItem[]>(activeUser, "operator/work-queue"),
        adminRequest<PilotData["gyms"]>(activeUser, "operator/gym-locations"),
        adminRequest<PilotData["sessions"]>(
          activeUser,
          "operator/gym-sessions",
        ),
        adminRequest<PilotData["waitlist"]>(
          activeUser,
          "operator/region-waitlist",
        ),
        adminRequest<PilotData["interestSubmissions"]>(
          activeUser,
          "operator/interest-submissions",
        ),
        adminRequest<PilotData["partnerApplications"]>(
          activeUser,
          "operator/partner-applications",
        ),
        adminRequest<PilotData["auditEvents"]>(
          activeUser,
          "operator/audit-history",
        ),
      ]);
      setSnapshot(dashboardResult);
      setPartnerSnapshot(null);
      setHealth(healthResult);
      setQueue(queueResult);
      setPilotData({
        auditEvents,
        gyms,
        interestSubmissions,
        partnerApplications,
        sessions,
        waitlist,
      });
      setLastRefreshedAt(new Date());
      setAuthStage("ready");
    } catch (error) {
      const status = adminRequestStatus(error);
      if (status === 401 || status === 403) setAuthStage("denied");
      setLoadError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!firebaseConfigured) return;
    try {
      const app =
        getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const auth = getAuth(app);
      return onAuthStateChanged(auth, (nextUser) => {
        setUser(nextUser);
        setPortalAccess(null);
        setSnapshot(null);
        setPartnerSnapshot(null);
        if (nextUser) {
          setAuthStage("checking");
          void refresh(nextUser);
        } else {
          setAuthStage("signed-out");
        }
      });
    } catch (error) {
      queueMicrotask(() => {
        setAuthStage("signed-out");
        setLoadError(authErrorMessage(error));
      });
      return;
    }
  }, [firebaseConfig, firebaseConfigured, refresh]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  async function mutate<T = unknown>(
    successMessage: string,
    path: string,
    method: HttpMethod,
    body: unknown,
  ): Promise<T> {
    setSubmitting(true);
    setLoadError("");
    try {
      const result = await request<T>(path, { body, method });
      if (user) await refresh(user);
      setToast(successMessage);
      return result;
    } catch (error) {
      setLoadError(errorMessage(error));
      throw error;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEmailSignIn(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setLoadError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const rememberMe = form.get("rememberMe") === "on";
    try {
      if (!firebaseConfigured) {
        throw new AdminUserFacingError(
          "Administrator sign-in is not configured for this deployment.",
        );
      }
      const app =
        getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const auth = getAuth(app);
      await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence,
      );
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setLoadError(authErrorMessage(error));
    }
  }

  async function handleSignOut() {
    await signOut(getAuth());
    setPortalAccess(null);
    setSnapshot(null);
    setPartnerSnapshot(null);
    setHealth(null);
    setQueue([]);
    setPilotData(emptyPilotData);
    setLastRefreshedAt(null);
    setAuthStage("signed-out");
  }

  if (authStage === "signed-out" || authStage === "denied") {
    return (
      <SignInScreen
        denied={authStage === "denied"}
        error={loadError}
        firebaseConfigured={firebaseConfigured}
        onEmailSignIn={handleEmailSignIn}
        onSignOut={user ? handleSignOut : undefined}
        signedInEmail={user?.email ?? undefined}
      />
    );
  }

  if (
    authStage === "checking" ||
    (portalAccess?.portal === "partner" ? !partnerSnapshot : !snapshot)
  ) {
    return (
      <div className="boot-screen">
        <div className="brand-lockup">
          <BrandMark />
          <span>
            <BrandWordmark />
            <small>OPERATOR ACCESS</small>
          </span>
        </div>
        <div className="boot-line" />
        <p>{loadError || "CHECKING YOUR SESSION"}</p>
      </div>
    );
  }

  if (portalAccess?.portal === "partner" && partnerSnapshot) {
    return (
      <PartnerWorkspace
        busy={busy}
        error={loadError}
        onDismissError={() => setLoadError("")}
        onMutate={mutate}
        onRefresh={() => {
          if (user) void refresh(user);
        }}
        onSignOut={handleSignOut}
        snapshot={partnerSnapshot}
        submitting={submitting}
        toast={toast}
      />
    );
  }

  if (!snapshot) return null;

  const draftCompetitions = snapshot.competitions.filter(
    (competition) => competition.status === "draft",
  );
  const publishReady = draftCompetitions.filter(
    (competition) => competition.publishedRewardCount > 0,
  );
  const activeCompetition = snapshot.competitions.find((competition) =>
    ["registration", "active"].includes(competition.status),
  );
  const activeNavigation =
    navigation.find((item) => item.id === section) ?? navigation[0];
  const navigationCounts: NavigationCounts = {
    competitions: snapshot.competitions.filter(
      (competition) =>
        competition.status === "draft" &&
        competition.publishedRewardCount === 0,
    ).length,
    operations: queue.length,
    pilot: pilotData.partnerApplications.filter((application) =>
      ["submitted", "in_review"].includes(application.status),
    ).length,
    rewards: snapshot.rewards.filter(
      (reward) =>
        reward.status === "draft" ||
        (reward.rewardType === "coupon" && reward.couponCodeCount === 0),
    ).length,
  };

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand-lockup sidebar-brand">
          <BrandMark />
          <span>
            <BrandWordmark />
            <small>ADMIN CONTROL</small>
          </span>
        </div>
        <nav aria-label="Admin sections" className="desktop-admin-navigation">
          {navigation.map((item) => (
            <button
              aria-current={section === item.id ? "page" : undefined}
              aria-label={item.label}
              className={section === item.id ? "nav-item active" : "nav-item"}
              key={item.id}
              onClick={() => setSection(item.id)}
              title={item.label}
              type="button"
            >
              <span className="nav-short">{item.short}</span>
              <span>{item.label}</span>
              {navigationCounts[item.id] ? (
                <b
                  aria-label={`${navigationCounts[item.id]} items need attention`}
                  className="nav-count"
                >
                  {navigationCounts[item.id]}
                </b>
              ) : null}
            </button>
          ))}
        </nav>
        <MobileAdminNavigation
          counts={navigationCounts}
          onNavigate={setSection}
          section={section}
        />
        <div className="sidebar-footer">
          <div className="admin-identity">
            <span className="presence-dot" />
            <span>
              <small>AUTHENTICATED ADMIN</small>
              <strong>{snapshot.admin.email}</strong>
            </span>
          </div>
          <button className="text-button" onClick={handleSignOut} type="button">
            Sign out
          </button>
        </div>
      </aside>

      <main aria-busy={busy}>
        <header className="topbar">
          <div className="topbar-heading">
            <p className="eyebrow">SYSTEM // {section.toUpperCase()}</p>
            <h1>{activeNavigation.label}</h1>
            <p className="page-context">{activeNavigation.description}</p>
          </div>
          <div className="topbar-actions">
            <span
              aria-label={`Operations worker status: ${health?.worker.status ?? "unknown"}`}
              className={`health-pill ${health?.worker.status ?? "stale"}`}
            >
              <span aria-hidden="true" />
              WORKER {health?.worker.status.toUpperCase() ?? "UNKNOWN"}
              {health?.worker.heartbeatAgeSeconds === null ||
              health?.worker.heartbeatAgeSeconds === undefined
                ? ""
                : ` · ${health.worker.heartbeatAgeSeconds}s`}
            </span>
            <div className="refresh-control">
              <span aria-live="polite" className="refresh-time">
                {lastRefreshedAt ? (
                  <>
                    UPDATED{" "}
                    <time dateTime={lastRefreshedAt.toISOString()}>
                      {lastRefreshedAt.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </>
                ) : (
                  "NOT YET SYNCED"
                )}
              </span>
              <button
                aria-label={
                  busy ? "Refreshing dashboard data" : "Refresh dashboard data"
                }
                className="icon-button"
                disabled={busy}
                onClick={() => {
                  if (user) void refresh(user);
                }}
                type="button"
              >
                {busy ? "SYNCING" : "REFRESH"}
              </button>
            </div>
          </div>
        </header>

        {loadError ? (
          <div className="alert error" role="alert">
            <span>!</span>
            <p>{loadError}</p>
            <button onClick={() => setLoadError("")} type="button">
              Dismiss
            </button>
          </div>
        ) : null}

        <div className="workspace">
          {section === "overview" ? (
            <Overview
              activeCompetition={activeCompetition}
              health={health}
              publishReady={publishReady}
              queue={queue}
              snapshot={snapshot}
              onNavigate={setSection}
            />
          ) : null}
          {section === "competitions" ? (
            <CompetitionsPanel
              competitions={snapshot.competitions}
              onCreate={() => setCompetitionEditor("new")}
              onEdit={setCompetitionEditor}
              onNavigate={setSection}
              onStatus={(competition, action) =>
                setConfirmAction({
                  actionLabel:
                    action === "publish"
                      ? "Publish contest"
                      : "Cancel contest",
                  auditReason:
                    action === "publish"
                      ? "Publish the approved contest after operator confirmation."
                      : undefined,
                  description:
                    action === "publish"
                      ? `${competition.name} will become visible and joinable in the player app immediately.`
                      : `${competition.name} will be cancelled. This action is recorded in the audit ledger.`,
                  execute: (reason) =>
                    mutate(
                      action === "publish"
                        ? "Contest published."
                        : "Contest cancelled.",
                      `operator/configuration/competitions/${competition.id}/status-action`,
                      "POST",
                      {
                        action,
                        expectedVersion: competition.version,
                        reason,
                      },
                    ),
                  tone: action === "cancel" ? "danger" : "primary",
                })
              }
            />
          ) : null}
          {section === "pilot" ? (
            <PilotOperationsPanel
              {...pilotData}
              competitions={snapshot.competitions}
              onAssignGym={async (competitionId, gymId, body) => {
                await mutate(
                  "Gym assigned to contest.",
                  `operator/competitions/${competitionId}/gym-locations/${gymId}`,
                  "POST",
                  body,
                );
              }}
              onCreateGym={async (body) => {
                await mutate(
                  "Partner gym created.",
                  "operator/gym-locations",
                  "POST",
                  body,
                );
              }}
              onIssueQr={(gymId, body) =>
                mutate(
                  "Printable QR poster issued.",
                  `operator/gym-locations/${gymId}/qr-credentials`,
                  "POST",
                  body,
                )
              }
              onRecordCash={async (body) => {
                await mutate(
                  "Cash handoff recorded.",
                  "operator/cash-fulfillments",
                  "POST",
                  body,
                );
              }}
              onRevokeQr={async (gymId, body) => {
                await mutate(
                  "QR credential revoked.",
                  `operator/gym-locations/${gymId}/qr-credentials/revoke`,
                  "POST",
                  body,
                );
              }}
              onUpdateGym={async (gymId, body) => {
                await mutate(
                  "Partner gym updated.",
                  `operator/gym-locations/${gymId}`,
                  "PUT",
                  body,
                );
              }}
              regions={snapshot.regions}
              submitting={submitting}
            />
          ) : null}
          {section === "rewards" ? (
            <RewardsPanel
              onCouponCodes={setCouponReward}
              onCreate={() => setRewardEditor("new")}
              onEdit={setRewardEditor}
              onStatus={(reward, action) =>
                setConfirmAction({
                  actionLabel:
                    action === "publish" ? "Publish reward" : "Archive reward",
                  description:
                    action === "publish"
                      ? `${reward.title} will become part of the public contest reward catalog.`
                      : `${reward.title} will be removed from the public reward catalog.`,
                  execute: (reason) =>
                    mutate(
                      action === "publish"
                        ? "Reward published."
                        : "Reward archived.",
                      `operator/configuration/rewards/${reward.id}/status-action`,
                      "POST",
                      { action, expectedVersion: reward.version, reason },
                    ),
                  tone: action === "archive" ? "danger" : "primary",
                })
              }
              rewards={snapshot.rewards}
            />
          ) : null}
          {section === "regions" ? (
            <RegionsPanel
              onCreate={() => setRegionEditor(true)}
              regions={snapshot.regions}
            />
          ) : null}
          {section === "content" ? (
            <ContentPanel
              creatorFeaturesEnabled={creatorFeaturesEnabled}
              documents={snapshot.legalDocuments}
              onCreateDocument={() => setLegalEditor(true)}
              onCreateWorkout={() => setWorkoutEditor("new")}
              onEditWorkout={setWorkoutEditor}
              onWorkoutStatus={(workout, action) =>
                setConfirmAction({
                  actionLabel:
                    action === "publish"
                      ? "Publish workout"
                      : "Unpublish workout",
                  description:
                    action === "publish"
                      ? `${workout.title} will become visible in its configured regions.`
                      : `${workout.title} will be removed from the player catalog.`,
                  execute: (reason) =>
                    mutate(
                      action === "publish"
                        ? "Creator workout published."
                        : "Creator workout unpublished.",
                      `operator/configuration/creator-workouts/${workout.id}/status-action`,
                      "POST",
                      { action, expectedVersion: workout.version, reason },
                    ),
                  tone: action === "unpublish" ? "danger" : "primary",
                })
              }
              onWithdrawDocument={(document) =>
                setConfirmAction({
                  actionLabel: "Withdraw legal document",
                  description: `${document.title} version ${document.version} will no longer be served as an active legal document.`,
                  execute: (reason) =>
                    mutate(
                      "Legal document withdrawn.",
                      `operator/configuration/legal-documents/${document.id}/withdrawal`,
                      "POST",
                      { reason },
                    ),
                  tone: "danger",
                })
              }
              workouts={snapshot.creatorWorkouts}
            />
          ) : null}
          {section === "operations" ? (
            <OperationsPanel
              events={snapshot.auditEvents}
              health={health}
              onNavigate={setSection}
              queue={queue}
            />
          ) : null}
          {section === "audit" ? (
            <AuditPanel events={snapshot.auditEvents} />
          ) : null}
        </div>
      </main>

      {competitionEditor ? (
        <CompetitionForm
          competition={
            competitionEditor === "new" ? undefined : competitionEditor
          }
          onClose={() => setCompetitionEditor(null)}
          onSubmit={async (body, editing) => {
            await mutate(
              editing
                ? "Contest draft updated."
                : "Contest draft created.",
              editing
                ? `operator/configuration/competitions/${editing.id}`
                : "operator/configuration/competitions",
              editing ? "PUT" : "POST",
              body,
            );
            setCompetitionEditor(null);
          }}
          regions={snapshot.regions}
          submitting={submitting}
        />
      ) : null}
      {rewardEditor ? (
        <RewardForm
          competitions={snapshot.competitions}
          onClose={() => setRewardEditor(null)}
          onSubmit={async (body, editing) => {
            await mutate(
              editing ? "Reward draft updated." : "Reward draft created.",
              editing
                ? `operator/configuration/rewards/${editing.id}`
                : "operator/configuration/rewards",
              editing ? "PUT" : "POST",
              body,
            );
            setRewardEditor(null);
          }}
          reward={rewardEditor === "new" ? undefined : rewardEditor}
          submitting={submitting}
        />
      ) : null}
      {regionEditor ? (
        <RegionForm
          onClose={() => setRegionEditor(false)}
          onSubmit={async (body) => {
            await mutate(
              "Regional policy created.",
              "operator/configuration/region-policies",
              "POST",
              body,
            );
            setRegionEditor(false);
          }}
          submitting={submitting}
        />
      ) : null}
      {workoutEditor ? (
        <WorkoutForm
          onClose={() => setWorkoutEditor(null)}
          onSubmit={async (body, editing) => {
            await mutate(
              editing
                ? "Creator workout updated."
                : "Creator workout draft created.",
              editing
                ? `operator/configuration/creator-workouts/${editing.id}`
                : "operator/configuration/creator-workouts",
              editing ? "PUT" : "POST",
              body,
            );
            setWorkoutEditor(null);
          }}
          regions={snapshot.regions}
          submitting={submitting}
          workout={workoutEditor === "new" ? undefined : workoutEditor}
        />
      ) : null}
      {legalEditor ? (
        <LegalDocumentForm
          onClose={() => setLegalEditor(false)}
          onSubmit={async (body) => {
            await mutate(
              "Legal document version published.",
              "operator/configuration/legal-documents",
              "POST",
              body,
            );
            setLegalEditor(false);
          }}
          submitting={submitting}
        />
      ) : null}
      {couponReward ? (
        <CouponCodesForm
          onClose={() => setCouponReward(null)}
          onSubmit={async (codes, reason) => {
            await mutate(
              `${codes.length} coupon code${codes.length === 1 ? "" : "s"} added.`,
              `operator/configuration/rewards/${couponReward.id}/coupon-codes`,
              "POST",
              { codes, reason },
            );
            setCouponReward(null);
          }}
          reward={couponReward}
          submitting={submitting}
        />
      ) : null}
      {confirmAction ? (
        <ConfirmationDialog
          action={confirmAction}
          onClose={() => setConfirmAction(null)}
          onRefresh={async () => {
            if (user) await refresh(user);
          }}
          submitting={submitting}
        />
      ) : null}
      {toast ? (
        <div aria-live="polite" className="toast">
          <span>✓</span>
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function SignInScreen({
  denied,
  error,
  firebaseConfigured,
  onEmailSignIn,
  onSignOut,
  signedInEmail,
}: {
  denied: boolean;
  error: string;
  firebaseConfigured: boolean;
  onEmailSignIn: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSignOut?: () => Promise<void>;
  signedInEmail?: string;
}) {
  const [portal, setPortal] = useState<"gogymgo" | "partner">("gogymgo");
  return (
    <main className="sign-in-screen">
      <section className="sign-in-intro">
        <div className="brand-lockup">
          <BrandMark />
          <span>
            <BrandWordmark />
            <small>OPERATOR PORTAL</small>
          </span>
        </div>
        <p className="eyebrow">SECURE OPERATIONS CONSOLE</p>
        <h1>
          The right workspace
          <span>for every operator.</span>
        </h1>
        <p className="sign-in-lede">
          GoGymGo runs the platform. Partner gyms manage only their own
          locations, visits, QR posters and contest proposals.
        </p>
        <div className="security-list">
          <span>01</span>
          <p>
            <strong>Role-based workspaces</strong>
            Your server-assigned account role decides which tools and gym data
            you can access.
          </p>
          <span>02</span>
          <p>
            <strong>Every change is traceable</strong>
            Reasons, previous states and new states are recorded in an
            append-only audit history.
          </p>
        </div>
      </section>
      <section className="sign-in-panel">
        <p className="eyebrow">INVITATION-ONLY OPERATOR ACCESS</p>
        <h2>{denied ? "Operator access required" : "Sign in to continue"}</h2>
        {denied ? (
          <div className="alert error compact" role="alert">
            <span>!</span>
            <p>
              {signedInEmail || "This account"} is signed in, but the backend
              did not confirm operator access or an active gym assignment.
            </p>
          </div>
        ) : null}
        {error && firebaseConfigured ? (
          <p className="form-error">{error}</p>
        ) : null}
        {!firebaseConfigured ? (
          <p className="configuration-note" role="status">
            Firebase sign-in has not been configured for this dashboard build.
            Add the existing GoGymGo Firebase web configuration before operator
            sign-in can start.
          </p>
        ) : denied && onSignOut ? (
          <button
            className="primary-button full"
            onClick={() => void onSignOut()}
            type="button"
          >
            SIGN OUT AND TRY ANOTHER ACCOUNT
          </button>
        ) : (
          <>
            <div
              aria-label="Choose operator workspace"
              className="portal-selector"
            >
              <button
                aria-pressed={portal === "gogymgo"}
                className={portal === "gogymgo" ? "active" : ""}
                onClick={() => setPortal("gogymgo")}
                type="button"
              >
                <strong>GoGymGo Team</strong>
                <span>Full platform operations</span>
              </button>
              <button
                aria-pressed={portal === "partner"}
                className={portal === "partner" ? "active" : ""}
                onClick={() => setPortal("partner")}
                type="button"
              >
                <strong>Gym Partner</strong>
                <span>Your assigned locations</span>
              </button>
            </div>
            <form
              className="stacked-form"
              onSubmit={(event) => void onEmailSignIn(event)}
            >
              <input name="portal" type="hidden" value={portal} />
              <label>
                {portal === "gogymgo" ? "GOGYMGO TEAM EMAIL" : "PARTNER EMAIL"}
                <input
                  autoComplete="username"
                  name="email"
                  placeholder="you@example.com"
                  required
                  type="email"
                />
              </label>
              <label>
                PASSWORD
                <input
                  autoComplete="current-password"
                  minLength={8}
                  name="password"
                  placeholder="Your account password"
                  required
                  type="password"
                />
              </label>
              <label className="remember-session">
                <input name="rememberMe" type="checkbox" />
                <span>Keep me signed in on this device</span>
              </label>
              <button className="primary-button full" type="submit">
                {portal === "gogymgo"
                  ? "ENTER GOGYMGO CONTROL"
                  : "ENTER PARTNER WORKSPACE"}
              </button>
            </form>
          </>
        )}
        <p className="fine-print">
          Choosing a workspace does not grant permissions. The backend verifies
          the account, role and assigned gyms on every request.
        </p>
      </section>
    </main>
  );
}

type PartnerSection = "overview" | "gyms" | "competitions" | "visits";

const partnerNavigation: {
  description: string;
  id: PartnerSection;
  label: string;
  short: string;
}[] = [
  {
    description: "Your assigned gyms, current proposals and recent activity.",
    id: "overview",
    label: "Overview",
    short: "OV",
  },
  {
    description: "View assigned gym details and manage printable QR posters.",
    id: "gyms",
    label: "My gyms",
    short: "GY",
  },
  {
    description: "Create local drafts for GoGymGo review and publication.",
    id: "competitions",
    label: "Contests",
    short: "CO",
  },
  {
    description: "Monitor Verified workouts at your assigned Partner gyms.",
    id: "visits",
    label: "Gym visits",
    short: "VI",
  },
];

function PartnerWorkspace({
  busy,
  error,
  onDismissError,
  onMutate,
  onRefresh,
  onSignOut,
  snapshot,
  submitting,
  toast,
}: {
  busy: boolean;
  error: string;
  onDismissError: () => void;
  onMutate: <T = unknown>(
    successMessage: string,
    path: string,
    method: HttpMethod,
    body: unknown,
  ) => Promise<T>;
  onRefresh: () => void;
  onSignOut: () => Promise<void>;
  snapshot: PartnerDashboardSnapshot;
  submitting: boolean;
  toast: string;
}) {
  const [section, setSection] = useState<PartnerSection>("overview");
  const [competitionEditor, setCompetitionEditor] = useState<
    PartnerCompetition | "new" | null
  >(null);
  const activeNavigation =
    partnerNavigation.find((item) => item.id === section) ??
    partnerNavigation[0];
  const adminGyms = snapshot.gyms.filter((gym) => gym.accessLevel === "admin");
  const activeVisits = snapshot.sessions.filter(
    (session) => session.status === "active",
  ).length;
  const proposalsAwaitingReview = snapshot.competitions.filter(
    (competition) => competition.status === "draft",
  ).length;

  async function issueQr(gymId: string, gymName: string) {
    if (
      !window.confirm(
        `Issue a new QR poster for ${gymName}? Any current poster will stop working.`,
      )
    ) {
      return;
    }
    const credential = await onMutate<{ printablePosterSvg: string }>(
      "New QR poster issued.",
      `operator/gym-locations/${gymId}/qr-credentials`,
      "POST",
      { reason: "Issue a gym QR poster from the scoped partner workspace." },
    );
    await downloadPosterJpeg(
      credential.printablePosterSvg,
      `${gymName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-gogymgo-poster.jpg`,
    );
  }

  async function revokeQr(gymId: string, gymName: string) {
    if (
      !window.confirm(
        `Revoke the current QR poster for ${gymName}? Members will not be able to use it again.`,
      )
    ) {
      return;
    }
    await onMutate(
      "QR poster revoked.",
      `operator/gym-locations/${gymId}/qr-credentials/revoke`,
      "POST",
      { reason: "Revoke the gym QR poster from the scoped partner workspace." },
    );
  }

  return (
    <div className="admin-shell partner-shell">
      <aside className="sidebar">
        <div className="brand-lockup sidebar-brand">
          <BrandMark />
          <span>
            <BrandWordmark />
            <small>PARTNER PORTAL</small>
          </span>
        </div>
        <nav aria-label="Partner sections" className="desktop-admin-navigation">
          {partnerNavigation.map((item) => (
            <button
              aria-current={section === item.id ? "page" : undefined}
              className={section === item.id ? "nav-item active" : "nav-item"}
              key={item.id}
              onClick={() => setSection(item.id)}
              type="button"
            >
              <span className="nav-short">{item.short}</span>
              <span>{item.label}</span>
              {item.id === "competitions" && proposalsAwaitingReview > 0 ? (
                <b className="nav-count">{proposalsAwaitingReview}</b>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="partner-mobile-navigation">
          {partnerNavigation.map((item) => (
            <button
              aria-current={section === item.id ? "page" : undefined}
              className={section === item.id ? "active" : ""}
              key={item.id}
              onClick={() => setSection(item.id)}
              type="button"
            >
              <span>{item.short}</span>
              {item.label}
            </button>
          ))}
        </div>
        <div className="sidebar-footer">
          <div className="admin-identity">
            <span className="presence-dot" />
            <span>
              <small>GYM PARTNER</small>
              <strong>{snapshot.operator.email}</strong>
            </span>
          </div>
          <button
            className="text-button"
            onClick={() => void onSignOut()}
            type="button"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main aria-busy={busy}>
        <header className="topbar">
          <div className="topbar-heading">
            <p className="eyebrow">PARTNER // {section.toUpperCase()}</p>
            <h1>{activeNavigation.label}</h1>
            <p className="page-context">{activeNavigation.description}</p>
          </div>
          <div className="topbar-actions">
            <span className="health-pill healthy">
              <span aria-hidden="true" />
              SCOPED ACCESS
            </span>
            <button
              className="icon-button"
              disabled={busy}
              onClick={onRefresh}
              type="button"
            >
              {busy ? "SYNCING" : "REFRESH"}
            </button>
          </div>
        </header>

        {error ? (
          <div className="alert error" role="alert">
            <span>!</span>
            <p>{error}</p>
            <button onClick={onDismissError} type="button">
              Dismiss
            </button>
          </div>
        ) : null}

        <div className="workspace">
          {section === "overview" ? (
            <>
              <section className="hero-panel">
                <div>
                  <p className="eyebrow">GYM PARTNER WORKSPACE</p>
                  <h2>Your gyms, without the platform-wide controls.</h2>
                  <p>
                    You can see only assigned locations and visits. Contest
                    proposals remain drafts until GoGymGo reviews and publishes
                    them.
                  </p>
                </div>
                <div className="hero-signal">
                  <span>{snapshot.gyms.length}</span>
                  <small>ASSIGNED GYMS</small>
                </div>
              </section>
              <div className="metric-grid">
                <button
                  className="metric"
                  onClick={() => setSection("gyms")}
                  type="button"
                >
                  <span>LOCATIONS</span>
                  <strong>{snapshot.gyms.length}</strong>
                  <small>Assigned by GoGymGo</small>
                </button>
                <button
                  className="metric"
                  onClick={() => setSection("competitions")}
                  type="button"
                >
                  <span>DRAFT PROPOSALS</span>
                  <strong>{proposalsAwaitingReview}</strong>
                  <small>Awaiting GoGymGo publication</small>
                </button>
                <button
                  className="metric"
                  onClick={() => setSection("visits")}
                  type="button"
                >
                  <span>ACTIVE VISITS</span>
                  <strong>{activeVisits}</strong>
                  <small>QR sessions in progress</small>
                </button>
                <div className="metric static">
                  <span>ACCESS</span>
                  <strong>{adminGyms.length > 0 ? "ADMIN" : "STAFF"}</strong>
                  <small>Enforced per gym</small>
                </div>
              </div>
            </>
          ) : null}

          {section === "gyms" ? (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">ASSIGNED LOCATIONS</p>
                  <h2>My gyms</h2>
                  <p>
                    Location and QR access is restricted independently for every
                    gym.
                  </p>
                </div>
              </div>
              <div className="card-list partner-gym-list">
                {snapshot.gyms.map((gym) => (
                  <article className="competition-card" key={gym.id}>
                    <div className="card-title-row">
                      <div>
                        <span
                          className={`status-tag ${gym.active ? "active" : "cancelled"}`}
                        >
                          {gym.active ? "ACTIVE" : "INACTIVE"}
                        </span>
                        <h3>{gym.name}</h3>
                        <p>{gym.address}</p>
                      </div>
                      <span className="status-tag draft">
                        {gym.accessLevel}
                      </span>
                    </div>
                    <div className="partner-gym-details">
                      <span>
                        Region <strong>{gym.regionCode}</strong>
                      </span>
                      <span>
                        QR poster{" "}
                        <strong>
                          {gym.activeCredentialVersion
                            ? `V${gym.activeCredentialVersion}`
                            : "Not issued"}
                        </strong>
                      </span>
                      <span>
                        Radius <strong>{gym.radiusMeters} m</strong>
                      </span>
                    </div>
                    {gym.accessLevel === "admin" ? (
                      <div className="card-actions">
                        <button
                          className="secondary-button"
                          disabled={submitting || !gym.active}
                          onClick={() => void issueQr(gym.id, gym.name)}
                          type="button"
                        >
                          {gym.activeCredentialVersion
                            ? "REPLACE + DOWNLOAD QR"
                            : "ISSUE + DOWNLOAD QR"}
                        </button>
                        {gym.activeCredentialVersion ? (
                          <button
                            className="danger-button"
                            disabled={submitting}
                            onClick={() => void revokeQr(gym.id, gym.name)}
                            type="button"
                          >
                            REVOKE QR
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {section === "competitions" ? (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">LOCAL CONTEST PROPOSALS</p>
                  <h2>Contests</h2>
                  <p>
                    Partner drafts are limited to an assigned gym. GoGymGo
                    controls rewards, publication, cancellation and settlement.
                  </p>
                </div>
                {adminGyms.length > 0 ? (
                  <button
                    className="primary-button"
                    onClick={() => setCompetitionEditor("new")}
                    type="button"
                  >
                    NEW PROPOSAL
                  </button>
                ) : null}
              </div>
              {snapshot.competitions.length === 0 ? (
                <EmptyState
                  body="Gym administrators can submit the first local contest proposal for GoGymGo review."
                  title="No contest proposals yet"
                />
              ) : (
                <div className="card-list">
                  {snapshot.competitions.map((competition) => {
                    const canEdit =
                      competition.status === "draft" &&
                      adminGyms.some(
                        (gym) => gym.id === competition.gymLocationId,
                      );
                    return (
                      <article
                        className="competition-card"
                        key={competition.id}
                      >
                        <div className="card-title-row">
                          <div>
                            <span
                              className={`status-tag ${competition.status}`}
                            >
                              {competition.status === "draft"
                                ? "AWAITING GOGYMGO REVIEW"
                                : competition.status}
                            </span>
                            <h3>{competition.name}</h3>
                            <p>
                              {competition.gymName} · {competition.regionName}
                            </p>
                          </div>
                        </div>
                        <div className="partner-gym-details">
                          <span>
                            Starts{" "}
                            <strong>{formatDate(competition.startsAt)}</strong>
                          </span>
                          <span>
                            Ends{" "}
                            <strong>{formatDate(competition.endsAt)}</strong>
                          </span>
                          <span>
                            Entrants{" "}
                            <strong>{competition.enrollmentCount}</strong>
                          </span>
                        </div>
                        {canEdit ? (
                          <div className="card-actions">
                            <button
                              className="secondary-button"
                              onClick={() => setCompetitionEditor(competition)}
                              type="button"
                            >
                              EDIT PROPOSAL
                            </button>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          ) : null}

          {section === "visits" ? (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">QR SESSION ACTIVITY</p>
                  <h2>Gym visits</h2>
                  <p>
                    Only sessions recorded at your assigned locations appear
                    here.
                  </p>
                </div>
              </div>
              {snapshot.sessions.length === 0 ? (
                <EmptyState
                  body="QR visits will appear after members scan in."
                  title="No gym visits yet"
                />
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Gym</th>
                        <th>Started</th>
                        <th>Completed</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.sessions.map((session) => (
                        <tr key={session.id}>
                          <td>{session.gymName}</td>
                          <td>{formatDateTime(session.startedAt)}</td>
                          <td>
                            {session.completedAt
                              ? formatDateTime(session.completedAt)
                              : "—"}
                          </td>
                          <td>
                            <span
                              className={`status-tag ${session.incomplete ? "rejected" : session.status}`}
                            >
                              {session.incomplete
                                ? "INCOMPLETE"
                                : session.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}
        </div>
      </main>

      {competitionEditor ? (
        <CompetitionForm
          competition={
            competitionEditor === "new" ? undefined : competitionEditor
          }
          gymLocationId={
            competitionEditor === "new"
              ? adminGyms[0]?.id
              : competitionEditor.gymLocationId
          }
          gyms={adminGyms}
          onClose={() => setCompetitionEditor(null)}
          onSubmit={async (body, editing) => {
            await onMutate(
              editing
                ? "Contest proposal updated."
                : "Contest proposal submitted.",
              editing
                ? `operator/configuration/competitions/${editing.id}`
                : "operator/configuration/competitions",
              editing ? "PUT" : "POST",
              body,
            );
            setCompetitionEditor(null);
          }}
          partnerMode
          regions={snapshot.regions}
          submitting={submitting}
        />
      ) : null}

      {toast ? (
        <div aria-live="polite" className="toast">
          <span>✓</span>
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function Overview({
  activeCompetition,
  health,
  publishReady,
  queue,
  snapshot,
  onNavigate,
}: {
  activeCompetition?: Competition;
  health: SystemHealth | null;
  publishReady: Competition[];
  queue: WorkQueueItem[];
  snapshot: DashboardSnapshot;
  onNavigate: (section: AdminSection) => void;
}) {
  const draftRewards = snapshot.rewards.filter(
    (reward) => reward.status === "draft",
  ).length;
  const healthNeedsAttention =
    health?.database !== "ok" ||
    (health?.worker.status !== "healthy" &&
      health?.worker.status !== "starting");
  const attentionCount = queue.length + (healthNeedsAttention ? 1 : 0);
  const oldestQueueItem = [...queue].sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  )[0];
  const oldestUrgency = oldestQueueItem
    ? getQueueUrgency(oldestQueueItem)
    : null;
  return (
    <>
      <section
        className={attentionCount > 0 ? "hero-panel attention" : "hero-panel"}
      >
        <div>
          <p className="eyebrow">
            {attentionCount > 0 ? "OPERATOR PRIORITY" : "LAUNCH STATUS"}
          </p>
          <h2>
            {queue.length > 0
              ? `${queue.length} review item${queue.length === 1 ? "" : "s"} need attention.`
              : healthNeedsAttention
                ? "System health needs review."
                : activeCompetition
                  ? "A contest is live."
                  : publishReady.length > 0
                    ? "Ready for a controlled launch."
                    : "Build the next contest."}
          </h2>
          <p>
            {queue.length > 0
              ? "Open the human review queue first, then return to launch and publication work."
              : healthNeedsAttention
                ? "Check the worker heartbeat and queue health before making publication changes."
                : activeCompetition
                  ? `${activeCompetition.name} is ${activeCompetition.status} with ${activeCompetition.enrollmentCount} enrolled players.`
                  : publishReady.length > 0
                    ? `${publishReady[0].name} has a published reward and can be released after your final review.`
                    : "No contest is currently public. Add and publish a real reward before releasing a draft to players."}
          </p>
          {oldestQueueItem && oldestUrgency ? (
            <div className="priority-context">
              <span className={`urgency-tag ${oldestUrgency.tone}`}>
                {oldestUrgency.label}
              </span>
              <p>
                Oldest review: {oldestQueueItem.kind.replaceAll("_", " ")} ·{" "}
                {formatQueueAge(oldestQueueItem.createdAt)} in queue
              </p>
            </div>
          ) : null}
          <div className="hero-panel-actions">
            {queue.length > 0 || healthNeedsAttention ? (
              <button
                className="primary-button"
                onClick={() => onNavigate("operations")}
                type="button"
              >
                REVIEW OPERATIONS
              </button>
            ) : null}
            <button
              className="secondary-button"
              onClick={() => onNavigate("competitions")}
              type="button"
            >
              OPEN CONTESTS
            </button>
          </div>
        </div>
        <div className="hero-signal">
          <span>
            {attentionCount > 0
              ? String(attentionCount).padStart(2, "0")
              : activeCompetition
                ? "LIVE"
                : "SAFE"}
          </span>
          <small>
            {attentionCount > 0
              ? "ATTENTION ITEMS"
              : activeCompetition
                ? "PUBLIC STATE"
                : "NO PUBLIC CONTEST"}
          </small>
        </div>
      </section>
      <section className="metric-grid">
        <Metric
          label="CONTESTS"
          onClick={() => onNavigate("competitions")}
          value={snapshot.competitions.length}
        />
        <Metric
          detail={`${draftRewards} draft`}
          label="BRAND REWARDS"
          onClick={() => onNavigate("rewards")}
          value={snapshot.rewards.length}
        />
        <Metric
          detail={`${snapshot.regions.filter((region) => region.competitionEnabled).length} enabled`}
          label="REGIONS"
          onClick={() => onNavigate("regions")}
          value={snapshot.regions.length}
        />
        <Metric
          detail="Awaiting review"
          label="WORK QUEUE"
          onClick={() => onNavigate("operations")}
          value={queue.length}
        />
      </section>
      <section className="two-column">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">PUBLICATION READINESS</p>
              <h3>Contest launch gates</h3>
            </div>
            <button
              className="text-button"
              onClick={() => onNavigate("competitions")}
              type="button"
            >
              View all
            </button>
          </div>
          {snapshot.competitions.length === 0 ? (
            <EmptyState
              body="Create a regional contest draft to begin."
              title="No contests configured"
            />
          ) : (
            <div className="readiness-list">
              {snapshot.competitions.slice(0, 4).map((competition) => (
                <div className="readiness-row" key={competition.id}>
                  <span
                    className={`status-dot ${competition.status}`}
                    aria-hidden="true"
                  />
                  <div>
                    <strong>{competition.name}</strong>
                    <small>
                      {competition.regionName} · {competition.monthKey}
                    </small>
                  </div>
                  <span className={`status-tag ${competition.status}`}>
                    {competition.status}
                  </span>
                  <div className="gate">
                    <small>PUBLISHED REWARDS</small>
                    <strong>{competition.publishedRewardCount}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">SYSTEM HEALTH</p>
              <h3>Operations worker</h3>
            </div>
            <span className={`status-tag ${health?.worker.status ?? "stale"}`}>
              {health?.worker.status ?? "unknown"}
            </span>
          </div>
          <div className="health-detail">
            <div>
              <small>DATABASE</small>
              <strong>{health?.database.toUpperCase() ?? "—"}</strong>
            </div>
            <div>
              <small>HEARTBEAT AGE</small>
              <strong>
                {health?.worker.heartbeatAgeSeconds === null ||
                health?.worker.heartbeatAgeSeconds === undefined
                  ? "—"
                  : `${health.worker.heartbeatAgeSeconds}s`}
              </strong>
            </div>
            <div>
              <small>PENDING NOTIFICATIONS</small>
              <strong>{health?.queues.notificationsPending ?? "—"}</strong>
            </div>
            <div>
              <small>PRIVACY OPERATIONS</small>
              <strong>{health?.queues.privacyOperationsPending ?? "—"}</strong>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Metric({
  detail,
  label,
  value,
  onClick,
}: {
  detail?: string;
  label: string;
  value: number;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={`${label}: ${value}. ${detail || "Open details"}`}
      className="metric"
      onClick={onClick}
      type="button"
    >
      <span>{label}</span>
      <strong>{String(value).padStart(2, "0")}</strong>
      <small>{detail || "Open details"} →</small>
    </button>
  );
}

function CompetitionsPanel({
  competitions,
  onCreate,
  onEdit,
  onNavigate,
  onStatus,
}: {
  competitions: Competition[];
  onCreate: () => void;
  onEdit: (competition: Competition) => void;
  onNavigate: (section: AdminSection) => void;
  onStatus: (competition: Competition, action: "cancel" | "publish") => void;
}) {
  const [query, setQuery] = useStoredPreference(
    "gogymgo.admin.competitions.query",
    "",
  );
  const [statusFilter, setStatusFilter] = useStoredPreference(
    "gogymgo.admin.competitions.status",
    "all",
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filteredCompetitions = competitions.filter((competition) => {
    const matchesStatus =
      statusFilter === "all" || competition.status === statusFilter;
    const matchesQuery =
      !normalizedQuery ||
      [competition.name, competition.regionName, competition.monthKey]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    return matchesStatus && matchesQuery;
  });
  const statusOptions = Array.from(
    new Set(competitions.map((competition) => competition.status)),
  );
  const activeFilters: ActiveFilter[] = [
    ...(query
      ? [{ label: `Search: ${query}`, onClear: () => setQuery("") }]
      : []),
    ...(statusFilter !== "all"
      ? [
          {
            label: `Status: ${statusFilter.replaceAll("_", " ")}`,
            onClear: () => setStatusFilter("all"),
          },
        ]
      : []),
  ];
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">REGIONAL CONTEST CONTROL</p>
          <h2>Contests</h2>
          <p>
            Create drafts, confirm reward readiness and publish to every player
            surface.
          </p>
        </div>
        <button className="primary-button" onClick={onCreate} type="button">
          + NEW CONTEST
        </button>
      </div>
      {competitions.length > 0 ? (
        <div
          aria-label="Filter contests"
          className="panel-toolbar"
          role="search"
        >
          <label className="filter-field">
            <span>SEARCH</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, region or month"
              type="search"
              value={query}
            />
          </label>
          <label className="filter-field compact">
            <span>STATUS</span>
            <select
              onChange={(event) => setStatusFilter(event.target.value)}
              value={statusFilter}
            >
              <option value="all">All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      <FilterChips filters={activeFilters} />
      {competitions.length === 0 ? (
        <EmptyState
          body="Start with a region, schedule, rules and Weekly Goal options."
          title="No contests yet"
        />
      ) : filteredCompetitions.length === 0 ? (
        <EmptyState
          body="Try a different search term or status filter."
          title="No contests match"
        />
      ) : (
        <div className="card-list">
          {filteredCompetitions.map((competition) => {
            const ended = new Date(competition.endsAt) <= new Date();
            const deadline = getCompetitionDeadline(competition);
            const canPublish =
              competition.status === "draft" &&
              !ended &&
              competition.publishedRewardCount > 0;
            const publishGateId = `competition-${competition.id}-publish-gate`;
            const publishBlocker = ended
              ? "The player window has ended."
              : competition.publishedRewardCount === 0
                ? "Publish at least one eligible reward first."
                : "Complete the remaining launch review.";
            return (
              <article className="competition-card" key={competition.id}>
                <div className="card-title-row">
                  <div>
                    <span className={`status-tag ${competition.status}`}>
                      {competition.status}
                    </span>
                    <h3>{competition.name}</h3>
                    <p>
                      {competition.regionName} · {competition.monthKey}
                    </p>
                  </div>
                  <div className="version-badge">V{competition.version}</div>
                </div>
                <div className="competition-stats">
                  <div>
                    <small>PLAYER WINDOW</small>
                    <strong>
                      {formatDate(competition.startsAt)} —{" "}
                      {formatDate(competition.endsAt)}
                    </strong>
                  </div>
                  <div>
                    <small>ENROLLED</small>
                    <strong>{competition.enrollmentCount}</strong>
                  </div>
                  <div>
                    <small>GOALS</small>
                    <strong>
                      {competition.goalBrackets
                        .map((goal) => goal.goalDays)
                        .join(", ")}{" "}
                      DAYS
                    </strong>
                  </div>
                  <div>
                    <small>REWARD GATE</small>
                    <strong
                      className={
                        competition.publishedRewardCount > 0
                          ? "positive"
                          : "warning-text"
                      }
                    >
                      {competition.publishedRewardCount > 0
                        ? `${competition.publishedRewardCount} PUBLISHED`
                        : "REWARD REQUIRED"}
                    </strong>
                  </div>
                  <div>
                    <small>NEXT DEADLINE</small>
                    <div className="deadline-stack">
                      <span className={`deadline-tag ${deadline.tone}`}>
                        {deadline.label}
                      </span>
                      <small>{deadline.detail}</small>
                    </div>
                  </div>
                </div>
                {competition.status === "draft" && !canPublish ? (
                  <div className="action-guidance" id={publishGateId}>
                    <span>
                      <strong>PUBLISH BLOCKED</strong>
                      {publishBlocker}
                    </span>
                    {competition.publishedRewardCount === 0 ? (
                      <button
                        className="resolution-link"
                        onClick={() => onNavigate("rewards")}
                        type="button"
                      >
                        RESOLVE IN REWARDS →
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <div className="card-actions">
                  {competition.status === "draft" ? (
                    <button
                      className="secondary-button"
                      onClick={() => onEdit(competition)}
                      type="button"
                    >
                      EDIT DRAFT
                    </button>
                  ) : null}
                  {competition.status === "draft" ? (
                    <button
                      className="primary-button"
                      aria-describedby={!canPublish ? publishGateId : undefined}
                      disabled={!canPublish}
                      onClick={() => onStatus(competition, "publish")}
                      type="button"
                    >
                      PUBLISH
                    </button>
                  ) : null}
                  {["draft", "registration"].includes(competition.status) ? (
                    <button
                      className="danger-button"
                      onClick={() => onStatus(competition, "cancel")}
                      type="button"
                    >
                      CANCEL
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function RewardsPanel({
  onCouponCodes,
  onCreate,
  onEdit,
  onStatus,
  rewards,
}: {
  onCouponCodes: (reward: Reward) => void;
  onCreate: () => void;
  onEdit: (reward: Reward) => void;
  onStatus: (reward: Reward, action: "archive" | "publish") => void;
  rewards: Reward[];
}) {
  const [query, setQuery] = useStoredPreference(
    "gogymgo.admin.rewards.query",
    "",
  );
  const [statusFilter, setStatusFilter] = useStoredPreference(
    "gogymgo.admin.rewards.status",
    "all",
  );
  const [density, setDensity] = useStoredPreference<"comfortable" | "compact">(
    "gogymgo.admin.rewards.density",
    "comfortable",
  );
  const [visibleColumns, setVisibleColumns] = useStoredPreference<string[]>(
    "gogymgo.admin.rewards.columns",
    ["competition", "type", "inventory"],
  );
  const [page, setPage] = useState(1);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRewards = rewards.filter((reward) => {
    const matchesStatus =
      statusFilter === "all" || reward.status === statusFilter;
    const matchesQuery =
      !normalizedQuery ||
      [reward.title, reward.sponsorName, reward.competitionName]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    return matchesStatus && matchesQuery;
  });
  const statusOptions = Array.from(
    new Set(rewards.map((reward) => reward.status)),
  );
  const visibleColumnSet = new Set(visibleColumns);
  const pageSize = density === "compact" ? 12 : 8;
  const pageCount = Math.max(1, Math.ceil(filteredRewards.length / pageSize));
  const visiblePage = Math.min(page, pageCount);
  const pagedRewards = filteredRewards.slice(
    (visiblePage - 1) * pageSize,
    visiblePage * pageSize,
  );
  const activeFilters: ActiveFilter[] = [
    ...(query
      ? [{ label: `Search: ${query}`, onClear: () => setQuery("") }]
      : []),
    ...(statusFilter !== "all"
      ? [
          {
            label: `Status: ${statusFilter.replaceAll("_", " ")}`,
            onClear: () => setStatusFilter("all"),
          },
        ]
      : []),
  ];
  function toggleColumn(column: string) {
    setVisibleColumns(
      visibleColumnSet.has(column)
        ? visibleColumns.filter((item) => item !== column)
        : [...visibleColumns, column],
    );
  }
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">BRAND REWARD CATALOG</p>
          <h2>Rewards</h2>
          <p>
            Only real, in-stock published rewards can unlock a contest
            launch.
          </p>
        </div>
        <button className="primary-button" onClick={onCreate} type="button">
          + NEW REWARD
        </button>
      </div>
      {rewards.length > 0 ? (
        <div
          aria-label="Filter rewards"
          className="panel-toolbar"
          role="search"
        >
          <label className="filter-field">
            <span>SEARCH</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Reward, sponsor or contest"
              type="search"
              value={query}
            />
          </label>
          <label className="filter-field compact">
            <span>STATUS</span>
            <select
              onChange={(event) => setStatusFilter(event.target.value)}
              value={statusFilter}
            >
              <option value="all">All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      <FilterChips filters={activeFilters} />
      {rewards.length === 0 ? (
        <EmptyState
          body="Create the first verified brand reward, then publish it before releasing a contest."
          title="No brand rewards configured"
        />
      ) : filteredRewards.length === 0 ? (
        <EmptyState
          body="Try a different search term or status filter."
          title="No rewards match"
        />
      ) : (
        <>
          <div className="data-view-controls">
            <div
              aria-label="Table density"
              className="density-control"
              role="group"
            >
              <button
                aria-pressed={density === "comfortable"}
                onClick={() => setDensity("comfortable")}
                type="button"
              >
                COMFORTABLE
              </button>
              <button
                aria-pressed={density === "compact"}
                onClick={() => setDensity("compact")}
                type="button"
              >
                COMPACT
              </button>
            </div>
            <details className="column-menu">
              <summary>COLUMNS</summary>
              <div>
                {[
                  ["competition", "Contest"],
                  ["type", "Type"],
                  ["inventory", "Inventory"],
                ].map(([value, label]) => (
                  <label key={value}>
                    <input
                      checked={visibleColumnSet.has(value)}
                      onChange={() => toggleColumn(value)}
                      type="checkbox"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </details>
            <span>{filteredRewards.length} RESULTS</span>
          </div>
          <div
            aria-label="Rewards table, scroll horizontally for more columns"
            className={`table-wrap ${density}`}
            role="region"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Reward</th>
                  {visibleColumnSet.has("competition") ? (
                    <th scope="col">Contest</th>
                  ) : null}
                  {visibleColumnSet.has("type") ? (
                    <th scope="col">Type</th>
                  ) : null}
                  {visibleColumnSet.has("inventory") ? (
                    <th scope="col">Inventory</th>
                  ) : null}
                  <th scope="col">Status</th>
                  <th
                    aria-label="Frozen actions"
                    className="sticky-action-column"
                    scope="col"
                  />
                </tr>
              </thead>
              <tbody>
                {pagedRewards.map((reward) => {
                  const couponReady =
                    reward.rewardType !== "coupon" ||
                    reward.couponCodeCount > 0;
                  const publishGateId = `reward-${reward.id}-publish-gate`;
                  return (
                    <tr key={reward.id}>
                      <td>
                        <strong>{reward.title}</strong>
                        <small>{reward.sponsorName}</small>
                      </td>
                      {visibleColumnSet.has("competition") ? (
                        <td>{reward.competitionName}</td>
                      ) : null}
                      {visibleColumnSet.has("type") ? (
                        <td>{reward.rewardType}</td>
                      ) : null}
                      {visibleColumnSet.has("inventory") ? (
                        <td>
                          {reward.rewardType === "coupon"
                            ? `${reward.couponCodeCount} / ${reward.inventoryTotal} codes`
                            : `${reward.inventoryTotal} units`}
                        </td>
                      ) : null}
                      <td className="sticky-action-column">
                        <span className={`status-tag ${reward.status}`}>
                          {reward.status}
                        </span>
                      </td>
                      <td>
                        <div className="inline-actions">
                          {reward.status === "draft" ? (
                            <button
                              className="text-button"
                              onClick={() => onEdit(reward)}
                              type="button"
                            >
                              Edit
                            </button>
                          ) : null}
                          {reward.rewardType === "coupon" &&
                          reward.status === "draft" ? (
                            <button
                              className="text-button"
                              onClick={() => onCouponCodes(reward)}
                              type="button"
                            >
                              Resolve: add codes
                            </button>
                          ) : null}
                          {reward.status === "draft" ? (
                            <>
                              {!couponReady ? (
                                <span
                                  className="action-guidance compact"
                                  id={publishGateId}
                                >
                                  Add coupon codes before publishing.
                                </span>
                              ) : null}
                              <button
                                aria-describedby={
                                  !couponReady ? publishGateId : undefined
                                }
                                className="text-button accent"
                                disabled={!couponReady}
                                onClick={() => onStatus(reward, "publish")}
                                type="button"
                              >
                                Publish
                              </button>
                            </>
                          ) : null}
                          {reward.status === "published" ? (
                            <button
                              className="text-button danger-text"
                              onClick={() => onStatus(reward, "archive")}
                              type="button"
                            >
                              Archive
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            onNext={() => setPage(Math.min(pageCount, visiblePage + 1))}
            onPrevious={() => setPage(Math.max(1, visiblePage - 1))}
            page={visiblePage}
            pageCount={pageCount}
          />
        </>
      )}
    </section>
  );
}

function RegionsPanel({
  onCreate,
  regions,
}: {
  onCreate: () => void;
  regions: RegionPolicy[];
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">AUTHORITATIVE LOCATION BOUNDARIES</p>
          <h2>Regional policies</h2>
          <p>
            Immutable, time-bounded geographic rules decide which contests a
            player may enter.
          </p>
        </div>
        <button className="primary-button" onClick={onCreate} type="button">
          + NEW REGION POLICY
        </button>
      </div>
      {regions.length === 0 ? (
        <EmptyState
          body="Create the first time-bounded regional policy before configuring a contest."
          title="No regional policies configured"
        />
      ) : (
        <div className="card-list">
          {regions.map((region) => (
            <article className="region-card" key={region.id}>
              <div className="region-code">{region.code}</div>
              <div>
                <span
                  className={`status-tag ${region.competitionEnabled ? "active" : "archived"}`}
                >
                  {region.competitionEnabled
                    ? "contest enabled"
                    : "disabled"}
                </span>
                <h3>{region.metroName}</h3>
                <p>
                  {region.countryCode}-{region.subdivisionCode} ·{" "}
                  {region.timezone}
                </p>
              </div>
              <dl>
                <div>
                  <dt>POLICY</dt>
                  <dd>{region.policyVersion}</dd>
                </div>
                <div>
                  <dt>BOUNDARY</dt>
                  <dd>{region.boundaryVersion}</dd>
                </div>
                <div>
                  <dt>MINIMUM AGE</dt>
                  <dd>{region.minimumAge}</dd>
                </div>
                <div>
                  <dt>VALID FROM</dt>
                  <dd>{formatDate(region.validFrom)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ContentPanel({
  creatorFeaturesEnabled,
  documents,
  onCreateDocument,
  onCreateWorkout,
  onEditWorkout,
  onWithdrawDocument,
  onWorkoutStatus,
  workouts,
}: {
  creatorFeaturesEnabled: boolean;
  documents: LegalDocument[];
  onCreateDocument: () => void;
  onCreateWorkout: () => void;
  onEditWorkout: (workout: CreatorWorkout) => void;
  onWithdrawDocument: (document: LegalDocument) => void;
  onWorkoutStatus: (
    workout: CreatorWorkout,
    action: "publish" | "unpublish",
  ) => void;
  workouts: CreatorWorkout[];
}) {
  const [legalDensity, setLegalDensity] = useStoredPreference<
    "comfortable" | "compact"
  >("gogymgo.admin.legal.density", "comfortable");
  const [legalColumns, setLegalColumns] = useStoredPreference<string[]>(
    "gogymgo.admin.legal.columns",
    ["scope", "effective", "approval"],
  );
  const [legalPage, setLegalPage] = useState(1);
  const legalColumnSet = new Set(legalColumns);
  const legalPageSize = legalDensity === "compact" ? 12 : 8;
  const legalPageCount = Math.max(
    1,
    Math.ceil(documents.length / legalPageSize),
  );
  const visibleLegalPage = Math.min(legalPage, legalPageCount);
  const pagedDocuments = documents.slice(
    (visibleLegalPage - 1) * legalPageSize,
    visibleLegalPage * legalPageSize,
  );
  function toggleLegalColumn(column: string) {
    setLegalColumns(
      legalColumnSet.has(column)
        ? legalColumns.filter((item) => item !== column)
        : [...legalColumns, column],
    );
  }
  return (
    <div className="section-stack">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">CREATOR WORKOUT CATALOG</p>
            <h2>Workout content</h2>
            <p>
              Review the approved workout catalog and control what members can
              access.
            </p>
          </div>
          <button
            className="primary-button"
            disabled={!creatorFeaturesEnabled}
            onClick={onCreateWorkout}
            type="button"
          >
            {creatorFeaturesEnabled ? "+ NEW WORKOUT" : "PROGRAM PAUSED"}
          </button>
        </div>
        {!creatorFeaturesEnabled ? (
          <div className="alert warning compact">
            <span>!</span>
            <p>
              Creator features are disabled for the current release. Existing
              catalog records stay available for administrative review, but
              creator-workout changes are disabled.
            </p>
          </div>
        ) : null}
        {workouts.length === 0 ? (
          <EmptyState
            body={
              creatorFeaturesEnabled
                ? "Add approved creator videos and choose exactly where they may appear."
                : "No Creator workouts are configured. Catalog controls remain locked while the program is paused."
            }
            title={
              creatorFeaturesEnabled
                ? "No Creator workouts"
                : "Creator program paused"
            }
          />
        ) : (
          <div className="compact-list">
            {workouts.map((workout) => (
              <div className="compact-row" key={workout.id}>
                <div>
                  <span
                    className={`status-dot ${workout.published ? "active" : "draft"}`}
                  />
                  <strong>{workout.title}</strong>
                  <small>
                    {workout.creatorName} · {workout.durationMinutes} min ·{" "}
                    {workout.regionCodes.join(", ")}
                  </small>
                </div>
                <div className="inline-actions">
                  {!workout.published ? (
                    <button
                      className="text-button"
                      disabled={!creatorFeaturesEnabled}
                      onClick={() => onEditWorkout(workout)}
                      type="button"
                    >
                      Edit
                    </button>
                  ) : null}
                  <button
                    className={
                      workout.published
                        ? "text-button danger-text"
                        : "text-button accent"
                    }
                    disabled={!creatorFeaturesEnabled}
                    onClick={() =>
                      onWorkoutStatus(
                        workout,
                        workout.published ? "unpublish" : "publish",
                      )
                    }
                    type="button"
                  >
                    {workout.published ? "Unpublish" : "Publish"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">SERVER-AUTHORITATIVE LEGAL TEXT</p>
            <h2>Legal documents</h2>
            <p>
              Publish approved, versioned policy text and withdraw superseded
              releases.
            </p>
          </div>
          <button
            className="primary-button"
            onClick={onCreateDocument}
            type="button"
          >
            + PUBLISH VERSION
          </button>
        </div>
        {documents.length === 0 ? (
          <EmptyState
            body="Publish the first owner-approved document version when the legal text is ready."
            title="No legal documents published"
          />
        ) : (
          <>
            <div className="data-view-controls">
              <div
                aria-label="Table density"
                className="density-control"
                role="group"
              >
                <button
                  aria-pressed={legalDensity === "comfortable"}
                  onClick={() => setLegalDensity("comfortable")}
                  type="button"
                >
                  COMFORTABLE
                </button>
                <button
                  aria-pressed={legalDensity === "compact"}
                  onClick={() => setLegalDensity("compact")}
                  type="button"
                >
                  COMPACT
                </button>
              </div>
              <details className="column-menu">
                <summary>COLUMNS</summary>
                <div>
                  {[
                    ["scope", "Scope"],
                    ["effective", "Effective"],
                    ["approval", "Owner approval"],
                  ].map(([value, label]) => (
                    <label key={value}>
                      <input
                        checked={legalColumnSet.has(value)}
                        onChange={() => toggleLegalColumn(value)}
                        type="checkbox"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </details>
              <span>{documents.length} RESULTS</span>
            </div>
            <div
              aria-label="Legal documents table, scroll horizontally for more columns"
              className={`table-wrap ${legalDensity}`}
              role="region"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th scope="col">Document</th>
                    {legalColumnSet.has("scope") ? (
                      <th scope="col">Scope</th>
                    ) : null}
                    <th scope="col">Version</th>
                    {legalColumnSet.has("effective") ? (
                      <th scope="col">Effective</th>
                    ) : null}
                    {legalColumnSet.has("approval") ? (
                      <th scope="col">Owner approval</th>
                    ) : null}
                    <th scope="col">Status</th>
                    <th
                      aria-label="Frozen actions"
                      className="sticky-action-column"
                      scope="col"
                    />
                  </tr>
                </thead>
                <tbody>
                  {pagedDocuments.map((document) => (
                    <tr key={document.id}>
                      <td>
                        <strong>{document.title}</strong>
                        <small>{document.documentKey}</small>
                      </td>
                      {legalColumnSet.has("scope") ? (
                        <td>
                          {document.jurisdictionCode} · {document.locale}
                        </td>
                      ) : null}
                      <td>{document.version}</td>
                      {legalColumnSet.has("effective") ? (
                        <td>{formatDate(document.effectiveAt)}</td>
                      ) : null}
                      {legalColumnSet.has("approval") ? (
                        <td>
                          <span
                            className={`status-tag ${document.ownerApprovedAt ? "active" : "draft"}`}
                          >
                            {document.ownerApprovedAt
                              ? "approved"
                              : "not approved"}
                          </span>
                        </td>
                      ) : null}
                      <td className="sticky-action-column">
                        <span className={`status-tag ${document.status}`}>
                          {document.status}
                        </span>
                      </td>
                      <td>
                        {document.status !== "withdrawn" ? (
                          <button
                            className="text-button danger-text"
                            onClick={() => onWithdrawDocument(document)}
                            type="button"
                          >
                            Withdraw
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              onNext={() =>
                setLegalPage(Math.min(legalPageCount, visibleLegalPage + 1))
              }
              onPrevious={() => setLegalPage(Math.max(1, visibleLegalPage - 1))}
              page={visibleLegalPage}
              pageCount={legalPageCount}
            />
          </>
        )}
      </section>
    </div>
  );
}

function OperationsPanel({
  events,
  health,
  onNavigate,
  queue,
}: {
  events: AuditEvent[];
  health: SystemHealth | null;
  onNavigate: (section: AdminSection) => void;
  queue: WorkQueueItem[];
}) {
  const [kindFilter, setKindFilter] = useStoredPreference(
    "gogymgo.admin.operations.kind",
    "all",
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const kindOptions = Array.from(new Set(queue.map((item) => item.kind)));
  const filteredQueue = queue.filter(
    (item) => kindFilter === "all" || item.kind === kindFilter,
  );
  const selectedItem = queue.find((item) => item.id === selectedId) ?? null;
  const selectedDestination = selectedItem
    ? queueDestination(selectedItem.kind)
    : null;
  const selectedUrgency = selectedItem ? getQueueUrgency(selectedItem) : null;
  const selectedHistory = selectedItem
    ? events
        .filter(
          (event) =>
            event.entityId === selectedItem.id ||
            event.reason.toLowerCase().includes(selectedItem.id.toLowerCase()),
        )
        .slice(0, 3)
    : [];
  const activeFilters: ActiveFilter[] =
    kindFilter === "all"
      ? []
      : [
          {
            label: `Type: ${kindFilter.replaceAll("_", " ")}`,
            onClear: () => setKindFilter("all"),
          },
        ];
  return (
    <div className="section-stack">
      <section className="metric-grid">
        <MetricCard label="WORKER" value={health?.worker.status ?? "unknown"} />
        <MetricCard label="QUEUE ITEMS" value={queue.length} />
        <MetricCard
          label="NOTIFICATIONS"
          value={health?.queues.notificationsPending ?? "—"}
        />
        <MetricCard
          label="PRIVACY JOBS"
          value={health?.queues.privacyOperationsPending ?? "—"}
        />
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">HUMAN REVIEW QUEUE</p>
            <h2>Items requiring attention</h2>
            <p>Select a record to see its routing details and next step.</p>
          </div>
        </div>
        {queue.length > 0 ? (
          <div
            aria-label="Filter work queue"
            className="panel-toolbar compact"
            role="search"
          >
            <label className="filter-field compact">
              <span>ITEM TYPE</span>
              <select
                onChange={(event) => setKindFilter(event.target.value)}
                value={kindFilter}
              >
                <option value="all">All review types</option>
                {kindOptions.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        <FilterChips filters={activeFilters} />
        {queue.length === 0 ? (
          <EmptyState
            body="Nothing is waiting for operator review."
            title="Queue clear"
          />
        ) : filteredQueue.length === 0 ? (
          <EmptyState
            body="Choose another review type to see queued records."
            title="No items match"
          />
        ) : (
          <div className="queue-workspace">
            <div className="compact-list">
              {filteredQueue.map((item) => (
                <button
                  aria-pressed={selectedId === item.id}
                  className={
                    selectedId === item.id
                      ? "compact-row queue-row selected"
                      : "compact-row queue-row"
                  }
                  key={`${item.kind}-${item.id}`}
                  onClick={() => setSelectedId(item.id)}
                  type="button"
                >
                  <div>
                    <span className={`status-dot ${item.status}`} />
                    <strong>{item.kind.replaceAll("_", " ")}</strong>
                    <small>
                      {item.regionCode ? `${item.regionCode} · ` : ""}
                      {formatDateTime(item.createdAt)}
                    </small>
                  </div>
                  <span>
                    {(() => {
                      const urgency = getQueueUrgency(item);
                      return (
                        <span className={`urgency-tag ${urgency.tone}`}>
                          {urgency.label}
                        </span>
                      );
                    })()}
                    <span className={`status-tag ${item.status}`}>
                      {item.status}
                    </span>
                    <small>{formatQueueAge(item.createdAt)} waiting</small>
                    <small className="queue-row-action">REVIEW →</small>
                  </span>
                </button>
              ))}
            </div>
            <aside aria-live="polite" className="queue-review-panel">
              {selectedItem ? (
                <>
                  <p className="eyebrow">SELECTED REVIEW ITEM</p>
                  <div className="queue-review-title">
                    <h3>{selectedItem.kind.replaceAll("_", " ")}</h3>
                    {selectedUrgency ? (
                      <span className={`urgency-tag ${selectedUrgency.tone}`}>
                        {selectedUrgency.label}
                      </span>
                    ) : null}
                  </div>
                  <dl>
                    <div>
                      <dt>STATUS</dt>
                      <dd>{selectedItem.status.replaceAll("_", " ")}</dd>
                    </div>
                    <div>
                      <dt>CREATED</dt>
                      <dd>
                        {formatDateTime(selectedItem.createdAt)} ·{" "}
                        {formatQueueAge(selectedItem.createdAt)} ago
                      </dd>
                    </div>
                    {selectedItem.regionCode ? (
                      <div>
                        <dt>REGION</dt>
                        <dd>{selectedItem.regionCode}</dd>
                      </div>
                    ) : null}
                    {selectedItem.verificationMethod ? (
                      <div>
                        <dt>VERIFICATION</dt>
                        <dd>
                          {selectedItem.verificationMethod.replaceAll("_", " ")}
                        </dd>
                      </div>
                    ) : null}
                    <div className="wide">
                      <dt>RECORD ID</dt>
                      <dd className="record-id">{selectedItem.id}</dd>
                    </div>
                  </dl>
                  <section className="queue-review-history">
                    <span>RELATED AUDIT EVIDENCE</span>
                    {selectedHistory.length > 0 ? (
                      selectedHistory.map((event) => (
                        <div key={event.id}>
                          <strong>{event.action.replaceAll("_", " ")}</strong>
                          <small>
                            {formatDateTime(event.createdAt)} ·{" "}
                            {event.actorEmail || "SYSTEM"}
                          </small>
                          <p>{event.reason}</p>
                        </div>
                      ))
                    ) : (
                      <p>
                        No related ledger event is available yet. Use the record
                        ID above while completing the review.
                      </p>
                    )}
                  </section>
                  {selectedDestination ? (
                    <button
                      className="primary-button full"
                      onClick={() => onNavigate(selectedDestination)}
                      type="button"
                    >
                      OPEN{" "}
                      {navigation
                        .find((item) => item.id === selectedDestination)
                        ?.label.toUpperCase()}
                    </button>
                  ) : (
                    <p className="queue-review-note">
                      Keep this record ID visible while completing the
                      authorized review action, then refresh the queue.
                    </p>
                  )}
                </>
              ) : (
                <div className="queue-review-empty">
                  <span>→</span>
                  <strong>Select a queue item</strong>
                  <p>
                    Its status, routing details, and record ID will appear here.
                  </p>
                </div>
              )}
            </aside>
          </div>
        )}
      </section>
    </div>
  );
}

function queueDestination(kind: string): AdminSection | null {
  if (kind === "workout_session" || kind === "partner_application") {
    return "pilot";
  }
  if (kind === "region_verification") return "regions";
  return null;
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="metric static">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>AUTHORITATIVE STATE</small>
    </div>
  );
}

function AuditPanel({ events }: { events: AuditEvent[] }) {
  const [query, setQuery] = useStoredPreference(
    "gogymgo.admin.audit.query",
    "",
  );
  const [actorFilter, setActorFilter] = useStoredPreference(
    "gogymgo.admin.audit.actor",
    "all",
  );
  const [page, setPage] = useState(1);
  const normalizedQuery = query.trim().toLowerCase();
  const actorOptions = Array.from(
    new Set(events.map((event) => event.actorEmail || "SYSTEM")),
  );
  const filteredEvents = events.filter((event) => {
    const actor = event.actorEmail || "SYSTEM";
    const matchesActor = actorFilter === "all" || actor === actorFilter;
    const matchesQuery =
      !normalizedQuery ||
      [event.action, event.reason, event.entityType, event.entityId, actor]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    return matchesActor && matchesQuery;
  });
  const pageSize = 12;
  const pageCount = Math.max(1, Math.ceil(filteredEvents.length / pageSize));
  const visiblePage = Math.min(page, pageCount);
  const pagedEvents = filteredEvents.slice(
    (visiblePage - 1) * pageSize,
    visiblePage * pageSize,
  );
  const activeFilters: ActiveFilter[] = [
    ...(query
      ? [{ label: `Search: ${query}`, onClear: () => setQuery("") }]
      : []),
    ...(actorFilter !== "all"
      ? [
          {
            label: `Actor: ${actorFilter}`,
            onClear: () => setActorFilter("all"),
          },
        ]
      : []),
  ];
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">APPEND-ONLY LEDGER</p>
          <h2>Audit history</h2>
          <p>
            The latest 100 administrative decisions, including who acted and
            why.
          </p>
        </div>
      </div>
      {events.length > 0 ? (
        <div
          aria-label="Filter audit history"
          className="panel-toolbar"
          role="search"
        >
          <label className="filter-field">
            <span>SEARCH</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Action, reason, entity or record ID"
              type="search"
              value={query}
            />
          </label>
          <label className="filter-field compact">
            <span>ACTOR</span>
            <select
              onChange={(event) => setActorFilter(event.target.value)}
              value={actorFilter}
            >
              <option value="all">All actors</option>
              {actorOptions.map((actor) => (
                <option key={actor} value={actor}>
                  {actor}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      <FilterChips filters={activeFilters} />
      {events.length === 0 ? (
        <EmptyState
          body="Administrative decisions will appear here after the first recorded change."
          title="No audit events recorded"
        />
      ) : filteredEvents.length === 0 ? (
        <EmptyState
          body="Try a different search term or actor filter."
          title="No audit events match"
        />
      ) : (
        <>
          <div className="timeline">
            {pagedEvents.map((event) => (
              <article key={event.id}>
                <div aria-hidden="true" className="timeline-node" />
                <div>
                  <div className="timeline-heading">
                    <strong>{event.action.replaceAll("_", " ")}</strong>
                    <time dateTime={event.createdAt}>
                      {formatDateTime(event.createdAt)}
                    </time>
                  </div>
                  <p>{event.reason}</p>
                  <AuditDiff event={event} />
                  <small>
                    {event.actorEmail || "SYSTEM"} · {event.entityType} ·{" "}
                    {event.entityId.slice(0, 8)}
                  </small>
                </div>
              </article>
            ))}
          </div>
          <Pagination
            onNext={() => setPage(Math.min(pageCount, visiblePage + 1))}
            onPrevious={() => setPage(Math.max(1, visiblePage - 1))}
            page={visiblePage}
            pageCount={pageCount}
          />
        </>
      )}
    </section>
  );
}

function FilterChips({ filters }: { filters: ActiveFilter[] }) {
  if (filters.length === 0) return null;
  return (
    <div aria-label="Active filters" className="filter-chips">
      {filters.map((filter) => (
        <button key={filter.label} onClick={filter.onClear} type="button">
          {filter.label} <span aria-hidden="true">×</span>
        </button>
      ))}
      <span>Saved on this device</span>
    </div>
  );
}

function Pagination({
  onNext,
  onPrevious,
  page,
  pageCount,
}: {
  onNext: () => void;
  onPrevious: () => void;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Table pages" className="pagination">
      <button disabled={page <= 1} onClick={onPrevious} type="button">
        ← PREVIOUS
      </button>
      <span>
        PAGE {page} OF {pageCount}
      </span>
      <button disabled={page >= pageCount} onClick={onNext} type="button">
        NEXT →
      </button>
    </nav>
  );
}

function AuditDiff({ event }: { event: AuditEvent }) {
  const change = getAuditChange(event);
  return (
    <div aria-label="Recorded state change" className="audit-diff">
      <div>
        <span>BEFORE</span>
        <strong>{change.before}</strong>
      </div>
      <b aria-hidden="true">→</b>
      <div>
        <span>AFTER</span>
        <strong>{change.after}</strong>
      </div>
    </div>
  );
}

export function CompetitionForm({
  competition,
  gymLocationId,
  gyms,
  onClose,
  onSubmit,
  partnerMode = false,
  regions,
  submitting,
}: {
  competition?: Competition;
  gymLocationId?: string;
  gyms?: { id: string; name: string; regionPolicyId: string }[];
  onClose: () => void;
  onSubmit: (
    body: Record<string, unknown>,
    editing?: Competition,
  ) => Promise<void>;
  partnerMode?: boolean;
  regions: RegionPolicy[];
  submitting: boolean;
}) {
  const dates = defaultCompetitionDates();
  const [formError, setFormError] = useState("");
  const [selectedGymId, setSelectedGymId] = useState(
    gymLocationId ?? gyms?.[0]?.id ?? "",
  );
  const selectedGym = gyms?.find((gym) => gym.id === selectedGymId);
  const selectableRegions =
    partnerMode && selectedGym
      ? regions.filter((region) => region.id === selectedGym.regionPolicyId)
      : regions;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const form = new FormData(event.currentTarget);
    try {
      const goalDays = String(form.get("goalDays") ?? "")
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7);
      if (goalDays.length === 0)
        throw new AdminUserFacingError("Add at least one Weekly Goal.");
      const body: Record<string, unknown> = {
        endsAt: toIso(form, "endsAt"),
        entrantCap: optionalNumber(form.get("entrantCap")),
        goalBrackets: [...new Set(goalDays)].map((goal) => ({
          goalDays: goal,
          label: `${goal} DAY${goal === 1 ? "" : "S"} / WEEK`,
        })),
        minimumEntrants: Number(form.get("minimumEntrants")),
        ...(gyms
          ? { gymLocationId: String(form.get("gymLocationId") ?? "") }
          : {}),
        monthKey: String(form.get("monthKey")),
        name: String(form.get("name")),
        reason: String(form.get("reason")),
        regionPolicyId: String(form.get("regionPolicyId")),
        registrationClosesAt: toIso(form, "registrationClosesAt"),
        registrationOpensAt: toIso(form, "registrationOpensAt"),
        rules: partnerMode
          ? (competition?.rules ?? defaultCompetitionRules)
          : JSON.parse(String(form.get("rules"))),
        rulesVersion: partnerMode
          ? (competition?.rulesVersion ?? "partner-proposal-v1")
          : String(form.get("rulesVersion")),
        startsAt: toIso(form, "startsAt"),
        ...(competition ? { expectedVersion: competition.version } : {}),
      };
      await onSubmit(body, competition);
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }
  return (
    <ModalShell
      onClose={onClose}
      title={
        partnerMode
          ? competition
            ? "Edit contest proposal"
            : "New contest proposal"
          : competition
            ? "Edit contest draft"
            : "New contest draft"
      }
    >
      <form className="editor-form" onSubmit={(event) => void submit(event)}>
        <FormGrid>
          {gyms ? (
            <Field label="GYM">
              <select
                onChange={(event) => setSelectedGymId(event.target.value)}
                name="gymLocationId"
                required
                value={selectedGymId}
              >
                <option value="">Select a gym</option>
                {gyms.map((gym) => (
                  <option key={gym.id} value={gym.id}>
                    {gym.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label="REGION POLICY">
            <select
              defaultValue={
                competition?.regionPolicyId ?? selectedGym?.regionPolicyId
              }
              key={selectedGymId}
              name="regionPolicyId"
              required
            >
              <option value="">Select a region</option>
              {selectableRegions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.metroName} · {region.policyVersion}
                </option>
              ))}
            </select>
          </Field>
          <Field label="CONTEST MONTH">
            <input
              defaultValue={competition?.monthKey ?? dates.monthKey}
              name="monthKey"
              pattern="\d{4}-\d{2}"
              required
            />
          </Field>
          <Field label="NAME" wide>
            <input defaultValue={competition?.name} name="name" required />
          </Field>
          {!partnerMode ? (
            <Field label="RULES VERSION">
              <input
                defaultValue={
                  competition?.rulesVersion ?? `${dates.monthKey}-v1`
                }
                name="rulesVersion"
                required
              />
            </Field>
          ) : null}
          <Field label="WEEKLY GOALS">
            <input
              defaultValue={
                competition?.goalBrackets
                  .map((goal) => goal.goalDays)
                  .join(", ") ?? "1, 2, 3, 4, 5, 6, 7"
              }
              name="goalDays"
              required
            />
          </Field>
          <Field label="MINIMUM ENTRANTS">
            <input
              defaultValue={competition?.minimumEntrants ?? 2}
              min={2}
              name="minimumEntrants"
              required
              type="number"
            />
          </Field>
          <Field label="ENTRANT CAP (OPTIONAL)">
            <input
              defaultValue={competition?.entrantCap ?? ""}
              min={2}
              name="entrantCap"
              type="number"
            />
          </Field>
          <Field label="REGISTRATION OPENS">
            <input
              defaultValue={toLocalDateTime(
                competition?.registrationOpensAt ?? dates.registrationOpensAt,
              )}
              name="registrationOpensAt"
              required
              type="datetime-local"
            />
          </Field>
          <Field label="REGISTRATION CLOSES">
            <input
              defaultValue={toLocalDateTime(
                competition?.registrationClosesAt ?? dates.startsAt,
              )}
              name="registrationClosesAt"
              required
              type="datetime-local"
            />
          </Field>
          <Field label="CONTEST STARTS">
            <input
              defaultValue={toLocalDateTime(
                competition?.startsAt ?? dates.startsAt,
              )}
              name="startsAt"
              required
              type="datetime-local"
            />
          </Field>
          <Field label="CONTEST ENDS">
            <input
              defaultValue={toLocalDateTime(
                competition?.endsAt ?? dates.endsAt,
              )}
              name="endsAt"
              required
              type="datetime-local"
            />
          </Field>
          {!partnerMode ? (
            <Field label="SCORING + VERIFICATION RULES (JSON)" wide>
              <textarea
                defaultValue={JSON.stringify(
                  competition?.rules ?? defaultCompetitionRules,
                  null,
                  2,
                )}
                name="rules"
                required
                rows={12}
              />
            </Field>
          ) : null}
          <ReasonField
            defaultValue={
              partnerMode
                ? competition
                  ? "Update this gym contest proposal for GoGymGo review."
                  : "Submit a gym contest proposal for GoGymGo review."
                : competition
                  ? "Update the contest configuration after administrative review."
                  : "Create a new contest draft for administrative review."
            }
          />
        </FormGrid>
        {formError ? <p className="form-error">{formError}</p> : null}
        <FormActions
          onClose={onClose}
          submitting={submitting}
          submitLabel={
            partnerMode
              ? competition
                ? "SAVE PROPOSAL"
                : "SUBMIT PROPOSAL"
              : competition
                ? "SAVE DRAFT"
                : "CREATE DRAFT"
          }
        />
      </form>
    </ModalShell>
  );
}

function RewardForm({
  competitions,
  onClose,
  onSubmit,
  reward,
  submitting,
}: {
  competitions: Competition[];
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>, editing?: Reward) => Promise<void>;
  reward?: Reward;
  submitting: boolean;
}) {
  const [formError, setFormError] = useState("");
  const [rewardType, setRewardType] = useState<Reward["rewardType"]>(
    reward?.rewardType ?? "physical",
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const form = new FormData(event.currentTarget);
    try {
      const selectedRewardType = String(form.get("rewardType"));
      const claimUrl = optionalString(form.get("claimUrl"));
      const fulfillmentInstructions = optionalString(
        form.get("fulfillmentInstructions"),
      );
      if (
        selectedRewardType !== "coupon" &&
        !claimUrl &&
        !fulfillmentInstructions
      ) {
        throw new AdminUserFacingError(
          "Add either a secure claim URL or fulfillment instructions.",
        );
      }
      const body = compactObject({
        availableFrom: optionalIso(form.get("availableFrom")),
        availableUntil: optionalIso(form.get("availableUntil")),
        claimUrl,
        competitionId: String(form.get("competitionId")),
        description: String(form.get("description")),
        displayOrder: Number(form.get("displayOrder") || 0),
        expectedVersion: reward?.version,
        fulfillmentInstructions,
        imageUrl: optionalString(form.get("imageUrl")),
        inventoryTotal: Number(form.get("inventoryTotal")),
        reason: String(form.get("reason")),
        rewardType: selectedRewardType,
        sponsorName: String(form.get("sponsorName")),
        termsUrl: optionalString(form.get("termsUrl")),
        title: String(form.get("title")),
      });
      await onSubmit(body, reward);
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }
  return (
    <ModalShell
      onClose={onClose}
      title={reward ? "Edit reward draft" : "New brand reward"}
    >
      <form className="editor-form" onSubmit={(event) => void submit(event)}>
        <FormGrid>
          <Field label="CONTEST" wide>
            <select
              defaultValue={reward?.competitionId}
              name="competitionId"
              required
            >
              <option value="">Select a contest</option>
              {competitions.map((competition) => (
                <option key={competition.id} value={competition.id}>
                  {competition.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="BRAND / SPONSOR">
            <input
              defaultValue={reward?.sponsorName}
              name="sponsorName"
              required
            />
          </Field>
          <Field label="REWARD TITLE">
            <input defaultValue={reward?.title} name="title" required />
          </Field>
          <Field label="REWARD TYPE">
            <select
              name="rewardType"
              onChange={(event) =>
                setRewardType(event.target.value as Reward["rewardType"])
              }
              value={rewardType}
            >
              <option value="physical">Physical</option>
              <option value="coupon">Coupon code</option>
              <option value="cash">Cash</option>
            </select>
          </Field>
          <Field label="QUANTITY">
            <input
              defaultValue={reward?.inventoryTotal ?? 1}
              max={100000}
              min={1}
              name="inventoryTotal"
              required
              type="number"
            />
          </Field>
          <Field label="DESCRIPTION" wide>
            <textarea
              defaultValue={reward?.description}
              name="description"
              required
              rows={4}
            />
          </Field>
          {rewardType !== "coupon" ? (
            <fieldset className="reward-fulfillment">
              <legend>
                {rewardType === "cash"
                  ? "CASH FULFILLMENT"
                  : "PHYSICAL REWARD FULFILLMENT"}
              </legend>
              <p>Add at least one way for a winner to receive this reward.</p>
              <div className="reward-fulfillment-fields">
                <Field
                  label={
                    rewardType === "cash" ? "PAYMENT / CLAIM URL" : "CLAIM URL"
                  }
                >
                  <input
                    defaultValue={reward?.claimUrl ?? ""}
                    name="claimUrl"
                    placeholder="https://"
                    type="url"
                  />
                </Field>
                <Field
                  label={
                    rewardType === "cash"
                      ? "PAYMENT INSTRUCTIONS"
                      : "FULFILLMENT INSTRUCTIONS"
                  }
                >
                  <textarea
                    defaultValue={reward?.fulfillmentInstructions ?? ""}
                    name="fulfillmentInstructions"
                    rows={3}
                  />
                </Field>
              </div>
            </fieldset>
          ) : null}
          <details className="reward-advanced">
            <summary>
              <span>ADVANCED OPTIONS</span>
              <small>Images, terms, timing and display order</small>
            </summary>
            <div className="reward-advanced-grid">
              <Field label="IMAGE URL">
                <input
                  defaultValue={reward?.imageUrl ?? ""}
                  name="imageUrl"
                  placeholder="https://"
                  type="url"
                />
              </Field>
              <Field label="TERMS URL">
                <input
                  defaultValue={reward?.termsUrl ?? ""}
                  name="termsUrl"
                  placeholder="https://"
                  type="url"
                />
              </Field>
              <Field label="DISPLAY ORDER">
                <input
                  defaultValue={reward?.displayOrder ?? 0}
                  min={0}
                  name="displayOrder"
                  type="number"
                />
              </Field>
              <Field label="AVAILABLE FROM">
                <input
                  defaultValue={
                    reward?.availableFrom
                      ? toLocalDateTime(reward.availableFrom)
                      : ""
                  }
                  name="availableFrom"
                  type="datetime-local"
                />
              </Field>
              <Field label="AVAILABLE UNTIL">
                <input
                  defaultValue={
                    reward?.availableUntil
                      ? toLocalDateTime(reward.availableUntil)
                      : ""
                  }
                  name="availableUntil"
                  type="datetime-local"
                />
              </Field>
            </div>
          </details>
        </FormGrid>
        <input
          name="reason"
          type="hidden"
          value={
            reward
              ? "Update the verified brand reward configuration."
              : "Create a verified brand reward draft for review."
          }
        />
        {formError ? <p className="form-error">{formError}</p> : null}
        <FormActions
          onClose={onClose}
          submitting={submitting}
          submitLabel={reward ? "SAVE REWARD" : "CREATE REWARD"}
        />
      </form>
    </ModalShell>
  );
}

function RegionForm({
  onClose,
  onSubmit,
  submitting,
}: {
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
  submitting: boolean;
}) {
  const [formError, setFormError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const form = new FormData(event.currentTarget);
    try {
      await onSubmit(
        compactObject({
          boundary: JSON.parse(String(form.get("boundary"))),
          boundaryVersion: String(form.get("boundaryVersion")),
          code: String(form.get("code")),
          competitionEnabled: form.get("competitionEnabled") === "on",
          countryCode: String(form.get("countryCode")).toUpperCase(),
          currency: String(form.get("currency")).toUpperCase(),
          languageCodes: String(form.get("languageCodes"))
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          metroName: String(form.get("metroName")),
          minimumAge: Number(form.get("minimumAge")),
          policyVersion: String(form.get("policyVersion")),
          reason: String(form.get("reason")),
          subdivisionCode: String(form.get("subdivisionCode")).toUpperCase(),
          timezone: String(form.get("timezone")),
          validFrom: toIso(form, "validFrom"),
          validTo: optionalIso(form.get("validTo")),
        }),
      );
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }
  return (
    <ModalShell onClose={onClose} title="New regional policy">
      <form className="editor-form" onSubmit={(event) => void submit(event)}>
        <div className="alert warning compact">
          <span>!</span>
          <p>
            Regional policies are immutable. Use an approved GeoJSON
            MultiPolygon and confirm the boundary version before saving.
          </p>
        </div>
        <FormGrid>
          <Field label="REGION CODE">
            <input name="code" placeholder="vancouver-island-bc" required />
          </Field>
          <Field label="DISPLAY NAME">
            <input name="metroName" placeholder="Vancouver Island" required />
          </Field>
          <Field label="COUNTRY">
            <input
              defaultValue="CA"
              maxLength={2}
              name="countryCode"
              required
            />
          </Field>
          <Field label="SUBDIVISION">
            <input
              defaultValue="BC"
              maxLength={8}
              name="subdivisionCode"
              required
            />
          </Field>
          <Field label="CURRENCY">
            <select defaultValue="CAD" name="currency">
              <option>CAD</option>
              <option>USD</option>
              <option>MXN</option>
            </select>
          </Field>
          <Field label="TIMEZONE">
            <input defaultValue="America/Vancouver" name="timezone" required />
          </Field>
          <Field label="LANGUAGES">
            <input defaultValue="en-CA" name="languageCodes" required />
          </Field>
          <Field label="MINIMUM AGE">
            <input
              defaultValue={19}
              max={99}
              min={13}
              name="minimumAge"
              required
              type="number"
            />
          </Field>
          <Field label="POLICY VERSION">
            <input name="policyVersion" placeholder="2026-09-v1" required />
          </Field>
          <Field label="BOUNDARY VERSION">
            <input
              name="boundaryVersion"
              placeholder="approved-source-v1"
              required
            />
          </Field>
          <Field label="VALID FROM">
            <input name="validFrom" required type="datetime-local" />
          </Field>
          <Field label="VALID TO (OPTIONAL)">
            <input name="validTo" type="datetime-local" />
          </Field>
          <Field label="GEOJSON MULTIPOLYGON" wide>
            <textarea
              defaultValue={
                '{\n  "type": "MultiPolygon",\n  "coordinates": []\n}'
              }
              name="boundary"
              required
              rows={10}
            />
          </Field>
          <Field label="CONTEST OPERATIONS" wide>
            <label className="check-row">
              <input name="competitionEnabled" type="checkbox" />
              Enable contests within this approved boundary
            </label>
          </Field>
          <ReasonField defaultValue="Create an approved regional policy for GoGymGo operations." />
        </FormGrid>
        {formError ? <p className="form-error">{formError}</p> : null}
        <FormActions
          onClose={onClose}
          submitting={submitting}
          submitLabel="CREATE REGION POLICY"
        />
      </form>
    </ModalShell>
  );
}

function WorkoutForm({
  onClose,
  onSubmit,
  regions,
  submitting,
  workout,
}: {
  onClose: () => void;
  onSubmit: (
    body: Record<string, unknown>,
    editing?: CreatorWorkout,
  ) => Promise<void>;
  regions: RegionPolicy[];
  submitting: boolean;
  workout?: CreatorWorkout;
}) {
  const [formError, setFormError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const form = new FormData(event.currentTarget);
    try {
      await onSubmit(
        compactObject({
          creatorName: String(form.get("creatorName")),
          durationMinutes: Number(form.get("durationMinutes")),
          expectedVersion: workout?.version,
          reason: String(form.get("reason")),
          regionCodes: form.getAll("regionCodes").map(String),
          sponsorName: optionalString(form.get("sponsorName")),
          thumbnailUrl: optionalString(form.get("thumbnailUrl")),
          title: String(form.get("title")),
          videoUrl: String(form.get("videoUrl")),
          workoutStyle: String(form.get("workoutStyle")),
        }),
        workout,
      );
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }
  return (
    <ModalShell
      onClose={onClose}
      title={workout ? "Edit Creator workout" : "New Creator workout"}
    >
      <form className="editor-form" onSubmit={(event) => void submit(event)}>
        <FormGrid>
          <Field label="WORKOUT TITLE">
            <input defaultValue={workout?.title} name="title" required />
          </Field>
          <Field label="CREATOR NAME">
            <input
              defaultValue={workout?.creatorName}
              name="creatorName"
              required
            />
          </Field>
          <Field label="VIDEO URL" wide>
            <input
              defaultValue={workout?.videoUrl}
              name="videoUrl"
              placeholder="https://"
              required
              type="url"
            />
          </Field>
          <Field label="THUMBNAIL URL" wide>
            <input
              defaultValue={workout?.thumbnailUrl ?? ""}
              name="thumbnailUrl"
              placeholder="https://"
              type="url"
            />
          </Field>
          <Field label="DURATION (MINUTES)">
            <input
              defaultValue={workout?.durationMinutes ?? 30}
              max={240}
              min={1}
              name="durationMinutes"
              required
              type="number"
            />
          </Field>
          <Field label="WORKOUT STYLE">
            <input
              defaultValue={workout?.workoutStyle}
              name="workoutStyle"
              required
            />
          </Field>
          <Field label="SPONSOR (OPTIONAL)" wide>
            <input
              defaultValue={workout?.sponsorName ?? ""}
              name="sponsorName"
            />
          </Field>
          <Field label="REGIONS" wide>
            <div className="checkbox-grid">
              {regions.map((region) => (
                <label className="check-row" key={region.id}>
                  <input
                    defaultChecked={workout?.regionCodes.includes(region.code)}
                    name="regionCodes"
                    type="checkbox"
                    value={region.code}
                  />
                  {region.metroName}
                </label>
              ))}
            </div>
          </Field>
          <ReasonField
            defaultValue={
              workout
                ? "Update the approved Creator workout configuration."
                : "Create a Creator workout draft for rights and content review."
            }
          />
        </FormGrid>
        {formError ? <p className="form-error">{formError}</p> : null}
        <FormActions
          onClose={onClose}
          submitting={submitting}
          submitLabel={workout ? "SAVE WORKOUT" : "CREATE WORKOUT"}
        />
      </form>
    </ModalShell>
  );
}

function LegalDocumentForm({
  onClose,
  onSubmit,
  submitting,
}: {
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
  submitting: boolean;
}) {
  const [formError, setFormError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const form = new FormData(event.currentTarget);
    try {
      await onSubmit({
        content: JSON.parse(String(form.get("content"))),
        documentKey: String(form.get("documentKey")),
        effectiveAt: toIso(form, "effectiveAt"),
        jurisdictionCode: String(form.get("jurisdictionCode")),
        locale: String(form.get("locale")),
        ownerApprovalConfirmed: form.get("ownerApprovalConfirmed") === "on",
        reason: String(form.get("reason")),
        receiptRequirement: String(form.get("receiptRequirement")),
        title: String(form.get("title")),
        version: String(form.get("version")),
      });
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }
  return (
    <ModalShell onClose={onClose} title="Publish legal document version">
      <form className="editor-form" onSubmit={(event) => void submit(event)}>
        <div className="alert warning compact">
          <span>!</span>
          <p>
            Publishing legal text can require every player to review or accept a
            new version. Use only counsel-approved content in a live
            environment.
          </p>
        </div>
        <FormGrid>
          <Field label="DOCUMENT KEY">
            <input name="documentKey" placeholder="terms_of_service" required />
          </Field>
          <Field label="TITLE">
            <input name="title" required />
          </Field>
          <Field label="JURISDICTION">
            <input defaultValue="GLOBAL" name="jurisdictionCode" required />
          </Field>
          <Field label="LOCALE">
            <input defaultValue="en" name="locale" required />
          </Field>
          <Field label="VERSION">
            <input name="version" placeholder="2026-08-v1" required />
          </Field>
          <Field label="RECEIPT REQUIREMENT">
            <select defaultValue="acknowledge" name="receiptRequirement">
              <option value="acknowledge">Acknowledge</option>
              <option value="accept">Accept</option>
              <option value="none">None</option>
            </select>
          </Field>
          <Field label="EFFECTIVE AT" wide>
            <input name="effectiveAt" required type="datetime-local" />
          </Field>
          <Field label="DOCUMENT CONTENT (JSON)" wide>
            <textarea
              defaultValue={
                '{\n  "intro": "",\n  "sections": [\n    {\n      "heading": "",\n      "body": ""\n    }\n  ]\n}'
              }
              name="content"
              required
              rows={14}
            />
          </Field>
          <ReasonField defaultValue="Publish a counsel-approved legal document version." />
          <label className="check-row field wide">
            <input name="ownerApprovalConfirmed" required type="checkbox" />
            <span>
              I am the GoGymGo owner and explicitly approve this exact version
              for publication.
            </span>
          </label>
        </FormGrid>
        {formError ? <p className="form-error">{formError}</p> : null}
        <FormActions
          onClose={onClose}
          submitting={submitting}
          submitLabel="PUBLISH VERSION"
        />
      </form>
    </ModalShell>
  );
}

function CouponCodesForm({
  onClose,
  onSubmit,
  reward,
  submitting,
}: {
  onClose: () => void;
  onSubmit: (codes: string[], reason: string) => Promise<void>;
  reward: Reward;
  submitting: boolean;
}) {
  const [formError, setFormError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const form = new FormData(event.currentTarget);
    const codes = [
      ...new Set(
        String(form.get("codes") ?? "")
          .split(/\r?\n/)
          .map((code) => code.trim())
          .filter(Boolean),
      ),
    ];
    try {
      if (codes.length === 0) throw new AdminUserFacingError("Add at least one coupon code.");
      await onSubmit(codes, String(form.get("reason")));
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }
  return (
    <ModalShell
      onClose={onClose}
      title={`Add coupon inventory · ${reward.title}`}
    >
      <form className="editor-form" onSubmit={(event) => void submit(event)}>
        <p className="modal-copy">
          Enter one unique coupon code per line. Codes are encrypted by the
          backend before storage and never returned in this dashboard.
        </p>
        <Field label="COUPON CODES">
          <textarea
            autoComplete="off"
            name="codes"
            required
            rows={14}
            spellCheck={false}
          />
        </Field>
        <Field label="AUDIT REASON">
          <textarea
            defaultValue="Add verified coupon inventory supplied by the sponsoring brand."
            minLength={8}
            name="reason"
            required
            rows={3}
          />
        </Field>
        {formError ? <p className="form-error">{formError}</p> : null}
        <FormActions
          onClose={onClose}
          submitting={submitting}
          submitLabel="ENCRYPT + ADD CODES"
        />
      </form>
    </ModalShell>
  );
}

function ConfirmationDialog({
  action,
  onClose,
  onRefresh,
  submitting,
}: {
  action: ConfirmAction;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  submitting: boolean;
}) {
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState("");
  const [requiresReview, setRequiresReview] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  async function confirm() {
    setFormError("");
    const auditReason = action.auditReason ?? reason.trim();
    if (auditReason.length < 8) {
      setFormError("Add a clear audit reason of at least 8 characters.");
      return;
    }
    try {
      await action.execute(auditReason);
      onClose();
    } catch (error) {
      setFormError(errorMessage(error));
      setRequiresReview(adminRequestStatus(error) === 409);
    }
  }
  async function refreshAndReview() {
    setRefreshing(true);
    await onRefresh();
    onClose();
  }
  return (
    <ModalShell onClose={onClose} title={action.actionLabel} compact>
      <p className="modal-copy">{action.description}</p>
      {action.auditReason ? (
        <p className="modal-copy audit-note">
          Your confirmation will be recorded automatically in the audit history.
        </p>
      ) : (
        <Field label="REQUIRED AUDIT REASON">
          <textarea
            autoFocus
            minLength={8}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Explain why this change is authorized."
            rows={4}
            value={reason}
          />
        </Field>
      )}
      {formError ? <p className="form-error">{formError}</p> : null}
      <div className="form-actions">
        {requiresReview ? (
          <button
            autoFocus
            className="primary-button"
            disabled={refreshing}
            onClick={() => void refreshAndReview()}
            type="button"
          >
            {refreshing ? "REFRESHING…" : "REFRESH + REVIEW"}
          </button>
        ) : (
          <>
            <button className="secondary-button" onClick={onClose} type="button">
              GO BACK
            </button>
            <button
              autoFocus={Boolean(action.auditReason)}
              className={
                action.tone === "danger" ? "danger-button" : "primary-button"
              }
              disabled={submitting}
              onClick={() => void confirm()}
              type="button"
            >
              {submitting ? "SAVING…" : action.actionLabel.toUpperCase()}
            </button>
          </>
        )}
      </div>
    </ModalShell>
  );
}

function ModalShell({
  children,
  compact,
  onClose,
  title,
}: {
  children: React.ReactNode;
  compact?: boolean;
  onClose: () => void;
  title: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();

    return () => {
      if (dialog?.open) dialog.close();
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <dialog
      aria-labelledby={titleId}
      className="modal-backdrop"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      ref={dialogRef}
    >
      <section className={compact ? "modal compact-modal" : "modal"}>
        <header>
          <div>
            <p className="eyebrow">ADMINISTRATIVE ACTION</p>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button
            aria-label="Close"
            className="modal-close"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>
        {children}
      </section>
    </dialog>
  );
}

function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="form-grid">{children}</div>;
}

function Field({
  children,
  label,
  wide,
}: {
  children: React.ReactNode;
  label: string;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "field wide" : "field"}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function ReasonField({ defaultValue }: { defaultValue: string }) {
  return (
    <Field label="REQUIRED AUDIT REASON" wide>
      <textarea
        defaultValue={defaultValue}
        minLength={8}
        name="reason"
        required
        rows={3}
      />
    </Field>
  );
}

function FormActions({
  onClose,
  submitLabel,
  submitting,
}: {
  onClose: () => void;
  submitLabel: string;
  submitting: boolean;
}) {
  return (
    <div className="form-actions">
      <button className="secondary-button" onClick={onClose} type="button">
        CANCEL
      </button>
      <button className="primary-button" disabled={submitting} type="submit">
        {submitting ? "SAVING…" : submitLabel}
      </button>
    </div>
  );
}

function EmptyState({ body, title }: { body: string; title: string }) {
  return (
    <div className="empty-state">
      <span aria-hidden="true">＋</span>
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}
