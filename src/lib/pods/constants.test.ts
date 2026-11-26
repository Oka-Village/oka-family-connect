import { describe, expect, it } from "vitest";

import { podsUiDisabledRedirect } from "@/lib/pods/access";
import {
  POD_COMMITMENTS,
  POD_ENCOUNTER_COUNT,
  POD_MEMBER_SEATS,
  POD_PAY_COPY,
  POD_REGISTRATION_CONTACT_EMAIL,
  POD_REGISTRATION_SOON_MESSAGE,
} from "@/lib/pods/constants";
import { PODS_UI_ENABLED } from "@/lib/pods/flags";
import { MOCK_PODS } from "@/lib/pods/mock-data";

describe("pods constants", () => {
  it("keeps three member seats in one constant", () => {
    expect(POD_MEMBER_SEATS).toBe(3);
    expect(POD_ENCOUNTER_COUNT).toBe(3);
  });

  it("keeps five commitment texts", () => {
    expect(POD_COMMITMENTS).toHaveLength(5);
    expect(POD_COMMITMENTS[0]?.title).toBe("All three sessions");
  });

  it("does not embed a dollar amount in pay copy", () => {
    expect(POD_PAY_COPY).toContain("You'll see the amount before you pay");
    expect(POD_PAY_COPY).not.toMatch(/\$\d/);
  });

  it("sends pod questions to Liran while registration is closed", () => {
    expect(POD_REGISTRATION_CONTACT_EMAIL).toBe("liran@okavillage.com");
    expect(POD_REGISTRATION_SOON_MESSAGE).toContain(POD_REGISTRATION_CONTACT_EMAIL);
  });

  it("ships three mock pods with three encounters each", () => {
    expect(MOCK_PODS).toHaveLength(3);
    for (const pod of MOCK_PODS) {
      expect(pod.encounters).toHaveLength(POD_ENCOUNTER_COUNT);
      expect(pod.members.length).toBeLessThanOrEqual(POD_MEMBER_SEATS);
    }
  });
});

describe("pods flags", () => {
  it("enables UI unless VITE_PODS_UI is false", () => {
    const expected = import.meta.env["VITE_PODS_UI"] !== "false";
    expect(PODS_UI_ENABLED).toBe(expected);
  });

  it("redirects /pods to /events when the UI flag is off", () => {
    expect(podsUiDisabledRedirect()).toBe(PODS_UI_ENABLED ? null : "/events");
    // Production builds set import.meta.env.DEV to false, so without VITE_PODS_UI
    // PODS_UI_ENABLED is false and beforeLoad redirects to /events.
  });
});
