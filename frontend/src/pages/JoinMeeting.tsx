import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { VideoCameraIcon, UserIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';

const JoinMeeting: React.FC = () => {
  const { meetingId } = useParams<{ meetingId?: string }>();
  const navigate = useNavigate();
  const { joinAsGuest, isAuthenticated } = useAuth();

  const [formData, setFormData] = useState({
    meetingId: meetingId || '',
    username: '',
    isGuest: false,
  });
  const [password, setPassword] = useState('');
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [meetingInfo, setMeetingInfo] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (meetingId) {
      setFormData(prev => ({ ...prev, meetingId }));
      checkMeeting(meetingId);
    }
  }, [meetingId]);

  const checkMeeting = async (id: string) => {
    try {
      const response = await apiService.getMeeting(id);
      if (response.success && response.data) {
        setMeetingInfo(response.data.meeting);
        setRequiresPassword(response.data.meeting.settings.requirePassword);
      }
    } catch (error) {
      setError('Meeting not found');
    }
  };

  const handleMeetingIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    setFormData({ ...formData, meetingId: value });
    
    // Auto-format meeting ID
    if (value.length === 3 || value.length === 7) {
      setFormData(prev => ({ ...prev, meetingId: value + '-' }));
    }
  };

  const handleJoinAsGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Join as guest using the joinAsGuest function from AuthContext
      await joinAsGuest(formData.username);
      
      // Join meeting
      const response = await apiService.joinMeeting(formData.meetingId, requiresPassword ? { password } : undefined);
      
      if (response.success) {
        navigate(`/meeting/${formData.meetingId}`);
      } else {
        setError(response.message || 'Failed to join meeting');
      }
    } catch (error: any) {
      setError(error.response?.data?.message || error.message || 'Failed to join meeting');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinWithAccount = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { returnUrl: `/join/${formData.meetingId}` } });
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await apiService.joinMeeting(formData.meetingId, requiresPassword ? { password } : undefined);
      
      if (response.success) {
        navigate(`/meeting/${formData.meetingId}`);
      } else {
        setError(response.message || 'Failed to join meeting');
      }
    } catch (error: any) {
      setError(error.response?.data?.message || error.message || 'Failed to join meeting');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 via-primary-700 to-accent-700">
      <div className="absolute inset-0 bg-black/20"></div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md px-4"
      >
        <div className="glass-effect rounded-2xl p-8 shadow-2xl">
          {/* Logo/Brand */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4"
            >
              <VideoCameraIcon className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-3xl font-bold text-white mb-2">Join Meeting</h1>
            <p className="text-white/80">Enter meeting details to connect</p>
          </div>

          {/* Meeting Info */}
          {meetingInfo && (
            <div className="bg-white/10 rounded-lg p-4 mb-6 border border-white/20">
              <h3 className="font-semibold text-white mb-2">{meetingInfo.title}</h3>
              <p className="text-white/70 text-sm mb-2">{meetingInfo.description}</p>
              <div className="flex items-center justify-between text-white/60 text-sm">
                <span>Host: {meetingInfo.host.username}</span>
                <span>{meetingInfo.participants.filter((p: any) => p.status === 'joined').length} participants</span>
              </div>
            </div>
          )}

          {/* Join Options */}
          <div className="space-y-6">
            {/* Meeting ID Input */}
            <div>
              <label htmlFor="meetingId" className="block text-sm font-medium text-white/90 mb-2">
                Meeting ID
              </label>
              <div className="relative">
                <VideoCameraIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/50" />
                <input
                  type="text"
                  id="meetingId"
                  value={formData.meetingId}
                  onChange={handleMeetingIdChange}
                  placeholder="XXX-XXX-XXX"
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all text-center font-mono text-lg"
                  maxLength={11}
                  required
                />
              </div>
            </div>

            {/* Password Input (if required) */}
            {requiresPassword && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-white/90 mb-2">
                  Meeting Password
                </label>
                <div className="relative">
                  <LockClosedIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/50" />
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter meeting password"
                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all"
                    required
                  />
                </div>
              </div>
            )}

            {/* Join Options */}
            {!isAuthenticated ? (
              <>
                {/* Guest Join Form */}
                <div className="space-y-4">
                  <div>
                    <label htmlFor="username" className="block text-sm font-medium text-white/90 mb-2">
                      Your Name
                    </label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/50" />
                      <input
                        type="text"
                        id="username"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        placeholder="Enter your name"
                        className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all"
                        required
                      />
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleJoinAsGuest}
                    disabled={isLoading || !formData.meetingId || (requiresPassword && !password) || !formData.username}
                    className="w-full bg-white text-primary-700 font-semibold py-3 rounded-lg hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-700 mr-2"></div>
                        Joining...
                      </div>
                    ) : (
                      'Join as Guest'
                    )}
                  </motion.button>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/20"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-transparent text-white/60">or</span>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/login', { state: { returnUrl: `/join/${formData.meetingId}` } })}
                  className="w-full bg-white/10 text-white font-semibold py-3 rounded-lg border border-white/20 hover:bg-white/20 transition-all"
                >
                  Sign In to Join
                </motion.button>
              </>
            ) : (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleJoinWithAccount}
                disabled={isLoading || !formData.meetingId || (requiresPassword && !password)}
                className="w-full bg-white text-primary-700 font-semibold py-3 rounded-lg hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-700 mr-2"></div>
                    Joining...
                  </div>
                ) : (
                  'Join Meeting'
                )}
              </motion.button>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}

          {/* Back to Dashboard */}
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-white/80 hover:text-white transition-colors text-sm"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default JoinMeeting;
