# CaliberPO — Commission Management Service Bureau

Google Apps Script system for insurance broker commission management.

## Build Sequence
- Prompt 00 — Repo structure + Config.gs + master CSVs ✓
- Prompt 01 — setup.gs (workspace initialiser)
- Prompt 02 — Normalisation.gs
- Prompt 03 — SheetUtils.gs + DriveUtils.gs
- Prompt 04 — RateLookup.gs + index.html
- Prompt 05 — Logging.gs
- Prompt 06 — CommissionApplication.gs
- Prompt 07 — PayoutGeneration.gs
- Prompt 08 — StatementProcessing.gs
- Prompt 09 — Reconciliation.gs
- Prompt 10 — Client deployment checklist

## Deployment
Each broker is a separate Git branch.
Only Config.gs changes between deployments.
See Prompt 10 for full deployment checklist.

## Key Rules
- No hardcoded values outside Config.gs
- CLAUDE_API_KEY set in Apps Script Script Properties only — never in code
- All FOLDER_* and SHEET_* IDs populated by setup.gs on first run
- Named deployment URL never changes — always use Manage Deployments

## Git Branches
- main — clean validated codebase
- novoup-staging — active development
- [clientcode]-production — per broker e.g. aps-production
