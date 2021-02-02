class GraphNode {
	public get width(): number {
		return this.segmentIndexes.length;
	}

	public get waterLevel(): number {
		return this.waterVolume / this.width;
	}

	public get level(): number {
		return this.baseLevel + this.waterLevel;
	}

	constructor(
		public segmentIndexes: number[],
		public waterVolume: number = 0,
		public excessiveWaterVolume: number = 0,
		public baseLevel: number = 0
	) {}
}

const landscape = Array(10000)
	.fill(1)
	.map((_, i) => i);

let graph = createGraph(1, landscape);
graph = mergeSameLevelNeighbors(graph);
graph = processGraph(graph);

console.log(
	landscape
		.map((_, index) => graph.find((node) => node.segmentIndexes.includes(index))?.level)
		.slice(0, 100)
);

function createGraph(hours: number, landscape: number[]): GraphNode[] {
	const leftWall = new GraphNode([-1], 0, -Infinity, Infinity);
	const rightWall = new GraphNode([landscape.length], 0, -Infinity, Infinity);

	return landscape
		.map((height, index) => [index, height])
		.map(([index, height]) => new GraphNode([index], 0, hours, height))
		.sort(compareByLevel)
		.concat([leftWall, rightWall]);
}

function processGraph(nodes: GraphNode[]): GraphNode[] {
	let excessiveWaterTotal = nodes
		.filter(({ excessiveWaterVolume }) => isFinite(excessiveWaterVolume))
		.reduce((sum, { excessiveWaterVolume }) => sum + excessiveWaterVolume, 0);

	// pass from top to bottom
	let current = head(nodes);
	let rest = tail(nodes) ?? [];
	while (current && excessiveWaterTotal > 0) {
		let prevNode = prev(current, nodes);
		let nextNode = next(current, nodes);

		if (prevNode && nextNode) {
			const currentIndex = nodes.indexOf(current);
			const prevIndex = nodes.indexOf(prevNode);
			const nextIndex = nodes.indexOf(nextNode);
			const excessiveWaterVolume = current.excessiveWaterVolume;

			if (excessiveWaterVolume > 0) {
				if (current.level > prevNode.level && current.level > nextNode.level) {
					/* case hill */
					[current, prevNode] = flowWater(0.5 * excessiveWaterVolume, current, prevNode);
					[current, nextNode] = flowWater(0.5 * excessiveWaterVolume, current, nextNode);

					nodes = setAt(prevIndex, prevNode, nodes);
					nodes = setAt(nextIndex, nextNode, nodes);
					nodes = setAt(currentIndex, current, nodes);
					rest = nodes.slice(currentIndex + 1);
				} else if (current.level > prevNode.level) {
					/* case slope */
					[current, prevNode] = flowWater(excessiveWaterVolume, current, prevNode);

					nodes = setAt(currentIndex, current, nodes);
					nodes = setAt(prevIndex, prevNode, nodes);
					rest = nodes.slice(currentIndex + 1);
				} else if (current.level > nextNode.level) {
					/* case slope */
					[current, nextNode] = flowWater(excessiveWaterVolume, current, nextNode);

					nodes = setAt(currentIndex, current, nodes);
					nodes = setAt(nextIndex, nextNode, nodes);
					rest = nodes.slice(currentIndex + 1);
				} else {
					/* case pit */
					const delta = calculateWaterVolumeDelta(current, nodes);

					excessiveWaterTotal -= delta;
					current = fillPitWithWater(delta, current);

					nodes = setAt(currentIndex, current, nodes);
					rest = nodes.slice(currentIndex + 1);
				}
			}

			if (current.level === prevNode.level || current.level === nextNode.level) {
				/* case same level */
				const neighbor = current.level === prevNode.level ? prevNode : nextNode;

				current = mergeNodes(current, neighbor);

				nodes = setAt(currentIndex, current, nodes);
				nodes = removeAt(neighbor === prevNode ? prevIndex : nextIndex, nodes);
				rest = nodes.slice(currentIndex + 1);

				continue; // try to greedy merge more neighbors
			}
		}

		current = head(rest);
		rest = tail(rest) ?? [];
	}

	// pass from bottom to top
	nodes = reverse(nodes);
	current = head(nodes);
	rest = tail(nodes) ?? [];
	while (current && excessiveWaterTotal > 0) {
		const prevNode = prev(current, nodes);
		const nextNode = next(current, nodes);

		if (prevNode && nextNode) {
			const currentIndex = nodes.indexOf(current);

			if (current.excessiveWaterVolume > 0) {
				const delta = calculateWaterVolumeDelta(current, nodes);

				excessiveWaterTotal -= delta;
				current = fillPitWithWater(delta, current);

				nodes = setAt(currentIndex, current, nodes);
				rest = nodes.slice(currentIndex + 1);
			}

			if (current.level === prevNode.level || current.level === nextNode.level) {
				/* case same level */
				const neighbor = current.level === prevNode.level ? prevNode : nextNode;

				current = mergeNodes(current, neighbor);

				nodes = setAt(currentIndex, current, nodes);
				nodes = removeAt(nodes.indexOf(neighbor), nodes);
				rest = nodes.slice(currentIndex + 1);

				continue; // try to greedy merge more neighbors
			}
		}

		current = head(rest);
		rest = tail(rest) ?? [];
	}
	nodes = reverse(nodes);

	return nodes;
}

