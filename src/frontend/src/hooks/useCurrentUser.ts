import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/services/apiClient";
import { useAuth } from "@/state/auth";
import type { UserOut } from "@/types/api";

export function useCurrentUser() {
  const { token } = useAuth();
  return useQuery<UserOut>({
    queryKey: ["currentUser"],
    queryFn: () => apiRequest<UserOut>("/auth/me", { token: token ?? undefined }),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });
}
