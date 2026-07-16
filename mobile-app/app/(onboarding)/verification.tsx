import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import {
  ScreenScrollView,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { CompactTextButton, OnboardingHeader } from '@/components/onboarding';
import { colors, fontFamilies, fontSizes, radii, spacing } from '@/constants/theme';
import { goBackOrReplace } from '@/navigation/goBack';
import { useAuth } from '@/state/auth';
import {
  getVerificationPreference,
  getPreferenceOwnerId,
  saveVerificationPreference
} from '@/state/onboardingPreferences';

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
  { key: 'appleWatch', name: 'APPLE WATCH', sub: 'HEALTHKIT // LIVE HEART RATE' },
  { key: 'galaxyWatch', name: 'SAMSUNG GALAXY WATCH', sub: 'HEALTH CONNECT // LIVE HEART RATE' },
  { key: 'pixelWatch', name: 'GOOGLE PIXEL WATCH', sub: 'HEALTH CONNECT // LIVE HEART RATE' },
  { key: 'garmin', name: 'GARMIN', sub: 'FORERUNNER // FENIX // VENU' },
  { key: 'fitbit', name: 'FITBIT', sub: 'CHARGE // SENSE // VERSA' },
  { key: 'coros', name: 'COROS', sub: 'PACE // APEX // VERTIX' },
  { key: 'suunto', name: 'SUUNTO', sub: 'RACE // VERTICAL' },
  { key: 'amazfit', name: 'AMAZFIT', sub: 'GTR // T-REX // ACTIVE' },
  { key: 'huawei', name: 'HUAWEI WATCH', sub: 'GT // FIT SERIES' },
  { key: 'withings', name: 'WITHINGS SCANWATCH', sub: 'HYBRID HEART-RATE WATCH' },
  { key: 'whoop', name: 'WHOOP', sub: 'CONTINUOUS HEART-RATE STRAP' },
  { key: 'ouraRing', name: 'OURA RING', sub: 'WORKOUT HEART RATE' },
  { key: 'polarH10', name: 'POLAR H10', sub: 'CHEST STRAP' },
  { key: 'polarVerity', name: 'POLAR VERITY SENSE', sub: 'OPTICAL ARMBAND' },
  { key: 'wahooTickr', name: 'WAHOO TICKR', sub: 'BLUETOOTH CHEST STRAP' },
  { key: 'bleStrap', name: 'BLUETOOTH HEART-RATE STRAP', sub: 'STANDARD BLUETOOTH MONITOR' },
  { key: 'antStrap', name: 'ANT+ CHEST STRAP', sub: 'STANDARD ANT+ MONITOR' },
  { key: 'phonePpg', name: 'PHONE CAMERA BACKUP', sub: 'LOCAL CHECK // NO FRAMES STORED' }
];

const primaryDeviceKeys: readonly DeviceKey[] = ['appleWatch', 'galaxyWatch', 'garmin', 'whoop'];

const gymOptions: readonly GymOption[] = [
  { key: 'ironDistrict', name: 'IRON DISTRICT', sub: 'KING ST // ENTRY + EXIT QR READY' },
  { key: 'voltClub', name: 'VOLT PERFORMANCE CLUB', sub: 'QUEEN WEST // PARTNER GYM' },
  { key: 'northline', name: 'NORTHLINE FITNESS', sub: 'LIBERTY VILLAGE // QR READY' }
];

