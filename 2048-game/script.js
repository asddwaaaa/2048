'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useFirebase, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { doc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { profanityFilter } from '@/lib/profanity-filter';
import { cn } from '@/lib/utils';
import GameHeader from '@/components/game/GameHeader';
import GameControls from '@/components/game/GameControls';
import GameModal from '@/components/game/GameModal';
import NicknameModal from '@/components/game/NicknameModal';

// --- Types ---
type Tile = {
  id: number;
  value: number;
  row: number;
  col: number;
  isNew?: boolean;
  isMerged?: boolean;
};
type GameState = 'playing' | 'won' | 'lost';
type Theme = 'beige' | 'dark' | 'ocean' | 'forest';
type PlayerProfile = {
  id: string;
  nickname: string;
  themePreference: Theme;
};

// --- Tile Component ---
const tileColorClasses: { [key: number]: string } = {
  2: 'bg-[var(--tile-2)] text-[var(--tile-text-dark)]',
  4: 'bg-[var(--tile-4)] text-[var(--tile-text-dark)]',
  8: 'bg-[var(--tile-8)] text-[var(--tile-text-light)]',
  16: 'bg-[var(--tile-16)] text-[var(--tile-text-light)]',
  32: 'bg-[var(--tile-32)] text-[var(--tile-text-light)]',
  64: 'bg-[var(--tile-64)] text-[var(--tile-text-light)]',
  128: 'bg-[var(--tile-128)] text-[var(--tile-text-light)]',
  256: 'bg-[var(--tile-256)] text-[var(--tile-text-light)]',
  512: 'bg-[var(--tile-512)] text-[var(--tile-text-light)]',
  1024: 'bg-[var(--tile-1024)] text-[var(--tile-text-light)]',
  2048: 'bg-[var(--tile-2048)] text-[var(--tile-text-light)] relative overflow-hidden',
  4096: 'bg-[var(--tile-super)] text-[var(--tile-text-light)]',
  8192: 'bg-[var(--tile-super)] text-[var(--tile-text-light)]',
};

const fontSizeClasses: { [key: number]: string } = {
  2: 'text-4xl md:text-5xl',
  4: 'text-4xl md:text-5xl',
  8: 'text-4xl md:text-5xl',
  16: 'text-3xl md:text-4xl',
  32: 'text-3xl md:text-4xl',
  64: 'text-3xl md:text-4xl',
  128: 'text-2xl md:text-3xl',
  256: 'text-2xl md:text-3xl',
  512: 'text-2xl md:text-3xl',
  1024: 'text-xl md:text-2xl',
  2048: 'text-xl md:text-2xl',
  4096: 'text-lg md:text-xl',
  8192: 'text-lg md:text-xl',
};

function TileComponent({ value, row, col, isNew, isMerged }: Tile) {
  const colorClass = tileColorClasses[value] || 'bg-[var(--tile-super)] text-[var(--tile-text-light)]';
  const fontClass = fontSizeClasses[value] || 'text-md';

  const style = {
    '--x': col,
    '--y': row,
    transform: `translate(calc(var(--x) * (100% + 10px)), calc(var(--y) * (100% + 10px)))`,
    zIndex: isMerged ? 20 : 10,
  } as React.CSSProperties;

  return (
    <div
      className={cn(
        'absolute rounded-md flex items-center justify-center font-black select-none',
        'w-[calc(25%-7.5px)] h-[calc(25%-7.5px)]',
        'transition-transform duration-100 ease-in-out',
        colorClass,
        fontClass,
        isNew && 'animate-fade-in',
        isMerged && 'animate-pop',
        value === 0 && 'hidden',
        value === 2048 && 'animate-pulse-2048'
      )}
      style={style}
    >
      {value === 2048 && <div className="absolute inset-0 rainbow-border" />}
      { value > 0 && <span className="relative">{value}</span> }
    </div>
  );
}

// --- GameBoard Component ---
const BOARD_SIZE = 4;

