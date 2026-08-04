import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, OrbitControls, Environment, Float, Stars, ContactShadows } from '@react-three/drei'

// ── Your CV model ──────────────────────────────────────────
function CVModel() {
  const { scene } = useGLTF('/CV12.glb')
  const ref = useRef()

  /*  useFrame((_, delta) => {
    ref.current.rotation.y += delta * 0.25
  }) */

  return (
    <primitive
      ref={ref}
      object={scene}
      scale={0.5}        // ← adjust if too big/small
      position={[0, 0, 0]}
    />
  )
}

// ── Orbital ring ───────────────────────────────────────────
/*  function Ring({ radius, color, speed, tilt }) {
  const ref = useRef()
  useFrame((_, delta) => {
    ref.current.rotation.z += delta * speed
    ref.current.rotation.x += delta * speed * 0.4
  })
  return (
    <mesh ref={ref} rotation={[tilt, 0, 0]}>
      <torusGeometry args={[radius, 0.018, 16, 120]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.6}
        toneMapped={false}
      />
    </mesh>
  )
} */

// ── Floating glowing dots ──────────────────────────────────
function Particles() {
  const positions = Array.from({ length: 100 }, () => [
    (Math.random() - 0.5) * 12,
    (Math.random() - 0.5) * 12,
    (Math.random() - 0.5) * 12,
  ])
  return positions.map((pos, i) => (
    <mesh key={i} position={pos}>
      <sphereGeometry args={[0.025, 8, 8]} />
      <meshStandardMaterial
        color="#88ccff"
        emissive="#88ccff"
        emissiveIntensity={1.5}
        toneMapped={false}
      />
    </mesh>
  ))
}

// ── Loading screen ─────────────────────────────────────────
function Loader() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontFamily: 'sans-serif', fontSize: '1rem',
      letterSpacing: '0.15em', opacity: 0.6
    }}>
      Loading...
    </div>
  )
}

// ── Main App ───────────────────────────────────────────────
export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#050510' }}>

      {/* ── Canvas ── */}
      <Canvas
        camera={{ position: [0, 1.5, 5], near: 0.1, far: 1000, fov: 55 }}
        gl={{ logarithmicDepthBuffer: true }}
      >
        <Suspense fallback={null}>

          {/* Lighting */}
          <ambientLight intensity={0.4} />
          <pointLight position={[6,  6,  6]} intensity={1.2} color="#ffffff" />
          <pointLight position={[-6, -4, -6]} intensity={0.6} color="#4466ff" />
          <spotLight
            position={[0, 8, 2]}
            angle={0.35}
            penumbra={0.8}
            intensity={1.5}
            color="#ff99dd"
            castShadow
          />

          {/* CV Model */}
          <Float speed={1.8} rotationIntensity={0.4} floatIntensity={0.6}>
            <CVModel />
          </Float>

          {/* Particles */}
          <Particles />

          {/* Ground shadow */}
          <ContactShadows
            position={[0, -2, 0]}
            opacity={0.4}
            scale={8}
            blur={2}
            color="#4466ff"
          />

          {/* Stars */}
          <Stars radius={80} depth={60} count={4000} factor={3.5} fade />

          {/* Environment */}
          <Environment preset="city" />

          {/* Controls */}
          <OrbitControls
            enablePan={false}
            enableZoom={true}
            minDistance={3}
            maxDistance={9}
            maxPolarAngle={Math.PI / 1.6}
          />

        </Suspense>
      </Canvas>

      {/* ── UI overlay ── */}
      <div style={{
        position: 'absolute', top: 24, width: '100%',
        textAlign: 'center', pointerEvents: 'none',
        fontFamily: "'Segoe UI', sans-serif", color: 'white'
      }}>
        <h1 style={{
          margin: 0, fontSize: 'clamp(1rem, 3vw, 1.8rem)',
          letterSpacing: '0.3em', fontWeight: 300, opacity: 0.85
        }}>
          MY CV
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: '0.75rem', opacity: 0.4, letterSpacing: '0.15em' }}>
          DRAG TO ROTATE  ·  SCROLL TO ZOOM
        </p>
      </div>

    </div>
  )
}

useGLTF.preload('/CV1.glb')