function compareByLevel(a: GraphNode, b: GraphNode): number {
	return b.level - a.level;
}

function next(node: GraphNode | undefined, nodes: GraphNode[]): GraphNode | undefined {
	if (!node) {
		return;
	}

	const last = node.segmentIndexes[node.segmentIndexes.length - 1];
	return nodes.find((node) => node.segmentIndexes.includes(last + 1));
}

function prev(node: GraphNode | undefined, nodes: GraphNode[]): GraphNode | undefined {
	if (!node) {
		return;
	}

	const first = node.segmentIndexes[0];
	return nodes.find((node) => node.segmentIndexes.includes(first - 1));
}

function depth(node: GraphNode, nodes: GraphNode[]): number {
	const prevNode = prev(node, nodes);
	const nextNode = next(node, nodes);

	if (!prevNode || !nextNode) {
		return 0;
	}

	return node.level < prevNode.level && node.level < nextNode.level
		? Math.min(prevNode.level, nextNode.level) - node.level
		: 0;
}

function mergeSameLevelNeighbors(nodes: GraphNode[]): GraphNode[] {
	let current = head(nodes);
	let rest = tail(nodes) ?? [];
	let processed: GraphNode[] = [];

	while (current) {
		const nextNode = next(current, nodes);

		if (nextNode && current.level === nextNode.level) {
			const merged = mergeNodes(current, nextNode);

			if (rest.includes(nextNode)) {
				rest = setAt(rest.indexOf(nextNode), merged, rest);
			} else {
				processed.push(merged);
			}
		} else {
			processed.push(current);
		}

		current = head(rest);
		rest = tail(rest) ?? [];
	}

	return processed;
}

function mergeNodes(node: GraphNode, otherNode: GraphNode): GraphNode {
	const segmentIndexes = node.segmentIndexes.concat(otherNode.segmentIndexes);

	return new GraphNode(
		[...new Int32Array(segmentIndexes).sort()],
		0,
		node.excessiveWaterVolume + otherNode.excessiveWaterVolume,
		node.level
	);
}

function flowWater(amount: number, from: GraphNode, to: GraphNode): [GraphNode, GraphNode] {
	return amount === 0
		? [from, to]
		: [
				new GraphNode(
					from.segmentIndexes,
					from.waterVolume,
					from.excessiveWaterVolume - amount,
					from.baseLevel
				),
				new GraphNode(
					to.segmentIndexes,
					to.waterVolume,
					to.excessiveWaterVolume + amount,
					to.baseLevel
				),
		  ];
}

function calculateWaterVolumeDelta(node: GraphNode, nodes: GraphNode[]): number {
	const freeVolume = node.width * depth(node, nodes) - node.waterVolume;
	return Math.min(node.excessiveWaterVolume, freeVolume);
}

function fillPitWithWater(amount: number, node: GraphNode): GraphNode {
	return amount === 0
		? node
		: new GraphNode(
				node.segmentIndexes,
				node.waterVolume + amount,
				node.excessiveWaterVolume - amount,
				node.baseLevel
		  );
}

/* Utility functions */

function head<T>(array: T[]): T | undefined {
	return array.length === 0 ? undefined : array[0];
}

function tail<T>(array: T[]): T[] | undefined {
	return array.length === 0 ? undefined : array.slice(1);
}

function reverse<T>(array: T[]): T[] {
	return [...array].reverse();
}

function setAt<T>(index: number, elem: T, array: T[]): T[] {
	return array[index] === elem
		? array
		: [...array.slice(0, index), elem, ...array.slice(index + 1)];
}
function removeAt<T>(index: number, array: T[]): T[] {
	return [...array.slice(0, index), ...array.slice(index + 1)];
}
