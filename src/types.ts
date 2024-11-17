import { vec2 } from "gl-matrix";
export type NodeID = string | number;
export type GraphNode = {
  id: NodeID;
  label: string;
  weight: number;
};
export type GraphEdge = [NodeID, NodeID];

export type TreeNode = {
  id: NodeID;
  label: string;
  weightIncl: number;
  weightExcl: number;
  children: Array<TreeNode>;
};
export type Rect = {
  pos: vec2;
  size: vec2;
};
export type DrawRect = Rect & {
  id: NodeID;
  node: TreeNode;
  label?: string | void;
  backgroundColor?: string | void;
};

export type Transform = {
  translate: vec2;
  scale: vec2;
};
