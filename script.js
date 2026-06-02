const canvas       = document.getElementById('c');
const ctx          = canvas.getContext('2d');
const wrapper      = document.getElementById('wrapper');
const scoreTopEl   = document.getElementById('score-top');
const scoreBotEl   = document.getElementById('score-bot');
const startOverlay = document.getElementById('start-overlay');
const goalMsgEl    = document.getElementById('goal-msg');
const btnStart     = document.getElementById('btn-start');
const btnRestart   = document.getElementById('btn-restart');
const btnPause     = document.getElementById('btn-pause');
const btnDiff      = document.getElementById('btn-diff');

const W_BASE = 420, H_BASE = 620;
const WIN_SCORE  = 7;
const SUBSTEPS   = 4;
const TRAIL_LEN  = 10;
const GOAL_FRAMES = 90;

let scale = 1, W = 0, H = 0;
const R = v => v * scale;

let diffLevel = 1;
const DIFFS       = ['EASY','MED','HARD'];
const AI_MAX_SPD  = [3.8, 7.5, 13.0];
const AI_AGRESS   = [0.0, 0.12, 0.28];

let gameState = 'idle';
let scoreTop = 0, scoreBot = 0;
let goalTimer = 0;
let winOverlay = null;
let flashAlpha = 0;
let rafId = null;
let frameCount = 0;

let PUCK_R, PAD_R, GOAL_W, GOAL_H, GOAL_L, GOAL_R;

const puck   = {x:0,y:0,vx:0,vy:0};
const padCPU = {x:0,y:0,vx:0,vy:0};
const padYOU = {x:0,y:0,vx:0,vy:0};

let tgtX = 0, tgtY = 0;
const trail = [];

/* ─────────────────────────────────────────────────────────────
   PIXEL HELPERS
───────────────────────────────────────────────────────────── */
// Draw a pixelated circle by snapping to pixel grid
function pixelCircle(cx, cy, r, color, fill=true) {
  const pr = Math.round(r);
  const px = Math.round(cx - r);
  const py = Math.round(cy - r);
  const size = pr * 2;
  ctx.fillStyle = color;
  // Use arc but snap dimensions
  ctx.beginPath();
  ctx.arc(Math.round(cx), Math.round(cy), pr, 0, Math.PI*2);
  if(fill) ctx.fill();
  else ctx.stroke();
}

// Draw a pixelated rect with optional pixel-border
function pixelRect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/* ─────────────────────────────────────────────────────────────
   RESIZE
───────────────────────────────────────────────────────────── */
function resize(){
  const maxW = Math.min(window.innerWidth  * 0.88, 460);
  const maxH = Math.min(window.innerHeight * 0.55, 660);
  scale = Math.min(maxW / W_BASE, maxH / H_BASE, 1.1);
  W = canvas.width  = Math.round(W_BASE * scale);
  H = canvas.height = Math.round(H_BASE * scale);
  calcConsts();
}

function calcConsts(){
  PUCK_R = R(11);
  PAD_R  = R(26);
  GOAL_W = R(94);
  GOAL_H = R(11);
  GOAL_L = (W - GOAL_W) / 2;
  GOAL_R = GOAL_L + GOAL_W;
}

/* ─────────────────────────────────────────────────────────────
   RESET POSITIONS
───────────────────────────────────────────────────────────── */
function resetPositions(){
  calcConsts();
  const cx = W/2, cy = H/2;
  const speed = R(4.8);
  const ang = (0.35 + Math.random()*0.30) * Math.PI;
  const flip = Math.random() < 0.5 ? 1 : -1;
  puck.x  = cx; puck.y  = cy;
  puck.vx = Math.cos(ang) * speed * flip;
  puck.vy = Math.sin(ang) * speed * (Math.random()<0.5?1:-1);
  padCPU.x = cx; padCPU.y = R(90); padCPU.vx=0; padCPU.vy=0;
  padYOU.x = cx; padYOU.y = H - R(90); padYOU.vx=0; padYOU.vy=0;
  tgtX = padYOU.x; tgtY = padYOU.y;
  trail.length = 0;
}

/* ─────────────────────────────────────────────────────────────
   INPUT
───────────────────────────────────────────────────────────── */
function applyInput(cx, cy){
  const minX = PAD_R + 2, maxX = W - PAD_R - 2;
  const minY = H/2 + PAD_R + 2, maxY = H - PAD_R - 2;
  tgtX = Math.max(minX, Math.min(maxX, cx));
  tgtY = Math.max(minY, Math.min(maxY, cy));
}

