"use client";

import { useActionState } from "react";
import { registrarProfesional, type EstadoRegistro } from "./acciones";
import { Aviso, Boton, Campo, Numeral, claseInput } from "@/components/ui";

export type CategoriaConSkills = {
  nombre: string;
  skills: { slug: string; nombre: string; requiereCertificacion: boolean }[];
};

export function FormularioRegistro({ categorias }: { categorias: CategoriaConSkills[] }) {
  const [estado, accion, enviando] = useActionState<EstadoRegistro, FormData>(
    registrarProfesional,
    {},
  );

  return (
    <form action={accion} className="max-w-3xl space-y-10">
      <section>
        <Numeral n="01">Tus datos</Numeral>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre completo">
            <input name="nombre" className={claseInput} required />
          </Campo>
          <Campo etiqueta="Número de documento">
            <input name="documento" className={`${claseInput} cifra`} required />
          </Campo>
          <Campo etiqueta="Celular">
            <input name="celular" className={`${claseInput} cifra`} inputMode="tel" required />
          </Campo>
          <Campo etiqueta="Correo (opcional)">
            <input name="email" type="email" className={claseInput} />
          </Campo>
          <Campo etiqueta="Ciudad">
            <input name="ciudad" className={claseInput} defaultValue="Bogotá" required />
          </Campo>
          <Campo etiqueta="Zonas donde trabajas" ayuda="Separadas por coma. Ej: Chapinero, Usaquén">
            <input name="zonas" className={claseInput} required />
          </Campo>
        </div>
      </section>

      <section>
        <Numeral n="02">Qué sabes hacer</Numeral>
        <p className="mt-3 text-sm text-tinta-suave">
          Marca solo lo que sabes hacer de verdad. Cada habilidad se verifica por aparte, y las
          verificadas son las que te traen trabajos.
        </p>

        <div className="mt-6 space-y-7">
          {categorias.map((categoria) => (
            <div key={categoria.nombre}>
              <div className="flex items-baseline gap-3">
                <span className="rotulo">{categoria.nombre}</span>
                <span className="h-px flex-1 bg-regla" />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {categoria.skills.map((skill) => (
                  <label
                    key={skill.slug}
                    className="flex cursor-pointer items-start gap-2.5 border border-regla bg-superficie p-3 transition-colors hover:border-regla-fuerte"
                  >
                    <input type="checkbox" name="skills" value={skill.slug} className="mt-0.5" />
                    <span>
                      <span className="block text-sm">{skill.nombre}</span>
                      {skill.requiereCertificacion ? (
                        <span className="rotulo mt-0.5 block text-aviso">requiere certificación</span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <Numeral n="03">Tu experiencia</Numeral>
        <p className="mt-3 text-sm text-tinta-suave">
          El trabajo informal cuenta. Lo que necesitamos es poder comprobarlo: nombres de clientes o
          empresas, fotos de trabajos, alguien que responda por ti.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-[11rem_1fr]">
          <Campo etiqueta="Años de experiencia">
            <input
              name="aniosExperiencia"
              type="number"
              min={0}
              max={60}
              defaultValue={1}
              className={`${claseInput} cifra`}
              required
            />
          </Campo>
          <Campo etiqueta="Cuéntanos dónde has trabajado">
            <textarea
              name="experiencia"
              rows={3}
              className={claseInput}
              placeholder="Ej: 4 años por mi cuenta en Chapinero, 2 años con una empresa de mantenimiento. Puedo dar referencias."
            />
          </Campo>
        </div>
      </section>

      <label className="flex cursor-pointer items-start gap-3 border-l-2 border-regla-fuerte pl-4">
        <input type="checkbox" name="aceptaDatos" value="1" className="mt-1" required />
        <span className="text-sm leading-relaxed text-tinta-media">
          Autorizo verificar mi identidad, mis antecedentes y mi experiencia, y que mi perfil público
          muestre mis habilidades verificadas.
          <span className="mt-1 block text-xs text-tinta-suave">
            Tus documentos no se muestran a los clientes: ellos solo ven qué quedó verificado.
          </span>
        </span>
      </label>

      {estado.error ? <Aviso tono="alerta">{estado.error}</Aviso> : null}

      <div className="flex flex-wrap items-center gap-5">
        <Boton disabled={enviando} className="!py-3">
          {enviando ? "Enviando…" : "Enviar registro"}
        </Boton>
        <p className="max-w-sm text-xs leading-relaxed text-tinta-suave">
          Después te pediremos cédula y antecedentes. Sin eso no podemos asignarte trabajos en casas.
        </p>
      </div>
    </form>
  );
}
