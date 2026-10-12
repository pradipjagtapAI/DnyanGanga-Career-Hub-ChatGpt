import { requireChatGPTUser } from "../chatgpt-auth";
import { AdminPanel } from "../ui/admin";
export const dynamic = "force-dynamic";
export default async function Admin() {
  await requireChatGPTUser("/admin");
  return <AdminPanel />;
}
