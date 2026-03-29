"use client";

import { useState, useCallback } from "react";
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  MarkerType,
  BackgroundVariant,
  MiniMap,
} from "reactflow";
import "reactflow/dist/style.css";
import { N8nWorkflow, Issue, NodeTrace, NodeCoverage } from "@/types";

interface Props {
  workflow: N8nWorkflow;
  issues: Issue[];
  nodeTraces: NodeTrace[];
  coverageClassification: NodeCoverage[];
  /** Report page: use shared `.report-graph-card` surface instead of the default dark card. */
  embedded?: boolean;
}

function getNodeStatus(
  nodeName: string,
  issues: Issue[],
  traces: NodeTrace[],
  coverage: NodeCoverage[],
) {
  const trace = traces.find((t) => t.nodeName === nodeName);
  const nodeIssues = issues.filter((i) => i.nodeName === nodeName);
  const criticalIssues = nodeIssues.filter(
    (i) => i.severity === "critical" || i.severity === "high",
  );
  const cov = coverage.find((c) => c.nodeName === nodeName);

  if (trace?.status === "error") {
    return {
      border: "#f0436e",
      bg: "rgba(240,67,110,0.12)",
      label: "#fca5a5",
      dot: "#f0436e",
      category: "error",
    };
  }
  if (criticalIssues.length > 0) {
    return {
      border: "#f0436e",
      bg: "rgba(240,67,110,0.08)",
      label: "#f87171",
      dot: "#f0436e",
      category: "issue-high",
    };
  }
  const mediumIssues = nodeIssues.filter((i) => i.severity === "medium");
  if (mediumIssues.length > 0) {
    return {
      border: "#f5b942",
      bg: "rgba(245,185,66,0.08)",
      label: "#fcd34d",
      dot: "#f5b942",
      category: "issue-med",
    };
  }
  if (
    trace?.status === "blocked" ||
    cov?.class === "credential_blocked"
  ) {
    return {
      border: "rgba(255,255,255,0.08)",
      bg: "rgba(255,255,255,0.03)",
      label: "#4a4660",
      dot: "#2e2b3a",
      category: "blocked",
    };
  }
  if (trace?.status === "success") {
    return {
      border: "#2ecf96",
      bg: "rgba(46,207,150,0.08)",
      label: "#6ee7b7",
      dot: "#2ecf96",
      category: "success",
    };
  }
  if (nodeIssues.length > 0) {
    return {
      border: "#42b0f5",
      bg: "rgba(66,176,245,0.06)",
      label: "#93c5fd",
      dot: "#42b0f5",
      category: "issue-low",
    };
  }
  return {
    border: "rgba(255,255,255,0.09)",
    bg: "rgba(255,255,255,0.03)",
    label: "#6b6480",
    dot: "#302d40",
    category: "clean",
  };
}

function buildNodes(
  workflow: N8nWorkflow,
  issues: Issue[],
  traces: NodeTrace[],
  coverage: NodeCoverage[],
): Node[] {
  return workflow.nodes
    .filter(
      (n) =>
        n.type !== "n8n-nodes-base.stickyNote" &&
        n.type.toLowerCase() !== "n8n-nodes-base.stickynote",
    )
    .map((n) => {
      const status = getNodeStatus(n.name, issues, traces, coverage);
      const nodeIssues = issues.filter((i) => i.nodeName === n.name);
      const shortType = n.type.split(".").pop() ?? n.type;

      return {
        id: n.id,
        position: { x: n.position[0], y: n.position[1] },
        data: {
          label: n.name,
          type: shortType,
          issueCount: nodeIssues.length,
          status,
        },
        type: "drygate",
        style: {
          background: "transparent",
          border: "none",
          padding: 0,
          width: 172,
        },
      };
    });
}

function buildEdges(
  workflow: N8nWorkflow,
  visibleNodeIds: Set<string>,
): Edge[] {
  const edges: Edge[] = [];
  let edgeId = 0;

  for (const [sourceName, outputs] of Object.entries(workflow.connections)) {
    const sourceNode = workflow.nodes.find((n) => n.name === sourceName);
    if (!sourceNode || !visibleNodeIds.has(sourceNode.id)) continue;

    for (const [outputType, branches] of Object.entries(outputs)) {
      if (outputType.startsWith("ai_")) continue;
      for (const branch of branches) {
        for (const conn of branch) {
          const targetNode = workflow.nodes.find(
            (n) => n.name === conn.node,
          );
          if (!targetNode || !visibleNodeIds.has(targetNode.id)) continue;

          edges.push({
            id: `e${edgeId++}`,
            source: sourceNode.id,
            target: targetNode.id,
            type: "smoothstep",
            style: {
              stroke: "#3d3a4d",
              strokeWidth: 1.5,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "#3d3a4d",
              width: 12,
              height: 12,
            },
          });
        }
      }
    }
  }
  return edges;
}

