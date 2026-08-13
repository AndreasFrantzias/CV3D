import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export default function App() {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current

    // scene / camera / renderer / controls / lights / loader setup
    const scene = new THREE.Scene()

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.set(0, 1.5, 5)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer()
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(window.innerWidth, window.innerHeight)
    container.appendChild(renderer.domElement)

    const ambient = new THREE.AmbientLight(0xffffff, 1)
    scene.add(ambient)

    const directional = new THREE.DirectionalLight(0xffffff, 2)
    directional.position.set(5, 5, 5)
    scene.add(directional)

    let model
    let disposed = false

    const loader = new GLTFLoader()
    loader.load(
      '/CV15.glb',
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

        scene.add(model)
        const hideNames = ['Cylinder','Sphere.006','Sphere.007','Sphere.008','Sphere.009','Sphere.010','Plane']

        model.traverse((obj) => {
          if (!obj.isMesh) return
          const name = (obj.name || '').toLowerCase()
          if (hideNames.some((hide) => name.includes(hide))) {
          obj.visible = false
          }
        })
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

      if (model) scene.remove(model)
      container.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [])

  return (
    <div ref={containerRef} style={{ width: '100vw', height: '100vh' }}>
    </div>
  )
}
