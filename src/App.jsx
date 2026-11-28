import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { drawDesktop, drawGitHubProfile } from './screens.js'
import './App.css'

// the small monitor's Projects window lists this account's public repos
const GITHUB_USER = 'AndreasFrantzias'

// shown in the window that opens when the laptop screen is clicked — fill these in
const INFO = {
  name: 'Andreas Frantzias',
  education: 'BSc in Computer Science, National and Kapodistrian University of Athens',
  bio: 'Aspiring software engineer with a passion for 3D graphics, web development, and quantum computing. Skilled in C++, React/Three.js and blender, I enjoy creating immersive applications that blend technology and creativity.',
  links: [
    { label: 'GitHub', href: `https://github.com/${GITHUB_USER}` },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/andreas-frantzias-bb81b2303/' },
    { label: 'Instagram', href: 'https://www.instagram.com/frantziasandreas/' },
  ],
}

// shown in the window that opens when the books are clicked — fill these in
const BOOKS = [
  { title: 'Metamorphosis', author: 'Franz Kafka' },
  { title: 'The Brothers Karamazov', author: 'Fyodor Dostoevsky' }
]

// shown in the window that opens when the snowboard or helmet is clicked — fill these in
const SPORTS = [
  { name: 'Snowboarding', note: 'Started 3 years ago, Visited Bansko in Hungary,Parnassos' },
  { name: 'Basketball', note: 'I played basketball from middle school and i now play when i have the time' },
]

// shown in the Hobbies window that opens when the 3D printer is clicked — put the photos in public/prints/ and list them here,
// e.g. { src: '/prints/benchy.jpg', caption: 'Benchy' }
const PRINTS = []

const xyz = (v) => ({ x: v.x, y: v.y, z: v.z })

// the desktop-style window that the monitor, guitar, books and snow gear open
function OsWindow({ title, label, onClose, children }) {
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="os-window" role="dialog" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div className="titlebar">
          <button className="dot close" aria-label="Close" autoFocus onClick={onClose} />
          <span className="dot min" />
          <span className="dot max" />
          <span className="title">{title}</span>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  )
}

