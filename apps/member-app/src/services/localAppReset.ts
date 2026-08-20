import AsyncStorage from '@react-native-async-storage/async-storage';

type BrowserResetEnvironment = {
  caches?: {
    delete: (key: string) => Promise<boolean>;
    keys: () => Promise<string[]>;
  };
  document?: { cookie: string };
  localStorage?: BrowserKeyValueStorage;
  sessionStorage?: BrowserKeyValueStorage;
};

type BrowserKeyValueStorage = {
  key: (index: number) => string | null;
  length: number;
  removeItem: (key: string) => void;
};

type LocalAppStorage = {
  getAllKeys: () => Promise<readonly string[]>;
  multiRemove: (keys: readonly string[]) => Promise<void>;
};

type LocalAppResetDependencies = {
  browser?: BrowserResetEnvironment;
  storage?: LocalAppStorage;
};

const ownedPrefixes = ['@gogymgo/', 'gogymgo:', 'gogymgo.', 'firebase:'];
const ownedCookieNames = new Set(['__session', 'gogymgo-session']);

export async function clearLocalAppData(
  dependencies: LocalAppResetDependencies = {}
) {
  const storage = dependencies.storage ?? AsyncStorage;
  const ownedStorageKeys = (await storage.getAllKeys()).filter(isGoGymGoKey);
  if (ownedStorageKeys.length > 0) {
    await storage.multiRemove(ownedStorageKeys);
  }

  const browser =
    dependencies.browser ?? (globalThis as unknown as BrowserResetEnvironment);
  clearOwnedBrowserStorage(browser.localStorage);
  clearOwnedBrowserStorage(browser.sessionStorage);

  if (browser.document) {
    for (const cookie of browser.document.cookie.split(';')) {
      const name = cookie.split('=')[0]?.trim();
      if (name && isGoGymGoCookie(name)) {
        browser.document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
      }
    }
  }

  if (browser.caches) {
    const cacheKeys = await browser.caches.keys();
    for (const key of cacheKeys.filter(isGoGymGoKey)) {
      await browser.caches.delete(key);
    }
  }
}

function clearOwnedBrowserStorage(storage: BrowserKeyValueStorage | undefined) {
  if (!storage) return;
  const keys = Array.from({ length: storage.length }, (_value, index) =>
    storage.key(index)
  ).filter((key): key is string => Boolean(key && isGoGymGoKey(key)));
  for (const key of keys) storage.removeItem(key);
}

function isGoGymGoCookie(name: string) {
  return ownedCookieNames.has(name) || isGoGymGoKey(name);
}

function isGoGymGoKey(key: string) {
  return ownedPrefixes.some((prefix) => key.startsWith(prefix));
}
