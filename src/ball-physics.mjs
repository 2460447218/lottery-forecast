// Equal-mass sphere collisions inside a spherical chamber. Visual motion only.
export function createBalls(count, chamberRadius, ballRadius) {
  let seed = count * 1717;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const balls = [], limit = chamberRadius - ballRadius;
  for (let i = 0; i < count; i++) {
    let p;
    for (let attempt = 0; attempt < 10000; attempt++) {
      p = {x: (random() * 2 - 1) * limit, y: (random() * 2 - 1) * limit, z: (random() * 2 - 1) * limit};
      if (Math.hypot(p.x, p.y, p.z) < limit && balls.every(b => Math.hypot(p.x - b.x, p.y - b.y, p.z - b.z) > ballRadius * 2.05)) break;
    }
    balls.push({...p, vx: 0, vy: 0, vz: 0, out: false, number: i + 1});
  }
  for (let i = 0; i < 180; i++) stepBalls(balls, chamberRadius, ballRadius, 1 / 120, false, i / 120);
  return balls;
}
export function stepBalls(balls, radius, size, dt, mixing, time) {
  const limit = radius - size, diameter = size * 2;
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i]; if (b.out) continue;
    b.vy -= 8.5 * dt;
    if (mixing) {
      b.vx += (-b.z * 9 + Math.sin(time * 4.3 + i * 2.4) * 10) * dt;
      b.vz += (b.x * 9 + Math.cos(time * 3.7 + i * 1.9) * 10) * dt;
      b.vy += (6 + 7 * Math.sin(time * 3.1 + i) + (b.y < -radius * .35 ? 22 : 0)) * dt;
    }
    const speed = Math.hypot(b.vx, b.vy, b.vz), damping = Math.exp(-dt * (mixing ? .28 : 1.4)) * Math.min(1, 6 / Math.max(speed, .001));
    b.vx *= damping; b.vy *= damping; b.vz *= damping;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i], b = balls[j]; if (a.out || b.out) continue;
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, length = Math.hypot(dx, dy, dz);
      if (length >= diameter || length < 1e-8) continue;
      const nx = dx / length, ny = dy / length, nz = dz / length, overlap = (diameter - length) / 2;
      a.x -= nx * overlap; a.y -= ny * overlap; a.z -= nz * overlap;
      b.x += nx * overlap; b.y += ny * overlap; b.z += nz * overlap;
      const closing = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny + (b.vz - a.vz) * nz;
      if (closing < 0) {
        const impulse = -closing * .84;
        a.vx -= nx * impulse; a.vy -= ny * impulse; a.vz -= nz * impulse;
        b.vx += nx * impulse; b.vy += ny * impulse; b.vz += nz * impulse;
      }
    }
    for (const b of balls) {
      if (b.out) continue;
      const length = Math.hypot(b.x, b.y, b.z);
      if (length > limit) {
        const nx = b.x / length, ny = b.y / length, nz = b.z / length;
        b.x = nx * limit; b.y = ny * limit; b.z = nz * limit;
        const outward = b.vx * nx + b.vy * ny + b.vz * nz;
        if (outward > 0) {b.vx -= nx * outward * 1.68; b.vy -= ny * outward * 1.68; b.vz -= nz * outward * 1.68;}
      }
    }
  }
}
