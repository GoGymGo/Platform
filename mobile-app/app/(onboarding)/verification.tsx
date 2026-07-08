import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { colors, cyberGlow, fontFamilies, spacing, fontSizes } from '@/constants/theme';

type VerificationPath = 'wearable' | 'gymQr';

type DeviceKey =
  | 'appleWatch'
  | 'galaxyWatch'
  | 'pixelWatch'
  | 'garmin'
  | 'fitbit'
  | 'coros'
  | 'suunto'
  | 'amazfit'
  | 'huawei'
  | 'withings'
  | 'whoop'
  | 'ouraRing'
  | 'polarH10'
  | 'polarVerity'
  | 'wahooTickr'
  | 'bleStrap'
  | 'antStrap'
  | 'phonePpg';

type DeviceOption = {
  key: DeviceKey;
  marker: string;
  name: string;
  sub: string;
};

type GymKey = 'ironDistrict' | 'voltClub' | 'northline';

type GymOption = {
  key: GymKey;
  name: string;
  sub: string;
};

const deviceCatalog: readonly DeviceOption[] = [
  { key: 'appleWatch', marker: 'AW', name: 'APPLE WATCH', sub: 'HEALTHKIT // LIVE HEART RATE' },
  { key: 'galaxyWatch', marker: 'GW', name: 'SAMSUNG GALAXY WATCH', sub: 'HEALTH CONNECT // LIVE HEART RATE' },
  { key: 'pixelWatch', marker: 'PW', name: 'GOOGLE PIXEL WATCH', sub: 'HEALTH CONNECT // LIVE HEART RATE' },
  { key: 'garmin', marker: 'GA', name: 'GARMIN', sub: 'FORERUNNER // FENIX // VENU' },
  { key: 'fitbit', marker: 'FB', name: 'FITBIT', sub: 'CHARGE // SENSE // VERSA' },
  { key: 'coros', marker: 'CO', name: 'COROS', sub: 'PACE // APEX // VERTIX' },
  { key: 'suunto', marker: 'SU', name: 'SUUNTO', sub: 'RACE // VERTICAL' },
  { key: 'amazfit', marker: 'AZ', name: 'AMAZFIT', sub: 'GTR // T-REX // ACTIVE' },
  { key: 'huawei', marker: 'HW', name: 'HUAWEI WATCH', sub: 'GT // FIT SERIES' },
  { key: 'withings', marker: 'WI', name: 'WITHINGS SCANWATCH', sub: 'HYBRID // MEDICAL-GRADE HEART RATE' },
  { key: 'whoop', marker: 'WH', name: 'WHOOP', sub: 'STRAP 4.0 // CONTINUOUS HEART RATE' },
  { key: 'ouraRing', marker: 'OR', name: 'OURA RING', sub: 'GEN 3 // WORKOUT HEART RATE' },
  { key: 'polarH10', marker: 'P10', name: 'POLAR H10', sub: 'CHEST STRAP // GOLD STANDARD' },
  { key: 'polarVerity', marker: 'PV', name: 'POLAR VERITY SENSE', sub: 'OPTICAL ARMBAND' },
  { key: 'wahooTickr', marker: 'WT', name: 'WAHOO TICKR', sub: 'CHEST STRAP // BLUETOOTH + ANT+' },
  { key: 'bleStrap', marker: 'STRAP', name: 'BLUETOOTH HEART-RATE STRAP', sub: 'ANY STANDARD BLUETOOTH MONITOR' },
  { key: 'antStrap', marker: 'ANT', name: 'ANT+ CHEST STRAP', sub: 'GENERIC ANT+ MONITOR' },
  { key: 'phonePpg', marker: 'PH', name: 'PHONE CAMERA BACKUP', sub: 'LOCAL CAMERA // NO FRAMES STORED' }
];

const primaryDeviceKeys: readonly DeviceKey[] = [
  'appleWatch',
  'galaxyWatch',
  'garmin',
  'whoop'
];

const gymOptions: readonly GymOption[] = [
  { key: 'ironDistrict', name: 'IRON DISTRICT', sub: 'KING ST // ENTRY + EXIT QR READY' },
  { key: 'voltClub', name: 'VOLT PERFORMANCE CLUB', sub: 'QUEEN WEST // PARTNER GYM' },
  { key: 'northline', name: 'NORTHLINE FITNESS', sub: 'LIBERTY VILLAGE // QR PILOT' }
];

