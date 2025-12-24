import { io, Socket } from 'socket.io-client';
import { SocketEvents, WebRTCSignal } from '../types';

class SocketService {
  private socket: Socket | null = null;
  private currentMeetingId: string | null = null;

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const serverUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';
      
      this.socket = io(serverUrl, {
        auth: {
          token
        },
        transports: ['websocket', 'polling']
      });

      this.socket.on('connect', () => {
        console.log('Connected to server');
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
        this.currentMeetingId = null;
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.currentMeetingId = null;
    }
  }

  // Meeting room management
  joinMeeting(meetingId: string): void {
    if (this.socket) {
      this.currentMeetingId = meetingId;
      this.socket.emit(SocketEvents.JOIN_MEETING, meetingId);
    }
  }

  leaveMeeting(): void {
    if (this.socket && this.currentMeetingId) {
      this.socket.emit('leave-meeting', this.currentMeetingId);
      this.currentMeetingId = null;
    }
  }

  // WebRTC signaling
  sendOffer(data: WebRTCSignal): void {
    if (this.socket) {
      this.socket.emit(SocketEvents.OFFER, data);
    }
  }

  sendAnswer(data: WebRTCSignal): void {
    if (this.socket) {
      this.socket.emit(SocketEvents.ANSWER, data);
    }
  }

  sendIceCandidate(data: WebRTCSignal): void {
    if (this.socket) {
      this.socket.emit(SocketEvents.ICE_CANDIDATE, data);
    }
  }

  // Meeting controls
  toggleAudio(meetingId: string, enabled: boolean, userId?: string): void {
    if (this.socket) {
      this.socket.emit(SocketEvents.TOGGLE_AUDIO, { meetingId, audioEnabled: enabled, userId });
    }
  }

  toggleVideo(meetingId: string, enabled: boolean, userId?: string): void {
    if (this.socket) {
      this.socket.emit(SocketEvents.TOGGLE_VIDEO, { meetingId, videoEnabled: enabled, userId });
    }
  }

  startScreenShare(meetingId: string, streamId: string, userId?: string): void {
    if (this.socket) {
      this.socket.emit(SocketEvents.SCREEN_SHARE, { meetingId, streamId, active: true, userId });
    }
  }

  stopScreenShare(meetingId: string, userId?: string): void {
    if (this.socket) {
      this.socket.emit(SocketEvents.SCREEN_SHARE, { meetingId, active: false, userId });
    }
  }

  // Chat
  sendChatMessage(meetingId: string, message: string): void {
    if (this.socket) {
      this.socket.emit(SocketEvents.CHAT_MESSAGE, { meetingId, message });
    }
  }

  // Host controls
  muteParticipant(meetingId: string, participantId: string): void {
    if (this.socket) {
      this.socket.emit(SocketEvents.MUTE_PARTICIPANT, { meetingId, participantId });
    }
  }

  removeParticipant(meetingId: string, participantId: string): void {
    if (this.socket) {
      this.socket.emit(SocketEvents.REMOVE_PARTICIPANT, { meetingId, participantId });
    }
  }

  // Interactions
  raiseHand(meetingId: string, raised: boolean, odId?: string, username?: string): void {
    if (this.socket) {
      this.socket.emit(SocketEvents.RAISE_HAND, { meetingId, raised, odId, username });
    }
  }

  sendReaction(meetingId: string, emoji: string): void {
    if (this.socket) {
      this.socket.emit(SocketEvents.REACTION, { meetingId, emoji });
    }
  }

  // Event listeners
  onUserJoined(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on(SocketEvents.USER_JOINED, callback);
    }
  }

  onUserLeft(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on(SocketEvents.USER_LEFT, callback);
    }
  }

  onExistingParticipants(callback: (participants: Array<{socketId: string; odId: string; username: string}>) => void): void {
    if (this.socket) {
      this.socket.on('existing-participants', callback);
    }
  }

  onOffer(callback: (data: WebRTCSignal) => void): void {
    if (this.socket) {
      this.socket.on(SocketEvents.OFFER, callback);
    }
  }

  onAnswer(callback: (data: WebRTCSignal) => void): void {
    if (this.socket) {
      this.socket.on(SocketEvents.ANSWER, callback);
    }
  }

  onIceCandidate(callback: (data: WebRTCSignal) => void): void {
    if (this.socket) {
      this.socket.on(SocketEvents.ICE_CANDIDATE, callback);
    }
  }

  onAudioToggled(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on(SocketEvents.AUDIO_TOGGLED, callback);
    }
  }

  onVideoToggled(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on(SocketEvents.VIDEO_TOGGLED, callback);
    }
  }

  onScreenShare(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on(SocketEvents.SCREEN_SHARE, callback);
    }
  }

  onChatMessage(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on(SocketEvents.CHAT_MESSAGE, callback);
    }
  }

  onMutedByHost(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on(SocketEvents.MUTED_BY_HOST, callback);
    }
  }

  onRemovedFromMeeting(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on(SocketEvents.REMOVED_FROM_MEETING, callback);
    }
  }

  onHandRaised(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on(SocketEvents.HAND_RAISED, callback);
    }
  }

  onReaction(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on(SocketEvents.REACTION, callback);
    }
  }

  // Remove event listeners
  off(event: string, callback?: (...args: any[]) => void): void {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
  }

  // Remove all meeting-related listeners
  removeAllMeetingListeners(): void {
    if (this.socket) {
      this.socket.off(SocketEvents.USER_JOINED);
      this.socket.off(SocketEvents.USER_LEFT);
      this.socket.off(SocketEvents.OFFER);
      this.socket.off(SocketEvents.ANSWER);
      this.socket.off(SocketEvents.ICE_CANDIDATE);
      this.socket.off(SocketEvents.AUDIO_TOGGLED);
      this.socket.off(SocketEvents.VIDEO_TOGGLED);
      this.socket.off(SocketEvents.SCREEN_SHARE);
      this.socket.off(SocketEvents.CHAT_MESSAGE);
      this.socket.off(SocketEvents.MUTED_BY_HOST);
      this.socket.off(SocketEvents.REMOVED_FROM_MEETING);
      this.socket.off(SocketEvents.HAND_RAISED);
      this.socket.off(SocketEvents.REACTION);
      this.socket.off('existing-participants');
    }
  }

  // Get connection status
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getCurrentMeetingId(): string | null {
    return this.currentMeetingId;
  }
}

export const socketService = new SocketService();
export default socketService;
