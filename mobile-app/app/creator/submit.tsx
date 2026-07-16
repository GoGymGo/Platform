import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthTextField } from '@/components/auth';
import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  ScreenScrollView,
  TerminalText
} from '@/components/cyber';
import { colors, fontFamilies, radii, spacing } from '@/constants/theme';
import { useSubmitCreatorVideo } from '@/data/appDataHooks';
import { useSponsorCampaign } from '@/state/sponsorCampaign';

const creatorRightsTerms = [
  'I own or control the video, music, likeness, location and other rights needed to submit this workout.',
  'I grant GoGymGo a non-exclusive, worldwide, royalty-free license to host, reproduce, edit, crop, reframe, caption, translate and format the submission for GoGymGo products and promotion.',
  'That license includes adding GoGymGo or sponsor brand placement and creating clearly reviewed AI-assisted reframes, alternate camera angles or format adaptations for supported screens.',
  'GoGymGo may moderate, decline, pause or remove a video for safety, rights, disclosure or brand-fit concerns. I retain ownership and can contact GoGymGo about withdrawal and takedown.',
  'A creator video is workout guidance only. Users still need a separate verified GoGymGo session to earn competition credit.'
] as const;

export default function CreatorVideoSubmissionScreen() {
  const router = useRouter();
  const { campaign } = useSponsorCampaign();
  const submitCreatorVideo = useSubmitCreatorVideo();
  const [duration, setDuration] = useState('30');
  const [notes, setNotes] = useState('');
  const [rightsAccepted, setRightsAccepted] = useState(false);
  const [sponsorDisclosure, setSponsorDisclosure] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [syntheticMediaDisclosed, setSyntheticMediaDisclosed] = useState(false);
  const [title, setTitle] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [workoutStyle, setWorkoutStyle] = useState('');

  const submit = async () => {
    const durationMinutes = Number.parseInt(duration, 10);
    if (title.trim().length < 2) return setValidationError('Enter a workout title.');
    if (!/^https?:\/\//i.test(videoUrl.trim())) return setValidationError('Enter a hosted HTTPS video URL.');
    if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 180) {
      return setValidationError('Choose a duration between 5 and 180 minutes.');
    }
    if (workoutStyle.trim().length < 2) return setValidationError('Enter the workout style.');
    if (!rightsAccepted) return setValidationError('Review and accept the creator video rights terms.');

    setValidationError(null);
    try {
      await submitCreatorVideo.mutateAsync({
        durationMinutes,
        notes: notes.trim() || undefined,
        regionCode: campaign.region.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        rightsAccepted: true,
        sponsorDisclosure: sponsorDisclosure.trim() || undefined,
        syntheticMediaDisclosed,
        title: title.trim(),
        videoUrl: videoUrl.trim(),
        workoutStyle: workoutStyle.trim()
      });
      setSubmitted(true);
    } catch {
      setValidationError('The creator video could not be submitted. Check your connection and try again.');
    }
  };

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TerminalText glow tone="pink" variant="label">CREATOR STUDIO // {campaign.region}</TerminalText>
          <TerminalText glow style={styles.title} tone="pink" variant="title">SUBMIT A WORKOUT VIDEO</TerminalText>
          <TerminalText style={styles.body} tone="muted" uppercase={false} variant="body">
            Submit a hosted follow-along video for catalog review. This is a creator-content submission, not a verified workout.
          </TerminalText>
        </View>

        <HUDBorderBox style={styles.form} tone="muted">
          <AuthTextField label="WORKOUT TITLE" maxLength={100} onChangeText={setTitle} placeholder="30-MINUTE FULL BODY HIIT" value={title} />
          <AuthTextField autoCapitalize="none" keyboardType="url" label="HOSTED VIDEO URL" onChangeText={setVideoUrl} placeholder="https://youtube.com/watch?v=..." value={videoUrl} />
          <View style={styles.twoColumns}>
            <View style={styles.flexField}>
              <AuthTextField keyboardType="number-pad" label="MINUTES" maxLength={3} onChangeText={setDuration} value={duration} />
            </View>
            <View style={styles.flexField}>
              <AuthTextField label="WORKOUT STYLE" maxLength={80} onChangeText={setWorkoutStyle} placeholder="HIIT" value={workoutStyle} />
            </View>
          </View>
          <AuthTextField label="SPONSOR / PRODUCT DISCLOSURE // OPTIONAL" maxLength={500} multiline onChangeText={setSponsorDisclosure} placeholder="List paid placements, gifted products or affiliate relationships." value={sponsorDisclosure} />
          <AuthTextField label="REVIEW NOTES // OPTIONAL" maxLength={1000} multiline onChangeText={setNotes} placeholder="Equipment, safety modifications, audience and anything reviewers should know." value={notes} />

          <ToggleRow
            checked={syntheticMediaDisclosed}
            label="THIS VIDEO INCLUDES AI-GENERATED OR MATERIALLY AI-ALTERED VISUALS / AUDIO"
            onPress={() => setSyntheticMediaDisclosed((value) => !value)}
          />
        </HUDBorderBox>

        <HUDBorderBox glow={rightsAccepted} style={styles.rightsCard} tone={rightsAccepted ? 'pink' : 'amber'}>
          <TerminalText glow tone={rightsAccepted ? 'pink' : 'amber'} variant="label">CREATOR VIDEO RIGHTS + ADAPTATION TERMS</TerminalText>
          {creatorRightsTerms.map((term, index) => (
            <View key={term} style={styles.termRow}>
              <TerminalText tone="cyan" variant="micro">{String(index + 1).padStart(2, '0')}</TerminalText>
              <TerminalText style={styles.termText} tone="muted" uppercase={false} variant="caption">{term}</TerminalText>
            </View>
          ))}
          <ToggleRow
            checked={rightsAccepted}
            label="I HAVE READ, UNDERSTAND AND ACCEPT THESE SUBMISSION TERMS"
            onPress={() => setRightsAccepted((value) => !value)}
          />
        </HUDBorderBox>

        {validationError ? (
          <HUDBorderBox style={styles.notice} tone="red">
            <TerminalText live="assertive" tone="red" uppercase={false} variant="body">{validationError}</TerminalText>
          </HUDBorderBox>
        ) : null}
        {submitted ? (
          <HUDBorderBox style={styles.notice} tone="green">
            <TerminalText live="polite" glow tone="green" variant="label">VIDEO SUBMITTED FOR REVIEW</TerminalText>
            <TerminalText tone="muted" uppercase={false} variant="body">Your rights receipt and disclosure were recorded with this submission.</TerminalText>
          </HUDBorderBox>
        ) : (
          <CyberButtonPrimary disabled={submitCreatorVideo.isPending} label={submitCreatorVideo.isPending ? 'SUBMITTING...' : 'SUBMIT VIDEO FOR REVIEW ->'} onPress={() => void submit()} tone="pink" />
        )}
        <CyberButtonOutline label="BACK TO CREATOR CATALOG" onPress={() => router.replace('/workouts')} />
      </ScreenScrollView>
    </ScreenContainer>
  );
}

