// The 3D PC. The model comes from models/make-pc.py (Blender) as one GLB with every part and every
// shape variant; here we show only the parts of the current build, light them up on hover and
// fly the picked part out toward the viewer. Units are centimetres, the glass side faces +Z.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
// inlined: the packaged app runs from file://, where fetch() can't read files
import pcGlb from '../assets/pc.glb?inline'
import type { Build, DiskKind, Slot } from './catalog'

export interface Pick {
  slot: Slot
  /** which drive, for storage */
  index?: number
}

export function samePick(a: Pick | null, b: Pick | null): boolean {
  return a === b || (!!a && !!b && a.slot === b.slot && (a.index ?? 0) === (b.index ?? 0))
}

// ---- loading the model once

interface PartRig {
  key: string
  /** case | glass | shroud | mobo | cpu | cooler | ram | gpu | psu | ssd_m2 | ssd_sata | hdd */
  kind: string
  slot: number
  pivot: THREE.Group
  center: THREE.Vector3
  /** materials that light up on hover (not the RGB ones) */
  glowMats: THREE.MeshStandardMaterial[]
  allMats: THREE.MeshStandardMaterial[]
  glow: number
  fade: number
}

interface Rotor {
  obj: THREE.Object3D
  /** the fan's own axis (local), found from its flat shape */
  axis: THREE.Vector3
  kind: string
}

interface Rig {
  parts: Map<string, PartRig>
  rotors: Rotor[]
}

function spinAxis(o: THREE.Object3D): THREE.Vector3 {
  const box = new THREE.Box3()
  o.traverse((c) => {
    const m = c as THREE.Mesh
    if (!m.isMesh) return
    m.geometry.computeBoundingBox()
    const b = m.geometry.boundingBox!.clone()
    if (c !== o) b.applyMatrix4(c.matrix)
    box.union(b)
  })
  const s = box.getSize(new THREE.Vector3())
  return s.x <= s.y && s.x <= s.z ? new THREE.Vector3(1, 0, 0) : s.y <= s.z ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1)
}

function makeRig(gltf: GLTF): Rig {
  const parts = new Map<string, PartRig>()
  const rotors: Rotor[] = []
  gltf.scene.updateMatrixWorld(true)
  for (const node of [...gltf.scene.children]) {
    const kind = node.userData.part as string | undefined
    if (!kind) continue
    // a pivot at the part's middle, so it can turn around itself while flying
    const center = new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3())
    const pivot = new THREE.Group()
    pivot.position.copy(center)
    pivot.userData.key = node.name
    node.position.sub(center)
    pivot.add(node)

    const clones = new Map<string, THREE.MeshStandardMaterial>()
    const glowMats: THREE.MeshStandardMaterial[] = []
    const allMats: THREE.MeshStandardMaterial[] = []
    node.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const src = mesh.material as THREE.MeshStandardMaterial
      let m = clones.get(src.uuid)
      if (!m) {
        if (kind === 'glass' && src.name === 'glass') {
          // dark tinted glass like real cases: dims the inside a little and shows soft reflections
          m = new THREE.MeshPhysicalMaterial({ color: 0x0b1114, roughness: 0.04, metalness: 0, envMapIntensity: 1.1, side: THREE.DoubleSide })
          m.userData.base = 0.3
        } else {
          m = src.clone()
          m.userData.base = 1
        }
        m.opacity = m.userData.base as number
        m.transparent = m.opacity < 1
        m.depthWrite = !m.transparent
        clones.set(src.uuid, m)
        allMats.push(m)
        if (m.emissive.getHex() === 0) glowMats.push(m)
      }
      mesh.material = m
      if (kind === 'glass') {
        mesh.raycast = () => {}
      } else {
        mesh.castShadow = true
        mesh.receiveShadow = true
      }
    })
    node.traverse((o) => {
      if (o.userData.spin) rotors.push({ obj: o, axis: spinAxis(o), kind })
    })
    parts.set(node.name, { key: node.name, kind, slot: Number(node.userData.slot ?? 0), pivot, center, glowMats, allMats, glow: 0, fade: 1 })
  }
  return { parts, rotors }
}

let rigPromise: Promise<Rig> | null = null

