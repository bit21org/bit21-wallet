// BIT21 Design System — Premium Bitcoin Wallet UI
export const THEMES = {
  dark: {
    bg:"#08080A",bgAlt:"#0C0C0F",surface:"#111115",surfaceHover:"#16161B",
    border:"#1C1C24",borderHover:"#26263A",
    orange:"#F7931A",orangeDark:"#D4780E",
    orangeGlow:"rgba(247,147,26,0.15)",orangeMuted:"rgba(247,147,26,0.08)",
    white:"#F2F2F7",gray:"#6B6B80",grayLight:"#9898AD",grayDim:"#3A3A4A",
    green:"#34D399",greenDark:"#059669",greenGlow:"rgba(52,211,153,0.12)",
    red:"#F87171",redDark:"#DC2626",redGlow:"rgba(248,113,113,0.1)",
    blue:"#60A5FA",blueGlow:"rgba(96,165,250,0.1)",
    purple:"#A78BFA",purpleGlow:"rgba(167,139,250,0.1)",
    yellow:"#FBBF24",yellowGlow:"rgba(251,191,36,0.1)",
    cardGrad:"linear-gradient(145deg,#111115,#0E0E14)",
    balanceGrad:"linear-gradient(160deg,rgba(247,147,26,0.04) 0%,rgba(247,147,26,0.01) 40%,#111115 100%)",
    glassOverlay:"rgba(8,8,10,0.88)",shadow:"0 4px 24px rgba(0,0,0,0.5)",shadowLg:"0 8px 40px rgba(0,0,0,0.6)",
  },
  light: {
    bg:"#F7F7FA",bgAlt:"#EFEFF4",surface:"#FFFFFF",surfaceHover:"#F5F5FA",
    border:"#E2E2EA",borderHover:"#D0D0DC",
    orange:"#E8851A",orangeDark:"#D4780E",
    orangeGlow:"rgba(232,133,26,0.12)",orangeMuted:"rgba(232,133,26,0.06)",
    white:"#111118",gray:"#747488",grayLight:"#606070",grayDim:"#C0C0CC",
    green:"#059669",greenDark:"#047857",greenGlow:"rgba(5,150,105,0.08)",
    red:"#DC2626",redDark:"#B91C1C",redGlow:"rgba(220,38,38,0.06)",
    blue:"#2563EB",blueGlow:"rgba(37,99,235,0.06)",
    purple:"#7C3AED",purpleGlow:"rgba(124,58,237,0.06)",
    yellow:"#D97706",yellowGlow:"rgba(217,119,6,0.06)",
    cardGrad:"linear-gradient(145deg,#FFFFFF,#FAFAFE)",
    balanceGrad:"linear-gradient(160deg,rgba(232,133,26,0.03) 0%,rgba(232,133,26,0.01) 40%,#FFFFFF 100%)",
    glassOverlay:"rgba(247,247,250,0.88)",shadow:"0 2px 12px rgba(0,0,0,0.06)",shadowLg:"0 4px 24px rgba(0,0,0,0.08)",
  },
};
export const FN={display:"'SF Pro Display',-apple-system,sans-serif",body:"'SF Pro Text',-apple-system,sans-serif",mono:"'SF Mono','Fira Code',monospace"};
export const RD={sm:8,md:12,lg:16,xl:20};
export const formatBTC=(v)=>(v??0).toFixed(8);
export const formatUSD=(v)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(v??0);
export const formatCurrency=(v,cur="usd")=>{
  const code=cur.toUpperCase();
  try{return new Intl.NumberFormat("en-US",{style:"currency",currency:code,minimumFractionDigits:2,maximumFractionDigits:2}).format(v??0);}
  catch{return `${v?.toFixed(2)??0} ${code}`;}
};
export const shortAddr=(a)=>a?`${a.slice(0,8)}···${a.slice(-6)}`:"";
export const shortTxid=(t)=>t?`${t.slice(0,8)}···${t.slice(-8)}`:"";
export const timeAgo=(ts)=>{if(!ts)return"Pending";const s=Math.floor(Date.now()/1000-ts);if(s<60)return"Just now";if(s<3600)return`${Math.floor(s/60)}m ago`;if(s<86400)return`${Math.floor(s/3600)}h ago`;if(s<604800)return`${Math.floor(s/86400)}d ago`;return new Date(ts*1000).toLocaleDateString("en-US",{month:"short",day:"numeric"});};
export const groupByDate=(txs)=>{const g={};const now=Math.floor(Date.now()/1000);const today=now-(now%86400);txs.forEach(tx=>{const ts=tx.status?.block_time;let l;if(!ts)l="Pending";else if(ts>=today)l="Today";else if(ts>=today-86400)l="Yesterday";else if(ts>=today-604800)l="This Week";else l=new Date(ts*1000).toLocaleDateString("en-US",{month:"long",year:"numeric"});if(!g[l])g[l]=[];g[l].push(tx);});return g;};
export const stagger=()=>({});
// Spring & smooth transition helpers
export const springTransition="all 0.4s cubic-bezier(0.34,1.56,0.64,1)";
export const smoothTransition="all 0.3s cubic-bezier(0.4,0,0.2,1)";
export const staggerGrid=()=>({});

let _inj=false;
export function injectCSS(){if(_inj)return;_inj=true;const s=document.createElement("style");s.textContent=`
@keyframes b21fi{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes b21si{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}
@keyframes b21sr{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
@keyframes b21cu{from{opacity:0;transform:translateY(6px);filter:blur(3px)}to{opacity:1;transform:translateY(0);filter:blur(0)}}
@keyframes b21sh{0%{background-position:-300% 0}100%{background-position:300% 0}}
@keyframes b21gl{0%,100%{opacity:0.5}50%{opacity:1}}
@keyframes b21sp{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes b21pr{0%{box-shadow:0 0 0 0 rgba(247,147,26,0.3)}70%{box-shadow:0 0 0 8px rgba(247,147,26,0)}100%{box-shadow:0 0 0 0 rgba(247,147,26,0)}}
@keyframes b21bi{0%{transform:scale(0)}60%{transform:scale(1.06)}100%{transform:scale(1)}}
@keyframes b21cf{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes b21bs{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes b21fab{0%{transform:scale(0);opacity:0}70%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
@keyframes b21cnt{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}
@keyframes b21tst{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes b21fp{0%,100%{box-shadow:0 0 0 0 rgba(247,147,26,0.25)}50%{box-shadow:0 0 0 10px rgba(247,147,26,0)}}
.b21p{transition:transform 0.15s cubic-bezier(0.4,0,0.2,1),opacity 0.15s ease;-webkit-tap-highlight-color:transparent}.b21p:active{transform:scale(0.96);opacity:0.9}
.b21h{transition:transform 0.25s cubic-bezier(0.4,0,0.2,1),box-shadow 0.25s ease,border-color 0.25s ease}.b21h:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,0.15)}
input::placeholder,textarea::placeholder{opacity:0.35}
*{-webkit-tap-highlight-color:transparent}
`;document.head.appendChild(s);}
