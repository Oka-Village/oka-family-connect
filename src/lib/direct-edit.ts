/** Presentation gate only; every save remains protected by existing database policies. */
export function canEditListing(userId: string | null | undefined, ownerId: string, isAdmin: boolean | undefined): boolean {
  return Boolean(userId && (userId === ownerId || isAdmin));
}