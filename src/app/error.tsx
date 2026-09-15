"use client";

import { useEffect } from "react";

/**
 * Lo que se ve cuando una página revienta en el servidor.
 *
 * Sin esto, Next muestra "This page couldn't load" en inglés y en negro: para
 * un cliente que iba a pedir un plomero parece que la empresa cerró. Casi
 * siempre la causa es pasajera —la base de datos arrancando o un corte de
 * red— así que el mensaje dice eso y ofrece reintentar.
 *
 * En producción Next no entrega el mensaje real del error al navegador, solo un
 * `digest`. Se muestra para poder buscarlo en los logs de Vercel cuando alguien
 * reporta el problema.
 */
export default function ErrorDePagina({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-10">
      <span className="titular text-base">
        Servicios <span className="text-sello">verificados</span>
      </span>

      <h1 className="titular mt-8 text-3xl">Estamos teniendo un problema</h1>
      <p className="mt-3 text-sm leading-relaxed text-tinta-media">
        No pudimos cargar esta página. Suele ser algo pasajero y se resuelve en unos minutos.
        Tus datos y tus servicios siguen guardados.
      </p>

      <button
        type="button"
        onClick={() => retry()}
        className="mt-6 inline-flex items-center justify-center rounded-[var(--radio-sm)] bg-tinta px-4 py-3 text-sm font-semibold text-papel transition-all duration-150 hover:opacity-88 active:scale-[0.985]"
      >
        Intentar de nuevo
      </button>

      {error.digest ? (
        <p className="rotulo mt-8">Código del error: {error.digest}</p>
      ) : null}
    </main>
  );
}
