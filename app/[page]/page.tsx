import { PublicPage, publicPages } from '../ui/public';
import { notFound } from 'next/navigation';
export default async function Page({params}:{params:Promise<{page:string}>}){const {page}=await params;if(!publicPages[page])notFound();return <PublicPage slug={page}/>;}
