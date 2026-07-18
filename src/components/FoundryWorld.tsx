import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Sparkles, Stars } from '@react-three/drei'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { DemoMode, Phase } from '../types'

type Props = {
  phase: Phase
  mode: DemoMode
  progress: number
  runId: number
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))
const seed = (index: number, offset = 0) => {
  const value = Math.sin(index * 9187.13 + offset * 83.71) * 43758.5453
  return value - Math.floor(value)
}

function CameraRig({ phase }: { phase: Phase }) {
  const { camera, pointer } = useThree()
  const destination = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ clock }, delta) => {
    const time = clock.getElapsedTime()
    destination.set(
      Math.sin(time * 0.11) * 0.32 + pointer.x * 0.18,
      3.75 + Math.sin(time * 0.17) * 0.08 + pointer.y * 0.08,
      phase === 'working' ? 8.9 : 9.2,
    )
    camera.position.lerp(destination, 1 - Math.exp(-delta * 1.8))
    camera.lookAt(0, 1.05, 0)
  })
  return null
}

function FoundryBase() {
  return (
    <group>
      <mesh position={[0, -0.42, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[4.5, 4.25, 0.82, 64]} />
        <meshStandardMaterial color="#1d2025" metalness={0.62} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0.015, 0]} receiveShadow>
        <cylinderGeometry args={[4.48, 4.48, 0.08, 64]} />
        <meshStandardMaterial color="#30343a" metalness={0.48} roughness={0.34} />
      </mesh>
      <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.92, 4.08, 96]} />
        <meshStandardMaterial color="#657080" emissive="#354c68" emissiveIntensity={0.42} metalness={0.72} roughness={0.24} />
      </mesh>
      {Array.from({ length: 24 }, (_, index) => {
        const angle = index / 24 * Math.PI * 2
        return (
          <mesh key={index} position={[Math.cos(angle) * 4.12, -0.12, Math.sin(angle) * 4.12]} rotation={[Math.PI / 2, 0, angle]}>
            <boxGeometry args={[0.035, 0.05, 0.18]} />
            <meshBasicMaterial color={index % 3 === 0 ? '#8ea5bc' : '#3f4853'} />
          </mesh>
        )
      })}
    </group>
  )
}

function FoundryGantry({ phase }: { phase: Phase }) {
  const beacons = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!beacons.current) return
    const time = clock.getElapsedTime()
    beacons.current.children.forEach((child, index) => {
      const material = (child as THREE.Mesh).material as THREE.MeshStandardMaterial
      material.emissiveIntensity = phase === 'working' ? 1.5 + Math.sin(time * 5 + index) * 0.55 : 0.28
    })
  })
  return (
    <group position={[0, 0, -0.98]}>
      {[-2.55, 2.55].map((x) => (
        <group key={x} position={[x, 1.62, 0]}>
          <mesh castShadow><boxGeometry args={[0.24, 3.15, 0.28]} /><meshStandardMaterial color="#444b54" metalness={0.74} roughness={0.28} /></mesh>
          {[0.58, 1.55, 2.52].map((y) => <mesh key={y} position={[0, y - 1.62, 0.18]}><boxGeometry args={[0.38, 0.08, 0.08]} /><meshStandardMaterial color="#74808c" metalness={0.72} roughness={0.24} /></mesh>)}
        </group>
      ))}
      <mesh position={[0, 3.12, 0]} castShadow><boxGeometry args={[5.35, 0.26, 0.34]} /><meshStandardMaterial color="#4b535d" metalness={0.78} roughness={0.26} /></mesh>
      <mesh position={[0, 3.31, -0.02]}><boxGeometry args={[4.7, 0.065, 0.13]} /><meshStandardMaterial color="#8c969f" metalness={0.84} roughness={0.18} /></mesh>
      <mesh position={[0, 2.88, 0.02]} rotation={[0, 0, Math.PI / 2]}><torusGeometry args={[0.18, 0.035, 8, 24, Math.PI]} /><meshStandardMaterial color="#8e99a3" metalness={0.8} roughness={0.2} /></mesh>
      <group ref={beacons}>
        {[-1.72, -0.58, 0.58, 1.72].map((x, index) => (
          <mesh key={x} position={[x, 2.87, 0.22]}>
            <sphereGeometry args={[0.055, 12, 8]} />
            <meshStandardMaterial color={index % 2 ? '#ffc96d' : '#78d6ff'} emissive={index % 2 ? '#d76a16' : '#2586c7'} emissiveIntensity={1.2} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

function FloorDetails({ phase }: { phase: Phase }) {
  const lights = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!lights.current) return
    const time = clock.getElapsedTime()
    lights.current.children.forEach((child, index) => {
      const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial
      material.opacity = phase === 'working' ? 0.24 + Math.sin(time * 2.5 - index * 0.7) * 0.14 : 0.08
    })
  })
  return (
    <group>
      <mesh position={[0, 0.09, 1.86]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.55, 2.59, 96, 1, 0.14, Math.PI - 0.28]} />
        <meshBasicMaterial color="#5e7da0" transparent opacity={0.26} />
      </mesh>
      <group ref={lights}>
        {Array.from({ length: 9 }, (_, index) => {
          const x = -2.8 + index * 0.7
          return <mesh key={index} position={[x, 0.13, 2.28]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.045, 16]} /><meshBasicMaterial color={index % 3 === 0 ? '#ffc56d' : '#75cfff'} transparent opacity={0.2} toneMapped={false} /></mesh>
        })}
      </group>
      {[-1.55, 0, 1.55].map((x) => <mesh key={x} position={[x, 0.11, 1.15]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.06, 0.42]} /><meshStandardMaterial color="#252a30" metalness={0.58} roughness={0.42} /></mesh>)}
    </group>
  )
}

