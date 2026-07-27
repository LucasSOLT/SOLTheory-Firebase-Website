import { redirect } from "next/navigation";

export default async function AiAgentsIndex({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  redirect(`/portal/dashboard/${orgId}/ai-agents/jarvis`);
}
