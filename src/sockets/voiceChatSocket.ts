import io from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL;

export interface VoiceUser {
  userId: string;
  username: string;
  avatar: string | null;
  isMuted: boolean;
  isDeafened: boolean;
  isTalking: boolean;
  audioLevel: number;
  volume?: number;
}

export interface VoiceConnectionState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
}

export function createVoiceChatSocket(
  sessionId: string,
  accessId: string,
  userId: string,
  onVoiceUsersUpdate: (users: VoiceUser[]) => void,
  onConnectionStateChange: (state: VoiceConnectionState) => void,
  onUserStartedTalking: (userId: string) => void,
  onUserStoppedTalking: (userId: string) => void,
  onAudioLevelUpdate: (userId: string, level: number) => void,
  userVolumes: Map<string, number>
) {
  const socket = io(SOCKET_URL, {
    withCredentials: true,
    path: '/sockets/voice-chat',
    query: { sessionId, accessId, userId },
    transports: ['websocket', 'polling'],
    upgrade: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
    timeout: 10000,
  });

  const peerConnections = new Map<string, RTCPeerConnection>();
  const audioStreams = new Map<string, MediaStream>();
  let localStream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let microphone: MediaStreamAudioSourceNode | null = null;
  let audioLevelInterval: number | null = null;

  const rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
    iceCandidatePoolSize: 10,
  };

  const startAudioLevelMonitoring = () => {
    if (!audioContext || !analyser) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const checkAudioLevel = () => {
      if (!analyser) return;

      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const normalizedLevel = Math.min(average / 128, 1);

      onAudioLevelUpdate(userId, normalizedLevel);

      const isTalking = normalizedLevel > 0.1;
      socket.emit('audioLevel', { level: normalizedLevel, isTalking });
    };

    audioLevelInterval = window.setInterval(checkAudioLevel, 100);
  };

  const stopAudioLevelMonitoring = () => {
    if (audioLevelInterval) {
      clearInterval(audioLevelInterval);
      audioLevelInterval = null;
    }
  };

  const initializeAudio = async () => {
    try {
      audioContext = new (window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext!)();

      localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
      });

      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      microphone = audioContext.createMediaStreamSource(localStream);
      microphone.connect(analyser);

      startAudioLevelMonitoring();

      onConnectionStateChange({
        connected: false,
        connecting: false,
        error: null,
      });
      return true;
    } catch (error) {
      console.error('Failed to initialize audio:', error);
      onConnectionStateChange({
        connected: false,
        connecting: false,
        error: 'Failed to access microphone',
      });
      return false;
    }
  };

  const createPeerConnection = (targetUserId: string) => {
    const pc = new RTCPeerConnection(rtcConfig);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          targetUserId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      audioStreams.set(targetUserId, remoteStream);

      const audio = new Audio();
      audio.srcObject = remoteStream;
      audio.autoplay = true;

      const savedVolume = userVolumes.get(targetUserId) ?? 100;
      audio.volume = Math.max(0, Math.min(savedVolume / 100, 1.0));

      audioElements.set(targetUserId, audio);

      if (audioContext) {
        const source = audioContext.createMediaStreamSource(remoteStream);
        const remoteAnalyser = audioContext.createAnalyser();
        remoteAnalyser.fftSize = 256;
        source.connect(remoteAnalyser);

        const dataArray = new Uint8Array(remoteAnalyser.frequencyBinCount);
        const monitorRemoteAudio = () => {
          remoteAnalyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          const normalizedLevel = Math.min(average / 128, 1);
          onAudioLevelUpdate(targetUserId, normalizedLevel);
        };

        setInterval(monitorRemoteAudio, 100);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        setTimeout(() => {
          socket.emit('request-reconnection', { targetUserId });
        }, 1000);
      }
    };

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream!);
      });
    }

    peerConnections.set(targetUserId, pc);
    return pc;
  };

  const audioElements = new Map<string, HTMLAudioElement>();

  const setUserVolume = (userId: string, volume: number) => {
    const audioElement = audioElements.get(userId);
    if (audioElement) {
      const normalizedVolume = Math.max(0, Math.min(volume / 100, 1.0));
      audioElement.volume = normalizedVolume;
    }
  };

  socket.on('connect', () => {
    onConnectionStateChange({
      connected: true,
      connecting: false,
      error: null,
    });
  });

  socket.on('voice-users-update', (users: VoiceUser[]) => {
    onVoiceUsersUpdate(users);
  });

  socket.on(
    'user-joined-voice',
    async ({ userId: newUserId, username, avatar }) => {
      if (newUserId === userId) return;

      const pc = createPeerConnection(newUserId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('voice-offer', {
        targetUserId: newUserId,
        offer: offer,
      });
    }
  );

  socket.on('voice-offer', async ({ fromUserId, offer }) => {
    const pc = createPeerConnection(fromUserId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit('voice-answer', {
      targetUserId: fromUserId,
      answer: answer,
    });
  });

  socket.on('voice-answer', async ({ fromUserId, answer }) => {
    const pc = peerConnections.get(fromUserId);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  });

  socket.on('ice-candidate', async ({ fromUserId, candidate }) => {
    const pc = peerConnections.get(fromUserId);
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  });

  socket.on('user-left-voice', ({ userId: leftUserId }) => {
    const pc = peerConnections.get(leftUserId);
    if (pc) {
      pc.close();
      peerConnections.delete(leftUserId);
    }

    const stream = audioStreams.get(leftUserId);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      audioStreams.delete(leftUserId);
    }
  });

  socket.on('user-talking-state', ({ userId: talkingUserId, isTalking }) => {
    if (isTalking) {
      onUserStartedTalking(talkingUserId);
    } else {
      onUserStoppedTalking(talkingUserId);
    }
  });

  socket.on('voice-connected', () => {
    onConnectionStateChange({
      connected: true,
      connecting: false,
      error: null,
    });
  });

  socket.on('disconnect', () => {
    onConnectionStateChange({
      connected: false,
      connecting: false,
      error: 'Disconnected',
    });
  });

  socket.on('reconnect', () => {
    socket.emit('join-voice-session');
  });

  const cleanup = () => {
    stopAudioLevelMonitoring();

    peerConnections.forEach((pc) => pc.close());
    peerConnections.clear();

    audioStreams.forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });
    audioStreams.clear();

    audioElements.forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
    });
    audioElements.clear();

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }

    if (audioContext) {
      audioContext.close();
    }

    socket.disconnect();
  };

  return {
    socket,
    joinVoice: () => {
      initializeAudio().then((success) => {
        if (success) {
          socket.emit('join-voice-session');
        }
      });
    },
    getVoiceUsers: () => {
      socket.emit('get-voice-users');
    },
    setMuted: (muted: boolean) => {
      if (localStream) {
        localStream.getAudioTracks().forEach((track) => {
          track.enabled = !muted;
        });
      }
      socket.emit('mute-state', { isMuted: muted });
    },
    setDeafened: (deafened: boolean) => {
      audioStreams.forEach((stream) => {
        stream.getAudioTracks().forEach((track) => {
          track.enabled = !deafened;
        });
      });
      socket.emit('deafen-state', { isDeafened: deafened });
    },
    setUserVolume,
    leaveVoice: () => {
      socket.emit('leave-voice-session');
      cleanup();
    },
    cleanup,
  };
}
