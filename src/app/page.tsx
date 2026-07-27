import { redirect } from "next/navigation";
import { verifySession, roleHome } from "@/lib/auth/dal";

export default async function Home() {
  const profile = await verifySession();
  redirect(roleHome(profile.role));
}
