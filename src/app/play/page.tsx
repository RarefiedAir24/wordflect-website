// Deployment trigger: row insertion fix (true row shifting, new row at bottom)
"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { apiService, UserProfile } from "@/services/api";
// import words from "../words.json";
import { useRouter } from "next/navigation";

// Define a Mission type for mission-related state and variables (mobile app v1.0.200)
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
  reward?: number;
  rewardType?: 'flectcoins' | 'gems';
  description?: string;
}

// Mission definitions (mobile app v1.0.200) - Used in Game Over screen
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DAILY_MISSIONS = [
  { id: 'play-1-game', title: 'Play 1 Game Today', target: 1, reward: 25, rewardType: 'flectcoins', type: 'games', period: 'daily' },
  { id: 'find-10-words', title: 'Find 10 Words', target: 10, reward: 10, rewardType: 'flectcoins', type: 'words', period: 'daily' },
  { id: 'find-15-words', title: 'Find 15 Words', target: 15, reward: 15, rewardType: 'flectcoins', type: 'words', period: 'daily' },
  { id: 'find-20-words', title: 'Find 20 Words', target: 20, reward: 20, rewardType: 'flectcoins', type: 'words', period: 'daily' },
  { id: 'find-25-words', title: 'Find 25 Words', target: 25, reward: 25, rewardType: 'flectcoins', type: 'words', period: 'daily' },
  { id: 'find-30-words', title: 'Find 30 Words', target: 30, reward: 30, rewardType: 'flectcoins', type: 'words', period: 'daily' },
  { id: 'find-40-words', title: 'Find 40 Words', target: 40, reward: 40, rewardType: 'flectcoins', type: 'words', period: 'daily' },
  { id: 'find-50-words', title: 'Find 50 Words', target: 50, reward: 50, rewardType: 'flectcoins', type: 'words', period: 'daily' },
  { id: 'find-10-words-4plus', title: 'Find 10 Words with 4+ Letters', target: 10, reward: 12, rewardType: 'flectcoins', type: 'words', period: 'daily', minLength: 4 },
  { id: 'find-10-words-5plus', title: 'Find 10 Words with 5+ Letters', target: 10, reward: 15, rewardType: 'flectcoins', type: 'words', period: 'daily', minLength: 5 },
  { id: 'find-10-words-6plus', title: 'Find 10 Words with 6+ Letters', target: 10, reward: 18, rewardType: 'flectcoins', type: 'words', period: 'daily', minLength: 6 },
  { id: 'find-10-words-7plus', title: 'Find 10 Words with 7+ Letters', target: 10, reward: 22, rewardType: 'flectcoins', type: 'words', period: 'daily', minLength: 7 },
  { id: 'find-10-words-8plus', title: 'Find 10 Words with 8+ Letters', target: 10, reward: 26, rewardType: 'flectcoins', type: 'words', period: 'daily', minLength: 8 },
  { id: 'find-5-words-8plus', title: 'Find 5 Words with 8+ Letters', target: 5, reward: 15, rewardType: 'flectcoins', type: 'words', period: 'daily', minLength: 8 },
  { id: 'word-of-the-day', title: 'Find the Word of the Day', target: 1, reward: 100, rewardType: 'gems', type: 'special', period: 'daily' }
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const WEEKLY_MISSIONS = [ // Used in Game Over screen
  { id: 'play-5-games-week', title: 'Play 5 Games', target: 5, reward: 50, rewardType: 'flectcoins', type: 'games', period: 'weekly' },
  { id: 'find-50-words-week', title: 'Find 50 Words', target: 50, reward: 75, rewardType: 'flectcoins', type: 'words', period: 'weekly' },
  { id: 'score-500-points-week', title: 'Score 500 Points', target: 500, reward: 100, rewardType: 'flectcoins', type: 'score', period: 'weekly' },
  { id: 'find-10-long-words-week', title: 'Find 10 Long Words', target: 10, reward: 125, rewardType: 'flectcoins', type: 'words', period: 'weekly', minLength: 8 },
  { id: 'complete-5-games-no-hints-week', title: 'Complete 5 Games Without Hints', target: 5, reward: 200, rewardType: 'flectcoins', type: 'games', period: 'weekly', noHints: true },
  { id: 'play-every-day-week', title: 'Play Every Day', target: 7, reward: 300, rewardType: 'flectcoins', type: 'streak', period: 'weekly' },
  { id: 'score-1000-points-week', title: 'Score 1000 Points', target: 1000, reward: 150, rewardType: 'flectcoins', type: 'score', period: 'weekly' },
  { id: 'word-of-the-day-streak-week', title: 'Find the Word of the Day 7 Days in a Row', target: 7, reward: 500, rewardType: 'gems', type: 'streak', period: 'weekly' }
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const GLOBAL_MISSIONS = [ // Used in Game Over screen
  { id: 'reach-level-10', title: 'Reach Level 10', target: 10, reward: 2000, rewardType: 'flectcoins', type: 'level', period: 'global' },
  { id: 'reach-level-25', title: 'Reach Level 25', target: 25, reward: 5000, rewardType: 'flectcoins', type: 'level', period: 'global' },
  { id: 'reach-level-50', title: 'Reach Level 50', target: 50, reward: 10000, rewardType: 'flectcoins', type: 'level', period: 'global' },
  { id: 'play-100-games', title: 'Play 100 Games', target: 100, reward: 5000, rewardType: 'flectcoins', type: 'games', period: 'global' },
  { id: 'find-1000-words', title: 'Find 1000 Words', target: 1000, reward: 8000, rewardType: 'flectcoins', type: 'words', period: 'global' },
  { id: 'find-5000-words', title: 'Find 5000 Words', target: 5000, reward: 25000, rewardType: 'flectcoins', type: 'words', period: 'global' },
  { id: 'score-10000-points', title: 'Score 10000 Points', target: 10000, reward: 15000, rewardType: 'flectcoins', type: 'score', period: 'global' },
  { id: 'maintain-7-day-login-streak', title: 'Maintain 7-Day Login Streak', target: 7, reward: 1000, rewardType: 'flectcoins', type: 'streak', period: 'global' }
];

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

const GRID_COLS = 8;
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
// This function is kept for compatibility but is no longer used directly
// function generateRandomLetterWithGuardrails(): string {
//   return drawLetterFromBagWithBoardCheck([], 0, 0);
// }

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

// Handle letter falling when words are formed
function applyLetterFalling(board: string[][]): string[][] {
  const newBoard = board.map(row => [...row]);
  
  // For each column, move letters down to fill empty spaces
  for (let col = 0; col < GRID_COLS; col++) {
    const column = [];
    
    // Collect all non-empty letters in this column
    for (let row = 0; row < GRID_ROWS; row++) {
      if (newBoard[row][col] !== "") {
        column.push(newBoard[row][col]);
      }
    }
    
    // Clear the column
    for (let row = 0; row < GRID_ROWS; row++) {
      newBoard[row][col] = "";
    }
    
    // Place letters at the bottom of the column
    for (let i = 0; i < column.length; i++) {
      newBoard[GRID_ROWS - 1 - i][col] = column[column.length - 1 - i];
    }
  }
  
  return newBoard;
}

// Check if a vertical column is completely empty and should be cleared
function checkVerticalColumnClearing(board: string[][]): { clearedColumns: number[], newBoard: string[][] } {
  const clearedColumns: number[] = [];
  const newBoard = board.map(row => [...row]);
  
  // Check each column for complete emptiness
  for (let col = 0; col < GRID_COLS; col++) {
    let isEmpty = true;
    for (let row = 0; row < GRID_ROWS; row++) {
      if (newBoard[row][col] !== "") {
        isEmpty = false;
        break;
      }
    }
    
    if (isEmpty) {
      clearedColumns.push(col);
    }
  }
  
  // If columns were cleared, apply board constricting
  if (clearedColumns.length > 0) {
    return applyBoardConstricting(newBoard, clearedColumns);
  }
  
  return { clearedColumns, newBoard };
}

// Apply board constricting - move outside rows inward when vertical columns are cleared
function applyBoardConstricting(board: string[][], clearedColumns: number[]): { clearedColumns: number[], newBoard: string[][] } {
  const newBoard = board.map(row => [...row]);
  
  // Sort cleared columns to process from outside inward
  const sortedClearedColumns = [...clearedColumns].sort((a, b) => {
    const distanceA = Math.min(a, GRID_COLS - 1 - a);
    const distanceB = Math.min(b, GRID_COLS - 1 - b);
    return distanceA - distanceB;
  });
  
  // For each cleared column, move rows inward
  for (const clearedCol of sortedClearedColumns) {
    // Determine which side to move from (closer to edge)
    const distanceFromLeft = clearedCol;
    const distanceFromRight = GRID_COLS - 1 - clearedCol;
    
    if (distanceFromLeft <= distanceFromRight) {
      // Move from left side
      for (let col = clearedCol; col > 0; col--) {
        for (let row = 0; row < GRID_ROWS; row++) {
          newBoard[row][col] = newBoard[row][col - 1];
        }
      }
      // Clear the leftmost column
      for (let row = 0; row < GRID_ROWS; row++) {
        newBoard[row][0] = "";
      }
    } else {
      // Move from right side
      for (let col = clearedCol; col < GRID_COLS - 1; col++) {
        for (let row = 0; row < GRID_ROWS; row++) {
          newBoard[row][col] = newBoard[row][col + 1];
        }
      }
      // Clear the rightmost column
      for (let row = 0; row < GRID_ROWS; row++) {
        newBoard[row][GRID_COLS - 1] = "";
      }
    }
  }
  
  return { clearedColumns, newBoard };
}

function generateBoard() {
  resetRareLetterTracking();
  const board = Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => "")
  );
  
  // Fill the entire 8x8 board with letters (prepopulated system)
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      board[row][col] = drawLetterFromBagWithBoardCheck(board, row, col);
    }
  }
  
  console.log("Generated prepopulated board:", board);
  console.log("Rare letters on board:", Array.from(rareLettersOnBoard));
  return board;
}

