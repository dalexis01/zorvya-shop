import type { Metadata } from "next";

import Link from "next/link";

import { STORE_BRAND, TERMS_VERSION } from "@/lib/shop/config";

export const metadata: Metadata = {
  title: `Terminos y Condiciones | ${STORE_BRAND}`,
  description: `Condiciones de uso, politica general y lineamientos de compra de ${STORE_BRAND}.`,
};

const sections = [
  {
    title: "Uso del servicio",
    paragraphs: [
      `${STORE_BRAND} ofrece una tienda digital para consultar productos, crear una cuenta, solicitar delivery, programar recogidas y comunicarse con soporte desde la web.`,
      "El cliente debe proporcionar datos reales, actualizados y suficientes para procesar pedidos, coordinar entregas, validar recogidas y responder solicitudes de soporte.",
      "La tienda puede rechazar, pausar o cancelar pedidos cuando detecte datos incompletos, actividad sospechosa, falta de stock, errores operativos o imposibilidad real de cumplimiento.",
    ],
  },
  {
    title: "Pedidos y confirmacion",
    paragraphs: [
      "Todo pedido queda sujeto a validacion operativa, disponibilidad real del producto, zona de cobertura, horario y medios de confirmacion.",
      "Los pedidos con recogida programada deben respetar la direccion indicada, la fecha seleccionada y el monto correspondiente a pagar al momento de la entrega o retiro.",
      "Si un pedido requiere llamada de confirmacion o revision manual, la tienda puede contactar al cliente antes de completar la preparacion definitiva.",
    ],
  },
  {
    title: "Pagos y precios",
    paragraphs: [
      "Los precios publicados son los visibles al cliente en la tienda y pueden cambiar sin previo aviso antes de la confirmacion final de una orden.",
      "Los costos de delivery, promociones, disponibilidad y condiciones especiales se calculan segun los datos reales del pedido y la configuracion activa en la tienda.",
      "La tienda puede corregir errores evidentes de precio, descripcion o inventario antes de completar el despacho o la recogida del pedido.",
    ],
  },
  {
    title: "Politica de no reembolso",
    paragraphs: [
      "La pagina no realiza reembolsos de articulos una vez procesados, entregados o retirados, salvo que la tienda decida lo contrario por un error comprobado exclusivamente atribuible a la operacion.",
      "La tienda intentara ayudar a resolver problemas razonables relacionados con pedidos, estado del producto al recibirlo, errores de preparacion, faltantes o incidencias reportadas oportunamente.",
      "No se atenderan solicitudes de devolucion o reembolso por cambio de opinion, uso incorrecto, danos posteriores a la entrega, desgaste normal o incumplimiento de instrucciones del producto.",
    ],
  },
  {
    title: "Soporte y reportes",
    paragraphs: [
      "El cliente puede comunicarse con soporte desde la pagina para reportar problemas, solicitar asistencia o consultar el estado de un pedido.",
      "La tienda puede conservar el historial del chat, correos y cambios relevantes asociados a una orden para fines operativos, de seguridad y seguimiento.",
      "Los reportes deben describir el problema de forma clara y con datos suficientes para que el personal pueda revisar el caso.",
    ],
  },
  {
    title: "Responsabilidades del cliente",
    paragraphs: [
      "Mantener segura su cuenta, correo y credenciales de acceso.",
      "Indicar direccion, telefono y correo correctos al registrarse y al realizar pedidos.",
      "Presentarse en la direccion de recogida o estar disponible para recibir delivery en el horario acordado.",
      "Revisar cuidadosamente el resumen del pedido antes de confirmarlo.",
    ],
  },
  {
    title: "Responsabilidades de la tienda",
    paragraphs: [
      "Publicar productos activos, gestionar pedidos con base en disponibilidad real y mantener canales funcionales de soporte.",
      "Proteger razonablemente la informacion de cuenta y no almacenar contrasenas en texto plano.",
      "Intentar resolver incidencias operativas reportadas por el cliente dentro de un marco razonable de servicio.",
    ],
  },
  {
    title: "Cuenta y acceso",
    paragraphs: [
      "El registro requiere aceptacion expresa de estos terminos y condiciones de uso.",
      "La tienda puede bloquear o restringir cuentas asociadas con fraude, abuso, suplantacion, uso indebido del soporte o incumplimiento grave de estas condiciones.",
      `Version vigente de los terminos: ${TERMS_VERSION}.`,
    ],
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 lg:px-10">
        <div className="rounded-[2.5rem] border border-slate-800 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_38%),linear-gradient(180deg,_#050816_0%,_#03050f_100%)] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.4)]">
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Legal</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
            Terminos y Condiciones de Uso
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
            Estas condiciones regulan el uso general de la tienda, la creacion de cuentas, los
            pedidos, la politica de no reembolso y la atencion de incidencias.
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm font-semibold text-white transition hover:border-cyan-500"
            >
              Volver a la tienda
            </Link>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-[2rem] border border-slate-800 bg-[#0a1020] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.28)]"
            >
              <h2 className="text-xl font-semibold text-white">{section.title}</h2>
              <div className="mt-4 space-y-4 text-sm leading-7 text-slate-300">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
