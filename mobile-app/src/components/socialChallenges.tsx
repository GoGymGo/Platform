import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ComponentProps } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle
} from 'react-native';

import { AuthTextField } from '@/components/auth';
import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  TerminalText
} from '@/components/cyber';
import { UserAlias } from '@/components/streakRewards';
import { colors, fontFamilies, fontSizes, radii, spacing } from '@/constants/theme';
import {
  buildChallengeMonthWindow,
  challengeActivityLabels,
  socialChallengeActivities,
  validateChallengeName,
  validateChallengeInput,
  type ChallengeInviteContact,
  type CreateSocialChallengeInput,
  type Friend,
  type FriendRequestDecision,
  type SocialChallenge,
  type SocialChallengeActivity
} from '@/domain/social';

type ChallengeHubSection = 'create' | 'discover' | 'mine';
type ChallengeBuilderStep = 'basics' | 'goal' | 'invite';

const challengeBuilderSteps: readonly {
  key: ChallengeBuilderStep;
  label: string;
}[] = [
  { key: 'basics', label: 'BASICS' },
  { key: 'goal', label: 'GOAL' },
  { key: 'invite', label: 'INVITE' }
];

type ChallengeHubProps = {
  busy: boolean;
  challenges: readonly SocialChallenge[];
  disabled: boolean;
  discoveredChallenges: readonly SocialChallenge[];
  friends: readonly Friend[];
  onCheckIn: (challenge: SocialChallenge) => void;
  onCreate: (
    input: CreateSocialChallengeInput,
    contacts: readonly ChallengeInviteContact[]
  ) => Promise<boolean>;
  onDecision: (
    challenge: SocialChallenge,
    decision: FriendRequestDecision
  ) => void;
  onInvite: (
    challenge: SocialChallenge,
    friendUserId: string,
    friendScreenName: string
  ) => void;
  onJoin: (challenge: SocialChallenge) => void;
  regionCode: string;
};

const activityIcons: Record<
  SocialChallengeActivity,
  ComponentProps<typeof Ionicons>['name']
> = {
  cycling: 'bicycle-outline',
  fitness_class: 'people-outline',
  gym: 'barbell-outline',
  hiking: 'trail-sign-outline',
  other: 'flash-outline',
  running: 'walk-outline',
  walking: 'footsteps-outline'
};

const weekdays = [
  { label: 'SUN', value: 0 },
  { label: 'MON', value: 1 },
  { label: 'TUE', value: 2 },
  { label: 'WED', value: 3 },
  { label: 'THU', value: 4 },
  { label: 'FRI', value: 5 },
  { label: 'SAT', value: 6 }
] as const;

export function ChallengeHub({
  busy,
  challenges,
  disabled,
  discoveredChallenges,
  friends,
  onCheckIn,
  onCreate,
  onDecision,
  onInvite,
  onJoin,
  regionCode
}: ChallengeHubProps) {
  const [section, setSection] = useState<ChallengeHubSection>('mine');
  const availableChallenges = discoveredChallenges.filter(
    ({ myStatus }) => myStatus === 'not_joined'
  );

  return (
    <>
      <View accessibilityRole="tablist" style={styles.hubTabs}>
        <HubTab
          count={challenges.length}
          label="MY"
          onPress={() => setSection('mine')}
          selected={section === 'mine'}
        />
        <HubTab
          count={availableChallenges.length}
          label="DISCOVER"
          onPress={() => setSection('discover')}
          selected={section === 'discover'}
        />
        <HubTab
          icon="add"
          label="CREATE"
          onPress={() => setSection('create')}
          selected={section === 'create'}
        />
      </View>

      {section === 'create' ? (
        <ChallengeBuilder
          busy={busy}
          disabled={disabled}
          friends={friends}
          onCreate={onCreate}
          onCreated={() => setSection('mine')}
          regionCode={regionCode}
        />
      ) : null}

      {section === 'discover' ? (
        <View style={styles.cardList}>
          <View style={styles.listHeader}>
            <View style={styles.listHeaderCopy}>
              <TerminalText glow tone="pink" variant="label">
                NEAR YOU
              </TerminalText>
              <TerminalText tone="muted" uppercase={false} variant="body">
                Join scheduled activity challenges in {formatRegion(regionCode)}.
              </TerminalText>
            </View>
            <View style={styles.regionPill}>
              <Ionicons color={colors.pink} name="location-outline" size={14} />
              <TerminalText tone="pink" variant="micro">
                {regionCode}
              </TerminalText>
            </View>
          </View>
          {availableChallenges.map((challenge) => (
            <ChallengeCard
              busy={busy}
              challenge={challenge}
              friends={friends}
              key={challenge.id}
              onCheckIn={() => onCheckIn(challenge)}
              onDecision={(decision) => onDecision(challenge, decision)}
              onInvite={(friendUserId, friendScreenName) =>
                onInvite(challenge, friendUserId, friendScreenName)
              }
              onJoin={() => onJoin(challenge)}
              variant="discover"
            />
          ))}
          {availableChallenges.length === 0 ? (
            <EmptyState
              body="You have joined everything currently open in this region."
              title="NO OPEN CHALLENGES"
            />
          ) : null}
        </View>
      ) : null}

      {section === 'mine' ? (
        <View style={styles.cardList}>
          <View style={styles.listHeader}>
            <View style={styles.listHeaderCopy}>
              <TerminalText glow tone="cyan" variant="label">
                YOUR CHALLENGES
              </TerminalText>
              <TerminalText tone="muted" uppercase={false} variant="body">
                Track your month, respond to invitations, and keep your crew moving.
              </TerminalText>
            </View>
            <TerminalText tone="green" variant="micro">
              {challenges.length} ACTIVE
            </TerminalText>
          </View>
          {challenges.map((challenge) => (
            <ChallengeCard
              busy={busy}
              challenge={challenge}
              friends={friends}
              key={challenge.id}
              onCheckIn={() => onCheckIn(challenge)}
              onDecision={(decision) => onDecision(challenge, decision)}
              onInvite={(friendUserId, friendScreenName) =>
                onInvite(challenge, friendUserId, friendScreenName)
              }
              onJoin={() => onJoin(challenge)}
              variant="mine"
            />
          ))}
          {challenges.length === 0 ? (
            <EmptyState
              body="Create a goal with a friend or join an activity near you."
              title="NO ACTIVE CHALLENGES"
            />
          ) : null}
        </View>
      ) : null}
    </>
  );
}

