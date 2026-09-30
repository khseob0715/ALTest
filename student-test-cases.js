// Fixed evaluation fixtures. These values never change between students or runs.
window.StudentTestCases = {
    1: {
        size: 10,
        start: { r: 1, c: 1 },
        goals: [
            { r: 8, c: 8, priority: 92, id: 1 },
            { r: 1, c: 8, priority: 67, id: 2 },
            { r: 8, c: 2, priority: 81, id: 3 },
            { r: 5, c: 7, priority: 54, id: 4 },
        ],
        walls: [[0,4],[1,4],[2,4],[3,4],[5,4],[6,4],[7,4],[8,4],[3,1],[3,2],[3,3],[6,6],[6,7],[6,8]],
        rewardOffset: 1,
    },
    2: {
        size: 12,
        start: { r: 10, c: 1 },
        goals: [
            { r: 1, c: 10, priority: 88, id: 1 },
            { r: 9, c: 10, priority: 73, id: 2 },
            { r: 2, c: 2, priority: 96, id: 3 },
            { r: 6, c: 9, priority: 61, id: 4 },
            { r: 4, c: 5, priority: 79, id: 5 },
        ],
        walls: [[1,6],[2,6],[3,6],[4,6],[5,6],[7,6],[8,6],[9,6],[10,6],[6,1],[6,2],[6,3],[6,4],[6,8],[6,9],[6,10],[2,9],[3,9],[4,9],[8,2],[8,3],[8,4]],
        rewardOffset: 4,
    },
    3: {
        size: 15,
        start: { r: 7, c: 1 },
        goals: [
            { r: 7, c: 13, priority: 90, id: 1 },
            { r: 1, c: 13, priority: 76, id: 2 },
            { r: 13, c: 13, priority: 84, id: 3 },
            { r: 2, c: 3, priority: 98, id: 4 },
            { r: 12, c: 3, priority: 69, id: 5 },
            { r: 4, c: 10, priority: 57, id: 6 },
        ],
        walls: [[1,5],[2,5],[3,5],[4,5],[5,5],[6,5],[8,5],[9,5],[10,5],[11,5],[12,5],[13,5],[3,9],[4,9],[5,9],[6,9],[7,9],[8,9],[9,9],[10,9],[11,9],[7,2],[7,3],[7,4],[7,10],[7,11],[7,12],[11,1],[11,2],[11,3],[2,11],[2,12],[3,12]],
        rewardOffset: 7,
    },
};
