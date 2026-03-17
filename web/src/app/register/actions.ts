"use server";

import { z } from "zod";

import { upsertWaitlistSignup } from "@/db/control-plane";

type WaitlistFieldErrors = Partial<
  Record<
    "email" | "heardAboutOtto" | "name" | "usagePreference" | "useCase",
    string[]
  >
>;

export type WaitlistFormState = {
  fieldErrors: WaitlistFieldErrors;
  message: string | null;
  status: "error" | "idle" | "success";
};

const waitlistSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Enter a valid email address.")
    .transform((value) => value.toLowerCase()),
  heardAboutOtto: z
    .string()
    .trim()
    .max(500, "Keep this under 500 characters.")
    .transform((value) => (value.length > 0 ? value : null)),
  name: z.string().trim().min(1, "Name is required.").max(120),
  usagePreference: z.enum(["alone", "team"], {
    error: () => ({
      message: "Choose whether you want to use Otto alone or with a team.",
    }),
  }),
  useCase: z
    .string()
    .trim()
    .max(2000, "Keep this under 2000 characters.")
    .transform((value) => (value.length > 0 ? value : null)),
});

function getErrorLogDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  return {
    value: error,
  };
}

export async function submitWaitlistSignupAction(
  _previousState: WaitlistFormState,
  formData: FormData,
): Promise<WaitlistFormState> {
  const parsed = waitlistSchema.safeParse({
    email: formData.get("email")?.toString() ?? "",
    heardAboutOtto: formData.get("heardAboutOtto")?.toString() ?? "",
    name: formData.get("name")?.toString() ?? "",
    usagePreference: formData.get("usagePreference")?.toString() ?? "",
    useCase: formData.get("useCase")?.toString() ?? "",
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "Check the highlighted fields and try again.",
      status: "error",
    };
  }

  console.log("[waitlist] submit payload", parsed.data);

  try {
    await upsertWaitlistSignup(parsed.data);

    return {
      fieldErrors: {},
      message:
        "You are on the list. We will reach out when Otto is ready for your setup.",
      status: "success",
    };
  } catch (error) {
    console.error("[waitlist] failed to save signup", {
      email: parsed.data.email,
      name: parsed.data.name,
      usagePreference: parsed.data.usagePreference,
      ...getErrorLogDetails(error),
    });

    return {
      fieldErrors: {},
      message: "We could not save your request. Try again.",
      status: "error",
    };
  }
}
