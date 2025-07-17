# Instructions for Posting PR to Main Wordflect Repo

## Option 1: Using GitHub CLI (Recommended)

1. **Navigate to the main Wordflect repo directory:**
   ```bash
   cd ../wordflect  # or wherever your main repo is located
   ```

2. **Create a new branch:**
   ```bash
   git checkout -b feature/letter-frequency-guardrails
   ```

3. **Copy the PR content:**
   - Copy the content from `LETTER_FREQUENCY_GUARDRAILS_PR.md`
   - Create a new file in the main repo: `docs/LETTER_FREQUENCY_GUARDRAILS.md`

4. **Commit and push:**
   ```bash
   git add docs/LETTER_FREQUENCY_GUARDRAILS.md
   git commit -m "Add letter frequency guardrails documentation for cross-platform implementation"
   git push origin feature/letter-frequency-guardrails
   ```

5. **Create PR using GitHub CLI:**
   ```bash
   gh pr create --title "🅰️ Letter Frequency Guardrails - Cross-Platform Implementation" --body-file ../wordflect-website/LETTER_FREQUENCY_GUARDRAILS_PR.md
   ```

## Option 2: Manual GitHub Web Interface

1. **Go to the main Wordflect repo on GitHub**
2. **Click "New Pull Request"**
3. **Set base branch to `main` and compare branch to `feature/letter-frequency-guardrails`**
4. **Copy the title:** `🅰️ Letter Frequency Guardrails - Cross-Platform Implementation`
5. **Copy the entire content from `LETTER_FREQUENCY_GUARDRAILS_PR.md` into the PR description**
6. **Add labels:** `enhancement`, `game-balance`, `cross-platform`
7. **Assign reviewers:** Mobile dev team members
8. **Submit the PR**

## Option 3: Create Issue Instead of PR

If you prefer to create an issue for discussion first:

1. **Go to the main Wordflect repo Issues tab**
2. **Click "New Issue"**
3. **Title:** `🅰️ Letter Frequency Guardrails - Cross-Platform Implementation`
4. **Copy the content from `LETTER_FREQUENCY_GUARDRAILS_PR.md`**
5. **Add labels:** `enhancement`, `game-balance`, `documentation`
6. **Assign to mobile dev team**
7. **Submit the issue**

## Files to Include

### Primary Documentation
- `docs/LETTER_FREQUENCY_GUARDRAILS.md` - Main documentation
- `docs/GAME_MECHANICS.md` - Update with new section

### Reference Implementation Files (Optional)
- `src/utils/letterFrequency.ts` - TypeScript implementation
- `src/utils/letterFrequency.swift` - Swift implementation  
- `src/utils/letterFrequency.kt` - Kotlin implementation

## PR Description Template

```markdown
## 🅰️ Letter Frequency Guardrails - Cross-Platform Implementation

### Summary
This PR establishes realistic letter frequency distribution and rare letter guardrails as the standard for all Wordflect platforms (web, iOS, Android).

### Key Changes
- ✅ **Web Implementation:** Complete with frequency table and guardrails
- 🔄 **Mobile Implementation:** Ready for iOS/Android teams
- 📚 **Documentation:** Comprehensive implementation guide
- 🧪 **Testing:** Checklist for mobile implementation

### Impact
- **Game Balance:** Prevents unfair board states with too many rare letters
- **Player Experience:** Matches word game expectations
- **Cross-Platform Consistency:** Same logic across all platforms

### Next Steps
1. **Mobile teams** implement the provided reference code
2. **Testing** using the provided checklist
3. **Documentation** updates in mobile onboarding

### Files Changed
- `docs/LETTER_FREQUENCY_GUARDRAILS.md` (new)
- `docs/GAME_MECHANICS.md` (updated)

### Reviewers
- @mobile-dev-team
- @game-design-team
- @web-dev-team

### Related
- Web implementation: [wordflect-website](https://github.com/RarefiedAir24/wordflect-website)
- Issue: #[issue-number] (if applicable)
```

## Contact Information

If you need help with the main repo access or have questions:
- **Repository:** [Main Wordflect Repo URL]
- **Team Leads:** [Contact info]
- **Mobile Dev Team:** [Contact info] 