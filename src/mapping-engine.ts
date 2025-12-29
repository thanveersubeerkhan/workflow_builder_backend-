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

  const result = input.replace(/\{\{(.+?)\}\}/g, (match, path) => {
    const val = getObjectPath(context, path.trim());
    console.log(`[Mapping] Resolving "{{${path.trim()}}}" -> ${val === undefined ? 'UNDEFINED' : JSON.stringify(val)}`);
    return val ?? match;
  });
  return result;
}

export function evaluateCondition(expression: string, context: any): boolean {
  const resolved = resolveVariables(expression, context);
  if (resolved === 'true' || resolved === true) return true;
  if (resolved === 'false' || resolved === false) return false;
  return !!resolved;
}

function getObjectPath(obj: any, path: string): any {
  if (!path || !obj) return undefined;
  // Convert [index] to .index for easier splitting
  const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
  const parts = normalizedPath.split('.');
  
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}
