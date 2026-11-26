import { PODS_UI_ENABLED } from "@/lib/pods/flags";

/** When the Pods UI flag is off, routes send members to Events. */
export function podsUiDisabledRedirect(): "/events" | null {
  return PODS_UI_ENABLED ? null : "/events";
}

export function canCreatePods(roles: {
  isStaff?: boolean | undefined;
  isFacilitator?: boolean | undefined;
}): boolean {
  return Boolean(roles.isStaff || roles.isFacilitator);
}
