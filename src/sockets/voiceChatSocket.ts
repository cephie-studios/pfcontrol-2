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

type VoiceUsersUpdateCallback = (_users: VoiceUser[]) => void;
type ConnectionStateCallback = (_state: VoiceConnectionState) => void;
type TalkingCallback = (_userId: string) => void;
type AudioLevelCallback = (_userId: string, _level: number, _isTalking: boolean) => void;
type DevicesRefreshedCallback = (_devices: MediaDeviceInfo[]) => void;

export function createVoiceChatSocket(
  sessionId: string,
  accessId: string,
  userId: string,
  onVoiceUsersUpdate: VoiceUsersUpdateCallback,
  onConnectionStateChange: ConnectionStateCallback,
  onUserStartedTalking: TalkingCallback,
  onUserStoppedTalking: TalkingCallback,
  /** Called with (userId, level, isTalking) after each audio analysis tick */
  onAudioLevelUpdate: AudioLevelCallback,
  getUserVolumes: (() => Map<string, number>) | Map<string, number>,
  onDevicesRefreshed?: DevicesRefreshedCallback
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

  const getVolumes = typeof getUserVolumes === 'function'
    ? getUserVolumes
    : () => getUserVolumes as Map<string, number>;

  const peerConnections = new Map<string, RTCPeerConnection>();
  const audioStreams = new Map<string, MediaStream>();
  const audioElements = new Map<string, HTMLAudioElement>();
  const boostGainNodes = new Map<string, GainNode>();
  const remoteAudioMonitorIntervals = new Map<string, number>();
  const statsIntervals = new Map<string, number>();
  const iceHangTimeouts = new Map<string, number>();

  const makingOfferMap = new Map<string, boolean>();
  const ignoreOfferMap = new Map<string, boolean>();
  const candidateBufferMap = new Map<string, RTCIceCandidateInit[]>();

  let localStream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let microphone: MediaStreamAudioSourceNode | null = null;
  let audioLevelInterval: number | null = null;
  let isDeafenedLocally = false;
  let selectedAudioInputId = 'default';
  let wasTalking = false;

  const rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
    iceCandidatePoolSize: 0,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  };

  const getOrCreateAudioContext = () => {
    if (!audioContext || audioContext.state === 'closed') {
      audioContext = new (window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext!)();
    }
    return audioContext;
  };

  const resumeAudioContext = async () => {
    const ctx = getOrCreateAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    return ctx;
  };

  const startAudioLevelMonitoring = () => {
    if (!audioContext || !analyser) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const checkAudioLevel = () => {
      if (!analyser) return;
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const level = Math.min(avg / 128, 1);
      const isTalking = level > 0.1;

      onAudioLevelUpdate(userId, level, isTalking);

      if (isTalking !== wasTalking) {
        wasTalking = isTalking;
        socket.emit('audioLevel', { level, isTalking });
        if (isTalking) onUserStartedTalking(userId);
        else onUserStoppedTalking(userId);
      }
    };

    audioLevelInterval = window.setInterval(checkAudioLevel, 100);
  };

  const stopAudioLevelMonitoring = () => {
    if (audioLevelInterval) {
      clearInterval(audioLevelInterval);
      audioLevelInterval = null;
    }
    wasTalking = false;
  };

  const refreshDeviceList = async () => {
    if (!onDevicesRefreshed) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === 'audioinput');
      onDevicesRefreshed(audioInputs);
    } catch {/**/}
  };

  const initializeAudio = async () => {
    try {
      const ctx = await resumeAudioContext();
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
        localStream = null;
      }

      localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedAudioInputId === 'default' ? undefined : { exact: selectedAudioInputId },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
      });

      await refreshDeviceList();

      if (analyser) analyser.disconnect();
      if (microphone) microphone.disconnect();

      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      microphone = ctx.createMediaStreamSource(localStream);
      microphone.connect(analyser);

      startAudioLevelMonitoring();
      return true;
    } catch (error) {
      console.error('[VoiceChat] Audio init error:', error);
      onConnectionStateChange({ connected: false, connecting: false, error: 'Mic access failed' });
      return false;
    }
  };

  const createPeerConnection = (targetUserId: string, addTracks = true) => {
    const pc = new RTCPeerConnection(rtcConfig);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const c = event.candidate;
        console.log(`[VoiceChat] Sending ${c.type || '?'} candidate to ${targetUserId}: ${c.candidate}`);
        socket.emit('ice-candidate', { targetUserId, candidate: c.toJSON() });
      } else {
        console.log(`[VoiceChat] ICE gathering complete for ${targetUserId}`);
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log(`[VoiceChat] ICE gathering state with ${targetUserId}: ${pc.iceGatheringState}`);
    };

    pc.onsignalingstatechange = () => {
      console.log(`[VoiceChat] Signaling state with ${targetUserId}: ${pc.signalingState}`);
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log(`[VoiceChat] ICE state with ${targetUserId}: ${state}`);
      if (state === 'failed' || state === 'disconnected') {
        console.warn(`[VoiceChat] ICE ${state} for ${targetUserId}, requesting reconnection...`);
        socket.emit('request-reconnection', { targetUserId });
      }
    };

    const sInt = window.setInterval(async () => {
      if (pc.signalingState === 'closed') return;
      try {
        const stats = await pc.getStats();
        stats.forEach(report => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            console.info(`[VoiceChat] Active candidate pair for ${targetUserId} success!`);
          }
        });
      } catch {/**/}
    }, 5000);
    statsIntervals.set(targetUserId, sInt);

    const iceHangTimeout = window.setTimeout(() => {
      if (
        (pc.iceConnectionState === 'checking' || pc.iceConnectionState === 'new') &&
        pc.remoteDescription !== null
      ) {
        console.warn(`[VoiceChat] ICE stuck in ${pc.iceConnectionState} for ${targetUserId}, forcing restart...`);
        pc.restartIce();
      }
      iceHangTimeouts.delete(targetUserId);
    }, 10000);
    iceHangTimeouts.set(targetUserId, iceHangTimeout);

    pc.onconnectionstatechange = () => {
      console.log(`[VoiceChat] PeerConnection state with ${targetUserId}: ${pc.connectionState}`);
      if (pc.connectionState === 'failed') {
        socket.emit('request-reconnection', { targetUserId });
      }
      if (['connected', 'failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        const t = iceHangTimeouts.get(targetUserId);
        if (t !== undefined) { clearTimeout(t); iceHangTimeouts.delete(targetUserId); }
      }
    };

    pc.onnegotiationneeded = async () => {
      if (makingOfferMap.get(targetUserId) || pc.signalingState !== 'stable') {
        console.log(`[VoiceChat] Skipping negotiation request for ${targetUserId} (busy/unstable)`);
        return;
      }
      try {
        const senders = pc.getSenders();
        console.log(`[VoiceChat] Negotiation needed for ${targetUserId}. Senders:`, senders.map(s => s.track?.kind || 'no-track'));
        
        makingOfferMap.set(targetUserId, true);
        await pc.setLocalDescription();
        socket.emit('voice-offer', { targetUserId, offer: pc.localDescription });
      } catch (err) {
        console.error(`[VoiceChat] Negotiation error for ${targetUserId}:`, err);
      } finally {
        makingOfferMap.set(targetUserId, false);
      }
    };

    pc.ontrack = (event) => {
      console.log(`[VoiceChat] Received remote track from ${targetUserId}:`, {
        kind: event.track.kind,
        enabled: event.track.enabled,
        readyState: event.track.readyState,
        muted: event.track.muted
      });

      event.track.onmute = () => console.warn(`[VoiceChat] Remote track from ${targetUserId} became MUTED (packets stopped)`);
      event.track.onunmute = () => {
        console.info(`[VoiceChat] Remote track from ${targetUserId} UNMUTED (packets started)`);
        // Force playback on unmute
        if (audioElements.has(targetUserId)) {
          const a = audioElements.get(targetUserId)!;
          a.play().catch(() => {/**/});
        }
      };
      
      const checkTrackState = () => {
        console.log(`[VoiceChat] Track state for ${targetUserId}:`, {
          muted: event.track.muted,
          readyState: event.track.readyState,
          enabled: event.track.enabled
        });
      };
      
      setTimeout(checkTrackState, 1000);
      setTimeout(checkTrackState, 5000);
      
      let stream = event.streams[0];
      if (!stream) stream = new MediaStream([event.track]);
      audioStreams.set(targetUserId, stream);

      const oldAudio = audioElements.get(targetUserId);
      if (oldAudio) { oldAudio.pause(); oldAudio.srcObject = null; oldAudio.remove(); }
      const oldBoost = boostGainNodes.get(targetUserId);
      if (oldBoost) { try { oldBoost.disconnect(); } catch {/**/} }
      const oldInterval = remoteAudioMonitorIntervals.get(targetUserId);
      if (oldInterval) clearInterval(oldInterval);

      const vol = getVolumes().get(targetUserId) ?? 100;
      console.log(`[VoiceChat] Applying volume to ${targetUserId}: ${vol}% (deafened: ${isDeafenedLocally})`);

      const audio = new Audio();
      audio.srcObject = stream;
      audio.autoplay = true;
      audio.volume = isDeafenedLocally ? 0 : Math.min(vol / 100, 1.0);
      audio.muted = isDeafenedLocally;
      document.body.appendChild(audio);
      audio.play().then(() => {
        console.log(`[VoiceChat] Playback started for ${targetUserId}`);
      }).catch((err) => {
        console.warn(`[VoiceChat] Playback blocked for ${targetUserId}, queuing retry:`, err);
        const retry = async () => {
          console.log(`[VoiceChat] Retrying blocked playback for ${targetUserId}`);
          try {
            await resumeAudioContext();
            await audio.play();
          } catch {/**/}
        };
        document.addEventListener('click', retry, { once: true });
        document.addEventListener('keydown', retry, { once: true });
      });
      audioElements.set(targetUserId, audio);

      resumeAudioContext().then(ctx => {
        if (ctx) {
          const source = ctx.createMediaStreamSource(stream);
          const remoteAnalyser = ctx.createAnalyser();
          remoteAnalyser.fftSize = 256;
          const zeroGain = ctx.createGain();
          zeroGain.gain.value = 0;
          const boostGain = ctx.createGain();
          boostGain.gain.value = isDeafenedLocally ? 0 : Math.max(0, vol / 100 - 1);

          source.connect(remoteAnalyser);
          remoteAnalyser.connect(zeroGain);
          zeroGain.connect(ctx.destination);
          source.connect(boostGain);
          boostGain.connect(ctx.destination);

          boostGainNodes.set(targetUserId, boostGain);

          const dataArray = new Uint8Array(remoteAnalyser.frequencyBinCount);
          const interval = window.setInterval(() => {
            remoteAnalyser.getByteFrequencyData(dataArray);
            const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
            const level = Math.min(avg / 128, 1);
            onAudioLevelUpdate(targetUserId, level, level > 0.1);
          }, 100);
          remoteAudioMonitorIntervals.set(targetUserId, interval);
        }
      }).catch(err => console.warn('[VoiceChat] Remote audio resume failed:', err));
    };

    if (addTracks && localStream) {
      localStream.getTracks().forEach(track => {
        const existing = pc.getTransceivers().find(t => t.receiver.track.kind === track.kind);
        if (existing) {
          if (existing.sender.track !== track) existing.sender.replaceTrack(track);
          existing.direction = 'sendrecv';
        } else {
          console.log(`[VoiceChat] Adding local track to ${targetUserId}:`, track.kind);
          pc.addTransceiver(track, { direction: 'sendrecv', streams: [localStream!] });
        }
      });
    }

    peerConnections.set(targetUserId, pc);
    return pc;
  };


  socket.on('voice-offer', async ({ fromUserId, offer }) => {
    let pc = peerConnections.get(fromUserId);
    if (!pc) pc = createPeerConnection(fromUserId, false);

    const polite = userId > fromUserId;
    const isStable = pc!.signalingState === 'stable';
    const makingOffer = makingOfferMap.get(fromUserId) || false;
    const offerCollision = !isStable || makingOffer;

    const ignoreOffer = !polite && offerCollision;
    ignoreOfferMap.set(fromUserId, ignoreOffer);

    if (ignoreOffer) {
      console.log(`[VoiceChat] Ignoring offer collision from ${fromUserId} (impolite)`);
      return;
    }

    try {
      console.log(`[VoiceChat] Processing offer from ${fromUserId}...`);
      const sdpBrief = offer.sdp?.split('\n').filter((l: string) => l.startsWith('m=') || l.startsWith('a=mid:')).join(' | ');
      console.log(`[VoiceChat] Offer SDP: ${sdpBrief}`);
      await pc!.setRemoteDescription(offer);

      if (localStream) {
        await Promise.all(localStream.getTracks().map(async track => {
          const transceiver = pc!.getTransceivers().find(
            t => t.receiver.track.kind === track.kind && t.sender.track === null
          );
          if (transceiver) {
            await transceiver.sender.replaceTrack(track);
            transceiver.direction = 'sendrecv';
          } else {
            const existing = pc!.getTransceivers().find(t => t.receiver.track.kind === track.kind);
            if (existing && existing.sender.track !== track) await existing.sender.replaceTrack(track);
            if (existing) existing.direction = 'sendrecv';
          }
        }));
      }

      await pc!.setLocalDescription();
      socket.emit('voice-answer', { targetUserId: fromUserId, answer: pc!.localDescription });

      const buffered = candidateBufferMap.get(fromUserId) || [];
      for (const cand of buffered) await pc!.addIceCandidate(cand);
      candidateBufferMap.delete(fromUserId);
    } catch {
      console.error(`[VoiceChat] Offer processing error for ${fromUserId}`);
    }
  });

  socket.on('voice-answer', async ({ fromUserId, answer }) => {
    const pc = peerConnections.get(fromUserId);
    if (!pc) return;
    try {
      console.log(`[VoiceChat] Processing answer from ${fromUserId}...`);
      const sdpBrief = answer.sdp?.split('\n').filter((l: string) => l.startsWith('m=') || l.startsWith('a=mid:')).join(' | ');
      console.log(`[VoiceChat] Answer SDP: ${sdpBrief}`);
      await pc.setRemoteDescription(answer);
      const buffered = candidateBufferMap.get(fromUserId) || [];
      for (const cand of buffered) await pc!.addIceCandidate(cand);
      candidateBufferMap.delete(fromUserId);
    } catch (err) {
      console.error(`[VoiceChat] Answer processing error for ${fromUserId}:`, err);
    }
  });

  socket.on('ice-candidate', async ({ fromUserId, candidate }) => {
    const pc = peerConnections.get(fromUserId);
    let type = 'unknown';
    if (candidate && candidate.candidate) {
      const typeMatch = candidate.candidate.match(/typ (\w+)/);
      type = typeMatch ? typeMatch[1] : 'unknown';
      console.log(`[VoiceChat] Received ${type} candidate from ${fromUserId}`);
    }
    console.log(`[VoiceChat] Received ${type} candidate from ${fromUserId}:`, candidate?.candidate?.substring(0, 100));
    if (!pc || !pc.remoteDescription) {
      if (!candidateBufferMap.has(fromUserId)) candidateBufferMap.set(fromUserId, []);
      candidateBufferMap.get(fromUserId)!.push(candidate);
      return;
    }
    try {
      await pc!.addIceCandidate(candidate);
    } catch (err) {
      console.warn(`[VoiceChat] Failed to add candidate from ${fromUserId}:`, err);
    }
  });

  socket.on('user-joined-voice', async ({ userId: newUserId }) => {
    if (newUserId === userId) return;

    if (!localStream) {
      console.log(`[VoiceChat] user-joined-voice from ${newUserId} ignored — not in voice yet`);
      return;
    }

    if (userId <= newUserId) {
      console.log(`[VoiceChat] Waiting for ${newUserId} to initiate (their ID is >=)`);
      return;
    }

    const existing = peerConnections.get(newUserId);
    if (existing) { existing.close(); peerConnections.delete(newUserId); }

    createPeerConnection(newUserId);
  });

  socket.on('voice-peers', ({ peerIds }: { peerIds: string[] }) => {
    if (!localStream) return;
    for (const peerId of peerIds) {
      if (userId > peerId) {
        if (!peerConnections.has(peerId)) {
          console.log(`[VoiceChat] Initiating connection to existing peer ${peerId}`);
          createPeerConnection(peerId);
        }
      } else {
        console.log(`[VoiceChat] Waiting for existing peer ${peerId} to initiate (their ID is >=)`);
      }
    }
  });

  socket.on('user-left-voice', ({ userId: leftUserId }) => {
    const pc = peerConnections.get(leftUserId);
    if (pc) { pc.close(); peerConnections.delete(leftUserId); }
    const stream = audioStreams.get(leftUserId);
    if (stream) { stream.getTracks().forEach(t => t.stop()); audioStreams.delete(leftUserId); }
    const audio = audioElements.get(leftUserId);
    if (audio) { audio.pause(); audio.srcObject = null; audio.remove(); audioElements.delete(leftUserId); }
    const boost = boostGainNodes.get(leftUserId);
    if (boost) { try { boost.disconnect(); } catch {/**/} boostGainNodes.delete(leftUserId); }
    const interval = remoteAudioMonitorIntervals.get(leftUserId);
    if (interval) { clearInterval(interval); remoteAudioMonitorIntervals.delete(leftUserId); }
    const sInt = statsIntervals.get(leftUserId);
    if (sInt) { clearInterval(sInt); statsIntervals.delete(leftUserId); }
    const hangTimeout = iceHangTimeouts.get(leftUserId);
    if (hangTimeout !== undefined) { clearTimeout(hangTimeout); iceHangTimeouts.delete(leftUserId); }
    candidateBufferMap.delete(leftUserId);
    onUserStoppedTalking(leftUserId);
  });


  socket.on('connect', () => onConnectionStateChange({ connected: true, connecting: false, error: null }));
  socket.on('voice-users-update', (users: VoiceUser[]) => {
    onVoiceUsersUpdate(users);
    users.forEach((u: VoiceUser) => {
      if (u.isTalking) onUserStartedTalking(u.userId);
      else onUserStoppedTalking(u.userId);
    });
  });
  socket.on('user-talking-state', ({ userId: uid, isTalking }) => {
    if (isTalking) onUserStartedTalking(uid);
    else onUserStoppedTalking(uid);
  });
  socket.on('voice-connected', () => onConnectionStateChange({ connected: true, connecting: false, error: null }));
  socket.on('disconnect', () => onConnectionStateChange({ connected: false, connecting: false, error: 'Disconnected' }));
  socket.on('reconnect', () => {
    socket.emit('get-voice-users');
    if (localStream) socket.emit('join-voice-session');
  });

  socket.on('reconnection-requested', async ({ fromUserId }) => {
    console.log(`[VoiceChat] Reconnection requested by ${fromUserId}`);
    const pc = peerConnections.get(fromUserId);
    if (pc) {
      try {
        const stream = localStream;
        if (!stream) return;
        stream.getTracks().forEach(track => {
          const existing = pc.getTransceivers().find(t => t.receiver.track.kind === track.kind);
          if (existing) {
            if (existing.sender.track !== track) existing.sender.replaceTrack(track);
            existing.direction = 'sendrecv';
          } else {
            pc.addTransceiver(track, { direction: 'sendrecv', streams: [stream] });
          }
        });
        await pc.setLocalDescription();
        socket.emit('voice-offer', { targetUserId: fromUserId, offer: pc.localDescription });
      } catch (err) {
        console.warn('[VoiceChat] Manual reconnection failed:', err);
      }
    }
  });

  const cleanupRTC = () => {
    stopAudioLevelMonitoring();
    peerConnections.forEach(pc => pc.close());
    peerConnections.clear();
    audioStreams.forEach(s => s.getTracks().forEach(t => t.stop()));
    audioStreams.clear();
    audioElements.forEach(a => { a.pause(); a.srcObject = null; a.remove(); });
    audioElements.clear();
    boostGainNodes.forEach(g => { try { g.disconnect(); } catch {/**/} });
    boostGainNodes.clear();
    remoteAudioMonitorIntervals.forEach(i => clearInterval(i));
    remoteAudioMonitorIntervals.clear();
    statsIntervals.forEach(i => clearInterval(i));
    statsIntervals.clear();
    iceHangTimeouts.forEach(t => clearTimeout(t));
    iceHangTimeouts.clear();
    candidateBufferMap.clear();
    makingOfferMap.clear();
    ignoreOfferMap.clear();
    if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
    if (analyser) { try { analyser.disconnect(); } catch {/**/} analyser = null; }
    if (microphone) { try { microphone.disconnect(); } catch {/**/} microphone = null; }
  };

  const cleanup = () => {
    cleanupRTC();
    if (audioContext && audioContext.state !== 'closed') audioContext.close();
    socket.disconnect();
  };

  return {
    socket,
    joinVoice: () => {
      initializeAudio().then(ok => {
        if (ok) socket.emit('join-voice-session');
      });
    },
    getVoiceUsers: () => socket.emit('get-voice-users'),
    setMuted: (muted: boolean) => {
      if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = !muted);
      socket.emit('mute-state', { isMuted: muted });
    },
    setDeafened: (deafened: boolean) => {
      isDeafenedLocally = deafened;
      audioElements.forEach((audio, id) => {
        const vol = getVolumes().get(id) ?? 100;
        audio.volume = deafened ? 0 : Math.min(vol / 100, 1.0);
        audio.muted = deafened;
      });
      boostGainNodes.forEach((boost, id) => {
        const vol = getVolumes().get(id) ?? 100;
        boost.gain.value = deafened ? 0 : Math.max(0, vol / 100 - 1);
      });
      socket.emit('deafen-state', { isDeafened: deafened });
    },
    setAudioInputDevice: async (deviceId: string) => {
      selectedAudioInputId = deviceId;
      if (localStream) {
        stopAudioLevelMonitoring();
        if (microphone) microphone.disconnect();
        const ok = await initializeAudio();
        if (ok && localStream) {
          const track = localStream.getAudioTracks()[0];
          peerConnections.forEach(pc => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
            if (sender && track) sender.replaceTrack(track);
          });
        }
      }
    },
    setUserVolume: (uid: string, vol: number) => {
      const audio = audioElements.get(uid);
      if (audio) {
        audio.volume = isDeafenedLocally ? 0 : Math.min(vol / 100, 1.0);
        audio.muted = isDeafenedLocally;
      }
      const boost = boostGainNodes.get(uid);
      if (boost) boost.gain.value = isDeafenedLocally ? 0 : Math.max(0, vol / 100 - 1);
    },
    leaveVoice: () => {
      socket.emit('leave-voice-session');
      cleanupRTC();
    },
    cleanup,
  };
}
