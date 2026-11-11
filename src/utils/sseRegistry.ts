// src/utils/sseRegistry.ts
import type { Response } from 'express';
import logger from './logger';

const clients = new Map<string, Set<Response>>();

export function addClient(userId: string, res: Response): void {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId)!.add(res);
  logger.info(`[sse] +user ${userId} (${clients.get(userId)!.size} streams)`);
}

export function removeClient(userId: string, res: Response): void {
  const set = clients.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) clients.delete(userId);
  logger.info(`[sse] -user ${userId}`);
}

function format(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function emit(userId: string, event: string, data: unknown): void {
  const set = clients.get(userId);
  if (!set) return;
  const payload = format(event, data);
  set.forEach((res) => {
    try {
      res.write(payload);
    } catch (err) {
      logger.warn('[sse] write failed', err);
    }
  });
}

export function emitMany(userIds: string[], event: string, data: unknown): void {
  userIds.forEach((id) => emit(id, event, data));
}