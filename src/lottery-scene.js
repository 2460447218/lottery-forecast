import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {createBalls, stepBalls} from './ball-physics.mjs';

export function createLotteryScene(host, onFailure) {
  const renderer = new THREE.WebGLRenderer({antialias: true, alpha: false, powerPreference: 'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setClearColor('#e9eff1');
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', '可拖动视角的三维双球仓摇奖机');
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#e9eff1', 18, 34);
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 60);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = false; controls.enablePan = false;
  controls.minPolarAngle = .65; controls.maxPolarAngle = 1.45;
  controls.minAzimuthAngle = -.7; controls.maxAzimuthAngle = .8;
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .04);
  scene.environment = environment.texture; scene.environmentIntensity = .75;
  room.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight('#eaf5ff', '#6c767f', 1.5));
  const key = new THREE.DirectionalLight('#fff3df', 3.0);
  key.position.set(-3, 8, 6); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, {left: -5, right: 5, top: 5, bottom: -5, near: .1, far: 22});
  key.shadow.normalBias = .025; key.shadow.bias = -.0001;
  scene.add(key);
  const fill = new THREE.DirectionalLight('#c9e7ff', 1.3); fill.position.set(5, 4, -5); scene.add(fill);
  const materials = [], textures = [], geometries = [];
  const material = options => {const m = new THREE.MeshPhysicalMaterial(options); materials.push(m); return m;};
  const metal = material({color: '#aebfc8', metalness: .95, roughness: .22});
  const dark = material({color: '#183548', metalness: .65, roughness: .3});
  const gold = material({color: '#c7a879', metalness: .85, roughness: .25});
  const glass = material({color: '#f0fcff', metalness: 0, roughness: .055, transmission: .98, thickness: .035, ior: 1.12, clearcoat: 1, envMapIntensity: .75});
  function mesh(geometry, mat, position, parent = scene) {
    geometries.push(geometry);
    const object = new THREE.Mesh(geometry, mat); if (position) object.position.copy(position);
    parent.add(object); return object;
  }
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const floor = mesh(new THREE.PlaneGeometry(80, 80), material({color: '#e0e7e9', roughness: .8}), v(0, -.04, 0));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  const platform = mesh(new RoundedBoxGeometry(6.4, .25, 3.25, 3, .1), dark, v(0, .16, .25));
  platform.castShadow = true; platform.receiveShadow = true;
  mesh(new RoundedBoxGeometry(6.35, .045, 3.2, 2, .02), metal, v(0, .30, .25));
  for (const x of [-2.6, 2.6]) for (const z of [-.9, 1.4]) mesh(new THREE.CylinderGeometry(.17, .2, .13, 24), dark, v(x, .025, z));
  function nameplate(text, width, height, position) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#102c3d'; ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#a9bbc4'; ctx.lineWidth = 3; ctx.strokeRect(5, 5, 502, 118);
    ctx.fillStyle = '#edf2f3'; ctx.font = '600 42px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 65);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture);
    return mesh(new THREE.PlaneGeometry(width, height), material({map: texture, roughness: .4, metalness: .25}), position);
  }
  function makeBall(number, blue, radius) {
    const group = new THREE.Group(); scene.add(group);
    const sphere = mesh(new THREE.SphereGeometry(radius, 24, 16), blue ? bluePaint : redPaint, null, group);
    sphere.castShadow = true; sphere.receiveShadow = true;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fffaf2'; ctx.beginPath(); ctx.arc(64, 64, 63, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#172a38'; ctx.font = 'bold 66px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(number).padStart(2, '0'), 64, 68);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture);
    const labelMat = material({map: texture, roughness: .4});
    for (const side of [1, -1]) {
      const patch = new THREE.BufferGeometry(), vertices = [], uvs = [], indices = [];
      // Radial subdivisions keep the printed patch above the curved ball surface.
      for (let ring = 0; ring <= 8; ring++) for (let segment = 0; segment <= 32; segment++) {
        const angle = segment / 32 * Math.PI * 2, distance = radius * .68 * ring / 8;
        const x = Math.cos(angle) * distance, y = Math.sin(angle) * distance;
        vertices.push(x, y, Math.sqrt(radius * radius - x * x - y * y) + .003);
        uvs.push(.5 + x / (radius * 1.36), .5 + y / (radius * 1.36));
        if (ring < 8 && segment < 32) {const a = ring * 33 + segment, b = a + 33; indices.push(a, b, b + 1, a, b + 1, a + 1);}
      }
      patch.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      patch.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      patch.setIndex(indices);
      patch.computeVertexNormals();
      const label = mesh(patch, labelMat, null, group); if (side < 0) label.rotation.y = Math.PI;
    }
    return group;
  }
  const redPaint = material({color: '#bd1733', roughness: .26, metalness: .05, clearcoat: 1, clearcoatRoughness: .15});
  const bluePaint = material({color: '#154da7', roughness: .26, metalness: .05, clearcoat: 1, clearcoatRoughness: .15});
  const chambers = [];
  function chamber(x, radius, count, blue) {
    const center = v(x, 1.27 + radius, -.15), size = blue ? .18 : .185;
    const base = mesh(new THREE.CylinderGeometry(radius * .83, radius * .91, .65, 64), dark, v(x, .64, -.15)); base.castShadow = true;
    mesh(new THREE.CylinderGeometry(radius * .84, radius * .84, .08, 64), gold, v(x, .995, -.15));
    const cage = new THREE.Group(); cage.position.copy(center); scene.add(cage);
    // Clear sphere and machined supporting ring.
    mesh(new THREE.SphereGeometry(radius, 64, 40), glass, null, cage);
    const ring = mesh(new THREE.TorusGeometry(radius * 1.015, .032, 12, 100), metal, null, cage); ring.rotation.y = Math.PI / 2;
    const seam = mesh(new THREE.TorusGeometry(radius, .011, 8, 100), metal, null, cage); seam.rotation.x = Math.PI / 2;
    for (const direction of [-1, 1]) {
      const post = mesh(new THREE.CylinderGeometry(.055, .075, radius + 1.07, 20), metal, v(x + direction * radius * 1.02, .87 + radius / 2, -.15)); post.castShadow = true;
      const hub = mesh(new THREE.CylinderGeometry(.12, .12, .18, 24), gold, v(x + direction * radius * 1.02, center.y, -.15)); hub.rotation.z = Math.PI / 2;
    }
    // Fan visible under the chamber; air agitation uses sphere collision physics.
    const fan = new THREE.Group(); fan.position.set(x, center.y - radius + .07, -.15); scene.add(fan);
    for (let i = 0; i < 6; i++) {const blade = mesh(new THREE.BoxGeometry(.45, .025, .12), metal, v(Math.cos(i * Math.PI / 3) * .25, 0, Math.sin(i * Math.PI / 3) * .25), fan); blade.rotation.y = -i * Math.PI / 3;}
    mesh(new THREE.CylinderGeometry(.11, .13, .08, 24), gold, null, fan);
    const port = center.clone().add(v(0, -.60 * radius, .80 * radius));
    const end = v(x, .55, 1.48);
    const tubePath = new THREE.CatmullRomCurve3([port, v(x, port.y - .3, port.z + .24), v(x, .78, 1.48), end]);
    mesh(new THREE.TubeGeometry(tubePath, 30, size * 1.24, 16, false), glass);
    const nozzle = mesh(new THREE.TorusGeometry(size * 1.25, .035, 12, 32), gold, port); nozzle.rotation.x = -.45;
    const cup = mesh(new THREE.CylinderGeometry(.37, .42, .13, 40), metal, v(x, .39, 1.48)); cup.receiveShadow = true;
    nameplate(blue ? 'BLUE / 16' : 'RED / 33', radius * 1.18, .26, v(x, .65, radius * .93 - .15 + .005));
    const bodies = createBalls(count, radius - .045, size);
    bodies.forEach(body => {body.mesh = makeBall(body.number, blue, size); body.mesh.position.copy(center).add(v(body.x, body.y, body.z)); body.mesh.rotation.set(.15, (body.number % 5 - 2) * .35, (body.number % 3 - 1) * .3);});
    chambers.push({center, radius, size, bodies, fan, tubePath, blue, end});
  }
  chamber(-1.5, 1.36, 33, false); chamber(1.65, 1.10, 16, true);
  let mixing = false, active = true, intersecting = true, dead = false, frame = 0, last = 0, elapsed = 0, settling = 0;
  let flights = [];
  function render() {if (!dead) renderer.render(scene, camera);}
  function tick(now) {
    frame = 0; if (dead || !active || !intersecting || document.hidden) return;
    const dt = Math.min((now - (last || now)) / 1000, .033); last = now; elapsed += dt;
    if (mixing || settling > 0) {
      for (const c of chambers) {
        for (let i = 0; i < 2; i++) stepBalls(c.bodies, c.radius - .045, c.size, dt / 2, mixing, elapsed);
        if (mixing) c.fan.rotation.y += dt * 18;
        for (const b of c.bodies) if (!b.out) {
          b.mesh.position.set(b.x + c.center.x, b.y + c.center.y, b.z + c.center.z);
          if (mixing) {b.mesh.rotation.x += b.vz * dt; b.mesh.rotation.z -= b.vx * dt;}
        }
      }
      settling -= dt;
    }
    for (const flight of flights) {
      flight.age += dt; const t = Math.min(1, flight.age / flight.duration);
      if (t < .35) flight.body.mesh.position.lerpVectors(flight.start, flight.chamber.tubePath.getPoint(0), t / .35);
      else flight.body.mesh.position.copy(flight.chamber.tubePath.getPoint((t - .35) / .65));
      flight.body.mesh.quaternion.copy(camera.quaternion);
      if (t >= 1) flight.body.mesh.visible = false;
    }
    flights = flights.filter(flight => flight.age < flight.duration);
    render(); if (mixing || settling > 0 || flights.length) frame = requestAnimationFrame(tick);
  }
  function wake() {if (!frame && active && intersecting && !document.hidden && !dead) {last = 0; frame = requestAnimationFrame(tick);}}
  function fit() {
    if (!host.clientWidth || !host.clientHeight || dead) return;
    renderer.setSize(host.clientWidth, host.clientHeight, false); camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix(); resetView();
  }
  function resetView() {
    const distance = Math.max(8.4, 7.5 / (2 * Math.tan(THREE.MathUtils.degToRad(18)) * camera.aspect));
    camera.position.set(distance * .22, 2 + distance * .28, distance);
    controls.target.set(0, 1.95, .15); controls.update(); render();
  }
  const resizeObserver = new ResizeObserver(fit); resizeObserver.observe(host);
  const visibility = new IntersectionObserver(entries => {intersecting = entries[0].isIntersecting; if (intersecting) wake(); else {cancelAnimationFrame(frame); frame = 0;}}, {rootMargin: '120px'}); visibility.observe(host);
  controls.addEventListener('change', render);
  const onVisible = () => {if (document.hidden) {cancelAnimationFrame(frame); frame = 0;} else wake();}; document.addEventListener('visibilitychange', onVisible);
  const contextLost = event => {event.preventDefault(); onFailure?.();}; renderer.domElement.addEventListener('webglcontextlost', contextLost);
  fit(); render();
  return {
    reset() {flights = []; for (const c of chambers) {const reset = createBalls(c.bodies.length, c.radius - .045, c.size); c.bodies.forEach((b, i) => {Object.assign(b, reset[i]); b.mesh.visible = true; b.mesh.position.set(b.x + c.center.x, b.y + c.center.y, b.z + c.center.z);});} render();},
    setRunning(value) {mixing = value; settling = value ? 0 : 1; wake();},
    setActive(value) {active = value; controls.enabled = value; if (value) {fit(); wake();} else {cancelAnimationFrame(frame); frame = 0;}},
    eject(ball, duration) {const c = chambers.find(item => item.blue === ball.blue), body = c?.bodies.find(b => b.number === ball.number && !b.out); if (!body) return; body.out = true; flights.push({body, chamber: c, start: body.mesh.position.clone(), age: 0, duration}); wake();},
    resetView,
    dispose() {dead = true; cancelAnimationFrame(frame); resizeObserver.disconnect(); visibility.disconnect(); controls.dispose(); document.removeEventListener('visibilitychange', onVisible); renderer.domElement.removeEventListener('webglcontextlost', contextLost); scene.traverse(object => {if (object.isLight) object.dispose?.();}); for (const g of new Set(geometries)) g.dispose(); for (const m of new Set(materials)) m.dispose(); for (const t of textures) t.dispose(); environment.dispose(); renderer.dispose(); renderer.domElement.remove();}
  };
}

