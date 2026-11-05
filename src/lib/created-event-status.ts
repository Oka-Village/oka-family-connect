/** What the creator sees for an event they proposed. */
export function createdEventStatusLabel(status: string): string {
  switch (status) {
    case "pending_approval":
      return "Awaiting review";
    case "published":
      return "Approved";
    case "rejected":
      return "Not approved";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}
