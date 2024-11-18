import { buildTreeFromGraph } from "../buildTree";
const graph = {
    nodes: [
        { id: 0, label: "root", weight: 100 },
        { id: 1, label: "A", weight: 40 },
        { id: 2, label: "AA", weight: 4 },
        { id: 3, label: "B", weight: 4 },
        { id: 4, label: "BA", weight: 3 },
        { id: 5, label: "BAA", weight: 2 },
    ],
    edges: [
        [0, 1],
        [1, 2],
        [0, 3],
        [3, 4],
        [4, 5],
    ],
};
export default buildTreeFromGraph(graph.nodes, graph.edges);
