import { Issue, N8nWorkflow } from "@/types";

// Extract all {{ }} expression strings from any parameter value (recursive)
function extractExpressions(value: unknown): string[] {
  if (typeof value === "string") {
    const matches = value.match(/\{\{([\s\S]+?)\}\}/g);
    return matches ? matches.map((m) => m.slice(2, -2).trim()) : [];
  }
  if (Array.isArray(value)) return value.flatMap(extractExpressions);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(extractExpressions);
  }
  return [];
}

// Get all node names in the workflow for dead reference detection
function getAllNodeNames(workflow: N8nWorkflow): Set<string> {
  return new Set(workflow.nodes.map((n) => n.name));
}

// Check 1: $json.a.b with no optional chaining — null reference risk
// Pattern: $json.something.nestedProperty (two or more levels without ?.)
function hasNullReferenceRisk(expr: string): boolean {
  return (
    /\$(?:json|item(?:\(\d+\))?)\.[a-zA-Z_$][a-zA-Z0-9_$]*\.[a-zA-Z_$]/.test(expr) &&
    !expr.includes("?.")
  );
}

// Check 2: Array index access without safety — $json.items[0]
function hasArrayIndexRisk(expr: string): boolean {
  return (
    /\$json\.[a-zA-Z_$][a-zA-Z0-9_$]*\[(?:\d+|[a-zA-Z_$][a-zA-Z0-9_$]*)\]/.test(expr) &&
    !expr.includes("?.") &&
    !expr.includes(".length")
  );
}

// Check 3: $node["NodeName"] referencing a node that doesn't exist
function findDeadNodeReferences(expr: string, nodeNames: Set<string>): string[] {
  const dead: string[] = [];
  const re = /\$node\["([^"]+)"\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(expr)) !== null) {
    const refName = m[1];
    if (!nodeNames.has(refName)) {
      dead.push(refName);
    }
  }
  return dead;
}

// Check 4: Expression used as API param/URL with no fallback
// {{ $json.field }} with no ?? or || operator
function hasMissingFallback(expr: string): boolean {
  return (
    /\$json\.[a-zA-Z_$][a-zA-Z0-9_$.[\]]*/.test(expr) &&
    !expr.includes("??") &&
    !expr.includes("||") &&
    !expr.includes("if(") &&
    !expr.includes("?.") &&
    expr.trim().startsWith("$json.")
  );
}

export function runExpressionChecks(workflow: N8nWorkflow): Issue[] {
  const issues: Issue[] = [];
  const nodeNames = getAllNodeNames(workflow);

  for (const node of workflow.nodes) {
    // Skip sticky notes and manual triggers — no meaningful parameters
    if (
      node.type === "n8n-nodes-base.stickyNote" ||
      node.type.toLowerCase() === "n8n-nodes-base.stickynote" ||
      node.type === "n8n-nodes-base.manualTrigger"
    ) {
      continue;
    }

    const allExpressions = extractExpressions(node.parameters);
    const seenCodes = new Set<string>(); // dedupe per node per code

    for (const expr of allExpressions) {
      // Check 1: Null reference
      const nullKey = `NULL_REF:${node.id}`;
      if (!seenCodes.has(nullKey) && hasNullReferenceRisk(expr)) {
        seenCodes.add(nullKey);
        issues.push({
          issueCode: "EXPRESSION_NULL_REFERENCE",
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          severity: "medium",
          title: `Unsafe property access in "${node.name}"`,
          detail: `Expression accesses nested properties without optional chaining: ${expr.slice(0, 120)}. If the parent field is null or undefined in production, this node will throw a runtime error.`,
          remediationHint: `Use optional chaining: replace .property with ?.property, and add a fallback with ?? 'default'. Example: {{ $json.user?.email ?? '' }}`,
        });
      }

      // Check 2: Array index
      const arrKey = `ARR:${node.id}`;
      if (!seenCodes.has(arrKey) && hasArrayIndexRisk(expr)) {
        seenCodes.add(arrKey);
        issues.push({
          issueCode: "EXPRESSION_ARRAY_INDEX",
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          severity: "medium",
          title: `Array index access without length check in "${node.name}"`,
          detail: `Expression accesses array by index without verifying the array is non-empty: ${expr.slice(0, 120)}. If the upstream node returns zero items, this will throw.`,
          remediationHint: `Check array length first using an IF node, or use optional chaining: {{ $json.items?.[0]?.id ?? null }}`,
        });
      }

      // Check 3: Dead node references
      const deadRefs = findDeadNodeReferences(expr, nodeNames);
      for (const deadRef of deadRefs) {
        const deadKey = `DEAD:${node.id}:${deadRef}`;
        if (!seenCodes.has(deadKey)) {
          seenCodes.add(deadKey);
          issues.push({
            issueCode: "EXPRESSION_DEAD_NODE_REFERENCE",
            nodeId: node.id,
            nodeName: node.name,
            nodeType: node.type,
            severity: "high",
            title: `Expression references non-existent node "${deadRef}"`,
            detail: `Node "${node.name}" contains $node["${deadRef}"] but no node with that name exists in this workflow. This will throw a runtime error on every execution.`,
            remediationHint: `Fix the node name in the expression to match an existing node, or remove the reference if the node was deleted.`,
          });
        }
      }

      // Check 4: Missing fallback (only for simple single-expression params)
      const fallbackKey = `FALLBACK:${node.id}`;
      if (!seenCodes.has(fallbackKey) && hasMissingFallback(expr)) {
        seenCodes.add(fallbackKey);
        issues.push({
          issueCode: "EXPRESSION_MISSING_FALLBACK",
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          severity: "low",
          title: `Expression has no fallback value in "${node.name}"`,
          detail: `Expression {{ ${expr.slice(0, 80)} }} passes a field directly to a parameter with no default. If the field is missing from the input, the parameter receives undefined.`,
          remediationHint: `Add a fallback operator: {{ ${expr.slice(0, 60)} ?? 'your-default' }}`,
        });
      }
    }
  }

  return issues;
}
