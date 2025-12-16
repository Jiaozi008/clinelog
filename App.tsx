
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Movie, MovieStatus } from './types';
import { MovieCard } from './components/MovieCard';
import { MovieForm } from './components/MovieForm';
import { Button } from './components/ui/Button';
import { Stats } from './components/Stats';
import { Plus, Search, Save, Film, Download, FileJson, FileSpreadsheet, ChevronDown, Calendar, CheckSquare, Trash2, X, Upload, ArrowUpDown, Globe, ChevronLeft, ChevronRight, Menu } from 'lucide-react';

// Helper for fuzzy search (Levenshtein Distance)
const levenshtein = (a: string, b: string): number => {
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  return matrix[b.length][a.length];
};

const fuzzyMatch = (text: string | undefined, search: string): boolean => {
  if (!search) return true;
  if (!text) return false;
  
  const cleanText = text.toLowerCase();
  const cleanSearch = search.toLowerCase();

  // 1. Exact substring match (Fast path)
  if (cleanText.includes(cleanSearch)) return true;
  
  // 2. Fuzzy match allowing typos
  // Only apply if search term is at least 2 chars long to avoid noise
  if (cleanSearch.length < 2) return false;

  // Allow 1 error for short words (<= 4 chars), 2 errors for longer words
  const maxErrors = cleanSearch.length > 4 ? 2 : 1;
  
  // Check against the full text if lengths are similar (e.g. Chinese titles)
  if (Math.abs(cleanText.length - cleanSearch.length) <= maxErrors + 1) {
      if (levenshtein(cleanText, cleanSearch) <= maxErrors) return true;
  }

  // Check against individual words (e.g. English titles)
  // Split by whitespace and common punctuation
  const words = cleanText.split(/[\s\-_：:，,。]+/); 
  
  return words.some(word => {
      // Optimization: length difference check
      if (Math.abs(word.length - cleanSearch.length) > maxErrors) return false;
      return levenshtein(cleanSearch, word) <= maxErrors;
  });
};

const STORAGE_KEY = 'cinelog_movies_v1';

