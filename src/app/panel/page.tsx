import Link from "next/link";
import { prisma } from "@/lib/db";
import { cop, haceCuanto } from "@/lib/format";
import { ORDENES_ACTIVAS, ORDENES_COMPLETADAS } from "@/lib/constants";
import { Badge, Card, CardTitulo, Metrica, Tabla, Td, Th, Vacio, tonoEstado } from "@/components/ui";

export const dynamic = "force-dynamic";

const DIA_MS = 24 * 3600 * 1000;
const ABIERTAS = ["NUEVA", "CLASIFICADA", "COTIZADA", "ACEPTADA"];

/// §52 Panel interno. Las alertas no son decorativas: cada una corresponde a un
/// riesgo que el documento maestro identifica y que cuesta plata si se ignora.
async function construirAlertas() {
  const ahora = new Date();
  const en30Dias = new Date(ahora.getTime() + 30 * DIA_MS);

  const [docsPorVencer, incidentesAltos, cambiosPendientes, sinAsignar, docsPendientes, prosNuevos] =
    await Promise.all([
      prisma.professionalDocument.findMany({
        where: { estado: "VIGENTE", venceEn: { not: null, lte: en30Dias } },
        include: { professional: true },
        orderBy: { venceEn: "asc" },
        take: 5,
      }),
      prisma.incident.count({
        where: { severidad: "ALTO", estado: { in: ["ABIERTO", "EN_INVESTIGACION", "ESCALADO"] } },
      }),
      prisma.scopeChange.count({ where: { estado: "SOLICITADO" } }),
      prisma.serviceRequest.count({
        where: {
          estado: { in: ABIERTAS },
          createdAt: { lte: new Date(ahora.getTime() - 2 * 3600 * 1000) },
        },
      }),
      prisma.professionalDocument.count({ where: { estado: { in: ["PENDIENTE", "EN_REVISION"] } } }),
      prisma.professional.count({ where: { estado: "EN_VERIFICACION" } }),
    ]);

  const alertas: { texto: string; tono: "alerta" | "aviso"; href: string }[] = [];

  if (incidentesAltos > 0) {
    alertas.push({
      texto: `${incidentesAltos} incidentes de severidad alta sin cerrar`,
      tono: "alerta",
      href: "/panel/incidentes",
    });
  }
  if (sinAsignar > 0) {
    alertas.push({
      texto: `${sinAsignar} solicitudes llevan más de 2 horas sin asignar`,
      tono: "alerta",
      href: "/panel/solicitudes",
    });
  }
  if (cambiosPendientes > 0) {
    alertas.push({
      texto: `${cambiosPendientes} cambios de alcance esperando aprobación del cliente`,
      tono: "aviso",
      href: "/panel/servicios",
    });
  }
  for (const doc of docsPorVencer) {
    const dias = doc.venceEn ? Math.round((doc.venceEn.getTime() - ahora.getTime()) / DIA_MS) : 0;
    alertas.push({
      texto:
        dias <= 0
          ? `${doc.professional.nombre}: ${doc.tipo} vencido`
          : `${doc.professional.nombre}: ${doc.tipo} vence en ${dias} días`,
      tono: dias <= 7 ? "alerta" : "aviso",
      href: `/panel/profesionales/${doc.professionalId}`,
    });
  }
  if (prosNuevos > 0) {
    alertas.push({
      texto: `${prosNuevos} profesionales esperando verificación`,
      tono: "aviso",
      href: "/panel/profesionales?filtro=EN_VERIFICACION",
    });
  }
  if (docsPendientes > 0) {
    alertas.push({
      texto: `${docsPendientes} documentos por revisar`,
      tono: "aviso",
      href: "/panel/profesionales",
    });
  }

  return alertas;
}

