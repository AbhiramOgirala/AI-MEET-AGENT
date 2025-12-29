import { socketService } from './socket';
import { WebRTCSignal } from '../types';

export interface WebRTCManager {
  localStream: MediaStream | null;
  peerConnections: Map<string, RTCPeerConnection>;
  remoteStreams: Map<string, MediaStream>;
  screenStream: MediaStream | null;
  isScreenSharing: boolean;
}

class WebRTCService {
  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private screenStream: MediaStream | null = null;
  private isScreenSharing: boolean = false;
  private configuration: RTCConfiguration;
  private currentMeetingId: string | null = null;
  private currentUserId: string | null = null;

  constructor() {
    // Default config with STUN servers - TURN will be added via fetchIceServers()
    this.configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };
    
    // Fetch TURN servers from backend
    this.fetchIceServers();
  }

  private async fetchIceServers(): Promise<void> {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const token = localStorage.getItem('token');
      
      if (!token) return;
      
      const response = await fetch(`${apiUrl}/meetings/ice-servers`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.iceServers) {
          this.configuration.iceServers = data.data.iceServers;
          console.log('ICE servers loaded:', this.configuration.iceServers?.length, 'servers');
        }
      }
    } catch (error) {
      console.warn('Failed to fetch ICE servers, using defaults:', error);
    }
  }

  // Call this before joining a meeting to ensure TURN servers are loaded
  async ensureIceServers(): Promise<void> {
    if (!this.configuration.iceServers || this.configuration.iceServers.length <= 2) {
      await this.fetchIceServers();
    }
  }

  async initializeLocalMedia(audio = true, video = true): Promise<MediaStream> {
    try {
      const constraints = {
        audio: audio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Add latency hints for better real-time performance
          latency: 0,
        } : false,
        video: video ? {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: 'user',
        } : false,
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.localStream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw new Error('Failed to access camera/microphone');
    }
  }

  async startScreenShare(): Promise<MediaStream> {
    try {
      const constraints: DisplayMediaStreamOptions = {
        video: true,
        audio: false, // Audio from screen share can cause echo issues
      };

      this.screenStream = await navigator.mediaDevices.getDisplayMedia(constraints);
      this.isScreenSharing = true;

      // Replace video track in all peer connections with screen share track
      const screenVideoTrack = this.screenStream.getVideoTracks()[0];
      if (screenVideoTrack) {
        this.peerConnections.forEach((pc, odId) => {
          const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (videoSender) {
            console.log(`Replacing video track with screen share for peer ${odId}`);
            videoSender.replaceTrack(screenVideoTrack);
          }
        });
      }

      // Handle screen share end (user clicks stop sharing in browser UI)
      screenVideoTrack.onended = () => {
        this.stopScreenShare();
        // Notify UI that screen share ended
        this.onScreenShareEnded?.();
      };

      // Notify UI that screen share started (for updating local video display)
      this.onScreenShareStarted?.(this.screenStream);

      // Notify others that screen sharing started
      if (this.currentMeetingId && this.currentUserId) {
        socketService.startScreenShare(this.currentMeetingId, 'screen-stream', this.currentUserId);
      }

      return this.screenStream;
    } catch (error) {
      console.error('Error starting screen share:', error);
      throw new Error('Failed to start screen sharing');
    }
  }

  stopScreenShare(): void {
    if (this.screenStream) {
      // Restore original video track in all peer connections
      const localVideoTrack = this.localStream?.getVideoTracks()[0];
      
      this.peerConnections.forEach((pc, odId) => {
        const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (videoSender && localVideoTrack) {
          console.log(`Restoring video track for peer ${odId}`);
          videoSender.replaceTrack(localVideoTrack);
        }
      });

      // Stop screen share tracks
      this.screenStream.getTracks().forEach((track: MediaStreamTrack) => {
        track.stop();
      });
      
      this.screenStream = null;
      this.isScreenSharing = false;

      // Notify others that screen sharing stopped
      if (this.currentMeetingId && this.currentUserId) {
        socketService.stopScreenShare(this.currentMeetingId, this.currentUserId);
      }
    }
  }

  createPeerConnection(userId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection(this.configuration);

    // Add local stream tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track: MediaStreamTrack) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Note: Screen share tracks are NOT added here to avoid m-line ordering issues
    // Screen sharing is handled separately via replaceTrack or renegotiation

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log(`Received track from ${userId}:`, event.track.kind);
      const [remoteStream] = event.streams;
      this.remoteStreams.set(userId, remoteStream);
      this.onRemoteStreamAdded?.(userId, remoteStream);
    };

    // Handle ICE candidates
    pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate && this.currentMeetingId) {
        console.log(`Sending ICE candidate to ${userId}`);
        socketService.sendIceCandidate({
          type: 'ice-candidate',
          data: event.candidate,
          meetingId: this.currentMeetingId,
          from: this.currentUserId || 'unknown',
          to: userId,
        });
      }
    };

    // Handle ICE gathering state for debugging
    pc.onicegatheringstatechange = () => {
      console.log(`ICE gathering state with ${userId}:`, pc.iceGatheringState);
    };

    // Handle ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state with ${userId}:`, pc.iceConnectionState);
      
      if (pc.iceConnectionState === 'failed') {
        console.log(`ICE connection failed with ${userId}, attempting restart...`);
        pc.restartIce();
      } else if (pc.iceConnectionState === 'disconnected') {
        // Give it a moment to recover before cleaning up
        setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected') {
            console.log(`ICE still disconnected with ${userId}, attempting restart...`);
            pc.restartIce();
          }
        }, 3000);
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${userId}:`, pc.connectionState);
      
      if (pc.connectionState === 'failed') {
        console.log(`Connection failed with ${userId}, cleaning up...`);
        this.cleanupPeerConnection(userId);
      } else if (pc.connectionState === 'disconnected') {
        // Wait before cleanup to allow recovery
        setTimeout(() => {
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            console.log(`Connection still disconnected with ${userId}, cleaning up...`);
            this.cleanupPeerConnection(userId);
          }
        }, 5000);
      }
    };

    // Note: onnegotiationneeded is intentionally NOT set here to avoid m-line ordering issues
    // Renegotiation is handled manually when needed

    this.peerConnections.set(userId, pc);
    return pc;
  }

  async createOffer(userId: string, forceNew: boolean = false): Promise<void> {
    try {
      console.log(`Creating offer for ${userId}, forceNew: ${forceNew}`);
      
      // If forceNew, clean up any existing connection first
      if (forceNew && this.peerConnections.has(userId)) {
        console.log(`Force cleaning up existing connection for ${userId}`);
        this.cleanupPeerConnection(userId);
      }
      
      const pc = this.getOrCreatePeerConnection(userId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (this.currentMeetingId) {
        console.log(`Sending offer to ${userId}`);
        socketService.sendOffer({
          type: 'offer',
          data: offer,
          meetingId: this.currentMeetingId,
          from: this.currentUserId || 'unknown',
          to: userId,
        });
      }
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }

  async handleOffer(data: WebRTCSignal): Promise<void> {
    try {
      console.log(`Received offer from ${data.from}`);
      
      // Clean up any existing stale connection before handling new offer
      const existingPc = this.peerConnections.get(data.from);
      if (existingPc) {
        const state = existingPc.connectionState;
        const signalingState = existingPc.signalingState;
        
        // If we have an existing connection that's not in a good state, clean it up
        if (state === 'closed' || state === 'failed' || state === 'disconnected') {
          console.log(`Cleaning up stale connection from ${data.from} before handling offer`);
          this.cleanupPeerConnection(data.from);
        } else if (signalingState !== 'stable') {
          // Handle glare condition - if we're not stable, we might have a collision
          console.log(`Handling offer collision from ${data.from}, signalingState: ${signalingState}`);
          // Clean up and create fresh connection
          this.cleanupPeerConnection(data.from);
        }
      }
      
      const pc = this.getOrCreatePeerConnection(data.from);
      await pc.setRemoteDescription(new RTCSessionDescription(data.data));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (this.currentMeetingId) {
        console.log(`Sending answer to ${data.from}`);
        socketService.sendAnswer({
          type: 'answer',
          data: answer,
          meetingId: this.currentMeetingId,
          from: this.currentUserId || 'unknown',
          to: data.from,
        });
      }
    } catch (error) {
      console.error('Error handling offer:', error);
      // On error, clean up and let the other side retry
      this.cleanupPeerConnection(data.from);
    }
  }

  async handleAnswer(data: WebRTCSignal): Promise<void> {
    try {
      console.log(`Received answer from ${data.from}`);
      const pc = this.getOrCreatePeerConnection(data.from);
      await pc.setRemoteDescription(new RTCSessionDescription(data.data));
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }

  async handleIceCandidate(data: WebRTCSignal): Promise<void> {
    try {
      console.log(`Received ICE candidate from ${data.from}`);
      const pc = this.getOrCreatePeerConnection(data.from);
      await pc.addIceCandidate(new RTCIceCandidate(data.data));
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }

  private getOrCreatePeerConnection(userId: string): RTCPeerConnection {
    let pc = this.peerConnections.get(userId);
    
    // Check if existing connection is still usable
    if (pc) {
      const state = pc.connectionState;
      const iceState = pc.iceConnectionState;
      
      // If connection is closed, failed, or disconnected, clean it up and create new one
      if (state === 'closed' || state === 'failed' || state === 'disconnected' ||
          iceState === 'closed' || iceState === 'failed' || iceState === 'disconnected') {
        console.log(`Cleaning up stale connection for ${userId} (state: ${state}, ice: ${iceState})`);
        this.cleanupPeerConnection(userId);
        pc = undefined;
      }
    }
    
    if (!pc) {
      pc = this.createPeerConnection(userId);
    }
    return pc;
  }

  toggleAudio(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track: MediaStreamTrack) => {
        track.enabled = enabled;
      });
    }
  }

  toggleVideo(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track: MediaStreamTrack) => {
        track.enabled = enabled;
      });
    }
  }

  cleanupPeerConnection(userId: string): void {
    const pc = this.peerConnections.get(userId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(userId);
      this.remoteStreams.delete(userId);
      this.onRemoteStreamRemoved?.(userId);
    }
  }

  cleanup(): void {
    // Stop local streams
    if (this.localStream) {
      this.localStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      this.localStream = null;
    }

    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      this.screenStream = null;
    }

    // Close all peer connections
    const peerConnections = Array.from(this.peerConnections.entries());
    for (const [, pc] of peerConnections) {
      pc.close();
    }
    this.peerConnections.clear();
    this.remoteStreams.clear();
    this.isScreenSharing = false;
    this.currentMeetingId = null;
    this.currentUserId = null;
  }

  // Event callbacks
  onRemoteStreamAdded?: (userId: string, stream: MediaStream) => void;
  onRemoteStreamRemoved?: (userId: string) => void;
  onScreenShareStarted?: (stream: MediaStream) => void;
  onScreenShareEnded?: () => void;

  // Getters
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getScreenStream(): MediaStream | null {
    return this.screenStream;
  }

  getRemoteStream(userId: string): MediaStream | null {
    return this.remoteStreams.get(userId) || null;
  }

  getAllRemoteStreams(): Map<string, MediaStream> {
    return new Map(this.remoteStreams);
  }

  isAudioEnabled(): boolean {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      return audioTrack ? audioTrack.enabled : false;
    }
    return false;
  }

  isVideoEnabled(): boolean {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      return videoTrack ? videoTrack.enabled : false;
    }
    return false;
  }

  getIsScreenSharing(): boolean {
    return this.isScreenSharing;
  }

  setMeetingId(meetingId: string): void {
    this.currentMeetingId = meetingId;
  }

  setUserId(userId: string): void {
    this.currentUserId = userId;
  }

  getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  // Statistics and monitoring
  getConnectionStats(userId: string): Promise<RTCStatsReport | null> {
    const pc = this.peerConnections.get(userId);
    return pc ? pc.getStats() : Promise.resolve(null);
  }

  async getNetworkQuality(): Promise<number> {
    if (!this.localStream) return 0;

    try {
      // Get network quality using WebRTC stats
      let totalQuality = 0;
      let connections = 0;

      const peerConnections = Array.from(this.peerConnections.entries());
      for (const [, pc] of peerConnections) {
        const stats = await pc.getStats();
        let quality = 100;

        stats.forEach((report: any) => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            const packetsLost = report.packetsLost || 0;
            const packetsReceived = report.packetsReceived || 0;
            const lossRatio = packetsLost / (packetsLost + packetsReceived);
            
            // Calculate quality based on packet loss
            quality = Math.max(0, 100 - (lossRatio * 100));
          }
        });

        totalQuality += quality;
        connections++;
      }

      return connections > 0 ? totalQuality / connections : 100;
    } catch (error) {
      console.error('Error getting network quality:', error);
      return 50; // Default to medium quality
    }
  }
}

export const webrtcService = new WebRTCService();
export default webrtcService;
