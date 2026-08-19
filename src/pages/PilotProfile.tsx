import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import {
  User,
  Plane,
  Clock,
  Award,
  Calendar,
  TrendingUp,
  Shield,
  Star,
  Wrench,
  FlaskConical,
  Crown,
  Zap,
  Target,
  Heart,
  Sparkles,
  Flame,
  Trophy,
  Braces,
  Share2,
  TowerControl,
  MessageCircle,
  Edit,
  Users,
  Pencil,
  Palette,
  GripVertical,
  Eye,
  EyeOff,
} from 'lucide-react';
import { SiRoblox } from 'react-icons/si';
import { fetchPilotProfile } from '../utils/fetch/pilot';
import { parseCallsign } from '../utils/callsignParser';
import { getCurrentUser } from '../utils/fetch/auth';
import { useAuth } from '../hooks/auth/useAuth';
import { useToast } from '../hooks/useToast';
import { fetchBackgrounds, fetchUserRanks } from '../utils/fetch/data';
import { updateUserSettings } from '../utils/fetch/settings';
import { useData } from '../hooks/data/useData';
import {
  hexToRgba,
  getComplementaryAccessibleColor,
  blendHexOverBackground,
  PROFILE_THEME_PRESETS,
} from '../utils/color';
import type { PilotProfile, Role, FeaturedFlight } from '../types/pilot';
import type {
  ProfileCustomization,
  ProfileSectionConfig,
} from '../types/settings';
import Button from '../components/common/Button';
import ColorPicker from '../components/common/ColorPicker';
import Loader from '../components/common/Loader';
import Navbar from '../components/Navbar';
import AccessDenied from '../components/AccessDenied';

type Ranks = Record<string, number | string | null>;

const DEFAULT_SECTION_ORDER: ProfileSectionConfig[] = [
  { key: 'stats', visible: true },
  { key: 'featuredFlights', visible: true },
];

const DEFAULT_ACCENT_COLOR = '#2563EB';
const DEFAULT_BACKGROUND_COLOR = '#09090B';
const DEFAULT_CARD_COLOR = '#27272A';
const DEFAULT_BANNER_TINT_COLOR = '#000000';

const DEFAULT_STAT_CARD_GRADIENT =
  'linear-gradient(135deg, rgba(161, 161, 170, 0.14), rgba(113, 113, 122, 0.10))';

const DEFAULT_CUSTOMIZATION: ProfileCustomization = {
  accentColor: null,
  backgroundColor: null,
  cardColor: null,
  bannerTintColor: null,
  bannerTintOpacity: 0,
  hiddenRoleIds: [],
  hiddenStatIds: [],
  sectionOrder: DEFAULT_SECTION_ORDER,
};

interface ProfileEditDraft {
  bio: string;
  displayBioOnProfile: boolean;
  customization: ProfileCustomization;
  displayControllerRatingOnProfile: boolean;
  displayLinkedAccountsOnProfile: boolean;
  displayBackgroundOnProfile: boolean;
}

const EMPTY_DRAFT: ProfileEditDraft = {
  bio: '',
  displayBioOnProfile: true,
  customization: DEFAULT_CUSTOMIZATION,
  displayControllerRatingOnProfile: true,
  displayLinkedAccountsOnProfile: true,
  displayBackgroundOnProfile: true,
};

type ColorEditorTarget = {
  kind: 'accent' | 'background' | 'banner' | 'card';
  anchorId?: string;
};

interface CardColorEditor {
  isEditing: boolean;
  cardColor: string | null;
  openCardId: string | null;
  onOpen: (cardId: string) => void;
  onClose: () => void;
  onChange: (hex: string) => void;
  onClear: () => void;
}

function accentOutlineButtonStyle(
  accentColor: string | null | undefined
): React.CSSProperties | undefined {
  if (!accentColor) return undefined;
  return {
    color: accentColor,
    backgroundImage: 'none',
    ['--tw-ring-color' as string]: accentColor,
  } as React.CSSProperties;
}

function accentButtonStyle(
  accentColor: string | null | undefined
): React.CSSProperties | undefined {
  if (!accentColor) return undefined;
  return { background: accentColor, borderColor: accentColor };
}

