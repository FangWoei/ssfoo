// src/components/common/LoginMascot.jsx
// Login mascot v2 — flat modern style, teal brand colors.
// States:
//   watching  → pupils follow the email text (lookX)
//   covering  → paws rise and cover the eyes (password / admin code)
//   peeking   → paws part slightly + blush (show-password on)
export default function LoginMascot({
  watching = false,
  covering = false,
  peeking = false,
  lookX = 0,
}) {
  const cover = covering && !peeking;
  const peek = covering && peeking;

  const px = watching ? Math.max(-6, Math.min(6, lookX)) : 0;
  const py = watching ? 4 : peek ? 2 : 0;

  const spring = "transform 0.4s cubic-bezier(0.34, 1.4, 0.64, 1)";
  const paw = {
    transition: spring,
    transformBox: "fill-box",
    transformOrigin: "center bottom",
  };

  const leftPaw = cover
    ? "translate(6px, -54px) rotate(8deg)"
    : peek
      ? "translate(-8px, -40px) rotate(-6deg)"
      : "translate(0px, 0px) rotate(0deg)";
  const rightPaw = cover
    ? "translate(-6px, -54px) rotate(-8deg)"
    : peek
      ? "translate(8px, -40px) rotate(6deg)"
      : "translate(0px, 0px) rotate(0deg)";

  return (
    <svg
      viewBox="0 0 220 190"
      className="w-40 h-auto sm:w-44 select-none drop-shadow-sm"
      aria-hidden="true">
      <defs>
        <linearGradient id="mBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#14b8a6" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
        <linearGradient id="mBodyDark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0d9488" />
          <stop offset="100%" stopColor="#0f766e" />
        </linearGradient>
        <linearGradient id="mFace" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0fdfa" />
          <stop offset="100%" stopColor="#ccfbf1" />
        </linearGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="110" cy="182" rx="62" ry="7" fill="#0f172a" opacity="0.08" />

      {/* ── Ears ── */}
      <circle cx="52" cy="42" r="20" fill="url(#mBodyDark)" />
      <circle cx="168" cy="42" r="20" fill="url(#mBodyDark)" />
      <circle cx="52" cy="42" r="10" fill="#5eead4" opacity="0.55" />
      <circle cx="168" cy="42" r="10" fill="#5eead4" opacity="0.55" />

      {/* ── Head ── */}
      <path
        d="M110 14
           C 158 14, 186 44, 186 88
           C 186 138, 154 168, 110 168
           C 66 168, 34 138, 34 88
           C 34 44, 62 14, 110 14 Z"
        fill="url(#mBody)"
      />

      {/* Face plate */}
      <ellipse cx="110" cy="106" rx="56" ry="48" fill="url(#mFace)" />

      {/* ── Eyes ── */}
      <g className="mv2-blink">
        <g
          style={{
            transition: "transform 0.16s ease-out",
            transform: `translate(${px}px, ${py}px)`,
          }}>
          {/* pupils */}
          <circle cx="84" cy="92" r="9" fill="#134e4a" />
          <circle cx="136" cy="92" r="9" fill="#134e4a" />
          {/* glints */}
          <circle cx="87" cy="89" r="3" fill="#ffffff" />
          <circle cx="139" cy="89" r="3" fill="#ffffff" />
          <circle cx="82" cy="95" r="1.4" fill="#ffffff" opacity="0.7" />
          <circle cx="134" cy="95" r="1.4" fill="#ffffff" opacity="0.7" />
        </g>
      </g>

      {/* Blush — visible when peeking */}
      <g
        style={{
          transition: "opacity 0.3s ease",
          opacity: peek ? 1 : 0,
        }}>
        <ellipse
          cx="68"
          cy="110"
          rx="10"
          ry="5"
          fill="#fda4af"
          opacity="0.75"
        />
        <ellipse
          cx="152"
          cy="110"
          rx="10"
          ry="5"
          fill="#fda4af"
          opacity="0.75"
        />
      </g>

      {/* ── Muzzle ── */}
      <ellipse cx="110" cy="118" rx="8.5" ry="6" fill="#134e4a" />
      {cover ? (
        // surprised "o"
        <ellipse cx="110" cy="136" rx="7" ry="8" fill="#134e4a" />
      ) : (
        <path
          d={
            peek
              ? "M98 132 Q110 141 124 130" // smirk
              : "M96 130 Q110 144 124 130" // smile
          }
          fill="none"
          stroke="#134e4a"
          strokeWidth="4"
          strokeLinecap="round"
        />
      )}

      {/* ── Paws (rounded mittens, rest at the bottom) ── */}
      <g style={{ ...paw, transform: leftPaw }}>
        <path
          d="M56 176
             C 54 158, 62 146, 78 146
             C 94 146, 102 158, 100 176
             Q 78 184, 56 176 Z"
          fill="url(#mBodyDark)"
        />
        {/* finger grooves */}
        <path
          d="M72 150 L72 162"
          stroke="#0f766e"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.6"
        />
        <path
          d="M84 150 L84 162"
          stroke="#0f766e"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.6"
        />
      </g>
      <g style={{ ...paw, transform: rightPaw }}>
        <path
          d="M120 176
             C 118 158, 126 146, 142 146
             C 158 146, 166 158, 164 176
             Q 142 184, 120 176 Z"
          fill="url(#mBodyDark)"
        />
        <path
          d="M136 150 L136 162"
          stroke="#0f766e"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.6"
        />
        <path
          d="M148 150 L148 162"
          stroke="#0f766e"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.6"
        />
      </g>

      <style>{`
        .mv2-blink {
          animation: mv2Blink 4.2s infinite;
          transform-box: fill-box;
          transform-origin: center;
        }
        @keyframes mv2Blink {
          0%, 93%, 100% { transform: scaleY(1); }
          95.5%, 97.5% { transform: scaleY(0.06); }
        }
      `}</style>
    </svg>
  );
}
