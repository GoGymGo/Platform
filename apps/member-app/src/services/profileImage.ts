import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export type ProfileImagePickResult =
  | { status: 'cancelled' }
  | { status: 'denied' }
  | { status: 'error' }
  | { status: 'selected'; uri: string };

export async function pickProfileImage(): Promise<ProfileImagePickResult> {
  try {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        return { status: 'denied' };
      }
    }

    const selection = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ['images'],
      quality: 0.85,
      selectionLimit: 1
    });

    if (selection.canceled || !selection.assets[0]) {
      return { status: 'cancelled' };
    }

    const optimized = await manipulateAsync(
      selection.assets[0].uri,
      [{ resize: { width: 640 } }],
      {
        base64: true,
        compress: 0.74,
        format: SaveFormat.JPEG
      }
    );

    if (!optimized.base64) {
      return { status: 'error' };
    }

    return {
      status: 'selected',
      uri: `data:image/jpeg;base64,${optimized.base64}`
    };
  } catch {
    return { status: 'error' };
  }
}
