module.exports = {
    sort(items, steps) {
        // Focus on the algorithm; the provided steps object handles visualization.
        const result = items.map(item => ({ ...item }));

        // Use these helpers where your algorithm compares, swaps, writes, or fixes an item:
        // steps.compare(result, leftIndex, rightIndex);
        // steps.swap(result, leftIndex, rightIndex); // This also swaps the two items.
        // steps.write(result, index, value);         // This also writes the value.
        // steps.fixed(result, index);

        // TODO: Implement your sorting algorithm here.

        return result;
    },

    findPath(grid, start, goal, steps) {
        // TODO: Implement BFS, DFS, Dijkstra, or A*.
        // grid[r][c]: 0 is walkable and 1 is a wall.
        // Call steps.visit(currentNode) when a cell is explored.
        // Return: [{ r: start.r, c: start.c }, ..., goal]
        throw new Error('Implement findPath().');
    },

    findRewardPath(grid, rewards, start, goal, steps) {
        // TODO: Find a reward-aware path from start to goal.
        // rewards[r][c] is an integer from 1 to 9 (0 for walls/start/goals).
        // Call steps.visit(currentNode) when a cell is explored.
        // Return a path: [start, ..., goal]
        throw new Error('Implement findRewardPath().');
    }
};
