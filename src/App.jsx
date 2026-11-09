import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import './App.css'

// shown in the window that opens when the monitor is clicked — fill these in
const INFO = {
  name: 'Andreas Frantzias',
  title: 'Your Title',
  bio: 'One or two lines about yourself.',
  links: [
    { label: 'GitHub', href: 'https://github.com/AndreasFrantzias' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/andreas-frantzias-bb81b2303/' },
    { label: 'Instagram', href: 'https://www.instagram.com/frantziasandreas/' },
  ],
}

const xyz = (v) => ({ x: v.x, y: v.y, z: v.z })

export default function App() {
  const containerRef = useRef(null)
  const closeRef = useRef(null)
  const [windowOpen, setWindowOpen] = useState(false)
  const [songsOpen, setSongsOpen] = useState(false)
  const [tracks, setTracks] = useState(null) // null = loading, false = couldn't load, else the track list

  useEffect(() => {
    const container = containerRef.current

    // scene / camera / renderer / controls / lights / loader setup
    const scene = new THREE.Scene()

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.set(3, 6, 6)
    //camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer()
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.toneMapping = THREE.AgXToneMapping // same view transform as Blender
    renderer.shadowMap.enabled = true
    container.appendChild(renderer.domElement)

    // soft sky fill; the sun, desk lamp and screen glows come from the .glb (lights made in Blender)
    const SKY_FILL = 1
    const SKY_FILL_DARK = 0.15 // sky fill left when the blind is closed, so the room isn't pitch black
    const hemi = new THREE.HemisphereLight(0xbcd4ff, 0x5a4636, SKY_FILL)
    scene.add(hemi)

    let model
    let disposed = false

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hoveredObject = null;

    const selectableObjects = [];

    function onMouseMove(event) {
      //get canvas position when it's not full screen
      const rect = renderer.domElement.getBoundingClientRect();
      // Calculate mouse position in normalized device coordinates (-1 to +1) for both components
      mouse.x = ((event.clientX -rect.left)/rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top)/ rect.height) * 2 + 1;
    }
    window.addEventListener('mousemove',onMouseMove);

    function updateHover(){
      //point raycaster from camera through mouse's position
      raycaster.setFromCamera(mouse,camera);
      //check which object in selectableObjects the ray passed through(true also check the children)
      const intersects = raycaster.intersectObjects(selectableObjects, true);
      console.log('selectable hits:', intersects.map(i => i.object.name || i.object.parent?.name))
      const newHover = !focused && intersects.length > 0 ? intersects[0].object : null;
      //checks if the new hovered object is different from the previous one
      if(newHover !== hoveredObject){
        renderer.domElement.style.cursor = findNamed(newHover, [...zoomableScreens, 'windowblind', 'lampbase', 'ChairPivot', 'GuitarPivot']) ? 'pointer' : ''
        if(hoveredObject){
          //reset previous hovered object
          hoveredObject.material.emissive.setHex(hoveredObject.currentHex);
        }
        if(newHover){
          //store current color and set new color
          newHover.currentHex = newHover.material.emissive.getHex();
          newHover.material.emissive.setHex(0xffee00);
          // newHover.setScale(100, 100, 100); // Scale up the hovered object
        }
        //update to the new hovered object
        hoveredObject = newHover;
      }
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
      const chair = findNamed(hit.object, ['ChairPivot'])
      const guitar = findNamed(hit.object, ['GuitarPivot'])
      if (monitor) focusMonitor(monitor, hit)
      else if (blind) toggleBlind(blind)
      else if (chair) spinChair(chair)
      else if (guitar) strumGuitar(guitar)
      else if (findNamed(hit.object, ['lampbase'])) toggleLamp()
    }

    function focusMonitor(monitor, hit) {
      focused = true
      controls.enabled = false
      savedView = { position: camera.position.clone(), target: controls.target.clone() }

      // park the camera in front of the clicked face, far enough back to fit the whole monitor
      const box = new THREE.Box3().setFromObject(monitor)
      const center = box.getCenter(new THREE.Vector3())
      const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
      const distance = box.getSize(new THREE.Vector3()).length() / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))
      const position = center.clone().addScaledVector(normal, distance)

      gsap.to(camera.position, { ...xyz(position), duration: 1.2, ease: 'power2.inOut', overwrite: true })
      gsap.to(controls.target, { ...xyz(center), duration: 1.2, ease: 'power2.inOut', overwrite: true, onComplete: () => setWindowOpen(true) })
    }

    function closeMonitor() {
      if (!focused) return
      setWindowOpen(false)
      gsap.to(camera.position, { ...xyz(savedView.position), duration: 1, ease: 'power2.inOut', overwrite: true })
      gsap.to(controls.target, { ...xyz(savedView.target), duration: 1, ease: 'power2.inOut', overwrite: true, onComplete: () => {
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
    function onKeyDown(event) {
      if (event.key !== 'Escape') return
      closeMonitor()
      setSongsOpen(false)
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
        model.traverse((obj) => {
          if (obj.isMesh) {
            obj.material = obj.material.clone()
            obj.castShadow = true
            obj.receiveShadow = true
          }
          // glTF doesn't store shadow settings, so turn them on for the sun and the desk lamp
          if (obj.isDirectionalLight || obj.isSpotLight) {
            obj.castShadow = true
            obj.shadow.mapSize.set(2048, 2048)
            obj.shadow.bias = -0.0005
            obj.shadow.normalBias = 0.02
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
            lampBulbIntensity = lampBulb.emissiveIntensity
            lampBulb.emissiveIntensity = 0
          }
          if (obj.name === "monitor" || obj.name === "LaptopScreen" || obj.name === "LaptopBase" || obj.name === "windowblind" || obj.name === "lampbase" || obj.name === "ChairPivot") {
            selectableObjects.push(obj)
          }
          // console.log(
          // obj.name,
          // "isMesh:", obj.isMesh,
          // "type:", obj.type,
          // "parent:", obj.parent?.name
          // )
        })

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
      },
      undefined,
      (error) => console.error('Failed to load model:', error)
    )

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05

    let frameId

    function animate() {
      frameId = requestAnimationFrame(animate)
      controls.update() // only required if controls.enableDamping = true, or if controls.autoRotate = true
      updateHover();
      renderer.render(scene, camera)
      // per-frame updates + render
    }

    animate()

    function handleResize() {
      // update camera aspect + renderer size
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
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
      renderer.dispose()
      audio?.close()
    }
  }, [])

  return (
    <>
      <div ref={containerRef} style={{ width: '100vw', height: '100vh' }}>
      </div>
      {windowOpen && (
        <div className="backdrop" onClick={() => closeRef.current()}>
          <div className="os-window" role="dialog" aria-label="About me" onClick={(e) => e.stopPropagation()}>
            <div className="titlebar">
              <button className="dot close" aria-label="Close" autoFocus onClick={() => closeRef.current()} />
              <span className="dot min" />
              <span className="dot max" />
              <span className="title">about-me</span>
            </div>
            <div className="content">
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
            </div>
          </div>
        </div>
      )}
      {songsOpen && (
        <div className="backdrop" onClick={() => setSongsOpen(false)}>
          <div className="os-window" role="dialog" aria-label="My most-played Spotify tracks" onClick={(e) => e.stopPropagation()}>
            <div className="titlebar">
              <button className="dot close" aria-label="Close" autoFocus onClick={() => setSongsOpen(false)} />
              <span className="dot min" />
              <span className="dot max" />
              <span className="title">on-repeat</span>
            </div>
            <div className="content">
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
            </div>
          </div>
        </div>
      )}
    </>
  )
}
