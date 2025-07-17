"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { apiService, UserProfile } from "@/services/api";
// import words from "../words.json";
import { useRouter } from "next/navigation";

// Define a Mission type for mission-related state and variables
interface Mission {
  id: string;
  completed: boolean;
  progress: number;
  goal?: number;
  target?: number;
  period?: string;
  type?: string;
  title?: string;
  name?: string;
}

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Game error:", error, errorInfo);
    if (error && error.stack) {
      console.error("Error stack:", error.stack);
    }
    if (error && error.name) {
      console.error("Error type:", error.name);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-black px-4 py-12">
          <div className="w-full max-w-2xl bg-black bg-opacity-80 rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-8">
            <h1 className="text-3xl font-extrabold text-white tracking-wide text-center mb-4">Game Error</h1>
            <div className="text-white text-lg mb-4">Something went wrong with the game.</div>
            <div className="text-red-400 text-sm mb-4">{this.state.error?.toString()}</div>
            <button 
              className="px-6 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold shadow hover:scale-105 transition-all duration-150"
              onClick={() => window.location.reload()}
            >
              Reload Game
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const GRID_COLS = 5;
const GRID_ROWS = 8;

// Generate a board that starts with bottom 3 rows populated
// Enhanced letter generation with proper frequency distribution and rare letter guardrails
function generateRandomLetter(): string {
  // Letter frequency distribution based on Scrabble/English usage
  const letterFrequencies: Record<string, number> = {
    // Vowels (30% total probability)
    'A': 9.0, 'E': 12.0, 'I': 9.0, 'O': 8.0, 'U': 4.0,
    // Common consonants (60% total probability)
    'T': 9.0, 'N': 6.7, 'S': 6.3, 'H': 6.1, 'R': 6.0,
    'D': 4.3, 'L': 4.0, 'C': 2.8, 'M': 2.4, 'W': 2.4,
    'F': 2.2, 'G': 2.0, 'Y': 2.0, 'P': 1.9, 'B': 1.5,
    'V': 0.98, 'K': 0.77, 'J': 0.15, 'X': 0.15, 'Q': 0.10,
    'Z': 0.07
  };

  // Convert frequencies to cumulative probabilities
  const letters = Object.keys(letterFrequencies);
  const totalFreq = Object.values(letterFrequencies).reduce((sum, freq) => sum + freq, 0);
  
  // Create cumulative probability array
  let cumulative = 0;
  const cumulativeProbs: { letter: string; prob: number }[] = [];
  
  for (const letter of letters) {
    cumulative += letterFrequencies[letter] / totalFreq;
    cumulativeProbs.push({ letter, prob: cumulative });
  }

  // Generate random letter based on frequency
  const random = Math.random();
  for (const { letter, prob } of cumulativeProbs) {
    if (random <= prob) {
      return letter;
    }
  }
  
  // Fallback to most common letter
  return 'E';
}

// Track rare letters to prevent multiple instances
const rareLettersOnBoard = new Set<string>();

// Board-Aware Letter Generation & Anti-Clustering System (v1.0.107)
function drawLetterFromBagWithBoardCheck(board: string[][], row: number, col: number): string {
  const rareLetters = ['Z', 'Q', 'X', 'J', 'K', 'V'];
  const maxRareLettersOnBoard = 2;
  
  // Check current rare letter count
  const currentRareCount = Array.from(rareLettersOnBoard).length;
  
  // Anti-repetition: Check surrounding cells for the same letter
  const surroundingLetters = new Set<string>();
  for (let r = Math.max(0, row - 1); r <= Math.min(GRID_ROWS - 1, row + 1); r++) {
    for (let c = Math.max(0, col - 1); c <= Math.min(GRID_COLS - 1, col + 1); c++) {
      if (board[r][c] && !(r === row && c === col)) {
        surroundingLetters.add(board[r][c]);
      }
    }
  }
  
  // Generate letter with anti-clustering
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    let letter: string;
    
    // If at rare letter limit, generate only common letters
    if (currentRareCount >= maxRareLettersOnBoard) {
      const commonLetters = ['A', 'E', 'I', 'O', 'U', 'T', 'N', 'S', 'H', 'R', 'D', 'L', 'C', 'M', 'W', 'F', 'G', 'Y', 'P', 'B'];
      letter = commonLetters[Math.floor(Math.random() * commonLetters.length)];
    } else {
      // Generate letter with normal frequency
      letter = generateRandomLetter();
    }
    
    // Anti-clustering: Avoid repeating the same letter in adjacent cells
    if (!surroundingLetters.has(letter)) {
      // Track rare letters
      if (rareLetters.includes(letter)) {
        rareLettersOnBoard.add(letter);
      }
      return letter;
    }
    
    attempts++;
  }
  
  // Fallback: return a common letter if anti-clustering fails
  const fallbackLetters = ['A', 'E', 'I', 'O', 'U', 'T', 'N', 'S', 'H', 'R'];
  return fallbackLetters[Math.floor(Math.random() * fallbackLetters.length)];
}

// Enhanced letter generation with rare letter guardrails (legacy function for backward compatibility)
function generateRandomLetterWithGuardrails(): string {
  return drawLetterFromBagWithBoardCheck([], 0, 0);
}

// Reset rare letter tracking when board is cleared
function resetRareLetterTracking() {
  rareLettersOnBoard.clear();
}

// Remove rare letter from tracking when it's used
function removeRareLetterFromTracking(letter: string) {
  const rareLetters = ['Z', 'Q', 'X', 'J', 'K', 'V'];
  if (rareLetters.includes(letter)) {
    rareLettersOnBoard.delete(letter);
  }
}

function generateBoard() {
  resetRareLetterTracking();
  const board = Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => "")
  );
  
  // Fill the bottom 3 rows with board-aware letter generation
  for (let row = GRID_ROWS - 3; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      board[row][col] = drawLetterFromBagWithBoardCheck(board, row, col);
    }
  }
  
  console.log("Generated board:", board);
  console.log("Rare letters on board:", Array.from(rareLettersOnBoard));
  return board;
}

// Function to make letters fall down when they're used
function makeLettersFall(board: string[][]) {
  const newBoard = board.map(row => [...row]);
  
  // For each column, move letters down
  for (let col = 0; col < GRID_COLS; col++) {
    let writeRow = GRID_ROWS - 1;
    for (let row = GRID_ROWS - 1; row >= 0; row--) {
      if (newBoard[row][col] !== "") {
        if (writeRow !== row) {
          newBoard[writeRow][col] = newBoard[row][col];
          newBoard[row][col] = "";
        }
        writeRow--;
      }
    }
  }
  
  // Don't add new letters immediately - let them fall naturally over time
  // New letters will be added by the game mechanics later
  
  return newBoard;
}

// Helper to insert a new row at the top
function insertNewRow(board: string[][]) {
  const newBoard = board.map(row => [...row]);
  for (let col = 0; col < GRID_COLS; col++) {
    if (newBoard[0][col] === "") {
      newBoard[0][col] = drawLetterFromBagWithBoardCheck(newBoard, 0, col);
    }
  }
  return newBoard;
}