canvas.addEventListener('mousemove', e=>{
  const r = canvas.getBoundingClientRect();
  applyInput(e.clientX - r.left, e.clientY - r.top);
});
canvas.addEventListener('touchmove', e=>{
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  applyInput(e.touches[0].clientX - r.left, e.touches[0].clientY - r.top);
},{passive:false});

/* ─────────────────────────────────────────────────────────────
   PLAYER PADDLE UPDATE
───────────────────────────────────────────────────────────── */
function updatePlayer(){
  const LERP = 0.30;
  const px = padYOU.x, py = padYOU.y;
  padYOU.x += (tgtX - padYOU.x) * LERP;
  padYOU.y += (tgtY - padYOU.y) * LERP;
  padYOU.vx = padYOU.x - px;
  padYOU.vy = padYOU.y - py;
}

/* ─────────────────────────────────────────────────────────────
   AI
───────────────────────────────────────────────────────────── */
function predictLanding(fromX, fromY, vx, vy, destY){
  let x = fromX, y = fromY;
  const wL = PUCK_R, wR = W - PUCK_R;
  let steps = 0;
  while(steps++ < 800){
    if(Math.abs(vy) < 0.0001) return x;
    const t = (destY - y) / vy;
    if(t > 0){
      x += vx * t;
      while(x < wL || x > wR){
        if(x < wL){ x = 2*wL - x; vx = Math.abs(vx); }
        if(x > wR){ x = 2*wR - x; vx = -Math.abs(vx); }
      }
      return x;
    }
    if(vy < 0){
      const dt2 = (PUCK_R - y) / vy;
      x += vx * dt2; y = PUCK_R; vy = -vy;
    } else {
      const dt2 = (H - PUCK_R - y) / vy;
      x += vx * dt2; y = H - PUCK_R; vy = -vy;
    }
    while(x < wL || x > wR){
      if(x < wL){ x = 2*wL - x; vx = Math.abs(vx); }
      if(x > wR){ x = 2*wR - x; vx = -Math.abs(vx); }
    }
  }
  return x;
}

function updateAI(){
  const maxSpd = R(AI_MAX_SPD[diffLevel]);
  const halfH  = H / 2;
  const minX = PAD_R + 2, maxX = W - PAD_R - 2;
  const minY = PAD_R + 2;
  const maxY = halfH - PAD_R - 2 + halfH * AI_AGRESS[diffLevel];
  const cx = W / 2;
  const homeY  = R(85);

  let tX, tY;
  const puckMovingTowardAI = puck.vy < 0;
  const puckInAIHalf = puck.y < halfH;

  if(puckMovingTowardAI && puckInAIHalf){
    const interceptY = homeY + PAD_R + PUCK_R + R(2);
    const landX = predictLanding(puck.x, puck.y, puck.vx, puck.vy, interceptY);
    tX = Math.max(minX, Math.min(maxX, landX));
    tY = homeY;
  } else if(!puckMovingTowardAI && puckInAIHalf){
    const goalEdgeOffset = R(20) * (diffLevel * 0.6);
    const biasDir = (puck.x > cx) ? -1 : 1;
    tX = Math.max(minX, Math.min(maxX, puck.x + biasDir * goalEdgeOffset));
    tY = Math.min(maxY, puck.y + PAD_R + PUCK_R + R(4));
  } else {
    tX = cx; tY = homeY;
  }

  tX = Math.max(minX, Math.min(maxX, tX));
  tY = Math.max(minY, Math.min(maxY, tY));

  const dx = tX - padCPU.x, dy = tY - padCPU.y;
  const dist = Math.hypot(dx, dy);
  if(dist > 0.5){
    const step = Math.min(dist, maxSpd);
    padCPU.vx = (dx/dist) * step;
    padCPU.vy = (dy/dist) * step;
    padCPU.x += padCPU.vx;
    padCPU.y += padCPU.vy;
  } else {
    padCPU.vx = 0; padCPU.vy = 0;
  }
  padCPU.x = Math.max(minX, Math.min(maxX, padCPU.x));
  padCPU.y = Math.max(minY, Math.min(maxY, padCPU.y));
}

