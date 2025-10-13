import { useEffect, useState } from 'react';
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
	Camera
} from 'lucide-react';
import { useInView } from 'react-intersection-observer';
import { fetchBackgrounds } from '../../utils/fetch/data';
import type { Settings } from '../../types/settings';
import Button from '../common/Button';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

interface AvailableImage {
	filename: string;
	path: string;
	extension: string;
}

interface BackgroundImageSettingsProps {
	settings: Settings | null;
	onChange: (updatedSettings: Settings) => void;
}

interface BackgroundImageItemProps {
	image: AvailableImage;
	index: number;
	settings: Settings | null;
	selectedImage: string | null;
	loadedImages: Record<string, boolean>;
	onSelectImage: (filename: string) => void;
	onToggleFavorite: (filename: string) => void;
	onImageLoad: (path: string) => void;
	getPhotoCredit: (filename: string) => string | null;
}

function BackgroundImageItem({
	image,
	index,
	settings,
	selectedImage,
	loadedImages,
	onSelectImage,
	onToggleFavorite,
	onImageLoad,
	getPhotoCredit
}: BackgroundImageItemProps) {
	const photoCredit = getPhotoCredit(image.filename);
	const isImageLoaded = loadedImages[image.path];
	const fullImageUrl = `${API_BASE_URL}${image.path}`;
	const isFavorite = (settings?.backgroundImage?.favorites || []).includes(
		image.filename
	);
	const isSelected = selectedImage === image.filename;

	const { ref, inView } = useInView({
		triggerOnce: true,
		rootMargin: '50px'
	});

	return (
		<div
			ref={ref}
			className={`relative rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.02] border-2 group ${
				isSelected
					? 'border-cyan-500 shadow-lg shadow-cyan-500/25'
					: 'border-zinc-700 hover:border-zinc-600'
			}`}
		>
			<div
				className="aspect-video relative"
				onClick={() => onSelectImage(image.filename)}
			>
				{!isImageLoaded && (
					<div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900 animate-pulse"></div>
				)}
				{inView && (
					<img
						src={fullImageUrl}
						alt={`Background option ${index + 1}`}
						className={`w-full h-full object-cover transition-all duration-300 ${
							isImageLoaded ? 'opacity-100' : 'opacity-0'
						} group-hover:brightness-110`}
						onLoad={() => onImageLoad(image.path)}
					/>
				)}
				{isSelected && (
					<div className="absolute top-2 right-2 bg-cyan-500 rounded-full p-1">
						<Eye className="h-3 w-3 text-white" />
					</div>
				)}
				<div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
			</div>
			<button
				onClick={(e) => {
					e.stopPropagation();
					onToggleFavorite(image.filename);
				}}
				className={`absolute top-2 left-2 p-1 rounded-full transition-colors ${
					isFavorite
						? 'bg-yellow-500 text-white'
						: 'bg-black/50 text-gray-300 hover:text-yellow-400'
				}`}
			>
				<Star
					className={`h-3 w-3 ${isFavorite ? 'fill-current' : ''}`}
				/>
			</button>
			{photoCredit && isImageLoaded && (
				<div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
					<div className="flex items-center text-xs text-white">
						<User className="h-3 w-3 mr-1" />
						<span>@{photoCredit}</span>
					</div>
				</div>
			)}
		</div>
	);
}