// Helper to get highest filled row (0-based, so add 1 for count)
function getHighestFilledRow(board: string[][]) {
  for (let row = 0; row < GRID_ROWS; row++) {
    if (board[row].some(cell => cell !== "")) {
      return row;
    }
  }
  return GRID_ROWS; // all empty
}
// Helper to check if board is too sparse (<60% filled)
function isBoardTooSparse(board: string[][]) {
  const total = GRID_ROWS * GRID_COLS;
  const filled = board.flat().filter(cell => cell !== "").length;
  return (filled / total) < 0.6;
}

// Progressive Difficulty System (v1.0.107)
// Time bonus decreases as player level increases
function getTimeBonus(wordLength: number, level: number): number {
  const baseBonus = (() => {
    switch (wordLength) {
      case 3: return 1;
      case 4: return 2;
      case 5: return 3;
      case 6: return 4;
      case 7: return 5;
      case 8: return 6;
      default: return 0;
    }
  })();
  
  let reduction = 0;
  if (level >= 5 && level <= 9) reduction = 1;
  else if (level >= 10 && level <= 14) reduction = 2;
  else if (level >= 15 && level <= 19) reduction = 3;
  else if (level >= 20) reduction = 4;
  
  return Math.max(0, baseBonus - reduction);
}

// Progressive Word Length Requirement (v1.0.107)
function getMinimumWordLength(level: number): number {
  if (level >= 40) return 4;
  return 3;
}

// Letter-Based Scoring System (v1.0.107)
const LETTER_POINTS = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10
};

function calculateWordScore(word: string, level: number): number {
  // Calculate letter score
  const letterScore = word.split('').reduce((total, letter) => {
    return total + (LETTER_POINTS[letter as keyof typeof LETTER_POINTS] || 1);
  }, 0);
  
  // Add level bonus
  const levelBonus = Math.floor(letterScore * (level - 1) * 0.1);
  
  return letterScore + levelBonus;
}