function ChallengeBuilder({
  busy,
  disabled,
  friends,
  onCreate,
  onCreated,
  regionCode
}: {
  busy: boolean;
  disabled: boolean;
  friends: readonly Friend[];
  onCreate: (
    input: CreateSocialChallengeInput,
    contacts: readonly ChallengeInviteContact[]
  ) => Promise<boolean>;
  onCreated: () => void;
  regionCode: string;
}) {
  const [challengeType, setChallengeType] = useState<'friend' | 'regional'>('friend');
  const [builderStep, setBuilderStep] = useState<ChallengeBuilderStep>('basics');
  const [activity, setActivity] = useState<SocialChallengeActivity>('gym');
  const [activityLabel, setActivityLabel] = useState('');
  const [description, setDescription] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [locationName, setLocationName] = useState('');
  const [monthOffset, setMonthOffset] = useState(0);
  const [name, setName] = useState('');
  const [participantLimit, setParticipantLimit] = useState(30);
  const [scheduledDays, setScheduledDays] = useState<number[]>([6]);
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [showExternalInvite, setShowExternalInvite] = useState(friends.length === 0);
  const [targetCount, setTargetCount] = useState(4);
  const [targetPeriod, setTargetPeriod] = useState<'monthly' | 'weekly'>('weekly');
  const [validationError, setValidationError] = useState<string | null>(null);
  const currentMonth = buildChallengeMonthWindow(new Date(), 0);
  const nextMonth = buildChallengeMonthWindow(new Date(), 1);
  const selectedMonth = monthOffset === 0 ? currentMonth : nextMonth;
  const builderStepIndex = challengeBuilderSteps.findIndex(
    ({ key }) => key === builderStep
  );

  const continueFromBasics = () => {
    const nameError = validateChallengeName(name);
    const activityError =
      activity === 'other' &&
      (activityLabel.trim().length < 2 || activityLabel.trim().length > 60)
        ? 'Describe the activity in 2-60 characters.'
        : null;
    const error = nameError ?? activityError;
    setValidationError(error);
    if (!error) {
      setBuilderStep('goal');
    }
  };

  const submit = async () => {
    const contacts: ChallengeInviteContact[] = [];
    if (inviteEmail.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) {
        setValidationError('Enter a valid email address.');
        return;
      }
      contacts.push({ channel: 'email', destination: inviteEmail.trim() });
    }
    if (invitePhone.trim()) {
      const normalizedPhone = invitePhone.trim().replace(/[\s().-]/g, '');
      if (!/^\+?[1-9]\d{7,14}$/.test(normalizedPhone)) {
        setValidationError('Enter a phone number with country code.');
        return;
      }
      contacts.push({ channel: 'phone', destination: normalizedPhone });
    }
    const input: CreateSocialChallengeInput = {
      activity,
      activityLabel: activity === 'other'
        ? activityLabel
        : challengeActivityLabels[activity],
      challengeType,
      description,
      endDate: selectedMonth.endDate,
      invitedFriendUserIds: challengeType === 'friend' ? selectedFriendIds : [],
      locationName: challengeType === 'regional' ? locationName : undefined,
      name,
      participantLimit: challengeType === 'regional' ? participantLimit : undefined,
      regionCode: challengeType === 'regional' ? regionCode : undefined,
      scheduledDays: challengeType === 'regional' ? scheduledDays : [],
      scheduledTime: challengeType === 'regional' ? scheduledTime : undefined,
      startDate: selectedMonth.startDate,
      targetCount,
      targetPeriod
    };
    const error = validateChallengeInput(input, contacts.length);
    setValidationError(error);
    if (error) return;
    if (await onCreate(input, contacts)) {
      setName('');
      setDescription('');
      setSelectedFriendIds([]);
      setInviteEmail('');
      setInvitePhone('');
      setBuilderStep('basics');
      setShowExternalInvite(friends.length === 0);
      onCreated();
    }
  };

  return (
    <HUDBorderBox glow style={styles.builder} tone="pink">
      <TerminalText tone="pink" variant="micro">
        NEW MONTHLY MISSION
      </TerminalText>
      <TerminalText glow style={styles.builderTitle} tone="text" variant="title">
        CREATE A CHALLENGE
      </TerminalText>
      <TerminalText tone="muted" uppercase={false} variant="body">
        Set a measurable goal for the month, then challenge a friend or rally people nearby.
      </TerminalText>

      <View
        accessibilityLabel={`Challenge setup step ${builderStepIndex + 1} of ${challengeBuilderSteps.length}`}
        style={styles.builderProgress}
      >
        {challengeBuilderSteps.map((step, index) => {
          const active = step.key === builderStep;
          const complete = index < builderStepIndex;
          return (
            <View key={step.key} style={styles.builderProgressStep}>
              <View
                style={[
                  styles.builderProgressMarker,
                  active ? styles.builderProgressMarkerActive : null,
                  complete ? styles.builderProgressMarkerComplete : null
                ]}
              >
                <TerminalText
                  tone={active || complete ? 'cyan' : 'dim'}
                  variant="micro"
                >
                  {complete ? '✓' : index + 1}
                </TerminalText>
              </View>
              <TerminalText
                tone={active ? 'cyan' : complete ? 'green' : 'dim'}
                variant="micro"
              >
                {step.label}
              </TerminalText>
            </View>
          );
        })}
      </View>

      <TerminalText tone="pink" variant="micro">
        STEP {builderStepIndex + 1} OF {challengeBuilderSteps.length}{' // '}
        {challengeBuilderSteps[builderStepIndex]?.label}
      </TerminalText>

      {builderStep === 'basics' ? (
        <>
      <FieldGroup label="CHALLENGE TYPE">
        <View style={styles.twoColumnControls}>
          <ChoiceCard
            icon="people-outline"
            label="FRIEND"
            onPress={() => {
              setChallengeType('friend');
              setValidationError(null);
            }}
            selected={challengeType === 'friend'}
            subtitle="Private invite"
          />
          <ChoiceCard
            icon="location-outline"
            label="REGIONAL"
            onPress={() => {
              setChallengeType('regional');
              setValidationError(null);
            }}
            selected={challengeType === 'regional'}
            subtitle="Open to locals"
          />
        </View>
      </FieldGroup>

      <AuthTextField
        autoCapitalize="words"
        editable={!disabled}
        label="CHALLENGE NAME"
        maxLength={80}
        onChangeText={(value) => {
          setName(value);
          setValidationError(null);
        }}
        placeholder={challengeType === 'friend' ? 'JULY 4X GYM CREW' : 'WATERFRONT RUN SERIES'}
        value={name}
      />

      <FieldGroup label="ACTIVITY">
        <View style={styles.activityGrid}>
          {socialChallengeActivities.map((candidate) => (
            <ActivityChip
              activity={candidate}
              key={candidate}
              onPress={() => {
                setActivity(candidate);
                setValidationError(null);
              }}
              selected={candidate === activity}
            />
          ))}
        </View>
      </FieldGroup>

      {activity === 'other' ? (
        <AuthTextField
          editable={!disabled}
          label="ACTIVITY NAME"
          maxLength={60}
          onChangeText={setActivityLabel}
          placeholder="PICKLEBALL"
          value={activityLabel}
        />
      ) : null}
        </>
      ) : null}

      {builderStep === 'goal' ? (
        <>
      <FieldGroup label="GOAL">
        <View style={styles.goalRow}>
          <Counter
            label="TIMES"
            maximum={targetPeriod === 'weekly' ? 7 : 31}
            minimum={1}
            onChange={setTargetCount}
            value={targetCount}
          />
          <View style={styles.periodControl}>
            <SegmentButton
              label="WEEKLY"
              onPress={() => {
                setTargetPeriod('weekly');
                setTargetCount((count) => Math.min(count, 7));
              }}
              selected={targetPeriod === 'weekly'}
            />
            <SegmentButton
              label="MONTHLY"
              onPress={() => setTargetPeriod('monthly')}
              selected={targetPeriod === 'monthly'}
            />
          </View>
        </View>
        <TerminalText tone="green" uppercase={false} variant="body">
          Complete {targetCount} {targetCount === 1 ? 'time' : 'times'} every{' '}
          {targetPeriod === 'weekly' ? 'week' : 'month'}.
        </TerminalText>
      </FieldGroup>

      <FieldGroup label="CHALLENGE MONTH">
        <View style={styles.twoColumnControls}>
          <MonthButton
            label={currentMonth.label}
            onPress={() => setMonthOffset(0)}
            selected={monthOffset === 0}
          />
          <MonthButton
            label={nextMonth.label}
            onPress={() => setMonthOffset(1)}
            selected={monthOffset === 1}
          />
        </View>
      </FieldGroup>
        </>
      ) : null}

      {builderStep === 'invite' ? (
        <>
      {challengeType === 'friend' ? (
        <FieldGroup label="CHALLENGE FRIENDS">
          {friends.map((friend) => {
            const selected = selectedFriendIds.includes(friend.userId);
            return (
              <Pressable
                aria-checked={selected}
                accessibilityLabel={`${selected ? 'Remove' : 'Select'} @${friend.screenName}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                key={friend.userId}
                onPress={() => setSelectedFriendIds((ids) => selected
                  ? ids.filter((id) => id !== friend.userId)
                  : [...ids, friend.userId]
                )}
                style={({ pressed }) => [
                  styles.friendOption,
                  selected ? styles.friendOptionSelected : null,
                  pressed ? styles.pressed : null
                ]}
              >
                <Avatar screenName={friend.screenName} />
                <UserAlias
                  alias={friend.screenName}
                  prefix="@"
                  streaks={friend.streaks}
                  style={styles.friendAlias}
                  textStyle={styles.friendName}
                />
                <View style={[styles.checkbox, selected ? styles.checkboxSelected : null]}>
                  {selected ? <Ionicons color={colors.textOnPrimary} name="checkmark" size={16} /> : null}
                </View>
              </Pressable>
            );
          })}
          {friends.length === 0 ? (
            <TerminalText tone="amber" uppercase={false} variant="body">
              No accepted friends yet. Send the challenge by email or phone below.
            </TerminalText>
          ) : null}
          <CyberButtonOutline
            label={showExternalInvite
              ? 'HIDE OUTSIDE INVITE'
              : 'INVITE SOMEONE OUTSIDE GOGYMGO'}
            onPress={() => setShowExternalInvite((visible) => !visible)}
            tone="pink"
          />
          {showExternalInvite ? (
            <View style={styles.contactInvitePanel}>
              <TerminalText tone="pink" variant="micro">
                OUTSIDE GOGYMGO // OPTIONAL
              </TerminalText>
              <TerminalText tone="muted" uppercase={false} variant="caption">
                We create an expiring invitation link, then open your phone&apos;s email or text composer. GoGymGo does not store the raw address or number.
              </TerminalText>
              <AuthTextField
                autoCapitalize="none"
                editable={!disabled}
                keyboardType="email-address"
                label="EMAIL // OPTIONAL"
                maxLength={160}
                onChangeText={(value) => {
                  setInviteEmail(value);
                  setValidationError(null);
                }}
                placeholder="friend@example.com"
                value={inviteEmail}
              />
              <AuthTextField
                editable={!disabled}
                keyboardType="phone-pad"
                label="PHONE // OPTIONAL"
                maxLength={24}
                onChangeText={(value) => {
                  setInvitePhone(value);
                  setValidationError(null);
                }}
                placeholder="+1 250 555 0198"
                value={invitePhone}
              />
            </View>
          ) : null}
        </FieldGroup>
      ) : (
        <>
          <FieldGroup label="REGION">
            <View style={styles.lockedRegion}>
              <Ionicons color={colors.pink} name="location" size={18} />
              <View style={styles.lockedRegionCopy}>
                <TerminalText tone="text" variant="body">
                  {formatRegion(regionCode)}
                </TerminalText>
                <TerminalText tone="dim" uppercase={false} variant="micro">
                  Uses your active competition region
                </TerminalText>
              </View>
              <Ionicons color={colors.green} name="checkmark-circle" size={18} />
            </View>
          </FieldGroup>
          <AuthTextField
            autoCapitalize="words"
            editable={!disabled}
            label="MEETING LOCATION"
            maxLength={120}
            onChangeText={setLocationName}
            placeholder="HIGH PARK NORTH GATE"
            value={locationName}
          />
          <FieldGroup label="REPEATS ON">
            <View style={styles.weekdayRow}>
              {weekdays.map((day) => {
                const selected = scheduledDays.includes(day.value);
                return (
                  <Pressable
                    aria-checked={selected}
                    accessibilityLabel={day.label}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    key={day.value}
                    onPress={() => setScheduledDays((days) => selected
                      ? days.filter((value) => value !== day.value)
                      : [...days, day.value].sort()
                    )}
                    style={({ pressed }) => [
                      styles.weekdayButton,
                      selected ? styles.weekdayButtonSelected : null,
                      pressed ? styles.pressed : null
                    ]}
                  >
                    <TerminalText tone={selected ? 'cyan' : 'dim'} variant="micro">
                      {day.label.slice(0, 1)}
                    </TerminalText>
                  </Pressable>
                );
              })}
            </View>
          </FieldGroup>
          <View style={styles.regionalDetailsRow}>
            <View style={styles.timeField}>
              <AuthTextField
                editable={!disabled}
                label="START TIME"
                maxLength={5}
                onChangeText={setScheduledTime}
                placeholder="18:30"
                value={scheduledTime}
              />
            </View>
            <Counter
              label="MAX PEOPLE"
              maximum={500}
              minimum={2}
              onChange={setParticipantLimit}
              step={5}
              value={participantLimit}
            />
          </View>
        </>
      )}

      <AuthTextField
        editable={!disabled}
        label="DESCRIPTION // OPTIONAL"
        maxLength={240}
        multiline
        onChangeText={setDescription}
        placeholder="ADD DETAILS YOUR CREW SHOULD KNOW"
        value={description}
      />

      <HUDBorderBox style={styles.challengeSummary} tone="muted">
        <TerminalText tone="dim" variant="micro">
          REVIEW
        </TerminalText>
        <TerminalText tone="text" uppercase={false} variant="body">
          {name.trim() || 'Untitled challenge'}
        </TerminalText>
        <TerminalText tone="green" uppercase={false} variant="caption">
          {targetCount} {targetCount === 1 ? 'session' : 'sessions'} per{' '}
          {targetPeriod === 'weekly' ? 'week' : 'month'}{' // '}{selectedMonth.label}
        </TerminalText>
      </HUDBorderBox>
        </>
      ) : null}

      {validationError ? (
        <HUDBorderBox style={styles.validationNotice} tone="red">
          <TerminalText live="assertive" tone="red" uppercase={false} variant="body">
            {validationError}
          </TerminalText>
        </HUDBorderBox>
      ) : null}

      <View style={styles.builderNavigation}>
        {builderStep !== 'basics' ? (
          <CyberButtonOutline
            disabled={busy}
            label="BACK"
            onPress={() => {
              setValidationError(null);
              setBuilderStep(builderStep === 'invite' ? 'goal' : 'basics');
            }}
            style={styles.builderBackButton}
          />
        ) : null}
        <CyberButtonPrimary
          disabled={disabled || busy}
          label={builderStep === 'basics'
            ? 'CONTINUE TO GOAL ->'
            : builderStep === 'goal'
              ? 'CONTINUE TO INVITE ->'
              : busy
                ? 'CREATING...'
                : challengeType === 'friend'
                  ? 'CHALLENGE A FRIEND'
                  : 'PUBLISH REGIONAL CHALLENGE'}
          onPress={() => {
            setValidationError(null);
            if (builderStep === 'basics') {
              continueFromBasics();
            } else if (builderStep === 'goal') {
              setBuilderStep('invite');
            } else {
              void submit();
            }
          }}
          style={styles.builderNextButton}
          tone="pink"
        />
      </View>
    </HUDBorderBox>
  );
}

function ChallengeCard({
  busy,
  challenge,
  friends,
  onCheckIn,
  onDecision,
  onInvite,
  onJoin,
  variant
}: {
  busy: boolean;
  challenge: SocialChallenge;
  friends: readonly Friend[];
  onCheckIn: () => void;
  onDecision: (decision: FriendRequestDecision) => void;
  onInvite: (friendUserId: string, friendScreenName: string) => void;
  onJoin: () => void;
  variant: 'discover' | 'mine';
}) {
  const pendingInvite = challenge.myStatus === 'pending';
  const isRegional = challenge.challengeType === 'regional';
  const memberIds = new Set(challenge.members.map(({ userId }) => userId));
  const availableFriends = friends.filter(({ userId }) => !memberIds.has(userId));
  const acceptedMembers = challenge.members.filter(({ status }) => status === 'accepted');
  const checkInAvailability = getCheckInAvailability(challenge);
  const tone = pendingInvite || isRegional ? 'pink' : 'cyan';

  return (
    <HUDBorderBox glow={pendingInvite} style={styles.challengeCard} tone={tone}>
      <View style={styles.challengeTopRow}>
        <View style={[styles.activityIcon, isRegional ? styles.activityIconPink : null]}>
          <Ionicons
            color={isRegional ? colors.pink : colors.cyan}
            name={activityIcons[challenge.activity]}
            size={22}
          />
        </View>
        <View style={styles.challengeHeading}>
          <TerminalText tone={tone} variant="micro">
            {isRegional
              ? `${challenge.regionCode ?? 'LOCAL'} REGIONAL`
              : 'FRIEND CHALLENGE'}
          </TerminalText>
          <TerminalText glow style={styles.challengeName} tone="text" variant="title">
            {challenge.name}
          </TerminalText>
        </View>
        <StatusPill pending={pendingInvite} />
      </View>

      <View style={styles.challengeMetaGrid}>
        <MetaItem
          icon="flag-outline"
          text={`${challenge.targetCount}x ${challenge.targetPeriod === 'weekly' ? 'each week' : 'this month'}`}
        />
        <MetaItem icon="calendar-outline" text={formatDateRange(challenge.startDate, challenge.endDate)} />
        {isRegional ? (
          <>
            <MetaItem icon="time-outline" text={formatSchedule(challenge)} />
            <MetaItem icon="location-outline" text={challenge.locationName ?? 'Location pending'} />
          </>
        ) : (
          <MetaAlias
            alias={challenge.ownerScreenName}
            icon="person-outline"
            prefix="Started by @"
            streaks={challenge.ownerStreaks}
          />
        )}
      </View>

      {challenge.description ? (
        <TerminalText style={styles.description} tone="muted" uppercase={false} variant="body">
          {challenge.description}
        </TerminalText>
      ) : null}

      {variant === 'discover' ? (
        <>
          <View style={styles.participantRow}>
            <AvatarStack members={acceptedMembers} />
            <TerminalText tone="muted" uppercase={false} variant="body">
              {challenge.participantCount}
              {challenge.participantLimit ? ` / ${challenge.participantLimit}` : ''} joined
            </TerminalText>
          </View>
          <CyberButtonPrimary
            disabled={busy}
            label={busy ? 'JOINING...' : 'JOIN CHALLENGE'}
            onPress={onJoin}
            tone="pink"
          />
        </>
      ) : null}

      {variant === 'mine' && !pendingInvite ? (
        <>
          <ProgressPanel challenge={challenge} />
          {challenge.activity === 'gym' ? (
            <View style={styles.autoCountNotice}>
              <Ionicons color={colors.green} name="shield-checkmark-outline" size={18} />
              <TerminalText style={styles.autoCountText} tone="green" uppercase={false} variant="micro">
                Verified gym sessions count automatically.
              </TerminalText>
            </View>
          ) : (
            <CompactButton
              disabled={
                busy ||
                challenge.myProgress.completionPercent >= 100 ||
                !checkInAvailability.available
              }
              icon="checkmark-circle-outline"
              label={challenge.myProgress.completionPercent >= 100
                ? 'GOAL COMPLETE'
                : checkInAvailability.label}
              onPress={onCheckIn}
              style={styles.fullWidthButton}
              tone="green"
            />
          )}
          <MemberProgress members={acceptedMembers} />
        </>
      ) : null}

      {pendingInvite ? (
        <View style={styles.pendingPanel}>
          <UserAlias
            alias={challenge.ownerScreenName}
            prefix="@"
            streaks={challenge.ownerStreaks}
            tone="amber"
          />
          <TerminalText tone="muted" uppercase={false} variant="body">
            Challenged you to join this monthly goal.
          </TerminalText>
          <View style={styles.actionRow}>
            <CompactButton
              disabled={busy}
              label="ACCEPT"
              onPress={() => onDecision('accepted')}
              style={styles.flexButton}
              tone="green"
            />
            <CompactButton
              disabled={busy}
              label="DECLINE"
              onPress={() => onDecision('declined')}
              tone="muted"
            />
          </View>
        </View>
      ) : null}

      {variant === 'mine' && challenge.myRole === 'owner' && !isRegional ? (
        <View style={styles.invitePanel}>
          <TerminalText tone="cyan" variant="micro">
            INVITE MORE FRIENDS
          </TerminalText>
          {availableFriends.map((friend) => (
            <View key={friend.userId} style={styles.inviteRow}>
              <View style={styles.inviteIdentity}>
                <Avatar screenName={friend.screenName} />
                <UserAlias
                  alias={friend.screenName}
                  prefix="@"
                  streaks={friend.streaks}
                  style={styles.friendAlias}
                  textStyle={styles.friendName}
                />
              </View>
              <CompactButton
                disabled={busy}
                label="INVITE"
                onPress={() => onInvite(friend.userId, friend.screenName)}
                tone="cyan"
              />
            </View>
          ))}
          {availableFriends.length === 0 ? (
            <TerminalText tone="dim" uppercase={false} variant="micro">
              Everyone in your accepted friends list is already invited.
            </TerminalText>
          ) : null}
        </View>
      ) : null}
    </HUDBorderBox>
  );
}

function ProgressPanel({ challenge }: { challenge: SocialChallenge }) {
  return (
    <View style={styles.progressPanel}>
      <View style={styles.progressHeader}>
        <View>
          <TerminalText tone="dim" variant="micro">YOUR PROGRESS</TerminalText>
          <TerminalText glow style={styles.progressValue} tone="green" variant="value">
            {challenge.myProgress.completedCount}
            <TerminalText tone="dim" variant="body">
              {' '}/ {challenge.myProgress.targetTotal}
            </TerminalText>
          </TerminalText>
        </View>
        <TerminalText glow tone="green" variant="label">
          {challenge.myProgress.completionPercent}%
        </TerminalText>
      </View>
      <ProgressBar percent={challenge.myProgress.completionPercent} />
    </View>
  );
}

function MemberProgress({ members }: { members: readonly SocialChallenge['members'][number][] }) {
  if (members.length < 2) return null;
  return (
    <View style={styles.memberProgress}>
      <TerminalText tone="dim" variant="micro">CREW PROGRESS</TerminalText>
      {members.slice(0, 4).map((member) => (
        <View key={member.userId} style={styles.memberProgressRow}>
          <UserAlias
            alias={member.screenName}
            maximum={2}
            prefix="@"
            streaks={member.streaks}
            style={styles.memberProgressIdentity}
            textStyle={styles.memberProgressName}
            variant="micro"
          />
          <View style={styles.memberProgressBar}>
            <ProgressBar percent={member.progress.completionPercent} />
          </View>
          <TerminalText tone="green" variant="micro">
            {member.progress.completedCount}/{member.progress.targetTotal}
          </TerminalText>
        </View>
      ))}
    </View>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <View accessibilityRole="progressbar" style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, percent))}%` }]} />
    </View>
  );
}

function HubTab({
  count,
  icon,
  label,
  onPress,
  selected
}: {
  count?: number;
  icon?: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.hubTab,
        selected ? styles.hubTabSelected : null,
        pressed ? styles.pressed : null
      ]}
    >
      {icon ? <Ionicons color={selected ? colors.cyan : colors.dim} name={icon} size={17} /> : null}
      <TerminalText glow={selected} tone={selected ? 'cyan' : 'muted'} variant="micro">
        {label}
      </TerminalText>
      {count !== undefined ? (
        <View style={[styles.tabCount, selected ? styles.tabCountSelected : null]}>
          <TerminalText tone={selected ? 'green' : 'dim'} variant="micro">
            {count}
          </TerminalText>
        </View>
      ) : null}
    </Pressable>
  );
}

function ChoiceCard({
  icon,
  label,
  onPress,
  selected,
  subtitle
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  selected: boolean;
  subtitle: string;
}) {
  return (
    <Pressable
      aria-checked={selected}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceCard,
        selected ? styles.choiceCardSelected : null,
        pressed ? styles.pressed : null
      ]}
    >
      <Ionicons color={selected ? colors.pink : colors.dim} name={icon} size={21} />
      <View style={styles.choiceCopy}>
        <TerminalText tone={selected ? 'pink' : 'text'} variant="micro">
          {label}
        </TerminalText>
        <TerminalText tone="dim" uppercase={false} variant="micro">
          {subtitle}
        </TerminalText>
      </View>
    </Pressable>
  );
}

function ActivityChip({
  activity,
  onPress,
  selected
}: {
  activity: SocialChallengeActivity;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      aria-checked={selected}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.activityChip,
        selected ? styles.activityChipSelected : null,
        pressed ? styles.pressed : null
      ]}
    >
      <Ionicons
        color={selected ? colors.cyan : colors.dim}
        name={activityIcons[activity]}
        size={17}
      />
      <TerminalText tone={selected ? 'cyan' : 'muted'} variant="micro">
        {challengeActivityLabels[activity].replace(' visits', '').replace(' activity', '')}
      </TerminalText>
    </Pressable>
  );
}

