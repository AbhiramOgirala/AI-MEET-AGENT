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
} from '@heroicons/react/24/outline';
import { apiService } from '../services/api';
import { socketService } from '../services/socket';
import { webrtcService } from '../services/webrtc';
import type { Meeting } from '../types';

const MeetingPage: React.FC = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [subtitles, setSubtitles] = useState<Array<{ speaker: string; text: string; timestamp: Date }>>([]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

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
    });

    socketService.onUserLeft((userId: string) => {
      console.log('User left:', userId);
      webrtcService.cleanupPeerConnection(userId);
    });

    // Meeting controls
    socketService.onAudioToggled((data) => {
      // Update UI for remote user's audio state
    });

    socketService.onVideoToggled((data) => {
      // Update UI for remote user's video state
    });

    socketService.onScreenShare((data) => {
      // Handle screen sharing updates
    });

    // Chat
    socketService.onChatMessage((data) => {
      setChatMessages(prev => [...prev, data]);
    });

    // Host controls
    socketService.onMutedByHost((data) => {
      setIsAudioEnabled(false);
      webrtcService.toggleAudio(false);
    });

    socketService.onRemovedFromMeeting((data) => {
      navigate('/dashboard');
    });

    // Interactions
    socketService.onHandRaised((data) => {
      // Update participants list
    });

    socketService.onReaction((data) => {
      // Show reaction animation
    });
  }, [navigate]);

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
    console.log('Local video effect - isAudioEnabled:', isAudioEnabled, 'isVideoEnabled:', isVideoEnabled);
    if (localVideoRef.current && webrtcService.getLocalStream()) {
      console.log('Setting local video stream');
      localVideoRef.current.srcObject = webrtcService.getLocalStream();
    } else {
      console.log('No local video stream available');
    }
  }, [isAudioEnabled, isVideoEnabled]);

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
    
    if (meeting) {
      socketService.toggleAudio(meeting.meetingId, newState);
    }
  };

  const toggleVideo = () => {
    const newState = !isVideoEnabled;
    setIsVideoEnabled(newState);
    webrtcService.toggleVideo(newState);
    
    if (meeting) {
      socketService.toggleVideo(meeting.meetingId, newState);
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        await webrtcService.startScreenShare();
        setIsScreenSharing(true);
        
        if (meeting) {
          socketService.startScreenShare(meeting.meetingId, 'screen-stream-id');
        }
      } catch (error) {
        console.error('Error starting screen share:', error);
      }
    } else {
      webrtcService.stopScreenShare();
      setIsScreenSharing(false);
    }
  };

  const toggleRecording = async () => {
    if (!meeting) return;

    try {
      if (!isRecording) {
        await apiService.startRecording(meeting.meetingId);
        setIsRecording(true);
      } else {
        await apiService.stopRecording(meeting.meetingId);
        setIsRecording(false);
      }
    } catch (error) {
      console.error('Error toggling recording:', error);
    }
  };

  const toggleHandRaise = () => {
    const newState = !isHandRaised;
    setIsHandRaised(newState);
    
    if (meeting) {
      socketService.raiseHand(meeting.meetingId, newState);
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

  const cleanup = () => {
    webrtcService.cleanup();
    socketService.disconnect();
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !meeting) return;

    try {
      await apiService.sendMessage(meeting.meetingId, newMessage);
      socketService.sendChatMessage(meeting.meetingId, newMessage);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
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
            <div className="flex items-center space-x-2 text-sm">
              <UsersIcon className="w-4 h-4" />
              <span>{participantCount}</span>
            </div>
            {isRecording && (
              <div className="flex items-center space-x-2 text-red-500">
                <CircleStackIcon className="w-4 h-4 animate-pulse" />
                <span className="text-sm">Recording</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
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
              className={`p-2 rounded-lg transition-colors ${
                showChat ? 'bg-primary-600' : 'hover:bg-secondary-700'
              }`}
            >
              <ChatBubbleLeftRightIcon className="w-5 h-5" />
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
          <div className="w-80 bg-secondary-800 border-l border-secondary-700 flex flex-col">
            {showChat && (
              <>
                <div className="p-4 border-b border-secondary-700">
                  <h3 className="font-semibold">Chat</h3>
                </div>
                
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
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

                <form onSubmit={sendMessage} className="p-4 border-t border-secondary-700">
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
                </form>
              </>
            )}

            {showParticipants && (
              <>
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
              </>
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
            className={`p-3 rounded-full transition-colors ${
              isScreenSharing 
                ? 'bg-blue-600 hover:bg-blue-700' 
                : 'bg-secondary-700 hover:bg-secondary-600'
            }`}
          >
            <ComputerDesktopIcon className="w-6 h-6" />
          </button>

          <button
            onClick={toggleRecording}
            className={`p-3 rounded-full transition-colors ${
              isRecording 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-secondary-700 hover:bg-secondary-600'
            }`}
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

          <button
            onClick={leaveMeeting}
            className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-full transition-colors flex items-center space-x-2"
          >
            <PhoneXMarkIcon className="w-6 h-6" />
            <span>Leave</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MeetingPage;
