import { USER_ROLE } from "@/lib/ui-constants";

export type UserRole = typeof USER_ROLE.TEACHER | typeof USER_ROLE.STUDENT;

const USER_ROLE_STORAGE_KEY = "kit-contest:user-role";

export function isUserRole(value: unknown): value is UserRole {
  return value === USER_ROLE.TEACHER || value === USER_ROLE.STUDENT;
}

export function normalizeUserRole(value: string | null | undefined): UserRole | null {
  return isUserRole(value) ? value : null;
}

export function getStoredUserRole(): UserRole | null {
  if (typeof window === "undefined") {
    return null;
  }

  return normalizeUserRole(window.localStorage.getItem(USER_ROLE_STORAGE_KEY));
}

export function setStoredUserRole(role: UserRole) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(USER_ROLE_STORAGE_KEY, role);
}
