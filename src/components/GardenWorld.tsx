import { Suspense, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Sparkles, Stars } from '@react-three/drei'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { DemoMode, Phase } from '../types'

type Props = {
  phase: Phase
  runId: number
  mode: DemoMode
  levels: {
    water: number
    energy: number
    co2: number
  }
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))

function seeded(index: number, offset = 0) {
  const value = Math.sin(index * 9283.31 + offset * 77.13) * 43758.5453
  return value - Math.floor(value)
}

const RIVER_POINTS = [
  { x: -3.76, y: 0.29, z: -0.05, width: 0.12 },
  { x: -3.48, y: 0.3, z: -0.14, width: 0.58 },
  { x: -3.02, y: 0.31, z: -0.4, width: 0.76 },
  { x: -2.48, y: 0.31, z: -0.6, width: 0.66 },
  { x: -1.85, y: 0.3, z: -0.68, width: 0.54 },
  { x: -0.95, y: 0.28, z: -0.24, width: 0.62 },
  { x: -0.05, y: 0.27, z: -0.46, width: 0.52 },
  { x: 0.85, y: 0.25, z: -0.8, width: 0.6 },
  { x: 1.78, y: 0.22, z: -0.62, width: 0.68 },
  { x: 2.62, y: 0.15, z: -0.78, width: 0.74 },
  { x: 3.42, y: -0.02, z: -0.65, width: 0.86 },
]

function distanceToRiver(x: number, z: number) {
  let minDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < RIVER_POINTS.length - 1; index += 1) {
    const start = RIVER_POINTS[index]
    const end = RIVER_POINTS[index + 1]
    const dx = end.x - start.x
    const dz = end.z - start.z
    const lengthSquared = dx * dx + dz * dz
    const t = clamp(((x - start.x) * dx + (z - start.z) * dz) / lengthSquared)
    const closestX = start.x + dx * t
    const closestZ = start.z + dz * t
    const width = THREE.MathUtils.lerp(start.width, end.width, t)
    minDistance = Math.min(minDistance, Math.hypot(x - closestX, z - closestZ) - width)
  }
  return minDistance
}

function createTerrainGeometry() {
  const geometry = new THREE.BufferGeometry()
  const rings = 26
  const segments = 72
  const radius = 3.84
  const positions: number[] = [0, 0.2, 0]
  const colors: number[] = [0.2, 0.31, 0.22]
  const indices: number[] = []
  const color = new THREE.Color()

  for (let ring = 1; ring <= rings; ring += 1) {
    const ringRadius = radius * (ring / rings)
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2
      const x = Math.cos(angle) * ringRadius
      const z = Math.sin(angle) * ringRadius
      const edge = Math.pow(ringRadius / radius, 5) * 0.25
      const largeNoise = Math.sin(x * 1.7 + z * 0.8) * 0.045 + Math.cos(z * 2.1 - x * 0.4) * 0.035
      const microNoise = Math.sin((x + z) * 6.4) * 0.012
      const riverCarve = Math.max(0, 0.36 - distanceToRiver(x, z)) * 0.12
      const y = 0.2 + largeNoise + microNoise - edge - riverCarve
      positions.push(x, y, z)

      const moss = clamp(0.45 + largeNoise * 3 + seeded(segment + ring * segments, 11) * 0.22)
      color.setRGB(0.16 + moss * 0.11, 0.23 + moss * 0.18, 0.16 + moss * 0.1)
      colors.push(color.r, color.g, color.b)
    }
  }

  for (let segment = 0; segment < segments; segment += 1) {
    indices.push(0, 1 + segment, 1 + ((segment + 1) % segments))
  }

  for (let ring = 1; ring < rings; ring += 1) {
    const currentStart = 1 + (ring - 1) * segments
    const nextStart = 1 + ring * segments
    for (let segment = 0; segment < segments; segment += 1) {
      const nextSegment = (segment + 1) % segments
      const a = currentStart + segment
      const b = currentStart + nextSegment
      const c = nextStart + segment
      const d = nextStart + nextSegment
      indices.push(a, c, b, b, c, d)
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function createWorldOrbGeometry() {
  const geometry = new THREE.SphereGeometry(3.58, 72, 36)
  const positions = geometry.getAttribute('position')
  const colors: number[] = []
  const color = new THREE.Color()

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index)
    const y = positions.getY(index)
    const z = positions.getZ(index)
    const continents = Math.sin(x * 1.35 + z * 0.55) + Math.cos(z * 1.7 - x * 0.42) + Math.sin((x + z) * 2.4) * 0.48
    const latitude = 1 - Math.abs(y / 3.58)
    const isLand = continents + latitude * 0.38 > 0.72
    const light = 0.72 + clamp((y + 3.58) / 7.16) * 0.28
    color.set(isLand ? '#345b45' : '#1d4659')
    if (isLand && continents > 1.4) color.set('#456a4d')
    color.multiplyScalar(light)
    colors.push(color.r, color.g, color.b)
  }

  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

function createGrassClusterGeometry() {
  const geometry = new THREE.BufferGeometry()
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const segments = 5
  const bladeCount = 5
  const palette = ['#597b57', '#6f9367', '#7fa274', '#4d704d']

  for (let blade = 0; blade < bladeCount; blade += 1) {
    const angle = (blade / bladeCount) * Math.PI * 2 + seeded(blade, 8) * 0.7
    const height = 0.27 + seeded(blade, 9) * 0.18
    const width = 0.052 + seeded(blade, 10) * 0.022
    const offsetRadius = blade === 0 ? 0 : 0.035 + seeded(blade, 12) * 0.06
    const offsetX = Math.cos(angle) * offsetRadius
    const offsetZ = Math.sin(angle) * offsetRadius
    const sideX = Math.cos(angle + Math.PI / 2)
    const sideZ = Math.sin(angle + Math.PI / 2)
    const bend = 0.16 + seeded(blade, 13) * 0.12
    const bladeColor = new THREE.Color(palette[blade % palette.length])
    const baseIndex = positions.length / 3

    for (let segment = 0; segment <= segments; segment += 1) {
      const t = segment / segments
      const taper = Math.pow(1 - t, 1.08)
      const centerX = offsetX + Math.cos(angle) * bend * t * t
      const centerZ = offsetZ + Math.sin(angle) * bend * t * t
      const y = height * t
      positions.push(centerX - sideX * width * taper, y, centerZ - sideZ * width * taper)
      positions.push(centerX + sideX * width * taper, y, centerZ + sideZ * width * taper)
      const light = 0.74 + t * 0.26
      colors.push(bladeColor.r * light, bladeColor.g * light, bladeColor.b * light)
      colors.push(bladeColor.r * light, bladeColor.g * light, bladeColor.b * light)
    }

    for (let segment = 0; segment < segments; segment += 1) {
      const a = baseIndex + segment * 2
      const b = a + 1
      const c = a + 2
      const d = a + 3
      indices.push(a, c, b, b, c, d)
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function createRiverGeometry(widthScale = 1, yOffset = 0) {
  const geometry = new THREE.BufferGeometry()
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const samples = 56
  const curve = new THREE.CatmullRomCurve3(
    RIVER_POINTS.map((point) => new THREE.Vector3(point.x, point.y, point.z)),
    false,
    'catmullrom',
    0.38,
  )

  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples
    const point = curve.getPoint(t)
    const before = curve.getPoint(Math.max(0, t - 0.008))
    const after = curve.getPoint(Math.min(1, t + 0.008))
    const tangent = after.sub(before).setY(0).normalize()
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x)
    const sourceIndex = t * (RIVER_POINTS.length - 1)
    const low = Math.floor(sourceIndex)
    const high = Math.min(RIVER_POINTS.length - 1, low + 1)
    const width = THREE.MathUtils.lerp(RIVER_POINTS[low].width, RIVER_POINTS[high].width, sourceIndex - low) * widthScale
    positions.push(point.x + normal.x * width, point.y + yOffset, point.z + normal.z * width)
    positions.push(point.x - normal.x * width, point.y + yOffset, point.z - normal.z * width)
    uvs.push(t, 0, t, 1)
  }

  for (let index = 0; index < samples; index += 1) {
    const a = index * 2
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function CameraRig({ phase }: { phase: Phase }) {
  const { camera, pointer } = useThree()
  const target = useMemo(() => new THREE.Vector3(), [])
  const desired = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ clock }, delta) => {
    const time = clock.getElapsedTime()
    const working = phase === 'working'
    desired.set(
      Math.sin(time * 0.12) * 0.32 + pointer.x * 0.18,
      5.0 + Math.sin(time * 0.17) * 0.09 + pointer.y * 0.08,
      working ? 11.35 : 11.65,
    )
    camera.position.lerp(desired, 1 - Math.exp(-delta * 1.7))
    target.set(0, -0.15, 0)
    camera.lookAt(target)
  })

  return null
}

function Island() {
  const terrain = useMemo(() => createTerrainGeometry(), [])
  const orb = useMemo(() => createWorldOrbGeometry(), [])
  return (
    <group>
      <mesh geometry={orb} position={[0, -2.3, 0]} scale={[1, 0.72, 1]} receiveShadow castShadow>
        <meshStandardMaterial vertexColors roughness={0.9} metalness={0.035} />
      </mesh>
      <mesh geometry={terrain} receiveShadow castShadow>
        <meshStandardMaterial vertexColors roughness={0.96} metalness={0.01} />
      </mesh>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => {
        const angle = index * 0.79
        const radius = 3.3
        return (
          <mesh
            key={index}
            position={[Math.cos(angle) * radius, -0.17 - seeded(index) * 0.35, Math.sin(angle) * radius]}
            rotation={[seeded(index, 2), angle, seeded(index, 4)]}
            scale={[0.45 + seeded(index, 5) * 0.45, 0.5 + seeded(index, 6) * 0.5, 0.42 + seeded(index, 7) * 0.45]}
            castShadow
          >
            <dodecahedronGeometry args={[0.68, 0]} />
            <meshStandardMaterial color={index % 2 ? '#343039' : '#292831'} roughness={0.88} />
          </mesh>
        )
      })}
    </group>
  )
}