function GameBoard({ tiles, onMove }: { tiles: Tile[], onMove: (direction: 'up' | 'down' | 'left' | 'right') => void }) {
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const boardEl = boardRef.current;
    if (!boardEl) return;

    let touchStartX = 0;
    let touchStartY = 0;
    const SWIPE_THRESHOLD = 30;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length === 1) {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const dx = touchEndX - touchStartX;
        const dy = touchEndY - touchStartY;

        if (Math.abs(dx) > Math.abs(dy)) {
          if (Math.abs(dx) > SWIPE_THRESHOLD) {
            onMove(dx > 0 ? 'right' : 'left');
          }
        } else {
          if (Math.abs(dy) > SWIPE_THRESHOLD) {
            onMove(dy > 0 ? 'down' : 'up');
          }
        }
      }
    };
    
    const preventDefault = (e: TouchEvent) => e.preventDefault();
    boardEl.addEventListener('touchstart', handleTouchStart, { passive: true });
    boardEl.addEventListener('touchend', handleTouchEnd, { passive: true });
    boardEl.addEventListener('touchmove', preventDefault, { passive: false });

    return () => {
      boardEl.removeEventListener('touchstart', handleTouchStart);
      boardEl.removeEventListener('touchend', handleTouchEnd);
      boardEl.removeEventListener('touchmove', preventDefault);
    };
  }, [onMove]);

  return (
    <div
      ref={boardRef}
      className="relative rounded-lg p-2.5 shadow-lg touch-none bg-[hsl(var(--game-board-bg))]"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
        gridTemplateRows: `repeat(${BOARD_SIZE}, 1fr)`,
        gap: '10px',
        aspectRatio: '1',
      }}
    >
      {/* Background Grid */}
      {Array.from({ length: BOARD_SIZE * BOARD_SIZE }).map((_, i) => (
        <div
          key={i}
          className="rounded-md bg-[hsl(var(--cell-bg))]"
        />
      ))}
      {/* Tile Layer */}
      <div className="absolute inset-2.5">
        {tiles.map(tile => (
          <TileComponent key={tile.id} {...tile} />
        ))}
      </div>
    </div>
  );
}


// --- Main Page Component ---
let tileIdCounter = 0;

const createNewTile = (tiles: Tile[]): Tile | null => {
    const getEmptyCells = () => {
        const grid: boolean[][] = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(false));
        tiles.forEach(tile => {
            if (tile.value > 0) grid[tile.row][tile.col] = true;
        });

        const emptyCells: { row: number; col: number }[] = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (!grid[r][c]) {
                    emptyCells.push({ row: r, col: c });
                }
            }
        }
        return emptyCells;
    };

    const emptyCells = getEmptyCells();
    if (emptyCells.length === 0) {
        return null;
    }

    const { row, col } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const value = Math.random() < 0.9 ? 2 : 4;
    return { id: tileIdCounter++, value, row, col, isNew: true };
};


