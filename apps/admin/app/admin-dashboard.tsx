"use client";

import { resolveFeatureCapabilities } from "@gogymgo/contracts/feature-capabilities";
import type { UpdateRegionWaitlistStatusDto } from "@gogymgo/contracts";
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
  AuditPage,
  AuditEvent,
  Competition,
  CreatorWorkout,
  DashboardSnapshot,
  FirebaseClientConfig,
  GymQrCredential,
  GymQrCredentialHistoryPage,
  LegalDocument,
  OperatorPortalAccess,
  PartnerCompetition,
  PartnerDashboardSnapshot,
  PartnerProposalActionResponse,
  ProfileMediaReviewAction,
  RegionPolicy,
  Reward,
  RewardAward,
  SystemHealth,
  WorkQueueDetail,
  WorkQueueItem,
  WorkQueueKind,
} from "./admin-types";
import { workQueueKinds } from "./admin-types";
import {
  AdminUserFacingError,
  adminRequestStatus,
  adminRequest,
  authErrorMessage,
  clearAdminRequestSession,
  compactObject,
  decodeGymQrCredential,
  decodeDashboardProposalVisibility,
  decodeGymQrCredentialHistoryPage,
  decodeOperatorPortalAccess,
  decodePartnerCompetitionPage,
  decodePartnerDashboardSnapshot,
  decodePartnerVisitPage,
  decodeAuditPage,
  decodeProfileMediaReviewAction,
  decodeSystemHealth,
  decodeWorkQueueDetail,
  decodeWorkQueuePage,
  errorMessage,
  formatDate,
  formatDateTime,
  formatQueueAge,
  getAuditChange,
  getQueueUrgency,
  isOperationalCompetition,
  isRewardConfigurableCompetition,
  optionalIso,
  optionalNumber,
  optionalString,
  toIso,
  toLocalDateTime,
  type HttpMethod,
} from "./admin-dashboard-utils";
import {
  canCancelContest,
  canDeleteContestFromDashboard,
  chooseSetupCompetition,
  isContestReadyToPublish,
} from "./contest-launch-flow";
import {
  contestWorkoutCutoffs,
  defaultCompetitionDatesInZone,
  defaultContestTimeZone,
  formatContestDateTime,
  toZonedDateTimeInput,
  zonedDateTimeToIso,
} from "./contest-schedule.js";
import {
  buildDrawSeedCommitment,
  canRevealPendingDraw,
  canFinalizeCompetitionResults,
  createPendingDrawFinalization,
  createDrawSeed,
  loadPendingDrawFinalization,
  savePendingDrawFinalization,
} from "./draw-finalization.js";
import {
  assertGymQrCredentialScope,
  PilotOperationsPanel,
  PosterPreview,
  type PilotData,
} from "./pilot-operations";
import { downloadPosterJpeg } from "./poster-jpeg";
import {
  genericAdministrativeReasons,
  ReasonPresetChips,
} from "./reason-presets";
import { formValidationError } from "./form-validation";
import { parseCoordinate } from "./coordinate-input.js";
import {
  ContestSetupWorkspace,
  type ContestSetupSubmission,
} from "./contest-setup-workspace";

type AuthStage =
  "checking" | "denied" | "error" | "expired" | "ready" | "signed-out";
type ConfirmAction = {
  actionLabel: string;
  auditReason?: string;
  description: string;
  execute: (reason: string) => Promise<void>;
  tone?: "danger" | "primary";
};

type AdminEntityResult = {
  id: string;
  status: string;
  version: number;
};

type QueueDecisionBody = {
  decision: string;
  evidenceSnapshotSha256?: string;
  expectedVersion: number;
  findings?: Record<string, string>;
  reason: string;
};

type CouponCodesResult = {
  added: number;
  rewardId: string;
  version: number;
};

type CompetitionPublicationPreflight = {
  checks: Array<{ detail: string; key: string; satisfied: boolean }>;
  competitionId: string;
  evaluatedAt: string;
  evidence: Record<string, unknown>;
  ready: boolean;
  version: number;
};

type PendingDrawFinalization = ReturnType<typeof createPendingDrawFinalization>;

type DrawLockResult = {
  entrantCount: number;
  entrantSnapshotHash: string;
  id: string;
  lockedAt: string;
  publicResultSnapshotHash: string;
  rewardSlotCount: number;
  rewardSnapshotHash: string;
  scoringSnapshotHash: string;
  status: "locked" | "settled";
  totalEntries: string;
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
    description: "Review every existing contest from one place.",
    id: "overview",
    label: "Contest home",
    short: "OV",
  },
  {
    description: "Create, review and publish the complete contest on one page.",
    id: "competitions",
    label: "Contest setup",
    short: "CS",
  },
  {
    description: "Create policy artifacts and enable or retire launch regions.",
    id: "regions",
    label: "Regions",
    short: "RG",
  },
  {
    description: "Configure approved inventory and winner fulfillment states.",
    id: "rewards",
    label: "Rewards",
    short: "RW",
  },
  {
    description:
      "Create and maintain Partner gyms, Contest assignments and QR posters.",
    id: "pilot",
    label: "Partner gyms",
    short: "PG",
  },
  {
    description: "Manage Creator workouts and published legal content.",
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
  "competitions",
  "operations",
]);
const { creatorFeaturesEnabled: creatorAdminBuildEnabled } =
  resolveFeatureCapabilities({
    creatorFeaturesEnabled: process.env.NEXT_PUBLIC_ENABLE_CREATOR_FEATURES,
  });

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

