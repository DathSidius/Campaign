import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Code2,
  Copy,
  Crown,
  Dices,
  Download,
  Eye,
  EyeOff,
  FileCode,
  FlaskConical,
  HeartPulse,
  History,
  Map as MapIcon,
  Monitor,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  Skull,
  Sparkles,
  Swords,
  Terminal,
  X,
} from 'lucide-react';
import { COMBATS, ENCOUNTERS, type CombatItem, type EncounterItem } from './randomizerData';
import {
  COMBAT_SCALING,
  INGREDIENTS_TABLE,
  POTION_LOOT,
  type CombatLevelScaling,
  type DndSuStatblock,
  type IngredientPriceItem,
  type PartyLevel,
  type PotionLootItem,
} from './alchemyAndStatsData';
import { HEAVY_INJURIES, PERMANENT_INJURIES, type InjuryItem } from './injuriesData';
import { ARTIFACTS_TABLE, type ArtifactItem, type ArtifactRarity } from './artifactsData';
import csRawCode from './MorionRandomizer.cs?raw';
import batRawCode from './Build_MorionRandomizer.bat?raw';

type CategoryKey =
  | 'road'
  | 'wild'
  | 'water'
  | 'combat'
  | 'artifacts'
  | 'injuries'
  | 'potions'
  | 'ingredients';
type SandboxTab = 'preview' | 'code';
type CodeFileTab = 'cs' | 'bat';

interface ListRow {
  id: string;
  title: string;
  meta: string;
  rangeLabel: string;
  isBoss: boolean;
  min: number;
  max: number;
  encounter?: EncounterItem;
  combat?: CombatItem;
  potion?: PotionLootItem;
  ingredient?: IngredientPriceItem;
}

interface HistoryEntry {
  cat: CategoryKey;
  roll: number;
  label: string;
}

const EDITS_STORAGE_KEY = 'morion_dm_field_edits_v2';
const CUSTOM_ARTIFACTS_KEY = 'morion_custom_artifacts_v2';

const THREAT_OPTIONS = [
  { code: 'all', label: 'Угроза: Все' },
  { code: 'darklands', label: 'Тёмные Земли' },
  { code: 'illithids', label: 'Иллитиды' },
  { code: 'owls', label: 'Взгляд Совы' },
  { code: 'vampires', label: 'Аманж (Вампиры)' },
  { code: 'empire', label: 'Империя / Война' },
  { code: 'orcs', label: 'Орки Зорга' },
  { code: 'elves', label: 'Эльмаэль' },
  { code: 'antihi', label: 'Антихи Вольска' },
] as const;

const PARTY_LEVELS: PartyLevel[] = [4, 6, 8];

const RARITY_ORDER: ArtifactRarity[] = [
  'Обычный',
  'Необычный',
  'Редкий',
  'Очень редкий',
  'Легендарный',
];