function Counter({
  label,
  maximum,
  minimum,
  onChange,
  step = 1,
  value
}: {
  label: string;
  maximum: number;
  minimum: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}) {
  return (
    <View style={styles.counterShell}>
      <TerminalText tone="dim" variant="micro">{label}</TerminalText>
      <View style={styles.counterControl}>
        <IconButton
          disabled={value <= minimum}
          icon="remove"
          label={`Decrease ${label.toLowerCase()}`}
          onPress={() => onChange(Math.max(minimum, value - step))}
        />
        <TerminalText glow style={styles.counterValue} tone="cyan" variant="value">
          {value}
        </TerminalText>
        <IconButton
          disabled={value >= maximum}
          icon="add"
          label={`Increase ${label.toLowerCase()}`}
          onPress={() => onChange(Math.min(maximum, value + step))}
        />
      </View>
    </View>
  );
}

function IconButton({
  disabled,
  icon,
  label,
  onPress
}: {
  disabled: boolean;
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        disabled ? styles.disabled : null,
        pressed ? styles.pressed : null
      ]}
    >
      <Ionicons color={colors.cyan} name={icon} size={18} />
    </Pressable>
  );
}

function SegmentButton({
  label,
  onPress,
  selected
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      aria-checked={selected}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.segmentButton,
        selected ? styles.segmentButtonSelected : null,
        pressed ? styles.pressed : null
      ]}
    >
      <TerminalText tone={selected ? 'cyan' : 'muted'} variant="micro">
        {label}
      </TerminalText>
    </Pressable>
  );
}