function BrandMark() {
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

function BrandWordmark() {
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
          aria-label={item.label}
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
              aria-label={item.label}
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
  verifiedSessionCategoryScore: 1,
  verifiedSessionPrizeDrawEntries: 1,
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
  const [queueNextCursor, setQueueNextCursor] = useState<string | null>(null);
  const [queueError, setQueueError] = useState("");
  const [healthError, setHealthError] = useState("");
  const [auditPage, setAuditPage] = useState<AuditPage>({
    items: [],
    nextCursor: null,
  });
  const [auditError, setAuditError] = useState("");
  const [pilotData, setPilotData] = useState<PilotData>(emptyPilotData);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [loadError, setLoadError] = useState(
    firebaseConfigured
      ? ""
      : "Firebase sign-in has not been configured for this dashboard build.",
  );
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authAttempt, setAuthAttempt] = useState(0);
  const authEpoch = useRef(0);
  const [rewardEditor, setRewardEditor] = useState<Reward | "new" | null>(null);
  const [regionEditor, setRegionEditor] = useState(false);
  const [gymEditor, setGymEditor] = useState(false);
  const [setupCompetitionId, setSetupCompetitionId] = useStoredPreference(
    "gogymgo.admin.setup.competition-id",
    "",
  );
  const [contestHomeId, setContestHomeId] = useStoredPreference(
    "gogymgo.admin.contest-home-id",
    "",
  );
  const [workoutEditor, setWorkoutEditor] = useState<
    CreatorWorkout | "new" | null
  >(null);
  const [legalEditor, setLegalEditor] = useState(false);
  const [couponReward, setCouponReward] = useState<Reward | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null,
  );
  const [pendingDrawFinalization, setPendingDrawFinalization] =
    useState<PendingDrawFinalization | null>(null);

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

  const loadActiveQr = useCallback(
    (competitionId: string, gymId: string) =>
      request<GymQrCredential | null>(
        `operator/competitions/${competitionId}/gym-locations/${gymId}/qr-credentials/active`,
      ),
    [request],
  );

  const refresh = useCallback(
    async (activeUser: User, expectedEpoch?: number) => {
      const refreshEpoch = expectedEpoch ?? authEpoch.current;
      setBusy(true);
      setLoadError("");
      try {
        const access = decodeOperatorPortalAccess(
          await adminRequest<unknown>(activeUser, "operator/access"),
        );
        if (authEpoch.current !== refreshEpoch) return;
        setPortalAccess(access);
        if (access.portal === "partner") {
          const partnerResult = decodePartnerDashboardSnapshot(
            await adminRequest<unknown>(
              activeUser,
              "operator/partner-dashboard",
            ),
          );
          if (authEpoch.current !== refreshEpoch) return;
          setPartnerSnapshot(partnerResult);
          setSnapshot(null);
          setHealth(null);
          setQueue([]);
          setQueueNextCursor(null);
          setQueueError("");
          setHealthError("");
          setAuditPage({ items: [], nextCursor: null });
          setAuditError("");
          setPilotData(emptyPilotData);
          setLastRefreshedAt(new Date());
          setAuthStage("ready");
          return;
        }
        const [
          dashboardResult,
          gyms,
          sessions,
          waitlist,
          interestSubmissions,
          partnerApplications,
        ] = await Promise.all([
          adminRequest<unknown>(activeUser, "operator/configuration/dashboard"),
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
        ]);
        if (authEpoch.current !== refreshEpoch) return;
        setSnapshot(decodeDashboardProposalVisibility(dashboardResult));
        setPartnerSnapshot(null);
        const [healthResult, queueResult, auditResult] =
          await Promise.allSettled([
            adminRequest<unknown>(activeUser, "operator/system-health"),
            adminRequest<unknown>(activeUser, "operator/work-queue?limit=100"),
            adminRequest<unknown>(
              activeUser,
              "operator/audit-history?limit=50",
            ),
          ]);
        if (authEpoch.current !== refreshEpoch) return;
        if (healthResult.status === "fulfilled") {
          try {
            setHealth(decodeSystemHealth(healthResult.value));
            setHealthError("");
          } catch (error) {
            setHealth(null);
            setHealthError(errorMessage(error));
          }
        } else {
          setHealth(null);
          setHealthError(errorMessage(healthResult.reason));
        }
        let auditEvents: AuditEvent[] = [];
        if (queueResult.status === "fulfilled") {
          try {
            const page = decodeWorkQueuePage(queueResult.value);
            setQueue(page.items);
            setQueueNextCursor(page.nextCursor);
            setQueueError("");
          } catch (error) {
            setQueue([]);
            setQueueNextCursor(null);
            setQueueError(errorMessage(error));
          }
        } else {
          setQueue([]);
          setQueueNextCursor(null);
          setQueueError(errorMessage(queueResult.reason));
        }
        if (auditResult.status === "fulfilled") {
          try {
            const page = decodeAuditPage(auditResult.value);
            auditEvents = page.items;
            setAuditPage(page);
            setAuditError("");
          } catch (error) {
            setAuditPage({ items: [], nextCursor: null });
            setAuditError(errorMessage(error));
          }
        } else {
          setAuditPage({ items: [], nextCursor: null });
          setAuditError(errorMessage(auditResult.reason));
        }
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
        if (authEpoch.current !== refreshEpoch) return;
        const status = adminRequestStatus(error);
        if (status === 401) setAuthStage("expired");
        else if (status === 403) setAuthStage("denied");
        else setAuthStage("error");
        setLoadError(errorMessage(error));
      } finally {
        if (authEpoch.current === refreshEpoch) setBusy(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!firebaseConfigured) return;
    try {
      const app =
        getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const auth = getAuth(app);
      let authStateResolved = false;
      const authStateTimeout = window.setTimeout(() => {
        if (authStateResolved) return;
        setAuthStage("error");
        setLoadError(
          "Your Firebase session could not be restored. Check your connection and retry the session check.",
        );
      }, 8_000);
      const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
        authStateResolved = true;
        window.clearTimeout(authStateTimeout);
        const nextEpoch = authEpoch.current + 1;
        authEpoch.current = nextEpoch;
        setUser(nextUser);
        setPortalAccess(null);
        setSnapshot(null);
        setPartnerSnapshot(null);
        if (nextUser) {
          setPendingDrawFinalization(
            loadPendingDrawFinalization(
              window.localStorage,
              nextUser.uid,
              window.location.origin,
            ),
          );
          setAuthStage("checking");
          void refresh(nextUser, nextEpoch);
        } else {
          setPendingDrawFinalization(null);
          setLoadError("");
          setAuthStage("signed-out");
        }
      });
      return () => {
        window.clearTimeout(authStateTimeout);
        unsubscribe();
      };
    } catch (error) {
      queueMicrotask(() => {
        setAuthStage("signed-out");
        setLoadError(authErrorMessage(error));
      });
      return;
    }
  }, [authAttempt, firebaseConfig, firebaseConfigured, refresh]);

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

  async function loadQueuePage(
    kind?: WorkQueueKind,
    cursor?: string,
    append = false,
  ): Promise<void> {
    setQueueError("");
    try {
      const parameters = new URLSearchParams({ limit: "100" });
      if (kind) parameters.set("kind", kind);
      if (cursor) parameters.set("cursor", cursor);
      const page = decodeWorkQueuePage(
        await request<unknown>(`operator/work-queue?${parameters.toString()}`),
      );
      setQueue((current) =>
        append ? [...current, ...page.items] : page.items,
      );
      setQueueNextCursor(page.nextCursor);
    } catch (error) {
      setQueueError(errorMessage(error));
      throw error;
    }
  }

  async function loadAuditPage(
    search?: string,
    cursor?: string,
    append = false,
  ): Promise<void> {
    setAuditError("");
    try {
      const parameters = new URLSearchParams({ limit: "50" });
      if (search?.trim()) parameters.set("search", search.trim());
      if (cursor) parameters.set("cursor", cursor);
      const page = decodeAuditPage(
        await request<unknown>(
          `operator/audit-history?${parameters.toString()}`,
        ),
      );
      setAuditPage((current) => ({
        items: append ? [...current.items, ...page.items] : page.items,
        nextCursor: page.nextCursor,
      }));
    } catch (error) {
      setAuditError(errorMessage(error));
      throw error;
    }
  }

  async function loadQueueDetail(
    item: WorkQueueItem,
  ): Promise<WorkQueueDetail> {
    return decodeWorkQueueDetail(
      await request<unknown>(`operator/work-queue/${item.kind}/${item.id}`),
    );
  }

  async function loadProfileMediaReviewAction(
    mediaId: string,
  ): Promise<ProfileMediaReviewAction> {
    return decodeProfileMediaReviewAction(
      await request<unknown>(`operator/profile-media/${mediaId}/review-action`),
    );
  }

  async function decideQueueItem(
    item: WorkQueueDetail,
    body: QueueDecisionBody,
  ): Promise<void> {
    const route = (() => {
      if (item.kind === "workout_session") {
        return `operator/sessions/${item.id}/${body.decision === "verified" ? "verify" : "reject"}`;
      }
      if (item.kind === "region_verification") {
        return `operator/region-verifications/${item.id}/decision`;
      }
      if (item.kind === "partner_application") {
        return `operator/partner-applications/${item.id}/decision`;
      }
      if (item.kind === "privacy_request") {
        return `operator/privacy-requests/${item.id}/decision`;
      }
      if (item.kind === "profile_media") {
        return `operator/profile-media/${item.id}/decision`;
      }
      if (item.kind === "creator_submission") {
        return `operator/creator-submissions/${item.id}/decision`;
      }
      return `operator/region-waitlist/${item.id}/status`;
    })();
    const requestBody =
      item.kind === "region_waitlist"
        ? {
            expectedVersion: body.expectedVersion,
            reason: body.reason,
            status: body.decision,
          }
        : body;
    await mutate("Review decision recorded.", route, "POST", requestBody);
  }

  async function handleEmailSignIn(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setLoadError("");
    const validationError = formValidationError(event.currentTarget);
    if (validationError) {
      setLoadError(validationError);
      return;
    }
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const rememberMe = form.get("rememberMe") === "on";
    setSigningIn(true);
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
    } finally {
      setSigningIn(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    setLoadError("");
    try {
      await signOut(getAuth());
      authEpoch.current += 1;
      clearAdminRequestSession();
      setPendingDrawFinalization(null);
      setUser(null);
      setPortalAccess(null);
      setSnapshot(null);
      setPartnerSnapshot(null);
      setHealth(null);
      setQueue([]);
      setQueueNextCursor(null);
      setQueueError("");
      setHealthError("");
      setAuditPage({ items: [], nextCursor: null });
      setAuditError("");
      setPilotData(emptyPilotData);
      setLastRefreshedAt(null);
      setAuthStage("signed-out");
    } catch {
      setLoadError(
        "Sign-out could not be completed. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (
    authStage === "signed-out" ||
    authStage === "denied" ||
    authStage === "expired"
  ) {
    return (
      <SignInScreen
        busy={busy}
        denied={authStage === "denied"}
        error={loadError}
        expired={authStage === "expired"}
        firebaseConfigured={firebaseConfigured}
        onEmailSignIn={handleEmailSignIn}
        onSignOut={user ? handleSignOut : undefined}
        signingIn={signingIn}
        signedInEmail={user?.email ?? undefined}
      />
    );
  }

  if (authStage === "error") {
    return (
      <AccessResolutionError
        busy={busy}
        error={loadError}
        onRetry={() => {
          if (user) {
            void refresh(user);
          } else {
            setLoadError("");
            setAuthStage("checking");
            setAuthAttempt((attempt) => attempt + 1);
          }
        }}
        onSignOut={handleSignOut}
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
            <small>OPERATOR PORTAL</small>
          </span>
        </div>
        <div className="boot-line" />
        <p>
          {loadError ||
            "CHECKING YOUR SESSION · INVITATION-ONLY OPERATOR ACCESS"}
        </p>
      </div>
    );
  }

  if (portalAccess?.portal === "partner" && partnerSnapshot) {
    return (
      <PartnerWorkspace
        busy={busy}
        error={loadError}
        key={`${user?.uid ?? "partner"}:${partnerSnapshot.generatedAt}`}
        onDismissError={() => setLoadError("")}
        onMutate={mutate}
        onRequest={request}
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

  const setupCompetition = chooseSetupCompetition(
    snapshot.competitions,
    setupCompetitionId,
  );
  const setupCompetitions = snapshot.competitions.filter(
    (competition) => competition.status === "draft",
  );
  const operationalCompetitions = snapshot.competitions.filter(
    isOperationalCompetition,
  );
  const pilotCompetition =
    operationalCompetitions.find(
      (competition) => competition.id === setupCompetitionId,
    ) ??
    operationalCompetitions.find(
      (competition) => competition.status === "active",
    ) ??
    operationalCompetitions.find(
      (competition) => competition.status === "registration",
    ) ??
    operationalCompetitions[0] ??
    null;

  function navigateToSection(nextSection: AdminSection) {
    setSection(nextSection);
  }

  function selectSetupCompetition(nextCompetitionId: string) {
    setSetupCompetitionId(nextCompetitionId);
  }

  const draftCompetitions = snapshot.competitions.filter(
    (competition) => competition.status === "draft",
  );
  const publishReady = draftCompetitions.filter((competition) =>
    isContestReadyToPublish(
      competition,
      snapshot.rewards,
      snapshot.regions,
      pilotData.gyms,
      snapshot.legalDocuments,
    ),
  );
  const activeCompetitions = snapshot.competitions.filter((competition) =>
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
  };

  function requestContestDeletion(competition: Competition) {
    setConfirmAction({
      actionLabel: "Delete contest",
      description: `${competition.name} will be removed from the operating dashboard. Existing participation, results, and audit records will not be affected.`,
      execute: (reason) =>
        mutate(
          "Contest deleted from the dashboard.",
          `operator/configuration/competitions/${competition.id}`,
          "DELETE",
          { expectedVersion: competition.version, reason },
        ),
      tone: "danger",
    });
  }

  function requestContestStatus(
    competition: Competition,
    action: "cancel" | "publish",
  ) {
    setConfirmAction({
      actionLabel: action === "publish" ? "Publish contest" : "Cancel contest",
      auditReason:
        action === "publish"
          ? "Publish the approved contest after operator confirmation."
          : undefined,
      description:
        action === "publish"
          ? `${competition.name} will become visible and joinable in the player app immediately.`
          : `${competition.name} will stop immediately. Active workouts, rankings, and prize eligibility will close. Players will be notified, and you can then delete it from the dashboard.`,
      execute: async (reason) => {
        if (action === "publish") {
          await requireCompetitionPublicationPreflight(
            competition.id,
            competition.version,
          );
        }
        await mutate(
          action === "publish" ? "Contest published." : "Contest cancelled.",
          `operator/configuration/competitions/${competition.id}/status-action`,
          "POST",
          { action, expectedVersion: competition.version, reason },
        );
      },
      tone: action === "cancel" ? "danger" : "primary",
    });
  }

  async function requireCompetitionPublicationPreflight(
    competitionId: string,
    expectedVersion: number,
  ): Promise<CompetitionPublicationPreflight> {
    const preflight = await request<CompetitionPublicationPreflight>(
      `operator/configuration/competitions/${competitionId}/publication-preflight`,
    );
    if (!preflight.ready || preflight.version !== expectedVersion) {
      const blocker = preflight.checks.find((check) => !check.satisfied);
      const error = new AdminUserFacingError(
        preflight.version !== expectedVersion
          ? "The Contest changed during publication review. Refresh and inspect the current draft before retrying."
          : blocker?.detail ||
              "The authoritative publication prerequisites are not satisfied.",
      );
      Object.assign(error, {
        code: "COMPETITION_PUBLICATION_PREFLIGHT_BLOCKED",
        status: 409,
      });
      throw error;
    }
    return preflight;
  }

  async function finalizeContestResults(
    competition: Competition,
    reason: string,
  ) {
    setSubmitting(true);
    setLoadError("");
    try {
      if (!user) {
        throw new AdminUserFacingError(
          "Sign in before finalizing contest results.",
        );
      }
      const environmentOrigin = window.location.origin;
      if (
        pendingDrawFinalization &&
        pendingDrawFinalization.competitionId !== competition.id
      ) {
        throw new AdminUserFacingError(
          "Finish the saved draw publication before finalizing another contest.",
        );
      }
      let recovery =
        pendingDrawFinalization?.competitionId === competition.id
          ? pendingDrawFinalization
          : null;
      if (!recovery && competition.status === "active") {
        const seedReveal = createDrawSeed();
        const seedCommitment = await buildDrawSeedCommitment(seedReveal);
        recovery = createPendingDrawFinalization({
          competitionId: competition.id,
          environmentOrigin,
          operatorUserId: user.uid,
          seedCommitment,
          seedReveal,
        });
        setPendingDrawFinalization(recovery);
        try {
          savePendingDrawFinalization(
            window.localStorage,
            user.uid,
            environmentOrigin,
            recovery,
          );
        } catch {
          // The in-memory record remains usable for this signed-in session.
        }
      }
      if (competition.status === "active" && recovery) {
        const locked = await request<DrawLockResult>("operator/draws/lock", {
          body: {
            competitionId: competition.id,
            reason,
            seedCommitment: recovery.seedCommitment,
          },
          method: "POST",
        });
        if (
          locked.status !== "locked" ||
          !locked.id ||
          locked.entrantCount < 1 ||
          locked.rewardSlotCount < 1 ||
          !/^[1-9][0-9]*$/.test(locked.totalEntries) ||
          ![
            locked.entrantSnapshotHash,
            locked.scoringSnapshotHash,
            locked.rewardSnapshotHash,
            locked.publicResultSnapshotHash,
          ].every((value) => /^[a-f0-9]{64}$/.test(value))
        ) {
          throw new AdminUserFacingError(
            "The server returned incomplete draw-lock evidence. The saved seed was retained; refresh before retrying.",
          );
        }
        recovery = {
          ...recovery,
          drawId: locked.id,
        };
        setPendingDrawFinalization(recovery);
        try {
          savePendingDrawFinalization(
            window.localStorage,
            user.uid,
            environmentOrigin,
            recovery,
          );
        } catch {
          // The in-memory record remains usable for this signed-in session.
        }
        await refresh(user);
        setToast(
          "Draw snapshot locked. Review the evidence, then reveal and publish.",
        );
        return;
      }
      if (
        competition.status !== "settling" ||
        !recovery ||
        !competition.draw ||
        !canRevealPendingDraw(
          recovery,
          competition.draw,
          user.uid,
          environmentOrigin,
        )
      ) {
        throw new AdminUserFacingError(
          "This draw's exact saved seed is unavailable or does not match the locked commitment. Recover it in the original operator account and environment before publishing.",
        );
      }
      await request<AdminEntityResult>(
        `operator/draws/${competition.draw.id}/settle`,
        {
          body: { reason, seedReveal: recovery.seedReveal },
          method: "POST",
        },
      );
      setPendingDrawFinalization(null);
      try {
        savePendingDrawFinalization(
          window.localStorage,
          user.uid,
          environmentOrigin,
          null,
        );
      } catch {
        // The completed server state remains authoritative.
      }
      if (user) await refresh(user);
      setToast("Audited results published to the Winners Circle.");
    } catch (error) {
      setLoadError(errorMessage(error));
      if (user) await refresh(user);
      throw error;
    } finally {
      setSubmitting(false);
    }
  }

  function requestContestFinalization(competition: Competition) {
    setConfirmAction({
      actionLabel:
        competition.status === "settling"
          ? "Reveal + publish"
          : "Lock audited draw snapshot",
      auditReason:
        "Finalize the ended contest and publish its audited Winners Circle results.",
      description:
        competition.status === "settling"
          ? `${competition.name}'s entrant and reward snapshots are locked. Verify the evidence, then reveal the matching saved seed and publish the deterministic result.`
          : `${competition.name}'s completion period is over. This locks one immutable entrant, scoring, identity, and reward snapshot for review; it does not publish winners yet.`,
      execute: (reason) => finalizeContestResults(competition, reason),
      tone: "primary",
    });
  }

  async function publishCompleteContestSetup(
    submission: ContestSetupSubmission,
    reportProgress: (message: string) => void,
  ) {
    setSubmitting(true);
    setLoadError("");
    try {
      reportProgress("Saving the contest details...");
      const competitionResult = await request<AdminEntityResult>(
        submission.competition
          ? `operator/configuration/competitions/${submission.competition.id}`
          : "operator/configuration/competitions",
        {
          body: submission.competition
            ? {
                ...submission.competitionBody,
                expectedVersion: submission.competition.version,
              }
            : submission.competitionBody,
          method: submission.competition ? "PUT" : "POST",
        },
      );
      const competitionId = competitionResult.id;

      if (submission.rewardBody) {
        reportProgress("Saving and publishing the reward...");
        const rewardResult = await request<AdminEntityResult>(
          submission.reward
            ? `operator/configuration/rewards/${submission.reward.id}`
            : "operator/configuration/rewards",
          {
            body: {
              ...submission.rewardBody,
              competitionId,
              ...(submission.reward
                ? { expectedVersion: submission.reward.version }
                : {}),
            },
            method: submission.reward ? "PUT" : "POST",
          },
        );
        let rewardVersion = rewardResult.version;
        if (submission.couponCodes.length > 0) {
          const couponResult = await request<CouponCodesResult>(
            `operator/configuration/rewards/${rewardResult.id}/coupon-codes`,
            {
              body: {
                codes: submission.couponCodes,
                expectedVersion: rewardVersion,
                reason:
                  "Add the approved coupon inventory during contest launch.",
              },
              method: "POST",
            },
          );
          rewardVersion = couponResult.version;
        }
        await request<AdminEntityResult>(
          `operator/configuration/rewards/${rewardResult.id}/status-action`,
          {
            body: {
              action: "publish",
              expectedVersion: rewardVersion,
              reason:
                "Publish the approved reward as part of the complete contest launch.",
            },
            method: "POST",
          },
        );
      }

      reportProgress("Assigning the Partner gym...");
      const gymId = submission.gymId;
      if (!gymId) {
        throw new AdminUserFacingError(
          "Choose an approved Partner gym before publishing the contest.",
        );
      }
      const alreadyAssigned =
        submission.competition?.assignedGymIds.includes(gymId);
      if (!alreadyAssigned) {
        await request(
          `operator/competitions/${competitionId}/gym-locations/${gymId}`,
          {
            body: {
              reason: "Assign the approved Partner gym during contest launch.",
            },
            method: "POST",
          },
        );
      }

      reportProgress("Preparing the contest QR poster...");
      let poster = await loadActiveQr(competitionId, gymId);
      if (!poster) {
        poster = await request<GymQrCredential>(
          `operator/competitions/${competitionId}/gym-locations/${gymId}/qr-credentials`,
          {
            body: {
              expectedCredentialVersion: null,
              reason:
                "Issue the contest-specific Partner gym poster during launch.",
            },
            method: "POST",
          },
        );
      }

      reportProgress("Checking authoritative launch prerequisites...");
      await requireCompetitionPublicationPreflight(
        competitionId,
        competitionResult.version,
      );
      reportProgress("Publishing the contest...");
      await request<AdminEntityResult>(
        `operator/configuration/competitions/${competitionId}/status-action`,
        {
          body: {
            action: "publish",
            expectedVersion: competitionResult.version,
            reason:
              "Publish the complete contest after the one-page administrative review.",
          },
          method: "POST",
        },
      );

      setSetupCompetitionId(competitionId);
      setContestHomeId(competitionId);
      if (user) await refresh(user);
      setSection("overview");
      setToast("Contest, reward, gym and QR poster published successfully.");
      return { competitionId, poster };
    } catch (error) {
      if (user) await refresh(user);
      throw error;
    } finally {
      setSubmitting(false);
    }
  }

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
              onClick={() => navigateToSection(item.id)}
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
          onNavigate={navigateToSection}
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
              activeCompetitions={activeCompetitions}
              competitions={snapshot.competitions.filter(
                (competition) => competition.status !== "draft",
              )}
              focusedContestId={contestHomeId}
              gyms={pilotData.gyms}
              health={health}
              onCreate={() => {
                setSetupCompetitionId("new");
                setSection("competitions");
              }}
              onDelete={requestContestDeletion}
              onFinalize={requestContestFinalization}
              onIssueQr={(competitionId, gymId, body) =>
                mutate(
                  "Printable QR poster issued.",
                  `operator/competitions/${competitionId}/gym-locations/${gymId}/qr-credentials`,
                  "POST",
                  body,
                )
              }
              onLoadActiveQr={loadActiveQr}
              publishReady={publishReady}
              queue={queue}
              rewards={snapshot.rewards}
              snapshot={snapshot}
              onNavigate={navigateToSection}
              onStatus={requestContestStatus}
              pendingDrawCompetitionId={
                user &&
                pendingDrawFinalization &&
                canRevealPendingDraw(
                  pendingDrawFinalization,
                  snapshot.competitions.find(
                    ({ id }) => id === pendingDrawFinalization.competitionId,
                  )?.draw ?? null,
                  user.uid,
                  typeof window === "undefined" ? "" : window.location.origin,
                )
                  ? pendingDrawFinalization.competitionId
                  : null
              }
              submitting={submitting}
            />
          ) : null}
          {section === "competitions" ? (
            <ContestSetupWorkspace
              competition={setupCompetition}
              competitions={setupCompetitions}
              gyms={pilotData.gyms}
              key={setupCompetition?.id ?? "new"}
              legalDocuments={snapshot.legalDocuments}
              onCreateGym={() => setGymEditor(true)}
              onCreateRegion={() => setRegionEditor(true)}
              onPublish={publishCompleteContestSetup}
              onSelectCompetition={selectSetupCompetition}
              regions={snapshot.regions}
              rewards={snapshot.rewards}
              submitting={submitting}
            />
          ) : null}
          {section === "pilot" ? (
            pilotCompetition ? (
              <>
                <section className="panel pilot-contest-selector">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">PARTNER GYM SCOPE</p>
                      <h2>Choose the Contest to manage</h2>
                      <p>
                        Assignment and QR actions remain locked to this exact
                        Contest. Gym records themselves remain platform-wide.
                      </p>
                    </div>
                    <label className="filter-field compact">
                      <span>CONTEST</span>
                      <select
                        onChange={(event) =>
                          setSetupCompetitionId(event.target.value)
                        }
                        value={pilotCompetition.id}
                      >
                        {operationalCompetitions.map((competition) => (
                          <option key={competition.id} value={competition.id}>
                            {competition.name} · {competition.status}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </section>
                <PilotOperationsPanel
                  {...pilotData}
                  cashAwards={snapshot.rewardAwards.filter(
                    (award) =>
                      award.competitionId === pilotCompetition.id &&
                      award.rewardType === "cash",
                  )}
                  key={pilotCompetition.id}
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
                  onDeleteGym={(gym) =>
                    setConfirmAction({
                      actionLabel: "Delete Partner gym",
                      description: `${gym.name} will be removed from the dashboard. Existing visit and audit records will not be affected.`,
                      execute: (reason) =>
                        mutate(
                          "Partner gym deleted from the dashboard.",
                          `operator/gym-locations/${gym.id}`,
                          "DELETE",
                          { expectedVersion: gym.version, reason },
                        ),
                      tone: "danger",
                    })
                  }
                  onIssueQr={(competitionId, gymId, body) =>
                    mutate(
                      "Printable QR poster issued.",
                      `operator/competitions/${competitionId}/gym-locations/${gymId}/qr-credentials`,
                      "POST",
                      body,
                    )
                  }
                  onLoadActiveQr={loadActiveQr}
                  onRecordCash={async (body) => {
                    await mutate(
                      "Cash handoff recorded.",
                      "operator/cash-fulfillments",
                      "POST",
                      body,
                    );
                  }}
                  onRevokeQr={async (competitionId, gymId, body) => {
                    await mutate(
                      "QR poster revoked.",
                      `operator/competitions/${competitionId}/gym-locations/${gymId}/qr-credentials/revoke`,
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
                  onUpdateWaitlist={async (
                    entryId,
                    body: UpdateRegionWaitlistStatusDto,
                  ) => {
                    await mutate(
                      "Regional waitlist status updated.",
                      `operator/region-waitlist/${entryId}/status`,
                      "POST",
                      body,
                    );
                  }}
                  regions={snapshot.regions}
                  selectedCompetition={pilotCompetition}
                  submitting={submitting}
                />
              </>
            ) : (
              <section className="panel">
                <EmptyState
                  body="Create a Contest draft before assigning Partner gyms or issuing Contest-specific QR posters."
                  title="No configurable Contest"
                />
                <button
                  className="primary-button"
                  onClick={() => setSection("competitions")}
                  type="button"
                >
                  CREATE CONTEST DRAFT
                </button>
              </section>
            )
          ) : null}
          {section === "rewards" ? (
            <RewardsPanel
              awards={snapshot.rewardAwards}
              competition={setupCompetition}
              onCouponCodes={setCouponReward}
              onCreate={() => setRewardEditor("new")}
              onDelete={(reward) =>
                setConfirmAction({
                  actionLabel: "Delete reward",
                  description: `${reward.title} will be removed from the dashboard. Existing award, redemption, and audit records will not be affected.`,
                  execute: (reason) =>
                    mutate(
                      "Reward deleted from the dashboard.",
                      `operator/configuration/rewards/${reward.id}`,
                      "DELETE",
                      { expectedVersion: reward.version, reason },
                    ),
                  tone: "danger",
                })
              }
              onEdit={setRewardEditor}
              onAwardStatus={(award, action) =>
                setConfirmAction({
                  actionLabel:
                    action === "cancel"
                      ? "Cancel award"
                      : action === "fulfill"
                        ? "Record fulfillment"
                        : "Record redemption",
                  description:
                    action === "cancel"
                      ? `${award.title} for ${award.winnerCallsign} will become unavailable. This cannot be reversed.`
                      : `${award.title} for ${award.winnerCallsign} will be recorded as ${action === "fulfill" ? "fulfilled" : "redeemed"}. No coupon plaintext is displayed in this dashboard.`,
                  execute: (reason) =>
                    mutate(
                      action === "cancel"
                        ? "Reward award cancelled."
                        : action === "fulfill"
                          ? "Physical reward fulfillment recorded."
                          : "Coupon redemption recorded.",
                      `operator/reward-awards/${award.id}/status-action`,
                      "POST",
                      {
                        action,
                        expectedVersion: award.version,
                        reason,
                      },
                    ),
                  tone: action === "cancel" ? "danger" : "primary",
                })
              }
              onStatus={(reward, action) =>
                setConfirmAction({
                  actionLabel:
                    action === "publish" ? "Publish reward" : "Archive reward",
                  description:
                    action === "publish"
                      ? `${reward.title} will become part of the public contest reward catalog.`
                      : `${reward.title} will be removed from the public reward catalog.`,
                  execute: async (reason) => {
                    await mutate(
                      action === "publish"
                        ? "Reward published. Continue by confirming the contest region."
                        : "Reward archived.",
                      `operator/configuration/rewards/${reward.id}/status-action`,
                      "POST",
                      { action, expectedVersion: reward.version, reason },
                    );
                    if (action === "publish") {
                      setSetupCompetitionId(reward.competitionId);
                      setSection("regions");
                    }
                  },
                  tone: action === "archive" ? "danger" : "primary",
                })
              }
              rewards={snapshot.rewards}
            />
          ) : null}
          {section === "regions" ? (
            <RegionsPanel
              evaluatedAt={snapshot.generatedAt}
              onCreate={() => setRegionEditor(true)}
              onDelete={(region) =>
                setConfirmAction({
                  actionLabel: "Delete region",
                  description: `${region.metroName} will be removed from the dashboard. Existing contest records will not be affected.`,
                  execute: (reason) =>
                    mutate(
                      "Region deleted from the dashboard.",
                      `operator/configuration/region-policies/${region.id}`,
                      "DELETE",
                      { expectedVersion: region.version, reason },
                    ),
                  tone: "danger",
                })
              }
              onStatus={(region, action) =>
                setConfirmAction({
                  actionLabel:
                    action === "enable" ? "Enable region" : "Disable region",
                  description:
                    action === "enable"
                      ? `${region.metroName} will become available to server-validated Contest and Creator configuration.`
                      : `${region.metroName} will stop accepting new configuration. Live contests must be cancelled or settled first.`,
                  execute: (reason) =>
                    mutate(
                      action === "enable"
                        ? "Region enabled."
                        : "Region disabled.",
                      `operator/configuration/region-policies/${region.id}/status-action`,
                      "POST",
                      { action, expectedVersion: region.version, reason },
                    ),
                  tone: action === "disable" ? "danger" : "primary",
                })
              }
              regions={snapshot.regions}
              selectedRegionId={setupCompetition?.regionPolicyId}
            />
          ) : null}
          {section === "content" ? (
            <ContentPanel
              creatorFeaturesEnabled={
                creatorAdminBuildEnabled &&
                snapshot.capabilities.creatorConfigurationEnabled
              }
              documents={snapshot.legalDocuments}
              legalPublicationOwner={
                snapshot.capabilities.legalPublicationOwner
              }
              onCreateDocument={() => setLegalEditor(true)}
              onCreateWorkout={() => setWorkoutEditor("new")}
              onDeleteWorkout={(workout) =>
                setConfirmAction({
                  actionLabel: "Delete workout",
                  description: `${workout.title} will be removed from the dashboard. Existing member planning and audit records will not be affected.`,
                  execute: (reason) =>
                    mutate(
                      "Creator workout deleted from the dashboard.",
                      `operator/configuration/creator-workouts/${workout.id}`,
                      "DELETE",
                      { expectedVersion: workout.version, reason },
                    ),
                  tone: "danger",
                })
              }
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
                      {
                        expectedVersion: document.lifecycleVersion,
                        reason,
                      },
                    ),
                  tone: "danger",
                })
              }
              workouts={snapshot.creatorWorkouts}
            />
          ) : null}
          {section === "operations" ? (
            <OperationsPanel
              events={auditPage.items}
              health={health}
              healthError={healthError}
              onDecide={decideQueueItem}
              onLoadDetail={loadQueueDetail}
              onLoadProfileMedia={loadProfileMediaReviewAction}
              onLoadQueue={loadQueuePage}
              onRetryHealth={() => {
                if (user) void refresh(user);
              }}
              queue={queue}
              queueError={queueError}
              queueNextCursor={queueNextCursor}
            />
          ) : null}
          {section === "audit" ? (
            <AuditPanel
              error={auditError}
              onLoad={loadAuditPage}
              page={auditPage}
            />
          ) : null}
        </div>
      </main>

      {rewardEditor ? (
        <RewardForm
          competitions={snapshot.competitions}
          competitionId={setupCompetition?.id}
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
            const rewardCompetitionId = String(body.competitionId ?? "");
            if (rewardCompetitionId) {
              setSetupCompetitionId(rewardCompetitionId);
            }
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
              "Region added.",
              "operator/configuration/region-policies",
              "POST",
              body,
            );
            setRegionEditor(false);
          }}
          submitting={submitting}
        />
      ) : null}
      {gymEditor ? (
        <GymLocationForm
          evaluatedAt={snapshot.generatedAt}
          onClose={() => setGymEditor(false)}
          onSubmit={async (body) => {
            await mutate(
              "Partner gym created.",
              "operator/gym-locations",
              "POST",
              body,
            );
            setGymEditor(false);
          }}
          regions={snapshot.regions}
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
              { codes, expectedVersion: couponReward.version, reason },
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

function AccessResolutionError({
  busy,
  error,
  onRetry,
  onSignOut,
}: {
  busy: boolean;
  error: string;
  onRetry: () => void;
  onSignOut: () => Promise<void>;
}) {
  return (
    <main className="access-resolution-screen">
      <section className="sign-in-panel">
        <p className="eyebrow">INVITATION-ONLY OPERATOR ACCESS</p>
        <h1>We could not confirm your workspace</h1>
        <p className="form-error" role="alert">
          {error ||
            "The operator access service is temporarily unavailable. Try again."}
        </p>
        <button
          aria-busy={busy}
          className="primary-button full"
          disabled={busy}
          onClick={onRetry}
          type="button"
        >
          {busy ? "CHECKING ACCESS…" : "RETRY ACCESS CHECK"}
        </button>
        <button
          className="secondary-button full"
          disabled={busy}
          onClick={() => void onSignOut()}
          type="button"
        >
          SIGN OUT
        </button>
      </section>
    </main>
  );
}

function SignInScreen({
  busy,
  denied,
  error,
  expired,
  firebaseConfigured,
  onEmailSignIn,
  onSignOut,
  signingIn,
  signedInEmail,
}: {
  busy: boolean;
  denied: boolean;
  error: string;
  expired: boolean;
  firebaseConfigured: boolean;
  onEmailSignIn: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSignOut?: () => Promise<void>;
  signingIn: boolean;
  signedInEmail?: string;
}) {
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
            Your account role decides which tools and gym data you can access.
          </p>
          <span>02</span>
          <p>
            <strong>Every change is traceable</strong>
            Reasons, previous states and new states are recorded in the audit
            history.
          </p>
        </div>
      </section>
      <section className="sign-in-panel">
        <p className="eyebrow">INVITATION-ONLY OPERATOR ACCESS</p>
        <h2>
          {expired
            ? "Your session expired"
            : denied
              ? "Operator access required"
              : "Sign in to continue"}
        </h2>
        {denied || expired ? (
          <div className="alert error compact" role="alert">
            <span>!</span>
            <p>
              {error ||
                (expired
                  ? "Your Firebase session could not be renewed. Sign out before trying again."
                  : `${signedInEmail || "This account"} does not have operator access or an active gym assignment.`)}
            </p>
          </div>
        ) : null}
        {!firebaseConfigured ? (
          <p className="configuration-note" role="status">
            Sign-in is temporarily unavailable. Contact GoGymGo support and try
            again later.
          </p>
        ) : (denied || expired) && onSignOut ? (
          <button
            aria-busy={busy}
            className="primary-button full"
            disabled={busy}
            onClick={() => void onSignOut()}
            type="button"
          >
            {busy ? "SIGNING OUT…" : "SIGN OUT AND TRY ANOTHER ACCOUNT"}
          </button>
        ) : (
          <>
            <form
              aria-busy={signingIn}
              className="stacked-form"
              noValidate
              onSubmit={(event) => void onEmailSignIn(event)}
            >
              <label>
                OPERATOR EMAIL
                <input
                  autoComplete="username"
                  disabled={signingIn}
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
                  disabled={signingIn}
                  minLength={8}
                  name="password"
                  placeholder="Your account password"
                  required
                  type="password"
                />
              </label>
              <label className="remember-session">
                <input disabled={signingIn} name="rememberMe" type="checkbox" />
                <span>Keep me signed in on this device</span>
              </label>
              <button
                className="primary-button full"
                disabled={signingIn}
                type="submit"
              >
                {signingIn ? "SIGNING IN…" : "SIGN IN SECURELY"}
              </button>
              {error && firebaseConfigured ? (
                <p className="form-error" role="alert">
                  {error}
                </p>
              ) : null}
            </form>
          </>
        )}
        <p className="fine-print">
          Your account role and assigned gyms determine what you can access.
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
  onRequest,
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
  onRequest: <T = unknown>(
    path: string,
    options?: { body?: unknown; method?: HttpMethod },
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
  const [competitionPage, setCompetitionPage] = useState(snapshot.competitions);
  const [visitPage, setVisitPage] = useState(snapshot.visits);
  const [pageError, setPageError] = useState("");
  const [loadingMore, setLoadingMore] = useState<
    "competitions" | "visits" | null
  >(null);
  const [qrError, setQrError] = useState("");
  const [credentialHistory, setCredentialHistory] = useState<
    Record<string, GymQrCredentialHistoryPage>
  >({});
  const activeNavigation =
    partnerNavigation.find((item) => item.id === section) ??
    partnerNavigation[0];
  const adminGyms = snapshot.gyms.filter((gym) => gym.accessLevel === "admin");
  const proposalsAwaitingReview = snapshot.overview.submittedProposalCount;

  async function loadMoreCompetitions() {
    if (!competitionPage.nextCursor) return;
    setLoadingMore("competitions");
    setPageError("");
    try {
      const page = decodePartnerCompetitionPage(
        await onRequest<unknown>(
          `operator/partner-competitions?limit=25&cursor=${encodeURIComponent(competitionPage.nextCursor)}`,
        ),
      );
      setCompetitionPage((current) => ({
        items: [...current.items, ...page.items],
        nextCursor: page.nextCursor,
      }));
    } catch (error) {
      setPageError(errorMessage(error));
    } finally {
      setLoadingMore(null);
    }
  }

  async function loadMoreVisits() {
    if (!visitPage.nextCursor) return;
    setLoadingMore("visits");
    setPageError("");
    try {
      const page = decodePartnerVisitPage(
        await onRequest<unknown>(
          `operator/partner-visits?limit=25&cursor=${encodeURIComponent(visitPage.nextCursor)}`,
        ),
      );
      setVisitPage((current) => ({
        items: [...current.items, ...page.items],
        nextCursor: page.nextCursor,
      }));
    } catch (error) {
      setPageError(errorMessage(error));
    } finally {
      setLoadingMore(null);
    }
  }

  async function issueQr(
    competitionId: string,
    competitionName: string,
    gymId: string,
    gymName: string,
    expectedCredentialVersion: number | null,
  ) {
    if (
      !window.confirm(
        `Issue a new ${competitionName} QR poster for ${gymName}? Only the current poster for this contest will stop working.`,
      )
    ) {
      return;
    }
    setQrError("");
    try {
      const credential = decodeGymQrCredential(
        await onMutate<unknown>(
          "New QR poster issued.",
          `operator/competitions/${competitionId}/gym-locations/${gymId}/qr-credentials`,
          "POST",
          {
            expectedCredentialVersion,
            reason: "Issue a gym QR poster from the scoped partner workspace.",
          },
        ),
      );
      if (!credential)
        throw new AdminUserFacingError("No poster was returned.");
      await downloadPosterJpeg(
        credential.printablePosterSvg,
        `${competitionName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${gymName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-poster.jpg`,
      );
    } catch (error) {
      setQrError(errorMessage(error));
    }
  }

  async function revokeQr(
    competitionId: string,
    competitionName: string,
    gymId: string,
    gymName: string,
    expectedCredentialVersion: number,
  ) {
    if (
      !window.confirm(
        `Revoke the ${competitionName} QR poster for ${gymName}? Other contest posters at this gym will keep working.`,
      )
    ) {
      return;
    }
    setQrError("");
    try {
      await onMutate(
        "QR poster revoked.",
        `operator/competitions/${competitionId}/gym-locations/${gymId}/qr-credentials/revoke`,
        "POST",
        {
          expectedCredentialVersion,
          reason: "Revoke the gym QR poster from the scoped partner workspace.",
        },
      );
    } catch (error) {
      setQrError(errorMessage(error));
    }
  }

  async function recoverQr(
    competitionId: string,
    competitionName: string,
    gymId: string,
    gymName: string,
  ) {
    setQrError("");
    try {
      const credential = decodeGymQrCredential(
        await onRequest<unknown>(
          `operator/competitions/${competitionId}/gym-locations/${gymId}/qr-credentials/active`,
        ),
      );
      if (!credential) {
        throw new AdminUserFacingError(
          "No active poster is available. Reload the Contest before retrying.",
        );
      }
      await downloadPosterJpeg(
        credential.printablePosterSvg,
        `${competitionName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${gymName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-poster.jpg`,
      );
    } catch (error) {
      setQrError(errorMessage(error));
    }
  }

  async function loadCredentialHistory(
    competitionId: string,
    gymId: string,
    cursor?: string,
  ) {
    setQrError("");
    try {
      const query = new URLSearchParams({ limit: "25" });
      if (cursor) query.set("cursor", cursor);
      const page = decodeGymQrCredentialHistoryPage(
        await onRequest<unknown>(
          `operator/competitions/${competitionId}/gym-locations/${gymId}/qr-credentials?${query.toString()}`,
        ),
      );
      setCredentialHistory((current) => ({
        ...current,
        [competitionId]: {
          items: cursor
            ? [...(current[competitionId]?.items ?? []), ...page.items]
            : page.items,
          nextCursor: page.nextCursor,
        },
      }));
    } catch (error) {
      setQrError(errorMessage(error));
    }
  }

  async function changeProposalStatus(
    competition: PartnerCompetition,
    action: "archive" | "submit" | "withdraw",
  ) {
    if (competition.proposalVersion === null) return;
    setPageError("");
    try {
      await onMutate<PartnerProposalActionResponse>(
        `Proposal ${action === "submit" ? "submitted for review" : action === "withdraw" ? "withdrawn" : "archived"}.`,
        `operator/partner-proposals/${competition.id}/status-action`,
        "POST",
        {
          action,
          expectedVersion: competition.proposalVersion,
          reason: `${action} the gym-owned Contest proposal from the Partner workspace.`,
        },
      );
    } catch (error) {
      setPageError(errorMessage(error));
    }
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
                  <strong>{snapshot.overview.draftProposalCount}</strong>
                  <small>Editable gym-owned drafts</small>
                </button>
                <button
                  className="metric"
                  onClick={() => setSection("visits")}
                  type="button"
                >
                  <span>ACTIVE VISITS</span>
                  <strong>{snapshot.overview.activeVisitCount}</strong>
                  <small>Aggregate sessions in progress</small>
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
                  <p>View each assigned gym and manage its QR posters.</p>
                </div>
              </div>
              <div className="card-list partner-gym-list">
                {snapshot.gyms.map((gym) => (
                  <article className="competition-card" key={gym.id}>
                    <div className="card-title-row">
                      <div>
                        <span className="status-tag active">
                          ACTIVE ASSIGNMENT
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
                        CONTEST POSTERS{" "}
                        <strong>
                          {(gym.activeQrCredentials ?? []).length} ACTIVE
                        </strong>
                      </span>
                      <span>
                        Radius <strong>{gym.radiusMeters} m</strong>
                      </span>
                    </div>
                    <p className="action-guidance compact">
                      {gym.accessLevel === "admin"
                        ? "Published gym-owned Contest posters can be managed from Contests."
                        : "Staff access is read-only. Poster and proposal changes require a gym admin assignment."}
                    </p>
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
              {competitionPage.items.length === 0 ? (
                <EmptyState
                  body="Gym administrators can submit the first local contest proposal for GoGymGo review."
                  title="No contest proposals yet"
                />
              ) : (
                <div className="card-list">
                  {competitionPage.items.map((competition) => {
                    const competitionGym = snapshot.gyms.find(
                      (gym) => gym.id === competition.gymLocationId,
                    );
                    const activeCredentialVersion =
                      competitionGym?.activeQrCredentials.find(
                        (credential) =>
                          credential.competitionId === competition.id,
                      )?.credentialVersion ?? null;
                    const canEdit =
                      competition.competitionStatus === "draft" &&
                      ["draft", "withdrawn"].includes(
                        competition.proposalStatus ?? "",
                      ) &&
                      adminGyms.some(
                        (gym) => gym.id === competition.gymLocationId,
                      );
                    const canManagePoster =
                      competition.proposalStatus === "published" &&
                      ["registration", "active"].includes(
                        competition.competitionStatus,
                      ) &&
                      competitionGym?.accessLevel === "admin";
                    const history = credentialHistory[competition.id];
                    return (
                      <article
                        className="competition-card"
                        key={competition.id}
                      >
                        <div className="card-title-row">
                          <div>
                            <span
                              className={`status-tag ${competition.proposalStatus ?? competition.competitionStatus}`}
                            >
                              {competition.proposalStatus
                                ? `PROPOSAL ${competition.proposalStatus}`
                                : competition.competitionStatus}
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
                        {canEdit || competitionGym?.accessLevel === "admin" ? (
                          <div className="card-actions">
                            {canEdit ? (
                              <button
                                className="secondary-button"
                                onClick={() =>
                                  setCompetitionEditor(competition)
                                }
                                type="button"
                              >
                                EDIT PROPOSAL
                              </button>
                            ) : null}
                            {competitionGym?.accessLevel === "admin" &&
                            ["draft", "withdrawn"].includes(
                              competition.proposalStatus ?? "",
                            ) ? (
                              <>
                                <button
                                  className="primary-button"
                                  disabled={submitting}
                                  onClick={() =>
                                    void changeProposalStatus(
                                      competition,
                                      "submit",
                                    )
                                  }
                                  type="button"
                                >
                                  SUBMIT FOR GOGYMGO REVIEW
                                </button>
                                <button
                                  className="danger-button"
                                  disabled={submitting}
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `Archive ${competition.name}? This preserves its GoGymGo review provenance and cannot be undone by the Partner portal.`,
                                      )
                                    ) {
                                      void changeProposalStatus(
                                        competition,
                                        "archive",
                                      );
                                    }
                                  }}
                                  type="button"
                                >
                                  ARCHIVE PROPOSAL
                                </button>
                              </>
                            ) : null}
                            {competitionGym?.accessLevel === "admin" &&
                            competition.proposalStatus === "submitted" ? (
                              <button
                                className="secondary-button"
                                disabled={submitting}
                                onClick={() =>
                                  void changeProposalStatus(
                                    competition,
                                    "withdraw",
                                  )
                                }
                                type="button"
                              >
                                WITHDRAW FROM REVIEW
                              </button>
                            ) : null}
                            {competitionGym?.accessLevel === "admin" ? (
                              <>
                                <button
                                  className="primary-button"
                                  disabled={submitting || !canManagePoster}
                                  onClick={() =>
                                    void issueQr(
                                      competition.id,
                                      competition.name,
                                      competitionGym.id,
                                      competitionGym.name,
                                      activeCredentialVersion,
                                    )
                                  }
                                  type="button"
                                >
                                  {activeCredentialVersion
                                    ? "REISSUE THIS CONTEST POSTER"
                                    : "ISSUE THIS CONTEST POSTER"}
                                </button>
                                {activeCredentialVersion ? (
                                  <button
                                    className="danger-button"
                                    disabled={submitting || !canManagePoster}
                                    onClick={() =>
                                      void revokeQr(
                                        competition.id,
                                        competition.name,
                                        competitionGym.id,
                                        competitionGym.name,
                                        activeCredentialVersion,
                                      )
                                    }
                                    type="button"
                                  >
                                    REVOKE THIS CONTEST QR
                                  </button>
                                ) : null}
                                {activeCredentialVersion ? (
                                  <button
                                    className="secondary-button"
                                    disabled={submitting || !canManagePoster}
                                    onClick={() =>
                                      void recoverQr(
                                        competition.id,
                                        competition.name,
                                        competitionGym.id,
                                        competitionGym.name,
                                      )
                                    }
                                    type="button"
                                  >
                                    RECOVER / DOWNLOAD ACTIVE POSTER
                                  </button>
                                ) : null}
                                <button
                                  className="text-button"
                                  onClick={() =>
                                    void loadCredentialHistory(
                                      competition.id,
                                      competitionGym.id,
                                    )
                                  }
                                  type="button"
                                >
                                  VIEW SECRET-FREE HISTORY
                                </button>
                              </>
                            ) : null}
                          </div>
                        ) : null}
                        {competitionGym?.accessLevel === "staff" ? (
                          <div className="card-actions">
                            <button
                              className="text-button"
                              onClick={() =>
                                void loadCredentialHistory(
                                  competition.id,
                                  competitionGym.id,
                                )
                              }
                              type="button"
                            >
                              VIEW SECRET-FREE HISTORY
                            </button>
                          </div>
                        ) : null}
                        {!canManagePoster ? (
                          <p className="action-guidance compact">
                            Partner poster actions remain unavailable until the
                            proposal is submitted, published by GoGymGo, and the
                            Contest is open.
                          </p>
                        ) : null}
                        {history ? (
                          <div className="action-guidance compact">
                            {history.items.length === 0
                              ? "No credential history."
                              : history.items.map((credential) => (
                                  <span key={credential.id}>
                                    V{credential.credentialVersion} ·{" "}
                                    {credential.status.toUpperCase()} · issued{" "}
                                    {formatDateTime(credential.issuedAt)}
                                  </span>
                                ))}
                            {history.nextCursor && competitionGym ? (
                              <button
                                className="text-button"
                                onClick={() =>
                                  void loadCredentialHistory(
                                    competition.id,
                                    competitionGym.id,
                                    history.nextCursor ?? undefined,
                                  )
                                }
                                type="button"
                              >
                                LOAD MORE HISTORY
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
              {competitionPage.nextCursor ? (
                <button
                  className="secondary-button"
                  disabled={loadingMore === "competitions"}
                  onClick={() => void loadMoreCompetitions()}
                  type="button"
                >
                  {loadingMore === "competitions"
                    ? "LOADING…"
                    : "LOAD MORE CONTESTS"}
                </button>
              ) : null}
              {qrError || pageError ? (
                <div className="alert error" role="alert">
                  <span>!</span>
                  <p>{qrError || pageError}</p>
                  <button
                    onClick={() => {
                      setQrError("");
                      setPageError("");
                    }}
                    type="button"
                  >
                    Dismiss
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          {section === "visits" ? (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">LOCATION-CHECK ACTIVITY</p>
                  <h2>Gym visits</h2>
                  <p>
                    Only sessions recorded at your assigned locations appear
                    here.
                  </p>
                </div>
              </div>
              {visitPage.items.length === 0 ? (
                <EmptyState
                  body="Gym visits will appear after members complete a start location check."
                  title="No gym visits yet"
                />
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Gym</th>
                        <th>Status</th>
                        <th>Visits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visitPage.items.map((visit) => (
                        <tr key={`${visit.gymLocationId}:${visit.status}`}>
                          <td>{visit.gymName}</td>
                          <td>
                            <span className={`status-tag ${visit.status}`}>
                              {visit.status.replaceAll("_", " ")}
                            </span>
                          </td>
                          <td>{visit.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {visitPage.nextCursor ? (
                <button
                  className="secondary-button"
                  disabled={loadingMore === "visits"}
                  onClick={() => void loadMoreVisits()}
                  type="button"
                >
                  {loadingMore === "visits"
                    ? "LOADING…"
                    : "LOAD MORE VISIT GROUPS"}
                </button>
              ) : null}
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
                : "Contest proposal draft created.",
              editing
                ? `operator/partner-proposals/${editing.id}`
                : "operator/partner-proposals",
              editing ? "PUT" : "POST",
              body,
            );
            setCompetitionEditor(null);
          }}
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
  activeCompetitions,
  competitions,
  focusedContestId,
  gyms,
  health,
  onCreate,
  onDelete,
  onFinalize,
  onIssueQr,
  onLoadActiveQr,
  publishReady,
  queue,
  rewards,
  snapshot,
  onNavigate,
  onStatus,
  pendingDrawCompetitionId,
  submitting,
}: {
  activeCompetitions: Competition[];
  competitions: Competition[];
  focusedContestId: string;
  gyms: PilotData["gyms"];
  health: SystemHealth | null;
  onCreate: () => void;
  onDelete: (competition: Competition) => void;
  onFinalize: (competition: Competition) => void;
  onIssueQr: (
    competitionId: string,
    gymId: string,
    body: { expectedCredentialVersion: number | null; reason: string },
  ) => Promise<GymQrCredential>;
  onLoadActiveQr: (
    competitionId: string,
    gymId: string,
  ) => Promise<GymQrCredential | null>;
  publishReady: Competition[];
  queue: WorkQueueItem[];
  rewards: Reward[];
  snapshot: DashboardSnapshot;
  onNavigate: (section: AdminSection) => void;
  onStatus: (competition: Competition, action: "cancel") => void;
  pendingDrawCompetitionId: string | null;
  submitting: boolean;
}) {
  const [contestHomePoster, setContestHomePoster] =
    useState<GymQrCredential | null>(null);
  const [posterActionKey, setPosterActionKey] = useState<string | null>(null);
  const [posterActionMessage, setPosterActionMessage] = useState<{
    competitionId: string;
    message: string;
    tone: "error" | "success";
  } | null>(null);
  const autoLoadedContestId = useRef("");
  const draftRewards = snapshot.rewards.filter(
    (reward) => reward.status === "draft",
  ).length;
  const healthNeedsAttention = Boolean(
    health &&
    (health.worker.status === "degraded" ||
      health.worker.status === "stale" ||
      Object.values(health.providers).some((provider) =>
        ["unavailable", "unconfigured"].includes(provider.status),
      )),
  );
  const attentionCount = queue.length + (healthNeedsAttention ? 1 : 0);
  const oldestQueueItem = [...queue].sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  )[0];
  const oldestUrgency = oldestQueueItem
    ? getQueueUrgency(oldestQueueItem)
    : null;

  useEffect(() => {
    if (!focusedContestId || autoLoadedContestId.current === focusedContestId) {
      return;
    }
    const competition = competitions.find(
      (candidate) => candidate.id === focusedContestId,
    );
    const gym = competition
      ? gyms.find(
          (candidate) =>
            competition.assignedGymIds.includes(candidate.id) &&
            (candidate.activeQrCredentials ?? []).some(
              (credential) => credential.competitionId === competition.id,
            ),
        )
      : undefined;
    if (!competition || !gym) return;

    autoLoadedContestId.current = focusedContestId;
    let active = true;
    void onLoadActiveQr(competition.id, gym.id)
      .then((loaded) => {
        if (!active || !loaded) return;
        setContestHomePoster(
          assertGymQrCredentialScope(loaded, competition.id, gym.id),
        );
        setPosterActionMessage({
          competitionId: competition.id,
          message: `${competition.name}'s poster for ${gym.name} is loaded below.`,
          tone: "success",
        });
      })
      .catch((error) => {
        if (!active) return;
        setPosterActionMessage({
          competitionId: competition.id,
          message: errorMessage(error),
          tone: "error",
        });
      });
    return () => {
      active = false;
    };
  }, [competitions, focusedContestId, gyms, onLoadActiveQr]);

  async function loadContestHomePoster(
    competition: Competition,
    gym: PilotData["gyms"][number],
  ) {
    const actionKey = `load:${competition.id}:${gym.id}`;
    setPosterActionKey(actionKey);
    setPosterActionMessage(null);
    try {
      const loaded = await onLoadActiveQr(competition.id, gym.id);
      if (!loaded) {
        throw new AdminUserFacingError(
          `${competition.name} does not have an active QR poster for ${gym.name}. Issue it below.`,
        );
      }
      const credential = assertGymQrCredentialScope(
        loaded,
        competition.id,
        gym.id,
      );
      setContestHomePoster(credential);
      setPosterActionMessage({
        competitionId: competition.id,
        message: `${competition.name}'s poster for ${gym.name} is loaded below.`,
        tone: "success",
      });
    } catch (error) {
      setPosterActionMessage({
        competitionId: competition.id,
        message: errorMessage(error),
        tone: "error",
      });
    } finally {
      setPosterActionKey(null);
    }
  }

  async function issueContestHomePoster(
    competition: Competition,
    gym: PilotData["gyms"][number],
  ) {
    const actionKey = `issue:${competition.id}:${gym.id}`;
    setPosterActionKey(actionKey);
    setPosterActionMessage(null);
    try {
      const issued = await onIssueQr(competition.id, gym.id, {
        expectedCredentialVersion:
          (gym.activeQrCredentials ?? []).find(
            (credential) => credential.competitionId === competition.id,
          )?.credentialVersion ?? null,
        reason: `Issue the ${competition.name} contest-specific QR poster.`,
      });
      const credential = assertGymQrCredentialScope(
        issued,
        competition.id,
        gym.id,
      );
      setContestHomePoster(credential);
      setPosterActionMessage({
        competitionId: competition.id,
        message: `A new ${competition.name} poster for ${gym.name} is ready below. Older ${competition.name} posters for this gym no longer work. Other contest posters are unchanged.`,
        tone: "success",
      });
    } catch (error) {
      setPosterActionMessage({
        competitionId: competition.id,
        message: errorMessage(error),
        tone: "error",
      });
    } finally {
      setPosterActionKey(null);
    }
  }

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
              ? `${queue.length} loaded review item${queue.length === 1 ? " is" : "s are"} waiting.`
              : healthNeedsAttention
                ? "System health needs review."
                : activeCompetitions.length > 0
                  ? activeCompetitions.length === 1
                    ? "A contest is live."
                    : `${activeCompetitions.length} contests are live.`
                  : publishReady.length > 0
                    ? "Ready for a controlled launch."
                    : "Build the next contest."}
          </h2>
          <p>
            {queue.length > 0
              ? "Open Operations to inspect the authoritative item detail and server-permitted actions."
              : healthNeedsAttention
                ? "Open Operations to inspect the worker, lease, queue, and provider evidence."
                : activeCompetitions.length > 0
                  ? `${activeCompetitions.map((competition) => competition.name).join(" + ")} ${activeCompetitions.length === 1 ? "is" : "are"} public with ${activeCompetitions.reduce((total, competition) => total + competition.enrollmentCount, 0)} enrolled players.`
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
              CREATE / CONTINUE SETUP
            </button>
          </div>
        </div>
        <div className="hero-signal">
          <span>
            {attentionCount > 0
              ? String(attentionCount).padStart(2, "0")
              : activeCompetitions.length > 0
                ? String(activeCompetitions.length).padStart(2, "0")
                : "SAFE"}
          </span>
          <small>
            {attentionCount > 0
              ? "ATTENTION ITEMS"
              : activeCompetitions.length > 0
                ? activeCompetitions.length === 1
                  ? "PUBLIC CONTEST"
                  : "PUBLIC CONTESTS"
                : "NO PUBLIC CONTEST"}
          </small>
        </div>
      </section>
      <section className="panel contest-homes-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">EXISTING CONTEST HOMES</p>
            <h2>Your contests</h2>
            <p>
              Open a contest to review its schedule, rewards, assigned gyms and
              QR posters.
            </p>
          </div>
          <button className="primary-button" onClick={onCreate} type="button">
            + CREATE ANOTHER CONTEST
          </button>
        </div>
        {competitions.length === 0 ? (
          <EmptyState
            body="Create a contest draft to begin the guided setup. Once published, it receives its own home here."
            title="No existing contest homes"
          />
        ) : (
          <div className="contest-home-list">
            {competitions.map((competition) => {
              const contestTimeZone =
                snapshot.regions.find(
                  (region) => region.id === competition.regionPolicyId,
                )?.timezone ?? defaultContestTimeZone;
              const workoutCutoffs = contestWorkoutCutoffs(competition.endsAt);
              const assignedGyms = gyms.filter((gym) =>
                competition.assignedGymIds.includes(gym.id),
              );
              const qrReadyGyms = assignedGyms.filter((gym) =>
                (gym.activeQrCredentials ?? []).some(
                  (credential) => credential.competitionId === competition.id,
                ),
              );
              const contestRewards = rewards.filter(
                (reward) => reward.competitionId === competition.id,
              );
              return (
                <details
                  className="contest-home-card"
                  open={competition.id === focusedContestId || undefined}
                  key={competition.id}
                >
                  <summary>
                    <span className={`status-tag ${competition.status}`}>
                      {competition.status}
                    </span>
                    <span>
                      <strong>{competition.name}</strong>
                      <small>
                        {competition.regionName} · {competition.monthKey}
                      </small>
                    </span>
                    <b>OPEN CONTEST HOME</b>
                  </summary>
                  <div className="contest-home-body">
                    <div className="competition-stats">
                      <div>
                        <small>REGISTRATION</small>
                        <strong>
                          {formatContestDateTime(
                            competition.registrationOpensAt,
                            contestTimeZone,
                          )}{" "}
                          {" → "}
                          {formatContestDateTime(
                            competition.registrationClosesAt,
                            contestTimeZone,
                          )}
                        </strong>
                      </div>
                      <div>
                        <small>CONTEST</small>
                        <strong>
                          {formatContestDateTime(
                            competition.startsAt,
                            contestTimeZone,
                          )}{" "}
                          {" → "}
                          {formatContestDateTime(
                            competition.endsAt,
                            contestTimeZone,
                          )}
                        </strong>
                      </div>
                      <div>
                        <small>WORKOUTS START</small>
                        <strong>
                          {workoutCutoffs
                            ? `BEFORE ${formatContestDateTime(
                                workoutCutoffs.startBefore,
                                contestTimeZone,
                              )}`
                            : "NOT SET"}
                        </strong>
                      </div>
                      <div>
                        <small>IN-PROGRESS WORKOUTS FINISH</small>
                        <strong>
                          {workoutCutoffs
                            ? `BEFORE ${formatContestDateTime(
                                workoutCutoffs.completionDeadline,
                                contestTimeZone,
                              )}`
                            : "NOT SET"}
                        </strong>
                      </div>
                      <div>
                        <small>ENROLLED</small>
                        <strong>{competition.enrollmentCount}</strong>
                      </div>
                      <div>
                        <small>REWARDS</small>
                        <strong>
                          {contestRewards.length} TOTAL ·{" "}
                          {competition.publishedRewardCount} PUBLISHED
                        </strong>
                      </div>
                      <div>
                        <small>GYMS + POSTERS</small>
                        <strong>
                          {assignedGyms.length} GYM
                          {assignedGyms.length === 1 ? "" : "S"} ·{" "}
                          {qrReadyGyms.length} CONTEST QR
                        </strong>
                      </div>
                    </div>
                    <div className="contest-home-resources">
                      <div>
                        <small>ASSIGNED PARTNER GYMS</small>
                        <p>
                          {assignedGyms.length > 0
                            ? assignedGyms.map((gym) => gym.name).join(", ")
                            : "No gym assignment recorded."}
                        </p>
                      </div>
                      <div>
                        <small>REWARD CATALOG</small>
                        <p>
                          {contestRewards.length > 0
                            ? contestRewards
                                .map((reward) => reward.title)
                                .join(", ")
                            : "No rewards recorded."}
                        </p>
                      </div>
                    </div>
                    {assignedGyms.length > 0 ? (
                      <div className="contest-home-poster-controls">
                        <div className="contest-home-poster-heading">
                          <small>CONTEST-SPECIFIC QR POSTERS</small>
                          <p>
                            These controls are locked to {competition.name}.
                            Posters belonging to another contest at the same gym
                            are never loaded or replaced here.
                          </p>
                        </div>
                        {assignedGyms.map((gym) => {
                          const activeCredential = (
                            gym.activeQrCredentials ?? []
                          ).find(
                            (credential) =>
                              credential.competitionId === competition.id,
                          );
                          const loadActionKey = `load:${competition.id}:${gym.id}`;
                          const issueActionKey = `issue:${competition.id}:${gym.id}`;
                          return (
                            <div
                              className="contest-home-poster-row"
                              key={`${competition.id}:${gym.id}`}
                            >
                              <div>
                                <strong>{gym.name}</strong>
                                <small>
                                  {gym.active
                                    ? activeCredential
                                      ? `${competition.name} QR v${activeCredential.credentialVersion} active`
                                      : `No ${competition.name} poster issued yet`
                                    : "Gym inactive"}
                                </small>
                              </div>
                              <div className="inline-actions">
                                {activeCredential ? (
                                  <button
                                    className="secondary-button"
                                    disabled={
                                      submitting ||
                                      posterActionKey !== null ||
                                      !gym.active
                                    }
                                    onClick={() =>
                                      void loadContestHomePoster(
                                        competition,
                                        gym,
                                      )
                                    }
                                    type="button"
                                  >
                                    {posterActionKey === loadActionKey
                                      ? "LOADING POSTER..."
                                      : `VIEW ${competition.name.toUpperCase()} POSTER`}
                                  </button>
                                ) : null}
                                <button
                                  className="primary-button"
                                  disabled={
                                    submitting ||
                                    posterActionKey !== null ||
                                    !gym.active
                                  }
                                  onClick={() =>
                                    void issueContestHomePoster(
                                      competition,
                                      gym,
                                    )
                                  }
                                  type="button"
                                >
                                  {posterActionKey === issueActionKey
                                    ? "GENERATING POSTER..."
                                    : `${activeCredential ? "REISSUE" : "ISSUE"} ${competition.name.toUpperCase()} POSTER`}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                    {posterActionMessage?.competitionId === competition.id ? (
                      <p
                        className={`pilot-form-message ${posterActionMessage.tone === "error" ? "form-error" : "form-success"}`}
                        role={
                          posterActionMessage.tone === "error"
                            ? "alert"
                            : "status"
                        }
                      >
                        {posterActionMessage.message}
                      </p>
                    ) : null}
                    {contestHomePoster?.competitionId === competition.id ? (
                      <PosterPreview
                        credential={contestHomePoster}
                        key={contestHomePoster.id}
                      />
                    ) : null}
                    {competition.status === "active" ||
                    competition.status === "settling" ||
                    competition.status === "settled" ? (
                      <div className="contest-results-control">
                        <div>
                          <small>WINNERS CIRCLE</small>
                          <strong>
                            {competition.status === "settled"
                              ? "RESULTS PUBLISHED"
                              : competition.status === "settling"
                                ? "DRAW LOCKED"
                                : canFinalizeCompetitionResults(competition)
                                  ? "READY TO FINALIZE"
                                  : "WAITING FOR CONTEST COMPLETION"}
                          </strong>
                          <p>
                            {competition.status === "settled"
                              ? "Players can now see the audited results when they return to the app."
                              : competition.status === "settling"
                                ? pendingDrawCompetitionId === competition.id
                                  ? "The immutable draw evidence matches this operator's saved seed. Review it, then reveal once to publish results."
                                  : "The draw is locked, but its exact saved seed is unavailable in this operator account and environment. Publishing remains disabled until it is recovered."
                                : canFinalizeCompetitionResults(competition)
                                  ? "The 15-minute workout completion period has ended. Lock an immutable audited snapshot, then review it before a separate reveal."
                                  : workoutCutoffs
                                    ? `Finalization opens after ${formatContestDateTime(
                                        workoutCutoffs.completionDeadline,
                                        contestTimeZone,
                                      )}.`
                                    : "Finalization opens after the completion period ends."}
                          </p>
                          {competition.draw ? (
                            <dl className="metrics-grid">
                              <div>
                                <dt>Entrants / entries</dt>
                                <dd>
                                  {competition.draw.entrantCount} /{" "}
                                  {competition.draw.totalEntries}
                                </dd>
                              </div>
                              <div>
                                <dt>Reward slots</dt>
                                <dd>{competition.draw.rewardSlotCount}</dd>
                              </div>
                              <div>
                                <dt>Entrant snapshot</dt>
                                <dd
                                  title={competition.draw.entrantSnapshotHash}
                                >
                                  {competition.draw.entrantSnapshotHash.slice(
                                    0,
                                    12,
                                  )}
                                  …
                                </dd>
                              </div>
                              <div>
                                <dt>Reward snapshot</dt>
                                <dd title={competition.draw.rewardSnapshotHash}>
                                  {competition.draw.rewardSnapshotHash.slice(
                                    0,
                                    12,
                                  )}
                                  …
                                </dd>
                              </div>
                            </dl>
                          ) : null}
                        </div>
                        {canFinalizeCompetitionResults(competition) ||
                        (competition.status === "settling" &&
                          pendingDrawCompetitionId === competition.id) ? (
                          <button
                            className="primary-button"
                            disabled={
                              submitting ||
                              (pendingDrawCompetitionId !== null &&
                                pendingDrawCompetitionId !== competition.id)
                            }
                            onClick={() => onFinalize(competition)}
                            type="button"
                          >
                            {competition.status === "settling"
                              ? "REVEAL + PUBLISH RESULTS"
                              : "LOCK AUDITED DRAW SNAPSHOT"}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="card-actions">
                      {canCancelContest(competition.status) ? (
                        <button
                          className="danger-button"
                          onClick={() => onStatus(competition, "cancel")}
                          type="button"
                        >
                          CANCEL CONTEST
                        </button>
                      ) : null}
                      {canDeleteContestFromDashboard(competition.status) ? (
                        <button
                          className="danger-button"
                          onClick={() => onDelete(competition)}
                          type="button"
                        >
                          DELETE FROM DASHBOARD
                        </button>
                      ) : null}
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        )}
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

function RewardsPanel({
  awards,
  competition,
  onCouponCodes,
  onCreate,
  onDelete,
  onEdit,
  onAwardStatus,
  onStatus,
  rewards,
}: {
  awards: RewardAward[];
  competition: Competition | null;
  onCouponCodes: (reward: Reward) => void;
  onCreate: () => void;
  onDelete: (reward: Reward) => void;
  onEdit: (reward: Reward) => void;
  onAwardStatus: (
    award: RewardAward,
    action: "cancel" | "fulfill" | "redeem",
  ) => void;
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
  const contestRewards = competition
    ? rewards.filter((reward) => reward.competitionId === competition.id)
    : rewards;
  const contestRewardIds = new Set(contestRewards.map((reward) => reward.id));
  const contestAwards = awards.filter((award) =>
    contestRewardIds.has(award.rewardId),
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRewards = contestRewards.filter((reward) => {
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
    new Set(contestRewards.map((reward) => reward.status)),
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
            {competition
              ? `Showing rewards for ${competition.name}. Publish at least one to unlock the region step.`
              : "Only real, in-stock published rewards can unlock a contest launch."}
          </p>
        </div>
        <button className="primary-button" onClick={onCreate} type="button">
          + NEW REWARD
        </button>
      </div>
      {contestRewards.length > 0 ? (
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
      {contestRewards.length === 0 ? (
        <EmptyState
          body={
            competition
              ? `Create and publish the first reward for ${competition.name}.`
              : "Create the first verified brand reward, then publish it before releasing a contest."
          }
          title={
            competition
              ? "No reward for this contest"
              : "No brand rewards configured"
          }
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
                    aria-label="Actions"
                    className="sticky-action-column"
                    scope="col"
                  />
                </tr>
              </thead>
              <tbody>
                {pagedRewards.map((reward) => {
                  const couponReady =
                    reward.rewardType !== "coupon" ||
                    reward.couponCodeCount >= reward.inventoryTotal;
                  const assetsReady = Boolean(
                    reward.imageUrl && reward.termsUrl,
                  );
                  const publishReady = couponReady && assetsReady;
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
                              {!publishReady ? (
                                <span
                                  className="action-guidance compact"
                                  id={publishGateId}
                                >
                                  {!assetsReady
                                    ? "Add an approved image and terms link before publishing."
                                    : "Add enough coupon codes for every inventory unit before publishing."}
                                </span>
                              ) : null}
                              <button
                                aria-describedby={
                                  !publishReady ? publishGateId : undefined
                                }
                                className="text-button accent"
                                disabled={!publishReady}
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
                          {["archived", "draft"].includes(reward.status) ? (
                            <button
                              className="text-button danger-text"
                              onClick={() => onDelete(reward)}
                              type="button"
                            >
                              Delete
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
      <div className="panel-heading section-heading">
        <div>
          <p className="eyebrow">AWARDS &amp; FULFILLMENT</p>
          <h3>Winner awards</h3>
          <p>
            Record bounded award transitions without displaying coupon codes or
            private fulfillment details.
          </p>
        </div>
      </div>
      {contestAwards.length === 0 ? (
        <EmptyState
          body="Awards appear here only after an audited draw settles."
          title="No winner awards"
        />
      ) : (
        <div
          aria-label="Reward awards and fulfillment table"
          className="table-wrap compact"
          role="region"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Winner</th>
                <th scope="col">Reward</th>
                <th scope="col">Awarded</th>
                <th scope="col">Status</th>
                <th aria-label="Actions" scope="col" />
              </tr>
            </thead>
            <tbody>
              {contestAwards.map((award) => (
                <tr key={award.id}>
                  <td>
                    <strong>{award.winnerCallsign}</strong>
                    <small>Rank #{award.awardRank}</small>
                  </td>
                  <td>
                    <strong>{award.title}</strong>
                    <small>{award.sponsorName}</small>
                  </td>
                  <td>{formatDateTime(award.awardedAt)}</td>
                  <td>
                    <span className={`status-tag ${award.status}`}>
                      {award.status}
                    </span>
                  </td>
                  <td>
                    <div className="inline-actions">
                      {award.status === "awarded" ? (
                        <button
                          className="text-button danger-text"
                          onClick={() => onAwardStatus(award, "cancel")}
                          type="button"
                        >
                          Cancel
                        </button>
                      ) : null}
                      {award.status === "claimed" &&
                      award.rewardType === "physical" ? (
                        <button
                          className="text-button accent"
                          onClick={() => onAwardStatus(award, "fulfill")}
                          type="button"
                        >
                          Record fulfilled
                        </button>
                      ) : null}
                      {award.status === "claimed" &&
                      award.rewardType === "coupon" ? (
                        <button
                          className="text-button accent"
                          onClick={() => onAwardStatus(award, "redeem")}
                          type="button"
                        >
                          Record redeemed
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RegionsPanel({
  evaluatedAt,
  onCreate,
  onDelete,
  onStatus,
  regions,
  selectedRegionId,
}: {
  evaluatedAt: string;
  onCreate: () => void;
  onDelete: (region: RegionPolicy) => void;
  onStatus: (region: RegionPolicy, action: "disable" | "enable") => void;
  regions: RegionPolicy[];
  selectedRegionId?: string;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">PLAYER ELIGIBILITY AREAS</p>
          <h2>Regions</h2>
          <p>
            Add and review the geographic areas where players can join a
            contest.
          </p>
        </div>
        <button className="primary-button" onClick={onCreate} type="button">
          + ADD REGION
        </button>
      </div>
      {regions.length === 0 ? (
        <EmptyState
          body="Add the first region before configuring a contest."
          title="No regions added"
        />
      ) : (
        <div className="card-list">
          {regions.map((region) => {
            const expired =
              region.validTo !== null &&
              new Date(region.validTo).getTime() <=
                new Date(evaluatedAt).getTime();
            const deletable = !region.competitionEnabled || expired;
            const countryName =
              region.countryCode === "CA"
                ? "Canada"
                : region.countryCode === "US"
                  ? "United States"
                  : region.countryCode === "MX"
                    ? "Mexico"
                    : region.countryCode;
            return (
              <article
                className={
                  region.id === selectedRegionId
                    ? "region-card selected-region"
                    : "region-card"
                }
                key={region.id}
              >
                <div className="region-code">
                  {countryName} · {region.subdivisionCode}
                </div>
                <div>
                  {region.id === selectedRegionId ? (
                    <span className="setup-context-tag">
                      SELECTED CONTEST REGION
                    </span>
                  ) : null}
                  <span
                    className={`status-tag ${region.competitionEnabled ? "active" : "archived"}`}
                  >
                    {region.competitionEnabled ? "contest enabled" : "disabled"}
                  </span>
                  <h3>{region.metroName}</h3>
                  <p>
                    {region.timezone.split("/").pop()?.replaceAll("_", " ") ??
                      region.timezone}
                  </p>
                </div>
                <dl>
                  <div>
                    <dt>CONTESTS</dt>
                    <dd>
                      {region.competitionEnabled ? "Allowed" : "Disabled"}
                    </dd>
                  </div>
                  <div>
                    <dt>MINIMUM AGE</dt>
                    <dd>{region.minimumAge}+</dd>
                  </div>
                  <div>
                    <dt>STARTS</dt>
                    <dd>{formatDate(region.validFrom)}</dd>
                  </div>
                  <div>
                    <dt>ENDS</dt>
                    <dd>
                      {region.validTo
                        ? formatDate(region.validTo)
                        : "No scheduled end"}
                    </dd>
                  </div>
                </dl>
                <button
                  className={
                    region.competitionEnabled
                      ? "text-button danger-text"
                      : "text-button accent"
                  }
                  disabled={expired}
                  onClick={() =>
                    onStatus(
                      region,
                      region.competitionEnabled ? "disable" : "enable",
                    )
                  }
                  type="button"
                >
                  {expired
                    ? "Expired"
                    : region.competitionEnabled
                      ? "Disable"
                      : "Enable"}
                </button>
                {deletable ? (
                  <button
                    className="text-button danger-text"
                    onClick={() => onDelete(region)}
                    type="button"
                  >
                    Delete
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ContentPanel({
  creatorFeaturesEnabled,
  documents,
  legalPublicationOwner,
  onCreateDocument,
  onCreateWorkout,
  onDeleteWorkout,
  onEditWorkout,
  onWithdrawDocument,
  onWorkoutStatus,
  workouts,
}: {
  creatorFeaturesEnabled: boolean;
  documents: LegalDocument[];
  legalPublicationOwner: boolean;
  onCreateDocument: () => void;
  onCreateWorkout: () => void;
  onDeleteWorkout: (workout: CreatorWorkout) => void;
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
                  {!workout.published ? (
                    <button
                      className="text-button danger-text"
                      disabled={!creatorFeaturesEnabled}
                      onClick={() => onDeleteWorkout(workout)}
                      type="button"
                    >
                      Delete
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
            <p className="eyebrow">PUBLISHED LEGAL CONTENT</p>
            <h2>Legal documents</h2>
            <p>
              Publish approved, versioned policy text and withdraw superseded
              releases.
            </p>
          </div>
          <button
            className="primary-button"
            disabled={!legalPublicationOwner}
            onClick={onCreateDocument}
            type="button"
          >
            {legalPublicationOwner ? "+ PUBLISH VERSION" : "OWNER ONLY"}
          </button>
        </div>
        {!legalPublicationOwner ? (
          <div className="alert warning compact" role="status">
            <span>!</span>
            <p>
              Legal publication and withdrawal are restricted to the configured
              GoGymGo owner. This administrator has read-only legal access.
            </p>
          </div>
        ) : null}
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
                      aria-label="Actions"
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
                            disabled={!legalPublicationOwner}
                            onClick={() => onWithdrawDocument(document)}
                            type="button"
                          >
                            Withdraw
                          </button>
                        ) : (
                          <span className="table-action-note">
                            History retained
                          </span>
                        )}
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
  healthError,
  onDecide,
  onLoadDetail,
  onLoadProfileMedia,
  onLoadQueue,
  onRetryHealth,
  queue,
  queueError,
  queueNextCursor,
}: {
  events: AuditEvent[];
  health: SystemHealth | null;
  healthError: string;
  onDecide: (item: WorkQueueDetail, body: QueueDecisionBody) => Promise<void>;
  onLoadDetail: (item: WorkQueueItem) => Promise<WorkQueueDetail>;
  onLoadProfileMedia: (mediaId: string) => Promise<ProfileMediaReviewAction>;
  onLoadQueue: (
    kind?: WorkQueueKind,
    cursor?: string,
    append?: boolean,
  ) => Promise<void>;
  onRetryHealth: () => void;
  queue: WorkQueueItem[];
  queueError: string;
  queueNextCursor: string | null;
}) {
  const [kindFilter, setKindFilter] = useStoredPreference(
    "gogymgo.admin.operations.kind",
    "all",
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkQueueDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const selectedItem =
    queue.find((item) => `${item.kind}:${item.id}` === selectedKey) ?? null;
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
            onClear: () => {
              setKindFilter("all");
              setSelectedKey(null);
              setDetail(null);
              setDetailError("");
              setDetailLoading(false);
              void onLoadQueue();
            },
          },
        ];
  useEffect(() => {
    if (!selectedItem) {
      return;
    }
    let active = true;
    void onLoadDetail(selectedItem)
      .then((loaded) => {
        if (!active) return;
        if (
          loaded.id !== selectedItem.id ||
          loaded.kind !== selectedItem.kind ||
          loaded.reviewVersion !== selectedItem.reviewVersion
        ) {
          throw new AdminUserFacingError(
            "The review detail no longer matches the queue. Refresh before deciding.",
          );
        }
        setDetail(loaded);
      })
      .catch((error) => {
        if (active) setDetailError(errorMessage(error));
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [onLoadDetail, selectedItem]);

  return (
    <div className="section-stack">
      <section className="metric-grid">
        <MetricCard label="WORKER" value={health?.worker.status ?? "unknown"} />
        <MetricCard label="QUEUE PAGE" value={queue.length} />
        <MetricCard
          label="NOTIFICATIONS"
          value={health?.queues.notificationsPending ?? "—"}
        />
        <MetricCard
          label="PRIVACY JOBS"
          value={health?.queues.privacyOperationsPending ?? "—"}
        />
      </section>
      {healthError ? (
        <div className="alert error" role="alert">
          <span>!</span>
          <p>{healthError} System health has not been inferred.</p>
          <button onClick={onRetryHealth} type="button">
            RETRY HEALTH
          </button>
        </div>
      ) : null}
      {health ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">DURABLE OPERATIONAL EVIDENCE</p>
              <h2>Worker, leases and providers</h2>
              <p>
                Provider states are configuration and durable-failure evidence;
                this screen does not contact providers.
              </p>
            </div>
          </div>
          <div className="health-detail">
            <div>
              <small>WORKER HEARTBEAT</small>
              <strong>{health.worker.status}</strong>
            </div>
            <div>
              <small>NOTIFICATION LEASED / RETRY / EXHAUSTED</small>
              <strong>
                {health.queues.notificationsLeased} /{" "}
                {health.queues.notificationsRetryScheduled} /{" "}
                {health.queues.notificationsExhausted}
              </strong>
            </div>
            <div>
              <small>PRIVACY LEASED / RETRY / STALE</small>
              <strong>
                {health.queues.privacyOperationsLeased} /{" "}
                {health.queues.privacyOperationsRetryScheduled} /{" "}
                {health.queues.privacyOperationsStaleLeases}
              </strong>
            </div>
            <div>
              <small>MEDIA LEASED / RETRY / STALE</small>
              <strong>
                {health.queues.profileMediaCleanupLeased} /{" "}
                {health.queues.profileMediaCleanupRetryScheduled} /{" "}
                {health.queues.profileMediaCleanupStaleLeases}
              </strong>
            </div>
          </div>
          <div className="compact-list">
            {Object.entries(health.providers).map(([name, provider]) => (
              <div className="compact-row" key={name}>
                <div>
                  <strong>{name.replaceAll("_", " ")}</strong>
                  <small>{provider.evidence}</small>
                </div>
                <span className={`status-tag ${provider.status}`}>
                  {provider.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
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
                onChange={(event) => {
                  const value = event.target.value;
                  setKindFilter(value);
                  setSelectedKey(null);
                  setDetail(null);
                  setDetailError("");
                  setDetailLoading(false);
                  void onLoadQueue(
                    value === "all" ? undefined : (value as WorkQueueKind),
                  );
                }}
                value={kindFilter}
              >
                <option value="all">All review types</option>
                {workQueueKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        <FilterChips filters={activeFilters} />
        {queueError ? (
          <div className="alert error" role="alert">
            <span>!</span>
            <p>{queueError}</p>
            <button
              onClick={() =>
                void onLoadQueue(
                  kindFilter === "all"
                    ? undefined
                    : (kindFilter as WorkQueueKind),
                )
              }
              type="button"
            >
              RETRY QUEUE
            </button>
          </div>
        ) : queue.length === 0 ? (
          <EmptyState
            body="Nothing is waiting for operator review."
            title="Queue clear"
          />
        ) : (
          <div className="queue-workspace">
            <div className="compact-list">
              {queue.map((item) => (
                <button
                  aria-pressed={selectedKey === `${item.kind}:${item.id}`}
                  className={
                    selectedKey === `${item.kind}:${item.id}`
                      ? "compact-row queue-row selected"
                      : "compact-row queue-row"
                  }
                  key={`${item.kind}-${item.id}`}
                  onClick={() => {
                    setDetail(null);
                    setDetailError("");
                    setDetailLoading(true);
                    setSelectedKey(null);
                    queueMicrotask(() =>
                      setSelectedKey(`${item.kind}:${item.id}`),
                    );
                  }}
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
              {queueNextCursor ? (
                <button
                  className="secondary-button full"
                  onClick={() =>
                    void onLoadQueue(
                      kindFilter === "all"
                        ? undefined
                        : (kindFilter as WorkQueueKind),
                      queueNextCursor,
                      true,
                    )
                  }
                  type="button"
                >
                  LOAD MORE AUTHORITATIVE ITEMS
                </button>
              ) : null}
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
                    {selectedItem.requestType ? (
                      <div>
                        <dt>OPERATION</dt>
                        <dd>{selectedItem.requestType}</dd>
                      </div>
                    ) : null}
                    {selectedItem.failureCode ? (
                      <div className="wide">
                        <dt>SAFE FAILURE</dt>
                        <dd>
                          {selectedItem.failureCode.replaceAll("_", " ")}
                          {selectedItem.nextAttemptAt
                            ? ` · retry after ${formatDateTime(selectedItem.nextAttemptAt)}`
                            : ""}
                        </dd>
                      </div>
                    ) : null}
                    <div className="wide">
                      <dt>RECORD ID</dt>
                      <dd className="record-id">{selectedItem.id}</dd>
                    </div>
                  </dl>
                  {detailLoading ? (
                    <p className="queue-review-note" role="status">
                      Loading authoritative review detail…
                    </p>
                  ) : null}
                  {detailError ? (
                    <div className="alert error compact" role="alert">
                      <span>!</span>
                      <p>{detailError}</p>
                      <button
                        onClick={() => {
                          setDetail(null);
                          setDetailError("");
                          setDetailLoading(true);
                          setSelectedKey(null);
                          queueMicrotask(() =>
                            setSelectedKey(
                              `${selectedItem.kind}:${selectedItem.id}`,
                            ),
                          );
                        }}
                        type="button"
                      >
                        RETRY DETAIL
                      </button>
                    </div>
                  ) : null}
                  {detail ? (
                    <dl>
                      {detail.facts.map((fact) => (
                        <div key={fact.label}>
                          <dt>{fact.label.toUpperCase()}</dt>
                          <dd>{fact.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  <details className="queue-review-history">
                    <summary>
                      RELATED AUDIT EVIDENCE
                      <small>{selectedHistory.length}</small>
                    </summary>
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
                        No related audit entry is available yet. Use the record
                        ID above while completing the review.
                      </p>
                    )}
                  </details>
                  {detail ? (
                    <QueueDecisionControl
                      item={detail}
                      key={`${detail.kind}:${detail.id}:${detail.reviewVersion}`}
                      onDecide={onDecide}
                      onLoadProfileMedia={onLoadProfileMedia}
                    />
                  ) : !detailLoading && !detailError ? (
                    <p className="queue-review-note">
                      A validated server detail is required before any decision
                      can be shown.
                    </p>
                  ) : null}
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

function QueueDecisionControl({
  item,
  onDecide,
  onLoadProfileMedia,
}: {
  item: WorkQueueDetail;
  onDecide: (item: WorkQueueDetail, body: QueueDecisionBody) => Promise<void>;
  onLoadProfileMedia: (mediaId: string) => Promise<ProfileMediaReviewAction>;
}) {
  const [decision, setDecision] = useState(item.allowedDecisions[0] ?? "");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [mediaAction, setMediaAction] =
    useState<ProfileMediaReviewAction | null>(null);
  const [findings, setFindings] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(item.sessionEvidence?.evidence ?? {}).map(
        ([key, evidence]) => [
          key,
          evidence.required ? "approved" : "not_required",
        ],
      ),
    ),
  );

  if (!item.decisionAllowed || item.allowedDecisions.length === 0) {
    return (
      <p className="queue-review-note" role="status">
        No decision is permitted for this operator and current record state
        {item.decisionRestrictionCode
          ? ` (${item.decisionRestrictionCode.replaceAll("_", " ")})`
          : ""}
        .
      </p>
    );
  }

  return (
    <>
      {item.kind === "profile_media" ? (
        <div className="queue-decision-form">
          <button
            className="secondary-button full"
            onClick={() => {
              setError("");
              void onLoadProfileMedia(item.id)
                .then((action) => {
                  if (action.reviewVersion !== item.reviewVersion) {
                    throw new AdminUserFacingError(
                      "The private media action is for a different review version. Refresh before deciding.",
                    );
                  }
                  setMediaAction(action);
                })
                .catch((cause) => setError(errorMessage(cause)));
            }}
            type="button"
          >
            LOAD PRIVATE MEDIA REVIEW ACTION
          </button>
          {mediaAction ? (
            <a
              className="primary-button full"
              href={mediaAction.url}
              rel="noreferrer"
              target="_blank"
            >
              OPEN PRIVATE PREVIEW (EXPIRES{" "}
              {formatDateTime(mediaAction.expiresAt)})
            </a>
          ) : null}
        </div>
      ) : null}
      <form
        className="queue-decision-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const validationError = formValidationError(event.currentTarget);
          if (validationError) {
            setError(validationError);
            return;
          }
          setSubmitting(true);
          setError("");
          void onDecide(item, {
            decision,
            ...(item.sessionEvidence
              ? {
                  evidenceSnapshotSha256:
                    item.sessionEvidence.evidenceSnapshotSha256,
                  findings,
                }
              : {}),
            expectedVersion: item.reviewVersion,
            reason,
          })
            .catch((cause) => setError(errorMessage(cause)))
            .finally(() => setSubmitting(false));
        }}
      >
        <p className="queue-review-note">
          {item.kind === "privacy_request" && item.requestType === "delete"
            ? "Starting deletion authorizes the worker to revoke access and remove direct account data after external cleanup succeeds."
            : item.kind === "privacy_request"
              ? "Starting export authorizes a minimized private JSON export with a short retention window."
              : "The server controls the permitted transitions shown below. The reason and exact review version are recorded."}
        </p>
        <label>
          <span>DECISION</span>
          <select
            onChange={(event) => setDecision(event.target.value)}
            value={decision}
          >
            {item.allowedDecisions.map((allowed) => (
              <option key={allowed} value={allowed}>
                {allowed.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        {item.sessionEvidence ? (
          <fieldset>
            <legend>EVIDENCE FINDINGS</legend>
            {Object.entries(item.sessionEvidence.evidence).map(
              ([category, evidence]) => (
                <label key={category}>
                  <span>
                    {category.replace(/([a-z])([A-Z])/g, "$1 $2")} ·{" "}
                    {evidence.count}
                    {evidence.required ? " required" : " optional"}
                  </span>
                  <select
                    onChange={(event) =>
                      setFindings((current) => ({
                        ...current,
                        [category]: event.target.value,
                      }))
                    }
                    value={findings[category]}
                  >
                    <option value="approved">approved</option>
                    <option value="rejected">rejected</option>
                    <option value="not_required">not required</option>
                  </select>
                </label>
              ),
            )}
          </fieldset>
        ) : null}
        <label>
          <span>AUDIT REASON</span>
          <textarea
            maxLength={500}
            minLength={8}
            onChange={(event) => setReason(event.target.value)}
            required
            rows={3}
            value={reason}
          />
        </label>
        <button
          className="primary-button full"
          disabled={submitting}
          type="submit"
        >
          {submitting ? "RECORDING..." : "RECORD DECISION"}
        </button>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </>
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
      <small>CURRENT STATE</small>
    </div>
  );
}

function AuditPanel({
  error,
  onLoad,
  page,
}: {
  error: string;
  onLoad: (search?: string, cursor?: string, append?: boolean) => Promise<void>;
  page: AuditPage;
}) {
  const [query, setQuery] = useStoredPreference(
    "gogymgo.admin.audit.query",
    "",
  );
  const [loading, setLoading] = useState(false);
  const events = page.items;
  const activeFilters: ActiveFilter[] = [
    ...(query
      ? [
          {
            label: `Search: ${query}`,
            onClear: () => {
              setQuery("");
              setLoading(true);
              void onLoad().finally(() => setLoading(false));
            },
          },
        ]
      : []),
  ];
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">ADMINISTRATIVE RECORDS</p>
          <h2>Audit history</h2>
          <p>
            Server-paginated, minimized administrative decisions, including who
            acted and why.
          </p>
        </div>
      </div>
      <form
        aria-label="Filter audit history"
        className="panel-toolbar"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const validationError = formValidationError(event.currentTarget);
          if (validationError) {
            return;
          }
          setLoading(true);
          void onLoad(query).finally(() => setLoading(false));
        }}
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
        <button className="secondary-button" disabled={loading} type="submit">
          {loading ? "SEARCHING…" : "SEARCH SERVER"}
        </button>
      </form>
      <FilterChips filters={activeFilters} />
      {error ? (
        <div className="alert error" role="alert">
          <span>!</span>
          <p>{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              void onLoad(query).finally(() => setLoading(false));
            }}
            type="button"
          >
            RETRY AUDIT SEARCH
          </button>
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          body={
            query
              ? "No authoritative audit event matches this server search."
              : "Administrative decisions will appear here after the first recorded change."
          }
          title={query ? "No audit events match" : "No audit events recorded"}
        />
      ) : (
        <>
          <div className="timeline">
            {events.map((event) => (
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
          {page.nextCursor ? (
            <button
              className="secondary-button full"
              disabled={loading}
              onClick={() => {
                setLoading(true);
                void onLoad(query, page.nextCursor ?? undefined, true).finally(
                  () => setLoading(false),
                );
              }}
              type="button"
            >
              {loading ? "LOADING…" : "LOAD MORE AUDIT EVENTS"}
            </button>
          ) : null}
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

function CompetitionForm({
  competition,
  gymLocationId,
  gyms,
  onClose,
  onSubmit,
  regions,
  submitting,
}: {
  competition?: PartnerCompetition;
  gymLocationId?: string;
  gyms: { id: string; name: string; regionPolicyId: string }[];
  onClose: () => void;
  onSubmit: (
    body: Record<string, unknown>,
    editing?: PartnerCompetition,
  ) => Promise<void>;
  regions: {
    id: string;
    name?: string;
    metroName?: string;
    timezone: string;
  }[];
  submitting: boolean;
}) {
  const [formError, setFormError] = useState("");
  const [selectedGymId, setSelectedGymId] = useState(
    gymLocationId ?? gyms?.[0]?.id ?? "",
  );
  const selectedGym = gyms?.find((gym) => gym.id === selectedGymId);
  const selectedTimeZone =
    regions.find(
      (region) =>
        region.id ===
        (competition?.regionPolicyId ?? selectedGym?.regionPolicyId),
    )?.timezone ?? defaultContestTimeZone;
  const dates = defaultCompetitionDatesInZone(selectedTimeZone);
  const selectableRegions = selectedGym
    ? regions.filter((region) => region.id === selectedGym.regionPolicyId)
    : [];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const validationError = formValidationError(event.currentTarget);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    const form = new FormData(event.currentTarget);
    try {
      const regionPolicyId = String(form.get("regionPolicyId") ?? "");
      const timeZone =
        regions.find((region) => region.id === regionPolicyId)?.timezone ??
        defaultContestTimeZone;
      const parsedSchedule = {
        endsAt: zonedDateTimeToIso(String(form.get("endsAt") ?? ""), timeZone),
        registrationClosesAt: zonedDateTimeToIso(
          String(form.get("registrationClosesAt") ?? ""),
          timeZone,
        ),
        registrationOpensAt: zonedDateTimeToIso(
          String(form.get("registrationOpensAt") ?? ""),
          timeZone,
        ),
        startsAt: zonedDateTimeToIso(
          String(form.get("startsAt") ?? ""),
          timeZone,
        ),
      };
      const registrationOpensAt = new Date(parsedSchedule.registrationOpensAt);
      const registrationClosesAt = new Date(
        parsedSchedule.registrationClosesAt,
      );
      const startsAt = new Date(parsedSchedule.startsAt);
      const endsAt = new Date(parsedSchedule.endsAt);
      if (
        registrationOpensAt >= registrationClosesAt ||
        registrationClosesAt > startsAt ||
        startsAt >= endsAt
      ) {
        throw new AdminUserFacingError(
          "Use a valid schedule: registration opens, registration closes, contest starts, then contest ends.",
        );
      }
      if (endsAt.getTime() - startsAt.getTime() < 30 * 60 * 1_000) {
        throw new AdminUserFacingError(
          "Allow at least 30 minutes for the workout. Eligible workouts receive 15 minutes after the contest ends to finish verification.",
        );
      }
      const goalDays = String(form.get("goalDays") ?? "")
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7);
      if (goalDays.length === 0)
        throw new AdminUserFacingError("Add at least one Weekly Goal.");
      const body: Record<string, unknown> = {
        endsAt: parsedSchedule.endsAt,
        entrantCap: optionalNumber(form.get("entrantCap")),
        goalBrackets: [...new Set(goalDays)].map((goal) => ({
          goalDays: goal,
          label: `${goal} DAY${goal === 1 ? "" : "S"} / WEEK`,
        })),
        minimumEntrants: 1,
        gymLocationId: String(form.get("gymLocationId") ?? ""),
        monthKey: String(form.get("monthKey")),
        name: String(form.get("name")),
        reason: String(form.get("reason")),
        regionPolicyId,
        registrationClosesAt: parsedSchedule.registrationClosesAt,
        registrationOpensAt: parsedSchedule.registrationOpensAt,
        rules: defaultCompetitionRules,
        rulesVersion: "partner-proposal-v1",
        startsAt: parsedSchedule.startsAt,
        ...(competition
          ? { expectedVersion: competition.configurationVersion }
          : {}),
      };
      await onSubmit(body, competition);
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }
  return (
    <ModalShell
      onClose={onClose}
      title={competition ? "Edit contest proposal" : "New contest proposal"}
    >
      <form
        className="editor-form"
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <FormGrid>
          <Field label="APPROVED PARTNER GYM">
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
            <small className="field-help">
              Choose from the active gyms GoGymGo has assigned to your owner
              account.
            </small>
          </Field>
          <Field label="REGION">
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
                  {region.metroName ?? region.name}
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
          <Field label="ENTRANT CAP (OPTIONAL)">
            <input
              defaultValue={competition?.entrantCap ?? ""}
              min={1}
              name="entrantCap"
              type="number"
            />
          </Field>
          <Field label="REGISTRATION OPENS">
            <input
              defaultValue={toZonedDateTimeInput(
                competition?.registrationOpensAt ?? dates.registrationOpensAt,
                selectedTimeZone,
              )}
              name="registrationOpensAt"
              required
              type="datetime-local"
            />
          </Field>
          <Field label="REGISTRATION CLOSES">
            <input
              defaultValue={toZonedDateTimeInput(
                competition?.registrationClosesAt ?? dates.startsAt,
                selectedTimeZone,
              )}
              name="registrationClosesAt"
              required
              type="datetime-local"
            />
          </Field>
          <Field label="CONTEST STARTS">
            <input
              defaultValue={toZonedDateTimeInput(
                competition?.startsAt ?? dates.startsAt,
                selectedTimeZone,
              )}
              name="startsAt"
              required
              type="datetime-local"
            />
          </Field>
          <Field label="CONTEST ENDS">
            <input
              defaultValue={toZonedDateTimeInput(
                competition?.endsAt ?? dates.endsAt,
                selectedTimeZone,
              )}
              name="endsAt"
              required
              type="datetime-local"
            />
            <small className="field-help">
              Workouts require 30 minutes and receive a 15-minute completion
              period after the contest ends. Times use {selectedTimeZone}.
            </small>
          </Field>
          <ReasonField
            defaultValue={
              competition
                ? "Update this gym contest proposal for GoGymGo review."
                : "Submit a gym contest proposal for GoGymGo review."
            }
          />
        </FormGrid>
        <FormActions
          onClose={onClose}
          submitting={submitting}
          submitLabel={competition ? "SAVE PROPOSAL" : "SUBMIT PROPOSAL"}
        />
        {formError ? (
          <p className="form-error" role="alert">
            {formError}
          </p>
        ) : null}
      </form>
    </ModalShell>
  );
}

function RewardForm({
  competitions,
  competitionId,
  onClose,
  onSubmit,
  reward,
  submitting,
}: {
  competitions: Competition[];
  competitionId?: string;
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
    const validationError = formValidationError(event.currentTarget);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    const form = new FormData(event.currentTarget);
    try {
      const selectedRewardType = String(form.get("rewardType"));
      const claimUrl = optionalString(form.get("claimUrl"));
      const fulfillmentInstructions = optionalString(
        form.get("fulfillmentInstructions"),
      );
      if (
        selectedRewardType === "physical" &&
        Boolean(claimUrl) === Boolean(fulfillmentInstructions)
      ) {
        throw new AdminUserFacingError(
          "Choose exactly one secure claim URL or fulfillment instruction path.",
        );
      }
      if (
        selectedRewardType === "cash" &&
        (claimUrl || !fulfillmentInstructions)
      ) {
        throw new AdminUserFacingError(
          "Cash rewards require manual in-person fulfillment instructions and cannot use a payment or claim URL.",
        );
      }
      if (
        selectedRewardType === "coupon" &&
        (claimUrl || fulfillmentInstructions)
      ) {
        throw new AdminUserFacingError(
          "Coupon rewards reveal only the assigned encrypted code; remove physical fulfillment fields.",
        );
      }
      const body = compactObject({
        availableFrom: optionalIso(form.get("availableFrom")),
        availableUntil: optionalIso(form.get("availableUntil")),
        claimUrl,
        cashAmountCents:
          selectedRewardType === "cash"
            ? Number(form.get("cashAmountCents"))
            : undefined,
        cashCurrency:
          selectedRewardType === "cash"
            ? String(form.get("cashCurrency") ?? "").toUpperCase()
            : undefined,
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
      <form
        className="editor-form"
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <FormGrid>
          <Field label="CONTEST" wide>
            <select
              defaultValue={reward?.competitionId ?? competitionId}
              name="competitionId"
              required
            >
              <option value="">Select a contest</option>
              {competitions
                .filter(
                  (competition) =>
                    competition.id === reward?.competitionId ||
                    isRewardConfigurableCompetition(competition),
                )
                .map((competition) => (
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
          {rewardType === "cash" ? (
            <>
              <Field label="CASH AMOUNT (CENTS)">
                <input
                  defaultValue={reward?.cashAmountCents ?? 10000}
                  max={10000000}
                  min={1}
                  name="cashAmountCents"
                  required
                  type="number"
                />
              </Field>
              <Field label="CURRENCY">
                <input
                  defaultValue={reward?.cashCurrency ?? "CAD"}
                  maxLength={3}
                  minLength={3}
                  name="cashCurrency"
                  required
                />
              </Field>
            </>
          ) : null}
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
              <p>
                {rewardType === "cash"
                  ? "Describe the manual in-person handoff. This records an already-completed handoff and never initiates payment."
                  : "Choose exactly one way for a winner to receive this reward."}
              </p>
              <div className="reward-fulfillment-fields">
                {rewardType === "physical" ? (
                  <Field label="CLAIM URL">
                    <input
                      defaultValue={reward?.claimUrl ?? ""}
                      name="claimUrl"
                      placeholder="https://"
                      type="url"
                    />
                  </Field>
                ) : null}
                <Field
                  label={
                    rewardType === "cash"
                      ? "MANUAL HANDOFF INSTRUCTIONS"
                      : "FULFILLMENT INSTRUCTIONS"
                  }
                >
                  <textarea
                    defaultValue={reward?.fulfillmentInstructions ?? ""}
                    name="fulfillmentInstructions"
                    required={rewardType === "cash"}
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
        <FormActions
          onClose={onClose}
          submitting={submitting}
          submitLabel={reward ? "SAVE REWARD" : "CREATE REWARD"}
        />
        {formError ? (
          <p className="form-error" role="alert">
            {formError}
          </p>
        ) : null}
      </form>
    </ModalShell>
  );
}

function parseJsonInput(value: string, label: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new AdminUserFacingError(
      `${label} cannot be read. Check for missing commas, quotation marks or brackets.`,
    );
  }
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeRegionBoundary(value: string): Record<string, unknown> {
  if (!value.trim()) {
    throw new AdminUserFacingError(
      "Upload the approved region boundary file or paste the boundary data before continuing.",
    );
  }

  let source: unknown;
  try {
    source = JSON.parse(value) as unknown;
  } catch {
    throw new AdminUserFacingError(
      "The boundary file could not be read. Upload the original boundary file or paste its complete contents.",
    );
  }

  const polygons: unknown[] = [];
  const addGeometry = (geometry: unknown) => {
    if (!isJsonRecord(geometry) || !Array.isArray(geometry.coordinates)) {
      return;
    }
    if (geometry.type === "Polygon") {
      polygons.push(geometry.coordinates);
    } else if (geometry.type === "MultiPolygon") {
      polygons.push(...geometry.coordinates);
    }
  };

  if (isJsonRecord(source) && source.type === "Feature") {
    addGeometry(source.geometry);
  } else if (
    isJsonRecord(source) &&
    source.type === "FeatureCollection" &&
    Array.isArray(source.features)
  ) {
    source.features.forEach((feature) => {
      if (isJsonRecord(feature)) addGeometry(feature.geometry);
    });
  } else {
    addGeometry(source);
  }

  if (polygons.length === 0) {
    throw new AdminUserFacingError(
      "The boundary file does not contain a usable region shape. Ask your mapping provider for a complete boundary file and upload it again.",
    );
  }

  return { coordinates: polygons, type: "MultiPolygon" };
}

function automaticRegionCode(name: string, subdivisionCode: string): string {
  const code = `${name}-${subdivisionCode}`
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
  if (code.length < 2) {
    throw new AdminUserFacingError(
      "Region name and province or state code must contain letters or numbers.",
    );
  }
  return code;
}

function automaticRegionVersion(validFrom: string): string {
  return `effective-${validFrom.replace(/[-:.]/g, "").replace("Z", "z")}`;
}

function GymLocationForm({
  evaluatedAt,
  onClose,
  onSubmit,
  regions,
  submitting,
}: {
  evaluatedAt: string;
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
  regions: RegionPolicy[];
  submitting: boolean;
}) {
  const [formError, setFormError] = useState("");
  const evaluatedAtMs = Date.parse(evaluatedAt);
  const availableRegions = regions.filter((region) => {
    const validFrom = Date.parse(region.validFrom);
    const validTo = region.validTo ? Date.parse(region.validTo) : null;
    return (
      region.competitionEnabled &&
      validFrom <= evaluatedAtMs &&
      (validTo === null || validTo > evaluatedAtMs)
    );
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const validationError = formValidationError(event.currentTarget);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const form = new FormData(event.currentTarget);
    try {
      await onSubmit({
        address: String(form.get("address") ?? "").trim(),
        latitude: parseCoordinate(
          String(form.get("latitude") ?? ""),
          "latitude",
        ),
        longitude: parseCoordinate(
          String(form.get("longitude") ?? ""),
          "longitude",
        ),
        name: String(form.get("name") ?? "").trim(),
        radiusMeters: Number(form.get("radiusMeters")),
        reason: String(form.get("reason") ?? "").trim(),
        regionPolicyId: String(form.get("regionPolicyId") ?? ""),
      });
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  return (
    <ModalShell onClose={onClose} title="Add an approved partner gym">
      <form
        className="editor-form"
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <div className="alert warning compact">
          <span>!</span>
          <p>
            The server verifies that the coordinates are inside the selected
            active region. Creating this location makes it eligible for contest
            assignment; poster credentials are issued separately.
          </p>
        </div>
        {availableRegions.length === 0 ? (
          <div className="empty-state" role="status">
            <strong>NO ACTIVE REGION IS AVAILABLE</strong>
            <p>
              Create and enable the approved region before adding a partner gym.
            </p>
          </div>
        ) : null}
        <FormGrid>
          <Field label="ACTIVE REGION" wide>
            <select
              defaultValue={availableRegions[0]?.id ?? ""}
              name="regionPolicyId"
              required
            >
              {availableRegions.length === 0 ? (
                <option value="">No active region</option>
              ) : null}
              {availableRegions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.metroName} · {region.subdivisionCode}
                </option>
              ))}
            </select>
          </Field>
          <Field label="GYM NAME" wide>
            <input maxLength={160} minLength={2} name="name" required />
          </Field>
          <Field label="STREET ADDRESS" wide>
            <input maxLength={500} name="address" />
          </Field>
          <Field label="LATITUDE">
            <input
              inputMode="decimal"
              name="latitude"
              placeholder="49.2827 or 49°16′58″N"
              required
            />
          </Field>
          <Field label="LONGITUDE">
            <input
              inputMode="decimal"
              name="longitude"
              placeholder="-123.1207 or 123°7′15″W"
              required
            />
          </Field>
          <Field label="CHECK-IN RADIUS (METRES)">
            <input
              defaultValue={75}
              max={500}
              min={10}
              name="radiusMeters"
              required
              type="number"
            />
          </Field>
          <ReasonField defaultValue="Add an approved partner gym for contest check-ins." />
        </FormGrid>
        {formError ? (
          <p className="form-error" role="alert">
            {formError}
          </p>
        ) : null}
        <FormActions
          disabled={availableRegions.length === 0}
          onClose={onClose}
          submitLabel="ADD PARTNER GYM"
          submitting={submitting}
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
  const [boundaryText, setBoundaryText] = useState("");
  const [boundaryFileName, setBoundaryFileName] = useState("");
  const [countryCode, setCountryCode] = useState("CA");
  const [subdivisionCode, setSubdivisionCode] = useState("BC");
  const [currency, setCurrency] = useState("CAD");
  const [timezone, setTimezone] = useState("America/Vancouver");
  const [languageCode, setLanguageCode] = useState("en-CA");

  function chooseCountry(nextCountryCode: string) {
    setCountryCode(nextCountryCode);
    if (nextCountryCode === "US") {
      setSubdivisionCode("WA");
      setCurrency("USD");
      setTimezone("America/Los_Angeles");
      setLanguageCode("en-US");
    } else if (nextCountryCode === "MX") {
      setSubdivisionCode("JAL");
      setCurrency("MXN");
      setTimezone("America/Mexico_City");
      setLanguageCode("es-MX");
    } else {
      setSubdivisionCode("BC");
      setCurrency("CAD");
      setTimezone("America/Vancouver");
      setLanguageCode("en-CA");
    }
  }

  async function loadBoundaryFile(file: File | undefined) {
    setFormError("");
    setBoundaryFileName("");
    if (!file) return;
    try {
      const text = await file.text();
      const boundary = normalizeRegionBoundary(text);
      setBoundaryText(JSON.stringify(boundary, null, 2));
      setBoundaryFileName(file.name);
    } catch (error) {
      setBoundaryText("");
      setFormError(errorMessage(error));
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const validationError = formValidationError(event.currentTarget);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    const form = new FormData(event.currentTarget);
    try {
      const metroName = String(form.get("metroName") ?? "").trim();
      const subdivisionCode = String(
        form.get("subdivisionCode") ?? "",
      ).toUpperCase();
      const validFrom = toIso(form, "validFrom");
      const validTo = optionalIso(form.get("validTo"));
      if (validTo && new Date(validTo) <= new Date(validFrom)) {
        throw new AdminUserFacingError(
          "Ends on must be later than starts on, or left blank when the region has no scheduled end.",
        );
      }
      const policyVersion = automaticRegionVersion(validFrom);
      await onSubmit(
        compactObject({
          boundary: normalizeRegionBoundary(boundaryText),
          boundaryVersion: `boundary-${policyVersion}`,
          code: automaticRegionCode(metroName, subdivisionCode),
          competitionEnabled: form.get("competitionEnabled") === "on",
          countryCode: String(form.get("countryCode")).toUpperCase(),
          currency: String(form.get("currency")).toUpperCase(),
          languageCodes: [String(form.get("languageCode"))],
          metroName,
          minimumAge: Number(form.get("minimumAge")),
          policyVersion,
          reason: "Add a region for contest eligibility.",
          subdivisionCode,
          timezone: String(form.get("timezone")),
          validFrom,
          validTo,
        }),
      );
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  return (
    <ModalShell onClose={onClose} title="Add a region">
      <form
        className="editor-form region-onboarding-form"
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <div className="alert warning compact">
          <span>!</span>
          <p>
            Check the region name, dates and boundary before saving. A saved
            region cannot be edited; create a replacement if its coverage
            changes later.
          </p>
        </div>
        <div className="region-onboarding-summary">
          <strong>WHAT YOU NEED</strong>
          <p>
            A recognizable region name, its local settings, the start date and
            an approved boundary file from your mapping provider.
          </p>
        </div>
        <FormGrid>
          <Field label="REGION NAME" wide>
            <input
              data-validation-label="Region name"
              name="metroName"
              placeholder="Vancouver Island"
              required
            />
            <small className="field-help">
              Use the name gym owners and players will recognize.
            </small>
          </Field>
          <Field label="COUNTRY">
            <select
              name="countryCode"
              onChange={(event) => chooseCountry(event.target.value)}
              required
              value={countryCode}
            >
              <option value="CA">Canada</option>
              <option value="US">United States</option>
              <option value="MX">Mexico</option>
            </select>
          </Field>
          <Field label="PROVINCE / STATE CODE">
            <input
              data-validation-label="Province or state code"
              maxLength={8}
              name="subdivisionCode"
              onChange={(event) =>
                setSubdivisionCode(event.target.value.toUpperCase())
              }
              pattern="[A-Za-z0-9-]{1,8}"
              placeholder="BC"
              required
              value={subdivisionCode}
            />
            <small className="field-help">
              Enter the short code, such as BC, WA or JAL.
            </small>
          </Field>
          <Field label="LOCAL TIME ZONE">
            <select
              name="timezone"
              onChange={(event) => setTimezone(event.target.value)}
              required
              value={timezone}
            >
              <optgroup label="Canada">
                <option value="America/Vancouver">Pacific — Vancouver</option>
                <option value="America/Edmonton">Mountain — Edmonton</option>
                <option value="America/Regina">Central — Regina</option>
                <option value="America/Winnipeg">Central — Winnipeg</option>
                <option value="America/Toronto">Eastern — Toronto</option>
                <option value="America/Halifax">Atlantic — Halifax</option>
                <option value="America/St_Johns">
                  Newfoundland — St. John&apos;s
                </option>
              </optgroup>
              <optgroup label="United States">
                <option value="America/Los_Angeles">Pacific</option>
                <option value="America/Denver">Mountain</option>
                <option value="America/Chicago">Central</option>
                <option value="America/New_York">Eastern</option>
                <option value="America/Phoenix">Arizona</option>
                <option value="America/Anchorage">Alaska</option>
                <option value="Pacific/Honolulu">Hawaii</option>
              </optgroup>
              <optgroup label="Mexico">
                <option value="America/Tijuana">Tijuana</option>
                <option value="America/Chihuahua">Chihuahua</option>
                <option value="America/Monterrey">Monterrey</option>
                <option value="America/Mexico_City">Mexico City</option>
                <option value="America/Cancun">Cancún</option>
              </optgroup>
            </select>
          </Field>
          <Field label="MINIMUM PARTICIPANT AGE">
            <input
              defaultValue={19}
              max={99}
              min={13}
              name="minimumAge"
              required
              type="number"
            />
          </Field>
          <Field label="STARTS ON">
            <input
              defaultValue={toLocalDateTime(new Date().toISOString())}
              name="validFrom"
              required
              type="datetime-local"
            />
          </Field>
          <Field label="ENDS ON (OPTIONAL)">
            <input name="validTo" type="datetime-local" />
          </Field>
          <details className="reward-advanced region-settings-advanced">
            <summary>
              <span>REVIEW LOCAL SETTINGS</span>
              <small>Currency and language are filled from the country</small>
            </summary>
            <div className="reward-advanced-grid">
              <Field label="CURRENCY">
                <select
                  name="currency"
                  onChange={(event) => setCurrency(event.target.value)}
                  required
                  value={currency}
                >
                  <option value="CAD">Canadian dollar (CAD)</option>
                  <option value="USD">US dollar (USD)</option>
                  <option value="MXN">Mexican peso (MXN)</option>
                </select>
              </Field>
              <Field label="PRIMARY LANGUAGE">
                <select
                  name="languageCode"
                  onChange={(event) => setLanguageCode(event.target.value)}
                  required
                  value={languageCode}
                >
                  <option value="en-CA">English (Canada)</option>
                  <option value="fr-CA">French (Canada)</option>
                  <option value="en-US">English (United States)</option>
                  <option value="es-MX">Spanish (Mexico)</option>
                </select>
              </Field>
            </div>
          </details>
          <Field label="REGION BOUNDARY FILE" wide>
            <input
              accept=".json,.geojson,application/json,application/geo+json"
              aria-describedby="region-boundary-help"
              onChange={(event) =>
                void loadBoundaryFile(event.currentTarget.files?.[0])
              }
              type="file"
            />
            <small className="field-help" id="region-boundary-help">
              Upload the approved boundary file supplied by your mapping
              provider. GoGymGo uses it to decide whether a phone is inside the
              region.
            </small>
            {boundaryFileName ? (
              <span className="boundary-file-ready" role="status">
                READY — {boundaryFileName}
              </span>
            ) : null}
          </Field>
          <details className="reward-advanced region-boundary-advanced">
            <summary>
              <span>PASTE BOUNDARY DATA INSTEAD</span>
              <small>Use this only if you received boundary text</small>
            </summary>
            <div className="reward-advanced-grid">
              <Field label="APPROVED BOUNDARY DATA" wide>
                <textarea
                  aria-label="Approved boundary data"
                  onChange={(event) => {
                    setBoundaryText(event.target.value);
                    setBoundaryFileName("");
                  }}
                  placeholder="Paste the complete boundary text from your mapping provider."
                  rows={10}
                  value={boundaryText}
                />
              </Field>
            </div>
          </details>
          <label className="check-row field wide">
            <input name="competitionEnabled" type="checkbox" />
            <span>
              Enable only after boundary reconciliation and documented approval
            </span>
          </label>
        </FormGrid>
        <FormActions
          onClose={onClose}
          submitting={submitting}
          submitLabel="ADD REGION"
        />
        {formError ? (
          <p className="form-error" role="alert">
            {formError}
          </p>
        ) : null}
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
    const validationError = formValidationError(event.currentTarget);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    const form = new FormData(event.currentTarget);
    try {
      const regionCodes = form.getAll("regionCodes").map(String);
      if (regionCodes.length === 0) {
        throw new AdminUserFacingError(
          "Choose at least one region where this workout is available.",
        );
      }
      await onSubmit(
        compactObject({
          creatorName: String(form.get("creatorName")),
          durationMinutes: Number(form.get("durationMinutes")),
          expectedVersion: workout?.version,
          reason: String(form.get("reason")),
          regionCodes,
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
      <form
        className="editor-form"
        noValidate
        onSubmit={(event) => void submit(event)}
      >
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
        <FormActions
          onClose={onClose}
          submitting={submitting}
          submitLabel={workout ? "SAVE WORKOUT" : "CREATE WORKOUT"}
        />
        {formError ? (
          <p className="form-error" role="alert">
            {formError}
          </p>
        ) : null}
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
    const validationError = formValidationError(event.currentTarget);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    const form = new FormData(event.currentTarget);
    try {
      await onSubmit({
        content: parseJsonInput(
          String(form.get("content")),
          "Document content",
        ),
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
      <form
        className="editor-form"
        noValidate
        onSubmit={(event) => void submit(event)}
      >
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
        <FormActions
          onClose={onClose}
          submitting={submitting}
          submitLabel="PUBLISH VERSION"
        />
        {formError ? (
          <p className="form-error" role="alert">
            {formError}
          </p>
        ) : null}
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
    const validationError = formValidationError(event.currentTarget);
    if (validationError) {
      setFormError(validationError);
      return;
    }
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
      if (codes.length === 0)
        throw new AdminUserFacingError("Add at least one coupon code.");
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
      <form
        className="editor-form"
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <p className="modal-copy">
          Enter one unique coupon code per line. Codes are stored securely and
          hidden after you add them.
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
        <FormActions
          onClose={onClose}
          submitting={submitting}
          submitLabel="ENCRYPT + ADD CODES"
        />
        {formError ? (
          <p className="form-error" role="alert">
            {formError}
          </p>
        ) : null}
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
        <div className="field reason-field">
          <span>REQUIRED AUDIT REASON</span>
          <ReasonPresetChips onSelect={setReason} selected={reason} />
          <textarea
            aria-label="Required audit reason"
            autoFocus
            minLength={8}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Explain why this change is authorized."
            rows={4}
            value={reason}
          />
        </div>
      )}
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
            <button
              className="secondary-button"
              onClick={onClose}
              type="button"
            >
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
      {formError ? (
        <p className="form-error" role="alert">
          {formError}
        </p>
      ) : null}
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
  const [reason, setReason] = useState(defaultValue);
  const presets = [defaultValue, ...genericAdministrativeReasons];
  return (
    <div className="field wide reason-field">
      <span>REQUIRED AUDIT REASON</span>
      <ReasonPresetChips
        onSelect={setReason}
        presets={presets}
        selected={reason}
      />
      <textarea
        aria-label="Required audit reason"
        minLength={8}
        name="reason"
        onChange={(event) => setReason(event.target.value)}
        required
        rows={3}
        value={reason}
      />
    </div>
  );
}

function FormActions({
  disabled,
  onClose,
  submitLabel,
  submitting,
}: {
  disabled?: boolean;
  onClose: () => void;
  submitLabel: string;
  submitting: boolean;
}) {
  return (
    <div className="form-actions">
      <button className="secondary-button" onClick={onClose} type="button">
        CANCEL
      </button>
      <button
        className="primary-button"
        disabled={submitting || disabled}
        type="submit"
      >
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
