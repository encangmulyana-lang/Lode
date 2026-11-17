/* LODE — shared JS (wallet, buy-fix, i18n, chrome).
   Deployed 2026-11-17 ~21:00 WIB on BSC (owner baw).
   NFT 0xc442e8ba26B9E5088d1D70Dc8EDFCdE4d2E911B0 (deploy block 134131633)
   $MINE 0x160f4c5D0E573A39c640BB0090d891Fc4D8DcDF7
   Mining 0xe45D7334006124a2280D46c3e47bcF77d3f798a6
   Market 0xFaC03822abedC8147e7532CA9CFb1cd7285f19A1
   Ethers 6.x UMD is loaded by each page before this file. */

/* ---- contract addresses (deployed) ---- */
const CONTRACT = "0xc442e8ba26B9E5088d1D70Dc8EDFCdE4d2E911B0"; // Lode NFT
const MINING   = "0xe45D7334006124a2280D46c3e47bcF77d3f798a6"; // LodeMining
const TOKEN    = "0x160f4c5D0E573A39c640BB0090d891Fc4D8DcDF7"; // MineToken $MINE
const MARKET   = "0xFaC03822abedC8147e7532CA9CFb1cd7285f19A1"; // LodeMarket
const DEPLOY_BLOCK = 134131633; // Lode NFT deploy block (claim/mine scan start)
const ZERO = "0x0000000000000000000000000000000000000000";
const IS_PLACEHOLDER = CONTRACT === ZERO; // true until Lode is deployed
const MAX_SUPPLY = 5555;
const PRICE_WEI = 600000000000000n; // 0.0006 BNB per paid mint
const CLAIM_FEE_WEI = 400000000000000n; // 0.0004 BNB per claim tx (any number of rocks)

const RPCS = ["https://bsc-dataseed.bnbchain.org","https://bsc-dataseed1.binance.org","https://rpc-bsc.48.club"];
/* selectors computed from the compiled ABIs (see README.md) */
const SEL_TOTALMINTED = "0xa2309ff8", SEL_MINTPAUSED = "0x7e4831d3";
const SEL_PRICEFOR = "0xd527979a", SEL_PRICEAT = "0x9ede1e5d", SEL_CURRENTPRICE = "0x9d1b464a";
const SEL_HASAGENTID = "0x4eab3ef2", SEL_FREECLAIMED = "0x61c0b6a0";
const SEL_MINT = "0xa0712d68", SEL_FORGE = "0x1019bdb6";
const SEL_TIEROF = "0x53f96df2", SEL_TIERPOWER = "0x3bba4627", SEL_FORGECOUNT = "0xa40283d5";
const SEL_FORGEFEE = "0x1c1c0bda", SEL_MINTEDBY = "0x0d758111";
const SEL_BALANCEOF = "0x70a08231", SEL_OWNEROF = "0x6352211e", SEL_TOKENURI = "0xc87b56dd";
const SEL_TOTALSUPPLY = "0x18160ddd";
const SEL_ACCRUED = "0xf52981f4", SEL_ACCRUEDBATCH = "0x9211fc08", SEL_CLAIM = "0x6ba4c138";
const SEL_FEEPERCLAIM = "0x4f227fd9", SEL_LASTCLAIM = "0x3d3728b5";
const SEL_LISTEDIDS = "0x05337198", SEL_GETLISTING = "0x107a274a";
const SEL_LIST = "0x50fd7367", SEL_BUY = "0xd96a094a", SEL_CANCEL = "0x40e58ee5";
const SEL_UPDATEPRICE = "0x82367b2d", SEL_FEEBPS = "0x24a9d853";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

let provider = null, signer = null, userAddr = null;
let LANG = "en";
const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function hexPad32(n){ return "0x" + BigInt(n).toString(16).padStart(64, "0"); }
function addrPad(a){ return "0x000000000000000000000000" + a.slice(2).toLowerCase(); }