export default function App() {
  const [movies, setMovies] = useState<Movie[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load movies", e);
      return [];
    }
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMovie, setEditingMovie] = useState<Movie | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('全部');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [filterCountry, setFilterCountry] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<{ field: string, direction: 'asc' | 'desc' }>({ field: 'addedAt', direction: 'desc' });
  const [isSaving, setIsSaving] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(24);

  // Bulk Selection States
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // File Input Ref for Import
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Real-time Save Effect
  useEffect(() => {
    setIsSaving(true);
    const handler = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(movies));
      setIsSaving(false);
    }, 500); // Debounce save slightly to show effect

    return () => clearTimeout(handler);
  }, [movies]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, dateFilter, filterCountry, sortConfig]);

  // Calculate available date options from data
  const dateOptions = useMemo(() => {
    const yearsSet = new Set<number>();
    const monthsSet = new Set<string>();

    movies.forEach(m => {
      const d = new Date(m.addedAt);
      yearsSet.add(d.getFullYear());
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthsSet.add(monthStr);
    });

    const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
    const sortedMonths = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));

    return { years: sortedYears, months: sortedMonths };
  }, [movies]);

  // Calculate available country options
  const countryOptions = useMemo(() => {
    const countries = new Set<string>();
    movies.forEach(m => {
        if (m.country) {
            // Split by common separators (comma, slash, etc.) to get individual countries
            const parts = m.country.split(/[,，/、\s]+/).map(c => c.trim());
            parts.forEach(c => {
                if (c && c.length > 0) countries.add(c);
            });
        }
    });
    return Array.from(countries).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }, [movies]);

  const handleAddMovie = (movieData: Omit<Movie, 'id' | 'lastUpdated'>) => {
    const newMovie: Movie = {
      ...movieData,
      id: crypto.randomUUID(),
      // Use provided addedAt or fallback to now
      addedAt: movieData.addedAt || Date.now(),
      lastUpdated: Date.now(),
    };
    setMovies(prev => [newMovie, ...prev]); // Add to top
    setIsFormOpen(false);
  };

  const handleUpdateMovie = (movieData: any) => {
    setMovies(prev => prev.map(m => m.id === movieData.id ? {
      ...m,
      ...movieData,
      lastUpdated: Date.now()
    } : m));
    setIsFormOpen(false);
    setEditingMovie(null);
  };

  const handleDeleteMovie = (id: string) => {
    if (window.confirm('确定要删除这条记录吗？')) {
      // Ensure type safety by converting both to string
      setMovies(prev => prev.filter(m => String(m.id) !== String(id)));
    }
  };

  // Bulk Actions
  const toggleSelectionMode = () => {
      setIsSelectionMode(!isSelectionMode);
      setSelectedIds(new Set()); // Clear selection when toggling
  };

  const toggleSelectMovie = (id: string) => {
      const newSelected = new Set(selectedIds);
      if (newSelected.has(id)) {
          newSelected.delete(id);
      } else {
          newSelected.add(id);
      }
      setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
      // Select only visible items on current page or all? 
      // User expectation usually is "Select All Visible" or "Select All in List".
      // Let's select ALL currently sorted/filtered movies to be more powerful.
      if (selectedIds.size === sortedMovies.length) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(sortedMovies.map(m => m.id)));
      }
  };

  const handleBulkDelete = () => {
      if (selectedIds.size === 0) return;
      if (window.confirm(`确定要删除选中的 ${selectedIds.size} 条记录吗？此操作无法撤销。`)) {
          // Ensure type safety
          setMovies(prev => prev.filter(m => !selectedIds.has(String(m.id))));
          setIsSelectionMode(false);
          setSelectedIds(new Set());
      }
  };

  // --- Export Logic ---
  const convertToCSV = (data: Movie[]) => {
    const headers = ['ID', '标题', '年份', '国家/地区', '类型', '导演', '评分', '状态', '评价', '添加时间', '最后更新', '媒体类型', '当前集数', '总集数', '时长'];
    
    const escapeCsv = (str: string | undefined) => {
        if (!str) return '';
        const stringValue = String(str);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
    };

    const rows = data.map(m => [
      m.id,
      escapeCsv(m.title),
      escapeCsv(m.year),
      escapeCsv(m.country),
      escapeCsv(m.genre),
      escapeCsv(m.director),
      m.rating,
      m.status,
      escapeCsv(m.review),
      new Date(m.addedAt).toLocaleString('zh-CN'),
      new Date(m.lastUpdated).toLocaleString('zh-CN'),
      m.mediaType === 'tv' ? '电视剧' : '电影',
      m.currentEpisode || '',
      m.totalEpisodes || '',
      m.duration || ''
    ]);
    
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  };

  const handleExport = (format: 'json' | 'csv') => {
    let content = '';
    let type = '';
    let extension = '';

    if (format === 'json') {
      content = JSON.stringify(movies, null, 2);
      type = 'application/json';
      extension = 'json';
    } else {
      content = convertToCSV(movies);
      type = 'text/csv;charset=utf-8;';
      extension = 'csv';
      // Add BOM for Excel compatibility with UTF-8
      content = '\uFEFF' + content; 
    }

    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cinelog_backup_${new Date().toISOString().split('T')[0]}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  // --- Import Logic ---
  const handleImportClick = () => {
      if (fileInputRef.current) {
          fileInputRef.current.value = ''; // Reset
          fileInputRef.current.click();
      }
  };

  // CSV Parsing Helper: Handles quoted strings correctly
  const parseCSVLine = (text: string) => {
    const result = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            if (inQuote && text[i + 1] === '"') {
                current += '"';
                i++; // Skip next quote
            } else {
                inQuote = !inQuote;
            }
        } else if (char === ',' && !inQuote) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
          const content = e.target?.result as string;
          let newMovies: Movie[] = [];
          
          try {
              if (file.name.endsWith('.json')) {
                  const parsed = JSON.parse(content);
                  if (Array.isArray(parsed)) {
                      newMovies = parsed;
                  } else {
                      alert('JSON 格式错误：必须是数组格式');
                      return;
                  }
              } else if (file.name.endsWith('.csv')) {
                  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
                  // Remove BOM if present
                  if (lines[0].charCodeAt(0) === 0xFEFF) {
                      lines[0] = lines[0].slice(1);
                  }
                  
                  // Map headers from Chinese to keys
                  const headerRow = parseCSVLine(lines[0]);
                  const headerMap: Record<string, keyof Movie | string> = {
                      'ID': 'id',
                      '标题': 'title',
                      '年份': 'year',
                      '国家/地区': 'country',
                      '类型': 'genre',
                      '导演': 'director',
                      '评分': 'rating',
                      '状态': 'status',
                      '评价': 'review',
                      '添加时间': 'addedAt',
                      '最后更新': 'lastUpdated',
                      '媒体类型': 'mediaType',
                      '当前集数': 'currentEpisode',
                      '总集数': 'totalEpisodes',
                      '时长': 'duration'
                  };

                  const keyIndex: Record<number, string> = {};
                  headerRow.forEach((h, i) => {
                      if (headerMap[h]) keyIndex[i] = headerMap[h];
                  });

                  for (let i = 1; i < lines.length; i++) {
                      const values = parseCSVLine(lines[i]);
                      if (values.length < 2) continue; // Skip empty rows

                      const movie: any = { posterColor: '#4f46e5' }; // Default color if missing
                      
                      Object.keys(keyIndex).forEach((idxStr) => {
                          const idx = parseInt(idxStr);
                          const key = keyIndex[idx];
                          const val = values[idx] ? values[idx].trim() : '';

                          if (key === 'rating' || key === 'currentEpisode' || key === 'totalEpisodes' || key === 'duration') {
                              movie[key] = val ? parseFloat(val) : 0;
                          } else if (key === 'addedAt' || key === 'lastUpdated') {
                              // Try to parse date string, fallback to now
                              const ts = Date.parse(val);
                              movie[key] = isNaN(ts) ? Date.now() : ts;
                          } else if (key === 'mediaType') {
                              movie[key] = val === '电视剧' ? 'tv' : 'movie';
                          } else {
                              movie[key] = val;
                          }
                      });
                      
                      if (!movie.id) movie.id = crypto.randomUUID();
                      newMovies.push(movie as Movie);
                  }
              } else {
                  alert('不支持的文件格式。请上传 .json 或 .csv 文件。');
                  return;
              }

              // Merge logic: Filter out duplicates based on ID
              const currentIds = new Set(movies.map(m => String(m.id)));
              const uniqueNewMovies = newMovies.filter(m => !currentIds.has(String(m.id)));

              if (uniqueNewMovies.length > 0) {
                  setMovies(prev => [...uniqueNewMovies, ...prev]);
                  alert(`成功导入 ${uniqueNewMovies.length} 条新记录。${newMovies.length - uniqueNewMovies.length} 条重复记录已跳过。`);
              } else {
                  alert('没有发现新记录（所有记录已存在）。');
              }

          } catch (err) {
              console.error(err);
              alert('导入失败：文件格式不正确或已损坏。');
          }
      };
      reader.readAsText(file);
  };

  const openEdit = (movie: Movie) => {
    setEditingMovie(movie);
    setIsFormOpen(true);
  };

  // Derived state for filtering and sorting
  const filteredMovies = useMemo(() => {
    return movies.filter(movie => {
      // 1. Search Filter (with Fuzzy Match)
      const matchesSearch = fuzzyMatch(movie.title, searchTerm) || 
                            fuzzyMatch(movie.genre, searchTerm);
      
      // 2. Status Filter
      const matchesStatus = filterStatus === '全部' || movie.status === filterStatus;
      
      // 3. Date Filter
      let matchesDate = true;
      if (dateFilter !== 'all') {
        const movieDate = new Date(movie.addedAt);
        const now = new Date();
        
        if (dateFilter === '7d') {
            const cutoff = new Date();
            cutoff.setDate(now.getDate() - 7);
            matchesDate = movieDate >= cutoff;
        } else if (dateFilter === '30d') {
            const cutoff = new Date();
            cutoff.setDate(now.getDate() - 30);
            matchesDate = movieDate >= cutoff;
        } else if (dateFilter.startsWith('year_')) {
            const year = parseInt(dateFilter.split('_')[1]);
            matchesDate = movieDate.getFullYear() === year;
        } else if (dateFilter.startsWith('month_')) {
            const targetYM = dateFilter.replace('month_', '');
            const movieYM = `${movieDate.getFullYear()}-${String(movieDate.getMonth() + 1).padStart(2, '0')}`;
            matchesDate = targetYM === movieYM;
        }
      }

      // 4. Country Filter
      const matchesCountry = filterCountry === 'all' || (movie.country && movie.country.includes(filterCountry));

      return matchesSearch && matchesStatus && matchesDate && matchesCountry;
    });
  }, [movies, searchTerm, filterStatus, dateFilter, filterCountry]);

  const sortedMovies = useMemo(() => {
      const data = [...filteredMovies];
      const { field, direction } = sortConfig;

      data.sort((a, b) => {
          let valA = a[field as keyof Movie];
          let valB = b[field as keyof Movie];

          // Special Handling
          if (field === 'year') {
             // Handle numeric year strings if possible, defaulting to 0
             return (parseInt(String(a.year)) || 0) - (parseInt(String(b.year)) || 0);
          }
          if (field === 'title') {
              return String(a.title).localeCompare(String(b.title), 'zh-CN');
          }

          if (valA < valB) return -1;
          if (valA > valB) return 1;
          return 0;
      });

      return direction === 'asc' ? data : data.reverse();
  }, [filteredMovies, sortConfig]);

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentDisplayedMovies = sortedMovies.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedMovies.length / itemsPerPage);

  const handlePageChange = (page: number) => {
      if (page >= 1 && page <= totalPages) {
          setCurrentPage(page);
          window.scrollTo({ top: 0, behavior: 'smooth' }); // Optional: scroll to top
      }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 pb-20 font-sans">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept=".json,.csv" 
        className="hidden" 
      />

      {/* Floating Action Button for Mobile */}
      <button 
        onClick={() => { setEditingMovie(null); setIsFormOpen(true); }}
        className="fixed bottom-6 right-6 z-40 bg-indigo-600 text-white rounded-full p-4 shadow-2xl shadow-indigo-500/40 sm:hidden hover:scale-110 active:scale-95 transition-all"
        title="添加记录"
      >
        <Plus size={28} />
      </button>

      {/* Navbar */}
      <nav className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Film size={20} className="text-white" />
             </div>
             <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
               CineLog AI
             </span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 mr-2">
                <Save size={12} className={isSaving ? "animate-pulse text-indigo-400" : ""} />
                <span>{isSaving ? '保存中...' : '已保存'}</span>
            </div>
            
            <div className="relative hidden sm:flex gap-2">
                {/* Import Button */}
                <Button 
                    onClick={handleImportClick} 
                    variant="secondary" 
                    size="sm" 
                    className="shadow-lg shadow-slate-900/20 flex items-center" 
                    title="导入数据 (JSON/CSV)"
                >
                    <Upload size={16} className="mr-1" /> 导入
                </Button>

                {/* Export Button */}
                <div className="relative">
                    <Button 
                        onClick={() => setShowExportMenu(!showExportMenu)} 
                        variant="secondary" 
                        size="sm" 
                        className="shadow-lg shadow-slate-900/20 flex items-center" 
                        title="导出数据"
                    >
                        <Download size={16} className="mr-1" /> 导出 <ChevronDown size={12} className="ml-1 opacity-50" />
                    </Button>
                    
                    {showExportMenu && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)}></div>
                            <div className="absolute right-0 mt-2 w-40 bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden z-50">
                                <button 
                                    onClick={() => handleExport('json')}
                                    className="w-full px-4 py-3 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-2"
                                >
                                    <FileJson size={14} /> 导出 JSON
                                </button>
                                <button 
                                    onClick={() => handleExport('csv')}
                                    className="w-full px-4 py-3 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-2 border-t border-slate-700"
                                >
                                    <FileSpreadsheet size={14} /> 导出 CSV
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <Button onClick={() => toggleSelectionMode()} variant={isSelectionMode ? "primary" : "secondary"} size="sm" className="hidden sm:flex shadow-lg">
                <CheckSquare size={16} className="mr-1" /> {isSelectionMode ? '退出管理' : '批量管理'}
            </Button>
            
            <button onClick={() => toggleSelectionMode()} className="sm:hidden text-slate-400 hover:text-white">
                <CheckSquare size={20} className={isSelectionMode ? 'text-indigo-400' : ''} />
            </button>

            {/* Mobile Menu Trigger */}
            <button 
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="sm:hidden text-slate-400 hover:text-white"
            >
                <Menu size={24} />
            </button>

            {!isSelectionMode && (
                <Button onClick={() => { setEditingMovie(null); setIsFormOpen(true); }} size="sm" className="shadow-lg shadow-indigo-500/20 hidden sm:flex">
                <Plus size={16} className="mr-1" /> 新增记录
                </Button>
            )}

            {/* Mobile Menu Dropdown */}
            {showMobileMenu && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setShowMobileMenu(false)}></div>
                    <div className="absolute top-16 right-4 w-56 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                        <div className="p-3 border-b border-slate-700/50 bg-slate-900/50">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">数据管理</div>
                        </div>
                        
                        <button 
                            onClick={() => { handleImportClick(); setShowMobileMenu(false); }}
                            className="w-full px-4 py-3 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-3"
                        >
                            <Upload size={18} className="text-indigo-400" /> 导入数据
                        </button>
                        
                        <button 
                            onClick={() => { handleExport('json'); setShowMobileMenu(false); }}
                            className="w-full px-4 py-3 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-3 border-t border-slate-700/50"
                        >
                            <FileJson size={18} className="text-emerald-400" /> 导出 JSON
                        </button>
                        
                        <button 
                            onClick={() => { handleExport('csv'); setShowMobileMenu(false); }}
                            className="w-full px-4 py-3 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-3 border-t border-slate-700/50"
                        >
                            <FileSpreadsheet size={18} className="text-green-400" /> 导出 CSV
                        </button>
                    </div>
                </>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        <Stats movies={movies} />

        {/* Filters & Search - Mobile Optimized */}
        <div className="flex flex-col md:flex-row gap-4 mb-6 sticky top-16 z-20 bg-slate-900/95 p-3 -mx-4 sm:-mx-2 sm:rounded-xl border-y sm:border border-slate-800/50 backdrop-blur-sm shadow-xl shadow-black/20">
           {isSelectionMode ? (
               /* Bulk Action Toolbar */
               <div className="flex-1 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 px-1">
                    <div className="flex items-center gap-2">
                        <input 
                            type="checkbox" 
                            id="select-all"
                            checked={sortedMovies.length > 0 && selectedIds.size === sortedMovies.length}
                            onChange={handleSelectAll}
                            className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="select-all" className="text-sm font-medium cursor-pointer select-none whitespace-nowrap">
                            全选 ({sortedMovies.length})
                        </label>
                    </div>
                    
                    <div className="h-6 w-px bg-slate-700 mx-1"></div>
                    
                    <div className="text-sm text-slate-400 whitespace-nowrap">
                        选中 <span className="text-white font-bold">{selectedIds.size}</span>
                    </div>

                    <div className="flex-grow"></div>

                    <Button 
                        size="sm" 
                        variant="danger" 
                        disabled={selectedIds.size === 0}
                        onClick={handleBulkDelete}
                        className="flex items-center gap-1 px-3"
                    >
                        <Trash2 size={16} /> <span className="hidden sm:inline">删除选中</span>
                    </Button>
                    <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={toggleSelectionMode}
                        className="px-2"
                    >
                        <X size={16} />
                    </Button>
               </div>
           ) : (
               /* Standard Filter Toolbar */
               <>
                <div className="flex-1 flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input 
                        type="text" 
                        placeholder="搜索标题、类型..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-slate-500 transition-shadow"
                        />
                    </div>
                    
                    {/* Filter Scroll Container for Mobile */}
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                        {/* Sort Dropdown */}
                        <div className="relative min-w-[130px] shrink-0">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                                <ArrowUpDown size={14} />
                            </div>
                            <select
                                value={`${sortConfig.field}-${sortConfig.direction}`}
                                onChange={(e) => {
                                    const [field, direction] = e.target.value.split('-');
                                    setSortConfig({ field, direction: direction as 'asc' | 'desc' });
                                }}
                                className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-7 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-300 hover:text-white cursor-pointer transition-colors"
                            >
                                <option value="addedAt-desc">最近添加</option>
                                <option value="addedAt-asc">最早添加</option>
                                <option value="rating-desc">评分最高</option>
                                <option value="rating-asc">评分最低</option>
                                <option value="year-desc">年份最新</option>
                                <option value="year-asc">年份最旧</option>
                                <option value="title-asc">标题 (A-Z)</option>
                            </select>
                            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        </div>

                        {/* Country Filter */}
                        <div className="relative min-w-[110px] shrink-0">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                                <Globe size={14} />
                            </div>
                            <select
                                value={filterCountry}
                                onChange={(e) => setFilterCountry(e.target.value)}
                                className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-7 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-300 hover:text-white cursor-pointer transition-colors"
                            >
                                <option value="all">所有地区</option>
                                {countryOptions.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        </div>

                        <div className="relative min-w-[110px] shrink-0">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                                <Calendar size={14} />
                            </div>
                            <select
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-7 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-300 hover:text-white cursor-pointer transition-colors"
                            >
                                <optgroup label="快捷筛选">
                                    <option value="all">全部时间</option>
                                    <option value="7d">最近 7 天</option>
                                    <option value="30d">最近 30 天</option>
                                </optgroup>
                                {dateOptions.years.length > 0 && (
                                    <optgroup label="按年份">
                                        {dateOptions.years.map(y => (
                                            <option key={y} value={`year_${y}`}>{y} 年</option>
                                        ))}
                                    </optgroup>
                                )}
                                {dateOptions.months.length > 0 && (
                                    <optgroup label="按月份">
                                        {dateOptions.months.map(m => {
                                            const [y, mon] = m.split('-');
                                            return <option key={m} value={`month_${m}`}>{y}年 {mon}月</option>;
                                        })}
                                    </optgroup>
                                )}
                            </select>
                            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        </div>
                    </div>
                </div>
                
                <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
                    {['全部', ...Object.values(MovieStatus)].map((status) => (
                    <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors border ${
                        filterStatus === status 
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-500/20' 
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white'
                        }`}
                    >
                        {status}
                    </button>
                    ))}
                </div>
               </>
           )}
        </div>

        {/* Movie Grid */}
        {sortedMovies.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/50">
             <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 mb-4">
                 <Film size={32} className="text-slate-600" />
             </div>
             <h3 className="text-xl font-medium text-slate-300 mb-2">未找到记录</h3>
             <p className="text-slate-500 max-w-sm mx-auto mb-6">
               {searchTerm || filterStatus !== '全部' || dateFilter !== 'all' || filterCountry !== 'all'
                 ? "尝试调整搜索、时间、地区或状态筛选条件。" 
                 : "添加你看过的第一部电影或电视剧吧。"}
             </p>
             {(searchTerm === '' && filterStatus === '全部' && dateFilter === 'all' && filterCountry === 'all') && (
               <Button onClick={() => setIsFormOpen(true)}>添加第一条记录</Button>
             )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {currentDisplayedMovies.map(movie => (
                <MovieCard 
                    key={movie.id} 
                    movie={movie} 
                    onEdit={openEdit}
                    onDelete={handleDeleteMovie}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedIds.has(movie.id)}
                    onToggleSelect={toggleSelectMovie}
                />
                ))}
            </div>

            {/* Pagination Controls */}
            {sortedMovies.length > 0 && (
                <div className="flex flex-col sm:flex-row justify-between items-center mt-8 gap-4 bg-slate-800/50 p-4 rounded-xl border border-slate-800">
                    <div className="text-xs sm:text-sm text-slate-400 text-center sm:text-left">
                        正在显示 <span className="text-white font-medium">{indexOfFirstItem + 1}</span> - <span className="text-white font-medium">{Math.min(indexOfLastItem, sortedMovies.length)}</span> 条，
                        共 <span className="text-white font-medium">{sortedMovies.length}</span> 条
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                        <select 
                            value={itemsPerPage}
                            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                            className="bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-1.5 outline-none w-full sm:w-auto"
                        >
                            <option value={12}>每页 12 条</option>
                            <option value={24}>每页 24 条</option>
                            <option value={48}>每页 48 条</option>
                            <option value={96}>每页 96 条</option>
                        </select>

                        <div className="flex items-center gap-1 justify-center">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="p-2 rounded-lg bg-slate-900 text-slate-400 border border-slate-700 hover:bg-slate-800 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            
                            <span className="px-3 py-1 text-sm text-slate-300 font-medium whitespace-nowrap">
                                {currentPage} / {totalPages}
                            </span>

                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-lg bg-slate-900 text-slate-400 border border-slate-700 hover:bg-slate-800 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
          </>
        )}
      </main>

      {/* Modal */}
      {isFormOpen && (
        <MovieForm 
          initialData={editingMovie}
          existingMovies={movies}
          onSubmit={editingMovie ? handleUpdateMovie : handleAddMovie}
          onCancel={() => { setIsFormOpen(false); setEditingMovie(null); }}
        />
      )}
    </div>
  );
}