function ToggleRow({ checked, label, onPress }: { checked: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={({ pressed }) => [styles.toggleRow, checked ? styles.toggleRowChecked : null, pressed ? styles.pressed : null]}
    >
      <View style={[styles.checkbox, checked ? styles.checkboxChecked : null]}>
        <TerminalText tone={checked ? 'text' : 'dim'} variant="micro">{checked ? 'OK' : ''}</TerminalText>
      </View>
      <TerminalText style={styles.toggleLabel} tone={checked ? 'text' : 'muted'} uppercase={false} variant="caption">{label}</TerminalText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: spacing.lg, paddingHorizontal: spacing.screenX, paddingTop: spacing.sm, paddingBottom: 132, backgroundColor: colors.background },
  header: { gap: spacing.sm },
  title: { fontFamily: fontFamilies.display },
  body: { fontFamily: fontFamilies.body },
  form: { gap: spacing.md, padding: spacing.lg },
  twoColumns: { flexDirection: 'row', gap: spacing.sm },
  flexField: { minWidth: 0, flex: 1 },
  rightsCard: { gap: spacing.md, padding: spacing.lg },
  termRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  termText: { minWidth: 0, flex: 1, fontFamily: fontFamilies.body },
  toggleRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderWidth: 1, borderColor: colors.borderMuted, borderRadius: radii.sm, backgroundColor: colors.panelAlpha45 },
  toggleRowChecked: { borderColor: colors.borderPinkGlow, backgroundColor: colors.surfacePinkSoft },
  checkbox: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderMuted, borderRadius: 5 },
  checkboxChecked: { borderColor: colors.pink, backgroundColor: colors.surfacePinkActive },
  toggleLabel: { minWidth: 0, flex: 1, fontFamily: fontFamilies.body },
  notice: { gap: spacing.sm, padding: spacing.md },
  pressed: { opacity: 0.74 }
});