/* ─────────────────────────────────────────────────────────────
   COLLISION
───────────────────────────────────────────────────────────── */
function collidePuckVsPaddle(pad){
  const minDist = PUCK_R + PAD_R;
  let dx = puck.x - pad.x;
  let dy = puck.y - pad.y;
  let dist = Math.hypot(dx, dy);
  if(dist < 0.001){ dx=0; dy=-1; dist=0.001; }
  if(dist >= minDist) return;
  const nx = dx/dist, ny = dy/dist;
  puck.x = pad.x + nx*(minDist + 0.5);
  puck.y = pad.y + ny*(minDist + 0.5);
  const rvx = puck.vx - pad.vx;
  const rvy = puck.vy - pad.vy;
  const vDotN = rvx*nx + rvy*ny;
  if(vDotN >= 0) return;
  const e = 1.08;
  const j = -(1+e) * vDotN;
  puck.vx += j*nx;
  puck.vy += j*ny;
  const spd = Math.hypot(puck.vx, puck.vy);
  const MAX = R(15);
  if(spd > MAX){ puck.vx=puck.vx/spd*MAX; puck.vy=puck.vy/spd*MAX; }
}

/* ─────────────────────────────────────────────────────────────
   PUCK PHYSICS
───────────────────────────────────────────────────────────── */
function stepPuck(){
  const dt = 1/SUBSTEPS;
  for(let s=0; s<SUBSTEPS; s++){
    puck.x += puck.vx * dt;
    puck.y += puck.vy * dt;
    if(puck.x < PUCK_R){ puck.x = PUCK_R; puck.vx = Math.abs(puck.vx)*0.96; }
    if(puck.x > W-PUCK_R){ puck.x = W-PUCK_R; puck.vx = -Math.abs(puck.vx)*0.96; }
    if(puck.y < PUCK_R && (puck.x < GOAL_L || puck.x > GOAL_R)){
      puck.y = PUCK_R; puck.vy = Math.abs(puck.vy)*0.96;
    }
    if(puck.y > H-PUCK_R && (puck.x < GOAL_L || puck.x > GOAL_R)){
      puck.y = H-PUCK_R; puck.vy = -Math.abs(puck.vy)*0.96;
    }
    collidePuckVsPaddle(padCPU);
    collidePuckVsPaddle(padYOU);
  }
  puck.vx *= 0.9992;
  puck.vy *= 0.9992;
  const spd = Math.hypot(puck.vx, puck.vy);
  const MIN = R(1.6);
  if(spd > 0.001 && spd < MIN){ puck.vx=puck.vx/spd*MIN; puck.vy=puck.vy/spd*MIN; }
}

/* ─────────────────────────────────────────────────────────────
   GOAL DETECTION
───────────────────────────────────────────────────────────── */
function checkGoal(){
  if(puck.y < 0 && puck.x > GOAL_L && puck.x < GOAL_R){
    scoreBot++;
    scoreBotEl.textContent = scoreBot;
    scoreBotEl.classList.add('pop');
    setTimeout(()=>scoreBotEl.classList.remove('pop'),180);
    triggerGoal('GOAL!','blue');
    return;
  }
  if(puck.y > H && puck.x > GOAL_L && puck.x < GOAL_R){
    scoreTop++;
    scoreTopEl.textContent = scoreTop;
    scoreTopEl.classList.add('pop');
    setTimeout(()=>scoreTopEl.classList.remove('pop'),180);
    triggerGoal('GOAL!','red');
  }
}

function triggerGoal(msg, color){
  gameState = 'goal';
  goalTimer = GOAL_FRAMES;
  flashAlpha = 0.4;
  goalMsgEl.textContent = msg;
  goalMsgEl.className = '';
  void goalMsgEl.offsetWidth;
  goalMsgEl.className = `show ${color}`;
  if(scoreTop >= WIN_SCORE || scoreBot >= WIN_SCORE){
    gameState = 'gameover';
    setTimeout(showWinOverlay, 700);
  }
}