// Short human-readable name for node type
function friendlyType(raw: string): string {
  const map: Record<string, string> = {
    webhook: "Webhook",
    httpRequest: "HTTP Request",
    if: "IF",
    switch: "Switch",
    set: "Set",
    code: "Code",
    merge: "Merge",
    splitInBatches: "Split Batches",
    wait: "Wait",
    scheduleTrigger: "Schedule",
    manualTrigger: "Manual",
    telegram: "Telegram",
    telegramTrigger: "Telegram Trigger",
    gmail: "Gmail",
    slack: "Slack",
    openAi: "OpenAI",
    agent: "AI Agent",
    chatTrigger: "Chat Trigger",
    formTrigger: "Form Trigger",
  };
  return map[raw] ?? raw;
}

function DryGateNode({
  data,
}: {
  data: {
    label: string;
    type: string;
    issueCount: number;
    status: ReturnType<typeof getNodeStatus>;
  };
}) {
  const { status, issueCount, label, type } = data;
  const isBlocked = status.category === "blocked" || status.category === "clean";

  return (
    <div
      style={{
        background: status.bg,
        border: `1px solid ${status.border}`,
        borderRadius: 10,
        padding: "10px 12px",
        width: 172,
        boxShadow:
          status.category !== "blocked" && status.category !== "clean"
            ? `0 0 16px ${status.dot}22, inset 0 1px 0 rgba(255,255,255,0.06)`
            : "inset 0 1px 0 rgba(255,255,255,0.04)",
        backdropFilter: "blur(4px)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top glow strip for issues */}
      {!isBlocked && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: status.dot,
            opacity: 0.7,
            borderRadius: "10px 10px 0 0",
          }}
        />
      )}

      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 5,
        }}
      >
        {/* Status dot */}
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: status.dot,
            flexShrink: 0,
            boxShadow:
              !isBlocked ? `0 0 6px ${status.dot}` : "none",
          }}
        />

        {/* Node name */}
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: status.label,
            fontFamily: "'DM Sans', sans-serif",
            letterSpacing: "-0.01em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            lineHeight: 1.3,
          }}
        >
          {label}
        </span>

        {/* Issue count badge */}
        {issueCount > 0 && (
          <div
            style={{
              minWidth: 18,
              height: 18,
              borderRadius: 5,
              background: `${status.dot}28`,
              border: `1px solid ${status.dot}55`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 700,
              color: status.dot,
              flexShrink: 0,
              padding: "0 4px",
            }}
          >
            {issueCount}
          </div>
        )}
      </div>

      {/* Node type */}
      <div
        style={{
          fontSize: 10,
          color: isBlocked ? "#2e2b3a" : "#3d3a4d",
          fontFamily: "'DM Mono', monospace",
          letterSpacing: "0.03em",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {friendlyType(type)}
      </div>
    </div>
  );
}

const nodeTypes = { drygate: DryGateNode };

function GraphCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  isModal = false,
}: {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: ReturnType<typeof useNodesState>[2];
  onEdgesChange: ReturnType<typeof useEdgesState>[2];
  isModal?: boolean;
}) {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: isModal ? 0.15 : 0.25 }}
      minZoom={0.1}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      elevateEdgesOnSelect={false}
      edgesFocusable={false}
      nodesDraggable={false}
      style={{
        background: "transparent",
        width: "100%",
        height: "100%",
      }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={28}
        size={1}
        color="rgba(255,255,255,0.035)"
      />
      {isModal && (
        <Controls
          style={{
            background: "rgba(18,16,24,0.9)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            overflow: "hidden",
          }}
        />
      )}
      {isModal && (
        <MiniMap
          style={{
            background: "rgba(14,12,20,0.95)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
          }}
          maskColor="rgba(0,0,0,0.6)"
          nodeColor={(n) => {
            const status = (n.data as { status: ReturnType<typeof getNodeStatus> }).status;
            return status.dot;
          }}
        />
      )}
    </ReactFlow>
  );
}

