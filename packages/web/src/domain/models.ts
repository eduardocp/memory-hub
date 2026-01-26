export type EventType = 'note' | 'idea' | 'task_update' | 'summary' | 'system' | 'new_bug' | 'bug_update' | 'spike_progress' | 'new_feat' | 'git_commit';

export interface HelperEvent {
    id: string;
    timestamp: string;
    type: EventType;
    text: string;
    project: string;
    source?: string;
}

export interface Project {
    id: string;
    path: string;
    name: string;
    watch_enabled?: number;
}

export interface Trigger {
    id: string;
    name: string;
    type: string;
    schedule: string;
    action: string;
    config: string;
    enabled: boolean;
    last_run: string | null;
}

export interface Template {
    id: string;
    name: string;
    description: string;
    icon: string;
}