/* ─────────────────────────────────────────────────────────────
   WIN SCREEN
───────────────────────────────────────────────────────────── */
function showWinOverlay(){
  const youWon = scoreBot >= WIN_SCORE;
  const label  = youWon ? 'YOU WIN!' : 'CPU WINS';
  const cls    = youWon ? 'blue' : 'red';
  const rankMsg = youWon ? '★ NEW HIGH SCORE ★' : '';
  winOverlay = document.createElement('div');
  winOverlay.className = 'overlay';
  winOverlay.innerHTML = `
    <div class="overlay-box">
      <h2 class="${cls}">${label}</h2>
      <div class="final">
        <span class="s1">${scoreTop}</span><span class="s2"> - </span><span class="s3">${scoreBot}</span>
      </div>
      <p>${rankMsg}</p>
      <hr class="pixel-divider" style="width:100%">
      <button id="btn-again">► PLAY AGAIN</button>
    </div>
  `;
  wrapper.appendChild(winOverlay);
  document.getElementById('btn-again').addEventListener('click', fullReset);
}

function fullReset(){
  scoreTop=0; scoreBot=0;
  scoreTopEl.textContent='0'; scoreBotEl.textContent='0';
  goalMsgEl.className='';
  flashAlpha=0;
  if(winOverlay){ winOverlay.remove(); winOverlay=null; }
  gameState='idle';
  resetPositions();
  startOverlay.style.display='flex';
  btnRestart.style.display='none';
  btnPause.style.display='none';
  btnPause.textContent='⏸ PAUSE';
  btnDiff.disabled = false;
}

/* ─────────────────────────────────────────────────────────────
   DRAW — RETRO RINK
───────────────────────────────────────────────────────────── */
function drawRink(){
  const cx = W/2, cy = H/2;

  // Background — deep navy
  ctx.fillStyle = '#08091a';
  ctx.fillRect(0,0,W,H);

  // Subtle pixel grid on the ice
  ctx.strokeStyle = 'rgba(0,255,238,0.03)';
  ctx.lineWidth = 1;
  const gs = Math.round(R(14));
  for(let gx=0; gx<W; gx+=gs) {
    ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,H); ctx.stroke();
  }
  for(let gy=0; gy<H; gy+=gs) {
    ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(W,gy); ctx.stroke();
  }

  // Midline — dashed pixel style
  ctx.strokeStyle = 'rgba(255,224,0,0.25)';
  ctx.lineWidth = Math.max(2, R(2));
  ctx.setLineDash([R(6), R(5)]);
  ctx.beginPath(); ctx.moveTo(R(8), cy); ctx.lineTo(W-R(8), cy); ctx.stroke();
  ctx.setLineDash([]);

  // Center circle — pixelated
  ctx.strokeStyle = 'rgba(255,224,0,0.18)';
  ctx.lineWidth = Math.max(2, R(2));
  ctx.beginPath(); ctx.arc(cx, cy, R(50), 0, Math.PI*2); ctx.stroke();

  // Center dot
  ctx.fillStyle = 'rgba(255,224,0,0.6)';
  ctx.beginPath(); ctx.arc(cx, cy, R(4), 0, Math.PI*2); ctx.fill();

  // Face-off dots
  [[-1,1],[1,1],[-1,-1],[1,-1]].forEach(([sx,sy])=>{
    const fx = cx+sx*R(85), fy = cy+sy*R(112);
    ctx.strokeStyle = 'rgba(255,224,0,0.1)';
    ctx.lineWidth = R(1.5);
    ctx.beginPath(); ctx.arc(fx,fy,R(18),0,Math.PI*2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,224,0,0.35)';
    ctx.beginPath(); ctx.arc(fx,fy,R(3),0,Math.PI*2); ctx.fill();
  });

  // ── CPU GOAL (top) — red pixel goal ──
  const gx = GOAL_L;
  // Goal fill
  pixelRect(gx, 0, GOAL_W, GOAL_H + R(4), 'rgba(255,26,26,0.08)');
  // Goal outline — chunky pixel
  ctx.strokeStyle = '#ff1a1a';
  ctx.lineWidth = Math.max(2, R(2.5));
  ctx.strokeRect(gx+1, 1, GOAL_W-2, GOAL_H);
  // Goal posts as pixel squares
  pixelRect(gx-R(3), 0, R(6), R(8), '#ff4444');
  pixelRect(GOAL_R-R(3), 0, R(6), R(8), '#ff4444');

  // ── PLAYER GOAL (bottom) — cyan pixel goal ──
  pixelRect(gx, H - GOAL_H - R(4), GOAL_W, GOAL_H + R(4), 'rgba(0,255,238,0.08)');
  ctx.strokeStyle = '#00ffee';
  ctx.lineWidth = Math.max(2, R(2.5));
  ctx.strokeRect(gx+1, H-GOAL_H-1, GOAL_W-2, GOAL_H);
  pixelRect(gx-R(3), H-R(8), R(6), R(8), '#00cccc');
  pixelRect(GOAL_R-R(3), H-R(8), R(6), R(8), '#00cccc');

  // Border — thick pixel frame
  ctx.strokeStyle = 'rgba(0,255,238,0.20)';
  ctx.lineWidth = Math.max(3, R(3));
  ctx.strokeRect(2, 2, W-4, H-4);

  // Corner brackets
  const bc = Math.max(2, R(2.5));
  const bl = R(16);
  const corners = [[2,2],[W-2,2],[2,H-2],[W-2,H-2]];
  ctx.strokeStyle = 'rgba(255,224,0,0.35)';
  ctx.lineWidth = bc;
  corners.forEach(([cx2,cy2], i) => {
    const sx = i%2===0?1:-1, sy = i<2?1:-1;
    ctx.beginPath();
    ctx.moveTo(cx2+sx*bl, cy2); ctx.lineTo(cx2, cy2); ctx.lineTo(cx2, cy2+sy*bl);
    ctx.stroke();
  });
}