// Prepopulated board system with board constricting mechanics
// When words are found, letters fall down and empty vertical columns cause board constriction

// Helper to check if board is too sparse for gameplay (for future implementation)
// function isBoardTooSparse(board: string[][]) {
//   const total = GRID_ROWS * GRID_COLS;
//   const filled = board.flat().filter(cell => cell !== "").length;
//   return (filled / total) < 0.1; // Game over if less than 10% of letters remain
// }

// Perfect Clear System - Check if only 1 row remains with letters (for future implementation)
// function checkPerfectClearCondition(board: string[][]): boolean {
//   const filledRows = board.filter(row => row.some(cell => cell !== "")).length;
//   return filledRows === 1;
// }

// Generate confetti for Perfect Clear celebration (for future implementation)
// function generatePerfectClearConfetti(): Array<{id: number, x: number, y: number, color: string}> {
//   const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
//   return Array.from({ length: 50 }, (_, i) => ({
//     id: i,
//     x: Math.random() * 100,
//     y: Math.random() * 100,
//     color: colors[Math.floor(Math.random() * colors.length)]
//   }));
// }

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

// Mobile App Scoring System (v1.0.200)
const LETTER_POINTS = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10
};

function calculateWordScore(word: string, level: number): number {
  // Calculate letter score (Scrabble-style point values)
  const letterScore = word.split('').reduce((total, letter) => {
    return total + (LETTER_POINTS[letter as keyof typeof LETTER_POINTS] || 1);
  }, 0);
  
  // Add level bonus: Math.floor(baseScore * (level - 1) * 0.1)
  const levelBonus = Math.floor(letterScore * (level - 1) * 0.1);
  
  return letterScore + levelBonus;
}