export default async function PanelResumen() {
  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const hace24h = new Date(ahora.getTime() - DIA_MS);

  const [
    solicitudes24h,
    solicitudesPendientes,
    serviciosActivos,
    ordenesMes,
    profesionalesActivos,
    clientesTotal,
    clientesEmpresa,
    incidentesAbiertos,
    ultimasSolicitudes,
    alertas,
  ] = await Promise.all([
    prisma.serviceRequest.count({ where: { createdAt: { gte: hace24h } } }),
    prisma.serviceRequest.count({ where: { estado: { in: ABIERTAS } } }),
    prisma.serviceOrder.count({ where: { estado: { in: ORDENES_ACTIVAS } } }),
    prisma.serviceOrder.findMany({
      where: { createdAt: { gte: inicioMes }, estado: { in: ORDENES_COMPLETADAS } },
      select: { precioCliente: true, comision: true },
    }),
    prisma.professional.count({ where: { estado: "ACTIVO" } }),
    prisma.client.count(),
    prisma.client.count({ where: { tipo: "EMPRESA" } }),
    prisma.incident.count({ where: { estado: { in: ["ABIERTO", "EN_INVESTIGACION", "ESCALADO"] } } }),
    prisma.serviceRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        client: true,
        serviceType: true,
        quotes: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    construirAlertas(),
  ]);

  const gmv = ordenesMes.reduce((acc, o) => acc + o.precioCliente, 0);
  const ingresos = ordenesMes.reduce((acc, o) => acc + o.comision, 0);
  const takeRate = gmv === 0 ? 0 : (ingresos / gmv) * 100;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-regla-fuerte pb-5">
        <div>
          <h1 className="titular text-3xl">Resumen</h1>
          <p className="mt-1.5 text-sm text-tinta-media">
            Los números del mes salen solo de servicios completados.
          </p>
        </div>
        <p className="rotulo">Piloto Bogotá</p>
      </div>

      {alertas.length > 0 ? (
        <Card>
          <CardTitulo>Requiere atención</CardTitulo>
          <ul className="divide-y divide-regla">
            {alertas.map((alerta, i) => (
              <li key={i}>
                <Link
                  href={alerta.href}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-papel-hondo"
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 ${
                      alerta.tono === "alerta" ? "bg-alerta" : "bg-aviso"
                    }`}
                  />
                  {alerta.texto}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Metrica etiqueta="Solicitudes 24 h" valor={String(solicitudes24h)} />
        <Metrica
          etiqueta="Sin cerrar"
          valor={String(solicitudesPendientes)}
          nota="Solicitudes abiertas"
          tono={solicitudesPendientes > 0 ? "aviso" : undefined}
        />
        <Metrica etiqueta="Servicios activos" valor={String(serviciosActivos)} />
        <Metrica etiqueta="GMV del mes" valor={cop(gmv)} nota={`${ordenesMes.length} servicios`} />
        <Metrica
          etiqueta="Ingreso plataforma"
          valor={cop(ingresos)}
          nota={`Take rate ${takeRate.toFixed(1)}%`}
        />
        <Metrica
          etiqueta="Incidentes abiertos"
          valor={String(incidentesAbiertos)}
          tono={incidentesAbiertos > 0 ? "alerta" : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardTitulo
            accion={
              <Link href="/panel/solicitudes" className="rotulo enlace hover:text-tinta">
                Ver todas
              </Link>
            }
          >
            Últimas solicitudes
          </CardTitulo>
          {ultimasSolicitudes.length === 0 ? (
            <Vacio>
              Todavía no hay solicitudes. Comparte el enlace público para recibir la primera.
            </Vacio>
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <Th>Código</Th>
                  <Th>Cliente</Th>
                  <Th>Servicio</Th>
                  <Th>Estado</Th>
                  <Th right>Valor</Th>
                </tr>
              </thead>
              <tbody>
                {ultimasSolicitudes.map((solicitud) => (
                  <tr key={solicitud.id} className="transition-colors hover:bg-papel-hondo">
                    <Td>
                      <Link
                        href={`/panel/solicitudes/${solicitud.id}`}
                        className="cifra enlace text-sello"
                      >
                        {solicitud.codigo}
                      </Link>
                      <div className="mt-0.5 text-xs text-tinta-suave">
                        {haceCuanto(solicitud.createdAt)}
                      </div>
                    </Td>
                    <Td>{solicitud.client.nombre}</Td>
                    <Td>{solicitud.serviceType?.nombre ?? "Sin clasificar"}</Td>
                    <Td>
                      <Badge tono={tonoEstado(solicitud.estado)}>{solicitud.estado}</Badge>
                    </Td>
                    <Td right className="cifra">
                      {solicitud.quotes[0] ? cop(solicitud.quotes[0].precioTotal) : "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          )}
        </Card>

        <Card>
          <CardTitulo>Los dos lados</CardTitulo>
          <div className="space-y-5 p-4">
            <div>
              <div className="cifra text-3xl">{profesionalesActivos}</div>
              <div className="rotulo mt-1">profesionales activos</div>
            </div>
            <div className="border-t border-regla pt-4">
              <div className="cifra text-3xl">{clientesTotal}</div>
              <div className="rotulo mt-1">
                clientes · {clientesEmpresa} empresas
              </div>
            </div>
            <p className="border-t border-regla pt-4 text-xs leading-relaxed text-tinta-media">
              La promesa de reemplazo solo es creíble con densidad. Antes de prometerla en una zona,
              revisa cuántos activos hay ahí.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/panel/profesionales" className="rotulo enlace text-sello hover:text-tinta">
                Profesionales →
              </Link>
              <Link href="/panel/clientes" className="rotulo enlace text-sello hover:text-tinta">
                Clientes →
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
