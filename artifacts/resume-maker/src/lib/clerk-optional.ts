import { useUser, useAuth, useClerk } from "@clerk/react";

/**
 * E2E mode runs without Clerk secrets, so `App` mounts the router without a
 * `<ClerkProvider>`. Clerk's hooks throw outside that provider — which crashed
 * the pricing page to a blank screen instead of rendering it — so public pages
 * that only need to know "is anyone signed in?" go through these wrappers.
 *
 * `VITE_E2E` is a build-time constant that Vite inlines, so the branch is
 * eliminated in production builds and these compile down to the real hooks.
 * That also keeps hook order stable for the lifetime of the app, which is why
 * the conditional call below is safe.
 */
const isE2E = import.meta.env.VITE_E2E === "true";

/** Clerk's `useUser`, reporting a signed-out user when Clerk is absent. */
export function useOptionalUser(): ReturnType<typeof useUser> {
  if (isE2E) {
    return { isLoaded: true, isSignedIn: false, user: null };
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useUser();
}

/** Clerk's `useAuth`, reporting signed-out and yielding no token when Clerk is absent. */
export function useOptionalAuth(): {
  getToken: () => Promise<string | null>;
  isSignedIn: boolean;
  isLoaded: boolean;
} {
  if (isE2E) {
    return { getToken: async () => null, isSignedIn: false, isLoaded: true };
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { getToken, isSignedIn, isLoaded } = useAuth();
  return { getToken: () => getToken(), isSignedIn: !!isSignedIn, isLoaded };
}

/** Clerk's `useClerk`, with a no-op `signOut` when Clerk is absent. */
export function useOptionalClerk(): { signOut: () => Promise<void> } {
  if (isE2E) {
    return { signOut: async () => {} };
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { signOut } = useClerk();
  return { signOut: () => signOut() };
}
