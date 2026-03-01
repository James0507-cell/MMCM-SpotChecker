import { timSort } from './lib/sorting.js';

const n = 1000;
const testData = Array.from({ length: n }, (_, i) => ({
    id: i,
    value: Math.floor(Math.random() * 100)
}));

const compareFn = (a, b) => {
    if (a.value < b.value) return -1;
    if (a.value > b.value) return 1;
    return a.id - b.id; // Stability check
};

const dataForNative = [...testData];
const dataForTim = [...testData];

dataForNative.sort(compareFn);
timSort(dataForTim, compareFn);

const match = JSON.stringify(dataForNative) === JSON.stringify(dataForTim);
console.log('Match with n=1000:', match);

if (!match) {
    for (let i = 0; i < n; i++) {
        if (JSON.stringify(dataForNative[i]) !== JSON.stringify(dataForTim[i])) {
            console.log(`Mismatch at index ${i}:`);
            console.log('Native:', dataForNative[i]);
            console.log('Tim:', dataForTim[i]);
            break;
        }
    }
    process.exit(1);
}
