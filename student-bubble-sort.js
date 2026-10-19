module.exports = {
    sort(items, steps) {
        const result = items.map(item => ({ ...item }));

        // Define a helper function, then call it below.
        function bubbleSort() {
            // Compare adjacent items and place higher priorities first.
            // Each pass moves the smallest remaining priority to the end.
            for (let end = result.length - 1; end > 0; end--) {
                let swapped = false;

                for (let i = 0; i < end; i++) {
                    steps.compare(result, i, i + 1);
                    if (result[i].priority < result[i + 1].priority) {
                        // swap() updates the array and records the visualization.
                        steps.swap(result, i, i + 1);
                        swapped = true;
                    }
                }

                steps.fixed(result, end);

                // If no swap occurred, the remaining prefix is already sorted.
                if (!swapped) {
                    for (let i = 0; i < end; i++) steps.fixed(result, i);
                    return;
                }
            }

            if (result.length > 0) steps.fixed(result, 0);
        }

        bubbleSort();
        return result;
    }
};
