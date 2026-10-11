import React, { useState, useEffect } from 'react';
import { ServerInstance, GModServerConfig } from '../types';
import {
  Save,
  FolderOpen,
  Sliders,
  FileCode,
  Shield,
  Layers,
  Key,
  Users,
  Gauge,
  Radio,
  Gamepad2,
  Check,
  AlertCircle,
  ExternalLink,
  DollarSign,
  Crosshair,
  HelpCircle,
  Film,
  Sparkles,
  Volume2,
  Move,
  Box,
  Globe,
  Zap,
  MapPin
} from 'lucide-react';

interface GModConfigTabProps {
  server: ServerInstance;
  onServerUpdated: (server: ServerInstance) => void;
}

type ConfigCategory = 'gamemode' | 'general' | 'workshop' | 'network' | 'physics';

export const GModConfigTab: React.FC<GModConfigTabProps> = ({ server, onServerUpdated }) => {
  const [activeSubTab, setActiveSubTab] = useState<'visual' | 'raw'>('visual');
  const [activeCategory, setActiveCategory] = useState<ConfigCategory>('gamemode');
  const [rawCfg, setRawCfg] = useState('');
  const [loadingCfg, setLoadingCfg] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // General & Startup
  const [hostname, setHostname] = useState(server.name);
  const [port, setPort] = useState(server.port || 27015);
  const [gamemode, setGamemode] = useState(server.gmodConfig?.gamemode || 'sandbox');
  const [selectedGamemodeView, setSelectedGamemodeView] = useState(server.gmodConfig?.gamemode || 'sandbox');
  const [defaultMap, setDefaultMap] = useState(server.gmodConfig?.defaultMap || 'gm_construct');
  const [maxPlayers, setMaxPlayers] = useState(server.gmodConfig?.maxPlayers || 16);
  const [tickrate, setTickrate] = useState(server.gmodConfig?.tickrate || 66);
  const [lanMode, setLanMode] = useState(false);
  const [region, setRegion] = useState(255);

  // Workshop & Passwords
  const [workshopCollectionId, setWorkshopCollectionId] = useState(server.gmodConfig?.workshopCollectionId || '');
  const [steamApiKey, setSteamApiKey] = useState(server.gmodConfig?.steamApiKey || '');
  const [rconPassword, setRconPassword] = useState(server.gmodConfig?.rconPassword || '');
  const [serverPassword, setServerPassword] = useState(server.gmodConfig?.serverPassword || '');

  // Network & FastDL
  const [loadingUrl, setLoadingUrl] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [allowDownload, setAllowDownload] = useState(true);
  const [allowUpload, setAllowUpload] = useState(true);
  const [maxFileSize, setMaxFileSize] = useState(64);

  // Physics & Voice
  const [gravity, setGravity] = useState(600);
  const [fallDamage, setFallDamage] = useState(false);
  const [friction, setFriction] = useState(8);
  const [accelerate, setAccelerate] = useState(10);
  const [airAccelerate, setAirAccelerate] = useState(10);
  const [voiceEnable, setVoiceEnable] = useState(true);
  const [allTalk, setAllTalk] = useState(true);

  // --- Sandbox Gamemode Convars ---
  const [sboxNoclip, setSboxNoclip] = useState(true);
  const [sboxAllowNpcs, setSboxAllowNpcs] = useState(true);
  const [sboxGodmode, setSboxGodmode] = useState(false);
  const [sboxPvpDamage, setSboxPvpDamage] = useState(false);
  const [sboxWeapons, setSboxWeapons] = useState(true);
  const [sboxBoneManip, setSboxBoneManip] = useState(false);
  const [sboxMaxProps, setSboxMaxProps] = useState(150);
  const [sboxMaxRagdolls, setSboxMaxRagdolls] = useState(10);
  const [sboxMaxVehicles, setSboxMaxVehicles] = useState(8);
  const [sboxMaxBalloons, setSboxMaxBalloons] = useState(15);
  const [sboxMaxEffects, setSboxMaxEffects] = useState(50);
  const [sboxMaxSents, setSboxMaxSents] = useState(25);
  const [sboxMaxThrusters, setSboxMaxThrusters] = useState(30);
  const [sboxMaxWheels, setSboxMaxWheels] = useState(20);
  const [sboxMaxLights, setSboxMaxLights] = useState(5);
  const [sboxMaxLamps, setSboxMaxLamps] = useState(5);
  const [sboxMaxHoverballs, setSboxMaxHoverballs] = useState(20);
  const [sboxMaxDynamite, setSboxMaxDynamite] = useState(5);
  const [sboxMaxButtons, setSboxMaxButtons] = useState(25);

  // --- DarkRP Gamemode Convars ---
  const [rpStartingMoney, setRpStartingMoney] = useState(500);
  const [rpPaydayTime, setRpPaydayTime] = useState(120);
  const [rpPaydayAmount, setRpPaydayAmount] = useState(50);
  const [rpHungerMod, setRpHungerMod] = useState(false);
  const [rpLicenseGuns, setRpLicenseGuns] = useState(true);
  const [rpAdvertSystem, setRpAdvertSystem] = useState(true);
  const [rpCustomJobs, setRpCustomJobs] = useState(true);
  const [rpJailTimer, setRpJailTimer] = useState(120);
  const [rpDemoteTime, setRpDemoteTime] = useState(120);
  const [rpPropPushing, setRpPropPushing] = useState(false);
  const [rpAdminWeapons, setRpAdminWeapons] = useState(true);

  // --- Trouble in Terrorist Town (TTT) Convars ---
  const [tttPrepTime, setTttPrepTime] = useState(30);
  const [tttRoundTimeMin, setTttRoundTimeMin] = useState(10);
  const [tttPostTime, setTttPostTime] = useState(30);
  const [tttHaste, setTttHaste] = useState(true);
  const [tttHasteStartingMins, setTttHasteStartingMins] = useState(5);
  const [tttTraitorPct, setTttTraitorPct] = useState(0.25);
  const [tttDetectivePct, setTttDetectivePct] = useState(0.13);
  const [tttDetectiveMinPlayers, setTttDetectiveMinPlayers] = useState(8);
  const [tttKarma, setTttKarma] = useState(true);
  const [tttKarmaStarting, setTttKarmaStarting] = useState(1000);
  const [tttKarmaMax, setTttKarmaMax] = useState(1000);
  const [tttKarmaLowAutokick, setTttKarmaLowAutokick] = useState(true);
  const [tttKarmaLowAmount, setTttKarmaLowAmount] = useState(450);
  const [tttKarmaCleanBonus, setTttKarmaCleanBonus] = useState(30);
  const [tttKillerDnaRange, setTttKillerDnaRange] = useState(550);
  const [tttKillerDnaBasetime, setTttKillerDnaBasetime] = useState(100);
  const [tttLocationalVoice, setTttLocationalVoice] = useState(false);

  // --- Prop Hunt Convars ---
  const [phBlindTime, setPhBlindTime] = useState(30);
  const [phRoundTime, setPhRoundTime] = useState(300);
  const [phHunterFirePenalty, setPhHunterFirePenalty] = useState(5);
  const [phHunterKillBonus, setPhHunterKillBonus] = useState(25);
  const [phAutoTaunt, setPhAutoTaunt] = useState(true);
  const [phAutoTauntDelay, setPhAutoTauntDelay] = useState(45);
  const [phCustomTauntDelay, setPhCustomTauntDelay] = useState(6);
  const [phPropsCamDistance, setPhPropsCamDistance] = useState(120);

  // --- Murder Convars ---
  const [muRoundTime, setMuRoundTime] = useState(300);
  const [muClueLimit, setMuClueLimit] = useState(5);
  const [muKnifeDelay, setMuKnifeDelay] = useState(10);
  const [muFlashlightBattery, setMuFlashlightBattery] = useState(60);
  const [muShowMurdererKnife, setMuShowMurdererKnife] = useState(false);
  const [muDropWeaponOnDeath, setMuDropWeaponOnDeath] = useState(true);

  // --- Cinema Convars ---
  const [cinemaMaxRequests, setCinemaMaxRequests] = useState(5);
  const [cinemaVideoDurationMax, setCinemaVideoDurationMax] = useState(120);
  const [cinemaVoteskipPercent, setCinemaVoteskipPercent] = useState(0.6);
  const [cinemaAllowTwitch, setCinemaAllowTwitch] = useState(true);
  const [cinemaAllowUrl, setCinemaAllowUrl] = useState(true);

  // Load and parse server.cfg
  const loadRawCfg = async () => {
    setLoadingCfg(true);
    try {
      const content = await window.electronAPI.readGModServerCfg(server.path);
      setRawCfg(content);

      if (content) {
        const parseNum = (re: RegExp, fallback: number) => {
          const m = content.match(re);
          return m && m[1] ? parseFloat(m[1]) : fallback;
        };
        const parseBool = (re: RegExp, fallback: boolean) => {
          const m = content.match(re);
          return m && m[1] ? m[1] === '1' : fallback;
        };
        const parseStr = (re: RegExp, fallback: string) => {
          const m = content.match(re);
          return m && m[1] ? m[1].replace(/^["']|["']$/g, '').trim() : fallback;
        };

        // Network & Discovery
        setLanMode(parseBool(/sv_lan\s+([01])/i, false));
        setRegion(parseNum(/sv_region\s+([0-9]+)/i, 255));
        setLoadingUrl(parseStr(/sv_loadingurl\s+([^\r\n]+)/i, ''));
        setDownloadUrl(parseStr(/sv_downloadurl\s+([^\r\n]+)/i, ''));
        setAllowDownload(parseBool(/sv_allowdownload\s+([01])/i, true));
        setAllowUpload(parseBool(/sv_allowupload\s+([01])/i, true));
        setMaxFileSize(parseNum(/net_maxfilesize\s+([0-9]+)/i, 64));

        // Physics & Voice
        setGravity(parseNum(/sv_gravity\s+([0-9]+)/i, 600));
        setFallDamage(parseBool(/mp_falldamage\s+([01])/i, false));
        setFriction(parseNum(/sv_friction\s+([0-9.]+)/i, 8));
        setAccelerate(parseNum(/sv_accelerate\s+([0-9.]+)/i, 10));
        setAirAccelerate(parseNum(/sv_airaccelerate\s+([0-9.]+)/i, 10));
        setVoiceEnable(parseBool(/sv_voiceenable\s+([01])/i, true));
        setAllTalk(parseBool(/sv_alltalk\s+([01])/i, true));

        // Sandbox
        setSboxNoclip(parseBool(/sbox_noclip\s+([01])/i, true));
        setSboxAllowNpcs(parseBool(/sbox_allownpcs\s+([01])/i, true));
        setSboxGodmode(parseBool(/sbox_godmode\s+([01])/i, false));
        setSboxPvpDamage(parseBool(/sbox_plpldamage\s+([01])/i, false));
        setSboxWeapons(parseBool(/sbox_weapons\s+([01])/i, true));
        setSboxBoneManip(parseBool(/sbox_bonemanip_npc\s+([01])/i, false));
        setSboxMaxProps(parseNum(/sbox_maxprops\s+([0-9]+)/i, 150));
        setSboxMaxRagdolls(parseNum(/sbox_maxragdolls\s+([0-9]+)/i, 10));
        setSboxMaxVehicles(parseNum(/sbox_maxvehicles\s+([0-9]+)/i, 8));
        setSboxMaxBalloons(parseNum(/sbox_maxballoons\s+([0-9]+)/i, 15));
        setSboxMaxEffects(parseNum(/sbox_maxeffects\s+([0-9]+)/i, 50));
        setSboxMaxSents(parseNum(/sbox_maxsents\s+([0-9]+)/i, 25));
        setSboxMaxThrusters(parseNum(/sbox_maxthrusters\s+([0-9]+)/i, 30));
        setSboxMaxWheels(parseNum(/sbox_maxwheels\s+([0-9]+)/i, 20));
        setSboxMaxLights(parseNum(/sbox_maxlights\s+([0-9]+)/i, 5));
        setSboxMaxLamps(parseNum(/sbox_maxlamps\s+([0-9]+)/i, 5));
        setSboxMaxHoverballs(parseNum(/sbox_maxhoverballs\s+([0-9]+)/i, 20));
        setSboxMaxDynamite(parseNum(/sbox_maxdynamite\s+([0-9]+)/i, 5));
        setSboxMaxButtons(parseNum(/sbox_maxbuttons\s+([0-9]+)/i, 25));

        // DarkRP
        setRpStartingMoney(parseNum(/rp_startingmoney\s+([0-9]+)/i, 500));
        setRpPaydayTime(parseNum(/(?:rp_paydaytime|paydaytime)\s+([0-9]+)/i, 120));
        setRpPaydayAmount(parseNum(/(?:rp_paydayamount|paydayamount)\s+([0-9]+)/i, 50));
        setRpHungerMod(parseBool(/(?:rp_hungermod|hungermod)\s+([01])/i, false));
        setRpLicenseGuns(parseBool(/rp_licenseguns\s+([01])/i, true));
        setRpAdvertSystem(parseBool(/rp_advertsystem\s+([01])/i, true));
        setRpCustomJobs(parseBool(/rp_customjobs\s+([01])/i, true));
        setRpJailTimer(parseNum(/(?:rp_jailtimer|jailtimer)\s+([0-9]+)/i, 120));
        setRpDemoteTime(parseNum(/(?:rp_demotetime|demotetime)\s+([0-9]+)/i, 120));
        setRpPropPushing(parseBool(/rp_proppushing\s+([01])/i, false));
        setRpAdminWeapons(parseBool(/rp_adminweapons\s+([01])/i, true));

        // TTT
        setTttPrepTime(parseNum(/ttt_preptime\s+([0-9]+)/i, 30));
        setTttRoundTimeMin(parseNum(/ttt_roundtime_min\s+([0-9]+)/i, 10));
        setTttPostTime(parseNum(/ttt_posttime\s+([0-9]+)/i, 30));
        setTttHaste(parseBool(/ttt_haste\s+([01])/i, true));
        setTttHasteStartingMins(parseNum(/ttt_haste_starting_minutes\s+([0-9]+)/i, 5));
        setTttTraitorPct(parseNum(/ttt_traitor_pct\s+([0-9.]+)/i, 0.25));
        setTttDetectivePct(parseNum(/ttt_detective_pct\s+([0-9.]+)/i, 0.13));
        setTttDetectiveMinPlayers(parseNum(/ttt_detective_min_players\s+([0-9]+)/i, 8));
        setTttKarma(parseBool(/ttt_karma\s+([01])/i, true));
        setTttKarmaStarting(parseNum(/ttt_karma_starting\s+([0-9]+)/i, 1000));
        setTttKarmaMax(parseNum(/ttt_karma_max\s+([0-9]+)/i, 1000));
        setTttKarmaLowAutokick(parseBool(/ttt_karma_low_autokick\s+([01])/i, true));
        setTttKarmaLowAmount(parseNum(/ttt_karma_low_amount\s+([0-9]+)/i, 450));
        setTttKarmaCleanBonus(parseNum(/ttt_karma_clean_bonus\s+([0-9]+)/i, 30));
        setTttKillerDnaRange(parseNum(/ttt_killer_dna_range\s+([0-9]+)/i, 550));
        setTttKillerDnaBasetime(parseNum(/ttt_killer_dna_basetime\s+([0-9]+)/i, 100));
        setTttLocationalVoice(parseBool(/ttt_locational_voice\s+([01])/i, false));

        // Prop Hunt
        setPhBlindTime(parseNum(/ph_blindtime\s+([0-9]+)/i, 30));
        setPhRoundTime(parseNum(/ph_round_time\s+([0-9]+)/i, 300));
        setPhHunterFirePenalty(parseNum(/ph_hunter_fire_penalty\s+([0-9]+)/i, 5));
        setPhHunterKillBonus(parseNum(/ph_hunter_kill_bonus\s+([0-9]+)/i, 25));
        setPhAutoTaunt(parseBool(/ph_auto_taunt\s+([01])/i, true));
        setPhAutoTauntDelay(parseNum(/ph_auto_taunt_delay\s+([0-9]+)/i, 45));
        setPhCustomTauntDelay(parseNum(/ph_custom_taunt_delay\s+([0-9]+)/i, 6));
        setPhPropsCamDistance(parseNum(/ph_props_cam_distance\s+([0-9]+)/i, 120));

        // Murder
        setMuRoundTime(parseNum(/mu_round_time\s+([0-9]+)/i, 300));
        setMuClueLimit(parseNum(/mu_clue_limit\s+([0-9]+)/i, 5));
        setMuKnifeDelay(parseNum(/mu_knife_delay\s+([0-9]+)/i, 10));
        setMuFlashlightBattery(parseNum(/mu_flashlight_battery\s+([0-9]+)/i, 60));
        setMuShowMurdererKnife(parseBool(/mu_show_murderer_knife\s+([01])/i, false));
        setMuDropWeaponOnDeath(parseBool(/mu_drop_weapon_on_death\s+([01])/i, true));

        // Cinema
        setCinemaMaxRequests(parseNum(/cinema_max_requests\s+([0-9]+)/i, 5));
        setCinemaVideoDurationMax(parseNum(/cinema_video_duration_max\s+([0-9]+)/i, 120));
        setCinemaVoteskipPercent(parseNum(/cinema_voteskip_percent\s+([0-9.]+)/i, 0.6));
        setCinemaAllowTwitch(parseBool(/cinema_allow_twitch\s+([01])/i, true));
        setCinemaAllowUrl(parseBool(/cinema_allow_url\s+([01])/i, true));
      }
    } catch (err) {
      console.error('Failed to load server.cfg:', err);
    } finally {
      setLoadingCfg(false);
    }
  };

  useEffect(() => {
    loadRawCfg();
  }, [server.path]);

  // Update selected gamemode view whenever active gamemode changes
  useEffect(() => {
    setSelectedGamemodeView(gamemode);
  }, [gamemode]);

  const handleGamemodeChange = (newMode: string) => {
    setGamemode(newMode);
    setSelectedGamemodeView(newMode);

    // Suggest appropriate default map if currently on standard construct
    if (defaultMap === 'gm_construct' || defaultMap === 'gm_flatgrass') {
      if (newMode === 'darkrp') setDefaultMap('rp_downtown_v4c_v2');
      else if (newMode === 'terrortown') setDefaultMap('ttt_minecraft_b5');
      else if (newMode === 'prop_hunt') setDefaultMap('ph_office');
      else if (newMode === 'murder') setDefaultMap('mu_cluedo');
      else if (newMode === 'cinema') setDefaultMap('cinema_theatron');
    }
  };

  const handleSaveVisual = async () => {
    setSaving(true);
    try {
      // 1. Update ServerInstance and gmodConfig
      const updatedGmodConfig: GModServerConfig = {
        ...server.gmodConfig,
        gamemode,
        defaultMap,
        maxPlayers,
        tickrate,
        workshopCollectionId: workshopCollectionId.trim() || undefined,
        steamApiKey: steamApiKey.trim() || undefined,
        rconPassword: rconPassword.trim() || undefined,
        serverPassword: serverPassword.trim() || undefined
      };

      const updatedServer: ServerInstance = {
        ...server,
        name: hostname,
        port,
        gmodConfig: updatedGmodConfig
      };

      await window.electronAPI.saveServer(updatedServer);
      onServerUpdated(updatedServer);

      // 2. Synchronize all visual fields into server.cfg
      let newCfg = rawCfg;
      const setVal = (key: string, val: string | number | boolean) => {
        const strVal = typeof val === 'boolean' ? (val ? '1' : '0') : typeof val === 'string' && (val.includes(' ') || val === '') ? `"${val}"` : String(val);
        const regex = new RegExp(`^\\s*${key}\\s+.*$`, 'm');
        if (regex.test(newCfg)) {
          newCfg = newCfg.replace(regex, `${key} ${strVal}`);
        } else {
          newCfg = newCfg.trimEnd() + `\n${key} ${strVal}\n`;
        }
      };

      // General & Discovery
      setVal('hostname', hostname);
      setVal('sv_password', serverPassword.trim());
      setVal('rcon_password', rconPassword.trim());
      setVal('sv_lan', lanMode);
      setVal('sv_region', region);

      // Network & FastDL
      setVal('sv_loadingurl', loadingUrl.trim());
      setVal('sv_downloadurl', downloadUrl.trim());
      setVal('sv_allowdownload', allowDownload);
      setVal('sv_allowupload', allowUpload);
      setVal('net_maxfilesize', maxFileSize);

      // Physics & Voice
      setVal('sv_gravity', gravity);
      setVal('mp_falldamage', fallDamage);
      setVal('sv_friction', friction);
      setVal('sv_accelerate', accelerate);
      setVal('sv_airaccelerate', airAccelerate);
      setVal('sv_voiceenable', voiceEnable);
      setVal('sv_alltalk', allTalk);

      // Sandbox
      setVal('sbox_noclip', sboxNoclip);
      setVal('sbox_allownpcs', sboxAllowNpcs);
      setVal('sbox_godmode', sboxGodmode);
      setVal('sbox_plpldamage', sboxPvpDamage);
      setVal('sbox_weapons', sboxWeapons);
      setVal('sbox_bonemanip_npc', sboxBoneManip);
      setVal('sbox_maxprops', sboxMaxProps);
      setVal('sbox_maxragdolls', sboxMaxRagdolls);
      setVal('sbox_maxvehicles', sboxMaxVehicles);
      setVal('sbox_maxballoons', sboxMaxBalloons);
      setVal('sbox_maxeffects', sboxMaxEffects);
      setVal('sbox_maxsents', sboxMaxSents);
      setVal('sbox_maxthrusters', sboxMaxThrusters);
      setVal('sbox_maxwheels', sboxMaxWheels);
      setVal('sbox_maxlights', sboxMaxLights);
      setVal('sbox_maxlamps', sboxMaxLamps);
      setVal('sbox_maxhoverballs', sboxMaxHoverballs);
      setVal('sbox_maxdynamite', sboxMaxDynamite);
      setVal('sbox_maxbuttons', sboxMaxButtons);

      // DarkRP
      setVal('rp_startingmoney', rpStartingMoney);
      setVal('rp_paydaytime', rpPaydayTime);
      setVal('rp_paydayamount', rpPaydayAmount);
      setVal('rp_hungermod', rpHungerMod);
      setVal('rp_licenseguns', rpLicenseGuns);
      setVal('rp_advertsystem', rpAdvertSystem);
      setVal('rp_customjobs', rpCustomJobs);
      setVal('rp_jailtimer', rpJailTimer);
      setVal('rp_demotetime', rpDemoteTime);
      setVal('rp_proppushing', rpPropPushing);
      setVal('rp_adminweapons', rpAdminWeapons);

      // TTT
      setVal('ttt_preptime', tttPrepTime);
      setVal('ttt_roundtime_min', tttRoundTimeMin);
      setVal('ttt_posttime', tttPostTime);
      setVal('ttt_haste', tttHaste);
      setVal('ttt_haste_starting_minutes', tttHasteStartingMins);
      setVal('ttt_traitor_pct', tttTraitorPct);
      setVal('ttt_detective_pct', tttDetectivePct);
      setVal('ttt_detective_min_players', tttDetectiveMinPlayers);
      setVal('ttt_karma', tttKarma);
      setVal('ttt_karma_starting', tttKarmaStarting);
      setVal('ttt_karma_max', tttKarmaMax);
      setVal('ttt_karma_low_autokick', tttKarmaLowAutokick);
      setVal('ttt_karma_low_amount', tttKarmaLowAmount);
      setVal('ttt_karma_clean_bonus', tttKarmaCleanBonus);
      setVal('ttt_killer_dna_range', tttKillerDnaRange);
      setVal('ttt_killer_dna_basetime', tttKillerDnaBasetime);
      setVal('ttt_locational_voice', tttLocationalVoice);

      // Prop Hunt
      setVal('ph_blindtime', phBlindTime);
      setVal('ph_round_time', phRoundTime);
      setVal('ph_hunter_fire_penalty', phHunterFirePenalty);
      setVal('ph_hunter_kill_bonus', phHunterKillBonus);
      setVal('ph_auto_taunt', phAutoTaunt);
      setVal('ph_auto_taunt_delay', phAutoTauntDelay);
      setVal('ph_custom_taunt_delay', phCustomTauntDelay);
      setVal('ph_props_cam_distance', phPropsCamDistance);

      // Murder
      setVal('mu_round_time', muRoundTime);
      setVal('mu_clue_limit', muClueLimit);
      setVal('mu_knife_delay', muKnifeDelay);
      setVal('mu_flashlight_battery', muFlashlightBattery);
      setVal('mu_show_murderer_knife', muShowMurdererKnife);
      setVal('mu_drop_weapon_on_death', muDropWeaponOnDeath);

      // Cinema
      setVal('cinema_max_requests', cinemaMaxRequests);
      setVal('cinema_video_duration_max', cinemaVideoDurationMax);
      setVal('cinema_voteskip_percent', cinemaVoteskipPercent);
      setVal('cinema_allow_twitch', cinemaAllowTwitch);
      setVal('cinema_allow_url', cinemaAllowUrl);

      await window.electronAPI.saveGModServerCfg(server.path, newCfg.trim() + '\n');
      setRawCfg(newCfg.trim() + '\n');

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(`Error saving server settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRaw = async () => {
    setSaving(true);
    try {
      await window.electronAPI.saveGModServerCfg(server.path, rawCfg);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(`Error saving server.cfg: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenCfgFolder = () => {
    const sep = window.navigator.userAgent.includes('Windows') ? '\\' : '/';
    window.electronAPI.openFolder(`${server.path}${sep}garrysmod${sep}cfg`);
  };

  const gamemodesList = [
    { id: 'sandbox', name: 'Sandbox', desc: 'Standard building & physics sandbox with prop/entity limits' },
    { id: 'darkrp', name: 'DarkRP', desc: 'Roleplay economy, jobs, laws, money, and police enforcement' },
    { id: 'terrortown', name: 'Trouble in Terrorist Town', desc: 'TTT detective/traitor ratios, round timers & karma balance' },
    { id: 'prop_hunt', name: 'Prop Hunt', desc: 'Hide-and-seek taunts, blind time, and hunter miss penalties' },
    { id: 'murder', name: 'Murder', desc: 'Mystery clue requirements, knife holster & round duration' },
    { id: 'cinema', name: 'Cinema', desc: 'Theater video duration limits, queues, and vote-skipping' }
  ];

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('visual')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeSubTab === 'visual'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Interactive Controls</span>
          </button>
          <button
            onClick={() => setActiveSubTab('raw')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeSubTab === 'raw'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Raw server.cfg</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {savedSuccess && (
            <span className="text-xs text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
              <Check className="w-3.5 h-3.5" />
              <span>Saved successfully!</span>
            </span>
          )}
          <button
            onClick={activeSubTab === 'visual' ? handleSaveVisual : handleSaveRaw}
            disabled={saving}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
          <button
            onClick={handleOpenCfgFolder}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 flex items-center gap-1.5 transition"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Open cfg Folder</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
        {activeSubTab === 'visual' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Category Navigation Pills */}
            <div className="px-5 py-2.5 bg-slate-950/70 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto shrink-0">
              <button
                onClick={() => setActiveCategory('gamemode')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 transition ${
                  activeCategory === 'gamemode'
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Gamepad2 className="w-3.5 h-3.5" />
                <span>Gamemode Settings</span>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 font-mono px-1.5 py-0.2 rounded capitalize ml-1">
                  {gamemode}
                </span>
              </button>

              <button
                onClick={() => setActiveCategory('general')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 transition ${
                  activeCategory === 'general'
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>General & Discovery</span>
              </button>

              <button
                onClick={() => setActiveCategory('workshop')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 transition ${
                  activeCategory === 'workshop'
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Workshop & Passwords</span>
              </button>

              <button
                onClick={() => setActiveCategory('network')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 transition ${
                  activeCategory === 'network'
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Network & FastDL</span>
              </button>

              <button
                onClick={() => setActiveCategory('physics')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 transition ${
                  activeCategory === 'physics'
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Physics & Voice</span>
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* ======================================================== */}
              {/* CATEGORY: GAMEMODE SETTINGS                              */}
              {/* ======================================================== */}
              {activeCategory === 'gamemode' && (
                <div className="space-y-6">
                  {/* Gamemode Picker Banner */}
                  <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Server Gamemode</span>
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 capitalize">
                          {gamemode}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Select which gamemode rules to edit or switch the active server gamemode.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {gamemodesList.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => {
                            handleGamemodeChange(g.id);
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                            gamemode === g.id
                              ? 'bg-blue-600 text-white font-semibold shadow-sm'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                          }`}
                        >
                          {g.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 1. SANDBOX CONFIGURATION */}
                  {(selectedGamemodeView === 'sandbox' || gamemode === 'sandbox') && (
                    <div className="space-y-5 bg-slate-950/40 p-5 rounded-xl border border-slate-800/80">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                          <Box className="w-4 h-4" />
                          <span>Sandbox Rules & Entity Limits</span>
                        </h4>
                        <span className="text-[11px] text-slate-500">sbox_* convars</span>
                      </div>

                      {/* Permissions Toggles */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                          <input
                            type="checkbox"
                            checked={sboxNoclip}
                            onChange={(e) => setSboxNoclip(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-500 bg-slate-900 border-slate-700"
                          />
                          <div>
                            <span className="text-xs font-semibold text-white block">Allow Noclip</span>
                            <span className="text-[10px] text-slate-500 font-mono">sbox_noclip</span>
                          </div>
                        </label>

                        <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                          <input
                            type="checkbox"
                            checked={sboxAllowNpcs}
                            onChange={(e) => setSboxAllowNpcs(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-500 bg-slate-900 border-slate-700"
                          />
                          <div>
                            <span className="text-xs font-semibold text-white block">Spawn NPCs</span>
                            <span className="text-[10px] text-slate-500 font-mono">sbox_allownpcs</span>
                          </div>
                        </label>

                        <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                          <input
                            type="checkbox"
                            checked={sboxGodmode}
                            onChange={(e) => setSboxGodmode(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-500 bg-slate-900 border-slate-700"
                          />
                          <div>
                            <span className="text-xs font-semibold text-white block">Global Godmode</span>
                            <span className="text-[10px] text-slate-500 font-mono">sbox_godmode</span>
                          </div>
                        </label>

                        <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                          <input
                            type="checkbox"
                            checked={sboxPvpDamage}
                            onChange={(e) => setSboxPvpDamage(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-500 bg-slate-900 border-slate-700"
                          />
                          <div>
                            <span className="text-xs font-semibold text-white block">PvP Damage</span>
                            <span className="text-[10px] text-slate-500 font-mono">sbox_plpldamage</span>
                          </div>
                        </label>

                        <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                          <input
                            type="checkbox"
                            checked={sboxWeapons}
                            onChange={(e) => setSboxWeapons(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-500 bg-slate-900 border-slate-700"
                          />
                          <div>
                            <span className="text-xs font-semibold text-white block">Spawn With Weapons</span>
                            <span className="text-[10px] text-slate-500 font-mono">sbox_weapons</span>
                          </div>
                        </label>

                        <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                          <input
                            type="checkbox"
                            checked={sboxBoneManip}
                            onChange={(e) => setSboxBoneManip(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-500 bg-slate-900 border-slate-700"
                          />
                          <div>
                            <span className="text-xs font-semibold text-white block">NPC Bone Manipulation</span>
                            <span className="text-[10px] text-slate-500 font-mono">sbox_bonemanip_npc</span>
                          </div>
                        </label>
                      </div>

                      {/* Object Limits Grid */}
                      <div>
                        <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                          Per-Player Entity Limits (sbox_max*)
                        </h5>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-[11px] font-medium text-slate-300 mb-1">Max Props</label>
                            <input
                              type="number"
                              value={sboxMaxProps}
                              onChange={(e) => setSboxMaxProps(parseInt(e.target.value, 10) || 0)}
                              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-slate-300 mb-1">Max Ragdolls</label>
                            <input
                              type="number"
                              value={sboxMaxRagdolls}
                              onChange={(e) => setSboxMaxRagdolls(parseInt(e.target.value, 10) || 0)}
                              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-slate-300 mb-1">Max Vehicles</label>
                            <input
                              type="number"
                              value={sboxMaxVehicles}
                              onChange={(e) => setSboxMaxVehicles(parseInt(e.target.value, 10) || 0)}
                              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-slate-300 mb-1">Max Balloons</label>
                            <input
                              type="number"
                              value={sboxMaxBalloons}
                              onChange={(e) => setSboxMaxBalloons(parseInt(e.target.value, 10) || 0)}
                              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-slate-300 mb-1">Max Thrusters</label>
                            <input
                              type="number"
                              value={sboxMaxThrusters}
                              onChange={(e) => setSboxMaxThrusters(parseInt(e.target.value, 10) || 0)}
                              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-slate-300 mb-1">Max Wheels</label>
                            <input
                              type="number"
                              value={sboxMaxWheels}
                              onChange={(e) => setSboxMaxWheels(parseInt(e.target.value, 10) || 0)}
                              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-slate-300 mb-1">Max Sents (Entities)</label>
                            <input
                              type="number"
                              value={sboxMaxSents}
                              onChange={(e) => setSboxMaxSents(parseInt(e.target.value, 10) || 0)}
                              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-slate-300 mb-1">Max Dynamite</label>
                            <input
                              type="number"
                              value={sboxMaxDynamite}
                              onChange={(e) => setSboxMaxDynamite(parseInt(e.target.value, 10) || 0)}
                              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2. DARKRP CONFIGURATION */}
                  {(selectedGamemodeView === 'darkrp' || gamemode === 'darkrp') && (
                    <div className="space-y-5 bg-slate-950/40 p-5 rounded-xl border border-slate-800/80">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          <span>DarkRP Economy, Laws & Enforcement</span>
                        </h4>
                        <span className="text-[11px] text-slate-500">DarkRP convars</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Starting Wallet ($)</label>
                          <input
                            type="number"
                            value={rpStartingMoney}
                            onChange={(e) => setRpStartingMoney(parseInt(e.target.value, 10) || 0)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Cash given to new players.</p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Payday Interval (Seconds)</label>
                          <input
                            type="number"
                            value={rpPaydayTime}
                            onChange={(e) => setRpPaydayTime(parseInt(e.target.value, 10) || 60)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Seconds between salary paydays.</p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Base Salary / Bonus ($)</label>
                          <input
                            type="number"
                            value={rpPaydayAmount}
                            onChange={(e) => setRpPaydayAmount(parseInt(e.target.value, 10) || 0)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Citizen standard paycheck.</p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Jail Sentence (Seconds)</label>
                          <input
                            type="number"
                            value={rpJailTimer}
                            onChange={(e) => setRpJailTimer(parseInt(e.target.value, 10) || 30)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Arrest jail sentence duration.</p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Demote Cooldown (Seconds)</label>
                          <input
                            type="number"
                            value={rpDemoteTime}
                            onChange={(e) => setRpDemoteTime(parseInt(e.target.value, 10) || 60)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Time before player can rejoin demoted job.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                        <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                          <input
                            type="checkbox"
                            checked={rpHungerMod}
                            onChange={(e) => setRpHungerMod(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-500 bg-slate-900 border-slate-700"
                          />
                          <div>
                            <span className="text-xs font-semibold text-white block">Hunger Mode</span>
                            <span className="text-[10px] text-slate-500">Players require food to survive</span>
                          </div>
                        </label>

                        <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                          <input
                            type="checkbox"
                            checked={rpLicenseGuns}
                            onChange={(e) => setRpLicenseGuns(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-500 bg-slate-900 border-slate-700"
                          />
                          <div>
                            <span className="text-xs font-semibold text-white block">Require Gun License</span>
                            <span className="text-[10px] text-slate-500">Mayor must issue weapons license</span>
                          </div>
                        </label>

                        <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                          <input
                            type="checkbox"
                            checked={rpAdvertSystem}
                            onChange={(e) => setRpAdvertSystem(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-500 bg-slate-900 border-slate-700"
                          />
                          <div>
                            <span className="text-xs font-semibold text-white block">Allow /advert Chat</span>
                            <span className="text-[10px] text-slate-500">Permit commercial advertisements</span>
                          </div>
                        </label>

                        <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                          <input
                            type="checkbox"
                            checked={rpCustomJobs}
                            onChange={(e) => setRpCustomJobs(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-500 bg-slate-900 border-slate-700"
                          />
                          <div>
                            <span className="text-xs font-semibold text-white block">F4 Custom Jobs</span>
                            <span className="text-[10px] text-slate-500">Allow job selection in F4 menu</span>
                          </div>
                        </label>

                        <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                          <input
                            type="checkbox"
                            checked={rpPropPushing}
                            onChange={(e) => setRpPropPushing(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-500 bg-slate-900 border-slate-700"
                          />
                          <div>
                            <span className="text-xs font-semibold text-white block">Prevent Prop Push Damage</span>
                            <span className="text-[10px] text-slate-500">Anti-grief prop damage blocker</span>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* 3. TTT CONFIGURATION */}
                  {(selectedGamemodeView === 'terrortown' || gamemode === 'terrortown') && (
                    <div className="space-y-5 bg-slate-950/40 p-5 rounded-xl border border-slate-800/80">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
                          <Crosshair className="w-4 h-4" />
                          <span>Trouble in Terrorist Town (TTT) Rules</span>
                        </h4>
                        <span className="text-[11px] text-slate-500">ttt_* convars</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Preparation Time (Seconds)</label>
                          <input
                            type="number"
                            value={tttPrepTime}
                            onChange={(e) => setTttPrepTime(parseInt(e.target.value, 10) || 10)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Pre-round warm-up duration.</p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Round Limit (Minutes)</label>
                          <input
                            type="number"
                            value={tttRoundTimeMin}
                            onChange={(e) => setTttRoundTimeMin(parseInt(e.target.value, 10) || 5)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Round duration before timer runs out.</p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Post-Round Wait (Seconds)</label>
                          <input
                            type="number"
                            value={tttPostTime}
                            onChange={(e) => setTttPostTime(parseInt(e.target.value, 10) || 10)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Scoreboard display duration.</p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Traitor Ratio (0.25 = 25%)</label>
                          <input
                            type="number"
                            step="0.05"
                            value={tttTraitorPct}
                            onChange={(e) => setTttTraitorPct(parseFloat(e.target.value) || 0.25)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Percentage of players chosen as Traitors.</p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Detective Ratio (0.13 = 13%)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={tttDetectivePct}
                            onChange={(e) => setTttDetectivePct(parseFloat(e.target.value) || 0.13)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Detective spawn ratio.</p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Min Players For Detective</label>
                          <input
                            type="number"
                            value={tttDetectiveMinPlayers}
                            onChange={(e) => setTttDetectiveMinPlayers(parseInt(e.target.value, 10) || 4)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Minimum active players needed.</p>
                        </div>
                      </div>

                      {/* Karma System Sub-Section */}
                      <div className="pt-3 border-t border-slate-800/80">
                        <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                          <span>Karma Anti-RDM System</span>
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Starting Karma</label>
                            <input
                              type="number"
                              value={tttKarmaStarting}
                              onChange={(e) => setTttKarmaStarting(parseInt(e.target.value, 10) || 1000)}
                              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Max Karma</label>
                            <input
                              type="number"
                              value={tttKarmaMax}
                              onChange={(e) => setTttKarmaMax(parseInt(e.target.value, 10) || 1000)}
                              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Autokick Threshold</label>
                            <input
                              type="number"
                              value={tttKarmaLowAmount}
                              onChange={(e) => setTttKarmaLowAmount(parseInt(e.target.value, 10) || 450)}
                              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                            />
                            <p className="text-[10px] text-slate-500 mt-1">Kick player when karma drops below this.</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
                          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                            <input
                              type="checkbox"
                              checked={tttKarma}
                              onChange={(e) => setTttKarma(e.target.checked)}
                              className="w-4 h-4 rounded text-blue-500 bg-slate-900 border-slate-700"
                            />
                            <div>
                              <span className="text-xs font-semibold text-white block">Enable Karma System</span>
                              <span className="text-[10px] text-slate-500">Reduces RDM team killing</span>
                            </div>
                          </label>

                          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                            <input
                              type="checkbox"
                              checked={tttKarmaLowAutokick}
                              onChange={(e) => setTttKarmaLowAutokick(e.target.checked)}
                              className="w-4 h-4 rounded text-blue-500 bg-slate-900 border-slate-700"
                            />
                            <div>
                              <span className="text-xs font-semibold text-white block">Auto Kick Low Karma</span>
                              <span className="text-[10px] text-slate-500">Enforce auto-kick for toxic players</span>
                            </div>
                          </label>

                          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                            <input
                              type="checkbox"
                              checked={tttHaste}
                              onChange={(e) => setTttHaste(e.target.checked)}
                              className="w-4 h-4 rounded text-blue-500 bg-slate-900 border-slate-700"
                            />
                            <div>
                              <span className="text-xs font-semibold text-white block">Haste Mode</span>
                              <span className="text-[10px] text-slate-500">Kills add extra round time</span>
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 4. PROP HUNT CONFIGURATION */}
                  {(selectedGamemodeView === 'prop_hunt' || gamemode === 'prop_hunt') && (
                    <div className="space-y-5 bg-slate-950/40 p-5 rounded-xl border border-slate-800/80">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                          <Radio className="w-4 h-4" />
                          <span>Prop Hunt Gameplay & Taunts</span>
                        </h4>
                        <span className="text-[11px] text-slate-500">ph_* convars</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Hunter Blind Time (Seconds)</label>
                          <input
                            type="number"
                            value={phBlindTime}
                            onChange={(e) => setPhBlindTime(parseInt(e.target.value, 10) || 15)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Time for props to hide at start.</p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Round Duration (Seconds)</label>
                          <input
                            type="number"
                            value={phRoundTime}
                            onChange={(e) => setPhRoundTime(parseInt(e.target.value, 10) || 180)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Maximum hunt time per round.</p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Hunter Miss Penalty (HP)</label>
                          <input
                            type="number"
                            value={phHunterFirePenalty}
                            onChange={(e) => setPhHunterFirePenalty(parseInt(e.target.value, 10) || 0)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">HP lost when shooting wrong prop.</p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Hunter Kill Bonus (HP)</label>
                          <input
                            type="number"
                            value={phHunterKillBonus}
                            onChange={(e) => setPhHunterKillBonus(parseInt(e.target.value, 10) || 0)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">HP restored upon killing a real prop.</p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Auto-Taunt Delay (Seconds)</label>
                          <input
                            type="number"
                            value={phAutoTauntDelay}
                            onChange={(e) => setPhAutoTauntDelay(parseInt(e.target.value, 10) || 30)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Interval props must play a taunt sound.</p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Manual Taunt Cooldown (s)</label>
                          <input
                            type="number"
                            value={phCustomTauntDelay}
                            onChange={(e) => setPhCustomTauntDelay(parseInt(e.target.value, 10) || 5)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Spam prevention for custom taunt wheel.</p>
                        </div>
                      </div>

                      <div className="pt-2">
                        <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                          <input
                            type="checkbox"
                            checked={phAutoTaunt}
                            onChange={(e) => setPhAutoTaunt(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-500 bg-slate-900 border-slate-700"
                          />
                          <div>
                            <span className="text-xs font-semibold text-white block">Enable Automatic Taunts</span>
                            <span className="text-[10px] text-slate-500">Forces props to make noise periodically to prevent stalemates</span>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* 5. MURDER CONFIGURATION */}
                  {(selectedGamemodeView === 'murder' || gamemode === 'murder') && (
                    <div className="space-y-5 bg-slate-950/40 p-5 rounded-xl border border-slate-800/80">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-2">
                          <HelpCircle className="w-4 h-4" />
                          <span>Murder Mystery Configuration</span>
                        </h4>
                        <span className="text-[11px] text-slate-500">mu_* convars</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Round Duration (Seconds)</label>
                          <input
                            type="number"
                            value={muRoundTime}
                            onChange={(e) => setMuRoundTime(parseInt(e.target.value, 10) || 300)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Clues Required For Gun</label>
                          <input
                            type="number"
                            value={muClueLimit}
                            onChange={(e) => setMuClueLimit(parseInt(e.target.value, 10) || 5)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Loot clues innocents need to craft a revolver.</p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Knife Draw Delay (Seconds)</label>
                          <input
                            type="number"
                            value={muKnifeDelay}
                            onChange={(e) => setMuKnifeDelay(parseInt(e.target.value, 10) || 10)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Seconds before murderer can draw weapon.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                          <input
                            type="checkbox"
                            checked={muShowMurdererKnife}
                            onChange={(e) => setMuShowMurdererKnife(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-500 bg-slate-900 border-slate-700"
                          />
                          <div>
                            <span className="text-xs font-semibold text-white block">Show Holstered Knife</span>
                            <span className="text-[10px] text-slate-500">Display knife on murderer model even when not drawn</span>
                          </div>
                        </label>

                        <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                          <input
                            type="checkbox"
                            checked={muDropWeaponOnDeath}
                            onChange={(e) => setMuDropWeaponOnDeath(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-500 bg-slate-900 border-slate-700"
                          />
                          <div>
                            <span className="text-xs font-semibold text-white block">Drop Revolver On Death</span>
                            <span className="text-[10px] text-slate-500">Allow other innocents to pick up the fallen gun</span>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* 6. CINEMA CONFIGURATION */}
                  {(selectedGamemodeView === 'cinema' || gamemode === 'cinema') && (
                    <div className="space-y-5 bg-slate-950/40 p-5 rounded-xl border border-slate-800/80">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                          <Film className="w-4 h-4" />
                          <span>Cinema Theater & Streaming Rules</span>
                        </h4>
                        <span className="text-[11px] text-slate-500">cinema_* convars</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Max Queued Videos</label>
                          <input
                            type="number"
                            value={cinemaMaxRequests}
                            onChange={(e) => setCinemaMaxRequests(parseInt(e.target.value, 10) || 5)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Per-player video request cap.</p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Max Video Duration (Mins)</label>
                          <input
                            type="number"
                            value={cinemaVideoDurationMax}
                            onChange={(e) => setCinemaVideoDurationMax(parseInt(e.target.value, 10) || 60)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Longest single allowed video length.</p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Voteskip Percentage</label>
                          <input
                            type="number"
                            step="0.05"
                            value={cinemaVoteskipPercent}
                            onChange={(e) => setCinemaVoteskipPercent(parseFloat(e.target.value) || 0.6)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Theater audience vote ratio needed to skip (0.6 = 60%).</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                          <input
                            type="checkbox"
                            checked={cinemaAllowTwitch}
                            onChange={(e) => setCinemaAllowTwitch(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-500 bg-slate-900 border-slate-700"
                          />
                          <div>
                            <span className="text-xs font-semibold text-white block">Allow Twitch Streams</span>
                            <span className="text-[10px] text-slate-500">Permit live stream broadcasting</span>
                          </div>
                        </label>

                        <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                          <input
                            type="checkbox"
                            checked={cinemaAllowUrl}
                            onChange={(e) => setCinemaAllowUrl(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-500 bg-slate-900 border-slate-700"
                          />
                          <div>
                            <span className="text-xs font-semibold text-white block">Allow Direct Video URLs</span>
                            <span className="text-[10px] text-slate-500">Permit raw MP4 and WebM video links</span>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ======================================================== */}
              {/* CATEGORY: GENERAL & DISCOVERY                            */}
              {/* ======================================================== */}
              {activeCategory === 'general' && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-blue-400" />
                    <span>General Server Identity & Startup</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Server Hostname</label>
                      <input
                        type="text"
                        value={hostname}
                        onChange={(e) => setHostname(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">Displayed in the Steam and in-game server browser.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Port (UDP/TCP)</label>
                      <input
                        type="number"
                        value={port}
                        onChange={(e) => setPort(parseInt(e.target.value, 10) || 27015)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">Default for Garry&apos;s Mod is 27015.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Startup Map</label>
                      <input
                        type="text"
                        value={defaultMap}
                        onChange={(e) => setDefaultMap(e.target.value)}
                        placeholder="gm_construct, rp_downtown_v4c_v2"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">Map loaded when the server boots up.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Max Players</label>
                      <input
                        type="number"
                        min="1"
                        max="128"
                        value={maxPlayers}
                        onChange={(e) => setMaxPlayers(parseInt(e.target.value, 10) || 16)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">Maximum concurrent player capacity.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Server Tickrate</label>
                      <select
                        value={tickrate}
                        onChange={(e) => setTickrate(parseInt(e.target.value, 10) || 66)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                      >
                        <option value="33">33 Tick (Low CPU / Heavy DarkRP)</option>
                        <option value="66">66 Tick (Standard Valve Default)</option>
                        <option value="100">100 Tick (High Performance / Surfing)</option>
                      </select>
                      <p className="text-[11px] text-slate-500 mt-1">Physics updates per second.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Server Region (sv_region)</label>
                      <select
                        value={region}
                        onChange={(e) => setRegion(parseInt(e.target.value, 10) || 255)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                      >
                        <option value="255">255 - Worldwide</option>
                        <option value="3">3 - Europe</option>
                        <option value="0">0 - US East</option>
                        <option value="1">1 - US West</option>
                        <option value="4">4 - Asia</option>
                        <option value="5">5 - Australia</option>
                      </select>
                      <p className="text-[11px] text-slate-500 mt-1">Geographic filter in the Master Server list.</p>
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                      <input
                        type="checkbox"
                        checked={lanMode}
                        onChange={(e) => setLanMode(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-500 bg-slate-900 border-slate-700"
                      />
                      <div>
                        <span className="text-xs font-semibold text-white block">LAN Mode (sv_lan 1)</span>
                        <span className="text-[10px] text-slate-500">Restricts server to local network only (hides from public master server)</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* CATEGORY: WORKSHOP & PASSWORDS                           */}
              {/* ======================================================== */}
              {activeCategory === 'workshop' && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-blue-400" />
                      <span>Steam Workshop Collection & API</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Workshop Collection ID</label>
                        <input
                          type="text"
                          value={workshopCollectionId}
                          onChange={(e) => setWorkshopCollectionId(e.target.value)}
                          placeholder="e.g. 123456789"
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                        />
                        <p className="text-[11px] text-slate-500 mt-1">
                          Passes <code className="text-blue-400">+host_workshop_collection &lt;ID&gt;</code> at startup.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Steam Web API Key</label>
                        <input
                          type="password"
                          value={steamApiKey}
                          onChange={(e) => setSteamApiKey(e.target.value)}
                          placeholder="Steam Web API Key"
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                        />
                        <p className="text-[11px] text-slate-500 mt-1">
                          Required by Steam to download workshop addons (<code className="text-blue-400">-authkey</code>).
                        </p>
                      </div>
                    </div>
                  </div>

                  <hr className="border-slate-800" />

                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-amber-400" />
                      <span>Passwords & Remote Administration</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Player Join Password (sv_password)</label>
                        <input
                          type="password"
                          value={serverPassword}
                          onChange={(e) => setServerPassword(e.target.value)}
                          placeholder="Leave empty for public server"
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                        />
                        <p className="text-[11px] text-slate-500 mt-1">Password required for players to connect.</p>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">RCON Admin Password (rcon_password)</label>
                        <input
                          type="password"
                          value={rconPassword}
                          onChange={(e) => setRconPassword(e.target.value)}
                          placeholder="Secure password for remote console"
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                        />
                        <p className="text-[11px] text-slate-500 mt-1">Allows executing server console commands remotely.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* CATEGORY: NETWORK & FASTDL                               */}
              {/* ======================================================== */}
              {activeCategory === 'network' && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-cyan-400" />
                    <span>FastDL & Loading Screen URLs</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Loading Screen URL (sv_loadingurl)</label>
                      <input
                        type="text"
                        value={loadingUrl}
                        onChange={(e) => setLoadingUrl(e.target.value)}
                        placeholder="https://example.com/loadingscreen?steamid=%s"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">Custom web page displayed when players join.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">FastDL Mirror URL (sv_downloadurl)</label>
                      <input
                        type="text"
                        value={downloadUrl}
                        onChange={(e) => setDownloadUrl(e.target.value)}
                        placeholder="http://fastdl.myserver.com/garrysmod/"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">High-speed web server for custom map/sound downloads.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Max Downloadable File Size (MB)</label>
                      <input
                        type="number"
                        value={maxFileSize}
                        onChange={(e) => setMaxFileSize(parseInt(e.target.value, 10) || 64)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">net_maxfilesize maximum allowed file size.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                      <input
                        type="checkbox"
                        checked={allowDownload}
                        onChange={(e) => setAllowDownload(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-500 bg-slate-900 border-slate-700"
                      />
                      <div>
                        <span className="text-xs font-semibold text-white block">Allow Client Downloads</span>
                        <span className="text-[10px] text-slate-500">sv_allowdownload (Permit downloading assets from server)</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                      <input
                        type="checkbox"
                        checked={allowUpload}
                        onChange={(e) => setAllowUpload(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-500 bg-slate-900 border-slate-700"
                      />
                      <div>
                        <span className="text-xs font-semibold text-white block">Allow Spray Uploads</span>
                        <span className="text-[10px] text-slate-500">sv_allowupload (Permit client decals/sprays)</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* CATEGORY: PHYSICS & VOICE                                */}
              {/* ======================================================== */}
              {activeCategory === 'physics' && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-purple-400" />
                    <span>Physics Engine & Voice Communication</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Server Gravity (sv_gravity)</label>
                      <input
                        type="number"
                        value={gravity}
                        onChange={(e) => setGravity(parseInt(e.target.value, 10) || 600)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">Default is 600. Lower = moon gravity.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Ground Friction (sv_friction)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={friction}
                        onChange={(e) => setFriction(parseFloat(e.target.value) || 8)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">Default is 8.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Air Acceleration (sv_airaccelerate)</label>
                      <input
                        type="number"
                        value={airAccelerate}
                        onChange={(e) => setAirAccelerate(parseInt(e.target.value, 10) || 10)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">Air strafing control (100 for surf servers).</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                      <input
                        type="checkbox"
                        checked={voiceEnable}
                        onChange={(e) => setVoiceEnable(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-500 bg-slate-900 border-slate-700"
                      />
                      <div>
                        <span className="text-xs font-semibold text-white block">Enable Voice Chat</span>
                        <span className="text-[10px] text-slate-500">sv_voiceenable</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                      <input
                        type="checkbox"
                        checked={allTalk}
                        onChange={(e) => setAllTalk(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-500 bg-slate-900 border-slate-700"
                      />
                      <div>
                        <span className="text-xs font-semibold text-white block">Alltalk Mode</span>
                        <span className="text-[10px] text-slate-500">sv_alltalk (All players hear each other)</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                      <input
                        type="checkbox"
                        checked={fallDamage}
                        onChange={(e) => setFallDamage(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-500 bg-slate-900 border-slate-700"
                      />
                      <div>
                        <span className="text-xs font-semibold text-white block">Realistic Fall Damage</span>
                        <span className="text-[10px] text-slate-500">mp_falldamage</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* RAW server.cfg EDITOR                                   */
          /* ======================================================== */
          <div className="flex-1 flex flex-col p-4 bg-slate-950 overflow-hidden">
            <div className="mb-2 text-xs text-slate-400 flex items-center justify-between">
              <span>
                Direct editing of <code className="text-blue-400">garrysmod/cfg/server.cfg</code>
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                {rawCfg.split('\n').length} lines
              </span>
            </div>
            <textarea
              value={rawCfg}
              onChange={(e) => setRawCfg(e.target.value)}
              className="flex-1 w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs font-mono text-emerald-400 focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
              placeholder="// server.cfg content"
              spellCheck={false}
            />
          </div>
        )}
      </div>
    </div>
  );
};
