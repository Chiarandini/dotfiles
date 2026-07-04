"use strict";var B=Object.create;var m=Object.defineProperty;var G=Object.getOwnPropertyDescriptor;var K=Object.getOwnPropertyNames;var J=Object.getPrototypeOf,H=Object.prototype.hasOwnProperty;var Z=(e,t)=>{for(var r in t)m(e,r,{get:t[r],enumerable:!0})},A=(e,t,r,n)=>{if(t&&typeof t=="object"||typeof t=="function")for(let i of K(t))!H.call(e,i)&&i!==r&&m(e,i,{get:()=>t[i],enumerable:!(n=G(t,i))||n.enumerable});return e};var b=(e,t,r)=>(r=e!=null?B(J(e)):{},A(t||!e||!e.__esModule?m(r,"default",{value:e,enumerable:!0}):r,e)),Y=e=>A(m({},"__esModule",{value:!0}),e);var se={};Z(se,{default:()=>ae});module.exports=Y(se);var f=b(require("react")),a=require("@raycast/api");var d=b(require("node:fs")),g=b(require("node:path"));var _=require("react/jsx-runtime");function u(e,t){let r=e instanceof Error?e.message:String(e);return(0,a.showToast)({style:a.Toast.Style.Failure,title:t?.title??"Something went wrong",message:t?.message??r,primaryAction:t?.primaryAction??T(e),secondaryAction:t?.primaryAction?T(e):void 0})}var T=e=>{let t=!0,r="[Extension Name]...",n="";try{let o=JSON.parse((0,d.readFileSync)((0,g.join)(a.environment.assetsPath,"..","package.json"),"utf8"));r=`[${o.title}]...`,n=`https://raycast.com/${o.owner||o.author}/${o.name}`,(!o.owner||o.access==="public")&&(t=!1)}catch{}let i=a.environment.isDevelopment||t,c=e instanceof Error?e?.stack||e?.message||"":String(e);return{title:i?"Copy Logs":"Report Error",onAction(o){o.hide(),i?a.Clipboard.copy(c):(0,a.open)(`https://github.com/raycast/extensions/issues/new?&labels=extension%2Cbug&template=extension_bug_report.yml&title=${encodeURIComponent(r)}&extension-url=${encodeURI(n)}&description=${encodeURIComponent(`#### Error:
\`\`\`
${c}
\`\`\`
`)}`)}}};var l=require("@raycast/api");var s=require("@raycast/api");var E=require("node:child_process"),O=b(require("node:path"));var q={cmux:"com.cmuxterm.app"};function C(e){let t=e?.trim();return t?t.toLowerCase():void 0}function R(e,t){let r=q[t],n=C(t),i=e.find(c=>c.name===t||c.localizedName===t);if(i)return i;if(r){let c=e.find(o=>o.bundleId===r);if(c)return c}if(n)return e.find(c=>[c.name,c.localizedName,c.bundleId].some(o=>C(o)===n))}var X=["cwd","workingDirectory","working_directory"],Q=["focusedCwd","focused_cwd","focusedWorkingDirectory","focused_working_directory"],ee=["focused","active","isFocused","isActive","selected","current"];function S(e){return typeof e=="object"&&e!==null&&!Array.isArray(e)}function U(e,t){for(let r of t){let n=e[r];if(typeof n=="string"&&n.trim())return n}}function k(e){if(Array.isArray(e)){for(let r of e){let n=k(r);if(n)return n}return}if(!S(e))return;let t=U(e,Q);if(t)return t;for(let r of Object.values(e)){let n=k(r);if(n)return n}}function te(e){return ee.some(t=>e[t]===!0)}function x(e){if(Array.isArray(e)){for(let r of e){let n=x(r);if(n)return n}return}if(!S(e))return;let t=U(e,X);if(t)return t;for(let r of Object.values(e)){let n=x(r);if(n)return n}}function v(e){if(Array.isArray(e)){for(let t of e){let r=v(t);if(r)return r}return}if(S(e)){if(te(e)){let t=x(e);if(t)return t}for(let t of Object.values(e)){let r=v(t);if(r)return r}}}function P(e){let t=k(e);if(t)return t;let r=v(e);if(r)return r;throw new Error("cmux did not return a focused workspace with a working directory")}function I(e){return e.includes("Access denied")?"cmux denied external control. In cmux, open Settings -> Automation and set Socket Mode to Allow all local processes or Password.":e.includes("Broken pipe")||e.includes("Failed to write to socket")?"Unable to reach cmux over its automation socket. Make sure cmux is running, then reopen Settings -> Automation and check Socket Mode.":e||"cmux command failed"}async function y(e){if(process.platform!=="darwin")throw new Error("macOS only");let t=process.env.LC_ALL;delete process.env.LC_ALL;let{stdout:r,stderr:n}=(0,E.spawnSync)("osascript",["-e",e]);if(process.env.LC_ALL=t,n?.length)throw new Error(n.toString());return r.toString()}var $=e=>e!=="Clipboard"&&e!=="Finder";async function D(e){let t=await(0,s.getApplications)(),r=R(t,e);if(!r)throw new Error(`${e} not found`);return r}async function L(e){await D(e)}var re=1e4;function ne(e){return e.code==="ETIMEDOUT"?new Error("cmux command timed out. In cmux, open Settings -> Automation and set Socket Mode to Allow all local processes or Password."):e}async function p(e){let t=await D("cmux"),r=O.default.join(t.path,"Contents","Resources","bin","cmux"),n=(0,E.spawnSync)(r,e,{encoding:"utf8",timeout:re}),i=[n.stdout,n.stderr].filter(Boolean).join(`
`).trim();if(n.error)throw ne(n.error);if(n.status!==0)throw new Error(I(i));return n.stdout.trim()}async function M(){let e=await p(["--json","sidebar-state"]),t=JSON.parse(e);return P(t)}async function F(e){try{let t=await s.Clipboard.readText()||"";await L(e),await(0,s.open)(t,e),await(0,s.showToast)(s.Toast.Style.Success,"Done")}catch(t){await u(t)}}async function W(e){let t=`
    if application "${e}" is not running then
      error "${e} is not running"
    end if

    tell application "Finder" to activate
    tell application "${e}" to activate
    tell application "System Events"
      keystroke "open -a Finder ./"
      key code 76
    end tell
  `;try{let r=await y(t);await(0,s.showToast)(s.Toast.Style.Success,"Done",r)}catch(r){await u(r)}}async function N(e){let t=`
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
  `;try{let r=await y(t);await L(e),await(0,s.open)(r.trim(),e),await(0,s.showToast)(s.Toast.Style.Success,"Done")}catch(r){await u(r)}}var z=async()=>{let e=(await l.Clipboard.readText()||"").trim();if(!e){await(0,l.showToast)(l.Toast.Style.Failure,"Clipboard doesn't contain a directory path");return}try{let t=await p([e]);await(0,l.showToast)(l.Toast.Style.Success,"Done",t)}catch(t){await u(t)}};var h=require("@raycast/api");var V=async()=>{try{let e=await M();await(0,h.open)(e,"Finder"),await(0,h.showToast)(h.Toast.Style.Success,"Done")}catch(e){await u(e)}};var w=require("@raycast/api");var j=async()=>{let e=`
      if application "Finder" is not running then
          error "Finder is not running"
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
  `;try{let t=(await y(e)).trim(),r=await p([t]);await(0,w.showToast)(w.Toast.Style.Success,"Done",r)}catch(t){await u(t)}};async function ae(e){let{from:t,to:r}=e.arguments;try{if(t==="Clipboard"&&r==="cmux")await z();else if(t==="Finder"&&r==="cmux")await j();else if(t==="cmux"&&r==="Finder")await V();else if(t==="Clipboard"&&$(r))await F(r);else if(t==="Finder"&&$(r))await N(r);else if($(t)&&r==="Finder")await W(t);else throw new Error("Invalid combination")}catch(n){await u(n)}}
