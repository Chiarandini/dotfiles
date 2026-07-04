"use strict";var x=Object.create;var f=Object.defineProperty;var v=Object.getOwnPropertyDescriptor;var S=Object.getOwnPropertyNames;var E=Object.getPrototypeOf,A=Object.prototype.hasOwnProperty;var _=(e,t)=>{for(var r in t)f(e,r,{get:t[r],enumerable:!0})},p=(e,t,r,i)=>{if(t&&typeof t=="object"||typeof t=="function")for(let o of S(t))!A.call(e,o)&&o!==r&&f(e,o,{get:()=>t[o],enumerable:!(i=v(t,o))||i.enumerable});return e};var h=(e,t,r)=>(r=e!=null?x(E(e)):{},p(t||!e||!e.__esModule?f(r,"default",{value:e,enumerable:!0}):r,e)),T=e=>p(f({},"__esModule",{value:!0}),e);var O={};_(O,{default:()=>I});module.exports=T(O);var c=require("@raycast/api");var u=h(require("react")),n=require("@raycast/api");var l=h(require("node:fs")),d=h(require("node:path"));var b=require("react/jsx-runtime");function g(e,t){let r=e instanceof Error?e.message:String(e);return(0,n.showToast)({style:n.Toast.Style.Failure,title:t?.title??"Something went wrong",message:t?.message??r,primaryAction:t?.primaryAction??m(e),secondaryAction:t?.primaryAction?m(e):void 0})}var m=e=>{let t=!0,r="[Extension Name]...",i="";try{let a=JSON.parse((0,l.readFileSync)((0,d.join)(n.environment.assetsPath,"..","package.json"),"utf8"));r=`[${a.title}]...`,i=`https://raycast.com/${a.owner||a.author}/${a.name}`,(!a.owner||a.access==="public")&&(t=!1)}catch{}let o=n.environment.isDevelopment||t,s=e instanceof Error?e?.stack||e?.message||"":String(e);return{title:o?"Copy Logs":"Report Error",onAction(a){a.hide(),o?n.Clipboard.copy(s):(0,n.open)(`https://github.com/raycast/extensions/issues/new?&labels=extension%2Cbug&template=extension_bug_report.yml&title=${encodeURIComponent(r)}&extension-url=${encodeURI(i)}&description=${encodeURIComponent(`#### Error:
\`\`\`
${s}
\`\`\`
`)}`)}}};var w=require("node:child_process");var R={cmux:"com.cmuxterm.app"};function y(e){let t=e?.trim();return t?t.toLowerCase():void 0}function $(e,t){let r=R[t],i=y(t),o=e.find(s=>s.name===t||s.localizedName===t);if(o)return o;if(r){let s=e.find(a=>a.bundleId===r);if(s)return s}if(i)return e.find(s=>[s.name,s.localizedName,s.bundleId].some(a=>y(a)===i))}async function C(e){if(process.platform!=="darwin")throw new Error("macOS only");let t=process.env.LC_ALL;delete process.env.LC_ALL;let{stdout:r,stderr:i}=(0,w.spawnSync)("osascript",["-e",e]);if(process.env.LC_ALL=t,i?.length)throw new Error(i.toString());return r.toString()}async function U(e){let t=await(0,c.getApplications)(),r=$(t,e);if(!r)throw new Error(`${e} not found`);return r}async function P(e){await U(e)}async function k(e){let t=`
    if application "Finder" is not running then
        return "Finder is not running"
    end if

    tell application "Finder"
      if (count of Finder windows) = 0 then error "No Finder window open"
      try
        set pathList to POSIX path of (folder of the front window as alias)
        return pathList
      on error
        error "Could not access Finder window path"
      end try
    end tell
  `;try{let r=await C(t);await P(e),await(0,c.open)(r.trim(),e),await(0,c.showToast)(c.Toast.Style.Success,"Done")}catch(r){await g(r)}}var I=async()=>await k("kitty");
