/**
 * Variable Mapping Engine
 * Resolves strings like "Hello {{steps.trigger.data.sender}}" using context data
 */
export function resolveVariables(input: any, context: any): any {
  if (typeof input !== 'string') {
    // If it's an object or array, recurse
    if (Array.isArray(input)) return input.map(item => resolveVariables(item, context));
    if (typeof input === 'object' && input !== null) {
      const result: Record<string, any> = {};
      for (const key in input) {
        result[key] = resolveVariables(input[key], context);
      }
      return result;
    }
    return input;
  }

  return input.replace(/\{\{(.+?)\}\}/g, (match, path) => {
    return getObjectPath(context, path.trim()) ?? match;
  });
}

export function evaluateCondition(expression: string, context: any): boolean {
  const resolved = resolveVariables(expression, context);
  if (resolved === 'true' || resolved === true) return true;
  if (resolved === 'false' || resolved === false) return false;
  return !!resolved;
}

function getObjectPath(obj: any, path: string): any {
  if (!path) return undefined;
  return path.split('.').reduce((prev, curr) => {
    return prev ? prev[curr] : undefined;
  }, obj);
}
