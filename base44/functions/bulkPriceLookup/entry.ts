import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { company_id } = await req.json();

    // ── AUTHENTICATE USER ────────────────────────────────────────────────────
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── RESOLVE COMPANY ID ───────────────────────────────────────────────────
    let validatedCompanyId;
    
    const fullUsers = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const fullUser = fullUsers.length > 0 ? fullUsers[0] : null;
    const isPlatformAdmin = fullUser?.is_platform_admin === true;
    
    if (isPlatformAdmin) {
      // Platform admin must provide company_id
      if (!company_id) {
        return Response.json({ error: 'Platform admin must provide company_id' }, { status: 400 });
      }
      // Validate against CompanyDirectory
      const companyDirs = await base44.asServiceRole.entities.CompanyDirectory.filter({ company_id, is_active: true });
      if (companyDirs.length === 0) {
        return Response.json({ error: 'Company not found or inactive' }, { status: 400 });
      }
      validatedCompanyId = company_id;
    } else {
      // Tenant user: use assigned company_id
      validatedCompanyId = fullUser?.company_id;
      if (!validatedCompanyId) {
        return Response.json({ error: 'User has no assigned company' }, { status: 403 });
      }
    }

    // ── FETCH ALL MATERIALS FOR THIS COMPANY ─────────────────────────────────
    const materials = await base44.asServiceRole.entities.Material.filter({ company_id: validatedCompanyId });
    
    if (!materials || materials.length === 0) {
      return Response.json({ success: true, priced: 0, skipped: 0, reason: 'No materials found' });
    }

    // ── BUILD PRICING PROMPT ─────────────────────────────────────────────────
    const itemsNeedingPrice = materials; // Refresh ALL materials on every call
    
    if (itemsNeedingPrice.length === 0) {
      return Response.json({ success: true, priced: 0, skipped: 0, reason: 'No materials found' });
    }

    // Create a concise list for LLM
    const materialList = itemsNeedingPrice.map(m => `- ${m.name} (Unit: ${m.unit || 'each'})`).join('\n');

    const prompt = `Search supplier websites (Home Depot, Lowes, Grainger, Fastenal, Graybar, Wesco, City Electric, Rexel, Inline) for these electrical materials. Return ONLY valid JSON with no markdown.

${materialList}

For each item, find the ACTUAL current price from a real supplier website. Include the supplier name.
If an item is not found on any website, skip it (do not include estimates).

Return the exact JSON structure (no markdown, raw JSON only):
{
  "prices": [
    { "name": "Material Name", "unit_cost": 0.00, "supplier": "Supplier Name" },
    ...
  ]
}`;

    console.log(`[BULK PRICE LOOKUP] Starting for company ${validatedCompanyId}, ${itemsNeedingPrice.length} items need pricing via web search`);

    // ── TIER 1: CALL LLM WITH WEB SEARCH ────────────────────────────────────
    let pricing = {};
    let pricedViaWeb = 0;
    try {
      const llmResponse = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            prices: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  unit_cost: { type: 'number' },
                  supplier: { type: 'string' }
                }
              }
            }
          }
        }
      });

      if (llmResponse.prices && Array.isArray(llmResponse.prices)) {
        llmResponse.prices.forEach(p => {
          pricing[p.name] = { unit_cost: p.unit_cost || 0, supplier: p.supplier || '', source: 'web' };
          pricedViaWeb++;
        });
        console.log(`[BULK PRICE LOOKUP] Tier 1 (Web): ${pricedViaWeb} items found`);
      }
    } catch (llmError) {
      console.error(`[BULK PRICE LOOKUP] Web search error:`, llmError.message);
      // Continue to Tier 2 instead of failing
    }

    // ── TIER 2: ESTIMATE MISSING ITEMS ──────────────────────────────────────
    const stillNeedingPrice = itemsNeedingPrice.filter(m => !pricing[m.name]);
    if (stillNeedingPrice.length > 0) {
      console.log(`[BULK PRICE LOOKUP] Tier 2: ${stillNeedingPrice.length} items still need estimates`);
      
      const estimateList = stillNeedingPrice.map(m => `- ${m.name} (Unit: ${m.unit || 'each'})`).join('\n');
      const estimatePrompt = `You are an electrical supply pricing expert. Provide ONLY realistic estimates for items not found on supplier websites.

${estimateList}

Return conservative estimates based on typical electrical supply market prices. Return JSON only:
{
  "prices": [
    { "name": "Material Name", "unit_cost": 0.00 },
    ...
  ]
}`;

      try {
        const estimateResponse = await base44.integrations.Core.InvokeLLM({
          prompt: estimatePrompt,
          response_json_schema: {
            type: 'object',
            properties: {
              prices: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    unit_cost: { type: 'number' }
                  }
                }
              }
            }
          }
        });

        if (estimateResponse.prices && Array.isArray(estimateResponse.prices)) {
          estimateResponse.prices.forEach(p => {
            pricing[p.name] = { unit_cost: p.unit_cost || 0, supplier: 'Estimated', source: 'estimate' };
          });
          console.log(`[BULK PRICE LOOKUP] Tier 2 (Estimates): ${estimateResponse.prices.length} items estimated`);
        }
      } catch (estimateError) {
        console.warn(`[BULK PRICE LOOKUP] Estimate fallback failed:`, estimateError.message);
      }
    }

    // ── FETCH COMPANY NAME ───────────────────────────────────────────────────
    const companyDirs = await base44.asServiceRole.entities.CompanyDirectory.filter({ company_id: validatedCompanyId });
    const companyName = companyDirs.length > 0 ? companyDirs[0].company_name : validatedCompanyId;

    // ── UPDATE MATERIALS WITH BATCHING + EXPONENTIAL BACKOFF ─────────────────
    let priced = 0;
    let skipped = 0;
    const results = [];
    const BATCH_SIZE = 10;
    const BATCH_DELAY_MS = 200;

    // ── FUZZY STRING MATCHING ──────────────────────────────────────────────────
    const calculateSimilarity = (str1, str2) => {
      const s1 = str1.toLowerCase().trim();
      const s2 = str2.toLowerCase().trim();
      if (s1 === s2) return 1.0;
      
      // Levenshtein distance
      const len1 = s1.length, len2 = s2.length;
      const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(0));
      for (let i = 0; i <= len1; i++) matrix[0][i] = i;
      for (let j = 0; j <= len2; j++) matrix[j][0] = j;
      
      for (let j = 1; j <= len2; j++) {
        for (let i = 1; i <= len1; i++) {
          const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
          matrix[j][i] = Math.min(
            matrix[j][i - 1] + 1,
            matrix[j - 1][i] + 1,
            matrix[j - 1][i - 1] + cost
          );
        }
      }
      
      const maxLen = Math.max(len1, len2);
      return 1 - (matrix[len2][len1] / maxLen);
    };

    const findClosestMatch = (llmName, materials) => {
      let bestMatch = null;
      let bestScore = 0.7; // Minimum 70% similarity threshold
      
      for (const material of materials) {
        const score = calculateSimilarity(llmName, material.name);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = material;
        }
      }
      
      return bestMatch;
    };

    // Helper: retry with exponential backoff
    const updateWithRetry = async (materialId, unit_cost, supplier, materialName, maxRetries = 3) => {
      let lastError = null;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          await base44.asServiceRole.entities.Material.update(materialId, { unit_cost, supplier });
          return { success: true, materialId, materialName, unit_cost, supplier };
        } catch (error) {
          lastError = error;
          
          // If 429 (rate limit), wait exponentially longer
          if (error.message?.includes('429') || error.message?.includes('Rate limit')) {
            const waitMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
            console.warn(`[BULK PRICE LOOKUP] Rate limit on ${materialName}, retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`);
            await new Promise(r => setTimeout(r, waitMs));
            continue;
          }
          
          // Non-rate-limit error, fail immediately
          break;
        }
      }
      
      return { success: false, materialId, materialName, error: lastError?.message };
    };

    // Process in batches
    for (let i = 0; i < itemsNeedingPrice.length; i += BATCH_SIZE) {
      const batch = itemsNeedingPrice.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(itemsNeedingPrice.length / BATCH_SIZE);
      
      console.log(`[BULK PRICE LOOKUP] Processing batch ${batchNum}/${totalBatches}`);

      // Process batch in parallel with fuzzy matching
      const batchPromises = batch.map(material => {
        // Try exact match first, then fuzzy match
        let priceData = pricing[material.name];
        
        if (!priceData) {
          // Fuzzy match against LLM results
          const llmNames = Object.keys(pricing);
          const bestLlmMatch = findClosestMatch(material.name, llmNames.map(n => ({ name: n })));
          if (bestLlmMatch) {
            priceData = pricing[bestLlmMatch.name];
            console.log(`[BULK PRICE LOOKUP] Fuzzy matched "${material.name}" to "${bestLlmMatch.name}"`);
          }
        }
        
        const unit_cost = priceData?.unit_cost;
        const supplier = priceData?.supplier;
        
        if (unit_cost && unit_cost > 0) {
          return updateWithRetry(material.id, unit_cost, supplier, material.name);
        } else {
          return Promise.resolve({ 
            success: false, 
            materialId: material.id, 
            materialName: material.name, 
            error: 'no_price_from_search' 
          });
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      // Collect results
      for (const result of batchResults) {
        if (result.success) {
          priced++;
          results.push({ name: result.materialName, unit_cost: result.unit_cost, supplier: result.supplier, status: 'priced' });
          console.log(`[BULK PRICE LOOKUP] ${result.materialName} → $${result.unit_cost} (${result.supplier})`);
        } else {
          skipped++;
          results.push({ name: result.materialName, status: 'failed', error: result.error });
          console.warn(`[BULK PRICE LOOKUP] Failed ${result.materialName}: ${result.error}`);
        }
      }

      // Delay before next batch (except for last batch)
      if (i + BATCH_SIZE < itemsNeedingPrice.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    console.log(`[BULK PRICE LOOKUP] Complete for ${companyName} (${validatedCompanyId}): ${priced} priced, ${skipped} skipped`);

    return Response.json({
      success: true,
      company_id: validatedCompanyId,
      company_name: companyName,
      total_needing_price: itemsNeedingPrice.length,
      priced,
      skipped,
      results
    });

  } catch (error) {
    console.error('[bulkPriceLookup ERROR]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});