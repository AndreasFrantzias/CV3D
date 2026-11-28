// the outdoors around the room: shape helpers, plus the clouds, birds and rabbits.
// each add* function puts its things in the scene and returns an update(dt) to call every frame (dt in seconds)
import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const { randFloat, randFloatSpread, randInt } = THREE.MathUtils

// a random spot on the ground (y = 0) minR-maxR from the room's centre, spread evenly by area,
// with a keepOut-wide square around the room left clear
export function groundSpot(minR, maxR, keepOut, out = new THREE.Vector3()) {
  do {
    const r = Math.sqrt(randFloat(minR ** 2, maxR ** 2)), a = Math.random() * Math.PI * 2
    out.set(Math.cos(a) * r, 0, Math.sin(a) * r)
  } while (Math.abs(out.x) < keepOut && Math.abs(out.z) < keepOut)
  return out
}

// a low-poly lump (bushes, rocks, clouds): an icosahedron with its corners pushed in and out at random
// (shared corners are merged first, as normals and uvs would keep them apart, so the faces stay joined)
export function lumpyBall(detail, min, max) {
  const geometry = mergeVertices(new THREE.IcosahedronGeometry(1, detail).deleteAttribute('normal').deleteAttribute('uv'))
  const corners = geometry.attributes.position
  for (let i = 0; i < corners.count; i++) {
    const lump = randFloat(min, max)
    corners.setXYZ(i, corners.getX(i) * lump, corners.getY(i) * lump, corners.getZ(i) * lump)
  }
  geometry.computeVertexNormals()
  return geometry
}

// low-poly clouds: rows of white lumps, biggest in the middle, slowly circling the room far out
export function addClouds(scene) {
  const CLOUDS = 32, MAX_PUFFS = 6
  // fog: false, or the fog would fade the far clouds into the sky
  const puffs = new THREE.InstancedMesh(lumpyBall(1, 0.85, 1.15), new THREE.MeshLambertMaterial({ flatShading: true, fog: false }), CLOUDS * MAX_PUFFS)
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(), along = new THREE.Vector3()
  let count = 0
  for (let c = 0; c < CLOUDS; c++) {
    // low and far, so they show above the horizon even in the starting view, which looks down into the room
    const base = groundSpot(60, 120, 0).setY(randFloat(9, 15))
    const heading = Math.random() * Math.PI * 2
    along.set(Math.cos(heading), 0, Math.sin(heading))
    const puffCount = randInt(3, MAX_PUFFS)
    for (let p = 0; p < puffCount; p++) {
      const t = p / (puffCount - 1) - 0.5 // -0.5 at one end of the cloud, 0.5 at the other
      const size = randFloat(2.2, 3.3) + (0.5 - Math.abs(t)) * 4.5
      pos.copy(base).addScaledVector(along, t * puffCount * 3.9)
      pos.y += size * 0.45 // bigger puffs rise higher, so the bottoms stay roughly level
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.random() * Math.PI * 2)
      puffs.setMatrixAt(count++, m.compose(pos, q, scl.set(size, size * 0.65, size)))
    }
  }
  puffs.count = count
  const clouds = new THREE.Group().add(puffs)
  scene.add(clouds)
  return (dt) => (clouds.rotation.y += dt * 0.01) // a lap every ten minutes or so
}

// low-poly birds: a pointed body and two flat wings that flap in bursts between glides, each circling over the trees
export function addBirds(scene) {
  const BIRDS = 9
  const material = new THREE.MeshLambertMaterial({ color: 0x2f2f3a, flatShading: true, side: THREE.DoubleSide })
  const bodyGeo = new THREE.ConeGeometry(0.12, 0.6, 4).rotateX(Math.PI / 2) // beak toward +z, which lookAt turns to face the way it flies
  const wingGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.15, 0, 0, -0.15, 0.75, 0, -0.1], 3)) // root along the body, tip out at +x
  wingGeo.computeVertexNormals()

  const birds = Array.from({ length: BIRDS }, () => {
    const bird = new THREE.Group()
    const wings = [1, -1].map((side) => {
      const wing = new THREE.Mesh(wingGeo, material)
      wing.scale.x = side // the second wing is the first mirrored
      bird.add(wing)
      return wing
    })
    bird.add(new THREE.Mesh(bodyGeo, material))
    scene.add(bird)
    // above the room (7.3 tall) and the trees (up to 7)
    return { bird, wings, center: groundSpot(15, 45, 0).setY(randFloat(8.5, 14)), radius: randFloat(6, 15), speed: randFloat(4, 6) * (Math.random() < 0.5 ? 1 : -1), angle: Math.random() * Math.PI * 2, phase: Math.random() * 10 }
  })

  const ahead = new THREE.Vector3()
  const onLoop = (b, angle, out) => out.set(b.center.x + Math.cos(angle) * b.radius, b.center.y + Math.sin(angle * 3) * 0.3, b.center.z + Math.sin(angle) * b.radius)
  let time = 0
  return (dt) => {
    time += dt
    for (const b of birds) {
      b.angle += (b.speed / b.radius) * dt
      onLoop(b, b.angle, b.bird.position)
      b.bird.lookAt(onLoop(b, b.angle + Math.sign(b.speed) * 0.05, ahead))
      b.bird.rotateZ(Math.sign(b.speed) * 0.35) // bank into the turn
      const flap = Math.sin(time * 12 + b.phase) * 0.7 * Math.max(0, Math.sin(time * 0.6 + b.phase)) // flapping fades in and out
      b.wings[0].rotation.z = flap
      b.wings[1].rotation.z = -flap
    }
  }
}

