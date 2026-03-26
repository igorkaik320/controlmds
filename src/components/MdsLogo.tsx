interface MdsLogoProps {
  /** Classe aplicada ao contêiner externo. */
  className?: string;
  /** Classe aplicada às letras M, D e S. */
  lettersClassName?: string;
  /** Classe aplicada ao texto de apoio (por padrão “Gestão”). */
  textClassName?: string;
  /** Texto mostrado ao lado das letras. */
  text?: string;
}

const letters = ["M", "D", "S"];

export function MdsLogo({
  className = "flex items-center gap-2",
  lettersClassName = "text-3xl font-black uppercase tracking-[0.05em]",
  textClassName = "text-sm font-semibold uppercase tracking-[0.35em] text-blue-200 -mt-1 translate-y-2",
  text = "Gestão",
}: MdsLogoProps) {
  return (
    <div className={className}>
      <div className="flex items-center gap-0">
        {letters.map((letter) => (
          <span key={letter} className={lettersClassName}>
            {letter}
          </span>
        ))}
      </div>
      <p className={textClassName}>{text}</p>
    </div>
  );
}
