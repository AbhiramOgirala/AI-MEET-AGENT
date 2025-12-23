export interface User {
  _id: string;
  username: string;
  email: string;
  avatar?: string;
  profile: {
    firstName?: string;
    lastName?: string;
    bio?: string;
    company?: string;
    jobTitle?: string;
  };
  isGuest: boolean;
  statistics: {
    totalMeetings: number;
    totalMeetingTime: number;
    meetingsHosted: number;
    meetingsAttended: number;
  };
  isActive: boolean;
  lastSeen: string;
}

export interface Meeting {
  _id: string;
  title: string;
  description?: string;
  host: User;
  meetingId: string;
  password?: string;
  scheduledFor: string;
  duration: number;
  status: 'scheduled' | 'ongoing' | 'ended' | 'cancelled';
  settings: {
    allowGuests: boolean;
    requirePassword: boolean;
    enableRecording: boolean;
    enableChat: boolean;
    enableScreenShare: boolean;
    enableRaiseHand: boolean;
    enableReactions: boolean;
    maxParticipants: number;
    waitingRoom: boolean;
    muteOnEntry: boolean;
    videoOnEntry: boolean;
  };
  participants: Participant[];
  recording: Recording;
  chat: ChatMessage[];
  statistics: {
    totalParticipants: number;
    peakParticipants: number;
    totalDuration: number;
    chatMessages: number;
    filesShared: number;
    screenShares: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Participant {
  user: User;
  joinedAt: string;
  leftAt?: string;
  role: 'host' | 'co-host' | 'participant';
  status: 'joined' | 'left' | 'removed';
  permissions: {
    canShare: boolean;
    canRecord: boolean;
    canMuteOthers: boolean;
    canRemoveOthers: boolean;
  };
  mediaState: {
    audioEnabled: boolean;
    videoEnabled: boolean;
    screenSharing: boolean;
    handRaised: boolean;
  };
}

export interface Recording {
  isRecording: boolean;
  startTime?: string;
  endTime?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
  format: 'mp4' | 'webm' | 'mp3';
  downloadUrl?: string;
  thumbnailUrl?: string;
}

export interface ChatMessage {
  _id: string;
  sender: User;
  message: string;
  timestamp: string;
  type: 'text' | 'file' | 'system';
  file?: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    downloadUrl: string;
  };
  reactions?: ChatReaction[];
}

export interface ChatReaction {
  user: User;
  emoji: string;
  timestamp: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface CreateMeetingRequest {
  title: string;
  description?: string;
  scheduledFor?: string;
  duration?: number;
  settings?: Partial<Meeting['settings']>;
}

export interface JoinMeetingRequest {
  password?: string;
}

export interface WebRTCSignal {
  type: 'offer' | 'answer' | 'ice-candidate';
  data: any;
  meetingId: string;
  from: string;
  to: string;
}

export interface MeetingControls {
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenSharing: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface BreakoutRoom {
  name: string;
  participants: string[];
  createdAt: string;
}

export interface WhiteboardData {
  isEnabled: boolean;
  data?: string;
  lastModified?: string;
  modifiedBy?: string;
}

export enum SocketEvents {
  // Connection
  JOIN_MEETING = 'join-meeting',
  USER_JOINED = 'user-joined',
  USER_LEFT = 'user-left',
  EXISTING_PARTICIPANTS = 'existing-participants',
  
  // WebRTC
  OFFER = 'offer',
  ANSWER = 'answer',
  ICE_CANDIDATE = 'ice-candidate',
  
  // Meeting Controls
  TOGGLE_AUDIO = 'toggle-audio',
  TOGGLE_VIDEO = 'toggle-video',
  SCREEN_SHARE = 'screen-share',
  AUDIO_TOGGLED = 'audio-toggled',
  VIDEO_TOGGLED = 'video-toggled',
  
  // Chat
  CHAT_MESSAGE = 'chat-message',
  
  // Host Controls
  MUTE_PARTICIPANT = 'mute-participant',
  REMOVE_PARTICIPANT = 'remove-participant',
  MUTED_BY_HOST = 'muted-by-host',
  REMOVED_FROM_MEETING = 'removed-from-meeting',
  
  // Interactions
  RAISE_HAND = 'raise-hand',
  HAND_RAISED = 'hand-raised',
  REACTION = 'reaction',
}
