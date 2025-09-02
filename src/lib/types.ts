// TypeScript interfaces for Tiki Taka app

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  nickname?: string;
  created_at: string;
  updated_at: string;
}

export interface PublicUser {
  id: string;
  nickname?: string;
  created_at: string;
}

export interface WeeklyResponse {
  id: string;
  user_id: string;
  week_date: string;
  status: 'yes' | 'maybe' | 'no' | 'no_response';
  response_token: string;
  responded_at?: string;
  created_at: string;
  updated_at: string;
}

export interface WeeklyResponsePublic {
  id: string;
  user_id: string;
  week_date: string;
  status: 'yes' | 'maybe' | 'no' | 'no_response';
  responded_at?: string;
  created_at: string;
  updated_at: string;
  user_name: string;
  user_nickname?: string;
}

export interface UserWithResponse extends User {
  weekly_response?: WeeklyResponse;
}

export interface UserWithPublicResponse extends PublicUser {
  weekly_responses_public: WeeklyResponsePublic[];
}

export type ResponseStatus = WeeklyResponse['status'];