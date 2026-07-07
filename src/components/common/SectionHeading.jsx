// src/components/common/SectionHeading.jsx
export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
  center = false,
}) {
  return (
    <div className={center ? "text-center" : ""}>
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary-600 mb-2">
          {eyebrow}
        </p>
      )}
      <h2 className="text-3xl md:text-4xl font-display font-bold text-dark-900 leading-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-3 text-dark-500 text-base leading-relaxed max-w-xl">
          {subtitle}
        </p>
      )}
    </div>
  );
}
