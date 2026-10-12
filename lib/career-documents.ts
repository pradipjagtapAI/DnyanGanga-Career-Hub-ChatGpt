import { CareerError, assertSameOrigin, defaultProfile, keys, number, object, string, validateProfile } from "./career-core";
import type { Profile } from "./career-core";
import type { CareerStore } from "./career-store";

export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export type DocumentEnv = { BUCKET?: R2Bucket; CAREER_DOCUMENT_PROCESSOR?: Fetcher; DOCUMENT_PROCESSOR_APPROVED?: string };
type DocumentRow = {id:string;user_id:string;original_key:string;preview_key:string|null;original_filename:string;mime_type:string;byte_size:number;sha256:string;status:string;extracted:string|null;confirmed_resume_id:string|null;error_code:string|null};
export type ExtractedDocument = {fields:Partial<Profile>;uncertainFields:string[];notes:string[];documentContacts:{email?:string;phone?:string;whatsapp?:string}};
export function documentAvailability(env: DocumentEnv) {
  const configured = !!env.BUCKET && !!env.CAREER_DOCUMENT_PROCESSOR && env.DOCUMENT_PROCESSOR_APPROVED === "true";
  return {configured,status:configured ? "configured" : "disabled",reason:configured ? "Private quarantine and an operator-approved isolated scanner/converter are configured. Extraction requires review." : "Upload requires private storage and an operator-approved isolated scanner/converter. No file is accepted until both are configured."};
}
export async function readBytesBounded(request: Pick<Request, "headers" | "body">, max: number): Promise<Uint8Array> {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared)>max)) throw new CareerError(413,"TOO_LARGE","The file exceeds the upload limit.");
  const reader = request.body?.getReader(); if (!reader) throw new CareerError(400,"EMPTY_FILE","Choose a file to upload.");
  const chunks:Uint8Array[]=[]; let size=0;
  while (true) {const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new CareerError(413,"TOO_LARGE","The file exceeds the upload limit.");}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
