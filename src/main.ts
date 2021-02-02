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

(function main() {
	if (typeof window === 'undefined') {
		// we're in NodeJs
		console.log(calculateWaterLevels(1, [3, 1, 6, 4, 8, 9]));
		return;
	}
	// browser code
	window.onload = () => {
		const form = window.document.querySelector('form');
		if (!form) {
			throw new Error('Cannot the form element on the page');
		}

		const result = window.document.querySelector('#result');
		if (!result) {
			throw new Error('Cannot the #result element on the page');
		}

		const random = window.document.querySelector('#random') as HTMLButtonElement | null;
		if (!random) {
			throw new Error('Cannot the #random button');
		}

		form.onsubmit = (event) => submitHandler(event, form, result);
		random.onclick = () => randomClickHandler(form, result);
	};
})();

function randomClickHandler(form: HTMLFormElement, result: Element) {
	const input = form.querySelector('#landscape') as HTMLInputElement | null;
	if (!input) {
		throw new Error('Cannot the #landscape input');
	}

	const length = randomIntFromInterval(4, 8);

	input.value = stringifyResult(
		Array(length)
			.fill(0)
			.map((_) => randomIntFromInterval(1, 10))
	);
	result.textContent = '';
}

function submitHandler(event: Event, form: HTMLFormElement, result: Element) {
	event.preventDefault();

	const formData = new FormData(form);
	const landscapeRaw = String(formData.get('landscape'));
	const landscape = parseLandscapeData(landscapeRaw);

	if (landscape.some(isNaN)) {
		const error = `Cannot parse landscape data:  ${JSON.stringify(landscapeRaw)}`;
		console.error(error);
		result.textContent = `error:\n\t${error}`;
		return;
	}

	const hoursRaw = String(formData.get('hours'));
	const hours = parseInt(hoursRaw, 10);

	if (isNaN(hours)) {
		const error = `Cannot parse hours data: ${JSON.stringify(hoursRaw)}`;
		console.error(error);
		result.textContent = `error:\n\t${error}`;
		return;
	}

	const { levels, waterLevels } = calculateWaterLevels(hours, landscape);

	result.textContent = `levels\n\t${stringifyResult(levels)}\n\n`;
	result.textContent += `waterLevels\n\t${stringifyResult(waterLevels)}`;
}

function stringifyResult(levels: number[]): string {
	return levels
		.map((x) =>
			Math.floor(x) === x
				? x.toString()
				: x.toLocaleString('en-US', { maximumFractionDigits: 3, minimumFractionDigits: 1 })
		)
		.reduce((a, b) => `${a}, ${b}`);
}

function parseLandscapeData(str: string): number[] {
	return str
		.split(',')
		.map((token) => token.trim())
		.map(parseFloat);
}

function calculateWaterLevels(
	hours: number,
	landscape: number[]
): {
	waterLevels: number[];
	levels: number[];
} {
	let graph = createGraph(hours, landscape);
	graph = mergeSameLevelNeighbors(graph);
	graph = processGraph(graph);

	const levels = landscape.map(
		(_, index) =>
			graph.find((node) => sortedNonEmptyArrayIncludes(index, node.segmentIndexes))!.level
	);

	const waterLevels = landscape.map((height, index) => levels[index] - height);

	return { levels, waterLevels };
}

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
		let [prevNode, prevIndex] = prev(current, nodes);
		let [nextNode, nextIndex] = next(current, nodes);

		if (prevNode && nextNode) {
			const currentIndex = nodes.indexOf(current);

			if (current.level > prevNode.level && current.level > nextNode.level) {
				/* case hill */
				({ current, rest, nodes, prevNode, nextNode } = updateHill({
					prevNode,
					prevIndex,
					nextNode,
					nextIndex,
					current,
					currentIndex,
					nodes,
				}));
			} else if (current.level > prevNode.level) {
				/* case slope left */
				({ current, rest, nodes, prevNode } = updateSlopeLeft({
					prevNode,
					prevIndex,
					current,
					currentIndex,
					nodes,
				}));
			} else if (current.level > nextNode.level) {
				/* case slope right */
				({ current, rest, nodes, nextNode } = updateSlopeRight({
					nextNode,
					nextIndex,
					current,
					currentIndex,
					nodes,
				}));
			} else if (current.level < prevNode.level && current.level < nextNode.level) {
				/* case pit */
				({ current, rest, nodes, excessiveWaterTotal } = updatePit({
					excessiveWaterTotal,
					current,
					currentIndex,
					nodes,
				}));
			}

			if (current.level === prevNode.level || current.level === nextNode.level) {
				/* case same level */
				({ current, rest, nodes } = updateSameLevel({
					prevNode,
					prevIndex,
					nextNode,
					nextIndex,
					current,
					currentIndex,
					nodes,
				}));

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
		const [prevNode, prevIndex] = prev(current, nodes);
		const [nextNode, nextIndex] = next(current, nodes);

		if (prevNode && nextNode) {
			const currentIndex = nodes.indexOf(current);

			if (current.level < prevNode.level && current.level < nextNode.level) {
				/* case pit */
				({ current, rest, nodes, excessiveWaterTotal } = updatePit({
					excessiveWaterTotal,
					current,
					currentIndex,
					nodes,
				}));
			}

			if (current.level === prevNode.level || current.level === nextNode.level) {
				/* case same level */
				({ current, rest, nodes } = updateSameLevel({
					prevNode,
					prevIndex,
					nextNode,
					nextIndex,
					current,
					currentIndex,
					nodes,
				}));

				continue; // try to greedy merge more neighbors
			}
		}

		current = head(rest);
		rest = tail(rest) ?? [];
	}
	nodes = reverse(nodes);

	return nodes;
}

