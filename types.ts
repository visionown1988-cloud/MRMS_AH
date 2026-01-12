
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

export interface ScoringConfig {
  win: { p1: number; p2: number };   // 先手勝時的分數
  loss: { p1: number; p2: number };  // 先手負時的分數
  draw: { p1: number; p2: number };  // 和棋時的分數
}

export interface TableMatch {
  tableNumber: number;
  player1: PlayerInfo;
  player2: PlayerInfo;
  assignedReferee?: string;
  result: GameResult;
  submittedBy?: string;
  updatedAt?: string;
}

export interface MatchSession {
  id: string;
  title: string;
  status: MatchStatus;
  referees: string[];
  tables: TableMatch[];
  scoringConfig: ScoringConfig;
  createdAt: string;
}
