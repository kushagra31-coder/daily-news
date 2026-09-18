import { computeSimHash, hammingDistance } from './simhash';

console.log("SimHash Tests");
const h1 = computeSimHash("Apple launches new iPhone 16 Pro Max");
const h2 = computeSimHash("Apple announces the new iPhone 16 Pro Max");
const h3 = computeSimHash("Microsoft reveals new Surface Laptop 6");

const d1 = hammingDistance(h1, h2);
const d2 = hammingDistance(h1, h3);

console.log("Similar (should be low): ", d1);
console.log("Unrelated (should be high): ", d2);
if (d1 < d2 && d1 <= 20 && d2 > 20) {
    console.log("PASS: SimHash threshold works");
} else {
    console.log("FAIL: SimHash distances are wrong");
}