function invalid(message="The document is corrupted, encrypted, or contains unsupported active content."):never {throw new CareerError(400,"UNSAFE_DOCUMENT",message);}
/** Conservative envelope validation; this never replaces the isolated malware scan. */
export function validateDocumentStructure(bytes:Uint8Array,mime:string,filename:string) {
  if (!bytes.length || bytes.length>DOCUMENT_MAX_BYTES) invalid("Choose a nonempty document within 10 MB.");
  if (!/^[^\u0000-\u001f/\\]{1,180}$/.test(filename)) invalid("Use a short filename without path characters.");
  if (mime === "application/pdf") {
    if (!/\.pdf$/i.test(filename)) invalid("The PDF filename and content type must agree.");
    const text=new TextDecoder("latin1").decode(bytes);
    if (!/^%PDF-(?:1\.[0-7]|2\.0)/.test(text) || !/%%EOF\s*$/.test(text.slice(-1024)) || !/\b\d+\s+\d+\s+obj\b/.test(text)) invalid();
    if (/\/Encrypt\b/.test(text)) throw new CareerError(400,"PASSWORD_PROTECTED","Remove the document password before uploading.");
    if (/\/(?:JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA|RichMedia|XFA)\b/.test(text)) invalid();
    return;
  }
  if(mime!==DOCX_MIME || !/\.docx$/i.test(filename)) throw new CareerError(415,"UNSUPPORTED_FILE","Only PDF and Word DOCX documents are supported.");
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);const u16=(p:number)=>{if(p<0||p+2>bytes.length)invalid();return view.getUint16(p,true);};const u32=(p:number)=>{if(p<0||p+4>bytes.length)invalid();return view.getUint32(p,true);};
  if(u32(0)!==0x04034b50)invalid();let end=-1;
  for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)if(u32(p)===0x06054b50&&p+22+u16(p+20)===bytes.length){end=p;break;}
  if(end<0||u16(end+4)!==0||u16(end+6)!==0)invalid();
  const count=u16(end+10),centralSize=u32(end+12),centralOffset=u32(end+16);
  if(count<3||count>2000||count!==u16(end+8)||centralOffset+centralSize!==end)invalid();
  const names=new Set<string>();let cursor=centralOffset,total=0;
  for(let i=0;i<count;i++) {
    if(u32(cursor)!==0x02014b50)invalid();const flags=u16(cursor+8),method=u16(cursor+10),compressed=u32(cursor+20),expanded=u32(cursor+24),nameLength=u16(cursor+28),extra=u16(cursor+30),comment=u16(cursor+32),local=u32(cursor+42);
    if(flags&1||![0,8].includes(method)||[compressed,expanded,local].includes(0xffffffff))invalid();
    if(cursor+46+nameLength+extra+comment>end||!nameLength)invalid();
    let name:string;try{name=new TextDecoder("utf-8",{fatal:true}).decode(bytes.subarray(cursor+46,cursor+46+nameLength));}catch{invalid();}
    if(name!.includes("\\")||name!.startsWith("/")||name!.split("/").some(x=>x===".."||x===".")||/[\u0000-\u001f]/.test(name!)||names.has(name!))invalid();
    if(/(?:vbaProject|activeX|embeddings|\.exe$|\.dll$|\.js$|\.vbs$|\.bat$|\.cmd$|\.bin$)/i.test(name!))invalid();
    total+=expanded;if(total>50*1024*1024||expanded>Math.max(1024*1024,compressed*100))invalid("The document exceeds decompression limits.");
    if(local>=centralOffset||u32(local)!==0x04034b50||u16(local+6)!==flags||u16(local+8)!==method)invalid();
    const localName=u16(local+26),localExtra=u16(local+28),dataStart=local+30+localName+localExtra;
    if(dataStart+compressed>centralOffset||localName!==nameLength||new TextDecoder().decode(bytes.subarray(local+30,local+30+localName))!==name!)invalid();
    names.add(name!);cursor+=46+nameLength+extra+comment;
  }
  if(cursor!==end||!["[Content_Types].xml","word/document.xml","_rels/.rels"].every(name=>names.has(name)))invalid();
}
function extraction(value:unknown):ExtractedDocument {
  const input=object(value);keys(input,["fields","uncertainFields","notes","documentContacts"]);
  const fields=object(input.fields ?? {});const allowed=Object.keys(defaultProfile()).filter(k=>!["email","phone","whatsapp"].includes(k));keys(fields,allowed);
  const validated=validateProfile({...defaultProfile(),...fields},"");const approved:Partial<Profile>={};
  for(const key of Object.keys(fields) as (keyof Profile)[])Object.assign(approved,{[key]:validated[key]});
  const list=(v:unknown,max:number)=>{if(!Array.isArray(v)||v.length>max)invalid("The processor returned invalid extracted data.");return v.map(x=>string(x,"Extraction note",500));};
  const contacts=object(input.documentContacts ?? {});keys(contacts,["email","phone","whatsapp"]);
  return {fields:approved,uncertainFields:list(input.uncertainFields??[],30),notes:list(input.notes??[],30),documentContacts:{...(contacts.email?{email:string(contacts.email,"Document email",254)}:{}),...(contacts.phone?{phone:string(contacts.phone,"Document phone",30)}:{}),...(contacts.whatsapp?{whatsapp:string(contacts.whatsapp,"Document WhatsApp",30)}:{})}};
}
export class CareerDocumentService {
  constructor(public store:CareerStore,public env:DocumentEnv) {}
  async owned(id:string) {const row=await this.store.query("SELECT * FROM career_documents WHERE id=? AND user_id=?",id,this.store.identity.userId).first<DocumentRow>();if(!row)throw new CareerError(404,"NOT_FOUND","The document was not found.");return row;}
  async upload(request:Request) {
    assertSameOrigin(request);if(!documentAvailability(this.env).configured)throw new CareerError(503,"DOCUMENT_PROCESSOR_UNAVAILABLE",documentAvailability(this.env).reason);
    const mime=(request.headers.get("content-type")??"").split(";")[0].trim();let filename:string;
    try{filename=decodeURIComponent(request.headers.get("x-career-filename")??"");}catch{invalid("The filename is invalid.");}
    const bytes=await readBytesBounded(request,DOCUMENT_MAX_BYTES);validateDocumentStructure(bytes,mime,filename!);
    const count=await this.store.query("SELECT COUNT(*) AS count FROM career_documents WHERE user_id=?",this.store.identity.userId).first<{count:number}>();if((count?.count??0)>=50)throw new CareerError(409,"QUOTA_REACHED","The workspace supports 50 uploaded documents.");
    const id=crypto.randomUUID(),originalKey=`quarantine/${crypto.randomUUID()}`,sha256=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new Uint8Array(bytes).buffer))).map(x=>x.toString(16).padStart(2,"0")).join(""),now=this.store.now();
    await this.env.BUCKET!.put(originalKey,bytes,{httpMetadata:{contentType:"application/octet-stream"},customMetadata:{documentId:id,sha256}});
    try {const inserted=await this.store.query("INSERT INTO career_documents(id,user_id,original_key,original_filename,mime_type,byte_size,sha256,status,created_at,updated_at) SELECT ?,?,?,?,?,?,?,'quarantined',?,? WHERE (SELECT COUNT(*) FROM career_documents WHERE user_id=?)<50",id,this.store.identity.userId,originalKey,filename!,mime,bytes.length,sha256,now,now,this.store.identity.userId).run();if(!inserted.meta.changes)throw new CareerError(409,"QUOTA_REACHED","The upload limit was reached.");}
    catch(error){await this.env.BUCKET!.delete(originalKey);throw error;}
    let pendingPreviewKey:string|null=null;
    try {
      await this.store.query("UPDATE career_documents SET status='processing',updated_at=? WHERE id=? AND user_id=?",this.store.now(),id,this.store.identity.userId).run();
      const response=await this.env.CAREER_DOCUMENT_PROCESSOR!.fetch(new Request("https://document-processor.internal/process",{method:"POST",headers:{"Content-Type":mime,"X-Document-Id":id,"X-Document-SHA256":sha256},body:new Uint8Array(bytes).buffer,signal:AbortSignal.timeout(25_000)}));
      if(!response.ok)throw new CareerError(503,"PROCESSOR_FAILED","Document checks could not finish. The file remains private and unavailable for download.");
      const data=object(JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(await readBytesBounded(response,150_000))));
      keys(data,["scanStatus","sha256","parserVersion","text","extracted"]);
      if(data.scanStatus!=="clean"||data.sha256!==sha256||!string(data.parserVersion,"Parser version",120,true))invalid("The processor could not verify a safe document.");
      const text=string(data.text,"Extracted resume",60000,true),extracted=extraction(data.extracted),previewKey=`previews/${crypto.randomUUID()}`;
      pendingPreviewKey=previewKey;
      await this.env.BUCKET!.put(previewKey,text,{httpMetadata:{contentType:"text/plain; charset=utf-8"}});
      const updated=await this.store.db.batch([this.store.query("UPDATE career_documents SET preview_key=?,extracted=?,status='review_required',updated_at=? WHERE id=? AND user_id=? AND status='processing'",previewKey,JSON.stringify(extracted),this.store.now(),id,this.store.identity.userId),this.store.query("INSERT INTO career_audit_events(id,user_id,action,entity_id,created_at) SELECT ?,?,'document.checked',?,? WHERE changes()>0",crypto.randomUUID(),this.store.identity.userId,id,this.store.now())]);
      if(!updated[0].meta.changes)await this.env.BUCKET!.delete(previewKey);
    }catch(error){let code=error instanceof CareerError?error.code:"PROCESSOR_FAILED";if(pendingPreviewKey){try{await this.env.BUCKET!.delete(pendingPreviewKey);}catch{code="STORAGE_CLEANUP_REQUIRED";}}await this.store.query("UPDATE career_documents SET preview_key=COALESCE(?,preview_key),status=?,error_code=?,updated_at=? WHERE id=? AND user_id=?",pendingPreviewKey,code==="UNSAFE_DOCUMENT"?"rejected":"error",code,this.store.now(),id,this.store.identity.userId).run();}
    return id;
  }
  async preview(id:string) {const row=await this.owned(id);if(!["review_required","confirmed"].includes(row.status)||!row.preview_key)throw new CareerError(409,"PREVIEW_UNAVAILABLE","A safe preview is not available yet.");if(!this.env.BUCKET)throw new CareerError(503,"STORAGE_UNAVAILABLE","Private storage is unavailable.");const file=await this.env.BUCKET.get(row.preview_key);if(!file)throw new CareerError(404,"NOT_FOUND","The preview was not found.");return {id,text:await file.text(),status:row.status,extracted:row.extracted?JSON.parse(row.extracted):null};}
  async original(id:string) {const row=await this.owned(id);if(!["review_required","confirmed"].includes(row.status))throw new CareerError(409,"DOWNLOAD_UNAVAILABLE","Only successfully checked originals can be downloaded.");if(!this.env.BUCKET)throw new CareerError(503,"STORAGE_UNAVAILABLE","Private storage is unavailable.");const file=await this.env.BUCKET.get(row.original_key);if(!file)throw new CareerError(404,"NOT_FOUND","The original was not found.");return {row,file};}
  async review(id:string,value:unknown) {
    const row=await this.owned(id);if(!["review_required","confirmed"].includes(row.status))throw new CareerError(409,"REVIEW_UNAVAILABLE","This document must pass checks before review.");
    const input=object(value);keys(input,["title","targetRole","text","applyProfile","profileFields","contactFields","confirmContacts","expectedRevision"]);
    const title=string(input.title,"Resume title",160,true),targetRole=string(input.targetRole,"Target role",160),text=string(input.text,"Reviewed resume text",60000,true),account=await this.store.account();let profile:Profile|undefined;
    const fields=object(input.profileFields??{});keys(fields,Object.keys(defaultProfile()).filter(k=>!["email","phone","whatsapp"].includes(k)));
    const contacts=object(input.contactFields??{});keys(contacts,["phone","whatsapp"]);
    if(Object.keys(contacts).length&&input.confirmContacts!==true)throw new CareerError(400,"CONTACT_CONFIRMATION","Confirm contact changes separately from extracted career details.");
    if(input.applyProfile!==undefined&&typeof input.applyProfile!=="boolean")throw new CareerError(400,"INVALID_INPUT","Choose whether to apply career details.");
    if(input.applyProfile===true||Object.keys(contacts).length)profile=validateProfile({...JSON.parse(account.profile),...(input.applyProfile===true?fields:{}),...contacts,email:this.store.identity.email},this.store.identity.email);
    if(profile && input.expectedRevision===undefined)throw new CareerError(409,"REVISION_REQUIRED","Reload the review form and include its profile revision before changing career or contact details.");
    const expected=input.expectedRevision===undefined?account.revision:number(input.expectedRevision,"Revision",Number.MAX_SAFE_INTEGER);
    if(!Number.isSafeInteger(expected))throw new CareerError(400,"INVALID_INPUT","Profile revision must be an integer.");
    return this.store.saveTrustedResume({title,targetRole,text,source:"uploaded-reviewed",profileRevision:profile?expected+1:expected},id,profile,expected);
  }
  async remove(id:string) {const row=await this.owned(id);if(!this.env.BUCKET)throw new CareerError(503,"STORAGE_UNAVAILABLE","Private storage is unavailable. File deletion cannot be confirmed.");await this.env.BUCKET.delete([row.original_key,...(row.preview_key?[row.preview_key]:[])]);await this.store.db.batch([this.store.query("UPDATE career_resume_versions SET document_id=NULL WHERE document_id=? AND user_id=?",id,this.store.identity.userId),this.store.query("DELETE FROM career_documents WHERE id=? AND user_id=?",id,this.store.identity.userId),this.store.audit("document.deleted",id)]);}
}


