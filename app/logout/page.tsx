import { getCareerUser } from "../career-auth";
import { AccountPage } from "../account-page";
import { AdminLogout } from "../ui/admin";
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await getCareerUser();
  if (user && !user.userId.startsWith("candidate:")) return <AdminLogout />;
  return <AccountPage mode="logout" path="/logout" />;
}
