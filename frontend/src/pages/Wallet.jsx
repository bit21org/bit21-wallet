import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  getBalance, getTransactions, getPrice, getPriceHistory,
  getFees, getUTXOs, broadcastTx, getWhaleAlerts, getBlockHeight,
  clearAddressCache, getFeatures, getMempoolStats, getFearGreedIndex, getMarketData,
  getRawTxHex,
  getDifficultyAdjustment, getRecentBlocks, getMiningPools,
} from "../lib/api.js";
import {
  validateAddress, validateSeedPhrase,
  getKeyPairSmart, getKeyPairFromWIF,
  addressFromPrivateKey,
  buildTransaction, buildTransactionWithUTXOs,
  estimateFee, locktimeFromDays, createVaultAddress, spendFromVault,
  ADDRESS_TYPES, deriveAllAddresses, getAddressType, addressTypeIdToKey, hashPIN,
} from "../lib/bitcoin.js";
import { getUserFriendlyError } from "../lib/errors.js";

// Parse stored wallet data
function parseSeedData(data) {
  if (!data) return { seed: null, passphrase: "" };
  const ppIdx = data.indexOf("\n__EXT__:");
  if (ppIdx >= 0) {
    return { seed: data.substring(0, ppIdx), passphrase: data.substring(ppIdx + 9) };
  }
  return { seed: data, passphrase: "" };
}
import QRCode from "qrcode";
import { Html5Qrcode } from "html5-qrcode";
import { THEMES, FN, RD, formatUSD, formatCurrency, shortAddr, shortTxid, timeAgo, groupByDate, stagger, injectCSS, springTransition, smoothTransition, staggerGrid } from "../components/DesignSystem.jsx";
import { exportBackup, importBackup } from "../lib/backup.js";
import { requestPermission as reqNotifPerm, getPermission as getNotifPerm, startBalancePoll, stopBalancePoll, getNotifySettings, setNotifySettings, subscribeToPush, updatePushAlerts, isPushSubscribed, sendHeartbeat } from "../lib/notifications.js";
import { isNativeApp, initNativePush, sendNativeHeartbeat, unregisterNativePush, isNativePushRegistered, enableScreenSecurity, disableScreenSecurity } from "../lib/native-push.js";
import { useNativeBack } from "../lib/native-back.js";
import { isWebAuthnSupported, isPlatformAuthAvailable, isBiometricRegistered, registerBiometric, authenticateBiometric, removeBiometric } from "../lib/biometric.js";
import { LANGUAGES, getLanguage, setLanguage as setLangPref, t, getDirection } from "../lib/i18n.js";

// Block-explorer redirect through bit21's own domain — the backend
// resolves /explorer/tx/* and /explorer/block/* to whichever explorer
// bit21 currently uses, so the client never references third parties directly.
const EXPLORER_BASE = "https://wallet.bit21.app/explorer";

/* ═══ Shared UI Atoms ═══ */
const Badge=({children,color,bg,style={}})=><span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:999,fontSize:11,fontWeight:700,color,background:bg,...style}}>{children}</span>;
const Spin=({sz=20,color})=><div style={{width:sz,height:sz,border:`2px solid ${color}20`,borderTop:`2px solid ${color}`,borderRadius:"50%",animation:"b21sp 0.8s linear infinite",display:"inline-block"}}/>;
const Skel=({w="100%",h=16,C})=><div style={{width:w,height:h,borderRadius:RD.sm,background:`linear-gradient(90deg,${C.surface} 25%,${C.border} 50%,${C.surface} 75%)`,backgroundSize:"200% 100%",animation:"b21sh 1.8s ease infinite"}}/>;
const Div=({C,sp=14})=><div style={{height:1,background:C.border,margin:`${sp}px 0`}}/>;
const SL=({children,C})=><div style={{fontSize:11,fontWeight:700,color:C.gray,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8,fontFamily:FN.body}}>{children}</div>;
const EBox=({children,C})=>children?<div style={{background:C.redGlow,borderRadius:RD.md,padding:"12px 16px",marginBottom:14,border:`1px solid ${C.red}25`,fontSize:13,color:C.red}}>{children}</div>:null;
const WBox=({children,C})=>children?<div style={{background:C.yellowGlow,borderRadius:RD.md,padding:"12px 16px",marginBottom:14,border:`1px solid ${C.yellow}30`,fontSize:12,color:C.yellow,lineHeight:1.6}}>{children}</div>:null;
const Inp=({C,mono,style={},...p})=><input {...p} style={{width:"100%",padding:"13px 16px",borderRadius:RD.md,border:`1px solid ${C.border}`,background:C.bgAlt,color:C.white,fontSize:14,fontFamily:mono?FN.mono:FN.body,outline:"none",boxSizing:"border-box",...style}} onFocus={e=>e.target.style.borderColor=C.orange} onBlur={e=>e.target.style.borderColor=C.border}/>;
const TArea=({C,style={},...p})=><textarea {...p} style={{width:"100%",padding:"13px 16px",borderRadius:RD.md,border:`1px solid ${C.border}`,background:C.bgAlt,color:C.white,fontSize:14,fontFamily:FN.mono,lineHeight:1.8,resize:"none",outline:"none",boxSizing:"border-box",...style}} onFocus={e=>e.target.style.borderColor=C.orange} onBlur={e=>e.target.style.borderColor=C.border}/>;
const PBtn=({children,onClick,disabled,C,danger,fw=true,style={}})=><button onClick={onClick} disabled={disabled} className="b21p" style={{width:fw?"100%":"auto",padding:"15px 24px",borderRadius:RD.md,border:"none",cursor:disabled?"not-allowed":"pointer",background:disabled?C.grayDim:danger?`linear-gradient(135deg,${C.red},${C.redDark})`:`linear-gradient(135deg,${C.orange},${C.orangeDark})`,fontSize:15,fontWeight:700,color:disabled?C.gray:"#FFF",fontFamily:FN.body,opacity:disabled?0.5:1,transition:"all 0.2s",boxShadow:disabled?"none":`0 4px 16px ${danger?C.redGlow:C.orangeGlow}`,...style}}>{children}</button>;
const SBtn=({children,onClick,disabled,C,color,fw=true,style={}})=><button onClick={onClick} disabled={disabled} className="b21p" style={{width:fw?"100%":"auto",padding:"13px 20px",borderRadius:RD.md,border:`1px solid ${color?color+"30":C.border}`,background:color?color+"08":"transparent",cursor:disabled?"not-allowed":"pointer",fontSize:14,fontWeight:600,color:color||C.white,fontFamily:FN.body,opacity:disabled?0.5:1,...style}}>{children}</button>;
const Tog=({value,onChange,C})=><button onClick={onChange} className="b21p" style={{width:38,height:22,borderRadius:11,border:"none",cursor:"pointer",background:value?C.orange:C.grayDim||"#3A3A4A",padding:2,display:"flex",alignItems:"center",justifyContent:value?"flex-end":"flex-start",transition:"all 0.2s ease",flexShrink:0}}><div style={{width:18,height:18,borderRadius:9,background:value?"#FFF":C.gray||"#6B6B80",transition:"all 0.2s ease"}}/></button>;
const IBtn=({children,onClick,sz=36,C,active,style={}})=><button onClick={onClick} className="b21p" style={{width:sz,height:sz,borderRadius:RD.sm,border:`1px solid ${active?C.orange:C.border}`,background:active?C.orangeMuted:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:active?C.orange:C.gray,...style}}>{children}</button>;
const Crd=({children,C,onClick,glow,active,pad="16px",style={}})=><div onClick={onClick} className={onClick?"b21h b21p":""} style={{background:C.cardGrad,borderRadius:RD.lg,padding:pad,border:`1px solid ${active?"rgba(247,147,26,0.3)":C.border}`,cursor:onClick?"pointer":"default",boxShadow:glow?`0 0 30px ${C.orangeGlow}`:"none",...style}}>{children}</div>;
const Empty=({icon,title,desc,C})=><div style={{background:C.cardGrad,borderRadius:RD.lg,padding:"40px 20px",textAlign:"center",border:`1px solid ${C.border}`}}>{icon&&<div style={{fontSize:28,marginBottom:12,opacity:0.5}}>{icon}</div>}<div style={{fontSize:14,fontWeight:600,color:C.grayLight,marginBottom:4}}>{title}</div>{desc&&<div style={{fontSize:12,color:C.gray}}>{desc}</div>}</div>;
const ConfirmModal=({open,title,message,confirmText,cancelText,danger,onConfirm,onCancel,C})=>{if(!open)return null;return(<div style={{position:"fixed",inset:0,zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={onCancel}><div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(8px)",animation:"b21fi 0.15s ease-out"}}/><div onClick={e=>e.stopPropagation()} style={{position:"relative",background:C.surface,borderRadius:RD.xl,padding:"28px 24px 20px",width:"100%",maxWidth:340,border:`1px solid ${C.border}`,boxShadow:"0 24px 80px rgba(0,0,0,0.6)",animation:"b21si 0.2s ease-out"}}><div style={{width:48,height:48,borderRadius:24,background:danger?C.redGlow:C.orangeGlow,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",border:`1px solid ${danger?C.red+"30":C.orange+"30"}`}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={danger?C.red:C.orange} strokeWidth="2"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg></div><div style={{fontSize:17,fontWeight:700,color:C.white,textAlign:"center",marginBottom:8,fontFamily:FN.display}}>{title}</div><div style={{fontSize:13,color:C.grayLight,textAlign:"center",lineHeight:1.6,marginBottom:24}}>{message}</div><div style={{display:"flex",gap:10}}><SBtn C={C} fw onClick={onCancel}>{cancelText||"Cancel"}</SBtn><PBtn C={C} danger={danger} fw onClick={onConfirm}>{confirmText||"Confirm"}</PBtn></div></div></div>);};
const _isNat=()=>{try{return window.Capacitor?.isNativePlatform?.()}catch{return false}};
const Bk=({onClick,C,label="Back"})=>{if(_isNat())return null;return <button onClick={onClick} className="b21p" style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:6,color:C.grayLight,fontSize:14,fontWeight:500,padding:"4px 0",marginBottom:16,fontFamily:FN.body}}>‹ {label}</button>;};
const PT=({title,sub,C})=><div style={{marginBottom:sub?16:12}}><h3 style={{fontSize:22,fontWeight:800,color:C.white,margin:0,fontFamily:FN.display,letterSpacing:"-0.02em"}}>{title}</h3>{sub&&<p style={{fontSize:13,color:C.gray,margin:"4px 0 0",lineHeight:1.5}}>{sub}</p>}</div>;

/* ═══ Slide to Confirm — drag-to-confirm button ═══ */
function SlideToConfirm({C,FN,onConfirm,disabled}){
  const [x,setX]=useState(0);
  const [dragging,setDragging]=useState(false);
  const trackRef=useRef(null);
  const [max,setMax]=useState(240);
  const KNOB=58;
  useEffect(()=>{if(trackRef.current)setMax(trackRef.current.offsetWidth-KNOB-6);},[]);
  const start=(clientX)=>{
    if(disabled)return;
    setDragging(true);
    const startX=clientX-x;
    let currentX=x;
    const move=(ev)=>{
      const cx=ev.touches?ev.touches[0].clientX:ev.clientX;
      const nx=Math.max(0,Math.min(max,cx-startX));
      currentX=nx;setX(nx);
    };
    const up=()=>{
      setDragging(false);
      document.removeEventListener("mousemove",move);
      document.removeEventListener("mouseup",up);
      document.removeEventListener("touchmove",move);
      document.removeEventListener("touchend",up);
      if(currentX>=max-8){onConfirm();setX(max);}else{setX(0);}
    };
    document.addEventListener("mousemove",move);
    document.addEventListener("mouseup",up);
    document.addEventListener("touchmove",move);
    document.addEventListener("touchend",up);
  };
  const progress=max>0?x/max:0;
  return(<div ref={trackRef} style={{width:"100%",height:64,borderRadius:999,background:"rgba(255,255,255,0.04)",border:`1px solid rgba(255,255,255,0.08)`,position:"relative",overflow:"hidden",opacity:disabled?0.5:1}}>
    {/* Track fill — orange shade that grows as knob moves */}
    <div style={{position:"absolute",top:0,bottom:0,left:0,width:x+KNOB/2,background:`linear-gradient(90deg,${C.orange}00 0%,${C.orange}40 80%,${C.orange}60 100%)`,transition:dragging?"none":"width 0.3s ease",pointerEvents:"none"}}/>
    {/* Label */}
    <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14.5,fontWeight:600,letterSpacing:"0.01em",color:"rgba(255,255,255,0.7)",opacity:1-progress*1.2,pointerEvents:"none",fontFamily:FN.body}}>Slide to confirm & sign</div>
    {/* Knob */}
    <div onMouseDown={e=>start(e.clientX)} onTouchStart={e=>start(e.touches[0].clientX)} style={{position:"absolute",top:3,left:3,width:KNOB,height:58,borderRadius:999,background:`linear-gradient(180deg,${C.orange} 0%,${C.orangeDark} 100%)`,boxShadow:`0 8px 24px -4px ${C.orange}80, inset 0 1px 0 rgba(255,255,255,0.35)`,display:"flex",alignItems:"center",justifyContent:"center",cursor:disabled?"not-allowed":"grab",transform:`translateX(${x}px)`,transition:dragging?"none":"transform 0.3s cubic-bezier(0.5,1.4,0.4,1)",touchAction:"none"}}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M8 5l7 7-7 7" stroke="#1a1410" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M3 5l7 7-7 7" stroke="#1a1410" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.35"/>
      </svg>
    </div>
  </div>);
}

/* ═══ SVG Icons ═══ */
const I={
  home:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  send:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>,
  recv:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="17" y1="7" x2="7" y2="17"/><polyline points="17 17 7 17 7 7"/></svg>,
  more:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/></svg>,
  copy:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  chk:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  search:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  cam:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="8" x2="13" y2="8"/><line x1="7" y1="16" x2="15" y2="16"/></svg>,
  ref:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  eye:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  eyeOff:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  dl:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  tag:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  freeze:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20"/></svg>,
  ext:<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  trash:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  lock:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  unlock:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>,
  utxo:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>,
  vault:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  whale:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18c0 0 1-6 6-6c2 0 3.5 1 5 1c3 0 5-2 7-5"/><path d="M21 7c0 0-1 3-4 3c-1.5 0-3-1-5-1c-4 0-6 3-7 5"/><circle cx="7" cy="14" r="1" fill="currentColor" stroke="none"/><path d="M19 13c1 2 2 5 1 7"/></svg>,
  book:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  gear:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.26.46.4 1 .42 1.51V11a2 2 0 0 1 0 4h-.09"/></svg>,
  moon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  sun:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  backup:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  bell:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  globe:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  finger:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 10V4a2 2 0 1 1 4 0v6"/><path d="M8 10V6a2 2 0 1 1 4 0"/><path d="M16 10v-2a2 2 0 1 1 4 0v8a8 8 0 0 1-16 0V8a2 2 0 1 1 4 0"/></svg>,
  install:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>,
  upload:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  compass:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>,
  news:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><line x1="10" y1="6" x2="18" y2="6"/><line x1="10" y1="10" x2="18" y2="10"/><line x1="10" y1="14" x2="14" y2="14"/></svg>,
  plus:<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  zap:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/><path d="M13 2L12 10" strokeWidth="2.2"/></svg>,
  bookOpen:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
  barChart:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  layers:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2" fill="currentColor" opacity="0.08"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/><polygon points="12 2 2 7 12 12 22 7 12 2"/></svg>,
  searchLg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  clock:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  arrowLeft:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  walletAdd:<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><circle cx="18" cy="12" r="0.5" fill="currentColor"/></svg>,
  importW:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg>,
  transfer:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="17 1 21 5 17 9"/><line x1="3" y1="5" x2="21" y2="5"/><polyline points="7 23 3 19 7 15"/><line x1="21" y1="19" x2="3" y2="19"/></svg>,
  radar:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6" opacity="0.6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4"/><circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" opacity="0.4"/><path d="M12 12l5-5" strokeWidth="1.2" opacity="0.5"/></svg>,
  activity:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l4-4 3 3 4-6 4 4h3"/><path d="M18 14l3-3"/><circle cx="21" cy="11" r="1.5" fill="currentColor" stroke="none" opacity="0.5"/><line x1="3" y1="21" x2="21" y2="21" strokeWidth="1" opacity="0.3"/></svg>,
  halfCircle:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3c5 0 9 4 9 9s-4 9-9 9" fill="currentColor" opacity="0.12" stroke="none"/><path d="M12 7v5l3.5 3.5"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>,
  cube:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l9 5v10l-9 5-9-5V7l9-5z"/><path d="M12 22V12"/><path d="M21 7l-9 5-9-5"/><path d="M12 2l9 5" strokeWidth="2.2"/><path d="M3 7l9 5" opacity="0.5"/></svg>,
  pickaxe:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 21l9-9"/><path d="M14 12l2-2c3-3 6-3.5 6-3.5s-.5 3-3.5 6l-2 2"/><path d="M14.5 9.5L18 6l-3-3"/><circle cx="6" cy="20" r="1" fill="currentColor" stroke="none" opacity="0.4"/></svg>,
  hourglass:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2h12"/><path d="M6 22h12"/><path d="M7 2v4c0 2.5 2 4.5 4 5.5V12"/><path d="M17 2v4c0 2.5-2 4.5-4 5.5V12"/><path d="M7 22v-4c0-2.5 2-4.5 4-5.5V12"/><path d="M17 22v-4c0-2.5-2-4.5-4-5.5V12"/><path d="M10 18h4" opacity="0.4"/><path d="M9 19h6" opacity="0.3"/></svg>,
  shield:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  sliders:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>,
};

/* ═══ Utility ═══ */
const getInitialTheme=()=>{try{return localStorage.getItem("btc_theme")||"dark"}catch{return"dark"}};
function debounce(fn,d){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),d)};}

/* ═══ BTC Unit definitions (outside component — stable reference) ═══ */
const BTC_UNITS=[
  {id:"btc",name:"Bitcoin",symbol:"BTC",symbolAlt:"₿",factor:1,decimals:8,desc:"1 BTC"},
  {id:"mbtc",name:"Millibit",symbol:"mBTC",symbolAlt:"m₿",factor:1e3,decimals:5,desc:"0.001 BTC"},
  {id:"bits",name:"Bit",symbol:"bits",symbolAlt:"μ₿",factor:1e6,decimals:2,desc:"0.000 001 BTC"},
  {id:"sats",name:"Satoshi",symbol:"sats",symbolAlt:"sat",factor:1e8,decimals:0,desc:"0.000 000 01 BTC"},
];

/* ═══ Fiat Currency definitions (outside component — stable reference) ═══ */
const FIAT_CURRENCIES=[
  {code:"usd",name:"US Dollar",symbol:"$",flag:"🇺🇸"},
  {code:"eur",name:"Euro",symbol:"€",flag:"🇪🇺"},
  {code:"gbp",name:"British Pound",symbol:"£",flag:"🇬🇧"},
  {code:"jpy",name:"Japanese Yen",symbol:"¥",flag:"🇯🇵"},
  {code:"cad",name:"Canadian Dollar",symbol:"CA$",flag:"🇨🇦"},
  {code:"aud",name:"Australian Dollar",symbol:"A$",flag:"🇦🇺"},
  {code:"chf",name:"Swiss Franc",symbol:"CHF",flag:"🇨🇭"},
  {code:"cny",name:"Chinese Yuan",symbol:"¥",flag:"🇨🇳"},
  {code:"inr",name:"Indian Rupee",symbol:"₹",flag:"🇮🇳"},
  {code:"brl",name:"Brazilian Real",symbol:"R$",flag:"🇧🇷"},
  {code:"rub",name:"Russian Ruble",symbol:"₽",flag:"🇷🇺"},
  {code:"krw",name:"South Korean Won",symbol:"₩",flag:"🇰🇷"},
  {code:"try",name:"Turkish Lira",symbol:"₺",flag:"🇹🇷"},
  {code:"aed",name:"UAE Dirham",symbol:"د.إ",flag:"🇦🇪"},
  {code:"sar",name:"Saudi Riyal",symbol:"﷼",flag:"🇸🇦"},
  {code:"ngn",name:"Nigerian Naira",symbol:"₦",flag:"🇳🇬"},
  {code:"zar",name:"South African Rand",symbol:"R",flag:"🇿🇦"},
  {code:"mxn",name:"Mexican Peso",symbol:"MX$",flag:"🇲🇽"},
  {code:"sgd",name:"Singapore Dollar",symbol:"S$",flag:"🇸🇬"},
  {code:"hkd",name:"Hong Kong Dollar",symbol:"HK$",flag:"🇭🇰"},
];

/* ═══════════════════════════════════════════════════════════
   MAIN WALLET COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function Wallet({
  address,walletName,wallets,activeWalletId,activeWallet,hasPIN,
  onDisconnect,onDeleteWallet,onSwitchWallet,onRenameWallet,onSetPIN,onRemovePIN,onSetDuress,onRemoveDuress,onAddWallet,onImportWallet,onWatchWallet,onChangeAddressType,onGenerateAddress,onSetDefaultAddress,onLabelAddress,isWatchOnly,walletKeyData,
}){
  const testnet=false;
  // All wallet addresses for tx value calculation (multi-address support)
  const myAddrs=useMemo(()=>{const s=new Set([address]);(activeWallet?.addresses||[]).forEach(a=>s.add(a.address));return s;},[address,activeWallet]);
  const isMyAddr=(a)=>myAddrs.has(a);
  useEffect(()=>{injectCSS();
    // Hide native splash screen immediately when WebView renders (Capacitor)
    if(window.Capacitor?.isNativePlatform?.()){
      try{const p=window.Capacitor.Plugins;if(p?.SplashScreen)p.SplashScreen.hide().catch(()=>{});}catch{}
    }
  },[]);
  const [theme,setTheme]=useState(getInitialTheme);
  const C=THEMES[theme];
  const toggleTheme=()=>{const t=theme==="dark"?"light":"dark";setTheme(t);localStorage.setItem("btc_theme",t);};

  // Core state
  const [balance,setBalance]=useState({total:0,confirmed:0,unconfirmed:0,totalSats:0});
  const [fiatCurrency,setFiatCurrency]=useState(()=>{try{return localStorage.getItem("btc_fiat")||"usd"}catch{return"usd"}});
  const curFiat=FIAT_CURRENCIES.find(c=>c.code===fiatCurrency)||FIAT_CURRENCIES[0];
  const fmtFiat=(v)=>formatCurrency(v,fiatCurrency);
  const [price,setPrice]=useState({fiat:0,change24h:0,currency:"usd"});
  const [transactions,setTransactions]=useState([]);
  const [priceHistory,setPriceHistory]=useState([]);
  const [fees,setFees]=useState(null);
  const [utxos,setUtxos]=useState([]);
  const [loading,setLoading]=useState(true);
  const [isRefreshing,setIsRefreshing]=useState(false);
  const [pullDist,setPullDist]=useState(0);
  const [isPulling,setIsPulling]=useState(false);
  const pullStartY=useRef(0);
  const pullActive=useRef(false);
  const [error,setError]=useState("");
  const [stealthMode,setStealth]=useState(false);
  const [copied,setCopied]=useState(false);
  const [activeTab,setActiveTab]=useState("home");

  // Feature state
  const [txDetail,setTxDetail]=useState(null);
  const [showAllTx,setShowAllTx]=useState(false);
  const [txVisible,setTxVisible]=useState(20);
  const [fabOpen,setFabOpen]=useState(false);
  const [showWalletPicker,setShowWalletPicker]=useState(false);
  const [confirmModal,setConfirmModal]=useState(null);
  const [walletPickerMode,setWalletPickerMode]=useState("list"); // "list" | "add"
  const [walletMenuOpen,setWalletMenuOpen]=useState(null); // wallet id or null
  const [showRenameModal,setShowRenameModal]=useState(null); // {walletId, currentName}
  const [showDeleteModal,setShowDeleteModal]=useState(null); // {walletId, name, watchOnly}
  const [deleteConfirmed,setDeleteConfirmed]=useState(false);
  const [renameInput,setRenameInput]=useState("");
  const [chartMode,setChartMode]=useState("price");
  const [chartDays,setChartDays]=useState(90);
  const chartDaysRef=useRef(90);useEffect(()=>{chartDaysRef.current=chartDays;},[chartDays]);
  const [txSearch,setTxSearch]=useState("");
  const [txFilter,setTxFilter]=useState("all");
  const [moreSection,setMoreSection]=useState(null);
  const [vaultStep,setVaultStep]=useState("list");
  const [selectedVaultIndex,setSelectedVaultIndex]=useState(null);const [createdVault,setCreatedVault]=useState(null);
  const [features,setFeatures]=useState({vaultEnabled:true});
  const [addressBook,setAddressBook]=useState(()=>{try{
    const raw=JSON.parse(localStorage.getItem("btc_address_book")||"[]");
    // One-time migration: dedupe by address (keep first occurrence)
    const seen=new Set();const cleaned=[];
    for(const e of raw){if(!e?.address||seen.has(e.address))continue;seen.add(e.address);cleaned.push(e);}
    if(cleaned.length!==raw.length){localStorage.setItem("btc_address_book",JSON.stringify(cleaned));}
    return cleaned;
  }catch{return[]}});
  const [txLabels,setTxLabels]=useState(()=>{try{return JSON.parse(localStorage.getItem("btc_tx_labels")||"{}")}catch{return{}}});
  // NEW: UTXO Labels & Freeze
  const [utxoLabels,setUtxoLabels]=useState(()=>{try{return JSON.parse(localStorage.getItem("btc_utxo_labels")||"{}")}catch{return{}}});
  const [frozenUTXOs,setFrozenUTXOs]=useState(()=>{try{return JSON.parse(localStorage.getItem("btc_frozen_utxos")||"[]")}catch{return[]}});

  // NEW: Feature states (PWA, Backup, Notifications, Biometric, i18n)
  const [lang,setLang]=useState(getLanguage);
  const [notifPerm,setNotifPerm]=useState(getNotifPerm);
  const [showNotifBanner,setShowNotifBanner]=useState(false);
  const [notifSettings,setNotifSettingsState]=useState(getNotifySettings);
  const [bioAvailable,setBioAvailable]=useState(false);
  const [bioRegistered,setBioRegistered]=useState(isBiometricRegistered);
  const [bioForce,setBioForce]=useState(0);
  const [deferredInstall,setDeferredInstall]=useState(null);
  const [backupBusy,setBackupBusy]=useState(false);
  const [backupMsg,setBackupMsg]=useState("");
  const fileInputRef=useRef(null);

  // Transfer & Radar state
  const [transferMode,setTransferMode]=useState("receive");
  const [radarSection,setRadarSection]=useState(null);

  // Add Wallet
  const [showAddWallet,setShowAddWallet]=useState(false);

  // Send state (hoisted to prevent reset on parent re-render)
  const [sendStep,setSendStep]=useState(1);
  const [sendRecipient,setSendRecipient]=useState("");
  const [sendAmountBTC,setSendAmountBTC]=useState("");const [sendAmountUSD,setSendAmountUSD]=useState("");
  const [sendInputMode,setSendInputMode]=useState("btc");
  const [sendFeeLevel,setSendFeeLevel]=useState("standard");const [sendCustomFeeRate,setSendCustomFeeRate]=useState("");
  const [sendEnableRBF,setSendEnableRBF]=useState(true);
  const [sendError,setSendError]=useState("");
  const [sendTxResult,setSendTxResult]=useState(null);const [sendBroadcasting,setSendBroadcasting]=useState(false);
  const [sendShowAddrBook,setSendShowAddrBook]=useState(false);const [sendShowScanner,setSendShowScanner]=useState(false);
  const [sendShowKeypad,setSendShowKeypad]=useState(false);
  const [sendShowRecents,setSendShowRecents]=useState(false);
  const [sendMemo,setSendMemo]=useState("");
  const [sendDragPct,setSendDragPct]=useState(null); // null when not dragging, 0-100 while dragging
  const sendResetForm=()=>{setSendStep(1);setSendRecipient("");setSendAmountBTC("");setSendAmountUSD("");setSendError("");setSendTxResult(null);setSendBroadcasting(false);setSendShowAddrBook(false);setSendShowScanner(false);};

  // Session 12: Holder features
  const [btcUnit,setBtcUnit]=useState(()=>{try{return localStorage.getItem("btc_unit")||"btc"}catch{return"btc"}});
  const curUnit=BTC_UNITS.find(u=>u.id===btcUnit)||BTC_UNITS[0];
  const [apiStatus,setApiStatus]=useState("ok"); // "ok" | "slow" | "error"
  const [priceAlerts,setPriceAlerts]=useState(()=>{try{return JSON.parse(localStorage.getItem("btc_price_alerts")||"[]")}catch{return[]}});
  const [showAddAlert,setShowAddAlert]=useState(false);
  const [alertDir,setAlertDir]=useState("above");
  const [alertTarget,setAlertTarget]=useState("");
  const [alertMode,setAlertMode]=useState("once");       // "once" | "recurring"
  const [alertType,setAlertType]=useState("price");       // "price" | "percent"
  const [alertWindow,setAlertWindow]=useState("none");   // "none" | "1h" | "4h" | "24h" | "7d"
  const MAX_ALERTS=10;
  const [toast,setToast]=useState(null);
  const [watchInput,setWatchInput]=useState("");
  const [showWatchInput,setShowWatchInput]=useState(false);
  const [marketData,setMarketData]=useState(null);

  // ── Hoisted: ChartCanvas hooks ──
  const canvasRef=useRef(null);
  const [chartTip,setChartTip]=useState(null);

  // ── Hoisted: ReceiveTab hooks ──
  const [qrUrl,setQrUrl]=useState("");
  const [reqAmt,setReqAmt]=useState("");
  const [rcCopied,setRcCopied]=useState(false);
  const [rcGenSuccess,setRcGenSuccess]=useState(false);
  const [showAddrManager,setShowAddrManager]=useState(false);
  const [editLblAddr,setEditLblAddr]=useState(null);
  const [editLblVal,setEditLblVal]=useState("");
  const [rcShowAmt,setRcShowAmt]=useState(false);
  const [rcAmtUnit,setRcAmtUnit]=useState(()=>{try{const u=localStorage.getItem("btc_unit")||"btc";const f=BTC_UNITS.find(x=>x.id===u);return f?f.symbol:"BTC"}catch{return"BTC"}});
  const [rcAmtRaw,setRcAmtRaw]=useState("");

  // ── Hoisted: TxDetailView hooks ──
  const [tdLbl,setTdLbl]=useState("");
  const [tdEditLbl,setTdEditLbl]=useState(false);
  const [tdRbfRate,setTdRbfRate]=useState("");
  const [tdRbfing,setTdRbfing]=useState(false);
  const [tdRbfErr,setTdRbfErr]=useState("");
  const [tdRbfResult,setTdRbfResult]=useState(null);
  const [tdShowRbf,setTdShowRbf]=useState(false);

  // ── Hoisted: RadarTab hooks ──
  const [rMempoolStats,setRMempoolStats]=useState(null);
  const [rFearGreed,setRFearGreed]=useState(null);
  const [rMarketData,setRMarketData]=useState(null);
  const [rLoading,setRLoading]=useState(true);
  const [rWhalePreview,setRWhalePreview]=useState(null);
  const [whaleThreshold,setWhaleThreshold]=useState(()=>{try{return localStorage.getItem("btc_whale_thresh")||"100"}catch{return"100"}});
  const [whales,setWhales]=useState([]);
  const [whaleLoading,setWhaleLoading]=useState(true);
  const [rDiffAdj,setRDiffAdj]=useState(null);
  const [rRecentBlocks,setRRecentBlocks]=useState(null);
  const [rMiningPools,setRMiningPools]=useState(null);
  const [miningPeriod,setMiningPeriod]=useState("1w");

  // ── Hoisted: MoreTab hooks ──
  // UTXO section
  const [editU,setEditU]=useState(null);
  const [editV,setEditV]=useState("");
  // Vault section
  const [vaults,setVaults]=useState([]);
  const [vaultDays,setVaultDays]=useState("30");
  const [vaultAmt,setVaultAmt]=useState("");
  const [vaultErr,setVaultErr]=useState("");
  const [vaultBusy,setVaultBusy]=useState(false);
  const [spendErr,setSpendErr]=useState("");
  const [spendBusy,setSpendBusy]=useState(false);
  // Vault custom duration
  const [vaultUseCustom,setVaultUseCustom]=useState(false);
  const [vaultCustomVal,setVaultCustomVal]=useState("");
  const [vaultDurType,setVaultDurType]=useState("days"); // "days"|"months"|"years"
  const [showVaultInfo,setShowVaultInfo]=useState(true);
  const [vaultFaqOpen,setVaultFaqOpen]=useState(null);
  const [showVaultFaq,setShowVaultFaq]=useState(false);
  const [vaultConfirm,setVaultConfirm]=useState(false);
  const [vaultShowPopup,setVaultShowPopup]=useState(false);
  const [vaultName,setVaultName]=useState("");
  // Address Book section
  const [newName,setNewName]=useState("");
  const [newAddr,setNewAddr]=useState("");
  const [abErr,setAbErr]=useState("");
  const [showAbForm,setShowAbForm]=useState(false);
  const [abSearch,setAbSearch]=useState("");
  const [abCopiedIdx,setAbCopiedIdx]=useState(null);
  const [abEditIdx,setAbEditIdx]=useState(null); // null = adding, number = editing that index
  const [sendBookSearch,setSendBookSearch]=useState(""); // inline search for Send screen's book dropdown
  // Recovery section
  const [rcAuth,setRcAuth]=useState(false);
  const [rcPin,setRcPin]=useState("");
  const [rcErr,setRcErr]=useState("");
  const [rcPhraseCopied,setRcPhraseCopied]=useState(false);
  // Backup section
  const [bkPass,setBkPass]=useState("");
  const [bkPass2,setBkPass2]=useState("");
  const [bkMode,setBkMode]=useState(null);
  const [bkImportPass,setBkImportPass]=useState("");
  const [bkFile,setBkFile]=useState(null);
  const [bkResult,setBkResult]=useState(null);
  // Biometric section
  const [bioLoading,setBioLoading]=useState(false);
  const [bioMsg,setBioMsg]=useState("");
  // PIN Lock section
  const [pinStep,setPinStep]=useState(hasPIN?"manage":"setup");
  const [pinVal,setPinVal]=useState("");
  const [pinFirst,setPinFirst]=useState("");
  const [pinMsg,setPinMsg]=useState("");
  const [duressWalletPick,setDuressWalletPick]=useState("");

  // Currency change handler
  const changeFiat=(code)=>{setFiatCurrency(code);try{localStorage.setItem("btc_fiat",code)}catch{};
    // Immediately re-fetch price in new currency
    getPrice(true,code).then(p=>setPrice(p)).catch(()=>{});
    getPriceHistory(chartDays==="max"?1825:chartDays,true,code).then(h=>{if(h&&h.length)setPriceHistory(h)}).catch(()=>{});
  };
  // Unit-aware formatting helpers
  const changeUnit=(id)=>{setBtcUnit(id);try{localStorage.setItem("btc_unit",id)}catch{};const u=BTC_UNITS.find(x=>x.id===id);if(u)setRcAmtUnit(u.symbol);};
  const fmtUnit=(btc)=>{const v=(btc||0)*curUnit.factor;return curUnit.decimals===0?Math.round(v).toLocaleString():v.toFixed(curUnit.decimals);};
  const fmtAmt=(btc)=>{if(stealthMode)return"••••••••";return fmtUnit(btc)+" "+curUnit.symbol;};
  const fmtAmtShort=(btc)=>{if(stealthMode)return"••••";return fmtUnit(btc);};
  const satsUnit=curUnit.symbol;

  // Persist price alerts
  useEffect(()=>{
    try{localStorage.setItem("btc_price_alerts",JSON.stringify(priceAlerts))}catch{}
    if(isPushSubscribed()){updatePushAlerts(priceAlerts,address,fiatCurrency).catch(()=>{});}
  },[priceAlerts]);

  // Toast auto-dismiss
  useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(null),2000);return()=>clearTimeout(t);}},[toast]);

  // Check biometric availability on mount
  useEffect(()=>{isPlatformAuthAvailable().then(setBioAvailable).catch(()=>{});},[]);

  // Biometric lock prompt on app open (if registered + active)
  const [bioLocked,setBioLocked]=useState(()=>isBiometricRegistered()&&localStorage.getItem("btc_bio_active")!=="0");
  useEffect(()=>{
    if(!bioLocked)return;
    authenticateBiometric().then(ok=>{if(ok)setBioLocked(false);}).catch(()=>{});
  },[]);

  // Check native push permission on mount and on app resume/focus
  useEffect(()=>{
    const recheckNativePerm=()=>{
      if(window.Capacitor?.isNativePlatform?.()){
        import("@capacitor/push-notifications").then(({PushNotifications})=>{
          PushNotifications.checkPermissions().then(r=>{
            if(r.receive==="granted") setNotifPerm("granted");
            else if(r.receive==="denied") setNotifPerm("denied");
            else setNotifPerm("default");
          }).catch(()=>{});
        }).catch(()=>{});
      }
    };
    recheckNativePerm();
    // Re-check on app resume (Capacitor) and window focus (web)
    let appListener;
    if(window.Capacitor?.isNativePlatform?.()){
      import("@capacitor/app").then(({App})=>{
        appListener=App.addListener("appStateChange",({isActive})=>{if(isActive)recheckNativePerm();});
      }).catch(()=>{});
    }
    const onFocus=()=>recheckNativePerm();
    window.addEventListener("focus",onFocus);
    return()=>{
      window.removeEventListener("focus",onFocus);
      if(appListener)appListener.then?.(l=>l?.remove?.());
    };
  },[]);

  // Listen for PWA install prompt (also check if captured before mount)
  useEffect(()=>{
    if(window._bit21InstallPrompt){setDeferredInstall(window._bit21InstallPrompt);}
    const handler=(e)=>{e.preventDefault();setDeferredInstall(e);window._bit21InstallPrompt=e;};
    window.addEventListener("beforeinstallprompt",handler);
    return()=>window.removeEventListener("beforeinstallprompt",handler);
  },[]);

  // Start/stop notification polling when settings change
  useEffect(()=>{
    if(notifSettings.incoming!==false&&notifPerm==="granted"){startBalancePoll(address);}
    else{stopBalancePoll();}
    return()=>stopBalancePoll();
  },[notifSettings.incoming,notifPerm,address]);

  // Send heartbeat on app open (tracks engagement for smart notifications)
  useEffect(()=>{
    sendHeartbeat();
    // Initialize native push notifications (Capacitor/Android/iOS)
    if (isNativeApp()) {
      initNativePush().then(ok => {
        if(ok){setNotifPerm("granted");sendNativeHeartbeat();}
        else{
          // Show daily in-app banner if notifications not enabled
          const lastPrompt=localStorage.getItem("btc_notif_prompt_at");
          const dayMs=24*60*60*1000;
          if(!lastPrompt||Date.now()-Number(lastPrompt)>dayMs){
            setTimeout(()=>setShowNotifBanner(true),3000); // Show after 3s delay
          }
          if(false){// placeholder to keep code structure
            import("@capacitor/push-notifications").then(({PushNotifications})=>{
              PushNotifications.requestPermissions().then(r=>{
                if(r.receive==="granted"){
                  PushNotifications.register();
                  setNotifPerm("granted");
                  initNativePush().then(ok2=>ok2&&sendNativeHeartbeat());
                }else{
                  localStorage.setItem("btc_notif_denied_at",String(Date.now()));
                }
              }).catch(()=>{});
            }).catch(()=>{});
          }
        }
      });
      // Set status bar style for native app
      import("@capacitor/status-bar").then(({StatusBar,Style})=>{
        StatusBar.setOverlaysWebView({overlay:true}).catch(()=>{});
        StatusBar.setStyle({style:Style.Dark}).catch(()=>{});
        StatusBar.setBackgroundColor({color:"#08080A"}).catch(()=>{});
      }).catch(()=>{});
    }
  },[]);

  // Shared back handler — used by both Android native back + browser back
  const handleWalletBack = () => {
    if (confirmModal) { setConfirmModal(null); return true; }
    if (fabOpen) { setFabOpen(false); return true; }
    if (showWalletPicker) { setShowWalletPicker(false); return true; }
    if (txDetail) { setTxDetail(null); return true; }
    if (showAllTx) { setShowAllTx(false); setTxSearch(""); setTxFilter("all"); return true; }
    if (sendStep > 1) { setSendStep(1); return true; }
    if (radarSection) { setRadarSection(null); return true; }
    // More sub-screens: navigate to parent, not straight to More
    if (moreSection === "btcunit" || moreSection === "currency" || moreSection === "language" || moreSection === "addrtype" || moreSection === "terms" || moreSection === "privacy") { setMoreSection("settings"); return true; }
    if (showAddrManager) { setShowAddrManager(false); return true; }
    if (moreSection === "recovery") { disableScreenSecurity(); setMoreSection("backup"); return true; }
    if (moreSection === "databackup") { setMoreSection("backup"); setBkMode(null); setBackupMsg(""); return true; }
    if (moreSection) { setMoreSection(null); return true; }
    // Don't go back from main tabs — do nothing on home/transfer/radar/more
    return false;
  };

  // Register global handler so App.jsx popstate can call it
  useEffect(() => {
    window._bit21WalletBack = handleWalletBack;
    return () => { delete window._bit21WalletBack; };
  });

  // Android hardware back button handler
  useNativeBack(handleWalletBack);

  // Helpers
  const saveAB=(name,addr)=>{const u=[...addressBook,{name,address:addr,createdAt:Date.now()}];setAddressBook(u);localStorage.setItem("btc_address_book",JSON.stringify(u));};
  const updateAB=(idx,name,addr)=>{const u=addressBook.map((e,i)=>i===idx?{...e,name,address:addr,updatedAt:Date.now()}:e);setAddressBook(u);localStorage.setItem("btc_address_book",JSON.stringify(u));};
  const removeAB=(idx)=>{const u=addressBook.filter((_,i)=>i!==idx);setAddressBook(u);localStorage.setItem("btc_address_book",JSON.stringify(u));};
  const setTxLbl=(txid,label)=>{const u={...txLabels,[txid]:label};if(!label)delete u[txid];setTxLabels(u);localStorage.setItem("btc_tx_labels",JSON.stringify(u));};
  const setUtxoLbl=(k,l)=>{const u={...utxoLabels,[k]:l};if(!l)delete u[k];setUtxoLabels(u);localStorage.setItem("btc_utxo_labels",JSON.stringify(u));};
  const toggleFreeze=(k)=>{const u=frozenUTXOs.includes(k)?frozenUTXOs.filter(x=>x!==k):[...frozenUTXOs,k];setFrozenUTXOs(u);localStorage.setItem("btc_frozen_utxos",JSON.stringify(u));};

  // CSV Export
  const exportCSV=()=>{
    const h=`Date,Type,Amount (${curUnit.symbol}),Amount (${curFiat.code.toUpperCase()}),Fee (${curUnit.symbol}),TXID,Status\n`;
    const r=transactions.map(tx=>{
      const s=tx.vin?.some(v=>isMyAddr(v.prevout?.scriptpubkey_address));
      const a=s?tx.vout?.filter(v=>!isMyAddr(v.scriptpubkey_address)).reduce((s,v)=>s+v.value,0)/1e8:tx.vout?.filter(v=>isMyAddr(v.scriptpubkey_address)).reduce((s,v)=>s+v.value,0)/1e8;
      const d=tx.status?.block_time?new Date(tx.status.block_time*1000).toISOString():"Pending";
      return `${d},${s?"Sent":"Received"},${fmtUnit(s?-a:a)},${fmtFiat(a*price.fiat)},${fmtUnit((tx.fee||0)/1e8)},${tx.txid},${tx.status?.confirmed?"Confirmed":"Pending"}`;
    }).join("\n");
    const b=new Blob([h+r],{type:"text/csv"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=`bit21-txs-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(u);
  };

  // Data fetching (stale-while-revalidate)
  const loadCache=useCallback(()=>{try{const c=JSON.parse(localStorage.getItem(`btc_cache_${address}_${testnet}`));if(c&&Date.now()-c.ts<300000){if(c.balance)setBalance(c.balance);if(c.price)setPrice(c.price);if(c.transactions)setTransactions(c.transactions);if(c.priceHistory)setPriceHistory(c.priceHistory);if(c.fees)setFees(c.fees);if(c.utxos)setUtxos(c.utxos);return true;}}catch{}return false;},[address,testnet]);
  const saveCache=useCallback((b,p,t,h,f,u)=>{try{localStorage.setItem(`btc_cache_${address}_${testnet}`,JSON.stringify({ts:Date.now(),balance:b,price:p,transactions:t,priceHistory:h,fees:f,utxos:u}));}catch{}},[address,testnet]);

  // Use refs for current state values to break circular dependency in fetchData
  const balRef=useRef(balance);const priceRef=useRef(price);const txRef=useRef(transactions);
  const histRef=useRef(priceHistory);const feeRef=useRef(fees);const utxoRef=useRef(utxos);
  const alertsRef=useRef(priceAlerts);const fiatRef=useRef(fiatCurrency);
  useEffect(()=>{balRef.current=balance},[balance]);
  useEffect(()=>{priceRef.current=price},[price]);
  useEffect(()=>{txRef.current=transactions},[transactions]);
  useEffect(()=>{histRef.current=priceHistory},[priceHistory]);
  useEffect(()=>{feeRef.current=fees},[fees]);
  useEffect(()=>{utxoRef.current=utxos},[utxos]);
  useEffect(()=>{alertsRef.current=priceAlerts},[priceAlerts]);

  useEffect(()=>{fiatRef.current=fiatCurrency},[fiatCurrency]);

  const fetchData=useCallback(async(force=false)=>{
    const hasCached=!force&&loadCache();
    if(!hasCached)setLoading(true);else setIsRefreshing(true);
    setError("");
    try{
      const sk=force;const t0=Date.now();
      const cur=fiatRef.current;
      // Gather all addresses of current type for multi-address aggregation
      const allTypeAddrs=(activeWallet?.addresses||[]).filter(a=>a.type===(activeWallet?.addressType||"NATIVE_SEGWIT")).map(a=>a.address);
      const extraAddrs=allTypeAddrs.filter(a=>a!==address);

      const cd=chartDaysRef.current;const histDays=cd==="max"?1825:cd;
      const [bal,prc,txs,hist,fee,utx]=await Promise.allSettled([getBalance(address,testnet,sk),getPrice(sk,cur),getTransactions(address,testnet,sk),getPriceHistory(histDays,sk,cur),getFees(testnet,sk),getUTXOs(address,testnet,sk)]);
      const elapsed=Date.now()-t0;
      let nB=bal.status==="fulfilled"?bal.value:balRef.current;
      const nP=prc.status==="fulfilled"?prc.value:priceRef.current;
      let nT=txs.status==="fulfilled"?txs.value.slice(0,20):txRef.current;
      const nH=hist.status==="fulfilled"?hist.value:histRef.current;
      const nF=fee.status==="fulfilled"?fee.value:feeRef.current;
      let nU=utx.status==="fulfilled"?(utx.value||[]).map(u=>({...u,sourceAddress:address})):utxoRef.current;

      // Fetch extra addresses (sequential to avoid rate limiting)
      if(extraAddrs.length>0){
        for(const ea of extraAddrs){
          try{
            await new Promise(r=>setTimeout(r,200));
            const [eBal,eTxs,eUtx]=await Promise.allSettled([getBalance(ea,testnet,sk),getTransactions(ea,testnet,sk),getUTXOs(ea,testnet,sk)]);
            if(eBal.status==="fulfilled"&&eBal.value){nB={...nB,total:(nB.total||0)+(eBal.value.total||0),confirmed:(nB.confirmed||0)+(eBal.value.confirmed||0),unconfirmed:(nB.unconfirmed||0)+(eBal.value.unconfirmed||0)};}
            if(eTxs.status==="fulfilled"&&eTxs.value){const existingIds=new Set(nT.map(t=>t.txid));const newTxs=eTxs.value.filter(t=>!existingIds.has(t.txid));nT=[...nT,...newTxs].sort((a,b)=>(b.status?.block_time||Infinity)-(a.status?.block_time||Infinity)).slice(0,30);}
            if(eUtx.status==="fulfilled"&&eUtx.value){nU=[...nU,...eUtx.value.map(u=>({...u,sourceAddress:ea}))];}
          }catch{}
        }
      }

      if(bal.status==="fulfilled"||extraAddrs.length>0)setBalance(nB);if(prc.status==="fulfilled")setPrice(nP);
      if(txs.status==="fulfilled"||extraAddrs.length>0)setTransactions(nT);if(hist.status==="fulfilled")setPriceHistory(nH);
      if(fee.status==="fulfilled")setFees(nF);if(utx.status==="fulfilled"||extraAddrs.length>0)setUtxos(nU);
      saveCache(nB,nP,nT,nH,nF,nU);
      if([bal,prc,txs,hist,fee].every(r=>r.status==="rejected")){setError(t("unableToConnect"));setApiStatus("error");}
      else if(elapsed>3000)setApiStatus("slow");
      else setApiStatus("ok");
      // Price alerts check (with cooldown)
      if(prc.status==="fulfilled"&&nP.fiat){
        const COOLDOWN=3600000;
        let alertsChanged=false;
        const updated=alertsRef.current.map(a=>{
          if(!a.enabled)return a;if((a.currency||"usd")!==fiatRef.current)return a;
          if(a.lastTriggered&&Date.now()-a.lastTriggered<COOLDOWN)return a;
          let triggered=false;let updated=a;
          if(a.type==="percent"){
            const base=a.baselinePrice||a.createdAtPrice;if(!base)return a;
            // Check if rolling window expired → reset baseline
            const wMap={"1h":3600000,"4h":14400000,"24h":86400000,"7d":604800000};
            const wMs=wMap[a.window];
            if(wMs&&a.baselineAt&&Date.now()-a.baselineAt>=wMs){
              updated={...a,baselinePrice:nP.fiat,baselineAt:Date.now()};
            }
            const bp=updated.baselinePrice||updated.createdAtPrice;
            const chg=((nP.fiat-bp)/bp)*100;
            triggered=(a.direction==="above"&&chg>=a.target)||(a.direction==="below"&&chg<=-a.target);
          }else{
            triggered=(a.direction==="above"&&nP.fiat>=a.target)||(a.direction==="below"&&nP.fiat<=a.target);
          }
          if(triggered){
            const label=a.type==="percent"?`${a.direction==="above"?"up":"down"} ${a.target}%`:`${a.direction} ${formatCurrency(a.target,fiatRef.current)}`;
            setToast({msg:`🚨 BTC ${label}!`,sub:`Current: ${formatCurrency(nP.fiat,fiatRef.current)}`});
            try{if(typeof Notification!=="undefined"&&Notification.permission==="granted")new Notification(`🚨 Bitcoin ${label}!`,{body:`Current price: ${formatCurrency(nP.fiat,fiatRef.current)}`,icon:"/favicon.ico"});}catch(e){console.log("Notification error:",e);}
            alertsChanged=true;
            return{...updated,lastTriggered:Date.now(),triggerCount:(a.triggerCount||0)+1,enabled:a.mode==="once"?false:a.enabled,baselinePrice:nP.fiat,baselineAt:Date.now()};
          }
          if(updated!==a){alertsChanged=true;return updated;}
          return a;
        });
        if(alertsChanged){setPriceAlerts(updated);alertsRef.current=updated;}
      }
      try{const md=await getMarketData();setMarketData(md);}catch{}
    }catch(err){setError(getUserFriendlyError(err));setApiStatus("error");}
    setLoading(false);setIsRefreshing(false);
  },[address,testnet,loadCache,saveCache]);

  const debouncedRefresh=useMemo(()=>debounce(()=>fetchData(true),500),[fetchData]);

  // Pull-to-refresh handlers
  const PULL_THRESHOLD=70;
  const onTouchStart=useCallback((e)=>{
    if(isRefreshing)return;
    const el=e.currentTarget;
    if(el.scrollTop<=0){pullStartY.current=e.touches[0].clientY;pullActive.current=true;}
  },[isRefreshing]);
  const onTouchMove=useCallback((e)=>{
    if(!pullActive.current||isRefreshing)return;
    const dy=e.touches[0].clientY-pullStartY.current;
    if(dy>0){
      const dist=Math.min(dy*0.5,120);
      setPullDist(dist);setIsPulling(dist>=PULL_THRESHOLD);
      if(dy>10)e.preventDefault();
    }else{pullActive.current=false;setPullDist(0);setIsPulling(false);}
  },[isRefreshing]);
  const onTouchEnd=useCallback(()=>{
    if(!pullActive.current)return;
    pullActive.current=false;
    if(pullDist>=PULL_THRESHOLD&&!isRefreshing){fetchData(true);}
    setPullDist(0);setIsPulling(false);
  },[pullDist,isRefreshing,fetchData]);

  const addrCount=(activeWallet?.addresses||[]).length;
  useEffect(()=>{fetchData();},[address,testnet,addrCount]);
  useEffect(()=>{getFeatures().then(f=>setFeatures(f)).catch(()=>{});},[]);
  const [chartLoading,setChartLoading]=useState(false);
  // Chart timeframe change — debounce + abort + sequence guard. Robust under any click pattern.
  const chartAbortRef=useRef(null);
  const chartDebounceRef=useRef(null);
  const chartSeqRef=useRef(0);
  const handleChartDays=(d)=>{
    // Update UI state immediately — user sees the button flip
    chartDaysRef.current=d;
    setChartDays(d);
    setChartLoading(true);
    // Cancel pending debounced call so rapid clicks collapse to a single fetch
    if(chartDebounceRef.current){clearTimeout(chartDebounceRef.current);chartDebounceRef.current=null;}
    // Abort any already-in-flight request so its response can't overwrite new data
    if(chartAbortRef.current){try{chartAbortRef.current.abort()}catch{}chartAbortRef.current=null;}
    const seq=++chartSeqRef.current;
    // Debounce 180ms — avoids hammering backend during fast click-through
    chartDebounceRef.current=setTimeout(async()=>{
      chartDebounceRef.current=null;
      const ctrl=new AbortController();chartAbortRef.current=ctrl;
      const days=d==="max"?1825:d;
      const cur=fiatRef.current||"usd";
      try{
        const res=await fetch(`/api/price/history?days=${days}&currency=${cur}`,{signal:ctrl.signal});
        if(ctrl.signal.aborted||seq!==chartSeqRef.current)return;
        const data=await res.json();
        if(seq!==chartSeqRef.current)return; // another click happened between fetch+parse
        const h=(data?.prices||[]).map(([ts,price])=>({timestamp:ts,price}));
        if(h.length)setPriceHistory(h);
      }catch(err){
        if(err?.name==="AbortError")return;
      }finally{
        if(seq===chartSeqRef.current){setChartLoading(false);chartAbortRef.current=null;}
      }
    },180);
  };
  useEffect(()=>{const iv=setInterval(async()=>{try{const t0=Date.now();const p=await getPrice(false,fiatRef.current);setPrice(p);const el=Date.now()-t0;setApiStatus(el>3000?"slow":"ok");
    if(p.fiat){const COOLDOWN=3600000;let changed=false;const upd=alertsRef.current.map(a=>{
      if(!a.enabled)return a;if((a.currency||"usd")!==fiatRef.current)return a;
      if(a.lastTriggered&&Date.now()-a.lastTriggered<COOLDOWN)return a;
      let hit=false;let upA=a;
      if(a.type==="percent"){const base=a.baselinePrice||a.createdAtPrice;if(!base)return a;
        const wMap={"1h":3600000,"4h":14400000,"24h":86400000,"7d":604800000};const wMs=wMap[a.window];
        if(wMs&&a.baselineAt&&Date.now()-a.baselineAt>=wMs){upA={...a,baselinePrice:p.fiat,baselineAt:Date.now()};}
        const bp=upA.baselinePrice||upA.createdAtPrice;const chg=((p.fiat-bp)/bp)*100;
        hit=(a.direction==="above"&&chg>=a.target)||(a.direction==="below"&&chg<=-a.target);}
      else{hit=(a.direction==="above"&&p.fiat>=a.target)||(a.direction==="below"&&p.fiat<=a.target);}
      if(hit){
        const label=a.type==="percent"?`${a.direction==="above"?"up":"down"} ${a.target}%`:`${a.direction} ${formatCurrency(a.target,fiatRef.current)}`;
        setToast({msg:`🚨 BTC ${label}!`,sub:`Current: ${formatCurrency(p.fiat,fiatRef.current)}`});
        try{if(typeof Notification!=="undefined"&&Notification.permission==="granted")new Notification(`🚨 Bitcoin ${label}!`,{body:`Current price: ${formatCurrency(p.fiat,fiatRef.current)}`});}catch(e){console.log("Notification error:",e);}
        changed=true;return{...upA,lastTriggered:Date.now(),triggerCount:(a.triggerCount||0)+1,enabled:a.mode==="once"?false:a.enabled,baselinePrice:p.fiat,baselineAt:Date.now()};}
      if(upA!==a){changed=true;return upA;}
      return a;});
      if(changed){setPriceAlerts(upd);alertsRef.current=upd;}}
  }catch{setApiStatus("error");}},30000);return()=>clearInterval(iv);},[]);
  const [copyTarget,setCopyTarget]=useState("");
  const handleCopy=(text)=>{const val=text||address;if(navigator.clipboard?.writeText){navigator.clipboard.writeText(val);}else{const ta=document.createElement('textarea');ta.value=val;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);}setCopied(true);setCopyTarget(val);setTimeout(()=>{setCopied(false);setCopyTarget("");},2000);};
  const fiatValue=balance.total*price.fiat;

  // ── Hoisted: ReceiveTab QR useEffect ──
  useEffect(()=>{const uri=reqAmt?`bitcoin:${address}?amount=${reqAmt}`:address;QRCode.toDataURL(uri,{width:256,margin:2,color:{dark:"#F7931A",light:theme==="dark"?"#111115":"#FFFFFF"}}).then(setQrUrl).catch(()=>{});},[address,reqAmt,theme]);

  // ── Hoisted: ChartCanvas useMemo ──
  const chartData=useMemo(()=>chartMode==="portfolio"?priceHistory.map(p=>({...p,value:p.price*balance.total})):priceHistory.map(p=>({...p,value:p.price})),[priceHistory,chartMode,balance.total]);

  // ── Hoisted: ChartCanvas canvas useEffect ──
  useEffect(()=>{
    const cv=canvasRef.current;if(!cv||chartData.length<2)return;
    const ctx=cv.getContext("2d");const dpr=window.devicePixelRatio||1;const rect=cv.getBoundingClientRect();
    cv.width=rect.width*dpr;cv.height=rect.height*dpr;ctx.scale(dpr,dpr);
    const w=rect.width,h=rect.height,p={t:10,r:10,b:10,l:10};
    const vals=chartData.map(d=>d.value);const mn=Math.min(...vals),mx=Math.max(...vals),rng=mx-mn||1;
    const gx=i=>p.l+(i/(vals.length-1))*(w-p.l-p.r);const gy=v=>p.t+(1-(v-mn)/rng)*(h-p.t-p.b);
    const clr=chartMode==="portfolio"?C.green:C.orange;
    ctx.clearRect(0,0,w,h);
    // Area
    const grd=ctx.createLinearGradient(0,p.t,0,h);
    grd.addColorStop(0,chartMode==="portfolio"?"rgba(52,211,153,0.18)":"rgba(247,147,26,0.18)");grd.addColorStop(1,"transparent");
    ctx.beginPath();ctx.moveTo(gx(0),h);vals.forEach((v,i)=>ctx.lineTo(gx(i),gy(v)));ctx.lineTo(gx(vals.length-1),h);ctx.closePath();ctx.fillStyle=grd;ctx.fill();
    // Line
    ctx.beginPath();vals.forEach((v,i)=>i===0?ctx.moveTo(gx(i),gy(v)):ctx.lineTo(gx(i),gy(v)));ctx.strokeStyle=clr;ctx.lineWidth=2;ctx.lineJoin="round";ctx.lineCap="round";ctx.stroke();
    // Crosshair
    if(chartTip!==null&&chartTip>=0&&chartTip<vals.length){
      const x=gx(chartTip),y=gy(vals[chartTip]);
      ctx.beginPath();ctx.moveTo(x,p.t);ctx.lineTo(x,h-p.b);ctx.strokeStyle=clr+"40";ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.stroke();ctx.setLineDash([]);
      ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fillStyle=clr;ctx.fill();
      ctx.beginPath();ctx.arc(x,y,8,0,Math.PI*2);ctx.strokeStyle=clr+"50";ctx.lineWidth=2;ctx.stroke();
    }
  },[chartData,chartTip,C,activeTab]);

  // ── Hoisted: RadarTab data fetch useEffect ──
  useEffect(()=>{(async()=>{
    setRLoading(true);
    try{
      const [ms,fg,md,wp,da,rb,mp]=await Promise.allSettled([getMempoolStats(),getFearGreedIndex(),getMarketData(),getWhaleAlerts(100*1e8),getDifficultyAdjustment(),getRecentBlocks(),getMiningPools("1w")]);
      if(ms.status==="fulfilled")setRMempoolStats(ms.value);
      if(fg.status==="fulfilled")setRFearGreed(fg.value);
      if(md.status==="fulfilled")setRMarketData(md.value);
      if(wp.status==="fulfilled")setRWhalePreview(wp.value);
      if(da.status==="fulfilled")setRDiffAdj(da.value);
      if(rb.status==="fulfilled")setRRecentBlocks(rb.value);
      if(mp.status==="fulfilled")setRMiningPools(mp.value);
    }catch{}
    setRLoading(false);
  })();},[]);

  // ── Hoisted: RadarTab whale data fetch useEffect ──
  useEffect(()=>{(async()=>{setWhaleLoading(true);try{const w=await getWhaleAlerts(parseFloat(whaleThreshold)*1e8);setWhales((w.whales||w).slice(0,20));}catch{}setWhaleLoading(false);})();},[whaleThreshold]);

  // ── Register user / update lastSeen on wallet load ──

  // ── Hoisted: MoreTab vault load useEffect ──
  useEffect(()=>{try{const key=`btc_vaults_${activeWalletId}`;const data=localStorage.getItem(key)||localStorage.getItem("btc_vaults")||"[]";const parsed=JSON.parse(data);setVaults(parsed);
    // Verify vaults on-chain — remove any whose UTXO was spent
    if(parsed.length>0&&address){(async()=>{try{const alive=[];for(const v of parsed){const utxos=await getUTXOs(v.address,testnet,true).catch(()=>[]);const hasUtxo=utxos.some(u=>u.txid===v.txid&&(v.vout===undefined||u.vout===v.vout));if(hasUtxo)alive.push(v);}if(alive.length!==parsed.length){setVaults(alive);localStorage.setItem(`btc_vaults_${activeWalletId}`,JSON.stringify(alive));}}catch{}})();}
  }catch{}},[address]);

  // ── Hoisted: TxDetailView label init useEffect ──
  useEffect(()=>{setTdLbl(txLabels[txDetail?.txid]||"");setTdEditLbl(false);setTdRbfRate("");setTdRbfing(false);setTdRbfErr("");setTdRbfResult(null);setTdShowRbf(false);},[txDetail?.txid]);

  // ── Hoisted: PIN step sync with hasPIN prop ──
  useEffect(()=>{setPinStep(hasPIN?"manage":"setup");setPinVal("");setPinFirst("");setPinMsg("");},[hasPIN]);
  useEffect(()=>{if(pinMsg){const t=setTimeout(()=>setPinMsg(""),3000);return()=>clearTimeout(t);}},[pinMsg]);

  /* ═══ Interactive Chart with Tooltip (inline render, NOT component) ═══ */
  const renderChart=()=>{
    const onMove=e=>{const cv=canvasRef.current;if(!cv||chartData.length<2)return;const rect=cv.getBoundingClientRect();const x=e.clientX-rect.left;const idx=Math.round((x/rect.width)*(chartData.length-1));setChartTip(Math.max(0,Math.min(idx,chartData.length-1)));};
    const td=chartTip!==null&&chartData[chartTip];
    return(<div style={{position:"relative"}}>
      <canvas ref={canvasRef} onMouseMove={onMove} onMouseLeave={()=>setChartTip(null)} onTouchMove={e=>onMove(e.touches[0])} onTouchEnd={()=>setChartTip(null)} style={{width:"100%",height:160,display:"block",cursor:"crosshair"}}/>
      {td&&<div style={{position:"absolute",top:4,right:4,background:C.surface,borderRadius:RD.sm,padding:"6px 10px",border:`1px solid ${C.border}`,pointerEvents:"none",animation:"b21fi 0.15s ease"}}>
        <div style={{fontSize:13,fontWeight:700,color:C.white,fontFamily:FN.mono}}>{fmtFiat(td.value)}</div>
        {td.date&&<div style={{fontSize:10,color:C.gray}}>{new Date(td.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>}
      </div>}
    </div>);
  };

  /* ═══ Transaction Item (inline render helper, NOT component) ═══ */
  const renderTxItem=(tx,index=0)=>{
    const isSend=tx.vin?.some(v=>isMyAddr(v.prevout?.scriptpubkey_address));
    const amount=isSend?tx.vout?.filter(v=>!isMyAddr(v.scriptpubkey_address)).reduce((s,v)=>s+v.value,0)/1e8:tx.vout?.filter(v=>isMyAddr(v.scriptpubkey_address)).reduce((s,v)=>s+v.value,0)/1e8;
    const label=txLabels[tx.txid];const isPend=!tx.status?.confirmed;
    return(<div key={tx.txid||index} onClick={()=>setTxDetail(tx)} className="b21p" style={{display:"flex",alignItems:"center",gap:12,padding:"13px 0",borderBottom:`1px solid ${C.border}10`,cursor:"pointer",...stagger(index)}}>
      <div style={{width:42,height:42,borderRadius:21,display:"flex",alignItems:"center",justifyContent:"center",background:isSend?C.redGlow:C.greenGlow,color:isSend?C.red:C.green,position:"relative",flexShrink:0}}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">{isSend?<><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></>:<><line x1="17" y1="7" x2="7" y2="17"/><polyline points="17 17 7 17 7 7"/></>}</svg>
        {isPend&&<div style={{position:"absolute",top:-1,right:-1,width:8,height:8,borderRadius:4,background:C.yellow,border:`2px solid ${C.bg}`,animation:"b21gl 2s ease infinite"}}/>}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14,fontWeight:600,color:C.white}}>{isSend?t("sent",lang):t("received",lang)}{label&&<span style={{fontSize:10,color:C.grayLight,marginLeft:6}}>· {label}</span>}</div>
        <div style={{fontSize:11,color:C.gray,marginTop:2}}>{isPend?<span style={{color:C.yellow}}>{t("pending")}</span>:timeAgo(tx.status?.block_time)}</div>
      </div>
      <div style={{textAlign:"right",flexShrink:0}}>
        <div style={{fontSize:14,fontWeight:700,fontFamily:FN.mono,color:isSend?C.red:C.green}}>{isSend?"−":"+"}{fmtAmtShort(amount||0)}</div>
        <div style={{fontSize:11,color:C.gray,marginTop:2}}>{stealthMode?"••••":`≈ ${fmtFiat((amount||0)*price.fiat)}`}</div>
      </div>
    </div>);
  };

  /* ═══ Skeleton Loading ═══ */
  const HomeSkel=()=>(<div>
    <div style={{background:C.balanceGrad,borderRadius:RD.xl,padding:"24px 22px 20px",marginBottom:14,border:`1px solid ${C.border}`}}>
      <Skel w={80} h={10} C={C}/><div style={{marginTop:14}}><Skel w={180} h={30} C={C}/></div><div style={{marginTop:6}}><Skel w={100} h={14} C={C}/></div>
    </div>
    <div style={{display:"flex",justifyContent:"center",gap:40,marginBottom:14}}><div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}><Skel w={54} h={54} C={C}/><Skel w={50} h={10} C={C}/></div><div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}><Skel w={54} h={54} C={C}/><Skel w={36} h={10} C={C}/></div></div>
    <Skel h={210} C={C}/>
    <div style={{marginTop:14}}>{[0,1,2].map(i=><div key={i} style={{display:"flex",gap:12,alignItems:"center",padding:"13px 0"}}>
      <div style={{width:42,height:42,borderRadius:21,overflow:"hidden",flexShrink:0}}><Skel w={42} h={42} C={C}/></div><div style={{flex:1}}><Skel w={70} h={14} C={C}/><div style={{marginTop:5}}><Skel w={50} h={11} C={C}/></div></div>
      <div><Skel w={90} h={14} C={C}/><div style={{marginTop:4}}><Skel w={50} h={11} C={C}/></div></div>
    </div>)}</div>
  </div>);

  /* ═══ HOME TAB (inline render, NOT component) ═══ */
  const renderHomeTab=()=>{
    if(loading&&transactions.length===0)return <HomeSkel/>;
    return(<>
      {/* Notification Enable Popup */}
      {showNotifBanner&&notifPerm!=="granted"&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.7)",zIndex:99998,display:"flex",alignItems:"center",justifyContent:"center",padding:24,backdropFilter:"blur(4px)",animation:"notifFade 0.3s ease-out"}}>
          <div style={{background:C.surface,borderRadius:20,padding:"28px 24px 20px",maxWidth:320,width:"100%",textAlign:"center",border:`1px solid ${C.border}`,boxShadow:`0 20px 60px rgba(0,0,0,0.5)`,animation:"notifPop 0.3s ease-out"}}>
            <div style={{width:56,height:56,borderRadius:16,background:`${C.orange}15`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><circle cx="18" cy="4" r="3" fill={C.orange} stroke="none"/></svg>
            </div>
            <div style={{fontSize:18,fontWeight:800,color:C.white,marginBottom:6}}>Stay in the loop</div>
            <div style={{fontSize:13,color:C.gray,lineHeight:1.5,marginBottom:24}}>Get instant alerts when Bitcoin hits your price target. Never miss a move.</div>
            <button onClick={async()=>{
              localStorage.setItem("btc_notif_prompt_at",String(Date.now()));
              if(window.Capacitor?.isNativePlatform?.()){
                try{
                  const{PushNotifications}=await import("@capacitor/push-notifications");
                  const req=await PushNotifications.requestPermissions();
                  if(req.receive==="granted"){
                    await PushNotifications.register();
                    setNotifPerm("granted");
                    initNativePush().then(ok=>ok&&sendNativeHeartbeat());
                  }
                }catch{}
              }else{
                const p=await reqNotifPerm();setNotifPerm(p);
                if(p==="granted")subscribeToPush(priceAlerts,address,fiatCurrency).catch(()=>{});
              }
              setShowNotifBanner(false);
            }} style={{width:"100%",padding:"14px",borderRadius:14,border:"none",background:`linear-gradient(135deg,${C.orange},${C.orangeDark})`,color:C.bg,fontSize:15,fontWeight:800,cursor:"pointer",boxShadow:`0 8px 24px ${C.orange}30`,marginBottom:10}}>
              Enable Notifications
            </button>
            <button onClick={()=>{setShowNotifBanner(false);localStorage.setItem("btc_notif_prompt_at",String(Date.now()));}} style={{width:"100%",padding:"12px",borderRadius:12,border:"none",background:"transparent",color:C.gray,fontSize:13,fontWeight:600,cursor:"pointer"}}>
              Not now
            </button>
          </div>
        </div>
      )}
      <style>{`@keyframes notifFade{from{opacity:0}to{opacity:1}}@keyframes notifPop{from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}}`}</style>
      {/* Balance Card */}
      {(()=>{const pnl24=fiatValue*(price.change24h/100);const isUp=price.change24h>=0;const pnlColor=isUp?C.green:C.red;const pnlGlow=isUp?C.greenGlow:C.redGlow;return(
      <div style={{background:C.balanceGrad,borderRadius:RD.xl,padding:"24px 22px 22px",marginBottom:14,border:`1px solid ${C.border}40`,position:"relative",overflow:"hidden"}}>
        {/* Subtle glow */}
        <div style={{position:"absolute",top:-60,right:-60,width:160,height:160,borderRadius:80,background:`radial-gradient(circle,${C.orangeGlow} 0%,transparent 70%)`,pointerEvents:"none",opacity:0.5}}/>
        {/* Row 1: BTC price + watch badge */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:12,color:C.gray,fontFamily:FN.mono,fontWeight:600}}>BTC {stealthMode?"••••":fmtFiat(price.fiat)}</span>
            {price.change24h!==0&&<span style={{fontSize:10,fontWeight:700,color:pnlColor}}>{isUp?"▲":"▼"}{Math.abs(price.change24h).toFixed(1)}%</span>}
            {isRefreshing&&<Spin sz={9} color={C.orange}/>}
          </div>
          {isWatchOnly&&<Badge color={C.blue} bg={C.blueGlow||C.blue+"15"} style={{fontSize:9,padding:"2px 7px"}}>{t("watchOnly")}</Badge>}
        </div>
        {/* Row 2: BTC amount — hero */}
        <div style={{marginBottom:6}}>
          <span style={{fontSize:38,fontWeight:800,color:C.white,fontFamily:FN.mono,letterSpacing:"-0.03em",lineHeight:1}}>{stealthMode?"••••••••":fmtUnit(balance.total)}</span>
          <span style={{fontSize:14,color:C.orange,marginLeft:8,fontWeight:700,opacity:0.9}}>{satsUnit}</span>
        </div>
        {/* Row 3: Fiat value */}
        <div style={{fontSize:18,color:C.grayLight,fontFamily:FN.mono,fontWeight:600,marginBottom:14}}>{stealthMode?"••••••":fmtFiat(fiatValue)}</div>
        {/* Row 4: P&L + pending */}
        <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:20}}>
          {price.change24h!==0&&balance.total>0&&<div style={{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:RD.sm,background:pnlGlow,fontSize:11,fontWeight:700,color:pnlColor}}>
            {isUp?"+":" "}{stealthMode?"••••":fmtFiat(Math.abs(pnl24))} {t("todayLabel")}
          </div>}
          {balance.unconfirmed!==0&&<Badge color={C.yellow} bg={C.yellowGlow} style={{fontSize:10,padding:"3px 8px"}}>{balance.unconfirmed>0?"+":""}{fmtUnit(balance.unconfirmed)} {satsUnit} {t("pendingLabel")}</Badge>}
        </div>
        {/* Row 5: Receive / Send action buttons */}
        <div style={{display:"flex",justifyContent:"center",gap:isWatchOnly?0:40}}>
          <button onClick={()=>{setTransferMode("receive");setActiveTab("transfer");}} className="b21p" style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,background:"none",border:"none",cursor:"pointer",padding:0}}>
            <div style={{width:54,height:54,borderRadius:27,background:`linear-gradient(135deg,${C.orange},${C.orangeDark})`,boxShadow:`0 4px 20px ${C.orange}30`,display:"flex",alignItems:"center",justifyContent:"center",transition:"transform 0.15s, box-shadow 0.2s"}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="17" y1="7" x2="7" y2="17"/><polyline points="17 17 7 17 7 7"/></svg>
            </div>
            <span style={{fontSize:11,fontWeight:600,color:C.grayLight,fontFamily:FN.body,letterSpacing:"0.02em"}}>{t("receive")}</span>
          </button>
          {!isWatchOnly&&<button onClick={()=>{setTransferMode("send");setActiveTab("transfer");}} className="b21p" style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,background:"none",border:"none",cursor:"pointer",padding:0}}>
            <div style={{width:54,height:54,borderRadius:27,background:`linear-gradient(135deg,${C.surface},${C.surfaceHover})`,border:`1.5px solid ${C.border}`,boxShadow:`0 2px 12px rgba(0,0,0,0.2)`,display:"flex",alignItems:"center",justifyContent:"center",transition:"transform 0.15s, box-shadow 0.2s"}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.white} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
            </div>
            <span style={{fontSize:11,fontWeight:600,color:C.grayLight,fontFamily:FN.body,letterSpacing:"0.02em"}}>{t("send")}</span>
          </button>}
        </div>
      </div>);})()}

      {/* Chart */}
      <Crd C={C} pad="14px 16px" style={{marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{display:"flex",gap:2}}>{["price","portfolio"].map(m=><button key={m} onClick={()=>setChartMode(m)} className="b21p" style={{fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:RD.sm,background:chartMode===m?C.orangeMuted:"transparent",border:chartMode===m?`1px solid ${C.orange}30`:"1px solid transparent",color:chartMode===m?C.orange:C.gray,cursor:"pointer",fontFamily:FN.body,transition:"all 0.2s"}}>{m==="price"?`BTC/${curFiat.code.toUpperCase()}`:t("portfolio")}</button>)}</div>
          <span style={{fontSize:14,fontWeight:800,color:C.white,fontFamily:FN.mono,letterSpacing:"-0.01em"}}>{chartMode==="portfolio"?fmtFiat(fiatValue):fmtFiat(price.fiat)}</span>
        </div>
        <div style={{display:"flex",gap:2,marginBottom:10}}>
          {[{l:"1D",v:1},{l:"7D",v:7},{l:"30D",v:30},{l:"90D",v:90},{l:"1Y",v:365}].map(tf=><button key={tf.l} onClick={()=>handleChartDays(tf.v)} className="b21p" style={{flex:1,padding:"5px",borderRadius:RD.sm,border:"none",cursor:"pointer",background:chartDays===tf.v?C.orangeMuted:"transparent",color:chartDays===tf.v?C.orange:C.gray,fontSize:11,fontWeight:600,transition:"all 0.2s"}}>{tf.l}</button>)}
        </div>
        <div style={{opacity:chartLoading?0.3:1,transition:"opacity 0.25s ease"}}>{priceHistory.length>0?renderChart():(loading||chartLoading)&&<div style={{width:"100%",height:160,borderRadius:RD.md,background:`linear-gradient(90deg,${C.surface} 25%,${C.border} 50%,${C.surface} 75%)`,backgroundSize:"200% 100%",animation:"b21sh 1.8s ease infinite"}}/>}</div>
      </Crd>

      {/* Transactions — recent preview */}
      <div style={{marginBottom:24}}>
        <div onClick={()=>{if(transactions.length>0)setShowAllTx(true);}} className={transactions.length>0?"b21p":""} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,cursor:transactions.length>0?"pointer":"default"}}>
          <div style={{fontSize:13,fontWeight:700,color:C.white,display:"flex",alignItems:"center",gap:6}}>{t("transactions",lang)}{transactions.length>0&&<span style={{fontSize:10,color:C.gray,fontWeight:500}}>({transactions.length})</span>}</div>
          {transactions.length>0&&<div style={{display:"flex",alignItems:"center",gap:2,fontSize:12,color:C.orange,fontWeight:600}}>{t("viewAll")} <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18"/></svg></div>}
        </div>
        {transactions.length===0&&!loading?<div style={{background:C.cardGrad,borderRadius:RD.lg,padding:"36px 20px",textAlign:"center",border:`1px solid ${C.border}`}}>
          <div style={{position:"relative",width:64,height:64,margin:"0 auto 14px"}}>
            {[0,1,2].map(i=><div key={i} style={{position:"absolute",inset:0,borderRadius:"50%",border:`1px solid ${C.orange}${i===0?"25":"12"}`,animation:`b21pr ${2+i*0.5}s ease infinite`,animationDelay:`${i*0.4}s`}}/>)}
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",color:C.orange,opacity:0.4}}>{I.searchLg}</div>
          </div>
          <div style={{fontSize:13,fontWeight:600,color:C.grayLight,marginBottom:3}}>{t("noTransactions")}</div>
          <div style={{fontSize:11,color:C.gray,marginBottom:14,lineHeight:1.5}}>{t("noTransactionsDescAlt")}</div>
          <button onClick={()=>{setTransferMode("receive");setActiveTab("transfer");}} className="b21p" style={{background:`${C.orange}0A`,border:`1px solid ${C.orange}20`,borderRadius:RD.md,padding:"9px 18px",color:C.orange,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:FN.body,display:"inline-flex",alignItems:"center",gap:6}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="17" y1="7" x2="7" y2="17"/><polyline points="17 17 7 17 7 7"/></svg>{t("receiveBtc")}</button>
        </div>:
          transactions.slice(0,5).map((tx,i)=>renderTxItem(tx,i))}
        {transactions.length>5&&<button onClick={()=>setShowAllTx(true)} className="b21p" style={{width:"100%",padding:"12px",marginTop:4,borderRadius:RD.md,border:`1px solid ${C.border}`,background:C.surface,color:C.orange,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:FN.body}}>{t("viewAllTransactions")} ({transactions.length})</button>}
      </div>

    </>);
  };

  /* ═══ SEND TAB — 2-step: Compose → Review+Send (uses hoisted state) ═══ */
  /* ═══ SEND — scanner refs (stable, not recreated) ═══ */
  const scannerRef=useRef(null);const html5QrRef=useRef(null);
  const sendSuccessRef=useRef(null); // snapshot success data to survive re-renders

  const startScanner=useCallback(async()=>{if(!window.isSecureContext){setSendError(t("cameraRequiresHTTPS"));setSendShowScanner(false);return;}setSendShowScanner(true);setSendError("");try{await new Promise(r=>setTimeout(r,100));if(!scannerRef.current)return;
    const qr=new Html5Qrcode("qr-reader");html5QrRef.current=qr;
    await qr.start({facingMode:"environment"},{fps:10,qrbox:{width:250,height:250}},(decoded)=>{
      let addr=decoded,amt=null;if(decoded.toLowerCase().startsWith("bitcoin:")){const u=new URL(decoded);addr=u.pathname;if(u.searchParams.has("amount"))amt=u.searchParams.get("amount");}
      setSendRecipient(addr);if(amt){const btcV=parseFloat(amt);const unitV=curUnit.decimals===0?String(Math.round(btcV*curUnit.factor)):(btcV*curUnit.factor).toFixed(curUnit.decimals);setSendAmountBTC(unitV);setSendAmountUSD((btcV*priceRef.current.fiat).toFixed(2));setSendInputMode("btc");}stopScanner();
    },()=>{});}catch{setSendError(t("cameraAccessDenied"));setSendShowScanner(false);}
  },[]);
  const stopScanner=useCallback(async()=>{if(html5QrRef.current){try{await html5QrRef.current.stop();html5QrRef.current.clear();}catch{}html5QrRef.current=null;}setSendShowScanner(false);},[]);

  // Auto-stop scanner when leaving transfer tab or changing any section
  useEffect(()=>{if(activeTab!=="transfer"&&sendShowScanner){stopScanner();}},[activeTab]);
  useEffect(()=>{if(sendShowScanner&&(moreSection||radarSection)){stopScanner();}},[moreSection,radarSection]);

  const handleAmtChange=useCallback((v,m)=>{const p=priceRef.current;if(m==="btc"){setSendAmountBTC(v);const rawBtc=v&&parseFloat(v)?parseFloat(v)/curUnit.factor:0;setSendAmountUSD(rawBtc?(rawBtc*p.fiat).toFixed(2):"");}else{setSendAmountUSD(v);setSendAmountBTC(v&&parseFloat(v)?((parseFloat(v)/p.fiat)*curUnit.factor).toFixed(curUnit.decimals):"");}},[curUnit.factor,curUnit.decimals]);

  // Physical-keyboard typing for the Send-amount composer.
  // Active only on step 1 of the Transfer tab. Digits / . / Backspace feed
  // the amount; Esc closes the visual keypad. Ignored while the user is in
  // a text field (recipient, memo, fee input, search, etc.).
  useEffect(()=>{
    if(activeTab!=="transfer"||sendStep!==1)return;
    const onKey=(e)=>{
      if(e.ctrlKey||e.metaKey||e.altKey)return;
      const t=e.target;
      if(t&&(t.tagName==="INPUT"||t.tagName==="TEXTAREA"||t.isContentEditable))return;
      const AMT_MAX=sendInputMode==="btc"?16:12;
      const cur=sendInputMode==="btc"?sendAmountBTC:sendAmountUSD;
      if(e.key>="0"&&e.key<="9"){
        if(cur.length>=AMT_MAX){e.preventDefault();return;}
        const next=(cur===""||cur==="0")?e.key:cur+e.key;
        handleAmtChange(next,sendInputMode);
        if(!sendShowKeypad)setSendShowKeypad(true);
        e.preventDefault();
      }else if(e.key==="."||e.key===","){
        if(cur.includes("."))return;
        const next=cur===""?"0.":cur+".";
        handleAmtChange(next,sendInputMode);
        if(!sendShowKeypad)setSendShowKeypad(true);
        e.preventDefault();
      }else if(e.key==="Backspace"){
        const next=cur.length<=1?"":cur.slice(0,-1);
        handleAmtChange(next,sendInputMode);
        e.preventDefault();
      }else if(e.key==="Escape"&&sendShowKeypad){
        setSendShowKeypad(false);
        e.preventDefault();
      }
    };
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[activeTab,sendStep,sendInputMode,sendAmountBTC,sendAmountUSD,sendShowKeypad,handleAmtChange]);

  const feeRates=fees?{economy:fees.hourFee,standard:fees.halfHourFee,priority:fees.fastestFee}:{economy:5,standard:10,priority:20};
  const curFeeRate=sendFeeLevel==="custom"?(parseInt(sendCustomFeeRate)||1):feeRates[sendFeeLevel];
  // Spendable UTXOs: all (confirmed + unconfirmed), excluding frozen
  const spendableUtxos=useMemo(()=>(utxos||[]).filter(u=>!frozenUTXOs.includes(`${u.txid}:${u.vout}`)),[utxos,frozenUTXOs]);
  const confirmedSats=useMemo(()=>spendableUtxos.reduce((s,u)=>s+u.value,0),[spendableUtxos]);
  const confirmedUtxos=useMemo(()=>(utxos||[]).filter(u=>u.status?.confirmed),[utxos]);

  const hasPriceData=(priceRef.current?.fiat||price.fiat||0)>0;
  const amtSats=sendInputMode==="btc"?Math.round(parseFloat(sendAmountBTC||"0")/curUnit.factor*1e8):(hasPriceData?Math.round((parseFloat(sendAmountUSD||"0")/(priceRef.current?.fiat||price.fiat))*1e8):0);
  const estFee=estimateFee(1,2,curFeeRate);const totalSats=amtSats+estFee;

  const handleMax=useCallback(()=>{const p=priceRef.current;const ef=estimateFee(Math.max(1,spendableUtxos.length),2,curFeeRate);const mx=confirmedSats-ef;if(mx<=0)return;const btcVal=mx/1e8;const unitVal=(btcVal*curUnit.factor).toFixed(curUnit.decimals);setSendAmountBTC(curUnit.decimals===0?String(Math.round(btcVal*curUnit.factor)):unitVal);setSendAmountUSD((btcVal*p.fiat).toFixed(2));setSendInputMode("btc");},[curFeeRate,confirmedSats,spendableUtxos,curUnit.factor,curUnit.decimals]);

  const validateSend=useCallback(()=>{setSendError("");const r=sendRecipient.trim();if(!r){setSendError(t("enterRecipientAddress"));return false;}if(!validateAddress(r,testnet)){setSendError(t("invalidBitcoinAddress"));return false;}if(r===address){setSendError(t("cannotSendToSelf"));return false;}if(!amtSats||amtSats<=0){setSendError(t("enterAnAmount"));return false;}if(amtSats<546){setSendError(t("amountBelowDust"));return false;}if(totalSats>confirmedSats){setSendError(t("insufficientFunds"));return false;}return true;},[sendRecipient,testnet,address,amtSats,totalSats,confirmedSats]);

  const handleSend=useCallback(async()=>{setSendError("");setSendBroadcasting(true);setSendStep(3);
    // Let React paint the broadcasting screen before heavy key derivation
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));
    try{
    // Get all wallet addresses and derive keypairs for each UTXO source
    const allAddrs=(activeWallet?.addresses||[]).map(a=>a.address).filter(Boolean);
    if(!allAddrs.includes(address))allAddrs.push(address);
    const primaryAddr=activeWallet?.primaryAddress||address;
    if(!allAddrs.includes(primaryAddr))allAddrs.push(primaryAddr);

    let keyPairs={};
    if(walletKeyData){const{seed:parsedSeed,passphrase:pp}=parseSeedData(walletKeyData);const sk=(parsedSeed||walletKeyData).trim().toLowerCase();
      if(validateSeedPhrase(sk)){
        // Derive keypair for each wallet address
        for(const addr of allAddrs){
          try{const r=await getKeyPairSmart(sk,addr,testnet,pp);keyPairs[addr]=r.keyPair;}catch{}
        }
      }else{
        const kp=getKeyPairFromWIF(walletKeyData.trim(),testnet);
        keyPairs[address]=kp;
      }
    }else{throw new Error("No signing key available. Please re-import your wallet.");}
    if(Object.keys(keyPairs).length===0)throw new Error("Could not derive signing keys.");

    const frozen=frozenUTXOs||[];
    const safeUtxos=(utxoRef.current||utxos||[]).filter(u=>!frozen.includes(`${u.txid}:${u.vout}`));

    // Build transaction — sign each input with the correct keypair for its source address
    const network=testnet?{messagePrefix:'\x18Bitcoin Signed Message:\n',bech32:'tb',pubKeyHash:0x6f,scriptHash:0xc4,wif:0xef}:undefined;
    const psbt=new(await import("bitcoinjs-lib")).Psbt({network:testnet?network:undefined});
    // Use simple buildTransaction but with correct senderAddress matching UTXOs
    // The UTXOs come from primaryAddress (index 0) — use that for script + signing
    const defaultKp=keyPairs[primaryAddr]||keyPairs[address]||Object.values(keyPairs)[0];
    const result=buildTransaction({utxos:safeUtxos,recipientAddress:sendRecipient.trim(),amountSats:amtSats,feeRate:curFeeRate,keyPair:defaultKp,keyPairs,senderAddress:primaryAddr,enableRBF:sendEnableRBF,testnet});

    try{
      const bc=await broadcastTx(result.txHex,testnet);
      const successData={...result,broadcastTxid:bc.txid||result.txid,amtSats,enableRBF:sendEnableRBF,feeLevel:sendFeeLevel,feeRate:curFeeRate,sentAt:Date.now(),memo:sendMemo?sendMemo.trim():""};
      sendSuccessRef.current=successData;
      // Persist send-time note as the tx label so it shows in tx detail
      if(sendMemo&&sendMemo.trim()){const txid=bc.txid||result.txid;if(txid)setTxLbl(txid,sendMemo.trim());}
      setSendTxResult(successData);setSendStep(4);setSendBroadcasting(false);
      // Immediately remove spent UTXOs from local state so balance updates instantly
      if(result.usedUtxos&&result.usedUtxos.length>0){
        const spentKeys=new Set(result.usedUtxos.map(u=>`${u.txid}:${u.vout}`));
        setUtxos(prev=>(prev||[]).filter(u=>!spentKeys.has(`${u.txid}:${u.vout}`)));
      }
      clearAddressCache(address);clearAddressCache(primaryAddr);
      // Fetch fresh data quickly to get the new change UTXO
      setTimeout(()=>{fetchData(true);},2000);
    }catch(bcErr){
      setSendStep(2);setSendError(getUserFriendlyError(bcErr));setSendBroadcasting(false);
    }
  }catch(err){setSendStep(2);setSendError(getUserFriendlyError(err));setSendBroadcasting(false);}
  },[walletKeyData,address,activeWallet,testnet,sendRecipient,amtSats,curFeeRate,sendEnableRBF,utxos,fetchData]);

  /* ═══ SEND UI (inline, NOT inner function component) ═══ */
  const renderSendFlow=()=>{
    const hasKey=!!walletKeyData;
    const p=priceRef.current||price;

    // Step 4: Success — use ref snapshot to survive re-renders
    if(sendStep===4){
      const sr=sendSuccessRef.current||sendTxResult;
      if(!sr)return null;
      const txid=sr.broadcastTxid||"";
      const explorerUrl=`${EXPLORER_BASE}/tx/${txid}`;
      const totalBtc=(sr.amtSats+sr.fee)/1e8;
      const totalFiat=totalBtc*price.fiat;
      // Timestamp
      const sentAt=sr.sentAt||Date.now();
      const dateObj=new Date(sentAt);
      const dateStr=dateObj.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
      const timeStr=dateObj.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",hour12:false});
      // ETA based on fee tier
      const etaText=sr.feeLevel==="priority"?"~10 min":sr.feeLevel==="economy"?"~60 min":sr.feeLevel==="custom"?(sr.feeRate>=20?"~10 min":sr.feeRate>=10?"~30 min":"~60 min"):"~30 min";
      // Share as image receipt
      const handleShareReceipt=async()=>{
        try{
          const W=640,H=880;
          const cv=document.createElement("canvas");cv.width=W;cv.height=H;
          const ctx=cv.getContext("2d");
          // bg
          ctx.fillStyle="#08080A";ctx.fillRect(0,0,W,H);
          // logo
          ctx.fillStyle=C.orange;ctx.font="800 36px -apple-system, system-ui, sans-serif";ctx.textAlign="center";ctx.fillText("bit21",W/2,70);
          ctx.fillStyle="#6B6B80";ctx.font="600 12px -apple-system, system-ui, sans-serif";ctx.fillText("TRANSACTION RECEIPT",W/2,95);
          // check
          ctx.fillStyle=C.green;ctx.beginPath();ctx.arc(W/2,180,42,0,2*Math.PI);ctx.fill();
          ctx.strokeStyle="#08080A";ctx.lineWidth=6;ctx.lineCap="round";ctx.lineJoin="round";
          ctx.beginPath();ctx.moveTo(W/2-16,180);ctx.lineTo(W/2-4,193);ctx.lineTo(W/2+18,169);ctx.stroke();
          // amount
          ctx.fillStyle="#F2F2F7";ctx.font="300 54px 'SF Mono', monospace";ctx.fillText(`${fmtUnit(sr.amtSats/1e8)} ${curUnit.symbol}`,W/2,285);
          ctx.fillStyle="#6B6B80";ctx.font="16px 'SF Mono', monospace";ctx.fillText(`≈ ${fmtFiat(sr.amtSats/1e8*price.fiat)}`,W/2,315);
          // rows
          const row=(y,label,value,opts={})=>{
            ctx.fillStyle="#6B6B80";ctx.font="600 11px 'SF Mono', monospace";ctx.textAlign="left";
            ctx.fillText(label.toUpperCase(),46,y);
            ctx.fillStyle=opts.color||"#F2F2F7";ctx.font=`${opts.weight||400} ${opts.size||14}px 'SF Mono', monospace`;ctx.textAlign="right";
            ctx.fillText(value,W-46,y);
          };
          // divider
          const divider=(y)=>{ctx.strokeStyle="rgba(255,255,255,0.08)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(30,y);ctx.lineTo(W-30,y);ctx.stroke();};
          let y=380;
          // Receipt box
          ctx.fillStyle="rgba(255,255,255,0.025)";ctx.strokeStyle="rgba(255,255,255,0.08)";ctx.lineWidth=1;
          const boxY=y-30;const boxH=360;
          ctx.beginPath();ctx.roundRect(30,boxY,W-60,boxH,16);ctx.fill();ctx.stroke();
          // To (wrap if long)
          ctx.fillStyle="#6B6B80";ctx.font="600 11px 'SF Mono', monospace";ctx.textAlign="left";
          ctx.fillText("TO",46,y);
          ctx.fillStyle="#F2F2F7";ctx.font="14px 'SF Mono', monospace";
          const addr=sendRecipient;const chunks=addr.match(/.{1,34}/g)||[addr];
          chunks.forEach((c,i)=>ctx.fillText(c,46,y+22+(i*20)));
          y+=22+(chunks.length*20)+14;divider(y);y+=24;
          row(y,"Fee",`${fmtUnit(sr.fee/1e8)} ${curUnit.symbol}`);y+=30;divider(y);y+=24;
          row(y,"Total",`${fmtUnit(totalBtc)} ${curUnit.symbol}`,{color:C.orange,weight:700,size:16});
          ctx.fillStyle="rgba(255,255,255,0.5)";ctx.font="12px 'SF Mono', monospace";ctx.textAlign="right";
          ctx.fillText(`≈ ${fmtFiat(totalFiat)}`,W-46,y+20);y+=42;divider(y);y+=24;
          row(y,"Date",`${dateStr} · ${timeStr}`);y+=30;divider(y);y+=24;
          if(sr.memo){row(y,"Note",sr.memo.slice(0,32));y+=30;divider(y);y+=24;}
          // TXID (wrap)
          ctx.fillStyle="#6B6B80";ctx.font="600 11px 'SF Mono', monospace";ctx.textAlign="left";
          ctx.fillText("TRANSACTION ID",46,y);
          ctx.fillStyle="#F2F2F7";ctx.font="11px 'SF Mono', monospace";
          const tchunks=(txid||"").match(/.{1,42}/g)||[txid];
          tchunks.forEach((c,i)=>ctx.fillText(c,46,y+22+(i*16)));
          // Footer
          ctx.fillStyle="#6B6B80";ctx.font="600 11px -apple-system, system-ui, sans-serif";ctx.textAlign="center";
          ctx.fillText("wallet.bit21.app",W/2,H-30);
          // Export
          cv.toBlob(async(blob)=>{
            if(!blob)return;
            const file=new File([blob],`bit21-tx-${(txid||"receipt").slice(0,8)}.png`,{type:"image/png"});
            try{
              if(navigator.canShare&&navigator.canShare({files:[file]})){
                await navigator.share({files:[file],title:"bit21 Transaction"});
                return;
              }
            }catch{}
            // Fallback: download
            const url=URL.createObjectURL(blob);
            const a=document.createElement("a");a.href=url;a.download=file.name;document.body.appendChild(a);a.click();document.body.removeChild(a);
            setTimeout(()=>URL.revokeObjectURL(url),1000);
          },"image/png",0.95);
        }catch(err){console.error("Share failed:",err);}
      };
      return(
      <div style={{animation:"b21cu 0.5s cubic-bezier(0.2,0.8,0.2,1)"}}>
        {/* Hero success check */}
        <div style={{textAlign:"center",padding:"30px 0 20px"}}>
          <div style={{
            width:80,height:80,borderRadius:40,margin:"0 auto 22px",
            background:C.green,display:"flex",alignItems:"center",justifyContent:"center",
            boxShadow:`0 20px 50px -10px ${C.green}80`,
            animation:"b21bi 0.6s cubic-bezier(0.5,1.6,0.4,1)",
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0a0806" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>
          </div>
          <div style={{fontSize:10,letterSpacing:"0.24em",textTransform:"uppercase",color:C.green,fontFamily:FN.mono,fontWeight:700,marginBottom:10}}>Broadcast Complete</div>
          <div style={{fontSize:24,fontWeight:500,color:C.white,letterSpacing:"-0.01em",marginBottom:10,fontFamily:FN.display}}>Transaction sent</div>
          {/* Timestamp + ETA (same muted color) */}
          <div style={{fontFamily:FN.mono,fontSize:11.5,color:C.gray,letterSpacing:"0.02em"}}>
            {dateStr} · {timeStr} &nbsp;·&nbsp; Expected in {etaText}
          </div>
        </div>
        {/* Details card: To, Amount (orange), Fee, Total (white), [RBF] */}
        <div style={{background:"rgba(255,255,255,0.025)",border:`1px solid ${C.border}`,borderRadius:18,overflow:"hidden",marginBottom:14}}>
          {/* To */}
          <div style={{padding:"14px 16px",borderBottom:`1px solid ${C.border}`}}>
            <div style={{fontSize:10,letterSpacing:"0.2em",textTransform:"uppercase",color:C.gray,fontFamily:FN.mono,fontWeight:600,marginBottom:6}}>To</div>
            <div style={{fontSize:12,fontFamily:FN.mono,color:C.white,wordBreak:"break-all",lineHeight:1.7}}>{sendRecipient}</div>
          </div>
          {/* Amount — orange */}
          <div style={{padding:"13px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
            <span style={{fontSize:11,letterSpacing:"0.16em",textTransform:"uppercase",color:C.gray,fontFamily:FN.mono,fontWeight:600,paddingTop:2}}>Amount</span>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:14,fontWeight:600,color:C.orange,fontFamily:FN.mono}}>{fmtAmt(sr.amtSats/1e8)}</div>
              <div style={{fontSize:11,color:C.orange,marginTop:3,fontFamily:FN.mono,opacity:0.7}}>≈ {fmtFiat(sr.amtSats/1e8*price.fiat)}</div>
            </div>
          </div>
          {/* Fee */}
          <div style={{padding:"13px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:11,letterSpacing:"0.16em",textTransform:"uppercase",color:C.gray,fontFamily:FN.mono,fontWeight:600}}>Fee</span>
            <span style={{fontSize:13,color:C.white,fontFamily:FN.mono}}>{fmtAmt(sr.fee/1e8)}</span>
          </div>
          {/* Total — white */}
          <div style={{padding:"13px 16px",borderBottom:sr.enableRBF?`1px solid ${C.border}`:"none",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
            <span style={{fontSize:11,letterSpacing:"0.16em",textTransform:"uppercase",color:C.gray,fontFamily:FN.mono,fontWeight:700,paddingTop:2}}>Total</span>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:15,fontWeight:700,color:C.white,fontFamily:FN.mono}}>{fmtAmt(totalBtc)}</div>
              <div style={{fontSize:11,color:C.white,marginTop:3,fontFamily:FN.mono,opacity:0.7}}>≈ {fmtFiat(totalFiat)}</div>
            </div>
          </div>
          {sr.enableRBF&&<div style={{padding:"13px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:11,letterSpacing:"0.16em",textTransform:"uppercase",color:C.gray,fontFamily:FN.mono,fontWeight:600}}>RBF</span>
            <span style={{fontSize:13,color:C.green,fontFamily:FN.mono,fontWeight:600}}>Enabled</span>
          </div>}
        </div>
        {/* Transaction ID card with copy feedback */}
        <div style={{padding:"14px 16px",borderRadius:14,background:"rgba(255,255,255,0.025)",border:`1px solid ${C.border}`,marginBottom:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:10,letterSpacing:"0.2em",textTransform:"uppercase",color:C.gray,fontFamily:FN.mono,fontWeight:600}}>Transaction ID</div>
            <button onClick={()=>{handleCopy(txid);}} className="b21p" style={{background:copied&&copyTarget===txid?`${C.green}18`:"transparent",border:`1px solid ${copied&&copyTarget===txid?C.green+"50":C.border}`,borderRadius:8,padding:"4px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:5,fontSize:10,color:copied&&copyTarget===txid?C.green:C.grayLight,letterSpacing:"0.1em",fontWeight:600,fontFamily:FN.body,textTransform:"uppercase",transition:"all 0.2s"}}>
              {copied&&copyTarget===txid?<><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>Copied</>:<><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy</>}
            </button>
          </div>
          <div style={{fontFamily:FN.mono,fontSize:11.5,color:C.white,wordBreak:"break-all",lineHeight:1.7}}>{txid}</div>
        </div>
        {/* Top row: Share + View on Blockchain */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <button onClick={handleShareReceipt} className="b21p" style={{
            padding:"14px 0",borderRadius:999,background:"rgba(255,255,255,0.05)",border:`1px solid ${C.border}`,
            color:C.white,cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:FN.body,letterSpacing:"0.01em",
            display:"flex",alignItems:"center",justifyContent:"center",gap:7,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            Share
          </button>
          <button onClick={()=>window.open(explorerUrl,"_blank")} className="b21p" style={{
            padding:"14px 0",borderRadius:999,background:"rgba(255,255,255,0.05)",border:`1px solid ${C.border}`,
            color:C.white,cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:FN.body,letterSpacing:"0.01em",
            display:"flex",alignItems:"center",justifyContent:"center",gap:7,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            View on Blockchain
          </button>
        </div>
        {/* Primary Done — full width, centered */}
        <button onClick={()=>{sendSuccessRef.current=null;sendResetForm();setActiveTab("home");}} className="b21p" style={{
          width:"100%",padding:"16px 0",borderRadius:999,
          background:`linear-gradient(180deg,${C.orange},${C.orangeDark})`,border:"none",
          color:"#1a1410",cursor:"pointer",fontSize:14.5,fontWeight:800,fontFamily:FN.body,letterSpacing:"0.01em",
          boxShadow:`0 14px 40px -10px ${C.orangeGlow}, inset 0 1px 0 rgba(255,255,255,0.35)`,
        }}>Done</button>
      </div>);
    }

    // Step 3: Broadcasting — pulse rings with ₿ symbol
    if(sendStep===3)return(
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"60px 20px",minHeight:360,animation:"b21cu 0.4s cubic-bezier(0.2,0.8,0.2,1)"}}>
        <div style={{position:"relative",width:140,height:140,marginBottom:32}}>
          {[0,1,2].map(i=>(
            <div key={i} style={{
              position:"absolute",inset:0,borderRadius:70,
              border:`1px solid ${C.orange}`,
              animation:`b21pulsring 2s cubic-bezier(0.16,1,0.3,1) ${i*0.5}s infinite`,
            }}/>
          ))}
          <div style={{
            position:"absolute",inset:30,borderRadius:40,
            background:`linear-gradient(180deg,${C.orange},${C.orangeDark})`,
            display:"flex",alignItems:"center",justifyContent:"center",
            color:"#1a1410",fontSize:34,fontWeight:700,fontFamily:FN.display,
            boxShadow:`0 20px 50px -10px ${C.orangeGlow}`,
          }}>₿</div>
        </div>
        <div style={{fontSize:20,fontWeight:500,color:C.white,marginBottom:10,letterSpacing:"-0.01em",fontFamily:FN.display}}>Sending…</div>
        <div style={{fontSize:12.5,color:C.grayLight,textAlign:"center",maxWidth:300,lineHeight:1.5}}>Sending your transaction to the Bitcoin network</div>
        <style>{`@keyframes b21pulsring{0%{transform:scale(0.8);opacity:0.6}100%{transform:scale(2);opacity:0}}`}</style>
      </div>);

    // Step 2: Review & Sign — luxury summary card
    if(sendStep===2){
      // Fee safety guard: warn if fee > 10% of amount
      const feePercent=amtSats>0?((estFee/amtSats)*100):0;
      const highFee=feePercent>10;
      // Address verification: check if this is a new address (never sent to before)
      const sentAddresses=new Set((txRef.current||transactions||[]).filter(tx=>tx.vin).flatMap(tx=>(tx.vout||[]).map(o=>o.scriptpubkey_address)).filter(Boolean));
      const addrShort=sendRecipient.length>20?sendRecipient.slice(0,10)+"…"+sendRecipient.slice(-8):sendRecipient;
      const feeLabel=sendFeeLevel==="custom"?(sendCustomFeeRate+" sat/vB"):`${curFeeRate} sat/vB`;
      const feeSubLabel=sendFeeLevel==="economy"?t("fee60min"):sendFeeLevel==="priority"?t("fee10min"):sendFeeLevel==="standard"?t("fee30min"):"";
      return(
      <div style={{animation:"b21cu 0.4s cubic-bezier(0.2,0.8,0.2,1)"}}>
        {/* Top bar: back + step indicator */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <button onClick={()=>setSendStep(1)} className="b21p" style={{
            width:38,height:38,borderRadius:19,background:"rgba(255,255,255,0.04)",
            border:`1px solid rgba(255,255,255,0.08)`,color:C.white,cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:10,letterSpacing:"0.2em",color:C.gray,textTransform:"uppercase",fontFamily:FN.mono,marginBottom:2,fontWeight:600}}>Step 02 / 02</div>
            <div style={{fontSize:15,fontWeight:600,color:C.white,fontFamily:FN.display,letterSpacing:"-0.01em"}}>Review & sign</div>
          </div>
          <div style={{width:38}}/>
        </div>

        {/* Hero summary card */}
        <div style={{
          position:"relative",
          background:`linear-gradient(135deg,#1a130c 0%,#0f0a06 55%,#1a130c 100%)`,
          border:`1px solid ${C.orange}33`,
          borderRadius:24,padding:"24px 20px",overflow:"hidden",
          boxShadow:`0 30px 80px -30px ${C.orange}40, inset 0 1px 0 rgba(255,255,255,0.06)`,
          marginBottom:16,
        }}>
          {/* Corner glow */}
          <div style={{position:"absolute",top:-80,right:-80,width:240,height:240,borderRadius:120,background:`radial-gradient(circle,${C.orange}40 0%,transparent 60%)`,filter:"blur(30px)",pointerEvents:"none"}}/>
          <div style={{position:"relative"}}>
            <div style={{marginBottom:16}}>
              <span style={{fontSize:10,letterSpacing:"0.2em",color:C.orange,textTransform:"uppercase",fontFamily:FN.mono,fontWeight:700}}>Sending</span>
            </div>
            <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:6}}>
              <span style={{fontSize:36,fontWeight:300,letterSpacing:"-0.03em",fontFamily:FN.mono,color:C.white,lineHeight:1}}>{fmtUnit(amtSats/1e8)}</span>
              <span style={{fontSize:15,color:C.orange,fontWeight:500,letterSpacing:"0.03em"}}>{curUnit.symbol}</span>
            </div>
            <div style={{fontSize:13,color:C.grayLight,fontFamily:FN.mono}}>≈ {fmtFiat(amtSats/1e8*p.fiat)}</div>
          </div>
        </div>

        {/* Detail rows */}
        <div style={{background:"rgba(255,255,255,0.025)",border:`1px solid ${C.border}`,borderRadius:18,overflow:"hidden",marginBottom:14}}>
          {/* To — full address */}
          <div style={{padding:"13px 16px",borderBottom:`1px solid ${C.border}`}}>
            <div style={{fontSize:11,letterSpacing:"0.14em",textTransform:"uppercase",color:C.gray,fontWeight:600,fontFamily:FN.mono,marginBottom:6}}>To</div>
            <div style={{fontSize:12.5,fontWeight:500,color:C.white,fontFamily:FN.mono,wordBreak:"break-all",lineHeight:1.6}}>{sendRecipient}</div>
          </div>
          {/* Fee */}
          <div style={{padding:"13px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
            <span style={{fontSize:11,letterSpacing:"0.14em",textTransform:"uppercase",color:C.gray,fontWeight:600,fontFamily:FN.mono,paddingTop:2}}>Fee</span>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:13,fontWeight:500,color:C.white,fontFamily:FN.mono}}>{feeLabel}</div>
              {feeSubLabel&&<div style={{fontSize:10.5,color:C.grayLight,marginTop:3,fontFamily:FN.mono}}>{feeSubLabel}</div>}
            </div>
          </div>
          {/* RBF */}
          <div style={{padding:"13px 16px",borderBottom:sendMemo?`1px solid ${C.border}`:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
            <span style={{fontSize:11,letterSpacing:"0.14em",textTransform:"uppercase",color:C.gray,fontWeight:600,fontFamily:FN.mono}}>RBF</span>
            <span style={{fontSize:13,fontWeight:600,color:sendEnableRBF?C.green:C.gray}}>{sendEnableRBF?"Enabled":"Disabled"}</span>
          </div>
          {/* Note (right-aligned like other details) */}
          {sendMemo&&<div style={{padding:"13px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
            <span style={{fontSize:11,letterSpacing:"0.14em",textTransform:"uppercase",color:C.gray,fontWeight:600,fontFamily:FN.mono,paddingTop:2,flexShrink:0}}>Note</span>
            <span style={{fontSize:12.5,fontWeight:500,color:C.white,lineHeight:1.5,wordBreak:"break-word",textAlign:"right",flex:1}}>{sendMemo}</span>
          </div>}
          {/* Total — white values */}
          <div style={{padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,background:`${C.orange}06`}}>
            <span style={{fontSize:11,letterSpacing:"0.14em",textTransform:"uppercase",color:C.gray,fontWeight:700,fontFamily:FN.mono,paddingTop:2}}>Total</span>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:15,fontWeight:700,color:C.white,fontFamily:FN.mono}}>{fmtAmt(totalSats/1e8)}</div>
              <div style={{fontSize:11,color:C.white,marginTop:3,fontFamily:FN.mono,opacity:0.7}}>≈ {fmtFiat(totalSats/1e8*p.fiat)}</div>
            </div>
          </div>
        </div>

        {!hasKey&&<WBox C={C}>{t("noSigningKey")}</WBox>}
        <EBox C={C}>{sendError}</EBox>

        {/* Slide to confirm & sign */}
        {(()=>{
          if(sendBroadcasting)return(<button disabled className="b21p" style={{width:"100%",padding:"20px",borderRadius:999,border:"none",background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.6)",fontSize:14.5,fontWeight:700,letterSpacing:"0.01em",fontFamily:FN.body,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
            Signing<span style={{display:"inline-flex",gap:3,marginLeft:3}}>{[0,1,2].map(i=><span key={i} style={{width:4,height:4,borderRadius:"50%",background:C.orange,display:"inline-block",animation:`b21dot 1.2s ease-in-out ${i*0.15}s infinite`}}/>)}</span>
            <style>{`@keyframes b21dot{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}`}</style>
          </button>);
          return(<SlideToConfirm C={C} FN={FN} disabled={!hasKey} onConfirm={handleSend}/>);
        })()}
      </div>);
    }

    // Step 1: Compose — luxury with keypad + draggable balance bar + memo + pill pickers
    const amtBtcVal=parseFloat(sendAmountBTC||"0")/curUnit.factor;
    const amtDisplay=sendInputMode==="btc"?(sendAmountBTC||"0"):(sendAmountUSD||"0");
    // Balance bar pct — mirrors amount unless user is dragging
    const computedPct=confirmedSats>0?Math.min(100,(amtBtcVal*1e8/confirmedSats)*100):0;
    const barPct=sendDragPct!==null?sendDragPct:computedPct;
    // Recent contacts derived from outgoing transactions
    const recentContacts=(()=>{const out=[];const seen=new Set();for(const tx of transactions){const isSend=tx.vin?.some(v=>v.prevout?.scriptpubkey_address===address);if(!isSend)continue;for(const o of (tx.vout||[])){const a=o.scriptpubkey_address;if(a&&a!==address&&!seen.has(a)){seen.add(a);const ab=addressBook.find(e=>e.address===a);out.push({address:a,name:ab?ab.name:null});if(out.length>=20)break;}}if(out.length>=20)break;}return out;})();
    const LARGE_BOOK=addressBook.length>10;
    const LARGE_RECENTS=recentContacts.length>10;
    // Drag handlers for balance bar
    const handleBarPointer=(e)=>{
      const bar=e.currentTarget;
      const rect=bar.getBoundingClientRect();
      const move=(ev)=>{
        const cx=ev.touches?ev.touches[0].clientX:ev.clientX;
        const pct=Math.max(0,Math.min(100,((cx-rect.left)/rect.width)*100));
        setSendDragPct(pct);
        // Set amount in BTC
        const btcVal=(pct/100)*(confirmedSats/1e8);
        handleAmtChange(String(btcVal.toFixed(8).replace(/\.?0+$/,"")||"0"),"btc");
        if(sendInputMode==="usd")setSendInputMode("btc");
      };
      const up=()=>{setSendDragPct(null);document.removeEventListener("mousemove",move);document.removeEventListener("mouseup",up);document.removeEventListener("touchmove",move);document.removeEventListener("touchend",up);};
      document.addEventListener("mousemove",move);
      document.addEventListener("mouseup",up);
      document.addEventListener("touchmove",move);
      document.addEventListener("touchend",up);
      move(e.nativeEvent||e);
    };
    // Keypad press — caps input length to prevent screen overflow
    const AMT_MAX=sendInputMode==="btc"?16:12; // 21M BTC = 16 chars, USD up to ~10^10 = 12
    const pressKey=(k)=>{
      const cur=sendInputMode==="btc"?sendAmountBTC:sendAmountUSD;
      let next;
      if(k==="⌫"){next=cur.length<=1?"":cur.slice(0,-1);}
      else if(k==="."){if(cur.includes("."))return;next=cur===""?"0.":cur+".";}
      else{
        if(cur.length>=AMT_MAX)return;
        next=(cur===""||cur==="0")?k:cur+k;
      }
      handleAmtChange(next,sendInputMode);
    };
    // Render pills helper for contacts list
    const PillContact=({c})=>{
      const palette=["#F7931A","#34D399","#60A5FA","#A78BFA","#FBBF24","#F87171","#FB923C","#2DD4BF"];
      let h=0;for(let k=0;k<c.address.length;k++)h=((h<<5)-h+c.address.charCodeAt(k))|0;
      const col=palette[Math.abs(h)%palette.length];
      const label=c.name||(c.address.length>14?c.address.slice(0,6)+"…"+c.address.slice(-4):c.address);
      const init=c.name?c.name.charAt(0).toUpperCase():"₿";
      return(<button onClick={()=>{setSendRecipient(c.address);setSendShowRecents(false);setSendShowAddrBook(false);}} className="b21p" style={{flexShrink:0,display:"flex",alignItems:"center",gap:8,padding:"7px 12px 7px 7px",borderRadius:999,background:"rgba(255,255,255,0.04)",border:`1px solid rgba(255,255,255,0.08)`,color:C.white,cursor:"pointer",whiteSpace:"nowrap"}}>
        <span style={{width:22,height:22,borderRadius:11,background:`linear-gradient(135deg,${col},${col}99)`,color:"#1a1410",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:c.name?FN.body:FN.mono}}>{init}</span>
        <span style={{fontSize:11.5,fontWeight:500}}>{label}</span>
      </button>);
    };

    return(<div style={{animation:"b21cu 0.4s cubic-bezier(0.2,0.8,0.2,1)",paddingBottom:88}}>
      {/* ───── Hero Amount (tappable card → opens keypad) ───── */}
      <button onClick={()=>setSendShowKeypad(true)} className="b21p" style={{
        width:"100%",textAlign:"center",padding:"22px 0 18px",marginBottom:14,
        background:sendShowKeypad?"rgba(247,147,26,0.04)":"transparent",
        border:"none",cursor:"pointer",color:"inherit",fontFamily:"inherit",borderRadius:20,display:"block",transition:"background 0.2s",
      }}>
        <div style={{fontSize:10,letterSpacing:"0.2em",color:"rgba(255,255,255,0.35)",textTransform:"uppercase",fontFamily:FN.mono,marginBottom:14,fontWeight:600}}>{t("amount")}</div>
        {(()=>{
          const len=(amtDisplay||"0").length;
          // Granular scale so long numbers stay inside the card
          const numSize=len<=6?52:len<=9?42:len<=11?34:len<=13?28:len<=15?22:18;
          const unitSize=len<=9?18:len<=13?14:12;
          const caretH=Math.round(numSize*0.8);
          return(<div style={{display:"flex",alignItems:"baseline",justifyContent:"center",fontFamily:FN.mono,padding:"0 20px",maxWidth:"100%",overflow:"hidden"}}>
            <span style={{fontSize:numSize,fontWeight:200,letterSpacing:"-0.03em",color:amtDisplay==="0"||amtDisplay===""?"rgba(255,255,255,0.25)":C.white,transition:"font-size 0.15s ease",whiteSpace:"nowrap"}}>{amtDisplay||"0"}</span>
            {sendShowKeypad&&<span style={{width:2,height:caretH,marginLeft:3,background:C.orange,alignSelf:"center",animation:"b21cb 1s step-end infinite",flexShrink:0}}/>}
            <span style={{marginLeft:10,fontSize:unitSize,fontWeight:500,color:C.orange,letterSpacing:"0.04em",flexShrink:0}}>{sendInputMode==="btc"?curUnit.symbol:curFiat.code.toUpperCase()}</span>
          </div>);
        })()}
        {/* Conversion + unit-cycle arrows */}
        <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:10,marginTop:12,fontFamily:FN.mono,fontSize:13,color:"rgba(255,255,255,0.5)"}}>
          <span>≈ {sendInputMode==="btc"?fmtFiat(parseFloat(sendAmountBTC||"0")/curUnit.factor*p.fiat):fmtAmt(parseFloat(sendAmountUSD||"0")/(p.fiat||1))}</span>
          <span style={{width:1,height:12,background:"rgba(255,255,255,0.15)"}}/>
          <span role="button" onClick={(e)=>{e.stopPropagation();if(!hasPriceData&&sendInputMode==="btc")return;setSendInputMode(sendInputMode==="btc"?"usd":"btc");}} className="b21p" style={{color:C.orange,cursor:"pointer",padding:"4px 6px",display:"inline-flex",alignItems:"center"}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4v16"/><polyline points="4 7 7 4 10 7"/><path d="M17 20V4"/><polyline points="20 17 17 20 14 17"/></svg>
          </span>
        </div>
      </button>

      {/* ───── Balance bar (draggable) ───── */}
      <div style={{display:"flex",alignItems:"center",gap:10,margin:"0 auto 6px",maxWidth:340,padding:"0 4px"}}>
        <div onMouseDown={handleBarPointer} onTouchStart={handleBarPointer} style={{flex:1,height:28,position:"relative",cursor:"pointer",touchAction:"none",display:"flex",alignItems:"center"}}>
          <div style={{position:"absolute",left:0,right:0,height:4,borderRadius:2,background:"rgba(255,255,255,0.08)",overflow:"hidden"}}>
            <div style={{width:`${barPct}%`,height:"100%",background:barPct>95?C.red:C.orange,transition:sendDragPct!==null?"none":"width 0.3s ease,background 0.2s"}}/>
          </div>
          {/* Thumb */}
          <div style={{position:"absolute",left:`calc(${barPct}% - 8px)`,top:"50%",transform:"translateY(-50%)",width:16,height:16,borderRadius:8,background:C.orange,boxShadow:`0 2px 8px ${C.orange}60`,transition:sendDragPct!==null?"none":"left 0.3s ease",pointerEvents:"none"}}/>
          {/* Live pct tooltip while dragging */}
          {sendDragPct!==null&&<div style={{position:"absolute",left:`${barPct}%`,bottom:22,transform:"translateX(-50%)",background:C.orange,color:"#1a1410",fontSize:10.5,fontWeight:800,padding:"3px 8px",borderRadius:6,fontFamily:FN.mono,letterSpacing:"0.04em",whiteSpace:"nowrap",pointerEvents:"none"}}>{Math.round(barPct)}%</div>}
        </div>
        <button onClick={handleMax} className="b21p" style={{padding:"4px 10px",borderRadius:999,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:C.orange,cursor:"pointer",fontSize:10.5,fontWeight:700,letterSpacing:"0.1em",fontFamily:FN.mono}}>MAX</button>
      </div>
      <div style={{textAlign:"center",fontSize:11,color:"rgba(255,255,255,0.4)",fontFamily:FN.mono,marginBottom:22}}>Available {fmtAmt(confirmedSats/1e8)}</div>

      {/* ───── Recipient ───── */}
      <div style={{marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"0 4px 8px"}}>
          <span style={{fontSize:10.5,letterSpacing:"0.18em",textTransform:"uppercase",color:"rgba(255,255,255,0.5)",fontWeight:600,fontFamily:FN.mono}}>Recipient</span>
        </div>
        <div style={{background:"rgba(255,255,255,0.03)",border:`1px solid rgba(255,255,255,0.08)`,borderRadius:16,padding:"12px 14px",display:"flex",alignItems:"center",gap:10}}>
          <textarea value={sendRecipient} onChange={e=>setSendRecipient(e.target.value.replace(/\n/g,""))} placeholder="Enter Address" rows={sendRecipient.length>34?2:1}
            style={{flex:1,background:"transparent",border:"none",outline:"none",color:C.white,fontSize:13,fontFamily:sendRecipient?FN.mono:FN.body,letterSpacing:sendRecipient?0:"-0.01em",resize:"none",lineHeight:1.6,wordBreak:"break-all",overflow:"hidden",padding:0}}/>
          <button onClick={startScanner} className="b21p" style={{background:"transparent",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.5)",padding:4,display:"flex",flexShrink:0}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="8" x2="13" y2="8"/><line x1="7" y1="16" x2="15" y2="16"/></svg>
          </button>
        </div>
      </div>

      {/* ───── Pill triggers for Recent Contacts + Address Book ───── */}
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {recentContacts.length>0&&<button onClick={()=>{setSendShowRecents(!sendShowRecents);setSendShowAddrBook(false);}} className="b21p" style={{flex:1,padding:"10px 12px",borderRadius:12,background:sendShowRecents?`${C.orange}14`:"rgba(255,255,255,0.04)",border:`1px solid ${sendShowRecents?C.orange+"55":"rgba(255,255,255,0.08)"}`,color:sendShowRecents?C.orange:C.white,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontSize:12,fontWeight:600,transition:"all 0.2s"}}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Recent{recentContacts.length>0?` (${recentContacts.length})`:""}
        </button>}
        {addressBook.length>0&&<button onClick={()=>{setSendShowAddrBook(!sendShowAddrBook);setSendShowRecents(false);}} className="b21p" style={{flex:1,padding:"10px 12px",borderRadius:12,background:sendShowAddrBook?`${C.orange}14`:"rgba(255,255,255,0.04)",border:`1px solid ${sendShowAddrBook?C.orange+"55":"rgba(255,255,255,0.08)"}`,color:sendShowAddrBook?C.orange:C.white,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontSize:12,fontWeight:600,transition:"all 0.2s"}}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          Address book ({addressBook.length})
        </button>}
      </div>

      {/* Inline swipe row — shown for small lists (≤10) */}
      {sendShowRecents&&!LARGE_RECENTS&&recentContacts.length>0&&<div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8,marginBottom:14,scrollbarWidth:"none"}}>
        {recentContacts.map(c=><PillContact key={c.address} c={c}/>)}
      </div>}
      {sendShowAddrBook&&!LARGE_BOOK&&addressBook.length>0&&<div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8,marginBottom:14,scrollbarWidth:"none"}}>
        {addressBook.map(c=><PillContact key={c.address} c={c}/>)}
      </div>}

      {/* ───── Note (optional memo — saved as tx label after broadcast) ───── */}
      {(()=>{const NOTE_MAX=80;return(<div style={{marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"0 4px 8px"}}>
          <span style={{fontSize:10.5,letterSpacing:"0.18em",textTransform:"uppercase",color:"rgba(255,255,255,0.5)",fontWeight:600,fontFamily:FN.mono}}>Note</span>
          <span style={{fontSize:10,color:sendMemo.length>=NOTE_MAX?C.orange:"rgba(255,255,255,0.3)",fontFamily:FN.mono,letterSpacing:"0.08em"}}>{sendMemo.length>0?`${sendMemo.length}/${NOTE_MAX}`:"OPTIONAL"}</span>
        </div>
        <div style={{background:"rgba(255,255,255,0.03)",border:`1px solid rgba(255,255,255,0.08)`,borderRadius:16,padding:"12px 14px"}}>
          <input value={sendMemo} onChange={e=>setSendMemo(e.target.value.slice(0,NOTE_MAX))} maxLength={NOTE_MAX} placeholder="For your records only"
            style={{width:"100%",background:"transparent",border:"none",outline:"none",color:C.white,fontSize:13,fontFamily:"inherit"}}/>
        </div>
      </div>);})()}

      {/* QR Scanner */}
      {sendShowScanner&&<Crd C={C} style={{marginBottom:16}}><div id="qr-reader" ref={scannerRef} style={{width:"100%",borderRadius:RD.md,overflow:"hidden"}}/></Crd>}

      {/* Address book + recent pills and modals are defined further down */}

      {/* ───── Network Fee (4 tiles in one row) ───── */}
      <div style={{marginBottom:12}}>
        <div style={{padding:"0 4px 8px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:10.5,letterSpacing:"0.18em",textTransform:"uppercase",color:"rgba(255,255,255,0.5)",fontWeight:600,fontFamily:FN.mono}}>Network fee</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:5,marginBottom:6}}>
          {[{id:"economy",l:t("economy"),r:feeRates.economy,sub:t("fee60min")},{id:"standard",l:t("standard"),r:feeRates.standard,sub:t("fee30min")},{id:"priority",l:t("priority"),r:feeRates.priority,sub:t("fee10min")},{id:"custom",l:"Custom",r:sendCustomFeeRate||"—",sub:"sat/vB"}].map(f=>{
            const on=sendFeeLevel===f.id;
            return(<button key={f.id} onClick={()=>setSendFeeLevel(f.id)} className="b21p" style={{
              padding:"7px 2px",borderRadius:10,cursor:"pointer",
              background:on?`linear-gradient(180deg,${C.orange}22 0%,${C.orange}08 100%)`:"rgba(255,255,255,0.03)",
              border:`1px solid ${on?C.orange:"rgba(255,255,255,0.08)"}`,
              boxShadow:on?`0 4px 14px -6px ${C.orange}80`:"none",
              color:C.white,textAlign:"center",transition:"all 0.2s",
            }}>
              <div style={{fontSize:9,color:on?C.orange:"rgba(255,255,255,0.5)",letterSpacing:"0.06em",textTransform:"uppercase",fontWeight:600,fontFamily:FN.mono,marginBottom:3}}>{f.l}</div>
              <div style={{fontSize:12,fontWeight:400,letterSpacing:"-0.01em",fontFamily:FN.mono,lineHeight:1}}>{f.r}{f.id!=="custom"&&<span style={{fontSize:8.5,opacity:0.5,marginLeft:2}}>s/vB</span>}</div>
              <div style={{fontSize:8.5,color:"rgba(255,255,255,0.4)",marginTop:3,fontFamily:FN.mono}}>{f.sub}</div>
            </button>);
          })}
        </div>
        {sendFeeLevel==="custom"&&<input type="number" value={sendCustomFeeRate} onChange={e=>setSendCustomFeeRate(e.target.value)} placeholder={t("enterSatVb")||"Enter sat/vB"} min="1"
          style={{width:"100%",marginTop:4,padding:"11px 14px",borderRadius:RD.sm,border:`1px solid ${C.orange}33`,background:"rgba(255,255,255,0.03)",color:C.white,fontSize:13,fontFamily:FN.mono,outline:"none",boxSizing:"border-box"}}/>}
      </div>

      {/* ───── RBF + Est. Fee ───── */}
      <div style={{
        background:"rgba(255,255,255,0.025)",
        border:`1px solid rgba(255,255,255,0.06)`,
        borderRadius:18,padding:"14px 16px",marginBottom:16,
      }}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:500,color:C.white,marginBottom:2,display:"flex",alignItems:"center",gap:8}}>
              Replace-by-Fee
              <span style={{fontSize:9.5,padding:"2px 5px",borderRadius:4,background:`${C.orange}26`,color:C.orange,letterSpacing:"0.1em",fontFamily:FN.mono,fontWeight:700}}>RBF</span>
            </div>
            <div style={{fontSize:11.5,color:C.grayLight}}>{t("bumpFeeIfSlow")}</div>
          </div>
          <Tog value={sendEnableRBF} onChange={()=>setSendEnableRBF(!sendEnableRBF)} C={C}/>
        </div>
        <div style={{marginTop:14,paddingTop:12,borderTop:`1px solid rgba(255,255,255,0.06)`,display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
          <span style={{fontSize:10.5,color:"rgba(255,255,255,0.5)",letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:FN.mono}}>Est. network fee</span>
          <span style={{fontFamily:FN.mono,fontSize:12.5,color:C.white}}>
            {fmtAmt(estFee/1e8)}
            <span style={{marginLeft:6,color:"rgba(255,255,255,0.4)"}}>≈ {fmtFiat(estFee/1e8*p.fiat)}</span>
          </span>
        </div>
      </div>

      <EBox C={C}>{sendError}</EBox>

      {/* ───── Sticky Review CTA ───── */}
      <div style={{position:"sticky",bottom:0,paddingTop:14,paddingBottom:4,background:`linear-gradient(180deg,transparent 0%,${C.bg} 30%,${C.bg} 100%)`,zIndex:5,marginTop:4}}>
        <button onClick={()=>{if(validateSend())setSendStep(2);}} className="b21p" style={{
          width:"100%",padding:"16px 0",borderRadius:999,border:"none",cursor:"pointer",
          background:`linear-gradient(180deg,${C.orange} 0%,${C.orangeDark} 100%)`,
          color:"#1a1410",fontSize:14.5,fontWeight:700,letterSpacing:"-0.01em",fontFamily:FN.body,
          boxShadow:`0 14px 40px -10px ${C.orangeGlow}, inset 0 1px 0 rgba(255,255,255,0.35)`,
          transition:"all 0.2s",
        }}>Review transaction</button>
      </div>

      {/* ───── Number Keypad overlay ───── */}
      {sendShowKeypad&&<div onClick={()=>setSendShowKeypad(false)} style={{position:"fixed",inset:0,zIndex:9998,background:"rgba(0,0,0,0.35)",animation:"b21fi 0.2s ease"}}>
        <div onClick={e=>e.stopPropagation()} style={{
          position:"fixed",bottom:0,left:0,right:0,maxWidth:480,margin:"0 auto",
          background:`linear-gradient(180deg,rgba(22,18,14,0.98) 0%,rgba(14,10,6,1) 100%)`,
          borderTop:"1px solid rgba(255,255,255,0.08)",borderRadius:"22px 22px 0 0",
          padding:"12px 16px 20px",animation:"b21bs 0.28s cubic-bezier(0.16,1,0.3,1)",zIndex:9999,
        }}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 4px 12px"}}>
            <span style={{fontSize:10,letterSpacing:"0.2em",textTransform:"uppercase",color:"rgba(255,255,255,0.4)",fontFamily:FN.mono,fontWeight:600}}>Enter amount</span>
            <button onClick={()=>setSendShowKeypad(false)} className="b21p" style={{background:"transparent",border:"none",color:C.orange,cursor:"pointer",fontSize:13,fontWeight:700,padding:"4px 10px",fontFamily:FN.body}}>Done</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {["1","2","3","4","5","6","7","8","9",".","0","⌫"].map(k=>(
              <button key={k} onClick={()=>pressKey(k)} className="b21p" style={{
                padding:"14px 0",borderRadius:14,
                background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",
                color:C.white,cursor:"pointer",fontSize:22,fontWeight:300,fontFamily:FN.mono,
              }}>{k==="⌫"?<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{display:"inline-block",verticalAlign:"middle"}}><path d="M22 3H7l-5 9 5 9h15a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg>:k}</button>
            ))}
          </div>
        </div>
      </div>}

      {/* ───── Recent Contacts modal (for >10 entries) ───── */}
      {sendShowRecents&&LARGE_RECENTS&&<div onClick={()=>setSendShowRecents(false)} style={{position:"fixed",inset:0,zIndex:9998,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(8px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
        <div onClick={e=>e.stopPropagation()} style={{position:"relative",width:"100%",maxWidth:480,background:C.surface,borderRadius:"22px 22px 0 0",padding:"20px",paddingBottom:40,maxHeight:"80vh",overflowY:"auto",animation:"b21bs 0.28s cubic-bezier(0.16,1,0.3,1)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <h3 style={{fontSize:16,fontWeight:700,color:C.white,margin:0,fontFamily:FN.display}}>Recent contacts</h3>
            <button onClick={()=>setSendShowRecents(false)} className="b21p" style={{width:34,height:34,borderRadius:17,background:"rgba(255,255,255,0.06)",border:`1px solid ${C.border}`,color:C.white,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          {recentContacts.map(c=>(
            <div key={c.address} onClick={()=>{setSendRecipient(c.address);setSendShowRecents(false);}} className="b21p" style={{padding:"12px 14px",borderRadius:12,display:"flex",alignItems:"center",gap:12,cursor:"pointer",background:"rgba(255,255,255,0.025)",border:`1px solid ${C.border}`,marginBottom:6}}>
              {(()=>{const palette=["#F7931A","#34D399","#60A5FA","#A78BFA","#FBBF24","#F87171","#FB923C","#2DD4BF"];let h=0;for(let k=0;k<c.address.length;k++)h=((h<<5)-h+c.address.charCodeAt(k))|0;const col=palette[Math.abs(h)%palette.length];const init=c.name?c.name.charAt(0).toUpperCase():"₿";return(<div style={{width:36,height:36,borderRadius:18,background:`linear-gradient(135deg,${col},${col}99)`,display:"flex",alignItems:"center",justifyContent:"center",color:"#1a1410",fontSize:13,fontWeight:700,flexShrink:0,fontFamily:c.name?FN.body:FN.mono}}>{init}</div>);})()}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:C.white,marginBottom:2}}>{c.name||"Bitcoin address"}</div>
                <div style={{fontSize:11,color:C.gray,fontFamily:FN.mono,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.address}</div>
              </div>
            </div>
          ))}
        </div>
      </div>}

      {/* ───── Address Book modal (for >10 entries) ───── */}
      {sendShowAddrBook&&LARGE_BOOK&&(()=>{
        const sq=sendBookSearch.trim().toLowerCase();
        const filtered=sq?addressBook.filter(e=>e.name.toLowerCase().includes(sq)||e.address.toLowerCase().includes(sq)):addressBook;
        return(<div onClick={()=>setSendShowAddrBook(false)} style={{position:"fixed",inset:0,zIndex:9998,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(8px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()} style={{position:"relative",width:"100%",maxWidth:480,background:C.surface,borderRadius:"22px 22px 0 0",padding:"20px",paddingBottom:40,maxHeight:"80vh",overflowY:"auto",animation:"b21bs 0.28s cubic-bezier(0.16,1,0.3,1)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div>
                <h3 style={{fontSize:16,fontWeight:700,color:C.white,margin:0,fontFamily:FN.display}}>Address book</h3>
                <div style={{fontSize:11,color:C.gray,marginTop:2}}>{sq?`${filtered.length} of ${addressBook.length}`:`${addressBook.length} contacts`}</div>
              </div>
              <button onClick={()=>setSendShowAddrBook(false)} className="b21p" style={{width:34,height:34,borderRadius:17,background:"rgba(255,255,255,0.06)",border:`1px solid ${C.border}`,color:C.white,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{position:"relative",marginBottom:12}}>
              <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:C.gray,opacity:0.5,pointerEvents:"none"}}>{I.search}</span>
              <input value={sendBookSearch} onChange={e=>setSendBookSearch(e.target.value)} placeholder="Search by name or address" style={{width:"100%",padding:"11px 32px 11px 36px",borderRadius:RD.sm,border:`1px solid ${C.border}`,background:C.bg,color:C.white,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
            </div>
            {filtered.length===0?<div style={{padding:"24px 16px",textAlign:"center",fontSize:12,color:C.gray}}>No contacts match "{sendBookSearch}"</div>:
              filtered.map(e=>(
                <div key={e.address} onClick={()=>{setSendRecipient(e.address);setSendShowAddrBook(false);setSendBookSearch("");}} className="b21p" style={{padding:"12px 14px",borderRadius:12,display:"flex",alignItems:"center",gap:12,cursor:"pointer",background:"rgba(255,255,255,0.025)",border:`1px solid ${C.border}`,marginBottom:6}}>
                  {(()=>{const palette=["#F7931A","#34D399","#60A5FA","#A78BFA","#FBBF24","#F87171","#FB923C","#2DD4BF"];let h=0;for(let k=0;k<e.address.length;k++)h=((h<<5)-h+e.address.charCodeAt(k))|0;const col=palette[Math.abs(h)%palette.length];return(<div style={{width:36,height:36,borderRadius:18,background:`linear-gradient(135deg,${col},${col}99)`,display:"flex",alignItems:"center",justifyContent:"center",color:"#1a1410",fontSize:13,fontWeight:700,flexShrink:0}}>{e.name.charAt(0).toUpperCase()}</div>);})()}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:C.white,marginBottom:2}}>{e.name}</div>
                    <div style={{fontSize:11,color:C.gray,fontFamily:FN.mono,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.address}</div>
                  </div>
                </div>
              ))
            }
          </div>
        </div>);
      })()}

      <style>{`@keyframes b21cb{0%,50%{opacity:1}51%,100%{opacity:0}}`}</style>
    </div>);
  };

  /* ═══ RECEIVE TAB (inline render, NOT component) ═══ */
  const renderReceiveTab=()=>{
    const doCopy=()=>{if(navigator.clipboard?.writeText){navigator.clipboard.writeText(address);}else{const ta=document.createElement('textarea');ta.value=address;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);}setRcCopied(true);setTimeout(()=>setRcCopied(false),2000);};
    const doShare=async()=>{try{await navigator.share?.({title:t("bitcoin")+" "+t("addressType"),text:address});}catch{}};
    const hasShare=typeof navigator.share==="function";
    // Highlighted address: first 4 + last 4 in orange, middle in gray
    const addrStart=address.slice(0,4);
    const addrEnd=address.slice(-4);
    const addrMid=address.slice(4,-4);
    return(<div style={{textAlign:"center"}}>
      {/* QR in clean card */}
      <div style={{display:"inline-block",position:"relative",padding:16,background:C.surface,borderRadius:RD.xl,border:`1px solid ${C.border}`,marginBottom:16}}>
        {qrUrl&&<img src={qrUrl} alt="QR" style={{width:200,height:200,borderRadius:RD.lg,display:"block"}}/>}
        {/* Corner accents */}
        {[{t:4,l:4,bt:"2px solid",bl:"2px solid"},{t:4,r:4,bt:"2px solid",br:"2px solid"},{b:4,l:4,bb:"2px solid",bl:"2px solid"},{b:4,r:4,bb:"2px solid",br:"2px solid"}].map((s,i)=>
          <div key={i} style={{position:"absolute",width:18,height:18,top:s.t,bottom:s.b,left:s.l,right:s.r,borderTop:s.bt?`${s.bt} ${C.orange}`:"none",borderRight:s.br?`${s.br} ${C.orange}`:"none",borderBottom:s.bb?`${s.bb} ${C.orange}`:"none",borderLeft:s.bl?`${s.bl} ${C.orange}`:"none",borderRadius:2}}/>)}
      </div>

      {/* Address */}
      <div style={{marginBottom:14,padding:"12px 16px",background:C.surface,borderRadius:RD.md,border:`1px solid ${C.border}`}}>
        <div style={{fontFamily:FN.mono,fontSize:13.5,lineHeight:1.7,wordBreak:"break-all",textAlign:"center",letterSpacing:"0.03em",color:C.white}}>
          {address}
        </div>
      </div>

      {/* Action buttons — Copy + Share side by side */}
      <div style={{display:"grid",gridTemplateColumns:hasShare?"1fr 1fr":"1fr",gap:8,marginBottom:12}}>
        <button onClick={doCopy} className="b21p" style={{padding:"12px",borderRadius:RD.md,border:`1px solid ${rcCopied?C.green:C.orange}30`,background:`${rcCopied?C.green:C.orange}08`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontSize:13,fontWeight:600,color:rcCopied?C.green:C.orange}}>
          {I.copy} {rcCopied?t("copiedCheck"):t("copyAddress")}
        </button>
        {hasShare&&<button onClick={doShare} className="b21p" style={{padding:"12px",borderRadius:RD.md,border:`1px solid ${C.border}`,background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontSize:13,fontWeight:600,color:C.grayLight}}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          {t("share")}
        </button>}
      </div>

      {/* Request Amount — expandable */}
      {(()=>{
        const showAmt=!!reqAmt||rcShowAmt;
        const fiatLabel=price.currency?.toUpperCase()||"USD";
        const amtUnits=[curUnit.symbol,curUnit.id!=="sats"?"sats":null,fiatLabel].filter(Boolean);
        // Handle raw input — store raw string for display, convert to BTC for QR
        const handleAmtInput=(val)=>{
          setRcAmtRaw(val);
          if(!val||val===""||val==="."){setReqAmt("");return;}
          const num=parseFloat(val);
          if(isNaN(num)||num<=0){setReqAmt("");return;}
          if(rcAmtUnit==="sats")setReqAmt(String(num/1e8));
          else if(rcAmtUnit===curUnit.symbol)setReqAmt(String(num/curUnit.factor));
          else setReqAmt(price.fiat>0?String(num/price.fiat):"");
        };
        // When switching units, convert the current BTC value to new unit display
        const switchUnit=(newUnit)=>{
          const btcVal=parseFloat(reqAmt)||0;
          setRcAmtUnit(newUnit);
          if(!btcVal){setRcAmtRaw("");return;}
          if(newUnit==="sats")setRcAmtRaw(String(Math.round(btcVal*1e8)));
          else if(newUnit===curUnit.symbol){const uv=(btcVal*curUnit.factor).toFixed(curUnit.decimals);setRcAmtRaw(curUnit.decimals>0?uv.replace(/0+$/,"").replace(/\.$/,""):uv);}
          else setRcAmtRaw(price.fiat>0?(btcVal*price.fiat).toFixed(2):"");
        };
        // Conversion line
        const convLine=()=>{
          if(!reqAmt)return null;
          const btcVal=parseFloat(reqAmt);
          if(rcAmtUnit===curUnit.symbol)return `${Math.round(btcVal*1e8).toLocaleString()} sats ≈ ${fmtFiat(btcVal*price.fiat)}`;
          if(rcAmtUnit==="sats")return `${fmtAmt(btcVal)} ≈ ${fmtFiat(btcVal*price.fiat)}`;
          return `${fmtAmt(btcVal)} = ${Math.round(btcVal*1e8).toLocaleString()} sats`;
        };
        return showAmt?(
          <div style={{background:C.surface,borderRadius:RD.md,border:`1px solid ${C.border}`,padding:"12px 14px",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
              <span style={{fontSize:11,color:C.gray,fontWeight:600,flex:1,textAlign:"left"}}>{t("requestAmount")}</span>
              <button onClick={()=>{setReqAmt("");setRcAmtRaw("");setRcShowAmt(false);}} style={{background:"none",border:"none",cursor:"pointer",color:C.gray,fontSize:11,fontWeight:600,padding:"2px 4px"}}>✕ {t("clear")}</button>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:0,background:C.bg,borderRadius:RD.sm,border:`1px solid ${C.border}`,overflow:"hidden"}}>
              <input type="number" value={rcAmtRaw} onChange={e=>handleAmtInput(e.target.value)} placeholder={rcAmtUnit==="sats"?"0":"0.00"} style={{flex:1,padding:"10px 12px",background:"transparent",border:"none",outline:"none",color:C.white,fontSize:15,fontFamily:FN.mono,fontWeight:600}}/>
              {/* Unit toggle */}
              <div style={{display:"flex",borderLeft:`1px solid ${C.border}`}}>
                {amtUnits.map(u=><button key={u} onClick={()=>switchUnit(u)} style={{padding:"10px 10px",background:rcAmtUnit===u?`${C.orange}15`:"transparent",border:"none",cursor:"pointer",color:rcAmtUnit===u?C.orange:C.gray,fontSize:11,fontWeight:700,borderRight:u!==amtUnits[amtUnits.length-1]?`1px solid ${C.border}`:"none"}}>{u}</button>)}
              </div>
            </div>
            {reqAmt&&<div style={{fontSize:11,color:C.gray,marginTop:6,textAlign:"center"}}>{convLine()}</div>}
          </div>
        ):(
          <button onClick={()=>setRcShowAmt(true)} className="b21p" style={{background:"none",border:"none",cursor:"pointer",padding:"8px",fontSize:12,fontWeight:600,color:C.gray,display:"flex",alignItems:"center",justifyContent:"center",gap:5,width:"100%"}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {t("requestSpecificAmount")}
          </button>
        );
      })()}

      {/* Manage Addresses */}
      {!isWatchOnly&&walletKeyData&&(()=>{
        const curType=activeWallet?.addressType||addressTypeIdToKey(getAddressType(address)||"native-segwit");
        const typeAddrs=(activeWallet?.addresses||[]).filter(a=>a.type===curType);
        return(<div style={{display:"flex",justifyContent:"center",marginTop:4}}>
          <button onClick={()=>setShowAddrManager(true)} className="b21p" style={{background:"none",border:"none",cursor:"pointer",fontSize:12,fontWeight:600,color:C.gray,display:"flex",alignItems:"center",gap:5,padding:"8px 0"}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            Manage Addresses{typeAddrs.length>1?` (${typeAddrs.length})`:""}
          </button>
        </div>);
      })()}
    </div>);
  };

  /* ═══ TRANSFER TAB — Merged Send + Receive (inline render, no inner component) ═══ */
  const renderTransferTab=()=>{
    // Hide header chrome (toggle + recent contacts) during review/broadcast/success steps
    const showHeader=!(transferMode==="send"&&sendStep>1);
    return(<div>
      {/* Toggle: Receive / Send — compose step only */}
      {showHeader&&<div style={{display:"flex",gap:4,background:C.surface,borderRadius:RD.lg,padding:4,marginBottom:16,border:`1px solid ${C.border}`}}>
        {isWatchOnly?
          <div style={{flex:1,padding:"12px",textAlign:"center",color:C.gray,fontSize:12}}>{t("watchOnlySendDisabled")}</div>:
          [{id:"receive",icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="17" y1="7" x2="7" y2="17"/><polyline points="17 17 7 17 7 7"/></svg>,l:t("receive",lang)},{id:"send",icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>,l:t("send",lang)}].map(m=><button key={m.id} onClick={()=>setTransferMode(m.id)} className="b21p" style={{flex:1,padding:"11px 12px",borderRadius:RD.md,border:transferMode===m.id?"none":`1px solid transparent`,cursor:"pointer",background:transferMode===m.id?`linear-gradient(135deg,${C.orange},${C.orangeDark})`:"transparent",boxShadow:transferMode===m.id?`0 2px 8px ${C.orangeGlow}`:"none",color:transferMode===m.id?"#FFF":C.gray,fontSize:13,fontWeight:700,fontFamily:FN.body,transition:"all 0.25s",letterSpacing:"0.01em",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>{m.icon}{m.l}</button>)}
      </div>}
      {/* Recent contacts and address book pills are now inside renderSendFlow step 1 */}
      {/* Content — inline render, NOT component */}
      {transferMode==="send"&&!isWatchOnly?renderSendFlow():renderReceiveTab()}
    </div>);
  };

  /* ═══ TRANSACTION DETAIL VIEW (inline render, NOT component) ═══ */
  const renderTxDetail=()=>{
    if(!txDetail)return null;
    const tx=txDetail;const isSend=tx.vin?.some(v=>isMyAddr(v.prevout?.scriptpubkey_address));
    const amount=isSend?tx.vout?.filter(v=>!isMyAddr(v.scriptpubkey_address)).reduce((s,v)=>s+v.value,0)/1e8:tx.vout?.filter(v=>isMyAddr(v.scriptpubkey_address)).reduce((s,v)=>s+v.value,0)/1e8;
    const isPend=!tx.status?.confirmed;const isRbf=tx.vin?.some(v=>(v.sequence||0)<0xfffffffe);

    const handleRBF=async()=>{
      setTdRbfErr("");setTdRbfing(true);
      try{
        if(!walletKeyData)throw new Error(t("noSigningKeyRbf"));
        let kp;const{seed:ps2,passphrase:pp2}=parseSeedData(walletKeyData);const sk=(ps2||walletKeyData).trim().toLowerCase();
        if(validateSeedPhrase(sk)){const r=await getKeyPairSmart(sk,address,testnet,pp2);kp=r.keyPair;}
        else{kp=getKeyPairFromWIF(walletKeyData.trim(),testnet);}
        const newFeeRate=parseInt(tdRbfRate);if(!newFeeRate||newFeeRate<=(tx.fee/(tx.weight/4)))throw new Error(t("newFeeRateMustBeHigher"));
        const recipient=isSend?tx.vout.find(v=>!isMyAddr(v.scriptpubkey_address))?.scriptpubkey_address:address;
        const rbfSafeUtxos=(utxos||[]).filter(u=>!(frozenUTXOs||[]).includes(`${u.txid}:${u.vout}`));
        const result=buildTransaction({utxos:rbfSafeUtxos,recipientAddress:recipient,amountSats:Math.round(amount*1e8),feeRate:newFeeRate,keyPair:kp,senderAddress:address,enableRBF:true,testnet});
        const bc=await broadcastTx(result.txHex,testnet);setTdRbfResult(bc);setTdShowRbf(false);
        clearAddressCache(address);setTimeout(()=>fetchData(true),3000);
      }catch(err){setTdRbfErr(getUserFriendlyError(err));}
      setTdRbfing(false);
    };

    const counterparty=isSend?tx.vout?.find(v=>!isMyAddr(v.scriptpubkey_address))?.scriptpubkey_address:tx.vin?.[0]?.prevout?.scriptpubkey_address;
    return(<div>
      <Bk onClick={()=>setTxDetail(null)} C={C}/>
      {/* Header — compact */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <div style={{width:42,height:42,borderRadius:21,display:"flex",alignItems:"center",justifyContent:"center",background:isSend?C.redGlow:C.greenGlow,color:isSend?C.red:C.green,flexShrink:0}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">{isSend?<><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></>:<><line x1="17" y1="7" x2="7" y2="17"/><polyline points="17 17 7 17 7 7"/></>}</svg>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:18,fontWeight:800,color:C.white,fontFamily:FN.display}}>{isSend?t("sent"):t("received")} {t("bitcoinSentReceived")}</div>
          <div style={{fontSize:12,color:C.gray,marginTop:1}}>{isPend?<span style={{color:C.yellow}}>{t("pendingConfirmation")}</span>:timeAgo(tx.status?.block_time)}</div>
        </div>
      </div>
      {/* Amount + Details */}
      <Crd C={C} style={{marginBottom:12}}>
        <div style={{textAlign:"center",marginBottom:12}}>
          <div style={{fontSize:24,fontWeight:800,color:isSend?C.white:C.green,fontFamily:FN.mono}}>{isSend?"−":"+"}{fmtAmt(amount||0)}</div>
          <div style={{fontSize:13,color:C.grayLight}}>≈ {stealthMode?"••••":fmtFiat((amount||0)*price.fiat)}</div>
        </div>
        <Div C={C} sp={8}/>
        {[{l:t("status"),v:isPend?t("pending"):t("confirmed"),c:isPend?C.yellow:C.green},tx.status?.block_time&&{l:t("date"),v:new Date(tx.status.block_time*1000).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"})},{l:t("fee"),v:`${fmtAmt((tx.fee||0)/1e8)} (${Math.round((tx.fee||0)/(tx.weight/4||1))} sat/vB)`},tx.status?.block_height&&{l:t("block"),v:`#${tx.status.block_height.toLocaleString()}`},{l:t("rbf"),v:isRbf?t("enabled"):t("disabled")}].filter(Boolean).map((r,i)=>
          <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 0"}}><span style={{fontSize:11,color:C.gray}}>{r.l}</span><span style={{fontSize:12,fontWeight:600,color:r.c||C.white,fontFamily:FN.mono}}>{r.v}</span></div>)}
      </Crd>
      {/* To/From + TXID — single compact card */}
      <Crd C={C} style={{marginBottom:12}}>
        {counterparty&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontSize:10,color:C.gray,textTransform:"uppercase",letterSpacing:"0.04em",fontWeight:600}}>{isSend?t("to"):t("from")}</div>
            <button onClick={()=>{if(navigator.clipboard?.writeText){navigator.clipboard.writeText(counterparty);setToast(null);setTimeout(()=>setToast({msg:"Address Copied",_k:Date.now()}),50);}}} className="b21p" style={{background:"none",border:"none",cursor:"pointer",color:C.grayLight,padding:2,display:"flex"}}>{I.copy}</button></div>
          <div style={{fontSize:10.5,fontFamily:FN.mono,color:C.white,wordBreak:"break-all",lineHeight:1.5,margin:"4px 0 10px"}}>{counterparty}</div>
          <Div C={C} sp={8}/>
        </>}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontSize:10,color:C.gray,textTransform:"uppercase",letterSpacing:"0.04em",fontWeight:600}}>Transaction ID</div>
          <button onClick={()=>{if(navigator.clipboard?.writeText){navigator.clipboard.writeText(tx.txid);setToast(null);setTimeout(()=>setToast({msg:"Transaction ID Copied",_k:Date.now()}),50);}}} className="b21p" style={{background:"none",border:"none",cursor:"pointer",color:C.grayLight,padding:2,display:"flex"}}>{I.copy}</button></div>
        <div style={{fontSize:10.5,fontFamily:FN.mono,color:C.white,wordBreak:"break-all",lineHeight:1.5,margin:"4px 0 10px"}}>{tx.txid}</div>
        <button onClick={()=>window.open(`${EXPLORER_BASE}/tx/${tx.txid}`,"_blank")} className="b21p" style={{width:"100%",padding:"10px",borderRadius:RD.md,border:`1px solid ${C.blue}30`,background:`${C.blue}08`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontSize:12,fontWeight:600,color:C.blue}}>
          {I.ext} {t("viewOnMempool")}
        </button>
      </Crd>
      {/* Label — inline compact */}
      <Crd C={C} style={{marginBottom:12,padding:"10px 14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,color:C.grayLight,fontSize:11,fontWeight:600}}>{I.tag} {t("label")}{tdLbl&&!tdEditLbl&&<span style={{color:C.white,marginLeft:4}}>{tdLbl}</span>}</div>
          {!tdEditLbl?<button onClick={()=>setTdEditLbl(true)} className="b21p" style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:C.orange}}>{tdLbl?t("edit"):t("add")}</button>:
            <button onClick={()=>{setTxLbl(tx.txid,tdLbl);setTdEditLbl(false);}} className="b21p" style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:C.green}}>{t("save")}</button>}
        </div>
        {tdEditLbl&&<Inp C={C} value={tdLbl} onChange={e=>setTdLbl(e.target.value)} placeholder={t("labelPlaceholder")} style={{marginTop:6,fontSize:12}}/>}
      </Crd>
      {/* RBF Speed-up (outgoing only — can't speed up incoming tx from another wallet) */}
      {isSend&&isPend&&isRbf&&!tdRbfResult&&<Crd C={C} style={{marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontSize:13,fontWeight:700,color:C.orange}}>⚡ {t("speedUpRbf")}</div><div style={{fontSize:11,color:C.gray}}>{t("replaceWithHigherFee")}</div></div>
          <SBtn C={C} color={C.orange} fw={false} onClick={()=>setTdShowRbf(!tdShowRbf)}>{tdShowRbf?t("cancel"):t("speedUp")}</SBtn>
        </div>
        {tdShowRbf&&<div style={{marginTop:14}}>
          <div style={{fontSize:12,fontWeight:600,color:C.gray,marginBottom:8}}>{t("newFeeRate")}</div>
          <Inp C={C} mono type="number" value={tdRbfRate} onChange={e=>setTdRbfRate(e.target.value)} placeholder={`Current: ~${Math.round((tx.fee||0)/(tx.weight/4||1))} sat/vB`} style={{marginBottom:10}}/>
          {!walletKeyData&&<WBox C={C}>{t("noRbfKey")}</WBox>}
          <EBox C={C}>{tdRbfErr}</EBox>
          <PBtn C={C} onClick={handleRBF} disabled={tdRbfing||!tdRbfRate||!walletKeyData}>{tdRbfing?t("broadcasting"):t("broadcastReplacement")}</PBtn>
        </div>}
      </Crd>}
      {isSend&&tdRbfResult&&<Crd C={C} glow style={{marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,color:C.green,marginBottom:4}}>✓ {t("replacementBroadcast")}</div>
        <div style={{fontSize:11,color:C.gray,fontFamily:FN.mono,wordBreak:"break-all"}}>{tdRbfResult.txid}</div>
      </Crd>}
    </div>);
  };

  /* ═══ ALL TRANSACTIONS SCREEN ═══ */
  const renderAllTxScreen=()=>{
    const filtered=transactions.filter(tx=>{
      if(txFilter!=="all"){const s=tx.vin?.some(v=>isMyAddr(v.prevout?.scriptpubkey_address));if(txFilter==="sent"&&!s)return false;if(txFilter==="received"&&s)return false;}
      if(txSearch.trim()){const q=txSearch.toLowerCase();if(!tx.txid?.toLowerCase().includes(q)&&!tx.vout?.some(v=>v.scriptpubkey_address?.toLowerCase().includes(q))&&!tx.vin?.some(v=>v.prevout?.scriptpubkey_address?.toLowerCase().includes(q))&&!(txLabels[tx.txid]||"").toLowerCase().includes(q))return false;}
      return true;
    });
    const grouped=groupByDate(filtered);
    return(<div>
      <Bk onClick={()=>{setShowAllTx(false);setTxSearch("");setTxFilter("all");setTxVisible(20);}} C={C}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div><h3 style={{fontSize:20,fontWeight:800,color:C.white,margin:0,fontFamily:FN.display}}>{t("transactions")}</h3>
          <div style={{fontSize:12,color:C.gray,marginTop:2}}>{transactions.length} {t("total")} · {filtered.length} {t("shown")}</div>
        </div>
        <div style={{display:"flex",gap:4,alignItems:"center"}}>
          {transactions.length>0&&<button onClick={exportCSV} className="b21p" title={t("exportCsv")} style={{background:"none",border:"none",cursor:"pointer",color:C.gray,padding:4,display:"flex",opacity:0.6}}>{I.dl}</button>}
          <button onClick={debouncedRefresh} disabled={loading||isRefreshing} className="b21p" style={{background:"none",border:"none",cursor:loading?"default":"pointer",color:C.orange,padding:4,opacity:loading||isRefreshing?0.4:0.7,display:"flex",animation:isRefreshing?"b21sp 1s linear infinite":"none"}}>{I.ref}</button>
        </div>
      </div>
      {/* Search */}
      <div style={{position:"relative",marginBottom:8}}>
        <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:C.gray,opacity:0.5}}>{I.search}</span>
        <Inp C={C} value={txSearch} onChange={e=>setTxSearch(e.target.value)} placeholder={t("searchTransactions")} style={{paddingLeft:36,fontSize:12,padding:"11px 14px 11px 36px"}}/>
      </div>
      {/* Filter tabs */}
      <div style={{display:"flex",gap:3,marginBottom:14}}>
        {[{id:"all",l:t("all",lang)},{id:"received",l:t("received",lang)},{id:"sent",l:t("sent",lang)}].map(f=><button key={f.id} onClick={()=>setTxFilter(f.id)} className="b21p" style={{flex:1,padding:"8px",borderRadius:RD.sm,border:"none",cursor:"pointer",background:txFilter===f.id?C.orangeMuted:C.surface,color:txFilter===f.id?C.orange:C.gray,fontSize:12,fontWeight:600}}>{f.l}</button>)}
      </div>
      {/* Grouped list with pagination */}
      {(()=>{
        const visible=filtered.slice(0,txVisible);
        const hasMore=filtered.length>txVisible;
        const visGrouped=groupByDate(visible);
        return filtered.length===0?<Empty icon="📋" title={t("noTransactionsFound")} desc={txSearch?t("tryDifferentSearch"):t("noTransactionsMatchFilter")} C={C}/>:<>
          {Object.entries(visGrouped).map(([dl,txs])=><div key={dl}>
            <div style={{fontSize:11,fontWeight:600,color:C.gray,letterSpacing:"0.06em",textTransform:"uppercase",padding:"12px 0 4px",borderBottom:`1px solid ${C.border}`}}>{dl}</div>
            {txs.map((tx,i)=>renderTxItem(tx,i))}
          </div>)}
          {hasMore&&<button onClick={()=>setTxVisible(v=>v+20)} className="b21p" style={{width:"100%",padding:"14px",marginTop:12,borderRadius:RD.md,border:`1px solid ${C.border}`,background:C.surface,color:C.gray,fontSize:13,fontWeight:600,cursor:"pointer"}}>Load More ({filtered.length-txVisible} remaining)</button>}
        </>;
      })()}
    </div>);
  };

  /* ═══ RADAR TAB — Bitcoin Intelligence (inline render, NOT component) ═══ */
  const renderRadarTab=()=>{
    const fgColor=(v)=>v<=25?C.red:v<=45?"#FF6B35":v<=55?C.yellow:v<=75?C.green:"#00C853";
    const fmtHash=(h)=>{if(!h)return"—";if(h>=1e18)return(h/1e18).toFixed(1)+" EH/s";if(h>=1e15)return(h/1e15).toFixed(1)+" PH/s";return(h/1e12).toFixed(1)+" TH/s";};
    const fmtB=(n)=>{if(!n)return"—";if(n>=1e12)return"$"+(n/1e12).toFixed(2)+"T";if(n>=1e9)return"$"+(n/1e9).toFixed(2)+"B";if(n>=1e6)return"$"+(n/1e6).toFixed(1)+"M";return"$"+n.toLocaleString();};

    // ── Whale Activity sub-view ──
    if(radarSection==="whale"){
      return(<div>
        <Bk onClick={()=>setRadarSection(null)} C={C}/>
        <PT title={t("whaleActivity")} sub={t("monitorLargeTx")} C={C}/>
        <div style={{display:"flex",gap:6,marginBottom:16}}>
          {["10","50","100","500","1000"].map(t=><button key={t} onClick={()=>{setWhaleThreshold(t);localStorage.setItem("btc_whale_thresh",t);}} className="b21p" style={{flex:1,padding:"10px 4px",borderRadius:RD.md,border:`1px solid ${whaleThreshold===t?C.orange+"40":C.border}`,background:whaleThreshold===t?C.orangeMuted:C.surface,color:whaleThreshold===t?C.orange:C.gray,fontSize:12,fontWeight:600,cursor:"pointer"}}>≥{t}</button>)}
        </div>
        {whaleLoading?<div style={{textAlign:"center",padding:30}}><Spin sz={24} color={C.orange}/></div>:
          whales.length===0?<Empty icon="🐋" title={t("noWhale")} desc={t("noWhaleDesc")} C={C}/>:
          whales.map((w,i)=><Crd key={i} C={C} style={{marginBottom:8,...stagger(i)}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontSize:15,fontWeight:700,color:C.orange,fontFamily:FN.mono}}>{fmtAmt(w.totalOutputBTC||w.amount||w.value/1e8)}</div>
                <div style={{fontSize:11,color:C.gray}}>{w.txid?shortTxid(w.txid):t("unknown")} · {w.inputCount||0}→{w.outputCount||0}</div></div>
              {w.txid&&<button onClick={()=>window.open(`${EXPLORER_BASE}/tx/${w.txid}`,"_blank")} className="b21p" style={{background:"none",border:"none",cursor:"pointer",color:C.blue,display:"flex"}}>{I.ext}</button>}
            </div>
          </Crd>)}
      </div>);
    }

    // ── Market Pulse sub-view ──
    if(radarSection==="market"){
      return(<div>
        <Bk onClick={()=>setRadarSection(null)} C={C}/>
        <PT title={t("marketPulse")} sub={t("bitcoinMarketIntel")} C={C}/>
        {/* Price */}
        <Crd C={C} glow style={{marginBottom:12,textAlign:"center"}}>
          <div style={{fontSize:11,color:C.gray,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>{t("bitcoinPrice")}</div>
          <div style={{fontSize:32,fontWeight:800,color:C.white,fontFamily:FN.mono}}>{fmtFiat(price.fiat)}</div>
          <Badge color={price.change24h>=0?C.green:C.red} bg={price.change24h>=0?C.greenGlow:C.redGlow} style={{marginTop:8}}>{price.change24h>=0?"↑":"↓"} {Math.abs(price.change24h).toFixed(2)}% 24h</Badge>
        </Crd>
        {/* Fear & Greed */}
        {rFearGreed&&<Crd C={C} style={{marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:C.grayLight}}>{t("fearGreedIndex")}</div>
            <Badge color={fgColor(rFearGreed.value)} bg={fgColor(rFearGreed.value)+"15"}>{rFearGreed.classification}</Badge>
          </div>
          <div style={{position:"relative",height:8,borderRadius:4,background:C.grayDim,overflow:"hidden",marginBottom:8}}>
            <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${rFearGreed.value}%`,borderRadius:4,background:`linear-gradient(90deg,${C.red},${C.yellow},${C.green})`,transition:"width 0.5s"}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <span style={{fontSize:11,color:C.gray}}>{t("extreme_fear")}</span>
            <span style={{fontSize:20,fontWeight:800,color:fgColor(rFearGreed.value),fontFamily:FN.mono}}>{rFearGreed.value}</span>
            <span style={{fontSize:11,color:C.gray}}>{t("extreme_greed")}</span>
          </div>
        </Crd>}
        {/* Market Stats */}
        {rMarketData&&<Crd C={C} style={{marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:C.grayLight,marginBottom:12}}>{t("marketStatistics")}</div>
          {[
            {l:t("marketCap"),v:fmtB(rMarketData.marketCap),c:C.orange},
            {l:t("volume24h"),v:fmtB(rMarketData.volume24h),c:C.blue},
            {l:t("circulatingSupply"),v:rMarketData.supply?(rMarketData.supply/1e6).toFixed(2)+"M BTC":"—"},
            {l:t("btcDominance"),v:rMarketData.dominance?rMarketData.dominance.toFixed(1)+"%":"—",c:C.orange},
            {l:t("allTimeHigh"),v:rMarketData.ath?fmtFiat(rMarketData.ath):"—",c:C.green},
            {l:t("fromAth"),v:rMarketData.athChangePercent?rMarketData.athChangePercent.toFixed(1)+"%":"—",c:C.red},
          ].map((r,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:i<5?`1px solid ${C.border}08`:"none"}}>
            <span style={{fontSize:12,color:C.gray}}>{r.l}</span>
            <span style={{fontSize:13,fontWeight:600,color:r.c||C.white,fontFamily:FN.mono}}>{r.v}</span>
          </div>)}
        </Crd>}
      </div>);
    }

    // ── Network Health sub-view ──
    if(radarSection==="network"){
      return(<div>
        <Bk onClick={()=>setRadarSection(null)} C={C}/>
        <PT title={t("networkHealth")} sub={t("bitcoinNetworkStatus")} C={C}/>
        {rMempoolStats?<>
          <Crd C={C} glow style={{marginBottom:12,textAlign:"center"}}>
            <div style={{fontSize:11,color:C.gray,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>{t("blockHeight")}</div>
            <div style={{fontSize:32,fontWeight:800,color:C.orange,fontFamily:FN.mono}}>#{(rMempoolStats.blockHeight||0).toLocaleString()}</div>
          </Crd>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <Crd C={C} pad="14px"><div style={{fontSize:10,color:C.gray,textTransform:"uppercase",marginBottom:6}}>{t("mempoolTxs")}</div>
              <div style={{fontSize:20,fontWeight:800,color:C.blue,fontFamily:FN.mono}}>{(rMempoolStats.txCount||0).toLocaleString()}</div>
              <div style={{fontSize:10,color:C.gray,marginTop:2}}>{rMempoolStats.txCount>50000?"🔴 "+t("congested"):rMempoolStats.txCount>20000?"🟡 "+t("busy"):"🟢 "+t("clearStatus")}</div>
            </Crd>
            <Crd C={C} pad="14px"><div style={{fontSize:10,color:C.gray,textTransform:"uppercase",marginBottom:6}}>{t("mempoolSize")}</div>
              <div style={{fontSize:20,fontWeight:800,color:C.purple,fontFamily:FN.mono}}>{rMempoolStats.vsize?(rMempoolStats.vsize/1e6).toFixed(1):0}</div>
              <div style={{fontSize:10,color:C.gray,marginTop:2}}>{t("millionVBytes")}</div>
            </Crd>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <Crd C={C} pad="14px"><div style={{fontSize:10,color:C.gray,textTransform:"uppercase",marginBottom:6}}>{t("hashrate")}</div>
              <div style={{fontSize:18,fontWeight:800,color:C.green,fontFamily:FN.mono}}>{fmtHash(rMempoolStats.hashrate)}</div>
            </Crd>
            <Crd C={C} pad="14px"><div style={{fontSize:10,color:C.gray,textTransform:"uppercase",marginBottom:6}}>{t("difficulty")}</div>
              <div style={{fontSize:18,fontWeight:800,color:C.orange,fontFamily:FN.mono}}>{rMempoolStats.difficulty?(rMempoolStats.difficulty/1e12).toFixed(2)+"T":"—"}</div>
            </Crd>
          </div>
        </>:<div style={{textAlign:"center",padding:30}}><Spin sz={24} color={C.orange}/></div>}
      </div>);
    }

    // ── Fee Monitor sub-view ──
    if(radarSection==="fees"){
      return(<div>
        <Bk onClick={()=>setRadarSection(null)} C={C}/>
        <PT title={t("feeMonitor")} sub={t("currentFees")} C={C}/>
        {fees?<>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
            {[{l:t("economy"),v:fees.hourFee,t:"~60min",c:C.green},{l:t("standard"),v:fees.halfHourFee,t:"~30min",c:C.orange},{l:t("priority"),v:fees.fastestFee,t:"~10min",c:C.red}].map((f,i)=>
              <Crd key={i} C={C} pad="14px" style={{textAlign:"center"}}>
                <div style={{fontSize:10,color:C.gray,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:600}}>{f.l}</div>
                <div style={{fontSize:28,fontWeight:800,color:f.c,fontFamily:FN.mono}}>{f.v}</div>
                <div style={{fontSize:11,color:C.gray,marginTop:2}}>sat/vB · {f.t}</div>
              </Crd>)}
          </div>
          {rMempoolStats&&<Crd C={C} style={{marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:700,color:C.grayLight,marginBottom:10}}>{t("networkCongestion")}</div>
            <div style={{position:"relative",height:10,borderRadius:5,background:C.grayDim,overflow:"hidden",marginBottom:8}}>
              <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${Math.min((rMempoolStats.txCount||0)/1000,100)}%`,borderRadius:5,background:rMempoolStats.txCount>50000?C.red:rMempoolStats.txCount>20000?C.yellow:C.green,transition:"width 0.5s"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.gray}}>
              <span>{(rMempoolStats.txCount||0).toLocaleString()} {t("unconfirmedTxsLabel")}</span>
              <span>{rMempoolStats.txCount>50000?t("high"):rMempoolStats.txCount>20000?t("medium"):t("low")}</span>
            </div>
          </Crd>}
        </>:<div style={{textAlign:"center",padding:30}}><Spin sz={24} color={C.orange}/></div>}
      </div>);
    }

    // ── Halving Countdown sub-view ──
    if(radarSection==="halving"){
      const HALVING_INTERVAL=210000;
      const currentHeight=rMempoolStats?.blockHeight||0;
      const nextHalving=Math.ceil(currentHeight/HALVING_INTERVAL)*HALVING_INTERVAL;
      const blocksLeft=nextHalving-currentHeight;
      const halvingNum=nextHalving/HALVING_INTERVAL;
      const progress=((currentHeight%HALVING_INTERVAL)/HALVING_INTERVAL)*100;
      const minutesLeft=blocksLeft*10;
      const estDate=new Date(Date.now()+minutesLeft*60000);
      const currentReward=50/Math.pow(2,halvingNum-1);
      const nextReward=currentReward/2;
      const daysLeft=Math.floor(minutesLeft/1440);
      const hoursLeft=Math.floor((minutesLeft%1440)/60);
      return(<div>
        <Bk onClick={()=>setRadarSection(null)} C={C}/>
        <PT title={t("halvingCountdown")} sub={t("halvingCountdownDesc")} C={C}/>
        <Crd C={C} glow style={{marginBottom:14,textAlign:"center"}}>
          <div style={{fontSize:11,color:C.gray,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>{t("blocksUntilHalving")} #{halvingNum}</div>
          <div style={{fontSize:38,fontWeight:800,color:C.orange,fontFamily:FN.mono}}>{blocksLeft.toLocaleString()}</div>
          <div style={{fontSize:13,color:C.grayLight,marginTop:6}}>{daysLeft}{t("daysShort")} {hoursLeft}{t("hoursShort")} {t("remaining")}</div>
          <div style={{position:"relative",height:8,borderRadius:4,background:C.grayDim,overflow:"hidden",marginTop:14,marginBottom:6}}>
            <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${progress}%`,borderRadius:4,background:`linear-gradient(90deg,${C.orange},${C.green})`,transition:"width 0.5s"}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.gray}}>
            <span>{(currentHeight%HALVING_INTERVAL).toLocaleString()} / {HALVING_INTERVAL.toLocaleString()}</span>
            <span>{progress.toFixed(1)}%</span>
          </div>
        </Crd>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          <Crd C={C} pad="14px"><div style={{fontSize:10,color:C.gray,textTransform:"uppercase",marginBottom:6}}>{t("estimatedDate")}</div>
            <div style={{fontSize:14,fontWeight:700,color:C.white}}>{estDate.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}</div>
          </Crd>
          <Crd C={C} pad="14px"><div style={{fontSize:10,color:C.gray,textTransform:"uppercase",marginBottom:6}}>{t("targetBlock")}</div>
            <div style={{fontSize:14,fontWeight:700,color:C.orange,fontFamily:FN.mono}}>#{nextHalving.toLocaleString()}</div>
          </Crd>
        </div>
        <Crd C={C} style={{marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:C.grayLight,marginBottom:12}}>{t("blockReward")}</div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:16}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:10,color:C.gray,marginBottom:4}}>{t("current")}</div>
              <div style={{fontSize:22,fontWeight:800,color:C.orange,fontFamily:FN.mono}}>{currentReward}</div>
              <div style={{fontSize:10,color:C.gray}}>{t("btcPerBlock")}</div>
            </div>
            <div style={{fontSize:20,color:C.gray}}>→</div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:10,color:C.gray,marginBottom:4}}>{t("after")}</div>
              <div style={{fontSize:22,fontWeight:800,color:C.green,fontFamily:FN.mono}}>{nextReward}</div>
              <div style={{fontSize:10,color:C.gray}}>{t("btcPerBlock")}</div>
            </div>
          </div>
        </Crd>
        <Crd C={C}>
          <div style={{fontSize:12,fontWeight:700,color:C.grayLight,marginBottom:10}}>{t("halvingHistory")}</div>
          {[{n:1,block:210000,date:"Nov 2012",reward:"50→25"},{n:2,block:420000,date:"Jul 2016",reward:"25→12.5"},{n:3,block:630000,date:"May 2020",reward:"12.5→6.25"},{n:4,block:840000,date:"Apr 2024",reward:"6.25→3.125"}].map((h,i)=>
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:i<3?`1px solid ${C.border}08`:"none",opacity:h.block<=currentHeight?1:0.4}}>
              <span style={{fontSize:12,color:C.gray}}>#{h.n} · {h.date}</span>
              <span style={{fontSize:12,fontWeight:600,color:h.block<=currentHeight?C.green:C.gray,fontFamily:FN.mono}}>{h.reward} BTC</span>
            </div>)}
        </Crd>
      </div>);
    }

    // ── Recent Blocks sub-view ──
    if(radarSection==="blocks"){
      const fmtSize=(s)=>{if(!s)return"—";if(s>=1e6)return(s/1e6).toFixed(2)+" MB";return(s/1e3).toFixed(0)+" KB";};
      const fmtTime=(ts)=>{if(!ts)return"—";const d=Math.floor((Date.now()/1000-ts)/60);if(d<1)return t("justNowShort");if(d<60)return d+t("mAgo");if(d<1440)return Math.floor(d/60)+t("hAgo");return Math.floor(d/1440)+t("dAgo");};
      return(<div>
        <Bk onClick={()=>setRadarSection(null)} C={C}/>
        <PT title={t("recentBlocks")} sub={t("latestBlocks")} C={C}/>
        {!rRecentBlocks?<div style={{textAlign:"center",padding:30}}><Spin sz={24} color={C.orange}/></div>:
          rRecentBlocks.map((b,i)=><Crd key={i} C={C} style={{marginBottom:8,...stagger(i)}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:16,fontWeight:800,color:C.orange,fontFamily:FN.mono}}>#{b.height.toLocaleString()}</span>
                  <Badge color={C.blue} bg={C.blue+"15"} style={{fontSize:9}}>{b.pool}</Badge>
                </div>
                <div style={{fontSize:11,color:C.gray,marginTop:3}}>{fmtTime(b.timestamp)}</div>
              </div>
              <button onClick={()=>window.open(`${EXPLORER_BASE}/block/${b.hash}`,"_blank")} className="b21p" style={{background:"none",border:"none",cursor:"pointer",color:C.blue,display:"flex"}}>{I.ext}</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              <div><div style={{fontSize:9,color:C.gray,textTransform:"uppercase"}}>{t("txs")}</div><div style={{fontSize:13,fontWeight:700,color:C.white,fontFamily:FN.mono}}>{b.txCount.toLocaleString()}</div></div>
              <div><div style={{fontSize:9,color:C.gray,textTransform:"uppercase"}}>{t("txSize")}</div><div style={{fontSize:13,fontWeight:700,color:C.blue,fontFamily:FN.mono}}>{fmtSize(b.size)}</div></div>
              <div><div style={{fontSize:9,color:C.gray,textTransform:"uppercase"}}>{t("avgFee")}</div><div style={{fontSize:13,fontWeight:700,color:C.purple,fontFamily:FN.mono}}>{b.avgFeeRate||"—"} <span style={{fontSize:9,color:C.gray}}>s/vB</span></div></div>
            </div>
          </Crd>)}
      </div>);
    }

    // ── Difficulty Adjustment sub-view ──
    if(radarSection==="difficulty"){
      return(<div>
        <Bk onClick={()=>setRadarSection(null)} C={C}/>
        <PT title={t("difficultyAdjustment")} sub={t("nextDiffChange")} C={C}/>
        {!rDiffAdj?<div style={{textAlign:"center",padding:30}}><Spin sz={24} color={C.orange}/></div>:<>
          <Crd C={C} glow style={{marginBottom:14,textAlign:"center"}}>
            <div style={{fontSize:11,color:C.gray,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>{t("estimatedChange")}</div>
            <div style={{fontSize:38,fontWeight:800,color:rDiffAdj.difficultyChange>=0?C.green:C.red,fontFamily:FN.mono}}>{rDiffAdj.difficultyChange>=0?"+":""}{rDiffAdj.difficultyChange?.toFixed(2)}%</div>
            <div style={{fontSize:12,color:C.grayLight,marginTop:6}}>{rDiffAdj.remainingBlocks?.toLocaleString()} {t("blocksRemaining")}</div>
          </Crd>
          <Crd C={C} style={{marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:700,color:C.grayLight,marginBottom:10}}>{t("progress")}</div>
            <div style={{position:"relative",height:10,borderRadius:5,background:C.grayDim,overflow:"hidden",marginBottom:8}}>
              <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${rDiffAdj.progressPercent||0}%`,borderRadius:5,background:`linear-gradient(90deg,${C.blue},${C.purple})`,transition:"width 0.5s"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.gray}}>
              <span>{rDiffAdj.progressPercent?.toFixed(1)}% {t("complete")}</span>
              <span>{(2016-(rDiffAdj.remainingBlocks||0)).toLocaleString()} / 2,016</span>
            </div>
          </Crd>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <Crd C={C} pad="14px"><div style={{fontSize:10,color:C.gray,textTransform:"uppercase",marginBottom:6}}>{t("estRetarget")}</div>
              <div style={{fontSize:13,fontWeight:700,color:C.white}}>{rDiffAdj.estimatedRetargetDate?new Date(rDiffAdj.estimatedRetargetDate).toLocaleDateString("en-GB",{day:"2-digit",month:"short"}):"—"}</div>
            </Crd>
            <Crd C={C} pad="14px"><div style={{fontSize:10,color:C.gray,textTransform:"uppercase",marginBottom:6}}>{t("timeRemaining")}</div>
              <div style={{fontSize:13,fontWeight:700,color:C.orange}}>{rDiffAdj.remainingTime?Math.floor(rDiffAdj.remainingTime/3600000)+"h "+Math.floor((rDiffAdj.remainingTime%3600000)/60000)+"m":Math.floor((rDiffAdj.remainingBlocks||0)*10/60)+"h"}</div>
            </Crd>
          </div>
          <Crd C={C} pad="14px"><div style={{fontSize:10,color:C.gray,textTransform:"uppercase",marginBottom:6}}>{t("previousChange")}</div>
            <div style={{fontSize:16,fontWeight:700,color:rDiffAdj.previousRetarget>=0?C.green:C.red,fontFamily:FN.mono}}>{rDiffAdj.previousRetarget>=0?"+":""}{rDiffAdj.previousRetarget?.toFixed(2)||"—"}%</div>
          </Crd>
        </>}
      </div>);
    }

    // ── Mining Pools sub-view ──
    if(radarSection==="mining"){
      const poolColors=[C.orange,C.blue,C.green,C.purple,C.red,"#00BCD4","#FF9800","#8BC34A","#E91E63","#9C27B0","#00897B","#FF5722","#607D8B","#795548","#CDDC39"];
      return(<div>
        <Bk onClick={()=>setRadarSection(null)} C={C}/>
        <PT title={t("miningPools")} sub={t("blockDistribution")} C={C}/>
        <div style={{display:"flex",gap:6,marginBottom:16}}>
          {[{l:"24h",v:"24h"},{l:"3d",v:"3d"},{l:"1w",v:"1w"}].map(p=><button key={p.v} onClick={async()=>{setMiningPeriod(p.v);try{const d=await getMiningPools(p.v);setRMiningPools(d);}catch{}}} className="b21p" style={{flex:1,padding:"10px 4px",borderRadius:RD.md,border:`1px solid ${miningPeriod===p.v?C.orange+"40":C.border}`,background:miningPeriod===p.v?C.orangeMuted:C.surface,color:miningPeriod===p.v?C.orange:C.gray,fontSize:12,fontWeight:600,cursor:"pointer"}}>{p.l}</button>)}
        </div>
        {!rMiningPools?<div style={{textAlign:"center",padding:30}}><Spin sz={24} color={C.orange}/></div>:<>
          {/* Visual bar chart */}
          <Crd C={C} style={{marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:700,color:C.grayLight,marginBottom:12}}>{rMiningPools.blockCount?.toLocaleString()} {t("blocksInPeriod")}</div>
            {rMiningPools.pools?.map((p,i)=>{
              const pct=(p.share*100);
              return(<div key={i} style={{marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:12,fontWeight:600,color:C.white}}>{p.name}</span>
                  <span style={{fontSize:11,color:C.gray,fontFamily:FN.mono}}>{p.blockCount} ({pct.toFixed(1)}%)</span>
                </div>
                <div style={{height:6,borderRadius:3,background:C.grayDim,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${pct}%`,borderRadius:3,background:poolColors[i%poolColors.length],transition:"width 0.5s"}}/>
                </div>
              </div>);
            })}
          </Crd>
        </>}
      </div>);
    }

    // ── Radar Main Dashboard ──
    if(rLoading)return(<div>
      <PT title={t("radar")} sub={t("bitcoinIntelligence")} C={C}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {[0,1,2,3,4,5,6,7].map(i=><Skel key={i} h={120} C={C}/>)}
      </div>
    </div>);

    return(<div>
      <PT title={t("radar")} sub={t("bitcoinIntelDashboard")} C={C}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        {/* Market Pulse Card */}
        <Crd C={C} onClick={()=>setRadarSection("market")} style={{...stagger(0)}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
            <div style={{width:28,height:28,borderRadius:RD.sm,background:C.orange+"12",display:"flex",alignItems:"center",justifyContent:"center",color:C.orange}}>{I.activity}</div>
            <span style={{fontSize:12,fontWeight:700,color:C.grayLight}}>{t("market")}</span>
          </div>
          <div style={{fontSize:18,fontWeight:800,color:C.white,fontFamily:FN.mono,marginBottom:4}}>{fmtFiat(price.fiat)}</div>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <Badge color={price.change24h>=0?C.green:C.red} bg={price.change24h>=0?C.greenGlow:C.redGlow} style={{fontSize:9}}>{price.change24h>=0?"↑":"↓"}{Math.abs(price.change24h).toFixed(1)}%</Badge>
          </div>
          {rFearGreed&&<div style={{marginTop:8,display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:24,height:4,borderRadius:2,background:C.grayDim,overflow:"hidden",flex:1}}><div style={{height:"100%",width:`${rFearGreed.value}%`,borderRadius:2,background:fgColor(rFearGreed.value)}}/></div>
            <span style={{fontSize:10,color:fgColor(rFearGreed.value),fontWeight:700}}>{rFearGreed.value}</span>
          </div>}
        </Crd>

        {/* Whale Activity Card */}
        <Crd C={C} onClick={()=>setRadarSection("whale")} style={{...stagger(1)}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
            <div style={{width:28,height:28,borderRadius:RD.sm,background:C.blue+"12",display:"flex",alignItems:"center",justifyContent:"center",color:C.blue}}>{I.whale}</div>
            <span style={{fontSize:12,fontWeight:700,color:C.grayLight}}>{t("whales")}</span>
          </div>
          <div style={{fontSize:18,fontWeight:800,color:C.white,fontFamily:FN.mono,marginBottom:4}}>{rWhalePreview?.whales?.length||0}</div>
          <div style={{fontSize:11,color:C.gray}}>{t("largeTxsInBlock")}</div>
          {rWhalePreview?.whales?.[0]&&<div style={{marginTop:6,fontSize:10,color:C.orange,fontFamily:FN.mono}}>Top: {fmtAmt(rWhalePreview.whales[0].totalOutputBTC)}</div>}
        </Crd>

        {/* Network Health Card */}
        <Crd C={C} onClick={()=>setRadarSection("network")} style={{...stagger(2)}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
            <div style={{width:28,height:28,borderRadius:RD.sm,background:C.green+"12",display:"flex",alignItems:"center",justifyContent:"center",color:C.green}}>{I.layers}</div>
            <span style={{fontSize:12,fontWeight:700,color:C.grayLight}}>{t("network")}</span>
          </div>
          <div style={{fontSize:18,fontWeight:800,color:C.white,fontFamily:FN.mono,marginBottom:4}}>#{((rMempoolStats?.blockHeight)||0).toLocaleString()}</div>
          <div style={{fontSize:11,color:C.gray}}>{(rMempoolStats?.txCount||0).toLocaleString()} {t("mempoolTxsLabel")}</div>
          <div style={{marginTop:4,fontSize:10,color:rMempoolStats?.txCount>50000?C.red:rMempoolStats?.txCount>20000?C.yellow:C.green}}>{rMempoolStats?.txCount>50000?"🔴 "+t("congested"):rMempoolStats?.txCount>20000?"🟡 "+t("busy"):"🟢 "+t("clearStatus")}</div>
        </Crd>

        {/* Fee Monitor Card */}
        <Crd C={C} onClick={()=>setRadarSection("fees")} style={{...stagger(3)}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
            <div style={{width:28,height:28,borderRadius:RD.sm,background:C.purple+"12",display:"flex",alignItems:"center",justifyContent:"center",color:C.purple}}>{I.zap}</div>
            <span style={{fontSize:12,fontWeight:700,color:C.grayLight}}>{t("fees")}</span>
          </div>
          {fees?<>
            <div style={{display:"flex",gap:6,alignItems:"baseline"}}>
              <span style={{fontSize:18,fontWeight:800,color:C.orange,fontFamily:FN.mono}}>{fees.halfHourFee}</span>
              <span style={{fontSize:11,color:C.gray}}>sat/vB</span>
            </div>
            <div style={{display:"flex",gap:4,marginTop:6}}>
              {[{v:fees.hourFee,c:C.green},{v:fees.halfHourFee,c:C.orange},{v:fees.fastestFee,c:C.red}].map((f,i)=>
                <div key={i} style={{flex:1,height:4,borderRadius:2,background:f.c+"30"}}><div style={{height:"100%",width:`${Math.min(f.v/Math.max(fees.fastestFee,1)*100,100)}%`,borderRadius:2,background:f.c}}/></div>)}
            </div>
          </>:<Skel w="100%" h={20} C={C}/>}
        </Crd>

        {/* Halving Countdown Card */}
        <Crd C={C} onClick={()=>setRadarSection("halving")} style={{...stagger(4)}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
            <div style={{width:28,height:28,borderRadius:RD.sm,background:C.orange+"12",display:"flex",alignItems:"center",justifyContent:"center",color:C.orange}}>{I.hourglass}</div>
            <span style={{fontSize:12,fontWeight:700,color:C.grayLight}}>{t("halving")}</span>
          </div>
          {rMempoolStats?.blockHeight?<>
            <div style={{fontSize:18,fontWeight:800,color:C.orange,fontFamily:FN.mono,marginBottom:4}}>{(Math.ceil(rMempoolStats.blockHeight/210000)*210000-rMempoolStats.blockHeight).toLocaleString()}</div>
            <div style={{fontSize:11,color:C.gray}}>{t("blocksRemaining")}</div>
            <div style={{position:"relative",height:4,borderRadius:2,background:C.grayDim,overflow:"hidden",marginTop:6}}>
              <div style={{height:"100%",width:`${((rMempoolStats.blockHeight%210000)/210000)*100}%`,borderRadius:2,background:C.orange}}/>
            </div>
          </>:<Skel w="100%" h={20} C={C}/>}
        </Crd>

        {/* Recent Blocks Card */}
        <Crd C={C} onClick={()=>setRadarSection("blocks")} style={{...stagger(5)}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
            <div style={{width:28,height:28,borderRadius:RD.sm,background:(C.blue||"#3B82F6")+"12",display:"flex",alignItems:"center",justifyContent:"center",color:C.blue||"#3B82F6"}}>{I.cube}</div>
            <span style={{fontSize:12,fontWeight:700,color:C.grayLight}}>{t("blocks")}</span>
          </div>
          {rRecentBlocks?.[0]?<>
            <div style={{fontSize:18,fontWeight:800,color:C.white,fontFamily:FN.mono,marginBottom:4}}>#{rRecentBlocks[0].height.toLocaleString()}</div>
            <div style={{fontSize:11,color:C.gray}}>{rRecentBlocks[0].txCount} txs · {rRecentBlocks[0].pool}</div>
          </>:<Skel w="100%" h={20} C={C}/>}
        </Crd>

        {/* Difficulty Adjustment Card */}
        <Crd C={C} onClick={()=>setRadarSection("difficulty")} style={{...stagger(6)}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
            <div style={{width:28,height:28,borderRadius:RD.sm,background:C.red+"12",display:"flex",alignItems:"center",justifyContent:"center",color:C.red}}>{I.halfCircle}</div>
            <span style={{fontSize:12,fontWeight:700,color:C.grayLight}}>{t("difficulty")}</span>
          </div>
          {rDiffAdj?<>
            <div style={{fontSize:18,fontWeight:800,color:rDiffAdj.difficultyChange>=0?C.green:C.red,fontFamily:FN.mono,marginBottom:4}}>{rDiffAdj.difficultyChange>=0?"+":""}{rDiffAdj.difficultyChange?.toFixed(1)}%</div>
            <div style={{fontSize:11,color:C.gray}}>{rDiffAdj.remainingBlocks?.toLocaleString()} {t("blocksLeft")}</div>
            <div style={{position:"relative",height:4,borderRadius:2,background:C.grayDim,overflow:"hidden",marginTop:6}}>
              <div style={{height:"100%",width:`${rDiffAdj.progressPercent||0}%`,borderRadius:2,background:C.purple}}/>
            </div>
          </>:<Skel w="100%" h={20} C={C}/>}
        </Crd>

        {/* Mining Pools Card */}
        <Crd C={C} onClick={()=>setRadarSection("mining")} style={{...stagger(7)}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
            <div style={{width:28,height:28,borderRadius:RD.sm,background:C.green+"12",display:"flex",alignItems:"center",justifyContent:"center",color:C.green}}>{I.pickaxe}</div>
            <span style={{fontSize:12,fontWeight:700,color:C.grayLight}}>{t("mining")}</span>
          </div>
          {rMiningPools?.pools?<>
            <div style={{fontSize:18,fontWeight:800,color:C.white,fontFamily:FN.mono,marginBottom:4}}>{rMiningPools.pools[0]?.name||"—"}</div>
            <div style={{fontSize:11,color:C.gray}}>{(rMiningPools.pools[0]?.share*100)?.toFixed(1)}% · {t("topMiner")}</div>
          </>:<Skel w="100%" h={20} C={C}/>}
        </Crd>
      </div>
    </div>);
  };

  /* ═══ MORE TAB (inline render, NOT component) ═══ */
  const renderMoreTab=()=>{
    // ── UTXO Control ──
    if(moreSection==="utxo"){
      const utxoColor=(v)=>{const b=v/1e8;if(b>=1)return{c:C.orange,l:t("whale")};if(b>=0.1)return{c:C.green,l:t("large")};if(b>=0.01)return{c:C.blue,l:t("medium")};if(b>=0.001)return{c:C.purple,l:t("small")};return{c:C.gray,l:t("dust")};};

      const totalAvail=utxos.filter(u=>!frozenUTXOs.includes(`${u.txid}:${u.vout}`)).reduce((s,u)=>s+u.value,0);
      return(<div>
        <Bk onClick={()=>setMoreSection(null)} C={C}/>
        <PT title={t("utxoControl")} sub={`${utxos.length} UTXOs · ${fmtAmt(totalAvail/1e8)} ${t("available")}`} C={C}/>
        {utxos.length===0?<Empty icon="🔵" title={t("noUtxos")} desc={t("noUtxosDesc")} C={C}/>:
          utxos.map((u,i)=>{const k=`${u.txid}:${u.vout}`;const uc=utxoColor(u.value);const frozen=frozenUTXOs.includes(k);const lb=utxoLabels[k];
            return(<Crd key={k} C={C} active={frozen} style={{marginBottom:8,opacity:frozen?0.6:1,...stagger(i)}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:10,height:10,borderRadius:5,background:uc.c,boxShadow:`0 0 8px ${uc.c}40`}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <span style={{fontSize:14,fontWeight:700,color:C.white,fontFamily:FN.mono}}>{fmtAmt(u.value/1e8)}</span>
                    <Badge color={uc.c} bg={uc.c+"15"} style={{fontSize:9}}>{uc.l}</Badge>
                    {frozen&&<Badge color={C.blue} bg={C.blueGlow} style={{fontSize:9}}>❄ {t("frozen")}</Badge>}
                  </div>
                  <div style={{fontSize:11,color:C.gray,fontFamily:FN.mono,marginTop:2}}>{shortTxid(u.txid)}:{u.vout}</div>
                  {lb&&<div style={{fontSize:11,color:C.grayLight,marginTop:2}}>📎 {lb}</div>}
                  {!u.status?.confirmed&&<div style={{fontSize:10,color:C.yellow,marginTop:2}}>⏳ {t("unconfirmed")}</div>}
                </div>
                <div style={{display:"flex",gap:4}}>
                  <IBtn C={C} sz={32} onClick={()=>{setEditU(editU===k?null:k);setEditV(utxoLabels[k]||"");}}>{I.tag}</IBtn>
                  <IBtn C={C} sz={32} active={frozen} onClick={()=>toggleFreeze(k)} style={{color:frozen?C.blue:C.gray}}>{frozen?I.unlock:I.freeze}</IBtn>
                </div>
              </div>
              {editU===k&&<div style={{marginTop:10,display:"flex",gap:6}}>
                <Inp C={C} value={editV} onChange={e=>setEditV(e.target.value)} placeholder={t("labelUtxo")} style={{flex:1,fontSize:12,padding:"10px 12px"}}/>
                <SBtn C={C} color={C.green} fw={false} onClick={()=>{setUtxoLbl(k,editV);setEditU(null);}} style={{fontSize:12}}>{t("save")}</SBtn>
              </div>}
            </Crd>);
          })}
      </div>);
    }
    // ── Vault ──
    if(moreSection==="vault"){
      // Helper: get effective lock days from preset or custom input
      const getEffectiveDays=()=>{
        if(!vaultUseCustom)return parseInt(vaultDays)||30;
        const val=parseInt(vaultCustomVal)||0;
        if(vaultDurType==="months")return val*30;
        if(vaultDurType==="years")return val*365;
        return val;
      };
      const effectiveDays=getEffectiveDays();
      const effectiveBlocks=Math.ceil(effectiveDays*144);
      const estUnlockDate=new Date(Date.now()+effectiveDays*86400000);
      const currentBlockH=rMempoolStats?.blockHeight||0;
      const getVaultStatus=(v)=>{
        if(!currentBlockH||!v.lockedUntilBlock)return{locked:true,label:t("checking"),pct:0};
        const blocksLeft=v.lockedUntilBlock-currentBlockH;
        if(blocksLeft<=0)return{locked:false,label:t("readyToSpend"),pct:100};
        const totalBlocks=Math.ceil(v.days*144);
        const elapsed=totalBlocks-blocksLeft;
        const pct=Math.min(Math.max(Math.round((elapsed/totalBlocks)*100),1),99);
        const minsLeft=blocksLeft*10;
        if(minsLeft<60)return{locked:true,label:`~${minsLeft}${t("mLeft")}`,pct};
        const hrsLeft=Math.round(minsLeft/60);
        if(hrsLeft<24)return{locked:true,label:`~${hrsLeft}${t("hLeft")}`,pct};
        const daysLeft=Math.round(hrsLeft/24);
        if(daysLeft<30)return{locked:true,label:`~${daysLeft}${t("dLeft")}`,pct};
        const moLeft=Math.round(daysLeft/30);
        if(moLeft<12)return{locked:true,label:`~${moLeft}${t("moLeft")}`,pct};
        return{locked:true,label:`~${(daysLeft/365).toFixed(1)}${t("yrLeft")}`,pct};
      };
      const vaultBtcFmt=(sats)=>stealthMode?"--------":(sats/1e8).toFixed(8)+" BTC";
      const vaultFiatFmt=(sats)=>stealthMode?"••••":fmtFiat((sats/1e8)*price.fiat);

      const handleCreateVault=async()=>{setVaultErr("");setVaultBusy(true);try{
        if(!walletKeyData)throw new Error(t("noWalletKey"));
        const{seed:ps3,passphrase:pp3}=parseSeedData(walletKeyData);const s=(ps3||walletKeyData).trim().toLowerCase();
        const amtSats=Math.round(parseFloat(vaultAmt)*1e8);if(!amtSats||amtSats<=0)throw new Error(t("invalidAmount"));
        if(amtSats<10000)throw new Error(t("minVaultAmount"));
        if(effectiveDays<1)throw new Error(t("lockDurationMin"));
        if(effectiveDays>36500)throw new Error(t("lockDurationMax"));
        const bh=await getBlockHeight(testnet);
        const locktime=locktimeFromDays(bh,effectiveDays);
        let kp;
        if(validateSeedPhrase(s)){kp=(await getKeyPairSmart(s,address,testnet,pp3)).keyPair;}
        else{kp=getKeyPairFromWIF(walletKeyData.trim(),testnet);}
        const vaultAddr=createVaultAddress(kp.publicKey,locktime,testnet);
        // Fetch fresh UTXOs — exclude frozen
        const freshUtxos=await getUTXOs(address,testnet,true);
        const vaultSafeUtxos=(freshUtxos||[]).filter(u=>!(frozenUTXOs||[]).includes(`${u.txid}:${u.vout}`));
        if(!vaultSafeUtxos||!vaultSafeUtxos.length)throw new Error(t("noConfirmedUtxos"));
        const vaultFeeRate=Math.max(1,Math.min(fees?.halfHourFee||10,200));
        const result=buildTransaction({utxos:vaultSafeUtxos,recipientAddress:vaultAddr.address,amountSats:amtSats,feeRate:vaultFeeRate,keyPair:kp,senderAddress:address,enableRBF:false,testnet});
        const bc=await broadcastTx(result.txHex,testnet);
        const nv={name:vaultName.trim()||"Vault",address:vaultAddr.address,redeemScript:vaultAddr.redeemScript,locktime,amountSats:amtSats,txid:bc.txid,vout:0,createdAt:Date.now(),lockedUntilBlock:locktime,days:effectiveDays};
        const uv=[...vaults,nv];setVaults(uv);localStorage.setItem(`btc_vaults_${activeWalletId}`,JSON.stringify(uv));
        setCreatedVault(nv);setVaultStep("success");setVaultAmt("");setVaultName("");setVaultConfirm(false);clearAddressCache(address);setTimeout(()=>fetchData(true),3000);
      }catch(err){setVaultErr(getUserFriendlyError(err));}setVaultBusy(false);};

      const handleSpendVault=async(v)=>{setSpendErr("");setSpendBusy(true);try{
        if(!walletKeyData)throw new Error(t("noWalletKey"));
        // Check vault is actually unlocked before attempting to spend
        const vaultSt=getVaultStatus(v);
        if(vaultSt.locked)throw new Error(t("vaultStillLocked"));
        const allUtxos=await getUTXOs(v.address,testnet,true);const vaultUtxos=allUtxos.filter(u=>u.txid===v.txid&&(v.vout===undefined||u.vout===v.vout));if(!vaultUtxos.length)throw new Error(t("noFundsInVault"));
        // Use original case for WIF keys (case-sensitive), lowercase only for seed phrases
        const rawKey=walletKeyData.trim();
        const seedForVault=validateSeedPhrase(rawKey.toLowerCase())?rawKey.toLowerCase():rawKey;
        const result=await spendFromVault({vaultUtxos,redeemScriptHex:v.redeemScript,locktime:v.locktime,seed:seedForVault,walletAddress:address,destinationAddress:address,feeRate:fees?.halfHourFee||10,fetchRawTx:(txid)=>getRawTxHex(txid,testnet),testnet});
        await broadcastTx(result.txHex,testnet);
        const uv=vaults.filter(vt=>!(vt.txid===v.txid&&vt.createdAt===v.createdAt));setVaults(uv);localStorage.setItem(`btc_vaults_${activeWalletId}`,JSON.stringify(uv));
        setVaultStep("list");setSelectedVaultIndex(null);clearAddressCache(address);setTimeout(()=>fetchData(true),3000);
      }catch(err){setSpendErr(getUserFriendlyError(err));}setSpendBusy(false);};

      if(!features.vaultEnabled)return(<div><Bk onClick={()=>setMoreSection(null)} C={C}/><PT title={t("vault")} C={C}/><Empty icon="🔒" title={t("vaultDisabled")} desc={t("vaultDisabledDesc")} C={C}/></div>);

      // Duration preset config
      const presets=[{l:"30d",v:30},{l:"90d",v:90},{l:"6mo",v:180},{l:"1yr",v:365},{l:"2yr",v:730}];
      const durTypes=[{l:t("days"),v:"days"},{l:t("months"),v:"months"},{l:t("years"),v:"years"}];

      return(<div>
        <Bk onClick={()=>{if(vaultStep==="list"){setMoreSection(null);setShowVaultInfo(false);}else if(vaultStep==="spend"){setVaultStep("myvaults");}else if(vaultStep==="success"){setCreatedVault(null);setVaultStep("myvaults");}else{setVaultStep("list");}}} C={C}/>
        <PT title={t("vault")} sub={t("vaultSubDesc")} C={C}/>

        {vaultStep==="list"&&<>
          {/* Benefits section */}
          <Crd C={C} style={{marginBottom:12,border:`1px solid ${C.orange}15`,cursor:"pointer"}} onClick={()=>setShowVaultInfo(!showVaultInfo)}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:16}}>💡</span>
                <span style={{fontSize:13,fontWeight:600,color:C.orange}}>{t("whyUseVault")}</span>
              </div>
              <span style={{fontSize:11,color:C.gray,transition:"transform 0.2s",transform:showVaultInfo?"rotate(180deg)":"rotate(0)"}}>▼</span>
            </div>
            {showVaultInfo&&<div style={{marginTop:12,display:"flex",flexDirection:"column",gap:10}} onClick={e=>e.stopPropagation()}>
              {[
                {icon:"🎯",title:t("vaultBenefit1Title"),desc:t("vaultBenefit1Desc")},
                {icon:"🛡️",title:t("vaultBenefit2Title"),desc:t("vaultBenefit2Desc")},
                {icon:"📈",title:t("vaultBenefit3Title"),desc:t("vaultBenefit3Desc")},
                {icon:"✅",title:t("vaultBenefit4Title"),desc:t("vaultBenefit4Desc")},
              ].map((item,i)=><div key={i} style={{display:"flex",gap:10,padding:"8px 10px",borderRadius:RD.sm,background:C.bg}}>
                <span style={{fontSize:16,flexShrink:0,marginTop:1}}>{item.icon}</span>
                <div><div style={{fontSize:12,fontWeight:600,color:C.white,marginBottom:2}}>{item.title}</div><div style={{fontSize:11,color:C.gray,lineHeight:"1.4"}}>{item.desc}</div></div>
              </div>)}
            </div>}
          </Crd>

          <PBtn C={C} onClick={()=>{setVaultStep("create");setVaultConfirm(false);setVaultErr("");setVaultName("");}} style={{marginBottom:10,marginTop:10}}>+ {t("createNewVault")}</PBtn>
          <button onClick={()=>setVaultStep("myvaults")} className="b21p" style={{width:"100%",padding:"14px",borderRadius:RD.md,border:`1px solid ${C.border}`,background:C.surface,color:C.white,fontSize:14,fontWeight:600,cursor:"pointer",marginBottom:20,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            {t("myVaults")} {vaults.length>0&&<span style={{fontSize:11,color:C.gray,fontWeight:400}}>({vaults.length})</span>}
          </button>

          {/* FAQ section */}
          {(()=>{const faqs=[
            {q:t("vaultFaq1Q"),a:t("vaultFaq1A")},
            {q:t("vaultFaq2Q"),a:t("vaultFaq2A")},
            {q:t("vaultFaq3Q"),a:t("vaultFaq3A")},
            {q:t("vaultFaq4Q"),a:t("vaultFaq4A")},
            {q:t("vaultFaq5Q"),a:t("vaultFaq5A")},
            {q:t("vaultFaq6Q"),a:t("vaultFaq6A")},
            {q:t("vaultFaq7Q"),a:t("vaultFaq7A")},
            {q:t("vaultFaq8Q"),a:t("vaultFaq8A")},
            {q:t("vaultFaq9Q"),a:t("vaultFaq9A")},
            {q:t("vaultFaq10Q"),a:t("vaultFaq10A")},
          ];return <div style={{marginBottom:16}}>
            <div style={{cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",borderRadius:showVaultFaq?`${RD.md} ${RD.md} 0 0`:RD.md,background:C.card,border:`1px solid ${C.border}`,borderBottom:showVaultFaq?"none":`1px solid ${C.border}`}} onClick={()=>{setShowVaultFaq(!showVaultFaq);if(showVaultFaq)setVaultFaqOpen(null);}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.gray} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <span style={{fontSize:13,fontWeight:600,color:C.white}}>{t("frequentlyAskedQuestions")}</span>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.gray} strokeWidth="2.5" strokeLinecap="round" style={{transition:"transform 0.25s",transform:showVaultFaq?"rotate(180deg)":"rotate(0)"}}><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            {showVaultFaq&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderTop:"none",borderRadius:`0 0 ${RD.md} ${RD.md}`,overflow:"hidden"}}>
              {faqs.map((f,i)=>{const isOpen=vaultFaqOpen===i;return <div key={i}>
                <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 16px",cursor:"pointer",background:isOpen?C.surface:"transparent",borderTop:`1px solid ${C.border}`,transition:"background 0.15s"}} onClick={()=>setVaultFaqOpen(isOpen?null:i)}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={isOpen?C.orange:C.gray} strokeWidth="2.5" strokeLinecap="round" style={{transition:"transform 0.25s",transform:isOpen?"rotate(180deg)":"rotate(0)",flexShrink:0}}><polyline points="6 9 12 15 18 9"/></svg>
                  <span style={{fontSize:12,fontWeight:600,color:isOpen?C.white:C.gray,flex:1,lineHeight:"1.4"}}>{f.q}</span>
                </div>
                {isOpen&&<div style={{padding:"0 16px 14px 36px",fontSize:12,color:C.gray,lineHeight:"1.7",background:C.surface}}>{f.a}</div>}
              </div>;})}
            </div>}
          </div>;})()}
        </>}

        {vaultStep==="myvaults"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{fontSize:15,fontWeight:700,color:C.white}}>{t("myVaults")}</div>
            {vaults.length>0&&<span style={{fontSize:12,color:C.gray}}>{vaults.length} {vaults.length!==1?t("vaultsCount"):t("vaultCount")}</span>}
          </div>
          {vaults.length===0?
            <Crd C={C} style={{textAlign:"center",padding:"32px 20px",marginBottom:16}}>
              <div style={{fontSize:32,marginBottom:12,opacity:0.4}}>🏦</div>
              <div style={{fontSize:15,fontWeight:600,color:C.white,marginBottom:6}}>{t("noVaultsYet")}</div>
              <div style={{fontSize:12,color:C.gray,lineHeight:"1.6",marginBottom:16}}>{t("noVaultsYetDesc")}</div>
              <PBtn C={C} onClick={()=>{setVaultStep("create");setVaultConfirm(false);setVaultErr("");setVaultName("");}}>+ {t("createNewVault")}</PBtn>
            </Crd>:
            <>
            {vaults.map((v,i)=>{const st=getVaultStatus(v);const accentColor=st.locked?C.orange:C.green;return <Crd key={v.txid||v.createdAt||i} C={C} style={{marginBottom:10,borderLeft:`3px solid ${accentColor}`,...stagger(i)}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:C.white}}>{v.name||t("vaultLabel")}</div>
                  <div style={{fontSize:11,color:C.gray,marginTop:2}}>{v.days>=365?`${Math.round(v.days/365*10)/10} ${t("yearLock")}`:v.days>=30?`${Math.round(v.days/30*10)/10} ${t("monthLock")}`:`${v.days} ${t("dayLock")}`}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:15,fontWeight:700,color:C.white,fontFamily:FN.mono}}>{vaultBtcFmt(v.amountSats)}</div>
                  <div style={{fontSize:11,color:C.gray,fontFamily:FN.mono}}>{vaultFiatFmt(v.amountSats)}</div>
                </div>
              </div>
              <div style={{height:3,borderRadius:2,background:C.border,marginBottom:10,overflow:"hidden"}}>
                <div style={{height:"100%",borderRadius:2,width:`${st.pct}%`,background:accentColor,transition:"width 0.5s"}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:6,height:6,borderRadius:3,background:accentColor}}/>
                  <span style={{fontSize:12,fontWeight:600,color:accentColor}}>{st.label}</span>
                </div>
                <span style={{fontSize:11,color:C.gray}}>{new Date(v.createdAt+(v.days*86400000)).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>
              </div>
              {st.locked?
                <div style={{padding:"10px",borderRadius:RD.md,background:C.surface,textAlign:"center",fontSize:12,color:C.gray}}>🔒 {t("locked")}</div>:
                <button onClick={()=>{setSelectedVaultIndex(i);setVaultStep("spend");setSpendErr("");}} className="b21p" style={{width:"100%",padding:"11px",borderRadius:RD.md,border:"none",background:C.green,color:"#000",fontSize:13,fontWeight:700,cursor:"pointer"}}>{t("claimFunds")}</button>
              }
            </Crd>;})}
            <PBtn C={C} onClick={()=>{setVaultStep("create");setVaultConfirm(false);setVaultErr("");setVaultName("");}} style={{marginTop:6,marginBottom:80}}>+ {t("createNewVault")}</PBtn>
            </>
          }
        </>}

        {vaultStep==="create"&&<>
          {/* Name */}
          <div style={{fontSize:13,fontWeight:600,color:C.white,marginBottom:10}}>{t("vaultNameLabel")}</div>
          <Inp C={C} value={vaultName} onChange={e=>setVaultName(e.target.value)} placeholder={t("vaultNamePlaceholder")} maxLength={30} style={{marginBottom:20}}/>

          {/* Duration */}
          <div style={{fontSize:13,fontWeight:600,color:C.white,marginBottom:10}}>{t("lockDuration")}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,marginBottom:10}}>
            {presets.map(d=><button key={d.v} onClick={()=>{setVaultDays(String(d.v));setVaultUseCustom(false);}} className="b21p" style={{padding:"11px 4px",borderRadius:RD.md,border:`1px solid ${!vaultUseCustom&&parseInt(vaultDays)===d.v?C.orange+"40":C.border}`,background:!vaultUseCustom&&parseInt(vaultDays)===d.v?C.orangeMuted:C.surface,color:!vaultUseCustom&&parseInt(vaultDays)===d.v?C.orange:C.gray,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}>{d.l}</button>)}
          </div>
          <button onClick={()=>setVaultUseCustom(!vaultUseCustom)} className="b21p" style={{width:"100%",padding:"11px",borderRadius:RD.md,border:`1px solid ${vaultUseCustom?C.orange+"40":C.border}`,background:vaultUseCustom?C.orangeMuted:C.surface,color:vaultUseCustom?C.orange:C.gray,fontSize:12,fontWeight:600,cursor:"pointer",marginBottom:vaultUseCustom?10:0,transition:"all 0.15s"}}>
            {vaultUseCustom?`✓ ${t("customDuration")}`:`${t("customDuration")}...`}
          </button>
          {vaultUseCustom&&<div style={{display:"flex",gap:6,marginBottom:0}}>
            <Inp C={C} mono type="number" value={vaultCustomVal} onChange={e=>setVaultCustomVal(e.target.value)} placeholder={t("enterValue")} style={{flex:1}}/>
            <div style={{display:"flex",borderRadius:RD.md,overflow:"hidden",border:`1px solid ${C.border}`}}>
              {durTypes.map(dt=><button key={dt.v} onClick={()=>setVaultDurType(dt.v)} className="b21p" style={{padding:"8px 12px",background:vaultDurType===dt.v?C.orange:C.surface,color:vaultDurType===dt.v?"#000":C.gray,fontSize:11,fontWeight:600,cursor:"pointer",border:"none",transition:"all 0.15s"}}>{dt.l}</button>)}
            </div>
          </div>}
          {effectiveDays>0&&<div style={{fontSize:12,color:C.orange,fontWeight:600,marginTop:12,marginBottom:0}}>{t("unlocksAround")} {estUnlockDate.toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"})}</div>}

          {/* Divider */}
          <div style={{height:1,background:C.border,margin:"20px 0"}}/>

          {/* Amount */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}>
            <div style={{fontSize:13,fontWeight:600,color:C.white}}>{t("amountBtc")}</div>
            <div style={{fontSize:11,color:C.gray}}>{t("balanceLabel")}: <span style={{color:C.white,fontFamily:FN.mono}}>{stealthMode?"••••":(balance.confirmed||0).toFixed(8)}</span></div>
          </div>
          <Inp C={C} mono type="number" value={vaultAmt} onChange={e=>setVaultAmt(e.target.value)} placeholder={t("minBtcAmount")} style={{marginBottom:8}}/>
          <div style={{display:"flex",gap:6,marginBottom:10}}>
            {[25,50,75,100].map(pct=>{
              const raw=((balance.confirmed||0)*pct/100);
              // For 100%, deduct estimated fee so transaction doesn't fail
              const estFeeBtc=pct===100?estimateFee(1,2,fees?.halfHourFee||10)/1e8:0;
              const amt=Math.max(0,raw-estFeeBtc);
              const isActive=vaultAmt&&Math.abs(parseFloat(vaultAmt)-amt)<0.000001;
              return <button key={pct} onClick={()=>setVaultAmt(amt>0.00001?amt.toFixed(8):"")} className="b21p" style={{flex:1,padding:"7px 0",borderRadius:RD.sm,border:`1px solid ${isActive?C.orange+"40":C.border}`,background:isActive?C.orangeMuted:C.surface,color:isActive?C.orange:C.gray,fontSize:11,fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}>{pct}%</button>;
            })}
          </div>
          {vaultAmt&&parseFloat(vaultAmt)>0?<div style={{fontSize:11,color:C.gray,fontFamily:FN.mono,marginBottom:20}}>≈ {fmtFiat(parseFloat(vaultAmt)*price.fiat)}</div>:<div style={{height:20}}/>}

          {/* Checkbox */}
          <label style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:20,cursor:"pointer"}}>
            <input type="checkbox" checked={vaultConfirm} onChange={e=>setVaultConfirm(e.target.checked)} style={{accentColor:C.orange,width:18,height:18,marginTop:0,flexShrink:0}}/>
            <span style={{fontSize:12,color:C.gray,lineHeight:"1.5"}}>{t("vaultConfirmText")}</span>
          </label>

          <EBox C={C}>{vaultErr}</EBox>
          <PBtn C={C} onClick={()=>setVaultShowPopup(true)} disabled={vaultBusy||!vaultAmt||!vaultConfirm||effectiveDays<1||!walletKeyData||parseFloat(vaultAmt)<0.0001}>{vaultBusy?t("creatingVault"):t("lockBtcInVault")}</PBtn>

          {/* Confirm popup */}
          {vaultShowPopup&&<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.95)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:20}} onClick={()=>setVaultShowPopup(false)}>
            <div style={{background:C.card,borderRadius:RD.lg,padding:24,maxWidth:340,width:"100%",border:`1px solid ${C.border}`}} onClick={e=>e.stopPropagation()}>
              <div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:16,textAlign:"center"}}>{t("confirmVault")}</div>
              {vaultName.trim()&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:8,fontSize:12}}>
                <span style={{color:C.gray}}>{t("name")}</span>
                <span style={{color:C.white,fontWeight:600}}>{vaultName.trim()}</span>
              </div>}
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,fontSize:12}}>
                <span style={{color:C.gray}}>{t("amount")}</span>
                <span style={{color:C.white,fontFamily:FN.mono,fontWeight:600}}>{parseFloat(vaultAmt||0).toFixed(8)} BTC</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,fontSize:12}}>
                <span style={{color:C.gray}}>{t("duration")}</span>
                <span style={{color:C.white,fontWeight:600}}>{effectiveDays>=365?`${Math.round(effectiveDays/365*10)/10} years`:effectiveDays>=30?`${Math.round(effectiveDays/30*10)/10} months`:`${effectiveDays} days`}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:16,fontSize:12}}>
                <span style={{color:C.gray}}>{t("unlocksAround")}</span>
                <span style={{color:C.orange,fontWeight:600}}>{estUnlockDate.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>
              </div>
              <div style={{display:"flex",gap:8,marginTop:8}}>
                <button onClick={()=>setVaultShowPopup(false)} className="b21p" style={{flex:1,padding:"12px",borderRadius:RD.md,border:`1px solid ${C.border}`,background:C.surface,color:C.gray,fontSize:13,fontWeight:600,cursor:"pointer"}}>{t("cancel")}</button>
                <button onClick={()=>{setVaultShowPopup(false);handleCreateVault();}} className="b21p" style={{flex:1,padding:"12px",borderRadius:RD.md,border:"none",background:C.orange,color:"#000",fontSize:13,fontWeight:700,cursor:"pointer"}}>{t("confirm")}</button>
              </div>
            </div>
          </div>}
        </>}

        {vaultStep==="success"&&createdVault&&<>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"20px 0 8px"}}>
            <div style={{width:64,height:64,borderRadius:32,background:C.green+"18",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:20,border:`2px solid ${C.green}30`}}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div style={{fontSize:20,fontWeight:800,color:C.white,marginBottom:6,fontFamily:FN.display}}>{t("vaultCreated")}</div>
            <div style={{fontSize:13,color:C.gray,marginBottom:24}}>{t("vaultCreatedDesc")}</div>
          </div>
          <Crd C={C} style={{marginBottom:24}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:10,fontSize:13}}>
              <span style={{color:C.gray}}>{t("name")}</span>
              <span style={{color:C.white,fontWeight:600}}>{createdVault.name}</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:10,fontSize:13}}>
              <span style={{color:C.gray}}>{t("amountLocked")}</span>
              <span style={{color:C.white,fontFamily:FN.mono,fontWeight:600}}>{(createdVault.amountSats/1e8).toFixed(8)} BTC</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:10,fontSize:13}}>
              <span style={{color:C.gray}}>{t("lockDuration")}</span>
              <span style={{color:C.white,fontWeight:600}}>{createdVault.days>=365?`${Math.round(createdVault.days/365*10)/10} ${t("years")}`:createdVault.days>=30?`${Math.round(createdVault.days/30*10)/10} ${t("months")}`:`${createdVault.days} ${t("days")}`}</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}>
              <span style={{color:C.gray}}>{t("unlocksAround")}</span>
              <span style={{color:C.orange,fontWeight:600}}>{new Date(Date.now()+createdVault.days*86400000).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>
            </div>
          </Crd>
          <PBtn C={C} onClick={()=>{setCreatedVault(null);setVaultStep("myvaults");}}>{t("viewMyVaults")}</PBtn>
          <div style={{height:10}}/>
          <button onClick={()=>{setCreatedVault(null);setMoreSection(null);}} className="b21p" style={{width:"100%",padding:"14px",borderRadius:RD.md,border:`1px solid ${C.border}`,background:C.surface,color:C.gray,fontSize:14,fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}>{t("backToWallet")}</button>
        </>}

        {vaultStep==="spend"&&selectedVaultIndex!==null&&<>
          <Crd C={C} style={{marginBottom:16}}>
            <div style={{fontSize:14,fontWeight:700,color:C.white,marginBottom:2}}>{vaults[selectedVaultIndex]?.name||t("vaultLabel")}</div>
            <div style={{fontSize:12,fontWeight:600,color:C.green,marginBottom:8}}>{t("readyToClaim")}</div>
            <div style={{fontSize:14,fontWeight:700,color:C.white,fontFamily:FN.mono,marginBottom:2}}>{vaultBtcFmt(vaults[selectedVaultIndex]?.amountSats)}</div>
            <div style={{fontSize:11,color:C.gray,fontFamily:FN.mono,marginBottom:6}}>{vaultFiatFmt(vaults[selectedVaultIndex]?.amountSats)}</div>
            <div style={{fontSize:11,color:C.gray}}>{t("vaultLabel")}: {shortAddr(vaults[selectedVaultIndex]?.address)}</div>
          </Crd>
          <WBox C={C}>{t("claimFundsDesc")} ({shortAddr(address)})</WBox>
          <EBox C={C}>{spendErr}</EBox>
          <PBtn C={C} onClick={()=>handleSpendVault(vaults[selectedVaultIndex])} disabled={spendBusy||!walletKeyData}>{spendBusy?t("claiming"):t("claimFundsToWallet")}</PBtn>
        </>}
      </div>);
    }
    // ── Address Book ──
    if(moreSection==="book"){
      const NAME_MAX=20;
      const isEditing=abEditIdx!==null;
      const handleAdd=()=>{
        setAbErr("");
        const nm=newName.trim();
        const ad=newAddr.trim();
        if(!nm){setAbErr(t("enterAName"));return;}
        if(nm.length>NAME_MAX){setAbErr(`Name must be ${NAME_MAX} characters or less`);return;}
        if(!validateAddress(ad,testnet)){setAbErr(t("invalidAddress"));return;}
        // Duplicate check — exclude self when editing
        if(addressBook.some((e,i)=>e.address===ad&&i!==abEditIdx)){setAbErr("This address is already saved in your address book");return;}
        if(isEditing){updateAB(abEditIdx,nm,ad);}else{saveAB(nm,ad);}
        setNewName("");setNewAddr("");setShowAbForm(false);setAbEditIdx(null);
      };
      const closeForm=()=>{setShowAbForm(false);setNewName("");setNewAddr("");setAbErr("");setAbEditIdx(null);};
      const openEdit=(idx)=>{const e=addressBook[idx];setAbEditIdx(idx);setNewName(e.name||"");setNewAddr(e.address||"");setAbErr("");setShowAbForm(true);};
      const doAbCopy=(addr,idx)=>{
        if(navigator.clipboard?.writeText){navigator.clipboard.writeText(addr);}
        else{const ta=document.createElement('textarea');ta.value=addr;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);}
        setAbCopiedIdx(idx);
        setToast(null);setTimeout(()=>setToast({msg:"Address copied",_k:Date.now()}),50);
        setTimeout(()=>setAbCopiedIdx(null),2000);
      };
      const abColors=["#F7931A","#34D399","#60A5FA","#A78BFA","#FBBF24","#F87171","#FB923C","#2DD4BF"];
      const q=abSearch.trim().toLowerCase();
      const filtered=q?addressBook.map((e,i)=>({e,i})).filter(({e})=>e.name.toLowerCase().includes(q)||e.address.toLowerCase().includes(q)):addressBook.map((e,i)=>({e,i}));
      return(<div>
        <Bk onClick={()=>setMoreSection(null)} C={C}/>
        <PT title={t("addressBook")} sub={`${addressBook.length} ${t("savedAddresses")}`} C={C}/>

        {!showAbForm?<button onClick={()=>{setAbEditIdx(null);setNewName("");setNewAddr("");setShowAbForm(true);}} className="b21p" style={{width:"100%",padding:"14px",borderRadius:RD.md,border:`1px dashed ${C.border}`,background:"transparent",color:C.orange,fontSize:13,fontWeight:600,cursor:"pointer",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {t("addContact")}
        </button>:
        <Crd C={C} style={{marginBottom:16,border:`1px solid ${C.orange}20`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:13,fontWeight:600,color:C.white}}>{isEditing?"Edit Contact":t("newContact")}</div>
            <button onClick={closeForm} className="b21p" style={{background:"none",border:"none",cursor:"pointer",color:C.gray,fontSize:18,padding:0,lineHeight:1}}>×</button>
          </div>
          <div style={{position:"relative",marginBottom:8}}>
            <Inp C={C} value={newName} onChange={e=>setNewName(e.target.value.slice(0,NAME_MAX))} placeholder={t("name")} maxLength={NAME_MAX} style={{paddingRight:48}}/>
            <div style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",fontSize:10,color:newName.length>=NAME_MAX?C.orange:C.gray,fontFamily:FN.mono,pointerEvents:"none"}}>{newName.length}/{NAME_MAX}</div>
          </div>
          <Inp C={C} mono value={newAddr} onChange={e=>setNewAddr(e.target.value)} placeholder="bc1q... or 1... or 3..." style={{marginBottom:8}}/>
          <EBox C={C}>{abErr}</EBox>
          <PBtn C={C} onClick={handleAdd}>{isEditing?"Save Changes":t("saveContact")}</PBtn>
        </Crd>}

        {addressBook.length===0?<Empty icon="📒" title={t("noContactsYet")} desc={t("noContactsYetDesc")} C={C}/>:
        <>
          {/* Search — shown once user has 5+ contacts */}
          {addressBook.length>=5&&<div style={{position:"relative",marginBottom:12}}>
            <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:C.gray,opacity:0.5,pointerEvents:"none"}}>{I.search}</span>
            <Inp C={C} value={abSearch} onChange={e=>setAbSearch(e.target.value)} placeholder="Search by name or address" style={{paddingLeft:36,paddingRight:abSearch?36:14,fontSize:13}}/>
            {abSearch&&<button onClick={()=>setAbSearch("")} className="b21p" style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:C.gray,padding:6,display:"flex"}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>}
          </div>}
          {/* Result count (when searching) */}
          {q&&<div style={{fontSize:11,color:C.gray,marginBottom:8,paddingLeft:4}}>
            {filtered.length===0?"No matches":`${filtered.length} of ${addressBook.length} ${filtered.length===1?"contact":"contacts"}`}
          </div>}
          {/* List — renders all; page scroll handles overflow */}
          {filtered.length===0&&q?<Empty icon="🔍" title="No contacts found" desc="Try a different search term." C={C}/>:
            filtered.map(({e,i})=>{
              const wasCopied=abCopiedIdx===i;
              return(<Crd key={i} C={C} style={{marginBottom:8,display:"flex",alignItems:"center",gap:12,...stagger(i)}}>
                <div style={{width:38,height:38,borderRadius:12,background:abColors[i%abColors.length]+"18",border:`1px solid ${abColors[i%abColors.length]}25`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:abColors[i%abColors.length],flexShrink:0}}>
                  {e.name.charAt(0).toUpperCase()}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:600,color:C.white}}>{e.name}</div>
                  <div style={{fontSize:11,fontFamily:FN.mono,wordBreak:"break-all",lineHeight:1.6,color:C.gray}}>{e.address}</div>
                </div>
                <div style={{display:"flex",gap:4,flexShrink:0}}>
                  <button onClick={()=>doAbCopy(e.address,i)} className="b21p" style={{width:32,height:32,borderRadius:RD.sm,background:wasCopied?`${C.green}18`:C.surface,border:`1px solid ${wasCopied?C.green+"40":C.border}`,color:wasCopied?C.green:C.grayLight,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s"}}>
                    {wasCopied?<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>:I.copy}
                  </button>
                  <IBtn C={C} sz={32} onClick={()=>openEdit(i)} title="Edit">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </IBtn>
                  <IBtn C={C} sz={32} onClick={()=>removeAB(i)} style={{color:C.red}}>{I.trash}</IBtn>
                </div>
              </Crd>);
            })}
        </>}
      </div>);
    }
    // ── Show Recovery Phrase sub-screen ──
    if(moreSection==="recovery"){
      enableScreenSecurity(); // Block screenshots while seed is visible
      const isWIF=walletKeyData&&!walletKeyData.includes(" ");
      const words=walletKeyData&&!isWIF?walletKeyData.trim().split(/\s+/):[];

      const handleAuth=async()=>{
        setRcErr("");
        // If PIN set, verify PIN
        if(hasPIN){
          if(!rcPin){setRcErr(t("enterYourPin"));return;}
          const crypto=window.crypto||window.msCrypto;const enc=new TextEncoder();
          const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode("bit21_pin_"+rcPin)))).map(b=>b.toString(16).padStart(2,"0")).join("");
          const storedHash=localStorage.getItem("btc_pin_hash");
          if(hash!==storedHash){setRcErr(t("incorrectPin"));return;}
        }
        // If biometric available, try that
        if(!hasPIN&&isBiometricRegistered()){
          try{await authenticateBiometric();}catch{setRcErr(t("biometricFailedShort"));return;}
        }
        setRcAuth(true);
      };

      return(<div>
        <Bk onClick={()=>{disableScreenSecurity();setMoreSection("backup");}} C={C}/>
        <PT title={t("recoveryPhrase")} sub={t("recoveryPhraseDesc")} C={C}/>

        {!walletKeyData?(
          <Empty icon="👁" title={t("noKeyStored")} desc={t("noKeyStoredDesc")} C={C}/>
        ):!rcAuth?(
          <div>
            <Crd C={C} style={{marginBottom:16,border:`1px solid ${C.red}25`}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                <div style={{color:C.red,fontSize:20,flexShrink:0}}>⚠</div>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:C.red,marginBottom:6}}>{t("securityWarning")}</div>
                  <div style={{fontSize:12,color:C.grayLight,lineHeight:1.6}}>
                    {t("securityWarningDesc")}
                  </div>
                </div>
              </div>
            </Crd>
            {hasPIN&&<div style={{marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:600,color:C.gray,marginBottom:8}}>{t("enterPinToContinue")}</div>
              <Inp C={C} type="password" value={rcPin} onChange={e=>setRcPin(e.target.value)} placeholder={t("enterYourPin")} onKeyDown={e=>{if(e.key==="Enter")handleAuth();}} style={{marginBottom:8}}/>
            </div>}
            <EBox C={C}>{rcErr}</EBox>
            <PBtn C={C} danger onClick={handleAuth}>{hasPIN?t("verifyAndShow"):t("iUnderstandShow")}</PBtn>
          </div>
        ):(
          <div>
            {isWIF?(
              <Crd C={C} style={{marginBottom:16}}>
                <div style={{fontSize:12,fontWeight:600,color:C.gray,marginBottom:8}}>{t("privateKeyWif")}</div>
                <div style={{fontSize:13,color:C.white,fontFamily:FN.mono,wordBreak:"break-all",lineHeight:1.8,padding:"10px 14px",background:C.bgAlt,borderRadius:RD.md,border:`1px solid ${C.border}`}}>
                  {walletKeyData.trim()}
                </div>
              </Crd>
            ):(
              <Crd C={C} style={{marginBottom:16}}>
                <div style={{fontSize:12,fontWeight:600,color:C.gray,marginBottom:8}}>{words.length}-{t("wordRecoveryPhrase")}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:12}}>
                  {words.map((w,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 10px",background:C.bgAlt,borderRadius:RD.sm,border:`1px solid ${C.border}`}}>
                      <span style={{fontSize:10,color:C.gray,fontWeight:700,minWidth:16,textAlign:"right"}}>{i+1}</span>
                      <span style={{fontSize:13,color:C.white,fontFamily:FN.mono,fontWeight:600}}>{w}</span>
                    </div>
                  ))}
                </div>
              </Crd>
            )}
            <div style={{display:"flex",gap:8}}>
              <SBtn C={C} color={rcPhraseCopied?C.green:C.orange} onClick={()=>{
                if(navigator.clipboard?.writeText){navigator.clipboard.writeText(walletKeyData.trim());setTimeout(()=>{try{navigator.clipboard.writeText("");}catch{}},900000);}else{const ta=document.createElement('textarea');ta.value=walletKeyData.trim();ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);}
                setRcPhraseCopied(true);setTimeout(()=>setRcPhraseCopied(false),3000);
              }} style={{flex:1}}>{rcPhraseCopied?t("copiedCheck"):t("copyToClipboard")}</SBtn>
            </div>
            <WBox C={C}>{t("writeDownWarning")}</WBox>
          </div>
        )}
      </div>);
    }

    // ── Backup & Restore ──
    if(moreSection==="backup"){
      const handleExport=async()=>{
        if(bkPass.length<6){setBackupMsg(t("passwordMin6"));return;}
        if(bkPass!==bkPass2){setBackupMsg(t("passwordsDontMatch"));return;}
        setBackupBusy(true);setBackupMsg("");
        try{await exportBackup(bkPass);setBackupMsg(t("backupDownloaded"));}
        catch(e){setBackupMsg(e.message||t("exportFailed"));}
        finally{setBackupBusy(false);}
      };
      const handleImport=async()=>{
        if(!bkFile){setBackupMsg(t("selectBackupFile"));return;}
        if(!bkImportPass){setBackupMsg(t("enterBackupPassword"));return;}
        setBackupBusy(true);setBackupMsg("");
        try{const r=await importBackup(bkFile,bkImportPass);setBkResult(r);setBackupMsg(`${t("restored")} ${r.keys} ${t("itemsFromBackup")}`);}
        catch(e){setBackupMsg(e.message==="Unsupported state or unable to authenticate data"?t("wrongPasswordOrCorrupted"):e.message||t("importFailed"));}
        finally{setBackupBusy(false);}
      };
      return(<div>
        <Bk onClick={()=>setMoreSection(null)} C={C}/>
        <PT title={t("backupRestore")} C={C}/>

        {/* Recovery Phrase card — primary backup method */}
        {!isWatchOnly&&walletKeyData&&(
          <Crd C={C} onClick={()=>setMoreSection("recovery")} style={{marginBottom:16,display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:46,height:46,borderRadius:RD.md,background:C.orangeMuted,display:"flex",alignItems:"center",justifyContent:"center",color:C.orange}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:700,color:C.white}}>{t("recoveryPhrase")}</div>
              <div style={{fontSize:12,color:C.gray,marginTop:2}}>{t("viewBackupSeedPhrase")}</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.gray} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </Crd>
        )}

        {/* Data Backup card */}
        <Crd C={C} onClick={()=>setMoreSection("databackup")} style={{marginTop:16,display:"flex",alignItems:"center",gap:14,cursor:"pointer"}}>
          <div style={{width:46,height:46,borderRadius:RD.md,background:`${C.blue||"#3B82F6"}15`,display:"flex",alignItems:"center",justifyContent:"center",color:C.blue||"#3B82F6"}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:700,color:C.white}}>Data Backup</div>
            <div style={{fontSize:12,color:C.gray,marginTop:2}}>Export or import wallet settings</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.gray} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        </Crd>
      </div>);
    }

    // ── Data Backup (separate screen) ──
    if(moreSection==="databackup"){
      const handleExportDB=async()=>{
        if(bkPass.length<6){setBackupMsg(t("passwordMin6"));return;}
        if(bkPass!==bkPass2){setBackupMsg(t("passwordsDontMatch"));return;}
        setBackupBusy(true);setBackupMsg("");
        try{await exportBackup(bkPass);setBackupMsg(t("backupDownloaded"));}
        catch(e){setBackupMsg(e.message||t("exportFailed"));}
        finally{setBackupBusy(false);}
      };
      const handleImportDB=async()=>{
        if(!bkFile){setBackupMsg(t("selectBackupFile"));return;}
        if(!bkImportPass){setBackupMsg(t("enterBackupPassword"));return;}
        setBackupBusy(true);setBackupMsg("");
        try{const r=await importBackup(bkFile,bkImportPass);setBkResult(r);setBackupMsg(`${t("restored")} ${r.keys} ${t("itemsFromBackup")}`);}
        catch(e){setBackupMsg(e.message==="Unsupported state or unable to authenticate data"?t("wrongPasswordOrCorrupted"):e.message||t("importFailed"));}
        finally{setBackupBusy(false);}
      };
      return(<div>
        <Bk onClick={()=>{setMoreSection("backup");setBkMode(null);setBackupMsg("");}} C={C}/>
        <PT title="Data Backup" sub="Export or import wallet labels, address book, and settings" C={C}/>
        <div style={{fontSize:12,color:C.gray,marginBottom:16,lineHeight:1.5,padding:"0 2px"}}>{t("dataBackupDesc")}</div>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          <SBtn C={C} color={bkMode==="export"?C.orange:undefined} onClick={()=>setBkMode("export")} style={{flex:1}}>{t("export")}</SBtn>
          <SBtn C={C} color={bkMode==="import"?C.orange:undefined} onClick={()=>setBkMode("import")} style={{flex:1}}>{t("import")}</SBtn>
        </div>
        {bkMode==="export"&&<Crd C={C}>
          <div style={{fontSize:12,fontWeight:600,color:C.gray,marginBottom:8}}>{t("encryptBackup")}</div>
          <Inp C={C} type="password" value={bkPass} onChange={e=>setBkPass(e.target.value)} placeholder={t("encryptionPasswordPlaceholder")} style={{marginBottom:8}}/>
          <Inp C={C} type="password" value={bkPass2} onChange={e=>setBkPass2(e.target.value)} placeholder={t("confirmPassword")} style={{marginBottom:12}}/>
          <PBtn C={C} onClick={handleExportDB} disabled={backupBusy}>{backupBusy?<Spin sz={16} color="#FFF"/>:t("downloadBackup")}</PBtn>
        </Crd>}
        {bkMode==="import"&&<Crd C={C}>
          <div style={{fontSize:12,fontWeight:600,color:C.gray,marginBottom:8}}>{t("restoreFromBackup")}</div>
          <input ref={fileInputRef} type="file" accept=".b21" onChange={e=>setBkFile(e.target.files?.[0]||null)} style={{display:"none"}}/>
          <SBtn C={C} color={C.cyan||"#06B6D4"} onClick={()=>fileInputRef.current?.click()} style={{marginBottom:8}}>
            {bkFile?bkFile.name:t("selectB21FileLabel")}
          </SBtn>
          <Inp C={C} type="password" value={bkImportPass} onChange={e=>setBkImportPass(e.target.value)} placeholder={t("backupPassword")} style={{marginBottom:12}}/>
          <PBtn C={C} onClick={handleImportDB} disabled={backupBusy}>{backupBusy?<Spin sz={16} color="#FFF"/>:t("restoreBackup")}</PBtn>
        </Crd>}
        {backupMsg&&<div style={{marginTop:12,padding:"10px 14px",borderRadius:RD.md,fontSize:13,fontWeight:500,background:backupMsg.includes("success")||backupMsg.includes("Restored")?C.greenGlow:C.redGlow,color:backupMsg.includes("success")||backupMsg.includes("Restored")?C.green:C.red,border:`1px solid ${backupMsg.includes("success")||backupMsg.includes("Restored")?C.green+"25":C.red+"25"}`}}>{backupMsg}</div>}
      </div>);
    }

    // ── Notifications ──
    if(moreSection==="notifications"){
      const notifLocalEnabled=(()=>{try{return localStorage.getItem("btc_notif_enabled")!=="0";}catch{return true;}})();
      const pushEnabled=notifLocalEnabled;
      const handlePushToggle=(wantOn)=>{
        try{localStorage.setItem("btc_notif_enabled",wantOn?"1":"0");}catch{}
        setNotifPerm(wantOn?"granted":"default");
      };
      const toggleIncoming=(val)=>{
        const s={...notifSettings,incoming:val};
        setNotifSettingsState(s);setNotifySettings(s);
      };
      return(<div>
        <Bk onClick={()=>setMoreSection(null)} C={C}/>
        <PT title={t("notifications")} sub="Manage your alerts and notifications" C={C}/>

        {/* Master Push Toggle */}
        <Crd C={C} style={{marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:40,height:40,borderRadius:12,background:`${C.orange}15`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              </div>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:C.white}}>Notifications</div>
                <div style={{fontSize:12,color:pushEnabled?C.green:C.gray,fontWeight:500}}>{pushEnabled?"Active":"Off"}</div>
              </div>
            </div>
            <Tog value={pushEnabled} onChange={()=>handlePushToggle(!pushEnabled)} C={C}/>
          </div>
        </Crd>

        {pushEnabled?null:
          <Crd C={C} style={{marginBottom:16,opacity:0.5}}>
            <div style={{textAlign:"center",padding:"20px 0"}}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.gray} strokeWidth="1.5" style={{marginBottom:8}}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              <div style={{fontSize:13,color:C.gray,fontWeight:500}}>Enable notifications to stay updated</div>
            </div>
          </Crd>
        }
      </div>);
    }

    // ── Price Alerts (separate tool) ──
    if(moreSection==="pricealerts"){
      return(<div>
        <Bk onClick={()=>setMoreSection(null)} C={C}/>
        <PT title="Price Alerts" sub={`${priceAlerts.length}/${MAX_ALERTS} alerts set`} C={C}/>

        {priceAlerts.length<MAX_ALERTS&&<button onClick={()=>setShowAddAlert(!showAddAlert)} className="b21p" style={{width:"100%",padding:"12px",marginBottom:16,borderRadius:RD.md,border:`1px dashed ${C.orange}40`,background:C.orangeMuted+"30",cursor:"pointer",color:C.orange,fontSize:13,fontWeight:700}}>{showAddAlert?"Cancel":"+ New Alert"}</button>}

        {showAddAlert&&<Crd C={C} style={{marginBottom:12,border:`1px solid ${C.orange}20`}}>
          <div style={{fontSize:13,fontWeight:600,color:C.white,marginBottom:12}}>{t("newAlert")}</div>
          <div style={{display:"flex",gap:6,marginBottom:10}}>
            {[{id:"price",l:t("priceLevel")},{id:"percent",l:t("percentChange")}].map(at=><button key={at.id} onClick={()=>{setAlertType(at.id);setAlertTarget("");}} className="b21p" style={{flex:1,padding:"8px",borderRadius:RD.sm,border:`1px solid ${alertType===at.id?C.orange+"40":C.border}`,background:alertType===at.id?C.orangeMuted:"transparent",color:alertType===at.id?C.orange:C.gray,fontSize:12,fontWeight:600,cursor:"pointer"}}>{at.l}</button>)}
          </div>
          <div style={{display:"flex",gap:6,marginBottom:10}}>
            {["above","below"].map(d=><button key={d} onClick={()=>setAlertDir(d)} className="b21p" style={{flex:1,padding:"10px",borderRadius:RD.sm,border:`1px solid ${alertDir===d?C.orange+"40":C.border}`,background:alertDir===d?C.orangeMuted:"transparent",color:alertDir===d?C.orange:C.gray,fontSize:13,fontWeight:600,cursor:"pointer"}}>{alertType==="percent"?(d==="above"?`${t("rises")} ↑`:`${t("drops")} ↓`):d==="above"?t("whenAbove"):t("whenBelow")}</button>)}
          </div>
          {alertType==="percent"&&<div style={{marginBottom:10}}>
            <div style={{fontSize:11,color:C.gray,marginBottom:6}}>{t("resetBaselineEvery")}</div>
            <div style={{display:"flex",gap:4}}>
              {[{id:"none",l:t("never")},{id:"1h",l:"1h"},{id:"4h",l:"4h"},{id:"24h",l:"24h"},{id:"7d",l:"7d"}].map(w=><button key={w.id} onClick={()=>setAlertWindow(w.id)} className="b21p" style={{flex:1,padding:"7px 0",borderRadius:RD.sm,border:`1px solid ${alertWindow===w.id?C.orange+"40":C.border}`,background:alertWindow===w.id?C.orangeMuted:"transparent",color:alertWindow===w.id?C.orange:C.gray,fontSize:11,fontWeight:600,cursor:"pointer"}}>{w.l}</button>)}
            </div>
            <div style={{fontSize:9,color:C.gray,marginTop:4}}>{alertWindow==="none"?t("measuresFromCreation"):`${t("baselineResetsEvery")} ${alertWindow}`}</div>
          </div>}
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
            <span style={{fontSize:14,color:C.gray,minWidth:20,textAlign:"center"}}>{alertType==="percent"?"%":curFiat.symbol}</span>
            <Inp C={C} mono type="number" value={alertTarget} onChange={e=>{
              const v=e.target.value;
              if(alertType==="percent"){const n=parseFloat(v);if(v!==""&&n>50)return;}
              setAlertTarget(v);
            }} placeholder={alertType==="percent"?"1 – 50":`e.g. ${alertDir==="above"?"100000":"60000"}`} min={alertType==="percent"?"1":"100"} max={alertType==="percent"?"50":undefined} style={{flex:1}}/>
          </div>
          {alertType==="percent"&&<div style={{fontSize:10,color:C.gray,marginBottom:10,paddingLeft:28}}>{t("minPctMaxPct")} {formatCurrency(price.fiat,fiatCurrency)}</div>}
          {alertType==="price"&&<div style={{fontSize:10,color:C.gray,marginBottom:10,paddingLeft:28}}>{t("minPrice")} {curFiat.symbol}100</div>}
          <div style={{display:"flex",gap:6,marginBottom:12}}>
            {[{id:"once",l:t("oneTime"),d:t("autoDisable")},{id:"recurring",l:t("recurring"),d:t("keepsAlertingCooldown")}].map(m=><button key={m.id} onClick={()=>setAlertMode(m.id)} className="b21p" style={{flex:1,padding:"8px 6px",borderRadius:RD.sm,border:`1px solid ${alertMode===m.id?C.orange+"40":C.border}`,background:alertMode===m.id?C.orangeMuted:"transparent",cursor:"pointer",textAlign:"center"}}>
              <div style={{fontSize:12,fontWeight:600,color:alertMode===m.id?C.orange:C.gray}}>{m.l}</div>
              <div style={{fontSize:9,color:C.gray,marginTop:2}}>{m.d}</div>
            </button>)}
          </div>
          <PBtn C={C} onClick={()=>{
            const tv=parseFloat(alertTarget);if(!tv||tv<=0)return;
            if(alertType==="percent"&&(tv<1||tv>50))return;
            if(alertType==="price"&&tv<100)return;
            if(priceAlerts.length>=MAX_ALERTS)return;
            if(alertType==="percent"&&(!price.fiat||price.fiat<=0))return;
            setPriceAlerts(prev=>[...prev,{id:Date.now(),target:tv,direction:alertDir,type:alertType,mode:alertMode,window:alertType==="percent"?alertWindow:"none",enabled:true,createdAt:Date.now(),createdAtPrice:price.fiat,baselinePrice:price.fiat,baselineAt:Date.now(),currency:fiatCurrency,triggerCount:0,lastTriggered:null}]);
            setAlertTarget("");setShowAddAlert(false);setAlertMode("once");setAlertType("price");setAlertWindow("none");
          }}>{t("saveAlert")}</PBtn>
        </Crd>}

        {priceAlerts.length===0?<div style={{fontSize:12,color:C.gray,padding:16,textAlign:"center"}}>{t("noPriceAlerts")}</div>:
          priceAlerts.map((a,i)=>{
            const bp=a.baselinePrice||a.createdAtPrice;
            const currMatch=(a.currency||"usd")===fiatCurrency;
            const pctNow=a.type==="percent"&&bp&&currMatch?((price.fiat-bp)/bp)*100:null;
            return(<Crd key={a.id} C={C} style={{marginBottom:8,opacity:currMatch?1:0.5,...stagger(i)}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                  <span style={{fontSize:13,fontWeight:600,color:a.enabled&&currMatch?C.white:C.gray}}>
                    {a.type==="percent"?`BTC ${a.direction==="above"?t("rises"):t("drops")} ${a.target}%`:`BTC ${a.direction==="above"?t("whenAbove"):t("whenBelow")} ${(FIAT_CURRENCIES.find(c=>c.code===(a.currency||"usd"))||curFiat).symbol}${a.target.toLocaleString()}`}
                  </span>
                  {a.type==="percent"&&a.window&&a.window!=="none"&&<Badge color={C.purple||"#A855F7"} bg={(C.purple||"#A855F7")+"15"} style={{fontSize:8}}>{a.window}</Badge>}
                  {(a.mode||"once")==="once"?<Badge color={C.gray} bg={C.grayDim} style={{fontSize:8}}>{t("once")}</Badge>:<Badge color={C.blue||"#3B82F6"} bg={(C.blue||"#3B82F6")+"15"} style={{fontSize:8}}>{t("recurring")}</Badge>}
                  {!a.enabled&&a.triggerCount>0&&<Badge color={C.green} bg={C.greenGlow} style={{fontSize:8}}>{t("triggered")}</Badge>}
                  {!currMatch&&<Badge color={C.yellow||"#EAB308"} bg={(C.yellow||"#EAB308")+"15"} style={{fontSize:8}}>{(a.currency||"usd").toUpperCase()}</Badge>}
                </div>
                <div style={{fontSize:11,color:C.gray,marginTop:3}}>
                  {!currMatch?<span>{t("pausedSwitchTo")} {(a.currency||"usd").toUpperCase()} {t("toActivate")}</span>:a.triggerCount>0?<span>{t("fired")} {a.triggerCount}x · {a.lastTriggered?timeAgo(Math.floor(a.lastTriggered/1000)):""}</span>:a.type==="percent"&&bp?<span>{t("baseline")} {formatCurrency(bp,a.currency||"usd")} · {t("now")} {pctNow>=0?"+":""}{pctNow.toFixed(1)}%</span>:<span>{t("currentLabel")} {fmtFiat(price.fiat)}</span>}
                </div>
              </div>
              <Tog value={a.enabled} onChange={()=>setPriceAlerts(prev=>prev.map(x=>x.id===a.id?{...x,enabled:!x.enabled,...(!x.enabled&&x.type==="percent"?{baselinePrice:price.fiat,baselineAt:Date.now()}:{})}:x))} C={C}/>
              <button onClick={()=>setPriceAlerts(prev=>prev.filter(x=>x.id!==a.id))} className="b21p" style={{background:"none",border:"none",cursor:"pointer",color:C.red,padding:4,display:"flex"}}>{I.trash}</button>
            </div>
          </Crd>);})}
      </div>);
    }

    // ── Language ──
    if(moreSection==="language"){
      const handleLangChange=(code)=>{setLangPref(code);setLang(code);};
      return(<div style={{direction:getDirection(lang)==="rtl"?"rtl":"ltr"}}>
        <Bk onClick={()=>setMoreSection("settings")} C={C}/>
        <PT title={t("language",lang)} sub={t("languageDesc",lang)} C={C}/>
        {LANGUAGES.map((l,i)=><Crd key={l.code} C={C} onClick={()=>handleLangChange(l.code)} active={lang===l.code} style={{marginBottom:8,display:"flex",alignItems:"center",gap:14,cursor:"pointer",...stagger(i)}}>
          <div style={{width:40,height:40,borderRadius:RD.md,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,background:lang===l.code?C.orangeMuted:C.bgAlt}}>
            {l.code==="en"?"EN":l.code==="es"?"ES":l.code==="zh"?"ZH":l.code==="ar"?"AR":l.code==="hi"?"HI":"PT"}
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:600,color:lang===l.code?C.orange:C.white}}>{l.nativeName}</div>
            <div style={{fontSize:12,color:C.gray}}>{l.name}</div>
          </div>
          {lang===l.code&&<Badge color={C.green} bg={C.greenGlow}>{t("active")}</Badge>}
        </Crd>)}
      </div>);
    }

    // ── PIN Lock ──
    if(moreSection==="pinlock"){
      const numpadKeys=["1","2","3","4","5","6","7","8","9","","0","\u232B"];
      const handlePinKey=(key)=>{
        if(key==="\u232B"){setPinVal(p=>p.slice(0,-1));setPinMsg("");return;}
        if(!key||pinVal.length>=6)return;
        const next=pinVal+key;setPinVal(next);setPinMsg("");
        if(pinStep==="setup"&&next.length>=4&&next.length<=6){/* wait for confirm */}
        if(pinStep==="confirm"&&next.length===pinFirst.length){
          if(next===pinFirst){onSetPIN(next);setPinVal("");setPinFirst("");setPinStep("manage");setPinMsg(t("pinSetSuccess"));}
          else{setPinVal("");setPinMsg(t("pinsDontMatch"));setPinStep("setup");setPinFirst("");}
        }
        if(pinStep==="duress_setup"&&next.length>=4){/* wait for continue */}
        if(pinStep==="duress_confirm"&&next.length===pinFirst.length){
          if(next===pinFirst){
            if(hashPIN(next)===localStorage.getItem("btc_pin_hash")){setPinVal("");setPinMsg("Decoy PIN must be different from your main PIN");setPinStep("duress_setup");setPinFirst("");return;}
            onSetDuress(next,duressWalletPick);setPinVal("");setPinFirst("");setPinStep("manage");setPinMsg("Decoy PIN set");setDuressWalletPick("");
          }else{setPinVal("");setPinMsg(t("pinsDontMatch"));setPinStep("duress_setup");setPinFirst("");}
        }
        if(pinStep==="verify"&&next.length>=4){
          const hash=hashPIN(next);
          if(hash===localStorage.getItem("btc_pin_hash")){onRemovePIN();setPinVal("");setPinStep("setup");setPinMsg(t("pinRemoved"));}
          else if(next.length===6){setPinVal("");setPinMsg(t("wrongPinTryAgain"));}
        }
      };
      return(<div>
        <Bk onClick={()=>setMoreSection(null)} C={C}/>
        <PT title={t("pinLock")} sub={hasPIN||pinStep==="manage"?t("managePinLock"):t("setPinDesc")} C={C}/>
        {pinMsg&&<div style={{marginBottom:14,padding:"10px 14px",borderRadius:RD.md,fontSize:13,fontWeight:500,background:pinMsg.includes("success")||pinMsg.includes("removed")?C.greenGlow:C.redGlow,color:pinMsg.includes("success")||pinMsg.includes("removed")?C.green:C.red,border:`1px solid ${pinMsg.includes("success")||pinMsg.includes("removed")?C.green+"25":C.red+"25"}`}}>{pinMsg}</div>}
        {pinStep==="manage"&&<>
          <Crd C={C} style={{marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{color:C.orange}}>{I.lock}</span>
                <div><div style={{fontSize:14,fontWeight:600,color:C.white}}>{t("pinLock")}</div>
                  <div style={{fontSize:12,color:C.gray}}>{t("enabled")}</div></div>
              </div>
              <div style={{width:8,height:8,borderRadius:4,background:C.green}}/>
            </div>
          </Crd>
          <div style={{display:"flex",gap:8,marginBottom:20}}>
            <SBtn C={C} color={C.orange} onClick={()=>{setPinStep("setup");setPinVal("");setPinFirst("");setPinMsg("");}} style={{flex:1}}>{t("changePin")}</SBtn>
            <SBtn C={C} color={C.red} onClick={()=>{setPinStep("verify");setPinVal("");setPinMsg("");}} style={{flex:1}}>{t("removePin")}</SBtn>
          </div>

          {/* Duress / Decoy Wallet */}
          <div style={{fontSize:11,fontWeight:700,color:C.gray,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Duress Protection</div>
          <Crd C={C} style={{marginBottom:12}}>
            {localStorage.getItem("btc_duress_pin_hash") ? (
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    <span style={{fontSize:13,fontWeight:600,color:C.white}}>Decoy PIN Active</span>
                  </div>
                  <div style={{width:8,height:8,borderRadius:4,background:C.green}}/>
                </div>
                <p style={{fontSize:11,color:C.gray,lineHeight:1.4,marginBottom:10}}>Entering the decoy PIN at the lock screen will show a different wallet.</p>
                <SBtn C={C} color={C.red} onClick={()=>{onRemoveDuress();setPinMsg("Duress PIN removed");}} style={{width:"100%"}}>Remove Decoy PIN</SBtn>
              </div>
            ) : (
              <div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.gray} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <span style={{fontSize:13,fontWeight:600,color:C.white}}>Decoy Wallet</span>
                </div>
                <p style={{fontSize:11,color:C.gray,lineHeight:1.4,marginBottom:10}}>Set a second PIN that opens a decoy wallet with a small balance. If forced to unlock, use this PIN instead.</p>
                {wallets.length<2 ? (
                  <p style={{fontSize:11,color:C.amber}}>Create a second wallet first, then set it as your decoy.</p>
                ) : (
                  <div>
                    <select onChange={e=>{if(e.target.value){setDuressWalletPick(e.target.value);}}} value={duressWalletPick||""} style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,background:C.bgAlt,color:C.white,fontSize:13,marginBottom:8,outline:"none"}}>
                      <option value="">Select decoy wallet</option>
                      {wallets.filter(w=>w.id!==activeWalletId).map(w=><option key={w.id} value={w.id}>{w.name} ({shortAddr(w.address)})</option>)}
                    </select>
                    {duressWalletPick&&<SBtn C={C} color={C.orange} onClick={()=>{setPinStep("duress_setup");setPinVal("");setPinFirst("");}} style={{width:"100%"}}>Set Decoy PIN</SBtn>}
                  </div>
                )}
              </div>
            )}
          </Crd>
        </>}
        {pinStep==="verify"&&<>
          <div style={{textAlign:"center",marginBottom:16}}>
            <div style={{fontSize:14,fontWeight:600,color:C.white,marginBottom:4}}>{t("enterCurrentPinRemove")}</div>
            <div style={{display:"flex",justifyContent:"center",gap:10,margin:"16px 0"}}>
              {[0,1,2,3,4,5].map(i=><div key={i} style={{width:14,height:14,borderRadius:7,background:i<pinVal.length?C.orange:"transparent",border:`2px solid ${i<pinVal.length?C.orange:C.border}`,transition:"all 0.15s"}}/>)}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,maxWidth:260,margin:"0 auto"}}>
            {numpadKeys.map((key,i)=><button key={i} onClick={()=>handlePinKey(key)} disabled={!key} className="b21p" style={{height:52,borderRadius:RD.md,border:"none",background:key?C.surface:"transparent",color:C.white,fontSize:key==="\u232B"?18:20,fontWeight:700,cursor:key?"pointer":"default",opacity:key?1:0}}>{key}</button>)}
          </div>
        </>}
        {(pinStep==="duress_setup"||pinStep==="duress_confirm")&&<>
          <div style={{textAlign:"center",marginBottom:16}}>
            <div style={{fontSize:14,fontWeight:600,color:C.white,marginBottom:4}}>{pinStep==="duress_setup"?"Enter Decoy PIN":"Confirm Decoy PIN"}</div>
            <div style={{display:"flex",justifyContent:"center",gap:10,margin:"16px 0"}}>
              {[0,1,2,3,4,5].map(i=><div key={i} style={{width:14,height:14,borderRadius:7,background:i<pinVal.length?C.orange:"transparent",border:`2px solid ${i<pinVal.length?C.orange:C.border}`,transition:"all 0.15s"}}/>)}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,maxWidth:260,margin:"0 auto"}}>
            {numpadKeys.map((key,i)=><button key={i} onClick={()=>handlePinKey(key)} disabled={!key} className="b21p" style={{height:52,borderRadius:RD.md,border:"none",background:key?C.surface:"transparent",color:C.white,fontSize:key==="\u232B"?18:20,fontWeight:700,cursor:key?"pointer":"default",opacity:key?1:0}}>{key}</button>)}
          </div>
          {pinStep==="duress_setup"&&pinVal.length>=4&&<PBtn C={C} onClick={()=>{setPinFirst(pinVal);setPinVal("");setPinStep("duress_confirm");}} style={{marginTop:16}}>Continue</PBtn>}
          <SBtn C={C} color={C.gray} onClick={()=>{setPinStep("manage");setPinVal("");setPinFirst("");}} style={{width:"100%",marginTop:8}}>Cancel</SBtn>
        </>}
        {(pinStep==="setup"||pinStep==="confirm")&&<>
          <div style={{textAlign:"center",marginBottom:16}}>
            <div style={{fontSize:14,fontWeight:600,color:C.white,marginBottom:4}}>{pinStep==="setup"?t("enterNewPin"):t("confirmYourPin")}</div>
            <div style={{display:"flex",justifyContent:"center",gap:10,margin:"16px 0"}}>
              {[0,1,2,3,4,5].map(i=><div key={i} style={{width:14,height:14,borderRadius:7,background:i<pinVal.length?C.orange:"transparent",border:`2px solid ${i<pinVal.length?C.orange:C.border}`,transition:"all 0.15s"}}/>)}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,maxWidth:260,margin:"0 auto"}}>
            {numpadKeys.map((key,i)=><button key={i} onClick={()=>handlePinKey(key)} disabled={!key} className="b21p" style={{height:52,borderRadius:RD.md,border:"none",background:key?C.surface:"transparent",color:C.white,fontSize:key==="\u232B"?18:20,fontWeight:700,cursor:key?"pointer":"default",opacity:key?1:0}}>{key}</button>)}
          </div>
          {pinStep==="setup"&&pinVal.length>=4&&<PBtn C={C} onClick={()=>{setPinFirst(pinVal);setPinVal("");setPinStep("confirm");}} style={{marginTop:16}}>{t("continueBtn")}</PBtn>}
        </>}
      </div>);
    }

    // ── Biometric Auth ──
    if(moreSection==="biometric"){
      const handleRegister=async()=>{
        setBioLoading(true);setBioMsg("");
        try{await registerBiometric();localStorage.setItem("btc_bio_active","1");setBioForce(f=>f+1);setTimeout(()=>{setBioRegistered(true);setBioMsg(t("biometricRegistered"));},50);}
        catch(e){setBioMsg(e.message||t("registrationFailed"));}
        finally{setBioLoading(false);}
      };
      const handleTest=async()=>{
        setBioLoading(true);setBioMsg("");
        try{const ok=await authenticateBiometric();setBioMsg(ok?t("authenticationSuccessful"):t("authenticationFailed"));}
        catch(e){setBioMsg(e.message||t("authenticationFailed"));}
        finally{setBioLoading(false);}
      };
      const handleRemove=()=>{removeBiometric();setBioRegistered(false);setBioMsg(t("biometricRemoved"));};
      return(<div>
        <Bk onClick={()=>setMoreSection(null)} C={C}/>
        <PT title={t("biometric",lang)} sub={t("biometricSetup",lang)} C={C}/>
        {!bioAvailable?<WBox C={C}>{t("biometricNotAvailable")}</WBox>:
        <>
          <Crd C={C} style={{marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2"><path d="M12 11c0-1.1.9-2 2-2s2 .9 2 2-2 4-2 4"/><path d="M8 11a4 4 0 0 1 8 0"/><path d="M6 11a6 6 0 0 1 12 0"/><path d="M4 11a8 8 0 0 1 16 0"/><path d="M12 11v4"/></svg>
                <div>
                  <div style={{fontSize:14,fontWeight:600,color:C.white}}>Biometric Lock</div>
                  <div style={{fontSize:12,color:C.gray}}>Fingerprint or face unlock</div>
                </div>
              </div>
              {bioRegistered&&<Tog value={localStorage.getItem("btc_bio_active")!=="0"} onChange={()=>{
                const isOn=localStorage.getItem("btc_bio_active")!=="0";
                if(isOn){setConfirmModal({title:"Disable Biometric Lock?",desc:"Your wallet will no longer require fingerprint or face unlock when opening.",confirmText:"Disable",cancelText:"Keep Enabled",onConfirm:()=>{localStorage.setItem("btc_bio_active","0");setBioForce(f=>f+1);setBioMsg("Biometric lock disabled");setTimeout(()=>setBioMsg(""),2000);setConfirmModal(null);},onCancel:()=>setConfirmModal(null)});}
                else{localStorage.setItem("btc_bio_active","1");setBioForce(f=>f+1);setBioMsg("Biometric lock enabled");setTimeout(()=>setBioMsg(""),2000);}
              }} C={C}/>}
            </div>
          </Crd>
          {!bioRegistered&&<button onClick={handleRegister} disabled={bioLoading} style={{
            width:"100%",padding:"15px",borderRadius:14,border:"none",cursor:"pointer",
            background:`linear-gradient(135deg,${C.orange},${C.orangeDark})`,
            fontSize:15,fontWeight:700,color:C.bg,marginBottom:8,
            display:"flex",alignItems:"center",justifyContent:"center",gap:10,
            opacity:bioLoading?0.6:1,boxShadow:`0 6px 20px ${C.orange}30`,
          }}>
            {bioLoading?<Spin sz={16} color={C.bg}/>:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 11c0-1.1.9-2 2-2s2 .9 2 2-2 4-2 4"/><path d="M8 11a4 4 0 0 1 8 0"/><path d="M6 11a6 6 0 0 1 12 0"/><path d="M4 11a8 8 0 0 1 16 0"/><path d="M12 11v4"/></svg>}
            Register Biometric
          </button>}
          {bioMsg&&<div style={{marginTop:8,padding:"10px 14px",borderRadius:RD.md,fontSize:13,fontWeight:500,background:bioMsg.includes("success")||bioMsg.includes("enabled")||bioMsg.includes("registered")?`${C.green}10`:`${C.red}10`,color:bioMsg.includes("success")||bioMsg.includes("enabled")||bioMsg.includes("registered")?C.green:C.red,border:`1px solid ${(bioMsg.includes("success")||bioMsg.includes("enabled")||bioMsg.includes("registered"))?C.green+"25":C.red+"25"}`}}>{bioMsg}</div>}
        </>}
      </div>);
    }

    // ── Install App (PWA) ──
    if(moreSection==="install"){
      const handleInstall=async()=>{
        if(!deferredInstall)return;
        deferredInstall.prompt();
        const{outcome}=await deferredInstall.userChoice;
        if(outcome==="accepted")setDeferredInstall(null);
      };
      return(<div>
        <Bk onClick={()=>setMoreSection(null)} C={C}/>
        <PT title={t("installApp")} sub={t("installAppSub")} C={C}/>
        <Crd C={C} style={{textAlign:"center",padding:"30px 20px"}}>
          <img src="/icons/icon-192.png" width={64} height={64} alt="bit21" style={{borderRadius:20,margin:"0 auto 16px",display:"block",boxShadow:`0 8px 32px ${C.orangeGlow}`}}/>
          <div style={{fontSize:18,fontWeight:700,color:C.white,marginBottom:6}}>bit21</div>
          <div style={{fontSize:13,color:C.gray,marginBottom:20,lineHeight:1.5}}>{t("installAppDesc")}</div>
          {deferredInstall?<PBtn C={C} onClick={handleInstall}>{t("installNow")}</PBtn>:
            <div style={{fontSize:13,color:C.gray,padding:12,background:C.bgAlt,borderRadius:RD.md}}>
              {window.matchMedia("(display-mode: standalone)").matches?t("appAlreadyInstalled"):t("openInSupportedBrowser")}
            </div>}
        </Crd>
      </div>);
    }

    // ── Terms of Service ──
    if(moreSection==="terms"){
      const s={fontSize:12,color:C.grayLight,lineHeight:1.7,marginBottom:16};
      const h={fontSize:14,fontWeight:700,color:C.white,marginBottom:8,marginTop:20};
      return(<div style={{overflowY:"auto",maxHeight:"calc(100vh - 80px)",paddingBottom:40}}>
        <Bk onClick={()=>setMoreSection("settings")} C={C}/>
        <PT title="Terms of Service" sub="Last updated: March 2026" C={C}/>
        <Crd C={C} pad="18px" style={{marginBottom:16}}>
          <div style={h}>1. Acceptance of Terms</div>
          <div style={s}>By downloading, installing, or using the bit21 application ("App"), you agree to be bound by these Terms of Service. If you do not agree, do not use the App.</div>
          <div style={h}>2. Self-Custody Wallet</div>
          <div style={s}>bit21 is a non-custodial Bitcoin wallet. You are solely responsible for the security of your recovery phrase (seed phrase) and private keys. bit21 does not have access to your funds and cannot recover lost or stolen Bitcoin.</div>
          <div style={h}>3. User Responsibilities</div>
          <div style={s}>You are responsible for: securely storing your recovery phrase, maintaining access to your device, ensuring the accuracy of transaction details before broadcasting, and complying with all applicable laws in your jurisdiction.</div>
          <div style={h}>4. No Financial Advice</div>
          <div style={s}>bit21 does not provide financial, investment, tax, or legal advice. Market data, price alerts, and analytics displayed in the App are for informational purposes only. You should consult a qualified professional before making financial decisions.</div>
          <div style={h}>5. Risks</div>
          <div style={s}>Bitcoin transactions are irreversible. Sending Bitcoin to an incorrect address may result in permanent loss. The value of Bitcoin is volatile and can decrease significantly. You acknowledge and accept these risks.</div>
          <div style={h}>6. Service Availability</div>
          <div style={s}>bit21 relies on third-party blockchain infrastructure and APIs. We do not guarantee uninterrupted access to the App or its features. We reserve the right to modify, suspend, or discontinue any feature at any time.</div>
          <div style={h}>7. Limitation of Liability</div>
          <div style={s}>To the maximum extent permitted by law, bit21 and its creators shall not be liable for any direct, indirect, incidental, or consequential damages arising from your use of the App, including but not limited to loss of Bitcoin, unauthorized access, or service interruptions.</div>
          <div style={h}>8. Intellectual Property</div>
          <div style={s}>The bit21 name, logo, and App design are the property of their respective owners. You may not copy, modify, or distribute any part of the App without prior written consent.</div>
          <div style={h}>9. Changes to Terms</div>
          <div style={s}>We may update these Terms from time to time. Continued use of the App after changes constitutes acceptance of the revised Terms.</div>
          <div style={h}>10. Contact</div>
          <div style={s}>For questions about these Terms, contact us at support@bit21.app</div>
        </Crd>
      </div>);
    }

    // ── Privacy Policy ──
    if(moreSection==="privacy"){
      const s={fontSize:12,color:C.grayLight,lineHeight:1.7,marginBottom:16};
      const h={fontSize:14,fontWeight:700,color:C.white,marginBottom:8,marginTop:20};
      return(<div style={{overflowY:"auto",maxHeight:"calc(100vh - 80px)",paddingBottom:40}}>
        <Bk onClick={()=>setMoreSection("settings")} C={C}/>
        <PT title="Privacy Policy" sub="Last updated: March 2026" C={C}/>
        <Crd C={C} pad="18px" style={{marginBottom:16}}>
          <div style={h}>1. Overview</div>
          <div style={s}>bit21 is committed to protecting your privacy. This policy explains what information we collect, how we use it, and your rights regarding your data.</div>
          <div style={h}>2. Information We Collect</div>
          <div style={s}><strong style={{color:C.white}}>Device Information:</strong> If you opt in to push notifications, we store an anonymous device token so the bit21 notification service can deliver price alerts and wallet notifications you requested.</div>
          <div style={{...s,marginTop:8}}><strong style={{color:C.white}}>Bitcoin Addresses:</strong> Your Bitcoin addresses are queried against the Bitcoin blockchain through the bit21 network layer so the wallet can display balance, transaction history, and UTXO data. These addresses are public on the Bitcoin blockchain by design and are never linked to an identity on our side.</div>
          <div style={{...s,marginTop:8}}><strong style={{color:C.white}}>Usage Analytics:</strong> We do not run analytics, telemetry, or tracking. No personally identifiable information is collected, because there is no account to link it to.</div>
          <div style={h}>3. Information We Do NOT Collect</div>
          <div style={s}>We do not collect your name, email, phone number, government ID, or any KYC information. bit21 does not require account creation or registration.</div>
          <div style={h}>4. Data Storage</div>
          <div style={s}>Wallet data (recovery phrases, private keys) is encrypted and stored locally on your device. bit21 does not transmit your private keys or recovery phrase to any server, ever.</div>
          <div style={h}>5. Network Services</div>
          <div style={s}>The app connects to the bit21 network layer for blockchain queries, market data, and optional push notifications. No identifying information is transmitted with those requests. Your IP address may be briefly visible to the bit21 network layer in order to return a response, and is not stored or linked to you.</div>
          <div style={h}>6. Push Notifications</div>
          <div style={s}>If you enable push notifications, your device token is stored on our server to deliver alerts. You can disable notifications at any time through the App settings or your device settings.</div>
          <div style={h}>7. Data Sharing</div>
          <div style={s}>We do not sell, trade, or share your personal information with third parties for marketing purposes. Data may be shared only when required by law.</div>
          <div style={h}>8. Security</div>
          <div style={s}>Your wallet is protected by multiple layers of encryption and security measures. We follow industry best practices to keep your data safe and regularly update our security protocols.</div>
          <div style={h}>9. Your Rights</div>
          <div style={s}>You can delete your wallet data at any time by removing the App. You can disable push notifications through settings. You can request deletion of any server-side data by contacting us.</div>
          <div style={h}>10. Children's Privacy</div>
          <div style={s}>bit21 is not intended for use by individuals under the age of 18. We do not knowingly collect data from minors.</div>
          <div style={h}>11. Changes to This Policy</div>
          <div style={s}>We may update this Privacy Policy from time to time. Changes will be reflected in the App with an updated date.</div>
          <div style={h}>12. Contact</div>
          <div style={s}>For privacy-related inquiries, contact us at support@bit21.app</div>
        </Crd>
      </div>);
    }

    // ── Address Type Picker ──
    if(moreSection==="addrtype"){
      const currentTypeKey=activeWallet?.addressType||"NATIVE_SEGWIT";
      const typeEntries=Object.entries(ADDRESS_TYPES);
      const feeLabels={LEGACY:"Highest fees",SEGWIT_COMPAT:"Medium fees",NATIVE_SEGWIT:"Low fees",TAPROOT:"Lowest fees"};
      return(<div>
        <Bk onClick={()=>setMoreSection("settings")} C={C}/>
        <PT title="Address Type" sub="Choose your Bitcoin address format" C={C}/>
        {typeEntries.map(([key,cfg])=>{
          const isActive=key===currentTypeKey;
          const prefix=testnet?cfg.prefix.testnet:cfg.prefix.mainnet;
          return(<Crd key={key} C={C} active={isActive} onClick={()=>{
            if(isActive)return;
            setConfirmModal({
              title:"Change Address Type?",
              message:`From: ${ADDRESS_TYPES[currentTypeKey].name}\nTo: ${cfg.name}\n\nYour receive address will change. Existing vaults and funds are not affected.`,
              confirmText:"Switch",
              cancelText:"Cancel",
              onConfirm:()=>{
                setConfirmModal(null);
                if(onChangeAddressType)onChangeAddressType(activeWalletId,key);
                setMoreSection("settings");
              },
            });
          }} style={{marginBottom:10,cursor:"pointer",display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:44,height:44,borderRadius:RD.md,background:isActive?C.orangeMuted:C.bgAlt||"#0C0C0F",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,fontFamily:FN.mono,color:isActive?C.orange:C.grayLight}}>{prefix}</div>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:14,fontWeight:700,color:isActive?C.orange:C.white}}>{cfg.name}</span>
                {cfg.recommended&&<span style={{fontSize:9,fontWeight:700,color:C.orange,background:C.orangeMuted,padding:"2px 6px",borderRadius:4}}>Recommended</span>}
              </div>
              <div style={{fontSize:11,color:C.gray,marginTop:2}}>{cfg.bip} · {feeLabels[key]||""}</div>
              <div style={{fontSize:10,color:C.gray,marginTop:1}}>{cfg.description}</div>
            </div>
            {isActive&&<div style={{width:22,height:22,borderRadius:11,background:C.orange,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></div>}
          </Crd>);
        })}
        <Crd C={C} pad="12px" style={{marginTop:8}}>
          <div style={{fontSize:11,color:C.gray,lineHeight:1.5}}>
            All address types derive from the same recovery phrase. Switching changes your receive address but does not move funds. Your Bitcoin stays safe regardless of which type you choose.
          </div>
        </Crd>
      </div>);
    }

    if(moreSection==="btcunit"){
      return(<div>
        <Bk onClick={()=>setMoreSection("settings")} C={C}/>
        <PT title={t("bitcoinUnit")} sub={t("bitcoinUnitDesc")} C={C}/>
        {BTC_UNITS.map(u=><Crd key={u.id} C={C} onClick={()=>changeUnit(u.id)} active={btcUnit===u.id} style={{marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:42,height:42,borderRadius:RD.md,background:btcUnit===u.id?C.orange+"18":C.bgAlt,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:800,fontFamily:FN.mono,color:btcUnit===u.id?C.orange:C.grayLight}}>{u.symbolAlt}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:700,color:btcUnit===u.id?C.white:C.grayLight}}>{u.name} <span style={{fontSize:12,color:C.gray,fontFamily:FN.mono,fontWeight:500}}>({u.symbol})</span></div>
            <div style={{fontSize:11,color:C.gray,fontFamily:FN.mono,marginTop:2}}>{u.desc}</div>
          </div>
          {btcUnit===u.id&&<div style={{width:22,height:22,borderRadius:11,background:C.orange,display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></div>}
        </Crd>)}
        <Div C={C} sp={16}/>
        <Crd C={C} pad="14px">
          <div style={{fontSize:10,fontWeight:700,color:C.gray,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>{t("reference")}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:0}}>
            <div style={{fontSize:9,fontWeight:700,color:C.gray,padding:"4px 0",borderBottom:`1px solid ${C.border}`}}>{t("unitHeader")}</div>
            <div style={{fontSize:9,fontWeight:700,color:C.gray,padding:"4px 0",borderBottom:`1px solid ${C.border}`,textAlign:"center"}}>{t("symbolHeader")}</div>
            <div style={{fontSize:9,fontWeight:700,color:C.gray,padding:"4px 0",borderBottom:`1px solid ${C.border}`,textAlign:"right"}}>{t("btcValueHeader")}</div>
            {BTC_UNITS.map(u=><React.Fragment key={u.id+"r"}>
              <div style={{fontSize:12,color:btcUnit===u.id?C.orange:C.grayLight,padding:"6px 0",fontWeight:btcUnit===u.id?700:400}}>{u.name}</div>
              <div style={{fontSize:12,color:btcUnit===u.id?C.orange:C.grayLight,padding:"6px 0",textAlign:"center",fontFamily:FN.mono,fontWeight:btcUnit===u.id?700:400}}>{u.symbol}</div>
              <div style={{fontSize:11,color:btcUnit===u.id?C.orange:C.gray,padding:"6px 0",textAlign:"right",fontFamily:FN.mono,fontWeight:btcUnit===u.id?700:400}}>{u.desc}</div>
            </React.Fragment>)}
          </div>
        </Crd>
      </div>);
    }

    // ── Fiat Currency Selector ──
    if(moreSection==="currency"){
      return(<div>
        <Bk onClick={()=>setMoreSection("settings")} C={C}/>
        <PT title={t("currency",lang)||"Currency"} sub={t("currencyDesc",lang)||"Choose your display currency"} C={C}/>
        {FIAT_CURRENCIES.map((fc,i)=><Crd key={fc.code} C={C} onClick={()=>changeFiat(fc.code)} active={fiatCurrency===fc.code} style={{marginBottom:8,display:"flex",alignItems:"center",gap:14,cursor:"pointer",...stagger(i)}}>
          <div style={{width:42,height:42,borderRadius:RD.md,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,background:fiatCurrency===fc.code?C.orangeMuted:C.bgAlt}}>{fc.flag}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:600,color:fiatCurrency===fc.code?C.orange:C.white}}>{fc.code.toUpperCase()}</div>
            <div style={{fontSize:12,color:C.gray}}>{fc.name}</div>
          </div>
          <div style={{fontSize:16,fontWeight:700,fontFamily:FN.mono,color:fiatCurrency===fc.code?C.orange:C.gray}}>{fc.symbol}</div>
          {fiatCurrency===fc.code&&<div style={{width:22,height:22,borderRadius:11,background:C.orange,display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></div>}
        </Crd>)}
      </div>);
    }

    // ── Settings ──
    if(moreSection==="settings"){
      const addrType=getAddressType?.(address)||"unknown";
      const secLbl=(txt)=>({fontSize:11,fontWeight:600,color:C.gray,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:8,marginTop:20});
      return(<div>
        <Bk onClick={()=>setMoreSection(null)} C={C}/>
        <PT title={t("settings",lang)} C={C}/>

        {/* ── Display ── */}
        <div style={secLbl()}>{t("display")}</div>
        <Crd C={C} style={{marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{color:C.orange}}>{theme==="dark"?I.moon:I.sun}</span><span style={{fontSize:14,fontWeight:600,color:C.white}}>{t("darkMode",lang)}</span></div>
            <Tog value={theme==="dark"} onChange={toggleTheme} C={C}/>
          </div>
        </Crd>
        <Crd C={C} style={{marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{color:C.orange}}>{stealthMode?I.eyeOff:I.eye}</span><span style={{fontSize:14,fontWeight:600,color:C.white}}>{t("stealthMode",lang)}</span></div>
            <Tog value={stealthMode} onChange={()=>setStealth(!stealthMode)} C={C}/>
          </div>
        </Crd>
        <Crd C={C} onClick={()=>setMoreSection("btcunit")} style={{marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{color:C.orange,fontSize:16,fontWeight:800}}>₿</span>
            <div><div style={{fontSize:14,fontWeight:600,color:C.white}}>{t("bitcoinUnit")}</div>
            <div style={{fontSize:11,color:C.gray,marginTop:1}}>{curUnit.name} ({curUnit.symbol})</div></div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.gray} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        </Crd>
        <Crd C={C} onClick={()=>setMoreSection("currency")} style={{marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:16}}>{curFiat.flag}</span>
            <div><div style={{fontSize:14,fontWeight:600,color:C.white}}>{t("currency")}</div>
            <div style={{fontSize:11,color:C.gray,marginTop:1}}>{curFiat.name} ({curFiat.symbol})</div></div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.gray} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        </Crd>

        {/* ── Language & Region ── */}
        <div style={secLbl()}>{t("languageRegion")}</div>
        <Crd C={C} onClick={()=>setMoreSection("language")} style={{marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{color:C.orange}}>{I.globe}</span>
            <div><div style={{fontSize:14,fontWeight:600,color:C.white}}>{t("language",lang)}</div>
            <div style={{fontSize:11,color:C.gray,marginTop:1}}>{LANGUAGES.find(l=>l.code===lang)?.nativeName||"English"}</div></div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.gray} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        </Crd>

        {/* ── Wallet Info ── */}
        <div style={secLbl()}>{t("walletInfo")}</div>
        <Crd C={C} style={{marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div>
              <div style={{fontSize:12,color:C.gray,marginBottom:3}}>{t("walletName")}</div>
              <div style={{fontSize:15,fontWeight:600,color:C.white}}>{walletName||t("myWallet")}</div>
            </div>
            {onRenameWallet&&<SBtn C={C} fw={false} color={C.orange} onClick={()=>{setShowRenameModal({walletId:activeWalletId,currentName:walletName||""});setRenameInput(walletName||"");}} style={{fontSize:12}}>{t("rename")}</SBtn>}
          </div>
          <Div C={C} sp={8}/>
          <div onClick={()=>{if(!isWatchOnly&&walletKeyData)setMoreSection("addrtype");}} style={{cursor:isWatchOnly?"default":"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:12,color:C.gray,marginBottom:3}}>{t("addressType")}</div>
              <div style={{fontSize:13,fontWeight:600,color:C.white,marginBottom:2}}>{ADDRESS_TYPES[activeWallet?.addressType]?.name||addrType}</div>
              <div style={{fontSize:11,color:C.gray}}>{ADDRESS_TYPES[activeWallet?.addressType]?.bip||""}</div>
            </div>
            {!isWatchOnly&&walletKeyData&&<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.gray} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>}
          </div>
          <Div C={C} sp={8}/>
          <div style={{fontSize:11,color:C.gray,fontFamily:FN.mono,wordBreak:"break-all",lineHeight:1.5}}>{address}</div>
        </Crd>

        {/* ── About ── */}
        <div style={secLbl()}>{t("about")}</div>
        <Crd C={C} style={{marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <img src="/icons/icon-192.png" width={32} height={32} alt="bit21" style={{borderRadius:10}} />
              <div>
                <div style={{fontSize:14,fontWeight:700,color:C.white}}>bit21</div>
                <div style={{fontSize:11,color:C.gray}}>v1.0.0 · {t("selfCustodyWallet")}</div>
              </div>
            </div>
          </div>
        </Crd>

        {/* ── Legal ── */}
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <Crd C={C} onClick={()=>setMoreSection("terms")} style={{flex:1,cursor:"pointer",display:"flex",alignItems:"center",gap:8,padding:"12px 14px"}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.gray} strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span style={{fontSize:12,fontWeight:600,color:C.grayLight}}>Terms of Service</span>
          </Crd>
          <Crd C={C} onClick={()=>setMoreSection("privacy")} style={{flex:1,cursor:"pointer",display:"flex",alignItems:"center",gap:8,padding:"12px 14px"}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.gray} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span style={{fontSize:12,fontWeight:600,color:C.grayLight}}>Privacy Policy</span>
          </Crd>
        </div>

        {/* ── Remove Wallet ── */}
        <div style={{...secLbl(),color:C.gray,marginTop:28}}>{t("walletManagement")}</div>
        <div style={{fontSize:12,color:C.gray,marginBottom:12,lineHeight:1.5}}>{t("walletManagementDesc")}</div>
        <PBtn C={C} danger onClick={()=>setConfirmModal({title:t("removeWalletConfirm"),message:t("removeWalletDesc"),confirmText:t("remove"),cancelText:t("cancel"),danger:true,onConfirm:()=>{setConfirmModal(null);onDisconnect();}})}>{t("disconnectWallet",lang)}</PBtn>
      </div>);
    }

    // ── More Menu (Grouped) ──
    const sections=[
      deferredInstall&&{title:t("installApp",lang),items:[
        {id:"install",icon:I.install,label:t("installApp",lang),desc:t("installDesc",lang),c:C.orange},
      ]},
      {title:t("walletTools",lang),items:[
        {id:"utxo",icon:I.utxo,label:t("utxoControl",lang),desc:`${utxos.length} ${t("outputs",lang)}`,c:C.orange},
        !isWatchOnly&&features.vaultEnabled&&{id:"vault",icon:I.vault,label:t("vault",lang),desc:t("vaultDesc",lang),c:C.orange,onOpen:()=>setVaultStep("list")},
        {id:"book",icon:I.book,label:t("addressBook",lang),desc:`${addressBook.length} ${addressBook.length===1?"contact":"contacts"}`,c:C.orange},
        {id:"pricealerts",icon:I.bell,label:"Price Alerts",desc:`${priceAlerts.length} ${priceAlerts.length===1?"alert":"alerts"} set`,c:C.orange},
      ]},
      {title:t("security",lang),items:[
        {id:"backup",icon:I.backup,label:t("backupRestore",lang),desc:t("backupDesc",lang),c:C.orange},
        {id:"biometric",icon:I.finger,label:t("biometric",lang),desc:bioRegistered?t("confirmed",lang):t("biometricSetup",lang),c:C.orange},
        {id:"pinlock",icon:I.lock,label:t("pinLock"),desc:hasPIN?t("enabled"):t("notSet"),c:C.orange},
      ]},
      {title:t("preferences",lang),items:[
        {id:"settings",icon:I.gear,label:t("settings",lang),desc:t("settingsDesc",lang),c:C.orange},
        {id:"notifications",icon:I.bell,label:t("notifications",lang),desc:notifPerm==="granted"?t("confirmed",lang):t("notificationsDesc",lang),c:C.orange},
      ]},
    ].filter(Boolean);
    let gIdx=0;
    return(<div>
      <PT title={t("more",lang)} C={C}/>
      {sections.map((sec,si)=>{const items=sec.items.filter(Boolean);if(!items.length)return null;return(<div key={si} style={{marginBottom:16}}>
        <SL C={C}>{sec.title}</SL>
        {items.map((m)=>{const idx=gIdx++;return(<Crd key={m.id} C={C} onClick={()=>{setMoreSection(m.id);if(m.onOpen)m.onOpen();window.scrollTo(0,0);const el=document.querySelector('[data-content]');if(el)el.scrollTop=0;}} style={{marginBottom:8,display:"flex",alignItems:"center",gap:14,...stagger(idx)}}>
          <div style={{width:44,height:44,borderRadius:RD.md,display:"flex",alignItems:"center",justifyContent:"center",background:m.c+"12",color:m.c}}>{m.icon}</div>
          <div style={{flex:1}}><div style={{fontSize:15,fontWeight:600,color:C.white}}>{m.label}</div><div style={{fontSize:12,color:C.gray,marginTop:3}}>{m.desc}</div></div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.gray} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        </Crd>);})}
      </div>);})}
    </div>);
  };

  /* ═══ WALLET PICKER MODAL (unified — wallets + add wallet) ═══ */
  const closeWalletPicker=()=>{setShowWalletPicker(false);setWalletPickerMode("list");setShowRenameModal(null);setRenameInput("");setShowWatchInput(false);setWatchInput("");setWalletMenuOpen(null);};

  const renderWalletPicker=()=>{
    if(!showWalletPicker)return null;
    return(<div style={{position:"fixed",inset:0,zIndex:9999,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={closeWalletPicker}>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(8px)"}}/>
      <div onClick={e=>{e.stopPropagation();setWalletMenuOpen(null);}} style={{position:"relative",width:"100%",maxWidth:420,background:C.surface,borderRadius:`${RD.xl}px ${RD.xl}px 0 0`,padding:"24px 20px",paddingBottom:40,animation:"b21bs 0.3s ease-out",maxHeight:"80vh",overflowY:"auto"}}>
        <div style={{width:40,height:4,borderRadius:2,background:C.grayDim,margin:"0 auto 16px"}}/>

        {walletPickerMode==="add"?(
          <>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
              <button onClick={()=>setWalletPickerMode("list")} className="b21p" style={{background:"none",border:"none",cursor:"pointer",color:C.grayLight,fontSize:14,padding:0}}>‹ {t("back")}</button>
              <h3 style={{fontSize:18,fontWeight:800,color:C.white,margin:0,fontFamily:FN.display}}>{t("addWallet")}</h3>
            </div>
            <Crd C={C} onClick={()=>{closeWalletPicker();onImportWallet?.();}} style={{marginBottom:10,display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:46,height:46,borderRadius:RD.md,background:C.greenGlow,display:"flex",alignItems:"center",justifyContent:"center",color:C.green}}>{I.importW}</div>
              <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:C.white}}>{t("importWalletBtn")}</div><div style={{fontSize:12,color:C.gray,marginTop:2}}>{t("restoreFromPhrase")}</div></div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.gray} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </Crd>
            <Crd C={C} onClick={()=>{closeWalletPicker();onAddWallet?.();}} style={{marginBottom:10,display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:46,height:46,borderRadius:RD.md,background:C.orangeMuted,display:"flex",alignItems:"center",justifyContent:"center",color:C.orange}}>{I.walletAdd}</div>
              <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:C.white}}>{t("createNewWalletBtn")}</div><div style={{fontSize:12,color:C.gray,marginTop:2}}>{t("startFreshSeed")}</div></div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.gray} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </Crd>
            {!showWatchInput?<Crd C={C} onClick={()=>setShowWatchInput(true)} style={{display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:46,height:46,borderRadius:RD.md,background:(C.blue||"#3B82F6")+"12",display:"flex",alignItems:"center",justifyContent:"center",color:C.blue||"#3B82F6"}}>{I.eye}</div>
              <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:C.white}}>{t("watchAddress")}</div><div style={{fontSize:12,color:C.gray,marginTop:2}}>{t("watchAddressDesc")}</div></div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.gray} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </Crd>:
            <Crd C={C}>
              <div style={{fontSize:13,fontWeight:700,color:C.white,marginBottom:10}}>{t("watchAddress")}</div>
              <Inp C={C} mono value={watchInput} onChange={e=>setWatchInput(e.target.value)} placeholder="bc1q... or 1... or 3..." style={{marginBottom:10}}/>
              <div style={{display:"flex",gap:8}}>
                <SBtn C={C} color={C.gray} onClick={()=>{setShowWatchInput(false);setWatchInput("");}} style={{flex:1}}>{t("cancel")}</SBtn>
                <PBtn C={C} fw={false} onClick={()=>{const a=watchInput.trim();if(!a||!validateAddress(a,testnet))return;closeWalletPicker();onWatchWallet?.(a);}} style={{flex:1}}>{t("watch")}</PBtn>
              </div>
            </Crd>}
          </>
        ):(
          <>
            <h3 style={{fontSize:18,fontWeight:800,color:C.white,margin:"0 0 16px",fontFamily:FN.display}}>{t("wallets")}</h3>
            {(()=>{const wColors=["#F7931A","#34D399","#60A5FA","#A78BFA","#FBBF24","#F87171","#FB923C","#2DD4BF"];return wallets?.map((w,i)=>{
              const isActive=w.id===activeWalletId;
              const wc=w.watchOnly?(C.blue||"#3B82F6"):wColors[i%wColors.length];
              const cachedBal=(()=>{try{const c=JSON.parse(localStorage.getItem(`btc_cache_${w.address}_false`));if(c?.balance)return c.balance;}catch{}return null;})();
              const cachedPrice=(()=>{try{const c=JSON.parse(localStorage.getItem(`btc_cache_${w.address}_false`));if(c?.price)return c.price;}catch{}return null;})();
              const wBal=isActive?balance.total:(cachedBal?.total||0);
              const wFiat=isActive?(balance.total*price.fiat):((cachedBal?.total||0)*(cachedPrice?.fiat||price.fiat));
              return(
              <div key={w.id||i}
                style={{display:"flex",alignItems:"center",borderRadius:RD.lg,marginBottom:4,
                  background:isActive?`${C.orange}08`:"transparent",
                  borderLeft:isActive?`3px solid ${C.orange}`:"3px solid transparent",
                }}>
                {/* Switchable area */}
                <div onClick={()=>{if(!isActive){onSwitchWallet?.(w.id);setActiveTab("home");setMoreSection(null);setRadarSection(null);sendResetForm();setTxDetail(null);setTransferMode("receive");}setWalletMenuOpen(null);closeWalletPicker();}} className="b21p"
                  style={{display:"flex",alignItems:"center",gap:12,padding:"14px 12px 14px 16px",flex:1,minWidth:0,cursor:"pointer"}}>
                  {/* Avatar */}
                  <div style={{width:36,height:36,borderRadius:10,background:isActive?wc:wc+"15",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
                    color:isActive?"#000":wc,fontWeight:800,fontSize:14,fontFamily:FN.display}}>
                    {w.watchOnly?<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>:(w.name||"W").charAt(0).toUpperCase()}
                  </div>
                  {/* Name + Balance */}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:isActive?700:600,color:C.white}}>{w.name||t("wallet")}</div>
                    <div style={{fontSize:12,color:C.gray,fontFamily:FN.mono,marginTop:1}}>
                      {stealthMode?"••••":fmtUnit(wBal)} {satsUnit}
                      {wFiat>0&&<span style={{marginLeft:6,fontSize:11,color:C.grayDim}}>≈ {stealthMode?"••••":fmtFiat(wFiat)}</span>}
                    </div>
                  </div>
                  {isActive&&<div style={{width:6,height:6,borderRadius:3,background:C.green,flexShrink:0}}/>}
                </div>
                {/* Menu - completely separate touch target */}
                <div style={{position:"relative",flexShrink:0,padding:"8px 12px 8px 4px"}}>
                  <button onClick={(e)=>{e.stopPropagation();setWalletMenuOpen(walletMenuOpen===w.id?null:w.id);}} className="b21p" style={{background:"none",border:"none",cursor:"pointer",color:C.gray,padding:8,fontSize:18,lineHeight:1,display:"flex",alignItems:"center",justifyContent:"center",minWidth:32,minHeight:32}}>⋮</button>
                  {walletMenuOpen===w.id&&(
                    <div onClick={e=>e.stopPropagation()} style={{position:"absolute",right:8,top:40,background:C.bgAlt||C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:4,minWidth:150,zIndex:10,boxShadow:"0 8px 24px rgba(0,0,0,0.5)"}}>
                      <button onClick={()=>{navigator.clipboard?.writeText(w.address);setToast({msg:"Address copied"});setWalletMenuOpen(null);}} className="b21p" style={{width:"100%",padding:"10px 12px",background:"none",border:"none",cursor:"pointer",color:C.white,fontSize:13,textAlign:"left",borderRadius:8,display:"flex",alignItems:"center",gap:8}}>
                        {I.copy}<span>Copy Address</span>
                      </button>
                      <button onClick={()=>{setShowRenameModal({walletId:w.id,currentName:w.name||""});setRenameInput(w.name||"");setWalletMenuOpen(null);}} className="b21p" style={{width:"100%",padding:"10px 12px",background:"none",border:"none",cursor:"pointer",color:C.white,fontSize:13,textAlign:"left",borderRadius:8,display:"flex",alignItems:"center",gap:8}}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg><span>Rename</span>
                      </button>
                      {onDeleteWallet&&<button onClick={()=>{setShowDeleteModal({walletId:w.id,name:w.name||t("wallet"),watchOnly:!!w.watchOnly});setDeleteConfirmed(false);setWalletMenuOpen(null);}} className="b21p" style={{width:"100%",padding:"10px 12px",background:"none",border:"none",cursor:"pointer",color:C.red,fontSize:13,textAlign:"left",borderRadius:8,display:"flex",alignItems:"center",gap:8}}>
                        {I.trash}<span>Delete</span>
                      </button>}
                    </div>
                  )}
                </div>
              </div>);
            });})()}
            <button onClick={()=>setWalletPickerMode("add")} className="b21p"
              style={{width:"100%",padding:"13px",borderRadius:RD.lg,border:`1px dashed ${C.orange}40`,background:C.orangeMuted+"30",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,color:C.orange,fontSize:13,fontWeight:700,marginTop:6}}>
              {I.plus} {t("addWallet")}
            </button>
          </>
        )}
      </div>
    </div>);
  };

  /* ═══ MAIN RENDER ═══ */
  const tabs=[
    {id:"home",icon:I.home,label:t("home",lang)},
    {id:"transfer",icon:I.transfer,label:t("transfer",lang)},
    {id:"radar",icon:I.radar,label:t("radar",lang)},
    {id:"more",icon:I.more,label:t("more",lang)},
  ];

  // Biometric lock overlay
  if(bioLocked){
    const doBioUnlock=async()=>{try{const ok=await authenticateBiometric();if(ok)setBioLocked(false);}catch{}};
    return(<div style={{height:"100dvh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",fontFamily:FN.body}}>
      <div style={{width:"100%",maxWidth:320,padding:24,textAlign:"center"}}>
        <img src="/icons/icon-192.png" width={56} height={56} alt="bit21" style={{borderRadius:16,margin:"0 auto 20px",display:"block"}}/>
        <h2 style={{fontSize:20,fontWeight:800,color:C.white,marginBottom:8}}>bit21</h2>
        <p style={{fontSize:13,color:C.gray,marginBottom:30}}>Tap to unlock</p>
        <button onClick={doBioUnlock} style={{width:"100%",padding:"16px",borderRadius:14,border:`1px solid ${C.orange}30`,background:`${C.orange}10`,color:C.orange,fontSize:15,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 11c0-1.1.9-2 2-2s2 .9 2 2-2 4-2 4"/><path d="M8 11a4 4 0 0 1 8 0"/><path d="M6 11a6 6 0 0 1 12 0"/><path d="M4 11a8 8 0 0 1 16 0"/><path d="M12 11v4"/></svg>
          Unlock
        </button>
      </div>
    </div>);
  }

  return(
    <div style={{background:C.bg,height:"100dvh",color:C.white,fontFamily:FN.body,display:"flex",flexDirection:"column",alignItems:"center",overflow:"hidden"}}>
      <div style={{width:"100%",maxWidth:420,padding:"0 16px",paddingBottom:72,display:"flex",flexDirection:"column",flex:1,overflowY:"auto",overflowX:"hidden",WebkitOverflowScrolling:"touch",scrollbarWidth:"none"}}>
        <style>{`div::-webkit-scrollbar{display:none}`}</style>
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0 10px",position:"sticky",top:0,zIndex:100,background:C.glassOverlay,backdropFilter:"blur(16px)",marginLeft:-16,marginRight:-16,paddingLeft:16,paddingRight:16}}>
          <div onClick={()=>setShowWalletPicker(true)} className="b21p" style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",paddingLeft:2}}>
            <div style={{fontSize:16,fontWeight:700,color:C.white,letterSpacing:"-0.01em"}}>{walletName||"bit21"}</div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.gray} strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div style={{display:"flex",gap:4,alignItems:"center"}}>
            <div title={apiStatus==="ok"?t("apiConnected"):apiStatus==="slow"?t("apiSlow"):t("apiError")} style={{width:7,height:7,borderRadius:4,background:apiStatus==="ok"?C.green:apiStatus==="slow"?C.yellow:C.red,boxShadow:`0 0 5px ${apiStatus==="ok"?C.green:apiStatus==="slow"?C.yellow:C.red}35`,transition:"all 0.3s",marginRight:2}}/>
            <IBtn C={C} sz={34} onClick={()=>setStealth(!stealthMode)} style={{color:stealthMode?C.orange:C.gray}}>{stealthMode?I.eyeOff:I.eye}</IBtn>
          </div>
        </div>

        {/* Error bar */}
        {error&&<EBox C={C}>{error}</EBox>}

        {/* Content */}
        <div data-content style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",position:"relative"}} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          {/* Pull-to-refresh indicator */}
          {(pullDist>0||isRefreshing)&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:pullDist>0?pullDist:40,overflow:"hidden",transition:pullDist>0?"none":"height 0.3s ease"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:20,height:20,border:`2px solid ${isPulling||isRefreshing?C.orange:C.gray}40`,borderTopColor:isPulling||isRefreshing?C.orange:C.gray,borderRadius:"50%",animation:isRefreshing?"b21sp 0.8s linear infinite":"none",transform:`rotate(${pullDist*3}deg)`,transition:pullDist>0?"none":"transform 0.3s"}}/>
              <span style={{fontSize:12,color:isPulling?C.orange:C.gray,fontWeight:600,transition:"color 0.2s"}}>{isRefreshing?"Updating...":isPulling?"Release to refresh":"Pull to refresh"}</span>
            </div>
          </div>}
          {txDetail?renderTxDetail():
            showAllTx?renderAllTxScreen():
            activeTab==="home"?renderHomeTab():
            activeTab==="transfer"?renderTransferTab():
            activeTab==="radar"?renderRadarTab():
            activeTab==="more"?renderMoreTab():null}
        </div>
      </div>

      {/* Toast notification — center screen */}
      {toast&&<div key={toast._k||toast.msg} style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:10000,maxWidth:280,background:C.surface,borderRadius:RD.lg,padding:"12px 24px",border:`1px solid ${C.orange}30`,boxShadow:`0 12px 40px rgba(0,0,0,0.6)`,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:1}} onClick={()=>setToast(null)}>
        <div style={{fontSize:13,fontWeight:600,color:C.orange}}>{toast.msg}</div>
        {toast.sub&&<div style={{fontSize:11,color:C.gray,whiteSpace:"nowrap"}}>{toast.sub}</div>}
      </div>}

      {/* Bottom Navigation — 4 tabs + center FAB */}
      {!txDetail&&!showAllTx&&<div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,display:"flex",justifyContent:"center"}}>
        <div style={{width:"100%",maxWidth:420,position:"relative"}}>
          {/* FAB Speed Dial */}
          {fabOpen&&<div onClick={()=>setFabOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(4px)",zIndex:1}}/>}
          {fabOpen&&<div style={{position:"absolute",left:"50%",transform:"translateX(-50%)",bottom:80,zIndex:3,display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
            {[{l:t("importWalletBtn"),icon:I.importW,color:C.green,fn:()=>{setFabOpen(false);onImportWallet?.();}},
              {l:t("createNew"),icon:I.walletAdd,color:C.orange,fn:()=>{setFabOpen(false);onAddWallet?.();}},
              {l:t("watchAddress"),icon:I.eye,color:C.blue||"#3B82F6",fn:()=>{setFabOpen(false);setShowWalletPicker(true);setWalletPickerMode("add");setShowWatchInput(true);}}
            ].map((item,idx)=><button key={idx} onClick={item.fn} className="b21p" style={{display:"flex",alignItems:"center",gap:10,padding:"10px 18px",borderRadius:RD.lg,background:C.surface,border:`1px solid ${C.border}`,cursor:"pointer",whiteSpace:"nowrap",boxShadow:C.shadow}}>
              <div style={{width:32,height:32,borderRadius:10,background:item.color+"18",display:"flex",alignItems:"center",justifyContent:"center",color:item.color,flexShrink:0}}>{item.icon}</div>
              <span style={{fontSize:13,fontWeight:700,color:C.white}}>{item.l}</span>
            </button>)}
          </div>}
          {/* FAB button */}
          <button onClick={()=>setFabOpen(!fabOpen)} className="b21p" style={{position:"absolute",left:"50%",transform:`translateX(-50%) rotate(${fabOpen?"45deg":"0deg"})`,top:-20,width:48,height:48,borderRadius:24,border:"none",cursor:"pointer",background:`linear-gradient(135deg,${C.orange},${C.orangeDark})`,display:"flex",alignItems:"center",justifyContent:"center",color:"#FFF",boxShadow:`0 3px 16px ${C.orangeGlow}, 0 0 0 3px ${C.bg}`,zIndex:4,transition:"transform 0.2s ease"}}>{I.plus}</button>
          <div style={{background:C.glassOverlay,backdropFilter:"blur(20px)",borderTop:`1px solid ${C.border}`,display:"flex",padding:"8px 0 10px"}}>
            {tabs.map((tab,i)=>(<React.Fragment key={tab.id}>
              {i===2&&<div style={{flex:1}}/>}
              <button onClick={()=>{setActiveTab(tab.id);setMoreSection(null);setRadarSection(null);setFabOpen(false);}} className="b21p" style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,background:"none",border:"none",cursor:"pointer",padding:"6px 0",color:activeTab===tab.id?C.orange:C.gray,transition:smoothTransition,position:"relative"}}>
                {activeTab===tab.id&&<div style={{position:"absolute",top:0,left:"25%",right:"25%",height:2,borderRadius:1,background:C.orange,animation:"b21cf 0.2s ease"}}/>}
                <span style={{display:"flex",transform:activeTab===tab.id?"translateY(-1px)":"none",transition:springTransition,opacity:activeTab===tab.id?1:0.6}}>{tab.icon}</span>
                <span style={{fontSize:10,fontWeight:activeTab===tab.id?700:500,letterSpacing:"0.03em",transition:"all 0.2s"}}>{tab.label}</span>
              </button>
            </React.Fragment>))}
          </div>
        </div>
      </div>}

      {renderWalletPicker()}
      <ConfirmModal open={!!confirmModal} {...(confirmModal||{})} onCancel={()=>setConfirmModal(null)} C={C} />

      {/* ── Delete Wallet Modal ── */}
      {showDeleteModal&&<div style={{position:"fixed",inset:0,zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={()=>{setShowDeleteModal(null);setDeleteConfirmed(false);}}>
        <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(8px)",animation:"b21fi 0.15s ease-out"}}/>
        <div onClick={e=>e.stopPropagation()} style={{position:"relative",background:C.surface,borderRadius:RD.xl,padding:"28px 24px 20px",width:"100%",maxWidth:360,border:`1px solid ${C.border}`,boxShadow:"0 24px 80px rgba(0,0,0,0.6)",animation:"b21si 0.2s ease-out"}}>
          <div style={{width:48,height:48,borderRadius:24,background:`${C.red}12`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",border:`1px solid ${C.red}30`}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </div>
          <div style={{fontSize:17,fontWeight:700,color:C.white,textAlign:"center",marginBottom:8}}>Delete "{showDeleteModal.name}"?</div>
          <div style={{fontSize:13,color:C.gray,textAlign:"center",lineHeight:1.5,marginBottom:16}}>
            {showDeleteModal.watchOnly
              ? "This watch-only wallet will be removed from this device. You can add it back anytime using the address."
              : "This wallet will be removed from this device. You can only restore it with your recovery phrase."}
          </div>
          {!showDeleteModal.watchOnly&&<label style={{display:"flex",alignItems:"flex-start",gap:10,padding:"12px",borderRadius:RD.md,background:`${C.red}08`,border:`1px solid ${C.red}20`,marginBottom:18,cursor:"pointer"}}>
            <input type="checkbox" checked={deleteConfirmed} onChange={e=>setDeleteConfirmed(e.target.checked)} style={{accentColor:C.red,width:16,height:16,flexShrink:0,marginTop:2}}/>
            <span style={{fontSize:12,color:C.grayLight,lineHeight:1.5}}>I have my recovery phrase backed up and understand this action cannot be undone.</span>
          </label>}
          <div style={{display:"flex",gap:10}}>
            <SBtn C={C} fw onClick={()=>{setShowDeleteModal(null);setDeleteConfirmed(false);}}>Cancel</SBtn>
            <button onClick={()=>{const wid=showDeleteModal.walletId;setShowDeleteModal(null);setDeleteConfirmed(false);closeWalletPicker();onDeleteWallet?.(wid);}} disabled={!showDeleteModal.watchOnly&&!deleteConfirmed} className="b21p" style={{flex:1,padding:"12px 16px",borderRadius:RD.md,border:"none",cursor:(!showDeleteModal.watchOnly&&!deleteConfirmed)?"not-allowed":"pointer",background:(!showDeleteModal.watchOnly&&!deleteConfirmed)?`${C.red}30`:C.red,color:C.white,fontSize:14,fontWeight:700,opacity:(!showDeleteModal.watchOnly&&!deleteConfirmed)?0.5:1,transition:"all 0.15s"}}>Delete</button>
          </div>
        </div>
      </div>}

      {/* ── Rename Wallet Modal ── */}
      {showRenameModal&&<div style={{position:"fixed",inset:0,zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={()=>setShowRenameModal(null)}>
        <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(8px)",animation:"b21fi 0.15s ease-out"}}/>
        <div onClick={e=>e.stopPropagation()} style={{position:"relative",background:C.surface,borderRadius:RD.xl,padding:"28px 24px 20px",width:"100%",maxWidth:340,border:`1px solid ${C.border}`,boxShadow:"0 24px 80px rgba(0,0,0,0.6)",animation:"b21si 0.2s ease-out"}}>
          <div style={{width:48,height:48,borderRadius:24,background:C.orangeGlow||`${C.orange}12`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",border:`1px solid ${C.orange}30`}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </div>
          <div style={{fontSize:17,fontWeight:700,color:C.white,textAlign:"center",marginBottom:16}}>Rename Wallet</div>
          <div style={{position:"relative",marginBottom:6}}>
            <input value={renameInput} onChange={e=>setRenameInput(e.target.value)} maxLength={20} autoFocus placeholder="Wallet name..."
              onKeyDown={e=>{if(e.key==="Enter"&&renameInput.trim()){onRenameWallet?.(showRenameModal.walletId,renameInput.trim());setShowRenameModal(null);setRenameInput("");}}}
              style={{width:"100%",padding:"12px 14px",borderRadius:RD.md,border:`1px solid ${C.border}`,background:C.bg,color:C.white,fontSize:14,fontWeight:600,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
          </div>
          <div style={{fontSize:11,color:C.gray,textAlign:"right",marginBottom:20}}>{renameInput.length}/20</div>
          <div style={{display:"flex",gap:10}}>
            <SBtn C={C} fw onClick={()=>{setShowRenameModal(null);setRenameInput("");}}>Cancel</SBtn>
            <PBtn C={C} fw onClick={()=>{if(renameInput.trim()){onRenameWallet?.(showRenameModal.walletId,renameInput.trim());setShowRenameModal(null);setRenameInput("");}}} disabled={!renameInput.trim()}>Save</PBtn>
          </div>
        </div>
      </div>}

      {/* ── Address Manager Overlay ── */}
      {showAddrManager&&(()=>{
        const typeKey=activeWallet?.addressType||addressTypeIdToKey(getAddressType(address)||"native-segwit");
        const typeCfg=ADDRESS_TYPES[typeKey];
        let typeAddrs=(activeWallet?.addresses||[]).filter(a=>a.type===typeKey).sort((a,b)=>a.index-b.index);
        // Ensure current address is always shown
        if(typeAddrs.length===0&&address){typeAddrs=[{type:typeKey,address,path:"",index:0,isDefault:true}];}
        else if(!typeAddrs.find(a=>a.address===address)){typeAddrs=[{type:typeKey,address,path:"",index:0,isDefault:true},...typeAddrs];}
        const canGenerate=typeAddrs.length<20;
        return(<div style={{position:"fixed",inset:0,zIndex:9998,background:C.bg,overflow:"auto"}}>
          <div style={{padding:"16px 16px 100px",maxWidth:480,margin:"0 auto"}}>
            {/* Header */}
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
              <button onClick={()=>{setShowAddrManager(false);setEditLblAddr(null);setRcGenSuccess(false);}} className="b21p" style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:RD.sm,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.white} strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <div style={{flex:1}}>
                <div style={{fontSize:18,fontWeight:800,color:C.white}}>Your Addresses</div>
                <div style={{fontSize:12,color:C.gray,marginTop:2}}>{typeCfg?.name||"SegWit"} · {typeAddrs.length} address{typeAddrs.length!==1?"es":""}</div>
              </div>
            </div>

            {/* Per-address balance from UTXOs */}
            {(()=>{const addrBals={};(utxos||[]).forEach(u=>{const sa=u.sourceAddress||address;addrBals[sa]=(addrBals[sa]||0)+u.value;});return null;})()}

            {/* Address list — default first */}
            {[...typeAddrs].sort((a,b)=>(a.address===address?-1:b.address===address?1:a.index-b.index)).map((a,i)=>{
              const isDefault=a.address===address;
              const adS=a.address.slice(0,6);const adE=a.address.slice(-6);
              const addrBal=(utxos||[]).filter(u=>(u.sourceAddress||address)===a.address).reduce((s,u)=>s+u.value,0);
              const addrBtc=addrBal/1e8;
              return(<div key={a.address} style={{background:C.surface,borderRadius:RD.lg,border:`1px solid ${isDefault?C.orange+"30":C.border}`,padding:"14px 16px",marginBottom:10,animation:"b21fi 0.3s ease",animationDelay:`${i*0.05}s`,animationFillMode:"both"}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  {/* Index badge */}
                  <div style={{width:40,height:40,borderRadius:RD.md,background:isDefault?`${C.orange}15`:C.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",flexShrink:0}}>
                    <div style={{fontSize:10,fontWeight:800,color:isDefault?C.orange:C.gray,fontFamily:FN.mono}}>#{a.index}</div>
                  </div>
                  {/* Address info */}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                      <span style={{fontSize:13,fontWeight:600,fontFamily:FN.mono,color:C.white,letterSpacing:"0.02em"}}>{adS}···{adE}</span>
                      {isDefault&&<span style={{fontSize:9,fontWeight:700,color:C.orange,background:`${C.orange}15`,padding:"2px 8px",borderRadius:10}}>Default</span>}
                    </div>
                    <div style={{fontSize:11,fontFamily:FN.mono,color:C.white,marginTop:3,fontWeight:600}}>{stealthMode?"••••":`${addrBtc.toFixed(8)} BTC`}</div>
                    <div style={{fontSize:10,fontFamily:FN.mono,color:C.gray,marginTop:1}}>{stealthMode?"••••":fmtFiat(addrBtc*price.fiat)}</div>
                    {a.label&&<div style={{fontSize:11,color:C.grayLight,marginTop:2}}>📎 {a.label}</div>}
                  </div>
                  {/* Actions */}
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>{if(navigator.clipboard?.writeText){navigator.clipboard.writeText(a.address);setToast(null);setTimeout(()=>setToast({msg:"Address copied",_k:Date.now()}),50);}}} className="b21p" style={{width:32,height:32,borderRadius:RD.sm,background:C.bg,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:C.grayLight}}>{I.copy}</button>
                    <button onClick={()=>{setEditLblAddr(editLblAddr===a.address?null:a.address);setEditLblVal(a.label||"");}} className="b21p" style={{width:32,height:32,borderRadius:RD.sm,background:C.bg,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:C.grayLight}}>{I.tag}</button>
                    <button onClick={()=>{if(!isDefault)onSetDefaultAddress?.(activeWalletId,a.address);}} className="b21p" style={{width:32,height:32,borderRadius:RD.sm,background:isDefault?`${C.orange}20`:C.bg,border:`1px solid ${isDefault?C.orange+"40":C.border}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:isDefault?"default":"pointer"}} title={isDefault?"Default address":"Set as default"}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill={isDefault?C.orange:"none"} stroke={isDefault?C.orange:C.grayLight} strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    </button>
                  </div>
                </div>
                {/* Label editor */}
                {editLblAddr===a.address&&<div style={{marginTop:12,display:"flex",gap:8,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
                  <Inp C={C} value={editLblVal} onChange={e=>setEditLblVal(e.target.value)} placeholder="Label this address..." style={{flex:1,fontSize:12,padding:"10px 14px"}}/>
                  <SBtn C={C} color={C.green} fw={false} onClick={()=>{onLabelAddress?.(activeWalletId,a.address,editLblVal);setEditLblAddr(null);}} style={{fontSize:12,padding:"10px 16px"}}>Save</SBtn>
                </div>}
              </div>);
            })}

            {/* Generate button */}
            {canGenerate&&<button onClick={()=>setRcGenSuccess("confirm")} className="b21p" style={{width:"100%",padding:"14px 16px",borderRadius:RD.md,border:`1px dashed ${C.border}`,background:C.surface,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontSize:13,fontWeight:600,color:C.grayLight,marginTop:4,transition:"all 0.2s"}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Generate New Address
            </button>}

            {/* Generate Address Modal — confirm + success */}
            {rcGenSuccess&&<div style={{position:"fixed",inset:0,zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={()=>setRcGenSuccess(false)}>
              <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(8px)",animation:"b21fi 0.15s ease-out"}}/>
              <div onClick={e=>e.stopPropagation()} style={{position:"relative",background:C.surface,borderRadius:RD.xl,padding:"28px 24px 20px",width:"100%",maxWidth:340,border:`1px solid ${C.border}`,boxShadow:"0 24px 80px rgba(0,0,0,0.6)",animation:"b21si 0.2s ease-out"}}>
                {rcGenSuccess==="confirm"?(<>
                  {/* Confirm state */}
                  <div style={{width:48,height:48,borderRadius:24,background:`${C.orange}12`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",border:`1px solid ${C.orange}25`}}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </div>
                  <div style={{fontSize:17,fontWeight:700,color:C.white,textAlign:"center",marginBottom:8}}>Generate New Address?</div>
                  <div style={{fontSize:13,color:C.grayLight,textAlign:"center",lineHeight:1.6,marginBottom:24}}>A new {typeCfg?.name||"Bitcoin"} address will be derived from your recovery phrase. You can switch between addresses anytime.</div>
                  <div style={{display:"flex",gap:10}}>
                    <SBtn C={C} fw onClick={()=>setRcGenSuccess(false)}>Cancel</SBtn>
                    <PBtn C={C} fw onClick={async()=>{
                      const result=await onGenerateAddress?.(activeWalletId);
                      if(result){setRcGenSuccess(result);}else{setRcGenSuccess(false);}
                    }}>Generate</PBtn>
                  </div>
                </>):(<>
                  {/* Success state */}
                  <div style={{width:56,height:56,borderRadius:28,background:`${C.green}15`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",border:`1px solid ${C.green}25`,animation:"b21bi 0.4s ease"}}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div style={{fontSize:17,fontWeight:700,color:C.green,textAlign:"center",marginBottom:6}}>Address Generated!</div>
                  <div style={{fontSize:13,color:C.grayLight,textAlign:"center",lineHeight:1.5,marginBottom:12}}>Your new Bitcoin address is ready to use</div>
                  <div style={{background:C.bg,borderRadius:RD.md,padding:"12px 14px",marginBottom:20,border:`1px solid ${C.border}`}}>
                    <div style={{fontSize:10,color:C.gray,fontWeight:600,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.06em"}}>New Address</div>
                    <div style={{fontSize:12,fontFamily:FN.mono,color:C.white,wordBreak:"break-all",lineHeight:1.6}}>{rcGenSuccess?.address||""}</div>
                    <div style={{fontSize:10,color:C.gray,marginTop:6}}>{typeCfg?.name} · #{rcGenSuccess?.index??""}</div>
                  </div>
                  <PBtn C={C} fw onClick={()=>setRcGenSuccess(false)}>Done</PBtn>
                </>)}
              </div>
            </div>}

            {/* Info */}
            <div style={{marginTop:16,padding:"14px 16px",background:C.surface,borderRadius:RD.md,border:`1px solid ${C.border}`}}>
              <div style={{fontSize:11,fontWeight:600,color:C.grayLight,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.05em"}}>How it works</div>
              {[
                {icon:"★",color:C.orange,text:"Tap the star to set your default receive address"},
                {icon:"🔑",color:C.gray,text:"All addresses derive from the same recovery phrase"},
                {icon:"📊",color:C.gray,text:"Each address shows its own balance. Home screen shows the combined total"},
                {icon:"🔒",color:C.gray,text:"Old addresses always remain valid and can receive Bitcoin"},
                {icon:"📋",color:C.gray,text:"Maximum 20 addresses per address type"},
              ].map((item,i)=><div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:i<4?8:0}}>
                <span style={{fontSize:12,color:item.color,flexShrink:0,width:16,textAlign:"center"}}>{item.icon}</span>
                <span style={{fontSize:11,color:C.gray,lineHeight:1.5}}>{item.text}</span>
              </div>)}
            </div>
          </div>
        </div>);
      })()}
    </div>
  );
}
