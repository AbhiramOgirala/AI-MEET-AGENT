import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { ApiResponse, AuthResponse, User, Meeting, CreateMeetingRequest, JoinMeetingRequest } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle errors
    this.api.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Authentication endpoints
  async register(userData: {
    username: string;
    email: string;
    password: string;
    profile?: any;
  }): Promise<ApiResponse<AuthResponse>> {
    const response = await this.api.post('/auth/register', userData);
    return response.data;
  }

  async login(credentials: {
    email: string;
    password: string;
  }): Promise<ApiResponse<AuthResponse>> {
    const response = await this.api.post('/auth/login', credentials);
    return response.data;
  }

  async joinAsGuest(username: string): Promise<ApiResponse<AuthResponse>> {
    const response = await this.api.post('/auth/guest', { username });
    return response.data;
  }

  async getCurrentUser(): Promise<ApiResponse<{ user: User }>> {
    const response = await this.api.get('/auth/me');
    return response.data;
  }

  async updateProfile(profileData: {
    profile?: any;
    preferences?: any;
  }): Promise<ApiResponse<{ user: User }>> {
    const response = await this.api.put('/auth/profile', profileData);
    return response.data;
  }

  async logout(): Promise<ApiResponse> {
    const response = await this.api.post('/auth/logout');
    return response.data;
  }

  // Meeting endpoints
  async createMeeting(meetingData: CreateMeetingRequest): Promise<ApiResponse<{ meeting: Meeting }>> {
    const response = await this.api.post('/meetings', meetingData);
    return response.data;
  }

  async getMeeting(meetingId: string): Promise<ApiResponse<{ meeting: Meeting }>> {
    const response = await this.api.get(`/meetings/${meetingId}`);
    return response.data;
  }

  async joinMeeting(meetingId: string, data?: JoinMeetingRequest): Promise<ApiResponse<{ meeting: Meeting }>> {
    const response = await this.api.post(`/meetings/${meetingId}/join`, data);
    return response.data;
  }

  async leaveMeeting(meetingId: string): Promise<ApiResponse> {
    const response = await this.api.post(`/meetings/${meetingId}/leave`);
    return response.data;
  }

  async getUserMeetings(params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{ meetings: Meeting[]; pagination: any }>> {
    const response = await this.api.get('/meetings', { params });
    return response.data;
  }

  async updateMeetingSettings(meetingId: string, settings: Partial<Meeting['settings']>): Promise<ApiResponse<{ meeting: Meeting }>> {
    const response = await this.api.put(`/meetings/${meetingId}/settings`, { settings });
    return response.data;
  }

  async endMeeting(meetingId: string): Promise<ApiResponse> {
    const response = await this.api.post(`/meetings/${meetingId}/end`);
    return response.data;
  }

  async scheduleMeeting(meetingData: {
    title: string;
    description?: string;
    duration: number;
    scheduledFor: string;
  }): Promise<ApiResponse<{ meeting: Meeting }>> {
    const response = await this.api.post('/meetings/schedule', meetingData);
    return response.data;
  }

  async cancelMeeting(meetingId: string): Promise<ApiResponse> {
    const response = await this.api.post(`/meetings/${meetingId}/cancel`);
    return response.data;
  }

  // Chat endpoints
  async sendMessage(meetingId: string, message: string, type: 'text' | 'file' = 'text'): Promise<ApiResponse<{ message: any }>> {
    const response = await this.api.post('/chat/message', { meetingId, message, type });
    return response.data;
  }

  async uploadFile(meetingId: string, file: File): Promise<ApiResponse<{ message: any }>> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('meetingId', meetingId);

    const response = await this.api.post('/chat/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async getChatHistory(meetingId: string, page = 1, limit = 50): Promise<ApiResponse<{ messages: any[]; pagination: any }>> {
    const response = await this.api.get(`/chat/${meetingId}`, { params: { page, limit } });
    return response.data;
  }

  // Recording endpoints
  async startRecording(meetingId: string): Promise<ApiResponse<{ recording: any }>> {
    const response = await this.api.post('/recordings/start', { meetingId });
    return response.data;
  }

  async stopRecording(meetingId: string): Promise<ApiResponse<{ recording: any }>> {
    const response = await this.api.post('/recordings/stop', { meetingId });
    return response.data;
  }

  async uploadRecording(meetingId: string, file: File): Promise<ApiResponse<{ recording: any }>> {
    const formData = new FormData();
    formData.append('recording', file);
    formData.append('meetingId', meetingId);

    const response = await this.api.post('/recordings/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async getMyRecordings(page = 1, limit = 10): Promise<ApiResponse<{ recordings: any[]; pagination: any }>> {
    const response = await this.api.get('/recordings/my-recordings', { params: { page, limit } });
    return response.data;
  }

  // User endpoints
  async searchUsers(query: string): Promise<ApiResponse<{ users: User[] }>> {
    const response = await this.api.get('/users/search', { params: { q: query } });
    return response.data;
  }

  async getUserProfile(): Promise<ApiResponse<{ user: User }>> {
    const response = await this.api.get('/users/profile');
    return response.data;
  }

  // Meeting Minutes endpoints
  async generateMeetingMinutes(meetingId: string, transcripts?: any[]): Promise<ApiResponse<{ minutes: any }>> {
    // Longer timeout for AI processing (60 seconds)
    const response = await this.api.post(`/meeting-minutes/${meetingId}/generate`, { transcripts }, {
      timeout: 60000
    });
    return response.data;
  }

  async getMeetingMinutes(meetingId: string): Promise<ApiResponse<{ minutes: any }>> {
    const response = await this.api.get(`/meeting-minutes/${meetingId}`);
    return response.data;
  }

  async getUserMeetingMinutes(page = 1, limit = 10): Promise<ApiResponse<{ minutes: any[]; pagination: any }>> {
    const response = await this.api.get('/meeting-minutes', { params: { page, limit } });
    return response.data;
  }

  async resendMeetingMinutesEmail(meetingId: string, email?: string): Promise<ApiResponse<{ results: any[] }>> {
    const response = await this.api.post(`/meeting-minutes/${meetingId}/resend-email`, { email });
    return response.data;
  }

  // Transcript endpoints
  async saveTranscripts(meetingId: string, transcripts: any[]): Promise<ApiResponse<{ totalTranscripts: number }>> {
    const response = await this.api.post(`/meetings/${meetingId}/transcripts`, { transcripts });
    return response.data;
  }

  async getTranscripts(meetingId: string): Promise<ApiResponse<{ transcripts: any[] }>> {
    const response = await this.api.get(`/meetings/${meetingId}/transcripts`);
    return response.data;
  }
}

export const apiService = new ApiService();
export default apiService;
