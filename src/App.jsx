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
    camera.position.set(3, 6, 6)
    //camera.lookAt(0, 0, 0)

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
      const newHover = intersects.length > 0 ? intersects[0].object : null;
      //checks if the new hovered object is different from the previous one
      if(newHover !== hoveredObject){
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

    const loader = new GLTFLoader()
    loader.load(
      '/CV18.glb',
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
          }
          if (obj.name === "LaptopScreen" || obj.name === "LaptopBase" || obj.name === "windowblind" || obj.name === "lampbase" || obj.name === "back") {
            selectableObjects.push(obj)
          }
          // console.log(
          // obj.name,
          // "isMesh:", obj.isMesh,
          // "type:", obj.type,
          // "parent:", obj.parent?.name
          // )
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
