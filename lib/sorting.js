/**
 * Timsort implementation for stability and performance on mostly-sorted data.
 * @param {Array} arr - The array to sort.
 * @param {Function} compareFn - A function that defines the sort order.
 * @returns {Array} - The sorted array.
 */
export function timSort(arr, compareFn) {
  const n = arr.length;
  if (n <= 1) return arr;

  const MIN_MERGE = 32;

  function minRunLength(n) {
    let r = 0;
    while (n >= MIN_MERGE) {
      r |= n & 1;
      n >>= 1;
    }
    return n + r;
  }

  function insertionSort(arr, left, right) {
    for (let i = left + 1; i <= right; i++) {
      const temp = arr[i];
      let j = i - 1;
      while (j >= left && compareFn(arr[j], temp) > 0) {
        arr[j + 1] = arr[j];
        j--;
      }
      arr[j + 1] = temp;
    }
  }

  function merge(arr, l, m, r) {
    const len1 = m - l + 1;
    const len2 = r - m;
    const left = new Array(len1);
    const right = new Array(len2);

    for (let i = 0; i < len1; i++) left[i] = arr[l + i];
    for (let i = 0; i < len2; i++) right[i] = arr[m + 1 + i];

    let i = 0, j = 0, k = l;
    while (i < len1 && j < len2) {
      if (compareFn(left[i], right[j]) <= 0) {
        arr[k] = left[i];
        i++;
      } else {
        arr[k] = right[j];
        j++;
      }
      k++;
    }

    while (i < len1) {
      arr[k] = left[i];
      i++;
      k++;
    }

    while (j < len2) {
      arr[k] = right[j];
      j++;
      k++;
    }
  }

  const minRun = minRunLength(n);

  for (let i = 0; i < n; i += minRun) {
    insertionSort(arr, i, Math.min(i + minRun - 1, n - 1));
  }

  for (let size = minRun; size < n; size = 2 * size) {
    for (let left = 0; left < n; left += 2 * size) {
      const mid = left + size - 1;
      const right = Math.min(left + 2 * size - 1, n - 1);
      if (mid < right) {
        merge(arr, left, mid, right);
      }
    }
  }

  return arr;
}
