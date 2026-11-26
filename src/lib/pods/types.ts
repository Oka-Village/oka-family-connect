export type PodStatus = "draft" | "pending_approval" | "published" | "unpublished";

export type PodEncounterInput = {
  topic: string;
  startsAt: string;
  endsAt: string | null;
};

export type PodRow = {
  id: string;
  title: string;
  description: string | null;
  photo_url: string | null;
  format: string;
  timezone: string;
  meet_url: string | null;
  host_id: string;
  created_by: string;
  status: PodStatus;
  capacity_members: number;
  created_at: string;
  updated_at: string;
};

export type PodEncounterRow = {
  id: string;
  pod_id: string;
  session_index: number;
  title: string;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
};

export type PodListItem = PodRow & {
  host_name: string | null;
  host_avatar: string | null;
  paid_count: number;
  encounters: Array<{
    session_index: number;
    starts_at: string;
    weekday: string;
    month: string;
    day: number;
  }>;
};
