// FNV-1a 64-bit hash
function fnv1a64(str: string): bigint {
  let hash = 14695981039346656037n;
  for (let i = 0; i < str.length; i++) {
    hash ^= BigInt(str.charCodeAt(i));
    hash = BigInt.asUintN(64, hash * 1099511628211n);
  }
  return hash;
}

const STOPWORDS = new Set(['a', 'an', 'and', 'the', 'is', 'in', 'to', 'with', 'for', 'on', 'of', 'at']);

export function computeSimHash(text: string): bigint {
  const words = (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter(w => !STOPWORDS.has(w));
  
  // Use bigrams + unigrams
  const tokens: string[] = [...words];
  for (let i = 0; i < words.length - 1; i++) {
    tokens.push(words[i] + ' ' + words[i+1]);
  }

  const v = new Int32Array(64);

  for (const token of tokens) {
    let h = fnv1a64(token);
    for (let i = 0n; i < 64n; i++) {
      if ((h & (1n << i)) !== 0n) {
        v[Number(i)] += 1;
      } else {
        v[Number(i)] -= 1;
      }
    }
  }

  let result = 0n;
  for (let i = 0n; i < 64n; i++) {
    if (v[Number(i)] > 0) {
      result |= (1n << i);
    }
  }
  return result;
}

export function hammingDistance(a: bigint, b: bigint): number {
  let xor = a ^ b;
  let count = 0;
  while (xor > 0n) {
    count += Number(xor & 1n);
    xor >>= 1n;
  }
  return count;
}