const initialLinkedDevices: Record<DeviceKey, boolean> = {
  appleWatch: false,
  galaxyWatch: false,
  pixelWatch: false,
  garmin: false,
  fitbit: false,
  coros: false,
  suunto: false,
  amazfit: false,
  huawei: false,
  withings: false,
  whoop: false,
  ouraRing: false,
  polarH10: false,
  polarVerity: false,
  wahooTickr: false,
  bleStrap: false,
  antStrap: false,
  phonePpg: false
};

export default function VerificationScreen() {
  const router = useRouter();
  const [verificationPath, setVerificationPath] = useState<VerificationPath>('wearable');
  const [deviceQuery, setDeviceQuery] = useState('');
  const [showAllDevices, setShowAllDevices] = useState(false);
  const [linkedDevices, setLinkedDevices] = useState<Record<DeviceKey, boolean>>(initialLinkedDevices);
  const [selectedGym, setSelectedGym] = useState<GymKey | null>(null);

  const deviceResults = useMemo(() => {
    const query = deviceQuery.trim().toLowerCase();
    const matches = query
      ? deviceCatalog.filter((device) =>
          `${device.name} ${device.sub}`.toLowerCase().includes(query)
        )
      : deviceCatalog;

    if (query || showAllDevices) {
      return matches;
    }

    return matches.filter((device) => primaryDeviceKeys.includes(device.key));
  }, [deviceQuery, showAllDevices]);

  const hasLinkedDevice = Object.values(linkedDevices).some(Boolean);
  const ctaDisabled =
    verificationPath === 'gymQr'
      ? selectedGym === null
      : !hasLinkedDevice;
  const ctaLabel =
    verificationPath === 'gymQr'
      ? selectedGym === null
        ? 'SELECT GYM TO CONTINUE'
        : 'CONTINUE WITH GYM QR ->'
      : hasLinkedDevice
        ? 'CONTINUE WITH HEART-RATE DEVICE ->'
        : 'CONNECT DEVICE TO CONTINUE';
  const ctaHelper =
    verificationPath === 'gymQr'
      ? 'SELECT A PARTNER GYM SO ENTRY AND EXIT QR CHECKPOINTS MATCH YOUR SESSION.'
      : 'CONNECT ONE HEART-RATE SOURCE OR SWITCH TO PARTNER GYM QR.';

  const toggleDevice = (key: DeviceKey) => {
    setLinkedDevices((current) => ({
      ...current,
      [key]: !current[key]
    }));
  };

  return (
    <ScreenContainer>
      <SponsorBanner />
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stepHeader}>
          <TerminalText tone="dim" variant="label">
            STEP 03 / 04
          </TerminalText>
          <TerminalText glow tone="cyan" variant="label">
            VERIFICATION
          </TerminalText>
        </View>
        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>

        <TerminalText glow style={styles.title} tone="cyan" variant="title">
          CHOOSE HOW TO VERIFY WORKOUTS
        </TerminalText>
        <TerminalText style={styles.body} tone="muted" variant="body">
          CONNECT A HEART-RATE SOURCE, OR USE A PARTNER GYM QR TO START AND END
          VERIFIED SESSIONS AT THE GYM.
        </TerminalText>

        <View style={styles.methodRow}>
          <MethodCard
            active={verificationPath === 'wearable'}
            option="OPTION 01"
            subtitle="WATCH, STRAP OR WEARABLE"
            title="HEART-RATE DEVICE"
            onPress={() => setVerificationPath('wearable')}
          />
          <MethodCard
            active={verificationPath === 'gymQr'}
            option="OPTION 02"
            subtitle="SCAN IN AND SCAN OUT"
            title="PARTNER GYM QR"
            onPress={() => setVerificationPath('gymQr')}
          />
        </View>

        {verificationPath === 'wearable' ? (
          <View>
            <HUDBorderBox style={styles.searchRow} tone="muted">
              <TerminalText tone="dim" variant="label">
                SEARCH
              </TerminalText>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setDeviceQuery}
                placeholder="SEARCH // GARMIN, WHOOP, POLAR..."
                placeholderTextColor={colors.dim}
                style={styles.searchInput}
                value={deviceQuery}
              />
            </HUDBorderBox>

            <HUDBorderBox style={styles.dataNotice} tone="muted">
              <TerminalText glow tone="cyan" variant="label">
                HEALTH DATA NOTICE
              </TerminalText>
              <TerminalText style={styles.dataNoticeCopy} tone="muted" variant="micro">
                HEART-RATE SOURCES SEND WORKOUT VERIFICATION EVENTS ONLY. IF
                PHONE CAMERA HEART-RATE CHECKS ARE BACKUP ONLY. CAMERA FRAMES
                STAY LOCAL AND ARE NOT STORED OR TRANSMITTED.
              </TerminalText>
            </HUDBorderBox>

            <View style={styles.deviceList}>
              {deviceResults.map((device) => (
                <DeviceRow
                  device={device}
                  key={device.key}
                  linked={linkedDevices[device.key]}
                  onPress={() => toggleDevice(device.key)}
                />
              ))}

              {!deviceQuery && !showAllDevices ? (
                <CyberButtonOutline
                  label="MORE DEVICES"
                  onPress={() => setShowAllDevices(true)}
                />
              ) : null}

              {deviceResults.length === 0 ? (
                <TerminalText style={styles.noResults} tone="dim" variant="body">
                  NO SOURCES MATCH YOUR SEARCH.
                </TerminalText>
              ) : null}
            </View>
          </View>
        ) : (
          <View>
            <HUDBorderBox glow style={styles.qrNote} tone="cyan">
              <TerminalText glow tone="cyan" variant="label">
                QR
              </TerminalText>
              <TerminalText style={styles.qrCopy} tone="cyan" variant="body">
                AT PARTNERED GYMS, SCAN THE ENTRY QR AFTER YOU ARRIVE TO START
                YOUR SESSION, THEN SCAN THE EXIT QR WHEN YOU LEAVE TO END IT.
                QR CAMERA FRAMES ARE NOT STORED OR TRANSMITTED.
              </TerminalText>
            </HUDBorderBox>
            <TerminalText style={styles.gymLabel} tone="dim" variant="label">
              SELECT PARTNER GYM
            </TerminalText>
            <View style={styles.deviceList}>
              {gymOptions.map((gym) => (
                <GymRow
                  gym={gym}
                  key={gym.key}
                  selected={selectedGym === gym.key}
                  onPress={() => setSelectedGym(gym.key)}
                />
              ))}
            </View>
            <TerminalText style={styles.qrFootnote} tone="dim" variant="body">
              QR VERIFICATION CAN REPLACE A WEARABLE FOR PARTNER-GYM SESSIONS.
              BIOMETRIC CHECKS STILL CONFIRM IT IS YOU.
            </TerminalText>
          </View>
        )}

        <View style={styles.actions}>
          <TerminalText style={styles.ctaHelper} tone="dim" variant="micro">
            {ctaHelper}
          </TerminalText>
          <CyberButtonPrimary
            disabled={ctaDisabled}
            label={ctaLabel}
            onPress={() => router.push('/how-it-works')}
            tone="pink"
          />
          <CyberButtonOutline
            label="BACK"
            onPress={() => router.back()}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function SponsorBanner() {
  return (
    <HUDBorderBox style={styles.sponsorBanner} tone="muted">
      <View style={styles.sponsorMark}>
        <TerminalText glow tone="pink" variant="title">
          V
        </TerminalText>
      </View>
      <View style={styles.sponsorCopy}>
        <TerminalText tone="dim" variant="micro">
          SPONSOR SIGNAL
        </TerminalText>
        <TerminalText style={styles.sponsorTitle} tone="text" variant="body">
          SPONSORED BY VOLT
        </TerminalText>
        <TerminalText tone="muted" variant="body">
          PRIZE POOL PARTNER
        </TerminalText>
      </View>
    </HUDBorderBox>
  );
}