function MonthButton({
  label,
  onPress,
  selected
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      aria-checked={selected}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.monthButton,
        selected ? styles.monthButtonSelected : null,
        pressed ? styles.pressed : null
      ]}
    >
      <Ionicons color={selected ? colors.pink : colors.dim} name="calendar-outline" size={17} />
      <TerminalText tone={selected ? 'pink' : 'muted'} uppercase={false} variant="micro">
        {label}
      </TerminalText>
    </Pressable>
  );
}

function FieldGroup({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <View style={styles.fieldGroup}>
      <TerminalText tone="dim" variant="micro">{label}</TerminalText>
      {children}
    </View>
  );
}

function CompactButton({
  disabled = false,
  icon,
  label,
  onPress,
  style,
  tone
}: {
  disabled?: boolean;
  icon?: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  tone: 'cyan' | 'green' | 'muted';
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.compactButton,
        compactButtonToneStyles[tone],
        disabled ? styles.disabled : null,
        pressed ? styles.pressed : null,
        style
      ]}
    >
      {icon ? (
        <Ionicons
          color={tone === 'green' ? colors.green : colors.cyan}
          name={icon}
          size={17}
        />
      ) : null}
      <TerminalText glow={!disabled} tone={tone} variant="micro">
        {label}
      </TerminalText>
    </Pressable>
  );
}

