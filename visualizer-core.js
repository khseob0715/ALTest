// Shared visualization engine. Page-specific behavior is configured by app.js or student-app.js.
document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    // CanvasRenderingContext2D does not reliably resolve CSS var() expressions.
    // Read the computed values once so every legend color is rendered correctly.
    const rootStyles = getComputedStyle(document.documentElement);
    const cssColor = name => rootStyles.getPropertyValue(name).trim();
    const COLORS = {
        empty: cssColor('--color-empty'),
        wall: cssColor('--color-wall'),
        wallHighlight: cssColor('--color-wall-highlight'),
        wallShadow: cssColor('--color-wall-shadow'),
        frontier: cssColor('--color-frontier'),
        explored: cssColor('--color-explored'),
        current: cssColor('--color-current'),
        path: cssColor('--color-path'),
        rewardPath: cssColor('--color-reward-path'),
        start: cssColor('--color-start'),
        goal: cssColor('--color-goal'),
        goalInactive: cssColor('--color-goal-inactive'),
        agent: cssColor('--color-agent'),
        gridLine: cssColor('--color-grid-line'),
    };

    const CELL_TYPE = {
        EMPTY: 0, WALL: 1, START: 2, GOAL: 3,
        FRONTIER: 4, EXPLORED: 5, CURRENT: 6, PATH: 7, AGENT: 8,
        GREEDY_PATH: 9, REWARD_PATH: 10
    };

    const ANIMATION_SPEEDS = { '-1': 200, 0: 100, 1: 20 }; // Slow, Normal, Fast

    // --- UTILITY CLASSES ---

    class SeededRandom {
        constructor(seed) {
            this.seed = seed % 2147483647;
            if (this.seed <= 0) this.seed += 2147483646;
        }
        next() {
            this.seed = (this.seed * 16807) % 2147483647;
            return this.seed;
        }
        nextFloat() {
            return (this.next() - 1) / 2147483646;
        }
        nextInt(min, max) {
            return min + Math.floor(this.nextFloat() * (max - min));
        }
    }

    class BinaryHeap {
        constructor(scoreFunction) {
            this.content = [];
            this.scoreFunction = scoreFunction;
        }
        push(element) {
            this.content.push(element);
            this.bubbleUp(this.content.length - 1);
        }
        pop() {
            const result = this.content[0];
            const end = this.content.pop();
            if (this.content.length > 0) {
                this.content[0] = end;
                this.sinkDown(0);
            }
            return result;
        }
        size() {
            return this.content.length;
        }
        bubbleUp(n) {
            const element = this.content[n];
            while (n > 0) {
                const parentN = Math.floor((n + 1) / 2) - 1;
                const parent = this.content[parentN];
                if (this.scoreFunction(element) >= this.scoreFunction(parent)) break;
                this.content[parentN] = element;
                this.content[n] = parent;
                n = parentN;
            }
        }
        sinkDown(n) {
            const length = this.content.length;
            const element = this.content[n];
            const elemScore = this.scoreFunction(element);

            while (true) {
                const child2N = (n + 1) * 2;
                const child1N = child2N - 1;
                let swap = null;
                let child1Score;

                if (child1N < length) {
                    const child1 = this.content[child1N];
                    child1Score = this.scoreFunction(child1);
                    if (child1Score < elemScore) swap = child1N;
                }

                if (child2N < length) {
                    const child2 = this.content[child2N];
                    const child2Score = this.scoreFunction(child2);
                    if (child2Score < (swap === null ? elemScore : child1Score)) {
                        swap = child2N;
                    }
                }

                if (swap === null) break;

                this.content[n] = this.content[swap];
                this.content[swap] = element;
                n = swap;
            }
        }
    }

    // Built-in demo algorithms. Student algorithms are supplied externally
    // through PageAlgorithmOverrides and never live in this file.
    const AlgorithmRunner = {
        bubbleSort(destinations, onStep = () => {}) {
            if (window.PageAlgorithmOverrides?.sort) {
                return window.PageAlgorithmOverrides.sort(destinations, onStep);
            }
            const result = destinations.map(destination => ({ ...destination }));
            const fixedIndices = [];
            onStep({ items: result, action: 'initial', indices: [], fixedIndices: [] });
            for (let end = result.length - 1; end > 0; end--) {
                for (let i = 0; i < end; i++) {
                    onStep({ items: result, action: 'compare', indices: [i, i + 1], fixedIndices: [...fixedIndices] });
                    if (result[i].priority < result[i + 1].priority) {
                        [result[i], result[i + 1]] = [result[i + 1], result[i]];
                        onStep({ items: result, action: 'swap', indices: [i, i + 1], fixedIndices: [...fixedIndices] });
                    }
                }
                fixedIndices.push(end);
                onStep({ items: result, action: 'fixed', indices: [end], fixedIndices: [...fixedIndices] });
            }
            if (result.length > 0) fixedIndices.push(0);
            onStep({ items: result, action: 'complete', indices: [], fixedIndices: [...fixedIndices] });
            return result;
        },

        selectionSort(destinations, onStep = () => {}) {
            if (window.PageAlgorithmOverrides?.sort) {
                return window.PageAlgorithmOverrides.sort(destinations, onStep);
            }
            const result = destinations.map(destination => ({ ...destination }));
            const fixedIndices = [];
            onStep({ items: result, action: 'initial', indices: [], fixedIndices: [] });
            for (let i = 0; i < result.length - 1; i++) {
                let highest = i;
                for (let j = i + 1; j < result.length; j++) {
                    onStep({ items: result, action: 'compare', indices: [highest, j], fixedIndices: [...fixedIndices] });
                    if (result[j].priority > result[highest].priority) highest = j;
                }
                if (i !== highest) {
                    [result[i], result[highest]] = [result[highest], result[i]];
                    onStep({ items: result, action: 'swap', indices: [i, highest], fixedIndices: [...fixedIndices] });
                }
                fixedIndices.push(i);
                onStep({ items: result, action: 'fixed', indices: [i], fixedIndices: [...fixedIndices] });
            }
            if (result.length > 0) fixedIndices.push(result.length - 1);
            onStep({ items: result, action: 'complete', indices: [], fixedIndices: [...fixedIndices] });
            return result;
        },

        // Greedy choice: take the best destination available right now.
        chooseNextDestination(sortedDestinations) {
            return sortedDestinations[0];
        },

        // Graph search: students can replace the selected class or implement
        // their own search object that returns the same result shape.
        findPath(gridModel, algorithmName) {
            if (window.PageAlgorithmOverrides?.findPath) {
                return window.PageAlgorithmOverrides.findPath(gridModel, CELL_TYPE.WALL);
            }
            const algorithm = algorithmName === 'bfs'
                ? new BFSAlgorithm(gridModel)
                : new AStarAlgorithm(gridModel);
            return algorithm.run();
        },
    };

    // --- MODEL CLASSES ---

    class GridModel {
        constructor(size, wallRatio, seed, goalCount = 5) {
            this.size = size;
            this.wallRatio = wallRatio;
            this.seed = seed;
            this.grid = [];
            this.start = null;
            this.goal = null;
            this.goals = [];
            this.rewards = [];
            this.goalCount = goalCount;
        }

        generate() {
            const maxAttempts = 10;
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                this._internalGenerate();
                if (this.goals.every(goal => this._pathExists(goal))) {
                    return true;
                }
                this.seed++; // Increment seed for next attempt
            }
            return false;
        }

        loadFixture(fixture) {
            this.size = fixture.size;
            this.wallRatio = fixture.walls.length / (fixture.size * fixture.size);
            this.goalCount = fixture.goals.length;
            this.grid = Array(this.size).fill(null).map(() => Array(this.size).fill(CELL_TYPE.EMPTY));
            fixture.walls.forEach(([r, c]) => { this.grid[r][c] = CELL_TYPE.WALL; });
            this.start = { ...fixture.start };
            this.goals = fixture.goals.map(goal => ({ ...goal }));
            this.goal = this.goals[0];
            this.rewards = Array(this.size).fill(null).map((_, r) =>
                Array(this.size).fill(null).map((__, c) =>
                    this.grid[r][c] === CELL_TYPE.WALL ? 0 : ((r * 7 + c * 3 + fixture.rewardOffset) % 9) + 1
                )
            );
            this.rewards[this.start.r][this.start.c] = 0;
            this.goals.forEach(goal => { this.rewards[goal.r][goal.c] = 0; });
        }

        _internalGenerate() {
            const rng = new SeededRandom(this.seed);
            this.grid = Array(this.size).fill(null).map(() => Array(this.size).fill(CELL_TYPE.EMPTY));

            const numWalls = Math.floor(this.size * this.size * this.wallRatio);
            let wallsPlaced = 0;

            // Sample independent cells instead of walking from one wall cell to
            // the next. The old random walk produced a long connected wall that
            // could look like a path between the start and goal.
            while (wallsPlaced < numWalls) {
                const r = rng.nextInt(0, this.size);
                const c = rng.nextInt(0, this.size);
                if (this.grid[r][c] === CELL_TYPE.EMPTY) {
                    this.grid[r][c] = CELL_TYPE.WALL;
                    wallsPlaced++;
                }
            }
            
            // Place one start and several prioritized destinations.
            const minDistance = this.size * 0.5;
            do {
                this.start = { r: rng.nextInt(0, this.size), c: rng.nextInt(0, this.size) };
            } while (this.grid[this.start.r][this.start.c] === CELL_TYPE.WALL);

            this.goals = [];
            while (this.goals.length < this.goalCount) {
                const candidate = {
                    r: rng.nextInt(0, this.size),
                    c: rng.nextInt(0, this.size),
                    priority: rng.nextInt(1, 100),
                    id: this.goals.length + 1,
                };
                const occupied = this.goals.some(goal => goal.r === candidate.r && goal.c === candidate.c);
                const distance = Math.abs(this.start.r - candidate.r) + Math.abs(this.start.c - candidate.c);
                if (this.grid[candidate.r][candidate.c] !== CELL_TYPE.WALL && !occupied &&
                    !(this.start.r === candidate.r && this.start.c === candidate.c) && distance >= minDistance) {
                    this.goals.push(candidate);
                }
            }
            this.goal = this.goals[0];
            this.rewards = Array(this.size).fill(null).map((_, r) =>
                Array(this.size).fill(null).map((__, c) =>
                    this.grid[r][c] === CELL_TYPE.WALL ? 0 : rng.nextInt(1, 10)
                )
            );
            this.rewards[this.start.r][this.start.c] = 0;
            this.goals.forEach(goal => { this.rewards[goal.r][goal.c] = 0; });
        }

        _pathExists(target = this.goal) {
            if (!this.start || !target) return false;

            const queue = [this.start];
            const visited = new Set([`${this.start.r},${this.start.c}`]);

            while (queue.length > 0) {
                const current = queue.shift();

                if (current.r === target.r && current.c === target.c) {
                    return true;
                }

                for (const neighbor of this.getNeighbors(current)) {
                    const key = `${neighbor.r},${neighbor.c}`;
                    if (!visited.has(key)) {
                        visited.add(key);
                        queue.push(neighbor);
                    }
                }
            }
            return false;
        }

        getNeighbors({ r, c }) {
            const neighbors = [];
            const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]; // Up, Down, Left, Right
            for (const [dr, dc] of directions) {
                const newR = r + dr;
                const newC = c + dc;
                if (newR >= 0 && newR < this.size && newC >= 0 && newC < this.size && this.grid[newR][newC] !== CELL_TYPE.WALL) {
                    neighbors.push({ r: newR, c: newC });
                }
            }
            return neighbors;
        }
    }

    // --- ALGORITHM CLASSES ---

    class BFSAlgorithm {
        constructor(gridModel) {
            this.gridModel = gridModel;
        }

        run() {
            const startTime = performance.now();
            const startNode = this.gridModel.start;
            const goalNode = this.gridModel.goal;

            const queue = [startNode];
            const parent = new Map();
            const visited = new Set([`${startNode.r},${startNode.c}`]);
            
            const steps = [];
            let maxFrontierSize = 0;
            let expandedNodes = 0;

            let pathFound = false;

            while (queue.length > 0) {
                const current = queue.shift();
                expandedNodes++;

                const step = {
                    current: { ...current },
                    addedToFrontier: [],
                    frontierSize: queue.length,
                    expandedNodes: expandedNodes
                };

                if (current.r === goalNode.r && current.c === goalNode.c) {
                    pathFound = true;
                    steps.push(step);
                    break;
                }

                for (const neighbor of this.gridModel.getNeighbors(current)) {
                    const key = `${neighbor.r},${neighbor.c}`;
                    if (!visited.has(key)) {
                        visited.add(key);
                        parent.set(key, current);
                        queue.push(neighbor);
                        step.addedToFrontier.push(neighbor);
                    }
                }
                steps.push(step);
                maxFrontierSize = Math.max(maxFrontierSize, queue.length);
            }

            const path = [];
            if (pathFound) {
                let current = goalNode;
                while (current) {
                    path.unshift(current);
                    const key = `${current.r},${current.c}`;
                    current = parent.get(key);
                }
            }

            const endTime = performance.now();

            return {
                algorithm: "BFS",
                found: pathFound,
                path: path,
                steps: steps,
                expandedNodes: expandedNodes,
                maxFrontierSize: maxFrontierSize,
                pathLength: path.length,
                runtimeMs: endTime - startTime,
                timeComplexity: "O(V + E)",
                spaceComplexity: "O(V)",
            };
        }
    }

    class AStarAlgorithm {
        constructor(gridModel) {
            this.gridModel = gridModel;
        }

        heuristic(a, b) {
            return Math.abs(a.r - b.r) + Math.abs(a.c - b.c); // Manhattan distance
        }

        run() {
            const startTime = performance.now();
            const startNode = this.gridModel.start;
            const goalNode = this.gridModel.goal;

            const openSet = new BinaryHeap(node => node.f);
            const openSetMap = new Map(); // For quick lookups
            const closedSet = new Set();
            const parent = new Map();

            const gScore = new Map();
            const startKey = `${startNode.r},${startNode.c}`;
            gScore.set(startKey, 0);

            const startNodeWithF = { ...startNode, f: this.heuristic(startNode, goalNode) };
            openSet.push(startNodeWithF);
            openSetMap.set(startKey, startNodeWithF);

            const steps = [];
            let maxFrontierSize = 0;
            let expandedNodes = 0;
            let pathFound = false;

            while (openSet.size() > 0) {
                const current = openSet.pop();
                const currentKey = `${current.r},${current.c}`;
                openSetMap.delete(currentKey);
                
                expandedNodes++;
                closedSet.add(currentKey);

                const step = {
                    current: { r: current.r, c: current.c },
                    addedToFrontier: [],
                    frontierSize: openSet.size(),
                    expandedNodes: expandedNodes
                };

                if (current.r === goalNode.r && current.c === goalNode.c) {
                    pathFound = true;
                    steps.push(step);
                    break;
                }

                for (const neighbor of this.gridModel.getNeighbors(current)) {
                    const neighborKey = `${neighbor.r},${neighbor.c}`;
                    if (closedSet.has(neighborKey)) continue;

                    const tentativeGScore = gScore.get(currentKey) + 1;

                    if (!openSetMap.has(neighborKey) || tentativeGScore < gScore.get(neighborKey)) {
                        parent.set(neighborKey, current);
                        gScore.set(neighborKey, tentativeGScore);
                        
                        const fScore = tentativeGScore + this.heuristic(neighbor, goalNode);
                        const neighborNode = { ...neighbor, f: fScore };

                        if (!openSetMap.has(neighborKey)) {
                            openSet.push(neighborNode);
                            openSetMap.set(neighborKey, neighborNode);
                            step.addedToFrontier.push(neighbor);
                        } else {
                            // The binary heap implementation doesn't support decrease-key,
                            // but pushing a better path still works. The old one will be ignored.
                            openSet.push(neighborNode);
                            openSetMap.set(neighborKey, neighborNode);
                        }
                    }
                }
                steps.push(step);
                maxFrontierSize = Math.max(maxFrontierSize, openSet.size());
            }

            const path = [];
            if (pathFound) {
                let current = goalNode;
                while (current) {
                    path.unshift(current);
                    const key = `${current.r},${current.c}`;
                    current = parent.get(key);
                }
            }

            const endTime = performance.now();

            return {
                algorithm: "A*",
                found: pathFound,
                path: path,
                steps: steps,
                expandedNodes: expandedNodes,
                maxFrontierSize: maxFrontierSize,
                pathLength: path.length,
                runtimeMs: endTime - startTime,
                timeComplexity: "O((V + E) log V)",
                spaceComplexity: "O(V)",
            };
        }
    }

    // --- VISUALIZATION & CONTROL ---

    class PathfindingVisualizer {
        constructor(canvas, colors) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.colors = colors;
            this.gridModel = null;
            this.cellSize = 0;
            this.animationGrid = [];
            this.agentPos = { x: 0, y: 0 };
            this.pathColorMode = 'greedy';
            this.greedyPathCells = new Set();
            this.rewardPathCells = new Set();
        }

        setGridModel(gridModel) {
            this.gridModel = gridModel;
            this.greedyPathCells.clear();
            this.rewardPathCells.clear();
            this.animationGrid = Array(gridModel.size).fill(null).map(() => Array(gridModel.size).fill(CELL_TYPE.EMPTY));
            for (let r = 0; r < gridModel.size; r++) {
                for (let c = 0; c < gridModel.size; c++) {
                    if (gridModel.grid[r][c] === CELL_TYPE.WALL) {
                        this.animationGrid[r][c] = CELL_TYPE.WALL;
                    }
                }
            }
            this.animationGrid[gridModel.start.r][gridModel.start.c] = CELL_TYPE.START;
            gridModel.goals.forEach(goal => {
                this.animationGrid[goal.r][goal.c] = CELL_TYPE.GOAL;
            });
        }

        resize() {
            const container = this.canvas.parentElement;
            const size = Math.min(container.clientWidth, container.clientHeight);
            this.canvas.width = size;
            this.canvas.height = size;
            this.cellSize = this.canvas.width / this.gridModel.size;
            this.drawGrid();
        }

        drawGrid() {
            if (!this.gridModel) return;
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            for (let r = 0; r < this.gridModel.size; r++) {
                for (let c = 0; c < this.gridModel.size; c++) {
                    this.drawCell(r, c, this.animationGrid[r][c]);
                }
            }

            // Draw grid lines if cells are large enough
            if (this.cellSize > 4) {
                this.ctx.strokeStyle = this.colors.gridLine;
                this.ctx.lineWidth = 1;
                for (let i = 0; i <= this.gridModel.size; i++) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(i * this.cellSize, 0);
                    this.ctx.lineTo(i * this.cellSize, this.canvas.height);
                    this.ctx.stroke();
                    this.ctx.beginPath();
                    this.ctx.moveTo(0, i * this.cellSize);
                    this.ctx.lineTo(this.canvas.width, i * this.cellSize);
                    this.ctx.stroke();
                }
            }

            // Force draw start and goal on top to ensure they are always visible
            if (this.gridModel.start) {
                this.drawCell(this.gridModel.start.r, this.gridModel.start.c, CELL_TYPE.START);
            }
            this.gridModel.goals.forEach(goal => {
                const isSelected = goal.id === this.gridModel.goal.id;
                if (isSelected) {
                    this.drawCell(goal.r, goal.c, CELL_TYPE.GOAL, true);
                }
                if (this.cellSize > 10) {
                    this.drawText(
                        `G${goal.id}`,
                        goal.c * this.cellSize,
                        goal.r * this.cellSize,
                        this.cellSize,
                        'white'
                    );
                }
                if (isSelected) {
                    this.ctx.strokeStyle = this.colors.path;
                    this.ctx.lineWidth = Math.max(2, this.cellSize * 0.12);
                    this.ctx.strokeRect(
                        goal.c * this.cellSize + 1,
                        goal.r * this.cellSize + 1,
                        this.cellSize - 2,
                        this.cellSize - 2
                    );
                }
            });
        }

        drawCell(r, c, type, selectedGoal = false) {
            const x = c * this.cellSize;
            const y = r * this.cellSize;
            const cs = this.cellSize;

            switch (type) {
                case CELL_TYPE.EMPTY:
                    this.ctx.fillStyle = this.colors.empty;
                    this.ctx.fillRect(x, y, cs, cs);
                    break;
                case CELL_TYPE.WALL:
                    this.drawWallCell(x, y, cs);
                    break;
                case CELL_TYPE.START:
                    this.ctx.fillStyle = this.colors.start;
                    this.ctx.fillRect(x, y, cs, cs);
                    if (cs > 10) this.drawText('S', x, y, cs, 'white');
                    break;
                case CELL_TYPE.GOAL:
                    this.ctx.fillStyle = selectedGoal ? this.colors.goal : this.colors.goalInactive;
                    this.ctx.fillRect(x, y, cs, cs);
                    // The numbered label (G1, G2, ...) is drawn once in
                    // drawGrid(). Drawing a generic G here would overlap it.
                    break;
                case CELL_TYPE.FRONTIER:
                    this.ctx.fillStyle = this.colors.frontier;
                    this.ctx.fillRect(x, y, cs, cs);
                    break;
                case CELL_TYPE.EXPLORED:
                    this.ctx.fillStyle = this.colors.explored;
                    this.ctx.fillRect(x, y, cs, cs);
                    break;
                case CELL_TYPE.CURRENT:
                    this.ctx.fillStyle = this.colors.current;
                    this.ctx.fillRect(x, y, cs, cs);
                    break;
                case CELL_TYPE.PATH:
                case CELL_TYPE.GREEDY_PATH:
                    this.ctx.fillStyle = this.colors.path;
                    this.ctx.fillRect(x, y, cs, cs);
                    break;
                case CELL_TYPE.REWARD_PATH:
                    this.ctx.fillStyle = this.colors.rewardPath;
                    this.ctx.fillRect(x, y, cs, cs);
                    break;
            }
            this.drawRewardValue(r, c, type);
            this.drawComparisonPathOutline(r, c);
        }

        drawRewardValue(r, c, type) {
            if (window.AlgorithmPageMode !== 'student' || !this.gridModel?.rewards || this.cellSize <= 12) return;
            if (type === CELL_TYPE.WALL || type === CELL_TYPE.START || type === CELL_TYPE.GOAL) return;
            const reward = this.gridModel.rewards[r]?.[c] || 0;
            if (reward <= 0) return;

            const usesDarkText = type === CELL_TYPE.PATH || type === CELL_TYPE.GREEDY_PATH ||
                type === CELL_TYPE.EMPTY || type === CELL_TYPE.FRONTIER || type === CELL_TYPE.EXPLORED ||
                type === CELL_TYPE.CURRENT;
            this.ctx.fillStyle = usesDarkText ? '#29445f' : 'white';
            this.ctx.font = `700 ${Math.max(8, this.cellSize * 0.3)}px sans-serif`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(
                reward,
                c * this.cellSize + this.cellSize / 2,
                r * this.cellSize + this.cellSize / 2
            );
        }

        drawComparisonPathOutline(r, c) {
            const isStart = this.gridModel?.start?.r === r && this.gridModel?.start?.c === c;
            const isGoal = this.gridModel?.goals?.some(goal => goal.r === r && goal.c === c);
            if (isStart || isGoal) return;

            const key = `${r},${c}`;
            const showGreedyOutline = window.ActiveSearchMode === 'reward' && this.greedyPathCells.has(key);
            const showRewardOutline = window.ActiveSearchMode !== 'reward' && this.rewardPathCells.has(key);
            if (!showGreedyOutline && !showRewardOutline) return;

            const inset = Math.max(2, this.cellSize * 0.08);
            this.ctx.strokeStyle = showGreedyOutline ? this.colors.path : this.colors.rewardPath;
            this.ctx.lineWidth = Math.max(2, this.cellSize * 0.12);
            this.ctx.strokeRect(
                c * this.cellSize + inset,
                r * this.cellSize + inset,
                this.cellSize - inset * 2,
                this.cellSize - inset * 2
            );
        }

        prepareComparisonPaths(activeMode, preserveComparisonPath) {
            if (!preserveComparisonPath) {
                this.greedyPathCells.clear();
                this.rewardPathCells.clear();
            } else if (activeMode === 'reward') {
                this.rewardPathCells.clear();
            } else {
                this.greedyPathCells.clear();
            }
        }

        drawWallCell(x, y, cs) {
            this.ctx.fillStyle = this.colors.wall;
            this.ctx.fillRect(x, y, cs, cs);
            if (cs > 4) {
                const bevelSize = Math.max(1, cs * 0.1);
                // Highlight
                this.ctx.fillStyle = this.colors.wallHighlight;
                this.ctx.beginPath();
                this.ctx.moveTo(x, y);
                this.ctx.lineTo(x + cs, y);
                this.ctx.lineTo(x + cs - bevelSize, y + bevelSize);
                this.ctx.lineTo(x + bevelSize, y + bevelSize);
                this.ctx.lineTo(x + bevelSize, y + cs - bevelSize);
                this.ctx.lineTo(x, y + cs);
                this.ctx.closePath();
                this.ctx.fill();
                // Shadow
                this.ctx.fillStyle = this.colors.wallShadow;
                this.ctx.beginPath();
                this.ctx.moveTo(x + cs, y);
                this.ctx.lineTo(x + cs, y + cs);
                this.ctx.lineTo(x, y + cs);
                this.ctx.lineTo(x + bevelSize, y + cs - bevelSize);
                this.ctx.lineTo(x + cs - bevelSize, y + cs - bevelSize);
                this.ctx.lineTo(x + cs - bevelSize, y + bevelSize);
                this.ctx.closePath();
                this.ctx.fill();
            }
        }

        drawText(text, x, y, cs, color) {
            this.ctx.fillStyle = color;
            this.ctx.font = `bold ${cs * 0.6}px sans-serif`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(text, x + cs / 2, y + cs / 2);
        }

        drawAgent() {
            const cs = this.cellSize;
            this.ctx.fillStyle = this.colors.agent;
            this.ctx.beginPath();
            this.ctx.arc(this.agentPos.x * cs + cs / 2, this.agentPos.y * cs + cs / 2, cs * 0.35, 0, 2 * Math.PI);
            this.ctx.fill();
        }

        updateCell(r, c, type) {
            // Avoid overwriting start/goal visuals
            if (this.animationGrid[r][c] !== CELL_TYPE.START && this.animationGrid[r][c] !== CELL_TYPE.GOAL) {
                this.animationGrid[r][c] = type;
                this.drawCell(r, c, type);
            }
        }

        clearPath() {
            if (!this.gridModel) return;
            for (let r = 0; r < this.gridModel.size; r++) {
                for (let c = 0; c < this.gridModel.size; c++) {
                    const type = this.animationGrid[r][c];
                    if (type !== CELL_TYPE.WALL && type !== CELL_TYPE.START && type !== CELL_TYPE.GOAL) {
                        this.animationGrid[r][c] = CELL_TYPE.EMPTY;
                    }
                }
            }
            this.drawGrid();
        }
    }

    class AnimationController {
        constructor(visualizer, uiController) {
            this.visualizer = visualizer;
            this.ui = uiController;
            this.searchResult = null;
            this.animationFrameId = null;
            this.timeoutId = null;

            this.state = 'idle'; // idle, searching, paused, path, agent
            this.pausedState = null;
            this.stepIndex = 0;
            this.pathIndex = 0;
            this.agentFrame = 0;

            this.speed = 100;
            this.nodesPerStep = 1;
        }

        setSpeed(speed, nodesPerStep) {
            this.speed = speed;
            this.nodesPerStep = nodesPerStep;
        }

        play(searchResult, startPaused = false) {
            this.reset();
            this.searchResult = searchResult;
            this.visualizer.pathColorMode = searchResult.searchMode || 'greedy';
            if (!searchResult.found) {
                this.ui.updateStatus('Path not found');
                this.state = 'idle';
                this.ui.setButtonsForIdle();
                return;
            }
            if (startPaused) {
                this.state = 'paused';
                this.pausedState = 'searching';
                this.ui.setButtonsForPaused();
                this.ui.updateStatus('Paused — step mode');
                return;
            }
            this.state = 'searching';
            this.ui.setButtonsForPlaying();
            this.ui.updateStatus('Visualizing search...');
            this.runSearchAnimation();
        }

        pause() {
            if (this.state === 'searching' || this.state === 'path' || this.state === 'agent') {
                this.pausedState = this.state;
                this.state = 'paused';
                clearTimeout(this.timeoutId);
                cancelAnimationFrame(this.animationFrameId);
                this.timeoutId = null;
                this.animationFrameId = null;
                this.ui.updateStatus('Paused');
                this.ui.setButtonsForPaused();
            }
        }

        resume() {
            if (this.state === 'paused') {
                this.ui.setButtonsForPlaying();
                if (this.pausedState === 'agent') {
                    this.state = 'agent';
                    this.ui.updateStatus('Agent moving...');
                    this.runAgentAnimation();
                } else if (this.stepIndex < this.searchResult.steps.length) {
                    this.state = 'searching';
                    this.ui.updateStatus('Visualizing search...');
                    this.runSearchAnimation();
                } else if (this.pathIndex < this.searchResult.path.length) {
                    this.state = 'path';
                    this.ui.updateStatus('Drawing path...');
                    this.runPathAnimation();
                } else {
                    this.state = 'agent';
                    this.ui.updateStatus('Agent moving...');
                    this.runAgentAnimation();
                }
            }
        }

        step() {
            if (this.state !== 'paused') this.pause();

            if (this.stepIndex < this.searchResult.steps.length) {
                this.state = 'searching';
                this.processSearchStep();
                this.pausedState = 'searching';
                this.state = 'paused';
            } else if (this.pathIndex < this.searchResult.path.length) {
                this.state = 'path';
                this.processPathStep();
                if (this.pathIndex >= this.searchResult.path.length) {
                    this.startAgentAnimation();
                } else {
                    this.pausedState = 'path';
                    this.state = 'paused';
                }
            }
        }

        reset(preserveComparisonPath = true) {
            this.state = 'idle';
            clearTimeout(this.timeoutId);
            cancelAnimationFrame(this.animationFrameId);
            this.timeoutId = null;
            this.animationFrameId = null;
            this.stepIndex = 0;
            this.pathIndex = 0;
            this.pausedState = null;
            this.searchResult = null;
            this.visualizer.prepareComparisonPaths(window.ActiveSearchMode, preserveComparisonPath);
            this.visualizer.clearPath();
            this.ui.resetInfo();
            if (!preserveComparisonPath) this.ui.resetRewardComparison();
            this.ui.setButtonsForIdle();
        }

        runSearchAnimation() {
            if (this.state !== 'searching' || this.stepIndex >= this.searchResult.steps.length) {
                if (this.stepIndex >= this.searchResult.steps.length) {
                    this.state = 'path';
                    this.timeoutId = setTimeout(() => this.runPathAnimation(), 500);
                }
                return;
            }

            for (let i = 0; i < this.nodesPerStep; i++) {
                if (this.stepIndex < this.searchResult.steps.length) {
                    this.processSearchStep();
                } else {
                    break;
                }
            }

            this.timeoutId = setTimeout(() => this.runSearchAnimation(), this.speed);
        }

        processSearchStep() {
            const step = this.searchResult.steps[this.stepIndex];
            if (this.stepIndex > 0) {
                const prevStep = this.searchResult.steps[this.stepIndex - 1];
                this.visualizer.updateCell(prevStep.current.r, prevStep.current.c, CELL_TYPE.EXPLORED);
            }
            step.addedToFrontier.forEach(node => this.visualizer.updateCell(node.r, node.c, CELL_TYPE.FRONTIER));
            this.visualizer.updateCell(step.current.r, step.current.c, CELL_TYPE.CURRENT);
            
            this.ui.updateRealtimeInfo({
                frontierSize: step.frontierSize,
                expandedNodes: step.expandedNodes,
            });

            this.stepIndex++;
        }

        runPathAnimation() {
            if (this.state !== 'path' || this.pathIndex >= this.searchResult.path.length) {
                if (this.pathIndex >= this.searchResult.path.length) {
                    this.startAgentAnimation();
                }
                return;
            }
            this.ui.updateStatus('Drawing path...');
            this.processPathStep();
            this.timeoutId = setTimeout(() => this.runPathAnimation(), 50);
        }

        processPathStep() {
            const node = this.searchResult.path[this.pathIndex];
            const pathCellType = this.searchResult.searchMode === 'reward'
                ? CELL_TYPE.REWARD_PATH
                : (this.searchResult.searchMode === 'greedy' ? CELL_TYPE.GREEDY_PATH : CELL_TYPE.PATH);
            const key = `${node.r},${node.c}`;
            if (this.searchResult.searchMode === 'reward') this.visualizer.rewardPathCells.add(key);
            if (this.searchResult.searchMode === 'greedy') this.visualizer.greedyPathCells.add(key);
            this.visualizer.updateCell(node.r, node.c, pathCellType);
            this.pathIndex++;
        }

        startAgentAnimation() {
            const firstNode = this.searchResult.path[0];
            this.state = 'agent';
            this.pausedState = null;
            this.visualizer.agentPos = { x: firstNode.c, y: firstNode.r };
            this.pathIndex = 0;
            this.agentFrame = 0;
            this.ui.setButtonsForPlaying();
            this.runAgentAnimation();
        }

        runAgentAnimation() {
            if (this.state !== 'agent') return;
            this.ui.updateStatus('Agent moving...');

            const path = this.searchResult.path;
            if (this.pathIndex >= path.length - 1) {
                this.ui.updateStatus('Completed!');
                this.state = 'idle';
                this.ui.setButtonsForCompleted();
                return;
            }

            const startNode = path[this.pathIndex];
            const endNode = path[this.pathIndex + 1];
            const duration = 15; // frames

            const newX = startNode.c + (endNode.c - startNode.c) * (this.agentFrame / duration);
            const newY = startNode.r + (endNode.r - startNode.r) * (this.agentFrame / duration);
            this.visualizer.agentPos = { x: newX, y: newY };

            this.visualizer.drawGrid(); // Redraw grid to clear previous agent position
            this.visualizer.drawAgent();

            this.agentFrame++;
            if (this.agentFrame > duration) {
                this.agentFrame = 0;
                this.pathIndex++;
            }

            this.animationFrameId = requestAnimationFrame(() => this.runAgentAnimation());
        }
    }

    class AppController {
        constructor() {
            this.sortPlayback = { paused: false, stepRequested: false, cancelled: false };
            this.sortingCompleted = false;
            this.generationRequestId = 0;
            this.cacheDom();
            this.bindEvents();

            this.gridModel = null;
            this.visualizer = new PathfindingVisualizer(this.dom.canvas, COLORS);
            this.animationController = new AnimationController(this.visualizer, this);
            
            this.state = 'idle'; // idle, searching

            this.init();
        }

        cacheDom() {
            this.dom = {
                // Controls
                algorithmSelect: document.getElementById('algorithm'),
                sortingAlgorithmSelect: document.getElementById('sortingAlgorithm'),
                goalCountSlider: document.getElementById('goalCount'),
                goalCountValue: document.getElementById('goalCountValue'),
                gridSizeSlider: document.getElementById('gridSize'),
                gridSizeValue: document.getElementById('gridSizeValue'),
                wallRatioSlider: document.getElementById('wallRatio'),
                wallRatioValue: document.getElementById('wallRatioValue'),
                animationSpeedSlider: document.getElementById('animationSpeed'),
                animationSpeedValue: document.getElementById('animationSpeedValue'),
                nodesPerStepSlider: document.getElementById('nodesPerStep'),
                nodesPerStepValue: document.getElementById('nodesPerStepValue'),
                sortStatus: document.getElementById('sortStatus'),
                sortItems: document.getElementById('sortItems'),
                sortHistory: document.getElementById('sortHistory'),
                // Buttons
                generateMapBtn: document.getElementById('generateMapBtn'),
                fixedSetProblemBtn: document.getElementById('fixedSetProblemBtn'),
                visualizeSortBtn: document.getElementById('visualizeSortBtn'),
                startBtn: document.getElementById('startBtn'),
                pauseBtn: document.getElementById('pauseBtn'),
                resumeBtn: document.getElementById('resumeBtn'),
                stepBtn: document.getElementById('stepBtn'),
                resetBtn: document.getElementById('resetBtn'),
                sortPauseBtn: document.getElementById('sortPauseBtn'),
                sortResumeBtn: document.getElementById('sortResumeBtn'),
                sortStepBtn: document.getElementById('sortStepBtn'),
                sortResetBtn: document.getElementById('sortResetBtn'),
                // Info Panel
                info: {
                    algorithm: document.getElementById('info-algorithm'),
                    sorting: document.getElementById('info-sorting'),
                    sortedGoals: document.getElementById('info-sortedGoals'),
                    selectedGoal: document.getElementById('info-selectedGoal'),
                    gridSize: document.getElementById('info-gridSize'),
                    wallRatio: document.getElementById('info-wallRatio'),
                    startPos: document.getElementById('info-startPos'),
                    goalPos: document.getElementById('info-goalPos'),
                    status: document.getElementById('info-status'),
                    pathFound: document.getElementById('info-pathFound'),
                    pathLength: document.getElementById('info-pathLength'),
                    expandedNodes: document.getElementById('info-expandedNodes'),
                    frontierSize: document.getElementById('info-frontierSize'),
                    maxFrontierSize: document.getElementById('info-maxFrontierSize'),
                    searchRuntime: document.getElementById('info-searchRuntime'),
                    greedyReward: document.getElementById('info-greedyReward'),
                    graphReward: document.getElementById('info-graphReward'),
                    greedyRewardCells: document.getElementById('info-greedyRewardCells'),
                    graphRewardCells: document.getElementById('info-graphRewardCells'),
                    greedyExpanded: document.getElementById('info-greedyExpanded'),
                    graphExpanded: document.getElementById('info-graphExpanded'),
                },
                sortComplexity: {
                    algorithm: document.getElementById('sort-complexity-algorithm'),
                    time: document.getElementById('sort-complexity-time'),
                    space: document.getElementById('sort-complexity-space'),
                    input: document.getElementById('sort-actual-input'),
                    comparisons: document.getElementById('sort-actual-comparisons'),
                    swaps: document.getElementById('sort-actual-swaps'),
                    operations: document.getElementById('sort-complexity-operations'),
                },
                pathComplexity: {
                    algorithm: document.getElementById('path-complexity-algorithm'),
                    time: document.getElementById('path-complexity-time'),
                    space: document.getElementById('path-complexity-space'),
                    vertices: document.getElementById('path-actual-vertices'),
                    edges: document.getElementById('path-actual-edges'),
                    expanded: document.getElementById('path-actual-expanded'),
                    frontier: document.getElementById('path-actual-frontier'),
                    runtime: document.getElementById('path-actual-runtime'),
                },
                // Canvas
                canvas: document.getElementById('pathfindingCanvas'),
                errorMessage: document.getElementById('error-message'),
                rewardStartBtn: document.getElementById('rewardStartBtn'),
            };
        }

        bindEvents() {
            this.dom.gridSizeSlider.addEventListener('input', e => this.dom.gridSizeValue.textContent = e.target.value);
            this.dom.goalCountSlider.addEventListener('input', e => this.dom.goalCountValue.textContent = e.target.value);
            this.dom.wallRatioSlider.addEventListener('input', e => this.dom.wallRatioValue.textContent = e.target.value);
            this.dom.animationSpeedSlider.addEventListener('input', e => this.handleSpeedChange(e.target.value));
            this.dom.nodesPerStepSlider.addEventListener('input', e => this.handleNodesPerStepChange(e.target.value));

            this.dom.generateMapBtn.addEventListener('click', () => this.generateNewMap());
            this.dom.fixedSetProblemBtn?.addEventListener('click', () => this.generateNewMap());
            this.dom.visualizeSortBtn.addEventListener('click', () => this.visualizeSorting(false));
            this.dom.startBtn.addEventListener('click', () => this.startSearch(false));
            this.dom.rewardStartBtn?.addEventListener('click', () => this.startSearch(false, 'reward'));
            this.dom.pauseBtn.addEventListener('click', () => this.animationController.pause());
            this.dom.resumeBtn.addEventListener('click', () => this.animationController.resume());
            this.dom.stepBtn.addEventListener('click', () => this.handlePathStep());
            this.dom.resetBtn.addEventListener('click', () => this.animationController.reset(false));
            this.dom.sortPauseBtn.addEventListener('click', () => this.pauseSorting());
            this.dom.sortResumeBtn.addEventListener('click', () => this.resumeSorting());
            this.dom.sortStepBtn.addEventListener('click', () => this.stepSorting());
            this.dom.sortResetBtn.addEventListener('click', () => this.resetSorting());

            window.addEventListener('resize', () => this.visualizer.resize());
            document.addEventListener('student-problem-change', event => {
                const test = Number(event.detail?.test) || 1;
                this.generateNewMap(window.StudentTestCases?.[test] || null);
            });
        }

        init() {
            this.handleSpeedChange(this.dom.animationSpeedSlider.value);
            this.handleNodesPerStepChange(this.dom.nodesPerStepSlider.value);
            this.generateNewMap(window.AlgorithmPageMode === 'student' ? window.StudentTestCases?.[1] : null);
        }

        generateNewMap(problemFixture = null) {
            if (this.state === 'searching') return;
            const requestId = ++this.generationRequestId;
            this.sortingCompleted = false;
            this.animationController.reset();
            this.updateStatus('Generating map...');
            this.hideError();

            const size = parseInt(this.dom.gridSizeSlider.value);
            const wallRatio = parseFloat(this.dom.wallRatioSlider.value);
            const goalCount = parseInt(this.dom.goalCountSlider.value);
            const seed = Date.now();

            // Use a timeout to allow the UI to update before potentially heavy computation
            setTimeout(() => {
                if (requestId !== this.generationRequestId) return;
                this.gridModel = new GridModel(size, wallRatio, seed, goalCount);
                if (problemFixture) this.gridModel.loadFixture(problemFixture);
                const generated = problemFixture ? true : this.gridModel.generate();
                if (!generated) {
                    // Keep and render the last generated map even when not all
                    // destinations are reachable, then explain the issue on it.
                    this.visualizer.setGridModel(this.gridModel);
                    this.visualizer.resize();
                    this.renderSortItems(this.gridModel.goals);
                    this.resetSortHistory(this.gridModel.goals);
                    this.dom.sortStatus.textContent = 'Unsorted destination priorities';
                    this.resetComplexityCards();
                    this.updateStaticInfo();
                    this.showError('Failed to generate a map with a valid path. Try reducing the wall ratio.');
                    this.updateStatus('Generation failed');
                    this.setButtonsForIdle();
                    return;
                }

                this.visualizer.setGridModel(this.gridModel);
                this.visualizer.resize();
                this.renderSortItems(this.gridModel.goals);
                this.resetSortHistory(this.gridModel.goals);
                this.dom.sortStatus.textContent = 'Unsorted destination priorities';
                this.resetComplexityCards();
                this.updateStaticInfo();
                this.updateStatus('Ready');
                this.setButtonsForIdle();
            }, 10);
        }

        startSearch(stepMode = false, searchMode = 'path') {
            if (this.state === 'searching' || !this.gridModel) return;
            
            window.ActiveSearchMode = searchMode;
            this.animationController.reset();
            this.state = 'searching';
            this.updateStatus('Calculating path...');
            this.setButtonsForSearch();

            // Use a timeout to allow the UI to update before the search algorithm runs
            setTimeout(() => {
                // Use the selected sorting rule to establish priority without
                // replaying its animation. The Sorting button owns that step.
                const { sortingType, sortedGoals, sortTrace } = this.createSortRun();
                this.renderSortItems(sortedGoals, [], 'complete');
                this.dom.sortStatus.textContent = 'Sorted order used for greedy selection';
                this.updateSortingComplexity(sortingType, sortTrace);

                // Greedy selects the locally best destination.
                const selectedGoal = AlgorithmRunner.chooseNextDestination(sortedGoals);
                this.gridModel.goal = selectedGoal;
                this.visualizer.drawGrid();

                // Graph search finds a traversable path to that destination.
                const algorithmType = this.dom.algorithmSelect.value;
                const result = AlgorithmRunner.findPath(this.gridModel, algorithmType);
                result.sortingAlgorithm = window.PageAlgorithmOverrides?.sort
                    ? 'Uploaded Sort'
                    : (sortingType === 'bubble' ? 'Bubble Sort' : 'Selection Sort');
                result.sortedGoals = sortedGoals;
                result.selectedGoal = selectedGoal;
                
                this.animationController.play(result, stepMode);
                // play() clears the previous run first, so publish the new
                // sorting/greedy/search result after that reset.
                this.updateSearchResultInfo(result);
                if (stepMode && result.found) this.animationController.step();
                this.state = 'idle'; // The animation controller now manages its own state
            }, 10);
        }

        async visualizeSorting(stepMode = false) {
            if (this.state !== 'idle' || !this.gridModel) return;

            this.state = 'sorting';
            this.hideError();
            this.updateStatus('Visualizing sorting...');
            this.setButtonsForSearch();
            this.sortPlayback = { paused: false, stepRequested: false, cancelled: false };
            this.setSortButtonsForPlaying();
            if (stepMode) {
                this.sortPlayback.paused = true;
                this.sortPlayback.stepRequested = true;
                this.dom.sortPauseBtn.disabled = true;
                this.dom.sortResumeBtn.disabled = false;
                this.dom.sortStepBtn.disabled = false;
            }

            const { sortingType, sortedGoals, sortTrace } = this.createSortRun();
            const completed = await this.playSortVisualization(sortTrace, true);
            if (!completed) return;
            this.updateSortingComplexity(sortingType, sortTrace);

            // Apply the sorting result to the map immediately. The highest
            // priority destination becomes the greedy target, so its yellow
            // outline updates as soon as sorting finishes.
            const selectedGoal = AlgorithmRunner.chooseNextDestination(sortedGoals);
            this.gridModel.goal = selectedGoal;
            this.visualizer.drawGrid();

            this.dom.info.sorting.textContent = window.PageAlgorithmOverrides?.sort
                ? 'Uploaded Sort'
                : (sortingType === 'bubble' ? 'Bubble Sort' : 'Selection Sort');
            this.dom.info.sortedGoals.textContent = sortedGoals
                .map(goal => `G${goal.id}:P${goal.priority}`)
                .join(' → ');
            this.dom.info.selectedGoal.textContent = `G${selectedGoal.id} (priority ${selectedGoal.priority})`;
            this.updateStatus('Sorting complete');
            this.sortingCompleted = true;
            this.state = 'idle';
            this.setButtonsForIdle();
            this.setSortButtonsForCompleted();
        }

        pauseSorting() {
            if (this.state !== 'sorting') return;
            this.sortPlayback.paused = true;
            this.dom.sortPauseBtn.disabled = true;
            this.dom.sortResumeBtn.disabled = false;
            this.dom.sortStepBtn.disabled = false;
            this.dom.sortStatus.textContent = 'Sorting paused';
        }

        resumeSorting() {
            if (this.state !== 'sorting') return;
            this.sortPlayback.paused = false;
            this.sortPlayback.stepRequested = false;
            this.setSortButtonsForPlaying();
        }

        stepSorting() {
            if (this.state === 'idle') {
                this.visualizeSorting(true);
                return;
            }
            if (this.state !== 'sorting' || !this.sortPlayback.paused) return;
            this.sortPlayback.paused = true;
            this.sortPlayback.stepRequested = true;
            this.dom.sortPauseBtn.disabled = true;
            this.dom.sortResumeBtn.disabled = false;
            this.dom.sortStepBtn.disabled = false;
        }

        resetSorting() {
            this.sortingCompleted = false;
            this.sortPlayback.cancelled = true;
            this.sortPlayback.paused = false;
            this.sortPlayback.stepRequested = false;
            this.state = 'idle';
            if (this.gridModel) {
                this.renderSortItems(this.gridModel.goals);
                this.resetSortHistory(this.gridModel.goals);
            }
            this.dom.sortStatus.textContent = 'Unsorted destination priorities';
            Object.values(this.dom.sortComplexity).forEach(element => element.textContent = '-');
            this.setSortControlButtonsDisabled();
            this.dom.visualizeSortBtn.disabled = false;
            this.dom.sortStepBtn.disabled = false;
        }

        setSortButtonsForPlaying() {
            this.dom.sortPauseBtn.disabled = false;
            this.dom.sortResumeBtn.disabled = true;
            this.dom.sortStepBtn.disabled = true;
            this.dom.sortResetBtn.disabled = false;
        }

        setSortButtonsForCompleted() {
            this.dom.sortPauseBtn.disabled = true;
            this.dom.sortResumeBtn.disabled = true;
            this.dom.sortStepBtn.disabled = false;
            this.dom.sortResetBtn.disabled = false;
        }

        async waitForSortPermission() {
            while (this.sortPlayback.paused && !this.sortPlayback.stepRequested && !this.sortPlayback.cancelled) {
                await new Promise(resolve => setTimeout(resolve, 40));
            }
            if (this.sortPlayback.cancelled) return false;
            if (this.sortPlayback.stepRequested) this.sortPlayback.stepRequested = false;
            return true;
        }

        handlePathStep() {
            if (!this.gridModel) return;
            if (this.animationController.state === 'paused') {
                this.animationController.step();
                return;
            }
            if (this.animationController.state === 'idle') {
                this.startSearch(true);
            }
        }

        createSortRun() {
            const sortingType = this.dom.sortingAlgorithmSelect.value;
            const sortTrace = [];
                const recordSortStep = step => sortTrace.push({
                ...step,
                items: step.items.map(item => ({ ...item })),
                    indices: [...step.indices],
                    fixedIndices: [...(step.fixedIndices || [])],
            });
            const sortedGoals = sortingType === 'bubble'
                ? AlgorithmRunner.bubbleSort(this.gridModel.goals, recordSortStep)
                : AlgorithmRunner.selectionSort(this.gridModel.goals, recordSortStep);
            return { sortingType, sortedGoals, sortTrace };
        }

        updateSortingComplexity(sortingType, trace) {
            const comparisons = trace.filter(step => step.action === 'compare').length;
            const swaps = trace.filter(step => step.action === 'swap').length;
            const writes = trace.filter(step => step.action === 'write').length;
            const isUploadedSort = Boolean(window.PageAlgorithmOverrides?.sort);
            this.dom.sortComplexity.algorithm.textContent = isUploadedSort
                ? 'Uploaded Sort'
                : (sortingType === 'bubble' ? 'Bubble Sort' : 'Selection Sort');
            this.dom.sortComplexity.time.textContent = isUploadedSort ? 'Uploaded' : 'O(n²)';
            this.dom.sortComplexity.space.textContent = isUploadedSort ? 'Uploaded' : 'O(n)';
            this.dom.sortComplexity.input.textContent = this.gridModel.goals.length;
            this.dom.sortComplexity.comparisons.textContent = comparisons;
            this.dom.sortComplexity.swaps.textContent = swaps;
            this.dom.sortComplexity.operations.textContent = comparisons + swaps + writes;
        }

        resetComplexityCards() {
            Object.values(this.dom.sortComplexity).forEach(element => element.textContent = '-');
            Object.values(this.dom.pathComplexity).forEach(element => element.textContent = '-');
        }

        handleSpeedChange(value) {
            this.dom.animationSpeedValue.textContent = value;
            this.animationController.setSpeed(ANIMATION_SPEEDS[value], this.animationController.nodesPerStep);
        }

        handleNodesPerStepChange(value) {
            this.dom.nodesPerStepValue.textContent = value;
            this.animationController.setSpeed(this.animationController.speed, parseInt(value));
        }

        renderSortItems(items, activeIndices = [], action = '', fixedIndices = []) {
            // A write can temporarily put the same destination in multiple slots.
            // Keep one DOM element per array index rather than per destination ID.
            const existingItems = [...this.dom.sortItems.querySelectorAll('.sort-item')];
            existingItems.slice(items.length).forEach(element => element.remove());

            items.forEach((goal, index) => {
                const item = existingItems[index] || document.createElement('div');
                item.className = 'sort-item';
                item.dataset.index = index;
                item.dataset.goalId = goal.id;
                if (activeIndices.includes(index)) item.classList.add(`is-${action}`);
                if (fixedIndices.includes(index)) item.classList.add('is-fixed');
                if (action === 'complete') item.classList.add('is-complete');

                let goalLabel = item.querySelector('.sort-item-goal');
                let priority = item.querySelector('.sort-item-priority');
                if (!goalLabel) {
                    goalLabel = document.createElement('span');
                    goalLabel.className = 'sort-item-goal';
                    priority = document.createElement('strong');
                    priority.className = 'sort-item-priority';
                    item.append(goalLabel, priority);
                }
                goalLabel.textContent = `G${goal.id}`;
                priority.textContent = `Priority ${goal.priority}`;
                priority.dataset.value = goal.priority;
                this.dom.sortItems.appendChild(item);
            });

        }

        resetSortHistory(items = []) {
            this.dom.sortHistory.replaceChildren();
            if (items.length > 0) {
                this.appendSortHistoryStep({ items, action: 'initial', indices: [], fixedIndices: [] });
            }
        }

        appendSortHistoryStep(step) {
            const row = document.createElement('div');
            row.className = `sort-history-row is-${step.action}`;

            const label = document.createElement('span');
            label.className = 'sort-history-label';
            const labels = { initial: 'Initial', compare: 'Compare', swap: 'Swap', write: 'Write', fixed: 'Fixed', complete: 'Complete', student: 'Uploaded' };
            label.textContent = labels[step.action];

            const sequence = document.createElement('div');
            sequence.className = 'sort-history-sequence';
            step.items.forEach((goal, index) => {
                const item = document.createElement('span');
                item.className = 'sort-history-item';
                if (step.indices.includes(index)) item.classList.add('is-active');
                if ((step.fixedIndices || []).includes(index)) item.classList.add('is-fixed');
                item.textContent = `G${goal.id}:${goal.priority}`;
                sequence.appendChild(item);
            });

            row.append(label, sequence);
            this.dom.sortHistory.appendChild(row);
            this.dom.sortHistory.scrollTop = this.dom.sortHistory.scrollHeight;
        }

        async playSortVisualization(trace, standalone = false) {
            const actionText = {
                initial: 'Initial order',
                compare: 'Comparing priorities',
                swap: 'Swapping destinations',
                write: 'Writing destination',
                fixed: 'Position fixed',
                student: 'Uploaded step',
                complete: 'Sorting complete — highest priority is first',
            };
            const delay = standalone
                ? Math.max(300, Math.min(650, this.animationController.speed * 2))
                : Math.max(100, Math.min(300, this.animationController.speed));

            this.dom.sortHistory.replaceChildren();
            for (const step of trace) {
                if (this.state !== 'searching' && !(standalone && this.state === 'sorting')) return false;
                // Initial is the baseline display, not an algorithm operation;
                // the first Step proceeds to the first comparison.
                if (standalone && step.action !== 'initial' && !(await this.waitForSortPermission())) return false;
                this.renderSortItems(step.items, step.indices, step.action, step.fixedIndices);
                this.appendSortHistoryStep(step);
                const activeGoals = step.indices.map(index => `G${step.items[index].id}`).join(' & ');
                this.dom.sortStatus.textContent = activeGoals
                    ? `${actionText[step.action]}: ${activeGoals}`
                    : actionText[step.action];
                const stepDelay = step.action === 'swap' ? Math.max(300, delay) : delay;
                await new Promise(resolve => setTimeout(resolve, stepDelay));
            }
            return true;
        }

        // --- UI Update Methods ---

        updateStatus(text) {
            this.dom.info.status.textContent = text;
        }

        showError(message) {
            this.dom.errorMessage.textContent = message;
            this.dom.errorMessage.style.display = 'block';
        }

        hideError() {
            this.dom.errorMessage.style.display = 'none';
        }

        updateStaticInfo() {
            this.dom.info.algorithm.textContent = '-';
            this.dom.info.sorting.textContent = '-';
            this.dom.info.sortedGoals.textContent = '-';
            this.dom.info.selectedGoal.textContent = '-';
            this.dom.info.gridSize.textContent = `${this.gridModel.size}x${this.gridModel.size}`;
            this.dom.info.wallRatio.textContent = this.gridModel.wallRatio.toFixed(2);
            this.dom.info.startPos.textContent = `(${this.gridModel.start.r}, ${this.gridModel.start.c})`;
            this.dom.info.goalPos.textContent = this.gridModel.goals
                .map(goal => `G${goal.id}(${goal.r},${goal.c}) P${goal.priority}`)
                .join(' · ');
            this.resetInfo();
            this.resetRewardComparison();
        }

        updateSearchResultInfo(result) {
            this.dom.info.algorithm.textContent = result.algorithm;
            this.dom.info.sorting.textContent = result.sortingAlgorithm;
            this.dom.info.sortedGoals.textContent = result.sortedGoals
                .map(goal => `G${goal.id}:P${goal.priority}`)
                .join(' → ');
            this.dom.info.selectedGoal.textContent = `G${result.selectedGoal.id} (priority ${result.selectedGoal.priority})`;
            this.dom.info.pathFound.textContent = result.found ? 'Yes' : 'No';
            this.dom.info.pathLength.textContent = result.found ? result.pathLength : '-';
            this.dom.info.expandedNodes.textContent = result.expandedNodes;
            this.dom.info.maxFrontierSize.textContent = result.maxFrontierSize;
            this.dom.info.searchRuntime.textContent = `${result.runtimeMs.toFixed(2)} ms`;
            if (result.searchMode === 'reward') {
                this.dom.info.graphReward.textContent = result.found ? result.totalReward : 'No path';
                this.dom.info.graphRewardCells.textContent = result.found ? result.rewardedCellCount : '-';
                this.dom.info.graphExpanded.textContent = result.expandedNodes;
            } else if (result.searchMode === 'greedy') {
                this.dom.info.greedyReward.textContent = result.found ? result.totalReward : 'No path';
                this.dom.info.greedyRewardCells.textContent = result.found ? result.rewardedCellCount : '-';
                this.dom.info.greedyExpanded.textContent = result.expandedNodes;
            }
            this.dom.pathComplexity.algorithm.textContent = result.algorithm;
            this.dom.pathComplexity.time.textContent = result.timeComplexity;
            this.dom.pathComplexity.space.textContent = result.spaceComplexity;
            const graphSize = this.calculateGraphSize();
            this.dom.pathComplexity.vertices.textContent = graphSize.vertices;
            this.dom.pathComplexity.edges.textContent = graphSize.edges;
            this.dom.pathComplexity.expanded.textContent = result.expandedNodes;
            this.dom.pathComplexity.frontier.textContent = result.maxFrontierSize;
            this.dom.pathComplexity.runtime.textContent = `${result.runtimeMs.toFixed(2)} ms`;
        }

        calculateGraphSize() {
            let vertices = 0;
            let edges = 0;
            const { grid, size } = this.gridModel;

            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    if (grid[r][c] === CELL_TYPE.WALL) continue;
                    vertices++;
                    if (c + 1 < size && grid[r][c + 1] !== CELL_TYPE.WALL) edges++;
                    if (r + 1 < size && grid[r + 1][c] !== CELL_TYPE.WALL) edges++;
                }
            }
            return { vertices, edges };
        }

        updateRealtimeInfo({ frontierSize, expandedNodes }) {
            if (frontierSize !== undefined) this.dom.info.frontierSize.textContent = frontierSize;
            if (expandedNodes !== undefined) this.dom.info.expandedNodes.textContent = expandedNodes;
        }

        resetInfo() {
            this.dom.info.pathFound.textContent = '-';
            this.dom.info.pathLength.textContent = '-';
            this.dom.info.expandedNodes.textContent = '0';
            this.dom.info.frontierSize.textContent = '0';
            this.dom.info.maxFrontierSize.textContent = '0';
            this.dom.info.searchRuntime.textContent = '-';
        }

        resetRewardComparison() {
            this.dom.info.greedyReward.textContent = '-';
            this.dom.info.graphReward.textContent = '-';
            this.dom.info.greedyRewardCells.textContent = '-';
            this.dom.info.graphRewardCells.textContent = '-';
            this.dom.info.greedyExpanded.textContent = '-';
            this.dom.info.graphExpanded.textContent = '-';
        }

        setButtonsForIdle() {
            this.dom.generateMapBtn.disabled = false;
            if (this.dom.fixedSetProblemBtn) this.dom.fixedSetProblemBtn.disabled = false;
            this.dom.visualizeSortBtn.disabled = false;
            this.dom.startBtn.disabled = false;
            if (this.dom.rewardStartBtn) this.dom.rewardStartBtn.disabled = false;
            this.dom.pauseBtn.disabled = true;
            this.dom.resumeBtn.disabled = true;
            this.dom.stepBtn.disabled = false;
            this.dom.resetBtn.disabled = true;
            this.setSortControlButtonsDisabled();
            this.dom.sortStepBtn.disabled = false;
            if (this.sortingCompleted) this.dom.sortResetBtn.disabled = false;
            this.setControlsDisabled(false);
        }

        setButtonsForSearch() {
            this.dom.generateMapBtn.disabled = true;
            if (this.dom.fixedSetProblemBtn) this.dom.fixedSetProblemBtn.disabled = true;
            this.dom.visualizeSortBtn.disabled = true;
            this.dom.startBtn.disabled = true;
            if (this.dom.rewardStartBtn) this.dom.rewardStartBtn.disabled = true;
            this.dom.pauseBtn.disabled = true;
            this.dom.resumeBtn.disabled = true;
            this.dom.stepBtn.disabled = true;
            this.dom.resetBtn.disabled = true;
            this.setSortControlButtonsDisabled();
            this.setControlsDisabled(true);
        }

        setButtonsForPlaying() {
            this.dom.generateMapBtn.disabled = true;
            if (this.dom.fixedSetProblemBtn) this.dom.fixedSetProblemBtn.disabled = true;
            this.dom.visualizeSortBtn.disabled = true;
            this.dom.startBtn.disabled = true;
            if (this.dom.rewardStartBtn) this.dom.rewardStartBtn.disabled = true;
            this.dom.pauseBtn.disabled = false;
            this.dom.resumeBtn.disabled = true;
            this.dom.stepBtn.disabled = true;
            this.dom.resetBtn.disabled = false;
            this.setSortControlButtonsDisabled();
            this.setControlsDisabled(true);
        }

        setButtonsForPaused() {
            this.dom.generateMapBtn.disabled = true;
            if (this.dom.fixedSetProblemBtn) this.dom.fixedSetProblemBtn.disabled = true;
            this.dom.visualizeSortBtn.disabled = true;
            this.dom.startBtn.disabled = true;
            if (this.dom.rewardStartBtn) this.dom.rewardStartBtn.disabled = true;
            this.dom.pauseBtn.disabled = true;
            this.dom.resumeBtn.disabled = false;
            this.dom.stepBtn.disabled = false;
            this.dom.resetBtn.disabled = false;
            this.setSortControlButtonsDisabled();
            this.setControlsDisabled(true);
        }

        setButtonsForCompleted() {
            this.dom.generateMapBtn.disabled = false;
            if (this.dom.fixedSetProblemBtn) this.dom.fixedSetProblemBtn.disabled = false;
            this.dom.visualizeSortBtn.disabled = false;
            this.dom.startBtn.disabled = false;
            if (this.dom.rewardStartBtn) this.dom.rewardStartBtn.disabled = false;
            this.dom.pauseBtn.disabled = true;
            this.dom.resumeBtn.disabled = true;
            this.dom.stepBtn.disabled = false;
            this.dom.resetBtn.disabled = false;
            this.setSortControlButtonsDisabled();
            this.dom.sortStepBtn.disabled = false;
            if (this.sortingCompleted) this.dom.sortResetBtn.disabled = false;
            this.setControlsDisabled(false);
        }

        setSortControlButtonsDisabled() {
            this.dom.sortPauseBtn.disabled = true;
            this.dom.sortResumeBtn.disabled = true;
            this.dom.sortStepBtn.disabled = true;
            this.dom.sortResetBtn.disabled = true;
        }

        setControlsDisabled(disabled) {
            this.dom.algorithmSelect.disabled = disabled;
            this.dom.sortingAlgorithmSelect.disabled = disabled;
            this.dom.goalCountSlider.disabled = disabled;
            this.dom.gridSizeSlider.disabled = disabled;
            this.dom.wallRatioSlider.disabled = disabled;
        }
    }

    // --- INITIALIZATION ---
    new AppController();
});