/* ─────────────────────────────────────────────────────────────
   DRAW — PADDLES (pixel/retro style)
───────────────────────────────────────────────────────────── */
function drawPaddle(pad, mainColor, darkColor, accentColor){
  const {x, y} = pad;
  const r = PAD_R;
  const pr = Math.round(r);
  const px = Math.round(x), py = Math.round(y);

  // Shadow/glow
  ctx.save();
  ctx.shadowColor = mainColor;
  ctx.shadowBlur = R(20);
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, Math.PI*2);
  ctx.fillStyle = darkColor;
  ctx.fill();
  ctx.restore();

  // Body
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, Math.PI*2);
  ctx.fillStyle = mainColor;
  ctx.fill();

  // Pixel ring (stepped)
  const ringR = Math.round(pr * 0.72);
  ctx.beginPath();
  ctx.arc(px, py, ringR, 0, Math.PI*2);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = Math.max(2, R(2));
  ctx.stroke();

  // Inner accent ring
  ctx.beginPath();
  ctx.arc(px, py, ringR, 0, Math.PI*2);
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = Math.max(1, R(1));
  ctx.stroke();

  // Center knob — pixel square style
  const ks = Math.round(R(5));
  pixelRect(px-ks/2, py-ks/2, ks, ks, '#ffffff');

  // Cross mark on knob
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  pixelRect(px-Math.round(R(1)), py-Math.round(R(4)), Math.round(R(2)), Math.round(R(8)), 'rgba(0,0,0,0.4)');
  pixelRect(px-Math.round(R(4)), py-Math.round(R(1)), Math.round(R(8)), Math.round(R(2)), 'rgba(0,0,0,0.4)');

  // Highlight pixel
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(px - pr*0.28, py - pr*0.28, R(3.5), 0, Math.PI*2);
  ctx.fill();
}

/* ─────────────────────────────────────────────────────────────
   DRAW — PUCK (pixel style)
───────────────────────────────────────────────────────────── */
function drawPuck(){
  const pr = Math.round(PUCK_R);
  const px = Math.round(puck.x);
  const py = Math.round(puck.y);

  // Trail — blocky pixels
  for(let i=0; i<trail.length; i++){
    const t = trail[i];
    const a = (i+1)/trail.length * 0.35;
    const tr = Math.round(PUCK_R * (0.3 + 0.5*(i/trail.length)));
    ctx.save();
    ctx.globalAlpha = a;
    // Pixel square trail
    const ts = tr * 2;
    pixelRect(Math.round(t.x)-tr, Math.round(t.y)-tr, ts, ts, '#a0e8ff');
    ctx.restore();
  }

  // Glow
  ctx.save();
  ctx.shadowColor = 'rgba(180,230,255,0.8)';
  ctx.shadowBlur = R(16);
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, Math.PI*2);
  ctx.fillStyle = '#ddf4ff';
  ctx.fill();
  ctx.restore();

  // Body
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, Math.PI*2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Inner circle
  ctx.beginPath();
  ctx.arc(px, py, Math.round(pr*0.6), 0, Math.PI*2);
  ctx.fillStyle = '#88ccdd';
  ctx.fill();

  // Center dot
  ctx.beginPath();
  ctx.arc(px, py, Math.round(pr*0.22), 0, Math.PI*2);
  ctx.fillStyle = '#224455';
  ctx.fill();

  // Pixel shine
  pixelRect(px-Math.round(R(3)), py-Math.round(R(4)), Math.round(R(3)), Math.round(R(3)), 'rgba(255,255,255,0.7)');
}