function loadRig(): Promise<Rig> {
  rigPromise ??= new Promise<GLTF>((resolve, reject) => {
    const bin = atob(pcGlb.slice(pcGlb.indexOf(',') + 1))
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    new GLTFLoader().parse(bytes.buffer, '', resolve, reject)
  }).then(makeRig)
  return rigPromise
}

// ---- which models a build shows

const RAM_SLOTS: Record<number, number[]> = { 1: [2], 2: [2, 4], 3: [1, 2, 4], 4: [1, 2, 3, 4] }
const DISK_KIND: Record<DiskKind, string> = { m2: 'ssd_m2', sata: 'ssd_sata', hdd: 'hdd' }

function shownKeys(b: Build): string[] {
  const keys = ['case', 'glass', 'shroud', 'mobo', 'cpu', 'psu', b.cooler.cooler === 'box' ? 'cooler_box' : 'cooler_tower', `gpu_${b.gpu.fans ?? 2}`]
  for (const s of RAM_SLOTS[b.ram.sticks ?? 2] ?? [2, 4]) keys.push(`ram_${s}`)
  for (const kind of new Set(b.storage.map((d) => d.disk ?? 'sata'))) keys.push(DISK_KIND[kind])
  return keys
}

/** model kind → what the user picked */
function pickOfKind(kind: string, b: Build): Pick | null {
  if (kind === 'glass') return null
  if (kind === 'shroud') return { slot: 'psu' }
  const disk = (Object.keys(DISK_KIND) as DiskKind[]).find((d) => DISK_KIND[d] === kind)
  if (disk) return { slot: 'storage', index: Math.max(0, b.storage.findIndex((d) => (d.disk ?? 'sata') === disk)) }
  return { slot: kind as Slot }
}

/** what the user picked → the model kind that flies out */
function kindOfPick(p: Pick, b: Build): string {
  if (p.slot === 'storage') return DISK_KIND[b.storage[p.index ?? 0]?.disk ?? 'sata']
  return p.slot
}

// ---- where parts go

type V3 = [number, number, number]
interface Move {
  p: V3
  r?: V3
}
const STAY: Move = { p: [0, 0, 0] }

const FLY: Record<string, Move> = {
  cooler: { p: [0, 8, 26], r: [0, -0.45, 0] },
  cpu: { p: [2, 3, 34], r: [0.35, 0.5, 0] },
  ram: { p: [0, 16, 15] },
  gpu: { p: [6, -2, 26], r: [-1.0, 0, 0] },
  psu: { p: [8, 12, 30], r: [-0.8, 0.4, 0] },
  hdd: { p: [0, 15, 30], r: [0.5, 0, 0] },
  ssd_sata: { p: [0, 13, 24], r: [0.7, 0, 0] },
  ssd_m2: { p: [0, 5, 20] },
  mobo: { p: [0, 0, 14] }
}

const EXPLODE: Record<string, Move> = {
  cooler: { p: [0, 14, 30], r: [0, -0.45, 0] },
  cpu: { p: [-8, 6, 30], r: [0.35, 0.5, 0] },
  ram: { p: [10, 10, 22] },
  gpu: { p: [0, -4, 32], r: [-1.0, 0, 0] },
  psu: { p: [-16, -2, 34], r: [-0.8, 0.4, 0] },
  hdd: { p: [18, 0, 34], r: [0.5, 0, 0] },
  ssd_sata: { p: [20, 10, 28], r: [0.7, 0, 0] },
  ssd_m2: { p: [-12, 6, 24] },
  mobo: { p: [0, 0, 8] }
}

const ON_BOARD = new Set(['mobo', 'cpu', 'cooler', 'ram', 'gpu', 'ssd_m2'])

function moveFor(part: PartRig, pick: Pick | null, exploded: boolean, b: Build): Move {
  let mv = STAY
  if (exploded) mv = EXPLODE[part.kind] ?? STAY
  else if (pick) {
    const want = kindOfPick(pick, b)
    if (want === 'mobo') mv = ON_BOARD.has(part.kind) ? FLY.mobo : STAY
    else if (want === 'cpu' && part.kind === 'cooler') mv = { p: [0, 24, 38], r: [0, -0.45, 0] }
    else if (want === part.kind) mv = FLY[part.kind] ?? STAY
  }
  if (part.kind === 'ram' && mv !== STAY) {
    // sticks fan out a little so you can see each one
    const s = part.slot - 2.5
    return { p: [mv.p[0] + s * 3.2, mv.p[1] + Math.abs(s) * 0.8, mv.p[2] + s * 0.6], r: [0, s * 0.12, 0] }
  }
  return mv
}