function MethodCard({
  active,
  onPress,
  option,
  subtitle,
  title
}: {
  active: boolean;
  onPress: () => void;
  option: string;
  subtitle: string;
  title: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={styles.methodPressable}
    >
      <HUDBorderBox glow={active} style={styles.methodCard} tone={active ? 'cyan' : 'muted'}>
        <TerminalText tone="dim" variant="micro">
          {option}
        </TerminalText>
        <TerminalText glow={active} style={styles.methodTitle} tone={active ? 'cyan' : 'text'} variant="body">
          {title}
        </TerminalText>
        <TerminalText tone="muted" variant="micro">
          {subtitle}
        </TerminalText>
      </HUDBorderBox>
    </Pressable>
  );
}

function DeviceRow({
  device,
  linked,
  onPress
}: {
  device: DeviceOption;
  linked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <HUDBorderBox glow={linked} style={styles.listRow} tone={linked ? 'cyan' : 'muted'}>
        <View style={styles.listMarker}>
          <TerminalText glow={linked} tone={linked ? 'cyan' : 'dim'} variant="label">
            {device.marker}
          </TerminalText>
        </View>
        <View style={styles.listCopy}>
          <TerminalText glow={linked} style={styles.listTitle} tone={linked ? 'cyan' : 'text'} variant="body">
            {device.name}
          </TerminalText>
          <TerminalText tone="muted" variant="micro">
            {device.sub}
          </TerminalText>
        </View>
        <StatusBadge active={linked} label={linked ? 'LINKED' : 'CONNECT'} />
      </HUDBorderBox>
    </Pressable>
  );
}

