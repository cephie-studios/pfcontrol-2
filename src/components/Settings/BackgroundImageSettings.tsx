import { useEffect, useRef, useState } from 'react';
import {
  Upload,
  Trash2,
  Image as ImageIcon,
  X,
  Eye,
  EyeOff,
  Star,
  Shuffle,
  User,
  Loader2,
  Camera,
  ExternalLink,
  Plus,
} from 'lucide-react';
import { fetchBackgrounds } from '../../utils/fetch/data';
import type { Settings } from '../../types/settings';
import Button from '../common/Button';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

interface AvailableImage {
  filename: string;
  path: string;
  extension: string;
}

interface CephieSnapImage {
  id: string;
  url: string;
  time: number;
}

interface BackgroundImageSettingsProps {
  settings: Settings | null;
  onChange: (updatedSettings: Settings) => void;
}

// Sub-component for individual background items
function BackgroundItem({ 
  isSelected, 
  onClick, 
  children, 
  className = "",
  variantColor = "blue" 
}: { 
  isSelected: boolean; 
  onClick: () => void; 
  children: React.ReactNode;
  className?: string;
  variantColor?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={`
        relative aspect-video rounded-xl overflow-hidden cursor-pointer transition-all duration-300 group border
        ${isSelected 
          ? `border-${variantColor}-500/50 ring-2 ring-${variantColor}-500/20` 
          : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50'}
        ${className}
      `}
    >
      {children}
      {isSelected && (
        <div className={`absolute top-2 right-2 p-1 rounded-full bg-${variantColor}-500 shadow-lg`}>
          <Eye className="h-3 w-3 text-white" />
        </div>
      )}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
         {!isSelected && <Plus className="text-white/50 w-6 h-6" />}
      </div>
    </div>
  );
}

