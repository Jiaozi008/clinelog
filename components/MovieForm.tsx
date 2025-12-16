
import React, { useState, useEffect, useRef } from 'react';
import { Movie, MovieStatus, MediaType } from '../types';
import { Button } from './ui/Button';
import { StarRating } from './StarRating';
import { fetchMovieMetadata, generateAiReview } from '../services/geminiService';
import { Wand2, Sparkles, X, Tv, Film, Upload, Image as ImageIcon, Trash2, ArrowLeft } from 'lucide-react';

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
  const [posterImage, setPosterImage] = useState('');
  const [watchedDate, setWatchedDate] = useState('');
  
  // New Fields
  const [mediaType, setMediaType] = useState<MediaType>('movie');
  const [currentEpisode, setCurrentEpisode] = useState<string>(''); // Use string for input handling
  const [totalEpisodes, setTotalEpisodes] = useState<string>('');
  const [duration, setDuration] = useState<string>(''); // Minutes

  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isReviewLoading, setIsReviewLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setPosterImage(initialData.posterImage || '');
      
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
            setPosterImage(match.posterImage || '');
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

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 500;
          const scaleSize = MAX_WIDTH / img.width;
          
          // Only resize if width > MAX_WIDTH
          if (scaleSize < 1) {
             canvas.width = MAX_WIDTH;
             canvas.height = img.height * scaleSize;
          } else {
             canvas.width = img.width;
             canvas.height = img.height;
          }
          
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Compress quality to 0.7
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const resizedImage = await resizeImage(file);
        setPosterImage(resizedImage);
      } catch (error) {
        console.error("Error processing image:", error);
        alert("无法处理图片，请重试");
      }
    }
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
      posterImage,
      mediaType,
      currentEpisode: mediaType === 'tv' ? (parseInt(currentEpisode) || 0) : undefined,
      totalEpisodes: mediaType === 'tv' ? (parseInt(totalEpisodes) || 0) : undefined,
      duration: parseInt(duration) || 0,
      addedAt: addedAtTimestamp
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 sm:border border-slate-700 w-full h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl sm:max-w-lg shadow-2xl flex flex-col transition-all">
        {/* Header */}
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={onCancel} className="sm:hidden text-slate-400 hover:text-white mr-2">
                <ArrowLeft size={24} />
            </button>
            <h2 className="text-xl font-semibold text-white">
                {initialData ? '编辑记录' : '添加新记录'}
            </h2>
          </div>
          <button onClick={onCancel} className="hidden sm:block text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
          <Button onClick={handleSubmit} type="button" className="sm:hidden" size="sm">
            保存
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar bg-slate-900/50">
          {/* Media Type Toggle */}
          <div className="flex bg-slate-800 p-1 rounded-lg mb-4">
            <button
                type="button"
                onClick={() => setMediaType('movie')}
                className={`flex-1 py-3 sm:py-2 px-4 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-all ${mediaType === 'movie' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
            >
                <Film size={16} /> 电影
            </button>
            <button
                type="button"
                onClick={() => setMediaType('tv')}
                className={`flex-1 py-3 sm:py-2 px-4 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-all ${mediaType === 'tv' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
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
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 sm:py-2 text-base sm:text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder={mediaType === 'movie' ? "例如：盗梦空间" : "例如：三体"}
                required
              />
              <Button 
                type="button" 
                variant="secondary" 
                onClick={handleAiFill} 
                disabled={!title || isAiLoading}
                title="使用 AI 自动填充"
                className="px-3"
              >
                {isAiLoading ? <Wand2 className="animate-spin" size={20} /> : <Wand2 size={20} />}
              </Button>
            </div>
          </div>

          {/* Poster Image Upload */}
          <div className="space-y-2">
             <label className="text-sm font-medium text-slate-300">海报图片</label>
             <div className="flex items-center gap-4">
                 <div 
                    className="w-20 h-28 sm:w-16 sm:h-24 bg-slate-800 rounded-lg border border-slate-700 flex items-center justify-center overflow-hidden shrink-0 relative group cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ background: posterImage ? 'transparent' : posterColor }}
                 >
                     {posterImage ? (
                         <img src={posterImage} alt="Cover" className="w-full h-full object-cover" />
                     ) : (
                         <ImageIcon className="text-white/50" size={24} />
                     )}
                     <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                         <Upload size={16} className="text-white" />
                     </div>
                 </div>
                 
                 <div className="flex-1">
                     <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImageUpload} 
                        accept="image/*" 
                        className="hidden" 
                     />
                     <div className="flex gap-2 flex-wrap">
                         <Button 
                            type="button" 
                            variant="secondary" 
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="py-2"
                         >
                             上传封面
                         </Button>
                         {posterImage && (
                             <Button 
                                type="button" 
                                variant="danger" 
                                size="sm"
                                onClick={() => setPosterImage('')}
                                className="py-2"
                             >
                                 <Trash2 size={16} />
                             </Button>
                         )}
                     </div>
                     <p className="text-xs text-slate-500 mt-2">支持 JPG, PNG. 图片将自动压缩。</p>
                 </div>
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
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 sm:py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none text-base sm:text-sm"
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
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 sm:py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none text-base sm:text-sm"
                          placeholder="例如: 24"
                      />
                  </div>
              </div>
          )}

          {/* Date and Release Year - Stack on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">观影日期</label>
                <input
                    type="date"
                    value={watchedDate}
                    onChange={(e) => setWatchedDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 sm:py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none placeholder-slate-500 text-base sm:text-sm"
                    required
                />
             </div>
             <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">上映年份</label>
                <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 sm:py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none text-base sm:text-sm"
                    placeholder="2024"
                />
             </div>
          </div>

          {/* Country and Genre - Stack on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">国家 / 地区</label>
                <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 sm:py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none text-base sm:text-sm"
                    placeholder="例如: 美国"
                />
             </div>
             <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">类型</label>
                <input
                    type="text"
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 sm:py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none text-base sm:text-sm"
                    placeholder="科幻"
                />
             </div>
          </div>

          {/* Director & Duration - Stack on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-2">
                <label className="text-sm font-medium text-slate-300">导演 / 主创</label>
                <input
                    type="text"
                    value={director}
                    onChange={(e) => setDirector(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 sm:py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none text-base sm:text-sm"
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
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 sm:py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none text-base sm:text-sm"
                    placeholder="120"
                />
            </div>
          </div>

          {/* Status & Rating - Stack on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">状态</label>
                <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as MovieStatus)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 sm:py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none text-base sm:text-sm"
                >
                    {Object.values(MovieStatus).map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
            </div>
            <div className="space-y-2 flex flex-col justify-center py-2 sm:py-0">
                <label className="text-sm font-medium text-slate-300 mb-2 sm:mb-1">评分</label>
                <div className="flex justify-center sm:justify-start">
                    <StarRating rating={rating} onRatingChange={setRating} size={32} />
                </div>
            </div>
          </div>

          <div className="space-y-2 pb-20 sm:pb-0">
            <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-slate-300">评价 / 笔记</label>
                <button 
                  type="button" 
                  onClick={handleAiReview}
                  className="text-indigo-400 text-xs flex items-center gap-1 hover:text-indigo-300 transition-colors px-2 py-1 rounded hover:bg-slate-800"
                  disabled={isReviewLoading || !title}
                >
                    {isReviewLoading ? <Sparkles size={14} className="animate-pulse" /> : <Sparkles size={14} />}
                    AI 帮我写
                </button>
            </div>
            <textarea
                value={review}
                onChange={(e) => setReview(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none h-32 resize-none text-base sm:text-sm"
                placeholder="你觉得这部作品怎么样？"
            />
          </div>
        </div>

        {/* Footer (Hidden on mobile as we use header button or fixed bottom) */}
        <div className="hidden sm:flex p-6 border-t border-slate-800 justify-end gap-3 bg-slate-900/50 rounded-b-2xl shrink-0">
            <Button variant="ghost" onClick={onCancel} type="button">取消</Button>
            <Button onClick={handleSubmit} type="submit">
                {initialData ? '保存修改' : '添加记录'}
            </Button>
        </div>
      </div>
    </div>
  );
};
