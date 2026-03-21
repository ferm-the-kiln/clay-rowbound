import { extractValue } from "./extractor.js";
import { resolveTemplate } from "./template.js";
/**
 * Flatten an array element into a string-keyed record for use in {{item.field}} templates.
 * Scalar values are stored under the key "_value".
 * Object properties are stored directly as string entries.
 */
function flattenItem(item) {
    if (item === null || item === undefined) {
        return { _value: "" };
    }
    if (typeof item !== "object") {
        return { _value: String(item) };
    }
    const result = {};
    for (const [key, val] of Object.entries(item)) {
        if (val === null || val === undefined) {
            result[key] = "";
        }
        else if (typeof val === "object") {
            result[key] = JSON.stringify(val);
        }
        else {
            result[key] = String(val);
        }
    }
    return result;
}
/**
 * Execute a write action: resolve column mappings from the current row context
 * and write one or more rows to a destination tab.
 *
 * Returns a status string describing what was written (e.g. "wrote 3 rows to Leads").
 */
export async function executeWrite(action, context, options) {
    const { adapter, spreadsheetId, dryRun = false, onMissing } = options;
    const destRef = { spreadsheetId, sheetName: action.destTab };
    // Determine items to write
    let items;
    if (action.expand) {
        const resolved = resolveTemplate(action.expand, context, onMissing);
        if (!resolved)
            return null;
        let parsed;
        try {
            parsed = JSON.parse(resolved);
        }
        catch {
            return null;
        }
        // If expandPath is set, extract the array from within the parsed object
        if (action.expandPath && !Array.isArray(parsed)) {
            const extracted = extractValue(parsed, action.expandPath);
            if (!extracted)
                return null;
            try {
                parsed = JSON.parse(extracted);
            }
            catch {
                return null;
            }
        }
        if (!Array.isArray(parsed))
            return null;
        items = parsed.map((el) => flattenItem(el));
    }
    else {
        items = [{}]; // Single row, no item context
    }
    if (items.length === 0)
        return null;
    // Resolve column mappings for each item
    const resolvedRows = [];
    for (const item of items) {
        const itemContext = {
            ...context,
            item: Object.keys(item).length > 0 ? item : undefined,
        };
        const row = {};
        for (const [destColumn, valueTemplate] of Object.entries(action.columns)) {
            row[destColumn] = resolveTemplate(valueTemplate, itemContext, onMissing);
        }
        resolvedRows.push(row);
    }
    // Read destination tab to determine row positions
    let destHeaders;
    let destRows;
    try {
        destHeaders = await adapter.getHeaders(destRef);
        destRows = await adapter.readRows(destRef);
    }
    catch {
        return `error: tab "${action.destTab}" not found or not accessible`;
    }
    // Force text mode for values that Google Sheets would misinterpret as
    // numbers or formulas (e.g. phone numbers like "+46 8 797 75 00").
    // A leading single quote tells Sheets to treat the value as plain text
    // without displaying the quote itself (only works with USER_ENTERED mode).
    const forceText = (val) => {
        if (/^[+=]/.test(val) || /^-\d/.test(val))
            return `'${val}`;
        return val;
    };
    const mode = action.mode ?? "append";
    let writtenCount = 0;
    if (mode === "append") {
        const updates = [];
        for (let i = 0; i < resolvedRows.length; i++) {
            // Next empty row: existing data rows + header row + 1-indexed offset + position in batch
            const sheetRow = destRows.length + 2 + i;
            const resolvedRow = resolvedRows[i];
            for (const [col, val] of Object.entries(resolvedRow)) {
                if (val !== "" && destHeaders.includes(col)) {
                    updates.push({ row: sheetRow, column: col, value: forceText(val) });
                }
            }
            writtenCount++;
        }
        if (updates.length > 0 && !dryRun) {
            await adapter.writeBatch(destRef, updates);
        }
    }
    else {
        // upsert
        if (!action.upsertMatch?.column || !action.upsertMatch?.value) {
            return "error: upsert requires upsertMatch.column and upsertMatch.value";
        }
        for (const resolvedRow of resolvedRows) {
            const matchVal = resolveTemplate(action.upsertMatch.value, context, onMissing);
            // Find existing row in destination
            const existingIndex = destRows.findIndex((r) => r[action.upsertMatch.column] === matchVal);
            const updates = [];
            // Update existing row or append after last row
            const sheetRow = existingIndex >= 0 ? existingIndex + 2 : destRows.length + 2;
            for (const [col, val] of Object.entries(resolvedRow)) {
                if (destHeaders.includes(col)) {
                    updates.push({ row: sheetRow, column: col, value: forceText(val) });
                }
            }
            if (updates.length > 0 && !dryRun) {
                await adapter.writeBatch(destRef, updates);
            }
            // Track appended rows so subsequent upserts in the same action don't duplicate
            if (existingIndex < 0) {
                destRows.push(resolvedRow);
            }
            writtenCount++;
        }
    }
    const verb = mode === "upsert" ? "upserted" : "wrote";
    return `${verb} ${writtenCount} row${writtenCount !== 1 ? "s" : ""} to ${action.destTab}`;
}