function MetaItem({
  icon,
  text
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  text: string;
}) {
  return (
    <View style={styles.metaItem}>
      <Ionicons color={colors.dim} name={icon} size={15} />
      <TerminalText style={styles.metaText} tone="muted" uppercase={false} variant="micro">
        {text}
      </TerminalText>
    </View>
  );
}

function MetaAlias({
  alias,
  icon,
  prefix,
  streaks
}: {
  alias: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  prefix: string;
  streaks: SocialChallenge['ownerStreaks'];
}) {
  return (
    <View style={styles.metaItem}>
      <Ionicons color={colors.dim} name={icon} size={15} />
      <UserAlias
        alias={alias}
        prefix={prefix}
        streaks={streaks}
        style={styles.metaAlias}
        tone="muted"
        variant="micro"
      />
    </View>
  );
}

function StatusPill({ pending }: { pending: boolean }) {
  return (
    <View style={[styles.statusPill, pending ? styles.statusPillPending : null]}>
      <View style={[styles.statusDot, pending ? styles.statusDotPending : null]} />
      <TerminalText tone={pending ? 'amber' : 'green'} variant="micro">
        {pending ? 'INVITE' : 'ACTIVE'}
      </TerminalText>
    </View>
  );
}

function Avatar({ screenName }: { screenName: string }) {
  return (
    <View style={styles.avatar}>
      <TerminalText tone="cyan" variant="button">
        {screenName.split('_').map((part) => part[0]).join('').slice(0, 2)}
      </TerminalText>
    </View>
  );
}

