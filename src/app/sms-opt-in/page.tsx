import { redirect } from "next/navigation";
export default function SmsOptInRedirect() {
  redirect("/sms-notifications");
}
