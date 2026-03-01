import { timSort } from './lib/sorting.js';

const testData = [
    { name: 'C', value: 3 },
    { name: 'A', value: 1 },
    { name: 'B', value: 2 },
    { name: 'D', value: 1 },
];

const compareFn = (a, b) => {
    if (a.value < b.value) return -1;
    if (a.value > b.value) return 1;
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
};

const dataForNative = [...testData];
const dataForTim = [...testData];

dataForNative.sort(compareFn);
timSort(dataForTim, compareFn);

console.log('Native:', JSON.stringify(dataForNative));
console.log('Tim:', JSON.stringify(dataForTim));

const match = JSON.stringify(dataForNative) === JSON.stringify(dataForTim);
console.log('Match:', match);

if (!match) {
    process.exit(1);
}