export default function PlayGame() {
  const router = useRouter();
  const emptyBoard = Array.from({ length: GRID_ROWS }, () => Array.from({ length: GRID_COLS }, () => ""));
  const [board, setBoard] = useState<string[][]>(emptyBoard);
  const [selected, setSelected] = useState<{ row: number; col: number }[]>([]);
  const [foundWords, setFoundWords] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  // Level always starts at 1 for each game
  const [currentLevel, setCurrentLevel] = useState(1);
  const [pointsToNextLevel, setPointsToNextLevel] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [definitions, setDefinitions] = useState<Record<string, { definition: string; attribution?: string }>>({});
  const [loadingDefs, setLoadingDefs] = useState(false);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [missionsLoading, setMissionsLoading] = useState(false);
  const [missionsError, setMissionsError] = useState<string | null>(null);
  const [hintWord, setHintWord] = useState<string | null>(null);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [freezeTimeout, setFreezeTimeout] = useState<NodeJS.Timeout | null>(null);
  const [flectcoins, setFlectcoins] = useState(500); // Placeholder, ideally fetched from user profile
  const [gems, setGems] = useState(0);
  const [powerupError, setPowerupError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [levelUpBanner, setLevelUpBanner] = useState<{ show: boolean; newLevel: number }>({ show: false, newLevel: 0 });
  const [previousLevel, setPreviousLevel] = useState<number>(0);
  // Popup for level up
  const [showLevelUpPopup, setShowLevelUpPopup] = useState(false);
  const [levelUpPopupLevel, setLevelUpPopupLevel] = useState(0);

  // Remove all wordSet and wordList logic
  const [wordFeedback, setWordFeedback] = useState<string | null>(null);
  const [validatingWord] = useState(false);
  const [wordSet, setWordSet] = useState<Set<string> | null>(null);
  const [wordListLoading, setWordListLoading] = useState(true);

  // Powerup costs (adjust as needed)
  const HINT_COST = 50;
  const SHUFFLE_COST = 100;
  const FREEZE_COST = 200;

  // Compute longest word and top scoring word
  const longestWord = foundWords.reduce((a, b) => (b.length > a.length ? b : a), "");
  const topScoringWord = longestWord; // For now, score = length

  const INITIAL_TIMER = 120;
  const [timer, setTimer] = useState(INITIAL_TIMER); // 2 minutes
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const dangerZoneTimeout = useRef<NodeJS.Timeout | null>(null);
  const [inDangerZone, setInDangerZone] = useState(false);
  const latestBoardRef = useRef<string[][]>(emptyBoard);
  useEffect(() => { latestBoardRef.current = board; }, [board]);

  // Letter falling timer - letters fall every 2 seconds
  // const letterFallRef = useRef<NodeJS.Timeout | null>(null);
  // const [letterFallTimer, setLetterFallTimer] = useState(0);
  // --- New: Row population timer logic matching mobile ---
  const rowTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [rowPopulationTick, setRowPopulationTick] = useState(0);

  // Helper: count filled rows
  function getFilledRows(board: string[][]) {
    return board.filter(row => row.some(cell => cell !== "")).length;
  }

  // Helper: get base interval by zone
  function getBaseInterval(filledRows: number) {
    if (filledRows <= 1) return 12000; // Danger
    if (filledRows <= 3) return 9000;  // Hot
    if (filledRows <= 5) return 13000; // Warm
    return 16000;                      // Cool
  }

  // Helper: apply level scaling
  function getLevelScaledInterval(base: number, level: number) {
    return base * Math.max(0.5, 1 - 0.05 * (level - 1));
  }

  // Row population effect (matches mobile)
  useEffect(() => {
    console.log('🔄 Row insertion effect triggered:', {
      gameOver,
      validatingWord,
      isFrozen,
      filledRows: getFilledRows(board),
      currentLevel
    });
    
    if (gameOver || validatingWord) {
      console.log('⏸️ Row insertion paused:', { gameOver, validatingWord });
      return;
    }
    if (isFrozen) {
      console.log('⏸️ Row insertion paused (frozen)');
      return;
    }
    
    // Clear any previous timer
    if (rowTimerRef.current) clearTimeout(rowTimerRef.current);
    
    // Calculate interval
    const filledRows = getFilledRows(board);
    const baseInterval = getBaseInterval(filledRows);
    const interval = getLevelScaledInterval(baseInterval, currentLevel);
    
    console.log('⏰ Setting row timer:', {
      filledRows,
      baseInterval,
      interval,
      currentLevel
    });
    
    rowTimerRef.current = setTimeout(() => {
      console.log('📦 Adding new row...');
      // Add new row (populate top row)
      setBoard(prevBoard => {
        // Check for game over (top row filled)
        if (prevBoard[0].some(cell => cell !== "")) {
          console.log('🎮 Game over - top row filled');
          setGameOver(true);
          return prevBoard;
        }
        // Add new letters at the top row
        const newBoard = prevBoard.map(row => [...row]);
        for (let col = 0; col < GRID_COLS; col++) {
          if (newBoard[0][col] === "") {
            newBoard[0][col] = generateRandomLetterWithGuardrails();
          }
        }
        console.log('✅ New row added successfully');
        return makeLettersFall(newBoard);
      });
      setRowPopulationTick(tick => tick + 1); // trigger next
    }, interval);
    
    return () => {
      if (rowTimerRef.current) {
        console.log('🧹 Cleaning up row timer');
        clearTimeout(rowTimerRef.current);
      }
    };
  }, [gameOver, isFrozen, validatingWord, board, currentLevel, rowPopulationTick]);

  // Start and manage the timer
  useEffect(() => {
    if (gameOver || validatingWord) return;
    if (isFrozen) return; // Pause timer during freeze
    if (timer <= 0) {
      console.log("[GAME OVER] Timer reached zero");
      setGameOver(true);
      return;
    }
    timerRef.current = setInterval(() => {
      setTimer(t => t > 0 ? t - 1 : 0);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameOver, isFrozen, timer, validatingWord]);

  // Reset timer on replay
  useEffect(() => {
    if (!gameOver && timer === 0) setTimer(INITIAL_TIMER);
  }, [gameOver, timer]);

  // Danger zone logic: delay game over if top row is full
  useEffect(() => {
    if (gameOver) return;
    const topRowFull = board[0] && board[0].every(cell => cell !== "");
    if (topRowFull && !inDangerZone) {
      setInDangerZone(true);
      console.log("[DANGER ZONE] Top row is full");
      dangerZoneTimeout.current = setTimeout(() => {
        const latestBoard = latestBoardRef.current;
        if (latestBoard[0] && latestBoard[0].every(cell => cell !== "")) {
          console.log("[GAME OVER] Top row still full after danger zone");
          setGameOver(true);
        } else {
          console.log("[DANGER ZONE CLEARED] Top row not full after delay");
        }
        setInDangerZone(false);
        dangerZoneTimeout.current = null;
      }, 2000); // 2 second delay
    } else if (!topRowFull && inDangerZone) {
      setInDangerZone(false);
      if (dangerZoneTimeout.current) {
        clearTimeout(dangerZoneTimeout.current);
        dangerZoneTimeout.current = null;
      }
      console.log("[DANGER ZONE CANCELLED] Top row cleared");
    }
    return () => {
      if (dangerZoneTimeout.current && (!inDangerZone || gameOver)) {
        clearTimeout(dangerZoneTimeout.current);
        dangerZoneTimeout.current = null;
      }
    };
  }, [board, gameOver, inDangerZone]);

  // Fetch definitions for all found words at game over
  useEffect(() => {
    if (!gameOver || foundWords.length === 0) return;
    let isMounted = true;
    setLoadingDefs(true);
    const fetchAllDefs = async () => {
      const defs: Record<string, { definition: string; attribution?: string }> = {};
      for (const word of foundWords) {
        if (!defs[word]) {
          defs[word] = await apiService.getWordDefinition(word);
        }
      }
      if (isMounted) {
        setDefinitions(defs);
        setLoadingDefs(false);
      }
    };
    fetchAllDefs();
    return () => { isMounted = false; };
  }, [gameOver, foundWords]);

  // Fetch missions at game start
  useEffect(() => {
    let isMounted = true;
    setMissionsLoading(true);
    setMissionsError(null);
    apiService.getMissions()
      .then((data) => {
        if (isMounted) {
          if (typeof data === 'object' && data !== null && 'missions' in data && Array.isArray((data as { missions?: unknown[] }).missions)) {
            setMissions((data as { missions: Mission[] }).missions);
          } else if (Array.isArray(data)) {
            setMissions(data as Mission[]);
          } else {
            setMissions([]);
          }
        }
      })
      .catch((e) => {
        if (isMounted) setMissionsError(e.message || "Failed to fetch missions");
      })
      .finally(() => {
        if (isMounted) setMissionsLoading(false);
      });
    return () => { isMounted = false; };
  }, []);

  // Fetch user profile at game start for flectcoins and gems
  useEffect(() => {
    let isMounted = true;
    
    // Check authentication first
    if (!apiService.isAuthenticated()) {
      console.warn("User not authenticated - some features may not work");
      setPowerupError("Not signed in. Some features may be limited.");
      return;
    }
    
    apiService.getUserProfile()
      .then(profile => {
        if (isMounted) {
          setFlectcoins(profile.flectcoins || 0);
          setGems(profile.gems || 0);
          
          // Check for level up
          if (profile.highestLevel > previousLevel && previousLevel > 0) {
            setLevelUpBanner({ show: true, newLevel: profile.highestLevel });
            // Auto-hide banner after 5 seconds
            setTimeout(() => {
              setLevelUpBanner({ show: false, newLevel: 0 });
            }, 5000);
          }
          
          setPreviousLevel(profile.highestLevel);
          setUserProfile(profile); // Store full profile
          setPowerupError(null); // Clear any previous auth errors
        }
      })
      .catch((e) => {
        if (isMounted) {
          console.error("Failed to fetch user profile:", e);
          setPowerupError("Failed to load user data. Some features may be limited.");
        }
      });
    return () => { isMounted = false; };
  }, [previousLevel]);



  // Load word list from public/words.json and generate board
  useEffect(() => {
    setWordListLoading(true);
    
    // Create a timeout promise
    const timeoutPromise = new Promise<Error>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 10000); // 10 second timeout
    });
    
    // Race between fetch and timeout
    Promise.race<Promise<Response | Error>>([
      fetch("/words.json"),
      timeoutPromise
    ])
      .then((res) => {
        if (!(res instanceof Response) || !res.ok) {
          throw new Error(`HTTP error! status: ${(res as Response).status}`);
        }
        return res.json();
      })
      .then((words: string[]) => {
        console.log("Word list loaded successfully:", words.length, "words");
        setWordSet(new Set(words.map(w => w.toUpperCase())));
        setWordListLoading(false);
        // Generate board after word list is loaded
        setBoard(generateBoard());
      })
      .catch((error: unknown) => {
        console.error("Failed to load word list:", error);
        setWordListLoading(false);
        // Still generate board even if word list fails
        setBoard(generateBoard());
        // Set a fallback word set with common words
        const fallbackWords = ["CAT", "DOG", "THE", "AND", "FOR", "ARE", "BUT", "NOT", "YOU", "ALL", "CAN", "HER", "WAS", "ONE", "OUR", "OUT", "DAY", "GET", "HAS", "HIM", "HIS", "HOW", "MAN", "NEW", "NOW", "OLD", "SEE", "TWO", "WAY", "WHO", "BOY", "DID", "ITS", "LET", "PUT", "SAY", "SHE", "TOO", "USE"];
        setWordSet(new Set(fallbackWords));
      });
  }, []);

  // Helper to check if a cell is adjacent to the last selected cell
  function isAdjacent(row: number, col: number, path: { row: number; col: number }[]) {
    if (path.length === 0) return true;
    const last = path[path.length - 1];
    const dr = Math.abs(last.row - row);
    const dc = Math.abs(last.col - col);
    return dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0);
  }

  // Timer for auto-submit after pause
  const autoSubmitTimeout = useRef<NodeJS.Timeout | null>(null);

  // Auto-submit logic for mobile-like tap-to-select
  const handleCellClick = async (row: number, col: number) => {
    console.log(`=== CELL CLICK DEBUG ===`);
    console.log(`Cell clicked: (${row}, ${col})`);
    console.log(`Letter at position: "${board[row][col]}"`);
    console.log(`Current selected path:`, selected);
    console.log(`WordSet loaded:`, wordFeedback ? `Yes (Validating: ${validatingWord})` : 'No');
    
    // Check if this cell is already in the current path
    const isAlreadySelected = selected.some(sel => sel.row === row && sel.col === col);
    console.log(`Is already selected:`, isAlreadySelected);
    
    // Check if this is adjacent to the last selected tile
    const isAdjacentToLast = selected.length === 0 || isAdjacent(row, col, selected);
    console.log(`Is adjacent to last:`, isAdjacentToLast);
    
    // Check if this is the last selected tile
    const isLastSelected = selected.length > 0 && 
      selected[selected.length - 1].row === row && 
      selected[selected.length - 1].col === col;
    console.log(`Is last selected tile:`, isLastSelected);
    
    // Auto-submit conditions:
    // 1. Clicking a non-adjacent tile (finish current word, start new)
    // 2. Clicking an already selected tile (finish current word)
    // 3. Clicking the last selected tile (finish current word)
    
    const shouldAutoSubmit = selected.length > 0 && (
      !isAdjacentToLast || 
      isAlreadySelected || 
      isLastSelected
    );
    
    console.log(`Should auto-submit:`, shouldAutoSubmit);
    console.log(`Reason:`, {
      hasSelection: selected.length > 0,
      notAdjacent: !isAdjacentToLast,
      alreadySelected: isAlreadySelected,
      isLastSelected: isLastSelected
    });
    
    if (shouldAutoSubmit) {
      console.log("*** AUTO-SUBMIT TRIGGERED ***");
      if (selected.length >= 3) {
        const word = selected.map(sel => board[sel.row][sel.col]).join("");
        if (isValidWord(word)) {
          setFoundWords(prev => [...prev, word]);
          // Use letter-based scoring system
          const wordScore = calculateWordScore(word, currentLevel);
          setScore(prev => prev + wordScore);
          // Add time bonus for finding a word (progressive difficulty)
          const timeBonus = getTimeBonus(word.length, currentLevel);
          setTimer(prev => Math.min(prev + timeBonus, INITIAL_TIMER)); // Cap at initial timer
          setWordFeedback(`Good word! +${wordScore}pts +${timeBonus}s`);
          setTimeout(() => setWordFeedback(null), 1200);
          setBoard(prevBoard => {
            const newBoard = prevBoard.map(row => [...row]);
            selected.forEach(sel => {
              const letter = newBoard[sel.row][sel.col];
              newBoard[sel.row][sel.col] = "";
              // Remove rare letter from tracking when used
              removeRareLetterFromTracking(letter);
            });
            const fallen = makeLettersFall(newBoard);
            const highestRow = getHighestFilledRow(fallen);
            if ((word.length >= 5 && highestRow > 1) || (isBoardTooSparse(fallen) && highestRow > 1)) {
              return insertNewRow(fallen);
            }
            return fallen;
          });
        } else {
          setWordFeedback("Invalid word");
          setTimeout(() => setWordFeedback(null), 1200);
        }
      } else {
        console.log("Word too short or wordSet not loaded:", { length: selected.length, wordSetLoaded: !!wordFeedback });
      }
      setSelected([]);
      
      // If clicking a non-adjacent tile, start new path with it
      if (!isAdjacentToLast && !isAlreadySelected) {
        console.log("Starting new path with clicked tile");
        setSelected([{ row, col }]);
      }
      return;
    }
    
    // Add the tile to the current path
    console.log("Adding tile to path");
    setSelected((prev) => [...prev, { row, col }]);

    // Reset auto-submit timer
    if (autoSubmitTimeout.current) clearTimeout(autoSubmitTimeout.current);
    autoSubmitTimeout.current = setTimeout(() => {
      // Only auto-submit if path is at least 3 letters
      if (selected.length + 1 >= 3) {
        const newPath = [...selected, { row, col }];
        const word = newPath.map(sel => board[sel.row][sel.col]).join("");
        if (isValidWord(word)) {
          setFoundWords(prev => [...prev, word]);
          // Use letter-based scoring system
          const wordScore = calculateWordScore(word, currentLevel);
          setScore(prev => prev + wordScore);
          // Add time bonus for finding a word (progressive difficulty)
          const timeBonus = getTimeBonus(word.length, currentLevel);
          setTimer(prev => Math.min(prev + timeBonus, INITIAL_TIMER)); // Cap at initial timer
          setWordFeedback(`Good word! +${wordScore}pts +${timeBonus}s`);
          setTimeout(() => setWordFeedback(null), 1200);
          setBoard(prevBoard => {
            const newBoard = prevBoard.map(row => [...row]);
            newPath.forEach(sel => {
              const letter = newBoard[sel.row][sel.col];
              newBoard[sel.row][sel.col] = "";
              // Remove rare letter from tracking when used
              removeRareLetterFromTracking(letter);
            });
            const fallen = makeLettersFall(newBoard);
            const highestRow = getHighestFilledRow(fallen);
            if ((word.length >= 5 && highestRow > 1) || (isBoardTooSparse(fallen) && highestRow > 1)) {
              return insertNewRow(fallen);
            }
            return fallen;
          });
        } else {
          setWordFeedback("Invalid word");
          setTimeout(() => setWordFeedback(null), 1200);
        }
        setSelected([]);
      }
    }, 1500); // 1.5 second pause to give more time for longer words
  };

  // Clear auto-submit timer on unmount
  useEffect(() => {
    return () => {
      if (autoSubmitTimeout.current) clearTimeout(autoSubmitTimeout.current);
    };
  }, []);

  // Level progression helpers (per markdown)
  const getAdditionalPointsNeeded = useCallback((level: number) => {
    return Math.floor(25 * Math.pow(1.15, level - 1));
  }, []);

  const getTotalPointsForLevel = useCallback((level: number) => {
    let total = 0;
    for (let i = 1; i < level; i++) {
      total += getAdditionalPointsNeeded(i);
    }
    return total;
  }, [getAdditionalPointsNeeded]);

  // Calculate points needed for next level and progress
  useEffect(() => {
    const nextLevelTotal = getTotalPointsForLevel(currentLevel + 1);
    setPointsToNextLevel(Math.max(0, nextLevelTotal - score));
  }, [score, currentLevel, getTotalPointsForLevel]);

  // Level up logic: when score reaches next level threshold
  useEffect(() => {
    const nextLevelTotal = getTotalPointsForLevel(currentLevel + 1);
    if (score >= nextLevelTotal) {
      setCurrentLevel((prev) => prev + 1);
      setTimer(INITIAL_TIMER); // Reset timer to 120s
      setLevelUpBanner({ show: true, newLevel: currentLevel + 1 });
      setShowLevelUpPopup(true);
      setLevelUpPopupLevel(currentLevel + 1);
      setIsFrozen(true);
      setTimeout(() => setLevelUpBanner({ show: false, newLevel: 0 }), 5000);
      setTimeout(() => {
        setShowLevelUpPopup(false);
        setIsFrozen(false);
      }, 4000);
    }
  }, [score, currentLevel, getTotalPointsForLevel]);

  // On game over, update user profile if new level achieved
  const handleGameOver = async () => {
    // Prevent multiple calls
    if (submitting) {
      console.log('🔄 handleGameOver already in progress, skipping');
      return;
    }
    
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    
    // Check authentication first
    if (!apiService.isAuthenticated()) {
      console.warn('❌ User not authenticated - cannot post stats');
      setError('You must be signed in to save your game stats and missions.');
      setSubmitting(false);
      setGameOver(true);
      return;
    }
    
    console.log('🔐 Authentication check passed');
    console.log('🌐 API URL:', process.env.NEXT_PUBLIC_API_URL || 'https://api.wordflect.com');
    
    try {
      console.log('🎮 Game Over - Starting stats update...', {
        score,
        foundWords: foundWords.length,
        flectcoins,
        gems,
        currentLevel
      });

      // Calculate game stats for missions
      const gameStats = {
        id: userProfile?.id || 'unknown',
        score,
        words: foundWords,
        foundWords,
        // Do NOT include flectcoins in game stats - they should only come from mission completions
        gems,
        wordsFound: foundWords.length,
        longestWord: foundWords.reduce((longest, word) => word.length > longest.length ? word : longest, ''),
        gameCompleted: true,
        // Add more fields as needed for your backend
      };

      console.log('📊 Sending game stats to backend:', gameStats);

      // Update user stats first
      await apiService.updateUserStats(gameStats);
      console.log('✅ User stats updated successfully');

      // Do NOT update local flectcoins state here

      console.log('🎯 Checking missions for completion...', missions);

      // Check for completed missions and call completeMission for each
      const completedMissions = missions.filter(m => {
        const goalOrTarget = m.goal ?? m.target;
        if (!goalOrTarget || m.completed) {
          console.log(`❌ Mission ${m.id} skipped:`, { goalOrTarget, completed: m.completed });
          return false;
        }
        
        // Calculate new progress based on mission type
        let newProgress = m.progress;
        
        // Add progress based on current game stats
        if (m.type === 'words' || m.title?.toLowerCase().includes('word')) {
          newProgress += foundWords.length;
        } else if (m.type === 'score' || m.title?.toLowerCase().includes('score')) {
          newProgress += score;
        } else if (m.type === 'games' || m.title?.toLowerCase().includes('game')) {
          newProgress += 1; // One game completed
        } else {
          // Default: assume it's word-based mission
          newProgress += foundWords.length;
        }
        
        const willComplete = newProgress >= goalOrTarget;
        console.log(`🎯 Mission ${m.id} (${m.title || m.name}):`, {
          currentProgress: m.progress,
          newProgress,
          goalOrTarget,
          willComplete,
          type: m.type,
          title: m.title
        });
        
        return willComplete;
      });

      console.log('🏆 Missions to complete:', completedMissions.length);

      // Complete missions
      for (const mission of completedMissions) {
        try {
          console.log(`🏆 Completing mission: ${mission.id}`);
          const missionResponse = await apiService.completeMission({
            id: mission.id,
            missionId: mission.id,
            period: mission.period || mission.type || 'daily', // fallback to daily if not specified
          });
          console.log(`✅ Mission ${mission.id} completed successfully:`, missionResponse);
          // Optionally update local flectcoins here if backend returns new balance
          if (missionResponse && typeof missionResponse === 'object' && 'flectcoins' in missionResponse) {
            const newFlectcoins = (missionResponse as Record<string, unknown>).flectcoins;
            if (typeof newFlectcoins === 'number') {
              setFlectcoins(newFlectcoins);
            }
          }
        } catch (error) {
          console.error('❌ Failed to complete mission:', mission.id, error);
          // Optionally handle/report mission completion errors
        }
      }

      // Refetch missions to update state
      try {
        console.log('🔄 Refetching missions...');
        const data = await apiService.getMissions();
        console.log('📡 Raw missions response:', data);
        
        if (typeof data === 'object' && data !== null && 'missions' in data && Array.isArray((data as { missions?: unknown[] }).missions)) {
          setMissions((data as { missions: Mission[] }).missions);
        } else if (Array.isArray(data)) {
          setMissions(data as Mission[]);
        } else {
          setMissions([]);
        }
        console.log('✅ Missions refetched successfully');
      } catch (error) {
        console.error('❌ Failed to refetch missions:', error);
      }

      // Update profile if new level achieved
      if (userProfile && currentLevel > (userProfile.highestLevel || 1)) {
        console.log(`🏆 New level achieved: ${currentLevel} (previous: ${userProfile.highestLevel})`);
        await apiService.updateUserStats({ highestLevel: currentLevel });
      }
      
      setSuccess('Stats and missions updated!');
    } catch (e: unknown) {
      console.error('❌ Game over error:', e);
      setError((e as Error).message || "Failed to update stats");
    } finally {
      setSubmitting(false);
      setGameOver(true);
    }
  };

  // Auto-call handleGameOver when game ends (for any reason)
  const hasHandledGameOver = useRef(false);
  useEffect(() => {
    if (gameOver && !submitting && !hasHandledGameOver.current) {
      hasHandledGameOver.current = true;
      console.log('🎮 Game ended automatically - calling handleGameOver');
      handleGameOver();
    }
  }, [gameOver, submitting, handleGameOver]);

  // On replay, reset level and points
  const handleReplay = () => {
    resetRareLetterTracking(); // Reset rare letter tracking for new game
    setBoard(generateBoard());
    setSelected([]);
    setFoundWords([]);
    setScore(0);
    setCurrentLevel(1);
    setGameOver(false);
    setError(null);
    setSuccess(null);
    setTimer(INITIAL_TIMER);
    setInDangerZone(false);
    hasHandledGameOver.current = false; // Reset so next game can trigger
    if (dangerZoneTimeout.current) {
      clearTimeout(dangerZoneTimeout.current);
      dangerZoneTimeout.current = null;
    }
    console.log("Replay: timer reset to", INITIAL_TIMER);
  };

  // Helper to update backend flectcoins and gems after powerup use
  const syncCurrency = async (newFlectcoins: number, newGems: number) => {
    try {
      if (!apiService.isAuthenticated()) {
        console.warn("User not authenticated, skipping backend sync");
        return;
      }
      if (!userProfile) {
        console.warn("User profile not loaded, cannot sync currency");
        return;
      }
      // Prepare stats object with required fields for backend
      const updatedStats = {
        id: userProfile.id,
        score: score,
        words: foundWords,
        flectcoins: newFlectcoins,
        gems: newGems,
      };
      console.log("Attempting to sync currency with stats:", updatedStats);
      const result = await apiService.updateUserStats(updatedStats);
      console.log("Currency sync response:", result);
      
      // Update local profile state with new currency values
      setUserProfile(prev => prev ? { ...prev, flectcoins: newFlectcoins, gems: newGems } : null);
      console.log("Currency synced successfully:", { flectcoins: newFlectcoins, gems: newGems });
    } catch (e: unknown) {
      console.error("Currency sync error:", e);
      const errorMessage = (e as Error).message || "Failed to sync currency with backend. Please try again.";
      setPowerupError(errorMessage);
    }
  };

  // Hint: find a possible word (just pick the first 3+ letter word for now)
  const handleHint = () => {
    if (flectcoins < HINT_COST) {
      setPowerupError("Not enough flectcoins for Hint.");
      return;
    }
    const newFlectcoins = flectcoins - HINT_COST;
    setFlectcoins(newFlectcoins);
    setPowerupError(null);
    syncCurrency(newFlectcoins, gems);
    if (foundWords.length === GRID_ROWS * GRID_COLS) return;
    // Find a possible word (for now, just a random 3+ letter sequence)
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS - 2; c++) {
        const word = board[r][c] + board[r][c + 1] + board[r][c + 2];
        if (!foundWords.includes(word)) {
          setHintWord(word);
          setTimeout(() => setHintWord(null), 3000);
          return;
        }
      }
    }
  };

  const shuffleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Shuffle: randomize the board
  const handleShuffle = () => {
    if (flectcoins < SHUFFLE_COST) {
      setPowerupError("Not enough flectcoins for Shuffle.");
      return;
    }

    if (wordListLoading || !wordSet) {
      setPowerupError("Word list not ready. Please wait.");
      return;
    }

    try {
      const newFlectcoins = flectcoins - SHUFFLE_COST;
      setFlectcoins(newFlectcoins);
      setPowerupError(null);
      syncCurrency(newFlectcoins, gems);
      setIsShuffling(true);

      // Collect all existing letters from the board
      const existingLetters: string[] = [];
      board.forEach(row => {
        row.forEach(cell => {
          if (cell !== "") {
            existingLetters.push(cell);
          }
        });
      });

      // Shuffle the existing letters
      for (let i = existingLetters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [existingLetters[i], existingLetters[j]] = [existingLetters[j], existingLetters[i]];
      }

      // Pad with empty strings to fill the board
      while (existingLetters.length < GRID_ROWS * GRID_COLS) {
        existingLetters.unshift(""); // Add empty strings at the top
      }

      // Create new board from the shuffled letters
      const shuffledBoard: string[][] = [];
      for (let row = 0; row < GRID_ROWS; row++) {
        shuffledBoard.push(existingLetters.slice(row * GRID_COLS, (row + 1) * GRID_COLS));
      }

      // Reset rare letter tracking for shuffled board
      resetRareLetterTracking();
      shuffledBoard.forEach(row => {
        row.forEach(letter => {
          if (letter !== "") {
            const rareLetters = ['Z', 'Q', 'X', 'J', 'K', 'V'];
            if (rareLetters.includes(letter)) {
              rareLettersOnBoard.add(letter);
            }
          }
        });
      });

      // Defensive check
      const isValid = Array.isArray(shuffledBoard)
        && shuffledBoard.length === GRID_ROWS
        && shuffledBoard.every(row => Array.isArray(row) && row.length === GRID_COLS && row.every(cell => typeof cell === "string"));
      console.log("[SHUFFLE] Shuffled board valid:", isValid, shuffledBoard);

      if (!isValid) {
        throw new Error("Shuffled board is invalid");
      }

      if (shuffleTimeoutRef.current) {
        clearTimeout(shuffleTimeoutRef.current);
      }
      shuffleTimeoutRef.current = setTimeout(() => {
        setBoard(shuffledBoard);
        setIsShuffling(false);
      }, 500);
    } catch (error) {
      console.error("Shuffle error:", error);
      setIsShuffling(false);
      setPowerupError("Shuffle failed. Please try again.");
    }
  };

  // Freeze: disables the End Game button for 10 seconds (simulate freeze effect)
  const handleFreeze = () => {
    if (flectcoins < FREEZE_COST) {
      setPowerupError("Not enough flectcoins for Freeze.");
      return;
    }
    const newFlectcoins = flectcoins - FREEZE_COST;
    setFlectcoins(newFlectcoins);
    setPowerupError(null);
    syncCurrency(newFlectcoins, gems);
    setIsFrozen(true);
    if (freezeTimeout) clearTimeout(freezeTimeout);
    const timeout = setTimeout(() => setIsFrozen(false), 10000);
    setFreezeTimeout(timeout);
  };

  // Replace all uses of apiService.getWordDefinition(word) with local validation
  const isValidWord = (word: string) => {
    return word.length >= getMinimumWordLength(currentLevel) && wordSet?.has(word.toUpperCase());
  };

  // Show loading spinner if word list is not ready
  if (wordListLoading || !wordSet) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-white text-2xl">Loading word list...</div>
      </div>
    );
  }

  // Add sign out handler
  const handleSignOut = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    router.push('/signin');
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-black px-4 py-12">
        {/* Level Up Banner */}
        {levelUpBanner.show && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
            <div className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 text-black font-bold px-8 py-4 rounded-full shadow-2xl border-2 border-yellow-300 animate-bounce">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎉</span>
                <span className="text-lg">Level Up! You reached Level {levelUpBanner.newLevel}</span>
                <span className="text-2xl">🎉</span>
              </div>
            </div>
          </div>
        )}
        {/* Level Up Popup Modal */}
        {showLevelUpPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm animate-fade-in">
            <div className="relative bg-gradient-to-br from-gray-900/90 via-blue-900/90 to-purple-900/90 rounded-3xl shadow-2xl p-10 flex flex-col items-center gap-4 border-4 border-gradient-to-r from-blue-400 to-purple-500 animate-fade-in" style={{ minWidth: 340, maxWidth: 400 }}>
              {/* Confetti effect using emoji */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 flex gap-2 text-3xl select-none pointer-events-none animate-bounce-slow" style={{marginTop: -32}}>
                <span>🎉</span><span>🎊</span><span>✨</span><span>🎉</span><span>🎊</span>
              </div>
              <div className="text-6xl mb-2 drop-shadow-lg">🏆</div>
              <h2 className="text-3xl font-extrabold text-white tracking-wide text-center mb-2 drop-shadow-lg">Level Up!</h2>
              <div className="text-2xl font-bold text-blue-200 mb-1">You reached Level {levelUpPopupLevel}</div>
              <div className="text-lg text-blue-100 mb-2">Timer reset to <span className='font-bold text-white'>2:00</span></div>
            </div>
          </div>
        )}
        <div className="w-full max-w-2xl bg-black bg-opacity-80 rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-8 animate-fade-in">
          <div className="text-center mb-6">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-blue-100 tracking-wider mb-2 drop-shadow-lg">
              WORDFLECT
            </h1>
            <div className="w-24 h-1 bg-gradient-to-r from-blue-400 to-purple-400 mx-auto rounded-full"></div>
          </div>
          {gameOver ? (
            <div className="flex flex-col items-center w-full">
              {/* Confetti animation for high scores */}
              {score >= 50 && (
                <div className="absolute inset-0 pointer-events-none z-10 animate-fade-in">
                  {/* Simple confetti effect using emoji */}
                  <div className="w-full flex justify-center gap-2 text-3xl animate-bounce-slow select-none">
                    <span>🎉</span><span>🎊</span><span>🏆</span><span>🎉</span><span>🎊</span>
                  </div>
                </div>
              )}
              <div className="relative w-full max-w-2xl bg-gradient-to-br from-purple-900 via-blue-900 to-black bg-opacity-90 rounded-2xl shadow-2xl p-10 flex flex-col items-center gap-8 border-2 border-blue-700 animate-fade-in">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-5xl mb-2">🏆</span>
                  <h2 className="text-4xl font-extrabold text-white tracking-wide text-center mb-2 drop-shadow-lg">Game Over!</h2>
                </div>
                <div className="flex flex-col items-center gap-2 w-full">
                  <div className="flex flex-wrap gap-4 justify-center w-full">
                    <div className="flex flex-col items-center">
                      <span className="text-blue-200 text-lg">Score</span>
                      <span className="bg-blue-600 text-white font-bold text-2xl px-6 py-2 rounded-full shadow border border-blue-300">{score}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-blue-200 text-lg">Words Found</span>
                      <span className="bg-green-600 text-white font-bold text-2xl px-6 py-2 rounded-full shadow border border-green-300">{foundWords.length}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 justify-center w-full mt-4">
                    <div className="flex flex-col items-center">
                      <span className="text-blue-200 text-lg">Longest Word</span>
                      <span className="bg-purple-600 text-white font-bold text-xl px-4 py-1 rounded-full shadow border border-purple-300">{longestWord || "-"}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-blue-200 text-lg">Top Scoring Word</span>
                      <span className="bg-yellow-500 text-black font-bold text-xl px-4 py-1 rounded-full shadow border border-yellow-300">{topScoringWord || "-"}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-2 justify-center w-full">
                  {foundWords.map((w, i) => (
                    <span key={i} className="bg-blue-200 text-blue-800 px-3 py-1 rounded-full text-base font-semibold shadow border border-blue-300">{w}</span>
                  ))}
                </div>
                {loadingDefs ? (
                  <div className="text-blue-300 mb-2">Loading definitions...</div>
                ) : (
                  <div className="w-full max-w-lg mb-4">
                    {foundWords.map((w, i) => (
                      <div key={i} className="mb-2 flex items-center gap-2">
                        <span className="font-bold text-white bg-blue-700 px-2 py-1 rounded-full text-sm">{w}</span>
                        <span className="text-blue-100">{definitions[w]?.definition || "No definition found."}</span>
                        {definitions[w]?.attribution && (
                          <span className="text-xs text-gray-400 ml-2">{definitions[w].attribution}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="w-full max-w-lg mb-4">
                  <h2 className="text-xl font-bold text-white mb-2">Missions</h2>
                  {missionsLoading ? (
                    <div className="text-blue-300 mb-2">Loading missions...</div>
                  ) : missionsError ? (
                    <div className="text-red-400 mb-2">{missionsError}</div>
                  ) : Array.isArray(missions) && missions.length > 0 ? (
                    <ul className="mb-2">
                      {missions.map((mission, i) => (
                        <li key={mission.id || i} className="mb-1 text-blue-100">
                          <span className="font-bold text-white">{String(mission.title ?? mission.name ?? 'Mission')}:</span> {mission.progress ?? 0}/{mission.goal ?? mission.target ?? 0} {mission.completed ? <span className="text-green-400 ml-2">(Completed)</span> : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-blue-200">No missions found.</div>
                  )}
                </div>
                {success && <div className="text-green-400 mb-2">{success}</div>}
                {error && <div className="text-red-400 mb-2">{error}</div>}
                <div className="flex flex-wrap gap-4 justify-center w-full mt-2">
                  <button className="px-6 py-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold shadow-lg hover:scale-105 transition-all duration-150 text-lg" onClick={handleReplay}>Play Again</button>
                  <button className="px-6 py-2 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 text-black font-bold shadow-lg hover:scale-105 transition-all duration-150 text-lg" onClick={() => {
                    const shareText = `I scored ${score} in Wordflect! Longest word: ${longestWord}. Play at https://wordflect.com`;
                    if (navigator.share) {
                      navigator.share({ text: shareText });
                    } else {
                      navigator.clipboard.writeText(shareText);
                      alert("Copied to clipboard!");
                    }
                  }}>Share</button>
                  <button className="px-6 py-2 rounded-full bg-gradient-to-r from-red-500 to-red-700 text-white font-bold shadow-lg hover:scale-105 transition-all duration-150 text-lg flex items-center gap-2" onClick={handleSignOut}>
                    <span className="material-icons text-xl">logout</span> Sign Out
                  </button>
                  <button className="px-6 py-2 rounded-full bg-gradient-to-r from-green-400 to-green-600 text-white font-bold shadow-lg hover:scale-105 transition-all duration-150 text-lg" onClick={() => router.push('/profile')}>Profile</button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              {/* Modern Timer and Score UI */}
              <div className={`flex flex-col sm:flex-row items-center justify-between w-full max-w-md mx-auto mb-6 p-4 bg-gradient-to-r from-gray-900 via-black to-gray-900 rounded-2xl shadow-2xl border border-gray-700 transition-all duration-500 ${
                timer <= 30 ? 'shadow-red-500/20 ring-1 ring-red-500/30' : 
                timer <= 60 ? 'shadow-yellow-500/20 ring-1 ring-yellow-500/30' : ''
              }`}>
                {/* Timer Section */}
                <div className="flex flex-col items-center mb-4 sm:mb-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-icons text-red-400 text-xl">timer</span>
                    <span className="text-blue-200 text-sm font-medium uppercase tracking-wide">Time Left</span>
                  </div>
                  <div className="relative">
                    {/* Timer Circle Progress */}
                    <div className={`relative w-16 h-16 flex items-center justify-center ${
                      timer <= 30 ? 'animate-pulse' : ''
                    }`}>
                      <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                          className="text-gray-700"
                        />
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                          strokeDasharray={`${(timer / INITIAL_TIMER) * 175.93} 175.93`}
                          className={`transition-all duration-1000 ease-out ${
                            timer <= 30 ? 'text-red-500 animate-pulse' : 
                            timer <= 60 ? 'text-yellow-500' : 'text-green-500'
                          }`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`text-lg font-bold transition-all duration-300 ${
                          timer <= 30 ? 'text-red-400 scale-110' : 
                          timer <= 60 ? 'text-yellow-400 scale-105' : 'text-green-400'
                        }`}>
                          {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Level and Points to Next Level Section */}
                <div className="flex flex-col items-center mx-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-icons text-purple-400 text-xl">military_tech</span>
                    <span className="text-blue-200 text-sm font-medium uppercase tracking-wide">Level</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-300">{currentLevel}</div>
                  <div className="text-xs text-blue-100">Next: {pointsToNextLevel} pts</div>
                </div>
                {/* Score Section */}
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-icons text-yellow-400 text-xl">stars</span>
                    <span className="text-blue-200 text-sm font-medium uppercase tracking-wide">Score</span>
                  </div>
                  <div className="relative">
                    <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-bold text-2xl px-4 py-2 rounded-full shadow-lg border-2 border-yellow-300 min-w-[80px] text-center transition-all duration-300 hover:scale-105">
                      {score}
                    </div>
                    {/* Score animation indicator */}
                    {score > 0 && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-ping"></div>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-1 sm:gap-2 bg-gray-900 p-2 sm:p-4 rounded-lg shadow-lg max-w-md mx-auto">
                  {board.map((row, rowIdx) =>
                    row.map((cell, colIdx) => {
                      const isSelected = selected.some(sel => sel.row === rowIdx && sel.col === colIdx);
                      // Add pulse animation to filled cells in the top row
                      const isTopRow = rowIdx === 0 && cell !== "";
                      const letterPoints = cell ? LETTER_POINTS[cell as keyof typeof LETTER_POINTS] || 1 : 0;
                      return (
                        <button
                          key={`${rowIdx}-${colIdx}`}
                          className={`aspect-square w-full max-w-[60px] sm:max-w-[70px] rounded-lg flex flex-col items-center justify-center text-lg sm:text-2xl font-bold transition border-2 relative ${isSelected ? "bg-blue-400 text-white border-blue-600" : "bg-white text-gray-900 border-gray-300 hover:bg-blue-100"} ${isTopRow ? "animate-pulse ring-2 ring-red-400" : ""}`}
                          onClick={() => handleCellClick(rowIdx, colIdx)}
                        >
                          <span className="text-lg sm:text-2xl">{cell}</span>
                          {cell && (
                            <span className={`absolute bottom-1 right-1 text-xs font-bold ${isSelected ? "text-blue-100" : "text-gray-600"}`}>
                              {letterPoints}
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              <div className="mt-6 text-white text-lg flex items-center gap-2">
                <span className="font-semibold">Selected:</span>
                {selected.length === 0 ? (
                  <span className="text-gray-400 italic">None</span>
                ) : (
                  selected.map((sel, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-blue-600 text-white font-bold text-xl shadow-sm border border-blue-300"
                    >
                      {board[sel.row][sel.col]}
                    </span>
                  ))
                )}
              </div>
              {/* Powerup Buttons - Modern, Sleek Style */}
              <div className="mt-4 flex flex-wrap gap-3 justify-center">
                <button
                  className="flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-yellow-300 to-yellow-500 text-black font-bold shadow-md hover:from-yellow-400 hover:to-yellow-600 active:scale-95 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-yellow-400/60 disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={handleHint}
                  disabled={hintWord !== null || flectcoins < HINT_COST}
                  aria-label="Hint"
                >
                  <span className="material-icons text-lg">lightbulb</span> Hint ({HINT_COST})
                </button>
                <button
                  className="flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-pink-400 to-pink-600 text-white font-bold shadow-md hover:from-pink-500 hover:to-pink-700 active:scale-95 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-pink-400/60 disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={handleShuffle}
                  disabled={isShuffling || flectcoins < SHUFFLE_COST}
                  aria-label="Shuffle"
                >
                  <span className="material-icons text-lg">shuffle</span> Shuffle ({SHUFFLE_COST})
                </button>
                <button
                  className="flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-cyan-400 to-cyan-600 text-white font-bold shadow-md hover:from-cyan-500 hover:to-cyan-700 active:scale-95 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={handleFreeze}
                  disabled={isFrozen || flectcoins < FREEZE_COST}
                  aria-label="Freeze"
                >
                  <span className="material-icons text-lg">ac_unit</span> Freeze ({FREEZE_COST})
                </button>
              </div>
              {/* Improved Feedback UI - Pill/Badge Style with Icon */}
              <div className={`mt-4 flex justify-center min-h-[40px] transition-opacity duration-300 ${wordFeedback ? 'opacity-100' : 'opacity-0'}`}
                aria-live="polite"
              >
                {wordFeedback && (
                  <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full shadow-md font-semibold text-base
                    ${wordFeedback.includes('Good word!') ? 'bg-green-600 text-white' : ''}
                    ${wordFeedback.includes('Invalid word') ? 'bg-red-600 text-white' : ''}
                  `}>
                    <span className="material-icons text-lg">
                      {wordFeedback.includes('Good word!') ? 'check_circle' : wordFeedback.includes('Invalid word') ? 'cancel' : ''}
                    </span>
                    {wordFeedback}
                  </span>
                )}
              </div>
              {validatingWord && <div className="text-blue-300 mb-2">Validating word...</div>}
              {powerupError && <div className="mt-2 text-red-400 font-bold">{powerupError}</div>}
              {/* Modern Currency Display */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-4 p-3 bg-gradient-to-r from-gray-800 via-black to-gray-800 rounded-xl shadow-lg border border-gray-600 hover:shadow-xl hover:border-gray-500 transition-all duration-300">
                {/* Flectcoins */}
                <div className="flex items-center gap-2 hover:scale-105 transition-transform duration-200 cursor-pointer group">
                  <div className="relative">
                    <span className="material-icons text-yellow-400 text-xl group-hover:text-yellow-300 transition-colors">monetization_on</span>
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-yellow-200 text-xs font-medium uppercase tracking-wide group-hover:text-yellow-100 transition-colors">Flectcoins</span>
                    <span className="text-yellow-400 font-bold text-lg group-hover:text-yellow-300 transition-colors" key={flectcoins}>{flectcoins.toLocaleString()}</span>
                  </div>
                </div>

                {/* Divider */}
                <div className="hidden sm:block w-px h-8 bg-gray-600"></div>

                {/* Gems */}
                <div className="flex items-center gap-2 hover:scale-105 transition-transform duration-200 cursor-pointer group">
                  <div className="relative">
                    <span className="material-icons text-purple-400 text-xl group-hover:text-purple-300 transition-colors">diamond</span>
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-purple-200 text-xs font-medium uppercase tracking-wide group-hover:text-purple-100 transition-colors">Gems</span>
                    <span className="text-purple-400 font-bold text-lg group-hover:text-purple-300 transition-colors" key={gems}>{gems.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              {hintWord && <div className="mt-2 text-yellow-300 font-bold">Hint: Try &quot;{hintWord}&quot;</div>}
              <div className="mt-4 flex gap-3 justify-center">
                <button className="px-6 py-2 rounded-lg bg-gray-700 text-white font-bold shadow hover:scale-105 transition-all duration-150" onClick={() => setSelected([])}>Clear</button>
                <button className="px-6 py-2 rounded-lg bg-red-700 text-white font-bold shadow hover:scale-105 transition-all duration-150" onClick={handleGameOver} disabled={submitting || isFrozen}>End Game</button>
              </div>
              {inDangerZone && !gameOver && (
                <div className="text-red-400 font-bold mb-2 animate-pulse">Danger! Top row is full! (Debug: Danger zone active)</div>
              )}
              {gameOver && (
                <div className="text-red-400 font-bold mb-2">Game Over Triggered (Debug)</div>
              )}
            </div>
          )}
        </div>
        {/* wordListLoading && <div className="text-blue-300 mb-2">Loading word list...</div> */}
        {/* wordListError && <div className="text-red-400 mb-2">{wordListError}</div> */}
      </div>
    </ErrorBoundary>
  );
} 