import type { GraphEdge, GraphNode, TreeNode, ID } from "./types";

export function buildTreeFromGraph(
  nodes: Array<GraphNode>,
  edges: Array<GraphEdge>
): TreeNode {
  const nodesMap = new Map<ID, TreeNode>();
  nodes.forEach((node) => {
    if (nodesMap.has(node.id)) {
      throw new Error("duplicate node id " + node.id);
    }

    const { weight, ...rest } = node;
    nodesMap.set(node.id, {
      ...rest,
      weightIncl: 0,
      weightExcl: weight,
      children: [],
    });
  });

  const nodesWithParents = new Set();
  edges.forEach(([from, to]) => {
    if (from == null) throw new Error("from is null");
    if (to == null) throw new Error("to is null");
    const fromNode = nodesMap.get(from);
    const toNode = nodesMap.get(to);
    if (fromNode == null) throw new Error("fromNode is null");
    if (toNode == null) throw new Error("toNode is null");
    fromNode.children.push(toNode);
    nodesWithParents.add(to);
  });

  const possibleRoots = [...nodesMap.values()].filter(
    (node) => !nodesWithParents.has(node.id) // a node with no parent could be the root
  );

  if (possibleRoots.length === 0) {
    throw new Error(
      "no node without a parent found. this is graph, not a tree"
    );
  } else if (possibleRoots.length === 1) {
    return possibleRoots[0];
  } else {
    throw new Error(
      `multiple nodes without a parent found (${possibleRoots
        .map((r) => r.id)
        .join()}), nodesWithParents=${JSON.stringify([
        ...nodesWithParents,
      ])}. this is not a single tree.`
    );
  }
}

export function calcTreeInclusiveWeights(tree: TreeNode): number {
  const childWeightTotal = tree.children.reduce(
    (acc, child) => acc + calcTreeInclusiveWeights(child),
    0
  );

  tree.weightIncl = childWeightTotal + tree.weightExcl;

  return tree.weightIncl;
}
