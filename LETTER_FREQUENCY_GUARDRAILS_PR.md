# 🅰️ Letter Frequency Guardrails - Cross-Platform Implementation

## 📋 PR Summary
**Type:** Feature/Improvement  
**Platforms:** Web ✅, Mobile 🔄  
**Priority:** High (Game Balance)  
**Breaking Changes:** No  

## 🎯 Problem Statement
Currently, rare letters (Z, Q, X, J, K, V) appear too frequently and in multiples on the game board, creating unfair gameplay situations where players are stuck with unplayable tiles. This violates word game player expectations and creates frustration.

## ✅ Solution Implemented (Web)
- **Realistic letter frequency distribution** based on Scrabble/English usage
- **Rare letter guardrails** limiting maximum 2 rare letters on board at once
- **Dynamic tracking system** that resets on new games, shuffles, and replays
- **Automatic fallback** to common letters when rare letter limit is reached

## 📊 Frequency Table (Scrabble/English Based)
| Letter | Frequency | Letter | Frequency |
|--------|-----------|--------|-----------|
| E      | 12.0      | M      | 2.4       |
| A      | 9.0       | W      | 2.4       |
| I      | 9.0       | F      | 2.2       |
| O      | 8.0       | G      | 2.0       |
| T      | 9.0       | Y      | 2.0       |
| N      | 6.7       | P      | 1.9       |
| S      | 6.3       | B      | 1.5       |
| H      | 6.1       | V      | 0.98      |
| R      | 6.0       | K      | 0.77      |
| D      | 4.3       | J      | 0.15      |
| L      | 4.0       | X      | 0.15      |
| U      | 4.0       | Q      | 0.10      |
| C      | 2.8       | Z      | 0.07      |

## 🛡️ Rare Letter Guardrails
- **Rare letters:** Z, Q, X, J, K, V
- **Maximum allowed on board:** 2
- **Behavior:** When limit reached, only common letters generated until rare letter used
- **Reset triggers:** New game, shuffle, replay

## 💻 Reference Implementation (TypeScript/JavaScript)

### Core Logic
```typescript
// Frequency table
const letterFrequencies: Record<string, number> = {
  'A': 9.0, 'E': 12.0, 'I': 9.0, 'O': 8.0, 'U': 4.0,
  'T': 9.0, 'N': 6.7, 'S': 6.3, 'H': 6.1, 'R': 6.0,
  'D': 4.3, 'L': 4.0, 'C': 2.8, 'M': 2.4, 'W': 2.4,
  'F': 2.2, 'G': 2.0, 'Y': 2.0, 'P': 1.9, 'B': 1.5,
  'V': 0.98, 'K': 0.77, 'J': 0.15, 'X': 0.15, 'Q': 0.10, 'Z': 0.07
};

const rareLetters = ['Z', 'Q', 'X', 'J', 'K', 'V'];
const maxRareLettersOnBoard = 2;
let rareLettersOnBoard = new Set<string>();

function generateRandomLetter(): string {
  // Convert frequencies to cumulative probabilities
  const letters = Object.keys(letterFrequencies);
  const totalFreq = Object.values(letterFrequencies).reduce((sum, freq) => sum + freq, 0);
  
  let cumulative = 0;
  const cumulativeProbs: { letter: string; prob: number }[] = [];
  
  for (const letter of letters) {
    cumulative += letterFrequencies[letter] / totalFreq;
    cumulativeProbs.push({ letter, prob: cumulative });
  }

  // Generate random letter based on frequency
  const random = Math.random();
  for (const { letter, prob } of cumulativeProbs) {
    if (random <= prob) return letter;
  }
  return 'E'; // Fallback
}

function generateRandomLetterWithGuardrails(): string {
  if (rareLettersOnBoard.size >= maxRareLettersOnBoard) {
    // Only generate common letters
    const commonLetters = Object.keys(letterFrequencies).filter(l => !rareLetters.includes(l));
    return commonLetters[Math.floor(Math.random() * commonLetters.length)];
  }
  
  const letter = generateRandomLetter();
  if (rareLetters.includes(letter)) {
    rareLettersOnBoard.add(letter);
  }
  return letter;
}

function resetRareLetterTracking() {
  rareLettersOnBoard.clear();
}

function removeRareLetterFromTracking(letter: string) {
  if (rareLetters.includes(letter)) {
    rareLettersOnBoard.delete(letter);
  }
}
```

### Usage Examples
```typescript
// Board generation
function generateBoard() {
  resetRareLetterTracking();
  const board = Array.from({ length: ROWS }, () => 
    Array.from({ length: COLS }, () => "")
  );
  
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      board[row][col] = generateRandomLetterWithGuardrails();
    }
  }
  return board;
}

// Row insertion
function insertNewRow(board: string[][]) {
  const newBoard = board.map(row => [...row]);
  for (let col = 0; col < COLS; col++) {
    if (newBoard[0][col] === "") {
      newBoard[0][col] = generateRandomLetterWithGuardrails();
    }
  }
  return newBoard;
}

// When letters are used/removed
function removeLettersFromBoard(positions: Position[]) {
  positions.forEach(pos => {
    const letter = board[pos.row][pos.col];
    board[pos.row][pos.col] = "";
    removeRareLetterFromTracking(letter);
  });
}
```

