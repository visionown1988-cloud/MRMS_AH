
export enum MatchStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED'
}

export enum GameResult {
  PENDING = '待定',
  WIN = '勝',
  LOSS = '負',
  DRAW = '和'
}

export enum UserRole {
  GUEST = 'GUEST',
  ADMIN = 'ADMIN',
  REFEREE = 'REFEREE'
}

export interface PlayerInfo {
  id: string;
  name: string;
}

export interface TableMatch {
  tableNumber: number;
  player1: PlayerInfo;
  player2: PlayerInfo;
  assignedReferee?: string; // Optional now, as we use a session-wide pool
  result: GameResult;
  submittedBy?: string;
  updatedAt?: string;
}

export interface MatchSession {
  id: string;
  title: string;
  status: MatchStatus;
  referees: string[]; // Pool of referees for this session
  tables: TableMatch[];
  createdAt: string;
}
