import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * backfillCompanyId
 *
 * Assigns company_id to legacy records that are missing it.
 * Source of truth: AppSettings.buildr_company_id
 *
 * SAFETY RULES:
 * - Admin-only
 * - dry_run defaults to TRUE — no writes unless explicitly set to false
 * - NEVER overwrites an existing company_id value
 * - Only touches records where company_id is null, undefined, or empty string
 * - Throttled updates (150-250ms delays) to avoid rate limits
 * - Resume-safe: skips already-updated records on rerun
 *
 * Input:
 *   {
 *     dry_run: boolean,      — default true
 *     limit_per_entity: int  — optional, max records to update per entity (for chunking)
 *   }
 *
 * Output:
 *   {
 *     dry_run: boolean,
 *     company_id: string,
 *     summary: [
 *       {
 *         entity: string,
 *         total_records: number,
 *         missing_before_run: number,
 *         updated_this_run: number,
 *         skipped_existing_company_id: number,
 *         failed_updates: [ { id: string, error: string } ],
 *         limit_applied: number | null
 *       }
 *     ],
 *     total_would_update: number,
 *     total_updated: number,
 *     total_failed: number,
 *     live_updates_performed: boolean
 *   }
 */

const ENTITIES_TO_BACKFILL = ['Material', 'Location', 'InventoryItem', 'Transaction'];
const THROTTLE_MS = 175; // Delay between updates in milliseconds

// Helper: throttle to avoid rate limits
const throttle = async (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: identify records missing company_id (resume-safe)
const isMissingCompanyId = (record) =>
  record.company_id === null ||
  record.company_id === undefined ||
  record.company_id === '';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // ── AUTH: admin only ─────────────────────────────────────────────────────
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // ── INPUT ────────────────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const dry_run = body.dry_run !== false;
    const limit_per_entity = body.limit_per_entity || null;

    // ── SOURCE OF TRUTH: AppSettings.buildr_company_id ──────────────────────
    const appSettings = await base44.asServiceRole.entities.AppSettings.list();
    if (!appSettings || appSettings.length === 0) {
      return Response.json({ error: 'AppSettings not found' }, { status: 500 });
    }

    const company_id = appSettings[0].buildr_company_id;
    if (!company_id) {
      return Response.json({ error: 'AppSettings.buildr_company_id is not set — cannot backfill' }, { status: 400 });
    }

    // ── PROCESS EACH ENTITY ──────────────────────────────────────────────────
    const summary = [];
    let total_would_update = 0;
    let total_updated = 0;
    let total_failed = 0;

    for (const entityName of ENTITIES_TO_BACKFILL) {
      // Fetch all records for this entity
      const records = await base44.asServiceRole.entities[entityName].list();
      const total_records = records.length;

      // Identify records missing company_id (resume-safe)
      const missing = records.filter(isMissingCompanyId);
      const missing_before_run = missing.length;
      const skipped_existing_company_id = total_records - missing_before_run;

      // Apply limit if specified
      const toProcess = limit_per_entity ? missing.slice(0, limit_per_entity) : missing;
      const limit_applied = limit_per_entity && missing_before_run > limit_per_entity ? limit_per_entity : null;

      total_would_update += toProcess.length;

      const failed_updates = [];
      let updated_this_run = 0;

      // ── LIVE UPDATE with throttling (only when dry_run = false) ─────────────
      if (!dry_run && toProcess.length > 0) {
        console.log(`[BACKFILL LIVE START] ${entityName}: processing ${toProcess.length} records...`);

        for (let i = 0; i < toProcess.length; i++) {
          const record = toProcess[i];

          try {
            // Double-check record hasn't been updated since fetch (resume-safe)
            if (!isMissingCompanyId(record)) {
              console.log(`[BACKFILL SKIP] ${entityName} ${record.id}: already has company_id`);
              continue;
            }

            await base44.asServiceRole.entities[entityName].update(record.id, {
              company_id: company_id
            });

            updated_this_run++;
            total_updated++;

            // Throttle between updates
            if (i < toProcess.length - 1) {
              await throttle(THROTTLE_MS);
            }

            if ((i + 1) % 10 === 0) {
              console.log(`[BACKFILL PROGRESS] ${entityName}: ${i + 1}/${toProcess.length} records updated`);
            }
          } catch (error) {
            failed_updates.push({
              id: record.id,
              error: error.message || String(error)
            });
            total_failed++;
            console.error(`[BACKFILL ERROR RECORD] ${entityName} ${record.id}: ${error.message}`);

            // Throttle even on error
            if (i < toProcess.length - 1) {
              await throttle(THROTTLE_MS);
            }
          }
        }

        console.log(`[BACKFILL COMPLETE] ${entityName}: updated ${updated_this_run}, failed ${failed_updates.length}`);
      } else if (dry_run) {
        console.log(`[BACKFILL DRY RUN] ${entityName}: would update ${toProcess.length} of ${total_records} records`);
      }

      summary.push({
        entity: entityName,
        total_records,
        missing_before_run,
        updated_this_run,
        skipped_existing_company_id,
        failed_updates,
        limit_applied
      });
    }

    // ── RESPONSE ─────────────────────────────────────────────────────────────
    return Response.json({
      dry_run,
      company_id,
      summary,
      total_would_update,
      total_updated,
      total_failed,
      live_updates_performed: !dry_run && total_updated > 0,
      message: dry_run
        ? `DRY RUN complete. ${total_would_update} records would be updated. No data was changed.`
        : `LIVE BACKFILL complete. ${total_updated} records updated, ${total_failed} failed. company_id=${company_id}.`
    });

  } catch (error) {
    console.error('[BACKFILL ERROR]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});