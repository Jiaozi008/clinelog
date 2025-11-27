import React, { useState, useMemo } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area, Legend,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { Movie, MovieStatus } from '../types';
import { Film, Tv, PlayCircle, Calendar, Filter, BarChart3, PieChart as PieChartIcon, Activity, Star, Hexagon, Clock } from 'lucide-react';

interface StatsProps {
  movies: Movie[];
}

type TimeFrame = 'all' | 'year' | 'month';

export const Stats: React.FC<StatsProps> = ({ movies }) => {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('all');
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  );

  // 1. Extract available dates for dropdowns
  const { years, months } = useMemo(() => {
    const yearsSet = new Set<string>();
    const monthsSet = new Set<string>();
    
    movies.forEach(m => {
      const d = new Date(m.addedAt);
      yearsSet.add(d.getFullYear().toString());
      monthsSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    });

    return {
      years: Array.from(yearsSet).sort((a, b) => b.localeCompare(a)),
      months: Array.from(monthsSet).sort((a, b) => b.localeCompare(a))
    };
  }, [movies]);

  // 2. Filter Data based on selection
  const filteredMovies = useMemo(() => {
    return movies.filter(movie => {
      const d = new Date(movie.addedAt);
      if (timeFrame === 'all') return true;
      if (timeFrame === 'year') {
        return d.getFullYear().toString() === selectedYear;
      }
      if (timeFrame === 'month') {
        const movieMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return movieMonth === selectedMonth;
      }
      return true;
    });
  }, [movies, timeFrame, selectedYear, selectedMonth]);

  // 3. Calculate Aggregate Stats
  const { 
    total, 
    movieCount, 
    tvCount, 
    totalEpisodesWatched,
    totalDurationFormatted,
    avgRating, 
    statusData, 
    ratingData, 
    trendData, 
    genreData
  } = useMemo(() => {
    const total = filteredMovies.length;
    
    // Status & Counts
    const statusCounts = filteredMovies.reduce((acc, m) => {
      acc[m.status] = (acc[m.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const statusData = Object.keys(statusCounts).map(status => ({
      name: status,
      value: statusCounts[status]
    }));

    // Ratings
    const ratingCounts = filteredMovies.reduce((acc, m) => {
      if(m.rating > 0) acc[m.rating] = (acc[m.rating] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const ratingData = [1, 2, 3, 4, 5].map(star => ({
      name: `${star}星`,
      count: ratingCounts[star] || 0
    }));

    // Averages & TV logic
    const totalRating = filteredMovies.reduce((sum, m) => sum + m.rating, 0);
    const ratedCount = filteredMovies.filter(m => m.rating > 0).length;
    const avgRating = ratedCount > 0 ? (totalRating / ratedCount).toFixed(1) : '0';

    const movieCount = filteredMovies.filter(m => (!m.mediaType || m.mediaType === 'movie')).length;
    
    // Movie Duration (Total)
    const movieDuration = filteredMovies
        .filter(m => (!m.mediaType || m.mediaType === 'movie'))
        .reduce((sum, m) => sum + (m.duration || 0), 0);

    // TV Logic
    const tvEntries = filteredMovies.filter(m => m.mediaType === 'tv');
    
    // Deduplicate TV shows by title for the count
    const uniqueTvTitles = new Set(tvEntries.map(m => m.title.trim()));
    const tvCount = uniqueTvTitles.size;

    // TV Progress & Duration (Deduplicated by title)
    // We need to calculate total watched episodes AND total duration
    const tvCalcMap = new Map<string, { maxEp: number, duration: number }>();
    
    tvEntries.forEach(m => {
      const title = m.title.trim();
      const ep = m.currentEpisode || 0;
      const dur = m.duration || 0;
      
      const existing = tvCalcMap.get(title) || { maxEp: 0, duration: 0 };
      tvCalcMap.set(title, {
          maxEp: Math.max(existing.maxEp, ep),
          // Use the duration from the record if available, otherwise keep existing
          duration: dur || existing.duration
      });
    });

    const totalEpisodesWatched = Array.from(tvCalcMap.values()).reduce((sum, item) => sum + item.maxEp, 0);
    const tvDuration = Array.from(tvCalcMap.values()).reduce((sum, item) => sum + (item.maxEp * item.duration), 0);

    // Total Duration formatting
    const totalMinutes = movieDuration + tvDuration;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const totalDurationFormatted = { hours, minutes: mins };

    // Trend Data (Timeline)
    let trendMap = new Map<string, number>();
    let trendFormat: { label: string, key: string }[] = [];

    if (timeFrame === 'month') {
        // Daily trend
        const [y, m] = selectedMonth.split('-').map(Number);
        const daysInMonth = new Date(y, m, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
            trendMap.set(i.toString(), 0);
        }
        filteredMovies.forEach(mov => {
            const d = new Date(mov.addedAt);
            trendMap.set(d.getDate().toString(), (trendMap.get(d.getDate().toString()) || 0) + 1);
        });
        trendFormat = Array.from(trendMap.keys()).map(k => ({ label: `${k}日`, key: k }));
    } else if (timeFrame === 'year') {
        // Monthly trend
        for (let i = 1; i <= 12; i++) trendMap.set(i.toString(), 0);
        filteredMovies.forEach(mov => {
            const d = new Date(mov.addedAt);
            trendMap.set((d.getMonth() + 1).toString(), (trendMap.get((d.getMonth() + 1).toString()) || 0) + 1);
        });
        trendFormat = Array.from(trendMap.keys()).map(k => ({ label: `${k}月`, key: k }));
    } else {
        // Yearly trend
        filteredMovies.forEach(mov => {
            const y = new Date(mov.addedAt).getFullYear().toString();
            trendMap.set(y, (trendMap.get(y) || 0) + 1);
        });
        // Sort years
        const sortedYears = Array.from(trendMap.keys()).sort();
        trendFormat = sortedYears.map(y => ({ label: `${y}年`, key: y }));
    }
    
    const trendData = trendFormat.map(item => ({
        name: item.label,
        count: trendMap.get(item.key) || 0
    }));

    // Genre Data
    const genreCounts: Record<string, number> = {};
    filteredMovies.forEach(m => {
        if (!m.genre) {
            genreCounts['未知'] = (genreCounts['未知'] || 0) + 1;
            return;
        }
        // Split by common separators: , / space，
        const genres = m.genre.split(/[,，/、\s]+/).filter(g => g.trim().length > 0);
        genres.forEach(g => {
            genreCounts[g] = (genreCounts[g] || 0) + 1;
        });
    });
    
    const genreData = Object.entries(genreCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8); // Top 8 genres

    return { 
      total, movieCount, tvCount, totalEpisodesWatched, totalDurationFormatted, avgRating, 
      statusData, ratingData, trendData, genreData 
    };
  }, [filteredMovies, timeFrame, selectedMonth, selectedYear]);

  // A more diverse and vibrant color palette
  const CHART_COLORS = [
    '#6366f1', // Indigo 500
    '#10b981', // Emerald 500
    '#f59e0b', // Amber 500
    '#ec4899', // Pink 500
    '#3b82f6', // Blue 500
    '#8b5cf6', // Violet 500
    '#f43f5e', // Rose 500
    '#06b6d4', // Cyan 500
    '#84cc16', // Lime 500
    '#d946ef', // Fuchsia 500
    '#f97316', // Orange 500
    '#14b8a6', // Teal 500
  ];

  if (movies.length === 0) return null;

  return (
    <div className="space-y-6 mb-8">
      
      {/* 1. Header & Filter Bar */}
      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
            <BarChart3 className="text-indigo-400" size={20} />
            <h2 className="text-lg font-bold text-white">数据统计面板</h2>
        </div>
        
        <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700">
             <button 
                onClick={() => setTimeFrame('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${timeFrame === 'all' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
             >
                全部
             </button>
             <button 
                onClick={() => setTimeFrame('year')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${timeFrame === 'year' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
             >
                按年
             </button>
             <button 
                onClick={() => setTimeFrame('month')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${timeFrame === 'month' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
             >
                按月
             </button>
        </div>

        <div className="flex gap-2">
            {timeFrame === 'year' && (
                <select 
                    value={selectedYear} 
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="bg-slate-700 text-white text-sm rounded-lg px-3 py-1.5 border border-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                    {years.map(y => <option key={y} value={y}>{y}年</option>)}
                </select>
            )}
            {timeFrame === 'month' && (
                <select 
                    value={selectedMonth} 
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-slate-700 text-white text-sm rounded-lg px-3 py-1.5 border border-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                    {months.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
            )}
        </div>
      </div>

      {/* 2. Key Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
         <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent" />
            <div className="text-slate-400 text-xs mb-1 z-10 font-medium">总记录</div>
            <div className="text-3xl font-bold text-white z-10">{total}</div>
         </div>

         <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent" />
            <div className="flex gap-4 z-10 w-full justify-center">
                <div className="text-center">
                    <div className="text-slate-400 text-[10px] mb-1 flex items-center gap-1 justify-center"><Film size={10}/> 电影</div>
                    <div className="text-xl font-bold text-emerald-400">{movieCount}</div>
                </div>
                <div className="w-px bg-slate-700 h-8 self-center"></div>
                <div className="text-center">
                    <div className="text-slate-400 text-[10px] mb-1 flex items-center gap-1 justify-center"><Tv size={10}/> 剧集</div>
                    <div className="text-xl font-bold text-blue-400">{tvCount}</div>
                </div>
            </div>
         </div>

         <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent" />
            <div className="text-slate-400 text-xs mb-1 z-10 font-medium flex items-center gap-1"><PlayCircle size={12}/> 累计追剧</div>
            <div className="text-3xl font-bold text-amber-400 z-10">{totalEpisodesWatched} <span className="text-sm text-amber-400/60">集</span></div>
         </div>
         
         {/* Total Duration Card - NEW */}
         <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent" />
            <div className="text-slate-400 text-xs mb-1 z-10 font-medium flex items-center gap-1"><Clock size={12}/> 总观看时长</div>
            <div className="text-xl font-bold text-cyan-400 z-10 whitespace-nowrap">
                {totalDurationFormatted.hours > 0 && <span className="text-2xl">{totalDurationFormatted.hours}<span className="text-sm text-cyan-400/60">h</span> </span>}
                {totalDurationFormatted.minutes}<span className="text-sm text-cyan-400/60">m</span>
            </div>
         </div>

         <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col items-center justify-center relative overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent" />
             <div className="text-slate-400 text-xs mb-1 z-10 font-medium">平均评分</div>
             <div className="text-3xl font-bold text-yellow-400 z-10">{avgRating} <span className="text-sm">★</span></div>
         </div>
      </div>

      {/* 3. Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Chart A: Viewing Trend (Area Chart) */}
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg min-h-[250px] md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
                <Activity size={16} className="text-indigo-400" />
                <h3 className="text-sm font-medium text-slate-300">
                    {timeFrame === 'year' ? `${selectedYear}年 观影趋势` : timeFrame === 'month' ? `${selectedMonth} 观影趋势` : '年度观影趋势'}
                </h3>
            </div>
            <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#818cf8" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis dataKey="name" stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                        <YAxis stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                            itemStyle={{ color: '#818cf8' }}
                        />
                        <Area type="monotone" dataKey="count" stroke="#818cf8" fillOpacity={1} fill="url(#colorCount)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Chart B: Genre Preference (Bar Chart - Horizontal) */}
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg min-h-[250px]">
             <div className="flex items-center gap-2 mb-4">
                <Filter size={16} className="text-emerald-400" />
                <h3 className="text-sm font-medium text-slate-300">类型偏好 Top 8 (条形图)</h3>
            </div>
            <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={genreData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" stroke="#94a3b8" tick={{fontSize: 11}} width={50} axisLine={false} tickLine={false} />
                        <Tooltip 
                            cursor={{fill: '#334155'}}
                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={12}>
                            {genreData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Chart C: Genre Distribution (Radar Chart) */}
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg min-h-[250px]">
             <div className="flex items-center gap-2 mb-4">
                <Hexagon size={16} className="text-purple-400" />
                <h3 className="text-sm font-medium text-slate-300">类型分布 (雷达图)</h3>
            </div>
            <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={genreData}>
                        <PolarGrid stroke="#334155" />
                        <PolarAngleAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                        <Radar name="数量" dataKey="value" stroke="#a855f7" fill="#a855f7" fillOpacity={0.5} />
                        <Tooltip 
                             contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                        />
                    </RadarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Chart D: Status Distribution (Pie Chart) */}
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg min-h-[250px]">
             <div className="flex items-center gap-2 mb-4">
                <PieChartIcon size={16} className="text-amber-400" />
                <h3 className="text-sm font-medium text-slate-300">状态分布</h3>
            </div>
            <div className="h-[200px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={statusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                        >
                            {statusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                            itemStyle={{ color: '#fff' }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-[65%] text-center pointer-events-none">
                    <div className="text-2xl font-bold text-white">{total}</div>
                    <div className="text-[10px] text-slate-400">Total</div>
                </div>
            </div>
        </div>

        {/* Chart E: Rating Distribution (Bar Chart) */}
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg min-h-[250px]">
             <div className="flex items-center gap-2 mb-4">
                <Star size={16} className="text-yellow-400" />
                <h3 className="text-sm font-medium text-slate-300">评分分布</h3>
            </div>
            <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ratingData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                         <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis dataKey="name" stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                        <YAxis stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip 
                            cursor={{fill: '#334155'}}
                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                        />
                        <Bar dataKey="count" fill="#eab308" radius={[4, 4, 0, 0]} barSize={30} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

      </div>
    </div>
  );
};