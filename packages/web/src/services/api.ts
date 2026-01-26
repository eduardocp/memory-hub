import axios from 'axios';
import { API_URL } from '../config';

// Generic API service for REST calls
export const api = axios.create({
    baseURL: API_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    }
});

// Settings Service
export const SettingsService = {
    async getAll() {
        const response = await api.get('/settings');
        return response.data;
    },

    async save(key: string, value: string, category: string) {
        const response = await api.post('/settings', { key, value, category });
        return response.data;
    }
};

// AI Service
export const AIService = {
    async getModels() {
        const response = await api.get('/ai/models');
        return response.data;
    },

    async detectConnections() {
        const response = await api.post('/ai/connections');
        return response.data;
    }
};

// Summary Service
export const SummaryService = {
    async generate(project: string) {
        const response = await api.post('/summary/generate', { project });
        return response.data;
    }
};

// Reports Service
export const ReportsService = {
    async getTemplates() {
        const response = await api.get('/templates');
        return response.data;
    },

    async generate(templateId: string, project: string | null, options: { includeCommits?: boolean; onlyCommits?: boolean }) {
        const response = await api.post('/reports/generate', {
            templateId,
            project,
            options
        });
        return response.data;
    }
};

// Triggers Service
export const TriggersService = {
    async getAll() {
        const response = await api.get('/triggers');
        return response.data;
    },

    async getProjects() {
        const response = await api.get('/projects');
        return response.data;
    },

    async create(trigger: { name: string; type: string; schedule: string; action: string; config: object }) {
        const response = await api.post('/triggers', trigger);
        return response.data;
    },

    async delete(id: string) {
        const response = await api.delete(`/triggers/${id}`);
        return response.data;
    },

    async toggle(id: string, enabled: boolean) {
        const response = await api.patch(`/triggers/${id}/toggle`, { enabled });
        return response.data;
    }
};
