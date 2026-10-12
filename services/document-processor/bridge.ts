import { DOCUMENT_MAX_BYTES, DOCX_MIME, readBytesBounded } from "../../lib/career-documents";
type Env = { DOCUMENT_PROCESSOR_ORIGIN?:string; DOCUMENT_PROCESSOR_TOKEN?:string };
/** Private service-binding worker; it has no workers.dev endpoint or public route. */
const privateDocumentBridge = {
  async fetch(request:Request,env:Env) {
    const reject=()=>Response.json({error:"processor_unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});
    try {
      if(request.method!=="POST"||new URL(request.url).pathname!=="/process"||!env.DOCUMENT_PROCESSOR_TOKEN||env.DOCUMENT_PROCESSOR_TOKEN.length<32)return reject();
      const origin=new URL(env.DOCUMENT_PROCESSOR_ORIGIN??"");
      if(origin.protocol!=="https:"||origin.username||origin.password||origin.pathname!=="/"||origin.search||origin.hash||origin.port)return reject();
      const mime=request.headers.get("content-type")??"",digest=request.headers.get("x-document-sha256")??"";
      if(!["application/pdf",DOCX_MIME].includes(mime)||!/^[a-f0-9]{64}$/.test(digest))return reject();
      const bytes=await readBytesBounded(request,DOCUMENT_MAX_BYTES);
      return await fetch(new URL("/process",origin),{method:"POST",redirect:"error",signal:AbortSignal.timeout(24_000),headers:{"Authorization":`Bearer ${env.DOCUMENT_PROCESSOR_TOKEN}`,"Content-Type":mime,"Content-Length":String(bytes.length),"X-Document-SHA256":digest},body:new Uint8Array(bytes).buffer});
    }catch{return reject();}
  },
};
export default privateDocumentBridge;
