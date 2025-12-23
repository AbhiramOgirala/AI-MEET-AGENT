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
        } : false,
        video: video ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
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
        audio: true,
      };

      this.screenStream = await navigator.mediaDevices.getDisplayMedia(constraints);
      this.isScreenSharing = true;

      // Handle screen share end
      this.screenStream.getVideoTracks()[0].onended = () => {
        this.stopScreenShare();
      };

      return this.screenStream;
    } catch (error) {
      console.error('Error starting screen share:', error);
      throw new Error('Failed to start screen sharing');
    }
  }

  stopScreenShare(): void {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      this.screenStream = null;
      this.isScreenSharing = false;

      // Notify others that screen sharing stopped
      if (this.currentMeetingId) {
        socketService.stopScreenShare(this.currentMeetingId);
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

    // Handle ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state with ${userId}:`, pc.iceConnectionState);
      
      if (pc.iceConnectionState === 'failed') {
        console.log(`ICE connection failed with ${userId}, attempting restart...`);
        pc.restartIce();
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${userId}:`, pc.connectionState);
      
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.cleanupPeerConnection(userId);
      }
    };

    this.peerConnections.set(userId, pc);
    return pc;
  }

  async createOffer(userId: string): Promise<void> {
    try {
      console.log(`Creating offer for ${userId}`);
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
