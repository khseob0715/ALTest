// Student-page algorithm adapter. This file is never loaded by the demo page.
(() => {
    const createPathSteps = visited => {
        const record = node => {
            if (!node || !Number.isInteger(node.r) || !Number.isInteger(node.c)) {
                throw new Error('steps.visit() requires a node with integer r and c values.');
            }
            visited.push({ r: node.r, c: node.c });
        };
        // Callable for legacy onStep(node) submissions.
        record.visit = (nodeOrRow, column) => {
            record(typeof nodeOrRow === 'object' ? nodeOrRow : { r: nodeOrRow, c: column });
        };
        return record;
    };

    const createSortSteps = onStep => {
        let previousItems = null;
        const fixedIndices = [];
        const emit = payload => {
            const event = Array.isArray(payload) ? null : payload;
            const items = event ? event.items : payload;
            if (!Array.isArray(items)) throw new Error('onStep() requires an items array.');

            const snapshot = items.map(item => ({ ...item }));
            const changedIndices = previousItems
                ? snapshot.reduce((indices, item, index) => {
                    if (previousItems[index]?.id !== item.id) indices.push(index);
                    return indices;
                }, [])
                : [];
            onStep({
                items: snapshot,
                action: event?.action || (previousItems ? (changedIndices.length ? 'swap' : 'student') : 'initial'),
                indices: Array.isArray(event?.indices) ? [...event.indices] : changedIndices,
                fixedIndices: Array.isArray(event?.fixedIndices) ? [...event.fixedIndices] : [],
            });
            previousItems = snapshot;
        };
        emit.compare = (items, left, right) => {
            emit({ items, action: 'compare', indices: [left, right], fixedIndices });
        };
        emit.swap = (items, left, right) => {
            [items[left], items[right]] = [items[right], items[left]];
            emit({ items, action: 'swap', indices: [left, right], fixedIndices });
        };
        emit.write = (items, index, value) => {
            items[index] = value;
            emit({ items, action: 'write', indices: [index], fixedIndices });
        };
        emit.fixed = (items, index) => {
            if (!fixedIndices.includes(index)) fixedIndices.push(index);
            emit({ items, action: 'fixed', indices: [index], fixedIndices });
        };
        return emit;
    };

    window.PageAlgorithmOverrides = {
        sort(destinations, onStep) {
            const input = destinations.map(destination => ({ ...destination }));
            const steps = createSortSteps(onStep);
            steps({ items: input, action: 'initial', indices: [], fixedIndices: [] });
            if (typeof window.StudentAlgorithmSubmission?.sort !== 'function') return input;
            const result = window.StudentAlgorithmSubmission.sort(input, steps) || input;
            if (!Array.isArray(result)) throw new Error('sort() must return an array.');
            onStep({
                items: result.map(item => ({ ...item })),
                action: 'complete',
                indices: [],
                fixedIndices: result.map((_, index) => index),
            });
            return result;
        },

        findPath(gridModel, wallType) {
            const started = performance.now();
            const visited = [];
            const grid = gridModel.grid.map(row => row.map(cell => cell === wallType ? 1 : 0));
            const pathSteps = createPathSteps(visited);
            const isRewardSearch = window.ActiveSearchMode === 'reward';
            const path = isRewardSearch
                ? window.StudentAlgorithmSubmission.findRewardPath(
                    grid,
                    gridModel.rewards.map(row => [...row]),
                    { ...gridModel.start },
                    { ...gridModel.goal },
                    pathSteps
                )
                : window.StudentAlgorithmSubmission.findPath(
                    grid,
                    { ...gridModel.start },
                    { ...gridModel.goal },
                    pathSteps
                );
            const normalizedPath = Array.isArray(path)
                ? path.map(node => ({ r: node.r, c: node.c }))
                : [];
            const animationSteps = visited.map((node, index) => ({
                current: node,
                addedToFrontier: [],
                frontierSize: 0,
                expandedNodes: index + 1,
            }));
            const rewardedCells = new Set();
            let rewardedCellCount = 0;
            const totalReward = normalizedPath.reduce((sum, node) => {
                const cellKey = `${node.r},${node.c}`;
                if (rewardedCells.has(cellKey)) return sum;
                rewardedCells.add(cellKey);
                const reward = gridModel.rewards[node.r]?.[node.c] || 0;
                if (reward > 0) rewardedCellCount++;
                return sum + reward;
            }, 0);
            return {
                algorithm: isRewardSearch ? 'Uploaded Reward Path' : 'Uploaded Path',
                found: normalizedPath.length > 0,
                path: normalizedPath,
                steps: animationSteps,
                expandedNodes: animationSteps.length,
                maxFrontierSize: 0,
                pathLength: normalizedPath.length,
                totalReward,
                rewardedCellCount,
                searchMode: isRewardSearch ? 'reward' : 'greedy',
                runtimeMs: performance.now() - started,
                timeComplexity: 'Uploaded',
                spaceComplexity: 'Uploaded',
            };
        },
    };
})();
