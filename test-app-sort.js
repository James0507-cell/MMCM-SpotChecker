import { timSort } from './lib/sorting.js';

const facilities = [
    { facility_name: 'Facility 1', building_name: 'Building 1', current_occupancy: 10, max_occupancy: 100 },
    { facility_name: 'Facility 10', building_name: 'Building 1', current_occupancy: 50, max_occupancy: 100 },
    { facility_name: 'Facility 2', building_name: 'Building 2', current_occupancy: 20, max_occupancy: 100 },
    { facility_name: 'Facility 20', building_name: 'Building 2', current_occupancy: 80, max_occupancy: 100 },
];

const sortStack = [{ field: 'current_occupancy', order: 'asc' }];

const getOccupancyLevel = (current, max) => {
    if (max === 0) return 0;
    return Math.min(100, Math.round((current / max) * 100));
};

const compareFn = (a, b) => {
    for (const sort of sortStack) {
        let valA = a[sort.field];
        let valB = b[sort.field];

        if (sort.field === 'occupancy_level') {
            valA = getOccupancyLevel(a.current_occupancy, a.max_occupancy);
            valB = getOccupancyLevel(b.current_occupancy, b.max_occupancy);
        }

        if (valA < valB) return sort.order === 'asc' ? -1 : 1;
        if (valA > valB) return sort.order === 'asc' ? 1 : -1;
    }
    return 0;
};

const dataForNative = [...facilities];
const dataForTim = [...facilities];

dataForNative.sort(compareFn);
timSort(dataForTim, compareFn);

console.log('Native:', dataForNative.map(f => f.facility_name));
console.log('Tim:', dataForTim.map(f => f.facility_name));
