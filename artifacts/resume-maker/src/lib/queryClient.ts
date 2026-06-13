import { QueryClient, MutationCache } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
  mutationCache: new MutationCache({
    onSuccess: (data, variables, context, mutation) => {
      const mutationKey = mutation.options.mutationKey;
      if (Array.isArray(mutationKey) && mutationKey[0] === "updateResume") {
        const payload = variables as { id?: number };
        if (payload?.id) {
          const id = payload.id;
          queryClient.setQueryData([`/api/resumes/${id}`], data);
          void queryClient.invalidateQueries({
            queryKey: [`/api/resumes`],
          });
        }
      }
    },
  }),
});

