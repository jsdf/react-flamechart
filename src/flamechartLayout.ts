import { vec2 } from "gl-matrix";
import { DrawRect, TreeNode } from "./types";

const NODE_HEIGHT = 20;
const NODE_WIDTH_SCALE = 2;

function colorScale(value: number) {
    // squash the color range so that single digit percentages still
    // get some color
    // https://www.desmos.com/calculator/ljsmsbirpo
    return Math.pow(value, 0.4);
}

// convert tree to drawRects in unit space
// this can be subsequently transformed (pan and zoom) before rendering
export function treeToRects(
    treeNode: TreeNode,
    pos: vec2, // offset to start this rect at. y accounts for parent height, x accounts for siblings widths
    total: number, // entire tree inclusive weight
    drawRects: Array<DrawRect> = []
): DrawRect {
    // width is weight multiplied by NODE_WIDTH_SCALE, leaving space for gap
    // pos y is parent transform + NODE_HEIGHT
    // pos x is parent transform + sum of sibling width

    const size = vec2.create();
    vec2.set(size, Math.max(0, NODE_WIDTH_SCALE * treeNode.weightIncl), NODE_HEIGHT);
    const normalizedOfTotal = treeNode.weightIncl / total;
    const rect: DrawRect = {
        id: treeNode.id,
        node: treeNode,
        label: treeNode.label + ` (${(normalizedOfTotal * 100).toFixed(2)}%)`,
        backgroundColor: `rgba(255,0,0,${colorScale(normalizedOfTotal)})`,
        pos,
        size,
    };

    drawRects.push(rect);

    let xPos = 0;
    treeNode.children.forEach((child) => {
        const childPos = vec2.clone(pos);
        // pos x for this child is based on accumulated width of previous siblings
        childPos[0] += xPos;
        // pos y for this child offset by parent height
        childPos[1] += NODE_HEIGHT;
        const childRect = treeToRects(child, childPos, total, drawRects);
        // accumulate width of this child
        xPos += childRect.size[0];
    });

    return rect;
}