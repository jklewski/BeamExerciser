import Equation from './Equation.jsx'

/**
 * Renders a string that may contain inline LaTeX delimited by $...$.
 * Plain text segments are rendered as-is; $...$ segments are rendered via KaTeX.
 *
 * Example:  "Beräkna $M_{Ed}$ i kNm." renders "Beräkna [KaTeX] i kNm."
 */
export default function InlineText({ text }) {
  if (!text) return null

  const parts = text.split(/(\$[^$]+\$)/)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('$') && part.endsWith('$')) {
          return <Equation key={i} math={part.slice(1, -1)} block={false} />
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}
