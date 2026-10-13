import { redirect } from "next/navigation";
export default function SignInAlias() { redirect("/admin/login?return_to=%2Fdashboard"); }