## 📱 Mobile Implementation Guide

### Swift (iOS) Example
```swift
let letterFrequencies: [Character: Double] = [
    "A": 9.0, "E": 12.0, "I": 9.0, "O": 8.0, "U": 4.0,
    "T": 9.0, "N": 6.7, "S": 6.3, "H": 6.1, "R": 6.0,
    "D": 4.3, "L": 4.0, "C": 2.8, "M": 2.4, "W": 2.4,
    "F": 2.2, "G": 2.0, "Y": 2.0, "P": 1.9, "B": 1.5,
    "V": 0.98, "K": 0.77, "J": 0.15, "X": 0.15, "Q": 0.10, "Z": 0.07
]

let rareLetters: Set<Character> = ["Z", "Q", "X", "J", "K", "V"]
var rareLettersOnBoard = Set<Character>()
let maxRareLettersOnBoard = 2

func generateRandomLetterWithGuardrails() -> Character {
    if rareLettersOnBoard.count >= maxRareLettersOnBoard {
        let commonLetters = letterFrequencies.keys.filter { !rareLetters.contains($0) }
        return commonLetters.randomElement()!
    }
    
    let letter = generateRandomLetter() // Implement frequency-based logic
    if rareLetters.contains(letter) {
        rareLettersOnBoard.insert(letter)
    }
    return letter
}

func resetRareLetterTracking() {
    rareLettersOnBoard.removeAll()
}

func removeRareLetterFromTracking(_ letter: Character) {
    if rareLetters.contains(letter) {
        rareLettersOnBoard.remove(letter)
    }
}
```

### Kotlin (Android) Example
```kotlin
val letterFrequencies = mapOf(
    'A' to 9.0, 'E' to 12.0, 'I' to 9.0, 'O' to 8.0, 'U' to 4.0,
    'T' to 9.0, 'N' to 6.7, 'S' to 6.3, 'H' to 6.1, 'R' to 6.0,
    'D' to 4.3, 'L' to 4.0, 'C' to 2.8, 'M' to 2.4, 'W' to 2.4,
    'F' to 2.2, 'G' to 2.0, 'Y' to 2.0, 'P' to 1.9, 'B' to 1.5,
    'V' to 0.98, 'K' to 0.77, 'J' to 0.15, 'X' to 0.15, 'Q' to 0.10, 'Z' to 0.07
)

val rareLetters = setOf('Z', 'Q', 'X', 'J', 'K', 'V')
var rareLettersOnBoard = mutableSetOf<Char>()
val maxRareLettersOnBoard = 2

fun generateRandomLetterWithGuardrails(): Char {
    if (rareLettersOnBoard.size >= maxRareLettersOnBoard) {
        val commonLetters = letterFrequencies.keys.filter { it !in rareLetters }
        return commonLetters.random()
    }
    
    val letter = generateRandomLetter() // Implement frequency-based logic
    if (rareLetters.contains(letter)) {
        rareLettersOnBoard.add(letter)
    }
    return letter
}

fun resetRareLetterTracking() {
    rareLettersOnBoard.clear()
}

fun removeRareLetterFromTracking(letter: Char) {
    if (rareLetters.contains(letter)) {
        rareLettersOnBoard.remove(letter)
    }
}
```

## ✅ Implementation Checklist for Mobile Team

### Core Requirements
- [ ] **Use provided frequency table** for all letter generation
- [ ] **Implement rare letter guardrails** (max 2 on board)
- [ ] **Track rare letters** using Set/List data structure
- [ ] **Reset tracking** on new game, shuffle, replay
- [ ] **Remove from tracking** when letters are used/removed

### Integration Points
- [ ] **Board generation** (initial board creation)
- [ ] **Row insertion** (new rows added during gameplay)
- [ ] **Shuffle functionality** (re-scan board after shuffle)
- [ ] **Replay/new game** (reset tracking)
- [ ] **Letter removal** (when words are formed)

### Testing Requirements
- [ ] **Edge case testing:** Never more than 2 rare letters on board
- [ ] **Frequency validation:** Letters appear according to frequency table
- [ ] **Guardrail testing:** Common letters only when rare limit reached
- [ ] **Reset testing:** Tracking clears on new game/shuffle
- [ ] **Removal testing:** Rare letters removed from tracking when used

## 🚀 Deployment Status
- **Web:** ✅ Implemented and deployed
- **iOS:** 🔄 Pending implementation
- **Android:** 🔄 Pending implementation

## 📝 Documentation Updates Needed
- [ ] Add to `GAME_MECHANICS.md` or similar documentation
- [ ] Update mobile dev onboarding docs
- [ ] Add to API documentation if relevant
- [ ] Create testing guidelines

## 🔗 Related Issues/PRs
- **Web Implementation:** [wordflect-website PR #X]
- **Mobile Implementation:** TBD

## 📞 Contact
- **Web Team:** @web-dev-team
- **Mobile Team:** @mobile-dev-team
- **Questions:** Open issue or contact team leads

---

**This PR establishes the letter frequency guardrails as the standard for all Wordflect platforms. Mobile teams should implement this logic to ensure consistent, fair gameplay across all platforms.** 