function EditPencil({
  onClick,
  title,
  icon: Icon = Pencil,
  className = '',
}: {
  onClick: () => void;
  title?: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-full bg-zinc-900/90 border border-zinc-600 text-zinc-300 hover:text-white hover:border-zinc-400 transition-colors shadow-lg ${className}`}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

function ColorPopover({
  label,
  value,
  onChange,
  onClear,
  defaultValue,
  presets = PROFILE_THEME_PRESETS,
  opacity,
  onOpacityChange,
  onClose,
  align = 'right',
}: {
  label: string;
  value: string | null;
  onChange: (hex: string) => void;
  onClear: () => void;
  defaultValue?: string;
  presets?: string[];
  opacity?: number;
  onOpacityChange?: (value: number) => void;
  onClose: () => void;
  align?: 'left' | 'right';
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className={`absolute z-50 top-full mt-2 ${align === 'right' ? 'right-0' : 'left-0'} w-60 p-3 rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <ColorPicker
          label={label}
          value={value}
          onChange={onChange}
          onClear={onClear}
          defaultValue={defaultValue}
          presets={presets}
        />
        {opacity !== undefined && onOpacityChange && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-500">Tint Opacity</span>
              <span className="text-xs text-zinc-400">{opacity}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={opacity}
              onChange={(e) => onOpacityChange(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer pf-tint-opacity-slider"
            />
          </div>
        )}
      </div>
    </>
  );
}

function CardColorPencil({ cardId, editor }: { cardId: string; editor: CardColorEditor }) {
  if (!editor.isEditing) return null;
  return (
    <div className="absolute top-2 right-2 z-10">
      <EditPencil onClick={() => editor.onOpen(cardId)} title="Card color" icon={Palette} />
      {editor.openCardId === cardId && (
        <ColorPopover
          label="Card Color"
          value={editor.cardColor}
          onChange={editor.onChange}
          onClear={editor.onClear}
          onClose={editor.onClose}
          defaultValue={DEFAULT_CARD_COLOR}
        />
      )}
    </div>
  );
}

function DraggableSection({
  sectionKey,
  visible,
  isDragging,
  accentColor,
  onDragStart,
  onDragOver,
  onDrop,
  onToggleVisible,
  children,
}: {
  sectionKey: string;
  visible: boolean;
  isDragging: boolean;
  accentColor: string | null;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onToggleVisible: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`relative rounded-3xl border-2 border-dashed p-3 transition-opacity ${isDragging ? 'opacity-50' : ''}`}
      style={{
        borderColor: accentColor
          ? hexToRgba(accentColor, 0.5)
          : 'rgba(113, 113, 122, 0.5)',
      }}
      data-section-key={sectionKey}
    >
      <div className="flex items-center gap-2 mb-2 px-1">
        <GripVertical className="w-4 h-4 text-zinc-500 cursor-grab active:cursor-grabbing" />
        <span className="text-xs text-zinc-500 uppercase tracking-wide">
          Drag to reorder
        </span>
        <button
          type="button"
          onClick={onToggleVisible}
          className={`ml-auto p-1 rounded-md transition-colors ${
            visible
              ? 'text-emerald-400 hover:bg-emerald-500/10'
              : 'text-zinc-600 hover:bg-zinc-800'
          }`}
          title={visible ? 'Visible to others' : 'Hidden from others'}
        >
          {visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
      </div>
      <div className={visible ? '' : 'opacity-40'}>{children}</div>
    </div>
  );
}

const isRankOne = (ranks: Ranks): boolean => {
  const statKeys = [
    'total_sessions_created',
    'total_flights_submitted.total',
    'total_time_controlling_minutes',
    'total_chat_messages_sent',
    'total_flight_edits.total_edit_actions',
  ];
  return statKeys.some((key) => {
    const rank = ranks[key];
    return typeof rank === 'number' && rank === 1;
  });
};

interface UserStatistics {
  total_sessions_created?: number;
  total_flights_submitted?: {
    total?: number;
    logged_with_logbook?: number;
  };
  total_chat_messages_sent?: number;
  total_time_controlling_minutes?: number;
  total_flight_edits?: {
    total_edit_actions?: number;
  };
  last_updated?: string;
}

interface AvailableImage {
  filename: string;
  path: string;
  extension: string;
}

interface PilotProfileProps {
  standalone?: boolean;
  usernameOverride?: string;
}

export default function PilotProfile({
  standalone = true,
  usernameOverride,
}: PilotProfileProps) {
  const params = useParams<{ username: string }>();
  const username = usernameOverride ?? params.username;
  const { user, refreshUser } = useAuth();
  const { showError } = useToast();
  const [profile, setProfile] = useState<PilotProfile | null>(null);
  const [userStats, setUserStats] = useState<UserStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shareClicked, setShareClicked] = useState(false);
  const [ranks, setRanks] = useState<Ranks>({});
  const [availableImages, setAvailableImages] = useState<AvailableImage[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<ProfileEditDraft>(EMPTY_DRAFT);
  const [colorEditor, setColorEditor] = useState<ColorEditorTarget | null>(null);
  const [draggedSectionKey, setDraggedSectionKey] = useState<string | null>(null);
  const bioTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isCurrentUser = !!(user && profile && profile.user.id === user.userId);
  const isOwnerEditing = isCurrentUser && isEditing;
  const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

  const resizeBioTextarea = useCallback(() => {
    const el = bioTextareaRef.current;
    if (!el) return;
    const style = window.getComputedStyle(el);
    const lineHeight = parseFloat(style.lineHeight) || 20;
    const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const maxHeight = lineHeight * 2 + paddingY;
    el.style.height = 'auto';
    const nextHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    if (isOwnerEditing) resizeBioTextarea();
  }, [isOwnerEditing, draft.bio, resizeBioTextarea]);

  const handleLinkRoblox = () => {
    window.location.href = `${import.meta.env.VITE_SERVER_URL}/api/auth/roblox`;
  };

  const handleLinkVatsim = () => {
    window.location.href = `${import.meta.env.VITE_SERVER_URL}/api/auth/vatsim?force=1`;
  };

  const fetchUserStats = useCallback(async () => {
    try {
      const userData = await getCurrentUser();
      setUserStats(userData.statistics || {});
    } catch {
      // ignore
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      const data = await fetchPilotProfile(username!);
      if (data) {
        setProfile(data);
        setUserStats(data.user.statistics || {});

        try {
          const profileRanks = await fetchUserRanks(data.user.id);
          setRanks(profileRanks || {});
        } catch {
          // ignore
        }
      } else {
        setError('Pilot not found');
      }
    } catch {
      setError('Failed to load pilot profile');
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (isCurrentUser) {
      fetchUserStats();
    }
  }, [isCurrentUser, fetchUserStats]);

  useEffect(() => {
    const loadImages = async () => {
      try {
        const data = await fetchBackgrounds();
        setAvailableImages(data);
      } catch (error) {
        console.error('Error loading available images:', error);
      }
    };
    loadImages();
  }, []);

  const handleShareProfile = () => {
    const profileUrl = `${window.location.origin}/user/${username}`;
    navigator.clipboard.writeText(profileUrl);
    setShareClicked(true);
    setTimeout(() => setShareClicked(false), 2000);
  };

  const handleStartEditing = () => {
    if (!user) return;
    const settings = user.settings;
    const rawSectionOrder = settings.profileCustomization?.sectionOrder;
    const resolvedSectionOrder =
      rawSectionOrder && rawSectionOrder.length > 0
        ? rawSectionOrder
        : profile?.profileCustomization?.sectionOrder &&
            profile.profileCustomization.sectionOrder.length > 0
          ? profile.profileCustomization.sectionOrder
          : DEFAULT_SECTION_ORDER;

    setDraft({
      bio: settings.bio ?? '',
      displayBioOnProfile: settings.displayBioOnProfile ?? true,
      customization: {
        ...DEFAULT_CUSTOMIZATION,
        ...settings.profileCustomization,
        sectionOrder: resolvedSectionOrder,
        hiddenRoleIds: settings.profileCustomization?.hiddenRoleIds ?? [],
        hiddenStatIds: settings.profileCustomization?.hiddenStatIds ?? [],
      },
      displayControllerRatingOnProfile:
        settings.displayControllerRatingOnProfile ?? true,
      displayLinkedAccountsOnProfile:
        settings.displayLinkedAccountsOnProfile ?? true,
      displayBackgroundOnProfile: settings.displayBackgroundOnProfile ?? true,
    });
    setColorEditor(null);
    setDraggedSectionKey(null);
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setColorEditor(null);
    setIsEditing(false);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await updateUserSettings({
        bio: draft.bio,
        displayBioOnProfile: draft.displayBioOnProfile,
        profileCustomization: draft.customization,
        displayControllerRatingOnProfile: draft.displayControllerRatingOnProfile,
        displayLinkedAccountsOnProfile: draft.displayLinkedAccountsOnProfile,
        displayBackgroundOnProfile: draft.displayBackgroundOnProfile,
      });
      await refreshUser();
      await fetchProfile();
      setColorEditor(null);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save profile:', error);
      showError('Failed to save profile changes');
    } finally {
      setSaving(false);
    }
  };

  const updateCustomization = (patch: Partial<ProfileCustomization>) => {
    setDraft((d) => ({ ...d, customization: { ...d.customization, ...patch } }));
  };

  const toggleColorEditor = (target: ColorEditorTarget) => {
    setColorEditor((prev) =>
      prev && prev.kind === target.kind && prev.anchorId === target.anchorId
        ? null
        : target
    );
  };
  const closeColorEditor = () => setColorEditor(null);

  const toggleRoleHidden = (roleId: number) => {
    setDraft((d) => ({
      ...d,
      customization: {
        ...d.customization,
        hiddenRoleIds: d.customization.hiddenRoleIds.includes(roleId)
          ? d.customization.hiddenRoleIds.filter((id) => id !== roleId)
          : [...d.customization.hiddenRoleIds, roleId],
      },
    }));
  };

  const toggleStatHidden = (statId: string) => {
    setDraft((d) => ({
      ...d,
      customization: {
        ...d.customization,
        hiddenStatIds: d.customization.hiddenStatIds.includes(statId)
          ? d.customization.hiddenStatIds.filter((id) => id !== statId)
          : [...d.customization.hiddenStatIds, statId],
      },
    }));
  };

  const handleSectionDragStart = (key: string) => setDraggedSectionKey(key);
  const handleSectionDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    if (!draggedSectionKey || draggedSectionKey === key) return;
    const order = draft.customization.sectionOrder;
    const draggedIndex = order.findIndex((s) => s.key === draggedSectionKey);
    const targetIndex = order.findIndex((s) => s.key === key);
    if (draggedIndex === -1 || targetIndex === -1) return;
    const newOrder = [...order];
    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, removed);
    updateCustomization({ sectionOrder: newOrder });
  };
  const handleSectionDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggedSectionKey(null);
  };
  const handleToggleSectionVisible = (key: string) => {
    updateCustomization({
      sectionOrder: draft.customization.sectionOrder.map((s) =>
        s.key === key ? { ...s, visible: !s.visible } : s
      ),
    });
  };

  const getBackgroundImage = () => {
    const displayBackground = isOwnerEditing
      ? draft.displayBackgroundOnProfile
      : isCurrentUser || (profile?.privacySettings.displayBackgroundOnProfile ?? true);

    if (!profile?.user.background_image || !displayBackground) {
      return null;
    }

    const selectedImage = profile.user.background_image.selectedImage;

    const getImageUrl = (filename: string | null): string | null => {
      if (!filename || filename === 'random' || filename === 'favorites') {
        return filename;
      }
      if (filename.startsWith('https://api.cephie.app/')) {
        return filename;
      }
      return `${API_BASE_URL}/assets/app/backgrounds/${filename}`;
    };

    if (selectedImage === 'random' && availableImages.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableImages.length);
      return `${API_BASE_URL}${availableImages[randomIndex].path}`;
    } else if (selectedImage === 'favorites') {
      const favorites = profile.user.background_image.favorites || [];
      if (favorites.length > 0) {
        const randomFav =
          favorites[Math.floor(Math.random() * favorites.length)];
        const favImageUrl = getImageUrl(randomFav);
        if (
          favImageUrl &&
          favImageUrl !== 'random' &&
          favImageUrl !== 'favorites'
        ) {
          return favImageUrl;
        }
      }
    } else if (selectedImage) {
      const imageUrl = getImageUrl(selectedImage);
      if (imageUrl && imageUrl !== 'random' && imageUrl !== 'favorites') {
        return imageUrl;
      }
    }

    return null;
  };

  const backgroundImage = getBackgroundImage();

  const getDiscordAvatar = (userId: string, avatarHash: string | null) => {
    if (!avatarHash) {
      return `https://cdn.discordapp.com/embed/avatars/${
        parseInt(userId) % 5
      }.png`;
    }
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=256`;
  };

  const getIconComponent = (iconName: string) => {
    const icons: Record<
      string,
      React.ComponentType<{
        className?: string;
        style?: React.CSSProperties;
      }>
    > = {
      Shield,
      Star,
      Wrench,
      Award,
      User,
      TrendingUp,
      FlaskConical,
      Crown,
      Zap,
      Target,
      TowerControl,
      Heart,
      Sparkles,
      Flame,
      Trophy,
    };
    return icons[iconName] || Star;
  };

  const getRoleBadge = (role: Role) => {
    const IconComponent = getIconComponent(role.icon);

    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
          }
        : { r: 99, g: 102, b: 241 };
    };

    const rgb = hexToRgb(role.color);

    return {
      icon: IconComponent,
      text: role.name,
      color: role.color,
      rgb: `${rgb.r}, ${rgb.g}, ${rgb.b}`,
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        {standalone && <Navbar />}
        <Loader />
      </div>
    );
  }

  if (error || !profile) {
    return <AccessDenied errorType="pilot-not-found" />;
  }

  const mapLongToShort = (longName: string | null): string | null => {
    if (!longName) return null;
    const key = longName.toLowerCase();
    if (key.includes('observer')) return 'OBS';
    if (key.includes('student') && key.includes('1')) return 'S1';
    if (key.includes('student') && key.includes('2')) return 'S2';
    if (key.includes('student') && key.includes('3')) return 'S3';
    if (
      key.startsWith('c1') ||
      key.includes('controller 1') ||
      key.includes('controller i')
    )
      return 'C1';
    if (key.startsWith('c2') || key.includes('controller 2')) return 'C2';
    if (key.startsWith('c3') || key.includes('controller 3')) return 'C3';
    if (key.includes('instructor') && key.includes('1')) return 'I1';
    if (key.includes('instructor') && key.includes('2')) return 'I2';
    if (key.includes('instructor') && key.includes('3')) return 'I3';
    if (key.includes('supervisor')) return 'SUP';
    if (key.includes('administrator')) return 'ADM';
    return null;
  };

  const displayVatsimRating =
    profile.user.vatsim_rating_short ||
    mapLongToShort(profile.user.vatsim_rating_long);

  const isVatsimLinked = !!(
    profile.user.vatsim_cid ||
    profile.user.vatsim_rating_short ||
    profile.user.vatsim_rating_long
  );

  const hasCrown = isRankOne(ranks);

  const baseCustomization = profile.profileCustomization ?? DEFAULT_CUSTOMIZATION;
  const effectiveCustomization = isOwnerEditing ? draft.customization : baseCustomization;
  const effectiveSectionOrder =
    effectiveCustomization.sectionOrder && effectiveCustomization.sectionOrder.length > 0
      ? effectiveCustomization.sectionOrder
      : DEFAULT_SECTION_ORDER;
  const accentColor = effectiveCustomization.accentColor;
  const cardBorderStyle = accentColor ? { borderColor: accentColor } : undefined;

  const effectiveBio = isOwnerEditing ? draft.bio : profile.user.bio;
  const bioVisible = isCurrentUser || profile.privacySettings.displayBioOnProfile;

  const ratingVisible =
    isCurrentUser || profile.privacySettings.displayControllerRatingOnProfile;
  const ratingHiddenWhileEditing = isOwnerEditing && !draft.displayControllerRatingOnProfile;

  const linkedAccountsVisible =
    isCurrentUser || profile.privacySettings.displayLinkedAccountsOnProfile;
  const linkedAccountsHiddenWhileEditing =
    isOwnerEditing && !draft.displayLinkedAccountsOnProfile;

  const effectiveHiddenRoleIds = effectiveCustomization.hiddenRoleIds ?? [];
  const displayedRoles = isOwnerEditing
    ? profile.user.roles
    : profile.user.roles.filter((r) => !effectiveHiddenRoleIds.includes(r.id));

  const effectiveHiddenStatIds = effectiveCustomization.hiddenStatIds ?? [];

  const cardColorEditor: CardColorEditor = {
    isEditing: isOwnerEditing,
    cardColor: draft.customization.cardColor,
    openCardId: colorEditor?.kind === 'card' ? (colorEditor.anchorId ?? null) : null,
    onOpen: (cardId) => toggleColorEditor({ kind: 'card', anchorId: cardId }),
    onClose: closeColorEditor,
    onChange: (hex) => updateCustomization({ cardColor: hex }),
    onClear: () => updateCustomization({ cardColor: null }),
  };

  const headerBaseStyle: React.CSSProperties = backgroundImage
    ? {
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }
    : {
        background: effectiveCustomization.backgroundColor
          ? `linear-gradient(to top, ${hexToRgba(effectiveCustomization.backgroundColor, 0.45)}, ${hexToRgba(effectiveCustomization.backgroundColor, 0)})`
          : 'linear-gradient(to top, #27272a, #18181b)',
        backgroundColor: '#18181b',
      };

  return (
    <div className="min-h-screen bg-zinc-950 text-white relative">
      {effectiveCustomization.backgroundColor && (
        <div
          className="fixed inset-0 pointer-events-none z-0"
          style={{
            backgroundColor: hexToRgba(effectiveCustomization.backgroundColor, 0.12),
          }}
        />
      )}
      <div className="relative z-10">
        {standalone && <Navbar />}

        <div
          className={`relative ${!backgroundImage ? 'border-b border-zinc-700/50' : ''}`}
          style={headerBaseStyle}
        >
          {backgroundImage && (
            <>
              {effectiveCustomization.backgroundColor && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundColor: hexToRgba(effectiveCustomization.backgroundColor, 0.45),
                  }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-tr from-black via-black/70 to-transparent"></div>
              <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>
            </>
          )}
          {effectiveCustomization.bannerTintColor &&
            effectiveCustomization.bannerTintOpacity > 0 && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundColor: hexToRgba(
                    effectiveCustomization.bannerTintColor,
                    effectiveCustomization.bannerTintOpacity / 100
                  ),
                }}
              />
            )}

          {isOwnerEditing && (
            <div className="absolute top-20 right-3 z-20 flex items-center gap-2">
              <div className="relative">
                <EditPencil
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      displayBackgroundOnProfile: !d.displayBackgroundOnProfile,
                    }))
                  }
                  title={
                    draft.displayBackgroundOnProfile
                      ? 'Background visible — click to hide'
                      : 'Background hidden — click to show'
                  }
                  icon={draft.displayBackgroundOnProfile ? Eye : EyeOff}
                />
              </div>
              <div className="relative">
                <EditPencil
                  onClick={() => toggleColorEditor({ kind: 'banner' })}
                  title="Banner tint"
                  icon={Palette}
                />
                {colorEditor?.kind === 'banner' && (
                  <ColorPopover
                    label="Banner Tint"
                    value={draft.customization.bannerTintColor}
                    onChange={(hex) => updateCustomization({ bannerTintColor: hex })}
                    onClear={() => updateCustomization({ bannerTintColor: null })}
                    opacity={draft.customization.bannerTintOpacity}
                    onOpacityChange={(v) =>
                      updateCustomization({ bannerTintOpacity: v })
                    }
                    onClose={closeColorEditor}
                    defaultValue={DEFAULT_BANNER_TINT_COLOR}
                  />
                )}
              </div>
            </div>
          )}

          <div className="py-8 md:py-12 relative z-10">
            <div className="pt-24 pb-4">
              <div className="max-w-7xl mx-auto px-4">
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                  {/* Avatar */}
                  <div className="relative self-center md:self-auto">
                    <div
                      className="w-24 h-24 md:w-32 md:h-32 rounded-full border-2 border-blue-600 overflow-hidden bg-gray-800 shadow-xl"
                      style={accentColor ? { borderColor: accentColor } : undefined}
                    >
                      <img
                        src={getDiscordAvatar(profile.user.id, profile.user.avatar)}
                        alt={profile.user.username}
                        className="w-full h-full object-cover"
                      />
                      {hasCrown && (
                        <Crown
                          className="absolute -top-2 right-0 w-10 h-10 transform rotate-12 shadow-2xl"
                          style={{
                            color: '#fbbf24',
                            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                          }}
                        />
                      )}
                    </div>
                    {isOwnerEditing && (
                      <div className="absolute -bottom-1 -right-1">
                        <EditPencil
                          onClick={() => toggleColorEditor({ kind: 'accent' })}
                          title="Accent color"
                          icon={Palette}
                        />
                        {colorEditor?.kind === 'accent' && (
                          <ColorPopover
                            label="Accent Color"
                            value={draft.customization.accentColor}
                            onChange={(hex) => updateCustomization({ accentColor: hex })}
                            onClear={() => updateCustomization({ accentColor: null })}
                            onClose={closeColorEditor}
                            defaultValue={DEFAULT_ACCENT_COLOR}
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {/* User Info */}
                  <div className="flex-1 text-center md:text-left">
                    <div className="flex flex-col md:flex-row md:items-baseline gap-2 md:gap-4 justify-center md:justify-start">
                      <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-2 md:mb-4">
                        {profile.user.username}
                      </h1>
                    </div>
                    {(profile.user.is_admin ||
                      displayedRoles.length > 0 ||
                      isVatsimLinked) && (
                      <div
                        className={`flex flex-wrap items-center gap-2 mb-3 justify-center md:justify-start ${
                          isOwnerEditing && profile.user.roles.length > 0
                            ? 'p-2 -m-2 rounded-2xl border-2 border-dashed border-zinc-700'
                            : ''
                        }`}
                      >
                        {profile.user.is_admin && (
                          <div
                            className="inline-flex items-center gap-2 px-4 py-1 rounded-full border-2 cursor-default"
                            style={{
                              backgroundColor: 'rgba(59, 130, 246, 0.2)',
                              borderColor: 'rgba(59, 130, 246, 0.5)',
                              boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)',
                            }}
                          >
                            <Braces className="h-4 w-4" style={{ color: '#3B82F6' }} />
                            <span
                              className="text-sm font-semibold"
                              style={{ color: '#3B82F6' }}
                            >
                              Developer
                            </span>
                          </div>
                        )}
                        {displayedRoles.map((role) => {
                          const badge = getRoleBadge(role);
                          const BadgeIcon = badge.icon;
                          const hidden = effectiveHiddenRoleIds.includes(role.id);
                          const content = (
                            <div
                              className="inline-flex items-center gap-2 px-4 py-1 rounded-full border-2 cursor-default"
                              style={{
                                backgroundColor: `rgba(${badge.rgb}, 0.2)`,
                                borderColor: `rgba(${badge.rgb}, 0.5)`,
                                boxShadow: `0 4px 6px -1px rgba(${badge.rgb}, 0.2)`,
                              }}
                            >
                              <BadgeIcon className="h-4 w-4" style={{ color: badge.color }} />
                              <span
                                className="text-sm font-semibold"
                                style={{ color: badge.color }}
                              >
                                {badge.text}
                              </span>
                            </div>
                          );
                          return isOwnerEditing ? (
                            <button
                              key={role.id}
                              type="button"
                              onClick={() => toggleRoleHidden(role.id)}
                              className={`transition-opacity ${hidden ? 'opacity-40' : ''}`}
                              title={
                                hidden
                                  ? 'Hidden from others — click to show'
                                  : 'Visible to others — click to hide'
                              }
                            >
                              {content}
                            </button>
                          ) : (
                            <div key={role.id}>{content}</div>
                          );
                        })}
                      </div>
                    )}
                    <div className="flex flex-col md:flex-row flex-wrap items-center md:items-start gap-2 md:gap-4 justify-center md:justify-start mt-2">
                      <div className="flex items-center gap-2 text-gray-400 justify-center md:justify-start">
                        <Calendar className="h-5 w-5" />
                        <span className="text-base md:text-lg">
                          Member since{' '}
                          {new Date(profile.user.member_since).toLocaleDateString(
                            'en-US',
                            {
                              month: 'long',
                              year: 'numeric',
                            }
                          )}
                        </span>
                      </div>

                      {ratingVisible &&
                        profile.user.rating &&
                        profile.user.rating.ratingCount > 0 && (
                          <>
                            <div className="hidden md:block w-1.5 h-1.5 rounded-full bg-zinc-700 self-center" />
                            <div
                              className={`flex items-center gap-2 text-gray-400 justify-center md:justify-start ${
                                ratingHiddenWhileEditing ? 'opacity-40' : ''
                              }`}
                            >
                              <div className="flex items-center">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`w-4 h-4 md:w-5 md:h-5 ${
                                      star <=
                                      Math.round(profile.user.rating!.averageRating)
                                        ? 'fill-yellow-500 text-yellow-500'
                                        : 'text-zinc-700'
                                    }`}
                                  />
                                ))}
                              </div>
                              <span className="text-base md:text-lg font-medium text-zinc-300">
                                {profile.user.rating.averageRating.toFixed(1)}{' '}
                                <span className="text-zinc-500 font-normal">
                                  ({profile.user.rating.ratingCount})
                                </span>
                              </span>
                              {isOwnerEditing && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDraft((d) => ({
                                      ...d,
                                      displayControllerRatingOnProfile:
                                        !d.displayControllerRatingOnProfile,
                                    }))
                                  }
                                  className="flex items-center gap-1 text-xs text-zinc-500 hover:text-white"
                                  title={
                                    draft.displayControllerRatingOnProfile
                                      ? 'Controller rating visible — click to hide'
                                      : 'Controller rating hidden — click to show'
                                  }
                                >
                                  {draft.displayControllerRatingOnProfile ? (
                                    <Eye className="w-3.5 h-3.5" />
                                  ) : (
                                    <EyeOff className="w-3.5 h-3.5" />
                                  )}
                                  Rating
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      {/* Roblox + VATSIM */}
                      {linkedAccountsVisible && (
                        <div
                          className={`flex flex-wrap items-center gap-3 justify-center md:justify-start ${
                            linkedAccountsHiddenWhileEditing ? 'opacity-40' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2 justify-center md:justify-start">
                            {profile.user.roblox_username && (
                              <SiRoblox className="h-5 w-5 text-blue-300" />
                            )}
                            {profile.user.roblox_username ? (
                              profile.user.roblox_user_id ? (
                                <a
                                  href={`https://www.roblox.com/users/${profile.user.roblox_user_id}/profile`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-base md:text-lg text-blue-300 hover:underline hover:text-blue-200"
                                >
                                  {profile.user.roblox_username}
                                </a>
                              ) : (
                                <span className="text-base md:text-lg text-blue-300">
                                  {profile.user.roblox_username}
                                </span>
                              )
                            ) : (
                              isCurrentUser &&
                              !isEditing && (
                                <button
                                  onClick={handleLinkRoblox}
                                  className="text-base md:text-lg text-blue-300 hover:underline hover:text-blue-200"
                                >
                                  Connect Roblox
                                </button>
                              )
                            )}
                          </div>
                          <div className="flex items-center gap-2 justify-center md:justify-start">
                            {isVatsimLinked && (
                              <img
                                src="/assets/images/vatsim.webp"
                                alt="VATSIM"
                                className="h-6 w-6 p-1 bg-white rounded-full"
                              />
                            )}
                            {isVatsimLinked ? (
                              <a
                                href={`https://stats.vatsim.net/stats/${profile.user.vatsim_cid}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-base md:text-lg text-blue-300 hover:underline hover:text-blue-300"
                              >
                                {displayVatsimRating}
                              </a>
                            ) : (
                              isCurrentUser &&
                              !isEditing && (
                                <button
                                  onClick={handleLinkVatsim}
                                  className="text-base md:text-lg text-blue-400 hover:underline hover:text-blue-300"
                                >
                                  Connect VATSIM
                                </button>
                              )
                            )}
                          </div>
                          {isOwnerEditing && (
                            <button
                              type="button"
                              onClick={() =>
                                setDraft((d) => ({
                                  ...d,
                                  displayLinkedAccountsOnProfile:
                                    !d.displayLinkedAccountsOnProfile,
                                }))
                              }
                              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-white"
                              title={
                                draft.displayLinkedAccountsOnProfile
                                  ? 'Linked accounts visible — click to hide'
                                  : 'Linked accounts hidden — click to show'
                              }
                            >
                              {draft.displayLinkedAccountsOnProfile ? (
                                <Eye className="w-3.5 h-3.5" />
                              ) : (
                                <EyeOff className="w-3.5 h-3.5" />
                              )}
                              Linked Accounts
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {(isOwnerEditing ||
                      (bioVisible && effectiveBio && effectiveBio.trim() !== '')) && (
                      <div className="mt-4 flex justify-center md:justify-start">
                        {isOwnerEditing ? (
                          <div className="flex-1 max-w-xl">
                            <textarea
                              ref={bioTextareaRef}
                              value={draft.bio}
                              onChange={(e) =>
                                setDraft((d) => ({ ...d, bio: e.target.value }))
                              }
                              maxLength={500}
                              rows={1}
                              placeholder="Add a bio..."
                              className="w-full bg-transparent text-zinc-300 text-sm leading-relaxed resize-none focus:outline-none placeholder-zinc-500 rounded-xl border-2 border-dashed border-zinc-700 focus:border-zinc-400 p-3 transition-colors"
                            />
                            <div className="flex items-center gap-3 mt-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setDraft((d) => ({
                                    ...d,
                                    displayBioOnProfile: !d.displayBioOnProfile,
                                  }))
                                }
                                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white"
                              >
                                {draft.displayBioOnProfile ? (
                                  <Eye className="w-3.5 h-3.5" />
                                ) : (
                                  <EyeOff className="w-3.5 h-3.5" />
                                )}
                                Bio {draft.displayBioOnProfile ? 'visible' : 'hidden'}
                              </button>
                              <span className="text-xs text-zinc-600">
                                {draft.bio.length}/500
                              </span>
                            </div>
                          </div>
                        ) : (
                          <p className="flex-1 max-w-xl text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
                            {effectiveBio}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 self-center md:self-auto flex-wrap justify-center">
                    <Button
                      onClick={handleShareProfile}
                      className={`flex items-center gap-2 ${accentColor && !shareClicked ? 'accent-hover-brighten' : ''}`}
                      variant={shareClicked ? 'success' : 'primary'}
                      style={shareClicked ? undefined : accentButtonStyle(accentColor)}
                    >
                      <Share2 className="w-4 h-4" />
                      <span>{shareClicked ? 'Copied!' : 'Share'}</span>
                    </Button>
                    {isCurrentUser && !isEditing && (
                      <Button
                        onClick={() => (window.location.href = '/my-flights')}
                        className={`flex items-center gap-2 ${accentColor ? 'accent-hover-brighten' : ''}`}
                        variant="primary"
                        style={accentButtonStyle(accentColor)}
                      >
                        <Plane className="w-4 h-4" />
                        <span>My Flights</span>
                      </Button>
                    )}
                    {isCurrentUser && !isEditing && (
                      <Button
                        onClick={handleStartEditing}
                        className={`flex items-center gap-2 ${accentColor ? 'accent-hover-brighten' : ''}`}
                        variant="primary"
                        style={accentButtonStyle(accentColor)}
                      >
                        <Edit className="w-4 h-4" />
                        <span>Edit Profile</span>
                      </Button>
                    )}
                    {isCurrentUser && isEditing && (
                      <>
                        <Button
                          onClick={handleCancelEditing}
                          variant="outline"
                          disabled={saving}
                          className={accentColor ? 'accent-hover-brighten' : ''}
                          style={accentOutlineButtonStyle(accentColor)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => void handleSaveProfile()}
                          variant="primary"
                          disabled={saving}
                          className={accentColor ? 'accent-hover-brighten' : ''}
                          style={accentButtonStyle(accentColor)}
                        >
                          {saving ? 'Saving…' : 'Save'}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 mt-8">
          {isOwnerEditing && (
            <div className="flex items-center gap-2 mb-4">
              <div className="relative">
                <EditPencil
                  onClick={() => toggleColorEditor({ kind: 'background' })}
                  title="Page background color"
                  icon={Palette}
                />
                {colorEditor?.kind === 'background' && (
                  <ColorPopover
                    label="Page Background"
                    value={draft.customization.backgroundColor}
                    onChange={(hex) => updateCustomization({ backgroundColor: hex })}
                    onClear={() => updateCustomization({ backgroundColor: null })}
                    onClose={closeColorEditor}
                    defaultValue={DEFAULT_BACKGROUND_COLOR}
                    align="left"
                  />
                )}
              </div>
              <span className="text-xs text-zinc-500">Page background color</span>
            </div>
          )}
          <div className="space-y-8">
          {effectiveSectionOrder.map((section) => {
            if (!isCurrentUser && !section.visible) return null;

            let sectionNode: React.ReactNode = null;
            if (section.key === 'stats') {
              sectionNode = (
                <StatsSection
                  userStats={userStats}
                  ranks={ranks}
                  isCurrentUser={isCurrentUser}
                  cardColor={effectiveCustomization.cardColor}
                  borderStyle={cardBorderStyle}
                  cardColorEditor={cardColorEditor}
                  hiddenStatIds={effectiveHiddenStatIds}
                  isOwnerEditing={isOwnerEditing}
                  onToggleStatHidden={toggleStatHidden}
                />
              );
            } else if (section.key === 'featuredFlights') {
              sectionNode = (
                <FeaturedFlightsSection
                  flights={profile.featuredFlights}
                  cardColor={effectiveCustomization.cardColor}
                  borderStyle={cardBorderStyle}
                  cardColorEditor={cardColorEditor}
                  isEditing={isOwnerEditing}
                />
              );
            }
            if (!sectionNode) return null;

            if (isOwnerEditing) {
              return (
                <DraggableSection
                  key={section.key}
                  sectionKey={section.key}
                  visible={section.visible}
                  isDragging={draggedSectionKey === section.key}
                  accentColor={accentColor}
                  onDragStart={() => handleSectionDragStart(section.key)}
                  onDragOver={(e) => handleSectionDragOver(e, section.key)}
                  onDrop={handleSectionDrop}
                  onToggleVisible={() => handleToggleSectionVisible(section.key)}
                >
                  {sectionNode}
                </DraggableSection>
              );
            }
            return <div key={section.key}>{sectionNode}</div>;
          })}
          </div>
        </div>
      </div>

      <style>{`
        .pf-tint-opacity-slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          border: 2px solid #6366f1;
        }
        .pf-tint-opacity-slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          border: 2px solid #6366f1;
        }
        .accent-hover-brighten:hover {
          filter: brightness(1.15);
        }
      `}</style>
    </div>
  );
}

function StatCard({
  id,
  icon: Icon,
  defaultIconBgClass,
  defaultIconColorClass,
  gradient,
  animationDelay,
  cardColor,
  borderStyle,
  cardColorEditor,
  isOwnerEditing,
  hidden,
  onToggleHidden,
  right,
  children,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  defaultIconBgClass: string;
  defaultIconColorClass: string;
  gradient: string;
  animationDelay: string;
  cardColor: string | null;
  borderStyle?: React.CSSProperties;
  cardColorEditor: CardColorEditor;
  isOwnerEditing: boolean;
  hidden: boolean;
  onToggleHidden: () => void;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (!isOwnerEditing && hidden) return null;

  const background = cardColor ? hexToRgba(cardColor, 0.3) : gradient;
  const iconColor = cardColor
    ? getComplementaryAccessibleColor(
        cardColor,
        blendHexOverBackground(cardColor, 0.3, '#18181b')
      )
    : null;

  return (
    <div className="relative">
      <div
        className={`group relative overflow-hidden rounded-3xl p-8 backdrop-blur-xl border-2 border-white/10 transition-all duration-500 animate-fade-in-up flex items-center justify-between ${
          isOwnerEditing && hidden ? 'opacity-40' : ''
        }`}
        style={{ background, animationDelay, ...borderStyle }}
      >
        <div className="flex items-center gap-4">
          <div
            className={`p-2 rounded-lg ${iconColor ? '' : defaultIconBgClass}`}
            style={iconColor ? { backgroundColor: hexToRgba(iconColor, 0.2) } : undefined}
          >
            <Icon
              className={`h-6 w-6 ${iconColor ? '' : defaultIconColorClass}`}
              style={iconColor ? { color: iconColor } : undefined}
            />
          </div>
          {children}
        </div>
        {right}
      </div>
      <CardColorPencil cardId={id} editor={cardColorEditor} />
      {isOwnerEditing && (
        <button
          type="button"
          onClick={onToggleHidden}
          className={`absolute top-2 left-2 z-10 p-1.5 rounded-full bg-zinc-900/90 border transition-colors ${
            hidden
              ? 'border-zinc-600 text-zinc-500 hover:text-white'
              : 'border-emerald-600/60 text-emerald-400 hover:bg-emerald-500/10'
          }`}
          title={hidden ? 'Hidden from others — click to show' : 'Visible — click to hide'}
        >
          {hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}

function StatsSection({
  userStats,
  ranks,
  isCurrentUser,
  cardColor,
  borderStyle,
  cardColorEditor,
  hiddenStatIds,
  isOwnerEditing,
  onToggleStatHidden,
}: {
  userStats: UserStatistics | null;
  ranks: Ranks;
  isCurrentUser: boolean;
  cardColor: string | null;
  borderStyle?: React.CSSProperties;
  cardColorEditor: CardColorEditor;
  hiddenStatIds: string[];
  isOwnerEditing: boolean;
  onToggleStatHidden: (id: string) => void;
}) {
  if (!userStats || Object.keys(userStats).length === 0) {
    return (
      <p className="text-zinc-400 text-center">No statistics available yet.</p>
    );
  }

  const cardProps = (id: string) => ({
    id,
    cardColor,
    borderStyle,
    cardColorEditor,
    isOwnerEditing,
    hidden: hiddenStatIds.includes(id),
    onToggleHidden: () => onToggleStatHidden(id),
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <StatCard
        {...cardProps('sessions')}
        icon={Users}
        defaultIconBgClass="bg-emerald-400/20"
        defaultIconColorClass="text-emerald-300"
        gradient={DEFAULT_STAT_CARD_GRADIENT}
        animationDelay="800ms"
        right={
          isCurrentUser && (
            <div className="text-right">
              <p className="text-sm text-gray-300 font-semibold">Rank</p>
              <p className="text-lg font-bold text-emerald-300">
                #{ranks.total_sessions_created || 'N/A'}
              </p>
            </div>
          )
        }
      >
        <div>
          <h3 className="text-2xl font-bold text-white">
            {userStats.total_sessions_created || 0}
          </h3>
          <p className="text-zinc-400 text-sm">Total Sessions Created</p>
        </div>
      </StatCard>

      <StatCard
        {...cardProps('flights')}
        icon={Plane}
        defaultIconBgClass="bg-amber-500/20"
        defaultIconColorClass="text-amber-300"
        gradient={DEFAULT_STAT_CARD_GRADIENT}
        animationDelay="1300ms"
        right={
          isCurrentUser && (
            <div className="text-right">
              <p className="text-sm text-gray-300 font-semibold">Rank</p>
              <p className="text-lg font-bold text-amber-300">
                #{ranks['total_flights_submitted.total'] || 'N/A'}
              </p>
            </div>
          )
        }
      >
        <div>
          <h3 className="text-2xl font-bold text-white">
            {userStats?.total_flights_submitted?.total || 0}
          </h3>
          <p className="text-zinc-400 text-sm">Flights Submitted</p>
        </div>
      </StatCard>

      <StatCard
        {...cardProps('time')}
        icon={Clock}
        defaultIconBgClass="bg-indigo-500/20"
        defaultIconColorClass="text-indigo-300"
        gradient={DEFAULT_STAT_CARD_GRADIENT}
        animationDelay="1100ms"
        right={
          <div className="text-right">
            <p className="text-sm text-gray-300 font-semibold">Rank</p>
            <p className="text-lg font-bold text-indigo-300">
              #{ranks.total_time_controlling_minutes || 'N/A'}
            </p>
          </div>
        }
      >
        <div>
          <h3 className="text-2xl font-bold text-white">
            {(userStats.total_time_controlling_minutes || 0).toFixed(2)} min
          </h3>
          <p className="text-zinc-400 text-sm">Time Controlling</p>
        </div>
      </StatCard>

      <StatCard
        {...cardProps('edits')}
        icon={Edit}
        defaultIconBgClass="bg-sky-500/20"
        defaultIconColorClass="text-sky-300"
        gradient={DEFAULT_STAT_CARD_GRADIENT}
        animationDelay="1200ms"
        right={
          <div className="text-right">
            <p className="text-sm text-gray-300 font-semibold">Rank</p>
            <p className="text-lg font-bold text-sky-300">
              #{ranks['total_flight_edits.total_edit_actions'] || 'N/A'}
            </p>
          </div>
        }
      >
        <div>
          <h3 className="text-2xl font-bold text-white">
            {userStats.total_flight_edits?.total_edit_actions || 0}
          </h3>
          <p className="text-zinc-400 text-sm">Flight Edit Actions</p>
        </div>
      </StatCard>

      <StatCard
        {...cardProps('chat')}
        icon={MessageCircle}
        defaultIconBgClass="bg-pink-500/20"
        defaultIconColorClass="text-pink-300"
        gradient={DEFAULT_STAT_CARD_GRADIENT}
        animationDelay="1000ms"
      >
        <div>
          <h3 className="text-2xl font-bold text-white">
            {userStats.total_chat_messages_sent || 0}
          </h3>
          <p className="text-zinc-400 text-sm">Chat Messages Sent</p>
        </div>
      </StatCard>

      <StatCard
        {...cardProps('updated')}
        icon={Clock}
        defaultIconBgClass="bg-violet-500/20"
        defaultIconColorClass="text-violet-300"
        gradient={DEFAULT_STAT_CARD_GRADIENT}
        animationDelay="1400ms"
      >
        <div>
          <h3 className="text-lg font-bold text-white">
            {userStats.last_updated
              ? new Date(userStats.last_updated).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Never'}
          </h3>
          <p className="text-zinc-400 text-sm">Last Updated</p>
        </div>
      </StatCard>
    </div>
  );
}

function FeaturedFlightsSection({
  flights,
  cardColor,
  borderStyle,
  cardColorEditor,
  isEditing,
}: {
  flights?: FeaturedFlight[];
  cardColor: string | null;
  borderStyle?: React.CSSProperties;
  cardColorEditor: CardColorEditor;
  isEditing: boolean;
}) {
  if (!flights || flights.length === 0) {
    if (!isEditing) return null;
    return <p className="text-zinc-400 text-center">No featured flights yet.</p>;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
        <h2 className="text-xl font-bold text-white tracking-tight">
          Featured Flights
        </h2>
        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-400/20 font-mono">
          {flights.length}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {flights.map((featured: FeaturedFlight) => (
          <FeaturedFlightCard
            key={featured.id}
            flight={featured}
            cardColor={cardColor}
            borderStyle={borderStyle}
            cardColorEditor={cardColorEditor}
          />
        ))}
      </div>
    </div>
  );
}

function FeaturedFlightCard({
  flight,
  cardColor,
  borderStyle,
  cardColorEditor,
}: {
  flight: FeaturedFlight;
  cardColor?: string | null;
  borderStyle?: React.CSSProperties;
  cardColorEditor: CardColorEditor;
}) {
  const { airlines } = useData();
  const coverSnap = flight.snap_images?.[0];
  const spoken = parseCallsign(flight.callsign || '', airlines);

  const formattedDate = flight.created_at
    ? new Date(flight.created_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div className="relative">
      <a
        href={`/flight/${flight.id}`}
        className="block rounded-2xl overflow-hidden border border-zinc-700/60 hover:border-zinc-500/60 transition-colors group"
        style={borderStyle}
      >
        {coverSnap ? (
          <div className="aspect-video relative">
            <img
              src={coverSnap.url}
              alt={flight.callsign}
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-linear-to-t from-zinc-950/90 via-zinc-950/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p className="font-black text-white font-mono text-base leading-tight truncate">
                {spoken}
              </p>
              {flight.departure && flight.arrival && (
                <p className="text-zinc-400 font-mono text-sm mt-0.5">
                  {flight.departure} → {flight.arrival}
                </p>
              )}
              {formattedDate && (
                <p className="text-zinc-500 text-xs mt-1">{formattedDate}</p>
              )}
            </div>
          </div>
        ) : (
          <div
            className="p-4 bg-zinc-900/80 flex items-center justify-between gap-3"
            style={cardColor ? { backgroundColor: hexToRgba(cardColor, 0.3) } : undefined}
          >
            <div>
              <p className="font-bold text-white font-mono truncate">{spoken}</p>
              {flight.departure && flight.arrival && (
                <p className="text-zinc-500 font-mono text-sm mt-0.5">
                  {flight.departure} → {flight.arrival}
                </p>
              )}
              {formattedDate && (
                <p className="text-zinc-500 text-xs mt-1">{formattedDate}</p>
              )}
            </div>
          </div>
        )}
      </a>
      <CardColorPencil cardId={flight.id} editor={cardColorEditor} />
    </div>
  );
}
