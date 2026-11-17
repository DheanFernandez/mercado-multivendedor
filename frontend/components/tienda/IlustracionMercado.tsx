import { useId } from "react";

/**
 * Ilustración decorativa del mercado (spec 004, E4): canasta con productos dibujada en SVG. Es una ilustración, no una
 * fotografía de un producto ni de un puesto; por eso es `aria-hidden` y no transmite información.
 */
export function IlustracionMercado({ className = "" }: { className?: string }) {
  const u = useId().replace(/:/g, "");
  const id = (n: string) => `${u}-${n}`;
  return (
    <svg viewBox="0 0 440 330" aria-hidden="true" focusable="false" className={className}>
      <defs>
        <radialGradient id={id("tomate")} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#ff8a6b" />
          <stop offset="0.55" stopColor="#e2553b" />
          <stop offset="1" stopColor="#b9361f" />
        </radialGradient>
        <radialGradient id={id("limon")} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#fff2a8" />
          <stop offset="0.6" stopColor="#f4cf3f" />
          <stop offset="1" stopColor="#d9a919" />
        </radialGradient>
        <radialGradient id={id("papa")} cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#f0d29a" />
          <stop offset="1" stopColor="#c99a52" />
        </radialGradient>
        <linearGradient id={id("canasta")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d89a54" />
          <stop offset="1" stopColor="#b47436" />
        </linearGradient>
        <linearGradient id={id("zanahoria")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffab4d" />
          <stop offset="1" stopColor="#e2741d" />
        </linearGradient>
      </defs>

      {/* Halo y sombra */}
      <circle cx="235" cy="175" r="150" fill="#fff" opacity="0.07" />
      <circle cx="235" cy="175" r="112" fill="#fff" opacity="0.06" />
      <ellipse cx="240" cy="314" rx="150" ry="11" fill="#000" opacity="0.18" />

      {/* Asa */}
      <path d="M128 200C138 64 342 64 352 200" fill="none" stroke="#c88a45" strokeWidth="13" strokeLinecap="round" />
      <path d="M128 200C138 64 342 64 352 200" fill="none" stroke="#e6b779" strokeWidth="5" strokeLinecap="round" opacity="0.6" />

      {/* Hojas verdes (culantro / lechuga) */}
      <path d="M150 204c-26-30-20-74 14-92 12 32 10 64-14 92Z" fill="#6f9a3a" />
      <path d="M168 206c-10-40 6-78 44-86 2 36-14 66-44 86Z" fill="#8db84f" />
      <path d="M140 206c-30-14-44-46-34-76 30 14 42 44 34 76Z" fill="#7da846" />
      <path d="M166 200c4-26 14-48 30-66" stroke="#5a7f2b" strokeWidth="2.5" fill="none" strokeLinecap="round" />

      {/* Zanahoria */}
      <g transform="rotate(-38 360 140)">
        <path d="M336 76c4-14 22-18 30-6l-4 6c10-10 26-4 24 10-8 2-14 0-20-4 6 8 4 20-8 22-4-8-4-14-2-20-8 4-18 2-20-8Z" fill="#6f9a3a" />
        <path d="M340 92h44l-14 120c-2 12-14 12-16 0L340 92Z" fill={`url(#${id("zanahoria")})`} />
        <path d="M346 116h14M350 140h12M354 164h10M358 188h8" stroke="#c65f15" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
      </g>

      {/* Palta (mitad) */}
      <g transform="rotate(-18 186 176)">
        <ellipse cx="186" cy="176" rx="33" ry="44" fill="#3f6a1f" />
        <ellipse cx="186" cy="178" rx="27" ry="37" fill="#cfe08a" />
        <ellipse cx="186" cy="182" rx="23" ry="30" fill="#e3eda8" />
        <circle cx="186" cy="188" r="14" fill="#8a5a2b" />
        <circle cx="181" cy="183" r="4" fill="#b98656" />
      </g>

      {/* Limón */}
      <g transform="rotate(-24 300 168)">
        <ellipse cx="300" cy="168" rx="33" ry="24" fill={`url(#${id("limon")})`} />
        <path d="M265 168c-5-2-7 0-8 2M335 168c5-2 7 0 8 2" stroke="#d9a919" strokeWidth="5" strokeLinecap="round" />
        <ellipse cx="290" cy="160" rx="10" ry="5" fill="#fff" opacity="0.4" />
      </g>

      {/* Tomate */}
      <circle cx="240" cy="160" r="40" fill={`url(#${id("tomate")})`} />
      <ellipse cx="226" cy="144" rx="12" ry="7" fill="#fff" opacity="0.3" transform="rotate(-25 226 144)" />
      <path d="M240 122l6 9 11-3-6 10 9 6-11 1 1 11-9-7-9 7 1-11-11-1 9-6-6-10 11 3Z" fill="#3e7a2e" />

      {/* Papa */}
      <ellipse cx="330" cy="200" rx="30" ry="21" fill={`url(#${id("papa")})`} transform="rotate(10 330 200)" />
      <circle cx="320" cy="196" r="2.2" fill="#a77b3d" />
      <circle cx="338" cy="204" r="2.2" fill="#a77b3d" />
      <circle cx="342" cy="192" r="1.8" fill="#a77b3d" />

      {/* Canasta */}
      <path d="M118 210h244l-20 84c-3 12-14 20-26 20H164c-12 0-23-8-26-20l-20-84Z" fill={`url(#${id("canasta")})`} />
      <rect x="108" y="196" width="264" height="26" rx="13" fill="#c07d3c" />
      <rect x="108" y="196" width="264" height="9" rx="4.5" fill="#dca061" opacity="0.7" />
      <path d="M132 246h216M138 272h204" stroke="#9c6026" strokeWidth="3" opacity="0.45" strokeLinecap="round" />
      <path d="M170 222l-8 88M206 222l-4 90M240 222v90M274 222l4 90M310 222l8 88" stroke="#9c6026" strokeWidth="3" opacity="0.4" strokeLinecap="round" />

      {/* Detalles flotantes */}
      <path d="M78 98c10-16 30-18 40-8-12 14-28 16-40 8Z" fill="#a9cf6a" opacity="0.9" />
      <path d="M392 64c14-6 28 2 30 14-14 6-26 0-30-14Z" fill="#a9cf6a" opacity="0.8" />
      <circle cx="98" cy="160" r="5" fill="#f3e7d6" opacity="0.7" />
      <circle cx="408" cy="130" r="4" fill="#f3e7d6" opacity="0.7" />
      <circle cx="386" cy="250" r="6" fill="#f8e6d9" opacity="0.5" />
      <circle cx="70" cy="236" r="4" fill="#f8e6d9" opacity="0.5" />
    </svg>
  );
}