async function rpcCall(to, data){
  if(!to || to.toLowerCase() === ZERO) return null;
  for(const url of RPCS){
    try{
      const ctl = new AbortController();
      const t = setTimeout(()=>ctl.abort(), 8000);
      const r = await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},signal:ctl.signal,
        body:JSON.stringify({jsonrpc:"2.0",id:1,method:"eth_call",params:[{to,data},"latest"]})});
      clearTimeout(t);
      const j = await r.json(); if(j.result) return j.result;
    }catch(e){}
  }
  return null;
}
async function rpcGasPrice(){
  for(const url of RPCS){
    try{
      const ctl = new AbortController();
      const t = setTimeout(()=>ctl.abort(), 8000);
      const r = await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},signal:ctl.signal,
        body:JSON.stringify({jsonrpc:"2.0",id:1,method:"eth_gasPrice",params:[]})});
      clearTimeout(t);
      const j = await r.json(); if(j.result) return BigInt(j.result);
    }catch(e){}
  }
  return 1000000000n;
}
/* buy-fix: explicit gasPrice from the site's own RPCs + explicit gas limit.
   Never let the buyer wallet's provider return null fee data. */
async function sendTx(tx, gasLimit){
  const gp = await rpcGasPrice();
  return signer.sendTransaction({...tx, gasPrice: gp, gasLimit: BigInt(gasLimit)});
}
function txErrMsg(e){
  const m = (e && e.message) || String(e || "");
  if(m.indexOf("invalid BigNumberish") >= 0 || m.indexOf("value=null") >= 0) return STR[LANG].txWalletFee;
  return (e && e.reason) || m;
}
function shortAddr(a){ return a.slice(0,6) + "…" + a.slice(-4); }
function fmtBnb(wei){ return (Number(wei) / 1e18).toFixed(4).replace(/0+$/,"").replace(/\.$/,".0"); }
function fmtMine(wei){ return (Number(wei) / 1e18).toLocaleString("en-US", {maximumFractionDigits: 2}); }

/* ---- i18n: dynamic strings (static copy uses data-en/ja/zh/ko attrs) ---- */
const STR = {
en:{loading:"Loading live count…",noCount:"Could not load live count — check your connection and refresh.",
  comingSoon:"Contracts deploying — mint opens soon.",
  minted:(n,p)=>n+" of 5,555 mined ("+p+"%)",
  total:(q,t,f)=>"Total for "+q+": "+t+" BNB"+(f?" — FREE":""),
  agentPrompt:(q,a)=>"Mint "+q+" Lode to "+a,
  txWalletFee:"Your wallet could not prepare this transaction (empty answer from the browser). Open this site inside your wallet app browser (MetaMask / Trust Wallet / Binance Wallet) and try again.",
  noWallet:"No browser wallet detected. Open this site inside your wallet app browser (MetaMask / Trust Wallet / Binance Wallet).",
  connected:"Connected.",
  connectFailed:"Connect failed: ",
  badAddr:"That does not look like a wallet address (0x + 40 hex characters).",
  copied:"Agent prompt copied — paste it to the Lode agent.",
  claimTotal:(n,a)=>"Claim "+a+" $MINE from "+n+" rock(s)? Fee: 0.0004 BNB."},
ja:{loading:"ライブカウントを読み込み中…",noCount:"ライブカウントを読み込めませんでした — 接続を確認して更新してください。",
  comingSoon:"コントラクトをデプロイ中 — ミントは近日開始。",
  minted:(n,p)=>"5,555個中"+n+"個採掘済み（"+p+"%）",
  total:(q,t,f)=>"合計（"+q+"個）: "+t+" BNB"+(f?" — 無料":""),
  agentPrompt:(q,a)=>"Mint "+q+" Lode to "+a,
  txWalletFee:"ウォレットがこの取引を準備できませんでした（ブラウザからの応答が空でした）。MetaMask / Trust Wallet / Binance Wallet のアプリ内ブラウザでこのサイトを開いて、もう一度お試しください。",
  noWallet:"ブラウザウォレットが見つかりません。MetaMask / Trust Wallet / Binance Wallet のアプリ内ブラウザでこのサイトを開いてください。",
  connected:"接続しました。",
  connectFailed:"接続に失敗しました: ",
  badAddr:"ウォレットアドレスの形式が正しくありません（0x + 40文字の16進数）。",
  copied:"エージェント用プロンプトをコピーしました — Lodeエージェントに貼り付けてください。",
  claimTotal:(n,a)=>n+"個の岩から "+a+" $MINE を請求しますか？手数料: 0.0004 BNB。"},
zh:{loading:"正在加载实时数量…",noCount:"无法加载实时数量——请检查网络并刷新。",
  comingSoon:"合约部署中——铸造即将开始。",
  minted:(n,p)=>"已开采 "+n+" / 5,555（"+p+"%）",
  total:(q,t,f)=>"总价（"+q+"个）: "+t+" BNB"+(f?"——免费":""),
  agentPrompt:(q,a)=>"Mint "+q+" Lode to "+a,
  txWalletFee:"您的钱包无法准备这笔交易（浏览器返回为空）。请在钱包应用内浏览器（MetaMask / Trust Wallet / Binance Wallet）中打开本网站，然后重试。",
  noWallet:"未检测到浏览器钱包。请在钱包应用内浏览器（MetaMask / Trust Wallet / Binance Wallet）中打开本网站。",
  connected:"已连接。",
  connectFailed:"连接失败：",
  badAddr:"这不是有效的钱包地址（0x + 40 位十六进制字符）。",
  copied:"已复制代理提示——粘贴给 Lode 代理即可。",
  claimTotal:(n,a)=>"从 "+n+" 块岩石领取 "+a+" $MINE？手续费：0.0004 BNB。"},
ko:{loading:"실시간 수량 불러오는 중…",noCount:"실시간 수량을 불러올 수 없습니다 — 연결을 확인하고 새로고침하세요。",
  comingSoon:"컨트랙트 배포 중 — 민팅 곧 시작.",
  minted:(n,p)=>"5,555개 중 "+n+"개 채굴됨 ("+p+"%)",
  total:(q,t,f)=>"총액（"+q+"개）: "+t+" BNB"+(f?" — 무료":""),
  agentPrompt:(q,a)=>"Mint "+q+" Lode to "+a,
  txWalletFee:"지갑이 이 거래를 준비하지 못했습니다(브라우저의 응답이 비어 있습니다). MetaMask / Trust Wallet / Binance Wallet 앱 내 브라우저에서 이 사이트를 열고 다시 시도해 주세요。",
  noWallet:"브라우저 지갑이 없습니다. MetaMask / Trust Wallet / Binance Wallet 앱 내 브라우저에서 이 사이트를 여세요.",
  connected:"연결됨.",
  connectFailed:"연결 실패: ",
  badAddr:"지갑 주소 형식이 올바르지 않습니다(0x + 40자 16진수).",
  copied:"에이전트 프롬프트를 복사했습니다 — Lode 에이전트에 붙여넣으세요.",
  claimTotal:(n,a)=>n+"개 바위에서 "+a+" $MINE을 청구하시겠습니까? 수수료: 0.0004 BNB."}
};