function RiverBanks() {
  const stones = useRef<THREE.InstancedMesh>(null)
  const pebbles = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const curve = useMemo(() => new THREE.CatmullRomCurve3(
    RIVER_POINTS.map((point) => new THREE.Vector3(point.x, point.y, point.z)),
    false,
    'catmullrom',
    0.38,
  ), [])
  const bankData = useMemo(() => Array.from({ length: 46 }, (_, index) => ({
    t: 0.02 + seeded(index, 22) * 0.96,
    side: index % 2 === 0 ? 1 : -1,
    size: 0.12 + seeded(index, 23) * 0.18,
    offset: 0.04 + seeded(index, 24) * 0.17,
    rotation: seeded(index, 25) * Math.PI,
  })), [])

  useLayoutEffect(() => {
    if (!stones.current || !pebbles.current) return
    bankData.forEach((stone, index) => {
      const point = curve.getPoint(stone.t)
      const tangent = curve.getTangent(stone.t).setY(0).normalize()
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x)
      const sourceIndex = stone.t * (RIVER_POINTS.length - 1)
      const low = Math.floor(sourceIndex)
      const high = Math.min(RIVER_POINTS.length - 1, low + 1)
      const width = THREE.MathUtils.lerp(RIVER_POINTS[low].width, RIVER_POINTS[high].width, sourceIndex - low)
      dummy.position.copy(point).addScaledVector(normal, stone.side * (width + stone.offset))
      dummy.position.y += 0.045
      dummy.rotation.set(seeded(index, 26), stone.rotation, seeded(index, 27))
      dummy.scale.set(stone.size * 1.45, stone.size * 0.7, stone.size)
      dummy.updateMatrix()
      stones.current!.setMatrixAt(index, dummy.matrix)
      stones.current!.setColorAt(index, new THREE.Color(index % 3 === 0 ? '#74766b' : index % 3 === 1 ? '#555b52' : '#858779'))

      dummy.position.addScaledVector(normal, stone.side * 0.18)
      dummy.position.y -= 0.02
      dummy.scale.multiplyScalar(0.38)
      dummy.updateMatrix()
      pebbles.current!.setMatrixAt(index, dummy.matrix)
      pebbles.current!.setColorAt(index, new THREE.Color(index % 2 ? '#9a9a8c' : '#666a63'))
    })
    stones.current.instanceMatrix.needsUpdate = true
    pebbles.current.instanceMatrix.needsUpdate = true
    if (stones.current.instanceColor) stones.current.instanceColor.needsUpdate = true
    if (pebbles.current.instanceColor) pebbles.current.instanceColor.needsUpdate = true
  }, [bankData, curve, dummy])

  return (
    <group>
      <instancedMesh ref={stones} args={[undefined, undefined, bankData.length]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={0.98} />
      </instancedMesh>
      <instancedMesh ref={pebbles} args={[undefined, undefined, bankData.length]} castShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={0.92} />
      </instancedMesh>
    </group>
  )
}

