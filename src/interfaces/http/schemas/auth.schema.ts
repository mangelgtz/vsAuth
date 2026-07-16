import { z } from 'zod';

export const RegisterBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(120),
});

export const LoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const RefreshBodySchema = z.object({
  refreshToken: z.string().min(10).optional(),
});

export const GoogleCallbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().optional(),
});

export const GoogleTokenBodySchema = z.object({
  idToken: z.string().min(20, 'idToken looks too short'),
});

export type RegisterBody = z.infer<typeof RegisterBodySchema>;
export type LoginBody = z.infer<typeof LoginBodySchema>;
export type RefreshBody = z.infer<typeof RefreshBodySchema>;
export type GoogleCallbackQuery = z.infer<typeof GoogleCallbackQuerySchema>;
export type GoogleTokenBody = z.infer<typeof GoogleTokenBodySchema>;
