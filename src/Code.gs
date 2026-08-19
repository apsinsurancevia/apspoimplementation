/**
 * CaliberPO — Main Entry Point
 *
 * doGet() and handleAPIRequest() live in RateLookup.gs.
 * This file is intentionally minimal.
 *
 * All business logic is in dedicated .gs files:
 *   RateLookup.gs   — Web App entry point + rate lookup engine
 *   Normalisation.gs — Pure normalisation and derivation functions
 *   SheetUtils.gs   — All Sheets I/O
 *   DriveUtils.gs   — All Drive I/O
 *   Config.gs       — Customer-specific configuration constants
 *   setup.gs        — One-time workspace initialisation
 */