function drawFlash(){
  if(flashAlpha<=0) return;
  ctx.save();
  ctx.globalAlpha = flashAlpha;
  ctx.fillStyle = '#ffe000';
  ctx.fillRect(0,0,W,H);
  ctx.restore();
  flashAlpha = Math.max(0, flashAlpha - 0.045);
}

/* ─────────────────────────────────────────────────────────────
   MAIN LOOP
───────────────────────────────────────────────────────────── */
function loop(){
  rafId = requestAnimationFrame(loop);
  frameCount++;
  ctx.clearRect(0,0,W,H);
  drawRink();

  if(gameState === 'goal'){
    goalTimer--;
    drawFlash();
    drawPaddle(padCPU, '#cc1122', '#5a0008', 'rgba(255,100,100,0.5)');
    drawPaddle(padYOU, '#009988', '#003833', 'rgba(0,255,238,0.5)');
    drawPuck();
    if(goalTimer <= 0 && gameState !== 'gameover'){
      goalMsgEl.className='';
      gameState='playing';
      resetPositions();
    }
    return;
  }

  if(gameState === 'gameover' || gameState === 'idle' || gameState === 'paused'){
    drawPaddle(padCPU, '#cc1122', '#5a0008', 'rgba(255,100,100,0.5)');
    drawPaddle(padYOU, '#009988', '#003833', 'rgba(0,255,238,0.5)');
    drawPuck();
    if(gameState === 'paused'){
      // Dim overlay
      ctx.fillStyle = 'rgba(8,8,16,0.55)';
      ctx.fillRect(0,0,W,H);
      // PAUSED text
      ctx.save();
      ctx.font = `bold ${Math.round(R(13))}px 'Press Start 2P', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#39ff14';
      ctx.shadowColor = '#39ff14';
      ctx.shadowBlur = R(14);
      ctx.fillText('PAUSED', W/2, H/2);
      ctx.restore();
    }
    return;
  }

  trail.push({x:puck.x, y:puck.y});
  if(trail.length > TRAIL_LEN) trail.shift();

  updatePlayer();
  updateAI();
  stepPuck();
  checkGoal();

  drawFlash();
  drawPaddle(padCPU, '#cc1122', '#5a0008', 'rgba(255,100,100,0.5)');
  drawPaddle(padYOU, '#009988', '#003833', 'rgba(0,255,238,0.5)');
  drawPuck();
}

/* ─────────────────────────────────────────────────────────────
   BUTTONS
───────────────────────────────────────────────────────────── */
btnDiff.addEventListener('click', ()=>{
  diffLevel = (diffLevel+1) % 3;
  btnDiff.textContent = 'LVL: ' + DIFFS[diffLevel];
});

btnStart.addEventListener('click', ()=>{
  startOverlay.style.display='none';
  btnRestart.style.display='inline-block';
  btnPause.style.display='inline-block';
  btnDiff.disabled = true;
  gameState='playing';
  resetPositions();
});

btnRestart.addEventListener('click', ()=>{
  goalMsgEl.className='';
  if(winOverlay){ winOverlay.remove(); winOverlay=null; }
  btnPause.style.display='none';
  btnPause.textContent='⏸ PAUSE';
  btnDiff.disabled = false;
  fullReset();
});

btnPause.addEventListener('click', togglePause);

document.addEventListener('keydown', e => {
  if(e.key === 'p' || e.key === 'P' || e.key === 'Escape'){
    if(gameState === 'playing' || gameState === 'paused') togglePause();
  }
});

function togglePause(){
  if(gameState === 'playing'){
    gameState = 'paused';
    btnPause.textContent = '▶ RESUME';
  } else if(gameState === 'paused'){
    gameState = 'playing';
    btnPause.textContent = '⏸ PAUSE';
  }
}

/* ─────────────────────────────────────────────────────────────
   BOOT
───────────────────────────────────────────────────────────── */
resize();
resetPositions();
window.addEventListener('resize', ()=>{ resize(); resetPositions(); });
loop();
