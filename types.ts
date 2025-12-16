
export enum MovieStatus {
  WATCHED = '已看',
  PLANNING = '想看',
  DROPPED = '弃坑',
  WATCHING = '在看',
}

export type MediaType = 'movie' | 'tv';

export interface Movie {
  id: string;
  title: string;
  year: string;
  country?: string; // New field
  genre: string;
  director?: string;
  rating: number; // 0 to 5
  status: MovieStatus;
  review: string;
  posterColor: string; // Used for gradient placeholder if no image
  posterImage?: string; // Base64 encoded image
  addedAt: number; // Timestamp
  lastUpdated: number; // Timestamp for real-time save feedback
  
  // New fields for TV Series support
  mediaType: MediaType;
  currentEpisode?: number;
  totalEpisodes?: number;
  
  // New field for Duration
  duration?: number; // Minutes (Total for movie, per episode for TV)
}

export interface MovieStats {
  total: number;
  watched: number;
  averageRating: number;
  favoriteGenre: string;
}

export interface GeminiMovieResponse {
  title: string;
  year: string;
  country: string; // New field
  genre: string;
  director: string;
  summary: string;
  suggestedColorHex: string;
  mediaType: MediaType;
  totalEpisodes?: number;
  duration?: number; // Minutes
}
