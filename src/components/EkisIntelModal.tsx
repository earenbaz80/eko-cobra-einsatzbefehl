import React, { useState } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';
import {
  AlertTriangle,
  Search,
  X,
  Radio,
  ChevronRight,
} from 'lucide-react';
import { soundEngine } from '../game/soundEngine';

interface EkisIntelModalProps {
  onClose: () => void;
}

interface DossierEntry {
  id: string;
  name: string;
  role: 'SUSPECT' | 'HOSTAGE';
  ekisCode: string;
  facialMatchPct: number;
  threatLevel: 'EXTREMO' | 'ALTO' | 'MODERADO' | 'PROTECCIÓN';
  warrantStatus: string;
  knownWeapon: string;
  dossierNote: string;
  photoUrl?: string;
  crimes: string[];
}

const INTEL_DOSSIERS: DossierEntry[] = [
  {
    id: 'milan',
    name: 'Milan Petrovic ("Der Schläfer")',
    role: 'SUSPECT',
    ekisCode: 'EKIS-AT #884-A',
    facialMatchPct: 98.4,
    threatLevel: 'EXTREMO',
    warrantStatus: 'Orden de captura internacional INTERPOL (Alerta Roja)',
    knownWeapon: 'Steyr M9-A1 9mm / Falsas rendiciones',
    dossierNote: 'Antiguo contratista militar con entrenamiento en explosivos. Propenso a fingir entrega pacificadora para desarmar agentes.',
    crimes: [
      'Tráfico de armamento en Graz-Lend',
      'Coacción armada a rehenes',
      'Resistencia violenta a la autoridad',
    ],
  },
  {
    id: 'markus',
    name: 'Markus Lindner ("Klaus")',
    role: 'SUSPECT',
    ekisCode: 'EKIS-AT #912-B',
    facialMatchPct: 96.8,
    threatLevel: 'ALTO',
    warrantStatus: 'Búsqueda y captura expedita DSE',
    knownWeapon: 'Subfusil automático / Carga C4',
    dossierNote: 'Atrincherado con parapetos pesados en zonas cerradas. Responde con ráfagas continuadas al escuchar brechas.',
    crimes: [
      'Asociación ilícita fuertemente armada',
      'Posesión de explosivos de uso militar',
    ],
  },
  {
    id: 'frank',
    name: 'Frank Bauer',
    role: 'SUSPECT',
    ekisCode: 'EKIS-AT #405-C',
    facialMatchPct: 94.2,
    threatLevel: 'MODERADO',
    warrantStatus: 'Investigación abierta por extorsión',
    knownWeapon: 'Pistola de puño Makarov 9mm',
    dossierNote: 'Alta inestabilidad psicológica. Vulnerable a intimidación verbal violenta de la policía [SPACE] o gas CS [G].',
    crimes: [
      'Extorsión y secuestro',
      'Portación ilegal de armas de fuego',
    ],
  },
  {
    id: 'julia',
    name: 'Julia M. (Rehén Principal)',
    role: 'HOSTAGE',
    ekisCode: 'ZMR-AT #771-J',
    facialMatchPct: 99.1,
    threatLevel: 'PROTECCIÓN',
    warrantStatus: 'Víctima prioritaria de rescate (Rescate limpio)',
    knownWeapon: 'Ninguna (Inocente desarmada)',
    dossierNote: 'Residente retenida bajo amenaza directa de arma corta. Mantener estricta disciplina de fuego §7 WVG.',
    crimes: ['Ninguno - Ciudadana austríaca'],
  },
  {
    id: 'weber',
    name: 'Dr. Karl Weber',
    role: 'HOSTAGE',
    ekisCode: 'ZMR-AT #520-[#]',
    facialMatchPct: 97.5,
    threatLevel: 'PROTECCIÓN',
    warrantStatus: 'Civil atrapado en sector de brecha',
    knownWeapon: 'Ninguna',
    dossierNote: 'Químico civil. Cumplirá órdenes de ponerse cuerpo a tierra al escuchar grito policial `[SPACE]`.',
    crimes: ['Ninguno - Civil no combatiente'],
  },
];

