import AsyncStorage from '@react-native-async-storage/async-storage';

type BrowserResetEnvironment = {
  caches?: {
    delete: (key: string) => Promise<boolean>;
    keys: () => Promise<string[]>;
  };
  document?: { cookie: string };
  localStorage?: { clear: () => void };
  sessionStorage?: { clear: () => void };
};

type LocalAppResetDependencies = {
  browser?: BrowserResetEnvironment;
  storage?: { clear: () => Promise<void> };
};

export async function clearLocalAppData(
  dependencies: LocalAppResetDependencies = {}
) {
  await (dependencies.storage ?? AsyncStorage).clear();

  const browser =
    dependencies.browser ?? (globalThis as unknown as BrowserResetEnvironment);
  browser.localStorage?.clear();
  browser.sessionStorage?.clear();

  if (browser.document) {
    for (const cookie of browser.document.cookie.split(';')) {
      const name = cookie.split('=')[0]?.trim();
      if (name) {
        browser.document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
      }
    }
  }

  if (browser.caches) {
    const cacheKeys = await browser.caches.keys();
    await Promise.all(cacheKeys.map((key) => browser.caches!.delete(key)));
  }
}