export const SandboxPreview: React.FC<{ onOpenMap: () => void }> = ({ onOpenMap }) => {
  const [sandboxTab, setSandboxTab] = useState<SandboxTab>('preview');
  const [codeTab, setCodeTab] = useState<CodeFileTab>('cs');
  const [copiedCode, setCopiedCode] = useState(false);

  const [category, setCategory] = useState<CategoryKey>('road');
  const [partyLevel, setPartyLevel] = useState<PartyLevel>(4);
  const [afterMines, setAfterMines] = useState(true);
  const [showSecrets, setShowSecrets] = useState(true);
  const [editModeAll, setEditModeAll] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [threatCode, setThreatCode] = useState('all');
  const [manualRollInput, setManualRollInput] = useState(50);
  const [lastRollValue, setLastRollValue] = useState(0);
  const [selectedId, setSelectedId] = useState<string>('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [copiedDetail, setCopiedDetail] = useState(false);
  const [quickPotion, setQuickPotion] = useState<{ roll: number; item: PotionLootItem } | null>(null);
  const [quickInjury, setQuickInjury] = useState<{
    mode: 'heavy' | 'permanent';
    dice: number[];
    total: number;
    item: InjuryItem;
  } | null>(null);

  const [fieldEdits, setFieldEdits] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(EDITS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const [customArtifacts, setCustomArtifacts] = useState<ArtifactItem[]>(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_ARTIFACTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(EDITS_STORAGE_KEY, JSON.stringify(fieldEdits));
    } catch {
      // ignore storage quota errors
    }
  }, [fieldEdits]);

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_ARTIFACTS_KEY, JSON.stringify(customArtifacts));
    } catch {
      // ignore storage quota errors
    }
  }, [customArtifacts]);

  const getField = (key: string, fallback: string): string =>
    key in fieldEdits ? fieldEdits[key] : fallback;

  const setField = (key: string, value: string, fallback: string) => {
    setFieldEdits((prev) => {
      const next = { ...prev };
      if (value === fallback) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  };

  const resetAllEdits = () => {
    setFieldEdits({});
    setCustomArtifacts([]);
  };

  const editsCount = Object.keys(fieldEdits).length + customArtifacts.length;

  const categoryTabs: { key: CategoryKey; label: string; count: number }[] = [
    { key: 'road', label: 'Дороги', count: 25 },
    { key: 'wild', label: 'Дикие земли', count: 25 },
    { key: 'water', label: 'Вода и море', count: 25 },
    { key: 'combat', label: 'Бои и боссы', count: 11 },
    { key: 'artifacts', label: 'Артефакты', count: ARTIFACTS_TABLE.length + customArtifacts.length },
    { key: 'injuries', label: 'Травмы', count: 38 },
    { key: 'potions', label: 'Зелья d100', count: 36 },
    { key: 'ingredients', label: 'Травы и цены', count: 23 },
  ];

  const combatById = useMemo(() => {
    const map = new Map<string, CombatItem>();
    for (const c of COMBATS) map.set(c.Id, c);
    return map;
  }, []);

  const buildRowsForCategory = (
    cat: CategoryKey,
    qRaw: string,
    threat: string,
    mines: boolean,
    secrets: boolean
  ): ListRow[] => {
    const q = qRaw.trim().toLowerCase();
    if (cat === 'combat') {
      return COMBATS.filter((c) => {
        if (!mines && c.AfterMinesOnly) return false;
        if (threat !== 'all' && !c.Tags.includes(threat)) return false;
        if (q) {
          const hay = (
            getField(`combat:${c.Id}:Title`, c.Title) +
            ' ' +
            c.Enemies +
            ' ' +
            getField(`combat:${c.Id}:Motivation`, c.Motivation) +
            ' ' +
            getField(`combat:${c.Id}:Tactics`, c.Tactics) +
            ' ' +
            getField(`combat:${c.Id}:Reward`, c.Reward) +
            ' ' +
            (secrets ? getField(`combat:${c.Id}:TwistOrSecret`, c.TwistOrSecret) : '')
          ).toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }).map((c) => ({
        id: c.Id,
        title: getField(`combat:${c.Id}:Title`, c.Title),
        meta: getField(`combat:${c.Id}:DangerLevel`, c.DangerLevel),
        rangeLabel: `${String(c.Min).padStart(2, '0')}–${String(c.Max).padStart(2, '0')}`,
        isBoss: c.IsBoss,
        min: c.Min,
        max: c.Max,
        combat: c,
      }));
    }

    if (cat === 'potions') {
      return POTION_LOOT.filter((p) => {
        if (!q) return true;
        return (
          getField(`potion:${p.id}:name`, p.name) +
          ' ' +
          getField(`potion:${p.id}:source`, p.source) +
          ' ' +
          getField(`potion:${p.id}:ingredients`, p.ingredients) +
          ' ' +
          getField(`potion:${p.id}:effect`, p.effect)
        )
          .toLowerCase()
          .includes(q);
      }).map((p) => ({
        id: p.id,
        title: `${getField(`potion:${p.id}:name`, p.name)} (${getField(`potion:${p.id}:source`, p.source)})`,
        meta: `СЛ ${getField(`potion:${p.id}:craftDc`, p.craftDc)} · ${getField(`potion:${p.id}:ingredients`, p.ingredients)}`,
        rangeLabel: `${String(p.min).padStart(2, '0')}–${String(p.max).padStart(2, '0')}`,
        isBoss: false,
        min: p.min,
        max: p.max,
        potion: p,
      }));
    }

    if (cat === 'ingredients') {
      return INGREDIENTS_TABLE.filter((ing) => {
        if (!q) return true;
        return (
          getField(`ing:${ing.id}:name`, ing.name) +
          ' ' +
          getField(`ing:${ing.id}:rarity`, ing.rarity) +
          ' ' +
          getField(`ing:${ing.id}:biome`, ing.biome)
        )
          .toLowerCase()
          .includes(q);
      }).map((ing, idx) => ({
        id: ing.id,
        title: getField(`ing:${ing.id}:name`, ing.name),
        meta: `${ing.rarity} · ${ing.biome}`,
        rangeLabel: getField(`ing:${ing.id}:base`, ing.base),
        isBoss: false,
        min: Math.floor((idx * 100) / INGREDIENTS_TABLE.length) + 1,
        max: Math.floor(((idx + 1) * 100) / INGREDIENTS_TABLE.length),
        ingredient: ing,
      }));
    }

    if (cat === 'road' || cat === 'wild' || cat === 'water') {
      return ENCOUNTERS.filter((e) => {
        if (e.Category !== cat) return false;
        if (!mines && e.AfterMinesOnly) return false;
        if (threat !== 'all' && !e.Tags.includes(threat)) return false;
        if (q) {
          const hay = (
            getField(`enc:${e.Id}:Title`, e.Title) +
            ' ' +
            getField(`enc:${e.Id}:Regions`, e.Regions) +
            ' ' +
            getField(`enc:${e.Id}:Summary`, e.Summary) +
            ' ' +
            getField(`enc:${e.Id}:SceneDetails`, e.SceneDetails) +
            ' ' +
            (secrets ? getField(`enc:${e.Id}:MasterSecret`, e.MasterSecret) : '')
          ).toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }).map((e) => ({
        id: e.Id,
        title: getField(`enc:${e.Id}:Title`, e.Title),
        meta: getField(`enc:${e.Id}:Regions`, e.Regions),
        rangeLabel: `${String(e.Min).padStart(2, '0')}–${String(e.Max).padStart(2, '0')}`,
        isBoss: e.Mood === 'boss',
        min: e.Min,
        max: e.Max,
        encounter: e,
      }));
    }

    return [];
  };

  const rows = useMemo(
    () => buildRowsForCategory(category, searchQuery, threatCode, afterMines, showSecrets),
    [category, searchQuery, threatCode, afterMines, showSecrets, fieldEdits]
  );

  const activeIndex = useMemo(() => {
    if (rows.length === 0) return -1;
    const found = rows.findIndex((r) => r.id === selectedId);
    return found >= 0 ? found : 0;
  }, [rows, selectedId]);

  const activeRow = activeIndex >= 0 ? rows[activeIndex] : undefined;

  const isPagedCategory =
    category === 'road' || category === 'wild' || category === 'water' || category === 'combat' || category === 'potions';

  const stepSelection = (delta: number) => {
    if (rows.length === 0) return;
    const nextIdx = (activeIndex + delta + rows.length) % rows.length;
    setSelectedId(rows[nextIdx].id);
    setLastRollValue(0);
    setQuickPotion(null);
    setQuickInjury(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sandboxTab !== 'preview' || !isPagedCategory) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      ) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepSelection(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepSelection(1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sandboxTab, isPagedCategory, rows, activeIndex]);

  const performRoll = (rollVal: number, targetCategory?: CategoryKey) => {
    const roll = Math.max(1, Math.min(100, Math.round(rollVal || 1)));
    const cat = targetCategory ?? category;
    const candidateRows =
      targetCategory && targetCategory !== category
        ? buildRowsForCategory(targetCategory, '', 'all', afterMines, showSecrets)
        : rows;

    if (targetCategory && targetCategory !== category) {
      setCategory(targetCategory);
      setSearchQuery('');
      setThreatCode('all');
    }

    if (candidateRows.length === 0) return;

    let picked = candidateRows.find((r) => roll >= r.min && roll <= r.max);
    if (!picked) {
      picked = candidateRows[Math.floor(Math.random() * candidateRows.length)];
    }

    setSelectedId(picked.id);
    setLastRollValue(roll);
    setManualRollInput(roll);
    setQuickPotion(null);
    setQuickInjury(null);

    if (!targetCategory) {
      const entry: HistoryEntry = {
        cat,
        roll,
        label: `[${cat.toUpperCase()}] d100 → ${roll}: ${picked.title}`,
      };
      setHistory((prev) => [entry, ...prev].slice(0, 12));
    }
  };

  const handleCategoryChange = (nextCat: CategoryKey) => {
    setCategory(nextCat);
    setLastRollValue(0);
    setSelectedId('');
    setQuickPotion(null);
    setQuickInjury(null);
    setDrawerOpen(false);
  };

  const rollQuickPotion = () => {
    const r = Math.floor(Math.random() * 100) + 1;
    const found = POTION_LOOT.find((p) => r >= p.min && r <= p.max) ?? POTION_LOOT[0];
    setQuickPotion({ roll: r, item: found });
  };

  const rollQuickInjury = (mode: 'heavy' | 'permanent') => {
    const count = mode === 'heavy' ? 4 : 2;
    const dice = Array.from({ length: count }, () => Math.floor(Math.random() * 10) + 1);
    const total = dice.reduce((acc, n) => acc + n, 0);
    const table = mode === 'heavy' ? HEAVY_INJURIES : PERMANENT_INJURIES;
    const clamped =
      mode === 'heavy' ? Math.min(40, Math.max(4, total)) : Math.min(20, Math.max(2, total));
    const found = table.find((i) => clamped >= i.min && clamped <= i.max) ?? table[0];
    setQuickInjury({ mode, dice, total, item: found });
  };

  const formatCombatPlain = (c: CombatItem): string => {
    const scaling = COMBAT_SCALING[c.Id]?.[partyLevel];
    const lines = [
      getField(`combat:${c.Id}:Title`, c.Title),
      `Угроза: ${getField(`combat:${c.Id}:DangerLevel`, c.DangerLevel)}${c.AfterMinesOnly ? '  |  Только после шахт' : ''}`,
      scaling ? `Скейлинг (4 игрока · ${partyLevel} ур.): ${scaling.difficultyLabel}` : '',
      `Состав врагов: ${scaling ? getField(`tier:${c.Id}:${partyLevel}:composition`, scaling.composition) : c.Enemies}`,
      scaling ? `Заметка скейлинга: ${getField(`tier:${c.Id}:${partyLevel}:scalingNote`, scaling.scalingNote)}` : '',
      '',
      `Повод / Мотивация: ${getField(`combat:${c.Id}:Motivation`, c.Motivation)}`,
      `Тактика: ${getField(`combat:${c.Id}:Tactics`, c.Tactics)}`,
      `Награда: ${getField(`combat:${c.Id}:Reward`, c.Reward)}`,
    ].filter(Boolean);

    if (scaling?.statblocks?.length) {
      lines.push('', 'Полные статблоки (dnd.su):');
      scaling.statblocks.forEach((sb, idx) => {
        const k = `sb:${c.Id}:${partyLevel}:${idx}`;
        lines.push(
          `• ${getField(`${k}:name`, sb.name)} (${getField(`${k}:count`, sb.count)}) — ${getField(`${k}:typeSize`, sb.typeSize)}`,
          `  CR ${getField(`${k}:cr`, sb.cr)} | КД ${getField(`${k}:ac`, sb.ac)} | Хиты ${getField(`${k}:hp`, sb.hp)} | Скор. ${getField(`${k}:speed`, sb.speed)}`,
          `  СИЛ ${getField(`${k}:str`, sb.str)} | ЛОВ ${getField(`${k}:dex`, sb.dex)} | ТЕЛ ${getField(`${k}:con`, sb.con)} | ИНТ ${getField(`${k}:int`, sb.int)} | МУД ${getField(`${k}:wis`, sb.wis)} | ХАР ${getField(`${k}:cha`, sb.cha)}`,
          `  Свои спасброски: ${getField(`${k}:savingThrows`, sb.savingThrows)}`,
          `  Спасброски против врага: ${getField(`${k}:enemySavesDC`, sb.enemySavesDC)}`,
          `  Навыки: ${getField(`${k}:skills`, sb.skills)} | Защита: ${getField(`${k}:defenses`, sb.defenses)}`,
          `  Действия: ${getField(`${k}:attacks`, sb.attacks)}`,
          `  Особенности: ${getField(`${k}:traits`, sb.traits)}`
        );
      });
    }
    const secret = getField(`combat:${c.Id}:TwistOrSecret`, c.TwistOrSecret);
    if (showSecrets && secret) {
      lines.push('', '[СЕКРЕТ / ТВИСТ МАСТЕРА]', secret);
    }
    return lines.join('\n');
  };

  const handleCopyDetail = async () => {
    if (!activeRow) return;
    let body = '';
    if (activeRow.encounter) {
      const e = activeRow.encounter;
      const parts = [
        `${getField(`enc:${e.Id}:Title`, e.Title)} (d100: ${e.Min}–${e.Max})`,
        `Локации: ${getField(`enc:${e.Id}:Regions`, e.Regions)}${e.AfterMinesOnly ? ' | Этап: После шахт' : ''}`,
        '',
        `Кратко: ${getField(`enc:${e.Id}:Summary`, e.Summary)}`,
        `Сцена: ${getField(`enc:${e.Id}:SceneDetails`, e.SceneDetails)}`,
        `Проверки и выбор: ${getField(`enc:${e.Id}:ChoicesOrChecks`, e.ChoicesOrChecks)}`,
        `Награда / исход: ${getField(`enc:${e.Id}:RewardOrConsequence`, e.RewardOrConsequence)}`,
      ];
      const sec = getField(`enc:${e.Id}:MasterSecret`, e.MasterSecret);
      if (showSecrets && sec) {
        parts.push('', '[СЕКРЕТ МАСТЕРА]', sec);
      }
      if (e.LinkedCombatId) {
        const linked = combatById.get(e.LinkedCombatId);
        if (linked) parts.push('', '--- БОЕВОЙ ЭНКАУНТЕР ---', formatCombatPlain(linked));
      }
      body = parts.join('\n');
    } else if (activeRow.combat) {
      body = formatCombatPlain(activeRow.combat);
    } else if (activeRow.potion) {
      const p = activeRow.potion;
      body = `${getField(`potion:${p.id}:name`, p.name)} (${getField(`potion:${p.id}:source`, p.source)}) [d100: ${p.min}–${p.max}]\nЭффект: ${getField(`potion:${p.id}:effect`, p.effect)}\nИнгредиенты: ${getField(`potion:${p.id}:ingredients`, p.ingredients)}\nСЛ: ${getField(`potion:${p.id}:craftDc`, p.craftDc)} | Время: ${getField(`potion:${p.id}:craftTime`, p.craftTime)}\nВид: ${getField(`potion:${p.id}:appearance`, p.appearance)}`;
    }

    try {
      await navigator.clipboard.writeText(body);
      setCopiedDetail(true);
      setTimeout(() => setCopiedDetail(false), 1500);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const downloadFile = (filename: string, content: string, addUtf8Bom: boolean) => {
    const clean = content.startsWith('\uFEFF') ? content.slice(1) : content;
    const payload = addUtf8Bom ? '\uFEFF' + clean : clean;
    const blob = new Blob([payload], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const activeCodeContent = codeTab === 'cs' ? csRawCode : batRawCode;
  const activeCodeLines = useMemo(() => activeCodeContent.split(/\r?\n/).length, [activeCodeContent]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(activeCodeContent);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1500);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const linkedCombat =
    activeRow?.encounter?.LinkedCombatId ? combatById.get(activeRow.encounter.LinkedCombatId) : undefined;

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#0b0d10] text-[#ebe6dc]">
      {/* Top 3-Zone Bar */}
      <header className="shrink-0 h-14 px-5 bg-[#101318] border-b border-[#232833] flex items-center justify-between gap-8">
        <span className="font-display text-base font-bold tracking-wide text-[#d4a359] whitespace-nowrap shrink-0">
          Моррион
        </span>

        <nav className="flex items-center gap-6 text-sm font-medium">
          <button
            type="button"
            onClick={() => setSandboxTab('preview')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2 border-b-2 ${
              sandboxTab === 'preview'
                ? 'text-[#d4a359] border-[#d4a359]'
                : 'text-[#a1a1aa] border-transparent hover:text-[#ebe6dc]'
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>Окно программы</span>
          </button>

          <button
            type="button"
            onClick={() => setSandboxTab('code')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2 border-b-2 ${
              sandboxTab === 'code'
                ? 'text-[#d4a359] border-[#d4a359]'
                : 'text-[#a1a1aa] border-transparent hover:text-[#ebe6dc]'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>Код (C# + BAT)</span>
          </button>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenMap}
            className="h-9 px-4 rounded-md text-xs font-semibold flex items-center gap-2 bg-[#171b22] text-[#ebe6dc] border border-[#2c3340] hover:border-[#d4a359] hover:text-[#d4a359] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>Карта Морриона</span>
          </button>
        </div>
      </header>

      {sandboxTab === 'preview' ? (
        <div className="min-h-0 flex-1 flex flex-col overflow-hidden relative">
          {/* DM Command Bar */}
          <section className="shrink-0 bg-[#12151b] border-b border-[#232833] px-5 py-3 space-y-2.5">
            {/* Row 1: Category tabs + Party Scaling + Roll CTA */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1 p-1 bg-[#0b0d10] rounded-lg border border-[#232833]">
                {categoryTabs.map((t) => {
                  const active = category === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => handleCategoryChange(t.key)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-[#2a2216] text-[#d4a359]'
                          : 'text-[#a1a1aa] hover:text-[#ebe6dc]'
                      }`}
                    >
                      {t.label} · <span className="font-mono-tabular opacity-80">{t.count}</span>
                    </button>
                  );
                })}
              </div>

              {/* Party Scaling + d100 Roll */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-1.5 bg-[#0b0d10] px-2.5 py-1 rounded-lg border border-[#232833]">
                  <span className="text-xs text-[#8f96a3] whitespace-nowrap">4 игрока:</span>
                  {PARTY_LEVELS.map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setPartyLevel(lvl)}
                      className={`px-2.5 py-1 rounded text-xs font-semibold font-mono-tabular transition-colors cursor-pointer whitespace-nowrap ${
                        partyLevel === lvl
                          ? 'bg-[#2a2216] text-[#d4a359]'
                          : 'text-[#a1a1aa] hover:text-[#ebe6dc]'
                      }`}
                    >
                      {lvl} ур.
                    </button>
                  ))}
                </div>

                {isPagedCategory && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => performRoll(Math.floor(Math.random() * 100) + 1)}
                      className="h-9 px-4 rounded-md bg-[#d4a359] hover:bg-[#dfb36f] text-[#111317] text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                    >
                      <Dices className="w-4 h-4" />
                      <span>Бросить d100</span>
                    </button>

                    <div className="flex items-center h-9 bg-[#0b0d10] border border-[#2c3340] rounded-md overflow-hidden">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={manualRollInput}
                        onChange={(e) => setManualRollInput(Number(e.target.value))}
                        className="w-12 h-full px-2 bg-transparent text-[#ebe6dc] text-xs font-bold font-mono-tabular text-center focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => performRoll(manualRollInput)}
                        className="h-full px-2.5 bg-[#1a1e26] hover:bg-[#232833] text-xs font-semibold text-[#ebe6dc] border-l border-[#2c3340] cursor-pointer whitespace-nowrap"
                      >
                        Открыть №
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Row 2: Table Drawer, Stage, Secrets, Search, Threat, Edit Mode, History, Copy */}
            <div className="flex flex-wrap items-center gap-2">
              {isPagedCategory && (
                <button
                  type="button"
                  onClick={() => setDrawerOpen((v) => !v)}
                  className={`h-8 px-3 rounded-md text-xs font-semibold border flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                    drawerOpen
                      ? 'bg-[#2a2216] text-[#d4a359] border-[#d4a359]'
                      : 'bg-[#171b22] text-[#ebe6dc] border-[#2c3340] hover:border-[#4b5563]'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Все строки ({rows.length})</span>
                </button>
              )}

              {(category === 'road' || category === 'wild' || category === 'water' || category === 'combat') && (
                <>
                  <button
                    type="button"
                    onClick={() => setAfterMines((v) => !v)}
                    className={`h-8 px-3 rounded-md text-xs font-semibold border cursor-pointer transition-colors whitespace-nowrap ${
                      afterMines
                        ? 'bg-[#171b22] text-[#d4a359] border-[#2c3340]'
                        : 'bg-[#171b22] text-[#ebe6dc] border-[#2c3340]'
                    }`}
                  >
                    {afterMines ? 'Этап: После шахт' : 'Этап: Пролог'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowSecrets((v) => !v)}
                    className={`h-8 px-3 rounded-md text-xs font-semibold border flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                      showSecrets
                        ? 'bg-[#171b22] text-[#cba6f7] border-[#2c3340]'
                        : 'bg-[#171b22] text-[#a1a1aa] border-[#2c3340]'
                    }`}
                  >
                    {showSecrets ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{showSecrets ? 'Секреты: Вкл' : 'Секреты: Скрыты'}</span>
                  </button>
                </>
              )}

              <div className="relative flex-1 min-w-[170px] max-w-xs">
                <Search className="w-3.5 h-3.5 text-[#71717a] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по названию, статам, лору..."
                  className="w-full h-8 pl-8 pr-7 rounded-md bg-[#0b0d10] border border-[#2c3340] text-xs text-[#ebe6dc] placeholder:text-[#71717a] focus:outline-none focus:border-[#d4a359]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-[#ebe6dc] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {(category === 'road' || category === 'wild' || category === 'water' || category === 'combat') && (
                <select
                  value={threatCode}
                  onChange={(e) => setThreatCode(e.target.value)}
                  className="h-8 px-2.5 rounded-md bg-[#0b0d10] border border-[#2c3340] text-xs text-[#ebe6dc] focus:outline-none focus:border-[#d4a359] cursor-pointer"
                >
                  {THREAT_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={() => setEditModeAll((v) => !v)}
                title="Все поля всегда можно редактировать по клику, или включите подсветку всех полей сразу"
                className={`h-8 px-3 rounded-md text-xs font-semibold border flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                  editModeAll
                    ? 'bg-[#2a2216] text-[#d4a359] border-[#d4a359]'
                    : 'bg-[#171b22] text-[#ebe6dc] border-[#2c3340] hover:border-[#d4a359]'
                }`}
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>{editModeAll ? 'Правка полей: Подсветка Вкл' : 'Клик по полю = Редактор'}</span>
              </button>

              {editsCount > 0 && (
                <button
                  type="button"
                  onClick={resetAllEdits}
                  title="Сбросить все пользовательские правки к исходным"
                  className="h-8 px-2.5 rounded-md bg-[#191215] hover:bg-[#26181c] border border-[#f87171]/35 text-xs font-medium text-[#f87171] flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Сбросить правки ({editsCount})</span>
                </button>
              )}

              {isPagedCategory && (
                <div className="flex items-center gap-1.5 min-w-[175px] max-w-xs flex-1">
                  <History className="w-3.5 h-3.5 text-[#71717a] shrink-0" />
                  <select
                    value=""
                    onChange={(e) => {
                      const idx = Number(e.target.value);
                      const entry = history[idx];
                      if (entry) performRoll(entry.roll, entry.cat);
                    }}
                    className="w-full h-8 px-2 rounded-md bg-[#0b0d10] border border-[#2c3340] text-xs text-[#a1a1aa] focus:outline-none focus:border-[#d4a359] cursor-pointer"
                  >
                    <option value="">
                      {history.length === 0
                        ? 'История бросков пуста'
                        : `История (${history.length}) — повторить`}
                    </option>
                    {history.map((h, i) => (
                      <option key={`${h.roll}-${i}`} value={i} className="text-[#ebe6dc]">
                        {h.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {isPagedCategory && (
                <button
                  type="button"
                  onClick={handleCopyDetail}
                  disabled={!activeRow}
                  className="h-8 px-3 rounded-md bg-[#171b22] hover:bg-[#212630] disabled:opacity-40 text-[#ebe6dc] border border-[#2c3340] text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ml-auto"
                >
                  {copiedDetail ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Скопировано</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Копировать сцену</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </section>

          {/* Optional Slide-Down Table Index Drawer */}
          {drawerOpen && isPagedCategory && (
            <div className="shrink-0 max-h-[42vh] overflow-y-auto bg-[#0f1217] border-b border-[#2c3340] px-5 py-4 shadow-xl">
              <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-[#a1a1aa]">
                    Быстрый выбор строки из таблицы · кликните любую карточку
                  </span>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className="text-xs text-[#a1a1aa] hover:text-[#ebe6dc] flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Закрыть</span>
                  </button>
                </div>

                {rows.length === 0 ? (
                  <p className="text-xs text-[#8f96a3] py-4">Ничего не найдено по текущему фильтру.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {rows.map((r) => {
                      const isSelected = activeRow?.id === r.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            setSelectedId(r.id);
                            setLastRollValue(0);
                            setDrawerOpen(false);
                            setQuickPotion(null);
                            setQuickInjury(null);
                          }}
                          className={`text-left p-2.5 rounded-md border transition-colors cursor-pointer flex items-start gap-3 ${
                            isSelected
                              ? 'bg-[#1f1c16] border-[#d4a359]'
                              : 'bg-[#141820] border-[#232833] hover:border-[#3e4656]'
                          }`}
                        >
                          <span
                            className={`font-mono-tabular text-xs font-bold shrink-0 pt-0.5 ${
                              r.isBoss ? 'text-[#f87171]' : 'text-[#d4a359]'
                            }`}
                          >
                            {r.rangeLabel}
                          </span>
                          <div className="min-w-0">
                            <div
                              className={`text-xs font-semibold truncate ${
                                r.isBoss
                                  ? 'text-[#f87171]'
                                  : isSelected
                                  ? 'text-[#d4a359]'
                                  : 'text-[#ebe6dc]'
                              }`}
                            >
                              {r.title}
                            </div>
                            <div className="text-[11px] text-[#8f96a3] truncate mt-0.5">{r.meta}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Main Full-Focus Workspace */}
          <main className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-10 sm:py-8 bg-[#0b0d10]">
            {category === 'ingredients' ? (
              <IngredientsLedger
                rows={rows.map((r) => r.ingredient!).filter(Boolean)}
                getField={getField}
                setField={setField}
                editModeAll={editModeAll}
              />
            ) : category === 'injuries' ? (
              <InjuriesWorkspace
                searchQuery={searchQuery}
                getField={getField}
                setField={setField}
                editModeAll={editModeAll}
              />
            ) : category === 'artifacts' ? (
              <ArtifactsWorkspace
                searchQuery={searchQuery}
                customArtifacts={customArtifacts}
                onAddArtifact={(item) => setCustomArtifacts((prev) => [item, ...prev])}
                onDeleteCustomArtifact={(id) =>
                  setCustomArtifacts((prev) => prev.filter((a) => a.id !== id))
                }
                getField={getField}
                setField={setField}
                editModeAll={editModeAll}
              />
            ) : !activeRow ? (
              <div className="max-w-3xl mx-auto py-16 text-center space-y-2">
                <p className="text-sm text-[#a1a1aa]">По текущим фильтрам ничего не найдено.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setThreatCode('all');
                    setAfterMines(true);
                  }}
                  className="px-4 py-2 rounded-md bg-[#171b22] border border-[#2c3340] text-xs font-semibold text-[#d4a359] hover:border-[#d4a359] cursor-pointer"
                >
                  Сбросить фильтры
                </button>
              </div>
            ) : (
              <div className="max-w-6xl mx-auto space-y-7">
                {/* Intuitive Labeled Previous / Next Navigation Bar right above the card */}
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#232833]">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="inline-flex items-center gap-1.5 bg-[#13161c] p-1 rounded-lg border border-[#2c3340]">
                      <button
                        type="button"
                        onClick={() => stepSelection(-1)}
                        disabled={rows.length === 0}
                        title="Предыдущая запись (клавиша ←)"
                        className="h-8 px-3 rounded-md bg-[#1b2029] hover:bg-[#2a2216] hover:text-[#d4a359] disabled:opacity-40 text-xs font-semibold text-[#ebe6dc] flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Предыдущая</span>
                      </button>

                      <span className="px-2.5 text-xs font-mono-tabular text-[#d4a359] font-semibold whitespace-nowrap">
                        {activeIndex + 1} / {rows.length}
                      </span>

                      <button
                        type="button"
                        onClick={() => stepSelection(1)}
                        disabled={rows.length === 0}
                        title="Следующая запись (клавиша →)"
                        className="h-8 px-3 rounded-md bg-[#1b2029] hover:bg-[#2a2216] hover:text-[#d4a359] disabled:opacity-40 text-xs font-semibold text-[#ebe6dc] flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                      >
                        <span>Следующая</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#a1a1aa] font-mono-tabular">
                      <span>{lastRollValue > 0 ? `Бросок d100: ${lastRollValue}` : 'Просмотр'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#d4a359]">d100: {activeRow.rangeLabel}</span>
                      {(category === 'combat' || linkedCombat) && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Скейлинг: 4 игрока, {partyLevel} ур.</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Quick Inline Action Triggers */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => rollQuickInjury('heavy')}
                      className="h-8 px-3 rounded-md bg-[#151921] hover:bg-[#1c212b] border border-[#2c3340] text-xs font-medium text-[#f87171] flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                    >
                      <HeartPulse className="w-3.5 h-3.5" />
                      <span>Травма (4d10)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => rollQuickInjury('permanent')}
                      className="h-8 px-3 rounded-md bg-[#151921] hover:bg-[#1c212b] border border-[#2c3340] text-xs font-medium text-[#f87171] flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                    >
                      <HeartPulse className="w-3.5 h-3.5" />
                      <span>Пост. травма (2d10)</span>
                    </button>
                    {category !== 'potions' && (
                      <button
                        type="button"
                        onClick={rollQuickPotion}
                        className="h-8 px-3 rounded-md bg-[#151921] hover:bg-[#1c212b] border border-[#2c3340] text-xs font-medium text-[#d4a359] flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                      >
                        <FlaskConical className="w-3.5 h-3.5" />
                        <span>Выпало зелье (d100)</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline Rolled Injury Result */}
                {quickInjury && (
                  <div className="p-4 rounded-lg bg-[#191215] border border-[#f87171]/40 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="text-xs font-mono-tabular text-[#f87171]">
                        {quickInjury.mode === 'heavy'
                          ? 'Тяжёлая травма (4d10)'
                          : 'Постоянная травма (2d10)'}{' '}
                        · Кости: [{quickInjury.dice.join(' + ')}] = {quickInjury.total} (строка{' '}
                        {quickInjury.item.rangeLabel})
                      </div>
                      <div className="text-base font-bold text-[#ebe6dc]">{quickInjury.item.name}</div>
                      <p className="text-sm text-[#d4cfc5]">{quickInjury.item.effect}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCategoryChange('injuries')}
                        className="text-xs font-semibold text-[#d4a359] hover:underline cursor-pointer whitespace-nowrap"
                      >
                        Открыть таблицу
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickInjury(null)}
                        className="text-xs text-[#8f96a3] hover:text-[#ebe6dc] cursor-pointer"
                      >
                        Скрыть
                      </button>
                    </div>
                  </div>
                )}

                {/* Inline Rolled Potion Result */}
                {quickPotion && (
                  <div className="p-4 rounded-lg bg-[#13171e] border border-[#d4a359]/40 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="text-xs font-mono-tabular text-[#d4a359]">
                        Трофейное зелье · d100 = {quickPotion.roll} ({quickPotion.item.min}–
                        {quickPotion.item.max}) · Источник: {quickPotion.item.source}
                      </div>
                      <div className="text-base font-bold text-[#ebe6dc]">{quickPotion.item.name}</div>
                      <p className="text-sm text-[#d4cfc5]">{quickPotion.item.effect}</p>
                      <p className="text-xs text-[#a1a1aa]">
                        Внешний вид: {quickPotion.item.appearance} · Ингредиенты:{' '}
                        {quickPotion.item.ingredients} (СЛ {quickPotion.item.craftDc})
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setQuickPotion(null)}
                      className="text-xs text-[#8f96a3] hover:text-[#ebe6dc] shrink-0 cursor-pointer"
                    >
                      Скрыть
                    </button>
                  </div>
                )}

                {activeRow.encounter && (
                  <EncounterStage
                    item={activeRow.encounter}
                    showSecrets={showSecrets}
                    linkedCombat={linkedCombat}
                    partyLevel={partyLevel}
                    getField={getField}
                    setField={setField}
                    editModeAll={editModeAll}
                    onOpenArtifacts={() => handleCategoryChange('artifacts')}
                  />
                )}

                {activeRow.combat && (
                  <CombatStage
                    item={activeRow.combat}
                    showSecrets={showSecrets}
                    partyLevel={partyLevel}
                    getField={getField}
                    setField={setField}
                    editModeAll={editModeAll}
                    onOpenArtifacts={() => handleCategoryChange('artifacts')}
                  />
                )}

                {activeRow.potion && (
                  <PotionStage
                    item={activeRow.potion}
                    getField={getField}
                    setField={setField}
                    editModeAll={editModeAll}
                  />
                )}
              </div>
            )}
          </main>
        </div>
      ) : (
        /* Code View Tab */
        <main className="min-h-0 flex-1 p-4 sm:p-6 flex flex-col gap-4 overflow-hidden bg-[#0b0d10]">
          <div className="shrink-0 bg-[#13161c] border border-[#232833] rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-[#d4a359]">
                <Terminal className="w-4 h-4" />
                <span>Сборка автономного .EXE для Windows + потребление памяти</span>
              </div>
              <p className="text-xs text-[#c7c2b8] leading-relaxed max-w-3xl">
                1. Скачайте оба файла в одну папку на Windows и запустите{' '}
                <code className="px-1 py-0.5 bg-[#1a1e26] rounded font-mono-tabular text-[#ebe6dc]">
                  Build_MorionRandomizer.bat
                </code>
                .
                <br />
                2. Ресурсы программы: итоговый{' '}
                <code className="font-mono-tabular text-[#d4a359]">MorionRandomizer.exe</code> весит ~1.5 МБ
                (внутри вшиты все 28 чётких 520px артов монстров, полные статблоки dnd.su, артефакты и
                таблицы травм), а в оперативной памяти занимает{' '}
                <strong className="text-[#ebe6dc] font-mono-tabular">~30–46 МБ ОЗУ</strong> (в ~8 раз легче
                браузера).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => downloadFile('MorionRandomizer.cs', csRawCode, true)}
                className="h-9 px-4 rounded-md bg-[#d4a359] hover:bg-[#dfb36f] text-[#111317] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Скачать MorionRandomizer.cs</span>
              </button>

              <button
                type="button"
                onClick={() => downloadFile('Build_MorionRandomizer.bat', batRawCode, false)}
                className="h-9 px-4 rounded-md bg-[#1a1e26] hover:bg-[#232833] text-[#ebe6dc] border border-[#2c3340] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Скачать Build_MorionRandomizer.bat</span>
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 flex flex-col bg-[#0e1116] border border-[#232833] rounded-lg overflow-hidden">
            <div className="shrink-0 px-4 py-2.5 bg-[#13161c] border-b border-[#232833] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCodeTab('cs')}
                  className={`h-8 px-3 rounded-md text-xs font-semibold flex items-center gap-1.5 border cursor-pointer ${
                    codeTab === 'cs'
                      ? 'bg-[#2a2216] text-[#d4a359] border-[#d4a359]'
                      : 'bg-[#1a1e26] text-[#ebe6dc] border-[#2c3340]'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>MorionRandomizer.cs</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCodeTab('bat')}
                  className={`h-8 px-3 rounded-md text-xs font-semibold flex items-center gap-1.5 border cursor-pointer ${
                    codeTab === 'bat'
                      ? 'bg-[#2a2216] text-[#d4a359] border-[#d4a359]'
                      : 'bg-[#1a1e26] text-[#ebe6dc] border-[#2c3340]'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Build_MorionRandomizer.bat</span>
                </button>
                <span className="ml-2 text-xs font-mono-tabular text-[#8f96a3]">
                  {activeCodeLines} строк · {Math.round(activeCodeContent.length / 1024) || 1} КБ
                </span>
              </div>

              <button
                type="button"
                onClick={handleCopyCode}
                className="h-8 px-3 rounded-md bg-[#1a1e26] hover:bg-[#232833] text-[#ebe6dc] border border-[#2c3340] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Код скопирован</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Копировать весь файл</span>
                  </>
                )}
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4 select-text">
              <pre className="font-mono-tabular text-xs leading-5 text-[#dcd7cc] whitespace-pre">
                <code>{activeCodeContent}</code>
              </pre>
            </div>
          </div>
        </main>
      )}
    </div>
  );
};

/* ==================== REUSABLE INLINE-EDITABLE FIELD ==================== */

const EditableField: React.FC<{
  fieldKey: string;
  defaultValue: string;
  getField: (k: string, fb: string) => string;
  setField: (k: string, val: string, fb: string) => void;
  editModeAll: boolean;
  multiline?: boolean;
  className?: string;
  placeholder?: string;
}> = ({
  fieldKey,
  defaultValue,
  getField,
  setField,
  editModeAll,
  multiline = false,
  className = '',
  placeholder = 'Нажмите для редактирования...',
}) => {
  const value = getField(fieldKey, defaultValue);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value, fieldKey]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) {
      setField(fieldKey, draft, defaultValue);
    }
  };

  if (editing || editModeAll) {
    if (multiline) {
      return (
        <textarea
          value={draft}
          autoFocus={editing && !editModeAll}
          rows={Math.max(2, Math.min(8, Math.ceil((draft.length || 1) / 72)))}
          onChange={(e) => {
            setDraft(e.target.value);
            if (editModeAll) setField(fieldKey, e.target.value, defaultValue);
          }}
          onBlur={commit}
          placeholder={placeholder}
          className={`w-full rounded bg-[#0b0d10] border border-[#d4a359]/60 px-2 py-1 text-inherit font-inherit leading-relaxed focus:outline-none focus:border-[#d4a359] resize-y ${className}`}
        />
      );
    }
    return (
      <input
        type="text"
        value={draft}
        autoFocus={editing && !editModeAll}
        onChange={(e) => {
          setDraft(e.target.value);
          if (editModeAll) setField(fieldKey, e.target.value, defaultValue);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
        }}
        placeholder={placeholder}
        className={`w-full rounded bg-[#0b0d10] border border-[#d4a359]/60 px-2 py-0.5 text-inherit font-inherit focus:outline-none focus:border-[#d4a359] ${className}`}
      />
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      title="Кликните, чтобы отредактировать поле"
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setEditing(true);
        }
      }}
      className={`group inline-block rounded px-1 -mx-1 hover:bg-[#1e232e] hover:outline hover:outline-1 hover:outline-[#d4a359]/45 cursor-text transition-colors ${className}`}
    >
      {value || <span className="text-[#71717a] italic">{placeholder}</span>}
    </span>
  );
};

/* ==================== ENCOUNTER STAGE ==================== */

const EncounterStage: React.FC<{
  item: EncounterItem;
  showSecrets: boolean;
  linkedCombat?: CombatItem;
  partyLevel: PartyLevel;
  getField: (k: string, fb: string) => string;
  setField: (k: string, val: string, fb: string) => void;
  editModeAll: boolean;
  onOpenArtifacts: () => void;
}> = ({
  item,
  showSecrets,
  linkedCombat,
  partyLevel,
  getField,
  setField,
  editModeAll,
  onOpenArtifacts,
}) => {
  const isBoss = item.Mood === 'boss';
  return (
    <div className="space-y-8">
      <div className="space-y-2 max-w-3xl">
        <h1
          className={`font-display text-2xl sm:text-3xl font-bold leading-tight [text-wrap:balance] ${
            isBoss ? 'text-[#f87171]' : 'text-[#ebe6dc]'
          }`}
        >
          <EditableField
            fieldKey={`enc:${item.Id}:Title`}
            defaultValue={item.Title}
            getField={getField}
            setField={setField}
            editModeAll={editModeAll}
          />
        </h1>
        <p className="text-sm text-[#a1a1aa]">
          Локации:{' '}
          <EditableField
            fieldKey={`enc:${item.Id}:Regions`}
            defaultValue={item.Regions}
            getField={getField}
            setField={setField}
            editModeAll={editModeAll}
          />
          {item.AfterMinesOnly && ' · Доступно после шахт'}
        </p>
      </div>

      {/* Balanced 2-Column Editorial Prose */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <div className="p-5 rounded-lg bg-[#13161c] border border-[#232833] space-y-4">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#d4a359] mb-1.5">
              Завязка
            </h2>
            <div className="text-[15px] leading-relaxed text-[#ebe6dc]">
              <EditableField
                fieldKey={`enc:${item.Id}:Summary`}
                defaultValue={item.Summary}
                getField={getField}
                setField={setField}
                editModeAll={editModeAll}
                multiline
              />
            </div>
          </div>
          <div className="pt-3 border-t border-[#232833]">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#d4a359] mb-1.5">
              Картина сцены
            </h2>
            <div className="text-[15px] leading-relaxed text-[#d4cfc5] whitespace-pre-line">
              <EditableField
                fieldKey={`enc:${item.Id}:SceneDetails`}
                defaultValue={item.SceneDetails}
                getField={getField}
                setField={setField}
                editModeAll={editModeAll}
                multiline
              />
            </div>
          </div>
        </div>

        <div className="p-5 rounded-lg bg-[#13161c] border border-[#232833] space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#d4a359] mb-1.5">
                Проверки и выбор игроков
              </h2>
              <div className="text-[15px] leading-relaxed text-[#ebe6dc] whitespace-pre-line">
                <EditableField
                  fieldKey={`enc:${item.Id}:ChoicesOrChecks`}
                  defaultValue={item.ChoicesOrChecks}
                  getField={getField}
                  setField={setField}
                  editModeAll={editModeAll}
                  multiline
                />
              </div>
            </div>
            <div className="pt-3 border-t border-[#232833]">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#d4a359] mb-1.5">
                Награда и последствия
              </h2>
              <div className="text-[15px] leading-relaxed text-[#d4cfc5] whitespace-pre-line">
                <EditableField
                  fieldKey={`enc:${item.Id}:RewardOrConsequence`}
                  defaultValue={item.RewardOrConsequence}
                  getField={getField}
                  setField={setField}
                  editModeAll={editModeAll}
                  multiline
                />
              </div>
            </div>
          </div>

          {showSecrets && (item.MasterSecret || editModeAll) && (
            <div className="mt-4 p-4 rounded-md bg-[#181422] border border-[#cba6f7]/25 space-y-1.5">
              <div className="text-xs font-semibold text-[#cba6f7] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Секрет мастера</span>
              </div>
              <div className="text-sm text-[#e2cffc] leading-relaxed whitespace-pre-line">
                <EditableField
                  fieldKey={`enc:${item.Id}:MasterSecret`}
                  defaultValue={item.MasterSecret}
                  getField={getField}
                  setField={setField}
                  editModeAll={editModeAll}
                  multiline
                  placeholder="Добавить секрет мастера..."
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {linkedCombat && (
        <div className="pt-6 border-t border-[#232833]">
          <CombatStage
            item={linkedCombat}
            showSecrets={showSecrets}
            partyLevel={partyLevel}
            getField={getField}
            setField={setField}
            editModeAll={editModeAll}
            onOpenArtifacts={onOpenArtifacts}
          />
        </div>
      )}
    </div>
  );
};

/* ==================== MONSTER ART & COMBAT STAGE ==================== */

const MonsterArtThumb: React.FC<{
  src: string;
  alt: string;
  onZoom?: () => void;
}> = ({ src, alt, onZoom }) => {
  const [failed, setFailed] = useState(false);

  return (
    <button
      type="button"
      onClick={onZoom}
      title="Нажмите, чтобы открыть полный арт монстра"
      className="w-24 h-24 sm:w-28 sm:h-28 shrink-0 rounded-lg overflow-hidden bg-[#f2ede4] border border-[#2c3340] hover:border-[#d4a359] transition-colors flex items-center justify-center cursor-pointer"
    >
      {failed || !src ? (
        <Skull className="w-7 h-7 text-[#52525b]" />
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover object-top"
        />
      )}
    </button>
  );
};

const CombatStage: React.FC<{
  item: CombatItem;
  showSecrets: boolean;
  partyLevel: PartyLevel;
  getField: (k: string, fb: string) => string;
  setField: (k: string, val: string, fb: string) => void;
  editModeAll: boolean;
  onOpenArtifacts: () => void;
}> = ({
  item,
  showSecrets,
  partyLevel,
  getField,
  setField,
  editModeAll,
  onOpenArtifacts,
}) => {
  const scaling: CombatLevelScaling | undefined = COMBAT_SCALING[item.Id]?.[partyLevel];
  const [zoomedArt, setZoomedArt] = useState<{ src: string; name: string; meta: string } | null>(null);

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs font-medium text-[#a1a1aa]">
          <Swords className="w-3.5 h-3.5 text-[#d4a359]" />
          <EditableField
            fieldKey={`combat:${item.Id}:DangerLevel`}
            defaultValue={scaling ? scaling.difficultyLabel : item.DangerLevel}
            getField={getField}
            setField={setField}
            editModeAll={editModeAll}
          />
          {item.AfterMinesOnly && (
            <>
              <span aria-hidden="true">·</span>
              <span>После шахт</span>
            </>
          )}
        </div>
        <h2
          className={`font-display text-xl sm:text-2xl font-bold flex items-center gap-2.5 [text-wrap:balance] ${
            item.IsBoss ? 'text-[#f87171]' : 'text-[#d4a359]'
          }`}
        >
          {item.IsBoss && <ShieldAlert className="w-5 h-5 shrink-0" />}
          <EditableField
            fieldKey={`combat:${item.Id}:Title`}
            defaultValue={item.Title}
            getField={getField}
            setField={setField}
            editModeAll={editModeAll}
          />
        </h2>
      </div>

      {/* 2-Column Combat Split: Left Narrative & Tactics, Right Full dnd.su Statblocks */}
      <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.35fr] gap-6 items-start">
        <div className="p-5 rounded-lg bg-[#13161c] border border-[#232833] space-y-4">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#d4a359] mb-1">
              Состав для {partyLevel} уровня (4 игрока)
            </h3>
            <div className="text-[15px] font-semibold text-[#ebe6dc]">
              <EditableField
                fieldKey={`tier:${item.Id}:${partyLevel}:composition`}
                defaultValue={scaling ? scaling.composition : item.Enemies}
                getField={getField}
                setField={setField}
                editModeAll={editModeAll}
                multiline
              />
            </div>
            {scaling && (
              <div className="text-xs text-[#a1a1aa] mt-1.5 leading-relaxed">
                <EditableField
                  fieldKey={`tier:${item.Id}:${partyLevel}:scalingNote`}
                  defaultValue={scaling.scalingNote}
                  getField={getField}
                  setField={setField}
                  editModeAll={editModeAll}
                  multiline
                />
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[#232833]">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#d4a359] mb-1">
              Повод и мотивация
            </h3>
            <div className="text-sm leading-relaxed text-[#d4cfc5]">
              <EditableField
                fieldKey={`combat:${item.Id}:Motivation`}
                defaultValue={item.Motivation}
                getField={getField}
                setField={setField}
                editModeAll={editModeAll}
                multiline
              />
            </div>
          </div>

          <div className="pt-3 border-t border-[#232833]">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#d4a359] mb-1">
              Тактика поля боя
            </h3>
            <div className="text-sm leading-relaxed text-[#d4cfc5]">
              <EditableField
                fieldKey={`combat:${item.Id}:Tactics`}
                defaultValue={item.Tactics}
                getField={getField}
                setField={setField}
                editModeAll={editModeAll}
                multiline
              />
            </div>
          </div>

          <div className="pt-3 border-t border-[#232833] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#d4a359]">
                Награда, зелья и трофеи
              </h3>
              {item.IsBoss && (
                <button
                  type="button"
                  onClick={onOpenArtifacts}
                  className="text-[11px] font-semibold text-[#cba6f7] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Crown className="w-3 h-3" />
                  <span>Смотреть ХоумБрю в Артефактах</span>
                </button>
              )}
            </div>
            <div className="text-sm leading-relaxed text-[#ebe6dc]">
              <EditableField
                fieldKey={`combat:${item.Id}:Reward`}
                defaultValue={item.Reward}
                getField={getField}
                setField={setField}
                editModeAll={editModeAll}
                multiline
              />
            </div>
          </div>

          {showSecrets && (item.TwistOrSecret || editModeAll) && (
            <div className="p-4 rounded-md bg-[#181422] border border-[#cba6f7]/25 space-y-1">
              <div className="text-xs font-semibold text-[#cba6f7] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Твист мастера</span>
              </div>
              <div className="text-sm text-[#e2cffc] leading-relaxed">
                <EditableField
                  fieldKey={`combat:${item.Id}:TwistOrSecret`}
                  defaultValue={item.TwistOrSecret}
                  getField={getField}
                  setField={setField}
                  editModeAll={editModeAll}
                  multiline
                  placeholder="Добавить твист..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Full D&D 5e (dnd.su) Statblocks Column */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-[#a1a1aa]">
            <span className="font-semibold text-[#ebe6dc]">
              Полные статблоки (dnd.su) · {partyLevel} уровень
            </span>
            <span className="font-mono-tabular">Клик по любому значению редактирует его</span>
          </div>

          {scaling?.statblocks.map((sb: DndSuStatblock, idx: number) => {
            const k = `sb:${item.Id}:${partyLevel}:${idx}`;
            return (
              <div
                key={`${item.Id}-${partyLevel}-${idx}`}
                className="p-4 rounded-lg bg-[#13161c] border border-[#232833] space-y-3"
              >
                {/* Header row: Sharp 520px portrait + Name, Type, AC/HP/Speed */}
                <div className="flex items-start gap-4 pb-3 border-b border-[#232833]">
                  <MonsterArtThumb
                    src={sb.image}
                    alt={sb.name}
                    onZoom={() =>
                      setZoomedArt({
                        src: sb.image,
                        name: `${getField(`${k}:name`, sb.name)} (${getField(`${k}:count`, sb.count)})`,
                        meta: `CR ${getField(`${k}:cr`, sb.cr)} · КД ${getField(`${k}:ac`, sb.ac)} · Хиты ${getField(`${k}:hp`, sb.hp)}`,
                      })
                    }
                  />

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="text-sm sm:text-base font-bold text-[#ebe6dc]">
                        <EditableField
                          fieldKey={`${k}:name`}
                          defaultValue={sb.name}
                          getField={getField}
                          setField={setField}
                          editModeAll={editModeAll}
                        />{' '}
                        <span className="font-mono-tabular text-[#d4a359]">
                          <EditableField
                            fieldKey={`${k}:count`}
                            defaultValue={sb.count}
                            getField={getField}
                            setField={setField}
                            editModeAll={editModeAll}
                          />
                        </span>
                      </div>
                      <div className="text-xs font-mono-tabular text-[#d4a359] font-semibold">
                        CR{' '}
                        <EditableField
                          fieldKey={`${k}:cr`}
                          defaultValue={sb.cr}
                          getField={getField}
                          setField={setField}
                          editModeAll={editModeAll}
                        />
                      </div>
                    </div>

                    <div className="text-xs text-[#a1a1aa] italic">
                      <EditableField
                        fieldKey={`${k}:typeSize`}
                        defaultValue={sb.typeSize}
                        getField={getField}
                        setField={setField}
                        editModeAll={editModeAll}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs font-mono-tabular">
                      <div className="p-2 rounded bg-[#0b0d10] border border-[#1f242e]">
                        <div className="text-[10px] text-[#8f96a3]">КД (AC)</div>
                        <div className="font-bold text-[#ebe6dc] mt-0.5">
                          <EditableField
                            fieldKey={`${k}:ac`}
                            defaultValue={sb.ac}
                            getField={getField}
                            setField={setField}
                            editModeAll={editModeAll}
                          />
                        </div>
                      </div>
                      <div className="p-2 rounded bg-[#0b0d10] border border-[#1f242e]">
                        <div className="text-[10px] text-[#8f96a3]">Хиты (HP)</div>
                        <div className="font-bold text-[#f87171] mt-0.5">
                          <EditableField
                            fieldKey={`${k}:hp`}
                            defaultValue={sb.hp}
                            getField={getField}
                            setField={setField}
                            editModeAll={editModeAll}
                          />
                        </div>
                      </div>
                      <div className="p-2 rounded bg-[#0b0d10] border border-[#1f242e]">
                        <div className="text-[10px] text-[#8f96a3]">Скорость</div>
                        <div className="font-bold text-[#ebe6dc] mt-0.5">
                          <EditableField
                            fieldKey={`${k}:speed`}
                            defaultValue={sb.speed}
                            getField={getField}
                            setField={setField}
                            editModeAll={editModeAll}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6 Ability Scores Grid */}
                <div className="grid grid-cols-6 gap-1.5 text-center font-mono-tabular">
                  {(
                    [
                      ['СИЛ', 'str', sb.str],
                      ['ЛОВ', 'dex', sb.dex],
                      ['ТЕЛ', 'con', sb.con],
                      ['ИНТ', 'int', sb.int],
                      ['МУД', 'wis', sb.wis],
                      ['ХАР', 'cha', sb.cha],
                    ] as const
                  ).map(([abbr, prop, val]) => (
                    <div key={abbr} className="p-1.5 rounded bg-[#0b0d10] border border-[#1f242e]">
                      <div className="text-[10px] font-bold text-[#d4a359]">{abbr}</div>
                      <div className="text-xs font-semibold text-[#ebe6dc] mt-0.5">
                        <EditableField
                          fieldKey={`${k}:${prop}`}
                          defaultValue={val}
                          getField={getField}
                          setField={setField}
                          editModeAll={editModeAll}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Saving Throws (Self vs Against Enemy) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 rounded bg-[#0e1116] border border-[#1f242e]">
                    <span className="font-semibold text-[#d4a359]">Свои спасброски: </span>
                    <span className="text-[#ebe6dc]">
                      <EditableField
                        fieldKey={`${k}:savingThrows`}
                        defaultValue={sb.savingThrows}
                        getField={getField}
                        setField={setField}
                        editModeAll={editModeAll}
                        multiline
                      />
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-[#181214] border border-[#f87171]/30">
                    <span className="font-semibold text-[#f87171]">Спасброски против врага: </span>
                    <span className="text-[#ebe6dc]">
                      <EditableField
                        fieldKey={`${k}:enemySavesDC`}
                        defaultValue={sb.enemySavesDC}
                        getField={getField}
                        setField={setField}
                        editModeAll={editModeAll}
                        multiline
                      />
                    </span>
                  </div>
                </div>

                {/* Skills, Defenses, Senses */}
                <div className="space-y-1.5 text-xs text-[#c7c2b8] pt-1">
                  <div>
                    <span className="font-semibold text-[#ebe6dc]">Навыки: </span>
                    <EditableField
                      fieldKey={`${k}:skills`}
                      defaultValue={sb.skills}
                      getField={getField}
                      setField={setField}
                      editModeAll={editModeAll}
                    />
                  </div>
                  <div>
                    <span className="font-semibold text-[#ebe6dc]">Защита / Иммунитеты: </span>
                    <EditableField
                      fieldKey={`${k}:defenses`}
                      defaultValue={sb.defenses}
                      getField={getField}
                      setField={setField}
                      editModeAll={editModeAll}
                      multiline
                    />
                  </div>
                  <div>
                    <span className="font-semibold text-[#ebe6dc]">Чувства и языки: </span>
                    <EditableField
                      fieldKey={`${k}:sensesLangs`}
                      defaultValue={sb.sensesLangs}
                      getField={getField}
                      setField={setField}
                      editModeAll={editModeAll}
                    />
                  </div>
                </div>

                {/* Actions & Traits */}
                <div className="pt-2 border-t border-[#232833] space-y-2 text-xs leading-relaxed">
                  <div className="text-[#ebe6dc]">
                    <span className="font-semibold text-[#d4a359]">Действия и атаки: </span>
                    <EditableField
                      fieldKey={`${k}:attacks`}
                      defaultValue={sb.attacks}
                      getField={getField}
                      setField={setField}
                      editModeAll={editModeAll}
                      multiline
                    />
                  </div>

                  <div className="text-[#a1a1aa]">
                    <span className="font-semibold text-[#c7c2b8]">Особенности и реакции: </span>
                    <EditableField
                      fieldKey={`${k}:traits`}
                      defaultValue={sb.traits}
                      getField={getField}
                      setField={setField}
                      editModeAll={editModeAll}
                      multiline
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Monster Portrait Zoom Modal */}
      {zoomedArt && (
        <div
          onClick={() => setZoomedArt(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl bg-[#13161c] border border-[#2c3340] p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-bold text-[#ebe6dc]">{zoomedArt.name}</div>
                <div className="text-xs font-mono-tabular text-[#d4a359] mt-0.5">{zoomedArt.meta}</div>
              </div>
              <button
                type="button"
                onClick={() => setZoomedArt(null)}
                className="p-1 text-[#8f96a3] hover:text-[#ebe6dc] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-lg overflow-hidden bg-[#f2ede4] border border-[#2c3340]">
              <img
                src={zoomedArt.src}
                alt={zoomedArt.name}
                referrerPolicy="no-referrer"
                className="w-full max-h-[65vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ==================== POTION STAGE ==================== */

const PotionStage: React.FC<{
  item: PotionLootItem;
  getField: (k: string, fb: string) => string;
  setField: (k: string, val: string, fb: string) => void;
  editModeAll: boolean;
}> = ({ item, getField, setField, editModeAll }) => (
  <div className="max-w-3xl space-y-6">
    <div className="space-y-1.5">
      <div className="text-xs font-mono-tabular text-[#a1a1aa]">
        Источник:{' '}
        <EditableField
          fieldKey={`potion:${item.id}:source`}
          defaultValue={item.source}
          getField={getField}
          setField={setField}
          editModeAll={editModeAll}
        />{' '}
        · СЛ варки:{' '}
        <EditableField
          fieldKey={`potion:${item.id}:craftDc`}
          defaultValue={item.craftDc}
          getField={getField}
          setField={setField}
          editModeAll={editModeAll}
        />{' '}
        · Время:{' '}
        <EditableField
          fieldKey={`potion:${item.id}:craftTime`}
          defaultValue={item.craftTime}
          getField={getField}
          setField={setField}
          editModeAll={editModeAll}
        />
      </div>
      <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#d4a359]">
        <EditableField
          fieldKey={`potion:${item.id}:name`}
          defaultValue={item.name}
          getField={getField}
          setField={setField}
          editModeAll={editModeAll}
        />
      </h1>
    </div>

    <div className="p-5 rounded-lg bg-[#13161c] border border-[#232833] space-y-4">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#d4a359] mb-1">Эффект</h2>
        <div className="text-base text-[#ebe6dc] leading-relaxed">
          <EditableField
            fieldKey={`potion:${item.id}:effect`}
            defaultValue={item.effect}
            getField={getField}
            setField={setField}
            editModeAll={editModeAll}
            multiline
          />
        </div>
      </div>
      <div className="pt-3 border-t border-[#232833]">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#d4a359] mb-1">
          Ингредиенты
        </h2>
        <div className="text-sm text-[#d4cfc5]">
          <EditableField
            fieldKey={`potion:${item.id}:ingredients`}
            defaultValue={item.ingredients}
            getField={getField}
            setField={setField}
            editModeAll={editModeAll}
            multiline
          />
        </div>
      </div>
      <div className="pt-3 border-t border-[#232833]">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#d4a359] mb-1">
          Внешний вид, запах и консистенция
        </h2>
        <div className="text-sm text-[#a1a1aa]">
          <EditableField
            fieldKey={`potion:${item.id}:appearance`}
            defaultValue={item.appearance}
            getField={getField}
            setField={setField}
            editModeAll={editModeAll}
            multiline
          />
        </div>
      </div>
    </div>
  </div>
);

/* ==================== ARTIFACTS & HOMEBREW TAB ==================== */

const ArtifactsWorkspace: React.FC<{
  searchQuery: string;
  customArtifacts: ArtifactItem[];
  onAddArtifact: (a: ArtifactItem) => void;
  onDeleteCustomArtifact: (id: string) => void;
  getField: (k: string, fb: string) => string;
  setField: (k: string, val: string, fb: string) => void;
  editModeAll: boolean;
}> = ({
  searchQuery,
  customArtifacts,
  onAddArtifact,
  onDeleteCustomArtifact,
  getField,
  setField,
  editModeAll,
}) => {
  const [rarityFilter, setRarityFilter] = useState<'all' | ArtifactRarity | 'homebrew'>('all');
  const [selectedId, setSelectedId] = useState<string>('art-r-zorg-hb');
  const [rollNumber, setRollNumber] = useState<string>('');
  const [copiedArt, setCopiedArt] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const [newName, setNewName] = useState('');
  const [newRarity, setNewRarity] = useState<ArtifactRarity>('Редкий');
  const [newCost, setNewCost] = useState('2 500 зм');
  const [newType, setNewType] = useState('Чудесный предмет (ХоумБрю)');
  const [newAttunement, setNewAttunement] = useState('Требуется');
  const [newSource, setNewSource] = useState('ХоумБрю мастера');
  const [newEffect, setNewEffect] = useState('');

  const allArtifacts = useMemo(() => {
    return [...customArtifacts, ...ARTIFACTS_TABLE].sort((a, b) => a.rarityRank - b.rarityRank);
  }, [customArtifacts]);

  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allArtifacts.filter((item) => {
      if (rarityFilter === 'homebrew' && !item.isHomebrew) return false;
      if (rarityFilter !== 'all' && rarityFilter !== 'homebrew' && item.rarity !== rarityFilter) {
        return false;
      }
      if (!q) return true;
      const hay = (
        getField(`art:${item.id}:name`, item.name) +
        ' ' +
        getField(`art:${item.id}:rarity`, item.rarity) +
        ' ' +
        getField(`art:${item.id}:cost`, item.cost) +
        ' ' +
        getField(`art:${item.id}:source`, item.source) +
        ' ' +
        getField(`art:${item.id}:effect`, item.effect)
      ).toLowerCase();
      return hay.includes(q);
    });
  }, [allArtifacts, rarityFilter, searchQuery, getField]);

  const activeItem = useMemo(() => {
    return allArtifacts.find((a) => a.id === selectedId) ?? filteredList[0] ?? allArtifacts[0];
  }, [allArtifacts, filteredList, selectedId]);

  const rollRandomArtifact = (poolMode: 'filtered' | ArtifactRarity) => {
    const pool =
      poolMode === 'filtered'
        ? filteredList.length > 0
          ? filteredList
          : allArtifacts
        : allArtifacts.filter((a) => a.rarity === poolMode);
    if (pool.length === 0) return;
    const idx = Math.floor(Math.random() * pool.length);
    const chosen = pool[idx];
    setSelectedId(chosen.id);
    setRollNumber(`1d${pool.length} → №${idx + 1}`);
  };

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEffect.trim()) return;
    const rankMap: Record<ArtifactRarity, number> = {
      Обычный: 1,
      Необычный: 2,
      Редкий: 3,
      'Очень редкий': 4,
      Легендарный: 5,
    };
    const item: ArtifactItem = {
      id: `art-custom-${Date.now()}`,
      rarity: newRarity,
      rarityRank: rankMap[newRarity],
      isHomebrew: true,
      name: newName.trim(),
      type: newType.trim() || 'ХоумБрю предмет',
      cost: newCost.trim() || '1 000 зм',
      attunement: newAttunement.trim() || 'Требуется',
      source: newSource.trim() || 'ХоумБрю мастера',
      effect: newEffect.trim(),
    };
    onAddArtifact(item);
    setSelectedId(item.id);
    setShowAddForm(false);
    setNewName('');
    setNewEffect('');
  };

  const handleCopyArtifact = async () => {
    if (!activeItem) return;
    const k = `art:${activeItem.id}`;
    const txt = [
      `${getField(`${k}:name`, activeItem.name)}`,
      `Редкость: ${getField(`${k}:rarity`, activeItem.rarity)} | Стоимость: ${getField(`${k}:cost`, activeItem.cost)} | Настройка: ${getField(`${k}:attunement`, activeItem.attunement)}`,
      `Тип: ${getField(`${k}:type`, activeItem.type)} | Источник: ${getField(`${k}:source`, activeItem.source)}`,
      `Свойства: ${getField(`${k}:effect`, activeItem.effect)}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(txt);
      setCopiedArt(true);
      setTimeout(() => setCopiedArt(false), 1500);
    } catch {
      // ignore
    }
  };

  const rarityTextColor = (rarity: string) => {
    if (rarity === 'Необычный') return 'text-emerald-400';
    if (rarity === 'Редкий') return 'text-sky-400';
    if (rarity === 'Очень редкий') return 'text-[#cba6f7]';
    if (rarity === 'Легендарный') return 'text-[#d4a359]';
    return 'text-[#c7c2b8]';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header & Randomizers */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#232833]">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#d4a359]">
            Артефакты, магические предметы и ХоумБрю
          </h1>
          <p className="text-xs text-[#a1a1aa] mt-1">
            Распределены по редкости с отдельной ценой · Включены уникальные ХоумБрю-награды за Мировых боссов
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => rollRandomArtifact('filtered')}
            className="h-9 px-4 rounded-md bg-[#d4a359] hover:bg-[#dfb36f] text-[#111317] text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
          >
            <Dices className="w-4 h-4" />
            <span>Случайный (из фильтра)</span>
          </button>

          <button
            type="button"
            onClick={() => rollRandomArtifact('Редкий')}
            className="h-9 px-3.5 rounded-md bg-[#171b22] hover:bg-[#232833] text-sky-400 border border-[#2c3340] text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Dices className="w-3.5 h-3.5" />
            <span>Случайный Редкий</span>
          </button>

          <button
            type="button"
            onClick={() => rollRandomArtifact('Очень редкий')}
            className="h-9 px-3.5 rounded-md bg-[#171b22] hover:bg-[#232833] text-[#cba6f7] border border-[#2c3340] text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Dices className="w-3.5 h-3.5" />
            <span>Очень редкий</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="h-9 px-3.5 rounded-md bg-[#1a1e26] hover:bg-[#252b36] text-[#ebe6dc] border border-[#2c3340] text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 text-[#d4a359]" />
            <span>Добавить свой ХоумБрю</span>
          </button>
        </div>
      </div>

      {/* Add Custom Artifact Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreateCustom}
          className="p-4 rounded-lg bg-[#13161c] border border-[#d4a359]/40 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
        >
          <input
            type="text"
            required
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Название предмета / артефакта"
            className="h-9 px-3 rounded bg-[#0b0d10] border border-[#2c3340] text-xs text-[#ebe6dc]"
          />
          <select
            value={newRarity}
            onChange={(e) => setNewRarity(e.target.value as ArtifactRarity)}
            className="h-9 px-2.5 rounded bg-[#0b0d10] border border-[#2c3340] text-xs text-[#ebe6dc]"
          >
            {RARITY_ORDER.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newCost}
            onChange={(e) => setNewCost(e.target.value)}
            placeholder="Стоимость (напр. 3 500 зм)"
            className="h-9 px-3 rounded bg-[#0b0d10] border border-[#2c3340] text-xs text-[#ebe6dc]"
          />
          <input
            type="text"
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
            placeholder="Источник / Босс / Локация"
            className="h-9 px-3 rounded bg-[#0b0d10] border border-[#2c3340] text-xs text-[#ebe6dc]"
          />
          <input
            type="text"
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            placeholder="Тип (Оружие, Кольцо, Фокус...)"
            className="h-9 px-3 rounded bg-[#0b0d10] border border-[#2c3340] text-xs text-[#ebe6dc]"
          />
          <input
            type="text"
            value={newAttunement}
            onChange={(e) => setNewAttunement(e.target.value)}
            placeholder="Настройка (Требуется / Нет)"
            className="h-9 px-3 rounded bg-[#0b0d10] border border-[#2c3340] text-xs text-[#ebe6dc]"
          />
          <textarea
            required
            rows={2}
            value={newEffect}
            onChange={(e) => setNewEffect(e.target.value)}
            placeholder="Механика и эффекты..."
            className="sm:col-span-2 px-3 py-1.5 rounded bg-[#0b0d10] border border-[#2c3340] text-xs text-[#ebe6dc]"
          />
          <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="h-8 px-3 rounded bg-[#1a1e26] text-xs text-[#a1a1aa] cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="h-8 px-4 rounded bg-[#d4a359] text-[#111317] text-xs font-bold cursor-pointer"
            >
              Сохранить предмет
            </button>
          </div>
        </form>
      )}

      {/* Rarity Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#13161c] rounded-lg border border-[#232833]">
          <button
            type="button"
            onClick={() => setRarityFilter('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap ${
              rarityFilter === 'all' ? 'bg-[#2a2216] text-[#d4a359]' : 'text-[#a1a1aa] hover:text-[#ebe6dc]'
            }`}
          >
            Все · {allArtifacts.length}
          </button>
          {RARITY_ORDER.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRarityFilter(r)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap ${
                rarityFilter === r
                  ? 'bg-[#2a2216] text-[#d4a359]'
                  : 'text-[#a1a1aa] hover:text-[#ebe6dc]'
              }`}
            >
              {r}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setRarityFilter('homebrew')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap ${
              rarityFilter === 'homebrew'
                ? 'bg-[#1f182a] text-[#cba6f7]'
                : 'text-[#cba6f7]/80 hover:text-[#cba6f7]'
            }`}
          >
            ХоумБрю (Боссы + свои)
          </button>
        </div>

        <button
          type="button"
          onClick={handleCopyArtifact}
          className="h-8 px-3 rounded-md bg-[#171b22] hover:bg-[#212630] text-[#ebe6dc] border border-[#2c3340] text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          {copiedArt ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Скопировано</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Копировать предмет</span>
            </>
          )}
        </button>
      </div>

      {/* Active Artifact Spotlight Card (editable) */}
      {activeItem && (
        <div className="p-5 rounded-lg bg-[#14171f] border border-[#d4a359]/40 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono-tabular">
            <div className="flex flex-wrap items-center gap-2">
              {rollNumber && <span className="text-[#d4a359] font-bold">Рандомайзер ({rollNumber}) ·</span>}
              <span className={`font-bold ${rarityTextColor(getField(`art:${activeItem.id}:rarity`, activeItem.rarity))}`}>
                <EditableField
                  fieldKey={`art:${activeItem.id}:rarity`}
                  defaultValue={activeItem.rarity}
                  getField={getField}
                  setField={setField}
                  editModeAll={editModeAll}
                />
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-[#d4a359] font-bold">
                Цена:{' '}
                <EditableField
                  fieldKey={`art:${activeItem.id}:cost`}
                  defaultValue={activeItem.cost}
                  getField={getField}
                  setField={setField}
                  editModeAll={editModeAll}
                />
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-[#a1a1aa]">
                Настройка:{' '}
                <EditableField
                  fieldKey={`art:${activeItem.id}:attunement`}
                  defaultValue={activeItem.attunement}
                  getField={getField}
                  setField={setField}
                  editModeAll={editModeAll}
                />
              </span>
            </div>
            <span className="text-[#cba6f7]">
              <EditableField
                fieldKey={`art:${activeItem.id}:source`}
                defaultValue={activeItem.source}
                getField={getField}
                setField={setField}
                editModeAll={editModeAll}
              />
            </span>
          </div>

          <h2 className="font-display text-xl sm:text-2xl font-bold text-[#ebe6dc]">
            <EditableField
              fieldKey={`art:${activeItem.id}:name`}
              defaultValue={activeItem.name}
              getField={getField}
              setField={setField}
              editModeAll={editModeAll}
            />
          </h2>

          <div className="text-xs text-[#a1a1aa]">
            Тип:{' '}
            <EditableField
              fieldKey={`art:${activeItem.id}:type`}
              defaultValue={activeItem.type}
              getField={getField}
              setField={setField}
              editModeAll={editModeAll}
            />
          </div>

          <div className="text-[15px] leading-relaxed text-[#d4cfc5]">
            <EditableField
              fieldKey={`art:${activeItem.id}:effect`}
              defaultValue={activeItem.effect}
              getField={getField}
              setField={setField}
              editModeAll={editModeAll}
              multiline
            />
          </div>
        </div>
      )}

      {/* Artifacts Table sorted by Rarity with dedicated Cost column */}
      <div className="overflow-x-auto rounded-lg border border-[#232833] bg-[#13161c]">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-[#2c3340] bg-[#171b22] text-[#d4a359]">
              <th className="py-2.5 px-3 font-semibold whitespace-nowrap w-32">Редкость</th>
              <th className="py-2.5 px-3 font-semibold font-mono-tabular whitespace-nowrap w-36">Стоимость</th>
              <th className="py-2.5 px-3 font-semibold whitespace-nowrap min-w-[210px]">Артефакт / Предмет</th>
              <th className="py-2.5 px-3 font-semibold whitespace-nowrap w-44">Источник / Босс</th>
              <th className="py-2.5 px-3 font-semibold min-w-[300px]">Свойства и механика</th>
            </tr>
          </thead>
          <tbody>
            {filteredList.map((art) => {
              const isSelected = activeItem?.id === art.id;
              const isCustom = art.id.startsWith('art-custom-');
              return (
                <tr
                  key={art.id}
                  onClick={() => {
                    setSelectedId(art.id);
                    setRollNumber('');
                  }}
                  className={`border-b border-[#1f242e] cursor-pointer transition-colors ${
                    isSelected ? 'bg-[#211d16]' : 'hover:bg-[#191e27]'
                  }`}
                >
                  <td
                    onClick={(e) => e.stopPropagation()}
                    className={`py-2.5 px-3 font-semibold whitespace-nowrap ${rarityTextColor(
                      getField(`art:${art.id}:rarity`, art.rarity)
                    )}`}
                  >
                    <EditableField
                      fieldKey={`art:${art.id}:rarity`}
                      defaultValue={art.rarity}
                      getField={getField}
                      setField={setField}
                      editModeAll={editModeAll}
                    />
                  </td>
                  <td
                    onClick={(e) => e.stopPropagation()}
                    className="py-2.5 px-3 font-mono-tabular font-bold text-[#d4a359] whitespace-nowrap"
                  >
                    <EditableField
                      fieldKey={`art:${art.id}:cost`}
                      defaultValue={art.cost}
                      getField={getField}
                      setField={setField}
                      editModeAll={editModeAll}
                    />
                  </td>
                  <td onClick={(e) => e.stopPropagation()} className="py-2.5 px-3 font-semibold text-[#ebe6dc]">
                    <div className="flex items-center justify-between gap-2">
                      <EditableField
                        fieldKey={`art:${art.id}:name`}
                        defaultValue={art.name}
                        getField={getField}
                        setField={setField}
                        editModeAll={editModeAll}
                      />
                      {isCustom && (
                        <button
                          type="button"
                          onClick={() => onDeleteCustomArtifact(art.id)}
                          title="Удалить свой предмет"
                          className="text-[#f87171] hover:text-[#fb8585] cursor-pointer shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td onClick={(e) => e.stopPropagation()} className="py-2.5 px-3 text-xs text-[#cba6f7]">
                    <EditableField
                      fieldKey={`art:${art.id}:source`}
                      defaultValue={art.source}
                      getField={getField}
                      setField={setField}
                      editModeAll={editModeAll}
                    />
                  </td>
                  <td onClick={(e) => e.stopPropagation()} className="py-2.5 px-3 text-xs text-[#d4cfc5] leading-relaxed">
                    <EditableField
                      fieldKey={`art:${art.id}:effect`}
                      defaultValue={art.effect}
                      getField={getField}
                      setField={setField}
                      editModeAll={editModeAll}
                      multiline
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ==================== INGREDIENTS LEDGER ==================== */

const IngredientsLedger: React.FC<{
  rows: IngredientPriceItem[];
  getField: (k: string, fb: string) => string;
  setField: (k: string, val: string, fb: string) => void;
  editModeAll: boolean;
}> = ({ rows, getField, setField, editModeAll }) => (
  <div className="max-w-6xl mx-auto space-y-4">
    <div>
      <h1 className="font-display text-2xl font-bold text-[#d4a359]">
        Алхимические ингредиенты и цены по биомам
      </h1>
      <p className="text-xs text-[#a1a1aa] mt-1">
        Таблица стоимости скупки и продажи ингредиентов ({rows.length} позиций) · Любая ячейка редактируется по клику
      </p>
    </div>

    <div className="overflow-x-auto rounded-lg border border-[#232833] bg-[#13161c]">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-[#2c3340] bg-[#171b22] text-[#d4a359]">
            <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Ингредиент</th>
            <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Редкость</th>
            <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Родной биом</th>
            <th className="py-2.5 px-3 font-semibold font-mono-tabular whitespace-nowrap">База</th>
            <th className="py-2.5 px-3 font-semibold font-mono-tabular whitespace-nowrap">Сев. предгорье</th>
            <th className="py-2.5 px-3 font-semibold font-mono-tabular whitespace-nowrap">Тундра</th>
            <th className="py-2.5 px-3 font-semibold font-mono-tabular whitespace-nowrap">Пустыня</th>
            <th className="py-2.5 px-3 font-semibold font-mono-tabular whitespace-nowrap">Оазис</th>
            <th className="py-2.5 px-3 font-semibold font-mono-tabular whitespace-nowrap">Умер. широты</th>
            <th className="py-2.5 px-3 font-semibold font-mono-tabular whitespace-nowrap">Влаж. юг</th>
            <th className="py-2.5 px-3 font-semibold font-mono-tabular whitespace-nowrap">Столица</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((ing) => (
            <tr
              key={ing.id}
              className="border-b border-[#1f242e] hover:bg-[#191e27] transition-colors"
            >
              <td className="py-2.5 px-3 font-semibold text-[#ebe6dc] whitespace-nowrap">
                <EditableField fieldKey={`ing:${ing.id}:name`} defaultValue={ing.name} getField={getField} setField={setField} editModeAll={editModeAll} />
              </td>
              <td className="py-2.5 px-3 text-[#a1a1aa] whitespace-nowrap">
                <EditableField fieldKey={`ing:${ing.id}:rarity`} defaultValue={ing.rarity} getField={getField} setField={setField} editModeAll={editModeAll} />
              </td>
              <td className="py-2.5 px-3 text-[#c7c2b8] min-w-[160px]">
                <EditableField fieldKey={`ing:${ing.id}:biome`} defaultValue={ing.biome} getField={getField} setField={setField} editModeAll={editModeAll} />
              </td>
              <td className="py-2.5 px-3 font-mono-tabular font-semibold text-[#d4a359] whitespace-nowrap">
                <EditableField fieldKey={`ing:${ing.id}:base`} defaultValue={ing.base} getField={getField} setField={setField} editModeAll={editModeAll} />
              </td>
              <td className="py-2.5 px-3 font-mono-tabular text-[#c7c2b8] whitespace-nowrap">
                <EditableField fieldKey={`ing:${ing.id}:northFoothills`} defaultValue={ing.northFoothills} getField={getField} setField={setField} editModeAll={editModeAll} />
              </td>
              <td className="py-2.5 px-3 font-mono-tabular text-[#c7c2b8] whitespace-nowrap">
                <EditableField fieldKey={`ing:${ing.id}:tundra`} defaultValue={ing.tundra} getField={getField} setField={setField} editModeAll={editModeAll} />
              </td>
              <td className="py-2.5 px-3 font-mono-tabular text-[#c7c2b8] whitespace-nowrap">
                <EditableField fieldKey={`ing:${ing.id}:desert`} defaultValue={ing.desert} getField={getField} setField={setField} editModeAll={editModeAll} />
              </td>
              <td className="py-2.5 px-3 font-mono-tabular text-[#c7c2b8] whitespace-nowrap">
                <EditableField fieldKey={`ing:${ing.id}:oasis`} defaultValue={ing.oasis} getField={getField} setField={setField} editModeAll={editModeAll} />
              </td>
              <td className="py-2.5 px-3 font-mono-tabular text-[#c7c2b8] whitespace-nowrap">
                <EditableField fieldKey={`ing:${ing.id}:temperate`} defaultValue={ing.temperate} getField={getField} setField={setField} editModeAll={editModeAll} />
              </td>
              <td className="py-2.5 px-3 font-mono-tabular text-[#c7c2b8] whitespace-nowrap">
                <EditableField fieldKey={`ing:${ing.id}:humidSouth`} defaultValue={ing.humidSouth} getField={getField} setField={setField} editModeAll={editModeAll} />
              </td>
              <td className="py-2.5 px-3 font-mono-tabular font-semibold text-[#ebe6dc] whitespace-nowrap">
                <EditableField fieldKey={`ing:${ing.id}:capital`} defaultValue={ing.capital} getField={getField} setField={setField} editModeAll={editModeAll} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

/* ==================== INJURIES WORKSPACE ==================== */

const InjuriesWorkspace: React.FC<{
  searchQuery: string;
  getField: (k: string, fb: string) => string;
  setField: (k: string, val: string, fb: string) => void;
  editModeAll: boolean;
}> = ({ searchQuery, getField, setField, editModeAll }) => {
  const [tableMode, setTableMode] = useState<'heavy' | 'permanent'>('heavy');
  const [manualValue, setManualValue] = useState<number>(16);
  const [rolledDice, setRolledDice] = useState<number[] | null>(null);
  const [selectedId, setSelectedId] = useState<string>('inj-h-07');
  const [copiedInjury, setCopiedInjury] = useState(false);

  const activeList = useMemo(() => {
    const base = tableMode === 'heavy' ? HEAVY_INJURIES : PERMANENT_INJURIES;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (item) =>
        getField(`inj:${item.id}:name`, item.name).toLowerCase().includes(q) ||
        getField(`inj:${item.id}:effect`, item.effect).toLowerCase().includes(q) ||
        getField(`inj:${item.id}:range`, item.rangeLabel).toLowerCase().includes(q)
    );
  }, [tableMode, searchQuery, getField]);

  const activeItem = useMemo(() => {
    const base = tableMode === 'heavy' ? HEAVY_INJURIES : PERMANENT_INJURIES;
    return base.find((i) => i.id === selectedId) ?? base[0];
  }, [tableMode, selectedId]);

  const rollInjury = (mode: 'heavy' | 'permanent') => {
    const count = mode === 'heavy' ? 4 : 2;
    const dice = Array.from({ length: count }, () => Math.floor(Math.random() * 10) + 1);
    const total = dice.reduce((acc, n) => acc + n, 0);
    const base = mode === 'heavy' ? HEAVY_INJURIES : PERMANENT_INJURIES;
    const clamped =
      mode === 'heavy' ? Math.min(40, Math.max(4, total)) : Math.min(20, Math.max(2, total));
    const match = base.find((i) => clamped >= i.min && clamped <= i.max) ?? base[0];

    setTableMode(mode);
    setRolledDice(dice);
    setManualValue(total);
    setSelectedId(match.id);
  };

  const openByManualValue = () => {
    const base = tableMode === 'heavy' ? HEAVY_INJURIES : PERMANENT_INJURIES;
    const clamped =
      tableMode === 'heavy'
        ? Math.min(40, Math.max(4, Math.round(manualValue || 4)))
        : Math.min(20, Math.max(2, Math.round(manualValue || 2)));
    const match = base.find((i) => clamped >= i.min && clamped <= i.max) ?? base[0];
    setRolledDice(null);
    setSelectedId(match.id);
  };

  const handleCopyActive = async () => {
    if (!activeItem) return;
    const title = tableMode === 'heavy' ? 'Тяжёлая травма (4d10)' : 'Постоянная травма (2d10)';
    const text = `${title} [${getField(`inj:${activeItem.id}:range`, activeItem.rangeLabel)}]: ${getField(`inj:${activeItem.id}:name`, activeItem.name)}\nЭффект: ${getField(`inj:${activeItem.id}:effect`, activeItem.effect)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedInjury(true);
      setTimeout(() => setCopiedInjury(false), 1500);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header + Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#232833]">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#f87171]">
            Система травм и увечий
          </h1>
          <p className="text-xs text-[#a1a1aa] mt-1">
            Тяжёлые травмы (4d10) и Постоянные травмы (2d10) · Каждое поле таблицы редактируется
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => rollInjury('heavy')}
            className="h-9 px-4 rounded-md bg-[#f87171] hover:bg-[#fb8585] text-[#111317] text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
          >
            <Dices className="w-4 h-4" />
            <span>Бросить 4d10 (Тяжёлая)</span>
          </button>

          <button
            type="button"
            onClick={() => rollInjury('permanent')}
            className="h-9 px-4 rounded-md bg-[#d4a359] hover:bg-[#dfb36f] text-[#111317] text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
          >
            <Dices className="w-4 h-4" />
            <span>Бросить 2d10 (Постоянная)</span>
          </button>

          <div className="flex items-center h-9 bg-[#0b0d10] border border-[#2c3340] rounded-md overflow-hidden">
            <input
              type="number"
              min={tableMode === 'heavy' ? 4 : 2}
              max={tableMode === 'heavy' ? 40 : 20}
              value={manualValue}
              onChange={(e) => setManualValue(Number(e.target.value))}
              className="w-12 h-full px-2 bg-transparent text-[#ebe6dc] text-xs font-bold font-mono-tabular text-center focus:outline-none"
            />
            <button
              type="button"
              onClick={openByManualValue}
              className="h-full px-2.5 bg-[#1a1e26] hover:bg-[#232833] text-xs font-semibold text-[#ebe6dc] border-l border-[#2c3340] cursor-pointer whitespace-nowrap"
            >
              Открыть №
            </button>
          </div>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-[#13161c] rounded-lg border border-[#232833]">
          <button
            type="button"
            onClick={() => {
              setTableMode('heavy');
              setRolledDice(null);
              setSelectedId(HEAVY_INJURIES[0].id);
            }}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              tableMode === 'heavy'
                ? 'bg-[#2b181a] text-[#f87171]'
                : 'text-[#a1a1aa] hover:text-[#ebe6dc]'
            }`}
          >
            Тяжёлые травмы (4d10) · {HEAVY_INJURIES.length}
          </button>
          <button
            type="button"
            onClick={() => {
              setTableMode('permanent');
              setRolledDice(null);
              setSelectedId(PERMANENT_INJURIES[0].id);
            }}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              tableMode === 'permanent'
                ? 'bg-[#2a2216] text-[#d4a359]'
                : 'text-[#a1a1aa] hover:text-[#ebe6dc]'
            }`}
          >
            Постоянные травмы (2d10) · {PERMANENT_INJURIES.length}
          </button>
        </div>

        <button
          type="button"
          onClick={handleCopyActive}
          className="h-8 px-3 rounded-md bg-[#171b22] hover:bg-[#212630] text-[#ebe6dc] border border-[#2c3340] text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          {copiedInjury ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Травма скопирована</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Копировать травму</span>
            </>
          )}
        </button>
      </div>

      {/* Active Injury Spotlight Card (editable) */}
      {activeItem && (
        <div className="p-5 rounded-lg bg-[#161317] border border-[#f87171]/35 space-y-2.5">
          <div className="text-xs font-mono-tabular text-[#f87171]">
            {tableMode === 'heavy' ? 'Таблица Тяжёлых Травм (4d10)' : 'Таблица Постоянных Травм (2d10)'} · Значение:{' '}
            <span className="font-bold">
              <EditableField
                fieldKey={`inj:${activeItem.id}:range`}
                defaultValue={activeItem.rangeLabel}
                getField={getField}
                setField={setField}
                editModeAll={editModeAll}
              />
            </span>
            {rolledDice && (
              <span className="text-[#d4a359] ml-2">
                · Бросок: [{rolledDice.join(' + ')}] = {rolledDice.reduce((a, b) => a + b, 0)}
              </span>
            )}
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-[#ebe6dc]">
            <EditableField
              fieldKey={`inj:${activeItem.id}:name`}
              defaultValue={activeItem.name}
              getField={getField}
              setField={setField}
              editModeAll={editModeAll}
            />
          </h2>
          <div className="text-[15px] leading-relaxed text-[#d4cfc5]">
            <EditableField
              fieldKey={`inj:${activeItem.id}:effect`}
              defaultValue={activeItem.effect}
              getField={getField}
              setField={setField}
              editModeAll={editModeAll}
              multiline
            />
          </div>
        </div>
      )}

      {/* Full Tabular Ledger (editable) */}
      <div className="overflow-x-auto rounded-lg border border-[#232833] bg-[#13161c]">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-[#2c3340] bg-[#171b22] text-[#d4a359]">
              <th className="py-2.5 px-3 font-semibold font-mono-tabular whitespace-nowrap w-20">
                {tableMode === 'heavy' ? '4d10' : '2d10'}
              </th>
              <th className="py-2.5 px-3 font-semibold whitespace-nowrap w-64">Травма</th>
              <th className="py-2.5 px-3 font-semibold">Эффект</th>
            </tr>
          </thead>
          <tbody>
            {activeList.map((inj) => {
              const isSelected = activeItem?.id === inj.id;
              return (
                <tr
                  key={inj.id}
                  onClick={() => {
                    setSelectedId(inj.id);
                    setRolledDice(null);
                  }}
                  className={`border-b border-[#1f242e] cursor-pointer transition-colors ${
                    isSelected ? 'bg-[#26181a]' : 'hover:bg-[#191e27]'
                  }`}
                >
                  <td
                    onClick={(e) => e.stopPropagation()}
                    className={`py-2.5 px-3 font-mono-tabular font-bold whitespace-nowrap ${
                      isSelected ? 'text-[#f87171]' : 'text-[#d4a359]'
                    }`}
                  >
                    <EditableField
                      fieldKey={`inj:${inj.id}:range`}
                      defaultValue={inj.rangeLabel}
                      getField={getField}
                      setField={setField}
                      editModeAll={editModeAll}
                    />
                  </td>
                  <td onClick={(e) => e.stopPropagation()} className="py-2.5 px-3 font-semibold text-[#ebe6dc]">
                    <EditableField
                      fieldKey={`inj:${inj.id}:name`}
                      defaultValue={inj.name}
                      getField={getField}
                      setField={setField}
                      editModeAll={editModeAll}
                    />
                  </td>
                  <td onClick={(e) => e.stopPropagation()} className="py-2.5 px-3 text-[#d4cfc5] leading-relaxed">
                    <EditableField
                      fieldKey={`inj:${inj.id}:effect`}
                      defaultValue={inj.effect}
                      getField={getField}
                      setField={setField}
                      editModeAll={editModeAll}
                      multiline
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