export default function BackgroundImageSettings({
	settings,
	onChange
}: BackgroundImageSettingsProps) {
	const [availableImages, setAvailableImages] = useState<AvailableImage[]>(
		[]
	);
	const [loadingImages, setLoadingImages] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [error, setError] = useState('');
	const [dragActive, setDragActive] = useState(false);
	const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>(
		{}
	);

	useEffect(() => {
		loadAvailableImages();
	}, []);

	const loadAvailableImages = async () => {
		try {
			setLoadingImages(true);
			const data = await fetchBackgrounds();
			setAvailableImages(data);
		} catch (error) {
			console.error('Error loading available images:', error);
			setError('Failed to load background images');
		} finally {
			setLoadingImages(false);
		}
	};

	const handleSelectImage = (imageUrl: string) => {
		if (!settings) return;

		let selectedValue: string | null = imageUrl;
		if (imageUrl === '') {
			selectedValue = null;
		}

		const isUserUploaded =
			selectedValue &&
			selectedValue.startsWith('https://api.cephie.app/');

		const updatedSettings = {
			...settings,
			backgroundImage: {
				...settings.backgroundImage,
				selectedImage: selectedValue,
				useCustomBackground: !!isUserUploaded
			}
		};
		onChange(updatedSettings);
	};

	const handleToggleFavorite = (filename: string) => {
		if (!settings) return;

		const currentFavorites = settings.backgroundImage?.favorites || [];
		const isFavorite = currentFavorites.includes(filename);

		const newFavorites = isFavorite
			? currentFavorites.filter((f) => f !== filename)
			: [...currentFavorites, filename];

		const updatedSettings = {
			...settings,
			backgroundImage: {
				...settings.backgroundImage,
				favorites: newFavorites
			}
		};
		onChange(updatedSettings);
	};

	const handleFile = async (file: File) => {
		if (!file.type.startsWith('image/')) {
			setError('Please select a valid image file');
			return;
		}

		const formData = new FormData();
		formData.append('image', file);

		setUploading(true);
		setError('');

		try {
			const res = await fetch(
				`${API_BASE_URL}/api/uploads/upload-background`,
				{
					method: 'POST',
					credentials: 'include',
					body: formData
				}
			);
			if (!res.ok) throw new Error('Upload failed');

			const uploadResult = await res.json();
			const newImageUrl = uploadResult.url;

			if (settings && newImageUrl) {
				const updatedSettings = {
					...settings,
					backgroundImage: {
						...settings.backgroundImage,
						selectedImage: newImageUrl,
						useCustomBackground: true
					}
				};
				onChange(updatedSettings);
			}

			await loadAvailableImages();
		} catch {
			setError('Failed to upload image');
		} finally {
			setUploading(false);
		}
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setDragActive(false);
		const files = e.dataTransfer.files;
		if (files.length > 0) {
			handleFile(files[0]);
		}
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		setDragActive(true);
	};

	const handleDragLeave = (e: React.DragEvent) => {
		e.preventDefault();
		setDragActive(false);
	};

	const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			handleFile(file);
		}
	};

	const handleDelete = async () => {
		setDeleting(true);
		setError('');
		try {
			const res = await fetch(
				`${API_BASE_URL}/api/uploads/delete-background`,
				{
					method: 'DELETE',
					credentials: 'include'
				}
			);
			if (!res.ok) throw new Error('Delete failed');

			if (settings) {
				const updatedSettings = {
					...settings,
					backgroundImage: {
						...settings.backgroundImage,
						selectedImage: null,
						useCustomBackground: false
					}
				};
				onChange(updatedSettings);
			}

			await loadAvailableImages();
		} catch {
			setError('Failed to delete image');
		} finally {
			setDeleting(false);
		}
	};

	const handleImageLoad = (imagePath: string) => {
		setLoadedImages((prev) => ({
			...prev,
			[imagePath]: true
		}));
	};

	const getPhotoCredit = (filename: string): string | null => {
		if (!filename) return null;
		if (filename.match(/^[A-Z]{4}\.(png|jpg|jpeg)$/i)) {
			return null;
		}
		const match = filename.match(/^(.+?)__\d{3}\.(png|jpg|jpeg)$/i);
		if (match) {
			return match[1];
		}
		return null;
	};

	const getImageUrl = (filename: string | null): string | null => {
		if (!filename || filename === 'random' || filename === 'favorites') {
			return filename;
		}
		if (filename.startsWith('https://api.cephie.app/')) {
			return filename;
		}
		return `${API_BASE_URL}/assets/app/backgrounds/${filename}`;
	};

	const favoriteCount = (settings?.backgroundImage?.favorites || []).length;
	const selectedImage = settings?.backgroundImage?.selectedImage;

	return (
		<div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl overflow-hidden">
			{/* Header */}
			<div className="p-4 sm:p-6 border-b border-zinc-700/50">
				<div className="flex items-center">
					<div className="p-2 bg-cyan-500/20 rounded-lg mr-3 sm:mr-4 flex-shrink-0">
						<ImageIcon className="h-5 w-5 sm:h-6 sm:w-6 text-cyan-400" />
					</div>
					<div className="min-w-0">
						<h3 className="text-lg sm:text-xl font-semibold text-white">
							Background Images
						</h3>
						<p className="text-zinc-400 text-xs sm:text-sm mt-1">
							Choose from available backgrounds or upload your own
							custom image
						</p>
					</div>
				</div>
			</div>

			{/* Content */}
			<div className="p-4 sm:p-6">
				{error && (
					<div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-center">
						<X className="h-5 w-5 text-red-400 mr-3 flex-shrink-0" />
						<p className="text-red-300 text-sm flex-1">{error}</p>
						<button
							onClick={() => setError('')}
							className="text-red-400 hover:text-red-300 ml-3"
						>
							<X className="h-4 w-4" />
						</button>
					</div>
				)}

				{/* Current Background Display - Only for user-uploaded images */}
				{settings?.backgroundImage?.selectedImage &&
					!['random', 'favorites'].includes(
						settings.backgroundImage.selectedImage
					) &&
					settings.backgroundImage.selectedImage !== null &&
					(getPhotoCredit(settings.backgroundImage.selectedImage) ||
						settings.backgroundImage.useCustomBackground) && (
						<div className="mb-6">
							<h4 className="text-white font-medium text-sm mb-3 flex items-center">
								<Camera className="h-4 w-4 mr-2 text-cyan-400" />
								Current Background
							</h4>
							<div className="relative w-full max-w-2xl h-48 rounded-xl overflow-hidden border border-zinc-700/50 group">
								<img
									src={
										getImageUrl(
											settings.backgroundImage
												.selectedImage
										) ?? undefined
									}
									alt="Current background"
									className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
								/>
								<div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-end p-3">
									<Button
										onClick={handleDelete}
										disabled={deleting}
										variant="danger"
										size="sm"
										className="bg-red-600/90 hover:bg-red-700 backdrop-blur-sm"
									>
										<Trash2 className="h-4 w-4 mr-2" />
										{deleting ? 'Deleting...' : 'Delete'}
									</Button>
								</div>
							</div>
						</div>
					)}

				{/* Upload Section */}
				{!settings?.backgroundImage?.useCustomBackground && (
					<div className="mb-6">
						<h4 className="text-white font-medium text-sm mb-3 flex items-center">
							<Upload className="h-4 w-4 mr-2 text-blue-400" />
							Upload Custom Background
						</h4>
						<div
							onDrop={handleDrop}
							onDragOver={handleDragOver}
							onDragLeave={handleDragLeave}
							className={`
                                relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer
                                ${
									dragActive
										? 'border-blue-400 bg-blue-500/10 scale-[1.02]'
										: 'border-zinc-600 bg-zinc-800/30 hover:border-zinc-500 hover:bg-zinc-800/50'
								}
                            `}
						>
							<input
								type="file"
								accept="image/*"
								onChange={handleFileInput}
								className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
								disabled={uploading}
							/>
							<div className="flex flex-col items-center space-y-4">
								<div
									className={`p-4 rounded-xl transition-colors duration-300 ${
										dragActive
											? 'bg-blue-500/20'
											: uploading
											? 'bg-blue-500/20'
											: 'bg-zinc-700/50'
									}`}
								>
									{uploading ? (
										<Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
									) : (
										<Upload className="h-8 w-8 text-zinc-400" />
									)}
								</div>
								<div>
									<p className="text-lg font-medium text-white mb-2">
										{dragActive
											? 'Drop your image here'
											: uploading
											? 'Uploading...'
											: 'Upload Background Image'}
									</p>
									<p className="text-zinc-400 text-sm">
										Drag and drop an image here, or click to
										browse
									</p>
									<p className="text-sm text-red-400 mt-2">
										Pictures you upload are public
									</p>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Available Backgrounds */}
				<div>
					<h4 className="text-white font-medium text-sm mb-4 flex items-center">
						<ImageIcon className="h-4 w-4 mr-2 text-emerald-400" />
						Available Backgrounds
					</h4>

					{loadingImages ? (
						<div className="flex items-center justify-center p-12 bg-zinc-800/30 rounded-xl border border-zinc-700/50">
							<Loader2 className="h-6 w-6 animate-spin text-cyan-400 mr-3" />
							<span className="text-zinc-400">
								Loading backgrounds...
							</span>
						</div>
					) : (
						<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 gap-4">
							{/* No Background */}
							<div
								className={`relative rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.02] border-2 group ${
									selectedImage === null ||
									selectedImage === ''
										? 'border-emerald-500 shadow-lg shadow-emerald-500/25'
										: 'border-zinc-700 hover:border-zinc-600'
								}`}
								onClick={() => handleSelectImage('')}
							>
								<div className="aspect-video bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
									<div className="text-center">
										<EyeOff className="h-8 w-8 text-zinc-400 mx-auto mb-2 group-hover:text-zinc-300 transition-colors" />
										<span className="text-zinc-400 text-xs group-hover:text-zinc-300 transition-colors">
											No Background
										</span>
									</div>
								</div>
								{(selectedImage === null ||
									selectedImage === '') && (
									<div className="absolute top-2 right-2 bg-emerald-500 rounded-full p-1">
										<Eye className="h-3 w-3 text-white" />
									</div>
								)}
							</div>

							{/* Random */}
							<div
								className={`relative rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.02] border-2 group ${
									selectedImage === 'random'
										? 'border-purple-500 shadow-lg shadow-purple-500/25'
										: 'border-zinc-700 hover:border-zinc-600'
								}`}
								onClick={() => handleSelectImage('random')}
							>
								<div className="aspect-video bg-gradient-to-br from-purple-800 to-purple-900 flex items-center justify-center">
									<div className="text-center">
										<Shuffle className="h-8 w-8 text-purple-400 mx-auto mb-2 group-hover:text-purple-300 transition-colors" />
										<span className="text-purple-400 text-xs group-hover:text-purple-300 transition-colors">
											Random
										</span>
									</div>
								</div>
								{selectedImage === 'random' && (
									<div className="absolute top-2 right-2 bg-purple-500 rounded-full p-1">
										<Eye className="h-3 w-3 text-white" />
									</div>
								)}
							</div>

							{/* Favorites */}
							<div
								className={`relative rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.02] border-2 group ${
									selectedImage === 'favorites'
										? 'border-yellow-500 shadow-lg shadow-yellow-500/25'
										: favoriteCount === 0
										? 'border-zinc-600 opacity-50 cursor-not-allowed'
										: 'border-zinc-700 hover:border-zinc-600'
								}`}
								onClick={() =>
									favoriteCount > 0 &&
									handleSelectImage('favorites')
								}
							>
								<div className="aspect-video bg-gradient-to-br from-yellow-800 to-yellow-900 flex items-center justify-center">
									<div className="text-center">
										<Star className="h-8 w-8 text-yellow-400 mx-auto mb-2 group-hover:text-yellow-300 transition-colors" />
										<span className="text-yellow-400 text-xs group-hover:text-yellow-300 transition-colors">
											Favorites ({favoriteCount})
										</span>
									</div>
								</div>
								{selectedImage === 'favorites' && (
									<div className="absolute top-2 right-2 bg-yellow-500 rounded-full p-1">
										<Eye className="h-3 w-3 text-white" />
									</div>
								)}
							</div>

							{/* Available Images */}
							{availableImages.map((image, index) => (
								<BackgroundImageItem
									key={index}
									image={image}
									index={index}
									settings={settings}
									selectedImage={selectedImage ?? null}
									loadedImages={loadedImages}
									onSelectImage={handleSelectImage}
									onToggleFavorite={handleToggleFavorite}
									onImageLoad={handleImageLoad}
									getPhotoCredit={getPhotoCredit}
								/>
							))}
						</div>
					)}
					{availableImages.length === 0 && !loadingImages && (
						<div className="text-center p-8 text-gray-400">
							<ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
							<p>No background images available yet.</p>
							<p className="text-xs mt-2">
								Upload your own image or wait for images to be
								added.
							</p>
						</div>
					)}
				</div>

				<div className="mt-6 p-4 bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border border-blue-500/20 rounded-lg">
					<div className="flex items-start">
						<div className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0"></div>
						<div>
							<h4 className="text-blue-300 font-medium text-sm mb-1">
								How it works
							</h4>
							<p className="text-blue-200/80 text-xs sm:text-sm leading-relaxed">
								Select "No Background" for the default
								transparent background, "Random" for any
								available image each session, "Favorites" for
								random selection from your starred images only,
								or choose a specific image. Click the star to
								add/remove favorites. Remember to save your
								changes!
							</p>
						</div>
					</div>
				</div>
			</div>

			<style>{`
                @keyframes skeletonPulse {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                .skeleton-loading {
                    background: linear-gradient(110deg, rgba(55, 65, 81, 0.5) 8%, rgba(75, 85, 99, 0.8) 18%, rgba(55, 65, 81, 0.5) 33%);
                    background-size: 200% 100%;
                    animation: skeletonPulse 1.5s ease-in-out infinite;
                }
            `}</style>
		</div>
	);
}
