// Board object types
export type ObjectType = 'sticky-note' | 'rectangle' | 'circle' | 'line' | 'text' | 'frame' | 'connector';

export interface BoardObject {
  id: string;
  type: ObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  text?: string;
  color: string;
  fontSize?: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  // For connectors
  fromId?: string;
  toId?: string;
  // For lines
  points?: number[];
}

export interface CursorPosition {
  userId: string;
  displayName: string;
  photoURL?: string;
  x: number;
  y: number;
  color: string;
  lastUpdated: number;
}

export interface BoardUser {
  uid: string;
  displayName: string;
  photoURL?: string;
  color: string;
  isOnline: boolean;
  lastSeen: number;
}

export interface Board {
  id: string;
  title: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  members: string[];
}

export interface AICommand {
  id: string;
  boardId: string;
  userId: string;
  prompt: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  result?: string;
  createdAt: number;
}

// Color palette for users
export const USER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F0B27A', '#82E0AA',
];

// Color palette for sticky notes
export const STICKY_COLORS = [
  '#FFEB3B', '#FF9800', '#E91E63', '#9C27B0',
  '#3F51B5', '#03A9F4', '#009688', '#4CAF50',
  '#8BC34A', '#FF5722', '#795548', '#607D8B',
];

export const DEFAULT_STICKY_COLOR = '#FFEB3B';
export const DEFAULT_SHAPE_COLOR = '#2196F3';
