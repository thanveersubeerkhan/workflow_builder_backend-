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

function getObjectPath(obj: any, path: string): any {
  return path.split('.').reduce((prev, curr) => {
    return prev ? prev[curr] : undefined;
  }, obj);
}
