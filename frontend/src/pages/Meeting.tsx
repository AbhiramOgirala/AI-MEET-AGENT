import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  VideoCameraIcon,
  VideoCameraSlashIcon,
  MicrophoneIcon,
  ComputerDesktopIcon,
  PhoneXMarkIcon,
  ChatBubbleLeftRightIcon,
  UsersIcon,
  HandRaisedIcon,
  SpeakerXMarkIcon,
  CircleStackIcon,
  StopIcon,
  UserCircleIcon,
  DocumentTextIcon,
  ClipboardDocumentIcon,
  ShareIcon,
  Cog6ToothIcon,
  LockClosedIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { apiService } from '../services/api';
import { socketService } from '../services/socket';
import { webrtcService } from '../services/webrtc';
import { useAuth } from '../contexts/AuthContext';
import type { Meeting } from '../types';

const MeetingPage: React.FC = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [subtitles, setSubtitles] = useState<Array<{ speaker: string; text: string; timestamp: Date }>>([]);
  const [localStreamReady, setLocalStreamReady] = useState(false);
  const [showMeetingInfo, setShowMeetingInfo] = useState(false);
  const [showHostSettings, setShowHostSettings] = useState(false);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: 'join' | 'hand' | 'message';
    message: string;
    timestamp: Date;
  }>>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const initializeMeeting = useCallback(async () => {
    try {
      // Get meeting details
      const response = await apiService.getMeeting(meetingId!);
      if (response.success && response.data) {
        setMeeting(response.data.meeting);
      }

      // Join meeting
      await apiService.joinMeeting(meetingId!);

      // Initialize WebRTC
      await webrtcService.initializeLocalMedia(true, true);
      webrtcService.setMeetingId(meetingId!);
      setLocalStreamReady(true);

      // Connect to socket
      const token = localStorage.getItem('token');
      if (token) {
        await socketService.connect(token);
        socketService.joinMeeting(meetingId!);
      }

      // Setup WebRTC callbacks
      webrtcService.onRemoteStreamAdded = (userId: string, stream: MediaStream) => {
        setRemoteStreams(prev => new Map(prev.set(userId, stream)));
      };

      webrtcService.onRemoteStreamRemoved = (userId: string) => {
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.delete(userId);
          return newMap;
        });
      };

      // Fetch chat history
      const chatResponse = await apiService.getChatHistory(meetingId!);
      if (chatResponse.success && chatResponse.data) {
        setChatMessages(chatResponse.data.messages);
      }

    } catch (error) {
      console.error('Error initializing meeting:', error);
      navigate('/dashboard');
    } finally {
      setIsLoading(false);
    }
  }, [meetingId, navigate]);

  // Notification helpers - defined before setupSocketListeners to avoid reference error
  const addNotification = useCallback((type: 'join' | 'hand' | 'message', message: string) => {
    const notification = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      message,
      timestamp: new Date(),
    };
    
    setNotifications(prev => [...prev.slice(-4), notification]); // Keep last 5 notifications
    
    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  }, []);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const setupSocketListeners = useCallback(() => {
    // WebRTC signaling
    socketService.onOffer((data) => {
      webrtcService.handleOffer(data);
    });

    socketService.onAnswer((data) => {
      webrtcService.handleAnswer(data);
    });

    socketService.onIceCandidate((data) => {
      webrtcService.handleIceCandidate(data);
    });

    socketService.onUserJoined((userId: string) => {
      console.log('User joined:', userId);
      // Create peer connection for new user
      webrtcService.createOffer(userId);
      
      // Add notification for new participant
      addNotification('join', `A new participant joined the meeting`);
    });

    socketService.onUserLeft((userId: string) => {
      console.log('User left:', userId);
      webrtcService.cleanupPeerConnection(userId);
    });

    // Meeting controls - update participant media states
    socketService.onAudioToggled((data: { audioEnabled: boolean; userId: string }) => {
      console.log('Audio toggled:', data);
      if (!data.userId) return; // Ignore if no userId
      // Update the meeting participants' media state
      setMeeting(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.map(p => {
            if (p.user._id === data.userId) {
              return {
                ...p,
                mediaState: {
                  ...p.mediaState,
                  audioEnabled: data.audioEnabled
                }
              };
            }
            return p;
          })
        };
      });
    });

    socketService.onVideoToggled((data: { videoEnabled: boolean; userId: string }) => {
      console.log('Video toggled:', data);
      // Update the meeting participants' media state
      setMeeting(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.map(p => {
            if (p.user._id === data.userId) {
              return {
                ...p,
                mediaState: {
                  ...p.mediaState,
                  videoEnabled: data.videoEnabled
                }
              };
            }
            return p;
          })
        };
      });
    });

    socketService.onScreenShare((data: { active: boolean; userId: string }) => {
      console.log('Screen share:', data);
      // Update the meeting participants' media state
      setMeeting(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.map(p => {
            if (p.user._id === data.userId) {
              return {
                ...p,
                mediaState: {
                  ...p.mediaState,
                  screenSharing: data.active
                }
              };
            }
            return p;
          })
        };
      });
    });

    // Chat
    socketService.onChatMessage((data) => {
      setChatMessages(prev => [...prev, data]);
      
      // Add notification if chat panel is closed and message is from someone else
      if (data.sender?._id !== user?._id) {
        addNotification('message', `${data.sender?.username || 'Someone'}: ${data.message.substring(0, 50)}${data.message.length > 50 ? '...' : ''}`);
        setUnreadMessages(prev => prev + 1);
      }
    });

    // Host controls
    socketService.onMutedByHost(() => {
      setIsAudioEnabled(false);
      webrtcService.toggleAudio(false);
      toast.error('You have been muted by the host');
    });

    socketService.onRemovedFromMeeting(() => {
      toast.error('You have been removed from the meeting');
      navigate('/dashboard');
    });

    // Interactions
    socketService.onHandRaised((data: { raised: boolean; userId: string; username?: string }) => {
      console.log('Hand raised:', data);
      // Update the meeting participants' media state
      setMeeting(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.map(p => {
            if (p.user._id === data.userId) {
              return {
                ...p,
                mediaState: {
                  ...p.mediaState,
                  handRaised: data.raised
                }
              };
            }
            return p;
          })
        };
      });
      
      // Add notification for raised hand
      if (data.raised && data.userId !== user?._id) {
        addNotification('hand', `${data.username || 'Someone'} raised their hand`);
      }
    });

    socketService.onReaction(() => {
      // Show reaction animation
    });
  }, [navigate, user?._id, addNotification]);

  useEffect(() => {
    if (!meetingId) return;

    initializeMeeting();
    setupSocketListeners();

    return () => {
      webrtcService.cleanup();
      socketService.disconnect();
    };
  }, [meetingId, initializeMeeting, setupSocketListeners]);

  useEffect(() => {
    console.log('Local video effect - localStreamReady:', localStreamReady, 'isVideoEnabled:', isVideoEnabled);
    if (localVideoRef.current && webrtcService.getLocalStream()) {
      console.log('Setting local video stream');
      localVideoRef.current.srcObject = webrtcService.getLocalStream();
    } else {
      console.log('No local video stream available');
    }
  }, [localStreamReady, isVideoEnabled]);

  useEffect(() => {
    if (screenVideoRef.current && webrtcService.getScreenStream()) {
      screenVideoRef.current.srcObject = webrtcService.getScreenStream();
    }
  }, [isScreenSharing]);

  // Speech Recognition Effect
  useEffect(() => {
    if (showSubtitles && !recognitionRef.current) {
      // Initialize speech recognition
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          const current = event.resultIndex;
          const transcript = event.results[current][0].transcript;
          const isFinal = event.results[current].isFinal;

          if (isFinal && transcript.trim()) {
            const newSubtitle = {
              speaker: 'You',
              text: transcript,
              timestamp: new Date()
            };
            
            setSubtitles(prev => [...prev.slice(-10), newSubtitle]);
          }
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
        };

        recognitionRef.current = recognition;
        
        // Start recognition
        try {
          recognition.start();
          console.log('Speech recognition started');
        } catch (error) {
          console.error('Failed to start speech recognition:', error);
        }
      }
    } else if (!showSubtitles && recognitionRef.current) {
      // Stop recognition
      try {
        recognitionRef.current.stop();
        recognitionRef.current = null;
        console.log('Speech recognition stopped');
      } catch (error) {
        console.error('Failed to stop speech recognition:', error);
      }
    }

    // Cleanup
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          console.error('Error stopping recognition:', error);
        }
      }
    };
  }, [showSubtitles]);

  const toggleAudio = () => {
    const newState = !isAudioEnabled;
    setIsAudioEnabled(newState);
    webrtcService.toggleAudio(newState);
    
    if (meeting && user) {
      socketService.toggleAudio(meeting.meetingId, newState, user._id);
      // Also update local participant state
      setMeeting(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.map(p => {
            if (p.user._id === user._id) {
              return {
                ...p,
                mediaState: { ...p.mediaState, audioEnabled: newState }
              };
            }
            return p;
          })
        };
      });
    }
  };

  const toggleVideo = () => {
    const newState = !isVideoEnabled;
    setIsVideoEnabled(newState);
    webrtcService.toggleVideo(newState);
    
    if (meeting && user) {
      socketService.toggleVideo(meeting.meetingId, newState, user._id);
      // Also update local participant state
      setMeeting(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.map(p => {
            if (p.user._id === user._id) {
              return {
                ...p,
                mediaState: { ...p.mediaState, videoEnabled: newState }
              };
            }
            return p;
          })
        };
      });
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        await webrtcService.startScreenShare();
        setIsScreenSharing(true);
        
        if (meeting && user) {
          socketService.startScreenShare(meeting.meetingId, 'screen-stream-id', user._id);
          // Update local participant state
          setMeeting(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              participants: prev.participants.map(p => {
                if (p.user._id === user._id) {
                  return {
                    ...p,
                    mediaState: { ...p.mediaState, screenSharing: true }
                  };
                }
                return p;
              })
            };
          });
        }
      } catch (error) {
        console.error('Error starting screen share:', error);
      }
    } else {
      webrtcService.stopScreenShare();
      setIsScreenSharing(false);
      
      if (meeting && user) {
        socketService.stopScreenShare(meeting.meetingId, user._id);
        // Update local participant state
        setMeeting(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            participants: prev.participants.map(p => {
              if (p.user._id === user._id) {
                return {
                  ...p,
                  mediaState: { ...p.mediaState, screenSharing: false }
                };
              }
              return p;
            })
          };
        });
      }
    }
  };

  // Permission helpers - use useMemo to prevent unnecessary recalculations
  const currentParticipant = meeting?.participants.find(
    p => p.user._id === user?._id && p.status === 'joined'
  );
  
  // Also check if user is the meeting host by comparing host ID
  const isHost = currentParticipant?.role === 'host' || 
    (meeting?.host && (
      (typeof meeting.host === 'string' && meeting.host === user?._id) ||
      (typeof meeting.host === 'object' && meeting.host._id === user?._id)
    ));
  const isCoHost = currentParticipant?.role === 'co-host';
  const canRecord = isHost || isCoHost || currentParticipant?.permissions?.canRecord;
  // Host can always chat, others depend on settings
  const canChat = isHost || (meeting?.settings?.enableChat !== false);

  const toggleRecording = async () => {
    if (!meeting) return;

    // Check permission - host can always record
    if (!isHost && !canRecord) {
      toast.error('You do not have permission to record this meeting');
      return;
    }

    try {
      if (!isRecording) {
        // Start client-side recording
        const localStream = webrtcService.getLocalStream();
        if (!localStream) {
          toast.error('No media stream available for recording');
          return;
        }

        // Clear previous chunks
        recordedChunksRef.current = [];

        // Create a combined stream with all tracks
        const combinedStream = new MediaStream();
        localStream.getTracks().forEach(track => combinedStream.addTrack(track));

        // Check supported mimeTypes
        let mimeType = 'video/webm;codecs=vp9,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm;codecs=vp8,opus';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm';
          }
        }

        const mediaRecorder = new MediaRecorder(combinedStream, { mimeType });

        // Store chunks in ref (not state) to avoid closure issues
        mediaRecorder.ondataavailable = (event) => {
          console.log('Recording data available:', event.data.size, 'bytes');
          if (event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          console.log('Recording stopped, chunks:', recordedChunksRef.current.length);
          
          // Create blob from recorded chunks using the ref
          const chunks = recordedChunksRef.current;
          if (chunks.length === 0) {
            toast.error('No recording data captured');
            return;
          }

          const blob = new Blob(chunks, { type: 'video/webm' });
          console.log('Recording blob size:', blob.size);
          
          // Upload to server
          const file = new File([blob], `recording-${meeting.meetingId}-${Date.now()}.webm`, {
            type: 'video/webm'
          });

          try {
            await apiService.uploadRecording(meeting.meetingId, file);
            toast.success('Recording saved successfully!');
          } catch (error) {
            console.error('Error uploading recording:', error);
            toast.error('Failed to save recording to server');
          }

          // Always offer local download
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `meeting-${meeting.meetingId}-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          // Clear chunks
          recordedChunksRef.current = [];
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start(1000); // Collect data every second
        
        // Notify server
        await apiService.startRecording(meeting.meetingId);
        setIsRecording(true);
        toast.success('Recording started');
      } else {
        // Stop recording
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        
        await apiService.stopRecording(meeting.meetingId);
        setIsRecording(false);
        toast.success('Recording stopped - processing...');
      }
    } catch (error) {
      console.error('Error toggling recording:', error);
      toast.error('Failed to toggle recording');
    }
  };

  const toggleHandRaise = () => {
    const newState = !isHandRaised;
    setIsHandRaised(newState);
    
    if (meeting && user) {
      socketService.raiseHand(meeting.meetingId, newState, user._id, user.username);
      // Also update local participant state
      setMeeting(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.map(p => {
            if (p.user._id === user._id) {
              return {
                ...p,
                mediaState: { ...p.mediaState, handRaised: newState }
              };
            }
            return p;
          })
        };
      });
    }
  };

  const leaveMeeting = async () => {
    try {
      if (meeting) {
        await apiService.leaveMeeting(meeting.meetingId);
      }
      cleanup();
      navigate('/dashboard');
    } catch (error) {
      console.error('Error leaving meeting:', error);
    }
  };

  const endMeeting = async () => {
    if (!meeting || !isHost) return;
    
    const confirmed = window.confirm(
      'Are you sure you want to end this meeting for everyone? Meeting minutes will be generated and sent to all participants.'
    );
    
    if (!confirmed) return;

    try {
      toast.loading('Ending meeting and generating minutes...', { id: 'end-meeting' });
      
      // End the meeting
      await apiService.endMeeting(meeting.meetingId);
      
      // Generate meeting minutes with transcripts (if available)
      try {
        const transcriptsData = subtitles.map(s => ({
          speakerName: s.speaker,
          startTime: s.timestamp,
          text: s.text
        }));
        
        await apiService.generateMeetingMinutes(meeting.meetingId, transcriptsData);
        toast.success('Meeting ended! Minutes have been generated and sent to participants.', { id: 'end-meeting' });
      } catch (minutesError) {
        console.error('Error generating minutes:', minutesError);
        toast.success('Meeting ended! (Minutes generation may have failed)', { id: 'end-meeting' });
      }
      
      cleanup();
      navigate('/dashboard');
    } catch (error) {
      console.error('Error ending meeting:', error);
      toast.error('Failed to end meeting', { id: 'end-meeting' });
    }
  };

  const cleanup = () => {
    webrtcService.cleanup();
    socketService.disconnect();
    setLocalStreamReady(false);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !meeting) return;

    // Check chat permission
    if (!canChat) {
      toast.error('Chat is disabled by the host');
      return;
    }

    try {
      // Send via API to save to database
      const response = await apiService.sendMessage(meeting.meetingId, newMessage);
      
      if (response.success && response.data?.message) {
        // Add message to local state immediately for better UX
        const message = response.data.message;
        setChatMessages(prev => [...prev, message]);
        setNewMessage('');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  // Clear unread messages when chat is opened
  useEffect(() => {
    if (showChat) {
      setUnreadMessages(0);
    }
  }, [showChat]);

  // Host settings handlers
  const updateMeetingSettings = async (newSettings: Partial<Meeting['settings']>) => {
    if (!meeting || !isHost) return;

    // Optimistically update the UI
    setMeeting(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        settings: {
          ...prev.settings,
          ...newSettings
        }
      };
    });

    try {
      const response = await apiService.updateMeetingSettings(meeting.meetingId, newSettings);
      if (response.success && response.data?.meeting) {
        // Update with server response but keep modal open
        setMeeting(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            settings: response.data!.meeting.settings
          };
        });
        toast.success('Settings updated');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Failed to update settings');
      // Revert on error - refetch meeting
      const response = await apiService.getMeeting(meeting.meetingId);
      if (response.success && response.data) {
        setMeeting(response.data.meeting);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  const participantCount = meeting?.participants.filter(p => p.status === 'joined').length || 0;
  const gridClass = participantCount === 1 ? 'participant-grid-1' :
                   participantCount <= 4 ? 'participant-grid-2' :
                   participantCount <= 6 ? 'participant-grid-6' : 'participant-grid-9';

  return (
    <div className="min-h-screen bg-secondary-900 text-white">
      {/* Meeting Header */}
      <header className="bg-secondary-800 border-b border-secondary-700">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-semibold">{meeting?.title}</h1>
            <div className="flex items-center space-x-2 text-sm text-secondary-400">
              <UsersIcon className="w-4 h-4" />
              <span>{participantCount}</span>
            </div>
            {/* Meeting ID Badge */}
            <button
              onClick={() => setShowMeetingInfo(!showMeetingInfo)}
              className="flex items-center space-x-2 bg-secondary-700 hover:bg-secondary-600 px-3 py-1 rounded-lg text-sm transition-colors"
              title="Click to copy meeting ID"
            >
              <ShareIcon className="w-4 h-4" />
              <span className="font-mono">{meeting?.meetingId}</span>
            </button>
            {isRecording && (
              <div className="flex items-center space-x-2 text-red-500">
                <CircleStackIcon className="w-4 h-4 animate-pulse" />
                <span className="text-sm">Recording</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Host Settings Button */}
            {isHost && (
              <button
                onClick={() => setShowHostSettings(!showHostSettings)}
                className={`p-2 rounded-lg transition-colors ${
                  showHostSettings ? 'bg-primary-600' : 'hover:bg-secondary-700'
                }`}
                title="Host Settings"
              >
                <Cog6ToothIcon className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setShowSubtitles(!showSubtitles)}
              className={`p-2 rounded-lg transition-colors ${
                showSubtitles ? 'bg-primary-600' : 'hover:bg-secondary-700'
              }`}
              title="Toggle Subtitles"
            >
              <DocumentTextIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowChat(!showChat)}
              className={`p-2 rounded-lg transition-colors relative ${
                showChat ? 'bg-primary-600' : 'hover:bg-secondary-700'
              }`}
            >
              <ChatBubbleLeftRightIcon className="w-5 h-5" />
              {unreadMessages > 0 && !showChat && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowParticipants(!showParticipants)}
              className={`p-2 rounded-lg transition-colors ${
                showParticipants ? 'bg-primary-600' : 'hover:bg-secondary-700'
              }`}
            >
              <UsersIcon className="w-5 h-5" />
            </button>
            <button
              onClick={leaveMeeting}
              className="bg-red-600 hover:bg-red-700 p-2 rounded-lg transition-colors"
            >
              <PhoneXMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Notifications Panel */}
      {notifications.length > 0 && (
        <div className="fixed top-16 right-4 z-40 space-y-2 max-w-sm">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`flex items-start space-x-3 p-3 rounded-lg shadow-lg animate-slide-up ${
                notification.type === 'join' ? 'bg-green-600' :
                notification.type === 'hand' ? 'bg-yellow-600' :
                'bg-primary-600'
              }`}
            >
              <div className="flex-shrink-0">
                {notification.type === 'join' && <UsersIcon className="w-5 h-5" />}
                {notification.type === 'hand' && <HandRaisedIcon className="w-5 h-5" />}
                {notification.type === 'message' && <ChatBubbleLeftRightIcon className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{notification.message}</p>
                <p className="text-xs opacity-75">
                  {notification.timestamp.toLocaleTimeString()}
                </p>
              </div>
              <button
                onClick={() => removeNotification(notification.id)}
                className="flex-shrink-0 hover:bg-white/20 rounded p-1 transition-colors"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Meeting Info Modal */}
      {showMeetingInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowMeetingInfo(false)}>
          <div className="bg-secondary-800 rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">Share Meeting</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-secondary-400 mb-2">Meeting ID</label>
                <div className="flex items-center space-x-2">
                  <code className="flex-1 bg-secondary-700 px-4 py-3 rounded-lg font-mono text-lg">
                    {meeting?.meetingId}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(meeting?.meetingId || '');
                      toast.success('Meeting ID copied!');
                    }}
                    className="bg-primary-600 hover:bg-primary-700 p-3 rounded-lg transition-colors"
                    title="Copy Meeting ID"
                  >
                    <ClipboardDocumentIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-secondary-400 mb-2">Join Link</label>
                <div className="flex items-center space-x-2">
                  <code className="flex-1 bg-secondary-700 px-4 py-3 rounded-lg text-sm truncate">
                    {window.location.origin}/join/{meeting?.meetingId}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/join/${meeting?.meetingId}`);
                      toast.success('Join link copied!');
                    }}
                    className="bg-primary-600 hover:bg-primary-700 p-3 rounded-lg transition-colors"
                    title="Copy Join Link"
                  >
                    <ClipboardDocumentIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <p className="text-sm text-secondary-400">
                Share this meeting ID or link with others so they can join your meeting.
              </p>
            </div>

            <button
              onClick={() => setShowMeetingInfo(false)}
              className="w-full mt-6 bg-secondary-700 hover:bg-secondary-600 py-2 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Host Settings Modal */}
      {showHostSettings && isHost && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowHostSettings(false)}>
          <div className="bg-secondary-800 rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">Host Settings</h3>
            
            <div className="space-y-4">
              {/* Chat Settings */}
              <div className="flex items-center justify-between p-3 bg-secondary-700 rounded-lg">
                <div>
                  <p className="font-medium">Enable Chat</p>
                  <p className="text-sm text-secondary-400">Allow participants to send messages</p>
                </div>
                <button
                  onClick={() => updateMeetingSettings({ enableChat: !meeting?.settings.enableChat })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    meeting?.settings.enableChat ? 'bg-green-600' : 'bg-secondary-600'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    meeting?.settings.enableChat ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* Recording Permission */}
              <div className="flex items-center justify-between p-3 bg-secondary-700 rounded-lg">
                <div>
                  <p className="font-medium">Enable Recording</p>
                  <p className="text-sm text-secondary-400">Allow meeting to be recorded</p>
                </div>
                <button
                  onClick={() => updateMeetingSettings({ enableRecording: !meeting?.settings.enableRecording })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    meeting?.settings.enableRecording ? 'bg-green-600' : 'bg-secondary-600'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    meeting?.settings.enableRecording ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* Screen Share Permission */}
              <div className="flex items-center justify-between p-3 bg-secondary-700 rounded-lg">
                <div>
                  <p className="font-medium">Enable Screen Share</p>
                  <p className="text-sm text-secondary-400">Allow participants to share screen</p>
                </div>
                <button
                  onClick={() => updateMeetingSettings({ enableScreenShare: !meeting?.settings.enableScreenShare })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    meeting?.settings.enableScreenShare ? 'bg-green-600' : 'bg-secondary-600'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    meeting?.settings.enableScreenShare ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* Mute on Entry */}
              <div className="flex items-center justify-between p-3 bg-secondary-700 rounded-lg">
                <div>
                  <p className="font-medium">Mute on Entry</p>
                  <p className="text-sm text-secondary-400">Mute participants when they join</p>
                </div>
                <button
                  onClick={() => updateMeetingSettings({ muteOnEntry: !meeting?.settings.muteOnEntry })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    meeting?.settings.muteOnEntry ? 'bg-green-600' : 'bg-secondary-600'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    meeting?.settings.muteOnEntry ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowHostSettings(false)}
              className="w-full mt-6 bg-secondary-700 hover:bg-secondary-600 py-2 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Main Meeting Area */}
      <div className="flex h-[calc(100vh-60px)]">
        {/* Video Grid */}
        <div className={`flex-1 ${gridClass} participant-grid relative`}>
          {/* Subtitles Overlay */}
          {showSubtitles && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 max-w-2xl">
              <div className="bg-black/80 backdrop-blur-sm rounded-lg p-3 max-h-32 overflow-y-auto">
                {subtitles.length === 0 ? (
                  <p className="text-white text-sm text-center italic">Listening for speech...</p>
                ) : (
                  <div className="space-y-2">
                    {subtitles.slice(-3).map((subtitle, index) => (
                      <div key={index} className="text-white text-sm">
                        <span className="font-semibold text-primary-400">{subtitle.speaker}: </span>
                        <span>{subtitle.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Local Video */}
          <div className="video-container relative">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-4 left-4 bg-black/50 px-2 py-1 rounded text-sm">
              You
              {isHandRaised && <HandRaisedIcon className="inline w-4 h-4 ml-1 text-yellow-400" />}
            </div>
            {!isVideoEnabled && (
              <div className="absolute inset-0 bg-secondary-800 flex items-center justify-center">
                <UserCircleIcon className="w-16 h-16 text-secondary-600" />
              </div>
            )}
          </div>

          {/* Screen Share */}
          {isScreenSharing && (
            <div className="video-container col-span-full">
              <video
                ref={screenVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute top-4 left-4 bg-green-600 px-3 py-1 rounded text-sm">
                You are sharing your screen
              </div>
            </div>
          )}

          {/* Remote Videos */}
          {Array.from(remoteStreams.entries()).map(([userId, stream]) => (
            <div key={userId} className="video-container relative">
              <video
                autoPlay
                playsInline
                className="w-full h-full object-cover"
                ref={(video) => {
                  if (video && video.srcObject !== stream) {
                    video.srcObject = stream;
                  }
                }}
              />
              <div className="absolute bottom-4 left-4 bg-black/50 px-2 py-1 rounded text-sm">
                User {userId.slice(0, 8)}
              </div>
            </div>
          ))}

          {/* No empty slots - only show actual participants */}
        </div>

        {/* Side Panel */}
        {(showChat || showParticipants) && (
          <div className="w-80 bg-secondary-800 border-l border-secondary-700 flex flex-col absolute right-0 top-14 bottom-16">
            {showChat && (
              <div className={`flex flex-col ${showParticipants ? 'h-1/2 border-b border-secondary-700' : 'h-full'}`}>
                <div className="p-4 border-b border-secondary-700">
                  <h3 className="font-semibold">Chat</h3>
                </div>
                
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                  {chatMessages.map((msg, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-primary-400">
                          {msg.sender?.username || 'System'}
                        </span>
                        <span className="text-xs text-secondary-400">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-secondary-200">{msg.message}</p>
                    </div>
                  ))}
                </div>

                <form onSubmit={sendMessage} className="p-4 border-t border-secondary-700 flex-shrink-0">
                  {canChat ? (
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 bg-secondary-700 border border-secondary-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
                      />
                      <button
                        type="submit"
                        className="bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-lg text-sm transition-colors"
                      >
                        Send
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center space-x-2 text-secondary-400 py-2">
                      <LockClosedIcon className="w-4 h-4" />
                      <span className="text-sm">Chat disabled by host</span>
                    </div>
                  )}
                </form>
              </div>
            )}

            {showParticipants && (
              <div className={`flex flex-col ${showChat ? 'h-1/2' : 'h-full'}`}>
                <div className="p-4 border-b border-secondary-700">
                  <h3 className="font-semibold">Participants ({participantCount})</h3>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {meeting?.participants
                    .filter(p => p.status === 'joined')
                    .map((participant) => (
                      <div key={participant.user._id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium">
                              {participant.user.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium">{participant.user.username}</p>
                            <p className="text-xs text-secondary-400">{participant.role}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {participant.mediaState.audioEnabled ? (
                            <MicrophoneIcon className="w-4 h-4 text-green-400" />
                          ) : (
                            <SpeakerXMarkIcon className="w-4 h-4 text-red-400" />
                          )}
                          {participant.mediaState.videoEnabled ? (
                            <VideoCameraIcon className="w-4 h-4 text-green-400" />
                          ) : (
                            <VideoCameraSlashIcon className="w-4 h-4 text-red-400" />
                          )}
                          {participant.mediaState.handRaised && (
                            <HandRaisedIcon className="w-4 h-4 text-yellow-400" />
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Meeting Controls */}
      <div className="fixed bottom-0 left-0 right-0 bg-secondary-800 border-t border-secondary-700">
        <div className="flex items-center justify-center space-x-4 py-4">
          <button
            onClick={toggleAudio}
            className={`p-3 rounded-full transition-colors ${
              isAudioEnabled 
                ? 'bg-secondary-700 hover:bg-secondary-600' 
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isAudioEnabled ? (
              <MicrophoneIcon className="w-6 h-6" />
            ) : (
              <SpeakerXMarkIcon className="w-6 h-6" />
            )}
          </button>

          <button
            onClick={toggleVideo}
            className={`p-3 rounded-full transition-colors ${
              isVideoEnabled 
                ? 'bg-secondary-700 hover:bg-secondary-600' 
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isVideoEnabled ? (
              <VideoCameraIcon className="w-6 h-6" />
            ) : (
              <VideoCameraSlashIcon className="w-6 h-6" />
            )}
          </button>

          <button
            onClick={toggleScreenShare}
            disabled={!isHost && !isCoHost && meeting?.settings.enableScreenShare === false}
            className={`p-3 rounded-full transition-colors ${
              isScreenSharing 
                ? 'bg-blue-600 hover:bg-blue-700' 
                : (!isHost && !isCoHost && meeting?.settings.enableScreenShare === false)
                  ? 'bg-secondary-800 cursor-not-allowed opacity-50'
                  : 'bg-secondary-700 hover:bg-secondary-600'
            }`}
            title={(!isHost && !isCoHost && meeting?.settings.enableScreenShare === false) ? 'Screen share disabled by host' : 'Share screen'}
          >
            <ComputerDesktopIcon className="w-6 h-6" />
          </button>

          <button
            onClick={toggleRecording}
            disabled={!isHost && !canRecord}
            className={`p-3 rounded-full transition-colors ${
              isRecording 
                ? 'bg-red-600 hover:bg-red-700' 
                : (!isHost && !canRecord)
                  ? 'bg-secondary-800 cursor-not-allowed opacity-50'
                  : 'bg-secondary-700 hover:bg-secondary-600'
            }`}
            title={(!isHost && !canRecord) ? 'Recording not allowed' : (isRecording ? 'Stop recording' : 'Start recording')}
          >
            {isRecording ? (
              <StopIcon className="w-6 h-6" />
            ) : (
              <CircleStackIcon className="w-6 h-6" />
            )}
          </button>

          <button
            onClick={toggleHandRaise}
            className={`p-3 rounded-full transition-colors ${
              isHandRaised 
                ? 'bg-yellow-600 hover:bg-yellow-700' 
                : 'bg-secondary-700 hover:bg-secondary-600'
            }`}
          >
            <HandRaisedIcon className="w-6 h-6" />
          </button>

          {isHost ? (
            <button
              onClick={endMeeting}
              className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-full transition-colors flex items-center space-x-2"
              title="End meeting for everyone"
            >
              <PhoneXMarkIcon className="w-6 h-6" />
              <span>End Meeting</span>
            </button>
          ) : (
            <button
              onClick={leaveMeeting}
              className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-full transition-colors flex items-center space-x-2"
            >
              <PhoneXMarkIcon className="w-6 h-6" />
              <span>Leave</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeetingPage;
