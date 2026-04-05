import { useEffect, useRef } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

export default function Equation({ math, block = false }) {
  const ref = useRef()
  useEffect(() => {
    if (ref.current) {
      katex.render(math, ref.current, {
        displayMode: block,
        throwOnError: false,
      })
    }
  }, [math, block])
  return <span ref={ref} />
}
