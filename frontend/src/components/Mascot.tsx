import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useLoader } from '@react-three/fiber'
import { Center, OrbitControls } from '@react-three/drei'
import { GripHorizontal } from 'lucide-react'
import { motion, useAnimationControls, useDragControls } from 'framer-motion'
import { MTLLoader, OBJLoader } from 'three-stdlib'
import { useLanguage } from '../lib/i18n/LanguageContext'
import './Mascot.css'

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const listener = (e: MediaQueryListEvent) => setReduced(e.matches)
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }, [])
  return reduced
}

function HamsterModel() {
  const materials = useLoader(MTLLoader, '/models/hamster-low-poly.mtl')
  const obj = useLoader(OBJLoader, '/models/hamster-low-poly.obj', (loader) => {
    materials.preload()
    loader.setMaterials(materials)
  })
  return (
    <Center>
      <primitive object={obj} scale={1.7} />
    </Center>
  )
}

/** Mascotte 3D décorative (hamster) : déplaçable via sa poignée, tournable par glissé
 * direct sur le modèle (+ légère rotation automatique au repos). Purement décorative —
 * masquée aux lecteurs d'écran (aria-hidden).
 *
 * Le déplacement passe par `dragControls`/`dragListener={false}` plutôt que par un
 * `drag` classique sur toute la carte : un simple `stopPropagation()` sur le canevas
 * ne suffit pas à empêcher le glissé de rotation (OrbitControls, à l'intérieur) de
 * déclencher *aussi* le glissé de déplacement (Framer Motion, sur la carte) — les deux
 * gestes de glissé partent d'un même pointerdown et finissaient par se déclencher
 * ensemble. En désactivant l'écoute automatique de la carte et en ne démarrant le
 * déplacement que depuis la poignée, les deux gestes restent indépendants.
 */
export function Mascot() {
  const reducedMotion = usePrefersReducedMotion()
  const boundsRef = useRef<HTMLDivElement>(null)
  const opacityControls = useAnimationControls()
  const dragControls = useDragControls()
  const { t } = useLanguage()

  useEffect(() => {
    opacityControls.start({ opacity: 1, scale: 1, transition: { duration: 0.4, delay: 0.3 } })
  }, [opacityControls])

  return (
    <div className="mascot-bounds" ref={boundsRef} aria-hidden="true">
      <motion.div
        className="mascot"
        drag
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={boundsRef}
        dragElastic={0.08}
        dragMomentum={false}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={opacityControls}
        whileDrag={{ cursor: 'grabbing' }}
      >
        <div className="mascot__canvas">
          <Canvas camera={{ position: [0, 0.4, 3.2], fov: 35 }}>
            <ambientLight intensity={0.9} />
            <directionalLight position={[2, 3, 2]} intensity={0.8} />
            <Suspense fallback={null}>
              <HamsterModel />
            </Suspense>
            <OrbitControls
              enableZoom={false}
              enablePan={false}
              autoRotate={!reducedMotion}
              autoRotateSpeed={1.6}
              rotateSpeed={0.6}
            />
          </Canvas>
        </div>
        <div
          className="mascot__handle"
          title={t.mascot.move}
          onPointerDown={(e) => dragControls.start(e)}
        >
          <GripHorizontal size={14} />
        </div>
      </motion.div>
    </div>
  )
}