function setLang(l){
  LANG = l;
  try{ localStorage.setItem("lode-lang", l); }catch(e){}
  document.documentElement.lang = l === "zh" ? "zh-CN" : l;
  document.querySelectorAll("[data-lang]").forEach(b=>{
    b.classList.toggle("on", b.dataset.lang === l);
  });
  document.querySelectorAll("[data-en]").forEach(el=>{
    if(el.id === "connectBtn" && userAddr) return;
    const v = el.dataset[l]; if(v !== undefined) el.textContent = v;
  });
  document.querySelectorAll("[data-en-html]").forEach(el=>{
    const v = el.dataset[l+"Html"]; if(v !== undefined) el.innerHTML = v;
  });
  if(typeof refresh === "function") refresh();
}
function initLang(){
  const saved = (function(){ try{ return localStorage.getItem("lode-lang") || ""; }catch(e){ return ""; } })();
  const nav = (navigator.language || "en").slice(0,2);
  setLang(saved || (nav === "ja" ? "ja" : nav === "zh" ? "zh" : nav === "ko" ? "ko" : "en"));
}

/* ---- wallet ---- */
async function connectWallet(){
  const msgEl = document.getElementById("mintMsg") || document.getElementById("pageMsg");
  if(!window.ethereum){
    if(msgEl){ msgEl.className = "warn"; msgEl.textContent = STR[LANG].noWallet; }
    return false;
  }
  try{
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const net = await provider.getNetwork();
    if(net.chainId !== 56n){ await window.ethereum.request({method:"wallet_switchEthereumChain", params:[{chainId:"0x38"}]}); }
    signer = await provider.getSigner(); userAddr = await signer.getAddress();
    const btn = document.getElementById("connectBtn");
    if(btn) btn.textContent = "CONNECTED: " + userAddr.slice(0,6) + "…" + userAddr.slice(-4);
    if(msgEl){ msgEl.className = ""; msgEl.textContent = STR[LANG].connected; }
    if(typeof updateCost === "function") updateCost();
    if(typeof onConnect === "function") onConnect();
    return true;
  }catch(e){
    if(msgEl) msgEl.textContent = STR[LANG].connectFailed + (e.message || e);
    return false;
  }
}

