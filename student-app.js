window.AlgorithmPageMode = 'student';
window.StudentProblemTest = 1;
window.ActiveSearchMode = 'path';

document.addEventListener('DOMContentLoaded', () => {
    const submission = {};

    const executionGuards = {
        sort: {
            requiredFunction: 'sort',
            buttonIds: ['visualizeSortBtn', 'sortStepBtn'],
            warning: document.getElementById('sortSubmissionWarning'),
            card: document.getElementById('sortStepCard'),
        },
        path: {
            requiredFunction: 'findPath',
            buttonIds: ['startBtn'],
            warning: document.getElementById('pathSubmissionWarning'),
            warningMessage: 'Upload your Finding Path algorithm before running the visualization.',
            card: document.getElementById('pathStepCard'),
        },
        reward: {
            requiredFunction: 'findRewardPath',
            buttonIds: ['rewardStartBtn'],
            warning: document.getElementById('pathSubmissionWarning'),
            warningMessage: 'Upload your Reward Path algorithm before running the visualization.',
            card: document.getElementById('rewardStepCard'),
        },
    };

    Object.values(executionGuards).forEach(guard => {
        guard.buttonIds.forEach(buttonId => {
            document.getElementById(buttonId)?.addEventListener('click', event => {
                if (typeof submission[guard.requiredFunction] === 'function') return;
                event.preventDefault();
                event.stopImmediatePropagation();
                if (guard.warningMessage) guard.warning.textContent = guard.warningMessage;
                guard.warning.hidden = false;
                guard.card.classList.add('needs-upload');
            }, true);
        });
    });

    document.querySelector('#sortStepCard h3').textContent = 'Sort Algorithm';
    document.querySelector('#sortStepCard p').innerHTML =
        '<code>sort(items, steps)</code>';
    document.querySelector('#pathStepCard h3').textContent = 'Finding Path Algorithm';
    document.querySelector('#pathStepCard p').innerHTML =
        '<code>findPath(grid, start, goal, steps)</code>';

    const selectTest = test => {
        window.StudentProblemTest = test;
        const fixture = window.StudentTestCases[test];
        const wallRatio = fixture.walls.length / (fixture.size * fixture.size);
        document.getElementById('gridSize').value = fixture.size;
        document.getElementById('gridSizeValue').textContent = fixture.size;
        document.getElementById('wallRatio').value = wallRatio;
        document.getElementById('wallRatioValue').textContent = wallRatio.toFixed(2);
        document.getElementById('goalCount').value = fixture.goals.length;
        document.getElementById('goalCountValue').textContent = fixture.goals.length;
        document.querySelectorAll('.test-tab').forEach(tab => tab.classList.toggle('is-active', Number(tab.dataset.test) === test));
        document.dispatchEvent(new CustomEvent('student-problem-change', { detail: { test } }));
    };
    document.querySelectorAll('.test-tab').forEach(tab => tab.addEventListener('click', () => selectTest(Number(tab.dataset.test))));
    selectTest(1);

    const clearSelectedTest = () => {
        window.StudentProblemTest = null;
        document.querySelectorAll('.test-tab').forEach(tab => tab.classList.remove('is-active'));
    };

    document.getElementById('generateMapBtn').addEventListener('click', () => {
        clearSelectedTest();
        const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
        const gridSize = randomInt(10, 25);
        const goalCount = randomInt(2, Math.min(8, Math.max(2, Math.floor(gridSize / 2))));

        document.getElementById('gridSize').value = gridSize;
        document.getElementById('gridSizeValue').textContent = gridSize;
        document.getElementById('goalCount').value = goalCount;
        document.getElementById('goalCountValue').textContent = goalCount;
    });
    document.getElementById('fixedSetProblemBtn').addEventListener('click', clearSelectedTest);

    function bindUpload(type, requiredFunction) {
        const input = document.getElementById(`${type}CodeFile`);
        const fileName = document.getElementById(`${type}FileName`);
        const status = document.getElementById(`${type}UploadStatus`);
        const state = document.getElementById(`${type}StepState`);
        const card = document.getElementById(`${type}StepCard`);

        input.addEventListener('change', async () => {
            const file = input.files[0];
            if (!file) return;
            fileName.textContent = file.name;
            try {
                const source = await file.text();
                const module = { exports: {} };
                new Function('module', 'exports', source)(module, module.exports);
                const uploaded = module.exports;
                if (typeof uploaded[requiredFunction] !== 'function') {
                    throw new Error(`${requiredFunction}() must be exported.`);
                }
                submission[requiredFunction] = uploaded[requiredFunction];
                window.StudentAlgorithmSubmission = submission;
                status.className = 'upload-status success';
                status.textContent = `${file.name} loaded — use Start or Step.`;
                state.textContent = 'Completed';
                card.classList.add('is-complete');
                card.classList.remove('has-error');
                card.classList.remove('needs-upload');
                executionGuards[type].warning.hidden = true;
            } catch (error) {
                delete submission[requiredFunction];
                window.StudentAlgorithmSubmission = submission;
                status.className = 'upload-status error';
                status.textContent = error.message || String(error);
                state.textContent = 'Check file';
                card.classList.add('has-error');
                card.classList.add('needs-upload');
                card.classList.remove('is-complete');
                executionGuards[type].warning.textContent =
                    `Cannot run this visualization: ${error.message || String(error)}`;
                executionGuards[type].warning.hidden = false;
            }
        });
    }

    bindUpload('sort', 'sort');
    bindUpload('path', 'findPath');
    bindUpload('reward', 'findRewardPath');
});