function Undergrowth({ level, phase }: { level: number; phase: Phase }) {
  const moss = useRef<THREE.InstancedMesh>(null)
  const flowers = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const patches = useMemo(() => Array.from({ length: 260 }, (_, index) => {
    const angle = seeded(index, 31) * Math.PI * 2
    const radius = Math.sqrt(seeded(index, 32)) * 3.5
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    return {
      x,
      z,
      valid: distanceToRiver(x, z) > 0.28,
      size: 0.075 + seeded(index, 33) * 0.115,
      rotation: seeded(index, 34) * Math.PI,
      threshold: seeded(index, 35) * 0.78,
    }
  }).filter((patch) => patch.valid).slice(0, 82), [])

  useFrame(({ clock }) => {
    if (!moss.current || !flowers.current) return
    const time = clock.getElapsedTime()
    patches.forEach((patch, index) => {
      const growth = clamp((level + (phase === 'working' ? 0.12 : 0) - patch.threshold) * 4)
      dummy.position.set(patch.x, 0.24, patch.z)
      dummy.rotation.set(0, patch.rotation + Math.sin(time * 0.6 + index) * 0.03, 0)
      dummy.scale.set(patch.size * 1.7, patch.size * (0.36 + growth * 0.44), patch.size * 1.25)
      dummy.updateMatrix()
      moss.current!.setMatrixAt(index, dummy.matrix)

      dummy.position.y = 0.31 + patch.size * growth
      dummy.scale.setScalar(index % 6 === 0 ? 0.025 + growth * 0.045 : 0.001)
      dummy.updateMatrix()
      flowers.current!.setMatrixAt(index, dummy.matrix)
    })
    moss.current.instanceMatrix.needsUpdate = true
    flowers.current.instanceMatrix.needsUpdate = true
  })

  useLayoutEffect(() => {
    if (!moss.current || !flowers.current) return
    patches.forEach((_, index) => {
      moss.current!.setColorAt(index, new THREE.Color(index % 3 === 0 ? '#486947' : index % 3 === 1 ? '#5f7f55' : '#708b5f'))
      flowers.current!.setColorAt(index, new THREE.Color(index % 2 ? '#d8d0ef' : '#f1d69a'))
    })
    if (moss.current.instanceColor) moss.current.instanceColor.needsUpdate = true
    if (flowers.current.instanceColor) flowers.current.instanceColor.needsUpdate = true
  }, [patches])

  return (
    <group>
      <instancedMesh ref={moss} args={[undefined, undefined, patches.length]} castShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={0.94} />
      </instancedMesh>
      <instancedMesh ref={flowers} args={[undefined, undefined, patches.length]}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial emissive="#8b805f" emissiveIntensity={0.22} roughness={0.7} />
      </instancedMesh>
      {Array.from({ length: 9 }, (_, index) => {
        const angle = seeded(index, 40) * Math.PI * 2
        const radius = 1.8 + seeded(index, 41) * 1.5
        const x = Math.cos(angle) * radius
        const z = Math.sin(angle) * radius
        return (
          <group key={index} position={[x, 0.28, z]} scale={0.7 + seeded(index, 42) * 0.6} rotation={[0, seeded(index, 43) * Math.PI, 0]}>
            <mesh position={[0, 0.1, 0]} castShadow>
              <cylinderGeometry args={[0.025, 0.04, 0.2, 8]} />
              <meshStandardMaterial color="#d7d0b4" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.22, 0]} scale={[1, 0.5, 1]} castShadow>
              <sphereGeometry args={[0.11, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color={index % 2 ? '#a98166' : '#b59b78'} roughness={0.86} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

function Grass({ level, phase, runId }: { level: number; phase: Phase; runId: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const lastRun = useRef(runId)
  const burstStarted = useRef(-100)
  const geometry = useMemo(() => createGrassClusterGeometry(), [])
  const blades = useMemo(() => Array.from({ length: 190 }, (_, index) => {
    const angle = seeded(index, 1) * Math.PI * 2
    const radius = Math.sqrt(seeded(index, 2)) * 3.58
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    const nearRiver = distanceToRiver(x, z) < 0.18
    return {
      x,
      z,
      rotation: seeded(index, 3) * Math.PI,
      height: 0.74 + seeded(index, 4) * 0.38,
      threshold: seeded(index, 5) * 0.8,
      nearRiver,
      waveDelay: clamp(Math.hypot(x + 2.9, z + 0.25) / 6.8) * 1.45,
    }
  }), [])

  useFrame(({ clock }) => {
    if (!mesh.current) return
    const time = clock.getElapsedTime()
    if (lastRun.current !== runId) {
      lastRun.current = runId
      burstStarted.current = time
    }
    const elapsed = time - burstStarted.current
    const workingLift = phase === 'working' ? 0.3 : 0

    blades.forEach((blade, index) => {
      const activation = blade.nearRiver ? 0 : clamp((level + workingLift - blade.threshold) * 4.2)
      const wave = burstStarted.current < 0
        ? 1
        : clamp((elapsed - blade.waveDelay) / 0.7)
      const easedWave = wave * wave * (3 - 2 * wave)
      const burstScale = phase === 'working' ? 0.08 + easedWave * 1.05 : 1
      const sway = Math.sin(time * 1.1 + index * 0.21) * 0.045
      dummy.position.set(blade.x, 0.2, blade.z)
      dummy.rotation.set(sway, blade.rotation + sway, sway * 0.35)
      dummy.scale.set(
        (0.9 + activation * 0.24) * burstScale,
        Math.max(0.02, activation * blade.height * burstScale),
        (0.76 + activation * 0.2) * burstScale,
      )
      dummy.updateMatrix()
      mesh.current!.setMatrixAt(index, dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, blades.length]} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.88} side={THREE.DoubleSide} />
    </instancedMesh>
  )
}

function WaterStream({ active }: { active: boolean }) {
  const surface = useMemo(() => createRiverGeometry(1, 0.045), [])
  const bed = useMemo(() => createRiverGeometry(1.18, -0.035), [])
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uActive: { value: 0 },
      uDeep: { value: new THREE.Color('#16486d') },
      uShallow: { value: new THREE.Color('#69b9d0') },
      uFoam: { value: new THREE.Color('#d9f5ef') },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorld;
      uniform float uTime;
      uniform float uActive;
      void main() {
        vUv = uv;
        vec3 displaced = position;
        displaced.y += sin(uv.x * 44.0 - uTime * (2.0 + uActive * 2.6)) * 0.012;
        displaced.y += sin(uv.x * 18.0 + uv.y * 9.0 - uTime * 1.3) * 0.008;
        vec4 world = modelMatrix * vec4(displaced, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vWorld;
      uniform float uTime;
      uniform float uActive;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uFoam;
      void main() {
        float edge = 1.0 - smoothstep(0.0, 0.22, min(vUv.y, 1.0 - vUv.y));
        float rippleA = sin(vUv.x * 68.0 - uTime * (3.0 + uActive * 2.0) + vUv.y * 8.0);
        float rippleB = sin(vUv.x * 31.0 - uTime * 1.7 - vUv.y * 16.0);
        float ripple = smoothstep(0.72, 1.0, rippleA * 0.55 + rippleB * 0.45);
        float depth = sin(vUv.y * 3.14159);
        vec3 color = mix(uShallow, uDeep, depth * 0.7);
        color += ripple * vec3(0.16, 0.25, 0.3);
        color = mix(color, uFoam, edge * (0.22 + ripple * 0.46));
        float shimmer = 0.86 + sin((vWorld.x + vWorld.z) * 12.0 + uTime) * 0.05;
        gl_FragColor = vec4(color * shimmer, 0.91);
      }
    `,
  }), [])

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.getElapsedTime()
    material.uniforms.uActive.value = THREE.MathUtils.lerp(material.uniforms.uActive.value, active ? 1 : 0, 0.04)
  })

  return (
    <>
      <mesh geometry={bed} receiveShadow>
        <meshStandardMaterial color="#26352f" roughness={0.98} />
      </mesh>
      <mesh geometry={surface} material={material} renderOrder={2} />
    </>
  )
}

function Waterfall({ active }: { active: boolean }) {
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uActive: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      uniform float uTime;
      void main() {
        vUv = uv;
        vec3 displaced = position;
        displaced.z += sin(uv.y * 18.0 - uTime * 3.0 + uv.x * 8.0) * 0.018;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uActive;
      void main() {
        float streakA = sin(vUv.x * 48.0 + vUv.y * 16.0 + uTime * 5.0);
        float streakB = sin(vUv.x * 21.0 - vUv.y * 34.0 + uTime * 3.2);
        float streak = smoothstep(0.05, 0.92, streakA * 0.55 + streakB * 0.45);
        float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(0.0, 0.18, 1.0 - vUv.x);
        vec3 deep = vec3(0.13, 0.42, 0.61);
        vec3 foam = vec3(0.72, 0.94, 0.94);
        vec3 color = mix(deep, foam, streak * 0.7 + (1.0 - vUv.y) * 0.18);
        gl_FragColor = vec4(color, edge * (0.68 + uActive * 0.18));
      }
    `,
  }), [])

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.getElapsedTime()
    material.uniforms.uActive.value = THREE.MathUtils.lerp(material.uniforms.uActive.value, active ? 1 : 0, 0.04)
  })

  return (
    <group position={[3.47, -0.34, -0.66]}>
      <mesh rotation={[0, Math.PI / 2, 0]} material={material} renderOrder={3}>
        <planeGeometry args={[1.35, 0.82, 16, 20]} />
      </mesh>
      <mesh position={[0.04, -0.47, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.34, 0.8, 1]}>
        <circleGeometry args={[0.8, 32]} />
        <meshBasicMaterial color="#9bd9df" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <Sparkles count={22} scale={[0.65, 0.55, 1.45]} position={[0.08, -0.35, 0]} size={2.2} speed={0.65} opacity={0.6} color="#bceef2" />
    </group>
  )
}

function WaterCycle({ phase, runId }: { phase: Phase; runId: number }) {
  const rain = useRef<THREE.InstancedMesh>(null)
  const vapor = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const rainCount = 58
  const vaporCount = 12

  useFrame(({ clock }) => {
    if (!rain.current || !vapor.current) return
    const time = clock.getElapsedTime() + runId * 0.73
    for (let index = 0; index < rainCount; index += 1) {
      const cycle = (time * (phase === 'working' ? 0.52 : 0.12) + index / rainCount * 2.7) % 1
      const angle = seeded(index, 91) * Math.PI * 2
      const radius = Math.sqrt(seeded(index, 92)) * 3.1
      const x = Math.cos(angle) * radius + Math.sin(time * 0.28 + index) * 0.05
      const z = Math.sin(angle) * radius * 0.78 - 0.05
      const y = 4.95 - cycle * 4.45
      const fade = Math.sin(cycle * Math.PI)
      dummy.position.set(x, y, z)
      const size = (phase === 'working' ? 0.018 : 0.006) * fade
      dummy.scale.set(size * 0.65, size * 3.8, size * 0.65)
      dummy.updateMatrix()
      rain.current.setMatrixAt(index, dummy.matrix)
    }
    rain.current.instanceMatrix.needsUpdate = true

    for (let index = 0; index < vaporCount; index += 1) {
      const cycle = (time * (phase === 'working' ? 0.16 : 0.07) + index / vaporCount) % 1
      const river = RIVER_POINTS[index % RIVER_POINTS.length]
      dummy.position.set(
        river.x + (seeded(index, 94) - 0.5) * 0.5 + Math.sin(time * 0.35 + index) * 0.08,
        0.48 + cycle * 3.25,
        river.z + (seeded(index, 95) - 0.5) * 0.3,
      )
      const size = (0.04 + cycle * 0.09) * Math.sin(cycle * Math.PI)
      dummy.scale.set(size * 1.55, size * 0.72, size * 1.35)
      dummy.updateMatrix()
      vapor.current.setMatrixAt(index, dummy.matrix)
    }
    vapor.current.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <instancedMesh ref={rain} args={[undefined, undefined, rainCount]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color="#9cdcff" transparent opacity={0.68} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={vapor} args={[undefined, undefined, vaporCount]}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color="#c9dfe2" emissive="#6c95a1" emissiveIntensity={0.1} transparent opacity={0.08} depthWrite={false} roughness={1} />
      </instancedMesh>
    </>
  )
}

function GrowthRipples({ phase, runId }: { phase: Phase; runId: number }) {
  const rings = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (!rings.current) return
    const time = clock.getElapsedTime() + runId * 0.37
    rings.current.children.forEach((child, index) => {
      const cycle = (time * (phase === 'working' ? 0.36 : 0.08) + index / 3) % 1
      const scale = 0.28 + cycle * 2.2
      child.scale.setScalar(scale)
      const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial
      material.opacity = (phase === 'working' ? 0.34 : 0.08) * Math.pow(1 - cycle, 1.8)
    })
  })

  return (
    <group ref={rings} position={[-0.25, 0.31, 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
      {[0, 1, 2].map((index) => (
        <mesh key={index}>
          <ringGeometry args={[0.42, 0.455, 48]} />
          <meshBasicMaterial color="#79d8c6" transparent opacity={0.2} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

function Fire({ level, phase }: { level: number; phase: Phase }) {
  const flame = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime()
    const active = phase === 'working' ? 1.02 : 0.88
    const caretakerCycle = (time * 0.105) % 1
    const ignition = caretakerCycle >= 0.445 && caretakerCycle <= 0.565
      ? Math.sin(((caretakerCycle - 0.445) / 0.12) * Math.PI)
      : 0
    if (flame.current) {
      flame.current.scale.set(
        active * (0.72 + ignition * 0.22 + Math.sin(time * 8) * 0.05),
        active * (0.68 + level * 0.28 + ignition * 0.72 + Math.sin(time * 11) * 0.06),
        active * (0.72 + ignition * 0.2 + Math.cos(time * 7) * 0.05),
      )
      flame.current.rotation.y = Math.sin(time * 3.4) * 0.12
    }
    if (light.current) light.current.intensity = 4.2 + level * 4.6 + ignition * 10 + Math.sin(time * 9) * 0.6
  })

  return (
    <group position={[2.05, 0.34, 1.2]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]} receiveShadow>
        <circleGeometry args={[0.62, 32]} />
        <meshStandardMaterial color="#28231f" roughness={1} />
      </mesh>
      {Array.from({ length: 12 }, (_, index) => {
        const angle = index / 12 * Math.PI * 2
        return (
          <mesh
            key={index}
            position={[Math.cos(angle) * 0.61, 0.13, Math.sin(angle) * 0.61]}
            rotation={[seeded(index, 50) * 0.4, angle, seeded(index, 51) * 0.3]}
            scale={[0.2, 0.13 + seeded(index, 52) * 0.05, 0.16]}
            castShadow
          >
            <dodecahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color={index % 2 ? '#777263' : '#5f5d54'} roughness={0.98} />
          </mesh>
        )
      })}
      <group position={[0, 0.21, 0]}>
        <mesh rotation={[0.08, 0.65, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.105, 0.14, 0.92, 12]} />
          <meshStandardMaterial color="#513722" roughness={0.96} />
        </mesh>
        <mesh rotation={[-0.08, -0.65, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.105, 0.14, 0.92, 12]} />
          <meshStandardMaterial color="#654329" roughness={0.96} />
        </mesh>
        <mesh position={[0, 0.12, 0]} rotation={[Math.PI / 2, 0.05, 0]} castShadow>
          <cylinderGeometry args={[0.085, 0.11, 0.72, 12]} />
          <meshStandardMaterial color="#3f2e24" roughness={0.98} />
        </mesh>
      </group>
      <group ref={flame} position={[0, 0.58, 0]}>
        <mesh position={[0, 0.04, 0]} scale={[0.42, 0.9, 0.42]}>
          <sphereGeometry args={[0.62, 18, 20]} />
          <meshStandardMaterial color="#e96f28" emissive="#d84313" emissiveIntensity={2.2} transparent opacity={0.72} depthWrite={false} />
        </mesh>
        <mesh position={[-0.12, 0.28, 0.02]} scale={[0.24, 0.66, 0.24]} rotation={[0, 0, -0.18]}>
          <sphereGeometry args={[0.58, 16, 18]} />
          <meshStandardMaterial color="#ffb13d" emissive="#ed7118" emissiveIntensity={2.8} transparent opacity={0.82} depthWrite={false} />
        </mesh>
        <mesh position={[0.13, 0.18, 0.08]} scale={[0.19, 0.46, 0.19]} rotation={[0, 0, 0.22]}>
          <sphereGeometry args={[0.54, 16, 18]} />
          <meshStandardMaterial color="#ffe59b" emissive="#f2a51d" emissiveIntensity={3.2} transparent opacity={0.9} depthWrite={false} />
        </mesh>
      </group>
      <pointLight ref={light} position={[0, 1.0, 0]} color="#ff9f55" distance={5.5} decay={2} castShadow={false} />
      <FireSmoke phase={phase} />
    </group>
  )
}

function FireSmoke({ phase }: { phase: Phase }) {
  const group = useRef<THREE.Group>(null)
  const puffs = useMemo(() => Array.from({ length: 9 }, (_, index) => ({
    offset: index / 9,
    drift: seeded(index, 56) * 0.34 - 0.17,
    size: 0.13 + seeded(index, 57) * 0.16,
  })), [])

  useFrame(({ clock }) => {
    if (!group.current) return
    const time = clock.getElapsedTime()
    group.current.children.forEach((child, index) => {
      const puff = puffs[index]
      const cycle = (time * (phase === 'working' ? 0.18 : 0.12) + puff.offset) % 1
      child.position.set(puff.drift * cycle * 2, 1.1 + cycle * 2.1, Math.sin(time * 0.5 + index) * 0.08)
      child.scale.setScalar(puff.size * (0.5 + cycle * 1.4))
      const material = (child as THREE.Mesh).material as THREE.MeshStandardMaterial
      material.opacity = Math.sin(cycle * Math.PI) * 0.13
    })
  })

  return (
    <group ref={group}>
      {puffs.map((_, index) => (
        <mesh key={index}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#aaa7af" transparent opacity={0.1} depthWrite={false} roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

function EnergySparks({ phase, runId }: { phase: Phase; runId: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const count = 18

  useFrame(({ clock }) => {
    if (!mesh.current) return
    const time = clock.getElapsedTime() + runId * 0.31
    for (let index = 0; index < count; index += 1) {
      const cycle = (time * 0.45 + index / count) % 1
      const angle = cycle * Math.PI * 2 + seeded(index) * 0.8
      const fireX = 2.05
      const radius = (1 - cycle) * 2.2
      const x = fireX + Math.cos(angle) * radius
      const z = 1.2 + Math.sin(angle) * radius * 0.55
      const y = 0.85 + Math.sin(cycle * Math.PI) * 1.9 + seeded(index, 2) * 0.3
      const visible = phase === 'working' ? Math.sin(cycle * Math.PI) : 0.22
      dummy.position.set(x, y, z)
      dummy.scale.setScalar((0.018 + seeded(index, 3) * 0.038) * visible)
      dummy.updateMatrix()
      mesh.current.setMatrixAt(index, dummy.matrix)
    }
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 7, 7]} />
      <meshBasicMaterial color="#ffd27a" toneMapped={false} />
    </instancedMesh>
  )
}

function FuelSystem({ level, phase, runId }: { level: number; phase: Phase; runId: number }) {
  const liquid = useRef<THREE.Mesh>(null)
  const rotor = useRef<THREE.Group>(null)
  const flow = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const pipeCurve = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.35, 0.34, 0),
    new THREE.Vector3(0.56, 0.22, 0.02),
    new THREE.Vector3(0.78, 0.24, 0.02),
    new THREE.Vector3(0.9, 0.38, 0.02),
  ]), [])
  const pipeGeometry = useMemo(() => new THREE.TubeGeometry(pipeCurve, 28, 0.045, 9, false), [pipeCurve])
  const count = 18

  useFrame(({ clock }, delta) => {
    const time = clock.getElapsedTime()
    const fill = clamp(0.16 + level * 0.76 + (phase === 'working' ? Math.sin(time * 4.5) * 0.018 : 0))
    if (liquid.current) {
      liquid.current.scale.y = THREE.MathUtils.lerp(liquid.current.scale.y, fill, 1 - Math.exp(-delta * 5.5))
      liquid.current.position.y = 0.2 + liquid.current.scale.y * 0.48
      liquid.current.rotation.z = phase === 'working' ? Math.sin(time * 3.8) * 0.018 : 0
    }
    if (rotor.current) rotor.current.rotation.z -= delta * (phase === 'working' ? 8.5 : 1.2)

    if (flow.current) {
      for (let index = 0; index < count; index += 1) {
        const cycle = (time * (phase === 'working' ? 0.9 : 0.18) + index / count + runId * 0.1) % 1
        const point = pipeCurve.getPoint(cycle)
        dummy.position.copy(point)
        dummy.scale.setScalar(phase === 'working' ? 0.035 + Math.sin(cycle * Math.PI) * 0.025 : 0.008)
        dummy.updateMatrix()
        flow.current.setMatrixAt(index, dummy.matrix)
      }
      flow.current.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group position={[1.85, 0.27, 1.28]}>
      <mesh position={[0, 0.18, 0]} receiveShadow>
        <cylinderGeometry args={[0.52, 0.58, 0.16, 24]} />
        <meshStandardMaterial color="#303137" metalness={0.62} roughness={0.38} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.67, 0.67, 0.07, 24]} />
        <meshStandardMaterial color="#9b7438" emissive="#5f3d17" emissiveIntensity={0.35} metalness={0.72} roughness={0.24} />
      </mesh>
      <mesh position={[0, 0.8, 0]} castShadow>
        <cylinderGeometry args={[0.47, 0.47, 1.18, 32]} />
        <meshPhysicalMaterial
          color="#d4d8cf"
          transparent
          opacity={0.22}
          transmission={0.42}
          roughness={0.08}
          metalness={0.15}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={liquid} position={[0, 0.55, 0]} scale={[1, 0.3, 1]}>
        <cylinderGeometry args={[0.41, 0.41, 0.96, 32]} />
        <meshStandardMaterial color="#b96f20" emissive="#8f3b0c" emissiveIntensity={1.35} transparent opacity={0.82} roughness={0.28} />
      </mesh>
      <mesh position={[0, 1.43, 0]} castShadow>
        <cylinderGeometry args={[0.31, 0.45, 0.16, 24]} />
        <meshStandardMaterial color="#383a3e" metalness={0.7} roughness={0.32} />
      </mesh>
      <mesh position={[0, 1.57, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.16, 16]} />
        <meshStandardMaterial color="#c49a4a" metalness={0.62} roughness={0.3} />
      </mesh>
      {[
        [-0.47, 0.82, -0.32], [0.47, 0.82, -0.32], [-0.47, 0.82, 0.32], [0.47, 0.82, 0.32],
      ].map((position, index) => (
        <mesh key={index} position={position as [number, number, number]}>
          <cylinderGeometry args={[0.027, 0.035, 1.26, 10]} />
          <meshStandardMaterial color="#b98a42" metalness={0.75} roughness={0.25} />
        </mesh>
      ))}
      <mesh position={[0, 1.42, 0]}>
        <cylinderGeometry args={[0.57, 0.57, 0.08, 24]} />
        <meshStandardMaterial color="#a37839" metalness={0.72} roughness={0.23} />
      </mesh>
      <mesh position={[0, 1.77, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.66, 0.84, 1]}>
        <torusGeometry args={[0.25, 0.035, 10, 28]} />
        <meshStandardMaterial color="#b98a42" metalness={0.76} roughness={0.22} />
      </mesh>
      <mesh geometry={pipeGeometry}>
        <meshStandardMaterial color="#34363b" metalness={0.72} roughness={0.28} />
      </mesh>
      <instancedMesh ref={flow} args={[undefined, undefined, count]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color="#ffc65f" toneMapped={false} />
      </instancedMesh>

      <group position={[1.05, 0.42, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.78, 0.72, 0.66]} />
          <meshStandardMaterial color="#3e4743" metalness={0.45} roughness={0.54} />
        </mesh>
        <mesh position={[0, 0.06, 0.345]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 0.08, 24]} />
          <meshStandardMaterial color="#161b1c" metalness={0.58} roughness={0.32} />
        </mesh>
        <group ref={rotor} position={[0, 0.06, 0.4]}>
          {[0, 1, 2, 3].map((index) => (
            <mesh key={index} rotation={[0, 0, index * Math.PI / 2]} position={[0, 0.11, 0]}>
              <boxGeometry args={[0.055, 0.23, 0.045]} />
              <meshStandardMaterial color="#b8c0b8" metalness={0.7} roughness={0.28} />
            </mesh>
          ))}
          <mesh position={[0, 0, 0.02]}>
            <sphereGeometry args={[0.07, 14, 14]} />
            <meshStandardMaterial color="#d6a453" emissive="#9a5419" emissiveIntensity={phase === 'working' ? 1.8 : 0.45} />
          </mesh>
        </group>
        <mesh position={[0.2, 0.52, 0]}>
          <cylinderGeometry args={[0.07, 0.09, 0.48, 12]} />
          <meshStandardMaterial color="#272b2b" metalness={0.65} roughness={0.45} />
        </mesh>
        <mesh position={[0.2, 0.77, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.07, 0.24, 12]} />
          <meshStandardMaterial color="#272b2b" metalness={0.65} roughness={0.45} />
        </mesh>
      </group>
      <pointLight position={[0.25, 0.7, 0.2]} color="#ff9c3f" intensity={phase === 'working' ? 5.2 : 1.8} distance={3.8} decay={2} />
    </group>
  )
}

function Branch({ start, end, radius }: { start: [number, number, number]; end: [number, number, number]; radius: number }) {
  const transform = useMemo(() => {
    const from = new THREE.Vector3(...start)
    const to = new THREE.Vector3(...end)
    const direction = to.clone().sub(from)
    return {
      position: from.clone().add(to).multiplyScalar(0.5),
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()),
      length: direction.length(),
    }
  }, [start, end])

  return (
    <mesh position={transform.position} quaternion={transform.quaternion} castShadow>
      <cylinderGeometry args={[radius * 0.72, radius, transform.length, 9]} />
      <meshStandardMaterial color="#5a402c" roughness={0.94} />
    </mesh>
  )
}

function Tree({ level, phase, runId }: { level: number; phase: Phase; runId: number }) {
  const tree = useRef<THREE.Group>(null)
  const crown = useRef<THREE.Group>(null)
  const freshGrowth = useRef<THREE.Group>(null)
  const lastRun = useRef(runId)
  const growthStarted = useRef(-100)

  useFrame(({ clock }, delta) => {
    const time = clock.getElapsedTime()
    if (lastRun.current !== runId) {
      lastRun.current = runId
      growthStarted.current = time
      freshGrowth.current?.children.forEach((child) => child.scale.setScalar(0.001))
    }
    const target = 0.88 + level * 0.055 + (phase === 'working' ? 0.012 : 0)
    if (tree.current) {
      const current = tree.current.scale.x
      const next = THREE.MathUtils.lerp(current, target, 1 - Math.exp(-delta * 4.8))
      tree.current.scale.setScalar(next)
    }
    if (crown.current) crown.current.rotation.y = Math.sin(time * 0.3) * 0.04
    if (freshGrowth.current && growthStarted.current > 0) {
      freshGrowth.current.children.forEach((child, index) => {
        const progress = clamp((time - growthStarted.current - 0.16 - index * 0.075) / 0.72)
        const overshoot = progress < 0.72
          ? 1.08 * (progress / 0.72)
          : THREE.MathUtils.lerp(1.08, 1, (progress - 0.72) / 0.28)
        const base = index % 3 === 0 ? [0.32, 0.21, 0.29] : [0.29, 0.19, 0.26]
        child.scale.set(base[0] * Math.max(0.001, overshoot), base[1] * Math.max(0.001, overshoot), base[2] * Math.max(0.001, overshoot))
      })
      freshGrowth.current.rotation.y = Math.sin(time * 0.7) * 0.025
    }
  })

  const crownParts: Array<[number, number, number, number]> = [
    [0, 2.72, 0, 0.56], [-0.48, 2.63, 0.16, 0.52], [0.5, 2.66, 0.12, 0.54],
    [-0.84, 2.4, 0.04, 0.48], [0.87, 2.42, -0.02, 0.5], [-0.26, 2.98, -0.28, 0.48],
    [0.28, 3.0, -0.24, 0.5], [0.02, 2.42, 0.48, 0.5], [0.04, 3.28, 0.02, 0.43],
    [-1.08, 2.24, -0.12, 0.38], [1.08, 2.25, -0.15, 0.4], [-0.68, 2.82, -0.25, 0.42],
    [0.72, 2.82, -0.2, 0.44], [-0.56, 2.28, 0.48, 0.41], [0.56, 2.32, 0.46, 0.42],
    [-0.08, 3.05, 0.36, 0.4], [0.04, 2.18, 0.62, 0.38], [-0.98, 2.55, 0.28, 0.36],
    [0.98, 2.56, 0.22, 0.37], [0.02, 3.42, -0.08, 0.34],
  ]

  return (
    <group ref={tree} position={[0.45, 0.3, 0.38]}>
      <Branch start={[0, 0, 0]} end={[0, 2.25, 0]} radius={0.24} />
      <Branch start={[0, 1.35, 0]} end={[-0.84, 2.25, 0.02]} radius={0.13} />
      <Branch start={[0, 1.5, 0]} end={[0.9, 2.32, -0.08]} radius={0.13} />
      <Branch start={[0, 1.7, 0]} end={[-0.38, 2.75, -0.32]} radius={0.1} />
      <Branch start={[0.04, 1.72, 0]} end={[0.4, 2.72, 0.32]} radius={0.1} />
      <Branch start={[-0.6, 2.08, 0.02]} end={[-1.05, 2.52, 0.2]} radius={0.07} />
      <Branch start={[0.65, 2.12, -0.05]} end={[1.07, 2.5, 0.18]} radius={0.07} />
      <Branch start={[0, 0.18, 0]} end={[-0.72, 0.04, 0.3]} radius={0.08} />
      <Branch start={[0, 0.16, 0]} end={[0.7, 0.04, 0.28]} radius={0.08} />
      <Branch start={[0, 0.14, 0]} end={[-0.18, 0.03, -0.7]} radius={0.07} />
      <group ref={crown} scale={[0.94, 0.86, 0.92]}>
        {crownParts.map(([x, y, z, size], index) => (
          <mesh
            key={index}
            position={[x, y, z]}
            rotation={[seeded(index, 60) * 0.5, seeded(index, 61) * Math.PI, seeded(index, 62) * 0.35]}
            scale={[size * (1.05 + seeded(index, 63) * 0.18), size * (0.82 + seeded(index, 64) * 0.22), size]}
            castShadow
          >
            <icosahedronGeometry args={[1, 2]} />
            <meshStandardMaterial
              color={index % 4 === 0 ? '#71855d' : index % 4 === 1 ? '#87986a' : index % 4 === 2 ? '#587152' : '#687e58'}
              roughness={0.86}
            />
          </mesh>
        ))}
        {phase === 'complete' && Array.from({ length: 18 }, (_, index) => {
          const angle = seeded(index, 66) * Math.PI * 2
          const radius = 0.5 + seeded(index, 67) * 0.8
          return (
            <mesh key={`blossom-${index}`} position={[Math.cos(angle) * radius, 2.45 + seeded(index, 68) * 0.9, Math.sin(angle) * radius * 0.58]} scale={0.035 + seeded(index, 69) * 0.035}>
              <sphereGeometry args={[1, 10, 10]} />
              <meshStandardMaterial color="#d8e2b2" emissive="#849569" emissiveIntensity={0.3} />
            </mesh>
          )
        })}
        <group ref={freshGrowth}>
          {[
            [-1.22, 2.46, 0.14], [1.22, 2.48, 0.1], [-0.77, 3.08, -0.18],
            [0.8, 3.1, -0.14], [0.03, 3.56, -0.03], [-0.6, 2.24, 0.65],
            [0.64, 2.28, 0.64], [-0.08, 3.18, 0.5], [0.1, 2.08, 0.78],
          ].map((position, index) => (
            <mesh key={index} position={position as [number, number, number]} scale={[0.3, 0.2, 0.27]} castShadow>
              <icosahedronGeometry args={[1, 2]} />
              <meshStandardMaterial color={index % 2 ? '#87aa70' : '#9cba79'} emissive="#506c45" emissiveIntensity={0.12} roughness={0.88} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  )
}

function CarbonMotes({ level, phase, runId }: { level: number; phase: Phase; runId: number }) {
  const group = useRef<THREE.Group>(null)
  const count = 18
  const motes = useMemo(() => Array.from({ length: count }, (_, index) => ({
    angle: seeded(index, 2) * Math.PI * 2,
    radius: 2.1 + seeded(index, 3) * 1.15,
    height: 2.35 + seeded(index, 4) * 1.65,
    size: 0.055 + seeded(index, 5) * 0.075,
    speed: 0.22 + seeded(index, 6) * 0.2,
  })), [])

  useFrame(({ clock }) => {
    if (!group.current) return
    const time = clock.getElapsedTime() + runId
    group.current.children.forEach((child, index) => {
      const mote = motes[index]
      const cycle = (time * mote.speed + index / count) % 1
      const radius = mote.radius * (phase === 'working' ? 0.12 + (1 - cycle) * 0.98 : 1)
      const angle = mote.angle + time * mote.speed * 0.7
      child.position.set(
        0.55 + Math.cos(angle) * radius,
        phase === 'working'
          ? 2.65 + (mote.height - 2.65) * (1 - cycle) + Math.sin(time + index) * 0.1
          : mote.height + Math.sin(time * 0.8 + index) * 0.16,
        0.45 + Math.sin(angle) * radius * 0.72,
      )
      const visible = (0.5 + level * 0.65 + (phase === 'working' ? 0.28 : 0)) * (phase === 'working' ? Math.sin(cycle * Math.PI) : 1)
      child.scale.setScalar(mote.size * visible)
      child.rotation.x = time * 0.2 + index
      child.rotation.y = time * 0.14 + index
    })
  })

  return (
    <group ref={group}>
      {motes.map((_, index) => (
        <mesh key={index}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color="#a78bd4"
            emissive="#6550a5"
            emissiveIntensity={0.72}
            transparent
            opacity={0.26}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}

function Companion({ phase }: { phase: Phase }) {
  const robot = useRef<THREE.Group>(null)
  const visor = useRef<THREE.MeshStandardMaterial>(null)
  const leftLeg = useRef<THREE.Group>(null)
  const rightLeg = useRef<THREE.Group>(null)
  const leftArm = useRef<THREE.Group>(null)
  const rightArm = useRef<THREE.Group>(null)
  const carriedLog = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime()
    if (!robot.current) return
    const cycle = (time * 0.105) % 1
    const outbound = cycle < 0.38
    const placing = cycle >= 0.38 && cycle < 0.54
    const returning = cycle >= 0.54 && cycle < 0.9
    const moveProgress = outbound
      ? THREE.MathUtils.smoothstep(cycle / 0.38, 0, 1)
      : returning
        ? 1 - THREE.MathUtils.smoothstep((cycle - 0.54) / 0.36, 0, 1)
        : placing ? 1 : 0
    const startX = -2.48
    const endX = 1.36
    robot.current.position.x = THREE.MathUtils.lerp(startX, endX, moveProgress)
    robot.current.position.z = 1.56 + Math.sin(moveProgress * Math.PI) * 0.16
    robot.current.position.y = 0.34 + ((outbound || returning) ? Math.abs(Math.sin(time * 8.4)) * 0.035 : 0)
    robot.current.rotation.y = returning ? -Math.PI / 2 : Math.PI / 2
    robot.current.rotation.z = placing ? -0.13 * Math.sin(((cycle - 0.38) / 0.16) * Math.PI) : 0
    const stride = (outbound || returning) ? Math.sin(time * 8.4) * 0.62 : 0
    if (leftLeg.current) leftLeg.current.rotation.x = stride
    if (rightLeg.current) rightLeg.current.rotation.x = -stride
    if (leftArm.current) leftArm.current.rotation.x = -0.78 - stride * 0.18
    if (rightArm.current) rightArm.current.rotation.x = -0.78 + stride * 0.18
    if (carriedLog.current) {
      const hasLog = outbound || cycle < 0.45 || cycle >= 0.9
      carriedLog.current.scale.setScalar(hasLog ? 1 : 0.001)
    }
    if (visor.current) visor.current.emissiveIntensity = phase === 'working' ? 2.4 + Math.sin(time * 6) * 0.5 : 1.3
  })

  return (
    <>
      <group position={[-2.55, 0.36, 1.7]} rotation={[0, 0.18, 0]}>
        {[-0.28, 0.28].map((x, index) => (
          <mesh key={x} position={[x, index * 0.08, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.1, 0.13, 0.78, 10]} />
            <meshStandardMaterial color={index ? '#59402d' : '#6d4a2f'} roughness={0.96} />
          </mesh>
        ))}
        <mesh position={[0, 0.14, -0.2]} rotation={[Math.PI / 2, 0.3, 0]} castShadow><cylinderGeometry args={[0.095, 0.12, 0.72, 10]} /><meshStandardMaterial color="#48352a" roughness={0.98} /></mesh>
      </group>
      <group ref={robot} position={[-2.48, 0.34, 1.56]} scale={0.64}>
      <mesh position={[0, 1.32, 0]} castShadow>
        <sphereGeometry args={[0.48, 28, 28]} />
        <meshStandardMaterial color="#e9ece9" metalness={0.16} roughness={0.24} emissive="#b7c9ff" emissiveIntensity={0.32} />
      </mesh>
      <mesh position={[0, 0.74, 0]} castShadow>
        <capsuleGeometry args={[0.29, 0.38, 8, 16]} />
        <meshStandardMaterial color="#d9dcda" metalness={0.22} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.34, 0.39]} scale={[0.7, 0.38, 0.12]}>
        <sphereGeometry args={[0.4, 24, 16]} />
        <meshStandardMaterial ref={visor} color="#11141a" emissive="#5e8ca8" emissiveIntensity={1.3} roughness={0.15} />
      </mesh>
      <mesh position={[-0.105, 1.34, 0.442]}>
        <circleGeometry args={[0.018, 16]} />
        <meshBasicMaterial color="#baf8dc" toneMapped={false} />
      </mesh>
      <mesh position={[0.105, 1.34, 0.442]}>
        <circleGeometry args={[0.018, 16]} />
        <meshBasicMaterial color="#baf8dc" toneMapped={false} />
      </mesh>
      <group ref={leftLeg} position={[-0.16, 0.43, 0]}>
        <mesh position={[0, -0.24, 0]}><capsuleGeometry args={[0.105, 0.34, 6, 12]} /><meshStandardMaterial color="#cdd2ce" metalness={0.22} roughness={0.32} /></mesh>
        <mesh position={[0, -0.48, 0.1]} scale={[0.85, 0.55, 1.35]}><sphereGeometry args={[0.16, 12, 8]} /><meshStandardMaterial color="#b9bfbc" metalness={0.28} roughness={0.34} /></mesh>
      </group>
      <group ref={rightLeg} position={[0.16, 0.43, 0]}>
        <mesh position={[0, -0.24, 0]}><capsuleGeometry args={[0.105, 0.34, 6, 12]} /><meshStandardMaterial color="#cdd2ce" metalness={0.22} roughness={0.32} /></mesh>
        <mesh position={[0, -0.48, 0.1]} scale={[0.85, 0.55, 1.35]}><sphereGeometry args={[0.16, 12, 8]} /><meshStandardMaterial color="#b9bfbc" metalness={0.28} roughness={0.34} /></mesh>
      </group>
      <group ref={leftArm} position={[-0.35, 0.92, 0]} rotation={[-0.78, 0, -0.2]}><mesh position={[0, -0.22, 0.14]}><capsuleGeometry args={[0.09, 0.34, 6, 12]} /><meshStandardMaterial color="#d9dcda" roughness={0.3} /></mesh></group>
      <group ref={rightArm} position={[0.35, 0.92, 0]} rotation={[-0.78, 0, 0.2]}><mesh position={[0, -0.22, 0.14]}><capsuleGeometry args={[0.09, 0.34, 6, 12]} /><meshStandardMaterial color="#d9dcda" roughness={0.3} /></mesh></group>
      <group ref={carriedLog} position={[0, 0.72, 0.48]} rotation={[0, 0, Math.PI / 2]}>
        <mesh castShadow><cylinderGeometry args={[0.1, 0.13, 0.72, 10]} /><meshStandardMaterial color="#68462e" roughness={0.97} /></mesh>
        <mesh position={[0, 0.37, 0]}><cylinderGeometry args={[0.09, 0.09, 0.014, 12]} /><meshStandardMaterial color="#b58b62" roughness={0.92} /></mesh>
      </group>
      <pointLight position={[0, 1.25, 0.4]} color="#96c8ff" distance={2.2} intensity={2.6} />
      </group>
    </>
  )
}

function CloudBackdrop({ phase }: { phase: Phase }) {
  const clouds = useRef<THREE.Group>(null)
  const puffs = useMemo(() => [
    [-2.45, 0.35, 0.72], [-1.95, 0.82, 0.84], [-1.35, 1.05, 0.68], [-0.72, 1.18, 0.83],
    [0, 1.22, 0.78], [0.75, 1.15, 0.82], [1.45, 1.02, 0.7], [2.12, 0.68, 0.8],
    [2.48, 0.12, 0.58], [-2.55, -0.18, 0.52], [-1.72, -0.45, 0.45], [1.66, -0.34, 0.48],
    [0.95, -0.58, 0.43], [-0.92, -0.56, 0.4], [0.22, -0.7, 0.36], [-0.22, 1.48, 0.42],
  ], [])

  useFrame(({ clock }) => {
    if (!clouds.current) return
    const time = clock.getElapsedTime()
    clouds.current.rotation.y = Math.sin(time * 0.08) * 0.035
    clouds.current.position.y = 3.05 + Math.sin(time * (phase === 'working' ? 0.35 : 0.16)) * 0.06
    clouds.current.children.forEach((child, index) => {
      child.position.y = puffs[index][1] + Math.sin(time * 0.42 + index) * 0.035
      child.rotation.x = time * 0.05 + index
      child.rotation.y = time * 0.04 - index
    })
  })

  return (
    <group ref={clouds} position={[0.45, 2.9, -2.35]} scale={0.84}>
      {puffs.map(([x, y, size], index) => (
        <mesh
          key={index}
          position={[x, y, index % 2 ? 0.25 : -0.05]}
          scale={[size * 1.04, size * 0.62, size * 0.8]}
        >
          <icosahedronGeometry args={[1, 2]} />
          <meshStandardMaterial
            color={index % 3 === 0 ? '#806ba4' : index % 3 === 1 ? '#6e6294' : '#8b78ad'}
            emissive="#4d3e70"
            emissiveIntensity={0.32}
            transparent
            opacity={0.12}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}

function Scene({ phase, runId, levels }: Omit<Props, 'mode'>) {
  return (
    <>
      <CameraRig phase={phase} />
      <ambientLight intensity={0.58} color="#a9b4d1" />
      <hemisphereLight args={['#b7c7ea', '#29241c', 1.35]} />
      <directionalLight
        position={[-5, 8, 6]}
        intensity={3.7}
        color="#e2e9ff"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={18}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
      />
      <pointLight position={[4, 5, -3]} color="#a780ff" intensity={8} distance={13} />
      <pointLight position={[-5, 2, 4]} color="#69b9e8" intensity={3.8} distance={11} />
      <pointLight position={[-3.5, -2.6, 4]} color="#6ca69a" intensity={3.1} distance={11} />
      <pointLight position={[2, -2.2, 4]} color="#568cc2" intensity={2.3} distance={10} />

      <Stars radius={38} depth={16} count={750} factor={1.7} saturation={0.25} fade speed={0.25} />
      <Sparkles count={36} scale={[9, 6, 7]} size={1.2} speed={0.18} opacity={0.32} color="#b9c7ff" />

      <group position={[0, -0.6, 0]} rotation={[0, -0.11, 0]}>
        <CloudBackdrop phase={phase} />
        <Island />
        <Grass level={levels.water} phase={phase} runId={runId} />
        <Undergrowth level={levels.water} phase={phase} />
        <WaterStream active={phase === 'working'} />
        <Waterfall active={phase === 'working'} />
        <RiverBanks />
        <WaterCycle phase={phase} runId={runId} />
        <GrowthRipples phase={phase} runId={runId} />
        <Fire level={levels.energy} phase={phase} />
        <EnergySparks phase={phase} runId={runId} />
        <Tree level={levels.co2} phase={phase} runId={runId} />
        <CarbonMotes level={levels.co2} phase={phase} runId={runId} />
        <Companion phase={phase} />
      </group>

      <ContactShadows position={[0, -1.65, 0]} scale={13} opacity={0.36} blur={2.8} far={4.5} color="#000000" />

      <EffectComposer multisampling={0}>
        <Bloom intensity={0.95} luminanceThreshold={0.72} luminanceSmoothing={0.72} mipmapBlur />
        <Vignette eskil={false} offset={0.18} darkness={0.58} />
      </EffectComposer>
    </>
  )
}

export default function GardenWorld({ phase, runId, levels }: Props) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      shadows
      camera={{ position: [0, 5, 11.65], fov: 42, near: 0.1, far: 80 }}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.08
      }}
    >
      <color attach="background" args={['#08090d']} />
      <fog attach="fog" args={['#08090d', 11, 30]} />
      <Suspense fallback={null}>
        <Scene phase={phase} runId={runId} levels={levels} />
      </Suspense>
    </Canvas>
  )
}
