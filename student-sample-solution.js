module.exports = {
    // Use Selection Sort to place higher-priority destinations first.
    sort(items, steps) {
        const result = items.map(item => ({ ...item }));

        for (let i = 0; i < result.length - 1; i++) {
            let highestIndex = i;
            for (let j = i + 1; j < result.length; j++) {
                steps.compare(result, highestIndex, j);
                if (result[j].priority > result[highestIndex].priority) highestIndex = j;
            }
            if (highestIndex !== i) {
                steps.swap(result, i, highestIndex);
            }
            steps.fixed(result, i);
        }
        if (result.length > 0) steps.fixed(result, result.length - 1);
        return result;
    },

    // Use BFS to find the shortest path from the start to the goal.
    findPath(grid, start, goal, steps) {
        const queue = [{ ...start }];
        const visited = new Set([key(start)]);
        const parent = new Map();
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

        while (queue.length > 0) {
            const current = queue.shift();
            steps.visit(current);
            if (current.r === goal.r && current.c === goal.c) {
                return buildPath(parent, start, goal);
            }

            for (const [dr, dc] of directions) {
                const next = { r: current.r + dr, c: current.c + dc };
                const nextKey = key(next);
                const isInside = next.r >= 0 && next.r < grid.length &&
                    next.c >= 0 && next.c < grid[0].length;
                if (!isInside || grid[next.r][next.c] === 1 || visited.has(nextKey)) continue;
                visited.add(nextKey);
                parent.set(nextKey, { ...current });
                queue.push(next);
            }
        }
        return [];
    },

    // Reward-aware Dijkstra: high-reward cells have a lower movement cost.
    findRewardPath(grid, rewards, start, goal, steps) {
        const frontier = [{ node: { ...start }, cost: 0 }];
        const bestCost = new Map([[key(start), 0]]);
        const parent = new Map();
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

        while (frontier.length > 0) {
            frontier.sort((a, b) => a.cost - b.cost);
            const { node: current, cost } = frontier.shift();
            if (cost !== bestCost.get(key(current))) continue;
            steps.visit(current);
            if (current.r === goal.r && current.c === goal.c) return buildPath(parent, start, goal);

            for (const [dr, dc] of directions) {
                const next = { r: current.r + dr, c: current.c + dc };
                const inside = next.r >= 0 && next.r < grid.length && next.c >= 0 && next.c < grid[0].length;
                if (!inside || grid[next.r][next.c] === 1) continue;
                const nextCost = cost + (10 - rewards[next.r][next.c]);
                if (nextCost < (bestCost.get(key(next)) ?? Infinity)) {
                    bestCost.set(key(next), nextCost);
                    parent.set(key(next), { ...current });
                    frontier.push({ node: next, cost: nextCost });
                }
            }
        }
        return [];
    },
};

function key(node) {
    return `${node.r},${node.c}`;
}

function buildPath(parent, start, goal) {
    const path = [];
    let current = { ...goal };
    while (current) {
        path.unshift(current);
        if (current.r === start.r && current.c === start.c) break;
        current = parent.get(key(current));
    }
    return path;
}
