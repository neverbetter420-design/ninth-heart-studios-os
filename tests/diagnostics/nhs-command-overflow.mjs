/* One-off diagnostic: isolated app markup and CSS, synthetic values only.
 * NO auth, external network, app writes, secrets, deploy or real user records. */
import { chromium } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { previewCSS, renderNocturne } from "../helpers/nocturne-render.mjs";

const browser = await chromium.launch({headless:true});
mkdirSync("design-preview/nhs-command-diagnostic",{recursive:true});
try {
  const page = await browser.newPage({viewport:{width:320,height:850}});
  await page.route("**/*", route => route.abort());
  const {html} = await renderNocturne("admin","populated","home");
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({width,height:850});
    await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+html+'</body></html>');
    await page.addStyleTag({content:previewCSS});
    const audit=await page.evaluate(()=>{
      const vw = document.documentElement.clientWidth;
      const roots = [...document.querySelectorAll("*")];
      const hits = roots.flatMap(e=>{
        const r=e.getBoundingClientRect(),c=getComputedStyle(e);
        const right=r.right, left=r.left;
        return right>vw+1||left < -2 || e.scrollWidth > e.clientWidth+2 ? [{
           tag:e.tagName.toLowerCase(),name:(e.className?.baseVal||e.className||"").toString().slice(0,115),
           id:e.id,rect:[Math.round(left),Math.round(right),Math.round(r.width)],
           scroll:e.scrollWidth,client:e.clientWidth,position:c.position,
           display:c.display,grid:c.gridTemplateColumns,
           minWidth:c.minWidth,width:c.width,overflowX:c.overflowX,
           text:(e.textContent||"").trim().slice(0,70)
        }]:[];
      });
      const h=document.querySelector(".nocturne-overview h2");
      const hs=h?getComputedStyle(h):null;
      const measured = [".nocturne-overview", ".nocturne-overview > .living-studio", ".nocturne-welcome-copy", ".living-status", ".living-orbit", ".nhs-command-surface"].map(selector => {
        const node = document.querySelector(selector);
        if (!node) return {selector,found:false};
        const box=node.getBoundingClientRect(),style=getComputedStyle(node),p=node.offsetParent;
        return {selector,box:{left:box.left,top:box.top,width:box.width,height:box.height,right:box.right,bottom:box.bottom},
          styles:{position:style.position,display:style.display,gridColumn:style.gridColumn,gridRow:style.gridRow,
            grid:style.gridTemplateColumns,width:style.width,height:style.height,inset:style.inset,margin:style.margin,padding:style.padding},
          offsetParent:p?{className:String(p.className||""),width:p.getBoundingClientRect().width,height:p.getBoundingClientRect().height}:null};
      });
      return {measured,vw,docWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,innerWidth:innerWidth,
        heading:h?{display:hs.display,visibility:hs.visibility,opacity:hs.opacity,rect:(()=>{const r=h.getBoundingClientRect();return [r.x,r.y,r.width,r.height]})(),text:h.textContent?.slice(0,80)}:null,
        overflowers:hits.filter(x=>x.rect[2]>0).sort((a,b)=>b.rect[1]-a.rect[1]).slice(0,40)};
    });
    console.log("NHS_320_DIAGNOSTIC "+JSON.stringify({width,...audit}));
    writeFileSync("design-preview/nhs-command-diagnostic/"+width+"-audit.json",JSON.stringify(audit,null,2));
    writeFileSync("design-preview/nhs-command-diagnostic/"+width+"-snapshot.html",await page.content());
    await page.screenshot({path:"design-preview/nhs-command-diagnostic/"+width+".png",fullPage:false,animations:"disabled"});
  }
  await page.close();
} finally {await browser.close();}