function GymRow({
  gym,
  onPress,
  selected
}: {
  gym: GymOption;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
    >
      <HUDBorderBox glow={selected} style={styles.listRow} tone={selected ? 'cyan' : 'muted'}>
        <View style={styles.listMarker}>
          <TerminalText glow={selected} tone={selected ? 'cyan' : 'dim'} variant="label">
            QR
          </TerminalText>
        </View>
        <View style={styles.listCopy}>
          <TerminalText glow={selected} style={styles.listTitle} tone={selected ? 'cyan' : 'text'} variant="body">
            {gym.name}
          </TerminalText>
          <TerminalText tone="muted" variant="micro">
            {gym.sub}
          </TerminalText>
        </View>
        <StatusBadge active={selected} label={selected ? 'SELECTED' : 'SELECT GYM'} />
      </HUDBorderBox>
    </Pressable>
  );
}

function StatusBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <View style={[styles.badge, active ? styles.badgeActive : styles.badgeIdle]}>
      <TerminalText tone={active ? 'cyan' : 'dim'} variant="micro">
        {label}
      </TerminalText>
    </View>
  );
}

const styles = StyleSheet.create({
  sponsorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md
  },
  sponsorMark: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.sponsorBorder,
    borderRadius: 8,
    backgroundColor: colors.surfacePink
  },
  sponsorCopy: {
    flex: 1
  },
  sponsorTitle: {
    marginTop: 1,
    fontFamily: fontFamilies.terminal
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  progressTrack: {
    height: 3,
    overflow: 'hidden',
    marginBottom: spacing.xxl,
    borderRadius: 2,
    backgroundColor: colors.whiteAlpha06
  },
  progressFill: {
    width: '75%',
    height: '100%',
    backgroundColor: colors.cyan,
    ...cyberGlow.cyan
  },
  title: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.screenTitle,
    lineHeight: 34,
    textAlign: 'center'
  },
  body: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    fontFamily: fontFamilies.terminal
  },
  methodRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14
  },
  methodPressable: {
    flex: 1
  },
  methodCard: {
    minHeight: 116,
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: 10
  },
  methodTitle: {
    marginVertical: spacing.xs,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.button,
    lineHeight: 18
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    paddingHorizontal: 14
  },
  searchInput: {
    flex: 1,
    minHeight: 46,
    color: colors.text,
    fontFamily: fontFamilies.terminal,
    fontSize: fontSizes.control
  },
  deviceList: {
    gap: 9
  },
  dataNotice: {
    gap: spacing.xs,
    marginBottom: 14,
    paddingVertical: spacing.md,
    paddingHorizontal: 15
  },
  dataNoticeCopy: {
    fontFamily: fontFamilies.terminal
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: 15
  },
  listMarker: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderCyanSoft,
    borderRadius: 10
  },
  listCopy: {
    flex: 1
  },
  listTitle: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.button,
    lineHeight: 18
  },
  badge: {
    flexShrink: 0,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 7
  },
  badgeActive: {
    borderColor: colors.borderCyanHeavy,
    backgroundColor: colors.surfaceCyanSelected
  },
  badgeIdle: {
    borderColor: colors.whiteAlpha12
  },
  noResults: {
    paddingVertical: 22,
    fontFamily: fontFamilies.terminal,
    textAlign: 'center'
  },
  qrNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    marginBottom: 14,
    paddingVertical: 14,
    paddingHorizontal: 15
  },
  qrCopy: {
    flex: 1,
    fontFamily: fontFamilies.terminal
  },
  gymLabel: {
    marginHorizontal: spacing.xs,
    marginBottom: 10,
    fontFamily: fontFamilies.terminal
  },
  qrFootnote: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.terminal,
    textAlign: 'center'
  },
  actions: {
    gap: spacing.md,
    marginTop: 18
  },
  ctaHelper: {
    fontFamily: fontFamilies.terminal,
    textAlign: 'center'
  }
});