function fadeFor(part: PartRig, pick: Pick | null, exploded: boolean, b: Build): number {
  const open = exploded || !!pick
  if (part.kind === 'glass') return open ? 0 : 1
  if (part.kind === 'shroud') {
    const want = pick ? kindOfPick(pick, b) : ''
    return exploded || want === 'psu' || want === 'hdd' ? 0.12 : 1
  }
  return 1
}

// ---- scene

const TEAL = new THREE.Color('#528a9a')
const CENTER = new THREE.Vector3(0, 23, 0)

interface StageProps {
  rig: Rig
  build: Build
  pick: Pick | null
  hover: Pick | null
  exploded: boolean
  /** live fan speed of the real video card (rpm), null = unknown */
  gpuRpm: number | null
  onHover: (p: Pick | null) => void
  onPick: (p: Pick | null) => void
}

function Stage({ rig, build, pick, hover, exploded, gpuRpm, onHover, onPick }: StageProps): ReactNode {
  const { camera, gl, scene } = useThree()
  const shown = useMemo(() => shownKeys(build), [build])
  const shownSet = useMemo(() => new Set(shown), [shown])
  const hoverKind = hover ? kindOfPick(hover, build) : null
  const tmp = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    scene.environmentIntensity = 0.75
    return () => {
      scene.environment = null
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])

  const controls = useMemo(() => {
    const c = new OrbitControls(camera, gl.domElement)
    c.target.copy(CENTER)
    c.enableDamping = true
    c.dampingFactor = 0.08
    c.enablePan = false
    c.minDistance = 35
    c.maxDistance = 200
    c.maxPolarAngle = Math.PI * 0.54
    c.rotateSpeed = 0.7
    return c
  }, [camera, gl])

  // camera glides to the picked part; any drag by the user stops the glide
  const focus = useRef({ until: 0, target: CENTER.clone(), dist: 122 })
  useEffect(() => {
    const stop = (): void => {
      focus.current.until = 0
    }
    controls.addEventListener('start', stop)
    return () => {
      controls.removeEventListener('start', stop)
      controls.dispose()
    }
  }, [controls])

  useEffect(() => {
    const f = focus.current
    f.until = performance.now() + 1500
    const want = pick && !exploded ? kindOfPick(pick, build) : null
    const part = want && want !== 'case' ? [...rig.parts.values()].find((p) => p.kind === want && shownSet.has(p.key)) : undefined
    if (part) {
      const mv = moveFor(part, pick, false, build)
      f.target.copy(part.center).add(tmp.set(...mv.p)).lerp(CENTER, 0.35)
      f.dist = want === 'mobo' ? 95 : 72
    } else {
      f.target.copy(CENTER)
      if (exploded) f.target.z += 14
      f.dist = exploded ? 160 : 122
    }
  }, [pick, exploded, build, rig, shownSet, tmp])

  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 6)
    for (const part of rig.parts.values()) {
      if (!shownSet.has(part.key)) continue
      const mv = moveFor(part, pick, exploded, build)
      part.pivot.position.lerp(tmp.set(...mv.p).add(part.center), k)
      const r = mv.r ?? STAY.p
      const rot = part.pivot.rotation
      rot.set(rot.x + (r[0] - rot.x) * k, rot.y + (r[1] - rot.y) * k, rot.z + (r[2] - rot.z) * k)

      const lit = hoverKind === part.kind || (hoverKind === 'psu' && part.kind === 'shroud') ? 1 : 0
      part.glow += (lit - part.glow) * Math.min(1, k * 1.6)
      for (const m of part.glowMats) m.emissive.copy(TEAL).multiplyScalar(part.glow * 0.35)

      const fade = fadeFor(part, pick, exploded, build)
      if (Math.abs(fade - part.fade) > 0.001) {
        part.fade += (fade - part.fade) * k
        for (const m of part.allMats) {
          const base = m.userData.base as number
          m.opacity = base * part.fade
          m.transparent = base * part.fade < 0.999
          m.depthWrite = !m.transparent
        }
        part.pivot.visible = part.fade > 0.01
      }
    }

    // fans: the video card's ones follow its real speed (they stop when the card is cool)
    const gpuSpin = build.gpu.mine && gpuRpm != null ? Math.min(gpuRpm, 3600) * 0.0025 : 5
    for (const r of rig.rotors) {
      const speed = r.kind === 'gpu' ? gpuSpin : r.kind === 'psu' ? 3 : r.kind === 'cooler' ? 6 : 4
      r.obj.rotateOnAxis(r.axis, -speed * dt)
    }

    const f = focus.current
    if (performance.now() < f.until) {
      controls.target.lerp(f.target, k * 0.8)
      const d = camera.position.distanceTo(controls.target)
      const dir = tmp.copy(camera.position).sub(controls.target).normalize()
      camera.position.copy(controls.target).addScaledVector(dir, d + (f.dist - d) * k * 0.8)
    }
    controls.update()
  })

  const keyOf = (o: THREE.Object3D | null): string | null => {
    for (let x = o; x; x = x.parent) if (x.userData.key) return x.userData.key as string
    return null
  }
  const pickAt = (e: ThreeEvent<PointerEvent | MouseEvent>): Pick | null => {
    const key = keyOf(e.object)
    const part = key ? rig.parts.get(key) : undefined
    return part ? pickOfKind(part.kind, build) : null
  }

  return (
    <>
      <color attach="background" args={['#1b1b21']} />
      <ambientLight intensity={0.12} />
      <directionalLight
        position={[45, 90, 80]}
        intensity={2.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={60}
        shadow-camera-bottom={-20}
        shadow-camera-near={1}
        shadow-camera-far={300}
      />
      <directionalLight position={[-70, 40, 30]} intensity={0.5} color="#bcd6ff" />
      <pointLight position={[0, 26, -1]} intensity={0.9} decay={0} distance={40} color="#7fd6ee" />
      <Podium />
      <group
        onPointerMove={(e) => {
          e.stopPropagation()
          const p = pickAt(e)
          if (!samePick(p, hover)) onHover(p)
          gl.domElement.style.cursor = p ? 'pointer' : ''
        }}
        onPointerOut={() => {
          onHover(null)
          gl.domElement.style.cursor = ''
        }}
        onClick={(e) => {
          e.stopPropagation()
          if (e.delta > 6) return
          onPick(pickAt(e))
        }}
      >
        {shown.map((key) => {
          const part = rig.parts.get(key)
          return part ? <primitive key={key} object={part.pivot} /> : null
        })}
      </group>
    </>
  )
}

