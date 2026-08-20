export function enableRules(
    pluginName: string,
    rules: Readonly<Record<string, unknown>>,
): Readonly<Record<string, "error">> {
    const enabledRules: Record<string, "error"> = {};
    for (const ruleName of Object.keys(rules)) {
        enabledRules[`${pluginName}/${ruleName}`] = "error";
    }
    return enabledRules;
}
