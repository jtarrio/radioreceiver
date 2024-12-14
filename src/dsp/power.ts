export function getPower(I: Float32Array, Q: Float32Array): number {
  let power = 0;
  for (let i = 0; i < I.length; ++i) {
    const vI = I[i];
    const vQ = Q[i];
    power += vI * vI + vQ * vQ;
  }
  return power / I.length;
}