function AvatarStack({
  members
}: {
  members: readonly SocialChallenge['members'][number][];
}) {
  return (
    <View style={styles.avatarStack}>
      {members.slice(0, 3).map((member, index) => (
        <View key={member.userId} style={[styles.stackAvatar, { marginLeft: index === 0 ? 0 : -8 }]}>
          <TerminalText tone="cyan" variant="micro">
            {member.screenName.slice(0, 1)}
          </TerminalText>
        </View>
      ))}
    </View>
  );
}

function EmptyState({ body, title }: { body: string; title: string }) {
  return (
    <HUDBorderBox style={styles.emptyState} tone="muted">
      <Ionicons color={colors.dim} name="radio-outline" size={28} />
      <TerminalText tone="muted" variant="label">{title}</TerminalText>
      <TerminalText style={styles.emptyBody} tone="dim" uppercase={false} variant="body">
        {body}
      </TerminalText>
    </HUDBorderBox>
  );
}

function formatRegion(regionCode: string) {
  return regionCode
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function formatDateRange(startDate: string, endDate: string) {
  return `${formatShortDate(startDate)} - ${formatShortDate(endDate)}`;
}

function formatShortDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-CA', { day: 'numeric', month: 'short' })
    .format(new Date(year, month - 1, day, 12));
}

