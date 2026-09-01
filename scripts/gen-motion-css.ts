// Dev-only script: regenerates packages/motion/src/motion.css
// Run: npm run gen:motion-css   — commit the output. Never edited by hand.
import { writeFileSync } from 'node:fs'
import { toMotionCss } from '../packages/motion/src/emitCss.js'

writeFileSync('packages/motion/src/motion.css', toMotionCss())
console.log('motion.css written')
