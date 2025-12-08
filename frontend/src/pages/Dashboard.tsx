import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  VideoCameraIcon,
  CalendarIcon,
  ClockIcon,
  UsersIcon,
  PlusIcon,
  PlayIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { Meeting } from '../types';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newMeeting, setNewMeeting] = useState({
    title: '',
    description: '',
    duration: 60,
  });

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      const response = await apiService.getUserMeetings();
      if (response.success && response.data) {
        setMeetings(response.data.meetings);
      }
    } catch (error) {
      console.error('Error fetching meetings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await apiService.createMeeting(newMeeting);
      if (response.success && response.data) {
        setShowCreateModal(false);
        setNewMeeting({ title: '', description: '', duration: 60 });
        navigate(`/meeting/${response.data.meeting.meetingId}`);
      }
    } catch (error) {
      console.error('Error creating meeting:', error);
    }
  };

  const handleJoinMeeting = (meetingId: string) => {
    navigate(`/meeting/${meetingId}`);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const ongoingMeetings = meetings.filter(m => m.status === 'ongoing');
  const upcomingMeetings = meetings.filter(m => m.status === 'scheduled');
  const pastMeetings = meetings.filter(m => m.status === 'ended');

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-secondary-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <VideoCameraIcon className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-secondary-900">AI Meet</h1>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <UserCircleIcon className="w-8 h-8 text-secondary-400" />
                <div>
                  <p className="text-sm font-medium text-secondary-900">
                    {user?.profile?.firstName || user?.username}
                  </p>
                  <p className="text-xs text-secondary-500">
                    {user?.isGuest ? 'Guest' : 'Host'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="btn-ghost p-2 rounded-lg"
              >
                <ArrowRightOnRectangleIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h2 className="text-3xl font-bold text-secondary-900 mb-2">
            Welcome back, {user?.profile?.firstName || user?.username}!
          </h2>
          <p className="text-secondary-600">
            Ready to connect? Start or join a meeting below.
          </p>
        </motion.div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreateModal(true)}
            className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all"
          >
            <PlusIcon className="w-8 h-8 mb-3" />
            <h3 className="text-lg font-semibold mb-1">New Meeting</h3>
            <p className="text-primary-100 text-sm">Create an instant meeting</p>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/join')}
            className="bg-white border-2 border-primary-200 text-primary-700 p-6 rounded-xl shadow-lg hover:shadow-xl transition-all"
          >
            <PlayIcon className="w-8 h-8 mb-3" />
            <h3 className="text-lg font-semibold mb-1">Join Meeting</h3>
            <p className="text-primary-600 text-sm">Enter meeting code</p>
          </motion.button>

          <div className="bg-gradient-to-r from-accent-600 to-accent-700 text-white p-6 rounded-xl shadow-lg">
            <CalendarIcon className="w-8 h-8 mb-3" />
            <h3 className="text-lg font-semibold mb-1">Schedule</h3>
            <p className="text-accent-100 text-sm">Plan future meetings</p>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-secondary-500 text-sm">Total Meetings</p>
                <p className="text-2xl font-bold text-secondary-900">{user?.statistics.totalMeetings || 0}</p>
              </div>
              <UsersIcon className="w-8 h-8 text-primary-600" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-secondary-500 text-sm">Hosted</p>
                <p className="text-2xl font-bold text-secondary-900">{user?.statistics.meetingsHosted || 0}</p>
              </div>
              <VideoCameraIcon className="w-8 h-8 text-accent-600" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-secondary-500 text-sm">Attended</p>
                <p className="text-2xl font-bold text-secondary-900">{user?.statistics.meetingsAttended || 0}</p>
              </div>
              <ClockIcon className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-secondary-500 text-sm">Total Time</p>
                <p className="text-2xl font-bold text-secondary-900">{user?.statistics.totalMeetingTime || 0}m</p>
              </div>
              <ClockIcon className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Meetings List */}
        <div className="space-y-6">
          {/* Ongoing Meetings */}
          {ongoingMeetings.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-secondary-900 mb-4">Ongoing Meetings</h3>
              <div className="space-y-3">
                {ongoingMeetings.map((meeting) => (
                  <motion.div
                    key={meeting.meetingId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white p-4 rounded-lg shadow flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      <div>
                        <h4 className="font-medium text-secondary-900">{meeting.title}</h4>
                        <p className="text-sm text-secondary-500">
                          {meeting.participants.filter(p => p.status === 'joined').length} participants
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleJoinMeeting(meeting.meetingId)}
                      className="btn-primary px-4 py-2 text-sm"
                    >
                      Rejoin
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Meetings */}
          {upcomingMeetings.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-secondary-900 mb-4">Upcoming Meetings</h3>
              <div className="space-y-3">
                {upcomingMeetings.map((meeting) => (
                  <motion.div
                    key={meeting.meetingId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white p-4 rounded-lg shadow flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-medium text-secondary-900">{meeting.title}</h4>
                      <p className="text-sm text-secondary-500">
                        {formatDate(meeting.scheduledFor)} at {formatTime(meeting.scheduledFor)}
                      </p>
                      <p className="text-sm text-secondary-500">{meeting.duration} minutes</p>
                    </div>
                    <button
                      onClick={() => handleJoinMeeting(meeting.meetingId)}
                      className="btn-secondary px-4 py-2 text-sm"
                    >
                      Join
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Past Meetings */}
          {pastMeetings.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-secondary-900 mb-4">Past Meetings</h3>
              <div className="space-y-3">
                {pastMeetings.slice(0, 5).map((meeting) => (
                  <motion.div
                    key={meeting.meetingId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white p-4 rounded-lg shadow opacity-75"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-secondary-900">{meeting.title}</h4>
                        <p className="text-sm text-secondary-500">
                          {formatDate(meeting.scheduledFor)} • {meeting.statistics.totalDuration} minutes
                        </p>
                      </div>
                      <div className="flex items-center space-x-2 text-secondary-400">
                        <UsersIcon className="w-4 h-4" />
                        <span className="text-sm">{meeting.participants.length}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {meetings.length === 0 && !isLoading && (
            <div className="text-center py-12">
              <VideoCameraIcon className="w-16 h-16 text-secondary-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-secondary-900 mb-2">No meetings yet</h3>
              <p className="text-secondary-500 mb-4">Start your first meeting or join one with a code</p>
              <div className="space-x-4">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary px-6 py-2"
                >
                  New Meeting
                </button>
                <button
                  onClick={() => navigate('/join')}
                  className="btn-secondary px-6 py-2"
                >
                  Join Meeting
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Create Meeting Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl p-6 w-full max-w-md"
          >
            <h3 className="text-xl font-bold text-secondary-900 mb-4">Create New Meeting</h3>
            <form onSubmit={handleCreateMeeting} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  Meeting Title
                </label>
                <input
                  type="text"
                  value={newMeeting.title}
                  onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                  className="input"
                  placeholder="Enter meeting title"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={newMeeting.description}
                  onChange={(e) => setNewMeeting({ ...newMeeting, description: e.target.value })}
                  className="input"
                  rows={3}
                  placeholder="Add a description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  Duration (minutes)
                </label>
                <select
                  value={newMeeting.duration}
                  onChange={(e) => setNewMeeting({ ...newMeeting, duration: parseInt(e.target.value) })}
                  className="input"
                >
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                >
                  Create Meeting
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
