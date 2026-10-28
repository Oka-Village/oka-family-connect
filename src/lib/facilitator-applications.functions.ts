import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const answer = z.union([z.string().max(5000), z.array(z.string().max(200)).max(20)]);

const ApplicationInput = z.object({
  answers: z.record(z.string().max(60), answer).refine((a) => Object.keys(a).length <= 40, "Too many answers"),
  acceptanceName: z.string().trim().min(1).max(200),
  newsOptIn: z.boolean(),
});

/** Public: applicants may be signed out. Stores a non-binding application for admin review only. */
export const submitFacilitatorApplication = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ApplicationInput.parse(input))
  .handler(async ({ data }) => {
    const str = (k: string) => (typeof data.answers[k] === "string" ? (data.answers[k] as string).trim() : "");
    const legal_name = str("legalName");
    const email = str("email");
    if (!legal_name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Please add your full name and a valid email before submitting.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("facilitator_applications").insert({
      legal_name: legal_name.slice(0, 200),
      public_name: str("publicName").slice(0, 200) || null,
      email: email.slice(0, 320),
      answers: data.answers,
      acceptance_name: data.acceptanceName,
      news_opt_in: data.newsOptIn,
    });
    if (error) throw new Error("We couldn’t send your application. Please try again.");
    return { ok: true };
  });
