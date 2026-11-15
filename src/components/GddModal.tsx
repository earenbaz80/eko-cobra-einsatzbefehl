import React, { useState } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';
import {
  computeLoadoutMetrics,
  EKO_COBRA_GADGETS,
  EKO_COBRA_INSPECTION_DEVICES,
  EKO_COBRA_PROFILES,
  EKO_COBRA_WEAPONS,
} from '../game/grazMap';
import {
  InspectionDeviceId,
  MissionPlan,
  OperatorProfileId,
  PrimaryWeaponId,
  TacticalGadgetId,
} from '../game/types';

interface GddModalProps {
  plan: MissionPlan;
  onChangePlan: (updated: MissionPlan) => void;
  onClose: () => void;
  onStartPrototype: () => void;
}

type GddSection = 'CORE' | 'LOCATIONS' | 'MECHANICS_ROE' | 'ARSENAL_LOADOUT' | 'PSYCHOLOGY_AUDIO';

export const GddModal: React.FC<GddModalProps> = ({
  plan,
  onChangePlan,
  onClose,
  onStartPrototype,
}) => {
  const dialogRef = useModalA11y();
  const [section, setSection] = useState<GddSection>('ARSENAL_LOADOUT');
  const metrics = computeLoadoutMetrics(plan);

  const handleSelectProfile = (profile: OperatorProfileId) => {
    const spec = EKO_COBRA_PROFILES[profile];
    onChangePlan({
      ...plan,
      profile,
      primaryWeapon: spec.recommendedWeapon,
      inspectionDevice: spec.recommendedInspection,
      gadget: spec.recommendedGadget,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#080C11]/95 p-4 md:p-6 overflow-y-auto">
      <div className="w-full max-w-6xl border border-[#334155] bg-[#0B111A] text-[#E2E8F0] shadow-2xl flex flex-col max-h-[92vh]"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Documento maestro de diseño (GDD)"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1E293B] px-6 py-4 bg-[#0F172A] shrink-0">
          <div>
            <div className="text-xs font-mono-tabular text-[#D97706] tracking-wider">
              GAME DESIGN DOCUMENT (GDD) · BUNDESMINISTERIUM FÜR INNERES (BMI) · DSE
            </div>
            <h2 className="font-display text-2xl md:text-3xl font-bold tracking-wide text-white">
              EKO COBRA — EINSATZBEFEHL: Documento Maestro de Diseño y Gestión de Equipo
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#94A3B8] border border-[#334155] hover:text-white hover:border-[#64748B] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Cerrar Documento
            </button>
            <button
              onClick={onStartPrototype}
              className="px-5 py-2 text-xs font-bold text-black bg-[#D97706] hover:bg-[#F59E0B] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Desplegar con Equipo Seleccionado
            </button>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex flex-wrap items-center gap-1 border-b border-[#1E293B] bg-[#080C11] px-6 py-2 shrink-0">
          {[
            { id: 'CORE', label: '01. Concepto Core y Pilares' },
            { id: 'LOCATIONS', label: '02. Ambientación y 5 Misiones en Austria' },
            { id: 'MECHANICS_ROE', label: '03. Mecánicas SWAT y Ley Austriaca (ROE)' },
            { id: 'ARSENAL_LOADOUT', label: '04. Gestión de Equipo, Sensores y Perfiles' },
            { id: 'PSYCHOLOGY_AUDIO', label: '05. Moral, IA, Audio y Calificación S' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSection(tab.id as GddSection)}
              className={`px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                section === tab.id
                  ? 'bg-[#1E293B] text-white border-b-2 border-[#D97706]'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable Document Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm leading-relaxed text-[#CBD5E1]">
          {section === 'CORE' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border border-[#1E293B] bg-[#0F172A]/40 p-5">
                <div>
                  <div className="text-xs font-mono-tabular text-[#94A3B8]">TÍTULO DEL PROYECTO</div>
                  <div className="font-display text-xl font-bold text-white mt-0.5">
                    EKO COBRA - EINSATZBEFEHL
                  </div>
                  <div className="text-xs text-[#94A3B8] mt-1">
                    (&quot;Orden de Intervención&quot;)
                  </div>
                </div>
                <div>
                  <div className="text-xs font-mono-tabular text-[#94A3B8]">GÉNERO Y PERSPECTIVA</div>
                  <div className="font-display text-xl font-bold text-white mt-0.5">
                    Shooter Táctico Top-Down 2D
                  </div>
                  <div className="text-xs text-[#94A3B8] mt-1">
                    Simulador Policial / Stealth Táctico CQB
                  </div>
                </div>
                <div>
                  <div className="text-xs font-mono-tabular text-[#94A3B8]">REFERENTES DE DISEÑO</div>
                  <div className="font-display text-xl font-bold text-white mt-0.5">
                    Police Stories · SWAT 4 · Door Kickers
                  </div>
                  <div className="text-xs text-[#94A3B8] mt-1">
                    Doctrina real del EKO Cobra (Wiener Neustadt)
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-display text-xl font-bold text-white">
                  01. Filosofía del Juego: &quot;Cero Arcade — La Ley Austriaca Importa&quot;
                </h3>
                <p>
                  En <strong>EKO COBRA - EINSATZBEFEHL</strong> eres el jefe de binomio/escuadra (<em>Einsatzleiter</em>) del <strong>Einsatzkommando Cobra</strong>, la unidad federal antiterrorista de Austria. El objetivo nunca es aniquilar a todos los ocupantes, sino <strong>resolver crisis de rehenes con el mínimo uso de fuerza letal</strong> bajo la ley policial austriaca.
                </p>
              </div>
            </div>
          )}

          {section === 'LOCATIONS' && (
            <div className="space-y-4">
              <h3 className="font-display text-xl font-bold text-white">
                02. Campaña Austriaca: 5 Escenarios Reales y Atmosféricos
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {[
                  {
                    code: 'EINSATZ 01 · NIVEL JUGABLE EN ESTE PROTOTIPO',
                    title: 'Einsatz in Graz - Lend (Gemeindebau, 3. Stock)',
                    location: 'Graz, Estiria (Steiermark) · 22:14h · Lluvia intensa',
                    desc: 'Un hombre armado (Markus K.) y dos cómplices se han atrincherado en un apartamento de 3 habitaciones reteniendo a su ex pareja (Julia M.) como rehén en el dormitorio principal.',
                  },
                  {
                    code: 'EINSATZ 02',
                    title: 'Geiselnahme Wien Hauptbahnhof (Ostbahnhof Passage)',
                    location: 'Viena (Wien) · 18:40h · Niebla invernal',
                    desc: 'Atraco fallido con rehenes en la galería comercial subterránea y sala de control de la Estación Central de Viena.',
                  },
                  {
                    code: 'EINSATZ 03',
                    title: 'Synthetik-Labor in Linz (Hafenviertel)',
                    location: 'Linz, Alta Austria · 03:15h · Aguacero industrial',
                    desc: 'Redada nocturna en nave portuaria del Danubio con precursores inflamables (uso indispensable de CS-Gas y Cámara Térmica).',
                  },
                  {
                    code: 'EINSATZ 04',
                    title: 'Alpen-Chalet in Tirol (Kitzbüheler Alpen)',
                    location: 'Tirol · 05:50h · Ventisca alpina (-11 °C)',
                    desc: 'Operación antiterrorista en un chalet alpino de dos plantas con apoyo de francotirador Steyr SSG 08.',
                  },
                  {
                    code: 'EINSATZ 05',
                    title: 'Flughafen Wien-Schwechat (VIP-Hangars & Terminal)',
                    location: 'Schwechat, Baja Austria · 23:55h · Alerta Roja',
                    desc: 'Liberación de delegación diplomática secuestrada en la zona de hangares con entrada sincronizada.',
                  },
                ].map((m) => (
                  <div key={m.code} className="border border-[#1E293B] bg-[#080C11] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono-tabular text-xs font-bold text-[#D97706]">
                        {m.code}
                      </span>
                      <span className="font-mono-tabular text-xs text-[#38BDF8]">{m.location}</span>
                    </div>
                    <h4 className="font-display text-lg font-bold text-white mt-1">{m.title}</h4>
                    <p className="text-xs text-[#CBD5E1] mt-1">{m.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'MECHANICS_ROE' && (
            <div className="space-y-5">
              <h3 className="font-display text-xl font-bold text-white">
                03. Reglas de Enfrentamiento Austriacas (ROE) y Sistema Táctico
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border border-[#1E293B] bg-[#080C11] p-5 space-y-3">
                  <h4 className="font-display text-lg font-bold text-[#D97706]">
                    Waffengebrauchsgesetz 1969 (Ley de Uso de Armas)
                  </h4>
                  <ul className="space-y-2 text-xs">
                    <li>
                      <strong>Advertencia Previa Obligatoria (Espacio):</strong> El operador debe gritar{' '}
                      <code>&quot;POLIZEI! EKO COBRA! WAFFEN FALLEN LASSEN!&quot;</code>.
                    </li>
                    <li>
                      <strong>Uso Proporcional (Notwehr §7):</strong> Solo se autoriza el disparo letal cuando el sospechoso inicia el encare/apuntado (telegraph láser rojo) o abre fuego.
                    </li>
                    <li>
                      <strong>Sanción e Investigación Interna:</strong> Herir o matar a un civil o a un sospechoso rendido cancela la operación por orden de la Fiscalía de Graz.
                    </li>
                  </ul>
                </div>

                <div className="border border-[#1E293B] bg-[#080C11] p-5 space-y-3">
                  <h4 className="font-display text-lg font-bold text-[#38BDF8]">
                    Geometría de Visión y Órdenes de Escuadra
                  </h4>
                  <ul className="space-y-2 text-xs">
                    <li>
                      <strong>Slicing the Pie:</strong> Cono de visión 2D calculado en tiempo real por intersección de rayos contra muros y puertas cerradas.
                    </li>
                    <li>
                      <strong>Sensores de Inspección (Tecla Q):</strong> Según el perfil, el operador emplea Micro-Cámara Endoscópica, Cámara Térmica FLIR o Espejo Táctico.
                    </li>
                    <li>
                      <strong>Órdenes a Kobra-2 (Teclas 1, 2, 3):</strong>{' '}
                      <code>[1] Folgen · [2] Halten · [3] Blendgranate &amp; Zugriff</code>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="border border-[#1E293B] bg-[#080C11] p-5 space-y-2.5">
                <h4 className="font-display text-lg font-bold text-[#EF4444]">
                  Sistema de Salud Localizada (Torso, Brazos, Piernas) y Protocolo Médico IFAK
                </h4>
                <p className="text-xs text-[#94A3B8]">
                  Tanto los operadores del EKO Cobra como los sospechosos poseen tres zonas anatómicas independientes (<code>TORSO</code>, <code>BRAZOS</code>, <code>PIERNAS</code>) además de estado de hemorragia activa:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
                  <div className="border border-[#1E293B] p-3">
                    <div className="font-bold text-white">Piernas (Beine · Movilidad)</div>
                    <p className="text-[#94A3B8] mt-1">
                      Recibir un impacto en las piernas reduce la velocidad de desplazamiento hasta un <strong>42%</strong> (cojera táctica). En sospechosos, frena su huida y reduce drásticamente su moral sin matarlos.
                    </p>
                  </div>
                  <div className="border border-[#1E293B] p-3">
                    <div className="font-bold text-white">Brazos (Arme · Precisión y Desarme)</div>
                    <p className="text-[#94A3B8] mt-1">
                      Las heridas en brazos generan temblor sinusoidal en el puntero láser y aumentan la dispersión. Disparar al brazo armado de un sospechoso (modo <code>[V] Extremidades</code>) puede desarmarlo con vida (+160 PTS ROE).
                    </p>
                  </div>
                  <div className="border border-[#1E293B] p-3">
                    <div className="font-bold text-white">Hemorragia e Inestabilidad Visual ([H] IFAK)</div>
                    <p className="text-[#94A3B8] mt-1">
                      Las heridas no tratadas provocan sangrado progresivo, efecto túnel hipovolémico y pérdida de estabilidad de cámara. Pulsar <code>[H]</code> aplica un torniquete CAT + gasa hemostática QuikClot.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {section === 'ARSENAL_LOADOUT' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border border-[#1E293B] bg-[#080C11] p-4">
                <div>
                  <h3 className="font-display text-xl font-bold text-white">
                    04. Sistema de Gestión de Equipo y Perfiles del EKO Cobra (Interactivo)
                  </h3>
                  <p className="text-xs text-[#94A3B8]">
                    Especificación del GDD + Configurador en vivo: los cambios realizados aquí actualizan inmediatamente el equipamiento del operador para la misión en Graz - Lend.
                  </p>
                </div>
                <div className="flex items-center gap-4 font-mono-tabular text-xs">
                  <span>
                    Peso: <strong className="text-white">{metrics.totalWeightKg} kg</strong>
                  </span>
                  <span>·</span>
                  <span>
                    Blindaje: <strong className="text-[#10B981]">{metrics.totalArmor} PTS</strong>
                  </span>
                  <span>·</span>
                  <span>
                    Sensor: <strong className="text-[#38BDF8]">{metrics.effectiveSensorRangeMeters}m</strong>
                  </span>
                </div>
              </div>

              {/* A. Perfiles de Operador */}
              <div>
                <h4 className="font-display text-lg font-bold text-[#D97706] mb-2">
                  A. Perfiles de Operador (Einsatzprofile) y Sinergias de Equipo
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(Object.keys(EKO_COBRA_PROFILES) as OperatorProfileId[]).map((pId) => {
                    const p = EKO_COBRA_PROFILES[pId];
                    const active = plan.profile === pId;
                    return (
                      <div
                        key={pId}
                        onClick={() => handleSelectProfile(pId)}
                        className={`border p-4 cursor-pointer transition-colors ${
                          active
                            ? 'border-[#D97706] bg-[#D97706]/10'
                            : 'border-[#1E293B] bg-[#080C11] hover:border-[#475569]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono-tabular text-xs font-bold text-[#D97706]">
                            {p.nameDe}
                          </span>
                          {active && (
                            <span className="font-mono-tabular text-[10px] text-[#10B981]">
                              ACTIVO
                            </span>
                          )}
                        </div>
                        <div className="font-display text-lg font-bold text-white mt-0.5">
                          {p.nameEs}
                        </div>
                        <p className="text-xs text-[#94A3B8] mt-1">{p.description}</p>
                        <ul className="mt-2.5 space-y-1 font-mono-tabular text-[11px] text-[#CBD5E1]">
                          {p.perks.map((perk) => (
                            <li key={perk}>• {perk}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* B. Cámaras de Inspección y Sensores Tácticos (Tecla Q) */}
              <div>
                <h4 className="font-display text-lg font-bold text-[#38BDF8] mb-2">
                  B. Accesorios de Inspección: Cámara Térmica FLIR, Micro-Cámara y Espejo (Tecla Q)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(Object.keys(EKO_COBRA_INSPECTION_DEVICES) as InspectionDeviceId[]).map(
                    (dId) => {
                      const d = EKO_COBRA_INSPECTION_DEVICES[dId];
                      const active = plan.inspectionDevice === dId;
                      return (
                        <div
                          key={dId}
                          onClick={() => onChangePlan({ ...plan, inspectionDevice: dId })}
                          className={`border p-4 cursor-pointer transition-colors ${
                            active
                              ? 'border-[#38BDF8] bg-[#38BDF8]/15'
                              : 'border-[#1E293B] bg-[#080C11] hover:border-[#475569]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono-tabular text-xs font-bold text-[#38BDF8]">
                              {d.nameDe}
                            </span>
                            <span className="font-mono-tabular text-[11px] text-[#94A3B8]">
                              {d.weightKg} kg
                            </span>
                          </div>
                          <div className="font-display text-lg font-bold text-white mt-0.5">
                            {d.nameEs}
                          </div>
                          <p className="text-xs text-[#CBD5E1] mt-1">{d.description}</p>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>

              {/* C. Granadas Químicas (Gas Lacrimógeno CS) y Dispositivos Tácticos (Tecla G) */}
              <div>
                <h4 className="font-display text-lg font-bold text-[#10B981] mb-2">
                  C. Agentes Químicos y Granadas No-Letales: Gas Lacrimógeno CS, Flashbang y OC (Tecla G)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(Object.keys(EKO_COBRA_GADGETS) as TacticalGadgetId[]).map((gId) => {
                    const g = EKO_COBRA_GADGETS[gId];
                    const active = plan.gadget === gId;
                    return (
                      <div
                        key={gId}
                        onClick={() => onChangePlan({ ...plan, gadget: gId })}
                        className={`border p-4 cursor-pointer transition-colors ${
                          active
                            ? 'border-[#10B981] bg-[#10B981]/15'
                            : 'border-[#1E293B] bg-[#080C11] hover:border-[#475569]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono-tabular text-xs font-bold text-[#10B981]">
                            {g.nameDe}
                          </span>
                          <span className="font-mono-tabular text-[11px] text-[#94A3B8]">
                            Moral -{g.moraleDrop}
                          </span>
                        </div>
                        <div className="font-display text-lg font-bold text-white mt-0.5">
                          {g.nameEs}
                        </div>
                        <p className="text-xs text-[#CBD5E1] mt-1">{g.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* D. Armamento Principal Austriaco */}
              <div>
                <h4 className="font-display text-lg font-bold text-white mb-2">
                  D. Armamento Reglamentario EKO Cobra (Sin M4 Estadounidense)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(Object.keys(EKO_COBRA_WEAPONS) as PrimaryWeaponId[]).map((wId) => {
                    const w = EKO_COBRA_WEAPONS[wId];
                    const active = plan.primaryWeapon === wId;
                    return (
                      <div
                        key={wId}
                        onClick={() => onChangePlan({ ...plan, primaryWeapon: wId })}
                        className={`border p-4 cursor-pointer transition-colors ${
                          active
                            ? 'border-[#D97706] bg-[#D97706]/15'
                            : 'border-[#1E293B] bg-[#080C11] hover:border-[#475569]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-display text-lg font-bold text-white">{w.name}</span>
                          <span className="font-mono-tabular text-xs text-[#D97706]">
                            {w.caliber}
                          </span>
                        </div>
                        <p className="text-xs mt-1 text-[#CBD5E1]">{w.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {section === 'PSYCHOLOGY_AUDIO' && (
            <div className="space-y-5">
              <h3 className="font-display text-xl font-bold text-white">
                05. Motor de Psicología, Audio Austriaco y Tabla de Puntuación
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border border-[#1E293B] bg-[#080C11] p-5 space-y-2 text-xs">
                  <h4 className="font-display text-lg font-bold text-[#D97706]">
                    Comportamiento Psicológico de Sospechosos
                  </h4>
                  <p>
                    Cada sospechoso posee dos variables dinámicas: <strong>Moral (0-100)</strong> y{' '}
                    <strong>Estrés (0-100)</strong>.
                  </p>
                  <ul className="space-y-1.5">
                    <li>
                      • <strong>Rendición Inmediata:</strong> Si la moral cae por debajo de 25 tras gritos policiales, puntero láser, Gas Lacrimógeno CS o una <em>Blendgranate</em>, suelta el arma y se arrodilla.
                    </li>
                    <li>
                      • <strong>Rendición Fingida:</strong> Sospechosos veteranos (como Milan V.) pueden fingir rendirse durante 2.8s y sacar una segunda pistola si el jugador no los esposa rápido.
                    </li>
                  </ul>
                </div>

                <div className="border border-[#1E293B] bg-[#080C11] p-5 space-y-2 text-xs">
                  <h4 className="font-display text-lg font-bold text-[#10B981]">
                    Criterios de Calificación Policial (Grado S a F)
                  </h4>
                  <div className="space-y-1.5 font-mono-tabular">
                    <div className="flex justify-between border-b border-[#1E293B] pb-1">
                      <span>Arrestar sospechoso con vida (Handfesseln)</span>
                      <span className="text-[#10B981]">+250 PTS</span>
                    </div>
                    <div className="flex justify-between border-b border-[#1E293B] pb-1">
                      <span>Evacuar rehén / civil ileso</span>
                      <span className="text-[#10B981]">+200 PTS</span>
                    </div>
                    <div className="flex justify-between border-b border-[#1E293B] pb-1">
                      <span>Desarme con Gas Lacrimógeno CS / Taser X2</span>
                      <span className="text-[#10B981]">+100 a +180 PTS</span>
                    </div>
                    <div className="flex justify-between border-b border-[#1E293B] pb-1">
                      <span>Fuego letal sin amenaza activa (Violación WVG)</span>
                      <span className="text-[#EF4444]">-450 PTS</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
