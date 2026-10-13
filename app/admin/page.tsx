import { AdminPanel } from "../ui/admin";
export const dynamic = "force-dynamic";
// Operational data is returned only by the server-authorized admin API.
export default function Admin() { return <AdminPanel />; }