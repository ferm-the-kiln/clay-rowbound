import { resolveTemplate } from "./template.js";
/**
 * Execute a lookup action: read rows from a source tab, match on a column,
 * and return the value of a specified return column.
 *
 * In "first" mode (default), returns the first matched value as a string.
 * In "all" mode, returns all matched values as a JSON array string.
 */
export async function executeLookup(action, context, options) {
    const { adapter, spreadsheetId, tabDataCache, onMissing } = options;
    // Resolve the match value from templates
    const resolvedMatchValue = resolveTemplate(action.matchValue, context, onMissing);
    if (!resolvedMatchValue)
        return null;
    // Get source tab data (cached across rows within a pipeline run)
    const sourceTab = action.sourceTab;
    if (!tabDataCache.has(sourceTab)) {
        const sourceRef = { spreadsheetId, sheetName: sourceTab };
        const sourceRows = await adapter.readRows(sourceRef);
        tabDataCache.set(sourceTab, sourceRows);
    }
    const sourceRows = tabDataCache.get(sourceTab);
    // Find matching rows
    const operator = action.matchOperator ?? "equals";
    const mode = action.matchMode ?? "first";
    const matches = [];
    for (const sourceRow of sourceRows) {
        const cellValue = sourceRow[action.matchColumn] ?? "";
        let isMatch = false;
        if (operator === "equals") {
            isMatch = cellValue === resolvedMatchValue;
        }
        else {
            isMatch = cellValue.includes(resolvedMatchValue);
        }
        if (isMatch) {
            matches.push(sourceRow);
            if (mode === "first")
                break;
        }
    }
    if (matches.length === 0)
        return null;
    // Extract return values
    if (mode === "first") {
        const val = matches[0][action.returnColumn];
        return val !== undefined && val !== "" ? val : null;
    }
    // "all" mode: return JSON array of the return column values
    const values = matches
        .map((r) => r[action.returnColumn] ?? "")
        .filter((v) => v !== "");
    return values.length > 0 ? JSON.stringify(values) : null;
}
