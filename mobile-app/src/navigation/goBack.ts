import type { Href } from 'expo-router';

type BackNavigationRouter = {
  back: () => void;
  canGoBack: () => boolean;
  replace: (href: Href) => void;
};

export function goBackOrReplace(
  router: BackNavigationRouter,
  fallback: Href
) {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(fallback);
}