// Mobile App Level Progression System
function getAdditionalPointsNeeded(level: number): number {
  return Math.floor(25 * Math.pow(1.15, level - 1));
}

function getTotalPointsForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += getAdditionalPointsNeeded(i);
  }
  return total;
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
  const [definitions] = useState<Record<string, { definition: string; attribution?: string }>>({});
  const [loadingDefs, setLoadingDefs] = useState(false);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [missionsLoading, setMissionsLoading] = useState(false);
  const [missionsError, setMissionsError] = useState<string | null>(null);
  const [hintWord, setHintWord] = useState<string | null>(null);
  const [isShuffling, setIsShuffling] = useState(false);
  const [letterSwapActive, setLetterSwapActive] = useState(false);
  const [swapSelection, setSwapSelection] = useState<{row: number, col: number} | null>(null);
  const [flectcoins, setFlectcoins] = useState(150); // Mobile app starting balance
  const [flectcoinsSpentThisGame, setFlectcoinsSpentThisGame] = useState(0); // Track flectcoins spent in current game only
  const [gems, setGems] = useState(0);
  const [powerupError, setPowerupError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [levelUpBanner, setLevelUpBanner] = useState<{ show: boolean; newLevel: number }>({ show: false, newLevel: 0 });
  const [previousLevel, setPreviousLevel] = useState<number>(0);
  // Popup for level up
  const [showLevelUpPopup, setShowLevelUpPopup] = useState(false);
  const [levelUpPopupLevel, setLevelUpPopupLevel] = useState(0);
  
  // Perfect Clear System (for future implementation)
  // const [perfectClearCount, setPerfectClearCount] = useState(0);
  // const [showPerfectClearCelebration, setShowPerfectClearCelebration] = useState(false);
  // const [perfectClearConfetti, setPerfectClearConfetti] = useState<Array<{id: number, x: number, y: number, color: string}>>([]);

  // Remove all wordSet and wordList logic
  const [wordFeedback, setWordFeedback] = useState<string | null>(null);
  const [validatingWord] = useState(false);
  const [wordSet, setWordSet] = useState<Set<string> | null>(null);
  const [wordListLoading, setWordListLoading] = useState(true);

  // Powerup costs (mobile app v1.0.200)
  const HINT_COST = 25;
  const SHUFFLE_COST = 40;
  const LETTER_SWAP_COST = 60;

  // Compute longest word and top scoring word
  const longestWord = foundWords.reduce((a, b) => (b.length > a.length ? b : a), "");
  // const topScoringWord = longestWord; // For now, score = length (for future use)

  const INITIAL_TIMER = 120;
  const [timer, setTimer] = useState(INITIAL_TIMER); // 2 minutes
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const latestBoardRef = useRef<string[][]>(emptyBoard);
  useEffect(() => { latestBoardRef.current = board; }, [board]);

  // Prepopulated board system with board constricting mechanics

  // Game over is determined by timer or when board becomes too sparse

  // Start and manage the timer
  useEffect(() => {
    if (gameOver || validatingWord) return;
    // Timer continues during letter swap
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
  }, [gameOver, timer, validatingWord]);

  // Reset timer on replay
  useEffect(() => {
    if (!gameOver && timer === 0) setTimer(INITIAL_TIMER);
  }, [gameOver, timer]);

  // Prepopulated board game over logic: check if board becomes too sparse
  useEffect(() => {
    if (gameOver) return;
    
    // Don't check sparsity until the board has been populated with letters
    // This prevents immediate game over when starting with an empty board
    const totalCells = GRID_ROWS * GRID_COLS;
    const remainingLetters = board.flat().filter(cell => cell !== "").length;
    const sparsityThreshold = 0.1; // Game over if less than 10% of letters remain
    
    // Only check sparsity if the board was previously populated (has some letters)
    // This prevents the initial empty board from triggering game over
    const hasBeenPopulated = board.some(row => row.some(cell => cell !== ""));
    
    if (hasBeenPopulated && remainingLetters / totalCells < sparsityThreshold) {
      console.log("[GAME OVER] Board too sparse - not enough letters to form words");
      setGameOver(true);
    }
  }, [board, gameOver]);

  // Fetch definitions for all found words at game over (disabled to fix API errors)
  useEffect(() => {
    if (!gameOver || foundWords.length === 0) return;
    // Temporarily disabled to avoid API errors - will re-enable when API is fixed
    setLoadingDefs(false);
  }, [gameOver, foundWords]);

  // Fetch missions at game start
  useEffect(() => {
    let isMounted = true;
    setMissionsLoading(true);
    setMissionsError(null);
    
    // Check authentication before fetching missions
    if (!apiService.isAuthenticated()) {
      console.warn("User not authenticated - skipping missions fetch");
      setMissionsLoading(false);
      setMissionsError("Please sign in to view missions");
      return;
    }
    
    // Check if user profile exists
    if (!userProfile || !userProfile.id) {
      console.warn("User profile not loaded - skipping missions fetch");
      setMissionsLoading(false);
      setMissionsError("Loading user profile...");
      return;
    }
    
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
        if (isMounted) {
          console.error("Missions fetch error:", e);
          // Handle specific error cases
          if (e.message && (e.message.includes("Forbidden") || e.message.includes("403"))) {
            setMissionsError("Access denied. Please sign in again.");
          } else if (e.message && (e.message.includes("Authentication failed") || e.message.includes("Session expired"))) {
            setMissionsError("Session expired. Please sign in again.");
          } else if (e.message && e.message.includes("401")) {
            setMissionsError("Session expired. Please sign in again.");
          } else if (e.message && e.message.includes("Unauthorized")) {
            setMissionsError("Please sign in to view missions");
          } else {
            setMissionsError("Unable to load missions. Please try again later.");
          }
        }
      })
      .finally(() => {
        if (isMounted) setMissionsLoading(false);
      });
    return () => { isMounted = false; };
  }, [userProfile]);

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
          const userFlectcoins = profile.flectcoins || 0;
          setFlectcoins(userFlectcoins);
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
        const newBoard = generateBoard();
        console.log("Generated initial board:", newBoard);
        setBoard(newBoard);
      })
      .catch((error: unknown) => {
        console.error("Failed to load word list:", error);
        setWordListLoading(false);
        // Still generate board even if word list fails
        const newBoard = generateBoard();
        console.log("Generated fallback board:", newBoard);
        setBoard(newBoard);
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
    
    // Handle letter swap mode first
    if (letterSwapActive) {
      handleLetterSwapClick(row, col);
      return;
    }
    
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
            // Apply letter falling to fill empty spaces
            const boardAfterFalling = applyLetterFalling(newBoard);
            // Check for vertical column clearing and apply board constricting
            const { newBoard: finalBoard } = checkVerticalColumnClearing(boardAfterFalling);
            return finalBoard;
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
            // Apply letter falling to fill empty spaces
            const boardAfterFalling = applyLetterFalling(newBoard);
            // Check for vertical column clearing and apply board constricting
            const { newBoard: finalBoard } = checkVerticalColumnClearing(boardAfterFalling);
            return finalBoard;
          });
        } else {
          setWordFeedback("Invalid word");
          setTimeout(() => setWordFeedback(null), 1200);
        }
        setSelected([]);
      }
    }, 1000); // 1 second auto-submit to match mobile app
  };

  // Clear auto-submit timer on unmount
  useEffect(() => {
    return () => {
      if (autoSubmitTimeout.current) clearTimeout(autoSubmitTimeout.current);
    };
  }, []);

  // Level progression helpers (mobile app system) - for future use
  // const getAdditionalPointsNeededCallback = useCallback((level: number) => {
  //   return getAdditionalPointsNeeded(level);
  // }, []);

  // const getTotalPointsForLevelCallback = useCallback((level: number) => {
  //   return getTotalPointsForLevel(level);
  // }, []);

  // Calculate points needed for next level and progress (mobile app system)
  useEffect(() => {
    const nextLevelTotal = getTotalPointsForLevel(currentLevel + 1);
    setPointsToNextLevel(Math.max(0, nextLevelTotal - score));
  }, [score, currentLevel]);

  // Level up logic: when score reaches next level threshold (mobile app system)
  useEffect(() => {
    const nextLevelTotal = getTotalPointsForLevel(currentLevel + 1);
    if (score >= nextLevelTotal) {
      setCurrentLevel((prev) => prev + 1);
      setLevelUpBanner({ show: true, newLevel: currentLevel + 1 });
      setShowLevelUpPopup(true);
      setLevelUpPopupLevel(currentLevel + 1);
      setTimeout(() => setLevelUpBanner({ show: false, newLevel: 0 }), 5000);
      setTimeout(() => {
        setShowLevelUpPopup(false);
      }, 4000);
    }
  }, [score, currentLevel]);

  // On game over, update user profile if new level achieved
  const handleGameOver = useCallback(async () => {
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

      // Calculate final flectcoins balance: start with current balance, deduct spent, add mission rewards
      let finalFlectcoins = flectcoins; // Current balance after power-ups
      let totalMissionRewards = 0;

      // Complete missions and track rewards
      for (const mission of completedMissions) {
        try {
          console.log(`🏆 Completing mission: ${mission.id}`);
          const missionResponse = await apiService.completeMission({
            id: mission.id,
            missionId: mission.id,
            period: mission.period || mission.type || 'daily', // fallback to daily if not specified
          });
          console.log(`✅ Mission ${mission.id} completed successfully:`, missionResponse);
          
          // Track mission rewards
          if (mission.rewardType === 'flectcoins' && mission.reward) {
            totalMissionRewards += mission.reward;
            console.log(`💰 Mission ${mission.id} reward: ${mission.reward} flectcoins`);
          }
          
          // Update local flectcoins if backend returns new balance
          if (missionResponse && typeof missionResponse === 'object' && 'flectcoins' in missionResponse) {
            const newFlectcoins = (missionResponse as Record<string, unknown>).flectcoins;
            if (typeof newFlectcoins === 'number') {
              finalFlectcoins = newFlectcoins;
            }
          }
        } catch (error) {
          console.error('❌ Failed to complete mission:', mission.id, error);
          // Optionally handle/report mission completion errors
        }
      }

      // Update local flectcoins state with final balance
      setFlectcoins(finalFlectcoins);
      console.log(`💰 Final flectcoins calculation:`, {
        spentThisGame: flectcoinsSpentThisGame,
        missionRewards: totalMissionRewards,
        finalBalance: finalFlectcoins
      });

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
  }, [submitting, userProfile, score, foundWords, flectcoins, gems, currentLevel, missions, flectcoinsSpentThisGame]);

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
    hasHandledGameOver.current = false; // Reset so next game can trigger
    setFlectcoinsSpentThisGame(0); // Reset flectcoins spent tracking for new game
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

  // Hint: find a valid word that can be formed on the board
  const handleHint = () => {
    if (flectcoins < HINT_COST) {
      setPowerupError("Not enough flectcoins for Hint.");
      return;
    }
    
    const newFlectcoins = flectcoins - HINT_COST;
    setFlectcoins(newFlectcoins);
    setFlectcoinsSpentThisGame(prev => prev + HINT_COST); // Track spending in current game
    setPowerupError(null);
    syncCurrency(newFlectcoins, gems);
    
    if (foundWords.length === GRID_ROWS * GRID_COLS) {
      setPowerupError("Board is full!");
      return;
    }
    
    // Find a valid word that can be formed on the board
    const possibleWords: string[] = [];
    
    // Check horizontal words (left to right)
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS - 2; c++) {
        const word = board[r][c] + board[r][c + 1] + board[r][c + 2];
        if (word.length >= getMinimumWordLength(currentLevel) && 
            !foundWords.includes(word) && 
            wordSet?.has(word.toUpperCase())) {
          possibleWords.push(word);
        }
      }
    }
    
    // Check vertical words (top to bottom)
    for (let r = 0; r < GRID_ROWS - 2; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const word = board[r][c] + board[r + 1][c] + board[r + 2][c];
        if (word.length >= getMinimumWordLength(currentLevel) && 
            !foundWords.includes(word) && 
            wordSet?.has(word.toUpperCase())) {
          possibleWords.push(word);
        }
      }
    }
    
    // Check diagonal words (top-left to bottom-right)
    for (let r = 0; r < GRID_ROWS - 2; r++) {
      for (let c = 0; c < GRID_COLS - 2; c++) {
        const word = board[r][c] + board[r + 1][c + 1] + board[r + 2][c + 2];
        if (word.length >= getMinimumWordLength(currentLevel) && 
            !foundWords.includes(word) && 
            wordSet?.has(word.toUpperCase())) {
          possibleWords.push(word);
        }
      }
    }
    
    // Check diagonal words (top-right to bottom-left)
    for (let r = 0; r < GRID_ROWS - 2; r++) {
      for (let c = 2; c < GRID_COLS; c++) {
        const word = board[r][c] + board[r + 1][c - 1] + board[r + 2][c - 2];
        if (word.length >= getMinimumWordLength(currentLevel) && 
            !foundWords.includes(word) && 
            wordSet?.has(word.toUpperCase())) {
          possibleWords.push(word);
        }
      }
    }
    
    if (possibleWords.length > 0) {
      // Pick a random valid word from the list
      const randomWord = possibleWords[Math.floor(Math.random() * possibleWords.length)];
      setHintWord(randomWord);
      setTimeout(() => setHintWord(null), 5000); // Show hint for 5 seconds
      console.log(`[HINT] Found ${possibleWords.length} possible words, showing: ${randomWord}`);
    } else {
      setPowerupError("No valid words found on the board.");
      // Refund the flectcoins since no hint was found
      setFlectcoins(flectcoins);
      syncCurrency(flectcoins, gems);
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
      setFlectcoinsSpentThisGame(prev => prev + SHUFFLE_COST); // Track spending in current game
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

  // Letter Swap: allows swapping two letters on the board
  const handleLetterSwap = () => {
    if (flectcoins < LETTER_SWAP_COST) {
      setPowerupError("Not enough flectcoins for Letter Swap.");
      return;
    }
    const newFlectcoins = flectcoins - LETTER_SWAP_COST;
    setFlectcoins(newFlectcoins);
    setFlectcoinsSpentThisGame(prev => prev + LETTER_SWAP_COST); // Track spending in current game
    setPowerupError(null);
    syncCurrency(newFlectcoins, gems);
    setLetterSwapActive(true);
    setSwapSelection(null);
  };

  // Handle letter selection for changing to any letter A-Z
  const handleLetterSwapClick = (row: number, col: number) => {
    if (!letterSwapActive) return;
    
    // Select the tile to change
    setSwapSelection({ row, col });
  };

  // Handle letter selection from A-Z picker
  const handleLetterChange = (newLetter: string) => {
    if (!swapSelection) return;
    
    // Change the selected tile to the new letter
    const newBoard = board.map(row => [...row]);
    newBoard[swapSelection.row][swapSelection.col] = newLetter;
    setBoard(newBoard);
    
    // Exit swap mode
    setLetterSwapActive(false);
    setSwapSelection(null);
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
                <div className="flex flex-col items-center gap-4 w-full">
                  {/* Main Stats */}
                  <div className="flex flex-wrap gap-4 justify-center w-full">
                    <div className="flex flex-col items-center">
                      <span className="text-blue-200 text-lg">Final Score</span>
                      <span className="bg-blue-600 text-white font-bold text-2xl px-6 py-2 rounded-full shadow border border-blue-300">{score}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-blue-200 text-lg">Words Found</span>
                      <span className="bg-green-600 text-white font-bold text-2xl px-6 py-2 rounded-full shadow border border-green-300">{foundWords.length}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-blue-200 text-lg">Level Reached</span>
                      <span className="bg-purple-600 text-white font-bold text-2xl px-6 py-2 rounded-full shadow border border-purple-300">{currentLevel}</span>
                    </div>
                  </div>
                  
                  {/* Word Stats */}
                  <div className="flex flex-wrap gap-4 justify-center w-full">
                    <div className="flex flex-col items-center">
                      <span className="text-blue-200 text-lg">Longest Word</span>
                      <span className="bg-purple-600 text-white font-bold text-xl px-4 py-1 rounded-full shadow border border-purple-300">{longestWord || "-"}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-blue-200 text-lg">Average Word Length</span>
                      <span className="bg-yellow-500 text-black font-bold text-xl px-4 py-1 rounded-full shadow border border-yellow-300">
                        {foundWords.length > 0 ? (foundWords.reduce((sum, word) => sum + word.length, 0) / foundWords.length).toFixed(1) : "-"}
                      </span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-blue-200 text-lg">Time Played</span>
                      <span className="bg-red-600 text-white font-bold text-xl px-4 py-1 rounded-full shadow border border-red-300">
                        {Math.floor((INITIAL_TIMER - timer) / 60)}:{(INITIAL_TIMER - timer) % 60 < 10 ? '0' : ''}{(INITIAL_TIMER - timer) % 60}
                      </span>
                    </div>
                  </div>

                  {/* Power-up Usage */}
                  <div className="flex flex-wrap gap-4 justify-center w-full">
                    <div className="flex flex-col items-center">
                      <span className="text-blue-200 text-lg">Flectcoins Spent</span>
                      <span className="bg-yellow-600 text-white font-bold text-xl px-4 py-1 rounded-full shadow border border-yellow-300">
                        {flectcoinsSpentThisGame}
                      </span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-blue-200 text-lg">Remaining Flectcoins</span>
                      <span className="bg-yellow-500 text-black font-bold text-xl px-4 py-1 rounded-full shadow border border-yellow-300">
                        {flectcoins}
                      </span>
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
                  <h2 className="text-xl font-bold text-white mb-2">Mission Progress</h2>
                  {missionsLoading ? (
                    <div className="text-blue-300 mb-2">Loading missions...</div>
                  ) : missionsError ? (
                    <div className="text-red-400 mb-2">
                      {missionsError}
                      {missionsError.includes("Access denied") && (
                        <div className="text-sm text-gray-400 mt-1">
                          Try signing out and signing back in.
                        </div>
                      )}
                      <button 
                        onClick={() => {
                          setMissionsError(null);
                          setMissionsLoading(true);
                          // Retry missions fetch
                          if (apiService.isAuthenticated() && userProfile?.id) {
                            apiService.getMissions()
                              .then((data) => {
                                if (typeof data === 'object' && data !== null && 'missions' in data && Array.isArray((data as { missions?: unknown[] }).missions)) {
                                  setMissions((data as { missions: Mission[] }).missions);
                                } else if (Array.isArray(data)) {
                                  setMissions(data as Mission[]);
                                } else {
                                  setMissions([]);
                                }
                              })
                              .catch((e) => {
                                console.error("Missions retry error:", e);
                                setMissionsError("Unable to load missions. Please try again later.");
                              })
                              .finally(() => {
                                setMissionsLoading(false);
                              });
                          }
                        }}
                        className="mt-2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  ) : Array.isArray(missions) && missions.length > 0 ? (
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-yellow-300">Daily Missions</h3>
                      {missions.filter(m => m.period === 'daily').slice(0, 3).map((mission, i) => (
                        <div key={mission.id || i} className="flex justify-between items-center bg-gray-800 p-2 rounded">
                          <span className="text-blue-100 text-sm">{mission.title}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-white text-sm">{mission.progress ?? 0}/{mission.goal ?? mission.target ?? 0}</span>
                            {mission.completed ? <span className="text-green-400 text-sm">✓</span> : null}
                          </div>
                        </div>
                      ))}
                      <h3 className="text-lg font-semibold text-purple-300 mt-3">Weekly Missions</h3>
                      {missions.filter(m => m.period === 'weekly').slice(0, 2).map((mission, i) => (
                        <div key={mission.id || i} className="flex justify-between items-center bg-gray-800 p-2 rounded">
                          <span className="text-blue-100 text-sm">{mission.title}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-white text-sm">{mission.progress ?? 0}/{mission.goal ?? mission.target ?? 0}</span>
                            {mission.completed ? <span className="text-green-400 text-sm">✓</span> : null}
                          </div>
                        </div>
                      ))}
                      <h3 className="text-lg font-semibold text-green-300 mt-3">Global Missions</h3>
                      {missions.filter(m => m.period === 'global').slice(0, 2).map((mission, i) => (
                        <div key={mission.id || i} className="flex justify-between items-center bg-gray-800 p-2 rounded">
                          <span className="text-blue-100 text-sm">{mission.title}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-white text-sm">{mission.progress ?? 0}/{mission.goal ?? mission.target ?? 0}</span>
                            {mission.completed ? <span className="text-green-400 text-sm">✓</span> : null}
                          </div>
                        </div>
                      ))}
                    </div>
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
              <div className="grid grid-cols-8 gap-1 sm:gap-2 bg-gray-900 p-2 sm:p-4 rounded-lg shadow-lg max-w-2xl mx-auto">
                  {board.map((row, rowIdx) =>
                    row.map((cell, colIdx) => {
                      const isSelected = selected.some(sel => sel.row === rowIdx && sel.col === colIdx);
                      const letterPoints = cell ? LETTER_POINTS[cell as keyof typeof LETTER_POINTS] || 1 : 0;
                      
                      // Letter swap mode styling
                      const isSwapSelected = swapSelection && swapSelection.row === rowIdx && swapSelection.col === colIdx;
                      const isSwapMode = letterSwapActive;
                      
                      return (
                        <button
                          key={`${rowIdx}-${colIdx}`}
                          className={`aspect-square w-full max-w-[45px] sm:max-w-[55px] rounded-lg flex flex-col items-center justify-center text-sm sm:text-lg font-bold transition border-2 relative ${
                            isSelected ? "bg-blue-400 text-white border-blue-600" : 
                            isSwapSelected ? "bg-cyan-400 text-white border-cyan-600" :
                            isSwapMode ? "bg-white text-gray-900 border-gray-300 hover:bg-cyan-100 cursor-pointer" :
                            "bg-white text-gray-900 border-gray-300 hover:bg-blue-100"
                          }`}
                          onClick={() => handleCellClick(rowIdx, colIdx)}
                        >
                          {/* Main letter - larger and more prominent */}
                          <span className="text-lg sm:text-xl font-extrabold leading-none">{cell}</span>
                          {/* Point value - smaller and positioned at bottom */}
                          {cell && (
                            <span
                              className="absolute bottom-0.5 right-0.5 text-xs font-bold flex items-center justify-center rounded-full shadow-sm border border-gray-400 bg-gray-200 text-gray-700 w-4 h-4 sm:w-5 sm:h-5 select-none pointer-events-none"
                              style={{
                                fontSize: '0.6rem',
                                lineHeight: '1rem',
                                minWidth: '1rem',
                                minHeight: '1rem',
                                padding: 0,
                                zIndex: 1,
                              }}
                            >
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
                  onClick={handleLetterSwap}
                  disabled={letterSwapActive || flectcoins < LETTER_SWAP_COST}
                  aria-label="Letter Swap"
                >
                  <span className="material-icons text-lg">swap_horiz</span> Letter Swap ({LETTER_SWAP_COST})
                </button>
              </div>
              {/* Letter Swap Mode Indicator */}
              {letterSwapActive && (
                <div className="mt-2 text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-600 text-white font-bold shadow-md">
                    <span className="material-icons text-lg">swap_horiz</span>
                    {swapSelection ? "Choose a letter to replace the selected tile" : "Click a tile to change its letter"}
                  </div>
                </div>
              )}
              
              {/* A-Z Letter Picker */}
              {letterSwapActive && swapSelection && (
                <div className="mt-4 p-4 bg-gray-800 rounded-lg">
                  <div className="text-white text-center mb-3 font-bold">Choose a letter:</div>
                  <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-w-md mx-auto">
                    {Array.from({ length: 26 }, (_, i) => {
                      const letter = String.fromCharCode(65 + i); // A-Z
                      return (
                        <button
                          key={letter}
                          onClick={() => handleLetterChange(letter)}
                          className="w-8 h-8 sm:w-10 sm:h-10 bg-white text-gray-900 font-bold rounded hover:bg-cyan-200 transition-colors"
                        >
                          {letter}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
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
                <button className="px-6 py-2 rounded-lg bg-red-700 text-white font-bold shadow hover:scale-105 transition-all duration-150" onClick={handleGameOver} disabled={submitting}>End Game</button>
              </div>
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