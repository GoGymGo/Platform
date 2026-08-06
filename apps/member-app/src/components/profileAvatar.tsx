import {
  Image,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle
} from 'react-native';

import { TerminalText } from '@/components/cyber';
import { colors, fontFamilies } from '@/constants/theme';

type ProfileAvatarProps = {
  imageUri: string | null;
  initials?: string;
  showStatus?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function ProfileAvatar({
  imageUri,
  initials = 'GG',
  showStatus = false,
  size = 84,
  style
}: ProfileAvatarProps) {
  const borderRadius = Math.round(size * 0.28);

  return (
    <View style={[styles.wrapper, { height: size, width: size }, style]}>
      <View style={[styles.avatar, { borderRadius }]}>
        {imageUri ? (
          <Image
            accessibilityLabel="Profile image"
            resizeMode="cover"
            source={{ uri: imageUri }}
            style={styles.image}
          />
        ) : (
          <TerminalText style={styles.initials} tone="cyan" variant="value">
            {initials}
          </TerminalText>
        )}
      </View>
      {showStatus ? <View style={styles.statusDot} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative'
  },
  avatar: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderCyanStrong,
    backgroundColor: colors.surfaceCyanProgress
  },
  image: {
    width: '100%',
    height: '100%'
  },
  initials: {
    fontFamily: fontFamilies.display
  },
  statusDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 11,
    height: 11,
    borderWidth: 2,
    borderColor: colors.background,
    borderRadius: 6,
    backgroundColor: colors.green
  }
});
