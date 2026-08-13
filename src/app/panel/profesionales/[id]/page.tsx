import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { eventosDe } from "@/lib/events";
import { cop, fecha, fechaHora, whatsapp } from "@/lib/format";
import {
  ESTADOS_DOCUMENTO,
  ESTADOS_PROFESIONAL,
  ESTADOS_SKILL,
  FUENTES_VERIFICACION,
  NIVELES,
  ORDENES_COMPLETADAS,
  SKILLS_HABILITADAS,
  TIPOS_DOCUMENTO,
  etiqueta,
} from "@/lib/constants";
import { calcularTrust } from "@/lib/trust-engine";
import {
  Aviso,
  Badge,
  Barra,
  Boton,
  Card,
  CardTitulo,
  Mensajes,
  Tabla,
  Td,
  Th,
  Vacio,
  claseInput,
  tonoEstado,
} from "@/components/ui";
import {
  actualizarDocumento,
  agregarDocumento,
  cambiarEstadoProfesional,
  guardarNotasProfesional,
  verificarSkill,
} from "../acciones";

export const dynamic = "force-dynamic";

export default async function ProfesionalDetalle({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { id } = await params;
  const mensajes = await searchParams;

  const pro = await prisma.professional.findUnique({
    where: { id },
    include: {
      skills: { include: { skill: { include: { category: true } } } },
      documentos: { orderBy: { tipo: "asc" } },
      ordenes: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { serviceType: true, calificaciones: true },
      },
      trustSnapshots: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  if (!pro) notFound();

  const trust = await calcularTrust(pro.id);
  const eventos = await eventosDe("Professional", pro.id);
  const completadas = pro.ordenes.filter((o) => ORDENES_COMPLETADAS.includes(o.estado));
  const ingresos = completadas.reduce((acc, o) => acc + o.pagoProfesional, 0);
  const verificadas = pro.skills.filter((s) => SKILLS_HABILITADAS.includes(s.estado)).length;

  const porCategoria = pro.skills.reduce<Record<string, typeof pro.skills>>((acc, s) => {
    (acc[s.skill.category.nombre] ??= []).push(s);
    return acc;
  }, {});

  const tiposFaltantes = Object.keys(TIPOS_DOCUMENTO).filter(
    (tipo) => !pro.documentos.some((d) => d.tipo === tipo),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/panel/profesionales" className="rotulo enlace hover:text-tinta">
          ← Profesionales
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="titular text-3xl">{pro.nombre}</h1>
          <Badge tono={tonoEstado(pro.estado)}>{etiqueta(ESTADOS_PROFESIONAL, pro.estado)}</Badge>
          <Badge tono="acento">{etiqueta(NIVELES, pro.nivel)}</Badge>
        </div>
        <p className="mt-1 text-sm text-tinta-suave">
          {pro.codigo} ·{" "}
          <a
            href={whatsapp(pro.celular, `Hola ${pro.nombre.split(" ")[0]}, te escribimos de la plataforma.`)}
            target="_blank"
            rel="noreferrer"
            className="text-sello hover:underline"
          >
            {pro.celular}
          </a>{" "}
          · {pro.ciudad}
          {pro.zonas ? ` · ${pro.zonas}` : ""} · {pro.aniosExperiencia} años de experiencia
        </p>
      </div>

      <Mensajes error={mensajes.error} ok={mensajes.ok} />

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-4">
          <Card>
            <CardTitulo accion={<span className="cifra text-2xl font-semibold">{trust.score}</span>}>
              Trust Score
            </CardTitulo>
            <div className="p-4">
              <ul className="grid gap-3 sm:grid-cols-2">
                {trust.componentes.map((componente) => (
                  <li key={componente.clave}>
                    <div className="flex justify-between gap-2 text-sm">
                      <span>{componente.etiqueta}</span>
                      <span className="cifra text-tinta-suave">
                        {componente.aporte}/{Math.round(componente.peso * 100)}
                      </span>
                    </div>
                    <div className="mt-1">
                      <Barra valor={componente.aporte} maximo={Math.round(componente.peso * 100)} />
                    </div>
                    <div className="mt-0.5 text-xs text-tinta-suave">{componente.detalle}</div>
                  </li>
                ))}
              </ul>

              {trust.penalizacion > 0 ? (
                <div className="mt-4">
                  <Aviso tono="alerta">
                    −{trust.penalizacion} puntos por incidentes: {trust.detallePenalizacion}
                  </Aviso>
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardTitulo>Habilidades</CardTitulo>
            <div className="divide-y divide-regla">
              {Object.entries(porCategoria).map(([categoria, skills]) => (
                <div key={categoria} className="p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-tinta-suave">
                    {categoria}
                  </div>
                  <div className="mt-3 space-y-3">
                    {skills.map((registro) => (
                      <div key={registro.id} className="rounded-lg border border-regla p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="text-sm font-medium">{registro.skill.nombre}</span>
                            {registro.skill.requiereCertificacion ? (
                              <span className="ml-2 text-xs text-aviso">requiere certificación</span>
                            ) : null}
                          </div>
                          <Badge tono={tonoEstado(registro.estado)}>
                            {etiqueta(ESTADOS_SKILL, registro.estado)}
                          </Badge>
                        </div>

                        {registro.fuente ? (
                          <div className="mt-1 text-xs text-tinta-suave">
                            {etiqueta(FUENTES_VERIFICACION, registro.fuente)}
                            {registro.verificadoEn ? ` · ${fecha(registro.verificadoEn)}` : ""}
                          </div>
                        ) : null}

                        <form action={verificarSkill} className="mt-3 flex flex-wrap items-center gap-2">
                          <input type="hidden" name="skillProId" value={registro.id} />
                          <select
                            name="estado"
                            className={`${claseInput} !w-auto !py-1 text-xs`}
                            defaultValue={registro.estado}
                          >
                            {Object.entries(ESTADOS_SKILL).map(([valor, texto]) => (
                              <option key={valor} value={valor}>
                                {texto}
                              </option>
                            ))}
                          </select>
                          <select
                            name="fuente"
                            className={`${claseInput} !w-auto !py-1 text-xs`}
                            defaultValue={registro.fuente}
                          >
                            <option value="">¿Cómo se comprobó?</option>
                            {Object.entries(FUENTES_VERIFICACION).map(([valor, texto]) => (
                              <option key={valor} value={valor}>
                                {texto}
                              </option>
                            ))}
                          </select>
                          <Boton tipo="secundario" className="!py-1 !text-xs">
                            Guardar
                          </Boton>
                        </form>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardTitulo>Documentos</CardTitulo>
            <div className="divide-y divide-regla">
              {pro.documentos.map((documento) => (
                <div key={documento.id} className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-sm font-medium">
                        {etiqueta(TIPOS_DOCUMENTO, documento.tipo)}
                      </span>
                      <div className="text-xs text-tinta-suave">{documento.motivoRiesgo}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {documento.venceEn ? (
                        <span className="text-xs text-tinta-suave">
                          vence {fecha(documento.venceEn)}
                        </span>
                      ) : null}
                      <Badge tono={tonoEstado(documento.estado)}>
                        {etiqueta(ESTADOS_DOCUMENTO, documento.estado)}
                      </Badge>
                    </div>
                  </div>

                  <form
                    action={actualizarDocumento}
                    className="mt-3 flex flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="documentoId" value={documento.id} />
                    <select
                      name="estado"
                      className={`${claseInput} !w-auto !py-1 text-xs`}
                      defaultValue={documento.estado}
                    >
                      {Object.entries(ESTADOS_DOCUMENTO).map(([valor, texto]) => (
                        <option key={valor} value={valor}>
                          {texto}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      name="venceEn"
                      className={`${claseInput} !w-auto !py-1 text-xs`}
                      defaultValue={
                        documento.venceEn
                          ? new Date(documento.venceEn).toISOString().slice(0, 10)
                          : ""
                      }
                    />
                    <Boton tipo="secundario" className="!py-1 !text-xs">
                      Guardar
                    </Boton>
                  </form>
                </div>
              ))}

              {tiposFaltantes.length > 0 ? (
                <form action={agregarDocumento} className="flex flex-wrap items-center gap-2 p-4">
                  <input type="hidden" name="professionalId" value={pro.id} />
                  <select name="tipo" className={`${claseInput} !w-auto !py-1 text-xs`}>
                    {tiposFaltantes.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {etiqueta(TIPOS_DOCUMENTO, tipo)}
                      </option>
                    ))}
                  </select>
                  <Boton tipo="secundario" className="!py-1 !text-xs">
                    Pedir documento
                  </Boton>
                </form>
              ) : null}
            </div>
          </Card>

          {pro.experienciaTexto ? (
            <Card>
              <CardTitulo>Experiencia declarada</CardTitulo>
              <p className="p-4 text-sm text-tinta-suave">{pro.experienciaTexto}</p>
            </Card>
          ) : null}

          <Card>
            <CardTitulo>Últimos servicios</CardTitulo>
            {pro.ordenes.length === 0 ? (
              <Vacio>Todavía no tiene servicios.</Vacio>
            ) : (
              <Tabla>
                <thead>
                  <tr>
                    <Th>Código</Th>
                    <Th>Servicio</Th>
                    <Th>Estado</Th>
                    <Th>Calidad</Th>
                    <Th right>Le pagamos</Th>
                  </tr>
                </thead>
                <tbody>
                  {pro.ordenes.map((orden) => {
                    const calificacion = orden.calificaciones.find((c) => c.emisor === "CLIENTE");
                    return (
                      <tr key={orden.id}>
                        <Td>
                          <Link
                            href={`/panel/servicios/${orden.id}`}
                            className="text-sello hover:underline"
                          >
                            {orden.codigo}
                          </Link>
                        </Td>
                        <Td>{orden.serviceType.nombre}</Td>
                        <Td>
                          <Badge tono={tonoEstado(orden.estado)}>{orden.estado}</Badge>
                        </Td>
                        <Td>{calificacion?.calidad ? `${calificacion.calidad}/5` : "—"}</Td>
                        <Td right className="cifra">
                          {cop(orden.pagoProfesional)}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Tabla>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardTitulo>Estado</CardTitulo>
            <div className="space-y-3 p-4">
              <form action={cambiarEstadoProfesional} className="space-y-2">
                <input type="hidden" name="professionalId" value={pro.id} />
                <select name="estado" className={claseInput} defaultValue={pro.estado}>
                  {Object.entries(ESTADOS_PROFESIONAL).map(([valor, texto]) => (
                    <option key={valor} value={valor}>
                      {texto}
                    </option>
                  ))}
                </select>
                <Boton tipo="secundario" className="w-full">
                  Cambiar estado
                </Boton>
              </form>
              <p className="text-xs text-tinta-suave">
                No se puede activar sin cédula vigente y al menos una habilidad verificada.
              </p>
            </div>
          </Card>

          <Card>
            <CardTitulo>Números</CardTitulo>
            <div className="space-y-2 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-tinta-suave">Servicios completados</span>
                <span className="cifra">{completadas.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-tinta-suave">Ingresos generados</span>
                <span className="cifra">{cop(ingresos)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-tinta-suave">Habilidades verificadas</span>
                <span className="cifra">
                  {verificadas}/{pro.skills.length}
                </span>
              </div>
            </div>
          </Card>

          <Card>
            <CardTitulo>Zonas y notas</CardTitulo>
            <form action={guardarNotasProfesional} className="space-y-3 p-4">
              <input type="hidden" name="professionalId" value={pro.id} />
              <input
                name="zonas"
                className={claseInput}
                defaultValue={pro.zonas}
                placeholder="Chapinero, Usaquén"
              />
              <textarea
                name="notasInternas"
                rows={4}
                className={claseInput}
                defaultValue={pro.notasInternas}
                placeholder="Notas internas del operador."
              />
              <Boton tipo="secundario" className="w-full">
                Guardar
              </Boton>
            </form>
          </Card>

          <Card>
            <CardTitulo>Historial de Trust</CardTitulo>
            {pro.trustSnapshots.length === 0 ? (
              <Vacio>Sin snapshots.</Vacio>
            ) : (
              <ul className="divide-y divide-regla">
                {pro.trustSnapshots.map((snapshot) => (
                  <li key={snapshot.id} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <div className="text-sm">{snapshot.motivo}</div>
                      <div className="text-xs text-tinta-suave">{fechaHora(snapshot.createdAt)}</div>
                    </div>
                    <span className="cifra font-semibold">{snapshot.score}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitulo>Bitácora</CardTitulo>
            {eventos.length === 0 ? (
              <Vacio>Sin eventos.</Vacio>
            ) : (
              <ul className="divide-y divide-regla">
                {eventos.slice(0, 8).map((evento) => (
                  <li key={evento.id} className="px-4 py-2.5 text-sm">
                    <div className="font-medium">{evento.tipo}</div>
                    <div className="text-xs text-tinta-suave">{fechaHora(evento.createdAt)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
