import { requireCareerUser } from "../career-auth";
import CareerWorkspace from "../ui/workspace";
export const dynamic = "force-dynamic";
export default async function Dashboard() {
  const user = await requireCareerUser("/dashboard");
  return <CareerWorkspace displayName={user.displayName} />;
}