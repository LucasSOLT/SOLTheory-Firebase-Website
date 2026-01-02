"use server";

import { z } from "zod";

const subscribeSchema = z.object({
  email: z.string().email(),
});

export async function subscribeUser(data: { email: string }) {
  const parsed = subscribeSchema.safeParse(data);

  if (!parsed.success) {
    return { success: false, error: "Invalid email address." };
  }

  const { email } = parsed.data;

  // In a real application, you would save the email to a database
  // or add it to a mailing list service (e.g., Mailchimp, ConvertKit).
  console.log(`New subscription from: ${email}`);

  // Simulate a network delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  return { success: true };
}
