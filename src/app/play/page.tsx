"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { apiService } from "@/services/api";
// import words from "../words.json";
import { useRouter } from "next/navigation";

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
// Enhanced letter generation with vowel frequency
function generateRandomLetter(): string {
  const vowels = "AEIOU";
  const consonants = "BCDFGHJKLMNPQRSTVWXYZ";
  
  // 30% chance for vowels, 70% for consonants (increased from ~19% natural frequency)
  if (Math.random() < 0.3) {
    return vowels[Math.floor(Math.random() * vowels.length)];
  } else {
    return consonants[Math.floor(Math.random() * consonants.length)];
  }
}

function generateBoard() {
  const board = Array.from({ length: GRID_ROWS }, (_, rowIdx) =>
    Array.from({ length: GRID_COLS }, () => "")
  );
  
  // Fill the bottom 3 rows with enhanced letter distribution
  for (let row = GRID_ROWS - 3; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      board[row][col] = generateRandomLetter();
    }
  }
  
  console.log("Generated board:", board);
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

export default function PlayGame() {
  const router = useRouter();
  const emptyBoard = Array.from({ length: GRID_ROWS }, () => Array.from({ length: GRID_COLS }, () => ""));
  const [board, setBoard] = useState<string[][]>(emptyBoard);
  const [selected, setSelected] = useState<{ row: number; col: number }[]>([]);
  const [foundWords, setFoundWords] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [definitions, setDefinitions] = useState<Record<string, { definition: string; attribution?: string }>>({});
  const [loadingDefs, setLoadingDefs] = useState(false);
  const [missions, setMissions] = useState<any[]>([]);
  const [missionsLoading, setMissionsLoading] = useState(false);
  const [missionsError, setMissionsError] = useState<string | null>(null);
  const [hintWord, setHintWord] = useState<string | null>(null);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [freezeTimeout, setFreezeTimeout] = useState<NodeJS.Timeout | null>(null);
  const [flectcoins, setFlectcoins] = useState(500); // Placeholder, ideally fetched from user profile
  const [gems, setGems] = useState(0);
  const [powerupError, setPowerupError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Remove all wordSet and wordList logic
  const [wordFeedback, setWordFeedback] = useState<string | null>(null);
  const [validatingWord, setValidatingWord] = useState(false);
  const [lastValidationResult, setLastValidationResult] = useState<any>(null);
  const [wordSet, setWordSet] = useState<Set<string> | null>(null);
  const [wordListLoading, setWordListLoading] = useState(true);

  // Powerup costs (adjust as needed)
  const HINT_COST = 50;
  const SHUFFLE_COST = 100;
  const FREEZE_COST = 200;

  // Time bonus for finding words (seconds per letter)
  const TIME_BONUS_PER_LETTER = 1; // 1 second per letter in the word (matches mobile app)

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
  const letterFallRef = useRef<NodeJS.Timeout | null>(null);
  const [letterFallTimer, setLetterFallTimer] = useState(0);

  // Function to add new letters at the top
  const addNewLetters = (board: string[][]) => {
    const newBoard = board.map(row => [...row]);
    
    // Add new letters at the top row with enhanced vowel frequency
    for (let col = 0; col < GRID_COLS; col++) {
      if (newBoard[0][col] === "") {
        newBoard[0][col] = generateRandomLetter();
      }
    }
    
    return newBoard;
  };

  // Function to make letters fall down
  const makeLettersFall = (board: string[][]) => {
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
    
    return newBoard;
  };

  // Continuous letter falling effect
  useEffect(() => {
    if (gameOver || validatingWord) return;
    if (isFrozen) return; // Pause letter falling during freeze
    
    letterFallRef.current = setInterval(() => {
      setLetterFallTimer(prev => prev + 1);
      setBoard(prevBoard => {
        let newBoard = prevBoard;
        // Add new letters at top every 4 seconds
        if (letterFallTimer % 4 === 0) {
          // Check if any cell in the top row is already filled
          if (prevBoard[0].some(cell => cell !== "")) {
            console.log("[GAME OVER] Tried to add new letter to full top row");
            setGameOver(true);
            return prevBoard;
          }
          newBoard = addNewLetters(newBoard);
        }
        // Make letters fall down
        return makeLettersFall(newBoard);
      });
    }, 2000); // Letters fall every 2 seconds
    
    return () => {
      if (letterFallRef.current) clearInterval(letterFallRef.current);
    };
  }, [gameOver, isFrozen, validatingWord, letterFallTimer]);

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
        if (isMounted) setMissions(data.missions || data);
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
  }, []);

  // Load word list from public/words.json and generate board
  useEffect(() => {
    setWordListLoading(true);
    
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 10000); // 10 second timeout
    });
    
    // Race between fetch and timeout
    Promise.race([
      fetch("/words.json"),
      timeoutPromise
    ])
      .then((res: any) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
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
      .catch((error) => {
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
          setScore(prev => prev + word.length);
          // Add time bonus for finding a word
          const timeBonus = word.length * TIME_BONUS_PER_LETTER;
          setTimer(prev => Math.min(prev + timeBonus, INITIAL_TIMER)); // Cap at initial timer
          setWordFeedback(`Good word! +${timeBonus}s`);
          setTimeout(() => setWordFeedback(null), 1200);
          setBoard(prevBoard => {
            const newBoard = prevBoard.map(row => [...row]);
            selected.forEach(sel => {
              newBoard[sel.row][sel.col] = "";
            });
            return newBoard;
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
          setScore(prev => prev + word.length);
          // Add time bonus for finding a word
          const timeBonus = word.length * TIME_BONUS_PER_LETTER;
          setTimer(prev => Math.min(prev + timeBonus, INITIAL_TIMER)); // Cap at initial timer
          setWordFeedback(`Good word! +${timeBonus}s`);
          setTimeout(() => setWordFeedback(null), 1200);
          setBoard(prevBoard => {
            const newBoard = prevBoard.map(row => [...row]);
            newPath.forEach(sel => {
              newBoard[sel.row][sel.col] = "";
            });
            return newBoard;
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

  // Submit word button handler
  const handleSubmitWord = () => {
    if (validatingWord) return; // Prevent double submission
    if (selected.length < 3) return;
    const word = selected.map(sel => board[sel.row][sel.col]).join("");
    setValidatingWord(true);
    // apiService.getWordDefinition(word) // This line is removed
    //   .then(result => { // This block is removed
    //     if (result.definition && result.definition !== 'No definition found.') { // This block is removed
    //       setFoundWords(prev => [...prev, word]); // This block is removed
    //       setScore(prev => prev + word.length); // This block is removed
    //       setWordFeedback("Good word!"); // This block is removed
    //       setTimeout(() => setWordFeedback(null), 1200); // This block is removed
    //       // Remove letters from board when word is submitted // This block is removed
    //       setBoard(prevBoard => { // This block is removed
    //         const newBoard = prevBoard.map(row => [...row]); // This block is removed
    //         selected.forEach(sel => { // This block is removed
    //           newBoard[sel.row][sel.col] = ""; // This block is removed
    //         }); // This block is removed
    //         return newBoard; // This block is removed
    //       }); // This block is removed
    //     } else { // This block is removed
    //       setWordFeedback("Invalid word"); // This block is removed
    //       setTimeout(() => setWordFeedback(null), 1200); // This block is removed
    //     } // This block is removed
    //   }) // This block is removed
    //   .catch(e => { // This block is removed
    //     setWordFeedback("Validation failed. Try again."); // This block is removed
    //     setTimeout(() => setWordFeedback(null), 1200); // This block is removed
    //   }) // This block is removed
    //   .finally(() => { // This block is removed
    //     setValidatingWord(false); // This block is removed
    //   }); // This block is removed
    // setSelected([]); // This line is removed
  };

  const handleGameOver = async () => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await apiService.updateUserStats({
        score,
        foundWords,
        flectcoins,
        gems,
        // Add more fields as needed for your backend
      });
      // Check for completed missions and call completeMission for each
      const completedMissions = missions.filter(m => !m.completed && (m.progress + 1 >= (m.goal || m.target)));
      for (const mission of completedMissions) {
        try {
          await apiService.completeMission({
            id: mission.id,
            missionId: mission.id,
            period: mission.period || mission.type || 'daily', // fallback to daily if not specified
          });
        } catch (e) {
          // Optionally handle/report mission completion errors
        }
      }
      // Refetch missions to update state
      try {
        const data = await apiService.getMissions();
        setMissions(data.missions || data);
      } catch {}
      setSuccess("Stats and missions updated!");
    } catch (e: any) {
      setError(e.message || "Failed to update stats");
    } finally {
      setSubmitting(false);
      setGameOver(true);
    }
  };

  const handleReplay = () => {
    setBoard(generateBoard());
    setSelected([]);
    setFoundWords([]);
    setScore(0);
    setGameOver(false);
    setError(null);
    setSuccess(null);
    setTimer(INITIAL_TIMER);
    setInDangerZone(false);
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
      // Prepare full stats object for backend
      const updatedStats = {
        ...userProfile,
        flectcoins: newFlectcoins,
        gems: newGems,
      };
      console.log("Attempting to sync currency with full stats:", updatedStats);
      const result = await apiService.updateUserStats(updatedStats);
      console.log("Currency sync response:", result);
      setUserProfile(updatedStats); // Update local profile state
      console.log("Currency synced successfully:", { flectcoins: newFlectcoins, gems: newGems });
    } catch (e: any) {
      console.error("Currency sync error:", e);
      const errorMessage = e.message || "Failed to sync currency with backend. Please try again.";
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
    return word.length >= 3 && wordSet?.has(word.toUpperCase());
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
                  ) : missions.length === 0 ? (
                    <div className="text-gray-400 mb-2">No missions found.</div>
                  ) : (
                    <ul className="mb-2">
                      {Array.isArray(missions) && missions.map((mission, i) => (
                        <li key={mission.id || i} className="mb-1 text-blue-100">
                          <span className="font-bold text-white">{mission.title || mission.name}:</span> {mission.progress || 0}/{mission.goal || mission.target} {mission.completed ? <span className="text-green-400 ml-2">(Completed)</span> : null}
                        </li>
                      ))}
                    </ul>
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
              <div className="grid grid-cols-5 gap-2 bg-gray-900 p-4 rounded-lg shadow-lg">
                  {board.map((row, rowIdx) =>
                    row.map((cell, colIdx) => {
                      const isSelected = selected.some(sel => sel.row === rowIdx && sel.col === colIdx);
                      // Add pulse animation to filled cells in the top row
                      const isTopRow = rowIdx === 0 && cell !== "";
                      return (
                        <button
                          key={`${rowIdx}-${colIdx}`}
                          className={`w-14 h-14 sm:w-16 sm:h-16 rounded-lg flex items-center justify-center text-2xl font-bold transition border-2 ${isSelected ? "bg-blue-400 text-white border-blue-600" : "bg-white text-gray-900 border-gray-300 hover:bg-blue-100"} ${isTopRow ? "animate-pulse ring-2 ring-red-400" : ""}`}
                          onClick={() => handleCellClick(rowIdx, colIdx)}
                        >
                          {cell}
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
              {lastValidationResult && (
                <div className="mt-2 text-xs text-yellow-200 bg-gray-900 p-2 rounded">
                  <b>Validation API response:</b>
                  <pre>{JSON.stringify(lastValidationResult, null, 2)}</pre>
                </div>
              )}
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