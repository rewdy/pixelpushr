import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { requestJson, resetSessionState } from "../helpers/api";

/** Ends the current server session and clears account data from the browser. */
export const useSignOut = () => {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  return useMutation({
    mutationFn: () => requestJson("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      resetSessionState();
      queryClient.clear();
      navigate("/login", { replace: true });
    },
  });
};
