const APRIL_COW_COOKIE = 'april_cow_seen';
const APRIL_COW_MAX_DURATION_MS = 120_000;
const APRIL_COW_COOKIE_MAX_AGE_SECONDS = 60 * 60;
type ThreeAnimationMixer = import('three').AnimationMixer;

function ensureDiscoStyles() {
  const styleId = 'april-cow-disco-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @keyframes aprilCowDiscoPulse {
      0% { transform: scale(0.9); opacity: 0.35; filter: hue-rotate(0deg); }
      50% { transform: scale(1.15); opacity: 0.75; filter: hue-rotate(160deg); }
      100% { transform: scale(0.95); opacity: 0.4; filter: hue-rotate(320deg); }
    }
  `;
  document.head.appendChild(style);
}

function hasRecentAprilCowPlayback() {
  return document.cookie
    .split(';')
    .some((cookie) => cookie.trim().startsWith(`${APRIL_COW_COOKIE}=true`));
}

function markAprilCowPlayback() {
  document.cookie = `${APRIL_COW_COOKIE}=true; Max-Age=${APRIL_COW_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
}

export async function tryPlayAprilCowEasterEgg() {
  if (hasRecentAprilCowPlayback()) {
    return;
  }
  try {
    const [
      {
        Scene,
        PerspectiveCamera,
        WebGLRenderer,
        Clock,
        Color,
        LoadingManager,
        TextureLoader,
        SRGBColorSpace,
        HemisphereLight,
        DirectionalLight,
        PointLight,
        AnimationMixer,
      },
      { GLTFLoader },
      { clone: cloneSkinnedModel },
    ] = await Promise.all([
      import('three'),
      import('three/examples/jsm/loaders/GLTFLoader.js'),
      import('three/examples/jsm/utils/SkeletonUtils.js'),
    ]);

    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '99999';
    overlay.style.background =
      'radial-gradient(circle at center, #111827 0%, #000000 70%)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.cursor = 'wait';
    overlay.style.overflow = 'hidden';

    const title = document.createElement('div');
    title.textContent = 'HAPPY APRIL';
    title.style.position = 'absolute';
    title.style.top = '50px';
    title.style.left = '50%';
    title.style.transform = 'translateX(-50%)';
    title.style.zIndex = '2';
    title.style.fontFamily =
      '"Brush Script MT", "Segoe Script", "Lucida Handwriting", "Apple Chancery", cursive';
    title.style.fontStyle = 'italic';
    title.style.fontWeight = '700';
    title.style.fontSize = 'clamp(2.5rem, 7.8vw, 6.1rem)';
    title.style.letterSpacing = '0.09em';
    title.style.textTransform = 'uppercase';
    title.style.whiteSpace = 'nowrap';
    title.style.color = '#ffffff';
    title.style.pointerEvents = 'none';

    const audioHint = document.createElement('div');
    audioHint.textContent = 'Tap to enable sound';
    audioHint.style.position = 'absolute';
    audioHint.style.bottom = '24px';
    audioHint.style.left = '50%';
    audioHint.style.transform = 'translateX(-50%)';
    audioHint.style.padding = '8px 14px';
    audioHint.style.borderRadius = '9999px';
    audioHint.style.background = 'rgba(0, 0, 0, 0.5)';
    audioHint.style.border = '1px solid rgba(255, 255, 255, 0.25)';
    audioHint.style.color = '#fff';
    audioHint.style.fontSize = '13px';
    audioHint.style.fontWeight = '600';
    audioHint.style.letterSpacing = '0.01em';
    audioHint.style.pointerEvents = 'none';
    audioHint.style.opacity = '0';
    audioHint.style.transition = 'opacity 180ms ease';

    ensureDiscoStyles();

    const discoGlowLayer = document.createElement('div');
    discoGlowLayer.style.position = 'absolute';
    discoGlowLayer.style.inset = '0';
    discoGlowLayer.style.pointerEvents = 'none';
    discoGlowLayer.style.mixBlendMode = 'screen';
    discoGlowLayer.style.background =
      'radial-gradient(circle at 25% 25%, rgba(255, 0, 128, 0.16) 0%, rgba(255, 0, 128, 0) 38%), radial-gradient(circle at 75% 30%, rgba(0, 229, 255, 0.14) 0%, rgba(0, 229, 255, 0) 36%), radial-gradient(circle at 50% 80%, rgba(255, 235, 59, 0.12) 0%, rgba(255, 235, 59, 0) 34%)';
    discoGlowLayer.style.filter = 'blur(12px)';
    overlay.appendChild(discoGlowLayer);

    const canvasContainer = document.createElement('div');
    canvasContainer.style.width = '100%';
    canvasContainer.style.height = '100%';
    overlay.appendChild(title);
    overlay.appendChild(canvasContainer);
    overlay.appendChild(audioHint);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    markAprilCowPlayback();

    const scene = new Scene();
    scene.background = new Color(0x000000);

    const camera = new PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 1.1, 6.8);

    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    canvasContainer.appendChild(renderer.domElement);

    const clock = new Clock();
    const mixers: ThreeAnimationMixer[] = [];
    let rafId = 0;
    const loadingManager = new LoadingManager();
    loadingManager.setURLModifier((url) => {
      if (
        url.startsWith('data:') ||
        url.startsWith('blob:') ||
        url.startsWith('/assets/april/')
      ) {
        return url;
      }

      const sanitized = url.split('?')[0].split('#')[0];
      const parts = sanitized.split(/[\\/]/);
      const fileName = parts[parts.length - 1];
      const isTextureFile = /\.(png|jpe?g|webp|ktx2|basis)$/i.test(fileName);

      if (isTextureFile) {
        return `/assets/april/textures/${fileName}`;
      }

      return url;
    });

    const loader = new GLTFLoader(loadingManager);
    loader.setResourcePath('/assets/april/textures/');
    const textureLoader = new TextureLoader(loadingManager);

    const hemiLight = new HemisphereLight(0xffffff, 0x444444, 2.1);
    scene.add(hemiLight);

    const keyLight = new DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(3, 5, 4);
    scene.add(keyLight);

    const fillLight = new DirectionalLight(0x8ec5ff, 1.3);
    fillLight.position.set(-4, 3, 3);
    scene.add(fillLight);

    const rimLight = new DirectionalLight(0xff7ad9, 1.1);
    rimLight.position.set(0, 2, -5);
    scene.add(rimLight);

    const discoLightA = new PointLight(0xff0080, 14, 16, 2);
    const discoLightB = new PointLight(0x00e5ff, 13, 16, 2);
    const discoLightC = new PointLight(0xffeb3b, 11, 14, 2);
    scene.add(discoLightA, discoLightB, discoLightC);

    const loadCowModel = (modelPath: string, isFallback = false) => {
      loader.load(
        encodeURI(modelPath),
        (gltf) => {
          // Safety fallback: if the GLB references textures incorrectly,
          // assign a known albedo texture to untextured mesh materials.
          const fallbackTexture = textureLoader.load(
            '/assets/april/textures/gltf_embedded_0.png'
          );
          fallbackTexture.colorSpace = SRGBColorSpace;

          const desktopModelLayouts = [
            { x: -3.4, y: -0.45, z: -0.35, rotY: -Math.PI / 4 },
            { x: -1.7, y: -0.52, z: -0.95, rotY: -Math.PI / 9 },
            { x: 0, y: -0.45, z: 0.25, rotY: Math.PI / 18 },
            { x: 1.7, y: -0.5, z: -0.9, rotY: Math.PI / 6 },
            { x: 3.4, y: -0.45, z: -0.35, rotY: Math.PI / 4 },
            { x: -2.7, y: -0.6, z: -1.95, rotY: -Math.PI / 5 },
            { x: -0.95, y: -0.62, z: -2.15, rotY: Math.PI / 10 },
            { x: 0.95, y: -0.61, z: -2.2, rotY: -Math.PI / 8 },
            { x: 2.7, y: -0.59, z: -2.0, rotY: Math.PI / 3.6 },
          ];

          const mobileModelLayouts = [
            { x: 0, y: -0.45, z: 0.25, rotY: Math.PI / 18 },
            { x: -0.95, y: -0.62, z: -2.15, rotY: Math.PI / 10 },
            { x: 0.95, y: -0.61, z: -2.2, rotY: -Math.PI / 8 },
          ];

          const modelLayouts =
            window.matchMedia('(max-width: 768px)').matches
              ? mobileModelLayouts
              : desktopModelLayouts;

          modelLayouts.forEach((layout) => {
            const cow = cloneSkinnedModel(gltf.scene);
            cow.position.set(layout.x, layout.y, layout.z);
            cow.scale.setScalar(0.55);
            cow.rotation.y = layout.rotY;

            cow.traverse((child) => {
              if (
                !('isMesh' in child) ||
                !child.isMesh ||
                !('material' in child)
              )
                return;

              const materials = Array.isArray(child.material)
                ? child.material
                : [child.material];
              materials.forEach((material) => {
                if (
                  material &&
                  typeof material === 'object' &&
                  'map' in material &&
                  !(
                    material as {
                      map?: unknown;
                    }
                  ).map
                ) {
                  (
                    material as {
                      map?: unknown;
                      needsUpdate?: boolean;
                    }
                  ).map = fallbackTexture;
                  (
                    material as {
                      needsUpdate?: boolean;
                    }
                  ).needsUpdate = true;
                }
              });
            });

            scene.add(cow);

            if (gltf.animations.length > 0) {
              const mixer = new AnimationMixer(cow);
              gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
              mixers.push(mixer);
            }
          });
        },
        undefined,
        () => {
          if (!isFallback) {
            loadCowModel('/assets/april/source/Vaca con ritmo.glb', true);
          }
        }
      );
    };

    loadCowModel('/assets/april/dancing_cow.glb');

    const music = new Audio('/assets/april/song.mp3');
    music.preload = 'auto';
    music.loop = false;
    music.volume = 0.9;
    music.load();
    let awaitUserSoundUnlock = false;
    const tryStartMusic = async () => {
      try {
        await music.play();
        awaitUserSoundUnlock = false;
        audioHint.style.opacity = '0';
      } catch {
        awaitUserSoundUnlock = true;
        audioHint.style.opacity = '1';
      }
    };
    void tryStartMusic();

    const unlockSound = () => {
      if (!awaitUserSoundUnlock) return;
      void tryStartMusic();
    };
    overlay.addEventListener('pointerdown', unlockSound);
    window.addEventListener('keydown', unlockSound);

    const animate = () => {
      rafId = window.requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();
      mixers.forEach((mixer) => mixer.update(delta));

      discoLightA.position.set(
        Math.cos(elapsed * 1.7) * 3.2,
        1.2 + Math.sin(elapsed * 2.1) * 0.9,
        Math.sin(elapsed * 1.7) * 2.8
      );
      discoLightB.position.set(
        Math.cos(elapsed * 1.2 + Math.PI) * 3.6,
        1.7 + Math.sin(elapsed * 1.9 + 0.8) * 0.8,
        Math.sin(elapsed * 1.2 + Math.PI) * 3.2
      );
      discoLightC.position.set(
        Math.sin(elapsed * 1.5) * 2.6,
        2.5 + Math.cos(elapsed * 1.3) * 0.7,
        Math.cos(elapsed * 1.5) * 2.2
      );

      discoLightA.intensity = 10 + Math.sin(elapsed * 6.0) * 4.0;
      discoLightB.intensity = 9 + Math.sin(elapsed * 5.2 + 1.2) * 3.5;
      discoLightC.intensity = 8 + Math.sin(elapsed * 4.6 + 2.1) * 3.0;
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    let cleanupTimeout: number | null = null;
    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      if (cleanupTimeout !== null) {
        window.clearTimeout(cleanupTimeout);
      }
      music.removeEventListener('ended', cleanup);
      music.pause();
      music.currentTime = 0;
      overlay.removeEventListener('pointerdown', unlockSound);
      window.removeEventListener('keydown', unlockSound);
      renderer.dispose();
      overlay.remove();
      document.body.style.overflow = '';
    };
    music.addEventListener('ended', cleanup);
    music.addEventListener('loadedmetadata', () => {
      const durationMs = Number.isFinite(music.duration)
        ? Math.ceil(music.duration * 1000)
        : APRIL_COW_MAX_DURATION_MS;
      cleanupTimeout = window.setTimeout(
        cleanup,
        Math.min(durationMs + 200, APRIL_COW_MAX_DURATION_MS)
      );
    });

    cleanupTimeout = window.setTimeout(cleanup, APRIL_COW_MAX_DURATION_MS);
  } catch (error) {
    console.error('Failed to show April cow easter egg:', error);
  }
}