function formatSchedule(challenge: SocialChallenge) {
  const days = challenge.scheduledDays
    .map((value) => weekdays.find((day) => day.value === value)?.label)
    .filter(Boolean)
    .join(', ');
  return `${days || 'Schedule pending'}${challenge.scheduledTime ? ` at ${formatTime(challenge.scheduledTime)}` : ''}`;
}

function getCheckInAvailability(challenge: SocialChallenge) {
  const now = new Date();
  const timezone = challenge.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = formatDateKeyInTimezone(now, timezone);
  if (today < challenge.startDate) {
    return { available: false, label: `STARTS ${formatShortDate(challenge.startDate)}` };
  }
  if (today > challenge.endDate) {
    return { available: false, label: 'CHALLENGE ENDED' };
  }
  const weekday = weekdayInTimezone(now, timezone);
  if (challenge.scheduledDays.length > 0 && !challenge.scheduledDays.includes(weekday)) {
    const labels = challenge.scheduledDays
      .map((value) => weekdays.find((day) => day.value === value)?.label)
      .filter(Boolean)
      .join(' / ');
    return { available: false, label: `AVAILABLE ${labels}` };
  }
  return { available: true, label: 'CHECK IN TODAY' };
}

function formatDateKeyInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: timezone,
    year: 'numeric'
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function weekdayInTimezone(date: Date, timezone: string) {
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short'
  }).format(date).toUpperCase();
  return weekdays.find(({ label: candidate }) => candidate === label)?.value ?? date.getDay();
}

function formatTime(time: string) {
  const [hourValue, minute] = time.split(':').map(Number);
  const suffix = hourValue >= 12 ? 'PM' : 'AM';
  const hour = hourValue % 12 || 12;
  return `${hour}:${String(minute).padStart(2, '0')} ${suffix}`;
}

const compactButtonToneStyles = {
  cyan: {
    backgroundColor: colors.surfaceCyanGhost,
    borderColor: colors.borderCyanButton
  },
  green: {
    backgroundColor: colors.surfaceSuccess,
    borderColor: colors.borderSuccess
  },
  muted: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.borderMuted
  }
} as const;

