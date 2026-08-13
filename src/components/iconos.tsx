/// Iconos de categoría. Trazo de 1.5, sin relleno, un solo color: son señales
/// de navegación, no ilustraciones. Dibujados a mano para que ninguno pese más
/// visualmente que otro en la grilla.
const TRAZO = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const FIGURAS: Record<string, React.ReactNode> = {
  limpieza: (
    <>
      <path d="M9 3h4v4H9z" {...TRAZO} />
      <path d="M8.5 7h5l1.2 4.2a3 3 0 0 1-2.9 3.8h-1.6a3 3 0 0 1-2.9-3.8z" {...TRAZO} />
      <path d="M11 15v6" {...TRAZO} />
      <path d="M17 4.5l1.6 1.6M19 9.5h2M18.6 13.4l1.4 1.4" {...TRAZO} />
    </>
  ),
  plomeria: (
    <>
      <path d="M12 3.5c3 3.7 4.8 6.2 4.8 8.4a4.8 4.8 0 1 1-9.6 0c0-2.2 1.8-4.7 4.8-8.4z" {...TRAZO} />
      <path d="M9.6 12.6a2.5 2.5 0 0 0 2.4 3" {...TRAZO} />
    </>
  ),
  electricidad: (
    <>
      <path d="M13.4 2.5 5 13.4h5.6L10 21.5 19 10.4h-5.9z" {...TRAZO} />
    </>
  ),
  jardineria: (
    <>
      <path d="M4 20c0-7 4.6-12 16-12 0 7.6-4.7 12-11 12z" {...TRAZO} />
      <path d="M4 20c3.4-4.2 6.9-6.8 11-8.4" {...TRAZO} />
    </>
  ),
  mantenimiento: (
    <>
      <rect x="3.5" y="4" width="11" height="5" rx="1.4" {...TRAZO} />
      <path d="M14.5 6.5h3a2 2 0 0 1 2 2v1.2a1.6 1.6 0 0 1-1.6 1.6H12" {...TRAZO} />
      <path d="M10.6 11.3h2.8v3.1h-2.8z" {...TRAZO} />
      <path d="M12 14.4V20" {...TRAZO} />
    </>
  ),
};

const PREDETERMINADO = (
  <>
    <circle cx="12" cy="12" r="8.2" {...TRAZO} />
    <path d="M12 8v4l2.6 1.6" {...TRAZO} />
  </>
);

export function IconoCategoria({
  slug,
  className = "h-6 w-6",
}: {
  slug: string;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {FIGURAS[slug] ?? PREDETERMINADO}
    </svg>
  );
}
