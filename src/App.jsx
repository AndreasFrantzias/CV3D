import { Canvas } from '@react-three/fiber'

function Box() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="royalblue" />
    </mesh>
  )
}

export default function App() {
  return (
    <Canvas style={{ height: '100vh' }}>
      <ambientLight />
      <pointLight position={[10, 10, 10]} />
      <Box />
    </Canvas>
  )
}