export default function App() {
  const containerRef = useRef(null)
  const closeRef = useRef(null)
  const promptRef = useRef(null)
  const [windowOpen, setWindowOpen] = useState(false)
  const [songsOpen, setSongsOpen] = useState(false)
  const [booksOpen, setBooksOpen] = useState(false)
  const [sportsOpen, setSportsOpen] = useState(false)
  const [printsOpen, setPrintsOpen] = useState(false)
  const [tracks, setTracks] = useState(null) // null = loading, false = couldn't load, else the track list
  const [projectsOpen, setProjectsOpen] = useState(false)
  const [repos, setRepos] = useState(null) // null = loading, false = couldn't load, else the repo list

  useEffect(() => {
    const container = containerRef.current

    // scene / camera / renderer / controls / lights / loader setup
    const scene = new THREE.Scene()

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.set(6.9, 7.7, 5.2) // the opening view: looking into the room's open corner (target set on the controls below)

    const renderer = new THREE.WebGLRenderer()
    //renderer.antialias = true
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.toneMapping = THREE.NeutralToneMapping // keeps colors saturated; AgX (Blender's default) washed them out
    renderer.toneMappingExposure = 1.4 // Neutral renders darker than AgX, so brighten to match
    renderer.shadowMap.enabled = true
    container.appendChild(renderer.domElement)

    // soft sky fill; the sun, desk lamp and screen glows come from the .glb (lights made in Blender)
    const SKY_FILL = 1
    const SKY_FILL_DARK = 0.15 // sky fill left when the blind is closed, so the room isn't pitch black
    const hemi = new THREE.HemisphereLight(0xbcd4ff, 0x5a4636, SKY_FILL)
    scene.add(hemi)
    const SKY_DAY = new THREE.Color(0x9fd8ff)
    const SKY_NIGHT = new THREE.Color(0x1c2550) // closing the blind turns the outside to night
    const sky = SKY_DAY.clone()

    // studio reflections: brighten the colours and give the glossy/metal parts something to reflect
    // (the chair's chrome and the laptop are metal in the .glb, and metal with nothing to reflect renders black)
    const ENV_FILL = 0.25
    const ENV_FILL_DARK = 0.05 // with the blind closed
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment()).texture
    scene.environmentIntensity = ENV_FILL

    let model
    let disposed = false

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(9, 9); // off-screen until the mouse moves, so nothing starts highlighted

    const selectableObjects = [];

    function onMouseMove(event) {
      //get canvas position when it's not full screen
      const rect = renderer.domElement.getBoundingClientRect();
      // Calculate mouse position in normalized device coordinates (-1 to +1) for both components
      mouse.x = ((event.clientX -rect.left)/rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top)/ rect.height) * 2 + 1;    }
    window.addEventListener('mousemove',onMouseMove);

    // hovering an item tints every mesh in it with a soft glow, added on top of its own emissive so lit screens stay lit
    const HOVER_TINT = new THREE.Color(0x666666)
    let hoveredItem = null

    // what the hover label calls each clickable item, keyed by its node name
    const ITEM_NAMES = {
      monitor: 'monitor',
      LaptopScreen: 'laptop',
      LaptopBase: 'laptop keyboard',
      windowblind: 'window blind',
      lampbase: 'desk lamp',
      Chair: 'chair',
      GuitarPivot: 'guitar',
      Books: 'books',
      SnowGear: 'snow gear',
      Printer: '3D printer',
    }

    // amount: 0 = no glow, 1 = full HOVER_TINT
    function paintTint(item, amount) {
      item.traverse((obj) => {
        const material = obj.material
        if (!material?.emissive || material === lampBulb) return // the bulb's emissive is the lamp's on/off glow
        material.userData.emissive ??= material.emissive.clone() // materials can be shared (the printer screws), so save the original once
        material.emissive.copy(HOVER_TINT).multiplyScalar(amount).add(material.userData.emissive)
      })
    }

    // fade the glow in or out; overwrite lets a quick re-hover reverse a fade from wherever it is
    function tintItem(item, on) {
      if (!item) return
      const hover = (item.userData.hover ??= { amount: 0 })
      gsap.to(hover, { amount: on ? 1 : 0, duration: 0.3, ease: 'power1.out', overwrite: true, onUpdate: () => paintTint(item, hover.amount) })
    }

    function updateHover() {
      raycaster.setFromCamera(mouse, camera)
      const hit = focused ? null : raycaster.intersectObjects(selectableObjects, true)[0]
      // highlight the whole clickable item (the chair, the shelf of books...), not just the one mesh under the mouse
      const item = hit ? findNamed(hit.object, Object.keys(ITEM_NAMES)) : null
      if (item === hoveredItem) return
      renderer.domElement.style.cursor = item ? 'pointer' : ''
      promptRef.current.classList.toggle('show', !!item)
      // only rewritten on hover, so the label keeps its text while it fades out
      if (item) promptRef.current.firstChild.textContent = ITEM_NAMES[item.name]
      tintItem(hoveredItem, false)
      tintItem(item, true)
      hoveredItem = item
    }

    let focused = false
    let savedView = null
    const pointerDown = new THREE.Vector2()

    // screens that zoom in and open the window ('LaptopScreen' is the big main monitor in the .glb)
    const zoomableScreens = ['monitor', 'LaptopScreen']

    // a model part may load as a group of meshes, so walk up to the node with one of these names
    function findNamed(obj, names) {
      while (obj && !names.includes(obj.name)) obj = obj.parent
      return obj
    }

    // draw on a screen's glass: draw(ctx, width, height) paints a canvas sized to the glass, which then glows as the screen
    function paintScreen(screen, draw) {
      const glass = screen.children.find((mesh) => mesh.material?.name === 'screen')
      // the .glb's UVs point into a sideways texture atlas, so lay new ones flat across the glass:
      // u runs left to right and v bottom to top, as seen from in front of the screen
      const { position, normal } = glass.geometry.attributes
      const facing = new THREE.Vector3().fromBufferAttribute(normal, 0)
      const right = new THREE.Vector3(0, 1, 0).cross(facing).normalize()
      const up = facing.clone().cross(right)
      const corner = new THREE.Vector3()
      const us = [], vs = []
      for (let i = 0; i < position.count; i++) {
        corner.fromBufferAttribute(position, i)
        us.push(corner.dot(right))
        vs.push(corner.dot(up))
      }
      const [uMin, uMax, vMin, vMax] = [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)]
      glass.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(us.flatMap((u, i) => [(u - uMin) / (uMax - uMin), (vs[i] - vMin) / (vMax - vMin)]), 2))

      const canvas = document.createElement('canvas')
      canvas.width = 1024
      canvas.height = Math.round((1024 * (vMax - vMin)) / (uMax - uMin)) // the glass's own shape, so nothing is stretched
      draw(canvas.getContext('2d'), canvas.width, canvas.height)
      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy() // stays sharp when seen at an angle
      // all glow, no lit colour, like a real screen; the hover tint still adds on top of the white emissive
      glass.material.color.set(0x000000)
      glass.material.emissive.set(0xffffff)
      glass.material.emissiveMap = texture
      glass.material.emissiveIntensity = 1
    }

    const BLIND_CLOSED_BOTTOM = 3.627 // top of the window sill in CV19.glb — lower edge of the closed blind
    let blindClosed = false

    function toggleBlind(blind) {
      blindClosed = !blindClosed
      // the blind is two meshes: the fabric strip and its white pull handle
      const fabric = blind.children.find((mesh) => mesh.material.name !== 'white')
      const handle = blind.children.find((mesh) => mesh.material.name === 'white')
      const { min, max } = new THREE.Box3().setFromBufferAttribute(fabric.geometry.attributes.position)

      // stretch the fabric down to the sill; shifting position.y by top * (1 - scale) keeps its top edge in place
      const scale = blindClosed ? (max.y - BLIND_CLOSED_BOTTOM) / (max.y - min.y) : 1
      const tween = { duration: 1, ease: 'power2.inOut', overwrite: true }
      gsap.to(fabric.scale, { y: scale, ...tween })
      gsap.to(fabric.position, { y: max.y * (1 - scale), ...tween })
      // the handle rides along with the fabric's bottom edge
      gsap.to(handle.position, { y: blindClosed ? BLIND_CLOSED_BOTTOM - min.y : 0, ...tween })

      // a closed blind shuts out the sun and most of the sky light
      gsap.to(sun, { intensity: blindClosed ? 0 : sunIntensity, ...tween })
      gsap.to(hemi, { intensity: blindClosed ? SKY_FILL_DARK : SKY_FILL, ...tween })
      gsap.to(scene, { environmentIntensity: blindClosed ? ENV_FILL_DARK : ENV_FILL, ...tween })
      const { r, g, b } = blindClosed ? SKY_NIGHT : SKY_DAY
      gsap.to(sky, { r, g, b, ...tween })
    }

    // set when the model loads; the *Intensity values are the brightness given in Blender
    let sun, sunIntensity, lampSpot, lampSpotIntensity, lampBulb, lampBulbIntensity
    let lampOn = false

    function toggleLamp() {
      lampOn = !lampOn
      const tween = { duration: 0.15, overwrite: true }
      gsap.to(lampSpot, { intensity: lampOn ? lampSpotIntensity : 0, ...tween })
      gsap.to(lampBulb, { emissiveIntensity: lampOn ? lampBulbIntensity : 0, ...tween })
    }

    // keyboard backlight: the keys sit in a shallow well in the black LaptopBase mesh, so a copy of just the well's floor
    // (made when the model loads) is drawn over it in white, lighting the gaps between the keys but not the keys themselves;
    // it isn't selectable, so hover and clicks still reach the laptop
    const DECK_UP = new THREE.Vector3(0.5408, 0.8412, 0) // the laptop deck's normal in CV20.glb (it sits tilted on its stand)
    // along DECK_UP the well floor is at 0.762-0.764, the key tops at 0.771-0.773 and the rest of the deck at 0.766-0.769
    const isKeyWellFloor = (height) => height > 0.76 && height < 0.7645
    // unlit and not tone mapped so it reads as glowing white (AgX would grey it, like the lamp bulb); polygonOffset wins over the floor underneath
    const ledMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, opacity: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
    let ledsOn = false

    function toggleKeyboardLeds() {
      ledsOn = !ledsOn
      gsap.to(ledMaterial, { opacity: ledsOn ? 1 : 0, duration: 0.4, overwrite: true })
    }

    function onPointerDown(event) {
      pointerDown.set(event.clientX, event.clientY)
    }

    function onClick(event) {
      // ignore the click that ends an orbit drag
      if (focused || Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 5) return
      onMouseMove(event)
      raycaster.setFromCamera(mouse, camera)
      const hit = raycaster.intersectObjects(selectableObjects, true)[0]
      if (!hit) return
      const monitor = findNamed(hit.object, zoomableScreens)
      const blind = findNamed(hit.object, ['windowblind'])
      const chair = findNamed(hit.object, ['Chair'])?.getObjectByName('ChairPivot')
      const guitar = findNamed(hit.object, ['GuitarPivot'])
      const shelf = findNamed(hit.object, ['Books'])
      const snowGear = findNamed(hit.object, ['SnowGear'])
      if (monitor) focusMonitor(monitor, hit)
      else if (blind) toggleBlind(blind)
      else if (chair) spinChair(chair)
      else if (guitar) strumGuitar(guitar)
      else if (shelf) shakeBooks(shelf)
      else if (snowGear) shakeSnowGear(snowGear, hit.point)
      else if (findNamed(hit.object, ['lampbase'])) toggleLamp()
      else if (findNamed(hit.object, ['Printer'])) togglePrinter()
      else if (findNamed(hit.object, ['LaptopBase'])) toggleKeyboardLeds()
    }

    // zoom 4.5-18 units out; orbit only around the room's two open sides (+z to +x), from almost top-down to level with the target
    // (level, not below: the target is 2 units up, so the camera never dips under the ground)
    const ORBIT_LIMITS = { minDistance: 4.5, maxDistance: 18, minAzimuthAngle: 0, maxAzimuthAngle: Math.PI / 2, minPolarAngle: 0.1, maxPolarAngle: Math.PI / 2 }
    // OrbitControls' defaults; controls.update() clamps to the limits even while disabled, so they're lifted for the monitor close-up
    const NO_LIMITS = { minDistance: 0, maxDistance: Infinity, minAzimuthAngle: -Infinity, maxAzimuthAngle: Infinity, minPolarAngle: 0, maxPolarAngle: Math.PI }

    function focusMonitor(monitor, hit) {
      focused = true
      controls.enabled = false
      Object.assign(controls, NO_LIMITS)
      savedView = { position: camera.position.clone(), target: controls.target.clone() }

      // park the camera in front of the clicked face, far enough back to fit the whole monitor
      const box = new THREE.Box3().setFromObject(monitor)
      const center = box.getCenter(new THREE.Vector3())
      const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
      const distance = box.getSize(new THREE.Vector3()).length() / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))
      const position = center.clone().addScaledVector(normal, distance)

      gsap.to(camera.position, { ...xyz(position), duration: 1.2, ease: 'power2.inOut', overwrite: true })
      gsap.to(controls.target, { ...xyz(center), duration: 1.2, ease: 'power2.inOut', overwrite: true, onComplete: () => (monitor.name === 'monitor' ? showProjects() : setWindowOpen(true)) })
    }

    function closeMonitor() {
      if (!focused) return
      setWindowOpen(false)
      setProjectsOpen(false)
      gsap.to(camera.position, { ...xyz(savedView.position), duration: 1, ease: 'power2.inOut', overwrite: true })
      gsap.to(controls.target, { ...xyz(savedView.target), duration: 1, ease: 'power2.inOut', overwrite: true, onComplete: () => {
        Object.assign(controls, ORBIT_LIMITS)
        controls.enabled = true
        focused = false
      } })
    }

    // ChairPivot is an Empty from Blender sitting on the gas lift; the seat, back and arms are parented to it
    let chairAngle = 0

    function spinChair(chair) {
      // tween to an absolute angle (not '+=') so a click mid-spin still ends facing the desk
      chairAngle += Math.PI * 2
      gsap.to(chair.rotation, { y: chairAngle, duration: 1.5, ease: 'power2.out', overwrite: true })
    }
    closeRef.current = closeMonitor

    // knock the guitar sideways and let it wobble back upright on its foot
    function strumGuitar(pivot) {
      gsap.fromTo(pivot.rotation, { z: 0.06 }, { z: 0, duration: 1.2, ease: 'elastic.out(1, 0.3)', overwrite: true })
      playTune()
      showTopTracks()
    }

    // the guitar's window lists my most-played Spotify tracks, fetched on the first click from the function in api/top-tracks.js
    let tracksRequest
    function showTopTracks() {
      setSongsOpen(true)
      if (tracksRequest) return
      setTracks(null)
      tracksRequest = fetch('/api/top-tracks')
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
        .then(setTracks)
        .catch(() => {
          tracksRequest = null // try again on the next click
          setTracks(false)
        })
    }

    // the small monitor's window lists my public GitHub repos (newest work first), fetched on the first click
    let reposRequest
    function showProjects() {
      setProjectsOpen(true)
      if (reposRequest) return
      setRepos(null)
      reposRequest = fetch(`https://api.github.com/users/${GITHUB_USER}/repos?sort=pushed&per_page=100`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
        // skip forks and the profile-README repo (named after the account), which aren't projects
        .then((list) => setRepos(list.filter((repo) => !repo.fork && repo.name !== GITHUB_USER)))
        .catch(() => {
          reposRequest = null // try again on the next click
          setRepos(false)
        })
    }

    // a short riff synthesized in the browser, no sound file: Em, C, G, D picked one string at a time, then a G strum
    // notes are MIDI numbers (60 = middle C)
    const RIFF = [40, 47, 52, 55, 48, 55, 60, 64, 43, 50, 55, 59, 50, 57, 62, 66]
    const STRUM = [43, 47, 50, 55, 59, 67]
    const TUNE_LENGTH = 1.7 // seconds, start to silence
    const RING = 0.35 // seconds the last chord rings before fading out
    const FADE = 0.15 // seconds of fade-out at the end
    const NOTE_GAP = (TUNE_LENGTH - RING - FADE) / RIFF.length // the picked notes fill the rest
    let audio, volume
    let take // gain node for the current playthrough, so a re-click can silence it

    // Karplus-Strong plucked string: a burst of noise repeated once per wavelength, averaged each pass so it mellows and fades like a string
    function pluck(note, when, output) {
      const rate = audio.sampleRate
      const period = Math.round(rate / (440 * 2 ** ((note - 69) / 12))/2)
      const buffer = audio.createBuffer(1, rate * 2, rate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < data.length; i++) {
        data[i] = i < period ? Math.random() * 2 - 1 : 0.498 * (data[i - period] + data[i - period + 1])
      }
      const source = audio.createBufferSource()
      source.buffer = buffer
      source.connect(output)
      source.start(when)
    }

    function playTune() {
      // browsers only allow audio to start from a click, so the context is made on the first one
      if (!audio) {
        audio = new AudioContext()
        volume = audio.createGain()
        volume.gain.value = 0.1
        volume.connect(audio.destination)
      }
      audio.resume()
      const now = audio.currentTime
      // restart: fade the previous playthrough out in ~50ms (an instant cut would click) and start a fresh one
      // (cancel its scheduled fade first, or that would turn it back up)
      take?.gain.cancelScheduledValues(now).setTargetAtTime(0, now, 0.015)
      take = audio.createGain()
      take.connect(volume)
      RIFF.forEach((note, i) => pluck(note, now + i * NOTE_GAP, take))
      const strumAt = now + RIFF.length * NOTE_GAP
      STRUM.forEach((note, i) => pluck(note, strumAt + i * 0.025, take))
      take.gain.setValueAtTime(1, strumAt + RING).linearRampToValueAtTime(0, now + TUNE_LENGTH)
    }

    // rattle the books one after another along the shelf, then open the bookshelf window
    function shakeBooks(shelf) {
      if (shelf.children.some((book) => gsap.isTweening(book.position))) return // let a running shake finish
      gsap.to(shelf.children.map((book) => book.position), {
        y: '+=0.04',
        duration: 0.10,
        ease: 'sine.inOut',
        // each book rattles up and down 3 times (yoyo with an odd repeat count ends where it started), 0.04s after the one before
        // (repeat/yoyo go inside stagger; at the top level they'd replay the whole row as one slow wave)
        stagger: { each: 0.04, repeat: 5, yoyo: true },
        onComplete: () => setBooksOpen(true),
      })
    }

    // the snowboard leaning on the left wall, plus the helmet, goggles and straps on the floor beside it
    const SNOW_GEAR = ['snowboard', 'helmet', 'goggle', 'goglestrap', 'helmetstrap1', 'helmetstrap2']
    const FLOOR_Y = 0.31 // top of the floor tiles, where the snow lands

    // shake the gear along the wall (not into it), throw snow from where it was clicked, then open the sports window
    function shakeSnowGear(gear, point) {
      // gear is a group made at the world origin on load, so its resting z is 0
      gsap.fromTo(gear.position, { z: 0.06 }, { z: 0, duration: 0.8, ease: 'elastic.out(1, 0.2)', overwrite: true, onComplete: () => setSportsOpen(true) })
      throwSnow(point)
    }

    // a burst of snow flakes: each gets a random launch velocity into the room, arcs under gravity, lands on the floor and fades
    function throwSnow(origin) {
      const COUNT = 200
      const LIFE = 1.5 // seconds until the snow has faded
      const GRAVITY = 15 // scene units/s², gentler than real so the snow floats a little
      const flakes = Array.from({ length: COUNT }, () => {
        const v = new THREE.Vector3(Math.random() * 2, 2 + Math.random() * 2.5, -Math.random() * 2) // +x and -z point into the room
        const land = (v.y + Math.sqrt(Math.max(0, v.y ** 2 + 2 * GRAVITY * (origin.y - FLOOR_Y)))) / GRAVITY // when it reaches the floor
        return { v, land }
      })
      const positions = new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3)
      const snow = new THREE.Points(
        new THREE.BufferGeometry().setAttribute('position', positions),
        new THREE.PointsMaterial({ color: 0xffffff, size: 0.05, transparent: true, depthWrite: false }),
      )
      scene.add(snow)

      const clock = { t: 0 }
      gsap.to(clock, {
        t: LIFE,
        duration: LIFE,
        ease: 'none',
        onUpdate: () => {
          flakes.forEach(({ v, land }, i) => {
            const t = Math.min(clock.t, land) // a landed flake stays put
            positions.setXYZ(i, origin.x + v.x * t, origin.y + v.y * t - 0.5 * GRAVITY * t * t, origin.z + v.z * t)
          })
          positions.needsUpdate = true
          snow.material.opacity = 1 - (clock.t / LIFE) ** 2
        },
        onComplete: () => {
          scene.remove(snow)
          snow.geometry.dispose()
          snow.material.dispose()
        },
      })
    }

    // the 3D printer is a Prusa-style FDM: the X gantry (rail, end blocks, hotend) rides the Z rods, driven by two lead screws,
    // so a Z move lowers the whole gantry while the screws turn, and the filament hanging from the extruder to the spool goes slack
    const PRINTER_BED_DROP = 0.585 // nozzle tip (y 2.848) down to just above the bed (y 2.256) in CV20.glb
    const SCREW_LEAD = 0.1 // gantry travel per screw turn; slower than a real 8 mm screw so the spin reads on screen
    const printerZ = { drop: 0 }
    let gantry, screws, slack, slackRestY, slackBottom, slackTop, printerMove
    let printerDown = false

    function setPrinterZ() {
      const { drop } = printerZ
      gantry.position.y = -drop
      screws.forEach((screw) => (screw.rotation.y = (drop / SCREW_LEAD) * Math.PI * 2))
      // squash the hanging filament toward the desk: fully at the extruder end so it stays plugged in, not at all at the spool
      const squash = (slackTop - drop - slackBottom) / (slackTop - slackBottom)
      const position = slack.geometry.attributes.position
      for (let i = 0; i < position.count; i++) {
        const t = i / (position.count - 1) // 0 at the extruder, 1 at the spool (the vertex order in CV20.glb)
        position.setY(i, slackBottom + (slackRestY[i] - slackBottom) * THREE.MathUtils.lerp(squash, 1, t))
      }
      position.needsUpdate = true
    }

    function togglePrinter() {
      printerDown = !printerDown
      printerMove?.kill()
      // once the head stops, open the Hobbies window with the photos of my prints
      printerMove = gsap.timeline({ onUpdate: setPrinterZ, onComplete: () => setPrintsOpen(true) })
      if (printerDown) {
        // home Z like firmware does (G28): fast move down until the endstop trips, back off, then touch it again slowly
        printerMove
          .to(printerZ, { drop: PRINTER_BED_DROP, duration: 1.4, ease: 'sine.in' })
          .to(printerZ, { drop: PRINTER_BED_DROP - 0.05, duration: 0.25, ease: 'power1.out' })
          .to(printerZ, { drop: PRINTER_BED_DROP, duration: 0.6, ease: 'none' })
      } else {
        printerMove.to(printerZ, { drop: 0, duration: 1.4, ease: 'power1.inOut' })
      }
    }

    function onKeyDown(event) {
      if (event.key !== 'Escape') return
      closeMonitor()
      setSongsOpen(false)
      setBooksOpen(false)
      setSportsOpen(false)
      setPrintsOpen(false)
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('click', onClick)
    window.addEventListener('keydown', onKeyDown)

    const loader = new GLTFLoader()
    loader.load(
      '/CV20.glb',
      (gltf) => {
        if (disposed) return
        model = gltf.scene
        model.getObjectByName('world')?.removeFromParent() // Blender's grey backdrop box; the sky and grass below replace it

        const box = new THREE.Box3().setFromObject(model)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())

        // const maxDimension = Math.max(size.x, size.y, size.z)
        // const scale = 2 / maxDimension // normalize the largest dimension to 2 units

        // model.scale.setScalar(scale)
        // model.position.sub(center.multiplyScalar(scale)) // recenter on the origin (position isn't affected by the object's own scale, so the offset must be pre-scaled)
        //model[0].name = 'LaptopScreen',model[1].name = 'back'
        // for (let i = 0; i < model.children.length; i++) {
        //   model.children[i].name = `child_${i}`
        // }
        scene.add(model)

        // cartoony outdoors: flat sky colour, a flat green ground with pines, bushes and rocks on it, and fog that melts it all into the sky
        scene.background = sky
        scene.fog = new THREE.Fog(sky, 25, 90)
        scene.fog.color = sky // same Color object, so the blind's day/night tween recolours both
        const grass = new THREE.Mesh(new THREE.CircleGeometry(200, 64), new THREE.MeshLambertMaterial({ color: 0x3f7f2e }))
        grass.rotation.x = -Math.PI / 2
        grass.position.y = box.min.y - 0.01 // just under the room so the floors don't flicker
        grass.receiveShadow = true
        scene.add(grass)

        const { randFloat, randFloatSpread } = THREE.MathUtils
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3()
        const tilt = new THREE.Euler(), col = new THREE.Color()

        // a random spot on the ground minR-maxR from the room's centre (spread evenly by area), with a keepOut-wide square around the room left clear
        function groundSpot(minR, maxR, keepOut, out) {
          do {
            const r = Math.sqrt(randFloat(minR ** 2, maxR ** 2)), a = Math.random() * Math.PI * 2
            out.set(Math.cos(a) * r, grass.position.y, Math.sin(a) * r)
          } while (Math.abs(out.x) < keepOut && Math.abs(out.z) < keepOut)
          return out
        }

        // a low-poly lump for the bushes and rocks: an icosahedron with its corners pushed in and out at random
        // (shared corners are merged first, as normals and uvs would keep them apart, so the faces stay joined)
        function lumpyBall(detail, min, max) {
          const geometry = mergeVertices(new THREE.IcosahedronGeometry(1, detail).deleteAttribute('normal').deleteAttribute('uv'))
          const corners = geometry.attributes.position
          for (let i = 0; i < corners.count; i++) {
            const lump = randFloat(min, max)
            corners.setXYZ(i, corners.getX(i) * lump, corners.getY(i) * lump, corners.getZ(i) * lump)
          }
          geometry.computeVertexNormals()
          return geometry
        }

        // low-poly pines: three stacked four-sided pyramids, one unit tall, as one instanced mesh
        const TREES = 700
        const treeGeo = mergeGeometries([
          [0.31, 0.65, 0], // [radius, height, base y] of each tier, bottom to top
          [0.24, 0.5, 0.31],
          [0.19, 0.42, 0.58],
        ].map(([radius, height, y]) => new THREE.ConeGeometry(radius, height, 4).translate(0, y + height / 2, 0)))
        const trees = new THREE.InstancedMesh(treeGeo, new THREE.MeshLambertMaterial({ color: 0x1f5a2c, flatShading: true }), TREES)
        for (let i = 0; i < TREES; i++) {
          // from just behind the orbiting camera (so none block the room) out to where the fog swallows them
          groundSpot(11, 80, 0, pos)
          q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.random() * Math.PI)
          trees.setMatrixAt(i, m.compose(pos, q, scl.setScalar(randFloat(3, 7))))
        }
        scene.add(trees)

        // low-poly bushes, scattered in clumps of three
        const BUSHES = 600
        const bushes = new THREE.InstancedMesh(lumpyBall(1, 0.8, 1.15), new THREE.MeshLambertMaterial({ flatShading: true }), BUSHES)
        const clump = new THREE.Vector3()
        for (let i = 0; i < BUSHES; i++) {
          if (i % 3 === 0) groundSpot(5, 60, 5.5, clump)
          const size = randFloat(0.35, 0.8)
          pos.set(clump.x + randFloatSpread(2), grass.position.y + size * 0.4, clump.z + randFloatSpread(2)) // bottom sunk into the ground
          q.setFromEuler(tilt.set(randFloatSpread(0.4), Math.random() * Math.PI * 2, randFloatSpread(0.4)))
          bushes.setMatrixAt(i, m.compose(pos, q, scl.set(size, size * 0.8, size))) // * 0.8: a little squat
          bushes.setColorAt(i, col.setHSL(randFloat(0.3, 0.35), 0.6, randFloat(0.32, 0.4), THREE.SRGBColorSpace))
        }
        scene.add(bushes)

        // low-poly rocks: chunkier lumps with fewer faces, in pairs of a rock and a smaller one beside it;
        // mostly pebbles, with the odd boulder kept well away from the room
        const ROCKS = 500
        const rocks = new THREE.InstancedMesh(lumpyBall(0, 0.7, 1.25), new THREE.MeshLambertMaterial({ flatShading: true }), ROCKS)
        const rockSpot = new THREE.Vector3()
        let rockSize
        for (let i = 0; i < ROCKS; i++) {
          const first = i % 2 === 0
          if (first) {
            groundSpot(4.5, 50, 4.6, rockSpot)
            rockSize = Math.hypot(rockSpot.x, rockSpot.z) > 8 && Math.random() < 0.2 ? randFloat(0.5, 1.1) : randFloat(0.12, 0.4)
          }
          const size = first ? rockSize : rockSize * randFloat(0.4, 0.7)
          const gap = first ? 0 : rockSize * 1.1, a = Math.random() * Math.PI * 2
          pos.set(rockSpot.x + Math.cos(a) * gap, grass.position.y + size * 0.3, rockSpot.z + Math.sin(a) * gap) // half sunk, so it sits rather than balances
          q.setFromEuler(tilt.set(randFloatSpread(1), Math.random() * Math.PI * 2, randFloatSpread(1)))
          rocks.setMatrixAt(i, m.compose(pos, q, scl.set(size * randFloat(0.9, 1.3), size * randFloat(0.6, 0.9), size * randFloat(0.9, 1.3))))
          rocks.setColorAt(i, col.setHSL(randFloat(0.1, 0.14), 0.08, randFloat(0.45, 0.6), THREE.SRGBColorSpace)) // warm greys
        }
        scene.add(rocks)

        model.traverse((obj) => {
          if (obj.isMesh) {
            obj.material = obj.material.clone()
            // the posters are unlit in the .glb, so they glowed in the dark with the blind closed: make them lit matte paper
            if (obj.material.isMeshBasicMaterial) obj.material = new THREE.MeshStandardMaterial({ map: obj.material.map, roughness: 1 })
            obj.castShadow = true
            obj.receiveShadow = true
          }
          // glTF doesn't store shadow settings, so turn them on for the sun and the desk lamp
          if (obj.isDirectionalLight || obj.isSpotLight) {
            obj.castShadow = true
            obj.shadow.mapSize.set(2048, 2048)
            obj.shadow.bias = -0.0005
            obj.shadow.normalBias = 0.02
            obj.shadow.radius = 4 // soft edges, like Cycles' area-light shadows
          }
          if (obj.isDirectionalLight) {
            // fit the sun's shadow box around the room
            Object.assign(obj.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 })
            obj.shadow.camera.updateProjectionMatrix()
          }
          if (obj.name === 'Sun') {
            sun = obj
            sunIntensity = obj.intensity
          }
          // the desk lamp starts switched off — click it to turn it on
          if (obj.name === 'LampSpot') {
            lampSpot = obj
            lampSpotIntensity = obj.intensity
            obj.intensity = 0
          }
          if (obj.material?.name === 'bulb') {
            lampBulb = obj.material
            // the bulb glows yellow when the lamp is on; it skips tone mapping, or AgX washes the glow out to pale cream
            lampBulb.emissive.set(0xffcc00)
            lampBulb.toneMapped = false
            lampBulbIntensity = 1 // the .glb's 2.5 clips to lemon-white once it isn't tone mapped
            lampBulb.emissiveIntensity = 0
          }
          if (obj.name === "monitor" || obj.name === "LaptopScreen" || obj.name === "LaptopBase" || obj.name === "windowblind" || obj.name === "lampbase") {
            selectableObjects.push(obj)
          }
          // console.log(
          // obj.name,
          // "isMesh:", obj.isMesh,
          // "type:", obj.type,
          // "parent:", obj.parent?.name
          // )
        })

        // the purple bias light behind the monitor tinted the wall with a blue haze, so drop it
        model.getObjectByName('MonitorBias')?.removeFromParent()

        // what's on the screens (drawn in screens.js); the names in the .glb are swapped:
        // 'LaptopScreen' is the upright screen above the keyboard, 'monitor' the small angled one beside it
        paintScreen(model.getObjectByName('LaptopScreen'), drawDesktop)
        paintScreen(model.getObjectByName('monitor'), (ctx, w, h) => drawGitHubProfile(ctx, w, h, GITHUB_USER, INFO.education))

        // the guitar and its strings have their origins at the world origin, so give them a shared pivot at the guitar's foot
        // (glTF names lose their dots, so the strings load as guitarString, guitarString001, ...)
        const guitarParts = model.children.filter((obj) => obj.name.startsWith('guitar'))
        const guitarBox = new THREE.Box3()
        guitarParts.forEach((obj) => guitarBox.expandByObject(obj))
        const guitarPivot = new THREE.Group()
        guitarPivot.name = 'GuitarPivot'
        guitarBox.getCenter(guitarPivot.position).setY(guitarBox.min.y)
        model.add(guitarPivot)
        guitarParts.forEach((obj) => guitarPivot.attach(obj))
        selectableObjects.push(guitarPivot)

        // the books (book, book001, ... once loaded) group under one 'Books' node, so a click on any of them finds the whole shelf
        const shelf = new THREE.Group()
        shelf.name = 'Books'
        model.add(shelf)
        model.children.filter((obj) => obj.name.startsWith('book')).forEach((book) => shelf.attach(book))
        selectableObjects.push(shelf)

        // same for the snow gear: a 'SnowGear' group, so a click on the board or the helmet shakes them all together
        const snowGear = new THREE.Group()
        snowGear.name = 'SnowGear'
        model.add(snowGear)
        model.children.filter((obj) => SNOW_GEAR.includes(obj.name)).forEach((part) => snowGear.attach(part))
        selectableObjects.push(snowGear)

        // the chair: the spinning ChairPivot plus the base that stays put (gas lift, legs, wheels), grouped as 'Chair' so they hover and click as one
        const chair = new THREE.Group()
        chair.name = 'Chair'
        model.add(chair)
        model.children.filter((obj) => /^(ChairPivot|chair_holder|leg\d?|wheel\d)$/.test(obj.name)).forEach((part) => chair.attach(part))
        selectableObjects.push(chair)

        // the printer: a 'Printer' group to click, with a 'gantry' group inside it for the parts that ride the Z axis
        // (the two gantry meshes load with odd 'servomotors...' names)
        const printer = new THREE.Group()
        printer.name = 'Printer'
        model.add(printer)
        gantry = new THREE.Group()
        printer.add(gantry)
        model.children.filter((obj) => obj.name.startsWith('servomotors') || ['printernozzle', 'fill_line'].includes(obj.name)).forEach((part) => gantry.attach(part))
        model.children.filter((obj) => ['3dprinter', 'Cylinder001', 'spool', 'filament', 'fill_line2'].includes(obj.name)).forEach((part) => printer.attach(part))
        selectableObjects.push(printer)

        // the printer frame and the chair are both near-black in the .glb and merged into one shape, so colour them apart:
        // a matte grey printer frame, and a black chair with a silver spine
        printer.traverse((obj) => {
          if (obj.material?.name !== 'Material.001') return
          obj.material.color.set(0x8c8c8c)
          obj.material.roughness = 1
        })
        model.getObjectByName('ChairPivot').traverse((obj) => {
          if (!obj.isMesh || obj.name === 'backrest') return
          obj.material.color.set(0x1a1a1a)
          obj.material.roughness = 0.3 // a bit of shine
        })

        // both lead screws are one mesh ('Worm Gear.001'), so split its triangles left/right into one mesh per screw, each centred on its own axis
        const screwPair = model.getObjectByName('Worm_Gear001')
        const { index, attributes } = screwPair.geometry
        const sides = [[], []]
        for (let i = 0; i < index.count; i++) sides[attributes.position.getX(index.getX(i - (i % 3))) < 0.7 ? 0 : 1].push(index.getX(i))
        screws = sides.map((triangles) => {
          const axis = new THREE.Box3().setFromPoints(triangles.map((v) => new THREE.Vector3().fromBufferAttribute(attributes.position, v))).getCenter(new THREE.Vector3()).setY(0)
          const screw = new THREE.Mesh(screwPair.geometry.clone().setIndex(triangles).translate(-axis.x, 0, -axis.z), screwPair.material)
          screw.position.copy(axis)
          screw.castShadow = screw.receiveShadow = true
          printer.add(screw)
          return screw
        })
        screwPair.removeFromParent()

        slack = printer.getObjectByName('fill_line2')
        const slackPosition = slack.geometry.attributes.position
        slackRestY = Array.from({ length: slackPosition.count }, (_, i) => slackPosition.getY(i))
        slackBottom = Math.min(...slackRestY)
        slackTop = Math.max(...slackRestY)

        // the keyboard backlight: copy the well-floor triangles out of the laptop's body ([0] is the black body, [1] the trackpad)
        const deck = model.getObjectByName('LaptopBase').children[0]
        const deckPosition = deck.geometry.attributes.position
        const onWellFloor = (v) => isKeyWellFloor(new THREE.Vector3().fromBufferAttribute(deckPosition, v).dot(DECK_UP))
        const wellFloor = []
        for (let i = 0; i < deck.geometry.index.count; i += 3) {
          const triangle = [0, 1, 2].map((k) => deck.geometry.index.getX(i + k))
          if (triangle.every(onWellFloor)) wellFloor.push(...triangle)
        }
        model.add(new THREE.Mesh(deck.geometry.clone().setIndex(wellFloor), ledMaterial))
      },
      undefined,
      (error) => console.error('Failed to load model:', error)
    )

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.target.set(0.8, 2, -0.7)
    Object.assign(controls, ORBIT_LIMITS)

    // ambient occlusion: the soft contact shadows in corners and under things that make Cycles renders look grounded
    // (Cycles is an offline path tracer and can't run in the browser, so this is the real-time stand-in)
    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    composer.addPass(new GTAOPass(scene, camera, window.innerWidth, window.innerHeight))
    composer.addPass(new OutputPass())

    let frameId

    function animate() {
      frameId = requestAnimationFrame(animate)
      controls.update() // only required if controls.enableDamping = true, or if controls.autoRotate = true
      updateHover();
      composer.render()
      // per-frame updates + render
    }

    animate()

    function handleResize() {
      // update camera aspect + renderer size
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
      composer.setSize(window.innerWidth, window.innerHeight)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      disposed = true
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('keydown', onKeyDown)
      gsap.killTweensOf([camera.position, controls.target])
      controls.dispose()

      if (model) scene.remove(model)
      container.removeChild(renderer.domElement)
      composer.dispose()
      scene.environment.dispose()
      pmrem.dispose()
      renderer.dispose()
      audio?.close()
    }
  }, [])

  return (
    <>
      <div ref={containerRef} style={{ width: '100vw', height: '100vh' }}>
      </div>
      <div ref={promptRef} className="interact-prompt"><strong /><span>Click to interact</span></div>
      {windowOpen && (
        <OsWindow title="about-me" label="About me" onClose={() => closeRef.current()}>
          <h1>{INFO.name}</h1>
          <p className="subtitle">{INFO.title}</p>
          <p>{INFO.bio}</p>
          <ul className="links">
            {INFO.links.map((link) => (
              <li key={link.label}>
                <a href={link.href} target="_blank" rel="noreferrer">{link.label}</a>
              </li>
            ))}
          </ul>
        </OsWindow>
      )}
      {projectsOpen && (
        <OsWindow title="projects" label="My GitHub projects" onClose={() => closeRef.current()}>
          <h1>Projects</h1>
          <p className="subtitle">My public repos on GitHub, most recently worked on first</p>
          {repos === null && <p>Loading…</p>}
          {repos === false && <p>Couldn't reach GitHub right now. Try again in a bit.</p>}
          {repos?.length === 0 && <p>Nothing public yet.</p>}
          {repos?.length > 0 && (
            <ul className="tracks">
              {repos.map((repo) => (
                <li key={repo.id}>
                  <a href={repo.html_url} target="_blank" rel="noreferrer">
                    <span className="track-text">
                      <strong>{repo.name}</strong>
                      <span className="artist">{[repo.language, repo.description].filter(Boolean).join(' · ') || 'No description'}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </OsWindow>
      )}
      {songsOpen && (
        <OsWindow title="on-repeat" label="My most-played Spotify tracks" onClose={() => setSongsOpen(false)}>
          <h1>On repeat</h1>
          <p className="subtitle">My most-played tracks on Spotify, last 6 months</p>
          {tracks === null && <p>Loading…</p>}
          {tracks === false && <p>Couldn't reach Spotify right now. Try again in a bit.</p>}
          {tracks && (
            <ol className="tracks">
              {tracks.map((track) => (
                <li key={track.id}>
                  <a href={track.url} target="_blank" rel="noreferrer">
                    <img src={track.image} alt="" width="40" height="40" />
                    <span className="track-text">
                      <strong>{track.name}</strong>
                      <span className="artist">{track.artists}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          )}
        </OsWindow>
      )}
      {booksOpen && (
        <OsWindow title="bookshelf" label="Bookshelf" onClose={() => setBooksOpen(false)}>
          <h1>Bookshelf</h1>
          <p className="subtitle">Books I'd recommend</p>
          <ul className="plain-list">
            {BOOKS.map((book) => (
              <li key={book.title}>
                <strong>{book.title}</strong> <span className="artist">{book.author}</span>
              </li>
            ))}
          </ul>
        </OsWindow>
      )}
      {sportsOpen && (
        <OsWindow title="sports" label="Sports I like" onClose={() => setSportsOpen(false)}>
          <h1>Sports</h1>
          <p className="subtitle">What I do away from the desk</p>
          <ul className="plain-list">
            {SPORTS.map((sport) => (
              <li key={sport.name}>
                <strong>{sport.name}</strong> <span className="artist">{sport.note}</span>
              </li>
            ))}
          </ul>
        </OsWindow>
      )}
      {printsOpen && (
        <OsWindow title="Hobbies" label="Hobbies: my 3D prints" onClose={() => setPrintsOpen(false)}>
          <h1>Hobbies</h1>
          <p className="subtitle">Things I've 3D printed</p>
          {PRINTS.length ? (
            <ul className="prints">
              {PRINTS.map((print) => (
                <li key={print.src}>
                  <img src={print.src} alt={print.caption} />
                  <span className="artist">{print.caption}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>Photos coming soon.</p>
          )}
        </OsWindow>
      )}
    </>
  )
}
