import { requireChatGPTUser } from '../chatgpt-auth';
import CareerWorkspace from '../ui/workspace';
export const dynamic='force-dynamic';
export default async function Dashboard(){const user=await requireChatGPTUser('/dashboard'); return <CareerWorkspace displayName={user.displayName}/>;}