export default function Home() {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [gameState, setGameState] = useState<GameState>('playing');
  const [theme, setTheme] = useState<Theme>('beige');
  const [isGameReady, setIsGameReady] = useState(false);
  
  const { auth, firestore } = useFirebase();
  const { user, isUserLoading } = useUser();

  const playerProfileRef = useMemoFirebase(() => user ? doc(firestore, 'player_profiles', user.uid) : null, [firestore, user]);
  const { data: playerProfile, isLoading: isProfileLoading } = useDoc<PlayerProfile>(playerProfileRef);
  
  const mainRef = useRef<HTMLElement>(null);
  
  const startGame = useCallback(() => {
    tileIdCounter = 0;
    setGameState('playing');
    setScore(0);
    
    const initialTiles: Tile[] = [];
    const tile1 = createNewTile(initialTiles);
    if(tile1) initialTiles.push(tile1);
    const tile2 = createNewTile(initialTiles);
    if(tile2) initialTiles.push(tile2);
    
    setTiles(initialTiles);

    if (user) {
        localStorage.removeItem(`2048-game-state-${user.uid}`);
    }
  }, [user]);

  // Auto sign-in for new users
  useEffect(() => {
    if (!isUserLoading && !user) {
      signInAnonymously(auth);
    }
  }, [isUserLoading, user, auth]);

  // Load game state or start new game once user and profile are ready
  useEffect(() => {
    if (isUserLoading || isProfileLoading || isGameReady) {
      return;
    }
    
    if (user) {
      const storedBestScore = localStorage.getItem('2048-best-score');
      if (storedBestScore) {
          setBestScore(parseInt(storedBestScore, 10));
      }

      const savedTheme = playerProfile?.themePreference || 'beige';
      setTheme(savedTheme);
      document.body.className = 'font-body antialiased';
      if (savedTheme !== 'beige') {
          document.body.classList.add(savedTheme);
      }

      if (playerProfile?.nickname) { // User has a nickname, game can start
          const savedGameState = localStorage.getItem(`2048-game-state-${user.uid}`);
          if (savedGameState) {
              try {
                  const { tiles: savedTiles, score: savedScore, gameState: savedStatus } = JSON.parse(savedGameState);
                  tileIdCounter = Math.max(...savedTiles.map((t: Tile) => t.id), 0) + 1;
                  setTiles(savedTiles.map((t: Tile) => ({...t, isNew: false, isMerged: false})));
                  setScore(savedScore);
                  setGameState(savedStatus);
              } catch (e) {
                  startGame(); 
              }
          } else {
               startGame();
          }
          setIsGameReady(true);
      } else {
          // No nickname yet. The NicknameModal will be shown.
          setIsGameReady(true); 
          if(tiles.length === 0) {
            startGame();
          }
      }
    }
  }, [user, isUserLoading, isProfileLoading, playerProfile, startGame, isGameReady, tiles.length]);
  

  // Save game state to localStorage
  useEffect(() => {
      if(isGameReady && user && playerProfile?.nickname) {
          const gameStateToSave = JSON.stringify({ tiles, score, gameState });
          localStorage.setItem(`2048-game-state-${user.uid}`, gameStateToSave);
      }
  }, [tiles, score, gameState, isGameReady, user, playerProfile?.nickname]);


  useEffect(() => {
      if (score > bestScore) {
          setBestScore(score);
          localStorage.setItem('2048-best-score', String(score));
      }
  }, [score, bestScore]);

  const saveScore = useCallback(async () => {
    if (user && score > 0) {
      const scoresCollection = collection(firestore, `player_profiles/${user.uid}/game_scores`);
      const scoreData = {
        playerId: user.uid,
        score: score,
        timestamp: serverTimestamp(),
      };
      await addDoc(scoresCollection, scoreData).catch(error => console.error("Error adding document: ", error));
    }
  }, [user, score, firestore]);

  useEffect(() => {
    if (gameState === 'lost') {
      saveScore();
    }
  }, [gameState, saveScore]);

  const saveNickname = async (nickname: string): Promise<{success: boolean, message: string}> => {
    if (profanityFilter.isProfane(nickname)) {
      return { success: false, message: 'Этот никнейм содержит недопустимые слова.' };
    }
    if (user && playerProfileRef) {
      const profileData = {
        id: user.uid,
        nickname,
        themePreference: theme,
      };
      try {
        setDocumentNonBlocking(playerProfileRef, profileData, { merge: true });
        startGame();
        return { success: true, message: 'Никнейм сохранен!' };
      } catch (error) {
        console.error("Error saving nickname:", error);
        return { success: false, message: 'Произошла ошибка при сохранении.' };
      }
    }
    return { success: false, message: 'Произошла ошибка.' };
  }
  
  const changeTheme = (newTheme: Theme) => {
      setTheme(newTheme);
      document.body.className = 'font-body antialiased';
      if (newTheme !== 'beige') {
          document.body.classList.add(newTheme);
      }
      if (user && playerProfileRef) {
        setDocumentNonBlocking(playerProfileRef, { themePreference: newTheme }, { merge: true });
      }
  };

  const move = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (gameState !== 'playing') return;

    let moved = false;
    let newScore = 0;

    setTiles(currentTiles => {
        const newTiles: Tile[] = JSON.parse(JSON.stringify(currentTiles)).map((t: Tile) => ({ ...t, isNew: false, isMerged: false }));
        
        const isVertical = direction === 'up' || direction === 'down';
        const isReverse = direction === 'down' || direction === 'right';

        for (let i = 0; i < BOARD_SIZE; i++) {
            const line = newTiles.filter(tile => isVertical ? tile.col === i : tile.row === i);
            line.sort((a, b) => {
                const posA = isVertical ? a.row : a.col;
                const posB = isVertical ? b.row : b.col;
                return (isReverse ? posB - posA : posA - posB);
            });

            const mergedLine: Tile[] = [];
            for (let j = 0; j < line.length; j++) {
                if (j + 1 < line.length && line[j].value === line[j + 1].value) {
                    const mergedValue = line[j].value * 2;
                    newScore += mergedValue;
                    mergedLine.push({ ...line[j], value: mergedValue, isMerged: true });
                    
                    line[j].value = -1; // Mark as removed
                    line[j+1].value = -1;
                    
                    moved = true;
                    j++; // Skip next tile
                } else {
                    mergedLine.push(line[j]);
                }
            }
            
            mergedLine.forEach((tile, index) => {
                const newPos = isReverse ? BOARD_SIZE - 1 - index : index;
                const oldPos = isVertical ? tile.row : tile.col;
                if(oldPos !== newPos) moved = true;
                if(isVertical) tile.row = newPos;
                else tile.col = newPos;
            });
        }

        const finalTiles = newTiles.filter(t => t.value !== -1);

        if (moved) {
            const newTile = createNewTile(finalTiles);
            if (newTile) {
                finalTiles.push(newTile);
            }
            setScore(s => s + newScore);

            let hasWon = finalTiles.some(t => t.value === 2048);
            if(hasWon && gameState !== 'won'){
                setGameState('won');
                saveScore();
            }

            const emptyCells = finalTiles.length < BOARD_SIZE * BOARD_SIZE;
            if (!emptyCells) {
                let canMove = false;
                for (let r = 0; r < BOARD_SIZE; r++) {
                    for (let c = 0; c < BOARD_SIZE; c++) {
                        const tile = finalTiles.find(t => t.row === r && t.col === c);
                        if (!tile) continue;
                        const rightNeighbor = finalTiles.find(t => t.row === r && t.col === c + 1);
                        if (rightNeighbor && rightNeighbor.value === tile.value) canMove = true;
                        const downNeighbor = finalTiles.find(t => t.row === r + 1 && t.col === c);
                        if (downNeighbor && downNeighbor.value === tile.value) canMove = true;
                    }
                }
                if (!canMove) {
                    setGameState('lost');
                }
            }
            return finalTiles;
        }

        return currentTiles;
    });
  }, [gameState, saveScore]);

  const continueGame = () => {
    setGameState('playing');
  };
  
  const shuffle = useCallback(() => {
      if (gameState !== 'playing') return;
      setTiles(currentTiles => {
        let tempTiles = currentTiles.map(t => ({...t, isNew: false, isMerged: false}));
        const positions = tempTiles.map(t => ({row: t.row, col: t.col}));
        
        for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [positions[i], positions[j]] = [positions[j], positions[i]];
        }
        
        const shuffledTiles = tempTiles.map((tile, i) => ({
            ...tile,
            row: positions[i].row,
            col: positions[i].col
        }));
    
        return shuffledTiles;
      });
  }, [gameState]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isGameReady || gameState !== 'playing') {
      return;
    }
    if (['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
      return;
    }
  
    let moved = false;
    switch (e.key) {
      case 'ArrowUp': move('up'); moved = true; break;
      case 'ArrowDown': move('down'); moved = true; break;
      case 'ArrowLeft': move('left'); moved = true; break;
      case 'ArrowRight': move('right'); moved = true; break;
    }
  
    if(moved) {
      e.preventDefault();
    }
  }, [move, gameState, isGameReady]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
  
  useEffect(() => {
    if (isGameReady && mainRef.current) {
      mainRef.current.focus();
    }
  }, [isGameReady]);

  const showNicknameModal = !playerProfile?.nickname && !isUserLoading && user;

  if (!isGameReady) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 md:p-8">
        <div className="text-2xl font-bold">Загрузка...</div>
      </main>
    );
  }

  return (
    <main 
      ref={mainRef}
      tabIndex={-1}
      className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 md:p-8 outline-none"
    >
      <NicknameModal isOpen={showNicknameModal} onSave={saveNickname} />
      <div className="w-full max-w-md">
        <GameHeader score={score} bestScore={bestScore} nickname={playerProfile?.nickname} />
        <GameControls
          onNewGame={startGame}
          onShuffle={shuffle}
          onThemeChange={changeTheme}
          currentTheme={theme}
        />
        <GameBoard tiles={tiles} onMove={move} />
      </div>
      <GameModal
        gameState={gameState}
        score={score}
        onRestart={startGame}
        onContinue={continueGame}
      />
    </main>
  );
}
