import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { Background, Toasts } from './components/Chrome'
import { Narrator } from './components/Narrator'
import { Home } from './screens/Home'
import { Splash } from './screens/Splash'
import { WhoAreYou } from './screens/WhoAreYou'
import { Room } from './screens/room/Room'
import { useGame } from './store/gameStore'

export default function App() {
  const screen = useGame((s) => s.screen)
  return (
    // respeita "reduzir movimento" do sistema em todas as animações do framer-motion
    <MotionConfig reducedMotion="user">
      <Background />
      <div className="app">
        <AnimatePresence mode="wait">
          <motion.div
            key={screen}
            className="screen"
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -16 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            {screen === 'splash' && <Splash />}
            {screen === 'who' && <WhoAreYou />}
            {screen === 'home' && <Home />}
            {screen === 'room' && <Room />}
          </motion.div>
        </AnimatePresence>
      </div>
      <Narrator />
      <Toasts />
    </MotionConfig>
  )
}
