/** Presentation check; database owner policies remain the authorization boundary. */
export function canDeleteListing(userId: string | null | undefined, ownerId: string): boolean {
  return Boolean(userId && userId === ownerId);
}

export type DeleteClient = {
  from: (table: "skills" | "houses") => {
    delete: () => {
      eq: (column: "id", value: string) => {
        eq: (column: "owner_id", value: string) => {
          select: (columns: "id") => PromiseLike<{ data: { id: string }[] | null; error: { code?: string } | null }>;
        };
      };
    };
  };
};

export async function deleteOwnListing(client: DeleteClient, table: "skills" | "houses", id: string, ownerId: string, userId: string | null | undefined) {
  if (!userId || !canDeleteListing(userId, ownerId)) throw new Error("Only the creator can delete this listing.");
  const result = await client.from(table).delete().eq("id", id).eq("owner_id", userId).select("id");
  if (result.error || !result.data?.some((row) => row.id === id)) throw new Error("Your listing wasn't deleted. Please try again.");
}