export default function BackgroundImageSettings({
  settings,
  onChange,
}: BackgroundImageSettingsProps) {
  const [availableImages, setAvailableImages] = useState<AvailableImage[]>([]);
  const [cephieSnapImages, setCephieSnapImages] = useState<CephieSnapImage[]>([]);
  const [loading, setLoading] = useState({ images: false, snap: false });
  const [status, setStatus] = useState({ uploading: false, deleting: false, error: '' });
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loadData = async () => {
      setLoading({ images: true, snap: true });
      try {
        const [bgData, snapRes] = await Promise.all([
          fetchBackgrounds(),
          fetch(`${API_BASE_URL}/api/uploads/cephie-snap-images`, { credentials: 'include' })
        ]);
        setAvailableImages(bgData);
        if (snapRes.ok) {
          const snapData = await snapRes.json();
          setCephieSnapImages(snapData.images ?? []);
        }
      } catch (e) {
        setStatus(prev => ({ ...prev, error: 'Failed to sync background gallery' }));
      } finally {
        setLoading({ images: false, snap: false });
      }
    };
    loadData();
  }, []);

  const handleSelectImage = (imageUrl: string | null) => {
    if (!settings) return;
    const isUserUploaded = imageUrl?.startsWith('https://api.cephie.app/');
    onChange({
      ...settings,
      backgroundImage: {
        ...settings.backgroundImage,
        selectedImage: imageUrl || null,
        useCustomBackground: !!isUserUploaded,
      },
    });
  };

  const handleToggleFavorite = (filename: string) => {
    if (!settings) return;
    const current = settings.backgroundImage?.favorites || [];
    const updated = current.includes(filename) 
      ? current.filter(f => f !== filename) 
      : [...current, filename];
    
    onChange({
      ...settings,
      backgroundImage: { ...settings.backgroundImage, favorites: updated }
    });
  };

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) return setStatus(p => ({ ...p, error: 'Invalid file type' }));
    
    const formData = new FormData();
    formData.append('image', file);
    setStatus(p => ({ ...p, uploading: true, error: '' }));

    try {
      const res = await fetch(`${API_BASE_URL}/api/uploads/upload-background`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      handleSelectImage(data.url);
      // Refresh snap images
      const snapRes = await fetch(`${API_BASE_URL}/api/uploads/cephie-snap-images`, { credentials: 'include' });
      if (snapRes.ok) {
        const snapData = await snapRes.json();
        setCephieSnapImages(snapData.images ?? []);
      }
    } catch {
      setStatus(p => ({ ...p, error: 'Upload failed' }));
    } finally {
      setStatus(p => ({ ...p, uploading: false }));
    }
  };

  const getPhotoCredit = (filename: string) => {
    if (!filename || filename.match(/^[A-Z]{4}\./i)) return null;
    const match = filename.match(/^(.+?)__\d{3}\./i);
    return match ? match[1] : null;
  };

  const selectedImage = settings?.backgroundImage?.selectedImage;
  const favorites = settings?.backgroundImage?.favorites || [];

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-2.5 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
            <ImageIcon className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Interface Background</h3>
            <p className="text-xs text-zinc-500">Personalize your workspace with custom imagery</p>
          </div>
        </div>

        {status.error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <X size={14} /> {status.error}
            </div>
            <button onClick={() => setStatus(p => ({ ...p, error: '' }))} className="text-zinc-500 hover:text-white">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Action Grid (Presest) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {/* None */}
          <BackgroundItem 
            isSelected={!selectedImage} 
            variantColor="zinc"
            onClick={() => handleSelectImage(null)}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <EyeOff className="text-zinc-600" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Default</span>
            </div>
          </BackgroundItem>

          {/* Random */}
          <BackgroundItem 
            isSelected={selectedImage === 'random'} 
            variantColor="purple"
            onClick={() => handleSelectImage('random')}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-indigo-600/20 flex flex-col items-center justify-center gap-2">
              <Shuffle className="text-purple-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Randomize</span>
            </div>
          </BackgroundItem>

          {/* Favorites */}
          <BackgroundItem 
            isSelected={selectedImage === 'favorites'} 
            variantColor="yellow"
            onClick={() => favorites.length > 0 && handleSelectImage('favorites')}
            className={favorites.length === 0 ? "opacity-40 grayscale pointer-events-none" : ""}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-600/20 to-orange-600/20 flex flex-col items-center justify-center gap-2">
              <Star className="text-yellow-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-400">My Stashed ({favorites.length})</span>
            </div>
          </BackgroundItem>
        </div>

        {/* Upload Zone */}
        <div className="relative group">
          <input 
            type="file" 
            className="absolute inset-0 opacity-0 cursor-pointer z-10" 
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
            disabled={status.uploading}
          />
          <div className={`
            border-2 border-dashed rounded-xl p-8 transition-all duration-300 flex flex-col items-center justify-center gap-3
            ${status.uploading ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-zinc-800 bg-zinc-950/30 group-hover:border-zinc-700 group-hover:bg-zinc-800/20'}
          `}>
            {status.uploading ? (
              <Loader2 className="animate-spin text-cyan-400" />
            ) : (
              <Upload className="text-zinc-600 group-hover:text-zinc-400 transition-colors" />
            )}
            <div className="text-center">
              <p className="text-sm font-semibold text-zinc-300">Upload New Background</p>
              <p className="text-[11px] text-zinc-500 mt-1">Images are stored in your Cephie Snap Cloud</p>
            </div>
          </div>
        </div>
      </div>

      {/* Gallery Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Public Gallery</h4>
          {loading.images && <Loader2 size={12} className="animate-spin text-zinc-600" />}
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {availableImages.map((img) => {
            const isFav = favorites.includes(img.filename);
            const isSel = selectedImage === img.filename;
            const credit = getPhotoCredit(img.filename);

            return (
              <div key={img.filename} className="group relative">
                <BackgroundItem 
                  isSelected={isSel}
                  variantColor="cyan"
                  onClick={() => handleSelectImage(img.filename)}
                >
                  <img 
                    src={`${API_BASE_URL}${img.path}`} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                    loading="lazy"
                    alt=""
                  />
                  {credit && (
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                      <p className="text-[9px] text-zinc-300 flex items-center gap-1">
                        <User size={10} /> {credit}
                      </p>
                    </div>
                  )}
                </BackgroundItem>
                
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleFavorite(img.filename); }}
                  className={`
                    absolute top-2 left-2 p-1.5 rounded-lg border transition-all z-20
                    ${isFav 
                      ? 'bg-yellow-500 border-yellow-400 text-white' 
                      : 'bg-zinc-900/80 border-zinc-700 text-zinc-400 opacity-0 group-hover:opacity-100'}
                  `}
                >
                  <Star size={12} fill={isFav ? "currentColor" : "none"} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cloud Snap Section */}
      {cephieSnapImages.length > 0 && (
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-2 px-1">
            <Camera size={14} className="text-cyan-400" />
            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Cloud Snapshots</h4>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {cephieSnapImages.map((img) => (
              <BackgroundItem
                key={img.id}
                isSelected={selectedImage === img.url}
                variantColor="cyan"
                onClick={() => handleSelectImage(img.url)}
              >
                <img src={img.url} className="w-full h-full object-cover" loading="lazy" />
              </BackgroundItem>
            ))}
          </div>
        </div>
      )}

      {/* Information Footer */}
      <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl flex gap-4">
        <div className="p-2 bg-blue-500/10 rounded-lg h-fit">
          <ExternalLink size={14} className="text-blue-400" />
        </div>
        <p className="text-xs text-zinc-500 leading-relaxed">
          <strong className="text-zinc-300 block mb-1">Background Logic</strong>
          Individual selection overrides presets. Use "Random" to cycle through all public images. 
          Use "Stashed" to cycle through only your starred favorites.
        </p>
      </div>
    </div>
  );
}