function Conveyor({ progress, phase }: { progress: number; phase: Phase }) {
  const belt = useRef<THREE.MeshStandardMaterial>(null)
  const rawX = -3.35 + progress * 6.55
  const working = phase === 'working'

  useFrame(({ clock }) => {
    if (belt.current) belt.current.emissiveIntensity = working ? 0.22 + Math.sin(clock.getElapsedTime() * 6) * 0.08 : 0.06
  })

  return (
    <group position={[0, 0.52, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[7.05, 0.28, 1.05]} />
        <meshStandardMaterial ref={belt} color="#20252a" emissive="#30516f" emissiveIntensity={0.08} metalness={0.7} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0.18, 0]} receiveShadow>
        <boxGeometry args={[6.9, 0.08, 0.84]} />
        <meshStandardMaterial color="#11151a" metalness={0.42} roughness={0.58} />
      </mesh>
      {[-0.59, 0.59].map((z) => <mesh key={z} position={[0, 0.43, z]}><boxGeometry args={[7.15, 0.08, 0.08]} /><meshStandardMaterial color="#65717c" metalness={0.82} roughness={0.2} /></mesh>)}
      {Array.from({ length: 17 }, (_, index) => (
        <mesh key={index} position={[-3.2 + index * 0.4, 0.24, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.8, 14]} />
          <meshStandardMaterial color="#616873" metalness={0.78} roughness={0.25} />
        </mesh>
      ))}
      <mesh position={[-3.55, 0.48, 0]} castShadow>
        <boxGeometry args={[0.48, 0.76, 1.3]} />
        <meshStandardMaterial color="#2b3036" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[-3.55, 1.05, 0]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.65, 0.65, 1.05]} />
        <meshStandardMaterial color="#414850" metalness={0.52} roughness={0.36} />
      </mesh>

      {phase !== 'idle' && progress < 0.9 && (
        <group position={[rawX, 0.62, 0]} rotation={[0.18, progress * Math.PI * 3, 0.1]}>
          <mesh castShadow>
            <boxGeometry args={[0.48, 0.48, 0.48]} />
            <meshStandardMaterial color="#b9d1ff" emissive="#608ee8" emissiveIntensity={2.4} metalness={0.24} roughness={0.22} toneMapped={false} />
          </mesh>
          <Sparkles count={10} scale={0.8} size={2.4} speed={0.6} color="#b6dcff" />
        </group>
      )}

      <group position={[3.35, 0.62, 0]} scale={progress > 0.76 ? clamp((progress - 0.76) / 0.2) : 0.001}>
        <mesh rotation={[0, Math.PI / 4, 0]} castShadow>
          <octahedronGeometry args={[0.42, 0]} />
          <meshStandardMaterial color="#e8f1df" emissive="#7da98e" emissiveIntensity={2.4} metalness={0.32} roughness={0.16} toneMapped={false} />
        </mesh>
        <Sparkles count={12} scale={1.1} size={2.5} speed={0.35} color="#d9ffe5" />
      </group>
    </group>
  )
}