function Podium(): ReactNode {
  return (
    <group>
      <mesh position={[0, -1.2, 0]} receiveShadow>
        <cylinderGeometry args={[34, 36, 2.4, 96]} />
        <meshStandardMaterial color="#1d1d23" metalness={0.6} roughness={0.32} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[32.6, 33.3, 128]} />
        <meshStandardMaterial color="#000000" emissive="#7db4c2" emissiveIntensity={2.2} />
      </mesh>
    </group>
  )
}

export interface PcSceneProps extends Omit<StageProps, 'rig'> {
  onReady?: () => void
}

export function PcScene({ onReady, ...props }: PcSceneProps): ReactNode {
  const [rig, setRig] = useState<Rig | null>(null)
  const down = useRef<[number, number]>([0, 0])

  useEffect(() => {
    let alive = true
    void loadRig().then((r) => {
      if (!alive) return
      setRig(r)
      onReady?.()
    })
    return () => {
      alive = false
    }
  }, [onReady])

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [50, 45, 109], fov: 32, near: 1, far: 1000 }}
      gl={{ antialias: false }}
      onPointerDown={(e) => {
        down.current = [e.clientX, e.clientY]
      }}
      onPointerMissed={(e) => {
        // a drag that ends on empty space turns the camera, it shouldn't drop the picked part
        if (Math.hypot(e.clientX - down.current[0], e.clientY - down.current[1]) < 6) props.onPick(null)
      }}
    >
      {rig && <Stage rig={rig} {...props} />}
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.82} luminanceSmoothing={0.2} />
        <Vignette offset={0.32} darkness={0.5} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </Canvas>
  )
}
