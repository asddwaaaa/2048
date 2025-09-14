/* 2048 — working version
   Smooth tile sliding, chaos mode, swipe & mouse drag, background fishes+bubbles,
   modals (results, shop), persistence
*/

(function(){
  // ---- config
  const SIZE = 4;
  const STORAGE_KEY = 'milk2048_v2_state';
  const HISTORY_KEY = 'milk2048_v2_history';

  // helpers to read CSS variables
  function cssVarNumber(name, fallback=80){
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v ? parseFloat(v) : fallback;
  }
  const CELL = () => cssVarNumber('--cell-size', 80);
  const GAP  = () => cssVarNumber('--gap', 12);

  // DOM
  const boardEl = document.getElementById('game-board');
  const scoreEl = document.getElementById('score');
  const bestEl  = document.getElementById('best-score');
  const movesEl = document.getElementById('moves');
  const timeEl  = document.getElementById('time');

  const btnClassic = document.getElementById('mode-classic');
  const btnChaos   = document.getElementById('mode-chaos');
  const btnNew     = document.getElementById('new-game-btn');
  const btnOpenRes = document.getElementById('open-results');
  const resultsPanel = document.getElementById('results-panel');
  const resultsList = document.getElementById('results-list');
  const btnCloseRes = document.getElementById('close-results-btn');

  const openShopBtn = document.getElementById('open-shop');
  const shopPanel = document.getElementById('shop-panel');
  const closeShopBtn = document.getElementById('close-shop-btn');

  const modalGameOver = document.getElementById('modal-gameover');
  const modalWin = document.getElementById('modal-win');

  const restartBtn = document.getElementById('restart-btn');
  const continueBtn = document.getElementById('continue-btn');
  const newWinBtn = document.getElementById('new-win-btn');

  // state
  let gridTiles = []; // SIZE x SIZE -> tile object or null
  let tilesById = new Map(); // id -> tile object
  let nextId = 1;
  let score = 0;
  let best = parseInt(localStorage.getItem('milk2048_best')||'0',10) || 0;
  let moves = 0;
  let seconds = 0;
  let timer = null;
  let mode = 'classic'; // 'chaos'
  let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') || [];

  // board DOM helpers: create background grid + overlay container
  let gridBg; // element with background cells
  function buildBoardBackground(){
    boardEl.innerHTML = '';
    boardEl.style.width = (CELL()*SIZE + GAP()*(SIZE-1)) + 'px';
    boardEl.style.height = (CELL()*SIZE + GAP()*(SIZE-1)) + 'px';

    gridBg = document.createElement('div');
    gridBg.className = 'grid';
    // create 16 cells
    for(let i=0;i<SIZE*SIZE;i++){
      const c = document.createElement('div');
      c.className = 'cell';
      gridBg.appendChild(c);
    }
    boardEl.appendChild(gridBg);
  }

  // compute translate positions for row,col
  function posFor(rc){
    const [r,c] = rc;
    const x = c*(CELL() + GAP());
    const y = r*(CELL() + GAP());
    return {x,y};
  }

  // create tile DOM
  function createTileDOM(tile){
    const el = document.createElement('div');
    el.className = 'tile new ' + valueClass(tile.value);
    el.textContent = tile.value;
    el.style.width = CELL() + 'px';
    el.style.height = CELL() + 'px';
    el.style.transform = `translate(${posFor([tile.r,tile.c]).x}px, ${posFor([tile.r,tile.c]).y}px)`;
    boardEl.appendChild(el);
    // remove 'new' class after animation ends (so it only animates once)
    setTimeout(()=> el.classList.remove('new'), 350);
    tile.dom = el;
  }
  function valueClass(v){
    return 'v' + v;
  }

  // update DOM position for tile (animates via CSS)
  function moveTileDOM(tile, toR, toC, merged=false){
    if (!tile.dom) createTileDOM(tile);
    const {x,y} = posFor([toR,toC]);
    tile.dom.style.transform = `translate(${x}px, ${y}px)`;
    if (merged){
      tile.dom.classList.add('merged');
      setTimeout(()=> tile.dom && tile.dom.classList.remove('merged'), 420);
    }
    // update text/color if value changed
    tile.dom.textContent = tile.value;
    // update CSS class
    tile.dom.className = 'tile ' + valueClass(tile.value);
  }

  // remove DOM for tile (fade out)
  function removeTileDOM(tile){
    if (!tile.dom) return;
    tile.dom.style.transition = 'transform 220ms ease, opacity 300ms ease';
    tile.dom.style.opacity = '0';
    setTimeout(()=> {
      if (tile.dom && tile.dom.parentNode) tile.dom.parentNode.removeChild(tile.dom);
      tile.dom = null;
    }, 320);
  }

  // ---- core grid/tile logic (objects)
  function emptyGridTiles(){
    const g = [];
    for(let r=0;r<SIZE;r++){
      g[r] = [];
      for(let c=0;c<SIZE;c++) g[r][c] = null;
    }
    return g;
  }

  function newTile(value, r, c){
    const t = { id: nextId++, value: value, r:r, c:c, dom: null };
    tilesById.set(t.id, t);
    gridTiles[r][c] = t;
    createTileDOM(t);
    return t;
  }

  function addRandomTile(){ // place 2 or 4
    const empties = [];
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if (!gridTiles[r][c]) empties.push([r,c]);
    if (!empties.length) return null;
    const pos = empties[Math.floor(Math.random()*empties.length)];
    const val = Math.random() < 0.9 ? 2 : 4;
    return newTile(val, pos[0], pos[1]);
  }

  // slide algorithm producing moves (with merges)
  // returns whether any tile moved/merged
  function performMove(dir){
    // dir: 'left','right','up','down'
    let moved=false;
    const ops = []; // operations to animate: {tile, from:{r,c}, to:{r,c}, merged:boolean, removedTile}
    // helper to process a single line (array of tiles or nulls)
    function processLine(lineTiles){
      // lineTiles: array of tile objects (ordered according to movement direction)
      const result = [];
      let i=0;
      while(i<lineTiles.length){
        const cur = lineTiles[i];
        if (!cur){ i++; continue; }
        // find next non-null
        let j=i+1;
        while(j<lineTiles.length && !lineTiles[j]) j++;
        if (j<lineTiles.length && lineTiles[j] && lineTiles[j].value === cur.value){
          // merge: cur absorbs j
          cur.value = cur.value*2;
          score += cur.value;
          // mark j to be removed
          result.push({tile:cur, merged:true, removed:lineTiles[j]});
          // skip j
          i = j+1;
        } else {
          result.push({tile:cur, merged:false});
          i++;
        }
      }
      return result;
    }

    // for each direction produce target pos and ops
    if (dir === 'left' || dir === 'right'){
      for(let r=0;r<SIZE;r++){
        // build the line
        const line = [];
        for(let c=0;c<SIZE;c++) line.push(gridTiles[r][c] || null);
        const read = (dir==='left') ? line : line.slice().reverse();
        // filter to list and keep null placeholders
        const compact = read.filter(x=>x);
        // process merges
        const processed = [];
        for(let i=0;i<compact.length;i++){
          if (i+1<compact.length && compact[i].value === compact[i+1].value){
            // merge compact[i] and compact[i+1]
            compact[i].value *= 2;
            score += compact[i].value;
            processed.push({tile:compact[i], merged:true, removed:compact[i+1]});
            i++; // skip next
          } else {
            processed.push({tile:compact[i], merged:false});
          }
        }
        // fill with empty to size
        const newLine = [];
        for(let k=0;k<processed.length;k++) newLine.push(processed[k]);
        while(newLine.length < SIZE) newLine.push(null);

        // map back positions
        for(let idx=0; idx<SIZE; idx++){
          const targetIndex = (dir==='left') ? idx : (SIZE-1-idx);
          const item = newLine[idx];
          if (item){
            const tile = item.tile;
            const from = {r: tile.r, c: tile.c};
            const to = {r: r, c: targetIndex};
            // if moved or merged or coords different
            if (from.r !== to.r || from.c !== to.c || item.merged){
              moved = true;
            }
            ops.push({tile, from, to, merged:item.merged, removed: item.removed || null});
          }
        }
      }
    } else {
      // up / down
      for(let c=0;c<SIZE;c++){
        const col = [];
        for(let r=0;r<SIZE;r++) col.push(gridTiles[r][c] || null);
        const read = (dir==='up') ? col : col.slice().reverse();
        const compact = read.filter(x=>x);
        const processed = [];
        for(let i=0;i<compact.length;i++){
          if (i+1<compact.length && compact[i].value === compact[i+1].value){
            compact[i].value *= 2;
            score += compact[i].value;
            processed.push({tile:compact[i], merged:true, removed:compact[i+1]});
            i++;
          } else {
            processed.push({tile:compact[i], merged:false});
          }
        }
        while(processed.length < SIZE) processed.push(null);
        for(let idx=0; idx<SIZE; idx++){
          const targetIndex = (dir==='up') ? idx : (SIZE-1-idx);
          const item = processed[idx];
          if (item){
            const tile = item.tile;
            const from = {r: tile.r, c: tile.c};
            const to = {r: targetIndex, c: c};
            if (from.r !== to.r || from.c !== to.c || item.merged){
              moved = true;
            }
            ops.push({tile, from, to, merged:item.merged, removed: item.removed || null});
          }
        }
      }
    }

    if (!moved) return false;

    moves++;
    // We'll animate ops. But care: ops may contain duplicate references (same tile) if we didn't dedupe. We'll handle by grouping final positions: compute finalGridTemp then animate.
    // Clear grid for rebuild
    const newGrid = emptyGridTiles();

    // Place tiles into newGrid according to ops final positions — but need to account merges: when tile is merged, its 'removed' tile should be removed.
    // For ops order, we will prioritize by destination (r,c) — last write wins (but merges produce single tile).
    // Build map of dest -> tile that remains
    const destMap = {};
    ops.forEach(op => {
      const key = `${op.to.r}_${op.to.c}`;
      // if already assigned, keep first (shouldn't happen normally)
      if (!destMap[key]) destMap[key] = op;
      else {
        // choose op with merged true
        if (op.merged) destMap[key] = op;
      }
    });

    // Now set newGrid and update tile's r/c to destination
    Object.values(destMap).forEach(op => {
      const t = op.tile;
      newGrid[op.to.r][op.to.c] = t;
      t.r = op.to.r; t.c = op.to.c;
    });

    // Animate movements:
    // 1) For each op: move DOM tile to new pos, if merged -> after move remove the removed tile DOM
    ops.forEach(op => {
      // move only if tile exists
      if (!op.tile) return;
      // update DOM (will animate via CSS transition)
      moveTileDOM(op.tile, op.to.r, op.to.c, op.merged);
      if (op.merged && op.removed){
        // removed tile should fade out — ensure its dom exists then remove
        const rem = op.removed;
        // if removed tile still exists in tilesById and has DOM, fade it
        if (rem && rem.dom){
          // animate removed tile to merged cell position (optional) then fade
          const {x,y} = posFor([op.to.r, op.to.c]);
          rem.dom.style.transform = `translate(${x}px, ${y}px)`;
          setTimeout(()=> removeTileDOM(rem), 260);
          // also delete from tilesById map
          tilesById.delete(rem.id);
        }
      }
    });

    // some tiles might not appear in ops if they stayed still; keep them
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
      if (!newGrid[r][c] && gridTiles[r][c]){
        // tile stayed in place (no op) => keep
        const t = gridTiles[r][c];
        newGrid[r][c] = t;
        t.r = r; t.c = c;
        // ensure DOM transform corresponds
        if (t.dom) moveTileDOM(t, r, c, false);
      }
    }

    // after animations finished, update gridTiles = newGrid
    gridTiles = newGrid;

    // After move: add a new random tile
    setTimeout(()=> {
      addRandomTile();
      // chaos mode: optionally remove a random tile to create 'chaos'
      if (mode === 'chaos'){
        // remove a random filled tile (if >1)
        const filled = [];
        for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if (gridTiles[r][c]) filled.push([r,c]);
        if (filled.length > 1){
          const idx = Math.floor(Math.random()*filled.length);
          const [rr,cc] = filled[idx];
          const rem = gridTiles[rr][cc];
          if (rem){
            removeTileDOM(rem);
            tilesById.delete(rem.id);
            gridTiles[rr][cc] = null;
          }
        }
      }

      // update best
      if (score > best){ best = score; localStorage.setItem('milk2048_best', String(best)); }

      // render counters
      renderStats();

      // check win/lose
      if (checkWin()){
        openWin();
      } else if (!canMove()){
        openGameOver();
      }

      persist();
    }, 260);

    // animate score update immediately
    renderStats();

    return true;
  }

  function canMove(){
    // empty cell exists?
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if (!gridTiles[r][c]) return true;
    // neighbors equal?
    for(let r=0;r<SIZE;r++){
      for(let c=0;c<SIZE;c++){
        const v = gridTiles[r][c]?.value;
        if (r+1<SIZE && gridTiles[r+1][c] && gridTiles[r+1][c].value === v) return true;
        if (c+1<SIZE && gridTiles[r][c+1] && gridTiles[r][c+1].value === v) return true;
      }
    }
    return false;
  }

  function checkWin(){
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if (gridTiles[r][c] && gridTiles[r][c].value === 2048) return true;
    return false;
  }

  // ---- UI & events
  function renderStats(){
    scoreEl.textContent = score;
    bestEl.textContent = best;
    movesEl.textContent = moves;
    timeEl.textContent = formatTime(seconds);
  }

  function formatTime(sec){
    const m = String(Math.floor(sec/60)).padStart(2,'0');
    const s = String(sec%60).padStart(2,'0');
    return `${m}:${s}`;
  }

  // persistence
  function persist(){
    const plainGrid = gridTiles.map(row => row.map(cell => cell ? {id:cell.id, value:cell.value} : null));
    const data = { plainGrid, score, best, moves, seconds, mode, nextId };
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }catch(e){}
    try{ localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); }catch(e){}
  }
  function load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data) return false;
      score = data.score||0;
      best  = data.best||best;
      moves = data.moves||0;
      seconds = data.seconds||0;
      mode = data.mode || 'classic';
      nextId = data.nextId || nextId;
      // rebuild tiles
      gridTiles = emptyGridTiles();
      tilesById.clear();
      if (data.plainGrid){
        for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
          const obj = data.plainGrid[r][c];
          if (obj){
            const t = {id: obj.id, value: obj.value, r:r, c:c, dom:null};
            tilesById.set(t.id, t);
            gridTiles[r][c] = t;
            createTileDOM(t);
          } else gridTiles[r][c] = null;
        }
      }
      history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') || [];
      renderStats();
      return true;
    }catch(e){
      console.warn('load failed',e);
      return false;
    }
  }

  // start/stop timer
  function startTimer(){
    stopTimer();
    timer = setInterval(()=>{ seconds++; timeEl.textContent = formatTime(seconds); persist(); }, 1000);
  }
  function stopTimer(){ if (timer){ clearInterval(timer); timer=null; } }

  // init new game
  function startNew(saveHistory = true){
    if (saveHistory && score>0){
      history.push({date: new Date().toLocaleString(), score, moves, time: formatTime(seconds), mode});
    }
    // cleanup
    tilesById.forEach(t => { if (t.dom && t.dom.parentNode) t.dom.parentNode.removeChild(t.dom); });
    tilesById.clear();
    gridTiles = emptyGridTiles();
    nextId = 1;
    score = 0; moves = 0; seconds = 0;
    stopTimer(); startTimer();
    buildBoardBackground();
    // add initial two tiles
    addRandomTile();
    addRandomTile();
    renderStats();
    persist();
  }

  // UI modals
  function openGameOver(){
    document.getElementById('final-score').textContent = score;
    document.getElementById('final-best-score').textContent = best;
    modalGameOver.classList.add('active');
  }
  function closeGameOver(){ modalGameOver.classList.remove('active'); }

  function openWin(){
    modalWin.classList.add('active');
  }
  function closeWin(){ modalWin.classList.remove('active'); }

  // results
  function openResults(){
    // fill list
    resultsList.innerHTML = '';
    const arr = history.slice().reverse();
    if (!arr.length){
      const li = document.createElement('li');
      li.textContent = 'Пока нет результатов';
      resultsList.appendChild(li);
    } else {
      arr.slice(0,50).forEach(it => {
        const li = document.createElement('li');
        li.textContent = `[${it.date}] (${it.mode}) С:${it.score} Х:${it.moves} T:${it.time}`;
        resultsList.appendChild(li);
      });
    }
    resultsPanel.classList.add('active');
  }
  function closeResults(){ resultsPanel.classList.remove('active'); }

  // shop
  function openShop(){ shopPanel.classList.add('active'); }
  function closeShop(){ shopPanel.classList.remove('active'); }

  // keyboard controls
  window.addEventListener('keydown', (e)=>{
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
      e.preventDefault();
      const dir = {ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right'}[e.key];
      const moved = performMove(dir);
      if (moved) persist();
    }
  });

  // pointer (mouse) drag for desktop + touch gestures
  (function initPointer(){
    let startX=0, startY=0, startTime=0, tracking=false;
    boardEl.addEventListener('pointerdown', e=>{
      tracking = true;
      startX = e.clientX; startY = e.clientY; startTime = Date.now();
      boardEl.setPointerCapture && boardEl.setPointerCapture(e.pointerId);
    });
    boardEl.addEventListener('pointermove', e=>{
      // no-op
    });
    boardEl.addEventListener('pointerup', e=>{
      if (!tracking) return;
      tracking = false;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const adx = Math.abs(dx), ady = Math.abs(dy);
      const TH = 20;
      if (adx < TH && ady < TH) return; // tap
      const dir = adx > ady ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      const moved = performMove(dir);
      if (moved) persist();
    });
    // touch swipe for mobile also handled by pointer events above
  })();

  // background fishes + bubbles generator
  (function initBackground(){
    const layer = document.getElementById('bg-layer');
    // create some random fishes
    const nFish = 6;
    for(let i=0;i<nFish;i++){
      const f = document.createElement('div');
      f.className = 'fish';
      // randomize vertical position and animation-duration slightly
      const top = Math.random()*70;
      f.style.top = (top)+'%';
      f.style.left = (Math.random()*80 - 10) + '%';
      f.style.width = (40 + Math.random()*40) + 'px';
      f.style.height = (20 + Math.random()*12) + 'px';
      const dur = 14 + Math.random()*16;
      f.style.animationDuration = dur + 's';
      layer.appendChild(f);
    }
    // create some bubbles
    const nBubbles = 10;
    for(let i=0;i<nBubbles;i++){
      const b = document.createElement('div');
      b.className = 'bubble';
      const size = 8 + Math.random()*28;
      b.style.width = size + 'px';
      b.style.height = size + 'px';
      b.style.left = Math.random()*100 + '%';
      b.style.bottom = -20 - Math.random()*60 + 'px';
      b.style.opacity = 0.2 + Math.random()*0.6;
      b.style.animationDuration = (6 + Math.random()*10) + 's';
      layer.appendChild(b);
    }
    // add more bubbles continuously
    setInterval(()=>{
      const b = document.createElement('div');
      b.className = 'bubble';
      const size = 6 + Math.random()*26;
      b.style.width = size + 'px';
      b.style.height = size + 'px';
      b.style.left = Math.random()*100 + '%';
      b.style.bottom = -30 + 'px';
      b.style.opacity = 0.2 + Math.random()*0.6;
      b.style.animationDuration = (6 + Math.random()*10) + 's';
      layer.appendChild(b);
      // remove after animation
      setTimeout(()=> { if (b.parentNode) b.parentNode.removeChild(b); }, 14000);
    }, 1200);
  })();

  // UI wiring
  btnNew.addEventListener('click', ()=> startNew(true));
  btnClassic.addEventListener('click', ()=> { mode='classic'; btnClassic.classList.add('active'); btnChaos.classList.remove('active'); startNew(true); });
  btnChaos.addEventListener('click', ()=> { mode='chaos'; btnChaos.classList.add('active'); btnClassic.classList.remove('active'); startNew(true); });
  btnOpenRes.addEventListener('click', openResults);
  btnCloseRes && btnCloseRes.addEventListener('click', closeResults);

  openShopBtn && openShopBtn.addEventListener('click', openShop);
  closeShopBtn && closeShopBtn.addEventListener('click', closeShop);

  restartBtn && restartBtn.addEventListener('click', ()=>{ closeGameOver(); startNew(true); });
  continueBtn && continueBtn.addEventListener('click', ()=>{ closeWin(); });
  newWinBtn && newWinBtn.addEventListener('click', ()=>{ closeWin(); startNew(true); });

  // helpers
  function resetAll(){
    tilesById.forEach(t => { if (t.dom && t.dom.parentNode) t.dom.parentNode.removeChild(t.dom); });
    tilesById.clear();
    gridTiles = emptyGridTiles();
    nextId = 1;
    score = 0; moves = 0; seconds = 0;
    renderStats();
  }

  // initial setup
  buildBoardBackground();
  gridTiles = emptyGridTiles();

  // load saved or new
  const loaded = load();
  if (!loaded){
    startNew(false);
  } else {
    // if loaded, ensure timer and board background are set
    buildBoardBackground();
    startTimer();
    renderStats();
  }

  // small helper: expose to window for debugging
  window.__milk2048 = { performMove, startNew, gridTiles, tilesById };

})();
