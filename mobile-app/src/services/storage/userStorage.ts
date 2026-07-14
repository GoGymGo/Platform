import AsyncStorage from '@react-native-async-storage/async-storage';

const userStorageNamespace = '@gogymgo/users';

export type UserStorage = {
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
  setItem: (key: string, value: string) => Promise<void>;
};

export function buildUserStorageKey(userId: string, key: string) {
  const normalizedUserId = userId.trim();
  const normalizedKey = key
    .trim()
    .replace(/^@gogymgo\//, '')
    .replace(/^gogymgo:/, '')
    .replace(/^\/+/, '');

  if (!normalizedUserId) {
    throw new Error('A user ID is required for user-scoped storage.');
  }

  if (!normalizedKey) {
    throw new Error('A storage key is required for user-scoped storage.');
  }

  return `${userStorageNamespace}/${encodeURIComponent(normalizedUserId)}/${normalizedKey}`;
}

export function createUserStorage(userId: string): UserStorage {
  return {
    getItem: (key) => AsyncStorage.getItem(buildUserStorageKey(userId, key)),
    removeItem: (key) => AsyncStorage.removeItem(buildUserStorageKey(userId, key)),
    setItem: (key, value) => AsyncStorage.setItem(buildUserStorageKey(userId, key), value)
  };
}