export default function VerificationScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const preferenceOwnerId = getPreferenceOwnerId(user?.uid);
  const { source } = useLocalSearchParams<{ source?: string }>();
  const [verificationPath, setVerificationPath] = useState<VerificationPath>('wearable');
  const [showAllDevices, setShowAllDevices] = useState(false);
  const [deviceQuery, setDeviceQuery] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<DeviceKey | null>(null);
  const [gymQuery, setGymQuery] = useState('');
  const [selectedGym, setSelectedGym] = useState<GymKey | null>(null);
  const [preferenceReady, setPreferenceReady] = useState(false);
  const [sourcePickerExpanded, setSourcePickerExpanded] = useState(false);

  useEffect(() => {
    let active = true;

    if (!preferenceOwnerId) {
      void Promise.resolve().then(() => {
        if (active) {
          setPreferenceReady(true);
        }
      });
      return () => {
        active = false;
      };
    }

    void getVerificationPreference(preferenceOwnerId).then((preference) => {
      if (!active) {
        return;
      }
      if (preference.method === 'heartRate') {
        const savedDevice = deviceCatalog.find((device) => device.key === preference.sourceKey);
        setVerificationPath('wearable');
        setSelectedDevice(savedDevice?.key ?? null);
        setShowAllDevices(Boolean(savedDevice && !primaryDeviceKeys.includes(savedDevice.key)));
        setSourcePickerExpanded(!savedDevice);
        setPreferenceReady(true);
        return;
      }

      const savedGym = gymOptions.find((gym) => gym.key === preference.sourceKey);
      setVerificationPath('gymQr');
      setSelectedGym(savedGym?.key ?? null);
      setSourcePickerExpanded(!savedGym);
      setPreferenceReady(true);
    });

    return () => {
      active = false;
    };
  }, [preferenceOwnerId]);

  const visibleDevices = useMemo(() => {
    if (!showAllDevices) {
      return deviceCatalog.filter((device) => primaryDeviceKeys.includes(device.key));
    }
    const query = deviceQuery.trim().toLowerCase();
    return query
      ? deviceCatalog.filter((device) =>
          `${device.name} ${device.sub}`.toLowerCase().includes(query)
        )
      : deviceCatalog;
  }, [deviceQuery, showAllDevices]);

  const visibleGyms = useMemo(() => {
    const query = gymQuery.trim().toLowerCase();
    return query
      ? gymOptions.filter((gym) => `${gym.name} ${gym.sub}`.toLowerCase().includes(query))
      : gymOptions;
  }, [gymQuery]);

  const canContinue = verificationPath === 'wearable' ? selectedDevice !== null : selectedGym !== null;
  const selectedSource = verificationPath === 'wearable'
    ? deviceCatalog.find((device) => device.key === selectedDevice)
    : gymOptions.find((gym) => gym.key === selectedGym);
  const ctaLabel = verificationPath === 'wearable'
    ? selectedDevice
      ? 'SAVE DEVICE AS DEFAULT ->'
      : 'SELECT A DEVICE TO CONTINUE'
    : selectedGym
      ? 'CONTINUE WITH GYM QR ->'
      : 'SELECT A GYM TO CONTINUE';

  async function continueWithVerificationMethod() {
    const selectedSource = verificationPath === 'wearable'
      ? deviceCatalog.find((device) => device.key === selectedDevice)
      : gymOptions.find((gym) => gym.key === selectedGym);

    if (!selectedSource) {
      return;
    }

    if (!preferenceOwnerId) {
      return;
    }

    await saveVerificationPreference(preferenceOwnerId, {
      method: verificationPath === 'wearable' ? 'heartRate' : 'partnerGymQr',
      sourceKey: selectedSource.key,
      sourceLabel: selectedSource.name
    });
    router.replace(source === 'profile' ? '/profile' : '/commitment');
  }

  function selectVerificationPath(path: VerificationPath) {
    setVerificationPath(path);
    setSourcePickerExpanded(path === 'wearable' ? selectedDevice === null : selectedGym === null);
  }

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <OnboardingHeader
          label={source === 'profile' ? 'EDIT VERIFICATION' : 'VERIFICATION'}
          onBack={() => goBackOrReplace(
            router,
            source === 'profile' ? '/profile' : '/consents'
          )}
          progress={source === 'profile' ? 100 : 80}
          step={source === 'profile' ? 'PROFILE' : 'STEP 04 / 05'}
        />

        <TerminalText glow style={styles.title} tone="cyan" variant="title">
          HOW WILL YOU VERIFY WORKOUTS?
        </TerminalText>
        <TerminalText style={styles.body} tone="muted" uppercase={false} variant="body">
          Choose your default workout method. Every verified workout also
          requires the mid-session device presence check.
        </TerminalText>

        <View accessibilityRole="radiogroup" style={styles.segmentedControl}>
          <MethodSegment
            active={verificationPath === 'wearable'}
            label="HEART-RATE DEVICE"
            onPress={() => selectVerificationPath('wearable')}
          />
          <MethodSegment
            active={verificationPath === 'gymQr'}
            label="PARTNER GYM QR"
            onPress={() => selectVerificationPath('gymQr')}
          />
        </View>

        {!preferenceReady ? (
          <HUDBorderBox style={styles.loadingSource} tone="muted">
            <TerminalText glow live="polite" tone="cyan" variant="label">
              LOADING SAVED VERIFICATION
            </TerminalText>
          </HUDBorderBox>
        ) : selectedSource && !sourcePickerExpanded ? (
          <HUDBorderBox glow style={styles.selectedSourceCard} tone="cyan">
            <View style={styles.selectionCopy}>
              <TerminalText tone="dim" variant="micro">
                YOUR DEFAULT
              </TerminalText>
              <TerminalText glow style={styles.selectionTitle} tone="cyan" variant="body">
                {selectedSource.name}
              </TerminalText>
              <TerminalText tone="muted" uppercase={false} variant="caption">
                {selectedSource.sub}
              </TerminalText>
            </View>
            <CompactTextButton
              label="CHANGE SOURCE"
              onPress={() => setSourcePickerExpanded(true)}
            />
          </HUDBorderBox>
        ) : verificationPath === 'wearable' ? (
          <View style={styles.methodContent}>
            {showAllDevices ? (
              <SearchField
                label="SEARCH DEVICES"
                onChangeText={setDeviceQuery}
                placeholder="GARMIN, POLAR, FITBIT..."
                value={deviceQuery}
              />
            ) : null}

            <View style={styles.list}>
              {visibleDevices.map((device) => (
                <SelectionRow
                  active={selectedDevice === device.key}
                  detail={device.sub}
                  key={device.key}
                  onPress={() => {
                    setSelectedDevice(device.key);
                    setSourcePickerExpanded(false);
                  }}
                  title={device.name}
                />
              ))}
            </View>

            {!showAllDevices ? (
              <CompactTextButton label="FIND ANOTHER DEVICE" onPress={() => setShowAllDevices(true)} />
            ) : null}
            {showAllDevices && visibleDevices.length === 0 ? (
              <TerminalText style={styles.emptyText} tone="dim" variant="body">
                NO DEVICES MATCH YOUR SEARCH.
              </TerminalText>
            ) : null}
            <TerminalText style={styles.privacyLine} tone="dim" variant="caption">
              Heart-rate data is used to verify the session. Phone camera frames stay local and are not stored.
            </TerminalText>
          </View>
        ) : (
          <View style={styles.methodContent}>
            <SearchField
              label="SEARCH PARTNER GYMS"
              onChangeText={setGymQuery}
              placeholder="GYM OR NEIGHBOURHOOD"
              value={gymQuery}
            />
            <View style={styles.list}>
              {visibleGyms.map((gym) => (
                <SelectionRow
                  active={selectedGym === gym.key}
                  detail={gym.sub}
                  key={gym.key}
                  onPress={() => {
                    setSelectedGym(gym.key);
                    setSourcePickerExpanded(false);
                  }}
                  title={gym.name}
                />
              ))}
            </View>
            {visibleGyms.length === 0 ? (
              <TerminalText style={styles.emptyText} tone="dim" variant="body">
                NO PARTNER GYMS MATCH YOUR SEARCH.
              </TerminalText>
            ) : null}
            <TerminalText style={styles.privacyLine} tone="dim" variant="caption">
              Scan the entry QR to start and the exit QR to end. QR camera frames are not stored.
            </TerminalText>
          </View>
        )}

        <View style={styles.actions}>
          <CyberButtonPrimary
            disabled={!canContinue}
            label={ctaLabel}
            onPress={continueWithVerificationMethod}
          />
        </View>
      </ScreenScrollView>
    </ScreenContainer>
  );
}