function updateHill({
	prevNode,
	prevIndex,
	nextNode,
	nextIndex,
	current,
	currentIndex,
	nodes,
}: {
	prevNode: GraphNode;
	prevIndex: number;
	nextNode: GraphNode;
	nextIndex: number;
	current: GraphNode;
	currentIndex: number;
	nodes: GraphNode[];
}): {
	current: GraphNode;
	rest: GraphNode[];
	nodes: GraphNode[];
	prevNode: GraphNode;
	nextNode: GraphNode;
} {
	const excessiveWaterVolume = current.excessiveWaterVolume;

	[current, prevNode] = flowWater(0.5 * excessiveWaterVolume, current, prevNode);
	[current, nextNode] = flowWater(0.5 * excessiveWaterVolume, current, nextNode);

	nodes = setAt(prevIndex, prevNode, nodes);
	nodes = setAt(nextIndex, nextNode, nodes);
	nodes = setAt(currentIndex, current, nodes);
	const rest = nodes.slice(currentIndex + 1);

	return { current, rest, nodes, prevNode, nextNode };
}

function updateSlopeLeft({
	prevNode,
	prevIndex,
	current,
	currentIndex,
	nodes,
}: {
	prevNode: GraphNode;
	prevIndex: number;
	current: GraphNode;
	currentIndex: number;
	nodes: GraphNode[];
}): {
	current: GraphNode;
	rest: GraphNode[];
	nodes: GraphNode[];
	prevNode: GraphNode;
} {
	[current, prevNode] = flowWater(current.excessiveWaterVolume, current, prevNode);

	nodes = setAt(currentIndex, current, nodes);
	nodes = setAt(prevIndex, prevNode, nodes);
	const rest = nodes.slice(currentIndex + 1);

	return { current, rest, nodes, prevNode };
}

function updateSlopeRight({
	nextNode,
	nextIndex,
	current,
	currentIndex,
	nodes,
}: {
	nextNode: GraphNode;
	nextIndex: number;
	current: GraphNode;
	currentIndex: number;
	nodes: GraphNode[];
}): {
	current: GraphNode;
	rest: GraphNode[];
	nodes: GraphNode[];
	nextNode: GraphNode;
} {
	[current, nextNode] = flowWater(current.excessiveWaterVolume, current, nextNode);

	nodes = setAt(currentIndex, current, nodes);
	nodes = setAt(nextIndex, nextNode, nodes);

	const rest = nodes.slice(currentIndex + 1);

	return { current, rest, nodes, nextNode };
}

function updatePit({
	excessiveWaterTotal,
	current,
	currentIndex,
	nodes,
}: {
	excessiveWaterTotal: number;
	current: GraphNode;
	currentIndex: number;
	nodes: GraphNode[];
}): {
	current: GraphNode;
	rest: GraphNode[];
	nodes: GraphNode[];
	excessiveWaterTotal: number;
} {
	const delta = calculateWaterVolumeDelta(current, nodes);

	excessiveWaterTotal -= delta;
	current = fillPitWithWater(delta, current);
	nodes = setAt(currentIndex, current, nodes);

	const rest = nodes.slice(currentIndex + 1);

	return { current, rest, nodes, excessiveWaterTotal };
}

function updateSameLevel({
	prevNode,
	prevIndex,
	nextNode,
	nextIndex,
	current,
	currentIndex,
	nodes,
}: {
	prevNode: GraphNode;
	prevIndex: number;
	nextNode: GraphNode;
	nextIndex: number;
	current: GraphNode;
	currentIndex: number;
	nodes: GraphNode[];
}): { current: GraphNode; rest: GraphNode[]; nodes: GraphNode[] } {
	const [neighbor, neighborIndex] =
		current.level === prevNode.level ? [prevNode, prevIndex] : [nextNode, nextIndex];

	current = mergeNodes(current, neighbor);
	nodes = setAt(currentIndex, current, nodes);
	nodes = removeAt(neighborIndex, nodes);

	const rest = nodes.slice(currentIndex + 1);

	return { current, rest, nodes };
}

function compareByLevel(a: GraphNode, b: GraphNode): number {
	return b.level - a.level;
}

function next(node: GraphNode | undefined, nodes: GraphNode[]): [GraphNode | undefined, number] {
	if (!node || node.segmentIndexes.length === 0) {
		return [undefined, -1];
	}

	const last = node.segmentIndexes[node.segmentIndexes.length - 1];
	const index = nodes.findIndex((node) =>
		sortedNonEmptyArrayIncludes(last + 1, node.segmentIndexes)
	);
	return [nodes[index], index];
}

function prev(node: GraphNode | undefined, nodes: GraphNode[]): [GraphNode | undefined, number] {
	if (!node || node.segmentIndexes.length === 0) {
		return [undefined, -1];
	}

	const first = head(node.segmentIndexes)!;
	const index = nodes.findIndex((node) =>
		sortedNonEmptyArrayIncludes(first - 1, node.segmentIndexes)
	);

	return [nodes[index], index];
}

function depth(node: GraphNode, nodes: GraphNode[]): number {
	const [prevNode] = prev(node, nodes);
	const [nextNode] = next(node, nodes);

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
		const [nextNode] = next(current, nodes);

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
	const segmentIndexes =
		head(node.segmentIndexes)! < head(otherNode.segmentIndexes)!
			? node.segmentIndexes.concat(otherNode.segmentIndexes)
			: otherNode.segmentIndexes.concat(node.segmentIndexes);

	return new GraphNode(
		segmentIndexes,
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

function sortedNonEmptyArrayIncludes(elem: number, array: number[]): boolean {
	return elem >= head(array)! && elem < head(array)! + array.length;
}

function randomIntFromInterval(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1) + min);
}
