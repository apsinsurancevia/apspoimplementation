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

See `setup_deployment.md` for the complete client deployment checklist.

Quick start for new client:
```bash
git checkout main
git pull origin main
git checkout -b [clientcode]-production
# Fill in src/Config.gs
# Follow setup_deployment.md Steps 1-14
```

## Monthly Workflow

See `setup_deployment.md` — Monthly Workflow Reference section.

## Troubleshooting

See `setup_deployment.md` — Troubleshooting Quick Reference section.

## Key Rules
- No hardcoded values outside Config.gs
- CLAUDE_API_KEY set in Apps Script Script Properties only — never in code
- All FOLDER_* and SHEET_* IDs populated by setup.gs on first run
- Named deployment URL never changes — always use Manage Deployments

## Git Branches
- main — clean validated codebase
- novoup-staging — active development
- [clientcode]-production — per broker e.g. aps-production
