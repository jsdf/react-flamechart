function idToString(input, length = 10) {
    // drop first char because more entropy is in the low bits, but we want the prefixes of the strings to be more varied
    return input.toString(36).slice(1, length + 1);
}
function generateNode() {
    // hash this value to distribute values a bit
    const id = Math.floor(performance.now() + Math.random() * 10000000000);
    return {
        id,
        label: idToString(id),
        weightExcl: Math.random() * 10,
        weightIncl: 0,
        children: [],
    };
}
export function generateTree(opts, parent = generateNode(), depth = 0) {
    const fanout = Math.floor(Math.random() * (opts.fanout - 1)) + 1;
    for (let i = 0; i < fanout; i++) {
        const node = generateNode();
        parent.children.push(node);
        if (depth < opts.maxDepth) {
            generateTree(opts, node, depth + 1);
        }
    }
    return parent;
}
export const largeTree = generateTree({ maxDepth: 16, fanout: 3 });