// low-poly rabbits hopping between random spots in the clearing between the room and the trees, pausing now and then
export function addRabbits(scene, groundY) {
  const RABBITS = 4
  const HOP_SPEED = 0.8 // units per second
  // one shape, head toward +z (lookAt turns that to where it's going): body, head and ears; the white tail is separate
  const ear = (x) => new THREE.BoxGeometry(0.05, 0.28, 0.1).toNonIndexed().rotateX(-0.25).translate(x, 0.6, 0.22) // leaning back a little
  const bodyGeo = mergeGeometries([
    new THREE.IcosahedronGeometry(0.25, 0).scale(1, 0.85, 1.3).translate(0, 0.21, 0),
    new THREE.IcosahedronGeometry(0.16, 0).translate(0, 0.38, 0.27),
    ear(0.06),
    ear(-0.06),
  ])
  const tailGeo = new THREE.IcosahedronGeometry(0.07, 0).translate(0, 0.25, -0.32)
  const furs = [0x9a6a44, 0x8c8c8c, 0xd9c8a9].map((color) => new THREE.MeshLambertMaterial({ color, flatShading: true }))
  const white = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true })

  // stays in the clearing: outside the room and short of the trees (which start 11 out)
  const inClearing = (p) => Math.hypot(p.x, p.z) < 10 && (Math.abs(p.x) > 5 || Math.abs(p.z) > 5)
  const rabbits = Array.from({ length: RABBITS }, (_, i) => {
    const rabbit = new THREE.Group().add(new THREE.Mesh(bodyGeo, furs[i % furs.length]), new THREE.Mesh(tailGeo, white))
    rabbit.traverse((part) => (part.castShadow = true))
    groundSpot(6, 9.5, 5.2, rabbit.position).setY(groundY)
    rabbit.rotation.y = Math.random() * Math.PI * 2
    scene.add(rabbit)
    return { rabbit, target: rabbit.position.clone(), wait: randFloat(0, 5), hop: 0 }
  })

  // the whole way there has to stay in the clearing too, or a rabbit could cut a corner through the room
  const along = new THREE.Vector3()
  const pathClear = (from, to) => [0.25, 0.5, 0.75, 1].every((t) => inClearing(along.lerpVectors(from, to, t)))

  function pickTarget(r) {
    do r.target.copy(r.rabbit.position).add({ x: randFloatSpread(4), y: 0, z: randFloatSpread(4) })
    while (!pathClear(r.rabbit.position, r.target))
    r.rabbit.lookAt(r.target.x, r.rabbit.position.y, r.target.z)
    r.hop = 0
  }

  const step = new THREE.Vector3()
  return (dt) => {
    for (const r of rabbits) {
      if (r.wait > 0) {
        r.wait -= dt
        if (r.wait <= 0) pickTarget(r)
        continue
      }
      const distance = step.subVectors(r.target, r.rabbit.position).setY(0).length()
      r.hop += dt * 9
      if (distance > 0.05) r.rabbit.position.addScaledVector(step.normalize(), Math.min(distance, HOP_SPEED * dt))
      else if (r.hop % Math.PI < 0.3) {
        // arrived and just landed (finishing the hop in place, so it doesn't drop out of the air): rest a while
        r.rabbit.position.y = groundY
        r.wait = randFloat(3, 8)
        continue
      }
      r.rabbit.position.y = groundY + Math.abs(Math.sin(r.hop)) * 0.22
    }
  }
}
