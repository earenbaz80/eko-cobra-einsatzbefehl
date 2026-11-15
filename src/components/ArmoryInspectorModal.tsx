import React, { useEffect, useRef, useState } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';
import {
  Crosshair,
  Sliders,
  Flame,
  Check,
  X,
} from 'lucide-react';
import {
  EKO_COBRA_AMMO,
  EKO_COBRA_ATTACHMENTS,
  EKO_COBRA_WEAPONS,
} from '../game/grazMap';
import {
  AmmoTypeId,
  MissionPlan,
  PrimaryWeaponId,
  WeaponAttachmentId,
} from '../game/types';
import { soundEngine } from '../game/soundEngine';

interface ArmoryInspectorModalProps {
  plan: MissionPlan;
  onChangePlan: (updated: MissionPlan) => void;
  onClose: () => void;
}

export const ArmoryInspectorModal: React.FC<ArmoryInspectorModalProps> = ({
  plan,
  onChangePlan,
  onClose,
}) => {
  const dialogRef = useModalA11y();
  const [selectedWeapon, setSelectedWeapon] = useState<PrimaryWeaponId>(
    plan.primaryWeapon
  );
  const [selectedAttachment, setSelectedAttachment] = useState<WeaponAttachmentId>(
    plan.attachment ?? 'NONE'
  );
  const [selectedAmmo, setSelectedAmmo] = useState<AmmoTypeId>(
    plan.ammoType ?? 'FMJ_STANDARD'
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const weaponSpec = EKO_COBRA_WEAPONS[selectedWeapon];

  // Apply choices to mission plan
  const handleApplyToPlan = () => {
    soundEngine.playOpticCam();
    onChangePlan({
      ...plan,
      primaryWeapon: selectedWeapon,
      attachment: selectedAttachment,
      ammoType: selectedAmmo,
    });
    onClose();
  };

  // Render interactive weapon schematic preview on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Dark grid background
    ctx.fillStyle = '#060B12';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 1;
    const gridSize = 24;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const cx = w * 0.5;
    const cy = h * 0.5;

    // Draw weapon schematic silhouette
    ctx.save();
    ctx.translate(cx, cy);

    const isAug = selectedWeapon === 'AUG_A3' || selectedWeapon === 'AUG_PARA';
    const isMp7 = selectedWeapon === 'MP7A1';
    const isShield = selectedWeapon === 'GLOCK_SHIELD';

    // Glow effect
    ctx.shadowBlur = 18;
    ctx.shadowColor = 'rgba(56, 189, 248, 0.5)';
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2.5;

    if (isAug) {
      // Steyr AUG Bullpup outline
      ctx.beginPath();
      // Receiver & Barrel
      ctx.strokeRect(-120, -12, 220, 24);
      // Bullpup Magazine at rear
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(-80, 12, 32, 55);
      ctx.strokeRect(-80, 12, 32, 55);
      // Pistol Grip
      ctx.fillRect(20, 12, 28, 48);
      ctx.strokeRect(20, 12, 28, 48);
      // Foregrip / Underbarrel
      ctx.fillRect(80, 12, 16, 36);
      ctx.strokeRect(80, 12, 16, 36);
      // Extended Barrel Tip
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(100, -6, 45, 12);
      ctx.strokeRect(100, -6, 45, 12);
      // Scope / Rail Top
      ctx.fillRect(-40, -28, 120, 16);
      ctx.strokeRect(-40, -28, 120, 16);
    } else if (isMp7) {
      // MP7A1 Compact SMG outline
      ctx.beginPath();
      ctx.strokeRect(-80, -10, 150, 20);
      // Pistol Grip
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(-10, 10, 24, 45);
      ctx.strokeRect(-10, 10, 24, 45);
      // Folding Front Grip
      ctx.fillRect(45, 10, 14, 32);
      ctx.strokeRect(45, 10, 14, 32);
      // Top Picatinny Rail
      ctx.fillRect(-60, -20, 120, 10);
      ctx.strokeRect(-60, -20, 120, 10);
    } else if (isShield) {
      // Glock 17 + Tactical Ballistic Shield
      // Heavy Shield
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 3;
      ctx.fillRect(-110, -70, 75, 140);
      ctx.strokeRect(-110, -70, 75, 140);
      // Shield Viewport Window
      ctx.fillStyle = 'rgba(56, 189, 248, 0.3)';
      ctx.fillRect(-95, -45, 45, 25);
      ctx.strokeRect(-95, -45, 45, 25);
      // Glock Pistol
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.strokeRect(-15, -8, 70, 16);
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(10, 8, 18, 35);
      ctx.strokeRect(10, 8, 18, 35);
    }

    // Attachment Overlay (Suppressor / Laser Beam)
    if (selectedAttachment === 'SUPPRESSOR') {
      ctx.fillStyle = '#94A3B8';
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2;
      const barrelX = isAug ? 145 : isMp7 ? 70 : 55;
      ctx.fillRect(barrelX, -8, 50, 16);
      ctx.strokeRect(barrelX, -8, 50, 16);
    } else if (selectedAttachment === 'RED_DOT_LASER' || selectedAttachment === 'IR_LASER') {
      // Laser beam line emanating from front
      const laserColor = selectedAttachment === 'IR_LASER' ? '#10B981' : '#EF4444';
      ctx.strokeStyle = laserColor;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(120, 0);
      ctx.lineTo(240, 0);
      ctx.stroke();
      ctx.setLineDash([]);

      // Laser dot on target wall
      ctx.fillStyle = laserColor;
      ctx.beginPath();
      ctx.arc(240, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Corner Telemetry HUD Labels
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#38BDF8';
    ctx.textAlign = 'left';
    ctx.fillText(`DESPIECE BLAUPAUSE: ${weaponSpec.name.toUpperCase()}`, 12, 22);

    ctx.fillStyle = '#94A3B8';
    ctx.fillText(`CALIBRE: ${weaponSpec.caliber} · CADENCIA: ${weaponSpec.rpm} RPM`, 12, 38);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#F59E0B';
    ctx.fillText(`PESO: ${weaponSpec.weightKg} kg`, w - 12, 22);
    ctx.fillStyle = '#10B981';
    ctx.fillText(`CARGADOR: ${weaponSpec.magSize} PROYECTILES`, w - 12, 38);
  }, [selectedWeapon, selectedAttachment, selectedAmmo, weaponSpec]);

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
        aria-label="Armería táctica: armas, accesorios y munición"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1E293B] px-6 py-4 bg-[#0F172A] shrink-0">
          <div className="flex items-center gap-3">
            <Crosshair className="w-7 h-7 text-[#38BDF8] shrink-0" />
            <div>
              <div className="text-xs font-mono-tabular text-[#D97706] tracking-wider uppercase">
                ARMERÍA TÁCTICA EKO COBRA · BUNDESPOLIZEI DSE
              </div>
              <h2 className="font-display text-xl md:text-2xl font-bold tracking-wide text-white">
                Inspección de Armamento y Balística C4I
              </h2>
            </div>
          </div>
          <button
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            className="p-2 text-[#94A3B8] hover:text-white hover:bg-[#1E293B] transition-colors cursor-pointer"
            title="Cerrar Inspector"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Body Grid */}
        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto flex-1">
          {/* Left Column: Interactive Weapon Selector & Visual Canvas */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {/* Weapon Selector Tabs */}
            <div className="flex flex-wrap gap-2 bg-[#060B12] p-2 border border-[#1E293B]">
              {(['AUG_PARA', 'AUG_A3', 'MP7A1', 'GLOCK_SHIELD'] as PrimaryWeaponId[]).map((wId) => {
                const spec = EKO_COBRA_WEAPONS[wId];
                const isSelected = selectedWeapon === wId;
                return (
                  <button
                    key={wId}
                    onClick={() => {
                      soundEngine.playUiClick();
                      setSelectedWeapon(wId);
                    }}
                    className={`flex-1 min-w-[120px] px-3 py-2.5 text-xs font-mono-tabular font-bold border transition-all cursor-pointer flex flex-col items-center gap-1 ${
                      isSelected
                        ? 'bg-[#38BDF8] text-black border-[#7DD3FC] shadow-[0_0_15px_rgba(56,189,248,0.4)]'
                        : 'bg-[#0F172A] text-[#94A3B8] border-[#334155] hover:border-[#38BDF8]/60 hover:text-white'
                    }`}
                  >
                    <span className="truncate">{spec.name.replace('Steyr ', '')}</span>
                    <span className={`text-[9px] ${isSelected ? 'text-black/80' : 'text-[#64748B]'}`}>
                      {spec.caliber}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Live Interactive Canvas Schematic */}
            <div className="relative bg-[#060B12] border border-[#334155] h-64 overflow-hidden flex items-center justify-center">
              <canvas
                ref={canvasRef}
                width={520}
                height={256}
                className="w-full h-full object-contain"
              />
              <div className="absolute bottom-2 left-2 px-2 py-1 bg-[#080C11]/80 border border-[#334155] text-[9px] font-mono-tabular text-[#94A3B8]">
                ESQUEMA DE MASA Y MONTAJE BALÍSTICO
              </div>
            </div>

            {/* Weapon Description Note */}
            <div className="p-3 bg-[#0F172A] border border-[#1E293B] text-xs text-[#CBD5E1] leading-relaxed">
              <strong className="text-white font-mono-tabular block mb-1">
                {weaponSpec.name} ({weaponSpec.origin})
              </strong>
              {weaponSpec.description}
            </div>

            {/* Real-time Ballistic Performance Meters */}
            <div className="bg-[#080C11] border border-[#334155] p-4 flex flex-col gap-3 font-mono-tabular text-xs">
              <div className="text-[10px] text-[#D97706] font-bold tracking-wider uppercase border-b border-[#1E293B] pb-1">
                MÉTRICAS TÁCTICAS DE RENDIMIENTO
              </div>

              {/* Meter 1: Cadencia RPM */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#94A3B8] w-32 shrink-0">Cadencia (RPM):</span>
                <div className="flex-1 h-3 bg-[#1E293B] overflow-hidden flex items-center">
                  <div
                    className="h-full bg-[#38BDF8]"
                    style={{ width: `${Math.min(100, (weaponSpec.rpm / 950) * 100)}%` }}
                  />
                </div>
                <span className="font-bold text-white w-14 text-right">{weaponSpec.rpm}</span>
              </div>

              {/* Meter 2: Daño por Disparo */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#94A3B8] w-32 shrink-0">Poder de Parada:</span>
                <div className="flex-1 h-3 bg-[#1E293B] overflow-hidden flex items-center">
                  <div
                    className="h-full bg-[#F59E0B]"
                    style={{ width: `${Math.min(100, (weaponSpec.damage / 38) * 100)}%` }}
                  />
                </div>
                <span className="font-bold text-[#FDE68A] w-14 text-right">{weaponSpec.damage} PTS</span>
              </div>

              {/* Meter 3: Supresión / Morale Drop */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#94A3B8] w-32 shrink-0">Bonus Supresión:</span>
                <div className="flex-1 h-3 bg-[#1E293B] overflow-hidden flex items-center">
                  <div
                    className="h-full bg-[#10B981]"
                    style={{ width: `${Math.min(100, (weaponSpec.suppressionBonus / 28) * 100)}%` }}
                  />
                </div>
                <span className="font-bold text-[#A7F3D0] w-14 text-right">+{weaponSpec.suppressionBonus}</span>
              </div>

              {/* Meter 4: Dispersión & Estabilidad */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#94A3B8] w-32 shrink-0">Dispersión Cañón:</span>
                <div className="flex-1 h-3 bg-[#1E293B] overflow-hidden flex items-center">
                  <div
                    className="h-full bg-[#EF4444]"
                    style={{ width: `${Math.min(100, (weaponSpec.spread / 0.05) * 100)}%` }}
                  />
                </div>
                <span className="font-bold text-[#FECDD3] w-14 text-right">{(weaponSpec.spread * 1000).toFixed(1)} mrad</span>
              </div>
            </div>
          </div>

          {/* Right Column: Attachments & Ammo Customization */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4">
            {/* Attachment Selector */}
            <div className="bg-[#080C11] border border-[#334155] p-4 flex flex-col gap-3 font-mono-tabular">
              <div className="text-xs font-bold text-[#38BDF8] border-b border-[#1E293B] pb-1.5 flex items-center justify-between">
                <span>ACCESORIO BALÍSTICO (ATTACHMENT)</span>
                <Sliders className="w-4 h-4 text-[#38BDF8]" />
              </div>

              <div className="grid grid-cols-1 gap-2">
                {(['NONE', 'SUPPRESSOR', 'RED_DOT_LASER', 'IR_LASER'] as WeaponAttachmentId[]).map((attId) => {
                  const spec = EKO_COBRA_ATTACHMENTS[attId];
                  const isSelected = selectedAttachment === attId;
                  return (
                    <button
                      key={attId}
                      onClick={() => {
                        soundEngine.playUiClick();
                        setSelectedAttachment(attId);
                      }}
                      className={`w-full text-left p-2.5 text-xs border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-[#1E293B] text-white border-[#38BDF8] shadow-[0_0_10px_rgba(56,189,248,0.25)]'
                          : 'bg-[#0F172A]/70 text-[#94A3B8] border-[#334155] hover:border-[#64748B]'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-white">{spec.nameEs}</div>
                        <div className="text-[10px] text-[#94A3B8] font-normal">{spec.description}</div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-[#38BDF8] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ammo Type Selector */}
            <div className="bg-[#080C11] border border-[#334155] p-4 flex flex-col gap-3 font-mono-tabular">
              <div className="text-xs font-bold text-[#F59E0B] border-b border-[#1E293B] pb-1.5 flex items-center justify-between">
                <span>TIPO DE MUNICIÓN BALÍSTICA</span>
                <Flame className="w-4 h-4 text-[#F59E0B]" />
              </div>

              <div className="grid grid-cols-1 gap-2">
                {(['FMJ_STANDARD', 'JHP_HOLLOW', 'AP_PIERCING'] as AmmoTypeId[]).map((ammoId) => {
                  const spec = EKO_COBRA_AMMO[ammoId];
                  const isSelected = selectedAmmo === ammoId;
                  return (
                    <button
                      key={ammoId}
                      onClick={() => {
                        soundEngine.playUiClick();
                        setSelectedAmmo(ammoId);
                      }}
                      className={`w-full text-left p-2.5 text-xs border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-[#1E293B] text-white border-[#F59E0B] shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                          : 'bg-[#0F172A]/70 text-[#94A3B8] border-[#334155] hover:border-[#64748B]'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-[#FDE68A]">{spec.nameEs}</div>
                        <div className="text-[10px] text-[#94A3B8] font-normal">{spec.description}</div>
                        <div className="text-[9px] text-[#D97706] mt-0.5">
                          Penetración: {spec.armorPenetration * 100}% · Riesgo Traspaso: {spec.overpenetrationRisk}
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-[#F59E0B] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Action Button */}
            <button
              onClick={handleApplyToPlan}
              className="w-full py-3.5 bg-[#38BDF8] hover:bg-[#7DD3FC] text-black font-mono-tabular font-extrabold text-sm uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(56,189,248,0.4)] cursor-pointer flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              <Check className="w-5 h-5 text-black shrink-0" />
              <span>EQUIPAR CONFIGURACIÓN EN PLAN DE MISIÓN</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
