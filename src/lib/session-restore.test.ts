import { afterEach, describe, expect, it, vi } from "vitest";
import { recoverSession, restoreSession, sessionStorageKey } from "./session-restore";

afterEach(() => vi.useRealTimers());

describe("session restore recovery", () => {
  it("keeps a successful session and does not run recovery", async () => {
    const user = { id: "existing-member" };
    expect(await restoreSession(async () => user)).toBe(user);
  });

  it("returns failed restores to sign-in after clearing stale state", async () => {
    const order: string[] = [];
    await restoreSession(async () => { throw new Error("Invalid refresh token"); }).catch(() =>
      recoverSession(async () => { order.push("clear"); }, (path) => order.push(path)),
    );
    expect(order).toEqual(["clear", "/"]);
  });

  it("exits a stalled restore after exactly six seconds and ignores a late result", async () => {
    vi.useFakeTimers();
    const clear = vi.fn(async () => undefined);
    const navigate = vi.fn();
    let resolveRead: ((value: string) => void) | undefined;
    const result = restoreSession(() => new Promise<string>((resolve) => { resolveRead = resolve; }))
      .catch(() => recoverSession(clear, navigate));
    await vi.advanceTimersByTimeAsync(5_999);
    expect(navigate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await result;
    expect(clear).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledExactlyOnceWith("/");
    resolveRead?.("late-user");
    await Promise.resolve();
    expect(navigate).toHaveBeenCalledOnce();
  });

  it("still reaches sign-in when storage cleanup rejects", async () => {
    const navigate = vi.fn();
    await recoverSession(async () => { throw new Error("Storage blocked"); }, navigate);
    expect(navigate).toHaveBeenCalledExactlyOnceWith("/");
  });

  it("does not wait forever for broker cleanup", async () => {
    vi.useFakeTimers();
    const navigate = vi.fn();
    const result = recoverSession(() => new Promise(() => {}), navigate);
    await vi.advanceTimersByTimeAsync(2_500);
    await result;
    expect(navigate).toHaveBeenCalledExactlyOnceWith("/");
  });

  it("targets only this client's session storage key", () => {
    expect(sessionStorageKey("https://project.example.com")).toBe("sb-project-auth-token");
  });
});