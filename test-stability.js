import { timSort } from './lib/sorting.js';

const testData = [
    { id: 1, value: 10 },
    { id: 2, value: 20 },
    { id: 3, value: 10 },
    { id: 4, value: 20 },
    { id: 5, value: 10 },
];

const compareFn = (a, b) => {
    if (a.value < b.value) return -1;
    if (a.value > b.value) return 1;
    return 0;
};

timSort(testData, compareFn);

console.log('Sorted Data:', JSON.stringify(testData));

const ids = testData.map(d => d.id);
// Expected for stable sort by value 10 then 20: [1, 3, 5, 2, 4]
const expectedIds = [1, 3, 5, 2, 4];
const isStable = JSON.stringify(ids) === JSON.stringify(expectedIds);

console.log('Is Stable:', isStable);

if (!isStable) {
    process.exit(1);
}
