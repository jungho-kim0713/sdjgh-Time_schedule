const parts = '26.5.15.금'.split('.'); 
const y = parts[0].length === 2 ? '20' + parts[0] : parts[0]; 
const m = parts[1].trim().padStart(2, '0'); 
const d_part = parts[2].trim().padStart(2, '0'); 
console.log(`${y}-${m}-${d_part}`);