const styles = StyleSheet.create({
  hubTabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.lg
  },
  hubTab: {
    minHeight: 48,
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.sm,
    backgroundColor: colors.panelAlpha45
  },
  hubTabSelected: {
    borderColor: colors.borderCyanBright,
    backgroundColor: colors.surfaceCyanActive
  },
  tabCount: {
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    borderRadius: 11,
    backgroundColor: colors.whiteAlpha06
  },
  tabCountSelected: {
    backgroundColor: colors.surfaceSuccess
  },
  builder: {
    gap: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg
  },
  builderTitle: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.title
  },
  builderProgress: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  builderProgressStep: {
    minWidth: 0,
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs
  },
  builderProgressMarker: {
    width: '100%',
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.sm,
    backgroundColor: colors.panelAlpha45
  },
  builderProgressMarkerActive: {
    borderColor: colors.borderCyanBright,
    backgroundColor: colors.surfaceCyanActive
  },
  builderProgressMarkerComplete: {
    borderColor: colors.borderSuccess,
    backgroundColor: colors.surfaceSuccess
  },
  builderNavigation: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm
  },
  builderBackButton: {
    flex: 0.38
  },
  builderNextButton: {
    minWidth: 0,
    flex: 1
  },
  challengeSummary: {
    gap: spacing.xs,
    padding: spacing.md
  },
  fieldGroup: {
    gap: spacing.sm
  },
  twoColumnControls: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  choiceCard: {
    minHeight: 64,
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.sm,
    backgroundColor: colors.panelAlpha45
  },
  choiceCardSelected: {
    borderColor: colors.borderPinkGlow,
    backgroundColor: colors.surfacePinkActive
  },
  choiceCopy: {
    minWidth: 0,
    flex: 1
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  activityChip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.sm,
    backgroundColor: colors.panelAlpha45
  },
  activityChipSelected: {
    borderColor: colors.borderCyanBright,
    backgroundColor: colors.surfaceCyanActive
  },
  goalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: spacing.md
  },
  counterShell: {
    gap: spacing.xs
  },
  counterControl: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderCyanStrong,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceCyanGhost,
    overflow: 'hidden'
  },
  iconButton: {
    width: 44,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center'
  },
  counterValue: {
    minWidth: 42,
    textAlign: 'center',
    fontSize: fontSizes.title
  },
  periodControl: {
    minWidth: 150,
    flex: 1,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.sm,
    overflow: 'hidden'
  },
  segmentButton: {
    minHeight: 48,
    minWidth: 72,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.panelAlpha45
  },
  segmentButtonSelected: {
    backgroundColor: colors.surfaceCyanActive
  },
  monthButton: {
    minHeight: 50,
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.sm,
    backgroundColor: colors.panelAlpha45
  },
  monthButtonSelected: {
    borderColor: colors.borderPinkGlow,
    backgroundColor: colors.surfacePinkActive
  },
  friendOption: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.sm,
    backgroundColor: colors.panelAlpha45
  },
  friendOptionSelected: {
    borderColor: colors.borderCyanBright,
    backgroundColor: colors.surfaceCyanActive
  },
  contactInvitePanel: {
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderPinkMuted
  },
  friendName: {
    minWidth: 0,
    flexShrink: 1,
    fontFamily: fontFamilies.terminal
  },
  friendAlias: {
    flex: 1
  },
  checkbox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.sm
  },
  checkboxSelected: {
    borderColor: colors.cyan,
    backgroundColor: colors.cyan
  },
  lockedRegion: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderPinkMedium,
    borderRadius: radii.sm,
    backgroundColor: colors.surfacePinkGhost
  },
  lockedRegionCopy: {
    minWidth: 0,
    flex: 1
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs
  },
  weekdayButton: {
    minWidth: 0,
    minHeight: 44,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.sm,
    backgroundColor: colors.panelAlpha45
  },
  weekdayButtonSelected: {
    borderColor: colors.borderCyanBright,
    backgroundColor: colors.surfaceCyanActive
  },
  regionalDetailsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md
  },
  timeField: {
    minWidth: 0,
    flex: 1
  },
  validationNotice: {
    padding: spacing.md
  },
  cardList: {
    gap: spacing.md
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.xs
  },
  listHeaderCopy: {
    minWidth: 0,
    flex: 1,
    gap: spacing.xs
  },
  regionPill: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderPinkMedium,
    borderRadius: 16,
    backgroundColor: colors.surfacePinkGhost
  },
  challengeCard: {
    gap: spacing.md,
    padding: spacing.lg
  },
  challengeTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm
  },
  activityIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderCyanStrong,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceCyanSelected
  },
  activityIconPink: {
    borderColor: colors.borderPinkStrong,
    backgroundColor: colors.surfacePink
  },
  challengeHeading: {
    minWidth: 0,
    flex: 1,
    gap: 2
  },
  challengeName: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.cardTitle
  },
  statusPill: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSuccess,
    borderRadius: 14,
    backgroundColor: colors.surfaceSuccess
  },
  statusPillPending: {
    borderColor: colors.borderWarning,
    backgroundColor: colors.surfaceWarning
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.green
  },
  statusDotPending: {
    backgroundColor: colors.amber
  },
  challengeMetaGrid: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderCyanHairline
  },
  metaItem: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  metaText: {
    minWidth: 0,
    flex: 1
  },
  metaAlias: {
    flex: 1
  },
  description: {
    fontFamily: fontFamilies.body
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  stackAvatar: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
    borderRadius: 15,
    backgroundColor: colors.surfaceCyanSelected
  },
  progressPanel: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSuccess,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceSuccess
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  progressValue: {
    marginTop: 2,
    fontSize: fontSizes.titleXl
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.whiteAlpha10,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.green
  },
  autoCountNotice: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSuccess,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceSuccess
  },
  autoCountText: {
    minWidth: 0,
    flex: 1
  },
  memberProgress: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderCyanHairline
  },
  memberProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  memberProgressName: {
    flexShrink: 1
  },
  memberProgressIdentity: {
    width: 132
  },
  memberProgressBar: {
    minWidth: 20,
    flex: 1
  },
  pendingPanel: {
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderWarning,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceWarning
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  flexButton: {
    flex: 1
  },
  fullWidthButton: {
    alignSelf: 'stretch'
  },
  compactButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radii.sm
  },
  invitePanel: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderCyanHairline
  },
  inviteRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  inviteIdentity: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  avatar: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderCyanStrong,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceCyanSelected
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl
  },
  emptyBody: {
    textAlign: 'center'
  },
  pressed: {
    opacity: 0.72
  },
  disabled: {
    opacity: 0.42
  }
});