function TokenTrail({ phase, runId }: { phase: Phase; runId: number }) {
  const trail = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const count = 30
  useFrame(({ clock }) => {
    if (!trail.current) return
    const time = clock.getElapsedTime() + runId * 0.27
    for (let index = 0; index < count; index += 1) {
      const cycle = (time * (phase === 'working' ? 0.34 : 0.08) + index / count) % 1
      const x = -3.15 + cycle * 6.3
      const pulse = Math.pow(Math.sin(cycle * Math.PI), 1.4)
      dummy.position.set(x, 0.9 + Math.sin(time * 3 + index) * 0.025, 0.25 + Math.sin(cycle * Math.PI * 5) * 0.06)
      dummy.scale.setScalar((0.025 + (index % 4 === 0 ? 0.035 : 0.014)) * pulse)
      dummy.updateMatrix()
      trail.current.setMatrixAt(index, dummy.matrix)
    }
    trail.current.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={trail} args={[undefined, undefined, count]}>
      <octahedronGeometry args={[1, 0]} />
      <meshBasicMaterial color="#a8dcff" toneMapped={false} />
    </instancedMesh>
  )
}

function ProcessingStation({ index, x, progress, phase, mode }: {
  index: number
  x: number
  progress: number
  phase: Phase
  mode: DemoMode
}) {
  const piston = useRef<THREE.Group>(null)
  const rings = useRef<THREE.Group>(null)
  const core = useRef<THREE.MeshStandardMaterial>(null)
  const stationStart = 0.2 + index * 0.15
  const stationEnd = stationStart + 0.3
  const active = phase === 'working' && progress > stationStart && progress < stationEnd && (mode === 'full' || index === 1)
  const enabled = mode === 'full' || index === 1

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime()
    if (piston.current) piston.current.position.y = active ? 1.7 + Math.sin(time * 10) * 0.22 : 2.0
    if (rings.current) {
      rings.current.rotation.y += active ? 0.035 : 0.004
      rings.current.rotation.z = Math.sin(time * 0.8 + index) * 0.12
    }
    if (core.current) core.current.emissiveIntensity = active ? 2.8 + Math.sin(time * 8) * 0.7 : enabled ? 0.42 : 0.08
  })

  const tone = index === 0 ? '#6ed4ff' : index === 1 ? '#ffc166' : '#b99af0'
  const glow = index === 0 ? '#267db8' : index === 1 ? '#b45b16' : '#65419a'

  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 1.22, -0.64]} castShadow>
        <boxGeometry args={[0.24, 2.45, 0.24]} />
        <meshStandardMaterial color="#4a5058" metalness={0.72} roughness={0.29} />
      </mesh>
      <mesh position={[0, 1.22, 0.64]} castShadow>
        <boxGeometry args={[0.24, 2.45, 0.24]} />
        <meshStandardMaterial color="#4a5058" metalness={0.72} roughness={0.29} />
      </mesh>
      <mesh position={[0, 2.36, 0]} castShadow>
        <boxGeometry args={[0.38, 0.28, 1.56]} />
        <meshStandardMaterial color="#555d67" metalness={0.75} roughness={0.25} />
      </mesh>
      <mesh position={[0, 2.5, 0]} castShadow><boxGeometry args={[0.7, 0.16, 1.22]} /><meshStandardMaterial color="#30363d" metalness={0.72} roughness={0.3} /></mesh>
      <group ref={piston} position={[0, 2, 0]}>
        <mesh>
          <cylinderGeometry args={[0.2, 0.2, 0.72, 18]} />
          <meshStandardMaterial color="#9aa1a8" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, -0.44, 0]}>
          <boxGeometry args={[0.58, 0.18, 0.58]} />
          <meshStandardMaterial color="#707984" metalness={0.7} roughness={0.26} />
        </mesh>
      </group>
      <group ref={rings} position={[0, 1.28, 0]}>
        <mesh><torusGeometry args={[0.67, 0.055, 10, 36]} /><meshStandardMaterial ref={core} color={enabled ? tone : '#454a51'} emissive={enabled ? glow : '#22252a'} emissiveIntensity={0.4} metalness={0.58} roughness={0.3} /></mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.53, 0.025, 8, 32]} /><meshBasicMaterial color={enabled ? tone : '#383d43'} transparent opacity={active ? 0.82 : 0.3} toneMapped={false} /></mesh>
      </group>
      <mesh position={[0, 1.18, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 1.42, 12]} />
        <meshStandardMaterial color={tone} emissive={glow} emissiveIntensity={active ? 3.2 : 0.48} transparent opacity={active ? 0.92 : 0.36} toneMapped={false} />
      </mesh>
      {active && (
        <Sparkles count={28} position={[0, 1.15, 0]} scale={[0.9, 1.5, 0.9]} size={3.2} speed={1.1} color={index === 0 ? '#87d7ff' : index === 1 ? '#ffc476' : '#c7a6ff'} />
      )}
      <mesh position={[0, 0.22, -0.79]}>
        <boxGeometry args={[0.46, 0.18, 0.28]} />
        <meshStandardMaterial color="#24292f" emissive={active ? '#5e9ece' : '#16191d'} emissiveIntensity={active ? 1.8 : 0.2} />
      </mesh>
    </group>
  )
}

