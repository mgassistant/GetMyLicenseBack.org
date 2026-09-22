const BROKERIQ_URL = process.env.BROKERIQ_URL || "https://www.broker-iq.com/api/leads/inbound";
const BROKERIQ_TENANT_ID = process.env.BROKERIQ_TENANT_ID || "6db07734-dd08-49ff-9a23-2e5c5f9fb46a";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const NOTIFY_TO = process.env.LEAD_NOTIFY_TO || "";
const NOTIFY_FROM = process.env.LEAD_NOTIFY_FROM || "Get My License Back <support@getmylicenseback.org>";
function esc(s){return String(s==null?"":s).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));}
async function readBody(req){ if(req.body&&typeof req.body==='object')return req.body; if(typeof req.body==='string'&&req.body){try{return JSON.parse(req.body);}catch{return {};}} return await new Promise(r=>{let d='';req.on('data',c=>d+=c);req.on('end',()=>{try{r(JSON.parse(d||'{}'));}catch{r({});}});req.on('error',()=>r({}));}); }
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'method_not_allowed' });
  const b = await readBody(req);
  const firstName=String(b.first_name||b.firstName||'').trim(), lastName=String(b.last_name||b.lastName||'').trim();
  const name=`${firstName} ${lastName}`.trim(), email=String(b.email||'').trim(), phone=String(b.phone||'').trim();
  const notes=String(b.notes||b.message||b.details||'').trim();
  const known=new Set(['first_name','firstName','last_name','lastName','email','phone','notes','message','details']);
  const details={}; for(const [k,v] of Object.entries(b)){ if(!known.has(k)&&v!=null&&v!=='')details[k]=v; }
  const detailLines=Object.entries(details).map(([k,v])=>`${k.replace(/_/g,' ')}: ${Array.isArray(v)?v.join(', '):v}`).join('\n');
  const lead={ source:'getmylicenseback.org', tenant_id:BROKERIQ_TENANT_ID, lead_type:'dui_license', name, email, phone,
    lead_status: (b.partial === true || b.partial === "true") ? "partial" : "complete",
    partial: (b.partial === true || b.partial === "true"),
    message:[notes,detailLines].filter(Boolean).join('\n\n'), ...details };
  await Promise.allSettled([
    (async()=>{ try{ await fetch(BROKERIQ_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(lead)}); }catch(e){console.error('brokeriq',e);} })(),
    (async()=>{ if(!RESEND_API_KEY||!NOTIFY_TO)return; try{ await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:NOTIFY_FROM,to:NOTIFY_TO.split(',').map(s=>s.trim()).filter(Boolean),subject:`${(b.partial===true||b.partial==="true") ? "[PARTIAL LEAD] " : ""}New Get My License Back lead: ${name||email||phone||'(no name)'}`,html:`<h2>${(b.partial===true||b.partial==="true") ? "[PARTIAL — form not completed] " : ""}New Get My License Back lead</h2><p><b>Name:</b> ${esc(name)}</p><p><b>Email:</b> ${esc(email)}</p><p><b>Phone:</b> ${esc(phone)}</p>${detailLines?`<p><b>Details:</b></p><pre>${esc(detailLines)}</pre>`:''}${notes?`<p><b>Notes:</b> ${esc(notes)}</p>`:''}<p style="color:#888">Source: getmylicenseback.org</p>`})}); }catch(e){console.error('resend',e);} })(),
  ]);
  return res.status(200).json({ ok:true });
}