export const EkisIntelModal: React.FC<EkisIntelModalProps> = ({ onClose }) => {
  const dialogRef = useModalA11y();
  const [filterRole, setFilterRole] = useState<'ALL' | 'SUSPECT' | 'HOSTAGE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDossier, setSelectedDossier] = useState<DossierEntry>(INTEL_DOSSIERS[0]);

  const filteredDossiers = INTEL_DOSSIERS.filter((d) => {
    if (filterRole !== 'ALL' && d.role !== filterRole) return false;
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      return (
        d.name.toLowerCase().includes(q) ||
        d.ekisCode.toLowerCase().includes(q) ||
        d.warrantStatus.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#080C11]/95 p-4 md:p-6 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-6xl border border-[#38BDF8]/60 bg-[#0B111A] text-[#E2E8F0] shadow-[0_0_50px_rgba(0,0,0,0.9)] flex flex-col max-h-[92vh] overflow-hidden"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Archivos de inteligencia EKIS: sospechosos y rehenes"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1E293B] px-6 py-4 bg-[#0F172A] shrink-0">
          <div className="flex items-center gap-3">
            <Radio className="w-7 h-7 text-[#38BDF8] shrink-0 animate-pulse" />
            <div>
              <div className="text-xs font-mono-tabular text-[#D97706] tracking-wider uppercase">
                BASE DE DATOS POLICIAL EKIS / DSE COMMAND INTELLIGENCE
              </div>
              <h2 className="font-display text-xl md:text-2xl font-bold tracking-wide text-white">
                Archivos de Inteligencia y Fichas Criminales EKO Cobra
              </h2>
            </div>
          </div>
          <button
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            className="p-2 text-[#94A3B8] hover:text-white hover:bg-[#1E293B] transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Body Grid */}
        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto flex-1">
          {/* Left Column: Search & List Selection */}
          <div className="lg:col-span-5 flex flex-col gap-4 border-r border-[#1E293B] pr-0 lg:pr-4">
            {/* Filter Tabs & Search */}
            <div className="flex flex-col gap-2 font-mono-tabular">
              <div className="relative">
                <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, código EKIS..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#060B12] border border-[#334155] text-xs text-white placeholder-[#64748B] focus:border-[#38BDF8] focus:outline-none"
                />
              </div>

              <div className="flex gap-1 bg-[#060B12] p-1 border border-[#1E293B]">
                <button
                  onClick={() => {
                    soundEngine.playUiClick();
                    setFilterRole('ALL');
                  }}
                  className={`flex-1 py-1.5 text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                    filterRole === 'ALL'
                      ? 'bg-[#38BDF8] text-black'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  TODOS ({INTEL_DOSSIERS.length})
                </button>
                <button
                  onClick={() => {
                    soundEngine.playUiClick();
                    setFilterRole('SUSPECT');
                  }}
                  className={`flex-1 py-1.5 text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                    filterRole === 'SUSPECT'
                      ? 'bg-[#EF4444] text-white'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  SOSPECHOSOS
                </button>
                <button
                  onClick={() => {
                    soundEngine.playUiClick();
                    setFilterRole('HOSTAGE');
                  }}
                  className={`flex-1 py-1.5 text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                    filterRole === 'HOSTAGE'
                      ? 'bg-[#10B981] text-black'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  REHENES
                </button>
              </div>
            </div>

            {/* List Entries */}
            <div className="flex flex-col gap-2 overflow-y-auto max-h-[460px]">
              {filteredDossiers.map((d) => {
                const isSelected = selectedDossier.id === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => {
                      soundEngine.playUiClick();
                      setSelectedDossier(d);
                    }}
                    className={`w-full text-left p-3 border transition-all cursor-pointer flex items-center justify-between font-mono-tabular ${
                      isSelected
                        ? d.role === 'SUSPECT'
                          ? 'bg-[#7F1D1D]/40 border-[#EF4444] text-white shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                          : 'bg-[#064E3B]/40 border-[#10B981] text-white shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                        : 'bg-[#0F172A] border-[#334155] text-[#CBD5E1] hover:border-[#64748B]'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs flex items-center gap-2">
                        <span>{d.name}</span>
                        <span
                          className={`text-[8.5px] px-1.5 py-0.5 font-extrabold ${
                            d.role === 'SUSPECT'
                              ? 'bg-[#EF4444] text-white'
                              : 'bg-[#10B981] text-black'
                          }`}
                        >
                          {d.threatLevel}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#94A3B8] mt-0.5">
                        {d.ekisCode} · Coincidencia Facial: {d.facialMatchPct}%
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Detailed Intelligence Dossier Inspector */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-4 bg-[#060B12] p-5 border border-[#334155] font-mono-tabular">
            <div className="flex flex-col gap-4">
              {/* Top Banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E293B] pb-3">
                <div>
                  <div className="text-[10px] text-[#D97706] font-bold tracking-widest uppercase">
                    DOSSIER EKIS {selectedDossier.ekisCode}
                  </div>
                  <h3 className="text-lg font-extrabold text-white">
                    {selectedDossier.name}
                  </h3>
                </div>
                <div
                  className={`px-3 py-1 text-xs font-black uppercase ${
                    selectedDossier.role === 'SUSPECT'
                      ? 'bg-[#EF4444] text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                      : 'bg-[#10B981] text-black shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                  }`}
                >
                  NIVEL: {selectedDossier.threatLevel}
                </div>
              </div>

              {/* Warrant & Match Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-[#0F172A] border border-[#1E293B]">
                  <span className="text-[#94A3B8] block text-[10px]">ESTADO JUDICIAL:</span>
                  <span className="font-bold text-[#FDE68A]">{selectedDossier.warrantStatus}</span>
                </div>
                <div className="p-2.5 bg-[#0F172A] border border-[#1E293B]">
                  <span className="text-[#94A3B8] block text-[10px]">ARMAMENTO REGISTRADO:</span>
                  <span className="font-bold text-[#38BDF8]">{selectedDossier.knownWeapon}</span>
                </div>
              </div>

              {/* Tactical Psychological Note */}
              <div className="p-3 bg-[#0F172A] border border-[#334155]">
                <span className="text-[#38BDF8] font-bold block text-[10px] mb-1 uppercase">
                  INFORMACIÓN INTELIGENCIA C4I &amp; PERFIL PSICOLÓGICO:
                </span>
                <p className="text-xs text-[#E2E8F0] leading-relaxed">
                  {selectedDossier.dossierNote}
                </p>
              </div>

              {/* Crimes / Background */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-[#94A3B8] font-bold uppercase">
                  ANTECEDENTES REGISTRADOS EN FICHA:
                </span>
                <ul className="flex flex-col gap-1 text-xs">
                  {selectedDossier.crimes.map((c, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-[#CBD5E1]">
                      <ChevronRight className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Bottom Warning Badge */}
            <div className="p-3 bg-[#0F172A] border border-[#D97706]/60 text-[10.5px] text-[#FDE68A] flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-[#D97706] shrink-0" />
              <span>
                DIRECTRIZ WAFFENGEBRAUCHSGESETZ §7: Identifica con cámara/escáner `[B]` antes de emplear fuerza letal. Los arrestos con vida bonifican +250 PTS ROE.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