function CoolantLoop({ phase, progress, runId }: Pick<Props, 'phase' | 'progress' | 'runId'>) {
  const liquid = useRef<THREE.Mesh>(null)
  const drops = useRef<THREE.InstancedMesh>(null)
  const wheel = useRef<THREE.Group>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const curve = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2.85, 0.78, -1.52),
    new THREE.Vector3(-2.2, 0.55, -1.48),
    new THREE.Vector3(-1.3, 0.48, -1.22),
    new THREE.Vector3(-0.2, 0.54, -1.18),
    new THREE.Vector3(0.85, 0.48, -1.2),
  ]), [])
  const tube = useMemo(() => new THREE.TubeGeometry(curve, 54, 0.075, 12, false), [curve])
  const count = 28

  useFrame(({ clock }, delta) => {
    const time = clock.getElapsedTime()
    if (liquid.current) {
      const fill = 0.88 - progress * 0.48
      liquid.current.scale.y = THREE.MathUtils.lerp(liquid.current.scale.y, fill, 1 - Math.exp(-delta * 3.5))
      liquid.current.position.y = 0.18 + liquid.current.scale.y * 0.58
    }
    if (wheel.current) wheel.current.rotation.z -= delta * (phase === 'working' ? 4.5 : 0.4)
    if (drops.current) {
      for (let index = 0; index < count; index += 1) {
        const t = (time * (phase === 'working' ? 0.65 : 0.08) + index / count + runId * 0.1) % 1
        dummy.position.copy(curve.getPoint(t))
        dummy.scale.setScalar(phase === 'working' ? 0.035 + Math.sin(t * Math.PI) * 0.025 : 0.009)
        dummy.updateMatrix()
        drops.current.setMatrixAt(index, dummy.matrix)
      }
      drops.current.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group>
      <mesh position={[-3.0, 0.84, -1.55]} castShadow>
        <cylinderGeometry args={[0.53, 0.58, 1.45, 32]} />
        <meshPhysicalMaterial color="#aacbdc" transparent opacity={0.22} transmission={0.38} roughness={0.1} depthWrite={false} />
      </mesh>
      <mesh ref={liquid} position={[-3.0, 0.6, -1.55]} scale={[1, 0.88, 1]}>
        <cylinderGeometry args={[0.46, 0.5, 1.15, 32]} />
        <meshStandardMaterial color="#42a9dc" emissive="#12679f" emissiveIntensity={2.2} transparent opacity={0.88} />
      </mesh>
      <mesh geometry={tube}>
        <meshPhysicalMaterial color="#98d8f2" transparent opacity={0.34} transmission={0.45} roughness={0.1} depthWrite={false} />
      </mesh>
      <instancedMesh ref={drops} args={[undefined, undefined, count]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color="#66d5ff" toneMapped={false} />
      </instancedMesh>
      <group ref={wheel} position={[-2.34, 0.68, -1.45]} rotation={[0, 0.2, 0]}>
        <mesh><torusGeometry args={[0.3, 0.055, 10, 30]} /><meshStandardMaterial color="#8395a2" metalness={0.78} roughness={0.24} /></mesh>
        {[0, 1, 2, 3].map((index) => <mesh key={index} rotation={[0, 0, index * Math.PI / 2]}><boxGeometry args={[0.05, 0.54, 0.05]} /><meshStandardMaterial color="#8395a2" metalness={0.78} /></mesh>)}
      </group>
    </group>
  )
}

function PowerSystem({ phase, mode }: Pick<Props, 'phase' | 'mode'>) {
  const flywheel = useRef<THREE.Group>(null)
  const flame = useRef<THREE.Group>(null)
  useFrame(({ clock }, delta) => {
    if (flywheel.current) flywheel.current.rotation.z -= delta * (phase === 'working' ? mode === 'full' ? 8 : 5 : 0.6)
    if (flame.current) {
      const time = clock.getElapsedTime()
      flame.current.scale.set(
        0.82 + Math.sin(time * 8) * 0.06,
        (phase === 'working' ? 0.92 : 0.48) + Math.sin(time * 11) * 0.07,
        0.82 + Math.cos(time * 7) * 0.05,
      )
    }
  })
  return (
    <group position={[1.95, 0.72, -1.52]}>
      <mesh position={[0, -0.3, -0.18]} castShadow><boxGeometry args={[1.62, 1.1, 0.86]} /><meshStandardMaterial color="#34343a" metalness={0.62} roughness={0.4} /></mesh>
      <mesh position={[0, -0.26, 0.29]}><boxGeometry args={[0.88, 0.68, 0.08]} /><meshStandardMaterial color="#171515" emissive="#6f2411" emissiveIntensity={phase === 'working' ? 1.4 : 0.28} metalness={0.3} roughness={0.5} /></mesh>
      <group ref={flame} position={[0, -0.22, 0.38]}>
        <mesh scale={[0.34, 0.62, 0.22]}><sphereGeometry args={[0.65, 16, 14]} /><meshStandardMaterial color="#e96f2d" emissive="#c83912" emissiveIntensity={2.4} transparent opacity={0.78} depthWrite={false} /></mesh>
        <mesh position={[0.08, 0.15, 0.02]} scale={[0.2, 0.44, 0.16]} rotation={[0, 0, 0.18]}><sphereGeometry args={[0.58, 14, 12]} /><meshStandardMaterial color="#ffd06b" emissive="#e8811e" emissiveIntensity={3.1} transparent opacity={0.88} depthWrite={false} /></mesh>
      </group>
      <mesh position={[-0.54, 0.7, -0.18]}><cylinderGeometry args={[0.16, 0.2, 0.85, 16]} /><meshStandardMaterial color="#45454b" metalness={0.72} roughness={0.32} /></mesh>
      <mesh position={[-0.54, 1.13, -0.18]}><cylinderGeometry args={[0.24, 0.16, 0.12, 16]} /><meshStandardMaterial color="#60636a" metalness={0.74} roughness={0.28} /></mesh>
      <group ref={flywheel} position={[0.83, -0.12, 0.05]}>
        <mesh><torusGeometry args={[0.63, 0.1, 16, 48]} /><meshStandardMaterial color="#b57c32" emissive="#8c4d17" emissiveIntensity={phase === 'working' ? 1.6 : 0.3} metalness={0.74} roughness={0.22} /></mesh>
        {[0, 1, 2, 3, 4, 5].map((index) => <mesh key={index} rotation={[0, 0, index * Math.PI / 3]}><boxGeometry args={[0.06, 1.1, 0.07]} /><meshStandardMaterial color="#c4934b" metalness={0.78} roughness={0.2} /></mesh>)}
        <mesh><cylinderGeometry args={[0.16, 0.16, 0.24, 18]} /><meshStandardMaterial color="#e0b367" emissive="#a76220" emissiveIntensity={1.2} /></mesh>
      </group>
      <Sparkles count={phase === 'working' ? 16 : 4} position={[0.15, 0.15, 0.25]} scale={[1.5, 1.5, 0.7]} size={2} speed={0.7} color="#ffc764" />
      <pointLight position={[0.15, 0.05, 0.42]} color="#ff9a42" intensity={phase === 'working' ? 5.2 : 1.5} distance={4.5} />
    </group>
  )
}

function ExhaustChamber({ phase, progress, runId }: Pick<Props, 'phase' | 'progress' | 'runId'>) {
  const group = useRef<THREE.Group>(null)
  const count = 24
  useFrame(({ clock }) => {
    if (!group.current) return
    const time = clock.getElapsedTime() + runId
    group.current.children.forEach((child, index) => {
      const cycle = (time * 0.22 + index / count) % 1
      child.position.set(
        3.02 + Math.sin(index * 2.1) * 0.3 * cycle,
        0.36 + cycle * (0.65 + progress * 0.8),
        -1.45 + Math.cos(index * 1.7) * 0.24 * cycle,
      )
      child.scale.setScalar((0.06 + cycle * 0.19) * (phase === 'working' ? 1 : 0.45))
    })
  })
  return (
    <group>
      <mesh position={[3.02, 0.86, -1.45]}>
        <cylinderGeometry args={[0.58, 0.62, 1.7, 32]} />
        <meshPhysicalMaterial color="#c4b5da" transparent opacity={0.17} transmission={0.36} roughness={0.08} depthWrite={false} />
      </mesh>
      <mesh position={[3.02, 0.05, -1.45]}><cylinderGeometry args={[0.65, 0.68, 0.16, 28]} /><meshStandardMaterial color="#36333d" metalness={0.68} roughness={0.32} /></mesh>
      <group ref={group}>
        {Array.from({ length: count }, (_, index) => (
          <mesh key={index}>
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color={index % 2 ? '#9a7ac4' : '#b39bd2'} emissive="#5d3e88" emissiveIntensity={0.8} transparent opacity={0.34} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

function Operator({ phase, progress }: Pick<Props, 'phase' | 'progress'>) {
  const robot = useRef<THREE.Group>(null)
  const arm = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime()
    if (robot.current) {
      robot.current.position.y = 0.98 + Math.sin(time * 1.6) * 0.045
      robot.current.rotation.y = -0.4 + Math.sin(time * 0.55) * 0.08
    }
    if (arm.current) arm.current.rotation.z = phase === 'working' ? -0.45 + Math.sin(time * 4.5) * 0.35 * (progress < 0.2 ? 1 : 0.25) : -0.35
  })
  return (
    <group ref={robot} position={[-2.1, 0.98, 1.55]} scale={0.72}>
      <mesh castShadow><sphereGeometry args={[0.48, 26, 26]} /><meshStandardMaterial color="#ebece8" metalness={0.18} roughness={0.24} /></mesh>
      <mesh position={[0, -0.57, 0]} castShadow><capsuleGeometry args={[0.29, 0.38, 8, 16]} /><meshStandardMaterial color="#d8dbd7" metalness={0.25} roughness={0.3} /></mesh>
      <mesh position={[0, 0.02, 0.4]} scale={[0.7, 0.36, 0.12]}><sphereGeometry args={[0.4, 20, 14]} /><meshStandardMaterial color="#101419" emissive="#477287" emissiveIntensity={phase === 'working' ? 2.5 : 1.1} roughness={0.14} /></mesh>
      <mesh position={[-0.105, 0.02, 0.442]}><circleGeometry args={[0.018, 16]} /><meshBasicMaterial color="#b5f5d0" toneMapped={false} /></mesh>
      <mesh position={[0.105, 0.02, 0.442]}><circleGeometry args={[0.018, 16]} /><meshBasicMaterial color="#b5f5d0" toneMapped={false} /></mesh>
      <group ref={arm} position={[0.35, -0.42, 0]} rotation={[0, 0, -0.35]}>
        <mesh position={[0.25, 0, 0]} rotation={[0, 0, Math.PI / 2]}><capsuleGeometry args={[0.1, 0.38, 6, 12]} /><meshStandardMaterial color="#d8dbd7" /></mesh>
        <mesh position={[0.52, 0, 0]}><sphereGeometry args={[0.13, 12, 12]} /><meshStandardMaterial color="#c5c9c5" /></mesh>
      </group>
      <pointLight color="#78b9dd" intensity={2.6} distance={2.4} />
    </group>
  )
}

function Scene(props: Props) {
  return (
    <>
      <CameraRig phase={props.phase} />
      <ambientLight intensity={0.68} color="#abb8d2" />
      <hemisphereLight args={['#c3d2ed', '#25201b', 1.45]} />
      <directionalLight position={[-5, 8, 6]} intensity={4.05} color="#e6ecff" castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7} />
      <pointLight position={[0, 5, -4]} color="#9476d3" intensity={5} distance={14} />
      <pointLight position={[-4.5, 2.2, 2.6]} color="#62caff" intensity={5.2} distance={10} />
      <pointLight position={[4.5, 2, 2.2]} color="#ff9d46" intensity={5.8} distance={10} />
      <Stars radius={38} depth={16} count={620} factor={1.5} saturation={0.2} fade speed={0.22} />
      <Sparkles count={34} scale={[10, 6, 8]} size={1.4} speed={0.18} opacity={0.25} color="#c4cfff" />

      <group position={[0, -0.16, 0]} rotation={[0, -0.08, 0]}>
        <FoundryBase />
        <FloorDetails phase={props.phase} />
        <FoundryGantry phase={props.phase} />
        <Conveyor progress={props.progress} phase={props.phase} />
        <TokenTrail phase={props.phase} runId={props.runId} />
        <ProcessingStation index={0} x={-0.95} progress={props.progress} phase={props.phase} mode={props.mode} />
        <ProcessingStation index={1} x={0.05} progress={props.progress} phase={props.phase} mode={props.mode} />
        <ProcessingStation index={2} x={1.05} progress={props.progress} phase={props.phase} mode={props.mode} />
        <CoolantLoop phase={props.phase} progress={props.progress} runId={props.runId} />
        <PowerSystem phase={props.phase} mode={props.mode} />
        <ExhaustChamber phase={props.phase} progress={props.progress} runId={props.runId} />
        <Operator phase={props.phase} progress={props.progress} />
      </group>
      <ContactShadows position={[0, -0.94, 0]} scale={14} opacity={0.44} blur={2.7} far={5} color="#000000" />
      <EffectComposer multisampling={0}>
        <Bloom intensity={1.1} luminanceThreshold={0.68} luminanceSmoothing={0.72} mipmapBlur />
        <Vignette eskil={false} offset={0.18} darkness={0.6} />
      </EffectComposer>
    </>
  )
}

export default function FoundryWorld(props: Props) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      shadows
      camera={{ position: [0, 3.75, 9.2], fov: 44, near: 0.1, far: 80 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.15
      }}
    >
      <color attach="background" args={['#08090d']} />
      <fog attach="fog" args={['#08090d', 12, 31]} />
      <Suspense fallback={null}><Scene {...props} /></Suspense>
    </Canvas>
  )
}
