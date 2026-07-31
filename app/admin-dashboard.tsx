"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type {
  AdminSection,
  AuditEvent,
  Competition,
  CreatorWorkout,
  DashboardSnapshot,
  FirebaseClientConfig,
  LegalDocument,
  RegionPolicy,
  Reward,
  SystemHealth,
  WorkQueueItem,
} from "./admin-types";

type AuthStage = "checking" | "denied" | "ready" | "signed-out";
type HttpMethod = "POST" | "PUT";

type ConfirmAction = {
  actionLabel: string;
  description: string;
  execute: (reason: string) => Promise<void>;
  tone?: "danger" | "primary";
};

const navigation: { id: AdminSection; label: string; short: string }[] = [
  { id: "overview", label: "Overview", short: "OV" },
  { id: "competitions", label: "Competitions", short: "CO" },
  { id: "rewards", label: "Rewards", short: "RW" },
  { id: "regions", label: "Regions", short: "RG" },
  { id: "content", label: "Content + Legal", short: "CL" },
  { id: "operations", label: "Operations", short: "OP" },
  { id: "audit", label: "Audit history", short: "AU" },
];

const defaultCompetitionRules = {
  categoryPodiumMultipliers: { 1: 3, 2: 2, 3: 1.5 },
  minHeartRateSamples: 10,
  minSessionMinutes: 30,
  perfectMonthMultiplier: 10,
  requireDeviceAttestation: true,
  requireGymQr: true,
  requirePresenceCheck: true,
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
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [queue, setQueue] = useState<WorkQueueItem[]>([]);
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
  const [rewardEditor, setRewardEditor] = useState<Reward | "new" | null>(
    null,
  );
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
      const [dashboardResult, healthResult, queueResult] = await Promise.all([
        adminRequest<DashboardSnapshot>(
          activeUser,
          "operator/configuration/dashboard",
        ),
        adminRequest<SystemHealth>(activeUser, "operator/system-health"),
        adminRequest<WorkQueueItem[]>(activeUser, "operator/work-queue"),
      ]);
      setSnapshot(dashboardResult);
      setHealth(healthResult);
      setQueue(queueResult);
      setAuthStage("ready");
    } catch (error) {
      const status =
        typeof error === "object" && error && "status" in error
          ? Number(error.status)
          : 0;
      if (status === 401 || status === 403) setAuthStage("denied");
      setLoadError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!firebaseConfigured) return;
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    void setPersistence(auth, browserLocalPersistence);
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setSnapshot(null);
      if (nextUser) {
        setAuthStage("checking");
        void refresh(nextUser);
      } else {
        setAuthStage("signed-out");
      }
    });
  }, [firebaseConfig, firebaseConfigured, refresh]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  async function mutate(
    successMessage: string,
    path: string,
    method: HttpMethod,
    body: unknown,
  ) {
    setSubmitting(true);
    setLoadError("");
    try {
      await request(path, { body, method });
      if (user) await refresh(user);
      setToast(successMessage);
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
    try {
      const auth = getAuth();
      await setPersistence(auth, browserLocalPersistence);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setLoadError(authErrorMessage(error));
    }
  }

  async function handleProviderSignIn(provider: "apple" | "google") {
    setLoadError("");
    try {
      const auth = getAuth();
      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(
        auth,
        provider === "google"
          ? new GoogleAuthProvider()
          : new OAuthProvider("apple.com"),
      );
    } catch (error) {
      setLoadError(authErrorMessage(error));
    }
  }

  async function handleSignOut() {
    await signOut(getAuth());
    setSnapshot(null);
    setHealth(null);
    setQueue([]);
    setAuthStage("signed-out");
  }

  if (authStage === "signed-out" || authStage === "denied") {
    return (
      <SignInScreen
        denied={authStage === "denied"}
        error={loadError}
        firebaseConfigured={firebaseConfigured}
        onEmailSignIn={handleEmailSignIn}
        onProviderSignIn={handleProviderSignIn}
        onSignOut={user ? handleSignOut : undefined}
        signedInEmail={user?.email ?? undefined}
      />
    );
  }

  if (authStage === "checking" || !snapshot) {
    return (
      <div className="boot-screen">
        <div className="brand-lockup">
          <span className="brand-mark">G</span>
          <span>
            <strong>GoGymGo</strong>
            <small>ADMIN CONTROL</small>
          </span>
        </div>
        <div className="boot-line" />
        <p>{loadError || "VERIFYING ADMIN ACCESS"}</p>
      </div>
    );
  }

  const draftCompetitions = snapshot.competitions.filter(
    (competition) => competition.status === "draft",
  );
  const publishReady = draftCompetitions.filter(
    (competition) => competition.publishedRewardCount > 0,
  );
  const activeCompetition = snapshot.competitions.find((competition) =>
    ["registration", "active"].includes(competition.status),
  );

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand-lockup sidebar-brand">
          <span className="brand-mark">G</span>
          <span>
            <strong>GoGymGo</strong>
            <small>ADMIN CONTROL</small>
          </span>
        </div>
        <nav aria-label="Admin sections">
          {navigation.map((item) => (
            <button
              className={section === item.id ? "nav-item active" : "nav-item"}
              key={item.id}
              onClick={() => setSection(item.id)}
              type="button"
            >
              <span className="nav-short">{item.short}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
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

      <main>
        <header className="topbar">
          <div>
            <p className="eyebrow">SYSTEM // {section.toUpperCase()}</p>
            <h1>{navigation.find((item) => item.id === section)?.label}</h1>
          </div>
          <div className="topbar-actions">
            <span className={`health-pill ${health?.worker.status ?? "stale"}`}>
              <span />
              WORKER {health?.worker.status.toUpperCase() ?? "UNKNOWN"}
            </span>
            <button
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
              onStatus={(competition, action) =>
                setConfirmAction({
                  actionLabel:
                    action === "publish"
                      ? "Publish competition"
                      : "Cancel competition",
                  description:
                    action === "publish"
                      ? `${competition.name} will become visible and joinable in the player app immediately.`
                      : `${competition.name} will be cancelled. This action is recorded in the audit ledger.`,
                  execute: (reason) =>
                    mutate(
                      action === "publish"
                        ? "Competition published."
                        : "Competition cancelled.",
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
                      ? `${reward.title} will become part of the public competition reward catalog.`
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
            <OperationsPanel health={health} queue={queue} />
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
              editing ? "Competition draft updated." : "Competition draft created.",
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
  onProviderSignIn,
  onSignOut,
  signedInEmail,
}: {
  denied: boolean;
  error: string;
  firebaseConfigured: boolean;
  onEmailSignIn: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onProviderSignIn: (provider: "apple" | "google") => Promise<void>;
  onSignOut?: () => Promise<void>;
  signedInEmail?: string;
}) {
  return (
    <main className="sign-in-screen">
      <section className="sign-in-intro">
        <div className="brand-lockup">
          <span className="brand-mark">G</span>
          <span>
            <strong>GoGymGo</strong>
            <small>ADMIN CONTROL</small>
          </span>
        </div>
        <p className="eyebrow">SECURE OPERATIONS CONSOLE</p>
        <h1>
          Run every competition
          <span>from one control deck.</span>
        </h1>
        <p className="sign-in-lede">
          Regions, competition timing, brand rewards and publication all flow
          through the same authoritative system used by the GoGymGo mobile and
          web apps.
        </p>
        <div className="security-list">
          <span>01</span>
          <p>
            <strong>Database-authorized access</strong>
            Firebase sign-in identifies you. The backend admin role decides
            what you may change.
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
        <p className="eyebrow">ADMIN AUTHENTICATION</p>
        <h2>{denied ? "Admin access required" : "Sign in to continue"}</h2>
        {denied ? (
          <div className="alert error compact" role="alert">
            <span>!</span>
            <p>
              {signedInEmail || "This account"} is signed in, but the backend
              did not confirm administrator access.
            </p>
          </div>
        ) : null}
        {error ? <p className="form-error">{error}</p> : null}
        {!firebaseConfigured ? (
          <p className="configuration-note">
            This build needs the existing GoGymGo Firebase web configuration
            before administrator sign-in can start.
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
            <form className="stacked-form" onSubmit={(event) => void onEmailSignIn(event)}>
              <label>
                ADMIN EMAIL
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
              <button className="primary-button full" type="submit">
                ENTER ADMIN CONTROL
              </button>
            </form>
            <div className="divider">
              <span>OR USE YOUR CONNECTED ACCOUNT</span>
            </div>
            <div className="provider-grid">
              <button
                className="secondary-button"
                onClick={() => void onProviderSignIn("google")}
                type="button"
              >
                GOOGLE
              </button>
              <button
                className="secondary-button"
                onClick={() => void onProviderSignIn("apple")}
                type="button"
              >
                APPLE
              </button>
            </div>
          </>
        )}
        <p className="fine-print">
          Authentication never grants itself permission. Only active,
          email-verified accounts with the authoritative database admin role
          may enter.
        </p>
      </section>
    </main>
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
  return (
    <>
      <section className="hero-panel">
        <div>
          <p className="eyebrow">GO GYM GO // CONTROL DECK</p>
          <h2>
            {activeCompetition
              ? "A competition is live."
              : publishReady.length > 0
                ? "Ready for a controlled launch."
                : "Build the next competition."}
          </h2>
          <p>
            {activeCompetition
              ? `${activeCompetition.name} is ${activeCompetition.status} with ${activeCompetition.enrollmentCount} enrolled players.`
              : publishReady.length > 0
                ? `${publishReady[0].name} has a published reward and can be released after your final review.`
                : "No competition is currently public. Add and publish a real reward before releasing a draft to players."}
          </p>
        </div>
        <div className="hero-signal">
          <span>{activeCompetition ? "LIVE" : "SAFE"}</span>
          <small>{activeCompetition ? "PUBLIC STATE" : "NO PUBLIC CONTEST"}</small>
        </div>
      </section>
      <section className="metric-grid">
        <Metric
          label="COMPETITIONS"
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
              <h3>Competition launch gates</h3>
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
              body="Create a regional competition draft to begin."
              title="No competitions configured"
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
    <button className="metric" onClick={onClick} type="button">
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
  onStatus,
}: {
  competitions: Competition[];
  onCreate: () => void;
  onEdit: (competition: Competition) => void;
  onStatus: (
    competition: Competition,
    action: "cancel" | "publish",
  ) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">REGIONAL COMPETITION CONTROL</p>
          <h2>Competitions</h2>
          <p>Create drafts, confirm reward readiness and publish to every player surface.</p>
        </div>
        <button className="primary-button" onClick={onCreate} type="button">
          + NEW COMPETITION
        </button>
      </div>
      {competitions.length === 0 ? (
        <EmptyState
          body="Start with a region, schedule, rules and weekly goal options."
          title="No competitions yet"
        />
      ) : (
        <div className="card-list">
          {competitions.map((competition) => {
            const ended = new Date(competition.endsAt) <= new Date();
            const canPublish =
              competition.status === "draft" &&
              !ended &&
              competition.publishedRewardCount > 0;
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
                </div>
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
                      disabled={!canPublish}
                      onClick={() => onStatus(competition, "publish")}
                      title={
                        canPublish
                          ? "Publish this competition"
                          : "At least one eligible published reward is required"
                      }
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
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">BRAND REWARD CATALOG</p>
          <h2>Rewards</h2>
          <p>Only real, in-stock published rewards can unlock a competition launch.</p>
        </div>
        <button className="primary-button" onClick={onCreate} type="button">
          + NEW REWARD
        </button>
      </div>
      {rewards.length === 0 ? (
        <EmptyState
          body="Create the first verified brand reward, then publish it before releasing a competition."
          title="No brand rewards configured"
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Reward</th>
                <th>Competition</th>
                <th>Type</th>
                <th>Inventory</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rewards.map((reward) => {
                const couponReady =
                  reward.rewardType !== "coupon" || reward.couponCodeCount > 0;
                return (
                  <tr key={reward.id}>
                    <td>
                      <strong>{reward.title}</strong>
                      <small>{reward.sponsorName}</small>
                    </td>
                    <td>{reward.competitionName}</td>
                    <td>{reward.rewardType}</td>
                    <td>
                      {reward.rewardType === "coupon"
                        ? `${reward.couponCodeCount} / ${reward.inventoryTotal} codes`
                        : `${reward.inventoryTotal} units`}
                    </td>
                    <td>
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
                            Add codes
                          </button>
                        ) : null}
                        {reward.status === "draft" ? (
                          <button
                            className="text-button accent"
                            disabled={!couponReady}
                            onClick={() => onStatus(reward, "publish")}
                            title={
                              couponReady
                                ? "Publish reward"
                                : "Coupon codes are required before publication"
                            }
                            type="button"
                          >
                            Publish
                          </button>
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
          <p>Immutable, time-bounded geographic rules decide which competitions a player may enter.</p>
        </div>
        <button className="primary-button" onClick={onCreate} type="button">
          + NEW REGION POLICY
        </button>
      </div>
      <div className="card-list">
        {regions.map((region) => (
          <article className="region-card" key={region.id}>
            <div className="region-code">{region.code}</div>
            <div>
              <span
                className={`status-tag ${region.competitionEnabled ? "active" : "archived"}`}
              >
                {region.competitionEnabled ? "competition enabled" : "disabled"}
              </span>
              <h3>{region.metroName}</h3>
              <p>
                {region.countryCode}-{region.subdivisionCode} · {region.timezone}
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
    </section>
  );
}

function ContentPanel({
  documents,
  onCreateDocument,
  onCreateWorkout,
  onEditWorkout,
  onWithdrawDocument,
  onWorkoutStatus,
  workouts,
}: {
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
  return (
    <div className="section-stack">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">CREATOR WORKOUT CATALOG</p>
            <h2>Workout content</h2>
          </div>
          <button className="primary-button" onClick={onCreateWorkout} type="button">
            + NEW WORKOUT
          </button>
        </div>
        {workouts.length === 0 ? (
          <EmptyState
            body="Add approved creator videos and choose exactly where they may appear."
            title="No creator workouts"
          />
        ) : (
          <div className="compact-list">
            {workouts.map((workout) => (
              <div className="compact-row" key={workout.id}>
                <div>
                  <span className={`status-dot ${workout.published ? "active" : "draft"}`} />
                  <strong>{workout.title}</strong>
                  <small>
                    {workout.creatorName} · {workout.durationMinutes} min ·{" "}
                    {workout.regionCodes.join(", ")}
                  </small>
                </div>
                <div className="inline-actions">
                  {!workout.published ? (
                    <button className="text-button" onClick={() => onEditWorkout(workout)} type="button">
                      Edit
                    </button>
                  ) : null}
                  <button
                    className={workout.published ? "text-button danger-text" : "text-button accent"}
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
          </div>
          <button className="primary-button" onClick={onCreateDocument} type="button">
            + PUBLISH VERSION
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Document</th>
                <th>Scope</th>
                <th>Version</th>
                <th>Effective</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id}>
                  <td>
                    <strong>{document.title}</strong>
                    <small>{document.documentKey}</small>
                  </td>
                  <td>
                    {document.jurisdictionCode} · {document.locale}
                  </td>
                  <td>{document.version}</td>
                  <td>{formatDate(document.effectiveAt)}</td>
                  <td>
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
      </section>
    </div>
  );
}

function OperationsPanel({
  health,
  queue,
}: {
  health: SystemHealth | null;
  queue: WorkQueueItem[];
}) {
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
          </div>
        </div>
        {queue.length === 0 ? (
          <EmptyState body="Nothing is waiting for operator review." title="Queue clear" />
        ) : (
          <div className="compact-list">
            {queue.map((item) => (
              <div className="compact-row" key={`${item.kind}-${item.id}`}>
                <div>
                  <span className={`status-dot ${item.status}`} />
                  <strong>{item.kind.replaceAll("_", " ")}</strong>
                  <small>
                    {item.regionCode ? `${item.regionCode} · ` : ""}
                    {formatDateTime(item.createdAt)}
                  </small>
                </div>
                <span className={`status-tag ${item.status}`}>{item.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
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
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">APPEND-ONLY LEDGER</p>
          <h2>Audit history</h2>
          <p>The latest 100 administrative decisions, including who acted and why.</p>
        </div>
      </div>
      <div className="timeline">
        {events.map((event) => (
          <article key={event.id}>
            <div className="timeline-node" />
            <div>
              <div className="timeline-heading">
                <strong>{event.action.replaceAll("_", " ")}</strong>
                <time>{formatDateTime(event.createdAt)}</time>
              </div>
              <p>{event.reason}</p>
              <small>
                {event.actorEmail || "SYSTEM"} · {event.entityType} ·{" "}
                {event.entityId.slice(0, 8)}
              </small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CompetitionForm({
  competition,
  onClose,
  onSubmit,
  regions,
  submitting,
}: {
  competition?: Competition;
  onClose: () => void;
  onSubmit: (
    body: Record<string, unknown>,
    editing?: Competition,
  ) => Promise<void>;
  regions: RegionPolicy[];
  submitting: boolean;
}) {
  const dates = defaultCompetitionDates();
  const [formError, setFormError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const form = new FormData(event.currentTarget);
    try {
      const goalDays = String(form.get("goalDays") ?? "")
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7);
      if (goalDays.length === 0) throw new Error("Add at least one weekly goal.");
      const body: Record<string, unknown> = {
        endsAt: toIso(form, "endsAt"),
        entrantCap: optionalNumber(form.get("entrantCap")),
        goalBrackets: [...new Set(goalDays)].map((goal) => ({
          goalDays: goal,
          label: `${goal} DAY${goal === 1 ? "" : "S"} / WEEK`,
        })),
        minimumEntrants: Number(form.get("minimumEntrants")),
        monthKey: String(form.get("monthKey")),
        name: String(form.get("name")),
        reason: String(form.get("reason")),
        regionPolicyId: String(form.get("regionPolicyId")),
        registrationClosesAt: toIso(form, "registrationClosesAt"),
        registrationOpensAt: toIso(form, "registrationOpensAt"),
        rules: JSON.parse(String(form.get("rules"))),
        rulesVersion: String(form.get("rulesVersion")),
        startsAt: toIso(form, "startsAt"),
        ...(competition ? { expectedVersion: competition.version } : {}),
      };
      await onSubmit(body, competition);
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }
  return (
    <ModalShell onClose={onClose} title={competition ? "Edit competition draft" : "New competition draft"}>
      <form className="editor-form" onSubmit={(event) => void submit(event)}>
        <FormGrid>
          <Field label="REGION POLICY">
            <select defaultValue={competition?.regionPolicyId} name="regionPolicyId" required>
              <option value="">Select a region</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.metroName} · {region.policyVersion}
                </option>
              ))}
            </select>
          </Field>
          <Field label="COMPETITION MONTH">
            <input defaultValue={competition?.monthKey ?? dates.monthKey} name="monthKey" pattern="\d{4}-\d{2}" required />
          </Field>
          <Field label="NAME" wide>
            <input defaultValue={competition?.name} name="name" required />
          </Field>
          <Field label="RULES VERSION">
            <input defaultValue={competition?.rulesVersion ?? `${dates.monthKey}-v1`} name="rulesVersion" required />
          </Field>
          <Field label="WEEKLY GOALS">
            <input
              defaultValue={
                competition?.goalBrackets.map((goal) => goal.goalDays).join(", ") ??
                "1, 2, 3, 4, 5, 6, 7"
              }
              name="goalDays"
              required
            />
          </Field>
          <Field label="MINIMUM ENTRANTS">
            <input defaultValue={competition?.minimumEntrants ?? 100} min={100} name="minimumEntrants" required type="number" />
          </Field>
          <Field label="ENTRANT CAP (OPTIONAL)">
            <input defaultValue={competition?.entrantCap ?? ""} min={100} name="entrantCap" type="number" />
          </Field>
          <Field label="REGISTRATION OPENS">
            <input defaultValue={toLocalDateTime(competition?.registrationOpensAt ?? dates.registrationOpensAt)} name="registrationOpensAt" required type="datetime-local" />
          </Field>
          <Field label="REGISTRATION CLOSES">
            <input defaultValue={toLocalDateTime(competition?.registrationClosesAt ?? dates.startsAt)} name="registrationClosesAt" required type="datetime-local" />
          </Field>
          <Field label="COMPETITION STARTS">
            <input defaultValue={toLocalDateTime(competition?.startsAt ?? dates.startsAt)} name="startsAt" required type="datetime-local" />
          </Field>
          <Field label="COMPETITION ENDS">
            <input defaultValue={toLocalDateTime(competition?.endsAt ?? dates.endsAt)} name="endsAt" required type="datetime-local" />
          </Field>
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
          <ReasonField defaultValue={competition ? "Update the competition configuration after administrative review." : "Create a new competition draft for administrative review."} />
        </FormGrid>
        {formError ? <p className="form-error">{formError}</p> : null}
        <FormActions onClose={onClose} submitting={submitting} submitLabel={competition ? "SAVE DRAFT" : "CREATE DRAFT"} />
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
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const form = new FormData(event.currentTarget);
    try {
      const body = compactObject({
        availableFrom: optionalIso(form.get("availableFrom")),
        availableUntil: optionalIso(form.get("availableUntil")),
        claimUrl: optionalString(form.get("claimUrl")),
        competitionId: String(form.get("competitionId")),
        description: String(form.get("description")),
        displayOrder: Number(form.get("displayOrder") || 0),
        expectedVersion: reward?.version,
        fulfillmentInstructions: optionalString(
          form.get("fulfillmentInstructions"),
        ),
        imageUrl: optionalString(form.get("imageUrl")),
        inventoryTotal: Number(form.get("inventoryTotal")),
        reason: String(form.get("reason")),
        rewardType: String(form.get("rewardType")),
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
    <ModalShell onClose={onClose} title={reward ? "Edit reward draft" : "New brand reward"}>
      <form className="editor-form" onSubmit={(event) => void submit(event)}>
        <FormGrid>
          <Field label="COMPETITION" wide>
            <select defaultValue={reward?.competitionId} name="competitionId" required>
              <option value="">Select a competition</option>
              {competitions.map((competition) => (
                <option key={competition.id} value={competition.id}>
                  {competition.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="BRAND / SPONSOR">
            <input defaultValue={reward?.sponsorName} name="sponsorName" required />
          </Field>
          <Field label="REWARD TITLE">
            <input defaultValue={reward?.title} name="title" required />
          </Field>
          <Field label="REWARD TYPE">
            <select defaultValue={reward?.rewardType ?? "physical"} name="rewardType">
              <option value="physical">Physical</option>
              <option value="coupon">Coupon code</option>
            </select>
          </Field>
          <Field label="INVENTORY">
            <input defaultValue={reward?.inventoryTotal ?? 1} max={100000} min={1} name="inventoryTotal" required type="number" />
          </Field>
          <Field label="DESCRIPTION" wide>
            <textarea defaultValue={reward?.description} name="description" required rows={4} />
          </Field>
          <Field label="IMAGE URL">
            <input defaultValue={reward?.imageUrl ?? ""} name="imageUrl" placeholder="https://" type="url" />
          </Field>
          <Field label="TERMS URL">
            <input defaultValue={reward?.termsUrl ?? ""} name="termsUrl" placeholder="https://" type="url" />
          </Field>
          <Field label="CLAIM URL">
            <input defaultValue={reward?.claimUrl ?? ""} name="claimUrl" placeholder="https://" type="url" />
          </Field>
          <Field label="DISPLAY ORDER">
            <input defaultValue={reward?.displayOrder ?? 0} min={0} name="displayOrder" type="number" />
          </Field>
          <Field label="AVAILABLE FROM">
            <input defaultValue={reward?.availableFrom ? toLocalDateTime(reward.availableFrom) : ""} name="availableFrom" type="datetime-local" />
          </Field>
          <Field label="AVAILABLE UNTIL">
            <input defaultValue={reward?.availableUntil ? toLocalDateTime(reward.availableUntil) : ""} name="availableUntil" type="datetime-local" />
          </Field>
          <Field label="FULFILLMENT INSTRUCTIONS" wide>
            <textarea defaultValue={reward?.fulfillmentInstructions ?? ""} name="fulfillmentInstructions" rows={3} />
          </Field>
          <ReasonField defaultValue={reward ? "Update the verified brand reward configuration." : "Create a verified brand reward draft for review."} />
        </FormGrid>
        {formError ? <p className="form-error">{formError}</p> : null}
        <FormActions onClose={onClose} submitting={submitting} submitLabel={reward ? "SAVE REWARD" : "CREATE REWARD"} />
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
          <p>Regional policies are immutable. Use an approved GeoJSON MultiPolygon and confirm the boundary version before saving.</p>
        </div>
        <FormGrid>
          <Field label="REGION CODE">
            <input name="code" placeholder="vancouver-island-bc" required />
          </Field>
          <Field label="DISPLAY NAME">
            <input name="metroName" placeholder="Vancouver Island" required />
          </Field>
          <Field label="COUNTRY">
            <input defaultValue="CA" maxLength={2} name="countryCode" required />
          </Field>
          <Field label="SUBDIVISION">
            <input defaultValue="BC" maxLength={8} name="subdivisionCode" required />
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
            <input defaultValue={19} max={99} min={13} name="minimumAge" required type="number" />
          </Field>
          <Field label="POLICY VERSION">
            <input name="policyVersion" placeholder="2026-pilot-v1" required />
          </Field>
          <Field label="BOUNDARY VERSION">
            <input name="boundaryVersion" placeholder="approved-source-v1" required />
          </Field>
          <Field label="VALID FROM">
            <input name="validFrom" required type="datetime-local" />
          </Field>
          <Field label="VALID TO (OPTIONAL)">
            <input name="validTo" type="datetime-local" />
          </Field>
          <Field label="GEOJSON MULTIPOLYGON" wide>
            <textarea
              defaultValue={'{\n  "type": "MultiPolygon",\n  "coordinates": []\n}'}
              name="boundary"
              required
              rows={10}
            />
          </Field>
          <Field label="COMPETITION OPERATIONS" wide>
            <label className="check-row">
              <input name="competitionEnabled" type="checkbox" />
              Enable competitions within this approved boundary
            </label>
          </Field>
          <ReasonField defaultValue="Create an approved regional policy for GoGymGo operations." />
        </FormGrid>
        {formError ? <p className="form-error">{formError}</p> : null}
        <FormActions onClose={onClose} submitting={submitting} submitLabel="CREATE REGION POLICY" />
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
    <ModalShell onClose={onClose} title={workout ? "Edit creator workout" : "New creator workout"}>
      <form className="editor-form" onSubmit={(event) => void submit(event)}>
        <FormGrid>
          <Field label="WORKOUT TITLE">
            <input defaultValue={workout?.title} name="title" required />
          </Field>
          <Field label="CREATOR NAME">
            <input defaultValue={workout?.creatorName} name="creatorName" required />
          </Field>
          <Field label="VIDEO URL" wide>
            <input defaultValue={workout?.videoUrl} name="videoUrl" placeholder="https://" required type="url" />
          </Field>
          <Field label="THUMBNAIL URL" wide>
            <input defaultValue={workout?.thumbnailUrl ?? ""} name="thumbnailUrl" placeholder="https://" type="url" />
          </Field>
          <Field label="DURATION (MINUTES)">
            <input defaultValue={workout?.durationMinutes ?? 30} max={240} min={1} name="durationMinutes" required type="number" />
          </Field>
          <Field label="WORKOUT STYLE">
            <input defaultValue={workout?.workoutStyle} name="workoutStyle" required />
          </Field>
          <Field label="SPONSOR (OPTIONAL)" wide>
            <input defaultValue={workout?.sponsorName ?? ""} name="sponsorName" />
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
          <ReasonField defaultValue={workout ? "Update the approved creator workout configuration." : "Create a creator workout draft for rights and content review."} />
        </FormGrid>
        {formError ? <p className="form-error">{formError}</p> : null}
        <FormActions onClose={onClose} submitting={submitting} submitLabel={workout ? "SAVE WORKOUT" : "CREATE WORKOUT"} />
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
          <p>Publishing legal text can require every player to review or accept a new version. Use only counsel-approved content in a live environment.</p>
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
              defaultValue={'{\n  "intro": "",\n  "sections": [\n    {\n      "heading": "",\n      "body": ""\n    }\n  ]\n}'}
              name="content"
              required
              rows={14}
            />
          </Field>
          <ReasonField defaultValue="Publish a counsel-approved legal document version." />
        </FormGrid>
        {formError ? <p className="form-error">{formError}</p> : null}
        <FormActions onClose={onClose} submitting={submitting} submitLabel="PUBLISH VERSION" />
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
      if (codes.length === 0) throw new Error("Add at least one coupon code.");
      await onSubmit(codes, String(form.get("reason")));
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }
  return (
    <ModalShell onClose={onClose} title={`Add coupon inventory · ${reward.title}`}>
      <form className="editor-form" onSubmit={(event) => void submit(event)}>
        <p className="modal-copy">Enter one unique coupon code per line. Codes are encrypted by the backend before storage and never returned in this dashboard.</p>
        <Field label="COUPON CODES">
          <textarea autoComplete="off" name="codes" required rows={14} spellCheck={false} />
        </Field>
        <Field label="AUDIT REASON">
          <textarea defaultValue="Add verified coupon inventory supplied by the sponsoring brand." minLength={8} name="reason" required rows={3} />
        </Field>
        {formError ? <p className="form-error">{formError}</p> : null}
        <FormActions onClose={onClose} submitting={submitting} submitLabel="ENCRYPT + ADD CODES" />
      </form>
    </ModalShell>
  );
}

function ConfirmationDialog({
  action,
  onClose,
  submitting,
}: {
  action: ConfirmAction;
  onClose: () => void;
  submitting: boolean;
}) {
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState("");
  async function confirm() {
    setFormError("");
    if (reason.trim().length < 8) {
      setFormError("Add a clear audit reason of at least 8 characters.");
      return;
    }
    try {
      await action.execute(reason.trim());
      onClose();
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }
  return (
    <ModalShell onClose={onClose} title={action.actionLabel} compact>
      <p className="modal-copy">{action.description}</p>
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
      {formError ? <p className="form-error">{formError}</p> : null}
      <div className="form-actions">
        <button className="secondary-button" onClick={onClose} type="button">
          GO BACK
        </button>
        <button
          className={action.tone === "danger" ? "danger-button" : "primary-button"}
          disabled={submitting}
          onClick={() => void confirm()}
          type="button"
        >
          {submitting ? "SAVING…" : action.actionLabel.toUpperCase()}
        </button>
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
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-label={title}
        aria-modal="true"
        className={compact ? "modal compact-modal" : "modal"}
        role="dialog"
      >
        <header>
          <div>
            <p className="eyebrow">ADMINISTRATIVE ACTION</p>
            <h2>{title}</h2>
          </div>
          <button aria-label="Close" className="modal-close" onClick={onClose} type="button">
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
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
      <textarea defaultValue={defaultValue} minLength={8} name="reason" required rows={3} />
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
      <span>＋</span>
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Vancouver",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "America/Vancouver",
    year: "numeric",
  }).format(new Date(value));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The request could not be completed.";
}

function authErrorMessage(error: unknown) {
  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";
  if (code.includes("invalid-credential")) return "The email or password is incorrect.";
  if (code.includes("popup-closed")) return "The sign-in window was closed before authentication finished.";
  if (code.includes("popup-blocked")) return "Your browser blocked the sign-in window. Allow pop-ups and try again.";
  return errorMessage(error);
}

function toLocalDateTime(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIso(form: FormData, name: string) {
  const value = String(form.get(name) ?? "");
  if (!value) throw new Error(`${name} is required.`);
  return new Date(value).toISOString();
}

function optionalIso(value: FormDataEntryValue | null) {
  const normalized = optionalString(value);
  return normalized ? new Date(normalized).toISOString() : undefined;
}

function optionalString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized || undefined;
}

function optionalNumber(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized ? Number(normalized) : undefined;
}

function compactObject<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== ""),
  );
}

function defaultCompetitionDates() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 7));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1, 7));
  return {
    endsAt: end.toISOString(),
    monthKey: start.toISOString().slice(0, 7),
    registrationOpensAt: now.toISOString(),
    startsAt: start.toISOString(),
  };
}

async function adminRequest<T>(
  activeUser: User,
  path: string,
  options: { body?: unknown; method?: HttpMethod } = {},
): Promise<T> {
  const token = await activeUser.getIdToken();
  const response = await fetch(`/api/gogymgo/${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    headers: {
      authorization: `Bearer ${token}`,
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.method ? { "idempotency-key": crypto.randomUUID() } : {}),
    },
    method: options.method ?? "GET",
  });
  const payload = (await response.json().catch(() => null)) as
    | { error?: { code?: string; message?: string } }
    | T
    | null;
  if (!response.ok) {
    const apiError =
      typeof payload === "object" && payload !== null && "error" in payload
        ? (
            payload as {
              error?: { code?: string; message?: string };
            }
          ).error
        : undefined;
    const message =
      apiError?.message ?? "The GoGymGo API rejected this request.";
    const error = new Error(message || "The request could not be completed.");
    Object.assign(error, {
      code: apiError?.code,
      status: response.status,
    });
    throw error;
  }
  return payload as T;
}
