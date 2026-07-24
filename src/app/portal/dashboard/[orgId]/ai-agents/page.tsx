import { redirect } from "next/navigation";

export default function AiAgentsIndex({ params }: { params: { orgId: string } }) {
  redirect(`/portal/dashboard/${params.orgId}/ai-agents/jarvis`);
}
