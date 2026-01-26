import { z } from 'zod';

export const projectSchema = z.object({
    name: z.string().min(1, "Project name is required"),
    path: z.string().min(1, "Absolute path is required"),
});
export type ProjectFormData = z.infer<typeof projectSchema>;

export const noteSchema = z.object({
    project: z.string().min(1, "Project is required"),
    type: z.string(),
    text: z.string().min(1, "Content is required"),
});
export type NoteFormData = z.infer<typeof noteSchema>;
