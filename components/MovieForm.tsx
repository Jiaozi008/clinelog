import React, { useState, useEffect } from 'react';
import { Movie, MovieStatus, MediaType } from '../types';
import { Button } from './ui/Button';
import { StarRating } from './StarRating';
import { fetchMovieMetadata, generateAiReview } from '../services/geminiService';
import { Wand2, Sparkles, X, Tv, Film } from 'lucide-react';

interface MovieFormProps {
  initialData?: Movie | null;
  existingMovies: Movie[];
  onSubmit: (movie: Omit<Movie, 'id' | 'lastUpdated'> & { id?: string }) => void;
  onCancel: () => void;
}

export const MovieForm: React.FC<MovieFormProps> = ({ initialData, existingMovies, onSubmit, onCancel }) => {
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [country, setCountry] = useState('');
  const [genre, setGenre] = useState('');
  const [director, setDirector] = useState('');
  const [rating, setRating] = useState(0);
  const [status, setStatus] = useState<MovieStatus>(MovieStatus.WATCHED);
  const [review, setReview] = useState('');
  const [posterColor, setPosterColor] = useState('#4f46e5');
  const [watchedDate, setWatchedDate] = useState('');
  
  // New Fields
  const [mediaType, setMediaType] = useState<MediaType>('movie');
  const [currentEpisode, setCurrentEpisode] = useState<string>(''); // Use string for input handling
  const [totalEpisodes, setTotalEpisodes] = useState<string>('');
  const [duration, setDuration] = useState<string>(''); // Minutes

  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isReviewLoading, setIsReviewLoading] = useState(false);

  // Initialize Data
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setYear(initialData.year || '');
      setCountry(initialData.country || '');
      setGenre(initialData.genre || '');
      setDirector(initialData.director || '');
      setRating(initialData.rating);
      setStatus(initialData.status);
      setReview(initialData.review || '');
      setPosterColor(initialData.posterColor || '#4f46e5');
      
      setMediaType(initialData.mediaType || 'movie');
      setCurrentEpisode(initialData.currentEpisode ? initialData.currentEpisode.toString() : '');
      setTotalEpisodes(initialData.totalEpisodes ? initialData.totalEpisodes.toString() : '');
      setDuration(initialData.duration ? initialData.duration.toString() : '');

      // Initialize date string from timestamp (local time)
      if (initialData.addedAt) {
        const d = new Date(initialData.addedAt);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        setWatchedDate(dateStr);
      }
    } else {
      // Default to today for new records
      const d = new Date();
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      setWatchedDate(dateStr);
    }
  }, [initialData]);

  // Auto-fill logic for existing TV Series
  useEffect(() => {
    // Only run if adding a new record (not editing) and we have a title
    if (!initialData && title.length > 1) {
        // Find the most recent entry with the same title that is a TV show
        // We look for exact match (case insensitive) to be safe
        const match = existingMovies
            .filter(m => m.mediaType === 'tv' && m.title.toLowerCase() === title.trim().toLowerCase())
            .sort((a, b) => b.addedAt - a.addedAt)[0]; // Sort by newest first

        if (match) {
            // Auto-fill metadata from previous record
            setMediaType('tv');
            setYear(match.year);
            setCountry(match.country || '');
            setGenre(match.genre);
            setDirector(match.director || '');
            setPosterColor(match.posterColor);
            setTotalEpisodes(match.totalEpisodes ? match.totalEpisodes.toString() : '');
            setDuration(match.duration ? match.duration.toString() : '');
            
            // Suggest next episode
            if (match.currentEpisode) {
                setCurrentEpisode((match.currentEpisode + 1).toString());
            }
        }
    }
  }, [title, initialData, existingMovies]);

  const handleAiFill = async () => {
    if (!title) return;
    setIsAiLoading(true);
    const data = await fetchMovieMetadata(title);
    if (data) {
      // Check for existing record
      const isDuplicate = existingMovies.some(
        m => m.title === data.title && m.id !== initialData?.id
      );

      if (isDuplicate) {
        const confirmUpdate = window.confirm(
          `检测到库中已有 “${data.title}” 的记录。\n\n是否继续使用 AI 数据填充当前表单？`
        );
        
        if (!confirmUpdate) {
            setIsAiLoading(false);
            return;
        }
      }

      setTitle(data.title);
      setYear(data.year);
      setCountry(data.country || '');
      setGenre(data.genre);
      setDirector(data.director);
      setPosterColor(data.suggestedColorHex);
      setMediaType(data.mediaType);
      if (data.duration) setDuration(data.duration.toString());

      if (data.mediaType === 'tv' && data.totalEpisodes) {
        setTotalEpisodes(data.totalEpisodes.toString());
        // If adding new, suggest watched all if status is watched
        if (!initialData && status === MovieStatus.WATCHED) {
             setCurrentEpisode(data.totalEpisodes.toString());
        }
      }
    }
    setIsAiLoading(false);
  };

  const handleAiReview = async () => {
    if (!title) return;
    setIsReviewLoading(true);
    const generatedReview = await generateAiReview(title, rating, mediaType);
    setReview(generatedReview);
    setIsReviewLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const addedAtTimestamp = watchedDate ? new Date(watchedDate).getTime() : Date.now();

    onSubmit({
      id: initialData?.id,
      title,
      year, 
      country,
      genre,
      director,
      rating,
      status,
      review,
      posterColor,
      mediaType,
      currentEpisode: mediaType === 'tv' ? (parseInt(currentEpisode) || 0) : undefined,
      totalEpisodes: mediaType === 'tv' ? (parseInt(totalEpisodes) || 0) : undefined,
      duration: parseInt(duration) || 0,
      addedAt: addedAtTimestamp
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-slate-800">
          <h2 className="text-xl font-semibold text-white">
            {initialData ? '编辑记录' : '添加新记录'}
          </h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {/* Media Type Toggle */}
          <div className="flex bg-slate-800 p-1 rounded-lg mb-4">
            <button
                type="button"
                onClick={() => setMediaType('movie')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-all ${mediaType === 'movie' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
            >
                <Film size={16} /> 电影
            </button>
            <button
                type="button"
                onClick={() => setMediaType('tv')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-all ${mediaType === 'tv' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
            >
                <Tv size={16} /> 电视剧
            </button>
          </div>

          {/* Title Input with AI Button */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">标题</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder={mediaType === 'movie' ? "例如：盗梦空间" : "例如：三体 (输入同名剧集可自动填充)"}
                required
              />
              <Button 
                type="button" 
                variant="secondary" 
                onClick={handleAiFill} 
                disabled={!title || isAiLoading}
                title="使用 AI 自动填充"
              >
                {isAiLoading ? <Wand2 className="animate-spin" size={18} /> : <Wand2 size={18} />}
              </Button>
            </div>
          </div>

          {/* TV Specific Fields: Episodes */}
          {mediaType === 'tv' && (
              <div className="grid grid-cols-2 gap-4 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                  <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">已看集数</label>
                      <input
                          type="number"
                          min="0"
                          value={currentEpisode}
                          onChange={(e) => setCurrentEpisode(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                          placeholder="0"
                      />
                  </div>
                  <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">总集数</label>
                      <input
                          type="number"
                          min="0"
                          value={totalEpisodes}
                          onChange={(e) => setTotalEpisodes(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                          placeholder="例如: 24"
                      />
                  </div>
              </div>
          )}

          {/* Date and Release Year */}
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">观影日期</label>
                <input
                    type="date"
                    value={watchedDate}
                    onChange={(e) => setWatchedDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none placeholder-slate-500"
                    required
                />
             </div>
             <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">上映年份</label>
                <input
                    type="text"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="2024"
                />
             </div>
          </div>

          {/* Country and Genre */}
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">国家 / 地区</label>
                <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="例如: 美国"
                />
             </div>
             <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">类型</label>
                <input
                    type="text"
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="科幻"
                />
             </div>
          </div>

          {/* Director & Duration */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
                <label className="text-sm font-medium text-slate-300">导演 / 主创</label>
                <input
                    type="text"
                    value={director}
                    onChange={(e) => setDirector(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Christopher Nolan"
                />
            </div>
            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                    {mediaType === 'tv' ? '单集时长' : '时长'} (分钟)
                </label>
                <input
                    type="number"
                    min="0"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="120"
                />
            </div>
          </div>

          {/* Status & Rating */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">状态</label>
                <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as MovieStatus)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                >
                    {Object.values(MovieStatus).map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
            </div>
            <div className="space-y-2 flex flex-col justify-center">
                <label className="text-sm font-medium text-slate-300 mb-1">评分</label>
                <StarRating rating={rating} onRatingChange={setRating} size={24} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-slate-300">评价 / 笔记</label>
                <button 
                  type="button" 
                  onClick={handleAiReview}
                  className="text-indigo-400 text-xs flex items-center gap-1 hover:text-indigo-300 transition-colors"
                  disabled={isReviewLoading || !title}
                >
                    {isReviewLoading ? <Sparkles size={12} className="animate-pulse" /> : <Sparkles size={12} />}
                    AI 帮我写
                </button>
            </div>
            <textarea
                value={review}
                onChange={(e) => setReview(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                placeholder="你觉得这部作品怎么样？"
            />
          </div>
        </div>

        <div className="p-6 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/50 rounded-b-2xl">
            <Button variant="ghost" onClick={onCancel} type="button">取消</Button>
            <Button onClick={handleSubmit} type="submit">
                {initialData ? '保存修改' : '添加记录'}
            </Button>
        </div>
      </div>
    </div>
  );
};