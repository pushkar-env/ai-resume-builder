import { useAuth, useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { getListResumesQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

type DevUpgradeResult = {
  emailQueued?: boolean;
};

export function useDevBillingUpgrade() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const runDevUpgrade = async (onSuccess?: () => void): Promise<boolean> => {
    try {
      const token = await getToken();
      if (!token) {
        toast({
          title: "Sign in required",
          description: "Sign in to use the dev billing bypass.",
          variant: "destructive",
        });
        return false;
      }

      const apiUrl = import.meta.env.VITE_API_URL || "/api";
      const res = await fetch(`${apiUrl}/payments/dev-upgrade`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Failed to upgrade");
      }

      const payload = (await res.json()) as DevUpgradeResult;
      const gt = getToken as (opts?: {
        skipCache?: boolean;
      }) => Promise<unknown>;
      await gt({ skipCache: true }).catch(() => {});
      await user?.reload();

      await queryClient.invalidateQueries({
        queryKey: ["billing-page-subscription"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["subscription-details"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["membership"],
      });
      await queryClient.invalidateQueries({
        queryKey: getListResumesQueryKey(),
      });

      if (payload.emailQueued) {
        toast({
          title: "Welcome email queued",
          description: "Check your inbox for the Pro welcome message.",
        });
      }

      onSuccess?.();
      return true;
    } catch (e: unknown) {
      console.error(e);
      toast({
        title: "Dev upgrade failed",
        description: e instanceof Error ? e.message : "Failed to upgrade",
        variant: "destructive",
      });
      return false;
    }
  };

  return { runDevUpgrade };
}