function MethodSegment({
  active,
  label,
  onPress
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={[styles.segment, active ? styles.segmentActive : null]}
    >
      <TerminalText glow={active} tone={active ? 'cyan' : 'muted'} variant="button">
        {label}
      </TerminalText>
    </Pressable>
  );
}

function SearchField({
  label,
  onChangeText,
  placeholder,
  value
}: {
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <HUDBorderBox style={styles.searchField} tone="muted">
      <TerminalText tone="dim" variant="micro">
        {label}
      </TerminalText>
      <TextInput
        accessibilityLabel={label}
        allowFontScaling
        maxFontSizeMultiplier={2}
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.dim}
        style={styles.searchInput}
        value={value}
      />
    </HUDBorderBox>
  );
}

function SelectionRow({
  active,
  detail,
  onPress,
  title
}: {
  active: boolean;
  detail: string;
  onPress: () => void;
  title: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={onPress}
    >
      <HUDBorderBox glow={active} style={styles.selectionRow} tone={active ? 'cyan' : 'muted'}>
        <View style={styles.selectionCopy}>
          <TerminalText
            glow={active}
            style={styles.selectionTitle}
            tone={active ? 'cyan' : 'text'}
            variant="body"
          >
            {title}
          </TerminalText>
          <TerminalText tone="muted" variant="caption">
            {detail}
          </TerminalText>
        </View>
        <TerminalText tone={active ? 'cyan' : 'dim'} variant="micro">
          {active ? 'SELECTED' : 'SELECT'}
        </TerminalText>
      </HUDBorderBox>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background
  },
  title: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.titleXl,
    lineHeight: 31,
    textAlign: 'center'
  },
  body: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
  segmentedControl: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.borderCyanSoft,
    borderRadius: radii.sm,
    backgroundColor: colors.panel
  },
  segment: {
    minHeight: 48,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: 6
  },
  segmentActive: {
    backgroundColor: colors.surfaceCyanActive
  },
  methodContent: {
    marginTop: spacing.lg
  },
  loadingSource: {
    alignItems: 'center',
    marginTop: spacing.lg,
    padding: spacing.lg
  },
  selectedSourceCard: {
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.lg
  },
  searchField: {
    marginBottom: spacing.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md
  },
  searchInput: {
    minHeight: 38,
    color: colors.text,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.control
  },
  list: {
    gap: spacing.sm
  },
  selectionRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg
  },
  selectionCopy: {
    flex: 1,
    gap: spacing.xs
  },
  selectionTitle: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.cardTitle,
    lineHeight: 22
  },
  emptyText: {
    paddingVertical: spacing.xl,
    textAlign: 'center'
  },
  privacyLine: {
    marginTop: spacing.md,
    textAlign: 'center'
  },
  actions: {
    marginTop: spacing.xl
  }
});