export function WorkflowGraph({
  workflow,
  issues,
  nodeTraces,
  coverageClassification,
  embedded = false,
}: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const visibleIds = new Set(
    workflow.nodes
      .filter(
        (n) =>
          n.type !== "n8n-nodes-base.stickyNote" &&
          n.type.toLowerCase() !== "n8n-nodes-base.stickynote",
      )
      .map((n) => n.id),
  );

  const initialNodes = buildNodes(
    workflow,
    issues,
    nodeTraces,
    coverageClassification,
  );
  const initialEdges = buildEdges(workflow, visibleIds);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  if (!workflow?.nodes?.length) return null;

  const visibleNodeCount = visibleIds.size;
  const issueNodeCount = new Set(issues.map((i) => i.nodeId)).size;

  return (
    <>
      {/* ── Card ── */}
      <div
        className={embedded ? "report-graph-card" : undefined}
        style={
          embedded
            ? { overflow: "hidden" }
            : {
                background: "rgba(14,12,20,0.8)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16,
                overflow: "hidden",
              }
        }
      >
        {/* Header */}
        <div
          style={{
            padding: embedded ? "0 0 14px 0" : "14px 18px",
            marginBottom: embedded ? 0 : undefined,
            borderBottom: embedded ? "none" : "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span
              className={embedded ? "report-card-label" : undefined}
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                color: embedded ? undefined : "rgba(255,255,255,0.25)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              Workflow graph
            </span>
            <span
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                color: embedded ? "var(--text-muted)" : "rgba(255,255,255,0.18)",
              }}
            >
              {visibleNodeCount} nodes · {issueNodeCount} with issues
            </span>
          </div>

          <div
            style={{ display: "flex", alignItems: "center", gap: 16 }}
          >
            {/* Legend */}
            <div
              style={{
                display: "flex",
                gap: 12,
                fontSize: 10,
                fontFamily: "'DM Mono', monospace",
              }}
            >
              {[
                { color: "#f0436e", label: "Issues" },
                { color: "#2ecf96", label: "Passed" },
                { color: "#3d3a4d", label: "Blocked" },
              ].map(({ color, label }) => (
                <span
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    color: embedded ? "var(--text-muted)" : "rgba(255,255,255,0.25)",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: color,
                      display: "inline-block",
                    }}
                  />
                  {label}
                </span>
              ))}
            </div>

            {/* Expand button */}
            <button
              onClick={() => setIsModalOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 12px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 7,
                cursor: "pointer",
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                color: "rgba(255,255,255,0.4)",
                letterSpacing: "0.04em",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "rgba(255,255,255,0.08)";
                (e.currentTarget as HTMLButtonElement).style.color =
                  "rgba(255,255,255,0.7)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "rgba(255,255,255,0.04)";
                (e.currentTarget as HTMLButtonElement).style.color =
                  "rgba(255,255,255,0.4)";
              }}
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 11 11"
                fill="none"
              >
                <path
                  d="M1 4V1H4M7 1H10V4M10 7V10H7M4 10H1V7"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Expand
            </button>
          </div>
        </div>

        {/* Graph area */}
        <div style={{ height: 320, position: "relative" }}>
          {/* Subtle vignette edges */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse 90% 80% at 50% 50%, transparent 60%, rgba(9,9,13,0.4) 100%)",
              pointerEvents: "none",
              zIndex: 5,
            }}
          />
          <GraphCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
          />
        </div>
      </div>

      {/* ── Modal ── */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          {/* Backdrop */}
          <div
            onClick={() => setIsModalOpen(false)}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.75)",
              backdropFilter: "blur(6px)",
            }}
          />

          {/* Modal panel */}
          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 1200,
              height: "85vh",
              background: "rgba(11,10,16,0.98)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow:
                "0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)",
            }}
          >
            {/* Modal header */}
            <div
              style={{
                padding: "16px 22px",
                borderBottom: "1px solid rgba(255,255,255,0.07)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 11,
                    color: "rgba(255,255,255,0.3)",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  Workflow graph
                </span>
                <span
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 11,
                    color: "rgba(255,255,255,0.18)",
                  }}
                >
                  {visibleNodeCount} nodes · scroll to zoom · drag to pan
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                {/* Legend */}
                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    fontSize: 11,
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  {[
                    { color: "#f0436e", label: "Issues" },
                    { color: "#f5b942", label: "Medium" },
                    { color: "#2ecf96", label: "Passed" },
                    { color: "#3d3a4d", label: "Blocked" },
                  ].map(({ color, label }) => (
                    <span
                      key={label}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        color: "rgba(255,255,255,0.35)",
                      }}
                    >
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: color,
                          boxShadow: `0 0 6px ${color}88`,
                          display: "inline-block",
                        }}
                      />
                      {label}
                    </span>
                  ))}
                </div>

                {/* Close */}
                <button
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 16,
                    lineHeight: 1,
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "rgba(255,255,255,0.12)";
                    (e.currentTarget as HTMLButtonElement).style.color =
                      "#fff";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "rgba(255,255,255,0.06)";
                    (e.currentTarget as HTMLButtonElement).style.color =
                      "rgba(255,255,255,0.5)";
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Graph full size */}
            <div style={{ flex: 1, position: "relative" }}>
              <GraphCanvas
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                isModal
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}