/* ---- live count ---- */
async function readTotalMinted(){
  if(IS_PLACEHOLDER) return null;
  const r = await rpcCall(CONTRACT, SEL_TOTALMINTED);
  return r ? Number(BigInt(r)) : null;
}
async function refreshCount(){
  const el = document.getElementById("mintCount"), hero = document.getElementById("heroCount");
  const cta = document.getElementById("ctaCount");
  if(IS_PLACEHOLDER){
    const t = STR[LANG].comingSoon;
    if(el) el.textContent = t;
    if(hero) hero.textContent = "— / 5,555";
    if(cta) cta.textContent = t;
    return;
  }
  const n = await readTotalMinted();
  if(n === null){
    if(el) el.textContent = STR[LANG].noCount;
    // A failed read used to leave the hero stuck on "—" forever. Retry a few
    // times, then say so in the hero instead of a silent dash.
    if(countRetries < 3){ countRetries++; setTimeout(refreshCount, 5000); }
    else if(hero){ hero.textContent = STR[LANG].noCount; }
    return;
  }
  countRetries = 0;
  const p = Math.round(n / MAX_SUPPLY * 100);
  if(el) el.textContent = STR[LANG].minted(n, p);
  if(hero){ countUp(document.getElementById("heroNum"), n); }
  if(cta) cta.textContent = STR[LANG].minted(n, p);
}
var lastCount = null;
var countRetries = 0;
function countUp(el, to){
  if(!el) return;
  if(REDUCED_MOTION){ el.textContent = to; lastCount = to; return; }
  if(lastCount === null){ el.textContent = to; lastCount = to; return; }
  const from = lastCount; lastCount = to;
  if(from === to){ el.textContent = to; return; }
  const t0 = performance.now();
  function step(ts){
    const k = Math.min(1, (ts - t0) / 700);
    el.textContent = Math.round(from + (to - from) * k);
    if(k < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ---- misc chrome: reveals, sticky CTA, burger menu ---- */
function initChrome(){
  if(IS_PLACEHOLDER) document.body.classList.add("deploying");
  // power bars: start at 0, animate to their target width when revealed
  if(!REDUCED_MOTION && "IntersectionObserver" in window){
    document.querySelectorAll(".tier .bar i").forEach(i=>{
      i.dataset.w = i.style.width; i.style.width = "0%";
    });
  }
  initHeroFx(); initTiers();
  const reveals = document.querySelectorAll(".reveal");
  if(REDUCED_MOTION || !("IntersectionObserver" in window)){
    reveals.forEach(el=>el.classList.add("on"));
  } else {
    const io = new IntersectionObserver((es,o)=>{ es.forEach(e=>{ if(e.isIntersecting){
      e.target.classList.add("on");
      if(e.target.classList.contains("tier")){
        const bar = e.target.querySelector(".bar i");
        if(bar && bar.dataset.w) bar.style.width = bar.dataset.w;
      }
      o.unobserve(e.target); } }); },
      {threshold:0.15, rootMargin:"0px 0px -6% 0px"});
    reveals.forEach(el=>io.observe(el));
  }
  const top = document.getElementById("toTop");
  window.addEventListener("scroll", ()=>{
    if(top) top.classList.toggle("show", window.scrollY > 700);
    const cta = document.getElementById("mobileCta");
    if(cta) cta.classList.toggle("show", window.scrollY > 560);
  }, {passive:true});
  if(top) top.addEventListener("click", ()=>window.scrollTo({top:0, behavior: REDUCED_MOTION ? "auto" : "smooth"}));
  const mm = document.getElementById("mobileMenu");
  if(mm){
    mm.querySelectorAll("a").forEach(a=>a.addEventListener("click", ()=>mm.classList.remove("open")));
    document.addEventListener("keydown", e=>{ if(e.key === "Escape") mm.classList.remove("open"); });
  }
}
function toggleMenu(){
  const m = document.getElementById("mobileMenu"); if(m) m.classList.toggle("open");
}

/* ---- interactive tier cards: tap to expand (accordion) ---- */
function initTiers(){
  const tiers = document.querySelectorAll(".tier");
  if(!tiers.length) return;
  tiers.forEach(t=>{
    t.setAttribute("role","button");
    t.setAttribute("tabindex","0");
    t.setAttribute("aria-expanded","false");
    const toggle = ()=>{
      const wasOpen = t.classList.contains("open");
      tiers.forEach(o=>{ o.classList.remove("open"); o.setAttribute("aria-expanded","false"); });
      if(!wasOpen){ t.classList.add("open"); t.setAttribute("aria-expanded","true"); }
    };
    t.addEventListener("click", toggle);
    t.addEventListener("keydown", e=>{ if(e.key === "Enter" || e.key === " "){ e.preventDefault(); toggle(); } });
  });
}

/* ---- hero fx: floating shard particles + scroll parallax (index only) ---- */
function initHeroFx(){
  const hero = document.querySelector(".hero");
  if(!hero) return;
  const img = hero.querySelector(".heroimg");
  if(img && !REDUCED_MOTION){
    let ticking = false;
    window.addEventListener("scroll", ()=>{
      if(ticking) return; ticking = true;
      requestAnimationFrame(()=>{
        ticking = false;
        const y = window.scrollY;
        if(y < 700) img.style.transform = "scale(1.12) translateY(" + Math.min(y * 0.12, 24).toFixed(1) + "px)";
      });
    }, {passive:true});
  }
  const cv = document.getElementById("shards");
  if(!cv || REDUCED_MOTION){ window.__lodeFx = {particles:0, reduced:REDUCED_MOTION}; return; }
  const ctx = cv.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  function sizeCanvas(){
    const w = hero.clientWidth, h = Math.min(Math.round(w * 0.62), 460);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.height = h + "px";
  }
  sizeCanvas();
  const COLORS = ["#f5b942","#e8862e","#d97b4f","#bfe6ff","#f2ead9"];
  const n = hero.clientWidth < 500 ? 10 : 26;
  const parts = [];
  for(let i = 0; i < n; i++){
    parts.push({
      x: Math.random(), y: Math.random(),
      s: 2 + Math.random() * 4.5,
      vy: 0.00006 + Math.random() * 0.00022, // fraction of height per ms (slow rise)
      sway: 0.006 + Math.random() * 0.02, ph: Math.random() * Math.PI * 2,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.0009,
      c: COLORS[i % COLORS.length], a: 0.25 + Math.random() * 0.55
    });
  }
  window.__lodeFx = {particles: parts.length, reduced:false};
  let running = false, visible = false, raf = 0, last = 0, lastDraw = 0;
  // On phones the canvas runs at ~30fps: positions still update every frame,
  // only the paint is thinned — same motion, half the GPU work.
  const slowPaint = hero.clientWidth < 500;
  function draw(now){
    if(!running) return;
    const dt = Math.min(now - last, 50); last = now;
    for(const p of parts){
      p.y -= p.vy * dt; p.rot += p.vr * dt;
      if(p.y < -0.05){ p.y = 1.05; p.x = Math.random(); }
    }
    if(!slowPaint || now - lastDraw >= 33){
      lastDraw = now;
      const W = cv.width, H = cv.height;
      ctx.clearRect(0, 0, W, H);
      for(const p of parts){
        const x = (p.x + Math.sin(now * 0.0004 + p.ph) * p.sway) * W;
        const y = p.y * H;
        ctx.save();
        ctx.translate(x, y); ctx.rotate(p.rot);
        ctx.globalAlpha = p.a;
        ctx.fillStyle = p.c;
        const s = p.s * dpr;
        ctx.fillRect(-s / 2, -s / 2, s, s * 0.7); // small shard
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    raf = requestAnimationFrame(draw);
  }
  function start(){ if(!running){ running = true; last = performance.now(); raf = requestAnimationFrame(draw); } }
  function stop(){ running = false; cancelAnimationFrame(raf); }
  const io = new IntersectionObserver(es=>{ es.forEach(e=>{ visible = e.isIntersecting; e.isIntersecting ? start() : stop(); }); }, {threshold:0});
  io.observe(hero);
  document.addEventListener("visibilitychange", ()=>{ document.hidden ? stop() : (visible && start()); });
  let rT; window.addEventListener("resize", ()=>{ clearTimeout(rT); rT = setTimeout(sizeCanvas, 200); });
}
